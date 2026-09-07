import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Loud console warning rather than a silent failure — a missing .env
  // file is the single most common reason the app would show a blank
  // screen or empty data in this phase.
  console.error(
    'Missing Supabase environment variables. Copy .env.example to .env ' +
    'and fill in your Project URL and anon key from Supabase → Project Settings → API.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
