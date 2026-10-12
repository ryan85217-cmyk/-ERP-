import Link from "next/link";
import { RefreshCw, Search, UserPlus } from "lucide-react";
import type { MemberSegment, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateMemberSegments } from "@/lib/actions/members";
import { SEGMENTS, SEGMENT_VARIANT } from "@/lib/constants";
import { first, formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import type { Messages } from "@/i18n/messages";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoSubmitSelect } from "@/components/shared/auto-submit-select";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";

const PAGE_SIZE = 20;
const SORTS: Record<string, { label: (t: Messages) => string; orderBy: Prisma.MemberOrderByWithRelationInput }> = {
  recent: { label: (t) => t.members.sortRecent, orderBy: { lastPurchaseAt: { sort: "desc", nulls: "last" } } },
  spent: { label: (t) => t.members.sortSpent, orderBy: { totalSpent: "desc" } },
  count: { label: (t) => t.members.sortCount, orderBy: { purchaseCount: "desc" } },
  joined: { label: (t) => t.members.sortJoined, orderBy: { joinedAt: "desc" } },
};

export async function MemberList({
  title,
  description,
  basePath,
  fixedSegment,
  searchParams,
}: {
  title: string;
  description: string;
  basePath: string;
  fixedSegment?: MemberSegment;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { t, locale } = await getI18n();
  const m = t.members;
  const q = first(searchParams.q)?.trim() ?? "";
  const segParam = first(searchParams.segment) ?? "";
  const segment = fixedSegment ?? SEGMENTS.find((s) => s === segParam);
  const sortKey = first(searchParams.sort) ?? "recent";
  const sort = SORTS[sortKey] ?? SORTS.recent;
  const page = Math.max(1, Number(first(searchParams.page)) || 1);

  const and: Prisma.MemberWhereInput[] = [];
  if (segment) and.push({ segment });
  if (q)
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { memberNumber: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  const where: Prisma.MemberWhereInput = { AND: and };

  const [members, total, counts] = await Promise.all([
    prisma.member.findMany({ where, orderBy: [sort.orderBy, { memberNumber: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.member.count({ where }),
    prisma.member.groupBy({ by: ["segment"], _count: { _all: true } }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c.segment, c._count._all])) as Partial<Record<MemberSegment, number>>;
  const allCount = Object.values(countMap).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            <form action={recalculateMemberSegments}>
              <Button variant="outline" type="submit">
                <RefreshCw /> {m.recalc}
              </Button>
            </form>
            <Button asChild>
              <Link href="/members/new">
                <UserPlus /> {m.add}
              </Link>
            </Button>
          </>
        }
      />

      {!fixedSegment && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link href={basePath}>
            <Badge variant={!segment ? "default" : "outline"} className="px-3 py-1 text-sm">
              {fmt(t.common.allWithCount, { n: formatNumber(allCount) })}
            </Badge>
          </Link>
          {SEGMENTS.map((s) => (
            <Link key={s} href={`${basePath}?segment=${s}`} title={t.enums.segmentDesc[s]}>
              <Badge variant={segment === s ? "default" : "outline"} className="px-3 py-1 text-sm">
                {t.enums.segment[s]} {formatNumber(countMap[s] ?? 0)}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <form method="get" className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input name="q" defaultValue={q} placeholder={m.searchPlaceholder} className="pl-9" />
          </div>
          {!fixedSegment && (
            <AutoSubmitSelect name="segment" defaultValue={segment ?? ""} className="md:w-40">
              <option value="">{t.common.allCategories}</option>
              {SEGMENTS.map((s) => (
                <option key={s} value={s}>
                  {t.enums.segment[s]}
                </option>
              ))}
            </AutoSubmitSelect>
          )}
          <AutoSubmitSelect name="sort" defaultValue={sortKey} className="md:w-40">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {fmt(m.sortPrefix, { label: v.label(t) })}
              </option>
            ))}
          </AutoSubmitSelect>
          <Button type="submit" variant="secondary">
            {t.common.search}
          </Button>
        </form>

        {members.length === 0 ? (
          <EmptyState title={m.empty} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.colMember}</TableHead>
                <TableHead className="hidden md:table-cell">{m.colPhone}</TableHead>
                <TableHead>{t.common.category}</TableHead>
                <TableHead className="hidden lg:table-cell">{m.colJoined}</TableHead>
                <TableHead>{m.colLastPurchase}</TableHead>
                <TableHead className="text-right">{m.colCount}</TableHead>
                <TableHead className="text-right">{m.colSpent}</TableHead>
                <TableHead className="hidden text-right lg:table-cell">{m.colAov}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((mem) => (
                <TableRow key={mem.id}>
                  <TableCell>
                    <Link href={`/members/${mem.id}`} className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {mem.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium hover:underline">{mem.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{mem.memberNumber}</div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{mem.phone}</TableCell>
                  <TableCell>
                    <Badge variant={SEGMENT_VARIANT[mem.segment]}>{t.enums.segment[mem.segment]}</Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(mem.joinedAt, locale)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(mem.lastPurchaseAt, locale)}</TableCell>
                  <TableCell className="text-right tabular-nums">{mem.purchaseCount}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(mem.totalSpent)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums text-muted-foreground lg:table-cell">{formatCurrency(mem.avgOrderValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={basePath}
          params={{ q, segment: fixedSegment ? undefined : segment, sort: sortKey === "recent" ? undefined : sortKey }}
        />
      </Card>
    </>
  );
}
