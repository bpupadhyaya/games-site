// Per-chapter teaching demos and in-play coaching. A demo runs the chapter's REAL update/render on a
// separate instance (own seeded rng, no saving, no result) with scripted input from a small script
// below, so what the player watches is exactly what they will do. Nothing here touches progress.
//
// A script is called once per tick with the driver `d`:
//   d.t (seconds), d.s (the demo chapter's state), d.press(x,y) / d.release() / d.tap(x,y),
//   d.moveTo(x,y,dur) (eased finger travel), d.follow(x,y) (direct), d.step = highlighted step (0-based).
// `labels(d)` returns [{k, x, y, tx, ty}] (k = key into text.js howto.ch[n].labels).
import { W, H, clamp, lerp, smooth } from './stage.js';
import { tenHeadPos } from './puppets.js';

export const IDLE = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };

export function createDriver(inst) {
  const ptr = { x: 360, y: 900, down: false, pressed: false, released: false };
  const keys = { down: new Set(), pressed: new Set() };
  const d = {
    t: 0, s: inst.state, ptr, keys, path: [], step: 0, downT: 0, from: null, lastPress: -9, lastRelease: -9, taps: [], tween: null, autoRel: -1, mem: {}, cut: -1,
    press(x, y) { if (ptr.down) return; ptr.x = x; ptr.y = y; ptr.pressed = true; ptr.down = true; d.downT = 0; d.path = [{ x, y }]; d.from = { x, y }; d.lastPress = d.t; d.taps.push({ t: d.t, x, y }); d.tween = null; },
    release() { if (!ptr.down) return; ptr.released = true; ptr.down = false; d.lastRelease = d.t; },
    tap(x, y) { d.press(x, y); d.autoRel = d.t + 0.1; },
    moveTo(x, y, dur = 0.4) { d.tween = { x0: ptr.x, y0: ptr.y, x1: x, y1: y, t0: d.t, dur }; },
    follow(x, y) { ptr.x = x; ptr.y = y; d.tween = null; },
    tick(dt) {
      ptr.pressed = false; ptr.released = false; keys.pressed.clear();
      d.t += dt; if (ptr.down) { d.downT += dt; }
      if (d.tween) { const u = smooth(clamp((d.t - d.tween.t0) / d.tween.dur, 0, 1)); ptr.x = lerp(d.tween.x0, d.tween.x1, u); ptr.y = lerp(d.tween.y0, d.tween.y1, u); if (u >= 1) d.tween = null; }
      if (d.autoRel >= 0 && d.t >= d.autoRel) { d.autoRel = -1; d.release(); }
    },
    record() { if (ptr.down) { d.path.push({ x: ptr.x, y: ptr.y }); if (d.path.length > 300) d.path.shift(); } },
    input: { pointer: ptr, keys },
  };
  return d;
}

// ---- helpers ----------------------------------------------------------------------------------
const NOCK = { x: 250, y: 1190 }, G = 900;
// Solve a duel shot: find angle + power whose arrow (same integrator as the chapter) meets target(τ).
function solveShot(target, radius) {
  let best = null;
  for (let pw = 0.3; pw <= 1.0001; pw += 0.02) {
    for (let a = -0.25; a >= -2.9; a -= 0.01) {
      const v = 500 + pw * 1500; let x = NOCK.x, y = NOCK.y, vx = Math.cos(a) * v, vy = Math.sin(a) * v, dmin = 1e9;
      for (let i = 1; i <= 210; i++) {
        vy += G / 60; x += vx / 60; y += vy / 60;
        const [tx, ty] = target(i / 60); const dd = Math.hypot(x - tx, y - ty); if (dd < dmin) dmin = dd;
        if (y > H + 50 || x > W + 50) break;
      }
      if (dmin < radius && (!best || pw < best.pw - 1e-9 || (Math.abs(pw - best.pw) < 1e-9 && dmin < best.d))) best = { a, pw, d: dmin };
    }
    if (best) break;
  }
  return best;
}

const hold = (d, x, y) => { if (!d.ptr.down) d.press(x, y); };

// ---- the demos ---------------------------------------------------------------------------------
const CENTER = [0.58, 0.68, 0.74];

