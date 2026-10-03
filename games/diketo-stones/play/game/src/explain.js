// The reasons shown by the Think button and in Watch & Learn. Every number comes from the engine (sim.js / ai.js):
// the hand's time from the real timeline model, the chance from the same model the computer players use.
import { airtime, HOME, dist, H_MIN } from './sim.js';
import { preTime, HINT } from './ai.js';

const pct = (v) => Math.min(99, Math.round(Math.max(0, Math.min(1, v)) * 100));
const sec = (v) => (Math.round(v * 100) / 100).toFixed(2);

export function explainPlan(ctx, plan) {
  const T = airtime(plan.h), spare = T - plan.tBack, power = Math.round(plan.h * 100);
  const toss = `Toss to about ${power}% power: the stone stays up ${sec(T)} s, and the hand is back about ${sec(Math.max(0, spare))} s ${spare >= 0 ? 'to spare' : 'late on an average landing (this is the best available)'}. Chance this works for a steady player: about ${pct(plan.p)}%.`;
  if (ctx.sweep) {
    return `Tap the group once: the hand sweeps every stone in one go and is back in about ${sec(plan.tBack)} s. ${toss}`;
  }
  const where = ctx.dir === 'in' ? 'on the yard' : 'in the hole';
  const head = plan.ids.length === 1 ? `Take the stone marked 1 ${where}.` : `Take the stones marked 1 to ${plan.ids.length} ${where}, in that order.`;
  // would the nearest-to-the-hand stones have been quicker?
  const left = ctx.stones.slice(), near = [];
  let px = HOME.x, py = HOME.y;
  while (near.length < ctx.take && left.length) { left.sort((a, b) => dist(px, py, a.x, a.y) - dist(px, py, b.x, b.y)); const s = left.shift(); near.push(s); px = s.x; py = s.y; }
  let extra = '';
  if (near.map((s) => s.id).join() !== plan.ids.join()) {
    const alt = preTime(ctx, near, HINT.react, HINT.gap), mine = preTime(ctx, plan.ids.map((id) => ctx.stones.find((s) => s.id === id)), HINT.react, HINT.gap);
    const altBack = alt.ready + dist(alt.px, alt.py, HOME.x, HOME.y) / 2000, mineBack = mine.ready + dist(mine.px, mine.py, HOME.x, HOME.y) / 2000;
    if (altBack - mineBack >= 0.04) extra = ` Grabbing the stones nearest your hand first would need about ${sec(altBack - mineBack)} s more.`;
  }
  return `${head} The hand needs about ${sec(plan.tBack)} s in all, counting taps at a steady pace.${extra} ${toss}`;
}
void H_MIN;
