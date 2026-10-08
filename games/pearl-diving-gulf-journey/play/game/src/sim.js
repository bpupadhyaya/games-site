// The season engine: pure, deterministic, JSON-serialisable. Everything a player does goes through these functions; views only read the state.
// One seed (S.seed) drives every roll through a tiny generator kept inside the state, so a whole season can be saved and resumed.
import * as K from './consts.js';
import { EVENTS, SEA_NOTES } from './events.js';

const { DIVE, WINDS, BANKS, SIZES, SHAPES, LUSTERS, COLOURS, PROVS } = K;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const rnd = (S) => { S.seed = (Math.imul(S.seed, 1664525) + 1013904223) >>> 0; return S.seed / 4294967296; };
const ri = (S, n) => Math.floor(rnd(S) * n);
const rr = (S, a, b) => a + (b - a) * rnd(S);
const pickW = (S, ws) => { let t = 0; for (const w of ws) t += w; let r = rnd(S) * t; for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; };
const ev = (O, type, o = {}) => { O.evId = (O.evId | 0) + 1; (O.ev || (O.ev = [])).push({ id: O.evId, type, ...o }); if (O.ev.length > 40) O.ev.shift(); };

// ---- the season ---------------------------------------------------------------------------------------------------------------------------------------------------
export function createSeason(seed, mode = 'play') {
  const S = {
    seed: seed >>> 0 || 1, mode, t: 0, phase: 'intro', trip: 0, day: 0, dayNo: 0,
    cash: K.START_CASH, debt: K.START_DEBT, strain: 0, standing: 0, stam: 100, spirit: 55, prov: 1, provDisc: 0, famCredit: 0, salimTired: false,
    winds: [], wind: 0, market: [], pearls: [], necklace: [], nextPearl: 1, journal: [], used: [], shells: [], sum: null, ev: null, chosen: -1,
    G: null, D: null, H: null, O: null, T: null, B: null, score: null, fin: null, sold: 0, soldValue: 0, bestPearl: 0, divesDone: 0, shellsTotal: 0, evId: 0, events: [],
    flags: { forceRest: false },
  };
  S.market = [0, 1, 2, 3].map((i) => +(K.MARKET[i] + (rnd(S) - 0.5) * 0.16).toFixed(3));
  planTrip(S);
  return S;
}
export const jlog = (S, ...lines) => { let e = S.journal[S.journal.length - 1]; if (!e || e.dayNo !== S.dayNo || e.tp !== S.tripPhase) { e = { dayNo: S.dayNo, trip: S.trip, day: S.day, tp: S.tripPhase, title: '', lines: [] }; S.journal.push(e); } e.lines.push(...lines); return e; };
const jtitle = (S, title) => { const e = jlog(S); e.title = title; };

function planTrip(S) {
  const w = []; let cur = pickW(S, [0.35, 0.35, 0.2, 0.1]);
  for (let d = 0; d < K.DAYS; d++) { w.push(cur); const r = rnd(S); cur = clamp(cur + (r < 0.3 ? -1 : r < 0.7 ? 0 : 1), 0, 3); if (w.length >= 2 && w[w.length - 1] === 3 && w[w.length - 2] === 3) cur = 2; }
  S.winds = w; S.day = 0; S.wind = w[0];
}
export const idx = (S) => clamp(S.market[S.trip] + K.STANDING_BONUS * Math.min(6, S.standing), 0.7, 1.4);

// ---- pearls --------------------------------------------------------------------------------------------------------------------------------------------------------
export function pearlValue(p) { return Math.max(1, Math.round(SIZES[p.size].base * (0.8 + 0.4 * ((p.mm - SIZES[p.size].mm[0]) / Math.max(1, SIZES[p.size].mm[1] - SIZES[p.size].mm[0]))) * SHAPES[p.shape].mul * LUSTERS[p.lust].mul * COLOURS[p.col].mul)); }
export const pearlName = (p) => `${SIZES[p.size].name} ${SHAPES[p.shape].name.toLowerCase()} ${COLOURS[p.col].name.toLowerCase()}`;
export const pearlDetail = (p) => `${p.mm} mm, ${LUSTERS[p.lust].name.toLowerCase()} luster`;
function rollPearl(S, bank, old) {
  const chance = K.PEARL_CHANCE * bank.rich * (old ? K.OLD_MUL : 1);
  if (rnd(S) >= chance) return null;
  const ws = K.W_SIZE.slice(); ws[3] *= bank.big; ws[4] *= bank.big * bank.big; if (old) { ws[2] *= 1.5; ws[3] *= 1.6; ws[4] *= 1.8; }
  const size = pickW(S, ws), s = SIZES[size];
  const p = { id: S.nextPearl++, size, shape: pickW(S, K.W_SHAPE), lust: pickW(S, K.W_LUSTER), col: pickW(S, K.W_COLOUR), mm: s.mm[0] + ri(S, s.mm[1] - s.mm[0] + 1), bank: bank.id, trip: S.trip, kept: false, sold: false };
  p.value = pearlValue(p);
  return p;
}

