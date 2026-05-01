function esc(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function escJson(value) {
  const json = JSON.stringify(value ?? {});
  return `${esc(json)}::jsonb`;
}

function normalizeEmail(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function normalizeFullName(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

const replyData = $('Prepare Reply').first().json;
const sendResult = $json;

if (replyData.delivery_type === 'image' && Number(sendResult.media_index ?? 0) > 0) {
  return [{
    json: {
      ...sendResult,
      outbound_sql: 'SELECT 1 AS skipped_persist;',
    },
  }];
}

const updates = replyData.profile_updates && typeof replyData.profile_updates === 'object' && !Array.isArray(replyData.profile_updates)
  ? replyData.profile_updates
  : {};
const survey = updates.survey && typeof updates.survey === 'object' && !Array.isArray(updates.survey)
  ? updates.survey
  : {};
const leadProfile = updates.lead_profile && typeof updates.lead_profile === 'object' && !Array.isArray(updates.lead_profile)
  ? updates.lead_profile
  : {};
const nowIso = new Date().toISOString();
const author = replyData.agent_label || replyData.agent_id || 'Mariana Silva';
const extractedFullName = normalizeFullName(updates.full_name);
const extractedEmail = normalizeEmail(updates.email);
const extractedIntent = ['buy', 'sell', 'rent', 'unknown'].includes(updates.intent) ? updates.intent : 'unknown';
const scoreDelta = Number.isFinite(Number(updates.score_delta)) ? Math.max(0, Math.round(Number(updates.score_delta))) : 0;
const propertyLinks = Array.isArray(updates.property_links) ? updates.property_links : [];

function createNote(content, visibility) {
  return {
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    visibility,
    author,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

const notesToAppend = [
  ...(Array.isArray(updates.notes_ai) ? updates.notes_ai : [])
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .map((content) => createNote(content, 'ai')),
  ...(Array.isArray(updates.notes_internal) ? updates.notes_internal : [])
    .map((item) => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .map((content) => createNote(content, 'internal')),
];

const metadataPatch = {
  latest_real_estate_intent: extractedIntent,
  last_extracted_email: extractedEmail,
  qualification_source: 'whatsapp_ai',
  qualification_updated_at: nowIso,
  qualification_completed_at: survey.status === 'completed' ? nowIso : null,
  qualification_last_question: survey.last_question || null,
  qualification_score_current: Number.isFinite(Number(survey.score_current)) ? Number(survey.score_current) : 0,
  qualified_for_property_suggestions: survey.status === 'completed',
  survey_status: survey.status || 'in_progress',
  survey_completion_ratio: Number.isFinite(Number(survey.completion_ratio)) ? Number(survey.completion_ratio) : 0,
  survey_missing_fields: Array.isArray(survey.missing_fields) ? survey.missing_fields : [],
  survey_required_fields: Array.isArray(survey.required_fields) ? survey.required_fields : [],
  survey_completed_fields: Array.isArray(survey.completed_fields) ? survey.completed_fields : [],
  lead_profile: leadProfile,
  last_property_link_hints: propertyLinks,
  last_classification: replyData.classification || 'NAO_APLICAVEL',
};

const d = {
  ...replyData,
  send_result: sendResult,
};

const outboundSql = `
WITH payload AS (
  SELECT
    ${esc(d.thread_id)}::text AS thread_id,
    ${esc(d.agent_label || d.agent_id || 'Agente')}::text AS agent_label,
    ${esc(d.text)}::text AS message_text,
    ${esc(d.person_id || null)}::uuid AS person_id,
    ${esc(extractedFullName)}::text AS extracted_full_name,
    ${esc(extractedEmail)}::text AS extracted_email,
    ${esc(extractedIntent)}::text AS extracted_intent,
    ${scoreDelta}::integer AS score_delta,
    ${escJson(notesToAppend)} AS notes_to_append,
    ${escJson(propertyLinks)} AS property_links,
    ${escJson(metadataPatch)} AS metadata_patch,
    ${esc(d.provider_message_id || null)}::text AS provider_message_id,
    ${esc(nowIso)}::timestamptz AS executed_at
),
inserir_saida AS (
  INSERT INTO public.chat_messages (
    thread_id,
    agent,
    role,
    content,
    is_system,
    created_at
  )
  SELECT
    payload.thread_id,
    payload.agent_label,
    'AI Agent',
    payload.message_text,
    false,
    now()
  FROM payload
  RETURNING id
),
atualizar_thread AS (
  UPDATE public.chat_threads
  SET
    preview = (SELECT message_text FROM payload),
    unread = false,
    last_message_at = now(),
    updated_at = now()
  WHERE thread_id = (SELECT thread_id FROM payload)
  RETURNING person_id
),
pessoa_resolvida AS (
  SELECT COALESCE((SELECT person_id FROM payload), (SELECT person_id FROM atualizar_thread LIMIT 1)) AS person_id
),
notas_existentes AS (
  SELECT
    p.id,
    CASE
      WHEN jsonb_typeof(COALESCE(p.metadata, '{}'::jsonb)->'lead_notes') = 'array'
        THEN COALESCE(p.metadata, '{}'::jsonb)->'lead_notes'
      ELSE '[]'::jsonb
    END AS lead_notes,
    p.roles,
    p.metadata
  FROM public.people p
  WHERE p.id = (SELECT person_id FROM pessoa_resolvida)
),
atualizar_pessoa AS (
  UPDATE public.people p
  SET
    full_name = COALESCE((SELECT extracted_full_name FROM payload), NULLIF(p.full_name, '')),
    email = COALESCE((SELECT extracted_email FROM payload), p.email),
    crm_score = COALESCE(p.crm_score, 0) + (SELECT score_delta FROM payload),
    last_interaction_preview = (SELECT message_text FROM payload),
    crm_unread = false,
    roles = (
      SELECT COALESCE(array_agg(DISTINCT role_value), ARRAY[]::public.person_role[])
      FROM unnest(
        COALESCE(p.roles, ARRAY[]::public.person_role[])
        || CASE WHEN (SELECT extracted_intent FROM payload) = 'buy' THEN ARRAY['buyer'::public.person_role] ELSE ARRAY[]::public.person_role[] END
        || CASE WHEN (SELECT extracted_intent FROM payload) = 'sell' THEN ARRAY['seller'::public.person_role] ELSE ARRAY[]::public.person_role[] END
      ) AS role_value
    ),
    metadata = jsonb_set(
      COALESCE(p.metadata, '{}'::jsonb) || (SELECT metadata_patch FROM payload),
      '{lead_notes}',
      COALESCE((SELECT lead_notes FROM notas_existentes), '[]'::jsonb) || COALESCE((SELECT notes_to_append FROM payload), '[]'::jsonb),
      true
    ),
    updated_at = now()
  WHERE p.id = (SELECT person_id FROM pessoa_resolvida)
  RETURNING p.id
),
property_link_rows AS (
  SELECT
    (SELECT person_id FROM pessoa_resolvida) AS person_id,
    NULLIF(BTRIM(item->>'reference'), '') AS reference,
    CASE WHEN item->>'relationship_type' = 'owner' THEN 'owner' ELSE 'interested' END AS relationship_type,
    NULLIF(BTRIM(item->>'notes'), '') AS notes
  FROM payload,
  LATERAL jsonb_array_elements(COALESCE((SELECT property_links FROM payload), '[]'::jsonb)) AS item
  WHERE (SELECT person_id FROM pessoa_resolvida) IS NOT NULL
    AND NULLIF(BTRIM(item->>'reference'), '') IS NOT NULL
),
matched_properties AS (
  SELECT DISTINCT ON (pl.person_id, p.id, pl.relationship_type)
    pl.person_id,
    p.id AS property_id,
    pl.relationship_type,
    pl.notes,
    jsonb_build_object(
      'reference', pl.reference,
      'provider_message_id', (SELECT provider_message_id FROM payload),
      'matched_at', (SELECT executed_at FROM payload)
    ) AS metadata
  FROM property_link_rows pl
  JOIN public.properties p
    ON lower(p.title) = lower(pl.reference)
    OR lower(COALESCE(p.slug, '')) = lower(pl.reference)
    OR lower(COALESCE(p.address, '')) = lower(pl.reference)
    OR lower(p.title) LIKE '%' || lower(pl.reference) || '%'
    OR lower(COALESCE(p.address, '')) LIKE '%' || lower(pl.reference) || '%'
  ORDER BY pl.person_id, p.id, pl.relationship_type,
    CASE
      WHEN lower(COALESCE(p.slug, '')) = lower(pl.reference) THEN 0
      WHEN lower(p.title) = lower(pl.reference) THEN 1
      WHEN lower(COALESCE(p.address, '')) = lower(pl.reference) THEN 2
      ELSE 3
    END,
    p.updated_at DESC
),
upsert_property_links AS (
  INSERT INTO public.person_properties (
    person_id,
    property_id,
    relationship_type,
    source,
    notes,
    metadata
  )
  SELECT
    matched.person_id,
    matched.property_id,
    matched.relationship_type,
    'whatsapp_ai',
    matched.notes,
    matched.metadata
  FROM matched_properties matched
  ON CONFLICT (person_id, property_id, relationship_type) DO UPDATE SET
    source = EXCLUDED.source,
    notes = COALESCE(EXCLUDED.notes, public.person_properties.notes),
    metadata = COALESCE(public.person_properties.metadata, '{}'::jsonb) || COALESCE(EXCLUDED.metadata, '{}'::jsonb),
    updated_at = now()
  RETURNING id
)
SELECT (SELECT id FROM inserir_saida) AS outbound_message_id;
`;

return [{
  json: {
    ...d,
    outbound_sql: outboundSql,
  },
}];
