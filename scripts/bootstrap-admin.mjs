import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase configuration in .env.local");
}

const email = process.argv[2];
const fullName = process.argv[3] || "System Admin";
const providedPassword = process.argv[4];

if (!email) {
  throw new Error("Usage: node scripts/bootstrap-admin.mjs <email> [full name] [password]");
}

const generatedPassword =
  providedPassword ||
  `Novian!${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 8).toUpperCase()}9`;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const { count: appUserCount, error: countError } = await supabase
  .from("app_users")
  .select("*", { count: "exact", head: true });

if (countError) {
  throw countError;
}

if ((appUserCount || 0) > 0) {
  throw new Error("Bootstrap aborted because app_users already contains records.");
}

const { data: authUserData, error: authError } = await supabase.auth.admin.createUser({
  email,
  password: generatedPassword,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    user_type: "internal",
    role: "admin",
  },
});

if (authError || !authUserData.user) {
  throw authError || new Error("Failed to create auth user");
}

const { error: profileError } = await supabase.from("app_users").insert({
  id: authUserData.user.id,
  email,
  full_name: fullName,
  user_type: "internal",
  role: "admin",
  permissions: [
    "crm.access",
    "properties.manage",
    "funnels.manage",
    "users.manage",
    "client.portal.manage",
  ],
  is_active: true,
  invited_by: null,
});

if (profileError) {
  throw profileError;
}

console.log(JSON.stringify({
  success: true,
  email,
  fullName,
  password: generatedPassword,
}, null, 2));
