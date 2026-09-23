// Text of the Controls, Rules and About pages. Facts here are limited to things that are widely known and safe to state.
// The How to play screen: Controls, then a short Rules recap, each split into single-concept pages
// so the text-size stepper's top step (see layout.js TEXT_SCALES) never overflows a page's panel —
// verified by actually rendering every page at the top step (see STATUS.md).
export const HOWTO_PAGES = [
  { section: 'Controls', items: [
    { h: 'Place the striker' },
    { t: 'DRAG the striker sideways along your baseline, or touch the baseline where you want it. It turns red if it touches a coin.' },
    { h: 'Aim and power' },
    { t: 'DRAG BACK from the striker (or from anywhere on the board): pull away from where you want to shoot. The dotted line shows the shot and the ring marks the first contact. A longer pull is a harder flick.' },
  ], illustration: true },
  { section: 'Controls', items: [
    { h: 'Flick' },
    { t: 'RELEASE to flick. A very short pull cancels the shot. After a Hint, or when using the keyboard, press the Flick button.' },
    { h: 'Keyboard' },
    { t: 'Left and Right slide the striker. A and D turn the aim. Up and Down set the power. Space flicks.' },
  ] },
  { section: 'Rules', items: [
    { t: 'White plays from the bottom of the board, black from the top. White starts.' },
    { t: 'Pocket a coin of your colour and you shoot again. If you pocket nothing, or only the other colour, the turn passes. Other-colour coins stay down and count for your opponent.' },
    { t: 'The red queen: pocket it, then pocket one of your own coins on the same stroke or on your very next stroke. That covers the queen. If you cannot, it goes back to the centre.' },
  ] },
  { section: 'Rules', items: [
    { t: 'Foul: if the striker falls into a pocket, one of your pocketed coins goes back to the centre (or you owe one), and the turn passes.' },
    { t: 'Your last coin cannot go down while the queen is still on the board: it comes back.' },
    { t: 'Pocket all your coins first to win the board. You score 1 point for every coin your opponent still has, plus 3 if you covered the queen.' },
  ] },
];
// Exhaustive Game Rules reference (separate from the short Rules recap above, which stays on the
// How to play page unchanged). Every claim here is cross-checked against the real rule book,
// rules.js/physics.js (the single source of truth this game actually plays by), so this page can
// never contradict the engine. `pieces` names the real board object(s) to draw on that page, using
// the board's own piece art (never a separate icon) — see view.js.
export const GAME_RULES = [
  {
    title: 'The board and setup',
    lines: [
      'Carrom is played on a square board with a pocket in each corner. Nineteen coins start on the board: a red queen in the exact centre, a ring of six coins around it, and a ring of twelve more around that, colours alternating — nine white coins and nine black.',
      'White sits at the bottom of the board, black at the top. Each side has its own baseline, a strip between two marked circles where that side\'s striker is placed.',
      'White always plays the first stroke; after that the players strictly alternate, except when a stroke earns another turn (see Extra shots).',
    ],
  },
  {
    title: 'The striker',
    pieces: ['S'],
    lines: [
      'The striker is a larger, heavier disc that is never part of either side\'s coin count — it is the only piece a player directly controls.',
    ],
  },
  {
    title: 'Aiming and flicking',
    lines: [
      'On your turn, slide it anywhere along your own baseline (it turns red if it is touching a coin — move it to a clear spot before shooting). Drag back from the striker, or from anywhere on the board, to aim: the pull direction sets the angle and the pull\'s length sets the power, up to a maximum; release to flick.',
      'Exactly one flick is played per turn. The striker itself is removed from the board once its stroke ends, and is placed fresh on the baseline for whoever shoots next.',
    ],
  },
  {
    title: 'The coins',
    pieces: ['W', 'B'],
    lines: [
      'White and black coins are worth the same: pocketing one of your own colour scores it for you and you shoot again. Pocketing nothing — or pocketing only the other colour — ends your turn.',
      'A coin of the opponent\'s colour that you pocket stays down: it does not return to the board, and it counts toward the opponent\'s total, not yours.',
    ],
  },
  {
    title: 'The queen',
    pieces: ['Q'],
    lines: [
      'The single red queen may be pocketed at any time, by either side, but it must be covered: the same player has to also pocket one of their own coins, either on that very stroke or on the stroke right after (the turn does not pass while the queen is waiting to be covered — see Extra shots).',
      'Covered in time, the queen is credited to whoever covered it. If it is not covered in time, it comes back out to the centre of the board and is still there to be pocketed again later.',
    ],
  },
  {
    title: 'Fouls',
    lines: [
      'A foul happens when the striker itself falls into a pocket. Your turn always ends on a foul, even if the same stroke also pocketed coins.',
      'Penalty: one of your own already-pocketed coins is put back on the board (back near the centre). If you have not pocketed any of your own coins yet, none returns immediately — instead you owe one, and the next coin of your colour you pocket returns to the board instead of counting.',
    ],
  },
  {
    title: 'Fouls and the queen',
    lines: [
      'A queen you pocket on a foul stroke goes straight back to the centre regardless of covering. Any opponent coin pocketed on the same stroke still stays down and still counts for the opponent.',
    ],
  },
  {
    title: 'Extra shots',
    lines: [
      'Pocketing one or more of your own coins earns another stroke immediately. Pocketing the queen also earns another stroke on the spot — the very next stroke the rules require to cover it is simply your next shot, played before the turn can pass to the other side.',
    ],
  },
  {
    title: 'The last coin',
    lines: [
      'Your very last coin cannot be pocketed while the queen has not yet been touched at all — still sitting untouched in the centre. If it would be, it bounces back out to the centre instead, and does not count. (Once the queen has been pocketed at least once, even if it is still waiting to be covered, this no longer applies.)',
    ],
  },
  {
    title: 'Winning a board',
    lines: [
      'A side wins the board once it has pocketed every one of its own coins and the queen is fully settled — pocketed and covered by either player, not merely sitting on the board or waiting to be covered.',
      'The winner scores one point for every coin the opponent still has on the board, plus three bonus points if the winner personally pocketed and covered the queen.',
    ],
  },
  {
    title: 'Stalled boards',
    lines: [
      'Each side has a limit of 90 strokes. If both sides reach that limit without either one clearing all its coins, the board ends there: whoever has fewer of their own-colour coins left on the board wins — it makes no difference which side actually pocketed them.',
      'If both sides have exactly the same number of coins left, the board is a draw and nobody scores. A won stalled board is scored exactly like any other win: one point per coin the loser still has, plus three if the winner covered the queen.',
    ],
  },
];

// Split into two single-screen-ful pages so the text-size stepper's top step never overflows the
// panel (the same reasoning as HOWTO_PAGES above).
export const ABOUT_PAGES = [
  { items: [
    { h: 'A game of the flick' },
    { t: 'Carrom is a tabletop game in which players flick a striker across a square board to send coins into the four corner pockets.' },
    { h: 'Where it is played' },
    { t: 'It is popular across South Asia and among South Asian communities around the world, and is played at home, in clubs and in organised tournaments.' },
    { h: 'The board and pieces' },
    { t: 'A board has four corner pockets and 19 coins: nine white, nine black and one red queen. The striker is a slightly larger, heavier disc that is flicked from a baseline.' },
  ] },
  { items: [
    { h: 'House rules' },
    { t: 'Rules vary from place to place. This game uses one clear rule set, written under How to play.' },
    { h: 'In this game' },
    { t: 'The board, coins and striker are drawn for this game. Every coin slides, bounces and pockets by the same simulated physics for you and the computer.' },
  ] },
];
