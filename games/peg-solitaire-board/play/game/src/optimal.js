// Shortest solutions by bidirectional breadth-first search (a chain of jumps by one peg counts as ONE move, as the rules do).
// Positions are deduplicated up to the 8 symmetries of a square board. Pure and deterministic; used offline to bake the classic routes
// (verify/gen-levels.mjs) and at run time for hints on small positions. Returns { moves, jumps } or null (no route, or state cap hit).
import { keyOf, applyJump, undoJump } from './rules.js';

export function solveOptimal(b, startHoles, { endAt = -1, maxMoves = 40, maxStates = 30e6, sym = true, log = () => {} } = {}) {
  const n = b.n, bitsOf = (key) => { const h = new Array(n).fill(0); const lo = key % 67108864, hi = Math.floor(key / 67108864); for (let i = 0; i < n; i++) h[i] = i < 26 ? (lo >> i) & 1 : (hi >> (i - 26)) & 1; return h; };
  const chains = [], chainId = new Map(); const intern = (c) => { const s = c.join(','); let id = chainId.get(s); if (id === undefined) { id = chains.length; chains.push(c.slice()); chainId.set(s, id); } return id; };
  // symmetry: the 8 symmetries of a square board map holes to holes; positions are deduplicated by their smallest image
  const T = [(x, y) => [x, y], (x, y) => [-x, y], (x, y) => [x, -y], (x, y) => [-x, -y], (x, y) => [y, x], (x, y) => [-y, x], (x, y) => [y, -x], (x, y) => [-y, -x]];
  const perms = b.tri || !sym ? [Array.from({ length: n }, (_, i) => i)] : T.map((f) => b.pos.map((p) => { const [x, y] = f(p.x, p.y); return b.pos.findIndex((q) => Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6); }));
  const canon = (h) => { let best = Infinity; for (const pm of perms) { let lo = 0, hi = 0; for (let i = 0; i < n; i++) if (h[i]) { const j = pm[i]; if (j < 26) lo |= 1 << j; else hi |= 1 << (j - 26); } const k = hi * 67108864 + lo; if (k < best) best = k; } return best; };
  const mk = () => ({ map: new Map(), keys: [], par: [], chain: [], depth: 0, frontier: [] });
  const F = mk(), B = mk(), startKey = keyOf(startHoles);
  const add = (S, key, par, ch, ck) => { const i = S.keys.length; S.keys.push(key); S.par.push(par); S.chain.push(ch); S.map.set(ck ?? canon(bitsOf(key)), i); return i; };
  add(F, startKey, -1, -1); F.frontier = [0];
  const targets = [];
  for (let i = 0; i < n; i++) if (endAt < 0 || endAt === i) { const h = new Array(n).fill(0); h[i] = 1; targets.push(keyOf(h)); }
  for (const k of targets) add(B, k, -1, -1); B.frontier = targets.map((_, i) => i);
  let best = Infinity, bestMeet = null;
  const tryMeet = (S, O, idx, dNew) => { const k = S.keys[idx], j = O.map.get(k); if (j === undefined) return; const tot = dNew + depthOf(O, j); if (tot < best) { best = tot; bestMeet = S === F ? [idx, j] : [j, idx]; } };
  const depthOf = (S, i) => { let d = 0; while (S.par[i] >= 0) { i = S.par[i]; d++; } return d; };
  // depth of each state is implied by its level: keep a parallel array
  F.dep = [0]; B.dep = targets.map(() => 0);
  const depthOf2 = (S, i) => S.dep[i];
  const meet = (S, O, idx, dNew, ck) => { const j = O.map.get(ck); if (j === undefined) return; const tot = dNew + depthOf2(O, j); if (tot < best) { best = tot; bestMeet = S === F ? [idx, j] : [j, idx]; } };
  // forward expansion: every prefix of every chain of jumps by one peg
  const expandF = (S, O) => {
    const next = [];
    for (const si of S.frontier) {
      const h = bitsOf(S.keys[si]), d = S.dep[si] + 1;
      const walk = (peg, chain) => {
        for (const j of b.byFrom[peg]) if (h[j.over] && !h[j.to]) {
          applyJump(h, j); chain.push(b.jumps.indexOf(j));
          const k = keyOf(h);
          const ck = canon(h); if (!S.map.has(ck)) { const i = add(S, k, si, intern(chain), ck); S.dep[i] = d; next.push(i); meet(S, O, i, d, ck); }
          walk(j.to, chain);
          chain.pop(); undoJump(h, j);
        }
      };
      for (let p = 0; p < n; p++) if (h[p]) walk(p, []);
    }
    S.frontier = next;
  };
  // backward expansion: reverse jumps (peg goes to -> from, a peg appears in over)
  const expandB = (S, O) => {
    const next = [];
    for (const si of S.frontier) {
      const h = bitsOf(S.keys[si]), d = S.dep[si] + 1;
      const walk = (peg, chain) => {   // peg currently at `peg` (the last jump's origin side); reverse jumps move it further back
        for (const j of b.byFrom[peg]) { /* j.from === peg: a forward jump peg->j.to ; the reverse of a forward jump a->c is: peg at c goes back to a */ }
        for (const j of b.jumps) if (j.to === peg && h[peg] && !h[j.from] && !h[j.over]) {
          undoJump(h, j); chain.push(b.jumps.indexOf(j));       // undoJump: from=1, over=1, to=0  (the state before the forward jump)
          const k = keyOf(h);
          const ck = canon(h); if (!S.map.has(ck)) { const i = add(S, k, si, intern(chain), ck); S.dep[i] = d; next.push(i); meet(S, O, i, d, ck); }
          walk(j.from, chain);
          chain.pop(); applyJump(h, j);
        }
      };
      for (let p = 0; p < n; p++) if (h[p]) walk(p, []);
    }
    S.frontier = next;
  };
  let dF = 0, dB = 0;
  while (best > dF + dB + 1 && dF + dB < maxMoves && F.keys.length + B.keys.length < maxStates) {
    if (F.frontier.length <= B.frontier.length) { expandF(F, B); dF++; } else { expandB(B, F); dB++; }
    log(`depth F${dF} B${dB} states F${F.keys.length} B${B.keys.length} best ${best}`);
    if (!F.frontier.length && !B.frontier.length) break;
  }
  if (!bestMeet) return null;
  // rebuild: forward part (start -> meet) and backward part (meet -> a single peg)
  const out = [];
  const fpath = []; for (let i = bestMeet[0]; F.par[i] >= 0; i = F.par[i]) fpath.push(chains[F.chain[i]]); fpath.reverse();
  for (const ch of fpath) for (const ji of ch) out.push(b.jumps[ji]);
  // backward chain entries were recorded as reverse sequences: the stored list is in reverse-jump order; the forward order is the reverse of it
  const P = bitsOf(F.keys[bestMeet[0]]), Q = bitsOf(B.keys[bestMeet[1]]);
  let sigma = perms.find((pm) => { for (let i = 0; i < n; i++) if (P[i] !== Q[pm[i]]) return false; return true; }), inv = new Array(n);
  perms.forEach(() => {}); for (let i = 0; i < n; i++) inv[sigma[i]] = i;           // Q = sigma(P): a jump of the backward path at Q-holes maps back to P-holes through inv
  const jmap = new Map(b.jumps.map((j) => [`${j.from},${j.over},${j.to}`, j]));
  for (let i = bestMeet[1]; B.par[i] >= 0; i = B.par[i]) { const ch = chains[B.chain[i]].slice().reverse(); for (const ji of ch) { const j = b.jumps[ji]; out.push(jmap.get(`${inv[j.from]},${inv[j.over]},${inv[j.to]}`)); } }
  return { moves: best, jumps: out };
}


