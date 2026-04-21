"use server";

import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  const supabase = await createServerSupabaseClient();
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: appUser } = await adminSupabase
    .from("app_users")
    .select("role, user_type, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!appUser || !appUser.is_active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  if (appUser.user_type === "client" || appUser.role === "client") {
    redirect("/client");
  }

  redirect(next.startsWith("/client") ? "/admin" : next || "/admin");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}
