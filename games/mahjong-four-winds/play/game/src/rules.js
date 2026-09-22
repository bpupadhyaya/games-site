// Mahjong rule book (Hong Kong style). Pure and deterministic. Nothing here draws or reads the clock.
//
// TILES. 144 tile instances (ids 0..143), 42 kinds:
//   0-8 Characters (wan)  9-17 Bamboo  18-26 Dots  27-30 winds E S W N  31-33 dragons Red Green White
//   34-37 flowers (Plum Orchid Chrysanthemum Bamboo)   38-41 seasons (Spring Summer Autumn Winter)
// Four copies of each of the 34 playing kinds, plus one each of the 8 bonus tiles.
//
// SEATS. Seat 0 is the human at the bottom; play runs 0 -> 1 -> 2 -> 3 (counter-clockwise: 1 is on your right,
// 2 across, 3 on your left). You may take a chow only from the player before you (seat p-1).
//
// THE RULES IN THIS BOOK (kept in step with design/GDD.md):
//  - A hand is 13 tiles. You draw one and discard one. Win = 4 sets + a pair (14 tiles), or Thirteen Orphans.
//  - Sets: chow (3 in a row, one suit), pung (3 alike), kong (4 alike, replaced by a tile from the back of the wall).
//  - Claim a discard: win > pung/kong (any seat) > chow (next seat only). Two winners: the one nearest after the discarder.
//  - Bonus tiles (flowers, seasons) are set aside on draw and replaced from the back of the wall.
//  - A win needs at least `minFan` fan. Points come from a fan table (see POINTS). Score only: no stakes of any kind.
//  - The live wall ends when only 14 tiles remain: an exhausted draw, dealer stays.

export const RESERVE = 14;
export const POINTS = [0, 1, 2, 4, 8, 16, 24, 32, 48, 64, 64];   // index = fan, capped at 10 (a limit hand)
export const LIMIT = 10;

export const kindOf = (t) => (t < 108 ? t >> 2 : t < 124 ? 27 + ((t - 108) >> 2) : t < 136 ? 31 + ((t - 124) >> 2) : 34 + (t - 136));
export const suitOf = (k) => (k < 9 ? 0 : k < 18 ? 1 : k < 27 ? 2 : k < 31 ? 3 : k < 34 ? 4 : 5);   // 0..2 number suits, 3 wind, 4 dragon, 5 bonus
export const rankOf = (k) => (k < 27 ? k % 9 : k < 31 ? k - 27 : k < 34 ? k - 31 : k >= 38 ? k - 38 : k - 34);
export const isBonus = (k) => k >= 34;
export const isHonor = (k) => k >= 27 && k < 34;
export const isTerminal = (k) => k < 27 && (k % 9 === 0 || k % 9 === 8);
export const SUIT_NAME = ['Characters', 'Bamboo', 'Dots'];
const WIND = ['East', 'South', 'West', 'North'], DRAGON = ['Red', 'Green', 'White'];
const FLOWER = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'], SEASON = ['Spring', 'Summer', 'Autumn', 'Winter'];
export function kindName(k) {
  if (k < 27) return `${(k % 9) + 1} of ${SUIT_NAME[Math.floor(k / 9)]}`;
  if (k < 31) return `${WIND[k - 27]} Wind`;
  if (k < 34) return `${DRAGON[k - 31]} Dragon`;
  return k < 38 ? `${FLOWER[k - 34]} flower` : `${SEASON[k - 38]} season`;
}
export const windName = (w) => WIND[w];
export const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

export const sortTiles = (arr) => arr.sort((a, b) => kindOf(a) - kindOf(b) || a - b);
export const kindCounts = (tiles) => { const c = new Array(34).fill(0); for (const t of tiles) { const k = kindOf(t); if (k < 34) c[k]++; } return c; };
const counts = kindCounts;
export const seatWind = (s, p) => (p - s.dealer + 4) % 4;

