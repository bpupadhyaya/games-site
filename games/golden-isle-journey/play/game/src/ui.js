// Shared interface pieces: crafted buttons, story cards, star rows, meters, the HUD and the chapter road.
import { portrait } from './portraits.js';
import { roadBackdrop } from './mapart.js';
import { W, H, TAU, GOLD, INK, rr, filigree, light, hash, clamp, lerp, ridge, stars as starfield, finish, dome } from './stage.js';

export const SERIF = '"Cormorant Garamond", Georgia, "Times New Roman", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const font = (px, family = SERIF, weight = 700) => `${weight} ${px}px ${family}`;

export const hit = (b, p, pad = 0) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

// Text-size steps for the reference/read-heavy pages (About, Controls, Rules). An INDEX array,
// never a raw float, so the stepper can cleanly disable at either end and a stale saved index from
// a build with a different-length array can be clamped instead of producing NaN sizes.
export const TEXT_SCALES = [1, 1.5, 2, 2.5, 3];
// Fixed header-row position for the "A-"/"A+" stepper, shared by About/Controls/Rules so it always
// lives in the same place. Sits above where Controls/Rules' own content starts (y=150) and clear of
// the HUD back/mute icons (x 20-104 and x 616-700, y 28-100).
export const TEXT_STEP = {
  dec: { x: W / 2 - 96, y: 26, w: 86, h: 62 },
  inc: { x: W / 2 + 10, y: 26, w: 86, h: 62 },
};
export function textStepper(ctx, idx) {
  button(ctx, { ...TEXT_STEP.dec, label: 'A−' }, { size: 30, disabled: idx <= 0 });
  button(ctx, { ...TEXT_STEP.inc, label: 'A+' }, { size: 30, disabled: idx >= TEXT_SCALES.length - 1 });
}

export function button(ctx, b, { primary = false, disabled = false, size = 38, sub = null } = {}) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.45 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(ctx, b.x + 2, b.y + 7, b.w, b.h, 18); ctx.fill();
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  if (primary) { g.addColorStop(0, '#ffe09a'); g.addColorStop(0.5, '#eeb752'); g.addColorStop(1, '#b97a22'); }
  else { g.addColorStop(0, '#4a2230'); g.addColorStop(0.5, '#2e1320'); g.addColorStop(1, '#1c0a14'); }
  ctx.fillStyle = g; rr(ctx, b.x, b.y, b.w, b.h, 18); ctx.fill();
  ctx.strokeStyle = primary ? '#fff0c0' : 'rgba(242,196,106,0.85)'; ctx.lineWidth = 2.5; rr(ctx, b.x, b.y, b.w, b.h, 18); ctx.stroke();
  ctx.strokeStyle = primary ? 'rgba(120,70,10,0.5)' : 'rgba(242,196,106,0.28)'; ctx.lineWidth = 1.2; rr(ctx, b.x + 7, b.y + 7, b.w - 14, b.h - 14, 12); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; rr(ctx, b.x + 4, b.y + 3, b.w - 8, b.h * 0.42, 14); ctx.fill();
  ctx.fillStyle = primary ? '#2a1204' : '#f8e2b0';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = font(size);
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + (sub ? -10 : 2));
  if (sub) { ctx.font = font(20, SANS, 500); ctx.fillText(sub, b.x + b.w / 2, b.y + b.h / 2 + 20); }
  ctx.restore();
}

export function wrap(ctx, text, maxW) {
  const lines = []; let line = '';
  for (const word of String(text).split(' ')) {
    const tryLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(tryLine).width > maxW && line) { lines.push(line); line = word; } else line = tryLine;
  }
  if (line) lines.push(line);
  return lines;
}

export function paragraph(ctx, text, x, y, maxW, lh, align = 'center') {
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrap(ctx, text, maxW);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return lines.length * lh;
}

export function star(ctx, x, y, r, on, t = 0) {
  if (on) light(ctx, x, y, r * 2.6, '255,210,120', 0.55 + 0.1 * Math.sin(t * 3 + x));
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffd778' : 'rgba(20,8,14,0.7)'; ctx.fill();
  ctx.strokeStyle = on ? '#fff3c4' : 'rgba(242,196,106,0.5)'; ctx.lineWidth = 2; ctx.stroke();
}

