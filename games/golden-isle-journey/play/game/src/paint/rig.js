// Skeletal 2D rig: a figure is posed from cached part sprites (see kit.js `sprite`).
import { TAU, sprite, blit, tinted, ramp, lin, darken, lighten } from './kit.js';
import { relief, furCoat, insideOf, fillShapes } from './sculpt.js';
import { SPECS, furVariant } from './specs.js';
import { torso, armUpper, armLower, hand, thigh, shin, foot, wrap, veil, quiver } from './parts.js';
import { humanHead, humanHairBack } from './heads.js';
import { vanaraHead } from './vanarahead.js';
import { drawProp } from './props.js';
import { light } from '../stage.js';

const specCache = new Map();
export function specFor(kind, v = 0, accent = '', hi = false) {
  const k = `${kind}|${v}|${accent}|${hi ? String(hi) : ''}`; let s = specCache.get(k); if (s) return s;
  const base = SPECS[kind] ?? SPECS.citizen;
  s = { ...base, id: k, rm: hi === 'p' ? 1.6 : hi ? 2.4 : 1 };
  if (kind === 'vanara') { s.fur = furVariant(v); s.crown = v % 2 === 0; s.mane = v % 3 === 1 ? '#c8c0b0' : '#2a1810'; s.dhoti = ['#8a5a3a', '#3a6a8a', '#7a3a5a', '#4a7a4a', '#a06a2a', '#5a4a8a'][v % 6]; }
  if (kind === 'ravan' && v > 0) { const q = v % 5; s.longBeard = [0.25, 0, 0.5, 0.1, 0][q]; s.beard = q === 1 ? null : '#140a0a'; s.stacheUp = [1, 1.6, 0.4, 1, 0][q]; s.brow = 1 + (v % 3) * 0.4; s.tiers = 1; s.plates = 5; s.hairLong = false; s.gems = [['#d8283a', '#1fa872'], ['#3a6fd0', '#d8283a'], ['#1fa872', '#e8b030']][v % 3]; }
  if (accent) { s.dhoti = accent; s.sash = accent; }
  s.sprites = null; specCache.set(k, s); return s;
}

// Every part below is built lazily (only the first time it is actually blitted), not eagerly here.
// A caller that only ever draws a subset of a rig - a fan-head bust (head+hair only, see ravan.js
// headAt) or a portrait bust (torso/head/hair/armU only, see portraits.js) - never pays to build the
// rest (thigh/shin/foot/wrap/etc). A full `figure()` still touches nearly every part, so this costs
// it nothing; it only removes work nobody was going to look at.
export function build(s) {
  const k = s.id, R = 3 * s.rm, p = {}, sw = s.sw, T = s.T;
  const lazy = (name, make) => { let v; Object.defineProperty(p, name, { get: () => v ?? (v = make()), enumerable: true }); };
  lazy('torso', () => sprite(`${k}:torso`, 2 * sw + 20, T + 34, sw + 10, T + 22, R, (c) => torso(c, s)));
  const heads = {};
  p.head = (e) => heads[e] ?? (heads[e] = sprite(`${k}:head:${e}`, 56, 124, 26, 98, 4 * s.rm, (c) => (s.fur ? vanaraHead(c, s, e) : humanHead(c, s, e))));
  if (!s.fur && s.hairBack !== false) lazy('hair', () => sprite(`${k}:hair`, 46, 116, 30, 50, R, (c) => humanHairBack(c, s)));
  lazy('armU', () => sprite(`${k}:armU`, 30, s.arm[0] + 20, 15, 9, R, (c) => armUpper(c, s)));
  lazy('armL', () => sprite(`${k}:armL`, 30, s.arm[1] + 30, 15, 9, R, (c) => armLower(c, s)));
  const hands = {}, handK = (s.armW ?? 14) / 14;
  p.hand = (hp) => hands[hp] ?? (hands[hp] = sprite(`${k}:hand:${hp}`, 36, 30, 18, 6, R, (c) => hand(c, s, hp, handK)));
  lazy('thigh', () => sprite(`${k}:thigh`, 34, s.leg + 18, 17, 9, R, (c) => thigh(c, s)));
  lazy('shin', () => sprite(`${k}:shin`, 34, s.leg + 18, 17, 9, R, (c) => shin(c, s)));
  lazy('foot', () => sprite(`${k}:foot`, 42, 28, 14, 13, R, (c) => foot(c, s)));
  const wl = s.len, wf = s.flare, ww = 2 * (s.hw + wf + 16);
  lazy('wrap', () => sprite(`${k}:wrap`, ww, wl + 24, ww / 2, 12, R, (c) => wrap(c, s, wl, wf)));
  if (s.long) lazy('wrapSit', () => sprite(`${k}:wrapSit`, ww, s.leg * 1.1 + 24, ww / 2, 12, R, (c) => wrap(c, s, s.leg * 1.05, wf * 0.5, { noPleat: true })));
  if (s.veil) lazy('veil', () => sprite(`${k}:veil`, 44, 150, 34, 50, 2.5, (c) => veil(c, s, 84)));
  if (s.quiver) lazy('quiver', () => sprite(`${k}:quiver`, 30, 112, 15, 46, 3, (c) => quiver(c, s)));
  return p;
}

