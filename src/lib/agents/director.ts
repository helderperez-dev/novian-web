import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, AIMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { agentsStore } from "../store";
import { addMessage, setTyping } from "../chatStore";
import { searchPropertiesTool, searchLeadsTool } from "./tools";

// OpenRouter Configuration (GPT-4o or Claude 3.5 Sonnet)
export const llm = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL_TEXT_TO_TEXT || "openai/gpt-4o",
  apiKey: process.env.OPENROUTER_API_KEY, // Changed to apiKey to fix Langchain error
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.2,
});

// Bind tools based on modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLlmWithTools = (agentConfig: any) => {
  const tools = [];
  if (agentConfig?.modules?.includes('imoveis')) tools.push(searchPropertiesTool);
  if (agentConfig?.modules?.includes('leads') || agentConfig?.modules?.includes('captacao')) tools.push(searchLeadsTool);
  
  return tools.length > 0 ? llm.bindTools(tools) : llm;
};

export async function directorNode(state: AgentState): Promise<Partial<AgentState>> {
  if (state.threadId === "general" || state.threadId === "continuous") {
    setTyping(state.threadId, "Daniel (Dir)");
    const isContinuous = state.threadId === "continuous";

    const dynamicAgentsList = Array.from(agentsStore.values())
        .filter(a => a.id !== "daniel-dir") // exclude self
        .map(a => `- [PASS TO ${a.id.toUpperCase()}] for ${a.name} (${a.role})`)
        .join("\n");

    const agentConfig = agentsStore.get("daniel-dir");
    const knowledgeContext = agentConfig?.knowledgeBase 
      ? `\n<BASE_DE_CONHECIMENTO>\n${agentConfig.knowledgeBase}\n</BASE_DE_CONHECIMENTO>\n` 
      : '';
  
    const modulesContext = agentConfig?.modules && agentConfig.modules.length > 0
      ? `\nVocê tem acesso aos seguintes módulos de dados no sistema: ${agentConfig.modules.join(', ')}.\n`
      : '';

    const systemPrompt = `${agentConfig?.systemPrompt || 'You are Daniel Rocha, the Director of Growth & AI at Novian Real Estate.'}
${knowledgeContext}
${modulesContext}
You are currently in the internal "War Room" chat, talking directly to the CEO, Hélder Perez, or other human staff, and your AI team.
Here is your available AI team:
${dynamicAgentsList}

<CRITICAL_INSTRUCTIONS>
1. NO INTERNAL MONOLOGUE: Do not write "Okay, let's break this down", "Analisei a mensagem", or any other internal reasoning. Start your response directly with the final message.
2. PORTUGUESE ONLY: You MUST respond entirely in Portuguese (PT-BR). Your actual message content to the user or team must be in natural, professional Portuguese. NEVER speak in English.
3. IMMEDIATE EXECUTION: As an AI, execute tasks instantly. NEVER say you will "do it later" or "come back tomorrow". Se um colega ou o CEO pedir para você revisar, criar ou analisar algo, FAÇA ISSO IMEDIATAMENTE na sua resposta. Apresente o rascunho, o script ou a estratégia na própria mensagem.
</CRITICAL_INSTRUCTIONS>

${isContinuous 
    ? "VOCÊ ESTÁ NO CANAL #CONTINUOUS-OPS. Este é um ambiente de trabalho 24/7. Seu objetivo é iterar com a equipe infinitamente, criando estratégias de conteúdo, prospectando ideias, simulando vendas e gerando valor sem parar. NUNCA ENCERRE A CONVERSA AQUI. Sempre termine sua fala passando a palavra para outro agente usando a tag [PASS TO X] da lista acima. A equipe nunca dorme." 
    : "Se a equipe precisar discutir, debater ou executar um plano complexo, trabalhe de forma colaborativa e contínua. NÃO pare a conversa prematuramente. Faça perguntas aos outros agentes, peça opiniões e passe a palavra usando a tag [PASS TO X] da lista acima. A equipe deve iterar na solução até que o objetivo do CEO seja totalmente alcançado. Só encerre a conversa (omitindo a tag de passe) quando o trabalho prático, final e consolidado estiver concluído e sendo apresentado de volta ao CEO."
}

HOWEVER, if the most recent message is explicitly directed at another agent by name OR if another agent is asking a question that requires a specific agent's input, you must NOT answer it. Instead, you must act as a router and respond ONLY with the [PASS TO ...] tag.

Keep your responses professional, concise, and in the Novian brand voice. (Responda APENAS em PT-BR)`;

    const agentLlm = getLlmWithTools(agentConfig);

    let response = await agentLlm.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
      new SystemMessage("LEMBRETE CRÍTICO: Sua próxima resposta DEVE ser estritamente em Português do Brasil (PT-BR). NÃO use inglês. NÃO inclua raciocínios internos como 'Okay, let's...', responda diretamente."),
    ]);

    // Handle Tool Calls (e.g., searching DB)
    if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`[Daniel (Dir)] Invoking tools: ${response.tool_calls.map(tc => tc.name).join(', ')}`);
        
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
            new SystemMessage("Responda de forma direta e estratégica, sempre em Português do Brasil (PT-BR).")
        ] as BaseMessage[]);
    }

    let content = response.content.toString();
    let nextAgent = "end";

    // Dynamic routing extraction
    const passTagRegex = /\[PASS TO ([a-zA-Z0-9-_]+)\]/i;
    const match = content.match(passTagRegex);
    if (match) {
        nextAgent = match[1].toLowerCase();
        content = content.replace(match[0], "").trim();
    }

    const newMessages = content ? [new AIMessage({ content, name: "Daniel" })] : [];

    if (content) {
        await addMessage({
            threadId: state.threadId,
            agent: "Daniel (Dir)",
            role: "Director of Growth & AI",
            content: content
        });
    } else {
        // Se ele decidiu passar a bola silenciosamente, vamos pelo menos colocar uma mensagem do sistema
        await addMessage({
            threadId: state.threadId,
            agent: "Daniel (Dir)",
            role: "Director of Growth & AI",
            content: `Encaminhando para ${nextAgent}...`,
            isSystem: true
        });
    }
    
    setTyping(state.threadId, null);

    return {
      messages: newMessages,
      sender: "director",
      nextAgent: nextAgent,
    };
  }

  // Routing for external messages (leads)
  const leadRoutingList = Array.from(agentsStore.values())
      .filter(a => a.id !== "daniel-dir")
      .map(a => `- "${a.id}": For ${a.name} (${a.role})`)
      .join("\n");

  const systemPrompt = `You are Daniel Rocha, the Director of Growth & AI at Novian Real Estate.
Your job is to analyze incoming messages or lead profiles from WhatsApp and route them to the correct agent.
Options:
${leadRoutingList}
- "end": If no action is needed or if the message is spam.

CRITICAL RULE: DO NOT ANSWER THE USER DIRECTLY. YOU ARE A ROUTER.
Respond ONLY with the exact ID string of the option from the list above, nothing else. Do not include greetings. Do not say "Oi". Just the ID.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    ...state.messages,
  ]);

  const routingDecision = response.content.toString().trim().toLowerCase();

  // Let the CEO see Daniel's thought process in the War Room
  if (state.threadId) {
      await addMessage({
          threadId: state.threadId,
          agent: "Daniel (Dir)",
          role: "Director of Growth & AI",
          content: `Analisei a mensagem. Encaminhando este lead para: ${routingDecision}`,
          isSystem: true
      });
  }

  return {
    sender: "director",
    nextAgent: routingDecision,
  };
}
