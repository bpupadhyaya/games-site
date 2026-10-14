// Ssireum engine: pure and deterministic (no clock, no random). One FALL is a series of BEATS. Each beat both wrestlers commit one move
// at the same time and resolve() applies both.
//
// A wrestler has a balance dot p = {x, y} on a disc of radius 1 in HIS OWN frame: +y is forward (toward the rival), +x is his right.
// Past the edge (|p| >= 1) he is down. Grip (0..GRIP_MAX) is spent by hard moves and returns a little each beat.
//
// A move is { kind: 'pull' | 'hook' | 'brace', dir: 0..7, pow: 1..3 }. dir 0 is forward, then clockwise in 45 degree steps.
//   pull   sends the RIVAL's dot along dir (in the rival's frame); your own dot recoils the other way. A brace soaks it up.
//   hook   leg hook toward dir: ignores braces, strong on a loaded wrestler (dot off-centre, or one who pulled this beat), weak and
//          whiffing against one who is centred.
//   brace  resist being sent toward dir: removes pulls in proportion to cos(angle) x strength, and roots (the dot settles faster).
export const KINDS = ['pull', 'hook', 'brace'];
export const GRIP_MAX = 5;
export const GRIP_START = 4;
export const NDIR = 8;
export const POWERS = [1, 2, 3];
export const POW_NAMES = ['Light', 'Firm', 'Full'];
export const WINS_NEEDED = 2;

