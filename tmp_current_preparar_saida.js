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
const crmUpdates = updates.crm && typeof updates.crm === 'object' && !Array.isArray(updates.crm)
  ? updates.crm
  : {};
const nowIso = new Date().toISOString();
const author = replyData.agent_label || replyData.agent_id || 'Mariana Silva';
const extractedFullName = normalizeFullName(updates.full_name);
const extractedEmail = normalizeEmail(updates.email);
const extractedIntent = ['buy', 'sell', 'rent', 'unknown'].includes(updates.intent) ? updates.intent : 'unknown';
const scoreDelta = Number.isFinite(Number(updates.score_delta)) ? Math.max(0, Math.round(Number(updates.score_delta))) : 0;
const crmStageSignal = normalizeStageSignal(
  crmUpdates.stage_signal ?? crmUpdates.target_stage ?? crmUpdates.stage ?? crmUpdates.funnel_stage,
);
const crmStageReason = typeof crmUpdates.reason === 'string' && crmUpdates.reason.trim()
  ? crmUpdates.reason.trim().slice(0, 280)
  : null;
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
  last_crm_stage_signal: crmStageSignal,
  last_crm_stage_reason: crmStageReason,
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
    ${esc(crmStageSignal)}::text AS crm_stage_signal,
    ${esc(crmStageReason)}::text AS crm_stage_reason,
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
    p.tags,
    p.metadata,
    p.crm_status,
    p.crm_funnel_id,
    COALESCE(p.stage_points, 0) AS stage_points,
    COALESCE(p.crm_score, 0) AS crm_score
  FROM public.people p
  WHERE p.id = (SELECT person_id FROM pessoa_resolvida)
),
funil_padrao AS (
  SELECT f.id AS funnel_id
  FROM public.funnels f
  WHERE f.type = 'lead'
  ORDER BY f.created_at ASC
  LIMIT 1
),
estado_crm AS (
  SELECT
    ne.id AS person_id,
    ne.roles,
    COALESCE(ne.tags, ARRAY[]::text[]) AS tags,
    ne.metadata,
    ne.crm_status,
    COALESCE(ne.crm_funnel_id, fp.funnel_id) AS funnel_id,
    ne.stage_points,
    ne.crm_score,
    CASE
      WHEN (SELECT crm_stage_signal FROM payload) IN ('novo_lead', 'qualificacao', 'agendado', 'visita_realizada')
        THEN (SELECT crm_stage_signal FROM payload)
      ELSE NULL
    END AS desired_stage_signal,
    CASE
      WHEN COALESCE(ne.metadata, '{}'::jsonb) -> 'engagement_scoring' ->> 'last_provider_message_id'
        = (SELECT provider_message_id FROM payload)
        THEN 0
      ELSE GREATEST((SELECT score_delta FROM payload), 0)
    END AS applied_score_delta
  FROM notas_existentes ne
  LEFT JOIN funil_padrao fp ON TRUE
),
etapas_funil AS (
  SELECT
    fs.funnel_id,
    fs.title,
    fs."order",
    lower(
      regexp_replace(
        translate(
          COALESCE(fs.title, ''),
          'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
          'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
        ),
        '[^a-zA-Z0-9]+',
        '',
        'g'
      )
    ) AS title_key
  FROM public.funnel_stages fs
  WHERE fs.funnel_id = (SELECT funnel_id FROM estado_crm LIMIT 1)
),
estagio_atual AS (
  SELECT ef.title, ef."order", ef.title_key
  FROM etapas_funil ef
  JOIN estado_crm ec
    ON ef.title_key = lower(
      regexp_replace(
        translate(
          COALESCE(ec.crm_status, ''),
          'ÁÀÃÂÄÉÈÊËÍÌÎÏÓÒÕÔÖÚÙÛÜÇáàãâäéèêëíìîïóòõôöúùûüç',
          'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
        ),
        '[^a-zA-Z0-9]+',
        '',
        'g'
      )
    )
  LIMIT 1
),
estagio_alvo_bruto AS (
  SELECT ef.title, ef."order", ef.title_key
  FROM etapas_funil ef
  CROSS JOIN estado_crm ec
  WHERE ec.desired_stage_signal IS NOT NULL
    AND (
      (
        ec.desired_stage_signal = 'novo_lead'
        AND (ef.title_key IN ('novolead', 'newlead', 'novo') OR ef."order" = (SELECT MIN("order") FROM etapas_funil))
      )
      OR (
        ec.desired_stage_signal = 'qualificacao'
        AND (ef.title_key IN ('qualificacao', 'qualification', 'qualified') OR ef.title_key LIKE '%qualific%')
      )
      OR (
        ec.desired_stage_signal = 'agendado'
        AND (
          ef.title_key IN ('agendado', 'scheduled', 'appointment')
          OR ef.title_key LIKE '%agend%'
          OR ef.title_key LIKE '%atendimento%'
          OR ef.title_key LIKE '%visiting%'
        )
      )
      OR (
        ec.desired_stage_signal = 'visita_realizada'
        AND (
          ef.title_key IN ('visitarealizada', 'visited', 'visitcompleted')
          OR ef.title_key LIKE '%visitarealizada%'
          OR ef.title_key LIKE '%realizada%'
          OR ef.title_key LIKE '%posvisita%'
        )
      )
    )
  ORDER BY
    CASE
      WHEN ec.desired_stage_signal = 'novo_lead' AND ef.title_key IN ('novolead', 'newlead', 'novo') THEN 0
      WHEN ec.desired_stage_signal = 'qualificacao' AND ef.title_key IN ('qualificacao', 'qualification', 'qualified') THEN 0
      WHEN ec.desired_stage_signal = 'agendado' AND ef.title_key IN ('agendado', 'scheduled', 'appointment') THEN 0
      WHEN ec.desired_stage_signal = 'visita_realizada' AND ef.title_key IN ('visitarealizada', 'visited', 'visitcompleted') THEN 0
      ELSE 1
    END,
    ef."order" ASC
  LIMIT 1
),
estagio_final AS (
  SELECT
    ec.person_id,
    ec.funnel_id,
    ec.applied_score_delta,
    CASE
      WHEN ec.desired_stage_signal IS NULL THEN ec.crm_status
      WHEN eab.title IS NULL THEN ec.crm_status
      WHEN ea.title IS NULL THEN eab.title
      WHEN ec.crm_status IS NULL THEN eab.title
      WHEN eab."order" > ea."order" THEN eab.title
      ELSE ec.crm_status
    END AS next_status,
    CASE
      WHEN ec.desired_stage_signal IS NULL THEN false
      WHEN eab.title IS NULL THEN false
      WHEN ea.title IS NULL THEN ec.crm_status IS DISTINCT FROM eab.title
      WHEN ec.crm_status IS NULL THEN ec.crm_status IS DISTINCT FROM eab.title
      WHEN eab."order" > ea."order" THEN true
      ELSE false
    END AS should_move_stage
  FROM estado_crm ec
  LEFT JOIN estagio_atual ea ON TRUE
  LEFT JOIN estagio_alvo_bruto eab ON TRUE
),
regra_aplicavel AS (
  SELECT
    ef.person_id,
    ef.funnel_id AS next_funnel_id,
    ef.next_status,
    ef.should_move_stage,
    COALESCE(r.add_roles, ARRAY[]::public.person_role[]) AS add_roles,
    COALESCE(r.remove_roles, ARRAY[]::public.person_role[]) AS remove_roles,
    COALESCE(r.add_tags, ARRAY[]::text[]) AS add_tags,
    COALESCE(r.remove_tags, ARRAY[]::text[]) AS remove_tags,
    COALESCE(r.points_delta, 0) AS points_delta,
    CASE
      WHEN jsonb_typeof(COALESCE(ec.metadata, '{}'::jsonb) -> 'people_automation') = 'object'
        THEN COALESCE(ec.metadata, '{}'::jsonb) -> 'people_automation' ->> COALESCE(ef.funnel_id::text, 'default')
      ELSE NULL
    END AS last_applied_stage,
    CASE
      WHEN ef.should_move_stage
        AND r.stage_title IS NOT NULL
        AND COALESCE(
          CASE
            WHEN jsonb_typeof(COALESCE(ec.metadata, '{}'::jsonb) -> 'people_automation') = 'object'
              THEN COALESCE(ec.metadata, '{}'::jsonb) -> 'people_automation' ->> COALESCE(ef.funnel_id::text, 'default')
            ELSE NULL
          END,
          ''
        ) IS DISTINCT FROM COALESCE(ef.next_status, '')
        THEN true
      ELSE false
    END AS should_apply_rule
  FROM estagio_final ef
  JOIN estado_crm ec
    ON ec.person_id = ef.person_id
  LEFT JOIN public.funnel_stage_people_rules r
    ON r.funnel_id = ef.funnel_id
   AND r.stage_title = ef.next_status
),
atualizar_pessoa AS (
  UPDATE public.people p
  SET
    full_name = COALESCE((SELECT extracted_full_name FROM payload), NULLIF(p.full_name, '')),
    email = COALESCE((SELECT extracted_email FROM payload), p.email),
    crm_score = COALESCE(p.crm_score, 0) + COALESCE((SELECT applied_score_delta FROM estado_crm LIMIT 1), 0),
    stage_points = GREATEST(
      0,
      COALESCE(p.stage_points, 0)
      + CASE
        WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
          THEN COALESCE((SELECT points_delta FROM regra_aplicavel LIMIT 1), 0)
        ELSE 0
      END
    ),
    last_interaction_preview = (SELECT message_text FROM payload),
    crm_unread = false,
    crm_status = CASE
      WHEN COALESCE((SELECT should_move_stage FROM estagio_final LIMIT 1), false)
        THEN COALESCE((SELECT next_status FROM estagio_final LIMIT 1), p.crm_status)
      ELSE p.crm_status
    END,
    crm_funnel_id = CASE
      WHEN COALESCE((SELECT should_move_stage FROM estagio_final LIMIT 1), false)
        THEN COALESCE((SELECT funnel_id FROM estagio_final LIMIT 1), p.crm_funnel_id)
      ELSE p.crm_funnel_id
    END,
    roles = (
      SELECT COALESCE(array_agg(DISTINCT role_value), ARRAY[]::public.person_role[])
      FROM unnest(
        COALESCE(p.roles, ARRAY[]::public.person_role[])
        || CASE WHEN (SELECT extracted_intent FROM payload) = 'buy' THEN ARRAY['buyer'::public.person_role] ELSE ARRAY[]::public.person_role[] END
        || CASE WHEN (SELECT extracted_intent FROM payload) = 'sell' THEN ARRAY['seller'::public.person_role] ELSE ARRAY[]::public.person_role[] END
        || CASE
          WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
            THEN COALESCE((SELECT add_roles FROM regra_aplicavel LIMIT 1), ARRAY[]::public.person_role[])
          ELSE ARRAY[]::public.person_role[]
        END
      ) AS role_value
      WHERE role_value <> ALL(
        CASE
          WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
            THEN COALESCE((SELECT remove_roles FROM regra_aplicavel LIMIT 1), ARRAY[]::public.person_role[])
          ELSE ARRAY[]::public.person_role[]
        END
      )
    ),
    tags = (
      SELECT COALESCE(array_agg(DISTINCT tag_value), ARRAY[]::text[])
      FROM unnest(
        COALESCE(p.tags, ARRAY[]::text[])
        || CASE
          WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
            THEN COALESCE((SELECT add_tags FROM regra_aplicavel LIMIT 1), ARRAY[]::text[])
          ELSE ARRAY[]::text[]
        END
      ) AS tag_value
      WHERE tag_value IS NOT NULL
        AND BTRIM(tag_value) <> ''
        AND tag_value <> ALL(
          CASE
            WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
              THEN COALESCE((SELECT remove_tags FROM regra_aplicavel LIMIT 1), ARRAY[]::text[])
            ELSE ARRAY[]::text[]
          END
        )
    ),
    metadata = jsonb_set(
      COALESCE(p.metadata, '{}'::jsonb)
        || (SELECT metadata_patch FROM payload)
        || jsonb_build_object(
          'engagement_scoring',
          jsonb_build_object(
            'last_provider_message_id', (SELECT provider_message_id FROM payload),
            'last_applied_delta', COALESCE((SELECT applied_score_delta FROM estado_crm LIMIT 1), 0),
            'last_stage_signal', (SELECT crm_stage_signal FROM payload),
            'last_stage_reason', (SELECT crm_stage_reason FROM payload),
            'last_stage_points_delta', CASE
              WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
                THEN COALESCE((SELECT points_delta FROM regra_aplicavel LIMIT 1), 0)
              ELSE 0
            END,
            'updated_at', (SELECT executed_at FROM payload)
          )
        )
        || CASE
          WHEN COALESCE((SELECT should_move_stage FROM estagio_final LIMIT 1), false)
            THEN jsonb_build_object(
              'people_stage_status', (SELECT next_status FROM estagio_final LIMIT 1),
              'people_stage_funnel_id', (SELECT funnel_id FROM estagio_final LIMIT 1)
            )
          ELSE '{}'::jsonb
        END
        || CASE
          WHEN COALESCE((SELECT should_apply_rule FROM regra_aplicavel LIMIT 1), false)
            THEN jsonb_build_object(
              'people_automation',
              CASE
                WHEN jsonb_typeof(COALESCE(p.metadata, '{}'::jsonb) -> 'people_automation') = 'object'
                  THEN COALESCE(p.metadata, '{}'::jsonb) -> 'people_automation'
                ELSE '{}'::jsonb
              END || jsonb_build_object(
                COALESCE((SELECT next_funnel_id::text FROM regra_aplicavel LIMIT 1), 'default'),
                (SELECT next_status FROM regra_aplicavel LIMIT 1)
              )
            )
          ELSE '{}'::jsonb
        END,
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
