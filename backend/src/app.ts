import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { config } from "./config";
import { logger } from "./utils/logger";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware";
import { healthRouter } from "./routes/health.routes";
import { authRouter } from "./routes/auth.routes";
import { numbersRouter } from "./routes/numbers.routes";
import { leadsRouter } from "./routes/leads.routes";
import { campaignsRouter } from "./routes/campaigns.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { conversationsRouter } from "./routes/conversations.routes";
import { webhooksRouter } from "./routes/webhooks.routes";
import { templatesRouter } from "./routes/templates.routes";
import { mediaRouter } from "./routes/media.routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: [config.FRONTEND_URL, "http://localhost:8000", "http://localhost:3000"],
      credentials: true,
    })
  );
  app.use(helmet());
  app.use(morgan("combined", { stream: { write: (message) => logger.info(message.trim()) } }));
  app.use(rateLimit({ windowMs: 60_000, max: 300 }));
  app.use(express.json({ limit: "5mb", verify: (req, _res, buf) => {
    (req as express.Request).rawBody = buf;
  }}));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded media files publicly
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  app.use("/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/numbers", numbersRouter);
  app.use("/api/leads", leadsRouter);
  app.use("/api/templates", templatesRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/conversations", conversationsRouter);
  app.use("/api/webhooks", webhooksRouter);
  app.use("/api/media", mediaRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
