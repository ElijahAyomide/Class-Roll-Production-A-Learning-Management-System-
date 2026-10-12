import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import PasswordInput from '../components/PasswordInput';
import { getCurrentSession, onAuthStateChange, changePassword } from '../lib/auth';

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
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
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

  return (
    <div className="login-screen" style={{ gridTemplateColumns: '1fr' }}>
      <div className="login-form-panel" style={{ width: '100%' }}>
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-mark brand-mark-lg">CR</div>
            <div>
              <div className="login-brand-name">ClassRoll</div>
              <div className="login-brand-tag">Choose a new password</div>
            </div>
          </div>

          {done ? (
            <div className="success-note">Password updated. Taking you to your dashboard…</div>
          ) : ready ? (
            <form onSubmit={submit} className="login-form">
              <div className="field">
                <label>NEW PASSWORD</label>
                <PasswordInput placeholder="At least 6 characters" value={password} autoFocus onChange={e => setPassword(e.target.value)} />
              </div>
              <div className="field">
                <label>CONFIRM NEW PASSWORD</label>
                <PasswordInput placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn-primary login-submit" disabled={saving}>
                <KeyRound size={15} /> {saving ? 'Saving…' : 'Save New Password'}
              </button>
            </form>
          ) : linkInvalid ? (
            <div className="login-form">
              <div className="error-text">This reset link is invalid or has expired. Reset links only work once.</div>
              <button type="button" className="btn-primary login-submit" onClick={() => navigate('/login')}>Back to sign in</button>
            </div>
          ) : (
            <div className="field-hint">Checking your reset link…</div>
          )}
        </div>
      </div>
    </div>
  );
}
