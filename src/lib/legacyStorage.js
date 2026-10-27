// The app used to be called ClassRoll and saved a few small things in the
// browser under "classroll-..." names. They now use "assessly-..." names. This
// moves anything saved under an old name to the new one the first time it is
// looked at, so nobody is signed out or loses saved work because of the rename.
export function migrateKey(oldKey, newKey, store = localStorage) {
  try {
    const old = store.getItem(oldKey);
    if (old === null) return;
    if (store.getItem(newKey) === null) store.setItem(newKey, old);
    store.removeItem(oldKey);
  } catch { /* storage can be blocked; nothing to move then */ }
}
