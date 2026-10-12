import { cache } from "react";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

export const getLocale = cache(async (): Promise<Locale> => {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
});

/** Per-request locale + message dictionary for server components and actions. */
export const getI18n = cache(async () => {
  const locale = await getLocale();
  return { locale, t: getMessages(locale) };
});

/** `export const generateMetadata = () => pageTitle((t) => t.nav.products)` */
export async function pageTitle(pick: (t: Messages) => string): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: pick(t) };
}
