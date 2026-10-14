// Drawing helpers for the cart (rear view for the road, side view for the garage and illustrations), the rider and small icons.
// Everything is canvas paths; no images. Units: `ppm` = pixels per metre at the object.
import { WHEELS, FRAMES } from './sim.js';

const TAU = Math.PI * 2;

export const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
};
export const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t, g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t, bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`;
};
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };

const WHEEL_LOOK = {
  pram: { tyre: '#26282c', rim: '#c9ced6', w: 0.13, d: 0.52 },
  spoke: { tyre: '#6e4a26', rim: '#d8b27a', w: 0.15, d: 0.7 },
  pneu: { tyre: '#1d1f22', rim: '#d9d3c4', w: 0.24, d: 0.82 },
  racer: { tyre: '#3a4658', rim: '#e9f0f8', w: 0.1, d: 0.6 },
};
export const wheelLook = (type) => WHEEL_LOOK[type] ?? WHEEL_LOOK.spoke;

// ---- the rider (a kid in a helmet; seen from behind on the road and from the side in the garage) ---------------------
export function drawRiderBack(ctx, x, y, ppm, o) {
  // (x, y) = point between the shoulders' base; rider about 0.9 m tall above it
  const sh = o.shirt ?? '#f2b53f', hel = o.helmet ?? '#d33b2f';
  const w = 0.5 * ppm;
  ctx.save();
  // torso
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(sh, -0.25)); g.addColorStop(0.5, shade(sh, 0.1)); g.addColorStop(1, shade(sh, -0.3));
  ctx.fillStyle = g; rr(ctx, x - w / 2, y - 0.62 * ppm, w, 0.66 * ppm, 0.16 * ppm); ctx.fill();
  // arms reaching forward to the ropes
  const steer = (o.u ?? 0) * 0.14 * ppm;
  ctx.strokeStyle = shade(sh, -0.12); ctx.lineWidth = 0.14 * ppm; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * w * 0.46, y - 0.5 * ppm); ctx.lineTo(x + s * 0.42 * ppm + steer, y - 0.88 * ppm); ctx.stroke(); }
  ctx.fillStyle = '#e8b896'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 0.42 * ppm + steer, y - 0.9 * ppm, 0.07 * ppm, 0, TAU); ctx.fill(); }
  // head and helmet
  const hx = x + (o.u ?? 0) * 0.04 * ppm, hy = y - 0.8 * ppm, hr = 0.2 * ppm;
  ctx.fillStyle = '#e8b896'; ctx.beginPath(); ctx.arc(hx, hy + 0.04 * ppm, hr * 0.78, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(hx - hr * 0.3, hy - hr * 0.5, hr * 0.1, hx, hy, hr * 1.2);
  hg.addColorStop(0, shade(hel, 0.45)); hg.addColorStop(1, shade(hel, -0.25));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy - 0.02 * ppm, hr, Math.PI * 0.98, TAU * 1.02); ctx.lineTo(hx + hr, hy + 0.1 * ppm); ctx.lineTo(hx - hr, hy + 0.1 * ppm); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; rr(ctx, hx - 0.02 * ppm, hy - hr, 0.04 * ppm, hr * 0.9, 0.02 * ppm); ctx.fill();
  ctx.restore();
}

// ---- the cart from behind -----------------------------------------------------------------------------------------
// o: {color, accent, u, lean, psi, spin, wheels, frame, shirt, helmet, brake, t, alpha}
export function drawCartBack(ctx, cx, gy, ppm, o) {
  const body = o.color ?? '#2f7de0', acc = o.accent ?? '#ffffff';
  const wl = wheelLook(o.wheels), fr = FRAMES[o.frame] ?? FRAMES.box;
  const td = wl.d, tw = wl.w;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  // shadow
  ctx.fillStyle = 'rgba(10,16,10,0.32)'; ctx.beginPath(); ctx.ellipse(cx, gy + 0.03 * ppm, 0.85 * ppm, 0.22 * ppm, 0, 0, TAU); ctx.fill();
  ctx.translate(cx, gy);
  ctx.rotate((o.lean ?? 0));
  // real 3D cart and driver (presentation layer: web/view3d/carts.js); the 2D drawing below is the fallback
  const r3 = globalThis.__cart3d;
  if (r3 && r3.drawCart && o.build && r3.drawCart(ctx, {
    who: o.who ?? 'You', color: body, accent: acc, wheels: o.build.wheels, frame: o.build.frame, steer: o.build.steer, brake: o.build.brake, bal: o.build.bal, num: o.num,
    u: o.u, psi: o.psi, spin: o.spin, brakeOn: !!o.brake, v: o.v, t: o.t, rough: o.rough, shirt: o.shirt, helmet: o.helmet, z: o.z, camH: o.camH, mode: 'back',
  }, ppm * 1.22)) { ctx.restore(); return; }
  ctx.transform(1, 0, -(o.psi ?? 0) * 0.5, 1, 0, 0);
  const hw = 0.62;                  // half track in metres
  const deckY = -(td * 0.45 + 0.05) * ppm;   // deck height above ground at the rear
  const run = 1.5 * ppm * 0.34;     // how far up the screen the front end sits
  const fw = 0.8;                   // front narrower (perspective)
  const wob = o.bump ? Math.sin((o.t ?? 0) * 40) * o.bump * 0.03 * ppm : 0;
  // front wheels (far end), steered
  const fy = deckY - run;
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(s * hw * fw * ppm, fy + (td * 0.45) * ppm * fw * 0.5 + wob); ctx.rotate((o.u ?? 0) * 0.45 * s * 0 + (o.u ?? 0) * 0.4);
    ctx.fillStyle = wl.tyre; rr(ctx, -tw * 0.5 * ppm * fw, -td * 0.5 * ppm * fw * 0.9, tw * ppm * fw, td * ppm * fw * 0.9, tw * 0.4 * ppm); ctx.fill();
    ctx.restore();
  }
  // deck (trapezoid from rear to front)
  const gdeck = ctx.createLinearGradient(0, deckY - run, 0, deckY);
  gdeck.addColorStop(0, shade(body, 0.25)); gdeck.addColorStop(1, shade(body, -0.18));
  ctx.fillStyle = gdeck;
  ctx.beginPath(); ctx.moveTo(-0.5 * ppm, deckY); ctx.lineTo(0.5 * ppm, deckY); ctx.lineTo(0.4 * ppm, deckY - run); ctx.lineTo(-0.4 * ppm, deckY - run); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1.2; ctx.stroke();
  // plank lines
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  for (const q of [-0.17, 0, 0.17]) { ctx.beginPath(); ctx.moveTo(q * ppm, deckY); ctx.lineTo(q * 0.8 * ppm, deckY - run); ctx.stroke(); }
  // axle beam at the back
  ctx.fillStyle = '#3a3128'; rr(ctx, -hw * ppm, deckY - 0.04 * ppm, 2 * hw * ppm, 0.1 * ppm, 0.04 * ppm); ctx.fill();
  // body box for box/beam frames: back panel
  const panelH = (fr === FRAMES.plank ? 0.16 : fr === FRAMES.box ? 0.38 : 0.52) * ppm;
  const pg = ctx.createLinearGradient(0, deckY - panelH, 0, deckY);
  pg.addColorStop(0, shade(body, 0.3)); pg.addColorStop(1, shade(body, -0.12));
  ctx.fillStyle = pg; rr(ctx, -0.5 * ppm, deckY - panelH, 1.0 * ppm, panelH, 0.06 * ppm); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.4; ctx.stroke();
  // number plate stripe
  ctx.fillStyle = acc; rr(ctx, -0.22 * ppm, deckY - panelH * 0.78, 0.44 * ppm, panelH * 0.5, 0.04 * ppm); ctx.fill();
  if (o.num) { ctx.fillStyle = shade(body, -0.45); ctx.font = `800 ${Math.max(8, 0.2 * ppm)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.num, 0, deckY - panelH * 0.53); }
  // rider
  drawRiderBack(ctx, 0, deckY - panelH + 0.02 * ppm, ppm, { shirt: o.shirt, helmet: o.helmet, u: o.u });
  // ropes from the hands to the steering axle
  ctx.strokeStyle = 'rgba(230,214,170,0.9)'; ctx.lineWidth = Math.max(1, 0.025 * ppm);
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 0.42 * ppm + (o.u ?? 0) * 0.14 * ppm, deckY - panelH - 0.78 * ppm); ctx.lineTo(s * hw * fw * ppm, fy); ctx.stroke(); }
  // rear wheels (nearest)
  for (const s of [-1, 1]) {
    const wx = s * hw * ppm, wy = -td * ppm + wob;
    ctx.fillStyle = wl.tyre; rr(ctx, wx - tw * 0.5 * ppm, wy, tw * ppm, td * ppm, tw * 0.45 * ppm); ctx.fill();
    // tread bars scrolling with the wheel
    ctx.save(); rr(ctx, wx - tw * 0.5 * ppm, wy, tw * ppm, td * ppm, tw * 0.45 * ppm); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    const step = 0.16 * ppm, off = ((o.spin ?? 0) * 0.45 * ppm) % step;
    for (let q = -step; q < td * ppm + step; q += step) ctx.fillRect(wx - tw * 0.5 * ppm, wy + q + off, tw * ppm, step * 0.4);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(wx - tw * 0.5 * ppm, wy, tw * 0.28 * ppm, td * ppm);
    ctx.restore();
    ctx.fillStyle = wl.rim; ctx.beginPath(); ctx.arc(wx, wy + td * 0.5 * ppm, Math.max(1.5, 0.04 * ppm), 0, TAU); ctx.fill();
  }
  // brake light when braking
  if (o.brake) { ctx.fillStyle = '#ff3b30'; ctx.shadowColor = '#ff3b30'; ctx.shadowBlur = 0.2 * ppm; rr(ctx, -0.36 * ppm, deckY - panelH * 0.18, 0.72 * ppm, 0.07 * ppm, 0.03 * ppm); ctx.fill(); ctx.shadowBlur = 0; }
  // pennant on a pole
  ctx.strokeStyle = '#d8d2c2'; ctx.lineWidth = Math.max(1, 0.025 * ppm);
  ctx.beginPath(); ctx.moveTo(0.42 * ppm, deckY - panelH * 0.6); ctx.lineTo(0.42 * ppm, deckY - panelH - 1.6 * ppm); ctx.stroke();
  const fl = Math.sin((o.t ?? 0) * 9 + (o.spin ?? 0) * 0.02) * 0.06 * ppm;
  ctx.fillStyle = acc === '#ffffff' ? shade(body, 0.1) : acc;
  ctx.beginPath(); ctx.moveTo(0.42 * ppm, deckY - panelH - 1.6 * ppm); ctx.lineTo(0.42 * ppm + 0.5 * ppm, deckY - panelH - 1.5 * ppm + fl); ctx.lineTo(0.42 * ppm, deckY - panelH - 1.32 * ppm); ctx.closePath(); ctx.fill();
  ctx.restore();
}

