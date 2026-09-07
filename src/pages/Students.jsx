import React, { useMemo, useState } from 'react';
import { Search, Pencil, Trash2, UserPlus } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useSchool } from '../context/SchoolContext';
import { createStudent, updateStudent, deleteStudent } from '../lib/students';
import { CLASSES, subjectPoolForClass, nextUsername, STUDENT_STATUSES, statusLabel, statusBadgeTone } from '../data/mockData';

export default function Students({ students, setStudents }) {
  const { school } = useSchool();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [editing, setEditing] = useState(null); // student object or 'new'
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState({ name: '', class: CLASSES[0], subjects: [], status: 'pending' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchesSearch = !search.trim() ||
        s.name.toLowerCase().includes(search.trim().toLowerCase()) ||
        s.username.toLowerCase().includes(search.trim().toLowerCase());
      const matchesClass = classFilter === 'all' || s.class === classFilter;
      return matchesSearch && matchesClass;
    });
  }, [students, search, classFilter]);

  const openNew = () => {
    setForm({ name: '', class: CLASSES[0], subjects: [], status: 'pending' });
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
        const username = nextUsername(students.length, form.class, school.code);
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

  return (
    <DashboardLayout title="Students" subtitle={`${students.length} students across ${CLASSES.length} classes`}>
      <div className="card">
        <div className="toolbar">
          <div className="search-input-wrap toolbar-search">
            <Search size={15} className="search-input-icon" />
            <input
              type="text" placeholder="Search by name or username…"
              value={search} onChange={e => setSearch(e.target.value)} className="search-input"
            />
          </div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="filter-select">
            <option value="all">All classes</option>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn-primary" onClick={openNew}><UserPlus size={15} /> Add Student</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Username</th>
                <th>Class</th>
                <th>Subject Combination</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="empty-note-cell">No students match your search.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td className="cell-strong">{s.name}</td>
                  <td className="cell-mono">{s.username}</td>
                  <td><Badge tone="class">{s.class}</Badge></td>
                  <td>
                    <div className="mini-chip-row">
                      {s.subjects.slice(0, 3).map(subj => <span key={subj} className="mini-chip">{subj}</span>)}
                      {s.subjects.length > 3 && <span className="mini-chip mini-chip-more">+{s.subjects.length - 3}</span>}
                    </div>
                  </td>
                  <td><Badge tone={statusBadgeTone(s.status)}>{statusLabel(s.status)}</Badge></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit"><Pencil size={14} /></button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmDelete(s)} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </DashboardLayout>
  );
}
