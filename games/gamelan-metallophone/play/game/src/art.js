// Gamelan: all the painting that is not UI. Lit pseudo-3D bronze bars and gongs, carved wood, brass lamps, the lamp-lit hall, falling notes.
// Pure canvas 2D; no DOM. Everything is a function of its arguments (and the clock the caller passes), so it is deterministic.

export const PAL = {
  ink: '#120808', night: '#1c0d0b', teak: '#3b1c10', teakHi: '#7a4326', maroon: '#4a1418', amber: '#ffb347', amberHi: '#ffe2a8', jade: '#59d4b6', jadeHi: '#c6fff0',
  gold: '#f2cf7c', goldDeep: '#b98a36', cream: '#fff0d0', bronze: '#b8873a', bronzeHi: '#f3d48a', bronzeLo: '#5a3a12', text: '#fcefd6', dim: 'rgba(252,239,214,0.62)',
};
export const DISPLAY = '"Cinzel", "Trajan Pro", Georgia, "Times New Roman", serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TAU = Math.PI * 2;
const ease = (x) => x * x * (3 - 2 * x);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

// ---- a cache for the heavy static background (OffscreenCanvas when the browser has one; otherwise it is simply skipped) ------------------------
const caches = new Map();
function cached(key, w, h, scale, paint) {
  if (typeof OffscreenCanvas !== 'function') return null;
  let c = caches.get(key);
  if (c === undefined) {
    if (caches.size > 8) caches.clear();
    try { c = new OffscreenCanvas(Math.max(2, Math.round(w * scale)), Math.max(2, Math.round(h * scale))); const g = c.getContext('2d'); g.scale(scale, scale); paint(g, w, h); } catch { c = null; }
    caches.set(key, c);
  }
  return c;
}

// A batik-style lattice of four-petal rosettes (overlapping ellipses), faint gold on the dark teak.
function lattice(g, w, h) {
  const S = 74;
  g.lineWidth = 1.3;
  for (let r = 0, y = 0; y < h + S; r++, y += S / 2) {
    for (let x = (r % 2) * (S / 2); x < w + S; x += S) {
      g.strokeStyle = 'rgba(242,207,124,0.05)';
      for (let k = 0; k < 2; k++) { g.beginPath(); g.ellipse(x, y, S * 0.2, S * 0.43, k * Math.PI / 2, 0, TAU); g.stroke(); }
      g.strokeStyle = 'rgba(242,207,124,0.03)'; g.beginPath(); g.arc(x, y, S * 0.5, 0, TAU); g.stroke();
    }
  }
}

