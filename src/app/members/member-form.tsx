"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { saveMember } from "@/lib/actions/members";
import { initialFormState } from "@/lib/actions/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { useI18n } from "@/i18n/client";

export function MemberForm({ initial }: { initial: { id?: string; name: string; phone: string; email: string | null } }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState(saveMember, initialFormState);
  const fe = state.fieldErrors ?? {};
  return (
    <Card className="max-w-2xl">
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
          <FormField label={t.members.name} htmlFor="name" required error={fe.name}>
            <Input id="name" name="name" defaultValue={initial.name} />
          </FormField>
          <FormField label={t.members.phone} htmlFor="phone" required error={fe.phone}>
            <Input id="phone" name="phone" defaultValue={initial.phone} placeholder="0912345678" inputMode="tel" />
          </FormField>
          <FormField label="Email" htmlFor="email" error={fe.email} className="sm:col-span-2">
            <Input id="email" name="email" type="email" defaultValue={initial.email ?? ""} />
          </FormField>
          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{state.error}</p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {initial.id ? t.common.saveChanges : t.members.create}
            </Button>
            <Button variant="outline" asChild>
              <Link href={initial.id ? `/members/${initial.id}` : "/members"}>{t.common.cancel}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
