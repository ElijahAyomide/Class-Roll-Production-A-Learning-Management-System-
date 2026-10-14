import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, PlayCircle, CheckCircle, Eye } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import Modal from '../../components/Modal';
import { studentApi } from '../../lib/studentApi';
import { formatTime } from './StudentExam';

// This page shows what a student can act on, plus the subjects they have
// already submitted (so they can look back at their answers before signing
// out). Scores are never shown: results are admin-only.
//
// Subjects the school set together are one "sitting" with ONE total time,
// shown here as a single countdown for the group.
export default function StudentHome() {
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [loadedAt, setLoadedAt] = useState(Date.now());

  const load = () => studentApi.home(studentToken).then((d) => { setData(d); setLoadedAt(Date.now()); return d; });

  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }
    let cancelled = false;
    setLoading(true);
    load()
      .catch((err) => {
        console.error('Failed to load student data:', err.message);
        if (cancelled) return;
        setStudentToken(null);
        navigate('/login');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentToken]);

  // Tick once a second so running countdowns move.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When a sitting's time reaches zero, ask the server to close it (it
  // submits whatever is left) and refresh the list.
  const anyExpired = data && Object.values(data.groups).some(g => g.started && secondsLeftFor(g, loadedAt, now) <= 0);
  useEffect(() => {
    if (!anyExpired) return;
    const t = setTimeout(() => { load().catch(() => {}); }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyExpired, loadedAt]);

  if (loading || !data) return null;

  const { student, schoolName, assignments, groups, pauseMinutes } = data;
  const todo = assignments.filter(a => a.status === 'todo');
  const done = assignments.filter(a => a.status === 'done');
  const inProgress = Object.values(groups).some(g => g.started);

  const signOut = () => {
    // Tell the server to end this session (and pause any running timer),
    // then clear it locally.
    studentApi.logout(studentToken).catch(() => {});
    setStudentToken(null);
    navigate('/login');
  };

  const groupIds = [...new Set(todo.map(a => a.groupId))];

  return (
    <div className="student-portal">
      <header className="student-topbar">
        <div>
          <div className="student-topbar-brand">{schoolName}</div>
          <div className="student-topbar-name">{student.name} · {student.class}</div>
        </div>
        <button className="btn-signout" onClick={() => setConfirmingSignOut(true)}><LogOut size={14} /> Sign Out</button>
      </header>

      <div className="student-page-content">
        {groupIds.length === 0 ? (
          <>
            <div className="student-section-title">Ready to take</div>
            <div className="student-empty-card">
              <CheckCircle size={20} />
              <span>You're all caught up — nothing left to take right now. You can check your answers below, then sign out.</span>
            </div>
          </>
        ) : groupIds.map(gid => {
          const g = groups[gid];
          const subjects = todo.filter(a => a.groupId === gid);
          const left = secondsLeftFor(g, loadedAt, now);
          return (
            <div key={gid} className="student-sitting">
              <div className="student-section-title">Ready to take</div>
              <div className={`student-timer-banner ${g.started && left <= 300 ? 'student-timer-banner-low' : ''}`}>
                <Clock size={15} />
                {g.started ? (
                  <span>Time left for all subjects: <b>{formatTime(left)}</b></span>
                ) : (
                  <span>Total time for {subjects.length === 1 ? 'this subject' : `all ${subjects.length} subjects`}: <b>{g.totalMinutes} minutes</b>. The clock starts when you open your first subject.</span>
                )}
              </div>
              <div className="sitting-card">
                <div className="field-hint" style={{ marginBottom: 8 }}>
                  {subjects[0].type === 'exam' ? 'EXAM' : 'TEST'} · {subjects.length} SUBJECT{subjects.length === 1 ? '' : 'S'}
                </div>
                <div className="sitting-subjects">
                  {subjects.map(a => <span key={a.id} className="sitting-subject-chip">{a.subject}</span>)}
                </div>
                <button className="btn-primary sitting-start" disabled={g.started && left <= 0} onClick={() => navigate(`/student/exam/${gid}`)}>
                  <PlayCircle size={16} /> {g.started ? 'Continue' : `Start ${subjects.length === 1 ? '' : 'All Subjects'}`.trim()}
                </button>
                {subjects.length > 1 && <div className="field-hint" style={{ marginTop: 8 }}>You can switch between subjects with tabs and check your work before you submit everything at once.</div>}
              </div>
            </div>
          );
        })}

        {done.length > 0 && (
          <div className="student-sitting">
            <div className="student-section-title">Submitted</div>
            <div className="sitting-card">
              <div className="sitting-subjects">
                {done.map(a => <span key={a.id} className="sitting-subject-chip"><CheckCircle size={12} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--green)' }} />{a.subject}</span>)}
              </div>
              <button className="btn-ghost sitting-start" onClick={() => navigate('/student/review')}>
                <Eye size={15} /> Review my answers
              </button>
              <div className="field-hint" style={{ marginTop: 8 }}>You can look back at your answers until you sign out. After that you can't sign in again until your school sets a new test or exam.</div>
            </div>
          </div>
        )}
      </div>

      {confirmingSignOut && (
        <Modal title="Sign out?" onClose={() => setConfirmingSignOut(false)} width={400}>
          <p className="confirm-text">
            Are you sure you want to sign out?
            {done.length > 0 && todo.length === 0 && (
              <> You won't be able to sign in again, or look at your answers, until your school sets a new test or exam.</>
            )}
            {todo.length > 0 && (
              <>
                {' '}You still have {todo.length} subject{todo.length === 1 ? '' : 's'} left to submit.
                {inProgress
                  ? ` Your answers so far are saved, and your timer is paused for up to ${pauseMinutes} minutes while you are away. Sign back in to continue.`
                  : ' You can sign back in to take it later.'}
              </>
            )}
          </p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmingSignOut(false)}>No, stay signed in</button>
            <button className="btn-danger" onClick={signOut}>Yes, sign out</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Time left, counted down locally from what the server last told us.
function secondsLeftFor(group, loadedAt, now) {
  if (!group.started) return group.totalMinutes * 60;
  return Math.max(0, group.secondsLeft - Math.floor((now - loadedAt) / 1000));
}
