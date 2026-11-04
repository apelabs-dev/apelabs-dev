---
name: apeLabs
description: Business system repair for small teams. A dark repair-report site where the diagrams are the imagery.
colors:
  ink-black: "#0B0B0C"
  report-surface: "#171614"
  report-surface-raised: "#1F1E1B"
  paper-ink: "#F3F1EA"
  field-grey: "#9A968C"
  fix-orange: "#FF6B35"
  fix-orange-hover: "#FF8255"
  fix-orange-pressed: "#E85A27"
  on-orange: "#0B0B0C"
  passed-green: "#4CC38A"
  rule: "rgb(243 241 234 / 0.1)"
  rule-strong: "rgb(243 241 234 / 0.22)"
typography:
  display:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(40px, 1.6rem + 2.6vw, 60px)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(32px, 1.4rem + 1.9vw, 48px)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(20px, 1.1rem + 0.5vw, 24px)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Geist, Geist Fallback, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  data:
    fontFamily: "Geist Mono, Geist Mono Fallback, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
    fontFeature: "\"tnum\", \"zero\""
  label:
    fontFamily: "Geist Mono, Geist Mono Fallback, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 450
    lineHeight: "14px"
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
spacing:
  gutter: "clamp(16px, 4vw, 40px)"
  grid-gap: "24px"
  header: "72px"
  section: "clamp(96px, 11vw, 160px)"
  container: "1200px"
components:
  button-primary:
    backgroundColor: "{colors.fix-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.fix-orange-hover}"
  button-primary-active:
    backgroundColor: "{colors.fix-orange-pressed}"
  button-small:
    backgroundColor: "{colors.fix-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.ink-black}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.sm}"
    padding: "13px 16px"
    height: "52px"
  report-panel:
    backgroundColor: "{colors.report-surface}"
    textColor: "{colors.paper-ink}"
    rounded: "{rounded.sm}"
  label:
    textColor: "{colors.field-grey}"
    typography: "{typography.label}"
---

# Design System: apeLabs

## Overview

**Creative North Star: "The Repair Report"**

The site reads like a well-kept incident write-up: a dark page, ledger rules, mono field labels, one orange mark where the fix happened. Its pictures are diagrams of a workflow breaking and being repaired, drawn in code. Each one shows the brand kit's block line with a gap, the fragments that fell out, and the orange piece that closes it. Nothing is ornamental. Every line on the page is a rule that separates two facts, a field label, or part of a diagram.

Density is calm and editorial. A narrow set of type sizes on a 12-column grid, generous section spacing, and text measures capped near 60–70 characters. Motion explains the repair: the hero trace replays the six steps of one fictional fix as the reader scrolls past it on desktop, and diagram fix marks fade in once. Without JS or with reduced motion, the same diagrams render in their final state.

Rejected on purpose (brief and brand kit): gradients, glow, neon, 3D, glass, orbs, particles, marquees, bento grids, three-up feature cards, fake dashboards, fake typing, circuit traces, magnifying glasses, checkmark-in-box icons, mascots, people and stock imagery.

**Key Characteristics:**
- One dark theme (`color-scheme: dark`), no light mode.
- Orange is the fix, never decoration. Green means a check passed.
- Mono labels in caps over sans content, like a report's field names.
- Hairline ledger rules instead of cards and shadows.
- Every visual is SVG/CSS; anything that cannot be code is a labelled `MEDIA SLOT`.

## Colors

A near-black page with warm paper-white ink, one hot orange for the fix and one green for "verified".

### Primary
- **Fix Orange** (`fix-orange`): the primary call to action, the repaired block in diagrams, the active section index, focus rings, the hover rule on ledger rows, text selection. Text on orange is `on-orange` (near-black, 6.9:1). Hover and pressed shades (`fix-orange-hover`, `fix-orange-pressed`) exist only on buttons.

### Tertiary
- **Passed Green** (`passed-green`): status dots and the "verified rerun" mark. Never for buttons or links.

### Neutral
- **Ink Black** (`ink-black`): page background, input fields, the docked header bar.
- **Report Surface** (`report-surface`): the trace, the sample report and the form panel, which are the only filled containers. `report-surface-raised` is for nodes inside a diagram.
- **Paper Ink** (`paper-ink`): headings and body copy (17.4:1 on ink black).
- **Field Grey** (`field-grey`): labels, secondary copy, placeholders (6.7:1 on ink black, 6.1:1 on report surface).
- **Rule / Rule Strong**: paper ink at 10% / 22% alpha. Rules are always ink at a fixed alpha, never a separate grey.

### Named Rules
**The Orange Is The Fix Rule.** Orange marks the one thing that was repaired, or the one action to take. If a screen has two orange things that are not the CTA and the fix, one of them is wrong.

**The Graphics-Only Orange Rule.** On the brand kit's paper colour, orange reaches only 2.5:1, so it is never used for running text on light grounds. On ink black it may carry short mono labels and indexes.

## Typography

**Display Font:** Geist (with a metric-adjusted Arial fallback)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono (with a metric-adjusted Menlo fallback)

**Character:** A neutral grotesk for statements, plus a tabular mono that makes timestamps, prices and field names look like they came out of a log. Both are self-hosted variable WOFF2, Latin subset.

### Hierarchy
- **Display** (600, clamp 40–60px, 1.04, −2%): one h1 per page. Home: the hero promise. Inner pages: the page's own section headline.
- **Headline** (600, clamp 32–48px, 1.06, −2%): section h2s, max ~20ch.
- **Title** (600, clamp 20–24px, 1.25, −2%): h3s inside a section (service names, report headings).
- **Lead** (400, 19px, 1.45): the paragraph right under a headline, ≤60ch.
- **Body** (400, 17px, 1.55): everything else. Long-form answers are capped at 56–68ch.
- **Data** (Mono 400, 13px/20px, tabular + slashed zero): trace logs, timestamps, E1–E3 evidence indexes.
- **Label** (Mono 450, 11px/14px, +8%, uppercase): field names, section index rows ("[01] Repair"), panel headers.

