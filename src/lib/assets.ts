export const ASSETS_BUCKET = "assets";
const HOTLINK_BLOCKED_HOSTNAMES = new Set(["img.olx.com.br"]);

function toProxyImageUrl(sourceUrl: string) {
  return `/api/image-proxy?src=${encodeURIComponent(sourceUrl)}`;
}

function shouldProxyExternalImage(cleaned: string) {
  try {
    const parsed = new URL(cleaned);
    return HOTLINK_BLOCKED_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

function getSupabasePublicBaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    return "";
  }

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${ASSETS_BUCKET}/`;
}

function sanitizeAssetValue(value: unknown) {
  return String(value ?? "").replace(/[`"]/g, "").trim();
}

export function normalizeAssetUrl(value: unknown) {
  const cleaned = sanitizeAssetValue(value);

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("/api/image-proxy")) {
    return cleaned;
  }

  if (/^(https?:)?\/\//i.test(cleaned) || cleaned.startsWith("data:")) {
    if (/^https?:\/\//i.test(cleaned) && shouldProxyExternalImage(cleaned)) {
      return toProxyImageUrl(cleaned);
    }
    return cleaned;
  }

  const publicBaseUrl = getSupabasePublicBaseUrl();
  if (!publicBaseUrl) {
    return cleaned;
  }

  if (cleaned.startsWith("/storage/v1/object/public/")) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}${cleaned}`;
  }

  if (cleaned.startsWith("storage/v1/object/public/")) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")}/${cleaned}`;
  }

  const normalizedPath = cleaned
    .replace(new RegExp(`^${ASSETS_BUCKET}/`), "")
    .replace(/^\/+/, "");

  return `${publicBaseUrl}${normalizedPath}`;
}

export function normalizeAssetUrls(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => normalizeAssetUrl(value)).filter(Boolean);
}
