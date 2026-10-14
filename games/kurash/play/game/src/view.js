// The Kurash picture: the round mat seen from above, two wrestlers in belt-grip, their balance points, the swing of a pull, throws and
// falls. Pure drawing from the bout state plus a small `pose` object that smooths the falls; no DOM, no clock.
//
// World units: the mat is centred on (500, 500) with radius 250. A wrestler's FEET stay at their stance (x = 500 -/+ 100); the upper body
// leans away from the feet by balance point * 84, so you can read the balance straight off the picture.
import { len } from './sim.js';

const TAU = Math.PI * 2;
const FIG = 1.22;          // the wrestlers are drawn this much larger than the mat's own scale
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export const WORLD = { cx: 500, cy: 500, R: 250, disp: 84, home: 100 };
// When the 3D presenter is running it hands the game a projection (`proj(x, y, h)`: sim units + metres of height -> stage units) through the
// render view; drawStage then paints only the overlays (balance rings, arrows, dust, pops) on top of the 3D scene.
export const R3 = { p3: null };
// Pre-rendered pictures of the same 3D wrestlers (side view) for the flat fallback when WebGL2 is not available:
// k0 = blue, k1 = green; `stand` reaches for the rival's sash, `fall` lies on the back (blue head left, green head right).
export const SPR = { k0: null, k1: null, ready: false };
export function setSprites(o) { SPR.k0 = o.k0; SPR.k1 = o.k1; SPR.ready = !!(o.k0 && o.k1 && o.k0.stand && o.k0.fall && o.k1.stand && o.k1.fall); }
const SQ = 0.5;       // the mat is drawn foreshortened in the flat fallback

export const VENUES = [
  { id: 'courtyard', name: 'Registan Courtyard', blurb: 'Sunlit turquoise tile and a warm stone floor' },
  { id: 'hall', name: 'Chorsu Hall', blurb: 'Carved wood, lanterns and the evening glow' },
  { id: 'arena', name: 'Grand Arena', blurb: 'Spotlit mat, banners and a roaring crowd' },
];
export const VENUE_BY_ID = Object.fromEntries(VENUES.map((v) => [v.id, v]));

// Wrestlers look different from each other (skin, hair); the jacket is blue for side 0 and green for side 1, as on a real mat.
export const LOOKS = [
  { name: 'You', skin: '#d9a273', skin2: '#b97f52', hair: '#1c1410', kit: '#2b63c9', kit2: '#183b86', belt: '#f2c14e', hairStyle: 0 },
  { name: 'Bobur', skin: '#e3b48a', skin2: '#c18e63', hair: '#2a1b12', kit: '#1f9a62', kit2: '#0f6a41', belt: '#f2c14e', hairStyle: 1 },
  { name: 'Dilnoza', skin: '#c68b5c', skin2: '#a26b40', hair: '#120c09', kit: '#1f9a62', kit2: '#0f6a41', belt: '#f2c14e', hairStyle: 2 },
  { name: 'Rustam', skin: '#e8c19b', skin2: '#c89a70', hair: '#5a3a20', kit: '#1f9a62', kit2: '#0f6a41', belt: '#f2c14e', hairStyle: 0 },
  { name: 'Malika', skin: '#b87a4c', skin2: '#946037', hair: '#0e0a08', kit: '#1f9a62', kit2: '#0f6a41', belt: '#f2c14e', hairStyle: 2 },
  { name: 'Sardor', skin: '#caa078', skin2: '#a87c55', hair: '#201610', kit: '#1f9a62', kit2: '#0f6a41', belt: '#f2c14e', hairStyle: 3 },
];
export const lookFor = (side, idx) => {
  const L = LOOKS[idx % LOOKS.length];
  return side === 0 ? { ...L, kit: '#2b63c9', kit2: '#183b86' } : { ...L, kit: '#1f9a62', kit2: '#0f6a41' };
};

export function newPose() {
  return { t: 0, lastKey: -1, since: 9, fall: [0, 0], fdir: [{ x: 1, y: 0 }, { x: -1, y: 0 }], thr: [0, 0], tdir: [{ x: 1, y: 0 }, { x: -1, y: 0 }], loser: -1, flash: 0 };
}