### Named Rules
**The Kit Weights Rule.** Headlines are 600 at −2% tracking, body is 400, mono labels are 450 (brand kit spec). No other weights for text, except 560 on button and form-field labels.

## Layout

A 1200px container with fluid gutters (16–40px) and a 24px grid gap. Desktop sections use a 5/7 or 6/6 two-column split: a headline column and a content column. Faint vertical column rules (`ColumnRules`) show the grid in the hero and the closing contact section. Sections are separated by a full-width hairline and `section` spacing (96–160px). Section index rows run a rule out to the container edge.

Breakpoints: 640 (header CTA appears), 768 (two-column splits inside panels), 1024 (desktop nav, hero 40/60 copy/trace split, FAQ two-column). Below 1024 the hero is one column with the CTA above the trace. The pinned replay needs ≥1024 wide and ≥760 tall; below that the trace is static. At 200% zoom (640 CSS px) nothing clips or scrolls sideways.

## Elevation & Depth

Flat. There are no shadows anywhere. Depth comes from two tonal steps (page → report surface → raised node) and from hairline rules. The sticky header gets a solid ink-black bar and a bottom rule once the page scrolls (220ms dock).

### Named Rules
**The No-Shadow Rule.** If something needs to stand out, give it a rule or a surface step, never a shadow or blur.

## Shapes

Small, uniform corners: 4px (`rounded.sm`) on buttons, inputs, panels and diagram nodes, 2px on focus rings. Nothing is pill-shaped or circular except the 6px status dots. Diagram geometry is blocky: dashed block lines with small square fragments, and corner brackets (not circles) around the point of failure.

## Components

### Buttons
- **Shape:** gently squared (4px).
- **Primary:** fix orange with near-black text, 48px tall, 20px side padding, 560 weight, and an arrow that nudges 3px on hover and focus. There is one primary CTA label site-wide ("Request a free diagnostic").
- **Small:** 44px tall, for the header.
- **Hover / Focus:** a lighter orange on hover, darker when pressed with a 1px press-down; the focus ring is 2px orange with a 3px offset.
- **Text link:** ink text with a 22%-alpha underline that turns orange on hover and focus. Minimum 44px hit area.

### Cards / Containers
- **Report panel** (trace, sample report, form): report surface, 1px rule-strong border, 4px corners, and a mono header bar with an orange square marker. Panels never nest. Content inside a panel is divided with rules, not inner boxes.
- **Ledger rows** (repair rows, FAQ, proof, process, menu): no box, just a top and bottom hairline. On hover or focus-within an orange rule sweeps in from the left (220ms expo-out).

### Inputs / Fields
- **Style:** ink-black field inside the panel, 1px rule-strong border, 4px corners, 52px minimum height. Labels sit above in sans 560 (16px); hints go below the label in field grey.
- **Focus:** the border turns orange and gains a 2px orange outline.
- **Error:** an inline message under the field, tied in with `aria-describedby` and `aria-invalid`. Form-level errors are a line of text with an orange square marker, not a boxed alert.

### Navigation
- **Desktop (≥1024):** muted 14px links, ink on hover, focus or current page (current page also gets an orange underline), plus the small primary button. It sits on a sticky 72px bar that is transparent at the top and docks a solid bar after 16px of scroll.
- **Mobile:** a "Menu" button opens a full-screen native modal dialog. It lists numbered 28px links, the CTA and the email. Focus is wrapped inside, and Esc, the Close button or any link closes it and returns focus. Without JS, "Menu" links to the footer navigation.

### Run Trace (signature)
An illustrative workflow trace (trigger → check → step 1 → step 2, with an alert branch) above a mono run log. It shows a fictional break. On desktop it pins beside six chapter captions, and scroll position drives `--p` (0–6). Each part of the diagram eases in through a smoothstep window, and the log line for the current chapter brightens. No scroll-jacking. Static final state without JS or with reduced motion, plus a caption saying so.

### C-motif Diagrams
Code versions of the brand kit's block line (`Blocks.astro`, `src/lib/motif.ts`): ink blocks, dimmed fragments, one orange fix block. They are used in the motif band, the repair flow, the process strip and the sample report's quote mark.

## Do's and Don'ts

### Do:
- **Do** use tokens from `src/styles/global.css` (`--color-*`, `--text-*`, `--radius`, `--dur*`, `--ease-*`) instead of raw values.
- **Do** separate facts with hairline rules (10% / 22% ink) and mono labels.
- **Do** keep orange for the CTA and the fix, and green for a passed check.
- **Do** draw new visuals in SVG/CSS from the block-line motif, and mark anything that must be a real image as `MEDIA SLOT: <name> <w>×<h>`.
- **Do** make motion explain a change (break → fix → rerun), with a final-state fallback for no-JS and reduced motion.
- **Do** keep the logo lockup ≥96px wide and the mark ≥32px.

### Don't:
- **Don't** use gradients, glow, neon, glass/blur, shadows, 3D, orbs, particles or marquees.
- **Don't** build three-up icon cards, bento grids or fake dashboards. Use ledger rows or one report panel.
- **Don't** nest a bordered box inside a panel.
- **Don't** use orange for body text, or on the light paper colour at all except as a graphic.
- **Don't** add people, mascots, stock photos, client logos, testimonials or invented metrics.