// ---------------------------------------------------------------------------------------------------------------
// A new hand: shuffle, deal 13 each, replace bonus tiles. `s.slot[t]` remembers each tile's place in the wall ring
// so the view can fly tiles out of it.
export function newHand(rng, { dealer = 0, wind = 0, minFan = 1 } = {}) {
  const deck = rng.shuffle(Array.from({ length: 144 }, (_, i) => i));
  const slot = new Array(144); deck.forEach((t, i) => { slot[t] = i; });
  const s = {
    deck, slot, front: 0, back: 144, hands: [[], [], [], []], melds: [[], [], [], []], flowers: [[], [], [], []], rivers: [[], [], [], []],
    dealer, wind, minFan, turn: dealer, phase: 'turn', drawn: -1, last: null, kongDraw: false, result: null, moves: 0, dealOrder: [],
  };
  for (let round = 0; round < 13; round++) for (let i = 0; i < 4; i++) { const p = (dealer + i) % 4; const t = s.deck[s.front++]; s.hands[p].push(t); s.dealOrder.push([t, p]); }
  // bonus tiles in the opening hands are replaced straight away, in seat order from the dealer
  for (let i = 0; i < 4; i++) {
    const p = (dealer + i) % 4;
    for (let guard = 0; guard < 20; guard++) {
      const b = s.hands[p].find((t) => isBonus(kindOf(t)));
      if (b === undefined) break;
      s.hands[p].splice(s.hands[p].indexOf(b), 1); s.flowers[p].push(b); s.dealOrder.push([b, p]);
      const r = s.deck[--s.back]; s.hands[p].push(r); s.dealOrder.push([r, p]);
    }
    sortTiles(s.hands[p]);
  }
  return s;
}

export const wallLeft = (s) => Math.max(0, s.back - s.front - RESERVE);      // draws still allowed

// The current player draws. Bonus tiles are set aside and replaced from the back. Returns the events for the view.
export function drawTile(s) {
  const p = s.turn, ev = [];
  if (s.back - s.front <= RESERVE) { s.phase = 'over'; s.result = { type: 'draw' }; return { ended: true, ev }; }
  let t = s.deck[s.front++];
  for (let guard = 0; guard < 12 && isBonus(kindOf(t)); guard++) {
    s.flowers[p].push(t); ev.push({ type: 'bonus', p, tile: t });
    if (s.back <= s.front) { s.phase = 'over'; s.result = { type: 'draw' }; return { ended: true, ev }; }
    t = s.deck[--s.back];
  }
  s.drawn = t; s.kongDraw = false; s.phase = 'discard'; s.moves++;
  ev.push({ type: 'draw', p, tile: t });
  return { ended: false, tile: t, ev };
}

export const fullHand = (s, p) => (s.drawn >= 0 && s.turn === p ? [...s.hands[p], s.drawn] : s.hands[p]);

// The current player discards `t` (must be in their full hand). Returns the claim options of every other seat.
export function discard(s, t) {
  const p = s.turn;
  if (t === s.drawn) s.drawn = -1;
  else { s.hands[p].splice(s.hands[p].indexOf(t), 1); if (s.drawn >= 0) { s.hands[p].push(s.drawn); sortTiles(s.hands[p]); s.drawn = -1; } }
  s.rivers[p].push(t); s.last = { tile: t, from: p }; s.phase = 'claim'; s.moves++;
  const opts = [null, null, null, null];
  for (let q = 0; q < 4; q++) if (q !== p) opts[q] = claimOptions(s, q, t, p);
  return opts;
}

// What could seat q do with the discard t from seat p? { win, lowWin, kong, pung, chows:[[tileA,tileB]...] }
export function claimOptions(s, q, t, p) {
  const k = kindOf(t), h = s.hands[q], o = { win: false, lowWin: false, kong: false, pung: false, chows: [], info: null };
  const same = h.filter((x) => kindOf(x) === k);
  o.pung = same.length >= 2; o.kong = same.length >= 3;
  if (q === (p + 1) % 4 && k < 27) {
    const r = k % 9, at = (kk) => h.find((x) => kindOf(x) === kk);
    const tryPair = (a, b) => { const x = at(a), y = at(b); if (x !== undefined && y !== undefined) o.chows.push([x, y]); };
    if (r >= 2) tryPair(k - 2, k - 1);
    if (r >= 1 && r <= 7) tryPair(k - 1, k + 1);
    if (r <= 6) tryPair(k + 1, k + 2);
  }
  const info = winInfo(s, q, [...h, t], false);
  if (info) { o.info = info; if (info.fan >= s.minFan) o.win = true; else o.lowWin = true; }
  return o;
}
export const hasClaim = (o) => !!o && (o.win || o.kong || o.pung || o.chows.length > 0);

