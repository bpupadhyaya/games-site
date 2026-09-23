// Text of the Controls, Rules and About pages. Facts here are limited to things that are widely known and safe to state.
// The How to play screen: Controls, then a short Rules recap, each split into single-concept pages
// so the text-size stepper's top step (see layout.js TEXT_SCALES) never overflows a page's panel —
// verified by actually rendering every page at the top step (see STATUS.md). At the 300% top step a
// page holds well under one original sentence's worth of text, so most of these are now several
// consecutive pages sharing one heading rather than one page per topic; the page counter ("Page X of
// Y") is the reader's cue that more is coming.
export const HOWTO_PAGES = [
  { section: 'Controls', items: [
    { h: 'Place the striker' },
    { t: 'DRAG the striker sideways along your baseline,' },
  ], illustration: true },
  { section: 'Controls', items: [
    { t: 'or touch the baseline where you want it.' },
    { t: 'It turns red if it touches a coin.' },
    { h: 'Aim and power' },
  ] },
  { section: 'Controls', items: [
    { t: 'DRAG BACK from the striker (or from anywhere on the board): pull' },
  ] },
  { section: 'Controls', items: [
    { t: 'away from where you want to shoot.' },
    { t: 'The dotted line shows the shot and the ring marks the first' },
  ] },
  { section: 'Controls', items: [
    { t: 'contact.' },
    { t: 'A longer pull is a harder flick.' },
  ] },
  { section: 'Controls', items: [
    { h: 'Flick' },
    { t: 'RELEASE to flick.' },
    { t: 'A very short pull cancels the shot.' },
  ] },
  { section: 'Controls', items: [
    { t: 'After a Hint, or when using the keyboard, press the Flick button.' },
    { h: 'Keyboard' },
  ] },
  { section: 'Controls', items: [
    { t: 'Left and Right slide the striker.' },
    { t: 'A and D turn the aim.' },
    { t: 'Up and Down set the power.' },
    { t: 'Space flicks.' },
  ] },
  { section: 'Rules', items: [
    { t: 'White plays from the bottom of the board, black from the top.' },
    { t: 'White starts.' },
  ] },
  { section: 'Rules', items: [
    { t: 'Pocket a coin of your colour and you shoot again.' },
  ] },
  { section: 'Rules', items: [
    { t: 'If you pocket nothing, or only the other colour, the turn passes.' },
  ] },
  { section: 'Rules', items: [
    { t: 'Other-colour coins stay down and count for your opponent.' },
    { t: 'The red queen: pocket it,' },
  ] },
  { section: 'Rules', items: [
    { t: 'then pocket one of your own coins on the same stroke or' },
    { t: 'on your very next stroke.' },
  ] },
  { section: 'Rules', items: [
    { t: 'That covers the queen.' },
    { t: 'If you cannot, it goes back to the centre.' },
  ] },
  { section: 'Rules', items: [
    { t: 'Foul: if the striker falls into a pocket,' },
    { t: 'one of your pocketed coins goes back to the centre (or you' },
  ] },
  { section: 'Rules', items: [
    { t: 'owe one),' },
    { t: 'and the turn passes.' },
    { t: 'Your last coin cannot go down while the queen is still on' },
  ] },
  { section: 'Rules', items: [
    { t: 'the board: it comes back.' },
    { t: 'Pocket all your coins first to win the board.' },
  ] },
  { section: 'Rules', items: [
    { t: 'You score 1 point for every coin your opponent still has,' },
  ] },
  { section: 'Rules', items: [
    { t: 'plus 3 if you covered the queen.' },
  ] },
];
// Exhaustive Game Rules reference (separate from the short Rules recap above, which stays on the
// How to play page unchanged). Every claim here is cross-checked against the real rule book,
// rules.js/physics.js (the single source of truth this game actually plays by), so this page can
// never contradict the engine. `pieces` names the real board object(s) to draw on that page, using
// the board's own piece art (never a separate icon) — see view.js. Split into short pages the same
// way as HOWTO_PAGES above; `pieces` stays attached only to the first page of its topic, since the
// portrait only needs to appear once per topic, not on every continuation page.
export const GAME_RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Carrom is played on a square board with a pocket in each',
      'corner.',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'Nineteen coins start on the board: a red queen in the exact',
      'centre,',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'a ring of six coins around it,',
      'and a ring of twelve more around that,',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'colours alternating — nine white coins and nine black.',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'White sits at the bottom of the board, black at the top.',
      'Each side has its own baseline,',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'a strip between two marked circles where that side\'s striker is placed.',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'White always plays the first stroke;',
      'after that the players strictly alternate,',
    ],
  },
  {
    title: 'The board and setup',
    lines: [
      'except when a stroke earns another turn (see Extra shots).',
    ],
  },
  {
    title: 'The striker',
    pieces: ['S'],
    lines: [
      'The striker is a larger,',
    ],
  },
  {
    title: 'The striker',
    lines: [
      'heavier disc that is never part of either side\'s coin count —',
    ],
  },
  {
    title: 'The striker',
    lines: [
      'it is the only piece a player directly controls.',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'On your turn,',
      'slide it anywhere along your own baseline (it turns red if it',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'is touching a coin — move it to a clear spot before',
      'shooting).',
      'Drag back from the striker,',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'or from anywhere on the board,',
      'to aim: the pull direction sets the angle and the pull\'s length',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'sets the power,',
      'up to a maximum;',
      'release to flick.',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'Exactly one flick is played per turn.',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'The striker itself is removed from the board once its stroke ends,',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'and is placed fresh on the baseline for whoever shoots next.',
    ],
  },
  {
    title: 'The coins',
    pieces: ['W', 'B'],
    lines: [
      'White and black coins are worth the same: pocketing one of your',
    ],
  },
  {
    title: 'The coins',
    lines: [
      'own colour scores it for you and you shoot again.',
    ],
  },
  {
    title: 'The coins',
    lines: [
      'Pocketing nothing — or pocketing only the other colour — ends your',
      'turn.',
    ],
  },
  {
    title: 'The coins',
    lines: [
      'A coin of the opponent\'s colour that you pocket stays down: it',
      'does not return to the board,',
    ],
  },
  {
    title: 'The coins',
    lines: [
      'and it counts toward the opponent\'s total,',
      'not yours.',
    ],
  },
  {
    title: 'The queen',
    pieces: ['Q'],
    lines: [
      'The single red queen may be pocketed at any time,',
      'by either side,',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'but it must be covered: the same player has to also pocket',
      'one of their own coins,',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'either on that very stroke or on the stroke right after (the',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'turn does not pass while the queen is waiting to be covered',
      '— see Extra shots).',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'Covered in time, the queen is credited to whoever covered it.',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'If it is not covered in time,',
      'it comes back out to the centre of the board and is',
    ],
  },
  {
    title: 'The queen',
    lines: [
      'still there to be pocketed again later.',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'A foul happens when the striker itself falls into a pocket.',
      'Your turn always ends on a foul,',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'even if the same stroke also pocketed coins.',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'Penalty: one of your own already pocketed coins is put back on the',
      'board (back near the centre).',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'If you have not pocketed any of your own coins yet,',
      'none returns immediately — instead you owe one,',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'and the next coin of your colour you pocket returns to the',
      'board instead of counting.',
    ],
  },
  {
    title: 'Fouls and the queen',
    lines: [
      'A queen you pocket on a foul stroke goes straight back to',
      'the centre regardless of covering.',
    ],
  },
  {
    title: 'Fouls and the queen',
    lines: [
      'Any opponent coin pocketed on the same stroke still stays down and',
      'still counts for the opponent.',
    ],
  },
  {
    title: 'Extra shots',
    lines: [
      'Pocketing one or more of your own coins earns another stroke immediately.',
    ],
  },
  {
    title: 'Extra shots',
    lines: [
      'Pocketing the queen also earns another stroke on the spot — the',
    ],
  },
  {
    title: 'Extra shots',
    lines: [
      'very next stroke the rules require to cover it is simply your',
      'next shot,',
    ],
  },
  {
    title: 'Extra shots',
    lines: [
      'played before the turn can pass to the other side.',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      'Your very last coin cannot be pocketed while the queen has not',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      'yet been touched at all — still sitting untouched in the centre.',
      'If it would be,',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      'it bounces back out to the centre instead,',
      'and does not count.',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      '(Once the queen has been pocketed at least once, even if it',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      'is still waiting to be covered, this no longer applies.)',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'A side wins the board once it has pocketed every one of',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'its own coins and the queen is fully settled — pocketed and',
      'covered by either player,',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'not merely sitting on the board or waiting to be covered.',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'The winner scores one point for every coin the opponent still has',
      'on the board,',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'plus three bonus points if the winner personally pocketed and covered the',
      'queen.',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'Each side has a limit of 90 strokes.',
      'If both sides reach that limit without either one clearing all its',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'coins,',
      'the board ends there: whoever has fewer of their own-colour coins left',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'on the board wins — it makes no difference which side actually',
      'pocketed them.',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'If both sides have exactly the same number of coins left,',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'the board is a draw and nobody scores.',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'A won stalled board is scored exactly like any other win: one',
      'point per coin the loser still has,',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'plus three if the winner covered the queen.',
    ],
  },
];

