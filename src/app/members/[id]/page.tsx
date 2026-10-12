import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Mail, Pencil, Phone, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteMember } from "@/lib/actions/members";
import { addMonths, startOfMonth } from "@/lib/dates";
import { SEGMENT_VARIANT } from "@/lib/constants";
import { daysBetween, formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { fmt, localName } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { SimpleBarChart } from "@/components/charts/charts";

export const generateMetadata = () => pageTitle((t) => t.members.detailTitle);
export const dynamic = "force-dynamic";

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale } = await getI18n();
  const mt = t.members;
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) notFound();

  const since = addMonths(startOfMonth(), -11);
  const [orders, favorites, monthly] = await Promise.all([
    prisma.order.findMany({
      where: { memberId: id },
      orderBy: { orderedAt: "desc" },
      take: 15,
      include: { items: { include: { product: { select: { nameEn: true, nameJa: true } } } } },
    }),
    prisma.$queryRaw<
      {
        productId: string | null;
        name: string;
        nameEn: string | null;
        nameJa: string | null;
        category: string;
        categoryEn: string | null;
        categoryJa: string | null;
        qty: bigint;
        times: bigint;
        spent: bigint;
      }[]
    >`
      SELECT oi."productId", oi."productName" AS name, MAX(p."nameEn") AS "nameEn", MAX(p."nameJa") AS "nameJa",
             oi."categoryName" AS category, MAX(c."nameEn") AS "categoryEn", MAX(c."nameJa") AS "categoryJa",
             SUM(oi."quantity")::bigint AS qty, COUNT(DISTINCT o."id")::bigint AS times, SUM(oi."subtotal")::bigint AS spent
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId"
      LEFT JOIN "Category" c ON c."name" = oi."categoryName"
      WHERE o."memberId" = ${id}
      GROUP BY oi."productId", oi."productName", oi."categoryName"
      ORDER BY times DESC, qty DESC
      LIMIT 8`,
    prisma.$queryRaw<{ bucket: string; spent: bigint }[]>`
      SELECT to_char(date_trunc('month', ((o."orderedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Taipei')), 'YYYY-MM') AS bucket,
             SUM(o."total")::bigint AS spent
      FROM "Order" o
      WHERE o."memberId" = ${id} AND o."orderedAt" >= ${since.toISOString()}::timestamp
      GROUP BY 1 ORDER BY 1`,
  ]);

  const monthMap = new Map(monthly.map((m) => [m.bucket, Number(m.spent)]));
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(since, i);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).format(d).slice(0, 7);
    return { label: key.slice(2).replace("-", "/"), spent: monthMap.get(key) ?? 0 };
  });
  const daysSinceLast = member.lastPurchaseAt ? daysBetween(member.lastPurchaseAt, new Date()) : null;

  return (
    <>
      <PageHeader
        title={member.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{member.memberNumber}</span>
            <Badge variant={SEGMENT_VARIANT[member.segment]} title={t.enums.segmentDesc[member.segment]}>
              {t.enums.segment[member.segment]}
            </Badge>
          </span>
        }
        backHref="/members"
        actions={
          <>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/members/${member.id}/edit`}>
                <Pencil /> {t.common.edit}
              </Link>
            </Button>
            <ConfirmDelete
              title={fmt(mt.deleteTitle, { name: member.name })}
              description={mt.deleteDesc}
              action={deleteMember.bind(null, member.id)}
            />
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={mt.totalSpent} value={formatCurrency(member.totalSpent)} icon={Wallet} />
        <StatCard label={mt.purchaseCount} value={member.purchaseCount} icon={Receipt} tone="info" />
        <StatCard label={mt.aov} value={formatCurrency(member.avgOrderValue)} icon={TrendingUp} tone="success" />
        <StatCard
          label={mt.lastPurchase}
          value={formatDate(member.lastPurchaseAt, locale)}
          icon={CalendarDays}
          tone={daysSinceLast !== null && daysSinceLast > 90 ? "destructive" : "warning"}
          hint={daysSinceLast !== null ? fmt(mt.daysAgo, { n: daysSinceLast }) : mt.neverPurchased}
        />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{mt.profile}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <span className="font-mono">{member.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              {member.email ?? <span className="text-muted-foreground">{mt.noEmail}</span>}
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-muted-foreground" />
              {fmt(mt.joinedOn, { date: formatDate(member.joinedAt, locale) })}
            </div>
            <div className="mt-2 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              {fmt(mt.ruleDesc, { rule: t.enums.segmentDesc[member.segment] })}
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{mt.monthlySpend}</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleBarChart data={monthlyData} series={[{ key: "spent", label: mt.spend }]} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{mt.favorites}</CardTitle>
            <CardDescription>{mt.favoritesDesc}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {favorites.length === 0 && <p className="py-4 text-sm text-muted-foreground">{mt.noPurchases}</p>}
            {favorites.map((f, i) => (
              <div key={`${f.productId}-${f.name}`} className="flex items-center gap-3 py-2.5">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  {f.productId ? (
                    <Link href={`/products/${f.productId}`} className="truncate text-sm font-medium hover:underline">
                      {localName(locale, f)}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium">{localName(locale, f)}</span>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {localName(locale, { name: f.category, nameEn: f.categoryEn, nameJa: f.categoryJa })}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-medium">{fmt(mt.timesQty, { times: Number(f.times), qty: Number(f.qty) })}</div>
                  <div className="text-muted-foreground">{formatCurrency(Number(f.spent))}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="size-4" /> {mt.orders}
            </CardTitle>
            <CardDescription>{mt.ordersDesc}</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mt.colOrderNo}</TableHead>
                <TableHead>{t.common.time}</TableHead>
                <TableHead className="hidden md:table-cell">{mt.colItems}</TableHead>
                <TableHead>{mt.colPayment}</TableHead>
                <TableHead className="text-right">{mt.colAmount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {mt.noPurchases}
                  </TableCell>
                </TableRow>
              )}
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(o.orderedAt, locale)}</TableCell>
                  <TableCell className="hidden max-w-72 md:table-cell">
                    <span className="line-clamp-1 text-xs text-muted-foreground">
                      {o.items
                        .map((i) => `${localName(locale, { name: i.productName, nameEn: i.product?.nameEn, nameJa: i.product?.nameJa })}×${i.quantity}`)
                        .join(locale === "en" ? ", " : "、")}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{t.enums.payment[o.paymentMethod as keyof typeof t.enums.payment] ?? o.paymentMethod}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatCurrency(o.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