export const DEMOS = {
  1: { // the great bow
    dur: 5.6, secs: true, capBottom: true,
    script(d) {
      const s = d.s, t = d.t, c = CENTER[Math.min(2, s.stage)];
      if (!d.ptr.down && !d.mem.busy && ((s.stage === 0 && t > 0.5) || (s.stage === 1 && t > d.mem.next))) { d.press(330, 820); d.mem.busy = true; d.step = 0; }
      if (d.ptr.down && Math.abs(s.power - c) < 0.012) { d.release(); d.mem.busy = false; d.mem.next = t + 0.9; d.step = 1; }
    },
    labels: (d) => [{ k: 'column', x: 470, y: 420, tx: 636, ty: 500 }, { k: 'band', x: 470, y: 640, tx: 622, ty: 470 + 640 * (1 - CENTER[Math.min(2, d.s.stage)]) }],
  },
  2: { // the exile
    dur: 5.4, secs: true, capBottom: true,
    setup(s) { s.x = 400; },
    script(d) {
      const t = d.t;
      if (t > 0.3 && t < 1.6) { hold(d, 200, 700); d.step = 0; }
      if (t >= 1.6 && t < 3.3) { d.release(); d.step = 1; }
      if (t >= 3.3) { hold(d, 200, 700); d.step = 0; }
    },
    labels: (d) => { const g = [650, 1350, 1950, 2500, 2940].find((gx, k) => !d.s.got[k]); return g && g - (d.s.x - 300) < 640 ? [{ k: 'people', x: clamp(g - (d.s.x - 300) + 60, 150, 570), y: 900, tx: g - (d.s.x - 300), ty: 1090 }] : []; },
  },
  3: { // defend the forest home
    dur: 5.4, showcase: true,
    script(d) {
      const s = d.s, t = d.t;
      const centre = (r) => (r.kind === 'flyer' ? [r.x, r.y] : [r.x, r.y - 105 * (r.kind === 'brute' ? 1.5 : 1)]);
      const eta = (r) => (r.kind === 'flyer' ? (1 - r.u) * 7.5 : Math.abs(r.x - 410) / (r.kind === 'brute' ? 46 : 92));
      const due = 0.4 + (d.mem.n ?? 0) * 0.55;
      if (t >= due && s.quiver > 0) {
        const r = s.raiders.filter((q) => q.hp > 0).sort((p, q) => eta(p) - eta(q))[0];
        if (r) { const [cx, cy] = centre(r); d.tap(cx, cy); d.mem.n = (d.mem.n ?? 0) + 1; d.mem.tgt = r.id; d.step = r.kind === 'brute' ? 1 : 0; }
      }
    },
    labels: (d) => { const r = d.s.raiders.find((q) => q.id === d.mem.tgt); if (!r || d.t - d.lastPress > 0.9) return []; const [cx, cy] = r.kind === 'flyer' ? [r.x, r.y] : [r.x, r.y - 110]; return [{ k: r.kind === 'flyer' ? 'flyer' : 'raider', x: clamp(cx, 170, 550), y: cy < 700 ? cy + 190 : cy - 200, tx: cx, ty: cy }]; },
  },
  4: { // the regency
    dur: 4.8, pre: 2.4,
    script(d) { if (d.t > 1.9 && !d.mem.done) { d.mem.done = true; d.tap(360, 1388); } },
    labels: () => [{ k: 'pick', x: 360, y: 1290, tx: 360, ty: 1360 }],
  },
  5: { // the golden deer: the chase, then (after a cut) the eagle and the glinting wheel
    dur: 6.6, cuts: [{ t: 3.0, fn(s) { s.phase = 'eagle'; s.pt = 4; s.cam = 640; s.chX = 400; s.hits = 3; s.glint = 1; s.glintT = 0.9; s.arrows = []; s.noHint = true; } }],
    script(d) {
      const s = d.s, t = d.t, plan = [0.7, 1.8];
      if (s.phase === 'chase') {
        const n = d.mem.n ?? 0;
        if (n < plan.length && t >= plan[n] && s.laneT > 0.55 && s.pt > 0.7) {
          const tt = s.t + 0.4, x = 520 + Math.sin(tt * 0.9) * 90 + Math.sin(tt * 2.3) * 30, ty = [1200, 1010, 830][s.lane], y = s.deerY + (ty - s.deerY) * (1 - Math.pow(0.02, 0.4));
          d.tap(x, y - 70); d.mem.n = n + 1; d.mem.last = { x, y: y - 70 }; d.step = 0;
        }
      } else if (s.phase === 'eagle' && s.glint >= 0 && t > 3.5 && d.t - d.lastPress > 1.2 && (d.mem.e ?? 0) < 2 && s.glintT > 0.35) {
        d.tap(s.chX + (s.glint === 0 ? -70 : 60), s.chY + Math.sin(s.t * 2) * 6 + 56); d.mem.e = (d.mem.e ?? 0) + 1; d.mem.wheel = true; d.step = 1;
      }
    },
    labels: (d) => (d.s.phase === 'chase' ? (d.mem.last && d.t - d.lastPress < 1.4 ? [{ k: 'ahead', x: d.mem.last.x - 140, y: d.mem.last.y - 120, tx: d.mem.last.x, ty: d.mem.last.y }] : []) : (d.s.glint >= 0 ? [{ k: 'wheel', x: 360, y: 900, tx: d.s.chX + (d.s.glint === 0 ? -70 : 60), ty: d.s.chY + 56 }] : [])),
  },
  6: { // the alliance
    dur: 6, pre: 3.3, capBottom: true,
    script(d) {
      const s = d.s;
      if ((d.mem.n ?? 0) >= 2) return;
      const b = s.bands.find((q) => !q.called && q.x - s.scroll > 250 && q.x - s.scroll < 470 && q.y > 300);
      if (b && d.t - (d.mem.at ?? -9) > 1.6) { d.tap(b.x - s.scroll, b.y - 70); d.mem.n = (d.mem.n ?? 0) + 1; d.mem.at = d.t; d.mem.tgt = b; }
    },
    labels: (d) => (d.mem.tgt && d.t - d.lastPress < 1.2 ? [{ k: 'band', x: 360, y: d.mem.tgt.y - 210, tx: d.mem.tgt.x - d.s.scroll, ty: d.mem.tgt.y - 70 }] : []),
  },
  7: { // the leap
    dur: 6, capBottom: true,
    setup(s) { const w = s.objs.find((o) => o.k === 'wind' && o.x > 2400) ?? s.objs.find((o) => o.k === 'wind'); s.x = w.x - 900; s.alt = 760; s.speed = 340; s.hx = 200; },
    script(d) {
      const s = d.s, t = d.t, w = s.objs.find((o) => o.k === 'wind' && o.x + o.len > s.x);
      const seaY = 1370, yFor = (alt) => 90 + seaY + s.cam - alt * s.zoom;
      const a0 = 760, a1 = a0 + 340, a2 = w ? w.alt : 900;
      const alt = t < 0.6 ? a0 : t < 2.0 ? lerp(a0, a1, smooth((t - 0.6) / 1.2)) : t < 3.6 ? lerp(a1, a2, smooth((t - 2.0) / 1.4)) : a2;
      if (t > 0.4 && !d.ptr.down) d.press(250, yFor(alt));
      if (d.ptr.down) d.follow(250, clamp(yFor(alt), 200, 1450));
      d.step = t < 0.6 ? 0 : 1;
      if (t > 4.8 && d.ptr.down) { d.release(); d.step = 2; }
    },
    labels: (d) => { const s = d.s, w = s.objs.find((o) => o.k === 'wind' && o.x + o.len > s.x); if (!w) return []; const x = s.hx + (Math.max(w.x, s.x) - s.x + 200) * s.zoom, y = 1370 + s.cam - w.alt * s.zoom; return [{ k: 'wind', x: clamp(x, 200, 560), y: y - 130, tx: clamp(x, 200, 560), ty: y }]; },
  },
  8: { // the fortress by night
    dur: 5.4, pre: 0,
    script(d) {
      const s = d.s;
      if (s.phase !== 'hide' || (d.mem.n ?? 0) >= 3 || d.t < 0.9) return;
      const cur = s.patches[s.at], rowY = (r) => 6400 - r * 320;
      const gx = (g, tt) => g.x + (g.walk ? Math.sin(tt * 0.5 + g.ph) * g.walk : 0), ga = (g, tt) => g.base + Math.sin(tt * g.w + g.ph) * g.amp;
      const inCone = (g, x, y, tt) => { const dx = x - gx(g, tt), dy = y - 70 - (g.y - 60), dd = Math.hypot(dx, dy); if (dd > 330) return false; let da = Math.atan2(dy, dx) - ga(g, tt); da = Math.atan2(Math.sin(da), Math.cos(da)); return Math.abs(da) < 0.3; };
      const safe = (q) => { for (let u = 0.08; u <= 0.92; u += 0.04) { const k = smooth(u), hx = lerp(cur.x, q.x, k), hy = lerp(rowY(cur.r), rowY(q.r), k) - Math.sin(k * Math.PI) * 50; if (s.guards.some((g) => inCone(g, hx, hy, s.t + 0.6 * u))) return false; } return true; };
      const options = s.patches.filter((q) => q.r === cur.r + 1);
      const q = options.find(safe) ?? (d.t > 3.2 ? options[0] : null);
      if (q) { d.tap(q.x, rowY(q.r) - 20 - s.cam); d.mem.n = (d.mem.n ?? 0) + 1; d.mem.q = q; d.step = 0; }
    },
    labels: (d) => (d.mem.q ? [{ k: 'shadow', x: 360, y: 640, tx: d.mem.q.x, ty: 6400 - d.mem.q.r * 320 - 20 - d.s.cam }] : []),
  },
  9: { // the fortress burns
    dur: 6, mem0: null,
    setup(s) { s.x = 350; },
    script(d) {
      const s = d.s, q = s.plats.find((p) => s.x >= p.x - 6 && s.x <= p.x + p.w + 6 && p.y === s.y);
      if (d.mem.phase === undefined) d.mem.phase = 0;
      if (d.mem.phase === 0 && q && s.ground && q.x + q.w - s.x < 95 && s.y === 1150) { d.press(360, 900); d.autoRel = d.t + 0.12; d.mem.phase = 1; d.step = 0; }
      if (d.mem.phase === 1 && s.ground && d.t > 2.4) { d.mem.phase = 2; }
      if (d.mem.phase === 2 && s.ground && s.y === 1150) {
        const up = s.plats.find((p) => p.y === 800 && p.x > s.x + 120 && p.x < s.x + 330);
        if (up) { d.press(360, 900); d.mem.phase = 3; d.step = 1; d.mem.holdUntil = d.t + 0.62; }
      }
      if (d.mem.phase === 3 && d.t > d.mem.holdUntil) { d.release(); d.mem.phase = 4; }
    },
    labels: () => [],
  },
  10: { // the bridge
    dur: 6, pre: 2.4,
    script(d) {
      const s = d.s, SHORE = 220, SW = 110;
      let f = 0; while (f < 14 && s.spans[f] > 0) f++;
      const gx = SHORE + f * SW + SW / 2;
      if ((d.mem.n ?? 0) >= 3) return;
      for (const c of s.carriers) {
        if (!c.has || Math.abs(c.x - gx) > 14 || d.t - (d.mem.at ?? -9) < 0.8) continue;
        const cy = c.y0 - Math.sin(clamp((c.x - c.born) / (W + 200), 0, 1) * Math.PI) * 130 - Math.abs(Math.sin((c.x - c.born) / 95 + c.ph)) * 46;
        d.tap(c.x - s.cam, cy - 70); d.mem.n = (d.mem.n ?? 0) + 1; d.mem.at = d.t; d.mem.gx = gx; d.mem.cx = c.x; d.mem.cy = cy; d.step = 0; break;
      }
    },
    labels: (d) => (d.mem.gx ? [{ k: 'gap', x: clamp(d.mem.gx - d.s.cam, 130, 590), y: 1000, tx: d.mem.gx - d.s.cam, ty: 1090 }] : []),
  },
  11: { // the war
    dur: 6.2,
    script(d) {
      const t = d.t, plan = [[0.6, 104, 1393, 0], [1.3, 360, 950, 1], [2.3, 274, 1393, 0], [3.0, 130, 950, 1], [4.0, 615, 1393, 2], [4.7, 590, 950, 2]];
      const n = d.mem.n ?? 0;
      if (n < plan.length && t >= plan[n][0]) { d.tap(plan[n][1], plan[n][2]); d.mem.n = n + 1; d.step = plan[n][3]; d.mem.last = plan[n]; }
    },
    labels: (d) => [{ k: 'cards', x: 200, y: 1190, tx: 190, ty: 1330 }, ...(d.step >= 1 && d.step < 2 ? [{ k: 'lane', x: 360, y: 830, tx: d.mem.last[1], ty: d.mem.last[2] }] : []), ...(d.step === 2 ? [{ k: 'hanuman', x: 540, y: 1190, tx: 615, ty: 1330 }] : [])],
  },
  12: { // the duel
    dur: 5.8, pre: 0, capBottom: true, compact: true,
    setup(s) { s.boltIn = 0.2; },
    script(d) {
      const s = d.s, t = d.t, ANCHOR = { x: 500, y: 900 }, mem = d.mem;
      const rxAt = (tt) => W / 2 + Math.sin(tt * 0.45) * 170, kyAt = (tt) => 640 + Math.sin(tt * 0.9) * 14;
      const aim = (sol, dur) => { const len = sol.pw * 300; d.press(ANCHOR.x, ANCHOR.y); d.moveTo(ANCHOR.x - Math.cos(sol.a) * len, ANCHOR.y - Math.sin(sol.a) * len, dur); d.step = 0; };
      if (mem.stage === undefined) mem.stage = 0;
      if (mem.stage === 0 && t > 0.5 && s.bolts[0]) { // shot 1: shoot the fire-bolt out of the sky
        const b = s.bolts[0], lead = 1.1 + 0.03;
        const sol = solveShot((tau) => { const u = b.t + (tau + lead) / 4.2; return [b.x0 + (b.tx - b.x0) * u, b.y0 + (b.ty - b.y0) * (u * u * 0.6 + u * 0.4)]; }, 26);
        mem.stage = 1; mem.t0 = t; mem.sol = sol; if (sol) aim(sol, 1.0);
      }
      if (mem.stage === 1 && t > mem.t0 + 0.75) d.step = 1;
      if (mem.stage === 1 && t > mem.t0 + 1.1) { d.release(); d.step = 2; mem.stage = 2; mem.t1 = t; }
      if (mem.stage === 2 && t > mem.t1 + 1.3) { // shot 2: the marked head
        const i = s.target, tNow = s.t + 1.1 + 0.03;
        const sol = solveShot((tau) => { const [hx, hy] = tenHeadPos(i, rxAt(tNow + tau), kyAt(tNow + tau), 1.15); return [hx, hy - 8]; }, 20);
        mem.stage = 3; mem.t2 = t; mem.sol2 = sol; if (sol) aim(sol, 1.0);
      }
      if (mem.stage === 3 && t > mem.t2 + 0.75) d.step = 1;
      if (mem.stage === 3 && t > mem.t2 + 1.1 && d.ptr.down) { d.release(); d.step = 2; }
    },
    labels: (d) => {
      const s = d.s, out = [{ k: 'bow', x: 130, y: 1000, tx: 250, ty: 1085 }];
      if ((d.mem.stage === 1 || d.mem.stage === 2) && s.bolts[0]) out.push({ k: 'bolt', x: clamp(s.bolts[0].x + 150, 150, 570), y: s.bolts[0].y + 80, tx: s.bolts[0].x, ty: s.bolts[0].y });
      if (d.mem.stage === 3) { const [hx, hy] = tenHeadPos(s.target, s.rx, 640 + Math.sin(s.t * 0.9) * 14, 1.15); out.push({ k: 'head', x: clamp(hx, 150, 570), y: hy + 150, tx: hx, ty: hy }); }
      return out;
    },
  },
  13: { // the flight home, then (after a cut) the lamps of the city
    dur: 7.4, capBottom: true,
    setup(s) { s.phase = 'flight'; s.phaseT = 1.2; s.noHint = false; },
    cuts: [{ t: 3.8, fn(s) { s.phase = 'lamps'; s.phaseT = 12; s.noHint = true; s.cam = 1500; for (const q of s.lamps) q.lit = false; s.lit = 0; } }],
    script(d) {
      const s = d.s;
      if (s.phase === 'flight') {
        const wx = s.phaseT * 260 + 260, q = s.lights.find((l) => !l.got && l.x > wx - 100), yT = q ? q.y + 60 : 700;
        if (d.t > 0.3 && !d.ptr.down) d.press(360, s.carY + 60);
        if (d.ptr.down) { const y = d.ptr.y; d.follow(360, y + (yT - y) * 0.06); }
        d.step = 0;
      } else {
        if (d.ptr.down && d.mem.lampsFrom === undefined) { d.release(); }
        const vis = s.lamps.filter((l) => !l.lit && l.y - s.cam > 380 && l.y - s.cam < 1150);
        if (!d.ptr.down && d.t > 4.4 && vis.length) { const q = vis.sort((p, r) => r.y - p.y)[0]; d.press(q.x, q.y - s.cam); d.mem.lampsFrom = 1; d.step = 1; }
        if (d.ptr.down && vis.length) {
          const q = vis.sort((p, r) => Math.hypot(p.x - d.ptr.x, p.y - s.cam - d.ptr.y) - Math.hypot(r.x - d.ptr.x, r.y - s.cam - d.ptr.y))[0], dx = q.x - d.ptr.x, dy = q.y - s.cam - d.ptr.y, dd = Math.hypot(dx, dy), step = Math.min(dd, 620 / 60);
          d.follow(d.ptr.x + (dx / (dd || 1)) * step, d.ptr.y + (dy / (dd || 1)) * step);
        }
      }
    },
    labels: (d) => { const s = d.s; if (s.phase === 'flight') { const sc = s.phaseT * 260, q = s.lights.find((l) => !l.got && l.x - sc > 150 && l.x - sc < 700); return q ? [{ k: 'light', x: clamp(q.x - sc, 150, 560), y: q.y - 120, tx: q.x - sc, ty: q.y }] : []; } const q = s.lamps.find((l) => !l.lit && l.y - s.cam > 380 && l.y - s.cam < 1150); return q ? [{ k: 'lamp', x: clamp(q.x, 150, 570), y: q.y - s.cam - 120, tx: q.x, ty: q.y - s.cam }] : []; },
  },
};