export function starRow(ctx, x, y, n, r = 26, t = 0, of = 3) {
  for (let i = 0; i < of; i++) star(ctx, x + (i - (of - 1) / 2) * r * 2.5, y - (i === 1 && of === 3 ? r * 0.3 : 0), r, i < n, t);
}

// A dark glass panel with gold filigree.
function scrollCorner(ctx, x, y, sx, sy) {
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, sy);
  ctx.strokeStyle = 'rgba(248,214,120,0.9)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(10, 44); ctx.bezierCurveTo(10, 20, 20, 12, 44, 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 38); ctx.bezierCurveTo(18, 26, 26, 20, 38, 18); ctx.bezierCurveTo(30, 24, 30, 32, 22, 38); ctx.stroke();
  ctx.beginPath(); ctx.arc(30, 30, 5, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(248,214,120,0.9)'; ctx.beginPath(); ctx.moveTo(44, 10); ctx.quadraticCurveTo(54, 6, 62, 10); ctx.quadraticCurveTo(54, 16, 44, 10); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, 44); ctx.quadraticCurveTo(6, 54, 10, 62); ctx.quadraticCurveTo(16, 54, 10, 44); ctx.fill();
  ctx.restore();
}
// Ornate frame: deep-plum enamel, an illuminated border band of gold lozenges, scroll corners.
export function panel(ctx, x, y, w, h, alpha = 0.78) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `rgba(30,10,26,${alpha})`); g.addColorStop(1, `rgba(14,5,12,${alpha})`);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.fillStyle = 'rgba(96,22,40,0.5)'; rr(ctx, x + 6, y + 6, w - 12, h - 12, 14); ctx.fill(); ctx.fillStyle = g; rr(ctx, x + 17, y + 17, w - 34, h - 34, 8); ctx.fill();
  filigree(ctx, x, y, w, h, 0.9);
  ctx.fillStyle = 'rgba(248,214,120,0.8)';
  for (let px = x + 40; px < x + w - 30; px += 28) for (const py of [y + 11.5, y + h - 11.5]) { ctx.beginPath(); ctx.moveTo(px, py - 3.5); ctx.lineTo(px + 3.5, py); ctx.lineTo(px, py + 3.5); ctx.lineTo(px - 3.5, py); ctx.fill(); }
  for (let py = y + 44; py < y + h - 30; py += 28) for (const px of [x + 11.5, x + w - 11.5]) { ctx.beginPath(); ctx.moveTo(px, py - 3.5); ctx.lineTo(px + 3.5, py); ctx.lineTo(px, py + 3.5); ctx.lineTo(px - 3.5, py); ctx.fill(); }
  scrollCorner(ctx, x + 14, y + 14, 1, 1); scrollCorner(ctx, x + w - 14, y + 14, -1, 1); scrollCorner(ctx, x + 14, y + h - 14, 1, -1); scrollCorner(ctx, x + w - 14, y + h - 14, -1, -1);
}

