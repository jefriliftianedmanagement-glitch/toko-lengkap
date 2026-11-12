const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Client ini memakai service_role key: HANYA dipakai di backend.
// Jangan pernah mengirim key ini ke frontend.
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

module.exports = supabase;
