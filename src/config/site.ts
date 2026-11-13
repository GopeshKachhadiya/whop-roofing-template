// Everything a roofing company would change to make this site theirs.
// Swap the values; the layout, checkout and Whop wiring stay as they are.
// Prices live in offers.json (run `pnpm whop:sync` after changing them).
//
// Northgable Roofing is a made-up company. Replace the reviews and
// credentials below with real ones before pointing customers at the site.

export interface Service {
  /** Used in URLs, the estimate form and the `service_viewed` event. */
  key: string
  name: string
  /** One line under the name. */
  summary: string
  /** What the crew actually does on this job. */
  includes: string[]
  /** Short answer to "how long / how much". */
  facts: Array<{ label: string; value: string }>
  /** The offer in offers.json this service sells or leads to. */
  offerKey: string
  /** `buy` checks out the offer now. `quote` asks for an estimate first. */
  action: 'buy' | 'quote'
  /** Button text when `action` is `buy`. */
  buyLabel?: string
}

export const site = {
  company: {
    name: 'Northgable Roofing',
    legalName: 'Northgable Roofing Co.',
    city: 'Tulsa',
    state: 'OK',
    region: 'Tulsa metro',
    phone: '(918) 555-0142',
    /** Example shown in the phone field. */
    phoneExample: '(918) 555-0100',
    phoneHref: 'tel:+19185550142',
    email: 'office@northgable.example',
    street: '2140 E 6th Street',
    zip: '74104',
    /** ISO country code; the checkout's billing address starts here. */
    country: 'US',
    license: 'Oklahoma roofing registration 80004521',
    /** Drives the clock and the sky in the 3D panel. */
    timeZone: 'America/Chicago',
    founded: 2009,
    hours: [
      { days: 'Monday to Friday', time: '7am to 6pm' },
      { days: 'Saturday', time: '8am to 2pm' },
      { days: 'Storm line', time: 'Open 24 hours' },
    ],
  },

  seo: {
    title: 'Northgable Roofing | Roof repair, replacement and inspection in Tulsa',
    description:
      'Licensed Tulsa roofers. Book a $149 roof inspection online, get a written estimate, and reserve your install date with a $500 deposit.',
  },

  hero: {
    tag: 'Repair, replacement and inspection',
    // Each entry is one line of the big headline.
    headlineLines: ['Six layers.', 'One roof.', 'Zero', 'surprises.'],
    lede: 'Repairs, full replacements and inspections across the Tulsa metro, from a crew that shows you what is going on your house before you pay for it.',
    proof: [
      { value: '2,400+', label: 'roofs since 2009' },
      { value: '10 years', label: 'workmanship warranty' },
      { value: '4.9 of 5', label: 'from 312 homeowners' },
    ],
  },

  // The sentence that lights up word by word as you scroll.
  statement: {
    lead: 'Everything your roof needs, from one crew.',
    rest: 'Inspection, tear-off, decking, shingles and the paperwork, all at one price in writing.',
  },

  // Bottom to top, the order they go on the house. The 3D roof reads these
  // by `key`; edit the names and notes freely.
  layers: [
    {
      key: 'framing',
      name: 'Rafters',
      note: 'The structure. We check every rafter from the attic and sister any that have cracked or sagged.',
    },
    {
      key: 'decking',
      name: 'Roof decking',
      note: '7/16" sheathing nailed to the rafters. Soft or delaminated sheets get replaced, priced per sheet in your estimate.',
    },
    {
      key: 'barrier',
      name: 'Ice and water shield',
      note: 'A self-sealing membrane along the eaves and in every valley, where wind-driven rain gets in first.',
    },
    {
      key: 'underlayment',
      name: 'Synthetic underlayment',
      note: 'The second line of defense over the whole deck. It keeps the house dry if a shingle ever lifts.',
    },
    {
      key: 'shingles',
      name: 'Architectural shingles',
      note: 'Class 4 impact-rated shingles, six nails each, laid to the manufacturer pattern so the wind warranty holds.',
    },
    {
      key: 'ridge',
      name: 'Ridge vent and cap',
      note: 'A vented ridge lets attic heat out, which is what keeps shingles from cooking through an Oklahoma summer.',
    },
  ],

  services: [
    {
      key: 'repair',
      name: 'Roof repair',
      summary: 'A leak, a few missing shingles, a cracked pipe boot. Most are a single visit at one flat price.',
      includes: [
        'Replace up to 10 damaged or missing shingles',
        'Reseal flashing around chimneys, walls and skylights',
        'Replace cracked pipe boots and reset popped nails',
        'Clear valleys and gutters at the roofline',
      ],
      facts: [
        { label: 'Visit', value: '2 to 3 hours' },
        { label: 'Warranty', value: '1 year on repaired areas' },
      ],
      offerKey: 'tuneup',
      action: 'buy',
      buyLabel: 'Book this repair',
    },
    {
      key: 'replacement',
      name: 'Roof replacement',
      summary: 'Tear-off down to the deck and a complete new roof system, usually finished in one or two days.',
      includes: [
        'Full tear-off and haul-away, magnets run over the yard twice',
        'Decking inspected sheet by sheet, replaced where soft',
        'Ice and water shield, synthetic underlayment, new flashing',
        'Class 4 architectural shingles and a vented ridge',
      ],
      facts: [
        { label: 'On site', value: '1 to 2 days' },
        { label: 'Warranty', value: '10 years workmanship' },
      ],
      offerKey: 'deposit',
      action: 'quote',
    },
    {
      key: 'inspection',
      name: 'Roof inspection',
      summary: 'A licensed inspector on the roof and in the attic, with a photo report you can hand to your insurer.',
      includes: [
        'On-roof and drone inspection of every slope',
        'Attic check for leaks, ventilation and deck condition',
        'Photo report with marked-up damage, sent the same day',
        'Written estimate for anything that needs work',
      ],
      facts: [
        { label: 'Visit', value: 'About 1 hour' },
        { label: 'Credit', value: 'Fee comes off any job' },
      ],
      offerKey: 'inspection',
      action: 'buy',
      buyLabel: 'Book an inspection',
    },
  ] satisfies Service[],

  // How a job is paid for, in the order it happens.
  billing: [
    {
      title: 'Inspection',
      body: 'Book online. An inspector walks the roof and sends a photo report with a written estimate.',
      money: 'inspection',
    },
    {
      title: 'Deposit',
      body: 'Happy with the estimate? A deposit orders materials and holds your install date. Your card stays on file.',
      money: 'deposit',
    },
    {
      title: 'Build',
      body: 'The crew tears off, repairs the deck and installs the new roof. You walk it with the foreman before anyone leaves.',
      money: null,
    },
    {
      title: 'Final invoice',
      body: 'The balance, less your deposit, is invoiced after sign-off. It goes on the card on file or to your inbox to pay your way.',
      money: null,
    },
  ],

  financing: {
    headline: 'A new roof.',
    headlineRest: 'Without paying for it all at once.',
    body: 'Choose to pay over time at checkout or on your final invoice. Options such as Klarna, Afterpay and Splitit appear automatically when they are available for your order. There is no separate application on our side.',
    points: [
      'See your options before you commit to anything',
      'Deposit today, balance only after you sign off on the work',
      'Insurance claim? We bill the balance when your carrier pays out',
    ],
  },

  area: {
    headline: 'Tulsa and 35 miles around it',
    body: 'Crews leave from our yard on 6th Street every morning. If your ZIP is on the list, an inspector can usually be on your roof within two working days.',
    radiusMiles: 35,
    rings: [10, 20, 30],
    // Distance and compass bearing from your yard. 0 is north, 90 is east.
    towns: [
      { name: 'Tulsa', miles: 0, bearing: 0, zips: ['74103', '74104', '74105', '74106', '74107', '74108', '74110', '74112', '74114', '74115', '74116', '74119', '74120', '74127', '74128', '74129', '74133', '74134', '74135', '74136', '74137', '74145', '74146'] },
      { name: 'Broken Arrow', miles: 13, bearing: 122, zips: ['74011', '74012', '74014'] },
      { name: 'Owasso', miles: 12, bearing: 22, zips: ['74055'] },
      { name: 'Jenks', miles: 10, bearing: 192, zips: ['74037'] },
      { name: 'Bixby', miles: 16, bearing: 163, zips: ['74008'] },
      { name: 'Sand Springs', miles: 8, bearing: 277, zips: ['74063'] },
      { name: 'Sapulpa', miles: 14, bearing: 232, zips: ['74066'] },
      { name: 'Claremore', miles: 26, bearing: 52, zips: ['74017', '74019'] },
      { name: 'Catoosa', miles: 13, bearing: 74, zips: ['74015'] },
      { name: 'Skiatook', miles: 18, bearing: 342, zips: ['74070'] },
      { name: 'Coweta', miles: 23, bearing: 118, zips: ['74429'] },
      { name: 'Collinsville', miles: 19, bearing: 14, zips: ['74021'] },
    ],
  },

  trust: {
    rating: 4.9,
    reviewCount: 312,
    reviewSource: 'Google reviews',
    credentials: [
      'Licensed and registered in Oklahoma',
      '$2M general liability, workers covered',
      'Manufacturer-certified installers',
      'Class 4 impact-rated systems',
    ],
    reviews: [
      {
        name: 'Renee Halvorsen',
        place: 'Broken Arrow',
        job: 'Full replacement after hail',
        text: 'They pulled up three sheets of decking, showed me the rot on each one, and charged exactly the per-sheet price that was in the estimate. The yard was cleaner when they left than when they arrived.',
      },
      {
        name: 'Marcus Tillery',
        place: 'Midtown Tulsa',
        job: 'Leak repair',
        text: 'Booked the flat-rate repair on a Sunday night, a tech was on the roof Tuesday morning. It was a split pipe boot. Fixed in an hour, and the price was the price.',
      },
      {
        name: 'Priya Venkataraman',
        place: 'Owasso',
        job: 'Inspection before buying',
        text: 'The photo report was better than the one from our home inspector. We used it to get the seller to cover a new roof, and Northgable credited the inspection fee toward it.',
      },
      {
        name: 'Dale Okafor',
        place: 'Jenks',
        job: 'Full replacement',
        text: 'Paid the deposit online, the balance went on the same card after the walkthrough. No one stood in my driveway asking for a check.',
      },
    ],
  },

  estimate: {
    // Each entry is one line of the big closing headline.
    bigLines: ['How is', 'your roof', 'doing?'],
    headline: 'Request an estimate',
    body: 'Tell us about the roof. A real person calls back within one business hour, and estimates are always in writing.',
    success: {
      title: 'Request received',
      body: 'We have your details and will call within one business hour. If water is coming in right now, call the storm line and we will send someone today.',
    },
  },

  // The checkout page for each offer in offers.json.
  checkout: {
    inspection: {
      title: 'Book a roof inspection',
      intro: 'Pay the inspection fee now and we will call to set a time. The fee comes off any repair or replacement.',
      serviceKey: 'inspection',
      next: [
        'We call within one business hour to pick a time that suits you.',
        'An inspector spends about an hour on the roof and in the attic.',
        'Your photo report and written estimate arrive the same day.',
      ],
    },
    tuneup: {
      title: 'Book a flat-rate roof repair',
      intro: 'One visit, one price. If we find more than a tune-up can fix, you get a written estimate and this fee is credited to it.',
      serviceKey: 'repair',
      next: [
        'We call within one business hour to schedule the visit.',
        'A repair tech fixes the leak and photographs the work.',
        'Your 1-year leak warranty starts the day we finish.',
      ],
    },
    deposit: {
      title: 'Reserve your install date',
      intro: 'Your deposit orders materials and puts your roof on the schedule. It is applied in full to your final invoice.',
      serviceKey: 'replacement',
      next: [
        'Your deposit is charged today and your card is kept on file with Whop.',
        'We confirm your install date and order materials within one business day.',
        'After the final walkthrough we invoice the balance, charged to the card on file or emailed to you to pay another way.',
      ],
    },
  } as Record<string, { title: string; intro: string; serviceKey: string; next: string[] }>,

  demoNotice: 'Northgable Roofing is a demo company. This site is a roofing template built on Whop.',
} as const

export type Site = typeof site
