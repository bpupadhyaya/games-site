// The trick ladder and the trackers that judge what the ball is doing. Pure data + small state machines: the game feeds
// the world every tick and gets back events. A trick is a list of steps, done in order within one try:
//   { t: 'big' | 'small' | 'spike' | 'base' | 'any', hold?: seconds, travel?: units of hand travel while holding, up?: true }
//   { t: 'lift', n }     pop the ball above the ken n times
//   { t: 'circle', n }   swing the ball a full turn around the ken n times
// A try ends in a drop when the ball goes back to dangling (or 40 s pass); a drop sends the trick back to its first step.
import { anchorOf, L, CUP_BY_ID } from './phys.js';

export const HOLD = 0.55;          // seconds a ball must stay put in a cup or on the spike to count
export const TRY_LIMIT = 40;       // seconds a single try may last
const REST_DROP = 2.0;            // seconds of lying on the ken, not in a catch, that also end a try
const DROP_STILL = 1.1;            // seconds of dangling that end a try

export const TIERS = [
  { name: 'First Catches', need: 0 },
  { name: 'Swing and Lift', need: 5 },
  { name: 'Pairs', need: 12 },
  { name: 'The Base Cup', need: 20 },
  { name: 'Flow', need: 29 },
  { name: 'Mastery', need: 38 },
];

const S = (t, o = {}) => ({ t, ...o });
export const TRICKS = [
  { id: 'big', tier: 0, name: 'Big Cup', steps: [S('big')], tip: 'Pop the ball up, slide the big cup under it and let the ball settle in.' },
  { id: 'small', tier: 0, name: 'Small Cup', steps: [S('small')], tip: 'The small cup is narrower: meet the ball gently and give a little as it lands.' },
  { id: 'spike', tier: 0, name: 'Spike', steps: [S('spike')], tip: 'The hole always turns toward the string. Put the spike right under the ball.' },
  { id: 'base', tier: 0, name: 'Base Cup', steps: [S('base')], tip: 'Press FLIP to turn the ken over, then catch the ball in the base cup.' },

  { id: 'lift3', tier: 1, name: 'Triple Lift', steps: [S('lift', { n: 3 })], tip: 'Pop the ball clear above the ken three times. Let it settle between pops or keep it going.' },
  { id: 'whirl', tier: 1, name: 'Round the World', steps: [S('circle', { n: 1 })], tip: 'Swing the ball in a full circle around the ken: rock the ken from side to side to build speed.' },
  { id: 'lift-big', tier: 1, name: 'Lift to Big Cup', steps: [S('big', { up: true })], tip: 'The ball must rise above the ken first, then drop into the big cup.' },
  { id: 'carry-small', tier: 1, name: 'Carry the Small Cup', steps: [S('small', { hold: 2.5, travel: 220 })], tip: 'Catch it, then walk the ken around smoothly with the ball held in the small cup.' },

  { id: 'big-small', tier: 2, name: 'Big, then Small', steps: [S('big'), S('small')], tip: 'Land the big cup, flick the ball up and land the small cup.' },
  { id: 'small-big', tier: 2, name: 'Small, then Big', steps: [S('small'), S('big')], tip: 'Start in the small cup, then send the ball over to the big one.' },
  { id: 'spike-big', tier: 2, name: 'Spike, then Big', steps: [S('spike'), S('big')], tip: 'A sharp tug along the ken lifts the ball off the spike.' },
  { id: 'big-spike', tier: 2, name: 'Big, then Spike', steps: [S('big'), S('spike')], tip: 'From the big cup, pop the ball and put the spike under it.' },

  { id: 'base-big', tier: 3, name: 'Base, then Big', steps: [S('base'), S('big')], tip: 'Land the base cup, then flip the ken and land the big cup.' },
  { id: 'spike-base', tier: 3, name: 'Spike, then Base', steps: [S('spike'), S('base')], tip: 'Flip while the ball is up, if you dare.' },
  { id: 'trio', tier: 3, name: 'Three in a Row', steps: [S('big'), S('small'), S('spike')], tip: 'Big cup, small cup, spike, without a drop in between.' },

  { id: 'carry-spike', tier: 4, name: 'Spike Walk', steps: [S('spike', { hold: 3.5, travel: 320 })], tip: 'Catch the spike and walk the ken across the screen without losing the ball.' },
  { id: 'whirl2', tier: 4, name: 'Double Whirl', steps: [S('circle', { n: 2 })], tip: 'Two full turns around the ken in one go.' },
  { id: 'ladder', tier: 4, name: 'Big Small Big Small', steps: [S('big'), S('small'), S('big'), S('small')], tip: 'Keep the rhythm: each catch sets up the next pop.' },

  { id: 'lap', tier: 5, name: 'Full Lap', steps: [S('big'), S('small'), S('spike'), S('base')], tip: 'Every catch on the ken, in order.' },
  { id: 'whirl-spike', tier: 5, name: 'Whirl to Spike', steps: [S('circle', { n: 1 }), S('spike')], tip: 'Swing a full circle, then catch the ball on the spike.' },
];
export const TRICK_BY_ID = Object.fromEntries(TRICKS.map((t) => [t.id, t]));

