import { createAdminSupabaseClient } from "../supabase/admin";

export type DesiredConnectionState = "connected" | "disconnected";
export type RuntimeConnectionState = "disconnected" | "connecting" | "qr_ready" | "connected";

export interface WhatsAppInstanceRuntime {
  agentId: string;
  desiredState: DesiredConnectionState;
  state: RuntimeConnectionState;
  qrDataUri?: string;
  lastError?: string;
  workerId?: string;
  heartbeatAt?: string;
  connectedAt?: string;
  updatedAt?: string;
}

type RuntimeRow = {
  agent_id: string;
  connected_at: string | null;
  created_at?: string;
  desired_state: DesiredConnectionState;
  heartbeat_at: string | null;
  last_error: string | null;
  qr_data_uri: string | null;
  state: RuntimeConnectionState;
  updated_at: string;
  worker_id: string | null;
};

const DEFAULT_RUNTIME_STATE: RuntimeConnectionState = "disconnected";
const DEFAULT_DESIRED_STATE: DesiredConnectionState = "disconnected";

function mapRow(row: RuntimeRow | null | undefined, agentId: string): WhatsAppInstanceRuntime {
  if (!row) {
    return {
      agentId,
      desiredState: DEFAULT_DESIRED_STATE,
      state: DEFAULT_RUNTIME_STATE,
    };
  }

  return {
    agentId: row.agent_id,
    desiredState: row.desired_state,
    state: row.state,
    qrDataUri: row.qr_data_uri || undefined,
    lastError: row.last_error || undefined,
    workerId: row.worker_id || undefined,
    heartbeatAt: row.heartbeat_at || undefined,
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

export async function listWhatsAppInstanceRuntimes(
  desiredState?: DesiredConnectionState,
): Promise<WhatsAppInstanceRuntime[]> {
  const supabase = createAdminSupabaseClient();
  let query = supabase.from("whatsapp_instances").select("*").order("agent_id");

  if (desiredState) {
    query = query.eq("desired_state", desiredState);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapRow(row as RuntimeRow, row.agent_id));
}

export async function requestWhatsAppConnection(agentId: string) {
  await ensureWhatsAppInstance(agentId);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_instances")
    .update({
      desired_state: "connected",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId);

  if (error) {
    throw error;
  }
}

export async function requestWhatsAppDisconnect(agentId: string, clearRuntime = false) {
  await ensureWhatsAppInstance(agentId);

  const supabase = createAdminSupabaseClient();
  const updates: {
    desired_state: DesiredConnectionState;
    updated_at: string;
    state?: RuntimeConnectionState;
    qr_data_uri?: null;
    worker_id?: null;
    connected_at?: null;
  } = {
    desired_state: "disconnected",
    updated_at: new Date().toISOString(),
  };

  if (clearRuntime) {
    updates.state = "disconnected";
    updates.qr_data_uri = null;
    updates.worker_id = null;
    updates.connected_at = null;
  }

  const { error } = await supabase
    .from("whatsapp_instances")
    .update(updates)
    .eq("agent_id", agentId);

  if (error) {
    throw error;
  }
}

export async function updateWhatsAppRuntime(
  agentId: string,
  updates: {
    state?: RuntimeConnectionState;
    qrDataUri?: string | null;
    lastError?: string | null;
    workerId?: string | null;
    heartbeatAt?: string | null;
    connectedAt?: string | null;
    desiredState?: DesiredConnectionState;
  },
) {
  await ensureWhatsAppInstance(agentId);

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_instances")
    .update({
      desired_state: updates.desiredState,
      state: updates.state,
      qr_data_uri: updates.qrDataUri,
      last_error: updates.lastError,
      worker_id: updates.workerId,
      heartbeat_at: updates.heartbeatAt,
      connected_at: updates.connectedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("agent_id", agentId);

  if (error) {
    throw error;
  }
}

export async function claimWhatsAppRuntime(agentId: string, workerId: string, staleAfterMs = 30000) {
  const runtime = await getWhatsAppInstanceRuntime(agentId);
  const now = Date.now();
  const heartbeatAt = runtime.heartbeatAt ? new Date(runtime.heartbeatAt).getTime() : 0;
  const isOwnedByOtherWorker = runtime.workerId && runtime.workerId !== workerId;
  const isStale = !heartbeatAt || now - heartbeatAt > staleAfterMs;

  if (isOwnedByOtherWorker && !isStale) {
    return false;
  }

  const supabase = createAdminSupabaseClient();
  let query = supabase
    .from("whatsapp_instances")
    .update({
      worker_id: workerId,
      heartbeat_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    })
    .eq("agent_id", agentId);

  if (isOwnedByOtherWorker) {
    query = query.eq("worker_id", runtime.workerId ?? "");
  } else if (runtime.workerId) {
    query = query.eq("worker_id", runtime.workerId);
  } else {
    query = query.is("worker_id", null);
  }

  const { data, error } = await query.select("agent_id").maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}
