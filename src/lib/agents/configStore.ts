import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AgentConfig } from "@/lib/store";
import { defaultAgentConfigs } from "@/lib/store";

type AgentRow = {
  id: string;
  knowledge_base: string | null;
  modules: string[] | null;
  name: string;
  role: string;
  system_prompt: string;
  whatsapp_display_name?: string | null;
  whatsapp_phone?: string | null;
  whatsapp_profile_picture_url?: string | null;
};

let hasSeededAgents = false;

export const AI_COPY_ASSISTANT_ID = "novian-copy-assistant";
export const DEFAULT_AI_COPY_PROMPT = `You are Novian's premium real-estate copy assistant.

Your job is to help internal users write sharper text for CRM and property marketing fields.

Rules:
- Always write in Brazilian Portuguese unless the user explicitly requests another language.
- Preserve factual details already provided. Never invent numbers, addresses, amenities, legal claims, or availability.
- Match the requested field. Short fields stay concise. Rich-description fields can be more elaborate.
- Keep the tone refined, premium, clear, persuasive, and natural. Avoid exaggerated or generic AI phrasing.
- If the request is to enhance text, keep the original intent and improve clarity, flow, and impact.
- If the request is to generate text, use the provided context to create the best possible draft for that field.
- Return only the requested content, with no explanations.
- For "rich_html" output, return clean HTML fragments only using tags like p, h2, ul, li, strong, and em.
- For "plain_text" output, return plain text only.`;

function mapRowToAgentConfig(row: AgentRow): AgentConfig {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    systemPrompt: row.system_prompt,
    modules: row.modules || [],
    knowledgeBase: row.knowledge_base || "",
    whatsappDisplayName: row.whatsapp_display_name || undefined,
    whatsappPhone: row.whatsapp_phone || undefined,
    whatsappProfilePictureUrl: row.whatsapp_profile_picture_url || undefined,
  };
}

function isReservedSystemAgent(row: { id: string; role: string }) {
  return row.id === AI_COPY_ASSISTANT_ID || row.role === "system";
}

async function ensureDefaultAgentsSeeded() {
  if (hasSeededAgents) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const seedPayload = defaultAgentConfigs.map((agent) => ({
    id: agent.id,
    name: agent.name,
    role: agent.role,
    system_prompt: agent.systemPrompt,
    modules: agent.modules || [],
    knowledge_base: agent.knowledgeBase || "",
  }));

  const { error } = await supabase
    .from("agents")
    .upsert(seedPayload, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    throw error;
  }

  hasSeededAgents = true;
}

export async function listAgentConfigs(): Promise<AgentConfig[]> {
  await ensureDefaultAgentsSeeded();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("agents").select("*").order("created_at");

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return defaultAgentConfigs;
  }

  return (data as AgentRow[])
    .filter((row) => !isReservedSystemAgent(row))
    .map(mapRowToAgentConfig);
}

export async function getAgentConfig(agentId: string): Promise<AgentConfig | null> {
  const agents = await listAgentConfigs();
  return agents.find((agent) => agent.id === agentId) || null;
}

export async function findAgentConfig(agentId: string): Promise<AgentConfig | null> {
  const agents = await listAgentConfigs();
  return (
    agents.find((agent) => agent.id === agentId) ||
    agents.find((agent) => agent.id.startsWith(agentId) || agent.id.includes(agentId)) ||
    null
  );
}

export async function upsertAgentConfig(agent: AgentConfig): Promise<AgentConfig> {
  await ensureDefaultAgentsSeeded();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .upsert(
      {
        id: agent.id,
        name: agent.name,
        role: agent.role,
        system_prompt: agent.systemPrompt || "",
        modules: agent.modules || [],
        knowledge_base: agent.knowledgeBase || "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapRowToAgentConfig(data as AgentRow);
}

export async function getAiCopyAssistantPrompt(): Promise<string> {
  await ensureDefaultAgentsSeeded();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", AI_COPY_ASSISTANT_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return DEFAULT_AI_COPY_PROMPT;
  }

  return (data as AgentRow).system_prompt || DEFAULT_AI_COPY_PROMPT;
}

export async function saveAiCopyAssistantPrompt(systemPrompt: string): Promise<string> {
  await ensureDefaultAgentsSeeded();

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("agents")
    .upsert(
      {
        id: AI_COPY_ASSISTANT_ID,
        name: "Assistente de Texto",
        role: "system",
        system_prompt: systemPrompt || DEFAULT_AI_COPY_PROMPT,
        modules: [],
        knowledge_base: "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return (data as AgentRow).system_prompt || DEFAULT_AI_COPY_PROMPT;
}

export async function updateAgentWhatsAppProfile(
  agentId: string,
  profile: {
    displayName?: string | null;
    phone?: string | null;
    profilePictureUrl?: string | null;
  },
): Promise<void> {
  await ensureDefaultAgentsSeeded();

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("agents")
    .update({
      whatsapp_display_name: profile.displayName ?? null,
      whatsapp_phone: profile.phone ?? null,
      whatsapp_profile_picture_url: profile.profilePictureUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  if (error) {
    throw error;
  }
}
