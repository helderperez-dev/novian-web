import { createAdminSupabaseClient } from "../supabase/admin";
import type { Json } from "../database.types";

export type WhatsAppTaskType = "refresh_contact_metadata";
export type WhatsAppTaskStatus = "pending" | "processing" | "completed" | "failed";

export interface WhatsAppTask {
  id: string;
  agentId: string;
  taskType: WhatsAppTaskType;
  payload: Json;
  status: WhatsAppTaskStatus;
  result?: Json | null;
  error?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

type TaskRow = {
  agent_id: string;
  created_at: string;
  error: string | null;
  id: string;
  payload: Json;
  processed_at: string | null;
  result: Json | null;
  status: WhatsAppTaskStatus;
  task_type: WhatsAppTaskType;
  updated_at: string;
};

function mapRow(row: TaskRow): WhatsAppTask {
  return {
    id: row.id,
    agentId: row.agent_id,
    taskType: row.task_type,
    payload: row.payload,
    status: row.status,
    result: row.result,
    error: row.error,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function enqueueWhatsAppTask(agentId: string, taskType: WhatsAppTaskType, payload: Json) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_tasks")
    .insert({
      agent_id: agentId,
      task_type: taskType,
      payload,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRow(data as TaskRow);
}

export async function listPendingWhatsAppTasks(): Promise<WhatsAppTask[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_tasks")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapRow(row as TaskRow));
}

export async function markWhatsAppTaskProcessing(taskId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("whatsapp_tasks")
    .update({
      status: "processing",
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapRow(data as TaskRow) : null;
}

export async function completeWhatsAppTask(taskId: string, result: Json) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_tasks")
    .update({
      status: "completed",
      result,
      error: null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

export async function failWhatsAppTask(taskId: string, errorMessage: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("whatsapp_tasks")
    .update({
      status: "failed",
      error: errorMessage,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}
