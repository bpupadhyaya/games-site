// The About page: verified facts only (see design/GDD.md for what was left out and why).
// One concept per page (same shape as rules-content.js's RULES: {title, lines}) so About and Rules
// share one paginated reader-page renderer in view.js, each with its own text-size stepper.
export const ABOUT = [
  { title: 'What it is', lines: [
    'Tarneeb is a trick-taking card game for four players in two partnerships, played with a standard 52-card deck.',
    'Sides bid for the number of tricks they will take, and the player who wins the bid names the trump suit. The word comes from Arabic and means "trump".',
  ] },
  { title: 'Where it is played', lines: [
    'It is played in various Middle Eastern countries, most notably in the countries of the Levant, and also in Tanzania.',
    'In the Arabian Peninsula it is also known as hakam.',
  ] },
  { title: 'A long history', lines: [
    'The game can be traced back to the Levant and seems to have truly flourished from the early 18th century.',
    'It is often compared with Whist and Spades, which also reward partnership and trump.',
  ] },
  { title: 'One game, many tables', lines: [
    'Rules and scoring differ from region to region and from family to family.',
    'A game may be played to 31, 41 or 61 points, and a related game, 400, is played too.',
  ] },
  { title: 'This version', lines: [
    'Four players, 13 cards each, an auction for 7 to 13 tricks with immediate raises, deal and play passing to the right.',
    'A side that makes its bid scores the tricks it took; a side that falls short loses its bid; the other side scores its tricks.',
    'Take all 13 on a bid of 13 and the match is yours. Play to 31 or 41.',
  ] },
];
