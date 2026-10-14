// The picture: a painted sand ring with two wrestlers (lit, tapered limbs, knee and hip bend that follow the balance dots), a crowd of
// seated spectators and three rings (day festival, harvest moon, courtyard dusk). Also the balance disc used by the controls.
// Pure drawing: the wrestlers' pose is a small spring-damper state advanced by stepPose().
import { norm, dirVec } from './sim.js';
import { rigFor, drawWrestlers } from './figure.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, Arial, sans-serif";

export const WORLD = { w: 720, h: 520, floorY: 420, cx: 360 };
// the part of the world the picture always shows (the rest of the width is scenery that fills wider screens)
const VIEW = { w: 500, h: 440, bottom: 500 };

export const RINGS = [
  { id: 'danoh', name: 'Danoh Festival', blurb: 'Daylight, pines and far mountains', sky: ['#cfe3ea', '#f3ecd6'], far: '#9db4b8', mid: '#7f9a9b', near: '#5e7a74', sand: ['#e9c98c', '#cfa464'], rim: '#8a5a2b', light: 1, night: false },
  { id: 'moon', name: 'Harvest Moon', blurb: 'Lantern night under a big moon', sky: ['#0f1b3a', '#3a3a6a'], far: '#25305a', mid: '#1b2447', near: '#141a38', sand: ['#d5b37a', '#a98250'], rim: '#6e4a26', light: 0.62, night: true },
  { id: 'court', name: 'Courtyard Dusk', blurb: 'Tiled roofs and a stone wall at sunset', sky: ['#f0a77a', '#f6d9a0'], far: '#b57a6c', mid: '#8d5d5a', near: '#5b3f43', sand: ['#e2b87c', '#c19358'], rim: '#7a4a28', light: 0.88, night: false },
];
export const RING_BY_ID = Object.fromEntries(RINGS.map((r) => [r.id, r]));

// Looks: skin, hair, sash colour (blue and red are the traditional satba colours), shorts.
export const SASH = [{ sash: '#c8312f', sashD: '#8d1f20' }, { sash: '#2c5fb8', sashD: '#1b3c80' }];
export const LOOKS = [
  { skin: '#e0ad84', skinD: '#b97c58', hair: '#1a1411', long: false },
  { skin: '#c98a62', skinD: '#9c6140', hair: '#15110f', long: false },
  { skin: '#ecc19a', skinD: '#c08c66', hair: '#241a15', long: true },
  { skin: '#c98e68', skinD: '#9d6542', hair: '#120e0c', long: false },
  { skin: '#d4a07d', skinD: '#a8734f', hair: '#2a1d16', long: false },
  { skin: '#b9825c', skinD: '#8e5c3c', hair: '#0f0c0a', long: false },
];
// the look of a wrestler on a side: red sash on the left, blue on the right (the traditional satba colours)
export const lookFor = (idx, side) => ({ ...LOOKS[idx % LOOKS.length], shorts: '#efe6d0', ...SASH[side] });

