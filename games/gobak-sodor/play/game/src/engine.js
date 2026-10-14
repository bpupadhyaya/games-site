// Gobak Sodor: the rule book and the simulation. Pure and deterministic: all randomness is the rng handed to newRound (only the
// court set-up uses it); every step after that is a function of the position and the player's action.
//
// The court is a W-column grid. Rows alternate lane (even) / line (odd): row 0 is the home lane, row `top` the end lane.
// Guards stand on the lines and move sideways along them; the sodor guard stands on the centre column and moves up and down.
// One beat = the player moves ONE runner one cell (or waits), then every guard moves, then touches are checked.
export const W = 7, MID = 3, REACH = 1;
export const RUNNERS = 3, ROUNDS = 3, HINTS = 3, BEATS_PER_LINE = 14, SIGHT = 3;
export const START_COLS = [1, 3, 5];

export const KINDS = {
  walker: { name: 'Walker', about: 'patrols its line from side to side, one cell a beat, and turns at the wall' },
  shadow: { name: 'Shadow', about: 'steps one cell a beat towards the nearest runner on or beside its line when one is within three columns, and otherwise walks its line' },
  sprinter: { name: 'Sprinter', about: 'dashes two cells towards the nearest runner on every second beat and rests on the other beats, and walks its line when nobody is within three columns' },
};
export const LEVELS = [
  { name: 'Village', lines: 3, mix: { walker: 0.55, shadow: 0.45, sprinter: 0 }, sodor: 'walker', pair: false },
  { name: 'Schoolyard', lines: 4, mix: { walker: 0.3, shadow: 0.45, sprinter: 0.25 }, sodor: 'shadow', pair: false },
  { name: 'Champions', lines: 5, mix: { walker: 0.2, shadow: 0.4, sprinter: 0.4 }, sodor: 'shadow', pair: true },
];

const abs = Math.abs, sgn = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);

export function newRound(rng, { level = 0, round = 0 } = {}) {
  const lv = LEVELS[level], lines = lv.lines, rows = 2 * lines + 1, top = rows - 1;
  const pick = () => {
    let x = rng.next(), acc = 0;
    for (const k of ['walker', 'shadow', 'sprinter']) { acc += lv.mix[k]; if (x < acc) return k; }
    return 'shadow';
  };
  const guards = [];
  for (let k = 0; k < lines; k++) {
    let kind = pick();
    if (round === 0 && kind === 'sprinter') kind = 'shadow';
    guards.push({ id: guards.length, row: 2 * k + 1, c: rng.int(W), dir: rng.chance(0.5) ? 1 : -1, kind, pc: 0 });
    if (lv.pair && round >= 1 && k === Math.floor(lines / 2)) {
      const g0 = guards[guards.length - 1]; g0.kind = 'walker'; g0.c = 1; g0.dir = 1;
      guards.push({ id: guards.length, row: g0.row, c: W - 2, dir: -1, kind: 'walker', pc: 0 });
    }
  }
  for (const g of guards) g.pc = g.c;
  const runners = START_COLS.map((c, id) => ({ id, c, row: 0, pc: c, prow: 0, phase: 'up' }));
  return {
    level, round, lines, rows, top, runners, guards,
    sodor: { c: MID, row: rng.int(top - 1) + 1, dir: rng.chance(0.5) ? 1 : -1, kind: lv.sodor, prow: 0 },
    beat: 0, budget: BEATS_PER_LINE * lines, ev: [], result: null, home: 0, out: 0, lastTag: [],
  };
}

export function clone(r) {
  return {
    ...r, runners: r.runners.map((x) => ({ ...x })), guards: r.guards.map((x) => ({ ...x })), sodor: { ...r.sodor }, ev: [], lastTag: [],
    result: r.result ? { ...r.result } : null,
  };
}

export const onGrid = (ru) => ru.phase === 'up' || ru.phase === 'down';
export const runnerAt = (r, c, row) => r.runners.find((x) => onGrid(x) && x.c === c && x.row === row) ?? null;
export const isLine = (row) => row % 2 === 1;

