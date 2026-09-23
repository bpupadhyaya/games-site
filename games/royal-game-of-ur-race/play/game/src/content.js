// The exhaustive in-app "Rules" reference. Every claim here describes exactly what THIS build's
// rules.js (the rule book) and engine.js implement -- verified line by line, not textbook/idealised
// Royal Game of Ur rules. See design/GDD.md for the ruleset choice (Finkel rules) and STATUS.md for
// the "no simplifications of substance" note this text follows.
// `art` picks what renders above the panel on that page: 'pieces' draws the real Shell/Jet counters
// (pieces.js drawPiece, the same function the board itself uses), 'dice' draws the real pyramid dice
// (pieces.js drawDie), 'rosette' draws the real rosette inlay (art.js rosette), 'capture' draws a
// Jet piece dimmed beside a Shell piece to show what a capture looks like, and 'emblem' (default)
// reuses the same decorative disc the About page already shows on every page.
//
// Each page holds ONE complete, short sentence -- never a mid-sentence fragment. A concept that
// needs more than one sentence repeats its own title across consecutive pages (the "Page X of Y"
// footer plus the same heading is the continuation cue, the same convention every other game in
// this family uses), rather than the earlier "(cont. N)" title suffix this page used to carry.
// At the 300% text-size step even a short sentence can only wrap a few times before the panel runs
// out of room (see the panel/column sizing in view.js), so each sentence here is kept genuinely
// short; every one was measured against the real wrapped line count at the top text-size step, not
// eyeballed, before landing here.
export const RULES = [
  { title: 'The board', art: 'emblem', body: 'The board has twenty squares in all.' },
  { title: 'The board', art: 'emblem', body: 'One block is three lanes by four squares: your own private start.' },
  { title: 'The board', art: 'emblem', body: 'A two-square bridge sits in the middle lane, shared by both sides.' },
  { title: 'The board', art: 'emblem', body: 'A second block, three lanes by two squares, is where you finish.' },
  { title: 'Shared and private lanes', art: 'emblem', body: 'Each block\'s two outer lanes belong to one side only.' },
  { title: 'Shared and private lanes', art: 'emblem', body: 'The middle lane is shared by both sides.' },
  { title: 'Setup and who moves first', art: 'emblem', body: 'Each side has seven pieces, all waiting off the board at the start.' },
  { title: 'Setup and who moves first', art: 'emblem', body: 'Against the computer, who rolls first alternates every game.' },
  { title: 'Setup and who moves first', art: 'emblem', body: 'You go first in games one, three, five, and so on.' },
  { title: 'Setup and who moves first', art: 'emblem', body: 'The computer goes first in games two, four, six, and so on.' },
  { title: 'Who moves first: two players', art: 'emblem', body: 'With two players sharing one phone, Player 1 (Shell) always rolls first.' },
  { title: 'The four dice', art: 'dice', body: 'Every roll uses four small pyramid dice, thrown together as one set.' },
  { title: 'The four dice', art: 'dice', body: 'Each die shows only two results: its one marked corner up, or down.' },
  { title: 'The four dice', art: 'dice', body: 'Up counts 1; down counts 0.' },
  { title: 'The four dice', art: 'dice', body: 'Your roll is the sum of all four dice.' },
  { title: 'The four dice', art: 'dice', body: 'That is always a whole number from 0 to 4 - never higher, never lower.' },
  { title: 'Roll odds', art: 'dice', body: 'The four dice are independent coins, so the totals are not equally likely.' },
  { title: 'Roll odds', art: 'dice', body: '0 and 4 each come up 1 time in 16.' },
  { title: 'Roll odds', art: 'dice', body: '1 and 3 each come up 4 times in 16.' },
  { title: 'Roll odds', art: 'dice', body: '2, the most common roll, comes up 6 times in 16.' },
  { title: 'Passing: a 0, or no legal move', art: 'dice', body: 'A roll of 0 means no corner is up: your turn passes at once.' },
  { title: 'Passing: a 0, or no legal move', art: 'dice', body: 'A roll of 1-4 also passes if no piece has a legal move.' },
  { title: 'The pieces', art: 'pieces', body: 'Both sides play one kind of piece.' },
  { title: 'The pieces', art: 'pieces', body: 'Shell is yours (or Player 1\'s); Jet is the computer\'s (or Player 2\'s) - seven each.' },
  { title: 'The pieces', art: 'pieces', body: 'A piece moves forward only, exactly the number rolled.' },
  { title: 'The pieces', art: 'pieces', body: 'Its path is fourteen squares long.' },
  { title: 'One move per turn', art: 'pieces', body: 'Each turn is one move: bring on a fresh piece, or move one already on the board.' },
  { title: 'One move per turn', art: 'pieces', body: 'A piece can never land on its own side\'s piece.' },
  { title: 'Rosette squares', art: 'rosette', body: 'Three squares carry a rosette.' },
  { title: 'Rosette squares', art: 'rosette', body: 'One is the last square of your entry lane.' },
  { title: 'Rosette squares', art: 'rosette', body: 'One is the centre square of the shared lane.' },
  { title: 'Rosette squares', art: 'rosette', body: 'One is the last square before home.' },
  { title: 'Rosette squares', art: 'rosette', body: 'Landing exactly on a rosette earns that side an extra roll at once.' },
  { title: 'The central rosette', art: 'rosette', body: 'The central rosette carries one more rule.' },
  { title: 'The central rosette', art: 'rosette', body: 'While an enemy piece sits there, you cannot move onto that square at all.' },
  { title: 'The central rosette', art: 'rosette', body: 'That move is illegal, not merely risky.' },
  { title: 'Capturing', art: 'capture', body: 'The eight-square shared lane is the only place the two paths cross.' },
  { title: 'Capturing', art: 'capture', body: 'It is the only place a capture can happen.' },
  { title: 'Capturing', art: 'capture', body: 'Land exactly on an enemy piece there and it is captured.' },
  { title: 'Capturing', art: 'capture', body: 'A captured piece returns to its owner\'s waiting stack, to start again from nothing.' },
  { title: 'Capturing: the one exception', art: 'capture', body: 'The central rosette is the one exception to capturing.' },
  { title: 'Capturing: the one exception', art: 'capture', body: 'No piece may move onto it while it is occupied.' },
  { title: 'Capturing: the one exception', art: 'capture', body: 'So a piece resting there can never be captured.' },
  { title: 'Bearing off', art: 'emblem', body: 'Leaving the board - bearing a piece off into home - needs the exact roll.' },
  { title: 'Bearing off', art: 'emblem', body: 'A piece two squares from home only comes off on a roll of exactly 2.' },
  { title: 'Bearing off', art: 'emblem', body: 'A bigger roll cannot overshoot, so that move is never offered.' },
  { title: 'Bearing off', art: 'emblem', body: 'A smaller roll just moves the piece closer, if a legal square is free.' },
  { title: 'Winning', art: 'emblem', body: 'The game is won the instant a side bears all seven pieces off the board.' },
  { title: 'Winning', art: 'emblem', body: 'There is no score beyond this: finishing every piece decides the game.' },
  { title: 'Winning', art: 'emblem', body: 'The win is immediate, even mid-turn during a run of rosette rerolls.' },
  { title: 'No draws', art: 'emblem', body: 'This build has no draw, tie, or stalemate of any kind.' },
  { title: 'No draws', art: 'emblem', body: 'A roll of 0, or a roll with no legal move, only passes the turn.' },
  { title: 'No draws', art: 'emblem', body: 'Play always continues until one side has borne off all seven pieces and won.' },
  { title: 'No draws', art: 'emblem', body: 'The game cannot end any other way.' },
];
