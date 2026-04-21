          import makeWASocket, { DisconnectReason, Browsers, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { novianAIGraph } from '../agents/graph';
import type { AgentState } from '../agents/state';
import { addMessage, getThreadHistoryForGraph, normalizeChatThreadId, syncLeadThreadFromLead } from '../chatStore';

import { clearSupabaseAuthState, getSupabaseAuthState } from './supabaseAuth';
import { createAdminSupabaseClient } from '../supabase/admin';

export type ConnectionState = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface AgentSession {
    agentId: string;
    state: ConnectionState;
    qrDataUri?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sock?: any; 
}

export interface WhatsAppContactMetadata {
    jid: string;
    profilePictureUrl: string | null;
    about: string | null;
    businessProfile: {
        description: string | null;
        category: string | null;
        email: string | null;
        website: string | null;
        address: string | null;
    } | null;
}

// Ensure sessions map persists across Next.js API reloads in development
const globalForSessions = globalThis as unknown as {
    whatsappSessions: Map<string, AgentSession> | undefined;
};
const sessions = globalForSessions.whatsappSessions ?? new Map<string, AgentSession>();
if (process.env.NODE_ENV !== 'production') globalForSessions.whatsappSessions = sessions;

function normalizeWhatsAppJid(value: string) {
    const trimmed = value.trim();
    if (trimmed.includes('@')) {
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readWhatsAppContactMetadata(sock: any, jid: string): Promise<WhatsAppContactMetadata> {
    const normalizedJid = normalizeWhatsAppJid(jid);

    const withTimeout = <T>(promise: Promise<T>, ms: number) => {
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Timeout')), ms);
            promise.then(val => {
                clearTimeout(timer);
                resolve(val);
            }).catch(err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    };

    const [profilePictureResult, aboutResult, businessProfileResult] = await Promise.allSettled([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTimeout<any>(sock.profilePictureUrl(normalizedJid, 'image'), 5000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTimeout<any>(sock.fetchStatus(normalizedJid), 5000),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withTimeout<any>(sock.getBusinessProfile(normalizedJid), 5000)
    ]);

    const profilePictureUrl =
        profilePictureResult.status === 'fulfilled' && typeof profilePictureResult.value === 'string'
            ? profilePictureResult.value
            : null;

    const about =
        aboutResult.status === 'fulfilled' && aboutResult.value && typeof aboutResult.value.status === 'string'
            ? aboutResult.value.status
            : null;

    const businessProfile =
        businessProfileResult.status === 'fulfilled' && businessProfileResult.value
            ? {
                description: typeof businessProfileResult.value.description === 'string' ? businessProfileResult.value.description : null,
                category: typeof businessProfileResult.value.category === 'string' ? businessProfileResult.value.category : null,
                email: typeof businessProfileResult.value.email === 'string' ? businessProfileResult.value.email : null,
                website: typeof businessProfileResult.value.website === 'string' ? businessProfileResult.value.website : null,
                address: typeof businessProfileResult.value.address === 'string' ? businessProfileResult.value.address : null,
            }
            : null;

    return {
        jid: normalizedJid,
        profilePictureUrl,
        about,
        businessProfile,
    };
}

export function getSessionStatus(agentId: string): Omit<AgentSession, 'sock'> {
    const session = sessions.get(agentId);
    if (!session) return { agentId, state: 'disconnected' };
    return {
        agentId: session.agentId,
        state: session.state,
        qrDataUri: session.qrDataUri
    };
}

export async function fetchWhatsAppContactMetadata(agentId: string, jid: string) {
    const session = sessions.get(agentId);

    if (!session?.sock || session.state !== 'connected') {
        throw new Error(`WhatsApp session for ${agentId} is not connected.`);
    }

    return readWhatsAppContactMetadata(session.sock, jid);
}

export async function connectAgentWhatsApp(agentId: string) {
    if (sessions.get(agentId)?.state === 'connected') return;

    // Initialize session state
    sessions.set(agentId, { agentId, state: 'connecting' });

    try {
        // We now use the Supabase Custom Auth state to persist keys in the database instead of the file system
        const { state, saveCreds } = await getSupabaseAuthState(agentId);
        
        // Fetch latest version of WA Web to avoid 405 Connection Failure
        const { version } = await fetchLatestBaileysVersion();
        
        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false, // Render in UI instead
            browser: Browsers.macOS('Desktop'), // Use built-in browser config to prevent immediate disconnects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            logger: pino({ level: 'silent' }) as any
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            const session = sessions.get(agentId) || { agentId, state: 'connecting' };

            if (qr) {
                // Generate base64 Data URI for the frontend to render as an image
                const qrDataUri = await QRCode.toDataURL(qr);
                sessions.set(agentId, { ...session, state: 'qr_ready', qrDataUri });
                console.log(`[${agentId}] QR Code ready for scanning.`);
            }

            if (connection === 'close') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                sessions.set(agentId, { agentId, state: 'disconnected' });
                console.log(`[${agentId}] Connection closed (Status: ${statusCode}). Error:`, lastDisconnect?.error);
                
                if (statusCode === 401) {
                    console.log(`[${agentId}] Unauthorized (401). Disconnecting and dropping credentials.`);
                    await clearSupabaseAuthState(agentId);
                    sessions.set(agentId, { agentId, state: 'disconnected' });
                    return; 
                }

                if (shouldReconnect) {
                    // Wait 5 seconds before trying to reconnect automatically
                    setTimeout(() => connectAgentWhatsApp(agentId), 5000);
                }
            } else if (connection === 'open') {
                sessions.set(agentId, { agentId, state: 'connected', sock, qrDataUri: undefined });
                console.log(`[${agentId}] WhatsApp Connected Successfully!`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.key.fromMe && m.type === 'notify') {
                const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (textMessage) {
                    console.log(`[${agentId}] Received message from ${msg.key.remoteJid}:`, textMessage);
                    const remoteJid = msg.key.remoteJid || "unknown";
                    const normalizedThreadId = normalizeChatThreadId(remoteJid);
                    const pushName = msg.pushName || "Lead";
                    const phone = normalizedThreadId.split('@')[0];

                    // Send typing indicator to WhatsApp IMMEDIATELY upon receiving message
                    try {
                        await sock.sendPresenceUpdate('composing', remoteJid);
                    } catch (e) {
                        console.warn(`[${agentId}] Error sending presence update:`, e);
                    }

                    let contactMetadata: WhatsAppContactMetadata | null = null;

                    try {
                        contactMetadata = await readWhatsAppContactMetadata(sock, remoteJid);
                    } catch (metadataErr) {
                        console.warn(`[${agentId}] Unable to fetch WhatsApp contact metadata for ${remoteJid}:`, metadataErr);
                    }

                    // Upsert lead into Supabase
                    try {
                        const supabase = createAdminSupabaseClient();
                        const metadataCustomData = {
                            source: 'WhatsApp',
                            agent_id: agentId,
                            whatsapp_jid: remoteJid,
                            whatsapp_profile_picture_url: contactMetadata?.profilePictureUrl || null,
                            whatsapp_about: contactMetadata?.about || null,
                            whatsapp_business_description: contactMetadata?.businessProfile?.description || null,
                            whatsapp_business_category: contactMetadata?.businessProfile?.category || null,
                            whatsapp_business_email: contactMetadata?.businessProfile?.email || null,
                            whatsapp_business_website: contactMetadata?.businessProfile?.website || null,
                            whatsapp_business_address: contactMetadata?.businessProfile?.address || null,
                        };
                        
                        // Check if lead exists
                        const { data: existingLead } = await supabase
                            .from('leads')
                            .select('*')
                            .eq('phone', phone)
                            .maybeSingle();

                        if (!existingLead) {
                            // Get the default funnel
                            const { data: funnel } = await supabase
                                .from('funnels')
                                .select('id')
                                .eq('type', 'lead')
                                .order('created_at', { ascending: true })
                                .limit(1)
                                .maybeSingle();

                            const funnelId = funnel?.id || null;

                            const { data: insertedLead, error: insertError } = await supabase.from('leads').insert({
                                name: pushName,
                                phone: phone,
                                preview: textMessage.substring(0, 100),
                                status: 'Novo Lead',
                                unread: true,
                                funnel_id: funnelId,
                                score: 0,
                                custom_data: metadataCustomData
                            }).select('*').single();

                            if (insertError) {
                                throw insertError;
                            }

                            await syncLeadThreadFromLead(insertedLead);
                            console.log(`[${agentId}] Created new lead in Supabase for ${phone} (${pushName})`);
                        } else {
                            const mergedCustomData = {
                                ...((existingLead.custom_data as Record<string, unknown> | null) || {}),
                                ...metadataCustomData,
                            };

                            // Update existing lead preview and unread status
                            const { data: updatedLead, error: updateError } = await supabase.from('leads').update({
                                name: existingLead.name && existingLead.name !== 'Lead' ? existingLead.name : pushName,
                                preview: textMessage.substring(0, 100),
                                unread: true,
                                custom_data: mergedCustomData,
                            }).eq('id', existingLead.id).select('*').single();

                            if (updateError) {
                                throw updateError;
                            }

                            await syncLeadThreadFromLead(updatedLead);
                        }
                    } catch (dbErr) {
                        console.error(`[${agentId}] Error upserting lead in Supabase:`, dbErr);
                    }
                    
                    // Log incoming message to War Room Store
                    await addMessage({
                        threadId: normalizedThreadId,
                        agent: pushName,
                        role: "Client",
                        content: textMessage
                    });
                    
                    try {
                        // Route message to LangGraph, telling it which agent owns this session!
                        const history = await getThreadHistoryForGraph(normalizedThreadId);
                        const response = await novianAIGraph.invoke(
                            { 
                                messages: history,
                                sender: normalizedThreadId,
                                threadId: normalizedThreadId,
                                leadInfo: {},
                                nextAgent: agentId
                            } satisfies AgentState, 
                            { recursionLimit: 50 }
                        );
                        
                        // Extract the AI's reply
                        const allMsgs = (response as { messages?: Array<{ content?: unknown; _getType?: () => string }> }).messages ?? [];
                        const lastMessage = allMsgs[allMsgs.length - 1];
                        
                        // Fix: Don't rely purely on "lastMessage.content" if the agent didn't output text (e.g. only tool call)
                        // Or if it was an internal thought. Let's make sure it's an AIMessage.
                        if (lastMessage && lastMessage.content && lastMessage._getType?.() === 'ai') {
                            console.log(`[${agentId}] Sending reply to ${remoteJid}`);
                            
                            const replyContent = lastMessage.content.toString();
                            
                            // Stop typing indicator and send WhatsApp message!
                            await sock.sendPresenceUpdate('paused', remoteJid);
                            await sock.sendMessage(remoteJid, { text: replyContent });
                        } else {
                            console.log(`[${agentId}] No valid text reply generated for ${remoteJid}`);
                            await sock.sendPresenceUpdate('paused', remoteJid);
                        }
                    } catch (err) {
                        console.error(`[${agentId}] Error in LangGraph execution:`, err);
                        await sock.sendPresenceUpdate('paused', remoteJid);
                    }
                }
            }
        });
    } catch (error) {
        console.error(`[${agentId}] Error connecting:`, error);
        sessions.set(agentId, { agentId, state: 'disconnected' });
    }
}

export async function disconnectAgentWhatsApp(agentId: string) {
    const session = sessions.get(agentId);
    if (session?.sock) {
        await session.sock.logout();
        sessions.delete(agentId);
        console.log(`[${agentId}] Logged out manually.`);
    }

    await clearSupabaseAuthState(agentId);
}
