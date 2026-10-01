// Drawing primitives and characters: lit sphere ball, figures, stumps and bin, particles, text styles.
// Pure functions of (ctx, params): no state, no randomness except a tiny hash for repeatable speckle.
import { W, H, clamp, lerp } from './core.js';

export const FONT = "Georgia, 'Times New Roman', serif";
export const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const PAL = {
  gold: '#ffcf6b', amber: '#ff9d3d', peach: '#ffb48a', coral: '#ff6b57', plum: '#3b2a55', ink: '#1b1226', navy: '#13203a',
  cream: '#fff4dc', teal: '#2ec4b6', tealDark: '#0f6f6a', sky1: '#35609a', sky2: '#e58f6c', sky3: '#ffd98a',
  panel: 'rgba(22,16,36,0.78)', panelEdge: 'rgba(255,214,140,0.35)', white: '#ffffff', red: '#e24a3b', green: '#58c46a',
};

export const hash = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y); ctx.arcTo(x + w, y, x + w, y + h, k); ctx.arcTo(x + w, y + h, x, y + h, k); ctx.arcTo(x, y + h, x, y, k); ctx.arcTo(x, y, x + w, y, k); ctx.closePath();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export const mix = (a, b, t) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

export function vGrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

export function glow(ctx, x, y, r, color, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('A', String(a)));
  g.addColorStop(1, color.replace('A', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---- the ball: a lit sphere with a seam that rotates --------------------------------------------------------------
export function drawBall(ctx, x, y, r, kind = 'leather', spin = 0, alpha = 1, lit = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const base = kind === 'tennis' ? ['#f4ff7a', '#b7d12a', '#6c8212'] : ['#ff6a4d', '#c3281c', '#5a0d0a'];
  const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r * 1.05);
  g.addColorStop(0, base[0]); g.addColorStop(0.45, base[1]); g.addColorStop(1, base[2]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  // seam
  if (r > 4) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.translate(x, y); ctx.rotate(spin);
    ctx.strokeStyle = kind === 'tennis' ? 'rgba(255,255,255,0.9)' : 'rgba(255,236,200,0.85)';
    ctx.lineWidth = Math.max(1, r * 0.13);
    ctx.beginPath(); ctx.ellipse(0, 0, r * 1.05, r * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
    if (kind !== 'tennis') {
      ctx.setLineDash([r * 0.12, r * 0.12]);
      ctx.beginPath(); ctx.ellipse(0, r * 0.06, r * 1.0, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  // specular + rim
  ctx.fillStyle = `rgba(255,255,255,${0.55 * lit})`;
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.42, r * 0.28, r * 0.17, -0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(40,10,0,0.35)'; ctx.lineWidth = Math.max(1, r * 0.08);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Comet trail from recent screen points [{x,y,r}] oldest first.
export function drawTrail(ctx, pts, color = '255,236,190') {
  if (pts.length < 2) return;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const t = i / pts.length;
    ctx.strokeStyle = `rgba(${color},${0.55 * t * t})`;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, b.r * 1.5 * t);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

// ---- stumps and bin -----------------------------------------------------------------------------------------------
// base = ground-point screen position, k = pixels per metre at that depth. broken: 0..1 stumps flying.
export function drawStumps(ctx, x, y, k, broken = 0, shadow = true) {
  const sp = 0.114 * k, h = 0.71 * k, w = Math.max(1.2, 0.04 * k);
  if (shadow) {
    ctx.fillStyle = 'rgba(20,30,10,0.28)';
    ctx.beginPath(); ctx.moveTo(x - sp - w, y); ctx.lineTo(x + sp + w, y); ctx.lineTo(x + sp - h * 0.95, y + h * 0.16); ctx.lineTo(x - sp - h * 0.95, y + h * 0.16); ctx.closePath(); ctx.fill();
  }
  for (let i = -1; i <= 1; i++) {
    const fly = broken * (i * 0.35 + 0.15);
    ctx.save();
    ctx.translate(x + i * sp + fly * h * 0.9, y - broken * h * 0.25 * (1 - i * i * 0.3));
    ctx.rotate(broken * (i * 0.9 + 0.5) * 1.2);
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, '#f8e2b0'); g.addColorStop(1, '#b9904f');
    ctx.fillStyle = g;
    rr(ctx, -w / 2, -h, w, h, w * 0.4); ctx.fill();
    ctx.restore();
  }
  // bails
  ctx.fillStyle = '#ffeab8';
  ctx.fillRect(x - sp - w * 0.2 - broken * h * 0.5, y - h - w * 0.9 - broken * h * 0.4, sp * 1.1, Math.max(1, w * 0.8));
  ctx.fillRect(x + w * 0.2 + broken * h * 0.6, y - h - w * 0.9 - broken * h * 0.5, sp * 1.1, Math.max(1, w * 0.8));
}

export function drawBin(ctx, x, y, k, broken = 0) {
  const bw = 0.5 * k, bt = 0.58 * k, bh = 0.95 * k;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(broken * 0.9);
  ctx.fillStyle = 'rgba(20,30,10,0.3)';
  ctx.beginPath(); ctx.ellipse(-bh * 0.35, 3, bh * 0.6, bw * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(-bt / 2, 0, bt / 2, 0);
  g.addColorStop(0, '#1f7a4a'); g.addColorStop(0.55, '#35b36e'); g.addColorStop(1, '#176a40');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-bw / 2, 0); ctx.lineTo(bw / 2, 0); ctx.lineTo(bt / 2, -bh); ctx.lineTo(-bt / 2, -bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#145d36'; ctx.fillRect(-bt / 2 - 2, -bh - bh * 0.06, bt + 4, bh * 0.07);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-bt / 2 + bt * 0.08, -bh * 0.9, bt * 0.08, bh * 0.8);
  ctx.fillStyle = '#222'; rr(ctx, -bw * 0.12, -bh * 0.6, bw * 0.24, bh * 0.06, 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-bw * 0.3, 0, bw * 0.08, 0, 7); ctx.arc(bw * 0.3, 0, bw * 0.08, 0, 7); ctx.fill();
  ctx.restore();
}

// ---- people --------------------------------------------------------------------------------------------------------
function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = shade(color, -34); ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w * 0.78;
  ctx.beginPath(); ctx.moveTo(x1 - w * 0.06, y1); ctx.lineTo(x2 - w * 0.06, y2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = w * 0.22;
  ctx.beginPath(); ctx.moveTo(x1 + w * 0.2, y1); ctx.lineTo(x2 + w * 0.2, y2); ctx.stroke();
}

export const KIT = {
  home: { shirt: '#f4ead2', shirt2: '#2ec4b6', pants: '#f4ead2', pad: '#fffaf0', helmet: '#1f6f78', skin: '#c98a5e' },
  away: { shirt: '#3d6fd1', shirt2: '#ffcf6b', pants: '#2c3f78', pad: '#ffffff', helmet: '#2c3f78', skin: '#a8714a' },
  yard: { shirt: '#f4a53a', shirt2: '#ffffff', pants: '#2d6a8a', pad: '#fffaf0', helmet: '#2d6a8a', skin: '#d79c6e' },
  beach: { shirt: '#ff7a59', shirt2: '#ffffff', pants: '#2ec4b6', pad: '#fffaf0', helmet: '#ff7a59', skin: '#dba273' },
};

// Perspective figure. (x,y) = ground point between the feet, k = px per metre. face: 'front' | 'back'.
// pose: { run (phase radians), arm (windmill angle radians or null), crouch 0..1, lean px, flip }
export function drawPerson(ctx, x, y, k, o) {
  const kit = o.kit, face = o.face ?? 'front', pose = o.pose ?? {};
  const run = pose.run ?? 0, crouch = pose.crouch ?? 0, lean = (pose.lean ?? 0) * k;
  const hipY = y - (0.94 - 0.1 * crouch) * k, shY = y - (1.5 - 0.16 * crouch) * k, headY = y - (1.7 - 0.2 * crouch) * k;
  // shadow, long toward the camera-left
  ctx.fillStyle = 'rgba(20,30,10,0.3)';
  ctx.beginPath(); ctx.ellipse(x - k * 0.5 * (o.sdir ?? 1), y + k * 0.03, k * 0.85, k * 0.1, -0.12 * (o.sdir ?? 1), 0, Math.PI * 2); ctx.fill();
  const stride = Math.sin(run) * 0.2 * k;
  const lx = x - 0.1 * k, rx = x + 0.1 * k;
  const lf = [lx - 0.03 * k, y + stride * 0.2], rf = [rx + 0.03 * k, y - stride * 0.2];
  const lk = [lx - 0.05 * k, hipY + 0.45 * k + (stride > 0 ? -stride * 0.3 : 0)], rk = [rx + 0.05 * k, hipY + 0.45 * k + (stride < 0 ? stride * 0.3 : 0)];
  const pants = kit.pants;
  limb(ctx, lx, hipY, lk[0] + stride * 0.3, lk[1], 0.15 * k, pants);
  limb(ctx, lk[0] + stride * 0.3, lk[1], lf[0] + stride * 0.4, lf[1] - 0.04 * k, 0.12 * k, pants);
  limb(ctx, rx, hipY, rk[0] - stride * 0.3, rk[1], 0.15 * k, pants);
  limb(ctx, rk[0] - stride * 0.3, rk[1], rf[0] - stride * 0.4, rf[1] - 0.04 * k, 0.12 * k, pants);
  if (o.pads) {
    ctx.fillStyle = kit.pad;
    for (const sx of [lx - 0.02 * k, rx + 0.02 * k]) { rr(ctx, sx - 0.085 * k, y - 0.62 * k, 0.17 * k, 0.52 * k, 0.05 * k); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    for (const sx of [lx - 0.02 * k, rx + 0.02 * k]) { ctx.beginPath(); ctx.moveTo(sx - 0.06 * k, y - 0.5 * k); ctx.lineTo(sx + 0.06 * k, y - 0.5 * k); ctx.moveTo(sx - 0.06 * k, y - 0.34 * k); ctx.lineTo(sx + 0.06 * k, y - 0.34 * k); ctx.stroke(); }
  }
  ctx.fillStyle = '#2a2018';
  for (const f of [[lf[0] + stride * 0.4, lf[1]], [rf[0] - stride * 0.4, rf[1]]]) { ctx.beginPath(); ctx.ellipse(f[0], f[1] - 0.02 * k, 0.09 * k, 0.045 * k, 0, 0, Math.PI * 2); ctx.fill(); }
  // torso
  const tg = ctx.createLinearGradient(x - 0.26 * k, 0, x + 0.26 * k, 0);
  tg.addColorStop(0, shade(kit.shirt, -26)); tg.addColorStop(0.65, kit.shirt); tg.addColorStop(1, shade(kit.shirt, 14));
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(x - 0.25 * k + lean, shY); ctx.quadraticCurveTo(x + lean, shY - 0.07 * k, x + 0.25 * k + lean, shY);
  ctx.lineTo(x + 0.18 * k, hipY + 0.06 * k); ctx.lineTo(x - 0.18 * k, hipY + 0.06 * k); ctx.closePath(); ctx.fill();
  ctx.fillStyle = kit.shirt2; ctx.fillRect(x - 0.2 * k + lean * 0.5, shY + 0.1 * k, 0.4 * k, 0.045 * k);
  if (face === 'back' && o.num != null) { ctx.fillStyle = 'rgba(30,40,60,0.8)'; ctx.font = `700 ${(0.2 * k) | 0}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(String(o.num), x + lean * 0.5, shY + 0.34 * k); }
  // arms
  const arm = pose.arm;
  const hands = [];
  for (const s of [-1, 1]) {
    const sx = x + s * 0.24 * k + lean, sy = shY + 0.04 * k;
    let hx, hy;
    if (arm != null && s === 1) { hx = sx + Math.sin(arm) * 0.62 * k; hy = sy - Math.cos(arm) * 0.62 * k; }
    else if (o.handsTo && !(s === -1 && o.handsTo.one)) { hx = o.handsTo.x + s * 0.05 * k; hy = o.handsTo.y; }
    else { hx = sx + s * 0.12 * k + (Math.sin(run + s) * 0.08 * k); hy = sy + 0.5 * k; }
    limb(ctx, sx, sy, (sx + hx) / 2 + s * 0.05 * k, (sy + hy) / 2 + 0.04 * k, 0.11 * k, kit.shirt);
    limb(ctx, (sx + hx) / 2 + s * 0.05 * k, (sy + hy) / 2 + 0.04 * k, hx, hy, 0.09 * k, kit.skin);
    hands.push([hx, hy]);
  }
  // head
  ctx.fillStyle = kit.skin;
  ctx.beginPath(); ctx.arc(x + lean * 1.1, headY, 0.105 * k, 0, Math.PI * 2); ctx.fill();
  const hx0 = x + lean * 1.1;
  if (o.helmet) {
    const hg = ctx.createRadialGradient(hx0 - 0.04 * k, headY - 0.07 * k, 0.02 * k, hx0, headY, 0.16 * k);
    hg.addColorStop(0, shade(kit.helmet, 60)); hg.addColorStop(1, shade(kit.helmet, -30));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(hx0, headY - 0.015 * k, 0.14 * k, Math.PI, 0); ctx.lineTo(hx0 + 0.13 * k, headY + 0.07 * k); ctx.lineTo(hx0 - 0.13 * k, headY + 0.07 * k); ctx.closePath(); ctx.fill();
    if (face === 'front') { ctx.strokeStyle = 'rgba(230,235,240,0.85)'; ctx.lineWidth = Math.max(1, 0.012 * k); for (let g = 0; g < 3; g++) { ctx.beginPath(); ctx.moveTo(hx0 - 0.1 * k, headY + 0.02 * k + g * 0.035 * k); ctx.lineTo(hx0 + 0.1 * k, headY + 0.02 * k + g * 0.035 * k); ctx.stroke(); } }
  } else if (o.cap) {
    ctx.fillStyle = kit.shirt2 === '#ffffff' ? shade(kit.shirt, -20) : kit.shirt2;
    ctx.beginPath(); ctx.arc(hx0, headY - 0.02 * k, 0.115 * k, Math.PI, 0); ctx.closePath(); ctx.fill();
    ctx.fillRect(hx0 - 0.12 * k, headY - 0.03 * k, 0.24 * k, 0.03 * k);
  } else {
    ctx.fillStyle = '#2b1d14'; ctx.beginPath(); ctx.arc(hx0, headY - 0.02 * k, 0.108 * k, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
  }
  if (face === 'front') { ctx.fillStyle = 'rgba(30,20,10,0.7)'; ctx.fillRect(hx0 - 0.045 * k, headY - 0.005 * k, 0.018 * k, 0.018 * k); ctx.fillRect(hx0 + 0.027 * k, headY - 0.005 * k, 0.018 * k, 0.018 * k); }
  return { hands, head: [hx0, headY], shoulder: [x + lean, shY] };
}

// The bat: handle at (hx,hy), tip direction by angle a (0 = straight down, positive = toward screen-right), length L px.
export function drawBat(ctx, hx, hy, a, L, w) {
  const dx = Math.sin(a), dy = Math.cos(a);
  const tx = hx + dx * L, ty = hy + dy * L;
  const nx = -dy, ny = dx;
  ctx.save();
  // handle
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = w * 0.34;
  ctx.beginPath(); ctx.moveTo(hx - dx * L * 0.12, hy - dy * L * 0.12); ctx.lineTo(hx + dx * L * 0.3, hy + dy * L * 0.3); ctx.stroke();
  // blade
  const b0x = hx + dx * L * 0.3, b0y = hy + dy * L * 0.3;
  const g = ctx.createLinearGradient(b0x - nx * w, b0y - ny * w, b0x + nx * w, b0y + ny * w);
  g.addColorStop(0, '#d8b06a'); g.addColorStop(0.5, '#f6dc9c'); g.addColorStop(1, '#b8873f');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(b0x - nx * w * 0.42, b0y - ny * w * 0.42); ctx.lineTo(b0x + nx * w * 0.42, b0y + ny * w * 0.42);
  ctx.lineTo(tx + nx * w * 0.5, ty + ny * w * 0.5); ctx.lineTo(tx - nx * w * 0.5, ty - ny * w * 0.5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(80,45,10,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = w * 0.1;
  ctx.beginPath(); ctx.moveTo(b0x - nx * w * 0.1 + dx * L * 0.05, b0y - ny * w * 0.1 + dy * L * 0.05); ctx.lineTo(tx - nx * w * 0.1 - dx * 4, ty - ny * w * 0.1 - dy * 4); ctx.stroke();
  ctx.restore();
  return [tx, ty];
}

// ---- top-down figure -----------------------------------------------------------------------------------------------
export function drawTopPerson(ctx, x, y, s, o) {
  const kit = o.kit, fx = o.fx ?? 0, fz = o.fz ?? 1;
  const ang = Math.atan2(fx, -fz);
  const run = (o.run ?? 0), ph = o.phase ?? 0;
  ctx.save();
  // shadow toward lower-left (sun upper right)
  ctx.fillStyle = 'rgba(20,28,10,0.32)';
  ctx.beginPath(); ctx.ellipse(x - s * 0.55, y + s * 0.4, s * 0.95, s * 0.36, -0.55, 0, Math.PI * 2); ctx.fill();
  ctx.translate(x, y); ctx.rotate(ang);
  // legs
  const sw = Math.sin(ph * 10) * run * s * 0.42;
  ctx.fillStyle = kit.pants;
  ctx.beginPath(); ctx.ellipse(-s * 0.2, sw, s * 0.2, s * 0.42, 0, 0, Math.PI * 2); ctx.ellipse(s * 0.2, -sw, s * 0.2, s * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  // shoulders / shirt
  const g = ctx.createLinearGradient(-s * 0.7, 0, s * 0.7, 0);
  g.addColorStop(0, shade(kit.shirt, -30)); g.addColorStop(0.6, kit.shirt); g.addColorStop(1, shade(kit.shirt, 18));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.66, s * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  // arms
  ctx.strokeStyle = kit.skin; ctx.lineCap = 'round'; ctx.lineWidth = s * 0.2;
  const up = o.arms ?? 0;
  ctx.beginPath(); ctx.moveTo(-s * 0.55, -s * 0.05); ctx.lineTo(-s * (0.7 + up * 0.15), -s * (0.3 + up * 0.5) + sw * 0.4); ctx.moveTo(s * 0.55, -s * 0.05); ctx.lineTo(s * (0.7 + up * 0.15), -s * (0.3 + up * 0.5) - sw * 0.4); ctx.stroke();
  // head with cap/helmet
  ctx.fillStyle = kit.skin; ctx.beginPath(); ctx.arc(0, -s * 0.18, s * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = o.helmet ? kit.helmet : (kit.shirt2 === '#ffffff' ? shade(kit.shirt, -25) : kit.shirt2);
  ctx.beginPath(); ctx.arc(0, -s * 0.2, s * 0.32, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.3, s * 0.1, s * 0.06, -0.5, 0, 7); ctx.fill();
  ctx.restore();
}

// ---- particles & callouts -------------------------------------------------------------------------------------------
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = p.w * a + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); }
    else if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore(); }
    else if (p.kind === 'flash') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(255,224,150,0.5)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); }
    else if (p.kind === 'grass') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.rot, 0, 7); ctx.fill(); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function textFill(ctx, text, x, y, size, opts = {}) {
  const { weight = 700, font = FONT, italic = false, color = PAL.cream, stroke = null, align = 'center', alpha = 1, shadow = true, grad = null, base = 'alphabetic' } = opts;
  ctx.save();
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = base; ctx.globalAlpha = alpha;
  if (shadow) { ctx.fillStyle = 'rgba(10,6,20,0.55)'; ctx.fillText(text, x + size * 0.04, y + size * 0.06); }
  if (stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.12; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y); }
  if (grad) { const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.2); grad.forEach(([o, c]) => g.addColorStop(o, c)); ctx.fillStyle = g; } else ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

export { W, H };
