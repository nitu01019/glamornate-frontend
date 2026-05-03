import type { BlogPost } from '../types';

const post: BlogPost = {
  slug: 'body-polishing-vs-scrubbing',
  title: 'Body Polishing vs. Scrubbing: Which Is Right for You?',
  excerpt: 'They look similar, but they solve different problems.',
  category: 'Wellness',
  readMinutes: 4,
  heroImage: '/images/services/body-polishing.webp',
  publishedAt: '2026-04-17',
  author: 'Glamornate Editorial Team',
  sections: [
    {
      kind: 'paragraph',
      text: 'From the outside, a body polish and a body scrub can look like twins — you lie back, something lovely is worked into your skin, and you walk out softer than you came in. But the two are doing quite different things, and knowing which one your skin actually needs is the difference between a glow that lasts a week and a glow that lasts a month.',
    },
    {
      kind: 'paragraph',
      text: 'We get this question almost daily at the studio, so we wrote down the answer we usually give over a cup of saunf tea.',
    },
    { kind: 'heading', level: 2, text: 'The quick definitions' },
    {
      kind: 'paragraph',
      text: 'A body scrub is the exfoliation step on its own. Granules — sugar, salt, coffee, crushed walnut shell — ride on a carrier oil or cream and physically lift away dead surface cells. Ten to fifteen minutes of brisk circular work and you rinse. That is the entire treatment.',
    },
    {
      kind: 'paragraph',
      text: 'A body polish is a three-step ritual where the scrub is the middle act. First we cleanse, then we exfoliate (sometimes mechanically, sometimes with fruit enzymes), and then we seal everything in with a nourishing mask or serum — often a brightening ubtan, a cocoa wrap, or a lightweight kumkumadi-inspired oil. You leave with skin that has been both reset and refed.',
    },
    { kind: 'heading', level: 2, text: 'Physical exfoliation vs. enzymatic' },
    {
      kind: 'paragraph',
      text: 'Physical exfoliation uses texture. You feel it working. It is satisfying and immediate, and for most healthy skin on the body it is completely safe in trained hands. It is also the oldest answer in South Asian bathing rituals — the haldi-ubtan tradition is essentially a gentle, grain-based polish.',
    },
    {
      kind: 'paragraph',
      text: 'Enzymatic exfoliation uses chemistry instead. Papaya, pineapple, and lactic acid dissolve the bonds that hold dead cells in place, so nothing needs to be scraped. It is the kinder option for reactive skin, for skin that is freshly waxed, or for anyone who breaks out in tiny red bumps after a gritty scrub.',
    },
    {
      kind: 'callout',
      title: 'A quick rule of thumb',
      body: 'If your skin gets pink and stingy easily, reach for enzymes. If your skin feels thick, dull, or has ingrown hair and keratosis pilaris on the arms, grains will serve you better.',
    },
    { kind: 'heading', level: 2, text: 'By skin type' },
    {
      kind: 'heading',
      level: 3,
      text: 'Sensitive skin',
    },
    {
      kind: 'paragraph',
      text: 'Stick to polishes that use fine sugar or enzyme bases, and always pair exfoliation with a calming mask — oatmeal, aloe, or chamomile. Avoid salt on very sensitive skin; it can sting if there are any micro-cuts you did not know about.',
    },
    { kind: 'heading', level: 3, text: 'Oily and acne-prone skin' },
    {
      kind: 'paragraph',
      text: 'Lactic acid polishes and salt-based scrubs both do beautifully here. Salt draws out congestion, and the acid keeps the back and chest clearer between visits. Skip anything coconut-oil heavy as a finisher; a gel or lightweight lotion is kinder to clogged pores.',
    },
    { kind: 'heading', level: 3, text: 'Mature skin' },
    {
      kind: 'paragraph',
      text: 'The skin on arms and legs thins with time, so we lean toward enzymatic polishes with rich oil finishes — sesame, almond, or a touch of kumkumadi. The goal is less abrasion, more nourishment.',
    },
    { kind: 'heading', level: 3, text: 'Tan-prone skin' },
    {
      kind: 'paragraph',
      text: 'For skin that holds on to summer tans and festive-season sun, a combination polish works best: a mild physical exfoliant followed by a brightening ubtan mask with haldi, chickpea flour, and sandal. It lifts the tan without bleaching, and it smells like home.',
    },
    { kind: 'heading', level: 2, text: 'How often is too often?' },
    {
      kind: 'paragraph',
      text: 'Here is the truth nobody likes to hear: over-scrubbing is one of the most common reasons body skin looks dull. When you exfoliate more than once a week at home, or book back-to-back salon scrubs, you thin the lipid barrier. The skin then overproduces oil, holds on to dead cells defensively, and ends up looking duller than before. It is a frustrating loop.',
    },
    {
      kind: 'paragraph',
      text: 'Our general cadence: a full body polish every three to four weeks at the salon, plus one gentle at-home scrub in between. That is it. More than that is almost always counter-productive.',
    },
    { kind: 'heading', level: 2, text: 'How we tailor it at Glamornate' },
    {
      kind: 'paragraph',
      text: 'When you arrive, your therapist reads your skin before she chooses a product. She checks for open waxing, recent shaving, any pigmentation, and how reactive your back and decolletage tend to be. From there she picks one of four bases — sugar, salt, enzyme, or ubtan — and either a hydrating, brightening, or detoxifying finisher. Nothing is off a fixed menu; it is always a conversation.',
    },
    {
      kind: 'list',
      items: [
        'Sugar polish with honey mask — for dullness and everyday maintenance',
        'Salt polish with detox clay — for heavy tans and congestion',
        'Papaya enzyme polish with aloe wrap — for sensitive or freshly waxed skin',
        'Classic ubtan polish with saffron oil — our festive-season favourite',
      ],
    },
    {
      kind: 'paragraph',
      text: 'If you are not sure which of these suits you, come in and we will decide together. Book a body polish at Glamornate and your therapist will walk you through the options before a single drop of product touches your skin. It is a small ritual, but over a year it is what keeps the glow going.',
    },
  ],
  cta: {
    label: 'Book a Body Polish at Glamornate',
    href: '/services/category/body-polishing-massage',
  },
  relatedSlugs: ['at-home-spa-day', 'hydraglo-facials-explained'],
  seo: {
    title: 'Body Polishing vs. Scrubbing: Which Is Right for You?',
    description: 'They look similar, but they solve different problems.',
    ogImage: '/images/services/body-polishing.webp',
  },
};

export default post;
