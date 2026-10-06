// All the drawing primitives: tiles (ivory, lit and shaded, with a pip per colour), tile backs, the felt table with
// its walnut rack, tulip lattice, avatars. Original art, drawn procedurally. Heavy things are painted once into
// cached sprites (OffscreenCanvas) and blitted per frame.
import { W, H, RACK, COLS, slotRect, LAY, PILE_C, TILE_S } from './layout.js';

export const NUM_FONT = "'Trebuchet MS','Avenir Next','Segoe UI',Verdana,sans-serif";
export const DISPLAY = "Georgia,'Times New Roman',serif";
export const INK = ['#c3262b', '#1b57b3', '#1d1b26', '#c98100']; // red, blue, black, amber
export const INK_LIGHT = ['#e8524f', '#4a8be0', '#4d4a5c', '#f0ad22'];
export const COLOR_LABEL = ['Red', 'Blue', 'Black', 'Yellow'];

const RES = 2;
// Smallest text the layout may draw, in virtual units (about 11 css px; view.render sets it from the live screen scale).
export let FLOOR = 0;
export const setTextFloor = (n) => { FLOOR = n; };
const newCanvas = (w, h) => (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(w), Math.ceil(h)) : null);

export function roundPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ---- pips: one distinct shape per colour so colour is never the only cue -------------------------------------
export function drawPip(ctx, color, cx, cy, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (color === 0) ctx.arc(cx, cy, r, 0, Math.PI * 2);
  else if (color === 1) { const q = r * 0.86; roundPath(ctx, cx - q, cy - q, q * 2, q * 2, q * 0.3); }
  else if (color === 2) { ctx.moveTo(cx, cy - r * 1.1); ctx.lineTo(cx + r * 1.05, cy + r * 0.8); ctx.lineTo(cx - r * 1.05, cy + r * 0.8); ctx.closePath(); }
  else { ctx.moveTo(cx, cy - r * 1.2); ctx.lineTo(cx + r * 0.9, cy); ctx.lineTo(cx, cy + r * 1.2); ctx.lineTo(cx - r * 0.9, cy); ctx.closePath(); }
  ctx.fill();
}

