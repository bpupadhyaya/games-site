// Drawing the round: a top-down picture of two upright athletes holding each other's belts on a ring that turns beneath them.
// Everything is drawn in an 800 x 800 "world" (y down) scaled to the stage rectangle; the backdrop is painted beyond the world edges
// so a wide or tall stage is always filled. Pure drawing: game.js owns the state; the pose springs live in state.pose.
//   Side 0 (you) stands at the bottom facing up, side 1 at the top facing down; both use the screen's left-right axis for weight.
import { light, TUNE } from './sim.js';
import { camera, drawFigures, drawSurround } from './figure.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

export const WORLD = { w: 800, h: 800, cx: 400, cy: 400, ringR: 318, y0: 474, y1: 326 };
export const RINGS = [
  { id: 'turf', name: 'Green Turf', blurb: 'A mown meadow in daylight.' },
  { id: 'hall', name: 'Sports Hall', blurb: 'Timber floor, lamps and a hushed crowd.' },
  { id: 'snow', name: 'Winter Field', blurb: 'Dusk, packed snow and lanterns.' },
];
export const RING_BY_ID = Object.fromEntries(RINGS.map((h) => [h.id, h]));

// ---- looks: skin, hair and kit for the athletes -----------------------------------------------------------------------
export const LOOKS = [
  { skin: '#e8b48f', skinDk: '#bf8461', hair: '#3a2615', kit: '#27466f', kitDk: '#16294a', trim: '#f2ead2', pants: '#5e6d85', shoe: '#e9e4d6' },   // you
  { skin: '#f3cdaa', skinDk: '#cf9b74', hair: '#d9b36a', kit: '#4f8a52', kitDk: '#2f5c35', trim: '#f4efe0', pants: '#707f62', shoe: '#2a2f38', f: 1 },   // Aino
  { skin: '#d9a07e', skinDk: '#aa7452', hair: '#1c1410', kit: '#b8452d', kitDk: '#7e2a18', trim: '#f2e8cf', pants: '#575b6a', shoe: '#e4dccb', f: 1 },   // Birna
  { skin: '#f0c19c', skinDk: '#c78f68', hair: '#8c4a22', kit: '#d29b2f', kitDk: '#9a6a14', trim: '#2b2118', pants: '#85735a', shoe: '#2d2a28' },   // Eirik
  { skin: '#c88c66', skinDk: '#9b6240', hair: '#0f0b09', kit: '#7a5aa6', kitDk: '#54397c', trim: '#f4e9d6', pants: '#665c7c', shoe: '#ddd8cc', f: 1 },   // Sigrun
  { skin: '#9a6743', skinDk: '#6f4426', hair: '#120d0a', kit: '#2f8a93', kitDk: '#1b5a62', trim: '#f4efd6', pants: '#527381', shoe: '#2b2b2f' },   // Magnus
];

