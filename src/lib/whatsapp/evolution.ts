import { updateWhatsAppRuntime } from "@/lib/whatsapp/runtimeStore";
import { updateAgentWhatsAppProfile } from "@/lib/agents/configStore";

type JsonRecord = Record<string, unknown>;

const apiUrl = process.env.EVOLUTION_API_URL || "";
const apiKey = process.env.EVOLUTION_API_KEY || "";
const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET || "";

function assertConfig() {
  if (!apiUrl || !apiKey) {
    throw new Error("Evolution API is not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY.");
  }
}

function normalizeBaseUrl() {
  return apiUrl.replace(/\/+$/, "");
}

function evolutionHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: apiKey,
  };
}

function mapAgentToInstanceName(agentId: string) {
  const slug = agentId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return `novian-${slug || "agent"}`;
}

function toDataUri(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value.startsWith("data:image")) {
    return value;
  }

  return `data:image/png;base64,${value}`;
}

function extractQrFromPayload(payload: unknown): string | null {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const nested = extractQrFromPayload(item);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as JsonRecord;

  const fromTopLevel = [data.base64, data.qrcode, data.qr, data.code];
  for (const entry of fromTopLevel) {
    if (typeof entry === "string" && entry.trim()) {
      return toDataUri(entry.trim());
    }
  }

  const qrCandidate = data.qrcode;
  if (qrCandidate && typeof qrCandidate === "object") {
    const nested = qrCandidate as JsonRecord;
    for (const entry of [nested.base64, nested.code, nested.qrcode, nested.qr]) {
      if (typeof entry === "string" && entry.trim()) {
        return toDataUri(entry.trim());
      }
    }
  }

  for (const nestedEntry of [data.data, data.instance]) {
    if (nestedEntry && typeof nestedEntry === "object") {
      const nestedQr = extractQrFromPayload(nestedEntry);
      if (nestedQr) {
        return nestedQr;
      }
    }
  }

  return null;
}

function extractConnectionState(payload: unknown): "connected" | "connecting" | "qr_ready" | "disconnected" {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const state = extractConnectionState(item);
      if (state !== "disconnected") {
        return state;
      }
    }
    return "disconnected";
  }

  if (!payload || typeof payload !== "object") {
    return "disconnected";
  }

  const data = payload as JsonRecord;
  const candidate =
    (typeof data.state === "string" && data.state) ||
    (typeof data.status === "string" && data.status) ||
    (typeof data.connectionStatus === "string" && data.connectionStatus) ||
    "";
  const normalized = candidate.trim().toLowerCase();

  if (normalized.includes("open") || normalized.includes("connected")) {
    return "connected";
  }
  if (normalized.includes("qr")) {
    return "qr_ready";
  }
  if (normalized.includes("connect")) {
    return "connecting";
  }
  if (normalized.includes("close") || normalized.includes("disconnected") || normalized.includes("logout")) {
    return "disconnected";
  }

  for (const nestedEntry of [data.data, data.instance]) {
    if (nestedEntry && typeof nestedEntry === "object") {
      const nestedState = extractConnectionState(nestedEntry);
      if (nestedState !== "disconnected") {
        return nestedState;
      }
    }
  }

  return "disconnected";
}

