import { supabase } from './supabaseClient';

// Creates the admin account. The school's details travel inside the account
// (user metadata) so that, when "Confirm email" is on, the school can still be
// set up after the person clicks the link in their email, even on another device.
// Returns { user, session }: session is null until the email is confirmed.
export async function signUpAdmin(email, password, schoolProfile) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`,
      data: { school_profile: schoolProfile },
    },
  });
  if (error) throw error;

  // With email confirmation on, signing up with an email that is already
  // registered doesn't error (to avoid revealing who has an account); it
  // returns a user with no identities. Tell them kindly.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('An account with this email already exists. Please sign in instead, or use "Forgot password?".');
  }
  return { user: data.user, session: data.session };
}

// Sends the confirmation email again (for a lost or expired link).
export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/dashboard` },
  });
  if (error) throw error;
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

// Sends a "reset your password" email. The link inside it brings the admin
// back to /reset-password on this same site, already signed in for just long
// enough to choose a new password.
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}

// Sets a new password for whoever is currently signed in.
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
