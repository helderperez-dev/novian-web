import { novianAIGraph } from "@/lib/agents/graph";
import type { AgentState } from "@/lib/agents/state";
import { findAgentConfig } from "@/lib/agents/configStore";
import { addMessage, getLeadInfoForThread, getThreadHistoryForGraph, getThreadMessages, normalizeChatThreadId, setTyping, syncLeadThreadFromLead } from "@/lib/chatStore";
import type { Database } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fetchEvolutionContactProfile, type EvolutionContactProfile, sendEvolutionPresence, sendEvolutionText } from "@/lib/whatsapp/evolution";

type JsonRecord = Record<string, unknown>;

function extractPhone(value: string) {
  const [jidPart] = value.split("@");
  return jidPart.replace(/\D/g, "") || null;
}

function isMeaningfulLeadName(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized !== "" && normalized !== "lead";
}

function getMessageType(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    _getType?: () => string;
    getType?: () => string;
    type?: string;
    role?: string;
  };

  try {
    return (
      candidate._getType?.() ||
      candidate.getType?.() ||
      candidate.type ||
      candidate.role ||
      null
    );
  } catch {
    return candidate.type || candidate.role || null;
  }
}

function getMessageTextContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  if (value && typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }

  return "";
}

function extractReplyFromGraphMessages(messages: unknown): string | null {
  if (!Array.isArray(messages)) {
    return null;
  }

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const messageType = getMessageType(message)?.toLowerCase();
    if (messageType !== "ai" && messageType !== "assistant") {
      continue;
    }

    const content =
      message && typeof message === "object" && "content" in message
        ? getMessageTextContent(message.content)
        : "";

    if (content) {
      return content;
    }
  }

  return null;
}

function buildLeadCustomData(params: {
  agentId: string;
  pushName: string;
  textMessage: string;
  threadId: string;
  rawJid: string;
  phone: string | null;
  profile?: EvolutionContactProfile | null;
  existingCustomData?: JsonRecord | null;
}) {
  const existing = params.existingCustomData || {};
  const existingAssignedAgentId =
    typeof existing.agent_id === "string" && existing.agent_id.trim() ? existing.agent_id.trim() : null;

  return {
    ...existing,
    source: "WhatsApp",
    agent_id: existingAssignedAgentId || params.agentId,
    whatsapp_session_agent_id: params.agentId,
    whatsapp_jid: params.profile?.jid || params.rawJid,
    whatsapp_thread_id: params.threadId,
    whatsapp_phone:
      params.profile?.phone || params.phone || (typeof existing.whatsapp_phone === "string" ? existing.whatsapp_phone : null),
    whatsapp_push_name:
      params.profile?.pushName ||
      params.pushName ||
      (typeof existing.whatsapp_push_name === "string" ? existing.whatsapp_push_name : null),
    whatsapp_profile_name:
      params.profile?.displayName ||
      (typeof existing.whatsapp_profile_name === "string" ? existing.whatsapp_profile_name : null),
    whatsapp_profile_picture_url:
      params.profile?.profilePictureUrl ||
      (typeof existing.whatsapp_profile_picture_url === "string" ? existing.whatsapp_profile_picture_url : null),
    whatsapp_about:
      params.profile?.about || (typeof existing.whatsapp_about === "string" ? existing.whatsapp_about : null),
    whatsapp_business_description:
      params.profile?.businessDescription ||
      (typeof existing.whatsapp_business_description === "string" ? existing.whatsapp_business_description : null),
    whatsapp_business_category:
      params.profile?.businessCategory ||
      (typeof existing.whatsapp_business_category === "string" ? existing.whatsapp_business_category : null),
    whatsapp_business_email:
      params.profile?.businessEmail ||
      (typeof existing.whatsapp_business_email === "string" ? existing.whatsapp_business_email : null),
    whatsapp_business_website:
      params.profile?.businessWebsite ||
      (typeof existing.whatsapp_business_website === "string" ? existing.whatsapp_business_website : null),
    whatsapp_business_address:
      params.profile?.businessAddress ||
      (typeof existing.whatsapp_business_address === "string" ? existing.whatsapp_business_address : null),
    whatsapp_last_message_preview: params.textMessage.substring(0, 100),
  };
}

