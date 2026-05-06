"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  Filter,
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

const DOCUMENT_SCOPE_TABS = [
  { value: "all", label: "Todos" },
  { value: "person", label: "Pessoas" },
  { value: "property", label: "Imoveis" },
  { value: "mixed", label: "Ambos" },
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
  const [showFilters, setShowFilters] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
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

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!personId && !propertyId && scopeFilter !== "all") count += 1;
    if (!personId && roleFilter !== "all") count += 1;
    if (categoryFilter !== "all") count += 1;
    if (tagFilter !== "all") count += 1;
    return count;
  }, [personId, propertyId, scopeFilter, roleFilter, categoryFilter, tagFilter]);

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

  const scopeBadgeClass = "rounded-full border border-novian-muted/30 bg-novian-primary/50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-novian-text/60";
  const filterInputClass = "w-full rounded-full border border-novian-muted/30 bg-white px-5 py-2.5 text-sm text-novian-text outline-none transition focus:border-novian-accent/40 focus:ring-2 focus:ring-novian-accent/10 shadow-sm";
  const filterSelectClass = "rounded-full border border-novian-muted/30 bg-white px-4 py-2.5 text-sm text-novian-text outline-none transition focus:border-novian-accent/40 focus:ring-2 focus:ring-novian-accent/10 shadow-sm appearance-none pr-8 cursor-pointer";
  const formInputClass = "w-full rounded-xl border border-novian-muted/30 bg-white px-4 py-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/40 focus:ring-2 focus:ring-novian-accent/10";
  const tagClass = "inline-flex items-center gap-1 rounded-md bg-novian-primary/60 px-2.5 py-1 text-[11px] font-medium text-novian-text/70";

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
                    className={formInputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Categoria</label>
                  <input
                    value={formCategory}
                    onChange={(event) => setFormCategory(event.target.value)}
                    placeholder="Ex: contrato, propriedade, identificação"
                    className={formInputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Tags</label>
                  <input
                    value={formTags}
                    onChange={(event) => setFormTags(event.target.value)}
                    placeholder="Ex: escritura, comprador, assinatura"
                    className={formInputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Descrição</label>
                  <input
                    value={formDescription}
                    onChange={(event) => setFormDescription(event.target.value)}
                    placeholder="Observações rápidas sobre este arquivo"
                    className={formInputClass}
                  />
                </div>

                {!isScopedToPerson ? (
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-novian-text/45">Pessoa</label>
                    <select
                      value={selectedPersonId}
                      onChange={(event) => setSelectedPersonId(event.target.value)}
                      className={formInputClass}
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
                      className={formInputClass}
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
                    className={`${filterInputClass} pl-11`}
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
        <section className="-mx-6 flex flex-1 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-novian-muted/25 px-5 py-2">
            {!personId && !propertyId ? (
              <div className="mr-auto -mb-px flex flex-wrap items-center gap-5">
                {DOCUMENT_SCOPE_TABS.map((tab) => {
                  const active = scopeFilter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setScopeFilter(tab.value)}
                      className={`inline-flex h-9 items-center border-b px-0 text-[10px] font-medium uppercase tracking-[0.14em] transition ${
                        active
                          ? "border-novian-accent text-novian-text"
                          : "border-transparent text-novian-text/42 hover:text-novian-text/68"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mr-auto flex items-center gap-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-novian-text/40">{title}</div>
                <div className="hidden text-xs text-novian-text/45 lg:block">{description}</div>
              </div>
            )}

            <div className="relative w-full min-w-[220px] flex-1 sm:max-w-[320px] sm:flex-none">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-novian-text/36" size={14} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Buscar documentos"
                className={`${filterInputClass} h-8 px-10 py-0 text-xs`}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((current) => !current)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-novian-muted/35 bg-white px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-novian-text/64 transition hover:border-novian-accent/35 hover:text-novian-text"
            >
              <Filter size={12} />
              Filtros
              {activeFilterCount > 0 ? (
                <span className="rounded-full bg-novian-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setShowUploadPanel((current) => !current)}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-novian-accent px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-novian-accent/90"
            >
              <Upload size={12} />
              Novo documento
            </button>
          </div>

          {showFilters ? (
            <div className="border-b border-novian-muted/25 bg-novian-primary/18 px-5 py-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_minmax(0,220px)_auto]">
                {!personId ? (
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className={filterSelectClass}
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
                  className={filterSelectClass}
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
                  className={filterSelectClass}
                >
                  <option value="all">Todas as tags</option>
                  {tags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setRoleFilter("all");
                    setCategoryFilter("all");
                    setTagFilter("all");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-full border border-novian-muted/35 px-4 text-xs font-medium uppercase tracking-[0.12em] text-novian-text/55 transition hover:border-novian-accent/35 hover:text-novian-text"
                >
                  Limpar filtros
                </button>
              </div>
            </div>
          ) : null}

          {showUploadPanel ? (
            <div className="border-b border-novian-muted/25 bg-novian-primary/18 px-5 py-4">
              <div className="rounded-[24px] border border-novian-muted/35 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-novian-accent">Novo documento</div>
                    <div className="mt-2 text-sm text-novian-text/60">{description}</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="md:col-span-2 xl:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-novian-text/70">Arquivo</label>
                    <input
                      type="file"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                      className="w-full rounded-xl border border-novian-muted/30 bg-white px-3 py-2 text-sm text-novian-text outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-novian-muted/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-novian-text/80 hover:file:bg-novian-muted/30 transition shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-novian-text/70">Título</label>
                    <input
                      value={formTitle}
                      onChange={(event) => setFormTitle(event.target.value)}
                      placeholder="Ex: RG comprador, matrícula, contrato"
                      className={formInputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-novian-text/70">Categoria</label>
                    <input
                      value={formCategory}
                      onChange={(event) => setFormCategory(event.target.value)}
                      placeholder="Ex: identificação, contrato, propriedade"
                      className={formInputClass}
                    />
                  </div>

                  <div className="md:col-span-2 xl:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-novian-text/70">Descrição</label>
                    <textarea
                      value={formDescription}
                      onChange={(event) => setFormDescription(event.target.value)}
                      rows={4}
                      className={formInputClass}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-novian-text/70">Tags</label>
                    <input
                      value={formTags}
                      onChange={(event) => setFormTags(event.target.value)}
                      placeholder="vip, escritura, due-diligence"
                      className={formInputClass}
                    />
                  </div>

                  {!isScopedToPerson ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-novian-text/70">Pessoa</label>
                      <select
                        value={selectedPersonId}
                        onChange={(event) => setSelectedPersonId(event.target.value)}
                        className={formInputClass}
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
                      <label className="mb-1 block text-xs font-medium text-novian-text/70">Imóvel</label>
                      <select
                        value={selectedPropertyId}
                        onChange={(event) => setSelectedPropertyId(event.target.value)}
                        className={formInputClass}
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

                  <div className="flex items-end justify-end md:col-span-2 xl:col-span-3">
                    <button
                      type="button"
                      onClick={() => uploadDocument().catch(console.error)}
                      disabled={uploading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-novian-accent px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-novian-accent/90 disabled:opacity-60 shadow-sm md:w-auto md:min-w-[220px]"
                    >
                      <Upload size={15} />
                      {uploading ? "Enviando..." : "Salvar documento"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm text-novian-text">
              <thead className="border-b border-novian-muted/30 text-[11px] uppercase tracking-[0.18em] text-novian-text/42">
                <tr>
                  <th className="px-5 py-3">Documento</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Tags</th>
                  <th className="px-5 py-3">Relacionamento</th>
                  <th className="px-5 py-3">Atualizado</th>
                  <th className="px-4 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-novian-text/50">
                      Carregando documentos...
                    </td>
                  </tr>
                ) : documents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-novian-text/50">
                      Nenhum documento encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  documents.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-novian-muted/20 transition hover:bg-novian-primary/25 last:border-b-0"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-novian-muted/30 bg-novian-primary/30 text-novian-accent">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-novian-text">{document.title}</div>
                            <div className="truncate text-xs text-novian-text/55">
                              {document.fileName} {document.fileSizeBytes ? `· ${formatDocumentFileSize(document.fileSizeBytes)}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {document.category ? (
                          <span className="inline-flex rounded-md bg-novian-accent/10 px-2 py-1 text-[11px] text-novian-accent">
                            {document.category}
                          </span>
                        ) : (
                          <span className="text-xs text-novian-text/28">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex max-w-[260px] flex-wrap gap-1.5">
                          {document.tags.length > 0 ? (
                            document.tags.slice(0, 4).map((tag) => (
                              <span key={tag} className={tagClass}>
                                <Tag size={11} />
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-novian-text/28">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={scopeBadgeClass}>{getScopeLabel(document)}</span>
                          </div>
                          <div className="mt-2 space-y-1 text-xs text-novian-text/55">
                            {document.person ? (
                              <div className="flex items-center gap-2">
                                <User size={12} />
                                <span className="truncate">{document.person.fullName}</span>
                              </div>
                            ) : null}
                            {document.property ? (
                              <div className="flex items-center gap-2">
                                <Home size={12} />
                                <span className="truncate">{document.property.title}</span>
                              </div>
                            ) : null}
                            {!document.person && !document.property ? <span className="text-novian-text/28">-</span> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="text-sm text-novian-text/65">{formatDate(document.updatedAt)}</div>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="relative inline-flex" data-document-menu-root="true">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDocumentMenuId((current) => (current === document.id ? null : document.id))
                            }
                            aria-label={`Ações de ${document.title}`}
                            aria-haspopup="menu"
                            aria-expanded={openDocumentMenuId === document.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-novian-text/38 transition hover:border-novian-muted/35 hover:bg-novian-primary/50 hover:text-novian-text/72"
                          >
                            <MoreHorizontal size={14} />
                          </button>
                          {openDocumentMenuId === document.id ? (
                            <div className="absolute right-0 top-10 z-20 min-w-[160px] rounded-2xl border border-novian-muted/45 bg-[rgba(250,248,243,0.98)] p-1.5 text-left shadow-[0_18px_40px_rgba(47,74,58,0.14)] backdrop-blur-xl">
                              <a
                                href={document.fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-surface/65 hover:text-novian-text"
                              >
                                <Eye size={14} />
                                Ver arquivo
                              </a>
                              <a
                                href={document.fileUrl}
                                download={document.fileName}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-surface/65 hover:text-novian-text"
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-novian-muted/25 px-5 py-3">
            <div className="text-[11px] uppercase tracking-[0.16em] text-novian-text/34">
              {loading ? "Carregando registros" : `${documents.length} registro(s)`}
            </div>
            <div className="text-xs text-novian-text/45">Centralize arquivos, vínculos e classificação em uma única grade.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
