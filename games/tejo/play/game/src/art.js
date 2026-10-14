// All the drawing for Tejo: the dusk court, the clay box, the brass ring, paper mechas, steel discs, confetti and the rules diagrams.
// Pure canvas 2D, no DOM. Board drawing works in one place: R = { x, y, s } where (x, y) is the top-left of the clay and s = pixels per cm.
import { BOX, RING, DISC_R, MECHA, mecha } from './sim.js';
import { roundPath, FONT, NUM } from './ui.js';

export const TEAM = [
  { name: 'Gold', main: '#f4b92e', dark: '#9c6406', light: '#ffe28a' },
  { name: 'Blue', main: '#3d78ff', dark: '#15338a', light: '#b2caff' },
];
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const FLAG = ['#f7c600', '#1f4fb8', '#d3272f'];
export const P = (R, u, v) => ({ x: R.x + u * R.s, y: R.y + (BOX - v) * R.s });
// Pictures of the real 3D objects (rendered once by the 3D presenter): used by the HUD discs and the rules diagrams. Empty without WebGL.
export const sprites = { ready: false, disc: [null, null], box: null, boxBare: null, boxSpan: 1.3, discSpan: 0.76 };

const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops, x1 = x, y1 = y) => { const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

// ---- the court: sky, mountains, bunting, ground and lane --------------------------------------------------------------------
// g = { horizon, ground, laneHalf, cx } in screen units: horizon = where the far hills end, ground = top of the lane (bottom of the box frame).
export function drawBackdrop(ctx, w, h, t, g) {
  ctx.fillStyle = grad(ctx, 0, 0, 0, g.horizon, [[0, '#120d36'], [0.45, '#3a1c66'], [0.8, '#b8467a'], [1, '#ff9d5c']]);
  ctx.fillRect(0, 0, w, g.horizon + 2);
  // low sun glow
  ctx.fillStyle = rgrad(ctx, w * 0.7, g.horizon, 0, w * 0.7, [[0, 'rgba(255,214,120,0.85)'], [0.35, 'rgba(255,150,90,0.35)'], [1, 'rgba(255,120,80,0)']]);
  ctx.fillRect(0, 0, w, g.horizon + 2);
  // stars
  for (let i = 0; i < 38; i++) {
    const x = hash(i * 3.1) * w, y = hash(i * 7.7) * g.horizon * 0.55, tw = 0.5 + 0.5 * Math.sin(t * 1.3 + i);
    ctx.fillStyle = `rgba(255,244,214,${0.25 + 0.5 * tw * hash(i + 9)})`; ctx.fillRect(x, y, 2, 2);
  }
  // three ridges
  const ridge = (base, amp, f, ph, col) => {
    ctx.beginPath(); ctx.moveTo(0, g.horizon + 4);
    for (let x = 0; x <= w + 20; x += 20) ctx.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x * f + ph)) - amp * 0.45 * Math.sin(x * f * 2.3 + ph * 1.7));
    ctx.lineTo(w, g.horizon + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  const hh = Math.max(120, g.horizon * 0.5);
  ridge(g.horizon - hh * 0.35, hh * 0.35, 0.006, 1.2, '#7a3f86');
  ridge(g.horizon - hh * 0.12, hh * 0.3, 0.009, 4.1, '#4d2a70');
  ridge(g.horizon + 6, hh * 0.22, 0.014, 2.3, '#2b1b4c');
  // far field and ground
  ctx.fillStyle = grad(ctx, 0, g.horizon, 0, h, [[0, '#2c2036'], [0.25, '#3a2830'], [1, '#1d1420']]);
  ctx.fillRect(0, g.horizon, w, h - g.horizon);
  // fence posts with warm lights between them
  const n = Math.max(4, Math.round(w / 170));
  for (let i = 0; i <= n; i++) {
    const x = (w * i) / n;
    ctx.fillStyle = '#1a1128'; ctx.fillRect(x - 5, g.horizon - 70, 10, 74);
  }
  for (let i = 0; i < n; i++) {
    const x0 = (w * i) / n, x1 = (w * (i + 1)) / n, y0 = g.horizon - 66;
    ctx.strokeStyle = 'rgba(20,12,34,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, y0 + 30, x1, y0); ctx.stroke();
    for (let k = 1; k <= 3; k++) {
      const f = k / 4, x = x0 + (x1 - x0) * f, y = y0 + 60 * f * (1 - f);
      const fl = 0.8 + 0.2 * Math.sin(t * 3 + i * 2 + k);
      ctx.fillStyle = rgrad(ctx, x, y + 6, 0, 20, [[0, `rgba(255,226,140,${0.95 * fl})`], [0.4, `rgba(255,170,70,${0.35 * fl})`], [1, 'rgba(255,150,60,0)']]);
      ctx.fillRect(x - 22, y - 16, 44, 44);
      ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(x, y + 6, 3.2, 0, 7); ctx.fill();
    }
  }
  // bunting across the top
  const by = 0;
  ctx.strokeStyle = 'rgba(10,6,24,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, by + 18);
  const seg = 56;
  for (let x = 0; x <= w + seg; x += seg) ctx.lineTo(x, by + 18 + 10 * Math.sin((x / seg) * Math.PI));
  ctx.stroke();
  for (let x = 0, i = 0; x < w + seg; x += seg / 2, i++) {
    const y = by + 18 + 10 * Math.sin((x / seg) * Math.PI), sw = Math.sin(t * 1.6 + i * 0.7) * 2;
    ctx.fillStyle = FLAG[i % 3]; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + sw, y + 30); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // lane: packed earth in perspective, brighter in the middle
  const top = g.ground, farW = g.laneHalf, nearW = Math.max(w * 0.75, g.laneHalf * 2.2);
  ctx.beginPath(); ctx.moveTo(g.cx - farW, top); ctx.lineTo(g.cx + farW, top); ctx.lineTo(g.cx + nearW, h + 4); ctx.lineTo(g.cx - nearW, h + 4); ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, top, 0, h, [[0, '#7a5238'], [0.5, '#8d6044'], [1, '#6a4430']]);
  ctx.fill();
  ctx.save(); ctx.clip();
  for (let i = 0; i < 90; i++) {
    const yy = top + (h - top) * Math.pow(hash(i * 5.3), 1.6), xx = g.cx + (hash(i * 2.9) - 0.5) * (farW + (nearW - farW) * ((yy - top) / (h - top))) * 2;
    ctx.fillStyle = hash(i) > 0.5 ? 'rgba(255,230,190,0.07)' : 'rgba(30,14,10,0.12)';
    ctx.fillRect(xx, yy, 8 + hash(i * 4) * 26, 2);
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,244,220,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(g.cx - farW, top); ctx.lineTo(g.cx - nearW, h); ctx.moveTo(g.cx + farW, top); ctx.lineTo(g.cx + nearW, h); ctx.stroke();
  // the throwing line
  if (g.line) {
    const f = (g.line - top) / (h - top), half = farW + (nearW - farW) * f;
    ctx.strokeStyle = 'rgba(255,244,220,0.55)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(g.cx - half, g.line); ctx.lineTo(g.cx + half, g.line); ctx.stroke();
  }
}

