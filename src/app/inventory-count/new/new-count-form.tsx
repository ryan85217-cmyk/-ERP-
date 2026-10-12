"use client";

import { startTransition, useActionState, useState } from "react";
import { ClipboardList, Loader2, MapPin, Tags } from "lucide-react";
import { createCountSession } from "@/lib/actions/inventory-count";
import { initialFormState } from "@/lib/actions/types";
import { cn } from "@/lib/utils";
import { fmt } from "@/i18n/config";
import { useI18n } from "@/i18n/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";

type ScopeMode = "zone" | "category";

export function NewCountForm({
  categories,
  zones,
  unassignedCount,
  defaultDate,
  defaultOperator,
}: {
  categories: { id: string; name: string; productCount: number }[];
  zones: { zone: string; locationCount: number; productCount: number; types: string }[];
  unassignedCount: number;
  defaultDate: string;
  defaultOperator: string;
}) {
  const { t } = useI18n();
  const c = t.count;
  const [state, formAction, pending] = useActionState(createCountSession, initialFormState);
  const [mode, setMode] = useState<ScopeMode>("zone");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const fe = state.fieldErrors ?? {};

  const totalProducts =
    mode === "zone"
      ? selectedZones.length
        ? zones.filter((z) => selectedZones.includes(z.zone)).reduce((a, z) => a + z.productCount, 0)
        : zones.reduce((a, z) => a + z.productCount, 0) + unassignedCount
      : (selectedCats.length ? categories.filter((x) => selectedCats.includes(x.id)) : categories).reduce((a, x) => a + x.productCount, 0);
  const totalLocations =
    mode === "zone"
      ? (selectedZones.length ? zones.filter((z) => selectedZones.includes(z.zone)) : zones).reduce((a, z) => a + z.locationCount, 0)
      : null;

  const toggle = (list: string[], value: string, on: boolean) => (on ? [...list, value] : list.filter((x) => x !== value));

  return (
    <form
      className="grid gap-6 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
    >
      <input type="hidden" name="scopeMode" value={mode} />
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{c.infoTitle}</CardTitle>
          <CardDescription>{c.infoDesc}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={c.countDate} htmlFor="countDate" required error={fe.countDate}>
            <Input id="countDate" name="countDate" type="date" defaultValue={defaultDate} />
          </FormField>
          <FormField label={c.operator} htmlFor="operator" required error={fe.operator}>
            <Input id="operator" name="operator" defaultValue={defaultOperator} />
          </FormField>
          <FormField label={t.common.note} htmlFor="note" className="sm:col-span-2">
            <Textarea id="note" name="note" rows={2} placeholder={c.notePlaceholder} />
          </FormField>
          <div className="sm:col-span-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{c.scopeTitle}</p>
              <div className="inline-flex rounded-lg border bg-muted/50 p-1 text-sm">
                {(
                  [
                    ["zone", c.scopeByZone, MapPin],
                    ["category", c.scopeByCategory, Tags],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors",
                      mode === key ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">{mode === "zone" ? c.scopeHintZone : c.scopeHintCategory}</p>

            {mode === "zone" ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {zones.map((z) => {
                  const checked = selectedZones.includes(z.zone);
                  return (
                    <label
                      key={z.zone}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="zones"
                        value={z.zone}
                        checked={checked}
                        onChange={(e) => setSelectedZones((s) => toggle(s, z.zone, e.target.checked))}
                        className="mt-0.5 size-4"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{fmt(c.zoneLabel, { zone: z.zone })}</span>
                        <span className="block truncate text-xs text-muted-foreground">{z.types}</span>
                        <span className="block text-xs text-muted-foreground">
                          {fmt(c.zoneLocations, { n: z.locationCount })} · {fmt(t.common.itemsCount, { n: z.productCount })}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {categories.map((cat) => {
                  const checked = selectedCats.includes(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={cat.id}
                        checked={checked}
                        onChange={(e) => setSelectedCats((s) => toggle(s, cat.id, e.target.checked))}
                        className="size-4"
                      />
                      <span className="flex-1">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">{cat.productCount}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle>{c.summary}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-lg bg-muted/60 p-4">
            <ClipboardList className="size-8 text-primary" />
            <div>
              <div className="text-2xl font-semibold">{totalProducts}</div>
              <div className="text-xs text-muted-foreground">{c.productsIncluded}</div>
            </div>
            {totalLocations !== null && (
              <div className="ml-auto text-right">
                <div className="text-2xl font-semibold">{totalLocations}</div>
                <div className="text-xs text-muted-foreground">{c.locationsIncluded}</div>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="startNow" defaultChecked className="size-4" />
            {c.startNow}
          </label>
          {state.error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {c.create}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
