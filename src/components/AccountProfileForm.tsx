"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Camera,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
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
          throw new Error(payload.error || "Failed to load profile.");
        }

        if (ignore) return;

        setUser(payload.user);
        setFullName(payload.user.full_name || "");
        setAvatarUrl(payload.user.avatar_url || null);
      } catch (error) {
        if (ignore) return;
        setSaveState({
          type: "error",
          message: error instanceof Error ? error.message : "Failed to load profile.",
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
        message: error instanceof Error ? error.message : "Failed to upload avatar.",
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
      setSaveState({ type: "error", message: "Full name is required." });
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
        throw new Error(payload.error || "Failed to update profile.");
      }

      setUser(payload.user);
      setFullName(payload.user.full_name || "");
      setAvatarUrl(payload.user.avatar_url || null);
      setSaveState({
        type: "success",
        message: payload.warning || "Profile updated successfully.",
      });
      emitProfileUpdated(payload.user);
      router.refresh();
    } catch (error) {
      console.error(error);
      setSaveState({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to update profile.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_30%),linear-gradient(180deg,rgba(13,29,27,0.96),rgba(8,18,16,0.98))] p-8 text-sm text-novian-text/65 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_28%,transparent_72%,rgba(255,255,255,0.03))]" />
        <div className="relative flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />
          Loading your profile...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-8 text-sm text-rose-100 shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        We could not load your profile right now.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.12),transparent_22%),linear-gradient(180deg,rgba(13,29,27,0.98),rgba(7,17,15,0.98))] shadow-[0_30px_100px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_24%,transparent_72%,rgba(255,255,255,0.03))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-emerald-300/40 to-transparent" />

        <div className="relative grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="border-b border-white/8 p-7 xl:border-b-0 xl:border-r">
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Profile identity
              </div>

              <div className="mt-6 flex flex-col items-center text-center">
                <div className="relative h-36 w-36 rounded-[32px] border border-white/10 bg-black/20 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.3)]">
                  <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),rgba(6,12,11,0.92))]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={`${fullName || user.email} avatar`}
                        fill
                        sizes="144px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-semibold tracking-tight text-emerald-100">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="absolute -right-3 -top-3 rounded-2xl border border-emerald-300/20 bg-[#112824] p-2 shadow-lg shadow-black/30">
                    <Camera className="h-4 w-4 text-emerald-200" />
                  </div>
                </div>

                <div className="mt-6">
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {fullName.trim() || "Your profile"}
                  </h2>
                  <p className="mt-2 text-sm text-novian-text/56">{user.email}</p>
                </div>

                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-novian-text/78">
                    <Users className="h-3.5 w-3.5 text-emerald-200" />
                    {user.user_type}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-novian-text/78">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-200" />
                    {user.role}
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-novian-text/78">
                    <BadgeCheck className="h-3.5 w-3.5 text-emerald-200" />
                    {user.is_active ? "active" : "inactive"}
                  </div>
                </div>

                <div className="mt-7 grid w-full gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || isSaving}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 text-sm font-medium text-white transition-all hover:border-emerald-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading image...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload new avatar
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    disabled={isUploading || isSaving || !avatarUrl}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-4 text-sm font-medium text-novian-text/75 transition-all hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <X className="h-4 w-4" />
                    Remove current image
                  </button>
                </div>

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

                <p className="mt-5 max-w-xs text-center text-xs leading-5 text-novian-text/42">
                  Use a square image for the sharpest result. JPG, PNG, and WEBP are supported.
                </p>
              </div>
            </div>
          </div>

          <div className="p-7 lg:p-8 xl:p-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    <UserCircle2 className="h-3.5 w-3.5" />
                    My Profile
                  </div>
                  <h1 className="mt-4 text-[34px] font-semibold leading-tight tracking-[-0.03em] text-white">
                    Refine how your identity appears across Novian
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-novian-text/58">
                    Update your personal details and profile image so the workspace, conversations, and shared experiences feel polished and consistent.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-novian-text/36">Status</div>
                    <div className="mt-2 text-sm font-semibold text-white">{dirty ? "Unsaved" : "Synced"}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-novian-text/36">Access</div>
                    <div className="mt-2 text-sm font-semibold capitalize text-white">{user.role}</div>
                  </div>
                  <div className="rounded-[22px] border border-white/8 bg-white/4 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-novian-text/36">Account</div>
                    <div className="mt-2 text-sm font-semibold capitalize text-white">{user.user_type}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-text/40">
                        Account details
                      </div>
                      <div className="mt-2 text-sm text-novian-text/56">
                        Personal information shown to you across the product.
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-text/42">
                        Full name
                      </span>
                      <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 transition-colors focus-within:border-emerald-400/40 focus-within:bg-black/28">
                        <input
                          value={fullName}
                          onChange={(event) => setFullName(event.target.value)}
                          placeholder="Your name"
                          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-novian-text/30"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-text/42">
                        Email
                      </span>
                      <div className="flex items-center gap-3 rounded-[22px] border border-white/8 bg-white/5 px-4 py-3">
                        <Mail className="h-4 w-4 text-novian-text/38" />
                        <input
                          value={user.email}
                          readOnly
                          className="w-full bg-transparent text-sm text-novian-text/65 outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-white/8 bg-black/10 p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-novian-text/38">
                        User type
                      </div>
                      <div className="mt-3 text-base font-medium capitalize text-white">{user.user_type}</div>
                      <div className="mt-2 text-xs leading-5 text-novian-text/45">
                        Defines the workspace experience and access patterns for this account.
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-white/8 bg-black/10 p-5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-novian-text/38">
                        Role
                      </div>
                      <div className="mt-3 text-base font-medium capitalize text-white">{user.role}</div>
                      <div className="mt-2 text-xs leading-5 text-novian-text/45">
                        Controls operational permissions and visibility inside the platform.
                      </div>
                    </div>
                  </div>

                  {saveState.message ? (
                    <div
                      className={`mt-5 rounded-[22px] border px-4 py-3 text-sm ${
                        saveState.type === "error"
                          ? "border-rose-500/20 bg-rose-500/10 text-rose-100"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                      }`}
                    >
                      {saveState.message}
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSaving || isUploading}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-novian-accent px-6 text-sm font-semibold text-[#081210] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving profile...
                        </>
                      ) : (
                        <>
                          <UserCircle2 className="h-4 w-4" />
                          Save profile
                        </>
                      )}
                    </button>

                    <div className="text-xs uppercase tracking-[0.16em] text-novian-text/35">
                      {dirty ? "Changes pending" : "Everything synced"}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01))] p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-text/40">
                      Profile notes
                    </div>
                    <div className="mt-4 space-y-3 text-sm leading-6 text-novian-text/58">
                      <p>
                        Your avatar is used to make collaboration feel more personal in shared spaces and account surfaces.
                      </p>
                      <p>
                        Name changes apply immediately after saving and the shell refreshes to reflect the update.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-dashed border-emerald-300/18 bg-emerald-400/5 p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/78">
                      Image guidance
                    </div>
                    <div className="mt-4 space-y-2 text-sm leading-6 text-novian-text/58">
                      <p>Use a centered portrait or logo.</p>
                      <p>Square images create the cleanest framing.</p>
                      <p>Keep the background simple for better contrast.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
