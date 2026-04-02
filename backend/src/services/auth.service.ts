import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { config } from "../config";
import { db } from "../db";
import { users } from "../db/schema";
import { HttpError } from "../middlewares/error.middleware";

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  companyName?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

function signTokens(user: { id: string; email: string }) {
  const accessToken = jwt.sign({ userId: user.id, email: user.email }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN as unknown as number,
  });

  const refreshToken = jwt.sign({ userId: user.id, email: user.email }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as unknown as number,
  });

  return { accessToken, refreshToken };
}

export async function registerUser(input: RegisterInput) {
  void input;
  throw new HttpError(403, "Registration is disabled for this workspace");
}

export async function loginUser(input: LoginInput) {
  if (input.email !== config.OWNER_EMAIL) {
    throw new HttpError(401, "Invalid credentials");
  }

  const found = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  const user = found[0];

  if (!user) {
    throw new HttpError(401, "Invalid credentials");
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordValid) {
    throw new HttpError(401, "Invalid credentials");
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      companyName: user.companyName,
      subscriptionStatus: user.subscriptionStatus,
      onboardingCompleted: user.onboardingCompleted,
    },
    ...signTokens(user),
  };
}

export async function ensureOwnerAccount() {
  const passwordHash = await bcrypt.hash(config.OWNER_PASSWORD, 12);
  const existing = await db.select().from(users).where(eq(users.email, config.OWNER_EMAIL)).limit(1);
  const owner = existing[0];

  if (!owner) {
    await db.insert(users).values({
      email: config.OWNER_EMAIL,
      passwordHash,
      fullName: config.OWNER_FULL_NAME,
      subscriptionStatus: "active",
      subscriptionPlan: "owner",
      isActive: true,
      onboardingCompleted: true,
    });
    return;
  }

  await db
    .update(users)
    .set({
      passwordHash,
      fullName: config.OWNER_FULL_NAME,
      isActive: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, owner.id));
}

export async function getUserById(userId: string) {
  const found = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return found[0] ?? null;
}
