import React, { useMemo, useState } from 'react';
import { Search, Printer } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import { CLASSES } from '../data/mockData';

const gradeTone = (grade) => {
  if (grade === 'A') return 'green';
  if (grade === 'B') return 'class';
  if (grade === 'C') return 'amber';
  return 'red';
};

export default function Results({ results }) {
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const filtered = useMemo(() => {
    return results.filter(r => {
      const matchesSearch = !search.trim() ||
        r.studentName.toLowerCase().includes(search.trim().toLowerCase()) ||
        r.username.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClass = classFilter === 'all' || r.class === classFilter;
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesClass && matchesType;
    });
  }, [results, search, classFilter, typeFilter]);

  return (
    <DashboardLayout title="Results" subtitle="Results appear here the moment a student submits their test or exam">
      <div className="card">
        <div className="toolbar">
          <div className="search-input-wrap toolbar-search">
            <Search size={15} className="search-input-icon" />
            <input
              type="text" placeholder="Search by student name or username…"
              value={search} onChange={e => setSearch(e.target.value)} className="search-input"
            />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="filter-select">
            <option value="all">Tests & Exams</option>
            <option value="test">Tests only</option>
            <option value="exam">Exams only</option>
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="filter-select">
            <option value="all">All classes</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print All</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Title</th>
                <th>Score</th>
                <th>Grade</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-note-cell">No results match your search yet.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.id}>
                  <td>
                    <div className="cell-strong">{r.studentName}</div>
                    <div className="cell-mono cell-dim-sm">{r.username}</div>
                  </td>
                  <td><Badge tone="class">{r.class}</Badge></td>
                  <td>{r.subject}</td>
                  <td><Badge tone={r.type === 'exam' ? 'class' : 'purple'}>{r.type}</Badge></td>
                  <td className="cell-dim">{r.exam}</td>
                  <td className="cell-strong">{r.score}/{r.total}</td>
                  <td><Badge tone={gradeTone(r.grade)}>{r.grade}</Badge></td>
                  <td className="cell-dim">{r.date}</td>
                  <td>
                    <button className="icon-btn" onClick={() => window.print()} aria-label="Print"><Printer size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
