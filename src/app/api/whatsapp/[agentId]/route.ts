import { NextResponse } from 'next/server';
import { getSessionStatus, connectAgentWhatsApp, disconnectAgentWhatsApp, fetchWhatsAppContactMetadata } from '@/lib/whatsapp/manager';

export const dynamic = 'force-dynamic';

// GET: Check the current status of the agent's WhatsApp instance
export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    const status = getSessionStatus(agentId);
    const url = new URL(req.url);
    const jid = url.searchParams.get('jid');

    if (!jid) {
        return NextResponse.json(status);
    }

    try {
        const contact = await fetchWhatsAppContactMetadata(agentId, jid);
        return NextResponse.json({ ...status, contact });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch WhatsApp contact metadata';
        return NextResponse.json({ ...status, error: message }, { status: 400 });
    }
}

// POST: Start a new connection (returns the QR code in subsequent GET requests)
export async function POST(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    // Don't await this, let it run in the background so we can respond immediately
    connectAgentWhatsApp(agentId).catch(console.error);
    return NextResponse.json({ success: true, message: `Connection process started for ${agentId}` });
}

// DELETE: Logout and close connection
export async function DELETE(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    await disconnectAgentWhatsApp(agentId);
    return NextResponse.json({ success: true, message: `Disconnected ${agentId}` });
}
