import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
  messages: BaseMessage[];
  sender: string;
  threadId: string;
  leadInfo: {
    id?: string;
    name?: string;
    phone?: string;
    budgetMin?: number;
    budgetMax?: number;
    preferences?: Record<string, unknown>;
    status?: string;
    notes?: string[];
    source?: string;
    assignedAgentId?: string;
    whatsappProfile?: Record<string, unknown>;
  };
  nextAgent?: string;
}
