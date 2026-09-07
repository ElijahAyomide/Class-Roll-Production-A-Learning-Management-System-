import { supabase } from './supabaseClient';

export async function signUpAdmin(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // If your Supabase project has "Confirm email" turned ON, signUp()
  // returns a user but no active session until they click the emailed
  // link — data.session will be null here. For a smooth pilot/demo
  // experience, turn "Confirm email" OFF in Supabase → Authentication →
  // Providers → Email, so sign-up logs people in immediately.
  if (!data.session) {
    throw new Error(
      'Account created, but no session was started — this usually means "Confirm email" is turned on in your Supabase project. ' +
      'Check your email for a confirmation link, or turn that setting off in Supabase for instant sign-up.'
    );
  }
  return data.user;
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

// Fires whenever the auth session changes (sign in, sign out, token
// refresh). Returns an unsubscribe function — call it in a useEffect
// cleanup so the listener doesn't leak.
export function onAuthStateChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}
