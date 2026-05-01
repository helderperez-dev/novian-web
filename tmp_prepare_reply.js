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

function normalizeStageSignal(value) {
  if (typeof value !== 'string' || !value.trim()) return 'none';

  const normalized = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const aliases = {
    none: 'none',
    manter: 'none',
    keep: 'none',
    sem_mudanca: 'none',
    no_change: 'none',
    novo_lead: 'novo_lead',
    novolead: 'novo_lead',
    new_lead: 'novo_lead',
    qualificacao: 'qualificacao',
    qualification: 'qualificacao',
    qualified: 'qualificacao',
    agendado: 'agendado',
    agenda: 'agendado',
    scheduled: 'agendado',
    visita_agendada: 'agendado',
    visita_realizada: 'visita_realizada',
    visitarealizada: 'visita_realizada',
    visited: 'visita_realizada',
    completed_visit: 'visita_realizada',
  };

  return aliases[normalized] || 'none';
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

function normalizeStringArray(value) {
  const input = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];

  for (const entry of input.flat()) {
    const normalized = asTrimmedString(entry);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function toNullableBoolean(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  const normalized = String(value).trim().toLowerCase();
  if (['true', 'sim', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'nao', 'no', '0'].includes(normalized)) return false;
  return null;
}

function normalizeLeadProfile(value) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    intent: normalizeIntent(raw.intent),
    property_type: asTrimmedString(raw.property_type || raw.tipo_imovel),
    city: asTrimmedString(raw.city || raw.cidade),
    neighborhoods: normalizeStringArray(raw.neighborhoods || raw.preferred_neighborhoods || raw.bairros),
    budget_min: toNumber(raw.budget_min || raw.price_min || raw.valor_minimo),
    budget_max: toNumber(raw.budget_max || raw.price_max || raw.budget || raw.valor_maximo),
    bedrooms_min: toNumber(raw.bedrooms_min || raw.min_bedrooms || raw.quartos),
    bathrooms_min: toNumber(raw.bathrooms_min || raw.min_bathrooms || raw.banheiros),
    parking_spots_min: toNumber(raw.parking_spots_min || raw.min_parking_spots || raw.vagas),
    built_area_min: toNumber(raw.built_area_min || raw.min_built_area || raw.area_minima),
    timeline: asTrimmedString(raw.timeline || raw.prazo),
    financing_status: asTrimmedString(raw.financing_status || raw.payment_method || raw.forma_pagamento),
    needs_to_sell_first: toNullableBoolean(raw.needs_to_sell_first || raw.depende_venda),
    preferred_features: normalizeStringArray(raw.preferred_features || raw.features || raw.caracteristicas),
    reason: asTrimmedString(raw.reason || raw.motivo),
    current_property_address: asTrimmedString(raw.current_property_address || raw.address || raw.endereco_imovel),
    estimated_value: toNumber(raw.estimated_value || raw.valor_estimado),
    occupancy_status: asTrimmedString(raw.occupancy_status || raw.ocupacao),
  };
}

function mergeLeadProfile(currentProfile, incomingProfile, fallbackIntent) {
  const mergedIntent = normalizeIntent(incomingProfile.intent || currentProfile.intent || fallbackIntent);
  return {
    intent: mergedIntent,
    property_type: incomingProfile.property_type || currentProfile.property_type || null,
    city: incomingProfile.city || currentProfile.city || null,
    neighborhoods: incomingProfile.neighborhoods.length ? incomingProfile.neighborhoods : currentProfile.neighborhoods,
    budget_min: incomingProfile.budget_min ?? currentProfile.budget_min,
    budget_max: incomingProfile.budget_max ?? currentProfile.budget_max,
    bedrooms_min: incomingProfile.bedrooms_min ?? currentProfile.bedrooms_min,
    bathrooms_min: incomingProfile.bathrooms_min ?? currentProfile.bathrooms_min,
    parking_spots_min: incomingProfile.parking_spots_min ?? currentProfile.parking_spots_min,
    built_area_min: incomingProfile.built_area_min ?? currentProfile.built_area_min,
    timeline: incomingProfile.timeline || currentProfile.timeline || null,
    financing_status: incomingProfile.financing_status || currentProfile.financing_status || null,
    needs_to_sell_first: incomingProfile.needs_to_sell_first !== null ? incomingProfile.needs_to_sell_first : currentProfile.needs_to_sell_first,
    preferred_features: incomingProfile.preferred_features.length ? incomingProfile.preferred_features : currentProfile.preferred_features,
    reason: incomingProfile.reason || currentProfile.reason || null,
    current_property_address: incomingProfile.current_property_address || currentProfile.current_property_address || null,
    estimated_value: incomingProfile.estimated_value ?? currentProfile.estimated_value,
    occupancy_status: incomingProfile.occupancy_status || currentProfile.occupancy_status || null,
  };
}

