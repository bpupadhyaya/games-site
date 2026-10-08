// The action screens (song, dive, haul, open shells), the status strip, the necklace screen and the pearl / shell art. Pure 2D drawing over the 3D picture.
// Rectangles come from layout.js so hit-testing in game.js and drawing here never disagree.
import { W, H, HUD, LY, TEXT_SCALES, inRect } from './layout.js';
import { FONT, DISPLAY, NUM, C, roundPath, paintButton, drawButton, panel, textShadow, wrapLines } from './ui.js';
import * as K from './consts.js';
import * as sim from './sim.js';

const { DIVE, COLOURS } = K;
const TAU = Math.PI * 2;
const clamp = sim.clamp;
const R = (x, y, w, h) => ({ x, y, w, h });
export const TIPS = { off: false };
const PAN = 'rgba(4,32,40,0.80)', PAN_EDGE = 'rgba(140,235,226,0.38)';

// ---- pearls and shells ----------------------------------------------------------------------------------------------------------------------------------------------------
const hash = (n) => { let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export function drawPearl(ctx, x, y, r, p, t = 0) {
  const col = COLOURS[p.col], lust = p.lust, base = col.rgb, tint = col.tint;
  ctx.save(); ctx.translate(x, y);
  // body shape
  let sx = 1, sy = 1;
  if (p.shape === 2) { sx = 1; sy = 0.94; } else if (p.shape === 1) { sx = 1.06; sy = 0.78; }
  ctx.beginPath();
  if (p.shape === 0) {
    const n = 9, rr = (i) => 0.78 + 0.34 * hash(p.id * 13 + i);
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, q = rr(i % n); const px = Math.cos(a) * r * q * 1.05, py = Math.sin(a) * r * q * 0.9; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  } else ctx.ellipse(0, 0, r * sx, r * sy, 0, 0, TAU);
  const g = ctx.createRadialGradient(-r * 0.32, -r * 0.38, r * 0.05, 0, 0, r * 1.1);
  g.addColorStop(0, `rgb(${Math.min(255, base[0] + 6)},${Math.min(255, base[1] + 6)},${Math.min(255, base[2] + 6)})`);
  g.addColorStop(0.55, `rgb(${Math.round((base[0] * 2 + tint[0]) / 3)},${Math.round((base[1] * 2 + tint[1]) / 3)},${Math.round((base[2] * 2 + tint[2]) / 3)})`);
  g.addColorStop(1, `rgb(${Math.round(tint[0] * 0.78)},${Math.round(tint[1] * 0.78)},${Math.round(tint[2] * 0.78)})`);
  ctx.fillStyle = g; ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = r * 0.35; ctx.shadowOffsetY = r * 0.18; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.clip();
  // orient: a faint rainbow sheen on the rim (stronger with luster)
  const sheen = ctx.createLinearGradient(-r, r, r, -r);
  sheen.addColorStop(0, `rgba(255,150,190,${0.05 + 0.07 * lust})`); sheen.addColorStop(0.5, 'rgba(255,255,255,0)'); sheen.addColorStop(1, `rgba(120,220,255,${0.05 + 0.08 * lust})`);
  ctx.fillStyle = sheen; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  const rim = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.05); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, `rgba(40,30,50,${0.22 - 0.04 * lust})`);
  ctx.fillStyle = rim; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  // the window highlight: bigger and crisper with luster
  const hl = ctx.createRadialGradient(-r * 0.36, -r * 0.42, 0, -r * 0.36, -r * 0.42, r * (0.3 + 0.05 * (3 - lust)));
  hl.addColorStop(0, `rgba(255,255,255,${0.55 + 0.15 * lust})`); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  if (lust >= 2) { ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.1 * lust})`; ctx.beginPath(); ctx.ellipse(-r * 0.4, -r * 0.46, r * 0.11, r * 0.07, -0.6, 0, TAU); ctx.fill(); }
  if (p.shape === 0) { ctx.strokeStyle = 'rgba(80,60,60,0.18)'; ctx.lineWidth = Math.max(1, r * 0.05); ctx.beginPath(); ctx.arc(r * 0.2, r * 0.1, r * 0.55, 0.4, 2.4); ctx.stroke(); }
  ctx.restore();
  if (lust === 3) { // a little twinkle
    const k = 0.5 + 0.5 * Math.sin(t * 3 + p.id), s = r * 0.5 * k;
    ctx.save(); ctx.translate(x - r * 0.4, y - r * 0.45); ctx.globalAlpha = 0.5 + 0.4 * k; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.18, -s * 0.18); ctx.lineTo(s, 0); ctx.lineTo(s * 0.18, s * 0.18); ctx.lineTo(0, s); ctx.lineTo(-s * 0.18, s * 0.18); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.18, -s * 0.18); ctx.closePath(); ctx.fill(); ctx.restore();
  }
}
// an oyster: lower valve, nacre inside, the lid hinged at the back. open: 0 closed .. 1 open. pearl (optional) rests in the nacre.
export function drawShell(ctx, x, y, w, open, old, pearl, t = 0) {
  const h = w * 0.62;
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, h * 0.62, w * 0.55, h * 0.16, 0, 0, TAU); ctx.fill();
  const outer = old ? ['#cdb994', '#8d7a56', '#5b4c33'] : ['#7c6a52', '#4b3e30', '#2a2119'];
  // lower valve
  const lv = ctx.createRadialGradient(-w * 0.1, -h * 0.1, w * 0.05, 0, 0, w * 0.6);
  lv.addColorStop(0, outer[0]); lv.addColorStop(0.7, outer[1]); lv.addColorStop(1, outer[2]);
  ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * 0.5, h * 0.5, 0, 0, TAU); ctx.fillStyle = lv; ctx.fill();
  if (open > 0.02) {
    const ng = ctx.createRadialGradient(-w * 0.1, h * 0.05, 2, 0, h * 0.18, w * 0.46);
    ng.addColorStop(0, '#fbf2f7'); ng.addColorStop(0.45, '#d8e7ea'); ng.addColorStop(0.8, '#c4b6d0'); ng.addColorStop(1, '#8ea0a8');
    ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * 0.43, h * 0.41, 0, 0, TAU); ctx.fillStyle = ng; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * 0.36, h * 0.33, 0, 3.6, 5.9); ctx.stroke();
    if (pearl) drawPearl(ctx, 0, h * 0.14, Math.max(8, 4 + pearl.mm * w * 0.011), pearl, t);
  }
  // ridges on the valve rim
  ctx.strokeStyle = old ? 'rgba(90,70,40,0.35)' : 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(0, h * 0.18, w * (0.5 - i * 0.07), h * (0.5 - i * 0.07), 0, 0.2, 2.9); ctx.stroke(); }
  // lid
  const lift = open * h * 0.8, tilt = open * 0.55;
  ctx.save(); ctx.translate(0, -h * 0.3 - lift * 0.55); ctx.scale(1, 1 - tilt * 0.55);
  const lg = ctx.createRadialGradient(-w * 0.12, -h * 0.12, w * 0.04, 0, 0, w * 0.6);
  lg.addColorStop(0, outer[0]); lg.addColorStop(0.65, outer[1]); lg.addColorStop(1, outer[2]);
  ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * 0.5, h * 0.5, 0, 0, TAU); ctx.fillStyle = lg; ctx.fill();
  ctx.strokeStyle = old ? 'rgba(90,70,40,0.4)' : 'rgba(0,0,0,0.32)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(0, h * 0.48, w * (0.5 - i * 0.08), h * (0.5 - i * 0.08), 0, 3.4, 6.0); ctx.stroke(); }
  if (old) { ctx.fillStyle = 'rgba(230,220,200,0.55)'; for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc((hash(i) - 0.5) * w * 0.7, h * 0.48 + (hash(i + 9) - 0.5) * h * 0.6, 2 + hash(i + 4) * 3, 0, TAU); ctx.fill(); } }
  ctx.restore();
  ctx.restore();
}

// ---- small drawing helpers --------------------------------------------------------------------------------------------------------------------------------------------------
const fit = (ctx, text, maxW, px, weight = 700, family = FONT) => { ctx.font = `${weight} ${px}px ${family}`; while (ctx.measureText(text).width > maxW && px > 11) { px -= 1; ctx.font = `${weight} ${px}px ${family}`; } return px; };
function bar(ctx, x, y, w, h, frac, c1, c2, label, fs) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  const fw = Math.max(h, w * clamp(frac, 0, 1));
  const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, c1); g.addColorStop(1, c2);
  roundPath(ctx, x, y, fw, h, h / 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.25)'; roundPath(ctx, x, y, w, h, h / 2); ctx.stroke();
  if (label) { ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3; ctx.fillText(label, x + 10, y + h / 2 + 1); ctx.shadowBlur = 0; }
}
function ring(ctx, cx, cy, r, w, frac, color, track = 'rgba(0,0,0,0.4)') {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = w;
  ctx.strokeStyle = track; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  if (frac > 0.002) { ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(frac, 0, 1)); ctx.stroke(); }
  ctx.restore();
}
function glyph(ctx, kind, cx, cy, s, color) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (kind === 'pause') { ctx.fillRect(-s * 0.32, -s * 0.34, s * 0.2, s * 0.68); ctx.fillRect(s * 0.12, -s * 0.34, s * 0.2, s * 0.68); }
  else if (kind === 'bulb') { ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.3, 0.9 * Math.PI, 2.1 * Math.PI + 0.0); ctx.arc(0, -s * 0.1, s * 0.3, 0, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -s * 0.1, s * 0.3, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.14, s * 0.3); ctx.lineTo(s * 0.14, s * 0.3); ctx.moveTo(-s * 0.1, s * 0.42); ctx.lineTo(s * 0.1, s * 0.42); ctx.stroke(); }
  else if (kind === 'rope') { ctx.beginPath(); ctx.moveTo(0, -s * 0.4); ctx.bezierCurveTo(s * 0.3, -s * 0.2, -s * 0.3, s * 0.1, 0, s * 0.4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.25); ctx.lineTo(0, -s * 0.45); ctx.lineTo(s * 0.2, -s * 0.25); ctx.stroke(); }
  ctx.restore();
}
export function squareButton(ctx, r, kind, o = {}) {
  const { dy } = paintButton(ctx, r, { dark: true, ...o });
  glyph(ctx, kind, r.x + r.w / 2, r.y + r.h / 2 + dy, Math.min(r.w, r.h) * 0.62, '#e8fffb');
}
function circleButton(ctx, c, label, o = {}) {
  const { disabled = false, primary = true, sub = null, pressed = false } = o;
  ctx.save();
  const dy = pressed ? 3 : 0;
  ctx.beginPath(); ctx.arc(c.cx, c.cy + (pressed ? 1 : 5), c.r, 0, TAU); ctx.fillStyle = disabled ? '#1c2a2e' : primary ? '#04474f' : '#6e4208'; ctx.fill();
  ctx.beginPath(); ctx.arc(c.cx, c.cy + dy, c.r, 0, TAU);
  const g = ctx.createRadialGradient(c.cx - c.r * 0.3, c.cy - c.r * 0.35 + dy, c.r * 0.1, c.cx, c.cy + dy, c.r);
  if (disabled) { g.addColorStop(0, '#53656a'); g.addColorStop(1, '#3a4a4e'); } else if (primary) { g.addColorStop(0, '#22c3cf'); g.addColorStop(1, '#0a8794'); } else { g.addColorStop(0, '#f6b94c'); g.addColorStop(1, '#c27a14'); }
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = disabled ? 'rgba(255,255,255,0.15)' : primary ? '#a6fff6' : '#ffe2a0'; ctx.stroke();
  ctx.fillStyle = disabled ? 'rgba(255,255,255,0.4)' : '#fffdf2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const px = fit(ctx, label, c.r * 1.55, Math.round(c.r * 0.36), 800, FONT);
  ctx.fillText(label, c.cx, c.cy + dy - (sub ? px * 0.35 : 0));
  if (sub) { ctx.font = `600 ${Math.round(px * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(sub, c.cx, c.cy + dy + px * 0.62); }
  ctx.restore();
}
export const isDown = (state, c) => state.ptr && state.ptr.down && Math.hypot(state.ptr.x - c.cx, state.ptr.y - c.cy) <= c.r + 6;
function hint(ctx, text, x, y, w, fs, color = '#fff6dc') {
  if (TIPS.off && /^(Hold|Let go|Tap|Pull|Swimming|Down|Hauling|Salim is working)/.test(text)) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; fit(ctx, text, w, fs, 700, FONT);
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2; ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.restore();
}

