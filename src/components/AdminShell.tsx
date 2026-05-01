"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { 
  BarChart3, 
  MessageSquare, 
  Users, 
  Target, 
  Home as HomeIcon, 
  FolderOpen,
  Settings, 
  ChevronLeft, 
  ChevronRight,
  Search,
  Bell
} from "lucide-react";
import type { Database } from "@/lib/database.types";

type ManagedAppUser = Database["public"]["Tables"]["app_users"]["Row"];

const getUserInitials = (user: ManagedAppUser | null) => {
  const base = user?.full_name?.trim() || user?.email?.trim() || "";
  if (!base) return "NV";

  const parts = base.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NV";
};

const NavItem = ({ icon, label, href, active, collapsed }: { icon: React.ReactNode, label: string, href: string, active: boolean, collapsed: boolean }) => (
  <Link href={href} className="block w-full px-3">
    <div
      className={`flex items-center py-2.5 px-3 rounded-xl cursor-pointer transition-all duration-200 group
        ${active 
          ? 'bg-novian-accent/12 text-novian-accent shadow-[inset_0_0_0_1px_rgba(47,74,58,0.08)]'
          : 'text-novian-text/60 hover:text-novian-text hover:bg-white/72'
        }
        ${collapsed ? 'justify-center' : 'justify-start gap-3'}
      `}
    >
      <div className={`flex h-8 w-8 shrink-0 items-center ${collapsed ? 'justify-center' : 'justify-start'} transition-transform duration-200 ${active ? 'scale-105' : 'group-hover:scale-105'}`}>
        {icon}
      </div>
      {!collapsed && (
        <span className={`font-medium tracking-wide text-sm truncate ${active ? 'text-novian-accent' : ''}`}>
          {label}
        </span>
      )}
    </div>
  </Link>
);

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [currentAppUser, setCurrentAppUser] = useState<ManagedAppUser | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCurrentAppUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        setCurrentAppUser(data.appUser || null);
      } catch (e) {
        console.error(e);
      }
    };

    fetchCurrentAppUser();
  }, []);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<ManagedAppUser>).detail;
      if (detail) {
        setCurrentAppUser(detail);
      }
    };

    window.addEventListener("novian:profile-updated", handleProfileUpdated);
    return () => window.removeEventListener("novian:profile-updated", handleProfileUpdated);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(243,237,227,0.72))] text-novian-text font-sans">
      
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} relative z-20 flex shrink-0 flex-col justify-between border-r border-novian-muted/60 bg-[rgba(255,255,255,0.82)] shadow-[0_20px_50px_rgba(47,74,58,0.07)] backdrop-blur-xl transition-all duration-300`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 z-50 hidden rounded-full border border-novian-muted/65 bg-white p-1 text-novian-text/50 shadow-sm transition-colors hover:text-novian-accent lg:block"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div>
          <div className={`h-20 flex items-center justify-center ${isSidebarOpen ? 'lg:justify-start px-6' : 'px-0'} border-b border-novian-muted/55 transition-all duration-300`}>
            <div className={`flex items-center w-full overflow-hidden ${isSidebarOpen ? 'justify-start' : 'justify-center'}`}>
              <Image 
                src="/logo.png" 
                alt="Novian Logo" 
                width={120} 
                height={24} 
                className={`h-5 transition-all duration-300 ${isSidebarOpen ? 'w-auto object-contain' : 'w-4 object-cover object-left'} hover:opacity-80`}
                priority
              />
            </div>
          </div>
          
          <nav className="mt-6 flex flex-col space-y-1">
            <NavItem 
              icon={<BarChart3 size={20} />} 
              label="Dashboard" 
              href="/admin/dashboard"
              active={pathname === "/admin/dashboard" || pathname === "/admin"} 
              collapsed={!isSidebarOpen} 
            />
            <NavItem 
              icon={<MessageSquare size={20} />} 
              label="Chat" 
              href="/admin/chat"
              active={pathname.startsWith("/admin/chat")} 
              collapsed={!isSidebarOpen} 
            />
            <NavItem 
              icon={<Users size={20} />} 
              label="Pessoas" 
              href="/admin/people"
              active={pathname.startsWith("/admin/people")} 
              collapsed={!isSidebarOpen} 
            />
            <NavItem 
              icon={<Target size={20} />} 
              label="Captação" 
              href="/admin/captacao"
              active={pathname.startsWith("/admin/captacao")} 
              collapsed={!isSidebarOpen} 
            />
            <NavItem 
              icon={<HomeIcon size={20} />} 
              label="Imóveis" 
              href="/admin/properties"
              active={pathname.startsWith("/admin/properties")} 
              collapsed={!isSidebarOpen} 
            />
            <NavItem
              icon={<FolderOpen size={20} />}
              label="Documentos"
              href="/admin/documents"
              active={pathname.startsWith("/admin/documents")}
              collapsed={!isSidebarOpen}
            />
          </nav>
        </div>

        <div className="mb-6 relative">
          <NavItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            href="/admin/settings"
            active={pathname.startsWith("/admin/settings") || pathname.startsWith("/admin/account")} 
            collapsed={!isSidebarOpen} 
          />
          
          {/* User Profile Footer */}
          <div className="mt-4 px-3 relative" ref={userMenuRef}>
            {isUserMenuOpen && (
              <div className={`absolute bottom-full mb-2 w-60 rounded-2xl border border-novian-muted/65 bg-[rgba(255,255,255,0.94)] p-2 shadow-[0_22px_50px_rgba(47,74,58,0.12)] backdrop-blur-xl ${isSidebarOpen ? 'left-3' : 'left-full ml-2'}`}>
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-novian-text/40">
                  Conta
                </div>
                <Link href="/admin/settings?tab=profile">
                  <div 
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-novian-text/80 transition-colors hover:bg-novian-surface-soft/80 hover:text-novian-text"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings size={16} />
                    Meu perfil
                  </div>
                </Link>
                <div className="my-1 h-px w-full bg-novian-muted/45" />
                <Link href="/logout">
                  <div className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-400/10">
                    Sair
                  </div>
                </Link>
              </div>
            )}

            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all group ${
                isUserMenuOpen 
                  ? 'bg-novian-accent/12 text-novian-accent shadow-[inset_0_0_0_1px_rgba(47,74,58,0.08)]'
                  : 'text-novian-text/60 hover:text-novian-text hover:bg-white/72'
              } ${!isSidebarOpen ? 'justify-center' : ''}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center ${!isSidebarOpen ? 'justify-center' : 'justify-start'} transition-transform duration-200 ${isUserMenuOpen ? 'scale-105' : 'group-hover:scale-105'}`}>
                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-novian-muted/70 bg-white">
                  {currentAppUser?.avatar_url ? (
                    <Image
                      src={currentAppUser.avatar_url}
                      alt={currentAppUser.full_name || currentAppUser.email}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-novian-accent/12 text-[9px] font-bold uppercase text-novian-accent">
                      {getUserInitials(currentAppUser)}
                    </div>
                  )}
                </div>
              </div>
              {isSidebarOpen && (
                <div className="flex min-w-0 items-center">
                  <span className={`w-full truncate text-sm font-medium tracking-wide transition-colors ${isUserMenuOpen ? 'text-novian-accent' : ''}`}>
                    {currentAppUser?.full_name || currentAppUser?.email || "Carregando..."}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 min-w-0 flex-col overflow-hidden bg-transparent h-screen">
        {/* Top Header */}
        <header className="relative z-10 flex h-20 shrink-0 items-center justify-between border-b border-novian-muted/55 bg-[rgba(250,248,243,0.72)] px-8 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium tracking-wide uppercase text-novian-text/88">
              {pathname === "/admin/chat" ? "Chat" : 
               pathname === "/admin/people" ? "Pessoas" :
               pathname === "/admin/captacao" ? "Captação" :
               pathname === "/admin/properties" ? "Imóveis" :
               pathname === "/admin/documents" ? "Documentos" :
               pathname === "/admin/account" ? "Minha Conta" :
               pathname === "/admin/settings" ? "Configurações" :
               pathname === "/admin/dashboard" ? "Dashboard" :
               "Dashboard"}
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-novian-text/50" size={16} />
              <input 
                type="text" 
                placeholder="Buscar leads, imóveis ou agentes..." 
                className="w-64 rounded-full border border-novian-muted/65 bg-white/85 pl-10 pr-4 py-2 text-sm shadow-sm transition-all focus:border-novian-accent/35 focus:outline-none"
              />
            </div>
            <button className="relative rounded-full border border-novian-muted/65 bg-white/78 p-2 text-novian-text/76 transition-colors hover:text-novian-accent">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-novian-accent rounded-full animate-pulse"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden min-w-0">
          {children}
        </div>
      </main>

    </div>
  );
}