function hasQualificationValue(profile, fieldId) {
  switch (fieldId) {
    case 'intent':
      return ['buy', 'sell', 'rent'].includes(profile.intent);
    case 'property_type':
      return !!profile.property_type;
    case 'city_or_neighborhood':
      return !!profile.city || profile.neighborhoods.length > 0;
    case 'budget_max':
      return Number.isFinite(profile.budget_max) && profile.budget_max > 0;
    case 'bedrooms_or_area':
      return (Number.isFinite(profile.bedrooms_min) && profile.bedrooms_min > 0)
        || (Number.isFinite(profile.built_area_min) && profile.built_area_min > 0);
    case 'timeline':
      return !!profile.timeline;
    case 'financing_status':
      return !!profile.financing_status;
    case 'needs_to_sell_first':
      return profile.needs_to_sell_first !== null;
    case 'current_property_location':
      return !!profile.current_property_address || !!profile.city || profile.neighborhoods.length > 0;
    case 'estimated_value':
      return Number.isFinite(profile.estimated_value) && profile.estimated_value > 0;
    case 'reason':
      return !!profile.reason;
    case 'occupancy_status':
      return !!profile.occupancy_status;
    default:
      return false;
  }
}

function getQualificationBlueprint(intent) {
  if (intent === 'sell') {
    return [
      { id: 'intent', weight: 15, prompt: 'Seu foco hoje e vender esse imovel, certo?' },
      { id: 'property_type', weight: 15, prompt: 'Qual e o tipo do imovel que voce quer vender?' },
      { id: 'current_property_location', weight: 25, prompt: 'Em qual bairro, cidade ou endereco fica o imovel?' },
      { id: 'estimated_value', weight: 15, prompt: 'Qual faixa de valor voce imagina para esse imovel?' },
      { id: 'timeline', weight: 10, prompt: 'Em que prazo voce pretende vender?' },
      { id: 'reason', weight: 10, prompt: 'Qual o principal motivo da venda?' },
      { id: 'occupancy_status', weight: 10, prompt: 'O imovel esta ocupado, vazio ou alugado hoje?' },
    ];
  }

  if (intent === 'buy' || intent === 'rent') {
    return [
      { id: 'intent', weight: 15, prompt: 'Voce quer comprar ou alugar?' },
      { id: 'property_type', weight: 15, prompt: 'Que tipo de imovel faz mais sentido para voce?' },
      { id: 'city_or_neighborhood', weight: 20, prompt: 'Qual cidade ou bairro voce prefere?' },
      { id: 'budget_max', weight: 20, prompt: 'Qual faixa de investimento ou aluguel voce quer trabalhar?' },
      { id: 'bedrooms_or_area', weight: 10, prompt: 'Quantos quartos ou qual metragem minima voce busca?' },
      { id: 'timeline', weight: 10, prompt: 'Em que prazo voce pretende fechar negocio?' },
      { id: 'financing_status', weight: 5, prompt: 'Vai financiar, pagar a vista ou ainda esta avaliando?' },
      { id: 'needs_to_sell_first', weight: 5, prompt: 'Voce depende da venda de outro imovel para seguir com a compra?' },
    ];
  }

  return [
    { id: 'intent', weight: 100, prompt: 'Hoje voce busca comprar, vender ou alugar?' },
  ];
}