// Take a claimed discard into an exposed set. type: 'pung' | 'kong' | 'chow'. pair = [tileA, tileB] for a chow.
export function claim(s, q, type, pair) {
  const { tile, from } = s.last, k = kindOf(tile), h = s.hands[q];
  const used = type === 'chow' ? pair : h.filter((x) => kindOf(x) === k).slice(0, type === 'kong' ? 3 : 2);
  for (const u of used) h.splice(h.indexOf(u), 1);
  s.rivers[from].pop();
  s.melds[q].push({ type, tiles: sortTiles([...used, tile]), from, claimed: tile, open: true });
  s.turn = q; s.last = null; s.drawn = -1; s.moves++;
  if (type === 'kong') return drawReplacement(s);
  s.phase = 'discard'; return { ev: [] };
}

// Nobody claimed: the next seat draws.
export function passAll(s) { s.turn = (s.turn + 1) % 4; s.phase = 'turn'; s.last = null; }

function drawReplacement(s) {
  const p = s.turn, ev = [];
  let t;
  for (let guard = 0; guard < 12; guard++) {
    if (s.back <= s.front) { s.phase = 'over'; s.result = { type: 'draw' }; return { ended: true, ev }; }
    t = s.deck[--s.back];
    if (!isBonus(kindOf(t))) break;
    s.flowers[p].push(t); ev.push({ type: 'bonus', p, tile: t });
  }
  s.drawn = t; s.kongDraw = true; s.phase = 'discard'; ev.push({ type: 'draw', p, tile: t });
  return { ended: false, ev };
}

// Kongs the current player could make from their own hand: concealed (four in hand) or added (fourth to an open pung).
export function ownKongs(s, p) {
  const c = counts(fullHand(s, p)), out = [];
  for (let k = 0; k < 34; k++) if (c[k] === 4) out.push({ kind: k, type: 'ckong' });
  for (const m of s.melds[p]) if (m.type === 'pung') { const k = kindOf(m.tiles[0]); if (c[k] >= 1) out.push({ kind: k, type: 'akong' }); }
  return out;
}
export function makeKong(s, p, kong) {
  const full = [...fullHand(s, p)], k = kong.kind;
  const mine = full.filter((x) => kindOf(x) === k);
  if (kong.type === 'ckong') s.melds[p].push({ type: 'ckong', tiles: sortTiles(mine.slice()), from: p, open: false });
  else { const m = s.melds[p].find((x) => x.type === 'pung' && kindOf(x.tiles[0]) === k); m.type = 'kong'; m.tiles = sortTiles([...m.tiles, mine[0]]); }
  const gone = kong.type === 'ckong' ? mine : [mine[0]];
  s.hands[p] = full.filter((x) => !gone.includes(x)); sortTiles(s.hands[p]); s.drawn = -1; s.moves++;
  return drawReplacement(s);
}

// ---------------------------------------------------------------------------------------------------------------
// WINNING. `tiles` = the player's concealed tiles including the winning tile.
// Returns the best-scoring reading { fan, patterns:[{name,fan,why}], sets, pair } or null when it is not a complete hand.
export function winInfo(s, p, tiles, selfDraw) {
  const c = counts(tiles), melds = s.melds[p];
  const ctx = {
    seat: seatWind(s, p), wind: s.wind, selfDraw, kongDraw: selfDraw && s.kongDraw, lastTile: s.back - s.front <= RESERVE,
    open: melds.some((m) => m.open), flowers: s.flowers[p],
  };
  const exposed = melds.map((m) => ({ t: m.type === 'chow' ? 'chow' : m.type === 'pung' ? 'pung' : 'kong', k: kindOf(m.tiles[0]), open: m.open }));
  let best = null;
  if (melds.length === 0 && tiles.length === 14 && ORPHANS.every((k) => c[k] >= 1) && ORPHANS.reduce((a, k) => a + c[k], 0) === 14) {
    best = { fan: LIMIT, patterns: [{ name: 'Thirteen Orphans', fan: LIMIT, why: 'One of every 1, 9, wind and dragon, plus any one of them again. A limit hand.' }], sets: [], pair: -1, limit: true };
  }
  const need = 4 - melds.length;
  for (let k = 0; k < 34; k++) {
    if (c[k] < 2) continue;
    c[k] -= 2;
    for (const conc of decompose(c, need)) {
      const info = scoreHand([...exposed, ...conc], k, ctx);
      if (!best || info.fan > best.fan) best = info;
    }
    c[k] += 2;
  }
  return best;
}

