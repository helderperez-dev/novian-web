import { jidNormalizedUser, isPnUser } from "@whiskeysockets/baileys";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { getLeadNotesByVisibility } from "@/lib/leadNotes";
import type { ChatMessage, Thread } from "@/lib/store";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type ChatThreadRow = Database["public"]["Tables"]["chat_threads"]["Row"];
type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];

const globalForTyping = globalThis as unknown as {
  typing: Map<string, string | null> | undefined;
};

const typingStore = globalForTyping.typing ?? new Map<string, string | null>();
if (process.env.NODE_ENV !== "production") {
  globalForTyping.typing = typingStore;
}

function formatClock(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isChannelThread(threadId: string) {
  return threadId === "general" || threadId === "continuous";
}

function extractPhoneFromThreadId(threadId: string) {
  if (isChannelThread(threadId)) {
    return null;
  }

  const normalized = jidNormalizedUser(threadId) || threadId;
  if (!isPnUser(normalized)) {
    return null;
  }

  const [user] = normalized.split("@");
  return user || null;
}

export function normalizeChatThreadId(threadIdOrJid: string) {
  if (isChannelThread(threadIdOrJid)) {
    return threadIdOrJid;
  }

  const trimmed = threadIdOrJid.trim();
  if (!trimmed.includes("@")) {
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `${digits}@s.whatsapp.net` : trimmed;
  }

  return jidNormalizedUser(trimmed) || trimmed;
}

function channelDefaults(threadId: string) {
  if (threadId === "general") {
    return {
      title: "#general-command",
      preview: "Fale diretamente com sua equipe de IA.",
      status: "Sistema Operacional",
    };
  }

  return {
    title: "#continuous-ops",
    preview: "Trabalho autônomo em segundo plano.",
    status: "24/7",
  };
}

function isOpportunityStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase() === "oportunidades (web)";
}

function getSourceValue(customData: LeadRow["custom_data"] | ChatThreadRow["custom_data"] | null | undefined) {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) {
    return null;
  }

  const source = (customData as Record<string, unknown>).source;
  return typeof source === "string" ? source : null;
}

function getWhatsAppJidValue(customData: LeadRow["custom_data"] | ChatThreadRow["custom_data"] | null | undefined) {
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) {
    return null;
  }

  const jid = (customData as Record<string, unknown>).whatsapp_jid;
  return typeof jid === "string" ? jid : null;
}

function isChatEligibleLead(lead: Pick<LeadRow, "status" | "custom_data"> | null | undefined) {
  if (!lead) {
    return false;
  }

  if (isOpportunityStatus(lead.status)) {
    return false;
  }

  const source = getSourceValue(lead.custom_data);
  const whatsappJid = getWhatsAppJidValue(lead.custom_data);

  return source === "WhatsApp" || !!whatsappJid;
}

function isChatVisibleThread(row: ChatThreadRow) {
  if (row.thread_kind === "channel") {
    return true;
  }

  if (isOpportunityStatus(row.status)) {
    return false;
  }

  const source = getSourceValue(row.custom_data);
  const whatsappJid = getWhatsAppJidValue(row.custom_data);

  return source === "WhatsApp" || !!whatsappJid;
}

function mapThread(row: ChatThreadRow): Thread {
  const derivedPhone = extractPhoneFromThreadId(row.thread_id);

  return {
    id: row.thread_id,
    leadId: row.lead_id || undefined,
    title: row.title,
    preview: row.preview || "",
    time: formatClock(row.last_message_at),
    unread: row.unread,
    phone: row.phone || derivedPhone || "",
    agentIds: row.agent_ids || [],
    status: row.status || undefined,
    score: row.score || 0,
    funnelId: row.funnel_id || undefined,
    customData: (row.custom_data as Record<string, unknown>) || {},
  };
}

function mapMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    threadId: row.thread_id,
    agent: row.agent,
    role: row.role,
    content: row.content,
    time: formatClock(row.created_at),
    isSystem: row.is_system,
  };
}

async function getDefaultLeadFunnel() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("funnels")
    .select("id, stages:funnel_stages(title, order)")
    .eq("type", "lead")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const firstStageTitle = Array.isArray(data?.stages)
    ? [...data.stages]
        .sort((a, b) => Number(a.order) - Number(b.order))
        .find((stage) => stage?.title)?.title || null
    : null;

  return {
    id: data?.id || null,
    firstStageTitle,
  };
}

async function getLeadByThreadId(threadId: string) {
  if (isChannelThread(threadId)) {
    return null;
  }

  const phone = extractPhoneFromThreadId(normalizeChatThreadId(threadId));
  if (!phone) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return isChatEligibleLead(data) ? data : null;
}

