import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ title, subtitle, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title={title} subtitle={subtitle} />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
