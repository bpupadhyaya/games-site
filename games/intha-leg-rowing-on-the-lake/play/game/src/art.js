// Intha Leg Rowing: all the painting that is not the interface. A misty lake seen from above: water with light, floating garden beds with
// tomato rows and bamboo stakes, reeds, weed, buoys, stakes, fish shoals, and the boats with their one-legged rowers.
// Pure canvas 2D. Everything is a function of its arguments and the clock handed in (no wall clock, no random: a position hash is used).
import { centreAt, halfWidthAt, LOOKS } from './courses.js';

export const PAL = {
  ink: '#0f2a3a', deep: '#123a4e', gold: '#ffe08a', goldDeep: '#d8a23a', cream: '#fff7e6', text: '#f6fbfb', dim: 'rgba(238,248,248,0.7)',
  teal: '#2fb6a3', tealHi: '#8ef0dc', coral: '#ff8a6a', rose: '#ff9aa8', leaf: '#4fae45', water: '#4cb8d8', sand: '#e8c98f', ember: '#ffb43c',
};
export const DISPLAY = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hash2 = (a, b) => hash(a * 57.3 + b * 131.9 + 7.7);

// ---- the camera ---------------------------------------------------------------------------------------------------------------------
// World coordinates are (s along the channel, n across it, positive to the right of travel). Landscape rows to the right (s -> screen x),
// portrait rows up the screen (s -> -screen y). The boat sits 30% in from the back edge. ppm = pixels per metre.
export function makeView(stage, camS, camN) {
  const land = stage.w > stage.h * 1.02;
  const ppm = clamp((land ? stage.h : stage.w) / 12.5, 30, 96);
  const ox = land ? stage.x + stage.w * 0.3 : stage.x + stage.w / 2;
  const oy = land ? stage.y + stage.h / 2 : stage.y + stage.h * 0.7;
  const ahead = land ? (stage.x + stage.w - ox) / ppm : (oy - stage.y) / ppm;
  const behind = land ? (ox - stage.x) / ppm : (stage.y + stage.h - oy) / ppm;
  const lat = (land ? stage.h : stage.w) / 2 / ppm;
  return { S: stage, land, ppm, ox, oy, cs: camS, cn: camN, ahead, behind, lat, s0: camS - behind - 3, s1: camS + ahead + 3 };
}
export function toScreen(V, s, n) {
  return V.land ? { x: V.ox + (s - V.cs) * V.ppm, y: V.oy + (n - V.cn) * V.ppm } : { x: V.ox + (n - V.cn) * V.ppm, y: V.oy - (s - V.cs) * V.ppm };
}
function worldBegin(ctx, V) {
  ctx.save();
  ctx.translate(V.ox, V.oy);
  if (!V.land) ctx.rotate(-Math.PI / 2);
  ctx.scale(V.ppm, V.ppm);
  ctx.translate(-V.cs, -V.cn);
}

// ---- water --------------------------------------------------------------------------------------------------------------------------------
function drawWaterBase(ctx, V, th) {
  const S = V.S, g = V.land ? ctx.createLinearGradient(S.x + S.w, 0, S.x, 0) : ctx.createLinearGradient(0, S.y, 0, S.y + S.h);
  g.addColorStop(0, th.water[0]); g.addColorStop(0.45, th.water[1]); g.addColorStop(1, th.water[2]);
  ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, S.h);
}
function drawGlints(ctx, V, th, t) {
  const cw = 3.4, ch = 2.3, i0 = Math.floor(V.s0 / cw), i1 = Math.ceil(V.s1 / cw), j0 = Math.floor((V.cn - V.lat - 1) / ch), j1 = Math.ceil((V.cn + V.lat + 1) / ch);
  ctx.lineCap = 'round';
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const h = hash2(i, j);
      if (h < 0.28) continue;
      const a = (0.12 + 0.3 * h) * (0.55 + 0.45 * Math.sin(t * (0.7 + h) + h * 40));
      const s = (i + hash2(j, i + 3)) * cw + Math.sin(t * 0.15 + h * 9) * 0.4, n = (j + hash2(i + 5, j)) * ch, len = 0.5 + h * 1.1;
      ctx.strokeStyle = rgba(th.glint, a); ctx.lineWidth = 0.07 + 0.05 * h;
      ctx.beginPath(); ctx.moveTo(s, n); ctx.quadraticCurveTo(s + len * 0.5, n + 0.07, s + len, n); ctx.stroke();
    }
  }
}

