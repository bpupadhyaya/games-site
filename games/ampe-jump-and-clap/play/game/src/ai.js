// The computer opponent: five levels, from a beginner with strong habits to a mind reader that reads many patterns at once.
// A foot is 0 (LEFT) or 1 (RIGHT). The Leader wants the feet to MATCH, the Follower wants them to DIFFER.
// The brain only ever sees past rounds: it chooses before the player's tap and can never read it (no cheating).
// Pure and deterministic: all randomness comes from the rng handed in.

export const LEFT = 0, RIGHT = 1;
export const wantsMatch = (leader) => !!leader;                 // leader: true when this side is the Leader this round
export const wins = (leader, a, b) => (leader ? a === b : a !== b);   // does the side with this role win with feet a (own) vs b (other)?

// ---- predictors: each returns P(opponent plays RIGHT next) from the histories (oldest first) --------------------------------
// h = { opp: [..feet..], me: [..feet..], lead: [..bool: was *I* the leader that round..] }
const smooth = (c0, c1, k = 0.6) => (c1 + k) / (c0 + c1 + 2 * k);
function tableP(seq, order, ctxFn) {
  // counts of the next foot after the same context (the context is taken from the end of the histories)
  const n = seq.length;
  if (n <= order) return 0.5;
  const key = ctxFn(n);
  let c0 = 0, c1 = 0;
  for (let i = order; i < n; i++) {
    if (ctxFn(i) === key) { if (seq[i] === 1) c1++; else c0++; }
  }
  return smooth(c0, c1);
}
const PRED = {
  freq: (h) => { const o = h.opp, n = Math.min(o.length, 16); let c1 = 0; for (let i = o.length - n; i < o.length; i++) c1 += o[i]; return smooth(n - c1, c1, 0.8); },
  m1: (h) => tableP(h.opp, 1, (i) => `${h.opp[i - 1]}`),
  m2: (h) => tableP(h.opp, 2, (i) => `${h.opp[i - 2]}${h.opp[i - 1]}`),
  m3: (h) => tableP(h.opp, 3, (i) => `${h.opp[i - 3]}${h.opp[i - 2]}${h.opp[i - 1]}`),
  joint: (h) => tableP(h.opp, 1, (i) => `${h.me[i - 1]}${h.opp[i - 1]}`),                      // reacts to what happened last round
  role: (h) => tableP(h.opp, 1, (i) => `${h.lead[i - 1] ? 1 : 0}${h.opp[i - 1]}${h.me[i - 1]}`),    // ... and to who led
};

// the same predictors pointed at my OWN history, seen from the opponent's side (what would a reader predict I will do?)
const swapped = (h) => ({ opp: h.me, me: h.opp, lead: h.lead.map((l) => !l) });

const bestResponse = (leader, pRight) => {
  const guess = pRight >= 0.5 ? RIGHT : LEFT;       // the opponent's most likely foot
  return leader ? guess : 1 - guess;                // Leader matches it, Follower differs from it
};

// ---- the levels ------------------------------------------------------------------------------------------------------------
function habitBrain(level, rng) {
  const st = { last: -1 };
  const cfg = level === 1 ? { rep: 0.74, right: 0.5, noise: 0.0 } : { rep: 0.5, right: 0.64, noise: 0.0, cycle: true };
  return {
    choose(ctx) {
      let f;
      if (level === 1) {
        if (st.last < 0) f = rng.chance(0.5) ? RIGHT : LEFT;
        else f = rng.chance(cfg.rep) ? st.last : 1 - st.last;
      } else {
        // level 2: a lean to the right foot, with a short cycle of three (right, right, left) it follows about half of the time
        const k = ctx.round % 3;
        const pat = k === 2 ? LEFT : RIGHT;
        if (ctx.h.opp.length >= 2 && rng.chance(0.4)) {
          // a simple reading: expects the player to repeat the last foot
          const last = ctx.h.opp[ctx.h.opp.length - 1];
          f = ctx.leader ? last : 1 - last;
        } else f = rng.chance(0.5) ? pat : (rng.chance(cfg.right) ? RIGHT : LEFT);
      }
      st.last = f;
      return f;
    },
    observe() {},
  };
}

function freqBrain(rng) {
  return {
    choose(ctx) {
      const h = ctx.h;
      if (h.opp.length < 3) return rng.chance(0.5) ? RIGHT : LEFT;
      if (rng.chance(0.22)) return rng.chance(0.5) ? RIGHT : LEFT;
      return bestResponse(ctx.leader, PRED.freq(h));
    },
    observe() {},
  };
}

