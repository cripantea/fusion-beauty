import { getBaseUrl } from "@/lib/app-url";
import { requireTenantAdmin } from "@/lib/auth-context";
import { formEmbedCode } from "@/lib/embed-code";
import { prisma } from "@/lib/prisma";

import { FormsManager } from "./forms-manager";

export default async function FormsPage() {
  const { tenantId } = await requireTenantAdmin();
  const [forms, baseUrl] = await Promise.all([
    prisma.form.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        displayMode: true,
        enabled: true,
        _count: { select: { submissions: true } },
        submissions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    }),
    getBaseUrl(),
  ]);

  return (
    <FormsManager
      forms={forms.map((form) => ({
        id: form.id,
        name: form.name,
        displayMode: form.displayMode,
        enabled: form.enabled,
        submissions: form._count.submissions,
        lastSubmissionAt: form.submissions[0]?.createdAt.toISOString() ?? null,
        embedCode: formEmbedCode(baseUrl, form.id),
        publicUrl: `${baseUrl}/f/${form.id}`,
      }))}
    />
  );
}
