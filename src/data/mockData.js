// This file stands in for the backend for now. Every page reads from here.
// When we build the real backend in a later step, these same shapes become
// API responses — the page components won't need to change much.

export const SCHOOL = {
  name: 'Green Valley College',
  code: 'GVC',
  address: '14 Adeola Street, Ikeja, Lagos',
  email: 'admin@greenvalleycollege.edu.ng',
  phone: '+234 801 234 5678',
  state: 'Lagos',
  lga: 'Ikeja',
  logo: null, // data URL once an admin uploads one; falls back to initials avatar
};

export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
];

export const CLASSES = ['JSS1', 'JSS2', 'JSS3', 'SS1', 'SS2', 'SS3'];

export const JUNIOR_SUBJECTS = [
  'Mathematics', 'English Language', 'Basic Science', 'Basic Technology',
  'Social Studies', 'Civic Education', 'Agricultural Science', 'Business Studies',
];

export const SENIOR_SUBJECTS = {
  Science: ['Mathematics', 'English Language', 'Physics', 'Chemistry', 'Biology', 'Further Mathematics'],
  Arts: ['Mathematics', 'English Language', 'Literature', 'Government', 'History', 'CRS'],
  Commercial: ['Mathematics', 'English Language', 'Accounting', 'Commerce', 'Economics', 'Business Studies'],
};

export function subjectPoolForClass(className) {
  if (['JSS1', 'JSS2', 'JSS3'].includes(className)) return JUNIOR_SUBJECTS;
  return [...new Set(Object.values(SENIOR_SUBJECTS).flat())];
}

export function nextUsername(existingCount, className, schoolCode = SCHOOL.code) {
  const year = new Date().getFullYear();
  const seq = String(existingCount + 1).padStart(3, '0');
  return `${schoolCode}/${year}/${seq}`;
}

// A student's status reflects whether they've been set up to take anything yet:
// - pending: added, but no test or exam has been assigned
// - test-active: admin has assigned a test they can now take from their login
// - exam-active: admin has assigned an exam they can now take from their login
// - suspended: manually blocked by the admin, regardless of assignment
export const STUDENT_STATUSES = ['pending', 'test-active', 'exam-active', 'suspended'];

export function statusLabel(status) {
  const labels = { pending: 'Pending', 'test-active': 'Test Active', 'exam-active': 'Exam Active', suspended: 'Suspended' };
  return labels[status] || status;
}

export function statusBadgeTone(status) {
  const tones = { pending: 'amber', 'test-active': 'green-light', 'exam-active': 'exam-solid', suspended: 'red' };
  return tones[status] || 'default';
}

export const INITIAL_STUDENTS = [
  {
    id: 's1', name: 'Chinedu Okafor', username: 'GVC/2026/001', surname: 'Okafor', class: 'JSS1',
    subjects: JUNIOR_SUBJECTS.slice(0, 6), status: 'test-active',
    assignments: [{ id: 'a1', type: 'test', questionId: 'q6', subject: 'Mathematics', date: '2026-08-20', durationMinutes: 45, completed: false }],
  },
  {
    id: 's2', name: 'Aisha Bello', username: 'GVC/2026/002', surname: 'Bello', class: 'JSS2',
    subjects: JUNIOR_SUBJECTS.slice(0, 6), status: 'exam-active',
    assignments: [{ id: 'a2', type: 'exam', questionId: 'q3', subject: 'Basic Science', date: '2026-08-22', durationMinutes: 60, completed: false }],
  },
  {
    id: 's3', name: 'Tobiloba Ade', username: 'GVC/2026/003', surname: 'Ade', class: 'JSS3',
    subjects: JUNIOR_SUBJECTS.slice(0, 7), status: 'pending', assignments: [],
  },
  {
    id: 's4', name: 'Fatima Ibrahim', username: 'GVC/2026/004', surname: 'Ibrahim', class: 'SS1',
    subjects: SENIOR_SUBJECTS.Science, status: 'test-active',
    assignments: [{ id: 'a3', type: 'test', questionId: 'q7', subject: 'English Language', date: '2026-08-21', durationMinutes: 45, completed: false }],
  },
  {
    id: 's5', name: 'Emeka Nwosu', username: 'GVC/2026/005', surname: 'Nwosu', class: 'SS2',
    subjects: SENIOR_SUBJECTS.Science, status: 'exam-active',
    assignments: [{ id: 'a4', type: 'exam', questionId: 'q4', subject: 'Physics', date: '2026-08-23', durationMinutes: 90, completed: false }],
  },
  {
    id: 's6', name: 'Blessing Eze', username: 'GVC/2026/006', surname: 'Eze', class: 'SS2',
    subjects: SENIOR_SUBJECTS.Commercial, status: 'pending', assignments: [],
  },
  {
    id: 's7', name: 'Yusuf Abdullahi', username: 'GVC/2026/007', surname: 'Abdullahi', class: 'SS3',
    subjects: SENIOR_SUBJECTS.Arts, status: 'exam-active',
    assignments: [{ id: 'a5', type: 'exam', questionId: 'q2', subject: 'English Language', date: '2026-08-28', durationMinutes: 90, completed: false }],
  },
  {
    id: 's8', name: 'Ngozi Chukwu', username: 'GVC/2026/008', surname: 'Chukwu', class: 'SS3',
    subjects: SENIOR_SUBJECTS.Science, status: 'suspended', assignments: [],
  },
  {
    id: 's9', name: 'Oluwaseun Ajayi', username: 'GVC/2026/009', surname: 'Ajayi', class: 'JSS1',
    subjects: JUNIOR_SUBJECTS.slice(0, 6), status: 'pending', assignments: [],
  },
  {
    id: 's10', name: 'Amaka Obi', username: 'GVC/2026/010', surname: 'Obi', class: 'SS1',
    subjects: SENIOR_SUBJECTS.Commercial, status: 'pending', assignments: [],
  },
];

