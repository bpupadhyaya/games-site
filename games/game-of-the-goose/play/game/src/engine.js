// Game of the Goose: the rules as data and pure functions. Nothing here draws or reads the clock. game.js plays turns on top of this,
// content.js (the Rules book) prints its numbers, ai.js uses its settle() to value positions, so the text can never drift from the game.

export const FINAL = 63;
export const GEESE = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
export const GOOSE_SET = new Set(GEESE);
export const BRIDGE = { at: 6, to: 12 };
export const INN = { at: 19, skips: 1 };
export const WELL = { at: 31 };
export const MAZE = { at: 42, to: 30 };
export const PRISON = { at: 52 };
export const SKELETON = { at: 58, to: 0 };
export const OPENING = { '3,6': 26, '4,5': 53 };           // the first throw of a game: dice shown as "low,high"
export const ROADS = [
  { from: 11, to: 20, name: "Pilgrims' Road" },
  { from: 24, to: 33, name: 'Mule Track' },
  { from: 37, to: 47, name: 'Mountain Pass' },
  { from: 46, to: 55, name: 'Salt Road' },
];
export const ROAD_AT = new Map(ROADS.map((r) => [r.from, r]));
export const MAX_FEATHERS = 3;
export const DOUBLE_ESCAPE = true;                         // in the well or the prison, a double on your own turn climbs out
export const TALLY = { perFeather: 5, winner: 30 };
export const VARIANT_KEYS = ['choice', 'roads', 'feathers'];
export const VARIANT_INFO = {
  choice: { name: 'Two dice, one choice', short: 'Move by the sum, or by either die alone.' },
  roads: { name: 'Shortcut roads', short: 'Four signposts offer an optional road ahead.' },
  feathers: { name: 'Feathers', short: 'Geese give feathers: roll again or slip past a hazard.' },
};
export const classicVariants = () => ({ choice: false, roads: false, feathers: false });
export const fullVariants = () => ({ choice: true, roads: true, feathers: true });

export const kindOf = (p) => {
  if (p === 0) return 'start';
  if (p === FINAL) return 'garden';
  if (GOOSE_SET.has(p)) return 'goose';
  if (p === BRIDGE.at) return 'bridge';
  if (p === INN.at) return 'inn';
  if (p === WELL.at) return 'well';
  if (p === MAZE.at) return 'maze';
  if (p === PRISON.at) return 'prison';
  if (p === SKELETON.at) return 'skeleton';
  if (ROAD_AT.has(p)) return 'road';
  return 'plain';
};
export const SHIELDABLE = new Set(['inn', 'well', 'maze', 'prison', 'skeleton']);
export const HAZARDS = [INN.at, WELL.at, MAZE.at, PRISON.at, SKELETON.at];

// One step-by-step walk: `n` spaces from `pos`, travelling `dir` (+1 toward 63). At 63 the pawn turns round and counts the surplus
// back. Never below the start. Returns the squares entered in order, the end square and the direction of travel.
export function walk(pos, n, dir = 1) {
  const path = [];
  let p = pos, d = dir;
  for (let i = 0; i < n; i++) {
    if (d > 0 && p === FINAL) d = -1;
    if (d < 0 && p === 0) { d = 1; }
    p += d;
    path.push(p);
  }
  return { path, end: p, dir: d };
}
// The same without the path (hot loop of the value table).
function walkEnd(pos, n, dir) {
  let p = pos, d = dir;
  for (let i = 0; i < n; i++) {
    if (d > 0 && p === FINAL) d = -1;
    if (d < 0 && p === 0) d = 1;
    p += d;
  }
  return { end: p, dir: d };
}

// What happens when a pawn ENDS a move on `p`. The caller applies it.
//   { type: 'win' } | { type: 'goose' } | { type: 'jump', to, kind } | { type: 'skip', turns } | { type: 'stuck', kind }
//   { type: 'road', to, name } | { type: 'none' }
export function effectAt(p, variants) {
  if (p === FINAL) return { type: 'win' };
  if (GOOSE_SET.has(p)) return { type: 'goose' };
  if (p === BRIDGE.at) return { type: 'jump', to: BRIDGE.to, kind: 'bridge' };
  if (p === MAZE.at) return { type: 'jump', to: MAZE.to, kind: 'maze' };
  if (p === SKELETON.at) return { type: 'jump', to: SKELETON.to, kind: 'skeleton' };
  if (p === INN.at) return { type: 'skip', turns: INN.skips, kind: 'inn' };
  if (p === WELL.at) return { type: 'stuck', kind: 'well' };
  if (p === PRISON.at) return { type: 'stuck', kind: 'prison' };
  if (variants?.roads && ROAD_AT.has(p)) return { type: 'road', to: ROAD_AT.get(p).to, name: ROAD_AT.get(p).name };
  return { type: 'none' };
}
export const isShieldable = (e) => (e.type === 'jump' && e.kind !== 'bridge') || e.type === 'skip' || e.type === 'stuck';

// The opening throw: dice (a, b) on the very first throw of a pawn.
export function openingTarget(a, b) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return OPENING[`${lo},${hi}`] ?? null;
}

