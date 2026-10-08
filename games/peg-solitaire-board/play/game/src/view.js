// Everything that is drawn. Reads the game state and the live layout; never changes game state (it may write cached metrics).
import { BOARDS, boardById } from './boards.js';
import { UI, DISPLAY, WOODS, PEGS, drawTable, drawBoard, drawHole, drawPeg, drawTarget, boardShape } from './art.js';
import { DOCS, FIGS, labelFor, START_NOTE, CLASSIC_START } from './content.js';
import { LEVELS } from './levels-data.js';
import { TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { countMoves, count } from './rules.js';

const CREAM = '#f7ecd2', MUTED = '#cdbb96', GOLD = '#e9bd62', GOLD2 = '#f6d98c', INK = '#2a1a0c';
export const docMetrics = { max: 0, view: 0 };
let UZ = 1;                      // the player's text size (A-/A+ on the Rules pages, Settings): buttons, chips, messages and the result card follow it where they fit
const zs = (cap = 2.2) => Math.min(UZ, cap);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => u * u * (3 - 2 * u);

// ---- small drawing helpers ------------------------------------------------------------------------------------------------------
function rr(ctx, r, rad) { ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, rad); }
function text(ctx, s, x, y, size, o = {}) {
  ctx.font = `${o.weight ?? 600} ${size}px ${o.display ? DISPLAY : UI}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'alphabetic';
  if (o.maxW) { const w = ctx.measureText(s).width; if (w > o.maxW) { size = Math.max(o.min ?? 18, size * (o.maxW / w)); ctx.font = `${o.weight ?? 600} ${size}px ${o.display ? DISPLAY : UI}`; } }
  if (o.shadow) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillText(s, x + size * 0.04, y + size * 0.06); }
  ctx.fillStyle = o.color ?? CREAM; ctx.fillText(s, x, y);
}
export function wrap(ctx, s, maxW) {
  const out = [];
  for (const para of String(s).split('\n')) {
    const words = para.split(' '); let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
    out.push(line);
  }
  return out;
}
function panel(ctx, r, { fill = 'rgba(8,22,16,0.74)', rad = 22, brand = 0, stroke = 'rgba(240,214,150,0.22)' } = {}) {
  rr(ctx, r, rad); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = stroke; ctx.stroke();
  if (brand) edgeStroke(ctx, r, rad, brand);
}
// flat buttons: no inner gloss shape. kind: 'main' (gold), 'plain' (dark wood), 'ghost'
export function button(ctx, r, label, { kind = 'plain', sub = null, disabled = false, size = 30, active = false } = {}) {
  ctx.save();
  rr(ctx, r, 18);
  if (kind === 'main') ctx.fillStyle = disabled ? 'rgba(233,189,98,0.35)' : GOLD;
  else if (kind === 'ghost') ctx.fillStyle = 'rgba(8,22,16,0.35)';
  else ctx.fillStyle = active ? '#5a3a1c' : disabled ? 'rgba(46,30,16,0.55)' : '#3d2714';
  ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = kind === 'main' ? 'rgba(255,240,200,0.55)' : active ? GOLD : 'rgba(240,214,150,0.28)'; ctx.stroke();
  const col = kind === 'main' ? INK : disabled ? 'rgba(247,236,210,0.4)' : CREAM, fs = Math.min(size * zs(), r.h * (sub ? 0.36 : 0.5));
  if (sub) { text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 - fs * 0.02, fs, { color: col, maxW: r.w - 20, weight: 700 }); text(ctx, sub, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.95, Math.max(20, Math.min(fs * 0.62, r.h * 0.2)), { color: kind === 'main' ? 'rgba(42,26,12,0.75)' : MUTED, maxW: r.w - 24, weight: 500 }); }
  else text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.34, fs, { color: col, maxW: r.w - 22, weight: 700 });
  ctx.restore();
}
function star(ctx, cx, cy, r, filled, a = 1) {
  ctx.save(); ctx.globalAlpha = a; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const rad = i % 2 ? r * 0.46 : r, ang = -Math.PI / 2 + (i * Math.PI) / 5; ctx.lineTo(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad); }
  ctx.closePath();
  if (filled) { const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r); g.addColorStop(0, '#ffe9a3'); g.addColorStop(1, '#d99a2b'); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = r * 0.07; ctx.strokeStyle = '#8a5a12'; ctx.stroke(); }
  else { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill(); ctx.lineWidth = r * 0.08; ctx.strokeStyle = 'rgba(247,236,210,0.35)'; ctx.stroke(); }
  ctx.restore();
}

// ---- the board scene (play, hero, setup) -----------------------------------------------------------------------------------------
// sc: { b, holes, cx, cy, D, wood, set, t, calm, anim, sel, targets, hint, drag, shake, fx, cursor, ring, hide }
export const pitchFor = (b, D) => D / (2 * boardShape(b, 1).R);
export function holeXY(sc, i) { const P = pitchFor(sc.b, sc.D), p = sc.b.pos[i]; return { x: sc.cx + p.x * P, y: sc.cy + p.y * P, P }; }
export function holeAt(sc, x, y) {
  const P = pitchFor(sc.b, sc.D); let best = -1, bd = Infinity;
  for (let i = 0; i < sc.b.n; i++) { const p = sc.b.pos[i], d = Math.hypot(sc.cx + p.x * P - x, sc.cy + p.y * P - y); if (d < bd) { bd = d; best = i; } }
  return bd <= P * 0.62 ? best : -1;
}
export function drawBoardScene(ctx, sc) {
  const { b, holes } = sc, P = pitchFor(b, sc.D), r = P * 0.4, set = sc.set, a = sc.anim;
  drawBoard(ctx, b, sc.wood, sc.cx, sc.cy, P);
  const at = (i) => ({ x: sc.cx + b.pos[i].x * P, y: sc.cy + b.pos[i].y * P });
  // targets
  if (sc.targets) for (const t of sc.targets) { const p = at(t); drawTarget(ctx, p.x, p.y, P * 0.43, sc.t, sc.calm); }
  if (sc.hint) { const p = at(sc.hint.to); drawTarget(ctx, p.x, p.y, P * 0.43, sc.t * 1.4, sc.calm); const q = at(sc.hint.from); ctx.lineWidth = Math.max(2, P * 0.07); ctx.strokeStyle = `rgba(255,226,130,${0.7 + 0.3 * Math.sin(sc.t * 6)})`; ctx.beginPath(); ctx.arc(q.x, q.y, r * 1.28, 0, 6.3); ctx.stroke(); }
  // pegs at rest (skip the landing hole of a running jump and the captured peg's hole: they are drawn by the animation)
  const hide = a ? (a.dir > 0 ? a.j.to : a.j.from) : -1;
  for (let i = 0; i < b.n; i++) {
    if (!holes[i] || i === hide || (sc.drag && sc.drag.from === i)) continue;
    const p = at(i), sel = sc.sel === i;
    let sh = 0; if (sc.shake && sc.shake.i === i) sh = Math.sin(sc.shake.t * 55) * (1 - sc.shake.t / 0.35) * P * 0.1;
    drawPeg(ctx, p.x + sh, p.y, r, set, { lift: sel ? 1 : 0, glow: sel ? 1 : 0 });
  }
  if (sc.ring != null && sc.ring >= 0) { const p = at(sc.ring), pu = sc.calm ? 0.8 : 0.65 + 0.35 * Math.sin(sc.t * 4); ctx.lineWidth = Math.max(2, P * 0.07); ctx.strokeStyle = `rgba(255,226,130,${pu})`; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.3, 0, 6.3); ctx.stroke(); }
  if (a) {
    const u = clamp(a.t / a.dur, 0, 1), f = a.dir > 0 ? u : 1 - u, A = at(a.j.from), B = at(a.j.to), O = at(a.j.over);
    // the jumped peg: sits until the jumper passes over it, then pops and fades
    const cu = clamp((f - 0.42) / 0.3, 0, 1), alive = f < 0.42 ? 1 : 1 - ease(cu);
    if (alive > 0.02) drawPeg(ctx, O.x, O.y - (f >= 0.42 ? cu * r * 0.7 : 0), r * (1 + (f >= 0.42 ? 0.18 * Math.sin(cu * 3.14) : 0)), set, { alpha: alive, lift: f >= 0.42 ? cu * 0.5 : 0 });
    const e = ease(f), x = A.x + (B.x - A.x) * e, y = A.y + (B.y - A.y) * e, lift = Math.sin(f * Math.PI);
    drawPeg(ctx, x, y, r, set, { lift: lift * 1.6, sq: f > 0.9 ? (1 - f) * 8 : 0 });
  }
  if (sc.drag) { const lift = 1.1; drawPeg(ctx, sc.drag.x, sc.drag.y - P * 0.35, r, set, { lift, glow: 1 }); }
  // sparkles
  if (sc.fx) for (const f of sc.fx) { const k = 1 - f.life / f.max, x = sc.cx + f.x * P, y = sc.cy + f.y * P; ctx.fillStyle = `rgba(${f.c[0]},${f.c[1]},${f.c[2]},${(1 - k) * 0.9})`; const s = P * 0.09 * (1 - k * 0.5); ctx.beginPath(); ctx.moveTo(x, y - s * 2); ctx.lineTo(x + s * 0.6, y - s * 0.6); ctx.lineTo(x + s * 2, y); ctx.lineTo(x + s * 0.6, y + s * 0.6); ctx.lineTo(x, y + s * 2); ctx.lineTo(x - s * 0.6, y + s * 0.6); ctx.lineTo(x - s * 2, y); ctx.lineTo(x - s * 0.6, y - s * 0.6); ctx.closePath(); ctx.fill(); }
  if (sc.cursor != null && sc.cursor >= 0) { const p = at(sc.cursor); ctx.lineWidth = Math.max(2, P * 0.06); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.setLineDash?.([P * 0.12, P * 0.1]); ctx.beginPath(); ctx.arc(p.x, p.y, P * 0.5, 0, 6.3); ctx.stroke(); ctx.setLineDash?.([]); }
}

// a flat little picture of a position (puzzle tiles, board cards)
export function drawMini(ctx, b, pegsOn, r, set, opts = {}) {
  const span = Math.max(b.spanX, b.spanY) + 1.1, P = Math.min(r.w, r.h) / span, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  for (const p of b.pos) { ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.arc(cx + p.x * P, cy + p.y * P, P * 0.36, 0, 6.3); ctx.fill(); }
  const S = PEGS[set] ?? PEGS.sapphire;
  for (let i = 0; i < b.n; i++) if (pegsOn[i]) { const p = b.pos[i]; drawPeg(ctx, cx + p.x * P, cy + p.y * P, P * 0.36, set, { shadow: false }); }
  void S;
}

// ---- the tray of captured pegs ---------------------------------------------------------------------------------------------------
function drawTray(ctx, r, captured, total, set, t) {
  panel(ctx, r, { fill: 'rgba(30,18,8,0.72)', rad: 18, stroke: 'rgba(240,214,150,0.18)' });
  const label = 'CAPTURED', inner = R4(r, 12);
  const lab0 = 22, room = inner.h - lab0 - 14;
  let rad = 4;
  for (let cand = 21; cand >= 4; cand -= 0.5) { const gap = cand * 2 + 3, cols = Math.max(1, Math.floor(inner.w / gap)), rows = Math.ceil(Math.max(1, total) / cols); if (rows * gap <= room) { rad = cand; break; } }
  ctx.save(); ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, 18); ctx.clip();
  const lab = Math.max(22, Math.min(24, rad * 1.1));
  text(ctx, label, r.x + 16, r.y + lab + 6, lab, { align: 'left', color: MUTED, weight: 700 });
  text(ctx, String(captured), r.x + r.w - 16, r.y + lab + 6, lab, { align: 'right', color: GOLD2, weight: 800 });
  const y0 = r.y + lab + 18, gap = rad * 2 + 3, usable = Math.max(1, Math.floor(inner.w / gap)), x0 = r.x + (r.w - usable * gap) / 2 + gap / 2;
  for (let k = 0; k < captured; k++) { const cx = x0 + (k % usable) * gap, cy = y0 + rad + Math.floor(k / usable) * gap; if (cy + rad > r.y + r.h) break; drawPeg(ctx, cx, cy, rad, set, { shadow: false, alpha: k === captured - 1 ? Math.min(1, t * 3 + 0.2) : 1 }); }
  ctx.restore();
}
const R4 = (r, p) => ({ x: r.x + p, y: r.y + p, w: r.w - 2 * p, h: r.h - 2 * p });

// ---- doc pages (Rules / How to Play / About) --------------------------------------------------------------------------------------
const docCache = new Map();
function figSize(f) { return f.tri ? { w: 3, h: 3 * 0.866 + 0.2 } : { w: f.w, h: f.h }; }
export function drawFigure(ctx, name, x, y, p, set = 'sapphire') {
  const f = FIGS[name], sz = figSize(f), W = (sz.w) * p + p * 0.9, H = (sz.h) * p + p * 0.9;
  ctx.save(); ctx.translate(x, y);
  rr(ctx, { x: 0, y: 0, w: W, h: H }, p * 0.35); const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, WOODS.maple.top); g.addColorStop(1, WOODS.maple.dark); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#4a2a12'; ctx.stroke();
  const pos = (cx, cy) => (f.tri ? { x: p * 0.45 + (cx - cy / 2 + 1) * p + p * 0.0, y: p * 0.45 + (cy * 0.866) * p + p * 0.3 } : { x: p * 0.45 + cx * p + p / 2, y: p * 0.45 + cy * p + p / 2 });
  for (const [cx, cy, s] of f.cells) {
    const q = pos(cx, cy); drawHole(ctx, q.x, q.y, p * 0.4, 'maple');
    if (s === 'g') drawTarget(ctx, q.x, q.y, p * 0.4, 0, true);
    if (s === 'p') drawPeg(ctx, q.x, q.y, p * 0.36, set);
    if (s === 'x') drawPeg(ctx, q.x, q.y, p * 0.36, set, { alpha: 0.28, shadow: false });
  }
  ctx.strokeStyle = '#7a4c12'; ctx.fillStyle = '#7a4c12'; ctx.lineWidth = Math.max(3, p * 0.07);
  for (const [x1, y1, x2, y2] of f.arrows) {
    const a = pos(x1, y1), c = pos(x2, y2), mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2 - p * 0.55;
    ctx.beginPath(); ctx.moveTo(a.x, a.y - p * 0.3); ctx.quadraticCurveTo(mx, my - p * 0.1, c.x, c.y - p * 0.3); ctx.stroke();
    const ang = Math.atan2(c.y - p * 0.3 - (my - p * 0.1), c.x - mx); ctx.beginPath(); ctx.moveTo(c.x, c.y - p * 0.3); ctx.lineTo(c.x - Math.cos(ang - 0.5) * p * 0.28, c.y - p * 0.3 - Math.sin(ang - 0.5) * p * 0.28); ctx.lineTo(c.x - Math.cos(ang + 0.5) * p * 0.28, c.y - p * 0.3 - Math.sin(ang + 0.5) * p * 0.28); ctx.closePath(); ctx.fill();
  }
  if (f.bad) { ctx.strokeStyle = '#b3261e'; ctx.lineWidth = Math.max(4, p * 0.1); const cx = W - p * 0.55, cy = p * 0.55, s = p * 0.2; ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke(); }
  ctx.restore();
  return { w: W, h: H };
}
function layoutDoc(ctx, docId, page, scale, textW) {
  const key = `${docId}|${page}|${scale}|${Math.round(textW)}`;
  let m = docCache.get(key); if (m) return m;
  const D = DOCS[docId].pages[page], items = []; let y = 0; const fs = 28 * scale, lh = fs * 1.42;
  ctx.font = `500 ${fs}px ${UI}`;
  for (const b of D.blocks) {
    if (b.t === 'p') { ctx.font = `500 ${fs}px ${UI}`; const lines = wrap(ctx, b.s, textW); items.push({ k: 'p', y, lines, fs, lh }); y += lines.length * lh + fs * 0.6; }
    else if (b.t === 'h') { ctx.font = `800 ${fs * 1.1}px ${UI}`; items.push({ k: 'h', y: y + fs * 0.2, s: b.s, fs: fs * 1.1 }); y += fs * 1.1 * 1.5 + fs * 0.2; }
    else if (b.t === 'li') { ctx.font = `500 ${fs}px ${UI}`; for (const it of b.items) { const lines = wrap(ctx, it, textW - fs * 1.1); items.push({ k: 'li', y, lines, fs, lh }); y += lines.length * lh + fs * 0.32; } y += fs * 0.3; }
    else if (b.t === 'fig') {
      const n = b.figs.length, fsz = Math.min(scale, 1.7), gap = 18;
      const sizes = b.figs.map((nm) => figSize(FIGS[nm]));
      const need = (p) => sizes.reduce((s, z) => s + z.w * p + p * 0.9, 0) + gap * (n - 1);
      let p = 62 * fsz; while (p > 30 && need(p) > textW) p -= 2;
      const h = Math.max(...sizes.map((z) => z.h * p + p * 0.9)), capSize = Math.max(22, 22 * Math.min(scale, 1.6));
      items.push({ k: 'fig', y, figs: b.figs, p, h, gap, capSize, sizes }); y += h + capSize * 2.3 + fs * 0.5;
    }
  }
  m = { items, h: y }; docCache.set(key, m); if (docCache.size > 60) docCache.delete(docCache.keys().next().value); return m;
}

function renderDoc(ctx, S, L) {
  const D = L.doc, doc = DOCS[S.docId], pg = doc.pages[S.docPage], scale = TEXT_SCALES[S.textScaleIdx];
  panel(ctx, D.panel, { fill: 'rgba(12,28,20,0.88)', rad: 26, brand: 0.5 });
  text(ctx, doc.title, D.header.titleX, D.header.titleY - 6, 40, { align: 'left', display: true, color: GOLD2, weight: 700, maxW: D.header.dec.x - D.header.titleX - 10 });
  text(ctx, pg.title, D.header.titleX, D.header.titleY + 26, 24, { align: 'left', color: MUTED, weight: 600, maxW: D.header.dec.x - D.header.titleX - 10 });
  button(ctx, D.header.dec, 'A−', { size: 30, disabled: S.textScaleIdx === 0 }); button(ctx, D.header.inc, 'A+', { size: 30, disabled: S.textScaleIdx === TEXT_SCALES.length - 1 });
  const vp = D.viewport, m = layoutDoc(ctx, S.docId, S.docPage, scale, D.textW);
  docMetrics.max = Math.max(0, m.h - vp.h); docMetrics.view = vp.h;
  const sc = clamp(S.docScroll, 0, docMetrics.max);
  ctx.save(); ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  const ox = vp.x + (vp.w - D.textW) / 2, oy = vp.y - sc;
  for (const it of m.items) {
    const y = oy + it.y; if (y > vp.y + vp.h + 40 || y + (it.h ?? it.lines?.length * it.lh ?? 40) < vp.y - 40) continue;
    if (it.k === 'p') { ctx.font = `500 ${it.fs}px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'left'; it.lines.forEach((ln, i) => ctx.fillText(ln, ox, y + it.fs + i * it.lh)); }
    else if (it.k === 'h') text(ctx, it.s, ox, y + it.fs, it.fs, { align: 'left', color: GOLD2, weight: 800 });
    else if (it.k === 'li') { ctx.font = `500 ${it.fs}px ${UI}`; ctx.fillStyle = GOLD; ctx.textAlign = 'left'; ctx.beginPath(); ctx.arc(ox + it.fs * 0.28, y + it.fs * 0.72, it.fs * 0.17, 0, 6.3); ctx.fill(); ctx.fillStyle = CREAM; it.lines.forEach((ln, i) => ctx.fillText(ln, ox + it.fs * 1.1, y + it.fs + i * it.lh)); }
    else if (it.k === 'fig') {
      const total = it.sizes.reduce((s, z) => s + z.w * it.p + it.p * 0.9, 0) + it.gap * (it.figs.length - 1);
      let x = ox + (D.textW - total) / 2;
      it.figs.forEach((nm, i) => { const r = drawFigure(ctx, nm, x, y, it.p, S.pegs); const cap = FIGS[nm].cap; ctx.font = `600 ${it.capSize}px ${UI}`; const lines = wrap(ctx, cap, r.w + it.gap * 0.6); ctx.fillStyle = MUTED; ctx.textAlign = 'center'; lines.forEach((ln, k) => ctx.fillText(ln, x + r.w / 2, y + it.h + it.capSize * 1.15 + k * it.capSize * 1.2)); x += r.w + it.gap; });
    }
  }
  ctx.restore();
  if (docMetrics.max > 0) {
    const sb = D.scrollbar; rr(ctx, sb, 10); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    const th = Math.max(40, sb.h * (vp.h / m.h)), ty = sb.y + (sb.h - th) * (sc / docMetrics.max); rr(ctx, { x: sb.x, y: ty, w: sb.w, h: th }, 10); ctx.fillStyle = 'rgba(233,189,98,0.75)'; ctx.fill();
  }
  text(ctx, `Page ${S.docPage + 1} of ${doc.pages.length}`, D.cx, D.counterY, 24, { color: MUTED, weight: 600 });
  button(ctx, D.nav.back, 'Menu', { size: 30 });
  button(ctx, D.nav.prev, 'Previous', { size: 28, disabled: S.docPage === 0 });
  button(ctx, D.nav.next, S.docPage === doc.pages.length - 1 ? 'Done' : 'Next', { size: 30, kind: 'main' });
}

