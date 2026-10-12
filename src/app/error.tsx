"use client";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">{t.common.errorTitle}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message.includes("Can't reach database") ? t.common.errorDb : t.common.errorGeneric}
      </p>
      <Button onClick={reset}>{t.common.retry}</Button>
    </div>
  );
}
