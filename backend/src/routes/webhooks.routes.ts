import { Router } from "express";
import { config } from "../config";
import { processMetaWebhook } from "../services/webhook.service";
import { verifyWebhookSignature } from "../services/whatsapp.service";

export const webhooksRouter = Router();

webhooksRouter.get("/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.META_VERIFY_TOKEN) {
    res.status(200).send(String(challenge ?? "ok"));
    return;
  }

  res.status(403).json({ error: "Verification failed" });
});

webhooksRouter.post("/meta", async (req, res, next) => {
  try {
    const signature = req.headers["x-hub-signature-256"];
    if (
      typeof signature === "string" &&
      config.META_APP_SECRET &&
      req.rawBody &&
      !verifyWebhookSignature(req.rawBody, signature, config.META_APP_SECRET)
    ) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    await processMetaWebhook(req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});
