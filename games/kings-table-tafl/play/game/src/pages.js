// Text pages: Controls / rules (help) and the heritage page (about). Facts only; see design/GDD.md for sources and omissions.
// Every page here is paced to fit comfortably in the reference panel at the TOP text-size step
// (TEXT_SCALES' last entry, currently 300%) - see layout.js. That step wraps text much wider than
// the base 100% step, so most pages are down to a single short sentence, and a single long sentence
// often still needs splitting by clause across two or more pages. Never shrink the font to force a
// fit - split into another single-concept page instead.
export const PAGES = {
  help: [
    { title: 'Controls', body: ['TAP a piece: it lifts and every square it may reach glows.'] },
    { title: 'Controls: tap to move', body: ['Then TAP a glowing square to move.'] },
    { title: 'Controls: dragging', body: ['Or DRAG a piece and drop it on a square.'] },
    { title: 'Either way works', body: ['Both work the same way.'] },
    { title: 'Controls: mistakes', body: ['Not allowed? The piece tries, comes back, and a message says why.'] },
    { title: 'Controls: nothing lost', body: ['Nothing is lost.'] },
    { title: 'Controls: undo', body: ['TAP Take back to undo your last move (and the reply).'] },
    { title: 'Controls: hints', body: ['TAP Hint for a good move and the reason (3 per game).'] },
    { title: 'Controls: warnings', body: ['Amber light along a row or column shows the king has a clear run to a corner'] },
    { title: 'Controls: warnings menu', body: ['(Warnings in the menu).'] },
    { title: 'Controls: keyboard', body: ['Keyboard: ARROWS move the cursor, SPACE or ENTER is a TAP,'] },
    { title: 'Keyboard: more keys', body: ['U takes back, H gives a hint, ESCAPE opens the menu.'] },
    { title: 'The rules', body: ['Two sides. The 24 attackers (dark horn) move first.'] },
    { title: 'The rules: defenders', body: ['The 12 defenders (pale bone) and their king (gilt crown) start in the middle.'] },
    { title: 'The rules: movement', body: ['Every piece slides like a rook, any distance, never jumping.'] },
    { title: 'The rules: capturing', body: ['Capture: close an enemy piece between two of yours on a row or column by moving.'] },
    { title: 'The rules: safe squares', body: ['Moving in between two enemies is safe. The king captures too.'] },
    { title: 'Corners and the throne', body: ['Corners are hostile to all; the throne is hostile to attackers, and to defenders when empty.'] },
    { title: 'Winning', body: ['Only the king may stand on a corner or on the throne.'] },
    { title: 'Sliding over the throne', body: ['Other pieces may slide over the empty throne.'] },
    { title: 'Winning: defenders', body: ['Defenders win when the king reaches any corner.'] },
    { title: 'Winning: attackers', body: ['Attackers win by taking the king: four around him'] },
    { title: 'Winning: the sandwich', body: ['(three beside the throne; on the small board, an ordinary sandwich),'] },
    { title: 'Winning: attackers (cont.)', body: ['or by ringing in every defender.'] },
    { title: 'No legal moves', body: ['No legal move loses.'] },
    { title: 'Draws', body: ['The same position three times, or move 300, is a draw.'] },
    { title: 'Boards and levels', body: ['Copenhagen 11x11 is the modern standard: 24 attackers against 12 defenders and a king.'] },
    { title: 'Boards: Brandubh', body: ['Brandubh 7x7 is the small starter board: 8 against 4 and a king, with a quicker king capture.'] },
    { title: 'Left out on purpose', body: ['Left out on purpose: the shieldwall capture and the edge-fort rule,'] },
    { title: 'Ten lessons', body: ['so every rule can be learned in ten lessons.'] },
    { title: 'Computer levels', body: ['Levels: Learner slips often. Steady sees one-move escapes.'] },
    { title: 'Sharp and Master', body: ['Sharp looks three moves ahead. Master looks four ahead.'] },
    { title: 'Strength by side', body: ['Strength differs by side: the defenders\' king has many ways out,'] },
    { title: 'Strength by side (cont.)', body: ['so a computer defender is given one move less foresight than an attacker at the same level.'] },
    { title: 'The great challenge', body: ['Beating Master as the attackers is the great challenge.'] },
  ],
  about: [
    { title: 'Tafl: the king\'s table', body: ['Tafl is a family of strategy games played across Northern Europe for centuries.'] },
    { title: 'Old Norse for board game', body: ['"Tafl" is Old Norse for a board game.'] },
    { title: 'Hnefatafl', body: ['In the best-known form, hnefatafl, a king and his defenders are surrounded by twice as many attackers.'] },
    { title: 'Archaeology', body: ['Boards and pieces have turned up in Scandinavia and the British Isles.'] },
    { title: 'The Gokstad ship', body: ['A gaming board with a ruled grid, with a Nine Men\'s Morris pattern on its back,'] },
    { title: 'The Gokstad ship: found', body: ['lay in the Gokstad ship burial in Norway (late 9th century).'] },
    { title: 'Ballinderry', body: ['A 7x7 wooden board with pegged holes, found at Ballinderry in Ireland,'] },
    { title: 'Ballinderry: dated', body: ['is dated to the 10th century.'] },
    { title: 'Written record', body: ['Old Norse writing mentions the game too.'] },
    { title: 'The Orkneyinga saga', body: ['The Orkneyinga saga counts skill at tafl among Earl Rognvald of Orkney\'s virtues.'] },
    { title: 'How it lived on', body: ['When chess reached the North in the 11th and 12th centuries it gradually replaced tafl,'] },
    { title: 'Local versions lived on', body: ['but local versions lived on: Brandubh in Ireland, Tawlbwrdd in Wales, Ard Ri in Scotland, and hnefatafl in Iceland.'] },
    { title: 'Carl Linnaeus', body: ['In 1732 the Swedish naturalist Carl Linnaeus, travelling in Lapland,'] },
    { title: 'Carl Linnaeus: Tablut', body: ['noted down how the Sámi played Tablut on a 9x9 board.'] },
    { title: 'A key source', body: ['His account is a key source for rebuilding the rules.'] },
    { title: 'Playing it today', body: ['Nobody knows exactly how tafl was played in the Viking Age; today\'s rules are modern guesses.'] },
    { title: 'Copenhagen Hnefatafl', body: ['Copenhagen Hnefatafl on 11x11 is a widely played modern ruleset, and clubs play it around the world.'] },
    { title: 'A simplified version', body: ['This game uses a simplified version.'] },
  ],
};

