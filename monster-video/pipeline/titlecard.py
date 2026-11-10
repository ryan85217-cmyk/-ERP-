"""步驟 7：用程式畫片名字卡（不交給 AI 生成，避免中文亂碼）。"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def spaced(draw, cx, y, text, font, tracking, fill):
    """置中繪製帶字距的文字，回傳文字底部的 y。"""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return y + font.getbbox(text)[3]


def render(proj, size):
    w, h = size
    t = proj["title"]
    font_file = proj["font_file"]
    out = os.path.join(proj.work, "title.png")
    os.makedirs(proj.work, exist_ok=True)

    # 底：近黑，中央微亮的徑向漸層
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - w / 2) / (w / 2), (yy - h / 2) / (h / 2))
    base = 26 * np.clip(1 - r, 0, 1) ** 1.5
    img = Image.fromarray(np.dstack([base * 0.92, base * 0.97, base]).astype(np.uint8), "RGB")

    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    ink = (226, 221, 204, 255)             # 灰黃白，與調色後的亮部一致
    dim = (150, 148, 138, 255)

    title_font = ImageFont.truetype(font_file, int(h * 0.20))
    sub_font = ImageFont.truetype(font_file, int(h * 0.038))
    foot_font = ImageFont.truetype(font_file, int(h * 0.026))

    top = int(h * 0.33)
    bottom = spaced(d, w / 2, top, t["text"], title_font, int(h * 0.07), ink)
    line_y = bottom + int(h * 0.055)
    half = int(w * 0.11)
    d.line([(w / 2 - half, line_y), (w / 2 + half, line_y)], fill=dim, width=2)
    if t.get("sub"):
        spaced(d, w / 2, line_y + int(h * 0.035), t["sub"], sub_font, int(h * 0.022), ink)
    if t.get("foot"):
        spaced(d, w / 2, int(h * 0.88), t["foot"], foot_font, int(h * 0.014), dim)

    glow = layer.filter(ImageFilter.GaussianBlur(h * 0.022))
    glow.putalpha(glow.getchannel("A").point(lambda a: int(a * 0.45)))
    img.paste(glow, (0, 0), glow)
    img.paste(layer, (0, 0), layer)
    img.save(out)
    return out
