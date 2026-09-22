// Text pages: how to play, controls, and a short heritage note. Facts only; rules are the ones this game uses.
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
};
