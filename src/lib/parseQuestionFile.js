import * as XLSX from 'xlsx';

const EXPECTED_HEADERS = ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'];

// Reads the uploaded .xlsx file and returns { items, errors }. `items` is
// ready to insert into question_items; `errors` describes exactly which
// rows are wrong and why, so the admin can fix their spreadsheet instead
// of guessing. Never throws — always resolves with whatever it found.
export function parseQuestionFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file. Please try uploading it again.'));
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames.includes('Questions') ? 'Questions' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });

        if (rows.length === 0) {
          resolve({ items: [], errors: ['The spreadsheet appears to be empty.'] });
          return;
        }

        const header = rows[0].map(h => String(h || '').trim());
        const headerMatches = EXPECTED_HEADERS.every((h, i) => header[i] === h);
        if (!headerMatches) {
          resolve({
            items: [],
            errors: [
              `The header row doesn't match the expected template. Expected columns: ${EXPECTED_HEADERS.join(', ')}. ` +
              'Please use the Assessly question template without renaming or reordering columns.',
            ],
          });
          return;
        }

        const items = [];
        const errors = [];

        rows.slice(1).forEach((row, i) => {
          const rowNum = i + 2; // spreadsheet row number, accounting for the header
          const [question, a, b, c, d, correctRaw] = row;

          const isExampleLeftover = String(question || '').startsWith('↑ Delete');
          if (isExampleLeftover) return; // silently skip the leftover instruction note, if present

          const missing = [];
          if (!question || !String(question).trim()) missing.push('Question');
          if (!a || !String(a).trim()) missing.push('Option A');
          if (!b || !String(b).trim()) missing.push('Option B');
          if (!c || !String(c).trim()) missing.push('Option C');
          if (!d || !String(d).trim()) missing.push('Option D');

          if (missing.length > 0) {
            errors.push(`Row ${rowNum}: missing ${missing.join(', ')}.`);
            return;
          }

          const correct = String(correctRaw || '').trim().toUpperCase();
          if (!['A', 'B', 'C', 'D'].includes(correct)) {
            errors.push(`Row ${rowNum}: Correct Answer must be exactly A, B, C, or D — found "${correctRaw ?? ''}".`);
            return;
          }

          items.push({
            questionText: String(question).trim(),
            optionA: String(a).trim(),
            optionB: String(b).trim(),
            optionC: String(c).trim(),
            optionD: String(d).trim(),
            correctOption: correct,
            orderIndex: items.length,
          });
        });

        resolve({ items, errors });
      } catch (err) {
        reject(new Error('This file could not be read as an Excel spreadsheet. Make sure it\'s a .xlsx file saved from the Assessly template.'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