export const TUNE = {
  pull: [0.30, 0.52, 0.72],        // dot displacement of the rival per power at full grip
  gripFloor: 0.55,                 // a spent grip pulls at 55 % + 45 % x grip fraction
  hook: [0.24, 0.38, 0.52],
  hookBase: 0.45, hookLoad: 1.25,  // hook strength x (base + load x loaded)
  hookCatch: 0.38,                 // extra "loaded" when the rival pulled this beat
  whiffLoad: 0.22,                 // below this loaded value a hook whiffs
  whiffRecoil: 0.13,               // x power, the hooker's own dot
  recoilPull: 0.10, recoilHook: 0.06,
  brace: [0.40, 0.68, 0.92],        // fraction of an aligned pull that is soaked
  decay: 0.86, decayRoot1: 0.78, decayRoot2: 0.68,
  passNudge: 0.3,                  // third brace in a row
  gripBack: 1,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dirVec = (k) => { const a = (((k % 8) + 8) % 8) * Math.PI / 4; return { x: Math.round(Math.sin(a) * 1000) / 1000, y: Math.round(Math.cos(a) * 1000) / 1000 }; };
export const gripCost = (m) => (m.kind === 'hook' ? m.pow : m.pow - 1);
export const legalMove = (F, s, m) => gripCost(m) <= F.grip[s];
export const norm = (p) => Math.hypot(p.x, p.y);

export function newFall() {
  return { beat: 0, p: [{ x: 0, y: 0 }, { x: 0, y: 0 }], grip: [GRIP_START, GRIP_START], streak: [0, 0], last: [null, null], over: null, log: [] };
}

// What one move does to the rival (a vector in the rival's frame), before the rival's brace.
function force(F, s, m, otherMove) {
  if (m.kind === 'brace') return { x: 0, y: 0, loaded: 0, whiff: false };
  const v = dirVec(m.dir), o = 1 - s;
  const gf = TUNE.gripFloor + (1 - TUNE.gripFloor) * (F.grip[s] / GRIP_MAX);
  if (m.kind === 'pull') { const k = TUNE.pull[m.pow - 1] * gf; return { x: v.x * k, y: v.y * k, loaded: 0, whiff: false }; }
  const loaded = clamp(norm(F.p[o]) + (otherMove && otherMove.kind === 'pull' ? TUNE.hookCatch : 0), 0, 1);
  const k = TUNE.hook[m.pow - 1] * gf * (TUNE.hookBase + TUNE.hookLoad * loaded);
  return { x: v.x * k, y: v.y * k, loaded, whiff: loaded < TUNE.whiffLoad };
}

// Pure prediction of one beat: returns the new dots, grips, streaks and per-side detail. Used by resolve() and by the computer
// wrestlers when they weigh moves.
export function predict(F, moves) {
  const out = { p: [null, null], grip: [0, 0], streak: [0, 0], side: [null, null], nudged: [false, false] };
  const f = [force(F, 0, moves[0], moves[1]), force(F, 1, moves[1], moves[0])];
  for (let s = 0; s < 2; s++) {
    const o = 1 - s, m = moves[s], om = moves[o];
    // incoming: the rival's force, soaked by my brace (pulls only)
    let inc = { x: f[o].x, y: f[o].y }, soak = 0;
    if (m.kind === 'brace' && om.kind === 'pull') {
      const mag = Math.hypot(inc.x, inc.y);
      if (mag > 1e-9) {
        const b = dirVec(m.dir), c = Math.max(0, (inc.x * b.x + inc.y * b.y) / mag);
        soak = clamp(c * TUNE.brace[m.pow - 1], 0, 1);
        inc = { x: inc.x * (1 - soak), y: inc.y * (1 - soak) };
      }
    }
    // my recoil: pulling/hooking leans me the other way; a whiffed hook costs more
    let rec = { x: 0, y: 0 };
    if (m.kind !== 'brace') {
      const v = dirVec(m.dir), k = m.kind === 'pull' ? TUNE.recoilPull : TUNE.recoilHook;
      rec = { x: -v.x * k * m.pow, y: -v.y * k * m.pow };
      if (f[s].whiff) { rec.x -= v.x * TUNE.whiffRecoil * m.pow; rec.y -= v.y * TUNE.whiffRecoil * m.pow; }
    }
    const decay = m.kind === 'brace' ? (m.pow >= 3 ? TUNE.decayRoot2 : m.pow === 2 ? TUNE.decayRoot2 + 0.04 : TUNE.decayRoot1) : TUNE.decay;
    let p = { x: F.p[s].x * decay + inc.x + rec.x, y: F.p[s].y * decay + inc.y + rec.y };
    const streak = m.kind === 'brace' ? F.streak[s] + 1 : 0;
    let nudged = false;
    if (streak >= 3) { p = { x: p.x, y: p.y - TUNE.passNudge }; nudged = true; }
    out.p[s] = p; out.streak[s] = nudged ? 0 : streak; out.nudged[s] = nudged;
    out.grip[s] = clamp(F.grip[s] - gripCost(m) + TUNE.gripBack, 0, GRIP_MAX);
    out.side[s] = { move: m, force: f[s], incoming: inc, soak, recoil: rec, whiff: f[s].whiff, loaded: f[s].loaded };
  }
  return out;
}

// Names: English first, the Korean technique in brackets where there is a well-known one. dir is in the RIVAL's frame for pulls/hooks.
export const DIR_NAMES = ['forward', 'forward right', 'right', 'back right', 'back', 'back left', 'left', 'forward left'];
export function techniqueName(kind, dir) {
  if (kind === 'brace') return 'Root';
  const d = ((dir % 8) + 8) % 8;
  if (kind === 'pull') {
    if (d === 0) return 'Belly lift (baejigi)';
    if (d === 4) return 'Drive back';
    if (d === 2 || d === 6) return 'Side pull';
    return d === 1 || d === 7 ? 'Forward hip turn' : 'Back hip turn';
  }
  if (d === 2 || d === 6) return 'Outside leg hook (batdari-geolgi)';
  if (d === 1 || d === 7) return 'Inside leg hook (andari-geolgi)';
  if (d === 0) return 'Knee trip';
  return d === 4 ? 'Back sweep' : 'Sickle hook (homigeori)';
}

// Apply a beat. Returns a report for the view; sets F.over = { win, how, name, beats } when a dot leaves its disc.
export function resolve(F, moves) {
  const before = { p: F.p.map((p) => ({ ...p })), grip: F.grip.slice() };
  const r = predict(F, moves);
  F.beat++;
  F.p = r.p; F.grip = r.grip; F.streak = r.streak; F.last = [moves[0], moves[1]];
  const mag = F.p.map(norm);
  const out = [mag[0] >= 1, mag[1] >= 1];
  let over = null;
  if (out[0] || out[1]) {
    let loser = out[0] && out[1] ? (Math.abs(mag[0] - mag[1]) < 0.02 ? -1 : mag[0] > mag[1] ? 0 : 1) : out[0] ? 0 : 1;
    if (loser < 0) {   // a dead heat: both slip, no fall, both settle
      F.p = [{ x: F.p[0].x * 0.4, y: F.p[0].y * 0.4 }, { x: F.p[1].x * 0.4, y: F.p[1].y * 0.4 }];
      over = null;
    } else {
      const win = 1 - loser, wm = moves[win];
      over = { win, loser, how: wm.kind === 'brace' ? 'pass' : wm.kind, name: r.nudged[loser] ? 'Caution (passivity)' : wm.kind === 'brace' ? 'Slip' : techniqueName(wm.kind, wm.dir), beats: F.beat, dir: F.p[loser].y >= 0 ? 'forward' : 'back', vec: { ...F.p[loser] } };
      F.over = over;
    }
  }
  const rep = { beat: F.beat, moves: [moves[0], moves[1]], before, after: { p: F.p.map((p) => ({ ...p })), grip: F.grip.slice() }, side: r.side, nudged: r.nudged, over, slip: out[0] && out[1] && !over };
  F.log.push({ beat: F.beat, moves: rep.moves });
  if (F.log.length > 40) F.log.shift();
  return rep;
}
