import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type AppRole = Database["public"]["Enums"]["app_role"];
type AppUserType = Database["public"]["Enums"]["app_user_type"];

function normalizeRole(userType: AppUserType, role: AppRole): AppRole {
  if (userType === "client") return "client";
  return role === "admin" ? "admin" : "broker";
}

function parsePermissions(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function requireAdminApiUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser || appUser.role !== "admin" || appUser.user_type !== "internal" || !appUser.is_active) {
    return null;
  }

  return appUser;
}

export async function GET() {
  const adminUser = await requireAdminApiUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }

  return NextResponse.json({ users: data });
}

export async function POST(req: Request) {
  const adminUser = await requireAdminApiUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const userType = (body.userType === "client" ? "client" : "internal") as AppUserType;
    const role = normalizeRole(userType, (body.role === "admin" ? "admin" : body.role === "client" ? "client" : "broker") as AppRole);
    const permissions = parsePermissions(body.permissions);

    if (!email || !fullName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const emailRedirectTo = new URL("/auth/callback?next=/login", req.url).toString();
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: fullName,
        user_type: userType,
        role,
      },
      redirectTo: emailRedirectTo,
    });

    if (inviteError || !inviteData.user) {
      console.error(inviteError);
      return NextResponse.json({ error: inviteError?.message || "Failed to invite user" }, { status: 500 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("app_users")
      .upsert({
        id: inviteData.user.id,
        email,
        full_name: fullName,
        user_type: userType,
        role,
        permissions,
        is_active: true,
        invited_by: adminUser.id,
      })
      .select("*")
      .single();

    if (profileError) {
      console.error(profileError);
      return NextResponse.json({ error: "User invited, but profile creation failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: profile });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
