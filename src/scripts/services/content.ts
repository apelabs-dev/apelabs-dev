// Approved deck §3. Full service lines stay in server-rendered disclosures.
export interface Service {
  id: 'setup' | 'opinion' | 'build' | 'workshop';
  name: string;
  price: string;
  slot: string;
  line: string;
  detail: string;
}

export const services: readonly Service[] = [
  {
    id: 'setup',
    name: 'AI systems setup',
    price: 'from $300',
    slot: 'services-ai-systems-setup',
    line: 'One AI workflow or assistant, set up on the tools you already use. For example, a drafting assistant tied to your inbox, or a step that sorts incoming requests. Bigger setups are quoted before we start. If you want the AI to run locally or keep your data private, we set that up too, and you buy the hardware directly, at cost.',
    detail: '',
  },
  {
    id: 'opinion',
    name: 'Second opinion',
    price: '$250',
    slot: 'services-second-opinion',
    line: "Someone built you a small app or a critical flow, and you want to know if it holds up. We review one of them and send written findings in three days: what's solid, what's risky, and what we'd change.",
    detail: '',
  },
  {
    id: 'build',
    name: 'Custom builds',
    price: 'quote only',
    slot: 'services-custom-builds',
    line: "For when the thing you need doesn't exist yet. We start with the free diagnostic, then send a quote for the build before any work starts. We build with AI where it helps.",
    detail: '',
  },
  {
    id: 'workshop',
    name: 'AI workshop',
    price: '$400',
    slot: 'services-ai-workshop',
    line: "Two hours for your team, up to ten people, built around the tools you already use. Bring the tasks your team repeats every week, and we work through where AI helps with them and where it doesn't.",
    detail: '',
  },
];

export const treatment = 'Deliverable diagram';
// One honest note per panel, in the footer.
export const note = 'Illustration · sample data';

export const label = 'More services';
export const heading = "Repair is how most people start. Here's what else we do.";
export const lede = 'We also build, and we build with AI where it helps.';
export const after = {
  text: "Not sure which one you need? Start with the diagnostic and we'll point you to the right one.",
  cta: 'Request a free diagnostic',
  href: '#08-contact',
  moreLabel: 'More about the services',
  lead: 'Each of these is a small, scoped job, and you see the price first.',
  question: 'Which fits?',
  items: [
    'Something is broken: repair.',
    "Something doesn't exist yet: a build, or an AI systems setup.",
    'It works now and you want it to stay that way: the care plan, after a repair.',
  ],
};

export const escapeHTML = (s: unknown): string =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
