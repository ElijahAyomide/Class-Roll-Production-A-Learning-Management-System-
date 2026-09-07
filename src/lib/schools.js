import { supabase } from './supabaseClient';

function mapSchool(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    address: row.address || '',
    state: row.state || '',
    lga: row.lga || '',
    email: row.email || '',
    phone: row.phone || '',
    logo: row.logo_url || null,
  };
}

// Used by the student portal, which has no admin session to scope by
// ownership — safe because school profile data is publicly readable
// (see migration_003's RLS policy comment for why).
export async function fetchSchoolById(schoolId) {
  const { data, error } = await supabase.from('schools').select('*').eq('id', schoolId).single();
  if (error) throw error;
  return mapSchool(data);
}

// Fetches the school owned by the currently signed-in admin. Returns null
// if this admin doesn't own a school yet — the caller decides what to do
// with that (Login.jsx creates one during registration).
export async function fetchMySchool(userId) {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('owner_id', userId)
    .maybeSingle();
  if (error) throw error;
  return mapSchool(data);
}

export async function updateSchool(schoolId, updates) {
  const payload = {};
  if ('name' in updates) payload.name = updates.name;
  if ('code' in updates) payload.code = updates.code;
  if ('address' in updates) payload.address = updates.address;
  if ('state' in updates) payload.state = updates.state;
  if ('lga' in updates) payload.lga = updates.lga;
  if ('email' in updates) payload.email = updates.email;
  if ('phone' in updates) payload.phone = updates.phone;
  if ('logo' in updates) payload.logo_url = updates.logo;

  const { data, error } = await supabase
    .from('schools')
    .update(payload)
    .eq('id', schoolId)
    .select()
    .single();
  if (error) throw error;
  return mapSchool(data);
}

// Called right after a successful sign-up. If there's a leftover
// unclaimed school from before real accounts existed (owner_id is null —
// this only applies to whatever test data existed pre-Phase-4), the very
// first person to register claims it instead of starting from scratch,
// so no test data gets orphaned. Everyone after that gets a brand new
// school row.
export async function claimOrCreateSchool(userId, details) {
  const { data: unclaimed, error: findErr } = await supabase
    .from('schools')
    .select('id')
    .is('owner_id', null)
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;

  const payload = {
    owner_id: userId,
    name: details.name,
    code: details.code,
    address: details.address,
    state: details.state,
    lga: details.lga,
    email: details.email,
    phone: details.phone,
  };

  if (unclaimed) {
    const { data, error } = await supabase
      .from('schools')
      .update(payload)
      .eq('id', unclaimed.id)
      .select()
      .single();
    if (error) throw error;
    return mapSchool(data);
  }

  const { data, error } = await supabase
    .from('schools')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return mapSchool(data);
}
