// The stage: one shot played out in time (the squidger presses, the wink hops, lands, drops in the cup, lands on a rival
// wink, or a bomb scatters a pile) plus the board drawing and its effects. A theater is { mat, act, parts, pops, ... }; the
// match screen and the attract mat behind the menus both use it. The shot's outcome is already decided (`res` from
// sim.takeShot) when the act begins; this file only animates it, so animation can never change the game.
import { WR, POT, SQUIDGERS, hopDistance } from './sim.js';
import { drawMat, drawWink, drawSquidger } from './art.js';

const TAU = Math.PI * 2;
const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const MAX_PARTS = 150;

export function newTheater(mat) {
  return { mat, act: null, parts: [], pops: [], cupGlow: 0, shake: 0 };
}

// snap = copies of the winks as they were before the shot; res = the shot's result record.
export function beginAct(th, side, shot, res, snap) {
  const D = hopDistance(shot.sq, shot.power);
  const pressT = 0.2, hopT = 0.26 + 0.42 * Math.min(1, D / 480);
  const tail = { pot: 0.85, squop: 0.6, rest: 0.45, off: 1.1, bomb: 1.5 }[res.kind] ?? 0.5;
  th.act = {
    side, shot, res, snap, t: 0, pressT, hopT, landAt: pressT + hopT, tail, D,
    potBefore: [th.mat.potted[0] - res.pots[0], th.mat.potted[1] - res.pots[1]],
    fired: { press: false, land: false }, scat: res.scatter.map((s, i) => ({ ...s, delay: 0.06 * i, dur: 0.5, done: false })),
  };
  th.act.tailDur = res.kind === 'bomb' ? 0.6 + 0.06 * res.scatter.length + 0.5 : tail;
}

export function addPart(th, q) { if (th.parts.length < MAX_PARTS) th.parts.push(q); }
export function ringFx(th, x, y, size, col = '#fff7da', max = 0.5) { addPart(th, { kind: 1, x, y, vx: 0, vy: 0, t: 0, max, size, col }); }
export function sparkFx(th, rng, x, y, n, col = '#ffd35a', speed = 140) {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU, s = speed * (0.4 + rng.next() * 0.9);
    addPart(th, { kind: 3, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + rng.next() * 0.4, size: 5 + rng.next() * 6, col });
  }
}
export function dustFx(th, rng, x, y, n, col = 'rgba(210,255,240,0.7)') {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU, s = 25 + rng.next() * 60;
    addPart(th, { kind: 0, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.4 + rng.next() * 0.3, size: 2.5 + rng.next() * 3, col });
  }
}
export function popText(th, x, y, text, col, size = 30) {
  th.pops.push({ x, y, text, col, size, t: 0, max: 1.3 });
  if (th.pops.length > 8) th.pops.shift();
}

// Advance everything by dt. hooks: { press(act), land(res, act), scatterLand(s, act), potDrop(res, act) }. Returns the finished
// res when the act ends this tick, else null.
export function stepTheater(th, dt, hooks = {}) {
  for (const q of th.parts) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.93; q.vy *= 0.93; }
  for (let i = th.parts.length - 1; i >= 0; i--) if (th.parts[i].t >= th.parts[i].max) th.parts.splice(i, 1);
  for (const p of th.pops) p.t += dt;
  th.pops = th.pops.filter((p) => p.t < p.max);
  th.cupGlow = Math.max(0, th.cupGlow - dt * 1.6);
  th.shake = Math.max(0, th.shake - dt * 3);
  const a = th.act;
  if (!a) return null;
  a.t += dt;
  if (!a.fired.press && a.t >= a.pressT * 0.8) { a.fired.press = true; hooks.press?.(a); }
  if (!a.fired.land && a.t >= a.landAt) { a.fired.land = true; hooks.land?.(a.res, a); }
  if (a.fired.land) {
    for (const s of a.scat) if (!s.done && a.t >= a.landAt + s.delay + s.dur) { s.done = true; hooks.scatterLand?.(s, a); }
  }
  if (a.t >= a.landAt + a.tailDur) {
    th.act = null;
    return a.res;
  }
  return null;
}

// positions of the shooter along its hop: k in 0..1
function hopPos(a, k) {
  const f = a.res.from, t = a.res.aim;
  return { x: f.x + (t.x - f.x) * k, y: f.y + (t.y - f.y) * k };
}

