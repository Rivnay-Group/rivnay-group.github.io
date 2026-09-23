#!/usr/bin/env python3
"""Write a 208x156 thumbnail beside every news post image, as <name>-thumb.jpg.

    python3 scripts/thumbs.py

Run it after adding a post with an image, and commit the thumbnail with the post: the news list
and the home page show it at 104x78 CSS px, so 208x156 stays sharp on 2x screens. Thumbnails newer
than their source are skipped. Needs Pillow (python3 -m pip install pillow).
"""
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SIZE = (208, 156)


def main():
    made = skipped = 0
    for post in sorted((ROOT / "_posts").glob("*.md")):
        m = re.search(r"^image:\s*(\S+)", post.read_text(encoding="utf-8"), re.M)
        if not m:
            continue
        src = ROOT / m.group(1).strip("'\"").lstrip("/")
        if src.suffix != ".jpg":  # the news lists only look for a thumbnail beside a lowercase .jpg
            print("%s: %s is not a .jpg, rename or re-export it" % (post.name, src.name))
            continue
        dst = src.with_name(src.stem + "-thumb.jpg")
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            skipped += 1
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
        ImageOps.fit(im, SIZE, Image.LANCZOS).save(dst, quality=82, optimize=True, progressive=True)
        made += 1
    print("thumbnails written: %d, already current: %d" % (made, skipped))


if __name__ == "__main__":
    main()
