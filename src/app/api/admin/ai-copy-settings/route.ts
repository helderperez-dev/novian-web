import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth";
import { DEFAULT_AI_COPY_PROMPT, getAiCopyAssistantPrompt, saveAiCopyAssistantPrompt } from "@/lib/agents/configStore";

export const dynamic = "force-dynamic";

async function requireInternalUser() {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.user_type !== "internal" || !appUser.is_active) {
    return null;
  }

  return appUser;
}

export async function GET() {
  try {
    const appUser = await requireInternalUser();
    if (!appUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prompt = await getAiCopyAssistantPrompt();
    return NextResponse.json({ prompt, defaultPrompt: DEFAULT_AI_COPY_PROMPT });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      prompt: DEFAULT_AI_COPY_PROMPT,
      defaultPrompt: DEFAULT_AI_COPY_PROMPT,
      degraded: true,
    });
  }
}

export async function POST(req: Request) {
  try {
    const appUser = await requireInternalUser();
    if (!appUser || appUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const prompt = String(body.prompt ?? "").trim();
    const savedPrompt = await saveAiCopyAssistantPrompt(prompt || DEFAULT_AI_COPY_PROMPT);
    return NextResponse.json({ success: true, prompt: savedPrompt });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save AI text settings" }, { status: 500 });
  }
}
