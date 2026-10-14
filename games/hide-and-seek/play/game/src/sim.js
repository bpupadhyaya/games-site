// Hide and Seek: the rules engine. Pure and deterministic: no clock, no DOM, randomness only from the rng handed in.
// Two roles share one board of eight hiding spots:
//   SEEK: hiders are tucked away by the game; you look in spots (a limited number of looks), read the warmth clues and listen.
//   HIDE: you tuck yourself away; a seeker that remembers where you like to hide looks, and you may sneak to a neighbour spot.
// Spots keep stable indices 0..7; the view lays them out in rows (LPOS is the shared logical layout).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { clamp };

export const NSPOT = 8;
export const COUNT_T = 2.2;      // seconds of counting while the hiders run (seek mode)
export const LOOK_T = 0.7;       // a look (seek mode): the seeker walks there and peeks
export const LISTEN_T = 0.9;
export const THINK_T = 0.8;      // the seeker AI pauses before choosing (hide mode)
export const WALK_TS = [1.2, 1.05, 0.85]; // ... walks (the target is shown from here on), by level
export const PEEK_T = 0.4;      // ... peeks
export const MOVE_T = 0.7;       // your sneak from one spot to a neighbour

// Tiny seeded generator for the daily hunt (the same hiders for everybody); the rest of the game uses env.rng.
export function seeded(seed) {
  let s = (seed | 0) ^ 0x9e3779b9;
  const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + next() * (b - a), int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)] };
}

// ---- content --------------------------------------------------------------------------------------------------------------
// q: how well the spot hides someone (0..1). Both AIs know it: good spots are chosen more often.
export const KINDS = {
  arch: { q: 0.5 }, fountain: { q: 0.55 }, curtain: { q: 0.5 }, cart: { q: 0.6 }, barrels: { q: 0.8 }, plant: { q: 0.7 }, laundry: { q: 0.45 },
  crates: { q: 0.65 }, jar: { q: 0.75 }, sacks: { q: 0.7 }, table: { q: 0.45 }, gate: { q: 0.4 }, screen: { q: 0.65 }, wardrobe: { q: 0.9 },
  chest: { q: 0.7 }, rocks: { q: 0.4 },
};

export const PLACES = [
  {
    id: 'piazza', name: 'Piazza at Dusk', local: 'Nascondino', need: 0, theme: 0,
    blurb: 'A small town square as the lamps come on: a fountain, a market cart and doorways to duck into.',
    spots: [
      { kind: 'arch', name: 'Stone arch' }, { kind: 'fountain', name: 'Fountain' }, { kind: 'curtain', name: 'Doorway curtain' },
      { kind: 'cart', name: 'Market cart' }, { kind: 'barrels', name: 'Barrels' },
      { kind: 'plant', v: 'lemon', name: 'Lemon tree' }, { kind: 'laundry', name: 'Washing line' }, { kind: 'crates', name: 'Crates' },
    ],
  },
  {
    id: 'kampung', name: 'Kampung Yard', local: 'Petak Umpet', need: 10, theme: 1,
    blurb: 'A village yard in the warm afternoon: banana plants, bamboo, a big water jar and sacks of rice.',
    spots: [
      { kind: 'plant', v: 'bamboo', name: 'Bamboo clump' }, { kind: 'jar', name: 'Water jar' }, { kind: 'plant', v: 'banana', name: 'Banana plants' },
      { kind: 'cart', v: 'hand', name: 'Handcart' }, { kind: 'sacks', name: 'Rice sacks' },
      { kind: 'table', v: 'bale', name: 'Shelter bench' }, { kind: 'laundry', v: 'rack', name: 'Drying rack' }, { kind: 'gate', v: 'bamboo', name: 'Bamboo gate' },
    ],
  },
  {
    id: 'machiya', name: 'Town House', local: 'Kakurenbo', need: 24, theme: 2,
    blurb: 'A wooden town house with paper screens, a quiet garden and cupboards under the stairs.',
    spots: [
      { kind: 'screen', name: 'Folding screen' }, { kind: 'wardrobe', name: 'Futon cupboard' }, { kind: 'curtain', v: 'noren', name: 'Shop curtain' },
      { kind: 'table', v: 'low', name: 'Low table' }, { kind: 'chest', name: 'Storage chest' },
      { kind: 'rocks', name: 'Garden rocks' }, { kind: 'plant', v: 'pine', name: 'Garden pine' }, { kind: 'gate', v: 'veranda', name: 'Veranda' },
    ],
  },
];