// All ways to split counts c into exactly `need` sets (each a pung or chow).
function decompose(c, need) {
  const out = [], cur = [];
  (function go(i) {
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) { if (cur.length === need) out.push(cur.map((x) => ({ ...x }))); return; }
    if (cur.length >= need) return;
    if (c[i] >= 3) { c[i] -= 3; cur.push({ t: 'pung', k: i, open: false }); go(i); cur.pop(); c[i] += 3; }
    if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; cur.push({ t: 'chow', k: i, open: false }); go(i); cur.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
    }
  })(0);
  return out;
}

export function scoreHand(sets, pair, ctx) {
  const pats = [], add = (name, fan, why) => pats.push({ name, fan, why });
  const allK = [...sets.map((x) => x.k), pair];
  const pungs = sets.filter((x) => x.t !== 'chow'), chows = sets.filter((x) => x.t === 'chow');
  const numSuits = new Set(), hasHonor = allK.some((k) => k >= 27);
  for (const k of allK) if (k < 27) numSuits.add(suitOf(k));
  let limit = false;
  const seatK = 27 + ctx.seat, windK = 27 + ctx.wind;
  const windPungs = pungs.filter((x) => x.k >= 27 && x.k < 31), dragPungs = pungs.filter((x) => x.k >= 31);

  if (allK.every((k) => k >= 27)) { add('All Honours', LIMIT, 'Every set and the pair are winds or dragons. A limit hand.'); limit = true; }
  else if (chows.length === 0 && allK.every(isTerminal)) { add('All Terminals', LIMIT, 'Every set is a pung of 1s or 9s. A limit hand.'); limit = true; }
  if (windPungs.length === 4) { add('Great Four Winds', LIMIT, 'A pung of each of the four winds. A limit hand.'); limit = true; }
  else if (windPungs.length === 3 && pair >= 27 && pair < 31) { add('Small Four Winds', LIMIT, 'Three wind pungs and a wind pair. A limit hand.'); limit = true; }
  if (dragPungs.length === 3) { add('Great Three Dragons', LIMIT, 'A pung of each dragon. A limit hand.'); limit = true; }
  if (!limit) {
    if (dragPungs.length === 2 && pair >= 31) add('Small Three Dragons', 5, 'Two dragon pungs and a pair of the third dragon.');
    if (numSuits.size === 1 && !hasHonor) add('Pure One Suit', 7, 'Every tile belongs to a single suit.');
    else if (numSuits.size === 1 && hasHonor) add('Mixed One Suit', 3, 'One suit plus winds and dragons.');
    if (pungs.length === 4) add('All Pungs', 3, 'Four pungs or kongs and a pair, no chows.');
    if (chows.length === 4 && !(pair >= 31 || pair === seatK || pair === windK)) add('Common Hand', 1, 'Four chows and a pair that scores nothing.');
    for (const x of dragPungs) add(`${DRAGON[x.k - 31]} Dragon pung`, 1, 'A pung or kong of a dragon always scores.');
    for (const x of windPungs) {
      if (x.k === seatK) add(`Seat wind pung (${WIND[ctx.seat]})`, 1, 'A pung of the wind of your own seat.');
      if (x.k === windK) add(`Round wind pung (${WIND[ctx.wind]})`, 1, 'A pung of the wind of the round.');
    }
    const fl = ctx.flowers.map(kindOf);
    const own = fl.filter((k) => rankOf(k) === ctx.seat).length;
    if (own) add('Your own flower' + (own > 1 ? 's' : ''), own, `Flower and season number ${ctx.seat + 1} match your seat.`);
    if (fl.filter((k) => k < 38).length === 4) add('All four flowers', 2, 'You hold the whole set of flowers.');
    if (fl.filter((k) => k >= 38).length === 4) add('All four seasons', 2, 'You hold the whole set of seasons.');
    if (!ctx.open && ctx.selfDraw) add('Concealed and self-drawn', 3, 'No open sets, and you drew the winning tile yourself.');
    else if (!ctx.open) add('Concealed hand', 1, 'No sets were claimed from discards.');
    else if (ctx.selfDraw) add('Self-drawn', 1, 'You drew the winning tile yourself.');
    if (ctx.kongDraw) add('Win on a kong tile', 1, 'The winning tile came as the replacement after a kong.');
    if (ctx.lastTile) add('Last tile', 1, 'The winning tile was the last one of the wall.');
  }
  let fan = pats.reduce((a, x) => a + x.fan, 0);
  if (limit || fan > LIMIT) fan = LIMIT;
  return { fan, patterns: pats, sets, pair, limit };
}

export const pointsFor = (fan) => POINTS[Math.min(LIMIT, Math.max(0, fan))];

