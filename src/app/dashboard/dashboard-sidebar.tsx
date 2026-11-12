"use client";

import {
  BarChart3,
  Calendar,
  ChevronDown,
  CreditCard,
  FileSignature,
  FileInput,
  FileText,
  Inbox,
  LayoutDashboard,
  Link2,
  Megaphone,
  Receipt,
  MessageCircle,
  Scissors,
  Settings,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { FusionsoftBadge } from "@/components/fusionsoft-badge";
import { BeautyLogo } from "@/components/beauty-logo";
import { sidebarHeadClass, sidebarItemClass, sidebarShellClass } from "@/components/fusionsoft-ui";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  badgeKey?: "requests" | "messages";
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
      { href: "/dashboard/messages", label: "Messaggi", icon: MessageCircle, badgeKey: "messages" },
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
];

// Messaggi automatici e campagne WhatsApp: solo per l'amministratrice.
const MARKETING_GROUP: NavGroup = {
  label: "Marketing",
  items: [
    { href: "/dashboard/automations", label: "Automazioni", icon: Zap },
    { href: "/dashboard/campaigns", label: "Campagne", icon: Megaphone },
  ],
};

const SETTINGS_ITEMS: NavItem[] = [
  { href: "/dashboard/widget", label: "Widget prenotazione", icon: Wand2 },
  { href: "/dashboard/integrations/calendar", label: "Integrazioni", icon: Link2 },
];

// Configurazione del centro (form, WhatsApp): solo per l'amministratrice, in cima alle impostazioni.
const ADMIN_SETUP_ITEMS: NavItem[] = [
  { href: "/dashboard/forms", label: "Form del sito", icon: FileInput },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/dashboard/integrations/stripe", label: "Pagamenti online", icon: CreditCard },
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
  unreadMessages: number;
  /** Incassi in cassa (Pagamenti) attivi per il centro. */
  paymentsEnabled: boolean;
  /** Stripe collegato: "Link di pagamento" nel menu. */
  onlinePayments: boolean;
};

export function DashboardSidebar({
  hasTenant,
  isAdmin,
  tenantName,
  pendingRequests,
  unreadMessages,
  paymentsEnabled,
  onlinePayments,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(false);

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  // Senza incassi in cassa la voce Pagamenti sparisce; con Stripe c'è "Link di pagamento".
  const baseGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.flatMap((item) =>
      item.href !== "/dashboard/payments"
        ? [item]
        : [
            ...(paymentsEnabled ? [item] : []),
            ...(onlinePayments ? [{ href: "/dashboard/payment-links", label: "Link di pagamento", icon: Receipt }] : []),
          ]
    ),
  }));
  const groups: NavGroup[] = hasTenant
    ? isAdmin
      ? [...baseGroups.slice(0, 2), MARKETING_GROUP, ...baseGroups.slice(2)]
      : baseGroups
    : [
        {
          label: "Ogni giorno",
          items: [{ href: "/dashboard", label: "Panoramica", icon: LayoutDashboard, exact: true }],
        },
      ];

  const settingsItems: NavItem[] = hasTenant
    ? isAdmin
      ? [...ADMIN_SETUP_ITEMS, ...SETTINGS_ITEMS, ...ADMIN_ITEMS]
      : SETTINGS_ITEMS
    : [];

  // Su una pagina delle impostazioni il menu resta aperto: si vede dove si è.
  const showSettings = settingsOpen || settingsItems.some((item) => isActive(item.href, item.exact));

  const mobileItems = groups
    .flatMap((group) => group.items)
    .filter((item) =>
      ["/dashboard", "/dashboard/calendar", "/dashboard/clients", "/dashboard/payments", "/dashboard/followup"].includes(
        item.href
      )
    );

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;
    const badge = item.badgeKey === "requests" ? pendingRequests : item.badgeKey === "messages" ? unreadMessages : 0;
    return (
      <Link
        key={item.href}
        href={item.href}
        className={sidebarItemClass(active)}
      >
        <Icon />
        <span className="flex-1">{item.label}</span>
        {badge > 0 ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-wine px-1.5 text-[11px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

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
    <aside className={`hidden lg:flex print:hidden ${sidebarShellClass}`}>
      <div className={sidebarHeadClass}>
        <Link href="/dashboard">
          <BeautyLogo />
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5">
        <div className="truncate px-2.5 font-mono text-xs text-muted-foreground">
          {tenantName ?? "Gestionale centri estetici"}
        </div>
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 px-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map(renderNavItem)}
            </div>
          </div>
        ))}
      </nav>

      {settingsItems.length > 0 && (
        <div className="border-t px-3 py-3">
          <button
            onClick={() => setSettingsOpen((o) => !o)}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-muted-foreground"
          >
            <Settings className="size-3" />
            <span>Impostazioni</span>
            <ChevronDown
              className={cn("ml-auto size-3 transition-transform duration-200", showSettings && "rotate-180")}
            />
          </button>
          {showSettings && (
            <div className="mt-1 flex flex-col gap-0.5">
              {settingsItems.map(renderNavItem)}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-border px-4 py-3">
        <FusionsoftBadge />
      </div>
    </aside>
    </>
  );
}
