// All drawing for Kintsugi. Geometry comes from layout.js, art from art.js; nothing here changes game state.
import { playLayout, zoomLayout, titleLayout, shelfLayout, docLayout, settingsLayout, overLayout, pauseLayout, header, usable, TEXT_SCALES, THINK_STEPS } from './layout.js';
import { VESSELS, vesselById } from './vessels.js';
import { buildVessel, pip } from './geom.js';
import { drawPiece, drawCracks, drawGold, drawArtFlat, getArt, bakedPiece, benchPattern, fullQ, dropBakes } from './art.js';
import { snapInfo, knobPos, gildProgress, fmtTime, mendPct } from './play.js';
import { DOCS } from './content.js';
import { drawCredit } from './brand.js';
import { C, SANS, SERIF, rr, txt, para, panel, button, icon, stars, rgba } from './ui.js';

export const metrics = { max: 0, rect: null };
export const SETTINGS = [
  { id: 'guide', label: 'Guide on the bench', opts: ['Auto', 'Picture', 'Outline', 'Slots', 'Off'] },
  { id: 'brush', label: 'Gold brush steadiness', opts: ['Relaxed', 'Standard', 'Fine'] },
  { id: 'glow', label: 'Warm glow near the place', opts: ['On', 'Off'] },
  { id: 'think', label: 'Watch and Learn thinking time', opts: ['2 s', '5 s', '8 s', '10 s'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Sparkles', opts: ['Full', 'Calm'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore purchase'] },
];
export const GUIDES = ['picture', 'outline', 'slots', 'off'];
export const guideFor = (S, def) => (S.prefs.guide === 'auto' ? def.guide : S.prefs.guide);
const scaleOf = (S) => TEXT_SCALES[S.prefs.textIdx] ?? 1;
const flashOf = (S, id) => (S.flash && S.flash.id === id ? 1 - S.flash.t / 0.25 : 0);
const path = (g, poly) => { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };

