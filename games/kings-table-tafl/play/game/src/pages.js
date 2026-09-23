// Text pages: Controls / rules (help) and the heritage page (about). Facts only; see design/GDD.md for sources and omissions.
export const PAGES = {
  help: [
    { title: 'Controls', body: [
      'TAP a piece: it lifts and every square it may reach glows. Then TAP a glowing square to move.',
      'Or DRAG a piece and drop it on a square. Both work the same way.',
      'Not allowed? The piece tries, comes back, and a message says why. Nothing is lost.',
      'TAP Take back to undo your last move (and the reply). TAP Hint for a good move and the reason (3 per game).',
      'Amber light along a row or column shows the king has a clear run to a corner (Warnings in the menu).',
      'Keyboard: ARROWS move the cursor, SPACE or ENTER is a TAP, U takes back, H gives a hint, ESCAPE opens the menu.',
    ] },
    // Split from one longer "The rules" page: at the top text-size step the original four paragraphs
    // ran past the panel. Two shorter, single-concept pages instead.
    { title: 'The rules', body: [
      'Two sides. The 24 attackers (dark horn) move first. The 12 defenders (pale bone) and their king (gilt crown) start in the middle. Every piece slides like a rook, any distance, never jumping.',
      'Capture: close an enemy piece between two of yours on a row or column by moving. Moving in between two enemies is safe. The king captures too. Corners are hostile to all; the throne is hostile to attackers, and to defenders when empty.',
    ] },
    { title: 'Winning and special squares', body: [
      'Only the king may stand on a corner or on the throne. Other pieces may slide over the empty throne.',
      'Defenders win when the king reaches any corner. Attackers win by taking the king: four around him (three beside the throne; on the small board, an ordinary sandwich), or by ringing in every defender. No legal move loses. The same position three times, or move 300, is a draw.',
    ] },
    // Likewise split "Boards and levels" - four paragraphs no longer fit one page at the top step.
    { title: 'Boards and levels', body: [
      'Copenhagen 11x11 is the modern standard: 24 attackers against 12 defenders and a king. Brandubh 7x7 is the small starter board: 8 against 4 and a king, with a quicker king capture.',
      'Left out on purpose: the shieldwall capture and the edge-fort rule, so every rule can be learned in ten lessons.',
    ] },
    { title: 'Computer levels', body: [
      'Levels: Learner slips often. Steady sees one-move escapes. Sharp looks three moves ahead. Master looks four ahead.',
      'Strength differs by side: the defenders\' king has many ways out, so a computer defender is given one move less foresight than an attacker at the same level. Beating Master as the attackers is the great challenge.',
    ] },
  ],
  about: [
    // Split from one longer "Tafl: the king's table" page: at the top text-size step all three
    // paragraphs together ran well past the panel. Two shorter, single-concept pages instead.
    { title: 'Tafl: the king\'s table', body: [
      'Tafl is a family of strategy games played across Northern Europe for centuries. "Tafl" is Old Norse for a board game. In the best-known form, hnefatafl, a king and his defenders are surrounded by twice as many attackers.',
      'Boards and pieces have turned up in Scandinavia and the British Isles. A gaming board with a ruled grid, with a Nine Men\'s Morris pattern on its back, lay in the Gokstad ship burial in Norway (late 9th century). A 7x7 wooden board with pegged holes, found at Ballinderry in Ireland, is dated to the 10th century.',
    ] },
    { title: 'Written record', body: [
      'Old Norse writing mentions the game too. The Orkneyinga saga lists skill at tafl among the accomplishments of Earl Rognvald of Orkney.',
    ] },
    // Likewise split "How it lived on" - three long paragraphs together overflowed at the top step.
    { title: 'How it lived on', body: [
      'When chess reached the North in the 11th and 12th centuries it gradually replaced tafl, but local versions lived on: Brandubh in Ireland, Tawlbwrdd in Wales, Ard Ri in Scotland, and hnefatafl in Iceland.',
      'In 1732 the Swedish naturalist Carl Linnaeus, travelling in Lapland, noted down how the Sámi played Tablut on a 9x9 board. His account is a key source for rebuilding the rules.',
    ] },
    { title: 'Playing it today', body: [
      'Nobody knows exactly how tafl was played in the Viking Age; today\'s rules are modern reconstructions. Copenhagen Hnefatafl on 11x11 is a widely played modern ruleset, and clubs play it around the world. This game uses a simplified version.',
    ] },
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
      'Tafl is a two-player game of unequal armies. The attackers, who move first, try to close in and take the king; the defenders and their king try to break out to safety.',
      'Copenhagen 11x11, the modern-standard board, sets up 24 attackers around the four edges, with 12 defenders and the king in a cross at the centre.',
      'Brandubh 7x7, the smaller starter board, sets up 8 attackers and 4 defenders and the king the same way, on a quicker, more forgiving table.',
      'The centre square is the throne; the four corner squares are the king\'s escape. Attackers move first, then the two sides strictly alternate, one move per turn.',
    ],
  },
  {
    title: 'The attacker', piece: 'A', body: [
      'Dark horn discs - 24 of them on the Copenhagen board, 8 on Brandubh. Their job is to close in on the defenders and take the king before he escapes.',
      'An attacker moves any distance in a straight line, along a row or a column, never diagonally, and stops the instant it meets another piece or the edge of the board. It can never jump over a piece.',
      'Like every piece except the king, an attacker may never stop on the throne or on a corner square, though it may slide straight over an empty throne on its way past.',
    ],
  },
  {
    title: 'The defender', piece: 'D', body: [
      'Pale bone discs - 12 of them on the Copenhagen board, 4 on Brandubh, standing between the king and the ring of attackers.',
      'A defender moves exactly like an attacker: any distance in a straight line, blocked by the first piece or edge it meets, never diagonally, never jumping.',
      'A defender may never stop on the throne or on a corner either - those two kinds of square are reserved for the king alone.',
    ],
  },
  {
    title: 'The king', piece: 'K', body: [
      'A taller bone piece banded in gilt. There is exactly one king, and he starts on the throne at the centre of the board.',
      'The king moves exactly like every other piece, any distance in a straight line, blocked the same way, but he alone may stop on the throne or on any corner square.',
      'The king captures an enemy piece the same way a defender does (see Capturing). Getting him to any corner wins the game outright for the defenders.',
    ],
  },
  {
    title: 'The throne and the corners', body: [
      'The throne (the centre square) and the four corners are special: only the king may ever stand on them. Every other piece may slide straight over an empty throne, but can never land on it, and can never land on a corner at all.',
      'For capturing, the corners count as hostile to both sides, always - an enemy piece pinned against a corner needs only one piece on its far side to be captured.',
      'The throne counts as hostile to attackers at all times, whether the king is standing on it or it stands empty. It counts as hostile to defenders only while it is empty - a defender is safe beside the throne while the king occupies it.',
    ],
  },
  {
    title: 'Capturing a piece', body: [
      'Custodian capture: move a piece so an enemy piece ends up sandwiched, in a straight line, between the piece that just moved and another piece of the same side (or a hostile corner or throne square, previous page) - that enemy piece is captured.',
      'Only the side that just moved captures. Sliding your own piece in between two enemies is always safe: a sandwich only triggers on the move that creates it, never just by sitting still.',
      'The king captures the same way a defender does. The king himself can never be captured this way - taking the king works differently, covered next.',
    ],
  },
  // Split from one longer "Taking the king" page: all three paragraphs together ran well past the
  // panel at the top text-size step. Two shorter, single-concept pages instead.
  {
    title: 'Taking the king', body: [
      'On the Copenhagen 11x11 board, the king is captured by surrounding every open side next to him with an attacker (or a corner, or the throne itself when he stands beside it) - all four sides away from any edge, or however many sides he has if he stands on the edge of the board.',
    ],
  },
  {
    title: 'Taking the king: exceptions', body: [
      'The throne counts as one of those hostile sides whenever the king stands directly next to it, so in that position three attackers plus the throne are enough.',
      'On the smaller Brandubh 7x7 board, this strict rule only applies on or beside the throne. Everywhere else on that board, an ordinary two-piece sandwich - one attacker (or hostile corner or throne) on each opposite side - takes the king, exactly like any other piece. This is a deliberate simplification so the small board plays fast.',
    ],
  },
  {
    title: 'Winning the game', body: [
      'Defenders win the instant the king reaches any one of the four corners - the game ends immediately.',
      'Attackers win by taking the king (previous page), or by closing an unbroken ring of attackers around every remaining defender - a ring where diagonal contact between attacker pieces also blocks a defender\'s escape.',
      'Either side loses on the spot if it is their turn to move and they have no legal move at all.',
    ],
  },
  {
    title: 'Draws', body: [
      'If the exact same position - the same pieces on the same squares, with the same side to move - occurs for the third time in a game, the game is drawn.',
      'If 300 plies (individual moves, counting both sides) pass with no result, the game is drawn.',
    ],
  },
  {
    title: 'What this game leaves out', body: [
      'This is a documented simplification of tournament Hnefatafl, chosen to keep every capture explainable in one sentence for the ten-lesson curriculum.',
      'Left out on purpose: the shieldwall capture (a line of defenders taken all at once against the board edge), and the edge-fort rule (a perpetual-safety formation for a king trapped on the edge). Neither is implemented here.',
      'Everything else on these pages - movement, capturing, the throne and corners, taking the king, winning and draws - describes exactly what this game plays, on both board sizes.',
    ],
  },
];
