// Approved site copy (copy deck 2026-10-30), verbatim. Structured here so sections,
// subpages and JSON-LD render identical text. Do not edit wording without a deck change.

export const HERO = {
  eyebrow: 'apeLabs / business system repair',
  h1: 'We fix and build the business systems small teams run on.',
  subhead:
    "When something stops working and nobody notices, start with a free diagnostic. We look at one broken thing and tell you what we found, whatever it's built on.",
  secondary: 'See what you get back',
  microline: 'Free. No passwords needed. We reply within one business day.',
};

export const TRACE = {
  label: 'ILLUSTRATIVE TRACE · fictional business · not a client record',
  title: 'Online booking → CRM → confirmation text',
  run: '[example run]',
  lines: [
    { time: '09:02:11', kind: 'TRIGGER', text: 'New booking received', status: '' },
    { time: '09:02:11', kind: 'CHECK', text: 'Booking type matches workflow filter?', status: 'NO MATCH' },
    { time: '09:02:12', kind: 'STEP 1', text: 'Create CRM contact', status: 'SKIPPED' },
    { time: '09:02:12', kind: 'STEP 2', text: 'Send confirmation text', status: 'SKIPPED' },
    { time: '09:02:12', kind: 'ALERT', text: 'Notify the office', status: 'NONE SENT' },
  ],
  before: 'The customer booked. The office never found out.',
  after: 'Fixed against the check we agreed before work started.',
  footnote: 'Sample data, made up to show the format.',
  a11yNote: 'This trace is sample data. Read it top to bottom: trigger, check, skipped steps, no alert.',
  reducedMotion: 'Motion is off. The same steps are listed below.',
  chapters: [
    { name: 'Trigger fires', text: 'A booking comes in.' },
    { name: 'Step fails', text: 'The workflow ignores it, and no error shows anywhere.' },
    { name: 'Alert absent', text: 'Nobody is told.' },
    { name: 'Diagnosis', text: "The booking type was missing from the workflow's trigger filter." },
    { name: 'Patch', text: "Add the type to the filter, plus an alert for any booking that doesn't match." },
    { name: 'Verified rerun', text: 'A test booking creates the contact and sends the text.' },
  ],
};

export const REPAIR = {
  index: '01',
  label: 'Repair',
  hook: ['The automation broke. Nobody got told.', 'We find the step that stopped.'],
  h2: 'We repair automations and integrations that stopped working without saying so.',
  lead: 'A form submits and never reaches your CRM. A lead lands and nobody is alerted. An invoice handoff stalls with no error. You usually find out when a customer goes cold or a record goes missing. We trace the break, fix it, and rerun the workflow to show it works.',
  rows: [
    {
      symptom: 'Leads from your website form never show up in the CRM.',
      check: 'The trigger, field mappings, permissions and tokens, error paths.',
      result: 'We name the break and give you the fix and a fixed quote.',
    },
    {
      symptom: 'Bookings go through, but the confirmation text or reminder never fires.',
      check: 'Workflow filters, enrollment rules, rate limits, alerting.',
      result: 'A written finding, and a repair that has to pass a check we agree on first.',
    },
    {
      symptom: 'Records are duplicated, overwritten or missing after a sync.',
      check: 'Matching rules, webhook retries, and what happens when a step fails halfway.',
      result: 'The cause, the repair, and an alert so the next failure gets noticed.',
    },
  ],
  tools:
    'We work on what you already run: Zapier, Make, n8n, GoHighLevel, HubSpot, Pipedrive, Airtable, Google Sheets, QuickBooks, payment tools, and custom code.',
  toolNames: ['Zapier', 'Make', 'n8n', 'GoHighLevel', 'HubSpot', 'Pipedrive', 'Airtable', 'Google Sheets', 'QuickBooks', 'payment tools', 'custom code'],
  otherStack: "Built on something else? Send it anyway. If it's outside what we can fix, we'll say so in the first reply.",
  how: [
    'You get a fixed quote before any work starts. Repairs start at $150.',
    'We agree a written acceptance check in advance.',
    "If the repair doesn't pass that check, you don't pay. 14-day warranty on the same issue.",
  ],
  care: 'Care plan $120/mo, after a paid repair. It covers a monthly health check, alerts when something fails without an error, small fixes up to an hour, and a reply within one business day.',
};

