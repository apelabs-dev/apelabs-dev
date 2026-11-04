# Section islands

Every landing section is a plain `.astro` component plus one small script module. No React
island, no runtime framework, nothing ships for a section that is not on the page.

## Pattern

```astro
<section id="0X-name" data-island="name">
  ...
</section>
<script>
  import { lazyIsland } from '../scripts/lib/island';
  lazyIsland(document.querySelector('[data-island="name"]'), () =>
    import('../scripts/sections/name').then((m) => m.init),
  );
</script>
```

`src/scripts/sections/<name>.ts` exports `init(root: Element)`, which returns a `{ destroy() }`
handle (or `null` if the root is already mounted). Its chunk downloads once the section is within
a screen of the viewport, and `init` runs once, the first time the section is in view. The hero is the exception: it is the first screen, so it imports its code statically
and uses `onVisible`.

## Rules

- `onVisible` / `lazyIsland` call `init` immediately when `IntersectionObserver` is missing or the
  reader prefers reduced motion. Render the final state in HTML/CSS, then animate toward it.
- The island is stored on the root (`root.__island`), so a second call returns it instead of
  mounting twice. `destroy()` cancels pending visibility, scroll and import work and calls the
  handle's `destroy`; `mount()` mounts again. A chunk that fails to load leaves the static markup.
  `destroy` releases only the section's own listeners, observers and triggers.
- Import `gsap` / `ScrollTrigger` from `src/scripts/lib/gsap`, never from the package directly,
  so the plugin registers exactly once and the library only loads with a section that uses it.
- Use `reducedMotion()` for any motion the helper cannot gate (hover replays, autoplay).
- Scoped styles stay in the section's `.astro` file; shared tokens live in
  `src/styles/global.css`.
- Icons: `<Icon set="lucide|simple" name="..." size={16} />` from `src/components/Icon.astro`.
  Names are file names in `lucide-static` / `simple-icons`; a typo fails the build.
- Tests: tag specs `@shell` for the page shell and `@<section>` for a card. Run one card with
  `npm run test:e2e:section -- --grep @<section>`. Screenshot baselines live in
  `tests/e2e/__screenshots__/<project>/`.
