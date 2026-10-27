import React, { useState } from 'react';
import PasswordInput from '../components/PasswordInput';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, MailCheck, ArrowRight } from 'lucide-react';
import Modal from '../components/Modal';
import AuthAside from '../components/AuthAside';
import { SIGNOUT_REASON_KEY } from '../lib/idleLogout';
import { useSchool } from '../context/SchoolContext';
import { useStudentSession } from '../context/StudentSessionContext';
import { signUpAdmin, signInAdmin, requestPasswordReset, resendConfirmation } from '../lib/auth';
import { claimOrCreateSchool, schoolCodeTaken } from '../lib/schools';
import { studentApi } from '../lib/studentApi';
import { setRememberChoice } from '../lib/rememberMe';

const EMPTY_REGISTER = {
  fullName: '', name: '', code: '', email: '', phone: '',
  password: '', confirmPassword: '', agree: false,
};
const MIN_PASSWORD = 8;
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

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
  const [remember, setRemember] = useState(true);

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
      setRememberChoice(remember);
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
    if (!registerForm.password || registerForm.password.length < MIN_PASSWORD) {
      setRegisterError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Passwords do not match.');
      return;
    }
    if (!registerForm.agree) {
      setRegisterError('Please agree to the Terms of service and Privacy policy to continue.');
      return;
    }
    setRegistering(true);
    try {
      const profile = {
        name: registerForm.name.trim(),
        code: registerForm.code.trim().toUpperCase(),
        email: registerForm.email.trim(),
        phone: registerForm.phone.trim(),
        // Address, state and LGA are filled in later under Settings.
        address: '',
        state: '',
        lga: '',
        contactName: registerForm.fullName.trim(),
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

  // Which screen is showing.
  const view = tab === 'student' ? 'student' : adminMode; // 'signin' | 'register' | 'forgot' | 'student'

  const goAdmin = (mode) => { setTab('admin'); setAdminMode(mode); };

  const topPrompt = {
    signin: { text: 'New to Assessly?', label: 'Sign up', go: () => goAdmin('register') },
    register: { text: 'Already have an account?', label: 'Sign in', go: () => { goAdmin('signin'); setRegisterError(''); } },
    forgot: { text: 'Remembered it?', label: 'Sign in', go: () => goAdmin('signin') },
    student: { text: 'School admin?', label: 'Admin sign in', go: () => goAdmin('signin') },
  }[view];

  const heading = {
    signin: { eyebrow: 'School workspace', title: 'Welcome back', sub: 'Sign in to manage your students and pick up where you left off.' },
    register: { eyebrow: 'Get started with Assessly', title: 'Create your account', sub: 'Set up your school workspace and make your next assessment a little simpler.' },
    forgot: { eyebrow: 'Password help', title: 'Reset your password', sub: "Enter the email you registered with and we'll send you a link to choose a new password." },
    student: { eyebrow: 'Student portal', title: 'Student sign in', sub: 'Use the username and surname your school gave you.' },
  }[view];

  const setReg = (patch) => setRegisterForm({ ...registerForm, ...patch });

  return (
    <div className="auth-screen">
      <AuthAside />

      <main className="auth-main">
        <div className="auth-topbar">
          <div className="auth-mobile-brand">
            <img src="/images/assessly-logo.png" alt="" />
            <span>Assessly</span>
          </div>
          <div className="auth-topbar-right">
            <span className="auth-topbar-text">{topPrompt.text}</span>
            <button type="button" className="auth-outline-btn" onClick={topPrompt.go}>{topPrompt.label}</button>
          </div>
        </div>

        <div className="auth-center">
          <div className="auth-form-col">
            <div className="auth-eyebrow">{heading.eyebrow}</div>
            <h2 className="auth-title">{heading.title}</h2>
            <p className="auth-sub">{heading.sub}</p>

            {view === 'signin' && (
              <form onSubmit={submitSignIn} className="auth-form">
                <div className="field">
                  <label>Email address</label>
                  <input type="email" placeholder="you@school.edu" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="field">
                  <label>Password</label>
                  <PasswordInput slashWhenHidden placeholder="Enter your password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="auth-row">
                  <label className="auth-check">
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                    <span>Remember me</span>
                  </label>
                  <button type="button" className="auth-link" onClick={() => { setResetSent(false); setResetError(''); setAdminMode('forgot'); }}>
                    Forgot password?
                  </button>
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
                  <button type="button" className="auth-link" disabled={resendState === 'sending'} onClick={() => resendLink(email.trim())}>
                    {resendState === 'sent' ? 'Verification email sent. Check your inbox.' : resendState === 'sending' ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
                <button type="submit" className="auth-submit" disabled={signingIn}>
                  {signingIn ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}
                </button>
                <div className="auth-switch">Don't have an account? <button type="button" className="auth-link" onClick={() => goAdmin('register')}>Sign up</button></div>
                <div className="auth-switch auth-switch-soft">Are you a student? <button type="button" className="auth-link" onClick={() => setTab('student')}>Student sign in</button></div>
              </form>
            )}

            {view === 'forgot' && (
              <form onSubmit={submitForgot} className="auth-form">
                <div className="field">
                  <label>Email address</label>
                  <input type="email" placeholder="you@school.edu" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                {resetError && <div className="error-text">{resetError}</div>}
                {resetSent && <div className="success-note">If that email is registered, a reset link is on its way. Check your inbox (and spam folder).</div>}
                <button type="submit" className="auth-submit" disabled={resetSending}>
                  {resetSending ? 'Sending…' : resetSent ? 'Send again' : <>Send reset link <ArrowRight size={17} /></>}
                </button>
                <div className="auth-switch"><button type="button" className="auth-link" onClick={() => goAdmin('signin')}>Back to sign in</button></div>
              </form>
            )}

            {view === 'register' && (
              <form onSubmit={submitRegister} className="auth-form">
                <div className="field">
                  <label>Full name</label>
                  <input type="text" placeholder="e.g. Tunde Balogun" autoComplete="name" value={registerForm.fullName} onChange={e => setReg({ fullName: e.target.value })} />
                </div>
                <div className="field">
                  <label>School name</label>
                  <input type="text" placeholder="Enter your school name" value={registerForm.name} onChange={e => setReg({ name: e.target.value })} />
                </div>
                <div className="form-row-2">
                  <div className="field">
                    <label>School code</label>
                    <input type="text" placeholder="Enter your school code" value={registerForm.code} onChange={e => setReg({ code: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Phone number</label>
                    <input type="tel" placeholder="+234" autoComplete="tel" value={registerForm.phone} onChange={e => setReg({ phone: e.target.value })} />
                  </div>
                </div>
                <div className="field">
                  <label>Email address</label>
                  <input type="email" placeholder="you@school.edu" autoComplete="email" value={registerForm.email} onChange={e => setReg({ email: e.target.value })} />
                </div>
                <div className="form-row-2">
                  <div className="field">
                    <label>Password</label>
                    <PasswordInput slashWhenHidden placeholder="Create a password" autoComplete="new-password" value={registerForm.password} onChange={e => setReg({ password: e.target.value })} />
                    <div className="auth-hint">Use at least {MIN_PASSWORD} characters.</div>
                  </div>
                  <div className="field">
                    <label>Confirm password</label>
                    <PasswordInput slashWhenHidden placeholder="Create a password" autoComplete="new-password" value={registerForm.confirmPassword} onChange={e => setReg({ confirmPassword: e.target.value })} />
                    <div className="auth-hint">Use at least {MIN_PASSWORD} characters.</div>
                  </div>
                </div>
                <label className="auth-check auth-agree">
                  <input type="checkbox" checked={registerForm.agree} onChange={e => setReg({ agree: e.target.checked })} />
                  <span>I agree to the <Link to="/terms" target="_blank">Terms of service</Link> and <Link to="/privacy" target="_blank">Privacy policy</Link>.</span>
                </label>
                {registerError && <div className="error-text">{registerError}</div>}
                <button type="submit" className="auth-submit" disabled={registering}>
                  {registering ? 'Creating account…' : <>Create account <ArrowRight size={17} /></>}
                </button>
                <div className="auth-switch">Already have an account? <button type="button" className="auth-link" onClick={() => { goAdmin('signin'); setRegisterError(''); }}>Sign in</button></div>
              </form>
            )}

            {view === 'student' && (
              <form onSubmit={submitStudentSignIn} className="auth-form">
                <div className="field">
                  <label>Username</label>
                  <input type="text" placeholder="GVC/2026/001" value={studentUsername} onChange={e => setStudentUsername(e.target.value)} />
                </div>
                <div className="field">
                  <label>Password (surname)</label>
                  <PasswordInput slashWhenHidden placeholder="e.g. Okafor" value={studentPassword} onChange={e => setStudentPassword(e.target.value)} />
                </div>
                {studentError && <div className="error-text">{studentError}</div>}
                <button type="submit" className="auth-submit" disabled={studentChecking}>
                  {studentChecking ? 'Checking…' : <>Sign in <ArrowRight size={17} /></>}
                </button>
                <div className="student-portal-notice">
                  <GraduationCap size={16} />
                  <span>Your username and surname are given to you by your school admin — you don't need to register.</span>
                </div>
              </form>
            )}
          </div>
        </div>

        <footer className="auth-footer">
          <div>{SUPPORT_EMAIL && <>Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a></>}</div>
          <div className="auth-footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </footer>
      </main>

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