function buildQualificationStatus(profile) {
  const intent = normalizeIntent(profile.intent);
  const blueprint = getQualificationBlueprint(intent);
  let score = 0;
  const completedFields = [];
  const missingFields = [];

  for (const field of blueprint) {
    if (hasQualificationValue(profile, field.id)) {
      score += field.weight;
      completedFields.push(field.id);
    } else {
      missingFields.push(field.id);
    }
  }

  return {
    journey: intent,
    status: missingFields.length === 0 && intent !== 'unknown' ? 'completed' : 'in_progress',
    score,
    completion_ratio: blueprint.length ? Number((completedFields.length / blueprint.length).toFixed(2)) : 0,
    required_fields: blueprint.map((field) => field.id),
    completed_fields: completedFields,
    missing_fields: missingFields,
    next_questions: blueprint
      .filter((field) => missingFields.includes(field.id))
      .slice(0, 2)
      .map((field) => ({ field: field.id, prompt: field.prompt })),
  };
}

function buildProfileSnapshot(profile) {
  const segments = [];

  if (['buy', 'sell', 'rent'].includes(profile.intent)) segments.push(`intencao: ${profile.intent}`);
  if (profile.property_type) segments.push(`tipo: ${profile.property_type}`);
  if (profile.city || profile.neighborhoods.length) {
    const location = [profile.city, profile.neighborhoods.join(', ')].filter(Boolean).join(' | ');
    if (location) segments.push(`regiao: ${location}`);
  }
  if (Number.isFinite(profile.budget_max) && profile.budget_max > 0) segments.push(`orcamento maximo: ${profile.budget_max}`);
  if (Number.isFinite(profile.bedrooms_min) && profile.bedrooms_min > 0) segments.push(`quartos minimos: ${profile.bedrooms_min}`);
  if (profile.timeline) segments.push(`prazo: ${profile.timeline}`);
  if (profile.financing_status) segments.push(`pagamento: ${profile.financing_status}`);
  if (profile.reason) segments.push(`motivo: ${profile.reason}`);
  if (profile.current_property_address) segments.push(`endereco do imovel: ${profile.current_property_address}`);
  if (Number.isFinite(profile.estimated_value) && profile.estimated_value > 0) segments.push(`valor estimado: ${profile.estimated_value}`);

  return segments.length ? `Perfil atualizado: ${segments.join('; ')}` : null;
}