export function canMove(r, ru, dc, dr) {
  if (r.result || !ru || !onGrid(ru)) return false;
  if (abs(dc) + abs(dr) !== 1) return false;
  const c = ru.c + dc, row = ru.row + dr;
  if (c < 0 || c >= W || row < 0 || row > r.top) return false;
  const o = runnerAt(r, c, row);
  return !o || o === ru;
}
export const DIRS = [[0, 1], [-1, 0], [1, 0], [0, -1]];   // up, left, right, down (grid rows grow upward)
export function legalActions(r) {
  const out = [{ wait: true }];
  if (r.result) return out;
  for (const ru of r.runners) if (onGrid(ru)) for (const [dc, dr] of DIRS) if (canMove(r, ru, dc, dr)) out.push({ runner: ru.id, dc, dr });
  return out;
}

// Threats a guard reacts to: runners standing on its line or on the lanes next to it. A line guard only considers columns.
function nearestThreat(r, g) {
  let best = null, bd = 1e9;
  for (const ru of r.runners) {
    if (!onGrid(ru) || abs(ru.row - g.row) > 1) continue;
    const dc = abs(ru.c - g.c);
    if (dc > SIGHT) continue;
    const d = dc * 4 + abs(ru.row - g.row) * 1 + ru.id * 0.01;
    if (d < bd) { bd = d; best = ru; }
  }
  return best;
}
function nearestForSodor(r, s) {
  let best = null, bd = 1e9;
  for (const ru of r.runners) {
    if (!onGrid(ru) || ru.row < 1 || ru.row > r.top - 1 || abs(ru.c - MID) > 2) continue;
    const d = abs(ru.row - s.row) * 4 + abs(ru.c - MID) + ru.id * 0.01;
    if (d < bd) { bd = d; best = ru; }
  }
  return best;
}
// Where a line guard goes on beat number `beat` (the beat that is about to be played). Returns { to, sweep:[cells passed], target, dash, dir }.
export function planGuard(r, g, beat) {
  let to = g.c, dir = g.dir, target = null, dash = false;
  if (g.kind === 'walker') {
    if (to + dir < 0 || to + dir >= W) dir = -dir;
    to += dir;
  } else {
    target = nearestThreat(r, g);
    if (!target) {
      // nobody in sight: walk the line like a walker (sprinters walk on their rest beats too)
      if (to + dir < 0 || to + dir >= W) dir = -dir;
      to += dir;
      return { to, sweep: [Math.min(g.c, to), Math.max(g.c, to)], target: -1, dash: false, dir };
    }
    const goal = target.c;
    let sp = 1;
    if (g.kind === 'sprinter') { dash = beat % 2 === 0; sp = dash ? 2 : 0; if (!dash && !target) sp = 1; }
    const d = goal - g.c, n = Math.min(abs(d), sp);
    to = g.c + sgn(d) * n; if (n) dir = sgn(d);
  }
  const sweep = [];
  for (let x = Math.min(g.c, to); x <= Math.max(g.c, to); x++) sweep.push(x);
  return { to, sweep, target: target ? target.id : -1, dash, dir };
}
export function planSodor(r, beat) {
  const s = r.sodor; let to = s.row, dir = s.dir, target = null;
  if (s.kind === 'walker') {
    if (to + dir < 1 || to + dir > r.top - 1) dir = -dir;
    to += dir;
  } else {
    target = nearestForSodor(r, s);
    const goal = target ? target.row : Math.round(r.top / 2), d = goal - s.row;
    to = s.row + sgn(d); if (d) dir = sgn(d);
  }
  to = Math.max(1, Math.min(r.top - 1, to));
  const sweep = []; for (let y = Math.min(s.row, to); y <= Math.max(s.row, to); y++) sweep.push(y);
  void beat;
  return { to, sweep, target: target ? target.id : -1, dir };
}

export function plans(r) {
  const beat = r.beat + 1;
  return { guards: r.guards.map((g) => planGuard(r, g, beat)), sodor: planSodor(r, beat) };
}

export function remaining(r, ru) { return ru.phase === 'up' ? (r.top - ru.row) + r.top : ru.phase === 'down' ? ru.row : 0; }

