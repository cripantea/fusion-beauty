import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";

import { EmbedAutoHeight } from "./auto-height";
import { getPublicTenantWidgetData } from "./data";
import { WidgetBookingFlow } from "./widget-booking-flow";

type EmbedPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string }>;
};

export async function generateMetadata({ params }: EmbedPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicTenantWidgetData(slug);

  return {
    title: data ? `Prenota – ${data.tenant.name}` : "Centro non trovato",
  };
}

export default async function EmbedPage({ params, searchParams }: EmbedPageProps) {
  const { slug } = await params;
  // ?embed=1: dentro l'iframe dello script, l'altezza la decide il contenuto.
  const inFrame = (await searchParams).embed === "1";
  const data = await getPublicTenantWidgetData(slug);

  if (!data) {
    notFound();
  }

  const { tenant, services } = data;

  return (
    <EmbedAutoHeight className={cn("mx-auto w-full max-w-md space-y-4 bg-background p-4", !inFrame && "min-h-screen")}>
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

      <WidgetBookingFlow slug={tenant.slug} services={services} />
    </EmbedAutoHeight>
  );
}
