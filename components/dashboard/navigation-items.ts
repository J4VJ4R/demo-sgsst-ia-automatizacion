import {
  Activity,
  Folder,
  GraduationCap,
  HelpCircle,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavRole = "ADMIN_PMD" | "CONSULTANT" | "CLIENT" | "CLIENT_VIEWER" | "STUDENT";

export type DashboardNavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: readonly NavRole[];
  priority: number;
};

const NAV_ITEMS = [
  {
    title: "Resumen",
    href: "/overview",
    icon: LayoutDashboard,
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER"] as const,
    priority: 10,
  },
  {
    title: "Empresa",
    href: "/projects",
    icon: Folder,
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER"] as const,
    priority: 20,
  },
  {
    title: "Actividades",
    href: "/activities",
    icon: Activity,
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER"] as const,
    priority: 30,
  },
  {
    title: "Formación empresarial",
    href: "/learning",
    icon: GraduationCap,
    roles: ["ADMIN_PMD", "CLIENT", "CLIENT_VIEWER", "STUDENT"] as const,
    priority: 35,
  },
  {
    title: "Usuarios",
    href: "/users",
    icon: Users,
    roles: ["ADMIN_PMD"] as const,
    priority: 40,
  },
  {
    title: "Ayuda y Soporte",
    href: "/help",
    icon: HelpCircle,
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER", "STUDENT"] as const,
    priority: 60,
  },
  {
    title: "Configuración",
    href: "/settings",
    icon: Settings,
    roles: ["ADMIN_PMD", "CONSULTANT", "CLIENT", "CLIENT_VIEWER", "STUDENT"] as const,
    priority: 70,
  },
] satisfies DashboardNavItem[];

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = NAV_ITEMS.slice().sort(
  (a, b) => a.priority - b.priority
);