export function stepPose(pose, B, dt, over) {
  pose.t += dt;
  const last = B.last;
  if (last && last.t !== pose.lastKey) { pose.lastKey = last.t; pose.since = 0; pose.loser = last.how === 'throw' ? 1 - last.side : -1; pose.flash = 1; if (last.how === 'throw') pose.fdir[1 - last.side] = { x: last.dx, y: last.dy }; }
  pose.since += dt;
  pose.flash = Math.max(0, pose.flash - dt * 1.4);
  for (let i = 0; i < 2; i++) {
    let f = 0;
    if (pose.loser === i) {
      const e = pose.since;
      f = e < 0.22 ? ease(e / 0.22) : over ? 1 : e < 0.95 ? 1 : clamp(1 - (e - 0.95) / 0.55, 0, 1);
      if (!over && !B.last) f = 0;
    }
    pose.fall[i] = f;
    const s = B.side[i];
    if (s.wind) { pose.thr[i] = clamp(1 - s.wind.t / 0.28, 0, 1); pose.tdir[i] = { x: s.wind.dx, y: s.wind.dy }; }
    else if (last && last.how === 'throw' && last.side === i && pose.since < 0.5) pose.thr[i] = clamp(1 - pose.since / 0.5, 0, 1);
    else pose.thr[i] = Math.max(0, pose.thr[i] - dt * 4);
  }
}

