// Hornussen rules and physics: pure, deterministic, no drawing. Metres and seconds throughout.
// The Ries (field) runs away from the Bock (launch ramp) along +z; x is sideways across the Ries, 0 = its centre line.
// A strike sends the Nouss (puck) on a fixed arc; the fielding side stops it by throwing Schindel (boards) into its path.
// Everything the player sees about the flight is computed from `flightAt`, and every outcome from `resolveFlight`.

export const RIES = { len: 200, half: 14 };
export const ROWS = [45, 75, 105, 135, 165];          // depth of the five fielding lines (metres from the Bock)
export const COLS = [-10.5, -3.5, 3.5, 10.5];         // the four columns of fielders
export const BOARD = { half: 1.7, lat: 1.6, reach: 11, upA: 0.3, upB: 0.85, peak: 0.575 };
export const WHIP_T = 0.2;                             // seconds from the release to the rod meeting the puck (the picture of the strike)
export const MIN_SCORING = 45;                         // a puck landing shorter than this is a dead strike
export const MAX_THROWS = { easy: 3, normal: 2, hard: 2 };
export const LEVELS = ['easy', 'normal', 'hard'];
export const LEVEL_NAMES = { easy: 'Easy', normal: 'Steady', hard: 'Sharp' };
export const LEVEL_BLURB = {
  easy: 'The other side reacts slowly and often misjudges the timing. Your boards stay up a little longer.',
  normal: 'A fair match: the other side stops most pucks that fly into its boards.',
  hard: 'A quick, accurate side that reads the flight early and aims for the gaps.',
};
const LV = {
  easy: { att: 0.6, tsig: 0.3, aimSig: 2.1, depthSig: 11, pick: 6, upB: 1.05 },
  normal: { att: 0.78, tsig: 0.2, aimSig: 1.3, depthSig: 7, pick: 3, upB: 0.85 },
  hard: { att: 0.9, tsig: 0.13, aimSig: 0.8, depthSig: 4, pick: 1, upB: 0.75 },
};
export const levelInfo = (l) => LV[l] || LV.normal;

export const VENUES = [
  { id: 'emmental', name: 'Emmental', note: 'Green meadows under a bright morning sky', wind: 0.9, sky: ['#6fb8ea', '#dff1fb'], sun: '#fff3c4', mount: ['#9db4cf', '#7f98b8', '#59745a'], grass: ['#5fae45', '#4f9a3a'], tint: 0 },
  { id: 'appenzell', name: 'Appenzell', note: 'Rolling hills, an afternoon breeze', wind: 1.3, sky: ['#4f9bdc', '#cfe6f6'], sun: '#ffe9a8', mount: ['#a4b2c9', '#7d8fae', '#4f7a4d'], grass: ['#58a63f', '#488f35'], tint: 0 },
  { id: 'entlebuch', name: 'Entlebuch', note: 'Warm evening light on the ridge', wind: 0.7, sky: ['#6a7fc0', '#f6c99a'], sun: '#ffd18a', mount: ['#9a8fb5', '#7b6f9c', '#4a6b4a'], grass: ['#6aa83f', '#559335'], tint: 1 },
  { id: 'jura', name: 'Jura', note: 'Autumn pastures and a cool wind', wind: 1.5, sky: ['#7aa4c8', '#e7dccb'], sun: '#fff0cc', mount: ['#a8a79a', '#868b82', '#6a7a45'], grass: ['#9fae43', '#8a9a38'], tint: 2 },
];
export const venueOf = (id) => VENUES.find((v) => v.id === id) || VENUES[0];
export const STRIKERS = ['Ueli', 'Res', 'Beat', 'Köbi', 'Fredi', 'Röbi'];
export const TEAM_NAMES = ['Emmental', 'Appenzell', 'Entlebuch', 'Jura', 'Toggenburg', 'Thurgau'];
export const LEN_STEPS = [4, 8, 12];
export const pointsFor = (d) => (d < MIN_SCORING ? 0 : d < 105 ? 1 : d < 135 ? 2 : 3);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const gauss = (rng) => { let s = 0; for (let i = 0; i < 4; i++) s += rng.next(); return (s - 2) * 1.7320508; }; // about N(0,1), bounded

// ---- the flight of the puck -------------------------------------------------------------------------------------------
// `fl` = { D, xL, T, H, cw } : landing distance, landing sideways position, flight time, apex, sideways wobble.
export function makeFlight(D, xL, cw) {
  D = clamp(D, 20, 230);
  return { D, xL, cw: cw || 0, T: 2.2 + D * 0.021, H: 3 + D * 0.12 };
}
export function flightAt(fl, t) {
  const u = clamp(t / fl.T, 0, 1), arc = 4 * u * (1 - u);
  return { u, z: fl.D * u, x: fl.xL * u + fl.cw * arc, y: 0.7 * (1 - u) + fl.H * arc };
}
// where the puck passes the plane z = zr: { t, x, y } or null when it lands in front of it
export function crossing(fl, zr) {
  if (fl.D <= zr) return null;
  const u = zr / fl.D, t = u * fl.T;
  return { t, ...flightAt(fl, t) };
}
export function upWindow(level) { return [BOARD.upA, levelInfo(level).upB]; }

