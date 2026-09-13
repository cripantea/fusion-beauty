import Link from "next/link";

import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth-context";

export default async function DashboardPage() {
  const { user } = await getAuthContext();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">
            {user.firstName} {user.lastName} — {user.role}
            {user.tenantId ? ` — tenant ${user.tenantId}` : ""}
          </p>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </div>

      {user.tenantId ? (
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/dashboard/services" />}
          >
            Catalogo trattamenti
          </Button>
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/dashboard/clients" />}
          >
            Anagrafica clienti
          </Button>
        </div>
      ) : null}
    </div>
  );
}