// ---- the status strip --------------------------------------------------------------------------------------------------------------------------------------------------------------
export function drawStrip(ctx, state) {
  const S = state.S, st = HUD.strip, fn = HUD.fonts.name;
  panel(ctx, st.x, st.y, st.w, st.h, { r: 24, fill: PAN, stroke: PAN_EDGE, lw: 2, shadow: true });
  const I = HUD.info, wind = sim.windOf(S);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const where = S.phase === 'trade' || S.phase === 'budget' || S.phase === 'prov' ? 'Muharraq harbour' : S.phase === 'intro' ? 'Muharraq, 1924' : `Day ${S.day + 1}  ·  ${wind.name}`;
  const t1 = `Trip ${Math.min(S.trip + 1, K.TRIPS)} of ${K.TRIPS}  ·  ${where}`;
  const px = fit(ctx, t1, I.w, fn, 700, FONT); ctx.fillStyle = '#fff3d6'; ctx.fillText(t1, I.x, st.y + st.h * 0.3);
  const y2 = st.y + st.h * 0.7, bh = Math.max(20, Math.round(fn * 0.95)), gap = 10;
  const money = `Rs ${Math.round(S.cash)}`, moneyW = Math.max(100, Math.min(190, I.w * 0.28));
  const bw = Math.floor((I.w - moneyW - gap * 2) / 2);
  bar(ctx, I.x, y2 - bh / 2, bw, bh, S.stam / 100, S.stam < 30 ? '#c8452e' : '#d9a21e', S.stam < 30 ? '#ef7a55' : '#7bd15c', 'Stamina', Math.round(bh * 0.6));
  bar(ctx, I.x + bw + gap, y2 - bh / 2, bw, bh, S.spirit / 100, '#1496a8', '#79eadb', 'Spirit', Math.round(bh * 0.6));
  ctx.font = `800 ${Math.round(fn * 0.95)}px ${FONT}`; ctx.fillStyle = '#ffe49a'; ctx.textAlign = 'right'; ctx.fillText(money, I.x + I.w, y2); void px;
  squareButton(ctx, HUD.think, 'bulb'); squareButton(ctx, HUD.menu, 'pause');
}

