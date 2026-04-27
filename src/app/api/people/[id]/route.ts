import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createLead, deleteLead, updateLead } from "@/lib/chatStore";
import {
  listPersonPropertyLinksByPersonIds,
  replacePersonPropertyLinks,
  type PersonPropertyLinkInput,
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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const personId = decodeURIComponent(id);
    const supabase = createAdminSupabaseClient();

    const { data: person, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();

    if (error || !person) {
      console.error(error);
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const linkedProperties = (await listPersonPropertyLinksByPersonIds([person.id])).get(person.id) || [];

    return NextResponse.json({
      person: {
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
        lead:
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
            : null,
        leadCount: person.crm_status || person.crm_funnel_id || (person.crm_score ?? 0) > 0 || person.crm_unread ? 1 : 0,
        linkedProperties,
        brokerUserId: person.broker_user_id,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const personId = decodeURIComponent(id);
    const body = await req.json();
    const supabase = createAdminSupabaseClient();

    const { data: currentPerson, error: currentPersonError } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();

    if (currentPersonError) {
      console.error(currentPersonError);
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const linkedPropertiesProvided = Object.prototype.hasOwnProperty.call(body, "linkedProperties");
    const linkedProperties = linkedPropertiesProvided ? normalizeLinkedProperties(body.linkedProperties) : null;

    const updatePayload: Database["public"]["Tables"]["people"]["Update"] = {};
    if (body.fullName !== undefined) updatePayload.full_name = String(body.fullName ?? "").trim();
    if (body.primaryPhone !== undefined) updatePayload.primary_phone = normalizePhone(body.primaryPhone);
    if (body.email !== undefined) updatePayload.email = normalizeEmail(body.email);
    if (body.brokerUserId !== undefined) updatePayload.broker_user_id = normalizeBrokerUserId(body.brokerUserId);
    if (body.roles !== undefined) updatePayload.roles = normalizeRoleList(body.roles);
    if (body.tags !== undefined) updatePayload.tags = normalizeTagList(body.tags);
    if (body.origin !== undefined) updatePayload.origin = String(body.origin ?? "").trim() || "manual";
    if (body.stagePoints !== undefined) updatePayload.stage_points = Number(body.stagePoints || 0);
    if (body.lastInteractionPreview !== undefined) {
      updatePayload.last_interaction_preview = String(body.lastInteractionPreview ?? "").trim() || null;
    }
    if (body.metadata !== undefined) {
      updatePayload.metadata = {
        ...asJsonObject(currentPerson.metadata),
        ...asJsonObject(body.metadata),
      };
    }
    if (linkedProperties) {
      const baseRoles = updatePayload.roles ?? currentPerson.roles ?? [];
      const nextRoles = mergeRolesWithLinkedProperties(baseRoles, linkedProperties);
      if (body.roles !== undefined || nextRoles.length !== baseRoles.length) {
        updatePayload.roles = nextRoles;
      }
    }

    const hasPersonUpdates = Object.keys(updatePayload).length > 0;
    let person = currentPerson;

    if (hasPersonUpdates) {
      const { data: updatedPerson, error } = await supabase
        .from("people")
        .update(updatePayload)
        .eq("id", personId)
        .select("*")
        .single();

      if (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to update person" }, { status: 500 });
      }

      person = updatedPerson;
    }

    let savedLinkedProperties = (await listPersonPropertyLinksByPersonIds([person.id])).get(person.id) || [];
    if (linkedProperties) {
      savedLinkedProperties = await replacePersonPropertyLinks(person.id, linkedProperties);
    }

    const shouldSyncLeadState =
      Boolean(body.createLead) ||
      body.leadStatus !== undefined ||
      body.leadFunnelId !== undefined ||
      body.leadScore !== undefined;

    if (Boolean(body.createLead) && person.primary_phone) {
      await createLead({
        personId: person.id,
        phone: person.primary_phone,
        title: person.full_name,
        funnelId: typeof body.leadFunnelId === "string" ? body.leadFunnelId : undefined,
        status: typeof body.leadStatus === "string" ? body.leadStatus : undefined,
        score: body.leadScore !== undefined ? Number(body.leadScore || 0) : person.stage_points,
        customData: {
          ...asJsonObject(person.metadata),
          email: person.email,
          source: person.origin,
        },
      });
    } else if (shouldSyncLeadState) {
      await updateLead(person.id, {
        title: person.full_name,
        phone: person.primary_phone || undefined,
        preview: person.last_interaction_preview || undefined,
        customData: {
          ...asJsonObject(person.metadata),
          email: person.email,
          source: person.origin,
        },
        status: typeof body.leadStatus === "string" ? body.leadStatus : undefined,
        funnelId: typeof body.leadFunnelId === "string" ? body.leadFunnelId : undefined,
        score: body.leadScore !== undefined ? Number(body.leadScore || 0) : undefined,
      });
    }

    return NextResponse.json({
      success: true,
      person: {
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
        lead:
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
            : null,
        leadCount: person.crm_status || person.crm_funnel_id || (person.crm_score ?? 0) > 0 || person.crm_unread ? 1 : 0,
        linkedProperties: savedLinkedProperties,
        brokerUserId: person.broker_user_id,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const personId = decodeURIComponent(id);
    await deleteLead(personId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
