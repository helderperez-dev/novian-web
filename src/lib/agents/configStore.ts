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