// Strategy bank for the two strongest levels: for each predictor, "read the player" (A), "assume the player is reading me" (B),
// and the opposite of each (the player is reading my reading ...). Scored by decayed hindsight; the best one plays.
function bankBrain(level, rng) {
  const names = level === 4 ? ['m1', 'm2', 'joint', 'role', 'freq'] : ['freq', 'm1', 'm2', 'm3', 'joint', 'role'];
  const metas = level === 4 ? ['A'] : ['A', 'B', 'nA', 'nB'];
  const strategies = [];
  for (const p of names) for (const m of metas) strategies.push({ p, m, score: 0, slow: 0, pick: -1 });
  const noise = level === 4 ? 0.14 : 0.0;
  let wr = 0.5;                                               // my own recent win rate: when I am being read I change my habits
  const decay = level === 4 ? 0.88 : 0.92;
  const compute = (s, ctx) => {
    const h = ctx.h;
    const A = bestResponse(ctx.leader, PRED[s.p](h));
    if (s.m === 'A') return A;
    if (s.m === 'nA') return 1 - A;
    // B: predict what a reader would expect me to do from my own history, assume they best-respond (they hold the other role),
    // then best-respond to that
    const sw = swapped(h);
    const oppExpectsMe = PRED[s.p](sw);                       // P(I play RIGHT) in the eyes of a reader
    const oppFoot = bestResponse(!ctx.leader, oppExpectsMe);  // what that reader would play (their role is the other one)
    const B = ctx.leader ? oppFoot : 1 - oppFoot;
    return s.m === 'B' ? B : 1 - B;
  };
  let lastCtx = null, lastPlay = -1;
  return {
    choose(ctx) {
      lastCtx = ctx;
      for (const s of strategies) s.pick = compute(s, ctx);
      if (ctx.h.opp.length < 3) { return rng.chance(0.5) ? RIGHT : LEFT; }
      let best = strategies[0];
      for (const s of strategies) if (s.score + 0.6 * s.slow > best.score + 0.6 * best.slow) best = s;
      let f = best.pick;
      // when several strategies tie or the evidence is thin, stay unpredictable
      if (noise && rng.chance(noise)) f = rng.chance(0.5) ? RIGHT : LEFT;
      if (level === 5) {
        const bluff = wr < 0.42 ? 0.35 : 0.03;                      // being read: bluff and mix; reading well: stay on the plan
        if (rng.chance(bluff)) f = rng.chance(0.5) ? RIGHT : LEFT;
      }
      lastPlay = f;
      return f;
    },
    observe(oppFoot) {
      if (!lastCtx) return;
      if (lastPlay >= 0) wr = wr * 0.9 + 0.1 * (wins(lastCtx.leader, lastPlay, oppFoot) ? 1 : 0);
      for (const s of strategies) {
        const win = wins(lastCtx.leader, s.pick, oppFoot) ? 1 : -1;
        s.score = s.score * decay + win;
        s.slow = s.slow * 0.97 + win;
      }
    },
  };
}

export function createBrain(level, rng) {
  const hist = { opp: [], me: [], lead: [] };
  const inner = level <= 2 ? habitBrain(level, rng) : level === 3 ? freqBrain(rng) : bankBrain(level, rng);
  let round = 0, pending = null;
  return {
    level,
    // leader: is this brain the Leader in the coming round?
    choose(leader) {
      const ctx = { h: hist, leader: !!leader, round };
      const f = inner.choose(ctx);
      pending = { leader: !!leader, f };
      return f;
    },
    // after the reveal: the foot this brain played, the foot the other side played and whether this brain led
    observe(myFoot, oppFoot, leader) {
      inner.observe(oppFoot, myFoot, !!leader);
      hist.opp.push(oppFoot); hist.me.push(myFoot); hist.lead.push(!!leader);
      round++; pending = null;
    },
    history: () => hist,
  };
}

