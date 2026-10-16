import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import Modal from './Modal';
import { fetchQuestionItems, saveQuestionSet } from '../lib/questionItems';

let keyCounter = 0;
const newKey = () => `k${++keyCounter}`;
const blankQuestion = () => ({ key: newKey(), id: null, text: '', options: ['', '', '', ''], correct: '' });

// Lets the admin fix typos, change answers, and add or remove questions in a
// set that has already been uploaded, without re-uploading the whole file.
export default function QuestionEditorModal({ set, pendingCount, onClose, onSaved }) {
  const [title, setTitle] = useState(set.title);
  const [items, setItems] = useState(null);       // null while loading
  const [deletedIds, setDeletedIds] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchQuestionItems(set.id)
      .then(rows => { if (!cancelled) setItems(rows.map(r => ({ ...r, key: newKey() }))); })
      .catch(err => { if (!cancelled) setLoadError(err.message || 'Could not load the questions.'); });
    return () => { cancelled = true; };
  }, [set.id]);

  const change = (fn) => { setItems(prev => fn(prev)); setDirty(true); setErrors([]); };
  const setField = (key, patch) => change(list => list.map(q => q.key === key ? { ...q, ...patch } : q));
  const setOption = (key, i, value) => change(list => list.map(q =>
    q.key === key ? { ...q, options: q.options.map((o, idx) => idx === i ? value : o) } : q));
  const remove = (q) => {
    if (items.length === 1) { setErrors(['A set must have at least one question. Add another before removing this one.']); return; }
    if (q.id) setDeletedIds(d => [...d, q.id]);
    change(list => list.filter(x => x.key !== q.key));
  };
  const add = () => change(list => [...list, blankQuestion()]);

  const requestClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  };

  const save = async () => {
    const problems = [];
    if (!title.trim()) problems.push('The title cannot be empty.');
    items.forEach((q, n) => {
      const missing = [];
      if (!q.text.trim()) missing.push('the question');
      q.options.forEach((o, i) => { if (!o.trim()) missing.push(`option ${'ABCD'[i]}`); });
      if (missing.length) problems.push(`Question ${n + 1}: fill in ${missing.join(', ')}.`);
      if (!['A', 'B', 'C', 'D'].includes(q.correct)) problems.push(`Question ${n + 1}: choose the correct answer.`);
    });
    if (problems.length) { setErrors(problems); return; }

    setSaving(true);
    setErrors([]);
    try {
      const cleaned = items.map(q => ({ ...q, text: q.text.trim(), options: q.options.map(o => o.trim()) }));
      const saved = await saveQuestionSet(set.id, { title: title.trim(), items: cleaned, deletedIds });
      onSaved(saved);
    } catch (err) {
      setErrors([err.message || 'Could not save your changes. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit questions: ${set.subject}, ${set.class}`} onClose={requestClose} width={780}>
      {loadError ? (
        <div className="error-text">{loadError}</div>
      ) : !items ? (
        <p className="confirm-text">Loading questions…</p>
      ) : (
        <div className="qe-wrap">
          {pendingCount > 0 && (
            <div className="qe-note">
              {pendingCount} student{pendingCount === 1 ? ' has' : 's have'} this {set.type} set but {pendingCount === 1 ? "hasn't" : "haven't"} submitted it yet. They will get the edited version. Results already recorded do not change.
            </div>
          )}
          <div className="field">
            <label>TITLE</label>
            <input type="text" value={title} onChange={e => { setTitle(e.target.value); setDirty(true); setErrors([]); }} />
          </div>

          <div className="qe-list">
            {items.map((q, n) => (
              <div key={q.key} className="qe-card">
                <div className="qe-card-head">
                  <b>Question {n + 1}</b>
                  <button type="button" className="icon-btn icon-btn-danger" onClick={() => remove(q)} aria-label={`Delete question ${n + 1}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  className="qe-text" rows={2} value={q.text} placeholder="Type the question"
                  onChange={e => setField(q.key, { text: e.target.value })}
                />
                {q.options.map((o, i) => (
                  <label key={i} className={`qe-option ${q.correct === 'ABCD'[i] ? 'qe-option-correct' : ''}`}>
                    <input
                      type="radio" name={`correct-${q.key}`} checked={q.correct === 'ABCD'[i]}
                      onChange={() => setField(q.key, { correct: 'ABCD'[i] })}
                      aria-label={`Mark option ${'ABCD'[i]} as the correct answer`}
                    />
                    <span className="qe-letter">{'ABCD'[i]}</span>
                    <input type="text" value={o} placeholder={`Option ${'ABCD'[i]}`} onChange={e => setOption(q.key, i, e.target.value)} />
                  </label>
                ))}
                <div className="field-hint">The selected circle marks the correct answer.</div>
              </div>
            ))}
          </div>

          <button type="button" className="btn-ghost" onClick={add}><Plus size={14} /> Add a question</button>

          {errors.length > 0 && (
            <div className="error-text">
              <ul className="upload-error-list">
                {errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                {errors.length > 8 && <li>…and {errors.length - 8} more.</li>}
              </ul>
            </div>
          )}

          <div className="qe-footer">
            <span className="field-hint">{items.length} question{items.length === 1 ? '' : 's'}</span>
            <div className="confirm-actions" style={{ margin: 0 }}>
              <button type="button" className="btn-ghost" onClick={requestClose}>Cancel</button>
              <button type="button" className="btn-primary" disabled={saving || !dirty} onClick={save}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
