import { NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { requireInternalApiUser } from "@/lib/api-auth";
import { createLead } from "@/lib/chatStore";
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

function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits || null;
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
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

type LeadSummary = {
  id: string;
  person_id: string | null;
  status: string | null;
  funnel_id: string | null;
  score: number | null;
  preview: string | null;
  unread: boolean | null;
  updated_at: string;
  created_at: string;
};

type PersonListItem = ReturnType<typeof mergePeopleWithLeads>[number];

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

function mergePeopleWithLeads(
  people: Database["public"]["Tables"]["people"]["Row"][],
  leads: LeadSummary[],
) {
  const leadsByPerson = new Map<string, LeadSummary[]>();

  for (const lead of leads) {
    if (!lead.person_id) continue;
    const items = leadsByPerson.get(lead.person_id) || [];
    items.push(lead);
    leadsByPerson.set(lead.person_id, items);
  }

  return people.map((person) => {
    const linkedLeads = (leadsByPerson.get(person.id) || []).sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    const primaryLead = linkedLeads[0] || null;

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
      lastInteractionPreview: person.last_interaction_preview || primaryLead?.preview || "",
      createdAt: person.created_at,
      updatedAt: person.updated_at,
      lead: primaryLead
        ? {
            id: primaryLead.id,
            status: primaryLead.status,
            funnelId: primaryLead.funnel_id,
            score: primaryLead.score,
            preview: primaryLead.preview,
            unread: primaryLead.unread,
            updatedAt: primaryLead.updated_at,
          }
        : null,
      leadCount: linkedLeads.length,
    };
  });
}

export async function GET() {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const [{ data: people, error: peopleError }, { data: leads, error: leadsError }] = await Promise.all([
    supabase.from("people").select("*").order("updated_at", { ascending: false }),
    supabase
      .from("leads")
      .select("id, person_id, status, funnel_id, score, preview, unread, updated_at, created_at")
      .not("person_id", "is", null)
      .order("updated_at", { ascending: false }),
  ]);

  if (peopleError || leadsError) {
    console.error(peopleError || leadsError);
    return NextResponse.json({ error: "Failed to load people" }, { status: 500 });
  }

  const items = mergePeopleWithLeads(people || [], (leads || []) as LeadSummary[]);
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
    const roles = normalizeRoleList(body.roles);
    const tags = normalizeTagList(body.tags);
    const origin = String(body.origin ?? "manual").trim() || "manual";
    const metadata = asJsonObject(body.metadata);

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

    return NextResponse.json({ success: true, person });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
