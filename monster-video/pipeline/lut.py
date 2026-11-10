"""女神鏡頭專用：把藍天壓成沙塵色的 3D LUT（只動藍／青色相，其餘顏色不變）。"""
import colorsys
import os

import numpy as np

N = 33


def sky_to_dust(proj):
    cfg = proj["grade"]["sky_to_dust"]
    dust = np.array(cfg["color"]) / 255.0
    dust_luma = dust @ [0.2126, 0.7152, 0.0722]
    path = os.path.join(proj.work, "sky_to_dust.cube")
    os.makedirs(proj.work, exist_ok=True)
    lines = [f"LUT_3D_SIZE {N}"]
    grid = np.linspace(0, 1, N)
    for b in grid:                          # .cube 的順序：R 變最快
        for g in grid:
            for r in grid:
                h, s, _ = colorsys.rgb_to_hsv(r, g, b)
                hue = h * 360
                # 色相 170°–265°（青到藍）權重最高，兩側各 25° 漸變；飽和度越高越算藍天
                w = np.clip((hue - 145) / 25, 0, 1) * np.clip((290 - hue) / 25, 0, 1)
                w *= np.clip(s / 0.25, 0, 1) * cfg["strength"]
                luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
                target = np.clip(dust * (luma / dust_luma) ** 0.85 * cfg["lift"], 0, 1)
                out = (1 - w) * np.array([r, g, b]) + w * target
                lines.append("%.5f %.5f %.5f" % tuple(out))
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
    return path
