import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchMySchool, updateSchool as updateSchoolInDb } from '../lib/schools';
import { getCurrentSession, onAuthStateChange } from '../lib/auth';

const SchoolContext = createContext(null);

export function SchoolProvider({ children }) {
  const [session, setSession] = useState(null);
  const [school, setSchoolState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  const loadSchool = async (userId) => {
    try {
      const s = await fetchMySchool(userId);
      setSchoolState(s);
      setDbError(null);
    } catch (err) {
      console.error('Failed to load school:', err.message);
      setDbError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getCurrentSession().then((s) => {
      if (!active) return;
      setSession(s);
      if (s) loadSchool(s.user.id);
      else setLoading(false);
    });

    const unsubscribe = onAuthStateChange((s) => {
      setSession(s);
      if (s) {
        setLoading(true);
        loadSchool(s.user.id);
      } else {
        setSchoolState(null);
        setLoading(false);
      }
    });

    return () => { active = false; unsubscribe(); };
  }, []);

  // Callers pass the FULL updated school object — e.g.
  // setSchool({ ...school, name: e.target.value }). Persists to Supabase
  // with an optimistic local update and a rollback if the save fails.
  const setSchool = async (updated) => {
    const previous = school;
    setSchoolState(updated);
    if (!updated?.id) return;
    try {
      const saved = await updateSchoolInDb(updated.id, updated);
      setSchoolState(saved);
    } catch (err) {
      console.error('Failed to save school changes:', err.message);
      setSchoolState(previous);
    }
  };

  // Called by Login.jsx right after a successful registration, so the
  // rest of the app picks up the new school immediately without a
  // separate refetch.
  const setSchoolDirectly = (newSchool) => setSchoolState(newSchool);

  return (
    <SchoolContext.Provider value={{ school, setSchool, setSchoolDirectly, session, loading, dbError }}>
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const ctx = useContext(SchoolContext);
  if (!ctx) throw new Error('useSchool must be used inside a SchoolProvider');
  return ctx;
}
