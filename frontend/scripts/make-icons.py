# -*- coding: utf-8 -*-
"""
Builds the app icons from the brand lockup.

    python scripts/make-icons.py

The source artwork is a lockup: the circular emblem above, the SmartWash wordmark below.
Icons use the emblem alone. At 192px the wordmark is already hard to read and at 32px it is
a smudge, so carrying it into the icon costs legibility and buys nothing — every place these
appear (browser tab, home screen, launcher) shows the app's name next to the icon anyway.

Source artwork lives in frontend/brand/:
    logo.png           transparent background
    logo-white-bg.png  white background
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
BRAND = os.path.join(ROOT, "brand")

SRC_ALPHA = os.path.join(BRAND, "logo.png")
SRC_WHITE = os.path.join(BRAND, "logo-white-bg.png")

# Sampled from the artwork: the red of the arc and the ink of the car body.
BRAND_RED = (227, 30, 36)
BRAND_INK = (47, 58, 68)


def emblem(path):
    """The circular mark, cropped away from the wordmark and trimmed to its own edges."""
    im = Image.open(path).convert("RGBA")
    alpha = im.getchannel("A")

    # A fully opaque source (the white-background file) has no transparency to measure, so
    # separate the emblem by finding the blank band the artwork leaves above the wordmark.
    if alpha.getextrema()[0] == 255:
        grey = im.convert("L")
        w, h = im.size
        px = grey.load()
        rows = [sum(1 for x in range(0, w, 3) if px[x, y] < 235) for y in range(h)]
        gap_start = None
        for y in range(int(h * 0.55), h):
            if rows[y] == 0:
                gap_start = y
                break
        cut = gap_start if gap_start else int(h * 0.78)
        top = im.crop((0, 0, w, cut))
        # Trim the white margin by treating near-white as background.
        mask = top.convert("L").point(lambda v: 0 if v > 235 else 255)
        return top.crop(mask.getbbox())

    cut_row = None
    w, h = im.size
    ap = alpha.load()
    rows = [sum(1 for x in range(0, w, 3) if ap[x, y] > 24) for y in range(h)]
    for y in range(int(h * 0.55), h):
        if rows[y] == 0:
            cut_row = y
            break
    top = im.crop((0, 0, w, cut_row if cut_row else int(h * 0.78)))
    return top.crop(top.getchannel("A").getbbox())


def square(mark, size, background=None, coverage=0.86):
    """
    Centre the mark on a square canvas.

    `coverage` leaves a margin so the mark is not flush against the edge — an icon whose
    artwork touches the border reads as cramped next to icons that breathe, and rounded
    launcher shapes would clip it.
    """
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    target = int(size * coverage)
    scaled = mark.copy()
    scaled.thumbnail((target, target), Image.LANCZOS)
    canvas.paste(scaled, ((size - scaled.width) // 2, (size - scaled.height) // 2), scaled)
    return canvas


def main():
    os.makedirs(PUBLIC, exist_ok=True)
    mark_alpha = emblem(SRC_ALPHA)
    mark_white = emblem(SRC_WHITE)
    print("emblem (transparent): %dx%d" % mark_alpha.size)
    print("emblem (white bg)   : %dx%d\n" % mark_white.size)

    white = (255, 255, 255, 255)
    outputs = [
        # Transparent, so the icon sits on whatever surface the browser paints.
        ("icon-192.png", square(mark_alpha, 192)),
        ("icon-512.png", square(mark_alpha, 512)),
        ("logo.png", square(mark_alpha, 512)),
        # iOS ignores transparency and composites on black, so this one carries its own white.
        ("apple-touch-icon.png", square(mark_alpha, 180, background=white)),
        ("favicon-32.png", square(mark_alpha, 32, coverage=0.94)),
        # Android crops to the launcher shape and only the middle 80% is safe, so the tile
        # bleeds to every edge and the mark is scaled well inside it.
        ("icon-maskable-512.png", square(mark_alpha, 512, background=white, coverage=0.62)),
        # For the header and other in-app placements, where the surrounding layout already
        # provides the spacing. The launcher padding above would read as a gap here.
        ("logo-mark.png", square(mark_alpha, 256, coverage=0.99)),
    ]

    for name, img in outputs:
        path = os.path.join(PUBLIC, name)
        img.save(path, "PNG", optimize=True)
        print("%-24s %dx%d  %5.1f KB" % (name, img.width, img.height,
                                         os.path.getsize(path) / 1024))

    # The full lockup, kept for anywhere the wordmark belongs (email headers, print).
    full = Image.open(SRC_ALPHA).convert("RGBA")
    full_path = os.path.join(PUBLIC, "logo-full.png")
    full.crop(full.getchannel("A").getbbox()).save(full_path, "PNG", optimize=True)
    print("%-24s lockup with wordmark" % "logo-full.png")


if __name__ == "__main__":
    main()
