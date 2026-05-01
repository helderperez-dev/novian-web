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
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
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
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
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
    .filter((item) => item.property_id && item.status === 'active')
    .slice(0, 8);
}

function normalizeActivePropertiesCatalog(value) {
  return parseJsonArray(value)
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
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
    .filter((item) => item.id && item.title && item.status === 'active')
    .slice(0, 60);
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

function normalizeIntent(value) {
  const normalized = asString(value)?.toLowerCase();
  return ['buy', 'sell', 'rent', 'unknown'].includes(normalized) ? normalized : 'unknown';
}

function normalizeStringArray(value) {
  const input = Array.isArray(value) ? value : [value];
  const seen = new Set();
  const output = [];

  for (const entry of input.flat()) {
    const normalized = asString(entry);
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

function normalizeTextKey(value) {
  const normalized = asString(value);
  if (!normalized) return null;
  return normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeLeadProfile(value) {
  const raw = parseJsonObject(value);

  return {
    intent: normalizeIntent(raw.intent),
    property_type: asString(raw.property_type || raw.tipo_imovel),
    city: asString(raw.city || raw.cidade),
    neighborhoods: normalizeStringArray(raw.neighborhoods || raw.preferred_neighborhoods || raw.bairros),
    budget_min: toNumber(raw.budget_min || raw.price_min || raw.valor_minimo),
    budget_max: toNumber(raw.budget_max || raw.price_max || raw.budget || raw.valor_maximo),
    bedrooms_min: toNumber(raw.bedrooms_min || raw.min_bedrooms || raw.quartos),
    bathrooms_min: toNumber(raw.bathrooms_min || raw.min_bathrooms || raw.banheiros),
    parking_spots_min: toNumber(raw.parking_spots_min || raw.min_parking_spots || raw.vagas),
    built_area_min: toNumber(raw.built_area_min || raw.min_built_area || raw.area_minima),
    timeline: asString(raw.timeline || raw.prazo),
    financing_status: asString(raw.financing_status || raw.payment_method || raw.forma_pagamento),
    needs_to_sell_first: toNullableBoolean(raw.needs_to_sell_first || raw.depende_venda),
    preferred_features: normalizeStringArray(raw.preferred_features || raw.features || raw.caracteristicas),
    reason: asString(raw.reason || raw.motivo),
    current_property_address: asString(raw.current_property_address || raw.address || raw.endereco_imovel),
    estimated_value: toNumber(raw.estimated_value || raw.valor_estimado),
    occupancy_status: asString(raw.occupancy_status || raw.ocupacao),
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

function scorePropertyMatch(property, profile) {
  const propertyType = normalizeTextKey(property.features.property_type || property.title);
  const targetType = normalizeTextKey(profile.property_type);
  if (targetType && propertyType && propertyType !== targetType) {
    return null;
  }

  const cityKey = normalizeTextKey(property.features.city);
  const targetCity = normalizeTextKey(profile.city);
  if (targetCity && cityKey && cityKey !== targetCity) {
    return null;
  }

  const targetNeighborhoods = profile.neighborhoods.map((item) => normalizeTextKey(item)).filter(Boolean);
  const propertyNeighborhood = normalizeTextKey(property.features.neighborhood);
  if (targetNeighborhoods.length && propertyNeighborhood && !targetNeighborhoods.includes(propertyNeighborhood)) {
    return null;
  }

  if (Number.isFinite(profile.budget_max) && Number.isFinite(property.price) && property.price > profile.budget_max * 1.1) {
    return null;
  }

  if (Number.isFinite(profile.bedrooms_min) && Number.isFinite(Number(property.features.bedrooms)) && Number(property.features.bedrooms) < profile.bedrooms_min) {
    return null;
  }

  let score = 0;
  const reasons = [];

  if (targetType && propertyType === targetType) {
    score += 25;
    reasons.push('tipo compativel');
  }
  if (targetCity && cityKey === targetCity) {
    score += 20;
    reasons.push('cidade compativel');
  }
  if (targetNeighborhoods.length && propertyNeighborhood && targetNeighborhoods.includes(propertyNeighborhood)) {
    score += 20;
    reasons.push('bairro compativel');
  }
  if (Number.isFinite(profile.budget_max) && Number.isFinite(property.price)) {
    if (property.price <= profile.budget_max) {
      score += 20;
      reasons.push('dentro da faixa de valor');
    } else {
      score += 10;
      reasons.push('levemente acima da faixa');
    }
  }
  if (Number.isFinite(profile.budget_min) && Number.isFinite(property.price) && property.price >= profile.budget_min) {
    score += 5;
  }
  if (Number.isFinite(profile.bedrooms_min) && Number.isFinite(Number(property.features.bedrooms))) {
    score += 10;
    reasons.push('quartos aderentes');
  }
  if (Number.isFinite(profile.bathrooms_min) && Number.isFinite(Number(property.features.bathrooms)) && Number(property.features.bathrooms) >= profile.bathrooms_min) {
    score += 5;
  }
  if (Number.isFinite(profile.parking_spots_min) && Number.isFinite(Number(property.features.parking)) && Number(property.features.parking) >= profile.parking_spots_min) {
    score += 5;
  }
  if (Number.isFinite(profile.built_area_min) && Number.isFinite(Number(property.features.built_area)) && Number(property.features.built_area) >= profile.built_area_min) {
    score += 5;
  }

  if (score <= 0) {
    return null;
  }

  return {
    property,
    match_score: score,
    reasons,
  };
}

function buildProfileBasedRecommendations(items, profile, qualification) {
  if (qualification.status !== 'completed' || !['buy', 'rent'].includes(profile.intent)) {
    return [];
  }

  return items
    .map((item) => scorePropertyMatch(item, profile))
    .filter(Boolean)
    .sort((a, b) => b.match_score - a.match_score || (a.property.price || 0) - (b.property.price || 0))
    .slice(0, 6)
    .map((entry) => ({
      property_id: entry.property.id,
      title: entry.property.title,
      slug: entry.property.slug,
      public_url: entry.property.public_url || null,
      cover_image: entry.property.cover_image || null,
      address: entry.property.address,
      price: entry.property.price,
      city: entry.property.features.city || null,
      neighborhood: entry.property.features.neighborhood || null,
      property_type: entry.property.features.property_type || null,
      bedrooms: entry.property.features.bedrooms || null,
      bathrooms: entry.property.features.bathrooms || null,
      parking: entry.property.features.parking || null,
      built_area: entry.property.features.built_area || null,
      match_score: entry.match_score,
      match_reasons: entry.reasons,
    }));
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

function buildCatalogSummaryForConversation(activePropertiesCatalog, qualification, recommendations) {
  if (qualification.status !== 'completed') {
    return {
      total_ativos_em_contexto: activePropertiesCatalog.length,
      survey_status: qualification.status,
      completion_ratio: qualification.completion_ratio,
      campos_faltantes: qualification.missing_fields,
      proximas_perguntas_sugeridas: qualification.next_questions,
      exemplos: [],
      observacao: 'Nao apresente opcoes de imoveis enquanto o survey estiver incompleto. Priorize descobrir os campos faltantes antes de recomendar qualquer opcao.',
    };
  }

  if (!recommendations.length) {
    return {
      total_ativos_em_contexto: activePropertiesCatalog.length,
      survey_status: qualification.status,
      completion_ratio: qualification.completion_ratio,
      exemplos: [],
      observacao: 'O survey esta completo, mas ainda nao ha imoveis aderentes ao perfil no contexto atual. Nao invente opcoes. Pergunte qual criterio o lead aceita flexibilizar ou use as ferramentas seguras para uma busca mais precisa.',
    };
  }

  return {
    total_recomendado: recommendations.length,
    survey_status: qualification.status,
    completion_ratio: qualification.completion_ratio,
    exemplos: recommendations,
    observacao: 'Apresente somente estas opcoes ou outras que sejam claramente aderentes ao perfil real do lead.',
  };
}

const db = $json || {};
const metadata = parseJsonObject(db.person_metadata);
const linkedProperties = normalizeLinkedProperties(db.person_linked_properties);
const activePropertiesCatalog = normalizeActivePropertiesCatalog(db.active_properties_catalog);
const aiNotes = normalizeLeadNotes(metadata.lead_notes);
const leadProfile = normalizeLeadProfile(metadata.lead_profile);
const personEmail = firstNonEmptyString(db.person_email, metadata.last_extracted_email);
const personIntent = normalizeIntent(firstNonEmptyString(metadata.latest_real_estate_intent, leadProfile.intent));
const normalizedLeadProfile = {
  ...leadProfile,
  intent: personIntent !== 'unknown' ? personIntent : leadProfile.intent,
};
const qualificationStatus = buildQualificationStatus(normalizedLeadProfile);
const profileRecommendations = buildProfileBasedRecommendations(activePropertiesCatalog, normalizedLeadProfile, qualificationStatus);
const activePropertiesSummary = buildCatalogSummaryForConversation(activePropertiesCatalog, qualificationStatus, profileRecommendations);

const phone = firstNonEmptyString(
  db.phone,
  db.whatsapp_profile_number,
  metadata.whatsapp_profile_number,
  extractPhoneFromJid(db.thread_id),
  extractPhoneFromJid(db.remote_jid),
  extractPhoneFromJid(metadata.whatsapp_jid)
);

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
  perfil_extraido: normalizedLeadProfile,
  survey_status: qualificationStatus,
  whatsapp_profile_name: metadata.whatsapp_profile_name || db.whatsapp_profile_name || null,
  whatsapp_profile_status: metadata.whatsapp_profile_status || db.whatsapp_profile_status || null,
  notas_ai: aiNotes.map((note) => note.content),
  imoveis_vinculados_ativos: linkedProperties,
  imoveis_recomendados_por_perfil: profileRecommendations,
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
    qualification_status: qualificationStatus,
    profile_based_property_options: profileRecommendations,
    active_properties_catalog_size: activePropertiesCatalog.length,
    active_properties_summary: JSON.stringify(activePropertiesSummary, null, 2),
    active_properties_context: JSON.stringify(activePropertiesSummary, null, 2),
    thread_id: db.thread_id || null,
    inbound_message_id: db.inbound_message_id || null,
  }
}];
