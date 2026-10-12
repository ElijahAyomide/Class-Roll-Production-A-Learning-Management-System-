import React, { useState } from 'react';
import { Pencil, Trash2, Plus, X, Check, Wand2 } from 'lucide-react';
import { useSchool } from '../context/SchoolContext';
import { useClassSetup } from '../context/ClassSetupContext';
import {
  createClass, updateClassSubjects, renameClass, deleteClass, seedTemplateClasses, cleanSubjects,
} from '../lib/classes';

// Lets a school build its own list of classes, and choose which subjects
// each class takes. Everything else in the app (adding students, uploading
// questions, setting tests) reads from this.
export default function ClassesSubjectsPanel() {
  const { school } = useSchool();
  const { classRows, setClassRows } = useClassSetup();

  const [newClassName, setNewClassName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [subjectDrafts, setSubjectDrafts] = useState({}); // classId -> text being typed

  const replaceRow = (updated) => setClassRows(prev => prev.map(c => (c.id === updated.id ? updated : c)));

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const addClass = (e) => {
    e.preventDefault();
    const name = newClassName.trim();
    if (!name) return;
    if (classRows.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setError(`You already have a class called ${name}.`);
      return;
    }
    run(async () => {
      const nextOrder = classRows.reduce((m, c) => Math.max(m, c.sortOrder), 0) + 1;
      const created = await createClass(school.id, name, [], nextOrder);
      setClassRows(prev => [...prev, created]);
      setNewClassName('');
    });
  };

  const useTemplate = () => run(async () => {
    const rows = await seedTemplateClasses(school.id);
    setClassRows(rows);
  });

  const addSubjects = (cls) => {
    const typed = (subjectDrafts[cls.id] || '').split(',');
    const merged = cleanSubjects([...cls.subjects, ...typed]);
    if (merged.length === cls.subjects.length) { setSubjectDrafts(d => ({ ...d, [cls.id]: '' })); return; }
    run(async () => {
      replaceRow(await updateClassSubjects(cls.id, merged));
      setSubjectDrafts(d => ({ ...d, [cls.id]: '' }));
    });
  };

  const removeSubject = (cls, subject) => run(async () => {
    replaceRow(await updateClassSubjects(cls.id, cls.subjects.filter(s => s !== subject)));
  });

  const copySubjectsFrom = (cls, sourceId) => {
    const source = classRows.find(c => c.id === sourceId);
    if (!source) return;
    run(async () => {
      replaceRow(await updateClassSubjects(cls.id, cleanSubjects([...cls.subjects, ...source.subjects])));
    });
  };

  const saveRename = (cls) => {
    const name = renameValue.trim();
    if (!name || name === cls.name) { setRenamingId(null); return; }
    run(async () => {
      await renameClass(cls.id, name);
      // Students, question sets and results were renamed in the database
      // too; reloading brings every page back in line with that.
      window.location.reload();
    });
  };

  const confirmDelete = (cls) => run(async () => {
    await deleteClass(school.id, cls);
    setClassRows(prev => prev.filter(c => c.id !== cls.id));
    setConfirmDeleteId(null);
  });

  return (
    <div className="cs-panel">
      <div className="field-hint" style={{ marginBottom: 14 }}>
        Add the classes your school has, and the subjects each class takes. When you add a student, you pick their class, then choose from that class's subjects.
      </div>

      <form onSubmit={addClass} className="cs-add-row">
        <input
          type="text" placeholder="New class name, e.g. JSS1, Primary 5, Year 10"
          value={newClassName} onChange={e => setNewClassName(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={busy || !newClassName.trim()}>
          <Plus size={15} /> Add Class
        </button>
      </form>

      {error && <div className="error-text" style={{ marginTop: 10 }}>{error}</div>}

      {classRows.length === 0 ? (
        <div className="cs-empty">
          <div className="cell-strong">No classes yet</div>
          <div className="field-hint">Add your first class above, or start from the usual Nigerian secondary school setup (JSS1–SS3 with common subjects) and edit it to fit your school.</div>
          <button type="button" className="btn-ghost" onClick={useTemplate} disabled={busy}>
            <Wand2 size={14} /> Start from JSS1–SS3 template
          </button>
        </div>
      ) : (
        <div className="cs-list">
          {classRows.map(cls => (
            <div key={cls.id} className="cs-card">
              <div className="cs-card-head">
                {renamingId === cls.id ? (
                  <div className="cs-rename">
                    <input
                      type="text" value={renameValue} autoFocus
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRename(cls); } if (e.key === 'Escape') setRenamingId(null); }}
                    />
                    <button type="button" className="cs-icon-btn" title="Save name" onClick={() => saveRename(cls)} disabled={busy}><Check size={15} /></button>
                    <button type="button" className="cs-icon-btn" title="Cancel" onClick={() => setRenamingId(null)}><X size={15} /></button>
                  </div>
                ) : (
                  <>
                    <span className="cs-class-name">{cls.name}</span>
                    <span className="cell-dim-sm">{cls.subjects.length} subject{cls.subjects.length === 1 ? '' : 's'}</span>
                    <span className="cs-spacer" />
                    <button type="button" className="cs-icon-btn" title="Rename class" onClick={() => { setRenamingId(cls.id); setRenameValue(cls.name); }}><Pencil size={14} /></button>
                    {confirmDeleteId === cls.id ? (
                      <span className="cs-confirm">
                        Delete {cls.name}?
                        <button type="button" className="btn-ghost" onClick={() => confirmDelete(cls)} disabled={busy}>Yes, delete</button>
                        <button type="button" className="btn-ghost" onClick={() => setConfirmDeleteId(null)}>Keep</button>
                      </span>
                    ) : (
                      <button type="button" className="cs-icon-btn" title="Delete class" onClick={() => { setConfirmDeleteId(cls.id); setError(''); }}><Trash2 size={14} /></button>
                    )}
                  </>
                )}
              </div>

              <div className="cs-tags">
                {cls.subjects.length === 0 && <span className="cell-dim-sm">No subjects yet — add some below.</span>}
                {cls.subjects.map(subj => (
                  <span key={subj} className="cs-tag">
                    {subj}
                    <button type="button" title={`Remove ${subj}`} onClick={() => removeSubject(cls, subj)} disabled={busy}><X size={11} /></button>
                  </span>
                ))}
              </div>

              <div className="cs-add-subject">
                <input
                  type="text" placeholder="Add subject (separate several with commas)"
                  value={subjectDrafts[cls.id] || ''}
                  onChange={e => setSubjectDrafts(d => ({ ...d, [cls.id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubjects(cls); } }}
                />
                <button type="button" className="btn-ghost" onClick={() => addSubjects(cls)} disabled={busy || !(subjectDrafts[cls.id] || '').trim()}>Add</button>
                {classRows.length > 1 && (
                  <select
                    value="" onChange={e => { copySubjectsFrom(cls, e.target.value); }}
                    disabled={busy} className="cs-copy-select"
                  >
                    <option value="">Copy subjects from…</option>
                    {classRows.filter(c => c.id !== cls.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="field-hint" style={{ marginTop: 14 }}>
        Removing a subject from a class doesn't change students who already have it. Renaming a class updates it everywhere. A class can only be deleted once it has no students or question sets.
      </div>
    </div>
  );
}
