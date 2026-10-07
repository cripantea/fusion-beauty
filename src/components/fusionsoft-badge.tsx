import { cn } from "@/lib/utils";

/** Marchio "Un prodotto Fusionsoft" con dati legali, link al sito dell'azienda. */
export function FusionsoftBadge({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <a
      href="https://fusionsoft.it"
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-2.5 text-left transition-colors",
        dark ? "text-white/60 hover:text-white/90" : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/fusionsoft-mark.png" alt="" width={20} height={20} className="size-5 shrink-0 object-contain" />
      <span className="flex flex-col leading-tight">
        <span className="text-xs">
          Un prodotto <strong className={cn("font-semibold", dark ? "text-white" : "text-foreground")}>Fusionsoft</strong>
        </span>
        <span className="text-[10px] opacity-80">Fusion Media di Luca Gabriele Pantea · P.IVA 13148540969</span>
      </span>
    </a>
  );
}
