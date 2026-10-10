import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { fetchMySchool, updateSchool as updateSchoolInDb } from '../lib/schools';
import { getCurrentSession, onAuthStateChange } from '../lib/auth';

const SchoolContext = createContext(null);

export function SchoolProvider({ children }) {
  const [session, setSession] = useState(null);
  const [school, setSchoolState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(null);

  // Guards against a real race condition: right after registration, the
  // auth-state listener below independently fires its own background
  // fetch for "my school" at almost the same moment the registration
  // flow (in Login.jsx) directly sets the newly-created school via
  // setSchoolDirectly. If that background fetch started BEFORE the new
  // school row existed yet, it finds nothing — and if it resolves AFTER
  // setSchoolDirectly, it would silently overwrite the correct school
  // with null, leaving the app stuck waiting for data that never
  // arrives. This counter makes every fetch check, right before writing
  // its result, whether something newer has already superseded it —
  // if so, it discards its own (now-stale) result instead of applying it.
  const requestIdRef = useRef(0);

  const loadSchool = async (userId) => {
    const myRequestId = ++requestIdRef.current;
    console.log(`[ClassRoll debug] loadSchool starting — userId=${userId}, requestId=${myRequestId}`);
    try {
      const s = await fetchMySchool(userId);
      console.log(`[ClassRoll debug] loadSchool got result for requestId=${myRequestId}:`, s);
      if (requestIdRef.current !== myRequestId) {
        console.log(`[ClassRoll debug] requestId=${myRequestId} was superseded by requestId=${requestIdRef.current} — discarding this result`);
        return;
      }
      setSchoolState(s);
      setDbError(null);
      console.log(`[ClassRoll debug] school state set from requestId=${myRequestId}`);
    } catch (err) {
      console.log(`[ClassRoll debug] loadSchool THREW for requestId=${myRequestId}:`, err);
      if (requestIdRef.current !== myRequestId) return;
      console.error('Failed to load school:', err.message);
      setDbError(err.message);
    } finally {
      if (requestIdRef.current === myRequestId) {
        setLoading(false);
        console.log(`[ClassRoll debug] setLoading(false) called for requestId=${myRequestId}`);
      } else {
        console.log(`[ClassRoll debug] requestId=${myRequestId} finished but was superseded — NOT calling setLoading(false)`);
      }
    }
  };

  useEffect(() => {
    let active = true;

    getCurrentSession().then((s) => {
      console.log('[ClassRoll debug] getCurrentSession() resolved with:', s);
      if (!active) return;
      setSession(s);
      if (s) loadSchool(s.user.id);
      else setLoading(false);
    });

    const unsubscribe = onAuthStateChange((s) => {
      console.log('[ClassRoll debug] onAuthStateChange fired with session:', s);
      setSession(s);
      if (s) {
        setLoading(true);
        loadSchool(s.user.id);
      } else {
        requestIdRef.current++; // invalidate any fetch still in flight
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

  // Called by Login.jsx right after a successful registration. Bumps the
  // request counter first, so any background fetch already in flight
  // from the auth-state listener gets discarded when it resolves,
  // instead of potentially overwriting this with a stale null result.
  const setSchoolDirectly = (newSchool) => {
    requestIdRef.current++;
    setSchoolState(newSchool);
    setLoading(false);
  };

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