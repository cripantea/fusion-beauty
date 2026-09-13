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
    </div>
  );
}
