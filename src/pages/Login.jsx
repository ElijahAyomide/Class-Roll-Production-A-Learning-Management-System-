import React, { useState } from 'react';
import PasswordInput from '../components/PasswordInput';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, MailCheck } from 'lucide-react';
import Modal from '../components/Modal';
import { SIGNOUT_REASON_KEY } from '../lib/idleLogout';
import { useSchool } from '../context/SchoolContext';
import { useStudentSession } from '../context/StudentSessionContext';
import { signUpAdmin, signInAdmin, requestPasswordReset, resendConfirmation } from '../lib/auth';
import { claimOrCreateSchool, schoolCodeTaken } from '../lib/schools';
import { studentApi } from '../lib/studentApi';
import { NIGERIAN_STATES } from '../data/mockData';

const EMPTY_REGISTER = {
  name: '', code: '', email: '', phone: '', address: '', state: NIGERIAN_STATES[0], lga: '',
  password: '', confirmPassword: '',
};

export default function Login() {
  const navigate = useNavigate();
  const { setSchoolDirectly } = useSchool();
  const { setStudentToken } = useStudentSession();
  const [tab, setTab] = useState('admin'); // 'admin' | 'student'
  const [adminMode, setAdminMode] = useState('signin'); // 'signin' | 'register' | 'forgot'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signInError, setSignInError] = useState('');
  // Shown once if the admin was signed out automatically (inactive or computer asleep).
  const [autoSignedOut] = useState(() => {
    try {
      const r = sessionStorage.getItem(SIGNOUT_REASON_KEY);
      if (r) sessionStorage.removeItem(SIGNOUT_REASON_KEY);
      return r;
    } catch { return null; }
  });
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
      if (/not confirmed/i.test(err.message || '')) {
        setNeedsConfirm(true);
        setSignInError('Please confirm your email first. Open the verification link we sent you, then sign in.');
      } else {
        setNeedsConfirm(false);
        setSignInError(err.message || 'Could not sign in. Check your email and password.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [resendState, setResendState] = useState(''); // '' | 'sending' | 'sent' | 'error'
  const resendLink = async (address) => {
    setResendState('sending');
    try { await resendConfirmation(address); setResendState('sent'); }
    catch { setResendState('error'); }
  };
  const [verifyEmail, setVerifyEmail] = useState(null); // set after registering: shows the "check your email" pop-up

  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState('');

  const submitForgot = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!email.trim()) { setResetError('Enter the email you registered with.'); return; }
    setResetSending(true);
    try {
      await requestPasswordReset(email.trim());
      // Same message whether or not an account exists, so this form can't
      // be used to find out which emails are registered.
      setResetSent(true);
    } catch (err) {
      setResetError(err.message || 'Could not send the reset email. Please try again in a few minutes.');
    } finally {
      setResetSending(false);
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
      const profile = {
        name: registerForm.name.trim(),
        code: registerForm.code.trim().toUpperCase(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        address: registerForm.address.trim(),
        state: registerForm.state,
        lga: registerForm.lga.trim(),
      };
      // Check the code now, so nobody confirms their email and then finds the
      // school couldn't be created.
      if (await schoolCodeTaken(profile.code)) {
        setRegisterError('That school code is already used by another school. Please choose a different one.');
        return;
      }
      const { user, session } = await signUpAdmin(profile.email, registerForm.password, profile);

      if (session) {
        // Email confirmation is off in Supabase: they're signed in already.
        const newSchool = await claimOrCreateSchool(user.id, profile);
        setSchoolDirectly(newSchool);
        navigate('/dashboard');
      } else {
        // Confirmation is on: tell them to check their email.
        setResendState('');
        setVerifyEmail(profile.email);
        setRegisterForm(EMPTY_REGISTER);
      }
    } catch (err) {
      setRegisterError(err.message || 'Could not create your account. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-image-panel">
        <div className="login-image-text">
          <h1 className="login-image-title">Computer-Based Testing,<br />Built for Nigeria Education</h1>
          <p className="login-image-sub">Set up a test or exam in minutes — students take it from their own login, and results land on your dashboard the moment they submit.</p>
        </div>
        <img src="/images/login-illustration.png" alt="" className="login-illustration" />
      </div>

      <div className="login-form-panel">
        <div className={`login-card ${tab === 'admin' && adminMode === 'register' ? 'login-card-wide' : ''}`}>
        <div className="login-brand">
          <img src="/images/assessly-logo.png" alt="" className="login-logo" />
          <div>
            <div className="login-brand-name">Assessly</div>
            <div className="login-brand-tag">Exam management for schools</div>
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
              <label>Email address</label>
              <input type="email" placeholder="admin@yourschool.edu.ng" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Password</label>
              <PasswordInput placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {autoSignedOut && !signInError && (
              <div className="success-note">
                {autoSignedOut === 'sleep'
                  ? 'You were signed out because your computer went to sleep. Please sign in again.'
                  : 'You were signed out because you were inactive for a while. Please sign in again.'}
              </div>
            )}
            {signInError && <div className="error-text">{signInError}</div>}
            {needsConfirm && (
              <button type="button" className="login-switch-link" disabled={resendState === 'sending'} onClick={() => resendLink(email.trim())}>
                {resendState === 'sent' ? 'Verification email sent. Check your inbox.' : resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            <button type="submit" className="btn-primary login-submit" disabled={signingIn}>
              {signingIn ? 'Signing In…' : 'Sign In'}
            </button>
            <div className="login-links">
              <button type="button" className="login-switch-link" onClick={() => { setResetSent(false); setResetError(''); setAdminMode('forgot'); }}>
                Forgot password?
              </button>
              <div className="login-prompt">
                Are you a New School?{' '}
                <button type="button" className="login-switch-link" onClick={() => setAdminMode('register')}>Register here</button>
              </div>
            </div>
          </form>
        )}

        {tab === 'admin' && adminMode === 'forgot' && (
          <form onSubmit={submitForgot} className="login-form">
            <div className="field-hint">Enter the email you registered with and we'll send you a link to choose a new password.</div>
            <div className="field">
              <label>Email address</label>
              <input type="email" placeholder="admin@yourschool.edu.ng" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {resetError && <div className="error-text">{resetError}</div>}
            {resetSent && <div className="success-note">If that email is registered, a reset link is on its way. Check your inbox (and spam folder).</div>}
            <button type="submit" className="btn-primary login-submit" disabled={resetSending}>
              {resetSending ? 'Sending…' : resetSent ? 'Send Again' : 'Send Reset Link'}
            </button>
            <button type="button" className="login-switch-link" onClick={() => setAdminMode('signin')}>
              Back to sign in
            </button>
          </form>
        )}

        {tab === 'admin' && adminMode === 'register' && (
          <form onSubmit={submitRegister} className="login-form">
            <div className="field">
              <label>School name</label>
              <input type="text" placeholder="e.g. Green Valley College" value={registerForm.name} onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>School code</label>
                <input type="text" placeholder="e.g. GVC" value={registerForm.code} onChange={e => setRegisterForm({ ...registerForm, code: e.target.value })} />
              </div>
              <div className="field">
                <label>Phone number</label>
                <input type="text" placeholder="+234" value={registerForm.phone} onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label>Email address</label>
              <input type="email" placeholder="admin@yourschool.edu.ng" value={registerForm.email} onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Address</label>
              <input type="text" placeholder="Street, City" value={registerForm.address} onChange={e => setRegisterForm({ ...registerForm, address: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>State</label>
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
                <label>Password</label>
                <PasswordInput placeholder="Min. 6 characters" value={registerForm.password} onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })} />
              </div>
              <div className="field">
                <label>Confirm password</label>
                <PasswordInput placeholder="••••••••••••" value={registerForm.confirmPassword} onChange={e => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })} />
              </div>
            </div>
            {registerError && <div className="error-text">{registerError}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={registering}>
              {registering ? 'Creating Account…' : 'Sign Up'}
            </button>
            <div className="login-links">
              <div className="login-prompt">
                Already registered?{' '}
                <button type="button" className="login-switch-link" onClick={() => { setAdminMode('signin'); setRegisterError(''); }}>Sign in</button>
              </div>
            </div>
          </form>
        )}

        {tab === 'student' && (
          <form onSubmit={submitStudentSignIn} className="login-form">
            <div className="field">
              <label>Username</label>
              <input
                type="text" placeholder="GVC/2026/001"
                value={studentUsername} onChange={e => setStudentUsername(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Password (surname)</label>
              <PasswordInput
                placeholder="e.g. Okafor"
                value={studentPassword} onChange={e => setStudentPassword(e.target.value)}
              />
            </div>
            {studentError && <div className="error-text">{studentError}</div>}
            <button type="submit" className="btn-primary login-submit" disabled={studentChecking}>
              {studentChecking ? 'Checking…' : 'Sign In'}
            </button>
            <div className="student-portal-notice">
              <GraduationCap size={16} />
              <span>Your username and surname are given to you by your school admin — you don't need to register.</span>
            </div>
          </form>
        )}
      </div>
      </div>

      {verifyEmail && (
        <Modal title="Account created!" onClose={() => { setVerifyEmail(null); setAdminMode('signin'); }} width={420}>
          <div style={{ textAlign: 'center' }}>
            <div className="signout-icon" style={{ background: 'var(--surface-2)', color: 'var(--primary)' }}><MailCheck size={22} /></div>
            <p className="confirm-text" style={{ marginBottom: 8 }}>
              We've sent a verification link to <b>{verifyEmail}</b>.
            </p>
            <p className="confirm-text">
              Please check your email (and your spam folder), then click the link to verify your account. It will take you straight to your dashboard. After that, you can sign in any time from the regular sign-in page.
            </p>
            <button type="button" className="login-switch-link" disabled={resendState === 'sending'} onClick={() => resendLink(verifyEmail)}>
              {resendState === 'sent' ? 'Sent again. Check your inbox.' : resendState === 'error' ? "Couldn't resend. Try again in a minute." : resendState === 'sending' ? 'Sending…' : "Didn't get it? Send it again"}
            </button>
            <div className="confirm-actions" style={{ justifyContent: 'center', marginTop: 12 }}>
              <button className="btn-primary" onClick={() => { setVerifyEmail(null); setAdminMode('signin'); }}>OK, I'll check my email</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
