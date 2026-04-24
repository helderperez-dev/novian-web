import { NextResponse } from "next/server";
import { requireInternalApiUser } from "@/lib/api-auth";
import {
  getDocumentFileExtension,
  normalizeDocumentTags,
  normalizeDocumentText,
  toDocumentListItem,
  type DocumentUpdate,
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

async function hydrateDocument(documentId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: document, error } = await supabase.from("documents").select("*").eq("id", documentId).single();

  if (error || !document) {
    return { document: null, error: error || new Error("Document not found") };
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
    return {
      document: null,
      error: peopleResult.error || propertiesResult.error || new Error("Failed to hydrate document"),
    };
  }

  return {
    document: toDocumentListItem(
      document,
      new Map(peopleResult.data ? [[peopleResult.data.id, peopleResult.data]] : []),
      new Map(propertiesResult.data ? [[propertiesResult.data.id, propertiesResult.data]] : []),
    ),
    error: null,
  };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const documentId = decodeURIComponent(id);
    const body = await req.json();
    const supabase = createAdminSupabaseClient();

    const { data: currentDocument, error: currentDocumentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (currentDocumentError || !currentDocument) {
      console.error(currentDocumentError);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const nextPersonId = body.personId !== undefined ? asNullableString(body.personId) : currentDocument.person_id;
    const nextPropertyId = body.propertyId !== undefined ? asNullableString(body.propertyId) : currentDocument.property_id;

    if (!nextPersonId && !nextPropertyId) {
      return NextResponse.json({ error: "A document must stay attached to a person or property" }, { status: 400 });
    }

    const payload: DocumentUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) payload.title = normalizeDocumentText(body.title);
    if (body.description !== undefined) payload.description = asNullableString(body.description);
    if (body.category !== undefined) payload.category = asNullableString(body.category);
    if (body.tags !== undefined) payload.tags = normalizeDocumentTags(body.tags);
    if (body.fileUrl !== undefined) payload.file_url = normalizeDocumentText(body.fileUrl);
    if (body.filePath !== undefined) payload.file_path = normalizeDocumentText(body.filePath);
    if (body.fileName !== undefined) payload.file_name = normalizeDocumentText(body.fileName);
    if (body.mimeType !== undefined) payload.mime_type = asNullableString(body.mimeType);
    if (body.fileSizeBytes !== undefined) payload.file_size_bytes = asNullableNumber(body.fileSizeBytes);
    if (body.personId !== undefined) payload.person_id = nextPersonId;
    if (body.propertyId !== undefined) payload.property_id = nextPropertyId;

    const fileName = payload.file_name || currentDocument.file_name;
    payload.file_extension =
      body.fileExtension !== undefined ? asNullableString(body.fileExtension) : getDocumentFileExtension(fileName);

    const { error } = await supabase.from("documents").update(payload).eq("id", documentId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
    }

    const hydrated = await hydrateDocument(documentId);
    if (hydrated.error || !hydrated.document) {
      console.error(hydrated.error);
      return NextResponse.json({ error: "Failed to load updated document" }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: hydrated.document });
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
    const documentId = decodeURIComponent(id);
    const supabase = createAdminSupabaseClient();

    const { data: currentDocument, error: currentDocumentError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (currentDocumentError || !currentDocument) {
      console.error(currentDocumentError);
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { error } = await supabase.from("documents").delete().eq("id", documentId);

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }

    if (currentDocument.file_path) {
      const { error: storageError } = await supabase.storage.from("attachments").remove([currentDocument.file_path]);
      if (storageError) {
        console.error(storageError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
