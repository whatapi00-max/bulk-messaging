import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth.middleware";
import { validateBody } from "../middlewares/validate.middleware";
import {
  getConversationThread,
  listConversations,
  sendConversationReply,
} from "../services/conversation.service";

export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

const replySchema = z.object({
  content: z.string().min(1).max(2000),
});

conversationsRouter.get("/", async (req, res, next) => {
  try {
    const data = await listConversations(req.user!.userId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

conversationsRouter.get("/:id", async (req, res, next) => {
  try {
    const data = await getConversationThread(req.user!.userId, req.params.id);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

conversationsRouter.post("/:id/reply", validateBody(replySchema), async (req, res, next) => {
  try {
    const data = await sendConversationReply(req.user!.userId, req.params.id, req.body.content);
    res.json(data);
  } catch (error) {
    next(error);
  }
});
