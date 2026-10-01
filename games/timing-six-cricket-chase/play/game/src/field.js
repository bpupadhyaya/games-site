// Fielding: named positions, field presets, the captain's adaptation, and interception of a ball track.
// Everything is computed from the real ball track (no teleporting) with per-fielder speed and reaction.
import { THEMES, clamp, centreOf, dist, DEG } from './core.js';
import { trackPos, flyBall } from './ball.js';

// [name, x, z, kind] in metres on the 38 m stadium ground (z measured from the striker's stumps).
export const SLOTS = {
  'First slip': [1.7, -3.4, 'close'], 'Second slip': [3.0, -3.2, 'close'], 'Gully': [5.2, -1.2, 'close'],
  'Short leg': [-2.6, 0.9, 'close'], 'Silly point': [3.4, 1.8, 'close'],
  'Point': [10, 0.3, 'ring'], 'Cover': [11, 7, 'ring'], 'Mid-off': [7, 15, 'ring'], 'Mid-on': [-7, 15, 'ring'],
  'Midwicket': [-12, 7, 'ring'], 'Square leg': [-12, 0, 'ring'], 'Backward point': [11, -4, 'ring'],
  'Fine leg (inner)': [-8, -10, 'ring'], 'Extra cover': [13.5, 11, 'ring'],
  'Third man': [17, -27, 'deep'], 'Deep point': [28, 0, 'deep'], 'Deep cover': [24, 13, 'deep'],
  'Long-off': [13, 35, 'deep'], 'Long-on': [-13, 35, 'deep'], 'Deep midwicket': [-26, 14, 'deep'],
  'Deep square leg': [-29, 1, 'deep'], 'Fine leg': [-14, -26, 'deep'],
};

export const PRESETS = {
  balanced: { name: 'Balanced', blurb: 'Ring plus two sweepers.', slots: ['Point', 'Cover', 'Mid-off', 'Mid-on', 'Midwicket', 'Deep square leg', 'Third man'] },
  attacking: { name: 'Attacking', blurb: 'Slips and catchers; gaps behind the ring.', slots: ['First slip', 'Second slip', 'Gully', 'Point', 'Cover', 'Mid-off', 'Midwicket'] },
  powerplay: { name: 'Powerplay', blurb: 'Catchers close, ring up, fine leg in.', slots: ['First slip', 'Point', 'Cover', 'Mid-off', 'Mid-on', 'Midwicket', 'Fine leg (inner)'] },
  spinring: { name: 'Spin ring', blurb: 'Close catchers for turn.', slots: ['Silly point', 'Short leg', 'Cover', 'Mid-off', 'Mid-on', 'Midwicket', 'Deep midwicket'] },
  defensive: { name: 'Defensive', blurb: 'Everyone back; saves boundaries.', slots: ['Deep point', 'Deep cover', 'Long-off', 'Long-on', 'Deep midwicket', 'Deep square leg', 'Fine leg'] },
  guard: { name: 'Boundary guard', blurb: 'Off side ring, deep leg side.', slots: ['Point', 'Deep cover', 'Long-off', 'Long-on', 'Deep midwicket', 'Square leg', 'Fine leg'] },
};
export const PRESET_KEYS = Object.keys(PRESETS);

function slotPos(name, themeKey) {
  const th = THEMES[themeKey];
  const [x, z, kind] = SLOTS[name];
  if (kind === 'close') return { x, z: z + (th.pitchLen - 20) * 0 };
  const k = th.baseR / 34;
  return { x: x * k, z: (z - 10) * k + th.pitchLen / 2 };
}

// Sector (0..7, 45 degrees each, centred on 0, 45, 90, ...) for a shot angle in degrees.
export const sectorOf = (ang) => ((Math.round(ang / 45) % 8) + 8) % 8;
export const SECTOR_NAMES = ['straight', 'cover / off', 'point / square', 'third man', 'behind', 'fine leg', 'square leg', 'midwicket'];

