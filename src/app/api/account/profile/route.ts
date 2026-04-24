import { NextResponse } from "next/server";
import { getCurrentAppUser, getCurrentSessionUser } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function requireAuthenticatedAppUser() {
  const [authUser, appUser] = await Promise.all([
    getCurrentSessionUser(),
    getCurrentAppUser(),
  ]);

  if (!authUser || !appUser || !appUser.is_active) {
    return null;
  }

  return { authUser, appUser };
}

export async function GET() {
  const currentUser = await requireAuthenticatedAppUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ user: currentUser.appUser });
}

export async function PATCH(req: Request) {
  const currentUser = await requireAuthenticatedAppUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const avatarUrl =
      typeof body.avatarUrl === "string" && body.avatarUrl.trim()
        ? body.avatarUrl.trim()
        : null;

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("app_users")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", currentUser.appUser.id)
      .select("*")
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    const metadata = {
      ...(currentUser.authUser.user_metadata ?? {}),
      full_name: data.full_name,
      avatar_url: data.avatar_url,
    };

    const { error: authError } = await supabase.auth.admin.updateUserById(currentUser.authUser.id, {
      user_metadata: metadata,
    });

    if (authError) {
      console.error(authError);
    }

    return NextResponse.json({
      success: true,
      user: data,
      warning: authError ? "Profile updated, but auth metadata sync failed." : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
