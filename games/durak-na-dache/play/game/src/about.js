// About Durak — museum-label tone, verified facts only. Nothing here is a claim we cannot support; anything we
// could not verify is simply left out (tracked in design/GDD.md, not shown to players).
// Same {title, lines} page shape as rulesText.js's RULES, so the About and Rules screens can share one
// paginated reader-panel layout (view.js's drawReferencePage()).
// Pages are kept short and single-concept (one idea per page) so the reader-panel text can run at a real,
// comfortable size at every text-size step, up to 300%, without ever overflowing the panel — several pages
// below are split from what used to be one denser page for exactly that reason.
export const ABOUT = [
  {
    title: 'Durak',
    lines: [
      'Durak — "the fool" — is a shedding card game played with a 36-card deck (6 through Ace).',
    ],
  },
  {
    title: 'How popular is it?',
    lines: [
      'It is widely described as the most popular card game in Russia.',
    ],
  },
  {
    title: 'Beyond Russia',
    lines: [
      'The same is true across much of the former Soviet Union.',
    ],
  },
  {
    title: "Where it's played",
    lines: [
      'It is commonly played in homes, on trains, and at the dacha.',
    ],
  },
  {
    title: "What's a dacha?",
    lines: [
      'A dacha is a family country house or garden plot common across the region.',
    ],
  },
  {
    title: 'Attacking',
    lines: [
      'One player attacks with a card.',
    ],
  },
  {
    title: 'Beating the attack',
    lines: [
      'The other player must beat it — with a higher card of the same suit, or with a trump —',
    ],
  },
  {
    title: 'Taking instead',
    lines: [
      'or take the cards on the table into their hand instead.',
    ],
  },
  {
    title: 'Throwing in',
    lines: [
      'Other players may throw in more cards of a rank already on the table.',
    ],
  },
  {
    title: 'No true winner',
    lines: [
      'The game ends when everyone but one player has emptied their hand.',
    ],
  },
  {
    title: 'The durak',
    lines: [
      'That last player, still holding cards, is the durak.',
    ],
  },
  {
    title: 'Podkidnoy',
    lines: [
      'Podkidnoy ("throw-in") is the classic, most widely taught form.',
    ],
  },
  {
    title: 'Perevodnoy',
    lines: [
      'Perevodnoy ("transfer") adds one extra rule.',
    ],
  },
  {
    title: 'The transfer rule',
    lines: [
      'Before anything is beaten, the defender may pass an unbeaten attack sideways',
    ],
  },
  {
    title: 'Who deals with it',
    lines: [
      'to the next player, who then must deal with it instead.',
    ],
  },
  {
    title: 'Played casually',
    lines: [
      'Both forms are played casually today,',
    ],
  },
  {
    title: 'Same circle, different nights',
    lines: [
      'often within the same circle of friends on different evenings.',
    ],
  },
  {
    title: 'Just for fun',
    lines: [
      'Durak is typically played for fun among family and friends,',
    ],
  },
  {
    title: 'Not a competition',
    lines: [
      'rather than in formal competition.',
    ],
  },
  {
    title: 'A train-journey game',
    lines: [
      "It's commonly mentioned as a pastime for long train journeys,",
    ],
  },
  {
    title: 'Country-house gatherings',
    lines: [
      'and for country-house gatherings across Russia and neighbouring countries.',
    ],
  },
  {
    title: 'No chips, no stakes',
    lines: [
      'This edition keeps that spirit: no chips, no stakes, just the cards.',
    ],
  },
];
