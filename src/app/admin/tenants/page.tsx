import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth-context";

import { getTenants } from "./actions";
import { TenantsManager } from "./tenants-manager";

export default async function AdminTenantsPage() {
  const { user } = await requireSuperAdmin();
  const tenants = await getTenants();

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Accesso globale — {user.email}</p>
        <form action={logout}>
          <Button type="submit" variant="outline">
            Esci
          </Button>
        </form>
      </div>

      <TenantsManager initialTenants={tenants} />
    </div>
  );
}
