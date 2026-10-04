import { PageTransition } from "@/components/ui/page-transition";
import { getAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await getAuthContext();

  const [tenant, pendingRequests] = user.tenantId
    ? await Promise.all([
        prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true } }),
        prisma.appointment.count({
          where: {
            tenantId: user.tenantId,
            source: "ONLINE",
            status: "BOOKED",
            startTime: { gte: new Date() },
          },
        }),
      ])
    : [null, 0];

  return (
    <div className="flex min-h-screen w-full flex-1 bg-background">
      <DashboardSidebar
        hasTenant={Boolean(user.tenantId)}
        isAdmin={user.role === "ADMIN"}
        tenantName={tenant?.name ?? null}
        pendingRequests={pendingRequests}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar
          firstName={user.firstName}
          lastName={user.lastName}
          role={user.role}
          tenantName={tenant?.name ?? null}
        />
        <PageTransition>
          <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8">{children}</main>
          <footer className="border-t px-8 print:hidden py-4 text-center text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Beauty CRM — Gestionale per centri estetici · Fusion Systems
          </footer>
        </PageTransition>
      </div>
    </div>
  );
}
