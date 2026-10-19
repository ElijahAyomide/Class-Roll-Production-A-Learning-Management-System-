import React, { useState } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import { useSchool } from '../context/SchoolContext';
import { useClassSetup } from '../context/ClassSetupContext';
import { parseStudentFile, downloadStudentTemplate, MAX_IMPORT_ROWS } from '../lib/parseStudentFile';
import { createStudents } from '../lib/students';
import { nextUsername, studentSequence } from '../data/mockData';

// Three stages: choose a file -> preview (with any problems listed) -> done.
// Nothing is saved until every row is valid and the admin confirms.
export default function StudentImportModal({ students, onImported, onClose }) {
  const { school } = useSchool();
  const { classRows } = useClassSetup();

  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState(null); // { students, errors }
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(null);

  const chooseFile = async (e) => {
    const f = e.target.files[0] || null;
    setFile(f);
    setParsed(null);
    setError('');
    if (!f) return;
    setReading(true);
    try {
      setParsed(await parseStudentFile(f, classRows));
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
    }
  };

  const confirmImport = async () => {
    if (!parsed || parsed.errors.length > 0 || parsed.students.length === 0) return;
    setSaving(true);
    setError('');
    try {
      // Usernames continue from the highest number already in use.
      const start = studentSequence(students);
      const withUsernames = parsed.students.map((st, i) => ({
        ...st,
        username: nextUsername(start + i, st.class, school.code),
      }));
      const saved = await createStudents(school.id, withUsernames);
      onImported(saved);
      setImportedCount(saved.length);
    } catch (err) {
      setError(err.message || 'Could not import these students. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (classRows.length === 0) {
    return (
      <Modal title="Import students from Excel" onClose={onClose} width={560}>
        <p className="confirm-text">
          You haven't set up any classes yet. Add your classes and their subjects first, then you can import students into them.
        </p>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          <a className="btn-primary" href="/settings" style={{ textDecoration: 'none' }}>Go to Settings</a>
        </div>
      </Modal>
    );
  }

  if (importedCount !== null) {
    return (
      <Modal title="Import complete" onClose={onClose} width={560}>
        <div className="exam-result-icon" style={{ margin: '0 auto 12px' }}><CheckCircle2 size={28} /></div>
        <p className="confirm-text" style={{ textAlign: 'center' }}>
          <b>{importedCount}</b> student{importedCount === 1 ? '' : 's'} added. Each student's username was created automatically,
          and their password is their surname (the last word of their name).
        </p>
        <div className="confirm-actions">
          <button className="btn-primary" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  const ok = parsed && parsed.errors.length === 0 && parsed.students.length > 0;
  // Show every student, with the username each one will get, so the whole
  // list can be checked (scrolling) before anything is saved.
  const startSeq = studentSequence(students);
  const previewRows = parsed ? parsed.students.map((st, i) => ({
    ...st, previewUsername: nextUsername(startSeq + i, st.class, school.code),
  })) : [];

  return (
    <Modal title="Import students from Excel" onClose={onClose} width={620}>
      <div className="quick-add-form">
        <div className="field-hint" style={{ marginTop: 0 }}>
          Add many students at once. Download the template, fill in one student per row (up to {MAX_IMPORT_ROWS}), then upload it here.
          {' '}<button type="button" className="template-download-link" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }} onClick={() => downloadStudentTemplate(classRows)}>
            <Download size={11} /> Download the template
          </button>
        </div>

        <div className="field">
          <label>STUDENT FILE (.XLSX)</label>
          <input type="file" accept=".xlsx" onChange={chooseFile} />
        </div>

        {reading && <div className="field-hint">Reading your file…</div>}
        {error && <div className="error-text">{error}</div>}

        {parsed && parsed.errors.length > 0 && (
          <div className="error-text">
            Nothing was imported — please fix these in your spreadsheet and upload it again:
            <ul className="upload-error-list">
              {parsed.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              {parsed.errors.length > 10 && <li>…and {parsed.errors.length - 10} more.</li>}
            </ul>
          </div>
        )}

        {ok && (
          <>
            <div className="success-note">
              <FileSpreadsheet size={13} style={{ verticalAlign: '-2px' }} /> {parsed.students.length} student{parsed.students.length === 1 ? '' : 's'} ready to import. Scroll the list to check everyone, then click Import:
            </div>
            <div className="import-preview">
              <table className="data-table">
                <thead>
                  <tr><th>#</th><th>Name</th><th>Username</th><th>Class</th><th>Subjects</th><th>Password</th></tr>
                </thead>
                <tbody>
                  {previewRows.map(st => (
                    <tr key={st.rowNum}>
                      <td className="cell-dim-sm">{st.rowNum - 1}</td>
                      <td className="cell-strong">{st.name}</td>
                      <td className="cell-dim-sm">{st.previewUsername}</td>
                      <td>{st.class}</td>
                      <td className="cell-dim-sm">{st.subjects.length} subject{st.subjects.length === 1 ? '' : 's'}</td>
                      <td className="cell-dim-sm">{st.surname}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="confirm-actions import-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={confirmImport} disabled={!ok || saving || !file}>
            <Upload size={15} /> {saving ? 'Importing…' : ok ? `Import ${parsed.students.length} Students` : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