// ---- the clay box, ring and mechas ------------------------------------------------------------------------------------------
export function drawMecha(ctx, x, y, s, ang, alive = 1) {
  const r = 2.3 * s;
  ctx.save(); ctx.translate(x, y); ctx.rotate(((90 - ang) * Math.PI) / 180);   // tip points away from the ring
  ctx.globalAlpha = alive;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.moveTo(-r + 1.5, r * 0.6 + 2); ctx.lineTo(r + 1.5, r * 0.6 + 2); ctx.lineTo(1.5, -r * 1.2 + 2); ctx.fill();
  ctx.fillStyle = '#fff6df'; ctx.beginPath(); ctx.moveTo(-r, r * 0.6); ctx.lineTo(r, r * 0.6); ctx.lineTo(0, -r * 1.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#d3272f'; ctx.beginPath(); ctx.moveTo(-r * 0.62, r * 0.05); ctx.lineTo(r * 0.62, r * 0.05); ctx.lineTo(r * 0.34, -r * 0.55); ctx.lineTo(-r * 0.34, -r * 0.55); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#2a1b0e'; ctx.lineWidth = Math.max(1, s * 0.16); ctx.beginPath(); ctx.moveTo(0, -r * 1.25); ctx.lineTo(r * 0.18, -r * 1.7); ctx.stroke();
  ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(r * 0.22, -r * 1.76, Math.max(1.2, s * 0.22), 0, 7); ctx.fill();
  ctx.restore();
}

export function drawDisc(ctx, x, y, r, side, o = {}) {
  const tm = TEAM[side] ?? TEAM[0], a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  if (!o.noShadow) { ctx.fillStyle = `rgba(0,0,0,${0.38 * (o.shadow ?? 1)})`; ctx.beginPath(); ctx.ellipse(x + r * 0.14, y + r * 0.2, r * 1.04, r * 0.96, 0, 0, 7); ctx.fill(); }
  const sp = sprites.ready && sprites.disc[side === 1 ? 1 : 0];
  if (sp) { const d = (r * 2) / sprites.discSpan; ctx.drawImage(sp, x - d / 2, y - d / 2, d, d); ctx.restore(); return; }
  ctx.fillStyle = '#4a515c'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = rgrad(ctx, x - r * 0.35, y - r * 0.4, r * 0.05, r * 1.0, [[0, '#ffffff'], [0.35, '#c4ccd7'], [0.8, '#79828f'], [1, '#515966']]);
  ctx.beginPath(); ctx.arc(x, y, r * 0.94, 0, 7); ctx.fill();
  ctx.lineWidth = r * 0.2; ctx.strokeStyle = tm.main; ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, 7); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.06); ctx.strokeStyle = tm.dark; ctx.beginPath(); ctx.arc(x, y, r * 0.79, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, r * 0.57, 0, 7); ctx.stroke();
  ctx.fillStyle = rgrad(ctx, x - r * 0.1, y - r * 0.12, 0, r * 0.5, [[0, '#e6ebf2'], [1, '#8b94a1']]);
  ctx.beginPath(); ctx.arc(x, y, r * 0.46, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.beginPath(); ctx.arc(x, y, r * 0.88, Math.PI * 1.08, Math.PI * 1.55); ctx.stroke();
  ctx.restore();
}

