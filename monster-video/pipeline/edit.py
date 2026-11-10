"""步驟 5b–8：卡點剪接計畫、調色、顆粒、字幕、字卡、合成。"""
import os
import sys

from PIL import ImageFont

from . import lut, titlecard
from .common import ffmpeg, probe


# ---------- 剪接計畫 ----------

def snap(t, beats, downbeats, lo, hi):
    """把時間吸到 (lo, hi) 之間最近的拍點；小節第一拍較優先。"""
    cands = [b for b in beats if lo < b < hi]
    if not cands:
        return None
    down = set(downbeats)
    return min(cands, key=lambda b: abs(b - t) * (0.6 if b in down else 1.0))


def allocate(shots, start, end, beats, downbeats):
    """把一組鏡頭依原始長度比例分配到 [start, end]，中間的切點都落在拍子上。"""
    total = sum(s["dur"] for s in shots)
    bounds, acc = [start], 0.0
    for i, s in enumerate(shots[:-1]):
        acc += s["dur"]
        ideal = start + (end - start) * acc / total
        remaining = len(shots) - 1 - i
        beat_len = (end - start) / max(len([b for b in beats if start <= b <= end]), 1)
        cut = snap(ideal, beats, downbeats, bounds[-1] + beat_len * 0.9,
                   end - remaining * beat_len * 0.9)
        if cut is None:
            sys.exit(f"{start:.2f}s–{end:.2f}s 之間的拍子不夠放 {len(shots)} 個鏡頭。")
        bounds.append(cut)
    bounds.append(end)
    return list(zip(bounds[:-1], bounds[1:]))


def plan(proj):
    e = proj["edit"]
    beats_data = proj.load("beats.json")
    scenes = {s["id"]: s for s in proj.load("scenes.json")}
    beats, downbeats = beats_data["beats"], beats_data["downbeats"]
    fps = proj["format"]["fps"]

    marks = {}
    for key in ("silence_start", "drop", "bass_out"):
        value = e["overrides"].get(key)
        marks[key] = beats_data[key] if value is None else value
        if marks[key] is None:
            sys.exit(f"音樂分析沒找到 {key}，請在 project.json 的 edit.overrides 手動指定（秒，以取用段落起點為 0）。")
    silence, drop, bass_out = marks["silence_start"], marks["drop"], marks["bass_out"]
    if not 0 < silence < drop < bass_out:
        sys.exit(f"時間點順序不合理：靜音 {silence}、重拍 {drop}、低音消失 {bass_out}")

    order = e["order"]
    if sorted(order) != sorted(scenes):
        sys.exit("edit.order 必須剛好包含所有鏡頭各一次。")
    i_sil, i_drop = order.index(e["silence_shot"]), order.index(e["drop_shot"])
    if i_drop != i_sil + 1:
        sys.exit("drop_shot 必須緊接在 silence_shot 之後。")

    # 靜音鏡頭從靜音前最後一拍切入，重拍進來的瞬間切走；結尾收在低音消失後的第一拍
    sil_in = max([b for b in beats if b <= silence + 0.05] or [silence])
    end = min([b for b in beats if b >= bass_out - 0.05] or [bass_out])
    pre = [scenes[i] for i in order[:i_sil]]
    post = [scenes[i] for i in order[i_drop:]]
    slots = []
    if pre:
        slots += allocate(pre, 0.0, sil_in, beats, downbeats)
    else:
        sil_in = 0.0
    slots.append((sil_in, drop))
    slots += allocate(post, drop, end, beats, downbeats)

    # 量化到影格，算出每個鏡頭的變速
    frames = [round(a * fps) for a, _ in slots] + [round(slots[-1][1] * fps)]
    shots = []
    for k, sid in enumerate(order):
        src = scenes[sid]
        n = frames[k + 1] - frames[k]
        slot = n / fps
        speed = src["dur"] / slot
        use, freeze, note = src["dur"], 0.0, ""
        if speed > e["speed_max"]:
            speed, use = e["speed_max"], slot * e["speed_max"]
            note = f"素材過長，只取前 {use:.2f}s"
        elif speed < e["speed_min"]:
            speed = e["speed_min"]
            freeze = slot - src["dur"] / speed
            note = f"素材過短，尾端定格 {freeze:.2f}s"
        shots.append({"id": sid, "clip": src["clip"], "in": src["in"], "use": round(use, 4),
                      "start": frames[k] / fps, "frames": n, "speed": round(speed, 4),
                      "freeze": round(freeze, 3), "note": note})

    video_end = frames[-1] / fps
    wb_frames = round(e["white_to_black"] * fps)
    tail = max(beats_data["duration"] - video_end, e["white_to_black"] + e["title_min"])
    title_frames = round(tail * fps) - wb_frames
    result = {
        "fps": fps, "marks": marks, "shots": shots,
        "white_to_black_frames": wb_frames, "title_frames": title_frames,
        "total": (frames[-1] + wb_frames + title_frames) / fps,
        "music_start": beats_data["music_start"], "music_duration": beats_data["duration"],
    }
    proj.save("plan.json", result)

    print(f"  {'鏡頭':<14}{'起點':>8}{'長度':>8}{'變速':>8}  備註")
    for s in shots:
        tag = "  ← 靜音段" if s["id"] == e["silence_shot"] else \
              "  ← 白閃＋重拍" if s["id"] == e["drop_shot"] else ""
        print(f"  {s['id']:<16}{s['start']:>8.2f}s{s['frames'] / fps:>7.2f}s{s['speed']:>7.2f}x  {s['note']}{tag}")
    print(f"  白光轉黑 {video_end:.2f}s → 片名字卡 {video_end + wb_frames / fps:.2f}s → 結束 {result['total']:.2f}s")
    return result


