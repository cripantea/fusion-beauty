"use server";

import { getTenantContext } from "@/lib/auth-context";
import { prisma } from "@/lib/prisma";

export type BookingRequestDTO = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  service: { id: string; name: string; price: number; durationMinutes: number } | null;
  preferredDate: string | null;
  preferredTime: string | null;
  notes: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  createdAt: Date;
};

function toDTO(req: {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  service: { id: string; name: string; price: { toNumber(): number }; durationMinutes: number } | null;
  preferredDate: string | null;
  preferredTime: string | null;
  notes: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  createdAt: Date;
}): BookingRequestDTO {
  return {
    ...req,
    service: req.service
      ? { ...req.service, price: req.service.price.toNumber() }
      : null,
  };
}

export async function getBookingRequests(status?: "PENDING" | "CONFIRMED" | "REJECTED"): Promise<BookingRequestDTO[]> {
  const { tenantId } = await getTenantContext();

  const requests = await prisma.bookingRequest.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      service: { select: { id: true, name: true, price: true, durationMinutes: true } },
    },
  });

  return requests.map(toDTO);
}

export type RequestActionResult =
  | { success: true }
  | { success: false; error: string };

export async function confirmBookingRequest(
  id: string,
  operatorId: string | null
): Promise<RequestActionResult> {
  const { tenantId } = await getTenantContext();

  const request = await prisma.bookingRequest.findFirst({
    where: { id, tenantId, status: "PENDING" },
    include: { service: true },
  });

  if (!request) return { success: false, error: "Richiesta non trovata." };

  let startTime: Date;
  if (request.preferredDate && request.preferredTime) {
    startTime = new Date(`${request.preferredDate}T${request.preferredTime}:00`);
  } else if (request.preferredDate) {
    startTime = new Date(`${request.preferredDate}T09:00:00`);
  } else {
    startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(9, 0, 0, 0);
  }

  const durationMinutes = request.service?.durationMinutes ?? 60;
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

  let client = await prisma.client.findFirst({
    where: { tenantId, phone: request.phone },
  });

  if (!client) {
    client = await prisma.client.create({
      data: {
        tenantId,
        firstName: request.firstName,
        lastName: request.lastName,
        phone: request.phone,
        email: request.email,
      },
    });
  }

  const appointment = await prisma.appointment.create({
    data: {
      tenantId,
      clientId: client.id,
      serviceId: request.serviceId ?? (await getDefaultService(tenantId)),
      operatorId,
      startTime,
      endTime,
      status: "CONFIRMED",
      price: request.service?.price,
      notes: request.notes,
    },
  });

  await prisma.bookingRequest.update({
    where: { id },
    data: { status: "CONFIRMED", convertedToId: appointment.id },
  });

  return { success: true };
}

async function getDefaultService(tenantId: string): Promise<string> {
  const service = await prisma.service.findFirst({
    where: { tenantId, isActive: true },
    select: { id: true },
  });
  if (!service) throw new Error("Nessun trattamento disponibile.");
  return service.id;
}

export async function rejectBookingRequest(id: string): Promise<RequestActionResult> {
  const { tenantId } = await getTenantContext();

  const result = await prisma.bookingRequest.updateMany({
    where: { id, tenantId },
    data: { status: "REJECTED" },
  });

  if (result.count === 0) return { success: false, error: "Richiesta non trovata." };
  return { success: true };
}
