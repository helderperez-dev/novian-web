import { NextResponse } from 'next/server';
import { getSessionStatus, connectAgentWhatsApp, disconnectAgentWhatsApp, refreshWhatsAppContactMetadata } from '@/lib/whatsapp/manager';
import { requestWhatsAppConnection, requestWhatsAppDisconnect } from '@/lib/whatsapp/runtimeStore';
import { enqueueWhatsAppTask } from '@/lib/whatsapp/taskStore';

export const dynamic = 'force-dynamic';
const allowInProcessRuntime = process.env.WHATSAPP_ALLOW_IN_PROCESS === 'true';

// GET: Check the current status of the agent's WhatsApp instance
export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    const status = await getSessionStatus(agentId);
    const url = new URL(req.url);
    const jid = url.searchParams.get('jid');

    if (!jid) {
        return NextResponse.json(status);
    }

    try {
        const contact = await refreshWhatsAppContactMetadata(agentId, jid);
        return NextResponse.json({ ...status, contact });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to fetch WhatsApp contact metadata';
        if (message.includes('is not connected')) {
            const task = await enqueueWhatsAppTask(agentId, 'refresh_contact_metadata', { jid });
            return NextResponse.json(
                { ...status, queued: true, taskId: task.id, message: 'Metadata refresh queued for the WhatsApp worker.' },
                { status: 202 },
            );
        }
        return NextResponse.json({ ...status, error: message }, { status: 400 });
    }
}

// POST: Start a new connection (returns the QR code in subsequent GET requests)
export async function POST(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    await requestWhatsAppConnection(agentId);

    if (allowInProcessRuntime) {
        // Local development can still host the socket inside the Next process.
        void connectAgentWhatsApp(agentId).catch(console.error);
    }

    return NextResponse.json({ success: true, message: `Connection requested for ${agentId}` });
}

// DELETE: Logout and close connection
export async function DELETE(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    await requestWhatsAppDisconnect(agentId, true);

    if (allowInProcessRuntime) {
        await disconnectAgentWhatsApp(agentId);
    }

    return NextResponse.json({ success: true, message: `Disconnected ${agentId}` });
}
