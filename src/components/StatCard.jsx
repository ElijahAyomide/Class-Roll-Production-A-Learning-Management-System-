import React from 'react';

export default function StatCard({ icon: Icon, label, value, sub, tone = 'default' }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-icon"><Icon size={16} /></div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
      </div>
    </div>
  );
}
