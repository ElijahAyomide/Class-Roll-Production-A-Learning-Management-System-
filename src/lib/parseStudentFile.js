import * as XLSX from 'xlsx';

export const MAX_IMPORT_ROWS = 500;
const HEADERS = ['Full Name', 'Class', 'Subjects'];

// Turns the raw rows of a spreadsheet (first row = headers) into students
// ready to save, checking every row against the school's own classes and
// subjects. Pure function (no file reading), so it's easy to test.
//   - Class must match one of the school's classes (any upper/lower case).
//   - Subjects is optional: leave it blank to give the student ALL of that
//     class's subjects. Otherwise it's a comma-separated list, and every
//     subject must be one that class takes.
// Returns { students, errors }. Nothing is saved unless errors is empty.
export function buildStudentRows(rawRows, classRows) {
  if (!rawRows || rawRows.length === 0) {
    return { students: [], errors: ['The spreadsheet appears to be empty.'] };
  }

  const header = rawRows[0].map(h => String(h || '').trim().toLowerCase());
  const nameCol = header.indexOf('full name');
  const classCol = header.indexOf('class');
  const subjectsCol = header.indexOf('subjects');
  if (nameCol === -1 || classCol === -1) {
    return {
      students: [],
      errors: [`The header row must include the columns "Full Name" and "Class" (and optionally "Subjects"). Please use the Assessly student template.`],
    };
  }

  const classByLower = new Map(classRows.map(c => [c.name.toLowerCase(), c]));
  const students = [];
  const errors = [];

  const dataRows = rawRows.slice(1).filter(r => r.some(cell => String(cell ?? '').trim() !== ''));
  if (dataRows.length === 0) return { students: [], errors: ['There are no students in this file yet.'] };
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return { students: [], errors: [`This file has ${dataRows.length} students. Please import at most ${MAX_IMPORT_ROWS} at a time — split the file into smaller ones.`] };
  }

  rawRows.slice(1).forEach((row, i) => {
    const rowNum = i + 2; // the row number the admin sees in Excel
    if (row.every(cell => String(cell ?? '').trim() === '')) return; // skip blank rows

    const name = String(row[nameCol] ?? '').trim().replace(/\s+/g, ' ');
    const className = String(row[classCol] ?? '').trim();
    const subjectsRaw = subjectsCol === -1 ? '' : String(row[subjectsCol] ?? '').trim();

    if (!name) { errors.push(`Row ${rowNum}: Full Name is missing.`); return; }
    if (!className) { errors.push(`Row ${rowNum} (${name}): Class is missing.`); return; }

    const cls = classByLower.get(className.toLowerCase());
    if (!cls) {
      errors.push(`Row ${rowNum} (${name}): "${className}" is not one of your classes. Your classes are: ${classRows.map(c => c.name).join(', ')}.`);
      return;
    }

    let subjects;
    if (!subjectsRaw) {
      if (cls.subjects.length === 0) {
        errors.push(`Row ${rowNum} (${name}): ${cls.name} has no subjects set up yet. Add them in Settings → Classes & Subjects first.`);
        return;
      }
      subjects = [...cls.subjects];
    } else {
      const classSubjectsByLower = new Map(cls.subjects.map(s => [s.toLowerCase(), s]));
      const wanted = subjectsRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      const unknown = wanted.filter(s => !classSubjectsByLower.has(s.toLowerCase()));
      if (unknown.length > 0) {
        errors.push(`Row ${rowNum} (${name}): ${cls.name} doesn't take ${unknown.join(', ')}.`);
        return;
      }
      subjects = [...new Set(wanted.map(s => classSubjectsByLower.get(s.toLowerCase())))];
    }

    students.push({
      name,
      surname: name.split(' ').slice(-1)[0],
      class: cls.name,
      subjects,
      rowNum,
    });
  });

  return { students, errors };
}

// Reads an uploaded .xlsx file and runs it through buildStudentRows.
export function parseStudentFile(file, classRows) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file. Please try again.'));
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames.includes('Students') ? 'Students' : workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false });
        resolve(buildStudentRows(rows, classRows));
      } catch {
        reject(new Error("This file couldn't be read as an Excel spreadsheet. Make sure it's a .xlsx file saved from the Assessly student template."));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Builds and downloads the student template, with example rows taken from
// the school's own classes, plus a second sheet listing every class and its
// subjects so the admin can copy names exactly.
export function downloadStudentTemplate(classRows) {
  const first = classRows[0];
  const example = first
    ? [
        ['Chinedu Okafor', first.name, ''],
        ['Aisha Bello', first.name, first.subjects.slice(0, 3).join(', ')],
      ]
    : [['Chinedu Okafor', 'JSS1', '']];

  const studentsSheet = XLSX.utils.aoa_to_sheet([HEADERS, ...example]);
  studentsSheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 60 }];

  const guide = XLSX.utils.aoa_to_sheet([
    ['Class', 'Subjects this class takes'],
    ...classRows.map(c => [c.name, c.subjects.join(', ')]),
    [],
    ['How to fill the "Students" sheet:'],
    ['• Full Name and Class are required. Class must match one of the classes above.'],
    ['• Subjects is optional. Leave it blank to give the student ALL of their class\'s subjects, or list some, separated by commas.'],
    ['• Delete the two example rows before you upload.'],
  ]);
  guide['!cols'] = [{ wch: 16 }, { wch: 100 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, studentsSheet, 'Students');
  XLSX.utils.book_append_sheet(wb, guide, 'Your Classes');
  XLSX.writeFile(wb, 'assessly-student-template.xlsx');
}
