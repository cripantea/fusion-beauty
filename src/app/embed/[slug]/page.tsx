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
  const filtered = only.length ? data.services.filter((service) => only.includes(service.id)) : [];
  const services = filtered.length ? filtered : data.services;
  const color = param(query, "colore") || param(query, "color");
  const showHeader = param(query, "intestazione") !== "0";
  // Dati già noti alla pagina che ospita l'agenda (es. dopo un form): precompilati.
  const prefill = {
    firstName: param(query, "nome"),
    lastName: param(query, "cognome"),
    phone: param(query, "telefono", 30),
    email: param(query, "email", 200),
  };

  return (
    <EmbedAutoHeight
      className={cn("mx-auto w-full max-w-md space-y-4 bg-background p-4", !inFrame && "min-h-screen")}
      style={HEX_COLOR.test(color) ? ({ "--primary": color, "--ring": color } as React.CSSProperties) : undefined}
    >
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
