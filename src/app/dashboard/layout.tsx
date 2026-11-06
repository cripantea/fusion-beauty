import { PageTransition } from "@/components/ui/page-transition";
import { getAuthContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await getAuthContext();

  const [tenant, pendingRequests, unreadMessages] = user.tenantId
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
        prisma.whatsappMessage.count({
          where: { tenantId: user.tenantId, direction: "INBOUND", readAt: null },
        }),
      ])
    : [null, 0, 0];

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="flex min-h-screen w-full flex-1 bg-background">
      <DashboardSidebar
        hasTenant={Boolean(user.tenantId)}
        isAdmin={isAdmin}
        tenantName={tenant?.name ?? null}
        pendingRequests={pendingRequests}
        unreadMessages={unreadMessages}
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
          <footer className="border-t border-border px-8 py-4 text-center font-mono text-xs text-muted-foreground print:hidden">
            © {new Date().getFullYear()} Fusion Beauty · Fusion Media di Luca Gabriele Pantea · P.IVA 13148540969
          </footer>
        </PageTransition>
      </div>
    </div>
  );
}
