/**
 * FAQ behaviour.
 *
 * The markup ships every answer open, so a reader without JavaScript gets the whole section and no
 * content is hidden behind a disclosure that cannot work. This closes all but the first item as soon
 * as the section mounts, which is why it runs immediately instead of waiting for the island to
 * scroll into view — deferring would show every answer open and then collapse it mid-read.
 *
 * Opening and closing are the browser's own work on <details>/<summary>; the height animation is CSS
 * (::details-content, only under prefers-reduced-motion: no-preference).
 */

export type Item = { id: number; q: string; a: string[]; list?: string[] };

export function initFaq(root: Element | null): void {
  if (!root) return;

  const items = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.fq'));
  for (const [index, item] of items.entries()) {
    item.open = index === 0;
  }

  root.classList.add('fq-live');
}
