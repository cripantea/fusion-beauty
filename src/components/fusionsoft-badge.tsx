import { cn } from "@/lib/utils";

/** Marchio "Un prodotto Fusionsoft", con link al sito dell'azienda. */
export function FusionsoftBadge({
  tone = "light",
  className,
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <a
      href="https://fusionsoft.it"
      target="_blank"
      rel="noopener"
      className={cn(
        "inline-flex items-center gap-2 text-xs transition-colors",
        tone === "dark"
          ? "text-white/60 hover:text-white/90"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/fusionsoft-mark.png" alt="" width={20} height={20} className="size-5 object-contain" />
      <span>
        Un prodotto <strong className="font-semibold">Fusionsoft</strong>
      </span>
    </a>
  );
}
