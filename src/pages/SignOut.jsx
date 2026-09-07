import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import { signOutAdmin } from '../lib/auth';

export default function SignOut() {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutAdmin();
    } catch (err) {
      console.error('Sign out failed:', err.message);
    } finally {
      navigate('/login');
    }
  };

  return (
    <DashboardLayout title="Sign Out" subtitle="">
      <div className="signout-card">
        <div className="signout-icon"><LogOut size={22} /></div>
        <div className="signout-title">Sign out of ClassRoll?</div>
        <div className="signout-body">You'll need your school email and password to sign back in.</div>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={() => navigate('/dashboard')}>Cancel</button>
          <button className="btn-danger" disabled={signingOut} onClick={confirmSignOut}>
            {signingOut ? 'Signing Out…' : 'Sign Out'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
