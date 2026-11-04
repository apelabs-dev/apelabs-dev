// Page titles, metas and OG text from copy/seo.md §3, plus the JSON-LD from §4.
// Schema claims only what the visible copy already says (no address, phone, ratings or people).
import { SITE_URL, EMAIL } from './site';
import { FAQ } from './copy';

export interface PageMeta {
  path: string;
  /** Breadcrumb name for inner pages. */
  name: string;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
}

export const PAGES = {
  home: {
    path: '/',
    name: 'Home',
    title: 'apeLabs | We fix and build business systems',
    description:
      'We fix and build the business systems small teams run on. Something stopped working? Start with a free diagnostic of one broken thing.',
    ogTitle: 'We fix and build the business systems small teams run on',
    ogDescription:
      'apeLabs is a small studio. We start with repair: a free diagnostic, then a fixed quote. We also build with AI where it helps.',
  },
  diagnostic: {
    path: '/diagnostic/',
    name: 'Free diagnostic',
    title: 'Free diagnostic for a broken automation | apeLabs',
    description:
      "Request a free, bounded look at one broken workflow. You get a written note on what's broken and one fixed quote. No passwords needed.",
    ogTitle: 'Request a free diagnostic',
    ogDescription: 'Tell us about one problem. A person reads it and replies within one business day.',
  },
  blog: {
    path: '/blog/',
    name: 'Blog',
    title: 'Teardowns and notes on broken business systems | apeLabs',
    description:
      'Plain-English notes on why automations fail without an error and how to catch it. One post every two weeks.',
    ogTitle: 'apeLabs notes',
    ogDescription: 'How business systems fail without an error, and how to catch it.',
  },
  privacy: {
    path: '/privacy/',
    name: 'Privacy note',
    title: 'Privacy note | apeLabs',
    description: 'What the request form collects, how long we keep it, and how to have it deleted.',
    ogTitle: 'Privacy note | apeLabs',
    ogDescription: 'What the request form collects, how long we keep it, and how to have it deleted.',
  },
} satisfies Record<string, PageMeta>;

const ORG_ID = `${SITE_URL}/#org`;

export function organizationLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': ORG_ID,
    name: 'apeLabs',
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/icon-512.png`,
    image: `${SITE_URL}/og/og-image.png`,
    description:
      'A small studio that fixes and builds the business systems small teams run on. Repair comes first, and we build with AI where it helps.',
    email: EMAIL,
    areaServed: { '@type': 'Country', name: 'United States' },
    serviceType: [
      'Automation and integration repair',
      'AI systems setup',
      'Second opinion on an app or critical flow',
      'AI workshop',
      'Custom workflow and integration development',
    ],
    knowsAbout: ['Zapier', 'Make', 'n8n', 'GoHighLevel', 'HubSpot', 'Pipedrive', 'Airtable', 'QuickBooks'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'apeLabs services',
      itemListElement: [
        {
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Service',
            name: 'Free diagnostic',
            description: 'A free, bounded look at one problem, with a written note and one fixed quote.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Automation and integration repair' },
          priceSpecification: {
            '@type': 'PriceSpecification',
            price: '150',
            priceCurrency: 'USD',
            description: 'Repairs start at $150. Fixed quote before work.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'AI systems setup' },
          priceSpecification: {
            '@type': 'PriceSpecification',
            price: '300',
            priceCurrency: 'USD',
            description: 'From $300. Bigger setups quoted.',
          },
        },
        {
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: 'Care plan' },
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '120',
            priceCurrency: 'USD',
            unitText: 'MONTH',
          },
        },
      ],
    },
  };
}

export function websiteLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'apeLabs',
    url: `${SITE_URL}/`,
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbLd(page: PageMeta): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: page.name, item: `${SITE_URL}${page.path}` },
    ],
  };
}

/** FAQPage built from the same items the page renders, so markup and visible text stay identical. */
export function faqLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
