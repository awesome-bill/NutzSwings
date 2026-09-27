/* Fairway Notebook: connection to your Supabase database.

   Fill in both values from your Supabase project (the "Connect" button at the top of the project
   dashboard shows them, and they're also under Project Settings → API Keys).

   Both are meant to be public, so it's fine that they're in this public repo. Your data stays private
   because the database only lets a signed-in owner reach their own rows (see supabase/setup.sql).

   NEVER put the "secret" or "service_role" key here. That key bypasses those protections. */
window.FAIRWAY_CONFIG = {
  supabaseUrl: 'https://ejuudpoyfcclapkvacmj.supabase.co',      // looks like https://abcdefghijklmnop.supabase.co
  supabaseAnonKey: 'sb_publishable_47TE7sXRGWzPEJmmzyomfA_P0kzOTOg',  // the publishable key (sb_publishable_...) or the older "anon public" key
};