// ---- rectangles of the dive screen -----------------------------------------------------------------------------------------------------------------------------------------------
export function diveRects() {
  const c = HUD.ctl, V = HUD.view, land = LY.land;
  const out = { chart: null, gauge: null, pick: null, signal: null, breathe: null, hintY: 0 };
  const chartH = land ? 120 : 116;
  if (!land) {
    out.chart = R(c.x, c.y, c.w, chartH); out.gauge = R(c.x + 20, c.y + 16, c.w - 40, 52);
    const rowY = c.y + chartH + 10, rowH = c.y + c.h - rowY;
    const r = Math.min(rowH / 2 - 2, 96), cy = rowY + rowH / 2;
    out.pick = { cx: c.x + r * 1.5 + 10, cy, r }; out.breathe = { cx: c.x + c.w / 2, cy, r: Math.min(rowH / 2 - 2, 104) };
    const sx = out.pick.cx + r + 22; out.signal = R(sx, cy - Math.min(rowH, 112) / 2, c.x + c.w - sx - 6, Math.min(rowH, 112));
    out.hintY = V.y + V.h - 26;
  } else {
    // landscape: the seabed chart runs along the bottom of the picture, the buttons stand in the column on the right
    out.chart = R(V.x + 10, V.y + V.h - chartH - 8, V.w - 20, chartH); out.gauge = R(V.x + 30, V.y + V.h - 72, Math.min(V.w - 60, 760), 52);
    const sgH = Math.max(76, Math.min(110, c.h * 0.22)), sgY = c.y + c.h - sgH;
    out.signal = R(c.x + 10, sgY, c.w - 20, sgH);
    const free = sgY - 14 - c.y, r = Math.min(free / 2 / 1.75, c.w * 0.26, 92), cy = c.y + free / 2 + 4;
    out.pick = { cx: c.x + c.w / 2, cy, r }; out.breathe = { cx: c.x + c.w / 2, cy: c.y + c.h / 2, r: Math.min(c.h * 0.3, c.w * 0.3, 104) };
    out.hintY = out.chart.y - 22;
  }
  return out;
}
export function chartLayout(rect) { const pad = 22, x0 = rect.x + pad, x1 = rect.x + rect.w - pad; return { x0, x1, mx: (x) => x0 + ((x + 9.5) / 19) * (x1 - x0), inv: (px) => ((px - x0) / (x1 - x0)) * 19 - 9.5 }; }
export function bedAt(state, x, y) {
  const D = state.S.D; if (!D || D.phase !== 'bottom') return -1;
  const rc = diveRects().chart, L = chartLayout(rc);
  if (y < rc.y - 10 || y > rc.y + rc.h + 10) return -1;
  let best = -1, bd = 60;
  D.beds.forEach((b, i) => { if (b.left <= 0) return; const d = Math.abs(L.mx(b.x) - x); if (d < bd) { bd = d; best = i; } });
  return best;
}

