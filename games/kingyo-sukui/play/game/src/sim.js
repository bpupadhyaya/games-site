// Kingyo Sukui: the pure, deterministic simulation. No drawing, no clock, no DOM.
// A tank (TW x TH units) holds goldfish that wander, rest and flee. The player's poi is a paper scoop: pressing dips it,
// dragging moves it, releasing lifts it. Paper wears with time in the water and with speed; fish that sit inside the ring when the
// scoop is lifted gently are carried up, and heavy fish strain the paper until it tears.
export const TW = 1000, TH = 800;
export const POI_R = 74;          // ring radius
export const CATCH_R = 60;        // a fish centre this close to the ring centre rides up on the paper
export const SHEETS = 3;
export const LIFT_T = 0.55;       // seconds of lift animation (the result is decided at release)
export const NEW_SHEET_T = 1.1;   // pause while a torn sheet is replaced
export const MAX_SCOOP = 3;
export const RELEASE_M = 100;     // released fish are put back at least this far inside the pool edge

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { clamp };

// Tiny seeded generator for the daily tank (same water for everybody); the rest of the game uses env.rng.
export function seeded(seed) {
  let s = (seed | 0) ^ 0x9e3779b9;
  const next = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, range: (a, b) => a + next() * (b - a), int: (n) => Math.floor(next() * n), chance: (p) => next() < p, pick: (a) => a[Math.floor(next() * a.length)] };
}

// ---- content ------------------------------------------------------------------------------------------------------------
// w: weight (strain on the paper), pts: score, spd: cruise speed (units/s), len: body length, grip: fastest scoop speed it stays on
// the paper at, startle: how easily it bolts, restP: chance to pause at the surface, need: lifetime scoops needed to meet it.
export const FISH = [
  { id: 0, name: 'Wakin', w: 0.6, pts: 1, spd: 82, len: 74, grip: 150, startle: 1.0, restP: 0.25, need: 0, note: 'A slim red and white fish: light, quick to turn, kind to the paper.' },
  { id: 1, name: 'Calico', w: 0.8, pts: 2, spd: 70, len: 78, grip: 150, startle: 0.9, restP: 0.3, need: 0, note: 'Patched in red, white and black. Light, with a lazy swim.' },
  { id: 2, name: 'Demekin', w: 1.0, pts: 2, spd: 52, len: 80, grip: 190, startle: 0.7, restP: 0.45, need: 10, note: 'Telescope eyes and a slow, bobbing swim. Often rests near the surface.' },
  { id: 3, name: 'Black moor', w: 1.6, pts: 3, spd: 44, len: 86, grip: 230, startle: 0.6, restP: 0.5, need: 25, note: 'Velvet black and heavy. Slow and steady, but it loads the paper.' },
  { id: 4, name: 'Ranchu', w: 1.9, pts: 4, spd: 40, len: 88, grip: 220, startle: 0.6, restP: 0.4, need: 45, note: 'A plump, back-less fish with a hooded head. Worth the strain.' },
  { id: 5, name: 'Tosakin', w: 1.1, pts: 4, spd: 60, len: 98, grip: 170, startle: 0.85, restP: 0.2, need: 70, note: 'Long fans of tail that sweep like a veil. Graceful and flighty.' },
  { id: 6, name: 'Pearl', w: 2.4, pts: 5, spd: 36, len: 84, grip: 240, startle: 0.5, restP: 0.45, need: 100, note: 'Round as a pearl and heavy. Needs strong, dry paper.' },
  { id: 7, name: 'Gold Ogon', w: 0.9, pts: 6, spd: 108, len: 92, grip: 120, startle: 1.3, restP: 0.1, need: 150, note: 'Shines like a coin and never stops. Only the gentlest lift keeps it.' },
];

