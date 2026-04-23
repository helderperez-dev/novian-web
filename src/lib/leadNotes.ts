export type LeadNoteVisibility = "internal" | "ai";

export type LeadNote = {
  id: string;
  content: string;
  visibility: LeadNoteVisibility;
  author: string;
  createdAt: string;
  updatedAt: string;
};

export const LEAD_NOTES_KEY = "lead_notes";

type LeadCustomData = Record<string, unknown> | null | undefined;

function isLeadNoteVisibility(value: unknown): value is LeadNoteVisibility {
  return value === "internal" || value === "ai";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLeadNote(candidate: unknown): LeadNote | null {
  if (!isRecord(candidate)) {
    return null;
  }

  const content = typeof candidate.content === "string" ? candidate.content.trim() : "";
  const visibility = candidate.visibility;
  const author = typeof candidate.author === "string" ? candidate.author.trim() : "";
  const createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : "";
  const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : createdAt;
  const id = typeof candidate.id === "string" ? candidate.id : "";

  if (!content || !author || !createdAt || !updatedAt || !id || !isLeadNoteVisibility(visibility)) {
    return null;
  }

  return {
    id,
    content,
    visibility,
    author,
    createdAt,
    updatedAt,
  };
}

export function getLeadNotes(customData?: LeadCustomData): LeadNote[] {
  const rawNotes = customData?.[LEAD_NOTES_KEY];
  if (!Array.isArray(rawNotes)) {
    return [];
  }

  return rawNotes
    .map(normalizeLeadNote)
    .filter((note): note is LeadNote => note !== null)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
}

export function getLeadNotesByVisibility(
  customData: LeadCustomData,
  visibility: LeadNoteVisibility,
) {
  return getLeadNotes(customData).filter((note) => note.visibility === visibility);
}

export function upsertLeadNotes(
  customData: LeadCustomData,
  notes: LeadNote[],
): Record<string, unknown> {
  return {
    ...(customData || {}),
    [LEAD_NOTES_KEY]: notes,
  };
}

export function createLeadNote(params: {
  content: string;
  visibility: LeadNoteVisibility;
  author: string;
}) {
  const now = new Date().toISOString();

  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content: params.content.trim(),
    visibility: params.visibility,
    author: params.author.trim(),
    createdAt: now,
    updatedAt: now,
  } satisfies LeadNote;
}