export function buildField(presetKey, themeKey, level, rng, zoneHeat = null) {
  const th = THEMES[themeKey];
  const slots = [...PRESETS[presetKey].slots];
  const used = new Set();
  const notes = [];
  // "Plug the leak": the captain moves a fielder toward the sector the batter keeps scoring boundaries in.
  if (zoneHeat && level.fieldIq > rng.next() * 0.9) {
    let best = -1, bv = 1.4;
    zoneHeat.forEach((v, s) => { if (v > bv) { bv = v; best = s; } });
    if (best >= 0) {
      const ang = best * 45;
      const covered = slots.some((n) => {
        if (SLOTS[n][2] !== 'deep') return false;
        const p = slotPos(n, themeKey), c = centreOf(themeKey);
        const a = Math.atan2(p.x - 0, p.z - 0) / DEG;
        return Math.abs(((a - ang + 540) % 360) - 180) < 30;
      });
      if (!covered) {
        // replace the fielder whose own sector is the quietest
        let vi = 0, vv = 99;
        slots.forEach((n, i) => {
          const p = slotPos(n, themeKey);
          const s = sectorOf(Math.atan2(p.x, p.z) / DEG);
          const h = zoneHeat[s] + (SLOTS[n][2] === 'close' ? 0.5 : 0);
          if (h < vv) { vv = h; vi = i; }
        });
        const R = th.baseR * 0.86;
        const pos = { x: Math.sin(ang * DEG) * R, z: th.pitchLen / 2 + Math.cos(ang * DEG) * R * 0.95 };
        notes.push(`Captain moved a fielder to guard ${SECTOR_NAMES[best]}`);
        const fs = slots.map((n, i) => ({ name: i === vi ? 'Sweeper' : n, ...(i === vi ? pos : slotPos(n, themeKey)) }));
        return finishField(fs, themeKey, level, notes);
      }
    }
  }
  slots.forEach((n) => used.add(n));
  return finishField(slots.map((n) => ({ name: n, ...slotPos(n, themeKey) })), themeKey, level, notes);
}

function finishField(list, themeKey, level, notes) {
  const th = THEMES[themeKey];
  const out = [{ name: 'Keeper', role: 'wk', x: 0, z: -3.0, spd: level.fieldSpd * 0.78, react: level.react }];
  for (const f of list) out.push({ name: f.name, role: 'field', x: f.x, z: f.z, spd: level.fieldSpd, react: level.react });
  out.push({ name: 'Bowler', role: 'bowler', x: 3.2, z: th.pitchLen + 1.6, spd: level.fieldSpd * 0.82, react: level.react + 0.08 });
  out.forEach((f, i) => { f.id = i; f.x0 = f.x; f.z0 = f.z; f.fx = 0; f.fz = 1; f.run = 0; });
  return { fielders: out, notes };
}

export function rearField(fielders) { fielders.forEach((f) => { f.x = f.x0; f.z = f.z0; f.run = 0; }); }

// Catching / fielding reliability for a given fielder and ball state.
export function catchChance(level, f, speed, y, runDist) {
  let p = level.hold - 0.011 * Math.max(0, speed - 12);
  if (y < 0.5) p -= 0.1;
  if (y > 1.9) p -= 0.08;
  if (runDist > 9) p -= 0.08;
  if (f.role === 'wk') p += 0.03;
  return clamp(p, 0.08, 0.98);
}

