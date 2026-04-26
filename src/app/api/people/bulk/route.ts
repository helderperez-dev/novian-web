import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createLead, updateLead } from "@/lib/chatStore";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRole = Database["public"]["Enums"]["person_role"];

function normalizeRole(value: unknown) {
  const role = String(value ?? "");
  return ["lead", "client", "buyer", "seller"].includes(role) ? (role as PersonRole) : null;
}

function normalizeTag(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

async function syncStageForPeople(personIds: string[], leadStatus: string, leadFunnelId?: string) {
  const supabase = createAdminSupabaseClient();
  const { data: people, error } = await supabase
    .from("people")
    .select("*")
    .in("id", personIds);

  if (error) {
    throw error;
  }

  for (const person of people || []) {
    if (person.primary_phone) {
      await createLead({
        personId: person.id,
        phone: person.primary_phone,
        title: person.full_name,
        status: leadStatus,
        funnelId: leadFunnelId,
        score: person.crm_score ?? person.stage_points,
        customData: {
          ...(person.metadata && typeof person.metadata === "object" && !Array.isArray(person.metadata)
            ? person.metadata
            : {}),
          email: person.email,
          source: person.origin,
        },
      });
      continue;
    }

    await updateLead(person.id, {
      status: leadStatus,
      funnelId: leadFunnelId,
    });
  }
}

export async function POST(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const personIds: string[] = Array.isArray(body.personIds)
      ? Array.from(new Set(body.personIds.map((item: unknown) => String(item)).filter(Boolean)))
      : [];
    const action = String(body.action ?? "").trim();

    if (personIds.length === 0 || !action) {
      return NextResponse.json({ error: "Missing bulk action payload" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const { data: people, error } = await supabase
      .from("people")
      .select("*")
      .in("id", personIds);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to load selected people" }, { status: 500 });
    }

    const records = people || [];
    if (records.length === 0) {
      return NextResponse.json({ error: "No people found" }, { status: 404 });
    }

    if (action === "set_lead_stage") {
      const leadStatus = String(body.leadStatus ?? "").trim();
      const leadFunnelId = typeof body.leadFunnelId === "string" ? body.leadFunnelId : undefined;
      if (!leadStatus) {
        return NextResponse.json({ error: "Missing leadStatus for bulk stage update" }, { status: 400 });
      }

      await syncStageForPeople(personIds, leadStatus, leadFunnelId);
      return NextResponse.json({ success: true, affected: personIds.length });
    }

    const updatesById = new Map<string, Database["public"]["Tables"]["people"]["Update"]>();

    for (const person of records) {
      const next: Database["public"]["Tables"]["people"]["Update"] = {};

      if (action === "add_tag") {
        const tag = normalizeTag(body.tag);
        if (!tag) continue;
        next.tags = uniqueStrings([...(person.tags || []), tag]);
      }

      if (action === "remove_tag") {
        const tag = normalizeTag(body.tag);
        if (!tag) continue;
        next.tags = (person.tags || []).filter((item) => item !== tag);
      }

      if (action === "add_role") {
        const role = normalizeRole(body.role);
        if (!role) continue;
        next.roles = uniqueStrings([...(person.roles || []), role]) as PersonRole[];
      }

      if (action === "remove_role") {
        const role = normalizeRole(body.role);
        if (!role) continue;
        next.roles = (person.roles || []).filter((item) => item !== role);
      }

      if (action === "set_origin") {
        next.origin = String(body.origin ?? "").trim() || "manual";
      }

      if (action === "adjust_points") {
        const delta = Number(body.pointsDelta || 0);
        next.stage_points = Math.max(0, Number(person.stage_points || 0) + delta);
      }

      if (Object.keys(next).length > 0) {
        updatesById.set(person.id, next);
      }
    }

    for (const [personId, update] of updatesById) {
      const { error: updateError } = await supabase
        .from("people")
        .update(update)
        .eq("id", personId);

      if (updateError) {
        console.error(updateError);
        return NextResponse.json({ error: "Failed to apply bulk update" }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      affected: updatesById.size,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
