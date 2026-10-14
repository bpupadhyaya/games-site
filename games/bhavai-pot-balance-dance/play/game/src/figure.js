// The dancer, the tower of clay pots and the drummer. Canvas 2D, drawn from joints in metres (cam maps metres to pixels).
// Human figures: smooth, from a small skeleton (hips, waist, shoulders, elbows, hands) with limbs as tapered strokes.
import { PAL, TAU, clamp, hash, sx, sy, mixHex } from './art.js';

const SKIN = ['#d79866', '#a96a42'];
const POT_COLS = [['#d9683a', '#a8431f'], ['#e08a3a', '#b3631f'], ['#c9502e', '#8e3418'], ['#d97a48', '#a34d26']];
const BAND = ['#fff1d4', '#ffd45a', '#27c4c0', '#ff8aa8'];

// A clay pot (matka) around (0,0) in local pixels at scale k (pixels per metre). Height 0.27 m.
export function drawPotLocal(ctx, k, i, shade = 1) {
  const [c1, c2] = POT_COLS[i % POT_COLS.length];
  const P = (x, y) => [x * k, -y * k];
  ctx.beginPath();
  let p = P(-0.078, -0.135); ctx.moveTo(p[0], p[1]);
  p = P(0.078, -0.135); ctx.lineTo(p[0], p[1]);
  let q = P(0.158, -0.01); p = P(0.15, 0.03); ctx.bezierCurveTo(...P(0.14, -0.1), ...q, ...p);
  q = P(0.1, 0.1); ctx.bezierCurveTo(...P(0.15, 0.07), ...P(0.12, 0.09), ...q);
  p = P(0.072, 0.118); ctx.lineTo(p[0], p[1]);
  p = P(0.092, 0.138); ctx.lineTo(p[0], p[1]);
  p = P(-0.092, 0.138); ctx.lineTo(p[0], p[1]);
  p = P(-0.072, 0.118); ctx.lineTo(p[0], p[1]);
  q = P(-0.15, 0.03); ctx.bezierCurveTo(...P(-0.12, 0.09), ...P(-0.15, 0.07), ...q);
  ctx.bezierCurveTo(...P(-0.158, -0.01), ...P(-0.14, -0.1), ...P(-0.078, -0.135));
  ctx.closePath();
  const g = ctx.createLinearGradient(-0.16 * k, 0, 0.16 * k, 0);
  g.addColorStop(0, mixHex(c1, '#ffffff', 0.18 * shade)); g.addColorStop(0.35, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.2, k * 0.012); ctx.strokeStyle = 'rgba(60,20,8,0.55)'; ctx.stroke();
  ctx.save(); ctx.clip();
  // painted bands and dots
  const band = BAND[i % BAND.length];
  ctx.fillStyle = band; ctx.fillRect(-0.2 * k, -0.045 * k, 0.4 * k, 0.03 * k);
  ctx.fillStyle = 'rgba(40,10,0,0.55)'; ctx.fillRect(-0.2 * k, 0.045 * k, 0.4 * k, 0.014 * k);
  ctx.fillStyle = BAND[(i + 1) % BAND.length];
  for (let j = -3; j <= 3; j++) { ctx.beginPath(); ctx.arc(j * 0.045 * k, 0.003 * k, 0.012 * k, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-0.12 * k, -0.14 * k, 0.03 * k, 0.28 * k);
  ctx.restore();
  // rim
  ctx.fillStyle = mixHex(c1, '#000000', 0.25); ctx.beginPath(); ctx.ellipse(0, -0.138 * k, 0.092 * k, 0.014 * k, 0, 0, TAU); ctx.fill();
}

// The whole tower on the dancer's head. tower = { x, th, om, n, t, lift } ; every pot is rotated a little more than the one below.
export function drawTower(ctx, cam, tw) {
  const k = cam.ppm, n = tw.n, baseY = 1.76;
  const hx = tw.x;
  // the cushion ring on the head
  const cx = sx(cam, hx), cy = sy(cam, 1.7);
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = '#e8573c'; ctx.beginPath(); ctx.ellipse(0, 0, 0.115 * k, 0.04 * k, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd45a'; ctx.lineWidth = Math.max(1.5, k * 0.012); ctx.beginPath(); ctx.ellipse(0, 0, 0.115 * k, 0.04 * k, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < n; i++) {
    const h = baseY + 0.265 * i + 0.135, f = i / Math.max(1, n);
    const ang = tw.th * (0.65 + 0.9 * f + 0.05 * i);
    const slip = Math.sin(tw.t * 8 + i * 1.7) * 0.012 * Math.min(1, Math.abs(tw.om) * 2.5 + Math.abs(tw.th));
    const dx = Math.tan(clamp(tw.th, -0.9, 0.9)) * (h - 1.7) * (0.8 + 0.5 * f) + slip;
    ctx.save(); ctx.translate(sx(cam, hx + dx), sy(cam, h)); ctx.rotate(ang);
    drawPotLocal(ctx, k, i);
    ctx.restore();
  }
  // a marigold on top
  const ht = baseY + 0.265 * n + 0.04, ft = n / Math.max(1, n);
  const dxt = Math.tan(clamp(tw.th, -0.9, 0.9)) * (ht - 1.7) * (0.8 + 0.5 * ft);
  ctx.save(); ctx.translate(sx(cam, hx + dxt), sy(cam, ht)); ctx.rotate(tw.th * 1.6);
  for (let j = 0; j < 8; j++) { ctx.rotate(TAU / 8); ctx.fillStyle = j % 2 ? '#ff9a1f' : '#ffc93a'; ctx.beginPath(); ctx.ellipse(0.045 * k, 0, 0.05 * k, 0.026 * k, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#b3470f'; ctx.beginPath(); ctx.arc(0, 0, 0.03 * k, 0, TAU); ctx.fill();
  ctx.restore();
}

function limb(ctx, x0, y0, x1, y1, w0, w1, col) {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath(); ctx.fill();
}

// d = { x, v, th, om, t, bp (0..1 within the beat), side (+1/-1 foot), spin (0..1), n, fall (0..1 shake), hand (0..1 pot being handed up) }
export function drawDancer(ctx, cam, d, look = 0, hero = false) {
  const k = cam.ppm, t = d.t;
  const X = (m) => sx(cam, m), Y = (m) => sy(cam, m);
  const skin = SKIN[look % 2], skinD = mixHex(skin, '#000000', 0.22);
  const sway = clamp(d.v * 0.045, -0.12, 0.12);
  const hipX = d.x - sway * 1.6, shX = d.x - sway * 0.7;
  const bounce = Math.sin(d.bp * Math.PI) * 0.012;
  const spin = d.spin;
  // ---- shadow ----
  ctx.fillStyle = 'rgba(10,5,20,0.35)'; ctx.beginPath(); ctx.ellipse(X(d.x), Y(0) + 0.02 * k, 0.55 * k, 0.1 * k, 0, 0, TAU); ctx.fill();
  // ---- real 3D dancer (main.js installs globalThis.__dancer3d); the 2D rig below is the fallback ----
  const f3 = hero ? globalThis.__dancer3d : null;
  if (f3) {
    if (f3.pending) return;                                  // still loading: nothing is drawn (no flash of the fallback)
    if (f3.draw && f3.draw(ctx, cam, d, look)) return;
  }
  // ---- braid (behind) ----
  ctx.strokeStyle = '#1a0f12'; ctx.lineCap = 'round'; ctx.lineWidth = 0.055 * k;
  const bx = shX + 0.1, bsw = sway * 1.2 + Math.sin(t * 3.1) * 0.03 + d.om * 0.05;
  ctx.beginPath(); ctx.moveTo(X(shX + 0.07), Y(1.52)); ctx.bezierCurveTo(X(bx + 0.06 - bsw), Y(1.38), X(bx + 0.1 - bsw * 1.5), Y(1.18), X(bx + 0.06 - bsw * 2.2), Y(0.98)); ctx.stroke();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 0.02 * k; ctx.beginPath(); ctx.arc(X(bx + 0.06 - bsw * 2.2), Y(0.98), 0.03 * k, 0, TAU); ctx.stroke();
  // ---- veil (odhani) behind the shoulders ----
  const vw = 0.3 + 0.06 * Math.sin(t * 2.2) + Math.abs(sway) * 1.2 + spin * 0.3;
  ctx.fillStyle = 'rgba(255,190,70,0.5)'; ctx.beginPath();
  ctx.moveTo(X(shX - 0.1), Y(1.64));
  ctx.bezierCurveTo(X(shX - vw), Y(1.5), X(shX - vw * 1.05 - sway), Y(1.1), X(shX - vw * 0.85 - sway * 2), Y(0.78));
  ctx.quadraticCurveTo(X(shX - 0.1 - sway), Y(0.85 + 0.03 * Math.sin(t * 3)), X(shX + 0.12), Y(0.9));
  ctx.bezierCurveTo(X(shX + vw * 0.7), Y(1.1), X(shX + vw * 0.55), Y(1.5), X(shX + 0.1), Y(1.64));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(210,120,20,0.7)'; ctx.lineWidth = 0.014 * k; ctx.stroke();
  // ---- feet ----
  const lift = Math.max(0, Math.sin(d.bp * Math.PI)) * 0.07;
  for (const s of [-1, 1]) {
    const up = s === d.side ? lift : 0;
    ctx.fillStyle = skinD; ctx.beginPath(); ctx.ellipse(X(hipX + s * 0.15 - sway * 0.4), Y(0.04 + up), 0.075 * k, 0.034 * k, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.ellipse(X(hipX + s * 0.15 - sway * 0.4 + 0.035), Y(0.04 + up), 0.03 * k, 0.026 * k, 0, 0, TAU); ctx.fill();
  }
  // ---- skirt (ghagra) ----
  const wy = 0.98, hy = 0.1 + bounce;
  const flare = 0.47 + Math.min(0.14, Math.abs(d.v) * 0.04) + spin * 0.3 + 0.018 * Math.sin(t * 5 + d.bp * 4);
  const hemX = hipX - d.v * 0.035;
  const skirtPath = () => {
    ctx.beginPath();
    ctx.moveTo(X(hipX - 0.15), Y(wy));
    ctx.bezierCurveTo(X(hipX - 0.2), Y(0.62), X(hemX - flare * 0.95), Y(0.34), X(hemX - flare), Y(hy));
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const u0 = i / segs, u1 = (i + 1) / segs, xa = hemX - flare + 2 * flare * u0, xb = hemX - flare + 2 * flare * u1;
      const wv = Math.sin(t * 4 + i * 0.9 + d.bp * 3) * 0.012;
      ctx.quadraticCurveTo(X((xa + xb) / 2), Y(hy - 0.035 + wv), X(xb), Y(hy));
    }
    ctx.bezierCurveTo(X(hemX + flare * 0.95), Y(0.34), X(hipX + 0.2), Y(0.62), X(hipX + 0.15), Y(wy));
    ctx.closePath();
  };
  const sg = ctx.createLinearGradient(X(hipX - flare), 0, X(hipX + flare), 0);
  sg.addColorStop(0, '#f0356f'); sg.addColorStop(0.5, '#c5164f'); sg.addColorStop(1, '#8c0e3a');
  ctx.fillStyle = sg; skirtPath(); ctx.fill();
  ctx.save(); skirtPath(); ctx.clip();
  // pleats
  ctx.strokeStyle = 'rgba(60,0,24,0.3)'; ctx.lineWidth = 0.012 * k;
  for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(X(hipX + i * 0.035), Y(wy)); ctx.quadraticCurveTo(X(hipX + i * 0.1 - sway), Y(0.55), X(hemX + i * flare / 4.4), Y(hy)); ctx.stroke(); }
  // gold border with a row of mirror-work dots
  ctx.fillStyle = PAL.gold; ctx.fillRect(X(hipX - 1), Y(hy + 0.17), 2 * k, 0.07 * k);
  ctx.fillStyle = '#27c4c0'; ctx.fillRect(X(hipX - 1), Y(hy + 0.1), 2 * k, 0.045 * k);
  ctx.fillStyle = '#fff4de';
  for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.arc(X(hemX + i * flare / 7.5), Y(hy + 0.135), 0.014 * k, 0, TAU); ctx.fill(); }
  for (let r = 0; r < 3; r++) for (let i = -5 + (r % 2); i <= 5; i += 2) { ctx.beginPath(); ctx.arc(X(hipX + i * (0.07 + r * 0.035) - sway * r * 0.4), Y(0.55 + r * 0.14), 0.011 * k, 0, TAU); ctx.fill(); }
  ctx.restore();
  // ---- torso: skin midriff then the blouse (choli) ----
  const shY = 1.36, wsY = 1.02;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(X(hipX - 0.12), Y(wy + 0.02)); ctx.lineTo(X(hipX + 0.12), Y(wy + 0.02)); ctx.lineTo(X(shX + 0.13), Y(1.14)); ctx.lineTo(X(shX - 0.13), Y(1.14)); ctx.closePath(); ctx.fill();
  const cg = ctx.createLinearGradient(X(shX - 0.18), 0, X(shX + 0.18), 0); cg.addColorStop(0, '#22c0b6'); cg.addColorStop(1, '#0d8f93');
  ctx.fillStyle = cg; ctx.beginPath();
  ctx.moveTo(X(shX - 0.13), Y(1.14)); ctx.lineTo(X(shX + 0.13), Y(1.14));
  ctx.quadraticCurveTo(X(shX + 0.2), Y(1.26), X(shX + 0.18), Y(shY)); ctx.lineTo(X(shX - 0.18), Y(shY)); ctx.quadraticCurveTo(X(shX - 0.2), Y(1.26), X(shX - 0.13), Y(1.14));
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = PAL.gold; ctx.lineWidth = 0.014 * k; ctx.beginPath(); ctx.moveTo(X(shX - 0.13), Y(1.14)); ctx.lineTo(X(shX + 0.13), Y(1.14)); ctx.stroke();
  ctx.fillStyle = PAL.gold; ctx.fillRect(X(shX - 0.18), Y(shY), 0.36 * k, 0.025 * k);
  // ---- arms: hands steady the first pots ----
  const handY = 1.82, tw = Math.tan(clamp(d.th, -0.7, 0.7)) * 0.12;
  for (const s of [-1, 1]) {
    const sh = [shX + s * 0.17, 1.32];
    const hand = [d.x + s * (0.2 + 0.03 * Math.sin(t * 2.6 + s)) + tw - sway * 0.2, handY + 0.04 * Math.sin(t * 2 + s * 1.3) - Math.abs(d.th) * 0.1];
    const el = [(sh[0] + hand[0]) / 2 + s * (0.16 + spin * 0.12), (sh[1] + hand[1]) / 2 - 0.07];
    limb(ctx, X(sh[0]), Y(sh[1]), X(el[0]), Y(el[1]), 0.085 * k, 0.07 * k, skin);
    limb(ctx, X(el[0]), Y(el[1]), X(hand[0]), Y(hand[1]), 0.07 * k, 0.055 * k, skin);
    // sleeve + bangles
    limb(ctx, X(sh[0]), Y(sh[1]), X(sh[0] + (el[0] - sh[0]) * 0.35), Y(sh[1] + (el[1] - sh[1]) * 0.35), 0.1 * k, 0.09 * k, '#14a39d');
    for (let b = 0; b < 3; b++) { const u = 0.62 + b * 0.09; ctx.fillStyle = b % 2 ? PAL.gold : '#ff5a8a'; ctx.beginPath(); ctx.arc(X(el[0] + (hand[0] - el[0]) * u), Y(el[1] + (hand[1] - el[1]) * u), 0.026 * k, 0, TAU); ctx.fill(); }
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(X(hand[0]), Y(hand[1]), 0.04 * k, 0, TAU); ctx.fill();
  }
  // ---- neck + head ----
  ctx.fillStyle = skinD; ctx.fillRect(X(shX) - 0.035 * k, Y(1.46), 0.07 * k, 0.12 * k);
  const hdx = shX - sway * 0.2 + clamp(d.th * 0.08, -0.04, 0.04), hdy = 1.57;
  ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(X(hdx), Y(hdy), 0.093 * k, 0.115 * k, 0, 0, TAU); ctx.fill();
  // hair, parted, with a small bun behind the cushion
  ctx.fillStyle = '#1a0f12'; ctx.beginPath(); ctx.ellipse(X(hdx), Y(hdy + 0.05), 0.1 * k, 0.085 * k, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.008 * k; ctx.beginPath(); ctx.moveTo(X(hdx), Y(hdy + 0.13)); ctx.lineTo(X(hdx), Y(hdy + 0.05)); ctx.stroke();
  // veil over the head
  ctx.fillStyle = 'rgba(255,196,64,0.5)'; ctx.beginPath(); ctx.ellipse(X(hdx - 0.02), Y(hdy + 0.07), 0.115 * k, 0.07 * k, -0.15, Math.PI, TAU); ctx.fill();
  // face
  const blink = Math.sin(t * 0.7) > 0.985 ? 0.1 : 1;
  ctx.fillStyle = '#2a1410';
  ctx.beginPath(); ctx.ellipse(X(hdx - 0.035), Y(hdy + 0.01), 0.011 * k, 0.014 * k * blink, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(X(hdx + 0.035), Y(hdy + 0.01), 0.011 * k, 0.014 * k * blink, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1410'; ctx.lineWidth = 0.008 * k;
  ctx.beginPath(); ctx.moveTo(X(hdx - 0.055), Y(hdy + 0.04)); ctx.quadraticCurveTo(X(hdx - 0.035), Y(hdy + 0.055), X(hdx - 0.015), Y(hdy + 0.042)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(X(hdx + 0.055), Y(hdy + 0.04)); ctx.quadraticCurveTo(X(hdx + 0.035), Y(hdy + 0.055), X(hdx + 0.015), Y(hdy + 0.042)); ctx.stroke();
  ctx.strokeStyle = skinD; ctx.beginPath(); ctx.moveTo(X(hdx), Y(hdy + 0.0)); ctx.lineTo(X(hdx + 0.006), Y(hdy - 0.04)); ctx.stroke();
  ctx.strokeStyle = '#a8283c'; ctx.lineWidth = 0.011 * k; ctx.beginPath(); ctx.moveTo(X(hdx - 0.025), Y(hdy - 0.065)); ctx.quadraticCurveTo(X(hdx), Y(hdy - 0.08 - (d.fall > 0 ? 0 : 0.012)), X(hdx + 0.025), Y(hdy - 0.065)); ctx.stroke();
  ctx.fillStyle = PAL.gold; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(X(hdx + s * 0.095), Y(hdy - 0.05), 0.016 * k, 0, TAU); ctx.fill(); }
  // veil front edge over one shoulder
  ctx.fillStyle = 'rgba(255,196,64,0.45)'; ctx.beginPath(); ctx.moveTo(X(hdx + 0.04), Y(hdy + 0.1)); ctx.bezierCurveTo(X(shX + 0.3), Y(1.5), X(shX + 0.3 - sway), Y(1.2), X(shX + 0.18), Y(1.1)); ctx.lineTo(X(shX + 0.1), Y(1.32)); ctx.closePath(); ctx.fill();
}

// A seated drummer (dholak) at screen position (px, py = floor level), size s pixels per metre. bob 0..1 on the beat.
export function drawDrummer(ctx, px, py, s, t, beatCount, bp, hero = false) {
  const f3 = hero ? globalThis.__dancer3d : null;
  if (f3) {
    ctx.fillStyle = 'rgba(10,5,20,0.35)'; ctx.beginPath(); ctx.ellipse(px, py + 0.02 * s, 0.55 * s, 0.09 * s, 0, 0, TAU); ctx.fill();
    if (f3.pending) return;
    if (f3.drawDrummer && f3.drawDrummer(ctx, px, py, s, t, beatCount, bp)) return;
  }
  const bob = Math.sin(bp * Math.PI) * 0.02;
  ctx.save(); ctx.translate(px, py);
  ctx.fillStyle = 'rgba(10,5,20,0.35)'; ctx.beginPath(); ctx.ellipse(0, 0.02 * s, 0.55 * s, 0.09 * s, 0, 0, TAU); ctx.fill();
  // crossed legs
  ctx.fillStyle = '#f4e7c8'; ctx.beginPath(); ctx.ellipse(0, -0.1 * s, 0.4 * s, 0.14 * s, 0, 0, TAU); ctx.fill();
  // torso (kurta)
  const g = ctx.createLinearGradient(-0.2 * s, 0, 0.2 * s, 0); g.addColorStop(0, '#f8efd8'); g.addColorStop(1, '#d9c9a4');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-0.2 * s, -0.12 * s); ctx.lineTo(0.2 * s, -0.12 * s); ctx.lineTo(0.15 * s, (-0.62 - bob) * s); ctx.lineTo(-0.15 * s, (-0.62 - bob) * s); ctx.closePath(); ctx.fill();
  // head + turban
  ctx.fillStyle = '#b3714a'; ctx.beginPath(); ctx.ellipse(0, (-0.72 - bob) * s, 0.085 * s, 0.1 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff9d1f'; ctx.beginPath(); ctx.ellipse(0, (-0.8 - bob) * s, 0.12 * s, 0.085 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#d96e00'; ctx.beginPath(); ctx.ellipse(0.02 * s, (-0.83 - bob) * s, 0.09 * s, 0.04 * s, 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1410'; ctx.fillRect(-0.04 * s, (-0.73 - bob) * s, 0.02 * s, 0.02 * s); ctx.fillRect(0.025 * s, (-0.73 - bob) * s, 0.02 * s, 0.02 * s);
  // the drum across the lap
  ctx.fillStyle = '#7a3a1a'; ctx.beginPath(); ctx.roundRect(-0.42 * s, -0.4 * s, 0.84 * s, 0.2 * s, 0.1 * s); ctx.fill();
  ctx.fillStyle = '#c98a4a'; ctx.fillRect(-0.3 * s, -0.4 * s, 0.05 * s, 0.2 * s); ctx.fillRect(0.25 * s, -0.4 * s, 0.05 * s, 0.2 * s);
  ctx.fillStyle = '#f2e6c2'; ctx.beginPath(); ctx.ellipse(-0.42 * s, -0.3 * s, 0.035 * s, 0.1 * s, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(0.42 * s, -0.3 * s, 0.035 * s, 0.1 * s, 0, 0, TAU); ctx.fill();
  // hands alternate on the beat
  const left = beatCount % 2 === 0, hit = Math.max(0, 1 - bp * 3);
  ctx.fillStyle = '#b3714a';
  ctx.beginPath(); ctx.arc((left ? -0.38 : 0.38) * s, (-0.33 - hit * 0.05) * s, 0.04 * s, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc((left ? 0.2 : -0.2) * s, (-0.46 - bob) * s, 0.04 * s, 0, TAU); ctx.fill();
  ctx.restore();
  void t;
}

// An incoming (or bouncing back) pot handed in from the side. u 0..1 along the arc to the tower top.
export function drawFlyingPot(ctx, cam, from, toX, toY, u, i, spin = 0) {
  const x = from + (toX - from) * u, y = 0.9 + (toY - 0.9) * u + Math.sin(u * Math.PI) * 0.7;
  ctx.save(); ctx.translate(sx(cam, x), sy(cam, y)); ctx.rotate(spin + u * 2);
  drawPotLocal(ctx, cam.ppm, i);
  ctx.restore();
}

// A pot falling (and the shards it leaves).
export function drawFallingPot(ctx, cam, f) {
  ctx.save(); ctx.translate(sx(cam, f.x), sy(cam, f.y)); ctx.rotate(f.rot);
  drawPotLocal(ctx, cam.ppm, f.i);
  ctx.restore();
}
export { hash };
