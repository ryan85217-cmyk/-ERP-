#!/usr/bin/env python3
"""產生合成素材（假怪獸影片、假 101 照片、假生成片段、99 BPM 假配樂），用來驗證整條流程。

用法：python3 selftest/make_fixtures.py && python3 monster.py post --project selftest/project.json
"""
import json
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, "fixtures")
SR = 44100
BPM = 99.0
START = 137.0
# 相對於取用段落起點的「正確答案」（以拍為單位）
SILENCE_BEAT, DROP_BEAT, BASS_OUT_BEAT, TOTAL = 24, 28, 64, 190.0


def ff(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def music(path):
    rng = np.random.default_rng(7)
    beat = 60 / BPM
    first = int(np.ceil(START / beat))            # 段落內第一拍
    t0 = first * beat - START
    truth = {"first_beat": t0, "silence_start": t0 + SILENCE_BEAT * beat,
             "drop": t0 + DROP_BEAT * beat, "bass_out": t0 + BASS_OUT_BEAT * beat}
    n = int(TOTAL * SR)
    y = np.zeros(n)
    t = np.arange(n) / SR

    def add(at, sig):
        i = int(at * SR)
        j = min(i + len(sig), n)
        y[i:j] += sig[:j - i]

    kt = np.arange(int(0.35 * SR)) / SR
    kick = np.sin(2 * np.pi * (45 * kt + 60 * (1 - np.exp(-kt * 30)) / 30)) * np.exp(-kt * 9)
    hat = rng.standard_normal(int(0.05 * SR)) * np.exp(-np.arange(int(0.05 * SR)) / SR * 80) * 0.15
    crash = rng.standard_normal(int(1.5 * SR)) * np.exp(-np.arange(int(1.5 * SR)) / SR * 3) * 0.4

    sil_a = START + truth["silence_start"]
    sil_b = START + truth["drop"]
    bass_end = START + truth["bass_out"]
    pad = 0.08 * (np.sin(2 * np.pi * 220 * t) + np.sin(2 * np.pi * 330 * t) + np.sin(2 * np.pi * 277 * t))
    pad[(t >= sil_a) & (t < sil_b)] = 0
    y += pad
    for k in range(int(TOTAL / beat)):
        at = k * beat
        if sil_a - 0.01 <= at < sil_b - 0.01:
            continue
        if at < bass_end - 0.01:
            add(at, kick * (1.0 if k % 4 == 0 else 0.6))
        add(at, hat)
        add(at + beat / 2, hat * 0.6)
    add(sil_b, kick * 1.6)
    add(sil_b, crash)
    y[(t >= sil_a) & (t < sil_b)] = 0             # 殘響也切乾淨
    y[-SR * 2:] *= np.linspace(1, 0, SR * 2)
    y = (y / np.abs(y).max() * 0.9 * 32767).astype(np.int16)
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(y.tobytes())
    return truth


SOURCES = [
    "testsrc2=s=1260x540:r=24",
    "color=c=0x3a6ea5:s=1260x540:r=24,drawbox=x=0:y=400:w=iw:h=140:c=0x555040:t=fill,drawbox=x='200+t*40':y=150:w=160:h=300:c=0xd8d0c0:t=fill",
    "mandelbrot=s=1260x540:r=24",
    "smptebars=s=1260x540:r=24",
    "rgbtestsrc=s=1260x540:r=24",
    "gradients=s=1260x540:r=24:c0=0x203040:c1=0xc08040",
    "life=s=1260x540:r=24:mold=10:ratio=0.2",
]


def clip(path, parts):
    """parts: [(來源索引, 秒數)]，以硬切串成一支影片。"""
    args, labels = [], ""
    for i, (src, dur) in enumerate(parts):
        args += ["-f", "lavfi", "-t", str(dur), "-i", SOURCES[src]]
        labels += f"[{i}:v]"
    ff(*args, "-filter_complex", f"{labels}concat=n={len(parts)}:v=1,format=yuv420p",
       "-c:v", "libx264", "-crf", "18", path)


def main():
    os.makedirs(os.path.join(FIX, "monsters"), exist_ok=True)
    with open(os.path.join(HERE, "..", "project.json"), encoding="utf-8") as f:
        cfg = json.load(f)

    monster = 0
    for ref in cfg["refs"]:
        if ref["source"].endswith(".jpg"):
            ref["source"] = "fixtures/taipei101.jpg"
            ff("-f", "lavfi", "-i", SOURCES[5], "-frames:v", "1", os.path.join(FIX, "taipei101.jpg"))
        else:
            name = os.path.basename(ref["source"])
            ref["source"] = f"fixtures/monsters/{name}"
            ff("-f", "lavfi", "-t", "5", "-i", SOURCES[monster % len(SOURCES)],
               "-pix_fmt", "yuv420p", os.path.join(FIX, "monsters", name))
            monster += 1

    # 故意讓實際切點偏離分鏡秒數，模擬生成結果
    cuts = [[(5, 2.6), (1, 4.5), (6, 3.7), (2, 4.2)], [(3, 5.4), (4, 4.3), (0, 5.3)]]
    for seg, parts in zip(cfg["segments"], cuts):
        seg["clip"] = f"fixtures/{seg['id']}.mp4"
        clip(os.path.join(FIX, f"{seg['id']}.mp4"), parts)

    cfg["music"]["file"] = "fixtures/music.wav"
    truth = music(os.path.join(FIX, "music.wav"))
    cfg["format"] = {"width": 1260, "height": 540, "fps": 24}

    with open(os.path.join(HERE, "project.json"), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)
    with open(os.path.join(FIX, "truth.json"), "w") as f:
        json.dump({"music": truth, "cuts": [[sum(d for _, d in p[:i + 1]) for i in range(len(p) - 1)]
                                             for p in cuts]}, f, indent=2)
    print("fixtures ready:", json.dumps(truth))


if __name__ == "__main__":
    main()
