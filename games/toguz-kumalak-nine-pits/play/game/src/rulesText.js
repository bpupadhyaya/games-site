// Exhaustive rules reference for the title-screen "Rules" page. Every claim here is cross-checked
// against the actual implementation in rules.js (the single source of truth for legality), the way
// the engine really plays it - not idealised textbook Toguz Korgool. See design/GDD.md for the
// documented simplifications (the 300-quiet-move fallback; no clock; no opening-move restriction).
// `art` names which real in-game element view.js's renderRules() draws for that page - never a
// separate simplified icon, always the same drawBoard()/drawSeed()/contents() used during play.
//
// One concept per page, kept short: at the largest text-size step (see layout.js TEXT_SCALES) a page
// with several long paragraphs would overflow the reader-card panel, so each original topic that ran
// long is now split across two or three shorter pages rather than shrinking the font to fit.
export const RULES = [
  {
    title: 'The board and the pebbles',
    lines: [
      'Eighteen pits in a ring: your nine along the bottom row, numbered 1 to 9 left to right, and your opponent’s nine along the top row, numbered 1 to 9 from their own end (right to left on screen).',
      'Every pit starts with nine kumalak - one pebble is a kumalak - for 162 in play. Each side also has a kazan: a store beside its own row that keeps every pebble it has won.',
    ],
  },
  {
    title: 'How a turn works',
    lines: [
      'Sowing always runs counter-clockwise around the whole board: from pit 1 of your row, through pit 9, into your opponent’s pit 1, on to their pit 9, then back to your pit 1.',
      'You, the bottom row, always move first. There is no separate opening phase or restricted first move: from turn one, any of your nine pits that still holds pebbles is a legal move.',
    ],
  },
  {
    title: 'Tapping a pit',
    art: 'pit',
    lines: [
      'One of the eighteen pits on the board - yours or your opponent’s - each holding some number of kumalak.',
      'TAP one of your OWN pits that still has pebbles to sow it. Your opponent’s pits, an empty pit of yours, and your opponent’s tuz can never be picked.',
    ],
  },
  {
    title: 'How sowing travels',
    lines: [
      'Sowing lifts every pebble out of the chosen pit. If it holds exactly one, that lone pebble simply moves on to the next pit. If it holds more than one, the FIRST pebble is dropped straight back into the very pit it came from, and the rest travel on, one per pit, counter-clockwise.',
    ],
  },
  {
    title: 'Sowing more than once around',
    lines: [
      'A long sow can lap the board more than once: the pit just lifted from is not skipped the second time round - it can receive a pebble again like any other pit.',
    ],
  },
  {
    title: 'The kazan (store)',
    art: 'kazan',
    lines: [
      'Each player has exactly one kazan, beside their own row, holding every pebble that player has won so far.',
      'Pebbles reach a kazan two ways: by capturing a pit, or by passing through a tuz on the way round (the next page). Once a pebble is in a kazan, it never leaves.',
    ],
  },
  {
    title: 'Reaching 82 pebbles',
    lines: [
      'Whichever player’s kazan reaches 82 or more of the 162 pebbles - more than half - wins the game at once.',
    ],
  },
  {
    title: 'The tuz (won pit)',
    art: 'tuz',
    lines: [
      'A tuz is one pit belonging to your opponent that you have won for the rest of the game - shown here with a small flag planted in your colour.',
    ],
  },
  {
    title: 'How a tuz behaves',
    lines: [
      'A tuz pit always holds zero pebbles: every pebble that lands in it afterwards, sown by either player, goes straight into the tuz owner’s kazan instead of staying in the pit.',
      'A tuz pit can never be sown by anyone, by either player - it is always empty, so there is never anything in it to lift.',
      'Each player may own at most one tuz at a time, for the whole game. Exactly how a pit becomes a tuz is on the next page.',
    ],
  },
  {
    title: 'Capturing pebbles',
    lines: [
      'If the LAST pebble you sow lands in one of your opponent’s pits and that pit’s new count is EVEN, every pebble sitting in it flies straight to your kazan and the pit is left empty.',
      'Landing your last pebble on an odd count, or in one of your own pits, captures nothing - the pebbles simply stay where they landed.',
      'Landing your last pebble in a tuz - yours or your opponent’s - never captures anything extra either: a single pebble going into a tuz already went straight to its owner’s kazan as it landed.',
    ],
  },
  {
    title: 'Making a tuz',
    lines: [
      'If the LAST pebble you sow lands in one of your opponent’s pits and that pit’s new count is exactly THREE, it can become your tuz - three pebbles go to your kazan and a flag is planted - but only if every one of these is true:',
      'You do not already own a tuz. One tuz per player, once, for the whole game.',
    ],
  },
  {
    title: 'When a three does nothing',
    lines: [
      'It is not your opponent’s own 9th pit - that one pit of theirs can never become a tuz.',
      'It does not share the same pit NUMBER as your opponent’s own tuz, if they already have one.',
      'If any of those is not true, landing on three does nothing at all - the three pebbles simply stay put in the pit.',
    ],
  },
  {
    title: 'Winning the game',
    art: 'kazan',
    lines: [
      'A player wins the instant their kazan reaches 82 or more of the 162 pebbles in play - the game ends immediately, checked after every single move.',
      '162 splits exactly in half at 81, so 82 is the smallest total that guarantees strictly more than half: the other side can then hold at most 80.',
    ],
  },
  {
    title: 'Ending without reaching 82',
    lines: [
      'At the start of a turn, if the player to move has zero pebbles left across all nine of their own pits, the game ends there: the OTHER player sweeps every pebble remaining on their own side straight into their own kazan.',
      'The two kazans are then compared: whoever holds more of the 162 pebbles wins outright, even without reaching 82. An exact 81-81 split is a draw.',
    ],
  },
  {
    title: 'The 300-move fallback',
    lines: [
      'A fallback added for safety, not part of traditional play: if 300 moves pass with neither a capture nor a new tuz by either player, the same sweep-and-compare happens instead. In 3000 simulated random games this was never once needed.',
    ],
  },
];
