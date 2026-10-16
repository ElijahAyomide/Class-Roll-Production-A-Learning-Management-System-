import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Search, Printer, FileDown, FileText } from 'lucide-react';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import { percentOf } from '../lib/resultStats';
import ResultsPrintSheet from '../components/ResultsPrintSheet';

export default function Results({ results }) {
  const { school } = useSchool();
  const { classes: CLASSES } = useClassSetup();
  const classOptions = [...new Set([...CLASSES, ...results.map(r => r.class)])];
  const subjectOptions = [...new Set(results.map(r => r.subject))].sort();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [printJob, setPrintJob] = useState(null);

  const filtered = useMemo(() => {
    const list = results.filter(r => {
      const matchesSearch = !search.trim() ||
        r.studentName.toLowerCase().includes(search.trim().toLowerCase()) ||
        r.username.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClass = classFilter === 'all' || r.class === classFilter;
      const matchesSubject = subjectFilter === 'all' || r.subject === subjectFilter;
      const matchesType = typeFilter === 'all' || r.type === typeFilter;
      return matchesSearch && matchesClass && matchesSubject && matchesType;
    });
    if (sortBy === 'name') return [...list].sort((a, b) => a.studentName.localeCompare(b.studentName));
    if (sortBy === 'score') return [...list].sort((a, b) => percentOf(b) - percentOf(a));
    return list; // newest first, as loaded
  }, [results, search, classFilter, subjectFilter, typeFilter, sortBy]);

  // A plain-English line describing what's being printed, e.g.
  // "Class: JSS1 · Subject: Mathematics · Exams only".
  const filterSummary = [
    classFilter !== 'all' ? `Class: ${classFilter}` : 'All classes',
    subjectFilter !== 'all' ? `Subject: ${subjectFilter}` : 'All subjects',
    typeFilter === 'test' ? 'Tests only' : typeFilter === 'exam' ? 'Exams only' : 'Tests & exams',
    search.trim() ? `Search: "${search.trim()}"` : null,
  ].filter(Boolean).join(' · ');

  // Prints after the print sheet has been drawn, then clears the job.
  useEffect(() => {
    if (!printJob) return;
    const t = setTimeout(() => window.print(), 120);
    const done = () => setPrintJob(null);
    window.addEventListener('afterprint', done);
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printJob]);

  const startPrint = (job) => setPrintJob({ ...job, key: Date.now() });

  const exportExcel = () => {
    const rows = filtered.map((r, i) => ({
      '#': i + 1, Student: r.studentName, Username: r.username, Class: r.class, Subject: r.subject,
      Type: r.type, Title: r.exam, Date: r.date, Score: r.score, Total: r.total,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 7 }, { wch: 7 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Results');
    XLSX.writeFile(wb, `classroll-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasRows = filtered.length > 0;

  return (
    <>
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
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="filter-select">
              <option value="all">All subjects</option>
              {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select" aria-label="Sort results">
              <option value="newest">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="score">Highest score</option>
            </select>
          </div>
          <div className="toolbar" style={{ paddingTop: 0 }}>
            <button className="btn-ghost" disabled={!hasRows} onClick={() => startPrint({ kind: 'report' })}>
              <Printer size={15} /> Print Report
            </button>
            <button className="btn-ghost" disabled={!hasRows} onClick={() => startPrint({ kind: 'slips' })}>
              <FileText size={15} /> Print Result Slips
            </button>
            <button className="btn-ghost" disabled={!hasRows} onClick={exportExcel}>
              <FileDown size={15} /> Export to Excel
            </button>
            <span className="field-hint" style={{ margin: 0 }}>
              {filtered.length} result{filtered.length === 1 ? '' : 's'} — printing and export use the filters above.
            </span>
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
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="empty-note-cell">No results match your search yet.</td></tr>
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
                    <td className="cell-dim">{r.date}</td>
                    <td>
                      <button
                        className="icon-btn" title="Print this student's result slip" aria-label="Print result slip"
                        onClick={() => startPrint({ kind: 'slip', username: r.username })}
                      >
                        <Printer size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>

      <ResultsPrintSheet school={school} job={printJob} rows={filtered} filterSummary={filterSummary} />
    </>
  );
}
