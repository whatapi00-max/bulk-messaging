import { apiClient } from "../lib/api-client";

// ─── Analytics ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboard: () => apiClient.get("/analytics/dashboard").then((r) => r.data),
};

// ─── Numbers ─────────────────────────────────────────────────────────────────
export const numbersApi = {
  list: () => apiClient.get("/numbers").then((r) => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post("/numbers", payload).then((r) => r.data.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch(`/numbers/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => apiClient.delete(`/numbers/${id}`).then((r) => r.data.data),
  test: (id: string, to: string, text: string) => apiClient.post(`/numbers/${id}/test`, { to, text }).then((r) => r.data.data),
};

// ─── Leads ───────────────────────────────────────────────────────────────────
export const leadsApi = {
  list: (search?: string) => apiClient.get("/leads", { params: search ? { search } : {} }).then((r) => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post("/leads", payload).then((r) => r.data.data),
  bulkCreate: (leads: Record<string, unknown>[]) => apiClient.post("/leads/bulk", { leads }).then((r) => r.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch(`/leads/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => apiClient.delete(`/leads/${id}`).then((r) => r.data.data),
  removeAll: () => apiClient.delete("/leads").then((r) => r.data.data),
};

// ─── Templates ───────────────────────────────────────────────────────────────
export const templatesApi = {
  list: () => apiClient.get("/templates").then((r) => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post("/templates", payload).then((r) => r.data.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch(`/templates/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => apiClient.delete(`/templates/${id}`).then((r) => r.data.data),
};

// ─── Media ───────────────────────────────────────────────────────────────────
export const mediaApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient
      .post("/media/upload", formData, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data.data as { filename: string; originalName: string; url: string; size: number; mimeType: string });
  },
};

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const campaignsApi = {
  list: () => apiClient.get("/campaigns").then((r) => r.data.data),
  create: (payload: Record<string, unknown>) => apiClient.post("/campaigns", payload).then((r) => r.data.data),
  update: (id: string, payload: Record<string, unknown>) => apiClient.patch(`/campaigns/${id}`, payload).then((r) => r.data.data),
  remove: (id: string) => apiClient.delete(`/campaigns/${id}`).then((r) => r.data.data),
  start: (id: string) => apiClient.post(`/campaigns/${id}/start`).then((r) => r.data),
  exportFailed: (id: string, format: "csv" | "xlsx") =>
    `${import.meta.env.VITE_API_URL ?? "/api"}/campaigns/${id}/failed/export?format=${format}`,
  retryFailed: (id: string) => apiClient.post(`/campaigns/${id}/retry-failed`).then((r) => r.data),
};

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: () => apiClient.get("/conversations").then((r) => r.data.data),
  getThread: (id: string) => apiClient.get(`/conversations/${id}`).then((r) => r.data),
  reply: (id: string, content: string) =>
    apiClient.post(`/conversations/${id}/reply`, { content }).then((r) => r.data),
};

