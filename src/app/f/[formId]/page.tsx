import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";

import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ formId: string }>; searchParams: Promise<{ v?: string }> };

async function findForm(formId: string) {
  return prisma.form.findFirst({
    where: { id: formId, enabled: true, tenant: { isActive: true } },
    select: { id: true, title: true, displayMode: true, tenant: { select: { name: true } } },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const form = await findForm((await params).formId);
  return { title: form ? `${form.title || "Contattaci"} – ${form.tenant.name}` : "Modulo non disponibile", robots: { index: false } };
}

/**
 * Link diretto del form (da condividere su Instagram, WhatsApp…) e anteprima del
 * costruttore: la pagina carica lo stesso script che si incolla nei siti.
 */
export default async function PublicFormPage({ params, searchParams }: Props) {
  const { formId } = await params;
  const { v } = await searchParams;
  const form = await findForm(formId);
  if (!form) notFound();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      {form.displayMode === "POPUP" ? (
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Tocca la bolla in basso a destra per scrivere a {form.tenant.name}.
        </p>
      ) : null}
      <div className="w-full max-w-xl" id={`fusion-beauty-form-${form.id}`} />
      <Script src={`/api/embed/form/${form.id}${v ? `?v=${encodeURIComponent(v)}` : ""}`} strategy="afterInteractive" />
    </main>
  );
}
