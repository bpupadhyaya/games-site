// The computer farmer. It plans the water with a real look-ahead: every possible gate change is tried on a copy of the hillside, the next seconds are simulated, and
// the change that keeps the most plots inside the water band they want wins. Jobs follow a simple order of urgency. Used by Watch & Learn, Think and the store pictures.
import { levelById, gateList, plotName, SEASONS } from './levels.js';
import { update, snapshot, bandFor, bandDev, gateState, setGate, jobsFor, canJob, CROP, yearTime } from './farm.js';

const HORIZON = 14;

function objective(f0, change) {
  const c = snapshot(f0);
  for (const ch of Array.isArray(change) ? change : change ? [change] : []) setGate(c, ch.gate, ch.open);
  const lv = levelById(c.lv);
  const w0 = c.plots.map((p) => p.wall), soil0 = c.plots.map((p) => p.soil), rel0 = c.released, was0 = c.wasted;
  let pen = 0;
  const dev = new Array(c.plots.length).fill(0);
  for (let k = 0; k < HORIZON; k++) {
    update(c, 1);
    for (let i = 0; i < c.plots.length; i++) {
      const b = bandFor(c, i);
      if (!b) continue;
      const d = bandDev(b, c.plots[i].w);
      const wt = c.plots[i].crop === CROP.FALLOW ? 1 : 2.2;
      const own = c.plots[i].owner ? 1.1 : 1;
      pen += Math.pow(d, 1.3) * wt * own; dev[i] += d;
    }
  }
  let score = -pen;
  for (let i = 0; i < c.plots.length; i++) { score += (c.plots[i].soil - soil0[i]) * 12; score -= Math.max(0, w0[i] - c.plots[i].wall) * 25; }
  score -= (c.wasted - was0) * 0.35;
  if (lv.valleyNeed > 0) {
    const pace = lv.valleyNeed * Math.min(1, (yearTime(c) + 20) / 150);
    score -= Math.max(0, pace - c.released) * 0.6;
    score += (c.released - rel0) * 0.4 * (c.released < lv.valleyNeed ? 1 : 0);
  }
  score -= 0.9 * (Array.isArray(change) ? change.length : change ? 1 : 0);
  return { score, dev };
}

export function gateName(lv, g) {
  if (g.kind === 'f') return `feed gate ${g.c + 1}`;
  if (g.kind === 'd') return g.r === lv.R - 1 ? `valley outlet below ${plotName(lv, g.r * lv.C + g.c)}` : `spill gate below ${plotName(lv, g.r * lv.C + g.c)}`;
  return `side channel ${plotName(lv, g.r * lv.C + g.c)} to ${plotName(lv, g.r * lv.C + g.c + 1)}`;
}

const need = (f, i) => { const b = bandFor(f, i); return b ? `${b[0]} to ${b[1]}` : 'any'; };

function jobPlan(f) {
  const lv = levelById(f.lv);
  const order = ['harvest', 'repair', 'plant', 'pests', 'tend'];
  const mine = f.plots.map((p, i) => i);
  for (const type of order) {
    for (const i of mine) {
      const p = f.plots[i];
      if (type === 'repair' && p.wall > 0.35) continue;
      if (type === 'pests' && p.pest < 0.55) continue;
      if (type === 'tend' && p.weed < 0.6) continue;
      if (!jobsFor(f, i).includes(type)) continue;
      if (!canJob(f, i, type).ok) continue;
      const nm = plotName(lv, i);
      const text = {
        harvest: `${nm} has turned gold and is dry enough. Harvest it now: a ripe crop left standing loses health in rain.`,
        repair: `The wall under ${nm} is weak (${Math.round(p.wall * 100)} percent). A broken wall leaks and can empty the field below, so it is repaired first.`,
        plant: `${nm} is soaked to soft mud (${p.w.toFixed(1)} hands of water), so the seedlings go in now. Early planting gives the rice the whole season to grow.`,
        pests: `Snails are eating the rice in ${nm}. Clearing them costs one labour and protects the harvest.`,
        tend: `Weeds are crowding ${nm}. Pulling them keeps the rice healthy.`,
      }[type];
      return { kind: 'job', plot: i, job: type, plots: [i], title: `${{ harvest: 'Harvest', repair: 'Repair the wall of', plant: 'Plant', pests: 'Clear snails from', tend: 'Weed' }[type]} ${nm}`, text };
    }
  }
  return null;
}

