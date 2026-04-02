import "dotenv/config";
import http from "http";
import { createApp } from "./app";
import { config } from "./config";
import { ensureOwnerAccount } from "./services/auth.service";
import { initSocket } from "./socket";
import { logger } from "./utils/logger";
import { startQueueInfrastructure } from "./queues";

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);
  const io = initSocket(server);

  await ensureOwnerAccount();
  await startQueueInfrastructure(io);

  server.listen(Number(config.PORT), () => {
    logger.info(`Backend listening on port ${config.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error("Failed to bootstrap application", { error });
  process.exit(1);
});