// Story card: kicker (place), title, text. Returns the y under the text so buttons can sit below.
// `scale` (from TEXT_SCALES, via the reference-page text-size stepper) grows every font and the
// vertical rhythm between them together, so nothing on the card can crowd or overlap as it grows -
// callers that never pass it (the chapter card, result, lost, world) render exactly as before.
export function storyCard(ctx, { kicker, title, text, y = 250, appear = 1, stars = -1, t = 0, who = null, note = null, scale = 1 }) {
  ctx.save();
  ctx.globalAlpha = clamp(appear, 0, 1);
  const x = 50, w = W - 100;
  const S = (n) => Math.round(n * scale);
  const bodySize = S(34), bodyLh = S(44);
  ctx.font = font(bodySize);
  const lines = wrap(ctx, text, w - 90);
  const h = S(190) + lines.length * bodyLh + (stars >= 0 ? S(90) : 0);
  const noteSize = S(27), noteLh = S(34);
  ctx.font = font(noteSize, SERIF, 600);
  const noteLines = note ? wrap(ctx, note, w - 110) : [];
  const yy0 = y + (1 - clamp(appear, 0, 1)) * 30, pOff = who ? 290 : 0;
  const yy = yy0 + pOff, hh = h + (noteLines.length ? S(40) + noteLines.length * noteLh : 0);
  panel(ctx, x, yy, w, hh);
  if (who) portrait(ctx, { who, x: W / 2, y: yy0 + 165, r: 104, t });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  // Shrink-to-fit: the letter-spacing below (`.split('').join(hairspace)`) makes even a
  // short-ish kicker much wider than its character count suggests - fine for the single short
  // word every scale=1 caller passes (a chapter's place name, "About"), but the world page's
  // own kicker ("The Story & Its World  ·  1 / 7") ran off both sides of the card at a big
  // text-size step. Same floor-clamped shrink pattern as the title just below.
  const kickerStr = String(kicker).toUpperCase().split('').join(' ');
  let kickerSize = S(24);
  ctx.font = font(kickerSize, SANS, 600);
  const availKickerW = w - 60;
  const kickerW = ctx.measureText(kickerStr).width;
  if (kickerW > availKickerW) { kickerSize = Math.max(14, Math.floor(kickerSize * availKickerW / kickerW)); ctx.font = font(kickerSize, SANS, 600); }
  ctx.fillText(kickerStr, W / 2, yy + S(56));
  // Shrink-to-fit: a multi-word title (only the About page passes a scale above 1 into this shared
  // component - every other caller keeps scale=1 and is untouched) ran off both sides of the card
  // at the top text-size step, since nothing here ever checked the title's width against the
  // card's own fixed (never-scaled) width. Never shrinks below a small fixed floor, and the y
  // position keeps using the page's own vertical rhythm (S(114)) so the layout below doesn't shift.
  ctx.fillStyle = '#fff1cf';
  let titleSize = S(54);
  ctx.font = font(titleSize);
  const availTitleW = w - 80;
  const titleW = ctx.measureText(title).width;
  if (titleW > availTitleW) { titleSize = Math.max(28, Math.floor(titleSize * availTitleW / titleW)); ctx.font = font(titleSize); }
  ctx.fillText(title, W / 2, yy + S(114));
  ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W / 2 - 120, yy + S(136)); ctx.lineTo(W / 2 + 120, yy + S(136)); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.moveTo(W / 2, yy + S(129)); ctx.lineTo(W / 2 + 7, yy + S(136)); ctx.lineTo(W / 2, yy + S(143)); ctx.lineTo(W / 2 - 7, yy + S(136)); ctx.fill();
  let ty = yy + S(186);
  if (stars >= 0) { starRow(ctx, W / 2, yy + S(196), stars, 30, t); ty += S(90); }
  ctx.fillStyle = '#f3dfc0'; ctx.font = font(bodySize);
  lines.forEach((l, i) => ctx.fillText(l, W / 2, ty + i * bodyLh));
  if (noteLines.length) {
    const ny = ty + lines.length * bodyLh + S(18);
    ctx.strokeStyle = 'rgba(242,196,106,0.4)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W / 2 - 90, ny - S(22)); ctx.lineTo(W / 2 + 90, ny - S(22)); ctx.stroke();
    ctx.fillStyle = GOLD; ctx.font = font(noteSize, SERIF, 600);
    noteLines.forEach((l, i) => ctx.fillText(l, W / 2, ny + S(8) + i * noteLh));
  }
  ctx.restore();
  return yy + hh;
}

// A caption line inside a scene (storyteller's voice).
export function caption(ctx, text, y, alpha = 1, size = 32) {
  if (alpha <= 0.01 || !text) return;
  ctx.save(); ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.font = font(size);
  const lines = wrap(ctx, text, W - 120);
  const h = lines.length * (size + 8) + 30;
  ctx.fillStyle = 'rgba(12,4,10,0.62)'; rr(ctx, 36, y - 38, W - 72, h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(242,196,106,0.5)'; ctx.lineWidth = 1.5; rr(ctx, 36, y - 38, W - 72, h, 16); ctx.stroke();
  ctx.fillStyle = '#ffeccc'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * (size + 8)));
  ctx.restore();
}