export const LEVELS = [
  { id: 'easy', name: 'Easy', hiders: 2, looks: 5, listens: 2, counts: true, mem: 0, hideLooks: 4, blurb: 'Two hiders, five looks, clues show how many are close.' },
  { id: 'regular', name: 'Regular', hiders: 3, looks: 5, listens: 2, counts: true, mem: 1, hideLooks: 5, blurb: 'Three hiders, five looks. The hiders remember where you look first.' },
  { id: 'hard', name: 'Hard', hiders: 4, looks: 6, listens: 1, counts: false, mem: 1.6, hideLooks: 6, blurb: 'Four hiders, six looks, and clues only say warm or cold.' },
];

// Where the spots stand in the shared logical layout (u across, v from the back row 0 to the front row 1).
export const LPOS = [[0.14, 0], [0.5, 0], [0.86, 0], [0.32, 0.5], [0.68, 0.5], [0.14, 1], [0.5, 1], [0.86, 1]];
export const HOME = 5;           // where the seeker waits and starts (front left)
const near = (a, b) => Math.hypot(LPOS[a][0] - LPOS[b][0], (LPOS[a][1] - LPOS[b][1]) * 0.55) < 0.37;
export const ADJ = LPOS.map((_, i) => LPOS.map((__, j) => j).filter((j) => j !== i && near(i, j)));
// hops between spots over the neighbour graph
export const HOPS = LPOS.map((_, s) => {
  const d = Array(NSPOT).fill(99); d[s] = 0; const q = [s];
  while (q.length) { const a = q.shift(); for (const b of ADJ[a]) if (d[b] === 99) { d[b] = d[a] + 1; q.push(b); } }
  return d;
});

export const RANKS = [[0, 'Peeking out'], [60, 'Quick eyes'], [140, 'Sharp seeker'], [220, 'Corner finder'], [300, 'Hide-and-seek champion']];
export const rankFor = (score) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (score >= n) r = name; return r; };
export const placeOwned = (rec, i) => (rec.found | 0) >= PLACES[i].need;

export const emptyMemory = () => ({ seekFirst: PLACES.map(() => Array(NSPOT).fill(0)), hideSpots: PLACES.map(() => Array(NSPOT).fill(0)) });
const qOf = (place, s) => KINDS[PLACES[place].spots[s].kind].q;
const share = (arr, s) => { let t = 0; for (const v of arr) t += v; return t >= 2 ? arr[s] / t : 0; };

function weightedPick(r, weights) {
  let tot = 0; for (const x of weights) tot += x;
  if (tot <= 0) return -1;
  let a = r.next() * tot;
  for (let i = 0; i < weights.length; i++) { a -= weights[i]; if (a < 0 && weights[i] > 0) return i; }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return -1;
}

