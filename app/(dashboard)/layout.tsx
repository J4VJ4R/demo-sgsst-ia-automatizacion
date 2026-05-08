import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { SessionTimeout } from "@/components/auth/session-timeout";
import { SidebarProvider } from "@/components/dashboard/sidebar-provider";
import { getCurrentUser } from "@/app/auth-actions";
import { RealTimeListenerLoader } from "@/components/real-time-listener-loader";
import { GlobalSummaryGate } from "@/components/dashboard/global-summary-gate";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { InactiveCompanyDialog } from "@/components/dashboard/inactive-company-dialog";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const shouldBlock =
    (user.role === "CLIENT" || user.role === "CLIENT_VIEWER") &&
    (await prisma.project.count({ where: { clientUserId: user.id, status: "ACTIVE" } })) === 0 &&
    (await prisma.project.count({ where: { clientUserId: user.id, status: "INACTIVE" } })) > 0;

  return (
    <SidebarProvider>
      <div className="flex h-[100dvh] min-h-[100dvh] bg-background relative">
        <SessionTimeout />
        <RealTimeListenerLoader />
        <div className="hidden lg:block">
          <Sidebar user={user} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar user={user} />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-24 md:p-6 md:pb-6 scroll-smooth">
              {children}
            </main>
            {user.role === "STUDENT" ? null : <GlobalSummaryGate role={user?.role} />}
          </div>
        </div>
        <MobileBottomNav role={user.role} />
      </div>
      {shouldBlock ? <InactiveCompanyDialog phone="3118682950" /> : null}
    </SidebarProvider>
  );
}
