import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { Download, Upload, ChevronDown, ChevronUp, Zap, RefreshCw } from 'lucide-react';

export default function ResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [regrading, setRegrading] = useState(null);

  const fetchResults = () => {
    setLoading(true);
    api.get(`/exams/${id}/results`)
      .then(({ data }) => setData(data))
      .catch(() => toast.error('Failed to load results'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchResults(); }, [id]);

  const regrade = async (sheetId) => {
    setRegrading(sheetId);
    try {
      await api.post(`/exams/${id}/grade/${sheetId}`);
      toast.success('Regraded!');
      fetchResults();
    } catch {
      toast.error('Regrade failed');
    } finally {
      setRegrading(null);
    }
  };

  const downloadPdf = (sheet) => {
    if (!sheet.pdfUrl) return toast.error('No PDF yet — grade first');
    window.open(sheet.pdfUrl, '_blank');
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return null;

  const { exam, sheets } = data;
  const graded = sheets.filter(s => s.status === 'graded');
  const avgScore = graded.length
    ? Math.round(graded.reduce((s, r) => s + (r.totalMarks / r.maxTotalMarks * 100), 0) / graded.length)
    : 0;
  const topScore = graded.length ? Math.max(...graded.map(s => s.totalMarks)) : 0;

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{exam.subject}</div>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>{exam.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            {exam.questions?.length} questions &middot; {exam.totalMarks} total marks
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={fetchResults} className="btn btn-secondary btn-sm"><RefreshCw size={14} /></button>
          <Link to={`/exams/${id}/upload`} className="btn btn-primary"><Upload size={16} /> Upload Sheet</Link>
        </div>
      </div>

      {/* Stats */}
      {graded.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
          {[
            { label: 'Students', value: sheets.length },
            { label: 'Graded', value: graded.length, color: 'var(--success)' },
            { label: 'Avg Score', value: `${avgScore}%`, color: avgScore >= 70 ? 'var(--success)' : avgScore >= 40 ? 'var(--yellow)' : 'var(--red)' },
            { label: 'Top Score', value: `${topScore}/${exam.totalMarks}`, color: 'var(--accent)' },
          ].map((s) => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color || 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {sheets.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>No student sheets uploaded yet.</p>
          <Link to={`/exams/${id}/upload`} className="btn btn-primary"><Upload size={16} /> Upload First Sheet</Link>
        </div>
      ) : (
        <div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll No</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => (
                  <>
                    <tr key={sheet._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0
                          }}>{sheet.studentName.charAt(0)}</div>
                          <span style={{ fontWeight: 500 }}>{sheet.studentName}</span>
                        </div>
                      </td>
                      <td><span className="mono" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sheet.rollNumber}</span></td>
                      <td><span className={`badge badge-${sheet.status}`}>{sheet.status.replace('_', ' ')}</span></td>
                      <td>
                        {sheet.status === 'graded'
                          ? <strong style={{ color: sheet.totalMarks / sheet.maxTotalMarks >= 0.7 ? 'var(--success)' : sheet.totalMarks / sheet.maxTotalMarks >= 0.4 ? 'var(--yellow)' : 'var(--red)' }}>
                              {sheet.totalMarks} / {sheet.maxTotalMarks}
                            </strong>
                          : <span style={{ color: 'var(--text-dim)' }}>—</span>
                        }
                      </td>
                      <td>
                        {sheet.status === 'graded'
                          ? `${Math.round((sheet.totalMarks / sheet.maxTotalMarks) * 100)}%`
                          : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {sheet.status !== 'graded' && (
                            <button onClick={() => regrade(sheet._id)} className="btn btn-primary btn-sm"
                              disabled={regrading === sheet._id}>
                              {regrading === sheet._id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Zap size={12} />}
                              {regrading === sheet._id ? 'Grading...' : 'Grade'}
                            </button>
                          )}
                          {sheet.status === 'graded' && (
                            <>
                              <button onClick={() => setExpanded(expanded === sheet._id ? null : sheet._id)}
                                className="btn btn-secondary btn-sm">
                                {expanded === sheet._id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                Details
                              </button>
                              <button onClick={() => downloadPdf(sheet)} className="btn btn-success btn-sm">
                                <Download size={12} /> PDF
                              </button>
                              <button onClick={() => regrade(sheet._id)} className="btn btn-secondary btn-sm"
                                disabled={regrading === sheet._id} title="Re-grade">
                                <RefreshCw size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded question breakdown */}
                    {expanded === sheet._id && sheet.gradingResults?.length > 0 && (
                      <tr key={`${sheet._id}-expanded`}>
                        <td colSpan={6} style={{ padding: 0, background: 'var(--bg-card2)' }}>
                          <div style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.5px' }}>QUESTION BREAKDOWN</div>
                            <div style={{ display: 'grid', gap: 10 }}>
                              {sheet.gradingResults.map((r) => (
                                <div key={r.questionNumber} style={{
                                  display: 'flex', gap: 14, padding: '12px 16px',
                                  background: 'var(--bg-card)', borderRadius: 8,
                                  border: '1px solid var(--border)', alignItems: 'flex-start'
                                }}>
                                  <div style={{
                                    padding: '2px 10px', borderRadius: 6, background: 'var(--accent-glow)',
                                    color: 'var(--accent)', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2
                                  }}>Q{r.questionNumber}</div>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{r.questionText}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>💬 {r.feedback}</div>
                                  </div>
                                  <div style={{
                                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                                    color: r.marksAwarded === r.maxMarks ? 'var(--success)' : r.marksAwarded === 0 ? 'var(--red)' : 'var(--yellow)'
                                  }}>{r.marksAwarded}/{r.maxMarks}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
