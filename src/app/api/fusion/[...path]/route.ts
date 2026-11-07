import { createFusionRoutes } from "@/lib/fusion-kit";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { SUPER_ADMIN: "superadmin", ADMIN: "titolare", OPERATOR: "operatore" } as const;

/** Fusion Kit: Beauty visto da Fusion Control (clienti = centri estetici). */
const routes = createFusionRoutes(
  {
    checks: {
      database: async () => (await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`).length === 1,
    },
    async listTenants() {
      const tenants = await prisma.tenant.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true, name: true, email: true, isActive: true, createdAt: true, updatedAt: true,
          users: { where: { role: "ADMIN" }, select: { email: true }, orderBy: { createdAt: "asc" }, take: 1 },
          _count: { select: { users: true, clients: true } },
        },
      });
      return tenants.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.isActive ? ("active" as const) : ("suspended" as const),
        plan: `${t._count.clients} clienti`,
        users: t._count.users,
        createdAt: t.createdAt.toISOString(),
        lastActivityAt: t.updatedAt.toISOString(),
        contactEmail: t.users[0]?.email ?? t.email,
      }));
    },
    async listUsers() {
      const users = await prisma.user.findMany({ include: { tenant: { select: { name: true } } }, orderBy: { createdAt: "asc" } });
      return users.map((u) => ({
        id: u.id,
        email: u.email,
        name: `${u.firstName} ${u.lastName}`.trim(),
        role: u.isActive ? ROLE_LABEL[u.role] : "disattivato",
        tenantId: u.tenantId,
        tenantName: u.tenant?.name ?? null,
        fusionIdSub: u.fusionIdSub,
        createdAt: u.createdAt.toISOString(),
      }));
    },
    async setTenantSuspended(tenantId, suspended) {
      await prisma.tenant.update({ where: { id: tenantId }, data: { isActive: !suspended } });
    },
    async impersonationTarget(tenantId, userId) {
      const user = await prisma.user.findFirst({
        where: { tenantId, isActive: true, ...(userId ? { id: userId } : { role: "ADMIN" }) },
        orderBy: { createdAt: "asc" },
      });
      return user ? { userId: user.id } : null;
    },
    async revokeSessions(email) {
      const r = await prisma.user.updateMany({ where: { email }, data: { sessionsRevokedAt: new Date() } });
      return r.count;
    },
  },
  { appUrl: () => process.env.FUSION_ID_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "" },
);

export const GET = routes.GET;
export const POST = routes.POST;