// ---- banks: floating gardens, reeds, houses ----------------------------------------------------------------------------------------------
function bankPath(C, V, side, off, step) {
  const pts = [];
  for (let s = Math.floor(V.s0 / step) * step; s <= V.s1 + step; s += step) pts.push([s, centreAt(C, s) + side * (halfWidthAt(C, s) + off)]);
  return pts;
}
function strip(ctx, A, B) {          // polygon between two polylines (same s samples)
  ctx.beginPath();
  A.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
  ctx.closePath();
}
function drawBanks(ctx, V, C, th, t) {
  const step = 1.5, far = V.lat + 6;
  for (const side of [-1, 1]) {
    const edge = bankPath(C, V, side, 0, step);
    // far shore fill (deep green with soil showing between the beds)
    const outer = bankPath(C, V, side, far, step);
    ctx.fillStyle = th.soil; strip(ctx, edge, outer); ctx.fill();
    // beds
    for (let j = 0; j < 4; j++) {
      const a = bankPath(C, V, side, 0.45 + j * 2.0, step), b = bankPath(C, V, side, 0.45 + j * 2.0 + 1.55, step);
      const bedCol = (j + (side > 0 ? 1 : 0)) % 2 ? th.bed2 : th.bed;
      const g = ctx.createLinearGradient(0, edge[0][1], 0, edge[0][1] + side * 4);
      void g;
      ctx.fillStyle = bedCol; strip(ctx, a, b); ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,10,0.35)'; ctx.lineWidth = 0.08; ctx.stroke();
      // plants: round tomato bushes in two rows, with the odd red or yellow fruit
      const rowOff = [0.45 + j * 2.0 + 0.5, 0.45 + j * 2.0 + 1.1];
      for (let r = 0; r < 2; r++) {
        const sp = 0.62, k0 = Math.floor(V.s0 / sp), k1 = Math.ceil(V.s1 / sp);
        ctx.fillStyle = r ? '#2f7a2c' : '#3b8f36';
        ctx.beginPath();
        for (let k = k0; k <= k1; k++) {
          const s = k * sp + hash2(k, j * 2 + r) * 0.16, n = centreAt(C, s) + side * (halfWidthAt(C, s) + rowOff[r]);
          ctx.moveTo(s + 0.26, n); ctx.arc(s, n, 0.26 + 0.05 * hash2(k, r + j), 0, TAU);
        }
        ctx.fill();
        ctx.fillStyle = 'rgba(190,240,120,0.55)';
        ctx.beginPath();
        for (let k = k0; k <= k1; k++) {
          const s = k * sp + hash2(k, j * 2 + r) * 0.16, n = centreAt(C, s) + side * (halfWidthAt(C, s) + rowOff[r]);
          ctx.moveTo(s - 0.04 + 0.1, n - 0.06); ctx.arc(s - 0.06, n - 0.06, 0.1, 0, TAU);
        }
        ctx.fill();
        for (let k = k0; k <= k1; k++) {
          const h = hash2(k, 40 + j + r * 5);
          if (h < 0.7) continue;
          const s = k * sp + hash2(k, j * 2 + r) * 0.16 + 0.1, n = centreAt(C, s) + side * (halfWidthAt(C, s) + rowOff[r]);
          ctx.fillStyle = h > 0.88 ? '#e8452c' : '#f4c64a';
          ctx.beginPath(); ctx.arc(s, n + 0.05, 0.075, 0, TAU); ctx.fill();
        }
      }
      // bamboo stakes at intervals: a short pole with its small shadow
      for (let k = Math.floor(V.s0 / 4.4); k <= Math.ceil(V.s1 / 4.4); k++) {
        const s = k * 4.4 + hash2(k, j) * 1.2, n = centreAt(C, s) + side * (halfWidthAt(C, s) + 0.45 + j * 2.0 + 0.8);
        ctx.strokeStyle = 'rgba(40,24,8,0.4)'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(s + 0.04, n + 0.04); ctx.lineTo(s + 0.2, n + 0.18); ctx.stroke();
        ctx.fillStyle = '#c9a15a'; ctx.beginPath(); ctx.arc(s, n, 0.09, 0, TAU); ctx.fill();
      }
    }
    // the floating mat edge and reeds
    ctx.strokeStyle = '#9fc46a'; ctx.lineWidth = 0.22; ctx.lineJoin = 'round'; ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + side * 0.12) : ctx.moveTo(p[0], p[1] + side * 0.12))); ctx.stroke();
    ctx.strokeStyle = 'rgba(25,60,20,0.45)'; ctx.lineWidth = 0.07; ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + side * 0.3) : ctx.moveTo(p[0], p[1] + side * 0.3))); ctx.stroke();
    ctx.lineCap = 'round';
    for (let k = Math.floor(V.s0 / 2.1); k <= Math.ceil(V.s1 / 2.1); k++) {
      const h = hash2(k, side + 9);
      if (h < 0.45) continue;
      const s = k * 2.1 + h * 1.4, n = centreAt(C, s) + side * (halfWidthAt(C, s) + 0.15);
      ctx.strokeStyle = h > 0.8 ? '#6a8f3a' : '#7da846'; ctx.lineWidth = 0.06;
      for (let q = 0; q < 5; q++) {
        const a = (q - 2) * 0.28 + Math.sin(t * 1.1 + k + q) * 0.05;
        ctx.beginPath(); ctx.moveTo(s, n); ctx.lineTo(s + Math.sin(a) * 0.7, n + side * Math.cos(a) * 0.7); ctx.stroke();
      }
      ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.arc(s, n, 0.05, 0, TAU); ctx.fill();
    }
    // fence posts where the channel is pinched
    for (const f of C.fences) {
      if (f.s1 < V.s0 || f.s0 > V.s1) continue;
      for (let s = f.s0 - 3; s <= f.s1 + 3; s += 0.85) {
        const n = centreAt(C, s) + side * (halfWidthAt(C, s) - 0.12);
        ctx.fillStyle = 'rgba(30,18,6,0.4)'; ctx.beginPath(); ctx.arc(s + 0.07, n + 0.07, 0.15, 0, TAU); ctx.fill();
        ctx.fillStyle = '#b78a4a'; ctx.beginPath(); ctx.arc(s, n, 0.14, 0, TAU); ctx.fill();
        ctx.fillStyle = '#e1c086'; ctx.beginPath(); ctx.arc(s - 0.03, n - 0.03, 0.06, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(120,80,30,0.8)'; ctx.lineWidth = 0.12; ctx.beginPath();
      for (let s = f.s0 - 3; s <= f.s1 + 3; s += 0.85) { const n = centreAt(C, s) + side * (halfWidthAt(C, s) - 0.12); s === f.s0 - 3 ? ctx.moveTo(s, n) : ctx.lineTo(s, n); }
      ctx.stroke();
    }
    // a stilt house now and then, and a moored boat
    for (let k = Math.floor(V.s0 / 58); k <= Math.ceil(V.s1 / 58); k++) {
      const h = hash2(k, side * 3 + 1);
      const s = k * 58 + 8 + h * 30, n = centreAt(C, s) + side * (halfWidthAt(C, s) + 4.1 + h * 1.2);
      const rot = (hash2(k, 77) - 0.5) * 0.25;
      ctx.save(); ctx.translate(s, n); ctx.rotate(rot);
      ctx.fillStyle = 'rgba(10,20,10,0.35)'; ctx.fillRect(-1.5 + 0.25, -1.1 + 0.25, 3.2, 2.4);
      ctx.fillStyle = '#7a5a34'; ctx.fillRect(-1.5, -1.1, 3.0, 2.2);
      const rg = ctx.createLinearGradient(0, -1.1, 0, 1.1); rg.addColorStop(0, '#b78a56'); rg.addColorStop(0.5, '#8a6236'); rg.addColorStop(1, '#a87a46');
      ctx.fillStyle = rg; ctx.fillRect(-1.4, -1.0, 2.8, 2.0);
      ctx.strokeStyle = 'rgba(40,24,8,0.6)'; ctx.lineWidth = 0.05;
      for (let q = -1.1; q < 1.2; q += 0.28) { ctx.beginPath(); ctx.moveTo(-1.4, q); ctx.lineTo(1.4, q); ctx.stroke(); }
      ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(-1.4, 0); ctx.lineTo(1.4, 0); ctx.stroke();
      ctx.restore();
      // a moored boat at the bank edge
      if (h > 0.4) {
        const bs = s + 11, bn = centreAt(C, bs) + side * (halfWidthAt(C, bs) + 0.1);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(bs + 0.1, bn - side * 0.52, 1.8, 0.34, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8a5a2e'; ctx.beginPath(); ctx.ellipse(bs, bn - side * 0.45, 1.8, 0.32, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#c99557'; ctx.beginPath(); ctx.ellipse(bs, bn - side * 0.45, 1.5, 0.2, 0, 0, TAU); ctx.fill();
      }
    }
  }
}

// ---- water features -----------------------------------------------------------------------------------------------------------------------
function drawHyacinth(ctx, o, t) {
  for (let i = 0; i < 17; i++) {
    const a = hash(o.s * 3 + i) * TAU, d = Math.sqrt(hash(o.s * 5 + i * 3 + 1)) * o.r, s = o.s + Math.cos(a) * d + Math.sin(t * 0.6 + i) * 0.03, n = o.n + Math.sin(a) * d;
    const r = 0.38 + hash(i + o.s) * 0.28;
    ctx.fillStyle = 'rgba(10,30,10,0.3)'; ctx.beginPath(); ctx.ellipse(s + 0.07, n + 0.07, r, r * 0.88, a, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(s - r * 0.3, n - r * 0.3, 0.02, s, n, r);
    g.addColorStop(0, '#9ed65a'); g.addColorStop(1, '#3f8f32');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(s, n, r, r * 0.88, a, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,255,180,0.5)'; ctx.lineWidth = 0.04; ctx.beginPath(); ctx.moveTo(s - r * 0.6, n); ctx.lineTo(s + r * 0.6, n); ctx.stroke();
    if (i % 4 === 0) {
      ctx.fillStyle = '#c9a8f4'; ctx.beginPath(); ctx.arc(s, n, 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f4ecff'; ctx.beginPath(); ctx.arc(s - 0.03, n - 0.03, 0.06, 0, TAU); ctx.fill();
    }
  }
}
function drawSwell(ctx, V, C, w, t) {
  if (w.s1 < V.s0 || w.s0 > V.s1) return;
  const len = w.s1 - w.s0;
  for (let k = 0; k < 8; k++) {
    const s = w.s0 + ((k * (len / 8) + t * 1.5) % len);
    const fade = Math.min(1, (s - w.s0) / 1.5, (w.s1 - s) / 1.5);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * fade})`; ctx.lineWidth = 0.14; ctx.beginPath();
    const cen = centreAt(C, s), hw = halfWidthAt(C, s) - 0.2;
    for (let q = -1; q <= 1.0001; q += 0.1) {
      const n = cen + q * hw, ss = s + Math.sin(q * 5 + k * 1.3 + t * 0.7) * 0.28;
      q === -1 ? ctx.moveTo(ss, n) : ctx.lineTo(ss, n);
    }
    ctx.stroke();
    ctx.strokeStyle = `rgba(20,60,90,${0.25 * fade})`; ctx.lineWidth = 0.1; ctx.beginPath();
    for (let q = -1; q <= 1.0001; q += 0.1) {
      const n = cen + q * hw, ss = s + 0.35 + Math.sin(q * 5 + k * 1.3 + t * 0.7) * 0.28;
      q === -1 ? ctx.moveTo(ss, n) : ctx.lineTo(ss, n);
    }
    ctx.stroke();
  }
  // warning posts with pennants at the near end on both sides
  for (const side of [-1, 1]) {
    const n = centreAt(C, w.s0) + side * (halfWidthAt(C, w.s0) - 0.5);
    ctx.fillStyle = '#e8c06a'; ctx.beginPath(); ctx.arc(w.s0, n, 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3aa6d6'; ctx.beginPath(); ctx.moveTo(w.s0, n); ctx.lineTo(w.s0 - 0.8, n - side * 0.18); ctx.lineTo(w.s0, n - side * 0.36); ctx.fill();
  }
}
function drawPole(ctx, s, n, r, col, wob, t) {
  if (wob > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * wob})`; ctx.lineWidth = 0.07; ctx.beginPath(); ctx.arc(s, n, r + 0.2 + (1 - wob) * 0.8, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,30,40,0.3)'; ctx.beginPath(); ctx.ellipse(s + 0.1, n + 0.1, r + 0.08, r + 0.05, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.arc(s, n, r + 0.1 + Math.sin(t * 2 + s) * 0.02, 0, TAU); ctx.stroke();
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(s, n, r, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(s - r * 0.3, n - r * 0.3, r * 0.35, 0, TAU); ctx.fill();
}
function drawGate(ctx, g, res, t) {
  const col = res === true ? '#7dffa6' : res === false ? '#ff8a7a' : '#ffffff';
  ctx.setLineDash([0.25, 0.25]); ctx.strokeStyle = rgba(col === '#ffffff' ? '#ffffff' : col, res === null || res === undefined ? 0.45 : 0.8); ctx.lineWidth = 0.08;
  ctx.beginPath(); ctx.moveTo(g.s, g.n - g.gap / 2); ctx.lineTo(g.s, g.n + g.gap / 2); ctx.stroke(); ctx.setLineDash([]);
  drawPole(ctx, g.s, g.n - g.gap / 2, 0.2, '#e8452c', 0, t);
  drawPole(ctx, g.s, g.n + g.gap / 2, 0.2, '#f4f4f4', 0, t);
  // pennants streaming back
  for (const [sgn, c] of [[-1, '#e8452c'], [1, '#f4f4f4']]) {
    const n = g.n + sgn * g.gap / 2;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(g.s, n); ctx.lineTo(g.s - 0.9 + Math.sin(t * 5 + sgn) * 0.08, n - sgn * 0.12); ctx.lineTo(g.s, n - sgn * 0.3); ctx.fill();
  }
}
function drawShoal(ctx, sh, t, near) {
  if (sh.caught) return;
  // ripples
  for (let q = 0; q < 2; q++) {
    const ph = ((t * 0.5 + q * 0.5 + sh.id * 0.17) % 1);
    ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - ph)})`; ctx.lineWidth = 0.06; ctx.beginPath(); ctx.ellipse(sh.s, sh.n, 0.7 + ph * 1.3, 0.6 + ph * 1.0, 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(8,48,66,0.3)'; ctx.beginPath(); ctx.ellipse(sh.s, sh.n, 1.05, 0.9, 0, 0, TAU); ctx.fill();
  const count = 6 + sh.size * 2;
  for (let i = 0; i < count; i++) {
    const h1 = hash(sh.id * 31 + i), h2 = hash(sh.id * 17 + i * 3 + 1);
    const sp = 0.5 + 0.9 * h1, a = t * sp * (i % 2 ? 1 : -1) + h2 * TAU, rr = 0.2 + 0.55 * h2 + 0.08 * Math.sin(t * 2 + i);
    const x = sh.s + Math.cos(a) * rr, y = sh.n + Math.sin(a) * rr * 0.85, dir = a + (i % 2 ? Math.PI / 2 : -Math.PI / 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(dir);
    const wig = Math.sin(t * 9 + i * 2) * 0.12;
    ctx.fillStyle = near ? 'rgba(255,244,200,0.95)' : 'rgba(214,238,244,0.9)';
    ctx.beginPath(); ctx.ellipse(0.1, 0, 0.2, 0.065, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.08, 0); ctx.lineTo(-0.28, -0.1 + wig); ctx.lineTo(-0.28, 0.1 + wig); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,90,110,0.6)'; ctx.beginPath(); ctx.arc(0.22, -0.02, 0.016, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
function drawLotus(ctx, V, C, t) {
  const sp = 7.3, k0 = Math.floor(V.s0 / sp), k1 = Math.ceil(V.s1 / sp);
  for (let k = k0; k <= k1; k++) {
    for (const side of [-1, 1]) {
      const h = hash2(k, side * 5 + 2);
      if (h < 0.35) continue;
      const s = k * sp + h * 4, n = centreAt(C, s) + side * (halfWidthAt(C, s) - 0.5 - hash2(k, 8 + side) * 1.1);
      const r = 0.34 + 0.2 * h;
      ctx.fillStyle = 'rgba(0,40,40,0.25)'; ctx.beginPath(); ctx.ellipse(s + 0.06, n + 0.06, r, r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4c9a48'; ctx.beginPath(); ctx.ellipse(s, n, r, r * 0.9, h * 6, 0.25, TAU - 0.25); ctx.lineTo(s, n); ctx.fill();
      ctx.strokeStyle = 'rgba(210,255,170,0.5)'; ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(s, n, r * 0.55, 0, TAU); ctx.stroke();
      if (h > 0.62) {
        ctx.fillStyle = '#ffd1e0'; for (let q = 0; q < 6; q++) { const a = q * TAU / 6 + h; ctx.beginPath(); ctx.ellipse(s + Math.cos(a) * 0.13, n + Math.sin(a) * 0.13, 0.12, 0.05, a, 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(s, n, 0.06, 0, TAU); ctx.fill();
      }
    }
  }
}
function drawDeep(ctx, V, C, th) {
  const step = 2.5;
  for (const [wk, al] of [[0.62, 0.1], [0.34, 0.1]]) {
    ctx.strokeStyle = rgba(th.deep, al); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let s = Math.floor(V.s0 / step) * step; s <= V.s1 + step; s += step) { const n = centreAt(C, s), w = halfWidthAt(C, s) * 2 * wk; ctx.lineWidth = w; s === Math.floor(V.s0 / step) * step ? ctx.moveTo(s, n) : ctx.lineTo(s, n); }
    ctx.lineWidth = halfWidthAt(C, V.cs) * 2 * wk; ctx.stroke();
  }
}
function drawPier(ctx, V, C, t) {
  const L = C.length;
  if (L + 6 < V.s0 || L - 3 > V.s1) return;
  const cen = centreAt(C, L), hw = halfWidthAt(C, L) + 5;
  // finish line: floating buoys and two flag posts
  for (let q = -hw; q <= hw; q += 0.7) {
    const n = cen + q, on = (Math.round(q / 0.7)) % 2 === 0;
    ctx.fillStyle = on ? '#ffffff' : '#222'; ctx.fillRect(L - 0.18, n - 0.35, 0.36, 0.7);
  }
  // the landing deck across the end of the channel
  const x0 = L + 3.4, g = ctx.createLinearGradient(x0, 0, x0 + 8, 0);
  g.addColorStop(0, '#9a6a36'); g.addColorStop(1, '#6e4824');
  ctx.fillStyle = g; ctx.fillRect(x0, cen - hw - 6, 9, hw * 2 + 12);
  ctx.strokeStyle = 'rgba(30,16,6,0.55)'; ctx.lineWidth = 0.06;
  for (let q = cen - hw - 6; q < cen + hw + 6; q += 0.6) { ctx.beginPath(); ctx.moveTo(x0, q); ctx.lineTo(x0 + 9, q); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0 - 0.4, cen - hw - 6, 0.4, hw * 2 + 12);
  // pennant line
  ctx.strokeStyle = '#3a2410'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(L, cen - hw); ctx.lineTo(L, cen + hw); ctx.stroke();
  for (let q = -hw + 0.6; q < hw; q += 1.2) {
    ctx.fillStyle = ['#e8452c', '#ffd45a', '#3aa6d6', '#ffffff'][Math.round((q + hw) / 1.2) % 4];
    ctx.beginPath(); ctx.moveTo(L, cen + q); ctx.lineTo(L + 0.9 + Math.sin(t * 4 + q) * 0.08, cen + q + 0.15); ctx.lineTo(L, cen + q + 0.5); ctx.fill();
  }
}
function drawStart(ctx, V, C, t) {
  if (V.s0 > 3) return;
  const hw = halfWidthAt(C, 0);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.1; ctx.setLineDash([0.4, 0.3]);
  ctx.beginPath(); ctx.moveTo(0.4, -hw); ctx.lineTo(0.4, hw); ctx.stroke(); ctx.setLineDash([]);
  for (const side of [-1, 1]) drawPole(ctx, 0.4, side * (hw - 0.4), 0.22, '#e8452c', 0, t);
}

// ---- boats --------------------------------------------------------------------------------------------------------------------------------
const hullPath = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(2.9, 0);
  ctx.bezierCurveTo(2.2, 0.28, 1.2, 0.44, 0.1, 0.46);
  ctx.bezierCurveTo(-1.0, 0.46, -2.0, 0.4, -2.5, 0.3);
  ctx.lineTo(-2.55, -0.3);
  ctx.bezierCurveTo(-2.0, -0.4, -1.0, -0.46, 0.1, -0.46);
  ctx.bezierCurveTo(1.2, -0.44, 2.2, -0.28, 2.9, 0);
  ctx.closePath();
};

export function drawBoat(ctx, b, t, o = {}) {
  const L = typeof b.look === 'number' ? LOOKS[b.look] ?? LOOKS[0] : b.look, me = b.id === 0;
  const lean = b.sway * 0.28;
  ctx.save(); ctx.translate(b.s, b.n); ctx.rotate(b.h);
  const pitch = o.swell ? Math.sin(t * 3 + b.id) * 0.02 : 0;
  ctx.translate(0, pitch);
  // soft shadow on the water
  ctx.fillStyle = 'rgba(0,25,40,0.28)'; ctx.save(); ctx.translate(0.14, 0.16); hullPath(ctx); ctx.fill(); ctx.restore();
  // hull
  const hg = ctx.createLinearGradient(0, -0.46, 0, 0.46);
  hg.addColorStop(0, shade(L.hull, -0.28)); hg.addColorStop(0.35, shade(L.hull, 0.12)); hg.addColorStop(0.65, shade(L.hull, 0.04)); hg.addColorStop(1, shade(L.hull, -0.34));
  ctx.fillStyle = hg; hullPath(ctx); ctx.fill();
  ctx.lineWidth = 0.07; ctx.strokeStyle = shade(L.hull, -0.5); hullPath(ctx); ctx.stroke();
  // trim stripe along the gunwale
  ctx.save(); ctx.scale(0.88, 0.84); ctx.lineWidth = 0.05; ctx.strokeStyle = L.trim; hullPath(ctx); ctx.stroke(); ctx.restore();
  // floor slats and the stern platform
  ctx.save(); ctx.scale(0.86, 0.72); hullPath(ctx); ctx.clip();
  ctx.fillStyle = shade(L.hull, 0.2); ctx.fillRect(-2.7, -0.6, 5.7, 1.2);
  ctx.strokeStyle = shade(L.hull, -0.3); ctx.lineWidth = 0.04;
  for (let x = -2.4; x < 2.8; x += 0.38) { ctx.beginPath(); ctx.moveTo(x, -0.6); ctx.lineTo(x, 0.6); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = shade(L.hull, 0.32); ctx.fillRect(-2.25, -0.26, 0.85, 0.52);
  // catch basket and bow bundle
  ctx.fillStyle = '#7a5428'; ctx.beginPath(); ctx.ellipse(0.3, -0.14, 0.28, 0.2, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#b88a4a'; ctx.beginPath(); ctx.ellipse(0.3, -0.14, 0.2, 0.13, 0, 0, TAU); ctx.fill();
  if (b.fish > 0) { ctx.fillStyle = '#e8f2f4'; for (let i = 0; i < Math.min(5, b.fish); i++) { ctx.beginPath(); ctx.ellipse(0.2 + i * 0.05, -0.2 + (i % 2) * 0.08, 0.09, 0.035, i, 0, TAU); ctx.fill(); } }
  // the oar: pivot on the right gunwale at the stern, the blade swings fore and aft with the pad
  const px = -2.15, py = 0.42, ang = Math.PI / 2 + b.a * 0.72;
  const dx = Math.cos(ang), dy = Math.sin(ang), len = 3.0;
  if (b.inWater && Math.abs(b.a) > 0.001) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.07;
    const bx = px + dx * (len - 0.4), by = py + dy * (len - 0.4);
    ctx.beginPath(); ctx.ellipse(bx, by, 0.35 + (Math.sin(t * 9 + b.id) + 1) * 0.1, 0.22, ang, 0, TAU); ctx.stroke();
  }
  // the standing leg is under the body; the free leg wraps the oar shaft
  const hipx = -1.78, hipy = 0.04;
  const wx = px + dx * 0.95, wy = py + dy * 0.95;
  // rower (drawn over the oar's inner end)
  ctx.save();
  ctx.lineCap = 'round';
  // oar shaft + blade
  ctx.strokeStyle = 'rgba(0,30,40,0.3)'; ctx.lineWidth = 0.1; ctx.beginPath(); ctx.moveTo(px + 0.06, py + 0.08); ctx.lineTo(px + dx * len + 0.06, py + dy * len + 0.08); ctx.stroke();
  ctx.strokeStyle = '#d9b672'; ctx.lineWidth = 0.075; ctx.beginPath(); ctx.moveTo(px - dx * 0.35, py - dy * 0.35); ctx.lineTo(px + dx * (len - 0.7), py + dy * (len - 0.7)); ctx.stroke();
  ctx.save(); ctx.translate(px + dx * (len - 0.7), py + dy * (len - 0.7)); ctx.rotate(ang);
  ctx.fillStyle = b.inWater ? '#7a5a30' : '#9a7440'; ctx.beginPath(); ctx.roundRect(0, -0.12, 0.78, 0.24, 0.1); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(0.05, -0.09, 0.6, 0.05);
  ctx.restore();
  // standing leg: only the foot shows, planted on the stern platform beside the body
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(hipx - 0.06, hipy + 0.2, 0.17, 0.09, 0.2, 0, TAU); ctx.fill();
  // free leg (sarong): thigh and shin with the knee carried forward, the foot hooked round the oar shaft. The knee follows the sweep.
  {
    const hx = hipx + 0.05, hy = hipy + 0.1, fx = wx, fy = wy;
    const mx = (hx + fx) / 2, my = (hy + fy) / 2, d = Math.hypot(fx - hx, fy - hy) || 0.01, ux = (fx - hx) / d, uy = (fy - hy) / d;
    const seg = 0.5 * 1.18 * Math.max(d, 1.05), off = Math.sqrt(Math.max(0.01, seg * seg - (d / 2) * (d / 2)));
    let nx = -uy, ny = ux; if (nx < 0) { nx = -nx; ny = -ny; }          // bend towards the bow
    const kx = mx + nx * off, ky = my + ny * off;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(0,25,40,0.22)'; ctx.lineWidth = 0.24; ctx.beginPath(); ctx.moveTo(hx + 0.05, hy + 0.06); ctx.lineTo(kx + 0.05, ky + 0.06); ctx.lineTo(fx + 0.05, fy + 0.06); ctx.stroke();
    ctx.strokeStyle = L.sarong; ctx.lineWidth = 0.23; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();       // thigh
    ctx.strokeStyle = shade(L.sarong, 0.12); ctx.lineWidth = 0.17; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(fx, fy); ctx.stroke();  // shin
    ctx.fillStyle = shade(L.sarong, 0.25); ctx.beginPath(); ctx.arc(kx, ky, 0.1, 0, TAU); ctx.fill();
    // the foot grips the shaft: heel on one side, toes curled over it
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(fx + dx * 0.1, fy + dy * 0.1, 0.1, 0.19, ang, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(L.skin, -0.3); ctx.lineWidth = 0.03; ctx.beginPath(); ctx.arc(fx + dx * 0.16, fy + dy * 0.16, 0.08, ang - 1.2, ang + 1.2); ctx.stroke();
  }
  // body: torso leaning with the sway, standing on one leg at the stern. Seen from above: shoulders, two jointed arms, a headcloth.
  ctx.translate(hipx, hipy);
  ctx.rotate(lean);
  ctx.fillStyle = 'rgba(0,25,40,0.25)'; ctx.beginPath(); ctx.ellipse(0.1, 0.1, 0.22, 0.34, 0, 0, TAU); ctx.fill();
  const netting = me && (b.net > 0.01 || b.still && b.v < 2.4);
  const spread = 0.45 + (1 - b.poise) * 0.5 + Math.abs(b.sway) * 0.25;
  // hand targets in body space: one hand on the net pole (a point on the pole line), the other flung out for balance
  const poleHand = { x: -1.55 + (0.45) * ((0.4 - (me ? 0.19 : 0.08)) + 1.55) - hipx, y: 0.3 + 0.45 * ((me ? 1.9 - 0.8 : 0.78 - 0.36) - 0.3) - hipy };
  const armSkin = L.skin, armW = 0.095;
  const arm = (sx, sy, hx, hy, bend) => {
    const L1 = 0.3, L2 = 0.28; let dx2 = hx - sx, dy2 = hy - sy, d = Math.hypot(dx2, dy2) || 1e-3; const mx = (L1 + L2) * 0.985;
    if (d > mx) { hx = sx + dx2 / d * mx; hy = sy + dy2 / d * mx; dx2 = hx - sx; dy2 = hy - sy; d = mx; }
    const a2 = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a2 * a2));
    const ex = sx + dx2 / d * a2 + (-dy2 / d) * h * bend, ey = sy + dy2 / d * a2 + (dx2 / d) * h * bend;
    ctx.strokeStyle = 'rgba(0,25,40,0.2)'; ctx.lineWidth = armW + 0.02; ctx.beginPath(); ctx.moveTo(sx + 0.04, sy + 0.04); ctx.lineTo(ex + 0.04, ey + 0.04); ctx.lineTo(hx + 0.04, hy + 0.04); ctx.stroke();
    ctx.strokeStyle = armSkin; ctx.lineWidth = armW; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = armSkin; ctx.beginPath(); ctx.arc(hx, hy, 0.065, 0, TAU); ctx.fill();
  };
  const wob = Math.sin(t * 5 + b.id) * 0.02;
  arm(0.0, 0.25, netting ? poleHand.x + 0.1 : poleHand.x, netting ? poleHand.y + 0.1 : poleHand.y, 0.9);
  arm(0.0, -0.25, 0.3 + wob, -0.25 - spread * 0.95, -0.9);
  // shoulders and shirt: a capsule across the shoulders, darker back line, rolled sleeve ends
  ctx.strokeStyle = L.shirt; ctx.lineWidth = 0.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -0.22); ctx.lineTo(0, 0.22); ctx.stroke();
  ctx.strokeStyle = shade(L.shirt, -0.28); ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.12, 0); ctx.lineTo(0.12, 0); ctx.stroke();
  ctx.strokeStyle = shade(L.shirt, 0.22); ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0.08, -0.2); ctx.lineTo(0.08, 0.2); ctx.stroke();
  // head: hair, a wrapped headcloth with its knot, ears
  ctx.fillStyle = armSkin; for (const e of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0.04, e * 0.145, 0.04, 0.03, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(0,25,40,0.22)'; ctx.beginPath(); ctx.arc(0.08, 0.04, 0.16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#20150e'; ctx.beginPath(); ctx.arc(0.04, 0, 0.15, 0, TAU); ctx.fill();
  const cg = ctx.createRadialGradient(-0.02, -0.04, 0.02, 0.04, 0, 0.17);
  cg.addColorStop(0, shade(L.wrap, 0.3)); cg.addColorStop(1, shade(L.wrap, -0.15));
  ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(0.02, 0, 0.155, 0.15, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = shade(L.wrap, -0.35); ctx.lineWidth = 0.025;
  ctx.beginPath(); ctx.arc(0.02, 0, 0.1, 0.5, 4.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-0.1, -0.08); ctx.quadraticCurveTo(0.02, 0.02, 0.12, 0.08); ctx.stroke();
  ctx.fillStyle = shade(L.wrap, -0.1); ctx.beginPath(); ctx.ellipse(-0.17, 0.05, 0.07, 0.04, 0.5, 0, TAU); ctx.fill();   // knot at the back
  ctx.restore();
  // the conical net: held out to the right while netting or resting folded on the deck
  const nz = me ? 1 : 0;
  const charge = b.net || 0;
  const cx = 0.4, cy = nz ? 1.9 : 0.78, rad = nz ? 0.95 - charge * 0.18 : 0.42;
  ctx.strokeStyle = '#d9b672'; ctx.lineWidth = 0.06;
  ctx.beginPath(); ctx.moveTo(-1.55, 0.3); ctx.lineTo(cx - rad * 0.2, cy - rad * 0.85); ctx.stroke();
  ctx.fillStyle = nz ? `rgba(255,255,255,${0.1 + charge * 0.2})` : 'rgba(255,255,255,0.08)'; ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
  ctx.strokeStyle = nz ? `rgba(255,248,220,${0.65 + charge * 0.3})` : 'rgba(240,230,200,0.8)'; ctx.lineWidth = 0.05;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); ctx.stroke(); }
  ctx.lineWidth = 0.025; for (const f of [0.35, 0.65]) { ctx.beginPath(); ctx.arc(cx, cy, rad * f, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = '#b88a4a'; ctx.beginPath(); ctx.arc(cx, cy, 0.07, 0, TAU); ctx.fill();
  if (nz && charge > 0) { ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.arc(cx, cy, rad + 0.18, -Math.PI / 2, -Math.PI / 2 + TAU * charge); ctx.stroke(); }
  ctx.restore();
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = (v) => clamp(Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)), 0, 255);
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function drawWake(ctx, b, W) {
  ctx.lineCap = 'round';
  for (const p of b.trail) {
    const age = W.t - p.t;
    if (age > 3.4 || p.v < 0.4) continue;
    const k = 1 - age / 3.4, spread = 0.45 + age * 0.55, a = 0.4 * k * Math.min(1, p.v / 2.5);
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 0.1 * (0.5 + k);
    ctx.beginPath(); ctx.moveTo(p.s, p.n - spread); ctx.lineTo(p.s - 0.2, p.n - spread - 0.12); ctx.moveTo(p.s, p.n + spread); ctx.lineTo(p.s - 0.2, p.n + spread + 0.12); ctx.stroke();
    ctx.fillStyle = `rgba(255,255,255,${a * 0.5})`; ctx.beginPath(); ctx.ellipse(p.s, p.n, 0.2 + age * 0.15, 0.35 + age * 0.3, 0, 0, TAU); ctx.fill();
  }
  if (b.v > 0.8) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.8, b.v * 0.22)})`; ctx.lineWidth = 0.1;
    const bx = b.s + 2.7 * Math.cos(b.h), by = b.n + 2.7 * Math.sin(b.h);
    ctx.beginPath(); ctx.moveTo(bx - 0.9, by - 0.55); ctx.quadraticCurveTo(bx - 0.3, by - 0.45, bx, by); ctx.quadraticCurveTo(bx - 0.3, by + 0.45, bx - 0.9, by + 0.55); ctx.stroke();
  }
}