export function meter(ctx, x, y, w, h, v, rgb = '242,196,106', label = null, right = null) {
  ctx.fillStyle = 'rgba(10,4,8,0.6)'; rr(ctx, x, y, w, h, h / 2); ctx.fill();
  const fw = Math.max(h, w * clamp(v, 0, 1));
  if (v > 0.001) { const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, `rgba(${rgb},0.75)`); g.addColorStop(1, `rgba(${rgb},1)`); ctx.fillStyle = g; rr(ctx, x, y, fw, h, h / 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(242,196,106,0.8)'; ctx.lineWidth = 2; rr(ctx, x, y, w, h, h / 2); ctx.stroke();
  ctx.font = font(22, SANS, 600); ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#f6e3bd';
  if (label) { ctx.textAlign = 'left'; ctx.fillText(label, x + 4, y - 8); }
  if (right) { ctx.textAlign = 'right'; ctx.fillText(right, x + w - 4, y - 8); }
}

export function pips(ctx, x, y, n, of, rgb = '242,196,106', r = 9, gap = 26) {
  for (let i = 0; i < of; i++) {
    ctx.beginPath(); ctx.arc(x + i * gap, y, r, 0, TAU);
    ctx.fillStyle = i < n ? `rgba(${rgb},1)` : 'rgba(10,4,8,0.6)'; ctx.fill();
    ctx.strokeStyle = 'rgba(242,196,106,0.8)'; ctx.lineWidth = 2; ctx.stroke();
  }
}

export function label(ctx, text, x, y, size = 24, align = 'left', color = '#f6e3bd', family = SANS, weight = 600) {
  ctx.font = font(size, family, weight); ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(text, x + 1, y + 2);
  ctx.fillStyle = color; ctx.fillText(text, x, y);
}

// ---- HUD ------------------------------------------------------------------------------------
export const HUD = {
  back: { x: 20, y: 28, w: 84, h: 72 },
  mute: { x: W - 104, y: 28, w: 84, h: 72 },
  skip: { x: W / 2 - 110, y: 108, w: 220, h: 54, label: '' },
};

function roundIcon(ctx, b, draw) {
  ctx.fillStyle = 'rgba(14,5,12,0.62)'; rr(ctx, b.x, b.y, b.w, b.h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(242,196,106,0.8)'; ctx.lineWidth = 2; rr(ctx, b.x, b.y, b.w, b.h, 20); ctx.stroke();
  ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.strokeStyle = '#f8e2b0'; ctx.fillStyle = '#f8e2b0'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; draw(); ctx.restore();
}

export function hud(ctx, { title, muted, dev, skipLabel, showBack = true, pause = false }) {
  if (showBack) roundIcon(ctx, HUD.back, pause ? () => { ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(-8, 14); ctx.moveTo(8, -14); ctx.lineTo(8, 14); ctx.stroke(); } : () => { ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(-8, 0); ctx.lineTo(8, 14); ctx.stroke(); });
  roundIcon(ctx, HUD.mute, () => {
    ctx.beginPath(); ctx.moveTo(-16, -6); ctx.lineTo(-8, -6); ctx.lineTo(2, -15); ctx.lineTo(2, 15); ctx.lineTo(-8, 6); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    if (muted) { ctx.moveTo(9, -8); ctx.lineTo(21, 8); ctx.moveTo(21, -8); ctx.lineTo(9, 8); } else { ctx.arc(4, 0, 9, -0.9, 0.9); ctx.moveTo(14, -13); ctx.arc(4, 0, 17, -0.9, 0.9); }
    ctx.stroke();
  });
  if (title) { label(ctx, title, W / 2, 76, 34, 'center', '#fff1cf', SERIF, 700); }
  if (dev) button(ctx, { ...HUD.skip, label: skipLabel }, { size: 24 });
}

// ---- The chapter road -------------------------------------------------------------------------
export const ROAD_STEP = 270;
export const roadHeight = (n) => n * ROAD_STEP + 620;
export const roadNode = (i, n) => ({ x: W / 2 + Math.sin(i * 1.25 + 0.4) * 190, y: roadHeight(n) - 330 - i * ROAD_STEP });

const REGION = [ // sky colours along the road, bottom (start) to top (home)
  [255, 190, 110], [236, 150, 90], [90, 150, 100], [150, 110, 60], [70, 120, 90], [120, 120, 90], [70, 70, 150], [30, 36, 90], [170, 50, 30], [60, 80, 150], [150, 50, 40], [190, 70, 40], [250, 190, 100],
];

function glyph(ctx, key, x, y, c) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tri = (ax, ay, bx, by, cx, cy) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
  if (key === 'bow' || key === 'duel') { ctx.beginPath(); ctx.arc(-8, 0, 26, -1.1, 1.1); ctx.stroke(); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(4, -23); ctx.lineTo(4, 23); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(30, 0); ctx.stroke(); tri(34, 0, 24, -6, 24, 6); if (key === 'duel') for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * 9 + 4, -30, 3.5, 0, TAU); ctx.fill(); } }
  else if (key === 'exile' || key === 'regency' || key === 'return') { ctx.fillRect(-26, -2, 52, 24); dome(ctx, 0, -2, 14); dome(ctx, -20, -2, 7); dome(ctx, 20, -2, 7); if (key === 'return') for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 16, 30, 3, 0, TAU); ctx.fill(); } }
  else if (key === 'forest' || key === 'deer') { for (const d of [-16, 0, 16]) { ctx.beginPath(); ctx.arc(d, -8 - (d === 0 ? 8 : 0), 13, 0, TAU); ctx.fill(); ctx.fillRect(d - 2, 0, 4, 24); } }
  else if (key === 'allies') { tri(-30, 24, -6, -22, 14, 24); tri(-4, 24, 16, -8, 32, 24); }
  else if (key === 'flight' || key === 'bridge') { for (let r = 0; r < 3; r++) { ctx.beginPath(); for (let i = -28; i <= 28; i += 4) ctx.lineTo(i, 8 + r * 10 + Math.sin(i / 7 + r) * 3); ctx.stroke(); } if (key === 'bridge') ctx.fillRect(-28, -6, 56, 8); else { ctx.beginPath(); ctx.moveTo(-22, -12); ctx.quadraticCurveTo(0, -30, 24, -18); ctx.stroke(); tri(30, -17, 18, -24, 20, -10); } }
  else if (key === 'night') { ctx.beginPath(); ctx.arc(0, -4, 20, 0.6, 4.4); ctx.arc(8, -10, 17, 4.0, 0.9, true); ctx.fill(); }
  else if (key === 'burn') { ctx.beginPath(); ctx.moveTo(0, -30); ctx.quadraticCurveTo(24, -4, 12, 18); ctx.quadraticCurveTo(0, 28, -12, 18); ctx.quadraticCurveTo(-22, 0, -6, -10); ctx.quadraticCurveTo(-4, -2, 2, 0); ctx.quadraticCurveTo(6, -14, 0, -30); ctx.fill(); }
  else if (key === 'war') { ctx.fillRect(-24, -12, 48, 36); for (let i = -2; i <= 2; i++) ctx.fillRect(i * 11 - 4, -22, 8, 12); ctx.fillStyle = 'rgba(20,8,14,0.9)'; ctx.beginPath(); ctx.moveTo(-8, 24); ctx.lineTo(-8, 6); ctx.arc(0, 6, 8, Math.PI, 0); ctx.lineTo(8, 24); ctx.fill(); }
  ctx.restore();
}

