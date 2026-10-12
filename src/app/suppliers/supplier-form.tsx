"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { saveSupplier } from "@/lib/actions/suppliers";
import { initialFormState } from "@/lib/actions/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { useI18n } from "@/i18n/client";

export interface SupplierFormValues {
  id?: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  note: string | null;
}

export function SupplierForm({ initial }: { initial: SupplierFormValues }) {
  const { t } = useI18n();
  const s = t.suppliers;
  const [state, formAction, pending] = useActionState(saveSupplier, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <Card className="max-w-3xl">
      <CardContent className="pt-5">
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <FormField label={s.name} htmlFor="name" required error={fe.name} className="sm:col-span-2">
            <Input id="name" name="name" defaultValue={initial.name} />
          </FormField>
          <FormField label={s.contactName} htmlFor="contactName" error={fe.contactName}>
            <Input id="contactName" name="contactName" defaultValue={initial.contactName ?? ""} />
          </FormField>
          <FormField label={s.phone} htmlFor="phone" error={fe.phone}>
            <Input id="phone" name="phone" defaultValue={initial.phone ?? ""} />
          </FormField>
          <FormField label="Email" htmlFor="email" error={fe.email}>
            <Input id="email" name="email" type="email" defaultValue={initial.email ?? ""} />
          </FormField>
          <FormField label={s.address} htmlFor="address" error={fe.address}>
            <Input id="address" name="address" defaultValue={initial.address ?? ""} />
          </FormField>
          <FormField label={t.common.note} htmlFor="note" className="sm:col-span-2">
            <Textarea id="note" name="note" rows={3} defaultValue={initial.note ?? ""} />
          </FormField>
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {initial.id ? t.common.saveChanges : s.create}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/suppliers">{t.common.cancel}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