export const SERVICES = {
  index: '02',
  label: 'More services',
  h2: "Repair is how most people start. Here's what else we do.",
  intro: 'We also build, and we build with AI where it helps. Each of these is a small, scoped job, and you see the price first.',
  menu: [
    {
      name: 'AI systems setup',
      price: 'from $300',
      text: 'One AI workflow or assistant on the tools you already use. Bigger setups are quoted. Local or private AI is included; you buy the hardware directly, at cost.',
    },
    { name: 'Second opinion', price: '$250', text: 'One small app or critical flow, written findings, in three days.' },
    { name: 'AI workshop', price: '$400', text: 'Two hours, up to ten people.' },
    { name: 'Custom builds', price: 'quote only', text: 'after the diagnostic.' },
  ],
  notSure: "Not sure which one you need? Start with the diagnostic and we'll point you to the right one.",
  fitsLabel: 'Which fits?',
  fits: [
    { when: 'Something is broken', then: 'repair.' },
    { when: "Something doesn't exist yet", then: 'a build, or an AI systems setup.' },
    { when: 'It works now and you want it to stay that way', then: 'the care plan, after a repair.' },
  ],
};

export const DIAGNOSTIC_COPY = {
  index: '03',
  label: 'Free diagnostic',
  h2: 'Request a free diagnostic',
  lead: "Tell us about one problem. We'll take a free, bounded look and send you a short written note on what's broken, plus one fixed quote if you want it fixed.",
  lookAtLabel: 'What we look at:',
  lookAt: [
    'The trigger, and whether it fires',
    'Permissions, logins and tokens',
    'Field mappings',
    'Rate limits',
    'Webhooks and error paths',
    'Whether anyone gets alerted when a step fails',
  ],
  getBackLabel: 'What you get back:',
  getBack: [
    "A short written note: what's broken and the likely fix.",
    'One fixed quote for the repair.',
    'The note is yours to keep, with no obligation. The repair is quoted separately.',
  ],
  dontNeedLabel: "What we don't need:",
  dontNeed:
    'passwords. Never send them, in this form or anywhere else. We do the look on a screen-share: you drive and we watch.',
  nextLabel: 'What happens next:',
  next: [
    'You send the form.',
    'A person at apeLabs reads it and replies within one business day. Nothing is scanned or scored automatically.',
    "If it's a fit, we send a link to book a short call over Google Meet.",
    'You get the written note and the quote.',
  ],
};

export const FORM_COPY = {
  requiredNote:
    "Fields marked * are required. We don't ask for a budget or a phone number, and you don't need a call to ask.",
  name: { label: 'Your name', helper: 'What should we call you?' },
  email: { label: 'Work email', helper: "We'll reply here." },
  business: { label: 'Business name or website', helper: 'So we know whose system this is.' },
  tools: {
    label: 'Which tools are involved?',
    options: [
      'Zapier',
      'Make',
      'n8n',
      'GoHighLevel',
      'HubSpot',
      'Pipedrive',
      'Airtable',
      'Google Sheets',
      'QuickBooks',
      'A payment tool',
      'Custom code',
      'Not sure',
    ],
    other: 'Other (type it)',
  },
  problem: {
    label: 'What should happen, and what happens instead? Who or what does it affect?',
    placeholder:
      "When someone books online, they should land in the CRM and get a text. About half don't, and we only find out when they call.",
    helper: 'Plain words are fine. One problem per request.',
  },
  noticed: { label: 'When did you first notice it?', options: ['This week', 'This month', 'Longer ago', 'Not sure'] },
  extra: { label: 'Anything else we should know?' },
  spam: { label: "Checking you're a person" },
  submit: 'Send my request',
  underButton:
    "Please don't include passwords, API keys or customer data. If we need something sensitive later, we'll tell you how to share it safely.",
  confirmation: {
    heading: "Got it. We'll be in touch within one business day.",
    body: "A person at apeLabs will read your request and reply to the email you gave us. If it's a fit for a free diagnostic, we'll send a link to book a short call over Google Meet.",
    until: "Until then, please don't send passwords or customer data. We won't ask for them.",
    signoff: 'apeLabs',
  },
  privacyToggle: 'How we handle this',
};