// Finds what happens to a struck ball. rng may be null for a deterministic *expected* evaluation.
// rules: { ohob } one-hand-one-bounce lets a catch after ONE bounce count.
export function planFielding(track, fielders, themeKey, level, rules, rng) {
  const th = THEMES[themeKey];
  const bIdx = track.boundary ? track.boundary.idx : Infinity;
  const end = Math.min(track.n - 1, bIdx);
  let bounce = 0;
  const bset = new Set(track.bounces);
  const catchP = [];
  for (let i = 0; i <= end; i++) {
    if (bset.has(i)) bounce++;
    const [bx, by, bz] = trackPos(track, i);
    const t = i / 60;
    let bestF = null, bestSlack = -1e9, bestNeed = 0;
    for (const f of fielders) {
      const d = Math.hypot(f.x - bx, f.z - bz);
      const reach = by > 0.9 ? 1.0 : 0.9;
      const need = f.react + Math.max(0, d - reach) / f.spd;
      const slack = t - need;
      if (slack >= 0 && slack > bestSlack) { bestSlack = slack; bestF = f; bestNeed = need; }
    }
    if (!bestF) continue;
    const speed = i > 0 ? Math.hypot(...[0, 1, 2].map((k) => (track.p[i * 3 + k] - track.p[(i - 1) * 3 + k]) * 60)) : 0;
    const airborne = by > 0.45 && by < 2.3;
    const canCatch = airborne && (bounce === 0 || (rules.ohob && bounce === 1));
    const runDist = Math.hypot(bestF.x0 - bx, bestF.z0 - bz);
    if (canCatch) {
      const p = catchChance(level, bestF, speed, by, runDist);
      if (rng === null) return { kind: 'catch', idx: i, fielder: bestF.id, p, pos: [bx, by, bz], t, deterministic: true };
      if (rng.chance(p)) return { kind: 'catch', idx: i, fielder: bestF.id, p, pos: [bx, by, bz], t };
      return { kind: 'drop', idx: i, fielder: bestF.id, p, pos: [bx, by, bz], t, pickupIdx: i + 26 };
    }
    if (by <= 0.9) {
      // ground pickup
      let fumble = false;
      if (rng && speed > 15 && rng.chance(0.045 + 0.004 * (speed - 15))) fumble = true;
      return { kind: 'pickup', idx: i, fielder: bestF.id, pos: [bx, by, bz], t, fumble, pickupIdx: i + (fumble ? 24 : 0), diving: bestSlack < 0.12 && by < 0.4 };
    }
  }
  if (track.boundary) return { kind: 'boundary', idx: bIdx, runs: track.boundary.kind, pos: trackPos(track, bIdx) };
  // never reached: somebody collects it where it stops
  const si = track.stopIdx >= 0 ? track.stopIdx : track.n - 1;
  const [sx, , sz] = trackPos(track, si);
  let bf = null, bt = 1e9;
  for (const f of fielders) {
    const tt = f.react + Math.hypot(f.x - sx, f.z - sz) / f.spd;
    if (tt < bt) { bt = tt; bf = f; }
  }
  const idx = Math.max(si, Math.round(bt * 60));
  return { kind: 'pickup', idx, fielder: bf.id, pos: [sx, 0, sz], t: idx / 60, fumble: false, pickupIdx: idx, late: true };
}

// Throw time from a fielder at (x,z) to an end's stumps. Release 0.25 s after the ball is held.
export const THROW_SPEED = 27;
export function throwTime(fx, fz, ex, ez) { return 0.25 + Math.hypot(fx - ex, fz - ez) / THROW_SPEED; }

// Estimated runs that can be taken safely, given when/where the ball is first held.
// runTime = seconds per run for the batters. margin = safety slack (seconds) the batters want.
export function safeRuns(holdT, hx, hz, th, runTime, margin, lead = 0) {
  let best = 0;
  for (let r = 1; r <= 4; r++) {
    const end = r % 2 === 1 ? th.pitchLen : 0;
    const finish = lead + r * runTime + (r - 1) * 0.18;
    const arrive = holdT + throwTime(hx, hz, 0, end);
    if (finish + margin <= arrive) best = r; else break;
  }
  return best;
}

// Deterministic evaluation of shot options for one ball and one field (Think, AI batter).
// Returns [{ angle, power, runs, boundary, caught, out, value }].
export function evalShot(initFor, fielders, themeKey, level, rules, runTime, margin = 0.2) {
  const th = THEMES[themeKey];
  const track = flyBall(initFor, themeKey);
  const plan = planFielding(track, fielders, themeKey, level, rules, null);
  if (plan.kind === 'boundary') return { runs: plan.runs, boundary: plan.runs, caught: 0, plan, track };
  if (plan.kind === 'catch') return { runs: 0, boundary: 0, caught: plan.p, plan, track };
  const pf = fielders[plan.fielder];
  const holdT = (plan.pickupIdx ?? plan.idx) / 60;
  const [px, , pz] = plan.pos;
  const runs = safeRuns(holdT, px, pz, th, runTime, margin, 0.1);
  return { runs, boundary: 0, caught: 0, plan, track, fielder: pf };
}
