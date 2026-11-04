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

// Deck section 0, left to right. The standalone section pages were retired on 2026-11-04 (they 301 to
// these landing anchors, see public/_redirects), so from inner pages every link goes to the landing section.
export const NAV: NavItem[] = [
  { label: 'Repair', anchor: 'repair', page: '/#04-journey' },
  { label: 'Process', anchor: 'process', page: '/#jr-diagnostic' },
  { label: 'More services', anchor: 'services', page: '/#05-services' },
  { label: 'Proof', anchor: 'proof', page: '/#06-proof' },
  { label: 'FAQ', anchor: 'faq', page: '/#07-faq' },
];

/** /diagnostic/ stays as the no-JS form fallback (native posts land on it and on /diagnostic/thanks/). */
export const DIAGNOSTIC = { anchor: 'diagnostic', page: '/diagnostic/' };
/** The live contact form on the landing page. */
export const CONTACT_HREF = '/#08-contact';

/**
 * One scheme everywhere: on the home page (the whole story) nav links jump to the
 * section anchors; on every other page they go to the standalone pages.
 */
export function navHref(item: { anchor: string; page: string }, onHome: boolean): string {
  return onHome ? `#${item.anchor}` : item.page;
}

/** Every "Request a free diagnostic" CTA: jump to the form when it is on this page. */
export function ctaHref(pathname: string): string {
  return pathname === DIAGNOSTIC.page ? `#${DIAGNOSTIC.anchor}` : CONTACT_HREF;
}

// Deck section 9 footer links.
export const FOOTER_LINKS = [
  ...NAV.map(({ label, page }) => ({ label, href: page })),
  { label: 'Blog', href: '/blog/' },
  { label: 'Privacy', href: '/privacy/' },
];
