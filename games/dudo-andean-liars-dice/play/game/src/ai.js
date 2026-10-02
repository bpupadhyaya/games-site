// Computer players. Every level reads the same public table and only its own hand; none looks at another cup.
// Levels differ in how well they estimate odds, how much they read the bidding history, how often they bluff and when they call.
import { living, nextLiving, legalBids, prevBid, totalDice, wildApplies, faceChance, countIn, probAtLeast, binomPmf, canCalzo } from './rules.js';

export const LEVELS = [
  { id: 'novice', n: 0, name: 'Wawa', es: 'Wawa', blurb: 'New to the game: misjudges odds and often bids wildly.', blurbEs: 'Recién empieza: calcula mal y apuesta a la loca.' },
  { id: 'casual', n: 1, name: 'Chasqui', es: 'Chasqui', blurb: 'Plays the odds roughly and never bluffs on purpose.', blurbEs: 'Juega con las probabilidades a ojo y no hace faroles.' },
  { id: 'skilled', n: 2, name: 'Yachay', es: 'Yachay', blurb: 'Counts correctly, bluffs now and then, calls exact counts.', blurbEs: 'Cuenta bien, hace algún farol y canta calzo.' },
  { id: 'expert', n: 3, name: 'Amauta', es: 'Amauta', blurb: 'Reads what the bids say about other cups. Bluffs with care.', blurbEs: 'Lee lo que dicen las apuestas sobre los otros cachos.' },
  { id: 'master', n: 4, name: 'Kuntur', es: 'Kuntur', blurb: 'Weighs every bid by risk and bluffs when the table will believe it.', blurbEs: 'Pesa cada apuesta por riesgo y farolea cuando la mesa le cree.' },
];

// ev: how well it estimates (noise), lean: how much a face bid by someone else suggests they hold it,
// bluff: chance of a deliberate bluff when raising, dudoC: how strongly it prefers a call to a risky raise,
// calzo: minimum exact-count chance to call calzo (>1 never), safe: probability it wants from an honest raise.
export const PARAMS = [
  { noise: 0.30, wild: false, own: 0.7, lean: 0, bluff: 0.30, wildBluff: true, dudoC: 0.55, calzo: 9, safe: 0.30, risk: false, cred: 0.5 },
  { noise: 0.20, wild: true, own: 1, lean: 0, bluff: 0, dudoC: 1.0, calzo: 9, safe: 0.45, risk: false, cred: 0.5 },
  { noise: 0.08, wild: true, own: 1, lean: 0, bluff: 0.08, dudoC: 0.8, calzo: 0.6, safe: 0.6, risk: false, cred: 0.8 },
  { noise: 0, wild: true, own: 1, lean: 0.12, bluff: 0.10, dudoC: 0.65, calzo: 0.6, safe: 0.7, risk: false, cred: 0.8 },
  { noise: 0, wild: true, own: 1, lean: 0.12, bluff: 0, dudoC: 0.8, calzo: 0.6, safe: 0.7, risk: true, cred: 0.8, callT: 0.35, step: 0.02, circ: 1 },
];

// Probability the bid holds, as this level sees it.
export function estimate(st, me, hand, bid, lvl, rng) {
  const P = PARAMS[lvl];
  const total = totalDice(st), u = total - hand.length;
  const wild = P.wild ? wildApplies(st, bid.f) : false;
  let own = countIn(hand, bid.f, wild);
  if (P.own < 1 && rng.next() > P.own) own = 0;
  let pf = P.wild ? faceChance(st, bid.f) : 1 / 6;
  if (P.lean > 0 && u > 0) {
    let extra = 0;
    const seen = new Set();
    for (const b of st.bids) {
      if (b.p === me || b.f !== bid.f || seen.has(b.p)) continue;
      seen.add(b.p); extra += P.lean * st.players[b.p].dice;
    }
    pf = Math.min(0.95, pf + extra / u);
  }
  let p = probAtLeast(u, bid.q - own, pf);
  if (P.noise) p = Math.max(0, Math.min(1, p + (rng.next() * 2 - 1) * P.noise));
  return p;
}