// Draw the world (call with the world transform applied): mat, winks, the act, effects. o: { sel, selT, under (fn drawn under winks) }
export function drawBoard(ctx, th, o = {}) {
  drawMat(ctx, { cupGlow: th.cupGlow });
  const a = th.act, mat = th.mat;
  let list = mat.winks;
  const skip = new Set();
  if (a) {
    skip.add(a.res.id);
    if (a.t < a.landAt) list = a.snap;
    else for (const s of a.scat) if (a.t < a.landAt + s.delay + s.dur) skip.add(s.id);
  }
  if (o.under) o.under(ctx);
  const rows = list.filter((w) => !w.pot && !skip.has(w.id)).sort((p, q) => p.z - q.z || p.id - q.id);
  for (const w of rows) drawWink(ctx, w.x, w.y, { side: w.side, tone: w.tone, z: w.z, sel: o.sel === w.id ? o.selT ?? 1 : 0 });
  if (a) drawAct(ctx, a, th);
  drawParts(ctx, th.parts);
  if (o.over) o.over(ctx);
}

function drawAct(ctx, a, th) {
  const r = a.res, sq = SQUIDGERS[a.shot.sq], ang = a.shot.angle;
  const w0 = a.snap.find((w) => w.id === r.id);
  const tone = w0 ? w0.tone : 0;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  // 1. the squidger presses on the edge of the wink and lifts away
  if (a.t < a.pressT + 0.16) {
    const back = (1 - ease(a.t / a.pressT)) * 30, off = WR + sq.r * 0.72 - 6 + back;
    const al = a.t < a.pressT ? 1 : 1 - (a.t - a.pressT) / 0.16;
    drawSquidger(ctx, r.from.x - dx * off, r.from.y - dy * off, a.shot.sq, { a: al, press: a.t > a.pressT * 0.6 ? 1 : 0 });
  }
  // 2. the wink: waiting under the squidger, then hopping
  if (a.t < a.pressT) {
    const k = Math.max(0, (a.t - a.pressT * 0.6) / (a.pressT * 0.4));
    drawWink(ctx, r.from.x, r.from.y, { side: r.side, tone, z: w0 ? w0.z : 0, sq: Math.min(1, k) });
  } else if (a.t < a.landAt) {
    const k = (a.t - a.pressT) / a.hopT, p = hopPos(a, k);
    const peak = 0.55 + 0.75 * Math.min(1, a.D / 450);
    drawWink(ctx, p.x, p.y, { side: r.side, tone, lift: Math.sin(Math.PI * k) * peak, spin: k * 7, z: 0 });
  } else {
    const u = a.t - a.landAt;
    const fin = r.final;
    if (r.kind === 'pot') {
      const k = Math.min(1, u / 0.3), f = Math.max(0, Math.min(1, (u - 0.1) / 0.45));
      const x = r.aim.x + (POT.x - r.aim.x) * ease(k), y = r.aim.y + (POT.y - r.aim.y) * ease(k);
      if (f < 1) drawWink(ctx, x, y, { side: r.side, tone, r: WR * (1 - 0.55 * f), a: 1 - f * f, lift: -0.15 * f });
    } else if (r.kind === 'off') {
      if (u < 0.4) drawWink(ctx, r.aim.x, r.aim.y, { side: r.side, tone, lift: 0.1, a: 0.9 });
      else {
        const k = Math.min(1, (u - 0.4) / 0.4);
        drawWink(ctx, r.aim.x + (fin.x - r.aim.x) * ease(k), r.aim.y + (fin.y - r.aim.y) * ease(k), { side: r.side, tone, lift: Math.sin(Math.PI * k) * 0.5 });
      }
    } else {
      const k = Math.min(1, u / 0.25), bounce = u < 0.3 ? Math.sin(Math.PI * Math.min(1, u / 0.3)) * 0.35 : 0;
      const x = r.aim.x + (fin.x - r.aim.x) * ease(k), y = r.aim.y + (fin.y - r.aim.y) * ease(k);
      const z = th.mat.winks.find((w) => w.id === r.id);
      drawWink(ctx, x, y, { side: r.side, tone, z: z && !z.pot ? z.z : 0, lift: bounce });
    }
    // scattered winks of a bombed pile
    for (const s of a.scat) {
      const k = (u - s.delay) / s.dur;
      if (k < 0 || k > 1) continue;
      const wk = th.mat.winks.find((w) => w.id === s.id);
      const tone2 = wk ? wk.tone : 0;
      const x = s.from.x + (s.to.x - s.from.x) * k, y = s.from.y + (s.to.y - s.from.y) * k;
      drawWink(ctx, x, y, { side: s.side, tone: tone2, lift: Math.sin(Math.PI * k) * 0.8, spin: k * 9 });
    }
  }
}

