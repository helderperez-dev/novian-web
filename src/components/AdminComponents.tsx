"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, MessageSquare, Users, BarChart3, Settings, Bell, Search, Plus, MapPin, LoaderCircle, QrCode, ChevronLeft, ChevronRight, MoreHorizontal, Calendar, WandSparkles, Flame, Filter, LayoutGrid, List, Check, Home as HomeIcon, Edit, Trash2, Target, Bot, GripVertical, FileText, Lock, Bold, Italic, Type } from "lucide-react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { createLeadNote, getLeadNotes, LEAD_NOTES_KEY, upsertLeadNotes, type LeadNote, type LeadNoteVisibility } from "@/lib/leadNotes";
import type { ChatMessage, Thread, AgentConfig, Funnel as StoreFunnel, FunnelType, Property, CustomField } from "@/lib/store";
import { customFieldsStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import DocumentsWorkspace from "@/components/DocumentsWorkspace";
import ImageGalleryUploader from "@/components/ImageGalleryUploader";
import FunnelAutomationSettings from "@/components/FunnelAutomationSettings";
import PopupSelect from "@/components/PopupSelect";
import { CaptacaoLayout } from "@/components/CaptacaoLayout";
import AccountProfileForm from "@/components/AccountProfileForm";
import type { Database } from "@/lib/database.types";
import { Funnel as RechartsFunnel, FunnelChart, Tooltip, Cell, LabelList, ResponsiveContainer } from "recharts";

type ManagedAppUser = Database["public"]["Tables"]["app_users"]["Row"];
type ManagedUserRole = Database["public"]["Enums"]["app_role"];
type ManagedUserType = Database["public"]["Enums"]["app_user_type"];
type DashboardBreakdownItem = { label: string; count: number; color?: string | null };
type DashboardRecentCaptacaoItem = { id: string; title: string; status: string; source: string; createdAt: string };
type DashboardRecentPropertyItem = { id: string; title: string; status: string; price: number; address: string };
type DashboardRecentClientProcessItem = { id: string; title: string; status: string; updated_at: string };
type DashboardPayload = {
  overview: {
    crmLeads: number;
    crmFunnels: number;
    captacaoLeads: number;
    captacaoFunnels: number;
    totalProperties: number;
    activeProperties: number;
    internalUsers: number;
    clients: number;
    clientProcesses: number;
    clientDocuments: number;
    totalMessages: number;
  };
  crmStatusBreakdown: DashboardBreakdownItem[];
  captacaoStatusBreakdown: DashboardBreakdownItem[];
  propertyStatusBreakdown: DashboardBreakdownItem[];
  clientProcessBreakdown: DashboardBreakdownItem[];
  recentCaptacao: DashboardRecentCaptacaoItem[];
  recentProperties: DashboardRecentPropertyItem[];
  recentClientProcesses: DashboardRecentClientProcessItem[];
};

const getUserInitials = (user: ManagedAppUser | null) => {
  const base = user?.full_name?.trim() || user?.email?.trim() || "";
  if (!base) return "NV";

  const parts = base.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NV";
};

const getUserRoleLabel = (user: ManagedAppUser | null) => {
  if (!user) return "Carregando...";
  if (user.role === "admin") return "Admin";
  if (user.role === "broker") return "Corretor";
  return "Cliente";
};

const getDashboardLabel = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized === "active") return "Ativo";
  if (normalized === "inactive") return "Inativo";
  if (normalized === "sold") return "Vendido";
  if (normalized === "unassigned") return "Sem etapa";
  if (normalized === "pending") return "Pendente";
  return label;
};

const getStageTheme = (color?: string | null) => {
  const normalized = String(color || "").toLowerCase();

  if (normalized.includes("purple")) {
    return {
      border: "rgba(168, 85, 247, 0.28)",
      background: "rgba(168, 85, 247, 0.12)",
      accent: "#c084fc",
      badgeBackground: "rgba(168, 85, 247, 0.18)",
      badgeBorder: "rgba(168, 85, 247, 0.32)",
      text: "#e9d5ff",
    };
  }

  if (normalized.includes("yellow")) {
    return {
      border: "rgba(234, 179, 8, 0.28)",
      background: "rgba(234, 179, 8, 0.12)",
      accent: "#facc15",
      badgeBackground: "rgba(234, 179, 8, 0.18)",
      badgeBorder: "rgba(234, 179, 8, 0.32)",
      text: "#fef08a",
    };
  }

  if (normalized.includes("orange")) {
    return {
      border: "rgba(249, 115, 22, 0.28)",
      background: "rgba(249, 115, 22, 0.12)",
      accent: "#fb923c",
      badgeBackground: "rgba(249, 115, 22, 0.18)",
      badgeBorder: "rgba(249, 115, 22, 0.32)",
      text: "#fdba74",
    };
  }

  if (normalized.includes("green")) {
    return {
      border: "rgba(34, 197, 94, 0.28)",
      background: "rgba(34, 197, 94, 0.12)",
      accent: "#4ade80",
      badgeBackground: "rgba(34, 197, 94, 0.18)",
      badgeBorder: "rgba(34, 197, 94, 0.32)",
      text: "#bbf7d0",
    };
  }

  if (normalized.includes("red")) {
    return {
      border: "rgba(239, 68, 68, 0.28)",
      background: "rgba(239, 68, 68, 0.12)",
      accent: "#f87171",
      badgeBackground: "rgba(239, 68, 68, 0.18)",
      badgeBorder: "rgba(239, 68, 68, 0.32)",
      text: "#fecaca",
    };
  }

  return {
    border: "rgba(59, 130, 246, 0.28)",
    background: "rgba(59, 130, 246, 0.12)",
    accent: "#60a5fa",
    badgeBackground: "rgba(59, 130, 246, 0.18)",
    badgeBorder: "rgba(59, 130, 246, 0.32)",
    text: "#bfdbfe",
  };
};

type LeadDetailItem = {
  label: string;
  value: string;
  href?: string;
};

type LeadContextTab = "overview" | "notes";
type LiveWhatsAppProfilePayload = {
  jid?: string | null;
  phone?: string | null;
  displayName?: string | null;
  pushName?: string | null;
  profilePictureUrl?: string | null;
  about?: string | null;
  businessDescription?: string | null;
  businessCategory?: string | null;
  businessEmail?: string | null;
  businessWebsite?: string | null;
  businessAddress?: string | null;
};
type LiveThreadWhatsAppProfile = {
  threadId: string;
  phone: string | null;
  profile: LiveWhatsAppProfilePayload | null;
};

const getLeadPhoneValue = (thread: Pick<Thread, "phone" | "id">) => {
  const phone = thread.phone?.trim();
  if (phone) {
    return phone;
  }

  if (thread.id.endsWith("@s.whatsapp.net")) {
    return thread.id.split("@")[0];
  }

  return "";
};

const normalizeLeadDetailValue = (value: NonNullable<Thread["customData"]>[string]) => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  return "";
};

