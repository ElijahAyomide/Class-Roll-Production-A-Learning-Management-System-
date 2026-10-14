import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import { studentApi } from '../../lib/studentApi';

// Read-only look at everything the student has submitted, one tab per subject:
// their own answers only, no correct answers and no score. It is available
// only until they sign out.
export default function StudentReview() {
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();
  const [subjects, setSubjects] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }
    studentApi.review(studentToken)
      .then((d) => { setSubjects(d.subjects); setActiveId(d.subjects[0].id); })
      .catch((err) => {
        if (err.status === 401) { setStudentToken(null); navigate('/login'); return; }
        if (err.status === 404) { navigate('/student'); return; }
        setError(err.message || 'Could not load your answers.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken]);

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
  if (!subjects) return null;

  const active = subjects.find(s => s.id === activeId) || subjects[0];

  return (
    <div className="exam-screen">
      <div className="exam-header">
        <div>
          <div className="exam-header-subject">Reviewing your submitted answers</div>
          <div className="exam-header-title">{active.subject} — {active.title}</div>
        </div>
        <div className="exam-header-actions">
          <button className="btn-ghost" onClick={() => navigate('/student')}><ArrowLeft size={14} /> Back</button>
        </div>
      </div>
      <div className="exam-body">
        <div className="subject-tabs" role="tablist">
          {subjects.map(s => (
            <button key={s.id} role="tab" aria-selected={s.id === active.id}
              className={`subject-tab ${s.id === active.id ? 'subject-tab-active' : ''}`}
              onClick={() => setActiveId(s.id)}>
              {s.subject}
            </button>
          ))}
        </div>

        {active.questions.map((q, n) => {
          const chosen = active.answers[q.id];
          return (
            <div key={q.id} className="exam-question-card" style={{ marginBottom: 14 }}>
              <div className="exam-question-count">Question {n + 1} of {active.questions.length}</div>
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
        <button className="btn-primary" onClick={() => navigate('/student')}>Back to my page</button>
      </div>
    </div>
  );
}
