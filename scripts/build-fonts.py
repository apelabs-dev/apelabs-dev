"""Subset the Geist and Geist Mono variable TTFs to Latin and write WOFF2 into public/fonts/.

Run once when the source fonts change:
  uv run --with fonttools --with brotli python scripts/build-fonts.py <dir-with-ttf-files>

Also prints the vertical metrics and average widths used for the size-adjusted
fallback faces in src/styles/global.css.
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

LATIN = (
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
    "U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+FEFF,U+FFFD"
)
FONTS = {
    "ofl_geist_Geist[wght].ttf": "geist-latin-var.woff2",
    "ofl_geistmono_GeistMono[wght].ttf": "geist-mono-latin-var.woff2",
}
SAMPLE = "The quick brown fox jumps over the lazy dog. We fix and build business systems 0123456789"

src_dir = pathlib.Path(sys.argv[1])
out_dir = pathlib.Path(__file__).resolve().parent.parent / "public" / "fonts"
out_dir.mkdir(parents=True, exist_ok=True)

for src_name, out_name in FONTS.items():
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "calt", "tnum", "zero", "case"]
    opts.unicodes = subset.parse_unicodes(LATIN)
    opts.notdef_outline = True
    opts.name_IDs = ["*"]
    font = subset.load_font(str(src_dir / src_name), opts)
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=opts.unicodes)
    sub.subset(font)
    out = out_dir / out_name
    subset.save_font(font, str(out), opts)

    src = TTFont(str(src_dir / src_name))
    upm = src["head"].unitsPerEm
    hhea = src["hhea"]
    cmap = src.getBestCmap()
    hmtx = src["hmtx"]
    widths = [hmtx[cmap[ord(c)]][0] for c in SAMPLE if ord(c) in cmap]
    avg = sum(widths) / len(widths) / upm
    axes = ", ".join(f"{a.axisTag} {a.minValue:g}-{a.maxValue:g}" for a in src["fvar"].axes)
    print(
        f"{out_name}: {out.stat().st_size} bytes | upm {upm} | ascent {hhea.ascent / upm:.4f} "
        f"| descent {-hhea.descent / upm:.4f} | lineGap {hhea.lineGap / upm:.4f} "
        f"| sample avg width {avg:.4f} em | axes {axes}"
    )
