import Link from "next/link";
import { RANGE_KEYS, type RangeKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { getI18n } from "@/i18n/server";

export async function RangeTabs({ value, basePath = "/" }: { value: RangeKey; basePath?: string }) {
  const { t } = await getI18n();
  return (
    <div className="inline-flex rounded-lg border bg-card p-1 shadow-xs">
      {RANGE_KEYS.map((key) => (
        <Link
          key={key}
          href={`${basePath}?range=${key}`}
          scroll={false}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.enums.range[key]}
        </Link>
      ))}
    </div>
  );
}
