import type { Database } from "@/lib/database.types";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type LeadRow = Database["public"]["Tables"]["leads"]["Row"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type LeadUpdate = Database["public"]["Tables"]["leads"]["Update"];
type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type PersonRole = Database["public"]["Enums"]["person_role"];
type Json = Database["public"]["Tables"]["people"]["Row"]["metadata"];
type JsonObject = { [key: string]: Json | undefined };

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

  return Array.from(
    new Set(
      value
        .map((item) => slugifyTag(String(item)))
        .filter(Boolean),
    ),
  );
}

function toObject(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as JsonObject;
  }

  return value as JsonObject;
}

function extractLeadSource(customData: LeadRow["custom_data"] | LeadInsert["custom_data"] | LeadUpdate["custom_data"]) {
  const data = toObject(customData);
  return normalizeText(data.source || data.origin || "manual") || "manual";
}

function extractLeadMetadata(customData: LeadRow["custom_data"] | LeadInsert["custom_data"] | LeadUpdate["custom_data"]) {
  return toObject(customData);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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

export async function ensurePersonForLead(input: {
  leadId?: string;
  personId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: string | null;
  funnelId?: string | null;
  score?: number | null;
  preview?: string | null;
  customData?: LeadRow["custom_data"] | LeadInsert["custom_data"] | LeadUpdate["custom_data"];
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
      return data;
    }
  }

  const phone = normalizePhone(input.phone);
  const metadata = extractLeadMetadata(input.customData);
  const email = normalizeEmail(input.email ?? metadata.email);
  const existing = await findPersonByContact(phone, email);
  const source = extractLeadSource(input.customData);
  const fullName = normalizeName(input.name, phone);

  const baseMetadata: JsonObject = {
    ...metadata,
    lead_id: input.leadId ?? metadata.lead_id,
    lead_status: input.status ?? metadata.lead_status ?? null,
    lead_funnel_id: input.funnelId ?? metadata.lead_funnel_id ?? null,
  };

  if (existing) {
    const nextRoles = uniqueStrings(
      sanitizeRoleList(existing.roles).concat(DEFAULT_PERSON_ROLE),
    ) as PersonRole[];

    const { data, error } = await supabase
      .from("people")
      .update({
        full_name: fullName || existing.full_name,
        primary_phone: phone || existing.primary_phone,
        email: email || existing.email,
        origin: existing.origin || source,
        last_interaction_preview: input.preview ?? existing.last_interaction_preview,
        stage_points: Math.max(existing.stage_points, input.score ?? 0),
        metadata: {
          ...toObject(existing.metadata),
          ...baseMetadata,
        },
        roles: nextRoles,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabase
    .from("people")
    .insert({
      full_name: fullName,
      primary_phone: phone,
      email,
      roles: [DEFAULT_PERSON_ROLE],
      tags: [],
      origin: source,
      stage_points: input.score ?? 0,
      last_interaction_preview: input.preview ?? null,
      metadata: baseMetadata,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function syncPersonFromLead(lead: LeadRow) {
  const supabase = createAdminSupabaseClient();
  const metadata = extractLeadMetadata(lead.custom_data);
  const email = normalizeEmail(metadata.email);
  const person = await ensurePersonForLead({
    leadId: lead.id,
    personId: lead.person_id,
    name: lead.name,
    phone: lead.phone,
    email,
    status: lead.status,
    funnelId: lead.funnel_id,
    score: lead.score,
    preview: lead.preview,
    customData: lead.custom_data,
  });

  if (lead.person_id !== person.id) {
    const { error } = await supabase
      .from("leads")
      .update({ person_id: person.id })
      .eq("id", lead.id);

    if (error) {
      throw error;
    }
  }

  await applyPeopleAutomationForLead({
    lead,
    person,
  });

  return person;
}

export async function applyPeopleAutomationForLead({
  lead,
  person,
}: {
  lead: LeadRow;
  person?: PersonRow | null;
}) {
  const supabase = createAdminSupabaseClient();
  const targetPerson = person ?? (lead.person_id
    ? await supabase.from("people").select("*").eq("id", lead.person_id).maybeSingle().then(({ data, error }) => {
        if (error) throw error;
        return data;
      })
    : null);

  if (!targetPerson) {
    return null;
  }

  const rule = await findAutomationRule(lead.funnel_id, lead.status);
  const metadata = toObject(targetPerson.metadata);
  const automationMetadata = toObject(metadata[AUTOMATION_METADATA_KEY] as Json | undefined);
  const lastAppliedStage = typeof automationMetadata[lead.funnel_id || ""] === "string"
    ? String(automationMetadata[lead.funnel_id || ""])
    : null;

  if (!rule || lastAppliedStage === lead.status) {
    return targetPerson;
  }

  const nextRoles = sanitizeRoleList(
    uniqueStrings(
      targetPerson.roles
        .filter((role) => !rule.remove_roles.includes(role))
        .concat(rule.add_roles),
    ),
    targetPerson.roles,
  );

  const nextTags = uniqueStrings([
    ...sanitizeTagList(targetPerson.tags),
    ...sanitizeTagList(rule.add_tags),
  ]).filter((tag) => !sanitizeTagList(rule.remove_tags).includes(tag));

  const nextMetadata: JsonObject = {
    ...metadata,
    people_stage_status: lead.status,
    people_stage_funnel_id: lead.funnel_id,
    [AUTOMATION_METADATA_KEY]: {
      ...automationMetadata,
      [lead.funnel_id || "default"]: lead.status,
    },
  };

  const { data, error } = await supabase
    .from("people")
    .update({
      roles: nextRoles,
      tags: nextTags,
      stage_points: Math.max(0, Number(targetPerson.stage_points || 0) + Number(rule.points_delta || 0)),
      last_interaction_preview: lead.preview,
      metadata: nextMetadata,
    })
    .eq("id", targetPerson.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function unlinkPersonFromLead(lead: Pick<LeadRow, "id" | "person_id">) {
  if (!lead.person_id) {
    return;
  }

  const supabase = createAdminSupabaseClient();
  const { data: otherLeads, error } = await supabase
    .from("leads")
    .select("id")
    .eq("person_id", lead.person_id)
    .neq("id", lead.id)
    .limit(1);

  if (error) {
    throw error;
  }

  if ((otherLeads || []).length === 0) {
    const { error: deleteError } = await supabase
      .from("people")
      .delete()
      .eq("id", lead.person_id);

    if (deleteError) {
      throw deleteError;
    }
  }
}