// ---- weather and planning ------------------------------------------------------------------------------------------------------------------------------------------------
export const windOf = (S) => WINDS[S.wind];
export function beginDay(S) {
  S.wind = S.winds[S.day]; S.tripPhase = 'sea'; S.phase = 'plan'; S.sum = { bank: null, shells: 0, gifted: 0, pearls: [], cost: 0, how: '', rest: false, ev: '', stam0: S.stam };
  S.D = S.H = S.G = S.O = null; S.ev = null; S.chosen = -1;
  jtitle(S, `Trip ${S.trip + 1}, day ${S.day + 1}`);
  jlog(S, `${windOf(S).name}: ${windOf(S).sub}.`);
}
export function planOptions(S) {
  const forced = S.flags.forceRest;
  return [...BANKS.map((b) => ({ id: b.id, bank: b, ok: !forced && !(S.wind === 3 && b.id === 'deep') && !(S.stam < 25 && b.id !== 'shallow'), why: forced ? 'The boat is sheltering today.' : S.wind === 3 && b.id === 'deep' ? 'Too rough for the deep bank.' : S.stam < 25 && b.id !== 'shallow' ? 'You are too tired for this bank.' : '' })), { id: 'rest', ok: true, why: '' }];
}
export function choosePlan(S, id) {
  const opt = planOptions(S).find((o) => o.id === id);
  if (!opt || !opt.ok) return false;
  const sum = S.sum;
  if (id === 'rest') {
    sum.rest = true; S.stam = clamp(S.stam + 30, 0, K.MAX_STAM); S.spirit = clamp(S.spirit + 7, 0, 100); S.flags.forceRest = false;
    jlog(S, 'A rest day. The crew mended nets, patched the sail and slept in the shade of it.');
    S.O = null; return startTale(S);
  }
  sum.bank = id; S.bankId = id;
  S.G = newSong(S); S.phase = 'song';
  return true;
}

// ---- the song (the singer) -------------------------------------------------------------------------------------------------------------------------------------------
const BEAT = 0.55;
export function newSong(S) {
  const rounds = [3, 5].map((k) => {
    const slots = [0, 1, 2, 3, 4, 5, 6, 7], pat = [];
    while (pat.length < k) { const i = ri(S, slots.length); pat.push(slots.splice(i, 1)[0]); }
    pat.sort((a, b) => a - b);
    return { pat, hits: [], miss: 0, extra: 0 };
  });
  return { t: 0, round: 0, step: 'intro', st: 0, rounds, score: 0, beat: BEAT, done: false, flash: [], ev: [], evId: 0 };
}
// time axis of a round: [intro 1.1 s] [call: 8 beats] [answer: 8 beats] [gap 0.7 s]
export function songStep(S, dt) {
  const G = S.G; if (!G || G.done) return;
  G.t += dt; G.st += dt;
  const R = G.rounds[G.round], len = BEAT * 8;
  if (G.step === 'intro' && G.st >= 1.1) { G.step = 'call'; G.st = 0; G.callIdx = 0; }
  else if (G.step === 'call') {
    while (G.callIdx < R.pat.length && G.st >= R.pat[G.callIdx] * BEAT) { ev(G, 'call', { slot: R.pat[G.callIdx] }); G.callIdx++; }
    if (G.st >= len) { G.step = 'answer'; G.st = 0; }
  } else if (G.step === 'answer' && G.st >= len + 0.3) {
    R.miss = R.pat.length - R.hits.length;
    G.step = 'gap'; G.st = 0; ev(G, 'round', { round: G.round, ok: roundScore(R) });
  } else if (G.step === 'gap' && G.st >= 0.8) {
    if (G.round < G.rounds.length - 1) { G.round++; G.step = 'call'; G.st = 0; G.callIdx = 0; }
    else { G.done = true; G.score = G.rounds.reduce((a, r) => a + roundScore(r), 0) / G.rounds.length; }
  }
}
export const roundScore = (R) => clamp((R.hits.reduce((a, h) => a + (h.q === 'perfect' ? 1 : 0.6), 0) / R.pat.length) - 0.08 * R.extra, 0, 1);
export function songTap(S) {
  const G = S.G; if (!G || G.done || G.step !== 'answer') return null;
  const R = G.rounds[G.round];
  let best = -1, bd = 9;
  R.pat.forEach((s, i) => { if (R.hits.some((h) => h.i === i)) return; const d = Math.abs(G.st - s * BEAT); if (d < bd) { bd = d; best = i; } });
  if (best < 0 || bd > 0.2) { R.extra++; ev(G, 'extra'); return 'extra'; }
  const q = bd <= 0.09 ? 'perfect' : 'good';
  R.hits.push({ i: best, q, d: bd }); ev(G, q, { slot: R.pat[best] });
  return q;
}
export function finishSong(S, skipped = false) {
  const G = S.G;
  S.songScore = skipped ? 0 : (G ? G.score : 0);
  S.spirit = clamp(S.spirit + (skipped ? 0 : 4 + 14 * S.songScore), 0, 100);
  jlog(S, skipped ? 'No song this morning.' : S.songScore > 0.75 ? 'The song went well. Khalifa said your clapping was almost his.' : S.songScore > 0.4 ? 'The song was uneven but warm.' : 'You lost the beat. The crew laughed kindly.');
  S.G = null; startDive(S);
}