// ---- pose ------------------------------------------------------------------------------------------------------------------
export function newPose() {
  const one = () => ({ lean: 0, leanV: 0, sway: 0, swayV: 0, fall: 0, fallDir: 1, win: 0, act: 0, actKind: 'none', actDir: 0, bob: 0 });
  return { s: [one(), one()], t: 0, shake: 0, hit: 0 };
}
// disp: the displayed dots (2 x {x,y}); over: F.over or null; acts: this beat's moves while revealing (or null)
export function stepPose(pose, disp, dt, over, acts, tReveal) {
  pose.t += dt;
  const k = 90, c = 13;
  for (let i = 0; i < 2; i++) {
    const s = pose.s[i], p = disp[i];
    const tl = clamp(p.y, -1.15, 1.15), ts = clamp(p.x, -1.15, 1.15);
    s.leanV += ((tl - s.lean) * k - s.leanV * c) * dt; s.lean += s.leanV * dt;
    s.swayV += ((ts - s.sway) * k - s.swayV * c) * dt; s.sway += s.swayV * dt;
    if (over) {
      if (i === over.loser) { s.fall = Math.min(1, s.fall + dt / 0.75); s.fallDir = over.vec.y >= 0 ? 1 : -1; }
      else { s.win = Math.min(1, s.win + dt / 0.5); }
    } else { s.fall = Math.max(0, s.fall - dt * 2); s.win = Math.max(0, s.win - dt * 3); }
    s.act = Math.max(0, s.act - dt * 2.2);
    s.bob += dt;
  }
  if (acts && tReveal >= 0 && tReveal < dt + 1e-6) { // the reveal just began
    for (let i = 0; i < 2; i++) { pose.s[i].act = 1; pose.s[i].actKind = acts[i].kind; pose.s[i].actDir = acts[i].dir; }
  }
  pose.shake = Math.max(0, pose.shake - dt * 3);
}

// ---- background ---------------------------------------------------------------------------------------------------------
function drawMountains(ctx, r, W, baseY, t) {
  const layers = [
    { c: r.far, h: 140, amp: 50, f: 0.006, off: 1 },
    { c: r.mid, h: 100, amp: 38, f: 0.009, off: 3 },
    { c: r.near, h: 62, amp: 26, f: 0.013, off: 6 },
  ];
  for (const L of layers) {
    ctx.beginPath(); ctx.moveTo(-40, baseY);
    for (let x = -40; x <= W + 40; x += 20) {
      const y = baseY - L.h - Math.sin(x * L.f + L.off) * L.amp - Math.sin(x * L.f * 2.3 + L.off * 2) * L.amp * 0.4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 40, baseY); ctx.closePath();
    const g = ctx.createLinearGradient(0, baseY - L.h - L.amp, 0, baseY); g.addColorStop(0, L.c); g.addColorStop(1, r.sky[1]);
    ctx.fillStyle = g; ctx.fill();
  }
  void t;
}
function pine(ctx, x, y, s, col) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = col; ctx.lineCap = 'round';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(14, -60, -16, -120, 6, -190); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const yy = -70 - i * 38, sx = i % 2 ? 1 : -1;
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, yy); ctx.quadraticCurveTo(sx * 40, yy - 14, sx * 78, yy + 6); ctx.stroke();
    ctx.fillStyle = col; ctx.globalAlpha = 0.9;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.ellipse(sx * (36 + k * 18), yy - 8 + k * 2, 26, 9, sx * -0.12, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function roofRow(ctx, r, W, y) {
  // a tiled roof line with upswept eaves, and a pale wall below
  ctx.fillStyle = '#4b3a3c';
  ctx.beginPath(); ctx.moveTo(-20, y); ctx.lineTo(W + 20, y);
  ctx.lineTo(W + 20, y - 30); ctx.lineTo(-20, y - 30); ctx.fill();
  for (let x = -20; x < W + 20; x += 22) { ctx.fillStyle = (x / 22) % 2 ? '#5a4648' : '#463638'; ctx.fillRect(x, y - 30, 22, 30); }
  ctx.fillStyle = '#2e2426'; ctx.beginPath(); ctx.moveTo(-30, y - 28); ctx.quadraticCurveTo(W / 2, y - 62, W + 30, y - 28); ctx.lineTo(W + 30, y - 38); ctx.quadraticCurveTo(W / 2, y - 72, -30, y - 38); ctx.fill();
  const wall = ctx.createLinearGradient(0, y, 0, y + 60); wall.addColorStop(0, '#d9c9b0'); wall.addColorStop(1, '#bda98b');
  ctx.fillStyle = wall; ctx.fillRect(-20, y, W + 40, 60);
  ctx.strokeStyle = 'rgba(70,50,40,0.35)'; ctx.lineWidth = 2;
  for (let x = 0; x < W; x += 74) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke(); }
  void r;
}
function lantern(ctx, x, y, t, s = 1) {
  const sw = Math.sin(t * 1.3 + x) * 3;
  ctx.save(); ctx.translate(x + sw, y); ctx.scale(s, s);
  ctx.strokeStyle = '#3a2a22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -16); ctx.stroke();
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46); g.addColorStop(0, 'rgba(255,214,120,0.85)'); g.addColorStop(1, 'rgba(255,170,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
  ctx.fillStyle = '#e8573b'; ctx.beginPath(); ctx.ellipse(0, 0, 15, 20, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,160,0.7)'; ctx.beginPath(); ctx.ellipse(-4, -5, 6, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a22'; ctx.fillRect(-9, -22, 18, 4); ctx.fillRect(-9, 18, 18, 4);
  ctx.restore();
}

