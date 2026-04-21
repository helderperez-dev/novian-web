import { NextResponse } from "next/server";
import { getCurrentAppUser, getCurrentSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const [authUser, appUser] = await Promise.all([
    getCurrentSessionUser(),
    getCurrentAppUser(),
  ]);

  return NextResponse.json({
    authenticated: !!authUser,
    user: authUser
      ? {
          id: authUser.id,
          email: authUser.email,
        }
      : null,
    appUser,
  });
}