// ---- small drawing helpers -----------------------------------------------------------------------------------------------
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (v) => clamp(Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f), 0, 255);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function bone2(p0, t, l1, l2, sgn) {
  const dx = t.x - p0.x, dy = t.y - p0.y;
  const d = Math.hypot(dx, dy) || 1;
  const dc = clamp(d, Math.abs(l1 - l2) + 1, l1 + l2 - 0.5);
  const ux = dx / d, uy = dy / d;
  const a = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  return { j: { x: p0.x + ux * a - uy * hh * sgn, y: p0.y + uy * a + ux * hh * sgn }, e: { x: p0.x + ux * dc, y: p0.y + uy * dc } };
}
const hash = (n) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// ---- the pose springs -------------------------------------------------------------------------------------------------------
export function newPose() {
  const p = () => ({ lean: 0, shake: 0, fall: 0, dir: 1, joy: 0, hs: 1, hp: 0, mouth: 0, sweat: 0, bob: 0 });
  return [p(), p()];
}
export function stepPose(pose, B, dt, over) {
  for (let i = 0; i < 2; i++) {
    const s = B.side[i], p = pose[i];
    const k = 1 - Math.exp(-dt * 9);
    p.lean += (s.w * 0.2 - p.lean) * k;
    p.shake = clamp(p.shake - dt * 2.4, 0, 1); if (s.stun > 0) p.shake = Math.min(1, Math.max(p.shake, s.stun / TUNE.stun));
    const lost = over && over.loser === i && over.how !== 'points';
    p.dir = s.dirHit || 1;
    p.fall += ((lost ? 1 : 0) - p.fall) * (1 - Math.exp(-dt * 5));
    p.joy += ((over ? (over.win === i ? 1 : 0) : 0) - p.joy) * (1 - Math.exp(-dt * 5));
    if (s.hook) { p.hs = s.hook.s; p.hp = clamp(s.hook.t / TUNE.windup, 0, 1); } else p.hp = Math.max(0, p.hp - dt * 4.5);
    p.mouth += (clamp(Math.abs(s.steer) * 0.7 + (s.stun > 0 ? 0.6 : 0) + (1 - s.st) * 0.4, 0, 1) - p.mouth) * k;
    p.sweat += ((s.st < 0.35 ? 1 : 0) - p.sweat) * (1 - Math.exp(-dt * 3));
    p.bob = B.t;
  }
}

// ---- geometry shared by drawing and effects ---------------------------------------------------------------------------------
const LAT = 30;       // how far the body slides sideways with full weight
const FOOT_X = 80;    // half the stance width
const FOOT_Y = 52;    // how far forward of the hips the feet stand
let STATIC_FEET = false;   // the 3D scene plants the feet: overlays are placed at the planted feet, not at the sliding 2D body
export function bodyAt(i, B) {
  const s = B.side[i], dir = i === 0 ? -1 : 1;
  return { x: WORLD.cx + (STATIC_FEET ? 0 : s.w * LAT), y: i === 0 ? WORLD.y0 : WORLD.y1, dir };
}
const s_ = () => 0;
export function footBase(i, sgn, B) {
  const b = bodyAt(i, B);
  return { x: b.x + sgn * FOOT_X + s_(B, i) * 0, y: b.y + b.dir * FOOT_Y };
}
// where the hooking foot is right now (for the drawing and for effects)
export function footNow(i, sgn, B, pose) {
  const base = footBase(i, sgn, B), p = pose[i];
  if (p.hs !== sgn || p.hp <= 0) return base;
  const tgt = footBase(1 - i, sgn, B);
  const o = B.side[i].hook ? ease(p.hp) : 1 - (1 - p.hp);
  const u = B.side[i].hook ? o * 0.86 : p.hp * 0.86 * 0.5;
  const arc = Math.sin(Math.min(1, u / 0.86) * Math.PI) * 26 * sgn;
  return { x: lerp(base.x, tgt.x, u) + arc, y: lerp(base.y, tgt.y, u) };
}