// Public (hand-blind) credibility used by the risk model: how likely others think this bid is.
function publicProb(st, bid) {
  return probAtLeast(totalDice(st), bid.q, faceChance(st, bid.f));
}

// Returns { act: 'dudo' | 'calzo' | 'bid', q, f, pPrev, pBid } for player `me`.
export function decide(st, me, rng, forceLvl) {
  const pl = st.players[me], lvl = forceLvl ?? pl.level, P = PARAMS[lvl], hand = pl.hand;
  const prev = prevBid(st);
  const cands = legalBids(st);
  const scored = cands.map((b) => ({ ...b, p: estimate(st, me, hand, b, lvl, rng), own: countIn(hand, b.f, wildApplies(st, b.f)) }));
  const rank = (b) => b.q * 10 + (b.f === 1 ? 0 : b.f);
  let best = null;
  const safe = scored.filter((b) => b.p >= P.safe).sort((a, b) => rank(a) - rank(b));
  if (safe.length) {
    // prefer the smallest safe raise; among near-equal ranks prefer faces held
    const first = safe[0];
    const close = safe.filter((b) => b.q <= first.q + 0 && b.q === first.q).sort((a, b) => b.own - a.own || b.p - a.p);
    best = close[0] ?? first;
  } else if (scored.length) best = scored.reduce((a, b) => (b.p > a.p ? b : a));
  let pPrev = prev ? estimate(st, me, hand, prev, lvl, rng) : 1;
  if (P.risk && scored.length) {
    // Master: for each raise, the chance the bid is false times the chance the next seat calls it.
    const nxt = nextLiving(st, me), nd = st.players[nxt].dice, tot = totalDice(st);
    const minQ = prev ? Math.min(...scored.map((b) => b.q)) : 1;
    for (const b of scored) {
      const pf = faceChance(st, b.f);
      let call = 0;
      for (let c = 0; c <= nd; c++) {
        const pc = binomPmf(nd, c, pf);
        if (probAtLeast(tot - nd, b.q - c, pf) < P.callT) call += pc;
      }
      const k = living(st).length - 1;
      b.risk = (1 - b.p) * (1 - (1 - call) ** (1 + (k - 1) * P.circ)) + P.step * (b.q - minQ);
    }
    const bestR = scored.reduce((x, y) => (y.risk < x.risk ? y : x));
    best = bestR;
    if (prev && pPrev < bestR.risk * P.dudoC) return { act: 'dudo', pPrev, pBest: best.p };
  } else if (prev) {
    if (!best) return { act: 'dudo', pPrev };
    const raiseRisk = 1 - best.p;
    if (pPrev < raiseRisk * P.dudoC) return { act: 'dudo', pPrev, pBest: best.p };
  }
  if (prev && P.calzo <= 1 && canCalzo(st)) {
    const u = totalDice(st) - hand.length;
    const own = countIn(hand, prev.f, wildApplies(st, prev.f));
    const pe = binomPmf(u, prev.q - own, faceChance(st, prev.f));
    if (pe >= P.calzo) return { act: 'calzo', pPrev, pExact: pe };
  }
  // deliberate bluff
  if (P.bluff > 0 && scored.length > 1 && rng.chance(P.bluff)) {
    const bl = scored.filter((b) => b.own <= 1 && b.p >= 0.25 && b.p <= 0.5 && publicProb(st, b) >= P.cred);
    if (bl.length) { bl.sort((a, b) => rank(a) - rank(b)); const pick = bl[Math.min(bl.length - 1, rng.int(Math.min(3, bl.length)))]; return { act: 'bid', q: pick.q, f: pick.f, pPrev, pBid: pick.p, bluff: true }; }
  }
  if (P.wildBluff && rng.chance(0.25)) { const pick = rng.pick(scored.slice(0, Math.min(scored.length, 12))); return { act: 'bid', q: pick.q, f: pick.f, pPrev }; }
  if (!best) return { act: 'dudo', pPrev };
  return { act: 'bid', q: best.q, f: best.f, pPrev, pBid: best.p };
}
