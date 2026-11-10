# 怪獸短片製作流程

把「6 支 Kling 怪獸影片 → Seedance 兩段 15 秒 → 卡點剪接成片」整條流程寫成可重跑的工具。
企劃、分鏡、提示詞、字幕、片名都集中在 `project.json`，改完重跑即可。

需要：FFmpeg、Python 3（`pip install numpy scipy pillow`）、即夢 CLI（只有生成那一步用到）。

## 素材放哪裡

```
monster-video/input/
  monsters/01_goddess.mp4 … 06_monster6.mp4   6 支怪獸影片（檔名對應 project.json 的 refs）
  taipei101.jpg                                台北 101 照片
  music.mp3                                    Suno 配樂（整首）
  seedance_part1.mp4, seedance_part2.mp4       生成後的兩段 15 秒影片
```

`input/`、`work/`、`output/` 都不進版控。

## 步驟

在 `monster-video/` 目錄下執行：

| 指令 | 做什麼 |
| --- | --- |
| `python3 monster.py refs` | 每支怪獸影片取樣 16 格，挑最銳利的一格當定格，加上 101 照片，共 7 張 → `work/refs/` |
| `python3 monster.py prompts` | 由分鏡組出兩段提示詞 → `work/prompts/part1.txt`、`part2.txt` |
| `python3 monster.py generate` | 印出即夢 CLI 指令與預估點數（不送出）；加 `--run` 才實際生成 |
| `python3 monster.py beats` | 分析配樂 2:17 之後：每一拍、小節重拍、靜音後重拍進來、低音消失 → `work/beats.json` |
| `python3 monster.py scenes` | 偵測兩段生成影片的實際切點 → `work/scenes.json` |
| `python3 monster.py plan` | 鏡頭重排、變速，讓每個切點落在拍子上 → `work/plan.json` |
| `python3 monster.py render` | 調色、暗角、顆粒、字幕、片名字卡、配樂合成 → `output/final.mp4` |
| `python3 monster.py post` | `beats → scenes → plan → render` 一次跑完；加 `--preview` 出半解析度快速版 |

## 各步驟的做法

- **分鏡**：7 個鏡頭拆成上下兩段（4 + 3），每段掛 4 張參考圖（101 加 3 隻怪獸），每隻怪獸只佔一個鏡頭；程式會檢查這兩條規則。
- **生成**：Seedance 2.5「多模態參考」、21:9、1080p、15 秒，每段 960 點，兩段共 1,920 點。
- **音樂分析**（NumPy / SciPy）：頻譜通量算起音 → 自相關估速度（以 99 BPM 為提示）→ 動態規劃追蹤每一拍 → 低頻起音決定小節重拍。
  「靜音後重拍進來」取靜音 ≥ 0.3 秒且重新進來時能量最強的那一段；「低音消失」取 150 Hz 以下能量最後存在的時間。
- **卡點剪接**：
  - 靜音段放 `silence_shot`（地下道異獸），從靜音前最後一拍切入。
  - 重拍進來的那一格白閃切到 `drop_shot`（巨角獸咆哮）。
  - 其餘鏡頭依原始長度比例分配，切點吸附到最近的拍子（小節第一拍優先），再用變速填滿。
  - 低音消失後的第一拍畫面衝白，白光轉黑，接片名字卡到曲終。
- **調色**：低飽和、陰影偏青、亮部偏灰黃、S 曲線加反差、暗角、底片顆粒。
  女神鏡頭另外套一張程式產生的 3D LUT，只把青～藍色相壓成沙塵色，其他顏色不動。
- **字幕與字卡**：5 句旁白綁在鏡頭上，跟著剪接時間走，用 libass 燒進畫面；片名字卡用 Pillow 繪製，不交給 AI 生成。

## 要自己確認的地方

- `project.json` 裡三隻怪獸暫名為「怪獸四／五／六」，分鏡描述是通用寫法；請依實際素材改名、改描述、改檔名。
- 5 句字幕與片名「巨獸之城」是暫定文案。
- `generation.cli` 是即夢 CLI 的指令樣板，旗標名稱請先用 `dreamina multimodal2video -h` 核對再加 `--run`。
- 字型預設文泉驛正黑；想換成思源宋體等，改 `font_file` 即可（字幕與字卡共用）。
- 音樂分析若抓錯位置，可在 `edit.overrides` 直接填秒數（以 2:17 為 0）。
- 鏡頭變速超出 0.5x–2x 時會截短或尾端定格，`plan` 會在備註欄標出來；慢動作想更滑順可把 `edit.slowmo` 改成 `"mci"`（動態補幀，較慢）。

## 自我測試

沒有素材也能驗證流程：

```
python3 selftest/make_fixtures.py
python3 monster.py post --preview --project selftest/project.json
```

會產生合成的 99 BPM 配樂（含靜音、重拍、低音消失）與兩段故意偏離分鏡秒數的假影片，
正確答案寫在 `selftest/fixtures/truth.json`，可與 `selftest/work/beats.json`、`scenes.json` 對照。
