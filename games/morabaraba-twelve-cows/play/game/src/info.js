// Text pages: how to play, controls, a short heritage note, and an exhaustive rules reference.
// Facts only; every claim in `rules` is cross-checked against the real rule book (millfamily.js +
// morabaraba.js), never idealized/textbook Morabaraba or Nine Men's Morris rules.
export const PAGES = {
  howto: [
    { title: 'The board', lines: [
      'Three squares sit one inside another. Their 24 corners and midpoints are the points where cows stand.',
      'Lines join the points around each square, four lines join the middles of the squares, and four DIAGONAL lines join the corners.',
      'Each player has twelve cows. Dark goes first.'] },
    { title: 'Placing and mills', lines: [
      'First, players take turns placing one cow each on any empty point until all twelve cows of both sides are down.',
      'Three of your cows in one line make a MILL. Close a mill and you SHOOT one cow of the other side: it leaves the board.',
      'A cow standing in a mill is protected, unless every cow of that side is in a mill. One move shoots at most one cow.'] },
    { title: 'Sliding and flying', lines: [
      'Then cows slide one step along a line to an empty point, diagonals included.',
      'Open a mill by sliding a cow out and close it again to shoot again.',
      'A player with exactly three cows left may FLY: a cow moves to any empty point.'] },
    { title: 'Winning and draws', lines: [
      'You win when the other side has fewer than three cows, or when it is its turn and none of its cows can move.',
      'A draw: the board is full after placing with no shot, the same position comes up three times, or 40 moves pass without a shot.',
      'Rules differ from place to place. This game shoots while placing, one cow per move, and flies at three.'] },
    { title: 'Controls', lines: [
      'PLACING: TAP an empty point.',
      'SLIDING: TAP a cow (its legal points glow), then TAP a glowing point. Or DRAG the cow and drop it on a point.',
      'SHOOTING: after a mill, TAP a glowing cow.',
      'A refused move tries, comes back, and a message says why. Take back undoes your last move; Hint shows a good move and why.',
      'Keyboard: arrow keys move the cursor, Space or Enter is a TAP, U takes back, H hints, Escape is Menu.'] },
  ],
  about: [
    { title: 'About Morabaraba', lines: [
      'Morabaraba (also called Umlabalaba) is a traditional two-player board game of Southern Africa, played in places including Lesotho, South Africa, Botswana and Zimbabwe.',
      'Each player has twelve pieces, called cows. The board is three squares one inside another, joined by lines across the middles and by diagonals across the corners.',
      'A board can be scratched into the ground or made of wood, and stones or other small objects can serve as cows.'] },
    { title: 'A family of games', lines: [
      'Morabaraba belongs to the family of mill games, which includes Nine Men\'s Morris. The diagonals and the extra cows make it quick and tactical.',
      'Local rules vary. This version shoots while placing, one cow per move, and lets a player with three cows fly.',
      'The board and the cows are painted for this game. The bands around the board are decoration only.'] },
  ],
  // Exhaustive rules reference (added for the in-app Rules page). Every claim here is cross-checked
  // against millfamily.js + morabaraba.js, the actual move/mill/win logic, not idealized rules.
  rules: [
    { title: 'The board and setup', lines: [
      'Three squares sit one inside another: outer, middle and inner. Their corners and midpoints are the 24 points where cows stand.',
      'Each square is a ring of eight points joined around its own edge. Four SPOKES also join the midpoints of the three rings, and four DIAGONALS join the corners of the three rings.'] },
    { title: 'Mills, and the setup', lines: [
      'A MILL is three cows of the same side standing on one straight line. There are 20 such lines in total: 12 ring sides, 4 spokes and 4 diagonals.',
      'Each player starts with twelve cows in hand and none on the board. Dark places the first cow.'] },
    { title: 'The cow', cows: true, lines: [
      'Morabaraba has only one kind of piece: the cow. Dark and Light each herd twelve identical cows — no cow is stronger than another.',
      'PLACING (while any cows remain in your hand): TAP an empty point to place one there.'] },
    { title: 'The cow: moving and flying', lines: [
      'MOVING (once your hand is empty): slide one cow one step to an adjacent empty point, along a ring side, a spoke or a diagonal.',
      'FLYING: the instant you are down to exactly three cows in total with none left in hand, that cow may move to ANY empty point on the board — adjacency no longer matters.'] },
    { title: 'Mills and shooting', lines: [
      'Closing a mill — by placing a cow, or by sliding or flying one into place — lets you SHOOT: remove one of the other side\'s cows from the board at once.',
      'A cow standing inside a currently formed mill is protected and cannot be shot, UNLESS every one of that side\'s cows on the board is inside a mill — then any of them, mill or not, becomes shootable.'] },
    { title: 'Shooting: one at a time, and swinging', lines: [
      'One move that closes two mills at the same time still shoots only ONE cow, never two. You choose which eligible cow to remove.',
      'Swinging a mill open and shut works exactly as it sounds: sliding a cow out breaks the mill, and sliding it back in closes it again and lets you shoot again — as many times as you can repeat the swing.'] },
    { title: 'Winning the game', lines: [
      'You win the instant the other side is left with fewer than three cows in total (hand plus board) — usually the moment your shot brings them down to two.',
      'You also win if, on the other side\'s turn, none of their cows can move at all. A flying side (already down to three cows) can never be blocked this way, as long as at least one point on the board is empty.'] },
    { title: 'Draws', lines: [
      'If the board fills completely right after the very last cow is placed — all 24 points taken, both hands empty, and nobody able to slide — the game is drawn at once.',
      'From then on (once both hands are empty): the same position, with the same side to move, occurring three times draws the game.',
      'Also from then on: 40 moves (plies) passing in a row without either side landing a shot draws the game.'] },
  ],
};
