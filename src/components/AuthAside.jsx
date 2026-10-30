import React from 'react';
import { CheckCircle2, Check, ClipboardCheck, MoreHorizontal } from 'lucide-react';

// The blue panel on the left of the sign-in and reset-password screens.
export default function AuthAside() {
  return (
    <aside className="auth-aside">
      <div className="auth-aside-brand">
        <img src="/images/assessly-logo-white.png" alt="" className="auth-aside-logo" />
        <span className="auth-aside-name">Assessly</span>
      </div>

      <div className="auth-aside-mid">
        <div className="auth-eyebrow auth-eyebrow-light">Your school. One workspace.</div>
        <h1 className="auth-aside-title">Great tests.<br />Brighter futures.</h1>
        <p className="auth-aside-sub">Bring your students, questions and results together. Spend less time managing tests and more time helping students grow.</p>

        <div className="auth-mock" aria-hidden="true">
          <div className="auth-mock-head">
            <div className="auth-mock-icon"><ClipboardCheck size={18} /></div>
            <div className="auth-mock-titles">
              <div className="auth-mock-title">Mathematics</div>
              <div className="auth-mock-sub">PRY 5 · End of term test</div>
            </div>
            <MoreHorizontal size={18} className="auth-mock-more" />
          </div>
          <div className="auth-mock-stats">
            <div><div className="auth-mock-num">32</div><div className="auth-mock-label">Students</div></div>
            <div><div className="auth-mock-num">25</div><div className="auth-mock-label">Questions</div></div>
            <div><div className="auth-mock-num">45 min</div><div className="auth-mock-label">Duration</div></div>
          </div>
          <div className="auth-mock-ready"><CheckCircle2 size={16} /> All set for your next test</div>
        </div>

        <ul className="auth-points">
          <li><Check size={14} /> Manage students</li>
          <li><Check size={14} /> Build question banks</li>
          <li><Check size={14} /> Track results</li>
        </ul>
      </div>

      <div className="auth-aside-foot">© {new Date().getFullYear()} Assessly. All rights reserved.</div>
    </aside>
  );
}
