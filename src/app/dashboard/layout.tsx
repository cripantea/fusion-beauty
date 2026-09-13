import { getAuthContext } from "@/lib/auth-context";

import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardTopbar } from "./dashboard-topbar";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await getAuthContext();

  return (
    <div className="flex min-h-screen w-full flex-1">
      <DashboardSidebar hasTenant={Boolean(user.tenantId)} isAdmin={user.role === "ADMIN"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar firstName={user.firstName} lastName={user.lastName} role={user.role} />
        <main className="flex-1 p-8">{children}</main>
        <footer className="border-t px-8 py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} FusionMedia — Piattaforma gestionale per centri estetici.
        </footer>
      </div>
    </div>
  );
}
