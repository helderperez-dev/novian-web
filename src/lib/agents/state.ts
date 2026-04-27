import { BaseMessage } from "@langchain/core/messages";

export interface AgentState {
  messages: BaseMessage[];
  sender: string;
  threadId: string;
  leadInfo: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    roles?: string[];
    score?: number;
    budgetMin?: number;
    budgetMax?: number;
    preferences?: Record<string, unknown>;
    status?: string;
    notes?: string[];
    source?: string;
    assignedAgentId?: string;
    whatsappProfile?: Record<string, unknown>;
    linkedProperties?: Array<{
      relationshipType: "interested" | "owner";
      notes?: string;
      property: {
        id: string;
        title: string;
        slug?: string;
        address?: string;
        price: number;
        status: "active" | "inactive" | "sold";
      };
    }>;
  };
  nextAgent?: string;
}
