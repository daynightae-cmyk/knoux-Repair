from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

items = [
    ("Device Health", "/home/ubuntu/screenshots/localhost_2026-08-21_18-59-54_3364.webp"),
    ("Space Cleaner", "/home/ubuntu/screenshots/localhost_2026-08-21_19-00-07_9886.webp"),
    ("Speed Up", "/home/ubuntu/screenshots/localhost_2026-08-21_19-00-32_1283.webp"),
    ("Storage Explorer", "/home/ubuntu/screenshots/localhost_2026-08-21_19-00-41_3133.webp"),
    ("Connection Helper", "/home/ubuntu/screenshots/localhost_2026-08-21_19-01-05_6588.webp"),
    ("Protection Center", "/home/ubuntu/screenshots/localhost_2026-08-21_19-01-13_5652.webp"),
    ("Device Checkup", "/home/ubuntu/screenshots/localhost_2026-08-21_19-01-28_9589.webp"),
    ("Protect & Recover", "/home/ubuntu/screenshots/localhost_2026-08-21_19-01-35_3889.webp"),
    ("App Center", "/home/ubuntu/screenshots/localhost_2026-08-21_19-01-58_7275.webp"),
    ("Privacy Control Room", "/home/ubuntu/screenshots/localhost_2026-08-21_19-02-06_8317.webp"),
    ("Development Workbench", "/home/ubuntu/screenshots/localhost_2026-08-21_19-02-27_5167.webp"),
    ("Project Command Board", "/home/ubuntu/screenshots/localhost_2026-08-21_19-02-37_5971.webp"),
]

out = Path("/home/ubuntu/knoux-Repair/Docs/KNOUX-SERVICE-APP-GALLERY.png")
cols = 3
card_w, card_h = 500, 308
margin, top = 32, 118
gap = 18
rows = (len(items) + cols - 1) // cols
canvas = Image.new("RGB", (margin * 2 + cols * card_w + (cols - 1) * gap, top + rows * card_h + (rows - 1) * gap + 32), "#0d131d")
draw = ImageDraw.Draw(canvas)
font_dir = "/usr/share/fonts/truetype/dejavu"
font_title = ImageFont.truetype(f"{font_dir}/DejaVuSans-Bold.ttf", 28)
font_sub = ImageFont.truetype(f"{font_dir}/DejaVuSans.ttf", 15)
font_card = ImageFont.truetype(f"{font_dir}/DejaVuSans-Bold.ttf", 16)

draw.text((margin, 28), "KNOUX SERVICE APP GALLERY", font=font_title, fill="#e9f5fb")
draw.text((margin, 68), "Representative user-facing experiences for the main service families", font=font_sub, fill="#8da3b4")

for idx, (name, path_str) in enumerate(items):
    x = margin + (idx % cols) * (card_w + gap)
    y = top + (idx // cols) * (card_h + gap)
    image = Image.open(path_str).convert("RGB")
    image.thumbnail((card_w, card_h - 34), Image.Resampling.LANCZOS)
    card = Image.new("RGB", (card_w, card_h), "#121b28")
    ox = (card_w - image.width) // 2
    oy = 34 + ((card_h - 34 - image.height) // 2)
    card.paste(image, (ox, oy))
    card_draw = ImageDraw.Draw(card)
    card_draw.rectangle((0, 0, card_w - 1, card_h - 1), outline="#27384c", width=1)
    card_draw.rectangle((0, 0, card_w, 34), fill="#172334")
    card_draw.text((13, 9), f"{idx + 1:02d}  {name}", font=font_card, fill="#dfeef7")
    canvas.paste(card, (x, y))

canvas.save(out, quality=94)
print(out)
