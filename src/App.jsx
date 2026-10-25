import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import { TermsPage, PrivacyPage } from './pages/LegalPage';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import QuestionBank from './pages/QuestionBank';
import Results from './pages/Results';
import License from './pages/License';
import Settings from './pages/Settings';
import SignOut from './pages/SignOut';
import StudentHome from './pages/student/StudentHome';
import StudentExam from './pages/student/StudentExam';
import { useIdleLogout } from './lib/idleLogout';
import { SchoolProvider, useSchool } from './context/SchoolContext';
import { StudentSessionProvider } from './context/StudentSessionContext';
import { fetchStudents } from './lib/students';
import { fetchAssignmentsForSchool } from './lib/assignments';
import { fetchQuestions } from './lib/questions';
import { fetchResults } from './lib/results';
import { fetchLicense } from './lib/license';
import { fetchClasses } from './lib/classes';
import { ClassSetupProvider } from './context/ClassSetupContext';

function LoadingScreen() {
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    // If loading takes longer than 8 seconds, something's probably gone
    // wrong (a hung request, a real error, or an edge case we haven't
    // seen) — rather than leave the screen stuck forever with no way
    // out, offer a manual reload.
    const t = setTimeout(() => setShowRetry(true), 8000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', justifyContent: 'center', color: '#5D7291', fontFamily: 'Calibri, sans-serif' }}>
      <div>Loading ClassRoll…</div>
      {showRetry && (
        <div style={{ textAlign: 'center', fontSize: 13 }}>
          <div style={{ marginBottom: 8 }}>This is taking longer than expected.</div>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#385DE9', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Reload the page
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SchoolProvider>
      <StudentSessionProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          {/* Student portal — deliberately independent of any admin
              session, since students log in from their own devices,
              which may never have had an admin signed in on them. */}
          <Route path="/student" element={<StudentHome />} />
          <Route path="/student/exam/:groupId" element={<StudentExam />} />

          {/* Admin portal — everything past this point requires a real,
              signed-in admin account (see AdminArea below). */}
          <Route path="/*" element={<AdminArea />} />
        </Routes>
      </StudentSessionProvider>
    </SchoolProvider>
  );
}

// Gates every admin page behind a real Supabase Auth session, and fetches
// all admin-scoped data (students, questions, results, license) once the
// signed-in admin's school is known.
function AdminArea() {
  const { school, session, loading: schoolLoading } = useSchool();
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [license, setLicense] = useState({ balance: 0, pricePerExam: 50, history: [] });
  const [classRows, setClassRows] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!schoolLoading && !session) navigate('/login', { replace: true });
  }, [schoolLoading, session, navigate]);

  // Signs the admin out after 30 minutes of inactivity, or when the computer
  // has been asleep or hibernating, so an unattended screen can't be used.
  const warnSeconds = useIdleLogout(session, () => navigate('/login', { replace: true }));

  useEffect(() => {
    if (!school?.id) return;
    setDataLoading(true);
    Promise.all([
      fetchStudents(school.id),
      fetchAssignmentsForSchool(school.id),
      fetchQuestions(school.id),
      fetchResults(school.id),
      fetchLicense(school.id),
      fetchClasses(school.id),
    ])
      .then(([studentRows, assignmentRows, questionRows, resultRows, licenseData, classData]) => {
        const studentsWithAssignments = studentRows.map(s => ({
          ...s,
          assignments: assignmentRows.filter(a => a.studentId === s.id),
        }));
        setStudents(studentsWithAssignments);
        setQuestions(questionRows);
        setResults(resultRows);
        setLicense(licenseData);
        setClassRows(classData);
      })
      .catch((err) => console.error('Failed to load admin data from Supabase:', err.message))
      .finally(() => setDataLoading(false));
  }, [school?.id]);

  if (schoolLoading || (session && dataLoading)) return <LoadingScreen />;
  if (!session) return null; // redirecting to /login via the effect above

  if (!school) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#5D7291', fontFamily: 'Calibri, sans-serif', textAlign: 'center', padding: 20 }}>
        <div>We couldn't find a school linked to this account.</div>
        <div style={{ fontSize: 13 }}>If you just registered, try refreshing. Otherwise, contact support.</div>
      </div>
    );
  }

  return (
    <ClassSetupProvider classRows={classRows} setClassRows={setClassRows}>
    <Routes>
      <Route path="dashboard" element={
        <Dashboard students={students} setStudents={setStudents} questions={questions} results={results} license={license} setLicense={setLicense} />
      } />
      <Route path="students" element={<Students students={students} setStudents={setStudents} questions={questions} license={license} setLicense={setLicense} />} />
      <Route path="question-bank" element={<QuestionBank questions={questions} setQuestions={setQuestions} students={students} />} />
      <Route path="results" element={<Results results={results} />} />
      <Route path="license" element={<License license={license} setLicense={setLicense} />} />
      <Route path="settings" element={<Settings />} />
      <Route path="sign-out" element={<SignOut />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
    {warnSeconds !== null && (
      <div className="idle-warning" role="alert">
        For your security you'll be signed out in {Math.floor(warnSeconds / 60)}:{String(warnSeconds % 60).padStart(2, '0')} because you've been inactive.
        Move your mouse or press any key to stay signed in.
      </div>
    )}
    </ClassSetupProvider>
  );
}