// ---- the world ------------------------------------------------------------------------------------------------------------
// mode: 'seek' | 'hide'. memory: { seekFirst, hideSpots } (counts per place and spot) or null for a neutral memory (daily).
export function makeWorld({ mode = 'seek', place = 0, level = 1, rng, memory = null }) {
  const L = LEVELS[level], mem = memory || emptyMemory();
  const w = {
    mode, place, level, t: 0, phase: mode === 'hide' ? 'pick' : 'count', phaseT: 0, over: false, win: false,
    looked: Array(NSPOT).fill(0), clue: Array(NSPOT).fill(-1), log: [], listens: L.listens, marks: [], anim: null,
    score: 0, found: 0, looks: mode === 'hide' ? L.hideLooks : L.looks, looksUsed: 0, firstLook: -1, ev: [], neutral: !memory,
    hiders: [], me: null, sk: null, bonus: 0, mem,
  };
  if (mode === 'seek') {
    const wts = PLACES[place].spots.map((_, s) => qOf(place, s) * (1 - clamp(0.8 * L.mem * share(mem.seekFirst[place], s) * 2, 0, 0.8)));
    for (let k = 0; k < L.hiders; k++) {
      const s = weightedPick(rng, wts); wts[s] = 0;
      w.hiders.push({ spot: s, found: false, kid: k % 4, ft: 0, who: k });
    }
  } else {
    w.me = { spot: -1, from: -1, to: -1, t: 0, moving: false, hops: 0, safe: 0, cleared: false };
    w.sk = { phase: 'think', t: 0, target: -1, at: -1, heard: -1, dur: THINK_T, why: '' };
  }
  w.listensMax = L.listens;
  return w;
}

export const hidersLeft = (w) => w.hiders.filter((h) => !h.found).length;
export const hiderAt = (w, s) => w.hiders.find((h) => h.spot === s && !h.found) || null;
const foundSpots = (w) => w.hiders.filter((h) => h.found).map((h) => h.spot);

// ---- seeking ----------------------------------------------------------------------------------------------------------------
export const canLook = (w, s) => w.mode === 'seek' && w.phase === 'search' && !w.anim && !w.over && w.looksUsed < w.looks && w.looked[s] === 0;
export function lookAt(w, s) {
  if (!canLook(w, s)) return false;
  if (w.firstLook < 0) w.firstLook = s;
  w.anim = { type: 'look', spot: s, t: 0, dur: LOOK_T };
  return true;
}
export const canListen = (w) => w.mode === 'seek' && w.phase === 'search' && !w.anim && !w.over && w.listens > 0 && w.looksUsed < w.looks && hidersLeft(w) > 0 && w.looked.some((x) => x === 0);
export function listen(w, r) {
  if (!canListen(w)) return false;
  w.listens--;
  const open = [];
  for (let s = 0; s < NSPOT; s++) if (w.looked[s] === 0) open.push(s);
  const target = w.hiders.filter((h) => !h.found)[r.int(hidersLeft(w))].spot;
  const group = [target];
  const others = open.filter((s) => s !== target);
  while (group.length < 3 && others.length) group.push(others.splice(r.int(others.length), 1)[0]);
  group.sort((a, b) => a - b);
  w.anim = { type: 'listen', group, t: 0, dur: LISTEN_T };
  return true;
}

function resolveLook(w, s) {
  const h = hiderAt(w, s), before = foundSpots(w);
  let hit = false;
  if (h) { h.found = true; h.ft = 0; w.found++; w.looked[s] = 2; hit = true; w.score += 100; } else w.looked[s] = 1;
  w.looksUsed++;
  const c = ADJ[s].reduce((n, j) => n + (hiderAt(w, j) ? 1 : 0), 0);
  w.clue[s] = c;
  w.log.push({ type: 'look', spot: s, c, before });
  w.ev.push({ type: 'look', spot: s, hit, c, who: h ? h.who : -1 });
  if (hidersLeft(w) === 0) endSeek(w, true);
  else if (w.looksUsed >= w.looks) endSeek(w, false);
}
function endSeek(w, win) {
  w.over = true; w.win = win; w.phase = 'over';
  const left = w.looks - w.looksUsed;
  if (win) { w.bonus = left * 15 + 50; w.score += w.bonus; }
  w.ev.push({ type: 'end', win });
}

