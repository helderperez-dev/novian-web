import { NextResponse } from 'next/server';
import { getSessionStatus, connectAgentWhatsApp, disconnectAgentWhatsApp, refreshWhatsAppContactMetadata } from '@/lib/whatsapp/manager';
import { requestWhatsAppConnection, requestWhatsAppDisconnect } from '@/lib/whatsapp/runtimeStore';
import { enqueueWhatsAppTask } from '@/lib/whatsapp/taskStore';
import { getWhatsAppProvider } from '@/lib/whatsapp/provider';
import { connectEvolutionInstance, disconnectEvolutionInstance, getEvolutionSessionStatus } from '@/lib/whatsapp/evolution';

export const dynamic = 'force-dynamic';
const allowInProcessRuntime = process.env.WHATSAPP_ALLOW_IN_PROCESS === 'true';
const provider = getWhatsAppProvider();

// GET: Check the current status of the agent's WhatsApp instance
export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    const status = provider === 'evolution' ? await getEvolutionSessionStatus(agentId) : await getSessionStatus(agentId);
    const url = new URL(req.url);
    const jid = url.searchParams.get('jid');

    if (!jid) {
        return NextResponse.json(status);
    }

    if (provider === 'evolution') {
        return NextResponse.json({ ...status, message: 'Contact metadata refresh is not available for Evolution mode yet.' }, { status: 202 });
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
export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
    const { agentId } = await params;
    if (provider === 'evolution') {
        const baseUrl = (process.env.WHATSAPP_WEBHOOK_BASE_URL || new URL(req.url).origin).replace(/\/+$/, '');
        const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
        const search = new URLSearchParams();
        search.set('agentId', agentId);
        if (webhookSecret) {
            search.set('secret', webhookSecret);
        }
        const webhookUrl = `${baseUrl}/api/whatsapp/evolution/webhook?${search.toString()}`;
        const session = await connectEvolutionInstance({ agentId, webhookUrl });
        return NextResponse.json({ success: true, provider, session, message: `Evolution connection requested for ${agentId}` });
    }

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
    if (provider === 'evolution') {
        await disconnectEvolutionInstance(agentId);
        return NextResponse.json({ success: true, provider, message: `Disconnected ${agentId}` });
    }

    await requestWhatsAppDisconnect(agentId, true);

    if (allowInProcessRuntime) {
        await disconnectAgentWhatsApp(agentId);
    }

    return NextResponse.json({ success: true, message: `Disconnected ${agentId}` });
}
