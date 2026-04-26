import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRow = Database["public"]["Tables"]["people"]["Row"];
type PersonRole = Database["public"]["Enums"]["person_role"];
type Json = Database["public"]["Tables"]["people"]["Row"]["metadata"];
type JsonObject = { [key: string]: Json | undefined };

function asJsonObject(value: Json | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as JsonObject;
  }

  return value as JsonObject;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mergeRoles(...valueSets: Array<PersonRole[] | null | undefined>) {
  return uniqueStrings(valueSets.flatMap((value) => value || [])) as PersonRole[];
}

function mergeTags(...valueSets: Array<string[] | null | undefined>) {
  return uniqueStrings(valueSets.flatMap((value) => value || []));
}

function pickFullName(primary: PersonRow, duplicates: PersonRow[]) {
  const all = [primary, ...duplicates]
    .map((person) => person.full_name?.trim() || "")
    .filter(Boolean);

  return all.sort((a, b) => b.length - a.length)[0] || primary.full_name;
}

function pickMostRecentPreview(primary: PersonRow, duplicates: PersonRow[]) {
  const ordered = [primary, ...duplicates].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  return ordered.find((person) => person.last_interaction_preview)?.last_interaction_preview || null;
}

export async function POST(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const primaryPersonId = String(body.primaryPersonId ?? "").trim();
    const duplicatePersonIds = Array.isArray(body.duplicatePersonIds)
      ? body.duplicatePersonIds.map((item: unknown) => String(item)).filter(Boolean)
      : [];

    if (!primaryPersonId || duplicatePersonIds.length === 0) {
      return NextResponse.json({ error: "Missing merge participants" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const targetIds = Array.from(new Set([primaryPersonId, ...duplicatePersonIds]));
    const { data: people, error: peopleError } = await supabase
      .from("people")
      .select("*")
      .in("id", targetIds);

    if (peopleError) {
      console.error(peopleError);
      return NextResponse.json({ error: "Failed to load people for merge" }, { status: 500 });
    }

    const primary = (people || []).find((person) => person.id === primaryPersonId);
    const duplicates = (people || []).filter((person) => person.id !== primaryPersonId);

    if (!primary || duplicates.length === 0) {
      return NextResponse.json({ error: "People to merge were not found" }, { status: 404 });
    }

    const mergedMetadata = duplicates.reduce(
      (acc, person) => ({ ...acc, ...asJsonObject(person.metadata) }),
      asJsonObject(primary.metadata),
    );

    const { data: updatedPrimary, error: updateError } = await supabase
      .from("people")
      .update({
        full_name: pickFullName(primary, duplicates),
        primary_phone: primary.primary_phone || duplicates.find((person) => person.primary_phone)?.primary_phone || null,
        email: primary.email || duplicates.find((person) => person.email)?.email || null,
        origin: primary.origin || duplicates.find((person) => person.origin)?.origin || "manual",
        roles: mergeRoles(primary.roles, ...duplicates.map((person) => person.roles)),
        tags: mergeTags(primary.tags, ...duplicates.map((person) => person.tags)),
        stage_points: Math.max(primary.stage_points || 0, ...duplicates.map((person) => person.stage_points || 0)),
        metadata: mergedMetadata,
        last_interaction_preview: pickMostRecentPreview(primary, duplicates),
      })
      .eq("id", primary.id)
      .select("*")
      .single();

    if (updateError) {
      console.error(updateError);
      return NextResponse.json({ error: "Failed to update the primary person" }, { status: 500 });
    }

    const duplicateIds = duplicates.map((person) => person.id);

    const [
      { error: threadError },
      { error: messageError },
      { error: documentError },
    ] = await Promise.all([
      supabase.from("chat_threads").update({ person_id: primary.id }).in("person_id", duplicateIds),
      supabase.from("messages").update({ person_id: primary.id }).in("person_id", duplicateIds),
      supabase.from("documents").update({ person_id: primary.id }).in("person_id", duplicateIds),
    ]);

    if (threadError || messageError || documentError) {
      console.error(threadError || messageError || documentError);
      return NextResponse.json({ error: "Failed to relink person dependencies" }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from("people")
      .delete()
      .in("id", duplicateIds);

    if (deleteError) {
      console.error(deleteError);
      return NextResponse.json({ error: "Failed to delete merged duplicates" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      person: updatedPrimary,
      mergedCount: duplicateIds.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
