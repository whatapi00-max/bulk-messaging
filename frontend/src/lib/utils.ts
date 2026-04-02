import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: "text-green-500",
    running: "text-blue-500",
    completed: "text-green-600",
    failed: "text-red-500",
    paused: "text-yellow-500",
    pending: "text-gray-400",
    draft: "text-gray-500",
    scheduled: "text-purple-500",
    sent: "text-blue-400",
    delivered: "text-green-400",
    read: "text-green-500",
    inactive: "text-gray-400",
  };
  return map[status] ?? "text-gray-500";
}

export function getHealthColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 60) return "text-yellow-500";
  if (score >= 40) return "text-orange-500";
  return "text-red-500";
}