export function drawScenery(ctx, ring, rect, S, ox, oy, t) {
  const r = typeof ring === 'string' ? RING_BY_ID[ring] ?? RINGS[0] : ring;
  const { x, y, w, h } = rect;
  // sky over the whole rect
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, r.sky[0]); g.addColorStop(0.7, r.sky[1]); g.addColorStop(1, r.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.translate(ox, oy); ctx.scale(S, S);
  const wx0 = (x - ox) / S, ww = w / S;
  const L = wx0 - 40, R = wx0 + ww + 40, W = R - L;
  ctx.translate(L, 0);
  const baseY = WORLD.floorY - 112;
  if (r.night) {
    // moon and stars
    for (let i = 0; i < 40; i++) { const sx = (i * 97) % W, sy = (i * 53) % 120 - 40; ctx.fillStyle = `rgba(255,248,220,${0.25 + ((i * 7) % 5) * 0.12})`; ctx.fillRect(sx, sy + 40, 2, 2); }
    const mg = ctx.createRadialGradient(W * 0.78, 84, 6, W * 0.78, 84, 120); mg.addColorStop(0, 'rgba(255,246,200,0.95)'); mg.addColorStop(0.25, 'rgba(255,240,180,0.35)'); mg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = mg; ctx.fillRect(W * 0.78 - 130, -50, 260, 270);
    ctx.fillStyle = '#fff4c6'; ctx.beginPath(); ctx.arc(W * 0.78, 84, 36, 0, TAU); ctx.fill();
  } else {
    const sg = ctx.createRadialGradient(W * 0.2, 90, 4, W * 0.2, 90, 150); sg.addColorStop(0, 'rgba(255,250,225,0.9)'); sg.addColorStop(1, 'rgba(255,250,225,0)');
    ctx.fillStyle = sg; ctx.fillRect(W * 0.2 - 160, -60, 320, 300);
  }
  drawMountains(ctx, r, W, baseY, t);
  if (r.id === 'court') { roofRow(ctx, r, W, baseY - 6); }
  else {
    pine(ctx, W * 0.1, baseY + 26, 1.1, r.night ? '#10162b' : '#3c4a3b');
    pine(ctx, W * 0.92, baseY + 34, 0.9, r.night ? '#10162b' : '#3c4a3b');
  }
  if (r.night) { lantern(ctx, W * 0.26, baseY - 10, t, 1); lantern(ctx, W * 0.5, baseY - 30, t, 0.9); lantern(ctx, W * 0.74, baseY - 4, t, 1.05); }
  else if (r.id === 'court') { lantern(ctx, W * 0.18, baseY - 20, t, 0.85); lantern(ctx, W * 0.84, baseY - 20, t, 0.85); }
  // ground behind the ring
  const gy = baseY + 30;
  const gg = ctx.createLinearGradient(0, gy, 0, WORLD.h); gg.addColorStop(0, r.night ? '#2a2630' : '#a78f68'); gg.addColorStop(1, r.night ? '#1a1820' : '#7d6a4c');
  ctx.fillStyle = gg; ctx.fillRect(0, gy, W, WORLD.h - gy + 400);
  ctx.restore();
  return { r, L };
}

