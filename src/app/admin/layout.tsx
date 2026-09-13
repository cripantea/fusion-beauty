import { requireSuperAdmin } from "@/lib/auth-context";

import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireSuperAdmin();

  return (
    <div className="flex min-h-screen w-full flex-1">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar email={user.email} />
        <main className="flex-1 p-8">{children}</main>
        <footer className="border-t px-8 py-4 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} FusionMedia — Piattaforma gestionale per centri estetici.
        </footer>
      </div>
    </div>
  );
}
