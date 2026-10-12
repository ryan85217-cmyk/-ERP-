"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";

export function ConfirmDelete({
  action,
  title,
  description,
  label,
  size = "sm",
  iconOnly = false,
}: {
  action: () => Promise<{ error?: string } | void>;
  title?: string;
  description?: string;
  label?: string;
  size?: "sm" | "default";
  iconOnly?: boolean;
}) {
  const { t } = useI18n();
  label ??= t.common.delete;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(null); }}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10" aria-label={label}>
            <Trash2 />
          </Button>
        ) : (
          <Button variant="outline" size={size} className="text-destructive">
            <Trash2 />
            {label}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? t.common.confirmDeleteTitle}</DialogTitle>
          <DialogDescription>{description ?? t.common.confirmDeleteDesc}</DialogDescription>
        </DialogHeader>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {t.common.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await action();
                if (res && res.error) setError(res.error);
                else setOpen(false);
              })
            }
          >
            {pending && <Loader2 className="animate-spin" />}
            {t.common.confirmDelete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
