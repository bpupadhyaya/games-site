// Text content for the Rules reference page. Kept factual and cross-checked against the actual
// rule book in rules.js so this page can never contradict the engine. Short-paragraph style, one
// idea per line, like the About page (about.js). `role` tells view.js which real in-game board
// snapshot (drawn with the game's own drawBoard/drawSeed/pitPos/slot) to show under the title, if
// any - never a separate invented icon set.
//
// Split down to one short sentence (or clause) per page: at the top text-size step (layout.js
// TEXT_SCALES, now reaching 3x/300%) even a single two-sentence paragraph wraps to far more lines
// than the panel holds, so topics that were one page at the 130%/200% ceilings are now several -
// verified by actually rendering every page at the top step (see the game's STATUS.md). A page
// carrying `role` (the board snapshot) has much less room than a plain text page, so those topics
// keep the snapshot on only their first page and continue in plain follow-on pages.
export const RULES = [
  {
    title: 'The board',
    role: 'setup',
    lines: [
      'Oware is played on an oval board of twelve pits.',
    ],
  },
  {
    title: 'The board',
    lines: [
      'Six on each side, plus one long store at each end that holds seeds a side has already captured.',
    ],
  },
  {
    title: 'One loop, two rows',
    lines: [
      'Your six pits are the bottom row, left to right.',
    ],
  },
  {
    title: 'One loop, two rows',
    lines: [
      'The opponent’s six pits are the top row, right to left.',
    ],
  },
  {
    title: 'One loop, two rows',
    lines: [
      'Together the twelve pits form one loop, sown counter- clockwise all the way round.',
    ],
  },
  {
    title: 'The starting position',
    lines: [
      'Every game starts with four seeds in each of the twelve pits.',
    ],
  },
  {
    title: 'The starting position',
    lines: [
      'That’s 48 seeds in all, and both stores start empty.',
    ],
  },
  {
    title: 'The starting position',
    lines: [
      'You always sow first, from the bottom row.',
    ],
  },
  {
    title: 'The starting position',
    lines: [
      'In a two-player game, Player one (the bottom row) goes first.',
    ],
  },
  {
    title: 'Your pits',
    role: 'mine',
    lines: [
      'Your six pits are the bottom row.',
    ],
  },
  {
    title: 'Your pits',
    lines: [
      'Tap any one of them that holds at least one seed to sow it.',
    ],
  },
  {
    title: 'How you sow',
    lines: [
      'Sowing picks up every seed in that pit.',
    ],
  },
  {
    title: 'How you sow',
    lines: [
      'It drops them one at a time into the pits that follow, going counter- clockwise.',
    ],
  },
  {
    title: 'How you sow',
    lines: [
      'You may never sow from an empty pit.',
    ],
  },
  {
    title: 'How you sow',
    lines: [
      'Nor may you ever sow from one of the opponent’s pits.',
    ],
  },
  {
    title: 'The opponent’s pits',
    role: 'theirs',
    lines: [
      'This is the top row.',
    ],
  },
  {
    title: 'The opponent’s pits',
    lines: [
      'Six pits, the same as yours.',
    ],
  },
  {
    title: 'The opponent’s pits',
    lines: [
      'That’s across the board, on the far side from you.',
    ],
  },
  {
    title: 'The opponent’s pits',
    lines: [
      'They sow from these pits on their turn, exactly as you sow from yours.',
    ],
  },
  {
    title: 'Sowing into their pits',
    lines: [
      'You cannot sow from the opponent’s pits, but your sowing can land seeds in them.',
    ],
  },
  {
    title: 'Sowing into their pits',
    lines: [
      'Landing your very last seed in one of their pits can capture it.',
    ],
  },
  {
    title: 'Sowing into their pits',
    lines: [
      'That happens when it leaves the pit with exactly two or three seeds (see “Capturing”).',
    ],
  },
  {
    title: 'The store',
    role: 'store',
    lines: [
      'Each side has one store.',
    ],
  },
  {
    title: 'The store',
    lines: [
      'It’s a long trough at that side’s end of the board.',
    ],
  },
  {
    title: 'The store',
    lines: [
      'It is kept separate from the twelve sowing pits.',
    ],
  },
  {
    title: 'How seeds reach the store',
    lines: [
      'Seeds are never sown into a store — sowing only ever visits the twelve pits.',
    ],
  },
  {
    title: 'How seeds reach the store',
    lines: [
      'Seeds reach a store only by being captured.',
    ],
  },
  {
    title: 'How seeds reach the store',
    lines: [
      'Or when the game ends and each side’s remaining seeds are swept into its own store.',
    ],
  },
  {
    title: 'How seeds reach the store',
    lines: [
      'The number in each store is that side’s running score.',
    ],
  },
  {
    title: 'How seeds reach the store',
    lines: [
      'First to 25 wins the game outright.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'Sowing a pit picks up every seed in it.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'It drops them one by one into the pits that follow, counter- clockwise.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'First along your row, then into the opponent’s row — one seed per pit.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'A short sow runs out of seeds before completing a lap.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'It simply stops in whichever pit receives the last seed.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'Where that last seed lands decides everything that happens next.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'Nothing more happens if it lands on your own side.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'A capture is possible if it lands on the opponent’s side.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'A pit can grow past eleven seeds through captures and further sowing.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'Twelve seeds is exactly enough for one full lap of the board.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'The pit you started from would be reached again.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'When that happens, your own starting pit (now empty) is skipped.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'No seed is dropped there — sowing carries straight into the next lap.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'This can continue for a second or further lap.',
    ],
  },
  {
    title: 'Relay sowing: seeding a second lap',
    lines: [
      'Still one seed per pit, until every seed picked up has been placed.',
    ],
  },
  {
    title: 'Why a pit never doubles up',
    lines: [
      'Because the starting pit is always skipped.',
    ],
  },
  {
    title: 'Why a pit never doubles up',
    lines: [
      'A pit gets a second seed from the same sow only after every other pit already has one.',
    ],
  },
  {
    title: 'Capturing',
    role: 'capture',
    lines: [
      'Your last seed can land in a pit.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'That pit belongs to the opponent.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'And that pit then holds exactly two or three seeds, you capture it.',
    ],
  },
  {
    title: 'Capturing',
    lines: [
      'Every seed in that pit goes straight into your store.',
    ],
  },
  {
    title: 'Chain captures',
    lines: [
      'Capturing then looks one pit further back along the same path you just sowed.',
    ],
  },
  {
    title: 'Chain captures',
    lines: [
      'If that pit is also on their side and holds two or three seeds.',
    ],
  },
  {
    title: 'Chain captures',
    lines: [
      'It is captured too — and so on, pit by pit.',
    ],
  },
  {
    title: 'When a capture does not happen',
    lines: [
      'The chain stops the moment it reaches a pit that is not at two or three seeds.',
    ],
  },
  {
    title: 'When a capture does not happen',
    lines: [
      'Or the moment it reaches your own side of the board.',
    ],
  },
  {
    title: 'When a capture does not happen',
    lines: [
      'Landing on your own side captures nothing.',
    ],
  },
  {
    title: 'When a capture does not happen',
    lines: [
      'Nor does landing on an opponent pit left at any count other than two or three.',
    ],
  },
  {
    title: 'Grand slam',
    lines: [
      'If a capture would take every seed remaining on the opponent’s side.',
    ],
  },
  {
    title: 'Grand slam',
    lines: [
      'That would leave them nothing at all to sow on their next turn.',
    ],
  },
  {
    title: 'Grand slam',
    lines: [
      'The move is still legal to play, but the capture is cancelled.',
    ],
  },
  {
    title: 'Grand slam',
    lines: [
      'No seeds move to your store.',
    ],
  },
  {
    title: 'Grand slam',
    lines: [
      'Every pit stays exactly as sowing left it.',
    ],
  },
  {
    title: 'Grand slam is not forbidden here',
    lines: [
      'This is the one place this build departs from a bare reading of the capture rule.',
    ],
  },
  {
    title: 'Grand slam is not forbidden here',
    lines: [
      'Some Oware rule sets forbid a move that would empty the opponent’s side.',
    ],
  },
  {
    title: 'Grand slam is not forbidden here',
    lines: [
      'They force a different pit to be played instead.',
    ],
  },
  {
    title: 'Grand slam is not forbidden here',
    lines: [
      'This build allows the move, but simply takes nothing from it.',
    ],
  },
  {
    title: 'Feeding a hungry opponent',
    lines: [
      'If the opponent has no seeds anywhere on their side, you may not play just any pit.',
    ],
  },
  {
    title: 'Feeding a hungry opponent',
    lines: [
      'You must choose a move that gives them at least one seed.',
    ],
  },
  {
    title: 'Feeding a hungry opponent',
    lines: [
      'That applies only if such a move is available to you.',
    ],
  },
  {
    title: 'When you are free of that rule',
    lines: [
      'Only when none of your pits can reach their empty side are you free of that restriction.',
    ],
  },
  {
    title: 'When you are free of that rule',
    lines: [
      'Then you have no legal move at all.',
    ],
  },
  {
    title: 'When you are free of that rule',
    lines: [
      'That ends the game at once (see the next page).',
    ],
  },
  {
    title: 'When you are free of that rule',
    lines: [
      'This rule only ever limits the side about to move.',
    ],
  },
  {
    title: 'When you are free of that rule',
    lines: [
      'It never restricts what the opponent can play on their own turn.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'The moment either side’s store reaches 25 or more captured seeds.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'The game ends immediately.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'That side wins — there is no need to finish sowing out the rest of the board.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'With 48 seeds on the board in total, only one side can reach 25.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'So this ending is always decisive.',
    ],
  },
  {
    title: 'How the game can end without a win',
    lines: [
      'Sometimes neither side reaches 25.',
    ],
  },
  {
    title: 'How the game can end without a win',
    lines: [
      'Whenever the game ends a different way, each side keeps its own remaining seeds.',
    ],
  },
  {
    title: 'How the game can end without a win',
    lines: [
      'Those seeds are added to their store — whoever then has more wins.',
    ],
  },
  {
    title: 'How the game can end without a win',
    lines: [
      'Equal totals are a draw.',
    ],
  },
  {
    title: 'No legal move, or threefold repetition',
    lines: [
      'No legal move: the player to move has no seeds left anywhere on their own side.',
    ],
  },
  {
    title: 'No legal move, or threefold repetition',
    lines: [
      'Or the opponent’s side is empty and none of the mover’s pits can reach across to feed it.',
    ],
  },
  {
    title: 'No legal move, or threefold repetition',
    lines: [
      'Threefold repetition: the same arrangement of seeds.',
    ],
  },
  {
    title: 'No legal move, or threefold repetition',
    lines: [
      'With the same side to move, occurring a third time.',
    ],
  },
  {
    title: 'No legal move, or threefold repetition',
    lines: [
      'That also ends the game the same way.',
    ],
  },
  {
    title: 'The quiet-moves rule, and exact draws',
    lines: [
      'One hundred quiet half-moves: a hundred moves in a row with no capture by either side.',
    ],
  },
  {
    title: 'The quiet-moves rule, and exact draws',
    lines: [
      'That also ends the game the same way.',
    ],
  },
  {
    title: 'The quiet-moves rule, and exact draws',
    lines: [
      'Both counts reset to zero the instant either side captures anything.',
    ],
  },
  {
    title: 'The quiet-moves rule, and exact draws',
    lines: [
      'Because the board holds 48 seeds between the two stores, these endings can produce an exact draw.',
    ],
  },
  {
    title: 'The quiet-moves rule, and exact draws',
    lines: [
      'Most simply, 24 seeds each.',
    ],
  },
];
