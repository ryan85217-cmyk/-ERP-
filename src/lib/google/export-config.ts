import { isSheetsConfigured } from "./sheets";

/** Spreadsheet (id or URL) that reports are exported to, or null when export isn't set up. */
export function exportSheet() {
  const sheet = process.env.SHEETS_EXPORT_SHEET?.trim();
  return sheet && isSheetsConfigured() ? sheet : null;
}

export function exportSheetUrl(sheet: string) {
  return sheet.startsWith("http") ? sheet : `https://docs.google.com/spreadsheets/d/${sheet}/edit`;
}

/** Where the data came from, written on the 摘要 tab. */
export function exportSourceLabel() {
  if (process.env.SHEETS_EXPORT_SOURCE) return process.env.SHEETS_EXPORT_SOURCE;
  let host = "";
  try {
    host = new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    // unknown
  }
  return ["localhost", "127.0.0.1", "::1"].includes(host) ? "本機 ERP（真實門市資料）" : "線上展示站（去識別化資料）";
}
