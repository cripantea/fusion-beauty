import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ─── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function atTime(base: Date, hour: number, minute = 0): Date {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Client names (Italian) ──────────────────────────────────────────────────

const CLIENTS: Array<{ firstName: string; lastName: string; phone: string; email?: string }> = [
  { firstName: "Sofia", lastName: "Ricci", phone: "+39 347 1234001", email: "sofia.ricci@gmail.com" },
  { firstName: "Giulia", lastName: "Esposito", phone: "+39 347 1234002", email: "giulia.esposito@libero.it" },
  { firstName: "Martina", lastName: "Romano", phone: "+39 347 1234003" },
  { firstName: "Valentina", lastName: "Ferrari", phone: "+39 347 1234004", email: "valentina.ferrari@hotmail.it" },
  { firstName: "Chiara", lastName: "Bianchi", phone: "+39 347 1234005" },
  { firstName: "Elisa", lastName: "Conti", phone: "+39 347 1234006", email: "elisa.conti@gmail.com" },
  { firstName: "Federica", lastName: "Galli", phone: "+39 347 1234007" },
  { firstName: "Alessia", lastName: "Mancini", phone: "+39 347 1234008", email: "alessia.mancini@yahoo.it" },
  { firstName: "Sara", lastName: "Barbieri", phone: "+39 347 1234009" },
  { firstName: "Giorgia", lastName: "Marini", phone: "+39 347 1234010", email: "giorgia.marini@gmail.com" },
  { firstName: "Laura", lastName: "Greco", phone: "+39 347 1234011" },
  { firstName: "Roberta", lastName: "Lombardi", phone: "+39 347 1234012", email: "roberta.lombardi@gmail.com" },
  { firstName: "Silvia", lastName: "Santoro", phone: "+39 347 1234013" },
  { firstName: "Anna", lastName: "Rizzi", phone: "+39 347 1234014", email: "anna.rizzi@libero.it" },
  { firstName: "Claudia", lastName: "De Luca", phone: "+39 347 1234015" },
  { firstName: "Paola", lastName: "Moretti", phone: "+39 347 1234016", email: "paola.moretti@gmail.com" },
  { firstName: "Francesca", lastName: "Villa", phone: "+39 347 1234017" },
  { firstName: "Monica", lastName: "Costa", phone: "+39 347 1234018", email: "monica.costa@hotmail.it" },
  { firstName: "Elena", lastName: "Fontana", phone: "+39 347 1234019" },
  { firstName: "Cristina", lastName: "Ferrara", phone: "+39 347 1234020", email: "cristina.ferrara@gmail.com" },
  { firstName: "Barbara", lastName: "Russo", phone: "+39 347 1234021" },
  { firstName: "Daniela", lastName: "Gentile", phone: "+39 347 1234022", email: "daniela.gentile@libero.it" },
  { firstName: "Luisa", lastName: "Caruso", phone: "+39 347 1234023" },
  { firstName: "Carla", lastName: "Leone", phone: "+39 347 1234024", email: "carla.leone@gmail.com" },
  { firstName: "Maria", lastName: "Verdi", phone: "+39 333 1112233", email: "maria.verdi@example.com" },
  { firstName: "Giovanna", lastName: "Fiore", phone: "+39 347 1234026" },
  { firstName: "Angela", lastName: "Serra", phone: "+39 347 1234027", email: "angela.serra@yahoo.it" },
  { firstName: "Rosa", lastName: "Pellegrini", phone: "+39 347 1234028" },
  { firstName: "Lucia", lastName: "Palumbo", phone: "+39 347 1234029", email: "lucia.palumbo@gmail.com" },
  { firstName: "Ivana", lastName: "Poli", phone: "+39 347 1234030" },
  { firstName: "Nadia", lastName: "Martinelli", phone: "+39 347 1234031", email: "nadia.martinelli@libero.it" },
  { firstName: "Tiziana", lastName: "Bruno", phone: "+39 347 1234032" },
  { firstName: "Simona", lastName: "Colombo", phone: "+39 347 1234033", email: "simona.colombo@gmail.com" },
  { firstName: "Patrizia", lastName: "Coppola", phone: "+39 347 1234034" },
  { firstName: "Miriam", lastName: "Marcon", phone: "+39 347 1234035", email: "miriam.marcon@hotmail.it" },
  // Inactive clients (will have last visit > 90 days ago)
  { firstName: "Rossella", lastName: "Riva", phone: "+39 347 1234036" },
  { firstName: "Ornella", lastName: "Longo", phone: "+39 347 1234037", email: "ornella.longo@gmail.com" },
  { firstName: "Manuela", lastName: "Fabbri", phone: "+39 347 1234038" },
  { firstName: "Sabrina", lastName: "Fiori", phone: "+39 347 1234039", email: "sabrina.fiori@libero.it" },
  { firstName: "Emanuela", lastName: "Sartori", phone: "+39 347 1234040" },
  { firstName: "Antonella", lastName: "Graziani", phone: "+39 347 1234041", email: "antonella.graziani@gmail.com" },
  { firstName: "Graziella", lastName: "Pace", phone: "+39 347 1234042" },
  { firstName: "Donatella", lastName: "Riva", phone: "+39 347 1234043", email: "donatella.riva@yahoo.it" },
  { firstName: "Serena", lastName: "Mele", phone: "+39 347 1234044" },
  { firstName: "Alessandra", lastName: "Monti", phone: "+39 347 1234045", email: "alessandra.monti@gmail.com" },
  { firstName: "Catia", lastName: "Piras", phone: "+39 347 1234046" },
  { firstName: "Loredana", lastName: "Bassi", phone: "+39 347 1234047", email: "loredana.bassi@libero.it" },
  { firstName: "Flavia", lastName: "Negro", phone: "+39 347 1234048" },
  { firstName: "Rita", lastName: "Giordano", phone: "+39 347 1234049", email: "rita.giordano@gmail.com" },
  { firstName: "Wanda", lastName: "Mazzola", phone: "+39 347 1234050" },
];

async function main() {
  console.log("🌱 Seeding Beauty CRM demo data...");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // ─── Super Admin ─────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "superadmin@fusion-beauty.dev" },
    update: {},
    create: {
      email: "superadmin@fusion-beauty.dev",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "SUPER_ADMIN",
      tenantId: null,
    },
  });

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: "centro-demo" },
    update: { name: "Centro Estetico Bella" },
    create: {
      name: "Centro Estetico Bella",
      slug: "centro-demo",
      phone: "+39 011 4567890",
      email: "info@centroesteticobella.it",
      isActive: true,
    },
  });

  // ─── Staff ────────────────────────────────────────────────────────────────
  const anna = await prisma.user.upsert({
    where: { email: "admin@centro-demo.it" },
    update: {},
    create: {
      email: "admin@centro-demo.it",
      passwordHash,
      firstName: "Anna",
      lastName: "Rossi",
      role: "ADMIN",
      tenantId: tenant.id,
    },
  });

  const giulia = await prisma.user.upsert({
    where: { email: "giulia@centro-demo.it" },
    update: {},
    create: {
      email: "giulia@centro-demo.it",
      passwordHash,
      firstName: "Giulia",
      lastName: "Bianchi",
      role: "OPERATOR",
      tenantId: tenant.id,
    },
  });

  const marta = await prisma.user.upsert({
    where: { email: "marta@centro-demo.it" },
    update: {},
    create: {
      email: "marta@centro-demo.it",
      passwordHash,
      firstName: "Marta",
      lastName: "Ferrari",
      role: "OPERATOR",
      tenantId: tenant.id,
    },
  });

  // Keep legacy operator for compatibility
  await prisma.user.upsert({
    where: { email: "operatore@centro-demo.it" },
    update: { email: "operatore@centro-demo.it" },
    create: {
      email: "operatore@centro-demo.it",
      passwordHash,
      firstName: "Giulia",
      lastName: "Bianchi",
      role: "OPERATOR",
      tenantId: tenant.id,
    },
  });

  const operators = [anna, giulia, marta];

  // ─── Services ─────────────────────────────────────────────────────────────
  const serviceData = [
    { name: "Manicure classica", description: "Manicure con smalto tradizionale", price: 25.0, durationMinutes: 30 },
    { name: "Manicure semipermanente", description: "Smalto semipermanente con UV, dura 3-4 settimane", price: 38.0, durationMinutes: 45 },
    { name: "Pedicure estetica", description: "Pedicure completo con smalto", price: 38.0, durationMinutes: 50 },
    { name: "Pedicure medicale", description: "Trattamento specifico per durezze e callosità", price: 55.0, durationMinutes: 60 },
    { name: "Pulizia viso", description: "Pulizia profonda del viso con vapore e maschere", price: 50.0, durationMinutes: 60 },
    { name: "Trattamento anti-età", description: "Trattamento lifting e rassodante con acido ialuronico", price: 80.0, durationMinutes: 75 },
    { name: "Ceretta gambe", description: "Ceretta completa gambe con cera tiepida", price: 40.0, durationMinutes: 45 },
    { name: "Ceretta ascelle e inguine", description: "Ceretta depilazione parziale", price: 25.0, durationMinutes: 30 },
    { name: "Massaggio rilassante", description: "Massaggio corpo completo 60 min", price: 65.0, durationMinutes: 60 },
    { name: "Massaggio drenante", description: "Massaggio linfodrenante anti-ritenzione", price: 75.0, durationMinutes: 60 },
    { name: "Epilazione laser (gambe)", description: "Epilazione laser permanente gambe", price: 120.0, durationMinutes: 90 },
    { name: "Sopracciglia + Labbro", description: "Ceretta sopracciglia e labbro superiore", price: 18.0, durationMinutes: 20 },
  ];

  const services: Array<{ id: string; name: string; price: { toNumber(): number }; durationMinutes: number }> = [];
  for (const data of serviceData) {
    const existing = await prisma.service.findFirst({ where: { tenantId: tenant.id, name: data.name } });
    if (existing) {
      services.push(existing);
    } else {
      const service = await prisma.service.create({ data: { tenantId: tenant.id, ...data } });
      services.push(service);
    }
  }

  // ─── Products ─────────────────────────────────────────────────────────────
  const productData = [
    { name: "Smalto OPI gel", description: "Smalto gel professionale, 15ml", price: 22.0 },
    { name: "Crema mani rigenerante", description: "Crema nutriente per mani secche, 100ml", price: 18.0 },
    { name: "Olio cuticole", description: "Olio idratante cuticole con vitamina E, 15ml", price: 12.0 },
    { name: "Maschera viso idratante", description: "Maschera monodose per pelle secca", price: 8.0 },
    { name: "Siero anti-età", description: "Siero concentrato con retinolo e collagene, 30ml", price: 65.0 },
    { name: "Crema corpo rassodante", description: "Crema anticellulite con caffeina, 200ml", price: 35.0 },
    { name: "Kit manicure professionale", description: "Lima, bastoncini, tronchesini in custodia", price: 28.0 },
    { name: "Strisce ceretta casa", description: "Kit 20 strisce ceretta ready-to-use", price: 15.0 },
  ];

  const products: Array<{ id: string; name: string }> = [];
  for (const data of productData) {
    const existing = await prisma.product.findFirst({ where: { tenantId: tenant.id, name: data.name } });
    if (existing) {
      products.push(existing);
    } else {
      const product = await prisma.product.create({ data: { tenantId: tenant.id, ...data } });
      products.push(product);
    }
  }

  // ─── Clients ─────────────────────────────────────────────────────────────
  console.log("Creating clients...");
  const createdClients: Array<{ id: string; firstName: string; lastName: string; phone: string; isVip: boolean }> = [];

  // VIP clients (first 5)
  const vipPhones = [CLIENTS[0].phone, CLIENTS[1].phone, CLIENTS[2].phone, CLIENTS[11].phone, CLIENTS[19].phone];

  for (const clientData of CLIENTS) {
    const existing = await prisma.client.findFirst({
      where: { tenantId: tenant.id, phone: clientData.phone },
    });
    const isVip = vipPhones.includes(clientData.phone);
    const preferredOperatorId = randomFrom(operators).id;

    if (existing) {
      const updated = await prisma.client.update({
        where: { id: existing.id },
        data: { isVip, preferredOperatorId },
      });
      createdClients.push({ id: updated.id, firstName: updated.firstName, lastName: updated.lastName, phone: updated.phone, isVip: updated.isVip });
    } else {
      const client = await prisma.client.create({
        data: {
          tenantId: tenant.id,
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          phone: clientData.phone,
          email: clientData.email,
          isVip,
          preferredOperatorId,
          notes: isVip ? "Cliente VIP — trattamento prioritario." : undefined,
        },
      });
      createdClients.push({ id: client.id, firstName: client.firstName, lastName: client.lastName, phone: client.phone, isVip: client.isVip });
    }
  }

  // ─── Appointments ─────────────────────────────────────────────────────────
  console.log("Creating appointments...");

  // Delete existing appointments for clean seed
  await prisma.payment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.productSale.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.appointment.deleteMany({ where: { tenantId: tenant.id } });

  type CreatedAppointment = {
    id: string;
    clientId: string;
    serviceId: string;
    price: { toNumber(): number } | null;
    status: string;
    startTime: Date;
    operatorId: string | null;
  };

  const allAppointments: CreatedAppointment[] = [];

  // Active clients: appointments in last 90 days (indices 0-34)
  const activeClients = createdClients.slice(0, 35);
  // Inactive clients: last appointment 100-200 days ago (indices 35-49)
  const inactiveClients = createdClients.slice(35);

  const paymentMethods: Array<"CASH" | "CARD" | "TRANSFER" | "OTHER"> = ["CASH", "CARD", "CARD", "CARD", "CASH", "TRANSFER"];

  // Generate past appointments for active clients
  for (const client of activeClients) {
    const appointmentCount = Math.floor(Math.random() * 8) + 2; // 2-9 past appointments

    for (let i = 0; i < appointmentCount; i++) {
      const daysBack = Math.floor(Math.random() * 85) + 2;
      const service = randomFrom(services);
      const operator = randomFrom(operators);
      const startDate = daysAgo(daysBack);
      const startTime = atTime(startDate, 9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 30 : 0);
      const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

      const statusRoll = Math.random();
      const status =
        statusRoll < 0.75 ? "COMPLETED" :
        statusRoll < 0.85 ? "CANCELLED" :
        statusRoll < 0.92 ? "NO_SHOW" :
        "CONFIRMED";

      const reminderRoll = Math.random();
      const reminderStatus =
        status === "CANCELLED" ? "NONE" :
        reminderRoll < 0.7 ? "SENT" :
        reminderRoll < 0.85 ? "SCHEDULED" :
        "NONE";

      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          serviceId: service.id,
          operatorId: operator.id,
          startTime,
          endTime,
          status: status as "COMPLETED" | "CANCELLED" | "NO_SHOW" | "CONFIRMED" | "BOOKED",
          price: service.price.toNumber(),
          reminderStatus: reminderStatus as "SENT" | "SCHEDULED" | "NONE" | "FAILED",
          reminderSentAt: reminderStatus === "SENT" ? new Date(startTime.getTime() - 24 * 60 * 60 * 1000) : null,
          notes: Math.random() > 0.7 ? randomFrom(["Cliente sensibile, usare prodotti ipoallergenici.", "Preferisce musica rilassante.", "Allergia al nichel.", "Vuole messaggio di conferma 1h prima."]) : null,
        },
      });

      allAppointments.push({ ...appointment, price: appointment.price ? { toNumber: () => appointment.price!.toNumber() } : null });

      // Create payment for completed appointments
      if (status === "COMPLETED") {
        const method = randomFrom(paymentMethods);
        await prisma.payment.create({
          data: {
            tenantId: tenant.id,
            clientId: client.id,
            appointmentId: appointment.id,
            amount: service.price.toNumber(),
            method,
            paidAt: new Date(endTime.getTime() + 5 * 60000),
          },
        });
      }
    }
  }

  // Generate past appointments for inactive clients (all old)
  for (const client of inactiveClients) {
    const appointmentCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < appointmentCount; i++) {
      const daysBack = Math.floor(Math.random() * 100) + 100; // 100-200 days ago
      const service = randomFrom(services);
      const operator = randomFrom(operators);
      const startDate = daysAgo(daysBack);
      const startTime = atTime(startDate, 9 + Math.floor(Math.random() * 9), Math.random() > 0.5 ? 30 : 0);
      const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          serviceId: service.id,
          operatorId: operator.id,
          startTime,
          endTime,
          status: "COMPLETED",
          price: service.price.toNumber(),
          reminderStatus: "SENT",
          reminderSentAt: new Date(startTime.getTime() - 24 * 60 * 60 * 1000),
        },
      });

      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          appointmentId: appointment.id,
          amount: service.price.toNumber(),
          method: randomFrom(paymentMethods),
          paidAt: new Date(endTime.getTime() + 5 * 60000),
        },
      });
    }
  }

  // Future appointments (next 14 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureSlots = [
    { daysAhead: 0, hours: [10, 11, 14, 15, 16] },
    { daysAhead: 1, hours: [9, 10, 11, 14, 15, 16, 17] },
    { daysAhead: 2, hours: [9, 10, 11, 14, 15] },
    { daysAhead: 3, hours: [10, 11, 14, 16] },
    { daysAhead: 4, hours: [9, 10, 14, 15, 16, 17] },
    { daysAhead: 7, hours: [9, 10, 11, 14, 15, 16] },
    { daysAhead: 8, hours: [10, 11, 14, 15] },
    { daysAhead: 9, hours: [9, 10, 14, 15, 16] },
    { daysAhead: 10, hours: [10, 11, 14, 15] },
    { daysAhead: 11, hours: [9, 10, 11, 14] },
    { daysAhead: 14, hours: [10, 14, 15, 16] },
  ];

  const usedActiveClients = [...activeClients];
  for (const slot of futureSlots) {
    for (const hour of slot.hours) {
      if (usedActiveClients.length === 0) break;
      const client = usedActiveClients.splice(Math.floor(Math.random() * usedActiveClients.length), 1)[0] ?? activeClients[Math.floor(Math.random() * activeClients.length)];
      const service = randomFrom(services);
      const operator = randomFrom(operators);
      const startDate = daysFromNow(slot.daysAhead);
      const startTime = atTime(startDate, hour, Math.random() > 0.5 ? 30 : 0);
      const endTime = new Date(startTime.getTime() + service.durationMinutes * 60000);

      const statusRoll = Math.random();
      const status = statusRoll < 0.7 ? "BOOKED" : "CONFIRMED";

      const appointment = await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          serviceId: service.id,
          operatorId: operator.id,
          startTime,
          endTime,
          status: status as "BOOKED" | "CONFIRMED",
          price: service.price.toNumber(),
          reminderStatus: slot.daysAhead <= 1 ? "SCHEDULED" : "NONE",
        },
      });

      allAppointments.push({ ...appointment, price: appointment.price ? { toNumber: () => appointment.price!.toNumber() } : null });
    }
    if (usedActiveClients.length === 0) {
      usedActiveClients.push(...activeClients);
    }
  }

  // ─── Product Sales ─────────────────────────────────────────────────────────
  console.log("Creating product sales...");
  // Randomly assign some product sales to active clients
  for (let i = 0; i < 40; i++) {
    const client = randomFrom(activeClients);
    const product = randomFrom(products);
    const daysBack = Math.floor(Math.random() * 80) + 1;
    await prisma.productSale.create({
      data: {
        tenantId: tenant.id,
        clientId: client.id,
        productId: product.id,
        quantity: Math.random() > 0.8 ? 2 : 1,
        unitPrice: parseFloat((product as { price?: number }).price?.toFixed(2) ?? "20"),
        soldAt: daysAgo(daysBack),
      },
    }).catch(() => {/* ignore if product price has wrong type */});
  }

  // ─── Consents ─────────────────────────────────────────────────────────────
  console.log("Creating consents...");
  await prisma.consent.deleteMany({ where: { tenantId: tenant.id } });

  const consentTypes: Array<"PRIVACY" | "MARKETING" | "DATA_PROCESSING" | "TREATMENT_SPECIFIC"> = [
    "PRIVACY", "MARKETING", "DATA_PROCESSING", "TREATMENT_SPECIFIC"
  ];

  for (const client of createdClients) {
    for (const type of consentTypes) {
      const roll = Math.random();
      const status =
        roll < 0.60 ? "GIVEN" :
        roll < 0.75 ? "PENDING" :
        "REFUSED";

      await prisma.consent.create({
        data: {
          tenantId: tenant.id,
          clientId: client.id,
          type,
          status: status as "GIVEN" | "PENDING" | "REFUSED",
          signedAt: status === "GIVEN" ? daysAgo(Math.floor(Math.random() * 180) + 1) : null,
          content: type === "PRIVACY"
            ? "Consenso al trattamento dei dati personali ai sensi del GDPR 679/2016."
            : type === "MARKETING"
            ? "Consenso all'invio di comunicazioni commerciali e promozionali."
            : type === "DATA_PROCESSING"
            ? "Consenso al trattamento dei dati per finalità operative del centro."
            : "Liberatoria per trattamento estetico specifico.",
        },
      });
    }
  }

  // ─── Booking Requests ─────────────────────────────────────────────────────
  console.log("Creating booking requests...");
  await prisma.bookingRequest.deleteMany({ where: { tenantId: tenant.id } });

  const pendingRequests = [
    { firstName: "Chiara", lastName: "Marini", phone: "+39 349 9988776", email: "chiara.marini@gmail.com", preferredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), preferredTime: "14:00", notes: "Vorrei fare la manicure semipermanente per la prima volta." },
    { firstName: "Valeria", lastName: "De Angelis", phone: "+39 338 7766554", preferredDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), preferredTime: "10:30", notes: null },
    { firstName: "Jessica", lastName: "Colombo", phone: "+39 333 5544332", email: "jessica.c@hotmail.it", preferredDate: new Date(Date.now() + 1 * 86400000).toISOString().slice(0, 10), preferredTime: "15:00", notes: "Sono incinta, è possibile fare ceretta?" },
    { firstName: "Eleonora", lastName: "Farina", phone: "+39 347 1122334", preferredDate: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10), preferredTime: "11:00", notes: null },
    { firstName: "Camilla", lastName: "Natale", phone: "+39 345 9988001", email: "camilla.natale@gmail.com", preferredDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), preferredTime: "16:00", notes: "Prima visita, vorrei un trattamento anti-età." },
  ];

  for (const req of pendingRequests) {
    const service = randomFrom(services.slice(0, 8));
    await prisma.bookingRequest.create({
      data: {
        tenantId: tenant.id,
        serviceId: service.id,
        ...req,
        status: "PENDING",
      },
    });
  }

  console.log("✅ Seed completato!");
  console.log({
    tenant: tenant.slug,
    staff: ["Anna Rossi (admin)", "Giulia Bianchi (operator)", "Marta Ferrari (operator)"],
    clients: createdClients.length,
    services: services.length,
    products: products.length,
    bookingRequests: pendingRequests.length,
  });
  console.log("\n🔑 Credenziali di accesso:");
  console.log("  Super Admin: superadmin@fusion-beauty.dev / Password123!");
  console.log("  Admin centro: admin@centro-demo.it / Password123!");
  console.log("  Operatrice: giulia@centro-demo.it / Password123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
