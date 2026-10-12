import React, { createContext, useContext, useMemo } from 'react';

// Holds the school's own classes and the subjects each class takes.
// The data itself is loaded in AdminArea (App.jsx) alongside everything
// else; this context just makes it easy for any admin page to read it.
const ClassSetupContext = createContext(null);

export function ClassSetupProvider({ classRows, setClassRows, children }) {
  const value = useMemo(() => {
    const names = classRows.map(c => c.name);
    const subjectsFor = (className) => {
      const row = classRows.find(c => c.name === className);
      return row ? row.subjects : [];
    };
    // Every subject used anywhere in the school, for filters.
    const allSubjects = [...new Set(classRows.flatMap(c => c.subjects))].sort();
    return { classRows, setClassRows, classes: names, subjectsFor, allSubjects };
  }, [classRows, setClassRows]);

  return <ClassSetupContext.Provider value={value}>{children}</ClassSetupContext.Provider>;
}

export function useClassSetup() {
  const ctx = useContext(ClassSetupContext);
  if (!ctx) throw new Error('useClassSetup must be used inside a ClassSetupProvider');
  return ctx;
}
