export interface ProofFact {
  icon: string;
  label: string;
  text: string;
}

export interface ProofLink {
  label: string;
  href: string;
  arrow?: boolean;
}

export interface ProofCut {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProofElement {
  src: string;
  nativeWidth: number;
  nativeHeight: number;
  widths: number[];
  sizes: string;
  alt: string;
  crop: ProofCut;
}

export interface ProofVideo {
  src: string;
  poster: string;
  captions: string;
  width: number;
  height: number;
  label: string;
}

export interface ProofProject {
  key: 'sur9e' | 'hf';
  name: string;
  wordmark?: { src: string; alt: string; width: number; height: number };
  lockup?: string;
  mark?: { src: string; width: number; height: number };
  desc: string;
  tag: string;
  links: ProofLink[];
  frameFill: string;
  max: number;
  element: ProofElement;
  video?: ProofVideo;
  caption?: string;
  facts: ProofFact[];
}

export const SECTION = {
  label: 'Proof',
  heading: "Apps we've built.",
  line: 'Two products we designed, built and run ourselves.',
} as const;

export const PROJECTS: ProofProject[] = [
  {
    key: 'sur9e',
    name: 'sur9e',
    wordmark: { src: '/assets/proof/sur9e-logo.svg', alt: 'sur9e', width: 1063, height: 234 },
    desc: 'A local-first job-search toolkit.',
    tag: 'public, open source',
    links: [
      { label: 'See sur9e', href: 'https://sur9e.com', arrow: true },
      { label: 'GitHub', href: 'https://github.com/apelabs-dev/sur9e' },
    ],
    frameFill: '#131315',
    max: 792,
    element: {
      src: '/assets/proof/sur9e-element.png',
      nativeWidth: 1584,
      nativeHeight: 400,
      widths: [792, 1584],
      sizes: '(min-width: 1024px) 640px, (min-width: 824px) 792px, calc(100vw - 72px)',
      alt: 'A job report header from the sur9e app: the role, company, location and pay, scored 4.2 out of 5 with high confidence.',
      crop: { x: 0, y: 0, w: 1584, h: 400 },
    },
    facts: [
      {
        icon: 'search-x',
        label: 'The problem',
        text: 'Job hunting means rereading the same postings, rewriting a CV for every role and tracking it all by hand, and most tools want your data in their cloud.',
      },
      {
        icon: 'hammer',
        label: 'What we built',
        text: 'An open-source toolkit that runs on your own machine and drives your own AI coding agent. No accounts, no telemetry.',
      },
      {
        icon: 'list-checks',
        label: 'Key features',
        text: 'Screens postings against your CV, dealbreakers and pay targets, tailors a CV per offer, preps interviews and tracks applications in a local web app.',
      },
      {
        icon: 'users',
        label: "Who it's for",
        text: 'Job seekers who want AI help without handing their search history to another service.',
      },
    ],
  },
  {
    key: 'hf',
    name: 'Hermes Finances',
    lockup: 'Hermes Finances',
    mark: { src: '/assets/proof/hf-icon.svg', width: 30, height: 30 },
    desc: 'A self-hosted finance dashboard.',
    tag: 'public beta',
    links: [
      { label: 'Try the demo', href: 'https://financing.apelabs.dev/demo/', arrow: true },
      { label: 'GitHub', href: 'https://github.com/apelabs-dev/hermes-finance' },
    ],
    frameFill: 'linear-gradient(#161a25, #141a23 6%, #151821 31%)',
    max: 792,
    element: {
      src: '/assets/proof/hf-element-ring.png',
      nativeWidth: 664,
      nativeHeight: 528,
      widths: [416, 664],
      sizes: '(min-width: 1024px) 416px, (min-width: 448px) 416px, calc(100vw - 72px)',
      alt: 'The "Where it went" doughnut from the hermes-finance demo, with the month total in the middle.',
      crop: { x: 0, y: 0, w: 664, h: 528 },
    },
    // The 42 s promo cut replaces the doughnut: the cover is the poster, nothing loads until Play.
    video: {
      src: '/assets/proof/hf-video/hermes-finance.mp4',
      poster: '/assets/proof/hf-video/hermes-finance-poster.jpg',
      captions: '/assets/proof/hf-video/hermes-finance.en.vtt',
      width: 1920,
      height: 1080,
      label: 'Hermes Finances: I canceled my budget app (42 second video, with captions)',
    },
    caption: 'Demo video, 42s, AI actors, synthetic data',
    facts: [
      {
        icon: 'wallet',
        label: 'The problem',
        text: "Finance dashboards keep your bank data on someone else's server, and letting an AI assistant near your accounts feels like a risk.",
      },
      {
        icon: 'server',
        label: 'What we built',
        text: "A self-hosted dashboard that keeps everything in a local database. An AI agent can read it but can't change anything without your approval.",
      },
      {
        icon: 'shield-check',
        label: 'Key features',
        text: "Bank sync, budgets and goals in one place. Bank tokens never show up in pages or logs, and the server won't start if it would be exposed unguarded.",
      },
      {
        icon: 'house',
        label: "Who it's for",
        text: 'A household that wants its money in one place and under its own roof. US banks for now.',
      },
    ],
  },
];

/** The derivative file name for an element at a width and extension. */
export function derivedName(src: string, width: number, ext: 'avif' | 'webp'): string {
  const base = src.split('/').pop()?.replace(/\.png$/, '') ?? '';
  return `/assets/proof/derived/${base}-${width}.${ext}`;
}

/** The srcset for an element's AVIF or WebP derivatives. */
export function srcsetFor(element: ProofElement, ext: 'avif' | 'webp'): string {
  return element.widths.map((width) => `${derivedName(element.src, width, ext)} ${width}w`).join(', ');
}
