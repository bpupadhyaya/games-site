// Text and diagrams: the Rules reference, How to Play, About, and the lessons. Every rule statement here is cross-checked against rules.js
// (the single source of truth for legality and counting). Items: { k: 'h' | 'p' | 'd', t / spec }. A diagram spec lists the rings left to right
// as ring 1, ring 2, ... : bits[0] is ring 1 (nearest the free end, on the RIGHT), 1 = on the bar, 0 = off.
import { parAll, MIN_RINGS, MAX_RINGS } from './rules.js';
const D = (bits, extra = {}) => ({ k: 'd', spec: { bits, ...extra } });
const H = (t) => ({ k: 'h', t });
const P = (t) => ({ k: 'p', t });
const par = (n) => parAll(n);
const TABLE = Array.from({ length: MAX_RINGS - MIN_RINGS + 1 }, (_, i) => `${i + MIN_RINGS} rings: ${par(i + MIN_RINGS)} moves`).join('. ');

export const RULES = [
  { title: 'The puzzle and the bar', items: [
    P('The Chinese rings is one of the oldest mechanical puzzles in the world, known in China for many centuries and in Europe as the baguenaudier. A long steel bar ends in a loop at one side and a handle at the other. Rings are threaded on the bar, each held by its own wire standing on the base.'),
    P('At the start of a Classic puzzle every ring is on the bar. Your task is to take all of them off. It sounds easy. It is not: a ring can only move when the rings next to it are in exactly the right place, so you must take some rings off and put them back again, many times, in the right order.'),
    D([1, 1, 1, 1, 1], { glow: [] }),
    P('The free end of the bar, the loop, is on the right. The handle is on the left. Rings slide on and off over the free end.'),
  ] },
  { title: 'The rings', items: [
    P('The rings are numbered from the free end. Ring 1 is the ring nearest the free end (on the right), ring 2 is the next one to its left, and so on up to the last ring next to the handle. The number is engraved on a small brass plate on the base.'),
    P('A ring is either ON the bar, with the bar passing through it, or OFF the bar, hanging lower on its wire. A move changes exactly one ring: one ring goes on, or one ring comes off. You cannot move two rings in one move.'),
    D([1, 0, 1, 0, 1], { marks: [] }),
    P('In this picture rings 1, 3 and 5 are on the bar and rings 2 and 4 are off it. Tap a ring to move it, if the rule allows it.'),
  ] },
  { title: 'The one rule', items: [
    P('There is only one rule, and it decides everything. Ring 1 may always move. Any other ring may move only when the ring right next to it on the free-end side (the ring with the number one smaller) is ON the bar, and every ring beyond that one, all the way to the free end, is OFF the bar.'),
    P('Put another way: ring 4 may move only if ring 3 is on and rings 1 and 2 are off. Ring 6 may move only if ring 5 is on and rings 1, 2, 3 and 4 are all off.'),
    D([0, 0, 1, 1, 0], { glow: [3], marks: [] }),
    P('Here ring 3 is on, rings 1 and 2 are off, so ring 4 is free to move (it glows). Ring 1 is free too, since ring 1 may always move.'),
    P('If you tap a ring that may not move, it shivers and a message tells you which ring is in the way. Nothing is lost: the move is simply not made.'),
  ] },
  { title: 'Ring 1: always free', items: [
    P('Ring 1 is the only ring with no condition. Whatever the other rings are doing, you can take ring 1 off if it is on, or put it back if it is off.'),
    D([1, 0, 1, 1], { glow: [0] }),
    P('In every long solution, every second move is ring 1. If you are ever unsure what to do, moving ring 1 never breaks the rule, but it may undo your progress, so keep your plan in mind.'),
  ] },
  { title: 'Ring 2: follows ring 1', items: [
    P('Ring 2 may move only when ring 1 is ON the bar (there are no rings between them to worry about).'),
    D([1, 1, 1, 1], { glow: [1, 0] }),
    P('Here ring 1 is on, so ring 2 can move. If ring 1 were off, ring 2 would be stuck until you put ring 1 back.'),
    D([0, 1, 1, 1], { glow: [0] }),
  ] },
  { title: 'Ring 3 and beyond: the gate', items: [
    P('From ring 3 upward the rule has two parts. The ring next to it must be on, and every smaller ring must be off. The smaller rings are a gate that must be open (all off) before the next ring can pass.'),
    D([0, 1, 1, 1], { glow: [2, 0] }),
    P('Ring 2 is on and ring 1 is off, so ring 3 can move now. With ring 1 on instead, ring 3 would be blocked.'),
    D([1, 1, 1, 1], { glow: [1, 0] }),
    P('When the highest ring you need to free is blocked, the answer is always to work on the smaller rings first: open the gate, move the big ring, then come back for the small ones.'),
  ] },
  { title: 'Taking them all off: the rhythm', items: [
    P('Solving the puzzle is a rhythm more than a calculation. Every second move is ring 1. In between, one other ring moves, and which ring it is follows a fixed pattern that repeats like a heartbeat.'),
    P('For four rings from the start the whole solution is, by ring number: 2, 1, 4, 1, 2, 1, 3, 1, 2, 1. That is 10 moves. Notice that every other move is a 1.'),
    P('To free the highest ring you must first prepare the smaller rings so that the next ring is on and all smaller ones are off. After the highest ring is off, you must then put the smaller rings in order again to take the next one off, and so on. The puzzle is a recursion: freeing n rings means freeing n-2 rings, moving ring n, putting n-2 back, and freeing n-1.'),
  ] },
  { title: 'Counting the moves', items: [
    P('The puzzle has a mathematical structure (it is the reflected Gray code), so the fewest moves left from ANY position can be counted exactly. The game shows it on the To go counter: it is the length of the shortest way to finish from where you are.'),
    P(`Starting with all rings on, the fewest moves for each size are: ${TABLE}.`),
    P('Every legal move changes the To go counter by exactly one, up or down. A move that raises it took you away from the finish, sometimes on purpose.'),
    P('Your result is rated against the fewest moves from where you started: finish in exactly the fewest moves for three stars, within one and a half times that for two stars, and anything else for one star. Hints, Auto Play and Undo never cost anything; Undo gives the move back and removes it from your count.'),
  ] },
  { title: 'Modes and ring counts', items: [
    P('Classic starts with every ring on the bar. Scramble starts from a random legal position at least some way from the finish, so every puzzle is different. In both you win by taking every ring off the bar.'),
    P('Choose three to nine rings on the menu or in Settings. Three rings take five moves; nine rings take 341 moves from the start.'),
    P('Your game is saved when you leave. Restart returns to the position the puzzle began from.'),
  ] },
  { title: 'Help', items: [
    P('Hint shows the next move of a shortest solution: the ring glows and a sentence says why. Take as many hints as you like.'),
    P('Auto Play (Watch and Learn) solves a puzzle by itself. For every move it first thinks, then shows the ring it is going to move with a glow, then moves it, with a sentence about why. You can set how long it thinks, and Pause stops everything where it is.'),
    P('The row of lamps under the bars shows the pattern of rings on the bar: a lit lamp is a ring that is on. Watching the pattern helps you see the rhythm.'),
  ] },
  { title: 'Tips', items: [
    P('Do not try to remember the whole solution. Work out only the next target: which is the highest ring still on, what must be true for it to move, and which small ring you need to change to get there.'),
    P('When you feel lost, press Hint once and read the reason, then try the next few moves yourself. Or use Restart and try again with fewer rings; the pattern for five rings is the pattern for three rings with extra steps.'),
  ] },
];

