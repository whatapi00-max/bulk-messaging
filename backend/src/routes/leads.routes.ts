import { Router } from "express";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { db } from "../db";
import { leads } from "../db/schema";

export const leadsRouter = Router();

leadsRouter.use(requireAuth);

const leadSchema = z.object({
  phoneNumber: z.string().min(5),
  name: z.string().optional(),
  email: z.string().email().optional(),
  countryCode: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  source: z.string().optional(),
  funnelStage: z.string().optional(),
});

const updateLeadSchema = leadSchema.partial();

const bulkLeadSchema = z.object({
  leads: z.array(leadSchema).min(1),
});

leadsRouter.get("/", async (req, res, next) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const rows = await db
      .select()
      .from(leads)
      .where(
        search
          ? and(eq(leads.userId, req.user!.userId), ilike(leads.phoneNumber, `%${search}%`))
          : eq(leads.userId, req.user!.userId)
      )
      .orderBy(desc(leads.createdAt));

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/", validateBody(leadSchema), async (req, res, next) => {
  try {
    const [lead] = await db
      .insert(leads)
      .values({
        userId: req.user!.userId,
        ...req.body,
      })
      .onConflictDoNothing()
      .returning();

    res.status(201).json({ data: lead });
  } catch (error) {
    next(error);
  }
});

leadsRouter.post("/bulk", validateBody(bulkLeadSchema), async (req, res, next) => {
  try {
    const payload = req.body.leads.map((lead: Record<string, unknown>) => ({ ...lead, userId: req.user!.userId }));
    const inserted = await db.insert(leads).values(payload).onConflictDoNothing().returning();
    res.status(201).json({ data: inserted, count: inserted.length });
  } catch (error) {
    next(error);
  }
});

leadsRouter.patch("/:id", validateBody(updateLeadSchema), async (req, res, next) => {
  try {
    const [updated] = await db
      .update(leads)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(leads.id, req.params.id), eq(leads.userId, req.user!.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

leadsRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await db
      .delete(leads)
      .where(and(eq(leads.id, req.params.id), eq(leads.userId, req.user!.userId)))
      .returning({ id: leads.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    res.json({ data: { id: deleted[0].id } });
  } catch (error) {
    next(error);
  }
});
