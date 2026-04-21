import { StateGraph, START } from "@langchain/langgraph";
import { AgentState } from "./state";
import { directorNode } from "./director";
import { sdrNode } from "./sdr";
import { genericAgentNode } from "./genericNode";

// 1. Define the State Graph with our State Interface
const graphBuilder = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (x, y) => x.concat(y),
      default: () => [],
    },
    sender: {
      value: (x, y) => y ?? x,
      default: () => "user",
    },
    threadId: {
      value: (x, y) => y ?? x,
      default: () => "general",
    },
    leadInfo: {
      value: (x, y) => ({ ...x, ...y }),
      default: () => ({}),
    },
    nextAgent: {
      value: (x, y) => y ?? x,
      default: () => "end",
    }
  },
});

// 2. Add Nodes (Our AI Agents)
graphBuilder.addNode("director", directorNode);
graphBuilder.addNode("mariana-sdr", sdrNode);

// Dynamic nodes from store
// We use a wildcard/generic node to handle any dynamic agent
graphBuilder.addNode("generic_agent", genericAgentNode);

// 3. Define Edges and Routing
// If it's the general War Room chat, it goes to the Director to orchestrate.
// If it's a WhatsApp message, it goes directly to the agent who owns that WhatsApp session.
graphBuilder.addConditionalEdges(START, (state: AgentState) => {
  if (state.threadId === "general" || state.threadId === "continuous") return "director";
  
  // Directly route to the requested next agent if specified
  const next = state.nextAgent?.toLowerCase();
  if (next) {
    if (next === "director" || next === "daniel-dir" || next === "daniel") return "director";
    if (next === "mariana-sdr" || next === "sdr" || next === "mariana") return "mariana-sdr";
    if (next === "lucas-qual" || next === "lucas") return "generic_agent";
    if (next === "camila-prop" || next === "camila") return "generic_agent";
    if (next !== "end" && next !== "human_handoff") return "generic_agent";
  }
  
  return routeNextAgent(state);
});

function routeNextAgent(state: AgentState) {
  const next = state.nextAgent?.toLowerCase() || "end";
  if (next === "end" || next === "human_handoff") return "end";
  
  if (next === "director" || next === "daniel-dir" || next === "daniel") return "director";
  if (next === "mariana-sdr" || next === "sdr" || next === "mariana") return "mariana-sdr";
  if (next === "lucas-qual" || next === "lucas") return "generic_agent";
  if (next === "camila-prop" || next === "camila") return "generic_agent";
  
  // Any other dynamically created agent goes to generic node
  return "generic_agent";
}

// Agents can route to any other agent
// @ts-expect-error - dynamic routing
graphBuilder.addConditionalEdges("director", routeNextAgent);
// @ts-expect-error - dynamic routing
graphBuilder.addConditionalEdges("mariana-sdr", routeNextAgent);
// @ts-expect-error - dynamic routing
graphBuilder.addConditionalEdges("generic_agent", routeNextAgent);


// 4. Compile the Graph
export const novianAIGraph = graphBuilder.compile();
