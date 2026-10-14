// Shove ha'penny physics: a slate board with nine beds (bands across the board), coins that slide with friction, nudge each
// other and fall off the edges. Pure and deterministic (fixed 1/240 s steps, no clock, no randomness): the same strike on
// the same board always gives the same result, so the ghost coin, the hint and the rivals all use this exact code.
//
// World units: x across the board (0 = left edge), y along it. The far line of bed 9 is y = 0 and y grows toward the
// player. Bed k (0..8, bed 1 is the nearest) lies between lines at y = (8-k)*BED_H and (9-k)*BED_H. The coin starts on the
// near edge (y = NEAR_Y), half hanging over it, and is struck with the heel of the hand.

export const R = 9;                     // coin radius
export const BEDS = 9;
export const BED_H = 27;                // distance between two lines
export const LINE = 1.6;                // thickness of a line: a coin touching it is dead
export const TW = 216;                  // board width
export const BEDS_H = BEDS * BED_H;     // 243
export const NEAR_Y = BEDS_H + 64;      // the near edge, with a blank run of 64 before bed 1
export const START_Y = NEAR_Y;
export const FAR_EDGE = -6;             // a coin whose middle passes this falls off the far end
export const MIN_PULL = 40;             // the shortest slide the heel can give
export const COINS_PER_SIDE = 5;
export const CHALKS = 3;                // chalks that win a bed

// The whole picture in world units: oak surround with the chalk margins left and right.
export const MARG = 44, TOPM = 30, NEARM = 46;
export const WX0 = -MARG, WX1 = TW + MARG, WY0 = FAR_EDGE - TOPM, WY1 = NEAR_Y + NEARM;

export const STEP = 1 / 240;
export const MU = 210;                  // friction deceleration (units / s^2), constant: a coin stops after v^2 / 2MU
export const V_MAX = 430;
export const V_MIN = 60;
export const REST_V = 5;
export const E_COIN = 0.8;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const startX = (x) => clamp(x, R + 1, TW - R - 1);
export const bedCenterY = (k) => (BEDS - 1 - k + 0.5) * BED_H;
export const lineY = (j) => j * BED_H;             // j = 0..9 from the far end
// The shortest stop that is worth aiming at and the farthest the marker may be set (past the far edge pushes a coin off).
export const AIM_MIN_Y = FAR_EDGE - 20;
export const AIM_MAX_Y = NEAR_Y - MIN_PULL;

// ---- beds and chalks ---------------------------------------------------------------------------------------------------
// The bed (0..8) a coin lies wholly in, or -1: on a line, partly off the board, or in the blank run.
export function bedOf(c) {
  if (c.x < R || c.x > TW - R || c.y < 0 || c.y >= BEDS_H) return -1;
  const r = Math.floor(c.y / BED_H), top = r * BED_H + LINE / 2, bot = (r + 1) * BED_H - LINE / 2;
  if (c.y - R < top || c.y + R > bot) return -1;
  return BEDS - 1 - r;
}
// How far from dead a coin is: the margin (units) to the nearest line, negative when the coin is not wholly in a bed.
export function margin(c) {
  if (c.x < R || c.x > TW - R || c.y < 0 || c.y >= BEDS_H) return -1;
  const r = Math.floor(c.y / BED_H), top = r * BED_H + LINE / 2, bot = (r + 1) * BED_H - LINE / 2;
  return Math.min(c.y - R - top, bot - (c.y + R));
}
// Chalks are handed out the moment a coin comes to rest wholly in a bed, in the order the coins were played. A coin in a bed
// its owner has filled counts for the other side when that side has fewer than three there. Every coin scores once: a
// scored coin is marked (`sc`) and stays on the board as an obstacle. `chalks[side][bed]` is changed in place; returns the
// list of awards { id, bed, side (who got the chalk, -1 wasted), by (owner of the coin) }.
export function tally(chalks, coins, sides = 2) {
  const awards = [];
  const order = coins.filter((c) => !c.out && !c.sc).slice().sort((a, b) => a.n - b.n);
  for (const c of order) {
    const b = bedOf(c);
    if (b < 0) continue;
    c.sc = 1;
    const mine = chalks[c.side];
    if (mine[b] < CHALKS) { mine[b]++; awards.push({ id: c.id, bed: b, side: c.side, by: c.side }); }
    else if (sides === 2 && chalks[1 - c.side][b] < CHALKS) { chalks[1 - c.side][b]++; awards.push({ id: c.id, bed: b, side: 1 - c.side, by: c.side }); }
    else awards.push({ id: c.id, bed: b, side: -1, by: c.side });
  }
  return awards;
}
export const bedsWon = (ch) => ch.reduce((n, v) => n + (v >= CHALKS ? 1 : 0), 0);
export const chalkCount = (ch) => ch.reduce((n, v) => n + Math.min(CHALKS, v), 0);

