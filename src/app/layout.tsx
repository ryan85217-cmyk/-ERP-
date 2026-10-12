import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { I18nProvider } from "@/i18n/client";
import { INTL_LOCALE } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.common.appName, template: `%s · ${t.common.appName}` },
    description: t.common.appDescription,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { locale, t } = await getI18n();
  return (
    <html lang={INTL_LOCALE[locale]}>
      <body>
        <I18nProvider locale={locale} messages={t}>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <Topbar />
              <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-[1400px]">{children}</div>
              </main>
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
