// THE RULE BOOK for Okey. Pure and deterministic; the AI (ai.js), the rack helpers and the Rules page all lean
// on this one file, so there is exactly one source of truth for what counts as a legal set.
//
// Tiles: ids 0..103 are the 104 numbered tiles (two copies of 1..13 in four colours), 104 and 105 are the two
// false okeys. id = copy*52 + colour*13 + (number-1). The deal turns up one numbered tile (the indicator); the
// OKEY is the same colour, one number higher (13 wraps to 1). The two real tiles of that identity are WILD.
// A false okey is not wild: it stands for the okey tile itself (its face value).
export const COLORS = 4;
export const FAKE_A = 104, FAKE_B = 105;
export const TILE_COUNT = 106;
export const COLOR_NAMES = ['Red', 'Blue', 'Black', 'Yellow'];
export const COLOR_NAMES_TR = ['Kırmızı', 'Mavi', 'Siyah', 'Sarı'];
export const isFake = (id) => id >= 104;
export const colorOf = (id) => (id >= 104 ? -1 : Math.floor((id % 52) / 13));
export const numOf = (id) => (id >= 104 ? 0 : (id % 13) + 1);
export const keyOf = (c, n) => c * 13 + (n - 1); // identity key 0..51
export const makeId = (copy, c, n) => copy * 52 + c * 13 + (n - 1);

export const okeyFor = (indicator) => {
  const c = colorOf(indicator), n = numOf(indicator);
  return { c, n: n === 13 ? 1 : n + 1, key: keyOf(c, n === 13 ? 1 : n + 1) };
};
// Wild = one of the two real tiles with the okey's identity.
export const isWild = (id, okey) => id < 104 && colorOf(id) === okey.c && numOf(id) === okey.n;
// Face identity used for melds when a tile is not wild (a false okey wears the okey's face).
export const faceKey = (id, okey) => (id >= 104 ? okey.key : keyOf(colorOf(id), numOf(id)));
export const faceColor = (id, okey) => (id >= 104 ? okey.c : colorOf(id));
export const faceNum = (id, okey) => (id >= 104 ? okey.n : numOf(id));
export const tileName = (id, okey, tr = false) => {
  if (isFake(id)) return tr ? 'Sahte okey' : 'False okey';
  const names = tr ? COLOR_NAMES_TR : COLOR_NAMES;
  return `${names[colorOf(id)]} ${numOf(id)}`;
};
export const keyName = (k, tr = false) => `${(tr ? COLOR_NAMES_TR : COLOR_NAMES)[Math.floor(k / 13)]} ${(k % 13) + 1}`;

