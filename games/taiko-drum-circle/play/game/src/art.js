// Taiko Drum Circle: all the painting that is not UI. Lit pseudo-3D drums and sticks, the night stage, falling notes, sparks.
// Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the caller passes), so it is deterministic.
import { ZONE } from './music.js';

export const PAL = {
  ink: '#0b0a1f', night: '#14102e', plum: '#2a1233', ember: '#ff5a3c', emberHi: '#ffc2a0', ice: '#4fc3ff', iceHi: '#dff5ff',
  gold: '#f6d98a', goldDeep: '#c99a3e', cream: '#fff1d6', wood: '#8a4b25', woodDark: '#4a2410', woodLight: '#d49a5e',
  skin: '#f1e3c3', skinMid: '#dcc79d', skinWorn: '#b99a66', rope: '#c9b27c', text: '#fbeed8', dim: 'rgba(251,238,216,0.62)',
};
export const DISPLAY = '"Dela Gothic One", Impact, "Arial Black", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ---- a cache for the heavy static background (OffscreenCanvas when the browser has one; otherwise it is simply skipped) ------------------------
const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (!c) {
    if (caches.size > 6) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

function seigaiha(g, w, h) {
  const R = 44;
  g.lineWidth = 1.6;
  for (let r = 0, y = 0; y < h + R; r++, y += R * 0.5) {
    for (let x = (r % 2) * R; x < w + R * 2; x += R * 2) {
      for (let k = 0; k < 4; k++) {
        const rr = R * (1 - k * 0.22);
        g.strokeStyle = `rgba(150,160,255,${0.05 + 0.012 * k})`;
        g.beginPath(); g.arc(x, y + R, rr, Math.PI, 0); g.stroke();
      }
    }
  }
}

// The night stage behind everything. `pulse` 0..1 is the beat; `mood` shifts the warmth for menus.
export function drawBackdrop(ctx, w, h, t, pulse = 0, opt = {}) {
  const key = `bg${Math.round(w)}x${Math.round(h)}`;
  const scale = Math.min(1.5, 1.2);
  const c = cached(key, w, h, scale, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0a0920'); gr.addColorStop(0.5, '#171033'); gr.addColorStop(1, '#2a1233');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    seigaiha(g, w, h);
    const v = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,2,14,0.6)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else {
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0a0920'); gr.addColorStop(0.5, '#171033'); gr.addColorStop(1, '#2a1233');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  }
  // warm light washing in from the sides, breathing with the beat
  const a = 0.1 + 0.07 * pulse;
  for (const sx of [0, w]) {
    const g2 = ctx.createRadialGradient(sx, h * 0.3, 10, sx, h * 0.3, Math.max(w, h) * 0.5);
    g2.addColorStop(0, `rgba(255,150,70,${a})`); g2.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  }
  if (!opt.noEmbers) drawEmbers(ctx, w, h, t, opt.embers ?? 22);
}

export function drawEmbers(ctx, w, h, t, n = 22) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const sp = 14 + (i % 7) * 5, y = h + 20 - ((t * sp + i * 137.7) % (h + 60)), x = ((i * 97.31) % w) + Math.sin(t * 0.6 + i * 1.7) * 18;
    const life = 1 - (h + 20 - y) / (h + 60), a = 0.55 * life * (0.6 + 0.4 * Math.sin(t * 3 + i));
    const r = 1.6 + (i % 4) * 0.8;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(255,190,110,${a})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// The plank floor and the spotlight pool under the drums.
export function drawFloor(ctx, w, h, topY, cx, pulse = 0) {
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, 'rgba(60,32,22,0)'); g.addColorStop(0.18, 'rgba(66,34,22,0.92)'); g.addColorStop(1, 'rgba(22,10,14,1)');
  ctx.fillStyle = g; ctx.fillRect(0, topY, w, h - topY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, w, h - topY); ctx.clip();
  ctx.strokeStyle = 'rgba(255,200,140,0.07)'; ctx.lineWidth = 2;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 40, topY + 20); ctx.lineTo(cx + i * 150, h); ctx.stroke(); }
  for (let k = 1; k < 7; k++) { const y = topY + 20 + (h - topY - 20) * Math.pow(k / 7, 1.7); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const sp = ctx.createRadialGradient(cx, topY + (h - topY) * 0.15, 10, cx, topY + (h - topY) * 0.15, Math.max(w * 0.6, 300));
  sp.addColorStop(0, `rgba(255,190,120,${0.34 + 0.08 * pulse})`); sp.addColorStop(0.5, 'rgba(255,150,90,0.1)'); sp.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = sp; ctx.fillRect(0, topY, w, h - topY);
  ctx.restore();
}

