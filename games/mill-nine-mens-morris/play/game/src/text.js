// Words shown to players: the heritage page, the controls page. Facts are limited to what public sources confirm.
export const ABOUT = [
  ['Where it is played', 'Nine Men\'s Morris is one of the most widely played traditional board games in Europe. It is called Muhle ("mill") in German, Moulin in French, and Morris or Merels in English, after the rows of three that give the game its name.'],
  ['Carved in stone and wood', 'Boards are scratched into cloister seats and steps in medieval abbeys and cathedrals, including Westminster Abbey and the cathedrals of Canterbury, Gloucester, Norwich and Salisbury. A board was also found in the Gokstad ship burial in Norway, from about AD 900.'],
  ['On the green and in the tavern', 'The game needs only a pattern of lines and eighteen small markers. In England the board was sometimes cut into turf on a village green: Shakespeare has a character remark that "the nine men\'s morris is filled up with mud".'],
  ['A game with a known answer', 'In the 1990s the computer scientist Ralph Gasser searched every position of the game and showed that with perfect play by both sides it ends in a draw. People still win it every day, because nobody plays perfectly.'],
];
export const HOW = [
  ['Goal', 'Reduce the enemy to two men, or leave them with no legal move.'],
  ['1. Placing', 'Light starts. TAP an empty point to place a man. Each side places nine, one turn at a time.'],
  ['2. Sliding', 'When all men are placed, TAP one of your men, then TAP a glowing point next to it. You can also DRAG the man there. Men slide one step along a line.'],
  ['Mills', 'Three of your men in a row on one line is a mill. Each time you make one, TAP a glowing red enemy man to take it. Men in a mill are safe unless all the enemy men are in mills.'],
  ['3. Flying', 'A side with exactly three men left may fly: any man jumps to any empty point.'],
  ['Draws', 'The same position three times, or fifty moves each with no mill, is a draw.'],
  ['Buttons', 'Undo takes back your last move. Hint shows a good move and why. On a keyboard: arrow keys move, Space or Enter is a TAP, U is Undo, H is Hint, Esc is Menu.'],
];

// Exhaustive rules reference, paginated (Rules button on the title screen). Every claim here is
// cross-checked against the actual implementation in rules.js (the single source of truth for
// legality), so this page can never contradict the engine. `piece: true` marks a page that shows
// the real in-game man sprite in both colours, drawn with pieces.js's own drawMan() - never a
// separate simplified icon.
export const RULES = [
  {
    title: 'The board and setup',
    lines: [
      'The board has 24 points, laid out as three concentric squares - an outer, a middle and an inner square - joined by four spokes that run from the middle of each side, through all three squares, to the centre.',
      'Each side has nine men: nine Light and nine Dark. At the very start of the game the board is completely empty - every one of the eighteen men begins off the board, in hand.',
      'Light always moves first. After that, the two sides strictly alternate turns, one placement or move per turn, for the whole game.',
      '(This page covers the rules only. See Controls / How to play for taps, drags and keyboard.)',
    ],
  },
  {
    title: 'The man',
    piece: true,
    lines: [
      'There is only one kind of piece in this game - the man - in two colours, Light and Dark. No man is stronger than any other, and nothing is ever promoted.',
      'Placing phase: while a side still has men in hand, its turn is spent placing one of them on any empty point of its choice, anywhere on the board.',
      'Sliding phase: once a side has placed all nine of its men, its men no longer go into hand - on its turn it must instead slide one man already on the board to an empty point directly next to it along a line. It can never jump to a point that is not adjacent, and never onto an occupied point.',
      'Flying: the instant a side is left with exactly three men on the board and none left in hand, that side starts flying - each turn it may move one man to ANY empty point on the board, not only an adjacent one. It keeps this privilege for as long as it stays at exactly three men (and can lose it again if it is reduced further, at which point the very next mill against it usually ends the game - see Winning).',
      'The two sides can be in different phases at the same time - for example one side already flying while the other is still sliding, or even still placing.',
    ],
  },
  {
    title: 'Mills',
    lines: [
      'A mill is three of your own men in a row along one of the board\'s 16 lines - 12 lines run along the three squares (4 per square) and 4 run along the spokes.',
      'You can form a mill either by placing the third man during the placing phase, or by sliding or flying a man onto the third point during the moving phase.',
      'The instant you form a mill, you immediately remove one enemy man from the board (see Captures, next page, for which one). A man removed this way is gone for the rest of the game - it does not return to hand.',
      'A mill can be broken and remade: sliding a man out of a mill and later back into it forms the mill again and takes another man each time it closes. There is no limit on how many times this can happen.',
      'If a single move happens to close two mills at once, you still only take one enemy man, and you choose which.',
    ],
  },
  {
    title: 'Captures',
    lines: [
      'Not every enemy man is up for grabs when you form a mill. A man that is currently part of one of the enemy\'s own mills is protected and cannot be taken.',
      'The one exception: if every single one of the enemy\'s men is presently sitting in a mill, that protection is dropped entirely, and any of its men may be taken.',
      'You choose which eligible man to remove by tapping it; the game will only let you tap a man the rule above allows.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'A side wins the instant, right after its move, its opponent is left with fewer than three men in total - counting both the men still waiting in hand and the men on the board. In practice this means the opponent has been reduced to two men or fewer.',
      'A side also wins if its opponent has no legal move at all when its turn comes - every one of its men is boxed in with no empty adjacent point to slide to (and it is not flying). This can only arise once the placing phase has ended, since a side that still has men in hand can always place one, and a flying side can always move to any empty point.',
      'Either of these ends the game immediately - there is no requirement to also check for a draw once a side has won this way.',
    ],
  },
  {
    title: 'Draws',
    lines: [
      'A game that nobody has won this way can still end in a draw, but only once the placing phase is completely finished - both sides\' hands are empty and the game is in the sliding/flying phase. No draw can be declared while men are still being placed.',
      'Threefold repetition: if the exact same position - the same men on the same points and the same side to move - occurs three separate times during the moving phase, the game is drawn at once.',
      'The 100-ply rule: if 100 plies pass in the moving phase - 50 full moves by each side - without either side forming a mill, the game is drawn. Every slide or flight that does not close a mill counts toward this limit; forming a mill resets the count to zero.',
    ],
  },
];
