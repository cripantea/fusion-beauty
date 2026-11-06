/** Fiamma doppia di Fusion Beauty, nel colore primario del tema attivo. */
export function FusionFlame({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 62 78" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M 24 74 C 6 68 0 50 10 32 C 16 20 22 12 22 2 C 34 12 42 30 38 50 C 36 60 28 66 26 72 Z" fill="currentColor" />
      <path
        d="M 36 74 C 34 64 34 56 38 48 C 44 36 52 24 52 12 C 52 4 50 0 52 0 C 66 10 74 32 68 52 C 62 68 52 76 38 76 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Marchio + nome, stesso schema di tutti i prodotti Fusionsoft. */
export function BeautyLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <FusionFlame className="h-[22px] w-[18px] shrink-0 text-primary" />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
        Fusion<span className="text-primary">Beauty</span>
      </span>
    </span>
  );
}