// ---- screens ---------------------------------------------------------------------------------------------------------------------------
function sceneOf(S, L, g, box) {
  const b = boardById(g.bid);
  return { b, holes: g.holes, cx: box.cx, cy: box.cy, D: box.D, wood: S.wood, set: S.pegs, t: S.t, calm: S.calm };
}
export const playScene = (S, L) => {
  const g = S.g, box = L.play.board, sc = sceneOf(S, L, g, box);
  const legalSel = g.sel >= 0 && g.phase === 'play' ? sc.b.byFrom[g.sel].filter((j) => g.holes[j.over] && !g.holes[j.to]).map((j) => j.to) : null;
  Object.assign(sc, { anim: S.anim, sel: g.sel, targets: S.targetsOn && !S.anim ? legalSel : S.anim ? null : legalSel && S.targetsOn ? legalSel : null, hint: S.hint, drag: S.drag, shake: S.shake, fx: S.fx, cursor: S.kb ? S.cursor : null, ring: g.phase === 'setup' ? CLASSIC_START[g.bid] : -1 });
  if (!S.targetsOn) sc.targets = null;
  return sc;
};

function renderTitle(ctx, S, L) {
  const T = L.title(!!S.saved), hero = T.hero;
  drawTable(ctx, L.w, L.h, { x: hero.x + hero.w / 2, y: hero.y + hero.h * 0.55 });
  // logo
  const logoSize = clamp(Math.min(hero.w * 0.15, hero.h * 0.13), 54, 110);
  const ly = hero.y + logoSize * 1.05;
  text(ctx, 'Peg Solitaire', hero.x + hero.w / 2, ly, logoSize, { display: true, color: GOLD2, weight: 700, shadow: true, maxW: hero.w - 40 });
  text(ctx, 'Jump. Capture. Leave one.', hero.x + hero.w / 2, ly + logoSize * 0.5, Math.max(24, logoSize * 0.34), { color: CREAM, weight: 500, maxW: hero.w - 40 });
  const top = ly + logoSize * 0.72, avail = hero.y + hero.h - top - 6, D = Math.max(120, Math.min(hero.w - 24, avail - 16));
  const h = S.hero, b = boardById('english');
  const sc = { b, holes: h.holes, cx: hero.x + hero.w / 2, cy: top + avail / 2, D, wood: S.wood, set: S.pegs, t: S.t, calm: S.calm, anim: h.anim, fx: S.heroFx };
  drawBoardScene(ctx, sc);
  if (T.card) panel(ctx, T.card, { fill: 'rgba(8,22,16,0.62)', rad: 26, brand: 0.55 });
  const R = T.rows, sub = S.saved ? `${boardById(S.saved.g.bid).name} · ${count(S.saved.g.holes)} pegs left` : '';
  if (R.resume) button(ctx, R.resume, 'Continue', { kind: 'main', size: 34, sub });
  button(ctx, R.puzzles, 'Puzzles', { kind: 'main', size: 34 });
  button(ctx, R.classic, 'Classic', { kind: 'main', size: 34 });
  button(ctx, R.daily, 'Daily', { size: 30, sub: S.daily.solvedDay === S.daily.day ? 'Solved today' : S.daily.streak > 0 ? `Streak ${S.daily.streak}` : 'New puzzle' });
  button(ctx, R.auto, 'Auto Play', { size: 30, sub: 'Watch & Learn' });
  button(ctx, R.howto, 'How to Play', { size: 28 });
  button(ctx, R.rules, 'Rules', { size: 30 });
  button(ctx, R.about, 'About', { size: 30 });
  button(ctx, R.settings, 'Settings', { size: 30 });
  drawCredit(ctx, T.lockup.x + T.lockup.w / 2, T.lockup.y + T.lockup.h * 0.62, clamp(T.lockup.w * 0.044, 17, 22));
  if (S.msg) msgToast(ctx, S.msg, L.w / 2, T.lockup.y - 16 - (L.land ? 0 : 0), L.w);
}
function msgToast(ctx, m, x, y, w) {
  ctx.font = `600 26px ${UI}`; const lines = wrap(ctx, m.text, Math.min(w - 60, 640)), h = lines.length * 34 + 22, tw = Math.min(w - 40, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44), r = { x: x - tw / 2, y: y - h, w: tw, h };
  panel(ctx, r, { fill: 'rgba(8,22,16,0.9)', rad: 16 }); ctx.fillStyle = CREAM; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, x, r.y + 38 + i * 34));
}

