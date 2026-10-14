// A race: one sea, four boats (you and three rivals, or one to four people / the coach), a start countdown and the finishing order.
// No drawing here. game.js steps it; rivals are driven by ai.js `autopilot`.
//   cfg: { course, level, mode: 'race' | 'trial' | 'two' | 'watch', seed, day, lane }
import { H, makeSea, newBoat, stepBoat, LANES } from './sim.js';
import { autopilot, newPilot, PROFILES, LEVELS, PERFECT_PROFILE } from './ai.js';

export const COUNTDOWN = 3.4;
export const PALETTES = [
  { main: '#f0a81c', band: '#1b5fa8', trim: '#fff6e0', cap: '#d8412f', shirt: '#fff6e0' },
  { main: '#d9453d', band: '#fff2d0', trim: '#183a4a', cap: '#183a4a', shirt: '#f4c542' },
  { main: '#1fa39a', band: '#f6d365', trim: '#0e3b3a', cap: '#f6d365', shirt: '#ffffff' },
  { main: '#7c4dbb', band: '#f5f0e0', trim: '#e86a92', cap: '#f5f0e0', shirt: '#e86a92' },
  { main: '#3f9a4a', band: '#ffffff', trim: '#f28c28', cap: '#ffffff', shirt: '#f28c28' },
];

export function newRace(cfg, rng) {
  const seed = (cfg.seed ?? 1) | 0;
  const sea = makeSea(cfg.course, seed, cfg.day | 0);
  const solo = cfg.mode === 'trial' || cfg.mode === 'two';
  const lane = (cfg.lane ?? (seed & 1) + 1) % 4;
  const lvl = LEVELS.find((l) => l.id === cfg.level) || LEVELS[1];
  const boats = [], pilots = [], names = [], pal = [];
  const mine = newBoat(sea, lane, 0);
  boats.push(mine);
  const human = cfg.mode !== 'watch';
  pilots.push(human ? null : newPilot(PERFECT_PROFILE, seed * 7 + 11));
  names.push(cfg.mode === 'watch' ? 'Coach' : 'You');
  pal.push(PALETTES[0]);
  if (!solo) {
    const lanes = [0, 1, 2, 3].filter((l) => l !== lane);
    lvl.pick.forEach((pi, i) => {
      const pr = PROFILES[pi], b = newBoat(sea, lanes[i], i + 1);
      b.pow = pr.pow;
      boats.push(b); pilots.push(newPilot(pr, seed * 13 + pi * 101 + 5)); names.push(pr.name); pal.push(PALETTES[pi % 4 + 1]);
    });
  }
  return { cfg, sea, t: 0, clock: 0, boats, pilots, names, pal, phase: 'intro', go: COUNTDOWN, order: [], over: false, overT: 0, ev: [] };
}

// Advance one fixed step. strokes[i] = -1 | 0 | 1 for human boats (ignored for pilots).
export function stepRace(race, strokes, ev) {
  if (race.phase === 'intro') {
    race.clock += H;
    race.go -= H;
    if (race.go <= 0) { race.phase = 'race'; race.t = 0; ev.push({ t: 'go' }); }
    return;
  }
  race.t += H;
  race.clock += H;
  const { sea } = race;
  for (let i = 0; i < race.boats.length; i++) {
    const b = race.boats[i], p = race.pilots[i];
    const was = b.done;
    const forced = strokes[i];
    const st = forced !== undefined && forced !== null ? forced : p ? autopilot(sea, b, race.t, p) : 0;
    stepBoat(sea, b, race.t, st, ev);
    if (b.done && !was) race.order.push(i);
  }
}

// All boats that are not people finish quickly in the background once the person is across (used for the result table).
export function settle(race) {
  const ev = [];
  let guard = 0;
  while (guard++ < 60 * 300 && race.boats.some((b) => !b.done)) {
    race.t += H;
    for (let i = 0; i < race.boats.length; i++) {
      const b = race.boats[i], p = race.pilots[i], was = b.done;
      if (b.done) continue;
      stepBoat(race.sea, b, race.t, p ? autopilot(race.sea, b, race.t, p) : 0, ev);
      if (b.done && !was) race.order.push(i);
    }
  }
}

export function results(race) {
  const rows = race.boats.map((b, i) => ({ i, name: race.names[i], time: b.done ? b.finishT : Infinity, pen: b.penalty, b }));
  rows.sort((a, c) => a.time - c.time);
  rows.forEach((r, k) => { r.place = k + 1; });
  return rows;
}
export const fmtTime = (t) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : '--');
export const ordinal = (n) => ['', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;
export { LANES };
