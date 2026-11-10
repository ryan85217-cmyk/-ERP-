"""步驟 5a：偵測兩段生成影片的實際切點（AI 生成的切點不會剛好落在提示詞寫的秒數）。"""
import re
import subprocess
import sys

from .common import need, probe

MIN_GAP = 0.8      # 兩個切點至少相隔的秒數
MIN_SCORE = 0.08   # 低於這個分數就不算切點


def scene_scores(video):
    """回傳 [(時間, 場景變化分數)]，每格一筆。"""
    cmd = ["ffmpeg", "-v", "error", "-nostdin", "-i", video, "-an",
           "-vf", "scale=320:-2,select='gte(scene,0)',metadata=print:file=-",
           "-f", "null", "-"]
    out = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout.decode()
    times = [float(x) for x in re.findall(r"pts_time:([\d.]+)", out)]
    scores = [float(x) for x in re.findall(r"scene_score=([\d.]+)", out)]
    return list(zip(times, scores))


def detect(proj):
    result = []
    for seg in proj["segments"]:
        clip = need(proj.p(seg["clip"]), f"生成影片 {seg['id']}")
        dur, w, h, fps = probe(clip)
        want = len(seg["shots"]) - 1
        cuts = []
        for t, s in sorted(scene_scores(clip), key=lambda x: -x[1]):
            if len(cuts) == want or s < MIN_SCORE:
                break
            if t > MIN_GAP and dur - t > MIN_GAP and all(abs(t - c) > MIN_GAP for c in cuts):
                cuts.append(t)
        cuts.sort()
        if len(cuts) != want:
            sys.exit(f"{seg['id']}：分鏡有 {want + 1} 個鏡頭，但只偵測到 {len(cuts) + 1} 個。"
                     f"請檢查生成結果，或調整 project.json 的分鏡。")
        edges = [0.0] + cuts + [dur]
        pad = 1.0 / fps                    # 切點兩側各讓一格，避免殘影
        print(f"  {seg['id']}：{w}x{h} {fps:g}fps {dur:.2f}s，切點 "
              + "、".join(f"{c:.2f}s" for c in cuts))
        for i, shot in enumerate(seg["shots"]):
            a = edges[i] + (pad if i > 0 else 0)
            b = edges[i + 1] - (pad if i < want else 0)
            planned = shot["sec"][1] - shot["sec"][0]
            result.append({"id": shot["id"], "clip": clip, "in": round(a, 4),
                           "dur": round(b - a, 4), "planned": planned, "fps": fps})
    proj.save("scenes.json", result)
    return result
