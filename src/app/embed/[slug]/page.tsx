import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";

import { EmbedAutoHeight } from "./auto-height";
import { getPublicTenantWidgetData } from "./data";
import { WidgetBookingFlow } from "./widget-booking-flow";

type EmbedPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Stile "elegante" per i siti dei centri: font e colori del marchio, meno
 * contorni, titoli maiuscoli spaziati, card bianche leggere. Solo CSS sopra i
 * componenti dell'agenda (data-slot), così il flusso resta quello di sempre.
 */
const ELEGANT_CSS = `
.bk-elegant{font-family:var(--bk-font,inherit);background:var(--bk-bg,transparent);color:#111;padding:8px 4px}
.bk-elegant *{font-family:inherit}
.bk-elegant [data-slot=card]{background:#fff;border:1px solid rgba(17,17,17,.08);border-radius:16px;box-shadow:0 1px 2px rgba(17,17,17,.04);transition:border-color .2s,box-shadow .2s,transform .2s}
.bk-elegant [data-slot=card][role=button]:hover{border-color:var(--primary);box-shadow:0 8px 24px rgba(17,17,17,.08);transform:translateY(-1px)}
.bk-elegant [data-slot=card-title]{font-weight:700;letter-spacing:.01em}
.bk-elegant [data-slot=card-description]{color:#5f6b66}
.bk-elegant h3{color:var(--bk-accent,#8a7350);letter-spacing:.18em;font-weight:700}
.bk-elegant [data-slot=button]{border-radius:999px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.bk-elegant input{border-radius:999px;background:#fff;border-color:rgba(17,17,17,.12);padding-left:18px}
.bk-elegant textarea{border-radius:16px;background:#fff}
.bk-elegant .text-primary{color:var(--bk-accent,var(--primary))}
`;

function param(query: Record<string, string | string[] | undefined>, key: string, max = 100): string {
  const value = query[key];
  return (Array.isArray(value) ? value[0] : value ?? "").trim().slice(0, max);
}

export async function generateMetadata({ params }: EmbedPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicTenantWidgetData(slug);

  return {
    title: data ? `Prenota – ${data.tenant.name}` : "Centro non trovato",
  };
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  // ?embed=1: dentro l'iframe dello script, l'altezza la decide il contenuto.
  const inFrame = param(query, "embed") === "1";
  const data = await getPublicTenantWidgetData(slug);

  if (!data) {
    notFound();
  }

  const { tenant } = data;
  // Agende personalizzate: ?servizi=id1,id2 mostra solo quei trattamenti (uno
  // solo = già scelto), ?colore=#hex il colore del centro, ?intestazione=0
  // toglie logo e nome quando la pagina del sito ha già il suo titolo.
  const only = param(query, "servizi", 2000).split(",").map((id) => id.trim()).filter(Boolean);
  // ?cerca=laser,pedicure: i trattamenti il cui nome contiene una di queste parole
  // (per le pagine del sito dedicate a un servizio; restano giuste se se ne aggiungono).
  const words = param(query, "cerca", 300).toLowerCase().split(",").map((w) => w.trim()).filter(Boolean);
  const filtered = only.length
    ? data.services.filter((service) => only.includes(service.id))
    : words.length
      ? data.services.filter((service) => words.some((w) => service.name.toLowerCase().includes(w)))
      : [];
  const services = filtered.length ? filtered : data.services;
  const color = param(query, "colore") || param(query, "color");
  const showHeader = param(query, "intestazione") !== "0";
  // Stile del sito che ospita l'agenda: ?stile=elegante&font=Montserrat&accento=#hex&sfondo=#hex
  const elegant = param(query, "stile") === "elegante";
  const fontParam = param(query, "font", 60);
  const font = /^[A-Za-z0-9 ]{1,60}$/.test(fontParam) ? fontParam : "";
  const accent = param(query, "accento");
  const background = param(query, "sfondo");
  const themeVars: Record<string, string> = {};
  if (HEX_COLOR.test(color)) Object.assign(themeVars, { "--primary": color, "--ring": color });
  if (HEX_COLOR.test(accent)) themeVars["--bk-accent"] = accent;
  if (HEX_COLOR.test(background)) Object.assign(themeVars, { "--background": background, "--bk-bg": background });
  if (font) themeVars["--bk-font"] = `'${font}', system-ui, sans-serif`;
  // Dati già noti alla pagina che ospita l'agenda (es. dopo un form): precompilati.
  const prefill = {
    firstName: param(query, "nome"),
    lastName: param(query, "cognome"),
    phone: param(query, "telefono", 30),
    email: param(query, "email", 200),
  };

  return (
    <EmbedAutoHeight
      className={cn(
        "mx-auto w-full space-y-4 bg-background p-4",
        elegant ? "bk-elegant max-w-xl" : "max-w-md",
        !inFrame && "min-h-screen"
      )}
      style={Object.keys(themeVars).length ? (themeVars as React.CSSProperties) : undefined}
    >
      {font ? (
         
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@400;500;600;700;800;900&display=swap`} />
      ) : null}
      {elegant ? <style>{ELEGANT_CSS}</style> : null}
      {HEX_COLOR.test(background) ? <style>{`html,body{background:${background}}`}</style> : null}
      {showHeader ? (
      <div className="flex flex-col items-center gap-2 pt-6 pb-4 text-center">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant.name}
            className="size-16 rounded-full object-cover shadow-sm"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-bold text-primary">
            {tenant.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{tenant.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Prenota il tuo trattamento online</p>
        </div>
      </div>
      ) : null}

      <WidgetBookingFlow
        slug={tenant.slug}
        services={services}
        initialServiceId={services.length === 1 ? services[0].id : undefined}
        prefill={prefill}
      />
    </EmbedAutoHeight>
  );
}
