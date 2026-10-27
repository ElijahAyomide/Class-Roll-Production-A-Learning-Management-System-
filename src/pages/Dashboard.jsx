import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, CreditCard, FileText, ClipboardList, Search, UserPlus, Pencil, Trash2, X, ListChecks, GraduationCap, Check } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import StatCard from '../components/StatCard';
import AdminRail, { adminNameFrom } from '../components/AdminRail';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import AssignClassModal from '../components/AssignClassModal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { createStudent, updateStudent, deleteStudent } from '../lib/students';
import { createAssignments, replaceAssignments } from '../lib/assignments';
import { deductLicense } from '../lib/license';
import { buildActivity } from '../lib/activity';
import { nextUsername, studentSequence, statusLabel, statusBadgeTone, DURATION_OPTIONS } from '../data/mockData';

export default function Dashboard({ students, setStudents, questions, results, license, setLicense }) {
  const { classes: CLASSES, subjectsFor: subjectPoolForClass, studentSubjects } = useClassSetup();
  const { school, session } = useSchool();
  const navigate = useNavigate();
  const [classAssignOpen, setClassAssignOpen] = useState(false);
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
    // Compare subject names ignoring capital letters and extra spaces, so
    // "Livestock" and "livestock " are treated as the same subject.
    const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const mine = new Set(studentSubjects(assigning.student).map(norm));
    return questions.filter(q =>
      q.type === assigning.type &&
      norm(q.class) === norm(assigning.student.class) &&
      mine.has(norm(q.subject)) &&
      q.status === 'ready'
    );
  }, [assigning, questions, studentSubjects]);

  // Question sets that match the student's class and type but whose subject
  // the student doesn't take — the usual reason a subject "goes missing".
  const skippedSubjects = useMemo(() => {
    if (!assigning) return [];
    const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const mine = new Set(studentSubjects(assigning.student).map(norm));
    return [...new Set(questions
      .filter(q => q.type === assigning.type && norm(q.class) === norm(assigning.student.class) && q.status === 'ready' && !mine.has(norm(q.subject)))
      .map(q => q.subject))];
  }, [assigning, questions, studentSubjects]);

  const toggleAssignQuestion = (id) => {
    setAssignSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectedCount = assignSelectedIds.length;
  const notEnoughLicense = selectedCount > license.balance;

  const confirmAssign = async () => {
    if (selectedCount === 0 || notEnoughLicense || !assignDate) return;
    if (!Number.isInteger(assignDuration) || assignDuration < 5 || assignDuration > 600) {
      setAssignError('Enter a total time between 5 and 600 minutes.');
      return;
    }
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

  const activity = useMemo(
    () => buildActivity({ students, questions, results, license }, 40),
    [students, questions, results, license]
  );

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

  // Name shown in the greeting and the right-hand profile (saved at registration; "Admin" if none).
  const adminName = adminNameFrom(session);
  const firstName = adminName.split(' ')[0];

  // "Getting started" checklist: each step ticks itself off once it's done.
  const steps = [
    { id: 1, title: 'Add your questions', desc: 'Create a question or import your existing question list.', done: questions.length > 0, to: '/question-bank' },
    { id: 2, title: 'Add your students', desc: 'Set up classes and enrol your students.', done: students.length > 0, to: '/students' },
    { id: 3, title: 'Create a test or exam', desc: 'Choose your questions and schedule an assessment.', done: students.some(s => s.assignments.length > 0), to: null },
  ];
  const stepsDone = steps.filter(x => x.done).length;
  const firstOpen = steps.find(x => !x.done);

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">Getting started</div>
        <div className="rail-title">{stepsDone === steps.length ? "You're all set" : 'Build your first assessment'}</div>
        <div className="rail-progress-text">{stepsDone} of {steps.length} steps complete</div>
        <div className="rail-progress">
          {steps.map(st => <span key={st.id} className={st.done ? 'rail-seg rail-seg-done' : 'rail-seg'} />)}
        </div>
        <ol className="rail-steps">
          {steps.map(st => (
            <li key={st.id}>
              <button
                type="button" className="rail-step"
                onClick={() => (st.to ? navigate(st.to) : setClassAssignOpen(true))}
              >
                <span className={`rail-step-num ${st.done ? 'rail-step-num-done' : st === firstOpen ? 'rail-step-num-active' : ''}`}>
                  {st.done ? <Check size={13} /> : st.id}
                </span>
                <span>
                  <span className="rail-step-title">{st.title}</span>
                  <span className="rail-step-desc">{st.desc}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </>
    </AdminRail>
  );

  return (
    <DashboardLayout title={`Hello ${firstName}`} subtitle="Let's try something new today" rail={rail}>
      <div className="stat-grid">
        <StatCard icon={GraduationCap} label="Total Students" value={students.length} sub={`${CLASSES.length} Classes`} />
        <StatCard icon={CreditCard} label="License Balance" value={license.balance} sub="Exam credits left" tone={license.balance < 20 ? 'amber' : 'default'} />
        <StatCard icon={FileText} label="Question Bank" value={questions.length} sub={`${questions.filter(q => q.type === 'test').length} ${questions.filter(q => q.type === 'test').length === 1 ? 'test' : 'tests'} · ${questions.filter(q => q.type === 'exam').length} ${questions.filter(q => q.type === 'exam').length === 1 ? 'exam' : 'exams'}`} />
        <StatCard icon={ClipboardList} label="Results Recorded" value={results.length} sub={`${results.length} submitted`} />
      </div>

      <div className="dash-grid">
        <div className="card">
          <div className="card-label">Quick Add Student</div>
          <form onSubmit={submitAdd} className="quick-add-form">
            <div className="field">
              <label>Full name</label>
              <input type="text" placeholder="e.g. Tunde Balogun" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Class</label>
              <select value={form.class} onChange={e => setForm({ ...form, class: e.target.value, subjects: [] })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Subject combination</label>
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
            <button type="submit" className="btn-primary btn-block" disabled={addSaving}>
              <UserPlus size={16} /> {addSaving ? 'Adding…' : 'Add Student'}
            </button>
            {added && <div className="success-note">Student added successfully.</div>}
          </form>
        </div>

        <div className="col-stack">
          <div className="card">
            <div className="card-label">Find a student</div>
            <div className="field">
              <label>Full name</label>
              <div className="search-input-wrap">
                <Search size={16} className="search-input-icon" />
                <input
                  type="text" placeholder="Search a student by name or username"
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="search-input"
                />
              </div>
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
            <button type="button" className="btn-primary btn-block find-class-btn" onClick={() => setClassAssignOpen(true)}>
              Set test / exam for a whole class
            </button>
          </div>

          <div className="card">
            <div className="card-label">Recent activity</div>
            <div className="activity-list">
              {activity.length === 0 && <div className="activity-time">Nothing yet. Activity will show here as you add students, upload questions and set tests.</div>}
              {activity.map(a => (
                <div key={a.id} className="activity-row">
                  <div>
                    <div className="activity-text" title={a.text}>{a.text}</div>
                    <div className="activity-time">{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {viewingStudent && detailMode === 'view' && (
        <Modal title="Student Details" onClose={() => setViewingStudent(null)}>
          <div className="student-detail">
            <div className="student-detail-name">{viewingStudent.name}</div>
            <div className="student-detail-username">{viewingStudent.username}</div>
            <div className="student-detail-badges">
              <Badge tone="class">{viewingStudent.class}</Badge>
              <Badge tone={statusBadgeTone(viewingStudent.status)}>{statusLabel(viewingStudent.status)}</Badge>
            </div>
            <div className="field-hint" style={{ marginTop: 14, marginBottom: 6 }}>Subject combination</div>
            <div className="mini-chip-row">
              {viewingStudent.subjects.map(subj => <span key={subj} className="mini-chip">{subj}</span>)}
            </div>
            {viewingStudent.assignments.length > 0 && (
              <>
                <div className="field-hint" style={{ marginTop: 14, marginBottom: 6 }}>Current assignments</div>
                <div className="assignment-list">
                  {viewingStudent.assignments.map(a => (
                    <div key={a.id} className="assignment-row">
                      <Badge tone={a.type === 'exam' ? 'class' : 'purple'}>{a.type}</Badge>
                      <span className="cell-strong">{a.subject}</span>
                      <span className="cell-dim-sm">{a.date} · {a.durationMinutes} min total</span>
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
              <label>Full name</label>
              <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Class</label>
              <select value={editForm.class} onChange={e => setEditForm({ ...editForm, class: e.target.value, subjects: [] })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Subject combination</label>
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
              <label>Status</label>
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
              {skippedSubjects.length > 0 && (
                <p className="cell-dim-sm" style={{ marginBottom: 12 }}>
                  There are question sets for {skippedSubjects.join(', ')}, but {assigning.student.name} does not take {skippedSubjects.length === 1 ? 'that subject' : 'those subjects'}. Add {skippedSubjects.length === 1 ? 'it' : 'them'} to {assigning.student.class} in Settings → Classes &amp; Subjects, then try again.
                </p>
              )}
              <button className="btn-primary" onClick={() => navigate('/question-bank')}>
                <FileText size={14} /> Go to Question Bank
              </button>
            </div>
          ) : (
            <>
              <div className="field">
                <label>Subjects to assign</label>
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
                {skippedSubjects.length > 0 && (
                  <p className="cell-dim-sm" style={{ marginTop: 8 }}>
                    Not listed: {skippedSubjects.join(', ')} — {assigning.student.name} is not in {assigning.student.class}'s subject list. Add {skippedSubjects.length === 1 ? 'it' : 'them'} in Settings → Classes &amp; Subjects.
                  </p>
                )}
                <div className="field-hint">
                  Only showing {assigning.type === 'test' ? 'tests' : 'exams'} marked "ready" for {assigning.student.class} in a subject {assigning.student.class} takes. Select as many as you're setting today.
                </div>
              </div>

              <div className="form-row-2">
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Total time (minutes)</label>
                  <input
                    type="number" min="5" max="600" step="1" inputMode="numeric"
                    value={assignDuration}
                    onChange={e => setAssignDuration(e.target.value === '' ? '' : Math.min(600, parseInt(e.target.value) || 0))}
                  />
                  <div className="duration-chips">
                    {DURATION_OPTIONS.map(m => (
                      <button type="button" key={m} className={`duration-chip ${assignDuration === m ? 'duration-chip-active' : ''}`} onClick={() => setAssignDuration(m)}>{m}</button>
                    ))}
                  </div>
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
      {classAssignOpen && (
        <AssignClassModal
          students={students} setStudents={setStudents} questions={questions}
          license={license} setLicense={setLicense} onClose={() => setClassAssignOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}
