import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mint-ink">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1 text-3xl font-bold leading-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const accentClasses = {
  mint: { bar: "bg-mint", icon: "bg-mint-soft text-mint-ink" },
  amber: { bar: "bg-amber-400", icon: "bg-amber-soft text-amber-ink" },
  teal: { bar: "bg-teal-400", icon: "bg-teal-50 text-teal-700" },
  wine: { bar: "bg-wine", icon: "bg-wine-soft text-wine" },
} as const;

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "mint",
  subClassName,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  accent?: keyof typeof accentClasses;
  subClassName?: string;
}) {
  const classes = accentClasses[accent];
  return (
    <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-mint-border bg-card p-5 pr-6 shadow-sm">
      <span className={cn("absolute inset-y-0 right-0 w-1.5", classes.bar)} />
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 font-heading text-2xl font-bold leading-tight lg:text-[1.65rem]">{value}</div>
        {sub ? (
          <div className={cn("mt-1 text-sm font-medium text-mint-ink", subClassName)}>{sub}</div>
        ) : null}
      </div>
      {Icon ? (
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", classes.icon)}>
          <Icon className="size-5" />
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  icon: Icon,
  action,
  children,
  className,
  tone = "default",
}: {
  title?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "wine";
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-sm",
        tone === "wine" ? "border-wine/20" : "border-mint-border",
        className
      )}
    >
      {title ? (
        <header
          className={cn(
            "flex items-center justify-between gap-3 px-5 py-3.5",
            tone === "wine" ? "bg-wine text-white" : "border-b border-mint-border/70"
          )}
        >
          <h2 className="flex items-center gap-2 font-sans text-sm font-semibold">
            {Icon ? <Icon className="size-4" /> : null}
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Avatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-mint-soft text-sm font-bold text-mint-ink ring-2 ring-mint/40",
        className
      )}
    >
      {initials}
    </span>
  );
}

export function Pill({
  children,
  tone = "mint",
  className,
}: {
  children: React.ReactNode;
  tone?: "mint" | "amber" | "wine" | "slate" | "forest";
  className?: string;
}) {
  const tones = {
    mint: "bg-mint-soft text-mint-ink border-mint-border",
    amber: "bg-amber-soft text-amber-ink border-amber-200",
    wine: "bg-wine-soft text-wine border-wine/20",
    slate: "bg-muted text-muted-foreground border-border",
    forest: "bg-forest text-forest-foreground border-forest",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
