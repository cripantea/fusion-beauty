import { Queue } from "bullmq";

import { redis } from "@/lib/redis";

export const EXAMPLE_QUEUE_NAME = "example";

export type ExampleJobData = {
  message: string;
};

export const exampleQueue = new Queue<ExampleJobData>(EXAMPLE_QUEUE_NAME, {
  connection: redis,
});