// n: fish in the tank; mix: weights per FISH id; need: best session score to open it.
export const TANKS = [
  { id: 0, name: 'Morning Tub', time: 'morning', n: 11, need: 0, mix: [4, 3, 2, 1, 0, 0, 0, 0], blurb: 'A shallow tub at the start of the day: few fish and plenty of room.' },
  { id: 1, name: 'Festival Basin', time: 'afternoon', n: 15, need: 25, mix: [3, 3, 3, 2, 1, 1, 0, 0], blurb: 'A wide basin that gets crowded: more fish, more to read.' },
  { id: 2, name: 'Lantern Night', time: 'evening', n: 18, need: 55, mix: [2, 2, 3, 3, 2, 2, 1, 1], blurb: 'Lantern light and a darker water: plump fish drift below the glow.' },
  { id: 3, name: 'Master Pool', time: 'night', n: 20, need: 100, mix: [1, 1, 2, 3, 3, 3, 2, 3], blurb: 'The contest pool: heavy, valuable fish that hardly ever stop.' },
];
export const GRADES = [
  { id: 0, name: 'Thick paper', mult: 1, str: 1.35, blurb: 'Strong. Forgiving of heavy fish.' },
  { id: 1, name: 'Standard paper', mult: 1.5, str: 1.0, blurb: 'The usual stall paper. A fair balance.' },
  { id: 2, name: 'Thin paper', mult: 2, str: 0.72, blurb: 'Double points, but it gives up quickly.' },
];
export const RANKS = [[0, 'First dip'], [12, 'Steady hand'], [28, 'Quiet wrist'], [50, 'Stall favourite'], [80, 'Paper whisperer'], [120, 'Festival master']];
export const rankFor = (score) => { let r = RANKS[0][1]; for (const [n, name] of RANKS) if (score >= n) r = name; return r; };

// tuning (the Rules page reads these)
export const TUNE = { wearBase: 0.010, wearSpeed: 0.00006, wetUp: 0.7, wetDown: 0.25, wetWeak: 0.45, strain: 0.16, damage: 0.5, spentBelow: 0.05, startleSpeed: 60, entryShock: 230 };

export const fishOwned = (rec, k) => (rec.scoops | 0) >= FISH[k].need;
export const tankOwned = (rec, i) => (rec.bestSession | 0) >= TANKS[i].need;

// ---- the world --------------------------------------------------------------------------------------------------------
export function makeWorld({ tank = 0, grade = 1, rng, owned, sheets = SHEETS, endless = false, release = endless }) {
  const T = TANKS[tank], pool = [], wts = [];
  FISH.forEach((f, i) => { if (owned ? owned[i] : true) { pool.push(i); wts.push(T.mix[i]); } });
  const total = wts.reduce((a, b) => a + b, 0) || 1;
  const pick = () => { let r = rng.next() * total; for (let i = 0; i < pool.length; i++) { r -= wts[i]; if (r <= 0) return pool[i]; } return pool[0]; };
  const fish = [];
  for (let i = 0; i < T.n; i++) {
    const k = pick(), spec = FISH[k];
    fish.push({
      id: i, k, x: rng.range(120, TW - 120), y: rng.range(120, TH - 120), h: rng.range(0, Math.PI * 2), s: spec.spd,
      tx: rng.range(100, TW - 100), ty: rng.range(100, TH - 100), tt: rng.range(0.2, 3), rest: 0, flee: 0, ph: rng.range(0, 6.28), lift: 0, size: rng.range(0.92, 1.1),
    });
  }
  return {
    tank, grade, t: 0, fish, endless, release, goal: 0, sheets, sheetNo: 0, score: 0, streak: 0, scoops: 0, caught: [], bestScoop: 0, torn: 0, ev: [], pending: [],
    poi: { down: false, x: TW / 2, y: TH * 0.45, tx: TW / 2, ty: TH * 0.45, sp: 0, wet: 0, paper: 1, entryT: 0, lift: null, hold: 0, fresh: 0.6, dipT: 0, trail: [] },
    last: null, over: false, nextId: T.n,
  };
}

const flee = (f, fromX, fromY, dur) => {
  f.h = Math.atan2(f.y - fromY, f.x - fromX); f.flee = Math.max(f.flee, dur); f.rest = 0; f.tt = 0.7;
};

