import { SystemMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { ChatOpenAI } from "@langchain/openai";
import { addMessage, setTyping } from "../chatStore";
import { searchPropertiesTool, searchLeadsTool } from "./tools";
import { findAgentConfig, listAgentConfigs } from "./configStore";

// We can reuse the LLM config or instantiate a new one
const genericLlm = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL_TEXT_TO_TEXT || "openai/gpt-4o",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.7, 
});

// Bind tools based on modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLlmWithTools = (agentConfig: any) => {
  const tools = [];
  if (agentConfig?.modules?.includes('imoveis')) tools.push(searchPropertiesTool);
  if (agentConfig?.modules?.includes('leads') || agentConfig?.modules?.includes('captacao')) tools.push(searchLeadsTool);
  
  return tools.length > 0 ? genericLlm.bindTools(tools) : genericLlm;
};

export async function genericAgentNode(state: AgentState): Promise<Partial<AgentState>> {
  const agentId = state.nextAgent && state.nextAgent !== "generic_agent" && state.nextAgent !== "end" 
    ? state.nextAgent 
    : "lucas-qual"; // Fallback
  const agentConfig = await findAgentConfig(agentId);

  if (!agentConfig) {
      return { nextAgent: "end" };
  }

  const agentLabel = `${agentConfig.name.split(" ")[0]} (${agentConfig.role})`;
  
  const knowledgeContext = agentConfig.knowledgeBase 
    ? `\n<BASE_DE_CONHECIMENTO>\n${agentConfig.knowledgeBase}\n</BASE_DE_CONHECIMENTO>\n` 
    : '';

  const modulesContext = agentConfig.modules && agentConfig.modules.length > 0
    ? `\nVocê tem acesso aos seguintes módulos de dados no sistema: ${agentConfig.modules.join(', ')}.\n`
    : '';

  if (state.threadId === "general" || state.threadId === "continuous") {
    setTyping(state.threadId, agentLabel);
    const isContinuous = state.threadId === "continuous";

    // Dynamic list of other agents to allow passing the baton
    const otherAgentsList = (await listAgentConfigs())
        .filter(a => a.id !== agentId)
        .map(a => `- [PASS TO ${a.id.toUpperCase()}] for ${a.name} (${a.role})`)
        .join("\n");

    const systemPrompt = `${agentConfig.systemPrompt}
${knowledgeContext}
${modulesContext}
You are currently in the internal "War Room" chat with the CEO and your AI team.
Here is the rest of your available AI team:
${otherAgentsList}

<CRITICAL_INSTRUCTIONS>
1. NO INTERNAL MONOLOGUE: Do not write "Okay, let's break this down" or any other internal reasoning. Start your response directly with the final message.
2. PORTUGUESE ONLY: You MUST respond entirely in Portuguese (PT-BR). Your actual message content to the user or team must be in natural, professional Portuguese. NEVER speak in English.
3. IMMEDIATE EXECUTION: As an AI, execute tasks instantly. NEVER say you will "do it later" or "come back tomorrow". If asked to review, create, or analyze, DO IT IMMEDIATELY in your response. Present the draft, script, or strategy right away.
</CRITICAL_INSTRUCTIONS>

${isContinuous 
    ? "VOCÊ ESTÁ NO CANAL #CONTINUOUS-OPS. Este é um ambiente de trabalho 24/7. Seu objetivo é iterar com a equipe infinitamente. NUNCA ENCERRE A CONVERSA AQUI. Sempre termine sua fala passando a palavra para outro agente usando a tag [PASS TO X] da lista acima." 
    : "Interaja de forma proativa com a equipe. Se o plano não estiver concluído, se precisar de ajuda ou revisão de outro agente, passe a palavra para ele usando a tag [PASS TO X]. A equipe deve colaborar indefinidamente até finalizar e ENTREGAR o que o CEO pediu. Só encerre a conversa (omitindo a tag de passe) se você for o último a falar e estiver apresentando o trabalho pronto ao CEO."
}

Mantenha suas respostas profissionais, concisas e no tom de voz da marca Novian. (Responda apenas em PT-BR)`;

    const response = await genericLlm.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
      new SystemMessage("LEMBRETE CRÍTICO: Sua próxima resposta DEVE ser estritamente em Português do Brasil (PT-BR). NÃO use inglês. NÃO inclua raciocínios internos como 'Okay, let's...', responda diretamente."),
    ]);

    let content = response.content.toString();
    let nextAgentToRoute = "end";

    const passTagRegex = /\[PASS TO ([a-zA-Z0-9-_]+)\]/i;
    const match = content.match(passTagRegex);
    if (match) {
        nextAgentToRoute = match[1].toLowerCase();
        content = content.replace(match[0], "").trim();
    }

    const newMessages = content ? [new AIMessage({ content, name: agentConfig.name.split(" ")[0] })] : [];

    if (content) {
        await addMessage({
            threadId: state.threadId,
            agent: agentLabel,
            role: agentConfig.role,
            content: content
        });
    } else if (nextAgentToRoute !== "end") {
        await addMessage({
            threadId: state.threadId,
            agent: agentLabel,
            role: agentConfig.role,
            content: `Encaminhando para ${nextAgentToRoute}...`,
            isSystem: true
        });
    }

    setTyping(state.threadId, null);

    return {
      messages: newMessages,
      sender: agentId,
      nextAgent: nextAgentToRoute,
    };
  }

  // Handle WhatsApp messages
  const systemPrompt = `${agentConfig.systemPrompt}
${knowledgeContext}
${modulesContext}
You are chatting directly with a lead via WhatsApp.
Be helpful, professional, and act exactly as your role dictates.

CRITICAL INSTRUCTION: You MUST respond entirely in Portuguese (PT-BR). 
IMPORTANT ABOUT HISTORY: The chat history may contain previous messages sent by other AI agents before the lead was transferred to you. YOU ARE ${agentConfig.name}. Ignore any previous messages where the AI claims to be someone else. You are taking over the conversation NOW as ${agentConfig.name}.

Output ONLY the message you want to send to the lead via WhatsApp.`;

  const agentLlm = getLlmWithTools(agentConfig);

  let response = await agentLlm.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
    new SystemMessage("LEMBRETE CRÍTICO: Responda diretamente ao cliente APENAS em Português do Brasil (PT-BR). NÃO use inglês. NENHUM comentário interno."),
  ]);

  // Handle Tool Calls (e.g., searching DB)
  if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[${agentConfig.name}] Invoking tools: ${response.tool_calls.map(tc => tc.name).join(', ')}`);
      
      const toolMessages = [];
      for (const toolCall of response.tool_calls) {
          let result = "";
          if (toolCall.name === "search_properties") {
              result = await searchPropertiesTool.invoke(toolCall.args);
          } else if (toolCall.name === "search_leads") {
              result = await searchLeadsTool.invoke(toolCall.args);
          }
          
          toolMessages.push(new ToolMessage({
              name: toolCall.name,
              content: result,
              tool_call_id: toolCall.id!
          }));
      }

      // Re-invoke with tool results
      response = await agentLlm.invoke([
          new SystemMessage(systemPrompt),
          ...state.messages,
          response,
          ...toolMessages,
          new SystemMessage("Resuma as opções encontradas de forma natural, amigável e em Português do Brasil (PT-BR).")
      ] as BaseMessage[]);
  }

  return {
    messages: [new AIMessage({ content: response.content, name: agentConfig.name.split(" ")[0] })],
    sender: agentId,
    nextAgent: "end",
  };
}
