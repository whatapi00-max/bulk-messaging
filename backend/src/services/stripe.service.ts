import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { config } from "../config";
import { db } from "../db";
import { subscriptions, users } from "../db/schema";

export const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10",
});

export async function createOnboardingCheckoutSession(userId: string, email: string) {
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: email,
    success_url: `${config.FRONTEND_URL}/billing?success=1`,
    cancel_url: `${config.FRONTEND_URL}/billing?canceled=1`,
    line_items: [
      { price: config.STRIPE_SETUP_PRICE_ID, quantity: 1 },
      { price: config.STRIPE_MONTHLY_PRICE_ID, quantity: 1 },
    ],
    metadata: { userId },
    allow_promotion_codes: true,
  });

  return session;
}

export async function handleStripeWebhook(rawBody: Buffer, signature: string) {
  const event = stripe.webhooks.constructEvent(rawBody, signature, config.STRIPE_WEBHOOK_SECRET);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      await db
        .update(users)
        .set({
          stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
          subscriptionStatus: "active",
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === "string" ? subscription.customer : "";

    const foundUsers = await db.select().from(users).where(eq(users.stripeCustomerId, customerId)).limit(1);
    const user = foundUsers[0];

    if (user) {
      const existing = await db
        .select()
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.stripeSubscriptionId, subscription.id)))
        .limit(1);

      if (existing[0]) {
        await db
          .update(subscriptions)
          .set({
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existing[0].id));
      } else {
        await db.insert(subscriptions).values({
          userId: user.id,
          stripeSubscriptionId: subscription.id,
          plan: "starter",
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          setupFeePaid: true,
          amount: "29.00",
        });
      }
    }
  }

  return { received: true };
}
