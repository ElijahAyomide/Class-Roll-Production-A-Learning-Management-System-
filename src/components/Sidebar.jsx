import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, FileText, ClipboardCheck,
  CreditCard, Settings as SettingsIcon, LogOut,
} from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/question-bank', label: 'Question Bank', icon: FileText },
  { to: '/results', label: 'Results', icon: ClipboardCheck },
  { to: '/license', label: 'License', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Sidebar() {
  const { school } = useSchool();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">CR</div>
        <div className="brand-text">
          <div className="brand-name">ClassRoll</div>
          <div className="brand-sub">{school.name}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <NavLink to="/sign-out" className="sidebar-link sidebar-link-signout">
          <LogOut size={17} />
          <span>Sign Out</span>
        </NavLink>
      </div>
    </aside>
  );
}