function drawRing(ctx, r, cxw, W, t) {
  // the sand ring, an ellipse seen from the side, with a straw rope rim
  const cy = WORLD.floorY + 8, rx = Math.max(W * 0.5 + 40, 400), ry = 74;
  const sg = ctx.createLinearGradient(0, cy - ry, 0, cy + ry); sg.addColorStop(0, r.sand[0]); sg.addColorStop(1, r.sand[1]);
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cxw, cy + 8, rx, ry + 4, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cxw, cy, rx, ry, 0, 0, TAU); ctx.fill();
  // speckle (deterministic)
  for (let i = 0; i < 90; i++) {
    const a = (i * 2.399) % TAU, d = Math.sqrt(((i * 31) % 100) / 100);
    ctx.fillStyle = i % 3 ? 'rgba(120,80,40,0.18)' : 'rgba(255,245,215,0.28)';
    ctx.fillRect(cxw + Math.cos(a) * rx * 0.92 * d, cy + Math.sin(a) * ry * 0.9 * d, 2.4, 1.6);
  }
  // rope rim: front half only reads as in front of the ground
  ctx.lineWidth = 7; ctx.strokeStyle = '#b89451'; ctx.beginPath(); ctx.ellipse(cxw, cy, rx, ry, 0, 0.02 * Math.PI, 0.98 * Math.PI); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(80,50,20,0.55)'; ctx.setLineDash([6, 7]); ctx.beginPath(); ctx.ellipse(cxw, cy, rx, ry, 0, 0.02 * Math.PI, 0.98 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
  void t;
}

// The flat picture of the same 3D wrestlers (pre-rendered by main.js): the hold leaned and swayed with the pose springs, or the fall.
function drawSpritePair(ctx, pose) {
  const sp = globalThis.__figureSprites;
  if (!sp || !sp.hold || !sp.f0p || !sp.f0m || !sp.f1p || !sp.f1m) return false;
  drawFloorShadows(ctx, pose);
  const a = pose.s[0], b = pose.s[1];
  const loser = a.fall > 0.35 ? 0 : b.fall > 0.35 ? 1 : -1;
  ctx.save();
  if (loser >= 0) {
    const s = sp[`f${loser}${pose.s[loser].fallDir < 0 ? 'm' : 'p'}`];
    ctx.drawImage(s.im, s.x, s.y, s.w, s.h);
  } else {
    const s = sp.hold, lean = (a.lean - b.lean) * 0.5, sway = (a.sway + b.sway) * 0.5;
    ctx.translate(WORLD.cx + sway * 7, WORLD.floorY);
    ctx.rotate(clamp(lean, -1, 1) * 0.045 + (a.win - b.win) * 0);
    ctx.translate(-WORLD.cx, -WORLD.floorY);
    ctx.drawImage(s.im, s.x, s.y, s.w, s.h);
  }
  ctx.restore();
  return true;
}

// soft contact shadows on the sand under the pair (the 3D picture has no floor of its own)
function drawFloorShadows(ctx, pose) {
  for (let i = 0; i < 2; i++) {
    const s = pose.s[i], f = i === 0 ? 1 : -1;
    const fe = Math.min(1, s.fall) * (s.fallDir < 0 ? -1 : 0.3);
    const cx = WORLD.cx - f * 57 + f * fe * 40, rx = 92 + Math.abs(fe) * 40;
    const g = ctx.createRadialGradient(cx, WORLD.floorY + 8, 4, cx, WORLD.floorY + 8, rx);
    g.addColorStop(0, 'rgba(36,20,8,0.42)'); g.addColorStop(1, 'rgba(36,20,8,0)');
    ctx.save(); ctx.translate(0, WORLD.floorY + 8); ctx.scale(1, 0.2); ctx.translate(0, -(WORLD.floorY + 8));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, WORLD.floorY + 8, rx, 0, TAU); ctx.fill(); ctx.restore();
  }
}

