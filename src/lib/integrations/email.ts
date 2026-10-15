/** Tiny helpers for the e-mail bodies the integration endpoints hand to n8n. */

export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const money = (n: number) => `NT$${Math.round(n).toLocaleString("en-US")}`;
export const num = (n: number) => Math.round(n).toLocaleString("en-US");

export function pct(cur: number, prev: number) {
  if (!prev) return "—";
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}%`;
}

export function table(headers: string[], rows: (string | number)[][], alignRight: number[] = []) {
  const th = headers
    .map((h, i) => `<th style="text-align:${alignRight.includes(i) ? "right" : "left"};padding:6px 10px;background:#e8f5ec;border-bottom:1px solid #cfe3d6">${esc(h)}</th>`)
    .join("");
  const tr = rows
    .map(
      (r) =>
        `<tr>${r.map((c, i) => `<td style="text-align:${alignRight.includes(i) ? "right" : "left"};padding:6px 10px;border-bottom:1px solid #eee">${esc(c)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-size:14px;margin:8px 0 16px">${`<thead><tr>${th}</tr></thead>`}<tbody>${tr}</tbody></table>`;
}

export function layout(title: string, body: string, link?: { href: string; label: string }) {
  return `<div style="font-family:-apple-system,'PingFang TC','Noto Sans TC',sans-serif;color:#1f2937;max-width:720px">
<h2 style="color:#1f7a4a;margin:0 0 12px">${esc(title)}</h2>
${body}
${link ? `<p style="margin-top:20px"><a href="${esc(link.href)}" style="color:#1f7a4a">${esc(link.label)} →</a></p>` : ""}
<p style="color:#9ca3af;font-size:12px;margin-top:24px">智慧門市 ERP 自動通知</p></div>`;
}

/** Base URL for links in e-mails (APP_URL, e.g. https://smart-store-erp.zeabur.app). */
export const appUrl = (path = "/") => `${(process.env.APP_URL ?? "").replace(/\/$/, "")}${path}`;
