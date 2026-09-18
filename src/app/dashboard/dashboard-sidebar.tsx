"use client";

import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Link2,
  Package,
  Scissors,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operativo",
    items: [
      { href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
      { href: "/dashboard/clients", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Catalogo",
    items: [
      { href: "/dashboard/services", label: "Trattamenti", icon: Scissors },
      { href: "/dashboard/products", label: "Prodotti", icon: Package },
    ],
  },
  {
    label: "Online",
    items: [
      { href: "/dashboard/requests", label: "Richieste online", icon: ClipboardList },
      { href: "/dashboard/widget", label: "Widget prenotazione", icon: Wand2 },
    ],
  },
  {
    label: "Analisi",
    items: [
      { href: "/dashboard/stats", label: "Statistiche", icon: BarChart3 },
      { href: "/dashboard/reports", label: "Report", icon: FileText },
      { href: "/dashboard/integrations/calendar", label: "Integrazioni", icon: Link2 },
    ],
  },
];

const STAFF_ITEM: NavItem = { href: "/dashboard/staff", label: "Staff", icon: ShieldCheck };

type DashboardSidebarProps = {
  hasTenant: boolean;
  isAdmin: boolean;
};

export function DashboardSidebar({ hasTenant, isAdmin }: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  const groups: NavGroup[] = hasTenant
    ? [
        NAV_GROUPS[0],
        {
          ...NAV_GROUPS[1],
          items: [...NAV_GROUPS[1].items, ...(isAdmin ? [STAFF_ITEM] : [])],
        },
        NAV_GROUPS[2],
        NAV_GROUPS[3],
      ]
    : [
        {
          label: "Operativo",
          items: [{ href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true }],
        },
      ];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight">Beauty CRM</div>
          <div className="truncate text-[10px] leading-tight text-muted-foreground">
            Gestionale centri estetici
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