// Exhaustive rules reference. Every claim here is cross-checked against the actual implementation in
// rules.js (the single source of truth for legality), never idealized/textbook Hnefatafl. Where this
// game's ruleset is a documented simplification (see design/GDD.md "Ruleset"), that is stated plainly
// rather than glossed over. `piece` (when present) is the real in-game piece kind ('A'/'D'/'K') to draw
// alongside that page, via the board's own drawPiece() - never a separate simplified icon.
export const RULES = [
  {
    title: 'The board and setup', body: [
      'Tafl is a two-player game of unequal armies.',
    ],
  },
  {
    title: 'Two armies', body: [
      'The attackers, who move first, try to close in and take the king; the defenders and their king try to break out to safety.',
    ],
  },
  {
    title: 'Boards: Copenhagen', body: [
      'Copenhagen 11x11, the standard modern board, sets up 24 attackers around the four edges,',
    ],
  },
  {
    title: 'Boards: Copenhagen setup', body: [
      'with 12 defenders and the king in a cross at the centre.',
    ],
  },
  {
    title: 'Boards: Brandubh', body: [
      'Brandubh 7x7, the smaller starter board, sets up 8 attackers and 4 defenders and the king the same way,',
    ],
  },
  {
    title: 'Boards: Brandubh table', body: [
      'on a quicker, more forgiving table.',
    ],
  },
  {
    title: 'The throne and turn order', body: [
      'The centre square is the throne; the four corner squares are the king\'s escape.',
    ],
  },
  {
    title: 'Turn order', body: [
      'Attackers move first, then the two sides strictly alternate, one move per turn.',
    ],
  },
  {
    title: 'The attacker', piece: 'A', body: [
      'Dark horn discs - 24 of them on the Copenhagen board, 8 on Brandubh.',
    ],
  },
  {
    title: 'The attacker: job', body: [
      'Their job is to close in on the defenders and take the king before he escapes.',
    ],
  },
  {
    title: 'The attacker: movement', body: [
      'An attacker moves any distance in a straight line, along a row or a column, never diagonally,',
    ],
  },
  {
    title: 'The attacker: stopping', body: [
      'and stops the instant it meets another piece or the edge of the board.',
    ],
  },
  {
    title: 'The attacker: no jumping', body: [
      'It can never jump over a piece.',
    ],
  },
  {
    title: 'The attacker: restrictions', body: [
      'Like every piece except the king, an attacker may never stop on the throne or on a corner square,',
    ],
  },
  {
    title: 'Sliding over the throne', body: [
      'though it may slide straight over an empty throne on its way past.',
    ],
  },
  {
    title: 'The defender', piece: 'D', body: [
      'Pale bone discs - 12 of them on the Copenhagen board, 4 on Brandubh,',
    ],
  },
  {
    title: 'The defender: position', body: [
      'standing between the king and the ring of attackers.',
    ],
  },
  {
    title: 'The defender: movement', body: [
      'A defender moves exactly like an attacker: any distance in a straight line,',
    ],
  },
  {
    title: 'The defender: blocked', body: [
      'blocked by the first piece or edge it meets, never diagonally, never jumping.',
    ],
  },
  {
    title: 'The defender: restrictions', body: [
      'A defender may never stop on the throne or on a corner either -',
    ],
  },
  {
    title: 'Reserved for the king', body: [
      'those two kinds of square are reserved for the king alone.',
    ],
  },
  {
    title: 'The king', piece: 'K', body: [
      'A taller bone piece banded in gilt.',
    ],
  },
  {
    title: 'The king: one king', body: [
      'There is exactly one king, and he starts on the throne at the centre of the board.',
    ],
  },
  {
    title: 'The king: movement', body: [
      'The king moves exactly like every other piece, any distance in a straight line, blocked the same way,',
    ],
  },
  {
    title: 'The king: special squares', body: [
      'but he alone may stop on the throne or on any corner square.',
    ],
  },
  {
    title: 'The king: capturing', body: [
      'The king captures an enemy piece the same way a defender does (see Capturing).',
    ],
  },
  {
    title: 'The king: winning', body: [
      'Getting him to any corner wins the game outright for the defenders.',
    ],
  },
  {
    title: 'The throne and the corners', body: [
      'The throne (the centre square) and the four corners are special: only the king may ever stand on them.',
    ],
  },
  {
    title: 'Passing over the throne', body: [
      'Every other piece may slide straight over an empty throne,',
    ],
  },
  {
    title: 'Never landing on a corner', body: [
      'but can never land on it, and can never land on a corner at all.',
    ],
  },
  {
    title: 'Corners are always hostile', body: [
      'For capturing, the corners count as hostile to both sides, always -',
    ],
  },
  {
    title: 'Corners: one piece captures', body: [
      'an enemy piece pinned against a corner needs only one piece on its far side to be captured.',
    ],
  },
  {
    title: 'The throne: hostile to whom', body: [
      'The throne counts as hostile to attackers at all times,',
    ],
  },
  {
    title: 'Occupied or empty', body: [
      'whether the king is standing on it or it stands empty.',
    ],
  },
  {
    title: 'The throne: for defenders', body: [
      'It counts as hostile to defenders only while it is empty -',
    ],
  },
  {
    title: 'Safe beside the king', body: [
      'a defender is safe beside the throne while the king occupies it.',
    ],
  },
  {
    title: 'Capturing a piece', body: [
      'Custodian capture: move a piece so an enemy piece ends up sandwiched, in a straight line,',
    ],
  },
  {
    title: 'Capturing: the sandwich', body: [
      'between the piece that just moved and another piece of the same side',
    ],
  },
  {
    title: 'Corners count too', body: [
      '(or a hostile corner or throne square, previous page).',
    ],
  },
  {
    title: 'Capturing: the result', body: [
      'That enemy piece is captured.',
    ],
  },
  {
    title: 'Capturing a piece: safety', body: [
      'Only the side that just moved captures.',
    ],
  },
  {
    title: 'Sliding in safely', body: [
      'Sliding your own piece in between two enemies is always safe:',
    ],
  },
  {
    title: 'Only on the move', body: [
      'a sandwich only triggers on the move that creates it, never just by sitting still.',
    ],
  },
  {
    title: 'Capturing a piece: the king', body: [
      'The king captures the same way a defender does.',
    ],
  },
  {
    title: 'Never sandwiched', body: [
      'The king himself can never be captured this way - taking the king works differently, covered next.',
    ],
  },
  {
    title: 'Taking the king', body: [
      'On the Copenhagen 11x11 board, the king is captured',
    ],
  },
  {
    title: 'Taking the king: surrounded', body: [
      'by surrounding every open side next to him with an attacker',
    ],
  },
  {
    title: 'Corner or throne counts', body: [
      '(or a corner, or the throne itself when he stands beside it) -',
    ],
  },
  {
    title: 'Taking the king: all sides', body: [
      'all four sides away from any edge,',
    ],
  },
  {
    title: 'On the board edge', body: [
      'or however many sides he has if he stands on the edge of the board.',
    ],
  },
  {
    title: 'Taking the king: exceptions', body: [
      'The throne counts as one of those hostile sides whenever the king stands directly next to it,',
    ],
  },
  {
    title: 'Three attackers plus throne', body: [
      'so in that position three attackers plus the throne are enough.',
    ],
  },
  {
    title: 'Taking the king: Brandubh', body: [
      'On the smaller Brandubh 7x7 board, this strict rule only applies on or beside the throne.',
    ],
  },
  {
    title: 'Taking the king: sandwich', body: [
      'Everywhere else on that board, an ordinary two-piece sandwich -',
    ],
  },
  {
    title: 'Sandwich: how it works', body: [
      'one attacker (or hostile corner or throne) on each opposite side -',
    ],
  },
  {
    title: 'Sandwich: like any piece', body: [
      'takes the king, exactly like any other piece.',
    ],
  },
  {
    title: 'Why this is simplified', body: [
      'This rule is simplified on purpose so the small board plays fast.',
    ],
  },
  {
    title: 'Winning the game', body: [
      'Defenders win the instant the king reaches any one of the four corners -',
    ],
  },
  {
    title: 'Winning: game ends', body: [
      'the game ends immediately.',
    ],
  },
  {
    title: 'How attackers win', body: [
      'Attackers win by taking the king (previous page),',
    ],
  },
  {
    title: 'How attackers win: rings', body: [
      'or by closing an unbroken ring of attackers around every remaining defender.',
    ],
  },
  {
    title: 'Diagonal contact counts', body: [
      'In that ring, diagonal contact between attacker pieces also blocks a defender\'s escape.',
    ],
  },
  {
    title: 'No legal moves', body: [
      'Either side loses on the spot if it is their turn to move',
    ],
  },
  {
    title: 'No legal moves: losing', body: [
      'and they have no legal move at all.',
    ],
  },
  {
    title: 'Draws', body: [
      'If the exact same position - the same pieces on the same squares, with the same side to move -',
    ],
  },
  {
    title: 'Draws: three times', body: [
      'occurs for the third time in a game, the game is drawn.',
    ],
  },
  {
    title: 'Draws: the move limit', body: [
      'If 300 plies (individual moves, counting both sides) pass with no result, the game is drawn.',
    ],
  },
  {
    title: 'What this game leaves out', body: [
      'This is a documented simpler version of tournament Hnefatafl,',
    ],
  },
  {
    title: 'One sentence per capture', body: [
      'chosen to keep every capture explainable in one sentence for the ten-lesson curriculum.',
    ],
  },
  {
    title: 'Left out: specifics', body: [
      'Left out on purpose: the shieldwall capture',
    ],
  },
  {
    title: 'The shieldwall capture', body: [
      '(a line of defenders taken all at once against the board edge),',
    ],
  },
  {
    title: 'The edge-fort rule', body: [
      'and the edge-fort rule (a permanent safety formation for a king trapped on the edge).',
    ],
  },
  {
    title: 'Everything else', body: [
      'Neither is implemented here.',
    ],
  },
  {
    title: 'What these pages cover', body: [
      'Everything else on these pages -',
    ],
  },
  {
    title: 'Topics these pages cover', body: [
      'movement, capturing, the throne and corners, taking the king, winning and draws -',
    ],
  },
  {
    title: 'True on both board sizes', body: [
      'describes exactly what this game plays, on both board sizes.',
    ],
  },
];