export function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) {
      const e = 1 - k;
      ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 2 + 6 * k;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.15 + 0.85 * (1 - Math.pow(1 - e, 2))), 0, TAU); ctx.stroke();
    } else if (q.kind === 3) {
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      const s = q.size * (0.4 + 0.6 * k);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.35 : s, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// ---- the scene as data, for the 3D presenter --------------------------------------------------------------------------
// Same timeline as drawBoard/drawAct above, but returned as plain records so a renderer can place real meshes:
// items: { id, x, y, side, tone, z, kind: rest|press|hop|land|pot|off|scat, k (0..1 phase), lift (0..~1.3), u (s since landing),
// hx/hy (unit heading), D (hop distance), sink (0..1 into the cup), sel }; sq: the squidger of the act, or null.
export function sceneOf(th, o = {}) {
  const a = th.act, mat = th.mat, items = [], out = { items, sq: null, cupGlow: th.cupGlow, shake: th.shake };
  let list = mat.winks;
  const skip = new Set();
  if (a) {
    skip.add(a.res.id);
    if (a.t < a.landAt) list = a.snap;
    else for (const s of a.scat) if (a.t < a.landAt + s.delay + s.dur) skip.add(s.id);
  }
  for (const w of list) {
    if (w.pot || skip.has(w.id)) continue;
    items.push({ id: w.id, x: w.x, y: w.y, side: w.side, tone: w.tone, z: w.z, kind: 'rest', k: 0, lift: 0, u: 0, sel: o.sel === w.id });
  }
  if (!a) return out;
  const r = a.res, sq = SQUIDGERS[a.shot.sq], ang = a.shot.angle, dx = Math.cos(ang), dy = Math.sin(ang);
  const w0 = a.snap.find((w) => w.id === r.id), tone = w0 ? w0.tone : 0;
  const base = { id: r.id, side: r.side, tone, hx: dx, hy: dy, D: a.D };
  if (a.t < a.pressT + 0.16) {
    const back = (1 - ease(a.t / a.pressT)) * 30, off = WR + sq.r * 0.72 - 6 + back;
    out.sq = {
      id: a.shot.sq, x: r.from.x - dx * off, y: r.from.y - dy * off, dx, dy, back,
      press: a.t > a.pressT * 0.6 ? 1 : ease(a.t / (a.pressT * 0.6)) * 0.4, away: a.t < a.pressT ? 0 : (a.t - a.pressT) / 0.16,
    };
  }
  if (a.t < a.pressT) {
    const k = Math.max(0, (a.t - a.pressT * 0.6) / (a.pressT * 0.4));
    items.push({ ...base, x: r.from.x, y: r.from.y, z: w0 ? w0.z : 0, kind: 'press', k: Math.min(1, k), lift: 0, u: 0 });
  } else if (a.t < a.landAt) {
    const k = (a.t - a.pressT) / a.hopT, p = hopPos(a, k), peak = 0.55 + 0.75 * Math.min(1, a.D / 450);
    items.push({ ...base, x: p.x, y: p.y, z: 0, kind: 'hop', k, lift: Math.sin(Math.PI * k) * peak, u: 0 });
  } else {
    const u = a.t - a.landAt, fin = r.final, wnow = th.mat.winks.find((w) => w.id === r.id);
    if (r.kind === 'pot') {
      const k = Math.min(1, u / 0.3), f = Math.max(0, Math.min(1, (u - 0.1) / 0.55));
      items.push({ ...base, x: r.aim.x + (POT.x - r.aim.x) * ease(k), y: r.aim.y + (POT.y - r.aim.y) * ease(k), z: 0, kind: 'pot', k, lift: 0, sink: f, u });
    } else if (r.kind === 'off') {
      if (u < 0.4) items.push({ ...base, x: r.aim.x, y: r.aim.y, z: 0, kind: 'off', k: 0, lift: 0.1, u });
      else {
        const k = Math.min(1, (u - 0.4) / 0.4);
        items.push({ ...base, x: r.aim.x + (fin.x - r.aim.x) * ease(k), y: r.aim.y + (fin.y - r.aim.y) * ease(k), z: 0, kind: 'off', k, lift: Math.sin(Math.PI * k) * 0.5, u });
      }
    } else {
      const k = Math.min(1, u / 0.25), bounce = u < 0.3 ? Math.sin(Math.PI * Math.min(1, u / 0.3)) * 0.35 : 0;
      items.push({ ...base, x: r.aim.x + (fin.x - r.aim.x) * ease(k), y: r.aim.y + (fin.y - r.aim.y) * ease(k), z: wnow && !wnow.pot ? wnow.z : 0, kind: 'land', k, lift: bounce, u });
    }
    for (const s of a.scat) {
      const k = (u - s.delay) / s.dur;
      if (k < 0 || k > 1) continue;
      const wk = th.mat.winks.find((w) => w.id === s.id);
      items.push({
        id: s.id, side: s.side, tone: wk ? wk.tone : 0, x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k, z: 0,
        kind: 'scat', k, lift: Math.sin(Math.PI * k) * 0.8, u, hx: s.to.x - s.from.x, hy: s.to.y - s.from.y, D: 0,
      });
    }
  }
  return out;
}
