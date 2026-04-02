import Redis from "ioredis";
import { config } from "./index";
import { logger } from "../utils/logger";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      tls: config.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("connect", () => logger.info("Redis connected"));
    redisClient.on("error", (err) => logger.error("Redis error", { error: err.message }));
    redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));
  }
  return redisClient;
}

export function createRedisConnection(): Redis {
  return new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: config.REDIS_URL.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
  });
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
