import { createClient } from "@supabase/supabase-js";
// Publishable client configuration; never replace with a service_role/secret key.
export const supabaseUrl = "https://dbriqiypbwfsswztdidf.supabase.co";
export const supabasePublishableKey =
  "sb_publishable_RTzwus5H251YnasrZHSdag_YgKxNT-f";
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
