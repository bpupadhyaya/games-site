// The computer player. It proposes candidate shots (straight, cut and cushion shots at each coin and pocket),
// filters them with a cheap ray trace, then PLAYS the best ones on a copy of the board with the real physics and
// the real rules, and keeps the best result. Lower levels look at fewer shots and then miss by a human-sized error.
// Work is counted in shots simulated, never in time, so the game stays deterministic; the caller runs step() once
// per frame so the interface never freezes.
import { S, R_COIN, R_STR, POCKETS, BASE_Y, BASE_X0, BASE_X1, trace, blocked } from './physics.js';
import { cloneGame, playStroke, onBoard, down, other, clearX } from './rules.js';

// candidates: how many simulated; err: aim error (radians, std-ish); perr: power error; queen: goes for the queen; bank: tries cushion shots
export const LEVELS = [
  { name: 'Novice', cands: 5, err: 0.055, perr: 0.16, queen: false, bank: false, pick: 3, sim: 1 },
  { name: 'Club', cands: 12, err: 0.024, perr: 0.09, queen: true, bank: false, pick: 2, sim: 1 },
  { name: 'Expert', cands: 26, err: 0.010, perr: 0.05, queen: true, bank: true, pick: 1, sim: 1 },
  { name: 'Master', cands: 48, err: 0.0035, perr: 0.025, queen: true, bank: true, pick: 1, sim: 1 },
];

// Mirror a pocket across a cushion so a straight line to the mirror is a one-bounce line to the pocket.
const mirrors = (p) => [{ x: -p.x, y: p.y }, { x: 2 * S - p.x, y: p.y }, { x: p.x, y: -p.y }, { x: p.x, y: 2 * S - p.y }];

// Cheap list of shots worth simulating for `side`. Each: { x, angle, power, coin, q }
export function candidates(g, side, level, mulberry) {
  const L = LEVELS[level], out = [], y0 = BASE_Y[side], dirY = side === 'W' ? -1 : 1;
  const world = g.world.filter((b) => b.k !== 'S');
  const xs = []; for (let i = 0; i < 9; i++) xs.push(BASE_X0 + (BASE_X1 - BASE_X0) * i / 8);
  const targets = world.filter((b) => b.on && (b.k === side || (L.queen && b.k === 'Q')));
  const push = (x, tx, ty, c, bank, pw) => {
    if (blocked(world, x, y0)) return;
    const dx = tx - x, dy = ty - y0, d = Math.hypot(dx, dy); if (d < 30) return;
    const ux = dx / d, uy = dy / d; if (uy * dirY < 0.05) return;
    const t = trace(world, x, y0, ux, uy);
    if (t.coin !== c) return;                                  // must first touch the intended coin
    out.push({ x, angle: Math.atan2(uy, ux), power: pw, coin: c, q: (bank ? 0.5 : 1) - t.t / 4000 - (bank ? 0.1 : 0) });
  };
  for (const c of targets) {
    for (const p of POCKETS) {
      const pts = [{ p, bank: false }]; if (L.bank) for (const m of mirrors(p)) pts.push({ p: m, bank: true });
      for (const { p: pp, bank } of pts) {
        const ux = pp.x - c.x, uy = pp.y - c.y, dd = Math.hypot(ux, uy); if (dd < 1) continue;
        const gx = c.x - ux / dd * (R_COIN + R_STR), gy = c.y - uy / dd * (R_COIN + R_STR);       // where the striker must be at contact
        if (gx < R_STR || gx > S - R_STR || gy < R_STR || gy > S - R_STR) continue;
        const pw = Math.min(1, 0.32 + (dd + Math.hypot(gx - S / 2, gy - y0) * 0.7) / 1500 + (bank ? 0.18 : 0));
        for (const x of xs) { const t = { x: x + (mulberry() - 0.5) * 30 }; t.x = Math.max(BASE_X0, Math.min(BASE_X1, t.x)); push(t.x, gx, gy, c, bank, pw); push(t.x, gx, gy, c, bank, Math.min(1, pw + 0.25)); }
      }
    }
  }
  // a couple of loose shots so there is always something to play (break, or a blocked board)
  for (let i = 0; i < 6; i++) { const x = BASE_X0 + mulberry() * (BASE_X1 - BASE_X0), a = Math.atan2(dirY, (mulberry() - 0.5) * 0.9); if (!blocked(world, x, y0)) out.push({ x, angle: a, power: 0.35 + mulberry() * 0.6, coin: null, q: -1 }); }
  out.sort((a, b) => b.q - a.q);
  // keep variety: at most a few per (coin) so the search is not five copies of one shot
  const per = new Map(), pick = [];
  for (const s of out) { const key = s.coin ? s.coin.id : -1, n = per.get(key) || 0; if (n < (L.cands > 30 ? 7 : 4)) { per.set(key, n + 1); pick.push(s); } }
  return pick.slice(0, Math.max(L.cands, 3));
}

