'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_NAV_ITEMS, type NavRole } from "@/components/dashboard/navigation-items";
import { logout } from "@/app/auth-actions";
import { cn } from "@/lib/utils";

type SidebarUser = {
  name: string | null;
  email: string | null;
  role: string | null;
  image?: string | null;
};

export function MobileNavMenu({ user }: { user: SidebarUser | null }) {
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items = useMemo(() => {
    const role = (user?.role || null) as NavRole | null;
    if (!role) return [];
    return DASHBOARD_NAV_ITEMS.filter((i) => i.roles.includes(role));
  }, [user?.role]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t || startX.current === null || startY.current === null) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    if (!dragging.current) {
      const horizontal = Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) + 6;
      if (!horizontal) return;
      dragging.current = true;
    }

    if (dx < -70) {
      e.preventDefault();
      dragging.current = false;
      startX.current = null;
      startY.current = null;
      setOpen(false);
    }
  };

  const handleTouchEnd = () => {
    dragging.current = false;
    startX.current = null;
    startY.current = null;
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 lg:hidden"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu className="h-6 w-6 text-slate-900 dark:text-white" />
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-[9998] bg-slate-950/35"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[9999] flex w-[80vw] max-w-none flex-col",
          "sm:w-[70vw] md:w-[45vw] lg:hidden",
          "border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
          "will-change-transform transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none"
        )}
        aria-hidden={!open}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div className="border-b border-zinc-800 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white border-2 border-accent shadow-sm flex justify-center items-center p-2">
              <div className="relative h-10 w-32">
                <Image
                  src={"/img/sg-sst-ia-logo.svg"}
                  alt="SG-SST-IA Logo"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegación principal">
          <div className="space-y-1">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-4",
                  "text-base md:text-lg font-semibold",
                  "text-gray-100 hover:bg-sidebar-accent hover:text-accent active:bg-sidebar-accent/70",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                )}
              >
                <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.title}</span>
              </Link>
            ))}
          </div>

          <div className="mt-4 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => logout()}
              className={cn(
                "flex w-full min-h-11 items-center gap-3 rounded-xl px-4",
                "text-base md:text-lg font-semibold",
                "text-gray-100 hover:bg-sidebar-accent hover:text-accent active:bg-sidebar-accent/70",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              )}
            >
              <LogOut className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span className="truncate">Cerrar sesión</span>
            </button>
          </div>
        </nav>

        <div className="border-t border-zinc-800 px-4 py-4">
          <div className="min-w-0">
            <div className="text-sm md:text-base font-semibold text-white truncate">
              {user?.name || "Usuario"}
            </div>
            <div className="text-xs md:text-sm text-gray-400 truncate" title={user?.email ?? undefined}>
              {user?.email || "No conectado"}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