// Play one beat. `a` is { runner, dc, dr } or { wait: true }. Returns false (state untouched) when the action is illegal.
export function step(r, a) {
  if (r.result) return false;
  r.ev.length = 0; r.lastTag = [];
  for (const x of r.runners) { x.pc = x.c; x.prow = x.row; }
  for (const g of r.guards) g.pc = g.c;
  r.sodor.prow = r.sodor.row;
  if (a && !a.wait) {
    const ru = r.runners[a.runner];
    if (!canMove(r, ru, a.dc, a.dr)) return false;
    ru.c += a.dc; ru.row += a.dr;
    r.ev.push({ t: 'move', id: ru.id, line: isLine(ru.row) });
    if (ru.phase === 'up' && ru.row === r.top) { ru.phase = 'down'; r.ev.push({ t: 'end', id: ru.id }); }
    else if (ru.phase === 'down' && ru.row === 0) { ru.phase = 'home'; r.home += 1; r.ev.push({ t: 'home', id: ru.id }); }
  } else r.ev.push({ t: 'wait' });
  r.beat += 1;
  const P = plans(r), swept = [];
  r.guards.forEach((g, i) => { const p = P.guards[i]; swept.push(p.sweep); g.c = p.to; g.dir = p.dir; });
  const sp = P.sodor; r.sodor.row = sp.to; r.sodor.dir = sp.dir;
  for (const ru of r.runners) {
    if (!onGrid(ru)) continue;
    let hit = null;
    if (isLine(ru.row)) {
      r.guards.forEach((g, i) => { if (g.row === ru.row && swept[i].some((x) => abs(x - ru.c) <= REACH)) hit = hit ?? { by: 'guard', gid: g.id }; });
    }
    if (!hit && ru.row >= 1 && ru.row <= r.top - 1 && abs(ru.c - MID) <= REACH && sp.sweep.some((y) => abs(y - ru.row) <= REACH)) hit = { by: 'sodor' };
    if (hit) { ru.phase = 'out'; r.out += 1; r.lastTag.push({ id: ru.id, ...hit }); r.ev.push({ t: 'tag', id: ru.id, by: hit.by, gid: hit.gid ?? -1, c: ru.c, row: ru.row }); }
  }
  if (!r.runners.some(onGrid)) r.result = { kind: r.home > 0 ? 'done' : 'caught', home: r.home, out: r.out, beats: r.beat };
  else if (r.beat >= r.budget) r.result = { kind: 'time', home: r.home, out: r.out, beats: r.beat };
  return true;
}

// --- the computer's runner AI (used for hints, the title attract mode and Auto Play) -------------------------------------
// The guards are deterministic, so a short exhaustive search over the player's own moves is exact; the leaf cost is the total
// remaining distance of all runners with a penalty for runners who were touched.
function cost(r) {
  let c = 0;
  for (const ru of r.runners) c += ru.phase === 'out' ? 2 * r.top + 14 : ru.phase === 'home' ? 0 : remaining(r, ru);
  return c;
}
function search(r, depth) {
  if (depth === 0 || r.result) return cost(r) + (r.result ? 0 : 0);
  let best = 1e9;
  for (const a of legalActions(r)) {
    const n = clone(r); step(n, a);
    const v = search(n, depth - 1) + (a.wait ? 0.15 : 0);
    if (v < best) best = v;
  }
  return best;
}
// Best action for the player, as { action, cost }. `depth` beats of look-ahead (3 is fast, 4 is the hint depth).
export function bestAction(r, depth = 3) {
  let best = null, bv = 1e9;
  for (const a of legalActions(r)) {
    const n = clone(r); step(n, a);
    // prefer making progress with the runner that is furthest along (breaks ties without waiting)
    let v = search(n, depth - 1) + (a.wait ? 0.3 : 0);
    if (!a.wait) { const ru = r.runners[a.runner]; v += (r.top * 2 - remaining(r, ru)) * -0.0005; }
    if (v < bv - 1e-9) { bv = v; best = a; }
  }
  return { action: best ?? { wait: true }, cost: bv };
}
export function safeAfter(r, a) { const n = clone(r); step(n, a); return !n.lastTag.length; }
