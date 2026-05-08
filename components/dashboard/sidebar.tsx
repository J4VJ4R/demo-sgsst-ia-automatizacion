'use client';

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/auth/logout-button";
import { useSidebar } from "./sidebar-provider";
import { DASHBOARD_NAV_ITEMS, type NavRole } from "@/components/dashboard/navigation-items";

interface SidebarUser {
  name: string | null;
  email: string | null;
  role: string | null;
}

interface SidebarProps {
  user: SidebarUser | null;
}

export function Sidebar({ user }: SidebarProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const role = (user?.role || null) as NavRole | null;

  return (
    <div
      className={cn(
        "group/sidebar sticky top-0 flex h-[100dvh] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-20" : "w-64"
      )}
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      aria-label="Barra lateral de navegación principal"
    >
      <div
        className={cn(
          "flex flex-col items-center border-b border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out",
          collapsed ? "py-3 px-1" : "py-6 px-4"
        )}
      >
        <div
          className={cn(
            "rounded-xl bg-white border-2 border-accent shadow-sm flex justify-center items-center transition-all duration-300 ease-in-out",
            collapsed ? "w-full max-w-[56px] p-1" : "w-full max-w-[200px] p-[14px]"
          )}
        >
          <div
            className={cn(
              "relative w-full transition-all duration-300 ease-in-out",
              collapsed ? "h-12" : "h-10 sm:h-12 md:h-14"
            )}
          >
            <Image
              src={collapsed ? "/img/sg-sst-ia-mark.svg" : "/img/sg-sst-ia-logo.svg"}
              alt="SG-SST-IA Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        {!collapsed ? (
          <div className="mt-4 text-center">
            <div className="text-sm font-semibold tracking-tight text-white">
              SG-SST-IA (Analítica Predictiva)
            </div>
            <div className="mt-1 text-xs text-slate-300 truncate max-w-[220px]" title="Automatización Avanzada S.A.S">
              Automatización Avanzada S.A.S
            </div>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 p-4" role="navigation" aria-label="Secciones principales">
        {DASHBOARD_NAV_ITEMS.map((item) => {
          if (!role || !item.roles.includes(role)) return null;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-md px-3 py-3 text-sm font-medium transition-colors",
                "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-accent",
                collapsed ? "justify-center" : "justify-start"
              )}
            >
              <item.icon
                className={cn(
                  collapsed ? "h-8 w-8" : "h-5 w-5 mr-3"
                )}
                aria-hidden="true"
              />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );
        })}
        <div className="pt-4 mt-4 border-t border-zinc-800">
           <LogoutButton collapsed={collapsed} />
        </div>
      </nav>
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center">
          <div className="ml-3 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'Usuario'}</p>
            <p
              className="text-xs text-gray-500 truncate"
              title={user?.email ?? undefined}
            >
              {user?.email || 'No conectado'}
            </p>
            <p className="text-xs text-accent mt-1">
              {user?.role === 'ADMIN_PMD' ? 'Coordinador SIG' : 
               user?.role === 'CONSULTANT' ? 'Consultor' :
               user?.role === 'STUDENT' ? 'Colaborador' :
               user?.role === 'CLIENT' ? 'Inspector SST' :
               'Cliente'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
