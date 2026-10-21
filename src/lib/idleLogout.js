import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

// Signs an admin out for security when:
//   - they have not touched the page for IDLE_LIMIT (walked away), or
//   - the computer went to sleep or hibernated (the page's clock "jumps":
//     its timers stop while asleep, so the gap between two checks is huge).
// Either way they see the sign-in page with a short explanation.
//
// Activity is shared between browser tabs through localStorage, so working in
// one tab keeps the others signed in too.

export const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes without activity
const WARN_MS = 2 * 60 * 1000;               // warn during the last 2 minutes
const SLEEP_GAP_MS = 3 * 60 * 1000;          // a gap this long between checks means the computer slept
const CHECK_EVERY_MS = 5000;
const ACTIVITY_KEY = 'classroll-last-activity';
export const SIGNOUT_REASON_KEY = 'classroll-signout-reason';

function readActivity() {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) || 'null'); } catch { return null; }
}
function writeActivity(signInAt, t = Date.now()) {
  try { localStorage.setItem(ACTIVITY_KEY, JSON.stringify({ t, signInAt })); } catch { /* not critical */ }
}
function clearActivity() {
  try { localStorage.removeItem(ACTIVITY_KEY); } catch { /* not critical */ }
}

// Pure decision, kept separate so it can be tested.
export function shouldSignOut({ now, lastTick, lastActivity }) {
  if (now - lastTick > SLEEP_GAP_MS) return 'sleep';
  if (now - lastActivity >= IDLE_LIMIT_MS) return 'idle';
  return null;
}

// `session` is the admin's Supabase session (or null). Returns the number of
// seconds left when the sign-out warning should show, otherwise null.
export function useIdleLogout(session, onSignedOut) {
  const [warnSeconds, setWarnSeconds] = useState(null);
  const userId = session?.user?.id;
  const signInAt = session?.user?.last_sign_in_at || '';

  useEffect(() => {
    if (!userId) return undefined;

    // A brand-new sign-in starts the clock fresh. The same sign-in coming back
    // after a long time away (e.g. reopening the browser next day) does not.
    const saved = readActivity();
    if (!saved || saved.signInAt !== signInAt) writeActivity(signInAt);

    let lastTick = Date.now();
    let lastWrite = Date.now();
    let finished = false;
    let warning = false;

    const mark = () => {
      const now = Date.now();
      if (warning) { warning = false; setWarnSeconds(null); }
      if (now - lastWrite > 3000) { lastWrite = now; writeActivity(signInAt, now); }
    };

    const check = async () => {
      if (finished) return;
      const now = Date.now();
      const current = readActivity();
      const reason = shouldSignOut({ now, lastTick, lastActivity: current?.t ?? now });
      lastTick = now;

      if (reason) {
        finished = true;
        try { sessionStorage.setItem(SIGNOUT_REASON_KEY, reason); } catch { /* not critical */ }
        clearActivity();
        try { await supabase.auth.signOut(); } catch { /* the local session is cleared anyway */ }
        onSignedOut();
        return;
      }
      const left = IDLE_LIMIT_MS - (now - (current?.t ?? now));
      if (left <= WARN_MS) { warning = true; setWarnSeconds(Math.max(1, Math.ceil(left / 1000))); }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(e => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(check, CHECK_EVERY_MS);
    // Waking the computer or returning to the tab: check straight away.
    const onWake = () => { if (document.visibilityState !== 'hidden') check(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    window.addEventListener('online', onWake);
    check(); // covers a reopened browser with an old session

    return () => {
      finished = true;
      events.forEach(e => window.removeEventListener(e, mark));
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
      window.removeEventListener('online', onWake);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, signInAt]);

  return warnSeconds;
}

// Call when someone signs out on purpose, so the next sign-in starts fresh.
export function forgetActivity() { clearActivity(); }
