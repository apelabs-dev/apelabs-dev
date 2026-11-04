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
  repair: {
    path: '/repair/',
    name: 'Repair',
    title: 'Fix broken automations and integrations | apeLabs',
    description:
      'A form that never reaches the CRM. A booking with no confirmation. We find the break, fix it and rerun it to show it works. Fixed quote first.',
    ogTitle: 'We repair automations that stopped without saying so',
    ogDescription:
      'Zapier, Make, n8n, HubSpot, GoHighLevel, Airtable and more. Free diagnostic, fixed quote, and no charge if the fix fails the agreed check.',
  },
  services: {
    path: '/build-and-care/',
    name: 'More services',
    title: 'AI systems setup, second opinions, custom builds | apeLabs',
    description:
      'Beyond repair: AI systems setup from $300, second opinion $250, AI workshop $400, and custom builds by quote. Start with a free diagnostic.',
    ogTitle: 'What else we build',
    ogDescription:
      'One AI workflow on your existing tools, a written second opinion, a team workshop, or a custom build. Prices shown up front.',
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
  proof: {
    path: '/proof/',
    name: 'Proof',
    title: "Sample finding and what we've built | apeLabs",
    description:
      "A labeled sample of the written finding you'd get, plus two tools we built and maintain ourselves: sur9e and hermes-finance.",
    ogTitle: 'What our work looks like',
    ogDescription:
      'No invented clients. A labeled sample finding and two open-source builds, with the checks behind them.',
  },
  process: {
    path: '/process/',
    name: 'Process',
    title: 'How apeLabs repairs a broken automation',
    description:
      'Request, inspect, written finding and fixed quote, repair, then a rerun and handoff. The price is fixed before any work starts.',
    ogTitle: 'How a repair runs',
    ogDescription: 'From your request to a verified rerun. Fixed quote before work, 14-day warranty after.',
  },
  faq: {
    path: '/faq/',
    name: 'FAQ',
    title: 'Automation repair FAQ: pricing, access, guarantee | apeLabs',
    description:
      'What the free diagnostic includes, how repairs are priced, why we never need your passwords, and what we don\'t do.',
    ogTitle: 'Questions before you write',
    ogDescription: 'Pricing, tools, access, security, turnaround and warranty.',
  },
  contact: {
    path: '/contact/',
    name: 'Contact',
    title: 'Contact apeLabs',
    description:
      'Request a free diagnostic or email hello@apelabs.dev. Remote studio serving the US. We reply within one business day.',
    ogTitle: 'Got something that quietly stopped working?',
    ogDescription: 'Tell us about one problem. We read every request.',
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