export async function getLeadInfoForThread(threadId: string) {
  const lead = await getLeadByThreadId(threadId);
  if (!lead) {
    return {};
  }

  const preferences =
    lead.custom_data && typeof lead.custom_data === "object" && !Array.isArray(lead.custom_data)
      ? Object.fromEntries(
          Object.entries(lead.custom_data as Record<string, unknown>).filter(
            ([key]) => !key.startsWith("whatsapp_") && key !== "lead_notes",
          ),
        )
      : undefined;

  const sharedNotes = getLeadNotesByVisibility(
    lead.custom_data as Record<string, unknown> | null | undefined,
    "ai",
  );

  return {
    id: lead.id,
    name: lead.name || undefined,
    phone: lead.phone || undefined,
    status: lead.status || undefined,
    preferences,
    notes: sharedNotes.map((note) => note.content),
  };
}

async function ensureThreadRecord(threadId: string, seed?: Partial<Thread>) {
  const normalizedThreadId = normalizeChatThreadId(threadId);
  const supabase = createAdminSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from("chat_threads")
    .select("*")
    .eq("thread_id", normalizedThreadId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const lead = await getLeadByThreadId(normalizedThreadId);
  const defaults = isChannelThread(normalizedThreadId) ? channelDefaults(normalizedThreadId) : null;
  const phone = seed?.phone || lead?.phone || extractPhoneFromThreadId(normalizedThreadId);

  const insertPayload: Database["public"]["Tables"]["chat_threads"]["Insert"] = {
    thread_id: normalizedThreadId,
    title:
      seed?.title ||
      (lead?.name && lead.name !== "Lead" ? lead.name : undefined) ||
      defaults?.title ||
      `Lead: ${phone || threadId}`,
    preview: seed?.preview || lead?.preview || defaults?.preview || "",
    phone,
    unread: seed?.unread ?? lead?.unread ?? false,
    agent_ids: seed?.agentIds || [],
    status: seed?.status || lead?.status || defaults?.status || null,
    score: seed?.score ?? lead?.score ?? 0,
    funnel_id: seed?.funnelId || lead?.funnel_id || null,
    custom_data: (seed?.customData || lead?.custom_data || {}) as Database["public"]["Tables"]["chat_threads"]["Insert"]["custom_data"],
    thread_kind: isChannelThread(normalizedThreadId) ? "channel" : "lead",
    lead_id: lead?.id || null,
  };

  const { data: created, error: createError } = await supabase
    .from("chat_threads")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError) {
    throw createError;
  }

  return created;
}

export async function syncLeadThreadFromLead(lead: LeadRow) {
  const supabase = createAdminSupabaseClient();
  const threadId = `${lead.phone}@s.whatsapp.net`;

  if (!isChatEligibleLead(lead)) {
    const { error: deleteError } = await supabase.from("chat_threads").delete().eq("thread_id", threadId);
    if (deleteError) {
      throw deleteError;
    }
    return;
  }

  const { error } = await supabase.from("chat_threads").upsert({
    thread_id: threadId,
    title: lead.name && lead.name !== "Lead" ? lead.name : `Lead: ${lead.phone}`,
    preview: lead.preview || "Sem mensagens",
    phone: lead.phone,
    unread: lead.unread ?? false,
    status: lead.status,
    score: lead.score ?? 0,
    funnel_id: lead.funnel_id,
    custom_data: (lead.custom_data || {}) as Database["public"]["Tables"]["chat_threads"]["Insert"]["custom_data"],
    thread_kind: "lead",
    lead_id: lead.id,
    last_message_at: lead.updated_at || lead.created_at,
    updated_at: lead.updated_at || lead.created_at,
  }, { onConflict: "thread_id" });

  if (error) {
    throw error;
  }
}

export async function getChatThreads() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).filter(isChatVisibleThread).map(mapThread);
}

export async function getThreadMessages(threadId: string) {
  const normalizedThreadId = normalizeChatThreadId(threadId);
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("thread_id", normalizedThreadId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data || []).map(mapMessage);
}

export async function getRecentMessages(limit = 50) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map(mapMessage).reverse();
}

export async function createLead(data: Partial<Thread> & { phone: string; title?: string }) {
  const supabase = createAdminSupabaseClient();
  const defaultLeadFunnel = await getDefaultLeadFunnel();
  const funnelId =
    data.funnelId === "default" || !data.funnelId
      ? defaultLeadFunnel.id
      : data.funnelId;
  const normalizedStatus =
    !data.status || data.status === "novo"
      ? defaultLeadFunnel.firstStageTitle || "Novo Lead"
      : data.status;

  const insertPayload: Database["public"]["Tables"]["leads"]["Insert"] = {
    phone: data.phone,
    name: data.title || `Lead: ${data.phone}`,
    preview: "Lead criado manualmente",
    status: normalizedStatus,
    unread: false,
    funnel_id: funnelId,
    score: data.score || 0,
    custom_data: (data.customData || {}) as Database["public"]["Tables"]["leads"]["Insert"]["custom_data"],
  };

  const { data: lead, error } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await syncLeadThreadFromLead(lead);
  return mapThread(await ensureThreadRecord(`${lead.phone}@s.whatsapp.net`));
}

