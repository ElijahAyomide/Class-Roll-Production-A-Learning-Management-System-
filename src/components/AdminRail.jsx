import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

// Name saved at registration; "Admin" if none.
export function adminNameFrom(session) {
  return (session?.user?.user_metadata?.school_profile?.contactName || '').trim() || 'Admin';
}

// The right-hand column shared by admin pages: profile on top, the page's own
// content (children) in the middle, and the License Balance card at the bottom.
export default function AdminRail({ license, children }) {
  const { school, session } = useSchool();
  const navigate = useNavigate();
  const name = adminNameFrom(session);
  const balance = license?.balance ?? 0;

  return (
    <>
      <div className="rail-profile">
        {school.logo
          ? <img src={school.logo} alt={`${school.name} logo`} className="rail-avatar rail-avatar-img" />
          : <div className="rail-avatar">{name.charAt(0).toUpperCase()}</div>}
        <div className="rail-name">{name}</div>
        <div className="rail-role">School administrator</div>
      </div>

      <div className="rail-section">{children}</div>

      <div className="rail-license">
        <div className="rail-license-row"><span>License Balance</span><b>{balance}</b></div>
        <p>
          {balance > 0
            ? `You have ${balance} test credit${balance === 1 ? '' : 's'} ready to use.`
            : "You can add questions now. Get test credits when you're ready to run a test."}
        </p>
        <button type="button" onClick={() => navigate('/license')}>Continue to License payment <ArrowRight size={14} /></button>
      </div>
    </>
  );
}
