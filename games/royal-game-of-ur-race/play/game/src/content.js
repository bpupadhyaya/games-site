// The exhaustive in-app "Rules" reference. Every claim here describes exactly what THIS build's
// rules.js (the rule book) and engine.js implement -- verified line by line, not textbook/idealised
// Royal Game of Ur rules. See design/GDD.md for the ruleset choice (Finkel rules) and STATUS.md for
// the "no simplifications of substance" note this text follows.
// `art` picks what renders above the panel on that page: 'pieces' draws the real Shell/Jet counters
// (pieces.js drawPiece, the same function the board itself uses), 'dice' draws the real pyramid dice
// (pieces.js drawDie), 'rosette' draws the real rosette inlay (art.js rosette), 'capture' draws a
// Jet piece dimmed beside a Shell piece to show what a capture looks like, and 'emblem' (default)
// reuses the same decorative disc the About page already shows on every page.
export const RULES = [
  { title: 'The board', art: 'emblem',
    body: 'Twenty squares make up the board: a block of three lanes by four squares where each side keeps its own private start, a two-square bridge in the middle lane shared by both sides, and a further block of three lanes by two squares where each side finishes. The two outer lanes of each block belong to one side only; the middle lane is shared.' },
  { title: 'Setup and who moves first', art: 'emblem',
    body: 'Each side has seven pieces, all beginning off the board in a waiting stack beside its own start. Against the computer, who rolls first alternates by game: you go first in the first game, the third, the fifth, and so on, and the computer goes first in the second, the fourth, and so on. In two-player pass-the-phone, Player 1 (Shell) always rolls first.' },
  { title: 'The four dice', art: 'dice',
    body: 'Every roll uses four small pyramid dice together, thrown as one set. Each die shows only two results: its single marked corner is up, counting 1, or it is down, counting 0. Your roll is the sum of all four, so it is always a whole number from 0 to 4 -- never higher, never lower.' },
  { title: 'Roll odds, and passing', art: 'dice',
    body: 'Because four independent 50/50 dice are summed, the totals are not equally likely: 0 and 4 each come up 1 time in 16, 1 and 3 each come up 4 times in 16, and 2 -- the most common roll -- comes up 6 times in 16. A roll of 0 means no corner is up: the turn passes at once, with no piece able to move. A roll of 1-4 with no legal move for any piece passes the same way.' },
  { title: 'The pieces', art: 'pieces',
    body: "Both sides play one kind of piece: Shell for you (or Player 1), Jet for the computer (or Player 2), seven each. A piece moves forward only, exactly the number rolled, along its own fourteen-square path. Each turn is one move: bring a fresh piece on from your waiting stack, or move one already on the board. It can never land on its own piece's square." },
  { title: 'Rosette squares', art: 'rosette',
    body: 'Three squares carry a rosette: the last square of your entry lane, the centre square of the shared lane, and the last square before home. Landing exactly on any rosette earns an extra roll for the same side at once. The central rosette carries one more rule: while an enemy piece sits there, you cannot move onto that square at all -- the move is illegal, not merely risky.' },
  { title: 'Capturing', art: 'capture',
    body: "The eight-square shared lane is the only place the two paths cross, and the only place a capture can happen. Land exactly on an enemy piece there and it is sent back to its owner's waiting stack, to start again from nothing. The central rosette is the one exception: since no piece may move onto it while occupied, a piece resting there can never be captured." },
  { title: 'Bearing off', art: 'emblem',
    body: 'Leaving the board -- bearing a piece off from the end of its path into home -- needs the exact roll. A piece two squares from home only comes off on a roll of exactly 2; a bigger roll cannot overshoot, so that move is never offered. A smaller roll just moves it closer instead, if a legal square is free.' },
  { title: 'Winning', art: 'emblem',
    body: 'The game is won the instant a side bears all seven of its pieces off the board. There is no score beyond this -- only finishing every piece decides the game, and the win is immediate, even mid-turn during a run of rosette rerolls.' },
  { title: 'No draws', art: 'emblem',
    body: 'This build has no draw, tie, or stalemate of any kind. A roll of 0, or a roll with no legal move, only passes the turn -- it never ends the game. Play always continues until one side has borne off all seven pieces and won; the game cannot end any other way.' },
];
