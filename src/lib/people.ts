import type { Database, Json } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type PersonInsert = Database["public"]["Tables"]["people"]["Insert"];
type PersonUpdate = Database["public"]["Tables"]["people"]["Update"];
type PersonRole = Database["public"]["Enums"]["person_role"];
type JsonObject = { [key: string]: Json | undefined };

type LeadLikeCustomData = Record<string, unknown> | null | undefined;

const DEFAULT_PERSON_ROLE: PersonRole = "lead";
const AUTOMATION_METADATA_KEY = "people_automation";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: unknown) {
  const email = normalizeText(value).toLowerCase();
  return email || null;
}

function normalizeName(value: unknown, fallbackPhone?: string | null) {
  const name = normalizeText(value);
  if (!name || name.toLowerCase() === "lead") {
    return fallbackPhone ? `Contato ${fallbackPhone}` : "Contato sem nome";
  }

  return name;
}

function slugifyTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeRoleList(value: unknown, fallback: PersonRole[] = [DEFAULT_PERSON_ROLE]) {
  const roles = Array.isArray(value)
    ? value
        .map((item) => String(item))
        .filter((item): item is PersonRole => ["lead", "client", "buyer", "seller"].includes(item))
    : [];

  return roles.length > 0 ? Array.from(new Set(roles)) : fallback;
}

function sanitizeTagList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(new Set(value.map((item) => slugifyTag(String(item))).filter(Boolean)));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function toObject(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as JsonObject;
  }

  return value as JsonObject;
}

function toMetadataObject(value: LeadLikeCustomData) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as JsonObject;
  }

  return value as JsonObject;
}

function extractLeadSource(customData: LeadLikeCustomData) {
  const data = toMetadataObject(customData);
  return normalizeText(data.source || data.origin || "manual") || "manual";
}

async function findPersonByContact(phone: string | null, email: string | null) {
  const supabase = createAdminSupabaseClient();

  if (phone) {
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("primary_phone", phone)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  if (email) {
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .ilike("email", email)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data;
    }
  }

  return null;
}

async function findAutomationRule(funnelId: string | null | undefined, status: string | null | undefined) {
  if (!funnelId || !status?.trim()) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("funnel_stage_people_rules")
    .select("*")
    .eq("funnel_id", funnelId)
    .eq("stage_title", status.trim())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function getPersonMetadata(person: Pick<PersonRow, "metadata"> | null | undefined) {
  return toObject(person?.metadata);
}

export function isOpportunityStatus(status: string | null | undefined) {
  return (status || "").trim().toLowerCase() === "oportunidades (web)";
}

export function getPersonCrm(person: PersonRow | null | undefined) {
  if (!person) {
    return null;
  }

  return {
    status: person.crm_status,
    funnelId: person.crm_funnel_id,
    score: person.crm_score ?? 0,
    unread: person.crm_unread ?? false,
    preview: person.last_interaction_preview,
  };
}

export function isChatEligiblePerson(person: PersonRow | null | undefined) {
  if (!person) {
    return false;
  }

  if (isOpportunityStatus(person.crm_status)) {
    return false;
  }

  const metadata = getPersonMetadata(person);
  const source = typeof metadata.source === "string" ? metadata.source : null;
  const whatsappJid = typeof metadata.whatsapp_jid === "string" ? metadata.whatsapp_jid : null;

  return source === "WhatsApp" || Boolean(whatsappJid);
}

export async function getPersonByPhone(phoneOrThreadId: string | null | undefined) {
  const phone = String(phoneOrThreadId || "").split("@")[0].replace(/\D/g, "");
  if (!phone) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("primary_phone", phone)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensurePersonForLead(input: {
  personId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  funnelId?: string | null;
  score?: number | null;
  unread?: boolean | null;
  preview?: string | null;
  customData?: LeadLikeCustomData;
}) {
  const supabase = createAdminSupabaseClient();

  if (input.personId) {
    const { data, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", input.personId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return updatePersonLeadState(data.id, {
        title: input.name,
        phone: input.phone,
        email: input.email,
        status: input.status,
        funnelId: input.funnelId,
        score: input.score,
        unread: input.unread,
        preview: input.preview,
        customData: input.customData,
      });
    }
  }

  const phone = normalizePhone(input.phone);
  const metadata = toMetadataObject(input.customData);
  const email = normalizeEmail(input.email ?? metadata.email);
  const existing = await findPersonByContact(phone, email);
  const source = extractLeadSource(input.customData);
  const fullName = normalizeName(input.name, phone);

  if (existing) {
    return updatePersonLeadState(existing.id, {
      title: fullName,
      phone,
      email,
      status: input.status,
      funnelId: input.funnelId,
      score: input.score,
      unread: input.unread,
      preview: input.preview,
      customData: input.customData,
      origin: existing.origin || source,
    });
  }

  const insertPayload: PersonInsert = {
    full_name: fullName,
    primary_phone: phone,
    email,
    roles: [DEFAULT_PERSON_ROLE],
    tags: [],
    origin: source,
    stage_points: Math.max(0, Number(input.score || 0)),
    crm_status: input.status ?? null,
    crm_funnel_id: input.funnelId ?? null,
    crm_score: Math.max(0, Number(input.score || 0)),
    crm_unread: Boolean(input.unread),
    last_interaction_preview: input.preview ?? null,
    metadata,
  };

  const { data, error } = await supabase
    .from("people")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await applyPeopleAutomationForPerson(data);
  return data;
}