// ---- the room -------------------------------------------------------------------------------------------------------------
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let k = 0; k < 16; k++) {
    const a = (k * TAU) / 16 - Math.PI / 2, rr = k % 2 ? r * 0.56 : r;
    if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawRoom(ctx, r, venue, t, sc, ox, oy) {
  const id = venue;
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  if (id === 'hall') {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#2a1710'); g.addColorStop(1, '#4a2916');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    // parquet planks
    const pw = 70 * sc;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5;
    for (let x = r.x - ((r.x - ox) % pw) - pw; x < r.x + r.w + pw; x += pw) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
    for (let k = 0; k < 14; k++) {
      const y = r.y + ((k * 0.17 + 0.07) % 1) * r.h;
      ctx.fillStyle = `rgba(${k % 2 ? '255,190,120' : '0,0,0'},0.05)`; ctx.fillRect(r.x, y, r.w, 18 * sc);
    }
  } else if (id === 'arena') {
    const g = ctx.createRadialGradient(ox, oy, 40, ox, oy, Math.max(r.w, r.h) * 0.75);
    g.addColorStop(0, '#1a2c6a'); g.addColorStop(0.6, '#0b1538'); g.addColorStop(1, '#050a1c');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    // crowd: tight rows of heads and shoulders in the dark around the mat
    for (let ring = 0; ring < 5; ring++) {
      const rr = (WORLD.R + 120 + ring * 46) * sc, n = Math.max(24, Math.round((TAU * rr) / (30 * sc)));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + ring * 0.37;
        const x = ox + Math.cos(a) * rr, y = oy + Math.sin(a) * rr;
        if (x < r.x - 30 || x > r.x + r.w + 30 || y < r.y - 30 || y > r.y + r.h + 30) continue;
        const bob = Math.sin(t * 3 + k * 1.7 + ring) * 2.2 * sc * (0.5 + (k % 3) * 0.3);
        const hue = (k * 53 + ring * 29) % 360;
        ctx.fillStyle = `hsl(${hue} 32% ${20 + ring * 2}%)`;
        ctx.beginPath(); ctx.ellipse(x, y + bob + 9 * sc, 15 * sc, 11 * sc, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(${20 + (k * 7) % 25} 38% ${30 + ring * 3}%)`;
        ctx.beginPath(); ctx.arc(x, y + bob, 9 * sc, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsl(${(k * 13) % 40} 30% ${10 + (k % 4) * 4}%)`;
        ctx.beginPath(); ctx.arc(x, y + bob - 2 * sc, 8.5 * sc, Math.PI, TAU); ctx.fill();
      }
    }
  } else {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#1d7f93'); g.addColorStop(1, '#0e4a63');
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    // tile lattice of eight-pointed stars
    const cell = 150 * sc;
    ctx.lineWidth = Math.max(1, 2 * sc);
    const x0 = ox - Math.ceil((ox - r.x) / cell) * cell - cell, y0 = oy - Math.ceil((oy - r.y) / cell) * cell - cell;
    for (let y = y0; y < r.y + r.h + cell; y += cell) {
      for (let x = x0; x < r.x + r.w + cell; x += cell) {
        const odd = (Math.round((x - ox) / cell) + Math.round((y - oy) / cell)) % 2 !== 0;
        ctx.fillStyle = odd ? 'rgba(255,224,150,0.10)' : 'rgba(5,40,60,0.18)';
        star(ctx, x, y, cell * 0.46); ctx.fill();
        ctx.strokeStyle = 'rgba(255,226,160,0.28)'; star(ctx, x, y, cell * 0.46); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.arc(x, y, cell * 0.16, 0, TAU); ctx.stroke();
      }
    }
    const vg = ctx.createRadialGradient(ox, oy, 100 * sc, ox, oy, Math.max(r.w, r.h) * 0.8);
    vg.addColorStop(0, 'rgba(255,240,200,0.16)'); vg.addColorStop(1, 'rgba(0,10,30,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.restore();
}

function drawMat(ctx, ox, oy, sc, o) {
  const R = WORLD.R * sc;
  // soft shadow and the outer apron (blue), the yellow danger ring, the green contest circle
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(ox + 6 * sc, oy + 14 * sc, R * 1.1, R * 1.08, 0, 0, TAU); ctx.fill();
  let g = ctx.createRadialGradient(ox - R * 0.3, oy - R * 0.4, R * 0.1, ox, oy, R * 1.1);
  g.addColorStop(0, '#2f56b8'); g.addColorStop(1, '#16296b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 1.09, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.stroke();
  g = ctx.createRadialGradient(ox, oy, R * 0.6, ox, oy, R * 0.96);
  g.addColorStop(0, '#f6cf55'); g.addColorStop(1, '#d9a21e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 0.97, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(ox - R * 0.25, oy - R * 0.3, R * 0.05, ox, oy, R * 0.82);
  g.addColorStop(0, '#3fb27c'); g.addColorStop(0.7, '#1f8a5d'); g.addColorStop(1, '#16724c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, R * 0.8, 0, TAU); ctx.fill();
  // mat texture: faint concentric rings and the centre mark
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = Math.max(1, 2 * sc);
  for (const k of [0.25, 0.5, 0.68]) { ctx.beginPath(); ctx.arc(ox, oy, R * k, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = Math.max(1.5, 3 * sc);
  ctx.beginPath(); ctx.arc(ox, oy, R * 0.8, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.arc(ox, oy, 9 * sc, 0, TAU); ctx.fill();
  // the two stance marks
  for (const sx of [-1, 1]) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([6 * sc, 7 * sc]); ctx.lineWidth = Math.max(1.5, 2.4 * sc);
    ctx.beginPath(); ctx.arc(ox + sx * WORLD.home * sc, oy, WORLD.disp * sc, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  void o;
}

// ---- a wrestler seen from above ---------------------------------------------------------------------------------------------
function limb(ctx, x0, y0, x1, y1, bend, w, col, col2) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / d) * bend, cy = my + (dx / d) * bend;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = col2; ctx.lineWidth = w + 3;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
}

function figure(ctx, f) {
  // f: { feet:{x,y}, up:{x,y} (upper body centre), face:{x,y} unit, look, sc, fall, fdir, thr, tdir, hands:[{x,y},{x,y}] , t, danger }
  const { sc, look, face } = f;
  const per = { x: -face.y, y: face.x };
  const up = f.up, ft = f.feet;
  ctx.save();
  // shadow
  const fl = f.fall;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(lerp(ft.x, up.x, 0.6) + 5 * sc, lerp(ft.y, up.y, 0.6) + 9 * sc, 66 * sc * (1 + fl * 0.7), 54 * sc, 0, 0, TAU); ctx.fill();

  if (fl < 0.02) {
    // feet stay at the stance: one forward, one back
    for (const s of [-1, 1]) {
      const fx = ft.x + face.x * (s > 0 ? 24 : -14) * sc + per.x * s * 30 * sc, fy = ft.y + face.y * (s > 0 ? 24 : -14) * sc + per.y * s * 30 * sc;
      ctx.fillStyle = '#16121a';
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.atan2(face.y, face.x)); ctx.beginPath(); ctx.ellipse(0, 0, 21 * sc, 11 * sc, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    // a short bit of trouser between feet and body, so a lean reads as a lean
    const sx = (ft.x + up.x) / 2, sy = (ft.y + up.y) / 2;
    ctx.fillStyle = '#e9e2cf'; ctx.beginPath(); ctx.ellipse(sx, sy, 38 * sc, 34 * sc, Math.atan2(face.y, face.x), 0, TAU); ctx.fill();
  }

  const ang = Math.atan2(face.y, face.x);
  // arms first (behind the body): from the shoulders toward the rival's belt
  const sh = [{ x: up.x + per.x * 50 * sc, y: up.y + per.y * 50 * sc }, { x: up.x - per.x * 50 * sc, y: up.y - per.y * 50 * sc }];
  const fallDir = f.fdir;
  for (let k = 0; k < 2; k++) {
    let hx = f.hands[k].x, hy = f.hands[k].y;
    if (fl > 0) {
      // arms flop out to the sides when thrown
      const sgn = k === 0 ? 1 : -1;
      hx = lerp(hx, up.x + per.x * sgn * 80 * sc + fallDir.x * 40 * fl * sc, ease(fl)); hy = lerp(hy, up.y + per.y * sgn * 80 * sc + fallDir.y * 40 * fl * sc, ease(fl));
    }
    limb(ctx, sh[k].x, sh[k].y, hx, hy, 12 * sc, 25 * sc, look.kit, look.kit2);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(hx, hy, 10 * sc, 0, TAU); ctx.fill();
  }

  if (fl > 0.02) {
    // lying on the back, head toward the way they were thrown, feet toward the thrower
    const e = ease(fl), d = fallDir, dp = { x: -d.y, y: d.x };
    const C = { x: up.x + d.x * 70 * e * sc, y: up.y + d.y * 70 * e * sc };
    ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(Math.atan2(d.y, d.x));
    for (const s of [-1, 1]) {
      limb(ctx, -34 * sc, s * 14 * sc, -112 * sc, s * (16 + 12 * e) * sc, s * 6 * sc, 24 * sc, '#ece4cf', '#bdb39a');
      ctx.fillStyle = '#16121a'; ctx.beginPath(); ctx.ellipse(-120 * sc, s * (18 + 12 * e) * sc, 14 * sc, 10 * sc, 0, 0, TAU); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -48 * sc, 0, 48 * sc); g.addColorStop(0, look.kit); g.addColorStop(1, look.kit2);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 50 * sc, 44 * sc, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = look.belt; ctx.fillRect(-26 * sc, -42 * sc, 12 * sc, 84 * sc);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(60 * sc, 0, 22 * sc, 0, TAU); ctx.fill();
    ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(66 * sc, 0, 20 * sc, -1.5, 1.5, false); ctx.fill();
    ctx.restore();
    void dp;
  } else {
    // upper body, seen from above: shoulders, sleeve caps, the belt wrapped at the front and the head with its hair
    ctx.save(); ctx.translate(up.x, up.y); ctx.rotate(ang);
    const g = ctx.createLinearGradient(-30 * sc, -56 * sc, 20 * sc, 56 * sc); g.addColorStop(0, look.kit); g.addColorStop(1, look.kit2);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(-30 * sc, -54 * sc, 60 * sc, 108 * sc, 28 * sc); ctx.fill();
    ctx.strokeStyle = look.kit2; ctx.lineWidth = 2.5 * sc; ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.kit; ctx.beginPath(); ctx.arc(0, s * 50 * sc, 17 * sc, 0, TAU); ctx.fill();
      ctx.strokeStyle = look.kit2; ctx.lineWidth = 2 * sc; ctx.stroke();
    }
    // the jacket's overlap and back seam
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2 * sc;
    ctx.beginPath(); ctx.moveTo(-28 * sc, 0); ctx.lineTo(-6 * sc, 0); ctx.moveTo(8 * sc, -40 * sc); ctx.quadraticCurveTo(-4 * sc, -4 * sc, 14 * sc, 38 * sc); ctx.stroke();
    // belt
    ctx.fillStyle = look.belt; ctx.beginPath(); ctx.roundRect(10 * sc, -50 * sc, 13 * sc, 100 * sc, 5 * sc); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1.5 * sc; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(22 * sc, 6 * sc, 8 * sc, 12 * sc, 0, 0, TAU); ctx.fillStyle = look.belt; ctx.fill(); ctx.stroke();
    // head: ears, the skin of the face at the front, hair over the rest
    ctx.fillStyle = look.skin2;
    ctx.beginPath(); ctx.ellipse(-3 * sc, -22 * sc, 5 * sc, 7 * sc, 0, 0, TAU); ctx.ellipse(-3 * sc, 22 * sc, 5 * sc, 7 * sc, 0, 0, TAU); ctx.fill();
    const hg = ctx.createRadialGradient(2 * sc, -4 * sc, 2 * sc, 0, 0, 26 * sc); hg.addColorStop(0, look.skin); hg.addColorStop(1, look.skin2);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(0, 0, 22 * sc, 0, TAU); ctx.fill();
    ctx.fillStyle = look.hair;
    if (look.hairStyle === 2) {
      ctx.beginPath(); ctx.arc(-4 * sc, 0, 22 * sc, Math.PI * 0.42, Math.PI * 1.58); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-30 * sc, 4 * sc, 15 * sc, 8 * sc, 0.2, 0, TAU); ctx.fill();
    } else if (look.hairStyle === 3) {
      ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(-3 * sc, 0, 21 * sc, Math.PI * 0.5, Math.PI * 1.5); ctx.fill(); ctx.globalAlpha = 1;
    } else if (look.hairStyle === 1) {
      ctx.beginPath(); ctx.arc(-2 * sc, 0, 22 * sc, Math.PI * 0.32, Math.PI * 1.68); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8 * sc, -8 * sc, 8 * sc, 5 * sc, 0.5, 0, TAU); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-3 * sc, 0, 22 * sc, Math.PI * 0.36, Math.PI * 1.64); ctx.fill();
    }
    // nose tip
    ctx.fillStyle = look.skin2; ctx.beginPath(); ctx.ellipse(21 * sc, 0, 4 * sc, 3.2 * sc, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // a pulse on the ring under the feet when close to falling
  void f.danger;
  ctx.restore();
}

// ---- the whole stage -----------------------------------------------------------------------------------------------------
// rect: where to draw; o: { venue, t, B, pose, looks (indices), parts, pops, hint: {side, x, y}|null, cheer, focusY }
export function drawStage(ctx, rect, o) {
  const p3 = o.flat ? null : R3.p3;
  if (p3) { drawOverlays3D(ctx, rect, o, p3); return; }
  const { B, pose, t } = o;
  const sc = Math.min(rect.w, rect.h) / (WORLD.R * 2.4);
  const ox = rect.x + rect.w / 2, oy = rect.y + rect.h * (o.focusY ?? 0.5);
  drawRoom(ctx, rect, o.venue, t, sc, ox, oy);
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const side = SPR.ready;
  if (side) { ctx.save(); ctx.translate(ox, oy); ctx.scale(1, SQ); ctx.translate(-ox, -oy); }
  drawMat(ctx, ox, oy, sc, o);
  const W = (x, y) => ({ x: ox + (x - WORLD.cx) * sc, y: oy + (y - WORLD.cy) * sc });

  const homes = [W(WORLD.cx - WORLD.home, WORLD.cy), W(WORLD.cx + WORLD.home, WORLD.cy)];
  const ups = [0, 1].map((i) => {
    const b = B.side[i].b;
    const thrust = pose.thr[i] * 38 * sc;
    const td = pose.tdir[i];
    const fl = pose.fall[i], fd = pose.fdir[i];
    return {
      x: homes[i].x + b.x * WORLD.disp * sc + td.x * thrust - fd.x * 0 * fl,
      y: homes[i].y + b.y * WORLD.disp * sc + td.y * thrust,
    };
  });
  // balance rings under each wrestler: the disc the balance point lives in
  for (let i = 0; i < 2; i++) {
    const s = B.side[i], r = len(s.b);
    const danger = clamp((r - 0.55) / 0.45, 0, 1);
    ctx.save();
    ctx.lineWidth = Math.max(2, 4 * sc);
    ctx.strokeStyle = danger > 0 ? `rgba(255,${Math.round(210 - 140 * danger)},${Math.round(90 - 40 * danger)},${0.4 + 0.5 * danger})` : 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.arc(homes[i].x, homes[i].y, WORLD.disp * sc, 0, TAU); ctx.stroke();
    // the dot: where the weight is
    ctx.fillStyle = danger > 0.5 ? '#ff8a5c' : '#fff3b0';
    ctx.beginPath(); ctx.arc(homes[i].x + s.b.x * WORLD.disp * sc, homes[i].y + s.b.y * WORLD.disp * sc, Math.max(4, 7 * sc), 0, TAU); ctx.fill();
    ctx.restore();
  }
  // throw wind-up arrows
  for (let i = 0; i < 2; i++) {
    const s = B.side[i];
    if (!s.wind) continue;
    const p = pose.thr[i], rv = ups[1 - i], d = { x: s.wind.dx, y: s.wind.dy };
    ctx.save();
    ctx.strokeStyle = `rgba(255,226,120,${0.4 + 0.5 * p})`; ctx.lineWidth = Math.max(4, 9 * sc); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(rv.x, rv.y); ctx.lineTo(rv.x + d.x * 120 * sc * (0.4 + p), rv.y + d.y * 120 * sc * (0.4 + p)); ctx.stroke();
    ctx.restore();
  }
  if (side) {
    ctx.restore();
    drawSprites(ctx, o, sc, ox, oy, homes, ups);
  }
  // the two figures; the one being thrown is drawn underneath
  const order = pose.fall[0] > pose.fall[1] ? [0, 1] : [1, 0];
  for (const i of side ? [] : order) {
    const j = 1 - i;
    const face = { x: i === 0 ? 1 : -1, y: 0 };
    const per = { x: 0, y: 1 };
    const rv = ups[j];
    const toward = { x: i === 0 ? -1 : 1, y: 0 };      // from the rival's belt back toward me
    const hands = [1, -1].map((s) => ({ x: rv.x + toward.x * 24 * sc * FIG + per.x * s * 52 * sc * FIG, y: rv.y + toward.y * 24 * sc * FIG + per.y * s * 52 * sc * FIG }));
    figure(ctx, {
      feet: homes[i], up: ups[i], face, look: lookFor(i, o.looks[i]), sc: sc * FIG, fall: pose.fall[i], fdir: pose.fdir[i], thr: pose.thr[i], tdir: pose.tdir[i],
      hands, t, danger: len(B.side[i].b),
    });
  }
  // the plan arrow of Think and Watch & Learn: drawn from the rival, the way the thumb should go
  if (o.hint && o.hint.dir) {
    const from = ups[1 - o.hint.side], d = o.hint.dir;
    const L = (o.hint.throw ? 150 : 130) * sc, wob = 1 + 0.06 * Math.sin(t * 7);
    ctx.save();
    ctx.strokeStyle = o.hint.throw ? '#ffe27a' : '#9be8ff'; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = Math.max(5, 11 * sc); ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8;
    const tx = from.x + d.x * L * wob, ty = from.y + d.y * L * wob;
    ctx.beginPath(); ctx.moveTo(from.x + d.x * 30 * sc, from.y + d.y * 30 * sc); ctx.lineTo(tx, ty); ctx.stroke();
    const a = Math.atan2(d.y, d.x), h = 26 * sc;
    ctx.beginPath(); ctx.moveTo(tx + Math.cos(a) * h, ty + Math.sin(a) * h); ctx.lineTo(tx + Math.cos(a + 2.5) * h, ty + Math.sin(a + 2.5) * h); ctx.lineTo(tx + Math.cos(a - 2.5) * h, ty + Math.sin(a - 2.5) * h); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // particles and pops (world units)
  for (const q of o.parts || []) {
    const p = W(q.x, q.y), a = 1 - q.t / q.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, 5 * sc); ctx.beginPath(); ctx.arc(p.x, p.y, (q.size * (0.3 + 0.7 * (q.t / q.max))) * sc, 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) { ctx.fillStyle = q.col; ctx.translate(p.x, p.y); ctx.rotate(q.t * q.spin); ctx.fillRect(-4 * sc - 1, -2 * sc - 1, 8 * sc + 2, 4 * sc + 2); }
    else { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, q.size * sc), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  for (const p of o.pops || []) {
    const q = W(p.x, p.y), u = p.t / p.max;
    ctx.save(); ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.max(16, p.size * sc * 1.9) * (0.85 + 0.25 * Math.min(1, u * 6));
    ctx.font = `italic 800 ${Math.round(size)}px 'Iowan Old Style','Palatino Linotype',Georgia,serif`;
    { const mw = ctx.measureText(p.text).width, lim = rect.w * 0.9; if (mw > lim) { size = Math.max(12, size * lim / mw); ctx.font = `italic 800 ${Math.round(size)}px 'Iowan Old Style','Palatino Linotype',Georgia,serif`; } }
    ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = 'rgba(8,16,48,0.85)'; ctx.lineJoin = 'round';
    const y = q.y - u * 46 * sc;
    const hw = ctx.measureText(p.text).width / 2 + ctx.lineWidth, px = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, q.x));
    ctx.strokeText(p.text, px, y); ctx.fillStyle = p.col; ctx.fillText(p.text, px, y);
    ctx.restore();
  }
  // a flash of the mat when something scores
  if (pose.flash > 0) { ctx.fillStyle = `rgba(255,240,180,${0.18 * pose.flash})`; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  ctx.restore();
}

// Arrow glyph of a drag direction inside a small disc (compass for the pad and the Rules art).
export function drawCompass(ctx, cx, cy, r, vec, opt = {}) {
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(44,90,170,0.55)'); g.addColorStop(1, 'rgba(10,24,70,0.8)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(190,215,255,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(190,215,255,0.22)'; ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.stroke();
  const m = Math.hypot(vec.x, vec.y);
  if (m > 0.05) {
    const x = cx + vec.x * r * 0.86, y = cy + vec.y * r * 0.86;
    ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = Math.max(3, r * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, Math.max(5, r * 0.12), 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(3, r * 0.06), 0, TAU); ctx.fill();
  void opt;
  ctx.restore();
}

// ---- the overlays of the 3D scene -------------------------------------------------------------------------------------------
function ringPath(ctx, p3, cx, cy, r, n = 40) {
  ctx.beginPath();
  for (let k = 0; k <= n; k++) { const a = (k / n) * TAU, q = p3.proj(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.01); k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }
}
function drawOverlays3D(ctx, rect, o, p3) {
  const { B, pose, t } = o;
  const sc = Math.max(0.5, p3.k * 2.3);                 // overlay line widths and dots scale with the picture
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  const homes = [{ x: WORLD.cx - WORLD.home, y: WORLD.cy }, { x: WORLD.cx + WORLD.home, y: WORLD.cy }];
  const ups = [0, 1].map((i) => {
    const b = B.side[i].b, td = pose.tdir[i], th = pose.thr[i] * 38;
    return { x: homes[i].x + b.x * WORLD.disp + td.x * th, y: homes[i].y + b.y * WORLD.disp + td.y * th };
  });
  // balance rings on the mat under each wrestler, with the dot where the weight is
  for (let i = 0; i < 2; i++) {
    const s = B.side[i], r = len(s.b);
    const danger = clamp((r - 0.55) / 0.45, 0, 1);
    ctx.save();
    ctx.lineWidth = Math.max(2, 3.2 * sc);
    ctx.setLineDash([Math.max(5, 9 * sc), Math.max(4, 7 * sc)]);
    ctx.strokeStyle = danger > 0 ? `rgba(255,${Math.round(210 - 140 * danger)},${Math.round(90 - 40 * danger)},${0.55 + 0.4 * danger})` : 'rgba(255,255,255,0.5)';
    ringPath(ctx, p3, homes[i].x, homes[i].y, WORLD.disp); ctx.stroke();
    ctx.setLineDash([]);
    const d = p3.proj(homes[i].x + s.b.x * WORLD.disp, homes[i].y + s.b.y * WORLD.disp, 0.01);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(d.x + 1.5, d.y + 2, Math.max(5, 8.5 * sc), Math.max(3, 5 * sc), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = danger > 0.5 ? '#ff8a5c' : '#fff3b0';
    ctx.beginPath(); ctx.ellipse(d.x, d.y, Math.max(5, 8 * sc), Math.max(3, 4.8 * sc), 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  const arrow = (from, d, L, col, w) => {
    const a = p3.proj(from.x + d.x * 36, from.y + d.y * 36, 0.02), b = p3.proj(from.x + d.x * L, from.y + d.y * L, 0.02);
    ctx.save();
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const ang = Math.atan2(b.y - a.y, b.x - a.x), h = w * 2.6;
    ctx.beginPath(); ctx.moveTo(b.x + Math.cos(ang) * h, b.y + Math.sin(ang) * h); ctx.lineTo(b.x + Math.cos(ang + 2.5) * h, b.y + Math.sin(ang + 2.5) * h); ctx.lineTo(b.x + Math.cos(ang - 2.5) * h, b.y + Math.sin(ang - 2.5) * h); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 2; i++) {
    const s = B.side[i];
    if (!s.wind) continue;
    const p = pose.thr[i];
    arrow(ups[1 - i], { x: s.wind.dx, y: s.wind.dy }, 120 * (0.4 + p), `rgba(255,226,120,${0.45 + 0.5 * p})`, Math.max(4, 8 * sc));
  }
  if (o.hint && o.hint.dir) {
    const wob = 1 + 0.06 * Math.sin(t * 7);
    arrow(ups[1 - o.hint.side], o.hint.dir, (o.hint.throw ? 150 : 130) * wob, o.hint.throw ? '#ffe27a' : '#9be8ff', Math.max(5, 9 * sc));
  }
  for (const q of o.parts || []) {
    const p = p3.proj(q.x, q.y, 0.15), a = 1 - q.t / q.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, a);
    if (q.kind === 2) { ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(2, 4 * sc); ringPath(ctx, p3, q.x, q.y, Math.max(8, q.size * (0.3 + 0.7 * (q.t / q.max)))); ctx.stroke(); }
    else if (q.kind === 3) { ctx.fillStyle = q.col; ctx.translate(p.x, p.y); ctx.rotate(q.t * q.spin); ctx.fillRect(-3.5 * sc - 1, -2 * sc - 1, 7 * sc + 2, 4 * sc + 2); }
    else { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, q.size * sc * 0.7), 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  for (const p of o.pops || []) {
    const q = p3.proj(p.x, p.y, 1.5), u = p.t / p.max;
    ctx.save(); ctx.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = Math.max(18, p.size * sc * 1.1) * (0.85 + 0.25 * Math.min(1, u * 6));
    ctx.font = `italic 800 ${Math.round(size)}px 'Iowan Old Style','Palatino Linotype',Georgia,serif`;
    { const mw = ctx.measureText(p.text).width, lim = rect.w * 0.9; if (mw > lim) { size = Math.max(12, size * lim / mw); ctx.font = `italic 800 ${Math.round(size)}px 'Iowan Old Style','Palatino Linotype',Georgia,serif`; } }
    ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = 'rgba(8,16,48,0.85)'; ctx.lineJoin = 'round';
    const y = q.y - u * 46 * sc;
    const hw = ctx.measureText(p.text).width / 2 + ctx.lineWidth, px = Math.min(rect.x + rect.w - hw, Math.max(rect.x + hw, q.x));
    ctx.strokeText(p.text, px, y); ctx.fillStyle = p.col; ctx.fillText(p.text, px, y);
    ctx.restore();
  }
  if (pose.flash > 0) { ctx.fillStyle = `rgba(255,240,180,${0.14 * pose.flash})`; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  ctx.restore();
}

// the flat fallback: pre-rendered side views of the wrestlers on the foreshortened mat
function drawSprites(ctx, o, sc, ox, oy, homes, ups) {
  const { B, pose } = o;
  const size = 190 * sc * 1.5, k = size / 512;
  const groundRow = 472;
  const order = pose.fall[0] > pose.fall[1] ? [0, 1] : [1, 0];
  for (const i of order) {
    const set = i === 0 ? SPR.k0 : SPR.k1;
    const fl = pose.fall[i];
    const fx = homes[i].x, fy = oy + (homes[i].y - oy) * 1;      // homes are already in stage units (top-down); foreshorten y about the mat centre
    const gy = oy + (fy - oy) * SQ + (B.side[i].b.y * WORLD.disp * sc * SQ) + size * 0.02;
    ctx.save();
    // soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(fx + B.side[i].b.x * 20 * sc, gy, size * (fl > 0.5 ? 0.3 : 0.17), size * 0.045, 0, 0, TAU); ctx.fill();
    if (fl > 0.5) {
      const headRight = pose.fdir[i].x >= 0, defRight = i === 1;
      const ax = i === 0 ? 363 : 149;
      ctx.translate(fx, gy);
      if (headRight !== defRight) ctx.scale(-1, 1);
      ctx.drawImage(set.fall, -ax * k, -groundRow * k, size, size);
    } else {
      const lean = clamp(B.side[i].b.x, -1, 1) * 0.3 * (i === 0 ? 1 : 1);
      const fwd = pose.thr[i] * pose.tdir[i].x * 22 * sc;
      const sy = 1 + 0.1 * B.side[i].b.y;
      ctx.translate(fx + fwd, gy); ctx.rotate(lean); ctx.scale(sy, sy);
      ctx.drawImage(set.stand, -256 * k, -groundRow * k, size, size);
    }
    ctx.restore();
  }
  void ups;
}