const getLeadMetadataDetails = (customData?: Thread["customData"]): LeadDetailItem[] => {
  if (!customData) {
    return [];
  }

  const detailSpecs: Array<{
    key: string;
    label: string;
    href?: (value: string) => string;
  }> = [
    { key: "source", label: "Origem" },
    { key: "whatsapp_jid", label: "WhatsApp ID" },
    { key: "whatsapp_business_category", label: "Categoria WA" },
    { key: "whatsapp_business_email", label: "E-mail", href: (value) => `mailto:${value}` },
    {
      key: "whatsapp_business_website",
      label: "Website",
      href: (value) => (value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`),
    },
    { key: "whatsapp_business_address", label: "Endereco" },
  ];

  return detailSpecs.reduce<LeadDetailItem[]>((items, detail) => {
    const value = normalizeLeadDetailValue(customData[detail.key]);
    if (!value) {
      return items;
    }

    items.push({
      label: detail.label,
      value,
      href: detail.href ? detail.href(value) : undefined,
    });

    return items;
  }, []);
};

const getLeadCustomEntries = (customData?: Thread["customData"]) => {
  if (!customData) {
    return [];
  }

  return Object.entries(customData).filter(
    ([key]) => !key.startsWith("whatsapp_") && key !== LEAD_NOTES_KEY,
  );
};

const mergeThreadCustomDataWithLiveProfile = (
  customData: Thread["customData"] | undefined,
  liveProfile: LiveThreadWhatsAppProfile | null,
) => {
  const merged: Record<string, unknown> = { ...(customData || {}) };
  const profile = liveProfile?.profile;

  if (!profile) {
    return merged;
  }

  if (typeof profile.jid === "string" && profile.jid) {
    merged.whatsapp_jid = profile.jid;
  }
  if (typeof profile.phone === "string" && profile.phone) {
    merged.whatsapp_phone = profile.phone;
  }
  if (typeof profile.displayName === "string" && profile.displayName) {
    merged.whatsapp_profile_name = profile.displayName;
  }
  if (typeof profile.pushName === "string" && profile.pushName) {
    merged.whatsapp_push_name = profile.pushName;
  }
  if (typeof profile.profilePictureUrl === "string" && profile.profilePictureUrl) {
    merged.whatsapp_profile_picture_url = profile.profilePictureUrl;
  }
  if (typeof profile.about === "string" && profile.about) {
    merged.whatsapp_about = profile.about;
  }
  if (typeof profile.businessDescription === "string" && profile.businessDescription) {
    merged.whatsapp_business_description = profile.businessDescription;
  }
  if (typeof profile.businessCategory === "string" && profile.businessCategory) {
    merged.whatsapp_business_category = profile.businessCategory;
  }
  if (typeof profile.businessEmail === "string" && profile.businessEmail) {
    merged.whatsapp_business_email = profile.businessEmail;
  }
  if (typeof profile.businessWebsite === "string" && profile.businessWebsite) {
    merged.whatsapp_business_website = profile.businessWebsite;
  }
  if (typeof profile.businessAddress === "string" && profile.businessAddress) {
    merged.whatsapp_business_address = profile.businessAddress;
  }

  return merged;
};

const getThreadDisplayTitle = (thread: Thread, liveProfile: LiveThreadWhatsAppProfile | null) => {
  const profile = liveProfile?.profile;

  if (typeof profile?.displayName === "string" && profile.displayName.trim()) {
    return profile.displayName.trim();
  }

  if (typeof profile?.pushName === "string" && profile.pushName.trim()) {
    return profile.pushName.trim();
  }

  return thread.title;
};

const getThreadDisplayPhone = (thread: Thread, liveProfile: LiveThreadWhatsAppProfile | null) => {
  const livePhone =
    (typeof liveProfile?.profile?.phone === "string" && liveProfile.profile.phone.trim()) ||
    (typeof liveProfile?.phone === "string" && liveProfile.phone.trim()) ||
    "";

  return livePhone || getLeadPhoneValue(thread);
};

const formatNoteTimestamp = (value: string) =>
  new Date(value).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function LeadContextTabs({
  value,
  onChange,
}: {
  value: LeadContextTab;
  onChange: (value: LeadContextTab) => void;
}) {
  const tabs: Array<{ id: LeadContextTab; label: string; icon: typeof Bot }> = [
    { id: "overview", label: "Resumo", icon: MessageSquare },
    { id: "notes", label: "Notas", icon: FileText },
  ];

  return (
    <div className="border-b border-novian-muted/30">
      <div className="flex items-center gap-6 overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = value === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              isActive
                ? "border-novian-accent text-novian-text"
                : "border-transparent text-novian-text/50 hover:text-novian-text/80"
            }`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}

function LeadNotesPanel({
  leadId,
  customData,
  onSaved,
}: {
  leadId?: string;
  customData?: Thread["customData"];
  onSaved?: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<LeadNoteVisibility>("ai");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const notes = getLeadNotes(customData as Record<string, unknown> | null | undefined);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-note-menu-root='true']")) {
        return;
      }

      setOpenMenuId(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenuId]);

  const resetComposer = () => {
    setDraft("");
    setVisibility("ai");
    setEditingNoteId(null);
  };

  const persistNotes = async (nextNotes: LeadNote[]) => {
    await fetch(`/api/leads/${encodeURIComponent(leadId ?? "")}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customData: upsertLeadNotes(customData as Record<string, unknown> | null | undefined, nextNotes),
      }),
    });
  };

  const handleEditNote = (note: LeadNote) => {
    setDraft(note.content);
    setVisibility(note.visibility);
    setEditingNoteId(note.id);
    setOpenMenuId(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!leadId) {
      return;
    }

    setIsSaving(true);

    try {
      const nextNotes = notes.filter((note) => note.id !== noteId);
      await persistNotes(nextNotes);

      if (editingNoteId === noteId) {
        resetComposer();
      }

      setOpenMenuId(null);
      await onSaved?.();
    } catch (error) {
      console.error("Failed to delete lead note", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNote = async () => {
    if (!leadId || !draft.trim()) {
      return;
    }

    setIsSaving(true);

    try {
      const nextNotes = editingNoteId
        ? notes.map((note) =>
            note.id === editingNoteId
              ? {
                  ...note,
                  content: draft.trim(),
                  visibility,
                  updatedAt: new Date().toISOString(),
                }
              : note,
          )
        : [
            createLeadNote({
              content: draft,
              visibility,
              author: "Equipe Novian",
            }),
            ...notes,
          ];

      await persistNotes(nextNotes);
      resetComposer();
      await onSaved?.();
    } catch (error) {
      console.error("Failed to save lead note", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-novian-muted/25 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setVisibility("ai")}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              visibility === "ai"
                ? "bg-novian-accent/15 text-novian-text"
                : "text-novian-text/50 hover:text-novian-text/80"
            }`}
          >
            IA
          </button>
          <button
            type="button"
            onClick={() => setVisibility("internal")}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              visibility === "internal"
                ? "bg-novian-accent/15 text-novian-text"
                : "text-novian-text/50 hover:text-novian-text/80"
            }`}
          >
            Interna
          </button>
          <span className="text-xs text-novian-text/45">
            {visibility === "ai" ? "A IA pode usar esta nota" : "Apenas equipe interna"}
          </span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-novian-text">
              {editingNoteId ? "Editar nota" : "Nova nota"}
            </p>
            <p className="text-xs text-novian-text/45">
              {editingNoteId
                ? "Atualize o texto ou troque a visibilidade da nota."
                : "Adicione contexto rapido para o time ou para a IA."}
            </p>
          </div>
          {editingNoteId ? (
            <button
              type="button"
              onClick={resetComposer}
              className="text-xs font-medium text-novian-text/55 transition hover:text-novian-text"
            >
              Cancelar
            </button>
          ) : null}
        </div>
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            visibility === "ai"
              ? "Ex.: Cliente prefere apartamento em Jundiai e aceita visita aos sabados."
              : "Ex.: Confirmar com o time comercial antes de oferecer condicoes especiais."
          }
          className="mt-4 min-h-[140px] w-full resize-none rounded-2xl border border-novian-muted/30 bg-novian-surface/10 px-4 py-3 text-sm leading-7 text-novian-text outline-none transition placeholder:text-novian-text/35 focus:border-novian-accent/35"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-novian-text/40">
            {editingNoteId
              ? "As alteracoes atualizam esta nota imediatamente."
              : visibility === "ai"
                ? "Visivel para a IA nas conversas."
                : "Visivel apenas para a equipe interna."}
          </p>
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={!leadId || !draft.trim() || isSaving}
            className="rounded-full bg-novian-accent px-4 py-2 text-sm font-semibold text-novian-primary transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Salvando..." : editingNoteId ? "Salvar alteracoes" : "Salvar"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-novian-text">Historico</span>
            <span className="rounded-full border border-novian-muted/25 px-2 py-0.5 text-[11px] text-novian-text/45">
              {notes.length}
            </span>
          </div>
          <p className="text-xs text-novian-text/40">Cada nota indica claramente quem pode usar a informacao.</p>
        </div>

        {notes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-novian-muted/30 px-4 py-5 text-center text-sm text-novian-text/40">
            Nenhuma nota cadastrada ainda.
          </div>
        ) : (
          notes.map((note) => {
            const isAiNote = note.visibility === "ai";
            const NoteIcon = isAiNote ? Bot : Lock;
            const badgeLabel = isAiNote ? "IA" : "Interna";
            const badgeTone = isAiNote
              ? "border-novian-accent/20 bg-novian-accent/10 text-novian-text"
              : "border-novian-muted/30 bg-novian-surface/25 text-novian-text/75";

            return (
              <div
                key={note.id}
                className={`rounded-xl border p-4 transition ${
                  editingNoteId === note.id
                    ? "border-novian-accent/35 bg-novian-surface/30"
                    : "border-novian-muted/25 bg-novian-surface/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${badgeTone}`}>
                        <NoteIcon size={12} />
                        {badgeLabel}
                      </span>
                      <p className="text-xs text-novian-text/45">
                        {isAiNote ? "Usada pela agente no WhatsApp" : "Visivel apenas para a equipe"}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-novian-text/55">
                      {note.author} · {formatNoteTimestamp(note.updatedAt)}
                    </p>
                  </div>
                  <div className="relative" data-note-menu-root="true">
                    <button
                      type="button"
                      onClick={() => setOpenMenuId((current) => (current === note.id ? null : note.id))}
                      aria-label="Acoes da nota"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === note.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-novian-text/45 transition hover:bg-novian-surface/25 hover:text-novian-text"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    {openMenuId === note.id ? (
                      <div className="absolute top-10 right-0 z-20 min-w-[150px] rounded-2xl border border-novian-muted/25 bg-novian-surface/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur">
                        <button
                          type="button"
                          onClick={() => handleEditNote(note)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-surface/40 hover:text-novian-text"
                        >
                          <Edit size={14} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note.id)}
                          disabled={isSaving}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-200 transition hover:bg-red-500/10 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Excluir
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7 text-novian-text/88">
                  {note.content}
                </p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

type RichTextAction = "heading" | "bold" | "italic" | "bullet" | "paragraph";
type AiAssistAction = "generate" | "enhance";
type AiAssistFormat = "plain_text" | "rich_html";

const RICH_TEXT_HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatInlineMarkdown(value: string) {
  return value
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function convertPlainTextToRichHtml(value: string) {
  const normalized = value.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "<p></p>";
  }

  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    const escaped = formatInlineMarkdown(escapeHtml(line));

    if (line.startsWith("## ")) {
      flushList();
      blocks.push(`<h2>${formatInlineMarkdown(escapeHtml(line.slice(3)))}</h2>`);
      continue;
    }

    if (line.startsWith("- ")) {
      listItems.push(formatInlineMarkdown(escapeHtml(line.slice(2))));
      continue;
    }

    flushList();
    blocks.push(`<p>${escaped}</p>`);
  }

  flushList();
  return blocks.join("");
}

function normalizeRichTextValue(value: string) {
  return RICH_TEXT_HTML_PATTERN.test(value) ? value : convertPlainTextToRichHtml(value);
}

function stripRichTextToPlainText(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function AiAssistMenuTrigger({
  onGenerate,
  onEnhance,
  onToggleMenu,
  isLoading,
  canEnhance = true,
  menuOpen = false,
  insideEditor = false,
}: {
  onGenerate: () => void;
  onEnhance: () => void;
  onToggleMenu: () => void;
  isLoading: boolean;
  canEnhance?: boolean;
  menuOpen?: boolean;
  insideEditor?: boolean;
}) {
  const wrapperClassName = insideEditor
    ? "absolute top-3 right-3 z-60"
    : "absolute inset-y-0 right-3 z-60 flex items-center";

  const triggerClassName = insideEditor
    ? "inline-flex h-8 w-8 items-center justify-center rounded-full border border-novian-muted/30 bg-novian-surface/88 text-novian-text/65 backdrop-blur transition hover:bg-novian-primary/60 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-45"
    : "inline-flex h-8 w-8 items-center justify-center rounded-full text-novian-text/55 transition hover:bg-novian-surface/50 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-45";

  if (isLoading) {
    return (
      <div className={wrapperClassName} onClick={(event) => event.stopPropagation()} data-ai-menu-root="true">
        <div className={triggerClassName} aria-hidden="true">
          <LoaderCircle size={14} className="animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={wrapperClassName} onClick={(event) => event.stopPropagation()} data-ai-menu-root="true">
      <button
        type="button"
        onClick={onToggleMenu}
        className={triggerClassName}
        aria-label="Opções de IA"
        title="Opções de IA"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        <WandSparkles size={14} />
      </button>
      {menuOpen ? (
        <div
          className={`absolute z-70 min-w-[160px] rounded-2xl border border-novian-muted/30 bg-novian-surface/95 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.24)] backdrop-blur ${
            insideEditor ? "top-10 right-0" : "top-[calc(100%+8px)] right-0"
          }`}
          role="menu"
        >
          <button
            type="button"
            onClick={onGenerate}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-primary/50 hover:text-novian-text"
            role="menuitem"
          >
            <WandSparkles size={14} />
            Criar com IA
          </button>
          <button
            type="button"
            onClick={onEnhance}
            disabled={!canEnhance}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-novian-text/80 transition hover:bg-novian-primary/50 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-45"
            role="menuitem"
          >
            <Edit size={14} />
            Melhorar
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AiInputField({
  label,
  name,
  value,
  onChange,
  onGenerate,
  onEnhance,
  onToggleMenu,
  isLoading,
  menuOpen,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onEnhance: () => void;
  onToggleMenu: () => void;
  isLoading: boolean;
  menuOpen: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-novian-text/70">{label}</label>
      <div className="relative overflow-visible">
        <input
          name={name}
          required={required}
          type="text"
          value={value}
          disabled={isLoading}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-novian-primary border border-novian-muted/50 rounded-xl px-3 py-2.5 pr-24 text-sm focus:border-novian-accent/50 outline-none disabled:cursor-not-allowed disabled:opacity-60"
          placeholder={placeholder}
        />
        <AiAssistMenuTrigger
          onGenerate={onGenerate}
          onEnhance={onEnhance}
          onToggleMenu={onToggleMenu}
          isLoading={isLoading}
          menuOpen={menuOpen}
          canEnhance={Boolean(value.trim())}
        />
      </div>
    </div>
  );
}

function RichTextEditor({
  label,
  name,
  value,
  onChange,
  required = false,
  minHeightClass = "min-h-56",
  onGenerate,
  onEnhance,
  onToggleMenu,
  isLoading = false,
  menuOpen = false,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  minHeightClass?: string;
  onGenerate: () => void;
  onEnhance: () => void;
  onToggleMenu: () => void;
  isLoading?: boolean;
  menuOpen?: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const nextHtml = normalizeRichTextValue(value);
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [value]);

  const exec = (command: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    if (isLoading) {
      return;
    }

    editor.focus();
    document.execCommand(command, false, commandValue);
    onChange(editor.innerHTML);
  };

  const applyRichText = (action: RichTextAction) => {
    if (action === "bold") {
      exec("bold");
      return;
    }

    if (action === "italic") {
      exec("italic");
      return;
    }

    if (action === "heading") {
      exec("formatBlock", "h2");
      return;
    }

    if (action === "bullet") {
      exec("insertUnorderedList");
      return;
    }

    exec("formatBlock", "p");
  };

  const actions: Array<{ id: RichTextAction; label: string; icon: typeof Type }> = [
    { id: "heading", label: "Titulo", icon: Type },
    { id: "bold", label: "Negrito", icon: Bold },
    { id: "italic", label: "Italico", icon: Italic },
    { id: "bullet", label: "Lista", icon: List },
    { id: "paragraph", label: "Paragrafo", icon: FileText },
  ];

  return (
    <div className="overflow-visible rounded-2xl border border-novian-muted/40 bg-novian-primary/35">
      <div className="flex min-w-0 flex-1 flex-col gap-3 border-b border-novian-muted/30 px-3 py-3">
        <label className="block text-xs font-medium text-novian-text/70">{label}</label>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => applyRichText(action.id)}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-novian-muted/30 px-3 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={action.label}
              title={action.label}
            >
              <action.icon size={14} />
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <input type="hidden" name={name} value={value} />

      <div className="relative overflow-visible">
        <AiAssistMenuTrigger
          insideEditor
          onGenerate={onGenerate}
          onEnhance={onEnhance}
          onToggleMenu={onToggleMenu}
          isLoading={isLoading}
          menuOpen={menuOpen}
          canEnhance={Boolean(stripRichTextToPlainText(value))}
        />
        <div
          ref={editorRef}
          contentEditable={!isLoading}
          suppressContentEditableWarning
          onInput={(event) => onChange((event.currentTarget as HTMLDivElement).innerHTML)}
          onPaste={(event) => {
            if (isLoading) {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            const text = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
          }}
          role="textbox"
          aria-multiline="true"
          data-required={required ? "true" : "false"}
          data-placeholder="Descreva o imovel com detalhes, diferenciais e contexto da localizacao."
          className={`prose prose-sm prose-invert max-w-none overflow-y-auto bg-transparent px-4 py-4 pr-24 text-novian-text outline-none before:pointer-events-none before:block before:text-novian-text/35 empty:before:content-[attr(data-placeholder)] prose-p:my-0 prose-p:leading-7 prose-headings:mb-3 prose-headings:mt-0 prose-headings:text-novian-text prose-strong:text-novian-text prose-li:my-1 prose-li:marker:text-novian-accent [&_ul]:pl-5 ${minHeightClass} ${isLoading ? "cursor-not-allowed opacity-55" : ""}`}
        />
        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 rounded-b-2xl bg-novian-primary/10 backdrop-blur-[1px]">
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function NewLeadForm({ onClose, onLeadCreated, initialData }: { onClose: () => void, onLeadCreated: () => void, initialData?: Thread }) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    if (initialData) {
      const data: Record<string, string> = {
        name: initialData.title || "",
        phone: initialData.phone || "",
      };
      if (initialData.customData) {
        Object.entries(initialData.customData).forEach(([key, val]) => {
          data[key] = String(val);
        });
      }
      return data;
    }
    return { name: "", phone: "" };
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const customData: Record<string, string> = {};
      Object.keys(formData).forEach(key => {
        if (key !== "name" && key !== "phone") {
          customData[key] = formData[key];
        }
      });

      if (initialData) {
        // Edit mode
        await fetch(`/api/leads/${encodeURIComponent(initialData.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.name,
            phone: formData.phone,
            customData,
          }),
        });
      } else {
        // Create mode
        await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            phone: formData.phone,
            customData,
          }),
        });
      }
      
      onLeadCreated(); // Refresh the parent's data
      onClose();
    } catch (err) {
      console.error("Error saving lead:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Standard Fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase mb-2">Informações Básicas</h3>
        
        <div>
          <label className="block text-xs text-novian-text/70 mb-1">Nome Completo *</label>
          <input 
            type="text" 
            required
            value={formData.name || ""}
            onChange={(e) => handleChange("name", e.target.value)}
            className="w-full bg-novian-surface/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:bg-novian-surface focus:ring-1 focus:ring-novian-accent/50 transition-all border border-novian-muted/50"
            placeholder="Ex: João da Silva"
          />
        </div>
        
        <div>
          <label className="block text-xs text-novian-text/70 mb-1">WhatsApp / Telefone *</label>
          <input 
            type="tel" 
            required
            value={formData.phone || ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full bg-novian-surface/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:bg-novian-surface focus:ring-1 focus:ring-novian-accent/50 transition-all border border-novian-muted/50"
            placeholder="Ex: 5511999999999"
          />
        </div>
      </div>

      {/* Custom Fields from Store */}
      <div className="space-y-4 pt-4 border-t border-novian-muted/30">
        <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase mb-2">Campos Personalizados</h3>
        
        {customFieldsStore.map((field) => (
          <div key={field.id}>
            <label className="block text-xs text-novian-text/70 mb-1">
              {field.name} {field.required && "*"}
            </label>
            
            {field.type === 'dropdown' ? (
              <PopupSelect
                value={String(formData[field.id] || "")}
                onChange={(value) => handleChange(field.id, value)}
                required={field.required}
                placeholder="Selecione..."
                buttonClassName="w-full bg-novian-surface/80 focus:bg-novian-surface focus:border-novian-accent/50"
                options={(field.options || []).map((opt) => ({ value: opt, label: opt }))}
              />
            ) : (
              <input 
                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} 
                required={field.required}
                value={formData[field.id] || ""}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="w-full bg-novian-surface/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:bg-novian-surface focus:ring-1 focus:ring-novian-accent/50 transition-all border border-novian-muted/50"
              />
            )}
          </div>
        ))}
      </div>

      <div className="pt-6 mt-6 border-t border-novian-muted/50 flex justify-end gap-3">
        <button 
          type="button" 
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-medium text-novian-text/70 hover:bg-novian-surface hover:text-novian-text transition-colors"
        >
          Cancelar
        </button>
        <button 
          type="submit"
          className="bg-novian-accent text-novian-primary px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white transition-colors"
        >
          {initialData ? "Salvar Alterações" : "Criar Lead"}
        </button>
      </div>
    </form>
  );
}

export function DashboardLayout() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/admin/dashboard", { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Failed to load dashboard");
        }

        const data = await res.json();
        if (!cancelled) {
          setDashboard(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const cards = dashboard
    ? [
        { label: "Leads CRM", value: dashboard.overview.crmLeads, hint: `${dashboard.overview.crmFunnels} funil(is) ativo(s)` },
        { label: "Captação", value: dashboard.overview.captacaoLeads, hint: `${dashboard.overview.captacaoFunnels} funil(is) ativo(s)` },
        { label: "Imóveis", value: dashboard.overview.totalProperties, hint: `${dashboard.overview.activeProperties} anúncio(s) ativo(s)` },
        { label: "Usuários Internos", value: dashboard.overview.internalUsers, hint: `${dashboard.overview.clients} cliente(s) cadastrado(s)` },
      ]
    : [];

  return (
    <div className="flex-1 overflow-y-auto bg-novian-primary">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-8 py-8">
        {isLoading && !dashboard ? (
          <DashboardLoader />
        ) : dashboard ? (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <FunnelBreakdownCard
                title="Pipeline do CRM"
                subtitle="Leads manuais que estão sendo acompanhados no quadro do CRM."
                items={dashboard.crmStatusBreakdown}
                emptyMessage="Ainda não existem leads no CRM."
              />
              <FunnelBreakdownCard
                title="Pipeline de Captação"
                subtitle="Oportunidades reais captadas no funil atual de captação."
                items={dashboard.captacaoStatusBreakdown}
                emptyMessage="Ainda não existem oportunidades captadas."
              />
              <BreakdownCard
                title="Status dos Imóveis"
                subtitle="Distribuição atual do estoque por status de publicação."
                items={dashboard.propertyStatusBreakdown}
                emptyMessage="Nenhum imóvel disponível."
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <InfoPanel
                title="Portal do Cliente"
                subtitle="Uso atual do portal restrito com base nos dados disponíveis."
                rows={[
                  { label: "Clientes", value: dashboard.overview.clients },
                  { label: "Processos", value: dashboard.overview.clientProcesses },
                  { label: "Documentos", value: dashboard.overview.clientDocuments },
                  { label: "Mensagens", value: dashboard.overview.totalMessages },
                ]}
              />
              <BreakdownCard
                title="Status dos Processos"
                subtitle="Distribuição dos processos disponíveis no dashboard do cliente."
                items={dashboard.clientProcessBreakdown}
                emptyMessage="Nenhum processo de cliente foi criado ainda."
              />
              <InfoPanel
                title="Visão Operacional"
                subtitle="Resumo de alto nível dos dados disponíveis no momento."
                rows={[
                  { label: "Funis de leads", value: dashboard.overview.crmFunnels },
                  { label: "Funis de captação", value: dashboard.overview.captacaoFunnels },
                  { label: "Imóveis ativos", value: dashboard.overview.activeProperties },
                  { label: "Equipe interna", value: dashboard.overview.internalUsers },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <RecentListCard
                title="Captações Recentes"
                subtitle="Últimas oportunidades captadas disponíveis neste momento."
                items={dashboard.recentCaptacao.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${item.status} · ${item.source}`,
                  trailing: new Date(item.createdAt).toLocaleDateString("pt-BR"),
                }))}
                emptyMessage="Ainda não existem oportunidades captadas."
              />
              <RecentListCard
                title="Imóveis Recentes"
                subtitle="Registros de imóveis atualmente disponíveis no sistema."
                items={dashboard.recentProperties.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: `${getDashboardLabel(item.status)} · ${item.address}`,
                  trailing: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(item.price),
                }))}
                emptyMessage="Ainda não existem imóveis."
              />
              <RecentListCard
                title="Processos de Clientes"
                subtitle="Últimos processos visíveis no portal do cliente."
                items={dashboard.recentClientProcesses.map((item) => ({
                  id: item.id,
                  title: item.title,
                  meta: getDashboardLabel(item.status),
                  trailing: new Date(item.updated_at).toLocaleDateString("pt-BR"),
                }))}
                emptyMessage="Ainda não existem processos de clientes."
              />
            </div>
          </>
        ) : (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 px-6 py-10 text-sm text-red-100">
            Nao foi possivel carregar os dados do dashboard.
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardLoader() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-novian-muted/40 bg-novian-surface/35">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-novian-muted/35 border-t-novian-accent" />
        <p className="mt-4 text-sm font-medium text-novian-text/75">Carregando dashboard...</p>
        <p className="mt-1 text-xs text-novian-text/45">Buscando os dados mais recentes do sistema.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`dashboard-stat-skeleton-${index}`} className="rounded-3xl border border-novian-muted/30 bg-novian-surface/25 p-6">
            <div className="h-3 w-24 animate-pulse rounded-full bg-novian-muted/40" />
            <div className="mt-5 h-10 w-16 animate-pulse rounded-2xl bg-novian-muted/35" />
            <div className="mt-4 h-3 w-32 animate-pulse rounded-full bg-novian-muted/30" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`dashboard-panel-skeleton-${index}`} className="rounded-3xl border border-novian-muted/30 bg-novian-surface/25 p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-novian-muted/35" />
            <div className="mt-3 h-3 w-56 animate-pulse rounded-full bg-novian-muted/25" />
            <div className="mt-8 space-y-4">
              {Array.from({ length: 4 }).map((__, rowIndex) => (
                <div key={`dashboard-panel-row-${index}-${rowIndex}`}>
                  <div className="mb-2 h-3 w-28 animate-pulse rounded-full bg-novian-muted/25" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-novian-primary/80" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LeadsLayout({ refreshTrigger = 0 }: { refreshTrigger?: number }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedLead, setSelectedLead] = useState<Thread | null>(null);
  const [selectedLeadTab, setSelectedLeadTab] = useState<LeadContextTab>("overview");
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Trello-style Drag & Drop state
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  const [funnelsList, setFunnelsList] = useState<StoreFunnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string>("default");
  
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());

  // Drag-to-scroll refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingScroll = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);

  const fetchFunnels = async () => {
    try {
      const res = await fetch("/api/funnels?type=lead");
      const data = await res.json();
      setFunnelsList(data.funnels);
      setActiveFunnelId((prev) => data.funnels.some((funnel: StoreFunnel) => funnel.id === prev) ? prev : data.funnels[0]?.id || "");
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads", { cache: 'no-store' });
      const data = await res.json();
      const nextLeads = Array.isArray(data.leads) ? data.leads : [];
      setThreads(nextLeads);
      setSelectedLead((currentLead) => {
        if (!currentLead) {
          return currentLead;
        }

        return nextLeads.find((lead: Thread) => lead.id === currentLead.id) || currentLead;
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const initFetch = async () => {
      await fetchFunnels();
      await fetchLeads();
    };
    initFetch();
    const interval = setInterval(fetchLeads, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshTrigger]);

  useEffect(() => {
    setSelectedLeadTab("overview");
  }, [selectedLead?.id]);

  const activeFunnel = funnelsList.find(f => f.id === activeFunnelId) || funnelsList[0];
  const columns = activeFunnel?.columns || [];
  const visibleLeads = threads.filter((thread) =>
    thread.id !== "general" &&
    thread.id !== "continuous" &&
    (!activeFunnel || !thread.funnelId || thread.funnelId === activeFunnel.id)
  );

  const handleLeadClick = (e: React.MouseEvent, lead: Thread) => {
    // If we were dragging the scrollbar (mouse moved significantly), do not open the drawer
    if (scrollContainerRef.current && Math.abs((scrollContainerRef.current.scrollLeft || 0) - scrollLeftPos.current) > 5) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setSelectedLead(lead);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent starting drag if clicking on a card (it has its own drag event)
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]')) return;

    if (!scrollContainerRef.current) return;
    isDraggingScroll.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftPos.current = scrollContainerRef.current.scrollLeft;
    
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = () => {
    isDraggingScroll.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseUp = () => {
    isDraggingScroll.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5; // Scroll speed multiplier
    scrollContainerRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.effectAllowed = "move";
    
    // We use setTimeout to ensure the dragged element doesn't disappear from the cursor
    setTimeout(() => {
      setDraggedLeadId(leadId);
    }, 0);
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const toggleAllLeads = () => {
    const validLeads = visibleLeads;
    if (selectedLeadIds.size === validLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(validLeads.map(l => l.id)));
    }
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumnId(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
    
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDrop = async (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedLeadId(null);
    setDragOverColumnId(null);

    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    // Optimistic UI Update
    const nextStatus = columns.find((column) => column.id === columnId)?.title || columnId;
    setThreads(prev => prev.map(t => t.id === leadId ? { ...t, status: nextStatus } : t));

    // API Call to save new status
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
    } catch (err) {
      console.error("Failed to update lead status", err);
      // Optional: Revert optimistic update here if needed
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Tem certeza que deseja excluir este lead?")) return;
    try {
      await fetch(`/api/leads/${encodeURIComponent(leadId)}`, { method: 'DELETE' });
      setSelectedLead(null);
      setIsMenuOpen(false);
      fetchLeads();
    } catch (e) {
      console.error("Failed to delete lead", e);
    }
  };

  const selectedLeadPhone = selectedLead ? getLeadPhoneValue(selectedLead) : "";
  const selectedLeadMetadataDetails = selectedLead ? getLeadMetadataDetails(selectedLead.customData) : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-novian-primary overflow-hidden min-w-0 relative">
      {/* Leads Toolbar */}
      <div className="h-16 px-8 flex items-center justify-between border-b border-novian-muted/50 bg-novian-surface/30 shrink-0">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-sm text-novian-text/70 hover:text-novian-text px-3 py-1.5 rounded-lg hover:bg-novian-surface transition-colors">
            <Filter size={16} /> Filtros
          </button>
          <div className="h-4 w-px bg-novian-muted"></div>
          <span className="text-sm text-novian-text/50">{visibleLeads.length} Leads Totais</span>
        </div>
        <div className="flex items-center gap-3">
           <div className="min-w-[220px]">
             <PopupSelect
               value={activeFunnelId}
               onChange={setActiveFunnelId}
               buttonClassName="bg-novian-surface py-2 text-novian-text hover:bg-novian-muted"
               options={funnelsList.map((funnel) => ({ value: funnel.id, label: funnel.name }))}
             />
           </div>
           <div className="flex bg-novian-surface border border-novian-muted/50 rounded-lg p-0.5">
             <button 
                onClick={() => setViewMode('kanban')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-novian-muted text-novian-accent shadow-sm' : 'text-novian-text/50 hover:text-novian-text'}`}
                title="Kanban View"
              >
                <LayoutGrid size={16} />
             </button>
             <button 
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'table' ? 'bg-novian-muted text-novian-accent shadow-sm' : 'text-novian-text/50 hover:text-novian-text'}`}
                title="Table View"
              >
                <List size={16} />
             </button>
           </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-novian-muted/35 border-t-novian-accent" />
            <p className="mt-4 text-sm font-medium text-novian-text/75">Carregando leads...</p>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div 
          ref={scrollContainerRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex-1 overflow-x-auto overflow-y-hidden p-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          <div className="flex gap-6 h-full min-w-max pb-4">
            {columns.map(col => {
              const columnLeads = visibleLeads.filter((thread) => {
                if (!thread.status) {
                  return columns[0]?.id === col.id;
                }

                return thread.status === col.title || thread.status === col.id;
              });
              return (
                <div 
                  key={col.id} 
                  className={`w-80 flex flex-col h-full rounded-2xl border overflow-hidden shrink-0 transition-colors ${dragOverColumnId === col.id ? 'border-novian-accent bg-novian-surface/40' : 'border-novian-muted/30 bg-novian-surface/20'}`}
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={() => setDragOverColumnId(null)}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column Header */}
                  <div className="p-4 border-b border-novian-muted/30 flex justify-between items-center bg-novian-surface/40">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.color.split(' ')[0].replace('border-', 'bg-').replace('/30', '')}`}></div>
                      <h3 className="font-medium text-sm text-novian-text">{col.title}</h3>
                    </div>
                    <span className="text-xs font-semibold text-novian-text/50 bg-novian-muted px-2 py-0.5 rounded-full">
                      {columnLeads.length}
                    </span>
                  </div>
                  
                  {/* Column Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-3">
                    {columnLeads.map(lead => (
                      <div 
                        key={lead.id} 
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleLeadClick(e, lead)}
                        className={`bg-novian-surface border p-4 rounded-xl shadow-sm hover:border-novian-accent/50 transition-all group cursor-grab active:cursor-grabbing relative overflow-hidden ${draggedLeadId === lead.id ? 'opacity-40 border-dashed border-novian-accent/50 scale-95' : 'border-novian-muted/50'}`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold text-novian-text text-sm truncate max-w-[180px]">{lead.title}</h4>
                            <p className="text-xs text-novian-text/50 mt-0.5 font-mono">{lead.phone}</p>
                          </div>
                          <button className="text-novian-text/30 hover:text-novian-text opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal size={16} />
                          </button>
                        </div>

                        <p className="text-xs text-novian-text/70 line-clamp-2 mb-4 leading-relaxed">
                          {lead.preview || "Sem mensagens recentes."}
                        </p>

                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex -space-x-1">
                            {lead.agentIds.map(agentName => (
                              <AgentAvatar key={agentName} name={agentName} initials={agentName.substring(0, 2).toUpperCase()} />
                            ))}
                            {lead.agentIds.length === 0 && (
                              <div className="w-6 h-6 rounded-full bg-novian-muted border-2 border-novian-surface flex items-center justify-center text-[8px] font-bold text-novian-text/30">
                                --
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {lead.score !== undefined && (
                              <div className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                                lead.score > 30 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                                lead.score > 15 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                                'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              }`}>
                                <Flame size={10} />
                                {lead.score} pts
                              </div>
                            )}
                            <span className="text-[10px] text-novian-text/40">{lead.time}</span>
                          </div>
                        </div>
                        
                        {/* Accent Line */}
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${col.color.split(' ')[0].replace('border-', 'bg-').replace('/30', '')} opacity-50`}></div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="bg-novian-surface overflow-hidden">
            <table className="w-full text-left text-sm text-novian-text">
              <thead className="bg-novian-primary/50 text-novian-text/70 border-b border-novian-muted/50">
                <tr>
                  <th className="px-8 py-4 font-medium w-12 text-center">
                    <div 
                      className="relative flex items-center justify-center cursor-pointer p-1"
                      onClick={toggleAllLeads}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${
                        visibleLeads.length > 0 && selectedLeadIds.size === visibleLeads.length 
                          ? 'bg-novian-accent border-novian-accent text-novian-primary shadow-[0_0_8px_rgba(222,192,166,0.3)]' 
                          : 'bg-transparent border-novian-muted/50 hover:border-novian-accent/50'
                      }`}>
                        {visibleLeads.length > 0 && selectedLeadIds.size === visibleLeads.length && (
                          <Check size={12} strokeWidth={3} />
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-4 py-4 font-medium">Nome do Lead</th>
                  <th className="px-8 py-4 font-medium">Telefone</th>
                  <th className="px-8 py-4 font-medium">Status</th>
                  <th className="px-8 py-4 font-medium">Agentes</th>
                  <th className="px-8 py-4 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-novian-muted/30">
                {visibleLeads.map(lead => {
                  const leadCol = columns.find(c => c.id === lead.status) || columns[0];
                  const colColorClass = leadCol?.color?.split(' ')[0].replace('border-', 'text-') || 'text-novian-text';
                  const isSelected = selectedLeadIds.has(lead.id);
                  
                  return (
                    <tr 
                      key={lead.id} 
                      className={`hover:bg-novian-muted/20 transition-colors ${isSelected ? 'bg-novian-accent/5' : ''}`}
                    >
                      <td className="px-8 py-4 text-center">
                        <div 
                          className="relative flex items-center justify-center cursor-pointer p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLeadSelection(lead.id);
                          }}
                        >
                          <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${
                            isSelected 
                              ? 'bg-novian-accent border-novian-accent text-novian-primary shadow-[0_0_8px_rgba(222,192,166,0.3)]' 
                              : 'bg-transparent border-novian-muted/50 hover:border-novian-accent/50'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium cursor-pointer" onClick={() => setSelectedLead(lead)}>{lead.title}</td>
                      <td className="px-8 py-4 font-mono text-xs text-novian-text/70 cursor-pointer" onClick={() => setSelectedLead(lead)}>{lead.phone}</td>
                      <td className="px-8 py-4 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium bg-novian-surface ${leadCol?.color || 'border-novian-muted'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${leadCol?.color?.split(' ')[0].replace('border-', 'bg-').replace('/30', '') || 'bg-novian-muted'}`}></div>
                          {leadCol?.title || lead.status || 'Novo'}
                        </span>
                      </td>
                      <td className="px-8 py-4 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <div className="flex -space-x-1">
                          {lead.agentIds.map(agentName => (
                            <AgentAvatar key={agentName} name={agentName} initials={agentName.substring(0, 2).toUpperCase()} />
                          ))}
                          {lead.agentIds.length === 0 && (
                            <span className="text-xs text-novian-text/40 italic">Não atribuído</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        {lead.score !== undefined ? (
                          <div className={`inline-flex items-center justify-end gap-1 text-xs font-bold px-2 py-1 rounded-md border ${
                            lead.score > 30 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                            lead.score > 15 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            <Flame size={12} />
                            {lead.score} pts
                          </div>
                        ) : (
                          <span className="text-novian-text/30">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-12 text-center text-novian-text/50">
                      Nenhum lead encontrado neste funil.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Details Side Drawer */}
      {selectedLead && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end"
          onClick={() => {
            setSelectedLead(null);
            setIsEditingLead(false);
            setIsMenuOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-novian-surface border-l border-novian-muted h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-6 border-b border-novian-muted/50 flex items-center justify-between bg-novian-primary/30">
              <div>
                <h2 className="text-xl font-semibold text-novian-text truncate max-w-[250px]">{selectedLead.title}</h2>
                <p className="text-xs text-novian-text/50 font-mono mt-1">{selectedLead.phone}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="text-novian-text/50 hover:text-novian-text p-2 rounded-full hover:bg-novian-muted/50 transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </button>
                  {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-32 bg-novian-surface border border-novian-muted rounded-xl shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-100">
                      <button 
                        onClick={() => {
                          setIsEditingLead(true);
                          setIsMenuOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-novian-text hover:bg-novian-muted transition-colors"
                      >
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteLead(selectedLead.id)}
                        className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setSelectedLead(null);
                    setIsEditingLead(false);
                    setIsMenuOpen(false);
                  }}
                  className="text-novian-text/50 hover:text-novian-text p-2 rounded-full hover:bg-novian-muted/50 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {isEditingLead ? (
                <NewLeadForm 
                  initialData={selectedLead}
                  onClose={() => setIsEditingLead(false)}
                  onLeadCreated={() => {
                    fetchLeads();
                    setIsEditingLead(false);
                    setSelectedLead(null);
                  }}
                />
              ) : (
                <div className="space-y-6">
                  <LeadContextTabs value={selectedLeadTab} onChange={setSelectedLeadTab} />

                  {selectedLeadTab === "overview" && (
                    <>
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2 flex justify-between items-center">
                          Informações do Lead
                          {typeof selectedLead.customData?.whatsapp_jid === "string" && (
                            <button
                              onClick={async () => {
                                const btn = document.getElementById('refresh-wa-btn');
                                if (btn) btn.innerHTML = '↻ Atualizando...';
                                try {
                                  const agentId = selectedLead.customData?.agent_id || 'mariana-sdr';
                                  const jid = selectedLead.customData?.whatsapp_jid;
                                  await fetch(`/api/whatsapp/${agentId}?jid=${jid}`);
                                  await fetchLeads();
                                } catch (e) {
                                  console.error('Failed to refresh WA profile', e);
                                } finally {
                                  if (btn) btn.innerHTML = '↻ Atualizar WA';
                                }
                              }}
                              id="refresh-wa-btn"
                              className="text-[10px] bg-novian-muted/50 hover:bg-novian-muted text-novian-text/80 px-2 py-1 rounded transition-colors"
                            >
                              ↻ Atualizar WA
                            </button>
                          )}
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          {typeof selectedLead.customData?.whatsapp_profile_picture_url === "string" && (
                            <div className="col-span-2 flex items-center gap-4 bg-novian-muted/20 p-3 rounded-xl border border-novian-muted/30">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={String(selectedLead.customData.whatsapp_profile_picture_url)}
                                alt="WhatsApp Profile"
                                className="w-16 h-16 rounded-full object-cover border-2 border-novian-muted"
                              />
                              <div>
                                <p className="text-sm font-semibold text-novian-text">{selectedLead.title || selectedLeadPhone}</p>
                                <p className="text-xs text-novian-text/60 font-mono">{selectedLeadPhone}</p>
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-xs text-novian-text/50 mb-1">Telefone / WhatsApp</p>
                            <p className="text-sm font-mono text-novian-text/90">{selectedLeadPhone || "Nao informado"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-novian-text/50 mb-1">Origem</p>
                            <p className="text-sm text-novian-text/90">{String(selectedLead.customData?.source || "Manual")}</p>
                          </div>
                          <div>
                            <p className="text-xs text-novian-text/50 mb-1">Status Atual</p>
                            <span className="inline-block bg-novian-muted text-novian-text px-2 py-1 rounded-md text-xs font-medium border border-novian-muted/50 uppercase tracking-wider">
                              {selectedLead.status || 'novo'}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-novian-text/50 mb-1">Score de Engajamento</p>
                            <span className="inline-block bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-md text-xs font-bold border border-yellow-500/30">
                              🔥 {selectedLead.score || 0} pts
                            </span>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-novian-text/50 mb-1">Criado em</p>
                            <p className="text-sm">{selectedLead.time}</p>
                          </div>
                        </div>
                      </div>

                      {selectedLeadMetadataDetails.length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Detalhes do Contato</h3>
                          <div className="grid grid-cols-1 gap-4">
                            {selectedLeadMetadataDetails.map((detail) => (
                              <div key={detail.label}>
                                <p className="text-xs text-novian-text/50 mb-1">{detail.label}</p>
                                {detail.href ? (
                                  <a
                                    href={detail.href}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sm font-medium text-novian-accent hover:text-white transition-colors break-all"
                                  >
                                    {detail.value}
                                  </a>
                                ) : (
                                  <p className="text-sm font-medium break-all">{detail.value}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(typeof selectedLead.customData?.whatsapp_about === "string" ||
                        typeof selectedLead.customData?.whatsapp_business_description === "string") && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Perfil WhatsApp</h3>
                          <div className="bg-novian-muted/10 p-4 rounded-xl border border-novian-muted/30 space-y-3">
                            {typeof selectedLead.customData?.whatsapp_about === "string" && (
                              <div>
                                <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Recado (About)</p>
                                <p className="text-sm italic text-novian-text/90">&quot;{String(selectedLead.customData.whatsapp_about)}&quot;</p>
                              </div>
                            )}
                            {typeof selectedLead.customData?.whatsapp_business_description === "string" && (
                              <div className="pt-2 border-t border-novian-muted/20">
                                <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Descrição (Business)</p>
                                <p className="text-sm text-novian-text/80">{String(selectedLead.customData.whatsapp_business_description)}</p>
                              </div>
                            )}
                            {typeof selectedLead.customData?.whatsapp_business_category === "string" && (
                              <div className="pt-2 border-t border-novian-muted/20">
                                <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Categoria (Business)</p>
                                <p className="text-sm text-novian-text/80">{String(selectedLead.customData.whatsapp_business_category)}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {getLeadCustomEntries(selectedLead.customData).length > 0 && (
                        <div className="space-y-4">
                          <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Campos Personalizados</h3>
                          <div className="grid grid-cols-1 gap-4">
                            {getLeadCustomEntries(selectedLead.customData).map(([key, value]) => {
                              const fieldDef = customFieldsStore.find(f => f.id === key);
                              return (
                                <div key={key}>
                                  <p className="text-xs text-novian-text/50 mb-1">{fieldDef ? fieldDef.name : key}</p>
                                  <p className="text-sm font-medium">{String(value)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Última Interação</h3>
                        <p className="text-sm text-novian-text/80 bg-novian-primary/30 p-4 rounded-xl border border-novian-muted/50 italic">
                          &quot;{selectedLead.preview}&quot;
                        </p>
                      </div>
                    </>
                  )}

                  {selectedLeadTab === "notes" && (
                    <LeadNotesPanel
                      leadId={selectedLead.id}
                      customData={selectedLead.customData}
                      onSaved={fetchLeads}
                    />
                  )}
                </div>
              )}
            </div>
            
            {!isEditingLead && (
              <div className="p-6 border-t border-novian-muted/50 bg-novian-primary/30">
                 <button 
                   onClick={() => {
                      // Logic to jump to Chat with this lead active
                      alert("Abre o chat (A implementar)");
                   }}
                   className="w-full bg-novian-accent text-novian-primary py-3 rounded-xl font-semibold hover:bg-white transition-colors flex items-center justify-center gap-2"
                 >
                   <MessageSquare size={18} /> Conversar no Chat
                 </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const COLOR_PRESETS = [
  { id: 'blue', classes: 'border-blue-500/30 text-blue-400 bg-blue-500/10', bg: 'bg-blue-500' },
  { id: 'purple', classes: 'border-purple-500/30 text-purple-400 bg-purple-500/10', bg: 'bg-purple-500' },
  { id: 'yellow', classes: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10', bg: 'bg-yellow-500' },
  { id: 'orange', classes: 'border-orange-500/30 text-orange-400 bg-orange-500/10', bg: 'bg-orange-500' },
  { id: 'green', classes: 'border-green-500/30 text-green-400 bg-green-500/10', bg: 'bg-green-500' },
  { id: 'red', classes: 'border-red-500/30 text-red-400 bg-red-500/10', bg: 'bg-red-500' },
  { id: 'gray', classes: 'border-gray-500/30 text-gray-400 bg-gray-500/10', bg: 'bg-gray-500' },
];

const buildGoogleMapsEmbedUrl = (address: string) => {
  const normalizedAddress = address.trim();
  if (!normalizedAddress) {
    return "";
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(normalizedAddress)}&output=embed`;
};

const PROPERTY_OWNER_PRICE_KEY = "owner_price";
const PROPERTY_COMMISSION_RATE_KEY = "commission_rate";
const PROPERTY_IMAGE_DESCRIPTIONS_KEY = "image_descriptions";
const DEFAULT_PROPERTY_COMMISSION_RATE = 6;

const roundCurrencyValue = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const roundPercentageValue = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(4));
const roundUpToStep = (value: number, step: number) => {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return roundCurrencyValue(Math.ceil(value / step) * step);
};

const getNumericCustomDataValue = (customData: Property["customData"] | undefined, key: string) => {
  const value = customData?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const getImageDescriptionsFromCustomData = (customData: Property["customData"] | undefined) => {
  const rawValue = customData?.[PROPERTY_IMAGE_DESCRIPTIONS_KEY];
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce<Record<string, string>>((acc, [imageUrl, description]) => {
      if (typeof description === "string" && description.trim()) {
        acc[imageUrl] = description;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const getFileNameFromUrl = (fileUrl: string) => {
  if (!fileUrl) {
    return "";
  }

  try {
    const pathname = new URL(fileUrl).pathname;
    return decodeURIComponent(pathname.split("/").pop() || "");
  } catch {
    return fileUrl.split("/").pop() || fileUrl;
  }
};

function LeadMagnetUploader({
  fileUrl,
  onChange,
}: {
  fileUrl: string;
  onChange: (fileUrl: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const filePath = `lead-magnets/${Date.now()}-${sanitizedName}${fileExt ? "" : ".bin"}`;

      const { error: uploadError } = await supabase.storage.from("assets").upload(filePath, file, {
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
      onChange(data.publicUrl);
    } catch (error) {
      console.error("Falha ao enviar lead magnet", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      return;
    }

    await uploadFile(nextFile);
    event.target.value = "";
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-novian-text/70">Arquivo</label>
      <div className="rounded-2xl border border-novian-muted/35 bg-novian-primary/25 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-novian-text">
              {fileUrl ? getFileNameFromUrl(fileUrl) : "Nenhum arquivo selecionado"}
            </p>
            <p className="mt-1 text-xs text-novian-text/50">
              PDF, DOCX, PPTX ou qualquer material complementar do imovel.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="inline-flex items-center gap-2 rounded-full border border-novian-muted/40 px-3 py-2 text-sm font-medium text-novian-text/80 transition hover:border-novian-accent/40 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} />}
              {isUploading ? "Enviando..." : fileUrl ? "Substituir arquivo" : "Selecionar arquivo"}
            </button>
            {fileUrl ? (
              <>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-novian-muted/40 px-3 py-2 text-sm font-medium text-novian-text/80 transition hover:border-novian-accent/40 hover:text-novian-text"
                >
                  Ver arquivo
                </a>
                <button
                  type="button"
                  onClick={() => onChange("")}
                  className="inline-flex items-center gap-2 rounded-full border border-red-400/25 px-3 py-2 text-sm font-medium text-red-200 transition hover:border-red-300/45 hover:text-red-100"
                >
                  Remover
                </button>
              </>
            ) : null}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
      </div>
    </div>
  );
}

export function PropertiesLayout() {
  const searchParams = useSearchParams();
  const deepLinkPropertyId = searchParams.get("id");
  const didAutoOpenPropertyFromQueryRef = useRef(false);
  const propertyFormRef = useRef<HTMLFormElement | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [currentCover, setCurrentCover] = useState<string>("");
  const [currentImageDescriptions, setCurrentImageDescriptions] = useState<Record<string, string>>({});
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [mapEmbedUrl, setMapEmbedUrl] = useState<string>("");
  const [isMapEditedManually, setIsMapEditedManually] = useState(false);
  const [isMapAdvancedOpen, setIsMapAdvancedOpen] = useState(false);
  const [ownerPrice, setOwnerPrice] = useState<number>(0);
  const [commissionRate, setCommissionRate] = useState<number>(DEFAULT_PROPERTY_COMMISSION_RATE);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [propertyStatus, setPropertyStatus] = useState<Property["status"]>("active");
  const [propertyDropdownValues, setPropertyDropdownValues] = useState<Record<string, string>>({});
  const [heroTitle, setHeroTitle] = useState<string>("Descubra seu novo lar");
  const [heroSubtitle, setHeroSubtitle] = useState<string>("Cadastre-se para receber mais informações exclusivas.");
  const [callToActionText, setCallToActionText] = useState<string>("Quero Saber Mais");
  const [leadMagnetTitle, setLeadMagnetTitle] = useState<string>("Baixar Apresentação do Imóvel");
  const [leadMagnetFileUrl, setLeadMagnetFileUrl] = useState<string>("");
  const [activeAiField, setActiveAiField] = useState<string | null>(null);
  const [openAiMenuField, setOpenAiMenuField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activePropertyTab, setActivePropertyTab] = useState<"details" | "media" | "landing" | "documents">("details");

  const fetchProps = async () => {
    try {
      const res = await fetch('/api/properties');
      const data = await res.json();
      setProperties(data.properties || []);
      setFields(data.fields || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProps();
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      setActivePropertyTab("details");
      setCurrentImages(selectedProperty.images || []);
      setCurrentCover(selectedProperty.coverImage || "");
      setCurrentImageDescriptions(getImageDescriptionsFromCustomData(selectedProperty.customData));
      setTitle(selectedProperty.title || "");
      setDescription(selectedProperty.description || "");
      setAddress(selectedProperty.address || "");
      const storedCommissionRate = getNumericCustomDataValue(selectedProperty.customData, PROPERTY_COMMISSION_RATE_KEY);
      const nextCommissionRate = storedCommissionRate ?? DEFAULT_PROPERTY_COMMISSION_RATE;
      const storedOwnerPrice = getNumericCustomDataValue(selectedProperty.customData, PROPERTY_OWNER_PRICE_KEY);
      const derivedOwnerPrice =
        nextCommissionRate > 0
          ? selectedProperty.price * (1 - nextCommissionRate / 100)
          : selectedProperty.price;
      const nextOwnerPrice = roundCurrencyValue(storedOwnerPrice ?? derivedOwnerPrice);
      const nextFinalPrice = roundCurrencyValue(selectedProperty.price);
      setCommissionRate(roundPercentageValue(nextCommissionRate));
      setOwnerPrice(nextOwnerPrice);
      setFinalPrice(nextFinalPrice);
      setPropertyStatus(selectedProperty.status || "active");
      setPropertyDropdownValues(
        fields.reduce<Record<string, string>>((acc, field) => {
          if (field.type === "dropdown") {
            const rawValue = selectedProperty.customData?.[field.id];
            acc[field.id] = typeof rawValue === "string" ? rawValue : rawValue != null ? String(rawValue) : "";
          }
          return acc;
        }, {}),
      );
      const generatedMapUrl = buildGoogleMapsEmbedUrl(selectedProperty.address || "");
      const existingMapUrl = selectedProperty.mapEmbedUrl || "";
      const hasManualMapUrl = Boolean(existingMapUrl) && existingMapUrl !== generatedMapUrl;
      setMapEmbedUrl(existingMapUrl || generatedMapUrl);
      setIsMapEditedManually(hasManualMapUrl);
      setIsMapAdvancedOpen(hasManualMapUrl);
      setHeroTitle(selectedProperty.landingPage?.heroTitle || "Descubra seu novo lar");
      setHeroSubtitle(selectedProperty.landingPage?.heroSubtitle || "Cadastre-se para receber mais informações exclusivas.");
      setCallToActionText(selectedProperty.landingPage?.callToActionText || "Quero Saber Mais");
      setLeadMagnetTitle(selectedProperty.landingPage?.leadMagnetTitle || "Baixar Apresentação do Imóvel");
      setLeadMagnetFileUrl(selectedProperty.landingPage?.leadMagnetFileUrl || "");
    } else {
      setActivePropertyTab("details");
      setCurrentImages([]);
      setCurrentCover("");
      setCurrentImageDescriptions({});
      setTitle("");
      setDescription("");
      setAddress("");
      setMapEmbedUrl("");
      setIsMapEditedManually(false);
      setIsMapAdvancedOpen(false);
      setOwnerPrice(0);
      setCommissionRate(DEFAULT_PROPERTY_COMMISSION_RATE);
      setFinalPrice(0);
      setPropertyStatus("active");
      setPropertyDropdownValues({});
      setHeroTitle("Descubra seu novo lar");
      setHeroSubtitle("Cadastre-se para receber mais informações exclusivas.");
      setCallToActionText("Quero Saber Mais");
      setLeadMagnetTitle("Baixar Apresentação do Imóvel");
      setLeadMagnetFileUrl("");
    }
  }, [selectedProperty, isDrawerOpen]);

  useEffect(() => {
    if (isMapEditedManually) {
      return;
    }

    setMapEmbedUrl(buildGoogleMapsEmbedUrl(address));
  }, [address, isMapEditedManually]);

  useEffect(() => {
    if (!openAiMenuField) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setOpenAiMenuField(null);
        return;
      }

      if (target.closest("[data-ai-menu-root='true']")) {
        return;
      }

      setOpenAiMenuField(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenAiMenuField(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openAiMenuField]);

  const buildPropertyAiContext = () => {
    const formData = propertyFormRef.current ? new FormData(propertyFormRef.current) : null;
    const customFieldValues = fields.reduce<Record<string, string>>((acc, field) => {
      const rawValue = formData?.get(`custom_${field.id}`);
      const normalizedValue = String(rawValue ?? "").trim();
      if (normalizedValue) {
        acc[field.name] = normalizedValue;
      }
      return acc;
    }, {});

    return {
      tituloDoImovel: title,
      descricaoAtual: stripRichTextToPlainText(description),
      endereco: address,
      status: String(formData?.get("status") || selectedProperty?.status || "active"),
      precoFinal: formatCurrency(finalPrice),
      precoFinalSugerido: formatCurrency(suggestedFinalPrice),
      valorDoProprietario: formatCurrency(ownerPrice),
      liquidoDoProprietario: formatCurrency(ownerReceives),
      ajusteLiquidoVsDesejado: formatCurrency(ownerAdjustment),
      comissaoPercentual: `${commissionRate}%`,
      valorDaComissao: formatCurrency(commissionAmount),
      heroTitle,
      heroSubtitle,
      callToActionText,
      leadMagnetTitle,
      leadMagnetFileUrl,
      corPrincipal: String(formData?.get("primaryColor") || ""),
      exibirLeadMagnet: formData?.get("showLeadMagnet") === "on",
      imagens: {
        capa: currentCover,
        total: currentImages.length,
        descricoes: currentImageDescriptions,
      },
      camposPersonalizados: customFieldValues,
    };
  };

  const handleAiAssist = async ({
    fieldKey,
    fieldLabel,
    action,
    format,
    value,
    onApply,
  }: {
    fieldKey: string;
    fieldLabel: string;
    action: AiAssistAction;
    format: AiAssistFormat;
    value: string;
    onApply: (nextValue: string) => void;
  }) => {
    setOpenAiMenuField(null);
    setActiveAiField(fieldKey);
    try {
      const response = await fetch("/api/admin/ai-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          format,
          fieldLabel,
          sourceText: value,
          context: buildPropertyAiContext(),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Falha ao gerar texto com IA");
      }

      onApply(payload.content || "");
    } catch (error) {
      console.error(error);
    } finally {
      setActiveAiField(null);
    }
  };

  const handleOwnerPriceChange = (rawValue: string) => {
    const nextOwnerPrice = roundCurrencyValue(Number(rawValue || 0));
    setOwnerPrice(nextOwnerPrice);
    const suggestedFinal = commissionRate >= 100
      ? nextOwnerPrice
      : roundCurrencyValue(nextOwnerPrice / (1 - commissionRate / 100));
    setFinalPrice(suggestedFinal);
  };

  const handleCommissionRateChange = (rawValue: string) => {
    const nextCommissionRate = Math.max(0, roundPercentageValue(Number(rawValue || 0)));
    setCommissionRate(nextCommissionRate);
    const suggestedFinal = nextCommissionRate >= 100
      ? ownerPrice
      : roundCurrencyValue(ownerPrice / (1 - nextCommissionRate / 100));
    setFinalPrice(suggestedFinal);
  };

  const handleFinalPriceChange = (rawValue: string) => {
    const nextFinalPrice = roundCurrencyValue(Number(rawValue || 0));
    setFinalPrice(nextFinalPrice);
  };

  const suggestedFinalPrice =
    commissionRate >= 100 ? ownerPrice : roundCurrencyValue(ownerPrice / Math.max(1 - commissionRate / 100, 0.0001));
  const commissionAmount = roundCurrencyValue(finalPrice * (commissionRate / 100));
  const ownerReceives = roundCurrencyValue(finalPrice - commissionAmount);
  const ownerAdjustment = roundCurrencyValue(ownerReceives - ownerPrice);

  useEffect(() => {
    didAutoOpenPropertyFromQueryRef.current = false;
  }, [deepLinkPropertyId]);

  useEffect(() => {
    if (!deepLinkPropertyId || didAutoOpenPropertyFromQueryRef.current || properties.length === 0) {
      return;
    }

    const matchedProperty = properties.find((property) => property.id === deepLinkPropertyId);
    if (matchedProperty) {
      setSelectedProperty(matchedProperty);
      setIsDrawerOpen(true);
      didAutoOpenPropertyFromQueryRef.current = true;
    }
  }, [deepLinkPropertyId, properties]);

  const handleSaveProperty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    
    const formData = new FormData(e.currentTarget);
    const customData: Record<string, string | number> = {};
    
    fields.forEach(f => {
      const val = formData.get(`custom_${f.id}`);
      if (val) {
        customData[f.id] = f.type === 'number' ? Number(val) : String(val);
      }
    });

    customData[PROPERTY_OWNER_PRICE_KEY] = ownerPrice;
    customData[PROPERTY_COMMISSION_RATE_KEY] = commissionRate;
    if (Object.keys(currentImageDescriptions).length > 0) {
      customData[PROPERTY_IMAGE_DESCRIPTIONS_KEY] = JSON.stringify(currentImageDescriptions);
    }

    let mapUrl = mapEmbedUrl;
    if (mapUrl && mapUrl.includes('<iframe') && mapUrl.includes('src="')) {
      const match = mapUrl.match(/src="([^"]+)"/);
      if (match) {
        mapUrl = match[1];
      }
    }

    const propertyData = {
      ...(selectedProperty ? { id: selectedProperty.id, slug: selectedProperty.slug } : {}),
      title,
      description,
      address,
      mapEmbedUrl: mapUrl,
      price: finalPrice,
      status: formData.get("status"),
      coverImage: currentCover,
      images: currentImages,
      customData,
      landingPage: {
        heroTitle,
        heroSubtitle,
        callToActionText,
        primaryColor: formData.get("primaryColor"),
        showLeadMagnet: formData.get("showLeadMagnet") === "on",
        leadMagnetTitle,
        leadMagnetFileUrl,
      }
    };

    try {
      await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propertyData)
      });
      await fetchProps();
      setIsDrawerOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/properties?id=${propertyToDelete.id}`, {
        method: 'DELETE'
      });
      await fetchProps();
      setPropertyToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full p-6" onClick={() => { setOpenDropdownId(null); setOpenAiMenuField(null); }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-light text-novian-text">Gerenciamento de Imóveis</h2>
        <button 
          onClick={() => {
            setSelectedProperty(null);
            setIsDrawerOpen(true);
          }}
          className="bg-novian-accent text-novian-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-white transition-colors"
        >
          <Plus size={16} /> Cadastrar Imóvel
        </button>
      </div>

      <div className="flex-1 overflow-auto pb-6">
        {isLoading ? (
          <div className="flex flex-1 h-full items-center justify-center p-6">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-novian-muted/35 border-t-novian-accent" />
              <p className="mt-4 text-sm font-medium text-novian-text/75">Carregando imóveis...</p>
            </div>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 text-novian-text/50">
            <HomeIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg mb-2">Nenhum imóvel cadastrado</p>
            <p className="text-sm max-w-md mx-auto">Adicione seu primeiro imóvel para começar a montar o catálogo e criar landing pages.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {properties.map(prop => (
            <div key={prop.id} className="border border-novian-muted/50 rounded-2xl overflow-hidden bg-novian-surface group relative">
              <div className="h-48 bg-novian-muted/20 relative cursor-pointer" onClick={() => { setSelectedProperty(prop); setIsDrawerOpen(true); }}>
                {prop.coverImage ? (
                  <img src={prop.coverImage} alt={prop.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-novian-text/30">
                    <HomeIcon size={48} />
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold border border-white/10">
                  {prop.status === 'active' ? 'Ativo' : prop.status === 'sold' ? 'Vendido' : 'Inativo'}
                </div>
              </div>
              <div className="absolute top-3 right-3 z-10">
                <button 
                  onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === prop.id ? null : prop.id); }}
                  className="bg-black/60 hover:bg-black/80 backdrop-blur-md p-1.5 rounded-full border border-white/10 text-white transition-colors"
                >
                  <MoreHorizontal size={16} />
                </button>
                {openDropdownId === prop.id && (
                  <div className="absolute right-0 mt-2 w-36 bg-novian-surface border border-novian-muted/50 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); setSelectedProperty(prop); setIsDrawerOpen(true); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-novian-muted/50 flex items-center gap-2 transition-colors"
                    >
                      <Edit size={14} /> Editar
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); setPropertyToDelete(prop); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-500/10 text-red-500 flex items-center gap-2 transition-colors"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 cursor-pointer" onClick={() => { setSelectedProperty(prop); setIsDrawerOpen(true); }}>
                <h3 className="font-semibold text-lg text-novian-text truncate">{prop.title}</h3>
                <p className="text-novian-accent font-medium mt-1">R$ {prop.price.toLocaleString('pt-BR')}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {Object.entries(prop.customData).slice(0,3).map(([key, value]) => {
                    const field = fields.find(f => f.id === key);
                    return field ? (
                      <span key={key} className="text-xs bg-novian-surface border border-novian-muted px-2 py-1 rounded-md text-novian-text/70">
                        {value} {field.name.includes('m²') ? 'm²' : ''}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          ))}
          {properties.length === 0 && (
            <div className="col-span-full py-12 text-center text-novian-text/50">
              Nenhum imóvel cadastrado.
            </div>
          )}
          </div>
        )}
      </div>

      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex justify-end"
          onClick={() => setIsDrawerOpen(false)}
        >
          <form
            ref={propertyFormRef}
            onSubmit={handleSaveProperty}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-2xl bg-novian-surface border-l border-novian-muted h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
          >
            <div className="p-6 border-b border-novian-muted/50 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-novian-text">
                {selectedProperty ? 'Editar Imóvel' : 'Novo Imóvel'}
              </h2>
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="text-novian-text/50 hover:text-novian-accent transition-colors p-2">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="flex flex-wrap gap-2 border-b border-novian-muted/35 pb-4">
                {[
                  { value: "details" as const, label: "Detalhes" },
                  { value: "media" as const, label: "Midia" },
                  { value: "landing" as const, label: "Landing Page" },
                  { value: "documents" as const, label: "Documentos", disabled: !selectedProperty },
                ].map((tab) => {
                  const active = activePropertyTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      disabled={tab.disabled}
                      onClick={() => setActivePropertyTab(tab.value)}
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

              {activePropertyTab === "details" ? (
              <>
              <section className="space-y-4">
                <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Informações Básicas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <AiInputField
                      label="Título do Imóvel"
                      name="title"
                      required
                      value={title}
                      onChange={setTitle}
                      isLoading={activeAiField === "title"}
                      menuOpen={openAiMenuField === "title"}
                      onToggleMenu={() => setOpenAiMenuField((current) => current === "title" ? null : "title")}
                      onGenerate={() =>
                        handleAiAssist({
                          fieldKey: "title",
                          fieldLabel: "Título do Imóvel",
                          action: "generate",
                          format: "plain_text",
                          value: title,
                          onApply: setTitle,
                        })
                      }
                      onEnhance={() =>
                        handleAiAssist({
                          fieldKey: "title",
                          fieldLabel: "Título do Imóvel",
                          action: "enhance",
                          format: "plain_text",
                          value: title,
                          onApply: setTitle,
                        })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <RichTextEditor
                      label="Descrição"
                      name="description"
                      required
                      value={description}
                      onChange={setDescription}
                      menuOpen={openAiMenuField === "description"}
                      onToggleMenu={() => setOpenAiMenuField((current) => current === "description" ? null : "description")}
                      onGenerate={() =>
                        handleAiAssist({
                          fieldKey: "description",
                          fieldLabel: "Descrição do Imóvel",
                          action: "generate",
                          format: "rich_html",
                          value: description,
                          onApply: setDescription,
                        })
                      }
                      onEnhance={() =>
                        handleAiAssist({
                          fieldKey: "description",
                          fieldLabel: "Descrição do Imóvel",
                          action: "enhance",
                          format: "rich_html",
                          value: description,
                          onApply: setDescription,
                        })
                      }
                      isLoading={activeAiField === "description"}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-novian-text/70 mb-1">Endereço Completo</label>
                    <input
                      name="address"
                      required
                      type="text"
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none"
                      placeholder="Ex: Rua Amauri, 123 - Itaim Bibi, São Paulo - SP"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <label className="block text-xs font-medium text-novian-text/70">Mapa</label>
                    </div>
                    <div className="rounded-xl border border-novian-muted/40 bg-novian-primary/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-novian-text/45">
                          {isMapEditedManually
                            ? "Mapa ajustado manualmente."
                            : "Automatico pelo endereco."}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsMapAdvancedOpen((current) => !current)}
                            className="rounded-full border border-novian-muted/40 px-3 py-1.5 text-xs font-medium text-novian-text/75 transition hover:border-novian-accent/40 hover:text-novian-text"
                          >
                            {isMapAdvancedOpen ? "Ocultar avancado" : "Editar mapa"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMapEmbedUrl(buildGoogleMapsEmbedUrl(address));
                              setIsMapEditedManually(false);
                              setIsMapAdvancedOpen(false);
                            }}
                            disabled={!address.trim()}
                            className="rounded-full border border-novian-muted/40 px-3 py-1.5 text-xs font-medium text-novian-text/75 transition hover:border-novian-accent/40 hover:text-novian-text disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Usar automatico
                          </button>
                        </div>
                      </div>
                      {isMapAdvancedOpen ? (
                        <div className="space-y-2 rounded-xl border border-novian-muted/25 bg-novian-surface/15 p-3">
                          <div className="flex items-center gap-2 text-xs text-novian-text/55">
                            <MapPin size={12} />
                            <span>URL manual do mapa</span>
                          </div>
                          <input
                            name="mapEmbedUrl"
                            type="text"
                            value={mapEmbedUrl}
                            onChange={(event) => {
                              setMapEmbedUrl(event.target.value);
                              setIsMapEditedManually(true);
                            }}
                            className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none"
                            placeholder="O mapa sera preenchido automaticamente quando voce informar o endereco."
                          />
                        </div>
                      ) : (
                        <input type="hidden" name="mapEmbedUrl" value={mapEmbedUrl} />
                      )}
                      {mapEmbedUrl ? (
                        <div className="overflow-hidden rounded-xl border border-novian-muted/35 bg-novian-surface/20">
                          <iframe
                            src={mapEmbedUrl}
                            title="Preview do mapa"
                            className="h-52 w-full"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-novian-muted/35 bg-novian-primary/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-novian-text/45">Precificacao</p>
                        <p className="mt-1 text-xs text-novian-text/50">
                          Informe quanto o proprietario quer receber, defina a comissao e ajuste o preco final com arredondamento simples.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-novian-accent/25 bg-novian-accent/10 px-4 py-3 text-right">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Preco final</p>
                        <p className="mt-1 text-lg font-semibold text-novian-text">{formatCurrency(finalPrice)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <label className="block text-xs font-medium text-novian-text/70 mb-1">Valor do proprietario (R$)</label>
                        <input
                          name="ownerPrice"
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={ownerPrice}
                          onChange={(event) => handleOwnerPriceChange(event.target.value)}
                          className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-novian-text/70 mb-1">Comissao (%)</label>
                        <input
                          name="commissionRate"
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={commissionRate}
                          onChange={(event) => handleCommissionRateChange(event.target.value)}
                          className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-novian-text/70 mb-1">Preco final de venda</label>
                        <input
                          name="finalPrice"
                          required
                          type="number"
                          min="0"
                          step="0.01"
                          value={finalPrice}
                          onChange={(event) => handleFinalPriceChange(event.target.value)}
                          className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setFinalPrice(suggestedFinalPrice)}
                        className="rounded-full border border-novian-muted/35 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                      >
                        Usar sugerido
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalPrice(roundUpToStep(suggestedFinalPrice, 1000))}
                        className="rounded-full border border-novian-muted/35 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                      >
                        Arredondar 1 mil
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalPrice(roundUpToStep(suggestedFinalPrice, 5000))}
                        className="rounded-full border border-novian-muted/35 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                      >
                        Arredondar 5 mil
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalPrice((current) => Math.max(0, roundCurrencyValue(current - 1000)))}
                        className="rounded-full border border-novian-muted/35 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                      >
                        -1 mil
                      </button>
                      <button
                        type="button"
                        onClick={() => setFinalPrice((current) => roundCurrencyValue(current + 1000))}
                        className="rounded-full border border-novian-muted/35 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/35 hover:text-novian-text"
                      >
                        +1 mil
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-novian-muted/30 bg-novian-surface/15 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Preco sugerido</p>
                        <p className="mt-1 text-sm font-medium text-novian-text/85">
                          {formatCurrency(suggestedFinalPrice)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-novian-muted/30 bg-novian-surface/15 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Valor da comissao</p>
                        <p className="mt-1 text-sm font-medium text-novian-text/85">
                          {formatCurrency(commissionAmount)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-novian-muted/30 bg-novian-surface/15 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Liquido do proprietario</p>
                        <p className="mt-1 text-sm font-medium text-novian-text/85">
                          {formatCurrency(ownerReceives)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-novian-muted/30 bg-novian-surface/15 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-novian-text/45">Ajuste vs. desejado</p>
                        <p className={`mt-1 text-sm font-medium ${ownerAdjustment >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                          {ownerAdjustment >= 0 ? "+" : "-"} {formatCurrency(Math.abs(ownerAdjustment))}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-novian-text/70 mb-1">Status</label>
                    <PopupSelect
                      name="status"
                      value={propertyStatus}
                      onChange={(value) => setPropertyStatus(value as Property["status"])}
                      options={[
                        { value: "active", label: "Ativo" },
                        { value: "inactive", label: "Inativo" },
                        { value: "sold", label: "Vendido" },
                      ]}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Campos Personalizados</h3>
                <div className="grid grid-cols-2 gap-4">
                  {fields.map(field => (
                    <div key={field.id}>
                      <label className="block text-xs font-medium text-novian-text/70 mb-1">{field.name}</label>
                      {field.type === "dropdown" ? (
                        <PopupSelect
                          name={`custom_${field.id}`}
                          value={propertyDropdownValues[field.id] || ""}
                          onChange={(value) =>
                            setPropertyDropdownValues((current) => ({
                              ...current,
                              [field.id]: value,
                            }))
                          }
                          placeholder="Selecione..."
                          options={(field.options || []).map((option) => ({
                            value: option,
                            label: option,
                          }))}
                        />
                      ) : (
                        <input 
                          name={`custom_${field.id}`}
                          type={field.type === 'number' ? 'number' : 'text'} 
                          className="w-full bg-novian-primary border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none" 
                          defaultValue={selectedProperty?.customData?.[field.id] as string | number | undefined} 
                        />
                      )}
                    </div>
                  ))}
                </div>
              </section>
              </>
              ) : null}

              {activePropertyTab === "media" ? (
              <section className="space-y-4">
                <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase border-b border-novian-muted/50 pb-2">Galeria de Imagens</h3>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-medium text-novian-text/70 mb-2">Faça o upload, organize e selecione a capa do imóvel</label>
                    <ImageGalleryUploader 
                      initialCover={selectedProperty?.coverImage}
                      initialImages={selectedProperty?.images || []}
                      initialDescriptions={currentImageDescriptions}
                      onChange={(imgs, cover, descriptions) => {
                        setCurrentImages(imgs);
                        setCurrentCover(cover);
                        setCurrentImageDescriptions(descriptions);
                      }}
                    />
                  </div>
                </div>
              </section>
              ) : null}

              {activePropertyTab === "landing" ? (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-novian-muted/50 pb-2">
                  <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase">Editor de Landing Page (Geração de Leads)</h3>
                  <a href={`/imoveis/${selectedProperty?.slug || 'novo'}`} target="_blank" rel="noreferrer" className="text-xs text-novian-accent hover:underline flex items-center gap-1">
                    Ver Página <ArrowRight size={12} />
                  </a>
                </div>
                
                <div className="bg-novian-primary/50 border border-novian-accent/20 rounded-xl p-4 space-y-4">
                  <AiInputField
                    label="Título Principal (Hero)"
                    name="heroTitle"
                    value={heroTitle}
                    onChange={setHeroTitle}
                    isLoading={activeAiField === "heroTitle"}
                    menuOpen={openAiMenuField === "heroTitle"}
                    onToggleMenu={() => setOpenAiMenuField((current) => current === "heroTitle" ? null : "heroTitle")}
                    onGenerate={() =>
                      handleAiAssist({
                        fieldKey: "heroTitle",
                        fieldLabel: "Título Principal da Landing Page",
                        action: "generate",
                        format: "plain_text",
                        value: heroTitle,
                        onApply: setHeroTitle,
                      })
                    }
                    onEnhance={() =>
                      handleAiAssist({
                        fieldKey: "heroTitle",
                        fieldLabel: "Título Principal da Landing Page",
                        action: "enhance",
                        format: "plain_text",
                        value: heroTitle,
                        onApply: setHeroTitle,
                      })
                    }
                  />
                  <AiInputField
                    label="Subtítulo"
                    name="heroSubtitle"
                    value={heroSubtitle}
                    onChange={setHeroSubtitle}
                    isLoading={activeAiField === "heroSubtitle"}
                    menuOpen={openAiMenuField === "heroSubtitle"}
                    onToggleMenu={() => setOpenAiMenuField((current) => current === "heroSubtitle" ? null : "heroSubtitle")}
                    onGenerate={() =>
                      handleAiAssist({
                        fieldKey: "heroSubtitle",
                        fieldLabel: "Subtítulo da Landing Page",
                        action: "generate",
                        format: "plain_text",
                        value: heroSubtitle,
                        onApply: setHeroSubtitle,
                      })
                    }
                    onEnhance={() =>
                      handleAiAssist({
                        fieldKey: "heroSubtitle",
                        fieldLabel: "Subtítulo da Landing Page",
                        action: "enhance",
                        format: "plain_text",
                        value: heroSubtitle,
                        onApply: setHeroSubtitle,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <AiInputField
                      label="Texto do Botão (CTA)"
                      name="callToActionText"
                      value={callToActionText}
                      onChange={setCallToActionText}
                      isLoading={activeAiField === "callToActionText"}
                      menuOpen={openAiMenuField === "callToActionText"}
                      onToggleMenu={() => setOpenAiMenuField((current) => current === "callToActionText" ? null : "callToActionText")}
                      onGenerate={() =>
                        handleAiAssist({
                          fieldKey: "callToActionText",
                          fieldLabel: "Texto do Botão CTA",
                          action: "generate",
                          format: "plain_text",
                          value: callToActionText,
                          onApply: setCallToActionText,
                        })
                      }
                      onEnhance={() =>
                        handleAiAssist({
                          fieldKey: "callToActionText",
                          fieldLabel: "Texto do Botão CTA",
                          action: "enhance",
                          format: "plain_text",
                          value: callToActionText,
                          onApply: setCallToActionText,
                        })
                      }
                    />
                    <div>
                      <label className="block text-xs font-medium text-novian-text/70 mb-1">Cor Principal (Hex)</label>
                      <div className="flex items-center gap-2">
                        <input name="primaryColor" type="color" className="h-9 w-9 rounded bg-transparent border-0 cursor-pointer" defaultValue={selectedProperty?.landingPage?.primaryColor || '#DEC0A6'} />
                        <input type="text" className="flex-1 bg-novian-surface border border-novian-muted/50 rounded-lg px-3 py-2 text-sm focus:border-novian-accent/50 outline-none font-mono" defaultValue={selectedProperty?.landingPage?.primaryColor || '#DEC0A6'} onChange={(e) => { const el = e.target.previousElementSibling as HTMLInputElement; if (el) el.value = e.target.value; }} />
                      </div>
                    </div>
                  </div>
                  
                  {/* Lead Magnet Configuration */}
                  <div className="pt-4 border-t border-novian-muted/30">
                    <label className="flex items-center gap-2 cursor-pointer mb-4">
                      <input name="showLeadMagnet" type="checkbox" className="rounded border-novian-muted text-novian-accent bg-novian-surface" defaultChecked={selectedProperty?.landingPage?.showLeadMagnet} />
                      <span className="text-sm font-medium text-novian-text">Oferecer Lead Magnet após cadastro? (Ex: E-book, Planta)</span>
                    </label>
                    
                    <div className="pl-6 space-y-4 border-l-2 border-novian-muted/30">
                      <AiInputField
                        label="Título do Material"
                        name="leadMagnetTitle"
                        value={leadMagnetTitle}
                        onChange={setLeadMagnetTitle}
                        isLoading={activeAiField === "leadMagnetTitle"}
                        menuOpen={openAiMenuField === "leadMagnetTitle"}
                        onToggleMenu={() => setOpenAiMenuField((current) => current === "leadMagnetTitle" ? null : "leadMagnetTitle")}
                        onGenerate={() =>
                          handleAiAssist({
                            fieldKey: "leadMagnetTitle",
                            fieldLabel: "Título do Lead Magnet",
                            action: "generate",
                            format: "plain_text",
                            value: leadMagnetTitle,
                            onApply: setLeadMagnetTitle,
                          })
                        }
                        onEnhance={() =>
                          handleAiAssist({
                            fieldKey: "leadMagnetTitle",
                            fieldLabel: "Título do Lead Magnet",
                            action: "enhance",
                            format: "plain_text",
                            value: leadMagnetTitle,
                            onApply: setLeadMagnetTitle,
                          })
                        }
                      />
                      <LeadMagnetUploader fileUrl={leadMagnetFileUrl} onChange={setLeadMagnetFileUrl} />
                    </div>
                  </div>
                </div>
              </section>
              ) : null}

              {activePropertyTab === "documents" ? (
                selectedProperty ? (
                  <DocumentsWorkspace
                    embedded
                    propertyId={selectedProperty.id}
                    title="Documentos do imóvel"
                    description="Gerencie contratos, matrículas, book comercial e demais arquivos vinculados a este imóvel."
                  />
                ) : (
                  <section className="rounded-[24px] border border-dashed border-novian-muted/35 bg-novian-primary/20 px-5 py-12 text-center text-sm text-novian-text/55">
                    Salve o imóvel primeiro para começar a anexar documentos.
                  </section>
                )
              ) : null}

              <div className="pt-6 border-t border-novian-muted/50 flex justify-end gap-3">
                <button type="button" onClick={() => setIsDrawerOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-novian-muted transition-colors">Cancelar</button>
                {activePropertyTab !== "documents" ? (
                  <button type="submit" disabled={isSaving} className="bg-novian-accent text-novian-primary px-6 py-2 rounded-xl text-sm font-semibold hover:bg-white transition-colors disabled:opacity-50">
                    {isSaving ? "Salvando..." : "Salvar Imóvel"}
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {propertyToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-novian-surface border border-novian-muted/50 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-semibold text-novian-text mb-2">Excluir Imóvel</h3>
            <p className="text-novian-text/70 mb-6">
              Tem certeza que deseja excluir o imóvel <strong>{propertyToDelete.title}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setPropertyToDelete(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold hover:bg-novian-muted transition-colors text-novian-text"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDeleteProperty}
                disabled={isDeleting}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsLayout() {
  const searchParams = useSearchParams();
  const [activeSettingsTab, setActiveSettingsTab] = useState<"agents" | "copy" | "fields" | "funnels" | "users" | "profile">("agents");
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newAgent, setNewAgent] = useState({ id: "", name: "", role: "", systemPrompt: "" });
  const [aiCopyPrompt, setAiCopyPrompt] = useState("");
  const [defaultAiCopyPrompt, setDefaultAiCopyPrompt] = useState("");
  const [isLoadingAiCopyPrompt, setIsLoadingAiCopyPrompt] = useState(false);
  const [isSavingAiCopyPrompt, setIsSavingAiCopyPrompt] = useState(false);

  const [funnels, setFunnels] = useState<StoreFunnel[]>([]);
  const [editingFunnel, setEditingFunnel] = useState<StoreFunnel | null>(null);
  const [draggedFunnelColumnId, setDraggedFunnelColumnId] = useState<string | null>(null);
  const [currentAppUser, setCurrentAppUser] = useState<ManagedAppUser | null>(null);
  const [managedUsers, setManagedUsers] = useState<ManagedAppUser[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editingManagedUserId, setEditingManagedUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: "",
    fullName: "",
    userType: "internal" as ManagedUserType,
    role: "broker" as ManagedUserRole,
    permissions: "crm.access, properties.manage",
    isActive: true,
  });

  const fetchFunnels = async () => {
    try {
      const res = await fetch("/api/funnels");
      const data = await res.json();
      setFunnels(data.funnels);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveFunnel = async () => {
    if (!editingFunnel || !editingFunnel.name) return;
    try {
      const res = await fetch("/api/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingFunnel),
      });
      if (!res.ok) {
        throw new Error("Failed to save funnel");
      }
      setEditingFunnel(null);
      fetchFunnels();
    } catch (e) {
      console.error(e);
    }
  };

  const moveEditingFunnelColumn = (sourceId: string, targetId: string) => {
    if (!editingFunnel || sourceId === targetId) return;

    const sourceIndex = editingFunnel.columns.findIndex((column) => column.id === sourceId);
    const targetIndex = editingFunnel.columns.findIndex((column) => column.id === targetId);

    if (sourceIndex === -1 || targetIndex === -1) return;

    const reorderedColumns = [...editingFunnel.columns];
    const [movedColumn] = reorderedColumns.splice(sourceIndex, 1);
    reorderedColumns.splice(targetIndex, 0, movedColumn);

    setEditingFunnel({
      ...editingFunnel,
      columns: reorderedColumns,
    });
  };

  const isEditingExistingFunnel = !!editingFunnel && funnels.some((funnel) => funnel.id === editingFunnel.id);
  const isAdmin = currentAppUser?.role === "admin" && currentAppUser?.user_type === "internal";

  const fetchCurrentAppUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setCurrentAppUser(data.appUser || null);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchManagedUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setManagedUsers(data.users || []);
    } catch (e) {
      console.error(e);
    }
  };

  const resetUserForm = () => {
    setEditingManagedUserId(null);
    setUserForm({
      email: "",
      fullName: "",
      userType: "internal",
      role: "broker",
      permissions: "crm.access, properties.manage",
      isActive: true,
    });
  };

  const populateUserForm = (user: ManagedAppUser) => {
    setEditingManagedUserId(user.id);
    setUserForm({
      email: user.email,
      fullName: user.full_name || "",
      userType: user.user_type,
      role: user.role,
      permissions: (user.permissions || []).join(", "),
      isActive: user.is_active,
    });
    setIsUserFormOpen(true);
  };

  const handleSaveManagedUser = async () => {
    if (!isAdmin || !userForm.email || !userForm.fullName) return;

    setIsSavingUser(true);
    try {
      const payload = {
        email: userForm.email,
        fullName: userForm.fullName,
        userType: userForm.userType,
        role: userForm.userType === "client" ? "client" : userForm.role,
        permissions: userForm.permissions,
        isActive: userForm.isActive,
      };

      const endpoint = editingManagedUserId ? `/api/admin/users/${editingManagedUserId}` : "/api/admin/users";
      const method = editingManagedUserId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save user");
      }

      resetUserForm();
      setIsUserFormOpen(false);
      fetchManagedUsers();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingUser(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAiCopySettings = async () => {
    setIsLoadingAiCopyPrompt(true);
    try {
      const res = await fetch("/api/admin/ai-copy-settings", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load AI copy settings");
      }
      const data = await res.json();
      setAiCopyPrompt(data.prompt || "");
      setDefaultAiCopyPrompt(data.defaultPrompt || "");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingAiCopyPrompt(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchAgents();
    fetchFunnels();
    fetchCurrentAppUser();
    fetchAiCopySettings();
  }, []);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const allowedTabs = new Set(["agents", "fields", "copy", "funnels", "users", "profile"]);
    if (tab && allowedTabs.has(tab)) {
      setActiveSettingsTab(tab as "agents" | "copy" | "fields" | "funnels" | "users" | "profile");
    }
  }, [searchParams]);

  useEffect(() => {
    if (isAdmin) {
      fetchManagedUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin && activeSettingsTab === "users") {
      setActiveSettingsTab("agents");
    }
  }, [isAdmin, activeSettingsTab]);

  const handleAddAgent = async () => {
    if (!newAgent.name || !newAgent.role) return;
    
    // Generate a simple ID if not provided
    const agentId = newAgent.id || newAgent.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newAgent, id: agentId }),
      });
      setIsAdding(false);
      setNewAgent({ id: "", name: "", role: "", systemPrompt: "" });
      fetchAgents();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveAiCopyPrompt = async () => {
    if (!isAdmin) return;

    setIsSavingAiCopyPrompt(true);
    try {
      const res = await fetch("/api/admin/ai-copy-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiCopyPrompt }),
      });

      if (!res.ok) {
        throw new Error("Failed to save AI copy settings");
      }

      const data = await res.json();
      setAiCopyPrompt(data.prompt || "");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingAiCopyPrompt(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-novian-primary overflow-hidden min-w-0">
      <div className="h-16 px-8 flex items-center gap-6 border-b border-novian-muted/50 bg-novian-surface/30 shrink-0">
        <button 
          onClick={() => setActiveSettingsTab("agents")}
          className={`text-sm font-medium transition-colors ${activeSettingsTab === 'agents' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
        >
          Agentes de IA
        </button>
        <button 
          onClick={() => setActiveSettingsTab("fields")}
          className={`text-sm font-medium transition-colors ${activeSettingsTab === 'fields' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
        >
          Campos Personalizados
        </button>
        <button
          onClick={() => setActiveSettingsTab("copy")}
          className={`text-sm font-medium transition-colors ${activeSettingsTab === 'copy' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
        >
          Texto com IA
        </button>
        <button 
          onClick={() => setActiveSettingsTab("funnels")}
          className={`text-sm font-medium transition-colors ${activeSettingsTab === 'funnels' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
        >
          Funis
        </button>
        <button
          onClick={() => setActiveSettingsTab("profile")}
          className={`text-sm font-medium transition-colors ${activeSettingsTab === 'profile' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
        >
          Perfil
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveSettingsTab("users")}
            className={`text-sm font-medium transition-colors ${activeSettingsTab === 'users' ? 'text-novian-accent border-b-2 border-novian-accent h-full' : 'text-novian-text/50 hover:text-novian-text'}`}
          >
            Usuários
          </button>
        )}
      </div>

      <div className="p-8 flex-1 overflow-y-auto">
        <div className={`mx-auto space-y-8 ${activeSettingsTab === "profile" ? "max-w-6xl" : "max-w-4xl"}`}>
          {activeSettingsTab === "agents" && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-novian-text mb-2">Conexões de IA no WhatsApp</h2>
                  <p className="text-sm text-novian-text/60">Atribua um número de WhatsApp dedicado a cada agente de IA escaneando seu código QR. Isso permite que eles operem de forma autônoma usando sua própria foto de perfil e número.</p>
                </div>
                <button 
                  onClick={() => setIsAdding(!isAdding)}
                  className="bg-novian-accent text-novian-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-white transition-colors shrink-0"
                >
                  <Plus size={16} /> Adicionar Agente
                </button>
              </div>

              {isAdding && (
                <div className="bg-novian-surface border border-novian-muted rounded-2xl p-6 space-y-4">
                  <h3 className="font-semibold text-lg text-novian-accent">Novo Agente de IA</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Nome do Agente</label>
                      <input 
                        type="text" 
                        value={newAgent.name}
                        onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                        placeholder="Ex: João Silva"
                        className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Cargo / Função</label>
                      <input 
                        type="text" 
                        value={newAgent.role}
                        onChange={(e) => setNewAgent({ ...newAgent, role: e.target.value })}
                        placeholder="Ex: Suporte ao Cliente"
                        className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-novian-text/60 mb-1">Prompt do Sistema (Opcional)</label>
                    <textarea 
                      value={newAgent.systemPrompt}
                      onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                      placeholder="Instruções de personalidade e restrições de comportamento..."
                      className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent h-24 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setIsAdding(false)} className="px-4 py-2 text-sm text-novian-text/60 hover:text-novian-text">Cancelar</button>
                    <button onClick={handleAddAgent} className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors">Salvar Agente</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {agents.map((agent) => (
                  <WhatsAppInstanceCard 
                    key={agent.id}
                    agent={agent}
                    onUpdate={async (updatedAgent) => {
                      const res = await fetch('/api/agents', {
                        method: 'POST',
                        body: JSON.stringify(updatedAgent),
                        headers: { 'Content-Type': 'application/json' }
                      });
                      if (res.ok) {
                        setAgents(agents.map(a => a.id === agent.id ? updatedAgent : a));
                      }
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {activeSettingsTab === "fields" && (
            <div className="text-center py-20 text-novian-text/50">
               <Settings className="w-16 h-16 mx-auto mb-4 opacity-20" />
               <p className="text-lg mb-2">Gerenciador de Campos Personalizados</p>
               <p className="text-sm max-w-md mx-auto">Em breve: Crie campos dinâmicos (texto, número, dropdown) para o cadastro de Leads. Os campos criados aqui aparecerão automaticamente no formulário de &quot;Novo Lead&quot;.</p>
            </div>
          )}

          {activeSettingsTab === "copy" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-novian-text mb-2">Assistente de Texto com IA</h2>
                <p className="text-sm text-novian-text/60">
                  Configure o prompt base usado para criar e melhorar textos nos campos editoriais do CRM.
                </p>
              </div>

              <div className="rounded-2xl border border-novian-muted bg-novian-surface p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-novian-text">Prompt base</h3>
                    <p className="text-sm text-novian-text/50">Este prompt orienta a IA em títulos, descrições, CTA e textos de landing page.</p>
                  </div>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setAiCopyPrompt(defaultAiCopyPrompt)}
                      className="rounded-full border border-novian-muted/40 px-3 py-1.5 text-xs font-medium text-novian-text/70 transition hover:border-novian-accent/40 hover:text-novian-text"
                    >
                      Restaurar padrão
                    </button>
                  ) : null}
                </div>

                <textarea
                  value={aiCopyPrompt}
                  readOnly={!isAdmin}
                  onChange={(e) => setAiCopyPrompt(e.target.value)}
                  className="h-72 w-full resize-none rounded-2xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm leading-7 text-novian-text outline-none transition focus:border-novian-accent/40 disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Defina aqui o prompt base do assistente de texto."
                />

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-novian-text/45">
                    {isLoadingAiCopyPrompt
                      ? "Carregando prompt..."
                      : isAdmin
                        ? "As alteracoes se aplicam aos botoes de IA dos campos de texto."
                        : "Somente administradores podem alterar este prompt."}
                  </p>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={handleSaveAiCopyPrompt}
                      disabled={isSavingAiCopyPrompt || isLoadingAiCopyPrompt}
                      className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors disabled:opacity-60"
                    >
                      {isSavingAiCopyPrompt ? "Salvando..." : "Salvar Prompt"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === "funnels" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-novian-text mb-2">Funis</h2>
                  <p className="text-sm text-novian-text/60">Crie funis para Leads ou Captação e defina as colunas de cada fluxo no Kanban.</p>
                </div>
                <button 
                  onClick={() => setEditingFunnel({ id: `funnel-${Date.now()}`, name: "Novo Funil", type: "lead", columns: [] })}
                  className="bg-novian-accent text-novian-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-white transition-colors"
                >
                  <Plus size={16} /> Adicionar Funil
                </button>
              </div>

              {editingFunnel ? (
                <div className="bg-novian-surface border border-novian-muted rounded-2xl p-6 space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                  <div>
                    <label className="block text-xs text-novian-text/60 mb-1">Nome do Funil</label>
                    <input 
                      type="text" 
                      value={editingFunnel.name}
                      onChange={(e) => setEditingFunnel({ ...editingFunnel, name: e.target.value })}
                      className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent"
                      placeholder="Ex: Vendas de Imóveis"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-novian-text/60 mb-1">Tipo do Funil</label>
                    <PopupSelect
                      value={editingFunnel.type}
                      disabled={isEditingExistingFunnel}
                      onChange={(value) => setEditingFunnel({ ...editingFunnel, type: value as FunnelType })}
                      options={[
                        { value: "lead", label: "Lead" },
                        { value: "captacao", label: "Captação" },
                      ]}
                    />
                    {isEditingExistingFunnel && (
                      <p className="mt-2 text-xs text-novian-text/45">O tipo do funil é definido na criação para evitar conflito entre Leads e Captação.</p>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs text-novian-text/60">Colunas do Funil (Esquerda para Direita)</label>
                      <button 
                        onClick={() => setEditingFunnel({ 
                          ...editingFunnel, 
                          columns: [...editingFunnel.columns, { id: `col-${Date.now()}`, title: "Nova Coluna", color: "border-blue-500/30 text-blue-400 bg-blue-500/10" }] 
                        })}
                        className="text-xs text-novian-accent hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <Plus size={12} /> Adicionar Coluna
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {editingFunnel.columns.map((col, index) => (
                        <div
                          key={col.id}
                          draggable
                          onDragStart={(event) => {
                            setDraggedFunnelColumnId(col.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", col.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const sourceId = draggedFunnelColumnId || event.dataTransfer.getData("text/plain");
                            if (sourceId) {
                              moveEditingFunnelColumn(sourceId, col.id);
                            }
                            setDraggedFunnelColumnId(null);
                          }}
                          onDragEnd={() => setDraggedFunnelColumnId(null)}
                          className={`flex items-center gap-3 bg-novian-primary p-3 rounded-lg border transition-colors ${
                            draggedFunnelColumnId === col.id
                              ? "border-novian-accent/70 opacity-60"
                              : "border-novian-muted/50"
                          }`}
                        >
                          <button
                            type="button"
                            className="text-novian-text/35 hover:text-novian-accent cursor-grab active:cursor-grabbing"
                            title="Drag to reorder"
                          >
                            <GripVertical size={16} />
                          </button>
                          <div className="flex-1">
                            <input 
                              type="text" 
                              value={col.title}
                              onChange={(e) => {
                                const newCols = [...editingFunnel.columns];
                                newCols[index].title = e.target.value;
                                setEditingFunnel({ ...editingFunnel, columns: newCols });
                              }}
                              placeholder="Título da coluna"
                              className="w-full bg-transparent text-sm focus:outline-none focus:text-novian-accent"
                            />
                          </div>
                          <div className="flex gap-1.5 items-center">
                            {COLOR_PRESETS.map(preset => (
                              <button 
                                key={preset.id}
                                onClick={() => {
                                  const newCols = [...editingFunnel.columns];
                                  newCols[index].color = preset.classes;
                                  setEditingFunnel({ ...editingFunnel, columns: newCols });
                                }}
                                className={`w-5 h-5 rounded-full ${preset.bg} ${col.color === preset.classes ? 'ring-2 ring-white ring-offset-2 ring-offset-novian-primary' : 'opacity-30 hover:opacity-100 transition-opacity'}`}
                              />
                            ))}
                          </div>
                          <button 
                            onClick={() => {
                              const newCols = editingFunnel.columns.filter((_, i) => i !== index);
                              setEditingFunnel({ ...editingFunnel, columns: newCols });
                            }}
                            className="text-red-400 hover:text-red-300 ml-2 p-1"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {editingFunnel.columns.length === 0 && (
                        <div className="text-center py-6 bg-novian-primary/50 border border-dashed border-novian-muted rounded-lg">
                          <p className="text-xs text-novian-text/50">Nenhuma coluna adicionada.</p>
                        </div>
                      )}
                      {editingFunnel.columns.length > 1 && (
                        <p className="text-xs text-novian-text/45">Drag and drop the columns to organize the funnel from left to right.</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-novian-text/50">
                        Configuracao de People
                      </div>
                      <div className="mt-2 text-sm text-novian-text/55">
                        Automacoes de perfis, tags e pontos ficam no proprio funil para centralizar a configuracao do pipeline.
                      </div>
                    </div>
                    <FunnelAutomationSettings
                      funnelId={editingFunnel.id}
                      funnelName={editingFunnel.name}
                      funnelType={editingFunnel.type}
                      columns={editingFunnel.columns}
                      disabled={!isEditingExistingFunnel}
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-novian-muted/50">
                    <button onClick={() => setEditingFunnel(null)} className="px-4 py-2 text-sm text-novian-text/60 hover:text-novian-text transition-colors">Cancelar</button>
                    <button onClick={handleSaveFunnel} className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors">Salvar Funil</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {funnels.map((funnel) => (
                    <div key={funnel.id} className="bg-novian-surface border border-novian-muted rounded-2xl p-6 flex flex-col relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg text-novian-text">{funnel.name}</h3>
                          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            funnel.type === 'captacao'
                              ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
                              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          }`}>
                            {funnel.type === 'captacao' ? 'Captação' : 'Lead'}
                          </span>
                        </div>
                        <button 
                          onClick={() => setEditingFunnel(funnel)}
                          className="text-sm font-medium text-novian-text/50 hover:text-novian-accent transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-auto pt-2 border-t border-novian-muted/30">
                        {funnel.columns.length > 0 ? funnel.columns.map(col => (
                          <span key={col.id} className={`text-xs px-2 py-1 rounded-md border ${col.color}`}>
                            {col.title}
                          </span>
                        )) : (
                          <span className="text-xs text-novian-text/40 italic">Sem colunas configuradas</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSettingsTab === "users" && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-novian-text mb-2">Usuários e Acessos</h2>
                  <p className="text-sm text-novian-text/60">
                    Crie corretores, administradores e clientes, definindo perfil, permissões e acesso ao portal.
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (isUserFormOpen) {
                      setIsUserFormOpen(false);
                      resetUserForm();
                      return;
                    }
                    resetUserForm();
                    setIsUserFormOpen(true);
                  }}
                  className="bg-novian-accent text-novian-primary px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-white transition-colors"
                >
                  <Plus size={16} /> {isUserFormOpen ? "Fechar" : "Adicionar Usuário"}
                </button>
              </div>

              {isUserFormOpen && (
                <div className="bg-novian-surface border border-novian-muted rounded-2xl p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Nome completo</label>
                      <input
                        type="text"
                        value={userForm.fullName}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, fullName: e.target.value }))}
                        className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent"
                        placeholder="Ex: Mariana Costa"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Email</label>
                      <input
                        type="email"
                        value={userForm.email}
                        disabled={!!editingManagedUserId}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent disabled:opacity-60"
                        placeholder="nome@empresa.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Tipo de usuário</label>
                      <PopupSelect
                        value={userForm.userType}
                        onChange={(value) => {
                          const nextType = value as ManagedUserType;
                          setUserForm((prev) => ({
                            ...prev,
                            userType: nextType,
                            role: nextType === "client" ? "client" : "broker",
                            permissions: nextType === "client" ? "client.portal.access" : prev.permissions || "crm.access, properties.manage",
                          }));
                        }}
                        options={[
                          { value: "internal", label: "Interno" },
                          { value: "client", label: "Cliente" },
                        ]}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-novian-text/60 mb-1">Papel</label>
                      <PopupSelect
                        value={userForm.role}
                        disabled={userForm.userType === "client"}
                        onChange={(value) => setUserForm((prev) => ({ ...prev, role: value as ManagedUserRole }))}
                        options={
                          userForm.userType === "client"
                            ? [{ value: "client", label: "Cliente" }]
                            : [
                                { value: "broker", label: "Corretor" },
                                { value: "admin", label: "Admin" },
                              ]
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-novian-text/60 mb-1">Permissões</label>
                    <input
                      type="text"
                      value={userForm.permissions}
                      onChange={(e) => setUserForm((prev) => ({ ...prev, permissions: e.target.value }))}
                      className="w-full bg-novian-primary border border-novian-muted rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-novian-accent"
                      placeholder="crm.access, users.manage, client.portal.access"
                    />
                    <p className="mt-2 text-xs text-novian-text/45">
                      Use uma lista separada por vírgulas para guardar permissões personalizadas.
                    </p>
                  </div>

                  {editingManagedUserId && (
                    <label className="flex items-center justify-between rounded-2xl border border-novian-muted/40 bg-novian-primary/50 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-novian-text">Usuário ativo</div>
                        <div className="text-xs text-novian-text/50">Desative para bloquear o login sem apagar o histórico.</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={userForm.isActive}
                        onChange={(e) => setUserForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                        className="h-4 w-4 accent-novian-accent"
                      />
                    </label>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      onClick={() => {
                        setIsUserFormOpen(false);
                        resetUserForm();
                      }}
                      className="px-4 py-2 text-sm text-novian-text/60 hover:text-novian-text"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveManagedUser}
                      disabled={isSavingUser}
                      className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors disabled:opacity-60"
                    >
                      {isSavingUser ? "Salvando..." : editingManagedUserId ? "Salvar Usuário" : "Enviar Convite"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {managedUsers.map((user) => (
                  <div key={user.id} className="bg-novian-surface border border-novian-muted rounded-2xl p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg text-novian-text">{user.full_name || user.email}</h3>
                        <p className="mt-1 text-sm text-novian-text/50">{user.email}</p>
                      </div>
                      <button
                        onClick={() => populateUserForm(user)}
                        className="text-sm font-medium text-novian-text/50 hover:text-novian-accent transition-colors"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        user.user_type === "client"
                          ? "border-blue-500/20 bg-blue-500/10 text-blue-300"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      }`}>
                        {user.user_type === "client" ? "Cliente" : "Interno"}
                      </span>
                      <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-novian-text/70">
                        {user.role}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        user.is_active
                          ? "border-green-500/20 bg-green-500/10 text-green-300"
                          : "border-red-500/20 bg-red-500/10 text-red-300"
                      }`}>
                        {user.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-novian-text/45">
                        Permissões
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(user.permissions || []).length > 0 ? (
                          user.permissions.map((permission) => (
                            <span key={permission} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-novian-text/75">
                              {permission}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-novian-text/40 italic">Sem permissões adicionais</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {managedUsers.length === 0 && (
                <div className="rounded-2xl border border-dashed border-novian-muted bg-novian-surface/30 px-6 py-12 text-center text-sm text-novian-text/50">
                  Nenhum usuário cadastrado ainda.
                </div>
              )}
            </div>
          )}

          {activeSettingsTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-novian-text mb-2">Perfil</h2>
                <p className="text-sm text-novian-text/60">
                  Atualize seus dados de conta, foto e informacoes exibidas na plataforma.
                </p>
              </div>
              <AccountProfileForm />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WhatsAppInstanceCard({ agent, onUpdate }: { agent: AgentConfig, onUpdate: (agent: AgentConfig) => void }) {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "qr_ready" | "connected">("disconnected");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt || "");
  const [knowledgeBase, setKnowledgeBase] = useState(agent.knowledgeBase || "");
  const [modules, setModules] = useState<string[]>(agent.modules || []);

  const agentId = agent.id;
  const agentName = agent.name;
  const agentRole = agent.role;

  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/whatsapp/${agentId}?t=${Date.now()}`, { cache: 'no-store' });
        const data = await res.json();
        if (isMounted) {
          setStatus(data.state);
          if (data.qrDataUri) setQrCode(data.qrDataUri);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchStatus();
    return () => {
      isMounted = false;
    };
  }, [agentId]);

  useEffect(() => {
    if (status === "disconnected") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/whatsapp/${agentId}?t=${Date.now()}`, { cache: "no-store" });
        const data = await res.json();
        setStatus(data.state);
        setQrCode(data.qrDataUri || null);
      } catch (error) {
        console.error(error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [agentId, status]);

  const handleConnect = async () => {
    try {
      setStatus("connecting");
      const res = await fetch(`/api/whatsapp/${agentId}`, { method: "POST" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("disconnected");
        throw new Error(data?.error || `Failed to connect WhatsApp for ${agentId}`);
      }

      const session = data?.session;
      if (session?.state) {
        setStatus(session.state);
      }
      if (session?.qrDataUri) {
        setQrCode(session.qrDataUri);
      }
    } catch (error) {
      setStatus("disconnected");
      console.error(error);
    }
  };

  const handleDisconnect = async () => {
    setStatus("disconnected");
    setQrCode(null);
    await fetch(`/api/whatsapp/${agentId}`, { method: "DELETE" });
  };

  return (
    <div className={`bg-novian-surface border border-novian-muted rounded-2xl p-6 flex flex-col ${isEditing ? '' : 'h-72'} relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-lg text-novian-accent">{agentName}</h3>
          <p className="text-xs text-novian-text/50">{agentRole}</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="px-2 py-1 text-xs text-novian-text/60 hover:text-novian-accent transition-colors border border-novian-muted/50 rounded-md"
          >
            {isEditing ? "Fechar" : "Configurar"}
          </button>
          <div className={`px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${
            status === 'connected' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            status === 'qr_ready' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse' :
            'bg-novian-muted text-novian-text/50 border border-novian-muted/50'
          }`}>
            {status.replace('_', ' ')}
          </div>
        </div>
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-4 animate-in slide-in-from-top-2">
          <div>
            <label className="block text-xs text-novian-text/60 mb-1">Módulos (Acesso a dados)</label>
            <div className="flex gap-2 flex-wrap">
              {['leads', 'captacao', 'imoveis'].map(mod => (
                <button
                  key={mod}
                  onClick={() => {
                    if (modules.includes(mod)) {
                      setModules(modules.filter(m => m !== mod));
                    } else {
                      setModules([...modules, mod]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    modules.includes(mod) 
                      ? 'bg-novian-accent/20 border-novian-accent text-novian-accent' 
                      : 'bg-novian-primary border-novian-muted text-novian-text/50 hover:border-novian-text/30'
                  }`}
                >
                  {mod.charAt(0).toUpperCase() + mod.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-novian-text/60 mb-1">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              className="w-full bg-novian-primary border border-novian-muted rounded-lg p-2 text-xs focus:outline-none focus:border-novian-accent h-24 resize-none"
              placeholder="Instruções para o agente..."
            />
          </div>
          <div>
            <label className="block text-xs text-novian-text/60 mb-1">Base de Conhecimento (Contexto adicional)</label>
            <textarea
              value={knowledgeBase}
              onChange={e => setKnowledgeBase(e.target.value)}
              className="w-full bg-novian-primary border border-novian-muted rounded-lg p-2 text-xs focus:outline-none focus:border-novian-accent h-24 resize-none"
              placeholder="Informações sobre a empresa, produtos, etc..."
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                onUpdate({ ...agent, systemPrompt, knowledgeBase, modules });
                setIsEditing(false);
              }}
              className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white transition-colors"
            >
              Salvar Configurações
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-novian-muted rounded-xl bg-novian-primary/30 p-4">
            {status === 'disconnected' && (
              <div className="text-center">
                <QrCode className="w-12 h-12 mx-auto text-novian-text/20 mb-3" />
                <button onClick={handleConnect} className="bg-novian-accent text-novian-primary px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white transition-colors">
                  Gerar QR Code
                </button>
              </div>
            )}

            {status === 'connecting' && (
              <div className="text-center text-novian-text/60">
                <LoaderCircle className="w-8 h-8 mx-auto mb-2 animate-spin text-novian-accent" />
                <p className="text-sm">Inicializando Conexão...</p>
              </div>
            )}

            {status === 'qr_ready' && qrCode && (
              <div className="text-center flex flex-col items-center">
                <div className="bg-white p-2 rounded-xl">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={qrCode} alt="WhatsApp QR Code" className="w-32 h-32" />
                </div>
                <p className="text-xs text-novian-text/60 mt-3 max-w-[200px]">Abra o WhatsApp no dispositivo de {agentName} e escaneie para vincular.</p>
              </div>
            )}

            {status === 'connected' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="text-green-400 w-8 h-8" />
                </div>
                <p className="text-sm text-green-400 font-medium">Sessão Ativa</p>
                <p className="text-xs text-novian-text/50 mt-1">Ouvindo mensagens</p>
              </div>
            )}
          </div>

          {status === 'connected' && (
             <button onClick={handleDisconnect} className="absolute bottom-4 right-4 text-[10px] text-red-400 hover:text-red-300 underline">
               Forçar Desconexão
             </button>
          )}
        </>
      )}
    </div>
  )
}

function ChatInput({ onSendMessage }: { onSendMessage: (msg: string) => void }) {
  const [inputMessage, setInputMessage] = useState("");

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    onSendMessage(inputMessage);
    setInputMessage("");
  };

  return (
    <div className="p-6 shrink-0">
      <div className="relative flex items-center shadow-sm">
        <input 
          type="text" 
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Envie uma mensagem para a equipe de IA ou dê um comando..." 
          className="w-full bg-novian-surface/80 rounded-xl pl-5 pr-12 py-4 text-sm focus:outline-none focus:bg-novian-surface focus:ring-1 focus:ring-novian-accent/50 transition-all border-none"
        />
        <button onClick={handleSend} className="absolute right-3 p-2 bg-novian-accent text-novian-primary rounded-lg hover:bg-white transition-colors">
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function WarRoomLayout() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>("general");
  const [activeThreadTab, setActiveThreadTab] = useState<LeadContextTab>("overview");
  const [typingAgent, setTypingAgent] = useState<string | null>(null);
  const [seenMessageIds, setSeenMessageIds] = useState<Set<string>>(new Set());
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [activeThreadLiveProfile, setActiveThreadLiveProfile] = useState<LiveThreadWhatsAppProfile | null>(null);
  const [isRefreshingActiveThreadProfile, setIsRefreshingActiveThreadProfile] = useState(false);
  const activeThreadProfileRequestRef = useRef(0);

  const fetchWarRoomData = async () => {
    try {
      const res = await fetch("/api/warroom", { cache: 'no-store' });
      const data = await res.json();
      setThreads(data.threads);

      // If we have an active thread, fetch its specific messages
      if (activeThreadId) {
        const threadRes = await fetch(`/api/warroom/${encodeURIComponent(activeThreadId)}`, { cache: 'no-store' });
        const threadData = await threadRes.json();
        
        setMessages(prev => {
           const newMsgs = threadData.messages as ChatMessage[];
           if (prev.length === 0 || prev[0]?.threadId !== activeThreadId) {
              // Initial load for this thread, don't type these out
              setSeenMessageIds(new Set(newMsgs.map(m => m.id)));
           }
           return newMsgs;
        });
        setTypingAgent(threadData.typing);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Failed to load agents");
      }

      const data = await res.json();
      setAgents(Array.isArray(data.agents) ? data.agents : []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // Initial fetch inside effect to avoid synchronous setState warnings
    let isMounted = true;
    const initFetch = async () => {
      await fetchWarRoomData();
    };
    initFetch();
    
    const interval = setInterval(fetchWarRoomData, 2000); // Poll every 2s
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeThreadId]);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    setActiveThreadTab("overview");
  }, [activeThreadId]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !activeThreadId) return;

    setTypingAgent("System");

    try {
      // Create endpoint payload. If it's continuous ops, maybe we handle it slightly differently in backend, but same API works.
      await fetch(`/api/warroom/${encodeURIComponent(activeThreadId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, agent: "Hélder Perez", role: "CEO" }),
      });
      // Force an immediate fetch to see our message
      await fetchWarRoomData();
    } catch (e) {
      console.error(e);
      setTypingAgent(null);
    }
  };

  const activeThread = activeThreadId ? threads.find((thread) => thread.id === activeThreadId) || null : null;
  const activeThreadAgentId =
    typeof activeThread?.customData?.agent_id === "string"
      ? activeThread.customData.agent_id
      : activeThread?.agentIds?.[0];
  const activeAgent = activeThreadAgentId ? agents.find((agent) => agent.id === activeThreadAgentId) || null : null;
  const activeThreadProfileForView =
    activeThreadLiveProfile && activeThread && activeThreadLiveProfile.threadId === activeThread.id
      ? activeThreadLiveProfile
      : null;
  const activeThreadCustomData = activeThread
    ? mergeThreadCustomDataWithLiveProfile(activeThread.customData, activeThreadProfileForView)
    : undefined;
  const activeThreadTitle = activeThread ? getThreadDisplayTitle(activeThread, activeThreadProfileForView) : "";
  const activeThreadPhone = activeThread ? getThreadDisplayPhone(activeThread, activeThreadProfileForView) : "";
  const activeThreadMetadataDetails = activeThread ? getLeadMetadataDetails(activeThreadCustomData) : [];
  const activeClientAvatarUrl =
    typeof activeThreadCustomData?.whatsapp_profile_picture_url === "string"
      ? activeThreadCustomData.whatsapp_profile_picture_url
      : undefined;
  const headerAgents = activeThread && activeAgent ? [activeAgent] : agents.slice(0, 2);
  const activeThreadProfileAgentId =
    activeThread &&
    typeof activeThread.customData?.agent_id === "string" &&
    activeThread.customData.agent_id
      ? activeThread.customData.agent_id
      : activeThread?.agentIds?.[0] || "mariana-sdr";
  const activeThreadProfileJid =
    activeThread &&
    typeof activeThread.customData?.whatsapp_jid === "string" &&
    activeThread.customData.whatsapp_jid
      ? activeThread.customData.whatsapp_jid
      : activeThreadId;

  const fetchActiveThreadWhatsAppProfile = async (
    threadOverride: Thread | null = activeThread,
    options?: { syncLists?: boolean },
  ) => {
    if (!threadOverride || threadOverride.id === "general" || threadOverride.id === "continuous") {
      setActiveThreadLiveProfile(null);
      return null;
    }

    const agentId =
      typeof threadOverride.customData?.agent_id === "string" && threadOverride.customData.agent_id
        ? threadOverride.customData.agent_id
        : threadOverride.agentIds?.[0] || "mariana-sdr";
    const jid =
      typeof threadOverride.customData?.whatsapp_jid === "string" && threadOverride.customData.whatsapp_jid
        ? threadOverride.customData.whatsapp_jid
        : threadOverride.id;

    if (!jid) {
      setActiveThreadLiveProfile(null);
      return null;
    }

    const requestId = ++activeThreadProfileRequestRef.current;
    setIsRefreshingActiveThreadProfile(true);

    try {
      const response = await fetch(
        `/api/whatsapp/${encodeURIComponent(agentId)}?jid=${encodeURIComponent(jid)}`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`Failed to load WhatsApp profile (${response.status})`);
      }

      const data = await response.json();
      const refreshed = data?.refreshed as LiveThreadWhatsAppProfile | undefined;
      const nextProfile =
        refreshed && typeof refreshed === "object"
          ? {
              threadId: threadOverride.id,
              phone: typeof refreshed.phone === "string" ? refreshed.phone : null,
              profile: refreshed.profile && typeof refreshed.profile === "object" ? refreshed.profile : null,
            }
          : null;

      if (activeThreadProfileRequestRef.current === requestId) {
        setActiveThreadLiveProfile(nextProfile);
      }

      if (options?.syncLists) {
        await fetchWarRoomData();
        await fetchAgents();
      }

      return nextProfile;
    } catch (error) {
      if (activeThreadProfileRequestRef.current === requestId) {
        setActiveThreadLiveProfile(null);
      }
      console.error("Failed to load live WhatsApp profile", error);
      return null;
    } finally {
      if (activeThreadProfileRequestRef.current === requestId) {
        setIsRefreshingActiveThreadProfile(false);
      }
    }
  };

  useEffect(() => {
    if (!activeThreadId || activeThreadId === "general" || activeThreadId === "continuous" || !activeThreadProfileJid) {
      setActiveThreadLiveProfile(null);
      setIsRefreshingActiveThreadProfile(false);
      return;
    }

    let isCancelled = false;
    const requestId = ++activeThreadProfileRequestRef.current;
    const agentId = activeThreadProfileAgentId;
    const jid = activeThreadProfileJid;

    setIsRefreshingActiveThreadProfile(true);

    const loadLiveProfile = async () => {
      try {
        const response = await fetch(
          `/api/whatsapp/${encodeURIComponent(agentId)}?jid=${encodeURIComponent(jid)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error(`Failed to load WhatsApp profile (${response.status})`);
        }

        const data = await response.json();
        const refreshed = data?.refreshed as LiveThreadWhatsAppProfile | undefined;
        const nextProfile =
          refreshed && typeof refreshed === "object"
            ? {
                threadId: activeThreadId,
                phone: typeof refreshed.phone === "string" ? refreshed.phone : null,
                profile: refreshed.profile && typeof refreshed.profile === "object" ? refreshed.profile : null,
              }
            : null;

        if (!isCancelled && activeThreadProfileRequestRef.current === requestId) {
          setActiveThreadLiveProfile(nextProfile);
        }
      } catch (error) {
        if (!isCancelled && activeThreadProfileRequestRef.current === requestId) {
          setActiveThreadLiveProfile(null);
        }
        console.error("Failed to auto-load live WhatsApp profile", error);
      } finally {
        if (!isCancelled && activeThreadProfileRequestRef.current === requestId) {
          setIsRefreshingActiveThreadProfile(false);
        }
      }
    };

    void loadLiveProfile();

    return () => {
      isCancelled = true;
    };
  }, [activeThreadId, activeThreadProfileAgentId, activeThreadProfileJid]);

  return (
    <>
      {/* Channels / Threads List */}
      <div className="w-72 lg:w-80 border-r border-novian-muted/50 bg-novian-surface/30 flex flex-col shrink-0">
        <div className="h-16 px-4 border-b border-novian-muted/50 flex justify-between items-center shrink-0">
          <h2 className="text-sm font-semibold tracking-wider text-novian-text/70 uppercase">Leads Ativos</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <ThreadItem 
            key="general"
            title="#general-command" 
            preview="Fale diretamente com sua equipe de IA." 
            time="Agora" 
            active={activeThreadId === "general"} 
            onClick={() => setActiveThreadId("general")}
          />
          <ThreadItem 
            key="continuous"
            title="#continuous-ops" 
            preview="Trabalho autônomo em segundo plano." 
            time="24/7" 
            active={activeThreadId === "continuous"} 
            onClick={() => setActiveThreadId("continuous")}
          />
          
          <div className="my-4"></div>

          {threads.length === 0 ? (
             <div className="text-center text-xs text-novian-text/40 mt-4">Nenhum lead ativo ainda. Envie uma mensagem para o WhatsApp de um agente para começar.</div>
          ) : (
            threads.map((thread) => (
              <ThreadItem 
                key={thread.id}
                title={thread.title} 
                preview={thread.preview} 
                time={thread.time} 
                active={activeThreadId === thread.id} 
                unread={thread.unread}
                onClick={() => setActiveThreadId(thread.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Active Chat Area */}
      <div className="flex-1 flex flex-col bg-novian-primary relative min-w-0">
        {activeThreadId ? (
          <>
            {/* Thread Header */}
            <div className="h-16 border-b border-novian-muted/50 flex items-center px-6 gap-4 shrink-0 bg-novian-surface/30">
              <h2 className="text-lg font-medium text-novian-accent">
                {activeThreadId === "general" ? "#general-command" : activeThreadTitle || "Chat"}
              </h2>
              <div className="flex -space-x-2">
                {headerAgents.length > 0 ? (
                  headerAgents.map((agent) => {
                    const agentName = agent.whatsappDisplayName || agent.name;
                    return (
                      <AgentAvatar
                        key={agent.id}
                        name={agentName}
                        initials={agentName.substring(0, 2).toUpperCase()}
                        avatarUrl={agent.whatsappProfilePictureUrl}
                      />
                    );
                  })
                ) : (
                  <>
                    <AgentAvatar name="Mariana (SDR)" initials="MS" />
                    <AgentAvatar name="Daniel (Dir)" initials="DR" />
                  </>
                )}
              </div>
              <span className="text-xs text-novian-text/50 ml-2">Agentes ativos</span>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col-reverse min-w-0">
              <div className="space-y-6">
                {messages.map((msg) => {
                  const isNew = !seenMessageIds.has(msg.id) && msg.role !== 'Client' && msg.role !== 'CEO' && !msg.isSystem;
                  
                  return msg.isSystem ? (
                    <div key={msg.id} className="flex items-center justify-center my-4">
                      <div className="bg-novian-surface px-4 py-1.5 rounded-full text-xs text-novian-text/60 flex items-center gap-2">
                        <Search size={12} className="text-novian-accent" />
                        System: {msg.content}
                      </div>
                    </div>
                  ) : (
                    <Message 
                      key={msg.id}
                      id={msg.id}
                      agent={msg.agent} 
                      time={msg.time}
                      role={msg.role}
                      content={msg.content}
                      isClient={msg.role === 'Client'}
                      shouldType={isNew}
                      avatarUrl={
                        msg.role === 'Client'
                          ? activeClientAvatarUrl
                          : msg.role === 'CEO'
                            ? undefined
                            : activeAgent?.whatsappProfilePictureUrl
                      }
                      onComplete={() => setSeenMessageIds(prev => new Set([...prev, msg.id]))}
                    />
                  )
                })}
                {typingAgent && (
                  <Message 
                    agent={typingAgent.split(" ")[0]} 
                    time="Digitando..."
                    role={typingAgent.includes("(") ? typingAgent.split("(")[1].replace(")", "") : "AI Agent"}
                    content=""
                    isTyping={true}
                    avatarUrl={activeAgent?.whatsappProfilePictureUrl}
                  />
                )}
              </div>
            </div>

            {/* Input Area */}
            <ChatInput onSendMessage={handleSendMessage} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-novian-text/30">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <p>Selecione uma conversa para visualizar o Chat</p>
          </div>
        )}
      </div>
      
      {/* Right Sidebar - Context/Details */}
      <div className="hidden xl:flex w-72 2xl:w-80 border-l border-novian-muted/50 bg-novian-surface/30 flex-col shrink-0">
         <div className="h-16 px-6 border-b border-novian-muted/50 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-semibold tracking-wider text-novian-accent uppercase">Contexto do Lead</h3>
            {activeThread && (
              <button
                onClick={() => void fetchActiveThreadWhatsAppProfile(activeThread, { syncLists: true })}
                disabled={isRefreshingActiveThreadProfile}
                className="text-[10px] bg-novian-muted/50 hover:bg-novian-muted text-novian-text/80 px-2 py-1 rounded transition-colors"
              >
                {isRefreshingActiveThreadProfile ? "↻ Atualizando..." : "↻ Atualizar"}
              </button>
            )}
         </div>
         <div className="p-6 flex-1 overflow-y-auto">
            {activeThread ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-novian-muted/20 p-3 rounded-xl border border-novian-muted/30">
                  {typeof activeThreadCustomData?.whatsapp_profile_picture_url === "string" ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={String(activeThreadCustomData.whatsapp_profile_picture_url)} 
                        alt="WhatsApp Profile" 
                        className="w-16 h-16 rounded-full object-cover border-2 border-novian-muted"
                      />
                    </>
                  ) : (
                    <div className="w-16 h-16 rounded-full border-2 border-novian-muted bg-novian-primary/60 flex items-center justify-center text-lg font-semibold text-novian-text">
                      {(activeThreadTitle || activeThreadPhone).slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-novian-text truncate">{activeThreadTitle}</p>
                      {isRefreshingActiveThreadProfile && <LoaderCircle size={14} className="animate-spin text-novian-accent shrink-0" />}
                    </div>
                    <p className="text-xs text-novian-text/60 font-mono break-all">{activeThreadPhone || "Nao informado"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-1">Telefone</p>
                    <p className="font-mono text-sm text-novian-text/80 break-all">{activeThreadPhone || "Nao informado"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-1">Atendido Por</p>
                    <p className="text-sm text-novian-text/80">
                      {activeAgent?.whatsappPhone || activeAgent?.whatsappDisplayName || activeAgent?.name || "Agente conectado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-1">Status (Funil)</p>
                    <span className="inline-block mt-1 bg-novian-muted/30 text-novian-text px-2.5 py-1 rounded-md border border-novian-muted/50 text-xs font-medium">
                      {activeThread.status || 'Novo Lead'}
                    </span>
                  </div>
                  {activeThread.score !== undefined && (
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-1">Score IA</p>
                      <div className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md border mt-1 ${
                        activeThread.score > 30 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 
                        activeThread.score > 15 ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        <Flame size={12} />
                        {activeThread.score} pts
                      </div>
                    </div>
                  )}
                </div>
                <LeadContextTabs value={activeThreadTab} onChange={setActiveThreadTab} />

                {activeThreadTab === "overview" && (
                  <>
                    {activeThreadMetadataDetails.length > 0 && (
                      <div className="pt-4 border-t border-novian-muted/30">
                        <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-3">Detalhes do Contato</p>
                        <div className="space-y-3">
                          {activeThreadMetadataDetails.map((detail) => (
                            <div key={detail.label}>
                              <p className="text-[10px] uppercase text-novian-text/40">{detail.label}</p>
                              {detail.href ? (
                                <a
                                  href={detail.href}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm text-novian-accent hover:text-white transition-colors break-all"
                                >
                                  {detail.value}
                                </a>
                              ) : (
                                <p className="text-sm text-novian-text/80 break-all">{detail.value}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(typeof activeThreadCustomData?.whatsapp_about === "string" ||
                      typeof activeThreadCustomData?.whatsapp_business_description === "string") && (
                      <div className="pt-4 border-t border-novian-muted/30">
                        <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-3">Perfil WhatsApp</p>
                        <div className="bg-novian-muted/10 p-3 rounded-xl border border-novian-muted/30 space-y-3">
                          {typeof activeThreadCustomData?.whatsapp_about === "string" && (
                            <div>
                              <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Recado</p>
                              <p className="text-sm italic text-novian-text/90">&quot;{String(activeThreadCustomData.whatsapp_about)}&quot;</p>
                            </div>
                          )}
                          {typeof activeThreadCustomData?.whatsapp_business_description === "string" && (
                            <div className="pt-2 border-t border-novian-muted/20">
                              <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Descrição</p>
                              <p className="text-sm text-novian-text/80">{String(activeThreadCustomData.whatsapp_business_description)}</p>
                            </div>
                          )}
                          {typeof activeThreadCustomData?.whatsapp_business_category === "string" && (
                            <div className="pt-2 border-t border-novian-muted/20">
                              <p className="text-[10px] uppercase text-novian-text/50 mb-1 font-semibold">Categoria</p>
                              <p className="text-sm text-novian-text/80">{String(activeThreadCustomData.whatsapp_business_category)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {getLeadCustomEntries(activeThreadCustomData).length > 0 && (
                      <div className="pt-4 border-t border-novian-muted/30">
                        <p className="text-xs font-semibold tracking-wider text-novian-text/50 uppercase mb-3">Dados Adicionais</p>
                        <div className="space-y-3">
                          {getLeadCustomEntries(activeThreadCustomData).map(([key, value]) => (
                            <div key={key}>
                              <p className="text-[10px] uppercase text-novian-text/40">{key}</p>
                              <p className="text-sm text-novian-text/80 truncate" title={String(value)}>{String(value)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {activeThreadTab === "notes" && (
                  <LeadNotesPanel
                    leadId={activeThread.leadId}
                    customData={activeThread.customData}
                    onSaved={fetchWarRoomData}
                  />
                )}
              </div>
            ) : activeThreadId === "general" || activeThreadId === "continuous" ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-novian-text/50">Status</p>
                  <span className="inline-block mt-1 bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-md border border-green-500/30">
                    Sistema Operacional
                  </span>
                </div>
                <p className="text-xs text-novian-text/60 leading-relaxed">
                  Este é um canal interno do sistema para você dar comandos aos agentes ou monitorar tarefas em segundo plano.
                </p>
              </div>
            ) : (
              <p className="text-xs text-novian-text/40">Nenhum lead selecionado</p>
            )}
         </div>
      </div>
    </>
  )
}

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="min-w-0 rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">{label}</div>
      <div className="mt-4 text-4xl font-semibold text-novian-text">{value}</div>
      <div className="mt-3 text-sm text-novian-text/55">{hint}</div>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: DashboardBreakdownItem[];
  emptyMessage: string;
}) {
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="text-sm leading-6 text-novian-text/55">{subtitle}</div>

      <div className="mt-6 space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-novian-text/75">{getDashboardLabel(item.label)}</span>
                <span className="font-semibold text-novian-text">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-novian-primary/80">
                <div
                  className="h-2 rounded-full bg-novian-accent"
                  style={{ width: `${Math.max((item.count / maxValue) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number; accent: string } }[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-[#061110]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">{data.label}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: data.accent }}>
          {data.count}
        </p>
      </div>
    );
  }
  return null;
};

function FunnelBreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: DashboardBreakdownItem[];
  emptyMessage: string;
}) {
  const stageItems = items.map((item, index) => {
    const theme = getStageTheme(item.color);

    return {
      id: `${item.label}-${index}`,
      label: getDashboardLabel(item.label),
      count: item.count,
      accent: theme.accent,
      text: theme.text,
      border: theme.border,
      background: theme.background,
      badgeBackground: theme.badgeBackground,
      badgeBorder: theme.badgeBorder,
      // Recharts uses 'value' for funnel width. To avoid 0-width steps disappearing,
      // we can supply a shape value. But let's see what the user wants. The user
      // said: "based on the sales/ marketing concept of funnel".
      // A standard funnel chart tapers down. Let's make `value` just taper down linearly.
      // Taper down to 40% width so text can fit inside
      shapeValue: 100 - index * (60 / Math.max(items.length, 1)),
    };
  });

  const renderCustomLabel = (props: { x?: number | string, y?: number | string, width?: number | string, height?: number | string, index?: number }) => {
    const x = Number(props.x || 0);
    const y = Number(props.y || 0);
    const width = Number(props.width || 0);
    const height = Number(props.height || 0);
    const index = props.index || 0;
    const item = stageItems[index];
    
    if (!item) return null;
    
    return (
      <g>
        <text
          x={x + width / 2}
          y={y + height / 2 - 8}
          fill="#ffffff"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: "20px", fontWeight: 700 }}
        >
          {item.count}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 14}
          fill="rgba(255,255,255,0.8)"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {item.label}
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="text-sm leading-6 text-novian-text/55">{subtitle}</div>

      <div className="mt-8 h-[360px] min-h-[360px] w-full min-w-0">
        {items.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <FunnelChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <RechartsFunnel
                dataKey="shapeValue"
                data={stageItems}
                isAnimationActive
                lastShapeType="rectangle"
              >
                <LabelList
                  position="inside"
                  content={renderCustomLabel}
                />
                {stageItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.accent} fillOpacity={0.8} stroke={entry.border} />
                ))}
              </RechartsFunnel>
            </FunnelChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoPanel({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ label: string; value: number }>;
}) {
  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="text-sm leading-6 text-novian-text/55">{subtitle}</div>

      <div className="mt-6 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl bg-novian-primary/45 px-4 py-3">
            <span className="text-sm text-novian-text/65">{row.label}</span>
            <span className="text-sm font-semibold text-novian-text">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentListCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: Array<{ id: string; title: string; meta: string; trailing: string }>;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="text-sm leading-6 text-novian-text/55">{subtitle}</div>

      <div className="mt-6 space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-novian-primary/45 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-novian-text">{item.title}</div>
                  <div className="mt-1 text-xs leading-5 text-novian-text/50">{item.meta}</div>
                </div>
                <div className="shrink-0 text-xs text-novian-text/45">{item.trailing}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, collapsed = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, collapsed?: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center ${collapsed ? 'justify-center' : 'justify-center lg:justify-start'} gap-3 p-3 rounded-xl cursor-pointer transition-all ${
      active ? "bg-novian-accent text-novian-primary shadow-[0_0_15px_rgba(222,192,166,0.2)]" : "text-novian-text/70 hover:bg-novian-primary hover:text-novian-text"
    }`} title={collapsed ? label : undefined}>
      {icon}
      {!collapsed && <span className="hidden lg:block font-medium text-sm whitespace-nowrap">{label}</span>}
    </div>
  )
}

function ThreadItem({ title, preview, time, active, unread, onClick }: { title: string; preview: string; time: string; active?: boolean; unread?: boolean, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`p-3 rounded-xl cursor-pointer transition-all ${
      active ? "bg-novian-surface/80 shadow-sm" : "bg-transparent hover:bg-novian-surface/40"
    }`}>
      <div className="flex justify-between items-start mb-1">
        <h4 className={`text-sm font-medium ${unread ? 'text-novian-accent' : 'text-novian-text'}`}>{title}</h4>
        <span className="text-[10px] text-novian-text/40">{time}</span>
      </div>
      <p className="text-xs text-novian-text/60 line-clamp-2 leading-relaxed">{preview}</p>
    </div>
  )
}

function AgentAvatar({ name, initials, avatarUrl }: { name: string, initials: string, avatarUrl?: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-novian-muted border-2 border-novian-surface flex items-center justify-center text-[10px] font-bold text-novian-text z-10" title={name}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={name}
          width={32}
          height={32}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        initials
      )}
    </div>
  )
}

function Message({ id, agent, time, role, content, isTyping, isClient, shouldType, avatarUrl, onComplete }: { id?: string; agent: string; time: string; role: string; content: string; isTyping?: boolean; isClient?: boolean; shouldType?: boolean; avatarUrl?: string; onComplete?: () => void }) {
  const [displayedContent, setDisplayedContent] = useState(shouldType ? "" : content);

  useEffect(() => {
    if (!shouldType) {
      // eslint-disable-next-line
      setDisplayedContent(content);
      return;
    }
    
    // Typing effect logic
    let i = 0;
    const speed = 20; // ms per chunk
    const charsPerChunk = 4; // type more chars at once for a smoother, faster feel without lag
    const interval = setInterval(() => {
      setDisplayedContent(content.substring(0, i));
      i += charsPerChunk;
      if (i >= content.length + charsPerChunk) {
        setDisplayedContent(content);
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [content, shouldType]);

  return (
    <div className={`flex gap-4 ${isClient ? 'flex-row-reverse' : ''}`}>
      <div className={`w-10 h-10 rounded-full flex shrink-0 items-center justify-center font-bold text-sm border overflow-hidden ${isClient ? 'bg-novian-accent text-novian-primary border-novian-accent' : 'bg-novian-muted text-novian-text border-novian-surface'}`}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={agent} className="w-full h-full object-cover" />
        ) : (
          agent.substring(0, 2).toUpperCase()
        )}
      </div>
      <div className={`flex-1 min-w-0 ${isClient ? 'text-right' : ''}`}>
        <div className={`flex items-baseline gap-2 mb-1 ${isClient ? 'justify-end flex-row-reverse' : ''}`}>
          <span className="font-semibold text-novian-accent text-sm">{agent}</span>
          <span className="text-[10px] text-novian-text/40">{role}</span>
          <span className="text-[10px] text-novian-text/40 ml-2">{time}</span>
        </div>
        <div className={`p-5 shadow-sm inline-block max-w-[85%] lg:max-w-[75%] xl:max-w-3xl text-left ${isClient ? 'bg-novian-accent/10 rounded-2xl rounded-tr-sm text-novian-accent' : 'bg-novian-surface/60 rounded-2xl rounded-tl-sm text-novian-text/90'}`}>
          {isTyping ? (
            <div className="flex gap-1.5 items-center h-6 px-2">
              <div className="w-2 h-2 rounded-full bg-novian-text/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-novian-text/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-novian-text/40 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          ) : (
            <div className="prose prose-sm prose-invert text-current leading-relaxed break-words overflow-x-auto max-w-full">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