// ---- the dive ------------------------------------------------------------------------------------------------------------------------------------------------------------
export const capOf = (S, f = 1) => DIVE.baseCap * (0.65 + 0.35 * S.stam / 100) * (0.94 + 0.1 * S.spirit / 100) * windOf(S).cap * f;
export const ascentTime = (S, depth) => depth / (DIVE.ascend * clamp(0.9 + 0.2 * S.spirit / 100, 0.9, 1.1) * windOf(S).haul);
export function newDive(S, bankId, who = 'you') {
  const bank = BANKS.find((b) => b.id === bankId);
  const beds = [];
  for (let k = 0, guard = 0; k < bank.beds && guard < 200; guard++) {
    const x = +(rr(S, -8.5, 8.5)).toFixed(2);
    if (Math.abs(x) < 1.4 || beds.some((b) => Math.abs(b.x - x) < 1.7)) continue;
    const n = 1 + pickW(S, bank.id === 'deep' ? [0.25, 0.4, 0.35] : [0.4, 0.4, 0.2]);
    beds.push({ x, n: Math.min(n, bank.nMax), left: Math.min(n, bank.nMax), old: rnd(S) < K.OLD_CHANCE * (bank.id === 'deep' ? 1.3 : 1), id: k++ });
  }
  beds.sort((a, b) => a.x - b.x); beds.forEach((b, i) => { b.id = i; });
  return { who, bankId, depth: bank.depth, phase: who === 'you' ? 'breath' : 'descend', t: 0, pt: 0, g: 0, held: false, began: false, f: 1, dizzy: false, cap: 0, breath: 0, y: 0, x: 0, tx: null, at: -1, ringT: 0, pick: null, beds, basket: [], signal: false, how: '', perfect: 0, good: 0, rough: 0, broke: 0, ta: 0, td: bank.depth / DIVE.descend, ev: [], evId: 0, cost: 0, warn: false, bottomT: 0, result: null };
}
function startDive(S) {
  S.D = newDive(S, S.bankId, 'you'); S.phase = 'dive'; S.divesDone++;
  S.D.ta = ascentTime(S, S.D.depth);
}
const zoneOf = (g) => { const [a, b] = DIVE.zone; return g >= a && g <= b ? 1 : g < a ? clamp(1 - (a - g) / 0.5, 0, 1) : clamp(1 - (g - b) / 0.12, 0, 1); };
export const diveHold = (D, down) => { D.held = !!down; };
function releaseBreath(S, D) {
  const z = zoneOf(D.g); D.dizzy = D.g > 0.93;
  D.f = 0.8 + 0.4 * z - (D.dizzy ? 0.1 : 0); D.zone = z;
  D.cap = capOf(S, D.f); D.breath = D.cap; D.phase = 'descend'; D.pt = 0;
  ev(D, 'release', { z, dizzy: D.dizzy });
}
export const diveRing = (D) => ((D.ringT / DIVE.ring) % 1);
export function diveStep(S, dt, D = S.D) {
  if (!D) return;
  D.t += dt;
  if (D.phase === 'breath') {
    if (D.held) { D.began = true; D.g += dt / DIVE.inhale; if (D.g >= 1.04) { D.g = 1.04; D.held = false; } }
    else if (D.began) { if (D.g < 0.12) { D.began = false; D.g = 0; } else releaseBreath(S, D); }
    else D.g = Math.max(0, D.g - dt * 0.4);
    return;
  }
  D.pt += dt;
  if (D.phase === 'descend') {
    D.breath -= dt; D.y = D.depth * ease(D.pt / D.td);
    if (D.pt >= D.td) { D.phase = 'bottom'; D.pt = 0; D.y = D.depth; ev(D, 'land'); }
  } else if (D.phase === 'bottom') {
    D.breath -= dt; D.bottomT += dt;
    if (D.pick) {
      D.pick.t += dt;
      if (D.pick.t >= D.pick.dur) {
        const bed = D.beds[D.pick.bed];
        if (D.pick.q === 'rough' && rnd(S) < DIVE.roughLoss) { D.broke++; ev(D, 'broke'); }
        else { D.basket.push({ old: bed.old }); ev(D, 'got', { q: D.pick.q, old: bed.old, n: D.basket.length }); }
        D.pick = null; D.ringT = 0;
      }
    } else if (D.tx !== null) {
      const dir = Math.sign(D.tx - D.x), step = DIVE.swim * dt;
      if (Math.abs(D.tx - D.x) <= step) { D.x = D.tx; D.tx = null; D.ringT = 0; ev(D, 'arrive'); } else D.x += dir * step;
    } else if (D.at >= 0 && D.beds[D.at].left > 0) D.ringT += dt;
    D.warn = D.breath <= D.ta + DIVE.clean + 0.5;
    if (D.breath <= D.ta + DIVE.auto) diveSignal(S, D, true);
  } else if (D.phase === 'ascend') {
    D.breath -= dt; D.y = D.depth * (1 - ease(D.pt / D.ta));
    if (D.pt >= D.ta) { D.y = 0; D.phase = 'done'; D.pt = 0; finishDive(S, D); }
  }
}
export function diveGo(D, bedI) {
  if (D.phase !== 'bottom' || D.pick || bedI < 0 || bedI >= D.beds.length || D.beds[bedI].left <= 0) return false;
  D.tx = D.beds[bedI].x; D.at = bedI; D.ringT = 0; ev(D, 'go', { bed: bedI });
  if (Math.abs(D.tx - D.x) < 0.01) { D.tx = null; }
  return true;
}
export function divePick(D) {
  if (D.phase !== 'bottom' || D.pick || D.tx !== null || D.at < 0 || D.beds[D.at].left <= 0) return null;
  const p = diveRing(D), err = Math.abs(p - DIVE.ringAt);
  const q = err <= DIVE.perfect ? 'perfect' : err <= DIVE.good ? 'good' : 'rough';
  D[q]++; D.beds[D.at].left--; D.pick = { q, t: 0, dur: DIVE.pickTime[q], bed: D.at };
  ev(D, 'pick', { q });
  return q;
}
export function diveSignal(S, D, auto = false) {
  if (D.phase !== 'bottom') return false;
  if (D.pick) { D.pick = null; D.beds[D.at].left++; }
  const left = D.breath - D.ta;
  D.how = auto ? 'auto' : left >= DIVE.clean ? 'clean' : 'tight';
  D.signal = true; D.phase = 'ascend'; D.pt = 0; D.tx = null; ev(D, 'signal', { how: D.how });
  return true;
}
function finishDive(S, D) {
  const wind = windOf(S);
  let cost = (DIVE.stamBase + D.depth * DIVE.stamDepth) * wind.tire;
  if (D.how === 'tight') cost += DIVE.stamTight; else if (D.how === 'auto') cost += DIVE.stamAuto;
  if (D.dizzy) cost += 3;
  D.cost = Math.round(cost);
  D.result = { shells: D.basket.length, old: D.basket.filter((b) => b.old).length, how: D.how, cost: D.cost, perfect: D.perfect, good: D.good, rough: D.rough, broke: D.broke, bottom: D.bottomT };
  if (D.who === 'you') {
    S.stam = clamp(S.stam - D.cost, 0, K.MAX_STAM);
    if (D.how === 'auto') S.spirit = clamp(S.spirit - 3, 0, 100);
    S.shells.push(...D.basket.map((b) => ({ old: b.old, bank: D.bankId, from: 'you' }))); S.shellsTotal += D.basket.length;
    S.sum.shells = D.basket.length; S.sum.how = D.how; S.sum.cost += D.cost;
    jlog(S, `Dived at ${BANKS.find((b) => b.id === D.bankId).name}: ${D.basket.length} shell${D.basket.length === 1 ? '' : 's'}${D.how === 'clean' ? ', a clean surface' : D.how === 'tight' ? ', a tight surface' : ', hauled up by Salim'}.`);
    S.phase = 'divedone';
  }
}

