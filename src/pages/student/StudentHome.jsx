import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, PlayCircle, CheckCircle } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import { studentApi } from '../../lib/studentApi';

// By design, this page shows ONLY what a student can act on right now —
// nothing scheduled for later, and no past or current results. Results are
// admin-only, visible on the Results page of the admin dashboard.
//
// This page doesn't read the database itself. It asks the secure
// "student-api" function, which works out who the student is from their
// token and returns only that student's own, currently available tests.
export default function StudentHome() {
  const navigate = useNavigate();
  const { studentToken, setStudentToken } = useStudentSession();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentToken) { navigate('/login'); return; }

    let cancelled = false;
    setLoading(true);
    studentApi.home(studentToken)
      .then((d) => { if (!cancelled) setData(d); })
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

  if (loading || !data) return null;

  const { student, schoolName, assignments: available } = data;

  const signOut = () => {
    // Tell the server to end this session too, then clear it locally.
    studentApi.logout(studentToken).catch(() => {});
    setStudentToken(null);
    navigate('/login');
  };

  return (
    <div className="student-portal">
      <header className="student-topbar">
        <div>
          <div className="student-topbar-brand">{schoolName}</div>
          <div className="student-topbar-name">{student.name} · {student.class}</div>
        </div>
        <button className="btn-ghost" onClick={signOut}><LogOut size={14} /> Sign Out</button>
      </header>

      <div className="student-page-content">
        <div className="student-section-title">Ready to take</div>
        {available.length === 0 ? (
          <div className="student-empty-card">
            <CheckCircle size={20} />
            <span>You're all caught up — nothing left to take right now. You can sign out.</span>
          </div>
        ) : (
          <div className="student-assignment-grid">
            {available.map(a => (
              <div key={a.id} className="student-assignment-card">
                <div className={`student-assignment-type student-assignment-type-${a.type}`}>{a.type === 'exam' ? 'Exam' : 'Test'}</div>
                <div className="student-assignment-subject">{a.subject}</div>
                <div className="student-assignment-meta">
                  <Clock size={12} /> {a.durationMinutes} minutes
                </div>
                <button className="btn-primary student-assignment-start" onClick={() => navigate(`/student/exam/${a.id}`)}>
                  <PlayCircle size={15} /> Start
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
