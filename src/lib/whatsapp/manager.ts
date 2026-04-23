          import makeWASocket, { DisconnectReason, Browsers, fetchLatestBaileysVersion, isLidUser, isPnUser, jidNormalizedUser } from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { novianAIGraph } from '../agents/graph';
import type { AgentState } from '../agents/state';
import { updateAgentWhatsAppProfile } from '../agents/configStore';
import { addMessage, getThreadHistoryForGraph, normalizeChatThreadId, syncLeadThreadFromLead } from '../chatStore';
import type { Database } from '../database.types';

import { clearSupabaseAuthState, getSupabaseAuthState } from './supabaseAuth';
import { createAdminSupabaseClient } from '../supabase/admin';
import { getWhatsAppInstanceRuntime, updateWhatsAppRuntime } from './runtimeStore';

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
const manuallyDisconnectedAgents = new Set<string>();

function normalizeWhatsAppJid(value: string) {
    const trimmed = value.trim();
    if (trimmed.includes('@')) {
        return trimmed;
    }

    const digits = trimmed.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
}

function extractWhatsAppPhone(value?: string | null) {
    if (!value) {
        return null;
    }

    const [jidPart] = value.split('@');
    const [phonePart] = jidPart.split(':');
    const digits = phonePart.replace(/\D/g, '');
    return digits || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveThreadIdentity(sock: any, jid: string) {
    const normalizedJid = jidNormalizedUser(normalizeWhatsAppJid(jid)) || normalizeWhatsAppJid(jid);

    if (isLidUser(normalizedJid)) {
        try {
            const mappedPn = await sock.signalRepository.lidMapping.getPNForLID(normalizedJid);
            const normalizedPn = mappedPn ? jidNormalizedUser(mappedPn) : '';
            const phone = normalizedPn && isPnUser(normalizedPn) ? extractWhatsAppPhone(normalizedPn) : null;

            return {
                rawJid: normalizedJid,
                threadId: normalizedPn || normalizedJid,
                phone,
            };
        } catch (error) {
            console.warn(`Unable to resolve LID mapping for ${normalizedJid}:`, error);
        }
    }

    return {
        rawJid: normalizedJid,
        threadId: normalizedJid,
        phone: isPnUser(normalizedJid) ? extractWhatsAppPhone(normalizedJid) : null,
    };
}

async function mergeLegacyThread(agentId: string, rawThreadId: string, canonicalThreadId: string) {
    if (!rawThreadId || rawThreadId === canonicalThreadId) {
        return;
    }

    const supabase = createAdminSupabaseClient();
    const { data: legacyThread, error: legacyThreadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('thread_id', rawThreadId)
        .maybeSingle();

    if (legacyThreadError) {
        throw legacyThreadError;
    }

    if (!legacyThread) {
        return;
    }

    const { data: canonicalThread, error: canonicalThreadError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('thread_id', canonicalThreadId)
        .maybeSingle();

    if (canonicalThreadError) {
        throw canonicalThreadError;
    }

    if (!canonicalThread) {
        return;
    }

    const mergedAgentIds = Array.from(new Set([...(canonicalThread.agent_ids || []), ...(legacyThread.agent_ids || [])]));
    const mergedCustomData = {
        ...((legacyThread.custom_data as Record<string, unknown> | null) || {}),
        ...((canonicalThread.custom_data as Record<string, unknown> | null) || {}),
        source: 'WhatsApp',
        agent_id: agentId,
    };

    const { error: messagesError } = await supabase
        .from('chat_messages')
        .update({ thread_id: canonicalThreadId })
        .eq('thread_id', rawThreadId);

    if (messagesError) {
        throw messagesError;
    }

    const { error: updateThreadError } = await supabase
        .from('chat_threads')
        .update({
            title: canonicalThread.title || legacyThread.title,
            preview: canonicalThread.preview || legacyThread.preview,
            unread: canonicalThread.unread || legacyThread.unread,
            agent_ids: mergedAgentIds,
            custom_data: mergedCustomData,
            updated_at: new Date().toISOString(),
        })
        .eq('thread_id', canonicalThreadId);

    if (updateThreadError) {
        throw updateThreadError;
    }

    const { error: deleteThreadError } = await supabase
        .from('chat_threads')
        .delete()
        .eq('thread_id', rawThreadId);

    if (deleteThreadError) {
        throw deleteThreadError;
    }
}

async function upsertUnresolvedThread(params: {
    agentId: string;
    threadId: string;
    pushName: string;
    textMessage: string;
    metadataCustomData: Record<string, unknown>;
}) {
    const supabase = createAdminSupabaseClient();
    const nowIso = new Date().toISOString();

    const { error } = await supabase
        .from('chat_threads')
        .upsert({
            thread_id: params.threadId,
            title: params.pushName,
            preview: params.textMessage.substring(0, 100),
            phone: null,
            unread: true,
            agent_ids: [],
            status: 'Novo Lead',
            score: 0,
            custom_data: params.metadataCustomData as Database['public']['Tables']['chat_threads']['Insert']['custom_data'],
            thread_kind: 'lead',
            lead_id: null,
            last_message_at: nowIso,
            updated_at: nowIso,
        }, { onConflict: 'thread_id' });

    if (error) {
        throw error;
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistAgentSessionProfile(agentId: string, sock: any) {
    const userId = typeof sock.user?.id === 'string' ? sock.user.id : null;
    const displayName = typeof sock.user?.name === 'string' ? sock.user.name : null;
    const phone = extractWhatsAppPhone(userId);

    let profilePictureUrl: string | null = null;
    if (userId) {
        try {
            const normalizedUserJid = normalizeWhatsAppJid(userId);
            const result = await sock.profilePictureUrl(normalizedUserJid, 'image');
            profilePictureUrl = typeof result === 'string' ? result : null;
        } catch (error) {
            console.warn(`[${agentId}] Unable to fetch signed-in WhatsApp profile photo:`, error);
        }
    }

    await updateAgentWhatsAppProfile(agentId, {
        displayName,
        phone,
        profilePictureUrl,
    });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistContactMetadata(agentId: string, sock: any, jid: string, metadata: WhatsAppContactMetadata) {
    const identity = await resolveThreadIdentity(sock, jid);
    const normalizedThreadId = normalizeChatThreadId(identity.threadId);
    const phone = identity.phone;
    const supabase = createAdminSupabaseClient();

    const metadataCustomData = {
        source: 'WhatsApp',
        agent_id: agentId,
        whatsapp_jid: identity.rawJid,
        whatsapp_thread_id: normalizedThreadId,
        whatsapp_profile_picture_url: metadata.profilePictureUrl || null,
        whatsapp_about: metadata.about || null,
        whatsapp_business_description: metadata.businessProfile?.description || null,
        whatsapp_business_category: metadata.businessProfile?.category || null,
        whatsapp_business_email: metadata.businessProfile?.email || null,
        whatsapp_business_website: metadata.businessProfile?.website || null,
        whatsapp_business_address: metadata.businessProfile?.address || null,
    };

    const { data: lead } = phone
        ? await supabase
            .from("leads")
            .select("*")
            .eq("phone", phone)
            .maybeSingle()
        : { data: null };

    if (lead) {
        const mergedCustomData = {
            ...((lead.custom_data as Record<string, unknown> | null) || {}),
            ...metadataCustomData,
        };

        const { data: updatedLead, error: leadError } = await supabase
            .from("leads")
            .update({
                custom_data: mergedCustomData,
                updated_at: new Date().toISOString(),
            })
            .eq("id", lead.id)
            .select("*")
            .single();

        if (leadError) {
            throw leadError;
        }

        await syncLeadThreadFromLead(updatedLead);
    }

    if (phone) {
        await mergeLegacyThread(agentId, identity.rawJid, normalizedThreadId);
    }

    const { data: thread } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("thread_id", normalizedThreadId)
        .maybeSingle();

    if (thread) {
        const mergedThreadCustomData = {
            ...((thread.custom_data as Record<string, unknown> | null) || {}),
            ...metadataCustomData,
        };

        const { error: threadError } = await supabase
            .from("chat_threads")
            .update({
                custom_data: mergedThreadCustomData,
                updated_at: new Date().toISOString(),
            })
            .eq("thread_id", normalizedThreadId);

        if (threadError) {
            throw threadError;
        }
    }
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

async function syncRuntimeStatus(
    agentId: string,
    updates: {
        state?: ConnectionState;
        qrDataUri?: string | null;
        lastError?: string | null;
        workerId?: string | null;
        heartbeatAt?: string | null;
        connectedAt?: string | null;
        desiredState?: 'connected' | 'disconnected';
    },
) {
    try {
        await updateWhatsAppRuntime(agentId, updates);
    } catch (error) {
        console.error(`[${agentId}] Failed to sync WhatsApp runtime state`, error);
    }
}

function getLocalSessionStatus(agentId: string): Omit<AgentSession, 'sock'> | null {
    const session = sessions.get(agentId);
    if (!session) return null;
    return {
        agentId: session.agentId,
        state: session.state,
        qrDataUri: session.qrDataUri
    };
}

export async function getSessionStatus(agentId: string): Promise<Omit<AgentSession, 'sock'>> {
    const local = getLocalSessionStatus(agentId);
    if (local) {
        return local;
    }

    const runtime = await getWhatsAppInstanceRuntime(agentId);
    return {
        agentId,
        state: runtime.state,
        qrDataUri: runtime.qrDataUri,
    };
}

export function listLocalSessionStatuses(): Array<Omit<AgentSession, 'sock'>> {
    return Array.from(sessions.values()).map((session) => ({
        agentId: session.agentId,
        state: session.state,
        qrDataUri: session.qrDataUri,
    }));
}

export async function fetchWhatsAppContactMetadata(agentId: string, jid: string) {
    const session = sessions.get(agentId);

    if (!session?.sock || session.state !== 'connected') {
        throw new Error(`WhatsApp session for ${agentId} is not connected.`);
    }

    return readWhatsAppContactMetadata(session.sock, jid);
}

export async function refreshWhatsAppContactMetadata(agentId: string, jid: string) {
    const session = sessions.get(agentId);

    if (!session?.sock || session.state !== 'connected') {
        throw new Error(`WhatsApp session for ${agentId} is not connected.`);
    }

    const contact = await readWhatsAppContactMetadata(session.sock, jid);
    await persistContactMetadata(agentId, session.sock, jid, contact);
    return contact;
}

export async function connectAgentWhatsApp(agentId: string, options?: { workerId?: string }) {
    const currentState = sessions.get(agentId)?.state;
    if (currentState === 'connected' || currentState === 'connecting' || currentState === 'qr_ready') return;

    // Initialize session state
    sessions.set(agentId, { agentId, state: 'connecting' });
    manuallyDisconnectedAgents.delete(agentId);
    await syncRuntimeStatus(agentId, {
        desiredState: 'connected',
        state: 'connecting',
        qrDataUri: null,
        lastError: null,
        workerId: options?.workerId ?? null,
        heartbeatAt: new Date().toISOString(),
        connectedAt: null,
    });

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
                await syncRuntimeStatus(agentId, {
                    state: 'qr_ready',
                    qrDataUri,
                    workerId: options?.workerId ?? null,
                    heartbeatAt: new Date().toISOString(),
                });
                console.log(`[${agentId}] QR Code ready for scanning.`);
            }

            if (connection === 'close') {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
                const wasManualDisconnect = manuallyDisconnectedAgents.has(agentId);
                const shouldReconnect = !wasManualDisconnect && statusCode !== DisconnectReason.loggedOut;
                sessions.set(agentId, { agentId, state: 'disconnected' });
                await syncRuntimeStatus(agentId, {
                    state: 'disconnected',
                    qrDataUri: null,
                    lastError: statusCode ? `Connection closed (${statusCode})` : 'Connection closed',
                    workerId: options?.workerId ?? null,
                    heartbeatAt: new Date().toISOString(),
                    connectedAt: null,
                    desiredState: wasManualDisconnect ? 'disconnected' : undefined,
                });
                console.log(`[${agentId}] Connection closed (Status: ${statusCode}). Error:`, lastDisconnect?.error);
                
                if (statusCode === 401) {
                    console.log(`[${agentId}] Unauthorized (401). Disconnecting and dropping credentials.`);
                    await clearSupabaseAuthState(agentId);
                    sessions.set(agentId, { agentId, state: 'disconnected' });
                    await syncRuntimeStatus(agentId, {
                        state: 'disconnected',
                        qrDataUri: null,
                        lastError: 'WhatsApp session expired. Scan the QR code again.',
                        workerId: options?.workerId ?? null,
                        heartbeatAt: new Date().toISOString(),
                        connectedAt: null,
                        desiredState: 'disconnected',
                    });
                    return; 
                }

                if (wasManualDisconnect) {
                    manuallyDisconnectedAgents.delete(agentId);
                    return;
                }

                if (shouldReconnect) {
                    // Wait 5 seconds before trying to reconnect automatically
                    setTimeout(() => void connectAgentWhatsApp(agentId, options), 5000);
                }
            } else if (connection === 'open') {
                sessions.set(agentId, { agentId, state: 'connected', sock, qrDataUri: undefined });
                await syncRuntimeStatus(agentId, {
                    state: 'connected',
                    qrDataUri: null,
                    lastError: null,
                    workerId: options?.workerId ?? null,
                    heartbeatAt: new Date().toISOString(),
                    connectedAt: new Date().toISOString(),
                });
                try {
                    await persistAgentSessionProfile(agentId, sock);
                } catch (error) {
                    console.error(`[${agentId}] Failed to persist signed-in WhatsApp profile`, error);
                }
                console.log(`[${agentId}] WhatsApp Connected Successfully!`);
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async (m) => {
            if (m.type !== 'notify') {
                return;
            }

            for (const msg of m.messages) {
                if (msg.key.fromMe) {
                    continue;
                }

                const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
                if (!textMessage) {
                    continue;
                }

                const remoteJid = msg.key.remoteJid || 'unknown';
                console.log(`[${agentId}] Received message from ${remoteJid}:`, textMessage);

                const identity = await resolveThreadIdentity(sock, remoteJid);
                const normalizedThreadId = normalizeChatThreadId(identity.threadId);
                const pushName = msg.pushName || 'Lead';

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

                try {
                    const supabase = createAdminSupabaseClient();
                    const metadataCustomData = {
                        source: 'WhatsApp',
                        agent_id: agentId,
                        whatsapp_jid: identity.rawJid,
                        whatsapp_thread_id: normalizedThreadId,
                        whatsapp_profile_picture_url: contactMetadata?.profilePictureUrl || null,
                        whatsapp_about: contactMetadata?.about || null,
                        whatsapp_business_description: contactMetadata?.businessProfile?.description || null,
                        whatsapp_business_category: contactMetadata?.businessProfile?.category || null,
                        whatsapp_business_email: contactMetadata?.businessProfile?.email || null,
                        whatsapp_business_website: contactMetadata?.businessProfile?.website || null,
                        whatsapp_business_address: contactMetadata?.businessProfile?.address || null,
                    };

                    if (identity.phone) {
                        const { data: existingLead } = await supabase
                            .from('leads')
                            .select('*')
                            .eq('phone', identity.phone)
                            .maybeSingle();

                        if (!existingLead) {
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
                                phone: identity.phone,
                                preview: textMessage.substring(0, 100),
                                status: 'Novo Lead',
                                unread: true,
                                funnel_id: funnelId,
                                score: 0,
                                custom_data: metadataCustomData,
                            }).select('*').single();

                            if (insertError) {
                                throw insertError;
                            }

                            await syncLeadThreadFromLead(insertedLead);
                            console.log(`[${agentId}] Created new lead in Supabase for ${identity.phone} (${pushName})`);
                        } else {
                            const mergedCustomData = {
                                ...((existingLead.custom_data as Record<string, unknown> | null) || {}),
                                ...metadataCustomData,
                            };

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

                        await mergeLegacyThread(agentId, identity.rawJid, normalizedThreadId);
                    } else {
                        await upsertUnresolvedThread({
                            agentId,
                            threadId: normalizedThreadId,
                            pushName,
                            textMessage,
                            metadataCustomData,
                        });
                    }

                    if (contactMetadata) {
                        await persistContactMetadata(agentId, sock, remoteJid, contactMetadata);
                    }
                } catch (dbErr) {
                    console.error(`[${agentId}] Error upserting lead in Supabase:`, dbErr);
                }

                await addMessage({
                    threadId: normalizedThreadId,
                    agent: pushName,
                    role: 'Client',
                    content: textMessage,
                });

                try {
                    const history = await getThreadHistoryForGraph(normalizedThreadId);
                    const response = await novianAIGraph.invoke(
                        {
                            messages: history,
                            sender: normalizedThreadId,
                            threadId: normalizedThreadId,
                            leadInfo: {},
                            nextAgent: agentId,
                        } satisfies AgentState,
                        { recursionLimit: 50 }
                    );

                    const allMsgs = (response as { messages?: Array<{ content?: unknown; _getType?: () => string }> }).messages ?? [];
                    const lastMessage = allMsgs[allMsgs.length - 1];

                    if (lastMessage && lastMessage.content && lastMessage._getType?.() === 'ai') {
                        console.log(`[${agentId}] Sending reply to ${remoteJid}`);
                        const replyContent = lastMessage.content.toString();

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
        });
    } catch (error) {
        console.error(`[${agentId}] Error connecting:`, error);
        sessions.set(agentId, { agentId, state: 'disconnected' });
        const message = error instanceof Error ? error.message : 'Unknown connection error';
        await syncRuntimeStatus(agentId, {
            state: 'disconnected',
            qrDataUri: null,
            lastError: message,
            workerId: options?.workerId ?? null,
            heartbeatAt: new Date().toISOString(),
            connectedAt: null,
        });
    }
}

export async function disconnectAgentWhatsApp(agentId: string, options?: { clearAuth?: boolean }) {
    manuallyDisconnectedAgents.add(agentId);
    const session = sessions.get(agentId);
    if (session?.sock) {
        await session.sock.logout();
        sessions.delete(agentId);
        console.log(`[${agentId}] Logged out manually.`);
    }

    await syncRuntimeStatus(agentId, {
        desiredState: 'disconnected',
        state: 'disconnected',
        qrDataUri: null,
        lastError: null,
        workerId: null,
        heartbeatAt: new Date().toISOString(),
        connectedAt: null,
    });

    if (options?.clearAuth !== false) {
        await clearSupabaseAuthState(agentId);
    }
}

export async function touchSessionHeartbeat(agentId: string, workerId?: string) {
    const session = sessions.get(agentId);
    if (!session || session.state !== 'connected') {
        return;
    }

    await syncRuntimeStatus(agentId, {
        state: 'connected',
        workerId: workerId ?? null,
        heartbeatAt: new Date().toISOString(),
    });
}
