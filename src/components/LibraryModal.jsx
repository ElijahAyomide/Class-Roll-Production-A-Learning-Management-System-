import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, ArrowLeft } from 'lucide-react';
import Modal from './Modal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { fetchLibrarySubjects, createSetFromLibrary } from '../lib/library';
import { DURATION_OPTIONS } from '../data/mockData';

const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Finds the school's own subject name that matches a library subject, e.g.
// "English Language" in the library and "English" in the class.
function matchSubject(librarySubject, options) {
  const lib = norm(librarySubject);
  return options.find(o => norm(o) === lib)
    || options.find(o => lib.includes(norm(o)) || norm(o).includes(lib))
    || '';
}

// Copy a selection of ready-made practice questions into the Question Bank.
// Step 1: choose a subject. Step 2: choose topics and how many questions.
//   presetClass / presetType: set when opened from an "assign" screen (they are then fixed).
//   onCreated(set): called with the new Question Bank set.
export default function LibraryModal({ onClose, onCreated, presetClass, presetType }) {
  const { classes: CLASSES, subjectsFor } = useClassSetup();
  const { school } = useSchool();
  const [subjects, setSubjects] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [picked, setPicked] = useState(null);          // the library subject chosen in step 1
  const [topics, setTopics] = useState([]);            // topic names ticked
  const [count, setCount] = useState(40);
    const [cls, setCls] = useState(presetClass || CLASSES[0] || '');
  const [saveAs, setSaveAs] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchLibrarySubjects()
      .then(list => { if (!cancelled) setSubjects(list); })
      .catch(() => { if (!cancelled) setLoadError('Could not load the Library. Check your connection and try again.'); });
    return () => { cancelled = true; };
  }, []);

  const classSubjects = subjectsFor(cls);
  const saveAsOptions = useMemo(() => {
    if (!picked) return classSubjects;
    return classSubjects.some(s => norm(s) === norm(picked.subject)) ? classSubjects : [picked.subject, ...classSubjects];
  }, [classSubjects, picked]);

  const choose = (s) => {
    setPicked(s);
    setTopics(s.topics.map(t => t.topic));
    setCount(Math.min(40, s.total));
    setTitle(`${s.subject} practice questions`);
    setError('');
  };

  // The subject name the set is saved under follows the class chosen.
  useEffect(() => {
    if (!picked) return;
    setSaveAs(matchSubject(picked.subject, classSubjects) || picked.subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, cls]);

  const available = picked ? picked.topics.filter(t => topics.includes(t.topic)).reduce((n, t) => n + t.count, 0) : 0;
  const wanted = Math.min(Math.max(parseInt(count, 10) || 0, 0), available);

  const toggleTopic = (name) => setTopics(prev => prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]);

  const create = async () => {
    if (!picked || topics.length === 0 || wanted < 1 || !cls || !saveAs || !title.trim()) return;
    setSaving(true); setError('');
    try {
      const set = await createSetFromLibrary({
        schoolId: school.id, librarySubject: picked.subject, subject: saveAs, topics, count: wanted,
        type: 'test', cls, title: title.trim(),
      });
      onCreated && onCreated(set);
      setDone(set);
    } catch (err) {
      setError(err.message || 'Could not create the set. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Modal title="Added to your Question Bank" onClose={onClose} width={440}>
        <p className="confirm-text">
          <b>{done.title}</b> now has <b>{done.questionCount}</b> {done.questionCount === 1 ? 'question' : 'questions'} for {done.class} ({done.subject}).
          {presetClass ? ' It is selected for you below.' : ' You can set it as a test or exam from the Dashboard.'}
        </p>
        <div className="confirm-actions"><button className="btn-primary" onClick={onClose}>Done</button></div>
      </Modal>
    );
  }

  return (
    <Modal title={picked ? `Library · ${picked.subject}` : 'Question Library'} onClose={onClose} width={520}>
      {!picked ? (
        <>
          <p className="confirm-text" style={{ marginBottom: '1em' }}>
            Ready-made practice questions in the JAMB style, written for Assessly (they are not official JAMB past questions). Choose a subject, then pick the topics and how many questions you want.
          </p>
          {loadError && <div className="error-text">{loadError}</div>}
          {!subjects && !loadError && <p className="field-hint">Loading the Library…</p>}
          {subjects && subjects.length === 0 && <p className="field-hint">The Library has no questions yet.</p>}
          {subjects && subjects.length > 0 && (
            <div className="assign-question-list lib-subject-list">
              {subjects.map(s => (
                <button type="button" key={s.subject} className="lib-subject-row" onClick={() => choose(s)}>
                  <span className="lib-subject-icon"><BookOpen size={16} /></span>
                  <span className="lib-subject-text">
                    <span className="cell-strong">{s.subject}</span>
                    <span className="cell-dim-sm">{s.total} questions · {s.topics.length} topics</span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <button type="button" className="lib-back" onClick={() => setPicked(null)}><ArrowLeft size={14} /> All subjects</button>

          <div className="form-row-2">
            <div className="field">
              <label>Class</label>
              {presetClass ? (
                <input type="text" value={cls} disabled readOnly />
              ) : (
                <select value={cls} onChange={e => setCls(e.target.value)}>
                  {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          <div className="field">
            <label>Topics</label>
            <div className="lib-topic-tools">
              <button type="button" className="link-btn" onClick={() => setTopics(picked.topics.map(t => t.topic))}>Select all</button>
              <button type="button" className="link-btn" onClick={() => setTopics([])}>Clear</button>
            </div>
            <div className="assign-question-list">
              {picked.topics.map(t => (
                <label key={t.topic} className="assign-question-row">
                  <input type="checkbox" checked={topics.includes(t.topic)} onChange={() => toggleTopic(t.topic)} />
                  <div>
                    <div className="cell-strong">{t.topic}</div>
                    <div className="cell-dim-sm">{t.count} {t.count === 1 ? 'question' : 'questions'}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-row-2">
            <div className="field">
              <label>Number of questions</label>
              <input
                type="number" min="1" max={available || 1} step="1" inputMode="numeric" value={count}
                onChange={e => setCount(e.target.value === '' ? '' : Math.min(available || 1, parseInt(e.target.value, 10) || 0))}
              />
              <div className="duration-chips">
                {[10, 20, 40, 60, 100].filter(n => n < available).map(n => (
                  <button type="button" key={n} className={`duration-chip ${wanted === n ? 'duration-chip-active' : ''}`} onClick={() => setCount(n)}>{n}</button>
                ))}
                <button type="button" className={`duration-chip ${wanted === available && available > 0 ? 'duration-chip-active' : ''}`} onClick={() => setCount(available)}>All ({available})</button>
              </div>
            </div>
            <div className="field">
              <label>Save as subject</label>
              <select value={saveAs} onChange={e => setSaveAs(e.target.value)}>
                {saveAsOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="field-hint">Must be a subject of {cls || 'the class'} so students can be assigned it.</div>
            </div>
          </div>

          <div className="field">
            <label>Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
          </div>

          <div className="license-usage-note">
            {topics.length === 0
              ? <span>Tick at least one topic.</span>
              : <span>This adds <b>{wanted}</b> {wanted === 1 ? 'question' : 'questions'} from <b>{topics.length}</b> {topics.length === 1 ? 'topic' : 'topics'}, picked at random and spread across the topics. It uses no license credits until you assign it to students.</span>}
          </div>

          {error && <div className="error-text" style={{ marginBottom: '0.8em' }}>{error}</div>}
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={create} disabled={saving || topics.length === 0 || wanted < 1 || !cls || !saveAs || !title.trim()}>
              <BookOpen size={14} /> {saving ? 'Adding…' : 'Add to Question Bank'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
