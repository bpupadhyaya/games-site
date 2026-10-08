// The kicking brain: given the spot and the wind it finds the aim, tilt and power that put the ball through the middle with margin.
// Used by the Think hint, the lessons, Watch & Learn and the computer rivals. It only calls the pure physics in sim.js.
import { GOAL_HW, BAR_H, TILTS, windVec, VMAX, RUN_Q } from './consts.js';
import { predict, windAt } from './sim.js';
import { clamp, r1, normal } from './util.js';

const TAU = Math.PI * 2;
/** Aim that puts the ball at x = target on the goal line with the given steady wind. */
export function solveAim(spot, tilt, power, wind, target = 0) {
  let aim = target, r = null;
  for (let i = 0; i < 6; i++) {
    r = predict(spot, aim, tilt, power, wind);
    if (r.crossX == null) break;
    aim -= (r.crossX - target);
  }
  return { aim: clamp(aim, -16, 16), r };
}

/** The best (tilt, power, aim) for a steady wind {x, z}; robust: prefers low drift sensitivity and the least power that clears the bar by a margin. */
export function plan(spot, wind, o = {}) {
  const clearMin = o.clear ?? 1.6;
  let best = null;
  for (let t = 0; t < 3; t++) {
    for (let p = 0.4; p <= 1.0001; p += 0.025) {
      const { aim, r } = solveAim(spot, t, p, wind);
      if (!r || r.crossX == null || r.clear < clearMin) continue;
      const gust = { x: wind.x * 1.2 + 0.4 * Math.sign(wind.x || 1), z: wind.z * 1.2 };
      const r2 = predict(spot, aim, t, p, gust);
      const sens = r2.crossX == null ? 9 : Math.abs(r2.crossX);
      const score = sens * 1.0 + p * 2.2 + Math.max(0, r.clear - 6) * 0.05 + (Math.abs(aim) > 14 ? 1.5 : 0);
      if (!best || score < best.score) best = { tilt: t, power: Math.round(p * 1000) / 1000, aim, score, sens, clear: r.clear, carry: r.carry, crossX: r.crossX };
    }
  }
  if (!best) { const { aim, r } = solveAim(spot, 0, 1, wind); best = { tilt: 0, power: 1, aim, score: 99, sens: 9, clear: r ? r.clear : -3, carry: r ? r.carry : 0, crossX: r ? r.crossX : 0 }; }
  return best;
}

/** The window the posts make from this spot, in degrees: narrower from far away and from the touchline. */
export function windowDeg(spot) {
  const a = Math.atan2(GOAL_HW - spot.sx, spot.d), b = Math.atan2(-GOAL_HW - spot.sx, spot.d);
  return Math.abs(a - b) * 180 / Math.PI;
}

const sideWord = (x) => (Math.abs(x) < 0.05 ? 'no side' : x > 0 ? 'right' : 'left');
/** Words for the wind as the kicker feels it. */
export function windWords(ws, dir) {
  const cross = ws * Math.sin(dir), along = ws * Math.cos(dir);
  if (ws < 0.8) return { head: 'Still air', cross: 0, along: 0, line: 'The air is almost still.' };
  const bits = [];
  if (Math.abs(cross) >= 1) bits.push(`a cross-wind from the ${cross > 0 ? 'left' : 'right'}, blowing to the ${sideWord(cross)}`);
  if (Math.abs(along) >= 1) bits.push(along > 0 ? 'a tail-wind that pushes the ball on' : 'a head-wind that holds the ball back');
  const line = `${Math.round(ws)} m/s: ${bits.join(' and ') || 'a light breeze'}.`;
  return { head: `${Math.round(ws)} m/s`, cross, along, line };
}

/** Everything the Think hint, the lessons and Watch & Learn say about a kick. */
export function advice(spot, windS, extras = {}) {
  const wind = windVec(windS.ws, windS.dir);
  const p = plan(spot, wind, extras);
  const still = predict(spot, 0, p.tilt, p.power, null);
  const driftM = (() => { const r = predict(spot, 0, p.tilt, p.power, wind); return r.crossX == null ? 0 : r.crossX; })();
  const ww = windWords(windS.ws, windS.dir), win = windowDeg(spot);
  const aimWord = Math.abs(p.aim) < 0.15 ? 'at the middle of the posts' : `${r1(Math.abs(p.aim))} m to the ${p.aim < 0 ? 'left' : 'right'} of the middle`;
  const lines = [
    { k: 'Wind', v: ww.line },
    { k: 'Angle', v: spot.sx === 0 ? `Straight in front: the posts make a ${r1(win)} degree window from ${spot.d} m.` : `${Math.abs(spot.sx)} m ${spot.sx < 0 ? 'left' : 'right'} of the posts and ${spot.d} m out: the window is only ${r1(win)} degrees wide.` },
    { k: 'Drift', v: Math.abs(driftM) < 0.3 ? 'The wind will hardly move the ball.' : `Aimed straight, the wind would carry the ball ${r1(Math.abs(driftM))} m to the ${driftM > 0 ? 'right' : 'left'}.` },
    { k: 'Aim', v: `Aim ${aimWord}.` },
    { k: 'Ball', v: `${TILTS[p.tilt].name} tilt, power ${Math.round(p.power * 100)} percent: it clears the bar by about ${r1(p.clear)} m.` },
  ];
  return { plan: p, aimX: p.aim, tilt: p.tilt, power: p.power, driftM, windText: ww, windowDeg: win, lines, clearStill: still.clear };
}

/** The computer kicker's decision for one kick: reads the wind with a level-dependent error, then strikes with a timing error. */
export function decide(spot, windS, level, rng) {
  const lv = level;
  const ws = windS.ws * (1 + normal(rng) * lv.wind), dir = windS.dir + normal(rng) * lv.wind * 0.5;
  const p = plan(spot, windVec(Math.max(0, ws), dir), { clear: 1.4 + lv.wind * 2 });
  const e = clamp(normal(rng) * lv.time, -0.3, 0.1);
  return { aimX: p.aim, tilt: p.tilt, power: p.power, pressAt: RUN_Q + e, e };
}

export { windAt, VMAX, BAR_H, TAU };
