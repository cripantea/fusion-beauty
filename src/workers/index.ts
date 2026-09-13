import { Worker } from "bullmq";

import { redis } from "@/lib/redis";
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

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
