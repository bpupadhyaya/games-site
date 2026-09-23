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
// Exhaustive rules reference (verified against web/src/rules.js, the authoritative rule book). Rulebook tone, not tutorial tone.
export const RULES = [
  { title: 'The papamū and stones', body: [
    'This version is played on a square board (a papamū) of your choice: 6x6, 8x8 or 10x10 points, picked on the New game screen before a match starts.',
    'At the start every point is filled in a strict checkerboard pattern: the point at column x, row y holds a Black stone if x+y is even, and a White stone if x+y is odd. No point is empty until the opening removal below.'] },
  { title: 'The opening removal', body: [
    'Black moves first, and that first move is not a jump: Black removes one of Black\'s own stones. Exactly four starting points are offered, whatever the board size — the two central points and two of the four corners (the top-left and the bottom-right) — no other point can be chosen to open with.',
    'White then removes one White stone that touches the new empty point orthogonally (up, down, left or right, whichever exist on the board): two choices after a corner opening, up to four after a centre opening.',
    'From here on Black jumps first, and every later turn is a jump.'] },
  { title: 'The stone', stones: true, body: [
    'Konane has only one kind of piece: a flat stone, black or white. It never changes what it can do — there is no promotion, no ranking, no special stone.',
    'A stone\'s only legal action is to jump: it captures by hopping in a straight line over one adjacent enemy stone and landing on the empty point immediately beyond it. A stone that has no jump available simply cannot move at all — it cannot slide to an empty point any other way.'] },
  { title: 'How a jump works', body: [
    'A jump travels in a straight line along a row or a column only — this build never allows a diagonal jump.',
    'To jump, there must be an enemy stone on the very next point in that direction, and the point immediately beyond that enemy stone must be empty. The stone hops over the enemy stone onto that empty point, and the enemy stone is removed from the board at once.',
    'Any of the four directions — up, down, left or right — is equally legal each time you jump; there is no "forward only" restriction.'] },
  { title: 'Chaining jumps', demo: { cells: ['W', 'B', '.', 'B', '.'], hop: [0, [1, 3], 4] }, body: [
    'After landing, the same stone may continue jumping again in the SAME straight-line direction, over the next enemy stone and into the next empty point beyond it, as many times in a row as the board allows.',
    'You choose, after every hop, whether to keep going or to stop; stopping after any hop is always allowed, and each different stopping point counts as a separate move you may pick.',
    'A chain cannot change direction partway through. Once a jump starts moving, say, to the right, every further hop that same turn must keep moving to the right. Turning a corner takes a whole new turn.'] },
  { title: 'You must jump', body: [
    'Jumping is mandatory whenever it is possible. Once the opening removals are done, the only legal moves the game will ever offer are jumps: there is no way to pass, and no way to move a stone without capturing one.',
    'If, on your turn, none of your stones has a legal jump, you have no legal move at all, and the game ends immediately — you lose.'] },
  { title: 'Winning', body: [
    'The game is won the instant a player, on their turn, cannot make a single legal jump. That player loses; the opponent who forced that position wins.',
    'There is no other way to win, and no way to resign or offer a draw. The only route to victory is leaving your opponent with no jump left.'] },
  { title: 'No draws', body: [
    'This build has no drawn or tied games. Every legal turn removes at least one stone from the board, so the stone count only ever shrinks and the game is always guaranteed to end, with exactly one side unable to jump.',
    'When a game ends, the reason shown says plainly which side ran out of jumps, for example "Black has no jump left."'] },
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
