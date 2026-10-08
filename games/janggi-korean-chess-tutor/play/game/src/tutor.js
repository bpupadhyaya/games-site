// The tutor: plain-language help that never plays for you. Pure and deterministic.
//   pieceTip(type)            one sentence about how the piece moves, shown when you pick it up
//   riskyTargets(g, from, ts) which of the glowing points would leave a piece hanging (for the amber warning marks)
//   explainMove(g, m, score)  why the computer's suggested move is good, in one or two sentences (Think / hint)
//   hangingNote(g)            after a move: the most valuable piece of the side that just moved that can be won, if any
import { legalPacked, inCheckBoard, inCheck, applyMove, clone, POINTS, TYPE_NAME, SIDE_NAME, GENERAL, GUARD, ELEPHANT, HORSE, CHARIOT, CANNON, SOLDIER, xOf, yOf, canPass, facing } from './rules.js';

const abs = Math.abs;
const FILES = 'abcdefghi';
export const sqName = (s) => `${FILES[xOf(s)]}${10 - yOf(s)}`;      // Cho's view: files a..i, ranks 1..10 from Cho's home
const cap1 = (w) => w[0].toUpperCase() + w.slice(1);
const pts = (t) => (t === GENERAL ? 'the game' : `${POINTS[t]} point${POINTS[t] === 1 ? '' : 's'}`);

const TIPS = [
  '',
  'General: one step along any line of the palace, including the diagonals. It never leaves the palace.',
  'Guard: one step along the palace lines, like the general. It never leaves the palace.',
  'Elephant: one point straight, then two points diagonally. Blocked if either of the two points it passes is occupied.',
  'Horse: one point straight, then one diagonally. Blocked if the point right next to it (the straight step) is occupied.',
  'Chariot: any distance along a line, and along the palace diagonals. The strongest piece (13 points).',
  'Cannon: must jump over exactly one piece, even to move. It cannot jump over, or capture, another cannon.',
  'Soldier: one step forward or sideways, never back. In the enemy palace it may also step forward on a diagonal.',
];
export const pieceTip = (type) => TIPS[abs(type)] ?? '';

function trial(g, m) {                                  // a board with the move played (no judging, no logging)
  const b = g.board.slice(); b[m.to] = b[m.from]; b[m.from] = 0; return b;
}
// The best capture the opponent (the side NOT moving in board b) has: { gain, victim, attacker, to, from } in points, or null.
// gain = what the victim is worth, minus the capturing piece if it can be taken back. Pieces that guard each other count as safe.
function bestThreat(b, victimSide) {
  let best = null;
  for (const m of legalPacked(b, -victimSide)) {
    const f = m & 127, t = m >> 7, v = b[t];
    if (!v) continue;
    const vt = abs(v), at = abs(b[f]);
    const c = b.slice(); c[t] = c[f]; c[f] = 0;
    const back = legalPacked(c, victimSide).some((mm) => (mm >> 7) === t);
    const worth = vt === GENERAL ? 40 : POINTS[vt];
    const gain = back ? worth - POINTS[at] : worth;
    if (gain > 0 && (!best || gain > best.gain)) best = { gain, victim: vt, attacker: at, to: t, from: f, guarded: back };
  }
  return best;
}
export function riskyTargets(g, from, targets) {
  const side = g.board[from] > 0 ? 1 : -1, out = new Map();
  for (const to of targets) {
    const b = trial(g, { from, to });
    if (inCheckBoard(b, side)) continue;
    const th = bestThreat(b, side);
    if (th && th.gain >= 2) out.set(to, th);
  }
  return out;
}
export function threatText(th) {
  return `${cap1(TYPE_NAME[th.victim])} on ${sqName(th.to)} could be taken by the enemy ${TYPE_NAME[th.attacker]}${th.guarded ? ' (you could take it back, but you lose more)' : ''}.`;
}

// One or two sentences on why `m` (a legal move for g.turn) is a good one.
export function explainMove(g, m, scoreCp) {
  if (m.pass) return 'Pass: nothing here improves your position, and passing keeps it safe. (Two passes in a row end the game and the pieces are counted.)';
  const side = g.turn, b = g.board, p = b[m.from], t = abs(p), cap = b[m.to], ct = abs(cap);
  const bits = [];
  const wasChecked = inCheckBoard(b, side);
  const c = clone(g); applyMove(c, m);
  if (c.result && c.result.why === 'checkmate') return `Checkmate! The ${TYPE_NAME[t]} to ${sqName(m.to)} leaves the enemy general with no escape.`;
  if (wasChecked) bits.push(`Answers the check: the ${TYPE_NAME[t]} to ${sqName(m.to)} gets your general out of danger.`);
  if (cap) bits.push(`Wins the enemy ${TYPE_NAME[ct]} (${pts(ct)}) with your ${TYPE_NAME[t]}.`);
  if (!wasChecked && c.board && inCheckBoard(c.board, -side)) bits.push(`Gives check: your ${TYPE_NAME[t]} attacks the enemy general.`);
  const th = bestThreat(trial(g, m), side);
  if (!cap && !bits.length) {
    const here = bestThreat(b, side);
    if (here && here.gain >= 2 && here.to === m.from) bits.push(`Moves your ${TYPE_NAME[t]} out of danger (the enemy ${TYPE_NAME[here.attacker]} could take it).`);
    else if (t === CANNON) bits.push(`Brings the cannon to ${sqName(m.to)}, where it has a screen and a line of attack.`);
    else if (t === HORSE || t === ELEPHANT) bits.push(`Develops the ${TYPE_NAME[t]} to ${sqName(m.to)}, toward the centre where it controls more points.`);
    else if (t === CHARIOT) bits.push(`Puts the chariot on ${sqName(m.to)}, a long open line.`);
    else if (t === SOLDIER) bits.push('Advances a soldier. Soldiers cannot go back, so they are best pushed with a plan.');
    else if (t === GUARD || t === GENERAL) bits.push(`Tidies the palace: the ${TYPE_NAME[t]} to ${sqName(m.to)} keeps the general safe.`);
  }
  if (cap && th && th.gain >= 2) bits.push(`Watch out: afterwards the ${TYPE_NAME[th.victim]} on ${sqName(th.to)} can be taken, but you still come out ahead.`);
  if (typeof scoreCp === 'number' && Math.abs(scoreCp) < 25000) {
    const pt = scoreCp / 50;
    if (pt >= 3) bits.push('The computer sees a clear advantage after this.');
    else if (pt <= -3) bits.push('You are behind, so this is the move that fights back best.');
  }
  return bits.length ? bits.join(' ') : 'A solid move: the computer rates it best after looking several moves ahead.';
}

// After a move by the side that just moved (g.turn is now the opponent): is one of its pieces hanging?
export function hangingNote(g) {
  const mover = -g.turn;
  const th = bestThreat(g.board, mover);
  if (!th || th.gain < 3) return null;
  return `Careful: ${threatText(th)}`;
}

// After the opponent's move: is one of OUR pieces (side) in danger?
export function dangerNote(g, side) {
  const th = bestThreat(g.board, side);
  if (!th || th.gain < 3) return null;
  return `Watch out: ${threatText(th)}`;
}

export function pointsLine(b) {
  let cho = 0, han = 0;
  for (let s = 0; s < 90; s++) { const p = b[s]; if (p > 0) cho += POINTS[p]; else if (p < 0) han += POINTS[-p]; }
  return { cho, han };
}
export { SIDE_NAME, inCheck, canPass, facing };
