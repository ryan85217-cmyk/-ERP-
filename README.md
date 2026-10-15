# 智慧門市 ERP — MVP (Phase 1)

零售門市 ERP / 智慧門市管理系統第一階段 MVP。

**技術架構**：Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui 風格元件 · PostgreSQL · Prisma ORM · Recharts

---

## 快速開始

需求：Node.js 20+、PostgreSQL 14+（或 Docker）

```bash
# 1. 安裝套件（postinstall 會自動執行 prisma generate）
npm install

# 2. 啟動 PostgreSQL（擇一）
npm run db:start                # 內建 embedded-postgres，免安裝（另開一個終端機保持執行）
docker compose up -d            # 或使用專案內 docker-compose.yml
# 或使用本機 PostgreSQL，自行建立 retail_erp 資料庫

# 3. 設定連線字串
cp .env.example .env            # 視需要修改 DATABASE_URL

# 4. 建立資料表 + 匯入假資料
npm run setup                   # = prisma migrate deploy && prisma db seed

# 5. 啟動
npm run dev                     # http://localhost:3000
```

其他指令：

| 指令 | 說明 |
| --- | --- |
| `npm run typecheck` | TypeScript 型別檢查 (`tsc --noEmit`) |
| `npm run build` | `prisma generate && next build` |
| `npm run lint` | ESLint |
| `npm run db:seed` | 重新產生假資料（會先清空資料表） |
| `npm run db:reset` | 重置資料庫並重新 migrate + seed |

> 假資料以「執行 seed 的當下」為基準產生約 2 年的訂單，所以 Dashboard 的今日 / 本週 / 本月數字永遠有資料。若隔了幾天再展示，重新執行 `npm run db:seed` 即可。

---

## Seed 假資料內容

| 資料 | 數量 |
| --- | --- |
| 商品分類 | 8（生鮮蔬果、肉品海鮮、乳製品蛋品、冷凍食品、米麵雜糧、調味醬料、零食點心、飲品） |
| 廠商 | 8 |
| 商品（含成分、產地、食譜、料理方式、英日文名稱） | 52（2 項已下架） |
| 儲位 | 54（A–H 各 6 格 + 後場 R 區，1 格停用） |
| 會員 | 900 |
| 訂單 / 訂單明細 | ~23,000 / ~76,000（約 760 天） |
| 盤點任務 | 7（5 筆已完成、1 筆暫停中、1 筆盤點中） |

---

## 多語系（繁中 / 日文 / 英文）

- 右上角語言選單切換，語系存在 `locale` cookie，網址不變；`<html lang>`、日期格式、CSV 匯出欄位同步切換
- 字典位於 `src/i18n/messages/*.ts`，每個模組一個 namespace，以 `defineMessages(zh, { ja, en })` 宣告 —— **繁中為來源，日／英缺少或多出 key 會直接造成 TypeScript 編譯錯誤**
- Server component / action：`const { t, locale } = await getI18n()`；Client component：`const { t } = useI18n()`；插值用 `fmt(t.x.y, { n })`
- 商品與分類有 `nameEn` / `nameJa` 欄位（商品表單可編輯），以 `localName(locale, row)` 取用，未填時回退中文名稱
- 會員姓名、廠商名稱、成分、食譜等業務資料維持原始語言

## 儲位系統（Storage Locations）

- `StorageLocation`：區域 / 走道 / 層 → 代碼自動產生（例 `B-02-03`），含類型（常溫、展示、冷藏、冷凍、後場）、容量、盤點動線順序、啟用狀態
- 每項商品可指定一個主要儲位；`/locations` 有樓面配置圖（依使用率著色）、儲位 CRUD、儲位明細（存放商品、使用率、盤點紀錄）
- 盤點：可依「儲位區」或「商品分類」建立盤點；盤點表依儲位動線排序並分組，提供儲位進度列與「下一個未盤儲位」快速跳轉；每筆盤點明細記錄盤點當下的儲位快照
- 盤差分析新增「各儲位區盤差 / 準確率」；商品、庫存、Dashboard 皆顯示儲位資訊（含超出容量儲位）

## Google Sheets 串接（POS 即時庫存匯入）

把 POS「門市即時庫存」報表（POS0021 格式：大類、中類、品號、品名、單位、單價、數量、儲位）從 Google Sheets 匯入 ERP。

1. 在 Google Cloud 建立服務帳戶並下載金鑰 JSON，**放在專案資料夾以外**，絕不 commit。
2. 把試算表分享給服務帳戶的 `client_email`（讀取用「檢視者」即可）。
3. 在 `.env` 設定：
   ```
   GOOGLE_SERVICE_ACCOUNT_FILE="/path/outside/repo/key.json"
   POS_STOCK_SHEET="<試算表 ID 或網址>"
   ```
4. 執行：

| 指令 | 做什麼 | 資料去哪 |
|---|---|---|
| `npm run sheets:import -- real` | 用真實商品、分類、儲位、庫存重建**本機**資料庫（會員與訂單仍為模擬） | 只限本機；`DATABASE_URL` 不是 localhost 會拒絕執行，快取在 git 忽略的 `.local-data/` |
| `npm run sheets:import -- anonymize` | 依分類分層抽樣（預設 240 項），重新編 SKU、價格 ±12% 擾動、移除庫存數量與門市資訊 | 寫入 `prisma/data/demo-catalog.json`，可 commit 供線上展示 |

儲位代碼轉換：POS 的 `S1` → `S-01-01`、`Z1A` → `Z-01-01`（字母代表層）、`S` → `S-00-01`；以蔬果為主的區域設為冷藏。

線上部署（`npm run start:prod`）會比對 `demo-catalog.json` 的指紋，內容有變動時自動重建一次展示資料；`SEED_CATALOG=builtin` 可改回原本 52 項示範商品，`SEED_IF_EMPTY=false` 則完全不動資料。