// ---- the AI diver: Salim, Watch & Learn, and the Think hint -------------------------------------------------------------------------------------------------------------
export const reach = (D, i) => Math.abs(D.beds[i].x - D.x) / DIVE.swim;
export function bestBed(D) {
  const remain = D.breath - D.ta - DIVE.clean;     // seconds we may still spend before the surface margin
  let best = -1, bs = 0;
  D.beds.forEach((b, i) => {
    if (b.left <= 0) return;
    const sw = i === D.at && D.tx === null ? 0 : reach(D, i), back = Math.abs(b.x) * 0, need = sw + DIVE.pickTime.perfect + DIVE.ring * 0.75 + back;
    if (need > remain) return;
    const val = (b.left * (b.old ? 2.2 : 1)) / (0.6 + sw * 0.35 + (i === D.at ? 0 : 0.4));
    if (val > bs) { bs = val; best = i; }
  });
  return best;
}
export function aiPlan(D) {
  if (D.phase !== 'bottom' || D.signal) return null;
  const remain = D.breath - D.ta - DIVE.clean;
  if (D.pick || D.tx !== null) return null;
  if (D.at >= 0 && D.beds[D.at].left > 0 && remain > DIVE.pickTime.perfect + DIVE.ring) return { kind: 'pick' };
  const b = bestBed(D);
  if (b < 0) return { kind: 'signal' };
  return { kind: 'bed', bed: b };
}
export function aiAct(S, D, plan, hold = 0.8) {
  if (!plan) return;
  if (plan.kind === 'signal') diveSignal(S, D);
  else if (plan.kind === 'bed') diveGo(D, plan.bed);
  else if (plan.kind === 'pick') {
    const sk = S.aiSkill ?? 1;
    if (D.aiOff === undefined) D.aiOff = (rnd(S) - 0.5) * 2 * 0.22 * (1 - sk);
    const p = diveRing(D);
    if (Math.abs(p - (DIVE.ringAt + D.aiOff)) < 0.035) { divePick(D); D.aiOff = undefined; }
  }
  void hold;
}
export function aiTick(S, D, who) {
  if (!D || D.phase === 'done') return;
  if (D.phase === 'breath') { if (D.aiRel === undefined) D.aiRel = 0.8 - (1 - (S.aiSkill ?? 1)) * (rnd(S) * 0.5 - 0.1); diveHold(D, D.g < D.aiRel); return; }
  if (D.phase === 'bottom') {
    const pl = aiPlan(D);
    if (pl) {
      if (pl.kind === 'signal' || pl.kind === 'bed') aiAct(S, D, pl);
      else aiAct(S, D, pl);
    }
  }
  void who;
}
// Salim's dive for the haul scene: played out at once with the same engine and a patient policy
export function simPartner(S, bankId) {
  const D = newDive(S, bankId, 'salim'); D.cap = capOf(S, 0.98) * (S.salimTired ? 0.9 : 1); D.breath = D.cap; D.ta = ascentTime(S, D.depth);
  let guard = 0;
  while (D.phase !== 'ascend' && D.phase !== 'done' && guard++ < 4000) { aiTick(S, D); diveStep(S, 0.05, D); }
  const margin = clamp(D.breath - D.ta, 0, 6);
  return { depth: D.depth, ta: D.ta, margin: Math.max(1.5, margin * 0.8 + (S.salimTired ? 0 : 0.8)) - (S.salimTired ? 1.2 : 0), shells: D.basket.length, olds: D.basket.filter((b) => b.old).length, bottomT: D.bottomT, bankId };
}