// the sim advances only with dt and its own generator `r`
export function stepWorld(w, dt, r) {
  w.t += dt;
  const P = w.poi;
  // ---- poi
  if (P.hold > 0) P.hold -= dt;
  if (P.fresh > 0) P.fresh -= dt;
  if (P.entryT > 0) P.entryT -= dt;
  if (P.lift) { P.lift.t += dt; if (P.lift.t >= (P.lift.dur || LIFT_T)) P.lift = null; }
  const ox = P.x, oy = P.y;
  if (P.down) {
    const k = Math.min(1, dt * 16);
    P.x += (P.tx - P.x) * k; P.y += (P.ty - P.y) * k;
    const v = Math.hypot(P.x - ox, P.y - oy) / dt;
    P.sp += (v - P.sp) * Math.min(1, dt / 0.1);
    P.wet = Math.min(1, P.wet + dt * TUNE.wetUp);
    P.dipT += dt;
    P.paper -= dt * (TUNE.wearBase + TUNE.wearSpeed * P.sp);
    if (P.paper <= 0) tearPoi(w, 'worn');
  } else {
    P.sp = 0;
    P.wet = Math.max(0, P.wet - dt * TUNE.wetDown);
  }
  P.trail.push({ x: P.x, y: P.y, d: P.down }); if (P.trail.length > 10) P.trail.shift();

  // ---- fish
  const fs = w.fish;
  for (const f of fs) {
    const spec = FISH[f.k];
    if (f.lift > 0) f.lift -= dt;
    if (f.flee > 0) f.flee -= dt;
    if (f.rest > 0) f.rest -= dt;
    f.tt -= dt;
    // threat from the poi: fast movement near a fish, and the splash when it enters the water
    if (P.down || P.entryT > 0) {
      const d = Math.hypot(f.x - P.x, f.y - P.y);
      if (P.entryT > 0 && d < TUNE.entryShock && f.flee <= 0 && P.dipT < 0.5) { if (r.chance(clamp(spec.startle * (1 - d / TUNE.entryShock) * 1.6, 0, 1))) flee(f, P.x, P.y, 0.9); }
      const sp = P.sp;
      if (P.down && sp > TUNE.startleSpeed) {
        const zone = POI_R * 1.15 + 40 + sp * 0.5;
        if (d < zone) { const pr = clamp((sp - TUNE.startleSpeed) / 240, 0, 1) * spec.startle * 6 * dt; if (r.chance(pr)) flee(f, P.x, P.y, 0.7); }
      }
    }
    if (f.tt <= 0 && f.flee <= 0) {
      f.tx = r.range(90, TW - 90); f.ty = r.range(90, TH - 90); f.tt = r.range(1.4, 4);
      if (r.chance(spec.restP * 0.5)) f.rest = r.range(0.8, 2.4);
    }
    const cruise = spec.spd * f.size;
    let want = f.flee > 0 ? cruise * 2.5 : f.rest > 0 ? cruise * 0.06 : cruise;
    // steering
    let desired = f.flee > 0 ? f.h : Math.atan2(f.ty - f.y, f.tx - f.x);
    // walls
    const m = 90;
    let ax = 0, ay = 0;
    if (f.x < m) ax += (m - f.x) / m; if (f.x > TW - m) ax -= (f.x - (TW - m)) / m;
    if (f.y < m) ay += (m - f.y) / m; if (f.y > TH - m) ay -= (f.y - (TH - m)) / m;
    if (ax || ay) { const wa = Math.atan2(ay, ax); desired = wa; if (f.flee > 0) f.h = wa; }
    // separation
    for (const o of fs) {
      if (o === f) continue;
      const dx = f.x - o.x, dy = f.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 < 3600 && d2 > 0.01) { f.x += (dx / Math.sqrt(d2)) * 18 * dt; f.y += (dy / Math.sqrt(d2)) * 18 * dt; }
    }
    // turn toward desired heading at a limited rate
    let da = desired - f.h; da = Math.atan2(Math.sin(da), Math.cos(da));
    const rate = f.flee > 0 ? 7 : 2.6;
    f.h += clamp(da, -rate * dt, rate * dt);
    f.s += (want - f.s) * Math.min(1, dt * (f.flee > 0 ? 8 : 2));
    f.x = clamp(f.x + Math.cos(f.h) * f.s * dt, 30, TW - 30); f.y = clamp(f.y + Math.sin(f.h) * f.s * dt, 30, TH - 30);
    f.ph += dt * (2.4 + f.s * 0.055);
  }
  // fish returning to the tank in free scoop
  if (w.pending.length) {
    for (const p of w.pending) p.t -= dt;
    const ready = w.pending.filter((p) => p.t <= 0);
    if (ready.length) { w.pending = w.pending.filter((p) => p.t > 0); for (const p of ready) { w.fish.push(p.fish); w.ev.push({ type: 'release', x: p.fish.x, y: p.fish.y, k: p.fish.k }); } }
  }
}

