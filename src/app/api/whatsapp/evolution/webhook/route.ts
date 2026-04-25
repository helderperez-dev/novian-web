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

function resolveAgentIdFromInstance(instanceName: string) {
  const prefix = "novian-";
  if (!instanceName.startsWith(prefix)) {
    return null;
  }
  return instanceName.slice(prefix.length);
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
  const extendedTextMessage = getNested(message, "extendedTextMessage");
  const sourceInstance = instance || (typeof data.instance === "string" ? data.instance : "");
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
    const pushName = typeof data.pushName === "string" ? data.pushName : null;
    const textMessage =
      (message && typeof message.conversation === "string" ? message.conversation : null) ||
      (extendedTextMessage && typeof extendedTextMessage.text === "string" ? extendedTextMessage.text : null);

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
