"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, MessageCircle, X } from "lucide-react";

type NavLink = {
  href: string;
  label: string;
};

type MobileNavProps = {
  links: NavLink[];
  whatsappHref: string;
};

export default function MobileNav({ links, whatsappHref }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-novian-accent/18 bg-[rgba(250,248,243,0.76)] text-novian-accent backdrop-blur-sm md:hidden"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <div
        className={`fixed inset-0 z-80 md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-[rgba(250,248,243,0.76)] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
        />

        <div
          className={`absolute inset-0 flex flex-col overflow-y-auto bg-[linear-gradient(180deg,#faf8f3_0%,#f7f3eb_52%,#f2ebdf_100%)] px-5 pb-8 pt-5 shadow-[0_30px_80px_rgba(47,74,58,0.12)] transition-transform duration-300 ${open ? "translate-y-0" : "-translate-y-full"}`}
        >
          <div className="flex items-center justify-between border-b border-novian-muted/45 pb-5">
            <Link href="/" onClick={() => setOpen(false)}>
              <Image
                src="/logo.png"
                alt="Novian"
                width={168}
                height={40}
                className="h-8 w-auto object-contain"
                priority
              />
            </Link>

            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-novian-accent/16 bg-white/82 text-novian-accent shadow-[0_10px_24px_rgba(47,74,58,0.08)]"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mt-8 flex flex-col">
            {links.map((link) => (
              <a
                key={`${link.href}-${link.label}`}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="border-b border-novian-muted/45 py-5 text-[2.1rem] font-medium leading-none tracking-[-0.05em] text-novian-text"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-auto pt-8">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-3 rounded-[22px] bg-[linear-gradient(135deg,#2F4A3A,#5F7850)] px-5 py-4 text-base font-semibold text-white shadow-[0_18px_34px_rgba(47,74,58,0.18)]"
            >
              <MessageCircle size={18} />
              Falar no WhatsApp
            </a>
            <p className="mt-4 text-sm leading-6 text-novian-text/58">
              Atendimento humano, tecnologia e experiência local para encontrar o imóvel certo em Jundiaí.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
