export interface AppNotificationPayload {
  title: string;
  description: string;
  kind?: "success" | "warning" | "error" | "info";
}

export const APP_NOTIFY_EVENT = "app:notify";
export const APP_NOTIFY_STORAGE_KEY = "billy777.notifications";

export interface StoredNotification extends Required<AppNotificationPayload> {
  id: string;
  createdAt: number;
  read: boolean;
}

export function loadStoredNotifications(): StoredNotification[] {
  try {
    const raw = localStorage.getItem(APP_NOTIFY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(items: StoredNotification[]): void {
  try {
    localStorage.setItem(APP_NOTIFY_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
  } catch {
    // Ignore storage failures.
  }
}

export function clearStoredNotifications(): void {
  try {
    localStorage.removeItem(APP_NOTIFY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function notifyApp(payload: AppNotificationPayload): void {
  window.dispatchEvent(
    new CustomEvent<AppNotificationPayload>(APP_NOTIFY_EVENT, {
      detail: payload,
    })
  );
}