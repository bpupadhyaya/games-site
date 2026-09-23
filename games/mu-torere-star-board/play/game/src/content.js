// Texts shown on the About and How to play pages. Only well-documented facts about the game; nothing invented.
export const ABOUT = [
  ['A game of Aotearoa', 'Mū Tōrere is a traditional board game of the Māori people of Aotearoa New Zealand.'],
  ['The board', 'Two players face each other across a board shaped like an eight-pointed star. Each has four stones. The pit in the middle is called the putahi.'],
  ['A puzzle of space', 'Eight stones share nine points, so there is only ever one empty point. Every move fills it and opens another, and the player who cannot move loses.'],
  ['The centre rule', 'A stone may enter the putahi only from a point beside an enemy stone. This game uses the commonly published rules.'],
  ['Perfect play', 'We analysed every possible position of the game for this app. Neither player can force a win from the start: with perfect play it is a draw. Wins come from traps and mistakes, and the top opponents never make one.'],
  ['Names', 'You will also see the game written without macrons, as Mu Torere.'],
  ['With care', 'This app was made by people outside Māori communities. The star board and the koru spirals are decoration added for this game. We welcome corrections and guidance, and a review by Māori advisors is planned.'],
];
// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation
// in rules.js (the single source of truth for legality and for the win/draw conditions), so this
// page can never contradict the engine. An item is [heading, body] like ABOUT/HOWTO above, or
// [heading, body, 'stones'] on the one item that also shows the real in-game stone art for both
// sides (Mū Tōrere has only one kind of stone per side, so there is a single "piece" page, not one
// per piece type).
export const RULES = [
  [
    'The board and the start',
    'Two players share a board shaped like an eight-pointed star: eight points around the rim, ' +
    'plus one pit in the middle, the putahi. Eight stones share these nine points, so exactly one ' +
    'point is always empty. Shell (pale) starts on one run of four neighbouring rim points, and ' +
    'Greenstone starts on the other four; the putahi begins empty. Shell always moves first, then ' +
    'the players strictly alternate turns, one move per turn. (This page covers the rules only - ' +
    'see How to play for tap and drag controls.)',
  ],
  [
    'The stone',
    'Both sides use one kind of stone, and it moves the same way for Shell and for Greenstone - ' +
    'there is no other piece type in this game. On your turn you move one of your own stones one ' +
    'step to an empty point: either along the rim to the very next point around the star, or ' +
    'between the rim and the putahi in the centre (the exact centre rule is on the next page). ' +
    'A stone never jumps over another stone, and it can only ever move onto a point that is empty ' +
    '- there are no captures anywhere in this game.',
    'stones',
  ],
  [
    'Moving around the rim',
    'A rim stone may slide to either of its two immediate neighbours around the star - one step ' +
    'clockwise or one step counter-clockwise - but only if that neighbouring point is empty. It ' +
    'cannot skip over a stone, and it cannot jump straight across the board to a non-neighbouring ' +
    'point.',
  ],
  [
    'The centre rule',
    'A stone standing on the rim may step into the putahi only when the putahi is empty AND that ' +
    'stone stands immediately beside a stone of the opposite colour - that is, at least one of its ' +
    'two rim neighbours belongs to the other side. A stone with only empty neighbours, or with only ' +
    'neighbours of its own colour, cannot enter the putahi yet. A stone already sitting in the ' +
    'putahi may step back out to ANY empty point on the rim, not only a neighbouring one - leaving ' +
    'the putahi has no adjacency requirement at all. Only one stone can occupy the putahi at a time.',
  ],
  [
    'Winning the game',
    'After every move it becomes the other player\'s turn. If that player then has no legal move ' +
    'at all - every one of their stones is boxed in by occupied neighbours, with no beside-an-enemy ' +
    'chance to enter the putahi either - the game ends immediately and they lose: the player who ' +
    'just moved wins.',
  ],
  [
    'Ending in a draw',
    'This version adds one drawing rule beyond the traditional game: if the exact same layout of ' +
    'stones, with the same side to move, occurs for a third time in the game, the game ends at once ' +
    'as a draw - nobody wins. Reaching the same position only once or twice changes nothing; it ' +
    'takes a third occurrence.',
  ],
];

export const HOWTO = [
  ['Goal', 'Leave your opponent with no legal move. Same position three times is a draw.'],
  ['Move', 'TAP one of your stones, then TAP a glowing point. Or DRAG the stone onto a glowing point.'],
  ['One step', 'A stone moves one step to the empty point beside it around the star, or between the rim and the putahi (the centre).'],
  ['The centre rule', 'A stone may enter the putahi only when it stands beside an enemy stone. A stone in the putahi may step out to any empty point.'],
  ['Help', 'Hint shows a good move and says why (3 per game). Take back undoes your move and the reply. Warnings, in the menu, mark moves that lose.'],
  ['The Ladder', 'Beat each of twelve opponents to climb. The last two cannot be beaten, only held to a draw. A lost game swaps who moves first.'],
  ['Keyboard', 'Left and Right arrows step around the star, Up and Down jump to the putahi and back. Space or Enter is a TAP. U takes back, H is a hint, Escape is Menu.'],
];