// rect: where the picture goes; o: { ring, t, pose, disp:[p,p], looks:[i,j], builds:[b,b], parts, pops, cheer, shake }
export function drawStage(ctx, rect, o) {
  const S = Math.min(rect.w / VIEW.w, rect.h / VIEW.h);
  const ox = rect.x + rect.w / 2 - WORLD.cx * S, oy = rect.y + rect.h - VIEW.bottom * S;
  const t = o.t ?? 0;
  const r = typeof o.ring === 'string' ? RING_BY_ID[o.ring] ?? RINGS[0] : o.ring;
  const f3 = globalThis.__figure3d;
  const live3d = !!(f3 && f3.draw && !f3.off && !f3.lost);
  const looks = o.looks ?? [0, 1], builds = o.builds ?? [1, 1];
  // the world and the wrestlers are ONE lit 3D picture when the presentation layer is up (sky, mountains, ring, crowd, pines, wrestlers);
  // otherwise: the baked still of the same 3D world (crowd and all) with the pre-rendered wrestlers, then the plain painted sky as the last resort.
  const bake = globalThis.__ringBackdrops && globalThis.__ringBackdrops[r.id];
  if (live3d || !bake) {
    const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
    g.addColorStop(0, r.sky[0]); g.addColorStop(0.7, r.sky[1]); g.addColorStop(1, r.sand[0]);
    ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const sk = (o.shake ?? 0) * 3;
  ctx.translate(ox + (sk ? Math.sin(t * 90) * sk : 0), oy);
  ctx.scale(S, S);
  let done = false;
  if (live3d) {
    const region = { x: (rect.x - ox) / S, y: (rect.y - oy) / S, w: rect.w / S, h: rect.h / S };
    done = f3.draw(ctx, region, o.pose, t, builds, [lookFor(looks[0], 0), lookFor(looks[1], 1)], r.id, o.cheer ?? 0);
    // the bake path wants the picture even while the 3D layer is still warming up: nothing else is drawn here
  }
  if (!done && !(f3 && f3.pending)) {
    if (bake) {
      const b = bake;
      ctx.drawImage(b.im, b.x, b.y, b.w, b.h);
      // a plain grounding strip below the baked picture if the screen shows more than it covers
      drawFloorShadows(ctx, o.pose);
    } else {
      drawScenery(ctx, o.ring, { x: (rect.x - ox) / S, y: (rect.y - oy) / S, w: rect.w / S, h: rect.h / S }, 1, 0, 0, t);
      drawRing(ctx, r, WORLD.cx, rect.w / S + 60, t);
      drawFloorShadows(ctx, o.pose);
    }
    done = drawSpritePair(ctx, o.pose);
    if (!done) drawWrestlers(ctx, rigFor(0, lookFor(looks[0], 0), builds[0], o.pose.s[0], t), rigFor(1, lookFor(looks[1], 1), builds[1], o.pose.s[1], t), t);
  }
  // dust and sparkle
  for (const q of o.parts ?? []) {
    const a = 1 - q.t / q.max;
    ctx.globalAlpha = Math.max(0, a);
    if (q.kind === 0) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 + (1 - a) * 1.4), 0, TAU); ctx.fill(); }
    else if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - a) + 8, 0, TAU); ctx.stroke(); }
    else { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.t * q.spin); ctx.fillStyle = q.col; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  for (const p of o.pops ?? []) {
    const a = clamp(p.t / p.max, 0, 1), up = 40 * a;
    ctx.save(); ctx.globalAlpha = a < 0.8 ? 1 : (1 - a) / 0.2; ctx.textAlign = 'center'; ctx.font = `italic 800 ${p.size}px ${FONT}`;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(40,16,8,0.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(p.text, p.x, p.y - up); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - up); ctx.restore();
  }
  ctx.restore();
  // soft vignette to seat the picture
  const vg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  vg.addColorStop(0, 'rgba(20,12,6,0.22)'); vg.addColorStop(0.2, 'rgba(20,12,6,0)'); vg.addColorStop(0.85, 'rgba(20,12,6,0)'); vg.addColorStop(1, 'rgba(20,12,6,0.3)');
  ctx.fillStyle = vg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  if (r.light < 1) { ctx.fillStyle = `rgba(8,10,40,${(1 - r.light) * 0.35})`; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  return { S, ox, oy };
}
// world point (design units) -> screen, for particles and pops placed by game.js
export function worldToRect(rect, wx, wy) {
  const S = Math.min(rect.w / VIEW.w, rect.h / VIEW.h);
  return { x: rect.x + rect.w / 2 + (wx - WORLD.cx) * S, y: rect.y + rect.h - VIEW.bottom * S + wy * S, S };
}

