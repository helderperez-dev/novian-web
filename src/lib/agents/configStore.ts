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

  return (data as AgentRow[]).map(mapRowToAgentConfig);
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