// ---------------------------------------------------------------------------------------------------------
// Meld validation (a set of tiles that is already grouped by the player)
// ---------------------------------------------------------------------------------------------------------
// A GROUP: 3 or 4 tiles, same number, all different colours. A RUN: 3+ tiles, same colour, consecutive
// numbers; 1 may follow 13 (12-13-1 is legal) but a run never wraps further (13-1-2 is not). Wilds fill any gap
// or either end.
export function isMeld(ids, okey) {
  const L = ids.length;
  if (L < 3) return false;
  const real = [];
  let w = 0;
  for (const id of ids) { if (isWild(id, okey)) w++; else real.push(id); }
  if (real.length === 0) return true; // three or more wilds
  // group?
  if (L <= 4) {
    const n0 = faceNum(real[0], okey);
    const seen = new Set();
    let ok = true;
    for (const id of real) { const c = faceColor(id, okey); if (faceNum(id, okey) !== n0 || seen.has(c)) { ok = false; break; } seen.add(c); }
    if (ok) return true;
  }
  // run?
  if (L > 13) return false;
  const c0 = faceColor(real[0], okey);
  for (const id of real) if (faceColor(id, okey) !== c0) return false;
  const nums = real.map((id) => faceNum(id, okey));
  const variants = [nums];
  if (nums.includes(1)) variants.push(nums.map((n) => (n === 1 ? 14 : n)));
  for (const v of variants) {
    const s = [...v].sort((a, b) => a - b);
    let dup = false;
    for (let i = 1; i < s.length; i++) if (s[i] === s[i - 1]) dup = true;
    if (dup) continue;
    const span = s[s.length - 1] - s[0] + 1;
    if (span > L) continue; // wilds can only extend, never shrink
    const gaps = span - s.length;
    if (gaps > w) continue;
    // a window of length L containing [min, max] inside 1..14 (never 1 and 14 together: L <= 13)
    const lo = Math.max(1, s[s.length - 1] - L + 1), hi = Math.min(s[0], 14 - L + 1);
    if (lo <= hi) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------
// Search: partition a hand into melds. One DFS serves two jobs.
//   cover mode: maximise tiles inside COMPLETE melds (win check, Smart arrange)
//   value mode: the AI's evaluation, which also credits partial melds by how likely they are to complete
// ---------------------------------------------------------------------------------------------------------
const loneValue = (n) => 0.1 + 0.04 * Math.min(n, 14 - n);

function partialValue(outs) {
  return 0.55 + 0.22 * Math.min(outs, 4); // per tile, so a pair is worth 2x this
}

function search(cnt, w, ctx, memo) {
  let k = 0;
  while (k < 52 && cnt[k] === 0) k++;
  if (k === 52) {
    if (w >= 3) return { v: 3 * w, specs: [{ t: 'wilds', n: w }] };
    return { v: ctx.value ? 2.6 * w : 0, specs: [], leftW: w };
  }
  const mk = cnt.join('') + w;
  const hit = memo.get(mk);
  if (hit) return hit;
  const c = Math.floor(k / 13), n = (k % 13) + 1;
  let best = null;
  const consider = (own, spec, sub) => {
    const v = own + sub.v;
    if (!best || v > best.v + 1e-9) best = { v, specs: [spec, ...sub.specs], leftW: sub.leftW };
  };

  // --- runs containing this tile ---
  const ps = n === 1 ? [1, 14] : [n];
  for (const p of ps) {
    for (let s = Math.max(1, p - 12); s <= p; s++) {
      for (let e = Math.max(p, s + 2); e <= Math.min(14, s + 12); e++) {
        let missing = 0, ok = true;
        const realKeys = [];
        for (let q = s; q <= e; q++) {
          const nq = q === 14 ? 1 : q;
          const kk = c * 13 + nq - 1;
          if (cnt[kk] > 0) realKeys.push(kk); else missing++;
        }
        if (missing > w) ok = false;
        if (!ok) continue;
        // dedupe: a leading wild is the same tile-usage as a trailing one unless the window touches 14
        const firstK = c * 13 + (s === 14 ? 1 : s) - 1;
        if (cnt[firstK] === 0 && e < 14) continue;
        // positions 1 and 14 can both appear only in a 14-long window, which the loop bounds exclude
        for (const kk of realKeys) cnt[kk]--;
        const sub = search(cnt, w - missing, ctx, memo);
        for (const kk of realKeys) cnt[kk]++;
        consider(3 * (e - s + 1), { t: 'run', c, s, e, keys: realKeys.slice(), wilds: missing }, sub);
      }
    }
  }

  // --- groups containing this tile ---
  const others = [];
  for (let oc = 0; oc < 4; oc++) if (oc !== c && cnt[oc * 13 + n - 1] > 0) others.push(oc * 13 + n - 1);
  for (let mask = 0; mask < 1 << others.length; mask++) {
    const pick = [k];
    for (let b = 0; b < others.length; b++) if (mask & (1 << b)) pick.push(others[b]);
    for (let j = Math.max(0, 3 - pick.length); j <= 4 - pick.length; j++) {
      if (j > w || pick.length + j < 3) continue;
      for (const kk of pick) cnt[kk]--;
      const sub = search(cnt, w - j, ctx, memo);
      for (const kk of pick) cnt[kk]++;
      consider(3 * (pick.length + j), { t: 'group', keys: pick, wilds: j }, sub);
    }
  }

  if (ctx.value) {
    const un = ctx.unseen;
    const u = (kk) => (un ? Math.max(0, un[kk]) : 2);
    // --- partial runs ---
    for (const d of [1, 2]) {
      if (n + d > 13) continue;
      const k2 = k + d;
      if (cnt[k2] === 0) continue;
      let outs = 0;
      if (d === 1) {
        if (n > 1) outs += u(k - 1);
        else outs += 0;
        if (n + 1 < 13) outs += u(k + 2); else if (n + 1 === 13) outs += u(c * 13); // 12-13 takes a high 1
        if (n === 1) outs += 0;
      } else outs = u(k + 1);
      cnt[k] -= 1; cnt[k2] -= 1;
      const sub = search(cnt, w, ctx, memo);
      cnt[k] += 1; cnt[k2] += 1;
      consider(2 * partialValue(outs) * (d === 2 ? 0.9 : 1), { t: 'prun', keys: [k, k2] }, sub);
    }
    // --- partial group ---
    for (const kk of others) {
      let outs = 0;
      for (let oc = 0; oc < 4; oc++) { const k3 = oc * 13 + n - 1; if (k3 !== k && k3 !== kk && Math.floor(k3 / 13) !== c && Math.floor(k3 / 13) !== Math.floor(kk / 13)) outs += u(k3); }
      cnt[k]--; cnt[kk]--;
      const sub = search(cnt, w, ctx, memo);
      cnt[k]++; cnt[kk]++;
      consider(2 * partialValue(outs) * 0.95, { t: 'pgroup', keys: [k, kk] }, sub);
    }
    // a lone tile that has an identical twin is worth a little more (seven-pairs potential)
  }

  // --- leave this tile on its own ---
  cnt[k]--;
  const sub = search(cnt, w, ctx, memo);
  cnt[k]++;
  consider(ctx.value ? loneValue(n) : 0, { t: 'lone', keys: [k] }, sub);

  memo.set(mk, best);
  return best;
}

function prepare(ids, okey) {
  const cnt = new Array(52).fill(0), pool = [];
  for (let i = 0; i < 52; i++) pool.push([]);
  const wilds = [];
  for (const id of ids) {
    if (isWild(id, okey)) wilds.push(id);
    else { const k = faceKey(id, okey); cnt[k]++; pool[k].push(id); }
  }
  return { cnt, pool, wilds };
}

// Turn the abstract specs back into concrete tile ids.
function assemble(specs, pool, wilds) {
  const melds = [], lone = [];
  const wp = wilds.slice();
  for (const sp of specs) {
    if (sp.t === 'lone') { lone.push(pool[sp.keys[0]].pop()); continue; }
    if (sp.t === 'wilds') { const g = []; for (let i = 0; i < sp.n; i++) g.push(wp.pop()); melds.push({ type: 'wilds', ids: g }); continue; }
    if (sp.t === 'run' || sp.t === 'group') {
      const g = [];
      for (const kk of sp.keys) g.push(pool[kk].pop());
      for (let i = 0; i < sp.wilds; i++) g.push(wp.pop());
      if (sp.t === 'run') { // order by position so the rack shows 5-6-7, wilds filling their gap
        const order = [];
        const real = g.slice(0, sp.keys.length), ws = g.slice(sp.keys.length);
        for (let q = sp.s; q <= sp.e; q++) {
          const nq = q === 14 ? 1 : q, kk = sp.c * 13 + nq - 1;
          const i = sp.keys.indexOf(kk);
          if (i >= 0 && real[i] !== undefined && !order.includes(real[i])) order.push(real[i]); else order.push(ws.pop());
        }
        melds.push({ type: 'run', ids: order.filter((x) => x !== undefined) });
      } else melds.push({ type: 'group', ids: g });
      continue;
    }
    // partials count as "near melds" for arranging, kept as their own chunk
    const g = sp.keys.map((kk) => pool[kk].pop());
    melds.push({ type: sp.t, ids: g });
  }
  for (const id of wp) lone.push(id);
  return { melds, lone };
}

// Best partition of `ids` into COMPLETE melds. Returns { melds, lone, covered, total, win }.
export function solveHand(ids, okey) {
  const { cnt, pool, wilds } = prepare(ids, okey);
  const res = search(cnt, wilds.length, { value: false }, new Map());
  const { melds, lone } = assemble(res.specs, pool, wilds);
  const covered = melds.reduce((a, m) => a + m.ids.length, 0);
  return { melds, lone, covered, total: ids.length, win: lone.length === 0 && ids.length > 0 };
}

// The AI's view: best arrangement counting near-melds. `unseen` (53 entries) weights near-melds by their outs.
export function solveValue(ids, okey, unseen = null, memo = null) {
  const { cnt, pool, wilds } = prepare(ids, okey);
  const res = search(cnt, wilds.length, { value: true, unseen }, memo ?? new Map());
  const { melds, lone } = assemble(res.specs, pool, wilds);
  return { melds, lone, value: res.v, specs: res.specs, covered: 0, total: ids.length, win: false };
}
// Same, but value only (cheap) and sharing a memo across related evaluations.
export function valueOf(ids, okey, unseen, memo) {
  const { cnt, wilds } = prepare(ids, okey);
  return search(cnt, wilds.length, { value: true, unseen }, memo).v;
}
export function valueOfCounts(cnt, w, unseen, memo) {
  return search(cnt, w, { value: true, unseen }, memo).v;
}

export function canWinSets(ids, okey) {
  if (ids.length !== 14) return false;
  const { cnt, wilds } = prepare(ids, okey);
  const res = search(cnt, wilds.length, { value: false }, new Map());
  return Math.round(res.v) === 42;
}

// Seven pairs: every tile has an identical twin (a wild stands for any partner).
export function canWinPairs(ids, okey) {
  if (ids.length !== 14) return false;
  const cnt = new Array(52).fill(0);
  let w = 0;
  for (const id of ids) { if (isWild(id, okey)) w++; else cnt[faceKey(id, okey)]++; }
  let singles = 0;
  for (let k = 0; k < 52; k++) singles += cnt[k] % 2;
  return singles <= w;
}

// Which discard (if any) finishes this 15-tile hand? Returns [{ id, pairs, okeyDiscard, mult }] best first.
export function finishingDiscards(hand15, okey) {
  const out = [];
  const tried = new Set();
  for (const id of hand15) {
    // identical-looking tiles give identical answers
    const sig = isWild(id, okey) ? 'w' : isFake(id) ? 'f' : String(faceKey(id, okey));
    if (tried.has(sig)) continue;
    tried.add(sig);
    const rest = hand15.filter((x) => x !== id);
    const pairs = canWinPairs(rest, okey);
    const sets = canWinSets(rest, okey);
    if (!pairs && !sets) continue;
    const okeyDiscard = isWild(id, okey);
    out.push({ id, pairs, okeyDiscard, mult: (pairs ? 2 : 1) * (okeyDiscard ? 2 : 1) });
  }
  // a wild tile in the hand that is also a legal finishing discard may hide behind an identical sibling; make sure
  // the okey-discard route is considered when any wild is present
  out.sort((a, b) => b.mult - a.mult);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// The deal
// ---------------------------------------------------------------------------------------------------------
export const SEATS = 4;
export const nextSeat = (s) => (s + 1) % 4;
export const prevSeat = (s) => (s + 3) % 4; // the left-hand neighbour whose pile you may take from

export function newDeal(rng, starter) {
  const order = rng.shuffle(Array.from({ length: TILE_COUNT }, (_, i) => i));
  const ix = order.findIndex((id) => !isFake(id));
  const indicator = order.splice(ix, 1)[0];
  const okey = okeyFor(indicator);
  const hands = [[], [], [], []];
  for (let s = 0; s < 4; s++) {
    const count = s === starter ? 15 : 14;
    for (let i = 0; i < count; i++) hands[s].push(order.pop());
  }
  const pileCount = new Array(53).fill(0);
  const held = [0, 1, 2, 3].map(() => new Array(53).fill(0));
  return {
    indicator, okey, stack: order, hands, piles: [[], [], [], []],
    turn: starter, starter, phase: 'discard', // the starter holds 15 and must discard first
    pileCount, held, discards: [], // discards: chronological {seat,id}
    takes: [[], [], [], []], // tiles each seat took from a pile (face keys), for the AI's reading
    result: null, turns: 0,
  };
}

export const handOf = (d, s) => d.hands[s];
const removeId = (arr, id) => { const i = arr.indexOf(id); if (i >= 0) arr.splice(i, 1); return i >= 0; };
const pubKey = (d, id) => (isWild(id, d.okey) ? 52 : faceKey(id, d.okey));

export function drawStack(d, seat) {
  if (d.phase !== 'draw' || d.turn !== seat || d.stack.length === 0) return null;
  const id = d.stack.pop();
  d.hands[seat].push(id);
  d.phase = 'discard';
  return id;
}

export function takePile(d, seat) {
  const from = prevSeat(seat);
  if (d.phase !== 'draw' || d.turn !== seat || d.piles[from].length === 0) return null;
  const id = d.piles[from].pop();
  d.hands[seat].push(id);
  d.phase = 'discard';
  const k = pubKey(d, id);
  d.pileCount[k]--; d.held[seat][k]++; d.takes[seat].push(k);
  return id;
}

// Discard a tile. Returns { id, won, pairs, okeyDiscard, mult } (won only when the remaining 14 are a complete rack).
export function discard(d, seat, id) {
  if (d.phase !== 'discard' || d.turn !== seat || !d.hands[seat].includes(id)) return null;
  removeId(d.hands[seat], id);
  const k = pubKey(d, id);
  if (d.held[seat][k] > 0) d.held[seat][k]--;
  const hand = d.hands[seat];
  const pairs = canWinPairs(hand, d.okey), sets = canWinSets(hand, d.okey);
  const won = pairs || sets;
  if (won) {
    const okeyDiscard = isWild(id, d.okey);
    d.result = { winner: seat, pairs, okeyDiscard, mult: (pairs ? 2 : 1) * (okeyDiscard ? 2 : 1), finalTile: id };
    d.phase = 'over';
    d.discards.push({ seat, id });
    d.finalDiscard = { seat, id };
    return { id, won: true, ...d.result };
  }
  d.piles[seat].push(id);
  d.pileCount[k]++;
  d.discards.push({ seat, id });
  d.turn = nextSeat(seat);
  d.phase = 'draw';
  d.turns++;
  if (d.stack.length === 0) { d.result = { winner: -1, drawn: true }; d.phase = 'over'; }
  return { id, won: false };
}

// ---------------------------------------------------------------------------------------------------------
// Scoring (score only): the finisher scores +3x, each opponent -x, with x = 2 times the multipliers.
// ---------------------------------------------------------------------------------------------------------
export const BASE_POINTS = 2;
export function dealScores(result) {
  const s = [0, 0, 0, 0];
  if (!result || result.winner < 0) return s;
  const x = BASE_POINTS * result.mult;
  for (let i = 0; i < 4; i++) s[i] = i === result.winner ? 3 * x : -x;
  return s;
}

// What the AI is allowed to know about unseen tiles for `seat`: copies minus everything it can see. Index 52 = wilds.
export function unseenCounts(d, seat) {
  const un = new Array(53).fill(2);
  un[d.okey.key] = 1; // only the false okey wears this face
  un[keyOf(colorOf(d.indicator), numOf(d.indicator))] -= 1;
  for (let k = 0; k < 53; k++) {
    un[k] -= d.pileCount[k];
    for (let s = 0; s < 4; s++) if (s !== seat) un[k] -= d.held[s][k];
  }
  for (const id of d.hands[seat]) un[isWild(id, d.okey) ? 52 : faceKey(id, d.okey)]--;
  for (let k = 0; k < 53; k++) if (un[k] < 0) un[k] = 0;
  return un;
}

// ---------------------------------------------------------------------------------------------------------
// Rack helpers: the rack has 2 rows x 10 slots; slots hold a tile id or -1.
// ---------------------------------------------------------------------------------------------------------
export const RACK_COLS = 10, RACK_ROWS = 2, RACK_SLOTS = 20;
export const emptyRack = () => new Array(RACK_SLOTS).fill(-1);

// Lay chunks (arrays of ids) onto the rack with one empty slot between chunks. A first-fit-decreasing packing keeps
// every chunk whole inside one row; loose tiles (chunk.loose) may be split across the space that is left over.
const rowUse = (row) => row.reduce((a, c) => a + c.ids.length, 0) + Math.max(0, row.length - 1);
function packRows(chunks) {
  const items = chunks.filter((c) => c.length).map((ids, i) => ({ ids: ids.slice(), i, loose: !!chunks[chunks.indexOf(ids)]?.loose }));
  const order = items.slice().sort((a, b) => (a.loose - b.loose) || b.ids.length - a.ids.length || a.i - b.i);
  const rows = [[], []];
  for (const it of order) {
    let placed = false;
    for (const row of rows) {
      if (rowUse(row) + (row.length ? 1 : 0) + it.ids.length <= RACK_COLS) { row.push(it); placed = true; break; }
    }
    if (placed) continue;
    if (!it.loose) return null;
    // split loose tiles across whatever room is left in each row
    let rest = it.ids.slice();
    for (const row of rows) {
      const room = RACK_COLS - rowUse(row) - (row.length ? 1 : 0);
      if (room > 0 && rest.length) { const take = rest.splice(0, room); row.push({ ids: take, i: it.i, loose: true }); }
    }
    if (rest.length) return null;
  }
  return rows;
}
export function layoutChunks(chunks) {
  const rack = emptyRack();
  const rows = packRows(chunks);
  if (rows) {
    rows.forEach((row, r) => {
      let col = 0;
      for (const it of row.slice().sort((a, b) => a.i - b.i)) {
        if (col > 0) col++;
        for (const id of it.ids) rack[r * RACK_COLS + col++] = id;
      }
    });
    return rack;
  }
  // emergency: no gaps, just fill
  const all = chunks.flat();
  all.forEach((id, i) => { if (i < RACK_SLOTS) rack[i] = id; });
  return rack;
}

const sortIds = (ids, okey, mode) => ids.slice().sort((a, b) => {
  const wa = isWild(a, okey) ? 1 : 0, wb = isWild(b, okey) ? 1 : 0;
  if (wa !== wb) return wb - wa; // wilds first
  const ca = faceColor(a, okey), cb = faceColor(b, okey), na = faceNum(a, okey), nb = faceNum(b, okey);
  if (mode === 'color') return ca - cb || na - nb || a - b;
  return na - nb || ca - cb || a - b;
});

export function sortedChunks(ids, okey, mode) {
  const s = sortIds(ids, okey, mode);
  const chunks = [];
  let cur = [];
  const same = (a, b) => (mode === 'color' ? faceColor(a, okey) === faceColor(b, okey) : faceNum(a, okey) === faceNum(b, okey)) && !isWild(a, okey) && !isWild(b, okey);
  for (const id of s) {
    if (cur.length && !same(cur[cur.length - 1], id)) { chunks.push(cur); cur = []; }
    cur.push(id);
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// Sort-by-colour / sort-by-number rack layouts. Wilds go first.
export function sortRack(ids, okey, mode) {
  const chunks = sortedChunks(ids, okey, mode);
  // wilds chunk is its own chunk (first)
  const wild = chunks.filter((c) => isWild(c[0], okey)), rest = chunks.filter((c) => !isWild(c[0], okey));
  const wl = wild.flat();
  const out = [];
  if (wl.length) out.push(wl);
  // merge tiny chunks of the same row when they would waste a gap? keep simple: one chunk per colour/number
  for (const c of rest) out.push(c);
  return layoutChunks(out);
}

// Smart arrange: complete melds first (each its own chunk), then near-melds, then single tiles.
export function smartRack(ids, okey, valueSolver) {
  const sol = valueSolver ? valueSolver(ids, okey) : solveHand(ids, okey);
  const chunks = [];
  const wilds = [];
  for (const m of sol.melds) {
    if (m.type === 'wilds') { wilds.push(...m.ids); continue; }
    if (m.type === 'run' || m.type === 'group') chunks.push(m.ids);
  }
  const near = [];
  for (const m of sol.melds) if (m.type === 'prun' || m.type === 'pgroup') near.push(m.ids);
  const loose = sortIds(sol.lone, okey, 'color');
  if (wilds.length) chunks.unshift(wilds);
  // melds in order of colour then number
  const complete = chunks.filter((c) => c.length >= 3);
  if (loose.length) loose.loose = true;
  const arranged = [...complete, ...near, loose.length ? loose : null].filter(Boolean);
  return layoutChunks(arranged);
}

// Contiguous groups of tiles on the rack (a gap = empty slot; rows are separate). Returns [{ slots, ids, valid }].
export function rackChunks(rack, okey) {
  const out = [];
  for (let r = 0; r < RACK_ROWS; r++) {
    let cur = [];
    const flush = () => { if (cur.length) { const ids = cur.map((s) => rack[s]); out.push({ slots: cur, ids, valid: isMeld(ids, okey) }); cur = []; } };
    for (let c = 0; c < RACK_COLS; c++) {
      const s = r * RACK_COLS + c;
      if (rack[s] >= 0) cur.push(s); else flush();
    }
    flush();
  }
  return out;
}

// Move/insert a tile on the rack: drop `id` on slot `to`. If the slot is taken, push neighbours aside toward the
// nearest empty slot in the same row; if the row is full, swap.
export function moveOnRack(rack, id, to) {
  const r = rack.slice();
  const from = r.indexOf(id);
  if (from < 0 || to < 0 || to >= RACK_SLOTS || from === to) return r;
  r[from] = -1;
  if (r[to] < 0) { r[to] = id; return r; }
  const row = Math.floor(to / RACK_COLS), lo = row * RACK_COLS, hi = lo + RACK_COLS - 1;
  let left = -1, right = -1;
  for (let i = to - 1; i >= lo; i--) if (r[i] < 0) { left = i; break; }
  for (let i = to + 1; i <= hi; i++) if (r[i] < 0) { right = i; break; }
  const dl = left < 0 ? 99 : to - left, dr = right < 0 ? 99 : right - to;
  if (dl === 99 && dr === 99) { // row full: swap
    r[from] = r[to]; r[to] = id; return r;
  }
  if (dr <= dl) { for (let i = right; i > to; i--) r[i] = r[i - 1]; } else { for (let i = left; i < to; i++) r[i] = r[i + 1]; }
  r[to] = id;
  return r;
}

export function placeNewTile(rack, id) {
  const r = rack.slice();
  // the new tile lands just after the last tile of the lower row (so it is easy to spot), else any free slot
  let last = -1;
  for (let i = RACK_SLOTS - 1; i >= RACK_COLS; i--) if (r[i] >= 0) { last = i; break; }
  const cand = last + 2 < RACK_SLOTS ? last + 2 : -1; // leave a gap so it reads as "new"
  if (last >= 0 && cand > 0 && r[cand] < 0) { r[cand] = id; return r; }
  if (last >= 0 && last + 1 < RACK_SLOTS && r[last + 1] < 0) { r[last + 1] = id; return r; }
  if (last < 0) { r[RACK_COLS + 1] = id; return r; }
  const free = r.indexOf(-1);
  if (free >= 0) r[free] = id;
  return r;
}

// Reconcile the rack with the hand (tiles added/removed by the engine).
export function syncRack(rack, hand, okey) {
  let r = rack.map((id) => (id >= 0 && hand.includes(id) ? id : -1));
  for (const id of hand) if (!r.includes(id)) r = placeNewTile(r, id);
  return r;
}