export const PRIVACY_NOTE = [
  {
    term: 'What we collect',
    text: "the fields you fill in above, plus basic site analytics that don't track you across sites (Cloudflare Web Analytics, no cookies).",
  },
  { term: 'Why', text: 'to reply to your request and decide if we can help.' },
  { term: 'Who sees it', text: "the people at apeLabs. We don't sell it or share it for marketing." },
  {
    term: 'How long we keep it',
    text: "90 days if we don't work together, then we delete it. If we do work together, we keep what the work needs and delete the rest at handoff.",
  },
  { term: 'Deletion', text: "email hello@apelabs.dev and we'll delete your request." },
  { term: 'Your passwords', text: "we never ask for them. Don't put credentials or customer data in this form." },
  { term: 'Spam protection', text: 'Cloudflare Turnstile checks the form before it sends.' },
];

export const PROOF = {
  index: '04',
  label: 'Proof',
  h2: 'What our work looks like.',
  lead: "We're a new studio and don't have client repair records to show yet, and we won't invent them. What we can show is a sample finding in the format you'd get, and two tools we built and maintain ourselves.",
  sample: {
    labelBar: 'ILLUSTRATIVE SAMPLE · fictional business · not a client, not a case study',
    intro: 'Free, bounded look at one problem.',
    meta: [
      { term: 'Business', text: 'Harbor Plumbing Co. (fictional)' },
      { term: 'Workflow', text: 'online booking → CRM contact + confirmation text' },
      { term: 'Systems', text: 'Calendly → HubSpot' },
    ],
    symptomLabel: 'Symptom (as reported)',
    symptom:
      '"Customers book online but half the time they never get the confirmation text, and the office doesn\'t see them in the CRM until they call."',
    should: { term: 'Should happen', text: 'a booking creates a CRM contact and a deal, then a confirmation text goes out.' },
    actually: { term: 'Actually happens', text: 'some bookings appear in the scheduler only.' },
    evidenceLabel: 'Evidence (what we observed)',
    evidence: [
      'A booking from Tuesday is in the scheduler with status Active.',
      "The CRM workflow has no enrollment for it, though Monday's booking enrolled normally.",
      "Tuesday's booking used a different event type from Monday's. The owner says it was added last month for emergency calls.",
    ],
    causeLabel: 'Likely cause',
    cause:
      'The new "Emergency call" event type isn\'t connected to the integration that creates the CRM contact, so its bookings never start the workflow.',
    confidence:
      "Confidence: medium. It fits both bookings and the owner's timeline, but two bookings is a small sample.",
    fixLabel: 'Fix',
    fix: 'Connect the emergency event type to the same booking-to-CRM handoff, and backfill the bookings missed since it was added.',
    checkLabel: 'Acceptance check',
    check:
      'Three test bookings, one per event type, each create one contact and deal within five minutes and send one confirmation text, with no duplicates.',
    quoteLabel: 'Fixed quote (example)',
    quote: ['$350', 'Payment under $500: 100% upfront', 'No fix, no charge, measured against the check above.'],
    footnote: 'Everything here is made up to show the format.',
  },
  builtLabel: 'Built and maintained in-house',
  builds: [
    {
      name: 'sur9e',
      rows: [
        {
          term: 'What',
          text: "A local-first job-search toolkit. It runs on the user's machine and drives their own AI coding agent. No accounts, no telemetry.",
        },
        {
          term: 'Repair record',
          text: 'Most of its history is hardening. Three examples: an expired login now reads as an auth problem instead of a generic failure; batch screening accepts model output with trailing text after the JSON; follow-up timing counts from the day you applied.',
        },
        {
          term: "How it's checked",
          text: 'CI on every change runs a quality gate, a production build, a fresh-clone browser smoke test, a security scan and a check that no private data lands in the repo.',
        },
        { term: 'Status', text: "public, open source, version 0.5.0. We have no usage numbers and aren't claiming any." },
      ],
    },
    {
      name: 'hermes-finance',
      rows: [
        {
          term: 'What',
          text: "A self-hosted finance dashboard whose data stays in a local database. An AI agent can read it and can't change it without approval.",
        },
        {
          term: 'Built for sensitive data',
          text: 'bank tokens never appear in pages or logs, and the server refuses to start if it would be reachable with nothing guarding it.',
        },
        {
          term: "How it's checked",
          text: 'CI runs the non-browser test suite and a privacy scan on every push. A nightly job runs a real-browser suite with layout and number checks.',
        },
        { term: 'Status', text: 'public beta, version 0.2.5. No users or revenue claimed. One household, US banks only.' },
      ],
    },
  ],
  closing:
    "When we have client repairs we're allowed to show, they'll go here as dated records: symptom, evidence, repair, rerun. Until then, this section stays as it is.",
};