export function settingIndex(S, id) {
  const p = S.prefs;
  switch (id) {
    case 'guide': return ['auto', 'picture', 'outline', 'slots', 'off'].indexOf(p.guide);
    case 'brush': return p.brush;
    case 'glow': return p.glow ? 0 : 1;
    case 'think': return p.thinkIdx;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
}

// ---- backgrounds ---------------------------------------------------------------------------------------------------------------
function bench(ctx, w, h, S) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#171212'); g.addColorStop(0.55, '#0f0b0b'); g.addColorStop(1, '#090606');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const pat = benchPattern(ctx); if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
  const v = ctx.createRadialGradient(w / 2, h * 0.42, Math.min(w, h) * 0.2, w / 2, h * 0.42, Math.max(w, h) * 0.75); v.addColorStop(0, 'rgba(120,80,40,0.10)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

const spaced = (ctx, str, x, y, track, o = {}) => {
  const { size = 20, weight = 600, color = C.dim, align = 'center', serif = false } = o;
  ctx.font = `${weight} ${size}px ${serif ? SERIF : SANS}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = color;
  const ws = [...str].map((ch) => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b + track, -track);
  let cx = align === 'center' ? x - total / 2 : x;
  [...str].forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += ws[i] + track; });
};

// A mended vessel (art + cracks + gold) centred at cx, cy; `size` is the vessel's largest dimension on screen.
export function drawMended(ctx, V, cx, cy, size, t, q = 1, o = {}) {
  const k = size / V.def.D;
  ctx.save();
  if (o.shadow !== false) { const b = V.bounds, sg = ctx.createRadialGradient(cx, cy + V.bounds.h * k * 0.52, 4, cx, cy + V.bounds.h * k * 0.52, b.w * k * 0.6); sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.save(); ctx.translate(0, 0); ctx.beginPath(); ctx.ellipse(cx, cy + V.bounds.h * k * 0.52, b.w * k * 0.62, b.w * k * 0.12, 0, 0, 7); ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-V.bounds.cx, -V.bounds.cy);
  const art = getArt(V, 0.7);
  if (art) ctx.drawImage(art.c, art.ox, art.oy, art.w, art.h);
  if (o.cracks !== false) drawCracks(ctx, V, o.crackAlpha ?? (q > 0 ? 0.5 : 1));
  if (q > 0) drawGold(ctx, V, fullQ(V, q), t, o.glints !== false);
  ctx.restore();
}

// ---- title -------------------------------------------------------------------------------------------------------------------------
function drawTitle(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const sc = scaleOf(S), T = titleLayout(w, h, !!S.saved, sc), hero = T.hero, V = buildVessel(vesselById('moonjar'));
  const hx = hero.x + hero.w / 2, size = Math.min(hero.w * 0.7, hero.h * (T.mode === 'land' ? 0.62 : 0.56));
  const hy = hero.y + hero.h * (T.mode === 'land' ? 0.4 : 0.34);
  const gl = ctx.createRadialGradient(hx, hy, 10, hx, hy, size * 0.95); gl.addColorStop(0, 'rgba(230,170,70,0.20)'); gl.addColorStop(1, 'rgba(230,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(hero.x, hero.y, hero.w, hero.h);
  drawMended(ctx, V, hx, hy + Math.sin(S.t * 0.8) * 3, size, S.t, 1);
  const ty = T.mode === 'land' ? hero.y + hero.h * 0.82 : hero.y + hero.h - 62;
  const ts = Math.min(hero.w * 0.15, 104), gr = ctx.createLinearGradient(0, ty - ts, 0, ty + ts * 0.3); gr.addColorStop(0, '#fff0c0'); gr.addColorStop(0.55, '#e8b858'); gr.addColorStop(1, '#a8741f');
  txt(ctx, 'KINTSUGI', hx, ty - ts * 0.15, { size: ts, weight: 700, color: gr, align: 'center', serif: true, maxW: hero.w - 30, shadow: 3 });
  spaced(ctx, 'GOLD  SEAMS', hx, ty + ts * 0.42, ts * 0.12, { size: Math.max(16, ts * 0.2), color: C.dim, weight: 500 });
  const B = T.buttons, k = Math.min(sc, 1.35), fs = 30 * k;
  if (B.continue) {
    const sv = vesselById(S.saved.vid);
    button(ctx, B.continue, 'Continue', { kind: 'gold', size: fs, sub: `${sv.name}  -  ${S.saved.phase === 'gild' ? 'gilding' : S.saved.placed + ' of ' + sv.N + ' shards'}`, flash: flashOf(S, 'continue'), serif: true });
  }
  button(ctx, B.play, 'Choose a Vessel', { kind: B.continue ? 'solid' : 'gold', size: fs, flash: flashOf(S, 'play'), serif: true });
  button(ctx, B.learn, 'Watch and Learn', { size: fs * 0.92, flash: flashOf(S, 'learn'), ico: 'play' });
  button(ctx, B.howto, 'How to Play', { size: fs * 0.8, flash: flashOf(S, 'howto') });
  button(ctx, B.rules, 'Rules', { size: fs * 0.8, flash: flashOf(S, 'rules') });
  button(ctx, B.about, 'About', { size: fs * 0.8, flash: flashOf(S, 'about') });
  button(ctx, B.settings, 'Settings', { size: fs * 0.8, flash: flashOf(S, 'settings') });
  drawCredit(ctx, T.brand.x, T.brand.y, 16, { dim: 0.95 });
}

// ---- scrolling bodies ------------------------------------------------------------------------------------------------------------------
function scrollBody(ctx, S, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  ctx.translate(0, -S.scrollY);
  const ch = draw();
  ctx.restore();
  metrics.rect = rect; metrics.max = Math.max(0, ch - rect.h);
  if (metrics.max > 0) { const bh = Math.max(40, rect.h * (rect.h / ch)), by = rect.y + (rect.h - bh) * (S.scrollY / metrics.max); rr(ctx, rect.x + rect.w - 5, by, 4, bh, 2); ctx.fillStyle = 'rgba(227,178,79,0.55)'; ctx.fill(); }
}
function head(ctx, S, H, title, sc, o = {}) {
  button(ctx, H.back, o.backLabel ?? 'Menu', { ico: 'back', size: 26, flash: flashOf(S, 'back') });
  button(ctx, H.dec, 'A-', { size: 26, disabled: S.prefs.textIdx === 0, flash: flashOf(S, 'tdec') });
  button(ctx, H.inc, 'A+', { size: 26, disabled: S.prefs.textIdx >= TEXT_SCALES.length - 1, flash: flashOf(S, 'tinc') });
  txt(ctx, title, H.title.x + H.title.w / 2, H.title.y + H.title.h / 2, { size: 40, weight: 700, color: C.goldHi, align: 'center', serif: true, maxW: H.title.w, min: 20 });
}

// ---- shelf -------------------------------------------------------------------------------------------------------------------------------
function drawShelf(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const sc = scaleOf(S), SL = shelfLayout(w, h, sc, VESSELS.length), ks = Math.min(sc, 2.2);
  head(ctx, S, SL, 'The Shelf', sc);
  scrollBody(ctx, S, SL.body, () => {
    VESSELS.forEach((def, i) => {
      const r = SL.cards[i], rec = S.stats.v[def.id], V = buildVessel(def), mended = !!(rec && rec.stars);
      panel(ctx, r, { radius: 22, fill: C.panel, stroke: S.savedMap[def.id] ? C.gold : C.line, lw: S.savedMap[def.id] ? 2.5 : 1.5 });
      const ts = r.w * 0.66, cx = r.x + r.w / 2, cy = r.y + 18 + ts / 2 + 6;
      drawMended(ctx, V, cx, cy, ts * 0.92, S.t, mended ? Math.max(0.35, rec.best / 100) : 0, { alpha: mended ? 1 : 0.62, crackAlpha: mended ? 0.35 : 0.9, glints: mended });
      const ny = r.y + 18 + ts + 22 * ks;
      txt(ctx, def.name, cx, ny, { size: 27 * ks, weight: 700, color: C.text, align: 'center', serif: true, maxW: r.w - 20, min: 14 });
      if (mended) stars(ctx, cx, ny + 36 * ks, 20 * ks, rec.stars);
      else txt(ctx, `${def.N} shards`, cx, ny + 32 * ks, { size: 21 * ks, color: C.dim, align: 'center', maxW: r.w - 20, min: 12 });
      if (S.savedMap[def.id]) txt(ctx, 'In progress', cx, r.y + r.h - 20 * ks, { size: 18 * ks, weight: 700, color: C.gold, align: 'center', maxW: r.w - 20, min: 10 });
      else if (mended) txt(ctx, `Mend ${rec.best}%`, cx, r.y + r.h - 20 * ks, { size: 18 * ks, color: C.dim, align: 'center', maxW: r.w - 20, min: 10 });
      const f = flashOf(S, 'card' + i); if (f > 0) { rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = `rgba(255,230,160,${0.3 * f})`; ctx.fill(); }
    });
    return SL.contentH;
  });
}

// ---- documents ------------------------------------------------------------------------------------------------------------------------------
function drawDoc(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const sc = scaleOf(S), doc = DOCS[S.doc.kind], page = doc.pages[S.doc.page], DL = docLayout(w, h, sc), n = doc.pages.length;
  head(ctx, S, DL, doc.title, sc);
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: S.doc.page === 0, flash: flashOf(S, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: S.doc.page < n - 1 ? 'gold' : 'solid', disabled: S.doc.page >= n - 1, flash: flashOf(S, 'next') });
  txt(ctx, `${S.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: 26, weight: 600, color: C.dim, align: 'center' });
  const textBlock = (x, y, width) => {
    let yy = y;
    yy += para(ctx, page.title, x, yy, width, { size: 40 * sc, weight: 700, color: C.gold, serif: true, lh: 1.2 }) + 14 * sc;
    for (const b of page.body) {
      if (b.p) yy += para(ctx, b.p, x, yy, width, { size: 28 * sc, color: C.text, lh: 1.36 }) + 14 * sc;
      else if (b.h) yy += para(ctx, b.h, x, yy, width, { size: 32 * sc, weight: 700, color: C.text }) + 8 * sc;
      else if (b.note) { const hh = para(ctx, b.note, x + 18 * sc, yy + 12 * sc, width - 36 * sc, { size: 25 * sc, color: C.goldHi, lh: 1.32, draw: false }); rr(ctx, x, yy, width, hh + 24 * sc, 14); ctx.fillStyle = 'rgba(227,178,79,0.10)'; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke(); para(ctx, b.note, x + 18 * sc, yy + 12 * sc, width - 36 * sc, { size: 25 * sc, color: C.goldHi, lh: 1.32 }); yy += hh + 38 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = 27 * sc; ctx.beginPath(); ctx.arc(x + 9 * sc, yy + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = C.gold; ctx.fill();
        yy += para(ctx, it, x + 30 * sc, yy, width - 30 * sc, { size: sz, color: C.text, lh: 1.32 }) + 10 * sc;
      }
    }
    return yy - y + 24;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, DL.fig, page.fig, S);
    scrollBody(ctx, S, DL.text, () => textBlock(DL.text.x, DL.text.y, DL.text.w - 14));
  } else {
    scrollBody(ctx, S, DL.body, () => {
      let y = DL.body.y;
      if (page.fig) { const fh = Math.min(DL.body.w, Math.max(240, DL.body.h * (sc > 1.6 ? 0.4 : 0.52)), 520); drawFigure(ctx, { x: DL.body.x + (DL.body.w - fh) / 2, y, w: fh, h: fh }, page.fig, S); y += fh + 16; }
      return y - DL.body.y + textBlock(DL.body.x, y, DL.body.w - 14);
    });
  }
}

// ---- settings ---------------------------------------------------------------------------------------------------------------------------------
function drawSettings(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const sc = scaleOf(S), SL = settingsLayout(w, h, sc, SETTINGS.length), k = Math.min(sc, 2.4);
  head(ctx, S, SL, 'Settings', sc, { backLabel: S.back === 'play' ? 'Back' : 'Menu' });
  scrollBody(ctx, S, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i]; panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + 16 + 22 * k, { size: 28 * k, weight: 600, color: C.text, maxW: g.rect.w - 44, min: 14 });
      const n = row.opts.length, cw = (g.ctrl.w - 8 * (n - 1)) / n, cur = settingIndex(S, row.id);
      row.opts.forEach((o, j) => button(ctx, { x: g.ctrl.x + j * (cw + 8), y: g.ctrl.y, w: cw, h: g.ctrl.h }, o, { size: 26 * Math.min(k, 1.45), active: j === cur, radius: 14, kind: row.id === 'restore' ? 'gold' : 'solid', flash: flashOf(S, 'set' + i + '.' + j) }));
    });
    return SL.contentH;
  });
}

