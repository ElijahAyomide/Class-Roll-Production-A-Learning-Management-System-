import { supabase } from './supabaseClient';

// "Remember me" on the sign-in page.
//   Ticked   -> the admin stays signed in on this computer (normal behaviour).
//   Unticked -> they are signed out once the browser has been closed.
// While the app is open it writes a heartbeat; when it opens again, a stale
// heartbeat means the browser was closed in between.

const MODE_KEY = 'classroll-remember-mode'; // 'session' when "Remember me" was left unticked
const BEAT_KEY = 'classroll-heartbeat';
const STALE_MS = 90 * 1000;
const BEAT_EVERY_MS = 15 * 1000;

let timer = null;

function beat() {
  try { localStorage.setItem(BEAT_KEY, String(Date.now())); } catch { /* not critical */ }
}

export function setRememberChoice(remember) {
  try {
    if (remember) localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, 'session');
  } catch { /* not critical */ }
  startHeartbeat();
}

function startHeartbeat() {
  if (timer) return;
  let mode = null;
  try { mode = localStorage.getItem(MODE_KEY); } catch { /* not critical */ }
  if (mode !== 'session') return;
  beat();
  timer = setInterval(beat, BEAT_EVERY_MS);
}

// Call once when the app starts, before the saved session is read.
export async function enforceRememberChoice() {
  try {
    if (localStorage.getItem(MODE_KEY) === 'session') {
      const last = Number(localStorage.getItem(BEAT_KEY) || 0);
      if (!last || Date.now() - last > STALE_MS) {
        localStorage.removeItem(MODE_KEY);
        localStorage.removeItem(BEAT_KEY);
        await supabase.auth.signOut();
        return;
      }
    }
  } catch { /* if anything goes wrong, leave the person signed in */ }
  startHeartbeat();
}