export const stepText = (s) => {
  if (s.t === 'lift') return `Lift x${s.n}`;
  if (s.t === 'circle') return s.n > 1 ? `Whirl x${s.n}` : 'Whirl';
  const nm = { big: 'Big cup', small: 'Small cup', spike: 'Spike', base: 'Base cup', any: 'Any catch' }[s.t];
  return s.up ? `Lift, ${nm.toLowerCase()}` : s.hold > 1 ? `Hold ${nm.toLowerCase()}` : nm;
};
export const stepsText = (steps) => steps.map(stepText).join('  >  ');

export const starsFor = (drops) => (drops <= 2 ? 3 : drops <= 6 ? 2 : 1);
export const totalStars = (rec) => Object.values(rec?.stars ?? {}).reduce((a, b) => a + (b | 0), 0);
export const tierOpen = (ti, rec) => totalStars(rec) >= TIERS[ti].need;
export const trickOpen = (tr, rec) => tierOpen(tr.tier, rec);

const ONID = { big: 1, small: 2, base: 3, spike: 4 };

// A tracker follows one trick (or a Run's current goal) through a try. step() returns an event or null:
//   { e: 'step', i }  a step was completed        { e: 'done' }  the trick is complete        { e: 'drop' }  the try ended
export function newTracker(steps) {
  return {
    steps, i: 0, drops: 0, armed: false, tryT: 0, risen: false, lastOn: 0, leftT: 1, lifts: 0, wind: 0, lastAng: null, slackT: 0,
    holdLen: 0, lx: 0, ly: 0, lastStepOn: 0, done: false, flash: 0,
  };
}

const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function resetTry(tr) {
  tr.i = 0; tr.armed = false; tr.tryT = 0; tr.risen = false; tr.lifts = 0; tr.wind = 0; tr.lastAng = null; tr.slackT = 0; tr.holdLen = 0; tr.leftT = 1;
}

