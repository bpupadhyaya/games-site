// Text pages: How to play and controls, and About Konane (verified facts only; museum-label tone).
export const HELP_PAGES = [
  { title: 'The goal', demo: { cells: ['B', 'W', '.', 'W', '.'], hop: [0, [1, 3], 4] },
    body: ['Black and white stones fill the slab. Each turn you JUMP one of your stones over a touching enemy stone into the empty square right behind it. The stone you jumped is removed.',
      'You may keep hopping in the same straight line, and you may stop after any hop. You cannot turn a corner in one move.',
      'You must jump if you can. The first player who has no jump left LOSES. There are no draws.'] },
  { title: 'Controls', body: [
    'TAP a stone of yours to pick it up. Its landing squares glow. Gold rings mean a single hop; an orange x2 or x3 means a longer jump.',
    'TAP a glowing square to jump there. TAP the same stone again to put it down.',
    'If you tap a square that is not allowed, the stone tries, comes back, and the message tells you why.',
    'TAP Take back to undo your last move (and the reply). TAP Hint for a suggestion with its reason. TAP Menu to leave; an unfinished game is saved.',
    'Keyboard: ARROW keys move the green cursor, SPACE or ENTER is a tap, ESCAPE is Menu, U is Take back, H is Hint.'] },
  { title: 'The opening', body: [
    'Black starts by removing one black stone from a corner or from the middle of the slab. White then removes a white stone that touches that empty square. After that Black makes the first jump.',
    'On the title screen, TAP Learn to play for eight short hands-on lessons, or Daily puzzle for a new position every day where exactly one first jump wins by force.'] },
  { title: 'Thinking ahead', body: [
    'Count jumps. Each turn, look at how many jumps you would have and how many your opponent would have after your move. Leaving them with few or none is how games are won.',
    'Sometimes stopping early is a mistake and sometimes going further is. Try both before you decide.',
    'Hints show the computer\'s best idea and the jump counts after it, so you can learn why.'] },
];
export const ABOUT = [
  { title: 'A game of Hawaii', body: [
    'Konane (written konane or with a macron, kōnane) is a traditional strategy game of Hawaii for two players.',
    'It is played on a rectangular grid with black and white pieces. The playing board is called the papamū. Each move is a jump that removes the piece jumped, and the player who cannot jump loses.'] },
  { title: 'Stone and coral', body: [
    'The game is traditionally described as played on a large carved rock that served as both board and table, with black lava (basalt) pieces and white coral pieces.',
    'The slab, stones and border in this game are drawn to suggest those materials. The geometric border is inspired by Hawaiian tapa cloth patterns and is decoration only.'] },
  { title: 'Boards and records', body: [
    'Boards were made in many sizes. Square boards from 6x6 up to 14x14 are described, as well as rectangles such as 8x9 and 14x17.',
    'Konane appears in written accounts from the voyages of Captain James Cook, who reached the Hawaiian Islands in 1778 and 1779. This game offers 6x6, 8x8 and 10x10 boards.'] },
  { title: 'This version', body: [
    'The opening follows the traditional description: Black removes a stone from the middle or a corner, White removes a neighbouring stone, and then the jumping begins.',
    'Everything else here, the lessons, the computer players and the daily puzzle, was made for this game.'] },
];
