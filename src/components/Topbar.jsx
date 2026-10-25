import React from 'react';
import { useSchool } from '../context/SchoolContext';

export default function Topbar({ title, subtitle }) {
  const { school } = useSchool();

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        {subtitle && <p className="topbar-subtitle">{subtitle}</p>}
      </div>
      <div className="topbar-crumb">School workspace / {school.name}</div>
    </header>
  );
}