// ---- coaching in real play --------------------------------------------------------------------
// need: what counts as "performed the action once". hand(s) -> where the drawn hand shows it.
export const COACH = {
  1: { need: { hold: 0.6, rel: 1 }, hand: () => ({ x: 330, y: 820, mode: 'hold' }) },
  2: { need: { hold: 0.8 }, hand: () => ({ x: 200, y: 700, mode: 'hold' }) },
  3: { need: { taps: 1 }, y: 1300, hand: (s) => { const r = s.raiders.find((q) => q.kind !== 'flyer') ?? s.raiders[0]; return r ? { x: r.x, y: r.kind === 'flyer' ? r.y : r.y - 110, mode: 'tap' } : null; } },
  4: { need: { taps: 1 }, y: 380, hand: (s) => (s.phase === 'ask' ? { x: 360, y: 1388, mode: 'tap' } : null) },
  5: { need: { taps: 1 }, hand: (s) => (s.phase === 'chase' ? { x: s.deerX, y: s.deerY - 70, mode: 'tap' } : s.phase === 'eagle' && s.glint >= 0 ? { x: s.chX + (s.glint === 0 ? -70 : 60), y: s.chY + 56, mode: 'tap' } : null) },
  6: { need: { taps: 1 }, hand: (s) => { const b = s.bands.find((q) => !q.called && q.x - s.scroll > 240 && q.x - s.scroll < 600); return s.phase === 'pan' && b ? { x: b.x - s.scroll, y: b.y - 70, mode: 'tap' } : null; } },
  7: { need: { drag: 60 }, dir: 'up', hand: () => ({ x: 250, y: 900, to: { x: 250, y: 600 }, mode: 'drag' }) },
  8: { need: { taps: 1 }, hand: (s) => { const cur = s.patches[s.at], q = s.patches.find((p) => p.r === cur.r + 1); return s.phase === 'hide' && q ? { x: q.x, y: 6400 - q.r * 320 - 20 - s.cam, mode: 'tap' } : null; } },
  9: { need: { taps: 1 }, hand: () => ({ x: 360, y: 950, mode: 'tap' }) },
  10: { need: { taps: 1 }, hand: () => ({ x: 330, y: 700, mode: 'tap' }) },
  11: { need: { taps: 2 }, dir: 'right', y: 1160, hand: (s, c) => (c.taps === 0 ? { x: 104, y: 1393, mode: 'tap' } : { x: 360, y: 950, mode: 'tap' }) },
  12: { need: { drag: 60, rel: 1 }, dir: 'dl', hand: () => ({ x: 470, y: 1120, to: { x: 380, y: 1290 }, mode: 'drag' }) },
  13: { need: { drag: 60 }, dir: 'up', y: 1290, hand: () => ({ x: 360, y: 900, to: { x: 360, y: 650 }, mode: 'drag' }) },
};