const seatSp = () => sprite('seat', 90, 34, 45, 20, 3, (c) => {
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.beginPath(); c.ellipse(0, 12, 42, 6, 0, 0, TAU); c.fill();
  c.fillStyle = lin(c, 0, -8, 0, 12, [[0, '#c8404a'], [1, '#6a1024']]); c.beginPath(); c.ellipse(0, 4, 38, 10, 0, 0, TAU); c.fill();
  c.strokeStyle = '#f0c050'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#f6d070'; for (let i = -3; i <= 3; i++) { c.beginPath(); c.arc(i * 10, 4 + Math.abs(i) * 0.6, 1.5, 0, TAU); c.fill(); }
});
const limbEndY = (a1, l1, a2, l2) => Math.cos(a1) * l1 + Math.cos(a1 + a2) * l2;

const tailSeg = (s, k) => sprite(`tail:${s.fur}:${k}:${s.rm}`, 26, k === 3 ? 34 : 24, 13, 5, 3 * s.rm, (c) => {
  const w = [5.6, 4.4, 3.3, 3][k], cols = [darken(s.fur, 0.16), darken(s.fur, 0.04), lighten(s.fur, 0.1), lighten(s.fur, 0.24)];
  const shapes = k === 3 ? [{ cap: [0, -2, 3, 0, 8, 5.4] }, { cap: [0, 8, 5.4, 0, 22, 1.2] }] : [{ cap: [0, -2, w, 0, 15, w * 0.9] }];
  relief(c, { mat: 'fur', inflate: w * 0.8, depth: w * 0.8, bump: 0.6, paint(g) { fillShapes(g, shapes, darken(s.fur, 0.06)); furCoat(g, { box: [-8, -4, 8, k === 3 ? 26 : 17], inside: insideOf(shapes), n: k === 3 ? 900 : 420, len: k === 3 ? 5 : 2.6, wid: 0.32, seed: 50 + k, jitter: 0.25, cols, flow: () => Math.PI / 2 }); } });
});
function tailPaint(ctx, x, y, P, s, far) {
  let a = P.tailA ?? -0.9;
  const curl = P.tailCurl ?? -0.2, wave = P.tailWave ?? 0.1, t = P.t ?? 0, n = 10, L = P.tailLen ?? 13;
  const pr = ramp(s.fur), pts = [[x, y]];
  for (let i = 0; i < n; i++) { a += curl + Math.sin(t * 5 - i * 0.8) * wave; x += Math.sin(a) * L; y += Math.cos(a) * L; pts.push([x, y]); }
  // furry cached segments, thick to thin, then a tufted tip
  for (let i = 0; i < n; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], sp = tailSeg(s, i < 4 ? 0 : i < 7 ? 1 : 2); ctx.save(); ctx.translate(x0, y0); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2); ctx.scale(1, L / 13); blit(ctx, far ? tinted(sp, '#0a0408', 0) : sp); ctx.restore(); }
  { const [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; ctx.save(); ctx.translate(x1, y1); ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2); blit(ctx, tailSeg(s, 3)); ctx.restore(); }
  if (P.fire) {
    const [fx, fy] = pts[n]; light(ctx, fx, fy, 110, '255,150,50', 0.85);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const fl = 16 + 12 * Math.sin(t * 17 + i * 2), x0 = fx + (i - 2.5) * 4.2;
      ctx.fillStyle = i % 2 ? 'rgba(255,200,90,0.75)' : 'rgba(255,90,30,0.7)';
      ctx.beginPath(); ctx.moveTo(x0 - 6, fy + 5); ctx.quadraticCurveTo(x0 - 4, fy - fl * 0.7, x0, fy - fl * 1.7); ctx.quadraticCurveTo(x0 + 5, fy - fl * 0.6, x0 + 6, fy + 5); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,250,210,0.9)'; ctx.beginPath(); ctx.ellipse(fx, fy, 5, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// Draw one figure. o = { x, y (feet), s, dir, kind, pose, prop, v (variant), ink, gold }
