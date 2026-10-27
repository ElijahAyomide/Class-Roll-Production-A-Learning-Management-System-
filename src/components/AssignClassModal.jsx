import React, { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import Modal from './Modal';
import { useClassSetup } from '../context/ClassSetupContext';
import { useSchool } from '../context/SchoolContext';
import { assignToClass } from '../lib/assignments';
import { deductLicense } from '../lib/license';
import { DURATION_OPTIONS } from '../data/mockData';

// Ignore capital letters and extra spaces when comparing names.
const norm = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Set a test or exam for every student of one class in a single step.
export default function AssignClassModal({ students, setStudents, questions, license, setLicense, onClose }) {
  const { classes: CLASSES, studentSubjects } = useClassSetup();
  const { school } = useSchool();

  const firstWithStudents = CLASSES.find(c => students.some(s => norm(s.class) === norm(c))) || CLASSES[0] || '';
  const [type, setType] = useState('test');
  const [cls, setCls] = useState(firstWithStudents);
  const [selectedIds, setSelectedIds] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [duration, setDuration] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [doneInfo, setDoneInfo] = useState(null);

  const classStudents = useMemo(() => students.filter(s => norm(s.class) === norm(cls)), [students, cls]);

  const available = useMemo(() => {
    return questions
      .filter(q => q.type === type && norm(q.class) === norm(cls) && q.status === 'ready')
      .map(q => ({
        ...q,
        takers: classStudents.filter(s => studentSubjects(s).some(sub => norm(sub) === norm(q.subject))).length,
      }));
  }, [questions, type, cls, classStudents, studentSubjects]);

  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const changeType = (t) => { setType(t); setSelectedIds([]); };
  const changeClass = (c) => { setCls(c); setSelectedIds([]); };

  // Who gets what: each student only receives the selected subjects they take.
  const plan = useMemo(() => {
    const chosen = available.filter(q => selectedIds.includes(q.id));
    return classStudents
      .map(s => ({
        studentId: s.id,
        items: chosen
          .filter(q => studentSubjects(s).some(sub => norm(sub) === norm(q.subject)))
          .map(q => ({ questionId: q.id, subject: q.subject })),
      }))
      .filter(p => p.items.length > 0);
  }, [available, selectedIds, classStudents, studentSubjects]);

  const credits = plan.reduce((n, p) => n + p.items.length, 0);
  const notEnough = credits > license.balance;

  // Students who already have an unfinished assignment of the same subject
  // (it will be replaced, as when assigning one student at a time).
  const replacing = useMemo(() => {
    const byStudent = new Map(classStudents.map(s => [s.id, s]));
    return plan.filter(p => {
      const st = byStudent.get(p.studentId);
      return st.assignments.some(a => !a.completed && a.type === type && p.items.some(it => it.subject === a.subject));
    }).length;
  }, [plan, classStudents, type]);

  const confirm = async () => {
    if (plan.length === 0 || notEnough || !date) return;
    if (!Number.isInteger(duration) || duration < 5 || duration > 600) {
      setError('Enter a total time between 5 and 600 minutes.');
      return;
    }
    setSaving(true); setError('');
    try {
      const created = await assignToClass(plan, type, date, duration);
      const newBalance = await deductLicense(school.id, credits);
      const status = type === 'test' ? 'test-active' : 'exam-active';
      const bySt = new Map(plan.map(p => [p.studentId, new Set(p.items.map(it => it.subject))]));
      setStudents(prev => prev.map(s => {
        const subs = bySt.get(s.id);
        if (!subs) return s;
        return {
          ...s, status,
          assignments: [
            ...s.assignments.filter(a => !(a.type === type && subs.has(a.subject) && !a.completed)),
            ...created.filter(a => a.studentId === s.id),
          ],
        };
      }));
      setLicense(prev => ({ ...prev, balance: newBalance }));
      setDoneInfo({ students: plan.length, credits });
    } catch (err) {
      setError(err.message || 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (doneInfo) {
    return (
      <Modal title="Done" onClose={onClose} width={440}>
        <p className="confirm-text">
          {type === 'test' ? 'Test' : 'Exam'} set for <b>{doneInfo.students}</b> student{doneInfo.students === 1 ? '' : 's'} in {cls}.
          {' '}{doneInfo.credits} license credit{doneInfo.credits === 1 ? '' : 's'} used.
        </p>
        <div className="confirm-actions"><button className="btn-primary" onClick={onClose}>Close</button></div>
      </Modal>
    );
  }

  return (
    <Modal title="Set test or exam for a whole class" onClose={onClose} width={520}>
      <div className="form-row-2">
        <div className="field">
          <label>Type</label>
          <select value={type} onChange={e => changeType(e.target.value)}>
            <option value="test">Test</option>
            <option value="exam">Exam</option>
          </select>
        </div>
        <div className="field">
          <label>Class</label>
          <select value={cls} onChange={e => changeClass(e.target.value)}>
            {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {classStudents.length === 0 ? (
        <p className="confirm-text">There are no students in {cls} yet.</p>
      ) : available.length === 0 ? (
        <p className="confirm-text">
          No ready {type === 'test' ? 'tests' : 'exams'} in the Question Bank for {cls} yet.
        </p>
      ) : (
        <>
          <div className="field">
            <label>Subjects to assign</label>
            <div className="assign-question-list">
              {available.map(q => (
                <label key={q.id} className="assign-question-row">
                  <input type="checkbox" checked={selectedIds.includes(q.id)} onChange={() => toggle(q.id)} />
                  <div>
                    <div className="cell-strong">{q.subject}</div>
                    <div className="cell-dim-sm">
                      {q.title} · {q.questionCount || '—'} questions · {q.takers} of {classStudents.length} students take it
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="field-hint">
              Each student gets the selected subjects that their class takes, plus any extra subjects they were registered for.
            </div>
          </div>

          <div className="form-row-2">
            <div className="field">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Total time (minutes)</label>
              <input
                type="number" min="5" max="600" step="1" inputMode="numeric" value={duration}
                onChange={e => setDuration(e.target.value === '' ? '' : Math.min(600, parseInt(e.target.value) || 0))}
              />
              <div className="duration-chips">
                {DURATION_OPTIONS.map(m => (
                  <button type="button" key={m} className={`duration-chip ${duration === m ? 'duration-chip-active' : ''}`} onClick={() => setDuration(m)}>{m}</button>
                ))}
              </div>
            </div>
          </div>

          <div className={`license-usage-note ${notEnough ? 'license-usage-note-danger' : ''}`}>
            {plan.length === 0 ? (
              <span>Select at least one subject that students in {cls} take.</span>
            ) : notEnough ? (
              <span>
                This needs <b>{credits}</b> license credits ({plan.length} student{plan.length === 1 ? '' : 's'}), but you only have <b>{license.balance}</b>. Purchase more to continue.
              </span>
            ) : (
              <span>
                This sets the {type} for <b>{plan.length}</b> student{plan.length === 1 ? '' : 's'} and uses <b>{credits}</b> license credit{credits === 1 ? '' : 's'} — {license.balance - credits} will remain.
                {replacing > 0 && <> {replacing} student{replacing === 1 ? ' has' : 's have'} an unfinished {type} in the same subject, which will be replaced.</>}
              </span>
            )}
          </div>

          {error && <div className="error-text" style={{ marginBottom: 8 }}>{error}</div>}
          <div className="confirm-actions">
            <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={confirm} disabled={saving || plan.length === 0 || notEnough || !date}>
              <Users size={14} /> {saving ? 'Setting…' : `Set for ${plan.length} student${plan.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
