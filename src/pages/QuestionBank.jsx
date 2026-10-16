import React, { useMemo, useState } from 'react';
import { Upload, Trash2, Pencil, FileText, File as FileIcon, Download } from 'lucide-react';
import QuestionEditorModal from '../components/QuestionEditorModal';
import DashboardLayout from '../components/DashboardLayout';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { createQuestion, deleteQuestion } from '../lib/questions';
import { createQuestionItems } from '../lib/questionItems';
import { parseQuestionFile } from '../lib/parseQuestionFile';

const DEFAULT_TITLES = { test: 'Mid-Term Test', exam: 'First Term Examination' };

export default function QuestionBank({ questions, setQuestions, students = [] }) {
  const { classes: CLASSES, subjectsFor: subjectPoolForClass } = useClassSetup();
  const { school } = useSchool();
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null);

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
      return matchesClass && matchesSubject && matchesType;
    });
  }, [questions, classFilter, subjectFilter, typeFilter]);

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

  return (
    <DashboardLayout title="Question Bank" subtitle="Upload and manage test and exam questions by class and subject">
      <div className="card">
        <div className="toolbar">
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
            {allSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setUploading(true)}><Upload size={15} /> Upload Questions</button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Subject</th>
                <th>Class</th>
                <th>File</th>
                <th>Questions</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="empty-note-cell">No questions match this filter.</td></tr>
              ) : filtered.map(q => (
                <tr key={q.id}>
                  <td className="cell-strong">{q.title}</td>
                  <td><Badge tone={q.type === 'exam' ? 'class' : 'purple'}>{q.type}</Badge></td>
                  <td>{q.subject}</td>
                  <td><Badge tone="class">{q.class}</Badge></td>
                  <td>
                    <div className="file-chip">
                      {q.fileType === 'pdf' ? <FileText size={13} /> : <FileIcon size={13} />}
                      <span>{q.fileName}</span>
                    </div>
                  </td>
                  <td>{q.questionCount || '—'}</td>
                  <td className="cell-dim">{q.uploadDate}</td>
                  <td><Badge tone={q.status === 'ready' ? 'green' : 'amber'}>{q.status}</Badge></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => setEditing(q)} aria-label="Edit questions" title="Edit questions"><Pencil size={14} /></button>
                      <button className="icon-btn icon-btn-danger" onClick={() => setConfirmDelete(q)} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
