import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, CheckCircle2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import Modal from '../../components/Modal';
import { fetchStudentById } from '../../lib/students';
import { fetchAssignmentsForStudent, markAssignmentCompleted } from '../../lib/assignments';
import { fetchQuestionById } from '../../lib/questions';
import { fetchQuestionItems } from '../../lib/questionItems';
import { createResult } from '../../lib/results';
import { gradeFor } from '../../data/mockData';

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function StudentExam() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { currentStudentId } = useStudentSession();

  const [student, setStudent] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [questionSet, setQuestionSet] = useState(null);
  const [examQuestions, setExamQuestions] = useState([]);
  const [setupLoading, setSetupLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  // Everything this page needs is fetched fresh, independently — this
  // page doesn't rely on any admin session or pre-loaded data.
  useEffect(() => {
    if (!currentStudentId) { navigate('/login'); return; }

    let cancelled = false;
    setSetupLoading(true);
    setSetupError('');

    (async () => {
      try {
        const s = await fetchStudentById(currentStudentId);
        if (!s) { navigate('/login'); return; }

        const studentAssignments = await fetchAssignmentsForStudent(s.id);
        const a = studentAssignments.find(x => x.id === assignmentId);
        if (!a || a.completed) { navigate('/student'); return; }

        const qs = await fetchQuestionById(a.questionId);
        if (!qs) { navigate('/student'); return; }

        const items = await fetchQuestionItems(qs.id);
        if (items.length === 0) {
          if (!cancelled) setSetupError('No questions were found for this exam yet. Please contact your school admin.');
          return;
        }

        if (!cancelled) {
          setStudent(s);
          setAssignment(a);
          setQuestionSet(qs);
          setExamQuestions(items);
          setSecondsLeft(a.durationMinutes * 60);
        }
      } catch (err) {
        if (!cancelled) setSetupError(err.message || 'Could not load this exam.');
      } finally {
        if (!cancelled) setSetupLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId, assignmentId]);

  const doSubmit = async () => {
    if (submitted || submitting || !assignment || !student || !questionSet) return;
    setSubmitting(true);
    setSubmitError('');

    let correct = 0;
    examQuestions.forEach(q => { if (answers[q.id] === q.correctIndex) correct += 1; });
    const scorePct = examQuestions.length ? Math.round((correct / examQuestions.length) * 100) : 0;
    const grade = gradeFor(scorePct);

    try {
      await createResult(student.schoolId, student.id, {
        studentName: student.name, username: student.username, class: student.class,
        subject: assignment.subject, exam: questionSet.title,
        score: scorePct, total: 100, grade, date: new Date().toISOString().slice(0, 10), type: assignment.type,
      });
      await markAssignmentCompleted(assignment.id);

      // Note: score/grade are saved to the admin's results above, but
      // intentionally never shown to the student — results are admin-only.
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong submitting your exam. Don't worry — your answers are still here. Try submitting again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Countdown timer — auto-submits the moment time runs out. Waits for
  // setup to finish first, so it can't fire before the exam is visible.
  useEffect(() => {
    if (submitted || setupLoading || !assignment) return;
    if (secondsLeft <= 0) { doSubmit(); return; }
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted, setupLoading]);

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

  if (!assignment || !questionSet) return null;

  const answeredCount = Object.keys(answers).length;
  const q = examQuestions[currentIndex];
  const lowTime = secondsLeft <= 60;

  if (submitted) {
    return (
      <div className="exam-screen">
        <div className="exam-result-card">
          <div className="exam-result-icon"><CheckCircle2 size={28} /></div>
          <div className="exam-result-title">Submitted Successfully</div>
          <div className="exam-result-subject">{assignment.subject} · {questionSet.title}</div>
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
          <div className="exam-header-title">{questionSet.title}</div>
        </div>
        <div className="exam-header-actions">
          <div className={`exam-timer ${lowTime ? 'exam-timer-low' : ''}`}>
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
                  onChange={() => setAnswers(prev => ({ ...prev, [q.id]: i }))}
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
