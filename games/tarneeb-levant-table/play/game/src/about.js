// The About page: verified facts only (see design/GDD.md for what was left out and why).
// One concept per page (same shape as rules-content.js's RULES: {title, lines}) so About and Rules
// share one paginated reader-page renderer in view.js, each with its own text-size stepper.
// Split down to one sentence (or, for a still-too-long single sentence, one natural clause) per
// page so every page keeps fitting once the text-size stepper's top step reached 300% - at that
// size even a single ~20-word sentence can fill most of the reader-card, so this is finer-grained
// than the 130%/200% passes needed to be. No fact or wording was changed, only where it breaks.
export const ABOUT = [
  { title: 'What it is', lines: [
    'Tarneeb is a trick-taking card game for four players in two partnerships.',
  ] },
  { title: 'What it is: the deck', lines: [
    'It is played with a standard 52-card deck.',
  ] },
  { title: 'What it is: bidding and trump', lines: [
    'Sides bid for the number of tricks they will take, and the player who wins the bid names the trump suit.',
  ] },
  { title: 'What it is: the name', lines: [
    'The word comes from Arabic and means "trump".',
  ] },
  { title: 'Where it is played', lines: [
    'It is played in various Middle Eastern countries, most notably in the countries of the Levant.',
  ] },
  { title: 'Where it is played: beyond the Levant', lines: [
    'It is also played in Tanzania.',
  ] },
  { title: 'Where it is played: the Gulf', lines: [
    'In the Arabian Peninsula it is also known as hakam.',
  ] },
  { title: 'A long history', lines: [
    'The game can be traced back to the Levant and seems to have truly flourished from the early 18th century.',
  ] },
  { title: 'A long history: similar games', lines: [
    'It is often compared with Whist and Spades, which also reward partnership and trump.',
  ] },
  { title: 'One game, many tables', lines: [
    'Rules and scoring differ from region to region and from family to family.',
  ] },
  { title: 'One game, many tables: targets', lines: [
    'A game may be played to 31, 41 or 61 points, and a related game, 400, is played too.',
  ] },
  { title: 'This version', lines: [
    'Four players, 13 cards each.',
  ] },
  { title: 'This version: the auction', lines: [
    'An auction for 7 to 13 tricks with immediate raises, deal and play passing to the right.',
  ] },
  { title: 'This version: scoring', lines: [
    'A side that makes its bid scores the tricks it took.',
  ] },
  { title: 'This version: missing the bid', lines: [
    'A side that falls short loses its bid; the other side scores its tricks.',
  ] },
  { title: 'This version: winning', lines: [
    'Take all 13 on a bid of 13 and the match is yours.',
  ] },
  { title: 'This version: match length', lines: [
    'Play to 31 or 41.',
  ] },
];
