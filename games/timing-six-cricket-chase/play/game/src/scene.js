// The two pictures of cricket: the batter's-eye perspective view down the pitch, and the overhead field.
// Static scenery is drawn once into offscreen layers (when the host has OffscreenCanvas) and blitted.
import { W, H, THEMES, fenceR, centreOf, clamp, lerp, DEG, ease } from './core.js';
import { PAL, FONT, SANS, hash, rr, shade, mix, vGrad, glow, drawBall, drawTrail, drawStumps, drawBin, drawPerson, drawBat, drawTopPerson, KIT, textFill } from './art.js';
import { deliveryPos } from './ball.js';

export const CAM = { f: 1050, x: 0, y: 1.95, z: -4.2, hy: 455 };
const layerCache = new Map();
function layer(key, w, h, fn) {
  let L = layerCache.get(key);
  if (L === undefined) {
    const mk = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : null;
    if (mk) { const c = mk.getContext('2d'); fn(c); L = mk; } else L = null;
    layerCache.set(key, L);
  }
  return L;
}
export function dropLayers() { layerCache.clear(); }

export function makeProj(hand = 1, cam = CAM) {
  return (x, y, z) => {
    const zc = Math.max(0.3, z - cam.z), k = cam.f / zc;
    return [360 + (x * hand - cam.x) * k, cam.hy - (y - cam.y) * k, k];
  };
}