// Play out a move to its end without any interaction, applying a policy for the optional choices.
// policy: { shield(e, p, feathers) -> bool, road(e, p) -> bool }. Returns the end square and what is waiting there.
export function settle(pos, amount, dir, variants, policy = {}, feathers = 0) {
  let p = pos, d = dir, f = feathers, geese = 0, shielded = 0, roaded = false, skip = 0, stuck = null, win = false, jump = null, hazard = null;
  const w0 = walkEnd(p, amount, d); p = w0.end; d = w0.dir;
  for (let guard = 0; guard < 40; guard++) {
    const e = effectAt(p, variants);
    if (e.type === 'goose') {
      geese += 1; f = variants?.feathers ? Math.min(MAX_FEATHERS, f + 1) : f;
      const w = walkEnd(p, amount, d); p = w.end; d = w.dir; continue;
    }
    if (e.type === 'win') { win = true; break; }
    if (e.type === 'road') { if (policy.road?.(e, p)) { p = e.to; roaded = true; } break; }
    if (isShieldable(e) && variants?.feathers && f > 0 && policy.shield?.(e, p, f)) { f -= 1; shielded += 1; hazard = e.kind; break; }
    if (e.type === 'jump') { jump = e.kind; p = e.to; break; }
    if (e.type === 'skip') { skip = e.turns; hazard = e.kind; break; }
    if (e.type === 'stuck') { stuck = e.kind; hazard = e.kind; break; }
    break;
  }
  return { end: p, dir: d, geese, shielded, roaded, skip, stuck, win, jump, hazard, feathers: f };
}

// ---- values: expected own turns to finish from each square (one player alone, the rest of the table ignored) --------------------------
const STUCK_COST = 4.5;           // roughly: a rescue arrives, or a double is thrown (1 in 6)
const tables = new Map();
export const FEATHER_VALUE = 1.1; // what one feather is worth in turns (a re-roll, or one hazard slipped)

export function valueTable(variants) {
  const key = `${variants.choice ? 1 : 0}${variants.roads ? 1 : 0}`;
  if (tables.has(key)) return tables.get(key);
  const V = new Array(FINAL + 1).fill(0);
  const v2 = { choice: variants.choice, roads: variants.roads, feathers: false };
  const val = (r) => (r.win ? 0 : V[r.end] + (r.stuck ? STUCK_COST : 0) + r.skip);
  const policy = { road: (e, p) => V[e.to] < V[p] };
  const outcomes = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push([a, b]);
  for (let sweep = 0; sweep < 120; sweep++) {
    let delta = 0;
    for (let p = FINAL - 1; p >= 0; p--) {
      let sum = 0;
      for (const [a, b] of outcomes) {
        let best = val(settle(p, a + b, 1, v2, policy));
        if (v2.choice) {
          best = Math.min(best, val(settle(p, a, 1, v2, policy)), val(settle(p, b, 1, v2, policy)));
        }
        sum += best;
      }
      const nv = 1 + sum / 36;
      delta = Math.max(delta, Math.abs(nv - V[p]));
      V[p] = nv;
    }
    if (delta < 1e-4) break;
  }
  tables.set(key, V);
  return V;
}

// Value (turns still needed) of a settled result for one pawn.
export function resultValue(V, r) { return r.win ? 0 : V[r.end] + (r.stuck ? STUCK_COST : 0) + r.skip; }

// The options a roll offers. `opened` = this pawn has already made its first throw.
// Each option: { id, amount, die (-1 for the sum), label, opening (target or null) }
export function rollOptions(a, b, variants, opened) {
  const opts = [];
  const open = !opened ? openingTarget(a, b) : null;
  opts.push({ id: 'sum', amount: a + b, die: -1, opening: open });
  if (variants.choice && !open) {
    opts.push({ id: 'die0', amount: a, die: 0, opening: null });
    if (b !== a) opts.push({ id: 'die1', amount: b, die: 1, opening: null });
  }
  return opts;
}
// Preview of an option from a square: where the pawn ends up if no optional choice is taken (feathers are not spent, roads not taken).
export function previewOption(pos, opt, variants, feathers, dir = 1) {
  if (opt.opening) return { end: opt.opening, geese: 0, skip: 0, stuck: null, win: false, dir, feathers, shielded: 0, roaded: false, opening: true };
  return settle(pos, opt.amount, dir, variants, {}, feathers);
}

// The computer's judgement. Returns the best option id plus the numbers behind it (for hints and Watch and Learn).
export function bestOption(V, pos, opts, variants, feathers, dir, canReroll) {
  const scored = opts.map((o) => {
    const policy = {
      road: (e, p) => V[e.to] < V[p],
      shield: (e, p, f) => shieldGain(V, e, p) > FEATHER_VALUE + 0.15,
    };
    const r = o.opening ? { end: o.opening, win: false, stuck: null, skip: 0, geese: 0 } : settle(pos, o.amount, dir, variants, policy, feathers);
    return { id: o.id, value: resultValue(V, r), end: r.end, geese: r.geese, stuck: r.stuck, skip: r.skip };
  });
  scored.sort((x, y) => x.value - y.value);
  const best = scored[0];
  const fresh = V[pos] - 1;                       // expected turns left if the dice are rolled again within this turn
  const reroll = !!(canReroll && variants.feathers && feathers > 0 && best.value - fresh > FEATHER_VALUE);
  return { best: best.id, reroll, scored, fresh };
}
// How many turns a hazard costs, as the computer sees it.
export function shieldGain(V, e, p) {
  if (e.type === 'jump') return resultValue(V, { end: e.to, skip: 0, stuck: null }) - V[p];
  if (e.type === 'skip') return e.turns;
  if (e.type === 'stuck') return STUCK_COST;
  return 0;
}
export const roadWorth = (V, e, p) => V[p] - V[e.to];