// ---- the haul (you are the rope-puller) ------------------------------------------------------------------------------------------------------------------------------------
export const PULL = 0.6;
export function newHaul(S, bankId) {
  const P = simPartner(S, bankId);
  const wait = clamp(P.bottomT * 0.3, 3.2, 6.5);
  return { phase: 'wait', t: 0, wait, depth: P.depth, ta: P.ta, need: Math.ceil(P.ta / PULL * 1.0), prog: 0, pulls: 0, perfect: 0, ok: 0, weak: 0, combo: 0, breath: P.ta + P.margin, margin: P.margin, P, how: '', ph: 0, ev: [], evId: 0, T: 0, gift: 0, done: false, last: '' };
}
export function startHaul(S) { S.H = newHaul(S, S.bankId); S.phase = 'haul'; }
export function haulStep(S, dt) {
  const H = S.H; if (!H || H.done) return;
  H.t += dt;
  if (H.phase === 'wait') { if (H.t >= H.wait) { H.phase = 'haul'; H.T = 0; ev(H, 'tug'); } return; }
  H.T += dt; H.breath -= dt; H.ph = (H.T % PULL) / PULL;
  if (H.prog >= H.need - 0.001) {
    H.done = true; H.how = H.breath >= 1.0 ? 'smooth' : H.breath >= 0 ? 'tight' : 'late';
    const q = H.perfect / Math.max(1, H.pulls);
    H.gift = H.how === 'smooth' ? (q >= 0.7 ? 2 : 1) : 0;
    for (let i = 0; i < H.gift; i++) S.shells.push({ old: false, bank: S.bankId, from: 'salim' });
    S.sum.gifted = H.gift; S.stam = clamp(S.stam - K.DIVE.haulStam, 0, K.MAX_STAM);
    if (H.how === 'late') { S.salimTired = true; S.spirit = clamp(S.spirit - 2, 0, 100); } else if (H.how === 'smooth') S.salimTired = false;
    jlog(S, H.how === 'smooth' ? `Hauled Salim up smoothly. He gave you ${H.gift} shell${H.gift === 1 ? '' : 's'} from his basket.` : H.how === 'tight' ? 'Hauled Salim up, but it was tight. He surfaced gasping and laughing.' : 'Hauled too slowly. Salim came up spent and sat on the deck a long while.');
    S.phase = 'haulDone';
  }
}
export function haulTap(S) {
  const H = S.H; if (!H || H.phase !== 'haul' || H.done) return null;
  const e = Math.min(H.ph * PULL, (1 - H.ph) * PULL);
  let q = e <= 0.1 ? 'perfect' : e <= 0.2 ? 'ok' : 'weak';
  H.pulls++; H[q]++; H.prog += q === 'perfect' ? 1 : q === 'ok' ? 0.75 : 0.4; H.combo = q === 'weak' ? 0 : H.combo + 1; H.last = q;
  ev(H, 'pull', { q }); return q;
}

// ---- opening the shells ----------------------------------------------------------------------------------------------------------------------------------------------------
export function startOpen(S) {
  S.O = { i: 0, state: S.shells.length ? 'ready' : 'empty', t: 0, cur: null, found: [], fast: false, n: S.shells.length, ev: [], evId: 0 };
  S.phase = 'open';
  if (!S.shells.length) { jlog(S, 'No shells to open today.'); }
}
export function openTap(S) {
  const O = S.O; if (!O) return;
  if (O.state === 'ready') { O.state = 'cutting'; O.t = 0; ev(O, 'cut'); }
  else if (O.state === 'show') nextShell(S);
}
export function openAll(S) { const O = S.O; if (O) O.fast = true; }
function nextShell(S) {
  const O = S.O; O.i++; O.cur = null; O.t = 0;
  if (O.i >= O.n) { O.state = 'summary'; finishOpen(S); } else O.state = 'ready';
}
export function openStep(S, dt) {
  const O = S.O; if (!O) return;
  O.t += dt;
  if (O.state === 'cutting' && O.t >= (O.fast ? 0.18 : 0.6)) {
    const sh = S.shells[O.i], bank = BANKS.find((b) => b.id === sh.bank), p = rollPearl(S, bank, sh.old);
    O.cur = { shell: sh, pearl: p }; O.state = 'show'; O.t = 0;
    if (p) { S.pearls.push(p); O.found.push(p); S.bestPearl = Math.max(S.bestPearl, p.value); ev(O, 'pearl', { id: p.id, size: p.size }); } else ev(O, 'empty');
  } else if (O.state === 'show' && (O.fast || (!O.cur.pearl && O.t > 1.4)) && O.t >= (O.fast ? (O.cur.pearl ? 0.55 : 0.2) : 1.4)) nextShell(S);
  else if (O.state === 'ready' && O.fast && O.t >= 0.05) openTap(S);
}
function finishOpen(S) {
  const O = S.O, f = O.found;
  S.sum.pearls = f.map((p) => p.id);
  const worth = f.reduce((a, p) => a + p.value, 0);
  jlog(S, f.length ? `Opened ${O.n} shell${O.n === 1 ? '' : 's'}: ${f.length} pearl${f.length === 1 ? '' : 's'} (${f.map((p) => pearlName(p)).join(', ')}), about ${worth} rupees.` : `Opened ${O.n} shell${O.n === 1 ? '' : 's'}, no pearls today. The shells went to Rashid's pot.`);
  S.shells = [];
}
export function endOpen(S) { startTale(S); }