export async function updatePersonLeadState(
  personId: string,
  input: {
    title?: string | null;
    phone?: string | null;
    email?: string | null;
    origin?: string | null;
    status?: string | null;
    funnelId?: string | null;
    score?: number | null;
    unread?: boolean | null;
    preview?: string | null;
    customData?: LeadLikeCustomData;
    metadata?: LeadLikeCustomData;
  },
) {
  const supabase = createAdminSupabaseClient();
  const { data: currentPerson, error: currentPersonError } = await supabase
    .from("people")
    .select("*")
    .eq("id", personId)
    .single();

  if (currentPersonError) {
    throw currentPersonError;
  }

  const incomingMetadata = toMetadataObject(input.customData ?? input.metadata);
  const currentMetadata = toObject(currentPerson.metadata);
  const nextRoles = uniqueStrings([...sanitizeRoleList(currentPerson.roles), DEFAULT_PERSON_ROLE]) as PersonRole[];
  const nextScore =
    input.score === undefined || input.score === null
      ? currentPerson.crm_score ?? 0
      : Math.max(0, Number(input.score || 0));

  const updatePayload: PersonUpdate = {
    full_name:
      input.title !== undefined
        ? normalizeName(input.title, input.phone ?? currentPerson.primary_phone)
        : currentPerson.full_name,
    primary_phone: input.phone !== undefined ? normalizePhone(input.phone) : currentPerson.primary_phone,
    email: input.email !== undefined ? normalizeEmail(input.email) : currentPerson.email,
    origin: input.origin !== undefined ? normalizeText(input.origin) || "manual" : currentPerson.origin,
    roles: nextRoles,
    last_interaction_preview: input.preview !== undefined ? input.preview : currentPerson.last_interaction_preview,
    crm_status: input.status !== undefined ? input.status : currentPerson.crm_status,
    crm_funnel_id: input.funnelId !== undefined ? input.funnelId : currentPerson.crm_funnel_id,
    crm_score: nextScore,
    crm_unread:
      input.unread !== undefined && input.unread !== null ? Boolean(input.unread) : currentPerson.crm_unread,
    stage_points: Math.max(currentPerson.stage_points || 0, nextScore),
    metadata: {
      ...currentMetadata,
      ...incomingMetadata,
    },
  };

  const { data, error } = await supabase
    .from("people")
    .update(updatePayload)
    .eq("id", personId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await applyPeopleAutomationForPerson(data);
  return data;
}

export async function applyPeopleAutomationForPerson(person: PersonRow) {
  const supabase = createAdminSupabaseClient();
  const rule = await findAutomationRule(person.crm_funnel_id, person.crm_status);
  const metadata = toObject(person.metadata);
  const automationMetadata = toObject(metadata[AUTOMATION_METADATA_KEY] as Json | undefined);
  const funnelKey = person.crm_funnel_id || "default";
  const lastAppliedStage =
    typeof automationMetadata[funnelKey] === "string" ? String(automationMetadata[funnelKey]) : null;

  if (!rule || lastAppliedStage === person.crm_status) {
    return person;
  }

  const nextRoles = sanitizeRoleList(
    uniqueStrings(person.roles.filter((role) => !rule.remove_roles.includes(role)).concat(rule.add_roles)),
    person.roles,
  );
  const removableTags = sanitizeTagList(rule.remove_tags);
  const nextTags = uniqueStrings([...sanitizeTagList(person.tags), ...sanitizeTagList(rule.add_tags)]).filter(
    (tag) => !removableTags.includes(tag),
  );
  const nextMetadata: JsonObject = {
    ...metadata,
    people_stage_status: person.crm_status,
    people_stage_funnel_id: person.crm_funnel_id,
    [AUTOMATION_METADATA_KEY]: {
      ...automationMetadata,
      [funnelKey]: person.crm_status,
    },
  };

  const { data, error } = await supabase
    .from("people")
    .update({
      roles: nextRoles,
      tags: nextTags,
      stage_points: Math.max(0, Number(person.stage_points || 0) + Number(rule.points_delta || 0)),
      metadata: nextMetadata,
    })
    .eq("id", person.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteLeadPerson(personId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("people").delete().eq("id", personId);
  if (error) {
    throw error;
  }
}
