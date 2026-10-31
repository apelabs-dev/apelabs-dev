// Checks that every string in src/lib/copy.ts appears verbatim in the approved copy deck.
// Usage: node scripts/check-copy.ts <path-to-site-copy-deck.md>
import { readFileSync } from 'node:fs';
import * as copy from '../src/lib/copy.ts';

const deckPath = process.argv[2];
if (!deckPath) {
  console.error('usage: node scripts/check-copy.ts <site-copy-deck.md>');
  process.exit(2);
}
const deck = readFileSync(deckPath, 'utf8').replace(/\s+/g, ' ');

// Section indexes ('01') and structural keys are layout, not copy.
const SKIP = /^\d\d$/;
const missing: string[] = [];
let checked = 0;

function walk(value: unknown, path: string) {
  if (typeof value === 'string') {
    if (SKIP.test(value)) return;
    checked++;
    if (!deck.includes(value.replace(/\s+/g, ' '))) missing.push(`${path}: ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}[${i}]`));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
  }
}

for (const [name, value] of Object.entries(copy)) walk(value, name);

console.log(`${checked} strings checked, ${missing.length} not found verbatim in the deck`);
for (const m of missing) console.log('  ' + m);
process.exit(missing.length ? 1 : 0);
