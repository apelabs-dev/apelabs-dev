# Section islands

Every landing section is a plain `.astro` component plus one small script module. No React
island, no runtime framework, nothing ships for a section that is not on the page.

## Pattern

```astro
<section id="0X-name" data-island="name">
  ...
</section>
<script>
  import { onVisible } from '../scripts/lib/island';
  import { init } from '../scripts/sections/name';
  onVisible(document.querySelector('[data-island="name"]'), init);
</script>
```

`src/scripts/sections/<name>.ts` exports `init(root: Element): void`. It runs once, the first
time the section is near the viewport, and owns its own GSAP timeline.

## Rules

- `onVisible` calls `init` immediately when `IntersectionObserver` is missing or the reader
  prefers reduced motion. Render the final state in HTML/CSS, then animate toward it.
- Import `gsap` / `ScrollTrigger` from `src/scripts/lib/island`, never from the package
  directly, so the plugin registers exactly once.
- Use `reducedMotion()` for any motion the helper cannot gate (hover replays, autoplay).
- Scoped styles stay in the section's `.astro` file; shared tokens live in
  `src/styles/global.css`.
- Icons: `<Icon set="lucide|simple" name="..." size={16} />` from `src/components/Icon.astro`.
  Names are file names in `lucide-static` / `simple-icons`; a typo fails the build.
- Tests: tag specs `@shell` for the page shell and `@<section>` for a card. Run one card with
  `npm run test:e2e:section -- --grep @<section>`. Screenshot baselines live in
  `tests/e2e/__screenshots__/<project>/`.
