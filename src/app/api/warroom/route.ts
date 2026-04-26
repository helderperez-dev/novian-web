import { NextResponse } from 'next/server';
import { getChatThreads, getRecentMessages } from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const agentId = url.searchParams.get("agentId");
        const allThreads = (await getChatThreads(agentId)).filter(
            (thread) => thread.id !== "general" && thread.id !== "continuous",
        );

        return NextResponse.json({
            selectedAgentId: agentId,
            threads: allThreads,
            messages: await getRecentMessages(50)
        });
    } catch (e) {
        console.error("Warroom GET Error:", e);
        return NextResponse.json({ threads: [], messages: [] });
    }
}
