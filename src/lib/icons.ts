import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type IconSet = 'lucide' | 'simple';

const PACKAGES: Record<IconSet, string> = {
  lucide: 'lucide-static',
  simple: 'simple-icons',
};

const SVG_RE = /<svg\b([^>]*)>([\s\S]*?)<\/svg>/i;
const VIEWBOX_RE = /viewBox=["']([^"']+)["']/i;

export interface IconData {
  viewBox: string;
  body: string;
}

/**
 * Read an icon's SVG from its package at build time and return the inner markup.
 * Throws on an unknown set or a missing file so a typo fails the build, not the page.
 */
export function iconData(set: IconSet, name: string): IconData {
  const pkg = PACKAGES[set];
  if (!pkg) {
    throw new Error(`Icon.astro: unknown icon set "${set}" (expected "lucide" or "simple")`);
  }

  const relative = `node_modules/${pkg}/icons/${name}.svg`;

  let raw: string;
  try {
    raw = readFileSync(join(process.cwd(), relative), 'utf8');
  } catch {
    throw new Error(`Icon.astro: no ${set} icon "${name}" (expected ${relative})`);
  }

  const match = raw.match(SVG_RE);
  if (!match) {
    throw new Error(`Icon.astro: ${relative} is not a single <svg> element`);
  }

  const viewBox = match[1].match(VIEWBOX_RE)?.[1] ?? '0 0 24 24';
  // simple-icons ships a <title>; the component supplies its own accessible name.
  const body = match[2].replace(/<title>[\s\S]*?<\/title>/gi, '').trim();

  return { viewBox, body };
}