function tabsRow(ctx, S, rects) {
  rects.forEach((r, i) => { const b = BOARDS[i], on = S.tab === i; button(ctx, r, b.short.split(' ')[0] === '15' ? 'Triangle' : b.name === 'Grand Cross' ? 'Cross' : b.name, { active: on, size: 26, sub: r.h > 70 ? b.short : null, kind: on ? 'plain' : 'ghost' }); });
}
function renderPuzzles(ctx, S, L) {
  const C = L.select; drawTable(ctx, L.w, L.h);
  text(ctx, 'Puzzles', C.title.x, C.title.y, C.title.size, { display: true, color: GOLD2, weight: 700, shadow: true });
  tabsRow(ctx, S, C.tabs);
  const b = BOARDS[S.tab], lv = LEVELS[b.id], done = lv.filter((_, i) => (S.progress.stars[`${b.id}:${i}`] ?? 0) > 0).length, stars = lv.reduce((s, _, i) => s + (S.progress.stars[`${b.id}:${i}`] ?? 0), 0);
  text(ctx, `${b.name}, ${b.short}. ${done} of 12 cleared · ${stars} of 36 stars`, C.info.x + C.info.w / 2, C.info.y + 28, 25, { color: MUTED, weight: 600, maxW: C.info.w });
  text(ctx, b.blurb, C.info.x + C.info.w / 2, C.info.y + 56, 23, { color: 'rgba(205,187,150,0.8)', weight: 500, maxW: C.info.w, min: 20 });
  C.grid.forEach((r, i) => {
    const st = S.progress.stars[`${b.id}:${i}`] ?? 0, open = S.unlocked(b.id, i), cur = open && st === 0;
    panel(ctx, r, { fill: open ? 'rgba(52,32,16,0.9)' : 'rgba(20,16,12,0.7)', rad: 18, stroke: cur ? GOLD : 'rgba(240,214,150,0.22)' });
    const holes = new Array(b.n).fill(0); LEVELS[b.id][i].pegs.forEach((k) => (holes[k] = 1));
    const mr = { x: r.x + r.w * 0.1, y: r.y + r.h * 0.08, w: r.w * 0.8, h: r.h * 0.56 };
    ctx.save(); ctx.globalAlpha = open ? 1 : 0.35; drawMini(ctx, b, holes, mr, S.pegs); ctx.restore();
    text(ctx, String(i + 1), r.x + 12, r.y + 30, 26, { align: 'left', color: GOLD2, weight: 800 });
    if (open) for (let k = 0; k < 3; k++) star(ctx, r.x + r.w / 2 + (k - 1) * Math.min(34, r.w * 0.27), r.y + r.h - Math.min(26, r.h * 0.17), Math.min(14, r.w * 0.1), k < st);
    else text(ctx, 'Locked', r.x + r.w / 2, r.y + r.h - 18, 24, { color: MUTED, weight: 600 });
  });
  button(ctx, C.back, 'Menu', { size: 32 });
  if (S.msg) msgToast(ctx, S.msg, L.w / 2, C.back.y - 14, L.w);
}
function renderClassic(ctx, S, L) {
  const C = L.select; drawTable(ctx, L.w, L.h);
  text(ctx, 'Classic', C.title.x, C.title.y, C.title.size, { display: true, color: GOLD2, weight: 700, shadow: true });
  text(ctx, 'Pick a board, then remove the first peg.', L.w / 2, C.title.y + 36, 24, { color: MUTED, weight: 500, maxW: L.w - 40 });
  C.cards.forEach((r, i) => {
    const b = BOARDS[i], best = S.progress.classic[b.id];
    panel(ctx, r, { fill: 'rgba(52,32,16,0.9)', rad: 20 });
    const holes = new Array(b.n).fill(1); holes[CLASSIC_START[b.id]] = 0;
    const lab = Math.max(26, Math.min(34, r.h * 0.12));
    drawMini(ctx, b, holes, { x: r.x + 10, y: r.y + 10, w: r.w - 20, h: r.h - lab * 3.6 }, S.pegs);
    text(ctx, b.name, r.x + r.w / 2, r.y + r.h - lab * 2.25, lab, { weight: 800, color: GOLD2, maxW: r.w - 16 });
    text(ctx, `${b.short}${best ? ` · best ${best}` : ''}`, r.x + r.w / 2, r.y + r.h - lab * 1.0, Math.max(22, lab * 0.72), { color: MUTED, weight: 600, maxW: r.w - 16 });
  });
  button(ctx, C.back, 'Menu', { size: 32 });
}

