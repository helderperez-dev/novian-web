import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createLead } from "@/lib/chatStore";
import {
  listPersonPropertyLinksByPersonIds,
  replacePersonPropertyLinks,
  type PersonPropertyLinkInput,
  type PersonPropertyLinkSummary,
} from "@/lib/personProperties";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRole = Database["public"]["Enums"]["person_role"];
type Json = Database["public"]["Tables"]["people"]["Row"]["metadata"];
type PersonPropertyRelationshipType = Database["public"]["Tables"]["person_properties"]["Row"]["relationship_type"];

function asJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as { [key: string]: Json | undefined };
  }

  return value as { [key: string]: Json | undefined };
}

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

function normalizeBrokerUserId(value: unknown) {
  const brokerUserId = String(value ?? "").trim();
  return brokerUserId || null;
}

function normalizeRoleList(value: unknown) {
  const roles = Array.isArray(value)
    ? value
        .map((item) => String(item))
        .filter((item): item is PersonRole => ["lead", "client", "buyer", "seller"].includes(item))
    : [];

  return Array.from(new Set(roles)) as PersonRole[];
}

function normalizeTagList(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          String(item)
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
        )
        .filter(Boolean),
    ),
  );
}

function normalizeRelationshipType(value: unknown) {
  if (value === "interested" || value === "owner") {
    return value as PersonPropertyRelationshipType;
  }

  return null;
}

