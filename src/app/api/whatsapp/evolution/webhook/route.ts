import { NextResponse } from "next/server";
import { getEvolutionInstanceName, getEvolutionWebhookSecret, syncEvolutionProfile } from "@/lib/whatsapp/evolution";
import { processIncomingWhatsAppText } from "@/lib/whatsapp/incoming";
import { updateWhatsAppRuntime } from "@/lib/whatsapp/runtimeStore";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function parseMaybeJson(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
}

function getNested(obj: JsonRecord | null, key: string) {
  if (!obj) {
    return null;
  }
  const value = obj[key];
  return parseMaybeJson(value);
}

function getString(obj: JsonRecord | null, key: string) {
  if (!obj) {
    return null;
  }
  const value = obj[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toSessionState(connection: string) {
  const normalized = connection.trim().toLowerCase();
  if (normalized.includes("open") || normalized.includes("connected")) {
    return "connected" as const;
  }
  if (normalized.includes("qr")) {
    return "qr_ready" as const;
  }
  if (normalized.includes("connecting")) {
    return "connecting" as const;
  }
  return "disconnected" as const;
}

function normalizeInstanceName(instanceName: string) {
  return instanceName.trim().split(/[/?#]/, 1)[0] || instanceName.trim();
}

function resolveAgentIdFromInstance(instanceName: string) {
  const prefix = "novian-";
  const normalizedInstanceName = normalizeInstanceName(instanceName);
  if (!normalizedInstanceName.startsWith(prefix)) {
    return null;
  }
  return normalizedInstanceName.slice(prefix.length);
}

function extractIncomingText(message: JsonRecord | null) {
  if (!message) {
    return null;
  }

  const extendedTextMessage = getNested(message, "extendedTextMessage");
  const imageMessage = getNested(message, "imageMessage");
  const videoMessage = getNested(message, "videoMessage");
  const documentMessage = getNested(message, "documentMessage");
  const buttonsResponseMessage = getNested(message, "buttonsResponseMessage");
  const listResponseMessage = getNested(message, "listResponseMessage");
  const templateButtonReplyMessage = getNested(message, "templateButtonReplyMessage");
  const interactiveResponseMessage = getNested(message, "interactiveResponseMessage");
  const nativeFlowResponseMessage = getNested(message, "nativeFlowResponseMessage");

  return (
    getString(message, "conversation") ||
    getString(extendedTextMessage, "text") ||
    getString(imageMessage, "caption") ||
    getString(videoMessage, "caption") ||
    getString(documentMessage, "caption") ||
    getString(buttonsResponseMessage, "selectedDisplayText") ||
    getString(listResponseMessage, "title") ||
    getString(listResponseMessage, "description") ||
    getString(templateButtonReplyMessage, "selectedDisplayText") ||
    getString(interactiveResponseMessage, "body") ||
    getString(nativeFlowResponseMessage, "paramsJson")
  );
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const queryAgentId = url.searchParams.get("agentId");
  const expectedSecret = getEvolutionWebhookSecret();
  const providedSecret = url.searchParams.get("secret");

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized webhook request." }, { status: 401 });
  }

  const payload = (await req.json()) as JsonRecord;
  const event = typeof payload.event === "string" ? payload.event : "";
  const instance = typeof payload.instance === "string" ? payload.instance : "";
  const data = parseMaybeJson(payload.data) || payload;
  const key = getNested(data, "key");
  const message = getNested(data, "message");
  const sourceInstance = normalizeInstanceName(
    instance || (typeof data.instance === "string" ? data.instance : ""),
  );
  const agentId = queryAgentId || resolveAgentIdFromInstance(sourceInstance);

  if (!agentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (event.toUpperCase().includes("QRCODE")) {
    const qr = typeof data.base64 === "string" ? data.base64 : typeof data.qrcode === "string" ? data.qrcode : null;
    const qrDataUri = qr ? (qr.startsWith("data:image") ? qr : `data:image/png;base64,${qr}`) : null;

    await updateWhatsAppRuntime(agentId, {
      state: qrDataUri ? "qr_ready" : "connecting",
      qrDataUri,
      lastError: null,
      connectedAt: null,
    });

    return NextResponse.json({ ok: true });
  }

  if (event.toUpperCase().includes("CONNECTION")) {
    const connectionState = typeof data.state === "string" ? data.state : typeof data.connection === "string" ? data.connection : "";
    const state = toSessionState(connectionState || "disconnected");

    await updateWhatsAppRuntime(agentId, {
      state,
      qrDataUri: state === "connected" ? null : undefined,
      lastError: null,
      connectedAt: state === "connected" ? new Date().toISOString() : null,
    });

    if (state === "connected") {
      await syncEvolutionProfile(agentId, data);
    }

    return NextResponse.json({ ok: true });
  }

  if (event.toUpperCase().includes("MESSAGES_UPSERT") || event.toUpperCase().includes("MESSAGES")) {
    const fromMe = key && typeof key.fromMe === "boolean" ? key.fromMe : false;
    if (fromMe) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const remoteJid =
      (key && typeof key.remoteJid === "string" && key.remoteJid) ||
      (typeof data.remoteJid === "string" ? data.remoteJid : "");
    const pushName =
      (typeof data.pushName === "string" && data.pushName) ||
      (typeof data.pushname === "string" && data.pushname) ||
      null;
    const textMessage = extractIncomingText(message);

    if (!remoteJid || !textMessage) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    try {
      await processIncomingWhatsAppText({
        agentId,
        remoteJid,
        pushName,
        textMessage,
      });
    } catch (error) {
      console.error(`[${agentId}] Evolution webhook message processing failed`, error);
      return NextResponse.json({ error: "Failed to process message." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (!sourceInstance) {
    // Best effort: accept events we don't map yet.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const maybeAgentId = resolveAgentIdFromInstance(sourceInstance);
  if (maybeAgentId) {
    await updateWhatsAppRuntime(maybeAgentId, {});
  }

  return NextResponse.json({ ok: true, ignored: true });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const instanceName = url.searchParams.get("instanceName");
  const agentId = url.searchParams.get("agentId");
  const resolved = agentId || (instanceName ? resolveAgentIdFromInstance(instanceName) : null);

  return NextResponse.json({
    ok: true,
    webhook: "evolution",
    resolvedAgentId: resolved,
    instanceName: resolved ? getEvolutionInstanceName(resolved) : null,
  });
}
