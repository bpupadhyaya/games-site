// Drawing for the teaching system: command icons, the drawn hand, rich command text ("HOLD" in gold
// with an icon, [KEY] as a key cap), the numbered-steps panel, label pills and the coaching strip.
// Everything is vector code, high contrast (dark under-stroke) so it reads over any backdrop.
import { W, TAU, GOLD, rr, clamp } from './stage.js';
import { font, SANS, SERIF, wrap, panel } from './ui.js';

const CMD_RE = /^(TAPS?|HOLD|HOLDING|DRAG|DRAGGING|RELEASE|SWIPE)$/;
const CREAM = '#f8e9c8', GOLD_HI = '#ffd778', DARK = 'rgba(12,4,10,0.92)';

export const cmdKind = (word) => {
  const w = word.replace(/[^A-Z]/g, '');
  if (!CMD_RE.test(w)) return null;
  return w.startsWith('TAP') ? 'tap' : w.startsWith('HOLD') ? 'hold' : w.startsWith('DRAG') ? 'drag' : w.startsWith('SWIPE') ? 'swipe' : 'release';
};
export const firstCmd = (text) => { for (const w of String(text).split(/\s+/)) { const k = cmdKind(w); if (k) return k; } return null; };

// ---- icons ------------------------------------------------------------------------------------
const DIR = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2, dl: (3 * Math.PI) / 4, dr: Math.PI / 4, ul: (-3 * Math.PI) / 4, ur: -Math.PI / 4 };

function twice(ctx, drawFn, width, color) { // dark under-stroke, then the coloured stroke
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = DARK; ctx.lineWidth = width + 5; drawFn(); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; drawFn(); ctx.stroke();
}
function arrowHead(ctx, x, y, ang, size, color) {
  const p = () => { ctx.beginPath(); ctx.moveTo(x + Math.cos(ang + 2.6) * size, y + Math.sin(ang + 2.6) * size); ctx.lineTo(x, y); ctx.lineTo(x + Math.cos(ang - 2.6) * size, y + Math.sin(ang - 2.6) * size); };
  twice(ctx, p, Math.max(3, size * 0.32), color);
}
function dot(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, TAU); ctx.fillStyle = DARK; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = color; ctx.fill();
}

// kind: tap | hold | drag | release | swipe. r = half size in px. dir: for drag ('up','down','dl'...).
export function icon(ctx, kind, x, y, r = 28, { dir = 'right', color = GOLD_HI } = {}) {
  ctx.save(); ctx.translate(x, y);
  const sw = Math.max(3, r * 0.14);
  if (kind === 'tap') {
    dot(ctx, 0, 0, r * 0.26, color);
    twice(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, r * 0.58, 0, TAU); }, sw, color);
    ctx.globalAlpha = 0.7; twice(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, r * 0.92, 0, TAU); }, sw, color);
  } else if (kind === 'hold') {
    dot(ctx, 0, 0, r * 0.3, color);
    twice(ctx, () => { ctx.beginPath(); ctx.arc(0, 0, r * 0.78, -Math.PI / 2, Math.PI * 1.05); }, sw * 1.1, color);
    arrowHead(ctx, Math.cos(Math.PI * 1.05) * r * 0.78, Math.sin(Math.PI * 1.05) * r * 0.78, Math.PI * 1.05 - Math.PI / 2 + 0.15, r * 0.34, color);
  } else if (kind === 'drag') {
    const a = DIR[dir] ?? 0, L = r * 0.95, cx = Math.cos(a), cy = Math.sin(a);
    twice(ctx, () => { ctx.beginPath(); ctx.moveTo(-cx * L * 0.7, -cy * L * 0.7); ctx.lineTo(cx * L * 0.55, cy * L * 0.55); }, sw * 1.2, color);
    arrowHead(ctx, cx * L * 0.8, cy * L * 0.8, a, r * 0.42, color);
    dot(ctx, -cx * L * 0.7, -cy * L * 0.7, r * 0.26, color);
  } else if (kind === 'swipe') {
    twice(ctx, () => { ctx.beginPath(); ctx.arc(0, r * 0.7, r * 1.05, Math.PI * 1.22, Math.PI * 1.78); }, sw * 1.2, color);
    arrowHead(ctx, Math.cos(Math.PI * 1.78) * r * 1.05, r * 0.7 + Math.sin(Math.PI * 1.78) * r * 1.05, Math.PI * 1.78 + Math.PI / 2 - 0.2, r * 0.4, color);
    dot(ctx, Math.cos(Math.PI * 1.22) * r * 1.05, r * 0.7 + Math.sin(Math.PI * 1.22) * r * 1.05, r * 0.24, color);
  } else if (kind === 'release') {
    dot(ctx, 0, r * 0.45, r * 0.28, color);
    twice(ctx, () => { ctx.beginPath(); ctx.moveTo(-r * 0.7, r * 0.85); ctx.lineTo(r * 0.7, r * 0.85); }, sw * 0.9, color);
    twice(ctx, () => { ctx.beginPath(); ctx.moveTo(0, r * 0.05); ctx.lineTo(0, -r * 0.8); }, sw * 1.1, color);
    arrowHead(ctx, 0, -r * 0.92, -Math.PI / 2, r * 0.4, color);
  } else { // look: an eye-like ring, for steps that are not a gesture
    twice(ctx, () => { ctx.beginPath(); ctx.moveTo(-r * 0.9, 0); ctx.quadraticCurveTo(0, -r * 0.9, r * 0.9, 0); ctx.quadraticCurveTo(0, r * 0.9, -r * 0.9, 0); }, sw, color);
    dot(ctx, 0, 0, r * 0.24, color);
  }
  ctx.restore();
}

