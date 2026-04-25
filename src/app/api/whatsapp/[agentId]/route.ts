import { NextResponse } from "next/server";
import { connectEvolutionInstance, disconnectEvolutionInstance, getEvolutionSessionStatus } from "@/lib/whatsapp/evolution";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await params;
  const status = await getEvolutionSessionStatus(agentId);
  const url = new URL(req.url);
  const jid = url.searchParams.get("jid");

  if (!jid) {
    return NextResponse.json(status);
  }

  return NextResponse.json(
    {
      ...status,
      message: "Contact metadata refresh is not available in Evolution-only mode.",
    },
    { status: 202 },
  );
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
