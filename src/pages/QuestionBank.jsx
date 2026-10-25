import React, { useMemo, useState } from 'react';
import { Upload, Trash2, Pencil, FileText, File as FileIcon, Download, Search, ChevronDown, MoreHorizontal, Check, ListChecks, GraduationCap } from 'lucide-react';
import QuestionEditorModal from '../components/QuestionEditorModal';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import AdminRail from '../components/AdminRail';
import Modal from '../components/Modal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { createQuestion, deleteQuestion } from '../lib/questions';
import { createQuestionItems } from '../lib/questionItems';
import { parseQuestionFile } from '../lib/parseQuestionFile';

const DEFAULT_TITLES = { test: 'Mid-Term Test', exam: 'First Term Examination' };

export default function QuestionBank({ questions, setQuestions, students = [], license }) {
  const { classes: CLASSES, subjectsFor: subjectPoolForClass } = useClassSetup();
  const { school } = useSchool();
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [menuFor, setMenuFor] = useState(null); // set id whose "..." menu is open

  // Students who have this set assigned but haven't submitted it yet.
  const pendingFor = (q) => students.reduce(
    (n, s) => n + ((s.assignments || []).some(a => a.questionId === q.id && !a.completed) ? 1 : 0), 0);
  const [form, setForm] = useState({ type: 'test', title: DEFAULT_TITLES.test, class: CLASSES[0] || '', subject: '', file: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState([]);

  const subjectPool = subjectPoolForClass(form.class);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      const matchesClass = classFilter === 'all' || q.class === classFilter;
      const matchesSubject = subjectFilter === 'all' || q.subject === subjectFilter;
      const matchesType = typeFilter === 'all' || q.type === typeFilter;
      const term = search.trim().toLowerCase();
      const matchesSearch = !term || [q.title, q.subject, q.class, q.fileName].some(v => (v || '').toLowerCase().includes(term));
      return matchesClass && matchesSubject && matchesType && matchesSearch;
    });
  }, [questions, classFilter, subjectFilter, typeFilter, search]);

  const resetFilters = () => { setSearch(''); setClassFilter('all'); setSubjectFilter('all'); setTypeFilter('all'); };

  const allSubjects = [...new Set(questions.map(q => q.subject))];
  const classOptions = [...new Set([...CLASSES, ...questions.map(q => q.class)])];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.file) return;
    setSaving(true);
    setError('');
    setRowErrors([]);

    try {
      const { items, errors } = await parseQuestionFile(form.file);

      if (errors.length > 0) {
        setRowErrors(errors);
        setError(`Found ${errors.length} problem${errors.length === 1 ? '' : 's'} in the spreadsheet — fix these and re-upload:`);
        setSaving(false);
        return;
      }
      if (items.length === 0) {
        setError('No questions were found in this file. Make sure you filled in rows below the header on the "Questions" tab.');
        setSaving(false);
        return;
      }

      // Only reaches here once every row parsed cleanly — so the set is
      // created as "ready" immediately, with a real, accurate question count.
      const saved = await createQuestion(school.id, {
        title: form.title, subject: form.subject, class: form.class, type: form.type,
        fileName: form.file.name, questionCount: items.length, status: 'ready',
      });
      await createQuestionItems(saved.id, items);

      setQuestions(prev => [saved, ...prev]);
      setForm({ type: 'test', title: DEFAULT_TITLES.test, class: CLASSES[0] || '', subject: '', file: null });
      setUploading(false);
    } catch (err) {
      setError(err.message || 'Could not upload this question set. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await deleteQuestion(confirmDelete.id);
      setQuestions(prev => prev.filter(q => q.id !== confirmDelete.id));
    } catch (err) {
      console.error('Failed to delete question set:', err.message);
    } finally {
      setConfirmDelete(null);
    }
  };

  const totalQuestions = questions.reduce((n, q) => n + (q.questionCount || 0), 0);
  const testCount = questions.filter(q => q.type === 'test').length;
  const examCount = questions.filter(q => q.type === 'exam').length;
  const filtersOn = search.trim() || classFilter !== 'all' || subjectFilter !== 'all' || typeFilter !== 'all';
  const scopeText = [classFilter !== 'all' ? classFilter : null, subjectFilter !== 'all' ? subjectFilter : null].filter(Boolean).join(' · ');

  const rail = (
    <AdminRail license={license}>
      <>
        <div className="rail-eyebrow">{school.name}</div>
        <div className="rail-title">Better questions. Better insights.</div>
        <p className="rail-lead">Build a reusable bank for every subject and class.</p>
        <ul className="rail-checks">
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Use the Excel template</span>
              <span className="rail-step-desc">One row per question, with the correct answer marked A, B, C or D.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Review before students sit it</span>
              <span className="rail-step-desc">Open a set to check the answers and marks.</span>
            </span>
          </li>
          <li>
            <span className="rail-check"><Check size={13} /></span>
            <span>
              <span className="rail-step-title">Ready for an assessment</span>
              <span className="rail-step-desc">Set a test or exam from the Dashboard once your questions are in.</span>
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
            <h2 className="panel-title">Question Bank</h2>
            <p className="panel-sub">Upload, organise and reuse questions for every assessment.</p>
          </div>
          <div className="panel-actions">
            <a className="btn-ghost" href="/templates/classroll-question-template.xlsx" download><Download size={15} /> Download template</a>
            <button className="btn-primary" onClick={() => setUploading(true)}><Upload size={15} /> Upload questions</button>
          </div>
        </div>

        <div className="stat-grid stat-grid-3">
          <div className="stat-card"><div className="stat-card-icon"><FileText size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{totalQuestions}</div><div className="stat-card-label">Total questions</div><div className="stat-card-sub">In {questions.length} {questions.length === 1 ? 'set' : 'sets'} across {allSubjects.length} {allSubjects.length === 1 ? 'subject' : 'subjects'}</div></div></div>
          <div className="stat-card"><div className="stat-card-icon"><ListChecks size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{testCount}</div><div className="stat-card-label">Tests</div><div className="stat-card-sub">Continuous assessment sets</div></div></div>
          <div className="stat-card"><div className="stat-card-icon"><GraduationCap size={18} /></div><div className="stat-card-body">
            <div className="stat-card-value">{examCount}</div><div className="stat-card-label">Exams</div><div className="stat-card-sub">Term examination sets</div></div></div>
        </div>

        <div className="card roster-card">
          <div className="roster-head">
            <div className="roster-title">Your question sets <span className="count-pill">{filtered.length} {filtered.length === 1 ? 'set' : 'sets'}</span></div>
            {scopeText && <span className="roster-classes">{scopeText}</span>}
          </div>

          <div className="roster-filters">
            <div className="search-input-wrap roster-search">
              <Search size={16} className="search-input-icon" />
              <input type="text" placeholder="Search title, subject or file" value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
            </div>
            <label className="select-pill">
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}>
                <option value="all">All subjects</option>
                {allSubjects.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="select-pill">
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                <option value="all">All classes</option>
                {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={15} />
            </label>
            <label className="select-pill">
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">Tests &amp; exams</option>
                <option value="test">Tests only</option>
                <option value="exam">Exams only</option>
              </select>
              <ChevronDown size={15} />
            </label>
            <button className="btn-ghost btn-ghost-blue" onClick={resetFilters} disabled={!filtersOn}>Reset</button>
          </div>

          <div className="qlist">
            {filtered.length === 0 ? (
              <div className="empty-note-cell">{questions.length === 0 ? 'No questions yet. Upload your first Excel question file.' : 'No question sets match these filters.'}</div>
            ) : filtered.map(q => {
              const pending = pendingFor(q);
              return (
                <div key={q.id} className="qrow">
                  <div className="qrow-main">
                    <div className="qrow-meta">
                      <span className="qrow-type">{q.type === 'exam' ? 'Exam' : 'Test'}</span>
                      <span className="qrow-subject">{q.subject}</span>
                      <span>· {q.class}</span>
                      <span>· {q.questionCount || 0} {q.questionCount === 1 ? 'question' : 'questions'}</span>
                      {q.uploadDate && <span>· Uploaded {q.uploadDate}</span>}
                    </div>
                    <div className="qrow-title">{q.title}</div>
                    <div className="qrow-sub">
                      <span className="file-chip">{q.fileType === 'pdf' ? <FileText size={13} /> : <FileIcon size={13} />}<span>{q.fileName}</span></span>
                      {pending > 0 && <span className="qrow-pending">{pending} {pending === 1 ? 'student' : 'students'} yet to submit</span>}
                    </div>
                  </div>
                  <div className="qrow-side" onClick={e => e.stopPropagation()}>
                    <Badge tone={q.status === 'ready' ? 'green' : 'amber'}>{q.status === 'ready' ? 'Ready' : q.status}</Badge>
                    <button className="icon-btn icon-btn-plain" onClick={() => setEditing(q)} aria-label="Edit questions" title="Edit questions"><Pencil size={15} /></button>
                    <div className="row-actions-menu">
                      <button className="icon-btn icon-btn-plain" onClick={() => setMenuFor(menuFor === q.id ? null : q.id)} aria-label="More actions"><MoreHorizontal size={16} /></button>
                      {menuFor === q.id && (
                        <div className="row-menu">
                          <button onClick={() => { setMenuFor(null); setEditing(q); }}><Pencil size={13} /> Edit questions</button>
                          <button className="row-menu-danger" onClick={() => { setMenuFor(null); setConfirmDelete(q); }}><Trash2 size={13} /> Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="roster-foot">
            <span className="roster-showing">
              {filtered.length === 0 ? 'Nothing to show' : `Showing all ${filtered.length} ${filtered.length === 1 ? 'set' : 'sets'} · scroll the list to see more`}
            </span>
          </div>
        </div>
      </div>

      <div className="page-footer">
        <span>{school.name}</span>
        <span>© {new Date().getFullYear()} Assessly</span>
      </div>

      {uploading && (
        <Modal title="Upload Questions" onClose={() => setUploading(false)}>
          <form onSubmit={submit} className="quick-add-form">
            <div className="field">
              <label>TYPE</label>
              <div className="type-toggle">
                <button
                  type="button"
                  className={`type-toggle-btn ${form.type === 'test' ? 'type-toggle-btn-active' : ''}`}
                  onClick={() => setForm({ ...form, type: 'test', title: form.title === DEFAULT_TITLES.exam ? DEFAULT_TITLES.test : form.title })}
                >
                  Test
                </button>
                <button
                  type="button"
                  className={`type-toggle-btn ${form.type === 'exam' ? 'type-toggle-btn-active' : ''}`}
                  onClick={() => setForm({ ...form, type: 'exam', title: form.title === DEFAULT_TITLES.test ? DEFAULT_TITLES.exam : form.title })}
                >
                  Exam
                </button>
              </div>
              <div className="field-hint">Tests are typically shorter, informal continuous-assessment checks. Exams are formal, term-defining assessments — both use the same upload and license flow.</div>
            </div>
            <div className="field">
              <label>TITLE</label>
              <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="field">
              <label>CLASS</label>
              <select value={form.class} onChange={e => setForm({ ...form, class: e.target.value, subject: '' })}>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label>SUBJECT</label>
              <select value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}>
                <option value="">{subjectPool.length === 0 ? 'No subjects set for this class (add them in Settings)' : 'Select a subject'}</option>
                {subjectPool.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="field">
              <label>QUESTION FILE (EXCEL TEMPLATE)</label>
              <input
                type="file" accept=".xlsx"
                onChange={e => { setForm({ ...form, file: e.target.files[0] || null }); setError(''); setRowErrors([]); }}
              />
              <div className="field-hint">
                Use the ClassRoll question template — one row per question, with the correct answer marked A, B, C, or D.
                {' '}<a href="/templates/classroll-question-template.xlsx" download className="template-download-link">
                  <Download size={11} /> Download the template
                </a>
              </div>
            </div>
            {error && (
              <div className="error-text">
                {error}
                {rowErrors.length > 0 && (
                  <ul className="upload-error-list">
                    {rowErrors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                    {rowErrors.length > 8 && <li>…and {rowErrors.length - 8} more.</li>}
                  </ul>
                )}
              </div>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              <Upload size={15} /> {saving ? 'Uploading…' : 'Upload'}
            </button>
          </form>
        </Modal>
      )}

      {editing && (
        <QuestionEditorModal
          set={editing}
          pendingCount={pendingFor(editing)}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setQuestions(prev => prev.map(q => q.id === editing.id ? { ...q, title: saved.title, questionCount: saved.questionCount } : q));
            setEditing(null);
          }}
        />
      )}

      {confirmDelete && (
        <Modal title="Delete this?" onClose={() => setConfirmDelete(null)} width={380}>
          <p className="confirm-text">
            This removes <b>{confirmDelete.title}</b> ({confirmDelete.subject}, {confirmDelete.class}). Students won't be able to take this {confirmDelete.type} anymore.
          </p>
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="btn-danger" onClick={doDelete}>Delete</button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}
