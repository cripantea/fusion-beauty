import { logout } from "@/app/login/actions";
import { AdminViewToggle } from "@/components/admin-view-toggle";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";

type DashboardTopbarProps = {
  firstName: string;
  lastName: string;
  role: string;
  tenantName: string | null;
  isAdmin?: boolean;
};

export function DashboardTopbar({ firstName, lastName, role, tenantName, isAdmin = false }: DashboardTopbarProps) {
  return (
    <header className="flex h-16 print:hidden shrink-0 items-center justify-between gap-3 bg-forest px-4 text-forest-foreground sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {tenantName ? (
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-mint/30 bg-white/5 px-3 py-1 text-xs font-semibold">
            <span className="size-2 shrink-0 rounded-full bg-mint" />
            <span className="truncate">Centro attivo · {tenantName}</span>
          </span>
        ) : (
          <span className="text-sm font-semibold">Area super admin</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isAdmin && <AdminViewToggle />}
        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold leading-tight">
            {firstName} {lastName}
          </div>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">
          {getInitials(firstName, lastName)}
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="text-forest-foreground/80 hover:bg-white/10 hover:text-forest-foreground"
          >
            Esci
          </Button>
        </form>
      </div>
    </header>
  );
}