function tearPoi(w, why) {
  const P = w.poi;
  P.down = false; P.lift = null; P.hold = NEW_SHEET_T; P.entryT = 0;
  w.ev.push({ type: 'tear', x: P.x, y: P.y, why });
  w.torn++; w.streak = 0;
  w.sheetNo++;
  P.paper = 1; P.wet = 0; P.dipT = 0; P.fresh = NEW_SHEET_T;
  if (!w.endless && w.sheetNo >= w.sheets) w.over = true;
}

// ---- player commands ---------------------------------------------------------------------------------------------------------
export function poiPress(w, x, y) {
  const P = w.poi;
  if (P.down || P.hold > 0 || w.over) return false;
  P.down = true; P.x = P.tx = clamp(x, 0, TW); P.y = P.ty = clamp(y, 0, TH); P.sp = 0; P.entryT = 0.5; P.dipT = 0; P.trail.length = 0;
  w.ev.push({ type: 'entry', x: P.x, y: P.y });
  return true;
}
export function poiMove(w, x, y) { const P = w.poi; if (P.down) { P.tx = clamp(x, 0, TW); P.ty = clamp(y, 0, TH); } }

// Lift the scoop. Returns the outcome record (also kept in w.last).
export function poiRelease(w, r) {
  const P = w.poi;
  if (!P.down) return null;
  P.down = false;
  const spec = (f) => FISH[f.k];
  const inside = w.fish.map((f) => ({ f, d: Math.hypot(f.x - P.x, f.y - P.y) })).filter((o) => o.d <= CATCH_R).sort((a, b) => a.d - b.d).slice(0, MAX_SCOOP);
  const kept = [], slipped = [];
  for (const o of inside) { if (P.sp <= spec(o.f).grip) kept.push(o.f); else slipped.push(o.f); }
  const G = GRADES[w.grade];
  const strength = Math.max(0, P.paper) * (1 - TUNE.wetWeak * P.wet) * G.str;
  const load = kept.reduce((a, f) => a + spec(f).w, 0) * TUNE.strain;
  const out = { x: P.x, y: P.y, kept: [], slipped: slipped.map((f) => f.k), tore: false, pts: 0, load, strength, combo: 1, speed: P.sp, empty: inside.length === 0 };
  P.lift = { t: 0, ok: true, dur: clamp(0.42 + 0.4 * (load / Math.max(0.05, strength)) * (kept.length ? 1 : 0), 0.42, 0.8), items: kept.map((f) => ({ k: f.k, x: f.x, y: f.y })) };
  for (const f of slipped) { w.ev.push({ type: 'slip', x: f.x, y: f.y, k: f.k }); flee(f, P.x, P.y, 0.8); }
  if (kept.length && load > strength) {
    // the paper gives way: the fish drop back and the sheet is spent
    out.tore = true; P.lift = null;
    for (const f of kept) flee(f, P.x, P.y, 1.0);
    w.ev.push({ type: 'tearlift', x: P.x, y: P.y });
    tearPoi(w, 'strain');
  } else if (kept.length) {
    const keptIds = new Set(kept.map((f) => f.id));
    w.streak++;
    const combo = 1 + 0.25 * Math.min(4, w.streak - 1);
    const base = kept.reduce((a, f) => a + spec(f).pts, 0) * (1 + 0.4 * (kept.length - 1));
    out.pts = Math.round(base * combo * G.mult); out.combo = combo;
    out.kept = kept.map((f) => f.k);
    w.score += out.pts; w.scoops += kept.length; w.bestScoop = Math.max(w.bestScoop, out.pts);
    for (const f of kept) { w.caught.push(f.k); w.ev.push({ type: 'catch', x: f.x, y: f.y, k: f.k, pts: out.pts }); }
    w.fish = w.fish.filter((f) => !keptIds.has(f.id));
    // catch and release: the fish is shown on the paper, then set back into the same pool a short way from where it was lifted
    if (w.release) kept.forEach((f, i) => {
      const a = r.range(0, Math.PI * 2), d = r.range(50, 110);
      w.pending.push({ t: P.lift.dur + 0.3, fish: { ...f, x: clamp(f.x + Math.cos(a) * d, RELEASE_M, TW - RELEASE_M), y: clamp(f.y + Math.sin(a) * d, RELEASE_M, TH - RELEASE_M), flee: 0, rest: 0, lift: 0, h: a } });
    });
    P.paper -= load * TUNE.damage;
    P.dipT = 0;
    if (P.paper < TUNE.spentBelow) { w.last = out; tearPoi(w, 'spent'); return out; }
  } else {
    w.streak = 0;
    w.ev.push({ type: 'empty', x: P.x, y: P.y });
  }
  if (!w.endless && w.fish.length === 0 && w.pending.length === 0) w.over = true;
  if (w.goal && w.caught.length >= w.goal) w.over = true;   // Watch & Learn: the demo ends after as many scoops as the tank has fish
  w.last = out;
  return out;
}

