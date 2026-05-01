function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseJsonArray(value) {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }
  return Array.isArray(value) ? value : [];
}

function asString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function firstNonEmptyString() {
  for (const value of arguments) {
    const normalized = asString(value);
    if (normalized) return normalized;
  }
  return null;
}

function sanitizeHttpUrl(value) {
  const normalized = asString(value);
  if (!normalized) return null;
  if (normalized.startsWith('data:')) return null;
  if (normalized.length > 2000) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function extractPhoneFromJid(value) {
  const raw = asString(value);
  if (!raw) return null;

  const digits = raw.split('@')[0].replace(/\D/g, '');
  return digits || null;
}

function normalizeLeadNotes(value) {
  const seen = new Set();

  return parseJsonArray(value)
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .filter((item) => item.visibility === 'ai')
    .map((item) => ({
      id: item.id || null,
      content: typeof item.content === 'string' ? item.content.trim() : '',
      author: typeof item.author === 'string' ? item.author.trim() : null,
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
    }))
    .filter((item) => item.content)
    .filter((item) => {
      const key = item.content.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-8);
}

function normalizePropertyFeatures(value) {
  const features = parseJsonObject(value);
  return Object.fromEntries(
    Object.entries(features)
      .map(([key, entryValue]) => [key, asString(entryValue) || (Number.isFinite(Number(entryValue)) ? Number(entryValue) : null)])
      .filter(([, entryValue]) => entryValue !== null)
  );
}

function normalizePropertyOffers(value) {
  return parseJsonArray(value)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      id: asString(item.id) || null,
      offer_type: asString(item.offer_type || item.offerType),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      owner_price: Number.isFinite(Number(item.owner_price ?? item.ownerPrice)) ? Number(item.owner_price ?? item.ownerPrice) : null,
      commission_rate: Number.isFinite(Number(item.commission_rate ?? item.commissionRate)) ? Number(item.commission_rate ?? item.commissionRate) : null,
      is_primary: Boolean(item.is_primary ?? item.isPrimary),
    }))
    .filter((item) => item.offer_type && item.price !== null);
}

function normalizeLinkedProperties(value) {
  return parseJsonArray(value)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      property_id: asString(item.property_id) || null,
      title: asString(item.title),
      slug: asString(item.slug),
      public_url: asString(item.public_url),
      address: asString(item.address),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      property_offers: normalizePropertyOffers(item.property_offers),
      status: asString(item.status),
      description: asString(item.description)?.slice(0, 180) || null,
      cover_image: sanitizeHttpUrl(item.cover_image),
      relationship_type: asString(item.relationship_type),
      notes: asString(item.notes),
      source: asString(item.source),
      features: normalizePropertyFeatures(item.features),
    }))
    .filter((item) => item.property_id && item.status === "active")
    .slice(0, 8);
}

function normalizeActivePropertiesCatalog(value) {
  return parseJsonArray(value)
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => ({
      id: asString(item.id) || null,
      title: asString(item.title),
      slug: asString(item.slug),
      public_url: asString(item.public_url),
      address: asString(item.address),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
      property_offers: normalizePropertyOffers(item.property_offers),
      status: asString(item.status),
      cover_image: sanitizeHttpUrl(item.cover_image),
      features: normalizePropertyFeatures(item.features),
    }))
    .filter((item) => item.id && item.title && item.status === "active")
    .slice(0, 12);
}

function countTopValues(items, selector, limit = 5) {
  const counts = new Map();

  for (const item of items) {
    const value = asString(selector(item));
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .slice(0, limit)
    .map(([value, total]) => ({ value, total }));
}

function summarizeActivePropertiesCatalog(items) {
  const prices = items
    .map((item) => item.price)
    .filter((value) => Number.isFinite(value));

  return {
    total_ativos_em_contexto: items.length,
    faixa_preco: prices.length
      ? {
          minimo: Math.min(...prices),
          maximo: Math.max(...prices),
        }
      : null,
    cidades: countTopValues(items, (item) => item.features.city),
    bairros: countTopValues(items, (item) => item.features.neighborhood),
    tipos: countTopValues(items, (item) => item.features.property_type),
    exemplos: items.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      public_url: item.public_url || null,
      cover_image: item.cover_image || null,
      address: item.address,
      price: item.price,
      property_offers: item.property_offers,
      city: item.features.city || null,
      neighborhood: item.features.neighborhood || null,
      property_type: item.features.property_type || null,
      bedrooms: item.features.bedrooms || null,
      bathrooms: item.features.bathrooms || null,
      parking: item.features.parking || null,
      built_area: item.features.built_area || null,
    })),
    observacao: 'Use as ferramentas seguras de Postgres para buscar, filtrar ou detalhar imoveis alem deste resumo.',
  };
}

const db = $json || {};
const metadata = parseJsonObject(db.person_metadata);
const linkedProperties = normalizeLinkedProperties(db.person_linked_properties);
const activePropertiesCatalog = normalizeActivePropertiesCatalog(db.active_properties_catalog);
const activePropertiesSummary = summarizeActivePropertiesCatalog(activePropertiesCatalog);
const aiNotes = normalizeLeadNotes(metadata.lead_notes);
const leadProfile = parseJsonObject(metadata.lead_profile);

const phone = firstNonEmptyString(
  db.phone,
  db.whatsapp_profile_number,
  metadata.whatsapp_profile_number,
  extractPhoneFromJid(db.thread_id),
  extractPhoneFromJid(db.remote_jid),
  extractPhoneFromJid(metadata.whatsapp_jid)
);
const personEmail = firstNonEmptyString(db.person_email, metadata.last_extracted_email);
const personIntent = firstNonEmptyString(metadata.latest_real_estate_intent, leadProfile.intent);

const personName = firstNonEmptyString(
  db.person_name,
  metadata.whatsapp_profile_name,
  db.whatsapp_profile_name,
  db.push_name,
  phone ? `Contato ${phone}` : null,
  'Contato'
);

const contextPayload = {
  id: db.person_id || null,
  nome: personName,
  telefone: phone,
  email: personEmail,
  intencao_imobiliaria: personIntent,
  funil: db.person_crm_funnel_id || metadata.people_stage_funnel_id || null,
  etapa: db.person_crm_status || metadata.people_stage_status || 'Novo Lead',
  perfil_extraido: leadProfile,
  whatsapp_profile_name: metadata.whatsapp_profile_name || db.whatsapp_profile_name || null,
  whatsapp_profile_status: metadata.whatsapp_profile_status || db.whatsapp_profile_status || null,
  notas_ai: aiNotes.map((note) => note.content),
  imoveis_vinculados_ativos: linkedProperties,
};

return [{
  json: {
    ...db,
    phone,
    person_id: db.person_id || null,
    person_name: personName,
    person_email: personEmail,
    person_metadata: metadata,
    person_crm_funnel_id: db.person_crm_funnel_id || metadata.people_stage_funnel_id || null,
    person_crm_status: db.person_crm_status || metadata.people_stage_status || 'Novo Lead',
    person_linked_properties: linkedProperties,
    matched_people_count: db.person_id ? 1 : 0,
    matched_people_context: JSON.stringify(contextPayload, null, 2),
    active_properties_catalog_size: activePropertiesCatalog.length,
    active_properties_summary: JSON.stringify(activePropertiesSummary, null, 2),
    active_properties_context: JSON.stringify(activePropertiesSummary, null, 2),
    thread_id: db.thread_id || null,
    inbound_message_id: db.inbound_message_id || null
  }
}];