// ---- rich text ---------------------------------------------------------------------------------
// Words in CAPITALS that are commands are gold; [X] is a key cap. Returns the height used.
function words(text) { return String(text).split(' ').filter(Boolean); }
function measure(ctx, w, size) {
  if (/^\[.+\]/.test(w)) { const m = w.match(/^\[(.+?)\](.*)$/); ctx.font = font(size * 0.78, SANS, 800); const kw = ctx.measureText(m[1]).width + size * 0.6; ctx.font = font(size, SANS, 600); return kw + ctx.measureText(m[2]).width + size * 0.28; }
  const cmd = cmdKind(w);
  ctx.font = cmd ? font(size, SANS, 800) : font(size, SANS, 600);
  return ctx.measureText(w + ' ').width;
}
// An ordinary word that alone is wider than the whole column (found at the top text-size step,
// e.g. "judgement", "hermitage", next to a fixed-size portrait that eats a chunk of a now much
// bigger font's line width) has nowhere to wrap to - a normal space-by-space wrap can't help an
// unbreakable token. Split it hyphen-by-hyphen across as many lines as it needs, never shrinking
// the font. Command words (TAP/HOLD/...) and [KEY] caps are always short enough that this never
// fires for them, so plain character measurement is safe here.
function splitLongWord(ctx, w, size, maxW) {
  ctx.font = font(size, SANS, 600);
  const chunks = []; let chunk = '';
  for (const ch of w) {
    const test = chunk + ch;
    if (chunk && ctx.measureText(test + '-').width > maxW) { chunks.push(chunk + '-'); chunk = ch; }
    else chunk = test;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((c) => ({ w: c, ww: ctx.measureText(c + ' ').width }));
}
export function richLines(ctx, text, maxW, size) {
  const lines = []; let cur = [], cw = 0;
  for (const w of words(text)) {
    const ww = measure(ctx, w, size);
    if (ww > maxW && !/^\[.+\]/.test(w) && !cmdKind(w)) {
      if (cur.length) { lines.push(cur); cur = []; cw = 0; }
      const parts = splitLongWord(ctx, w, size, maxW);
      parts.forEach((p, i) => { if (i < parts.length - 1) lines.push([p]); else { cur = [p]; cw = p.ww; } });
      continue;
    }
    if (cw + ww > maxW && cur.length) { lines.push(cur); cur = []; cw = 0; }
    cur.push({ w, ww }); cw += ww;
  }
  if (cur.length) lines.push(cur);
  return lines;
}
export function rich(ctx, text, x, y, maxW, { size = 30, lh = size * 1.34, align = 'left', color = CREAM } = {}) {
  const lines = richLines(ctx, text, maxW, size);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  lines.forEach((ln, i) => {
    const total = ln.reduce((a, q) => a + q.ww, 0);
    let px = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const py = y + i * lh;
    for (const { w, ww } of ln) {
      const key = w.match(/^\[(.+?)\](.*)$/);
      if (key) {
        ctx.font = font(size * 0.78, SANS, 800);
        const kw = ctx.measureText(key[1]).width + size * 0.6, kh = size * 1.02;
        ctx.fillStyle = DARK; rr(ctx, px - 2, py - size * 0.86 - 2, kw + 4, kh + 4, 8); ctx.fill();
        const g = ctx.createLinearGradient(0, py - size * 0.86, 0, py - size * 0.86 + kh); g.addColorStop(0, '#5a3a48'); g.addColorStop(1, '#2a1420');
        ctx.fillStyle = g; rr(ctx, px, py - size * 0.86, kw, kh, 7); ctx.fill();
        ctx.strokeStyle = GOLD; ctx.lineWidth = 2; rr(ctx, px, py - size * 0.86, kw, kh, 7); ctx.stroke();
        ctx.fillStyle = '#fff1cf'; ctx.textAlign = 'center'; ctx.fillText(key[1], px + kw / 2, py - size * 0.12);
        ctx.font = font(size, SANS, 600); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.fillText(key[2], px + kw + size * 0.08, py);
      } else if (cmdKind(w)) {
        ctx.font = font(size, SANS, 800); ctx.lineWidth = 5; ctx.strokeStyle = DARK; ctx.lineJoin = 'round'; ctx.strokeText(w, px, py);
        ctx.fillStyle = GOLD_HI; ctx.fillText(w, px, py);
      } else {
        ctx.font = font(size, SANS, 600); ctx.fillStyle = color; ctx.fillText(w, px, py);
      }
      px += ww;
    }
  });
  return lines.length * lh;
}

// ---- the steps panel (demo caption + controls page rows) ---------------------------------------
export const normStep = (st) => (Array.isArray(st) ? { t: st[0], dir: st[1] } : { t: st, dir: 'down' });

export function stepRowHeight(ctx, st, w, size = 30) {
  const n = normStep(st);
  return Math.max(Math.round(size * 2.4), richLines(ctx, n.t, w - 160, size).length * size * 1.34 + 26);
}

// One numbered row: number disc, command icon, rich text. Returns the row height.
export function stepRow(ctx, st, i, x, y, w, { active = true, size = 30, numbered = true, dim = true } = {}) {
  const n = normStep(st), h = stepRowHeight(ctx, st, w, size);
  if (active) { ctx.fillStyle = 'rgba(242,196,106,0.13)'; rr(ctx, x - 8, y - 4, w + 16, h + 4, 14); ctx.fill(); ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.lineWidth = 2; rr(ctx, x - 8, y - 4, w + 16, h + 4, 14); ctx.stroke(); }
  const fade = active || !dim ? 1 : 0.62;
  ctx.globalAlpha *= fade;
  const cy = y + h / 2 - 2;
  if (numbered) {
    ctx.beginPath(); ctx.arc(x + 26, cy, 24, 0, TAU); ctx.fillStyle = active ? GOLD_HI : '#b98a3a'; ctx.fill();
    ctx.strokeStyle = DARK; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#2a1204'; ctx.font = font(30, SANS, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x + 26, cy + 1);
  }
  icon(ctx, firstCmd(n.t) ?? 'look', x + 96, cy, 30, { dir: n.dir });
  const th = richLines(ctx, n.t, w - 160, size).length * size * 1.34;
  rich(ctx, n.t, x + 146, y + (h - th) / 2 + size * 0.95, w - 160, { size });
  ctx.globalAlpha /= fade;
  return h;
}

// The demo caption: kicker, numbered steps (the active one lit), optional note and keyboard line.
export function demoCaption(ctx, { kicker, steps, active = -1, kbd = null, y = 116, bottom = false, size = 30 }) {
  const x = 30, w = W - 60, inner = w - 52;
  const rows = steps.map((s) => stepRowHeight(ctx, s, inner, size));
  const kbdH = kbd ? richLines(ctx, kbd, w - 60, size - 4).length * 35 + 14 : 0;
  const h = 78 + rows.reduce((a, b) => a + b + 8, 0) + kbdH + 10;
  if (bottom) y = 1560 - h - 36;
  panel(ctx, x, y, w, h, 0.95);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD; ctx.font = font(22, SANS, 700);
  ctx.fillText(String(kicker).toUpperCase().split('').join(' '), W / 2, y + 40);
  let ry = y + 58;
  steps.forEach((s, i) => { stepRow(ctx, s, i, x + 26, ry, inner, { active: steps.length === 1 ? false : i === active, size }); ry += rows[i] + 8; });
  if (kbd) { ctx.strokeStyle = 'rgba(242,196,106,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + 40, ry + 2); ctx.lineTo(x + w - 40, ry + 2); ctx.stroke(); rich(ctx, kbd, x + 34, ry + 34, w - 68, { size: size - 4 }); }
  return { top: y, bottom: y + h };
}

// ---- label pills pointing at things ----------------------------------------------------------
export function pill(ctx, text, x, y, tx = null, ty = null, { size = 26 } = {}) {
  ctx.save();
  ctx.font = font(size, SANS, 800);
  const w = ctx.measureText(text).width + 32, h = size + 22, px = clamp(x - w / 2, 12, W - w - 12), py = y - h / 2;
  if (tx !== null) {
    const cx = px + w / 2, cy = py + h / 2;
    twice(ctx, () => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tx, ty); }, 3, GOLD_HI);
    dot(ctx, tx, ty, 7, GOLD_HI);
  }
  ctx.fillStyle = 'rgba(12,4,10,0.9)'; rr(ctx, px, py, w, h, h / 2); ctx.fill();
  ctx.strokeStyle = GOLD_HI; ctx.lineWidth = 2.5; rr(ctx, px, py, w, h, h / 2); ctx.stroke();
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, px + w / 2, py + h / 2 + 1);
  ctx.restore();
}

