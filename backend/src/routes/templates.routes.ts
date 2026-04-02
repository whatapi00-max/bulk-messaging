import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import { db } from "../db";
import { templates } from "../db/schema";

export const templatesRouter = Router();

templatesRouter.use(requireAuth);

const templateSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  language: z.string().default("en"),
  headerType: z.string().optional(),
  headerContent: z.string().optional(),
  bodyText: z.string().min(1),
  footerText: z.string().optional(),
  buttons: z.array(z.any()).optional(),
  variables: z.record(z.any()).optional(),
  isRandomizationEnabled: z.boolean().optional(),
  variations: z.array(z.string()).optional(),
  metaTemplateName: z.string().optional(),
});

const updateTemplateSchema = templateSchema.partial();

templatesRouter.get("/", async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(templates)
      .where(eq(templates.userId, req.user!.userId))
      .orderBy(desc(templates.createdAt));

    res.json({ data: rows });
  } catch (error) {
    next(error);
  }
});

templatesRouter.post("/", validateBody(templateSchema), async (req, res, next) => {
  try {
    const [template] = await db
      .insert(templates)
      .values({
        userId: req.user!.userId,
        ...req.body,
        status: "draft",
      })
      .returning();

    res.status(201).json({ data: template });
  } catch (error) {
    next(error);
  }
});

templatesRouter.patch("/:id", validateBody(updateTemplateSchema), async (req, res, next) => {
  try {
    const [updated] = await db
      .update(templates)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(templates.id, req.params.id), eq(templates.userId, req.user!.userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

templatesRouter.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await db
      .delete(templates)
      .where(and(eq(templates.id, req.params.id), eq(templates.userId, req.user!.userId)))
      .returning({ id: templates.id });

    if (!deleted.length) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.json({ data: { id: deleted[0].id } });
  } catch (error) {
    next(error);
  }
});
