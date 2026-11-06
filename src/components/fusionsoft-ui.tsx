"use client";

/**
 * Kit Fusionsoft UI — struttura comune a tutti i prodotti (sito, CRM, FusionWA, Preventivi, Beauty, Moduli, SinistroPro).
 * I colori restano quelli del singolo prodotto (token `primary`, `foreground`, `muted`…); qui si fissano
 * solo struttura, tipografia (Geist / Geist Mono), raggi (6/8/12) e bordi. Stessa API della versione Vue.
 */
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

type NavLink = { label: string; href: string; external?: boolean };

function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function A({ link, className, onClick }: { link: NavLink; className?: string; onClick?: () => void }) {
  if (link.external || link.href.startsWith("http") || link.href.startsWith("mailto:") || link.href.startsWith("tel:")) {
    return (
      <a href={link.href} className={className} target={link.href.startsWith("http") ? "_blank" : undefined} rel="noopener">
        {link.label}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}

/** Marchio del prodotto (22px) + nome (17px semibold). */
export function BrandLockup({ mark, name, className }: { mark: ReactNode; name: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <span className="inline-flex size-[22px] shrink-0 items-center justify-center [&>*]:size-full">{mark}</span>
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{name}</span>
    </span>
  );
}

/** Header pubblico: 64px, bordo sotto, nav a sinistra, azioni a destra, menu a tendina su mobile. */
export function SiteHeader({
  brand,
  homeHref = "/",
  nav,
  actions,
  mobileActions,
}: {
  brand: ReactNode;
  homeHref?: string;
  nav: NavLink[];
  actions?: ReactNode;
  mobileActions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-6">
        <Link href={homeHref} className="shrink-0">
          {brand}
        </Link>
        <nav className="hidden flex-1 items-center gap-6 md:flex">
          {nav.map((l) => (
            <A key={l.href} link={l} className="text-sm text-muted-foreground transition-colors hover:text-foreground" />
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-4 md:flex">{actions}</div>
        <button
          type="button"
          className="-mr-2 ml-auto p-2 text-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Chiudi menu" : "Apri menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-5 pb-5 pt-1 md:hidden">
          <nav className="flex flex-col">
            {nav.map((l) => (
              <A
                key={l.href}
                link={l}
                onClick={() => setOpen(false)}
                className="border-b border-border py-3.5 text-base font-medium text-foreground"
              />
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2">{mobileActions ?? actions}</div>
        </div>
      )}
    </header>
  );
}

/** Classi dei pulsanti comuni: raggio 8, nessuna ombra. */
export const fsButton = {
  primary:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
  outline:
    "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted",
  ghost: "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
  lg: "h-11 px-5 text-[15px]",
};

/** Footer pubblico: 4 colonne (marchio + 3 gruppi di link), riga legale in Geist Mono. */
export function SiteFooter({
  brand,
  tagline,
  columns,
  legalName,
  legalLinks = [],
  children,
}: {
  brand: ReactNode;
  tagline?: ReactNode;
  columns: { title: string; links: NavLink[] }[];
  legalName: string;
  legalLinks?: NavLink[];
  children?: ReactNode;
}) {
  return (
    <footer className="border-t border-border bg-background text-sm text-muted-foreground">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            {brand}
            {tagline && <p className="max-w-xs leading-relaxed">{tagline}</p>}
            {children}
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <h2 className="font-medium text-foreground">{c.title}</h2>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <A link={l} className="transition-colors hover:text-foreground" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-5 font-mono text-xs md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {legalName} · Fusion Media di Luca Gabriele Pantea · P.IVA 13148540969
          </p>
          <div className="flex flex-wrap items-center gap-5">
            {legalLinks.map((l) => (
              <A key={l.href} link={l} className="transition-colors hover:text-foreground" />
            ))}
            <a href="https://fusionsoft.it" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-foreground">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/fusionsoft-mark.png" alt="" className="size-3.5 object-contain" />
              Un prodotto Fusionsoft
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/** Etichetta sopra i titoli di sezione: Geist Mono, pallino nel colore del prodotto. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-md border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-primary" />
      {children}
    </span>
  );
}

/** Voce del menu laterale delle app: attiva = sfondo pieno + bordo, icona nel colore del prodotto. */
export function sidebarItemClass(active: boolean) {
  return cx(
    "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
    active
      ? "border-border bg-background font-medium text-foreground [&_svg]:text-primary"
      : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
  );
}

/** Contenitore del menu laterale: superficie tenue, bordo a destra, marchio in alto (64px), badge in basso. */
export const sidebarShellClass = "flex w-60 shrink-0 flex-col border-r border-border bg-muted/40";
export const sidebarHeadClass = "flex h-16 items-center border-b border-border px-4";

/** Pagina di accesso: card centrata 400px, marchio sopra, badge Fusionsoft sotto. */
export function AuthShell({
  brand,
  title,
  subtitle,
  children,
  footer,
}: {
  brand: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <div>{brand}</div>
      <div className="w-full max-w-[400px] rounded-xl border border-border bg-background p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer}
    </div>
  );
}
