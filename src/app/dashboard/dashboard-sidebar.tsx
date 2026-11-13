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
  Smartphone,
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
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  /** Etichetta corta per la barra in basso del telefono. */
  short?: string;
  icon: React.ElementType;
  exact?: boolean;
  badgeKey?: "requests" | "messages";
};

// Le cose di ogni giorno: poche, sempre in vista.
const MAIN_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Oggi", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/calendar", label: "Agenda", icon: Calendar },
  { href: "/dashboard/requests", label: "Richieste", icon: Inbox, badgeKey: "requests" },
  { href: "/dashboard/clients", label: "Clienti", icon: Users },
  { href: "/dashboard/messages", label: "Messaggi", icon: MessageCircle, badgeKey: "messages" },
];

// Il resto, chiuso sotto "Altro".
const MORE_ITEMS: NavItem[] = [
  { href: "/dashboard/followup", label: "Da ricontattare", icon: UserRoundCheck },
  { href: "/dashboard/services", label: "Trattamenti", icon: Scissors },
];

const ADMIN_MORE_ITEMS: NavItem[] = [
  { href: "/dashboard/stats", label: "Statistiche", icon: BarChart3 },
  { href: "/dashboard/reports", label: "Report mensile", icon: FileText },
  { href: "/dashboard/automations", label: "Automazioni", icon: Zap },
  { href: "/dashboard/campaigns", label: "Campagne", icon: Megaphone },
];

// Configurazione del centro: solo per l'amministratrice.
const ADMIN_SETTINGS_ITEMS: NavItem[] = [
  { href: "/dashboard/staff", label: "Staff e orari", icon: ShieldCheck },
  { href: "/dashboard/whatsapp", label: "WhatsApp", icon: Smartphone },
  { href: "/dashboard/widget", label: "Prenotazione online", icon: Wand2 },
  { href: "/dashboard/forms", label: "Form del sito", icon: FileInput },
  { href: "/dashboard/integrations/stripe", label: "Stripe", icon: CreditCard },
  { href: "/dashboard/integrations/calendar", label: "Calendario Google", icon: Link2 },
  { href: "/dashboard/consents", label: "Modelli consenso", icon: FileSignature },
];

// Preferenza aperto/chiuso nel browser; null = mai toccata.
const FLAG_EVENT = "sidebar-flag";
function readFlag(key: string): boolean | null {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}
function setStoredFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Senza memoria del browser non si ricorda.
  }
  window.dispatchEvent(new Event(FLAG_EVENT));
}
function subscribeFlags(callback: () => void) {
  window.addEventListener(FLAG_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(FLAG_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
function useStoredFlag(key: string): boolean | null {
  return useSyncExternalStore(subscribeFlags, () => readFlag(key), () => null);
}

type DashboardSidebarProps = {
  hasTenant: boolean;
  isAdmin: boolean;
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
  pendingRequests,
  unreadMessages,
  paymentsEnabled,
  onlinePayments,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href);
  }

  // Incassi: i link di pagamento (Stripe) in vista; la cassa, se attiva, sotto "Altro".
  const mainItems: NavItem[] = hasTenant
    ? [
        ...MAIN_ITEMS,
        ...(onlinePayments
          ? [{ href: "/dashboard/payment-links", label: "Link di pagamento", short: "Pagamenti", icon: Receipt }]
          : paymentsEnabled
            ? [{ href: "/dashboard/payments", label: "Pagamenti", icon: CreditCard }]
            : []),
      ]
    : [MAIN_ITEMS[0]];
  const moreItems: NavItem[] = hasTenant
    ? [
        ...MORE_ITEMS,
        ...(onlinePayments && paymentsEnabled ? [{ href: "/dashboard/payments", label: "Cassa", icon: CreditCard }] : []),
        ...(isAdmin ? ADMIN_MORE_ITEMS : []),
      ]
    : [];
  const settingsItems: NavItem[] = hasTenant && isAdmin ? ADMIN_SETTINGS_ITEMS : [];

  // Aperte o chiuse restano come le lascia l'operatrice, su tutte le pagine (anche dopo un ricaricamento).
  // Finché non le tocca, si apre da sola la sezione della pagina in cui si trova.
  const storedMore = useStoredFlag("sidebar:more");
  const storedSettings = useStoredFlag("sidebar:settings");
  const showMore = storedMore ?? moreItems.some((item) => isActive(item.href, item.exact));
  const showSettings = storedSettings ?? settingsItems.some((item) => isActive(item.href, item.exact));

  const mobileItems = mainItems.slice(0, 5);

  function badgeFor(item: NavItem) {
    return item.badgeKey === "requests" ? pendingRequests : item.badgeKey === "messages" ? unreadMessages : 0;
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href, item.exact);
    const Icon = item.icon;
    const badge = badgeFor(item);
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
            <span className="relative">
              <Icon className={cn("size-5", active && "text-mint-ink")} />
              {badgeFor(item) > 0 ? (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-wine px-1 text-[10px] font-bold text-white">
                  {badgeFor(item)}
                </span>
              ) : null}
            </span>
            {item.short ?? item.label}
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
        <div className="flex flex-col gap-0.5">{mainItems.map(renderNavItem)}</div>

        {moreItems.length > 0 ? (
          <div>
            <button
              onClick={() => setStoredFlag("sidebar:more", !showMore)}
              className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground/80 transition-colors hover:bg-muted/60"
            >
              <span>Altro</span>
              <ChevronDown className={cn("ml-auto size-3 transition-transform duration-200", showMore && "rotate-180")} />
            </button>
            {showMore ? <div className="mt-1 flex flex-col gap-0.5">{moreItems.map(renderNavItem)}</div> : null}
          </div>
        ) : null}
      </nav>

      {settingsItems.length > 0 && (
        <div className="border-t px-3 py-3">
          <button
            onClick={() => setStoredFlag("sidebar:settings", !showSettings)}
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
