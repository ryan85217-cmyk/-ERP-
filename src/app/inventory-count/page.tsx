import Link from "next/link";
import { ArrowRight, ClipboardCheck, ClipboardList, MapPin, PauseCircle, PlayCircle, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { COUNT_STATUS_VARIANT } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { getI18n, pageTitle } from "@/i18n/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";

export const generateMetadata = () => pageTitle((t) => t.nav.countProgress);
export const dynamic = "force-dynamic";

export default async function CountProgressPage() {
  const { t, locale } = await getI18n();
  const c = t.count;
  const [active, completedCount, lastCompleted] = await Promise.all([
    prisma.inventoryCountSession.findMany({
      where: { status: { in: ["DRAFT", "IN_PROGRESS", "PAUSED"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryCountSession.count({ where: { status: "COMPLETED" } }),
    prisma.inventoryCountSession.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } }),
  ]);
  const inProgress = active.filter((s) => s.status === "IN_PROGRESS").length;
  const paused = active.filter((s) => s.status === "PAUSED").length;

  return (
    <>
      <PageHeader
        title={t.nav.countProgress}
        description={c.progressDesc}
        actions={
          <Button asChild>
            <Link href="/inventory-count/new">
              <Plus /> {t.nav.countNew}
            </Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t.enums.countStatus.IN_PROGRESS} value={inProgress} icon={PlayCircle} tone="info" />
        <StatCard label={t.enums.countStatus.PAUSED} value={paused} icon={PauseCircle} tone="warning" />
        <StatCard label={c.completedCount} value={completedCount} icon={ClipboardCheck} tone="success" />
        <StatCard
          label={c.lastCompleted}
          value={lastCompleted ? formatDate(lastCompleted.completedAt, locale) : "—"}
          icon={ClipboardList}
          hint={lastCompleted ? fmt(c.lastCompletedHint, { n: lastCompleted.totalVariance }) : undefined}
        />
      </div>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title={c.emptyTitle}
            description={c.emptyDesc}
            action={
              <Button asChild>
                <Link href="/inventory-count/new">{t.nav.countNew}</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((s) => {
            const total = s.countedCount + s.uncountedCount;
            const pct = total ? (s.countedCount / total) * 100 : 0;
            return (
              <Card key={s.id} className="flex flex-col">
                <CardHeader className="flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="break-all font-mono text-sm">{s.code}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(s.countDate, locale)} · {s.operator}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" />
                      {s.zones.length ? fmt(c.scopeZones, { zones: s.zones.join(", ") }) : c.scopeAll}
                    </p>
                  </div>
                  <Badge variant={COUNT_STATUS_VARIANT[s.status]} className="shrink-0 whitespace-nowrap">
                    {t.enums.countStatus[s.status]}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span>{fmt(c.countedOf, { done: s.countedCount, total })}</span>
                      {/* keeps "8" and "0%" apart when the text is read aloud or copied */}
                      <span className="sr-only"> · </span>
                      <span className="font-medium">{pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={pct} barClassName={s.status === "PAUSED" ? "bg-warning" : undefined} />
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-xs text-muted-foreground">{c.counted}</dt>
                      <dd className="font-semibold">{s.countedCount}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-xs text-muted-foreground">{c.uncounted}</dt>
                      <dd className="font-semibold">{s.uncountedCount}</dd>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <dt className="text-xs text-muted-foreground">{c.variance}</dt>
                      <dd className={`font-semibold ${s.totalVariance ? "text-destructive" : ""}`}>{s.totalVariance}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {fmt(c.startedAtLabel, { time: formatDateTime(s.startedAt, locale) })}
                    {s.pausedAt && fmt(c.pausedAtLabel, { time: formatDateTime(s.pausedAt, locale) })}
                  </p>
                  {s.note && <p className="text-xs text-muted-foreground">{fmt(t.common.notePrefix, { note: s.note })}</p>}
                  <Button className="mt-auto" variant={s.status === "PAUSED" ? "outline" : "default"} asChild>
                    <Link href={`/inventory-count/${s.id}`}>
                      {s.status === "PAUSED" ? c.viewAndResume : s.status === "DRAFT" ? c.start : c.resume}
                      <ArrowRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