# ---------- 字幕 ----------

def ass_time(t):
    cs = max(round(t * 100), 0)
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_subtitles(proj, pl, size):
    w, h = size
    sub = proj["subtitles"]
    family = ImageFont.truetype(proj["font_file"], 20).getname()[0]
    starts = {s["id"]: (s["start"], s["frames"] / pl["fps"]) for s in pl["shots"]}
    scale = h / 1080
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Narr,{family},{round(sub['size'] * scale)},&H00D4E2E8,&H00D4E2E8,&HA0000000,&H80000000,0,0,0,0,100,100,{round(6 * scale)},0,1,{1.2 * scale:.1f},{1.5 * scale:.1f},2,40,40,{round(64 * scale)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    lines = []
    for line in sub["lines"]:
        if line["shot"] not in starts:
            sys.exit(f"字幕指到不存在的鏡頭：{line['shot']}")
        start, dur = starts[line["shot"]]
        a = start + min(0.35, dur * 0.15)
        b = start + dur - min(0.25, dur * 0.1)
        lines.append(f"Dialogue: 0,{ass_time(a)},{ass_time(b)},Narr,,0,0,0,,{{\\fad(250,250)}}{line['text']}")
    path = os.path.join(proj.work, "subtitles.ass")
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "\n".join(lines) + "\n")
    return path


# ---------- 合成 ----------

def esc(path):
    """跳脫 ffmpeg 濾鏡參數中的路徑。"""
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def render(proj, preview=False):
    pl = proj.load("plan.json")
    e, g, fmt = proj["edit"], proj["grade"], proj["format"]
    fps = pl["fps"]
    w, h = fmt["width"], fmt["height"]
    if preview:
        w, h = w // 2 // 2 * 2, h // 2 // 2 * 2
    size = (w, h)

    title_png = titlecard.render(proj, size)
    ass = write_subtitles(proj, pl, size)
    os.makedirs(proj.out, exist_ok=True)
    out = os.path.join(proj.out, "preview.mp4" if preview else "final.mp4")

    inputs, chains, labels = [], [], []
    for k, s in enumerate(pl["shots"]):
        inputs += ["-ss", f"{s['in']:.4f}", "-t", f"{s['use']:.4f}", "-i", s["clip"]]
        dur = s["frames"] / fps
        f = [f"setpts=(PTS-STARTPTS)/{s['speed']}"]
        if e["slowmo"] == "mci" and s["speed"] < 0.9:
            f.append(f"minterpolate=fps={fps}:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
        f += [f"fps={fps}",
              f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos",
              f"crop={w}:{h}", "setsar=1", "format=yuv444p",
              f"tpad=stop_mode=clone:stop_duration={s['freeze'] + 0.5:.3f}",
              f"trim=end_frame={s['frames']}", "setpts=PTS-STARTPTS"]
        look = g["per_shot"].get(s["id"])
        if look == "sky_to_dust":
            f.append(f"lut3d=file='{esc(lut.sky_to_dust(proj))}':interp=tetrahedral")
        elif look:
            f.append(look)
        f += [g["base"], g["vignette"]]
        if s["id"] == e["silence_shot"]:          # 重拍前兩格先衝白
            d = 2 / fps
            f.append(f"fade=t=out:st={dur - d:.4f}:d={d:.4f}:c=white")
        if s["id"] == e["drop_shot"]:             # 白閃切入
            f.append(f"fade=t=in:st=0:d={e['flash_in']}:c=white")
        if k == len(pl["shots"]) - 1:             # 低音消失：畫面衝白
            d = min(e["white_out"], dur / 2)
            f.append(f"fade=t=out:st={dur - d:.4f}:d={d:.4f}:c=white")
        chains.append(f"[{k}:v]{','.join(f)}[v{k}]")
        labels.append(f"[v{k}]")

    n = len(pl["shots"])
    wb = pl["white_to_black_frames"] / fps
    tt = pl["title_frames"] / fps
    inputs += ["-loop", "1", "-framerate", str(fps), "-t", f"{tt:.4f}", "-i", title_png]
    inputs += ["-ss", str(pl["music_start"]), "-i", proj.p(proj["music"]["file"])]
    chains.append(f"color=c=white:s={w}x{h}:r={fps}:d={wb:.4f},format=yuv444p,"
                  f"fade=t=out:st=0:d={wb:.4f}:c=black[wb]")
    chains.append(f"[{n}:v]fps={fps},scale={w}:{h},setsar=1,format=yuv444p,"
                  f"trim=end_frame={pl['title_frames']},"
                  f"fade=t=in:st=0:d=0.8,fade=t=out:st={tt - 1.0:.4f}:d=1.0[tc]")
    chains.append(f"{''.join(labels)}[wb][tc]concat=n={n + 2}:v=1:a=0,"
                  f"subtitles='{esc(ass)}':fontsdir='{esc(os.path.dirname(proj['font_file']))}',"
                  f"{g['grain']},format=yuv420p[v]")
    total = pl["total"]
    chains.append(f"[{n + 1}:a]apad,atrim=0:{total:.4f},afade=t=in:st=0:d=0.05,"
                  f"afade=t=out:st={total - 1.5:.4f}:d=1.5[a]")

    codec = ["-c:v", "libx264", "-preset", "veryfast" if preview else "slow",
             "-crf", "23" if preview else "16", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart"]
    ffmpeg(*inputs, "-filter_complex", ";".join(chains), "-map", "[v]", "-map", "[a]",
           *codec, "-t", f"{total:.4f}", out)
    dur, ow, oh, ofps = probe(out)
    print(f"  輸出 {os.path.relpath(out, proj.root)}：{ow}x{oh} {ofps:g}fps {dur:.2f}s")
    return out