// ---- the hand ----------------------------------------------------------------------------------
// A pointing hand whose fingertip is at (x, y). down = pressed (slightly smaller, with a ripple).
export function hand(ctx, x, y, { down = false, alpha = 1, scale = 1, angle = -0.22 } = {}) {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y); ctx.rotate(angle); const sc = scale * (down ? 0.94 : 1); ctx.scale(sc, sc);
  const shapes = [
    () => rr(ctx, -15, -2, 30, 110, 15),               // index finger (tip at 0,0)
    () => rr(ctx, -30, 76, 84, 82, 24),               // palm
    () => rr(ctx, 12, 58, 24, 46, 12),                // middle knuckle
    () => rr(ctx, 32, 66, 22, 42, 11),                // ring knuckle
    () => { ctx.save(); ctx.translate(-30, 112); ctx.rotate(-0.75); rr(ctx, -12, -34, 26, 62, 13); ctx.restore(); }, // thumb
  ];
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.save(); ctx.translate(6, 10); for (const sh of shapes) { ctx.beginPath(); sh(); ctx.fill(); } ctx.restore();
  ctx.lineJoin = 'round'; ctx.strokeStyle = DARK; ctx.lineWidth = 9;
  for (const sh of shapes) { ctx.beginPath(); sh(); ctx.stroke(); }
  const g = ctx.createLinearGradient(-30, 0, 60, 150); g.addColorStop(0, '#fff6e2'); g.addColorStop(1, '#efcf9c');
  ctx.fillStyle = g;
  for (const sh of shapes) { ctx.beginPath(); sh(); ctx.fill(); }
  ctx.strokeStyle = 'rgba(120,70,30,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, 82); ctx.lineTo(12, 108); ctx.moveTo(33, 88); ctx.lineTo(33, 110); ctx.stroke();
  ctx.restore();
}

