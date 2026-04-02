// ─── Shared TypeScript Types ─────────────────────────────────────────────────

export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── WhatsApp API Types ───────────────────────────────────────────────────────

export interface MetaTextMessage {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text";
  text: {
    preview_url?: boolean;
    body: string;
  };
}

export interface MetaTemplateComponent {
  type: "header" | "body" | "button";
  parameters?: Array<{
    type: "text" | "image" | "video" | "document" | "currency" | "date_time";
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string; filename?: string };
  }>;
  sub_type?: "quick_reply" | "url";
  index?: string;
}

export interface MetaTemplateMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components?: MetaTemplateComponent[];
  };
}

export interface MetaApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface MetaApiError {
  error: {
    message: string;
    type: string;
    code: number;
    error_data?: { messaging_product: string; details: string };
    fbtrace_id?: string;
  };
}

// ─── Webhook Event Types ──────────────────────────────────────────────────────

export interface MetaWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: MetaInboundMessage[];
      statuses?: MetaStatusUpdate[];
    };
    field: string;
  }>;
}

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string };
  document?: { id: string; filename: string; mime_type: string };
  reaction?: { message_id: string; emoji: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  context?: { from: string; id: string };
}

export interface MetaStatusUpdate {
  id: string;
  recipient_id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string; message: string; error_data?: unknown }>;
}

// ─── Queue Job Types ──────────────────────────────────────────────────────────

export interface MessageJobData {
  userId: string;
  campaignId: string;
  campaignRecipientId: string;
  leadId: string;
  phoneNumber: string;
  whatsappNumberId: string;
  phoneNumberId: string;
  accessToken: string;
  apiProvider: string;
  apiBaseUrl?: string;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>;
  messageText?: string;
  attempt: number;
}

// ─── Number Rotation Types ────────────────────────────────────────────────────

export interface NumberAllocation {
  numberId: string;
  count: number;
  weight: number;
}

export interface NumberHealth {
  numberId: string;
  healthScore: number;
  availableCapacity: number;
  isPaused: boolean;
}
