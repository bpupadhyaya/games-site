// Text content for the Rules reference page. Kept factual and cross-checked against the actual
// rule book in rules.js so this page can never contradict the engine. Short-paragraph style, one
// idea per line, like the About page (about.js). `role` tells view.js which real in-game board
// snapshot (drawn with the game's own drawBoard/drawSeed/pitPos/slot) to show under the title, if
// any - never a separate invented icon set.
export const RULES = [
  {
    title: 'The board and the start of a game',
    role: 'setup',
    lines: [
      'Oware is played on an oval board of twelve pits, six on each side, plus one long store at each end that holds seeds a side has already captured.',
      'Your six pits are the bottom row, left to right. The opponent’s six pits are the top row, right to left — together the twelve pits form one loop, sown counter-clockwise all the way round.',
      'Every game starts with four seeds in each of the twelve pits — 48 seeds in all — and both stores empty.',
      'You always sow first, from the bottom row. (In a two-player game, Player one — the bottom row — goes first.)',
    ],
  },
  {
    title: 'Your pits',
    role: 'mine',
    lines: [
      'Your six pits are the bottom row. Tap any one of them that holds at least one seed to sow it.',
      'Sowing picks up every seed in that pit and drops them one at a time into the pits that follow, going counter-clockwise.',
      'You may never sow from an empty pit, and you may never sow from one of the opponent’s pits.',
    ],
  },
  {
    title: 'The opponent’s pits',
    role: 'theirs',
    lines: [
      'The opponent’s six pits are the top row, on the far side of the board from you. They sow from these pits on their turn, exactly as you sow from yours.',
      'You cannot sow from them, but your sowing can land seeds in them — and landing your very last seed in one, leaving it with exactly two or three seeds, captures it (see “Capturing”).',
    ],
  },
  {
    title: 'The store',
    role: 'store',
    lines: [
      'Each side has one store: a long trough at that side’s end of the board, kept separate from the twelve sowing pits.',
      'Seeds are never sown into a store — sowing only ever visits the twelve pits. Seeds reach a store only by being captured, or when the game ends and each side’s remaining seeds are swept into its own store.',
      'The number in each store is that side’s running score. First to 25 wins the game outright.',
    ],
  },
  {
    title: 'How sowing works',
    lines: [
      'Sowing a pit picks up every seed in it and drops them one by one into the pits that follow, counter-clockwise: along your row, then straight on into the opponent’s row, one seed per pit.',
      'A short sow — one that runs out of seeds before completing a lap — simply stops in whichever pit receives the last seed.',
      'Where that last seed lands decides everything that happens next: nothing more if it lands on your own side, a possible capture if it lands on the opponent’s side.',
    ],
  },
  {
    title: 'Relay sowing: pits with 12 seeds or more',
    lines: [
      'A pit can grow past eleven seeds through captures and further sowing. Twelve seeds is exactly enough for one full lap of the board — the pit you started from would be reached again.',
      'When that happens, your own now-empty starting pit is skipped: no seed is dropped there, and sowing carries straight on into a second (or further) lap, still one seed per pit, until every seed picked up has been placed.',
      'Because the starting pit is always skipped, a pit only ever receives a second seed from the same sow after every other pit has already received its own.',
    ],
  },
  {
    title: 'Capturing',
    role: 'capture',
    lines: [
      'If your very last sown seed lands in one of the opponent’s pits and that pit then holds exactly two or three seeds, you capture every seed in it, straight into your store.',
      'Capturing then looks one pit further back along the same path you just sowed: if that pit is also on the opponent’s side and also holds exactly two or three seeds, you capture it too — and so on, pit by pit.',
      'The chain stops the moment it reaches a pit that is not at two or three seeds, or reaches your own side of the board.',
      'Landing on your own side, or on an opponent pit left at any count other than two or three, captures nothing.',
    ],
  },
  {
    title: 'Grand slam: taking every seed the opponent has',
    lines: [
      'If a capture would take every seed remaining on the opponent’s side — leaving them nothing at all to sow next turn — the move is still legal to play, but the capture is cancelled: no seeds move to your store, and every pit stays exactly as sowing left it.',
      'This is the one place this build departs from a bare reading of “capture any pit left at two or three”: some Oware rule sets forbid such a move outright, forcing a different pit instead; this build allows the move but simply takes nothing from it.',
    ],
  },
  {
    title: 'Feeding a hungry opponent',
    lines: [
      'If the opponent currently has no seeds anywhere on their side, you may not just play any pit you like: you must choose a move that gives them at least one seed, if any such move is available to you.',
      'Only when none of your pits can reach across to their empty side are you free of that restriction — and in that situation you have no legal move at all, which ends the game at once (see the next page).',
      'This rule only ever limits the side about to move; it never restricts what the opponent can play on their own turn.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'The moment either side’s store reaches 25 or more captured seeds, the game ends immediately and that side wins — there is no need to finish sowing out the rest of the board.',
      'With 48 seeds on the board in total, only one side can ever reach 25 in a single game, so this ending is always decisive.',
    ],
  },
  {
    title: 'How the game can end without a win',
    lines: [
      'Sometimes neither side reaches 25. Whenever the game ends a different way, each side simply keeps whatever seeds are still sitting on their own side, added to their store — whoever then has more wins; equal totals are a draw.',
      'No legal move: either the player to move has no seeds left anywhere on their own side, or the opponent’s side is empty and none of the mover’s pits can reach across to feed it.',
      'Threefold repetition: the exact same arrangement of seeds, with the same side to move, occurring for the third time ends the game the same way.',
      'One hundred quiet half-moves: a hundred moves in a row with no capture by either side also ends the game the same way. Both counts reset to zero the instant either side captures anything.',
      'Because the board holds 48 seeds between the two stores, these endings can also produce an exact draw — most simply, 24 seeds each.',
    ],
  },
];
