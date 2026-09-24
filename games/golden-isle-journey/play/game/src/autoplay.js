// Auto Play: full-session per-chapter drivers for the assisted-learning THINK -> REVEAL -> ACT
// loop (see game.js `startAutoplay`/`updateAutoplay`, STATUS.md for the design reasoning).
//
// This game has no single ai.js/engine.js: 13 chapters, 13 different verbs (hold-release, drag,
// tap-timing, lane defence, angle+power archery...). demos.js already ships a hand-tuned per-chapter
// `script(d)` for each one, but those are short (5-7s) TEACHING SNIPPETS bounded by an artificial
// `dur`/`d.mem.n` cap - built to show the first couple of actions, not to finish a 45-120s chapter.
// The functions below reuse the SAME targeting/timing techniques (several lines are a direct,
// credited adaptation of demos.js's own math) but are written to keep reacting to the chapter's
// LIVE state for as long as it takes to reach a real result() - a genuine, whole-chapter player,
// not a scripted preview. Every chapter here also exposes an equivalent KEYBOARD control (Space /
// Arrow keys / Digit1-3, for the web demo's own keyboard play) alongside the touch one; where that
// keyboard path is simpler to drive correctly (e.g. a fixed-power keyboard shot in ch12, or ch10's
// own "pick the carrier over the next gap" Space shortcut) these scripts prefer it over reproducing
// the touch geometry.
import { clamp, lerp, smooth } from './stage.js';
import { tenHeadPos } from './puppets.js';
import { T } from './text.js';

export const AP_THINK_STEPS = [2, 5, 8, 10]; // seconds; index array (never a raw float), default 5s
export const AP_REVEAL_TIME = 2;             // fixed, the same at every think-time step

// A driver like demos.js's createDriver, extended with keyboard press/release and a small `mem`
// bag each script can use for its own timers - built fresh per chapter attempt (see apOpenChapter).
export function createApDriver() {
  const pointer = { x: 360, y: 900, down: false, pressed: false, released: false };
  const keys = { down: new Set(), pressed: new Set() };
  const d = {
    input: { pointer, keys }, mem: {}, t: 0, autoRel: -1,
    press(x, y) { pointer.x = x; pointer.y = y; if (!pointer.down) pointer.pressed = true; pointer.down = true; },
    move(x, y) { pointer.x = x; pointer.y = y; },
    release() { if (pointer.down) pointer.released = true; pointer.down = false; },
    tap(x, y) { d.press(x, y); d.autoRel = d.t + 0.1; },
    keyDown(code) { if (!keys.down.has(code)) keys.pressed.add(code); keys.down.add(code); },
    keyUp(code) { keys.down.delete(code); },
    keyTap(code, hold = 0.06) { d.keyDown(code); d.mem['__rel_' + code] = d.t + hold; },
    // Call once per tick BEFORE the script runs: clears the one-tick pressed/released edges (the
    // same discipline web/kit/input.js's real snapshot() uses) and resolves any scheduled releases.
    beginTick(dt) {
      pointer.pressed = false; pointer.released = false; keys.pressed.clear();
      d.t += dt;
      if (d.autoRel >= 0 && d.t >= d.autoRel) { d.autoRel = -1; d.release(); }
      for (const k of Object.keys(d.mem)) if (k.startsWith('__rel_') && d.t >= d.mem[k]) { keys.down.delete(k.slice(6)); delete d.mem[k]; }
    },
  };
  return d;
}

const NOCK = { x: 250, y: 1190 }, G = 900; // must match 12-duel.js's own constants (duplicated: see header note)
// Search over angle only (a keyboard shot in ch12 always fires at fixed power 0.85, i.e. fixed
// speed) for the arc that passes closest to a moving target - a trimmed one-axis version of
// demos.js's own two-axis solveShot(), reused for the same reason (real projectile physics, no
// shortcuts).
function bestAngle(targetFn, v) {
  let best = null;
  for (let a = -3.0; a <= -0.15; a += 0.015) {
    let x = NOCK.x, y = NOCK.y, vx = Math.cos(a) * v, vy = Math.sin(a) * v, dmin = 1e9;
    for (let i = 1; i <= 180; i++) {
      vy += G / 60; x += vx / 60; y += vy / 60;
      const [tx, ty] = targetFn(i / 60); const dd = Math.hypot(x - tx, y - ty);
      if (dd < dmin) dmin = dd;
      if (y > 1560 + 50 || x > 720 + 50 || x < -50) break;
    }
    if (!best || dmin < best.d) best = { a, d: dmin };
  }
  return best;
}

// The waypoints where Ayodhya's people wait, from 02-exile.js's own GROUPS constant (not exported
// - duplicated here rather than changing that file just to export a constant this pass needs).
const EXILE_GROUPS = [650, 1350, 1950, 2500, 2940];

