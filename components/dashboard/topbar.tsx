import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "./notification-bell";
import { MobileNavMenu } from "@/components/dashboard/mobile-nav-menu";

type TopbarUser = {
  name: string | null;
  email: string | null;
  role: string | null;
  image?: string | null;
};

export function Topbar({ user }: { user: TopbarUser | null }) {
  const roleLabel =
    user?.role === "ADMIN_PMD"
      ? "Coordinador SIG"
      : user?.role === "CONSULTANT"
      ? "Consultor"
      : user?.role === "STUDENT"
      ? "Colaborador"
      : user?.role === "CLIENT"
      ? "Inspector SST"
      : user?.role === "CLIENT_VIEWER"
      ? "Cliente"
      : "Usuario";

  const initials = user?.name ? user.name.substring(0, 2).toUpperCase() : "SG";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-800 bg-background px-4 md:px-6 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <MobileNavMenu user={user} />
        <h1
          className="min-w-0 max-w-[140px] truncate whitespace-nowrap text-base font-semibold text-foreground sm:max-w-[220px] sm:text-lg md:max-w-none md:text-xl"
          title="Panel de Control"
        >
          Panel de Control
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <NotificationBell userRole={user?.role || "CLIENT_VIEWER"} />
        <div className="flex items-center gap-2 rounded-full border border-accent/60 bg-sidebar/95 px-2 py-1.5 shadow-[0_0_10px_rgba(0,0,0,0.35)] sm:gap-3 sm:px-3">
          <Avatar className="h-8 w-8 ring-2 ring-accent/80 ring-offset-2 ring-offset-sidebar">
            <AvatarImage src={user?.image || ""} className="object-cover" />
            <AvatarFallback className="bg-accent text-accent-foreground font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span
              className="max-w-[160px] truncate text-sm font-semibold leading-tight text-slate-50"
              title={user?.email || undefined}
            >
              {user?.name || "Usuario"}
            </span>
            <span className="text-[11px] text-accent leading-tight">
              {roleLabel}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
