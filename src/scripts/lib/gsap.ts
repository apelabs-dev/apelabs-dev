import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const REGISTERED = '__apeGsapRegistered' as const;
type Flagged = typeof globalThis & { [REGISTERED]?: boolean };
const scope = globalThis as Flagged;

// Only the sections that animate with GSAP import this module, so the library loads with them; register once.
if (!scope[REGISTERED]) {
  gsap.registerPlugin(ScrollTrigger);
  scope[REGISTERED] = true;
}

export { gsap, ScrollTrigger };
