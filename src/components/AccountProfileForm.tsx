"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import type { AppUser } from "@/lib/auth";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type SaveState =
  | { type: "idle"; message: null }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

function getUserInitials(user: Pick<AppUser, "full_name" | "email"> | null) {
  const base = user?.full_name?.trim() || user?.email?.trim() || "";
  const parts = base.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  return normalized || "avatar";
}

export default function AccountProfileForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ type: "idle", message: null });

  useEffect(() => {
    let ignore = false;

    async function loadProfile() {
      setIsLoading(true);
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store" });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || "Nao foi possivel carregar o perfil.");
        }

        if (ignore) return;

        setUser(payload.user);
        setFullName(payload.user.full_name || "");
        setAvatarUrl(payload.user.avatar_url || null);
      } catch (error) {
        if (ignore) return;
        setSaveState({
          type: "error",
          message: error instanceof Error ? error.message : "Nao foi possivel carregar o perfil.",
        });
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      ignore = true;
    };
  }, []);

  const initials = useMemo(
    () => getUserInitials(user ? { full_name: fullName, email: user.email } : null),
    [fullName, user],
  );
  const dirty = user ? fullName !== (user.full_name || "") || avatarUrl !== (user.avatar_url || null) : false;

  const emitProfileUpdated = (nextUser: AppUser) => {
    window.dispatchEvent(new CustomEvent("novian:profile-updated", { detail: nextUser }));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    setIsUploading(true);
    setSaveState({ type: "idle", message: null });

    try {
      const supabase = createBrowserSupabaseClient();
      const filePath = `avatars/${user.id}/${Date.now()}-${sanitizeFileName(file.name)}`;

      const { error: uploadError } = await supabase.storage
        .from("assets")
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage.from("assets").getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error(error);
      setSaveState({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel enviar a foto.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();

    if (!user) return;

    const nextFullName = fullName.trim();
    if (!nextFullName) {
      setSaveState({ type: "error", message: "Informe o nome completo." });
      return;
    }

    setIsSaving(true);
    setSaveState({ type: "idle", message: null });

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: nextFullName,
          avatarUrl,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Nao foi possivel atualizar o perfil.");
      }

      setUser(payload.user);
      setFullName(payload.user.full_name || "");
      setAvatarUrl(payload.user.avatar_url || null);
      setSaveState({
        type: "success",
        message: payload.warning || "Perfil atualizado com sucesso.",
      });
      emitProfileUpdated(payload.user);
      router.refresh();
    } catch (error) {
      console.error(error);
      setSaveState({
        type: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar o perfil.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = fullName.trim() || "Seu perfil";
  const statusLabel = dirty ? "Alteracoes nao salvas" : "Perfil sincronizado";

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/35 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-center gap-3 text-sm text-novian-text/70">
          <Loader2 className="h-4 w-4 animate-spin text-novian-accent" />
          Carregando perfil...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
        Nao foi possivel carregar seu perfil agora.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleAvatarUpload(file);
          }
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-novian-text/45">Minha conta</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-novian-text">Perfil da conta</h1>
          <p className="mt-2 text-sm text-novian-text/55">
            Atualize seus dados de exibicao para manter seu perfil consistente em toda a plataforma.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-novian-muted/40 px-3 py-1.5 text-xs font-medium text-novian-text/75">
          <BadgeCheck className="h-4 w-4 text-novian-accent" />
          {statusLabel}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-novian-text">Informacoes pessoais</h2>
              <p className="mt-1 text-sm text-novian-text/55">
                Esses dados aparecem na navegacao, no chat e em areas compartilhadas.
              </p>
            </div>
            <span className="rounded-full border border-novian-muted/40 px-3 py-1 text-xs text-novian-text/70">
              {user.is_active ? "Conta ativa" : "Conta inativa"}
            </span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-novian-text/55">Nome completo</span>
              <div className="rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3 transition-colors focus-within:border-novian-accent/45">
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-transparent text-sm text-novian-text outline-none placeholder:text-novian-text/30"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-medium text-novian-text/55">E-mail</span>
              <div className="flex items-center gap-3 rounded-2xl border border-novian-muted/40 bg-novian-primary/40 px-4 py-3">
                <Mail className="h-4 w-4 text-novian-text/38" />
                <input
                  value={user.email}
                  readOnly
                  className="w-full bg-transparent text-sm text-novian-text/65 outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-novian-text/75">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-novian-muted/40 px-2.5 py-1">
              <Users className="h-3.5 w-3.5 text-novian-accent" />
              {user.user_type}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-novian-muted/40 px-2.5 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-novian-accent" />
              {user.role}
            </span>
          </div>

          {saveState.message ? (
            <div
              className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                saveState.type === "error"
                  ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {saveState.message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-novian-muted/40 pt-6">
            <p className="text-sm text-novian-text/55">{dirty ? "Alteracoes pendentes" : "Tudo sincronizado"}</p>
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-transparent bg-novian-accent px-5 text-sm font-semibold text-[#081210] transition-colors hover:bg-[#3b5c49] hover:text-novian-primary active:bg-[#284032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-novian-accent/20 disabled:cursor-not-allowed disabled:bg-novian-accent/45 disabled:text-novian-primary/80"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando perfil...
                </>
              ) : (
                <>
                  <UserCircle2 className="h-4 w-4" />
                  Salvar perfil
                </>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4 border-l border-novian-muted/30 pl-6 xl:pl-8">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-novian-text/45">Foto de perfil</p>

          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-novian-muted/40 bg-novian-primary/50">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`${displayName || user.email} avatar`}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-base font-semibold text-novian-text">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-novian-text">{displayName}</p>
              <p className="truncate text-sm text-novian-text/56">{user.email}</p>
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isSaving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-novian-muted/40 bg-novian-primary/40 px-4 text-sm font-medium text-novian-text transition-colors hover:border-novian-accent/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando foto...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Enviar foto
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setAvatarUrl(null)}
              disabled={isUploading || isSaving || !avatarUrl}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-novian-muted/40 px-4 text-sm font-medium text-novian-text/75 transition-colors hover:border-novian-accent/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              Remover foto
            </button>
          </div>

          <p className="text-xs leading-5 text-novian-text/50">
            Use imagem quadrada em JPG, PNG ou WEBP para melhor resultado.
          </p>
        </div>
      </div>
    </form>
  );
}
