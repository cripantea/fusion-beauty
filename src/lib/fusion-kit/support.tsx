// Fusion Kit — componenti condivisi: pulsanti di accesso e widget "Assistenza".
import { fusionIdEnabled, kitConfig } from "./config";
import { supportWidgetToken } from "./service";

/**
 * Pulsanti "Continua con Google" e "Accedi con Fusion ID" per la pagina di login.
 * Link semplici (niente JavaScript): funzionano in server e client component.
 */
export function FusionLoginButtons({
  returnTo,
  className = "",
  labels = {},
}: {
  returnTo?: string | null;
  className?: string;
  /** Testi per i prodotti in più lingue (default in italiano). */
  labels?: { google?: string; fusionId?: string };
}) {
  if (!fusionIdEnabled()) return null;
  const q = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : "";
  const google = Boolean(process.env.FUSION_ID_GOOGLE_IDP_ID);
  const btn =
    "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900";
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {google && (
        <a href={`/auth/fusion/login?google=1${q}`} className={btn}>
          <svg aria-hidden width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
          </svg>
          {labels.google ?? "Continua con Google"}
        </a>
      )}
      <a href={`/auth/fusion/login?x=1${q}`} className={btn}>
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {labels.fusionId ?? "Accedi con Fusion ID"}
      </a>
    </div>
  );
}

/** Separatore "oppure" tra i pulsanti Fusion ID e il vecchio modulo con password. */
export function FusionLoginDivider({ label = "oppure con la password di prima" }: { label?: string }) {
  if (!fusionIdEnabled()) return null;
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-zinc-500">
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      {label}
      <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

/**
 * Pulsante "Assistenza" in basso a destra: apre Fusion Desk (nel CRM) con l'utente già
 * riconosciuto. Da mettere nel layout delle pagine riservate.
 */
export function FusionSupport({
  user,
  position = "right",
  button = true,
  offset = 0,
}: {
  user: Parameters<typeof supportWidgetToken>[0] | null;
  /** Lato del pulsante: a sinistra se a destra ci sono già azioni importanti. */
  position?: "left" | "right";
  /** false = niente pulsante flottante: si apre da codice con window.FusionDesk.open(). */
  button?: boolean;
  /** Pixel da lasciare liberi in basso (es. barra di navigazione mobile fissa). */
  offset?: number;
}) {
  const { controlUrl, secret, product } = kitConfig();
  if (!user || !controlUrl || !secret || !product) return null;
  return (
    <script
      src={`${controlUrl}/fusion-kit/widget.js`}
      data-product={product}
      data-token={supportWidgetToken(user)}
      data-desk={controlUrl}
      data-position={position}
      data-button={button ? "on" : "off"}
      data-offset={offset}
      data-release={process.env.FUSION_RELEASE ?? process.env.GIT_COMMIT ?? ""}
      defer
    />
  );
}