// Beam search for the shortest route when the exact search is too big (French board): each level keeps the `width` positions with the fewest pegs
// (ties: pegs closest to the middle), every chain prefix counts as one move. Not a proof of optimality; returns { moves, jumps } or null.
export function solveBeam(b, startHoles, { endAt = -1, width = 200000, maxMoves = 40, log = () => {} } = {}) {
  const n = b.n;
  const T = [(x, y) => [x, y], (x, y) => [-x, y], (x, y) => [x, -y], (x, y) => [-x, -y], (x, y) => [y, x], (x, y) => [-y, x], (x, y) => [y, -x], (x, y) => [-y, -x]];
  const perms = b.tri ? [Array.from({ length: n }, (_, i) => i)] : T.map((f) => b.pos.map((p) => { const [x, y] = f(p.x, p.y); return b.pos.findIndex((q) => Math.abs(q.x - x) < 1e-6 && Math.abs(q.y - y) < 1e-6); }));
  // with a fixed end hole only symmetries that keep the start hole AND the end hole are valid for merging; use the identity when they differ
  const startEmpty = startHoles.indexOf(0);
  const ok = perms.filter((pm) => pm[startEmpty] === startEmpty && (endAt < 0 || pm[endAt] === endAt));
  const canon = (h) => { let best = Infinity; for (const pm of ok) { let lo = 0, hi = 0; for (let i = 0; i < n; i++) if (h[i]) { const j = pm[i]; if (j < 26) lo |= 1 << j; else hi |= 1 << (j - 26); } const k = hi * 67108864 + lo; if (k < best) best = k; } return best; };
  const cen = b.pos.map((p) => p.x * p.x + p.y * p.y);
  const seen = new Set([canon(startHoles)]);
  let level = [{ h: startHoles.slice(), par: null, jumps: null, pegs: startHoles.reduce((a, c) => a + c, 0) }];
  for (let d = 1; d <= maxMoves; d++) {
    const next = [];
    for (const node of level) {
      const h = node.h;
      const walk = (peg, chain) => {
        for (const j of b.byFrom[peg]) if (h[j.over] && !h[j.to]) {
          applyJump(h, j); chain.push(j);
          const ck = canon(h);
          if (!seen.has(ck)) { seen.add(ck); next.push({ h: h.slice(), par: node, jumps: chain.slice(), pegs: node.pegs - chain.length }); }
          walk(j.to, chain); chain.pop(); undoJump(h, j);
        }
      };
      for (let p = 0; p < n; p++) if (h[p]) walk(p, []);
    }
    const win = next.find((s) => s.pegs === 1 && (endAt < 0 || s.h[endAt] === 1));
    if (win) { const out = []; for (let s = win; s.par; s = s.par) out.unshift(...s.jumps); return { moves: d, jumps: out }; }
    for (const s of next) { s.score = s.pegs * 1000; for (let i = 0; i < n; i++) if (s.h[i]) s.score += cen[i]; }
    next.sort((a, b2) => a.score - b2.score);
    level = next.slice(0, width); log(`move ${d}: ${next.length} candidates, kept ${level.length}, best pegs ${level[0]?.pegs}`);
    if (!level.length) return null;
  }
  return null;
}
