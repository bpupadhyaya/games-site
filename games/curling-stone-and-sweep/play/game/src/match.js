// Match rules: ends, the last stone (hammer), throwing order, the free guard zone, hog line, scoring and the shot
// resolver that the AI, the guide and the game all share. Pure functions over the match record `m` and the world `w`.
import {
  createWorld, addStone, launch, settleWorld, cloneWorld, removeHogged, scoreEnd, inGuardZone, solveShot, V_MAX, HOG_FAR, R, toButton,
} from './sim.js';

export const FORMATS = {
  short: { id: 'short', name: 'Short', perSide: 4, pre: false, fg: 2, blurb: '4 stones each per end' },
  standard: { id: 'standard', name: 'Standard', perSide: 8, pre: false, fg: 4, blurb: '8 stones each per end' },
  doubles: { id: 'doubles', name: 'Doubles', perSide: 5, pre: true, fg: 4, blurb: '5 stones each, 2 placed stones' },
};
export const FORMAT_IDS = ['short', 'standard', 'doubles'];

// Weight (arrival speed at the target, m/s) of each shot weight.
export const WEIGHTS = [
  { id: 'draw', name: 'Draw', arrival: 0, note: 'stops on the broom' },
  { id: 'tap', name: 'Tap', arrival: 0.9, note: 'nudges what it touches' },
  { id: 'takeout', name: 'Takeout', arrival: 1.8, note: 'knocks a stone away' },
  { id: 'peel', name: 'Peel', arrival: 2.8, note: 'hard: sweeps stones out' },
];

export const other = (t) => 1 - t;

export function newMatch(cfg) {
  const fmt = FORMATS[cfg.format] ?? FORMATS.short;
  return {
    cfg, fmt, end: 1, ends: cfg.ends, scores: [0, 0], hammer: cfg.hammer ?? 0, thrown: [0, 0], shot: 0, turn: 0,
    phase: 'aim', log: [], over: null, endInfo: null, note: null,
  };
}

export const perSide = (m) => m.fmt.perSide;
export const stonesLeft = (m, team) => m.fmt.perSide - m.thrown[team];
export const guardsProtected = (m) => m.shot + 1 <= m.fmt.fg;      // is the stone about to be thrown still under the free guard rule
export const hammerName = 'last stone';

// Doubles-style placed stones: the side without the last stone has a centre guard, the other a stone at the back of the four-foot.
export const PLACED = { guard: { x: 0, y: -3.7 }, house: { x: 0, y: 0.45 } };

export function beginEnd(m, w) {
  w.stones = []; w.settled = true; w.t = 0; w.nextId = 1; w.thrown = 0;
  m.thrown = [0, 0]; m.shot = 0; m.phase = 'aim'; m.endInfo = null; m.note = null;
  m.turn = other(m.hammer);
  if (m.fmt.pre) {
    addStone(w, other(m.hammer), PLACED.guard.x, PLACED.guard.y);
    addStone(w, m.hammer, PLACED.house.x, PLACED.house.y);
  }
}

// Snapshot of what the free guard zone protects before a stone is thrown by `team`: the other side's guards.
export function protectedIds(m, w, team) {
  if (!guardsProtected(m)) return [];
  return w.stones.filter((s) => s.team !== team && inGuardZone(s)).map((s) => s.id);
}

// After the stone has come to rest: apply the hog line and the free guard zone rule. Returns { notes, restored }.
export function resolveShot(m, w, pre) {
  const notes = [];
  const gone = removeHogged(w);
  const thrown = w.stones.find((s) => s.id === w.thrown);
  for (const s of gone) notes.push({ k: s.id === w.thrown ? 'hog' : 'hogOther', id: s.id, team: s.team, x: s.x, y: s.y });
  const outs = w.stones.filter((s) => s.mode === 'out' && s.why !== 'hog' && s.out === 0);
  for (const s of outs) if (s.id === w.thrown) notes.push({ k: s.why === 'back' ? 'back' : 'side', id: s.id, x: s.x, y: s.y });
  const knocked = pre.protect.filter((id) => { const s = w.stones.find((q) => q.id === id); return !s || s.mode !== 'play'; });
  if (knocked.length) {
    // free guard zone violation: everything goes back, the thrown stone is removed
    for (const sn of pre.stones) {
      const s = w.stones.find((q) => q.id === sn.id);
      if (s) Object.assign(s, { x: sn.x, y: sn.y, vx: 0, vy: 0, w: sn.w, mode: 'play', why: '', out: 0 });
    }
    if (thrown) { thrown.mode = 'out'; thrown.why = 'fgz'; thrown.out = 0; }
    notes.length = 0;
    notes.push({ k: 'fgz', ids: knocked, id: w.thrown, x: thrown ? thrown.x : 0, y: thrown ? thrown.y : 0 });
    return { notes, restored: true };
  }
  return { notes, restored: false };
}

export const snapshotStones = (w) => w.stones.filter((s) => s.mode === 'play').map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w }));

// Play one shot on a copy of the world: the shared simulator for the AI, the guide and the lessons.
// p = { v0, theta, turn, fr, cv }. Returns { w, notes, thrown }.
export function playShot(m, w0, team, p) {
  const w = cloneWorld(w0);
  const pre = { protect: protectedIds(m, w, team), stones: snapshotStones(w) };
  launch(w, team, p);
  settleWorld(w, null);
  const res = resolveShot(m, w, pre);
  return { w, notes: res.notes, restored: res.restored, thrown: w.stones.find((s) => s.id === w.thrown) };
}

// The release for a chosen shot (target point, weight index, turn): nominal ice, no noise.
export function shotParams(shot) {
  const wt = WEIGHTS[shot.w] ?? WEIGHTS[0];
  const r = solveShot(shot.x, shot.y, wt.arrival, shot.turn);
  return { v0: Math.min(V_MAX, r.v0), theta: r.theta, turn: shot.turn, ok: r.ok };
}

// Called once the shot has been counted. Returns true when the end is over.
export function afterShot(m) {
  m.thrown[m.turn]++; m.shot++;
  if (m.thrown[0] >= m.fmt.perSide && m.thrown[1] >= m.fmt.perSide) return true;
  m.turn = other(m.turn);
  m.phase = 'aim';
  return false;
}

export function scoreCurrentEnd(m, w) {
  const sc = scoreEnd(w);
  m.endInfo = { team: sc.team, pts: sc.pts, order: sc.order.map((s) => s.id), counted: (sc.counted ?? []).map((s) => s.id), t: 0, steal: sc.team !== null && sc.team !== m.hammer };
  m.phase = 'score';
  return m.endInfo;
}

export function applyEnd(m) {
  const info = m.endInfo;
  if (info.team !== null) { m.scores[info.team] += info.pts; }
  m.log.push({ end: m.end, team: info.team, pts: info.pts, hammer: m.hammer, steal: info.steal });
  if (info.team !== null) m.hammer = other(info.team);     // the side that scored gives up the last stone
  if (m.end >= m.ends && m.scores[0] !== m.scores[1]) {
    m.over = { win: m.scores[0] > m.scores[1] ? 0 : 1, extra: m.end > m.cfg.ends };
    m.phase = 'over';
    return;
  }
  m.end++;
  if (m.end > m.ends) m.ends = m.end;      // level after the last end: one more end
}

// Does `team` score more if the end stopped now? Short text used by hints and the HUD.
export function standing(w, team) {
  const sc = scoreEnd(w);
  if (sc.team === null) return { team: null, pts: 0 };
  return { team: sc.team, pts: sc.pts, mine: sc.team === team, lead: toButton(sc.order[0]) };
}
void HOG_FAR; void R;
