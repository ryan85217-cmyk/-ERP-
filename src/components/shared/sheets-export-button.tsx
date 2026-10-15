"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportToSheets, type SheetsExportResult } from "@/lib/actions/sheets";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export function SheetsExportButton({ sheetUrl }: { sheetUrl: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<SheetsExportResult | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await exportToSheets()))}
      >
        {pending ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        {pending ? t.dashboard.sheetsExporting : t.dashboard.sheetsExport}
      </Button>
      {result && (
        <span className={cn("text-xs", result.ok ? "text-success" : "text-destructive")}>
          {result.message}
          {result.ok && (
            <a href={sheetUrl} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 underline">
              {t.dashboard.sheetsOpen} <ExternalLink className="size-3" />
            </a>
          )}
        </span>
      )}
    </div>
  );
}