export const AP_SCRIPTS = {
  // 1: the great bow - hold (Space), release right as power crosses the shrinking gold band, for
  // ALL three stages (demos.js's own version stops after stage 1 - see its own script comment).
  1(d, s) {
    if (s.phase !== 'play') return;
    const CENTER = [0.58, 0.68, 0.74], c = CENTER[Math.min(2, s.stage)];
    if (!d.input.keys.down.has('Space')) d.keyDown('Space');
    else if (s.power >= c - 0.01) d.keyUp('Space');
  },
  // 2: the exile - hold to walk (Space), release beside each un-greeted group of well-wishers for
  // long enough to receive their farewell (s.got[k]), then resume walking.
  2(d, s) {
    if (s.done) return;
    const i = EXILE_GROUPS.findIndex((gx, k) => !s.got[k] && Math.abs(s.x - 60 - gx) < 150);
    if (i >= 0) { if (d.input.keys.down.has('Space')) d.keyUp('Space'); }
    else if (!d.input.keys.down.has('Space')) d.keyDown('Space');
  },
  // 3: defend the forest home - tap the nearest-arriving raider (by time-to-reach), continuously,
  // whenever the quiver has an arrow. Direct reuse of demos.js's own targeting math (already
  // open-ended, no cap - it was already correct for a full run, just never run that long before).
  3(d, s) {
    if (d.input.pointer.down || s.quiver <= 0) return;
    const centre = (r) => (r.kind === 'flyer' ? [r.x, r.y] : [r.x, r.y - 105 * (r.kind === 'brute' ? 1.5 : 1)]);
    const eta = (r) => (r.kind === 'flyer' ? 7.5 : Math.abs(r.x - 410) / (r.kind === 'brute' ? 46 : 92));
    const r = s.raiders.filter((q) => q.hp > 0).sort((a, b) => eta(a) - eta(b))[0];
    if (r) { const [cx, cy] = centre(r); d.tap(cx, cy); }
  },
  // 4: the regency - each petition auto-advances on its own timers (enter/ask/answer/leave); the
  // only real decision is which of the two answers to give. Picks the higher-value one every time
  // (`prefer a winning/scoring action`), reading the same petitions.va/vb the chapter itself uses.
  4(d, s) {
    if (s.phase !== 'ask' || s.phaseT <= 0.4 || d.mem.i === s.i) return;
    d.mem.i = s.i;
    const q = T.chapters[3].petitions[s.i], c = q.va >= q.vb ? 0 : 1;
    d.tap(360, c === 0 ? 1388 : 1488);
  },
  // 5: the golden deer - phases (chase -> cry -> sky -> eagle -> away) all auto-advance; input only
  // matters during 'chase' (lead-shoot the deer's near-future position) and 'eagle' (tap the
  // glinting wheel). No demo `cuts` here - the real phase change happens on its own in real play.
  5(d, s) {
    if (d.input.pointer.down) return;
    if (s.phase === 'chase') {
      if ((d.mem.shotAt ?? -9) + 0.55 > s.t) return;
      const lead = s.t + 0.4, x = 520 + Math.sin(lead * 0.9) * 90 + Math.sin(lead * 2.3) * 30;
      const ty = [1200, 1010, 830][s.lane], y = s.deerY + (ty - s.deerY) * (1 - Math.pow(0.02, 0.4));
      d.tap(x, y - 70); d.mem.shotAt = s.t;
    } else if (s.phase === 'eagle' && s.glint >= 0) {
      d.tap(s.chX + (s.glint === 0 ? -70 : 60), s.chY + Math.sin(s.t * 2) * 6 + 56);
    }
  },
  // 6: the alliance - tap any un-called band within reach while horn calls remain. Direct reuse of
  // demos.js's own selection rule, uncapped so it keeps calling for the whole hillside, not just 2.
  6(d, s) {
    if (s.phase !== 'pan' || d.input.pointer.down || s.calls <= 0) return;
    const b = s.bands.find((q) => !q.called && q.x - s.scroll > 250 && q.x - s.scroll < 470 && q.y > 300);
    if (b) d.tap(b.x - s.scroll, b.y - 70);
  },
  // 7: the leap (flagship, cannot be lost) - continuously re-aims at a safe altitude for whatever
  // hazard/wind is soonest ahead, re-evaluated every tick from LIVE state (demos.js's version only
  // ever looks at the ONE wind object present at setup, enough for its 6s snippet, not a whole
  // flight past many more of them).
  7(d, s) {
    const seaY = 1370, yFor = (alt) => 90 + seaY + s.cam - alt * s.zoom;
    const ahead = s.objs.filter((o) => o.x + (o.len ?? 300) > s.x && o.x < s.x + 1600).sort((a, b) => a.x - b.x);
    const o = ahead[0];
    let alt = 900;
    if (o) {
      if (o.k === 'wind') alt = o.alt;
      else if (o.k === 'jaws') alt = o.h + 260;
      else if (o.k === 'shadow') alt = 520;
      else if (o.k === 'storm') alt = o.alt - o.r - 260;
      else if (o.k === 'mount') alt = o.h + 260;
    }
    if (!d.input.pointer.down) d.press(250, yFor(alt)); else d.move(250, clamp(yFor(alt), 200, 1450));
  },
  // 8: the fortress by night - advance one terrace at a time to the safest reachable patch, the
  // same cone-avoidance search demos.js's own script uses (already open-ended, no cap worth
  // removing - the driver just never called it this long before). Extended past that short snippet
  // in one way: a same-row lateral dodge is tried too when neither next-row patch is safe (the real
  // chapter allows it - `cur.r` is a legal target, not just `cur.r + 1` - demos.js's 5s preview
  // never needed it, a full 20-terrace climb sometimes does).
  8(d, s) {
    if (s.phase !== 'hide' || d.input.pointer.down) return;
    const cur = s.patches[s.at], rowY = (r) => 6400 - r * 320;
    const gx = (g, tt) => g.x + (g.walk ? Math.sin(tt * 0.5 + g.ph) * g.walk : 0), ga = (g, tt) => g.base + Math.sin(tt * g.w + g.ph) * g.amp;
    const inCone = (g, x, y, tt) => { const dx = x - gx(g, tt), dy = y - 70 - (g.y - 60), dd = Math.hypot(dx, dy); if (dd > 330) return false; let da = Math.atan2(dy, dx) - ga(g, tt); da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < 0.3; };
    const safe = (q) => { for (let u = 0.08; u <= 0.92; u += 0.02) { const k = smooth(u), hx = lerp(cur.x, q.x, k), hy = lerp(rowY(cur.r), rowY(q.r), k) - Math.sin(k * Math.PI) * 50; if (s.guards.some((g) => inCone(g, hx, hy, s.t + 0.6 * u))) return false; } return true; };
    const fwd = s.patches.filter((q) => q.r === cur.r + 1);
    const side = s.patches.filter((q) => q.r === cur.r && q !== cur);
    const target = fwd.find(safe) ?? side.find(safe);
    if (target) { d.tap(target.x, rowY(target.r) - 20 - s.cam); d.mem.waitT = 0; return; }
    // Nothing looks clear THIS instant - the guards' cones keep sweeping, so wait for an opening
    // instead of committing blind (a real improvement over demos.js's own snippet, which never had
    // to wait since it only ever shows one or two climbs). Only forces a guess past a bounded wait.
    d.mem.waitT = (d.mem.waitT ?? 0) + 1 / 60;
    if (d.mem.waitT > 1.3) { d.tap(fwd[0].x, rowY(fwd[0].r) - 20 - s.cam); d.mem.waitT = 0; }
  },
  // 9: the fortress burns - an auto-runner; jump (a short Space tap, the normal-height leap) at the
  // very last safe instant before the current platform's right edge. Measured against the real
  // physics (JUMP/GRAV/CUT in 09-burn.js): a short tap's flight covers only ~240px total, so waiting
  // until the edge is genuinely close (not a generous lead) is what actually clears the 130-200px
  // gaps - jumping too early undershoots the next platform just as often as jumping too late falls
  // short of the current one.
  9(d, s) {
    if (s.phase !== 'run' || s.slip > 0 || !s.ground) return;
    const plat = s.plats.find((q) => s.x >= q.x - 6 && s.x <= q.x + q.w + 6 && q.y === s.y);
    if (!plat) return;
    const edge = plat.x + plat.w - s.x;
    if (edge < 30 && !d.input.keys.down.has('Space')) d.keyTap('Space');
  },
  // 10: the bridge - the chapter's own keyboard shortcut already picks "the carrier over the next
  // gap" for us (see 10-bridge.js `keys.pressed.has('Space')`); just press it on a steady rhythm.
  // (Even doing nothing at all still finishes this chapter after GIVE_UP seconds, 1 star - but this
  // reliably does much better.)
  10(d, s) {
    if ((d.mem.nextAt ?? 0) > s.t) return;
    d.keyTap('Space'); d.mem.nextAt = s.t + 0.5;
  },
  // 11: the war - cycle the three unit types into their lanes as energy allows (Digit1-3 to pick,
  // a tap in the lane band to place); during the herb-flight interlude, weave up/down to dodge the
  // cloud field (a simple periodic dodge - the interlude ends on its own timer regardless of hits).
  11(d, s) {
    if (s.phase === 'battle') {
      if ((d.mem.nextAt ?? 0) > s.t) return;
      // Reinforce whichever lane has the most urgent (furthest-advanced) raider, with the unit type
      // that counters it (VAN.beats/RAI.preys, mirrored here since they're not exported) - a real
      // defence, not a round-robin that lets raiders walk straight through an empty lane.
      const order = ['leaper', 'thrower', 'rallyer'], costs = { leaper: 2, thrower: 4, rallyer: 3 }, counters = { archer: 'leaper', brute: 'thrower', giant: 'thrower', spear: 'rallyer' };
      let lane = Math.floor(s.t / 0.9) % 3, worstP = 2, threatType = null;
      for (const u of s.units) if (u.side === 'r' && u.hp > 0 && u.p < worstP) { worstP = u.p; lane = u.lane; threatType = u.type; }
      const pick = counters[threatType] ?? order[Math.floor(s.t / 0.9) % 3];
      if (s.energy < costs[pick]) return;
      d.keyTap(['Digit1', 'Digit2', 'Digit3'][order.indexOf(pick)]);
      d.tap([120, 360, 600][lane], 900);
      d.mem.nextAt = s.t + 0.7;
    } else if (s.phase === 'herbCard') {
      if (!d.input.pointer.down) d.tap(360, 900);
    } else if (s.phase === 'herb') {
      const want = Math.sin(s.t * 1.3) > 0 ? 'ArrowUp' : 'ArrowDown', drop = want === 'ArrowUp' ? 'ArrowDown' : 'ArrowUp';
      if (d.input.keys.down.has(drop)) d.keyUp(drop);
      if (!d.input.keys.down.has(want)) d.keyDown(want);
    }
  },
  // 12: the duel - keyboard aim (ArrowLeft/Right toward a numerically solved angle) + a fixed-power
  // Space shot. Priority: shoot down a live fire-bolt first (protects `resolve`), else the current
  // marked head, else the centre once Ravan's arms are up (read from the same phaseT cycle the
  // chapter's own private armsUp() uses, since that helper itself isn't on `s`).
  12(d, s) {
    if (s.phase === 'won') return;
    const V = 500 + 0.85 * 1500, ky = 640 + Math.sin(s.t * 0.9) * 14;
    let targetFn = null;
    const bolt = s.bolts.find((b) => !b.shot && b.t < 0.85);
    if (bolt) targetFn = (tau) => { const u = bolt.t + tau / 4.2; return [bolt.x0 + (bolt.tx - bolt.x0) * u, bolt.y0 + (bolt.ty - bolt.y0) * (u * u * 0.6 + u * 0.4)]; };
    else if ((s.phase === 'heads' || s.phase === 'counsel') && s.target >= 0) targetFn = () => { const [hx, hy] = tenHeadPos(s.target, s.rx, ky, 1.15); return [hx, hy - 8]; };
    else if (s.phase === 'core') {
      const cyc = s.phaseT % 4.4, armsUp = clamp(Math.min(cyc - 0.6, 3.0 - cyc) * 3, 0, 1);
      if (armsUp > 0.6) targetFn = () => [s.rx, ky - 112 * 1.15];
    }
    for (const c of ['ArrowLeft', 'ArrowRight']) if (d.input.keys.down.has(c)) d.keyUp(c);
    if (!targetFn) return;
    const best = bestAngle(targetFn, V);
    if (!best) return;
    const diff = best.a - s.angle;
    if (Math.abs(diff) > 0.03) d.keyDown(diff < 0 ? 'ArrowLeft' : 'ArrowRight');
    else if (s.reload <= 0 && !d.input.keys.down.has('Space')) d.keyTap('Space');
  },
  // 13: the return - press on (Space) once the reunion has been shown a moment; steer the flying
  // chariot toward each remaining light; light lamps in reach on the pass over the city; press on
  // again for the crowning once it has played a moment. Every phase also auto-advances on its own.
  13(d, s) {
    if (s.phase === 'reunion') { if (s.phaseT > 2.2 && !d.input.keys.down.has('Space')) d.keyTap('Space', 0.1); return; }
    if (s.phase === 'flight') {
      const wx = s.phaseT * 260 + 260, q = s.lights.find((l) => !l.got && l.x > wx - 100), yT = q ? q.y + 60 : 700;
      if (!d.input.pointer.down) d.press(360, yT + 60); else d.move(360, yT + 60);
      return;
    }
    if (s.phase === 'lamps') {
      const vis = s.lamps.filter((l) => !l.lit && l.y - s.cam > 380 && l.y - s.cam < 1150);
      if (vis.length) { const q = vis[0]; if (!d.input.pointer.down) d.press(q.x, q.y - s.cam); else d.move(q.x, q.y - s.cam); }
      else if (d.input.pointer.down) d.release();
      return;
    }
    if (s.phase === 'crown') { if (s.phaseT > 3 && !d.input.pointer.down) d.tap(360, 700); }
  },
};
