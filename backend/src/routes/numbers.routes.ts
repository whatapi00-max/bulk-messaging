import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { db } from "../db";
import { whatsappNumbers } from "../db/schema";
import { encrypt, decrypt } from "../utils/crypto";
import { sendWhatsAppMessage, verifyMetaCredentials } from "../services/whatsapp.service";

export const numbersRouter = Router();

numbersRouter.use(requireAuth);

const createNumberSchema = z.object({
  phoneNumberId: z.string().min(3),
  accessToken: z.string().min(10),
  wabaId: z.string().optional(),
  apiProvider: z.string().default("meta"),
  apiBaseUrl: z.string().url().optional(),
  dailyLimit: z.number().int().positive().max(100000).default(1000),
});

const updateNumberSchema = z.object({
  displayName: z.string().min(2).optional(),
  dailyLimit: z.number().int().positive().max(100000).optional(),
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  pauseReason: z.string().optional(),
});

const testSchema = z.object({
  to: z.string().min(5),
  text: z.string().min(1).max(1000),
});

numbersRouter.get("/", async (req, res, next) => {
  try {
    const rows = await db
      .select({
        id: whatsappNumbers.id,
        displayName: whatsappNumbers.displayName,
        phoneNumber: whatsappNumbers.phoneNumber,
        phoneNumberId: whatsappNumbers.phoneNumberId,
        wabaId: whatsappNumbers.wabaId,
        apiProvider: whatsappNumbers.apiProvider,
        dailyLimit: whatsappNumbers.dailyLimit,
        messagesSentToday: whatsappNumbers.messagesSentToday,
        healthScore: whatsappNumbers.healthScore,
        isActive: whatsappNumbers.isActive,
        isPaused: whatsappNumbers.isPaused,
        pauseReason: whatsappNumbers.pauseReason,
        lastMessageAt: whatsappNumbers.lastMessageAt,
        errorCount: whatsappNumbers.errorCount,
        successCount: whatsappNumbers.successCount,
        createdAt: whatsappNumbers.createdAt,
      })
      .from(whatsappNumbers)
      .where(eq(whatsappNumbers.userId, req.user!.userId))
      .orderBy(desc(whatsappNumbers.createdAt));

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

numbersRouter.post("/", validateBody(createNumberSchema), async (req, res, next) => {
  try {
    // Verify credentials against Meta Cloud API before saving
    const verification = await verifyMetaCredentials(
      req.body.phoneNumberId,
      req.body.accessToken
    );

    if (!verification.valid) {
      res.status(422).json({ error: verification.errorMessage ?? "Invalid Phone Number ID or Access Token." });
      return;
    }

    // Use the real phone number and business name returned by Meta
    const displayName = verification.verifiedName ?? req.body.phoneNumberId;
    const phoneNumber = verification.displayPhoneNumber ?? req.body.phoneNumberId;

    const [number] = await db
      .insert(whatsappNumbers)
      .values({
        userId: req.user!.userId,
        displayName,
        phoneNumber,
        phoneNumberId: req.body.phoneNumberId,
        accessTokenEncrypted: encrypt(req.body.accessToken),
        wabaId: req.body.wabaId,
        apiProvider: req.body.apiProvider,
        apiBaseUrl: req.body.apiBaseUrl,
        dailyLimit: req.body.dailyLimit,
      })
      .returning();

    res.status(201).json({
      data: {
        ...number,
        verifiedName: verification.verifiedName,
        displayPhoneNumber: verification.displayPhoneNumber,
      },
    });
  } catch (error) {
    next(error);
  }
});

numbersRouter.patch("/:id", validateBody(updateNumberSchema), async (req, res, next) => {
  try {
    const [updated] = await db
      .update(whatsappNumbers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(whatsappNumbers.id, req.params.id), eq(whatsappNumbers.userId, req.user!.userId)))
      .returning();

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

numbersRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await db
      .delete(whatsappNumbers)
      .where(and(eq(whatsappNumbers.id, req.params.id), eq(whatsappNumbers.userId, req.user!.userId)))
      .returning({ id: whatsappNumbers.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Number not found" });
      return;
    }

    res.json({ data: { id: deleted[0].id } });
  } catch (error) {
    next(error);
  }
});

numbersRouter.post("/:id/test", validateBody(testSchema), async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(whatsappNumbers)
      .where(and(eq(whatsappNumbers.id, req.params.id), eq(whatsappNumbers.userId, req.user!.userId)))
      .limit(1);

    const number = rows[0];
    if (!number) {
      res.status(404).json({ error: "Number not found" });
      return;
    }

    const result = await sendWhatsAppMessage({
      phoneNumberId: number.phoneNumberId,
      accessToken: decrypt(number.accessTokenEncrypted),
      apiProvider: number.apiProvider ?? "meta",
      apiBaseUrl: number.apiBaseUrl ?? undefined,
      to: req.body.to,
      messageText: req.body.text,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});