// The clay with its dents, the ring, live mechas and the discs. o: { alpha, discs: false, mechas: false, highlight }
export function drawBoard(ctx, R, board, o = {}) {
  const sz = BOX * R.s, fr = Math.max(8, R.s * 2.6), cr = Math.max(6, R.s * 1.8);
  if (sprites.ready && sprites.box) {
    const all = !board || (board.mechas[0] && board.mechas[1]), img = all ? sprites.box : sprites.boxBare, d = sz * sprites.boxSpan;
    ctx.save();
    ctx.drawImage(img, R.x + sz / 2 - d / 2, R.y + sz / 2 - d / 2, d, d);
    if (o.mechas !== false && !all) for (let i = 0; i < 2; i++) if (board.mechas[i]) { const m = P(R, mecha(i).u, mecha(i).v); drawMecha(ctx, m.x, m.y, R.s, MECHA.angles[i]); }
    if (o.discs !== false && board) {
      const ds = board.discs.slice().sort((a, b) => (b.dv ?? b.v) - (a.dv ?? a.v));
      for (const dd of ds) { const p = P(R, dd.du ?? dd.u, dd.dv ?? dd.v), r = DISC_R * R.s; ctx.fillStyle = 'rgba(40,10,0,0.4)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.14, 0, 7); ctx.fill(); drawDisc(ctx, p.x, p.y, r, dd.side, { noShadow: true }); }
    }
    ctx.restore();
    return;
  }
  ctx.save();
  // frame: slate with a brighter lip
  roundPath(ctx, R.x - fr + 3, R.y - fr + 8, sz + fr * 2, sz + fr * 2, cr + fr * 0.5); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  roundPath(ctx, R.x - fr, R.y - fr, sz + fr * 2, sz + fr * 2, cr + fr * 0.5);
  ctx.fillStyle = grad(ctx, R.x, R.y - fr, R.x + sz, R.y + sz + fr, [[0, '#59607a'], [0.45, '#2c3145'], [1, '#1a1d2b']]); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,204,255,0.4)'; ctx.stroke();
  for (const [cx, cy] of [[R.x - fr * 0.5, R.y - fr * 0.5], [R.x + sz + fr * 0.5, R.y - fr * 0.5], [R.x - fr * 0.5, R.y + sz + fr * 0.5], [R.x + sz + fr * 0.5, R.y + sz + fr * 0.5]]) {
    ctx.fillStyle = '#8c95ad'; ctx.beginPath(); ctx.arc(cx, cy, Math.max(2, fr * 0.16), 0, 7); ctx.fill();
  }
  const pl = Math.max(10, R.s * 3.4), py = R.y + sz + fr - 2;
  ctx.fillStyle = grad(ctx, 0, py, 0, py + pl, [[0, '#8a5a34'], [0.5, '#6a4224'], [1, '#3e2414']]);
  ctx.fillRect(R.x - fr + 6, py, sz + fr * 2 - 12, pl);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1.5;
  for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(R.x - fr + 6, py + (pl * k) / 3); ctx.lineTo(R.x + sz + fr - 6, py + (pl * k) / 3); ctx.stroke(); }
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(R.x - fr + 6, py + pl, Math.max(10, R.s * 4), Math.max(5, R.s * 1.2)); ctx.fillRect(R.x + sz + fr - 6 - Math.max(10, R.s * 4), py + pl, Math.max(10, R.s * 4), Math.max(5, R.s * 1.2));
  // clay
  roundPath(ctx, R.x, R.y, sz, sz, cr); ctx.save(); ctx.clip();
  ctx.fillStyle = grad(ctx, R.x, R.y, R.x + sz, R.y + sz, [[0, '#d27a47'], [0.5, '#b4532d'], [1, '#8a3a22']]); ctx.fillRect(R.x, R.y, sz, sz);
  const n = Math.round(Math.min(220, 60 + sz / 4));
  for (let i = 0; i < n; i++) {
    const x = R.x + hash(i * 1.7) * sz, y = R.y + hash(i * 4.3 + 2) * sz, rr = (0.25 + hash(i * 9.1) * 0.55) * R.s;
    ctx.fillStyle = hash(i * 3.3) > 0.5 ? 'rgba(255,214,170,0.13)' : 'rgba(60,18,8,0.2)';
    ctx.beginPath(); ctx.arc(x, y, Math.max(1, rr), 0, 7); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = R.x + hash(i * 6.1 + 5) * sz, y = R.y + hash(i * 2.2 + 8) * sz, L = (4 + hash(i * 8.8) * 14) * R.s;
    ctx.strokeStyle = i % 2 ? 'rgba(255,210,160,0.12)' : 'rgba(50,14,6,0.18)'; ctx.lineWidth = Math.max(1.5, R.s * (0.4 + hash(i) * 0.5)); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L * 0.9, y - L * 0.25); ctx.stroke();
  }
  // soft light from the upper left and a gentle vignette
  ctx.fillStyle = rgrad(ctx, R.x + sz * 0.3, R.y + sz * 0.2, 0, sz * 0.9, [[0, 'rgba(255,230,190,0.18)'], [1, 'rgba(40,8,0,0.34)']]); ctx.fillRect(R.x, R.y, sz, sz);
  // ring
  const c = P(R, RING.u, RING.v);
  ctx.fillStyle = 'rgba(40,10,0,0.35)'; ctx.beginPath(); ctx.arc(c.x + R.s * 0.3, c.y + R.s * 0.5, RING.outer * R.s * 1.02, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, c.x - RING.outer * R.s, c.y - RING.outer * R.s, c.x + RING.outer * R.s, c.y + RING.outer * R.s, [[0, '#fff0b0'], [0.35, '#e0aa3c'], [0.7, '#a8741a'], [1, '#6a4408']]);
  ctx.beginPath(); ctx.arc(c.x, c.y, RING.outer * R.s, 0, 7); ctx.fill();
  ctx.fillStyle = rgrad(ctx, c.x + RING.hole * R.s * 0.25, c.y + RING.hole * R.s * 0.3, 0, RING.hole * R.s * 1.2, [[0, '#c4663a'], [0.7, '#a2492a'], [1, '#6a2a16']]);
  ctx.beginPath(); ctx.arc(c.x, c.y, RING.hole * R.s, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(2, R.s * 0.6); ctx.strokeStyle = 'rgba(30,8,0,0.45)'; ctx.beginPath(); ctx.arc(c.x, c.y, RING.hole * R.s - R.s * 0.3, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  ctx.lineWidth = Math.max(1.5, R.s * 0.3); ctx.strokeStyle = 'rgba(255,248,214,0.8)'; ctx.beginPath(); ctx.arc(c.x, c.y, RING.outer * R.s - R.s * 0.15, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(c.x, c.y, RING.hole * R.s + 1, 0, 7); ctx.stroke();
  // mechas, then discs from the far edge to the near edge
  if (o.mechas !== false) for (let i = 0; i < 2; i++) if (!board || board.mechas[i]) { const m = P(R, mecha(i).u, mecha(i).v); drawMecha(ctx, m.x, m.y, R.s, MECHA.angles[i]); }
  if (o.discs !== false && board) {
    const ds = board.discs.slice().sort((a, b) => (b.dv ?? b.v) - (a.dv ?? a.v));
    for (const d of ds) {
      const p = P(R, d.du ?? d.u, d.dv ?? d.v), r = DISC_R * R.s;
      ctx.fillStyle = 'rgba(40,10,0,0.45)'; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.16, 0, 7); ctx.fill();   // the dent it sank into
      drawDisc(ctx, p.x, p.y, r, d.side, { noShadow: false, shadow: 0.7 });
    }
  }
  ctx.restore();
  ctx.restore();
}

// ---- particles ----------------------------------------------------------------------------------------------------------------
// kinds: 'crumb' (clay), 'paper' (confetti, flag colours), 'spark', 'dust'
export function emit(fx, kind, x, y, n, rngf, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rngf() * Math.PI * 2, sp = (o.speed ?? 240) * (0.35 + rngf() * 0.9);
    const p = { kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 80), life: 0, max: (o.life ?? 0.9) * (0.6 + rngf() * 0.7), size: (o.size ?? 7) * (0.6 + rngf() * 0.8), rot: rngf() * 6, vr: (rngf() - 0.5) * 14, col: o.cols ? o.cols[Math.floor(rngf() * o.cols.length)] : '#fff' };
    fx.push(p);
  }
  if (fx.length > 420) fx.splice(0, fx.length - 420);
}
export function stepFx(fx, dt) {
  for (const p of fx) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const drag = p.kind === 'paper' ? 2.4 : 1.2;
    p.vx *= Math.max(0, 1 - drag * dt); p.vy = p.vy * Math.max(0, 1 - drag * dt) + (p.kind === 'dust' ? -10 : p.kind === 'paper' ? 140 : 620) * dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life >= fx[i].max) fx.splice(i, 1);
}
export function drawFx(ctx, fx) {
  for (const p of fx) {
    const k = 1 - p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.6)); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 'paper') { ctx.fillStyle = p.col; ctx.scale(1, Math.abs(Math.cos(p.rot * 1.3)) * 0.9 + 0.1); ctx.fillRect(-p.size * 0.6, -p.size * 0.35, p.size * 1.2, p.size * 0.7); }
    else if (p.kind === 'dust') { ctx.fillStyle = 'rgba(230,190,150,0.35)'; ctx.beginPath(); ctx.arc(0, 0, p.size * (1.4 - k * 0.4), 0, 7); ctx.fill(); }
    else if (p.kind === 'spark') { ctx.fillStyle = p.col; ctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 2); }
    else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
}