// ---- the cart from the side (garage, title, rules) -----------------------------------------------------------------
// (x, y) = ground contact below the middle; width about 2.6 m * ppm.
export function drawCartSide(ctx, x, y, ppm, o = {}) {
  const body = o.color ?? '#2f7de0', build = o.build ?? { wheels: 'spoke', frame: 'box', steer: 'pivot', brake: 'heel', bal: 0 };
  const wl = wheelLook(build.wheels), fr = FRAMES[build.frame] ?? FRAMES.box;
  const rd = wl.d * 0.5 * ppm * (build.wheels === 'pram' ? 1 : 1);
  const front = 1.15 * ppm, rear = -1.05 * ppm;
  const sp = o.spin ?? 0;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(10,16,10,0.28)'; ctx.beginPath(); ctx.ellipse(0, 0.02 * ppm, 1.7 * ppm, 0.14 * ppm, 0, 0, TAU); ctx.fill();
  const r3 = globalThis.__cart3d;
  if (r3 && r3.drawCart && r3.drawCart(ctx, {
    who: o.who ?? 'You', color: body, accent: o.accent ?? '#ffd36a', wheels: build.wheels, frame: build.frame, steer: build.steer, brake: build.brake, bal: build.bal, num: o.num ?? '1',
    u: 0, psi: 0, spin: sp, brakeOn: !!o.brake, v: o.v ?? 6, t: o.t ?? sp, rough: 0, shirt: o.shirt, helmet: o.helmet, mode: 'side',
  }, ppm)) { ctx.restore(); return; }
  const axleY = -rd;
  // frame
  const deckT = axleY - 0.1 * ppm;
  const thick = (build.frame === 'plank' ? 0.1 : build.frame === 'box' ? 0.14 : 0.22) * ppm;
  const g = ctx.createLinearGradient(0, deckT - thick, 0, deckT + 0.02 * ppm);
  g.addColorStop(0, shade(body, 0.3)); g.addColorStop(1, shade(body, -0.2));
  ctx.fillStyle = g; rr(ctx, rear - 0.1 * ppm, deckT - thick, front - rear + 0.3 * ppm, thick, 0.04 * ppm); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (build.frame !== 'plank') {   // side panels / seat box
    const bh = (build.frame === 'box' ? 0.36 : 0.5) * ppm;
    ctx.fillStyle = g; rr(ctx, rear - 0.05 * ppm, deckT - thick - bh, 1.2 * ppm, bh + 0.02 * ppm, 0.06 * ppm); ctx.fill(); ctx.stroke();
    if (build.frame === 'beam') {   // ballast sacks
      ctx.fillStyle = '#bfa774';
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(rear + 0.1 * ppm + i * 0.3 * ppm, deckT - thick - bh - 0.05 * ppm, 0.15 * ppm, 0.1 * ppm, 0, 0, TAU); ctx.fill(); }
    }
  }
  // ballast marker
  const bal = build.bal ?? 0;
  ctx.fillStyle = '#bfa774'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2;
  const bx = (front + rear) / 2 + (bal * 0.5 + 0) * 0.5 * ppm;
  ctx.beginPath(); ctx.ellipse(bx, deckT - thick - 0.07 * ppm, 0.17 * ppm, 0.11 * ppm, 0, 0, TAU); ctx.fill(); ctx.stroke();
  // rider (side view)
  const rx = rear + 0.45 * ppm, ry = deckT - thick - (build.frame === 'plank' ? 0 : build.frame === 'box' ? 0.34 : 0.48) * ppm;
  ctx.fillStyle = o.shirt ?? '#f2b53f'; rr(ctx, rx - 0.17 * ppm, ry - 0.62 * ppm, 0.34 * ppm, 0.62 * ppm, 0.12 * ppm); ctx.fill();
  ctx.strokeStyle = shade(o.shirt ?? '#f2b53f', -0.15); ctx.lineWidth = 0.12 * ppm; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(rx + 0.05 * ppm, ry - 0.45 * ppm); ctx.lineTo(front - 0.25 * ppm, deckT - thick - 0.2 * ppm); ctx.stroke();
  ctx.fillStyle = '#e8b896'; ctx.beginPath(); ctx.arc(rx + 0.04 * ppm, ry - 0.8 * ppm, 0.17 * ppm, 0, TAU); ctx.fill();
  const hh = o.helmet ?? '#d33b2f';
  ctx.fillStyle = hh; ctx.beginPath(); ctx.arc(rx + 0.04 * ppm, ry - 0.84 * ppm, 0.2 * ppm, Math.PI, TAU); ctx.lineTo(rx + 0.24 * ppm, ry - 0.8 * ppm); ctx.lineTo(rx - 0.16 * ppm, ry - 0.8 * ppm); ctx.closePath(); ctx.fill();
  // steering: rope or rack at the front axle
  ctx.strokeStyle = 'rgba(235,220,180,0.95)'; ctx.lineWidth = Math.max(1.5, 0.03 * ppm);
  ctx.beginPath(); ctx.moveTo(front - 0.25 * ppm, deckT - thick - 0.2 * ppm); ctx.lineTo(front, deckT); ctx.stroke();
  // brake: heel drag (a pad behind) or lever
  if (build.brake === 'lever') {
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 0.05 * ppm; ctx.beginPath(); ctx.moveTo(rear + 0.8 * ppm, deckT - thick - 0.05 * ppm); ctx.lineTo(rear + 0.95 * ppm, deckT - thick - 0.52 * ppm); ctx.stroke();
    ctx.fillStyle = '#c9ced6'; rr(ctx, rear - 0.05 * ppm, axleY + rd * 0.55, 0.5 * ppm, 0.07 * ppm, 0.03 * ppm); ctx.fill();
  } else {
    ctx.fillStyle = '#3a3128'; rr(ctx, rear - 0.25 * ppm, -0.09 * ppm, 0.4 * ppm, 0.1 * ppm, 0.04 * ppm); ctx.fill();
  }
  // wheels
  for (const [wx, k] of [[rear + 0.25 * ppm, 1], [front - 0.2 * ppm, 1]]) {
    const r = rd * k;
    ctx.fillStyle = wl.tyre; ctx.beginPath(); ctx.arc(wx, -r, r, 0, TAU); ctx.fill();
    ctx.fillStyle = shade(wl.tyre, 0.2); ctx.beginPath(); ctx.arc(wx, -r, r * 0.72, 0, TAU); ctx.fill();
    ctx.fillStyle = wl.rim; ctx.beginPath(); ctx.arc(wx, -r, r * (build.wheels === 'pneu' ? 0.45 : 0.62), 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(wl.rim, -0.4); ctx.lineWidth = Math.max(1, 0.02 * ppm);
    const spokes = build.wheels === 'spoke' ? 8 : build.wheels === 'racer' ? 3 : 6;
    for (let i = 0; i < spokes; i++) { const a = sp + (i / spokes) * TAU; ctx.beginPath(); ctx.moveTo(wx, -r); ctx.lineTo(wx + Math.cos(a) * r * 0.62, -r + Math.sin(a) * r * 0.62); ctx.stroke(); }
    ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(wx, -r, r * 0.1, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- icons ---------------------------------------------------------------------------------------------------------
export function drawWheelIcon(ctx, cx, cy, r, type) {
  const wl = wheelLook(type), rr2 = r * (0.62 + wl.d * 0.4);
  ctx.save();
  ctx.fillStyle = wl.tyre; ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TAU); ctx.fill();
  ctx.fillStyle = wl.rim; ctx.beginPath(); ctx.arc(cx, cy, rr2 * (type === 'pneu' ? 0.5 : 0.68), 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(wl.rim, -0.45); ctx.lineWidth = 1.5;
  const n = type === 'spoke' ? 8 : type === 'racer' ? 3 : 6;
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rr2 * 0.66, cy + Math.sin(a) * rr2 * 0.66); ctx.stroke(); }
  ctx.restore();
}

// a crowd member (used by the scene and by menu art)
export const SHIRTS = ['#e2573b', '#3aa6d8', '#f2b53f', '#9a62d6', '#3cc78f', '#ffffff', '#e87aa0', '#2f7de0'];
export const SKINS = ['#f0c8a0', '#d9a074', '#a8704a', '#7a4e32', '#f6d6b8'];
export function drawPerson(ctx, x, y, h, v, ph, t, cheer = 1, side = 1) {
  const r3 = globalThis.__cart3d;
  if (r3 && r3.person && r3.person(ctx, x, y, h, v, ph, t, cheer, side)) return;
  const w = h * 0.34, sh = SHIRTS[v % SHIRTS.length], sk = SKINS[(v * 3 + 1) % SKINS.length];
  const bob = Math.sin(t * 5 + ph) * h * 0.025 * cheer;
  y -= Math.abs(bob);
  ctx.fillStyle = (v % 3 === 0) ? '#37445a' : '#4b3b2c'; ctx.fillRect(x - w * 0.36, y - h * 0.4, w * 0.3, h * 0.4); ctx.fillRect(x + w * 0.06, y - h * 0.4, w * 0.3, h * 0.4);
  ctx.fillStyle = sh; rr(ctx, x - w / 2, y - h * 0.75, w, h * 0.4, w * 0.3); ctx.fill();
  const up = (Math.sin(t * 6 + ph) * 0.5 + 0.5) * cheer;
  ctx.strokeStyle = sh; ctx.lineWidth = Math.max(1, w * 0.22); ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * w * 0.45, y - h * 0.7); ctx.lineTo(x + s * w * (0.7 + 0.3 * up), y - h * (0.62 + 0.38 * (s > 0 ? up : 1 - up) * cheer)); ctx.stroke(); }
  ctx.fillStyle = sk; ctx.beginPath(); ctx.arc(x, y - h * 0.86, h * 0.12, 0, TAU); ctx.fill();
  if (v % 4 === 1) { ctx.fillStyle = '#e8d9a8'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.93, h * 0.2, h * 0.05, 0, 0, TAU); ctx.fill(); ctx.fillRect(x - h * 0.1, y - h * 1.02, h * 0.2, h * 0.1); }
  else { ctx.fillStyle = ['#2a1d12', '#6b4423', '#c9a050', '#111'][v % 4]; ctx.beginPath(); ctx.arc(x, y - h * 0.9, h * 0.12, Math.PI, TAU); ctx.fill(); }
}
