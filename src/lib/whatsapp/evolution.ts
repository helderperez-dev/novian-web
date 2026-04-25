import { getStoredWhatsAppInstanceRuntime, updateWhatsAppRuntime } from "@/lib/whatsapp/runtimeStore";
import { updateAgentWhatsAppProfile } from "@/lib/agents/configStore";

type JsonRecord = Record<string, unknown>;
type RequestAttempt = { method: string; path: string; body?: unknown };

const apiUrl = process.env.EVOLUTION_API_URL || "";
const apiKey = process.env.EVOLUTION_API_KEY || "";
const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET || "";
const defaultIntegration = process.env.EVOLUTION_INSTANCE_INTEGRATION || "WHATSAPP-BAILEYS";

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

function buildWebhookConfig(webhookUrl?: string) {
  if (!webhookUrl) {
    return undefined;
  }

  return {
    enabled: true,
    url: webhookUrl,
    byEvents: true,
    events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
  };
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

function extractPayloadInstanceName(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as JsonRecord;
  const candidate =
    (typeof data.instanceName === "string" && data.instanceName) ||
    (typeof data.name === "string" && data.name) ||
    (typeof data.instance === "string" && data.instance) ||
    "";

  if (candidate.trim()) {
    return candidate.trim();
  }

  for (const nestedEntry of [data.instance, data.data]) {
    if (nestedEntry && typeof nestedEntry === "object") {
      const nestedName = extractPayloadInstanceName(nestedEntry);
      if (nestedName) {
        return nestedName;
      }
    }
  }

  return null;
}

function findMatchingInstancePayload(payload: unknown, instanceName: string): unknown {
  if (Array.isArray(payload)) {
    return payload.find((item) => extractPayloadInstanceName(item) === instanceName) ?? null;
  }

  if (extractPayloadInstanceName(payload) === instanceName) {
    return payload;
  }

  return null;
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

async function requestByAttempts<T = unknown>(attempts: RequestAttempt[]): Promise<T> {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      return await requestEvolution<T>(attempt.method, attempt.path, attempt.body);
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
  const webhook = buildWebhookConfig(params.webhookUrl);

  try {
    const payload = await requestEvolution<JsonRecord>("POST", "/instance/create", {
      instanceName,
      qrcode: true,
      integration: defaultIntegration,
      ...(webhook ? { webhook } : {}),
    });

    return {
      instanceName,
      payload,
      created: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("already") && !message.includes("exists") && !message.includes("conflict")) {
      throw error;
    }
  }

  if (params.webhookUrl) {
    try {
      await requestByAttempts([
        {
          method: "POST",
          path: `/webhook/set/${instanceName}`,
          body: {
            webhook,
          },
        },
        {
          method: "POST",
          path: `/webhook/set/${encodeURIComponent(instanceName)}`,
          body: {
            webhook,
          },
        },
      ]);
    } catch {
      // Some Evolution versions only support webhook in /instance/create payload.
    }
  }

  return {
    instanceName,
    payload: null,
    created: false,
  };
}

export async function connectEvolutionInstance(params: {
  agentId: string;
  webhookUrl?: string;
}) {
  const ensured = await ensureEvolutionInstance(params);
  const instanceName = ensured.instanceName;
  const nowIso = new Date().toISOString();

  const payload =
    ensured.payload ||
    (await requestByAttempts<JsonRecord>([
      { method: "GET", path: `/instance/connect/${instanceName}` },
      { method: "GET", path: `/instance/connect/${encodeURIComponent(instanceName)}` },
      { method: "POST", path: `/instance/connect/${instanceName}` },
      { method: "POST", path: `/instance/connect/${encodeURIComponent(instanceName)}` },
      { method: "POST", path: "/instance/connect", body: { instanceName } },
      { method: "POST", path: "/instance/connect", body: { instance: instanceName } },
    ]));

  const qrDataUri = extractQrFromPayload(payload);
  const state = qrDataUri ? "qr_ready" : extractConnectionState(payload);

  await updateWhatsAppRuntime(params.agentId, {
    state: state === "connected" ? "connected" : qrDataUri ? "qr_ready" : "connecting",
    qrDataUri: qrDataUri || null,
    lastError: null,
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
  const runtime = await getStoredWhatsAppInstanceRuntime(agentId);
  const runtimeAgeMs = runtime.updatedAt ? Date.now() - new Date(runtime.updatedAt).getTime() : Number.POSITIVE_INFINITY;
  const hasFreshPendingSession = runtime.state === "connecting" && runtimeAgeMs < 2 * 60 * 1000;
  const shouldQueryRemote = !!runtime.qrDataUri || !!runtime.connectedAt || hasFreshPendingSession;

  if (!shouldQueryRemote) {
    return {
      instanceName,
      state: "disconnected",
      qrDataUri: undefined,
      lastError: runtime.lastError,
    };
  }

  try {
    let payload: unknown;

    try {
      payload = await requestByAttempts<JsonRecord>([
        { method: "GET", path: `/instance/connectionState/${instanceName}` },
        { method: "GET", path: `/instance/connectionState/${encodeURIComponent(instanceName)}` },
        { method: "GET", path: `/instance/connection-state/${instanceName}` },
        { method: "GET", path: `/instance/connection-state/${encodeURIComponent(instanceName)}` },
        { method: "GET", path: `/instance/status/${instanceName}` },
        { method: "GET", path: `/instance/status/${encodeURIComponent(instanceName)}` },
      ]);
    } catch {
      const instances = await requestEvolution<unknown>("GET", "/instance/fetchInstances");
      payload = findMatchingInstancePayload(instances, instanceName);
      if (!payload) {
        throw new Error(`Evolution instance ${instanceName} not found`);
      }
    }

    const extractedQr = extractQrFromPayload(payload);
    const baseState = extractedQr ? "qr_ready" : extractConnectionState(payload);
    const qrDataUri =
      baseState === "connected" || baseState === "disconnected"
        ? null
        : extractedQr || runtime.qrDataUri || null;
    const stateFromPayload =
      baseState === "connected" || baseState === "disconnected"
        ? baseState
        : qrDataUri
          ? "qr_ready"
          : "connecting";
    const nowIso = new Date().toISOString();

    await updateWhatsAppRuntime(agentId, {
      state: stateFromPayload,
      qrDataUri,
      lastError: null,
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
      state: runtime.state,
      qrDataUri: runtime.qrDataUri,
      lastError: message,
    };
  }
}

export async function disconnectEvolutionInstance(agentId: string) {
  const instanceName = getEvolutionInstanceName(agentId);

  try {
    await requestByAttempts([
      { method: "DELETE", path: `/instance/logout/${instanceName}` },
      { method: "DELETE", path: `/instance/logout/${encodeURIComponent(instanceName)}` },
      { method: "POST", path: `/instance/logout/${instanceName}` },
      { method: "POST", path: `/instance/logout/${encodeURIComponent(instanceName)}` },
      { method: "POST", path: "/instance/logout", body: { instanceName } },
      { method: "POST", path: "/instance/logout", body: { instance: instanceName } },
    ]);
  } catch (logoutError) {
    // Best effort logout.
    if (logoutError instanceof Error) {
      console.warn(`[${agentId}] Evolution logout failed: ${logoutError.message}`);
    }
  }

  await updateWhatsAppRuntime(agentId, {
    state: "disconnected",
    qrDataUri: null,
    lastError: null,
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

  await requestByAttempts([
    {
      method: "POST",
      path: `/message/sendText/${instanceName}`,
      body: { number, text },
    },
    {
      method: "POST",
      path: `/message/sendText/${encodeURIComponent(instanceName)}`,
      body: { number, text },
    },
    {
      method: "POST",
      path: "/message/sendText",
      body: { instanceName, number, text },
    },
    {
      method: "POST",
      path: "/message/sendText",
      body: { instance: instanceName, number, text },
    },
  ]);
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
