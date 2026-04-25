import { createAdminSupabaseClient } from "../supabase/admin";

export type RuntimeConnectionState = "disconnected" | "connecting" | "qr_ready" | "connected";

export interface WhatsAppInstanceRuntime {
  agentId: string;
  state: RuntimeConnectionState;
  qrDataUri?: string;
  lastError?: string;
  connectedAt?: string;
  updatedAt?: string;
}

type RuntimeRow = {
  agent_id: string;
  connected_at: string | null;
  created_at?: string;
  last_error: string | null;
  qr_data_uri: string | null;
  state: RuntimeConnectionState;
  updated_at: string;
};

const DEFAULT_RUNTIME_STATE: RuntimeConnectionState = "disconnected";

function mapRow(row: RuntimeRow | null | undefined, agentId: string): WhatsAppInstanceRuntime {
  if (!row) {
    return {
      agentId,
      state: DEFAULT_RUNTIME_STATE,
    };
  }

  return {
    agentId: row.agent_id,
    state: row.state,
    qrDataUri: row.qr_data_uri || undefined,
    lastError: row.last_error || undefined,
    connectedAt: row.connected_at || undefined,
    updatedAt: row.updated_at,
  };
}

export async function ensureWhatsAppInstance(agentId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_instances")
    .upsert({ agent_id: agentId }, { onConflict: "agent_id" });

  if (error) {
    throw error;
  }
}

export async function getWhatsAppInstanceRuntime(agentId: string): Promise<WhatsAppInstanceRuntime> {
  await ensureWhatsAppInstance(agentId);

  return getStoredWhatsAppInstanceRuntime(agentId);
}

export async function getStoredWhatsAppInstanceRuntime(agentId: string): Promise<WhatsAppInstanceRuntime> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_instances")
    .select("*")
    .eq("agent_id", agentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return mapRow(data as RuntimeRow | null, agentId);
}

export async function updateWhatsAppRuntime(
  agentId: string,
  updates: {
    state?: RuntimeConnectionState;
    qrDataUri?: string | null;
    lastError?: string | null;
    connectedAt?: string | null;
  },
) {
  await ensureWhatsAppInstance(agentId);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_instances")
    .update({
      state: updates.state,
      qr_data_uri: updates.qrDataUri,
      last_error: updates.lastError,
      connected_at: updates.connectedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId);

  if (error) {
    throw error;
  }
}