function drawChart(ctx, state, rc) {
  const S = state.S, D = S.D, L = chartLayout(rc);
  panel(ctx, rc.x, rc.y, rc.w, rc.h, { r: 22, fill: 'rgba(8,52,58,0.86)', stroke: PAN_EDGE, lw: 2 });
  // sand floor
  ctx.save(); roundPath(ctx, rc.x + 3, rc.y + 3, rc.w - 6, rc.h - 6, 20); ctx.clip();
  const g = ctx.createLinearGradient(0, rc.y, 0, rc.y + rc.h); g.addColorStop(0, '#0c5560'); g.addColorStop(0.55, '#176d72'); g.addColorStop(1, '#2c8b86');
  ctx.fillStyle = g; ctx.fillRect(rc.x, rc.y, rc.w, rc.h);
  const fy = rc.y + rc.h * 0.7; ctx.fillStyle = '#d6b985'; ctx.beginPath(); ctx.moveTo(rc.x, rc.y + rc.h);
  for (let x = rc.x; x <= rc.x + rc.w; x += 14) ctx.lineTo(x, fy + Math.sin(x * 0.05) * 3); ctx.lineTo(rc.x + rc.w, rc.y + rc.h); ctx.closePath(); ctx.fill();
  // the rope down from the boat
  const rx = L.mx(0); ctx.strokeStyle = '#e9d9a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(rx, rc.y + 6); ctx.lineTo(rx, fy); ctx.stroke();
  ctx.fillStyle = '#8a8a86'; ctx.beginPath(); ctx.ellipse(rx, fy + 2, 11, 7, 0, 0, TAU); ctx.fill();
  // beds
  const unit = Math.min(30, rc.h * 0.27);
  D.beds.forEach((b, i) => {
    const bx = L.mx(b.x), by = fy - 2, here = D.at === i;
    ctx.save(); ctx.globalAlpha = b.left > 0 ? 1 : 0.28;
    if (b.old && b.left > 0) { const gg = ctx.createRadialGradient(bx, by - unit * 0.4, 2, bx, by - unit * 0.4, unit * 1.2); gg.addColorStop(0, 'rgba(255,230,150,0.55)'); gg.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = gg; ctx.fillRect(bx - unit * 1.3, by - unit * 1.7, unit * 2.6, unit * 2.6); }
    drawShell(ctx, bx, by - unit * 0.5, unit * 1.5, 0, b.old, null);
    ctx.restore();
    ctx.fillStyle = '#fff6dc'; for (let k = 0; k < b.left; k++) { ctx.beginPath(); ctx.arc(bx - (b.left - 1) * 6 + k * 12, by + unit * 0.55 + 0, 3.6, 0, TAU); ctx.fill(); }
    if (state.watch && state.watch.bed === i && b.left > 0) { ctx.strokeStyle = '#fff27a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(bx, by - unit * 0.3, unit * 1.2 + 3 * Math.sin((S.clock || 0) * 6), 0, TAU); ctx.stroke(); }
    if (here && b.left > 0) { ctx.strokeStyle = '#ffe49a'; ctx.lineWidth = 2.5; roundPath(ctx, bx - unit * 0.95, by - unit * 1.25, unit * 1.9, unit * 1.9, 10); ctx.stroke(); }
  });
  // the diver: a small figure that follows D.x
  const dx = L.mx(D.x), dy = fy - unit * 0.1;
  ctx.fillStyle = '#d9a37a'; ctx.beginPath(); ctx.arc(dx, dy - unit * 1.05, unit * 0.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f1efe6'; roundPath(ctx, dx - unit * 0.17, dy - unit * 0.9, unit * 0.34, unit * 0.62, 5); ctx.fill();
  ctx.strokeStyle = '#d9a37a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(dx - unit * 0.1, dy - unit * 0.3); ctx.lineTo(dx - unit * 0.18, dy + unit * 0.05); ctx.moveTo(dx + unit * 0.1, dy - unit * 0.3); ctx.lineTo(dx + unit * 0.2, dy + unit * 0.05); ctx.stroke();
  if (D.tx !== null) { ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(255,240,180,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(dx, rc.y + rc.h * 0.18); ctx.lineTo(L.mx(D.tx), rc.y + rc.h * 0.18); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
}

function breathRing(ctx, state, cx, cy, r) {
  const S = state.S, D = S.D;
  const frac = D.cap > 0 ? clamp(D.breath / D.cap, 0, 1) : 1, safe = D.cap > 0 ? clamp((D.ta + DIVE.clean) / D.cap, 0, 1) : 0, line = D.cap > 0 ? clamp(D.ta / D.cap, 0, 1) : 0;
  const low = D.phase === 'bottom' && D.breath <= D.ta + DIVE.clean + 0.5;
  ctx.save(); ctx.fillStyle = 'rgba(3,28,36,0.72)'; ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, TAU); ctx.fill();
  ring(ctx, cx, cy, r, 16, frac, low ? '#ef7a55' : '#5fe3d2');
  // the safe-return mark and the ascent line
  for (const [f, col, len] of [[safe, '#ffe49a', 14], [line, '#ff9a7a', 10]]) { const a = -Math.PI / 2 + TAU * f; ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - len - 6), cy + Math.sin(a) * (r - len - 6)); ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)); ctx.stroke(); }
  ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(r * 0.62)}px ${NUM}`; ctx.fillText(String(Math.max(0, Math.ceil(D.breath))), cx, cy - r * 0.06);
  ctx.font = `600 ${Math.max(14, Math.round(r * 0.26))}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.8)'; ctx.fillText('breath', cx, cy + r * 0.42);
  ctx.restore();
}