// ---- evening tales ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export function startTale(S) {
  S.phase = 'tale'; S.chosen = -1;
  const elig = EVENTS.filter((e) => !S.used.includes(e.id) && (!e.when || e.when(S)));
  if (elig.length && rnd(S) < 0.8) {
    const e = elig[ri(S, elig.length)]; S.used.push(e.id);
    S.ev = { id: e.id, title: e.title, lines: e.lines, choices: e.choices.map((c, i) => ({ i, label: c.label, ok: !c.when || c.when(S) })), result: '' };
    jlog(S, `${e.title}.`);
  } else {
    S.ev = { id: 'note', title: 'A quiet evening', lines: [SEA_NOTES[ri(S, SEA_NOTES.length)]], choices: [], result: '' };
    jlog(S, S.ev.lines[0]);
  }
  return true;
}
export function chooseTale(S, ci) {
  if (S.chosen >= 0 || !S.ev) return false;
  const src = EVENTS.find((e) => e.id === S.ev.id); if (!src) return false;
  const c = src.choices[ci]; if (!c || (c.when && !c.when(S))) return false;
  S.chosen = ci; const fx = c.fx || {};
  if (fx.cash) S.cash += fx.cash; if (fx.debt) S.debt = Math.max(0, S.debt + fx.debt);
  if (fx.spirit) S.spirit = clamp(S.spirit + fx.spirit, 0, 100); if (fx.stam) S.stam = clamp(S.stam + fx.stam, 0, K.MAX_STAM);
  if (fx.standing) S.standing = clamp(S.standing + fx.standing, 0, 10); if (fx.fam) S.famCredit += fx.fam;
  if (fx.salimTired) S.salimTired = true; if (fx.provDisc) S.provDisc += fx.provDisc;
  if (fx.forceRest) S.flags.stormNext = 'rest'; if (fx.stormTomorrow) S.flags.stormNext = 'work';
  if (fx.sellNow) { const mine = S.pearls.filter((p) => !p.kept && !p.sold); const tot = Math.round(mine.reduce((a, p) => a + p.value, 0) * fx.sellNow * (1 - K.BOAT_SHARE)); mine.forEach((p) => { p.sold = true; }); S.cash += tot; S.sold += mine.length; S.soldValue += tot; S.ev.sold = tot; }
  S.ev.result = c.result + (S.ev.sold ? ` (+${S.ev.sold} rupees after the boat's share)` : '');
  jlog(S, S.ev.result);
  S.sum.ev = S.ev.title;
  return true;
}
export function endTale(S) {
  S.pearls = S.pearls.filter((p) => !p.sold);
  S.phase = 'daysum';
}
export function daySummary(S) { return S.sum; }
export function endDay(S) {
  // the night: provisions restore stamina, spirit drifts back to its middle
  const pv = PROVS[S.prov];
  S.stam = clamp(S.stam + pv.rest, 0, K.MAX_STAM); S.spirit = clamp(S.spirit + (55 - S.spirit) * 0.12 + pv.spirit, 0, 100);
  S.day++; S.dayNo++;
  if (S.flags.stormNext) { const m = S.flags.stormNext; S.flags.stormNext = false; if (S.day < K.DAYS) { S.winds[S.day] = 3; S.flags.forceRest = m === 'rest'; } }
  if (S.day >= K.DAYS) { S.phase = 'trade'; S.tripPhase = 'harbour'; S.T = { sel: {}, done: false }; return 'harbour'; }
  beginDay(S); return 'day';
}