export const HOWTO = [
  { title: 'Take every ring off the bar', items: [
    P('The rings sit on a long bar. Your goal is to take every ring off it.'),
    P('Tap a ring to move it. It will come off if it is on, and go back on if it is off, but only when the rule allows it.'),
    D([1, 1, 1, 1, 1], { glow: [0, 1] }),
  ] },
  { title: 'The rule in one sentence', items: [
    P('Ring 1, next to the free end, always moves. Any other ring moves only when the ring before it is on the bar and all the rings before that are off.'),
    P('Glowing rings can move right now. A ring that cannot move shivers and tells you why.'),
  ] },
  { title: 'The buttons', items: [
    P('Moves counts the moves you have made. To go shows the fewest moves still needed from here. Rings is the size of the puzzle.'),
    P('Undo takes back your last move. Hint shows the next move of a shortest solution. Restart begins the puzzle again from its start.'),
    P('New here? Tap Learn on the menu for seven short hands-on lessons. Auto Play lets you watch the puzzle solve itself, move by move, with the reasons.'),
  ] },
];

export const ABOUT = [
  { title: 'Chinese Rings', items: [
    P('Chinese Rings is a mechanical ring-and-bar puzzle in the oldest tradition of puzzle-making. Take rings on and off a steel bar following one rule and free them all. Lit metal rings you can feel, lessons that teach the pattern, a hint that shows the next legal move, an exact count of the moves still needed, and a Watch and Learn mode that solves it while explaining.'),
    P('Three to nine rings, from a five-move warm-up to a 341-move marathon. Classic starts with every ring on; Scramble starts from a random legal position. Your puzzle is saved when you leave.'),
  ] },
  { title: 'About the puzzle', items: [
    P('The Chinese rings has been made in China for many centuries; a popular story says a general gave it to his wife to keep her busy while he was away. In Europe it was described by the scholar Gerolamo Cardano in the sixteenth century, which is why it is sometimes called Cardano rings, and in France it is the baguenaudier.'),
    P('The same puzzle hides a beautiful piece of mathematics: the order in which you must move the rings is the reflected Gray code, the same sequence used in digital electronics.'),
    P('A puzzle for patience and planning. There is no clock and nothing to lose.'),
  ] },
  { title: 'Credits', items: [
    P('Designed and built by Arcforge, World Heritage Games. The titles use the Cinzel typeface by Natanael Gama, under the SIL Open Font License 1.1. The rings are 3D shapes shaded in the game itself; there is no ad and no network use.'),
  ] },
];

