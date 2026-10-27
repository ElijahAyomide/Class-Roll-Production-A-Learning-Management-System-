import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import AuthAside from '../components/AuthAside';
import PasswordInput from '../components/PasswordInput';
import { getCurrentSession, onAuthStateChange, changePassword } from '../lib/auth';

const MIN_PASSWORD = 8;
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

// Where the link in the "reset your password" email lands. Supabase signs the
// person in from the link automatically; this page just waits for that, then
// lets them choose a new password.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let found = false;
    const markReady = () => { found = true; setReady(true); setLinkInvalid(false); };

    const unsubscribe = onAuthStateChange((s) => { if (s) markReady(); });
    getCurrentSession().then((s) => { if (s) markReady(); }).catch(() => {});

    // If nothing signs us in within a few seconds, the link was opened
    // without its token, or it has expired or already been used.
    const t = setTimeout(() => { if (!found) setLinkInvalid(true); }, 5000);
    return () => { clearTimeout(t); unsubscribe(); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < MIN_PASSWORD) { setError(`Password must be at least ${MIN_PASSWORD} characters.`); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      await changePassword(password);
      setDone(true);
      setTimeout(() => navigate('/dashboard', { replace: true }), 1500);
    } catch (err) {
      setError(err.message || 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const state = done ? 'done' : ready ? 'form' : linkInvalid ? 'invalid' : 'checking';
  const heading = {
    form: { eyebrow: 'Password help', title: 'Choose a new password', sub: 'Pick a password you have not used before. You will go straight to your dashboard afterwards.' },
    done: { eyebrow: 'All done', title: 'Password updated', sub: 'Taking you to your dashboard…' },
    invalid: { eyebrow: 'Password help', title: 'This link has expired', sub: 'Reset links only work once and stop working after a while. Request a new one from the sign-in page.' },
    checking: { eyebrow: 'Password help', title: 'Checking your link', sub: 'This only takes a moment.' },
  }[state];

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
            <span className="auth-topbar-text">Remembered it?</span>
            <button type="button" className="auth-outline-btn" onClick={() => navigate('/login')}>Sign in</button>
          </div>
        </div>

        <div className="auth-center">
          <div className="auth-form-col">
            <div className="auth-eyebrow">{heading.eyebrow}</div>
            <h2 className="auth-title">{heading.title}</h2>
            <p className="auth-sub">{heading.sub}</p>

            {state === 'form' && (
              <form onSubmit={submit} className="auth-form">
                <div className="field">
                  <label>New password</label>
                  <PasswordInput slashWhenHidden placeholder="Create a new password" autoComplete="new-password" value={password} autoFocus onChange={e => setPassword(e.target.value)} />
                  <div className="auth-hint">Use at least {MIN_PASSWORD} characters.</div>
                </div>
                <div className="field">
                  <label>Confirm new password</label>
                  <PasswordInput slashWhenHidden placeholder="Type it again" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
                </div>
                {error && <div className="error-text">{error}</div>}
                <button type="submit" className="auth-submit" disabled={saving}>
                  {saving ? 'Saving…' : <>Save new password <ArrowRight size={17} /></>}
                </button>
              </form>
            )}

            {state === 'done' && (
              <div className="auth-form">
                <div className="success-note"><CheckCircle2 size={16} style={{ verticalAlign: '-3px', marginRight: '0.5em' }} />Your password has been changed.</div>
              </div>
            )}

            {state === 'invalid' && (
              <div className="auth-form">
                <button type="button" className="auth-submit" onClick={() => navigate('/login')}>
                  Back to sign in <ArrowRight size={17} />
                </button>
              </div>
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
    </div>
  );
}
