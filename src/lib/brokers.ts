import "server-only";

import type { Database } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AppUserRow = Database["public"]["Tables"]["app_users"]["Row"];

export type BrokerSummary = {
  id: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  creci: string | null;
};

function mapBroker(row: AppUserRow): BrokerSummary {
  return {
    id: row.id,
    fullName: row.full_name?.trim() || row.email,
    email: row.email,
    avatarUrl: row.avatar_url,
    creci: row.creci?.trim() || null,
  };
}

export async function listBrokerSummaries() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("user_type", "internal")
    .eq("role", "broker")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapBroker);
}

export async function listBrokerSummariesByIds(userIds: string[]) {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const brokersById = new Map<string, BrokerSummary>();

  if (uniqueIds.length === 0) {
    return brokersById;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .in("id", uniqueIds)
    .eq("user_type", "internal")
    .eq("role", "broker");

  if (error) {
    throw error;
  }

  for (const row of data || []) {
    brokersById.set(row.id, mapBroker(row));
  }

  return brokersById;
}
