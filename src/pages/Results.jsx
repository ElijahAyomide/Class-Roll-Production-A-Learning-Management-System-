import React, { useMemo, useRef, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Search, Printer, FileText, Download, ChevronDown, Check, ClipboardCheck, BarChart3, CheckCircle2, Trophy, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { deleteResults } from '../lib/results';
import { groupSittings, pctText } from '../lib/resultSittings';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { useScrollHandoff } from '../lib/useScrollHandoff';
import DashboardLayout from '../components/DashboardLayout';
import AdminRail from '../components/AdminRail';
import { percentOf, resultStats } from '../lib/resultStats';
import ResultsPrintSheet from '../components/ResultsPrintSheet';

// The calendar day (YYYY-MM-DD, Nigerian time) a result was submitted.
function resultDay(r) {
  const d = r.createdAt ? new Date(r.createdAt) : new Date(r.date);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export default function Results({ results, setResults, license }) {
  const { school } = useSchool();
  const cardRef = useRef(null);
  useScrollHandoff(cardRef);
  const { classes: CLASSES } = useClassSetup();
  const classOptions = [...new Set([...CLASSES, ...results.map(r => r.class)])];
  const subjectOptions = [...new Set(results.map(r => r.subject))].sort();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [printJob, setPrintJob] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null); // the results about to be deleted (one, or every subject of a sitting)
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const askDelete = (items) => { setDeleteError(''); setConfirmDelete(items); };
  const doDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const ids = confirmDelete.map(r => r.id);
      await deleteResults(ids);
      setResults(prev => prev.filter(r => !ids.includes(r.id)));
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err.message || 'Could not delete. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const list = results.filter(r => {
      const matchesSearch = !search.trim() ||
        r.studentName.toLowerCase().includes(search.trim().toLowerCase()) ||
        r.username.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClass = classFilter === 'all' || r.class === classFilter;
      const matchesSubject = subjectFilter === 'all' || r.subject === subjectFilter;
      let matchesDate = true;
      if (dateFrom || dateTo) {
        const day = resultDay(r);
        matchesDate = !!day && (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
      }
      return matchesSearch && matchesClass && matchesSubject && matchesDate;
    });
    if (sortBy === 'name') return [...list].sort((a, b) => a.studentName.localeCompare(b.studentName));
    if (sortBy === 'score') return [...list].sort((a, b) => percentOf(b) - percentOf(a));
    return list; // newest first, as loaded
  }, [results, search, classFilter, subjectFilter, sortBy, dateFrom, dateTo]);

  // A plain-English line describing what's being printed, e.g.
  // "Class: JSS1 · Subject: Mathematics".
  const filterSummary = [
    classFilter !== 'all' ? `Class: ${classFilter}` : 'All classes',
    subjectFilter !== 'all' ? `Subject: ${subjectFilter}` : 'All subjects',
    dateFrom || dateTo ? `Date: ${dateFrom || 'start'} to ${dateTo || 'today'}` : null,
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

  // Same layout as the page: a sheet per class for subjects taken together
  // (one column per subject, then a total), and a sheet for single-subject results.
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    wb.Props = { Title: 'Assessly results', Author: 'Assessly', Company: school.name };
    const { tables, singles: single } = groupSittings(filtered, sortBy);
    const usedNames = new Set();
    const sheetName = (base) => {
      let name = base.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Sheet';
      let n = 2;
      while (usedNames.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${n++}`;
      usedNames.add(name.toLowerCase());
      return name;
    };
    for (const t of tables) {
      const rows = t.rows.map((row, i) => {
        const out = { '#': i + 1, Student: row.studentName, Username: row.username, Class: row.class, Date: row.date };
        for (const sub of t.subjects) {
          const r = row.cells.get(sub);
          out[sub] = r ? `${r.score} / ${r.total}` : '';
        }
        out.Total = `${row.score} / ${row.max}`;
        out['Percent'] = pctText(row.pct);
        return out;
      });
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, ...t.subjects.map(() => ({ wch: 16 })), { wch: 12 }, { wch: 9 }];
      XLSX.utils.book_append_sheet(wb, sheet, sheetName(`${t.cls} - subjects together`));
    }
    if (single.length > 0 || tables.length === 0) {
      const rows = single.map((r, i) => ({
        '#': i + 1, Student: r.studentName, Username: r.username, Class: r.class, Subject: r.subject,
        Title: r.exam, Date: r.date, Score: r.score, Total: r.total,
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet['!cols'] = [{ wch: 4 }, { wch: 26 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 7 }, { wch: 7 }];
      XLSX.utils.book_append_sheet(wb, sheet, sheetName(tables.length ? 'Single subject' : 'Results'));
    }
    XLSX.writeFile(wb, `assessly-results-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const hasRows = filtered.length > 0;

  // Subjects taken together in one sitting are shown side by side (see lib/resultSittings.js).
  const { tables: sittingTables, singles } = useMemo(() => groupSittings(filtered, sortBy), [filtered, sortBy]);

  // Summary cards follow whatever filters are applied. 50% is used as the pass mark.
  const PASS_MARK = 50;
  const stats = resultStats(filtered);
  const passed = filtered.filter(r => percentOf(r) >= PASS_MARK).length;
  const below = filtered.length - passed;
  const top = filtered.reduce((best, r) => (!best || percentOf(r) > percentOf(best) ? r : best), null);
  const fmt = (n) => `${Math.round(n * 10) / 10}%`;
  const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const scopeText = [classFilter !== 'all' ? classFilter : null, subjectFilter !== 'all' ? subjectFilter : null].filter(Boolean).join(' · ');

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">{school.name}</div>
        <div className="rail-title">Turn results into progress</div>
        <p className="rail-lead">See what your students understand and where they need support.</p>
        <ul className="rail-checks">
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">{scopeText || 'All classes and subjects'}</span>
                <span className="rail-step-desc">Filters apply to the list below.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">{results.length} {results.length === 1 ? 'result' : 'results'} recorded</span>
              <span className="rail-step-desc">Results appear the moment a student submits.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Support the next step</span>
              <span className="rail-step-desc">{below > 0 ? `${below} ${below === 1 ? 'result is' : 'results are'} below the ${PASS_MARK}% pass mark.` : `Everyone shown is at or above the ${PASS_MARK}% pass mark.`}</span>
            </span>
          </li>
        </ul>
      </>
    </AdminRail>
  );

  return (
    <>
      <DashboardLayout rail={rail} flush>
        <div className="page-panel">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Results</h2>
              <p className="panel-sub">Understand performance and help every student move forward.</p>
            </div>
            <div className="panel-actions">
              <button className="btn-ghost" disabled={!hasRows} onClick={() => startPrint({ kind: 'report' })}><Printer size={15} /> Print report</button>
              <button className="btn-ghost" disabled={!hasRows} onClick={() => startPrint({ kind: 'slips' })}><FileText size={15} /> Print slips</button>
              <button className="btn-primary" disabled={!hasRows} onClick={exportExcel}><Download size={15} /> Export results</button>
            </div>
          </div>

          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card-icon"><ClipboardCheck size={18} /></div><div className="stat-card-body">
              <div className="stat-card-value">{filtered.length}</div><div className="stat-card-label">Submitted</div><div className="stat-card-sub">Results shown</div></div></div>
            <div className="stat-card"><div className="stat-card-icon"><BarChart3 size={18} /></div><div className="stat-card-body">
              <div className="stat-card-value">{fmt(stats.average)}</div><div className="stat-card-label">Average score</div><div className="stat-card-sub">Across results shown</div></div></div>
            <div className="stat-card"><div className="stat-card-icon"><CheckCircle2 size={18} /></div><div className="stat-card-body">
              <div className="stat-card-value">{filtered.length ? fmt((passed / filtered.length) * 100) : '0%'}</div><div className="stat-card-label">Pass rate</div><div className="stat-card-sub">{passed} {passed === 1 ? 'result' : 'results'} passed</div></div></div>
            <div className="stat-card"><div className="stat-card-icon"><Trophy size={18} /></div><div className="stat-card-body">
              <div className="stat-card-value">{top ? fmt(percentOf(top)) : '0%'}</div><div className="stat-card-label">Highest score</div><div className="stat-card-sub">{top ? `${top.score} out of ${top.total} marks` : 'No results yet'}</div></div></div>
          </div>

          <div className="card roster-card" ref={cardRef}>
            <div className="roster-head">
              <div className="roster-title">Student results <span className="count-pill">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span></div>
            </div>

            <div className="roster-filters">
              <div className="search-input-wrap roster-search">
                <Search size={16} className="search-input-icon" />
                <input type="text" placeholder="Search student" value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
              </div>
              <label className="select-pill">
                <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                  <option value="all">All classes</option>
                  {classOptions.map(c => <option key={c} value={c}>Class: {c}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>
              <label className="select-pill">
                <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                  <option value="all">All subjects</option>
                  {subjectOptions.map(sub => <option key={sub} value={sub}>{sub}</option>)}
                </select>
                <ChevronDown size={15} />
              </label>
              <label className="select-pill">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort results">
                  <option value="newest">Newest first</option>
                  <option value="name">Name A–Z</option>
                  <option value="score">Highest score</option>
                </select>
                <ChevronDown size={15} />
              </label>
              <div className="date-range" role="group" aria-label="Filter by date">
                <label className="select-pill date-pill"><span>From</span>
                  <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)} />
                </label>
                <label className="select-pill date-pill"><span>To</span>
                  <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)} />
                </label>
                {(dateFrom || dateTo) && <button type="button" className="link-btn" onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear dates</button>}
              </div>
            </div>

            <div className="table-wrap">
              {sittingTables.map(t => (
                <div key={t.cls} className="sitting-block">
                  <div className="sitting-head">
                    {t.cls} · subjects taken together
                    <span className="count-pill">{t.rows.length} {t.rows.length === 1 ? 'student' : 'students'}</span>
                  </div>
                  <div className="sitting-scroll">
                    <table className="data-table roster-table sitting-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Class</th>
                          {t.subjects.map(sub => <th key={sub}>{sub}</th>)}
                          <th>Total</th>
                          <th>Report</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.rows.map(row => (
                          <tr key={row.key}>
                            <td>
                              <div className="student-cell">
                                <span className="student-avatar">{initials(row.studentName)}</span>
                                <span>
                                  <span className="cell-strong">{row.studentName}</span>
                                  <span className="cell-sub">{row.username}{row.date ? ` · ${row.date}` : ''}</span>
                                </span>
                              </div>
                            </td>
                            <td>{row.class}</td>
                            {t.subjects.map(sub => {
                              const r = row.cells.get(sub);
                              return (
                                <td key={sub} data-label={sub} className="sitting-cell">
                                  {r ? (
                                    <span className="sitting-score"><b>{r.score} / {r.total}</b></span>
                                  ) : <span className="sitting-none">—</span>}
                                </td>
                              );
                            })}
                            <td className="sitting-total"><b>{row.score} / {row.max}</b><span className="cell-sub">{pctText(row.pct)}</span></td>
                            <td>
                              <div className="report-cell">
                                <button className="link-btn" onClick={() => startPrint({ kind: 'slip', username: row.username })}>View result</button>
                                <button className="row-delete" title={`Delete all ${row.items.length} results`} aria-label={`Delete all of ${row.studentName}'s results from this sitting`} onClick={() => askDelete(row.items)}><Trash2 size={15} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {(singles.length > 0 || sittingTables.length === 0) && (
                <>
                  {sittingTables.length > 0 && <div className="sitting-head">Single-subject results<span className="count-pill">{singles.length}</span></div>}
                  <table className="data-table roster-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Class</th>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {singles.length === 0 ? (
                        <tr><td colSpan={5} className="empty-note-cell">{results.length === 0 ? 'No results yet. They appear here the moment a student submits.' : 'No results match your search or filters.'}</td></tr>
                      ) : singles.map(r => (
                        <tr key={r.id}>
                          <td>
                            <div className="student-cell">
                              <span className="student-avatar">{initials(r.studentName)}</span>
                              <span>
                                <span className="cell-strong">{r.studentName}</span>
                                <span className="cell-sub">{r.username}</span>
                              </span>
                            </div>
                          </td>
                          <td>{r.class}</td>
                          <td>
                            {r.subject}
                            <span className="cell-sub">{r.exam}{r.date ? ` · ${r.date}` : ''}</span>
                          </td>
                          <td className="cell-strong">{r.score} / {r.total}</td>
                          <td>
                            <div className="report-cell">
                              <button className="link-btn" onClick={() => startPrint({ kind: 'slip', username: r.username })}>View result</button>
                              <button className="row-delete" title="Delete this result" aria-label={`Delete ${r.studentName}'s ${r.subject} result`} onClick={() => askDelete([r])}><Trash2 size={15} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            <div className="roster-foot">
              <span className="roster-showing">
                {filtered.length === 0 ? 'Nothing to show' : `Showing all ${filtered.length} ${filtered.length === 1 ? 'result' : 'results'} · scroll the list to see more`}
              </span>
            </div>
          </div>
        </div>

        <div className="page-footer">
          <span>{school.name}</span>
          <span>© {new Date().getFullYear()} Assessly</span>
        </div>
      </DashboardLayout>

      {confirmDelete && (
        <Modal title={confirmDelete.length > 1 ? 'Delete these results?' : 'Delete this result?'} onClose={() => !deleting && setConfirmDelete(null)} width={420}>
          <div className="password-confirm-summary" style={{ marginBottom: '1em' }}>
            <span>
              <b>{confirmDelete[0].studentName}</b> · {confirmDelete[0].class} {confirmDelete[0].date ? '' : ''}{confirmDelete[0].date ? ` · ${confirmDelete[0].date}` : ''}
              {confirmDelete.map(r => <React.Fragment key={r.id}><br />{r.subject}: {r.score} / {r.total}</React.Fragment>)}
            </span>
          </div>
          <p className="confirm-text">
            {confirmDelete.length > 1 ? `This removes all ${confirmDelete.length} subject results of this sitting permanently` : 'This removes the result permanently'}, and {confirmDelete.length > 1 ? 'they' : 'it'} will no longer count in your reports or averages. It does not give the student a new attempt or refund any credit.
          </p>
          {deleteError && <div className="error-text" style={{ marginBottom: '0.8em' }}>{deleteError}</div>}
          <div className="confirm-actions">
            <button className="btn-ghost" disabled={deleting} onClick={() => setConfirmDelete(null)}>Keep {confirmDelete.length > 1 ? 'results' : 'result'}</button>
            <button className="btn-danger" disabled={deleting} onClick={doDelete}>{deleting ? 'Deleting…' : confirmDelete.length > 1 ? 'Delete all' : 'Delete result'}</button>
          </div>
        </Modal>
      )}

      <ResultsPrintSheet school={school} job={printJob} rows={filtered} sortBy={sortBy} filterSummary={filterSummary} />
    </>
  );
}
