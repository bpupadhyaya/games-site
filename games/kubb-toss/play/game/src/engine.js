// Kubb rules, pure and deterministic: who owns what, which kubb may be attacked, what a thrown baton changes, how a turn ends, who wins.
// Nothing here knows about drawing or physics: the physics hands over the final positions of the blocks after a baton has come to rest.
//
// Blocks: ids 0..4 belong to team 0 (its baseline is y = 0, the near end of the screen), 5..9 to team 1 (y = FIELD.L), 10 is the king.
// Roles of a kubb:  base (standing on its own side's baseline area), field (standing in the OPPONENT's half after being thrown in),
// fallen (knocked down by the opponent, waiting to be thrown in at its owner's next turn), cleared (knocked down again as a field kubb: finished).
import { FIELD, KUBB, KING, BASE_STEP } from './phys.js';

export const KING_ID = 10;
export const KING_RING = 0.675;                // a thrown-in or placed kubb must stay this far (one baton length) from the king
export const SIDE_MARGIN = 0.2;
export const SIZES = [{ id: 0, name: 'Quick', kubbs: 3, note: '3 kubbs each, a short game', turns: 24 }, { id: 1, name: 'Standard', kubbs: 5, note: '5 kubbs each, the full game', turns: 40 }];
export const batonsFor = (turnNo, opening = true) => (!opening ? 6 : turnNo === 0 ? 2 : turnNo === 1 ? 4 : 6);
export const dirOf = (team) => (team === 0 ? 1 : -1);
export const baselineY = (team) => (team === 0 ? 0 : FIELD.L);
export const teamHalf = (y) => (y < FIELD.MID ? 0 : 1);
export const baseXs = (size) => (size === 3 ? [-BASE_STEP, 0, BASE_STEP] : [-2 * BASE_STEP, -BASE_STEP, 0, BASE_STEP, 2 * BASE_STEP]);

export function newMatch(cfg) {
  const size = cfg.size === 3 ? 3 : 5, xs = baseXs(size), blocks = [];
  for (let t = 0; t < 2; t++) for (let i = 0; i < 5; i++) {
    const id = t * 5 + i;
    if (i < size) blocks.push({ id, kind: 'kubb', team: t, role: 'base', x: xs[i], y: baselineY(t), yaw: 0, down: false, q: null, z: KUBB.h / 2 });
    else blocks.push({ id, kind: 'kubb', team: t, role: 'cleared', x: 0, y: 0, yaw: 0, down: false, q: null, z: 0 });
  }
  blocks.push({ id: KING_ID, kind: 'king', team: -1, role: 'king', x: 0, y: FIELD.MID, yaw: 0, down: false, q: null, z: KING.h / 2 });
  const m = {
    cfg: { mode: 'ai', opp: 0, size, first: 0, opening: true, ...cfg, size },
    size, blocks, turn: cfg.first ?? 0, turnNo: 0, phase: 'batons', batons: 0, thrown: 0, queue: [], tossTry: 0, over: null,
    knocked: [0, 0], cleared: [0, 0], turnKnocked: 0, turnCleared: 0, lastLog: '', baton: 0,
  };
  startTurn(m, true);
  return m;
}
export const blockById = (m, id) => m.blocks[id];
export const kingPos = (m) => { const k = m.blocks[KING_ID]; return { x: k.x, y: k.y }; };
export const live = (m) => m.blocks.filter((b) => b.role !== 'cleared');
export const fieldOf = (m, team) => m.blocks.filter((b) => b.team === team && b.role === 'field' && !b.down);
export const baseOf = (m, team) => m.blocks.filter((b) => b.team === team && b.role === 'base' && !b.down);
export const fallenOf = (m, team) => m.blocks.filter((b) => b.team === team && b.role === 'fallen');
export const ownKubbs = (m, team) => m.blocks.filter((b) => b.team === team && b.role !== 'cleared');
export const totalLeft = (m, team) => ownKubbs(m, team).length;

