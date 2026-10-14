// Tejo engine: the clay box, the ring, the mechas, discs, scoring and the computer players.
// Pure and deterministic: every random draw comes from a seed handed in by the caller (no clocks, no Math.random).
//
// Box coordinates are centimetres: u runs left to right 0..100, v runs from the NEAR edge (0, the thrower's side) to the FAR edge (100).
// Everything the rules page says about sizes comes from the constants below.

export const BOX = 100;
export const RING = { u: 50, v: 54, hole: 6.0, outer: 8.0, tol: 2.0, kick: 7.0 };   // hole radius, outer radius, how far off-centre a disc may sit and still drop in
export const DISC_R = 4.0;
export const MECHA = { r: 6.4, hit: 2.6, angles: [90, 270] };               // distance of each paper mecha from the ring centre; touch distance
export const HAND = { u: 50, v: -36 };                                              // where a throw starts, in box coordinates (below the near edge)
export const POINTS = { ring: 6, pop: 3, mano: 1 };
export const DISCS_EACH = 3;
export const TARGETS = [12, 21, 27];
export const LEVELS = [
  { name: 'Rookie', sigma: 4.4, search: 0.25, think: [0.9, 1.6], note: 'Learning the lane' },
  { name: 'Club', sigma: 3.2, search: 0.6, think: [0.9, 1.8], note: 'Steady and sensible' },
  { name: 'Pro', sigma: 2.4, search: 0.9, think: [1.0, 2.0], note: 'Reads the rim and the mechas' },
  { name: 'Champion', sigma: 1.9, search: 1.0, think: [1.0, 2.2], note: 'Calm, precise, hard to beat' },
];
export const HUMAN_SIGMA = 2.3;
export const TREMOR_START = 1.5, TREMOR_MAX = 1.1;   // seconds before the hand starts to shake; shake size in cm at full effect

export const mecha = (i) => {
  const a = (MECHA.angles[i] * Math.PI) / 180;
  return { u: RING.u + Math.cos(a) * MECHA.r, v: RING.v + Math.sin(a) * MECHA.r };
};
export const sigmaAt = (base, v) => base * (0.75 + 0.5 * Math.max(0, Math.min(100, v)) / 100);

// Tiny seeded stream for the physics (the game passes seeds drawn from env.rng).
export function stream(seed) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, next()))) * Math.cos(2 * Math.PI * next());
  return { next, gauss };
}

export const newBoard = () => ({ discs: [], mechas: [true, true], nextId: 1 });
export const cloneBoard = (b) => ({ discs: b.discs.map((d) => ({ ...d })), mechas: b.mechas.slice(), nextId: b.nextId });
export const refreshMechas = (b) => { b.mechas = [true, true]; };
const dist = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
export const ringDist = (d) => Math.hypot(d.u - RING.u, d.v - RING.v);
const onBox = (p, m = 0) => p.u >= -m && p.u <= BOX + m && p.v >= -m && p.v <= BOX + m;

