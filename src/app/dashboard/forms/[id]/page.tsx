import { notFound } from "next/navigation";

import { getBaseUrl } from "@/lib/app-url";
import { requireTenantAdmin } from "@/lib/auth-context";
import { formEmbedCode } from "@/lib/embed-code";
import { parseStoredForm } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

import { FormBuilder } from "./form-builder";

export default async function FormBuilderPage({ params }: PageProps<"/dashboard/forms/[id]">) {
  const { id } = await params;
  const { tenantId } = await requireTenantAdmin();
  const [form, baseUrl, waConnected] = await Promise.all([
    prisma.form.findFirst({ where: { id, tenantId } }),
    getBaseUrl(),
    prisma.whatsappConnection.count({ where: { tenantId } }),
  ]);
  if (!form) notFound();
  const welcome = await prisma.whatsappAutomation.findUnique({
    where: { tenantId_kind: { tenantId, kind: "FORM_WELCOME" } },
    select: { enabled: true },
  });

  const { fields, settings } = parseStoredForm(form);

  return (
    <FormBuilder
      id={form.id}
      initial={{
        name: form.name,
        title: form.title,
        fields,
        settings,
        displayMode: form.displayMode,
        color: form.color,
        welcomeMessage: form.welcomeMessage,
        enabled: form.enabled,
      }}
      version={form.updatedAt.getTime()}
      embedCode={formEmbedCode(baseUrl, form.id)}
      publicUrl={`${baseUrl}/f/${form.id}`}
      whatsappWelcome={waConnected > 0 && welcome?.enabled === true}
    />
  );
}