// The hall behind everything. `pulse` 0..1 is the beat.
export function drawBackdrop(ctx, w, h, t, pulse = 0, opt = {}) {
  const key = `bg${Math.round(w)}x${Math.round(h)}`;
  const c = cached(key, w, h, 1.1, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#120807'); gr.addColorStop(0.45, '#2a0f0d'); gr.addColorStop(1, '#3a1710');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    lattice(g, w, h);
    const v = g.createRadialGradient(w / 2, h * 0.55, Math.min(w, h) * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(6,2,2,0.66)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  if (c) ctx.drawImage(c, 0, 0, w, h);
  else { const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#120807'); gr.addColorStop(0.5, '#2a0f0d'); gr.addColorStop(1, '#3a1710'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
  const a = 0.12 + 0.06 * pulse;
  for (const sx of [0, w]) {
    const g2 = ctx.createRadialGradient(sx, h * 0.28, 10, sx, h * 0.28, Math.max(w, h) * 0.55);
    g2.addColorStop(0, `rgba(255,170,80,${a})`); g2.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
  }
  if (!opt.noMotes) drawMotes(ctx, w, h, t, opt.motes ?? 18);
}

// Slow warm dust drifting up through the lamp light.
export function drawMotes(ctx, w, h, t, n = 18) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const sp = 9 + (i % 6) * 3, y = h + 20 - ((t * sp + i * 137.7) % (h + 60)), x = ((i * 97.31) % w) + Math.sin(t * 0.5 + i * 1.7) * 22;
    const life = 1 - (h + 20 - y) / (h + 60), a = 0.4 * life * (0.6 + 0.4 * Math.sin(t * 2 + i));
    const r = 1.4 + (i % 4) * 0.7;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    g.addColorStop(0, `rgba(255,214,150,${a})`); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// The polished plank floor and the pool of lamp light under the instrument.
export function drawFloor(ctx, w, h, topY, cx, pulse = 0) {
  const g = ctx.createLinearGradient(0, topY, 0, h);
  g.addColorStop(0, 'rgba(70,34,20,0)'); g.addColorStop(0.16, 'rgba(78,38,22,0.94)'); g.addColorStop(1, 'rgba(26,10,8,1)');
  ctx.fillStyle = g; ctx.fillRect(0, topY, w, h - topY);
  ctx.save(); ctx.beginPath(); ctx.rect(0, topY, w, h - topY); ctx.clip();
  ctx.strokeStyle = 'rgba(255,200,140,0.07)'; ctx.lineWidth = 2;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 44, topY + 14); ctx.lineTo(cx + i * 160, h); ctx.stroke(); }
  for (let k = 1; k < 7; k++) { const y = topY + 16 + (h - topY - 16) * Math.pow(k / 7, 1.7); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const sp = ctx.createRadialGradient(cx, topY + (h - topY) * 0.12, 10, cx, topY + (h - topY) * 0.12, Math.max(w * 0.62, 320));
  sp.addColorStop(0, `rgba(255,196,120,${0.34 + 0.08 * pulse})`); sp.addColorStop(0.5, 'rgba(255,150,80,0.1)'); sp.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = sp; ctx.fillRect(0, topY, w, h - topY);
  ctx.restore();
}

// A hanging brass oil lamp with a flickering flame (menus and the hall).
export function drawLamp(ctx, x, y, r, t, pulse = 0) {
  ctx.save();
  const sway = Math.sin(t * 0.8 + x) * 0.035;
  ctx.translate(x, y); ctx.rotate(sway);
  ctx.strokeStyle = 'rgba(214,170,90,0.55)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(0, -r * 4); ctx.lineTo(0, -r * 0.95); ctx.stroke(); ctx.setLineDash([]);
  const fl = 0.85 + 0.15 * Math.sin(t * 9 + x) * Math.sin(t * 5.3 + x * 0.3);
  const glow = ctx.createRadialGradient(0, -r * 0.2, r * 0.2, 0, -r * 0.2, r * 3.4);
  glow.addColorStop(0, `rgba(255,190,100,${(0.5 + 0.2 * pulse) * fl})`); glow.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 3.4, 0, TAU); ctx.fill();
  // flame
  const fg = ctx.createRadialGradient(0, -r * 0.5, 1, 0, -r * 0.45, r * 0.55);
  fg.addColorStop(0, '#fffbe0'); fg.addColorStop(0.5, '#ffc04d'); fg.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, -r * 0.45, r * 0.26 * fl, r * 0.58 * fl, 0, 0, TAU); ctx.fill();
  // brass bowl
  const body = ctx.createLinearGradient(-r, 0, r, 0);
  body.addColorStop(0, '#6a4510'); body.addColorStop(0.3, '#d9a94a'); body.addColorStop(0.5, '#fbe7a0'); body.addColorStop(0.75, '#b9852e'); body.addColorStop(1, '#5a3a0c');
  ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 0.9, r * 0.9, 0, r * 1.05); ctx.quadraticCurveTo(r * 0.9, r * 0.9, r, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.22, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,190,0.55)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.98, r * 0.2, 0, Math.PI, TAU); ctx.stroke();
  ctx.restore();
}

// A gilded scroll row: repeating spirals, used on the carved fronts of the stands.
function scrollRow(ctx, x0, x1, y, h, col, alpha = 0.7) {
  ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = alpha; ctx.lineWidth = Math.max(1.4, h * 0.075); ctx.lineCap = 'round';
  const cell = h * 1.9, n = Math.max(1, Math.floor((x1 - x0) / cell)), step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) {
    const cx = x0 + step * (i + 0.5), dir = i % 2 ? -1 : 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      for (let a = 0; a <= 4.6; a += 0.2) { const rad = h * 0.36 * (1 - a / 5.6), px = cx + s * (h * 0.46 + Math.cos(a * dir * s + (s > 0 ? 0 : Math.PI)) * rad * s * s), py = y + Math.sin(a * dir) * rad * 1.0; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, y, h * 0.08, 0, TAU); ctx.fillStyle = col; ctx.fill();
  }
  ctx.restore();
}

