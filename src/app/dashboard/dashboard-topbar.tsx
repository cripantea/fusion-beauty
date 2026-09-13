import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Amministratore",
  OPERATOR: "Operatore",
};

type DashboardTopbarProps = {
  firstName: string;
  lastName: string;
  role: string;
};

export function DashboardTopbar({ firstName, lastName, role }: DashboardTopbarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
      <p className="text-sm text-muted-foreground">
        {firstName} {lastName} — {roleLabels[role] ?? role}
      </p>
      <form action={logout}>
        <Button type="submit" variant="outline">
          Esci
        </Button>
      </form>
    </header>
  );
}
