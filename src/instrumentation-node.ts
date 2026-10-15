/** Node-only part of src/instrumentation.ts (kept separate so the Edge bundle never sees google-auth-library). */
export async function startDailySheetsExport() {
  const at = process.env.SHEETS_EXPORT_DAILY_AT?.match(/^(\d{1,2}):(\d{2})$/);
  if (!at) return;
  const { exportSheet, exportSourceLabel } = await import("@/lib/google/export-config");
  const sheet = exportSheet();
  if (!sheet) {
    console.warn("[sheets] SHEETS_EXPORT_DAILY_AT is set but Google Sheets export is not configured");
    return;
  }
  const { exportReportsToSheet } = await import("@/lib/google/export-report");
  const [hour, minute] = [Number(at[1]), Number(at[2])];

  const msUntilNext = () => {
    const TZ = 8 * 3_600_000;
    const nowLocal = Date.now() + TZ;
    const d = new Date(nowLocal);
    let next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute);
    if (next <= nowLocal) next += 86_400_000;
    return next - nowLocal;
  };
  const schedule = () => {
    setTimeout(async () => {
      try {
        const res = await exportReportsToSheet(sheet, exportSourceLabel());
        console.log(`[sheets] daily export done: ${res.tabs.map((t) => `${t.title} ${t.rows}`).join(", ")}`);
      } catch (e) {
        console.error("[sheets] daily export failed", e);
      }
      schedule();
    }, msUntilNext());
  };
  schedule();
  console.log(`[sheets] daily export scheduled at ${at[0]} Asia/Taipei`);
}
