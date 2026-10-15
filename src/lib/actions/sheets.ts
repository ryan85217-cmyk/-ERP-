"use server";

import { fmt } from "@/i18n/config";
import { getI18n } from "@/i18n/server";
import { exportSheet, exportSourceLabel } from "@/lib/google/export-config";
import { exportReportsToSheet } from "@/lib/google/export-report";

export type SheetsExportResult = { ok: true; message: string } | { ok: false; message: string };

export async function exportToSheets(): Promise<SheetsExportResult> {
  const { t } = await getI18n();
  const sheet = exportSheet();
  if (!sheet) return { ok: false, message: t.dashboard.sheetsNotConfigured };
  try {
    const res = await exportReportsToSheet(sheet, exportSourceLabel());
    return { ok: true, message: fmt(t.dashboard.sheetsExported, { n: res.tabs.length + 1 }) };
  } catch (e) {
    console.error(e);
    return { ok: false, message: fmt(t.dashboard.sheetsFailed, { error: e instanceof Error ? e.message : String(e) }) };
  }
}
