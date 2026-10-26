import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, GraduationCap, FileText, ClipboardList,
  CreditCard, Settings as SettingsIcon, ChevronLeft,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { to: '/students', label: 'Students', icon: GraduationCap },
  { to: '/question-bank', label: 'Question Bank', icon: FileText },
  { to: '/results', label: 'Results', icon: ClipboardList },
  { to: '/license', label: 'License', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar({ open = false, onToggleCollapse, onNavigate }) {
  const navigate = useNavigate();

  return (
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <img src="/images/assessly-logo-white.png" alt="" className="sidebar-logo" />
        <span className="sidebar-brand-name">Assessly</span>
        <button type="button" className="sidebar-collapse-btn" onClick={onToggleCollapse} aria-label="Collapse or expand sidebar"><ChevronLeft size={16} /></button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-upgrade">
        <div className="sidebar-upgrade-title">Upgrade to Premium</div>
        <p>Access to AI agent to generate question and upload to Question bank</p>
        <button type="button" onClick={() => navigate('/license')}>Continue to Payment</button>
      </div>
    </aside>
  );
}