// ---- the title hero and the rules diagrams -----------------------------------------------------------------------------------
// A close-up of the ring with a disc and a popping mecha, clipped to a rounded tile of size w x h.
export function drawHero(ctx, w, h, t) {
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 28); ctx.clip();
  const s = Math.max(w, h) / 62;
  const R = { x: w / 2 - RING.u * s, y: h * 0.6 - (BOX - RING.v) * s, s };
  ctx.fillStyle = '#2a1830'; ctx.fillRect(0, 0, w, h);
  drawBoard(ctx, R, { discs: [{ id: 1, side: 1, u: RING.u - 15, v: RING.v - 7 }], mechas: [false, true] }, {});
  // the pop above the ring
  const c = P(R, RING.u, RING.v + MECHA.r), ph = (t * 0.9) % 1.6;
  const burst = Math.min(1, ph / 0.5), fade = ph > 0.5 ? Math.max(0, 1 - (ph - 0.5) / 1.1) : 1;
  ctx.globalAlpha = fade;
  for (let i = 0; i < 22; i++) {
    const a = hash(i) * 6.28, d = (0.4 + hash(i + 3) * 1.1) * burst * s * 5.5;
    ctx.fillStyle = FLAG[i % 3]; ctx.save(); ctx.translate(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d + ph * 18); ctx.rotate(a + t * 3);
    ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
  }
  ctx.fillStyle = rgrad(ctx, c.x, c.y, 0, s * 4.2 * burst + 1, [[0, 'rgba(255,255,230,0.9)'], [1, 'rgba(255,200,80,0)']]);
  ctx.fillRect(c.x - s * 5, c.y - s * 5, s * 10, s * 10);
  ctx.globalAlpha = 1;
  const dp = P(R, RING.u + 2.2, RING.v - 1.2);
  drawDisc(ctx, dp.x, dp.y, DISC_R * s, 0);
  ctx.restore();
  ctx.save(); roundPath(ctx, 1.5, 1.5, w - 3, h - 3, 27); ctx.strokeStyle = 'rgba(255,225,160,0.55)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}

