import { NextResponse } from 'next/server';
import { listAgentConfigs, upsertAgentConfig } from '@/lib/agents/configStore';
import { defaultAgentConfigs } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const agents = await listAgentConfigs();
        return NextResponse.json({ agents });
    } catch (error) {
        console.error("Error loading agents:", error);
        return NextResponse.json({ agents: defaultAgentConfigs, degraded: true });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { id, name, role, systemPrompt, modules, knowledgeBase } = body;

        if (!id || !name || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const newAgent = { 
            id, 
            name, 
            role, 
            systemPrompt: systemPrompt || "",
            modules: modules || [],
            knowledgeBase: knowledgeBase || ""
        };
        const savedAgent = await upsertAgentConfig(newAgent);

        return NextResponse.json({ success: true, agent: savedAgent });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