// The baton rules for the team on turn: what it may attack right now.
export function targets(m) {
  const t = m.turn, mine = fieldOf(m, t);
  const king = m.blocks[KING_ID];
  if (mine.length) return { kind: 'field', ids: mine.map((b) => b.id), king: false, why: 'Field kubbs first.' };
  const base = baseOf(m, 1 - t);
  if (base.length) return { kind: 'base', ids: base.map((b) => b.id), king: false, why: 'Now the baseline kubbs.' };
  return { kind: 'king', ids: [king.id], king: true, why: 'Every kubb is down: topple the king.' };
}
// The throw line: the baseline, or the advantage line (the field kubb of the opponent that stands closest to the centre line).
// The advantage line is never used to throw at the king.
export function throwLine(m, forKing) {
  const t = m.turn, base = baselineY(t);
  if (forKing) return { y: base, adv: false };
  const left = m.blocks.filter((b) => b.team === 1 - t && b.role === 'field' && !b.down && teamHalf(b.y) === t);
  if (!left.length) return { y: base, adv: false };
  let y = t === 0 ? Math.max(...left.map((b) => b.y)) : Math.min(...left.map((b) => b.y));
  // never past the king ring
  y = t === 0 ? Math.min(y, FIELD.MID - KING_RING) : Math.max(y, FIELD.MID + KING_RING);
  y = t === 0 ? Math.max(0, y) : Math.min(FIELD.L, y);
  return { y, adv: Math.abs(y - base) > 0.05 };
}

// ---- turn flow -------------------------------------------------------------------------------------------------------------
export function startTurn(m, first = false) {
  const t = m.turn;
  m.baton = 0;
  m.batons = batonsFor(m.turnNo, m.cfg.opening);
  m.thrown = 0; m.turnKnocked = 0; m.turnCleared = 0; m.tossTry = 0;
  m.queue = fallenOf(m, t).map((b) => b.id);
  m.phase = m.queue.length ? 'throwin' : 'batons';
  void first;
}
// A kubb of the turn team is thrown into the opponent's half at (x, y). Returns {ok, reason}: a fault on the first try gives a second try,
// a fault on the second try means the opponent places the kubb.
export function tossCheck(m, team, x, y) {
  const half = 1 - team;
  if (Math.abs(x) > FIELD.W / 2 - SIDE_MARGIN * 0.4) return { ok: false, reason: 'It landed outside the side line.' };
  if (y < 0 || y > FIELD.L) return { ok: false, reason: 'It landed outside the baseline.' };
  if (teamHalf(y) !== half) return { ok: false, reason: 'It did not reach the opponent\'s half.' };
  const kp = kingPos(m);
  if (Math.hypot(x - kp.x, y - kp.y) < KING_RING) return { ok: false, reason: 'It landed within a baton length of the king.' };
  return { ok: true, reason: '' };
}
// Where may a placed kubb go (the opponent places it after two faults)?
export function placeCheck(m, team, x, y) {
  const half = 1 - team;
  if (Math.abs(x) > FIELD.W / 2 - SIDE_MARGIN) return { ok: false, reason: 'Inside the side lines, please.' };
  if (teamHalf(y) !== half || y < 0.3 || y > FIELD.L - 0.3) return { ok: false, reason: 'In the half that is being attacked.' };
  const kp = kingPos(m);
  if (Math.hypot(x - kp.x, y - kp.y) < KING_RING) return { ok: false, reason: 'A baton length from the king.' };
  return { ok: true, reason: '' };
}
// Nearest spot to (x, y) that does not overlap another block.
export function freeSpot(m, id, x, y) {
  const clash = (px, py) => m.blocks.some((b) => b.id !== id && b.role !== 'cleared' && b.role !== 'fallen' && Math.hypot(b.x - px, b.y - py) < 0.24)
    || m.blocks.some((b) => b.id !== id && b.role === 'fallen' && Math.hypot(b.x - px, b.y - py) < 0.3);
  if (!clash(x, y)) return { x, y };
  for (let r = 0.1; r < 1.5; r += 0.1) for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + r * 3, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (Math.abs(px) < FIELD.W / 2 - 0.15 && py > 0.15 && py < FIELD.L - 0.15 && !clash(px, py) && Math.hypot(px - kingPos(m).x, py - kingPos(m).y) >= KING_RING) return { x: px, y: py };
  }
  return { x, y };
}
// The kubb stands where it landed (or was placed) in the opponent's half: a field kubb.
export function standField(m, id, x, y) {
  const b = m.blocks[id], s = freeSpot(m, id, x, y);
  Object.assign(b, { role: 'field', x: s.x, y: s.y, yaw: 0, down: false, q: null, z: KUBB.h / 2 });
  m.queue = m.queue.filter((q) => q !== id); m.tossTry = 0;
  if (!m.queue.length) m.phase = 'batons';
  return b;
}
export function tossFail(m) { m.tossTry++; return m.tossTry >= 2; }

