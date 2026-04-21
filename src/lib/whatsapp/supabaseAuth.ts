import { AuthenticationState, initAuthCreds, BufferJSON, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { createAdminSupabaseClient } from '../supabase/admin';
import type { Json } from '../database.types';

/**
 * Creates a custom WhatsApp Auth State that syncs directly with Supabase.
 * This avoids local filesystem dependency, allowing it to run in serverless/Vercel environments.
 */
export async function getSupabaseAuthState(agentId: string): Promise<{ state: AuthenticationState, saveCreds: () => Promise<void> }> {
    const supabase = createAdminSupabaseClient();

    // Helper to fetch a key from the database
    const readData = async (keyId: string) => {
        try {
            const { data, error } = await supabase
                .from('whatsapp_auth')
                .select('data')
                .eq('agent_id', agentId)
                .eq('key_id', keyId)
                .maybeSingle();

            if (error || !data) return null;
            // Deserialize BufferJSON strings back to Uint8Arrays
            return JSON.parse(JSON.stringify(data.data), BufferJSON.reviver);
        } catch (error) {
            console.error(`[SupabaseAuth] Read Error for ${agentId}:${keyId}`, error);
            return null;
        }
    };

    // Helper to write a key to the database
    const writeData = async (keyId: string, value: unknown) => {
        try {
            // Serialize Uint8Arrays to BufferJSON strings
            const dataStr = JSON.stringify(value, BufferJSON.replacer);
            const parsedData = JSON.parse(dataStr) as Json;

            await supabase
                .from('whatsapp_auth')
                .upsert({
                    agent_id: agentId,
                    key_id: keyId,
                    data: parsedData
                }, { onConflict: 'agent_id,key_id' });
        } catch (error) {
            console.error(`[SupabaseAuth] Write Error for ${agentId}:${keyId}`, error);
        }
    };

    // Helper to remove keys from the database
    const removeData = async (keyId: string) => {
        try {
            await supabase
                .from('whatsapp_auth')
                .delete()
                .eq('agent_id', agentId)
                .eq('key_id', keyId);
        } catch (error) {
            console.error(`[SupabaseAuth] Delete Error for ${agentId}:${keyId}`, error);
        }
    };

    // 1. Fetch or initialize main credentials
    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData('creds', creds);
    }

    return {
        state: {
            creds,
            keys: {
                get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
                    const data = {} as { [id: string]: SignalDataTypeMap[T] };
                    for (const id of ids) {
                        const keyId = `${type}-${id}`;
                        const value = await readData(keyId);
                        data[id] = value as SignalDataTypeMap[T];
                    }
                    return data;
                },
                set: async (data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }) => {
                    const tasks: Promise<void>[] = [];
                    for (const category in data) {
                        const categoryData = data[category as keyof SignalDataTypeMap];
                        if (!categoryData) continue;
                        for (const id in categoryData) {
                            const value = categoryData[id];
                            const keyId = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(keyId, value));
                            } else {
                                tasks.push(removeData(keyId));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData('creds', creds)
    };
}

export async function clearSupabaseAuthState(agentId: string): Promise<void> {
    const supabase = createAdminSupabaseClient();
    const { error } = await supabase
        .from('whatsapp_auth')
        .delete()
        .eq('agent_id', agentId);

    if (error) {
        throw error;
    }
}
