// Static copy: onboarding steps and difficulty descriptions. See design/GDD.md.

export const HOWTO_STEPS = [
  {
    title: 'Partners & The Deal',
    body: 'You and the seat across from you are partners against the other two. Ten tiles each, '
      + 'fifteen stay asleep — nobody ever draws.',
  },
  {
    title: 'Playing a Tile',
    body: 'On your turn, drag a tile from your rack onto either glowing end of the line. No match? '
      + 'Tap Pass — the game only lets you pass when you truly have nothing to play.',
  },
  {
    title: 'Reading a Pass',
    body: 'Every pass is a clue: it proves that seat holds nothing matching either open end, for '
      + 'the rest of the hand. The table memory strip keeps score of what everyone has revealed.',
  },
  {
    title: 'Winning a Hand',
    body: 'A hand ends when someone empties their rack (their team scores the others’ leftover '
      + 'pips), or when all four seats pass in a row (lowest combined pips wins the hand). First '
      + 'team to 100 takes the match.',
  },
];

// The exhaustive in-app Rules reference (docs/GAME-CATEGORIES.md, required from production
// onward). Every claim here is cross-checked against the real engine code: tiles.js (the set +
// deal + opener), rules.js (matching/scoring), ai.js (the difficulty tiers), game.js (turn order,
// hand/match end). `illustration` names a small scene view.js knows how to draw for that page;
// omit it for a text-only page.
export const RULES_PAGES = [
  {
    title: 'The Set', illustration: 'set',
    body: [
      'Fifty-five tiles: every pair of numbers from 0 through 9, plus every double from 0-0 to '
        + '9-9. Nine of the fifty-five are doubles.',
      'Four seats are dealt ten tiles each — forty tiles in play. The other fifteen stay asleep '
        + 'for the entire hand; this Cuban ruleset never draws from them.',
    ],
  },
  {
    title: 'Partnerships & Seating', illustration: 'seats',
    body: [
      'You sit across the table from your Partner — you two are one team, scored together for the '
        + 'whole match.',
      'The seat to your left and the seat to your right are your Opponents, and together they are '
        + 'the other team.',
      'Turn order runs You → Opponent 1 → Partner → Opponent 2 → back to you, all the way '
        + 'through the hand.',
    ],
  },
  {
    title: 'Opening a Hand', illustration: 'opener',
    body: [
      'Whoever holds the highest double leads — 9-9 first, then 8-8, and so on down to 0-0.',
      'If literally nobody was dealt any double (rare, but possible with fifteen tiles asleep), '
        + 'the single highest-pip tile in any hand opens instead.',
      'The opening tile is placed automatically — it is forced, not a choice — and both of its '
        + 'numbers become the line’s first two open ends.',
    ],
  },
  {
    title: 'Playing a Tile', illustration: 'match',
    body: [
      'On your turn, drag a tile from your rack onto either glowing end of the line. It plays if '
        + 'either of its two numbers matches that end’s number, and it snaps into place '
        + 'automatically.',
      'A tile that matches both open ends can go on either side — just drag it toward whichever '
        + 'end you mean; you don’t need pinpoint accuracy.',
      'The number on the tile that does NOT touch the line becomes the new open end on that side.',
    ],
  },
  {
    title: 'Passing',
    body: [
      'Tap Pass only when you hold nothing that matches either open end — the game itself checks '
        + 'this for you, so you can never pass while a legal play still sits in your rack.',
      'Every pass is real information: it proves, for the rest of the hand, that you hold nothing '
        + 'touching either of those two numbers. The Table Memory panel (top right) keeps a running '
        + 'record of exactly what every seat has revealed this way.',
    ],
  },
  {
    title: 'The AI Reads the Table Too',
    body: [
      'Casual: the table plays its own hand well — sheds its heaviest tiles first — but reads no '
        + 'pass history at all.',
      'Club: opponents also avoid leaving open a number they’ve seen you or your partner '
        + 'already pass on, so they starve you less by accident.',
      'Torneo: full partnership reading — your AI partner actively tries to leave open a number it '
        + 'thinks you might still hold, not just avoid a number it knows you don’t.',
      'Choose the table’s difficulty in the lobby before you deal in — it applies to all three '
        + 'AI seats for that whole match.',
    ],
  },
  {
    title: 'Winning a Hand — Going Out',
    body: [
      'The instant a seat plays its very last tile, the hand ends immediately.',
      'That seat’s team scores the pip total remaining in the two OPPONENT hands only — your '
        + 'partner’s own leftover tiles, if they have any, are never counted against your team.',
    ],
  },
  {
    title: 'Winning a Hand — Blocked',
    body: [
      'If all four seats pass in a row, the hand is blocked: nobody can play, and since this '
        + 'ruleset never draws, the line simply stops growing.',
      'Add up each team’s combined remaining pips. The LOWER total wins the hand and scores '
        + 'the other team’s total pip count.',
      'An exact tie between the two teams’ pip totals scores nothing for either side — the '
        + 'hand is a push, and the next hand deals fresh.',
    ],
  },
  {
    title: 'Winning the Match',
    body: [
      'Hand scores add up across the whole match. The first team to reach 100 points wins the '
        + 'match outright.',
      'Your match record (wins, losses, best win streak) is saved on this device only — there is '
        + 'no account, no online ranking, and no leaderboard.',
    ],
  },
];

export const DIFFICULTIES = [
  {
    id: 'casual', label: 'Casual',
    desc: 'The table plays its own hand well, but reads no history — a relaxed game to learn the rhythm.',
  },
  {
    id: 'club', label: 'Club',
    desc: 'Opponents track every pass and try to starve you of numbers you’re known to be out of.',
  },
  {
    id: 'torneo', label: 'Torneo',
    desc: 'Full partnership reading — your AI partner actively feeds you the numbers it thinks you still hold.',
  },
];
