import Link from "next/link";
import Image from "next/image";
import { requireClientUser } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getUserInitials(fullName: string | null, email: string) {
  const base = fullName?.trim() || email.trim();
  const parts = base.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "NV";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export default async function ClientPage() {
  const { appUser } = await requireClientUser();
  const supabase = await createServerSupabaseClient();

  const { data: processes } = await supabase
    .from("client_processes")
    .select("id, title, status, summary, client_documents(id, title, file_url, description)")
    .eq("client_user_id", appUser.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[#081210] px-6 py-10 text-novian-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/20">
              {appUser.avatar_url ? (
                <Image
                  src={appUser.avatar_url}
                  alt={appUser.full_name || appUser.email}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-emerald-500/12 text-sm font-semibold text-emerald-100">
                  {getUserInitials(appUser.full_name, appUser.email)}
                </div>
              )}
            </div>
            <div>
            <div className="mb-3 inline-flex rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
              Portal do Cliente
            </div>
            <h1 className="text-4xl font-semibold text-white">Bem-vindo, {appUser.full_name || appUser.email}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-novian-text/60">
              Aqui voce pode acompanhar o andamento dos seus processos e acessar os documentos compartilhados com voce.
            </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/client/account"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-novian-text transition-colors hover:bg-white/10"
            >
              Meu perfil
            </Link>
            <Link
              href="/logout"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-novian-text transition-colors hover:bg-white/10"
            >
              Sair
            </Link>
          </div>
        </div>

        <div className="grid gap-6">
          {(processes || []).map((process) => {
            const documents = Array.isArray(process.client_documents) ? process.client_documents : [];

            return (
              <section key={process.id} className="rounded-3xl border border-white/8 bg-[#0d1d1b] p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-white">{process.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-novian-text/60">
                      {process.summary || "Nenhum resumo foi publicado para este processo ainda."}
                    </p>
                  </div>
                  <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                    {process.status}
                  </span>
                </div>

                <div className="mt-6">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">
                    Documentos
                  </div>
                  {documents.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {documents.map((document) => (
                        <a
                          key={document.id}
                          href={document.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl border border-white/8 bg-white/3 p-4 transition-colors hover:bg-white/6"
                        >
                          <div className="text-sm font-semibold text-white">{document.title}</div>
                          <div className="mt-2 text-sm leading-6 text-novian-text/55">
                            {document.description || "Abrir documento"}
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/8 bg-black/10 px-5 py-6 text-sm text-novian-text/50">
                      Nenhum documento disponivel ainda.
                    </div>
                  )}
                </div>
              </section>
            );
          })}

          {(!processes || processes.length === 0) && (
            <div className="rounded-3xl border border-dashed border-white/8 bg-[#0d1d1b] px-8 py-16 text-center text-sm text-novian-text/55">
              Seu portal esta ativo, mas ainda nao existem processos compartilhados com voce.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