// Resolve one throw against a board WITHOUT changing it. Returns everything the game needs to animate and score.
//   aim: the target mark { u, v }; base: scatter sigma (cm, before the height factor); seed: any integer.
export function resolveThrow(board, side, aim, base, seed) {
  const s = stream(seed);
  const sg = sigmaAt(base, aim.v);
  const land = { u: aim.u + s.gauss() * sg, v: aim.v + s.gauss() * sg };
  const res = { side, aim: { ...aim }, land, final: { ...land }, path: [], status: 'box', kick: false, ring: false, pops: [], pushes: [], points: 0, kind: 'none', sigma: sg };
  if (!onBox(land, 0)) {
    res.status = land.v < 0 ? 'short' : land.v > BOX ? 'long' : 'side';
    return res;
  }
  // throw direction: from the hand to the landing point
  let dx = land.u - HAND.u, dy = land.v - HAND.v;
  const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
  const speed = 0.35 + 0.65 * Math.min(1, Math.max(0, land.v) / 100);
  let pos = { ...land };
  const path = [{ ...pos }];
  const rd = Math.hypot(land.u - RING.u, land.v - RING.v);
  if (rd <= RING.tol) {
    res.ring = true; res.status = 'ring';
  } else if (rd <= RING.kick) {
    // the hard brass rim: the disc is kicked outward, over the mechas on that side
    res.kick = true;
    let ox = land.u - RING.u, oy = land.v - RING.v;
    const ol = Math.hypot(ox, oy);
    if (ol < 0.4) { ox = dx; oy = dy; } else { ox /= ol; oy /= ol; }
    const out = RING.outer + DISC_R + 0.6 + s.next() * 2.4;
    const n = 8;
    for (let i = 1; i <= n; i++) { const r = rd + ((out - rd) * i) / n; path.push({ u: RING.u + ox * r, v: RING.v + oy * r }); }
    pos = path[path.length - 1];
  } else {
    // clay: a short slide in the direction of the throw
    const L = (0.3 + 2.4 * speed) * (0.5 + s.next());
    const n = 5;
    for (let i = 1; i <= n; i++) path.push({ u: land.u + (dx * L * i) / n, v: land.v + (dy * L * i) / n });
    pos = path[path.length - 1];
  }
  res.path = path;
  res.final = { ...pos };
  if (!onBox(pos, DISC_R * 0.25) && !res.ring) { res.status = 'off'; }
  // pops: any path point within touch distance of a live mecha
  for (let i = 0; i < 2; i++) {
    if (!board.mechas[i]) continue;
    const m = mecha(i);
    let at = -1;
    for (let k = 0; k < path.length; k++) if (dist(path[k], m) <= MECHA.hit) { at = k; break; }
    if (at >= 0) res.pops.push({ i, at, u: m.u, v: m.v });
  }
  if (res.status === 'off') { res.pops = res.pops.filter((p) => p.at < path.length - 1); }
  // pushing other discs (heavy discs shove, they do not bounce)
  if (res.status !== 'ring' && res.status !== 'off') {
    for (const q of board.discs) {
      const d = dist(pos, q);
      if (d < DISC_R * 2) {
        let nx = q.u - pos.u, ny = q.v - pos.v;
        const nl = Math.hypot(nx, ny);
        if (nl < 0.2) { nx = dx; ny = dy; } else { nx /= nl; ny /= nl; }
        const o = DISC_R * 2 - d;
        const to = { u: q.u + nx * o * 0.75, v: q.v + ny * o * 0.75 };
        res.pushes.push({ id: q.id, from: { u: q.u, v: q.v }, to, off: !onBox(to, DISC_R * 0.25) });
        res.final = { u: res.final.u - nx * o * 0.25, v: res.final.v - ny * o * 0.25 };
      }
    }
  }
  const pops = res.pops.length;
  res.points = (res.ring ? POINTS.ring : 0) + pops * POINTS.pop;
  res.kind = res.ring && pops ? 'monona' : res.ring ? 'ring' : pops ? 'pop' : res.status === 'off' ? 'off' : 'none';
  return res;
}

// Apply a resolved throw to the board (the disc is added unless it dropped in the ring or left the box).
export function applyThrow(board, res) {
  for (const p of res.pops) board.mechas[p.i] = false;
  for (const p of res.pushes) {
    const k = board.discs.findIndex((d) => d.id === p.id);
    if (k < 0) continue;
    if (p.off) board.discs.splice(k, 1); else { board.discs[k].u = p.to.u; board.discs[k].v = p.to.v; }
  }
  let id = 0;
  if (!res.ring && res.status !== 'off' && res.status !== 'short' && res.status !== 'long' && res.status !== 'side') {
    id = board.nextId++;
    board.discs.push({ id, side: res.side, u: res.final.u, v: res.final.v });
  }
  return id;
}

