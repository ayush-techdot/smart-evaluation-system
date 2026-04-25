const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const Exam = require('../models/Exam');
const StudentSheet = require('../models/StudentSheet');
const { extractText } = require('../controllers/ocrService');
const { gradeSheet } = require('../controllers/gradingService');
const { generatePDF } = require('../controllers/pdfService');

// ─── EXAM CRUD ──────────────────────────────────────────────────────────────

// POST /api/exams — Create exam
router.post('/', protect, async (req, res) => {
  const { title, subject, totalMarks, questions } = req.body;
  if (!title || !subject || !totalMarks)
    return res.status(400).json({ message: 'Title, subject, and totalMarks are required' });

  const exam = await Exam.create({
    teacher: req.user._id,
    title,
    subject,
    totalMarks,
    questions: questions || [],
  });
  res.status(201).json(exam);
});

// GET /api/exams — List all exams for the logged-in teacher
router.get('/', protect, async (req, res) => {
  const exams = await Exam.find({ teacher: req.user._id }).sort({ createdAt: -1 });
  res.json(exams);
});

// GET /api/exams/:id — Get single exam
router.get('/:id', protect, async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  res.json(exam);
});

// DELETE /api/exams/:id — Delete exam
router.delete('/:id', protect, async (req, res) => {
  const exam = await Exam.findOneAndDelete({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });
  await StudentSheet.deleteMany({ exam: exam._id });
  res.json({ message: 'Exam deleted' });
});

// POST /api/exams/:id/questions — Add/replace questions
router.post('/:id/questions', protect, async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  exam.questions = req.body.questions;
  await exam.save();
  res.json(exam);
});

// ─── STUDENT SHEET UPLOAD ────────────────────────────────────────────────────

// POST /api/exams/:id/upload — Upload a student sheet
router.post('/:id/upload', protect, upload.single('sheet'), async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const { studentName, rollNumber } = req.body;
  if (!studentName || !rollNumber)
    return res.status(400).json({ message: 'studentName and rollNumber are required' });

  const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const sheet = await StudentSheet.create({
    exam: exam._id,
    studentName,
    rollNumber,
    fileUrl,
    status: 'uploaded',
  });

  res.status(201).json(sheet);
});

// ─── GRADING ─────────────────────────────────────────────────────────────────

// POST /api/exams/:id/grade/:sheetId — Run OCR + AI grading on a sheet
router.post('/:id/grade/:sheetId', protect, async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const sheet = await StudentSheet.findOne({ _id: req.params.sheetId, exam: exam._id });
  if (!sheet) return res.status(404).json({ message: 'Sheet not found' });

  if (exam.questions.length === 0)
    return res.status(400).json({ message: 'No questions found for this exam' });

  try {
    // Step 1: OCR
    const filePath = sheet.fileUrl
      ? require('path').join(__dirname, '..', sheet.fileUrl)
      : null;
    const ocrText = await extractText(filePath, exam.questions);
    sheet.ocrText = ocrText;
    sheet.status = 'ocr_done';
    await sheet.save();

    // Step 2: AI Grading
    const gradingResults = await gradeSheet(exam.questions, ocrText);
    const totalMarks = gradingResults.reduce((sum, r) => sum + r.marksAwarded, 0);
    const maxTotalMarks = gradingResults.reduce((sum, r) => sum + r.maxMarks, 0);

    // Step 3: Generate PDF
    const { fileName } = await generatePDF({
      studentName: sheet.studentName,
      rollNumber: sheet.rollNumber,
      examTitle: exam.title,
      subject: exam.subject,
      gradingResults,
      totalMarks,
      maxTotalMarks,
    });

    sheet.gradingResults = gradingResults;
    sheet.totalMarks = totalMarks;
    sheet.maxTotalMarks = maxTotalMarks;
    sheet.pdfUrl = `/uploads/${fileName}`;
    sheet.status = 'graded';
    await sheet.save();

    res.json(sheet);
  } catch (err) {
    sheet.status = 'error';
    await sheet.save();
    throw err;
  }
});

// GET /api/exams/:id/results — All students graded for an exam
router.get('/:id/results', protect, async (req, res) => {
  const exam = await Exam.findOne({ _id: req.params.id, teacher: req.user._id });
  if (!exam) return res.status(404).json({ message: 'Exam not found' });

  const sheets = await StudentSheet.find({ exam: exam._id }).sort({ createdAt: -1 });
  res.json({ exam, sheets });
});

module.exports = router;
