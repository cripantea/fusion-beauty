import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { RegisterForm } from "./register-form";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { name: true } });
  return { title: tenant ? `Registrati — ${tenant.name}` : "Centro non trovato" };
}

export default async function RegisterPage({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { name: true, slug: true, logoUrl: true, isActive: true },
  });

  if (!tenant || !tenant.isActive) notFound();

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-background px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logoUrl} alt={tenant.name} className="size-16 rounded-full object-cover shadow-sm" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-3xl font-bold text-primary">
            {tenant.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-heading text-2xl font-bold text-foreground">{tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inserisci i tuoi dati per essere registrata come cliente del centro.
          </p>
        </div>
      </div>

      <RegisterForm slug={slug} centerName={tenant.name} />
    </div>
  );
}
