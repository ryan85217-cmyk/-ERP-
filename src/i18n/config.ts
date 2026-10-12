export const LOCALES = ["zh-TW", "ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "zh-TW";
export const LOCALE_COOKIE = "locale";

export const LOCALE_LABEL: Record<Locale, string> = {
  "zh-TW": "繁體中文",
  ja: "日本語",
  en: "English",
};

/** BCP-47 tags for <html lang> and Intl formatters */
export const INTL_LOCALE: Record<Locale, string> = {
  "zh-TW": "zh-TW",
  ja: "ja-JP",
  en: "en-US",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Replace `{name}` placeholders in a message. */
export function fmt(message: string, vars: Record<string, string | number | null | undefined> = {}) {
  return message.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

/**
 * Declare one message namespace. The zh-TW object is the source of truth;
 * ja / en must provide exactly the same keys (enforced by the type checker).
 */
export function defineMessages<T>(zh: T, rest: { ja: NoInfer<T>; en: NoInfer<T> }): Record<Locale, T> {
  return { "zh-TW": zh, ja: rest.ja, en: rest.en };
}

/** Pick the localized variant of a record with optional nameJa / nameEn columns. */
export function localName(
  locale: Locale,
  row: { name: string; nameJa?: string | null; nameEn?: string | null },
) {
  if (locale === "ja") return row.nameJa || row.name;
  if (locale === "en") return row.nameEn || row.name;
  return row.name;
}
