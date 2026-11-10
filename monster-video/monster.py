#!/usr/bin/env python3
"""怪獸短片製作流程。用法：python3 monster.py <步驟> [--project project.json]

  refs      抽參考圖（6 支怪獸影片各一張定格 + 台北 101 照片）
  prompts   由分鏡產生兩段 Seedance 提示詞
  generate  顯示即夢 CLI 指令；加 --run 才會實際送出（會扣點）
  beats     音樂分析：每一拍、重拍、靜音後重拍進來、低音消失
  scenes    偵測兩段生成影片的實際切點
  plan      卡點剪接計畫（鏡頭重排、變速，讓切點落在拍子上）
  title     繪製片名字卡
  render    調色、顆粒、字幕、字卡、配樂合成；加 --preview 輸出半解析度快速版
  post      beats → scenes → plan → render 一次跑完
"""
import argparse

from pipeline import beats, edit, prompts, refs, scenes, titlecard
from pipeline.common import Project


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["refs", "prompts", "generate", "beats", "scenes",
                                     "plan", "title", "render", "post"])
    ap.add_argument("--project", default="project.json")
    ap.add_argument("--run", action="store_true", help="generate：實際呼叫即夢 CLI")
    ap.add_argument("--preview", action="store_true", help="render：半解析度快速預覽")
    args = ap.parse_args()
    proj = Project(args.project)

    def step(name, fn):
        print(f"[{name}]")
        return fn()

    if args.step == "refs":
        step("抽參考圖", lambda: refs.extract(proj))
    elif args.step == "prompts":
        for job in step("提示詞", lambda: prompts.build(proj)):
            print(f"\n── {job['id']} ──\n{job['prompt']}")
    elif args.step == "generate":
        step("生成", lambda: prompts.generate(proj, args.run))
    elif args.step == "title":
        fmt = proj["format"]
        print(step("片名字卡", lambda: titlecard.render(proj, (fmt["width"], fmt["height"]))))
    else:
        if args.step in ("beats", "post"):
            step("音樂分析", lambda: beats.analyze(proj))
        if args.step in ("scenes", "post"):
            step("偵測切點", lambda: scenes.detect(proj))
        if args.step in ("plan", "post"):
            step("卡點剪接", lambda: edit.plan(proj))
        if args.step in ("render", "post"):
            step("合成", lambda: edit.render(proj, args.preview))


if __name__ == "__main__":
    main()