// ---- the bar instrument ------------------------------------------------------------------------------------------------------------------------
// frame: { x, y, w, h, skirt } the carved wooden body the bars sit in. Drawn BEFORE the bars.
export function drawFrame(ctx, f, st = {}) {
  const { x, y, w, h } = f, skirt = f.skirt ?? h * 0.22;
  ctx.save();
  // soft floor shadow
  const sg = ctx.createRadialGradient(x + w / 2, y + h + skirt, 10, x + w / 2, y + h + skirt, w * 0.6);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + skirt + 6, w * 0.58, 26, 0, 0, TAU); ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, y, 0, y + h + skirt);
  g.addColorStop(0, '#8a4a28'); g.addColorStop(0.18, '#5e2d16'); g.addColorStop(0.7, '#3b1a0d'); g.addColorStop(1, '#25100a');
  ctx.fillStyle = g; rr(ctx, x, y, w, h + skirt, 20); ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h + skirt, 20); ctx.clip();
  ctx.strokeStyle = 'rgba(20,8,2,0.25)'; ctx.lineWidth = 1.3;
  for (let i = 0; i < 12; i++) { const gy = y + (i + 0.5) * ((h + skirt) / 12); ctx.beginPath(); ctx.moveTo(x, gy); ctx.bezierCurveTo(x + w * 0.3, gy + 4 * Math.sin(i), x + w * 0.7, gy - 4 * Math.cos(i), x + w, gy + 2); ctx.stroke(); }
  const hl = ctx.createLinearGradient(0, y, 0, y + h * 0.1); hl.addColorStop(0, 'rgba(255,214,160,0.35)'); hl.addColorStop(1, 'rgba(255,214,160,0)'); ctx.fillStyle = hl; ctx.fillRect(x, y, w, h * 0.1);
  ctx.restore();
  // the trough the bars lie in (dark, with cord rails)
  const ix = x + w * 0.012, iy = y + h * 0.1, iw = w * 0.976, ih = h * 0.8;
  const tg = ctx.createLinearGradient(0, iy, 0, iy + ih); tg.addColorStop(0, '#120604'); tg.addColorStop(1, '#2a1208');
  ctx.fillStyle = tg; rr(ctx, ix, iy, iw, ih, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(242,207,124,0.6)'; ctx.lineWidth = 2; rr(ctx, x + 3, y + 3, w - 6, h + skirt - 6, 18); ctx.stroke();
  // carved skirt
  const sy = y + h;
  const sk = ctx.createLinearGradient(0, sy, 0, sy + skirt); sk.addColorStop(0, 'rgba(0,0,0,0.5)'); sk.addColorStop(0.2, 'rgba(0,0,0,0)'); ctx.fillStyle = sk; ctx.fillRect(x + 4, sy, w - 8, skirt);
  scrollRow(ctx, x + w * 0.04, x + w * 0.96, sy + skirt * 0.5, skirt * 0.62, '#f2cf7c', 0.75);
  // end blocks with a gilded boss
  for (const bx of [x + w * 0.0, x + w - 6]) { ctx.fillStyle = 'rgba(242,207,124,0.16)'; ctx.fillRect(bx, y + 14, 6, h + skirt - 28); }
  ctx.restore();
}