// A hanging paper lantern (menus only).
export function drawLantern(ctx, x, y, r, t, pulse = 0) {
  ctx.save();
  const sway = Math.sin(t * 0.9 + x) * 0.04;
  ctx.translate(x, y); ctx.rotate(sway);
  ctx.strokeStyle = 'rgba(255,220,170,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r * 2.6); ctx.lineTo(0, -r * 1.05); ctx.stroke();
  const glow = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.6);
  glow.addColorStop(0, `rgba(255,170,80,${0.5 + 0.2 * pulse})`); glow.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, r * 2.6, 0, TAU); ctx.fill();
  const body = ctx.createLinearGradient(-r, 0, r, 0);
  body.addColorStop(0, '#b3321e'); body.addColorStop(0.45, '#ff8a3c'); body.addColorStop(0.55, '#ffd08a'); body.addColorStop(1, '#a52b1a');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.92, r * 1.1, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(90,20,10,0.55)'; ctx.lineWidth = 1.5;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(i) * r * 0.3 + 0.001, r * 1.1, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
  ctx.fillStyle = '#2a1410'; ctx.fillRect(-r * 0.45, -r * 1.2, r * 0.9, r * 0.2); ctx.fillRect(-r * 0.45, r * 1.0, r * 0.9, r * 0.2);
  ctx.restore();
}

// ---- the drums ---------------------------------------------------------------------------------------------------------------------------------
// kind: 0 shime (rope-laced, small), 1 chu, 2 okedo (rope zigzag), 3 o-daiko (big, studded).
const SHELL = [
  { hi: '#e0a45f', mid: '#a85f2e', lo: '#4f2610', tall: 0.9 },
  { hi: '#d9964f', mid: '#9a5224', lo: '#46200d', tall: 1.0 },
  { hi: '#c98853', mid: '#85441f', lo: '#3c1b0b', tall: 1.15 },
  { hi: '#e4ad6a', mid: '#a45a28', lo: '#4a2210', tall: 1.2 },
];