async function requestEvolution<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  assertConfig();
  const url = `${normalizeBaseUrl()}${path}`;
  const response = await fetch(url, {
    method,
    headers: evolutionHeaders(),
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: T = {} as T;
  if (text) {
    try {
      parsed = JSON.parse(text) as T;
    } catch {
      parsed = ({ raw: text } as unknown) as T;
    }
  }

  if (!response.ok) {
    const detail = typeof parsed === "object" && parsed ? JSON.stringify(parsed) : text;
    throw new Error(`Evolution API error ${response.status} (${method} ${path}): ${detail}`);
  }

  return parsed;
}

async function requestWithFallback<T = unknown>(
  method: string,
  paths: string[],
  body?: unknown,
): Promise<T> {
  let lastError: Error | null = null;

  for (const path of paths) {
    try {
      return await requestEvolution<T>(method, path, body);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown Evolution API error");
    }
  }

  throw lastError || new Error("Evolution API request failed");
}

export interface EvolutionSessionStatus {
  instanceName: string;
  state: "disconnected" | "connecting" | "qr_ready" | "connected";
  qrDataUri?: string;
  lastError?: string;
}

export function getEvolutionInstanceName(agentId: string) {
  return mapAgentToInstanceName(agentId);
}

export function getEvolutionWebhookSecret() {
  return webhookSecret;
}

export async function ensureEvolutionInstance(params: {
  agentId: string;
  webhookUrl?: string;
}) {
  const instanceName = getEvolutionInstanceName(params.agentId);

  try {
    await requestWithFallback("POST", ["/instance/create"], {
      instanceName,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
      webhook: params.webhookUrl,
      webhook_by_events: true,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("already") && !message.includes("exists") && !message.includes("conflict")) {
      throw error;
    }
  }

  if (params.webhookUrl) {
    try {
      await requestWithFallback("POST", [`/webhook/set/${instanceName}`, `/webhook/set/${encodeURIComponent(instanceName)}`], {
        url: params.webhookUrl,
        webhook_by_events: true,
        events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
      });
    } catch {
      // Some Evolution versions only support webhook in /instance/create payload.
    }
  }

  return instanceName;
}

export async function connectEvolutionInstance(params: {
  agentId: string;
  webhookUrl?: string;
}) {
  const instanceName = await ensureEvolutionInstance(params);
  const nowIso = new Date().toISOString();

  const payload = await requestWithFallback<JsonRecord>("GET", [
    `/instance/connect/${instanceName}`,
    `/instance/connect/${encodeURIComponent(instanceName)}`,
  ]);

  const qrDataUri = extractQrFromPayload(payload);
  const state = qrDataUri ? "qr_ready" : extractConnectionState(payload);

  await updateWhatsAppRuntime(params.agentId, {
    desiredState: "connected",
    state: state === "connected" ? "connected" : qrDataUri ? "qr_ready" : "connecting",
    qrDataUri: qrDataUri || null,
    lastError: null,
    workerId: "evolution",
    heartbeatAt: nowIso,
    connectedAt: state === "connected" ? nowIso : null,
  });

  return {
    instanceName,
    state: state === "connected" ? "connected" : qrDataUri ? "qr_ready" : "connecting",
    qrDataUri: qrDataUri || undefined,
  } satisfies EvolutionSessionStatus;
}

export async function getEvolutionSessionStatus(agentId: string): Promise<EvolutionSessionStatus> {
  const instanceName = getEvolutionInstanceName(agentId);

  try {
    const payload = await requestWithFallback<JsonRecord>("GET", [
      `/instance/connectionState/${instanceName}`,
      `/instance/connectionState/${encodeURIComponent(instanceName)}`,
      `/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
    ]);

    const qrDataUri = extractQrFromPayload(payload);
    const stateFromPayload = qrDataUri ? "qr_ready" : extractConnectionState(payload);
    const nowIso = new Date().toISOString();

    await updateWhatsAppRuntime(agentId, {
      state: stateFromPayload,
      qrDataUri: qrDataUri || null,
      lastError: null,
      workerId: "evolution",
      heartbeatAt: nowIso,
      connectedAt: stateFromPayload === "connected" ? nowIso : null,
    });

    return {
      instanceName,
      state: stateFromPayload,
      qrDataUri: qrDataUri || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evolution status unavailable";
    return {
      instanceName,
      state: "disconnected",
      lastError: message,
    };
  }
}

export async function disconnectEvolutionInstance(agentId: string) {
  const instanceName = getEvolutionInstanceName(agentId);
  const nowIso = new Date().toISOString();

  try {
    await requestWithFallback("DELETE", [
      `/instance/logout/${instanceName}`,
      `/instance/logout/${encodeURIComponent(instanceName)}`,
    ]);
  } catch (logoutError) {
    try {
      await requestWithFallback("POST", [
        `/instance/logout/${instanceName}`,
        `/instance/logout/${encodeURIComponent(instanceName)}`,
      ]);
    } catch {
      // Best effort logout.
      if (logoutError instanceof Error) {
        console.warn(`[${agentId}] Evolution logout failed: ${logoutError.message}`);
      }
    }
  }

  await updateWhatsAppRuntime(agentId, {
    desiredState: "disconnected",
    state: "disconnected",
    qrDataUri: null,
    lastError: null,
    workerId: null,
    heartbeatAt: nowIso,
    connectedAt: null,
  });
}

function extractDigitsFromJid(jidOrPhone: string) {
  const [jidPart] = jidOrPhone.split("@");
  return jidPart.replace(/\D/g, "");
}

export async function sendEvolutionText(agentId: string, jidOrPhone: string, text: string) {
  const instanceName = getEvolutionInstanceName(agentId);
  const number = extractDigitsFromJid(jidOrPhone);
  if (!number) {
    throw new Error("Invalid WhatsApp destination number.");
  }

  await requestWithFallback("POST", [`/message/sendText/${instanceName}`, `/message/sendText/${encodeURIComponent(instanceName)}`], {
    number,
    text,
  });
}

export async function syncEvolutionProfile(agentId: string, payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const data = payload as JsonRecord;
  const profileName = typeof data.profileName === "string" ? data.profileName : null;
  const owner = typeof data.owner === "string" ? data.owner : null;
  const wuid = typeof data.wuid === "string" ? data.wuid : null;
  const profilePicUrl = typeof data.profilePicUrl === "string" ? data.profilePicUrl : null;
  const phone = owner || (wuid ? extractDigitsFromJid(wuid) : null);

  if (!profileName && !phone && !profilePicUrl) {
    return;
  }

  await updateAgentWhatsAppProfile(agentId, {
    displayName: profileName,
    phone,
    profilePictureUrl: profilePicUrl,
  });
}
