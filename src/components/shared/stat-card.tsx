import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  hint,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** fractional change, e.g. 0.12 = +12% */
  delta?: number | null;
  hint?: React.ReactNode;
  tone?: "primary" | "info" | "warning" | "destructive" | "success";
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    warning: "bg-warning/20 text-[oklch(0.5_0.12_70)]",
    destructive: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {Icon && (
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneClass)}>
            <Icon className="size-5" />
          </div>
        )}
      </div>
      {(delta !== undefined && delta !== null) || hint ? (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {delta !== undefined && delta !== null && Number.isFinite(delta) && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
          {hint && <span className="text-muted-foreground">{hint}</span>}
        </div>
      ) : null}
    </Card>
  );
}