export function ripple(ctx, x, y, u, r0 = 22, r1 = 96) {
  if (u <= 0 || u >= 1) return;
  ctx.save(); ctx.globalAlpha = (1 - u) * 0.95;
  twice(ctx, () => { ctx.beginPath(); ctx.arc(x, y, r0 + (r1 - r0) * u, 0, TAU); }, 6, GOLD_HI);
  ctx.restore();
}

// Progress arc around the fingertip while HOLDING (f 0..1), optional seconds readout.
export function holdArc(ctx, x, y, f, secs = null) {
  ctx.save();
  twice(ctx, () => { ctx.beginPath(); ctx.arc(x, y, 52, 0, TAU); }, 5, 'rgba(255,215,120,0.28)');
  twice(ctx, () => { ctx.beginPath(); ctx.arc(x, y, 52, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f, 0.02, 1)); }, 8, GOLD_HI);
  if (secs !== null) { ctx.font = font(34, SANS, 800); ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 6; ctx.strokeStyle = DARK; ctx.strokeText(`${secs.toFixed(1)} s`, x + 70, y - 34); ctx.fillStyle = GOLD_HI; ctx.fillText(`${secs.toFixed(1)} s`, x + 70, y - 34); }
  ctx.restore();
}

// Dashed drag path with an arrowhead at the current finger position.
export function dragTrail(ctx, x0, y0, x1, y1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 24) return;
  ctx.save(); ctx.setLineDash([14, 12]);
  twice(ctx, () => { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }, 6, GOLD_HI);
  ctx.setLineDash([]);
  arrowHead(ctx, x1, y1, Math.atan2(y1 - y0, x1 - x0), 28, GOLD_HI);
  dot(ctx, x0, y0, 9, GOLD_HI);
  ctx.restore();
}

