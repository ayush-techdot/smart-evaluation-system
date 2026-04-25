import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle } from 'lucide-react';

const emptyQuestion = () => ({ questionNumber: 1, questionText: '', maxMarks: 5, modelAnswer: '' });

export default function CreateExam() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = exam details, 2 = questions
  const [loading, setLoading] = useState(false);
  const [exam, setExam] = useState({ title: '', subject: '', totalMarks: '' });
  const [questions, setQuestions] = useState([{ ...emptyQuestion() }]);

  const handleExam = (e) => setExam({ ...exam, [e.target.name]: e.target.value });

  const addQuestion = () => {
    setQuestions([...questions, { ...emptyQuestion(), questionNumber: questions.length + 1 }]);
  };

  const removeQuestion = (idx) => {
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNumber: i + 1 }));
    setQuestions(updated);
  };

  const handleQ = (idx, field, value) => {
    const updated = [...questions];
    updated[idx][field] = field === 'maxMarks' ? Number(value) : value;
    setQuestions(updated);
  };

  const submitStep1 = (e) => {
    e.preventDefault();
    if (!exam.title || !exam.subject || !exam.totalMarks) return toast.error('Fill all fields');
    setStep(2);
  };

  const submitFinal = async (e) => {
    e.preventDefault();
    const invalid = questions.find(q => !q.questionText || !q.modelAnswer || !q.maxMarks);
    if (invalid) return toast.error('Fill all question fields');

    setLoading(true);
    try {
      const { data } = await api.post('/exams', {
        ...exam,
        totalMarks: Number(exam.totalMarks),
        questions,
      });
      toast.success('Exam created!');
      navigate(`/exams/${data._id}/upload`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create exam');
    } finally {
      setLoading(false);
    }
  };

  const totalQMarks = questions.reduce((s, q) => s + Number(q.maxMarks || 0), 0);

  return (
    <div className="page-container fade-in" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700 }}>Create New Exam</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Set up your exam details and add questions with model answers</p>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
        {[{ n: 1, label: 'Exam Details' }, { n: 2, label: 'Questions' }].map((s, i) => (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: step >= s.n ? 'var(--accent)' : 'var(--bg-card2)',
                border: `2px solid ${step >= s.n ? 'var(--accent)' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: step >= s.n ? 'white' : 'var(--text-dim)',
                transition: 'all 0.3s',
              }}>
                {step > s.n ? <CheckCircle size={16} /> : s.n}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: step >= s.n ? 'var(--text)' : 'var(--text-dim)' }}>{s.label}</span>
            </div>
            {i === 0 && <div style={{ width: 60, height: 2, background: step > 1 ? 'var(--accent)' : 'var(--border)', margin: '0 12px', transition: 'all 0.3s' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Exam Details */}
      {step === 1 && (
        <div className="card fade-in">
          <form onSubmit={submitStep1}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Exam Title</label>
                <input className="form-input" name="title" placeholder="Mid-Term Physics"
                  value={exam.title} onChange={handleExam} required />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Subject</label>
                <input className="form-input" name="subject" placeholder="Physics"
                  value={exam.subject} onChange={handleExam} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Total Marks</label>
              <input className="form-input" name="totalMarks" type="number" placeholder="50"
                value={exam.totalMarks} onChange={handleExam} required min={1} style={{ maxWidth: 200 }} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
              Next: Add Questions <ArrowRight size={16} />
            </button>
          </form>
        </div>
      )}

      {/* Step 2: Questions */}
      {step === 2 && (
        <form onSubmit={submitFinal} className="fade-in">
          {/* Marks summary */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px', background: 'var(--bg-card2)', borderRadius: 8,
            border: `1px solid ${totalQMarks === Number(exam.totalMarks) ? 'var(--success)' : 'var(--border)'}`,
            marginBottom: 20,
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Question marks total: <strong style={{ color: 'var(--text)' }}>{totalQMarks}</strong></span>
            <span style={{ fontSize: 13, color: totalQMarks === Number(exam.totalMarks) ? 'var(--success)' : 'var(--yellow)' }}>
              {totalQMarks === Number(exam.totalMarks) ? '✓ Matches total marks' : `Target: ${exam.totalMarks}`}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((q, idx) => (
              <div key={idx} className="card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Question {idx + 1}</h3>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(idx)} className="btn btn-danger btn-sm">
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Question Text</label>
                    <input className="form-input" placeholder="State Newton's First Law of Motion"
                      value={q.questionText} onChange={e => handleQ(idx, 'questionText', e.target.value)} required />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 100 }}>
                    <label className="form-label">Max Marks</label>
                    <input className="form-input" type="number" min={1}
                      value={q.maxMarks} onChange={e => handleQ(idx, 'maxMarks', e.target.value)} required />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Model Answer</label>
                  <textarea className="form-textarea"
                    placeholder="Newton's First Law states that an object at rest stays at rest, and an object in motion stays in motion, unless acted upon by an external force..."
                    value={q.modelAnswer} onChange={e => handleQ(idx, 'modelAnswer', e.target.value)} required />
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary">
              <ArrowLeft size={16} /> Back
            </button>
            <button type="button" onClick={addQuestion} className="btn btn-secondary">
              <Plus size={16} /> Add Question
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginLeft: 'auto' }}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</> : <>Create Exam <CheckCircle size={16} /></>}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
