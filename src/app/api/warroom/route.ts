import { NextResponse } from 'next/server';
import { getChatThreads, getRecentMessages } from '@/lib/chatStore';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const allThreads = (await getChatThreads()).filter(
            (thread) => thread.id !== "general" && thread.id !== "continuous",
        );

        return NextResponse.json({
            threads: allThreads,
            messages: await getRecentMessages(50)
        });
    } catch (e) {
        console.error("Warroom GET Error:", e);
        return NextResponse.json({ threads: [], messages: [] });
    }
}