export async function updateLeadStatus(leadId: string, status: string) {
  return updateLead(leadId, { status });
}

export async function updateLead(leadId: string, data: Partial<Thread>) {
  const supabase = createAdminSupabaseClient();
  const updatePayload: Database["public"]["Tables"]["leads"]["Update"] = {};

  if (data.title !== undefined) updatePayload.name = data.title;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.preview !== undefined) updatePayload.preview = data.preview;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.unread !== undefined) updatePayload.unread = data.unread;
  if (data.score !== undefined) updatePayload.score = data.score;
  if (data.funnelId !== undefined && data.funnelId !== "default") updatePayload.funnel_id = data.funnelId;
  if (data.customData !== undefined) {
    updatePayload.custom_data = data.customData as Database["public"]["Tables"]["leads"]["Update"]["custom_data"];
  }

  const { data: updatedLead, error } = await supabase
    .from("leads")
    .update(updatePayload)
    .eq("id", leadId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await syncLeadThreadFromLead(updatedLead);
  return updatedLead;
}

export async function deleteLead(leadId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: lead } = await supabase
    .from("leads")
    .select("phone")
    .eq("id", leadId)
    .maybeSingle();

  const { error } = await supabase.from("leads").delete().eq("id", leadId);
  if (error) {
    throw error;
  }

  if (lead?.phone) {
    await supabase.from("chat_threads").delete().eq("thread_id", `${lead.phone}@s.whatsapp.net`);
  }
}

export async function addMessage(msg: Omit<ChatMessage, "id" | "time">) {
  const supabase = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();
  const normalizedThreadId = normalizeChatThreadId(msg.threadId);
  const thread = await ensureThreadRecord(normalizedThreadId);
  const nextAgentIds = !thread.agent_ids.includes(msg.agent) && !msg.isSystem && msg.role !== "Client"
    ? [...thread.agent_ids, msg.agent]
    : thread.agent_ids;
  const titleShouldUpdate =
    msg.role === "Client" &&
    msg.agent !== "Lead" &&
    (thread.title.startsWith("Lead: ") || (!!thread.phone && thread.title === thread.phone));

  const updatedTitle = titleShouldUpdate ? msg.agent : thread.title;

  const { data: insertedMessage, error: messageError } = await supabase
    .from("chat_messages")
    .insert({
      thread_id: normalizedThreadId,
      agent: msg.agent,
      role: msg.role,
      content: msg.content,
      is_system: msg.isSystem ?? false,
      created_at: nowIso,
    })
    .select("*")
    .single();

  if (messageError) {
    throw messageError;
  }

  const { error: threadError } = await supabase
    .from("chat_threads")
    .update({
      title: updatedTitle,
      preview: msg.content,
      unread: msg.role === "Client" ? true : thread.unread,
      agent_ids: nextAgentIds,
      last_message_at: nowIso,
      updated_at: nowIso,
    })
    .eq("thread_id", normalizedThreadId);

  if (threadError) {
    throw threadError;
  }

  if (thread.lead_id) {
    const leadUpdate: Database["public"]["Tables"]["leads"]["Update"] = {
      preview: msg.content,
      unread: msg.role === "Client" ? true : false,
      updated_at: nowIso,
    };

    if (titleShouldUpdate) {
      leadUpdate.name = msg.agent;
    }

    const { error: leadError } = await supabase
      .from("leads")
      .update(leadUpdate)
      .eq("id", thread.lead_id);

    if (leadError) {
      throw leadError;
    }
  }

  return mapMessage(insertedMessage);
}

export async function markThreadRead(threadId: string) {
  const normalizedThreadId = normalizeChatThreadId(threadId);
  const supabase = createAdminSupabaseClient();
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .select("lead_id")
    .eq("thread_id", normalizedThreadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  await supabase.from("chat_threads").update({ unread: false }).eq("thread_id", normalizedThreadId);

  if (thread?.lead_id) {
    await supabase.from("leads").update({ unread: false }).eq("id", thread.lead_id);
  }
}

export function setTyping(threadId: string, agentLabel: string | null) {
  const normalizedThreadId = normalizeChatThreadId(threadId);
  if (agentLabel) {
    typingStore.set(normalizedThreadId, agentLabel);
  } else {
    typingStore.delete(normalizedThreadId);
  }
}

export function getTyping(threadId: string): string | null {
  return typingStore.get(normalizeChatThreadId(threadId)) || null;
}

export async function getThreadHistoryForGraph(threadId: string) {
  const messages = await getThreadMessages(normalizeChatThreadId(threadId));

  return messages.map((message): BaseMessage => {
    if (message.isSystem) {
      return new SystemMessage(message.content);
    }

    if (message.role === "Client" || message.role === "CEO") {
      return new HumanMessage(message.content);
    }

    return new AIMessage({ content: message.content, name: message.agent });
  });
}
