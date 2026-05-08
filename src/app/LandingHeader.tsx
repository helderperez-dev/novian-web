"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MessageCircle } from "lucide-react";
import MobileNav from "./MobileNav";

type NavLink = {
  href: string;
  label: string;
};

type LandingHeaderProps = {
  navLinks: NavLink[];
  whatsappHref: string;
};

export default function LandingHeader({ navLinks, whatsappHref }: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const onScroll = () => {
      setIsScrolled(window.scrollY > 24);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="px-0 transition-all duration-300">
        <div
          className={`flex w-full items-center justify-between transition-all duration-300 ${
            isScrolled
              ? "h-[74px] border-b border-[rgba(47,74,58,0.12)] bg-[rgba(250,248,243,0.72)] px-5 shadow-[0_18px_40px_rgba(47,74,58,0.08)] backdrop-blur-xl lg:h-[82px] lg:px-14"
              : "h-[84px] px-5 lg:h-[92px] lg:px-14"
          }`}
        >
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Novian"
                width={168}
                height={40}
                className="h-7 w-auto object-contain lg:h-9"
                priority
              />
            </Link>

            <nav className="hidden items-center gap-8 text-[15px] font-medium text-novian-text/78 md:flex">
              {navLinks.map((link) => (
                link.href.startsWith("http") ? (
                  <a
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors hover:text-novian-accent"
                  >
                    {link.label}
                  </a>
                ) : (
                  <Link
                    key={`${link.href}-${link.label}`}
                    href={link.href}
                    className="transition-colors hover:text-novian-accent"
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="hidden items-center gap-2 rounded-[18px] border border-[rgba(47,74,58,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(250,248,243,0.36))] px-4 py-3 text-sm font-medium text-novian-accent shadow-[0_14px_30px_rgba(47,74,58,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl transition hover:border-[rgba(47,74,58,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.64),rgba(250,248,243,0.44))] md:inline-flex lg:px-5"
              >
                <MessageCircle size={16} />
                Falar no WhatsApp
              </a>
              <MobileNav links={navLinks} whatsappHref={whatsappHref} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