// ---- play ---------------------------------------------------------------------------------------------------------------------------------------
function drawGhost(ctx, V, def, P, mode, S) {
  const b = V.bounds;
  // soft table shadow under the vessel
  const sg = ctx.createRadialGradient(b.cx, b.y1, 4, b.cx, b.y1, b.w * 0.6); sg.addColorStop(0, 'rgba(0,0,0,.35)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  if (!V.disc) { ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(b.cx, b.y1 + 8, b.w * 0.55, 22, 0, 0, 7); ctx.fill(); }
  if (mode === 'off') return;
  ctx.save();
  if (mode === 'picture') {
    const art = getArt(V); if (art) { ctx.globalAlpha = 0.2; ctx.drawImage(art.c, art.ox, art.oy, art.w, art.h); ctx.globalAlpha = 1; }
  } else if (mode === 'slots') {
    path(ctx, V.sil); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.save(); ctx.clip();
    V.pieces.forEach((pc, i) => { if (P.pieces[i].placed) return; path(ctx, pc.poly.map(([x, y]) => [x + pc.hx, y + pc.hy])); ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fill(); ctx.strokeStyle = 'rgba(227,178,79,0.62)'; ctx.lineWidth = 2; ctx.stroke(); });
    ctx.restore();
  }
  path(ctx, V.sil); ctx.setLineDash([12, 9]); ctx.lineWidth = mode === 'outline' ? 3.2 : 2; ctx.strokeStyle = mode === 'outline' ? 'rgba(240,200,110,0.85)' : 'rgba(240,200,110,0.4)'; ctx.stroke(); ctx.setLineDash([]);
  if (V.open && mode !== 'slots') { ctx.beginPath(); ctx.ellipse(V.open.x, V.open.y, V.open.rx, V.open.ry, 0, 0, 7); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(240,200,110,0.3)'; ctx.stroke(); }
  ctx.restore();
}

function homeOutline(ctx, V, i, color, lw, fill) {
  const pc = V.pieces[i], poly = pc.poly.map(([x, y]) => [x + pc.hx, y + pc.hy]);
  ctx.save(); path(ctx, V.sil); ctx.clip(); path(ctx, poly);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}

function drawParts(ctx, S) {
  for (const p of S.parts) {
    const a = 1 - p.t / p.life;
    if (p.k === 'ring') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - a * a), 0, 7); ctx.lineWidth = 4 * a + 1; ctx.strokeStyle = `rgba(255,226,150,${a * 0.9})`; ctx.stroke(); }
    else if (p.k === 'glint') { const r = p.r * (0.4 + a); ctx.fillStyle = `rgba(255,248,214,${a})`; ctx.beginPath(); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x + r * 0.22, p.y - r * 0.22); ctx.lineTo(p.x + r, p.y); ctx.lineTo(p.x + r * 0.22, p.y + r * 0.22); ctx.lineTo(p.x, p.y + r); ctx.lineTo(p.x - r * 0.22, p.y + r * 0.22); ctx.lineTo(p.x - r, p.y); ctx.lineTo(p.x - r * 0.22, p.y - r * 0.22); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, 7); ctx.fillStyle = p.c === 'gold' ? `rgba(255,214,110,${a})` : `rgba(255,244,214,${a})`; ctx.fill(); }
  }
}