const _a = { x: 0, y: 0 };
export function stepTracker(tr, w, dt) {
  if (tr.done) return null;
  const b = w.ball, k = w.ken;
  anchorOf(k, _a);
  const dx = b.x - _a.x, dy = b.y - _a.y;
  const dist = Math.hypot(dx, dy);
  const moving = Math.hypot(b.vx - k.vx, b.vy - k.vy) > 260 || b.on > 0;
  if (moving) tr.armed = true;
  if (tr.armed) tr.tryT += dt;
  if (tr.flash > 0) tr.flash -= dt;
  // the ball above the ken (in the world) by a clear margin
  const flipped = Math.cos(k.flip) < 0;
  const aboveBy = flipped ? (b.y < _a.y - 60 ? 1 : 0) : (b.y < _a.y - 70 ? 1 : 0);
  if (aboveBy && b.on === 0) tr.risen = true;
  if (b.on !== tr.lastOn) { if (b.on === 0) tr.leftT = 0; tr.lastOn = b.on; }
  if (b.on === 0) tr.leftT += dt;
  // a drop: the ball is dangling again after the try started
  if (tr.armed && (b.still >= DROP_STILL || b.rest >= REST_DROP || tr.tryT > TRY_LIMIT)) {
    const had = tr.i > 0 || tr.risen || tr.lifts > 0 || tr.wind !== 0;
    tr.drops++;
    const lost = tr.i;
    resetTry(tr);
    return { e: 'drop', lost, had };
  }
  const s = tr.steps[tr.i];
  if (!s) return null;
  if (s.t === 'lift') {
    if (aboveBy && b.on === 0 && !tr.liftUp) tr.liftUp = true;
    if (tr.liftUp && (b.y > _a.y - 15 || b.on > 0)) {
      tr.liftUp = false; tr.lifts++;
      if (tr.lifts >= s.n) return advance(tr);
      return { e: 'lift', n: tr.lifts };
    }
    return null;
  }
  if (s.t === 'circle') {
    const taut = dist > L * 0.9 && b.mode === 0;
    const ang = Math.atan2(dx, dy);
    if (taut) {
      if (tr.lastAng !== null) tr.wind += norm(ang - tr.lastAng);
      tr.lastAng = ang; tr.slackT = 0;
    } else { tr.slackT += dt; if (tr.slackT > 0.5) { tr.wind = 0; tr.lastAng = null; } else if (tr.lastAng !== null) tr.lastAng = ang; }
    if (Math.abs(tr.wind) >= 2 * Math.PI * s.n - 0.2) { tr.wind = 0; tr.lastAng = null; return advance(tr); }
    return null;
  }
  // a catch
  const want = s.t === 'any' ? (b.on > 0 ? b.on : 0) : ONID[s.t];
  const fresh = tr.leftT > 0.12 || tr.lastStepOn !== want;
  if (b.on === want && want && fresh) {
    if (tr.holdOn !== want) { tr.holdOn = want; tr.holdLen = 0; tr.lx = k.x; tr.ly = k.y; }
    tr.holdLen += Math.hypot(k.x - tr.lx, k.y - tr.ly); tr.lx = k.x; tr.ly = k.y;
    const need = s.hold ?? HOLD;
    if (b.onT >= need && tr.holdLen >= (s.travel ?? 0) && (!s.up || tr.risen)) {
      tr.lastStepOn = want; tr.risen = false; tr.holdOn = 0;
      return advance(tr);
    }
  } else if (tr.holdOn) tr.holdOn = 0;
  return null;
}

function advance(tr) {
  tr.i++; tr.flash = 0.9; tr.leftT = 0; tr.risen = false; tr.lifts = 0; tr.liftUp = false;
  if (tr.i >= tr.steps.length) { tr.done = true; return { e: 'done', i: tr.i - 1 }; }
  return { e: 'step', i: tr.i - 1 };
}

// How the catch was named for sound and text.
export const catchName = (id) => ({ 1: 'big cup', 2: 'small cup', 3: 'base cup', 4: 'spike' }[id] ?? 'catch');
export { CUP_BY_ID };

// ---- Combo Run ----------------------------------------------------------------------------------
export const RUN_POINTS = { big: 10, small: 16, spike: 22, base: 30 };
export const RUN_STRIKES = 5;
export function newRun() {
  return { pts: 0, bank: 0, chain: 0, strikes: 0, catches: 0, over: false, offers: [], bonus: -1, ended: null };
}
export const runMult = (run) => Math.min(5, 1 + 0.5 * run.chain);
export const offerValue = (run, i) => Math.round(RUN_POINTS[run.offers[i]] * runMult(run) * (run.bonus === i ? 2 : 1));
export function dealOffers(run, rng, last) {
  const pool = ['big', 'small', 'spike', 'base'].filter((t) => t !== last || false);
  const pick = rng.shuffle(pool).slice(0, 3);
  run.offers = pick;
  run.bonus = rng.int(3);
}
