import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/i18n/server";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">{t.common.notFoundTitle}</h1>
      <p className="text-sm text-muted-foreground">{t.common.notFoundDesc}</p>
      <Button asChild className="mt-2">
        <Link href="/">{t.common.backToDashboard}</Link>
      </Button>
    </div>
  );
}
