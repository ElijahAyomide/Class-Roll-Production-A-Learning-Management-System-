import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Search, Pencil, Trash2, Plus, Upload, Download, Users, MoreHorizontal, ChevronDown, Check, GraduationCap, UserCheck } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import AdminRail from '../components/AdminRail';
import Modal from '../components/Modal';
import StudentImportModal from '../components/StudentImportModal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { useScrollHandoff } from '../lib/useScrollHandoff';
import { createStudent, updateStudent, deleteStudent } from '../lib/students';
import { nextUsername, studentSequence, STUDENT_STATUSES, statusLabel, statusBadgeTone } from '../data/mockData';

export default function Students({ students, setStudents, questions = [], license, setLicense }) {
  const { classes: CLASSES, subjectsFor: subjectPoolForClass } = useClassSetup();
  const { school } = useSchool();
  const cardRef = useRef(null);
  useScrollHandoff(cardRef);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [menuFor, setMenuFor] = useState(null); // student id whose "..." menu is open
  const [editing, setEditing] = useState(null); // student object or 'new'
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ name: '', class: CLASSES[0] || '', subjects: [], status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = !search.trim() ||
        s.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        s.username.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClass = classFilter === 'all' || s.class === classFilter;
      const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, search, classFilter, statusFilter]);

  const changeFilter = (setter) => (e) => setter(e.target.value);

  // Downloads everyone matching the current filters.
  const exportRoster = () => {
    const list = filtered;
    const rows = list.map(s => ({
      'Student name': s.name, Class: s.class, Username: s.username,
      Subjects: s.subjects.join(', '), Status: statusLabel(s.status),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, `${(school.name || 'school').replace(/[^a-z0-9]+/gi, '-')}-student-roster.xlsx`);
  };

  const openNew = () => {
    setForm({ name: '', class: CLASSES[0] || '', subjects: [], status: 'pending' });
    setError('');
    setEditing('new');
  };

  const openEdit = (student) => {
    setForm({ name: student.name, class: student.class, subjects: student.subjects, status: student.status });
    setError('');
    setEditing(student);
  };

  const toggleSubject = (subj) => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(subj) ? f.subjects.filter(s => s !== subj) : [...f.subjects, subj],
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.subjects.length === 0) return;
    setSaving(true);
    setError('');
    try {
      if (editing === 'new') {
        const username = nextUsername(studentSequence(students), form.class, school.code);
        const surname = form.name.trim().split(' ').slice(-1)[0];
        const saved = await createStudent(school.id, {
          name: form.name.trim(), username, surname,
          class: form.class, subjects: form.subjects, status: form.status,
        });
        setStudents(prev => [...prev, saved]);
      } else {
        const saved = await updateStudent(editing.id, {
          name: form.name.trim(), class: form.class, subjects: form.subjects, status: form.status,
        });
        setStudents(prev => prev.map(s => s.id === editing.id ? { ...s, ...saved, assignments: s.assignments } : s));
      }
      setEditing(null);
    } catch (err) {
      setError(err.message || 'Something went wrong saving this student. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await deleteStudent(confirmDelete.id);
      setStudents(prev => prev.filter(s => s.id !== confirmDelete.id));
    } catch (err) {
      setError(err.message || 'Could not remove this student. Please try again.');
    } finally {
      setConfirmDelete(null);
    }
  };

  const subjectPool = subjectPoolForClass(form.class);
  const classOptions = [...new Set([...CLASSES, ...students.map(s => s.class)])];

  const activeCount = students.filter(s => s.status !== 'suspended').length;
  const focusClass = classFilter !== 'all' ? classFilter : null;
  const inFocusClass = focusClass ? students.filter(s => s.class === focusClass).length : 0;
  const initials = (name) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">{school.name}</div>
        <div className="rail-title">A class ready to learn</div>
        <p className="rail-lead">Keep student details organised before your next assessment.</p>
        <ul className="rail-checks">
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">{focusClass ? `${inFocusClass} students in ${focusClass}` : `${students.length} students enrolled`}</span>
              <span className="rail-step-desc">{focusClass ? 'Showing this class in the roster.' : 'Across all your classes.'}</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Import your class list</span>
              <span className="rail-step-desc">Use an Excel file to add students in one go.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Keep details up to date</span>
              <span className="rail-step-desc">Edit a student to update their class or subjects.</span>
            </span>
          </li>
        </ul>
      </>
    </AdminRail>
  );

  return (
    <DashboardLayout rail={rail} flush>
      <div className="page-panel" onClick={() => setMenuFor(null)}>
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Students</h2>
            <p className="panel-sub">Manage your students and keep every class assessment-ready.</p>
          </div>
          <div className="panel-actions">
            <button className="btn-ghost" onClick={() => setImporting(true)}><Upload size={15} /> Import Excel</button>
            <button className="btn-primary" onClick={openNew}><Plus size={15} /> Add student</button>
          </div>
        </div>

        <div className="stat-grid stat-grid-3">
          <div className="stat-card"><div className="stat-card-icon"><Users size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{students.length}</div><div className="stat-card-label">Total students</div><div className="stat-card-sub">Across {classOptions.length} {classOptions.length === 1 ? 'class' : 'classes'}</div></div></div>
          <div className="stat-card"><div className="stat-card-icon"><GraduationCap size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{focusClass ? inFocusClass : classOptions.length}</div>
            <div className="stat-card-label">{focusClass ? `Students in ${focusClass}` : 'Classes'}</div>
            <div className="stat-card-sub">{focusClass ? 'Selected class' : 'With students enrolled'}</div></div></div>
          <div className="stat-card"><div className="stat-card-icon"><UserCheck size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{activeCount}</div><div className="stat-card-label">Active students</div><div className="stat-card-sub">Ready to take assessments</div></div></div>
        </div>

        <div className="card roster-card" ref={cardRef}>
          <div className="roster-head">
            <div className="roster-title">Student roster <span className="count-pill">{filtered.length} {filtered.length === 1 ? 'student' : 'students'}</span></div>
            <button className="btn-ghost" onClick={exportRoster}><Download size={15} /> Export roster</button>
          </div>

          <div className="roster-filters">
            <div className="search-input-wrap roster-search">
              <Search size={16} className="search-input-icon" />
              <input
                type="text" placeholder="Search by name or username"
                value={search} onChange={e => setSearch(e.target.value)} className="search-input"
              />
            </div>
            <label className="select-pill">
              <select value={classFilter} onChange={changeFilter(setClassFilter)}>
                <option value="all">All classes</option>
                {classOptions.map(c => <option key={c} value={c}>Class: {c}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="select-pill">
              <select value={statusFilter} onChange={changeFilter(setStatusFilter)}>
                <option value="all">All statuses</option>
                {STUDENT_STATUSES.map(st => <option key={st} value={st}>{statusLabel(st)}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <div className="roster-filters-end">
              <span className="roster-classes">{classOptions.length} {classOptions.length === 1 ? 'class' : 'classes'}</span>
              <button className="btn-ghost btn-ghost-blue" onClick={() => navigate('/settings')}>Manage classes</button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table roster-table">
              <thead>
                <tr>
                  <th>Student name</th>
                  <th>Class</th>
                  <th>Username</th>
                  <th>Subjects</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="empty-note-cell">{students.length === 0 ? 'No students yet. Add one or import an Excel file.' : 'No students match your search.'}</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="student-cell">
                        <span className="student-avatar">{initials(s.name)}</span>
                        <span className="cell-strong">{s.name}</span>
                      </div>
                    </td>
                    <td>{s.class}</td>
                    <td className="cell-mono">{s.username}</td>
                    <td>{s.subjects.length} {s.subjects.length === 1 ? 'subject' : 'subjects'}</td>
                    <td><Badge tone={statusBadgeTone(s.status)}>{statusLabel(s.status)}</Badge></td>
                    <td>
                      <div className="row-actions row-actions-menu" onClick={e => e.stopPropagation()}>
                        <button className="link-btn" onClick={() => openEdit(s)}>View profile</button>
                        <button className="icon-btn icon-btn-plain" onClick={() => setMenuFor(menuFor === s.id ? null : s.id)} aria-label="More actions"><MoreHorizontal size={16} /></button>
                        {menuFor === s.id && (
                          <div className="row-menu">
                            <button onClick={() => { setMenuFor(null); openEdit(s); }}><Pencil size={13} /> Edit</button>
                            <button className="row-menu-danger" onClick={() => { setMenuFor(null); setConfirmDelete(s); }}><Trash2 size={13} /> Remove</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="roster-foot">
            <span className="roster-showing">
              {filtered.length === 0 ? 'No students to show' : `Showing all ${filtered.length} ${filtered.length === 1 ? 'student' : 'students'} · scroll the list to see more`}
            </span>
          </div>
        </div>
      </div>

      <div className="page-footer">
        <span>{school.name}</span>
        <span>© {new Date().getFullYear()} Assessly</span>
      </div>

      {editing && (
        <Modal title={editing === 'new' ? 'Add Student' : 'Edit Student'} onClose={() => setEditing(null)}>
          <form onSubmit={save} className="quick-add-form">
            <div className="field">
              <label>FULL NAME</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>CLASS</label>
              <select value={form.class} onChange={e => setForm({ ...form, class: e.target.value, subjects: [] })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>SUBJECT COMBINATION</label>
              <div className="subject-chips">
                {subjectPool.length === 0 && <span className="field-hint">{CLASSES.length === 0 ? 'No classes yet.' : 'No subjects set for this class yet.'} <a href="/settings">Set them up in Settings</a>.</span>}
                {subjectPool.map(subj => (
                  <button
                    type="button" key={subj}
                    className={`subject-chip ${form.subjects.includes(subj) ? 'subject-chip-active' : ''}`}
                    onClick={() => toggleSubject(subj)}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>STATUS</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STUDENT_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
              <div className="field-hint">Test Active / Exam Active are normally set automatically from the Dashboard's "Set Test" / "Set Exam" buttons — changing it here overrides that manually.</div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Add Student' : 'Save Changes'}
            </button>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Remove student?" onClose={() => setConfirmDelete(null)} width={380}>
          <p className="confirm-text">
            This removes <b>{confirmDelete.name}</b> ({confirmDelete.username}) and can't be undone. Their past results will stay on record.
          </p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={doDelete}>Remove Student</button>
          </div>
        </Modal>
      )}
      {importing && (
        <StudentImportModal
          students={students}
          onImported={(saved) => setStudents(prev => [...prev, ...saved.map(st => ({ ...st, assignments: [] }))])}
          onClose={() => setImporting(false)}
        />
      )}
    </DashboardLayout>
  );
}
