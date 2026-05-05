import type { Database } from "@/lib/database.types";

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
export type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];
export type PersonRow = Database["public"]["Tables"]["people"]["Row"];
export type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
export type PersonRole = Database["public"]["Enums"]["person_role"];
export type DocumentPersonJoin = Pick<PersonRow, "id" | "full_name" | "email" | "primary_phone" | "roles">;
export type DocumentPropertyJoin = Pick<PropertyRow, "id" | "title" | "address" | "status">;

export type DocumentListItem = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  fileUrl: string;
  filePath: string;
  fileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
  personId: string | null;
  propertyId: string | null;
  uploadedBy: string | null;
  entityScope: "person" | "property" | "mixed";
  person: null | {
    id: string;
    fullName: string;
    email: string | null;
    primaryPhone: string | null;
    roles: PersonRole[];
  };
  property: null | {
    id: string;
    title: string;
    address: string;
    status: Database["public"]["Enums"]["property_status"];
  };
};

export const DOCUMENT_STORAGE_BUCKET = "documents";
export const DOCUMENT_SIGNED_URL_TTL_SECONDS = 60 * 60;

export function normalizeDocumentText(value: unknown) {
  return String(value ?? "").trim();
}

export function normalizeDocumentTags(value: unknown) {
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

export function getDocumentFileExtension(fileName: string) {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || null : null;
}

type DocumentStoragePathOptions = {
  fileName: string;
  propertyId?: string | null;
  personId?: string | null;
  uploaderId?: string | null;
};

export function buildDocumentStoragePath(input: string | DocumentStoragePathOptions) {
  const options = typeof input === "string" ? { fileName: input } : input;
  const safeName = options.fileName.replace(/[^a-zA-Z0-9._-]/g, "-");
  const folders = ["files"];

  if (options.propertyId) {
    folders.unshift("properties", options.propertyId);
  }

  if (options.personId) {
    folders.push("people", options.personId);
  }

  if (options.uploaderId) {
    folders.push("users", options.uploaderId);
  }

  return `${folders.join("/")}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeName}`;
}

export function getDocumentStorageBucket(fileUrl?: string | null) {
  if (fileUrl) {
    const match = fileUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\//i);
    if (match?.[1]) {
      return match[1];
    }
  }

  return DOCUMENT_STORAGE_BUCKET;
}

export function toDocumentListItem(
  document: DocumentRow,
  peopleById: Map<string, DocumentPersonJoin>,
  propertiesById: Map<string, DocumentPropertyJoin>,
): DocumentListItem {
  const person = document.person_id ? peopleById.get(document.person_id) || null : null;
  const property = document.property_id ? propertiesById.get(document.property_id) || null : null;

  return {
    id: document.id,
    title: document.title,
    description: document.description,
    category: document.category,
    tags: document.tags || [],
    fileUrl: document.file_url,
    filePath: document.file_path,
    fileName: document.file_name,
    fileExtension: document.file_extension,
    mimeType: document.mime_type,
    fileSizeBytes: document.file_size_bytes,
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    personId: document.person_id,
    propertyId: document.property_id,
    uploadedBy: document.uploaded_by,
    entityScope: document.person_id && document.property_id ? "mixed" : document.property_id ? "property" : "person",
    person: person
      ? {
          id: person.id,
          fullName: person.full_name,
          email: person.email,
          primaryPhone: person.primary_phone,
          roles: person.roles || [],
        }
      : null,
    property: property
      ? {
          id: property.id,
          title: property.title,
          address: property.address,
          status: property.status,
        }
      : null,
  };
}

export function formatDocumentFileSize(value: number | null | undefined) {
  if (!value || value <= 0) {
    return "-";
  }

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}