// ---- particles (splashes and fish glitter) live in world metres ------------------------------------------------------------------------------
export function burst(list, rng, s, n, count, col, power = 1) {
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, TAU), sp = rng.range(0.4, 1.6) * power;
    list.push({ s, n, vs: Math.cos(a) * sp, vn: Math.sin(a) * sp, life: 0, max: rng.range(0.4, 0.9), r: rng.range(0.05, 0.12), col });
  }
  if (list.length > 160) list.splice(0, list.length - 160);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.life += dt; p.s += p.vs * dt; p.n += p.vn * dt; p.vs *= 1 - 1.5 * dt; p.vn *= 1 - 1.5 * dt; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life >= list[i].max) list.splice(i, 1);
}
function drawParticles(ctx, list) {
  for (const p of list) {
    const a = 1 - p.life / p.max;
    ctx.fillStyle = rgba(p.col, 0.9 * a); ctx.beginPath(); ctx.arc(p.s, p.n, p.r * (0.6 + a), 0, TAU); ctx.fill();
  }
}

// ---- the whole scene ----------------------------------------------------------------------------------------------------------------------
// `o`: { reveal: { path: [[s,n]...], target: {s,n} } , guide }
export function drawScene(ctx, V, W, t, parts, o = {}) {
  const C = W.course, th = C.theme, me = W.boats[0];
  ctx.save();
  ctx.beginPath(); ctx.rect(V.S.x, V.S.y, V.S.w, V.S.h); ctx.clip();
  drawWaterBase(ctx, V, th);
  worldBegin(ctx, V);
  drawDeep(ctx, V, C, th);
  drawGlints(ctx, V, th, t);
  for (const w of C.swells) drawSwell(ctx, V, C, w, t);
  drawStart(ctx, V, C, t);
  drawBanks(ctx, V, C, th, t);
  drawPier(ctx, V, C, t);
  drawLotus(ctx, V, C, t);
  for (const h of C.hyac) if (h.s + h.r > V.s0 && h.s - h.r < V.s1) drawHyacinth(ctx, h, t);
  C.gates.forEach((g, i) => { if (g.s > V.s0 && g.s < V.s1) drawGate(ctx, g, W.gateRes[i], t); });
  C.stakes.forEach((st, i) => { if (st.s > V.s0 && st.s < V.s1) drawPole(ctx, st.s, st.n, st.r, '#a9824a', W.stakeWob[i], t); });
  const z = me.netter ? null : null; void z;
  for (const sh of W.shoals) if (sh.s > V.s0 && sh.s < V.s1) {
    const near = Math.hypot(sh.s - (me.s + 0.4), sh.n - (me.n + 1.9)) < 2.3;
    drawShoal(ctx, sh, t, near);
  }
  // reveal and hints: the planned line and the chosen spot
  if (o.reveal) {
    const R = o.reveal;
    if (R.path) {
      ctx.setLineDash([0.4, 0.35]); ctx.strokeStyle = 'rgba(255,226,120,0.95)'; ctx.lineWidth = 0.16; ctx.lineJoin = 'round';
      ctx.beginPath(); R.path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); ctx.setLineDash([]);
    }
    if (R.target) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 8);
      ctx.strokeStyle = `rgba(255,226,120,${pulse})`; ctx.lineWidth = 0.14; ctx.beginPath(); ctx.arc(R.target.s, R.target.n, 1.0 + 0.15 * pulse, 0, TAU); ctx.stroke();
    }
  }
  // wakes, then boats back to front by s (so the leader draws last)
  const order = [...W.boats].sort((a, b) => a.s - b.s);
  for (const b of order) drawWake(ctx, b, W);
  for (const b of order) drawBoat(ctx, b, t, { swell: b.inSwell });
  drawParticles(ctx, parts);
  ctx.restore();
  // everything below is in screen space: mist, light, vignette
  drawAtmosphere(ctx, V, th, t, C);
  ctx.restore();
}