function normalizeLinkedProperties(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PersonPropertyLinkInput[];
  }

  const seen = new Set<string>();
  const links: PersonPropertyLinkInput[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const propertyId = String((item as { propertyId?: unknown }).propertyId ?? "").trim();
    const relationshipType = normalizeRelationshipType((item as { relationshipType?: unknown }).relationshipType);

    if (!propertyId || !relationshipType) {
      continue;
    }

    const dedupeKey = `${propertyId}:${relationshipType}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    links.push({
      propertyId,
      relationshipType,
      source: String((item as { source?: unknown }).source ?? "manual").trim() || "manual",
      notes:
        typeof (item as { notes?: unknown }).notes === "string"
          ? String((item as { notes?: unknown }).notes).trim() || null
          : null,
      metadata: asJsonObject((item as { metadata?: unknown }).metadata),
    });
  }

  return links;
}

function mergeRolesWithLinkedProperties(roles: PersonRole[], linkedProperties: PersonPropertyLinkInput[]) {
  const nextRoles = new Set<PersonRole>(roles);

  if (linkedProperties.some((link) => link.relationshipType === "interested")) {
    nextRoles.add("buyer");
  }

  if (linkedProperties.some((link) => link.relationshipType === "owner")) {
    nextRoles.add("seller");
  }

  return Array.from(nextRoles);
}

type PersonListItem = ReturnType<typeof mapPeopleForResponse>[number];

function buildDuplicateGroups(people: PersonListItem[]) {
  const grouped = new Map<string, { key: string; label: string; reason: "phone" | "email"; people: PersonListItem[] }>();

  for (const person of people) {
    const phone = normalizePhone(person.primaryPhone);
    if (phone) {
      const key = `phone:${phone}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.people.push(person);
      } else {
        grouped.set(key, {
          key,
          label: phone,
          reason: "phone",
          people: [person],
        });
      }
    }

    const email = normalizeEmail(person.email);
    if (email) {
      const key = `email:${email}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.people.push(person);
      } else {
        grouped.set(key, {
          key,
          label: email,
          reason: "email",
          people: [person],
        });
      }
    }
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      people: Array.from(new Map(group.people.map((person) => [person.id, person])).values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    }))
    .filter((group) => group.people.length > 1)
    .sort((a, b) => b.people.length - a.people.length);
}

function mapPeopleForResponse(
  people: Database["public"]["Tables"]["people"]["Row"][],
  linkedPropertiesByPersonId: Map<string, PersonPropertyLinkSummary[]>,
) {
  return people.map((person) => {
    const leadSummary =
      person.crm_status || person.crm_funnel_id || (person.crm_score ?? 0) > 0 || person.crm_unread
        ? {
            id: person.id,
            status: person.crm_status,
            funnelId: person.crm_funnel_id,
            score: person.crm_score,
            preview: person.last_interaction_preview,
            unread: person.crm_unread,
            updatedAt: person.updated_at,
          }
        : null;

    return {
      id: person.id,
      fullName: person.full_name,
      primaryPhone: person.primary_phone,
      email: person.email,
      roles: person.roles || [],
      tags: person.tags || [],
      origin: person.origin || "manual",
      stagePoints: person.stage_points || 0,
      metadata: person.metadata || {},
      lastInteractionPreview: person.last_interaction_preview || "",
      createdAt: person.created_at,
      updatedAt: person.updated_at,
      lead: leadSummary,
      leadCount: leadSummary ? 1 : 0,
      linkedProperties: linkedPropertiesByPersonId.get(person.id) || [],
      brokerUserId: person.broker_user_id,
    };
  });
}

export async function GET() {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: people, error: peopleError } = await supabase
    .from("people")
    .select("*")
    .order("updated_at", { ascending: false });

  if (peopleError) {
    console.error(peopleError);
    return NextResponse.json({ error: "Failed to load people" }, { status: 500 });
  }

  let linkedPropertiesByPersonId = new Map<string, PersonPropertyLinkSummary[]>();
  try {
    linkedPropertiesByPersonId = await listPersonPropertyLinksByPersonIds((people || []).map((person) => person.id));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load linked properties" }, { status: 500 });
  }

  const items = mapPeopleForResponse(people || [], linkedPropertiesByPersonId);
  const tags = Array.from(new Set(items.flatMap((item) => item.tags))).sort();
  const duplicateGroups = buildDuplicateGroups(items);

  return NextResponse.json({
    people: items,
    tags,
    duplicateGroups,
    summary: {
      total: items.length,
      leads: items.filter((item) => item.lead || item.roles.includes("lead")).length,
      clients: items.filter((item) => item.roles.includes("client")).length,
      buyers: items.filter((item) => item.roles.includes("buyer")).length,
      sellers: items.filter((item) => item.roles.includes("seller")).length,
    },
  });
}

export async function POST(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const fullName = String(body.fullName ?? "").trim();
    const primaryPhone = normalizePhone(body.primaryPhone);
    const email = normalizeEmail(body.email);
    const linkedProperties = normalizeLinkedProperties(body.linkedProperties);
    const roles = mergeRolesWithLinkedProperties(normalizeRoleList(body.roles), linkedProperties);
    const tags = normalizeTagList(body.tags);
    const origin = String(body.origin ?? "manual").trim() || "manual";
    const metadata = asJsonObject(body.metadata);
    const brokerUserId = normalizeBrokerUserId(body.brokerUserId);

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: person, error: personError } = await supabase
      .from("people")
      .insert({
        full_name: fullName,
        primary_phone: primaryPhone,
        email,
        roles,
        tags,
        origin,
        broker_user_id: brokerUserId,
        stage_points: Number(body.stagePoints || 0),
        metadata,
        last_interaction_preview: String(body.lastInteractionPreview ?? "").trim() || null,
      })
      .select("*")
      .single();

    if (personError) {
      console.error(personError);
      return NextResponse.json({ error: "Failed to create person" }, { status: 500 });
    }

    let savedLinkedProperties: PersonPropertyLinkSummary[] = [];
    try {
      savedLinkedProperties = await replacePersonPropertyLinks(person.id, linkedProperties);
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to save linked properties" }, { status: 500 });
    }

    if ((Boolean(body.createLead) || roles.includes("lead")) && primaryPhone) {
      await createLead({
        personId: person.id,
        phone: primaryPhone,
        title: fullName,
        funnelId: typeof body.leadFunnelId === "string" ? body.leadFunnelId : undefined,
        status: typeof body.leadStatus === "string" ? body.leadStatus : undefined,
        score: Number(body.leadScore || 0),
        customData: {
          ...metadata,
          email,
          source: origin,
        },
      });
    }

    return NextResponse.json({
      success: true,
      person: {
        ...mapPeopleForResponse([person], new Map([[person.id, savedLinkedProperties]]))[0],
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