// How good was the result for `side`? Uses the real rules: coins pocketed, queen, fouls, keeping the turn.
export function valueOf(before, after, side, r, tie) {
  const opp = other(side);
  let v = 0;
  v += (onBoard(before, side) - onBoard(after, side)) * 100;
  v -= (onBoard(before, opp) - onBoard(after, opp)) * 55;
  const qs = after.queen.state;
  if (qs === side) v += 130; else if (qs === 'pending' && after.queen.by === side) v += 70; else if (qs === opp) v -= 120;
  if (r.foul) v -= 60;
  if (after.turn === side && !after.over) v += 45;
  if (after.over) v += after.over.winner === side ? 5000 : after.over.winner === 'draw' ? 0 : -5000;
  // position: own coins near pockets are good, the opponent's near pockets are bad
  const near = (b) => { let m = 1e9; for (const p of POCKETS) m = Math.min(m, Math.hypot(b.x - p.x, b.y - p.y)); return m; };
  for (const b of after.world) if (b.on) { const s = 1 - Math.min(1, near(b) / 500); if (b.k === side) v += s * 6; else if (b.k === opp) v -= s * 5; }
  return v + tie * 2;
}

// Time-sliced thinker. step() simulates ONE candidate and returns the finished shot when done, else null.
export function createThinker(g0, side, level, seed, exact = false) {
  let s = (seed >>> 0) || 1; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const L = LEVELS[level], g = cloneGame(g0); g.turn = side;
  const list = candidates(g, side, level, rnd);
  const results = []; let i = 0, phase = 'scan', refine = 0, best = null;
  const evalShot = (c) => { const g2 = cloneGame(g); const r = playStroke(g2, clearX(g, side, c.x), c.angle, c.power); return { c, v: valueOf(g, g2, side, r, rnd()) }; };
  const finish = () => {
    results.sort((a, b) => b.v - a.v);
    const top = results.slice(0, L.pick), ch = top[Math.min(top.length - 1, Math.floor(rnd() * rnd() * top.length))];
    const c = ch ? ch.c : { x: S / 2, angle: side === 'W' ? -Math.PI / 2 : Math.PI / 2, power: 0.5 };
    // human-sized error, applied to the real stroke (not seen by the search)
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
    return { x: c.x, angle: exact ? c.angle : c.angle + gauss() * L.err, power: exact ? c.power : Math.max(0.12, Math.min(1, c.power + gauss() * L.perr)), value: ch ? ch.v : 0, considered: results.length };
  };
  return {
    step() {
      if (phase === 'scan') {
        if (i < list.length) { results.push(evalShot(list[i++])); return null; }
        if (L.name === 'Master' && results.length) { phase = 'refine'; results.sort((a, b) => b.v - a.v); best = results[0]; }
        else return finish();
      }
      if (phase === 'refine') {                                  // nudge the best shot to find a more forgiving or stronger one
        if (refine++ < 10) { const c = { ...best.c, angle: best.c.angle + (rnd() - 0.5) * 0.02, power: Math.max(0.2, Math.min(1, best.c.power + (rnd() - 0.5) * 0.2)) }; const r = evalShot(c); results.push(r); if (r.v > best.v) best = r; return null; }
        return finish();
      }
      return finish();
    },
    total: list.length + (L.name === 'Master' ? 10 : 0),
  };
}

// Run to the end (tests, daily-shot search). Never call this in the play loop.
export function chooseShot(g, side, level, seed, exact = false) { const t = createThinker(g, side, level, seed, exact); let r; while (!(r = t.step())); return r; }
export { LEVELS as AI_LEVELS };
