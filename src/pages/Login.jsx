import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, ArrowRight, UserPlus } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { useStudentSession } from '../context/StudentSessionContext';
import { signUpAdmin, signInAdmin } from '../lib/auth';
import { claimOrCreateSchool } from '../lib/schools';
import { studentApi } from '../lib/studentApi';
import { NIGERIAN_STATES } from '../data/mockData';
import ExamIllustration from '../components/ExamIllustration';

const EMPTY_REGISTER = {
  name: '', code: '', email: '', phone: '', address: '', state: NIGERIAN_STATES[0], lga: '',
  password: '', confirmPassword: '',
};

export default function Login() {
  const navigate = useNavigate();
  const { setSchoolDirectly } = useSchool();
  const { setStudentToken } = useStudentSession();
  const [tab, setTab] = useState('admin'); // 'admin' | 'student'
  const [adminMode, setAdminMode] = useState('signin'); // 'signin' | 'register'
  const [imageFailed, setImageFailed] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [studentUsername, setStudentUsername] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentChecking, setStudentChecking] = useState(false);

  const [registerForm, setRegisterForm] = useState(EMPTY_REGISTER);
  const [registerError, setRegisterError] = useState('');
  const [registering, setRegistering] = useState(false);

  const submitSignIn = async (e) => {
    e.preventDefault();
    setSignInError('');
    if (!email.trim() || !password) {
      setSignInError('Enter your email and password.');
      return;
    }
    setSigningIn(true);
    try {
      await signInAdmin(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setSignInError(err.message || 'Could not sign in. Check your email and password.');
    } finally {
      setSigningIn(false);
    }
  };

  const submitStudentSignIn = async (e) => {
    e.preventDefault();
    setStudentError('');
    const username = studentUsername.trim();
    const surname = studentPassword.trim();
    if (!username || !surname) {
      setStudentError('Enter your username and surname.');
      return;
    }
    setStudentChecking(true);
    try {
      // The server checks the username + surname, applies the lockout rules,
      // and checks the student has something to take. We only get a token back.
      const { token } = await studentApi.login(username, surname);
      setStudentToken(token);
      navigate('/student');
    } catch (err) {
      setStudentError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setStudentChecking(false);
    }
  };

  const submitRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');
    if (!registerForm.name.trim() || !registerForm.code.trim() || !registerForm.email.trim()) {
      setRegisterError('School name, code, and email are required.');
      return;
    }
    if (!registerForm.password || registerForm.password.length < 6) {
      setRegisterError('Password must be at least 6 characters.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }
    setRegistering(true);
    try {
      const user = await signUpAdmin(registerForm.email.trim(), registerForm.password);
      const newSchool = await claimOrCreateSchool(user.id, {
        name: registerForm.name.trim(),
        code: registerForm.code.trim().toUpperCase(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        address: registerForm.address.trim(),
        state: registerForm.state,
        lga: registerForm.lga.trim(),
      });
      setSchoolDirectly(newSchool);
      navigate('/dashboard');
    } catch (err) {
      setRegisterError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-image-panel">
        {imageFailed ? (
          <ExamIllustration />
        ) : (
          <img
            src="/images/login-photo.jpg"
            alt="Students taking a computer-based exam"
            className="login-hero-image"
            onError={() => setImageFailed(true)}
          />
        )}
        <div className="login-image-caption">
          <div className="login-image-title">Computer-based testing, built for Nigerian secondary schools</div>
          <div className="login-image-sub">Set up a test or exam in minutes — students take it from their own login, and results land on your dashboard the moment they submit.</div>
        </div>
      </div>

      <div className="login-form-panel">
        <div className={`login-card ${tab === 'admin' && adminMode === 'register' ? 'login-card-wide' : ''}`}>
        <div className="login-brand">
          <div className="brand-mark brand-mark-lg">CR</div>
          <div>
            <div className="login-brand-name">ClassRoll</div>
            <div className="login-brand-tag">Exam management for secondary schools</div>
          </div>
        </div>

        <div className="login-tabs">
          <button className={`login-tab ${tab === 'admin' ? 'login-tab-active' : ''}`} onClick={() => setTab('admin')}>
            Admin
          </button>
          <button className={`login-tab ${tab === 'student' ? 'login-tab-active' : ''}`} onClick={() => setTab('student')}>
            Student
          </button>
        </div>

        {tab === 'admin' && adminMode === 'signin' && (
          <form onSubmit={submitSignIn} className="login-form">
            <div className="field">
              <label>SCHOOL EMAIL</label>
              <input type="email" placeholder="admin@yourschool.edu.ng" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>PASSWORD</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {signInError && <div className="error-text">{signInError}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={signingIn}>
              {signingIn ? 'Signing In…' : 'Sign In'} {!signingIn && <ArrowRight size={15} />}
            </button>
            <button type="button" className="login-switch-link" onClick={() => setAdminMode('register')}>
              New school? Register here
            </button>
          </form>
        )}

        {tab === 'admin' && adminMode === 'register' && (
          <form onSubmit={submitRegister} className="login-form">
            <div className="field">
              <label>SCHOOL NAME</label>
              <input type="text" placeholder="e.g. Green Valley College" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>SCHOOL CODE</label>
                <input type="text" placeholder="e.g. GVC" value={registerForm.code} onChange={e => setRegisterForm({ ...registerForm, code: e.target.value })} />
              </div>
              <div className="field">
                <label>PHONE</label>
                <input type="text" placeholder="+234…" value={registerForm.phone} onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>SCHOOL EMAIL</label>
              <input type="email" placeholder="admin@yourschool.edu.ng" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} />
            </div>
            <div className="field">
              <label>ADDRESS</label>
              <input type="text" placeholder="Street, city" value={registerForm.address} onChange={e => setRegisterForm({ ...registerForm, address: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>STATE</label>
                <select value={registerForm.state} onChange={e => setRegisterForm({ ...registerForm, state: e.target.value })}>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field">
                <label>LGA</label>
                <input type="text" placeholder="e.g. Ikeja" value={registerForm.lga} onChange={e => setRegisterForm({ ...registerForm, lga: e.target.value })} />
              </div>
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>PASSWORD</label>
                <input type="password" placeholder="At least 6 characters" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} />
              </div>
              <div className="field">
                <label>CONFIRM PASSWORD</label>
                <input type="password" placeholder="••••••••" value={registerForm.confirmPassword} onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} />
              </div>
            </div>
            {registerError && <div className="error-text">{registerError}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={registering}>
              <UserPlus size={15} /> {registering ? 'Creating Account…' : 'Register School'}
            </button>
            <button type="button" className="login-switch-link" onClick={() => { setAdminMode('signin'); setRegisterError(''); }}>
              Already registered? Sign in
            </button>
          </form>
        )}

        {tab === 'student' && (
          <form onSubmit={submitStudentSignIn} className="login-form">
            <div className="field">
              <label>USERNAME</label>
              <input
                type="text" placeholder="GVC/2026/001"
                value={studentUsername} onChange={e => setStudentUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label>PASSWORD (SURNAME)</label>
              <input
                type="password" placeholder="e.g. Okafor"
                value={studentPassword} onChange={e => setStudentPassword(e.target.value)}
              />
            </div>
            {studentError && <div className="error-text">{studentError}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={studentChecking}>
              {studentChecking ? 'Checking…' : 'Sign In'} {!studentChecking && <ArrowRight size={15} />}
            </button>
            <div className="student-portal-notice">
              <GraduationCap size={16} />
              <span>Your username and surname are given to you by your school admin — you don't need to register.</span>
            </div>
          </form>
        )}
      </div>
      </div>
    </div>
  );
}