export function renderDive(ctx, state) {
  const S = state.S, D = S.D; if (!D) return;
  drawStrip(ctx, state);
  const rc = diveRects(), V = HUD.view;
  const fs = Math.max(22, LY.minText + 2);
  const r = Math.round(clamp(Math.min(V.w, V.h) * 0.13, 50, 74));
  const cx = V.x + 16 + r + 10, cy = V.y + 16 + r + 10;
  // depth and basket labels next to the ring
  if (D.phase !== 'breath') {
    breathRing(ctx, state, cx, cy, r);
    ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = '#fff6dc'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
    ctx.fillText(`${Math.round(D.y)} m`, cx + r + 22, cy - fs * 0.7); ctx.fillText(`Shells ${D.basket.length}`, cx + r + 22, cy + fs * 0.75); ctx.restore();
  }
  const pk = rc.pick, bw = rc.breathe, sg = rc.signal;
  if (D.phase === 'breath') {
    const gz = rc.gauge, [a, b] = DIVE.zone;
    panel(ctx, gz.x - 6, gz.y - 8, gz.w + 12, gz.h + 16, { r: 20, fill: PAN, stroke: PAN_EDGE, lw: 2 });
    roundPath(ctx, gz.x, gz.y + 8, gz.w, gz.h - 16, 14); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    ctx.fillStyle = 'rgba(70,210,120,0.55)'; ctx.fillRect(gz.x + gz.w * a, gz.y + 8, gz.w * (b - a), gz.h - 16);
    const fillw = gz.w * clamp(D.g, 0, 1.04), g2 = ctx.createLinearGradient(gz.x, 0, gz.x + gz.w, 0); g2.addColorStop(0, '#2fb6c9'); g2.addColorStop(1, '#8af0e4');
    ctx.save(); roundPath(ctx, gz.x, gz.y + 8, gz.w, gz.h - 16, 14); ctx.clip(); ctx.fillStyle = g2; ctx.globalAlpha = 0.9; ctx.fillRect(gz.x, gz.y + 8, fillw, gz.h - 16); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.fillRect(gz.x + fillw - 3, gz.y, 6, gz.h);
    ctx.font = `700 ${Math.round(fs * 0.8)}px ${FONT}`; ctx.fillStyle = '#d6fff2'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('release in the green', gz.x + gz.w * (a + b) / 2, gz.y + gz.h / 2);
    circleButton(ctx, bw, D.began && D.held ? 'IN...' : 'BREATHE', { pressed: D.held, sub: 'hold, then let go' });
    hint(ctx, D.began ? 'Let go while the line is in the green' : 'Hold to breathe in, slowly', V.x + V.w / 2, LY.land ? gz.y - 30 : rc.hintY, V.w - 40, fs);
  } else {
    drawChart(ctx, state, rc.chart);
    const atBed = D.phase === 'bottom' && D.tx === null && D.at >= 0 && D.beds[D.at].left > 0 && !D.pick;
    const p = sim.diveRing(D);
    circleButton(ctx, pk, 'PICK', { disabled: !atBed, pressed: state.ptr && isDown(state, pk) && atBed, sub: atBed ? null : undefined });
    if (atBed) { // the closing ring
      const k = clamp((D.ringT / DIVE.ring) % 1, 0, 1), tgt = DIVE.ringAt, rr = pk.r * (1 + 0.45 * (1 - k)), good = Math.abs(k - tgt) <= DIVE.good, perfect = Math.abs(k - tgt) <= DIVE.perfect;
      ctx.save(); ctx.lineWidth = perfect ? 9 : 6; ctx.strokeStyle = perfect ? '#fff27a' : good ? '#9fffe0' : 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(pk.cx, pk.cy, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,230,140,0.7)'; ctx.beginPath(); ctx.arc(pk.cx, pk.cy, pk.r * (1 + 0.7 * (1 - tgt)), 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (D.pick) { ctx.save(); ctx.strokeStyle = D.pick.q === 'perfect' ? '#fff27a' : D.pick.q === 'good' ? '#9fffe0' : '#ffb59a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(pk.cx, pk.cy, pk.r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(D.pick.t / D.pick.dur, 0, 1)); ctx.stroke(); ctx.restore(); }
    void p;
    const canSig = D.phase === 'bottom';
    const warn = D.warn && canSig;
    const flash = warn && Math.floor(S.clock * 4) % 2 === 0;
    const { dy, light } = paintButton(ctx, sg, { primary: !warn, active: warn && flash, disabled: !canSig });
    ctx.save(); ctx.fillStyle = !canSig ? 'rgba(255,255,255,0.35)' : '#fff7e6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fit(ctx, 'SIGNAL', sg.w - 70, Math.round(HUD.fonts.btn * 1.1), 800, FONT); ctx.fillText('SIGNAL', sg.x + sg.w / 2 + 14, sg.y + dy + sg.h / 2 - 8);
    ctx.font = `600 ${Math.round(HUD.fonts.btn * 0.62)}px ${FONT}`; ctx.globalAlpha = 0.9; ctx.fillText(canSig ? 'tug to be hauled up' : '', sg.x + sg.w / 2 + 14, sg.y + dy + sg.h / 2 + HUD.fonts.btn * 0.62); ctx.restore(); void light;
    glyph(ctx, 'rope', sg.x + 34, sg.y + sg.h / 2 + dy, 42, '#fff7e6');
    let msg = '';
    if (D.phase === 'descend') msg = 'Down the rope on the stone';
    else if (D.phase === 'ascend') msg = D.how === 'auto' ? 'Salim is hauling you up' : D.how === 'clean' ? 'Hauling up, nice and steady' : 'Hauling up';
    else if (D.phase === 'bottom') msg = D.warn ? 'Signal now: your air is getting low' : D.pick ? (D.pick.q === 'perfect' ? 'Perfect' : D.pick.q === 'good' ? 'Good' : 'Rough') : atBed ? 'Tap PICK as the ring meets the mark' : D.tx !== null ? 'Swimming...' : 'Tap a shell bed on the chart';
    hint(ctx, msg, V.x + V.w / 2, rc.hintY, V.w - 40, fs, D.warn && D.phase === 'bottom' ? '#ffd0b8' : '#fff6dc');
  }
}

// ---- the dive result card (flow widgets are built in menus.js) --------------------------------------------------------------------------------------------------------------------

// ---- the song ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function songRects() {
  const V = HUD.view, c = HUD.ctl, land = LY.land;
  const w = Math.min(land ? V.w - 60 : V.w - 40, 660), x = V.x + (V.w - w) / 2;
  const slots = R(x, V.y + Math.round(V.h * (land ? 0.12 : 0.1)), w, 130);
  const r = Math.min(c.h * 0.36, land ? c.w * 0.3 : 100, 104), cy = land ? c.y + c.h * 0.4 : c.y + c.h * 0.46;
  const clap = { cx: c.x + c.w / 2, cy, r };
  const skip = R(c.x + c.w / 2 - Math.min(c.w, 360) / 2, Math.min(c.y + c.h - 78, cy + r + 20), Math.min(c.w, 360), 70);
  return { slots, clap, skip };
}
export function renderSong(ctx, state) {
  const S = state.S, G = S.G; if (!G) return;
  drawStrip(ctx, state);
  const rc = songRects(), fs = Math.max(22, LY.minText + 2), V = HUD.view;
  const R0 = G.rounds[G.round];
  const title = G.step === 'intro' ? 'Khalifa raises his hand' : G.step === 'call' ? 'Khalifa calls: watch the drum' : G.step === 'answer' ? 'Your turn: clap it back' : 'Well sung';
  hint(ctx, title, V.x + V.w / 2, rc.slots.y - 26, V.w - 40, Math.round(fs * 1.15));
  const s = rc.slots;
  panel(ctx, s.x, s.y, s.w, s.h, { r: 26, fill: PAN, stroke: PAN_EDGE, lw: 2 });
  const rad = Math.min(30, (s.w - 40) / 8 / 2 - 4), gx = (i) => s.x + 24 + (i + 0.5) * ((s.w - 48) / 8), cy = s.y + s.h * 0.5;
  // the time cursor
  const prog = G.step === 'call' || G.step === 'answer' ? clamp(G.st / (8 * G.beat), 0, 1) : 0;
  for (let i = 0; i < 8; i++) {
    const note = R0.pat.includes(i), hit = R0.hits.find((h) => R0.pat[h.i] === i);
    ctx.beginPath(); ctx.arc(gx(i), cy, rad, 0, TAU);
    let fill = note ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
    if (G.step === 'call' && note && G.st >= i * G.beat - 0.02 && G.st < i * G.beat + 0.32) fill = '#ffe49a';
    else if (G.step === 'call' && note && G.st >= i * G.beat) fill = 'rgba(255,228,154,0.4)';
    if (hit) fill = hit.q === 'perfect' ? '#fff27a' : '#9fffe0';
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = note && (G.step === 'answer' || G.step === 'gap') && !hit && G.step === 'gap' ? '#ef7a55' : 'rgba(255,255,255,0.4)'; ctx.stroke();
    if (note && G.step !== 'intro') { ctx.fillStyle = hit ? '#07303a' : 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(gx(i), cy, rad * 0.28, 0, TAU); ctx.fill(); }
  }
  if (G.step === 'call' || G.step === 'answer') { const px = s.x + 24 + prog * (s.w - 48); ctx.fillStyle = G.step === 'answer' ? '#7bf0dd' : '#ffe49a'; ctx.fillRect(px - 2, s.y + 14, 4, s.h - 28); }
  ctx.font = `700 ${Math.round(fs * 0.85)}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`Round ${G.round + 1} of ${G.rounds.length}`, s.x + s.w / 2, s.y + s.h - 18);
  const answering = G.step === 'answer';
  circleButton(ctx, rc.clap, answering ? 'CLAP' : 'listen', { disabled: !answering, pressed: state.ptr && isDown(state, rc.clap) && answering });
  drawButton(ctx, rc.skip, 'Skip the song', { dark: true, size: Math.round(HUD.fonts.btn * 0.9) });
  const lastEv = G.ev[G.ev.length - 1];
  if (lastEv && (lastEv.type === 'perfect' || lastEv.type === 'good' || lastEv.type === 'extra') && state.t - (state.songFx || 0) < 0.6) hint(ctx, lastEv.type === 'perfect' ? 'Perfect' : lastEv.type === 'good' ? 'Good' : 'Off the beat', V.x + V.w / 2, s.y + s.h + 36, V.w, fs, lastEv.type === 'extra' ? '#ffb59a' : '#fff27a');
}

// ---- the haul ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function haulRects() {
  const c = HUD.ctl, land = LY.land;
  const r = Math.min(c.h * 0.36, land ? c.w * 0.3 : 112, 120), cy = land ? c.y + c.h * 0.46 : c.y + c.h * 0.5;
  return { pull: { cx: c.x + c.w / 2, cy, r } };
}
export function renderHaul(ctx, state) {
  const S = state.S, H0 = S.H; if (!H0) return;
  drawStrip(ctx, state);
  const V = HUD.view, fs = Math.max(22, LY.minText + 2), rc = haulRects(), pr = rc.pull;
  const waiting = H0.phase === 'wait';
  // the rope progress and Salim's air
  const bw = Math.min(V.w - 48, 560), bx = V.x + (V.w - bw) / 2, by = V.y + 18;
  panel(ctx, bx - 10, by - 6, bw + 20, 64, { r: 20, fill: PAN, stroke: PAN_EDGE, lw: 2 });
  const frac = waiting ? 0 : clamp(H0.prog / H0.need, 0, 1);
  ctx.font = `700 ${Math.round(fs * 0.9)}px ${FONT}`; ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText('Rope in', bx + 6, by + 12);
  bar(ctx, bx + 110, by + 2, bw - 120, 22, frac, '#d9a21e', '#ffe28a', null, 0);
  if (!waiting) { const air = clamp(H0.breath / (H0.ta + H0.margin), 0, 1); ctx.fillStyle = '#fff3d6'; ctx.fillText('Salim\'s air', bx + 6, by + 40); bar(ctx, bx + 110, by + 30, bw - 120, 18, air, air < 0.2 ? '#c8452e' : '#1496a8', air < 0.2 ? '#ef7a55' : '#79eadb', null, 0); }
  const down = state.ptr && isDown(state, pr) && !waiting;
  circleButton(ctx, pr, waiting ? 'wait' : 'HAUL', { disabled: waiting, pressed: down, sub: waiting ? 'listen for the tug' : null });
  if (!waiting && !H0.done) {
    const k = H0.ph, rr = pr.r * (1 + 0.65 * (1 - k)), e = Math.min(k * sim.PULL, (1 - k) * sim.PULL);
    ctx.save(); ctx.lineWidth = e <= 0.1 ? 9 : 6; ctx.strokeStyle = e <= 0.1 ? '#fff27a' : e <= 0.2 ? '#9fffe0' : 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(pr.cx, pr.cy, rr, 0, TAU); ctx.stroke();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,230,140,0.7)'; ctx.beginPath(); ctx.arc(pr.cx, pr.cy, pr.r + 2, 0, TAU); ctx.stroke(); ctx.restore();
  }
  const msg = waiting ? 'Salim is working below. Wait for his tug.' : H0.done ? '' : 'Pull on the beat, hand over hand';
  if (msg) hint(ctx, msg, V.x + V.w / 2, V.y + V.h - 26, V.w - 40, fs);
  const lq = H0.last && state.t - (state.haulFx || 0) < 0.5 ? H0.last : '';
  if (lq) hint(ctx, lq === 'perfect' ? 'Perfect' : lq === 'ok' ? 'Good' : 'Weak', V.x + V.w / 2, V.y + V.h * 0.5, V.w, Math.round(fs * 1.3), lq === 'weak' ? '#ffb59a' : '#fff27a');
}

// ---- opening shells --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function openRects() {
  const c = HUD.ctl, V = HUD.view, land = LY.land;
  const bw = Math.min(c.w - 20, 420), bh = Math.max(84, LY.tap + 8);
  const open = R(c.x + (c.w - bw) / 2, c.y + (land ? 20 : 14), bw, bh);
  const all = R(open.x, open.y + bh + 14, bw, Math.max(66, LY.tap));
  const shellW = Math.min(V.w * 0.7, V.h * 0.62, 380);
  return { open, all, shell: { cx: V.x + V.w / 2, cy: V.y + V.h * 0.5 + 10, w: shellW } };
}
export function renderOpen(ctx, state) {
  const S = state.S, O = S.O; if (!O) return;
  drawStrip(ctx, state);
  const rc = openRects(), V = HUD.view, fs = Math.max(22, LY.minText + 2), sh = rc.shell;
  if (O.state !== 'empty' && O.state !== 'summary') {
    let openK = 0;
    if (O.state === 'cutting') openK = clamp(O.t / (O.fast ? 0.18 : 0.6), 0, 1) * 0.35;
    else if (O.state === 'show') openK = Math.min(1, 0.35 + O.t * 2.2);
    const wob = O.state === 'cutting' ? Math.sin(O.t * 40) * 4 : 0;
    const old = S.shells[O.i] ? S.shells[O.i].old : false;
    const pearl = O.state === 'show' && O.cur ? O.cur.pearl : null;
    if (pearl && openK > 0.8) { // a soft glow behind
      const gg = ctx.createRadialGradient(sh.cx, sh.cy, 10, sh.cx, sh.cy, sh.w * 0.8); gg.addColorStop(0, 'rgba(255,245,200,0.5)'); gg.addColorStop(1, 'rgba(255,245,200,0)'); ctx.fillStyle = gg; ctx.fillRect(sh.cx - sh.w, sh.cy - sh.w, sh.w * 2, sh.w * 2);
    }
    drawShell(ctx, sh.cx + wob, sh.cy, sh.w, openK, old, pearl, S.clock || 0);
    hint(ctx, `Shell ${Math.min(O.i + 1, O.n)} of ${O.n}${old ? '  ·  an old shell' : ''}`, V.x + V.w / 2, V.y + 22, V.w - 40, fs);
    if (O.state === 'show') {
      const txt = pearl ? sim.pearlName(pearl) : 'No pearl in this one';
      const sub = pearl ? `${sim.pearlDetail(pearl)}  ·  about ${pearl.value} rupees` : 'Only the shell. It goes to Rashid\'s pot.';
      hint(ctx, txt, V.x + V.w / 2, sh.cy + sh.w * 0.52 + 26, V.w - 30, Math.round(fs * 1.2), pearl ? '#fff27a' : '#fff6dc');
      hint(ctx, sub, V.x + V.w / 2, sh.cy + sh.w * 0.52 + 26 + fs * 1.5, V.w - 30, Math.round(fs * 0.95), 'rgba(255,243,214,0.92)');
    }
    // the pearls found so far, in a row
    const fnd = O.found.slice(-10), rr = Math.max(11, Math.min(20, (V.w - 40) / 24));
    fnd.forEach((p, i) => drawPearl(ctx, V.x + V.w / 2 - (fnd.length - 1) * rr * 1.2 + i * rr * 2.4, V.y + V.h - 28, rr * (0.6 + p.size * 0.1), p, S.clock || 0));
    drawButton(ctx, rc.open, O.state === 'show' ? (O.i + 1 >= O.n ? 'Finish' : 'Next shell') : O.state === 'cutting' ? 'Cutting...' : 'Open the shell', { primary: true, size: HUD.fonts.btn, disabled: O.state === 'cutting' });
    drawButton(ctx, rc.all, 'Open all', { dark: true, size: Math.round(HUD.fonts.btn * 0.9), disabled: O.fast });
  }
}

// ---- the necklace ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function necklaceLayout(state) {
  const S = state.S, U = LY.U, land = LY.land, hs = TEXT_SCALES[state.settings.textIdx];
  const btnH = Math.max(LY.tap, 70), by = U.y1 - 14 - btnH, gap = 12;
  const bw = Math.min(300, (U.w - 40 - gap * 2) / 3);
  const cx0 = (U.x0 + U.x1) / 2;
  const btns = { arrange: R(cx0 - bw * 1.5 - gap, by, bw, btnH), clear: R(cx0 - bw / 2, by, bw, btnH), done: R(cx0 + bw / 2 + gap, by, bw, btnH) };
  const areaTop = U.y0 + 14 + LY.backSz * 0 + (LY.backSz && !land ? LY.backSz : 0);
  const titleH = Math.round(86 * Math.min(hs, 1.5));
  let nk, tray;
  if (!land) {
    nk = R(U.x0 + 14, areaTop + titleH, U.w - 28, Math.round((by - areaTop - titleH) * 0.46));
    tray = R(U.x0 + 14, nk.y + nk.h + 12, U.w - 28, by - 12 - (nk.y + nk.h + 12));
  } else {
    const lw = Math.round(U.w * 0.56);
    nk = R(U.x0 + 14, areaTop + titleH, lw, by - 12 - (areaTop + titleH));
    tray = R(nk.x + nk.w + 12, areaTop + 6, U.x1 - 14 - (nk.x + nk.w + 12), by - 12 - (areaTop + 6));
  }
  // the string: a U-shaped curve with K.HIDE slots
  const n = K.HIDE, slots = [];
  const w = nk.w - 60, h = Math.min(nk.h - 40, w * 0.62), x0 = nk.x + 30, y0 = nk.y + 20;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), a = Math.PI * (0.06 + 0.88 * u);
    slots.push({ i, x: x0 + w / 2 - Math.cos(a) * (w / 2), y: y0 + Math.sin(a) * h * 0.92 + 0, r: 0 });
  }
  const pearls = sim.necklacePearls(S);
  // tray: a grid of the pearls not on the string
  const items = sim.trayPearls(S), cell = Math.round(clamp(Math.min(tray.w / 5, 92), 60, 96));
  const cols = Math.max(1, Math.floor((tray.w - 16) / cell)), grid = [];
  items.forEach((p, k) => { const cxx = tray.x + 8 + (k % cols) * cell + cell / 2, cyy = tray.y + 52 + Math.floor(k / cols) * cell + cell / 2; grid.push({ p, x: cxx, y: cyy, r: Math.max(12, 8 + p.mm * 1.8) * Math.min(1, cell / 90) }); });
  return { btns, nk, tray, slots, pearls, grid, cell, rows: Math.ceil(items.length / cols), cols, titleH };
}
export function renderNecklace(ctx, state) {
  const S = state.S, L = necklaceLayout(state), U = LY.U, hs = TEXT_SCALES[state.settings.textIdx];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0a2f3a'); g.addColorStop(0.55, '#0e4650'); g.addColorStop(1, '#05222b'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // soft light
  const rg = ctx.createRadialGradient(W * 0.5, H * 0.22, 20, W * 0.5, H * 0.22, Math.max(W, H) * 0.7); rg.addColorStop(0, 'rgba(120,230,220,0.22)'); rg.addColorStop(1, 'rgba(120,230,220,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const sc = sim.necklaceScore(S);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const tfs = Math.round(44 * Math.min(hs, 1.5));
  ctx.font = `700 ${tfs}px ${DISPLAY}`; textShadow(ctx, 'Your necklace', (U.x0 + U.x1) / 2, U.y0 + 14 + (LY.backSz && !LY.land ? LY.backSz : 0) + tfs * 0.95, '#fff3d6', 8);
  ctx.font = `600 ${Math.round(24 * Math.min(hs, 1.4))}px ${FONT}`; ctx.fillStyle = '#d9fff6';
  ctx.fillText(sc.n ? `${sc.n} of ${K.HIDE} pearls  ·  harmony ${Math.round(sc.harmony * 100)}%  ·  worth ${sc.worth} rupees` : 'Tap pearls in the tray to string them', (U.x0 + U.x1) / 2, U.y0 + 14 + (LY.backSz && !LY.land ? LY.backSz : 0) + tfs * 0.95 + Math.round(34 * Math.min(hs, 1.4)));
  // the string and pearls
  ctx.save(); ctx.strokeStyle = 'rgba(230,200,140,0.85)'; ctx.lineWidth = 3; ctx.beginPath(); L.slots.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.stroke(); ctx.restore();
  L.slots.forEach((s, i) => { const p = L.pearls[i]; if (p) { const r = Math.min(26, 9 + p.mm * 1.45); drawPearl(ctx, s.x, s.y, r, p, S.clock || 0); } else { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]); } });
  // the clasp
  const a = L.slots[0], b = L.slots[L.slots.length - 1];
  ctx.fillStyle = '#e0a93a'; for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q.x, q.y - 22, 5, 0, TAU); ctx.fill(); }
  // the tray
  const T = L.tray;
  panel(ctx, T.x, T.y, T.w, T.h, { r: 22, fill: 'rgba(3,26,33,0.7)', stroke: PAN_EDGE, lw: 2 });
  ctx.font = `700 ${Math.round(24 * Math.min(hs, 1.3))}px ${FONT}`; ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'left'; ctx.fillText(`Your pearls (${L.grid.length})`, T.x + 18, T.y + 36);
  ctx.save(); ctx.beginPath(); ctx.rect(T.x, T.y + 46, T.w, T.h - 52); ctx.clip();
  const scroll = clamp(state.ui.scroll, 0, Math.max(0, L.rows * L.cell - (T.h - 60)));
  L.grid.forEach((it) => { const yy = it.y - scroll; if (yy < T.y + 40 || yy > T.y + T.h) return; drawPearl(ctx, it.x, yy, it.r, it.p, S.clock || 0); });
  if (!L.grid.length) { ctx.font = `500 ${Math.round(22 * Math.min(hs, 1.3))}px ${FONT}`; ctx.fillStyle = 'rgba(255,243,214,0.75)'; ctx.textAlign = 'center'; ctx.fillText('No pearls yet. Open some shells first.', T.x + T.w / 2, T.y + T.h / 2); }
  ctx.restore();
  // selected pearl detail
  const sel = state.selPearl && S.pearls.find((p) => p.id === state.selPearl);
  if (sel) { ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(22 * Math.min(hs, 1.3))}px ${FONT}`; ctx.fillStyle = '#fff27a'; ctx.fillText(`${sim.pearlName(sel)}, ${sim.pearlDetail(sel)}, ${sel.value} rupees`, (L.nk.x + L.nk.w / 2), L.nk.y + L.nk.h + 4); }
  drawButton(ctx, L.btns.arrange, 'Arrange', { size: Math.round(HUD.fonts.btn * 0.9), disabled: sc.n < 2 });
  drawButton(ctx, L.btns.clear, 'Clear', { dark: true, size: Math.round(HUD.fonts.btn * 0.9), disabled: !sc.n });
  drawButton(ctx, L.btns.done, 'Done', { primary: true, size: HUD.fonts.btn });
}