// A fielder's board stops the puck if it is up at the moment the puck passes his line, within reach height and sideways reach.
export function boardStops(fl, th, f, level) {
  const c = crossing(fl, f.z);
  if (!c || c.y > BOARD.reach || c.y < 0) return null;
  const [a, b] = upWindow(level);
  if (c.t < th + a || c.t > th + b) return null;
  if (Math.abs(c.x - f.x) > BOARD.half + BOARD.lat) return null;
  return c;
}
export const fielderList = () => ROWS.flatMap((z, r) => COLS.map((x, c) => ({ id: r * COLS.length + c, r, c, x, z })));
export const FIELDERS = fielderList();

// Resolve a whole flight given the throws made: [{ id, th }] (th = seconds after the strike).
export function resolveFlight(fl, throws, level) {
  let hit = null;
  for (const th of throws) {
    const f = FIELDERS[th.id], c = boardStops(fl, th.th, f, level);
    if (c && (!hit || c.t < hit.t)) hit = { ...c, id: th.id };
  }
  if (hit) return { kind: 'stopped', t: hit.t, x: hit.x, y: hit.y, z: FIELDERS[hit.id].z, id: hit.id, points: 0 };
  const out = Math.abs(fl.xL) > RIES.half || fl.D > RIES.len;
  const pts = out ? 0 : pointsFor(fl.D);
  return { kind: out ? 'out' : fl.D < MIN_SCORING ? 'short' : 'landed', t: fl.T, x: fl.xL, y: 0, z: fl.D, points: pts };
}

// ---- strikes -----------------------------------------------------------------------------------------------------------
// power 0..1 (the tension of the rod at release), `perfect` = released inside the whip window.
export const distanceFor = (power, perfect) => (30 + 155 * Math.pow(clamp(power, 0, 1), 1.15)) * (perfect ? 1.07 : 1);
export const powerFor = (D) => Math.pow(clamp((D / 1 - 30) / 155, 0.001, 1), 1 / 1.15);
export const TENSION = { rise: 1.15, fall: 0.6, perfectA: 0.87, perfectB: 0.95 };
// the tension meter: rises, then eases back, then rises again; `t` = seconds held
export function tensionAt(t) {
  const cyc = TENSION.rise + TENSION.fall, p = t % cyc;
  return p < TENSION.rise ? p / TENSION.rise : 1 - (p - TENSION.rise) / TENSION.fall;
}
export const isPerfect = (tension, rising) => rising && tension >= TENSION.perfectA && tension <= TENSION.perfectB;
export function strikeFrom(rng, { power, aimX, perfect, wind, level, human }) {
  const T0 = 2.2 + distanceFor(power, perfect) * 0.021;
  const aimSig = human ? (perfect ? 0.35 : 0.75) : levelInfo(level).aimSig * 0.6;
  const dSig = human ? (perfect ? 1.5 : 4.5) : levelInfo(level).depthSig * 0.6;
  const D = distanceFor(power, perfect) + gauss(rng) * dSig;
  const xL = clamp(aimX, -RIES.half, RIES.half) + wind * T0 * 0.55 + gauss(rng) * aimSig;
  return makeFlight(D, xL, gauss(rng) * 0.9);
}
export const windDrift = (wind, D) => wind * (2.2 + D * 0.021) * 0.55;

// ---- the computer as a fielding side ----------------------------------------------------------------------------------------
// Returns throws [{ id, th }] for one flight. It sees the real flight (a real side watches it) but is imperfect in attention and timing.
export function planFielding(fl, level, rng) {
  const lv = levelInfo(level), out = [];
  for (let r = 0; r < ROWS.length && out.length < MAX_THROWS[level]; r++) {
    const c = crossing(fl, ROWS[r]);
    if (!c || c.y > BOARD.reach * 1.1) continue;
    let best = 0, bd = 1e9;
    COLS.forEach((x, i) => { const d = Math.abs(x - c.x); if (d < bd) { bd = d; best = i; } });
    if (bd > BOARD.half + BOARD.lat + 0.6) continue;
    if (rng.next() > lv.att) continue;
    out.push({ id: r * COLS.length + best, th: Math.max(0.05, c.t - BOARD.peak + gauss(rng) * lv.tsig) });
  }
  return out;
}