export function road(ctx, { chapters, progress, scroll, t, dev, rm }) {
  const n = chapters.length, RH = roadHeight(n);
  roadBackdrop(ctx, { n, RH, nodeY: (i) => roadNode(i, n).y, region: REGION, scroll });
  const f = clamp((RH - H - scroll) / (RH - H), 0, 1) * (n - 1), a = REGION[Math.floor(f)], b = REGION[Math.min(n - 1, Math.floor(f) + 1)], u = f - Math.floor(f);
  const c = a.map((v, i) => Math.round(lerp(v, b[i], u)));
  light(ctx, W / 2, H * 0.72, 700, c.join(','), 0.16);
  ctx.save(); ctx.translate(0, -scroll);
  // the path
  const pts = chapters.map((_, i) => roadNode(i, n));
  const trace = (from, to) => { ctx.beginPath(); ctx.moveTo(pts[from].x, pts[from].y); for (let i = from; i < to; i++) { const p = pts[i], q = pts[i + 1], my = (p.y + q.y) / 2; ctx.bezierCurveTo(p.x, my, q.x, my, q.x, q.y); } };
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(10,4,8,0.55)'; ctx.lineWidth = 26; trace(0, n - 1); ctx.stroke();
  ctx.setLineDash([4, 18]); ctx.strokeStyle = 'rgba(242,196,106,0.55)'; ctx.lineWidth = 5; trace(0, n - 1); ctx.stroke(); ctx.setLineDash([]);
  const reach = clamp((dev ? n : progress.unlocked) - 1, 0, n - 1);
  if (reach > 0) { ctx.strokeStyle = 'rgba(255,214,130,0.95)'; ctx.lineWidth = 6; trace(0, reach); ctx.stroke(); }

  ctx.textAlign = 'center';
  pts.forEach((p, i) => {
    if (p.y - scroll < -200 || p.y - scroll > H + 200) return;
    const open = dev || i + 1 <= progress.unlocked, st = progress.stars[String(i + 1)] ?? 0, current = i + 1 === progress.unlocked;
    if (open) light(ctx, p.x, p.y, current ? 170 + Math.sin(t * 3) * (rm ? 0 : 16) : 120, '255,210,130', current ? 0.75 : 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.beginPath(); ctx.arc(p.x + 2, p.y + 8, 64, 0, TAU); ctx.fill();
    const mg = ctx.createRadialGradient(p.x - 18, p.y - 22, 6, p.x, p.y, 66);
    if (open) { mg.addColorStop(0, '#ffe7a8'); mg.addColorStop(0.7, '#e2a544'); mg.addColorStop(1, '#a5681c'); } else { mg.addColorStop(0, '#3a2230'); mg.addColorStop(1, '#1a0c16'); }
    ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, TAU); ctx.fill();
    ctx.strokeStyle = open ? '#fff2c6' : 'rgba(242,196,106,0.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 62, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, 53, 0, TAU); ctx.stroke();
    for (let k = 0; k < 12; k++) { const an = (k / 12) * TAU + (current && !rm ? t * 0.3 : 0); ctx.fillStyle = open ? '#fff2c6' : 'rgba(242,196,106,0.4)'; ctx.beginPath(); ctx.arc(p.x + Math.cos(an) * 70, p.y + Math.sin(an) * 70, 2.5, 0, TAU); ctx.fill(); }
    if (open && chapters[i].portrait) { ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, 52, 0, TAU); ctx.clip(); portrait(ctx, { who: chapters[i].portrait, x: p.x, y: p.y + 30, r: 58, t, frame: false }); ctx.restore(); }
    else glyph(ctx, chapters[i].key, p.x, p.y - 2, open ? INK : 'rgba(242,196,106,0.35)');
    // labels to the side with more room
    const side = p.x < W / 2 ? 1 : -1, lx = p.x + side * 84;
    ctx.globalAlpha = open ? 1 : 0.55;
    label(ctx, `${i + 1}`, p.x, p.y + 100, 26, 'center', GOLD, SANS, 700);
    ctx.font = font(36); const tl = wrap(ctx, chapters[i].title, 300);
    tl.forEach((ln, k) => label(ctx, ln, lx, p.y - 8 + k * 38 - (tl.length - 1) * 12, 36, side > 0 ? 'left' : 'right', '#fff1cf', SERIF, 700));
    label(ctx, chapters[i].place, lx, p.y + 28 + (tl.length - 1) * 26, 22, side > 0 ? 'left' : 'right', GOLD, SANS, 600);
    if (open && st > 0) for (let k = 0; k < 3; k++) star(ctx, lx + side * (16 + k * 34), p.y + 62 + (tl.length - 1) * 26, 13, k < st, t);
    ctx.globalAlpha = 1;
  });
  ctx.restore();
  finish(ctx, 0.75);
}

export { hash };