export const ASSESSMENT_TYPES = ['test', 'exam'];

export const INITIAL_QUESTIONS = [
  { id: 'q1', title: 'First Term Examination', subject: 'Mathematics', class: 'SS3', fileType: 'pdf', fileName: 'ss3-maths-first-term.pdf', questionCount: 40, uploadDate: '2026-08-02', status: 'ready', type: 'exam' },
  { id: 'q2', title: 'First Term Examination', subject: 'English Language', class: 'SS3', fileType: 'docx', fileName: 'ss3-english-first-term.docx', questionCount: 50, uploadDate: '2026-08-03', status: 'ready', type: 'exam' },
  { id: 'q3', title: 'First Term Examination', subject: 'Basic Science', class: 'JSS2', fileType: 'pdf', fileName: 'jss2-basic-science.pdf', questionCount: 30, uploadDate: '2026-08-05', status: 'ready', type: 'exam' },
  { id: 'q4', title: 'First Term Examination', subject: 'Physics', class: 'SS2', fileType: 'pdf', fileName: 'ss2-physics-first-term.pdf', questionCount: 35, uploadDate: '2026-08-06', status: 'ready', type: 'exam' },
  { id: 'q5', title: 'First Term Examination', subject: 'Accounting', class: 'SS2', fileType: 'docx', fileName: 'ss2-accounting.docx', questionCount: 40, uploadDate: '2026-08-10', status: 'draft', type: 'exam' },
  { id: 'q6', title: 'Mid-Term Test', subject: 'Mathematics', class: 'JSS1', fileType: 'pdf', fileName: 'jss1-maths-midterm-test.pdf', questionCount: 20, uploadDate: '2026-08-11', status: 'ready', type: 'test' },
  { id: 'q7', title: 'Mid-Term Test', subject: 'English Language', class: 'SS1', fileType: 'docx', fileName: 'ss1-english-midterm-test.docx', questionCount: 25, uploadDate: '2026-08-12', status: 'ready', type: 'test' },
];

export const INITIAL_RESULTS = [
  { id: 'r1', studentName: 'Chinedu Okafor', username: 'GVC/2026/001', class: 'JSS1', subject: 'Mathematics', exam: 'First Term Examination', score: 31, total: 40, date: '2026-08-12', type: 'exam' },
  { id: 'r2', studentName: 'Fatima Ibrahim', username: 'GVC/2026/004', class: 'SS1', subject: 'Physics', exam: 'First Term Examination', score: 36, total: 40, date: '2026-08-12', type: 'exam' },
  { id: 'r3', studentName: 'Emeka Nwosu', username: 'GVC/2026/005', class: 'SS2', subject: 'Physics', exam: 'First Term Examination', score: 26, total: 40, date: '2026-08-13', type: 'exam' },
  { id: 'r4', studentName: 'Blessing Eze', username: 'GVC/2026/006', class: 'SS2', subject: 'Accounting', exam: 'First Term Examination', score: 22, total: 40, date: '2026-08-13', type: 'exam' },
  { id: 'r5', studentName: 'Yusuf Abdullahi', username: 'GVC/2026/007', class: 'SS3', subject: 'English Language', exam: 'First Term Examination', score: 33, total: 40, date: '2026-08-14', type: 'exam' },
  { id: 'r6', studentName: 'Aisha Bello', username: 'GVC/2026/002', class: 'JSS2', subject: 'Basic Science', exam: 'First Term Examination', score: 28, total: 40, date: '2026-08-14', type: 'exam' },
  { id: 'r7', studentName: 'Chinedu Okafor', username: 'GVC/2026/001', class: 'JSS1', subject: 'Mathematics', exam: 'Mid-Term Test', score: 33, total: 40, date: '2026-08-15', type: 'test' },
];

export const LICENSE = {
  balance: 84,
  pricePerExam: 50,
  history: [
    { id: 'p1', date: '2026-07-20', exams: 100, amount: 20000, reference: 'GVC-PSK-88213', status: 'successful' },
    { id: 'p2', date: '2026-08-01', exams: 50, amount: 10000, reference: 'GVC-PSK-88579', status: 'successful' },
  ],
};

export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

// Real question-file parsing (reading the actual PDF/Word content) is a
// later build step (Phase 5+7, once there's a backend). Until then, this
// generates realistic-but-placeholder questions so the exam-taking flow —
// timer, navigation, answering, grading — is fully functional to test.
// Capped at 10 questions regardless of the uploaded file's real count, so
// a demo run stays quick; deterministic (same questionId always produces
// the same set) so retaking the same exam in testing behaves consistently.
export function generateMockQuestions(subject, requestedCount) {
  const n = Math.max(1, Math.min(requestedCount || 10, 10));
  return Array.from({ length: n }, (_, i) => ({
    id: `mq${i + 1}`,
    text: `Sample ${subject} question ${i + 1} of ${n}. (Placeholder content — real questions will come from your uploaded file once question parsing is built.)`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctIndex: i % 4,
  }));
}

// Next free student number for a school. Uses the highest number already
// used in usernames (not just how many students exist), so deleting a
// student can never cause the next new student to get a username that is
// already taken.
export function studentSequence(students) {
  let max = students.length;
  for (const s of students) {
    const m = /\/(\d+)$/.exec(s.username || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}
