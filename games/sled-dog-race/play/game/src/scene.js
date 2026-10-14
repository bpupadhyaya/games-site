// The side-on trail picture: sky, mountains, trees, snow ground with the packed trail, signs, the team and the sled, weather. Pure drawing from
// the state handed in by game.js (info); nothing here keeps state. Metres are scaled by cam.ppm; elevations are exaggerated by VX.
import { elev, slopeAt, roughAt, windowOf, gaitOf } from './sim.js';
import { drawDog, drawSled, drawMusher, drawPine, drawSign, hash, shade } from './art.js';
import { DOGS, SNOW_K } from './consts.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const VX = 2.0;
const FONT = "'Avenir Next', 'Segoe UI', 'Trebuchet MS', system-ui, sans-serif";

export const LOOKS = [
  { name: 'Dawn', sky: ['#27356b', '#7a63a8', '#e7907f', '#ffd7a0'], far: '#8f7ab4', mid: '#6d6597', near: '#4d5a86', snow: ['#fbeef4', '#d9c3dc', '#a88fbc'], shade: '#8f78ad', tree: '#27455a', sun: ['#ffe2a8', 0.78, 0.5], fog: '#f4d6d8' },
  { name: 'Day', sky: ['#4f98dc', '#8fc6f0', '#d6eefc', '#f2faff'], far: '#a9c4e0', mid: '#86a8cc', near: '#5f86b3', snow: ['#ffffff', '#dcebf7', '#a9c8e4'], shade: '#86a8cf', tree: '#1f4d4a', sun: ['#fff6c8', 0.28, 0.2], fog: '#eef6ff' },
  { name: 'Dusk', sky: ['#1b2457', '#4d3f8f', '#c9628a', '#f6a878'], far: '#6a5aa6', mid: '#544a8c', near: '#3c3f78', snow: ['#f2e2f0', '#bfaed8', '#8479b8'], shade: '#7667b0', tree: '#1f3350', sun: ['#ffc58a', 0.2, 0.52], fog: '#d9b4d0' },
  { name: 'Night', sky: ['#040a22', '#0a1a45', '#12356a', '#1d5a86'], far: '#2b4a82', mid: '#213c70', near: '#182d5a', snow: ['#cfe0f5', '#8eaad4', '#5c78b0'], shade: '#4f6aa6', tree: '#0f2a3d', sun: ['#f5f1d8', 0.74, 0.14], fog: '#5a7aaa' },
];

export function makeCam(w, h, rect, land) {
  const ppm = Math.max(18, Math.min(72, Math.min(rect.w / 14.7, rect.h / 7.2)));
  return { w, h, rect, land, ppm };
}

const ridge = (u, s) => 0.5 * Math.sin(u + s) + 0.3 * Math.sin(u * 2.3 + s * 2) + 0.2 * Math.sin(u * 5.1 + s * 3);