// ---- the computer as a striker -----------------------------------------------------------------------------------------------
// How likely a flight to (D, x) is to be stopped by the human side's perfect-ish play: used to rank targets.
function stopChance(D, x) {
  const fl = makeFlight(D, x, 0);
  let p = 0;
  for (let r = 0; r < ROWS.length; r++) {
    const c = crossing(fl, ROWS[r]);
    if (!c || c.y > BOARD.reach) continue;
    const d = Math.min(...COLS.map((cx) => Math.abs(cx - c.x)));
    if (d <= BOARD.half + BOARD.lat) p = Math.max(p, 0.62);
  }
  return p;
}
export function rankTargets(level) {
  const sig = levelInfo(level).aimSig * 0.6, out = [];
  for (let D = 50; D <= 190; D += 10) {
    for (let x = -12; x <= 12; x += 1) {
      let ev = 0, w = 0;
      for (const k of [-1.5, -0.75, 0, 0.75, 1.5]) { const wt = 1 - Math.abs(k) / 2.2; const xx = x + k * sig; if (Math.abs(xx) > RIES.half) { w += wt; continue; } ev += wt * pointsFor(D) * (1 - stopChance(D, xx)); w += wt; }
      out.push({ D, x, ev: ev / w });
    }
  }
  out.sort((a, b) => b.ev - a.ev || a.D - b.D || a.x - b.x);
  return out;
}
const rankCache = {};
export function planStrike(level, rng, wind) {
  const key = level; // the ranking does not depend on wind; wind is corrected for afterwards
  if (!rankCache[key]) rankCache[key] = rankTargets(level);
  const top = rankCache[key], n = levelInfo(level).pick;
  const t = top[rng.int(Math.min(n, top.length))];
  const aim = t.x - windDrift(wind, t.D);
  const power = clamp(powerFor(t.D), 0.2, 1);
  return { D: t.D, x: t.x, aimX: clamp(aim, -RIES.half, RIES.half), power, perfect: false, ev: t.ev };
}
// A hint for a human striker: the best target given the other side's formation.
export function hintStrike(level, wind) {
  if (!rankCache[level]) rankCache[level] = rankTargets(level);
  const t = rankCache[level][0];
  return { D: t.D, x: t.x, aimX: clamp(t.x - windDrift(wind, t.D), -RIES.half, RIES.half), power: clamp(powerFor(t.D), 0.2, 1) };
}
// A hint for a human fielder: the fielder to use and the best moment to tap (seconds into the flight), or null if no board can reach.
export function hintFielder(fl) {
  for (let r = 0; r < ROWS.length; r++) {
    const c = crossing(fl, ROWS[r]);
    if (!c || c.y > BOARD.reach) continue;
    let best = 0, bd = 1e9;
    COLS.forEach((x, i) => { const d = Math.abs(x - c.x); if (d < bd) { bd = d; best = i; } });
    if (bd <= BOARD.half + BOARD.lat) return { id: r * COLS.length + best, at: Math.max(0, c.t - BOARD.peak), cross: c };
  }
  return null;
}

// ---- the match ---------------------------------------------------------------------------------------------------------------------
export function newMatch({ level = 'normal', venue = 'emmental', len = 8, humanBats = true, rng }) {
  const v = venueOf(venue), vi = VENUES.indexOf(v);
  const wind = (rng.next() * 2 - 1) * v.wind;
  return {
    level, venue: v.id, len, names: [v.name, TEAM_NAMES.filter((n) => n !== v.name)[(vi + 1) % (TEAM_NAMES.length - 1)]],
    human: 0, bat: humanBats ? 0 : 1, inning: 0, strike: 0, score: [0, 0], stopped: [0, 0], long: [0, 0], best: [0, 0],
    wind: Math.round(wind * 10) / 10, log: [], done: false, winner: -1,
  };
}
export const fieldTeam = (m) => 1 - m.bat;
export const strikerName = (m) => STRIKERS[Math.floor(m.strike / 2) % STRIKERS.length];
export const strikeNumber = (m) => (m.strike % 2) + 1;
// Apply a resolved strike to the match; returns what happened.
export function applyStrike(m, res, fl) {
  const b = m.bat, f = 1 - b;
  m.score[b] += res.points;
  if (res.kind === 'stopped') m.stopped[f]++;
  if (res.kind === 'landed') { m.best[b] = Math.max(m.best[b], Math.round(fl.D)); if (res.points >= 2) m.long[b]++; }
  m.log.push({ bat: b, kind: res.kind, points: res.points, d: Math.round(fl.D) });
  m.strike++;
  let turnover = false;
  if (m.strike >= m.len) {
    if (m.inning === 0) { m.inning = 1; m.bat = 1 - m.bat; m.strike = 0; turnover = true; }
    else { m.done = true; m.winner = m.score[0] > m.score[1] ? 0 : m.score[1] > m.score[0] ? 1 : -1; }
  }
  return { turnover, done: m.done };
}
export function rollWind(m, rng, venue) {
  const v = venueOf(venue || m.venue);
  m.wind = Math.round((rng.next() * 2 - 1) * v.wind * 10) / 10;
}
export const strikesLeft = (m) => (m.done ? 0 : m.len - m.strike);
export function invariant(m) {
  return m.score.every((s) => s >= 0) && m.strike <= m.len && m.log.length <= m.len * 2;
}
