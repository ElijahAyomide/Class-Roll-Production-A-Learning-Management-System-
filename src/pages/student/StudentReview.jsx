import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import { studentApi } from '../../lib/studentApi';

// Read-only look at a subject the student has already submitted: their own
// answers only. It does not show the correct answers or any score.
export default function StudentReview() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }
    studentApi.review(studentToken, assignmentId)
      .then(setData)
      .catch((err) => {
        if (err.status === 401) { setStudentToken(null); navigate('/login'); return; }
        setError(err.message || 'Could not load your answers.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken, assignmentId]);

  if (error) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-title">Couldn't load this</div>
          <div className="exam-result-detail">{error}</div>
          <button className="btn-primary" onClick={() => navigate('/student')}>Back</button>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="exam-screen">
      <div className="exam-header">
        <div>
          <div className="exam-header-subject">{data.assignment.subject}</div>
          <div className="exam-header-title">{data.title} · your submitted answers</div>
        </div>
        <div className="exam-header-actions">
          <button className="btn-ghost" onClick={() => navigate('/student')}><ArrowLeft size={14} /> Back</button>
        </div>
      </div>
      <div className="exam-body">
        {data.questions.map((q, n) => {
          const chosen = data.answers[q.id];
          return (
            <div key={q.id} className="exam-question-card" style={{ marginBottom: 14 }}>
              <div className="exam-question-count">Question {n + 1} of {data.questions.length}</div>
              <div className="exam-question-text">{q.text}</div>
              <div className="exam-options">
                {q.options.map((opt, i) => (
                  <div key={i} className={`exam-option ${chosen === i ? 'exam-option-selected' : ''}`}>
                    <span className="review-letter">{'ABCD'[i]}</span> {opt}
                    {chosen === i && <span className="review-yours">Your answer</span>}
                  </div>
                ))}
              </div>
              {chosen === undefined && <div className="field-hint">You didn't answer this question.</div>}
            </div>
          );
        })}
        <button className="btn-primary" onClick={() => navigate('/student')}>Back to my subjects</button>
      </div>
    </div>
  );
}
