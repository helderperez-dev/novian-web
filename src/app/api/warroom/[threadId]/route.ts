import { NextResponse } from 'next/server';
import { markThreadRead, addMessage, getTyping, setTyping, getThreadHistoryForGraph, getThreadMessages } from '@/lib/chatStore';
import { novianAIGraph } from '@/lib/agents/graph';
import type { AgentState } from '@/lib/agents/state';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ threadId: string }> }) {
    const { threadId } = await params;
    const decodedId = decodeURIComponent(threadId);

    // Mark as read when opened
    await markThreadRead(decodedId);

    // Filter messages for this specific thread
    const threadMessages = await getThreadMessages(decodedId);

    return NextResponse.json({
        messages: threadMessages,
        typing: getTyping(decodedId)
    });
}

// Allow CEO to send manual messages via API
export async function POST(req: Request, { params }: { params: Promise<{ threadId: string }> }) {
    const { threadId } = await params;
    const decodedId = decodeURIComponent(threadId);
    
    try {
        const body = await req.json();
        const { content, agent = "Hélder Perez", role = "CEO" } = body;

        if (!content) {
            return NextResponse.json({ error: "Content is required" }, { status: 400 });
        }

        // 1. Add to War Room Store
        const msg = await addMessage({
            threadId: decodedId,
            agent,
            role,
            content
        });

        // 2. If this is the general channel or continuous channel, let the AI team respond!
        if (decodedId === 'general' || decodedId === 'continuous') {
            // Run asynchronously so we don't block the UI and allow real-time updates
            (async () => {
                try {
                    const history = await getThreadHistoryForGraph(decodedId);
                    await novianAIGraph.invoke(
                        {
                            messages: history,
                            sender: "CEO",
                            threadId: decodedId,
                            leadInfo: {},
                            nextAgent: "director",
                        } satisfies AgentState,
                        { recursionLimit: 50 }
                    );
                } catch (err) {
                    console.error("Error invoking LangGraph for chat:", err);
                    setTyping(decodedId, null);
                }
            })();
        } else {
            // Send via WhatsApp (assuming we use Mariana's socket for now)
            // Note: In a full system, you would check `threadsStore` to see which agent owns this thread
            // and fetch their specific socket using `getSessionStatus(agentId).sock`
            console.log(`[CEO] Sent manual message to ${decodedId}: ${content}`);
        }

        return NextResponse.json({ success: true, message: msg });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