// Points moved by a win. Discard win: the discarder pays double. Self-draw: each of the three pays once.
export function payments(winner, from, fan) {
  const u = pointsFor(fan), d = [0, 0, 0, 0];
  if (from < 0) { for (let q = 0; q < 4; q++) if (q !== winner) { d[q] = -u; d[winner] += u; } }
  else { d[from] = -2 * u; d[winner] = 2 * u; }
  return d;
}

// Declare a win for seat q. via = 'self' (own draw) or 'discard'.
export function declareWin(s, q, via) {
  let tiles, from = -1;
  if (via === 'self') tiles = [...fullHand(s, q)];
  else { tiles = [...s.hands[q], s.last.tile]; from = s.last.from; }
  const info = winInfo(s, q, tiles, via === 'self');
  s.result = { type: 'win', winner: q, from, tile: via === 'self' ? s.drawn : s.last.tile, info, pay: payments(q, from, info.fan), tiles: sortTiles(tiles) };
  s.phase = 'over';
  return s.result;
}

// Can the current player win on their own draw? Returns info (fan may still be under minFan) or null.
export const selfWin = (s, p) => winInfo(s, p, fullHand(s, p), true);

// ---------------------------------------------------------------------------------------------------------------
// SHANTEN: how many steps a hand is from being "ready" (-1 = complete, 0 = ready: one tile from winning).
// Used by the computer and by hints. `c` = kind counts of the concealed tiles, `melds` = exposed sets.
export function shanten(c, melds = 0) {
  const need = 4 - melds;
  let best = 2 * need;
  const cc = c.slice();
  (function dfs(i, m, t, pr) {
    while (i < 34 && cc[i] === 0) i++;
    if (i >= 34) {
      const v = 2 * need - 2 * m - Math.min(t, need - m) - pr;
      if (v < best) best = v;
      return;
    }
    if (cc[i] >= 3) { cc[i] -= 3; dfs(i, m + 1, t, pr); cc[i] += 3; }
    const num = i < 27, r = i % 9;
    if (num && r <= 6 && cc[i + 1] > 0 && cc[i + 2] > 0) { cc[i]--; cc[i + 1]--; cc[i + 2]--; dfs(i, m + 1, t, pr); cc[i]++; cc[i + 1]++; cc[i + 2]++; }
    if (!pr && cc[i] >= 2) { cc[i] -= 2; dfs(i, m, t, 1); cc[i] += 2; }
    if (m + t < need) {
      if (cc[i] >= 2) { cc[i] -= 2; dfs(i, m, t + 1, pr); cc[i] += 2; }
      if (num && r <= 7 && cc[i + 1] > 0) { cc[i]--; cc[i + 1]--; dfs(i, m, t + 1, pr); cc[i]++; cc[i + 1]++; }
      if (num && r <= 6 && cc[i + 2] > 0) { cc[i]--; cc[i + 2]--; dfs(i, m, t + 1, pr); cc[i]++; cc[i + 2]++; }
    }
    cc[i]--; dfs(i, m, t, pr); cc[i]++;     // treat one copy as a lone tile
  })(0, 0, 0, 0);
  return best;
}

// Kinds that would bring `c` a step closer, with how many are still unseen (`seen` = counts of kinds visible to the player).
export function outsFor(c, melds, seen) {
  const base = shanten(c, melds), out = [];
  for (let k = 0; k < 34; k++) {
    if (c[k] >= 4) continue;
    const near = k >= 27 ? c[k] > 0 : (c[k] > 0 || [-2, -1, 1, 2].some((d) => { const j = k + d; return j >= 0 && j < 27 && Math.floor(j / 9) === Math.floor(k / 9) && c[j] > 0; }));
    if (!near) continue;
    c[k]++;
    if (shanten(c, melds) < base) out.push({ kind: k, left: Math.max(0, 4 - seen[k]) });
    c[k]--;
  }
  return out;
}

// Everything a player can see: their own hand, all rivers, all open sets, all bonus tiles.
export function visibleCounts(s, p) {
  const seen = new Array(34).fill(0), add = (t) => { const k = kindOf(t); if (k < 34) seen[k]++; };
  s.hands[p].forEach(add); if (s.turn === p && s.drawn >= 0) add(s.drawn);
  for (let q = 0; q < 4; q++) { s.rivers[q].forEach(add); for (const m of s.melds[q]) if (m.open || q === p) m.tiles.forEach(add); }
  return seen;
}
