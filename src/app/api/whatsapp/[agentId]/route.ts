import { NextResponse } from "next/server";
import { connectEvolutionInstance, disconnectEvolutionInstance, getEvolutionSessionStatus } from "@/lib/whatsapp/evolution";
import { refreshLeadWhatsAppProfile } from "@/lib/whatsapp/incoming";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const url = new URL(req.url);
  const jid = url.searchParams.get("jid");

  if (jid) {
    const refreshed = await refreshLeadWhatsAppProfile({ agentId, jidOrPhone: jid });
    return NextResponse.json({
      success: true,
      provider: "evolution",
      refreshed,
    });
  }

  const status = await getEvolutionSessionStatus(agentId);
  return NextResponse.json(status);
}

export async function POST(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;

  try {
    const baseUrl = (process.env.WHATSAPP_WEBHOOK_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");
    const webhookSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
    const search = new URLSearchParams();
    search.set("agentId", agentId);
    if (webhookSecret) {
      search.set("secret", webhookSecret);
    }
    const webhookUrl = `${baseUrl}/api/whatsapp/evolution/webhook?${search.toString()}`;
    const session = await connectEvolutionInstance({ agentId, webhookUrl });
    return NextResponse.json({
      success: true,
      provider: "evolution",
      session,
      message: `Evolution connection requested for ${agentId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to connect with Evolution API";
    return NextResponse.json({ success: false, provider: "evolution", error: message }, { status: 502 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  await disconnectEvolutionInstance(agentId);
  return NextResponse.json({ success: true, provider: "evolution", message: `Disconnected ${agentId}` });
}
