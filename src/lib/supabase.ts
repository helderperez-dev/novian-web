import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase: SupabaseClient<Database> =
  typeof window === "undefined"
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : createBrowserSupabaseClient();
