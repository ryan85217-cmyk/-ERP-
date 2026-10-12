import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";

export async function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params: Record<string, string | undefined>;
}) {
  const { t } = await getI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const linkCls = "inline-flex h-8 items-center gap-1 rounded-md border bg-card px-2.5 text-sm hover:bg-muted";
  return (
    <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row">
      <span>{fmt(t.common.pagination, { from, to, total })}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={linkCls} href={href(page - 1)}>
            <ChevronLeft className="size-4" /> {t.common.prevPage}
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-40")}>
            <ChevronLeft className="size-4" /> {t.common.prevPage}
          </span>
        )}
        <span className="px-1 text-foreground">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link className={linkCls} href={href(page + 1)}>
            {t.common.nextPage} <ChevronRight className="size-4" />
          </Link>
        ) : (
          <span className={cn(linkCls, "pointer-events-none opacity-40")}>
            {t.common.nextPage} <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
