// Heritage and how-to pages. Only facts that are verified; anything uncertain is left out or stated as uncertain.
export const ABOUT = {
  title: 'About Senet',
  parts: [
    ['A game of passing', 'Senet is a board game of ancient Egypt. Its Egyptian name is usually translated as "passing".'],
    ['How old is it?', 'Fragments of boards from burials of around 3100 BCE are thought by some scholars to belong to the game. The earliest secure picture is in the tomb of the official Hesy-Ra at Saqqara (around 2600 BCE): it shows a board, pieces and throwing sticks.'],
    ['The board', 'Thirty squares in three rows of ten. Two players race their pieces along an S-shaped path, moving by the throw of sticks.'],
    ['Played by many', 'Senet was enjoyed by people of many ranks for well over two thousand years. Game boxes of ebony and ivory were found in the tomb of Tutankhamun, and a wall painting in the tomb of Queen Nefertari shows her playing. Scholars note that in later periods Senet boards took on symbolic meanings.'],
    ['The rules are reconstructed', 'No complete ancient rules survive. This game follows one widely published modern reconstruction, associated with the Egyptologist Timothy Kendall. Other scholars have proposed different rules. The names House of Rebirth, House of Happiness and House of Water are those used by modern scholars for the marked squares.'],
    ['One simplification', 'Here a piece never moves backward, and a turn with no legal move simply passes. Senet appears to have gone out of use by Roman times.'],
  ],
};
// Exhaustive rules reference, one topic per page. Every claim here is cross-checked against rules.js,
// the single source of truth for legality - this page can never contradict the engine. See STATUS.md
// and design/GDD.md for the one documented simplification (no backward moves; a throw with no legal
// move simply passes) and the naming choices (no deity names for the last three squares).
export const RULES = [
  {
    title: 'The board and the race',
    lines: [
      'Senet is played on a track of 30 squares in three rows of ten. On this screen the board is turned upright: the path runs down the left column (squares 1 to 10), up the middle column (11 to 20), then down the right column (21 to 30). Home lies just past square 30.',
      'Each side has 5 pieces. Player one’s cones start on the odd squares 1, 3, 5, 7 and 9; player two’s reels start on the even squares 2, 4, 6, 8 and 10 - alternating along the first column.',
      'Player one, the cones, always throws first.',
      'A piece only ever moves forward along this path, toward square 30 and off the board. It never moves backward.',
    ],
  },
  {
    title: 'The pieces: cone and reel',
    piece: true,
    lines: [
      'Senet has only one kind of piece per side - there are no ranks or special roles. Every one of your five pieces moves by exactly the same rule.',
      'Player one plays the turquoise cones; player two plays the blue-and-gold reels.',
      'On your turn you must move one of your pieces forward exactly the number thrown, if any legal move exists with that throw.',
    ],
  },
  {
    title: 'Throwing the sticks',
    sticks: true,
    lines: [
      'TAP the tray of four flat throwing sticks (or press Space) to throw them. Each stick lands showing either its light (ivory) face or its dark (ebony) face.',
      'Count the light faces: a throw of 1, 2, 3 or 4 light faces up moves that many squares. If none land light side up, that counts as a throw of 5.',
      'With four fair sticks this gives the odds built into the game: a 1 comes up 4 times in 16 (25%), a 2 comes up 6 in 16 (37.5%), a 3 comes up 4 in 16 (25%), a 4 comes up 1 in 16 (6.25%), and a 5 (no light faces at all) also 1 in 16 (6.25%).',
      'A throw of 1, 4 or 5 earns that same player another throw right away. A throw of 2 or 3 passes the turn to the other side once the move is made or skipped.',
    ],
  },
  {
    title: 'Passing, landing and the swap',
    lines: [
      'You may freely pass over one or two enemy pieces on your way to a square - only the square you finally land on matters.',
      'Landing on an empty square simply moves your piece there. You may never land on a square already held by one of your own pieces.',
      'Landing on a single, unprotected enemy piece swaps the two: that enemy piece is sent all the way back to the square your piece just left, and your piece takes its place.',
      'A piece is protected from the swap, and cannot be landed on at all, when another piece of its own side sits directly next to it on the path (immediately before or after it), or when it stands on one of the safe houses described on the next pages.',
      'Three or more pieces of one side on consecutive squares form a wall: the other side’s pieces may neither land on, nor pass through, any square inside that wall.',
    ],
  },
  {
    title: 'Rebirth and Happiness',
    lines: [
      'Square 15, the House of Rebirth, is a safe house: a lone piece standing there can never be swapped. It is also where a piece that falls into the House of Water (next page) is sent back to.',
      'Square 26, the House of Happiness, is a safe house too. A piece must land there exactly on its way past - a throw that would carry it from anywhere before square 26 to somewhere beyond square 26 is not a legal move for that piece (though a different piece may still have one).',
      'Once a piece rests on the House of Happiness, a throw of 5 takes it off the board for good. Throws of 2, 3 or 4 move it on normally, to squares 28, 29 or 30. A throw of 1, though, carries it to square 27, the House of Water - so a piece on the House of Happiness is not safe from that hazard forever.',
    ],
  },
  {
    title: 'The House of Water',
    lines: [
      'Square 27, the House of Water, is a hazard, not a resting place - no piece is ever left standing there.',
      'A piece whose throw would land it exactly on square 27 is sent straight back instead: it is placed on square 15, the House of Rebirth, or, if that square is already occupied, on the nearest empty square below it, back toward square 1.',
    ],
  },
  {
    title: 'The last three squares',
    lines: [
      'Squares 28 and 29 are safe houses, like 15 and 26: a lone piece resting there cannot be swapped. Square 30 is not a safe house.',
      'Leaving the board from these last squares needs an exact throw: a piece on square 28 needs a 3, on square 29 a 2, and on square 30 a 1, to bear off. The board marks each of these three squares with that many dots.',
      'A smaller throw from one of these squares just moves the piece on normally within the board - for example, square 28 with a throw of 1 moves it to square 29. It only has to be exact for the move that finally takes a piece off the board.',
    ],
  },
  {
    title: 'Winning the game',
    lines: [
      'The goal is to bring all five of your pieces past square 30 and off the board before the other side does.',
      'The moment a side’s fifth piece bears off, the game ends immediately in that side’s favour.',
    ],
  },
  {
    title: 'No draws',
    lines: [
      'This game has no draws. Every ordinary game ends the instant one side bears off all five pieces, and play simply continues, throw after throw, until that happens.',
      'As a safety net only, if 1500 throws pass without either side finishing - something that should never happen in ordinary play - the game ends at once and the side with more pieces already off the board is declared the winner. If both sides have the same number off, player one, the cones, wins.',
    ],
  },
];

export const HOW = {
  title: 'How to play',
  parts: [
    ['Your goal', 'Bring all five of your pieces round the S-shaped path and off the board before the other side does.'],
    ['Throw the sticks', 'TAP the sticks (or press Space). Count the light faces: 1, 2, 3 or 4. No light face counts as 5. A throw of 1, 4 or 5 earns another throw.'],
    ['Move a piece', 'TAP a glowing piece, then TAP a glowing square. The piece moves exactly the number thrown, along the path: down, up, down. You must move if you can.'],
    ['Swap', 'Landing on a lone enemy piece swaps places: it goes back to where you started. Two enemy pieces side by side, or one on a safe house, cannot be swapped. Three in a row are a wall that nothing can pass.'],
    ['Special squares', 'Squares 15 (rosette), 26 (diamond), 28 and 29 are safe: a lone piece there cannot be swapped. Every piece must stop on 26. Square 27 is the House of Water: it sends a piece back to 15. Squares 28, 29 and 30 need an exact 3, 2 or 1 (the dots) to leave; from 26 a 5 leaves.'],
    ['Help', 'Hint shows a good move and why (3 per game). Take back undoes your last move. A refused move shakes and tells you why. Keyboard: arrows, Enter, Space, Escape.'],
  ],
};
