import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowLeft, ArrowRight, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import Modal from '../../components/Modal';
import { studentApi } from '../../lib/studentApi';
import { migrateKey } from '../../lib/legacyStorage';

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
const backupKey = (id) => `assessly-answers-${id}`;
function loadBackup(id) {
  migrateKey(`classroll-answers-${id}`, backupKey(id));
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

  // After a submit there is no review page and no Continue button: if the
  // student has other subjects still to take they go straight to their home
  // page; if nothing is left they are signed out right away.
  const leaveAfterSubmit = async () => {
    try {
      const d = await studentApi.home(studentToken);
      if (!d.assignments.some(a => a.status === 'todo')) {
        studentApi.logout(studentToken).catch(() => {});
        setStudentToken(null);
        navigate('/login', { replace: true });
        return;
      }
    } catch (err) {
      if (err.status === 401) { sessionExpired(); return; }
    }
    navigate('/student', { replace: true });
  };

  // One Submit for every subject. The server does the grading.
  // auto = true when the time ran out: the student isn't told, they are simply
  // moved on (see leaveAfterSubmit).
  const doSubmit = async (auto = false) => {
    if (submittedRef.current || !subjects.length) return;
    submittedRef.current = true; // block a second call before the screen re-renders
    setSubmitting(true);
    setSubmitError('');
    try {
      await studentApi.submitSitting(studentToken, groupId, answers);
      clearBackup(groupId);
      setSubmitted(true);
      leaveAfterSubmit();
      return;
    } catch (err) {
      if (err.status === 401) { sessionExpired(); return; }
      if (err.status === 409) { // already submitted (e.g. the server closed it when time ran out)
        clearBackup(groupId);
        setSubmitted(true);
        leaveAfterSubmit();
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
      <div className="sp-exam-screen sp-exam-center">
        <div className="sp-result-card">
          <div className="sp-result-detail">Loading your exam…</div>
        </div>
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="sp-exam-screen sp-exam-center">
        <div className="sp-result-card">
          <div className="sp-result-icon sp-result-icon-bad"><AlertTriangle size={26} /></div>
          <div className="sp-result-title">Couldn't load this exam</div>
          <div className="sp-result-detail">{setupError}</div>
          <button className="sp-btn-primary" onClick={() => navigate('/student')}>Back to my tests</button>
        </div>
      </div>
    );
  }

  if (!subjects.length) return null;

  if (submitted) {
    // Shown for a moment while the student is moved on automatically.
    return (
      <div className="sp-exam-screen sp-exam-center">
        <div className="sp-result-card">
          <div className="sp-result-icon"><CheckCircle2 size={28} /></div>
          <div className="sp-result-title">Submitted successfully</div>
          <div className="sp-result-detail">{subjects.map(s => s.subject).join(' · ')}</div>
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
  const answeredHere = countFor(active);
  const pct = Math.round((answeredHere / active.questions.length) * 100);

  return (
    <div className="sp-exam-screen">
      <div className="sp-exam-sticky">
      <header className="sp-exam-header">
        <div className="sp-exam-header-main">
          <div className="sp-exam-header-icon"><ClipboardCheck size={20} /></div>
          <div className="sp-exam-header-text">
            <div className="sp-eyebrow">Test · {subjects.length} subject{subjects.length === 1 ? '' : 's'}</div>
            <h1 className="sp-exam-title">{active.subject} — {active.title}</h1>
          </div>
        </div>
        <div className="sp-exam-actions">
          <div className={`sp-timer ${lowTime ? 'sp-timer-low' : ''}`} title="Total time left for all your subjects">
            <Clock size={16} /> {formatTime(secondsLeft)}
          </div>
          <button className="sp-btn-primary sp-btn-compact" disabled={submitting} onClick={() => setConfirmingSubmit(true)}>
            Submit all
          </button>
        </div>
      </header>

      {lowTime && secondsLeft > 0 && (
        <div className="sp-exam-alert" role="alert">
          <AlertTriangle size={16} /> Less than 3 minutes left!
        </div>
      )}
      </div>
      {submitError && <div className="sp-exam-error">{submitError}</div>}

      <div className="sp-exam-grid">
        <div className="sp-exam-main">
          <div className="sp-tabs" role="tablist">
            {subjects.map(s => (
              <button
                key={s.id} role="tab" aria-selected={s.id === active.id}
                className={`sp-tab ${s.id === active.id ? 'sp-tab-active' : ''}`}
                onClick={() => setActiveId(s.id)}
              >
                {s.subject}
                <span className="sp-tab-count">{countFor(s)}/{s.questions.length}</span>
              </button>
            ))}
          </div>

          <section className="sp-card sp-question-card">
            <div className="sp-question-count">Question {idx + 1} of {active.questions.length}</div>
            <div className="sp-question-text">{q.text}</div>
            <div className="sp-options">
              {q.options.map((opt, i) => (
                <label key={i} className={`sp-option ${activeAnswers[q.id] === i ? 'sp-option-selected' : ''}`}>
                  <input
                    type="radio" name={`q-${active.id}-${q.id}`} checked={activeAnswers[q.id] === i}
                    onChange={() => chooseAnswer(active.id, q.id, i)}
                  />
                  <span className="sp-option-letter">{String.fromCharCode(65 + i)}</span>
                  <span className="sp-option-text">{opt}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="sp-exam-footer">
            <button className="sp-btn-ghost" disabled={idx === 0} onClick={() => setPos(idx - 1)}>
              <ArrowLeft size={15} /> Previous
            </button>
            <span className="sp-progress-text">{answeredHere} of {active.questions.length} answered</span>
            {idx < active.questions.length - 1 ? (
              <button className="sp-btn-primary sp-btn-compact" onClick={() => setPos(idx + 1)}>Next <ArrowRight size={15} /></button>
            ) : nextSubject ? (
              <button className="sp-btn-primary sp-btn-compact" onClick={() => setActiveId(nextSubject.id)}>Next subject <ArrowRight size={15} /></button>
            ) : (
              <button className="sp-btn-primary sp-btn-compact" onClick={() => setConfirmingSubmit(true)}>Review &amp; submit</button>
            )}
          </div>
        </div>

        <aside className="sp-exam-side">
          <div className="sp-side-title">Question navigator</div>
          <div className="sp-side-progress">
            <div className="sp-bar"><div className="sp-bar-fill" style={{ width: `${pct}%` }} /></div>
            <div className="sp-side-progress-text">{answeredHere} of {active.questions.length} answered</div>
          </div>
          <div className="sp-nav-grid">
            {active.questions.map((eq, i) => (
              <button
                key={eq.id}
                className={`sp-dot ${i === idx ? 'sp-dot-current' : ''} ${activeAnswers[eq.id] !== undefined ? 'sp-dot-answered' : ''}`}
                onClick={() => setPos(i)}
                aria-label={`Question ${i + 1}${activeAnswers[eq.id] !== undefined ? ', answered' : ''}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className="sp-legend">
            <span><i className="sp-legend-dot sp-legend-current" /> Current</span>
            <span><i className="sp-legend-dot sp-legend-answered" /> Answered</span>
            <span><i className="sp-legend-dot" /> Not answered</span>
          </div>
        </aside>
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
            <button className="btn-ghost" onClick={() => setConfirmingSubmit(false)}>Keep working</button>
            <button className="btn-primary" onClick={() => { setConfirmingSubmit(false); doSubmit(); }}>Submit all</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