function star(ctx, cx, cy, ro, ri, n, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n, r = i % 2 === 0 ? ro : ri;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ---- a tile face painted at (0,0) size w x h ----------------------------------------------------------------------
function paintFace(ctx, w, h, key, fake, wild) {
  const th = Math.max(3, h * 0.055), bh = h - th, r = w * 0.15;
  // soft contact shadow + thickness edge
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = h * 0.1; ctx.shadowOffsetY = h * 0.05;
  roundPath(ctx, 0, th, w, bh, r); ctx.fillStyle = '#9f8f66'; ctx.fill();
  ctx.restore();
  roundPath(ctx, 0, th, w, bh, r);
  const eg = ctx.createLinearGradient(0, th, 0, h); eg.addColorStop(0, '#b9a97c'); eg.addColorStop(1, '#7f7049');
  ctx.fillStyle = eg; ctx.fill();
  // face
  roundPath(ctx, 0, 0, w, bh, r);
  const fg = ctx.createLinearGradient(0, 0, w * 0.4, bh); fg.addColorStop(0, '#fffbef'); fg.addColorStop(0.55, '#f6eed6'); fg.addColorStop(1, '#e6dab9');
  ctx.fillStyle = fg; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.02); ctx.strokeStyle = 'rgba(120,100,60,0.55)'; ctx.stroke();
  // bevel highlight (top-left) and shade (bottom-right)
  ctx.save(); roundPath(ctx, 0, 0, w, bh, r); ctx.clip();
  ctx.lineWidth = w * 0.05; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  roundPath(ctx, w * 0.03, w * 0.03, w - w * 0.06, bh - w * 0.06, r * 0.85); ctx.stroke();
  ctx.strokeStyle = 'rgba(150,125,70,0.22)'; ctx.lineWidth = w * 0.04;
  ctx.beginPath(); ctx.moveTo(w * 0.1, bh - w * 0.04); ctx.lineTo(w - w * 0.1, bh - w * 0.04); ctx.lineTo(w - w * 0.04, w * 0.12); ctx.stroke();
  ctx.restore();

  const cx = w / 2;
  if (fake) {
    // the false okey: an engraved star in a ring
    ctx.strokeStyle = '#17604b'; ctx.lineWidth = w * 0.045;
    ctx.beginPath(); ctx.arc(cx, bh * 0.45, w * 0.3, 0, Math.PI * 2); ctx.stroke();
    star(ctx, cx, bh * 0.45, w * 0.22, w * 0.09, 5);
    const g = ctx.createLinearGradient(0, bh * 0.2, 0, bh * 0.7); g.addColorStop(0, '#2c9a78'); g.addColorStop(1, '#12503f');
    ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#17604b';
    ctx.beginPath(); ctx.arc(cx, bh * 0.83, w * 0.045, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - w * 0.14, bh * 0.83, w * 0.03, 0, Math.PI * 2); ctx.arc(cx + w * 0.14, bh * 0.83, w * 0.03, 0, Math.PI * 2); ctx.fill();
  } else {
    const c = Math.floor(key / 13), n = (key % 13) + 1;
    const fs = n >= 10 ? bh * 0.4 : bh * 0.5;
    ctx.font = `800 ${fs}px ${NUM_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ny = bh * 0.4;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(String(n), cx + 0.6, ny + 1.4);
    const tg = ctx.createLinearGradient(0, ny - fs / 2, 0, ny + fs / 2); tg.addColorStop(0, INK_LIGHT[c]); tg.addColorStop(0.5, INK[c]); tg.addColorStop(1, INK[c]);
    ctx.fillStyle = tg; ctx.fillText(String(n), cx, ny);
    drawPip(ctx, c, cx, bh * 0.8, w * 0.1, INK[c]);
  }
  if (wild) {
    // the okey of this deal: a gold rim and a glint
    roundPath(ctx, w * 0.03, w * 0.03, w - w * 0.06, bh - w * 0.06, r * 0.85);
    ctx.lineWidth = Math.max(2, w * 0.06);
    const gg = ctx.createLinearGradient(0, 0, w, bh); gg.addColorStop(0, '#ffe58a'); gg.addColorStop(0.5, '#d9a21b'); gg.addColorStop(1, '#fff0a8');
    ctx.strokeStyle = gg; ctx.stroke();
    star(ctx, w * 0.2, bh * 0.14, w * 0.11, w * 0.035, 4);
    ctx.fillStyle = '#d9a21b'; ctx.fill();
  }
}

function paintBack(ctx, w, h) {
  const th = Math.max(3, h * 0.055), bh = h - th, r = w * 0.15;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = h * 0.1; ctx.shadowOffsetY = h * 0.05;
  roundPath(ctx, 0, th, w, bh, r); ctx.fillStyle = '#0a3532'; ctx.fill();
  ctx.restore();
  roundPath(ctx, 0, 0, w, bh, r);
  const g = ctx.createLinearGradient(0, 0, w, bh); g.addColorStop(0, '#1b8077'); g.addColorStop(1, '#0c4743');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.04); ctx.strokeStyle = '#e7bd62'; roundPath(ctx, w * 0.1, w * 0.1, w * 0.8, bh - w * 0.2, r * 0.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; roundPath(ctx, 0.5, 0.5, w - 1, bh - 1, r); ctx.stroke();
  tulip(ctx, w / 2, bh * 0.52, Math.min(w, bh) * 0.3, 'rgba(244,201,106,0.95)', 'rgba(244,201,106,0.7)');
}

// ---- sprite cache -------------------------------------------------------------------------------------------------
const sprites = new Map();
function sprite(keyStr, w, h, paint) {
  let s = sprites.get(keyStr);
  if (s !== undefined) return s;
  const pad = Math.ceil(h * 0.14);
  const cv = newCanvas((w + pad * 2) * RES, (h + pad * 2) * RES);
  if (!cv) { sprites.set(keyStr, null); return null; }
  const cx = cv.getContext('2d');
  cx.scale(RES, RES); cx.translate(pad, pad);
  paint(cx);
  s = { cv, pad };
  sprites.set(keyStr, s);
  return s;
}
export function invalidateArt() { sprites.clear(); bgCache.clear(); }

// Draw a tile id (0..105) at top-left (x,y), size w x h. `okey` = the deal's okey {c,n,key} (to mark wilds).
export function drawTile(ctx, id, okey, x, y, w, h, o = {}) {
  const fake = id >= 104;
  const key = fake ? -1 : (id % 52);
  const wild = !fake && okey && key === okey.key;
  const alpha = o.alpha ?? 1;
  if (alpha <= 0.01) return;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha = alpha;
  if (o.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(o.rot); ctx.translate(-w / 2, -h / 2); x = 0; y = 0; }
  const s = sprite(`t${fake ? 'F' : key}|${wild ? 1 : 0}|${w}x${h}`, w, h, (cx) => paintFace(cx, w, h, key, fake, wild));
  if (s) ctx.drawImage(s.cv, x - s.pad, y - s.pad, w + s.pad * 2, h + s.pad * 2);
  else { ctx.translate(x, y); paintFace(ctx, w, h, key, fake, wild); ctx.translate(-x, -y); }
  if (o.glow) {
    ctx.shadowColor = o.glow; ctx.shadowBlur = 18; ctx.lineWidth = 3; ctx.strokeStyle = o.glow;
    roundPath(ctx, x - 1, y - 1, w + 2, h - h * 0.055 + 2, w * 0.16); ctx.stroke();
  }
  if (o.dim) { ctx.fillStyle = `rgba(10,30,30,${o.dim})`; roundPath(ctx, x, y, w, h - h * 0.055, w * 0.15); ctx.fill(); }
  ctx.restore();
}

export function drawBack(ctx, x, y, w, h, o = {}) {
  ctx.save();
  if (o.alpha !== undefined && o.alpha < 1) ctx.globalAlpha = o.alpha;
  if (o.rot) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(o.rot); ctx.translate(-w / 2, -h / 2); x = 0; y = 0; }
  const s = sprite(`b|${w}x${h}`, w, h, (cx) => paintBack(cx, w, h));
  if (s) ctx.drawImage(s.cv, x - s.pad, y - s.pad, w + s.pad * 2, h + s.pad * 2);
  else { ctx.translate(x, y); paintBack(ctx, w, h); }
  ctx.restore();
}

// ---- a stylised tulip (the lale): a Turkish garden motif, used on tile backs and in the table lattice ----------------
export function tulip(ctx, cx, cy, s, fill, stroke) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, s * 0.07);
  // stem
  ctx.beginPath(); ctx.moveTo(0, s * 0.15); ctx.quadraticCurveTo(s * 0.05, s * 0.6, 0, s * 1.0); ctx.stroke();
  // leaves
  ctx.beginPath(); ctx.moveTo(0, s * 0.9); ctx.quadraticCurveTo(-s * 0.55, s * 0.7, -s * 0.5, s * 0.35); ctx.quadraticCurveTo(-s * 0.15, s * 0.55, 0, s * 0.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, s * 0.9); ctx.quadraticCurveTo(s * 0.55, s * 0.7, s * 0.5, s * 0.35); ctx.quadraticCurveTo(s * 0.15, s * 0.55, 0, s * 0.9); ctx.fill();
  // bloom: pointed centre petal and two side petals
  ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.quadraticCurveTo(-s * 0.32, -s * 0.5, -s * 0.12, s * 0.2); ctx.lineTo(s * 0.12, s * 0.2); ctx.quadraticCurveTo(s * 0.32, -s * 0.5, 0, -s * 0.95); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-s * 0.1, -s * 0.55); ctx.quadraticCurveTo(-s * 0.62, -s * 0.5, -s * 0.46, s * 0.05); ctx.quadraticCurveTo(-s * 0.3, s * 0.3, 0, s * 0.22); ctx.quadraticCurveTo(-s * 0.15, -s * 0.1, -s * 0.1, -s * 0.55); ctx.fill();
  ctx.beginPath(); ctx.moveTo(s * 0.1, -s * 0.55); ctx.quadraticCurveTo(s * 0.62, -s * 0.5, s * 0.46, s * 0.05); ctx.quadraticCurveTo(s * 0.3, s * 0.3, 0, s * 0.22); ctx.quadraticCurveTo(s * 0.15, -s * 0.1, s * 0.1, -s * 0.55); ctx.fill();
  ctx.restore();
}

function lattice(ctx, w, h, size, fill, stroke) {
  let row = 0;
  for (let y = size * 0.6; y < h + size; y += size * 1.1) {
    for (let x = (row % 2) * size * 0.5; x < w + size; x += size) tulip(ctx, x, y, size * 0.34, fill, stroke);
    row++;
  }
}

// ---- cached backgrounds ----------------------------------------------------------------------------------------------
const bgCache = new Map();
// Backgrounds are painted once per live layout (size + safe areas + scene kind) and blitted every frame.
function bake(name, res, paint) {
  const key = `${name}|${LAY.key}`;
  if (bgCache.has(key)) return bgCache.get(key);
  const cv = newCanvas(W * res, H * res);
  let out = null;
  if (cv) { const cx = cv.getContext('2d'); cx.scale(res, res); paint(cx); out = cv; }
  bgCache.set(key, out);
  if (bgCache.size > 6) bgCache.delete(bgCache.keys().next().value);
  return out;
}

function paintTable(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.37, 60, W / 2, H * 0.44, Math.max(W, H) * 0.7);
  g.addColorStop(0, '#1b7468'); g.addColorStop(0.55, '#0f4d48'); g.addColorStop(1, '#06201f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.07; lattice(ctx, W, H, 92, '#8be0cf', '#8be0cf'); ctx.globalAlpha = 1;
  // the playing mat
  const M = LAY.mat;
  roundPath(ctx, M.x, M.y, M.w, M.h, 36);
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(233,196,106,0.35)'; ctx.stroke();
  roundPath(ctx, M.x + 10, M.y + 10, M.w - 20, M.h - 20, 30); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(233,196,106,0.16)'; ctx.stroke();
  // pile spots
  for (const c of PILE_C) { const sw = TILE_S.w + 14, sh = TILE_S.h + 16; roundPath(ctx, c.x - sw / 2, c.y - sh / 2, sw, sh, 11); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(233,196,106,0.3)'; ctx.stroke(); }
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5, W / 2, H / 2, Math.max(W, H) * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);

  // the walnut rack
  const f = RACK.frame;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  roundPath(ctx, f.x, f.y, f.w, f.h, 26); ctx.fillStyle = '#4a2b17'; ctx.fill();
  ctx.restore();
  roundPath(ctx, f.x, f.y, f.w, f.h, 26);
  const wg = ctx.createLinearGradient(0, f.y, 0, f.y + f.h); wg.addColorStop(0, '#7a4a2a'); wg.addColorStop(0.5, '#5e361c'); wg.addColorStop(1, '#3d2211');
  ctx.fillStyle = wg; ctx.fill();
  ctx.save(); roundPath(ctx, f.x, f.y, f.w, f.h, 26); ctx.clip();
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 70; i++) {
    const y = f.y + rnd() * f.h, a = 0.05 + rnd() * 0.1;
    ctx.strokeStyle = rnd() > 0.5 ? `rgba(20,8,0,${a})` : `rgba(255,200,140,${a * 0.6})`; ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath(); ctx.moveTo(f.x, y); ctx.bezierCurveTo(f.x + f.w * 0.3, y + rnd() * 10 - 5, f.x + f.w * 0.6, y + rnd() * 10 - 5, f.x + f.w, y + rnd() * 8 - 4); ctx.stroke();
  }
  ctx.restore();
  // inner tray + brass trim
  roundPath(ctx, f.x + 8, f.y + 8, f.w - 16, f.h - 16, 20); ctx.fillStyle = '#2a170b'; ctx.fill();
  const tg = ctx.createLinearGradient(0, f.y + 8, 0, f.y + f.h - 8); tg.addColorStop(0, 'rgba(0,0,0,0.5)'); tg.addColorStop(1, 'rgba(0,0,0,0.1)');
  ctx.fillStyle = tg; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#d6aa4f'; roundPath(ctx, f.x + 2, f.y + 2, f.w - 4, f.h - 4, 24); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,230,160,0.5)'; roundPath(ctx, f.x + 5, f.y + 5, f.w - 10, f.h - 10, 21); ctx.stroke();
  // row ledges + slot recesses
  for (let r = 0; r < 2; r++) {
    const y = RACK.rowY[r];
    const ledge = ctx.createLinearGradient(0, y + RACK.th - 4, 0, y + RACK.th + 10);
    ledge.addColorStop(0, '#8e5a33'); ledge.addColorStop(1, '#4b2a14');
    roundPath(ctx, f.x + 14, y + RACK.th - 6, f.w - 28, 14, 6); ctx.fillStyle = ledge; ctx.fill();
    ctx.fillStyle = 'rgba(255,214,150,0.25)'; ctx.fillRect(f.x + 20, y + RACK.th - 5, f.w - 40, 1.5);
    for (let c = 0; c < COLS; c++) { const q = slotRect(r * COLS + c); roundPath(ctx, q.x + 1, q.y + 4, q.w - 2, q.h - 8, 8); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill(); }
  }
}
export function drawTable(ctx) {
  const cv = bake('table', 1.5, paintTable);
  if (cv) ctx.drawImage(cv, 0, 0, W, H);
  else { ctx.fillStyle = '#0f4d48'; ctx.fillRect(0, 0, W, H); }
}

function paintTitleBg(ctx) {
  const g = ctx.createRadialGradient(W / 2, H * 0.28, 40, W / 2, H * 0.4, Math.max(W, H) * 0.76);
  g.addColorStop(0, '#1e8577'); g.addColorStop(0.5, '#0e4c47'); g.addColorStop(1, '#041a19');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.09; lattice(ctx, W, H, 110, '#9ff0dd', '#9ff0dd'); ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.55, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}
export function drawTitleBg(ctx) {
  const cv = bake('title', 1.5, paintTitleBg);
  if (cv) ctx.drawImage(cv, 0, 0, W, H);
  else { ctx.fillStyle = '#0e4c47'; ctx.fillRect(0, 0, W, H); }
}

// ---- UI pieces --------------------------------------------------------------------------------------------------------
// Pick a font size so `text` fits maxW, starting at `size` (scaled by the player's text zoom, capped to fit).
export function fitFont(ctx, text, weight, size, maxW, family = NUM_FONT, min = 12) {
  min = Math.max(min, FLOOR);
  let s = Math.max(size, min);
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > min && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}

// Largest font (<= base) at which `text` wraps into lines that fit maxW x maxH. Returns { fs, lines }.
export function fitWrap(ctx, text, weight, base, maxW, maxH, family = NUM_FONT, min = 11) {
  min = Math.max(min, FLOOR);
  for (let fs = Math.round(base); fs >= min; fs--) {
    ctx.font = `${weight} ${fs}px ${family}`;
    const lines = wrapLines(ctx, text, maxW);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxW + 0.5) && lines.length * fs * 1.15 <= maxH;
    if (fits) return { fs, lines };
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return { fs: min, lines: wrapLines(ctx, text, maxW) };
}

// Pointer position fed by game.update so a button under a held finger draws pressed.
export const PRESS = { x: 0, y: 0, down: false };
export function button(ctx, r, label, o = {}) {
  const { primary = false, dim = false, active = false, size = 28, scale = 1, hot = false, glow = false, icon = null } = o;
  const pressed = !dim && PRESS.down && PRESS.x >= r.x && PRESS.x <= r.x + r.w && PRESS.y >= r.y && PRESS.y <= r.y + r.h;
  ctx.save();
  if (dim) ctx.globalAlpha = 0.45;
  if (pressed) ctx.translate(0, 2);
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = pressed ? 4 : 10; ctx.shadowOffsetY = pressed ? 1 : 4;
  roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(24, r.h * 0.32));
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  if (primary) { g.addColorStop(0, pressed ? '#d9ae48' : '#eec45e'); g.addColorStop(1, pressed ? '#b8801f' : '#cd9328'); }
  else if (active) { g.addColorStop(0, pressed ? '#1f7c6f' : '#27887a'); g.addColorStop(1, pressed ? '#12574f' : '#17695e'); }
  else { g.addColorStop(0, pressed ? '#1d4743' : '#27554f'); g.addColorStop(1, pressed ? '#14322f' : '#1b4642'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5; ctx.strokeStyle = primary ? '#fff0be' : glow ? '#ffe28a' : 'rgba(233,196,106,0.55)'; ctx.stroke();
  if (hot) { ctx.shadowColor = '#ffe28a'; ctx.shadowBlur = 20; ctx.strokeStyle = '#ffe28a'; ctx.lineWidth = 3; roundPath(ctx, r.x, r.y, r.w, r.h, Math.min(24, r.h * 0.32)); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  if (dim) ctx.globalAlpha = 0.6;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const maxW = r.w - 20;
  const base = size * scale;
  const { fs, lines } = fitWrap(ctx, String(label).replace(/\n/g, ' '), 700, base, maxW, r.h - 10);
  ctx.font = `700 ${fs}px ${NUM_FONT}`;
  ctx.fillStyle = primary ? '#3a2406' : '#f7efd8';
  const lh = fs * 1.15;
  lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + r.h / 2 + (i - (lines.length - 1) / 2) * lh + 1));
  ctx.restore();
}

export function pill(ctx, x, y, w, h, fill, stroke) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// A single word wider than the line (a long hyphenated word at 300% text) is broken after a hyphen where one fits, else at a letter, so a line never runs out of its panel.
function breakWord(ctx, word, maxW) {
  const parts = []; let cur = '';
  for (const ch of word) {
    if (cur && ctx.measureText(cur + ch).width > maxW) {
      const h = cur.lastIndexOf('-');
      if (h > 0 && h < cur.length - 1) { parts.push(cur.slice(0, h + 1)); cur = cur.slice(h + 1) + ch; } else { parts.push(cur); cur = ch; }
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}
export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      if (ctx.measureText(word).width > maxW) {
        if (line) { out.push(line); line = ''; }
        const parts = breakWord(ctx, word, maxW);
        for (let i = 0; i < parts.length - 1; i++) out.push(parts[i]);
        line = parts[parts.length - 1] || '';
        continue;
      }
      const t = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(t).width > maxW) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  return out;
}

const AVATAR = ['#e8b64d', '#d9604c', '#5aa0d8', '#8fc46a'];
export function drawAvatar(ctx, seat, x, y, r) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff3c8'); g.addColorStop(1, AVATAR[seat]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  ctx.restore();
}
