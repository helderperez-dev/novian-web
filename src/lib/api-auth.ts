import { getCurrentAppUser } from "@/lib/auth";

export async function requireInternalApiUser() {
  const appUser = await getCurrentAppUser();

  if (!appUser || !appUser.is_active || appUser.user_type !== "internal") {
    return null;
  }

  return appUser;
}

export async function requireAdminApiUser() {
  const appUser = await requireInternalApiUser();

  if (!appUser || appUser.role !== "admin") {
    return null;
  }

  return appUser;
}