// A head alone, large (review sheets, close-ups): (x, y) = neck base.
export function headShot(ctx, kind, x, y, sc, expr = 'calm', v = 0) { const { S } = partsFor(kind, v, true); ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); if (S.hair) blit(ctx, S.hair); blit(ctx, S.head(expr)); ctx.restore(); }
export const partsFor = (kind, v = 0, hi = true) => { const K = specFor(kind, v, '', hi); return { K, S: K.sprites ?? (K.sprites = build(K)) }; };

// PERF: a full `figure()` call touches every part a look has (see the leg/arm/torso/head/hair/veil/
// quiver/wrap blits below) - this returns one task per such part so a caller (game.js's title-boot
// warmup) can force them to build one relief-pass at a time, spread across frames, instead of paying
// for a whole character on a single frame. `'x' in S` checks a part's presence without building it
// (S's optional parts are getters - see build() above).
export function warmFigureParts(kind, v, expr = 'calm', accent = '') {
  const K = specFor(kind, v, accent, false), S = K.sprites ?? (K.sprites = build(K));
  const tasks = [
    () => void S.torso, () => void S.armU, () => void S.armL,
    () => void S.hand('relaxed'), () => void S.hand('grip'),
    () => void S.thigh, () => void S.shin, () => void S.foot,
    () => void S.wrap, () => void S.head(expr),
  ];
  if ('hair' in S) tasks.push(() => void S.hair);
  if ('veil' in S) tasks.push(() => void S.veil);
  if ('quiver' in S) tasks.push(() => void S.quiver);
  if ('wrapSit' in S) tasks.push(() => void S.wrapSit);
  return tasks;
}
export function figure(ctx, o) {
  const kind = o.kind ?? 'citizen';
  const accent = o.gold && !String(o.gold).startsWith('rgba') && o.gold !== '#f2c46a' ? o.gold : '';
  const K = specFor(kind, o.v ?? 0, accent, o.hi);
  const S = K.sprites ?? (K.sprites = build(K));
  const P = o.pose ?? {}, sc = o.s ?? 1, dir = o.dir ?? 1, far = sc < 0.55;
  const tintCol = o.ink && o.ink !== '#150a12' ? o.ink : null, tintA = tintCol && String(o.ink).toLowerCase() === '#0a0408' ? 0.88 : 0.5;
  const B = tintCol ? (sp) => tinted(sp, tintCol, tintA) : (sp) => sp;
  const L = K.leg, [A1, A2] = K.arm, T = K.T, sw = K.sw;
  const lw = K.long && !P.gait && (P.hipF ?? 0) < 1 ? 0.4 : 1;   // a long wrap shortens the stride (gait poses already step short)
  const hF = (P.hipF ?? 0.08) * lw, kF = (P.kneeF ?? 0) * lw, hB = (P.hipB ?? -0.08) * lw, kB = (P.kneeB ?? 0) * lw, lean = P.lean ?? 0;
  // a tipped foot (heel strike / toe off) reaches lower than a flat one: keep whichever point is lowest on the ground
  const fk = (K.legW ?? 20) / 20 * (K.fur ? 0.78 : 0.92), fF = P.footF ?? 0, fB = P.footB ?? 0, footDrop = (a) => Math.max(5 * fk * Math.sin(a), -13 * fk * Math.sin(a)) + 6 * fk * (Math.cos(a) - 1);
  const reach = Math.max(limbEndY(hF, L, kF, L) + footDrop(fF), limbEndY(hB, L, kB, L) + footDrop(fB));
  const hipY = P.air ? -2 * L : -reach, hop = P.hipH ? Math.max(0, P.hipH - reach) : 0;   // hop > 0 = the flight phase of a run

  ctx.save();
  ctx.translate(o.x, o.y - ((P.bob ?? 0) + hop) * sc - (P.lift ?? 0));
  ctx.scale(sc * dir, sc);
  if (!P.air && !P.rot && !o.noShadow && !far) { ctx.fillStyle = 'rgba(8,2,8,0.28)'; ctx.beginPath(); ctx.ellipse(2, 3 + (P.bob ?? 0) + hop, 30 - Math.min(10, hop * 0.5), 5.5, 0, 0, TAU); ctx.fill(); }
  if (P.rot) { ctx.translate(0, hipY); ctx.rotate(P.rot); ctx.translate(0, -hipY); }

  const cl = Math.cos(lean), sl = Math.sin(lean);
  const tw = (x, y) => [x * cl - y * sl, hipY + x * sl + y * cl];
  const [shX, shY] = tw(0, -T);
  const sockF = tw(sw * 0.72, -T + 9), sockB = tw(-sw * 0.72, -T + 9), neck = tw(2, -T - 1);

  const put = (sp, x, y, a = 0) => { ctx.save(); ctx.translate(x, y); if (a) ctx.rotate(-a); blit(ctx, B(sp)); ctx.restore(); };
  const leg = (hx, ha, ka, fa = 0) => {
    put(S.thigh, hx, hipY, ha);
    const jx = hx + Math.sin(ha) * L, jy = hipY + Math.cos(ha) * L;
    put(S.shin, jx, jy, ha + ka);
    put(S.foot, jx + Math.sin(ha + ka) * L, jy + Math.cos(ha + ka) * L, fa);
  };
  // The hand is its own part with its own wrist joint: `wrist` is an extra cant on top of the forearm's own
  // angle (a1 + a2), so a gripped bow or a mid-swing hand never looks rigidly glued to the forearm bone.
  // `hp` picks which hand shape to blit (see paint/parts.js `hand()`); CANT gives every hp a small natural
  // rest cant even when no pose authors one explicitly.
  const CANT = { relaxed: 0.05, grip: 0.16, open: -0.08, point: 0.1 };
  const arm = (sock, a1, a2, hp = 'relaxed', wrist) => {
    put(S.armU, sock[0], sock[1], a1);
    const jx = sock[0] + Math.sin(a1) * A1, jy = sock[1] + Math.cos(a1) * A1;
    const wa = a1 + a2;
    put(S.armL, jx, jy, wa);
    const wx = jx + Math.sin(wa) * A2, wy = jy + Math.cos(wa) * A2;
    put(S.hand(hp), wx, wy, wa + (wrist ?? CANT[hp] ?? 0));
    return [wx + Math.sin(wa) * 9, wy + Math.cos(wa) * 9];
  };

  if (hF > 1.2 && !P.air && !P.gait && !o.noSeat) { ctx.save(); ctx.translate(-4, hipY + 12); blit(ctx, seatSp()); ctx.restore(); }
  if (o.cape) { // a shoulder cloth streaming down the back: flat two-tone ribbon with a gold edge, waved by the pose clock
    const c0 = tw(-sw * 0.55, -T + 3), Lc = T + 56, w = (P.t ?? 0) * (P.air ? 9 : 2.2), amp = P.air ? 13 : 4, pt = (u, off) => [c0[0] + off * (1 - u * 0.25) - u * (P.air ? 10 : 26) - Math.sin(w - u * 5) * amp * u, c0[1] + u * Lc + Math.cos(w * 0.8 - u * 4) * amp * 0.4 * u];
    for (const [off0, off1, col] of [[-4, 24, o.cape], [8, 17, 'rgba(255,240,200,0.22)']]) { ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const q = pt(i / 10, off0); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } for (let i = 10; i >= 0; i--) { const q = pt(i / 10, off1); ctx.lineTo(q[0], q[1]); } ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#e8b848'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i <= 10; i++) { const q = pt(i / 10, -4); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } const e0 = pt(1, 24); ctx.lineTo(e0[0], e0[1]); ctx.stroke();
  }
  if (K.tail) tailPaint(ctx, -6, hipY + 2, P, K, far || !!tintCol);
  if (S.veil) { ctx.save(); ctx.translate(neck[0], neck[1]); ctx.rotate(lean * 0.6 + (P.sway ?? 0) * 0.12); blit(ctx, B(S.veil)); ctx.restore(); }
  if (S.quiver && o.prop !== 'greatbow') { ctx.save(); ctx.translate(shX - 10, shY + 24); ctx.rotate(-0.5 + lean); blit(ctx, B(S.quiver)); ctx.restore(); }

  if (S.hair) { ctx.save(); ctx.translate(neck[0], neck[1]); ctx.rotate(lean + (P.head ?? 0)); ctx.scale(K.headS ?? 1.1, K.headS ?? 1.1); blit(ctx, B(S.hair)); ctx.restore(); }
  // which hand shape each hand gets: an authored P.handF/handB wins; otherwise a held bow grips with both
  // hands, any other prop grips with whichever hand actually holds it, and an empty hand rests relaxed.
  const isBow = o.prop === 'bow' || o.prop === 'greatbow';
  const hpF = P.handF ?? (o.prop ? (isBow || !P.propBack ? 'grip' : 'relaxed') : 'relaxed');
  const hpB = P.handB ?? (o.prop ? (isBow || P.propBack ? 'grip' : 'relaxed') : 'relaxed');
  const backHand = arm(sockB, P.shB ?? -0.12, P.elB ?? 0.18, hpB, P.wristB);
  const sit = hF > 1.0 && !P.gait;
  leg(-K.hw * 0.42, hB, kB, fB);
  leg(K.hw * 0.42, hF, kF, fF);
  { const av = (hF + hB) / 2, sway = (P.sway ?? 0) * 0.08;
    ctx.save(); ctx.translate(0, hipY - 1);
    if (K.long && sit) { ctx.rotate(-Math.min(av, 1.35) * 0.9); blit(ctx, B(S.wrapSit)); }
    else { ctx.rotate(-Math.max(-0.3, Math.min(0.9, av * 0.5)) + sway); blit(ctx, B(S.wrap)); }
    ctx.restore(); }
  ctx.save(); ctx.translate(0, hipY); ctx.rotate(lean); blit(ctx, B(S.torso)); ctx.restore();
  ctx.save(); ctx.translate(neck[0], neck[1]); ctx.rotate(lean + (P.head ?? 0)); ctx.scale(K.headS ?? 1.1, K.headS ?? 1.1); blit(ctx, B(S.head(P.expr ?? K.expr ?? 'calm'))); ctx.restore();
  const frontHand = arm(sockF, P.shF ?? 0.15, P.elF ?? 0.25, hpF, P.wristF);
  if (o.prop) drawProp(ctx, o.prop, P.propBack ? backHand : frontHand, P.propBack ? frontHand : backHand, P, K);
  ctx.restore();
}

// LOD: a whole posed figure baked ONCE into a single sprite per (look, animation frame) - one drawImage instead of ~20 part blits.
// For rear ranks and crowds. poseAt(f) gives the pose of frame f of `frames`; pick f from the clock (or distance) at the call site.
export function lodFigure(ctx, o, f, poseAt) {
  const key = ['lod', o.kind, o.v ?? 0, o.prop ?? '', o.gold ?? '', o.ink ?? '', o.cape ?? '', o.accent ?? '', f].join('|');
  const sp = sprite(key, 330, 340, 165, 306, 0.7, (g) => { figure(g, { ...o, x: 0, y: 0, s: 1, dir: 1, pose: poseAt(f) }); });
  const sc = o.s ?? 1;
  ctx.save(); ctx.translate(o.x, o.y); ctx.scale((o.dir ?? 1) * sc, sc); blit(ctx, sp); ctx.restore();
}
