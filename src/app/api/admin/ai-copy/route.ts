import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getCurrentAppUser } from "@/lib/auth";
import { getAiCopyAssistantPrompt } from "@/lib/agents/configStore";

export const dynamic = "force-dynamic";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://novian.com",
    "X-Title": "Novian CRM",
  },
});

type CopyAction = "generate" | "enhance";
type CopyFormat = "plain_text" | "rich_html";

const MAX_SYSTEM_PROMPT_CHARS = 12000;
const MAX_SOURCE_TEXT_CHARS = 12000;
const MAX_CONTEXT_STRING_CHARS = 1200;
const MAX_CONTEXT_ENTRIES = 24;

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 1)).trim()}...`;
}

function compactContextValue(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return truncateText(value, MAX_CONTEXT_STRING_CHARS);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => compactContextValue(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 2) {
      return "[context trimmed]";
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, MAX_CONTEXT_ENTRIES)
        .map(([key, entryValue]) => [key, compactContextValue(entryValue, depth + 1)]),
    );
  }

  return String(value);
}

function buildUserPayload({
  action,
  format,
  fieldLabel,
  sourceText,
  context,
  minimal = false,
}: {
  action: CopyAction;
  format: CopyFormat;
  fieldLabel: string;
  sourceText: string;
  context: Record<string, unknown>;
  minimal?: boolean;
}) {
  const compactContext = compactContextValue(context) as Record<string, unknown>;
  const minimalContext = {
    tituloDoImovel: compactContext?.tituloDoImovel,
    endereco: compactContext?.endereco,
    precoFinal: compactContext?.precoFinal,
    valorDoProprietario: compactContext?.valorDoProprietario,
    comissaoPercentual: compactContext?.comissaoPercentual,
    descricaoAtual: compactContext?.descricaoAtual,
    heroTitle: compactContext?.heroTitle,
    heroSubtitle: compactContext?.heroSubtitle,
    callToActionText: compactContext?.callToActionText,
    leadMagnetTitle: compactContext?.leadMagnetTitle,
  };

  return JSON.stringify(
    {
      task: action === "generate" ? "Generate new copy" : "Enhance existing copy",
      fieldLabel,
      outputFormat: format,
      sourceText: truncateText(sourceText, MAX_SOURCE_TEXT_CHARS),
      context: minimal ? minimalContext : compactContext,
      instructions:
        format === "rich_html"
          ? "Return only clean HTML suitable for a rich text editor."
          : "Return only plain text suitable for an input field.",
    },
    null,
    2,
  );
}

function sanitizeModelOutput(value: string, format: CopyFormat) {
  const trimmed = value.trim().replace(/^```(?:html|markdown|md|text)?\s*/i, "").replace(/\s*```$/i, "").trim();

  if (format === "plain_text") {
    return trimmed.replace(/\s*\n\s*/g, " ").trim();
  }

  return trimmed;
}

export async function POST(req: Request) {
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.user_type !== "internal" || !appUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const action = (body.action as CopyAction) || "enhance";
    const format = (body.format as CopyFormat) || "plain_text";
    const fieldLabel = String(body.fieldLabel || "Texto");
    const sourceText = String(body.sourceText || "").trim();
    const context = body.context && typeof body.context === "object" ? body.context : {};

    if (action === "enhance" && !sourceText) {
      return NextResponse.json({ error: "Source text is required to enhance content" }, { status: 400 });
    }

    const systemPrompt = await getAiCopyAssistantPrompt();
    const model = process.env.OPENROUTER_MODEL_TEXT_TO_TEXT || "openai/gpt-4o";
    const maxOutputTokens = format === "rich_html" ? 1200 : 220;
    const baseSystemPrompt = truncateText(systemPrompt, MAX_SYSTEM_PROMPT_CHARS);

    let completion;

    try {
      completion = await openai.chat.completions.create({
        model,
        temperature: action === "generate" ? 0.7 : 0.45,
        max_tokens: maxOutputTokens,
        messages: [
          { role: "system", content: baseSystemPrompt },
          {
            role: "user",
            content: buildUserPayload({
              action,
              format,
              fieldLabel,
              sourceText,
              context,
            }),
          },
        ],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message.toLowerCase() : "";

      if (!message.includes("context length") && !message.includes("provider returned error")) {
        throw error;
      }

      completion = await openai.chat.completions.create({
        model,
        temperature: action === "generate" ? 0.65 : 0.4,
        max_tokens: Math.min(maxOutputTokens, 700),
        messages: [
          { role: "system", content: truncateText(baseSystemPrompt, 6000) },
          {
            role: "user",
            content: buildUserPayload({
              action,
              format,
              fieldLabel,
              sourceText,
              context,
              minimal: true,
            }),
          },
        ],
      });
    }

    const generated = completion.choices[0]?.message?.content;
    if (!generated) {
      return NextResponse.json({ error: "No text generated" }, { status: 502 });
    }

    return NextResponse.json({
      content: sanitizeModelOutput(generated, format),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate AI text" }, { status: 500 });
  }
}
