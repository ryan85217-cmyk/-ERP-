/**
 * Minimal Google Sheets client authenticated as a service account.
 *
 * Credentials come from the environment, never from the repo:
 * - GOOGLE_SERVICE_ACCOUNT_FILE  path to the key JSON (local development)
 * - GOOGLE_SERVICE_ACCOUNT_JSON  the key JSON itself, raw or base64 (hosted, e.g. Zeabur)
 *
 * The spreadsheet must be shared with the service account's client_email
 * (Viewer to read, Editor to write).
 */
import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";

// drive.readonly lets the POS-report watcher list the shared report folder
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.readonly"];
const API = "https://sheets.googleapis.com/v4/spreadsheets";

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

function loadKey(): ServiceAccountKey {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const file = process.env.GOOGLE_SERVICE_ACCOUNT_FILE?.trim();
  let raw: string;
  if (inline) raw = inline.startsWith("{") ? inline : Buffer.from(inline, "base64").toString("utf8");
  else if (file) raw = readFileSync(file, "utf8");
  else throw new Error("Google Sheets is not configured: set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_SERVICE_ACCOUNT_JSON");
  const key = JSON.parse(raw) as Partial<ServiceAccountKey>;
  if (!key.client_email || !key.private_key) throw new Error("Service account key is missing client_email / private_key");
  return { client_email: key.client_email, private_key: key.private_key };
}

export function isSheetsConfigured() {
  return !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE);
}

let clientPromise: ReturnType<GoogleAuth["getClient"]> | null = null;
function client() {
  clientPromise ??= new GoogleAuth({ credentials: loadKey(), scopes: SCOPES }).getClient();
  return clientPromise;
}

/** The email to share spreadsheets with. */
export function serviceAccountEmail() {
  return loadKey().client_email;
}

/** Accepts a bare spreadsheet id or a full docs.google.com URL. */
export function spreadsheetId(idOrUrl: string) {
  return idOrUrl.match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] ?? idOrUrl.trim();
}

export async function getSheetTitles(idOrUrl: string): Promise<string[]> {
  const c = await client();
  const res = await c.request<{ sheets: { properties: { title: string } }[] }>({
    url: `${API}/${spreadsheetId(idOrUrl)}`,
    params: { fields: "sheets.properties.title" },
  });
  return res.data.sheets.map((s) => s.properties.title);
}

/** Reads a range (A1 notation, e.g. "POS0021!A1:L") as formatted strings. */
export async function readRange(idOrUrl: string, range: string): Promise<string[][]> {
  const c = await client();
  const res = await c.request<{ values?: string[][] }>({
    url: `${API}/${spreadsheetId(idOrUrl)}/values/${encodeURIComponent(range)}`,
  });
  return res.data.values ?? [];
}

/** Replaces the contents of a tab (creating it if needed) with the given rows; row 1 is styled as a frozen header. */
export async function writeSheet(idOrUrl: string, title: string, rows: (string | number | null)[][]) {
  const c = await client();
  const id = spreadsheetId(idOrUrl);
  const sheetIdOf = async () => {
    const res = await c.request<{ sheets: { properties: { title: string; sheetId: number } }[] }>({
      url: `${API}/${id}`,
      params: { fields: "sheets.properties(title,sheetId)" },
    });
    return res.data.sheets.find((s) => s.properties.title === title)?.properties.sheetId;
  };
  let sheetId = await sheetIdOf();
  if (sheetId === undefined) {
    await c.request({
      url: `${API}/${id}:batchUpdate`,
      method: "POST",
      data: { requests: [{ addSheet: { properties: { title } } }] },
    });
    sheetId = (await sheetIdOf())!;
  }
  const range = `'${title.replace(/'/g, "''")}'`;
  await c.request({ url: `${API}/${id}/values/${encodeURIComponent(range)}:clear`, method: "POST" });
  await c.request({
    url: `${API}/${id}/values/${encodeURIComponent(`${range}!A1`)}`,
    method: "PUT",
    params: { valueInputOption: "USER_ENTERED" },
    data: { values: rows.map((r) => r.map((v) => v ?? "")) },
  });
  await c.request({
    url: `${API}/${id}:batchUpdate`,
    method: "POST",
    data: {
      requests: [
        { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.91, green: 0.96, blue: 0.92 } } },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
          },
        },
        { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: Math.max(1, rows[0]?.length ?? 1) } } },
      ],
    },
  });
}

/** Deletes the untouched "Sheet1" / "工作表1" tab a new spreadsheet starts with, once other tabs exist. */
export async function removeEmptyDefaultSheets(idOrUrl: string) {
  const c = await client();
  const id = spreadsheetId(idOrUrl);
  const res = await c.request<{ sheets: { properties: { title: string; sheetId: number } }[] }>({
    url: `${API}/${id}`,
    params: { fields: "sheets.properties(title,sheetId)" },
  });
  const defaults = res.data.sheets.filter((s) => /^(Sheet|工作表|シート)\s?1$/.test(s.properties.title));
  if (!defaults.length || defaults.length === res.data.sheets.length) return;
  for (const s of defaults) {
    const v = await c.request<{ values?: unknown[][] }>({
      url: `${API}/${id}/values/${encodeURIComponent(`'${s.properties.title}'`)}`,
    });
    if (v.data.values?.length) continue;
    await c.request({
      url: `${API}/${id}:batchUpdate`,
      method: "POST",
      data: { requests: [{ deleteSheet: { sheetId: s.properties.sheetId } }] },
    });
  }
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  webViewLink: string;
}

/** Files in a Drive folder modified after `since` (newest first); the folder must be shared with the service account. */
export async function listFolderFiles(folderId: string, since: Date): Promise<DriveFile[]> {
  const c = await client();
  const res = await c.request<{ files: DriveFile[] }>({
    url: "https://www.googleapis.com/drive/v3/files",
    params: {
      q: `'${folderId.replace(/'/g, "")}' in parents and trashed = false and modifiedTime > '${since.toISOString()}'`,
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    },
  });
  return res.data.files ?? [];
}