function statChip(ctx, r, label, value, { big = false, color = CREAM, sub = null } = {}) {
  panel(ctx, r, { fill: 'rgba(8,22,16,0.72)', rad: 18, stroke: 'rgba(240,214,150,0.2)' });
  const ls = Math.min(22 * zs(1.12), r.h * 0.26); text(ctx, label, r.x + r.w / 2, r.y + ls + 8, ls, { color: MUTED, weight: 700, maxW: r.w - 12 });
  text(ctx, String(value), r.x + r.w / 2, r.y + r.h - (big ? 22 : 16) - (sub ? 8 : 0), Math.min(r.h * (big ? 0.6 : 0.5), (big ? 110 : 52) * zs(1.3)), { color, weight: 800, maxW: r.w - 16, display: false });
  if (sub) text(ctx, sub, r.x + r.w / 2, r.y + r.h - 8, 20, { color: MUTED, weight: 500, maxW: r.w - 12, min: 16 });
}
function playTitles(S) {
  const g = S.g, b = boardById(g.bid);
  if (S.autoMode) return ['Auto Play', `${b.name} · watch the solution`];
  if (g.mode === 'puzzle') return [`Puzzle ${g.level + 1}`, `${b.name} · ${b.short}`];
  if (g.mode === 'daily') return ['Daily Puzzle', `${b.name} · ${b.short}`];
  return ['Classic', `${b.name} · ${b.short}`];
}
function renderPlay(ctx, S, L) {
  const P = L.play, g = S.g, b = boardById(g.bid);
  drawTable(ctx, L.w, L.h, { x: P.board.cx, y: P.board.cy });
  const [t1, t2] = playTitles(S);
  if (L.land) { if (P.left) panel(ctx, P.left, { fill: 'rgba(8,22,16,0.66)', rad: 26, brand: 0.5 }); panel(ctx, P.right, { fill: 'rgba(8,22,16,0.66)', rad: 26, brand: 0.5 }); }
  text(ctx, t1, P.title.x, P.title.y, P.title.size, { display: true, color: GOLD2, weight: 700, shadow: true, maxW: P.title.maxW });
  text(ctx, t2, P.sub.x, P.sub.y, P.sub.size, { color: MUTED, weight: 600, maxW: P.sub.maxW });
  const left = count(g.holes), moves = countMoves(g.hist), total = Math.max(1, b.n - 1);
  statChip(ctx, P.chips[0], 'PEGS LEFT', left, { big: L.land && !!P.left, color: left === 1 ? '#9ae6a8' : CREAM });
  statChip(ctx, P.chips[1], 'MOVES', moves);
  if (g.watched) statChip(ctx, P.chips[2], 'JUMPS', g.hist.length); else if (g.mode === 'classic') statChip(ctx, P.chips[2], 'BEST', S.progress.classic[b.id] ?? '-'); else statChip(ctx, P.chips[2], 'PAR', g.par ?? '-');
  // board
  const sc = playScene(S, L); drawBoardScene(ctx, sc);
  if (P.tray.h >= 60) drawTray(ctx, P.tray, g.captured ?? (b.n - 1 - left + (g.mode === 'classic' ? 0 : 0)), total, S.pegs, S.sinceCapture);
  // message
  const m = S.autoMode && S.planStatus === 'working' ? { text: 'Finding the way…' } : S.planStatus === 'working' && S.wantHint ? { text: 'Thinking…' } : S.msg;
  if (m) { panel(ctx, P.msg, { fill: 'rgba(8,22,16,0.62)', rad: 16, stroke: 'rgba(240,214,150,0.16)' }); let mfs = (L.land ? (P.msgSize ?? 25) : 26) * zs(2), lines, lh; for (;;) { ctx.font = `600 ${mfs}px ${UI}`; lines = wrap(ctx, m.text, P.msg.w - 28); lh = Math.round(mfs * 1.25); if (lines.length * lh <= P.msg.h - 16 || mfs <= 18) break; mfs -= 1; } lines = lines.slice(0, Math.max(1, Math.floor((P.msg.h - 10) / lh))); const y0 = P.msg.y + P.msg.h / 2 - (lines.length - 1) * lh / 2 + mfs * 0.35; ctx.fillStyle = CREAM; ctx.textAlign = 'center'; lines.forEach((l, i) => ctx.fillText(l, P.msg.x + P.msg.w / 2, y0 + i * lh)); }
  // buttons
  if (S.autoMode) {
    const A = P.autoBtn, secs = THINK_STEPS[S.autoThinkIdx];
    button(ctx, A.exit, 'Exit', { size: 28 }); button(ctx, A.pause, S.autoPaused ? 'Resume' : 'Pause', { size: 28, kind: 'main' });
    button(ctx, A.dec, 'Think −', { size: 24, sub: `${secs} s`, disabled: S.autoThinkIdx === 0 }); button(ctx, A.inc, 'Think +', { size: 24, sub: `${secs} s`, disabled: S.autoThinkIdx === THINK_STEPS.length - 1 });
  } else {
    const B = P.btn, over = g.phase === 'over';
    button(ctx, B.menu, 'Menu', { size: 26 }); button(ctx, B.undo, 'Undo', { size: 26, disabled: !g.hist.length || over });
    button(ctx, B.restart, 'Restart', { size: 24 }); button(ctx, B.hint, 'Hint', { size: 26, kind: 'main', disabled: over || g.phase === 'setup' }); button(ctx, B.auto, 'Watch', { size: 25, disabled: over || g.phase === 'setup' });
  }
  if (P.badge) drawBadgeStack(ctx, P.badge.cx, P.badge.bottom, P.badge.w);
  if (S.autoPaused) { ctx.font = `800 40px ${UI}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.55)'; const bw = 200; rr(ctx, { x: P.board.cx - bw / 2, y: P.board.cy - 32, w: bw, h: 64 }, 16); ctx.fill(); text(ctx, 'Paused', P.board.cx, P.board.cy + 14, 36, { color: GOLD2, weight: 800 }); }
  if (g.phase === 'over') renderResult(ctx, S, L);
}

function renderResult(ctx, S, L) {
  const g = S.g, r = g.result, C = L.result, b = boardById(g.bid);
  ctx.fillStyle = 'rgba(2,10,6,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  panel(ctx, C.card, { fill: 'rgba(14,32,22,0.97)', rad: 28, brand: 0.7 });
  const win = r.left === 1;
  text(ctx, win ? (S.autoMode || g.watched ? 'Solved' : 'Solved!') : 'No more jumps', C.title.x, C.title.y, C.title.size, { display: true, color: GOLD2, weight: 700, shadow: true, maxW: C.card.w - 40 });
  if (!g.watched) for (let k = 0; k < 3; k++) { const pop = clamp(S.sceneT * 2.2 - k * 0.35, 0, 1); star(ctx, C.stars.cx + (k - 1) * C.stars.r * 2.5, C.stars.y + (1 - ease(pop)) * -18, C.stars.r * (0.6 + 0.4 * ease(pop)), k < r.stars, pop); }
  const lines = [];
  lines.push(`${r.left} peg${r.left === 1 ? '' : 's'} left · ${r.moves} move${r.moves === 1 ? '' : 's'}${g.par && g.mode !== 'classic' ? ` · par ${g.par}` : ''}`);
  if (g.watched) lines.push('Watched on Auto Play. No stars awarded.');
  else if (g.mode === 'classic') lines.push(r.left === 1 && r.perfectStart ? 'Master: the last peg is in the starting hole.' : labelFor(r.left) ? `${labelFor(r.left)}${r.newBest ? ' · new best for this board' : ''}` : '');
  else if (r.left === 1) lines.push(r.hinted ? 'Solved with hints: two stars.' : r.moves < g.par ? 'Under par. Excellent.' : r.moves === g.par ? 'On par. Well played.' : 'Perfect finish.');
  else lines.push(r.stars > 0 ? 'Puzzle cleared. Can you leave just one?' : 'Not cleared yet. Undo, or try again.');
  if (g.mode === 'daily' && r.left === 1 && !g.watched) lines.push(`Daily streak: ${S.daily.streak}`);
  let rfs = C.lines.size * zs(), wrapped;
  for (;;) { ctx.font = `600 ${rfs}px ${UI}`; wrapped = []; for (const ln of lines) wrapped.push(...wrap(ctx, ln, C.lines.maxW)); if (wrapped.length * rfs * 1.3 <= C.primary.y - 14 - C.lines.y + rfs || rfs <= 20) break; rfs -= 1; }
  ctx.fillStyle = CREAM; ctx.textAlign = 'center';
  let y = C.lines.y; for (const w of wrapped) { ctx.fillText(w, C.lines.x, y); y += rfs * 1.3; }
  const canNext = g.mode === 'puzzle' && r.stars > 0 && g.level < 11;
  button(ctx, C.primary, canNext ? 'Next puzzle' : g.mode === 'daily' ? 'Practise again' : 'Play again', { kind: 'main', size: 32 });
  button(ctx, C.second, r.left > 1 && !g.watched ? 'Undo' : 'Retry', { size: 28 });
  button(ctx, C.third, g.mode === 'daily' && r.left === 1 ? 'Share' : 'Boards', { size: 28 });
  button(ctx, C.menu, 'Menu', { size: 28 });
  drawMoreLine(ctx, C.more.x, C.more.y - 2, 20);
  void b;
}

function renderSettings(ctx, S, L) {
  const C = L.settings; drawTable(ctx, L.w, L.h);
  text(ctx, 'Settings', C.title.x, C.title.y, C.title.size, { display: true, color: GOLD2, weight: 700, shadow: true });
  panel(ctx, C.panel, { fill: 'rgba(8,22,16,0.6)', rad: 24, brand: 0.45 });
  const row = (name, label, value, sub) => { const r = C.rows[name]; button(ctx, r, label, { size: 28, sub: null }); text(ctx, value, r.x + r.w - 24, r.y + r.h / 2 + 10, 28, { align: 'right', color: GOLD2, weight: 800, maxW: r.w * 0.4 }); void sub; };
  const fs = Math.round(Math.max(26, Math.min(36, C.rows.sound.h * 0.36)));
  const yn = (v) => (v ? 'On' : 'Off');
  const rowLeft = (name, label) => { const r = C.rows[name]; text(ctx, label, r.x + 26, r.y + r.h / 2 + fs * 0.35, fs, { align: 'left', weight: 700, maxW: r.w * 0.55 }); };
  for (const nm of Object.keys(C.rows)) button(ctx, C.rows[nm], '', { size: 28 });
  rowLeft('sound', 'Sound'); text(ctx, yn(S.sound), C.rows.sound.x + C.rows.sound.w - 26, C.rows.sound.y + C.rows.sound.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800 });
  rowLeft('calm', 'Calm mode (less motion)'); text(ctx, yn(S.calm), C.rows.calm.x + C.rows.calm.w - 26, C.rows.calm.y + C.rows.calm.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800 });
  rowLeft('targets', 'Show where a peg can jump'); text(ctx, yn(S.targetsOn), C.rows.targets.x + C.rows.targets.w - 26, C.rows.targets.y + C.rows.targets.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800 });
  rowLeft('wood', 'Board'); text(ctx, WOODS[S.wood].name, C.rows.wood.x + C.rows.wood.w - 26, C.rows.wood.y + C.rows.wood.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800 });
  rowLeft('pegs', 'Pegs'); text(ctx, PEGS[S.pegs].name, C.rows.pegs.x + C.rows.pegs.w - 26, C.rows.pegs.y + C.rows.pegs.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800, maxW: C.rows.pegs.w * 0.4 });
  // look preview chip on the pegs row
  const pr = C.rows.pegs; drawPeg(ctx, pr.x + pr.w * 0.5, pr.y + pr.h / 2, Math.min(pr.h * 0.3, 24), S.pegs, { shadow: false });
  rowLeft('text', 'Text size on Rules pages'); text(ctx, `${Math.round(TEXT_SCALES[S.textScaleIdx] * 100)}%`, C.rows.text.x + C.rows.text.w - 26, C.rows.text.y + C.rows.text.h / 2 + fs * 0.35, fs, { align: 'right', color: GOLD2, weight: 800 });
  rowLeft('reset', S.confirmReset ? 'Tap again to erase progress' : 'Reset progress'); text(ctx, S.confirmReset ? 'Confirm' : '', C.rows.reset.x + C.rows.reset.w - 26, C.rows.reset.y + C.rows.reset.h / 2 + fs * 0.35, fs, { align: 'right', color: '#ff9c8a', weight: 800 });
  void row;
  button(ctx, C.back, 'Menu', { size: 32, kind: 'main' });
}
function renderSimple(ctx, S, L, title, lines) {
  drawTable(ctx, L.w, L.h); const C = L.simple;
  text(ctx, title, C.cx, C.cy - 160, 58, { display: true, color: GOLD2, weight: 700, shadow: true, maxW: L.U.w - 40 });
  ctx.font = `600 28px ${UI}`; ctx.fillStyle = CREAM; ctx.textAlign = 'center'; let y = C.cy - 90;
  for (const ln of lines) for (const w of wrap(ctx, ln, Math.min(L.U.w - 60, 620))) { ctx.fillText(w, C.cx, y); y += 38; }
  button(ctx, C.back, 'Menu', { size: 32, kind: 'main' });
}

export function render(ctx, S, L) {
  UZ = TEXT_SCALES[S.textScaleIdx] ?? 1;
  switch (S.scene) {
    case 'title': renderTitle(ctx, S, L); break;
    case 'puzzles': renderPuzzles(ctx, S, L); break;
    case 'classic': renderClassic(ctx, S, L); break;
    case 'play': renderPlay(ctx, S, L); break;
    case 'doc': drawTable(ctx, L.w, L.h); renderDoc(ctx, S, L); break;
    case 'settings': renderSettings(ctx, S, L); break;
    case 'demo-limit': renderSimple(ctx, S, L, 'Enjoying it?', ['You have played the free puzzles of the web preview.', 'Get the full game on iPhone and Android: five boards, sixty puzzles, a daily puzzle and Auto Play.']); break;
    default: renderSimple(ctx, S, L, 'Peg Solitaire', ['Loading…']);
  }
}
