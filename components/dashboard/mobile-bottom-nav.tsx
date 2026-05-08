'use client';

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Folder, GraduationCap, HelpCircle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const ITEMS_DEFAULT: NavItem[] = [
  { href: "/overview", label: "Inicio", icon: LayoutDashboard },
  { href: "/activities", label: "Actividades", icon: Activity },
  { href: "/projects", label: "Empresas", icon: Folder },
  { href: "/help", label: "Ayuda", icon: HelpCircle },
];

const ITEMS_STUDENT: NavItem[] = [
  { href: "/learning", label: "Formación", icon: GraduationCap },
  { href: "/help", label: "Ayuda", icon: HelpCircle },
];

export function MobileBottomNav(props: { role?: string | null } = {}) {
  const pathname = usePathname();
  const items = props.role === "STUDENT" ? ITEMS_STUDENT : ITEMS_DEFAULT;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 lg:hidden",
        "border-t border-zinc-200 bg-white/95 backdrop-blur",
        "pb-[max(env(safe-area-inset-bottom),0px)]"
      )}
      aria-label="Navegación inferior"
    >
      <div
        className={cn(
          "mx-auto grid max-w-screen-sm",
          items.length === 2 ? "grid-cols-2" : "grid-cols-4"
        )}
      >
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/overview" && pathname?.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 px-2 py-2",
                "text-[11px] font-semibold",
                active ? "text-primary" : "text-slate-600",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5", active ? "text-accent" : "text-slate-500")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
