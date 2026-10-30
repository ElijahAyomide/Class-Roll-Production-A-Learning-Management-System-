import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, PlayCircle, BookOpen, ClipboardCheck } from 'lucide-react';
import StudentLayout, { initialsOf } from '../../components/StudentLayout';
import { useStudentSession } from '../../context/StudentSessionContext';
import Modal from '../../components/Modal';
import { studentApi } from '../../lib/studentApi';
import { formatTime } from './StudentExam';

// This page shows what a student can still take. Submitted subjects are not
// shown and cannot be reviewed. Scores are never shown: results are admin-only.
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
    const t = setTimeout(() => {
      // The server submits whatever was left; this page then shows the Submitted card.
      load().catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anyExpired, loadedAt]);

  // Nothing left to take (for example a sitting just ran out of time and was
  // submitted): sign the student out instead of showing an empty page.
  const nothingLeft = !!data && !data.assignments.some(a => a.status === 'todo');
  useEffect(() => {
    if (!nothingLeft) return;
    studentApi.logout(studentToken).catch(() => {});
    setStudentToken(null);
    navigate('/login', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nothingLeft]);

  if (loading || !data || nothingLeft) return null;

  const { student, schoolName, assignments, groups, pauseMinutes } = data;
  const todo = assignments.filter(a => a.status === 'todo');
  const inProgress = Object.values(groups).some(g => g.started);

  const signOut = () => {
    // Tell the server to end this session (and pause any running timer),
    // then clear it locally.
    studentApi.logout(studentToken).catch(() => {});
    setStudentToken(null);
    navigate('/login');
  };

  const groupIds = [...new Set(todo.map(a => a.groupId))];
  const totalMinutes = groupIds.reduce((n, gid) => n + (groups[gid]?.totalMinutes || 0), 0);
  const kind = 'Test';

  const rail = (
    <>
      <div className="sp-rail-profile">
        <div className="sp-rail-avatar">{initialsOf(student.name)}</div>
        <div className="sp-rail-name">{student.name}</div>
        <div className="sp-rail-role">{student.class} · {schoolName}</div>
      </div>
      <div>
        <div className="sp-rail-eyebrow">Before you start</div>
        <div className="sp-rail-title">A few quick tips</div>
        <ul className="sp-rail-steps">
          <li><span className="sp-rail-num">1</span><div><b>Find a quiet spot</b><span>Make sure your phone or computer is charged and the internet is steady.</span></div></li>
          <li><span className="sp-rail-num">2</span><div><b>One clock for everything</b><span>The timer starts when you open your first subject and covers all of them.</span></div></li>
          <li><span className="sp-rail-num">3</span><div><b>Answers save as you go</b><span>If you sign out, your answers are kept and you can continue.</span></div></li>
        </ul>
      </div>
    </>
  );

  return (
    <>
    <StudentLayout
      title="My tests"
      subtitle="Everything your school has set for you to take."
      student={student}
      schoolName={schoolName}
      onSignOut={() => setConfirmingSignOut(true)}
      rail={rail}
    >
      <div className="sp-stats">
        <div className="sp-stat">
          <div className="sp-stat-icon"><BookOpen size={17} /></div>
          <div><div className="sp-stat-value">{todo.length}</div><div className="sp-stat-label">Subject{todo.length === 1 ? '' : 's'} to take</div></div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-icon"><Clock size={17} /></div>
          <div><div className="sp-stat-value">{totalMinutes} min</div><div className="sp-stat-label">Total time</div></div>
        </div>
        <div className="sp-stat">
          <div className="sp-stat-icon"><ClipboardCheck size={17} /></div>
          <div><div className="sp-stat-value">{kind}</div><div className="sp-stat-label">{inProgress ? 'In progress' : 'Not started'}</div></div>
        </div>
      </div>

      {groupIds.map(gid => {
        const g = groups[gid];
        const subjects = todo.filter(a => a.groupId === gid);
        const left = secondsLeftFor(g, loadedAt, now);
        const low = g.started && left <= 180;
        return (
          <section key={gid} className="sp-card">
            <div className="sp-card-head">
              <div className="sp-card-title">
                Ready to take
                <span className="sp-pill">Test · {subjects.length} subject{subjects.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className={`sp-timer-note ${low ? 'sp-timer-note-low' : ''}`}>
              <Clock size={16} />
              {g.started ? (
                <span>Time left for all subjects: <b>{formatTime(left)}</b></span>
              ) : (
                <span>Total time for {subjects.length === 1 ? 'this subject' : `all ${subjects.length} subjects`}: <b>{g.totalMinutes} minutes</b>. The clock starts when you open your first subject.</span>
              )}
            </div>

            <div className="sp-subject-label">Subjects</div>
            <div className="sp-chips">
              {subjects.map(a => <span key={a.id} className="sp-chip">{a.subject}</span>)}
            </div>

            <button className="sp-btn-primary" disabled={g.started && left <= 0} onClick={() => navigate(`/student/exam/${gid}`)}>
              <PlayCircle size={17} /> {g.started ? 'Continue' : `Start ${subjects.length === 1 ? '' : 'all subjects'}`.trim()}
            </button>
            {subjects.length > 1 && <p className="sp-hint">You can switch between subjects with tabs and check your work before you submit everything at once.</p>}
          </section>
        );
      })}

    </StudentLayout>

      {confirmingSignOut && (
        <Modal title="Sign out?" onClose={() => setConfirmingSignOut(false)} width={400}>
          <p className="confirm-text">
            Are you sure you want to sign out?
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
    </>
  );
}

// Time left, counted down locally from what the server last told us.
function secondsLeftFor(group, loadedAt, now) {
  if (!group.started) return group.totalMinutes * 60;
  return Math.max(0, group.secondsLeft - Math.floor((now - loadedAt) / 1000));
}