// ---- hiding -----------------------------------------------------------------------------------------------------------------
export function pickSpot(w, s) {
  if (w.mode !== 'hide' || w.phase !== 'pick' || s < 0 || s >= NSPOT) return false;
  w.me.spot = s; w.phase = 'count'; w.phaseT = 0; return true;
}
export const canSneak = (w, s) => {
  if (w.mode !== 'hide' || w.phase !== 'search' || w.over || w.me.moving) return false;
  if (!ADJ[w.me.spot].includes(s)) return false;
  const k = w.sk; if (k.phase !== 'think' && k.target === s) return false;
  return true;
};
export function sneak(w, s) {
  if (!canSneak(w, s)) return false;
  const m = w.me; m.moving = true; m.from = m.spot; m.to = s; m.t = 0; return true;
}

// how likely the seeker is to choose each spot next (the weights its AI uses), normalised. Used by the AI and by Think.
export function seekerWeights(w) {
  const L = LEVELS[w.level], sk = w.sk, wts = [];
  const mine = w.mem.hideSpots[w.place];
  for (let s = 0; s < NSPOT; s++) {
    let x = 0;
    if (w.looked[s] === 0) {
      x = qOf(w.place, s) * (1 + L.mem * share(mine, s) * 5) / (1 + 0.28 * HOPS[sk.at >= 0 ? sk.at : HOME][s]);
    }
    if (sk.heard >= 0 && s === sk.heard) x = Math.max(x, 0.2) * 12;
    wts.push(x);
  }
  return wts;
}

function stepSeeker(w, dt, r) {
  const k = w.sk, m = w.me;
  k.t += dt;
  if (k.phase === 'think') {
    if (k.t >= THINK_T) {
      let wts = seekerWeights(w);
      if (wts.every((x) => x <= 0)) wts = w.looked.map((v) => (v === 0 || v === 1 ? 1 : 0));
      k.target = weightedPick(r, wts); k.heard = -1; k.phase = 'walk'; k.t = 0;
      w.ev.push({ type: 'target', spot: k.target });
    }
  } else if (k.phase === 'walk') {
    if (k.t >= WALK_TS[w.level]) { k.phase = 'peek'; k.t = 0; }
  } else if (k.phase === 'peek') {
    if (k.t >= PEEK_T) {
      const s = k.target;
      const caught = (m.moving ? (m.from === s || m.to === s) : m.spot === s);
      k.at = s; w.looksUsed++;
      if (caught) {
        w.over = true; w.win = false; w.phase = 'over'; w.looked[s] = 2; m.cleared = false;
        const survived = w.looksUsed - 1;
        w.score = survived * 10 + m.safe * 25;
        w.ev.push({ type: 'caught', spot: s });
        w.ev.push({ type: 'end', win: false });
        return;
      }
      w.looked[s] = 1;
      w.ev.push({ type: 'empty', spot: s });
      if (w.looksUsed >= w.looks) {
        w.over = true; w.win = true; w.phase = 'over';
        w.score = w.looksUsed * 10 + 60 + m.safe * 25;
        w.ev.push({ type: 'end', win: true });
        return;
      }
      k.phase = 'think'; k.t = 0; k.target = -1;
    }
  }
}

function stepMe(w, dt, r) {
  const m = w.me;
  if (!m.moving) return;
  m.t += dt;
  if (m.t >= MOVE_T) {
    m.moving = false; m.spot = m.to; m.hops++; m.safe++; m.t = 0;
    const k = w.sk, d = HOPS[k.at >= 0 ? k.at : HOME][m.spot], L = LEVELS[w.level];
    const p = Math.min(0.97, (d <= 1 ? 0.9 : d <= 2 ? 0.7 : 0.45) * (w.level === 0 ? 0.6 : w.level === 2 ? 1.1 : 1));
    const heard = r.next() < p;
    if (heard && k.phase === 'think') k.heard = m.spot;
    else if (heard) k.heardLater = m.spot;
    w.ev.push({ type: 'arrive', spot: m.spot, heard });
    void L;
  }
}

