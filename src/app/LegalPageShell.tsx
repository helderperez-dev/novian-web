import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type LegalPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function LegalPageShell({
  eyebrow,
  title,
  description,
  children,
}: LegalPageShellProps) {
  return (
    <main className="min-h-screen bg-novian-primary text-novian-text">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,120,80,0.08),transparent_26rem)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.4),transparent_22%,rgba(243,237,227,0.36))]" />

        <div className="relative mx-auto max-w-5xl px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
          <div className="flex flex-col gap-6 border-b border-novian-muted/55 pb-8 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-novian-text/68 transition hover:text-novian-accent"
            >
              <ArrowLeft size={16} />
              Voltar para o site
            </Link>

            <Image
              src="/logo.png"
              alt="Novian"
              width={168}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>

          <div className="pt-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-novian-accent/72 sm:text-xs">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-[2.4rem] font-medium leading-[0.98] tracking-[-0.05em] text-novian-text sm:text-[3rem]">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-novian-text/66 sm:text-base">
              {description}
            </p>
          </div>

          <div className="mt-10 space-y-6 pb-16">{children}</div>
        </div>
      </div>
    </main>
  );
}
