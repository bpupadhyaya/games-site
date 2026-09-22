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
    { title: 'The rules', body: [
      'Two sides. The 24 attackers (dark horn) move first. The 12 defenders (pale bone) and their king (gilt crown) start in the middle. Every piece slides like a rook, any distance, never jumping.',
      'Capture: close an enemy piece between two of yours on a row or column by moving. Moving in between two enemies is safe. The king captures too. Corners are hostile to all; the throne is hostile to attackers, and to defenders when empty.',
      'Only the king may stand on a corner or on the throne. Other pieces may slide over the empty throne.',
      'Defenders win when the king reaches any corner. Attackers win by taking the king: four around him (three beside the throne; on the small board, an ordinary sandwich), or by ringing in every defender. No legal move loses. The same position three times, or move 300, is a draw.',
    ] },
    { title: 'Boards and levels', body: [
      'Copenhagen 11x11 is the modern standard: 24 attackers against 12 defenders and a king. Brandubh 7x7 is the small starter board: 8 against 4 and a king, with a quicker king capture.',
      'Left out on purpose: the shieldwall capture and the edge-fort rule, so every rule can be learned in ten lessons.',
      'Levels: Learner slips often. Steady sees one-move escapes. Sharp looks three moves ahead. Master looks four ahead.',
      'Strength differs by side: the defenders\' king has many ways out, so a computer defender is given one move less foresight than an attacker at the same level. Beating Master as the attackers is the great challenge.',
    ] },
  ],
  about: [
    { title: 'Tafl: the king\'s table', body: [
      'Tafl is a family of strategy games played across Northern Europe for centuries. "Tafl" is Old Norse for a board game. In the best-known form, hnefatafl, a king and his defenders are surrounded by twice as many attackers.',
      'Boards and pieces have turned up in Scandinavia and the British Isles. A gaming board with a ruled grid, with a Nine Men\'s Morris pattern on its back, lay in the Gokstad ship burial in Norway (late 9th century). A 7x7 wooden board with pegged holes, found at Ballinderry in Ireland, is dated to the 10th century.',
      'Old Norse writing mentions the game too. The Orkneyinga saga lists skill at tafl among the accomplishments of Earl Rognvald of Orkney.',
    ] },
    { title: 'How it lived on', body: [
      'When chess reached the North in the 11th and 12th centuries it gradually replaced tafl, but local versions lived on: Brandubh in Ireland, Tawlbwrdd in Wales, Ard Ri in Scotland, and hnefatafl in Iceland.',
      'In 1732 the Swedish naturalist Carl Linnaeus, travelling in Lapland, noted down how the Sámi played Tablut on a 9x9 board. His account is a key source for rebuilding the rules.',
      'Nobody knows exactly how tafl was played in the Viking Age; today\'s rules are modern reconstructions. Copenhagen Hnefatafl on 11x11 is a widely played modern ruleset, and clubs play it around the world. This game uses a simplified version.',
    ] },
  ],
};