// ---- advice (the Think hint and the Watch & Learn player) -------------------------------------------------------------------
// Which fish is worth going for right now, and why. Slow, resting, light fish are easy; heavy ones need strong, dry paper.
export function advise(w) {
  const P = w.poi, G = GRADES[w.grade];
  const strength = Math.max(0.0001, P.paper) * (1 - TUNE.wetWeak * Math.min(P.wet, 0.55)) * G.str;
  let best = null;
  for (const f of w.fish) {
    const sp = FISH[f.k];
    const load = sp.w * TUNE.strain, easy = 1 / (1 + (f.flee > 0 ? 3 : 0) + f.s / 55);
    const fits = load < strength * 0.85;
    const edge = Math.min(f.x, TW - f.x, f.y, TH - f.y) < 70 ? 0.6 : 1;
    const near = 1 / (1 + Math.hypot(f.x - P.x, f.y - P.y) / 700);
    const score = (fits ? sp.pts : sp.pts * 0.2) * (0.35 + easy) * edge * (0.6 + near) * (1 + (f.rest > 0 ? 0.8 : 0));
    if (!best || score > best.score) best = { f, score, fits, load };
  }
  if (!best) return null;
  const f = best.f, sp = FISH[f.k];
  const why = !best.fits ? `${sp.name} is heavy for this paper: a gentle lift, quickly.` : f.rest > 0 ? `${sp.name} is resting: slide in slowly and lift.` : f.s < 50 ? `${sp.name} is swimming slowly: easy to lead.` : `${sp.name} is worth ${sp.pts}: follow it gently and lift.`;
  return { id: f.id, k: f.k, x: f.x, y: f.y, fits: best.fits, why };
}

// where a fish will be in `secs` (for leading it); stays inside the tank
export function fishAhead(f, secs) {
  return { x: clamp(f.x + Math.cos(f.h) * f.s * secs, 40, TW - 40), y: clamp(f.y + Math.sin(f.h) * f.s * secs, 40, TH - 40) };
}