// ---- a baton has come to rest ---------------------------------------------------------------------------------------------------
// `finals`: for every block that is still in play, what the physics says now: { id, x, y, z, q, down }.
// `mask` is what was legal when the baton was thrown: { base: bool, king: bool }.
export function applyThrow(m, finals, mask) {
  const t = m.turn, res = { knocked: [], cleared: [], restored: [], kingDown: false, win: -1, why: '', fieldDown: 0 };
  for (const f of finals) {
    const b = m.blocks[f.id];
    if (!b || b.role === 'cleared') continue;
    Object.assign(b, { x: f.x, y: f.y, z: f.z, q: f.down ? f.q : null, down: !!f.down, yaw: f.yaw ?? b.yaw });
  }
  const restore = (b) => { const s = freeSpot(m, b.id, b.x, b.y); Object.assign(b, { x: s.x, y: s.y, down: false, q: null, z: b.kind === 'king' ? KING.h / 2 : KUBB.h / 2, yaw: 0 }); res.restored.push(b.id); };
  for (const b of m.blocks) {
    if (b.kind !== 'kubb' || !b.down) continue;
    if (b.role === 'field') {
      if (b.team === t) { b.role = 'cleared'; b.down = false; res.cleared.push(b.id); m.cleared[t]++; m.turnCleared++; }
      else restore(b);
    } else if (b.role === 'base') {
      if (b.team === 1 - t && mask.base) { b.role = 'fallen'; res.knocked.push(b.id); m.knocked[t]++; m.turnKnocked++; }
      else restore(b);
    }
  }
  const king = m.blocks[KING_ID];
  if (king.down) {
    res.kingDown = true;
    if (mask.king) { m.over = { win: t, why: 'The king fell after the last kubb.' }; res.win = t; res.why = m.over.why; }
    else { m.over = { win: 1 - t, why: 'The king fell too early.' }; res.win = 1 - t; res.why = m.over.why; }
  }
  m.thrown++; m.baton++;
  return res;
}
export function turnOver(m) { return m.baton >= m.batons; }
// End of the turn: the other team is up; its knocked-down kubbs (if any) must be thrown in first.
export function endTurn(m) {
  m.turn = 1 - m.turn; m.turnNo++;
  const cap = SIZES.find((s) => s.kubbs === m.size).turns;
  if (m.turnNo >= cap && !m.over) {
    const a = m.knocked[0], b = m.knocked[1];
    m.over = { win: a === b ? -1 : a > b ? 0 : 1, why: a === b ? 'The turn limit was reached with an equal count of kubbs knocked down.' : 'The turn limit was reached: more of the other side\'s kubbs knocked down.' };
    return;
  }
  startTurn(m);
}
// The three kinds of kubbs for the HUD pips of a team: standing at home, thrown in and waiting, down.
export function pipsOf(m, team) {
  const own = m.blocks.filter((b) => b.team === team);
  return { base: own.filter((b) => b.role === 'base').length, field: own.filter((b) => b.role === 'field').length, fallen: own.filter((b) => b.role === 'fallen').length, cleared: own.filter((b) => b.role === 'cleared').length - (5 - m.size) };
}