// ---- time -------------------------------------------------------------------------------------------------------------------
export function stepWorld(w, dt, r) {
  if (w.over) { for (const h of w.hiders) h.ft += dt; return; }
  w.t += dt; w.phaseT += dt;
  if (w.mode === 'seek') {
    for (const h of w.hiders) if (h.found) h.ft += dt;
    if (w.phase === 'count') { if (w.phaseT >= COUNT_T) { w.phase = 'search'; w.phaseT = 0; w.ev.push({ type: 'go' }); } return; }
    if (w.anim) {
      const a = w.anim; a.t += dt;
      if (a.t >= a.dur) {
        w.anim = null;
        if (a.type === 'look') resolveLook(w, a.spot);
        else {
          w.looksUsed++;
          w.marks.push(a.group);
          w.log.push({ type: 'listen', group: a.group, before: foundSpots(w) });
          w.ev.push({ type: 'listen', group: a.group });
          if (w.looksUsed >= w.looks) endSeek(w, false);
        }
      }
    }
    return;
  }
  // hide
  if (w.phase === 'pick') return;
  if (w.phase === 'count') { if (w.phaseT >= COUNT_T) { w.phase = 'search'; w.phaseT = 0; w.sk.t = 0; w.ev.push({ type: 'go' }); } return; }
  stepMe(w, dt, r);
  stepSeeker(w, dt, r);
  if (w.sk.heardLater != null && w.sk.phase === 'think') { w.sk.heard = w.sk.heardLater; w.sk.heardLater = null; }
}

// ---- what the player can know -----------------------------------------------------------------------------------------------
// Every arrangement of the hidden hiders that fits the looks and the listens so far, weighted by how well each spot hides.
// Returns { p: probability per spot, n: arrangements, total } for the unlooked spots.
export function inference(w) {
  const open = [];
  for (let s = 0; s < NSPOT; s++) if (w.looked[s] === 0) open.push(s);
  const R = hidersLeft(w), L = LEVELS[w.level];
  const p = Array(NSPOT).fill(0);
  if (R === 0 || R > open.length) return { p, n: 0, total: 0 };
  const known = foundSpots(w);
  let n = 0, total = 0;
  const pick = [];
  const consistent = (combo) => {
    const all = known.concat(combo);
    for (const e of w.log) {
      if (e.type === 'look') {
        let c = 0;
        for (const j of ADJ[e.spot]) if (all.includes(j) && !e.before.includes(j)) c++;
        if (L.counts ? c !== e.c : (c > 0) !== (e.c > 0)) return false;
      } else {
        let any = false;
        for (const j of e.group) if (all.includes(j) && !e.before.includes(j)) { any = true; break; }
        if (!any) return false;
      }
    }
    return true;
  };
  const rec = (i, left) => {
    if (left === 0) {
      if (!consistent(pick)) return;
      let wt = 1; for (const s of pick) wt *= qOf(w.place, s);
      n++; total += wt; for (const s of pick) p[s] += wt;
      return;
    }
    if (open.length - i < left) return;
    pick.push(open[i]); rec(i + 1, left - 1); pick.pop();
    rec(i + 1, left);
  };
  rec(0, R);
  if (total > 0) for (let s = 0; s < NSPOT; s++) p[s] /= total;
  return { p, n, total };
}

const pct = (x) => Math.round(x * 100);
// The best next move for the seeker (Think and Watch & Learn). { kind: 'look' | 'listen', id (spot), p, why }
export function adviseSeek(w) {
  if (w.mode !== 'seek' || w.over) return null;
  const inf = inference(w), pl = PLACES[w.place];
  let best = -1, bp = -1;
  for (let s = 0; s < NSPOT; s++) {
    if (w.looked[s] !== 0) continue;
    // tie-break toward spots with more unseen neighbours: a look there says more
    const open = ADJ[s].filter((j) => w.looked[j] === 0).length;
    const v = inf.p[s] + open * 0.001 - s * 1e-6;
    if (v > bp) { bp = v; best = s; }
  }
  if (best < 0) return null;
  const p = inf.p[best];
  if (canListen(w) && w.looks - w.looksUsed >= 3 && p < 0.34) {
    return { kind: 'listen', id: best, p, why: `No spot is more than ${pct(p)} percent likely, so listen for a giggle first.` };
  }
  const nm = pl.spots[best].name;
  const why = inf.n <= 1 && p >= 0.99 ? `Everything points to the ${nm}.`
    : w.looksUsed === 0 ? `${nm} is the most likely hiding place to start: about ${pct(p)} percent likely.`
      : `${nm}: someone is there in about ${pct(p)} percent of the arrangements that fit your clues.`;
  return { kind: 'look', id: best, p, why };
}

