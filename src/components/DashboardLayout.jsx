import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useSchool } from '../context/SchoolContext';
import { adminNameFrom } from './AdminRail';

const COLLAPSE_KEY = 'assessly-sidebar-collapsed';

// `rail` (optional) is the right-hand column. On tablets it becomes a card beside
// the content; on phones it becomes a bar at the bottom that opens into a sheet.
export default function DashboardLayout({ title, subtitle, rail, flush, scroll, children }) {
  const { school, session } = useSchool();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  // Close the drawer / sheet whenever you move to another page.
  useEffect(() => { setDrawerOpen(false); setRailOpen(false); }, [location.pathname]);

  const toggleCollapse = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const classes = [
    'app-shell',
    flush && !scroll ? 'app-shell-collapse' : '',
    collapsed ? 'shell-collapsed' : '',
    rail ? '' : 'shell-no-rail',
  ].filter(Boolean).join(' ');

  const name = adminNameFrom(session);

  return (
    <div className={classes}>
      <header className="mobile-bar">
        <button type="button" className="mobile-bar-btn" onClick={() => setDrawerOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        <div className="mobile-bar-brand">
          <img src="/images/assessly-logo-white.png" alt="" />
          <span>Assessly</span>
        </div>
        <div className="mobile-bar-avatar" aria-hidden="true">
          {school?.logo ? <img src={school.logo} alt="" /> : name.charAt(0).toUpperCase()}
        </div>
      </header>

      {drawerOpen && <div className="drawer-overlay" onClick={() => setDrawerOpen(false)} />}
      <Sidebar open={drawerOpen} onToggleCollapse={toggleCollapse} onNavigate={() => setDrawerOpen(false)} />

      <div className="app-main">
        {title && <Topbar title={title} subtitle={subtitle} />}
        <main className={`page-content ${flush ? 'page-content-flush' : ''}`}>{children}</main>
      </div>

      {rail && railOpen && <div className="rail-backdrop" onClick={() => setRailOpen(false)} />}
      {rail && (
        <aside className={`app-rail ${railOpen ? 'app-rail-open' : ''}`} onClick={() => { if (!railOpen) setRailOpen(true); }}>
          <button
            type="button" className="rail-toggle" aria-label={railOpen ? 'Close' : 'Open'}
            onClick={(e) => { e.stopPropagation(); setRailOpen(o => !o); }}
          ><ChevronRight size={16} /></button>
          {rail}
        </aside>
      )}
    </div>
  );
}