// ---- the backdrops -----------------------------------------------------------------------------------------------------------
function drawBackdrop(ctx, ring, vx0, vx1, vy0, vy1, B, t, cheer) {
  const cx = WORLD.cx, cy = WORLD.cy, R = WORLD.ringR, ang = B ? B.ang : t * 0.3;
  const far = Math.max(vx1 - vx0, vy1 - vy0) * 1.2;
  if (ring === 'turf') {
    ctx.fillStyle = '#3f7437'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // mown stripes beyond the ring
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang * 0.5);
    ctx.fillStyle = 'rgba(255,255,255,0.045)';
    for (let k = -14; k < 14; k += 2) ctx.fillRect(k * 60, -far, 60, far * 2);
    ctx.restore();
    // the ring: trimmed turf with a painted double line
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, R);
    g.addColorStop(0, '#6cae5a'); g.addColorStop(1, '#4f8f45');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let k = -8; k < 8; k += 2) ctx.fillRect(k * 44, -R, 44, R * 2);
    ctx.restore();
  } else if (ring === 'hall') {
    const bg = ctx.createLinearGradient(0, vy0, 0, vy1); bg.addColorStop(0, '#2a1d12'); bg.addColorStop(1, '#4a3320');
    ctx.fillStyle = bg; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    // bleacher rings
    for (let k = 0; k < 5; k++) { ctx.strokeStyle = `rgba(0,0,0,${0.25 + k * 0.05})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R + 52 + k * 36, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#c99a5b'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(70,40,14,0.35)'; ctx.lineWidth = 2;
    for (let k = -9; k <= 9; k++) { ctx.fillStyle = k % 2 ? 'rgba(255,230,180,0.08)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(k * 40 - 20, -R, 40, R * 2); ctx.beginPath(); ctx.moveTo(k * 40 - 20, -R); ctx.lineTo(k * 40 - 20, R); ctx.stroke(); }
    ctx.restore();
  } else {
    ctx.fillStyle = '#9fb3c9'; ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ang * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; for (let k = -12; k < 12; k += 2) ctx.fillRect(k * 70, -far, 70, far * 2);
    ctx.restore();
    const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, R);
    g.addColorStop(0, '#eef4fa'); g.addColorStop(1, '#d3e0ec');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(90,120,160,0.28)'; ctx.lineWidth = 3;
    for (let k = 0; k < 14; k++) { const a = hash(k + 77) * TAU, r0 = 40 + hash(k) * 240; ctx.beginPath(); ctx.arc(Math.cos(a) * r0 * 0.5, Math.sin(a) * r0 * 0.5, 30 + hash(k + 9) * 60, a, a + 1.2); ctx.stroke(); }
    ctx.restore();
  }
  // ring paint and a soft inner shade
  const paint = ring === 'hall' ? ['#f4efe0', '#27466f'] : ring === 'snow' ? ['#27466f', '#b8452d'] : ['#f4efe0', '#b8452d'];
  ctx.lineWidth = 10; ctx.strokeStyle = paint[0]; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = paint[1]; ctx.beginPath(); ctx.arc(cx, cy, R - 14, 0, TAU); ctx.stroke();
  // tick marks that turn with the ring so the circling reads
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 4;
  for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (R - 40), Math.sin(a) * (R - 40)); ctx.lineTo(Math.cos(a) * (R - 26), Math.sin(a) * (R - 26)); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 215, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.36)'; ctx.lineWidth = 5;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 205, Math.sin(a) * 205); ctx.lineTo(Math.cos(a) * 225, Math.sin(a) * 225); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 108, 0, TAU); ctx.stroke();
  ctx.restore();
  if (ring === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 46; k++) { const sx = vx0 + ((k * 97 + t * 22) % (vx1 - vx0)), sy = vy0 + ((k * 61 + t * 46) % (vy1 - vy0)); ctx.beginPath(); ctx.arc(sx, sy, 2.4, 0, TAU); ctx.fill(); }
  }
  void far;
}

// ---- the whole stage ---------------------------------------------------------------------------------------------------------
// S: { ring, t, B, pose, looks: [i, j], parts, pops, hint: null | {intent, side, steer}, cheer }
// The 2D picture: the ring seen from behind the near athlete and a little above (the same camera as the 3D scene), the athletes drawn by
// figure.js, then the overlays (halos, hints, particles, pops) in the shared overlay world.
export function drawStage(ctx, rect, S) {
  const B = S.B, t = S.t, fy = S.focusY ?? 0.5;
  const cam = camera(rect, B, fy, { zoom: S.zoom });
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  // backdrop: the top-down ring drawing laid on the ground plane of the camera
  const g0 = cam.p({ x: 0, y: 0, z: 0 }), k = (3.0 / WORLD.ringR) * cam.s;
  ctx.save();
  ctx.translate(g0.x, g0.y); ctx.scale(k, k * Math.sin(cam.el)); ctx.rotate(cam.az); ctx.translate(-WORLD.cx, -WORLD.cy);
  drawBackdrop(ctx, S.ring, -3000, 3800, -3000, 3800, { ang: 0 }, t, S.cheer);
  ctx.restore();
  drawSurround(ctx, cam, S.ring, t, S.cheer || 0);
  const looks = [LOOKS[S.looks[0]], LOOKS[S.looks[1]]];
  const m = drawFigures(ctx, cam, S, looks);
  drawStage3D(ctx, rect, { ...S, map: m });
  ctx.restore();
  // a soft vignette for depth
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const v = ctx.createRadialGradient(rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(rect.w, rect.h) * 0.5, rect.x + rect.w / 2, rect.y + rect.h / 2, Math.max(rect.w, rect.h) * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = v; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.restore();
  return m;
}

// ---- the overlays on top of the 3D scene -------------------------------------------------------------------------------------
// S.map = { a, b, c, d, e, f }: the affine that carries 800 x 800 world units onto the screen so that the planted feet of the 3D athletes
// land on footBase(); shapes are drawn in world units under that transform, text is drawn upright at the mapped point.
function mapPt(m, x, y) { return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }; }
export function drawStage3D(ctx, rect, S) {
  const B = S.B, t = S.t, m = S.map;
  STATIC_FEET = true;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.save();
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  // halos on the light legs: the cue to read
  if (S.cues !== false && !B.over) {
    for (let i = 0; i < 2; i++) {
      for (const s of [-1, 1]) {
        const lv = clamp(light(B.side[i], s) + 0.1, 0, 1);
        if (lv <= 0.38) continue;
        const f = footBase(i, s, B);
        ctx.save(); ctx.globalAlpha = clamp((lv - 0.3) * 1.2, 0, 0.8) * (0.6 + 0.4 * Math.sin(t * 7 + i));
        ctx.strokeStyle = i === 0 ? '#9fe7ff' : '#ffd37a'; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.ellipse(f.x, f.y, 30, 40, 0, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
    drawOpening(ctx, B, t);
  }
  // particles
  for (const q of S.parts) {
    const u = q.t / q.max, a = clamp(1 - u, 0, 1);
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + u), 0, TAU); ctx.fill(); }
    else if (q.kind === 3) { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * q.spin); ctx.fillStyle = q.col; ctx.globalAlpha = a; ctx.fillRect(-5, -2.5, 10, 5); ctx.restore(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.globalAlpha = a; ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, 14 + u * q.size, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  if (S.hint) drawHint3D(ctx, S.hint, B, t);
  ctx.restore();
  // text (HOOK / LOAD labels and the pops) stays upright
  const sc = Math.hypot(m.a, m.b);
  if (S.hint && (S.hint.intent === 'hook' || S.hint.intent === 'brace')) {
    const who = S.hint.who ?? 0, f = footBase(who, S.hint.side, B), p = mapPt(m, f.x, f.y + (who === 0 ? 96 : -70));
    ctx.save(); ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 6); ctx.fillStyle = '#ffe25a'; ctx.strokeStyle = 'rgba(10,20,34,0.8)'; ctx.lineWidth = 4;
    ctx.font = `800 ${Math.round(clamp(30 * sc, 14, 40))}px system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.strokeText(S.hint.intent === 'hook' ? 'HOOK' : 'LOAD', p.x, p.y); ctx.fillText(S.hint.intent === 'hook' ? 'HOOK' : 'LOAD', p.x, p.y); ctx.restore();
  }
  if (S.hint && S.hint.intent !== 'hook' && S.hint.intent !== 'brace' && !S.hint.steer) {
    const ry = (S.hint.who ?? 0) === 0 ? WORLD.y0 + 92 : WORLD.y1 - 92, p = mapPt(m, WORLD.cx, ry);
    ctx.save(); ctx.fillStyle = '#0b2b24'; ctx.font = `800 ${Math.round(clamp(22 * sc, 12, 30))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.fillText('rest', p.x, p.y + 7 * sc); ctx.restore();
  }
  for (const pp of S.pops) {
    const u = pp.t / pp.max, a = u < 0.15 ? u / 0.15 : clamp(1 - (u - 0.6) / 0.4, 0, 1);
    const p = mapPt(m, pp.x, pp.y), size = Math.round(clamp(pp.size * sc * 1.1, 15, 60));
    ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `800 ${size}px 'Avenir Next', 'Trebuchet MS', system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, size * 0.16); ctx.strokeStyle = 'rgba(10,20,34,0.85)'; ctx.lineJoin = 'round';
    ctx.strokeText(pp.text, p.x, p.y - u * 54 * sc); ctx.fillStyle = pp.col; ctx.fillText(pp.text, p.x, p.y - u * 54 * sc); ctx.restore();
  }
  ctx.restore();
  STATIC_FEET = false;
}
function drawHint3D(ctx, h, B, t) {
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.35 * Math.sin(t * 6);
  if (h.intent === 'hook' || h.intent === 'brace') {
    const who = h.who ?? 0, f = footBase(who, h.side, B);
    ctx.strokeStyle = '#ffe25a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(f.x, f.y, 36, 46, 0, 0, TAU); ctx.stroke();
  } else if (h.steer) {
    const dx = h.steer, y = (h.who ?? 0) === 0 ? WORLD.y0 + 92 : WORLD.y1 - 92;
    ctx.fillStyle = '#ffe25a'; ctx.strokeStyle = 'rgba(20,16,0,0.7)'; ctx.lineWidth = 4;
    ctx.translate(WORLD.cx, y);
    ctx.beginPath(); ctx.moveTo(-dx * 10, -14); ctx.lineTo(dx * 70, -14); ctx.lineTo(dx * 70, -32); ctx.lineTo(dx * 118, 0); ctx.lineTo(dx * 70, 32); ctx.lineTo(dx * 70, 14); ctx.lineTo(-dx * 10, 14); ctx.closePath(); ctx.stroke(); ctx.fill();
  } else {
    const ry = (h.who ?? 0) === 0 ? WORLD.y0 + 92 : WORLD.y1 - 92;
    ctx.fillStyle = '#9fe7c8'; ctx.beginPath(); ctx.arc(WORLD.cx, ry, 28, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// A bright link where both feet on one side are light: that is where a hook lands.
function drawOpening(ctx, B, t) {
  for (const s of [-1, 1]) {
    const m = light(B.side[0], s), r = light(B.side[1], s);
    if (m < TUNE.ownMin + 0.05 || r < TUNE.legMin + 0.05) continue;
    const a = footBase(0, s, B), b = footBase(1, s, B), k = clamp(Math.min(m, r) * 1.6, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * k * (0.7 + 0.3 * Math.sin(t * 9));
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 6; ctx.setLineDash([10, 9]); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y - 30); ctx.lineTo(b.x, b.y + 30); ctx.stroke(); ctx.restore();
  }
}
// The two feet and the weight between them, for a side: drawn small on the Rules page and the rail meters.
export function drawRail(ctx, x, y, w, h, sd, who, t, hot) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(4,10,22,0.66)'; ctx.fill();
  const cx = x + w / 2, half = w / 2 - h * 0.7;
  // light zones glow on the side with no weight
  for (const s of [-1, 1]) {
    const lv = clamp(light(sd, s), 0, 1);
    if (lv > 0.1) { ctx.fillStyle = `rgba(255,224,130,${0.18 + 0.5 * lv})`; ctx.beginPath(); ctx.roundRect(s < 0 ? x + 4 : cx + 2, y + 4, w / 2 - 6, h - 8, (h - 8) / 2); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, y + 3); ctx.lineTo(cx, y + h - 3); ctx.stroke();
  const px = cx + clamp(sd.w, -1, 1) * half;
  ctx.fillStyle = who === 0 ? '#9fe7ff' : '#ffd37a'; ctx.beginPath(); ctx.arc(px, y + h / 2, h * 0.38, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0a1424'; ctx.beginPath(); ctx.arc(px, y + h / 2, h * 0.16, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.strokeStyle = hot ? `rgba(255,120,90,${0.6 + 0.4 * Math.sin(t * 12)})` : 'rgba(190,215,240,0.35)'; ctx.lineWidth = hot ? 3 : 1.5; ctx.stroke();
  void g;
}
export { light, TUNE };