// returns { kind: 'job' | 'gate' | 'wait', ... } with a plain-language explanation
export function suggest(f) {
  const lv = levelById(f.lv);
  if (f.ph !== 'run') return { kind: 'wait', title: 'Waiting', text: 'The year is not running.', plots: [] };
  const j = jobPlan(f);
  if (j) return j;
  const base = objective(f, null);
  const gates = gateList(lv).filter((g) => gateState(f, g) !== -1);
  const flipped = (chs, g) => chs.some((c) => c.gate.id === g.id);
  const feedGates = gates.filter((g) => g.kind === 'f');
  const macros = [];
  const openFeeds = feedGates.filter((g) => gateState(f, g) === 1), shutFeeds = feedGates.filter((g) => gateState(f, g) === 0);
  if (openFeeds.length > 1) macros.push(openFeeds.map((g) => ({ gate: g, open: false })));
  if (shutFeeds.length > 1) macros.push(shutFeeds.map((g) => ({ gate: g, open: true })));
  const bestSingle = (chs, ref) => {
    let top = null;
    const cands = gates.filter((g) => !flipped(chs, g)).map((g) => [{ gate: g, open: !gateState(f, g) }]);
    for (const m of macros) if (!m.some((c) => flipped(chs, c.gate))) cands.push(m);
    for (const cand of cands) {
      const o = objective(f, [...chs, ...cand]);
      if (!top || o.score > top.o.score) top = { ch: cand, o };
    }
    return top && top.o.score > ref.score + 0.8 ? top : null;
  };
  let best = null;
  const first = bestSingle([], base);
  if (first) best = { chs: first.ch, o: first.o };
  else {
    // no single change helps: look for two changes that only help together
    const singles = gates.map((g) => { const ch = { gate: g, open: !gateState(f, g) }; return { ch, o: objective(f, ch) }; }).sort((x, y) => y.o.score - x.o.score).slice(0, 7);
    for (let a = 0; a < singles.length; a++) for (let b2 = a + 1; b2 < singles.length; b2++) {
      const o = objective(f, [singles[a].ch, singles[b2].ch]);
      if (o.score > base.score + 2 && (!best || o.score > best.o.score)) best = { chs: [singles[a].ch, singles[b2].ch], o };
    }
  }
  // keep adding the next best change while it clearly helps (the spring cannot be throttled: closing every feed gate takes three steps)
  while (best && best.chs.length < 4) {
    const nxt = bestSingle(best.chs, best.o);
    if (!nxt || nxt.o.score < best.o.score + 1.5) break;
    best = { chs: [...best.chs, ...nxt.ch], o: nxt.o };
  }
  if (!best || best.o.score < base.score + 0.8) {
    const worst = f.plots.map((p, i) => ({ i, d: bandDev(bandFor(f, i), p.w) })).sort((a, b) => b.d - a.d)[0];
    const text = worst && worst.d > 0.3
      ? `Every gate change makes things worse for now. ${plotName(lv, worst.i)} is ${f.plots[worst.i].w.toFixed(1)} hands and wants ${need(f, worst.i)}; waiting lets the water already on its way arrive.`
      : `Every plot is inside the water band for ${SEASONS[f.season].name.toLowerCase()} season. Nothing to change: watch the gauges and let the rice work.`;
    return { kind: 'wait', title: 'Wait and watch', text, plots: worst && worst.d > 0.3 ? [worst.i] : [] };
  }
  const gain = best.o.dev.map((d, i) => ({ i, d: base.dev[i] - d })).filter((x) => x.d > 0.5).sort((a, b) => b.d - a.d);
  const loss = best.o.dev.map((d, i) => ({ i, d: d - base.dev[i] })).filter((x) => x.d > 1.0).sort((a, b) => b.d - a.d);
  const gp = gain.slice(0, 2).map((x) => x.i);
  const names = gp.map((i) => plotName(lv, i)).join(' and ');
  const phr = best.chs.map((c) => `${c.open ? 'open' : 'close'} the ${gateName(lv, c.gate)}`);
  const sentence = phr.length > 2 ? `${phr.slice(0, -1).join(', ')} and ${phr[phr.length - 1]}` : phr.length > 1 ? `${phr[0]} and ${phr[1]}` : phr[0];
  const cap = (x) => x[0].toUpperCase() + x.slice(1);
  const c0 = best.chs[0];
  let why;
  if (gp.length) {
    const g0 = gp[0];
    const w0 = f.plots[g0].w;
    const b0 = bandFor(f, g0);
    const state = !b0 ? 'needs steady water' : w0 < b0[0] ? `is short of water (${w0.toFixed(1)} hands, wants ${need(f, g0)})` : w0 > b0[1] ? `has too much water (${w0.toFixed(1)} hands, wants ${need(f, g0)})` : 'is about to leave its band';
    why = `${names} ${gp.length > 1 ? 'need' : 'needs'} it: ${plotName(lv, g0)} ${state}.`;
  } else {
    why = `${c0.open ? 'Water is being wasted or held back for no reason' : 'The water passing this gate is not needed below, and holding it protects the walls'}${c0.gate.kind === 'd' && c0.gate.r === lv.R - 1 ? '; the village in the valley also needs its share' : ''}.`;
  }
  if (loss.length) why += ` ${plotName(lv, loss[0].i)} waits a little longer: that is the price of this choice.`;
  const text = `${cap(sentence)}.\n\nWhy: ${why}`;
  const title = best.chs.length === 1 ? cap(sentence) : `${cap(c0.open ? 'open' : 'close')} ${best.chs.length} gates`;
  const g0 = c0.gate;
  const focusSet = gp.length ? gp : [g0.kind === 'f' ? g0.c : g0.r * lv.C + g0.c];
  return { kind: 'gate', gate: g0.id, open: c0.open, steps: best.chs.map((c) => ({ gate: c.gate.id, open: c.open })), plots: focusSet, title, text, gain: best.o.score - base.score };
}
