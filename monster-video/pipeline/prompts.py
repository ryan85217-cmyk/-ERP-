"""步驟 2–3：由分鏡組出 Seedance 多模態參考提示詞，並（選擇性）呼叫即夢 CLI 生成。"""
import os
import shutil
import subprocess
import sys


def build(proj):
    """回傳 [{id, prompt, images:[參考圖路徑], clip}]，並把提示詞寫到 work/prompts/。"""
    gen = proj["generation"]
    names = {r["id"]: r["name"] for r in proj["refs"]}
    ref_files = {}
    refs_json = os.path.join(proj.work, "refs.json")
    if os.path.exists(refs_json):
        ref_files = {r["id"]: r["file"] for r in proj.load("refs.json")}

    out_dir = os.path.join(proj.work, "prompts")
    os.makedirs(out_dir, exist_ok=True)
    jobs = []
    for seg in proj["segments"]:
        if len(seg["refs"]) != 4:
            sys.exit(f"{seg['id']}：每段應掛 4 張參考圖，目前 {len(seg['refs'])} 張。")
        token = {rid: gen["ref_token"].format(n=i) for i, rid in enumerate(seg["refs"], 1)}
        seen = [s["monster"] for s in seg["shots"] if s["monster"]]
        if len(seen) != len(set(seen)):
            sys.exit(f"{seg['id']}：同一隻怪獸出現在多個鏡頭。")

        lines = [gen["style"], ""]
        lines.append("參考圖：" + "；".join(
            f"{token[rid]} 是{names[rid]}" for rid in seg["refs"]) + "。")
        lines.append("")
        lines.append(f"全片 {gen['duration']} 秒，共 {len(seg['shots'])} 個鏡頭，鏡頭之間硬切：")
        for n, shot in enumerate(seg["shots"], 1):
            a, b = shot["sec"]
            lines.append(f"鏡頭{n}（{a}–{b} 秒）：{shot['prompt'].format(**token)}")
        lines += ["", gen["negative"]]
        prompt = "\n".join(lines)

        path = os.path.join(out_dir, f"{seg['id']}.txt")
        with open(path, "w", encoding="utf-8") as f:
            f.write(prompt + "\n")
        jobs.append({"id": seg["id"], "prompt": prompt, "prompt_file": path,
                     "images": [ref_files.get(rid, f"<{rid} 參考圖>") for rid in seg["refs"]],
                     "clip": proj.p(seg["clip"])})
    return jobs


def command(proj, job):
    gen = proj["generation"]
    cmd = []
    for part in gen["cli"]:
        if part == "{images}":
            for img in job["images"]:
                cmd += [gen["cli_image_flag"], img]
        else:
            cmd.append(part.format(prompt=job["prompt"], ratio=gen["ratio"],
                                   resolution=gen["resolution"], duration=gen["duration"]))
    return cmd


def generate(proj, execute=False):
    gen = proj["generation"]
    jobs = build(proj)
    total = gen["points_per_clip"] * len(jobs)
    print(f"{gen['model']}「{gen['mode']}」 {gen['ratio']} {gen['resolution']} "
          f"{gen['duration']} 秒 × {len(jobs)} 段，預估 {total:,} 點")
    for job in jobs:
        cmd = command(proj, job)
        shown = [c if c != job["prompt"] else f"\"$(cat {os.path.relpath(job['prompt_file'], proj.root)})\""
                 for c in cmd]
        print(f"\n[{job['id']}] → 生成後請存成 {os.path.relpath(job['clip'], proj.root)}")
        print("  " + " ".join(shown))
        if not execute:
            continue
        if not shutil.which(cmd[0]):
            sys.exit(f"找不到 {cmd[0]} 指令，請先安裝並登入即夢 CLI。")
        if any(i.startswith("<") for i in job["images"]):
            sys.exit("尚未抽參考圖，請先執行 refs。")
        if subprocess.run(cmd).returncode != 0:
            sys.exit(f"{job['id']} 生成失敗。")
    if not execute:
        print("\n（以上為預覽，未送出也未扣點。確認後加 --run 才會實際呼叫 CLI。）")
