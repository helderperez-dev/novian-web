const original = $('Montar contexto do lead').first().json;

function parseObject(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return { message: value };
    }
  }

  if (value && typeof value === 'object') {
    return value;
  }

  return {};
}

function asTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => asTrimmedString(item)).filter(Boolean)));
}

function normalizeEmail(value) {
  const email = asTrimmedString(value);
  if (!email) return null;

  const normalized = email.toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function normalizeFullName(value) {
  const name = asTrimmedString(value);
  if (!name) return null;

  return name
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeIntent(value) {
  const intent = asTrimmedString(value);
  if (!intent) return 'unknown';

  const normalized = intent.toLowerCase();
  if (['buy', 'sell', 'rent', 'unknown'].includes(normalized)) {
    return normalized;
  }

  return 'unknown';
}

function normalizeRelationshipType(value) {
  return value === 'owner' ? 'owner' : 'interested';
}

function normalizePropertyLinks(value) {
  if (!Array.isArray(value)) return [];

  const dedupe = new Map();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;

    const reference = asTrimmedString(item.reference);
    if (!reference) continue;

    const relationshipType = normalizeRelationshipType(item.relationship_type);
    const notes = asTrimmedString(item.notes);
    const key = `${reference.toLowerCase()}::${relationshipType}`;

    if (!dedupe.has(key)) {
      dedupe.set(key, {
        reference,
        relationship_type: relationshipType,
        notes,
      });
    }
  }

  return Array.from(dedupe.values());
}

function normalizeWhatsAppFormatting(value) {
  let text = asTrimmedString(value) || '';
  if (!text) return '';

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text.replace(/```([\s\S]*?)```/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1: $2');
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '*$1*');
  text = text.replace(/\*\*([^*]+)\*\*/g, '*$1*');
  text = text.replace(/__([^_]+)__/g, '_$1_');
  text = text.replace(/~~([^~]+)~~/g, '~$1~');
  text = text.replace(/^\s*[\u2022*+]\s+/gm, '- ');
  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

function normalizeDeliveryType(value) {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (normalized === 'image' || normalized === 'document') {
    return normalized;
  }
  return 'text';
}

function normalizeMediaUrl(value, deliveryType) {
  const url = asTrimmedString(value);
  if (!url) return null;

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (deliveryType === 'image' && /^data:image\//i.test(url)) {
    return url;
  }

  if (deliveryType === 'document' && /^data:application\//i.test(url)) {
    return url;
  }

  return null;
}

function normalizeMediaUrls(values, deliveryType) {
  const list = Array.isArray(values) ? values : [values];
  const dedupe = new Set();
  const output = [];

  for (const entry of list.flat()) {
    let candidate = entry;

    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      candidate = candidate.url ?? candidate.media_url ?? candidate.image_url ?? null;
    }

    const normalized = normalizeMediaUrl(candidate, deliveryType);
    if (!normalized || dedupe.has(normalized)) continue;

    dedupe.add(normalized);
    output.push(normalized);
  }

  return output;
}

function normalizeFileName(value, deliveryType) {
  const raw = asTrimmedString(value);
  if (!raw) {
    return deliveryType === 'document' ? 'arquivo.pdf' : null;
  }

  return raw.replace(/[\\/]/g, '-').slice(0, 120);
}

let response = parseObject($json.output ?? $json);
if (response && typeof response.output === 'string') {
  response = parseObject(response.output);
}

const message = normalizeWhatsAppFormatting(
  asTrimmedString(response?.message) ||
  asTrimmedString(response?.response) ||
  asTrimmedString(response?.text) ||
  'Oi! Posso te ajudar. Você está buscando comprar, vender ou alugar?'
);

const classification = ['HOT', 'WARM', 'COLD', 'NAO_APLICAVEL'].includes(response?.classification)
  ? response.classification
  : 'NAO_APLICAVEL';

const rawUpdates = response?.profile_updates && typeof response.profile_updates === 'object' && !Array.isArray(response.profile_updates)
  ? response.profile_updates
  : {};

const propertyLinks = normalizePropertyLinks(rawUpdates.property_links).slice(0, 5);

const rawDelivery = response?.delivery && typeof response.delivery === 'object' && !Array.isArray(response.delivery)
  ? response.delivery
  : {};

const requestedDeliveryType = normalizeDeliveryType(rawDelivery.type);
const mediaUrls = normalizeMediaUrls([
  rawDelivery.urls,
  rawDelivery.media_urls,
  rawDelivery.images,
  rawDelivery.url,
  rawDelivery.media_url,
  rawDelivery.image_url,
  rawDelivery.document_url,
], requestedDeliveryType);
const mediaCaption = normalizeWhatsAppFormatting(
  asTrimmedString(rawDelivery.caption) ||
  asTrimmedString(rawDelivery.message) ||
  ''
);
const mediaFileName = normalizeFileName(
  rawDelivery.file_name ?? rawDelivery.filename ?? rawDelivery.fileName,
  requestedDeliveryType
);
const deliveryReference =
  asTrimmedString(rawDelivery.reference) ||
  asTrimmedString(rawDelivery.property_reference) ||
  asTrimmedString(rawDelivery.property) ||
  (propertyLinks[0]?.reference ?? null);
const deliveryType = requestedDeliveryType !== 'text' && (mediaUrls.length > 0 || !!deliveryReference)
  ? requestedDeliveryType
  : 'text';

const scoreDefaults = {
  HOT: 20,
  WARM: 10,
  COLD: 3,
  NAO_APLICAVEL: 0,
};

const explicitScore = Number(rawUpdates.score_delta);
const scoreDelta = Number.isFinite(explicitScore)
  ? Math.max(0, Math.round(explicitScore))
  : scoreDefaults[classification] || 0;

return [{
  json: {
    instance: original.instance || 'mariana-sdr',
    agent_id: original.agent_id || 'mariana-sdr',
    agent_label: original.agent_label || 'Mariana Silva',
    remote_jid: original.remote_jid,
    thread_id: original.thread_id,
    person_id: original.person_id || null,
    phone: original.phone,
    provider_message_id: original.provider_message_id || null,
    text: String(message).trim(),
    should_reply: response?.should_reply !== false,
    classification,
    delivery_type: deliveryType,
    delivery_reference: deliveryReference,
    media_url: mediaUrls[0] || null,
    media_urls: deliveryType !== 'text' ? mediaUrls : [],
    media_caption: mediaCaption || null,
    media_file_name: mediaFileName,
    profile_updates: {
      full_name: normalizeFullName(rawUpdates.full_name),
      email: normalizeEmail(rawUpdates.email),
      intent: normalizeIntent(rawUpdates.intent),
      score_delta: scoreDelta,
      notes_ai: uniqueStrings(rawUpdates.notes_ai).slice(0, 4),
      notes_internal: uniqueStrings(rawUpdates.notes_internal).slice(0, 4),
      property_links: propertyLinks,
    },
  },
}];