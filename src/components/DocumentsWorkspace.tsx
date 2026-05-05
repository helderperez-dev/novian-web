"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  Home,
  MoreHorizontal,
  Search,
  Tag,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  DOCUMENT_STORAGE_BUCKET,
  buildDocumentStoragePath,
  formatDocumentFileSize,
  type DocumentListItem,
} from "@/lib/documents";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type LookupPerson = {
  id: string;
  fullName: string;
  roles: string[];
};

type LookupProperty = {
  id: string;
  title: string;
  address: string;
};

type DocumentsWorkspaceProps = {
  personId?: string | null;
  propertyId?: string | null;
  title?: string;
  description?: string;
  embedded?: boolean;
};

const PERSON_ROLE_OPTIONS = [
  { value: "all", label: "Todos os papeis" },
  { value: "lead", label: "Lead" },
  { value: "client", label: "Cliente" },
  { value: "buyer", label: "Comprador" },
  { value: "seller", label: "Proprietario" },
];

const SCOPE_OPTIONS = [
  { value: "all", label: "Tudo" },
  { value: "person", label: "Pessoas" },
  { value: "property", label: "Imoveis" },
  { value: "mixed", label: "Vinculados aos dois" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getScopeLabel(document: DocumentListItem) {
  if (document.personId && document.propertyId) return "Pessoa + Imovel";
  if (document.personId) return "Pessoa";
  return "Imovel";
}

export default function DocumentsWorkspace({
  personId,
  propertyId,
  title = "Central de documentos",
  description = "Visualize, filtre e anexe arquivos aos contatos e aos imóveis em um único lugar.",
  embedded = false,
}: DocumentsWorkspaceProps) {
  const [embeddedSection, setEmbeddedSection] = useState<"list" | "upload">("list");
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [people, setPeople] = useState<LookupPerson[]>([]);
  const [properties, setProperties] = useState<LookupProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openDocumentMenuId, setOpenDocumentMenuId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(personId || "");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId || "");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isScopedToPerson = Boolean(personId);
  const isScopedToProperty = Boolean(propertyId);

  useEffect(() => {
    setSelectedPersonId(personId || "");
  }, [personId]);

  useEffect(() => {
    setSelectedPropertyId(propertyId || "");
  }, [propertyId]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("[data-document-menu-root='true']")) return;
      setOpenDocumentMenuId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (personId) params.set("personId", personId);
      if (propertyId) params.set("propertyId", propertyId);
      if (!personId && !propertyId && scopeFilter !== "all") params.set("scope", scopeFilter);
      if (!personId && roleFilter !== "all") params.set("personRole", roleFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());

      const response = await fetch(`/api/documents?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Nao foi possivel carregar os documentos.");
      }

      const data = await response.json();
      const items = Array.isArray(data.documents) ? data.documents : [];
      setDocuments(tagFilter === "all" ? items : items.filter((item: DocumentListItem) => item.tags.includes(tagFilter)));
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setTags(Array.isArray(data.tags) ? data.tags : []);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel carregar os documentos.");
    } finally {
      setLoading(false);
    }
  }, [personId, propertyId, scopeFilter, roleFilter, categoryFilter, searchQuery, tagFilter]);

  const loadLookups = useCallback(async () => {
    try {
      const tasks: Promise<void>[] = [];

      if (!isScopedToPerson) {
        tasks.push(
          fetch("/api/people", { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) throw new Error("Falha ao carregar pessoas.");
              const data = await response.json();
              setPeople(
                Array.isArray(data.people)
                  ? data.people.map((item: { id: string; fullName: string; roles: string[] }) => ({
                      id: item.id,
                      fullName: item.fullName,
                      roles: item.roles || [],
                    }))
                  : [],
              );
            }),
        );
      }

      if (!isScopedToProperty) {
        tasks.push(
          fetch("/api/properties", { cache: "no-store" })
            .then(async (response) => {
              if (!response.ok) throw new Error("Falha ao carregar imoveis.");
              const data = await response.json();
              setProperties(
                Array.isArray(data.properties)
                  ? data.properties.map((item: { id: string; title: string; address: string }) => ({
                      id: item.id,
                      title: item.title,
                      address: item.address,
                    }))
                  : [],
              );
            }),
        );
      }

      await Promise.all(tasks);
    } catch (error) {
      console.error(error);
    }
  }, [isScopedToPerson, isScopedToProperty]);

  useEffect(() => {
    loadLookups().catch(console.error);
  }, [loadLookups]);

  useEffect(() => {
    loadDocuments().catch(console.error);
  }, [loadDocuments]);

  const stats = useMemo(
    () => ({
      total: documents.length,
      people: documents.filter((item) => item.personId).length,
      properties: documents.filter((item) => item.propertyId).length,
      recent: documents[0]?.updatedAt || null,
    }),
    [documents],
  );

  const resetUploadForm = () => {
    setSelectedFile(null);
    setIsDraggingFile(false);
    setFormTitle("");
    setFormDescription("");
    setFormCategory("");
    setFormTags("");
    if (!personId) setSelectedPersonId("");
    if (!propertyId) setSelectedPropertyId("");
  };

  const uploadDocument = async () => {
    if (!selectedFile) {
      alert("Selecione um arquivo para continuar.");
      return;
    }

    const nextPersonId = personId || selectedPersonId || null;
    const nextPropertyId = propertyId || selectedPropertyId || null;
    if (!nextPersonId && !nextPropertyId) {
      alert("Selecione uma pessoa ou um imovel para vincular o documento.");
      return;
    }

    setUploading(true);
    const supabase = createBrowserSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const storagePath = buildDocumentStoragePath({
      fileName: selectedFile.name,
      personId: nextPersonId,
      propertyId: nextPropertyId,
      uploaderId: user?.id,
    });

    try {
      const { error: uploadError } = await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).upload(storagePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim() || selectedFile.name,
          description: formDescription.trim(),
          category: formCategory.trim(),
          tags: formTags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          fileUrl: storagePath,
          filePath: storagePath,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || null,
          fileSizeBytes: selectedFile.size,
          personId: nextPersonId,
          propertyId: nextPropertyId,
        }),
      });

      if (!response.ok) {
        await supabase.storage.from(DOCUMENT_STORAGE_BUCKET).remove([storagePath]);
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel salvar o documento.");
      }

      resetUploadForm();
      await loadDocuments();
      if (embedded) {
        setEmbeddedSection("list");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel enviar o documento.");
    } finally {
      setUploading(false);
    }
  };

  const deleteDocument = async (document: DocumentListItem) => {
    if (!window.confirm(`Excluir o documento "${document.title}"?`)) {
      return;
    }

    setDeletingId(document.id);
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel excluir o documento.");
      }

      await loadDocuments();
      setOpenDocumentMenuId(null);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel excluir o documento.");
    } finally {
      setDeletingId(null);
    }
  };

  const shellClass = embedded ? "space-y-5" : "flex h-full w-full flex-col overflow-y-auto bg-novian-primary";
  const innerClass = embedded ? "space-y-5" : "mx-auto flex w-full max-w-none flex-col gap-6 px-6 py-5";
  const heroClass = embedded
    ? "rounded-[24px] border border-novian-muted/35 bg-[linear-gradient(180deg,rgba(247,244,238,0.92),rgba(240,235,228,0.98))] p-5"
    : "rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,37,33,0.92),rgba(11,22,19,0.98))] p-6";
  const heroEyebrowClass = embedded
    ? "inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-novian-text/48"
    : "inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-novian-accent/80";
  const statsGridClass = embedded ? "grid min-w-[260px] grid-cols-2 gap-2" : "grid min-w-[260px] grid-cols-2 gap-3";
  const statCardClass = embedded
    ? "rounded-2xl border border-novian-muted/30 bg-novian-surface/55 px-4 py-3"
    : "rounded-2xl border border-white/8 bg-white/4 px-4 py-3";
  const panelClass = embedded
    ? "rounded-[24px] border border-novian-muted/35 bg-novian-surface/45 p-5"
    : "rounded-[24px] border border-white/8 bg-novian-surface/70 p-5";
  const subtleChipClass = embedded
    ? "inline-flex items-center gap-2 rounded-full border border-novian-muted/35 bg-novian-surface/45 px-3 py-2 text-xs uppercase tracking-[0.16em] text-novian-text/55"
    : "inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.16em] text-novian-text/55";
  const scopeBadgeClass = embedded
    ? "rounded-full border border-novian-muted/35 bg-novian-surface/45 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-novian-text/55"
    : "rounded-full border border-white/8 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-novian-text/55";
  const inputClass =
    "w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/35";
  const selectClass =
    "rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/35";
  const documentCardClass = embedded
    ? "rounded-[24px] border border-novian-muted/35 bg-novian-surface/55 p-5 transition hover:border-novian-accent/30"
    : "rounded-[24px] border border-white/8 bg-novian-surface/70 p-5 transition hover:border-novian-accent/30";
  const emptyStateClass = embedded
    ? "rounded-[24px] border border-dashed border-novian-muted/35 bg-novian-surface/35 px-5 py-12 text-center"
    : "rounded-[24px] border border-dashed border-white/10 bg-novian-surface/40 px-5 py-12 text-center";
  const emptyIconClass = embedded
    ? "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-novian-muted/35 bg-novian-surface/55 text-novian-text/55"
    : "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-novian-text/55";
  const detailCardClass = embedded
    ? "rounded-2xl border border-novian-muted/30 bg-novian-primary/35 px-4 py-3 text-sm text-novian-text/70"
    : "rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-novian-text/70";
  const tagClass = embedded
    ? "inline-flex items-center gap-1 rounded-full border border-novian-muted/30 bg-novian-primary/30 px-3 py-1 text-xs text-novian-text/60"
    : "inline-flex items-center gap-1 rounded-full border border-white/8 px-3 py-1 text-xs text-novian-text/60";
  const secondaryActionClass = embedded
    ? "inline-flex items-center gap-2 rounded-2xl border border-novian-muted/35 bg-novian-primary/35 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
    : "inline-flex items-center gap-2 rounded-2xl border border-white/8 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text";

  const handleSelectFile = (file: File | null) => {
    setSelectedFile(file);
    if (file && !formTitle.trim()) {
      const nextTitle = file.name.replace(/\.[^.]+$/, "");
      setFormTitle(nextTitle);
    }
  };

  const handleDropZoneDragOver = (event: React.DragEvent<HTMLButtonElement | HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDropZoneDragLeave = (event: React.DragEvent<HTMLButtonElement | HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
  };

  const handleDropZoneDrop = (event: React.DragEvent<HTMLButtonElement | HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingFile(false);
    const droppedFile = event.dataTransfer.files?.[0] || null;
    handleSelectFile(droppedFile);
  };

  if (embedded) {
    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEmbeddedSection((current) => (current === "list" ? "upload" : "list"))}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              embeddedSection === "list"
                ? "bg-novian-accent text-novian-primary hover:bg-novian-accent/92"
                : "border border-novian-muted/35 bg-novian-surface/45 text-novian-text/70 hover:border-novian-accent/25 hover:text-novian-text"
            }`}
          >
            {embeddedSection === "list" ? <Upload size={15} /> : null}
            {embeddedSection === "list" ? "Novo documento" : "Ver documentos"}
          </button>
        </div>

        {embeddedSection === "upload" ? (
          <section className="rounded-[28px] border border-novian-muted/35 bg-novian-surface/45 p-5 sm:p-6">
            <div className="grid gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(event) => handleSelectFile(event.target.files?.[0] || null)}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDropZoneDragOver}
                onDragLeave={handleDropZoneDragLeave}
                onDrop={handleDropZoneDrop}
                className={`flex min-h-[156px] w-full flex-col items-center justify-center rounded-[24px] border border-dashed px-5 text-center transition ${
                  isDraggingFile
                    ? "border-novian-accent/45 bg-novian-accent/8"
                    : "border-novian-muted/40 bg-novian-primary/18 hover:border-novian-accent/25 hover:bg-novian-primary/26"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-novian-muted/35 bg-novian-surface/55 text-novian-text/65">
                  <Upload size={18} />
                </div>
                <p className="mt-4 text-sm font-medium text-novian-text">
                  {selectedFile ? selectedFile.name : "Arraste o arquivo aqui ou clique para selecionar"}
                </p>
                <p className="mt-2 text-xs text-novian-text/50">
                  {selectedFile
                    ? `${formatDocumentFileSize(selectedFile.size)} · ${selectedFile.type || "Arquivo"}`
                    : "PDF, DOCX, JPG, PNG e outros formatos"}
                </p>
              </button>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Título</label>
                  <input
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder="Ex: Matrícula atualizada"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Categoria</label>
                  <input
                    value={formCategory}
                    onChange={(event) => setFormCategory(event.target.value)}
                    placeholder="Ex: contrato, propriedade, identificação"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Tags</label>
                  <input
                    value={formTags}
                    onChange={(event) => setFormTags(event.target.value)}
                    placeholder="Ex: escritura, comprador, assinatura"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Descrição</label>
                  <input
                    value={formDescription}
                    onChange={(event) => setFormDescription(event.target.value)}
                    placeholder="Observações rápidas sobre este arquivo"
                    className={inputClass}
                  />
                </div>

                {!isScopedToPerson ? (
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Pessoa</label>
                    <select
                      value={selectedPersonId}
                      onChange={(event) => setSelectedPersonId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sem pessoa vinculada</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {!isScopedToProperty ? (
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Imóvel</label>
                    <select
                      value={selectedPropertyId}
                      onChange={(event) => setSelectedPropertyId(event.target.value)}
                      className={inputClass}
                    >
                      <option value="">Sem imóvel vinculado</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => uploadDocument().catch(console.error)}
                  disabled={uploading}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-novian-accent px-5 py-3 text-sm font-semibold text-novian-primary transition hover:bg-novian-accent/92 disabled:cursor-not-allowed disabled:bg-novian-accent/15 disabled:text-novian-accent/45 disabled:opacity-100"
                >
                  <Upload size={15} />
                  {uploading ? "Enviando..." : "Salvar documento"}
                </button>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[28px] border border-novian-muted/35 bg-novian-surface/45 p-3 sm:p-4">
            <div className="rounded-[24px] bg-novian-primary/18 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-novian-text/40" size={16} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar documentos"
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </div>
            </div>

            <div className="relative mt-3 overflow-visible rounded-[24px] border border-novian-muted/24 bg-novian-primary/12">
              {loading ? (
                <div className="px-5 py-14 text-center text-sm text-novian-text/55">Carregando documentos...</div>
              ) : documents.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-novian-muted/35 bg-novian-primary/25 text-novian-text/45">
                    <FileText size={18} />
                  </div>
                  <p className="mt-4 text-base font-medium text-novian-text">Nenhum documento encontrado</p>
                </div>
              ) : (
                <div>
                  <div className="hidden grid-cols-[minmax(0,1.8fr)_160px_56px] gap-4 border-b border-novian-muted/14 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-novian-text/40 md:grid">
                    <div>Arquivo</div>
                    <div>Atualizado</div>
                    <div className="text-right">Ações</div>
                  </div>
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className="grid gap-3 border-b border-novian-muted/14 px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1.8fr)_160px_56px] md:items-center md:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-novian-muted/24 bg-novian-surface/55 text-novian-text/55">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium text-novian-text">{document.title}</div>
                            <div className="mt-1 truncate text-xs text-novian-text/52">{document.fileName}</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-novian-text/55">
                        {formatDate(document.updatedAt)}
                      </div>
                      <div className="flex justify-end">
                        <div className="relative z-20" data-document-menu-root="true">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDocumentMenuId((current) => (current === document.id ? null : document.id))
                            }
                            aria-label={`Ações de ${document.title}`}
                            aria-haspopup="menu"
                            aria-expanded={openDocumentMenuId === document.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-novian-muted/28 bg-transparent text-novian-text/58 transition hover:border-novian-accent/24 hover:text-novian-text"
                          >
                            <MoreHorizontal size={15} />
                          </button>

                          {openDocumentMenuId === document.id ? (
                            <div className="absolute bottom-11 right-0 z-30 min-w-[160px] rounded-2xl border border-novian-muted/25 bg-novian-surface/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur">
                              <a
                                href={document.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-surface/40 hover:text-novian-text"
                              >
                                <Eye size={14} />
                                Ver arquivo
                              </a>
                              <a
                                href={document.fileUrl}
                                download={document.fileName}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-surface/40 hover:text-novian-text"
                              >
                                <Download size={14} />
                                Baixar
                              </a>
                              <button
                                type="button"
                                onClick={() => deleteDocument(document).catch(console.error)}
                                disabled={deletingId === document.id}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-600 transition hover:bg-red-500/10 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Trash2 size={14} />
                                {deletingId === document.id ? "Excluindo..." : "Excluir"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className={innerClass}>
        <section className={heroClass}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className={heroEyebrowClass}>
                <FolderOpen size={14} />
                {embedded ? "Documentos" : "Documents Hub"}
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-novian-text">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-novian-text/60">{description}</p>
            </div>
            <div className={statsGridClass}>
              <div className={statCardClass}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Total</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.total}</div>
              </div>
              <div className={statCardClass}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Com pessoas</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.people}</div>
              </div>
              <div className={statCardClass}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Com imóveis</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.properties}</div>
              </div>
              <div className={statCardClass}>
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Última atividade</div>
                <div className="mt-1 text-sm font-medium text-novian-text">
                  {stats.recent ? formatDate(stats.recent) : "Sem uploads ainda"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={`grid gap-6 ${embedded ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "xl:grid-cols-[minmax(0,1fr)_360px]"}`}>
          <div className="space-y-4">
            <div className={panelClass}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-novian-text/40" size={16} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por título, categoria, pessoa ou imóvel"
                    className={`${inputClass} pl-11`}
                  />
                </div>
                <div className={subtleChipClass}>
                  <Filter size={13} />
                  Filtros
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {!personId && !propertyId ? (
                  <select
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value)}
                    className={selectClass}
                  >
                    {SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!personId ? (
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className={selectClass}
                  >
                    {PERSON_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                className={selectClass}
                >
                  <option value="all">Todas as categorias</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select
                  value={tagFilter}
                  onChange={(event) => setTagFilter(event.target.value)}
                className={selectClass}
                >
                  <option value="all">Todas as tags</option>
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className={`${panelClass} px-5 py-12 text-center text-sm text-novian-text/55`}>
                  Carregando documentos...
                </div>
              ) : documents.length === 0 ? (
                <div className={emptyStateClass}>
                  <div className={emptyIconClass}>
                    <FileText size={20} />
                  </div>
                  <div className="mt-4 text-lg font-medium text-novian-text">Nenhum documento encontrado</div>
                  <div className="mt-2 text-sm text-novian-text/55">
                    Ajuste os filtros ou envie um novo arquivo para iniciar a base documental.
                  </div>
                </div>
              ) : (
                documents.map((document) => (
                  <article
                    key={document.id}
                    className={documentCardClass}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={scopeBadgeClass}>
                            {getScopeLabel(document)}
                          </span>
                          {document.category ? (
                            <span className="rounded-full bg-novian-accent/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-novian-accent">
                              {document.category}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl text-novian-text/70 ${embedded ? "border border-novian-muted/35 bg-novian-primary/35" : "border border-white/8 bg-white/4"}`}>
                            <FileText size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-lg font-semibold text-novian-text">{document.title}</h3>
                            <div className="mt-1 text-sm text-novian-text/55">
                              {document.fileName} · {formatDocumentFileSize(document.fileSizeBytes)}
                            </div>
                            {document.description ? (
                              <p className="mt-3 text-sm leading-6 text-novian-text/65">{document.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          {document.person ? (
                            <div className={detailCardClass}>
                              <div className="flex items-center gap-2 text-novian-text">
                                <User size={14} />
                                {document.person.fullName}
                              </div>
                              <div className="mt-1 text-xs text-novian-text/45">{document.person.roles.join(", ") || "Sem papel"}</div>
                            </div>
                          ) : null}
                          {document.property ? (
                            <div className={detailCardClass}>
                              <div className="flex items-center gap-2 text-novian-text">
                                <Home size={14} />
                                {document.property.title}
                              </div>
                              <div className="mt-1 text-xs text-novian-text/45">{document.property.address}</div>
                            </div>
                          ) : null}
                        </div>
                        {document.tags.length > 0 ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {document.tags.map((tag) => (
                              <span
                                key={tag}
                                className={tagClass}
                              >
                                <Tag size={11} />
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-3">
                        <div className="text-right text-xs text-novian-text/45">{formatDate(document.updatedAt)}</div>
                        <a
                          href={document.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={secondaryActionClass}
                        >
                          <FileText size={13} />
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteDocument(document).catch(console.error)}
                          disabled={deletingId === document.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-red-600 transition hover:bg-red-500/10 hover:text-red-700 disabled:opacity-60"
                        >
                          <Trash2 size={13} />
                          {deletingId === document.id ? "Excluindo..." : "Excluir"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className={panelClass}>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-novian-accent">
              <Upload size={14} />
              Novo documento
            </div>
            <h3 className="mt-2 text-lg font-semibold text-novian-text">Anexar arquivo</h3>
            <p className="mt-2 text-sm text-novian-text/55">
              Faça upload e já vincule o documento ao contato, ao imóvel ou aos dois.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Arquivo</label>
                <input
                  type="file"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none file:mr-3 file:rounded-full file:border-0 file:bg-novian-accent/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-novian-accent"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Título</label>
                <input
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  placeholder="Ex: RG comprador, matrícula, contrato"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Categoria</label>
                <input
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  placeholder="Ex: identificação, contrato, propriedade"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Descrição</label>
                <textarea
                  value={formDescription}
                  onChange={(event) => setFormDescription(event.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Tags</label>
                <input
                  value={formTags}
                  onChange={(event) => setFormTags(event.target.value)}
                  placeholder="vip, escritura, due-diligence"
                  className={inputClass}
                />
              </div>

              {!isScopedToPerson ? (
                <div>
                  <label className="mb-1 block text-xs text-novian-text/60">Pessoa</label>
                  <select
                    value={selectedPersonId}
                    onChange={(event) => setSelectedPersonId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sem pessoa vinculada</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {!isScopedToProperty ? (
                <div>
                  <label className="mb-1 block text-xs text-novian-text/60">Imóvel</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(event) => setSelectedPropertyId(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Sem imóvel vinculado</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.title}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => uploadDocument().catch(console.error)}
                disabled={uploading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-novian-accent px-4 py-3 text-sm font-semibold text-novian-primary transition hover:bg-white disabled:opacity-60"
              >
                <Upload size={15} />
                {uploading ? "Enviando..." : "Salvar documento"}
              </button>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
