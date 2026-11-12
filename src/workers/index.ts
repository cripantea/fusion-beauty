import { Queue, Worker } from "bullmq";

import { redis } from "@/lib/redis";
import { processWaitingRuns, runAutomationScans } from "@/lib/automation-engine";
import { runDueCampaigns } from "@/lib/campaign-runner";
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

// Automazioni e campagne: un giro al minuto riprende le attese scadute e invia
// lo scaglione dovuto delle campagne; ogni 15 minuti si cercano i trigger a
// tempo (prima/dopo l'appuntamento, compleanni, clienti inattive). I doppi
// invii sono esclusi dalle chiavi univoche (triggerKey, dedupeKey).
const WHATSAPP_SCHEDULE_QUEUE = "whatsapp-schedule";
const scheduleQueue = new Queue(WHATSAPP_SCHEDULE_QUEUE, { connection: redis });
const scheduleWorker = new Worker(
  WHATSAPP_SCHEDULE_QUEUE,
  async (job) => {
    if (job.name === "scan") {
      await runAutomationScans();
      return;
    }
    await processWaitingRuns();
    await runDueCampaigns();
  },
  { connection: redis }
);

scheduleWorker.on("failed", (job, err) => {
  console.error(`[worker] giro programmato "${job?.name}" non riuscito:`, err);
});

// Il vecchio giro unico ogni 15 minuti non serve più.
void scheduleQueue.removeJobScheduler("whatsapp-every-15-min");
void scheduleQueue.upsertJobScheduler("automations-every-minute", { every: 60 * 1000 }, { name: "tick" });
void scheduleQueue.upsertJobScheduler("automations-scan-15-min", { every: 15 * 60 * 1000 }, { name: "scan" });

async function shutdown() {
  console.log("[worker] shutting down...");
  await Promise.all([worker.close(), scheduleWorker.close(), scheduleQueue.close()]);
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