// ---- coins and the world -------------------------------------------------------------------------------------------------
let nextId = 1;
export const resetIds = () => { nextId = 1; };
export function makeCoin(side, x, n = 0, y = START_Y) { return { id: nextId++, side, x, y, vx: 0, vy: 0, out: 0, n, sc: 0 }; }
export const cloneCoin = (c) => ({ id: c.id, side: c.side, x: c.x, y: c.y, vx: c.vx, vy: c.vy, out: c.out, n: c.n, sc: c.sc });

// The velocity of a strike from (x, START_Y) meant to stop at (tx, ty) on a clear board. dp changes the strength by a
// fraction (the unsteadiness of the hand), dx moves the aim sideways (units at the target).
export function strikeVelocity(x, tx, ty, dp = 0, dx = 0) {
  const ax = tx + dx - x, ay = ty - START_Y, dist = Math.max(1, Math.hypot(ax, ay));
  const v = clamp(Math.sqrt(2 * MU * dist) * (1 + dp), V_MIN, V_MAX);
  return { vx: (ax / dist) * v, vy: (ay / dist) * v, v };
}

// One physics step over `coins` (resting and moving). `ev` collects { type, ... }: hit {v}, fall {coin, side}.
// Returns true while anything still moves.
export function stepCoins(coins, dt, ev) {
  let moving = false;
  for (const c of coins) {
    if (c.out) continue;
    const sp = Math.hypot(c.vx, c.vy);
    if (sp > 0) {
      // trapezoid step: the coin moves at the mean of its speed before and after the friction of this step
      const ns = sp - MU * dt;
      if (ns <= REST_V) { c.x += (c.vx / sp) * (sp / 2) * dt; c.y += (c.vy / sp) * (sp / 2) * dt; c.vx = 0; c.vy = 0; }
      else { const k = ns / sp, m = (sp + ns) / 2 * dt / sp; c.x += c.vx * m; c.y += c.vy * m; c.vx *= k; c.vy *= k; }
      moving = true;
    }
  }
  const n = coins.length;
  for (let i = 0; i < n; i++) {
    const a = coins[i]; if (a.out) continue;
    for (let j = i + 1; j < n; j++) {
      const b = coins[j]; if (b.out) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const dd = dx * dx + dy * dy;
      if (dd >= 4 * R * R) continue;
      let dist = Math.sqrt(dd);
      if (dist < 1e-6) { dx = 1; dy = 0; dist = 1; }
      const nx = dx / dist, ny = dy / dist, push = (2 * R - dist) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (vn > 0) {
        const j2 = ((1 + E_COIN) / 2) * vn;
        a.vx -= j2 * nx; a.vy -= j2 * ny; b.vx += j2 * nx; b.vy += j2 * ny;
        if (ev) ev.push({ type: 'hit', v: vn });
        moving = true;
      }
    }
  }
  // off the board: the middle of the coin passes an edge
  for (const c of coins) {
    if (c.out) continue;
    if (c.x < 0 || c.x > TW || c.y < FAR_EDGE || c.y > NEAR_Y + 30) {
      c.out = 1;
      if (ev) ev.push({ type: 'fall', coin: c, side: c.side });
    }
  }
  return moving;
}

// Run one strike to rest on a copy of the board. `table` = coins lying on the board (not mutated).
// spec { x, tx, ty, side, n, dp, dx }. Returns { table (coins left on the board, all of them), thrown, hits, trace, t }.
export function simulate(table, spec, o = {}) {
  const coins = table.map(cloneCoin);
  const c = makeCoin(spec.side ?? 0, startX(spec.x), spec.n ?? 99);
  const vel = strikeVelocity(c.x, spec.tx, spec.ty, spec.dp ?? 0, spec.dx ?? 0);
  c.vx = vel.vx; c.vy = vel.vy;
  coins.push(c);
  const trace = [], ev = [];
  const maxT = o.maxT ?? 7, every = o.trace ? 3 : 0;
  let t = 0, k = 0, hits = 0, fell = false;
  while (t < maxT) {
    ev.length = 0;
    const mv = stepCoins(coins, STEP, ev);
    t += STEP; k++;
    for (const e of ev) { if (e.type === 'hit') hits++; else if (e.type === 'fall' && e.coin === c) fell = true; }
    if (every && k % every === 0 && !c.out && trace.length < 700) trace.push(c.x, c.y);
    if (!mv) break;
  }
  if (every && !c.out) trace.push(c.x, c.y);
  return { table: coins.filter((q) => !q.out), thrown: c, hits, fell, trace, t };
}

// Dead coins that stay for now: a coin that is not wholly in a bed but still touches the beds (on a line, or hanging over a
// side) keeps lying there until the round ends, where it blocks and can be nudged into a bed. A coin that has stopped
// wholly short of the first bed is swept away at once.
export const inBlankRun = (c) => c.y - R > BEDS_H + LINE / 2;
export const sweep = (coins) => coins.filter((c) => !c.out && (c.sc || !inBlankRun(c)));