// One bar. it: { cx, cy, w, h }. st: { flash 0..1 (just struck), ring 0..1 (sustain), inc 0..1 (note incoming), dim 0..1, label, t, ens }.
export function drawBar(ctx, it, st = {}) {
  const { cx, cy, w, h } = it, x = cx - w / 2, y = cy - h / 2, flash = st.flash || 0, ring = st.ring || 0, inc = st.inc || 0;
  ctx.save();
  // the dark resonator slot under the bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, x - 3, y - 2, w + 6, h + 10, w * 0.14); ctx.fill();
  // body
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#5c3a12'); g.addColorStop(0.14, '#a77a30'); g.addColorStop(0.34, '#f1d489'); g.addColorStop(0.55, '#c99a44'); g.addColorStop(0.85, '#8d6424'); g.addColorStop(1, '#4a2e0c');
  ctx.fillStyle = g; rr(ctx, x, y, w, h, w * 0.14); ctx.fill();
  const vg = ctx.createLinearGradient(0, y, 0, y + h); vg.addColorStop(0, 'rgba(255,240,200,0.28)'); vg.addColorStop(0.35, 'rgba(255,240,200,0)'); vg.addColorStop(0.8, 'rgba(40,20,0,0)'); vg.addColorStop(1, 'rgba(40,20,0,0.4)');
  ctx.fillStyle = vg; rr(ctx, x, y, w, h, w * 0.14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,238,190,0.5)'; ctx.lineWidth = 1.6; rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, w * 0.13); ctx.stroke();
  // fine hammer-finish lines
  ctx.save(); rr(ctx, x, y, w, h, w * 0.14); ctx.clip(); ctx.strokeStyle = 'rgba(80,46,6,0.16)'; ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) { const yy = y + h * i / 7; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy + 2); ctx.stroke(); }
  ctx.restore();
  // nail holes at the two nodal points, and the raised boss between them
  for (const f of [0.2, 0.8]) { ctx.fillStyle = '#2a1706'; ctx.beginPath(); ctx.arc(cx, y + h * f, Math.max(2.4, w * 0.045), 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,230,160,0.6)'; ctx.beginPath(); ctx.arc(cx - 0.7, y + h * f - 0.7, Math.max(1, w * 0.016), 0, TAU); ctx.fill(); }
  const bs = w * 0.2, bg = ctx.createRadialGradient(cx - bs * 0.3, cy - bs * 0.35, 1, cx, cy, bs);
  bg.addColorStop(0, '#fff3c4'); bg.addColorStop(0.5, '#d8a84a'); bg.addColorStop(1, '#7a5214');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, bs, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,34,4,0.5)'; ctx.lineWidth = 1.2; ctx.stroke();
  // the scale numeral, engraved
  if (st.label !== undefined && st.label !== null) {
    ctx.font = `800 ${Math.max(14, w * 0.3)}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,240,190,0.5)'; ctx.fillText(String(st.label), cx, y + h * 0.9 + 1); ctx.fillStyle = 'rgba(70,40,4,0.85)'; ctx.fillText(String(st.label), cx, y + h * 0.9);
  }
  // incoming glow outline
  if (inc > 0) { ctx.strokeStyle = rgba(PAL.amber, 0.25 + 0.65 * inc); ctx.lineWidth = 3 + 3 * inc; rr(ctx, x - 2, y - 2, w + 4, h + 4, w * 0.16); ctx.stroke(); }
  // struck: warm glow and the shimmering sustain (beating ripples running along the bar)
  if (flash > 0.01 || ring > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; rr(ctx, x, y, w, h, w * 0.14); ctx.clip();
    const col = st.ens ? '110,220,190' : '255,170,70';
    const gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, h * 0.7);
    gl.addColorStop(0, `rgba(${col},${0.9 * flash + 0.28 * ring})`); gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl; ctx.fillRect(x, y, w, h);
    ctx.lineWidth = 2; const t = st.t || 0;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(255,236,190,${0.55 * ring * (1 - k * 0.22)})`; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const px = x + w * i / 16, py = y + h * (0.28 + 0.22 * k) + Math.sin(t * (9 + k * 2.3) + i * 0.7 + k) * (3 + 3 * ring) * ring; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (st.dim > 0) { ctx.fillStyle = `rgba(18,8,4,${st.dim})`; rr(ctx, x, y, w, h, w * 0.14); ctx.fill(); }
  ctx.restore();
}

