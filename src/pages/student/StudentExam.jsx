import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import Modal from '../../components/Modal';
import { studentApi } from '../../lib/studentApi';

export function formatTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// Answers are saved on the server as the student goes (so they survive a
// sign-out), with a copy in the browser as a backup for a bad connection.
// The TIMER lives on the server too, and is shared by all subjects of the sitting.
const answersKey = (id) => `classroll-answers-${id}`;
function loadSavedAnswers(id) {
  try { return JSON.parse(localStorage.getItem(answersKey(id)) || '{}'); } catch { return {}; }
}
function saveAnswers(id, answers) {
  try { localStorage.setItem(answersKey(id), JSON.stringify(answers)); } catch { /* not critical */ }
}
function clearAnswers(id) {
  try { localStorage.removeItem(answersKey(id)); } catch { /* not critical */ }
}

export default function StudentExam() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();

  const [assignment, setAssignment] = useState(null);
  const [title, setTitle] = useState('');
  const [examQuestions, setExamQuestions] = useState([]);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(null); // timestamp (ms) when time runs out
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const loadedRef = useRef(false);   // don't save before the exam has loaded
  const answersRef = useRef({});
  answersRef.current = answers;
  const submittedRef = useRef(false);
  submittedRef.current = submitted || submitting;

  const sessionExpired = () => { setStudentToken(null); navigate('/login'); };

  // Ask the server to start (or resume) the exam. The server returns the
  // questions WITHOUT answers, plus how many seconds are really left.
  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }

    let cancelled = false;
    setSetupLoading(true);
    setSetupError('');

    studentApi.startExam(studentToken, assignmentId)
      .then((d) => {
        if (cancelled) return;
        setAssignment(d.assignment);
        setTitle(d.title);
        setExamQuestions(d.questions);
        // What the server saved, plus anything newer kept in this browser.
        setAnswers({ ...(d.answers || {}), ...loadSavedAnswers(assignmentId) });
        loadedRef.current = true;
        setDeadline(Date.now() + d.secondsLeft * 1000);
        setSecondsLeft(d.secondsLeft);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) { sessionExpired(); return; }
        if (err.status === 409 || err.status === 404) { navigate('/student'); return; }
        setSetupError(err.message || 'Could not load this exam.');
      })
      .finally(() => { if (!cancelled) setSetupLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken, assignmentId]);

  const chooseAnswer = (questionId, optionIndex) => {
    setAnswers(prev => {
      const next = { ...prev, [questionId]: optionIndex };
      saveAnswers(assignmentId, next);
      return next;
    });
  };

  // Save to the server shortly after the student stops clicking, and again
  // every 20 seconds, so a sign-out or a lost connection never loses much.
  const lastSavedRef = useRef('');
  const pushSave = async () => {
    if (!loadedRef.current || submittedRef.current) return;
    const snapshot = JSON.stringify(answersRef.current);
    if (snapshot === lastSavedRef.current) return;
    try {
      await studentApi.saveAnswers(studentToken, assignmentId, answersRef.current);
      lastSavedRef.current = snapshot;
    } catch (err) {
      if (err.status === 409 && !submittedRef.current) navigate('/student'); // time is up / already submitted
      // other errors: keep going, the next save will retry
    }
  };
  useEffect(() => {
    if (!loadedRef.current) return;
    const t = setTimeout(pushSave, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);
  useEffect(() => {
    const t = setInterval(pushSave, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken, assignmentId, submitted]);

  // The server does the grading. We just send the answers.
  const doSubmit = async () => {
    if (submitted || submitting || !assignment) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await studentApi.submitExam(studentToken, assignment.id, answers);
      clearAnswers(assignmentId);
      setSubmitted(true);
    } catch (err) {
      if (err.status === 401) { sessionExpired(); return; }
      if (err.status === 409) { clearAnswers(assignmentId); setSubmitted(true); return; } // already submitted
      setSubmitError(err.message || "Something went wrong submitting your exam. Don't worry — your answers are still here. Try submitting again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown — based on the real deadline, so it stays accurate even if the
  // browser slows down a background tab. Auto-submits at zero.
  useEffect(() => {
    if (submitted || setupLoading || !assignment || deadline === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, submitted, setupLoading, assignment]);

  useEffect(() => {
    if (submitted || setupLoading || !assignment || deadline === null) return;
    if (secondsLeft <= 0 && !submitting && !submitError) doSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (setupLoading) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-detail">Loading your exam…</div>
        </div>
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-icon" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>!</div>
          <div className="exam-result-title">Couldn't load this exam</div>
          <div className="exam-result-detail">{setupError}</div>
          <button className="btn-primary" onClick={() => navigate('/student')}>Back to My Tests & Exams</button>
        </div>
      </div>
    );
  }

  if (!assignment) return null;

  const answeredCount = Object.keys(answers).length;
  const q = examQuestions[currentIndex];
  const lowTime = secondsLeft <= 60;

  if (submitted) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-icon"><CheckCircle2 size={28} /></div>
          <div className="exam-result-title">Submitted Successfully</div>
          <div className="exam-result-subject">{assignment.subject} · {title}</div>
          <div className="exam-result-detail">Your answers have been recorded. Your school will share your result with you.</div>
          <button className="btn-primary" onClick={() => navigate('/student')}>Continue</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-screen">
      <div className="exam-header">
        <div>
          <div className="exam-header-subject">{assignment.subject}</div>
          <div className="exam-header-title">{title}</div>
        </div>
        <div className="exam-header-actions">
          <div className={`exam-timer ${lowTime ? 'exam-timer-low' : ''}`} title="Total time left for all your subjects">
            <Clock size={15} /> {secondsLeft <= 0 ? 'Submitting…' : formatTime(secondsLeft)}
          </div>
          <button className="exam-submit-btn" disabled={submitting} onClick={() => setConfirmingSubmit(true)}>
            {submitting ? 'Submitting…' : 'Submit Exam'}
          </button>
        </div>
      </div>

      <div className="exam-body">
        {submitError && <div className="error-text" style={{ marginBottom: 16 }}>{submitError}</div>}

        <div className="exam-nav-grid">
          {examQuestions.map((eq, i) => (
            <button
              key={eq.id}
              className={`exam-nav-dot ${i === currentIndex ? 'exam-nav-dot-current' : ''} ${answers[eq.id] !== undefined ? 'exam-nav-dot-answered' : ''}`}
              onClick={() => setCurrentIndex(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="exam-question-card">
          <div className="exam-question-count">Question {currentIndex + 1} of {examQuestions.length}</div>
          <div className="exam-question-text">{q.text}</div>
          <div className="exam-options">
            {q.options.map((opt, i) => (
              <label key={i} className={`exam-option ${answers[q.id] === i ? 'exam-option-selected' : ''}`}>
                <input
                  type="radio" name={`q-${q.id}`} checked={answers[q.id] === i}
                  onChange={() => chooseAnswer(q.id, i)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="exam-footer">
          <button className="btn-ghost" disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)}>
            <ArrowLeft size={14} /> Previous
          </button>
          <span className="exam-progress-text">{answeredCount} of {examQuestions.length} answered</span>
          <button className="btn-primary" disabled={currentIndex === examQuestions.length - 1} onClick={() => setCurrentIndex(i => i + 1)}>
            Next <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {confirmingSubmit && (
        <Modal title="Submit exam?" onClose={() => setConfirmingSubmit(false)} width={380}>
          <p className="confirm-text">
            You've answered {answeredCount} of {examQuestions.length} questions.
            {answeredCount < examQuestions.length ? ' Unanswered questions will be marked wrong.' : ''} This can't be undone.
          </p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmingSubmit(false)}>Keep Working</button>
            <button className="btn-primary" onClick={() => { setConfirmingSubmit(false); doSubmit(); }}>Submit Exam</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
