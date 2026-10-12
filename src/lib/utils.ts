import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "@/i18n/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFmt = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  maximumFractionDigits: 0,
});
const numberFmt = new Intl.NumberFormat("zh-TW");

export function formatCurrency(value: number | null | undefined) {
  return currencyFmt.format(value ?? 0);
}

export function formatNumber(value: number | null | undefined) {
  return numberFmt.format(value ?? 0);
}

export function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function formatPercent(value: number, digits = 1) {
  return `${(value * 100).toFixed(digits)}%`;
}

export const APP_TIMEZONE = "Asia/Taipei";

export function formatDate(value: Date | string | null | undefined, locale: Locale = DEFAULT_LOCALE) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatDateTime(value: Date | string | null | undefined, locale: Locale = DEFAULT_LOCALE) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

/** yyyy-mm-dd in store timezone, for <input type="date"> */
export function toDateInputValue(value: Date | string) {
  const d = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts;
}

/** Short month/day label in store timezone, e.g. "10/11" */
export function formatMonthDay(value: Date | string, locale: Locale = DEFAULT_LOCALE) {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { timeZone: APP_TIMEZONE, month: "numeric", day: "numeric" }).format(new Date(value));
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function first<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}