// A gong. it: { cx, cy, r }, kind: 'kenong' (pot seen from above, with a rim wall), 'kempul' (hanging, medium) or 'gong' (hanging, big, in a stand).
export function drawGong(ctx, it, kind, st = {}) {
  const { cx, cy, r } = it, flash = st.flash || 0, ring = st.ring || 0, inc = st.inc || 0, sw = st.swing || 0;
  ctx.save();
  if (kind === 'kenong') {
    const ry = r * 0.78;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.62, r * 1.05, r * 0.38, 0, 0, TAU); ctx.fill();
    // cord rails the pot sits on
    ctx.strokeStyle = '#6a3a1a'; ctx.lineWidth = Math.max(4, r * 0.1); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx - r * 1.2, cy + r * 0.45); ctx.lineTo(cx + r * 1.2, cy + r * 0.45); ctx.stroke();
    // pot wall
    const wg = ctx.createLinearGradient(cx - r, 0, cx + r, 0); wg.addColorStop(0, '#4a2c0a'); wg.addColorStop(0.3, '#c99a44'); wg.addColorStop(0.55, '#8d6424'); wg.addColorStop(1, '#3a2208');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.22, r, ry, 0, 0, Math.PI); ctx.lineTo(cx - r, cy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r * 0.02); ctx.lineTo(cx - r, cy + r * 0.22); ctx.ellipse(cx, cy + r * 0.22, r, ry * 0.7, 0, Math.PI, 0, true); ctx.lineTo(cx + r, cy - r * 0.02); ctx.fill();
    // face
    const fg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r);
    fg.addColorStop(0, '#fbe7a6'); fg.addColorStop(0.6, '#c99a44'); fg.addColorStop(1, '#7a5214');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(cx, cy, r, ry * 0.7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,190,0.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.97, ry * 0.68, 0, Math.PI, TAU); ctx.stroke();
    const bg = ctx.createRadialGradient(cx - r * 0.08, cy - r * 0.1, 1, cx, cy, r * 0.36); bg.addColorStop(0, '#fff3c4'); bg.addColorStop(0.5, '#d8a84a'); bg.addColorStop(1, '#6a4410');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.36, r * 0.27, 0, 0, TAU); ctx.fill();
  } else {
    // hanging gong: carved stand, cords, the disc with a boss
    const big = kind === 'gong';
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 1.28, r * 0.95, r * 0.2, 0, 0, TAU); ctx.fill();
    const postH = r * (big ? 1.5 : 1.4), px = r * 1.12;
    ctx.fillStyle = '#4b2412'; ctx.fillRect(cx - px - 7, cy - postH * 0.98, 14, postH * 2.2 * 0.62); ctx.fillRect(cx + px - 7, cy - postH * 0.98, 14, postH * 2.2 * 0.62);
    ctx.fillStyle = '#6a3418'; ctx.fillRect(cx - px - 12, cy - postH * 1.02, px * 2 + 24, 14);
    ctx.fillStyle = 'rgba(242,207,124,0.55)'; ctx.fillRect(cx - px - 12, cy - postH * 1.02 + 5, px * 2 + 24, 2.5);
    ctx.save(); ctx.translate(cx, cy - postH * 1.0); ctx.rotate(sw * 0.05); ctx.translate(-cx, -(cy - postH * 1.0));
    ctx.strokeStyle = '#c9b27c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy - postH * 1.0 + 12); ctx.lineTo(cx - r * 0.2, cy - r * 0.92); ctx.moveTo(cx + r * 0.5, cy - postH * 1.0 + 12); ctx.lineTo(cx + r * 0.2, cy - r * 0.92); ctx.stroke();
    const dg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    dg.addColorStop(0, '#fff0b8'); dg.addColorStop(0.5, '#cf9d42'); dg.addColorStop(1, '#6a4410');
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,190,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r * 0.97, Math.PI * 0.95, Math.PI * 1.85); ctx.stroke();
    ctx.strokeStyle = 'rgba(70,40,6,0.4)'; ctx.lineWidth = 2; for (const f of [0.5, 0.7]) { ctx.beginPath(); ctx.arc(cx, cy, r * f, 0, TAU); ctx.stroke(); }
    const bg = ctx.createRadialGradient(cx - r * 0.1, cy - r * 0.12, 1, cx, cy, r * 0.3); bg.addColorStop(0, '#fff3c4'); bg.addColorStop(0.5, '#d8a84a'); bg.addColorStop(1, '#6a4410');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.27, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (inc > 0) { ctx.strokeStyle = rgba(PAL.amber, 0.25 + 0.65 * inc); ctx.lineWidth = 4 + 3 * inc; ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.08, (kind === 'kenong' ? r * 0.78 * 0.7 : r) * 1.08, 0, 0, TAU); ctx.stroke(); }
  if (flash > 0.01 || ring > 0.02) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const col = st.ens ? '110,220,190' : '255,170,70', gl = ctx.createRadialGradient(cx, cy, 2, cx, cy, r * 1.5);
    gl.addColorStop(0, `rgba(${col},${0.85 * flash + 0.22 * ring})`); gl.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, TAU); ctx.fill();
    for (let k = 0; k < 3; k++) { const q = clamp01((st.age ?? 9) / 1.4 - k * 0.2); if (q > 0 && q < 1) { ctx.strokeStyle = `rgba(255,226,170,${0.5 * (1 - q)})`; ctx.lineWidth = 3 * (1 - q) + 0.5; ctx.beginPath(); ctx.arc(cx, cy, r * (0.9 + 0.9 * q), 0, TAU); ctx.stroke(); } }
    ctx.restore();
  }
  if (st.dim > 0) { ctx.fillStyle = `rgba(18,8,4,${st.dim})`; ctx.beginPath(); ctx.arc(cx, cy, r * 1.05, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- the mallets (tabuh) -------------------------------------------------------------------------------------------------------------------------
// A round-headed mallet whose head is at (x, y). lift 0 = resting on the bar, 1 = fully raised. dir: -1 left hand, +1 right hand.
export function drawMallet(ctx, x, y, size, lift, dir, glow = 0) {
  const ang = -0.9 * dir - lift * 0.2 * dir, len = size * 3.4, hx = x - Math.sin(ang) * 0, hy = y - lift * size * 1.6;
  const ex = hx + Math.cos(ang - Math.PI / 2) * -len * 0.0 + dir * len * 0.52, ey = hy + len * 0.9;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(x + 6, y + size * 0.9 + 6, size * 0.9, size * 0.4, 0, 0, TAU); ctx.fill();
  const nx = -(ey - hy), ny = ex - hx, l = Math.hypot(nx, ny) || 1, ux = nx / l, uy = ny / l;
  const g = ctx.createLinearGradient(hx + ux * size * 0.2, hy + uy * size * 0.2, hx - ux * size * 0.2, hy - uy * size * 0.2);
  g.addColorStop(0, '#e8bd82'); g.addColorStop(0.5, '#b97c3e'); g.addColorStop(1, '#5e3416');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(hx + ux * size * 0.17, hy + uy * size * 0.17); ctx.lineTo(ex + ux * size * 0.26, ey + uy * size * 0.26); ctx.lineTo(ex - ux * size * 0.26, ey - uy * size * 0.26); ctx.lineTo(hx - ux * size * 0.17, hy - uy * size * 0.17); ctx.closePath(); ctx.fill();
  const hg = ctx.createRadialGradient(hx - size * 0.3, hy - size * 0.3, 1, hx, hy, size);
  hg.addColorStop(0, '#f6e2bc'); hg.addColorStop(0.6, '#c99a64'); hg.addColorStop(1, '#6f4524');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(hx, hy, size * 0.78, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,14,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  if (glow > 0) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(hx, hy, 1, hx, hy, size * 2.4); gl.addColorStop(0, `rgba(255,200,120,${0.6 * glow})`); gl.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(hx, hy, size * 2.4, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// ---- notes ---------------------------------------------------------------------------------------------------------------------------------------------
// A falling note. shape 'bar' = a little rounded bar with the numeral; 'gong' = a disc with a boss. soft = smaller and paler; ghost = the teacher's pale call.
export function drawNote(ctx, x, y, r, shape, label = null, soft = false, alpha = 1, ghost = false) {
  const k = soft ? 0.78 : 1, R = r * k;
  ctx.save(); ctx.globalAlpha = alpha;
  if (shape === 'bar') {
    const w = R * 1.55, h = R * 2.1, bx = x - w / 2, by = y - h / 2;
    const g = ctx.createLinearGradient(bx, 0, bx + w, 0);
    if (ghost) { g.addColorStop(0, 'rgba(255,200,120,0.28)'); g.addColorStop(0.5, 'rgba(255,230,170,0.5)'); g.addColorStop(1, 'rgba(255,200,120,0.28)'); }
    else { g.addColorStop(0, soft ? '#a8782e' : '#a06a1e'); g.addColorStop(0.35, soft ? '#fbe6a8' : '#ffdf8c'); g.addColorStop(0.7, soft ? '#cf9c46' : '#d18e2a'); g.addColorStop(1, '#6a4410'); }
    ctx.fillStyle = g; rr(ctx, bx, by, w, h, w * 0.3); ctx.fill();
    ctx.lineWidth = Math.max(2, R * 0.12); ctx.strokeStyle = ghost ? 'rgba(255,240,210,0.55)' : '#fff4d4'; rr(ctx, bx, by, w, h, w * 0.3); ctx.stroke();
  } else {
    const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R);
    if (ghost) { g.addColorStop(0, 'rgba(180,255,235,0.5)'); g.addColorStop(1, 'rgba(60,200,170,0.3)'); }
    else { g.addColorStop(0, soft ? '#c8fff0' : '#d8fff4'); g.addColorStop(0.5, soft ? '#59d4b6' : '#2fbf9f'); g.addColorStop(1, '#126a58'); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R * 1.05, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(2, R * 0.13); ctx.strokeStyle = ghost ? 'rgba(235,255,250,0.55)' : '#effffb'; ctx.stroke();
    ctx.fillStyle = ghost ? 'rgba(10,80,66,0.3)' : 'rgba(10,80,66,0.55)'; ctx.beginPath(); ctx.arc(x, y, R * 0.3, 0, TAU); ctx.stroke(); ctx.fill();
  }
  if (label !== null && label !== undefined && !ghost && R > 13) {
    ctx.font = `800 ${Math.round(R * (shape === 'bar' ? 0.9 : 0.7))}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = shape === 'bar' ? '#4a2c06' : '#06382d'; ctx.fillText(String(label), x, y + R * 0.04);
  }
  ctx.restore();
}

// The judgement word that floats up from an instrument.
export function drawPopup(ctx, p) {
  const k = clamp01(p.age / 0.8), a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, up = ease(Math.min(1, k * 1.6)) * 46;
  ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const sz = p.size * (1 + 0.25 * (1 - Math.min(1, p.age / 0.12)));
  ctx.font = `800 ${sz}px ${DISPLAY}`; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, sz * 0.2); ctx.strokeStyle = 'rgba(18,6,4,0.92)';
  ctx.strokeText(p.text, p.x, p.y - up); ctx.fillStyle = p.col; ctx.fillText(p.text, p.x, p.y - up);
  ctx.restore();
}

// ---- particles (gold sparks that drift up like lamp-lit dust) -------------------------------------------------------------------------------------
export function drawParticles(ctx, list) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = p.life / p.max, a = Math.max(0, k), r = p.size * (0.4 + 0.6 * k);
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
    p.vy += (p.g ?? 160) * dt; p.vx *= 1 - 1.6 * dt; p.vy *= 1 - 0.8 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
export function burst(list, rng, x, y, n, ens = false, power = 1) {
  const c = ens ? '120,235,205' : '255,190,90';
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI, 0), sp = rng.range(70, 300) * power;
    list.push({ x: x + rng.range(-12, 12), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: rng.range(0.45, 1.0), max: 1.0, size: rng.range(2.5, 6), c: rng.chance(0.25) ? '255,244,214' : c });
  }
  while (list.length > 320) list.shift();
}

// A lane: a trapezoid track that narrows towards the top (depth), with beat lines drawn by the caller.
export function drawLane(ctx, x, top, bottom, wTop, wBot, hot = 0, dim = false) {
  ctx.save();
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, dim ? 'rgba(255,230,190,0.04)' : 'rgba(255,230,190,0.12)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(x - wTop / 2, top); ctx.lineTo(x + wTop / 2, top); ctx.lineTo(x + wBot / 2, bottom); ctx.lineTo(x - wBot / 2, bottom); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = dim ? 'rgba(255,225,170,0.07)' : `rgba(255,225,170,${0.2 + 0.25 * hot})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - wTop / 2, top); ctx.lineTo(x - wBot / 2, bottom); ctx.moveTo(x + wTop / 2, top); ctx.lineTo(x + wBot / 2, bottom); ctx.stroke();
  if (hot > 0) { ctx.globalCompositeOperation = 'lighter'; const hg = ctx.createLinearGradient(0, bottom - 130, 0, bottom); hg.addColorStop(0, 'rgba(255,170,90,0)'); hg.addColorStop(1, `rgba(255,170,90,${0.3 * hot})`); ctx.fillStyle = hg; ctx.fillRect(x - wBot / 2, bottom - 130, wBot, 130); }
  ctx.restore();
}

// Stars (for results and piece cards): n of 3 filled.
export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.15) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * gap * 1.2;
    ctx.save(); ctx.translate(x, cy);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? size * 0.22 : size * 0.5; k ? ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q) : ctx.moveTo(Math.cos(a) * q, Math.sin(a) * q); }
    ctx.closePath();
    if (i < n) { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, '#fff2b0'); g.addColorStop(1, '#e0a62e'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#7a5410'; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,240,210,0.3)'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.restore();
  }
}

// ---- the cycle ring ----------------------------------------------------------------------------------------------------------------------------------
// The whole cycle as a circle: 12 o'clock is the gong, a hand sweeps once per cycle. `pos` is the cycle position 0..1 (null = at rest).
// Marks: kethuk tick, kenong teal dot, kempul violet dot, gong big gold dot. hits: ids of marks lit (flash) 0..1 by beat index.
export function drawCycleRing(ctx, x, y, r, cyc, pos, flashes = {}, t = 0) {
  ctx.save();
  const bg = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.3); bg.addColorStop(0, 'rgba(28,10,8,0.9)'); bg.addColorStop(1, 'rgba(28,10,8,0.5)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(242,207,124,0.5)'; ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.stroke();
  // progress arc
  if (pos !== null) { ctx.lineWidth = r * 0.12; ctx.strokeStyle = 'rgba(255,179,71,0.35)'; ctx.beginPath(); ctx.arc(x, y, r * 0.78, -Math.PI / 2, -Math.PI / 2 + TAU * pos); ctx.stroke(); }
  const pt = (beat, rad) => { const a = -Math.PI / 2 + TAU * beat / cyc.beats; return [x + Math.cos(a) * r * rad, y + Math.sin(a) * r * rad]; };
  for (let b = 1; b <= cyc.beats; b++) {
    const [tx, ty] = pt(b, 1.0), [ix, iy] = pt(b, 0.9);
    ctx.strokeStyle = 'rgba(255,230,190,0.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(ix, iy); ctx.lineTo(tx, ty); ctx.stroke();
  }
  const mark = (list, rad, size, col, key) => {
    for (const b of list) { const [mx, my] = pt(b, rad), f = flashes[key + b] || 0; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, size * (1 + 0.6 * f), 0, TAU); ctx.fill(); if (f > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,236,190,${0.6 * f})`; ctx.beginPath(); ctx.arc(mx, my, size * 2.2, 0, TAU); ctx.fill(); ctx.restore(); } }
  };
  mark(cyc.kethuk, 0.62, r * 0.045, '#c8a878', 'k');
  mark(cyc.kempul, 0.5, r * 0.075, '#b99cff', 'p');
  mark(cyc.kenong, 0.38, r * 0.085, '#59d4b6', 'n');
  mark(cyc.gong, 0.0, 0, '#f2cf7c', 'g');
  // the gong in the middle of the ring, lit when it sounds
  const gf = flashes.g || 0;
  const gg = ctx.createRadialGradient(x - r * 0.07, y - r * 0.08, 1, x, y, r * 0.24); gg.addColorStop(0, '#fff3c4'); gg.addColorStop(0.5, '#d8a84a'); gg.addColorStop(1, '#7a5214');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r * 0.2 * (1 + 0.25 * gf), 0, TAU); ctx.fill();
  const [gx, gy] = pt(cyc.gong[0], 1.0);
  ctx.fillStyle = '#f2cf7c'; ctx.beginPath(); ctx.arc(gx, gy, r * 0.1 * (1 + 0.5 * gf), 0, TAU); ctx.fill();
  // the hand
  if (pos !== null) {
    const a = -Math.PI / 2 + TAU * pos, hx = x + Math.cos(a) * r * 0.96, hy = y + Math.sin(a) * r * 0.96;
    ctx.strokeStyle = PAL.amber; ctx.lineWidth = Math.max(2.5, r * 0.06); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22); ctx.lineTo(hx, hy); ctx.stroke();
    ctx.fillStyle = '#fff0c0'; ctx.beginPath(); ctx.arc(hx, hy, r * 0.07, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the small ensemble icons (shown on the HUD; they flash when the ensemble plays them) -----------------------------------------------------
export function drawEnsIcon(ctx, key, x, y, r, st = {}) {
  const f = st.flash || 0, dim = st.dim || 0;
  ctx.save();
  if (key === 'kethuk') { drawGong(ctx, { cx: x, cy: y + r * 0.1, r: r * 0.62 }, 'kenong', { flash: f, ring: st.ring || 0, ens: true, dim }); }
  else if (key === 'kenong') { drawGong(ctx, { cx: x, cy: y + r * 0.1, r: r * 0.8 }, 'kenong', { flash: f, ring: st.ring || 0, ens: true, dim }); }
  else if (key === 'kempul' || key === 'gong') {
    const rad = key === 'gong' ? r * 0.72 : r * 0.55;
    const dg = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 1, x, y, rad); dg.addColorStop(0, '#fff0b8'); dg.addColorStop(0.5, '#cf9d42'); dg.addColorStop(1, '#6a4410');
    ctx.strokeStyle = '#c9b27c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r * 0.95); ctx.lineTo(x, y - rad); ctx.stroke();
    ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7a5214'; ctx.beginPath(); ctx.arc(x, y, rad * 0.28, 0, TAU); ctx.fill();
    if (f > 0.01) { ctx.globalCompositeOperation = 'lighter'; const gl = ctx.createRadialGradient(x, y, 1, x, y, rad * 1.8); gl.addColorStop(0, `rgba(110,235,205,${0.7 * f})`); gl.addColorStop(1, 'rgba(110,235,205,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, rad * 1.8, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    if (dim > 0) { ctx.fillStyle = `rgba(18,8,4,${dim})`; ctx.beginPath(); ctx.arc(x, y, rad * 1.05, 0, TAU); ctx.fill(); }
  } else {   // slenthem / peking: a small strip of bars
    const lo = key === 'slenthem', n = 5, bw = r * (lo ? 0.34 : 0.24), bh = r * (lo ? 1.1 : 0.8);
    for (let i = 0; i < n; i++) drawBar(ctx, { cx: x + (i - (n - 1) / 2) * (bw + 3), cy: y, w: bw, h: bh * (1 - i * (lo ? 0.04 : 0.1)) }, { flash: i === (st.hot ?? -1) ? f : 0, ring: i === (st.hot ?? -1) ? (st.ring || 0) : 0, ens: true, dim });
  }
  ctx.restore();
}
