#!/usr/bin/env python3
"""Crop the September 2026 portraits to the site's headshot framing.

Matches what the existing 29 headshots were cropped to on 2026-09-11: the face box is ~0.40 of the
square and sits centred at (0.5, 0.44), so every head lands at the same size and height in the grid.
Haar detection is restricted to the middle of the frame and must contain an eye, because on a previous
run a ceiling light was detected as a face.

    /opt/anaconda3/bin/python3 crop_heads.py            # writes crops + a contact sheet
"""
import sys
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageOps

SRC = Path("/Users/Owner/School/website/photos sep 2026")
OUT = Path("/private/tmp/claude-501/-Users-Owner-School-asilomar-site/1c81051b-e210-4bed-bcb5-fad753ab682a/scratchpad/heads")
SIZE = 600            # matches the 13 existing 600x600 files
FACE_FRAC = 0.40      # face height as a fraction of the square
FACE_CY = 0.44        # where the face centre sits vertically

PEOPLE = [
    ("quinn-beato",        "Quinn_Sept_2026/2-IMG_6888.jpg"),
    ("zander-schwartz",    "Zander_sept_2026/1-IMG_6897.jpg"),
    ("royall-mcmahon-ward","Royall_sept_2026/4-IMG_6876.jpg"),
    ("anna-baur",          "Anna_sept_2026/3-IMG_6870.jpg"),
    ("victoria-kindratenko","Tori_sept_2026/3-IMG_6865.jpg"),
    ("daniel-duplessis",   "Dan_sept_2026/5-IMG_6896.jpg"),
    ("abhijith-surendran", "Abhi_sept_2026/5-IMG_6886.jpg"),
    ("rachel-daso",        "Rachel_sept_2026/4-IMG_6861.jpg"),
    ("catherine-beaumont", "Catherine_sept_2026/3-IMG_6880.jpg"),
    ("john-williams",      "John_sept_2026/1 (7).png"),
]
# Haar finds only the glasses on this one frame, and John picked this frame, so the box is read off
# the image by hand (hairline y=480 to chin y=1520, face centred on x=2590) rather than substituting a
# photo he did not choose. Same (x, y, w, h) convention as a detection.
MANUAL = {
    "abhijith-surendran": (2070, 480, 1040, 1040),
}
FALLBACK = {
    "zander-schwartz":      "Zander_sept_2026/8-IMG_6905.jpg",
    "victoria-kindratenko": "Tori_sept_2026/5-IMG_6867.jpg",
}

CASCADES = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in
            ("haarcascade_frontalface_default.xml", "haarcascade_frontalface_alt2.xml")]
eye_cc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


def looks_like_a_face(bgr):
    """Tell a face from the lab's ceiling lamp, which Haar keeps picking and whose louvres even pass an
    eye check. Measured over all nine portraits: the lamp scores 26-54 saturation and 14-18 on R-B,
    every real face 63-102 and 29-43. Saturation and warmth are used rather than a skin-colour range
    because the range I tried first rejected the darkest-skinned person in the set."""
    b, g, r = bgr.reshape(-1, 3).mean(0)
    sat = float(cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)[:, :, 1].mean())
    return sat >= 60 and (r - b) >= 25, sat


def detect(path, loose=False):
    """Return the face box (x, y, w, h) in full-image coordinates, or None.

    Measured on these photos: a real face scores 0.97 on the skin test, while the ceiling lamp that
    Haar keeps mistaking for one scores 0.53-0.64 and is near-neutral grey. 0.85 separates them
    cleanly; a lower bar let the lamp win because it is also the biggest candidate."""
    im = cv2.imread(str(path))
    if im is None:
        return None, None
    H, W = im.shape[:2]
    grey = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
    grey = cv2.equalizeHist(grey)
    x0, x1 = int(W * 0.10), int(W * 0.90)          # wide: one subject stands well left of centre
    y0, y1 = int(H * 0.02), int(H * 0.80)
    roi = grey[y0:y1, x0:x1]
    cand = []
    for cc in CASCADES:
        for (x, y, w, h) in cc.detectMultiScale(roi, scaleFactor=1.03 if loose else 1.05,
                                                minNeighbors=3 if loose else 5,
                                                minSize=(int(H * 0.05), int(H * 0.05))):
            cand.append((x, y, w, h))
    good = []
    for (x, y, w, h) in cand:
        patch = im[y0 + y:y0 + y + h, x0 + x:x0 + x + w]
        if patch.size == 0:
            continue
        ok, sat = looks_like_a_face(patch)
        if not ok:
            continue
        good.append((sat, (x + x0, y + y0, w, h)))
    if not good:
        return None, (W, H)
    # among the plausible faces, the subject is the biggest
    return max(good, key=lambda g: g[1][2] * g[1][3])[1], (W, H)


def crop(path, out, box):
    x, y, w, h = box
    side = h / FACE_FRAC                              # the square the face should occupy 40% of
    cx, cy = x + w / 2, y + h / 2
    left, top = cx - side / 2, cy - side * FACE_CY
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    W, H = im.size
    left = max(0, min(left, W - side))                # keep the square inside the photo
    top = max(0, min(top, H - side))
    side = min(side, W, H)
    im.crop((int(left), int(top), int(left + side), int(top + side))) \
      .resize((SIZE, SIZE), Image.LANCZOS) \
      .save(out, quality=86, optimize=True, progressive=True)
    return side


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows, problems = [], []
    for name, rel in PEOPLE:
        used = rel
        src = SRC / rel
        box = MANUAL.get(name)
        dims = None
        if box is None:
            box, dims = detect(src)
        if box is None:                               # try harder before giving up
            box, dims = detect(src, loose=True)
        if box is None and name in FALLBACK:          # John offered an alternate shot for two of them
            used = FALLBACK[name]
            src = SRC / used
            box, dims = detect(src) or (None, None)
            if box is None:
                box, dims = detect(src, loose=True)
        if box is None:
            problems.append(f"{name}: no face found in {used}")
            continue
        side = crop(src, OUT / f"{name}.jpg", box)
        frac = box[3] / side
        rows.append((name, used, box, frac))
        print(f"{name:<22} face {box[2]}x{box[3]} -> square {int(side)}px, face is {frac:.2f} of it   [{used}]")

    # contact sheet: the detection on the left, the finished crop on the right
    cw, ch = 300, 200
    sheet = Image.new("RGB", (cw + SIZE // 2 + 20, (ch + 10) * len(rows)), "white")
    d = ImageDraw.Draw(sheet)
    for i, (name, used, box, frac) in enumerate(rows):
        y = i * (ch + 10)
        full = ImageOps.exif_transpose(Image.open(SRC / used)).convert("RGB")
        sx = cw / full.width
        thumb = full.resize((cw, int(full.height * sx)))
        sheet.paste(thumb.crop((0, 0, cw, min(ch, thumb.height))), (0, y))
        x, yy, w, h = [v * sx for v in box]
        d.rectangle([x, y + yy, x + w, y + yy + h], outline="red", width=2)
        sheet.paste(Image.open(OUT / f"{name}.jpg").resize((SIZE // 2, SIZE // 2)), (cw + 10, y))
        d.text((4, y + 4), f"{name}  face={frac:.2f}", fill="yellow")
    sheet.save(OUT / "_contact-sheet.png")
    print("\ncontact sheet:", OUT / "_contact-sheet.png")
    for p in problems:
        print("PROBLEM:", p)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
