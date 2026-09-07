import React from 'react';
import { Bell } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';

export default function Topbar({ title, subtitle }) {
  const { school } = useSchool();

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" aria-label="Notifications">
          <Bell size={17} />
        </button>
        <div className="admin-chip">
          {school.logo ? (
            <img src={school.logo} alt={`${school.name} logo`} className="admin-avatar admin-avatar-img" />
          ) : (
            <div className="admin-avatar">{school.name.charAt(0)}</div>
          )}
          <div className="admin-chip-text">
            <div className="admin-chip-name">Admin</div>
            <div className="admin-chip-role">{school.name}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
