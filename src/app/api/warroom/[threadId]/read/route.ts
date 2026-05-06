import { NextResponse } from "next/server";
import { markThreadRead } from "@/lib/chatStore";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const decodedId = decodeURIComponent(threadId);

  try {
    await markThreadRead(decodedId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Warroom read error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
