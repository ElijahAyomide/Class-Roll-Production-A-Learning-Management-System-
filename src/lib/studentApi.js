import { supabase } from './supabaseClient';

// Every student-side request goes through this one function, which calls
// the "student-api" Edge Function. The browser never reads the student
// tables directly any more — see supabase/functions/student-api/index.ts.
//
// If the server says no (wrong password, expired session, etc.), this
// throws an Error whose .message is the friendly text to show the student,
// and whose .status is the HTTP status (401 = please sign in again).
async function call(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('student-api', {
    body: { action, ...payload },
  });

  if (error) {
    let message = 'Could not reach the server. Check your internet connection and try again.';
    let status = 0;
    try {
      if (error.context && typeof error.context.json === 'function') {
        status = error.context.status;
        const body = await error.context.json();
        if (body && body.error) message = body.error;
      }
    } catch {
      // keep the generic message
    }
    const err = new Error(message);
    err.status = status;
    throw err;
  }
  return data;
}

export const studentApi = {
  login: (username, surname) => call('login', { username, surname }),
  logout: (token) => call('logout', { token }),
  home: (token) => call('home', { token }),
  // A "sitting" is all the subjects the school set together (one group, one timer).
  startSitting: (token, groupId) => call('start', { token, groupId }),
  saveAnswers: (token, groupId, answers) => call('save', { token, groupId, answers }),
  submitSitting: (token, groupId, answers) => call('submit', { token, groupId, answers }),
  review: (token) => call('review', { token }),
};
