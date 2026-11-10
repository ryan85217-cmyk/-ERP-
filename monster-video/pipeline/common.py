"""共用工具：讀設定、呼叫 ffmpeg/ffprobe。"""
import json
import os
import subprocess
import sys


class Project:
    def __init__(self, path):
        self.path = os.path.abspath(path)
        self.root = os.path.dirname(self.path)
        with open(self.path, encoding="utf-8") as f:
            self.cfg = json.load(f)
        self.work = self.p("work")
        self.out = self.p("output")

    def p(self, *parts):
        """把相對於專案檔的路徑轉成絕對路徑。"""
        return os.path.join(self.root, *parts)

    def __getitem__(self, key):
        return self.cfg[key]

    def shots(self):
        """所有鏡頭（依生成順序），附上所屬段落。"""
        for seg in self.cfg["segments"]:
            for shot in seg["shots"]:
                yield seg, shot

    def load(self, name):
        path = os.path.join(self.work, name)
        if not os.path.exists(path):
            sys.exit(f"找不到 {path}，請先執行產生它的步驟。")
        with open(path, encoding="utf-8") as f:
            return json.load(f)

    def save(self, name, data):
        os.makedirs(self.work, exist_ok=True)
        path = os.path.join(self.work, name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path


def need(path, what):
    if not os.path.exists(path):
        sys.exit(f"缺少{what}：{path}")
    return path


def run(cmd, capture=False):
    res = subprocess.run(cmd, stdout=subprocess.PIPE if capture else None,
                         stderr=subprocess.PIPE)
    if res.returncode != 0:
        sys.stderr.write(res.stderr.decode("utf-8", "replace")[-3000:])
        sys.exit(f"指令失敗：{' '.join(map(str, cmd[:6]))} ...")
    return res


def ffmpeg(*args, capture=False):
    return run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *map(str, args)],
               capture=capture)


def probe(path):
    """回傳 (duration, width, height, fps)；純音訊時後三者為 None。"""
    res = run(["ffprobe", "-v", "error", "-show_entries",
               "format=duration:stream=codec_type,width,height,r_frame_rate",
               "-of", "json", path], capture=True)
    info = json.loads(res.stdout)
    dur = float(info["format"]["duration"])
    for st in info["streams"]:
        if st.get("codec_type") == "video":
            num, den = st["r_frame_rate"].split("/")
            return dur, st["width"], st["height"], float(num) / float(den)
    return dur, None, None, None