// ---- the harbour ---------------------------------------------------------------------------------------------------------------------------------------------------------------
export const lastTrip = (S) => S.trip >= K.TRIPS - 1;
export const sellable = (S) => S.pearls.filter((p) => !p.kept && !p.sold);
export function tradeQuote(S) {
  const ix = idx(S), rows = sellable(S).map((p) => ({ p, price: Math.round(p.value * ix) }));
  return { ix, rows };
}
export function tradeToggle(S, id) { if (lastTrip(S)) return; S.T.sel[id] = !S.T.sel[id]; }
export const tradeSold = (S, p) => lastTrip(S) || !S.T.sel[p.id];   // sel = HOLD
export function tradeTotals(S) {
  const q = tradeQuote(S), sell = q.rows.filter((r) => tradeSold(S, r.p)), gross = sell.reduce((a, r) => a + r.price, 0), share = Math.round(gross * K.BOAT_SHARE);
  return { ...q, sell, gross, share, net: gross - share, hold: q.rows.length - sell.length };
}
export function tradeConfirm(S) {
  const t = tradeTotals(S);
  t.sell.forEach((r) => { r.p.sold = true; });
  S.cash += t.net; S.sold += t.sell.length; S.soldValue += t.net;
  jlog(S, `Harbour: sold ${t.sell.length} pearl${t.sell.length === 1 ? '' : 's'} for ${t.gross} rupees (the boat kept ${t.share}); ${t.net} to you.`);
  S.pearls = S.pearls.filter((p) => !p.sold);
  S.phase = 'budget'; S.B = { debt: 0, fam: Math.max(0, K.FAMILY_NEED - S.famCredit), gift: 0 }; S.B.fam = Math.min(S.B.fam, Math.max(0, S.cash)); S.B.debt = 0;
  return t;
}
export const budgetLeft = (S) => S.cash - S.B.debt - S.B.fam - S.B.gift;
export function budgetStep(S, key, d) {
  const B = S.B, cap = { debt: S.debt, fam: K.FAMILY_NEED * 2, gift: K.GIFT }[key], step = key === 'gift' ? K.GIFT : key === 'fam' ? 6 : 10;
  const v = clamp(B[key] + d * step, 0, cap);
  if (d > 0 && v - B[key] > budgetLeft(S)) { const room = Math.max(0, budgetLeft(S)); B[key] = clamp(B[key] + (key === 'gift' ? 0 : room), 0, cap); return; }
  B[key] = v;
}
export function budgetAll(S, key) { const B = S.B; B[key] = 0; const room = Math.max(0, budgetLeft(S)); B[key] = Math.min(room, key === 'debt' ? S.debt : K.FAMILY_NEED * 2); }
export function budgetConfirm(S) {
  const B = S.B, need = K.FAMILY_NEED - S.famCredit, given = B.fam;
  S.cash -= B.debt + B.fam + B.gift; S.debt -= B.debt;
  if (B.gift) S.standing = clamp(S.standing + 1, 0, 10);
  if (given < need) S.strain += given < need / 2 ? 2 : 1;
  jlog(S, `Settled: ${B.debt} against the advance, ${B.fam} to the family${B.gift ? `, ${B.gift} to the community` : ''}. ${S.cash} rupees left.`);
  S.famCredit = 0;
  if (lastTrip(S)) { endSeason(S); return 'season'; }
  S.phase = 'prov'; return 'prov';
}
export function provCost(S, i) { return Math.max(2, PROVS[i].cost - S.provDisc); }
export function chooseProv(S, i) {
  const c = provCost(S, i); S.prov = i;
  if (S.cash >= c) S.cash -= c; else { S.debt += c - Math.max(0, S.cash); S.cash = 0; }
  S.provDisc = 0; if (S.started) { S.trip++; planTrip(S); } S.started = true; S.tripPhase = 'sea'; S.day = 0; S.stam = clamp(S.stam + 40, 0, 100);
  jlog(S, `Trip ${S.trip + 1}: ${PROVS[i].name}.`);
  beginDay(S); return true;
}
export function startSeason(S) { S.phase = 'prov'; }

// ---- the necklace ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const necklacePearls = (S) => S.necklace.map((id) => S.pearls.find((p) => p.id === id)).filter(Boolean);
export const trayPearls = (S) => S.pearls.filter((p) => !p.sold && !S.necklace.includes(p.id));
export function necklaceAdd(S, id) { if (S.necklace.length >= K.HIDE || S.necklace.includes(id)) return false; const p = S.pearls.find((q) => q.id === id); if (!p || p.sold) return false; p.kept = true; S.necklace.push(id); return true; }
export function necklaceRemove(S, id) { S.necklace = S.necklace.filter((x) => x !== id); const p = S.pearls.find((q) => q.id === id); if (p) p.kept = false; }
export function necklaceArrange(S) {
  const ps = necklacePearls(S).sort((a, b) => a.mm - b.mm || a.value - b.value), out = [];
  ps.forEach((p, i) => { if (i % 2) out.unshift(p); else out.push(p); });          // the biggest ends up in the middle
  S.necklace = out.map((p) => p.id);
}
export function necklaceScore(S) {
  const ps = necklacePearls(S), n = ps.length;
  if (!n) return { n: 0, harmony: 0, worth: 0, parts: { grad: 0, col: 0, lust: 0 } };
  let viol = 0; const c = (n - 1) / 2;
  for (let i = 0; i < n - 1; i++) { const up = i < c; if (up ? ps[i + 1].mm < ps[i].mm : ps[i + 1].mm > ps[i].mm) viol++; }
  const grad = n < 3 ? 1 : 1 - viol / (n - 1);
  const counts = {}; ps.forEach((p) => { counts[p.col] = (counts[p.col] || 0) + 1; });
  const col = Math.max(...Object.values(counts)) / n, lust = ps.reduce((a, p) => a + p.lust, 0) / (3 * n);
  const harmony = n < 3 ? 0.4 : 0.5 * grad + 0.3 * col + 0.2 * lust;
  const base = ps.reduce((a, p) => a + p.value, 0);
  return { n, harmony, worth: Math.round(base * (1 + 0.5 * harmony)), base, parts: { grad, col, lust } };
}

