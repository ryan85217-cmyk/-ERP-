"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronsRight, Loader2, MapPin, Pause, Play, Save, Search } from "lucide-react";
import type { CountStatus, VarianceReason } from "@prisma/client";
import {
  completeCountSession,
  pauseCountSession,
  resumeCountSession,
  saveCountProgress,
  startCountSession,
  type CountActionResult,
  type CountItemInput,
} from "@/lib/actions/inventory-count";
import { VARIANCE_REASONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { INTL_LOCALE, fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductThumb } from "@/components/shared/product-thumb";

export interface SheetItem {
  id: string;
  productName: string;
  sku: string;
  categoryName: string;
  colorKey: string;
  imageUrl: string | null;
  locationCode: string | null;
  locationType: string | null;
  posQty: number;
  actualQty: number | null;
  reason: VarianceReason | null;
  note: string | null;
}

type Draft = { actual: string; reason: VarianceReason | ""; note: string };
type Filter = "all" | "uncounted" | "counted" | "variance";

/** Key used for grouping; items without a location share one bucket shown last. */
const NO_LOC = "__none__";

function toDraft(i: SheetItem): Draft {
  return { actual: i.actualQty === null ? "" : String(i.actualQty), reason: i.reason ?? "", note: i.note ?? "" };
}

export function CountSheet({ sessionId, status, items }: { sessionId: string; status: CountStatus; items: SheetItem[] }) {
  const router = useRouter();
  const { t, locale } = useI18n();
  const c = t.count;
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map((i) => [i.id, toDraft(i)])),
  );
  const [baseline, setBaseline] = useState<Record<string, Draft>>(drafts);
  const [filter, setFilter] = useState<Filter>("all");
  const [zone, setZone] = useState("");
  const [location, setLocation] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applyStock, setApplyStock] = useState(true);
  const tableRef = useRef<HTMLDivElement>(null);

  const editable = status === "IN_PROGRESS" || status === "DRAFT";
  const dirtyIds = useMemo(
    () =>
      Object.keys(drafts).filter((id) => {
        const a = drafts[id];
        const b = baseline[id];
        return !b || a.actual !== b.actual || a.reason !== b.reason || a.note !== b.note;
      }),
    [drafts, baseline],
  );
  const dirty = dirtyIds.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const rows = useMemo(
    () =>
      items.map((i) => {
        const d = drafts[i.id];
        const actual = d.actual === "" ? null : Number(d.actual);
        const valid = actual === null || (Number.isInteger(actual) && actual >= 0);
        const variance = actual === null || !valid ? null : i.posQty - actual;
        return { ...i, locKey: i.locationCode ?? NO_LOC, draft: d, actual, valid, variance };
      }),
    [items, drafts],
  );

  // per-location progress, in the walking order the server already sorted by
  const locations = useMemo(() => {
    const map = new Map<string, { key: string; code: string | null; type: string | null; total: number; done: number; variance: number }>();
    for (const r of rows) {
      const l = map.get(r.locKey) ?? { key: r.locKey, code: r.locationCode, type: r.locationType, total: 0, done: 0, variance: 0 };
      l.total += 1;
      if (r.actual !== null && r.valid) l.done += 1;
      if (r.variance) l.variance += 1;
      map.set(r.locKey, l);
    }
    return [...map.values()];
  }, [rows]);
  const zones = useMemo(
    () => Array.from(new Set(locations.map((l) => l.code?.split("-")[0]).filter((z): z is string => !!z))),
    [locations],
  );

  const stats = useMemo(() => {
    const counted = rows.filter((r) => r.actual !== null && r.valid);
    const withVar = counted.filter((r) => r.variance);
    return {
      total: rows.length,
      counted: counted.length,
      uncounted: rows.length - counted.length,
      totalVariance: counted.reduce((a, r) => a + (r.variance ?? 0), 0),
      varianceItems: withVar.length,
      missingReason: withVar.filter((r) => !r.draft.reason).length,
      invalid: rows.filter((r) => !r.valid).length,
    };
  }, [rows]);

  const visible = rows.filter((r) => {
    if (location && r.locKey !== location) return false;
    if (zone && !r.locationCode?.startsWith(`${zone}-`)) return false;
    if (query && !`${r.productName} ${r.sku} ${r.locationCode ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "uncounted") return r.actual === null;
    if (filter === "counted") return r.actual !== null;
    if (filter === "variance") return !!r.variance;
    return true;
  });

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  }

  function payload(): CountItemInput[] {
    return dirtyIds.map((id) => {
      const d = drafts[id];
      return {
        id,
        actualQty: d.actual === "" ? null : Number(d.actual),
        reason: d.reason === "" ? null : d.reason,
        note: d.note.trim() === "" ? null : d.note.trim(),
      };
    });
  }

  function run(fn: () => Promise<CountActionResult>, okText: string, after?: () => void) {
    if (stats.invalid > 0) {
      setMessage({ type: "error", text: c.invalidQty });
      return;
    }
    setMessage(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setBaseline(drafts);
        const time = new Date(res.savedAt).toLocaleTimeString(INTL_LOCALE[locale], { hour12: false });
        setMessage({ type: "ok", text: `${okText} (${time})` });
        after?.();
        router.refresh();
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  function jumpToNextLocation() {
    const start = location ? locations.findIndex((l) => l.key === location) + 1 : 0;
    const ordered = [...locations.slice(start), ...locations.slice(0, start)];
    const next = ordered.find((l) => l.done < l.total);
    if (!next) {
      setMessage({ type: "ok", text: c.allLocationsDone });
      return;
    }
    setZone("");
    setFilter("all");
    setLocation(next.key);
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const pct = stats.total ? (stats.counted / stats.total) * 100 : 0;
  const tabs: [Filter, string][] = [
    ["all", fmt(c.tabAll, { n: stats.total })],
    ["uncounted", fmt(c.tabUncounted, { n: stats.uncounted })],
    ["counted", fmt(c.tabCounted, { n: stats.counted })],
    ["variance", fmt(c.tabVariance, { n: stats.varianceItems })],
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* progress + actions */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex-1">
            <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{fmt(c.progress, { done: stats.counted, total: stats.total, pct: pct.toFixed(0) })}</span>
              <span className="text-muted-foreground">{fmt(c.uncountedN, { n: stats.uncounted })}</span>
              <span className="text-muted-foreground">
                {fmt(c.varianceSummary, { n: stats.varianceItems })}{" "}
                <b className={cn(stats.totalVariance !== 0 && "text-destructive")}>{stats.totalVariance}</b>
              </span>
              {dirty && <Badge variant="warning">{fmt(c.unsaved, { n: dirtyIds.length })}</Badge>}
            </div>
            <Progress value={pct} />
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "DRAFT" && (
              <Button onClick={() => run(() => startCountSession(sessionId), c.msgStarted)} disabled={pending}>
                <Play /> {c.start}
              </Button>
            )}
            {status === "PAUSED" && (
              <Button onClick={() => run(() => resumeCountSession(sessionId), c.msgResumed)} disabled={pending}>
                <Play /> {c.resume}
              </Button>
            )}
            {editable && (
              <Button variant="outline" onClick={() => run(() => saveCountProgress(sessionId, payload()), c.msgSaved)} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} {c.save}
              </Button>
            )}
            {status === "IN_PROGRESS" && (
              <Button variant="warning" onClick={() => run(() => pauseCountSession(sessionId, payload()), c.msgPaused)} disabled={pending}>
                <Pause /> {c.pause}
              </Button>
            )}
            {editable && (
              <Button onClick={() => setConfirmOpen(true)} disabled={pending}>
                <CheckCircle2 /> {c.complete}
              </Button>
            )}
          </div>
        </div>
        {message && (
          <p
            className={cn(
              "mt-3 rounded-md px-3 py-2 text-sm",
              message.type === "ok" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {message.text}
          </p>
        )}
        {status === "PAUSED" && <p className="mt-3 rounded-md bg-warning/15 px-3 py-2 text-sm">{c.pausedBanner}</p>}
      </Card>

      {/* location progress */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="size-4 text-primary" /> {c.locationProgress}
            </p>
            <p className="text-xs text-muted-foreground">{c.locationProgressHint}</p>
          </div>
          <Button variant="outline" size="sm" onClick={jumpToNextLocation}>
            <ChevronsRight /> {c.nextLocation}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {locations.map((l) => {
            const done = l.done === l.total;
            const selected = location === l.key;
            return (
              <button
                key={l.key}
                type="button"
                onClick={() => setLocation(selected ? "" : l.key)}
                title={l.type ?? undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors",
                  done ? "border-success/40 bg-success/10" : l.done > 0 ? "border-warning/50 bg-warning/10" : "bg-card hover:bg-muted",
                  l.variance > 0 && "ring-1 ring-destructive/40",
                  selected && "border-primary ring-2 ring-primary/40",
                )}
              >
                <span className="font-mono font-medium">{l.code ?? c.noLocation}</span>
                <span className="tabular-nums text-muted-foreground">
                  {l.done}/{l.total}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* filters */}
      <Card>
        <div ref={tableRef} className="flex scroll-mt-20 flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={c.searchPlaceholder} className="pl-9" />
          </div>
          <Select
            value={zone}
            onChange={(e) => {
              setZone(e.target.value);
              setLocation("");
            }}
            className="md:w-40"
          >
            <option value="">{c.allZones}</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {fmt(c.zoneLabel, { zone: z })}
              </option>
            ))}
          </Select>
          <div className="inline-flex flex-wrap rounded-lg border bg-muted/50 p-1 text-sm">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  filter === key ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr className="border-b">
                <th className="px-3 py-2.5 text-left font-medium">{t.common.product}</th>
                <th className="px-3 py-2.5 text-right font-medium">{c.colPos}</th>
                <th className="w-32 px-3 py-2.5 text-left font-medium">{c.colActual}</th>
                <th className="px-3 py-2.5 text-right font-medium">{c.variance}</th>
                <th className="w-40 px-3 py-2.5 text-left font-medium">{c.colReason}</th>
                <th className="px-3 py-2.5 text-left font-medium">{t.common.note}</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted-foreground">
                    {c.noRows}
                  </td>
                </tr>
              )}
              {visible.map((r, idx) => {
                const newGroup = idx === 0 || visible[idx - 1].locKey !== r.locKey;
                const loc = newGroup ? locations.find((l) => l.key === r.locKey) : undefined;
                return (
                  <Fragment key={r.id}>
                    {newGroup && loc && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={6} className="px-3 py-1.5">
                          <div className="flex items-center gap-2 text-xs">
                            <MapPin className="size-3.5 text-primary" />
                            <span className="font-mono font-semibold">{loc.code ?? c.noLocation}</span>
                            {loc.type && <span className="text-muted-foreground">{loc.type}</span>}
                            <span className="text-muted-foreground">· {fmt(c.groupItems, { n: loc.total })}</span>
                            <span className={cn("ml-auto tabular-nums", loc.done === loc.total ? "text-success" : "text-muted-foreground")}>
                              {loc.done}/{loc.total}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className={cn(
                        "border-b last:border-0",
                        r.actual !== null && !r.variance && "bg-success/[0.04]",
                        !!r.variance && "bg-destructive/[0.04]",
                      )}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          <ProductThumb name={r.productName} imageUrl={r.imageUrl} colorKey={r.colorKey} className="size-9" />
                          <div className="min-w-0">
                            <div className="truncate font-medium">{r.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono">{r.sku}</span> · {r.categoryName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.posQty}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={r.draft.actual}
                          disabled={!editable}
                          aria-invalid={!r.valid}
                          onChange={(e) => update(r.id, { actual: e.target.value })}
                          className={cn("h-8 text-right tabular-nums", !r.valid && "border-destructive")}
                          placeholder="—"
                        />
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          r.variance ? (r.variance > 0 ? "text-destructive" : "text-info") : "text-muted-foreground",
                        )}
                      >
                        {r.variance === null ? "—" : r.variance > 0 ? `+${r.variance}` : r.variance}
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={r.draft.reason}
                          disabled={!editable || !r.variance}
                          onChange={(e) => update(r.id, { reason: e.target.value as VarianceReason | "" })}
                          className={cn(!!r.variance && !r.draft.reason && "[&_select]:border-warning")}
                        >
                          <option value="">{r.variance ? c.selectReason : "—"}</option>
                          {VARIANCE_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {t.enums.reason[reason]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={r.draft.note}
                          disabled={!editable}
                          onChange={(e) => update(r.id, { note: e.target.value })}
                          className="h-8"
                          placeholder={t.common.note}
                        />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">{c.formula}</p>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{c.confirmTitle}</DialogTitle>
            <DialogDescription>{c.confirmDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{c.counted}</div>
              <div className="text-lg font-semibold">{stats.counted}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{c.uncounted}</div>
              <div className={cn("text-lg font-semibold", stats.uncounted > 0 && "text-destructive")}>{stats.uncounted}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground">{c.totalVariance}</div>
              <div className="text-lg font-semibold">{stats.totalVariance}</div>
            </div>
          </div>
          {stats.uncounted > 0 && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{fmt(c.uncountedWarn, { n: stats.uncounted })}</p>
          )}
          {stats.missingReason > 0 && (
            <p className="rounded-md bg-warning/15 px-3 py-2 text-sm">{fmt(c.missingReasonWarn, { n: stats.missingReason })}</p>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={applyStock} onChange={(e) => setApplyStock(e.target.checked)} className="size-4" />
            {c.applyStock}
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              disabled={pending || stats.uncounted > 0}
              onClick={() => run(() => completeCountSession(sessionId, payload(), applyStock), c.msgCompleted, () => setConfirmOpen(false))}
            >
              {pending && <Loader2 className="animate-spin" />}
              {c.confirmComplete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
