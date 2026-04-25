const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-1.5-flash-8b has the highest free-tier quota:
// - 15 RPM (requests per minute)
// - 4,000 RPD (requests per day)
// - 1M input tokens per minute
const MODEL_NAME = 'gemini-1.5-flash-8b';

/** Sleep for `ms` milliseconds */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extract the retry delay (in ms) from a Gemini 429 error response.
 * Falls back to `fallbackMs` if not parseable.
 */
const getRetryDelay = (err, fallbackMs = 60_000) => {
  try {
    // The error message contains the raw JSON body — parse retry delay from it
    const match = err.message.match(/"retryDelay":"(\d+)s"/);
    if (match) return (parseInt(match[1], 10) + 2) * 1000; // add 2s buffer
  } catch (_) {}
  return fallbackMs;
};

/**
 * Grade a single question using Gemini with retry-on-429 logic.
 * Returns: { marks: number, feedback: string }
 */
const gradeAnswer = async ({ questionText, maxMarks, modelAnswer, studentAnswer }, retries = 3) => {
  if (!studentAnswer || studentAnswer.trim().length < 3) {
    return { marks: 0, feedback: 'No answer provided or answer too short.' };
  }

  const prompt = `You are an exam evaluator. Grade the student's answer fairly and return ONLY valid JSON.

Question: ${questionText}
Max Marks: ${maxMarks}
Model Answer: ${modelAnswer}
Student Answer: ${studentAnswer}

Instructions:
- Award marks proportionally based on accuracy, completeness, and understanding
- Be fair but strict — partial credit is allowed
- Feedback must be 1-2 sentences, constructive, and specific

Return ONLY this JSON (no other text):
{
  "marks": <number between 0 and ${maxMarks}>,
  "feedback": "<1-2 sentence constructive feedback>"
}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({ model: MODEL_NAME });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip markdown code fences if present
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      return {
        marks: Math.min(Math.max(Number(parsed.marks) || 0, 0), maxMarks),
        feedback: parsed.feedback || 'Graded successfully.',
      };
    } catch (err) {
      const is429 = err.message?.includes('429') || err.message?.includes('Too Many Requests') || err.message?.includes('RESOURCE_EXHAUSTED');

      if (is429 && attempt < retries) {
        const delay = getRetryDelay(err, 65_000);
        console.warn(`⚠️  Rate limited (attempt ${attempt}/${retries}). Retrying in ${Math.round(delay / 1000)}s...`);
        await sleep(delay);
        continue;
      }

      console.error(`❌ AI grading error (attempt ${attempt}):`, err.message);
      // Fallback: award partial marks if all retries fail
      return {
        marks: Math.floor(maxMarks * 0.5),
        feedback: 'Auto-graded (AI service temporarily unavailable). Please review manually.',
      };
    }
  }
};

/** Delay between successive questions to respect 15 RPM free-tier limit (4s gap = ~15/min) */
const INTER_REQUEST_DELAY_MS = 4_500;

/**
 * Grade all questions for a student sheet sequentially with pacing.
 */
const gradeSheet = async (questions, ocrText) => {
  const results = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const studentAnswer = ocrText[`q${question.questionNumber}`] || '';

    const { marks, feedback } = await gradeAnswer({
      questionText: question.questionText,
      maxMarks: question.maxMarks,
      modelAnswer: question.modelAnswer,
      studentAnswer,
    });

    results.push({
      questionId: question._id,
      questionNumber: question.questionNumber,
      questionText: question.questionText,
      studentAnswer,
      marksAwarded: marks,
      maxMarks: question.maxMarks,
      feedback,
    });

    // Pace requests — skip delay after the last question
    if (i < questions.length - 1) {
      await sleep(INTER_REQUEST_DELAY_MS);
    }
  }

  return results;
};

module.exports = { gradeSheet };