// Where to be (hide mode): the spot the seeker is least likely to choose next, with the reason.
export function adviseHide(w) {
  if (w.mode !== 'hide' || w.over) return null;
  const wts = seekerWeights(w), pl = PLACES[w.place];
  const tot = wts.reduce((a, b) => a + b, 0) || 1;
  if (w.phase === 'pick') {
    let best = 0, lo = 9;
    wts.forEach((x, s) => { const v = x / tot; if (v < lo) { lo = v; best = s; } });
    const mine = w.mem.hideSpots[w.place], seen = mine.reduce((a, b) => a + b, 0) >= 2 && share(mine, best) < 0.12;
    return { kind: 'hide', id: best, why: `${pl.spots[best].name}: the seeker is unlikely to start there${seen ? ', and you do not hide there often' : ''}.` };
  }
  const m = w.me, k = w.sk;
  const here = m.moving ? m.to : m.spot, mine = wts[here] / tot;
  if (k.phase !== 'think' && k.target === here) {
    const opts = ADJ[here].filter((s) => canSneak(w, s));
    if (opts.length) { const s = opts.sort((a, b) => wts[a] - wts[b])[0]; return { kind: 'sneak', id: s, why: `The seeker is coming to the ${pl.spots[here].name}. Slip to the ${pl.spots[s].name} now.` }; }
    return { kind: 'stay', id: here, why: 'The seeker is coming here and there is nowhere to go. Hold still.' };
  }
  const opts = ADJ[here].filter((s) => canSneak(w, s));
  const cleared = opts.filter((s) => w.looked[s] === 1).sort((a, b) => HOPS[k.at >= 0 ? k.at : HOME][b] - HOPS[k.at >= 0 ? k.at : HOME][a]);
  if (mine > 0.22 && cleared.length) return { kind: 'sneak', id: cleared[0], why: `The seeker is likely to look at the ${pl.spots[here].name} soon. The ${pl.spots[cleared[0]].name} was already checked and is far from the seeker.` };
  return { kind: 'stay', id: here, why: `Stay in the ${pl.spots[here].name}: the seeker has about a ${pct(mine)} percent chance of looking here next. Moving makes noise.` };
}

// ---- the automatic player (Watch & Learn): drives a SEEK round with the same inference Think uses -------------------------------
export const newAuto = () => ({ cool: 0.5, id: -1, kind: null, pref: null });
export function autoStep(w, ap, r, dt) {
  if (w.over || w.mode !== 'seek' || w.phase !== 'search' || w.anim) return;
  if (ap.cool > 0) { ap.cool -= dt; return; }
  const adv = ap.pref || adviseSeek(w);
  if (!adv) return;
  ap.pref = null; ap.cool = 0.5;
  if (adv.kind === 'listen') { if (!listen(w, r)) lookAt(w, adv.id); } else lookAt(w, adv.id);
}

// ---- rewards -----------------------------------------------------------------------------------------------------------------
export function stars(w) {
  if (w.mode === 'seek') {
    if (!w.win) return w.found >= Math.ceil(w.hiders.length / 2) ? 1 : 0;
    const left = w.looks - w.looksUsed;
    return left >= 3 ? 3 : left >= 1 ? 2 : 1;
  }
  if (!w.win) return w.looksUsed >= Math.ceil(w.looks / 2) ? 1 : 0;
  return w.me.safe >= 2 ? 3 : w.me.safe >= 1 ? 2 : 1;
}
