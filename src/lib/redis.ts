import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisConnection() {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is not set");
  }

  return new Redis(url, {
    maxRetriesPerRequest: null,
  });
}

export const redis = globalForRedis.redis ?? createRedisConnection();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