// Who owns the disc nearest the ring? Returns { side, id, d } or null. A tie within 0.05 cm belongs to nobody.
export function closest(board) {
  let best = null, second = Infinity;
  for (const d of board.discs) {
    const r = ringDist(d);
    if (!best || r < best.d) { if (best) second = best.d; best = { side: d.side, id: d.id, d: r }; } else if (r < second) second = r;
  }
  if (best && second - best.d < 0.05) return null;
  return best;
}

// How good a resolved throw is for `side`, for the computer's choices: points now, plus owning the closest disc.
function utility(board, res, side) {
  const b = cloneBoard(board);
  applyThrow(b, res);
  const c = closest(b);
  const lead = !c ? 0 : c.side === side ? 1 : -1;
  return res.points + POINTS.mano * 0.7 * lead;
}

// Candidate marks: a fine grid round the ring and a coarse grid over the whole box.
export function candidates() {
  const out = [];
  for (let v = RING.v - 21; v <= RING.v + 21; v += 3) for (let u = RING.u - 21; u <= RING.u + 21; u += 3) out.push({ u, v });
  for (let v = 16; v <= 92; v += 12) for (let u = 14; u <= 86; u += 12) out.push({ u, v });
  return out;
}

// The computer's choice. Tests `samples` simulated throws per candidate with its OWN scatter and picks the best average.
// `quality` (0..1) narrows how many candidates it looks at, so weaker levels miss the best idea now and then.
export function chooseTarget(board, side, base, seed, { quality = 1, samples = 14, detail = false } = {}) {
  const s = stream(seed ^ 0x9e3779b9);
  let cands = candidates();
  if (quality < 1) cands = cands.filter(() => s.next() < 0.25 + 0.75 * quality);
  let best = null;
  const all = [];
  for (const c of cands) {
    let sum = 0, ring = 0, pop = 0, n = 0, push = 0, off = 0;
    for (let k = 0; k < samples; k++) {
      const r = resolveThrow(board, side, c, base, Math.floor(s.next() * 1e9));
      sum += utility(board, r, side); n++;
      if (r.ring) ring++; if (r.pops.length) pop++; if (r.pushes.length) push++; if (r.status === 'off' || r.status === 'short' || r.status === 'long' || r.status === 'side') off++;
    }
    const e = { u: c.u, v: c.v, value: sum / n, ring: ring / n, pop: pop / n, push: push / n, off: off / n };
    all.push(e);
    if (!best || e.value > best.value) best = e;
  }
  if (!detail) return best;
  all.sort((a, b) => b.value - a.value);
  return { best, top: all.slice(0, 6) };
}

// A plain-words reason for a suggested mark (used by Think and Watch & Learn).
export function explain(e, board) {
  const pc = (x) => `${Math.round(x * 100)}%`;
  const near = Math.hypot(e.u - RING.u, e.v - RING.v);
  let head;
  if (e.ring >= 0.18) head = 'Aim at the ring.';
  else if (e.pop >= 0.3 && near > 3) head = `Aim at the paper mechas on the ${e.v > RING.v + 3 ? 'far' : e.v < RING.v - 3 ? 'near' : e.u > RING.u ? 'right' : 'left'} side of the ring.`;
  else if (e.push >= 0.3) head = 'Aim to shove a disc out of the way.';
  else head = 'Play it close to the ring for the closest disc.';
  const tail = ` In 14 test throws: ${pc(e.ring)} dropped in the ring, ${pc(e.pop)} popped a mecha${e.push >= 0.15 ? `, ${pc(e.push)} moved a disc` : ''}. About ${(Math.round(e.value * 10) / 10).toFixed(1)} points per throw.`;
  return head + tail;
}

// Final score check for a round: the nearest disc earns the closest point.
export function roundBonus(board) {
  const c = closest(board);
  return c && c.d < 60 ? c : null;
}