// Lessons: n rings, a start position, a goal. Goals: { ring: k } ring k+1 (0-based k) must be off the bar; { solved: true } all off.
export const LESSONS = [
  { n: 3, start: [1, 1, 1], goal: { ring: 0 }, title: 'Ring 1 is always free', text: 'The rings sit on the bar. Ring 1, the one nearest the free end on the right, may always move. Tap ring 1 to take it off.', done: 'That is the first rule: ring 1 always moves.' },
  { n: 3, start: [0, 1, 1], goal: { ring: 1 }, title: 'Ring 2 follows ring 1', text: 'Ring 1 is off the bar. Try to take ring 2 off. It will not move: ring 2 needs ring 1 to be ON. Put ring 1 back, then take ring 2 off.', done: 'Ring 2 moves only when ring 1 is on.' },
  { n: 3, start: [1, 1, 1], goal: { ring: 2 }, title: 'The gate for ring 3', text: 'Take ring 3 off. It needs ring 2 on and ring 1 off, so first open the gate: take ring 1 off.', done: 'Ring 3 moved because ring 2 was on and ring 1 was off.' },
  { n: 3, start: [1, 1, 1], goal: { solved: true }, title: 'Three rings, all off', text: 'Now free all three rings. It takes five moves. Remember: every other move is ring 1. Stuck? Tap Hint.', done: 'Solved in five moves, the fewest possible.' },
  { n: 4, start: [1, 1, 1, 1], goal: { ring: 3 }, title: 'Freeing ring 4', text: 'Take ring 4 off. It needs ring 3 on and rings 1 and 2 off. Clear the small rings first, then ring 4 can go. Tap Hint if you want the next move.', done: 'You cleared the small rings, then moved the big one.' },
  { n: 3, start: [0, 0, 1], goal: { solved: true }, title: 'Sometimes go backwards', text: 'Only ring 3 is on the bar, but it cannot move: ring 2 is off. To get on you have to put rings back first. Watch the glowing rings, or tap Hint.', done: 'You put rings back to make room: the heart of the puzzle.' },
  { n: 4, start: [1, 1, 1, 1], goal: { solved: true }, title: 'Four rings, all off', text: 'Free all four rings. It takes ten moves. Every other move is ring 1, and the pattern repeats. Use Hint when you are unsure.', done: 'You solved a whole puzzle. You are ready for more rings.' },
];
