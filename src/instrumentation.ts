/**
 * Next.js startup hook. When SHEETS_EXPORT_DAILY_AT is set (e.g. "07:00", Asia/Taipei),
 * exports the reports to Google Sheets once a day while the server is running.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startDailySheetsExport } = await import("./instrumentation-node");
    await startDailySheetsExport();
  }
}
