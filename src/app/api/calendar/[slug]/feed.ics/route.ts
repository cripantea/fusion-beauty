import { NextResponse, type NextRequest } from "next/server";

import { buildICSFeed } from "@/lib/ics";
import { prisma } from "@/lib/prisma";

const WINDOW_DAYS_PAST = 7;
const WINDOW_DAYS_FUTURE = 180;

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const token = request.nextUrl.searchParams.get("token");

  const tenant = await prisma.tenant.findUnique({ where: { slug } });

  if (!tenant || !tenant.isActive || !tenant.icsFeedToken || tenant.icsFeedToken !== token) {
    return new NextResponse("Not found", { status: 404 });
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS_PAST);
  const windowEnd = new Date();
  windowEnd.setDate(windowEnd.getDate() + WINDOW_DAYS_FUTURE);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: tenant.id,
      status: { not: "CANCELLED" },
      startTime: { gte: windowStart, lte: windowEnd },
    },
    include: {
      client: { select: { firstName: true, lastName: true } },
      service: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const icsContent = buildICSFeed(
    tenant.name,
    appointments.map((appointment) => ({
      uid: `${appointment.id}@fusion-beauty`,
      start: appointment.startTime,
      end: appointment.endTime,
      summary: `${appointment.service.name} — ${appointment.client.firstName} ${appointment.client.lastName}`,
    }))
  );

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${tenant.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
