import winston from "winston";
import { config } from "../config";

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const logLevel = config.NODE_ENV === "production" ? "info" : "debug";

export const logger = winston.createLogger({
  level: logLevel,
  format: combine(
    errors({ stack: true }),
    timestamp(),
    config.NODE_ENV === "production" ? json() : combine(colorize(), simple())
  ),
  defaultMeta: { service: "wacrm-backend" },
  transports: [
    new winston.transports.Console(),
    ...(config.NODE_ENV === "production"
      ? [
          new winston.transports.File({ filename: "logs/error.log", level: "error" }),
          new winston.transports.File({ filename: "logs/combined.log" }),
        ]
      : []),
  ],
});
