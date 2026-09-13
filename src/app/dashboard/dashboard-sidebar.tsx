"use client";

import {
  Calendar,
  LayoutDashboard,
  Link2,
  Scissors,
  ShieldCheck,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

const TENANT_NAV_ITEMS = [
  { href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Calendario", icon: Calendar },
  { href: "/dashboard/services", label: "Catalogo trattamenti", icon: Scissors },
  { href: "/dashboard/clients", label: "Anagrafica clienti", icon: Users },
  { href: "/dashboard/widget", label: "Widget prenotazione", icon: Wand2 },
  { href: "/dashboard/integrations/calendar", label: "Integrazioni calendario", icon: Link2 },
] as const;

const STAFF_NAV_ITEM = {
  href: "/dashboard/staff",
  label: "Staff",
  icon: ShieldCheck,
} as const;

type DashboardSidebarProps = {
  hasTenant: boolean;
  isAdmin: boolean;
};

export function DashboardSidebar({ hasTenant, isAdmin }: DashboardSidebarProps) {
  const pathname = usePathname();

  const items = hasTenant
    ? [...TENANT_NAV_ITEMS, ...(isAdmin ? [STAFF_NAV_ITEM] : [])]
    : [{ href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true } as const];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-muted/30">
      <div className="flex h-16 items-center border-b px-6">
        <span className="text-lg font-semibold">Fusion Beauty</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
