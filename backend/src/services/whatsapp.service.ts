import crypto from "crypto";
import axios from "axios";
import { config } from "../config";
import { decrypt } from "../utils/crypto";
import { logger } from "../utils/logger";
import type {
  MetaTextMessage,
  MetaTemplateMessage,
  MetaApiResponse,
  MetaApiError,
} from "../types";

export interface SendMessageOptions {
  phoneNumberId: string;
  accessToken: string;
  apiProvider: string;
  apiBaseUrl?: string;
  to: string;
  messageText?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  headerImageUrl?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  shouldRetry: boolean;
  isPermanentFailure: boolean;
}

export interface VerifyCredentialsResult {
  valid: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  errorMessage?: string;
}

/**
 * Validates a Phone Number ID + Access Token against the real Meta Cloud API.
 * Calls GET /{phoneNumberId}?fields=display_phone_number,verified_name
 */
export async function verifyMetaCredentials(
  phoneNumberId: string,
  accessToken: string
): Promise<VerifyCredentialsResult> {
  const url = `${config.META_GRAPH_URL}/${config.META_API_VERSION}/${phoneNumberId}`;
  try {
    const resp = await axios.get(url, {
      params: { fields: "display_phone_number,verified_name", access_token: accessToken },
      timeout: 10_000,
    });
    const data = resp.data as { display_phone_number?: string; verified_name?: string };
    return {
      valid: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
    };
  } catch (err: unknown) {
    const metaError = (err as { response?: { data?: { error?: { message?: string; code?: number } } } })
      ?.response?.data?.error;
    if (metaError) {
      return { valid: false, errorMessage: `Meta API: ${metaError.message}` };
    }
    return { valid: false, errorMessage: "Could not reach Meta API. Check your internet connection." };
  }
}

// Error codes that should NOT be retried (permanent failures)
const PERMANENT_FAILURE_CODES = new Set([
  131026, // Recipient phone number not in allowed list
  131047, // Re-engagement message failure
  131051, // Unsupported message type
  131052, // Media download error
  130429, // Rate limit hit (wait before retry)
  131000, // Generic user error
  368,    // Message failed to send — blocked
  470,    // Failed to send template
]);

// Codes indicating the number is rate-limited or banned
const PAUSE_TRIGGER_CODES = new Set([130429, 130472, 130473]);

const BANNED_NUMBER_CODES = new Set([130472, 130473]);

export function isBannedMetaCode(code?: string): boolean {
  if (!code) return false;
  const asNumber = Number(code);
  return Number.isFinite(asNumber) && BANNED_NUMBER_CODES.has(asNumber);
}

/**
 * Sends a WhatsApp message via Meta Cloud API or compatible providers.
 */
export async function sendWhatsAppMessage(
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const { phoneNumberId, accessToken, apiProvider, apiBaseUrl, to } = options;

  const baseUrl =
    apiProvider === "meta"
      ? `${config.META_GRAPH_URL}/${config.META_API_VERSION}`
      : apiBaseUrl ?? config.META_GRAPH_URL;

  const url = `${baseUrl}/${phoneNumberId}/messages`;

  let payload: MetaTextMessage | MetaTemplateMessage;

  if (options.templateName) {
    const components = buildTemplateComponents(options.templateVariables ?? {}, options.headerImageUrl) ?? [];
    payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: options.templateName,
        language: { code: options.templateLanguage ?? "en" },
        ...(components.length > 0 ? { components } as unknown as object : {}),
      },
    };
  } else {
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: options.messageText ?? "" },
    };
  }

  try {
    const response = await axios.post<MetaApiResponse>(url, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    const messageId = response.data.messages?.[0]?.id;
    logger.debug("WhatsApp message sent", { to, messageId, phoneNumberId });

    return { success: true, messageId, shouldRetry: false, isPermanentFailure: false };
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response) {
      const apiErr = (err.response.data as MetaApiError);
      const code = apiErr?.error?.code ?? 0;
      const message = apiErr?.error?.message ?? "Unknown error";

      logger.warn("WhatsApp API error", { to, code, message, phoneNumberId });

      return {
        success: false,
        errorCode: String(code),
        errorMessage: message,
        shouldRetry: !PERMANENT_FAILURE_CODES.has(code),
        isPermanentFailure: PAUSE_TRIGGER_CODES.has(code),
      };
    }

    const errMsg = err instanceof Error ? err.message : "Network error";
    return {
      success: false,
      errorMessage: errMsg,
      shouldRetry: true,
      isPermanentFailure: false,
    };
  }
}

function buildTemplateComponents(
  variables: Record<string, string>,
  headerImageUrl?: string
): MetaTemplateMessage["template"]["components"] {
  const components: MetaTemplateMessage["template"]["components"] = [];

  if (headerImageUrl) {
    components.push({
      type: "header",
      parameters: [{ type: "image", image: { link: headerImageUrl } }],
    });
  }

  const entries = Object.values(variables);
  if (entries.length > 0) {
    components.push({
      type: "body",
      parameters: entries.map((text) => ({ type: "text", text })),
    });
  }

  return components;
}

/**
 * Send a plain text reply (for inbox/auto-reply scenarios).
 */
export async function sendTextReply(
  phoneNumberId: string,
  encryptedToken: string,
  to: string,
  text: string
): Promise<SendMessageResult> {
  const accessToken = decrypt(encryptedToken);
  return sendWhatsAppMessage({
    phoneNumberId,
    accessToken,
    apiProvider: "meta",
    to,
    messageText: text,
  });
}

/**
 * Verify a webhook token against Meta's verification protocol.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string
): boolean {
  const expected = `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
