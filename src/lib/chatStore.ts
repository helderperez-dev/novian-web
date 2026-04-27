import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { getLeadNotesByVisibility } from "@/lib/leadNotes";
import { listPersonPropertyLinksByPersonIds } from "./personProperties";
import { ensurePersonForLead, getPersonByPhone, getPersonCrm, getPersonMetadata, isChatEligiblePerson, isOpportunityStatus, updatePersonLeadState, deleteLeadPerson } from "./people";
import type { ChatMessage, Thread } from "@/lib/store";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
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

function normalizeWhatsAppJid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.includes("@")) {
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `${digits}@s.whatsapp.net` : trimmed;
  }

  const [userPart, serverPart] = trimmed.split("@");
  const [phonePart, devicePart] = userPart.split(":");
  const digits = phonePart.replace(/\D/g, "");
  const normalizedUser = digits ? (devicePart ? `${digits}:${devicePart}` : digits) : userPart;
  return `${normalizedUser}@${serverPart.toLowerCase()}`;
}

function isPhoneNumberJid(value: string) {
  return /@(?:s\.whatsapp\.net|c\.us)$/i.test(value);
}

function extractPhoneFromThreadId(threadId: string) {
  if (isChannelThread(threadId)) {
    return null;
  }

  const normalized = normalizeWhatsAppJid(threadId) || threadId;
  if (!isPhoneNumberJid(normalized)) {
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

  return normalizeWhatsAppJid(trimmed) || trimmed;
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

function isChatVisibleThread(row: ChatThreadRow) {
  if (row.thread_kind === "channel") {
    return true;
  }

  if (isOpportunityStatus(row.status)) {
    return false;
  }

  const customData =
    row.custom_data && typeof row.custom_data === "object" && !Array.isArray(row.custom_data)
      ? (row.custom_data as Record<string, unknown>)
      : {};
  const source = typeof customData.source === "string" ? customData.source : null;
  const whatsappJid = typeof customData.whatsapp_jid === "string" ? customData.whatsapp_jid : null;

  return source === "WhatsApp" || Boolean(whatsappJid);
}

function mapThread(row: ChatThreadRow): Thread {
  const derivedPhone = extractPhoneFromThreadId(row.thread_id);

  return {
    id: row.thread_id,
    leadId: row.person_id || undefined,
    agentId: getThreadAgentId(row) || undefined,
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

function normalizeAgentAssignmentId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.split("/")[0] || null;
}

function getThreadAgentId(row: ChatThreadRow): string | null {
  const customData =
    row.custom_data && typeof row.custom_data === "object" && !Array.isArray(row.custom_data)
      ? (row.custom_data as Record<string, unknown>)
      : {};
  const customAgentId = normalizeAgentAssignmentId(typeof customData.agent_id === "string" ? customData.agent_id : null);
  if (customAgentId) {
    return customAgentId;
  }

  const firstAgentId = Array.isArray(row.agent_ids) ? row.agent_ids.find((value) => typeof value === "string" && value.trim()) : null;
  return normalizeAgentAssignmentId(firstAgentId);
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

async function getPersonByThreadId(threadId: string) {
  if (isChannelThread(threadId)) {
    return null;
  }

  const phone = extractPhoneFromThreadId(normalizeChatThreadId(threadId));
  if (!phone) {
    return null;
  }

  const person = await getPersonByPhone(phone);
  return isChatEligiblePerson(person) ? person : null;
}

export async function getLeadInfoForThread(threadId: string) {
  const person = await getPersonByThreadId(threadId);
  if (!person) {
    return {};
  }

  const customData = getPersonMetadata(person);
  const preferences = Object.fromEntries(
    Object.entries(customData).filter(([key]) => !key.startsWith("whatsapp_") && key !== "lead_notes"),
  );

  const sharedNotes = getLeadNotesByVisibility(
    person.metadata as Record<string, unknown> | null | undefined,
    "ai",
  );

  const whatsappProfile = Object.fromEntries(
    Object.entries(customData).filter(
      ([key]) =>
        key.startsWith("whatsapp_") &&
        key !== "whatsapp_jid" &&
        key !== "whatsapp_thread_id" &&
        key !== "whatsapp_last_message_preview",
    ),
  );

  const linkedProperties =
    (await listPersonPropertyLinksByPersonIds([person.id])).get(person.id)?.flatMap((link) => {
      if (!link.property) {
        return [];
      }

      return [
        {
          relationshipType: link.relationshipType,
          notes: link.notes || undefined,
          property: {
            id: link.property.id,
            title: link.property.title,
            slug: link.property.slug || undefined,
            address: link.property.address || undefined,
            price: link.property.price,
            status: link.property.status,
          },
        },
      ];
    }) || [];

  return {
    id: person.id,
    name: person.full_name || undefined,
    phone: person.primary_phone || undefined,
    email: person.email || undefined,
    roles: person.roles || undefined,
    score: person.crm_score ?? undefined,
    status: person.crm_status || undefined,
    preferences,
    notes: sharedNotes.map((note) => note.content),
    source: typeof customData.source === "string" ? customData.source : undefined,
    assignedAgentId: typeof customData.agent_id === "string" ? customData.agent_id : undefined,
    whatsappProfile: Object.keys(whatsappProfile).length > 0 ? whatsappProfile : undefined,
    linkedProperties: linkedProperties.length > 0 ? linkedProperties : undefined,
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

  const person = await getPersonByThreadId(normalizedThreadId);
  const crm = getPersonCrm(person);
  const defaults = isChannelThread(normalizedThreadId) ? channelDefaults(normalizedThreadId) : null;
  const phone = seed?.phone || person?.primary_phone || extractPhoneFromThreadId(normalizedThreadId);

  const insertPayload: Database["public"]["Tables"]["chat_threads"]["Insert"] = {
    thread_id: normalizedThreadId,
    title:
      seed?.title ||
      (person?.full_name ? person.full_name : undefined) ||
      defaults?.title ||
      `Lead: ${phone || threadId}`,
    preview: seed?.preview || person?.last_interaction_preview || defaults?.preview || "",
    phone,
    unread: seed?.unread ?? crm?.unread ?? false,
    agent_ids: seed?.agentIds || [],
    status: seed?.status || crm?.status || defaults?.status || null,
    score: seed?.score ?? crm?.score ?? 0,
    funnel_id: seed?.funnelId || crm?.funnelId || null,
    custom_data:
      (seed?.customData || getPersonMetadata(person || null) || {}) as Database["public"]["Tables"]["chat_threads"]["Insert"]["custom_data"],
    thread_kind: isChannelThread(normalizedThreadId) ? "channel" : "lead",
    person_id: person?.id || null,
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

export async function syncLeadThreadFromLead(person: PersonRow) {
  const supabase = createAdminSupabaseClient();
  const threadId = person.primary_phone ? `${person.primary_phone}@s.whatsapp.net` : null;

  if (!threadId) {
    return;
  }

  if (!isChatEligiblePerson(person)) {
    const { error: deleteError } = await supabase.from("chat_threads").delete().eq("thread_id", threadId);
    if (deleteError) {
      throw deleteError;
    }
    return;
  }

  const crm = getPersonCrm(person);
  const { error } = await supabase.from("chat_threads").upsert(
    {
      thread_id: threadId,
      title: person.full_name || `Lead: ${person.primary_phone}`,
      preview: person.last_interaction_preview || "Sem mensagens",
      phone: person.primary_phone,
      unread: crm?.unread ?? false,
      status: crm?.status ?? null,
      score: crm?.score ?? 0,
      funnel_id: crm?.funnelId ?? null,
      custom_data: (getPersonMetadata(person) || {}) as Database["public"]["Tables"]["chat_threads"]["Insert"]["custom_data"],
      thread_kind: "lead",
      person_id: person.id,
      last_message_at: person.updated_at || person.created_at,
      updated_at: person.updated_at || person.created_at,
    },
    { onConflict: "thread_id" },
  );

  if (error) {
    throw error;
  }
}

export async function getChatThreads(agentId?: string | null) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("chat_threads")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  const normalizedAgentId = normalizeAgentAssignmentId(agentId) || "";

  return (data || [])
    .filter(isChatVisibleThread)
    .filter((row) => {
      if (!normalizedAgentId) {
        return true;
      }

      return getThreadAgentId(row) === normalizedAgentId;
    })
    .map(mapThread);
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

export async function createLead(data: Partial<Thread> & { phone: string; title?: string; personId?: string | null }) {
  const defaultLeadFunnel = await getDefaultLeadFunnel();
  const funnelId = data.funnelId === "default" || !data.funnelId ? defaultLeadFunnel.id : data.funnelId;
  const normalizedStatus =
    !data.status || data.status === "novo" ? defaultLeadFunnel.firstStageTitle || "Novo Lead" : data.status;
  const metadata =
    data.customData && typeof data.customData === "object" && !Array.isArray(data.customData) ? data.customData : {};

  const person = await ensurePersonForLead({
    personId: data.personId,
    name: data.title,
    phone: data.phone,
    email: typeof metadata.email === "string" ? metadata.email : null,
    status: normalizedStatus,
    funnelId,
    score: data.score,
    unread: false,
    preview: "Lead criado manualmente",
    customData: metadata,
  });

  await syncLeadThreadFromLead(person);
  return mapThread(await ensureThreadRecord(`${person.primary_phone}@s.whatsapp.net`));
}

export async function updateLeadStatus(leadId: string, status: string) {
  return updateLead(leadId, { status });
}

export async function updateLead(leadId: string, data: Partial<Thread>) {
  const currentPerson = await getPersonByPhone(leadId.includes("@") ? leadId : leadId);
  const supabase = createAdminSupabaseClient();
  const person =
    currentPerson ||
    (await supabase.from("people").select("*").eq("id", leadId).maybeSingle().then(({ data: item, error }) => {
      if (error) throw error;
      return item;
    }));

  if (!person) {
    throw new Error("Person not found");
  }

  const updatedPerson = await updatePersonLeadState(person.id, {
    title: data.title,
    phone: data.phone,
    email: undefined,
    status: data.status,
    funnelId: data.funnelId === "default" ? null : data.funnelId,
    score: data.score,
    unread: data.unread,
    preview: data.preview,
    customData: data.customData,
  });

  if (person.primary_phone && person.primary_phone !== updatedPerson.primary_phone) {
    await supabase.from("chat_threads").delete().eq("thread_id", `${person.primary_phone}@s.whatsapp.net`);
  }

  await syncLeadThreadFromLead(updatedPerson);
  return updatedPerson;
}

export async function deleteLead(leadId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: person, error } = await supabase.from("people").select("*").eq("id", leadId).maybeSingle();
  if (error) {
    throw error;
  }

  if (!person) {
    return;
  }

  if (person.primary_phone) {
    await supabase.from("chat_threads").delete().eq("thread_id", `${person.primary_phone}@s.whatsapp.net`);
  }

  await deleteLeadPerson(person.id);
}

export async function addMessage(msg: Omit<ChatMessage, "id" | "time">) {
  const supabase = createAdminSupabaseClient();
  const nowIso = new Date().toISOString();
  const normalizedThreadId = normalizeChatThreadId(msg.threadId);
  const thread = await ensureThreadRecord(normalizedThreadId);
  const nextAgentIds =
    !thread.agent_ids.includes(msg.agent) && !msg.isSystem && msg.role !== "Client"
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

  if (thread.person_id) {
    const refreshedPerson = await updatePersonLeadState(thread.person_id, {
      title: titleShouldUpdate ? msg.agent : undefined,
      preview: msg.content,
      unread: msg.role === "Client",
    });
    await syncLeadThreadFromLead(refreshedPerson);
  }

  return mapMessage(insertedMessage);
}

export async function markThreadRead(threadId: string) {
  const normalizedThreadId = normalizeChatThreadId(threadId);
  const supabase = createAdminSupabaseClient();
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .select("person_id")
    .eq("thread_id", normalizedThreadId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  await supabase.from("chat_threads").update({ unread: false }).eq("thread_id", normalizedThreadId);

  if (thread?.person_id) {
    const refreshedPerson = await updatePersonLeadState(thread.person_id, { unread: false });
    await syncLeadThreadFromLead(refreshedPerson);
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