const lbl = (ctx, text, x, y, size = 22, col = '#fff4dc', align = 'center') => {
  ctx.save(); ctx.font = `800 ${size}px ${NUM}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, size * 0.22); ctx.strokeStyle = 'rgba(14,8,30,0.9)'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
  ctx.fillStyle = col; ctx.fillText(text, x, y); ctx.restore();
};
const arrow = (ctx, x0, y0, x1, y1, col = '#ffe08a', wd = 4) => {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - Math.cos(a) * 8, y1 - Math.sin(a) * 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - Math.cos(a - 0.45) * 16, y1 - Math.sin(a - 0.45) * 16); ctx.lineTo(x1 - Math.cos(a + 0.45) * 16, y1 - Math.sin(a + 0.45) * 16); ctx.closePath(); ctx.fill();
  ctx.restore();
};
const tile = (ctx, w, h) => { roundPath(ctx, 0, 0, w, h, 22); ctx.fillStyle = '#1c130e'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(240,190,90,0.6)'; ctx.stroke(); };

// Rules-page illustrations. Keys match content.js.
export function drawDiagram(key, ctx, w, h) {
  ctx.save(); tile(ctx, w, h); ctx.save(); roundPath(ctx, 0, 0, w, h, 22); ctx.clip();
  const sq = Math.min(w * 0.46, h - 24), s = sq / 100;
  if (key === 'court') {
    const g = { horizon: h * 0.42, ground: h * 0.62, laneHalf: w * 0.08, cx: w * 0.5, line: h * 0.9 };
    drawBackdrop(ctx, w, h, 0, g);
    const R = { x: w / 2 - 22 * (h * 0.0105), y: h * 0.06, s: h * 0.0105 * 0.0 + (h * 0.5) / 100 };
    R.x = w / 2 - 50 * R.s;
    drawBoard(ctx, R, { discs: [], mechas: [true, true] });
    drawDisc(ctx, w / 2, h * 0.84, 20, 0);
    lbl(ctx, 'Clay box', w * 0.82, h * 0.2, 22); lbl(ctx, 'Throwing line', w * 0.22, h * 0.9, 20);
    arrow(ctx, w / 2 + 28, h * 0.78, w / 2 + 70, h * 0.5, '#ffe08a');
  } else if (key === 'aim') {
    const R = { x: w / 2 - sq / 2, y: 12, s };
    drawBoard(ctx, R, { discs: [], mechas: [true, true] });
    const a = P(R, 34, 46);
    ctx.setLineDash([8, 7]); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(a.x, a.y, 4.6 * R.s, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(a.x, a.y, DISC_R * R.s, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x - 14, a.y); ctx.lineTo(a.x + 14, a.y); ctx.moveTo(a.x, a.y - 14); ctx.lineTo(a.x, a.y + 14); ctx.stroke();
    lbl(ctx, 'Target mark', w * 0.2, a.y - 16, 22); lbl(ctx, 'Likely scatter', w * 0.8, a.y + 30, 20);
    arrow(ctx, w * 0.3, a.y - 8, a.x - 16, a.y - 2); arrow(ctx, w * 0.72, a.y + 22, a.x + 4.8 * R.s, a.y + 8);
  } else if (key === 'scoring') {
    const R = { x: w / 2 - 50 * s * 1.9, y: h * 0.5 - (BOX - RING.v) * s * 1.9, s: s * 1.9 };
    drawBoard(ctx, R, { discs: [], mechas: [true, true] });
    const c = P(R, RING.u, RING.v);
    lbl(ctx, 'RING 6', c.x, c.y, 28, '#ffe08a');
    const m0 = P(R, mecha(0).u, mecha(0).v), m1 = P(R, mecha(1).u, mecha(1).v);
    lbl(ctx, 'POP 3', m0.x + 90, m0.y - 4, 24); lbl(ctx, 'POP 3', m1.x + 90, m1.y + 4, 24);
    arrow(ctx, m0.x + 52, m0.y - 4, m0.x + 16, m0.y - 4); arrow(ctx, m1.x + 52, m1.y + 4, m1.x + 16, m1.y + 4);
    lbl(ctx, 'Ring + pop = 9', w * 0.2, h * 0.86, 22, '#9fe0ff');
  } else if (key === 'rim') {
    const R = { x: w / 2 - 50 * s * 1.9, y: h * 0.5 - (BOX - RING.v) * s * 1.9, s: s * 1.9 };
    drawBoard(ctx, R, { discs: [], mechas: [true, true] });
    const a = P(R, RING.u + 4.5, RING.v + 1.2), b = P(R, RING.u + 12.5, RING.v + 3);
    ctx.setLineDash([6, 6]); drawDisc(ctx, a.x, a.y, DISC_R * R.s, 0, { alpha: 0.5, noShadow: true }); ctx.setLineDash([]);
    arrow(ctx, a.x + 6, a.y, b.x, b.y);
    drawDisc(ctx, b.x + 6, b.y + 2, DISC_R * R.s, 0, { alpha: 0.95 });
    lbl(ctx, 'Rim kick: slides outward', w * 0.5, h * 0.9, 22);
  } else if (key === 'mano') {
    const R = { x: w / 2 - sq / 2, y: 12, s };
    drawBoard(ctx, R, { discs: [{ id: 1, side: 0, u: 40, v: 40 }, { id: 2, side: 1, u: 63, v: 66 }, { id: 3, side: 1, u: 28, v: 76 }], mechas: [true, true] });
    const c = P(R, RING.u, RING.v), d = P(R, 40, 40);
    ctx.setLineDash([7, 6]); ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke(); ctx.setLineDash([]);
    lbl(ctx, 'Closest disc: 1 point', w * 0.5, h - 18, 22, '#ffe08a');
  } else if (key === 'rounds') {
    for (let i = 0; i < 6; i++) drawDisc(ctx, w * (0.12 + 0.15 * i), h * 0.4, Math.min(30, w * 0.05), i % 2);
    lbl(ctx, 'Gold, Blue, Gold, Blue, Gold, Blue', w / 2, h * 0.8, 22);
  } else {
    drawBackdrop(ctx, w, h, 0, { horizon: h * 0.5, ground: h * 0.7, laneHalf: w * 0.05, cx: w / 2 });
    drawDisc(ctx, w / 2, h * 0.55, Math.min(h * 0.28, 60), 0);
  }
  ctx.restore(); ctx.restore();
}

// Title wordmark: chunky italic lettering in beaten gold, with an extruded edge, a dark outline and a lit top bevel.
export function wordmark(ctx, text, cx, cy, size) {
  ctx.save();
  ctx.font = `900 italic ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const depth = Math.max(4, Math.round(size * 0.075));
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = depth + 5;
  ctx.lineWidth = size * 0.2; ctx.strokeStyle = '#1a0f3a'; ctx.strokeText(text, cx, cy + depth);
  ctx.shadowColor = 'transparent';
  for (let i = depth; i >= 1; i--) {   // the thickness of the letters
    ctx.fillStyle = ctx.strokeStyle = i > depth * 0.5 ? '#5a2706' : '#8a4410'; ctx.lineWidth = size * 0.06; ctx.strokeText(text, cx, cy + i); ctx.fillText(text, cx, cy + i);
  }
  ctx.fillStyle = grad(ctx, 0, cy - size * 0.5, 0, cy + size * 0.5, [[0, '#fffbd0'], [0.38, '#ffd34a'], [0.62, '#f2a41c'], [1, '#c95f12']]);
  ctx.fillText(text, cx, cy);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - size * 3, cy - size * 0.62, size * 6, size * 0.5); ctx.clip();
  ctx.lineWidth = Math.max(1.5, size * 0.022); ctx.strokeStyle = 'rgba(255,255,235,0.85)'; ctx.strokeText(text, cx, cy - 1);
  ctx.restore();
  ctx.restore();
}
