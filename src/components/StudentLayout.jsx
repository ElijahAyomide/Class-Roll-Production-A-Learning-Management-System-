import React from 'react';
import { ClipboardList, LogOut, LifeBuoy } from 'lucide-react';

// Shell for the student portal. Same look as the admin shell: blue sidebar on
// the left, page title on top, white cards, and a blue card on the right.
// On tablets and phones the sidebar becomes a slim top bar and the blue card
// moves below the content.
export function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'S';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export default function StudentLayout({ title, subtitle, student, schoolName, onSignOut, rail, children }) {
  return (
    <div className="sp-shell">
      <div className="sp-mobile-bar">
        <div className="sp-mobile-brand">
          <img src="/images/assessly-logo.png" alt="" />
          <span>Assessly</span>
        </div>
        <button type="button" className="sp-mobile-signout" onClick={onSignOut} aria-label="Sign out"><LogOut size={16} /></button>
      </div>

      <aside className="sp-sidebar">
        <div className="sp-brand">
          <img src="/images/assessly-logo-white.png" alt="" className="sp-brand-logo" />
          <span className="sp-brand-name">Assessly</span>
        </div>

        <nav className="sp-nav">
          <span className="sp-nav-link sp-nav-link-active"><ClipboardList size={18} /><span>My assessments</span></span>
        </nav>

        <div className="sp-side-card">
          <div className="sp-side-who">
            <div className="sp-side-avatar">{initialsOf(student?.name)}</div>
            <div className="sp-side-text">
              <div className="sp-side-name">{student?.name}</div>
              <div className="sp-side-class">{student?.class}</div>
            </div>
          </div>
          <button type="button" className="sp-side-signout" onClick={onSignOut}><LogOut size={15} /> Sign out</button>
        </div>
      </aside>

      <main className="sp-main">
        <header className="sp-topbar">
          <div>
            <h1 className="sp-title">{title}</h1>
            {subtitle && <p className="sp-subtitle">{subtitle}</p>}
          </div>
          <div className="sp-topbar-school">{schoolName}</div>
        </header>
        <div className="sp-content">{children}</div>
        <footer className="sp-footer">
          <span>© {new Date().getFullYear()} Assessly. All rights reserved.</span>
          <span className="sp-footer-help"><LifeBuoy size={13} /> Need help? Ask your teacher or invigilator.</span>
        </footer>
      </main>

      {rail && <aside className="sp-rail">{rail}</aside>}
    </div>
  );
}
