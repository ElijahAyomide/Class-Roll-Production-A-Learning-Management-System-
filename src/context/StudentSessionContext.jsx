import React, { createContext, useContext, useState } from 'react';

const StudentSessionContext = createContext(null);
const STORAGE_KEY = 'classroll-student-session';

export function StudentSessionProvider({ children }) {
  // Reads from localStorage once, on first load — this is what fixes
  // students getting logged out every time they refresh the page.
  // Nothing sensitive is stored here, just the student's own database id.
  const [currentStudentId, setCurrentStudentIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null;
    } catch {
      return null; // localStorage can throw in some private-browsing modes
    }
  });

  const setCurrentStudentId = (id) => {
    setCurrentStudentIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // If localStorage is unavailable, the session just won't survive a
      // refresh — not worth failing the whole sign-in over.
    }
  };

  return (
    <StudentSessionContext.Provider value={{ currentStudentId, setCurrentStudentId }}>
      {children}
    </StudentSessionContext.Provider>
  );
}

export function useStudentSession() {
  const ctx = useContext(StudentSessionContext);
  if (!ctx) throw new Error('useStudentSession must be used inside a StudentSessionProvider');
  return ctx;
}