// ---- Think hint: the most exploitable habit in the player's play, from real counts -------------------------------------------
// me = the player's feet (oldest first), opp = the computer's feet, lead = was the player the Leader (per round)
export function habitHint(me, opp, lead) {
  const n = me.length;
  if (n < 4) return { text: 'Not enough rounds yet to see a habit. Play a few and ask again.', reason: 'few', counts: {} };
  const win = Math.min(n, 12), from = n - win;
  let r = 0, rep = 0, alt = 0;
  for (let i = from; i < n; i++) { if (me[i] === RIGHT) r++; if (i > from) { if (me[i] === me[i - 1]) rep++; else alt++; } }
  const l = win - r;
  const pairs = rep + alt;
  const cands = [];
  if (Math.max(l, r) / win >= 0.65) cands.push({ k: 'bias', s: Math.max(l, r) / win, side: r > l ? 'Right' : 'Left', n: Math.max(l, r), of: win });
  if (pairs >= 4 && rep / pairs >= 0.65) cands.push({ k: 'repeat', s: rep / pairs, n: rep, of: pairs });
  if (pairs >= 4 && alt / pairs >= 0.65) cands.push({ k: 'alt', s: alt / pairs, n: alt, of: pairs });
  // after losing a round do you switch?
  let lostN = 0, lostSw = 0, lostSt = 0;
  for (let i = Math.max(1, from); i < n; i++) {
    const lost = !wins(lead[i - 1], me[i - 1], opp[i - 1]);
    if (lost) { lostN++; if (me[i] === me[i - 1]) lostSt++; else lostSw++; }
  }
  if (lostN >= 3 && lostSw / lostN >= 0.75) cands.push({ k: 'lostSwitch', s: lostSw / lostN, n: lostSw, of: lostN });
  if (lostN >= 3 && lostSt / lostN >= 0.75) cands.push({ k: 'lostStay', s: lostSt / lostN, n: lostSt, of: lostN });
  if (!cands.length) return { text: `Your last ${win} rounds look mixed: ${l} Left, ${r} Right. Keep it that way: hard to read.`, reason: 'mixed', counts: { l, r, win } };
  cands.sort((a, b) => b.s - a.s);
  const c = cands[0];
  const sideFav = c.side;
  const sideOther = sideFav === 'Right' ? 'Left' : 'Right';
  const lastFoot = me[n - 1] === RIGHT ? 'Right' : 'Left';
  const other = me[n - 1] === RIGHT ? 'Left' : 'Right';
  let text, advice;
  if (c.k === 'bias') { text = `You chose ${sideFav} in ${c.n} of your last ${c.of} rounds.`; advice = `Throw ${sideOther} more often.`; }
  else if (c.k === 'repeat') { text = `You kept the same foot ${c.n} times out of ${c.of} rounds in a row.`; advice = `Switch feet sometimes. Next time try ${other}.`; }
  else if (c.k === 'alt') { text = `You switched feet ${c.n} times out of ${c.of} rounds in a row.`; advice = `Repeat a foot now and then. Next time try ${lastFoot}.`; }
  else if (c.k === 'lostSwitch') { text = `After losing a round you switched feet ${c.n} of ${c.of} times.`; advice = `After a loss, try keeping your foot.`; }
  else { text = `After losing a round you kept your foot ${c.n} of ${c.of} times.`; advice = `After a loss, try switching.`; }
  return { text: `${text} ${advice}`, reason: c.k, counts: { n: c.n, of: c.of } };
}

// ---- Think hint, part 2: what will the OPPONENT do? From its real past (never from its secret choice for the coming round) -------
// oppFeet = the computer's past feet (oldest first). iLead = am I (the player) the Leader in the coming round?
export function predictHint(oppFeet, iLead, who = 'You', them = 'The computer') {
  const n = oppFeet.length;
  const name = (f) => (f === RIGHT ? 'Right' : 'Left');
  if (n < 4) return { text: `${them} has not shown a habit yet. Pick either foot and watch what it does.`, foot: -1, reason: 'few' };
  const win = Math.min(n, 10);
  let r = 0;
  for (let i = n - win; i < n; i++) r += oppFeet[i];
  const l = win - r, fav = r >= l ? RIGHT : LEFT, favN = Math.max(l, r);
  const last = oppFeet[n - 1];
  let same = 0, tot = 0;
  for (let i = 1; i < n; i++) if (oppFeet[i - 1] === last) { tot++; if (oppFeet[i] === last) same++; }
  const cand = [];
  if (favN / win >= 0.65) cand.push({ k: 'freq', s: favN / win, f: fav, t: `It threw ${name(fav)} in ${favN} of its last ${win} rounds.` });
  if (tot >= 4 && same / tot >= 0.68) cand.push({ k: 'repeat', s: same / tot, f: last, t: `After ${name(last)} it threw ${name(last)} again ${same} of ${tot} times.` });
  if (tot >= 4 && (tot - same) / tot >= 0.68) cand.push({ k: 'switch', s: (tot - same) / tot, f: 1 - last, t: `After ${name(last)} it switched feet ${tot - same} of ${tot} times.` });
  if (!cand.length) return { text: `No clear habit in the last ${win} rounds of ${them.toLowerCase()} (${l} Left, ${r} Right). Mix your feet.`, foot: -1, reason: 'mixed' };
  cand.sort((a, b) => b.s - a.s);
  const c = cand[0];
  const mine = iLead ? c.f : 1 - c.f;
  const why = iLead ? `${who} lead${who === 'You' ? '' : 's'}, so the feet should match: throw ${name(mine)}.` : `${who} follow${who === 'You' ? '' : 's'}, so the feet should differ: throw ${name(mine)}.`;
  return { text: `${c.t} It will probably throw ${name(c.f)} next. ${why}`, foot: mine, reason: c.k };
}
