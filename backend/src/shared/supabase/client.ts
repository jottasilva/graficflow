import { createClient } from "@supabase/supabase-js";
import type { Env } from "../../config/env.js";

export type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export function createSupabaseServiceClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        "X-Client-Info": "graphflow-backend",
      },
    },
  });
}