async function upsertLeadFromIncoming(params: {
  agentId: string;
  pushName: string;
  textMessage: string;
  threadId: string;
  rawJid: string;
  phone: string | null;
  profile?: EvolutionContactProfile | null;
}) {
  const supabase = createAdminSupabaseClient();

  if (!params.phone) {
    const nowIso = new Date().toISOString();
    const metadataCustomData = buildLeadCustomData(params);
    const { error } = await supabase.from("chat_threads").upsert(
      {
        thread_id: params.threadId,
        title: params.pushName,
        preview: params.textMessage.substring(0, 100),
        phone: null,
        unread: true,
        agent_ids: [],
        status: "Novo Lead",
        score: 0,
        custom_data: metadataCustomData as Database["public"]["Tables"]["chat_threads"]["Insert"]["custom_data"],
        thread_kind: "lead",
        lead_id: null,
        last_message_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "thread_id" },
    );

    if (error) {
      throw error;
    }

    return;
  }

  const { data: existingLead } = await supabase.from("leads").select("*").eq("phone", params.phone).maybeSingle();

  if (!existingLead) {
    const metadataCustomData = buildLeadCustomData(params);
    const { data: funnel } = await supabase
      .from("funnels")
      .select("id")
      .eq("type", "lead")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: insertedLead, error } = await supabase
      .from("leads")
      .insert({
        name: params.profile?.displayName || params.profile?.pushName || params.pushName,
        phone: params.phone,
        preview: params.textMessage.substring(0, 100),
        status: "Novo Lead",
        unread: true,
        funnel_id: funnel?.id || null,
        score: 0,
        custom_data: metadataCustomData,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await syncLeadThreadFromLead(insertedLead);
    return;
  }

  const mergedCustomData = {
    ...buildLeadCustomData({
      ...params,
      existingCustomData: (existingLead.custom_data as JsonRecord | null) || null,
    }),
  } satisfies JsonRecord;

  const { data: updatedLead, error } = await supabase
    .from("leads")
    .update({
      name: isMeaningfulLeadName(existingLead.name)
        ? existingLead.name
        : params.profile?.displayName || params.profile?.pushName || params.pushName,
      preview: params.textMessage.substring(0, 100),
      unread: true,
      custom_data: mergedCustomData,
    })
    .eq("id", existingLead.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await syncLeadThreadFromLead(updatedLead);
}

export async function refreshLeadWhatsAppProfile(params: {
  agentId: string;
  jidOrPhone: string;
  fallbackName?: string | null;
}) {
  const normalizedThreadId = normalizeChatThreadId(params.jidOrPhone);
  const phone = extractPhone(normalizedThreadId);
  const profile = await fetchEvolutionContactProfile(params.agentId, normalizedThreadId).catch(() => null);

  if (!phone) {
    return {
      threadId: normalizedThreadId,
      phone: null,
      profile,
    };
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingLead } = await supabase.from("leads").select("*").eq("phone", phone).maybeSingle();

  if (!existingLead) {
    return {
      threadId: normalizedThreadId,
      phone,
      profile,
    };
  }

  const mergedCustomData = buildLeadCustomData({
    agentId: params.agentId,
    pushName: params.fallbackName || existingLead.name || "Lead",
    textMessage: existingLead.preview || "",
    threadId: normalizedThreadId,
    rawJid: normalizedThreadId,
    phone,
    profile,
    existingCustomData: (existingLead.custom_data as JsonRecord | null) || null,
  });

  const { data: updatedLead, error } = await supabase
    .from("leads")
    .update({
      name: isMeaningfulLeadName(existingLead.name)
        ? existingLead.name
        : profile?.displayName || profile?.pushName || params.fallbackName || existingLead.name,
      custom_data: mergedCustomData,
      updated_at: new Date().toISOString(),
    })
    .eq("id", existingLead.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await syncLeadThreadFromLead(updatedLead);

  return {
    threadId: normalizedThreadId,
    phone,
    profile,
  };
}

export async function processIncomingWhatsAppText(params: {
  agentId: string;
  remoteJid: string;
  pushName?: string | null;
  textMessage: string;
}) {
  const normalizedThreadId = normalizeChatThreadId(params.remoteJid);
  const phone = extractPhone(normalizedThreadId);
  const pushName = params.pushName || "Lead";
  const profile = await fetchEvolutionContactProfile(params.agentId, normalizedThreadId).catch(() => null);

  await upsertLeadFromIncoming({
    agentId: params.agentId,
    pushName,
    textMessage: params.textMessage,
    threadId: normalizedThreadId,
    rawJid: params.remoteJid,
    phone,
    profile,
  });

  await addMessage({
    threadId: normalizedThreadId,
    agent: pushName,
    role: "Client",
    content: params.textMessage,
  });

  const leadInfo = await getLeadInfoForThread(normalizedThreadId);
  const replyAgentId = leadInfo.assignedAgentId || params.agentId;
  const agentConfig = await findAgentConfig(replyAgentId).catch(() => null);
  const typingLabel = agentConfig ? `${agentConfig.name.split(" ")[0]} (${agentConfig.role})` : params.agentId;
  const messageCountBeforeGraph = (await getThreadMessages(normalizedThreadId)).length;

  setTyping(normalizedThreadId, typingLabel);

  try {
    await sendEvolutionPresence(params.agentId, normalizedThreadId, "composing", 2500).catch((error) => {
      console.warn(`[${params.agentId}] Evolution presence failed:`, error);
    });

    const history = await getThreadHistoryForGraph(normalizedThreadId);
    const response = await novianAIGraph.invoke(
      {
        messages: history,
        sender: normalizedThreadId,
        threadId: normalizedThreadId,
        leadInfo,
        nextAgent: replyAgentId,
      } satisfies AgentState,
      { recursionLimit: 50 },
    );

    const graphReply = extractReplyFromGraphMessages((response as { messages?: unknown }).messages);
    const persistedMessages = await getThreadMessages(normalizedThreadId);
    const persistedReply =
      persistedMessages
        .slice(messageCountBeforeGraph)
        .reverse()
        .find((message) => message.role !== "Client" && !message.isSystem)?.content || null;

    const replyContent = (graphReply || persistedReply || "").trim();
    if (!replyContent) {
      console.warn(`[${replyAgentId}] No AI reply extracted for ${normalizedThreadId}`);
      return;
    }

    await sendEvolutionText(params.agentId, normalizedThreadId, replyContent, { delayMs: 1200, linkPreview: true });
    console.log(`[${replyAgentId}] Sent WhatsApp AI reply to ${normalizedThreadId} via session ${params.agentId}`);
  } catch (error) {
    console.error(`[${replyAgentId}] Failed to generate or send WhatsApp AI reply`, error);
    throw error;
  } finally {
    setTyping(normalizedThreadId, null);
  }
}
