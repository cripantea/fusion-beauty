"use client";

import {
  BarChart3,
  Calendar,
  CreditCard,
  FileSignature,
  FileText,
  Inbox,
  LayoutDashboard,
  Link2,
  Scissors,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badgeKey?: "requests";
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ogni giorno",
    items: [
      { href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
      { href: "/dashboard/clients", label: "Clienti", icon: Users },
      { href: "/dashboard/payments", label: "Pagamenti", icon: CreditCard },
    ],
  },
  {
    label: "Da fare",
    items: [
      { href: "/dashboard/requests", label: "Richieste online", icon: Inbox, badgeKey: "requests" },
      { href: "/dashboard/followup", label: "Da ricontattare", icon: UserRoundCheck },
    ],
  },
  {
    label: "Andamento",
    items: [
      { href: "/dashboard/stats", label: "Statistiche", icon: BarChart3 },
      { href: "/dashboard/reports", label: "Report mensile", icon: FileText },
    ],
  },
  {
    label: "Servizi",
    items: [
      { href: "/dashboard/services", label: "Trattamenti", icon: Scissors },
    ],
  },
  {
    label: "Impostazioni",
    items: [
      { href: "/dashboard/widget", label: "Widget prenotazione", icon: Wand2 },
      { href: "/dashboard/integrations/calendar", label: "Integrazioni", icon: Link2 },
    ],
  },
];

const ADMIN_ITEMS: NavItem[] = [
  { href: "/dashboard/consents", label: "Modelli consenso", icon: FileSignature },
  { href: "/dashboard/staff", label: "Staff", icon: ShieldCheck },
];

type DashboardSidebarProps = {
  hasTenant: boolean;
  isAdmin: boolean;
  tenantName: string | null;
  pendingRequests: number;
};

export function DashboardSidebar({
  hasTenant,
  isAdmin,
  tenantName,
  pendingRequests,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const groups: NavGroup[] = hasTenant
    ? NAV_GROUPS.map((group) =>
        group.label === "Impostazioni" && isAdmin
          ? { ...group, items: [...group.items, ...ADMIN_ITEMS] }
          : group
      )
    : [
        {
          label: "Ogni giorno",
          items: [{ href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true }],
        },
      ];

  const mobileItems = groups
    .flatMap((group) => group.items)
    .filter((item) =>
      ["/dashboard", "/dashboard/calendar", "/dashboard/clients", "/dashboard/payments", "/dashboard/followup"].includes(
        item.href
      )
    );

  return (
    <>
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur lg:hidden print:hidden">
      {mobileItems.map((item) => {
        const active = isActive(item.href, item.exact);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
              active ? "text-forest" : "text-muted-foreground"
            )}
          >
            <Icon className={cn("size-5", active && "text-mint-ink")} />
            {item.label.split(" ")[0]}
          </Link>
        );
      })}
    </nav>
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex print:hidden">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-mint-soft text-mint-ink ring-1 ring-mint-border">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="font-heading text-base font-bold leading-tight">Beauty CRM</div>
          <div className="truncate text-[11px] leading-tight text-muted-foreground">
            {tenantName ?? "Gestionale centri estetici"}
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 flex items-center gap-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label === "Impostazioni" ? <Settings className="size-3" /> : null}
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                const badge = item.badgeKey === "requests" ? pendingRequests : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-mint-soft font-semibold text-forest ring-1 ring-mint-border"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("size-4 shrink-0", active && "text-mint-ink")} />
                    <span className="flex-1">{item.label}</span>
                    {badge > 0 ? (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-wine px-1.5 text-[11px] font-bold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
    </>
  );
}
