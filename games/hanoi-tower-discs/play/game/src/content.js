// All player-facing text (English). Rule numbers are computed by the solver, not typed in, so the Rules pages
// cannot drift from the engine.
import { movesLeft, classicMoves } from './solver.js';

export const STR = {
  playBtn: 'Play', dailyBtn: 'Daily Challenge', autoBtn: 'Watch & Learn', howtoBtn: 'How to Play', rulesBtn: 'Rules', aboutBtn: 'About',
  settingsBtn: 'Settings', back: 'Back', levels: 'Levels', next: 'Next', prev: 'Previous', nextLevel: 'Next Level', replay: 'Play Again',
  think: 'Think', undo: 'Undo', restart: 'Restart', resume: 'Resume', paused: 'Paused', restartLevel: 'Restart Level', quitMenu: 'Main Menu',
  solved: 'Solved!', locked: 'Solve 3 levels in the previous chapter to open this one.', stars: 'Stars', solvedCount: 'Solved',
  soundOn: 'Sound: On', soundOff: 'Sound: Off', numbersOn: 'Disc numbers: On', numbersOff: 'Disc numbers: Off', thinkTime: 'Watch & Learn think time',
  seconds: 's', restore: 'Restore Purchases', unlock: 'Unlock Full Game', resetProgress: 'Erase All Progress',
  resetConfirm: 'Tap again to erase all progress', owned: 'Full game unlocked. Thank you!', dailyDone: 'Daily Challenge solved!',
  dailyStreak: 'Daily streak', dailyTitle: 'Daily Challenge', dailyLocked: 'The Daily Challenge is in the full game.',
  autoThink: 'Thinking', autoReveal: 'The next move', autoAct: 'Moving', autoDone: 'Tower complete', autoPause: 'Pause', autoPlay: 'Resume',
  autoExit: 'Exit', autoSlower: 'Think -', autoFaster: 'Think +', autoSession: 'Watch & Learn', autoAgain: 'Watch Again',
  autoSummary: 'You watched three towers solved with the fewest possible moves, one step at a time.',
  demoLimitTitle: 'FREE PREVIEW FINISHED', demoLimitBody: 'You solved the three free towers. Get the full game on iPhone and Android for every chapter, the Scrambles and the Daily Challenge.',
  demoLeft: '{n} free towers left', tagline: 'Move the tower. Find the pattern.', best: 'Best', moves: 'Moves', minimum: 'Minimum',
  tipTap: 'Tap a peg to lift its top disc', tipTap2: 'Now tap the peg where it should go', refused: 'A larger disc cannot rest on a smaller one',
  nothingUndo: 'Nothing to undo', stars3: 'Perfect: the fewest possible moves.', stars2: 'Great: within one and a half times the minimum.',
  stars1: 'Solved. Fewer moves earn more stars.', goalWord: 'Goal',
};
export const tr = (key, vars) => {
  let s = STR[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace(`{${k}}`, vars[k]);
  return s;
};

const classicList = Array.from({ length: 10 }, (_, i) => classicMoves(i + 1)).join(', ');
const fourList = Array.from({ length: 8 }, (_, i) => movesLeft(new Array(i + 1).fill(0), 4, 3)).join(', ');

export const HOWTO = [
  { title: 'The goal', art: 'goal', body: 'Move the whole tower of discs from the first peg (A) to the gold peg, one disc at a time. Fewer moves earn more stars.' },
  { title: 'Moving a disc', art: 'move', body: 'Tap a peg to lift its top disc, then tap the peg where it should go. Or drag the disc over a peg and let go. Tap the same peg again to put it back.' },
  { title: 'The one rule', art: 'rule', body: 'A larger disc may never rest on a smaller one. A disc can go onto an empty peg or onto any larger disc. A move that breaks the rule is refused and does not count.' },
  { title: 'Think and Undo', art: 'think', body: 'Think shows the best next move from wherever you are now, even after a mistake. Undo takes the last move back. Restart sets the level up again.' },
  { title: 'Stars', art: 'stars', body: 'Three stars for the fewest possible moves, two stars for at most one and a half times that, one star for any solution. Every level shows its minimum.' },
  { title: 'Watch and learn', art: 'auto', body: 'From the menu, Watch & Learn plays whole towers for you with the best moves, with time to think before each one and a Pause button. It is a good way to see the pattern.' },
];

export const RULES = [
  { title: 'The goal', art: 'goal', body: [
    'A base holds three pegs labelled A, B and C (four in the Four Pegs chapter: A, B, C and D). A tower of discs stands on peg A, the largest disc at the bottom and the smallest on top.',
    'Move the whole tower onto the gold peg. In the Classic chapter that is peg C, in Four Pegs it is peg D, and in the Scrambles and the Daily Challenge the gold peg can be any peg.',
  ] },
  { title: 'The one rule', art: 'rule', body: [
    'Only the top disc of a peg can be moved, and only one disc at a time.',
    'A disc may be placed on an empty peg, or on top of a larger disc. It may never be placed on a smaller disc.',
    'Nothing else is forbidden: discs may go to any peg in any order, and you may move the same disc many times. A move that breaks the rule is refused: the peg flashes red, the disc goes back, and the move does not count.',
  ] },
  { title: 'Making a move', art: 'move', body: [
    'Tap a peg (anywhere in its column, down to its base): its top disc lifts. Tap another peg: the disc slides over and drops onto it. Tapping the same peg puts the disc back down.',
    'Or press on a peg and drag: the disc follows your finger, the peg under it glows green if the drop is allowed and red if not, and it lands when you let go.',
    'The move counter goes up by one for each disc that lands on a different peg. On a keyboard, press 1, 2, 3 (and 4) to pick pegs, U for Undo, T for Think, R for Restart and Escape or P to pause.',
  ] },
  { title: 'Numbers on the discs', art: 'numbers', body: [
    'Discs are numbered from 1, the smallest, upward, and each is wider than the one before. The numbers let you talk about moves: "move disc 2 from A to C". They can be switched off in Settings.',
    'On every peg the discs are always in order, the largest at the bottom. That is why any way of spreading discs over the pegs is a legal position.',
  ] },
  { title: 'The fewest moves', art: 'table', body: [
    `A tower of n discs on three pegs needs at least 2^n - 1 moves. For 1 to 10 discs that is ${classicList}.`,
    'The minimum shown in each level is worked out exactly by the game\'s solver, which searches every position. In the Classic chapter it equals 2^n - 1. In every other level it is the exact distance from the starting position to the goal, so a perfect run always exists.',
  ] },
  { title: 'The big idea: recursion', art: 'recur1', body: [
    'To move a tower of n discs from A to C: first move the n - 1 discs above the largest onto the spare peg B. Then move the largest disc to C. Then move the n - 1 discs from B onto C.',
    'The first and third steps are the same puzzle again with a smaller tower, using different pegs as start, goal and spare. That is recursion. A tower of one disc is simply one move.',
  ] },
  { title: 'Why 2^n - 1', art: 'recur2', body: [
    'Let M(n) be the fewest moves for n discs. A tower of one disc takes 1 move. A bigger tower takes M(n - 1) moves to clear the way, one move for the largest disc, and M(n - 1) more to rebuild on top of it: M(n) = 2 x M(n - 1) + 1.',
    `That gives ${classicList}: every extra disc doubles the work and adds one move. Watch & Learn names the disc it is freeing, so you can follow the recursion as it plays.`,
  ] },
  { title: 'The rhythm of disc 1', art: 'rhythm', body: [
    'In a perfect solution on three pegs, every second move is the smallest disc, and it always travels around the pegs in the same direction. With an odd number of discs, moving from A to C, disc 1 goes A, C, B, A, C, B and so on. With an even number it goes A, B, C, A, B, C.',
    'The other moves are forced: after moving disc 1, exactly one legal move does not involve disc 1, and it is the right one. Try it with three discs.',
  ] },
  { title: 'Four pegs', art: 'four', body: [
    `The Four Pegs chapter adds a spare peg, and towers move much faster. The exact minimum for 1 to 8 discs is ${fourList}. These are exact: the solver searched every position.`,
    'There is no single obvious pattern here, and several different move orders can be perfect. Think always offers one best move.',
  ] },
  { title: 'Scrambles', art: 'scramble', body: [
    'In a Scramble the discs start spread over the pegs and you gather them all on the gold peg. Any spread is a legal position, because every peg stays in size order.',
    'The minimum is the exact distance from that starting position. The best first move is often not disc 1, and a position is never stuck: from anywhere there is a way to the goal.',
  ] },
  { title: 'Stars', art: 'stars', body: [
    'Three stars: solved in exactly the minimum number of moves. Two stars: at most one and a half times the minimum, rounded up. One star: solved at all.',
    'Undo takes a move back and lowers the counter by one, and Restart sets it to zero. Think never changes your stars. The best stars for each level are kept.',
  ] },
  { title: 'Think', art: 'think', body: [
    'Think asks the solver for the best next move from the position on the screen. It lights the disc to move and draws an arc to the peg it should go to, and the message names the move.',
    'It works from any position, including after a mistake. It does not make the move for you, and it is free to use as often as you like.',
  ] },
  { title: 'Undo and Restart', art: 'undo', body: [
    'Undo takes back the last move, one move at a time, as far as the start. Restart puts the discs back to the starting position of the level.',
    'Your place in a level is saved: leave and come back later and the discs are as you left them.',
  ] },
  { title: 'Watch & Learn', art: 'auto', body: [
    'Watch & Learn plays three towers for you: three discs, four discs, and four discs on four pegs. Each move has three steps: THINK (2, 5, 8 or 10 seconds, you choose), REVEAL (two seconds: the disc to move and the pegs it may go to light up) and ACT (the move happens).',
    'Pause freezes everything where it is and Resume carries on from exactly there. The moves are the solver\'s best moves, so every tower is solved in the fewest possible moves. Watch & Learn does not use up the free preview.',
  ] },
  { title: 'Daily Challenge', art: 'daily', body: [
    'Each day brings one new scrambled position, the same for everyone: three or four pegs and four to seven discs, worked out from the date. Solve it for stars and to extend your daily streak.',
    'The streak counts consecutive days. Missing a day starts a new streak.',
  ] },
  { title: 'Chapters and unlocking', art: 'chapters', body: [
    'The Classic Tower opens first. Solve three Classic levels to open Four Pegs, and three Four Pegs levels to open the Scrambles. Inside a chapter every level is open.',
    'The game starts with a free preview of the first 90 seconds of play; the full game is a single one-time unlock and works offline.',
  ] },
  { title: 'How a level ends', art: 'win', body: [
    'A level ends when every disc is on the gold peg. There is no losing: no timer, no move limit and no way to get stuck, because every position can still be solved.',
    'The result card shows your moves against the minimum and your stars, and the next level is one tap away.',
  ] },
];

export const ABOUT = [
  { title: 'Tower of Hanoi', body: 'A calm classic: move a tower of lit, lacquered discs from one carved peg to another, one disc at a time, never placing a larger disc on a smaller one.' },
  { title: 'Where it comes from', body: 'The puzzle was published in 1883 by the French mathematician Édouard Lucas as La Tour d\'Hanoï, named for Hanoi, the capital of Vietnam (Tháp Hà Nội in Vietnamese). Since then it has been a favourite of puzzle lovers and mathematics teachers, and a standard first example when people learn about recursion.' },
  { title: 'In this game', body: 'Twenty-six levels in three chapters, from three discs to ten, with an optional fourth peg and scrambled starts, plus a Daily Challenge. Every minimum comes from a real solver. Think shows the best next move, Watch & Learn plays whole towers, a full illustrated Rules guide explains the recursion, and text scales up to 300 percent. No timers, works offline.' },
];
export const RULE_COUNT = RULES.length;
export const HOWTO_COUNT = HOWTO.length;
