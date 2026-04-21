import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { getCurrentAppUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminUser = await requireAdminApiUser();
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const userType = (body.userType === "client" ? "client" : "internal") as AppUserType;
    const role = normalizeRole(
      userType,
      (body.role === "admin" ? "admin" : body.role === "client" ? "client" : "broker") as AppRole,
    );

    const updates: Database["public"]["Tables"]["app_users"]["Update"] = {
      full_name: typeof body.fullName === "string" ? body.fullName.trim() : undefined,
      user_type: userType,
      role,
      permissions: parsePermissions(body.permissions),
      is_active: typeof body.isActive === "boolean" ? body.isActive : true,
    };

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("app_users")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
