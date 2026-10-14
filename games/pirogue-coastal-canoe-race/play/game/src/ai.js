// Computer paddlers. `autopilot` turns the same physics inputs a person has (a stroke on the left or the right at some moment)
// into decisions; `plan` searches the next few seconds by simulating copies of the boat (used by Watch & Learn and Hint).
import { H, GAP, CW, clamp, stepBoat, nextImpact, currentAt, PERFECT, rngFrom, upcoming } from './sim.js';

export const PROFILES = [
  { id: 'kwame', pow: 0.9, name: 'Kwame', tag: 'Gentle and forgiving', stars: 1, timing: 0.13, blunder: 0.4, react: 0.55, steer: 0.07 },
  { id: 'awa', pow: 0.94, name: 'Awa', tag: 'Steady, rarely hurries', stars: 2, timing: 0.095, blunder: 0.28, react: 0.42, steer: 0.05 },
  { id: 'moussa', pow: 0.975, name: 'Moussa', tag: 'Strong and straight', stars: 3, timing: 0.065, blunder: 0.17, react: 0.3, steer: 0.035 },
  { id: 'adjoa', pow: 1.0, name: 'Adjoa', tag: 'Sharp on the swell', stars: 4, timing: 0.04, blunder: 0.08, react: 0.2, steer: 0.025 },
  { id: 'seydou', pow: 1.015, name: 'Seydou', tag: 'Reads every set', stars: 5, timing: 0.022, blunder: 0.03, react: 0.12, steer: 0.015 },
];
export const LEVELS = [{ id: 'easy', name: 'Easy', pick: [0, 1, 2] }, { id: 'medium', name: 'Medium', pick: [1, 2, 3] }, { id: 'hard', name: 'Hard', pick: [2, 3, 4] }];
export const PERFECT_PROFILE = { id: 'coach', pow: 1, name: 'Coach', tag: 'Textbook', stars: 5, timing: 0.012, blunder: 0, react: 0.1, steer: 0.01 };

const gauss = (r) => (r() + r() + r() - 1.5) * 1.6;

export function newPilot(prof, seed) {
  return { prof, r: rngFrom(seed), gap: GAP, err: 0, skip: -1, skipK: -2, lowFor: 0 };
}

// Which side to paddle next: brace if heeled, else steer to the lane line / into the current, else alternate.
function chooseSide(sea, b, t, ap) {
  const pr = ap.prof;
  if (Math.abs(b.roll) > 0.42 && ap.lowFor >= pr.react) return b.roll > 0 ? 1 : -1;
  const xv = b.flip * (b.y - b.lc);                          // lateral in the view frame
  const curV = b.flip * currentAt(sea, b.s);
  let tgt = clamp(-0.045 * xv, -0.35, 0.35);
  tgt += -Math.asin(clamp(curV / Math.max(1.4, b.v), -0.6, 0.6));
  tgt = clamp(tgt, -0.5, 0.5);
  const e = b.hd - tgt;
  const dz = pr.steer + 0.02;
  if (e > dz) return 1;                                      // a right stroke swings the bow left (hd goes down)
  if (e < -dz) return -1;
  return -b.lastSide || 1;
}

// Called every step. Returns -1 / 0 / 1.
export function autopilot(sea, b, t, ap) {
  if (b.done || b.leg === 'turn' || b.swamp > 0) return 0;
  const pr = ap.prof;
  ap.lowFor = Math.abs(b.roll) > 0.42 ? ap.lowFor + H : 0;
  const dt = b.tSince;
  let fire = dt >= ap.gap;
  const imp = nextImpact(sea, b, t);
  if (imp && imp.eta < 0.9) {
    if (ap.skipK !== imp.w.k) { ap.skipK = imp.w.k; ap.skip = ap.r() < pr.blunder ? 1 : 0; ap.err = gauss(ap.r) * pr.timing; }
    if (!ap.skip) {
      const aim = imp.eta - 0.1 - ap.err;
      if (dt >= 0.42) { if (aim <= 0.02) fire = true; else if (aim < 0.55) fire = false; }
    }
  }
  if (!fire) return 0;
  const side = chooseSide(sea, b, t, ap);
  ap.gap = GAP + gauss(ap.r) * pr.timing;
  ap.gap = clamp(ap.gap, 0.45, 0.95);
  return side;
}

// ---- planner: try a few ways to take the next stroke, simulate three seconds of each on a copy, keep the best -------------------------
const clone = (b) => JSON.parse(JSON.stringify(b));
const SIDE_NAME = { '-1': 'left', '1': 'right' };
export function plan(sea, boat, t, opts = {}) {
  const seconds = opts.seconds ?? 3.2, steps = Math.round(seconds / H);
  const base = clone(boat);
  const delays = [0, 0.12, 0.24, 0.36, 0.5];
  const sides = [0, -1, 1];                                   // 0 = the pilot's own choice
  const out = [];
  for (const sideOpt of sides) {
    for (const delay of delays) {
      const b = clone(base), ap = newPilot(PERFECT_PROFILE, 7);
      ap.gap = GAP; ap.skip = 0;
      let tt = t, fired = false, first = 0, lastS = b.s;
      const ev = [], dFire = Math.max(delay, 0);
      let pen = 0;
      for (let i = 0; i < steps && !b.done; i++) {
        let st = 0;
        if (!fired && i * H >= dFire && b.swamp <= 0 && b.leg !== 'turn') { fired = true; st = sideOpt || chooseSide(sea, b, tt, ap); first = st; }
        else if (fired) st = autopilot(sea, b, tt, ap);
        const n = ev.length;
        stepBoat(sea, b, tt, st, ev);
        for (let j = n; j < ev.length; j++) { const e = ev[j]; if (e.t === 'swamp') pen += 6; else if (e.t === 'stuffed') pen += 2.2; else if (e.t === 'slap') pen += 0.9; else if (e.t === 'broach') pen += 3.5; else if (e.t === 'catch') pen -= 2.5; else if (e.t === 'stroke' && e.q < 0.6) pen += 0.4; }
        tt += H;
      }
      const prog = Math.abs(b.s - lastS) + (b.leg === 'home' && base.leg === 'out' ? 3 : 0);
      const value = prog * 1.0 + b.v * 1.2 - pen - Math.abs(b.roll) * 2 - Math.abs(b.y - b.lc) * 0.05;
      out.push({ side: first, delay, value, label: `${SIDE_NAME[first] || 'auto'} stroke ${delay === 0 ? 'now' : `in ${delay.toFixed(2)} s`}` });
    }
  }
  out.sort((a, c) => c.value - a.value);
  // keep the best of each distinct (side, delay); the "auto" variants usually mirror a side, so dedupe by side+delay
  const seen = new Set(), list = [];
  for (const c of out) { const key = `${c.side}|${c.delay}`; if (seen.has(key)) continue; seen.add(key); list.push(c); }
  return { best: list[0], alts: list.slice(1, 4) };
}
export { upcoming, PERFECT };
