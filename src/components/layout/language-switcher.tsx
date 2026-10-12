"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages, Loader2 } from "lucide-react";
import { setLocale } from "@/i18n/actions";
import { LOCALES, LOCALE_LABEL } from "@/i18n/config";
import { useI18n } from "@/i18n/client";

export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="relative inline-flex h-9 items-center gap-1.5 rounded-md border bg-card pl-2.5 pr-1 text-sm hover:bg-muted">
      {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Languages className="size-4 text-muted-foreground" />}
      <span className="sr-only">{t.common.language}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
            router.refresh();
          });
        }}
        className="h-full cursor-pointer appearance-none bg-transparent pr-1 text-sm focus-visible:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABEL[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
