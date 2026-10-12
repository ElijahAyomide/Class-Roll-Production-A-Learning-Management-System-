import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, FileText, TrendingUp, Search, UserPlus, Pencil, Trash2, X, ListChecks, GraduationCap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { createStudent, updateStudent, deleteStudent } from '../lib/students';
import { createAssignments, replaceAssignments } from '../lib/assignments';
import { deductLicense } from '../lib/license';
import { nextUsername, studentSequence, RECENT_ACTIVITY, statusLabel, statusBadgeTone, DURATION_OPTIONS } from '../data/mockData';

const CHART_COLORS = { line: '#E4E6F0', dim: '#6B7280', bar: '#385DE9' };

export default function Dashboard({ students, setStudents, questions, results, license, setLicense }) {
  const { classes: CLASSES, subjectsFor: subjectPoolForClass } = useClassSetup();
  const { school } = useSchool();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ name: '', class: CLASSES[0] || '', subjects: [] });
  const [added, setAdded] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Viewing/editing a student found via the dashboard search box
  const [viewingStudent, setViewingStudent] = useState(null);
  const [detailMode, setDetailMode] = useState('view'); // 'view' | 'edit'
  const [editForm, setEditForm] = useState({ name: '', class: CLASSES[0] || '', subjects: [], status: 'pending' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Setting a test or exam for a student found via search
  const [assigning, setAssigning] = useState(null); // { student, type: 'test' | 'exam' }
  const [assignSelectedIds, setAssignSelectedIds] = useState([]);
  const [assignDate, setAssignDate] = useState('');
  const [assignDuration, setAssignDuration] = useState(60);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const openDetails = (student) => {
    setViewingStudent(student);
    setDetailMode('view');
  };

  const openEditMode = () => {
    setEditForm({
      name: viewingStudent.name, class: viewingStudent.class,
      subjects: viewingStudent.subjects, status: viewingStudent.status,
    });
    setDetailMode('edit');
  };

  const openEditFor = (student) => {
    setViewingStudent(student);
    setEditForm({ name: student.name, class: student.class, subjects: student.subjects, status: student.status });
    setDetailMode('edit');
  };

  const toggleEditSubject = (subj) => {
    setEditForm(f => ({
      ...f,
      subjects: f.subjects.includes(subj) ? f.subjects.filter(s => s !== subj) : [...f.subjects, subj],
    }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || editForm.subjects.length === 0) return;
    setSavingEdit(true);
    setEditError('');
    try {
      const saved = await updateStudent(viewingStudent.id, {
        name: editForm.name.trim(), class: editForm.class, subjects: editForm.subjects, status: editForm.status,
      });
      setStudents(prev => prev.map(s => s.id === viewingStudent.id ? { ...s, ...saved, assignments: s.assignments } : s));
      setViewingStudent(null);
    } catch (err) {
      setEditError(err.message || 'Could not save changes. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  };

  const doDelete = async () => {
    try {
      await deleteStudent(confirmDelete.id);
      setStudents(prev => prev.filter(s => s.id !== confirmDelete.id));
    } catch (err) {
      console.error('Failed to delete student:', err.message);
    } finally {
      setConfirmDelete(null);
      setViewingStudent(null);
    }
  };

  const openAssign = (student, type) => {
    setAssigning({ student, type });
    setAssignSelectedIds([]);
    setAssignDate(new Date().toISOString().slice(0, 10));
    setAssignDuration(60);
  };

  const assignableQuestions = useMemo(() => {
    if (!assigning) return [];
    return questions.filter(q =>
      q.type === assigning.type &&
      q.class === assigning.student.class &&
      assigning.student.subjects.includes(q.subject) &&
      q.status === 'ready'
    );
  }, [assigning, questions]);

  const toggleAssignQuestion = (id) => {
    setAssignSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedCount = assignSelectedIds.length;
  const notEnoughLicense = selectedCount > license.balance;

  const confirmAssign = async () => {
    if (selectedCount === 0 || notEnoughLicense || !assignDate) return;
    const { student, type } = assigning;
    setAssignSaving(true);
    setAssignError('');

    const newAssignmentInputs = assignSelectedIds.map(qid => {
      const q = questions.find(x => x.id === qid);
      return { studentId: student.id, questionId: qid, type, subject: q.subject, date: assignDate, durationMinutes: assignDuration };
    });
    const newSubjects = [...new Set(newAssignmentInputs.map(a => a.subject))];

    try {
      // Remove any existing not-yet-completed assignment of the same type+subject first, so we
      // never end up with duplicate rows for the same student/subject/type combination.
      await replaceAssignments(student.id, type, newSubjects);
      const createdRows = await createAssignments(newAssignmentInputs);
      const updatedStudent = await updateStudent(student.id, { status: type === 'test' ? 'test-active' : 'exam-active' });
      const newBalance = await deductLicense(school.id, selectedCount);

      setStudents(prev => prev.map(s => s.id === student.id
        ? {
          ...s,
          status: updatedStudent.status,
          assignments: [
            ...s.assignments.filter(a => !(a.type === type && newSubjects.includes(a.subject))),
            ...createdRows,
          ],
        }
        : s));
      setLicense(prev => ({ ...prev, balance: newBalance }));

      setAssigning(null);
      setViewingStudent(null);
    } catch (err) {
      setAssignError(err.message || 'Could not save this assignment. Please try again.');
    } finally {
      setAssignSaving(false);
    }
  };

  const editSubjectPool = subjectPoolForClass(editForm.class);

  const avgByClass = useMemo(() => {
    const map = {};
    results.forEach(r => {
      if (!map[r.class]) map[r.class] = { class: r.class, total: 0, count: 0 };
      map[r.class].total += r.score;
      map[r.class].count += 1;
    });
    const classList = [...new Set([...CLASSES, ...results.map(r => r.class)])];
    return classList.map(c => ({
      class: c,
      avg: map[c] ? Math.round(map[c].total / map[c].count) : 0,
    })).filter(c => c.avg > 0);
  }, [results, CLASSES]);

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)).slice(0, 5);
  }, [search, students]);

  const subjectPool = subjectPoolForClass(form.class);

  const toggleSubject = (subj) => {
    setForm(f => ({
      ...f,
      subjects: f.subjects.includes(subj) ? f.subjects.filter(s => s !== subj) : [...f.subjects, subj],
    }));
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || form.subjects.length === 0) return;
    setAddSaving(true);
    setAddError('');
    try {
      const username = nextUsername(studentSequence(students), form.class, school.code);
      const surname = form.name.trim().split(' ').slice(-1)[0];
      const saved = await createStudent(school.id, {
        name: form.name.trim(), username, surname,
        class: form.class, subjects: form.subjects, status: 'pending',
      });
      setStudents(prev => [...prev, saved]);
      setForm({ name: '', class: CLASSES[0] || '', subjects: [] });
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    } catch (err) {
      setAddError(err.message || 'Could not add this student. Please try again.');
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <DashboardLayout title="Dashboard" subtitle="Here's what's happening across your school today.">
      <div className="stat-grid">
        <StatCard icon={Users} label="Total Students" value={students.length} sub={`${CLASSES.length} classes`} />
        <StatCard icon={CreditCard} label="License Balance" value={license.balance} sub="exam credits left" tone={license.balance < 20 ? 'amber' : 'default'} />
        <StatCard icon={FileText} label="Question Bank" value={questions.length} sub={`${questions.filter(q => q.type === 'test').length} tests · ${questions.filter(q => q.type === 'exam').length} exams`} />
        <StatCard icon={TrendingUp} label="Results Recorded" value={results.length} sub="this term" />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-label">Quick add student</div>
          <form onSubmit={submitAdd} className="quick-add-form">
            <div className="field">
              <label>FULL NAME</label>
              <input type="text" placeholder="e.g. Tunde Balogun" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
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
            {form.name.trim() && (
              <div className="username-preview">
                Username will be <b>{nextUsername(studentSequence(students), form.class, school.code)}</b>
              </div>
            )}
            {addError && <div className="error-text">{addError}</div>}
            <button type="submit" className="btn-primary" disabled={addSaving}>
              <UserPlus size={15} /> {addSaving ? 'Adding…' : 'Add Student'}
            </button>
            {added && <div className="success-note">Student added successfully.</div>}
          </form>
        </div>

        <div className="col-stack">
          <div className="card">
            <div className="card-label">Find a student</div>
            <div className="search-input-wrap">
              <Search size={15} className="search-input-icon" />
              <input
                type="text" placeholder="Search by name or username…"
                value={search} onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>
            {search.trim() && (
              <div className="search-results">
                {searchResults.length === 0 ? (
                  <div className="empty-note">No student matches "{search}".</div>
                ) : searchResults.map(s => (
                  <div key={s.id} className="search-result-row search-result-row-clickable" onClick={() => openDetails(s)}>
                    <div>
                      <div className="search-result-name">{s.name}</div>
                      <div className="search-result-meta">{s.username} · {s.class}</div>
                    </div>
                    <div className="row-actions" onClick={e => e.stopPropagation()}>
                      <button className="icon-btn icon-btn-test" onClick={() => openAssign(s, 'test')} aria-label="Set Test" title="Set Test"><ListChecks size={13} /></button>
                      <button className="icon-btn icon-btn-exam" onClick={() => openAssign(s, 'exam')} aria-label="Set Exam" title="Set Exam"><GraduationCap size={13} /></button>
                      <button className="icon-btn" onClick={() => openEditFor(s)} aria-label="Edit" title="Edit"><Pencil size={13} /></button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmDelete(s)} aria-label="Delete" title="Delete"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-label">Recent activity</div>
            <div className="activity-list">
              {RECENT_ACTIVITY.map(a => (
                <div key={a.id} className="activity-row">
                  <div className="activity-dot" />
                  <div>
                    <div className="activity-text">{a.text}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {avgByClass.length > 0 && (
        <div className="card">
          <div className="card-label">Average score by class</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={avgByClass} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid stroke={CHART_COLORS.line} vertical={false} />
              <XAxis dataKey="class" tick={{ fill: CHART_COLORS.dim, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
              <YAxis tick={{ fill: CHART_COLORS.dim, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.line }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#FFFFFF', border: '1px solid #E4E6F0', borderRadius: 6, fontSize: 12 }}
                formatter={(v) => [`${v}%`, 'Average score']}
              />
              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                {avgByClass.map((c, i) => <Cell key={i} fill={CHART_COLORS.bar} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {viewingStudent && detailMode === 'view' && (
        <Modal title="Student Details" onClose={() => setViewingStudent(null)}>
          <div className="student-detail">
            <div className="student-detail-name">{viewingStudent.name}</div>
            <div className="student-detail-username">{viewingStudent.username}</div>
            <div className="student-detail-badges">
              <Badge tone="class">{viewingStudent.class}</Badge>
              <Badge tone={statusBadgeTone(viewingStudent.status)}>{statusLabel(viewingStudent.status)}</Badge>
            </div>
            <div className="field-hint" style={{ marginTop: 14, marginBottom: 6 }}>SUBJECT COMBINATION</div>
            <div className="mini-chip-row">
              {viewingStudent.subjects.map(subj => <span key={subj} className="mini-chip">{subj}</span>)}
            </div>
            {viewingStudent.assignments.length > 0 && (
              <>
                <div className="field-hint" style={{ marginTop: 14, marginBottom: 6 }}>CURRENT ASSIGNMENTS</div>
                <div className="assignment-list">
                  {viewingStudent.assignments.map(a => (
                    <div key={a.id} className="assignment-row">
                      <Badge tone={a.type === 'exam' ? 'class' : 'purple'}>{a.type}</Badge>
                      <span className="cell-strong">{a.subject}</span>
                      <span className="cell-dim-sm">{a.date} · {a.durationMinutes} min</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="detail-assign-row">
              <button className="btn-ghost" onClick={() => openAssign(viewingStudent, 'test')}><ListChecks size={13} /> Set Test</button>
              <button className="btn-ghost" onClick={() => openAssign(viewingStudent, 'exam')}><GraduationCap size={13} /> Set Exam</button>
            </div>
            <div className="confirm-actions confirm-actions-split" style={{ marginTop: 14 }}>
              <button className="btn-danger" onClick={() => setConfirmDelete(viewingStudent)}><Trash2 size={13} /> Delete</button>
              <button className="btn-primary" onClick={openEditMode}><Pencil size={13} /> Edit Details</button>
            </div>
          </div>
        </Modal>
      )}

      {viewingStudent && detailMode === 'edit' && (
        <Modal title="Edit Student" onClose={() => setViewingStudent(null)}>
          <form onSubmit={saveEdit} className="quick-add-form">
            <div className="field">
              <label>FULL NAME</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>CLASS</label>
              <select value={editForm.class} onChange={e => setEditForm({ ...editForm, class: e.target.value, subjects: [] })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>SUBJECT COMBINATION</label>
              <div className="subject-chips">
                {editSubjectPool.length === 0 && <span className="field-hint">No subjects set for this class yet. <a href="/settings">Set them up in Settings</a>.</span>}
                {editSubjectPool.map(subj => (
                  <button
                    type="button" key={subj}
                    className={`subject-chip ${editForm.subjects.includes(subj) ? 'subject-chip-active' : ''}`}
                    onClick={() => toggleEditSubject(subj)}
                  >
                    {subj}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>STATUS</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="pending">Pending</option>
                <option value="test-active">Test Active</option>
                <option value="exam-active">Exam Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
            {editError && <div className="error-text">{editError}</div>}
            <button type="submit" className="btn-primary" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
          </form>
        </Modal>
      )}

      {assigning && (
        <Modal title={`Set ${assigning.type === 'test' ? 'Test' : 'Exam'} for ${assigning.student.name}`} onClose={() => setAssigning(null)} width={480}>
          {assignableQuestions.length === 0 ? (
            <div className="assign-empty">
              <p className="confirm-text">
                No ready {assigning.type === 'test' ? 'tests' : 'exams'} in the Question Bank match {assigning.student.name}'s class ({assigning.student.class}) and subjects yet.
              </p>
              <button className="btn-primary" onClick={() => navigate('/question-bank')}>
                <FileText size={14} /> Go to Question Bank
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label>SUBJECTS TO ASSIGN</label>
                <div className="assign-question-list">
                  {assignableQuestions.map(q => (
                    <label key={q.id} className="assign-question-row">
                      <input
                        type="checkbox"
                        checked={assignSelectedIds.includes(q.id)}
                        onChange={() => toggleAssignQuestion(q.id)}
                      />
                      <div>
                        <div className="cell-strong">{q.subject}</div>
                        <div className="cell-dim-sm">{q.title} · {q.questionCount || '—'} questions</div>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="field-hint">
                  Only showing {assigning.type === 'test' ? 'tests' : 'exams'} marked "ready" for {assigning.student.class} in a subject {assigning.student.name.split(' ')[0]} takes. Select as many as you're setting today.
                </div>
              </div>

              <div className="form-row-2">
                <div className="field">
                  <label>DATE</label>
                  <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>DURATION</label>
                  <select value={assignDuration} onChange={e => setAssignDuration(parseInt(e.target.value))}>
                    {DURATION_OPTIONS.map(m => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </div>
              </div>

              <div className={`license-usage-note ${notEnoughLicense ? 'license-usage-note-danger' : ''}`}>
                {selectedCount === 0 ? (
                  <span>Select at least one subject.</span>
                ) : notEnoughLicense ? (
                  <span>
                    You've selected {selectedCount} subject{selectedCount === 1 ? '' : 's'}, but only have <b>{license.balance}</b> license credit{license.balance === 1 ? '' : 's'} left. Purchase more to continue.
                  </span>
                ) : (
                  <span>
                    This will use <b>{selectedCount}</b> license credit{selectedCount === 1 ? '' : 's'} — {license.balance - selectedCount} will remain.
                  </span>
                )}
              </div>

              {assignError && <div className="error-text" style={{ marginBottom: 8 }}>{assignError}</div>}
              <div className="confirm-actions" style={{ marginTop: 4 }}>
                {notEnoughLicense ? (
                  <>
                    <button className="btn-ghost" onClick={() => setAssigning(null)}>Cancel</button>
                    <button className="btn-primary" onClick={() => navigate('/license')}>
                      <CreditCard size={14} /> Buy License
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-ghost" onClick={() => setAssigning(null)}>Cancel</button>
                    <button className="btn-primary" disabled={selectedCount === 0 || !assignDate || assignSaving} onClick={confirmAssign}>
                      {assignSaving ? 'Saving…' : `Set ${assigning.type === 'test' ? 'Test' : 'Exam'}${selectedCount > 1 ? `s (${selectedCount})` : ''}`}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
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