function drawPlay(ctx, S, w, h) {
  const P = S.P, def = vesselById(P.vid), V = buildVessel(def), L0 = playLayout(w, h, P.phase, def.N), L = P.phase === 'assemble' ? L0 : zoomLayout(L0, def.D, S.sceneT2), bd = L.board, u = S.u || 1;
  bench(ctx, w, h, S);
  // board surface
  rr(ctx, bd.x - 6, bd.y - 6, bd.w + 12, bd.h + 12, 26); ctx.fillStyle = '#080505'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(227,178,79,0.5)'; ctx.stroke();
  rr(ctx, bd.x, bd.y, bd.w, bd.h, 20); const bg = ctx.createRadialGradient(bd.x + bd.w * 0.5, bd.y + bd.h * 0.45, 40, bd.x + bd.w / 2, bd.y + bd.h / 2, Math.max(bd.w, bd.h) * 0.7); bg.addColorStop(0, '#2a201c'); bg.addColorStop(1, '#130e0d'); ctx.fillStyle = bg; ctx.fill();
  const pat = benchPattern(ctx); if (pat) { ctx.fillStyle = pat; ctx.fill(); }
  ctx.save(); rr(ctx, bd.x, bd.y, bd.w, bd.h, 20); ctx.clip(); ctx.translate(bd.x - bd.vx0 * bd.k, bd.y - bd.vy0 * bd.k); ctx.scale(bd.k, bd.k);
  const mode = P.phase === 'assemble' ? guideFor(S, def) : 'off';
  drawGhost(ctx, V, def, P, mode, S);
  // pieces that are in place
  let baked = 0;
  P.pieces.forEach((pc, i) => { if (pc.placed) drawPiece(ctx, V, i, pc.x, pc.y, 0, { shadow: 0 }); });
  if (P.phase !== 'assemble') {
    const ca = Math.min(1, S.sceneT2 * 1.2); drawCracks(ctx, V, ca);
    drawGold(ctx, V, P.seamQ, S.t, S.prefs.calm === false);
    if (P.phase === 'gild' && !S.auto.on && !S.hint) {   // pulse at the start of the next unfinished crack
      const si = P.seamDone.findIndex((d) => !d);
      if (si >= 0 && !P.brush) { const p = V.seams[si].pts[0], a = 0.5 + 0.5 * Math.sin(S.t * 3.2); ctx.beginPath(); ctx.arc(p[0], p[1], (10 + a * 8) * u, 0, 7); ctx.strokeStyle = `rgba(255,226,150,${0.35 + a * 0.4})`; ctx.lineWidth = 2.4 * u; ctx.stroke(); }
    }
    if (S.hint && S.hint.kind === 'seam') { const p = V.seams[S.hint.id].pts[0], a = 0.5 + 0.5 * Math.sin(S.t * 5); ctx.beginPath(); ctx.arc(p[0], p[1], (14 + a * 10) * u, 0, 7); ctx.strokeStyle = `rgba(255,236,170,${0.5 + a * 0.5})`; ctx.lineWidth = 3 * u; ctx.stroke(); drawSeamHL(ctx, V, S.hint.id, S.t); }
    if (P.brush || S.finger.down) {
      const bp = P.brush ? V.seams[P.brush.s].pts[P.brush.i] : null;
      if (S.finger.down && !S.auto.on) { ctx.beginPath(); ctx.arc(S.finger.x, S.finger.y, S.tolFull || 20, 0, 7); ctx.fillStyle = 'rgba(255,226,150,0.07)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,226,150,0.28)'; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
      if (bp) { const gl = ctx.createRadialGradient(bp[0], bp[1], 0, bp[0], bp[1], 26 * u); gl.addColorStop(0, 'rgba(255,248,214,0.95)'); gl.addColorStop(0.35, 'rgba(255,214,110,0.55)'); gl.addColorStop(1, 'rgba(255,190,70,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(bp[0], bp[1], 26 * u, 0, 7); ctx.fill(); }
    }
    if (S.winT > 0 && P.done) {   // polish sweep
      const t = 1 - S.winT / 3.2, b = V.bounds, x = b.x0 - 200 + (b.w + 400) * Math.min(1, t * 1.3);
      ctx.save(); path(ctx, V.sil); ctx.clip(); const sg = ctx.createLinearGradient(x - 90, 0, x + 90, 0); sg.addColorStop(0, 'rgba(255,248,220,0)'); sg.addColorStop(0.5, 'rgba(255,248,220,0.55)'); sg.addColorStop(1, 'rgba(255,248,220,0)'); ctx.fillStyle = sg; ctx.fillRect(b.x0 - 50, b.y0 - 80, b.w + 100, b.h + 160); ctx.restore();
    }
  }
  // loose pieces in z order
  const loose = P.pieces.map((pc, i) => [pc, i]).filter(([pc]) => !pc.placed).sort((p, q) => p[0].z - q[0].z);
  for (const [pc, i] of loose) {
    if (!bakedPiece(V, i)) baked++;
    const lift = S.drag && S.drag.i === i ? 1 : 0, anim = S.act && S.act.i === i ? 1 : 0;
    drawPiece(ctx, V, i, pc.x, pc.y, pc.a, { lift: Math.max(lift, anim * 0.8) });
    const info = snapInfo(V, def, P, i);
    if (S.prefs.glow && (S.drag?.i === i || P.sel === i) && info.warm > 0.04) homeOutline(ctx, V, i, info.ok ? 'rgba(255,240,170,0.98)' : `rgba(255,205,110,${0.15 + info.warm * 0.7})`, (info.ok ? 4 : 2.6) * u, info.ok ? 'rgba(255,226,140,0.22)' : null);
  }
  // selection ring + knob
  if (P.phase === 'assemble' && P.sel >= 0 && !P.pieces[P.sel].placed && !S.auto.on) {
    const i = P.sel, pc = P.pieces[i], kp = knobPos(V, P, i, u), R = kp.R;
    ctx.beginPath(); ctx.arc(pc.x, pc.y, R, 0, 7); ctx.lineWidth = 2.2 * u; ctx.strokeStyle = 'rgba(240,200,110,0.55)'; ctx.setLineDash([8 * u, 6 * u]); ctx.stroke(); ctx.setLineDash([]);
    const kr = 13 * u, kg = ctx.createRadialGradient(kp.x - kr * 0.3, kp.y - kr * 0.3, 1, kp.x, kp.y, kr); kg.addColorStop(0, '#fff2c0'); kg.addColorStop(0.6, '#e3b24f'); kg.addColorStop(1, '#8c5e1c');
    ctx.beginPath(); ctx.arc(kp.x, kp.y, kr, 0, 7); ctx.fillStyle = kg; ctx.fill(); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(60,34,8,0.8)'; ctx.stroke();
  }
  // hint overlays
  if (S.hint && S.hint.kind === 'piece') {
    const i = S.hint.id, pc = P.pieces[i], a = 0.5 + 0.5 * Math.sin(S.t * 5);
    if (!pc.placed) {
      ctx.beginPath(); ctx.arc(pc.x, pc.y, V.pieces[i].r + 8 * u + a * 4 * u, 0, 7); ctx.lineWidth = 3.2 * u; ctx.strokeStyle = `rgba(255,226,150,${0.55 + a * 0.4})`; ctx.setLineDash([14 * u, 9 * u]); ctx.lineDashOffset = -S.t * 40; ctx.stroke(); ctx.setLineDash([]);
      if (S.hint.stage === 'show') {
        homeOutline(ctx, V, i, `rgba(255,236,170,${0.7 + a * 0.3})`, 3.4 * u, `rgba(255,226,140,${0.12 + a * 0.16})`);
        const h = V.pieces[i]; ctx.beginPath(); ctx.moveTo(pc.x, pc.y); ctx.lineTo(h.hx, h.hy); ctx.setLineDash([6 * u, 10 * u]); ctx.lineWidth = 2 * u; ctx.strokeStyle = 'rgba(255,226,150,0.5)'; ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
  drawParts(ctx, S);
  ctx.restore();
  rr(ctx, bd.x, bd.y, bd.w, bd.h, 20); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.stroke();

  // header
  const nm = L.head;
  txt(ctx, def.name, nm.x + 8, nm.y + 22, { size: 36, weight: 700, color: C.goldHi, serif: true, maxW: nm.w - 8, min: 20 });
  txt(ctx, S.auto.on ? 'Watch and Learn' : def.jp, nm.x + 8, nm.y + 52, { size: 22, weight: 500, color: S.auto.on ? C.gold : C.dim, maxW: nm.w - 8, min: 12, italic: !S.auto.on });
  button(ctx, L.pause, '', { ico: S.paused ? 'play' : 'pause', size: 28, flash: flashOf(S, 'pause') });
  // reference card + status
  if (L.ref) {
    const r = L.ref; panel(ctx, r, { radius: 18, fill: '#1a1413' });
    drawMended(ctx, V, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) * 0.8, S.t, P.phase === 'assemble' ? 0 : 1, { cracks: false, shadow: false, glints: false });
    if (P.phase !== 'assemble') { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.restore(); }
  }
  drawStatus(ctx, S, L, def, V);
  // buttons
  const B = L.btn;
  if (S.auto.on) {
    const A = L.rail;
    button(ctx, A.exit, 'Exit', { size: 25, flash: flashOf(S, 'aexit') });
    button(ctx, A.pause, S.auto.paused ? 'Resume' : 'Pause', { size: 25, kind: 'gold', ico: S.auto.paused ? 'play' : 'pause', flash: flashOf(S, 'apause') });
    button(ctx, A.dec, 'Think -', { size: 24, disabled: S.prefs.thinkIdx === 0, flash: flashOf(S, 'adec') });
    button(ctx, A.inc, 'Think +', { size: 24, disabled: S.prefs.thinkIdx >= THINK_STEPS.length - 1, flash: flashOf(S, 'ainc') });
  } else {
    if (B.rotl) { button(ctx, B.rotl, '', { ico: 'rotl', size: 30, disabled: P.sel < 0, flash: flashOf(S, 'rotl') }); button(ctx, B.rotr, '', { ico: 'rotr', size: 30, disabled: P.sel < 0, flash: flashOf(S, 'rotr') }); }
    button(ctx, B.hint, 'Hint', { ico: 'hint', size: 26, flash: flashOf(S, 'hint'), active: !!S.hint });
    if (B.guide) button(ctx, B.guide, 'Guide', { sub: guideLabel(S, def), size: 26, flash: flashOf(S, 'guide') });
  }
  if (S.paused) drawPause(ctx, S, w, h);
}
const guideLabel = (S, def) => { const g = guideFor(S, def); return g[0].toUpperCase() + g.slice(1); };

function drawSeamHL(ctx, V, si, t) {
  const pts = V.seams[si].pts; ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.strokeStyle = `rgba(255,236,170,${0.35 + 0.25 * Math.sin(t * 5)})`; ctx.lineWidth = 12; ctx.stroke(); ctx.restore();
}

function drawStatus(ctx, S, L, def, V) {
  const P = S.P, r = L.status, land = L.mode === 'land';
  let line1, line2;
  if (P.phase === 'assemble') { line1 = `Shards in place: ${P.placedN} of ${P.pieces.length}`; line2 = S.msg ? S.msg.text : S.hint ? hintText(S) : P.sel >= 0 ? 'Drag the gold knob to turn the shard.' : 'Drag a shard to move it. Tap one to turn it.'; }
  else if (P.phase === 'gild') { const left = P.seamDone.filter((d) => !d).length; line1 = `Cracks left: ${left} of ${P.seamDone.length}`; line2 = S.msg ? S.msg.text : 'Slide slowly along a crack. Stay close to the line.'; }
  else { line1 = 'Mended'; line2 = `Mend ${mendPct(P)}%`; }
  if (S.auto.on && S.auto.text && !S.msg) line2 = S.auto.text;
  const fs = land ? 23 : 30;
  let y = r.y;
  y += para(ctx, line1, r.x, y, r.w, { size: fs, weight: 700, color: C.text, serif: true, lh: 1.25 }) + 6;
  if (P.phase === 'gild') { rr(ctx, r.x, y, r.w, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); rr(ctx, r.x, y, Math.max(10, r.w * gildProgress(P)), 10, 5); ctx.fillStyle = C.gold; ctx.fill(); y += 22; }
  ctx.save(); ctx.beginPath(); ctx.rect(r.x - 2, r.y, r.w + 4, r.h + 6); ctx.clip();
  para(ctx, line2, r.x, y, r.w, { size: land ? 22 : 25, weight: 400, color: S.msg || S.hint || S.auto.text ? C.goldHi : C.dim, lh: 1.3 });
  ctx.restore();
}
function hintText(S) {
  const h = S.hint; if (!h) return '';
  if (h.kind === 'seam') return 'Start here and slide along the crack.';
  return h.stage === 'look' ? 'This shard is the easiest to place next. Tap Hint again to see where it goes.' : 'It goes here. Tap Hint once more to place it for you.';
}

function drawPause(ctx, S, w, h) {
  ctx.fillStyle = 'rgba(6,4,4,0.72)'; ctx.fillRect(0, 0, w, h);
  const PL = pauseLayout(w, h);
  panel(ctx, PL.card, { radius: 28, fill: '#201816', stroke: C.lineHi, lw: 2 });
  txt(ctx, 'Paused', PL.card.x + PL.card.w / 2, PL.card.y + 42, { size: 40, weight: 700, color: C.goldHi, align: 'center', serif: true });
  button(ctx, PL.resume, 'Resume', { kind: 'gold', size: 30, ico: 'play', flash: flashOf(S, 'resume') });
  button(ctx, PL.restart, 'Restart vessel', { size: 28, ico: 'restart', flash: flashOf(S, 'restart') });
  button(ctx, PL.settings, 'Settings', { size: 28, flash: flashOf(S, 'psettings') });
  button(ctx, PL.menu, 'Menu (keep my work)', { size: 26, flash: flashOf(S, 'pmenu') });
}

// ---- result ---------------------------------------------------------------------------------------------------------------------------------------
function drawOver(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const sc = scaleOf(S), O = overLayout(w, h, sc), R0 = S.result, def = vesselById(R0.vid), V = buildVessel(def), k = Math.min(sc, 2.4);
  const col = O.col;
  scrollBody(ctx, S, col, () => {
    const land = O.land && col.w > 900;
    const hs = land ? Math.min(col.h * 0.88, col.w * 0.4) : Math.min(col.w * 0.8, col.h * 0.4, 560), cx = land ? col.x + col.w * 0.27 : col.x + col.w / 2, cy = land ? col.y + col.h / 2 : col.y + hs / 2 + Math.max(24, (col.h - hs - 430 * k) / 3);
    const gl = ctx.createRadialGradient(cx, cy, 10, cx, cy, hs * 0.85); gl.addColorStop(0, 'rgba(230,170,70,0.22)'); gl.addColorStop(1, 'rgba(230,170,70,0)'); ctx.fillStyle = gl; ctx.fillRect(cx - hs, cy - hs, hs * 2, hs * 2);
    drawMended(ctx, V, cx, cy, hs * 0.82, S.t, Math.max(0.4, R0.mend / 100));
    const tx = land ? col.x + col.w * 0.52 : col.x, tw = land ? col.w * 0.46 : col.w;
    let y = land ? col.y + Math.max(10, col.h / 2 - 190 * k) : cy + hs / 2 + 22;
    const ctr = land ? 'left' : 'center', ax = land ? tx : tx + tw / 2;
    txt(ctx, 'Mended', ax, y + 26 * k, { size: 52 * k, weight: 700, color: C.goldHi, align: ctr, serif: true, maxW: tw, min: 24 }); y += 62 * k;
    txt(ctx, `${def.name}  -  ${def.jp}`, ax, y + 12 * k, { size: 28 * k, color: C.text, align: ctr, maxW: tw, min: 14 }); y += 40 * k;
    stars(ctx, land ? tx + 60 * k : tx + tw / 2, y + 28 * k, 46 * k, R0.stars); y += 74 * k;
    y += para(ctx, def.line, tx, y, tw, { size: 27 * k, color: C.dim, italic: true, serif: true, align: land ? 'left' : 'center', lh: 1.35 }) + 12 * k;
    const lines = [`Mend ${R0.mend}%${R0.newBest ? '  -  new best' : ''}`, `Time ${fmtTime(R0.time)}   Hints ${R0.hints}`];
    for (const l of lines) { txt(ctx, l, ax, y + 16 * k, { size: 26 * k, color: C.text, align: ctr, maxW: tw, min: 14 }); y += 40 * k; }
    return Math.max(land ? col.h : 0, y - col.y + 10);
  });
  const nextIdx = Math.min(VESSELS.length - 1, VESSELS.findIndex((v) => v.id === def.id) + 1), last = def.id === VESSELS[VESSELS.length - 1].id;
  button(ctx, O.btns.next, last ? 'Mend again' : 'Next vessel', { kind: 'gold', size: 26, flash: flashOf(S, 'next') });
  button(ctx, O.btns.menu, 'Shelf', { size: 26, flash: flashOf(S, 'menu') });
  button(ctx, O.btns.share, 'Share', { size: 26, flash: flashOf(S, 'share') });
  void nextIdx;
}

function drawDemoLimit(ctx, S, w, h) {
  bench(ctx, w, h, S);
  const u = usable(w, h), cw = Math.min(640, u.w - 40), x = u.x0 + (u.w - cw) / 2, y = u.y0 + u.h * 0.28;
  panel(ctx, { x, y, w: cw, h: 400 }, { radius: 28, fill: '#201816', stroke: C.lineHi, lw: 2 });
  txt(ctx, 'That is the demo', x + cw / 2, y + 70, { size: 42, weight: 700, color: C.goldHi, align: 'center', serif: true, maxW: cw - 40, min: 20 });
  para(ctx, 'You have mended three vessels. Get the full Kintsugi on iPhone and Android for all twelve vessels, saved progress and no limits.', x + 36, y + 120, cw - 72, { size: 28, color: C.text, align: 'center', lh: 1.4 });
  txt(ctx, 'Tap to return to the menu', x + cw / 2, y + 350, { size: 24, color: C.dim, align: 'center' });
}

// ---- figures: real art, used by Rules / How to Play / About ---------------------------------------------------------------------------------------
function miniScene(ctx, r, V, fn) {
  ctx.save(); ctx.beginPath(); rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.clip();
  const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.45, 10, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8); g.addColorStop(0, '#2a201c'); g.addColorStop(1, '#130e0d'); ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  const s = Math.min(r.w, r.h) / (V.def.D * (V.def.D > 460 ? 1.4 : 1.5));
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2); ctx.scale(s, s); ctx.translate(-V.bounds.cx, -V.bounds.cy);
  fn(ctx, s);
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.lineWidth = 1.5; ctx.strokeStyle = C.line; ctx.stroke();
}
export function drawFigure(ctx, r, name, S) {
  if (!name) return;
  const t = S.t;
  const put = (V, i, x, y, a, o) => drawPiece(ctx, V, i, x, y, a, o);
  if (name.startsWith('vessel:')) {
    const V = buildVessel(vesselById(name.slice(7)));
    miniScene(ctx, r, V, (g, s) => { const art = getArt(V); if (art) g.drawImage(art.c, art.ox, art.oy, art.w, art.h); drawCracks(g, V, 0.5); drawGold(g, V, fullQ(V, 0.95), t, true); });
    return;
  }
  if (name === 'shelf') {
    const ids = ['chawan', 'plate', 'tokkuri', 'moonjar'], n = ids.length, cw = r.w / 2 - 6;
    ids.forEach((id, i) => { const V = buildVessel(vesselById(id)), rr0 = { x: r.x + (i % 2) * (cw + 12), y: r.y + Math.floor(i / 2) * (r.h / 2 + 2), w: cw, h: r.h / 2 - 8 }; panel(ctx, rr0, { radius: 16, fill: '#1c1514' }); drawMended(ctx, V, rr0.x + rr0.w / 2, rr0.y + rr0.h / 2, Math.min(rr0.w, rr0.h) * 0.78, t, i < 2 ? 0.9 : 0, { alpha: i < 2 ? 1 : 0.7 }); });
    void n; return;
  }
  const V = buildVessel(vesselById('chawan')), def = V.def;
  if (name === 'shard' || name === 'rotate' || name === 'snap' || name === 'hint' || name === 'guides') {
    if (name === 'guides') {
      const modes = ['picture', 'outline', 'slots'], cw = (r.w - 24) / 3;
      modes.forEach((m, i) => { const rr0 = { x: r.x + i * (cw + 12), y: r.y + r.h * 0.12, w: cw, h: cw * 1.25 }; const Q = buildVessel(vesselById('chawan')); miniScene(ctx, rr0, Q, (g) => { const P = { pieces: Q.pieces.map((_, k) => ({ placed: k === 0 })) }; drawGhost(g, Q, Q.def, P, m, S); drawPiece(g, Q, 0, Q.pieces[0].hx, Q.pieces[0].hy, 0, { shadow: 0 }); }); txt(ctx, m[0].toUpperCase() + m.slice(1), rr0.x + rr0.w / 2, rr0.y + rr0.h + 26, { size: 24, color: C.dim, align: 'center' }); });
      return;
    }
    miniScene(ctx, r, V, (g, s) => {
      const P = { pieces: V.pieces.map((_, i) => ({ placed: i < 3 })) };
      drawGhost(g, V, def, P, 'slots', S);
      V.pieces.forEach((pc, i) => { if (i < 3) drawPiece(g, V, i, pc.hx, pc.hy, 0, { shadow: 0 }); });
      const pc = V.pieces[3], u = 1 / (s * 0.9);
      if (name === 'snap') { const wob = Math.sin(t * 2) * 6; put(V, 3, pc.hx + 30 + wob, pc.hy - 18, 0.12, { lift: 1 }); homeOutline(g, V, 3, 'rgba(255,214,120,0.9)', 3 * u, 'rgba(255,226,140,0.2)'); }
      else if (name === 'hint') { const a = 0.5 + 0.5 * Math.sin(t * 5); const lx = V.bounds.cx + 190, ly = V.bounds.cy + 205; put(V, 3, lx, ly, -0.3, {}); g.beginPath(); g.arc(lx, ly, pc.r + 10, 0, 7); g.strokeStyle = `rgba(255,226,150,${0.6 + a * 0.4})`; g.lineWidth = 3 * u; g.setLineDash([12, 8]); g.stroke(); g.setLineDash([]); homeOutline(g, V, 3, 'rgba(255,236,170,0.9)', 3 * u, 'rgba(255,226,140,0.2)'); }
      else {
        const ang = name === 'rotate' ? Math.sin(t * 1.4) * 0.6 : 0.5, cx = V.bounds.cx + 175, cy = V.bounds.cy + 205;
        put(V, 4, V.bounds.cx - 185, V.bounds.cy + 205, 0.3, {});
        put(V, 3, cx, cy, ang, { lift: 1 });
        const R = pc.r + 14 * u; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.strokeStyle = 'rgba(240,200,110,0.6)'; g.lineWidth = 2.2 * u; g.setLineDash([8 * u, 6 * u]); g.stroke(); g.setLineDash([]);
        const ka = ang - Math.PI / 2, kx = cx + Math.cos(ka) * R, ky = cy + Math.sin(ka) * R; g.beginPath(); g.arc(kx, ky, 13 * u, 0, 7); g.fillStyle = '#e3b24f'; g.fill(); g.strokeStyle = 'rgba(60,34,8,0.8)'; g.lineWidth = 1.6 * u; g.stroke();
      }
    });
    return;
  }
  if (name === 'gold' || name === 'quality') {
    const Vq = buildVessel(vesselById('tokkuri'));
    miniScene(ctx, r, Vq, (g) => {
      const art = getArt(Vq); if (art) g.drawImage(art.c, art.ox, art.oy, art.w, art.h);
      drawCracks(g, Vq, 1);
      const Q = Vq.seams.map((s, si) => s.pts.map((p, k) => (name === 'quality' ? (si % 3 === 0 ? 0.25 : si % 3 === 1 ? 0.6 : 0.98) : k < s.pts.length * (0.25 + 0.5 * ((si * 37) % 10) / 10) ? 0.95 : 0)));
      drawGold(g, Vq, Q, t, true);
      if (name === 'gold') { const s0 = Vq.seams[2], k = Math.floor(((t * 0.3) % 1) * s0.pts.length), p = s0.pts[k]; const gl = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], 30); gl.addColorStop(0, 'rgba(255,248,214,.95)'); gl.addColorStop(1, 'rgba(255,190,70,0)'); g.fillStyle = gl; g.beginPath(); g.arc(p[0], p[1], 30, 0, 7); g.fill(); }
    });
  }
}

// ---- entry ------------------------------------------------------------------------------------------------------------------------------------------------
export function render(ctx, S, view) {
  const w = view.width, h = view.height;
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, w, h); break;
    case 'shelf': drawShelf(ctx, S, w, h); break;
    case 'play': drawPlay(ctx, S, w, h); break;
    case 'over': drawOver(ctx, S, w, h); break;
    case 'doc': drawDoc(ctx, S, w, h); break;
    case 'settings': drawSettings(ctx, S, w, h); break;
    case 'demo-limit': drawDemoLimit(ctx, S, w, h); break;
    default: bench(ctx, w, h, S);
  }
  if (S.msg && S.scene !== 'play') {
    const a = Math.min(1, S.msg.t * 6, (S.msg.hold - S.msg.t) * 4), u = usable(w, h);
    ctx.save(); ctx.globalAlpha = Math.max(0, a); const tw = Math.min(u.w - 40, 560); rr(ctx, u.x0 + (u.w - tw) / 2, u.y1 - 150, tw, 66, 18); ctx.fillStyle = 'rgba(32,24,20,0.95)'; ctx.fill(); ctx.strokeStyle = C.lineHi; ctx.stroke();
    txt(ctx, S.msg.text, u.x0 + u.w / 2, u.y1 - 117, { size: 25, color: C.goldHi, align: 'center', maxW: tw - 30, min: 14 }); ctx.restore();
  }
}
void pip; void dropBakes; void icon; void rgba;