## 自動化（n8n）

ERP 提供以 `INTEGRATION_TOKEN` 保護的 API（`Authorization: Bearer …`），每支都附上排好版的信件 `subject` / `html`，n8n 只需「取資料 → 寄信」：

| 流程（`n8n/workflows/`） | 觸發 | ERP 端 |
|---|---|---|
| 每日低庫存通知 | 每天 08:00，有低庫存才寄 | `GET /api/integrations/low-stock` |
| 每日營運摘要 | 每天 07:30 | `GET /api/integrations/daily-summary?date=YYYY-MM-DD` |
| 盤點完成通知 | 盤點結案時 ERP 主動 POST 到 `N8N_COUNT_COMPLETED_WEBHOOK` | `GET /api/integrations/counts/:id` 同內容 |
| 新 POS 報表提醒 | 每天 09:00，雲端資料夾 24 小時內有新報表才寄 | `GET /api/integrations/new-reports?hours=24`（需 `POS_REPORTS_FOLDER`） |

每個排程流程另有「手動執行」webhook（`/webhook/erp-run-…`，同樣要帶 token）。新報表只寄提醒：真實資料一律在本機匯入。

重建流程：在 n8n 先建好「ERP API token」（Header Auth，`Authorization: Bearer <INTEGRATION_TOKEN>`）與 SMTP 憑證，於 `.env.zeabur.local` 設 `N8N_URL`、`N8N_API_KEY`，再執行 `python3 n8n/build_workflows.py`。

## 功能模組

### 1. 商品資訊管理
- `/products` 商品列表：關鍵字（名稱 / SKU）、分類、廠商、上架狀態篩選，分頁
- `/products/new`、`/products/[id]/edit` 新增 / 修改（含初始庫存與安全庫存）
- `/products/[id]` 商品詳細：庫存狀態、近 30 天銷量圖、料理資訊、盤點紀錄、上下架、刪除
- `/suppliers` 廠商 CRUD（刪除廠商時，商品的廠商欄位自動設為未指定）

### 2. 盤點 Inventory Count
- `/inventory-count/new` 開始盤點：選擇日期、操作人員、盤點範圍（分類），建立時擷取 POS 庫存作為基準
- `/inventory-count/[id]` 盤點作業：輸入實盤數量、盤差即時計算、盤差原因、備註
  - **儲存進度 / 暫停 / 繼續 / 完成**，狀態：`DRAFT → IN_PROGRESS ⇄ PAUSED → COMPLETED`
  - 完成時可選擇以實盤數量更新「門市實際庫存」
  - **盤差 = POS 原始庫存 − 手動實際庫存**
- `/inventory-count` 盤點進度、`/inventory-count/history` 盤點紀錄、`/inventory-count/analysis` 盤差分析（排行榜、原因分布、盤損金額）

### 3. 商品庫存
- `/inventory/store` 門市庫存、`/inventory/pos` POS 庫存、`/inventory/warehouse` 物流庫存、`/inventory/alerts` 庫存異常
- 搜尋、分類與狀態篩選（庫存不足 / POS 不一致 / 高庫存 / 正常）
- 快速動作：同步 POS（模擬）、從物流中心補貨、以門市實盤校正 POS

### 4. 會員 CRM
- `/members` 所有會員（搜尋、分類篩選、排序）、`/members/new-members`、`/members/returning`
- `/members/[id]` 會員詳細：消費紀錄、常購商品、近 12 個月消費
- `/members/remarketing` 再行銷分群：新會員、回購會員、高價值會員、90 天未消費，可匯出 CSV（不實際發送）
- 「重新計算分類」會依訂單重算消費統計與分類

**會員自動分類規則**（`src/lib/segments.ts`）

| 分類 | 規則 |
| --- | --- |
| NEW 新會員 | 加入 30 天內，或僅消費 1 次 |
| ACTIVE 活躍會員 | 近 30 天有消費且累計 ≥ 6 次 |
| RETURNING 回購會員 | 累計 ≥ 2 次且 90 天內有消費 |
| INACTIVE 長時間未消費 | 超過 90 天未消費 |

### 5. 銷售分析
- `/` Dashboard：今日 / 本週 / 本月 / 本年營收（含同期比較）、訂單數、客單價、新會員、回購會員；**Today / 7 Days / 30 Days / This Year** 切換
- 圖表：每日營收、每週、每月、年度營收、商品銷售排行榜、分類占比、新客 / 舊客比例、回購率、庫存盤差排行榜，以及庫存異常小工具
- `/analytics/daily|weekly|monthly|yearly` 日報 / 週報 / 月報（含 YoY）/ 年報

---

## 專案結構

```
prisma/
  schema.prisma              資料模型
  migrations/                SQL migration
  seed.ts / seed-data.ts     假資料（seed-data 為純函式、可重現）
src/
  app/                       App Router 頁面（Server Components + Server Actions）
  components/ui/             shadcn/ui 風格基礎元件（Button、Card、Table、Badge、Dialog…）
  components/shared/         共用元件（PageHeader、StatCard、Pagination、ConfirmDelete…）
  components/charts/         Recharts 圖表元件
  components/layout/         Sidebar、Topbar、行動版選單
  lib/actions/               Server Actions（CRUD、盤點流程、會員分類）
  lib/analytics.ts           銷售分析查詢（PostgreSQL，Asia/Taipei 時區分桶）
```

## 設計說明
- 金額以整數新台幣儲存（`Int`）。
- 訂單明細保存商品名稱與分類快照，商品修改或刪除後歷史報表不受影響。
- 時間以 UTC 儲存，報表一律以 Asia/Taipei 時區計算日 / 週（週一起）/ 月 / 年。
