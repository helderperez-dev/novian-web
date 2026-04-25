import { novianAIGraph } from "@/lib/agents/graph";
import type { AgentState } from "@/lib/agents/state";
import { addMessage, getLeadInfoForThread, getThreadHistoryForGraph, normalizeChatThreadId, syncLeadThreadFromLead } from "@/lib/chatStore";
import type { Database } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEvolutionText } from "@/lib/whatsapp/evolution";

type JsonRecord = Record<string, unknown>;

function extractPhone(value: string) {
  const [jidPart] = value.split("@");
  return jidPart.replace(/\D/g, "") || null;
}

async function upsertLeadFromIncoming(params: {
  agentId: string;
  pushName: string;
  textMessage: string;
  threadId: string;
  rawJid: string;
  phone: string | null;
}) {
  const supabase = createAdminSupabaseClient();
  const metadataCustomData = {
    source: "WhatsApp",
    agent_id: params.agentId,
    whatsapp_jid: params.rawJid,
    whatsapp_thread_id: params.threadId,
  };

  if (!params.phone) {
    const nowIso = new Date().toISOString();
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
        name: params.pushName,
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
    ...((existingLead.custom_data as JsonRecord | null) || {}),
    ...metadataCustomData,
  };

  const { data: updatedLead, error } = await supabase
    .from("leads")
    .update({
      name: existingLead.name && existingLead.name !== "Lead" ? existingLead.name : params.pushName,
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

export async function processIncomingWhatsAppText(params: {
  agentId: string;
  remoteJid: string;
  pushName?: string | null;
  textMessage: string;
}) {
  const normalizedThreadId = normalizeChatThreadId(params.remoteJid);
  const phone = extractPhone(normalizedThreadId);
  const pushName = params.pushName || "Lead";

  await upsertLeadFromIncoming({
    agentId: params.agentId,
    pushName,
    textMessage: params.textMessage,
    threadId: normalizedThreadId,
    rawJid: params.remoteJid,
    phone,
  });

  await addMessage({
    threadId: normalizedThreadId,
    agent: pushName,
    role: "Client",
    content: params.textMessage,
  });

  const history = await getThreadHistoryForGraph(normalizedThreadId);
  const response = await novianAIGraph.invoke(
    {
      messages: history,
      sender: normalizedThreadId,
      threadId: normalizedThreadId,
      leadInfo: await getLeadInfoForThread(normalizedThreadId),
      nextAgent: params.agentId,
    } satisfies AgentState,
    { recursionLimit: 50 },
  );

  const allMsgs = (response as { messages?: Array<{ content?: unknown; _getType?: () => string }> }).messages ?? [];
  const lastMessage = allMsgs[allMsgs.length - 1];

  if (lastMessage && lastMessage.content && lastMessage._getType?.() === "ai") {
    const replyContent = lastMessage.content.toString();
    await sendEvolutionText(params.agentId, normalizedThreadId, replyContent);
  }
}
