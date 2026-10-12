import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { getI18n } from "@/i18n/server";
import { MobileNav } from "./sidebar";
import { LanguageSwitcher } from "./language-switcher";

export async function Topbar() {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur md:px-6">
      <MobileNav />
      <form action="/products" method="get" className="relative hidden max-w-sm flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          placeholder={t.common.searchProductPlaceholder}
          className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </form>
      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <LanguageSwitcher />
        <Link
          href="/inventory/alerts"
          className="relative inline-flex size-9 items-center justify-center rounded-md border bg-card hover:bg-muted"
          aria-label={t.nav.invAlerts}
          title={t.nav.invAlerts}
        >
          <Bell className="size-4" aria-hidden />
          <span className="sr-only">{t.nav.invAlerts}</span>
          <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-destructive" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {t.common.userInitial}
          </div>
          <div className="hidden leading-tight md:block">
            <div className="text-sm font-medium">{t.common.userName}</div>
            <div className="text-xs text-muted-foreground">{t.common.userRole}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
