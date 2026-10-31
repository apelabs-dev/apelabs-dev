// Site-wide constants. Copy comes from the approved copy deck (section 0 and 9).

export const SITE_URL = 'https://apelabs.dev';
export const EMAIL = 'hello@apelabs.dev';
export const CTA_LABEL = 'Request a free diagnostic';
export const TAGLINE = 'We fix and build the business systems small teams run on.';

export interface NavItem {
  label: string;
  /** Section id on the home page. */
  anchor: string;
  /** Standalone page for the same section. */
  page: string;
}

// Deck section 0, left to right.
export const NAV: NavItem[] = [
  { label: 'Repair', anchor: 'repair', page: '/repair/' },
  { label: 'More services', anchor: 'services', page: '/build-and-care/' },
  { label: 'Proof', anchor: 'proof', page: '/proof/' },
  { label: 'Process', anchor: 'process', page: '/process/' },
  { label: 'FAQ', anchor: 'faq', page: '/faq/' },
];

export const DIAGNOSTIC = { anchor: 'diagnostic', page: '/diagnostic/' };

/**
 * One scheme everywhere: on the home page (the whole story) nav links jump to the
 * section anchors; on every other page they go to the standalone pages.
 */
export function navHref(item: { anchor: string; page: string }, onHome: boolean): string {
  return onHome ? `#${item.anchor}` : item.page;
}

// Deck section 9 footer links.
export const FOOTER_LINKS = [
  ...NAV.map(({ label, page }) => ({ label, href: page })),
  { label: 'Blog', href: '/blog/' },
  { label: 'Privacy', href: '/privacy/' },
];
