import type { PropertyCustomDataValue } from "@/lib/store";

export const PROPERTY_REFERENCE_CODE_KEY = "referenceCode";

const PROPERTY_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PROPERTY_REFERENCE_LENGTH = 5;

function normalizeReferenceCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/[01]/g, "")
    .replace(/O/g, "")
    .replace(/I/g, "")
    .slice(0, PROPERTY_REFERENCE_LENGTH);
}

function hashReferenceSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function buildPropertyReferenceCode(seed: string) {
  let value = hashReferenceSeed(seed);
  let code = "";

  for (let index = 0; index < PROPERTY_REFERENCE_LENGTH; index += 1) {
    code += PROPERTY_REFERENCE_ALPHABET[value % PROPERTY_REFERENCE_ALPHABET.length];
    value = Math.floor(value / PROPERTY_REFERENCE_ALPHABET.length);
  }

  return code;
}

export function getPropertyReferenceCode(input: {
  id: string;
  slug?: string | null;
  title?: string | null;
  customData?: Record<string, unknown> | null;
}) {
  const existingValue = typeof input.customData?.[PROPERTY_REFERENCE_CODE_KEY] === "string"
    ? normalizeReferenceCode(String(input.customData?.[PROPERTY_REFERENCE_CODE_KEY]))
    : "";

  if (existingValue.length === PROPERTY_REFERENCE_LENGTH) {
    return existingValue;
  }

  const seed = `${input.id}:${input.slug || ""}:${input.title || ""}`;
  return buildPropertyReferenceCode(seed);
}

export function ensurePropertyReferenceCode(
  customData: Record<string, PropertyCustomDataValue> | undefined,
  input: {
    id: string;
    slug?: string | null;
    title?: string | null;
  },
) {
  const nextCustomData = { ...(customData || {}) };
  nextCustomData[PROPERTY_REFERENCE_CODE_KEY] = getPropertyReferenceCode({
    id: input.id,
    slug: input.slug,
    title: input.title,
    customData: nextCustomData,
  });
  return nextCustomData;
}
