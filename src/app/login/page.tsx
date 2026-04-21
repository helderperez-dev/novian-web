import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/app/login/actions";
import { getCurrentAppUser } from "@/lib/auth";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Email ou senha invalidos.",
  inactive: "Esta conta esta inativa. Fale com um administrador.",
  profile: "Seu perfil de acesso nao foi encontrado. Fale com um administrador.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [params, currentUser] = await Promise.all([searchParams, getCurrentAppUser()]);

  if (currentUser) {
    redirect(currentUser.role === "client" ? "/client" : "/admin");
  }

  const error = params.error ? errorMessages[params.error] || "Nao foi possivel entrar." : "";
  const next = params.next || "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#091211] px-6 py-10 text-novian-text">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0d1d1b] p-8 shadow-2xl shadow-black/25">
        <div className="mb-8">
          <Link href="/" className="text-xs font-semibold uppercase tracking-[0.24em] text-novian-accent/80">
            Novian
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-white">Portal de Acesso</h1>
          <p className="mt-2 text-sm leading-6 text-novian-text/60">
            Entre para acessar o admin interno ou o portal do cliente.
          </p>
        </div>

        <form action={login} className="space-y-5">
          <input type="hidden" name="next" value={next} />

          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-novian-text/50">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none transition-colors focus:border-novian-accent/50"
              placeholder="voce@empresa.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-novian-text/50">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm outline-none transition-colors focus:border-novian-accent/50"
              placeholder="Sua senha"
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-novian-accent px-4 py-3 text-sm font-semibold text-novian-primary transition-colors hover:bg-white"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
