import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordInput from '../components/PasswordInput';
import { Upload, X, Check, Building2, User, ShieldCheck, LogOut, Layers } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import AdminRail, { adminNameFrom } from '../components/AdminRail';
import Modal from '../components/Modal';
import { useSchool } from '../context/SchoolContext';
import { NIGERIAN_STATES } from '../data/mockData';
import ClassesSubjectsPanel from '../components/ClassesSubjectsPanel';
import { signInAdmin, changePassword, signOutAdmin } from '../lib/auth';
import { forgetActivity } from '../lib/idleLogout';
import { prepareLogo, uploadLogo, removeOldLogos } from '../lib/logo';

const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || '';

export default function Settings({ license }) {
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { school, setSchool, session } = useSchool();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Local draft of the school profile form. Typing here only updates this
  // draft — nothing hits Supabase until "Save Changes" is clicked. Without
  // this, every keystroke would fire a database write, which is both
  // wasteful and prone to race conditions from rapid typing.
  const [draft, setDraft] = useState(school);
  useEffect(() => { setDraft(school); }, [school]);

  // A newly chosen logo waits here (already shrunk) until "Save Changes".
  // Only then is it uploaded, so abandoned choices never leave files behind.
  const [pendingLogo, setPendingLogo] = useState(null); // { blob, preview }
  useEffect(() => () => { if (pendingLogo) URL.revokeObjectURL(pendingLogo.preview); }, [pendingLogo]);

  const submitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let toSave = draft;
      if (pendingLogo) {
        const url = await uploadLogo(school.id, pendingLogo.blob);
        toSave = { ...draft, logo: url };
      }
      await setSchool(toSave);
      if (pendingLogo || (school.logo && !toSave.logo)) {
        await removeOldLogos(school.id, toSave.logo);
      }
      setPendingLogo(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);

  const submitPassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (!pw.current) { setPwError('Enter your current password.'); return; }
    if (pw.next.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (pw.next !== pw.confirm) { setPwError('The new passwords do not match.'); return; }
    if (pw.next === pw.current) { setPwError('Your new password must be different from the current one.'); return; }

    setPwSaving(true);
    try {
      // Confirm the current password first (uses the email this account
      // signs in with, which may differ from the school's contact email).
      try {
        await signInAdmin(session.user.email, pw.current);
      } catch {
        setPwError('Your current password is incorrect.');
        return;
      }
      await changePassword(pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 4000);
    } catch (err) {
      setPwError(err.message || 'Could not update your password. Please try again.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;
    setError('');
    try {
      const blob = await prepareLogo(file);
      setPendingLogo({ blob, preview: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err.message);
    }
  };

  const shownLogo = pendingLogo ? pendingLogo.preview : draft.logo;

  const doSignOut = async () => {
    setSigningOut(true);
    try {
      forgetActivity();
      await signOutAdmin();
    } catch (err) {
      console.error('Sign out failed:', err.message);
    } finally {
      navigate('/login');
    }
  };

  // "Cancel" throws away unsaved edits to the school profile.
  const cancelEdits = () => { setDraft(school); setPendingLogo(null); setError(''); };

  const adminName = adminNameFrom(session);
  const loginEmail = session?.user?.email || '';
  const emailVerified = !!session?.user?.email_confirmed_at;

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">{school.name}</div>
        <div className="rail-title">Your school. Your workspace.</div>
        <p className="rail-lead">Keep your school profile and account preferences in one place.</p>
        <ul className="rail-checks">
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Workspace administrator</span>
              <span className="rail-step-desc">You can manage all school settings.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Keep your account secure</span>
              <span className="rail-step-desc">Change your password from the Security card.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Need a hand?</span>
              <span className="rail-step-desc">{SUPPORT_EMAIL ? `Contact ${SUPPORT_EMAIL}.` : 'Contact your Assessly support team.'}</span>
            </span>
          </li>
        </ul>
      </>
    </AdminRail>
  );

  return (
    <DashboardLayout rail={rail} flush scroll>
      <div className="page-panel settings-page">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Settings</h2>
            <p className="panel-sub">Manage your school profile, account and workspace preferences.</p>
          </div>
          <div className="panel-actions">
            <button type="button" className="btn-ghost" onClick={cancelEdits} disabled={saving}>Cancel</button>
            <button type="submit" form="profile-form" className="btn-primary" disabled={saving}>
              <Check size={15} /> {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="workspace-strip">
          <Building2 size={18} />
          <b>{school.name}</b>
          <span>School code: {school.code}</span>
          <span className="workspace-badge">Administrator</span>
        </div>
        {error && <div className="error-text settings-msg">{error}</div>}
        {saved && <div className="success-note settings-msg">Settings saved.</div>}

        <div className="settings-cols">
          <form id="profile-form" onSubmit={submitProfile} className="card settings-card">
            <div className="settings-card-title"><Building2 size={18} /> School profile</div>

            <div className="logo-upload-row">
              <div className="logo-preview">
                {shownLogo ? <img src={shownLogo} alt="School logo" /> : <span>{(draft.name || '?').charAt(0)}</span>}
              </div>
              <div className="logo-upload-actions">
                <label className="btn-ghost logo-upload-btn">
                  <Upload size={14} /> {shownLogo ? 'Change logo' : 'Upload logo'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoUpload} hidden />
                </label>
                {shownLogo && (
                  <button type="button" className="link-btn link-btn-danger" onClick={() => { setPendingLogo(null); setDraft({ ...draft, logo: null }); }}>
                    <X size={12} /> Remove
                  </button>
                )}
                <div className="field-hint">PNG, JPG or WebP; square works best. It also appears on printed result slips. Saves when you click "Save changes".</div>
              </div>
            </div>

            <div className="field">
              <label>School name</label>
              <input type="text" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="field">
              <label>School code</label>
              <input type="text" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} />
              <div className="field-hint">Used as the prefix for student usernames, e.g. {draft.code}/2026/001</div>
            </div>
            <div className="field">
              <label>School email address</label>
              <input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input type="text" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>Address</label>
              <input type="text" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} />
            </div>
            <div className="form-row-2">
              <div className="field">
                <label>State</label>
                <select value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })}>
                  {NIGERIAN_STATES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Local government area</label>
                <input type="text" placeholder="e.g. Ikeja" value={draft.lga} onChange={e => setDraft({ ...draft, lga: e.target.value })} />
              </div>
            </div>
          </form>

          <div className="settings-stack">
            <div className="card settings-card">
              <div className="settings-card-title"><User size={18} /> Administrator account</div>
              <div className="admin-row">
                {school.logo
                  ? <img src={school.logo} alt="" className="admin-row-avatar admin-row-avatar-img" />
                  : <div className="admin-row-avatar">{adminName.charAt(0).toUpperCase()}</div>}
                <div className="field-hint admin-row-hint">Your profile picture is the school logo. Change it in School profile.</div>
              </div>
              <div className="field">
                <label>Full name</label>
                <input type="text" value={adminName} readOnly />
              </div>
              <div className="field">
                <label>Sign-in email address</label>
                <input type="text" value={loginEmail} readOnly />
              </div>
              <div className="admin-role-row">
                <div><div className="admin-role-title">School administrator</div><div className="field-hint">Full access to this workspace</div></div>
                {emailVerified && <span className="verified-pill">Verified</span>}
              </div>
            </div>

            <div className="card settings-card">
              <div className="settings-card-title"><ShieldCheck size={18} /> Security</div>
              <div className="sec-row">
                <div><div className="admin-role-title">Password</div><div className="field-hint">Use a password you don't use anywhere else.</div></div>
                <button type="button" className="btn-ghost sec-btn" onClick={() => setPwOpen(o => !o)}>{pwOpen ? 'Close' : 'Change password'}</button>
              </div>
              {pwOpen && (
                <form onSubmit={submitPassword} className="quick-add-form pw-form">
                  <div className="field">
                    <label>Current password</label>
                    <PasswordInput placeholder="••••••••" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>New password</label>
                    <PasswordInput placeholder="At least 6 characters" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Confirm new password</label>
                    <PasswordInput placeholder="••••••••" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
                  </div>
                  {pwError && <div className="error-text">{pwError}</div>}
                  <button type="submit" className="btn-primary btn-block" disabled={pwSaving}>{pwSaving ? 'Updating…' : 'Update password'}</button>
                </form>
              )}
              {pwSaved && <div className="success-note">Password updated.</div>}
              <div className="sec-row sec-row-last">
                <div><div className="admin-role-title">Sign out</div><div className="field-hint">You'll need your school email and password to sign back in.</div></div>
                <button type="button" className="signout-btn" onClick={() => setConfirmSignOut(true)}><LogOut size={15} /> Sign out</button>
              </div>
            </div>
          </div>
        </div>

        <div className="card settings-card settings-classes">
          <div className="settings-card-title"><Layers size={18} /> Classes &amp; subjects</div>
          <ClassesSubjectsPanel />
        </div>
      </div>

      <div className="page-footer">
        <span>{school.name}</span>
        <span>© {new Date().getFullYear()} Assessly</span>
      </div>

      {confirmSignOut && (
        <Modal title="Sign out of Assessly?" onClose={() => setConfirmSignOut(false)} width={380}>
          <p className="confirm-text">You'll need your school email and password to sign back in.</p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmSignOut(false)}>Cancel</button>
            <button className="btn-danger" disabled={signingOut} onClick={doSignOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
