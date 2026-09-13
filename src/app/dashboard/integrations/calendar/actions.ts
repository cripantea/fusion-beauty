"use server";

import { randomBytes } from "node:crypto";

import { getTenantContext } from "@/lib/auth-context";
import { parseICSEvents } from "@/lib/ics";
import { prisma } from "@/lib/prisma";

import { icalImportSchema, type IcalImportFormValues } from "./schema";

export type IntegrationDTO = {
  id: string;
  type: "GOOGLE_CALENDAR" | "ICAL_URL";
  isEnabled: boolean;
  externalCalendarUrl: string | null;
  lastSyncedAt: Date | null;
  eventCount: number;
};

export type IntegrationSettings = {
  tenantSlug: string;
  icsFeedToken: string | null;
  googleIntegration: IntegrationDTO | null;
  icalIntegration: IntegrationDTO | null;
};

function toIntegrationDTO(integration: {
  id: string;
  type: "GOOGLE_CALENDAR" | "ICAL_URL";
  isEnabled: boolean;
  externalCalendarUrl: string | null;
  lastSyncedAt: Date | null;
  _count: { events: number };
}): IntegrationDTO {
  return {
    id: integration.id,
    type: integration.type,
    isEnabled: integration.isEnabled,
    externalCalendarUrl: integration.externalCalendarUrl,
    lastSyncedAt: integration.lastSyncedAt,
    eventCount: integration._count.events,
  };
}

export async function getIntegrationSettings(): Promise<IntegrationSettings> {
  const { tenantId } = await getTenantContext();

  const [tenant, integrations] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { slug: true, icsFeedToken: true },
    }),
    prisma.tenantIntegration.findMany({
      where: { tenantId },
      include: { _count: { select: { events: true } } },
    }),
  ]);

  const googleIntegration = integrations.find((item) => item.type === "GOOGLE_CALENDAR");
  const icalIntegration = integrations.find((item) => item.type === "ICAL_URL");

  return {
    tenantSlug: tenant.slug,
    icsFeedToken: tenant.icsFeedToken,
    googleIntegration: googleIntegration ? toIntegrationDTO(googleIntegration) : null,
    icalIntegration: icalIntegration ? toIntegrationDTO(icalIntegration) : null,
  };
}

export type ActionResult = { success: true } | { success: false; error: string };

export async function generateIcsFeedToken(): Promise<
  { success: true; token: string } | { success: false; error: string }
> {
  const { tenantId } = await getTenantContext();

  const token = randomBytes(24).toString("hex");

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { icsFeedToken: token },
  });

  return { success: true, token };
}

/**
 * Google Calendar OAuth is only stubbed out here (schema + UI), not wired to
 * real Google endpoints — that would require registering an OAuth app with
 * Google Cloud Console (client id/secret, consent screen, redirect URI),
 * which isn't available in this environment. This simulates a successful
 * connection so the rest of the integration surface (status, disconnect)
 * can be built and demoed end to end.
 */
export async function connectGoogleCalendarMock(): Promise<ActionResult> {
  const { tenantId } = await getTenantContext();

  await prisma.tenantIntegration.upsert({
    where: { tenantId_type: { tenantId, type: "GOOGLE_CALENDAR" } },
    update: {
      isEnabled: true,
      credentials: { mock: true, connectedAt: new Date().toISOString() },
    },
    create: {
      tenantId,
      type: "GOOGLE_CALENDAR",
      isEnabled: true,
      credentials: { mock: true, connectedAt: new Date().toISOString() },
    },
  });

  return { success: true };
}

export async function disconnectGoogleCalendar(): Promise<ActionResult> {
  const { tenantId } = await getTenantContext();

  await prisma.tenantIntegration.updateMany({
    where: { tenantId, type: "GOOGLE_CALENDAR" },
    data: { isEnabled: false },
  });

  return { success: true };
}

export async function saveIcalImportUrl(
  values: IcalImportFormValues
): Promise<ActionResult> {
  const { tenantId } = await getTenantContext();

  const parsed = icalImportSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: "Inserisci un URL valido." };
  }

  await prisma.tenantIntegration.upsert({
    where: { tenantId_type: { tenantId, type: "ICAL_URL" } },
    update: { isEnabled: true, externalCalendarUrl: parsed.data.url },
    create: {
      tenantId,
      type: "ICAL_URL",
      isEnabled: true,
      externalCalendarUrl: parsed.data.url,
    },
  });

  return { success: true };
}

export async function disconnectIcalImport(): Promise<ActionResult> {
  const { tenantId } = await getTenantContext();

  const integration = await prisma.tenantIntegration.findUnique({
    where: { tenantId_type: { tenantId, type: "ICAL_URL" } },
  });

  if (integration) {
    await prisma.$transaction([
      prisma.externalCalendarEvent.deleteMany({ where: { integrationId: integration.id } }),
      prisma.tenantIntegration.update({
        where: { id: integration.id },
        data: { isEnabled: false, externalCalendarUrl: null, lastSyncedAt: null },
      }),
    ]);
  }

  return { success: true };
}

export async function syncIcalImport(): Promise<
  { success: true; importedCount: number } | { success: false; error: string }
> {
  const { tenantId } = await getTenantContext();

  const integration = await prisma.tenantIntegration.findUnique({
    where: { tenantId_type: { tenantId, type: "ICAL_URL" } },
  });

  if (!integration || !integration.externalCalendarUrl) {
    return { success: false, error: "Configura prima l'URL del calendario da importare." };
  }

  let icsText: string;
  try {
    const response = await fetch(integration.externalCalendarUrl, {
      headers: { Accept: "text/calendar" },
      cache: "no-store",
    });

    if (!response.ok) {
      return { success: false, error: `Impossibile scaricare il calendario (HTTP ${response.status}).` };
    }

    icsText = await response.text();
  } catch {
    return { success: false, error: "Impossibile raggiungere l'URL del calendario esterno." };
  }

  const events = parseICSEvents(icsText);

  await prisma.$transaction([
    prisma.externalCalendarEvent.deleteMany({ where: { integrationId: integration.id } }),
    ...events.map((event) =>
      prisma.externalCalendarEvent.create({
        data: {
          tenantId,
          integrationId: integration.id,
          externalUid: event.uid,
          startTime: event.start,
          endTime: event.end,
          summary: event.summary,
        },
      })
    ),
    prisma.tenantIntegration.update({
      where: { id: integration.id },
      data: { lastSyncedAt: new Date() },
    }),
  ]);

  return { success: true, importedCount: events.length };
}
