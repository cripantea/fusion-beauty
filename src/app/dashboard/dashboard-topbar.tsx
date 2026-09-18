import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Amministratore",
  OPERATOR: "Operatrice",
};

type DashboardTopbarProps = {
  firstName: string;
  lastName: string;
  role: string;
};

export function DashboardTopbar({ firstName, lastName, role }: DashboardTopbarProps) {
  const initials =
    `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b bg-card/80 px-6 backdrop-blur-sm">
      <div className="text-right">
        <div className="text-sm font-medium leading-tight">
          {firstName} {lastName}
        </div>
        <div className="text-xs leading-tight text-muted-foreground">
          {roleLabels[role] ?? role}
        </div>
      </div>

      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
        {initials}
      </div>

      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
          Esci
        </Button>
      </form>
    </header>
  );
}