// ---- the automatic player (Watch & Learn) ------------------------------------------------------------------------------------
// A hand with a poi: a reaction pause, a smooth ease-in / ease-out glide above the water to a dip point beside the fish (0.6 to 1.2 s),
// a gentle dip, a slow proportional creep under the fish that eases in and out, a short steady settle and then the lift.
// Every random choice comes from the sim generator `r`, so a seed gives the same hand. `ap.log` records each attempt's timings.
export const AUTO = { reactMin: 0.35, reactMax: 0.6, travelMin: 0.6, travelMax: 1.2, dipAway: 242, creepMax: 4.5, settleMin: 0.15, settleMax: 0.3, accel: 450 };
export const newAuto = () => ({ id: -1, t: 0, cool: 0.4, pref: null, phase: 'idle', log: [], v: 0 });
const minJerk = (u) => { u = clamp(u, 0, 1); return u * u * u * (10 - 15 * u + 6 * u * u); };
export function autoStep(w, ap, r, dt) {
  const P = w.poi;
  if (w.over || P.hold > 0) return;
  if (ap.phase === 'travel') {
    // the poi is above the water here: glide to the dip point
    ap.t += dt;
    const e = minJerk(ap.t / ap.dur);
    P.x = ap.x0 + (ap.ex - ap.x0) * e; P.y = ap.y0 + (ap.ey - ap.y0) * e; P.tx = P.x; P.ty = P.y;
    if (ap.t >= ap.dur) {
      ap.log.push({ kind: 'travel', dur: ap.t });
      if (poiPress(w, ap.ex, ap.ey)) { ap.phase = 'creep'; ap.t = 0; ap.v = 0; } else { ap.phase = 'idle'; ap.cool = 0.3; }
    }
    return;
  }
  if (!P.down) {
    ap.phase = 'idle';
    if (ap.cool > 0) { ap.cool -= dt; return; }
    if (P.lift) return;
    const adv = ap.pref != null && w.fish.some((q) => q.id === ap.pref) ? { id: ap.pref } : advise(w);
    if (!adv) return;
    const f = w.fish.find((q) => q.id === adv.id);
    const a = f.h + Math.PI / 2 * (adv.id % 2 ? 1 : -1) + r.range(-0.35, 0.35);
    const away = AUTO.dipAway * r.range(0.95, 1.1);
    const ex = clamp(f.x + Math.cos(a) * away, 40, TW - 40), ey = clamp(f.y + Math.sin(a) * away, 40, TH - 40);
    const dist = Math.hypot(ex - P.x, ey - P.y);
    ap.dur = clamp((0.55 + 0.5 * Math.min(1, dist / 700)) * r.range(0.92, 1.12), AUTO.travelMin, AUTO.travelMax);
    ap.x0 = P.x; ap.y0 = P.y; ap.ex = ex; ap.ey = ey; ap.t = 0; ap.id = adv.id; ap.phase = 'travel';
    ap.vmax = r.range(0.92, 1.08); ap.settle = r.range(AUTO.settleMin, AUTO.settleMax); ap.still = 0;
    return;
  }
  ap.t += dt;
  const f = w.fish.find((q) => q.id === ap.id);
  if (!f || ap.t > AUTO.creepMax) { ap.log.push({ kind: 'creep', dur: ap.t, miss: true }); poiRelease(w, r); ap.cool = 0.5; ap.phase = 'idle'; return; }
  // creep under the fish: speed follows the distance (fast when far, careful when close) and eases in and out
  const lead = fishAhead(f, 0.3), dx = lead.x - P.x, dy = lead.y - P.y, d = Math.hypot(dx, dy) || 1;
  const want = (d > 200 ? 90 : clamp(Math.max(22 + d * 0.24, f.s * 1.1 + d * 0.22), 0, 82)) * ap.vmax * (d < 6 ? d / 6 : 1);
  ap.v += clamp(want - ap.v, -AUTO.accel * dt * 1.6, AUTO.accel * dt);
  const step = Math.min(d, ap.v / 16);   // the poi eases toward its target at 16 per second, so a target v/16 ahead gives speed v
  P.tx = clamp(P.x + (dx / d) * step * 1.0, 0, TW); P.ty = clamp(P.y + (dy / d) * step, 0, TH);
  if (Math.hypot(f.x - P.x, f.y - P.y) < 38 && P.sp < 95) {
    ap.still += dt;
    if (ap.still >= ap.settle) { ap.log.push({ kind: 'creep', dur: ap.t }); poiRelease(w, r); ap.cool = 0.6; ap.phase = 'idle'; }
  } else ap.still = Math.max(0, ap.still - dt);
}
