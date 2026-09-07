import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, PlayCircle, CheckCircle } from 'lucide-react';
import { useStudentSession } from '../../context/StudentSessionContext';
import { fetchStudentById } from '../../lib/students';
import { fetchAssignmentsForStudent } from '../../lib/assignments';
import { fetchSchoolById } from '../../lib/schools';

// By design, this page shows ONLY what a student can act on right now —
// nothing scheduled for later, and no past or current results. Results are
// admin-only, visible on the Results page of the admin dashboard.
//
// This page deliberately does NOT depend on the admin's SchoolContext —
// a student's device may never have had an admin signed in on it, so
// every piece of data here (the student, their assignments, their
// school's name) is fetched independently, directly from Supabase.
export default function StudentHome() {
  const navigate = useNavigate();
  const { currentStudentId, setCurrentStudentId } = useStudentSession();

  const [student, setStudent] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentStudentId) { navigate('/login'); return; }

    setLoading(true);
    fetchStudentById(currentStudentId)
      .then(async (s) => {
        if (!s) { navigate('/login'); return; }
        setStudent(s);
        const [assignmentRows, schoolRow] = await Promise.all([
          fetchAssignmentsForStudent(s.id),
          fetchSchoolById(s.schoolId),
        ]);
        setAssignments(assignmentRows);
        setSchool(schoolRow);
      })
      .catch((err) => {
        console.error('Failed to load student data:', err.message);
        navigate('/login');
      })
      .finally(() => setLoading(false));
  }, [currentStudentId, navigate]);

  if (loading || !student || !school) return null;

  const today = new Date().toISOString().slice(0, 10);
  const available = assignments.filter(a => !a.completed && a.date <= today);

  const signOut = () => {
    setCurrentStudentId(null);
    navigate('/login');
  };

  return (
    <div className="student-portal">
      <header className="student-topbar">
        <div>
          <div className="student-topbar-brand">{school.name}</div>
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
