"""步驟 1：從每支怪獸影片抽一張最清晰的定格，加上 101 照片，輸出參考圖。"""
import os

import numpy as np
from PIL import Image
from scipy import ndimage

from .common import ffmpeg, need, probe

SAMPLES = 16
SMALL = (480, 270)


def sharpest_time(video):
    """在影片中段均勻取樣，回傳拉普拉斯變異數最大（最銳利）的時間點。"""
    dur = probe(video)[0]
    times = np.linspace(dur * 0.1, dur * 0.9, SAMPLES)
    best_t, best_score = times[0], -1.0
    for t in times:
        raw = ffmpeg("-ss", f"{t:.3f}", "-i", video, "-frames:v", "1",
                     "-vf", f"scale={SMALL[0]}:{SMALL[1]},format=gray",
                     "-f", "rawvideo", "-", capture=True).stdout
        if len(raw) != SMALL[0] * SMALL[1]:
            continue
        img = np.frombuffer(raw, np.uint8).reshape(SMALL[1], SMALL[0]).astype(np.float32)
        score = float(ndimage.laplace(img).var())
        if score > best_score:
            best_t, best_score = float(t), score
    return best_t


def extract(proj):
    out_dir = os.path.join(proj.work, "refs")
    os.makedirs(out_dir, exist_ok=True)
    result = []
    for i, ref in enumerate(proj["refs"], 1):
        src = need(proj.p(ref["source"]), f"素材「{ref['name']}」")
        dst = os.path.join(out_dir, f"{i:02d}_{ref['id']}.png")
        if src.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
            Image.open(src).convert("RGB").save(dst)
            at = None
        else:
            at = ref.get("at")
            if at is None:
                at = sharpest_time(src)
            ffmpeg("-ss", f"{at:.3f}", "-i", src, "-frames:v", "1", dst)
        result.append({"id": ref["id"], "name": ref["name"], "file": dst, "at": at})
        print(f"  {ref['name']:　<6} → {os.path.relpath(dst, proj.root)}"
              + (f"（{at:.2f}s）" if at is not None else ""))
    proj.save("refs.json", result)
    return result