// ---- the balance disc ----------------------------------------------------------------------------------------------------
const PETAL = TAU / 8;
export function petalAt(cx, cy, r, x, y) {
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  if (d > r * 1.3 || d < r * 0.12) return -1;   // generous slop outside the rim: fingers are wider than the petals
  const a = Math.atan2(dx, -dy);                       // 0 = up (forward), clockwise
  return ((Math.round(a / PETAL) % 8) + 8) % 8;
}
// o: { p, who, active, sel, hint, moves:[{kind,dir,pow}], aim: 'send'|'resist', color, danger, label, trail, t, dim }
export function drawDisc(ctx, cx, cy, r, o) {
  const t = o.t ?? 0;
  ctx.save();
  // base: a carved walnut disc with a maple inlay and brass bands (a real wooden balance board, lit from the top left)
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.arc(cx + 2, cy + 8, r + 7, 0, TAU); ctx.fill();
  const wd = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); wd.addColorStop(0, '#8d5a30'); wd.addColorStop(0.5, '#5e3519'); wd.addColorStop(1, '#3d2210');
  ctx.fillStyle = wd; ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r + 5, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(20,8,2,0.28)'; ctx.lineWidth = 1;
  for (let k = -r; k < r; k += 5) { ctx.beginPath(); ctx.moveTo(cx - r - 6, cy + k); ctx.bezierCurveTo(cx - r * 0.3, cy + k + 5 * Math.sin(k), cx + r * 0.3, cy + k - 5 * Math.sin(k), cx + r + 6, cy + k + 2); ctx.stroke(); }
  ctx.restore();
  // brass band
  const br = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); br.addColorStop(0, '#f6dc8a'); br.addColorStop(0.5, '#b88a2c'); br.addColorStop(1, '#f2d27a');
  ctx.strokeStyle = br; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r + 0.5, 0, TAU); ctx.stroke();
  // maple inlay (raised: a bevel light and dark edge)
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#f6e2b6'); g.addColorStop(0.7, '#e3bf85'); g.addColorStop(1, '#c79a5c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r - 4, Math.PI * 0.95, Math.PI * 1.65); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,8,0.5)'; ctx.beginPath(); ctx.arc(cx, cy, r - 4, -Math.PI * 0.05, Math.PI * 0.6); ctx.stroke();
  // danger band
  const dg = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
  dg.addColorStop(0, 'rgba(190,40,30,0)'); dg.addColorStop(1, `rgba(190,40,30,${0.35 + (o.danger ? 0.2 * Math.sin(t * 9) : 0)})`);
  ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  // petals: the 8 directions, drawn as faint sectors; the active ones are lit
  for (let k = 0; k < 8; k++) {
    const a0 = k * PETAL - Math.PI / 2 - PETAL / 2, a1 = a0 + PETAL;
    const isSel = o.sel === k, isHint = o.hint === k;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 0.98, a0 + 0.015, a1 - 0.015); ctx.closePath();
    if (isSel) ctx.fillStyle = o.aim === 'resist' ? 'rgba(40,110,200,0.5)' : 'rgba(220,70,40,0.5)';
    else if (isHint) ctx.fillStyle = 'rgba(255,230,120,0.55)';
    else ctx.fillStyle = o.active ? 'rgba(255,250,235,0.20)' : 'rgba(255,250,235,0.06)';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(176,130,40,0.85)'; ctx.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) { const a = k * PETAL - Math.PI / 2 + PETAL / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.setLineDash([4, 5]); ctx.stroke(); ctx.setLineDash([]);
  // rim
  ctx.lineWidth = o.active ? 4 : 2; ctx.strokeStyle = o.active ? (o.aim === 'resist' ? '#2f6fcf' : '#d6452a') : '#7a5424';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  // forward marker
  ctx.fillStyle = '#5a3a1c'; ctx.beginPath(); ctx.moveTo(cx, cy - r - 12); ctx.lineTo(cx - 8, cy - r - 1); ctx.lineTo(cx + 8, cy - r - 1); ctx.closePath(); ctx.fill();
  // moves played this beat: arrows from the centre
  for (const m of o.moves ?? []) {
    if (!m) continue;
    const v = dirVec(m.dir), len = r * (0.3 + 0.2 * m.pow);
    arrow(ctx, cx, cy, cx + v.x * len, cy - v.y * len, m.kind === 'brace' ? '#2f6fcf' : m.kind === 'hook' ? '#8a3fc0' : '#d6452a', 3 + m.pow);
  }
  if (o.sel != null && o.sel >= 0 && !(o.moves && o.moves.length)) {
    const v = dirVec(o.sel), len = r * (0.35 + 0.18 * (o.pow ?? 1));
    arrow(ctx, cx, cy, cx + v.x * len, cy - v.y * len, o.aim === 'resist' ? '#2f6fcf' : '#d6452a', 4);
  }
  // the dot, with a short trail from where it was
  if (o.trail) {
    ctx.strokeStyle = 'rgba(30,20,10,0.35)'; ctx.lineWidth = r * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + o.trail.x * r, cy - o.trail.y * r); ctx.lineTo(cx + o.p.x * r, cy - o.p.y * r); ctx.stroke();
  }
  const m = norm(o.p), px = cx + o.p.x * r, py = cy - o.p.y * r, dr = r * 0.115;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(px + 2, py + 3, dr, 0, TAU); ctx.fill();
  const dg2 = ctx.createRadialGradient(px - dr * 0.3, py - dr * 0.35, 1, px, py, dr);
  dg2.addColorStop(0, '#ffffff'); dg2.addColorStop(0.35, o.color ?? '#c8312f'); dg2.addColorStop(1, '#2a1410');
  ctx.fillStyle = dg2; ctx.beginPath(); ctx.arc(px, py, dr, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#d9b04a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(px, py, dr + 0.5, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(px - dr * 0.3, py - dr * 0.35, dr * 0.25, dr * 0.16, -0.6, 0, TAU); ctx.fill();
  if (m > 0.8) { ctx.strokeStyle = `rgba(255,60,40,${0.6 + 0.4 * Math.sin(t * 12)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, dr + 5, 0, TAU); ctx.stroke(); }
  if (o.dim) { ctx.fillStyle = 'rgba(30,20,10,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col, w) {
  const a = Math.atan2(y1 - y0, x1 - x0), hl = w * 3.2;
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * hl * 0.6, y1 - Math.sin(a) * hl * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * hl, y1 - Math.sin(a - 0.45) * hl); ctx.lineTo(x1 - Math.cos(a + 0.45) * hl, y1 - Math.sin(a + 0.45) * hl); ctx.closePath(); ctx.fill();
  ctx.restore();
}
