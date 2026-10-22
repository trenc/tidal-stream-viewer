#!/usr/bin/env python3
"""Create the iOS launch screens (splash screens) from the app icon.

  public/splash/*.png                one image per device size and orientation
  scripts/ios-splash-links.html      the <link rel="apple-touch-startup-image"> tags for index.html

Optional: --touch-icon PATH also writes a 180x180 opaque apple-touch-icon.

Usage: python scripts/make_ios_assets.py [--icon FILE] [--bg "#102D42"]
"""
import argparse
from pathlib import Path

from PIL import Image

# (CSS width, CSS height, pixel ratio) in portrait
DEVICES = [
    (320, 568, 2), (375, 667, 2), (414, 736, 3), (375, 812, 3), (414, 896, 2), (414, 896, 3),
    (390, 844, 3), (428, 926, 3), (393, 852, 3), (430, 932, 3), (402, 874, 3), (440, 956, 3),
    (420, 912, 3),
    (744, 1133, 2), (768, 1024, 2), (810, 1080, 2), (820, 1180, 2), (834, 1112, 2),
    (834, 1194, 2), (834, 1210, 2), (1024, 1366, 2), (1032, 1376, 2),
]


def hex_rgb(value):
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def on_background(img, bg):
    img = img.convert('RGBA')
    base = Image.new('RGBA', img.size, bg + (255,))
    base.alpha_composite(img)
    return base.convert('RGB')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--icon', default='public/app-icons/icon-512.png')
    ap.add_argument('--maskable', default='public/app-icons/icon-512-maskable.png')
    ap.add_argument('--bg', default='#102D42')
    ap.add_argument('--out', default='public')
    ap.add_argument('--links', default='scripts/ios-splash-links.html')
    ap.add_argument('--touch-icon', default='', help='also write a 180x180 apple-touch-icon to this path')
    args = ap.parse_args()

    bg = hex_rgb(args.bg)
    icon_path = Path(args.icon)
    if not icon_path.exists():
        found = sorted(str(p) for p in Path('public').rglob('*.png') if 'splash' not in p.parts)
        hint = '\n  '.join(found) if found else '(no PNG files in public/)'
        raise SystemExit(
            f'Icon not found: {icon_path}\nPNG files in public/:\n  {hint}\n'
            'Use: make ios-assets ICON=public/app-icons/your-file.png'
        )
    icon = Image.open(icon_path)

    if args.touch_icon:
        src = Path(args.maskable) if Path(args.maskable).exists() else icon_path
        apple = on_background(Image.open(src), bg).resize((180, 180), Image.LANCZOS)
        Path(args.touch_icon).parent.mkdir(parents=True, exist_ok=True)
        apple.save(args.touch_icon, optimize=True)
        print(f'wrote {args.touch_icon} (from {src})')

    splash_dir = Path(args.out) / 'splash'
    splash_dir.mkdir(parents=True, exist_ok=True)
    links = []
    for w, h, d in DEVICES:
        for orient, (cw, ch) in (('portrait', (w, h)), ('landscape', (h, w))):
            pw, ph = cw * d, ch * d
            canvas = Image.new('RGB', (pw, ph), bg)
            side = int(min(pw, ph) * 0.28)
            logo = icon.convert('RGBA').resize((side, side), Image.LANCZOS)
            canvas.paste(logo, ((pw - side) // 2, (ph - side) // 2), logo)
            name = f'splash-{cw}x{ch}@{d}x-{orient}.png'
            canvas.save(splash_dir / name, optimize=True)
            media = (f'screen and (device-width: {w}px) and (device-height: {h}px) '
                     f'and (-webkit-device-pixel-ratio: {d}) and (orientation: {orient})')
            links.append(f'<link rel="apple-touch-startup-image" media="{media}" href="/splash/{name}" />')

    Path(args.links).parent.mkdir(parents=True, exist_ok=True)
    Path(args.links).write_text('\n'.join(links) + '\n')
    print(f'wrote {len(links)} splash images to {splash_dir} and the tags to {args.links}')


if __name__ == '__main__':
    main()
