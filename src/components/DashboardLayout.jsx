import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// `rail` (optional) is a right-hand column, used by the Dashboard.
export default function DashboardLayout({ title, subtitle, rail, flush, scroll, children }) {
  return (
    <div className={`app-shell ${flush && !scroll ? 'app-shell-fixed' : ''}`}>
      <Sidebar />
      <div className="app-main">
        {title && <Topbar title={title} subtitle={subtitle} />}
        <main className={`page-content ${flush ? 'page-content-flush' : ''}`}>{children}</main>
      </div>
      {rail && <aside className="app-rail">{rail}</aside>}
    </div>
  );
}
