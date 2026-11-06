import { Queue, Worker } from "bullmq";

import { redis } from "@/lib/redis";
import { runScheduledAutomations } from "@/lib/whatsapp";
import { EXAMPLE_QUEUE_NAME, type ExampleJobData } from "@/queues/example.queue";

const worker = new Worker<ExampleJobData>(
  EXAMPLE_QUEUE_NAME,
  async (job) => {
    console.log(`[worker] processing job ${job.id}: ${job.data.message}`);
  },
  { connection: redis }
);

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err);
});

console.log(`[worker] listening on queue "${EXAMPLE_QUEUE_NAME}"`);

// Messaggi WhatsApp programmati (promemoria del giorno prima, compleanni):
// un giro ogni 15 minuti; i doppi invii sono esclusi dalla dedupeKey.
const WHATSAPP_SCHEDULE_QUEUE = "whatsapp-schedule";
const scheduleQueue = new Queue(WHATSAPP_SCHEDULE_QUEUE, { connection: redis });
const scheduleWorker = new Worker(
  WHATSAPP_SCHEDULE_QUEUE,
  async () => {
    await runScheduledAutomations();
  },
  { connection: redis }
);

scheduleWorker.on("failed", (job, err) => {
  console.error(`[worker] giro WhatsApp programmato non riuscito:`, err);
});

void scheduleQueue.upsertJobScheduler("whatsapp-every-15-min", { every: 15 * 60 * 1000 }, { name: "run" });

async function shutdown() {
  console.log("[worker] shutting down...");
  await Promise.all([worker.close(), scheduleWorker.close(), scheduleQueue.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