// ---- the end of the season ---------------------------------------------------------------------------------------------------------------------------------------------------
export function endSeason(S) {
  const paid = clamp((K.START_DEBT - S.debt) / K.START_DEBT, 0, 1), ns = necklaceScore(S);
  const parts = { debt: Math.round(40 * paid), family: Math.max(0, 20 - 5 * S.strain), standing: Math.round(S.standing), necklace: Math.round(Math.min(8, ns.worth / 150) + 7 * ns.harmony), savings: Math.round(15 * clamp(S.cash / 250, 0, 1)) };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  let stars = 1; K.STAR_AT.forEach((t, i) => { if (total >= t) stars = i + 1; });
  S.score = { total, stars, parts, necklace: ns }; S.phase = 'season'; S.tripPhase = 'end';
  S.fin = S.debt <= 0 ? 'clear' : S.debt <= K.START_DEBT * 0.45 ? 'part' : 'owe';
  jlog(S, `The season is over. Score ${total}, ${stars} star${stars === 1 ? '' : 's'}.`);
}

// ---- the coach (Think) ------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function coach(S) {
  const ph = S.phase, lines = [];
  if (ph === 'plan') {
    const opts = planOptions(S), rest = S.stam < 40;
    let pick = rest ? 'rest' : S.stam >= 70 && S.wind < 2 ? 'deep' : S.stam >= 45 ? 'middle' : 'shallow';
    if (!opts.find((o) => o.id === pick && o.ok)) pick = rest ? 'rest' : 'shallow';
    const nm = pick === 'rest' ? 'a rest day' : BANKS.find((b) => b.id === pick).name;
    lines.push(`Stamina ${Math.round(S.stam)}, spirit ${Math.round(S.spirit)}, wind: ${windOf(S).name.toLowerCase()}.`);
    lines.push(pick === 'rest' ? 'You are worn down. A rest day restores more than a hard dive earns.' : pick === 'deep' ? 'You are fresh and the wind is kind: the deep bank has the best shells.' : pick === 'middle' ? 'The middle bank is the steady choice: good shells without the deep bank\'s toll.' : 'Stay shallow: the shells are modest but the dive is gentle.');
    return { title: 'Think', lines, pick, label: `Choose ${nm}`, kind: 'plan' };
  }
  if (ph === 'dive' && S.D) {
    const D = S.D;
    if (D.phase === 'breath') return { title: 'Think', lines: ['Hold BREATHE and watch the gauge fill.', 'Let go with the needle in the green band. Too little gives less air; too much makes you dizzy.'], kind: 'breath' };
    if (D.phase === 'bottom') {
      const left = D.breath - D.ta, b = bestBed(D);
      lines.push(`Breath left ${Math.max(0, D.breath).toFixed(0)} s. You need ${D.ta.toFixed(0)} s to come up, plus ${DIVE.clean} s to be safe.`);
      if (left < DIVE.clean + 1.5) lines.push('Signal now.'); else if (b >= 0) lines.push(D.at === b && D.tx === null ? 'Pick here when the ring meets the shell.' : `The best bed within reach is ${D.beds[b].left} shell${D.beds[b].left === 1 ? '' : 's'}${D.beds[b].old ? ', and it is an old shell' : ''}.`); else lines.push('Nothing else is worth the risk: signal.');
      return { title: 'Think', lines, kind: 'dive', bed: b, signal: left < DIVE.clean + 1.5 || b < 0 };
    }
  }
  if (ph === 'haul') return { title: 'Think', lines: ['Wait for Salim\'s tug. Then tap the HAUL button as the ring reaches its mark, hand over hand.', 'Steady beats bring him up calmly. If you fall behind he runs out of air.'], kind: 'haul' };
  if (ph === 'song') return { title: 'Think', lines: ['Watch the drum marks while Khalifa calls. Then tap the same pattern, on the same beats, when it is your turn.'], kind: 'song' };
  if (ph === 'open') return { title: 'Think', lines: ['Tap a shell to cut it open. Old, pale shells hold pearls more often.'], kind: 'open' };
  if (ph === 'trade') {
    const q = tradeTotals(S);
    lines.push(`The merchant's index is ${q.ix.toFixed(2)}. ${lastTrip(S) ? 'This is the last market of the season, so everything not kept is sold.' : q.ix >= 1.03 ? 'Prices are good: sell.' : 'Prices are soft: hold the best pearls for the season\'s end if you can wait.'}`);
    lines.push(`Debt: ${S.debt} rupees. Family needs ${K.FAMILY_NEED} each trip.`);
    return { title: 'Think', lines, kind: 'trade' };
  }
  if (ph === 'budget') return { title: 'Think', lines: [`Debt is ${S.debt} rupees. Your family needs ${Math.max(0, K.FAMILY_NEED - S.famCredit)} for this trip: give it first, then repay what you can.`], kind: 'budget' };
  if (ph === 'prov') return { title: 'Think', lines: ['A fuller pot costs more but restores more stamina every night.'], kind: 'prov' };
  return null;
}

// ---- state-wide ticking for the clocks -----------------------------------------------------------------------------------------------------------------------------------------------
export function tick(S, dt) {
  S.clock = (S.clock || 0) + dt;
  if (S.phase === 'song') songStep(S, dt);
  else if (S.phase === 'dive') diveStep(S, dt);
  else if (S.phase === 'haul') haulStep(S, dt);
  else if (S.phase === 'open') openStep(S, dt);
}
