// supabaseClient.ts
// Creates the one Supabase client the app shares. In a Vite app the browser
// reads env values from import.meta.env, and only variables prefixed with
// VITE_ are exposed. Put them in a .env file in the project root, then restart
// the dev server (Vite only reads .env at startup).
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add both to a .env " +
      "file in the project root, then stop and restart the dev server.",
  );
}

export const supabase = createClient(url, key);
