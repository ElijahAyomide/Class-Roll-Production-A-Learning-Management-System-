import React, { useState, useEffect } from 'react';
import PasswordInput from '../components/PasswordInput';
import { Save, Upload, X } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { useSchool } from '../context/SchoolContext';
import { NIGERIAN_STATES } from '../data/mockData';
import ClassesSubjectsPanel from '../components/ClassesSubjectsPanel';
import { signInAdmin, changePassword } from '../lib/auth';

const SECTIONS = ['School Profile', 'Classes & Subjects', 'Admin Account'];

export default function Settings() {
  const [section, setSection] = useState(SECTIONS[0]);
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

  const submitProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await setSchool(draft);
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setDraft({ ...draft, logo: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <DashboardLayout title="Settings" subtitle="Manage your school profile, classes, and account">
      <div className="settings-layout">
        <div className="settings-tabs">
          {SECTIONS.map(s => (
            <button key={s} className={`settings-tab ${section === s ? 'settings-tab-active' : ''}`} onClick={() => setSection(s)}>
              {s}
            </button>
          ))}
        </div>

        <div className="card settings-panel">
          {section === 'School Profile' && (
            <form onSubmit={submitProfile} className="quick-add-form">
              <div className="field">
                <label>SCHOOL LOGO</label>
                <div className="logo-upload-row">
                  <div className="logo-preview">
                    {draft.logo ? (
                      <img src={draft.logo} alt="School logo" />
                    ) : (
                      <span>{draft.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="logo-upload-actions">
                    <label className="btn-ghost logo-upload-btn">
                      <Upload size={14} /> {draft.logo ? 'Change Logo' : 'Upload Logo'}
                      <input type="file" accept="image/*" onChange={handleLogoUpload} hidden />
                    </label>
                    {draft.logo && (
                      <button type="button" className="link-btn link-btn-danger" onClick={() => setDraft({ ...draft, logo: null })}>
                        <X size={12} /> Remove
                      </button>
                    )}
                  </div>
                </div>
                <div className="field-hint">This appears as your admin avatar in the top bar across the dashboard. PNG or JPG, square images work best. Changes here save when you click "Save Changes" below.</div>
              </div>

              <div className="field">
                <label>SCHOOL NAME</label>
                <input type="text" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="field">
                <label>SCHOOL CODE</label>
                <input type="text" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} />
                <div className="field-hint">Used as the prefix for student usernames, e.g. {draft.code}/2026/001</div>
              </div>
              <div className="field">
                <label>ADDRESS</label>
                <input type="text" value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} />
              </div>
              <div className="form-row-2">
                <div className="field">
                  <label>STATE</label>
                  <select value={draft.state} onChange={e => setDraft({ ...draft, state: e.target.value })}>
                    {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>LOCAL GOVERNMENT AREA</label>
                  <input type="text" placeholder="e.g. Ikeja" value={draft.lga} onChange={e => setDraft({ ...draft, lga: e.target.value })} />
                </div>
              </div>
              <div className="form-row-2">
                <div className="field">
                  <label>EMAIL</label>
                  <input type="email" value={draft.email} onChange={e => setDraft({ ...draft, email: e.target.value })} />
                </div>
                <div className="field">
                  <label>PHONE</label>
                  <input type="text" value={draft.phone} onChange={e => setDraft({ ...draft, phone: e.target.value })} />
                </div>
              </div>
              {error && <div className="error-text">{error}</div>}
              <button type="submit" className="btn-primary" disabled={saving}>
                <Save size={15} /> {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && <div className="success-note">Settings saved.</div>}
            </form>
          )}

          {section === 'Classes & Subjects' && <ClassesSubjectsPanel />}

          {section === 'Admin Account' && (
            <form onSubmit={submitPassword} className="quick-add-form">
              <div className="field">
                <label>CURRENT PASSWORD</label>
                <PasswordInput placeholder="••••••••" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
              </div>
              <div className="field">
                <label>NEW PASSWORD</label>
                <PasswordInput placeholder="At least 6 characters" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
              </div>
              <div className="field">
                <label>CONFIRM NEW PASSWORD</label>
                <PasswordInput placeholder="••••••••" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} />
              </div>
              {pwError && <div className="error-text">{pwError}</div>}
              <button type="submit" className="btn-primary" disabled={pwSaving}>
                <Save size={15} /> {pwSaving ? 'Updating…' : 'Update Password'}
              </button>
              {pwSaved && <div className="success-note">Password updated.</div>}
            </form>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
