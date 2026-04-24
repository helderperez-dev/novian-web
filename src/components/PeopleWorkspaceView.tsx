"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  CopyPlus,
  GitMerge,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Save,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import DocumentsWorkspace from "@/components/DocumentsWorkspace";
import PopupSelect from "@/components/PopupSelect";

type FunnelColumn = {
  id: string;
  title: string;
  color: string;
};

type Funnel = {
  id: string;
  name: string;
  type: "lead" | "captacao";
  columns: FunnelColumn[];
};

type CustomField = {
  id: string;
  name: string;
  type: "text" | "number" | "dropdown" | "date";
  options?: string[] | null;
  required?: boolean | null;
};

type PersonRole = "lead" | "client" | "buyer" | "seller";
type WorkspaceMode = "people" | "crm";
type ViewMode = "grid" | "board";

type PersonLead = {
  id: string;
  status: string | null;
  funnelId: string | null;
  score: number | null;
  preview: string | null;
  unread: boolean | null;
  updatedAt: string;
};

type PersonItem = {
  id: string;
  fullName: string;
  primaryPhone: string | null;
  email: string | null;
  roles: PersonRole[];
  tags: string[];
  origin: string;
  stagePoints: number;
  metadata: Record<string, unknown>;
  lastInteractionPreview: string;
  createdAt: string;
  updatedAt: string;
  lead: PersonLead | null;
  leadCount: number;
};

type DuplicateGroup = {
  key: string;
  label: string;
  reason: "phone" | "email";
  people: PersonItem[];
};

const ROLE_OPTIONS: Array<{ value: PersonRole; label: string; hint: string }> = [
  { value: "lead", label: "Lead", hint: "Contato em desenvolvimento comercial." },
  { value: "client", label: "Cliente", hint: "Relacionamento ativo ou concluido." },
  { value: "buyer", label: "Comprador", hint: "Interesse principal em compra." },
  { value: "seller", label: "Proprietário", hint: "Contato ligado a captacao ou venda do imovel." },
];

const PERSON_TYPE_TABS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "buyer", label: "Compradores" },
  { value: "seller", label: "Proprietários" },
  { value: "lead", label: "Leads" },
  { value: "client", label: "Clientes" },
];

const BUSINESS_ROLE_OPTIONS = ROLE_OPTIONS.filter((role) => role.value === "buyer" || role.value === "seller");

const PEOPLE_PAGE_SIZE = 10;

const BULK_ACTION_OPTIONS = [
  { value: "", label: "Selecione a acao" },
  { value: "add_tag", label: "Adicionar tag" },
  { value: "remove_tag", label: "Remover tag" },
  { value: "add_role", label: "Adicionar perfil" },
  { value: "remove_role", label: "Remover perfil" },
  { value: "set_origin", label: "Alterar origem" },
  { value: "adjust_points", label: "Ajustar pontos" },
  { value: "set_lead_stage", label: "Mover etapa CRM" },
];

const formatRelativeDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const parseTagInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) =>
          item
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

const BUSINESS_ROLE_ORDER: PersonRole[] = ["buyer", "seller"];

const getRoleLabel = (role: PersonRole) => ROLE_OPTIONS.find((item) => item.value === role)?.label || role;

const getBusinessRoles = (roles: PersonRole[]) =>
  BUSINESS_ROLE_ORDER.filter((role) => roles.includes(role));

const getRelationshipState = (person: PersonItem) => {
  if (person.roles.includes("client")) {
    return {
      label: "Cliente",
      detail: person.lead?.status || "Relacionamento ativo",
    };
  }

  if (person.lead || person.roles.includes("lead")) {
    return {
      label: "Lead",
      detail: person.lead?.status || "Em qualificacao",
    };
  }

  return {
    label: "Contato",
    detail: "Fora do funil",
  };
};

const getPersonAvatarUrl = (person: PersonItem) =>
  typeof person.metadata?.whatsapp_profile_picture_url === "string" && person.metadata.whatsapp_profile_picture_url
    ? String(person.metadata.whatsapp_profile_picture_url)
    : undefined;

const getBoardColumnBadgeClass = (color: string | null | undefined) => {
  if (typeof color === "string" && color.includes("border-")) {
    return color;
  }

  return "border-white/8 bg-white/5 text-novian-text/50";
};

const matchesSelectedGroup = (person: PersonItem, selectedRole: string) => {
  if (selectedRole === "all") return true;
  if (selectedRole === "lead") return Boolean(person.lead || person.roles.includes("lead"));
  if (selectedRole === "client") return person.roles.includes("client");
  return person.roles.includes(selectedRole as PersonRole);
};

