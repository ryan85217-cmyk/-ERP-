"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin } from "lucide-react";
import type { LocationType } from "@prisma/client";
import { saveLocation } from "@/lib/actions/locations";
import { initialFormState } from "@/lib/actions/types";
import { LOCATION_TYPES } from "@/lib/constants";
import { locationCode } from "@/lib/locations";
import { useI18n } from "@/i18n/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";

export interface LocationFormValues {
  id?: string;
  zone: string;
  aisle: number | "";
  level: number | "";
  type: LocationType;
  capacity: number | null;
  sortOrder: number | null;
  note: string | null;
  isActive: boolean;
}

export function LocationForm({ initial }: { initial: LocationFormValues }) {
  const { t } = useI18n();
  const l = t.locations;
  const [state, formAction, pending] = useActionState(saveLocation, initialFormState);
  const [zone, setZone] = useState(initial.zone);
  const [aisle, setAisle] = useState(String(initial.aisle));
  const [level, setLevel] = useState(String(initial.level));
  const fe = state.fieldErrors ?? {};
  const preview =
    /^[A-Za-z]{1,3}$/.test(zone.trim()) && Number(aisle) > 0 && Number(level) > 0
      ? locationCode(zone.trim(), Number(aisle), Number(level))
      : "—";

  return (
    <Card className="max-w-3xl">
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <FormField label={l.zone} htmlFor="zone" required error={fe.zone} hint={l.zoneHint}>
            <Input id="zone" name="zone" value={zone} onChange={(e) => setZone(e.target.value)} maxLength={3} className="uppercase" />
          </FormField>
          <FormField label={l.aisle} htmlFor="aisle" required error={fe.aisle}>
            <Input id="aisle" name="aisle" type="number" min={1} max={99} value={aisle} onChange={(e) => setAisle(e.target.value)} />
          </FormField>
          <FormField label={l.level} htmlFor="level" required error={fe.level}>
            <Input id="level" name="level" type="number" min={1} max={99} value={level} onChange={(e) => setLevel(e.target.value)} />
          </FormField>
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3 sm:col-span-3">
            <MapPin className="size-5 text-primary" />
            <span className="text-sm text-muted-foreground">{l.codePreview}</span>
            <span className="font-mono text-lg font-semibold">{preview}</span>
          </div>
          <FormField label={l.type} htmlFor="type" required error={fe.type}>
            <Select id="type" name="type" defaultValue={initial.type}>
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t.enums.locationType[type]}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label={l.capacity} htmlFor="capacity" error={fe.capacity} hint={l.capacityHint}>
            <Input id="capacity" name="capacity" type="number" min={1} defaultValue={initial.capacity ?? ""} />
          </FormField>
          <FormField label={l.sortOrder} htmlFor="sortOrder" error={fe.sortOrder} hint={l.sortOrderHint}>
            <Input id="sortOrder" name="sortOrder" type="number" min={0} defaultValue={initial.sortOrder ?? ""} />
          </FormField>
          <FormField label={t.common.note} htmlFor="note" className="sm:col-span-3">
            <Textarea id="note" name="note" rows={2} defaultValue={initial.note ?? ""} />
          </FormField>
          <label className="flex cursor-pointer items-center gap-3 sm:col-span-3">
            <input type="checkbox" name="isActive" defaultChecked={initial.isActive} className="size-4 accent-[var(--primary)]" />
            <span className="text-sm">{l.isActive}</span>
          </label>
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-3">{state.error}</p>
          )}
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {initial.id ? t.common.saveChanges : l.create}
            </Button>
            <Button variant="outline" asChild>
              <Link href={initial.id ? `/locations/${initial.id}` : "/locations"}>{t.common.cancel}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
