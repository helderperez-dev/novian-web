import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { isRecoverableSessionError } from "@/lib/supabase/session-errors";

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  for (const { name } of request.cookies.getAll()) {
    if (!name.startsWith("sb-")) continue;
    request.cookies.delete(name);
    response.cookies.delete(name);
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  try {
    const {
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (!isRecoverableSessionError(error)) {
        throw error;
      }

      clearSupabaseAuthCookies(request, response);
    }
  } catch (error) {
    if (!isRecoverableSessionError(error)) {
      throw error;
    }

    clearSupabaseAuthCookies(request, response);
  }

  return response;
}