function RolePills({
  value,
  onChange,
}: {
  value: PersonRole[];
  onChange: (next: PersonRole[]) => void;
}) {
  const toggle = (role: PersonRole) => {
    if (value.includes(role)) {
      onChange(value.filter((item) => item !== role));
      return;
    }

    onChange([...value, role]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {BUSINESS_ROLE_OPTIONS.map((role) => {
        const active = value.includes(role.value);
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => toggle(role.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-novian-accent bg-novian-accent/15 text-novian-accent"
                : "border-novian-muted/40 bg-novian-primary/30 text-novian-text/60 hover:border-novian-accent/40 hover:text-novian-text"
            }`}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

function DuplicateCard({
  group,
  onMerge,
}: {
  group: DuplicateGroup;
  onMerge: (group: DuplicateGroup) => void;
}) {
  return (
    <div className="rounded-3xl border border-amber-500/20 bg-amber-500/8 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-amber-200/75">
            <AlertTriangle size={13} />
            Possivel duplicidade por {group.reason === "phone" ? "telefone" : "e-mail"}
          </div>
          <div className="mt-2 text-sm font-semibold text-novian-text">{group.label}</div>
          <div className="mt-1 text-xs text-novian-text/55">{group.people.length} registros conectados ao mesmo identificador.</div>
        </div>
        <button
          onClick={() => onMerge(group)}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-300/15"
        >
          <GitMerge size={13} />
          Mesclar grupo
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {group.people.map((person, index) => (
          <div key={person.id} className="rounded-2xl border border-white/6 bg-black/10 px-3 py-2.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-novian-text">
                  {person.fullName} {index === 0 ? <span className="text-xs text-novian-accent/80">· sugerido como principal</span> : null}
                </div>
                <div className="mt-1 text-xs text-novian-text/55">
                  {person.primaryPhone || "Sem telefone"} {person.email ? `· ${person.email}` : ""}
                </div>
              </div>
              <div className="text-xs text-novian-text/45">{formatRelativeDateTime(person.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterDrawer({
  open,
  selectedRole,
  setSelectedRole,
  selectedTag,
  setSelectedTag,
  selectedStage,
  setSelectedStage,
  activeFunnelId,
  setActiveFunnelId,
  availableTags,
  funnels,
  onClose,
  onReset,
}: {
  open: boolean;
  selectedRole: string;
  setSelectedRole: (value: string) => void;
  selectedTag: string;
  setSelectedTag: (value: string) => void;
  selectedStage: string;
  setSelectedStage: (value: string) => void;
  activeFunnelId: string;
  setActiveFunnelId: (value: string) => void;
  availableTags: string[];
  funnels: Funnel[];
  onClose: () => void;
  onReset: () => void;
}) {
  const selectedFunnel = funnels.find((funnel) => funnel.id === activeFunnelId) || funnels[0] || null;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-novian-muted/40 bg-novian-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-novian-muted/35 px-6 py-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-novian-text/40">Datagrid Filters</div>
            <div className="mt-1 text-xl font-semibold text-novian-text">Filtrar Pessoas</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-novian-muted/30 bg-novian-primary/35 p-2 text-novian-text/60 transition hover:text-novian-text"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-novian-text/45">Funil</div>
            <PopupSelect
              value={activeFunnelId}
              onChange={setActiveFunnelId}
              options={funnels.map((funnel) => ({ value: funnel.id, label: funnel.name }))}
              buttonClassName="bg-novian-primary/35"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-novian-text/45">Perfil</div>
            <PopupSelect
              value={selectedRole}
              onChange={setSelectedRole}
              options={[
                { value: "all", label: "Todos os perfis" },
                ...ROLE_OPTIONS.map((role) => ({ value: role.value, label: role.label })),
              ]}
              buttonClassName="bg-novian-primary/35"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-novian-text/45">Tag</div>
            <PopupSelect
              value={selectedTag}
              onChange={setSelectedTag}
              options={[
                { value: "all", label: "Todas as tags" },
                ...availableTags.map((tag) => ({ value: tag, label: tag })),
              ]}
              buttonClassName="bg-novian-primary/35"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-novian-text/45">Etapa</div>
            <PopupSelect
              value={selectedStage}
              onChange={setSelectedStage}
              options={[
                { value: "all", label: "Todas as etapas" },
                ...(selectedFunnel?.columns || []).map((column) => ({ value: column.title, label: column.title })),
              ]}
              buttonClassName="bg-novian-primary/35"
            />
          </div>
        </div>

        <div className="border-t border-novian-muted/35 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onReset}
              className="rounded-full border border-novian-muted/30 px-4 py-2 text-sm text-novian-text/65 transition hover:border-novian-accent/35 hover:text-novian-text"
            >
              Limpar filtros
            </button>
            <button
              onClick={onClose}
              className="rounded-full bg-novian-accent px-4 py-2 text-sm font-semibold text-novian-primary transition hover:bg-white"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonDrawer({
  open,
  person,
  funnels,
  customFields,
  mode,
  onClose,
  onSaved,
}: {
  open: boolean;
  person: PersonItem | null;
  funnels: Funnel[];
  customFields: CustomField[];
  mode: WorkspaceMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [primaryPhone, setPrimaryPhone] = useState("");
  const [email, setEmail] = useState("");
  const [origin, setOrigin] = useState("manual");
  const [roles, setRoles] = useState<PersonRole[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [stagePoints, setStagePoints] = useState(0);
  const [leadEnabled, setLeadEnabled] = useState(mode === "crm");
  const [leadFunnelId, setLeadFunnelId] = useState("");
  const [leadStatus, setLeadStatus] = useState("");
  const [leadScore, setLeadScore] = useState(0);
  const [metadataValues, setMetadataValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "crm" | "documents">("profile");

  useEffect(() => {
    if (!open) return;

    setActiveTab("profile");
    setFullName(person?.fullName || "");
    setPrimaryPhone(person?.primaryPhone || "");
    setEmail(person?.email || "");
    setOrigin(person?.origin || "manual");
    setRoles(getBusinessRoles(person?.roles || []));
    setIsClient(Boolean(person?.roles?.includes("client")));
    setTagsInput((person?.tags || []).join(", "));
    setStagePoints(person?.stagePoints || 0);
    setLeadEnabled(mode === "crm" ? true : Boolean(person?.lead || person?.roles?.includes("lead")));
    setLeadFunnelId(person?.lead?.funnelId || funnels[0]?.id || "");
    setLeadStatus(person?.lead?.status || "");
    setLeadScore(person?.lead?.score || person?.stagePoints || 0);

    const nextMetadata: Record<string, string> = {};
    for (const field of customFields) {
      const value = person?.metadata?.[field.id];
      nextMetadata[field.id] = value === undefined || value === null ? "" : String(value);
    }
    setMetadataValues(nextMetadata);
  }, [open, person, customFields, funnels, mode]);

  const selectedFunnel = funnels.find((item) => item.id === leadFunnelId) || funnels[0] || null;

  useEffect(() => {
    if (!selectedFunnel) return;
    if (!leadStatus) {
      setLeadStatus(selectedFunnel.columns[0]?.title || "");
    }
  }, [selectedFunnel, leadStatus]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const normalizedRoles = Array.from(
        new Set<PersonRole>([
          ...roles,
          ...(isClient ? ["client"] as PersonRole[] : []),
          ...(leadEnabled || mode === "crm" ? ["lead"] as PersonRole[] : []),
        ]),
      );
      const payload = {
        fullName,
        primaryPhone,
        email,
        origin,
        roles: normalizedRoles,
        tags: parseTagInput(tagsInput),
        stagePoints: Number(stagePoints || 0),
        metadata: metadataValues,
        createLead: leadEnabled || mode === "crm",
        leadFunnelId: leadFunnelId || undefined,
        leadStatus: leadStatus || undefined,
        leadScore: Number(leadScore || 0),
      };

      const res = await fetch(person ? `/api/people/${encodeURIComponent(person.id)}` : "/api/people", {
        method: person ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel salvar.");
      }

      onSaved();
      onClose();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel salvar a pessoa.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-novian-muted bg-novian-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-novian-muted/50 bg-novian-primary/30 px-6 py-5">
          <div className="text-xs uppercase tracking-[0.18em] text-novian-text/45">
            {person ? "Editar Contato" : mode === "crm" ? "Novo Contato CRM" : "Novo Contato"}
          </div>
          <div className="mt-2 text-2xl font-semibold text-novian-text">
            {person ? person.fullName : mode === "crm" ? "Adicionar contato ao relacionamento comercial" : "Cadastrar contato"}
          </div>
        </div>

        <form id="person-drawer-form" onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mb-6 flex flex-wrap gap-2 border-b border-novian-muted/35 pb-4">
            {[
              { value: "profile" as const, label: "Perfil" },
              { value: "crm" as const, label: "CRM" },
              { value: "documents" as const, label: "Documentos", disabled: !person },
            ].map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  disabled={tab.disabled}
                  onClick={() => setActiveTab(tab.value)}
                  className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
                    active
                      ? "bg-novian-accent text-novian-primary"
                      : "border border-novian-muted/40 bg-novian-primary/25 text-novian-text/60 hover:text-novian-text"
                  } disabled:cursor-not-allowed disabled:opacity-45`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
          <div className="space-y-6">
            {activeTab === "profile" ? (
              <>
                <section className="space-y-4">
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-novian-accent">Contato</div>
                  <div>
                    <label className="mb-1 block text-xs text-novian-text/60">Nome completo</label>
                    <input
                      required
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-novian-text/60">WhatsApp</label>
                      <input
                        value={primaryPhone}
                        onChange={(event) => setPrimaryPhone(event.target.value)}
                        className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                        placeholder="5511999999999"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-novian-text/60">E-mail</label>
                      <input
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs text-novian-text/60">Origem do contato</label>
                      <input
                        value={origin}
                        onChange={(event) => setOrigin(event.target.value)}
                        className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-novian-text/60">Pontos</label>
                      <input
                        type="number"
                        value={stagePoints}
                        onChange={(event) => setStagePoints(Number(event.target.value || 0))}
                        className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs text-novian-text/60">Papel no negócio</label>
                    <RolePills value={roles} onChange={setRoles} />
                    <div className="mt-2 text-xs text-novian-text/42">
                      Escolha se o contato atua como comprador ou proprietário. O relacionamento comercial fica abaixo.
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-novian-text/60">Tags</label>
                    <input
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                      placeholder="vip, investidor, referral"
                    />
                  </div>
                </section>

                {customFields.length > 0 ? (
                  <section className="space-y-4">
                    <div className="text-sm font-semibold uppercase tracking-[0.16em] text-novian-accent">Campos Personalizados</div>
                    <div className="grid grid-cols-1 gap-4">
                      {customFields.map((field) => (
                        <div key={field.id}>
                          <label className="mb-1 block text-xs text-novian-text/60">{field.name}</label>
                          {field.type === "dropdown" ? (
                            <PopupSelect
                              value={metadataValues[field.id] || ""}
                              onChange={(value) =>
                                setMetadataValues((current) => ({
                                  ...current,
                                  [field.id]: value,
                                }))
                              }
                              options={(field.options || []).map((option) => ({ value: option, label: option }))}
                              buttonClassName="bg-novian-primary/40"
                            />
                          ) : (
                            <input
                              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                              value={metadataValues[field.id] || ""}
                              onChange={(event) =>
                                setMetadataValues((current) => ({
                                  ...current,
                                  [field.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}

            {activeTab === "crm" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-novian-accent">Relacionamento Comercial</div>
                  {mode !== "crm" ? (
                    <button
                      type="button"
                      onClick={() => setLeadEnabled((current) => !current)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                        leadEnabled
                          ? "bg-novian-accent/15 text-novian-accent"
                          : "bg-novian-primary/40 text-novian-text/55"
                      }`}
                    >
                      {leadEnabled ? "No funil" : "Fora do funil"}
                    </button>
                  ) : (
                    <div className="rounded-full bg-novian-accent/15 px-3 py-1.5 text-xs font-medium text-novian-accent">Sempre no funil no modo CRM</div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClient((current) => !current)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      isClient
                        ? "border-novian-accent bg-novian-accent/15 text-novian-accent"
                        : "border-novian-muted/40 bg-novian-primary/30 text-novian-text/60 hover:border-novian-accent/40 hover:text-novian-text"
                    }`}
                  >
                    Cliente
                  </button>
                </div>
                <div className="text-xs text-novian-text/42">
                  Papel define o lado do contato no negocio. Relacionamento define se ele esta no funil ou ja e cliente.
                </div>
                {leadEnabled || mode === "crm" ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs text-novian-text/60">Funil comercial</label>
                      <PopupSelect
                        value={leadFunnelId}
                        onChange={(value) => {
                          setLeadFunnelId(value);
                          const funnel = funnels.find((item) => item.id === value);
                          setLeadStatus(funnel?.columns[0]?.title || "");
                        }}
                        options={funnels.map((funnel) => ({ value: funnel.id, label: funnel.name }))}
                        buttonClassName="bg-novian-primary/40"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-novian-text/60">Score</label>
                      <input
                        type="number"
                        value={leadScore}
                        onChange={(event) => setLeadScore(Number(event.target.value || 0))}
                        className="w-full rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/50"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-xs text-novian-text/60">Etapa do relacionamento</label>
                      <PopupSelect
                        value={leadStatus}
                        onChange={setLeadStatus}
                        options={(selectedFunnel?.columns || []).map((column) => ({
                          value: column.title,
                          label: column.title,
                        }))}
                        buttonClassName="bg-novian-primary/40"
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {activeTab === "documents" ? (
              person ? (
                <DocumentsWorkspace
                  embedded
                  personId={person.id}
                  title="Documentos da pessoa"
                  description="Todos os arquivos relacionados a este contato, com upload direto dentro do cadastro."
                />
              ) : (
                <section className="rounded-[24px] border border-dashed border-novian-muted/35 bg-novian-primary/20 px-5 py-12 text-center text-sm text-novian-text/55">
                  Salve a pessoa primeiro para começar a anexar documentos.
                </section>
              )
            ) : null}
          </div>
        </form>

        <div className="border-t border-novian-muted/50 bg-novian-primary/20 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-4 py-2 text-sm text-novian-text/70 transition hover:bg-novian-primary/40 hover:text-novian-text"
            >
              Cancelar
            </button>
            {activeTab !== "documents" ? (
              <button
                type="submit"
                form="person-drawer-form"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-novian-accent px-4 py-2 text-sm font-semibold text-novian-primary transition hover:bg-white disabled:opacity-60"
              >
                <Save size={15} />
                {isSubmitting ? "Salvando..." : "Salvar Pessoa"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PeopleWorkspaceView({ mode = "people" }: { mode?: WorkspaceMode }) {
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState(mode === "crm" ? "lead" : "all");
  const [selectedTag, setSelectedTag] = useState("all");
  const [selectedStage, setSelectedStage] = useState("all");
  const [activeFunnelId, setActiveFunnelId] = useState("");
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);
  const [pendingDeletePerson, setPendingDeletePerson] = useState<PersonItem | null>(null);
  const [draggedPersonId, setDraggedPersonId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [isScrollingBoard, setIsScrollingBoard] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkTag, setBulkTag] = useState("");
  const [bulkRole, setBulkRole] = useState<PersonRole>("lead");
  const [bulkOrigin, setBulkOrigin] = useState("manual");
  const [bulkPoints, setBulkPoints] = useState(0);
  const [bulkLeadStage, setBulkLeadStage] = useState("");
  const [bulkLeadFunnelId, setBulkLeadFunnelId] = useState("");
  const [submittingBulk, setSubmittingBulk] = useState(false);
  const boardScrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingBoardScrollRef = useRef(false);
  const boardStartXRef = useRef(0);
  const boardScrollLeftRef = useRef(0);

  const pageCopy = mode === "crm"
    ? {
        eyebrow: "CRM View",
        title: "Leads como modo filtrado de People",
        description: "O CRM agora usa a mesma base de pessoas. Aqui voce enxerga apenas os contatos com lead vinculado ou perfil comercial.",
        createLabel: "Novo Lead",
      }
    : {
        eyebrow: "People CRM",
        title: "Base unica de pessoas",
        description: "Centraliza contatos como leads, clientes, compradores e vendedores sem duplicar a base. A configuracao do funil fica em Settings > Funis.",
        createLabel: "Nova Pessoa",
      };

  const loadPeople = async () => {
    const res = await fetch("/api/people", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load people");
    const data = await res.json();
    setPeople(Array.isArray(data.people) ? data.people : []);
    setAvailableTags(Array.isArray(data.tags) ? data.tags : []);
    setDuplicateGroups(Array.isArray(data.duplicateGroups) ? data.duplicateGroups : []);
  };

  const loadFunnels = async () => {
    const res = await fetch("/api/funnels?type=lead", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load funnels");
    const data = await res.json();
    const items = Array.isArray(data.funnels) ? data.funnels : [];
    setFunnels(items);
    setActiveFunnelId((current) => current || items[0]?.id || "");
    setBulkLeadFunnelId((current) => current || items[0]?.id || "");
  };

  const loadCustomFields = async () => {
    const res = await fetch("/api/custom-fields?targetEntity=people", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load custom fields");
    const data = await res.json();
    setCustomFields(Array.isArray(data.fields) ? data.fields : []);
  };

  const refreshAll = async () => {
    await loadPeople();
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        await Promise.all([loadPeople(), loadFunnels(), loadCustomFields()]);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const bulkLeadFunnel = funnels.find((funnel) => funnel.id === bulkLeadFunnelId) || funnels[0] || null;
  const activeFunnel = funnels.find((funnel) => funnel.id === activeFunnelId) || funnels[0] || null;

  useEffect(() => {
    if (!bulkLeadFunnel) return;
    if (!bulkLeadStage) {
      setBulkLeadStage(bulkLeadFunnel.columns[0]?.title || "");
    }
  }, [bulkLeadFunnel, bulkLeadStage]);

  const visiblePeople = useMemo(() => {
    const modeScoped = mode === "crm"
      ? people.filter((person) => person.lead || person.roles.includes("lead"))
      : people;

    return modeScoped.filter((person) => {
      const matchesRole = matchesSelectedGroup(person, selectedRole);
      const matchesTag = selectedTag === "all" || person.tags.includes(selectedTag);
      const matchesStage =
        selectedStage === "all" ||
        (person.lead?.status || "").toLowerCase() === selectedStage.toLowerCase();

      return matchesRole && matchesTag && matchesStage;
    });
  }, [people, mode, selectedRole, selectedTag, selectedStage]);

  const totalPages = Math.max(1, Math.ceil(visiblePeople.length / PEOPLE_PAGE_SIZE));
  const paginatedPeople = useMemo(() => {
    const start = (currentPage - 1) * PEOPLE_PAGE_SIZE;
    return visiblePeople.slice(start, start + PEOPLE_PAGE_SIZE);
  }, [currentPage, visiblePeople]);
  const pageStart = visiblePeople.length === 0 ? 0 : (currentPage - 1) * PEOPLE_PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PEOPLE_PAGE_SIZE, visiblePeople.length);
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);

    if (currentPage <= 3) return [1, 2, 3, 4, totalPages];
    if (currentPage >= totalPages - 2) return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, currentPage - 1, currentPage, currentPage + 1, totalPages];
  }, [currentPage, totalPages]);
  const allVisibleSelected = paginatedPeople.length > 0 && paginatedPeople.every((person) => selectedIds.has(person.id));
  const boardColumns = useMemo(() => {
    const stageColumns = (activeFunnel?.columns || []).map((column) => ({
      id: column.id,
      title: column.title,
      color: column.color,
      people: visiblePeople.filter((person) => (person.lead?.status || "").toLowerCase() === column.title.toLowerCase()),
    }));

    const uncategorizedPeople = visiblePeople.filter((person) => {
      const currentStatus = (person.lead?.status || "").toLowerCase();
      return !stageColumns.some((column) => column.title.toLowerCase() === currentStatus);
    });

    if (uncategorizedPeople.length > 0 || stageColumns.length === 0) {
      return [
        {
          id: "uncategorized",
          title: "Sem etapa",
          color: "#73837f",
          people: uncategorizedPeople,
        },
        ...stageColumns,
      ];
    }

    return stageColumns;
  }, [activeFunnel, visiblePeople]);
  const activeFilterCount = [
    selectedRole !== "all",
    selectedTag !== "all",
    selectedStage !== "all",
    Boolean(activeFunnelId && activeFunnelId !== (funnels[0]?.id || "")),
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedRole(mode === "crm" ? "lead" : "all");
    setSelectedTag("all");
    setSelectedStage("all");
    setActiveFunnelId(funnels[0]?.id || "");
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [mode, selectedRole, selectedTag, selectedStage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (viewMode === "board" && selectedIds.size > 0) {
      setSelectedIds(new Set());
    }
  }, [selectedIds, viewMode]);

  useEffect(() => {
    if (viewMode !== "board") {
      setDraggedPersonId(null);
      setDragOverColumnId(null);
      setIsScrollingBoard(false);
      isDraggingBoardScrollRef.current = false;
    }
  }, [viewMode]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-person-row-menu]")) return;
      setOpenRowMenuId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        paginatedPeople.forEach((person) => next.delete(person.id));
        return next;
      });
      return;
    }

    setSelectedIds((current) => new Set([...current, ...paginatedPeople.map((person) => person.id)]));
  };

  const toggleOne = (personId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  const executeMerge = async (primaryPersonId: string, duplicatePersonIds: string[]) => {
    const res = await fetch("/api/people/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryPersonId,
        duplicatePersonIds,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || "Nao foi possivel mesclar as pessoas.");
    }

    setSelectedIds(new Set());
    await refreshAll();
  };

  const mergeGroup = async (group: DuplicateGroup) => {
    if (!confirm(`Mesclar ${group.people.length} registros deste grupo em uma pessoa principal?`)) {
      return;
    }

    const primary = group.people[0];
    await executeMerge(primary.id, group.people.slice(1).map((person) => person.id));
  };

  const mergeSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    if (!confirm(`Mesclar ${ids.length} pessoas selecionadas em um unico cadastro?`)) return;

    const primary = selectedPerson && selectedIds.has(selectedPerson.id)
      ? selectedPerson.id
      : ids[0];

    await executeMerge(primary, ids.filter((id) => id !== primary));
  };

  const deletePerson = async (person: PersonItem) => {
    setDeletingPersonId(person.id);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(person.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel excluir a pessoa.");
      }

      setOpenRowMenuId(null);
      setPendingDeletePerson(null);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(person.id);
        return next;
      });
      if (selectedPerson?.id === person.id) {
        setSelectedPerson(null);
        setDrawerOpen(false);
      }
      await refreshAll();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel excluir a pessoa.");
    } finally {
      setDeletingPersonId(null);
    }
  };

  const handleBoardMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('[draggable="true"]') || target.closest("[data-person-row-menu]")) return;
    if (!boardScrollContainerRef.current) return;

    isDraggingBoardScrollRef.current = true;
    boardStartXRef.current = event.pageX - boardScrollContainerRef.current.offsetLeft;
    boardScrollLeftRef.current = boardScrollContainerRef.current.scrollLeft;
    boardScrollContainerRef.current.style.cursor = "grabbing";
    boardScrollContainerRef.current.style.userSelect = "none";
  };

  const stopBoardScrollDrag = () => {
    isDraggingBoardScrollRef.current = false;
    setIsScrollingBoard(false);
    if (boardScrollContainerRef.current) {
      boardScrollContainerRef.current.style.cursor = "grab";
      boardScrollContainerRef.current.style.userSelect = "auto";
    }
  };

  const handleBoardMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingBoardScrollRef.current || !boardScrollContainerRef.current) return;

    event.preventDefault();
    if (!isScrollingBoard) setIsScrollingBoard(true);

    const x = event.pageX - boardScrollContainerRef.current.offsetLeft;
    const walk = (x - boardStartXRef.current) * 1.5;
    boardScrollContainerRef.current.scrollLeft = boardScrollLeftRef.current - walk;
  };

  const handleCardDragStart = (event: React.DragEvent<HTMLDivElement>, personId: string) => {
    if (isScrollingBoard || isDraggingBoardScrollRef.current) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.setData("personId", personId);
    event.dataTransfer.effectAllowed = "move";
    setTimeout(() => setDraggedPersonId(personId), 0);
  };

  const handleCardDragEnd = () => {
    setDraggedPersonId(null);
    setDragOverColumnId(null);
  };

  const handleColumnDragOver = (event: React.DragEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const movePersonToBoardColumn = async (personId: string, columnTitle: string) => {
    const movingPerson = people.find((person) => person.id === personId);
    if (!movingPerson || !activeFunnel) return;
    if (!movingPerson.lead && !movingPerson.primaryPhone) {
      alert("Essa pessoa precisa ter telefone principal para entrar no funil.");
      return;
    }
    if ((movingPerson.lead?.status || "") === columnTitle && (movingPerson.lead?.funnelId || activeFunnel.id) === activeFunnel.id) {
      return;
    }

    const optimisticLead = movingPerson.lead
      ? {
          ...movingPerson.lead,
          status: columnTitle,
          funnelId: activeFunnel.id,
          updatedAt: new Date().toISOString(),
        }
      : {
          id: `temp-${movingPerson.id}`,
          status: columnTitle,
          funnelId: activeFunnel.id,
          score: movingPerson.stagePoints,
          preview: movingPerson.lastInteractionPreview || null,
          unread: false,
          updatedAt: new Date().toISOString(),
        };

    setPeople((current) =>
      current.map((person) => (person.id === personId ? { ...person, lead: optimisticLead } : person)),
    );
    setSelectedPerson((current) => (current?.id === personId ? { ...current, lead: optimisticLead } : current));

    try {
      const res = await fetch(`/api/people/${encodeURIComponent(personId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createLead: !movingPerson.lead,
          leadFunnelId: activeFunnel.id,
          leadStatus: columnTitle,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel mover a pessoa de etapa.");
      }
    } catch (error) {
      console.error(error);
      await refreshAll();
      alert(error instanceof Error ? error.message : "Nao foi possivel mover a pessoa de etapa.");
    }
  };

  const handleColumnDrop = async (event: React.DragEvent<HTMLDivElement>, columnId: string, columnTitle: string) => {
    event.preventDefault();
    setDraggedPersonId(null);
    setDragOverColumnId(null);

    const personId = event.dataTransfer.getData("personId");
    if (!personId || columnId === "uncategorized") return;
    await movePersonToBoardColumn(personId, columnTitle);
  };

  const runBulkAction = async () => {
    if (!bulkAction || selectedIds.size === 0) return;

    setSubmittingBulk(true);
    try {
      const payload: Record<string, unknown> = {
        action: bulkAction,
        personIds: Array.from(selectedIds),
      };

      if (bulkAction === "add_tag" || bulkAction === "remove_tag") {
        payload.tag = bulkTag;
      }
      if (bulkAction === "add_role" || bulkAction === "remove_role") {
        payload.role = bulkRole;
      }
      if (bulkAction === "set_origin") {
        payload.origin = bulkOrigin;
      }
      if (bulkAction === "adjust_points") {
        payload.pointsDelta = bulkPoints;
      }
      if (bulkAction === "set_lead_stage") {
        payload.leadStatus = bulkLeadStage;
        payload.leadFunnelId = bulkLeadFunnelId;
      }

      const res = await fetch("/api/people/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel executar a acao em lote.");
      }

      setSelectedIds(new Set());
      await refreshAll();
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel executar a acao em lote.");
    } finally {
      setSubmittingBulk(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-novian-primary">
      <div className="mx-auto flex min-h-full w-full max-w-none flex-col gap-4 px-6 py-5">
        {duplicateGroups.length > 0 ? (
          <section className="rounded-[28px] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(16,32,29,0.12))] p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-200/75">
                  <CopyPlus size={14} />
                  Dedupe Center
                </div>
                <div className="mt-2 text-lg font-semibold text-novian-text">Sugestoes de mesclagem</div>
                <div className="mt-1 text-sm text-novian-text/55">Agrupamentos com mesmo telefone ou e-mail para consolidar a base.</div>
              </div>
              <div className="rounded-full border border-amber-300/20 bg-amber-300/8 px-3 py-1.5 text-xs text-amber-100/85">
                {duplicateGroups.length} grupo(s) detectado(s)
              </div>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {duplicateGroups.map((group) => (
                <DuplicateCard key={group.key} group={group} onMerge={(item) => mergeGroup(item).catch((error) => {
                  console.error(error);
                  alert(error instanceof Error ? error.message : "Nao foi possivel mesclar.");
                })} />
              ))}
            </div>
          </section>
        ) : null}

        <div className="flex flex-1 flex-col">
          <section className="-mx-6 flex flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-end gap-2 border-b border-novian-muted/25 px-5 py-2">
              <div className="mr-auto -mb-px flex flex-wrap items-center gap-5">
                {PERSON_TYPE_TABS.map((tab) => {
                  const active = selectedRole === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setSelectedRole(tab.value)}
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
              <div className="inline-flex h-8 items-center rounded-full border border-white/8 bg-white/3 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] transition ${
                    viewMode === "board"
                      ? "bg-white/8 text-novian-text"
                      : "text-novian-text/44 hover:text-novian-text/72"
                  }`}
                >
                  <LayoutGrid size={11} />
                  Board
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] transition ${
                    viewMode === "grid"
                      ? "bg-white/8 text-novian-text"
                      : "text-novian-text/44 hover:text-novian-text/72"
                  }`}
                >
                  <Rows3 size={11} />
                  Grid
                </button>
              </div>
              <button
                onClick={() => setIsFilterDrawerOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/8 bg-white/3 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-novian-text/64 transition hover:border-novian-accent/35 hover:text-novian-text"
              >
                <SlidersHorizontal size={12} />
                Filtros
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-novian-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-normal text-novian-primary">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              {selectedIds.size >= 2 ? (
                <button
                  onClick={() => mergeSelected().catch((error) => {
                    console.error(error);
                    alert(error instanceof Error ? error.message : "Nao foi possivel mesclar.");
                  })}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200 transition hover:bg-amber-300/15"
                >
                  <GitMerge size={12} />
                  Mesclar
                </button>
              ) : null}
              <button
                onClick={() => {
                  setSelectedPerson(null);
                  setDrawerOpen(true);
                }}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full bg-novian-accent px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-novian-primary transition hover:bg-white"
              >
                <Plus size={12} />
                {pageCopy.createLabel}
              </button>
            </div>
            {viewMode === "grid" && selectedIds.size > 0 ? (
              <div className="flex flex-col gap-3 border-b border-novian-muted/30 bg-novian-primary/18 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-novian-text/75">
                    <span className="font-semibold text-novian-text">{selectedIds.size}</span> pessoa(s) selecionada(s)
                  </div>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-novian-text/55 transition hover:text-novian-text"
                  >
                    Limpar selecao
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
                  <PopupSelect
                    value={bulkAction}
                    onChange={setBulkAction}
                    options={BULK_ACTION_OPTIONS}
                    buttonClassName="bg-novian-surface/45"
                  />

                  {bulkAction === "add_tag" || bulkAction === "remove_tag" ? (
                    <input
                      value={bulkTag}
                      onChange={(event) => setBulkTag(event.target.value)}
                      placeholder="tag"
                      className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                    />
                  ) : null}

                  {bulkAction === "add_role" || bulkAction === "remove_role" ? (
                    <PopupSelect
                      value={bulkRole}
                      onChange={(value) => setBulkRole(value as PersonRole)}
                      options={ROLE_OPTIONS.map((role) => ({ value: role.value, label: role.label }))}
                      buttonClassName="bg-novian-surface/45"
                    />
                  ) : null}

                  {bulkAction === "set_origin" ? (
                    <input
                      value={bulkOrigin}
                      onChange={(event) => setBulkOrigin(event.target.value)}
                      placeholder="origem"
                      className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                    />
                  ) : null}

                  {bulkAction === "adjust_points" ? (
                    <input
                      type="number"
                      value={bulkPoints}
                      onChange={(event) => setBulkPoints(Number(event.target.value || 0))}
                      placeholder="delta"
                      className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                    />
                  ) : null}

                  {bulkAction === "set_lead_stage" ? (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <PopupSelect
                        value={bulkLeadFunnelId}
                        onChange={setBulkLeadFunnelId}
                        options={funnels.map((funnel) => ({ value: funnel.id, label: funnel.name }))}
                        buttonClassName="bg-novian-surface/45"
                      />
                      <PopupSelect
                        value={bulkLeadStage}
                        onChange={setBulkLeadStage}
                        options={(bulkLeadFunnel?.columns || []).map((column) => ({ value: column.title, label: column.title }))}
                        buttonClassName="bg-novian-surface/45"
                      />
                    </div>
                  ) : null}

                  {!bulkAction ? <div className="rounded-2xl border border-dashed border-novian-muted/25 bg-transparent px-4 py-3 text-sm text-novian-text/35">Escolha uma acao em lote.</div> : null}

                  <button
                    onClick={() => runBulkAction().catch((error) => {
                      console.error(error);
                      alert(error instanceof Error ? error.message : "Nao foi possivel executar a acao em lote.");
                    })}
                    disabled={!bulkAction || submittingBulk}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-novian-accent px-4 py-3 text-sm font-semibold text-novian-primary transition hover:bg-white disabled:opacity-60"
                  >
                    <ChevronsRight size={15} />
                    {submittingBulk ? "Executando..." : "Aplicar"}
                  </button>
                </div>
              </div>
            ) : null}

            {viewMode === "grid" ? (
              <>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full min-w-[1120px] text-left text-sm text-novian-text">
                    <thead className="border-b border-novian-muted/30 text-[11px] uppercase tracking-[0.18em] text-novian-text/42">
                      <tr>
                        <th className="px-4 py-3 text-center">
                          <button
                            onClick={toggleAllVisible}
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border transition ${
                              allVisibleSelected
                                ? "border-novian-accent bg-novian-accent text-novian-primary"
                                : "border-novian-muted/40 bg-transparent text-transparent"
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </button>
                        </th>
                        <th className="px-5 py-3">Contato</th>
                        <th className="px-5 py-3">Papel</th>
                        <th className="px-5 py-3">Tags</th>
                        <th className="px-5 py-3">Relacionamento</th>
                        <th className="px-5 py-3 text-right">Pontos</th>
                        <th className="px-4 py-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-14 text-center text-novian-text/50">
                            Carregando pessoas...
                          </td>
                        </tr>
                      ) : visiblePeople.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-14 text-center text-novian-text/50">
                            Nenhuma pessoa encontrada com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        paginatedPeople.map((person) => {
                          const isSelected = selectedIds.has(person.id);
                          const businessRoles = getBusinessRoles(person.roles);
                          const relationshipState = getRelationshipState(person);
                          const avatarUrl = getPersonAvatarUrl(person);
                          return (
                            <tr
                              key={person.id}
                              onClick={() => {
                                setSelectedPerson(person);
                                setDrawerOpen(true);
                              }}
                              className={`cursor-pointer border-b border-novian-muted/20 transition hover:bg-novian-primary/25 ${isSelected ? "bg-novian-accent/5" : ""}`}
                            >
                              <td className="px-4 py-3.5 text-center">
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleOne(person.id);
                                  }}
                                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded-[6px] border transition ${
                                    isSelected
                                      ? "border-novian-accent bg-novian-accent text-novian-primary"
                                      : "border-novian-muted/40 bg-transparent text-transparent"
                                  }`}
                                >
                                  <Check size={12} strokeWidth={3} />
                                </button>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-novian-muted/30 bg-novian-primary/30 text-novian-accent">
                                    {avatarUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={avatarUrl}
                                        alt={person.fullName}
                                        className="h-full w-full rounded-2xl object-cover"
                                      />
                                    ) : (
                                      <UserRound size={16} />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-novian-text">{person.fullName}</div>
                                    <div className="truncate text-xs text-novian-text/55">
                                      {person.primaryPhone || "Sem telefone"} {person.email ? `· ${person.email}` : ""}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {businessRoles.length > 0 ? (
                                    businessRoles.map((role) => (
                                      <span key={role} className="rounded-md bg-novian-accent/10 px-2 py-1 text-[11px] text-novian-accent">
                                        {getRoleLabel(role)}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-xs text-novian-text/28">-</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex max-w-[260px] flex-wrap gap-1.5">
                                  {person.tags.length > 0 ? (
                                    person.tags.slice(0, 4).map((tag) => (
                                      <span key={tag} className="rounded-md bg-white/4 px-2 py-1 text-[11px] text-novian-text/52">
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
                                  <div className="font-medium text-novian-text">{relationshipState.label}</div>
                                  <div className="mt-1 text-xs text-novian-text/55">
                                    {relationshipState.detail}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="inline-flex rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                                  {person.stagePoints} pts
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                <div
                                  data-person-row-menu
                                  className="relative inline-flex"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => setOpenRowMenuId((current) => current === person.id ? null : person.id)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-novian-text/38 transition hover:border-white/8 hover:bg-white/3 hover:text-novian-text/72"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openRowMenuId === person.id ? (
                                    <div className="absolute right-0 top-10 z-20 min-w-[148px] rounded-2xl border border-white/8 bg-[#0d221f]/95 p-1.5 shadow-2xl shadow-black/35 backdrop-blur-xl">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedPerson(person);
                                          setDrawerOpen(true);
                                          setOpenRowMenuId(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-novian-text/76 transition hover:bg-white/5 hover:text-novian-text"
                                      >
                                        <Pencil size={13} />
                                        Editar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPendingDeletePerson(person);
                                          setOpenRowMenuId(null);
                                        }}
                                        disabled={deletingPersonId === person.id}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-300/88 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-60"
                                      >
                                        <Trash2 size={13} />
                                        {deletingPersonId === person.id ? "Excluindo..." : "Excluir"}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-novian-muted/25 px-5 py-3">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-novian-text/34">
                    {loading ? "Carregando registros" : `${pageStart}-${pageEnd} de ${visiblePeople.length} registros`}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={currentPage === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/6 bg-white/2 text-novian-text/55 transition hover:border-white/12 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <div className="flex items-center gap-1">
                      {pageNumbers.map((page, index) => {
                        const previousPage = pageNumbers[index - 1];
                        const showGap = previousPage && page - previousPage > 1;

                        return (
                          <div key={page} className="flex items-center gap-1">
                            {showGap ? (
                              <span className="px-1 text-[10px] uppercase tracking-[0.12em] text-novian-text/26">...</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-[10px] font-medium uppercase tracking-[0.12em] transition ${
                                currentPage === page
                                  ? "border border-novian-accent/30 bg-novian-accent/12 text-novian-text"
                                  : "border border-transparent text-novian-text/42 hover:text-novian-text/72"
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                      disabled={currentPage === totalPages}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/6 bg-white/2 text-novian-text/55 transition hover:border-white/12 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div
                  ref={boardScrollContainerRef}
                  className="flex-1 overflow-x-auto cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  onMouseDown={handleBoardMouseDown}
                  onMouseLeave={stopBoardScrollDrag}
                  onMouseUp={stopBoardScrollDrag}
                  onMouseMove={handleBoardMouseMove}
                >
                  <div className={`flex h-full min-w-max gap-6 px-5 py-4 ${isScrollingBoard ? "pointer-events-none" : ""}`}>
                    {loading ? (
                      <div className="flex min-h-[280px] w-full items-center justify-center text-sm text-novian-text/50">
                        Carregando pessoas...
                      </div>
                    ) : boardColumns.length === 0 || visiblePeople.length === 0 ? (
                      <div className="flex min-h-[280px] w-full items-center justify-center text-sm text-novian-text/50">
                        Nenhuma pessoa encontrada com os filtros atuais.
                      </div>
                    ) : (
                      boardColumns.map((column) => (
                        <div
                          key={column.id}
                          className={`flex h-full w-80 shrink-0 flex-col rounded-2xl border bg-novian-surface/50 transition-colors ${
                            dragOverColumnId === column.id && column.id !== "uncategorized"
                              ? "border-novian-accent/50 bg-novian-surface"
                              : "border-novian-muted/30"
                          }`}
                          onDragOver={(event) => handleColumnDragOver(event, column.id)}
                          onDrop={(event) => void handleColumnDrop(event, column.id, column.title)}
                        >
                          <div className="flex items-center justify-between border-b border-novian-muted/30 px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-novian-text/78">{column.title}</div>
                            <div
                              className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.12em] ${getBoardColumnBadgeClass(column.color)}`}
                            >
                              {column.people.length}
                            </div>
                          </div>
                          <div className="flex-1 space-y-3 overflow-y-auto p-4">
                            {column.people.length === 0 ? (
                              <div className="flex min-h-[120px] items-center justify-center rounded-[20px] border border-dashed border-white/6 bg-black/5 text-xs text-novian-text/30">
                                Sem contatos nesta etapa
                              </div>
                            ) : (
                              column.people.map((person) => {
                                const businessRoles = getBusinessRoles(person.roles);
                                const relationshipState = getRelationshipState(person);
                                const avatarUrl = getPersonAvatarUrl(person);
                                const canDragCard = column.id !== "uncategorized" || Boolean(person.lead || person.primaryPhone);
                                return (
                                  <div
                                    key={person.id}
                                    draggable={canDragCard}
                                    onDragStart={(event) => handleCardDragStart(event, person.id)}
                                    onDragEnd={handleCardDragEnd}
                                    onClick={() => {
                                      setSelectedPerson(person);
                                      setDrawerOpen(true);
                                    }}
                                    className={`group rounded-xl border bg-novian-surface p-4 shadow-sm transition ${
                                      canDragCard ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
                                    } ${
                                      draggedPersonId === person.id
                                        ? "border-novian-accent opacity-50"
                                        : "border-novian-muted/50 hover:border-novian-accent/50"
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-novian-muted/30 bg-novian-primary/30 text-novian-accent">
                                        {avatarUrl ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={avatarUrl}
                                            alt={person.fullName}
                                            className="h-full w-full rounded-2xl object-cover"
                                          />
                                        ) : (
                                          <UserRound size={16} />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <div className="truncate font-semibold text-novian-text">{person.fullName}</div>
                                            <div className="mt-1 truncate text-xs text-novian-text/52">
                                              {person.primaryPhone || person.email || "Sem contato principal"}
                                            </div>
                                          </div>
                                          <div
                                            data-person-row-menu
                                            className="relative shrink-0"
                                            onClick={(event) => event.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => setOpenRowMenuId((current) => current === person.id ? null : person.id)}
                                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-novian-text/55 transition hover:bg-white/10 hover:text-novian-text"
                                            >
                                              <MoreHorizontal size={13} />
                                            </button>
                                            {openRowMenuId === person.id ? (
                                              <div className="absolute right-0 top-9 z-20 min-w-[148px] rounded-2xl border border-white/8 bg-[#0d221f]/95 p-1.5 shadow-2xl shadow-black/35 backdrop-blur-xl">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setSelectedPerson(person);
                                                    setDrawerOpen(true);
                                                    setOpenRowMenuId(null);
                                                  }}
                                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-novian-text/76 transition hover:bg-white/5 hover:text-novian-text"
                                                >
                                                  <Pencil size={13} />
                                                  Editar
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPendingDeletePerson(person);
                                                    setOpenRowMenuId(null);
                                                  }}
                                                  disabled={deletingPersonId === person.id}
                                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-red-300/88 transition hover:bg-red-400/10 hover:text-red-200 disabled:opacity-60"
                                                >
                                                  <Trash2 size={13} />
                                                  {deletingPersonId === person.id ? "Excluindo..." : "Excluir"}
                                                </button>
                                              </div>
                                            ) : null}
                                          </div>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                          {businessRoles.length > 0 ? (
                                            businessRoles.map((role) => (
                                              <span key={role} className="rounded-md bg-novian-accent/10 px-2 py-1 text-[11px] text-novian-accent">
                                                {getRoleLabel(role)}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="rounded-md bg-white/4 px-2 py-1 text-[11px] text-novian-text/38">
                                              Sem papel
                                            </span>
                                          )}
                                          {person.tags.slice(0, 2).map((tag) => (
                                            <span key={tag} className="rounded-md bg-white/4 px-2 py-1 text-[11px] text-novian-text/52">
                                              {tag}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-novian-muted/30 pt-3">
                                      <div>
                                        <div className="text-[10px] uppercase tracking-[0.14em] text-novian-text/34">
                                          Relacionamento
                                        </div>
                                        <div className="mt-1 text-sm font-medium text-novian-text">{relationshipState.label}</div>
                                      </div>
                                      <span className="inline-flex rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-semibold text-yellow-300">
                                        {person.stagePoints} pts
                                      </span>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>

      </div>

      <PersonDrawer
        open={drawerOpen}
        person={selectedPerson}
        funnels={funnels}
        customFields={customFields}
        mode={mode}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          refreshAll().catch((error) => console.error(error));
        }}
      />
      <FilterDrawer
        open={isFilterDrawerOpen}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        selectedStage={selectedStage}
        setSelectedStage={setSelectedStage}
        activeFunnelId={activeFunnelId}
        setActiveFunnelId={setActiveFunnelId}
        availableTags={availableTags}
        funnels={funnels}
        onClose={() => setIsFilterDrawerOpen(false)}
        onReset={resetFilters}
      />
      {pendingDeletePerson ? (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onClick={() => {
            if (deletingPersonId) return;
            setPendingDeletePerson(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d221f]/96 p-6 shadow-2xl shadow-black/45 backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
                <AlertTriangle size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-red-200/78">Excluir contato</div>
                <div className="mt-2 text-lg font-semibold text-novian-text">{pendingDeletePerson.fullName}</div>
                <div className="mt-2 text-sm leading-6 text-novian-text/62">
                  {pendingDeletePerson.lead || pendingDeletePerson.leadCount > 0
                    ? "Essa acao remove o contato e o lead vinculado. Nao pode ser desfeita."
                    : "Essa acao remove o contato da base e nao pode ser desfeita."}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDeletePerson(null)}
                disabled={Boolean(deletingPersonId)}
                className="rounded-2xl px-4 py-2 text-sm text-novian-text/70 transition hover:bg-white/5 hover:text-novian-text disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => deletePerson(pendingDeletePerson).catch((error) => console.error(error))}
                disabled={Boolean(deletingPersonId)}
                className="inline-flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/12 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-400/16 disabled:opacity-60"
              >
                <Trash2 size={15} />
                {deletingPersonId === pendingDeletePerson.id
                  ? "Excluindo..."
                  : pendingDeletePerson.lead || pendingDeletePerson.leadCount > 0
                    ? "Excluir contato e lead"
                    : "Excluir contato"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
