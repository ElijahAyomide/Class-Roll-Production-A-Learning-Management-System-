import React, { createContext, useContext, useState } from 'react';
import { migrateKey } from '../lib/legacyStorage';

const StudentSessionContext = createContext(null);
const STORAGE_KEY = 'assessly-student-token';
// Names used before the app was renamed. The old token is carried over so students stay signed in;
// the very old id-based session is only ever deleted.
migrateKey('classroll-student-token', STORAGE_KEY);
const OLD_STORAGE_KEY = 'classroll-student-session';

export function StudentSessionProvider({ children }) {
  // The token is a long random code issued by the server when a student
  // signs in. It proves who they are on every request. It is kept in
  // localStorage so a page refresh doesn't sign the student out.
  const [studentToken, setStudentTokenState] = useState(() => {
    try {
      localStorage.removeItem(OLD_STORAGE_KEY); // tidy up the old, insecure id-based session
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null; // localStorage can throw in some private-browsing modes
    }
  });

  const setStudentToken = (token) => {
    setStudentTokenState(token);
    try {
      if (token) localStorage.setItem(STORAGE_KEY, token);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // If localStorage is unavailable the session just won't survive a refresh.
    }
  };

  return (
    <StudentSessionContext.Provider value={{ studentToken, setStudentToken }}>
      {children}
    </StudentSessionContext.Provider>
  );
}

export function useStudentSession() {
  const ctx = useContext(StudentSessionContext);
  if (!ctx) throw new Error('useStudentSession must be used inside a StudentSessionProvider');
  return ctx;
}