function getChangedProfileFields(previousProfile, nextProfile) {
  return Object.keys(nextProfile).filter((key) => {
    const before = JSON.stringify(previousProfile[key] ?? null);
    const after = JSON.stringify(nextProfile[key] ?? null);
    if (before === after) return false;

    const value = nextProfile[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined && value !== '';
  });
}

function getStageRank(stageSignal) {
  const ranks = {
    none: 0,
    novo_lead: 1,
    qualificacao: 2,
    agendado: 3,
    visita_realizada: 4,
  };

  return ranks[normalizeStageSignal(stageSignal)] || 0;
}

function countRealLeadSignals(profile, propertyLinks) {
  const signals = [
    !!profile.property_type,
    !!profile.city || profile.neighborhoods.length > 0 || !!profile.current_property_address,
    (Number.isFinite(profile.budget_min) && profile.budget_min > 0)
      || (Number.isFinite(profile.budget_max) && profile.budget_max > 0)
      || (Number.isFinite(profile.estimated_value) && profile.estimated_value > 0),
    (Number.isFinite(profile.bedrooms_min) && profile.bedrooms_min > 0)
      || (Number.isFinite(profile.bathrooms_min) && profile.bathrooms_min > 0)
      || (Number.isFinite(profile.parking_spots_min) && profile.parking_spots_min > 0)
      || (Number.isFinite(profile.built_area_min) && profile.built_area_min > 0),
    !!profile.timeline,
    !!profile.financing_status,
    !!profile.reason,
    !!profile.occupancy_status,
    propertyLinks.length > 0,
  ];

  return signals.filter(Boolean).length;
}

function hasUrgentTimeline(value) {
  const normalized = asTrimmedString(value)?.toLowerCase() || '';
  if (!normalized) return false;

  return /(agora|imediat|urgente|urgencia|essa semana|este mes|ainda esse mes|o quanto antes|rapido|logo)/.test(
    normalized,
  );
}

function hasVisitIntent(value) {
  const normalized = asTrimmedString(value)
    ?.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') || '';

  if (!normalized) return false;

  return /(agend|agenda|visita|visitar|conhecer o imovel|ver o imovel|marcar horario|marcar visita)/.test(normalized);
}

function normalizeReason(value, fallback) {
  const normalized = asTrimmedString(value) || asTrimmedString(fallback);
  return normalized ? normalized.slice(0, 280) : null;
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
const rawCrmUpdates = rawUpdates.crm && typeof rawUpdates.crm === 'object' && !Array.isArray(rawUpdates.crm)
  ? rawUpdates.crm
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
const existingProfile = normalizeLeadProfile(original.person_metadata?.lead_profile || {});
const incomingProfile = normalizeLeadProfile(rawUpdates.lead_profile || {});
const fallbackIntent = normalizeIntent(rawUpdates.intent || original.person_metadata?.latest_real_estate_intent || existingProfile.intent);
const mergedLeadProfile = mergeLeadProfile(existingProfile, incomingProfile, fallbackIntent);
const qualificationBefore = buildQualificationStatus({
  ...existingProfile,
  intent: normalizeIntent(existingProfile.intent || original.person_metadata?.latest_real_estate_intent),
});
const qualificationAfter = buildQualificationStatus(mergedLeadProfile);
const changedProfileFields = getChangedProfileFields(existingProfile, mergedLeadProfile);
const inboundMessage = asTrimmedString(original.message) || '';
const currentStageSignal = normalizeStageSignal(
  original.person_lead?.status ||
  original.crm_status ||
  original.person_metadata?.people_stage_status ||
  original.person_metadata?.crm_status,
);
const previousEmail = normalizeEmail(
  original.email ||
  original.person_email ||
  original.person_metadata?.last_extracted_email,
);
const previousPropertyLinks = normalizePropertyLinks(original.person_metadata?.last_property_link_hints || []);
const previousPropertyLinkKeys = new Set(
  previousPropertyLinks.map((item) => `${item.reference.toLowerCase()}::${item.relationship_type}`),
);
const newPropertyLinks = propertyLinks.filter(
  (item) => !previousPropertyLinkKeys.has(`${item.reference.toLowerCase()}::${item.relationship_type}`),
);
const leadSignalCount = countRealLeadSignals(mergedLeadProfile, propertyLinks);
const aiStageSignal = normalizeStageSignal(
  rawCrmUpdates.stage_signal || rawCrmUpdates.target_stage || rawCrmUpdates.stage || rawCrmUpdates.funnel_stage,
);
let crmStageSignal = aiStageSignal;
let crmStageReason = normalizeReason(rawCrmUpdates.reason, null);

if (crmStageSignal === 'none') {
  if (qualificationAfter.status === 'completed' && ['buy', 'sell', 'rent'].includes(mergedLeadProfile.intent)) {
    crmStageSignal = 'qualificacao';
    crmStageReason = normalizeReason(crmStageReason, 'Lead com qualificacao concluida e intencao imobiliaria confirmada.');
  } else if (
    ['buy', 'sell', 'rent'].includes(mergedLeadProfile.intent)
    && leadSignalCount >= 3
    && classification !== 'COLD'
  ) {
    crmStageSignal = 'qualificacao';
    crmStageReason = normalizeReason(
      crmStageReason,
      'Lead com intencao real e criterios concretos suficientes para seguir em qualificacao comercial.',
    );
  } else if (currentStageSignal === 'none' && classification !== 'NAO_APLICAVEL' && inboundMessage) {
    crmStageSignal = 'novo_lead';
    crmStageReason = normalizeReason(crmStageReason, 'Novo contato valido recebido pelo WhatsApp.');
  }
}

if (getStageRank(crmStageSignal) <= getStageRank(currentStageSignal)) {
  crmStageSignal = 'none';
  crmStageReason = null;
}

let deliveryType = requestedDeliveryType !== 'text' && (mediaUrls.length > 0 || !!deliveryReference)
  ? requestedDeliveryType
  : 'text';

if (qualificationAfter.status !== 'completed' && !deliveryReference && propertyLinks.length === 0) {
  deliveryType = 'text';
}

const qualificationProgressPoints = Math.max(0, qualificationAfter.score - qualificationBefore.score);
const changedCriteriaFields = changedProfileFields.filter((field) => [
  'property_type',
  'city',
  'neighborhoods',
  'budget_min',
  'budget_max',
  'bedrooms_min',
  'bathrooms_min',
  'parking_spots_min',
  'built_area_min',
  'timeline',
  'financing_status',
  'needs_to_sell_first',
  'preferred_features',
  'reason',
  'current_property_address',
  'estimated_value',
  'occupancy_status',
].includes(field));
const scoreDelta = Math.min(
  40,
  qualificationProgressPoints
    + (extractedEmail && extractedEmail !== previousEmail ? 6 : 0)
    + Math.min(newPropertyLinks.length * 4, 8)
    + Math.min(changedCriteriaFields.length * 2, 8)
    + (
      classification === 'HOT'
      && (
        changedCriteriaFields.length > 0
        || newPropertyLinks.length > 0
        || (extractedEmail && extractedEmail !== previousEmail)
        || hasVisitIntent(inboundMessage)
      )
        ? 3
        : 0
    )
    + (
      changedProfileFields.includes('timeline') && hasUrgentTimeline(mergedLeadProfile.timeline)
        ? 4
        : 0
    )
    + (
      mergedLeadProfile.intent === 'sell'
      && (
        changedProfileFields.includes('current_property_address')
        || changedProfileFields.includes('estimated_value')
        || changedProfileFields.includes('occupancy_status')
      )
        ? 4
        : 0
    ),
);
const explicitAiNotes = uniqueStrings(rawUpdates.notes_ai).slice(0, 4);
const explicitInternalNotes = uniqueStrings(rawUpdates.notes_internal).slice(0, 4);
const generatedAiNotes = [];
const generatedInternalNotes = [];

if (changedProfileFields.length > 0) {
  const snapshot = buildProfileSnapshot(mergedLeadProfile);
  if (snapshot) generatedAiNotes.push(snapshot);
}

if (qualificationAfter.status === 'completed' && qualificationBefore.status !== 'completed') {
  generatedInternalNotes.push('Pesquisa concluida. Lead pronto para receber sugestoes de imoveis aderentes ao perfil.');
}

const normalizedSurvey = rawUpdates.survey && typeof rawUpdates.survey === 'object' && !Array.isArray(rawUpdates.survey)
  ? rawUpdates.survey
  : {};
const surveyLastQuestion = qualificationAfter.status === 'completed'
  ? null
  : asTrimmedString(normalizedSurvey.last_question);

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
    qualification_status: qualificationAfter,
    profile_updates: {
      full_name: normalizeFullName(rawUpdates.full_name),
      email: normalizeEmail(rawUpdates.email),
      intent: mergedLeadProfile.intent,
      score_delta: scoreDelta,
      notes_ai: uniqueStrings([...explicitAiNotes, ...generatedAiNotes]).slice(0, 6),
      notes_internal: uniqueStrings([...explicitInternalNotes, ...generatedInternalNotes]).slice(0, 6),
      property_links: propertyLinks,
      crm: {
        stage_signal: crmStageSignal,
        reason: crmStageReason,
      },
      lead_profile: mergedLeadProfile,
      survey: {
        status: qualificationAfter.status,
        missing_fields: qualificationAfter.missing_fields,
        required_fields: qualificationAfter.required_fields,
        completed_fields: qualificationAfter.completed_fields,
        completion_ratio: qualificationAfter.completion_ratio,
        score_current: qualificationAfter.score,
        last_question: surveyLastQuestion,
      },
    },
  },
}];
