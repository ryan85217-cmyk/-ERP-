/**
 * Export ERP reports to Google Sheets.
 *
 *   npm run sheets:export
 *
 * Needs GOOGLE_SERVICE_ACCOUNT_FILE (or _JSON) and SHEETS_EXPORT_SHEET (id or URL) in .env;
 * the spreadsheet must be shared with the service account as Editor.
 */
try {
  process.loadEnvFile(".env");
} catch {
  // no .env: rely on the real environment
}

async function main() {
  const { exportSheet, exportSheetUrl, exportSourceLabel } = await import("../src/lib/google/export-config");
  const { exportReportsToSheet } = await import("../src/lib/google/export-report");
  const { prisma } = await import("../src/lib/prisma");
  const sheet = exportSheet();
  if (!sheet) throw new Error("Set SHEETS_EXPORT_SHEET and GOOGLE_SERVICE_ACCOUNT_FILE (or _JSON) in .env");
  try {
    console.log(`Exporting reports (${exportSourceLabel()})…`);
    const res = await exportReportsToSheet(sheet, exportSourceLabel());
    for (const tab of res.tabs) console.log(`  ${tab.title}: ${tab.rows} rows`);
    console.log(`Done → ${exportSheetUrl(sheet)}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
