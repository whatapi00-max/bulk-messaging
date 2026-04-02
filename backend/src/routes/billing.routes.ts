import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middlewares/auth.middleware";
import { createOnboardingCheckoutSession, handleStripeWebhook } from "../services/stripe.service";
import { getUserById } from "../services/auth.service";
import { HttpError } from "../middlewares/error.middleware";

export const billingRouter = Router();

billingRouter.post("/checkout-session", requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const session = await createOnboardingCheckoutSession(user.id, user.email);
    res.json({ url: session.url, id: session.id });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      next(new HttpError(503, "Billing is not configured. Please contact support."));
      return;
    }
    next(error);
  }
});

billingRouter.post("/stripe/webhook", async (req, res, next) => {
  try {
    const signature = req.headers["stripe-signature"];
    if (typeof signature !== "string" || !req.rawBody) {
      res.status(400).json({ error: "Missing Stripe signature" });
      return;
    }

    const result = await handleStripeWebhook(req.rawBody, signature);
    res.json(result);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
      next(new HttpError(400, "Invalid Stripe webhook signature"));
      return;
    }
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      next(new HttpError(503, "Billing is not configured."));
      return;
    }
    next(error);
  }
});
