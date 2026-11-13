import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/format";

type DashboardTopbarProps = {
  firstName: string;
  lastName: string;
  role: string;
  tenantName: string | null;
};

export function DashboardTopbar({ firstName, lastName, role, tenantName }: DashboardTopbarProps) {
  return (
    <header className="flex h-16 print:hidden shrink-0 items-center justify-between gap-3 bg-forest px-4 text-forest-foreground sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {tenantName ? null : <span className="text-sm font-semibold">Area super admin</span>}
      </div>

      <div className="flex items-center gap-3">
        {/* In alto il nome del centro, non quello di chi è entrata. */}
        <div className="min-w-0 truncate text-right text-sm font-semibold leading-tight">
          {tenantName ?? `${firstName} ${lastName}`.trim()}
        </div>
        {tenantName ? null : (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-mint text-xs font-bold text-forest">
            {getInitials(firstName, lastName)}
          </div>
        )}
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