function shellPath(ctx, cx, cy, rx, ry, sh, bulge) {
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.bezierCurveTo(cx - rx * (1 + bulge), cy + sh * 0.3, cx - rx * (1 + bulge), cy + sh * 0.75, cx - rx * 0.96, cy + sh);
  ctx.ellipse(cx, cy + sh, rx * 0.96, ry * 0.96, 0, Math.PI, 0, true);
  ctx.bezierCurveTo(cx + rx * (1 + bulge), cy + sh * 0.75, cx + rx * (1 + bulge), cy + sh * 0.3, cx + rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
}

// st: { flash 0..1, zone 'D'|'K', rip: [{age (s), zone}], incD, incK (0..1 incoming glow), dim 0..1, lift (bounce px) }
export function drawDrum(ctx, cx, cy0, rx, kind, st = {}) {
  const ry = rx * 0.62, sp = SHELL[kind] ?? SHELL[1], sh = rx * 0.95 * sp.tall, bulge = kind === 3 ? 0.07 : kind === 0 ? 0.015 : 0.045;
  const flash = st.flash || 0, cy = cy0 + (st.lift || 0);
  ctx.save();
  // floor shadow
  const fy = cy + sh + ry * 0.35;
  const sg = ctx.createRadialGradient(cx, fy, 4, cx, fy, rx * 1.5);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(cx, fy, rx * 1.5, ry * 0.9, 0, 0, TAU); ctx.fill();
  // stand: two angled feet
  ctx.fillStyle = '#2a140a';
  ctx.beginPath(); ctx.moveTo(cx - rx * 0.85, cy + sh * 0.85); ctx.lineTo(cx - rx * 1.05, cy + sh + ry * 0.62); ctx.lineTo(cx - rx * 0.7, cy + sh + ry * 0.62); ctx.lineTo(cx - rx * 0.5, cy + sh * 0.95); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx + rx * 0.85, cy + sh * 0.85); ctx.lineTo(cx + rx * 1.05, cy + sh + ry * 0.62); ctx.lineTo(cx + rx * 0.7, cy + sh + ry * 0.62); ctx.lineTo(cx + rx * 0.5, cy + sh * 0.95); ctx.fill();
  // shell
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, sp.lo); g.addColorStop(0.18, sp.mid); g.addColorStop(0.38, sp.hi); g.addColorStop(0.6, sp.mid); g.addColorStop(1, sp.lo);
  ctx.fillStyle = g; shellPath(ctx, cx, cy, rx, ry, sh, bulge); ctx.fill();
  ctx.save(); shellPath(ctx, cx, cy, rx, ry, sh, bulge); ctx.clip();
  // grain
  ctx.strokeStyle = 'rgba(40,16,6,0.2)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 9; i++) { const gx = cx - rx + (i + 0.5) * (2 * rx / 9); ctx.beginPath(); ctx.moveTo(gx, cy); ctx.bezierCurveTo(gx + rx * 0.04, cy + sh * 0.3, gx - rx * 0.05, cy + sh * 0.7, gx + rx * 0.02, cy + sh + ry); ctx.stroke(); }
  // lacing / bands
  if (kind === 0) {
    ctx.strokeStyle = PAL.rope; ctx.lineWidth = Math.max(2, rx * 0.05);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI, gx = cx + Math.cos(a) * rx * 0.9; ctx.beginPath(); ctx.moveTo(gx, cy + ry * 0.8 * Math.sin(a)); ctx.lineTo(gx + rx * 0.02, cy + sh + ry * 0.4 * Math.sin(a)); ctx.stroke(); }
  } else if (kind === 2) {
    ctx.strokeStyle = PAL.rope; ctx.lineWidth = Math.max(2, rx * 0.045);
    ctx.beginPath(); for (let i = 0; i <= 10; i++) { const x = cx - rx * 0.95 + i * (rx * 1.9 / 10), y = cy + sh * (i % 2 ? 0.2 : 0.9) + ry * 0.2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  } else {
    const band = ctx.createLinearGradient(0, cy + sh * 0.12, 0, cy + sh * 0.2);
    band.addColorStop(0, 'rgba(30,12,4,0.5)'); band.addColorStop(1, 'rgba(30,12,4,0)');
    ctx.fillStyle = band; ctx.fillRect(cx - rx * 1.2, cy + sh * 0.1, rx * 2.4, sh * 0.12);
    ctx.fillStyle = 'rgba(255,230,190,0.1)'; ctx.fillRect(cx - rx * 1.2, cy + sh * 0.5, rx * 2.4, sh * 0.06);
  }
  // under-hoop shadow and a narrow specular band down the lit side
  const ao = ctx.createLinearGradient(0, cy, 0, cy + sh * 0.3);
  ao.addColorStop(0, 'rgba(20,8,2,0.55)'); ao.addColorStop(1, 'rgba(20,8,2,0)');
  ctx.fillStyle = ao; ctx.fillRect(cx - rx * 1.3, cy, rx * 2.6, sh * 0.3);
  const sb = ctx.createLinearGradient(cx - rx * 0.62, 0, cx - rx * 0.3, 0);
  sb.addColorStop(0, 'rgba(255,240,210,0)'); sb.addColorStop(0.5, 'rgba(255,240,210,0.28)'); sb.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = sb; ctx.fillRect(cx - rx * 0.62, cy + sh * 0.08, rx * 0.32, sh * 0.92);
  // soft shading at the bottom of the shell and a lit edge on the left
  const sd = ctx.createLinearGradient(0, cy + sh * 0.6, 0, cy + sh + ry);
  sd.addColorStop(0, 'rgba(0,0,0,0)'); sd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = sd; ctx.fillRect(cx - rx * 1.3, cy, rx * 2.6, sh + ry);
  ctx.restore();
  // studs along the hoop (front half)
  const n = Math.max(7, Math.round(rx / 7));
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI, x = cx + Math.cos(a) * rx * 0.97, y = cy + Math.sin(a) * ry * 0.97 + rx * 0.045;
    const sg2 = ctx.createRadialGradient(x - 1, y - 1, 0.5, x, y, rx * 0.05 + 1.5);
    sg2.addColorStop(0, '#fff3c8'); sg2.addColorStop(1, '#8c6a22');
    ctx.fillStyle = sg2; ctx.beginPath(); ctx.arc(x, y, Math.max(2, rx * 0.04), 0, TAU); ctx.fill();
  }
  // head: leather rim, skin, worn centre
  ctx.fillStyle = '#4a2a14'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,170,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx - 1, ry - 1, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  const sk = ctx.createRadialGradient(cx - rx * 0.2, cy - ry * 0.25, rx * 0.05, cx, cy, rx);
  sk.addColorStop(0, PAL.skin); sk.addColorStop(0.7, PAL.skinMid); sk.addColorStop(1, '#a88a58');
  ctx.fillStyle = sk; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.88, ry * 0.88, 0, 0, TAU); ctx.fill();
  // 3D: the skin sits below the hoop (inner shadow), a soft specular sheen, and a dent while it rings
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.62);
  const ish = ctx.createRadialGradient(0, 0, rx * 0.5, 0, 0, rx * 0.9);
  ish.addColorStop(0, 'rgba(60,30,10,0)'); ish.addColorStop(0.75, 'rgba(60,30,10,0.06)'); ish.addColorStop(1, 'rgba(50,24,8,0.5)');
  ctx.fillStyle = ish; ctx.beginPath(); ctx.arc(0, 0, rx * 0.9, 0, TAU); ctx.fill();
  const spec = ctx.createRadialGradient(-rx * 0.32, -rx * 0.34, 2, -rx * 0.32, -rx * 0.34, rx * 0.62);
  spec.addColorStop(0, 'rgba(255,255,245,0.62)'); spec.addColorStop(0.45, 'rgba(255,250,230,0.18)'); spec.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = spec; ctx.beginPath(); ctx.arc(0, 0, rx * 0.88, 0, TAU); ctx.fill();
  if (flash > 0.02) { const dn = ctx.createRadialGradient(0, 0, 2, 0, 0, rx * 0.8); dn.addColorStop(0, `rgba(70,36,14,${0.3 * flash})`); dn.addColorStop(1, 'rgba(70,36,14,0)'); ctx.fillStyle = dn; ctx.beginPath(); ctx.arc(0, 0, rx * 0.8, 0, TAU); ctx.fill(); }
  ctx.restore();
  // rim zone ring (where ka lands) and the don sweet spot
  const zD = ZONE.don;
  ctx.strokeStyle = 'rgba(120,80,40,0.28)'; ctx.lineWidth = Math.max(1.5, rx * 0.025);
  ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.88 * 0.78, ry * 0.88 * 0.78, 0, 0, TAU); ctx.stroke();
  const wn = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx * zD);
  wn.addColorStop(0, 'rgba(150,110,60,0.5)'); wn.addColorStop(0.7, 'rgba(160,120,70,0.28)'); wn.addColorStop(1, 'rgba(160,120,70,0)');
  ctx.fillStyle = wn; ctx.beginPath(); ctx.ellipse(cx, cy, rx * zD * 1.1, ry * zD * 1.4, 0, 0, TAU); ctx.fill();
  // incoming glows
  const incD = st.incD || 0, incK = st.incK || 0;
  if (incD > 0) {
    ctx.strokeStyle = rgba(PAL.ember, 0.25 + 0.6 * incD); ctx.lineWidth = 3 + 2 * incD;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * zD * 1.1, ry * zD * 1.4, 0, 0, TAU); ctx.stroke();
  }
  if (incK > 0) {
    ctx.strokeStyle = rgba(PAL.ice, 0.25 + 0.6 * incK); ctx.lineWidth = 4 + 2 * incK;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, TAU); ctx.stroke();
  }
  // impact: glow + ripples
  if (flash > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const D = st.zone !== 'K', col = D ? '255,120,60' : '90,200,255';
    const gx = D ? cx : cx + (st.kx || 0) * rx * 0.8, gy = D ? cy : cy + (st.ky || 0) * ry * 0.8;
    const gl = ctx.createRadialGradient(gx, gy, 2, gx, gy, rx * (D ? 0.9 : 0.7));
    gl.addColorStop(0, `rgba(${col},${0.85 * flash})`); gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.05, ry * 1.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  for (const rp of st.rip || []) {
    const k = clamp01(rp.age / 0.45);
    ctx.strokeStyle = rp.zone === 'K' ? `rgba(160,225,255,${0.7 * (1 - k)})` : `rgba(255,190,140,${0.7 * (1 - k)})`; ctx.lineWidth = 3 * (1 - k) + 0.5;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx * (0.3 + 0.75 * k), ry * (0.3 + 0.75 * k), 0, 0, TAU); ctx.stroke();
  }
  if (st.dim > 0) {                       // an ensemble voice that is not playing yet
    ctx.fillStyle = rgba(PAL.ink, st.dim);
    shellPath(ctx, cx, cy, rx, ry, sh, bulge); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the sticks (bachi) -------------------------------------------------------------------------------------------------------------------------
// One stick from a grip point to a tip: tapered, lit, with a soft shadow. `lift` 0 = on the skin, 1 = fully raised.
export function drawStick(ctx, gx, gy, tx, ty, thick, glow = 0) {
  const dx = tx - gx, dy = ty - gy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const w0 = thick, w1 = thick * 0.55;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.moveTo(gx + nx * w0 + 6, gy + ny * w0 + 10); ctx.lineTo(tx + nx * w1 + 6, ty + ny * w1 + 10); ctx.lineTo(tx - nx * w1 + 6, ty - ny * w1 + 10); ctx.lineTo(gx - nx * w0 + 6, gy - ny * w0 + 10); ctx.fill();
  const g = ctx.createLinearGradient(gx + nx * w0, gy + ny * w0, gx - nx * w0, gy - ny * w0);
  g.addColorStop(0, '#f2cc96'); g.addColorStop(0.45, '#c98a4c'); g.addColorStop(1, '#6b3a1a');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(gx + nx * w0, gy + ny * w0); ctx.lineTo(tx + nx * w1, ty + ny * w1); ctx.arc(tx, ty, w1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false); ctx.lineTo(gx - nx * w0, gy - ny * w0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,210,0.5)'; ctx.lineWidth = Math.max(1, thick * 0.18);
  ctx.beginPath(); ctx.moveTo(gx + nx * w0 * 0.45, gy + ny * w0 * 0.45); ctx.lineTo(tx + nx * w1 * 0.4, ty + ny * w1 * 0.4); ctx.stroke();
  if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(tx, ty, 1, tx, ty, thick * 3); gl.addColorStop(0, `rgba(255,200,140,${0.6 * glow})`); gl.addColorStop(1, 'rgba(255,200,140,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(tx, ty, thick * 3, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Both hands over a drum. lifts: [left, right] 0..~0.65 (0 = on the skin). The sticks come in from the player's side and hover over the
// upper half of the head, clear of the middle, so the skin stays readable. prev: last frame's lifts, for a motion trail.
export function drawSticks(ctx, dr, lifts, glows = [0, 0], prev = null) {
  const { cx, cy, rx, ry } = dr, th = Math.max(3.5, rx * 0.075), len = rx * 1.6;
  const pose = (side, lift) => {
    const k = Math.max(0, Math.min(1.1, lift / 0.62));
    const tipX = cx + side * rx * (0.26 + 0.42 * k), tipY = cy + ry * (0.1 - 1.0 * k);
    return [tipX + side * len * 0.7, tipY + len * 0.7, tipX, tipY];
  };
  for (let h = 0; h < 2; h++) {
    const side = h === 0 ? -1 : 1, lift = lifts[h] ?? 0.6;
    if (prev && Math.abs(lift - prev[h]) > 0.05) {
      for (const [f, al] of [[0.66, 0.16], [0.33, 0.28]]) { const l2 = prev[h] + (lift - prev[h]) * (1 - f) ; const g = pose(side, prev[h] + (lift - prev[h]) * (1 - f)); ctx.save(); ctx.globalAlpha = al; drawStick(ctx, g[0], g[1], g[2], g[3], th, 0); ctx.restore(); void l2; }
    }
    const g = pose(side, lift);
    drawStick(ctx, g[0], g[1], g[2], g[3], th, glows[h] || 0);
  }
}

// ---- the small hand gong ------------------------------------------------------------------------------------------------------------------------------
export function drawBell(ctx, x, y, r, st = {}) {
  const flash = st.flash || 0;
  ctx.save();
  ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 1.25); ctx.lineTo(x + r * 1.1, y - r * 1.25); ctx.moveTo(x - r * 0.7, y - r * 1.25); ctx.lineTo(x - r * 0.45, y - r * 0.82); ctx.moveTo(x + r * 0.7, y - r * 1.25); ctx.lineTo(x + r * 0.45, y - r * 0.82); ctx.stroke();
  const sw = (st.swing || 0) * 0.08;
  ctx.translate(x, y); ctx.rotate(sw); ctx.translate(-x, -y);
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff2bb'); g.addColorStop(0.55, '#d6a83e'); g.addColorStop(1, '#7a5a16');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#7a5a16'; ctx.beginPath(); ctx.arc(x, y, r * 0.14, 0, TAU); ctx.fill();
  if (flash > 0.01) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(x, y, 1, x, y, r * 2); gl.addColorStop(0, `rgba(255,230,150,${0.8 * flash})`); gl.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, TAU); ctx.fill(); }
  if (st.dim > 0) { ctx.fillStyle = rgba(PAL.ink, st.dim); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- notes -------------------------------------------------------------------------------------------------------------------------------------------------------
// A DON is a filled ember disc, a KA is an ice ring (different shapes as well as colours). r = radius, soft = smaller/paler.
export function drawNote(ctx, x, y, r, k, soft = false, label = null, alpha = 1, ghost = false) {
  const rr = soft ? r * 0.78 : r;
  ctx.save(); ctx.globalAlpha = alpha;
  if (k === 'D') {
    const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr);
    if (ghost) { g.addColorStop(0, 'rgba(255,200,170,0.55)'); g.addColorStop(1, 'rgba(255,90,60,0.35)'); } else { g.addColorStop(0, soft ? '#ffb199' : '#ffd0b8'); g.addColorStop(0.45, soft ? '#ff7a56' : '#ff5a3c'); g.addColorStop(1, soft ? '#b83a28' : '#c3321e'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, rr * 0.13); ctx.strokeStyle = ghost ? 'rgba(255,240,230,0.5)' : '#fff4e8'; ctx.stroke();
  } else {
    ctx.fillStyle = ghost ? 'rgba(20,40,90,0.35)' : 'rgba(12,28,70,0.82)'; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(3, rr * 0.3); ctx.strokeStyle = ghost ? 'rgba(130,210,255,0.55)' : (soft ? '#7fd0ff' : '#4fc3ff');
    ctx.beginPath(); ctx.arc(x, y, rr * 0.82, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1.2, rr * 0.08); ctx.strokeStyle = ghost ? 'rgba(225,245,255,0.5)' : '#e6f7ff';
    ctx.beginPath(); ctx.arc(x, y, rr * 1.0, 0, TAU); ctx.stroke();
  }
  if (label && !ghost && rr > 15) {
    ctx.font = `700 ${Math.round(rr * 0.62)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = k === 'D' ? '#fff' : '#cfeeff'; ctx.fillText(label, x, y + rr * 0.04);
  }
  ctx.restore();
}

// The judgement word that floats up from a drum.
export function drawPopup(ctx, p) {
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = ease(Math.min(1, k * 1.6)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(10,6,24,0.9)';
  ctx.strokeText(p.text, p.x, p.y - up); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - up);
  ctx.restore();
}

// ---- particles ---------------------------------------------------------------------------------------------------------------------------------------------------
export function drawParticles(ctx, list) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = p.life / p.max, a = Math.max(0, k);
    const r = p.size * (0.4 + 0.6 * k);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.2);
    g.addColorStop(0, `rgba(${p.c},${0.9 * a})`); g.addColorStop(1, `rgba(${p.c},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
export function stepParticles(list, dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt; if (p.life <= 0) { list.splice(i, 1); continue; }
    p.vy += (p.g ?? 520) * dt; p.vx *= 1 - 1.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
export function burst(list, rng, x, y, n, zone, power = 1) {
  const c = zone === 'K' ? '120,205,255' : '255,150,80';
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI, 0) , sp = rng.range(120, 420) * power;
    list.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, life: rng.range(0.3, 0.7), max: 0.7, size: rng.range(3, 7), c: rng.chance(0.25) ? '255,240,200' : c });
  }
  while (list.length > 360) list.shift();
}

// A lane: a trapezoid track that narrows towards the top (depth), with bar/beat lines drawn by the caller.
export function drawLane(ctx, x, top, bottom, wTop, wBot, hot = 0, dim = false) {
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, dim ? 'rgba(255,240,220,0.05)' : 'rgba(255,240,220,0.11)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - wTop / 2, top); ctx.lineTo(x + wTop / 2, top); ctx.lineTo(x + wBot / 2, bottom); ctx.lineTo(x - wBot / 2, bottom); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dim ? 'rgba(255,230,200,0.08)' : `rgba(255,230,200,${0.2 + 0.25 * hot})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - wTop / 2, top); ctx.lineTo(x - wBot / 2, bottom); ctx.moveTo(x + wTop / 2, top); ctx.lineTo(x + wBot / 2, bottom); ctx.stroke();
  if (hot > 0) { ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createLinearGradient(0, bottom - 120, 0, bottom); hg.addColorStop(0, 'rgba(255,170,100,0)'); hg.addColorStop(1, `rgba(255,170,100,${0.28 * hot})`); ctx.fillStyle = hg; ctx.fillRect(x - wBot / 2, bottom - 120, wBot, 120); }
  ctx.restore();
}

// Stars (for results and piece cards): n of 3 filled.
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}
