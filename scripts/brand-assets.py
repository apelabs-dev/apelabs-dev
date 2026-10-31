"""Generate the interim brand-asset slots in public/ ONCE. Not part of the site build.

The final brand kit replaces these by a plain file drop (same paths, same sizes):
  public/favicon.svg          SVG, from d2-A1-favicon.svg
  public/favicon-16.png       16x16 PNG
  public/favicon-32.png       32x32 PNG
  public/favicon.ico          16+32 ICO (for clients that request /favicon.ico)
  public/apple-touch-icon.png 180x180 PNG, from d2-A1-apple-touch-icon.svg
  public/og/og-default.png    1200x630 PNG, lockup + home H1 on palette P1

Run:
  uv run --with resvg-py --with pillow python scripts/brand-assets.py <brand-dir>

<brand-dir> holds logo-d2-A1/*.svg and fonts/*.ttf (Geist, Geist Mono variable TTFs).
"""
import io
import pathlib
import re
import sys

import resvg_py
from PIL import Image

BG, INK, MUTED, ACCENT, STATUS = "#0B0B0C", "#F3F1EA", "#9A968C", "#FF6B35", "#4CC38A"

brand = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent
public = root / "public"
(public / "og").mkdir(parents=True, exist_ok=True)
logo_dir = brand / "logo-d2-A1"
fonts = [str(p) for p in sorted((brand / "fonts").glob("*.ttf"))]


def render(svg: str, width: int, height: int) -> bytes:
    return resvg_py.svg_to_bytes(
        svg_string=svg, width=width, height=height, skip_system_fonts=True, font_files=fonts
    )


def write_png(path: pathlib.Path, data: bytes) -> None:
    # Re-encode through Pillow with optimisation so the committed files stay small.
    img = Image.open(io.BytesIO(data))
    img.save(path, optimize=True)
    print(f"{path.relative_to(root)}  {img.size[0]}x{img.size[1]}  {path.stat().st_size} bytes")


favicon_svg = (logo_dir / "d2-A1-favicon.svg").read_text()
(public / "favicon.svg").write_text(favicon_svg)
print("public/favicon.svg  copied from d2-A1-favicon.svg")

write_png(public / "favicon-16.png", render(favicon_svg, 16, 16))
write_png(public / "favicon-32.png", render(favicon_svg, 32, 32))
Image.open(public / "favicon-32.png").save(public / "favicon.ico", sizes=[(16, 16), (32, 32)])
print("public/favicon.ico  16+32")

apple_svg = (logo_dir / "d2-A1-apple-touch-icon.svg").read_text()
write_png(public / "apple-touch-icon.png", render(apple_svg, 180, 180))

# --- OG image -------------------------------------------------------------
lockup = (logo_dir / "d2-A1-lockup-on-dark.svg").read_text()
lockup_inner = lockup[re.search(r"<rect[^>]*/>", lockup).end() : lockup.rindex("</svg>")]

columns = "".join(
    f'<line x1="{x}" y1="0" x2="{x}" y2="630" stroke="{INK}" stroke-opacity="0.07"/>'
    for x in range(80, 1200, 173)
)
h1_lines = ["We fix and build the", "business systems small", "teams run on."]
h1 = "".join(
    f'<text x="80" y="{262 + i * 74}" font-family="Geist" font-weight="560" font-size="68" '
    f'letter-spacing="-2" fill="{INK}">{line}</text>'
    for i, line in enumerate(h1_lines)
)
# Broken -> fixed path: ink line, a gap where the handoff broke, the orange repair
# path bridging it, and a verified node at the end.
trace = f"""
<g fill="none" stroke-width="3">
  <path d="M80 520 H520" stroke="{INK}"/>
  <path d="M600 520 H1040" stroke="{INK}"/>
  <path d="M520 520 H540 V480 H580 V520 H600" stroke="{ACCENT}"/>
  <path d="M540 520 H580" stroke="{INK}" stroke-opacity="0.3" stroke-dasharray="4 6"/>
</g>
<rect x="74" y="514" width="12" height="12" fill="{INK}"/>
<rect x="1036" y="512" width="16" height="16" fill="{STATUS}"/>
<text x="80" y="574" font-family="Geist Mono" font-weight="500" font-size="18" letter-spacing="1.5" fill="{MUTED}">APELABS.DEV</text>
"""
og_svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="{BG}"/>
{columns}
<g transform="translate(23.2 23.2) scale(0.6)">{lockup_inner}</g>
{h1}
{trace}
</svg>"""
write_png(public / "og" / "og-default.png", render(og_svg, 1200, 630))
