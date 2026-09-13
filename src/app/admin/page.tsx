import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { requireSuperAdmin } from "@/lib/auth-context";

export default async function AdminPage() {
  const { user } = await requireSuperAdmin();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Amministrazione</h1>
          <p className="text-muted-foreground">Accesso globale — {user.email}</p>
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
