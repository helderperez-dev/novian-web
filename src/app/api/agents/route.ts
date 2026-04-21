import { NextResponse } from 'next/server';
import { agentsStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const agents = Array.from(agentsStore.values());
    return NextResponse.json({ agents });
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
        agentsStore.set(id, newAgent);

        return NextResponse.json({ success: true, agent: newAgent });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
