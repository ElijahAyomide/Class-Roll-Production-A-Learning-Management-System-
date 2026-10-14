import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
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
// The TIMER lives on the server too: one clock for the whole sitting.
// Shape of `answers` everywhere on this page: { [subjectId]: { [questionId]: 0-3 } }
const backupKey = (id) => `classroll-answers-${id}`;
function loadBackup(id) {
  try { return JSON.parse(localStorage.getItem(backupKey(id)) || '{}'); } catch { return {}; }
}
function saveBackup(id, answers) {
  try { localStorage.setItem(backupKey(id), JSON.stringify(answers)); } catch { /* not critical */ }
}
function clearBackup(id) {
  try { localStorage.removeItem(backupKey(id)); } catch { /* not critical */ }
}

export default function StudentExam() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();

  const [subjects, setSubjects] = useState([]);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  const [activeId, setActiveId] = useState(null);          // which subject tab is open
  const [positions, setPositions] = useState({});           // current question index per subject
  const [answers, setAnswers] = useState({});
  const [deadline, setDeadline] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const loadedRef = useRef(false);
  const answersRef = useRef({});
  answersRef.current = answers;
  const submittedRef = useRef(false);
  submittedRef.current = submitted || submitting;

  const sessionExpired = () => { setStudentToken(null); navigate('/login'); };

  // Start (or resume) the whole sitting. The server returns every subject's
  // questions WITHOUT answers, the answers saved so far, and the seconds left.
  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }
    let cancelled = false;
    setSetupLoading(true);
    setSetupError('');

    studentApi.startSitting(studentToken, groupId)
      .then((d) => {
        if (cancelled) return;
        setSubjects(d.subjects);
        setActiveId(d.subjects[0].id);
        // What the server saved, plus anything newer kept in this browser.
        const backup = loadBackup(groupId);
        const merged = {};
        for (const s of d.subjects) merged[s.id] = { ...(s.answers || {}), ...(backup[s.id] || {}) };
        setAnswers(merged);
        loadedRef.current = true;
        setDeadline(Date.now() + d.secondsLeft * 1000);
        setSecondsLeft(d.secondsLeft);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) { sessionExpired(); return; }
        if (err.status === 409) { navigate('/student'); return; }
        setSetupError(err.message || 'Could not load this exam.');
      })
      .finally(() => { if (!cancelled) setSetupLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken, groupId]);

  const chooseAnswer = (subjectId, questionId, optionIndex) => {
    setAnswers(prev => {
      const next = { ...prev, [subjectId]: { ...(prev[subjectId] || {}), [questionId]: optionIndex } };
      saveBackup(groupId, next);
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
      await studentApi.saveAnswers(studentToken, groupId, answersRef.current);
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
  }, [studentToken, groupId]);

  // One Submit for every subject. The server does the grading.
  // auto = true when the time ran out: the student isn't told, they are simply
  // taken straight to their home page, where they can choose to review or sign out.
  const doSubmit = async (auto = false) => {
    if (submittedRef.current || !subjects.length) return;
    submittedRef.current = true; // block a second call before the screen re-renders
    setSubmitting(true);
    setSubmitError('');
    try {
      await studentApi.submitSitting(studentToken, groupId, answers);
      clearBackup(groupId);
      if (auto) { navigate('/student', { replace: true }); return; }
      setSubmitted(true);
    } catch (err) {
      if (err.status === 401) { sessionExpired(); return; }
      if (err.status === 409) { // already submitted (e.g. the server closed it when time ran out)
        clearBackup(groupId);
        if (auto) { navigate('/student', { replace: true }); return; }
        setSubmitted(true);
        return;
      }
      if (auto) return; // quiet: the retry below will try again in a few seconds
      setSubmitError(err.message || "Something went wrong submitting. Don't worry — your answers are still here. Try submitting again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown, based on the real deadline. Auto-submits at zero.
  useEffect(() => {
    if (submitted || setupLoading || !subjects.length || deadline === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline, submitted, setupLoading, subjects.length]);

  // Time is up: submit automatically, and keep trying every few seconds if the
  // connection is bad, until it goes through.
  useEffect(() => {
    if (submitted || setupLoading || !subjects.length || deadline === null || secondsLeft > 0) return;
    doSubmit(true);
    const t = setInterval(() => doSubmit(true), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft <= 0, submitted, setupLoading, subjects.length]);

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
          <button className="btn-primary" onClick={() => navigate('/student')}>Back</button>
        </div>
      </div>
    );
  }

  if (!subjects.length) return null;

  if (submitted) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-icon"><CheckCircle2 size={28} /></div>
          <div className="exam-result-title">Submitted Successfully</div>
          <div className="exam-result-subject">{subjects.map(s => s.subject).join(' · ')}</div>
          <div className="exam-result-detail">
            Your answers have been recorded and can't be changed. You can look back at them until you sign out. Your school will share your result with you.
          </div>
          <button className="btn-primary" onClick={() => navigate('/student')}>Continue</button>
        </div>
      </div>
    );
  }

  const active = subjects.find(s => s.id === activeId) || subjects[0];
  const idx = positions[active.id] || 0;
  const q = active.questions[idx];
  const activeAnswers = answers[active.id] || {};
  const lowTime = secondsLeft <= 180;   // last 3 minutes
  const countFor = (s) => Object.keys(answers[s.id] || {}).length;
  const unanswered = subjects.reduce((n, s) => n + (s.questions.length - countFor(s)), 0);
  const setPos = (i) => setPositions(p => ({ ...p, [active.id]: i }));
  const activeIndex = subjects.findIndex(s => s.id === active.id);
  const nextSubject = subjects[activeIndex + 1];

  return (
    <div className="exam-screen">
      <div className="exam-header">
        <div>
          <div className="exam-header-subject">{subjects[0].type === 'exam' ? 'Exam' : 'Test'} · {subjects.length} subject{subjects.length === 1 ? '' : 's'}</div>
          <div className="exam-header-title">{active.subject} — {active.title}</div>
        </div>
        <div className="exam-header-actions">
          <div className={`exam-timer ${lowTime ? 'exam-timer-low' : ''}`} title="Total time left for all your subjects">
            <Clock size={15} /> {formatTime(secondsLeft)}
          </div>
          {lowTime && secondsLeft > 0 && (
            <div className="exam-time-alert" role="alert">
              <AlertTriangle size={14} /> Less than 3 minutes left!
            </div>
          )}
          <button className="exam-submit-btn" disabled={submitting} onClick={() => setConfirmingSubmit(true)}>
            Submit All
          </button>
        </div>
      </div>

      <div className="exam-body">
        {submitError && <div className="error-text" style={{ marginBottom: 16 }}>{submitError}</div>}

        <div className="subject-tabs" role="tablist">
          {subjects.map(s => (
            <button
              key={s.id} role="tab" aria-selected={s.id === active.id}
              className={`subject-tab ${s.id === active.id ? 'subject-tab-active' : ''}`}
              onClick={() => setActiveId(s.id)}
            >
              {s.subject}
              <span className="subject-tab-count">{countFor(s)}/{s.questions.length}</span>
            </button>
          ))}
        </div>

        <div className="exam-nav-grid">
          {active.questions.map((eq, i) => (
            <button
              key={eq.id}
              className={`exam-nav-dot ${i === idx ? 'exam-nav-dot-current' : ''} ${activeAnswers[eq.id] !== undefined ? 'exam-nav-dot-answered' : ''}`}
              onClick={() => setPos(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="exam-question-card">
          <div className="exam-question-count">Question {idx + 1} of {active.questions.length}</div>
          <div className="exam-question-text">{q.text}</div>
          <div className="exam-options">
            {q.options.map((opt, i) => (
              <label key={i} className={`exam-option ${activeAnswers[q.id] === i ? 'exam-option-selected' : ''}`}>
                <input
                  type="radio" name={`q-${active.id}-${q.id}`} checked={activeAnswers[q.id] === i}
                  onChange={() => chooseAnswer(active.id, q.id, i)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="exam-footer">
          <button className="btn-ghost" disabled={idx === 0} onClick={() => setPos(idx - 1)}>
            <ArrowLeft size={14} /> Previous
          </button>
          <span className="exam-progress-text">{countFor(active)} of {active.questions.length} answered</span>
          {idx < active.questions.length - 1 ? (
            <button className="btn-primary" onClick={() => setPos(idx + 1)}>Next <ArrowRight size={14} /></button>
          ) : nextSubject ? (
            <button className="btn-primary" onClick={() => setActiveId(nextSubject.id)}>Next subject <ArrowRight size={14} /></button>
          ) : (
            <button className="btn-primary" onClick={() => setConfirmingSubmit(true)}>Review &amp; Submit</button>
          )}
        </div>
      </div>

      {confirmingSubmit && (
        <Modal title="Submit all subjects?" onClose={() => setConfirmingSubmit(false)} width={420}>
          <div className="submit-summary">
            {subjects.map(s => (
              <div key={s.id} className="submit-summary-row">
                <span>{s.subject}</span>
                <b className={countFor(s) < s.questions.length ? 'submit-summary-warn' : ''}>{countFor(s)} of {s.questions.length} answered</b>
              </div>
            ))}
          </div>
          <p className="confirm-text">
            {unanswered > 0 ? `${unanswered} unanswered question${unanswered === 1 ? '' : 's'} will be marked wrong. ` : ''}
            After you submit you can only look back at your answers, not change them.
          </p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmingSubmit(false)}>Keep Working</button>
            <button className="btn-primary" onClick={() => { setConfirmingSubmit(false); doSubmit(); }}>Submit All</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