function sky(ctx, cam, look, t) {
  const { w, h, rect } = cam, K = LOOKS[look];
  const g = ctx.createLinearGradient(0, 0, 0, rect.y + rect.h * 0.72);
  K.sky.forEach((c, i) => g.addColorStop(i / (K.sky.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const hz = rect.y + rect.h * 0.46;
  if (look === 3) {
    for (let i = 0; i < 90; i++) {
      const sx = hash(i) * w, sy = hash(i + 200) * hz * 0.95, tw = 0.5 + 0.5 * Math.sin(t * (0.8 + hash(i + 9)) + i);
      ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.6 * tw * hash(i + 50)})`; ctx.fillRect(sx, sy, 2, 2);
    }
    for (let b = 0; b < 3; b++) {
      const col = ['120,255,190', '90,220,230', '170,130,255'][b];
      ctx.beginPath(); ctx.moveTo(0, hz * (0.55 + b * 0.08));
      for (let x = 0; x <= w; x += 20) ctx.lineTo(x, hz * (0.25 + b * 0.08) + Math.sin(x * 0.012 + t * 0.35 + b * 2) * 38 + Math.sin(x * 0.03 - t * 0.5 + b) * 16);
      ctx.lineTo(w, hz * (0.62 + b * 0.08)); ctx.closePath();
      const ag = ctx.createLinearGradient(0, hz * 0.1, 0, hz * (0.75 + b * 0.08)); ag.addColorStop(0, `rgba(${col},0.0)`); ag.addColorStop(0.5, `rgba(${col},0.32)`); ag.addColorStop(1, `rgba(${col},0.0)`);
      ctx.fillStyle = ag; ctx.fill();
    }
  }
  const [sc, fx, fy] = K.sun;
  const sx = w * fx, sy = rect.y + rect.h * (fy + 0.12);
  const rg = ctx.createRadialGradient(sx, sy, 4, sx, sy, Math.min(w, 520) * (look === 3 ? 0.25 : 0.55));
  rg.addColorStop(0, look === 3 ? 'rgba(235,240,255,0.5)' : 'rgba(255,240,200,0.75)'); rg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = sc; ctx.beginPath(); ctx.arc(sx, sy, look === 3 ? 30 : 36, 0, TAU); ctx.fill();
  if (look === 3) { ctx.fillStyle = 'rgba(10,26,69,0.35)'; ctx.beginPath(); ctx.arc(sx + 12, sy - 6, 26, 0, TAU); ctx.fill(); }
  if (look !== 3) {
    for (let i = 0; i < 6; i++) {
      const cx = ((hash(i + 31) * (w + 300) + t * (3 + i)) % (w + 300)) - 150, cy = rect.y + rect.h * (0.06 + hash(i + 7) * 0.22), cw = 90 + hash(i + 3) * 120;
      ctx.fillStyle = look === 2 ? 'rgba(255,190,200,0.35)' : 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.ellipse(cx, cy, cw, cw * 0.17, 0, 0, TAU); ctx.ellipse(cx + cw * 0.3, cy - cw * 0.07, cw * 0.55, cw * 0.15, 0, 0, TAU); ctx.fill();
    }
  }
  return hz;
}

function mountains(ctx, cam, look, hz, x, camE, haze) {
  const { w, h, rect } = cam, K = LOOKS[look], ppm = cam.ppm;
  const k = Math.max(0.8, Math.min(1.8, rect.h / 640));
  const layers = [[K.far, 0.03, 0.2, 230 * k, 0.0013, 1.1], [K.mid, 0.07, 0.14, 175 * k, 0.0022, 2.4], [K.near, 0.14, 0.09, 120 * k, 0.0035, 4.0]];
  layers.forEach(([col, par, lift, amp, fr, seed], li) => {
    const base = hz + rect.h * lift * 0.9 - camE * ppm * 0.05 * (li + 1);
    ctx.beginPath(); ctx.moveTo(0, h);
    const off = x * ppm * par;
    for (let sx = 0; sx <= w + 8; sx += 8) {
      const u = (sx + off) * fr * 3.4;
      const y = base - amp * (0.55 + 0.9 * Math.abs(ridge(u, seed)));
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(w, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, base - amp, 0, base + 40);
    g.addColorStop(0, shade(col, 0.28)); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.fill();
    // snow on the tops
    if (li < 2) {
      ctx.beginPath();
      for (let sx = 0; sx <= w + 8; sx += 8) {
        const u = (sx + off) * fr * 3.4, y = base - amp * (0.55 + 0.9 * Math.abs(ridge(u, seed)));
        if (sx === 0) ctx.moveTo(sx, y); else ctx.lineTo(sx, y);
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (haze) { ctx.fillStyle = `rgba(255,255,255,${0.1 * haze * (3 - li)})`; ctx.fillRect(0, base - amp, w, amp + 60); }
  });
}

export function drawScene(ctx, cam, info) {
  const { w, h, rect, ppm } = cam;
  const L = info.L, look = info.look ?? L.look ?? 1, K = LOOKS[look], t = info.time;
  const s = info.s;
  const X = info.x, camE = info.camE ?? elev(L, X);
  const weather = L.weather || 'clear';
  const haze = weather === 'whiteout' ? 2.2 : weather === 'snow' ? 0.8 : 0.15;
  // screen mapping
  const focus = cam.focus != null ? cam.focus : rect.x + rect.w / 2;
  const ax = focus - 4.9 * ppm, gy = Math.min(rect.y + rect.h * (cam.land ? 0.58 : 0.7), cam.gyMax != null ? cam.gyMax : 1e9);
  if (v3.on) {
    // the lit 3D trail is drawn behind this transparent canvas: hand over what it needs and paint nothing here
    v3.frame = { cam, info, ax, gy };
    ctx.clearRect(0, 0, w, h);
    return { sx: (Xw) => ax + (Xw - X) * ppm, sy: (Xw) => gy - (elev(L, Xw) - camE) * ppm * VX, ax, gy };
  }
  const hz = sky(ctx, cam, look, t);
  mountains(ctx, cam, look, hz, X, camE, haze);
  const sx = (Xw) => ax + (Xw - X) * ppm;
  const sy = (Xw) => gy - (elev(L, Xw) - camE) * ppm * VX;
  const ang = (Xw) => Math.atan(slopeAt(L, Xw) * VX);
  const x0 = X - (ax) / ppm - 4, x1 = X + (w - ax) / ppm + 4;

  // distant tree line and back trees (hidden bases behind the ground edge)
  const step = 9;
  for (let i = Math.floor(x0 / step); i <= Math.ceil(x1 / step); i++) {
    for (let k = 0; k < 2; k++) {
      const hx = hash(i * 3 + k * 17), Xw = i * step + hx * step * 0.9;
      if (hash(i * 7 + k) < 0.12) continue;
      const hgt = ppm * (3.2 + hash(i + k * 5) * 3.2) * (k ? 0.8 : 1);
      const px = sx(Xw), py = sy(Xw) - (k ? 24 : 12) - hash(i + 40) * 10;
      ctx.globalAlpha = 1 - Math.min(0.55, haze * 0.18 + k * 0.1);
      drawPine(ctx, px, py + hgt * 0.05, hgt, K.snow[0], shade(K.tree, k ? 0.18 : 0));
    }
  }
  ctx.globalAlpha = 1;

  // the ground
  ctx.beginPath(); ctx.moveTo(0, h);
  const pts = [];
  for (let px = -6; px <= w + 6; px += 6) { const Xw = X + (px - ax) / ppm, y = sy(Xw); pts.push([px, y]); ctx.lineTo(px, y); }
  ctx.lineTo(w, h); ctx.closePath();
  const gg = ctx.createLinearGradient(0, gy - 6 * ppm, 0, h);
  gg.addColorStop(0, K.snow[0]); gg.addColorStop(0.35, K.snow[1]); gg.addColorStop(1, K.snow[2]);
  ctx.fillStyle = gg; ctx.fill();
  // snow drifts: soft shade bands following the surface
  ctx.save(); ctx.clip();
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath(); pts.forEach(([px, y], i) => { const yy = y + k * ppm * 0.7 + Math.sin(px * 0.02 + k * 2 + X * 0.05) * 6; if (i === 0) ctx.moveTo(px, yy); else ctx.lineTo(px, yy); });
    ctx.strokeStyle = K.shade; ctx.globalAlpha = 0.16; ctx.lineWidth = 3 + k; ctx.stroke(); ctx.globalAlpha = 1;
  }
  // sparkles
  for (let i = 0; i < 26; i++) {
    const px = ((hash(i + 3) * w * 1.4 + (t * 3) + i * 31) % (w + 40)), py = gy + hash(i + 9) * (h - gy), tw = Math.sin(t * 3 + i) * 0.5 + 0.5;
    if (py > h) continue; ctx.fillStyle = `rgba(255,255,255,${0.2 + 0.5 * tw})`; ctx.fillRect(px, py, 2, 2);
  }
  ctx.restore();
  // lit edge of the snow
  ctx.beginPath(); pts.forEach(([px, y], i) => (i ? ctx.lineTo(px, y) : ctx.moveTo(px, y)));
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
  // the packed trail: a darker band just under the edge with the runner tracks
  ctx.beginPath(); pts.forEach(([px, y], i) => (i ? ctx.lineTo(px, y + 7) : ctx.moveTo(px, y + 7)));
  for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1] + 0.65 * ppm);
  ctx.closePath(); ctx.fillStyle = K.shade; ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  [0.17, 0.4].forEach((d) => { ctx.beginPath(); pts.forEach(([px, y], i) => (i ? ctx.lineTo(px, y + d * ppm) : ctx.moveTo(px, y + d * ppm))); ctx.stroke(); });
  // rough ice
  for (const [a, b] of L.rough) {
    if (b < x0 || a > x1) continue;
    ctx.beginPath();
    for (let xx = Math.max(a, x0); xx <= Math.min(b, x1); xx += 2) { const px = sx(xx), y = sy(xx) + 3; if (xx === Math.max(a, x0)) ctx.moveTo(px, y); else ctx.lineTo(px, y); }
    for (let xx = Math.min(b, x1); xx >= Math.max(a, x0); xx -= 2) ctx.lineTo(sx(xx), sy(xx) + 0.55 * ppm);
    ctx.closePath(); ctx.fillStyle = 'rgba(150,215,255,0.65)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    for (let xx = Math.ceil(Math.max(a, x0) / 6) * 6; xx < Math.min(b, x1); xx += 6) { const px = sx(xx), y = sy(xx); ctx.beginPath(); ctx.moveTo(px, y + 4); ctx.lineTo(px + 9, y + 0.45 * ppm); ctx.stroke(); }
  }
  // stakes along the trail
  for (let xx = Math.ceil(x0 / 30) * 30; xx < x1; xx += 30) {
    if (xx < 0 || xx > L.len + 20) continue;
    const px = sx(xx), y = sy(xx);
    ctx.fillStyle = '#6b4a2e'; ctx.fillRect(px - 2, y - 1.5 * ppm, 4, 1.5 * ppm);
    ctx.fillStyle = '#ff7a2a'; ctx.fillRect(px - 5, y - 1.7 * ppm, 10, 0.4 * ppm);
  }
  // steep warning signs
  for (const [a] of L.steep) {
    const Xw = a - 36; if (Xw < x0 || Xw > x1) continue;
    const px = sx(Xw), y = sy(Xw), z = ppm;
    ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 2, y - 2.2 * z, 4, 2.2 * z);
    ctx.save(); ctx.translate(px, y - 2.7 * z); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(-0.55 * z, -0.55 * z, 1.1 * z, 1.1 * z); ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 2; ctx.strokeRect(-0.55 * z, -0.55 * z, 1.1 * z, 1.1 * z);
    ctx.rotate(-Math.PI / 4); ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.moveTo(-0.2 * z, -0.25 * z); ctx.lineTo(0.2 * z, -0.25 * z); ctx.lineTo(0, 0.25 * z); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // junction signs
  L.jx.forEach((j, k) => {
    if (j.x < x0 - 4 || j.x > x1) return;
    const lit = s && s.phase === 'run' && j.state === 'ahead' && s.x >= j.x - windowOf(L) && s.x < j.x;
    ctx.save();
    const px = sx(j.x), y = sy(j.x), z = ppm;
    ctx.translate(0, 0);
    if (j.state === 'missed') ctx.globalAlpha = 0.85;
    drawSign(ctx, px, y, z * 1.05, j.dir, lit && Math.sin(t * 9) > -0.2, j.dir === 'R' ? 'GEE' : 'HAW', FONT);
    ctx.restore();
    // the side trail leaving the main trail (the marked way shown by a bright cut)
    ctx.strokeStyle = j.dir === 'R' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.setLineDash([7, 8]);
    ctx.beginPath(); ctx.moveTo(px, y + 0.3 * z); ctx.lineTo(px + (j.dir === 'R' ? 1 : -1) * 3 * z, y - 0.8 * z); ctx.stroke(); ctx.setLineDash([]);
    if (j.state === 'ok') { ctx.fillStyle = '#5be08a'; ctx.font = `800 ${Math.round(0.9 * z)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('✓', px, y - 3.8 * z); }
    if (j.state === 'missed') { ctx.fillStyle = '#ff7a6a'; ctx.font = `800 ${Math.round(0.9 * z)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('×', px, y - 3.8 * z); }
  });
  // start and finish
  const arch = (Xw, label, col) => {
    if (Xw < x0 - 6 || Xw > x1 + 6) return;
    const px = sx(Xw), y = sy(Xw), z = ppm * 0.72;
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 0.28 * z;
    ctx.beginPath(); ctx.moveTo(px - 3.2 * z, y); ctx.lineTo(px - 3.2 * z, y - 5 * z); ctx.moveTo(px + 3.2 * z, y); ctx.lineTo(px + 3.2 * z, y - 5 * z); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(px - 3.7 * z, y - 6.2 * z, 7.4 * z, 1.5 * z, 0.3 * z); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(0.8 * z)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, px, y - 5.45 * z); ctx.textBaseline = 'alphabetic';
    // chequered edge
    for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#1a1f2e'; ctx.fillRect(px - 3.7 * z + i * 0.617 * z, y - 4.7 * z, 0.617 * z, 0.3 * z); }
  };
  const isLast = s ? s.leg + 1 >= s.legCount : false;
  if (L.idx === 0 || info.showStart) arch(0, 'START', '#2a6fb5');
  if (isLast) arch(L.len, 'FINISH', '#c8452a');
  else {
    // checkpoint cabin with a lit window and smoke
    const Xc = L.len + 15.5;
    if (Xc > x0 - 8 && Xc < x1 + 8) {
      const px = sx(Xc), y = sy(Xc), z = ppm;
      ctx.fillStyle = 'rgba(20,34,80,0.2)'; ctx.beginPath(); ctx.ellipse(px, y + 4, 4.2 * z, 0.35 * z, 0, 0, TAU); ctx.fill();
      const wg = ctx.createLinearGradient(0, y - 4 * z, 0, y); wg.addColorStop(0, '#9a6a3c'); wg.addColorStop(1, '#6a4524');
      ctx.fillStyle = wg; ctx.fillRect(px - 3.4 * z, y - 3.4 * z, 6.8 * z, 3.4 * z);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; for (let k = 1; k < 5; k++) { ctx.beginPath(); ctx.moveTo(px - 3.4 * z, y - k * 0.68 * z); ctx.lineTo(px + 3.4 * z, y - k * 0.68 * z); ctx.stroke(); }
      ctx.fillStyle = '#e9eef6'; ctx.beginPath(); ctx.moveTo(px - 4 * z, y - 3.3 * z); ctx.lineTo(px, y - 5.6 * z); ctx.lineTo(px + 4 * z, y - 3.3 * z); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd877'; ctx.fillRect(px - 2.5 * z, y - 2.6 * z, 1.4 * z, 1.1 * z); ctx.fillRect(px + 1.1 * z, y - 2.6 * z, 1.4 * z, 1.1 * z);
      ctx.fillStyle = 'rgba(255,215,120,0.18)'; ctx.beginPath(); ctx.arc(px - 1.8 * z, y - 2 * z, 2 * z, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(px + 1.8 * z, y - 2 * z, 2 * z, 0, TAU); ctx.fill();
      ctx.fillStyle = '#5a3a22'; ctx.fillRect(px - 0.4 * z, y - 1.8 * z, 0.8 * z, 1.8 * z);
      for (let k = 0; k < 5; k++) { const a = ((t * 0.35 + k * 0.2) % 1); ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - a)})`; ctx.beginPath(); ctx.arc(px + 2 * z + a * 0.9 * z, y - 5.8 * z - a * 2.4 * z, (0.25 + a * 0.4) * z, 0, TAU); ctx.fill(); }
    }
    arch(L.len, 'CHECKPOINT', '#2a9d8f');
    // straw for the team to rest on
    if (s && s.phase === 'stop') {
      for (let k = 0; k < 3; k++) {
        for (const off of [0, 0.55]) {
          const Xw = X + 3.9 + k * 3.6 + off, px = sx(Xw), y = sy(Xw) + 6 - (off ? 0.2 * ppm : 0);
          ctx.fillStyle = '#d9b25a'; ctx.beginPath(); ctx.ellipse(px, y, 1.7 * ppm, 0.26 * ppm, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#a8803a'; ctx.lineWidth = 1.5; for (let q = 0; q < 6; q++) { ctx.beginPath(); ctx.moveTo(px - 1.3 * ppm + q * 0.5 * ppm, y); ctx.lineTo(px - 1.1 * ppm + q * 0.5 * ppm, y - 5); ctx.stroke(); }
        }
      }
    }
  }

  // ---- the rival ghost
  if (info.ghost && Math.abs(info.ghost.x - X) < 40 && Math.abs(info.ghost.x - X) > 7 && info.ghost.leg === L.idx && s && s.phase === 'run') {
    const gx = info.ghost.x, px = sx(gx), y = sy(gx);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.translate(px, y); ctx.rotate(ang(gx)); 
    drawSled(ctx, 0, 0, ppm, {});
    for (let k = 0; k < 3; k++) drawDog(ctx, (4 + k * 3.4) * ppm, 0, ppm, (info.time * 2.2 + k * 0.13) % 1, { coat: ['#c9d3df', '#5d6a7b', '#e8eef5'], gait: 3, pose: 'run', harness: info.ghost.col });
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.fillStyle = info.ghost.col; ctx.beginPath(); ctx.arc(px + 4 * ppm, y - 3.8 * ppm, 7, 0, TAU); ctx.fill();
  }

  // ---- the team
  const phase = s ? s.phase : 'ready';
  const moving = s && s.phase === 'run' && s.v > 0.3;
  const gait = s ? (moving ? Math.min(4, 1 + Math.floor(s.pace * 4.2)) : 0) : 2;
  const stride = s ? s.stride : t * 1.4;
  const resting = phase === 'stop';
  const brake = !!(s && s.brake && moving);
  // gangline path
  const PS = 2.8, pairX = [X + 3.9, X + 3.9 + PS, X + 3.9 + 2 * PS];
  const dogPos = (i) => {
    const pair = i >> 1, far = i & 1;
    return { Xw: pairX[2 - pair] + (far ? 0.55 : 0), far };
  };
  const slopeAng = ang(X + 5);
  ctx.strokeStyle = 'rgba(60,40,26,0.8)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx(X + 1.8), sy(X + 1.8) - 0.65 * ppm);
  pairX.forEach((px2) => ctx.lineTo(sx(px2), sy(px2) - 0.95 * ppm * 1.0)); ctx.stroke();
  // far dogs first, then near, so near dogs overlap
  const order = [5, 3, 1, 4, 2, 0];
  for (const i of order) {
    const { Xw, far } = dogPos(i), d = s ? s.dogs[i] : null;
    const px = sx(Xw), y = sy(Xw) - (far ? 0.2 * ppm : 0);
    if (d && d.riding) continue;
    ctx.save(); ctx.translate(px, y); ctx.rotate(ang(Xw));
    const def = DOGS[i];
    const pose = resting ? (info.sel === i ? 'sit' : 'lie') : moving ? 'run' : 'stand';
    const ph = (stride * 1.0 + i * 0.11 + (far ? 0.25 : 0)) % 1;
    drawDog(ctx, 0, 0, ppm, ph, { coat: def.coat, gait, pose, dim: far ? 0.32 : 0, tongue: moving && gait >= 3, harness: '#e0683a' });
    ctx.restore();
    // breath puffs in the cold
    if (!far || true) {
      const bt = (t * 0.7 + i * 0.37) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - bt)})`; ctx.beginPath(); ctx.arc(px + 1.35 * ppm + bt * 0.7 * ppm, y - (pose === 'lie' ? 0.35 : 1.0) * ppm * 1.55 - bt * 0.5 * ppm, (0.12 + bt * 0.22) * ppm, 0, TAU); ctx.fill();
    }
  }
  // sled and musher
  const riders = s ? s.dogs.filter((d) => d.riding).length : 0;
  const a0 = ang(X);
  ctx.save(); ctx.translate(sx(X), sy(X)); ctx.rotate(a0);
  drawSled(ctx, 0, 0, ppm, { riders, brake });
  const climbing = s && moving && slopeAt(L, X) > 0.045 && s.v < 7.5;
  const lean = brake ? -0.18 : s && moving ? Math.max(-0.1, Math.min(0.2, s.pace * 0.18 - slopeAt(L, X) * 0.8)) : 0;
  drawMusher(ctx, -2.15 * ppm, -0.1 * ppm, ppm, { lean, kick: climbing ? 1 : 0, ph: stride * 0.5, wave: phase === 'finished' });
  ctx.restore();
  // snow spray under the runners and the brake
  if (moving) {
    for (let k = 0; k < 7; k++) {
      const age = ((t * 2.6 + k / 7) % 1), px = sx(X) - (1.5 + age * 3.2) * ppm, py = sy(X - 1.5 - age * 3.2) - (0.1 + age * 0.7 * (0.5 + hash(k))) * ppm;
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - age) * Math.min(1, s.v / 6 + (brake ? 0.6 : 0))})`; ctx.beginPath(); ctx.arc(px, py, (0.1 + age * 0.25) * ppm * (brake ? 1.5 : 1), 0, TAU); ctx.fill();
    }
  }
  // praise hearts
  if (info.praiseT > 0) {
    const a = info.praiseT; // 1 -> 0
    for (let k = 0; k < 4; k++) {
      const Xw = X + 4 + k * 2.4, px = sx(Xw), py = sy(Xw) - (2.6 + (1 - a) * 1.6 + k * 0.1) * ppm;
      ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = '#ff7a9a'; ctx.font = `800 ${Math.round(0.9 * ppm)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('♥', px, py);
    }
    ctx.globalAlpha = 1;
  }
  // a plan line on the trail ahead (Think hint): a bright strip over the trail between two points
  if (info.plan) {
    const [a, b] = info.plan.span;
    ctx.beginPath();
    for (let xx = a; xx <= b; xx += 2) { const px = sx(xx), y = sy(xx) - 6; if (xx === a) ctx.moveTo(px, y); else ctx.lineTo(px, y); }
    ctx.strokeStyle = info.plan.col || '#ffd54a'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 6); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // foreground drifts and tufts below the trail, moving faster than the trail for depth
  {
    const fx = X * 1.35;
    for (let i = Math.floor((fx - 12) / 11); i <= Math.ceil((fx + w / ppm + 14) / 11); i++) {
      const hx = hash(i * 5 + 2), px = ax + (i * 11 + hx * 7 - fx) * ppm, wdt = (4 + hash(i + 8) * 7) * ppm, hgt = (0.5 + hash(i + 13) * 0.7) * ppm;
      const py = gy + (1.6 + hash(i + 21) * 4.2) * ppm * 0.9 + 40;
      if (py > h + 20) continue;
      ctx.fillStyle = K.snow[2]; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(px, py, wdt, hgt, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = K.snow[0]; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(px - wdt * 0.1, py - hgt * 0.2, wdt * 0.86, hgt * 0.7, 0, 0, TAU); ctx.fill();
      if (hash(i + 33) > 0.55) { ctx.globalAlpha = 1; ctx.strokeStyle = shade(K.tree, 0.25); ctx.lineWidth = 2; for (let q = 0; q < 5; q++) { ctx.beginPath(); ctx.moveTo(px - 10 + q * 5, py - hgt * 0.4); ctx.lineTo(px - 14 + q * 7, py - hgt * 0.4 - 16 - q * 2); ctx.stroke(); } }
    }
    ctx.globalAlpha = 1;
  }
  // ---- front trees, weather
  for (let i = Math.floor(x0 / 23); i <= Math.ceil(x1 / 23); i++) {
    const Xw = i * 23 + hash(i + 77) * 14;
    if (Xw > X - 5 && Xw < X + 15) continue;
    if (hash(i + 5) < 0.55) continue;
    const px = sx(Xw), py = sy(Xw) + 0.9 * ppm + 40 + hash(i) * 30, hh = ppm * (6 + hash(i + 1) * 3);
    ctx.globalAlpha = 0.95; drawPine(ctx, px, py, hh, K.snow[0], shade(K.tree, -0.15));
  }
  ctx.globalAlpha = 1;
  // fog for the weather
  if (weather !== 'clear') {
    const fa = weather === 'whiteout' ? 0.5 : 0.14;
    ctx.fillStyle = K.fog; ctx.globalAlpha = fa; ctx.fillRect(0, rect.y, w, rect.h); ctx.globalAlpha = 1;
  }
  const flakes = weather === 'whiteout' ? 150 : weather === 'snow' ? 70 : 14;
  const vsp = weather === 'whiteout' ? 160 : 60, wind = weather === 'whiteout' ? 200 : 40;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < flakes; i++) {
    const fxx = ((hash(i) * w * 1.2 + t * wind * (0.6 + hash(i + 1)) - (X * ppm * 0.3)) % (w + 30) + w + 30) % (w + 30) - 10;
    const fyy = ((hash(i + 99) * h + t * vsp * (0.6 + hash(i + 2))) % h);
    const r = 1.2 + hash(i + 7) * 2.2; ctx.beginPath(); ctx.arc(fxx, fyy, r, 0, TAU); ctx.fill();
  }
  // night and dusk: warm pools of light are the cabin windows only; vignette for depth
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(8,14,40,0)'); vg.addColorStop(1, 'rgba(8,14,40,0.28)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  return { sx, sy, ax, gy };
}