// The finger's recent path (points), dashed, with an arrowhead at the current position.
export function dragPath(ctx, pts) {
  if (pts.length < 2) return;
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  if (len < 40) return;
  ctx.save(); ctx.setLineDash([14, 12]);
  const trace = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y); };
  twice(ctx, trace, 6, GOLD_HI);
  ctx.setLineDash([]);
  const e = pts[pts.length - 1]; let k = pts.length - 2; while (k > 0 && Math.hypot(e.x - pts[k].x, e.y - pts[k].y) < 14) k--;
  arrowHead(ctx, e.x, e.y, Math.atan2(e.y - pts[k].y, e.x - pts[k].x), 28, GOLD_HI);
  dot(ctx, pts[0].x, pts[0].y, 9, GOLD_HI);
  ctx.restore();
}

// ---- coaching strip (bottom of the real play screen) ------------------------------------------
export function coachStrip(ctx, text, y, alpha = 1, dir = 'down') {
  if (alpha <= 0.01) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  const size = 28, w = W - 60, lines = richLines(ctx, text, w - 130, size), h = Math.max(84, lines.length * size * 1.34 + 30);
  y = Math.min(y, 1524 - h);
  ctx.fillStyle = 'rgba(12,4,10,0.86)'; rr(ctx, 30, y, w, h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(242,196,106,0.85)'; ctx.lineWidth = 2.5; rr(ctx, 30, y, w, h, 20); ctx.stroke();
  icon(ctx, firstCmd(text) ?? 'look', 30 + 56, y + h / 2, 27, { dir });
  rich(ctx, text, 30 + 106, y + (h - lines.length * size * 1.34) / 2 + size * 0.98, w - 130, { size });
  ctx.restore();
  return h;
}

export { CREAM, GOLD_HI, DARK, SERIF, wrap };
