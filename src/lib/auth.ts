import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AppUser = Database["public"]["Tables"]["app_users"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

function redirectByRole(appUser: AppUser | null, next = "/admin") {
  const encodedNext = encodeURIComponent(next);

  if (!appUser) {
    redirect(`/login?next=${encodedNext}`);
  }

  if (!appUser.is_active) {
    redirect("/login?error=inactive");
  }

  if (appUser.role === "client") {
    redirect("/client");
  }

  redirect("/admin");
}

export async function getCurrentSessionUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentAppUser(): Promise<AppUser | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

export async function requireAuthenticatedUser(next = "/admin") {
  const authUser = await getCurrentSessionUser();
  if (!authUser) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const appUser = await getCurrentAppUser();
  if (!appUser) {
    redirect("/login?error=profile");
  }

  return { authUser, appUser };
}

export async function requireInternalUser() {
  const { authUser, appUser } = await requireAuthenticatedUser("/admin");

  if (appUser.user_type !== "internal" || !["admin", "broker"].includes(appUser.role)) {
    redirectByRole(appUser, "/admin");
  }

  return { authUser, appUser };
}

export async function requireAdminUser() {
  const { authUser, appUser } = await requireAuthenticatedUser("/admin");

  if (appUser.role !== "admin" || appUser.user_type !== "internal") {
    redirectByRole(appUser, "/admin");
  }

  return { authUser, appUser };
}

export async function requireClientUser() {
  const { authUser, appUser } = await requireAuthenticatedUser("/client");

  if (appUser.role !== "client" || appUser.user_type !== "client") {
    redirectByRole(appUser, "/client");
  }

  return { authUser, appUser };
}

export function canManageUsers(role: AppRole | null | undefined) {
  return role === "admin";
}
