"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileText,
  Filter,
  FolderOpen,
  Home,
  Search,
  Tag,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { buildDocumentStoragePath, formatDocumentFileSize, type DocumentListItem } from "@/lib/documents";
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
  const [documents, setDocuments] = useState<DocumentListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [people, setPeople] = useState<LookupPerson[]>([]);
  const [properties, setProperties] = useState<LookupProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formTags, setFormTags] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState(personId || "");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyId || "");

  const isScopedToPerson = Boolean(personId);
  const isScopedToProperty = Boolean(propertyId);

  useEffect(() => {
    setSelectedPersonId(personId || "");
  }, [personId]);

  useEffect(() => {
    setSelectedPropertyId(propertyId || "");
  }, [propertyId]);

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
    const storagePath = buildDocumentStoragePath(selectedFile.name);

    try {
      const { error: uploadError } = await supabase.storage.from("attachments").upload(storagePath, selectedFile, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage.from("attachments").getPublicUrl(storagePath);
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
          fileUrl: publicUrlData.publicUrl,
          filePath: storagePath,
          fileName: selectedFile.name,
          mimeType: selectedFile.type || null,
          fileSizeBytes: selectedFile.size,
          personId: nextPersonId,
          propertyId: nextPropertyId,
        }),
      });

      if (!response.ok) {
        await supabase.storage.from("attachments").remove([storagePath]);
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel salvar o documento.");
      }

      resetUploadForm();
      await loadDocuments();
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
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel excluir o documento.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className={embedded ? "space-y-6" : "flex h-full w-full flex-col overflow-y-auto bg-novian-primary"}>
      <div className={embedded ? "space-y-6" : "mx-auto flex w-full max-w-none flex-col gap-6 px-6 py-5"}>
        <section className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,37,33,0.92),rgba(11,22,19,0.98))] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-novian-accent/80">
                <FolderOpen size={14} />
                Documents Hub
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-novian-text">{title}</h2>
              <p className="mt-2 max-w-3xl text-sm text-novian-text/60">{description}</p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Total</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.total}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Com pessoas</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.people}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Com imoveis</div>
                <div className="mt-1 text-2xl font-semibold text-novian-text">{stats.properties}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Ultima atividade</div>
                <div className="mt-1 text-sm font-medium text-novian-text">
                  {stats.recent ? formatDate(stats.recent) : "Sem uploads ainda"}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/8 bg-novian-surface/70 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-novian-text/40" size={16} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por titulo, categoria, pessoa ou imovel"
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 py-3 pl-11 pr-4 text-sm text-novian-text outline-none transition focus:border-novian-accent/40"
                  />
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2 text-xs uppercase tracking-[0.16em] text-novian-text/55">
                  <Filter size={13} />
                  Filtros
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {!personId && !propertyId ? (
                  <select
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value)}
                    className="rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
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
                    className="rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
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
                  className="rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
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
                  className="rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
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
                <div className="rounded-[24px] border border-white/8 bg-novian-surface/50 px-5 py-12 text-center text-sm text-novian-text/55">
                  Carregando documentos...
                </div>
              ) : documents.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-novian-surface/40 px-5 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/4 text-novian-text/55">
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
                    className="rounded-[24px] border border-white/8 bg-novian-surface/70 p-5 transition hover:border-novian-accent/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-novian-text/55">
                            {getScopeLabel(document)}
                          </span>
                          {document.category ? (
                            <span className="rounded-full bg-novian-accent/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-novian-accent">
                              {document.category}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                          <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/8 bg-white/4 text-novian-text/70">
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
                            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-novian-text/70">
                              <div className="flex items-center gap-2 text-novian-text">
                                <User size={14} />
                                {document.person.fullName}
                              </div>
                              <div className="mt-1 text-xs text-novian-text/45">{document.person.roles.join(", ") || "Sem papel"}</div>
                            </div>
                          ) : null}
                          {document.property ? (
                            <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-novian-text/70">
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
                                className="inline-flex items-center gap-1 rounded-full border border-white/8 px-3 py-1 text-xs text-novian-text/60"
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
                          className="inline-flex items-center gap-2 rounded-2xl border border-white/8 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                        >
                          <FileText size={13} />
                          Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteDocument(document).catch(console.error)}
                          disabled={deletingId === document.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 px-3 py-2 text-xs font-medium uppercase tracking-[0.14em] text-red-300 transition hover:bg-red-500/10 disabled:opacity-60"
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

          <aside className="rounded-[24px] border border-white/8 bg-novian-surface/70 p-5">
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
                <label className="mb-1 block text-xs text-novian-text/60">Titulo</label>
                <input
                  value={formTitle}
                  onChange={(event) => setFormTitle(event.target.value)}
                  placeholder="Ex: RG comprador, matricula, contrato"
                  className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Categoria</label>
                <input
                  value={formCategory}
                  onChange={(event) => setFormCategory(event.target.value)}
                  placeholder="Ex: identificacao, contrato, propriedade"
                  className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Descricao</label>
                <textarea
                  value={formDescription}
                  onChange={(event) => setFormDescription(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-novian-text/60">Tags</label>
                <input
                  value={formTags}
                  onChange={(event) => setFormTags(event.target.value)}
                  placeholder="vip, escritura, due-diligence"
                  className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
                />
              </div>

              {!isScopedToPerson ? (
                <div>
                  <label className="mb-1 block text-xs text-novian-text/60">Pessoa</label>
                  <select
                    value={selectedPersonId}
                    onChange={(event) => setSelectedPersonId(event.target.value)}
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
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
                  <label className="mb-1 block text-xs text-novian-text/60">Imovel</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(event) => setSelectedPropertyId(event.target.value)}
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-primary/40 px-4 py-3 text-sm text-novian-text outline-none"
                  >
                    <option value="">Sem imovel vinculado</option>
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
