import { AIMessage, SystemMessage, ToolMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./state";
import { ChatOpenAI } from "@langchain/openai";
import { addMessage, setTyping } from "../chatStore";
import { searchPropertiesTool, searchLeadsTool } from "./tools";
import { getAgentConfig, listAgentConfigs } from "./configStore";
import { getPropertyOfferSummary } from "../property-utils";

// OpenRouter Configuration for SDR
const sdrLlm = new ChatOpenAI({
  modelName: process.env.OPENROUTER_MODEL_TEXT_TO_TEXT || "openai/gpt-4o",
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: {
    baseURL: "https://openrouter.ai/api/v1",
  },
  temperature: 0.7, // slightly higher temperature for conversational tone
});

// Bind tools based on modules
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getLlmWithTools = (agentConfig: any) => {
  const tools = [];
  if (agentConfig?.modules?.includes('imoveis')) tools.push(searchPropertiesTool);
  if (agentConfig?.modules?.includes('leads') || agentConfig?.modules?.includes('captacao')) tools.push(searchLeadsTool);
  
  return tools.length > 0 ? sdrLlm.bindTools(tools) : sdrLlm;
};

function buildLeadContextPrompt(state: AgentState) {
  if (!state.leadInfo || Object.keys(state.leadInfo).length === 0) {
    return "";
  }

  const parts = [
    state.leadInfo.name ? `Nome: ${state.leadInfo.name}` : null,
    state.leadInfo.phone ? `Telefone: ${state.leadInfo.phone}` : null,
    state.leadInfo.email ? `E-mail: ${state.leadInfo.email}` : null,
    state.leadInfo.status ? `Status: ${state.leadInfo.status}` : null,
    typeof state.leadInfo.score === "number" ? `Score CRM: ${state.leadInfo.score}` : null,
    state.leadInfo.roles && state.leadInfo.roles.length > 0
      ? `Perfis: ${state.leadInfo.roles.join(", ")}`
      : null,
    state.leadInfo.source ? `Origem: ${state.leadInfo.source}` : null,
    state.leadInfo.assignedAgentId ? `Agente responsavel: ${state.leadInfo.assignedAgentId}` : null,
    state.leadInfo.preferences && Object.keys(state.leadInfo.preferences).length > 0
      ? `Dados do lead: ${JSON.stringify(state.leadInfo.preferences)}`
      : null,
    state.leadInfo.whatsappProfile && Object.keys(state.leadInfo.whatsappProfile).length > 0
      ? `Perfil do WhatsApp: ${JSON.stringify(state.leadInfo.whatsappProfile)}`
      : null,
    state.leadInfo.notes && state.leadInfo.notes.length > 0
      ? `Notas compartilhadas com a IA:\n- ${state.leadInfo.notes.join("\n- ")}`
      : null,
    state.leadInfo.linkedProperties && state.leadInfo.linkedProperties.length > 0
      ? `Imoveis vinculados:\n- ${state.leadInfo.linkedProperties
          .map((link) => {
            const { saleOffer, rentOffer } = getPropertyOfferSummary(link.property);
            const propertyParts = [
              link.property.title,
              link.relationshipType === "owner" ? "proprietario" : "interessado",
              link.property.status,
              saleOffer ? `venda ${saleOffer.price}` : null,
              rentOffer ? `locacao ${rentOffer.price}` : null,
              link.property.address || null,
              link.notes || null,
            ].filter(Boolean);

            return propertyParts.join(" | ");
          })
          .join("\n- ")}`
      : null,
  ].filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return `\n<CONTEXTO_DO_LEAD>\n${parts.join("\n")}\n</CONTEXTO_DO_LEAD>\n`;
}

export async function sdrNode(state: AgentState): Promise<Partial<AgentState>> {
  if (state.threadId === "general" || state.threadId === "continuous") {
    setTyping(state.threadId, "Mariana (SDR)");
    const isContinuous = state.threadId === "continuous";

    const allAgents = await listAgentConfigs();
    const dynamicAgentsList = allAgents
        .filter(a => a.id !== "mariana-sdr")
        .map(a => `- [PASS TO ${a.id.toUpperCase()}] for ${a.name} (${a.role})`)
        .join("\n");

    const agentConfig = await getAgentConfig("mariana-sdr");
    const knowledgeContext = agentConfig?.knowledgeBase 
      ? `\n<BASE_DE_CONHECIMENTO>\n${agentConfig.knowledgeBase}\n</BASE_DE_CONHECIMENTO>\n` 
      : '';
  
    const modulesContext = agentConfig?.modules && agentConfig.modules.length > 0
      ? `\nVocê tem acesso aos seguintes módulos de dados no sistema: ${agentConfig.modules.join(', ')}.\n`
      : '';

    const systemPrompt = `${agentConfig?.systemPrompt || 'You are Mariana Silva, the SDR (Sales Development Representative) at Novian Real Estate.'}
${knowledgeContext}
${modulesContext}
You are currently in the internal "War Room" chat with the CEO and your AI team.
Here is the rest of your available AI team:
${dynamicAgentsList}

<CRITICAL_INSTRUCTIONS>
1. NO INTERNAL MONOLOGUE: Do not write "Okay, let's break this down", "Analisei a mensagem", or any other internal reasoning. Start your response directly with the final message.
2. PORTUGUESE ONLY: You MUST respond entirely in Portuguese (PT-BR). Your actual message content to the user or team must be in natural, professional Portuguese. NEVER speak in English.
3. IMMEDIATE EXECUTION: As an AI, execute tasks instantly. NEVER say you will "do it later" or "come back tomorrow". Se um colega ou o CEO pedir para você revisar, criar ou analisar algo, FAÇA ISSO IMEDIATAMENTE na sua resposta. Apresente o rascunho, o script ou a estratégia na própria mensagem.
</CRITICAL_INSTRUCTIONS>

${isContinuous 
    ? "VOCÊ ESTÁ NO CANAL #CONTINUOUS-OPS. Este é um ambiente de trabalho 24/7. Seu objetivo é iterar com a equipe infinitamente. NUNCA ENCERRE A CONVERSA AQUI. Sempre termine sua fala passando a palavra para outro agente usando a tag [PASS TO X] da lista acima." 
    : "Interaja de forma proativa com a equipe. Se o plano não estiver concluído, se precisar de aprovação de outro agente, ou quiser debater uma ideia, passe a palavra para ele usando a tag [PASS TO X] da lista acima. A equipe deve colaborar indefinidamente até finalizar o que o CEO pediu. Só encerre a conversa (omitindo a tag de passe) se você estiver apresentando o trabalho final ao CEO e não houver mais nada para o time discutir."
}

Keep your responses professional, concise, and in the Novian brand voice. (Responda APENAS em PT-BR)`;

    const response = await sdrLlm.invoke([
      new SystemMessage(systemPrompt),
      ...state.messages,
      new SystemMessage("LEMBRETE CRÍTICO: Sua próxima resposta DEVE ser estritamente em Português do Brasil (PT-BR). NÃO use inglês. NÃO inclua raciocínios internos como 'Okay, let's...', responda diretamente."),
    ]);

    let content = response.content.toString();
    let nextAgent = "end";

    const passTagRegex = /\[PASS TO ([a-zA-Z0-9-_]+)\]/i;
    const match = content.match(passTagRegex);
    if (match) {
        nextAgent = match[1].toLowerCase();
        content = content.replace(match[0], "").trim();
    }

    const newMessages = content ? [new AIMessage({ content, name: "Mariana" })] : [];

    if (content) {
        await addMessage({
            threadId: state.threadId,
            agent: "Mariana (SDR)",
            role: "SDR",
            content: content
        });
    } else if (nextAgent !== "end") {
        await addMessage({
            threadId: state.threadId,
            agent: "Mariana (SDR)",
            role: "SDR",
            content: `Encaminhando para ${nextAgent}...`,
            isSystem: true
        });
    }

    setTyping(state.threadId, null);

    return {
      messages: newMessages,
      sender: "sdr",
      nextAgent: nextAgent,
    };
  }

  const agentConfig = await getAgentConfig("mariana-sdr");
  const knowledgeContext = agentConfig?.knowledgeBase 
    ? `\n<BASE_DE_CONHECIMENTO>\n${agentConfig.knowledgeBase}\n</BASE_DE_CONHECIMENTO>\n` 
    : '';

  const modulesContext = agentConfig?.modules && agentConfig.modules.length > 0
    ? `\nVocê tem acesso aos seguintes módulos de dados no sistema: ${agentConfig.modules.join(', ')}.\n`
    : '';

  const systemPrompt = `${agentConfig?.systemPrompt || 'You are Mariana Silva, the AI SDR (Sales Development Representative) at Novian Real Estate.'}
${knowledgeContext}
${modulesContext}
${buildLeadContextPrompt(state)}
You are chatting directly with a lead via WhatsApp.
Your goal is to be friendly, helpful, and capture their initial interest.
Do NOT qualify them heavily yet—just establish a connection and ask how you can help them find their next property.

CRÍTICO: SE O LEAD PERGUNTAR SOBRE IMÓVEIS, PREÇOS, OU DISPONIBILIDADE, VOCÊ **DEVE** USAR A FERRAMENTA DE BUSCA DE IMÓVEIS (search_properties) PARA VERIFICAR A BASE DE DADOS REAL. NUNCA INVENTE IMÓVEIS.
A FERRAMENTA RETORNA IMÓVEIS OFICIAIS E IMÓVEIS CAPTADOS DA WEB. 
QUANDO FOR ENVIAR OS DADOS PARA O LEAD, INCLUA O LINK (URL) DO IMÓVEL SE ELE ESTIVER DISPONÍVEL NO RETORNO DA FERRAMENTA.

CRITICAL FORMATTING INSTRUCTIONS FOR WHATSAPP:
1. DO NOT USE MARKDOWN LINKS like [texto](url). WhatsApp does not support them! Simply write the URL out plainly, e.g.: "Ver detalhes: https://..."
2. ONLY USE WHATSAPP-SUPPORTED FORMATTING: *bold* for emphasis, _italic_, ~strikethrough~.
3. NEVER USE **bold** OR # headers.

CRITICAL INSTRUCTION: You MUST respond entirely in Portuguese (PT-BR). 
IMPORTANT ABOUT HISTORY: The chat history may contain previous messages sent by other AI agents (like Daniel the Director) before the lead was transferred to you. YOU ARE MARIANA SILVA. Ignore any previous messages where the AI claims to be someone else. You are taking over the conversation NOW as Mariana.

Output ONLY the final text message you want to send to the lead via WhatsApp. Do not include your internal thoughts, do not include reasoning, and do not act as the Director. Just write the WhatsApp message.`;

  const agentLlm = getLlmWithTools(agentConfig);

  let response = await agentLlm.invoke([
    new SystemMessage(systemPrompt),
    // We only want the recent messages from the user and Mariana for context, 
    // we don't want internal War Room talk to confuse her when talking to a lead.
    // Assuming state.messages contains the chat history with this specific lead.
    ...state.messages,
    new SystemMessage("LEMBRETE CRÍTICO: Responda diretamente ao cliente APENAS em Português do Brasil (PT-BR). NÃO use inglês. NENHUM comentário interno."),
  ]);

  // Handle Tool Calls (e.g., searching DB)
  if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Mariana] Invoking tools: ${response.tool_calls.map(tc => tc.name).join(', ')}`);
      
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
          new SystemMessage("Resuma as opções encontradas de forma natural, amigável e em Português do Brasil (PT-BR). NUNCA use markdown [texto](url), envie a URL crua. Ex: *Ver detalhes:* https://...")
      ] as BaseMessage[]);
  }

  const finalMessage = response.content.toString();

  // Log it to the War Room UI
  await addMessage({
    threadId: state.threadId,
    agent: "Mariana (SDR)",
    role: "SDR (First Contact)",
    content: finalMessage
  });

  return {
    messages: [new AIMessage({ content: finalMessage, name: "Mariana" })],
    sender: "sdr",
    nextAgent: "end", // After sending a message, we wait for user reply
  };
}