function drawAtmosphere(ctx, V, th, t, C) {
  const S = V.S, mistK = C.themeId === 'mist' ? 1 : 0.55;
  // low light from the far end of the channel
  const g = V.land ? ctx.createLinearGradient(S.x + S.w, 0, S.x + S.w * 0.35, 0) : ctx.createLinearGradient(0, S.y, 0, S.y + S.h * 0.65);
  g.addColorStop(0, rgba(th.mist, 0.5 * mistK + 0.1)); g.addColorStop(1, rgba(th.mist, 0));
  ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, S.h);
  const sg = V.land ? ctx.createRadialGradient(S.x + S.w, S.y + S.h * 0.4, 4, S.x + S.w, S.y + S.h * 0.4, S.h * 0.9) : ctx.createRadialGradient(S.x + S.w * 0.65, S.y, 4, S.x + S.w * 0.65, S.y, S.w * 0.9);
  sg.addColorStop(0, rgba(th.sun, 0.55)); sg.addColorStop(1, rgba(th.sun, 0));
  ctx.fillStyle = sg; ctx.fillRect(S.x, S.y, S.w, S.h);
  // drifting mist banks
  const n = 5;
  for (let i = 0; i < n; i++) {
    const u = (hash(i * 3 + 1) + t * (0.004 + 0.003 * hash(i))) % 1, v = hash(i * 7 + 2);
    const cx = V.land ? S.x + S.w * (((u * 1.4) % 1.2) - 0.1) : S.x + S.w * v, cy = V.land ? S.y + S.h * v : S.y + S.h * (((u * 1.4) % 1.2) - 0.1);
    const r = Math.max(S.w, S.h) * (0.28 + 0.12 * hash(i * 5));
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, rgba(th.mist, 0.3 * mistK)); rg.addColorStop(1, rgba(th.mist, 0));
    ctx.fillStyle = rg; ctx.fillRect(S.x, S.y, S.w, S.h);
  }
  if (C.themeId === 'mist') { ctx.fillStyle = rgba(th.mist, 0.18); ctx.fillRect(S.x, S.y, S.w, S.h); }
  // soft vignette
  const vg = ctx.createRadialGradient(S.x + S.w / 2, S.y + S.h / 2, Math.min(S.w, S.h) * 0.45, S.x + S.w / 2, S.y + S.h / 2, Math.max(S.w, S.h) * 0.75);
  vg.addColorStop(0, 'rgba(8,30,44,0)'); vg.addColorStop(1, 'rgba(8,30,44,0.34)');
  ctx.fillStyle = vg; ctx.fillRect(S.x, S.y, S.w, S.h);
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 2;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let q = 0; q < 10; q++) { const r = q % 2 ? size * 0.45 : size, a = -Math.PI / 2 + q * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = i < n ? '#ffd45a' : 'rgba(255,255,255,0.14)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = i < n ? '#a8741a' : 'rgba(255,255,255,0.25)'; ctx.lineJoin = 'round'; ctx.stroke();
    ctx.restore();
  }
}
