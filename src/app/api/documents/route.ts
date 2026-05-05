import { NextResponse } from "next/server";
import { requireInternalApiUser } from "@/lib/api-auth";
import {
  DOCUMENT_SIGNED_URL_TTL_SECONDS,
  DOCUMENT_STORAGE_BUCKET,
  getDocumentFileExtension,
  getDocumentStorageBucket,
  normalizeDocumentTags,
  normalizeDocumentText,
  toDocumentListItem,
  type DocumentInsert,
} from "@/lib/documents";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function asNullableString(value: unknown) {
  const nextValue = normalizeDocumentText(value);
  return nextValue || null;
}

function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

async function withAccessibleUrl(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  document: ReturnType<typeof toDocumentListItem>,
) {
  if (!document.filePath) {
    return document;
  }

  const bucket = getDocumentStorageBucket(document.fileUrl) || DOCUMENT_STORAGE_BUCKET;

  if (/\/storage\/v1\/object\/public\//i.test(document.fileUrl) && bucket !== DOCUMENT_STORAGE_BUCKET) {
    return document;
  }

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(document.filePath, DOCUMENT_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error(error);
    return document;
  }

  return {
    ...document,
    fileUrl: data.signedUrl,
  };
}

export async function GET(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabaseClient();
    const { searchParams } = new URL(req.url);
    const personId = searchParams.get("personId");
    const propertyId = searchParams.get("propertyId");
    const scope = searchParams.get("scope");
    const personRole = searchParams.get("personRole");
    const category = normalizeDocumentText(searchParams.get("category"));
    const query = normalizeDocumentText(searchParams.get("q")).toLowerCase();

    let documentsQuery = supabase
      .from("documents")
      .select("*")
      .order("updated_at", { ascending: false });

    if (personId) {
      documentsQuery = documentsQuery.eq("person_id", personId);
    }
    if (propertyId) {
      documentsQuery = documentsQuery.eq("property_id", propertyId);
    }

    const { data: documents, error } = await documentsQuery;

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to load documents" }, { status: 500 });
    }

    const personIds = Array.from(new Set((documents || []).map((item) => item.person_id).filter(Boolean))) as string[];
    const propertyIds = Array.from(new Set((documents || []).map((item) => item.property_id).filter(Boolean))) as string[];

    const [peopleResult, propertiesResult] = await Promise.all([
      personIds.length > 0
        ? supabase
            .from("people")
            .select("id, full_name, email, primary_phone, roles")
            .in("id", personIds)
        : Promise.resolve({ data: [], error: null }),
      propertyIds.length > 0
        ? supabase
            .from("properties")
            .select("id, title, address, status")
            .in("id", propertyIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (peopleResult.error) {
      console.error(peopleResult.error);
      return NextResponse.json({ error: "Failed to load related people" }, { status: 500 });
    }
    if (propertiesResult.error) {
      console.error(propertiesResult.error);
      return NextResponse.json({ error: "Failed to load related properties" }, { status: 500 });
    }

    const peopleById = new Map((peopleResult.data || []).map((person) => [person.id, person]));
    const propertiesById = new Map((propertiesResult.data || []).map((property) => [property.id, property]));

    const filteredDocuments = (documents || [])
      .map((document) => toDocumentListItem(document, peopleById, propertiesById))
      .filter((document) => {
        if (scope === "person" && !document.personId) return false;
        if (scope === "property" && !document.propertyId) return false;
        if (scope === "mixed" && !(document.personId && document.propertyId)) return false;
        if (personRole && !document.person?.roles.includes(personRole as typeof document.person.roles[number])) return false;
        if (category && (document.category || "").toLowerCase() !== category.toLowerCase()) return false;
        if (!query) return true;

        return [
          document.title,
          document.description || "",
          document.category || "",
          document.fileName,
          document.person?.fullName || "",
          document.property?.title || "",
          document.property?.address || "",
          document.tags.join(" "),
        ].some((value) => matchesQuery(value, query));
      });

    const accessibleDocuments = await Promise.all(filteredDocuments.map((document) => withAccessibleUrl(supabase, document)));

    const categories = Array.from(
      new Set(accessibleDocuments.map((document) => document.category).filter((value): value is string => Boolean(value))),
    ).sort((left, right) => left.localeCompare(right));
    const tags = Array.from(new Set(accessibleDocuments.flatMap((document) => document.tags))).sort((left, right) =>
      left.localeCompare(right),
    );

    return NextResponse.json({
      documents: accessibleDocuments,
      categories,
      tags,
      summary: {
        total: accessibleDocuments.length,
        person: accessibleDocuments.filter((document) => Boolean(document.personId)).length,
        property: accessibleDocuments.filter((document) => Boolean(document.propertyId)).length,
        mixed: accessibleDocuments.filter((document) => Boolean(document.personId && document.propertyId)).length,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = normalizeDocumentText(body.title) || normalizeDocumentText(body.fileName);
    const fileUrl = normalizeDocumentText(body.fileUrl);
    const filePath = normalizeDocumentText(body.filePath);
    const fileName = normalizeDocumentText(body.fileName);
    const personId = asNullableString(body.personId);
    const propertyId = asNullableString(body.propertyId);

    if (!title || !fileUrl || !filePath || !fileName) {
      return NextResponse.json({ error: "Missing required document fields" }, { status: 400 });
    }

    if (!personId && !propertyId) {
      return NextResponse.json({ error: "A document must be attached to a person or property" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    const payload: DocumentInsert = {
      title,
      description: asNullableString(body.description),
      category: asNullableString(body.category),
      tags: normalizeDocumentTags(body.tags),
      file_url: fileUrl,
      file_path: filePath,
      file_name: fileName,
      file_extension: asNullableString(body.fileExtension) || getDocumentFileExtension(fileName),
      mime_type: asNullableString(body.mimeType),
      file_size_bytes: asNullableNumber(body.fileSizeBytes),
      person_id: personId,
      property_id: propertyId,
      uploaded_by: appUser.id,
      updated_at: new Date().toISOString(),
    };

    const { data: document, error } = await supabase.from("documents").insert(payload).select("*").single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to create document" }, { status: 500 });
    }

    const [peopleResult, propertiesResult] = await Promise.all([
      document.person_id
        ? supabase.from("people").select("id, full_name, email, primary_phone, roles").eq("id", document.person_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      document.property_id
        ? supabase.from("properties").select("id, title, address, status").eq("id", document.property_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (peopleResult.error || propertiesResult.error) {
      console.error(peopleResult.error || propertiesResult.error);
    }

    const item = toDocumentListItem(
      document,
      new Map(peopleResult.data ? [[peopleResult.data.id, peopleResult.data]] : []),
      new Map(propertiesResult.data ? [[propertiesResult.data.id, propertiesResult.data]] : []),
    );

    const accessibleItem = await withAccessibleUrl(supabase, item);

    return NextResponse.json({ success: true, document: accessibleItem });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
