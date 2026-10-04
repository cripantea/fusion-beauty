import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";

import { QuestionnaireForm } from "./questionnaire-form";

export const metadata: Metadata = {
  title: "Questionario cliente",
  robots: { index: false, follow: false },
};

type QuestionnairePageProps = {
  params: Promise<{ token: string }>;
};

export default async function QuestionnairePage({ params }: QuestionnairePageProps) {
  const { token } = await params;

  const questionnaire = await prisma.clientQuestionnaire.findUnique({
    where: { token },
    include: {
      client: { select: { firstName: true, email: true } },
      tenant: { select: { name: true, isActive: true } },
    },
  });

  if (!questionnaire || !questionnaire.tenant.isActive) {
    notFound();
  }

  const services = await prisma.service.findMany({
    where: { tenantId: questionnaire.tenantId, isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-forest px-5 pb-10 pt-8 text-forest-foreground">
        <div className="mx-auto max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-mint">
            {questionnaire.tenant.name}
          </div>
          <h1 className="mt-2 text-3xl font-bold leading-tight">
            Ciao {questionnaire.client.firstName}, benvenuta!
          </h1>
          <p className="mt-2 text-sm text-forest-foreground/80">
            Un minuto per raccontarci qualcosa di te: ci aiuta a prenderci cura di te nel modo
            migliore. Rispondi solo a ciò che ti va.
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-lg px-4 pb-12">
        <QuestionnaireForm
          token={token}
          alreadyCompleted={Boolean(questionnaire.completedAt)}
          hasEmail={Boolean(questionnaire.client.email)}
          services={services.map((service) => service.name)}
          tenantName={questionnaire.tenant.name}
        />
      </main>
    </div>
  );
}