// Split into short pages so the text-size stepper's top step never overflows the panel (the same
// reasoning as HOWTO_PAGES above).
export const ABOUT_PAGES = [
  { items: [
    { h: 'A game of the flick' },
    { t: 'Carrom is a tabletop game in which players flick a striker across' },
  ] },
  { items: [
    { t: 'a square board to send coins into the four corner pockets.' },
    { h: 'Where it is played' },
  ] },
  { items: [
    { t: 'It is popular across South Asia and among South Asian communities around' },
    { t: 'the world,' },
  ] },
  { items: [
    { t: 'and is played at home,' },
    { t: 'in clubs and in organised tournaments.' },
    { h: 'The board and pieces' },
  ] },
  { items: [
    { t: 'A board has four corner pockets and 19 coins: nine white,' },
    { t: 'nine black and one red queen.' },
  ] },
  { items: [
    { t: 'The striker is a slightly larger,' },
    { t: 'heavier disc that is flicked from a baseline.' },
  ] },
  { items: [
    { h: 'House rules' },
    { t: 'Rules vary from place to place.' },
  ] },
  { items: [
    { t: 'This game uses one clear rule set, written under How to play.' },
    { h: 'In this game' },
  ] },
  { items: [
    { t: 'The board, coins and striker are drawn for this game.' },
    { t: 'Every coin slides,' },
  ] },
  { items: [
    { t: 'bounces and pockets by the same simulated physics for you and the' },
    { t: 'computer.' },
  ] },
];
