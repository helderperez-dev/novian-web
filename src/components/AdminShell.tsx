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
          ? 'bg-black/30 text-novian-accent shadow-inner' 
          : 'text-novian-text/60 hover:text-novian-text hover:bg-black/10'
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
    <div className="flex h-screen w-full bg-novian-primary text-novian-text overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} border-r border-novian-muted/50 bg-novian-surface flex flex-col justify-between transition-all duration-300 relative z-20 shrink-0`}>
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 bg-novian-surface border border-novian-muted/50 rounded-full p-1 text-novian-text/50 hover:text-novian-accent z-50 hidden lg:block shadow-sm"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div>
          <div className={`h-20 flex items-center justify-center ${isSidebarOpen ? 'lg:justify-start px-6' : 'px-0'} border-b border-novian-muted/50 transition-all duration-300`}>
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
              <div className={`absolute bottom-full mb-2 w-60 rounded-2xl border border-white/10 bg-[#10201d] p-2 shadow-2xl shadow-black/30 backdrop-blur-xl ${isSidebarOpen ? 'left-3' : 'left-full ml-2'}`}>
                <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-novian-text/40">
                  Conta
                </div>
                <Link href="/admin/account">
                  <div 
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-novian-text/80 transition-colors hover:bg-white/5 hover:text-white"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings size={16} />
                    Meu perfil
                  </div>
                </Link>
                <div className="my-1 h-px w-full bg-white/5" />
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
                  ? 'bg-black/30 text-novian-accent shadow-inner' 
                  : 'text-novian-text/60 hover:text-novian-text hover:bg-black/10'
              } ${!isSidebarOpen ? 'justify-center' : ''}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center ${!isSidebarOpen ? 'justify-center' : 'justify-start'} transition-transform duration-200 ${isUserMenuOpen ? 'scale-105' : 'group-hover:scale-105'}`}>
                <div className="relative h-8 w-8 overflow-hidden rounded-full border border-white/10">
                  {currentAppUser?.avatar_url ? (
                    <Image
                      src={currentAppUser.avatar_url}
                      alt={currentAppUser.full_name || currentAppUser.email}
                      fill
                      sizes="32px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-emerald-500/12 text-[9px] font-bold uppercase text-emerald-100">
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
      <main className="flex-1 bg-novian-primary flex flex-col h-screen overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-8 border-b border-novian-muted/50 bg-novian-primary/95 backdrop-blur-sm relative z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium tracking-wide uppercase text-novian-text/90">
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
                className="bg-novian-surface rounded-full pl-10 pr-4 py-2 text-sm w-64 focus:outline-none focus:ring-1 focus:ring-novian-accent/50 transition-all border-none"
              />
            </div>
            <button className="relative p-2 rounded-full hover:bg-novian-surface transition-colors">
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
