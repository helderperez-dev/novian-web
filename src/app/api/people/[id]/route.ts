import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createLead, deleteLead, updateLead } from "@/lib/chatStore";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRole = Database["public"]["Enums"]["person_role"];
type Json = Database["public"]["Tables"]["people"]["Row"]["metadata"];

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

    const updatePayload: Database["public"]["Tables"]["people"]["Update"] = {};
    if (body.fullName !== undefined) updatePayload.full_name = String(body.fullName ?? "").trim();
    if (body.primaryPhone !== undefined) updatePayload.primary_phone = normalizePhone(body.primaryPhone);
    if (body.email !== undefined) updatePayload.email = normalizeEmail(body.email);
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

    return NextResponse.json({ success: true, person });
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