export const PROCESS = {
  index: '05',
  label: 'Process',
  h2: 'How a repair runs, from request to handoff.',
  steps: [
    { name: 'Request.', text: 'Send the form. We read it and reply within one business day.' },
    { name: 'Inspect.', text: 'A short screen-share call where you drive and we look. No passwords needed.' },
    {
      name: 'Finding and quote.',
      text: "A written note on what's broken, plus one fixed quote. The note is yours to keep, with no obligation.",
    },
    {
      name: 'Repair.',
      text: "You approve the quote and the acceptance check. You add a named user with limited access, we fix the problem, and we remove that user when we're done. Jobs under $500 are paid upfront; larger jobs are half upfront.",
    },
    {
      name: 'Rerun and handoff.',
      text: 'We run the check we agreed on, show you it passes, and hand over what we changed. If the same issue comes back within 14 days, we fix it at no charge.',
    },
  ],
  strip: ['failed', 'diagnosed', 'patched', 'verified'],
};

export const FAQ = {
  index: '06',
  label: 'Questions',
  h2: 'What people ask before they write.',
  items: [
    {
      q: 'What do I get from the free diagnostic?',
      a: "A free, bounded look at one problem over a screen-share. Afterwards you get a short written note on what's broken and the likely fix, plus one fixed quote for the repair. The note is yours whether or not you hire us.",
    },
    {
      q: 'What costs money?',
      a: 'The repair itself, after you approve the fixed quote. Repairs start at $150. AI systems setup, second opinions, workshops, custom builds and the care plan are paid too. The diagnostic is free.',
    },
    {
      q: 'How do you price repairs?',
      a: 'One fixed number, quoted before any work starts. Under $500 is paid in full upfront. At $500 and above, half is paid upfront and half when the fix passes the check. Invoices are due within seven days. If the scope changes, you get a new quote first.',
    },
    {
      q: 'Which tools do you work with?',
      a: "Zapier, Make, n8n, GoHighLevel, HubSpot, Pipedrive, Airtable, Google Sheets, QuickBooks, payment tools and custom code. If yours isn't listed, ask. If we can't fix it, we'll tell you in the first reply.",
    },
    {
      q: 'Do you need my passwords?',
      a: 'No, and please never send them. The diagnostic is a screen-share where you drive. For paid work we ask you to add a named user with limited access, and we remove it when we hand over. We never take shared logins, owner seats, billing access or exports of your customer data.',
    },
    {
      q: 'Is my data safe?',
      a: "We keep access to the minimum, avoid copying customer data, and only work inside the systems the repair needs. For finance-sector systems we test on a sandbox or a copy first. We don't claim any security audit or certification.",
    },
    {
      q: 'How long does a repair take?',
      a: 'It depends on the break, and the quote gives you a date. We work evenings and weekends around other commitments, so we state the timeline up front instead of promising a speed.',
    },
    {
      q: "What if you can't fix it?",
      a: "You don't pay. Before work starts we agree in writing on an acceptance check, and if the repair doesn't pass it, there's no charge. If we find mid-repair that it can't be fixed the way we quoted, we stop and tell you.",
    },
    {
      q: "What's the warranty?",
      a: '14 days on the same issue after handoff. If the same thing breaks again in that window, we fix it at no charge.',
    },
    {
      q: 'What do you not do?',
      a: '24/7 on-call, rebuilding a whole platform inside a fix, full database migrations, live payment or ledger changes without a sandbox test, marketing, ads or SEO work, and hardware repair. Anything outside the quote gets its own quote.',
    },
    {
      q: 'Is there support after the fix?',
      a: "Yes, if you want it. The care plan is $120 a month: a monthly health check, alerts on failures that throw no error, small fixes up to an hour, and a reply within one business day. It's available after a paid repair.",
    },
    {
      q: 'Who are you?',
      a: 'apeLabs is a small studio. We work remotely with US clients. This site shows no people or logos, and everything on it is either something we built or something labeled as a sample.',
    },
    {
      q: 'Do you build new things, or only repair?',
      a: 'Both. Repair is where most people start. We also build with AI where it helps, set up AI workflows, and take on custom builds by quote after a diagnostic. See More services above.',
    },
    {
      q: 'How do you use AI in your own work?',
      a: 'We work with an AI-assisted workflow. It drafts code, tests and documentation much faster than typing everything by hand, so your fix ships sooner and costs less. A person plans every job, decides what gets built, reviews each change and runs the final check before anything reaches you. The AI speeds up the work; it never makes the calls.',
    },
    {
      q: 'What does AI systems setup include?',
      a: 'One AI workflow or assistant, set up on the tools you already use, from $300. Two examples: a drafting assistant tied to your inbox, or a step that sorts incoming requests. Bigger setups are quoted before we start. If you want the AI to run locally or keep your data private, we set that up too. You buy the hardware directly, so you pay what it costs.',
    },
    {
      q: 'Do you work with individuals?',
      a: "Mostly small teams, about 5 to 50 people. If you're on your own and something is broken, ask anyway, and we'll tell you whether it's a fit.",
    },
    {
      q: "What's a second opinion?",
      a: "$250 for one small app or one critical flow someone built for you. You get written findings in three days: what's solid, what's risky, and what we'd change.",
    },
    {
      q: 'Who is the AI workshop for?',
      a: "Teams of up to ten. It runs two hours, costs $400, and is built around the tools your team already uses.",
    },
    {
      q: 'Where are you based?',
      a: 'We work remotely with clients across the US. All calls are on Google Meet.',
    },
  ],
};

export const CONTACT = {
  index: '07',
  label: 'Contact',
  h2: 'Got something that quietly stopped working?',
  body: "Tell us about one problem. We're a small studio, we read every request, and we answer within one business day.",
  emailLead: 'Prefer email?',
  coverage: 'Remote, serving the US. Calls over Google Meet.',
  signoff: 'apeLabs',
};

// Form error and edge states (deck section 4).
export const FORM_ERRORS = {
  required: 'We need this one to reply to you.',
  email: "That email doesn't look right. Check it and try again.",
  spam: "The spam check didn't pass. Reload the page and try again, or email hello@apelabs.dev.",
  send: "That didn't go through. Email hello@apelabs.dev with the same details and we'll pick it up.",
} as const;
