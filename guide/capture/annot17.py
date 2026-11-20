# Crops and red rings for the shots17 pictures: python3 annot17.py <scratch>/shots17 <guide/assets/shots>
import json, sys
from PIL import Image, ImageDraw
SRC, OUT = sys.argv[1], sys.argv[2]
RED = (220, 38, 38)
boxes = json.load(open(f"{SRC}/boxes.json"))
# name -> (shot, ring boxes, crop top, crop bottom)
jobs = {
  "h-hide":   ("hide",   ["eye"],  110, 690),
  "h-check":  ("check",  ["net"],  860, 1340),
  "h-backup": ("backup", ["btn"],  1130, 1440),
  "h-add":    ("add",    ["add"],  0, 330),
  "h-color":  ("color",  ["sw"],   0, 700),
  "h-pay":    ("pay",    ["ok"],   420, 1140),
}
# The payslip check is as tall as its content: crop around its first group
cx, cy, cw, ch = boxes["check"]["card"]
jobs["h-check"] = ("check", ["net"], int(cy - 70), int(cy + ch + 24))
bx, by, bw, bh = boxes["backup"]["line"]
jobs["h-backup"] = ("backup", ["btn"], int(max(0, by - 90)), int(by + bh + 90))
for out, (shot, rings, top, bottom) in jobs.items():
    im = Image.open(f"{SRC}/{shot}.png").convert("RGB"); d = ImageDraw.Draw(im)
    for r in rings:
        x, y, w, h = boxes[shot][r]; pad = 8
        d.rounded_rectangle((x - pad, y - pad, x + w + pad, y + h + pad), 22, outline=RED, width=7)
    im = im.crop((0, top, im.width, min(im.height, bottom)))
    im.save(f"{OUT}/{out}.png", optimize=True); print(out, im.size)
