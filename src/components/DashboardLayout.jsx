import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// `rail` (optional) is a right-hand column, used by the Dashboard.
export default function DashboardLayout({ title, subtitle, rail, flush, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar title={title} subtitle={subtitle} />
        <main className={`page-content ${flush ? 'page-content-flush' : ''}`}>{children}</main>
      </div>
      {rail && <aside className="app-rail">{rail}</aside>}
    </div>
  );
}