// ---- sky and skylines ----------------------------------------------------------------------------------------------
export function drawSky(ctx, w, hzn, warm = 0) {
  ctx.fillStyle = vGrad(ctx, 0, hzn, [[0, '#2b4a82'], [0.4, '#6f78a8'], [0.62, '#e58f72'], [0.85, '#ffc88a'], [1, '#ffe3ab']]);
  ctx.fillRect(0, 0, w, hzn + 2);
  glow(ctx, 590, hzn - 52, 300, 'rgba(255,225,160,A)', 0.9);
  ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(590, hzn - 52, 38, 0, Math.PI * 2); ctx.fill();
  glow(ctx, 590, hzn - 52, 90, 'rgba(255,255,230,A)', 0.8);
  // clouds
  for (let i = 0; i < 7; i++) {
    const cx = hash(i * 7 + 1) * w, cy = 70 + hash(i * 7 + 2) * (hzn * 0.55), cw = 120 + hash(i * 7 + 3) * 170;
    const g = ctx.createLinearGradient(0, cy - 14, 0, cy + 16);
    g.addColorStop(0, 'rgba(255,214,190,0.55)'); g.addColorStop(1, 'rgba(255,150,120,0.0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, cw, 14 + hash(i + 40) * 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + cw * 0.3, cy - 8, cw * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawStadiumBackdrop(ctx, hzn) {
  drawSky(ctx, W, hzn);
  // floodlight towers
  for (const x of [88, 360, 640]) {
    ctx.fillStyle = '#41405a'; ctx.fillRect(x - 3, hzn - 250, 6, 250);
    ctx.fillStyle = '#2c2b44'; rr(ctx, x - 40, hzn - 292, 80, 46, 5); ctx.fill();
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = hash(r * 9 + c + x) > 0.3 ? '#fff4c8' : '#e8c878'; ctx.fillRect(x - 36 + c * 12.5, hzn - 288 + r * 14, 9, 10); }
    glow(ctx, x, hzn - 268, 90, 'rgba(255,238,190,A)', 0.45);
  }
  // far city
  ctx.fillStyle = 'rgba(70,60,100,0.55)';
  for (let i = 0; i < 34; i++) { const bx = i * 22 - 8, bh = 20 + hash(i + 90) * 46; ctx.fillRect(bx, hzn - 112 - bh * 0.4, 20, bh); }
  // stands: three tiers with crowd
  const top = hzn - 118;
  ctx.fillStyle = vGrad(ctx, top, hzn, [[0, '#4b3f6b'], [1, '#2a2240']]);
  ctx.beginPath(); ctx.moveTo(0, top + 26); ctx.lineTo(W, top + 8); ctx.lineTo(W, hzn); ctx.lineTo(0, hzn); ctx.closePath(); ctx.fill();
  for (let tier = 0; tier < 3; tier++) {
    const y0 = top + 26 + tier * 26;
    for (let i = 0; i < 140; i++) {
      const x = hash(i * 3 + tier * 500) * W, y = y0 + 4 + hash(i * 3 + 1 + tier * 500) * 18;
      const c = ['#ffcf6b', '#2ec4b6', '#ff6b57', '#f4ead2', '#6aa3ff', '#ff9fc0'][Math.floor(hash(i * 3 + 2 + tier * 500) * 6)];
      ctx.fillStyle = c; ctx.globalAlpha = 0.85; ctx.fillRect(x, y, 4, 5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,214,150,0.18)'; ctx.fillRect(0, y0 + 24, W, 2);
  }
  // roof lip
  ctx.fillStyle = vGrad(ctx, top - 6, top + 22, [[0, '#d9d2e6'], [1, '#8d84a8']]);
  ctx.beginPath(); ctx.moveTo(0, top + 12); ctx.lineTo(W, top - 6); ctx.lineTo(W, top + 6); ctx.lineTo(0, top + 26); ctx.closePath(); ctx.fill();
  // hoardings
  const hb = ['#e8553f', '#2ec4b6', '#ffcf6b', '#6aa3ff', '#f4ead2'];
  for (let i = 0; i < 18; i++) { ctx.fillStyle = hb[i % hb.length]; ctx.fillRect(i * 40, hzn - 16, 38, 14); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(i * 40, hzn - 16, 38, 3); }
  // sight screen
  ctx.fillStyle = '#f7f3ea'; ctx.fillRect(318, hzn - 66, 84, 50); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(318, hzn - 66, 84, 6);
}

function drawBackyardBackdrop(ctx, hzn) {
  drawSky(ctx, W, hzn);
  // far rooftops
  ctx.fillStyle = 'rgba(94,72,110,0.55)';
  for (let i = 0; i < 9; i++) { const x = i * 86 - 20, h = 22 + hash(i + 3) * 18; ctx.beginPath(); ctx.moveTo(x, hzn - 40); ctx.lineTo(x + 42, hzn - 40 - h); ctx.lineTo(x + 84, hzn - 40); ctx.closePath(); ctx.fill(); }
  // neighbour house, left
  ctx.fillStyle = '#f2d7b0'; ctx.fillRect(-10, hzn - 130, 260, 100);
  ctx.fillStyle = '#c4553f'; ctx.beginPath(); ctx.moveTo(-20, hzn - 128); ctx.lineTo(120, hzn - 190); ctx.lineTo(262, hzn - 128); ctx.closePath(); ctx.fill();
  for (let r = 0; r < 4; r++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-10 + r * 4, hzn - 168 + r * 9, 260 - r * 8, 2); }
  for (const x of [30, 150]) { ctx.fillStyle = '#ffd98a'; ctx.fillRect(x, hzn - 108, 54, 44); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(x + 25, hzn - 108, 4, 44); ctx.fillRect(x, hzn - 88, 54, 4); glow(ctx, x + 27, hzn - 86, 70, 'rgba(255,200,110,A)', 0.4); }
  ctx.fillStyle = '#dca472'; ctx.fillRect(196, hzn - 130, 14, 30);
  // gum tree right
  const tx = 592;
  ctx.fillStyle = vGrad(ctx, hzn - 250, hzn, [[0, '#7a5a48'], [1, '#4a362c']]);
  ctx.beginPath(); ctx.moveTo(tx - 12, hzn - 24); ctx.quadraticCurveTo(tx - 6, hzn - 120, tx - 22, hzn - 210); ctx.lineTo(tx - 6, hzn - 214); ctx.quadraticCurveTo(tx + 6, hzn - 130, tx + 14, hzn - 24); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 16; i++) { const a = hash(i + 700) * 6.28, d = 20 + hash(i + 710) * 70; ctx.fillStyle = mix('#5f8a50', '#a9c06a', hash(i + 720)); ctx.globalAlpha = 0.92; ctx.beginPath(); ctx.ellipse(tx - 14 + Math.cos(a) * d * 1.2, hzn - 226 + Math.sin(a) * d * 0.55, 40 + hash(i + 730) * 22, 22 + hash(i + 740) * 10, hash(i) - 0.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
  // jacaranda, left of centre
  for (let i = 0; i < 9; i++) { ctx.fillStyle = mix('#9b7bd6', '#c9a6f0', hash(i + 800)); ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.ellipse(300 + hash(i + 810) * 70, hzn - 98 - hash(i + 820) * 34, 30 + hash(i + 830) * 20, 20, 0, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  // clothes hoist
  const hx = 438;
  ctx.strokeStyle = '#d9d2c8'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(hx, hzn - 4); ctx.lineTo(hx, hzn - 118); ctx.stroke();
  ctx.lineWidth = 2;
  for (const [dx, dy] of [[-62, 24], [62, 24], [-34, 8], [34, 8]]) { ctx.beginPath(); ctx.moveTo(hx, hzn - 118); ctx.lineTo(hx + dx, hzn - 118 + dy); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(230,224,214,0.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(hx - 62, hzn - 94); ctx.lineTo(hx - 34, hzn - 110); ctx.lineTo(hx + 34, hzn - 110); ctx.lineTo(hx + 62, hzn - 94); ctx.stroke();
  const cl = ['#ff6b57', '#2ec4b6', '#ffcf6b', '#f4ead2'];
  for (let i = 0; i < 6; i++) { ctx.fillStyle = cl[i % 4]; const px = hx - 55 + i * 18, py = hzn - 106 + Math.abs(i - 2.5) * 3; ctx.fillRect(px, py, 11, 18 + (i % 2) * 6); }
  // fence: palings
  ctx.fillStyle = '#6d4d36'; ctx.fillRect(0, hzn - 46, W, 50);
  for (let x = 0; x < W; x += 16) {
    const c = mix('#a3774f', '#c79a6a', hash(x * 0.37));
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, hzn + 2); ctx.lineTo(x, hzn - 42); ctx.lineTo(x + 7, hzn - 50); ctx.lineTo(x + 14, hzn - 42); ctx.lineTo(x + 14, hzn + 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 13, hzn - 44, 2, 46);
    ctx.fillStyle = 'rgba(255,230,180,0.18)'; ctx.fillRect(x + 1, hzn - 42, 2, 44);
  }
  ctx.fillStyle = '#5a3e2a'; ctx.fillRect(0, hzn - 30, W, 5); ctx.fillRect(0, hzn - 10, W, 5);
  // birds
  ctx.strokeStyle = 'rgba(60,40,70,0.7)'; ctx.lineWidth = 2;
  for (const [bx, by] of [[200, 120], [236, 100], [262, 134]]) { ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.quadraticCurveTo(bx - 4, by - 8, bx, by); ctx.quadraticCurveTo(bx + 4, by - 8, bx + 10, by); ctx.stroke(); }
}

function drawBeachBackdrop(ctx, hzn) {
  drawSky(ctx, W, hzn);
  // sea
  ctx.fillStyle = vGrad(ctx, hzn - 92, hzn - 18, [[0, '#2fa5b8'], [1, '#0f6f8a']]);
  ctx.fillRect(0, hzn - 92, W, 76);
  glow(ctx, 590, hzn - 70, 220, 'rgba(255,224,150,A)', 0.55);
  for (let i = 0; i < 22; i++) { const y = hzn - 88 + i * 3.4, wv = hash(i) * 30; ctx.strokeStyle = `rgba(255,255,255,${0.1 + hash(i + 5) * 0.18})`; ctx.lineWidth = 1.5; ctx.beginPath(); for (let x = 0; x <= W; x += 16) { const yy = y + Math.sin(x * 0.05 + wv) * 1.6; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke(); }
  // sail
  ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.moveTo(180, hzn - 96); ctx.lineTo(180, hzn - 134); ctx.lineTo(204, hzn - 98); ctx.closePath(); ctx.fill();
  // foam line & wet sand
  ctx.fillStyle = vGrad(ctx, hzn - 22, hzn + 6, [[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,240,210,0.6)'], [1, 'rgba(210,170,110,0)']]);
  ctx.fillRect(0, hzn - 22, W, 28);
  // dunes + grass
  ctx.fillStyle = '#e4c286';
  ctx.beginPath(); ctx.moveTo(0, hzn - 30); ctx.quadraticCurveTo(80, hzn - 70, 160, hzn - 40); ctx.quadraticCurveTo(210, hzn - 20, 250, hzn - 20); ctx.lineTo(0, hzn); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 20; i++) { const gx = 6 + i * 9 + hash(i) * 5, gy = hzn - 34 - Math.sin(i * 0.3) * 8; ctx.strokeStyle = '#6a9a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + 4, gy - 14, gx + 10, gy - 20); ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx - 3, gy - 10, gx - 6, gy - 16); ctx.stroke(); }
  // palms
  const palm = (x, base, h, lean) => {
    ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + lean * 0.5, base - h * 0.5, x + lean, base - h); ctx.stroke();
    ctx.strokeStyle = '#8a6a48'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 3, base); ctx.quadraticCurveTo(x + lean * 0.5 - 3, base - h * 0.5, x + lean - 3, base - h); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI * 0.95 + i * (Math.PI * 0.9 / 7);
      ctx.strokeStyle = i % 2 ? '#3d8a4a' : '#2f7a42'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x + lean, base - h); ctx.quadraticCurveTo(x + lean + Math.cos(a) * 46, base - h + Math.sin(a) * 40 - 10, x + lean + Math.cos(a) * 82, base - h + Math.sin(a) * 30 + 28); ctx.stroke();
    }
  };
  palm(60, hzn + 6, 210, 34); palm(640, hzn + 6, 240, -40); palm(690, hzn + 6, 170, 24);
  // umbrella
  ctx.fillStyle = '#7a5a3a'; ctx.fillRect(402, hzn - 62, 3, 62);
  for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff4dc' : '#ff6b57'; ctx.beginPath(); ctx.moveTo(404, hzn - 66); ctx.arc(404, hzn - 40, 48, Math.PI * (1.08 + i * 0.14), Math.PI * (1.22 + i * 0.14)); ctx.closePath(); ctx.fill(); }
}

export function backdropLayer(theme, hzn, soft = true) {
  const w = soft ? 360 : W, h = soft ? Math.round((hzn + 8) / 2) : hzn + 8;
  return layer(`bd-${theme}-${soft}`, w, h, (c) => {
    if (soft) c.scale(0.5, 0.5);
    (theme === 'backyard' ? drawBackyardBackdrop : theme === 'beach' ? drawBeachBackdrop : drawStadiumBackdrop)(c, hzn);
  });
}
export function drawBackdrop(ctx, theme, hzn) {
  const L = backdropLayer(theme, hzn, true);
  if (L) {
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(L, 0, 0, W, (hzn + 8));
    ctx.restore();
  } else (theme === 'backyard' ? drawBackyardBackdrop : theme === 'beach' ? drawBeachBackdrop : drawStadiumBackdrop)(ctx, hzn);
}

// ---- delivery view -------------------------------------------------------------------------------------------------
function drawGround(ctx, P, theme, hand) {
  const th = THEMES[theme];
  const hy = CAM.hy;
  const base = theme === 'beach' ? ['#d9b878', '#efd8a0', '#bd9858'] : theme === 'backyard' ? ['#7ab35a', '#4f9a3f', '#2f7a2c'] : ['#6dab48', '#3d8a3a', '#256a2a'];
  ctx.fillStyle = vGrad(ctx, hy - 2, H, [[0, mix(base[0], '#ffd9a0', 0.35)], [0.08, base[0]], [0.45, base[1]], [1, base[2]]]);
  ctx.fillRect(0, hy - 2, W, H - hy + 2);
  // mow stripes (bands along z)
  const L = th.pitchLen;
  for (let i = 0, z = -6; z < L + 40; z += 3, i++) {
    if (i % 2) continue;
    const a = P(-60, 0, z), b = P(60, 0, z), c = P(60, 0, z + 3), d = P(-60, 0, z + 3);
    ctx.fillStyle = theme === 'beach' ? 'rgba(255,240,200,0.10)' : 'rgba(255,255,160,0.075)';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
  }
  // haze near horizon (depth of field)
  ctx.fillStyle = vGrad(ctx, hy - 2, hy + 90, [[0, 'rgba(255,214,160,0.55)'], [1, 'rgba(255,214,160,0)']]);
  ctx.fillRect(0, hy - 2, W, 92);
  // pitch strip
  const pw = theme === 'backyard' ? 2.6 : 3.05;
  const q = (x, z) => P(x, 0, z);
  const pc = theme === 'backyard' ? ['#a89f94', '#8a8176'] : theme === 'beach' ? ['#a9895a', '#8d6f44'] : ['#cdb987', '#b49c68'];
  const z0 = -2.4, z1 = L + 1.4;
  const A = q(-pw / 2, z0), B = q(pw / 2, z0), C = q(pw / 2, z1), D = q(-pw / 2, z1);
  ctx.fillStyle = vGrad(ctx, D[1], A[1], [[0, pc[1]], [1, pc[0]]]);
  ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(C[0], C[1]); ctx.lineTo(D[0], D[1]); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(70,50,20,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  // wear marks
  for (let i = 0; i < 26; i++) { const z = 1 + hash(i + 11) * (L - 3), x = (hash(i + 31) - 0.5) * pw * 0.7, p = q(x, z); ctx.fillStyle = 'rgba(90,60,30,0.09)'; ctx.beginPath(); ctx.ellipse(p[0], p[1], p[2] * 0.22, p[2] * 0.06, 0, 0, 7); ctx.fill(); }
  // creases
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.lineWidth = 2.4;
  const line = (xa, za, xb, zb) => { const a = q(xa, za), b = q(xb, zb); ctx.lineWidth = Math.max(1.2, 0.05 * Math.min(a[2], b[2])); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  line(-pw / 2 - 0.2, 1.22, pw / 2 + 0.2, 1.22); line(-1.32, 0, 1.32, 0); line(-1.32, 0, -1.32, 1.22 + 0.3); line(1.32, 0, 1.32, 1.52);
  line(-pw / 2 - 0.2, L - 1.22, pw / 2 + 0.2, L - 1.22); line(-1.32, L, 1.32, L);
  // foreground darkening and grain so the near ground feels deep
  ctx.fillStyle = vGrad(ctx, 960, H, [[0, 'rgba(20,14,10,0)'], [1, 'rgba(20,14,10,0.5)']]);
  ctx.fillRect(0, 960, W, H - 960);
}

function wicketAt(ctx, P, theme, z, broken) {
  const th = THEMES[theme];
  const p = P(0, 0, z);
  if (th.wicketBin || theme === 'backyard') drawBin(ctx, p[0], p[1], p[2], broken);
  else drawStumps(ctx, p[0], p[1], p[2], broken);
}

// Bat motion. a = angle of the bat from "pointing down" (positive = toward screen-right). t = seconds since
// the swing began (-1 = not swinging). The bat is lifted while the ball is on its way and the downswing reaches
// the ball 0.05 s after the swing starts (the same instant the engine resolves contact).
function batterBat(t, dirX, kind, lifted) {
  const sgn = dirX >= 0 ? 1 : -1;
  const A0 = 2.25;
  if (kind === 'block') { const u = clamp(t / 0.18, 0, 1); return { a: lerp(lifted ? A0 : 0.5, 0.06, ease.out(u)), hand: lerp(1, 0, u), through: u }; }
  if (t < 0) return lifted ? { a: A0, hand: 1, through: 0 } : { a: 0.42, hand: 0.1, through: 0 };
  const contact = dirX >= 0 ? lerp(0.25, 1.4, clamp(dirX, 0, 1)) : lerp(0.15, -1.35, clamp(-dirX, 0, 1));
  const endA = dirX >= 0.55 ? contact - 1.0 : contact - 2.5;
  if (t < 0.05) { const u = t / 0.05; return { a: lerp(A0, contact, u * u), hand: lerp(1, 0.3, u), through: 0 }; }
  const u = clamp((t - 0.05) / 0.32, 0, 1);
  return { a: lerp(contact, endA, ease.out(u)), hand: lerp(0.3, 2, ease.out(u)), through: u };
}

function drawCue(ctx, x, y, type, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(14,10,26,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,140,0.7)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = '#fff4dc'; ctx.fillStyle = '#fff4dc'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const arrow = (x0, y0, x1, y1) => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 7 * Math.cos(a - 0.5), y1 - 7 * Math.sin(a - 0.5)); ctx.lineTo(x1 - 7 * Math.cos(a + 0.5), y1 - 7 * Math.sin(a + 0.5)); ctx.closePath(); ctx.fill(); };
  const seam = (ang) => { ctx.save(); ctx.rotate(ang); ctx.strokeStyle = '#ff9d6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 11); ctx.stroke(); ctx.restore(); };
  if (type === 'pace') { seam(0); }
  else if (type === 'inswing') { seam(-0.5); arrow(2, 8, -9, 12); }
  else if (type === 'outswing') { seam(0.5); arrow(-2, 8, 9, 12); }
  else if (type === 'offspin') { ctx.beginPath(); ctx.arc(0, 0, 9, -2.4, 2.0, true); ctx.stroke(); arrow(7, 5, 3, 9); }
  else if (type === 'legspin') { ctx.beginPath(); ctx.arc(0, 0, 9, -0.7, 4.0); ctx.stroke(); arrow(-7, 5, -3, 9); }
  else if (type === 'slower') { ctx.setLineDash([3, 4]); seam(0); ctx.setLineDash([]); ctx.font = `700 13px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('~', 0, 5); }
  else if (type === 'bouncer') { arrow(0, 8, 0, -9); }
  else if (type === 'yorker') { arrow(0, -8, 0, 9); }
  else if (type === 'wide') { arrow(-8, 0, 8, 0); }
  else { seam(0); }
  ctx.restore();
}

export function drawDelivery(ctx, v) {
  const m = v.m, th = THEMES[m.theme], hand = m.hand, L = th.pitchLen;
  const P = makeProj(hand);
  const use3d = !!v.use3d;   // the 3D layer draws the set and the people behind this canvas; only overlays are drawn here
  if (!use3d) { drawBackdrop(ctx, m.theme, CAM.hy); drawGround(ctx, P, m.theme, hand); }
  const phase = m.phase;
  const d = m.d;
  const inFlight = d && (phase === 'flight' || phase === 'contact' || (phase === 'result' && !m.live));
  const ft = phase === 'flight' ? m.ft : phase === 'contact' ? (m.sw?.t ?? m.ft) + 0.05 : (m.ft ?? 0);
  // far wicket + bowler
  if (!use3d) wicketAt(ctx, P, m.theme, L, m.last?.out && m.inn.role === 'bowl' ? 0 : 0);
  const homeKit = m.theme === 'backyard' ? KIT.yard : m.theme === 'beach' ? KIT.beach : KIT.home;
  const humanBat = m.inn.role === 'bat';
  const kitB = humanBat ? KIT.away : homeKit;
  const kitBat = humanBat ? homeKit : KIT.away;
  // fielders in front of the batter, in perspective (far ones first)
  const seen = (m.field ?? []).filter((f) => f.role === 'field' && f.z > 2.5).sort((a, b) => b.z - a.z);
  for (const f of (use3d ? [] : seen)) {
    const fp = P(f.x, 0, f.z);
    if (fp[2] > 120 || fp[0] < -30 || fp[0] > W + 30) continue;
    drawPerson(ctx, fp[0], fp[1], fp[2], { kit: kitB, face: 'front', cap: true, pose: { run: f.run > 0.5 ? (v.t ?? 0) * 11 + f.id : 0, crouch: 0.18 }, sdir: hand });
  }
  // bowler
  let bz = L + 2.2, run = 0, arm = null, lean = 0;
  const rt = m.runT ?? 1;
  if (phase === 'ready') { bz = L + 4.5; }
  else if (phase === 'runup') { const u = clamp(m.pt / rt, 0, 1); bz = lerp(L + 9, L - 0.3, u * (2 - u) * 0.9 + u * 0.1); run = m.pt * 14; arm = u > 0.62 ? lerp(-1.9, 0.1, ease.inOut((u - 0.62) / 0.38)) : null; lean = 0.03 * (u > 0.8 ? (u - 0.8) * 5 : 0); }
  else if (phase === 'flight' || phase === 'contact') { bz = L - 0.3 + Math.min(1.8, m.ft * 3); run = m.ft * 9; arm = m.ft < 0.35 ? lerp(0.1, 2.9, ease.out(m.ft / 0.35)) : null; lean = 0.12 * Math.min(1, m.ft / 0.2); }
  else { bz = L + 1.2; }
  if (!(m.inn.role === 'bowl' && false)) {
    const bp = P(0.8, 0, bz); bp[2] *= 1.0;
    const showBowler = bz > L - 1.2;
    if (!use3d && (showBowler || phase === 'ready' || phase === 'runup')) drawPerson(ctx, bp[0], bp[1], bp[2], { kit: kitB, face: 'front', cap: true, pose: { run, arm, crouch: 0, lean } });
    if (m.next && m.inn.role === 'bat' && ((phase === 'runup' && m.pt > (m.runT ?? 1) * 0.45) || (phase === 'flight' && m.ft < 0.2))) drawCue(ctx, bp[0] + 46, bp[1] - 1.9 * bp[2], m.next.type, m.pt);
  }
  // ball: shadow, trail, ball
  let bpos = null;
  if (d && (phase === 'flight' || phase === 'contact') && m.ft >= 0) {
    const tt = clamp(ft, 0, d.n / 60 - 0.02);
    bpos = deliveryPos(d, tt);
  }
  // near wicket + batter
  const behind = bpos && bpos[2] < -0.15;
  const drawBallNow = () => {
    if (!bpos) return;
    const [x, y, z] = bpos;
    const sp = P(x, y, z), gp = P(x, 0, z);
    // shadow on ground
    ctx.fillStyle = `rgba(20,24,8,${clamp(0.34 - y * 0.08, 0.1, 0.34)})`;
    ctx.beginPath(); ctx.ellipse(gp[0] - 3, gp[1] + 1, sp[2] * 0.055 * (1 + y * 0.3) + 4, sp[2] * 0.02 + 1.5, 0, 0, 7); ctx.fill();
    // trail
    const tr = v.trail ?? [];
    const pts = tr.map((q) => { const s = P(q[0], q[1], q[2]); return { x: s[0], y: s[1], r: Math.max(3, s[2] * 0.05) }; });
    drawTrail(ctx, pts, th.ball === 'tennis' ? '230,255,120' : '255,200,170');
    const r = Math.max(6.5, sp[2] * 0.078);
    glow(ctx, sp[0], sp[1], r * 3.4, 'rgba(255,240,200,A)', 0.4);
    drawBall(ctx, sp[0], sp[1], r, th.ball, (m.ft ?? 0) * 18 * (d.spec.type.includes('spin') ? 1.6 : 1));
  };
  if (use3d) { glow(ctx, 590, CAM.hy - 52, 420, 'rgba(255,214,150,A)', 0.14); return { P, tip: null }; }
  if (behind) drawBallNow();
  wicketAt(ctx, P, m.theme, 0, v.stumpsBroken ?? 0);
  // batter
  const bx = -0.52, bzp = -0.12;
  const bp0 = P(bx, 0, bzp);
  const kit = kitBat;
  const sw = m.sw, st = v.swingT ?? -1;
  const dirX = sw ? Math.sin((sw.angle ?? 0) * DEG) : 0;
  const lifted = phase === 'flight' && !sw;
  const pose = batterBat(st, dirX, sw?.kind, lifted || (sw && st < 0));
  const k0 = bp0[2];
  // hands move with the swing: up and behind in the backlift, through the hitting zone, then high in the finish
  const hu = pose.hand;
  const hxo = hu <= 1 ? lerp(0.12 + 0.2 * dirX, 0.3, hu) : lerp(0.3, -0.12, hu - 1);
  const hyo = hu <= 1 ? lerp(0.98, 1.3, hu) : lerp(1.3, 1.5, hu - 1);
  const handX = bp0[0] + hxo * k0, handY = bp0[1] - hyo * k0;
  const rawLean = clamp(0.04 * (pose.through ?? 0) * (dirX >= 0 ? 1 : -1), -0.05, 0.05);
  if (hand === -1) { ctx.save(); ctx.translate(bp0[0], 0); ctx.scale(-1, 1); ctx.translate(-bp0[0], 0); }
  drawPerson(ctx, bp0[0], bp0[1], k0, { kit, face: 'back', helmet: true, pads: true, num: hand === 1 ? 7 : null, sdir: hand, pose: { crouch: 0.28, lean: rawLean }, handsTo: { x: handX, y: handY } });
  const batL = 0.86 * k0, batW = 0.22 * k0 * 0.62;
  // swing blur arc
  if (st >= 0 && st < 0.45 && sw?.kind !== 'block') {
    for (let i = 5; i >= 1; i--) { ctx.globalAlpha = 0.09 * (6 - i); const tt = Math.max(0, st - i * 0.012); const pa = batterBat(tt, dirX, sw?.kind, true); drawBat(ctx, bp0[0] + (pa.hand <= 1 ? lerp(0.12 + 0.2 * dirX, 0.3, pa.hand) : lerp(0.3, -0.12, pa.hand - 1)) * k0, bp0[1] - (pa.hand <= 1 ? lerp(0.98, 1.3, pa.hand) : lerp(1.3, 1.5, pa.hand - 1)) * k0, pa.a, batL, batW); }
    ctx.globalAlpha = 1;
  }
  const tip = drawBat(ctx, handX, handY, pose.a, batL, batW);
  if (hand === -1) {
    ctx.restore();
    // the shirt number is drawn after the mirror so it still reads the right way round on a left-hander
    const shY = bp0[1] - (1.5 - 0.16 * 0.28) * k0;
    ctx.fillStyle = 'rgba(30,40,60,0.8)'; ctx.font = `700 ${(0.2 * k0) | 0}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('18', bp0[0] - rawLean * k0 * 0.5, shY + 0.34 * k0);
  }
  if (!behind) drawBallNow();
  // sun glare over the lens
  glow(ctx, 590, CAM.hy - 52, 420, 'rgba(255,214,150,A)', 0.14);
  return { P, tip };
}

// ---- overhead view -----------------------------------------------------------------------------------------------------
export const OH = { cx: 360, cy: 690 };
export function toScreen(theme, x, z) {
  const th = THEMES[theme];
  return [OH.cx + x * th.scale, OH.cy - (z - th.pitchLen / 2) * th.scale];
}

function fencePath(ctx, theme, pad = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2, r = fenceR(theme, a) + pad;
    const [sx, sy] = toScreen(theme, Math.sin(a) * r, THEMES[theme].pitchLen / 2 + Math.cos(a) * r);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}

function drawGroundTopStatic(ctx, theme) {
  const th = THEMES[theme], S = th.scale;
  // outside the boundary
  const out = theme === 'beach' ? ['#e9d09a', '#c8a566'] : theme === 'backyard' ? ['#8a6a50', '#5a4332'] : ['#3a2f55', '#1d1730'];
  ctx.fillStyle = vGrad(ctx, 0, H, [[0, out[0]], [1, out[1]]]);
  ctx.fillRect(0, 0, W, H);
  if (theme === 'stadium') {
    // concourse and stands: warm lit tiers with a lively crowd
    const tiers = [['#5a4a78', 4], ['#6b5a8a', 9], ['#7a6a98', 14], ['#4a3d66', 19]];
    for (const [c, off] of tiers.slice().reverse()) { ctx.save(); fencePath(ctx, theme, off + 3); ctx.lineWidth = 36; ctx.strokeStyle = c; ctx.stroke(); ctx.restore(); }
    const g0 = ctx.createRadialGradient(OH.cx + 120, OH.cy - 160, 200, OH.cx, OH.cy, 640);
    g0.addColorStop(0, 'rgba(255,214,150,0.32)'); g0.addColorStop(1, 'rgba(20,10,40,0.35)');
    for (let i = 0; i < 2600; i++) {
      const a = hash(i * 3) * Math.PI * 2, ring = hash(i * 3 + 1) * 19 + 3.2;
      const r = fenceR(theme, a) + ring;
      const [sx, sy] = toScreen(theme, Math.sin(a) * r, th.pitchLen / 2 + Math.cos(a) * r);
      ctx.fillStyle = ['#ffcf6b', '#2ec4b6', '#ff6b57', '#f4ead2', '#6aa3ff', '#ff9fc0', '#ffffff'][Math.floor(hash(i * 3 + 2) * 7)];
      ctx.globalAlpha = 0.9; ctx.fillRect(sx, sy, 3.6, 4.2);
    }
    ctx.globalAlpha = 1;
    // aisles
    ctx.strokeStyle = 'rgba(20,10,40,0.35)'; ctx.lineWidth = 3;
    for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, r0 = fenceR(theme, a) + 2, r1 = r0 + 24; const [x0, y0] = toScreen(theme, Math.sin(a) * r0, th.pitchLen / 2 + Math.cos(a) * r0); const [x1, y1] = toScreen(theme, Math.sin(a) * r1, th.pitchLen / 2 + Math.cos(a) * r1); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.save(); ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
  // lawn / sand clipped to the boundary
  ctx.save();
  fencePath(ctx, theme, 0.2); ctx.clip();
  const g = ctx.createRadialGradient(OH.cx + 80, OH.cy - 120, 40, OH.cx, OH.cy, 420);
  g.addColorStop(0, mix(th.lawn[0], '#ffe9a8', 0.28)); g.addColorStop(0.7, th.lawn[0]); g.addColorStop(1, shade(th.lawn[1], -22));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // mow stripes (rings or bands)
  ctx.globalAlpha = 0.5;
  for (let i = -14; i < 14; i++) {
    if (i % 2) continue;
    ctx.fillStyle = theme === 'beach' ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,170,0.08)';
    ctx.fillRect(OH.cx + i * 34, 0, 34, H);
  }
  ctx.globalAlpha = 1;
  if (theme === 'beach') {
    for (let i = 0; i < 220; i++) { ctx.fillStyle = `rgba(150,110,60,${0.04 + hash(i + 3) * 0.08})`; ctx.beginPath(); ctx.ellipse(hash(i) * W, 300 + hash(i + 9) * 800, 8 + hash(i + 4) * 22, 1.6, hash(i + 2) * 0.4, 0, 7); ctx.fill(); }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,245,225,0.5)'; ctx.beginPath(); ctx.arc(hash(i + 50) * W, 380 + hash(i + 51) * 700, 2 + hash(i + 52) * 2.5, 0, 7); ctx.fill(); }
  }
  // dappled shade from trees (long golden-hour shadows)
  if (theme === 'backyard') { for (let i = 0; i < 6; i++) { ctx.fillStyle = 'rgba(20,50,20,0.12)'; ctx.beginPath(); ctx.ellipse(120 + i * 90, 940 + (i % 2) * 40, 90, 24, -0.4, 0, 7); ctx.fill(); } }
  ctx.restore();
  // pitch strip
  const pw = (theme === 'backyard' ? 2.6 : 3.05) * S, L = th.pitchLen;
  const [px, pyTop] = toScreen(theme, 0, L + 1.6), [, pyBot] = toScreen(theme, 0, -1.6);
  const pc = theme === 'backyard' ? ['#b0a79b', '#8f8679'] : theme === 'beach' ? ['#b08f5e', '#947646'] : ['#d6c28f', '#b8a06c'];
  const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0); pg.addColorStop(0, pc[1]); pg.addColorStop(0.5, pc[0]); pg.addColorStop(1, pc[1]);
  ctx.fillStyle = pg; ctx.fillRect(px - pw / 2, pyTop, pw, pyBot - pyTop);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
  const [, c0] = toScreen(theme, 0, 0), [, c1] = toScreen(theme, 0, L), [, p0] = toScreen(theme, 0, 1.22), [, p1] = toScreen(theme, 0, L - 1.22);
  for (const y of [c0, c1, p0, p1]) { ctx.beginPath(); ctx.moveTo(px - pw * 0.62, y); ctx.lineTo(px + pw * 0.62, y); ctx.stroke(); }
  // boundary
  if (theme === 'stadium') {
    ctx.save(); fencePath(ctx, theme, 0); ctx.lineWidth = 9; ctx.strokeStyle = 'rgba(20,40,20,0.35)'; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = '#fbf7ee'; ctx.setLineDash([22, 6]); ctx.stroke(); ctx.restore();
    // 30 yard circle
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.setLineDash([8, 10]); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(OH.cx, OH.cy, th.baseR * 0.5 * S, th.baseR * 0.5 * S, 0, 0, 7); ctx.stroke(); ctx.restore();
  } else if (theme === 'backyard') {
    // paling fence with posts
    ctx.save(); fencePath(ctx, theme, 0.9); ctx.lineWidth = 24; ctx.strokeStyle = '#6d4d36'; ctx.stroke();
    ctx.lineWidth = 19; ctx.strokeStyle = '#b98a5a'; ctx.setLineDash([9, 2]); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,230,170,0.5)'; ctx.setLineDash([]); fencePath(ctx, theme, -0.4); ctx.stroke();
    ctx.restore();
    // beyond the fence: neighbour lawns, house roof, trees
    ctx.fillStyle = '#d8c3a0'; rr(ctx, 40, 24, 300, 140, 8); ctx.fill();
    for (let i = 0; i < 14; i++) { ctx.fillStyle = i % 2 ? '#c4553f' : '#b24a38'; ctx.fillRect(46 + i * 21, 28, 20, 130); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(40, 150, 300, 14);
    for (const [tx, ty, tr] of [[560, 90, 70], [650, 200, 56], [90, 1160, 68], [620, 1150, 74], [660, 700, 40]]) { ctx.fillStyle = 'rgba(15,30,10,0.35)'; ctx.beginPath(); ctx.ellipse(tx - tr * 0.4, ty + tr * 0.35, tr, tr * 0.9, 0, 0, 7); ctx.fill(); for (let k = 0; k < 6; k++) { ctx.fillStyle = mix('#4f8a46', '#8fb85a', hash(k + tx)); ctx.beginPath(); ctx.arc(tx + (hash(k + 1) - 0.5) * tr * 0.7, ty + (hash(k + 2) - 0.5) * tr * 0.7, tr * 0.55, 0, 7); ctx.fill(); } }
    // clothes hoist inside the yard (top-down star)
    const [hx, hy] = toScreen(theme, -13, 26);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.6; ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 34, hy + Math.sin(a) * 34); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(hx, hy, 22, 0, 7); ctx.stroke(); ctx.fillStyle = '#e6e0d4'; ctx.beginPath(); ctx.arc(hx, hy, 4, 0, 7); ctx.fill();
  } else {
    // wet sand and the sea along the top, foam line, then dry sand
    const wg = ctx.createLinearGradient(0, 0, 0, 520);
    wg.addColorStop(0, 'rgba(120,150,150,0.0)'); wg.addColorStop(0.7, 'rgba(160,140,100,0.0)');
    const sg = ctx.createLinearGradient(0, 0, 0, 330); sg.addColorStop(0, '#0d6a86'); sg.addColorStop(1, '#4fc0c8');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, 150); ctx.quadraticCurveTo(480, 270, 280, 215); ctx.quadraticCurveTo(100, 170, 0, 280); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) { ctx.strokeStyle = `rgba(255,255,255,${0.12 + i * 0.03})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 40 + i * 30 + 8); for (let x = 0; x <= W; x += 24) ctx.lineTo(x, 40 + i * 30 + Math.sin(x * 0.03 + i) * 6); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(W, 150); ctx.quadraticCurveTo(480, 270, 280, 215); ctx.quadraticCurveTo(100, 170, 0, 280); ctx.stroke();
    const wet = ctx.createLinearGradient(0, 120, 0, 420); wet.addColorStop(0, 'rgba(120,98,70,0.55)'); wet.addColorStop(1, 'rgba(120,98,70,0)');
    ctx.fillStyle = wet; ctx.beginPath(); ctx.moveTo(W, 150); ctx.quadraticCurveTo(480, 270, 280, 215); ctx.quadraticCurveTo(100, 170, 0, 280); ctx.lineTo(0, 440); ctx.lineTo(W, 440); ctx.closePath(); ctx.fill();
    // the boundary: flags on a rope of dots
    ctx.save(); fencePath(ctx, theme, 0); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash([2, 10]); ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2, r = fenceR(theme, a) + 0.3; const [fx, fy] = toScreen(theme, Math.sin(a) * r, th.pitchLen / 2 + Math.cos(a) * r); ctx.fillStyle = k % 2 ? '#ff6b57' : '#ffcf6b'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 11, fy - 5); ctx.lineTo(fx, fy - 10); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff4dc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 16); ctx.stroke(); }
    // umbrellas, towels and palms outside the ground
    for (const [x, y, c1] of [[96, 800, '#ff6b57'], [640, 520, '#2ec4b6'], [86, 560, '#ffcf6b'], [628, 960, '#ff9fc0']]) { ctx.fillStyle = 'rgba(30,24,10,0.22)'; ctx.beginPath(); ctx.ellipse(x - 14, y + 18, 54, 26, -0.5, 0, 7); ctx.fill(); for (let k = 0; k < 8; k++) { ctx.fillStyle = k % 2 ? '#fff4dc' : c1; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 44, k * Math.PI / 4, (k + 1) * Math.PI / 4); ctx.closePath(); ctx.fill(); } ctx.fillStyle = '#6b4a30'; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill(); }
    for (const [x, y, c] of [[70, 700, '#2ec4b6'], [650, 700, '#ffcf6b'], [120, 1010, '#ff6b57']]) { ctx.fillStyle = c; ctx.save(); ctx.translate(x, y); ctx.rotate(0.3); ctx.fillRect(-36, -14, 72, 28); ctx.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = -3; k <= 3; k += 2) ctx.fillRect(k * 10 - 4, -14, 8, 28); ctx.restore(); }
    for (const [x, y] of [[620, 1120], [90, 1150], [660, 880], [60, 330]]) { ctx.fillStyle = 'rgba(20,50,20,0.3)'; ctx.beginPath(); ctx.ellipse(x - 22, y + 30, 74, 30, 0, 0, 7); ctx.fill(); for (let k = 0; k < 9; k++) { const a = k * Math.PI * 2 / 9; ctx.strokeStyle = k % 2 ? '#3d8a4a' : '#2f7a42'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * 32, y + Math.sin(a) * 32 - 6, x + Math.cos(a) * 64, y + Math.sin(a) * 64); ctx.stroke(); } ctx.fillStyle = '#6b4a30'; ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill(); }
  }
  // soft vignette
  const vg = ctx.createRadialGradient(OH.cx, OH.cy, 300, OH.cx, OH.cy, 760);
  vg.addColorStop(0, 'rgba(20,10,40,0)'); vg.addColorStop(1, 'rgba(20,10,40,0.42)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  glow(ctx, 640, 120, 460, 'rgba(255,220,150,A)', 0.2);
}

export function drawOverheadGround(ctx, theme) {
  const L = layer(`oh-${theme}`, W, H, (c) => drawGroundTopStatic(c, theme));
  if (L) ctx.drawImage(L, 0, 0); else drawGroundTopStatic(ctx, theme);
}

export function drawFieldFigure(ctx, theme, f, o = {}) {
  const th = THEMES[theme];
  const [sx, sy] = toScreen(theme, f.x, f.z);
  const s = theme === 'stadium' ? 13 : theme === 'backyard' ? 15 : 14;
  const kit = o.kit ?? (theme === 'backyard' ? KIT.away : KIT.away);
  drawTopPerson(ctx, sx, sy, s, { kit, fx: f.fx, fz: f.fz, run: f.run ?? 0, phase: o.t ?? 0, arms: o.arms ?? 0, helmet: f.role === 'wk' ? false : false });
  if (o.label) {
    ctx.font = `600 17px ${SANS}`; ctx.textAlign = 'center';
    const w = ctx.measureText(o.label).width + 14;
    ctx.fillStyle = 'rgba(14,10,24,0.72)'; rr(ctx, sx - w / 2, sy - 38, w, 22, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(o.label, sx, sy - 22);
  }
  if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sx, sy, s * 1.9, 0, 7); ctx.stroke(); }
}

export function drawBatterTop(ctx, theme, x, z, o = {}) {
  const [sx, sy] = toScreen(theme, x, z);
  const kit = theme === 'backyard' ? KIT.yard : theme === 'beach' ? KIT.beach : KIT.home;
  const s = theme === 'stadium' ? 13 : theme === 'backyard' ? 15 : 14;
  if (o.striker) { ctx.fillStyle = 'rgba(255,207,107,0.28)'; ctx.beginPath(); ctx.arc(sx, sy, s * 2.3, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, sy, s * 2.3, 0, 7); ctx.stroke(); }
  drawTopPerson(ctx, sx, sy, s, { kit, fx: o.fx ?? 0, fz: o.fz ?? 1, run: o.run ?? 0, phase: o.t ?? 0, helmet: true, arms: o.arms ?? 0 });
}

export function drawTopBall(ctx, theme, b, v, big = 1) {
  const th = THEMES[theme];
  const S = th.scale;
  const [gx, gy] = toScreen(theme, b[0], b[2]);
  const lift = b[1] * S * 0.55;
  const r = (th.ball === 'tennis' ? 8 : 7.4) * big * (1 + b[1] * 0.07);
  // shadow
  ctx.fillStyle = `rgba(15,20,5,${clamp(0.32 - b[1] * 0.04, 0.1, 0.32)})`;
  ctx.beginPath(); ctx.ellipse(gx - b[1] * 0.4 - 1, gy + 2, r * 0.95, r * 0.5, 0, 0, 7); ctx.fill();
  const pts = (v.otrail ?? []).map((q) => { const [x, y] = toScreen(theme, q[0], q[2]); return { x, y: y - q[1] * S * 0.55, r: 4 }; });
  drawTrail(ctx, pts, th.ball === 'tennis' ? '236,255,120' : '255,214,180');
  glow(ctx, gx, gy - lift, r * 3.2, 'rgba(255,240,200,A)', 0.4);
  drawBall(ctx, gx, gy - lift, r, th.ball, v.t * 14);
  return [gx, gy - lift];
}

// ---- radar -----------------------------------------------------------------------------------------------------------------
export function drawRadar(ctx, m, rect, o = {}) {
  const th = THEMES[m.theme];
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, R = rect.w / 2 - 4;
  const sc = R / (th.baseR * 1.12);
  const toR = (x, z) => [cx + x * m.hand * sc, cy - (z - th.pitchLen / 2) * sc];
  ctx.save();
  ctx.fillStyle = 'rgba(14,10,26,0.62)'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,140,0.45)'; ctx.lineWidth = 2; ctx.stroke();
  // lawn
  ctx.beginPath();
  for (let i = 0; i <= 90; i++) { const a = (i / 90) * Math.PI * 2, r = fenceR(m.theme, a); const [x, y] = toR(Math.sin(a) * r * (m.hand === 1 ? 1 : 1) / m.hand * m.hand, th.pitchLen / 2 + Math.cos(a) * r); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fillStyle = m.theme === 'beach' ? 'rgba(226,190,120,0.8)' : 'rgba(70,140,70,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.6; ctx.stroke();
  // pitch
  const [p0x, p0y] = toR(0, 0), [p1x, p1y] = toR(0, th.pitchLen);
  ctx.fillStyle = 'rgba(214,194,140,0.95)'; ctx.fillRect(p0x - 3, p1y, 6, p0y - p1y);
  // aim wedge
  if (o.aim != null) {
    const a = o.aim * DEG, w = (o.aimW ?? 14) * DEG;
    ctx.fillStyle = o.aimColor ?? 'rgba(255,207,107,0.42)';
    ctx.beginPath(); ctx.moveTo(p0x, p0y);
    const rr0 = R * 1.1;
    ctx.lineTo(p0x + Math.sin(a - w) * rr0 * m.hand, p0y - Math.cos(a - w) * rr0);
    ctx.lineTo(p0x + Math.sin(a + w) * rr0 * m.hand, p0y - Math.cos(a + w) * rr0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = PAL.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p0x, p0y); ctx.lineTo(p0x + Math.sin(a) * rr0 * m.hand, p0y - Math.cos(a) * rr0); ctx.stroke();
  }
  for (const c of o.cands ?? []) {
    const a = c.angle * DEG; const rr0 = R * (c.boundary ? 1.0 : 0.6);
    ctx.fillStyle = c.chosen ? 'rgba(255,207,107,0.95)' : 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(p0x + Math.sin(a) * rr0 * m.hand, p0y - Math.cos(a) * rr0, c.chosen ? 6 : 3.5, 0, 7); ctx.fill();
  }
  for (const f of m.field) {
    const [x, y] = toR(f.x, f.z);
    ctx.fillStyle = f.role === 'wk' ? '#ffcf6b' : '#7fb6ff'; ctx.strokeStyle = 'rgba(10,10,30,0.8)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 4.6, 0, 7); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  return { cx, cy, R, p0: [p0x, p0y] };
}
