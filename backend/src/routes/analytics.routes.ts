import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware";
import { getDashboardAnalytics } from "../services/analytics.service";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get("/dashboard", async (req, res, next) => {
  try {
    const data = await getDashboardAnalytics(req.user!.userId);
    res.json(data);
  } catch (error) {
    next(error);
  }
});
