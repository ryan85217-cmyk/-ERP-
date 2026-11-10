"""步驟 4：音樂分析。找出每一拍、重拍、「靜音後重拍進來」的位置，以及低音消失的位置。

所有時間都以「取用段落的起點」（預設 2:17）為 0。
"""
import subprocess
import sys

import numpy as np
from scipy import ndimage, signal

from .common import need

SR = 22050
HOP = 256
FPS = SR / HOP
LAG = 512 / SR     # 分析窗的半寬：起音進入窗尾就會被看到，時間要往後補


def load_audio(path, start):
    cmd = ["ffmpeg", "-v", "error", "-nostdin", "-ss", str(start), "-i", path,
           "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, stdout=subprocess.PIPE, check=True).stdout
    y = np.frombuffer(raw, np.float32)
    if len(y) < SR * 5:
        sys.exit(f"音樂從 {start}s 起不足 5 秒，請檢查 music.start。")
    return y


def features(y):
    f, _, Z = signal.stft(y, SR, nperseg=1024, noverlap=1024 - HOP, padded=False, boundary=None)
    mag = np.abs(Z)
    logm = np.log1p(200 * mag)
    flux = np.maximum(0, np.diff(logm, axis=1, prepend=logm[:, :1]))
    low = f < 150
    return {
        "onset": flux.sum(0),
        "low_onset": flux[low].sum(0),
        "energy": (mag ** 2).sum(0),
        "low_energy": (mag[low] ** 2).sum(0),
    }


def tempo(onset, hint):
    env = onset - ndimage.uniform_filter1d(onset, int(FPS))
    env = np.maximum(env, 0)
    ac = signal.correlate(env, env, mode="full", method="fft")[len(env) - 1:]
    lags = np.arange(int(FPS * 60 / 200), int(FPS * 60 / 55))
    bpm = 60 * FPS / lags
    center = hint or 110
    width = 0.12 if hint else 0.5          # 以八度為單位的容許範圍
    prior = np.exp(-0.5 * (np.log2(bpm / center) / width) ** 2)
    k = int(np.argmax(ac[lags] * prior))
    lag = float(lags[k])
    if 0 < k < len(lags) - 1:              # 拋物線內插，取得小數 lag
        a, b, c = ac[lags[k - 1]], ac[lags[k]], ac[lags[k + 1]]
        if a - 2 * b + c != 0:
            lag += 0.5 * (a - c) / (a - 2 * b + c)
    return 60 * FPS / lag, env


def track(env, period, tightness=100.0):
    """Ellis 動態規劃節拍追蹤：讓拍點落在起音上，同時維持固定速度。"""
    env = env / (env.std() + 1e-9)
    n = len(env)
    score = env.copy()
    back = np.full(n, -1)
    lo, hi = int(round(period / 2)), int(round(period * 2))
    offs = np.arange(-hi, -lo + 1)
    penalty = -tightness * np.log(-offs / period) ** 2
    for i in range(hi, n):
        cand = score[i + offs] + penalty
        j = int(np.argmax(cand))
        score[i] = env[i] + cand[j]
        back[i] = i + offs[j]
    i = n - int(period) + int(np.argmax(score[n - int(period):]))
    beats = []
    while i >= 0:
        beats.append(i)
        i = back[i]
    return np.array(beats[::-1])


def runs(mask):
    """回傳布林陣列中連續 True 的 (起, 迄) 區間。"""
    d = np.diff(np.concatenate([[0], mask.astype(int), [0]]))
    return list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))


def find_drop(feat):
    """找「一段靜音後重拍進來」：靜音至少 0.3 秒，取重新進來時能量最強的那一段。"""
    energy = ndimage.uniform_filter1d(feat["energy"], 5)
    db = 10 * np.log10(energy / np.percentile(energy, 95) + 1e-12)
    best = None
    win = int(FPS * 0.3)
    for a, b in runs(db < -30):
        if b - a < FPS * 0.3 or b >= len(db) - win or a < FPS:
            continue
        strength = float(feat["energy"][b:b + win].mean())
        if best is None or strength > best[2]:
            best = (a, b, strength)
    if best is None:
        return None, None
    # 重拍的實際起點：靜音結束後起音強度最大的那一格
    a, b, _ = best
    seg = feat["onset"][max(b - 4, 0):b + 8]
    hit = max(b - 4, 0) + int(np.argmax(seg))
    return a / FPS + LAG, hit / FPS + LAG


def find_bass_out(feat, after):
    """低音消失：低頻能量最後一次明顯存在的時間（之後到結尾都只剩中高頻）。"""
    low = ndimage.maximum_filter1d(feat["low_energy"], int(FPS * 0.5))
    start = int(after * FPS)
    ref = np.percentile(low[start:], 90)
    present = np.where(low[start:] > ref * 0.05)[0]
    if len(present) == 0:
        return None
    t = (start + present[-1]) / FPS - 0.25      # 扣掉 maximum filter 的半寬
    total = len(low) / FPS
    return t if total - t > 1.0 else None


def analyze(proj):
    m = proj["music"]
    path = need(proj.p(m["file"]), "配樂")
    y = load_audio(path, m["start"])
    duration = len(y) / SR
    feat = features(y)

    bpm, env = tempo(feat["onset"], m.get("bpm_hint"))
    frames = track(env, 60 * FPS / bpm)
    beats = frames / FPS + LAG

    # 重拍：假設 4/4，取低頻起音總和最大的相位當作每小節第一拍
    low_at = np.array([feat["low_onset"][max(f - 2, 0):f + 3].max() for f in frames])
    phase = int(np.argmax([low_at[k::4].sum() for k in range(4)]))
    downbeats = beats[phase::4]
    accents = beats[low_at > low_at.mean() + low_at.std()]

    silence_start, drop = find_drop(feat)
    bass_out = find_bass_out(feat, drop if drop is not None else 0.0)

    data = {
        "music_start": m["start"],
        "duration": round(duration, 3),
        "bpm": round(float(bpm), 2),
        "beats": [round(float(t), 3) for t in beats],
        "downbeats": [round(float(t), 3) for t in downbeats],
        "accents": [round(float(t), 3) for t in accents],
        "silence_start": None if silence_start is None else round(silence_start, 3),
        "drop": None if drop is None else round(drop, 3),
        "bass_out": None if bass_out is None else round(bass_out, 3),
    }
    proj.save("beats.json", data)

    def show(t):
        return "未偵測到" if t is None else f"{t:6.2f}s（原曲 {fmt(m['start'] + t)}）"
    print(f"  取用段落 {fmt(m['start'])} → 結尾，長 {duration:.2f}s")
    print(f"  速度 {bpm:.1f} BPM，{len(beats)} 拍，{len(downbeats)} 個小節重拍，{len(accents)} 個加重拍")
    print(f"  靜音開始   {show(silence_start)}")
    print(f"  重拍進來   {show(drop)}")
    print(f"  低音消失   {show(bass_out)}")
    return data


def fmt(t):
    return f"{int(t // 60)}:{t % 60:05.2f}"
