// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { toolsFor, playLayout, titleLayout, docLayout, settingsLayout, pickLayout, galleryLayout, shapeLayout, showLayout, backFooter, pauseLayout, centerCard, playOpts, TEXT_SCALES, host, R, clamp, grid } from './layout.js';
import { v3 } from './v3.js';
import { theme, LOOKS, embossText, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, F, rgba, icons, DISPLAY, UI } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke } from './brand.js';
import { drawPiece, drawPieceOverlay, fitRect, drawJar, drawScene, stockWheels, stockPanel, stockYoke, thumbDesign, PAINT, drawMark } from './art.js';
import { pieceOf, potLeft, COLOR_NAME } from './puzzle.js';
import { CAMPAIGN, SETS, FREE_SHAPES } from './commissions.js';
import { docOf } from './content.js';

export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Side panel', opts: ['Right', 'Left'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'marks', label: 'Colour marks', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
// Rows shown for this state: Restore is hidden in the web demo (nothing can be bought there); its label follows ownership / busy.
export const settingsRows = (s) => SETTINGS.filter((r) => r.id !== 'restore' || !s.demo).map((r) => (r.id === 'restore' ? { ...r, opts: [s.restoreBusy ? 'Checking...' : s.owned ? 'Full game unlocked' : 'Restore purchase'] } : r));
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'hand': return p.hand === 'left' ? 1 : 0;
    case 'timer': return p.timer ? 0 : 1;
    case 'marks': return p.marks ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
export const fmtTime = (t) => { const x = Math.floor(t); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);
export const boardRect = (l, piece) => fitRect(piece, l.board);
const starsRow = (ctx, x, y, size, n, gap = 4) => { for (let k = 0; k < 3; k++) icons.star(ctx, x + k * (size + gap) + size / 2, y, size, k < n ? '#ffc93c' : 'rgba(128,128,128,0.35)'); };

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  v3.panels.length = 0; v3.buttons.length = 0; v3.jars.length = 0; v3.scrim = 0; v3.clip = null; v3.off = 0; v3.req = null; v3.w = w; v3.h = h;
  background(ctx, w, h, s.t, s.prefs.calm);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'pick') drawPick(ctx, s, w, h);
  else if (sc === 'shapes') drawShapes(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'gallery') drawGallery(ctx, s, w, h);
  else if (sc === 'show') drawShow(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = `rgba(0,0,0,${0.7 * (1 - smooth(s.sceneT / 0.25))})`; ctx.fillRect(0, 0, w, h); }
  if (v3.on && v3.present) { try { v3.present(w, h, s); } catch (e) { console.warn('3D present failed', e); v3.on = false; } }
  void T;
}

// ================================================================ figures (menu, Rules, About) ===================================================
// A wheel that paints itself, one stroke at a time, then the next design.
function paintingWheel(ctx, rect, t, calm, extra = {}) {
  const ds = stockWheels(), step = 0.13, hold = 2.8;
  const dur = (d) => d.P.orbits.length * step + hold;
  let tt = t, k = 0;
  while (tt > dur(ds[k % ds.length])) { tt -= dur(ds[k % ds.length]); k += 1; }
  const d = ds[k % ds.length], order = d.P.orbits.map((_, i) => i).sort((x, y) => (d.P.orbits[x].ring - d.P.orbits[y].ring) || (x - y));
  const rank = new Map(order.map((o, i) => [o, i]));
  const a = d.a.map((c, o) => ((tt - rank.get(o) * step) >= 0 ? c : ''));
  const pop = d.P.cells.map((c) => tt - rank.get(c.orbit) * step);
  const o = { pop, rot: calm ? 0 : t * 0.12, t, ...extra };
  if (v3.on && !extra.flat) {
    let ok = false;
    try { ok = v3.setPiece({ P: d.P, a, rect, pop, rot: o.rot, t, hero: true }, v3.w, v3.h); } catch (e) { console.warn('3D piece failed', e); v3.on = false; }
    if (ok) return;
  }
  drawPiece(ctx, d.P, a, rect, o);
}
export function drawFigure(ctx, r, fig, t) {
  const T = theme(), S = Math.min(r.w, r.h) * 0.92, x = r.x + (r.w - S) / 2, y = r.y + (r.h - S) / 2, box = R(x, y, S, S);
  const wheel = stockWheels()[fig.i ?? 0];
  if (fig.k === 'wheel') drawPiece(ctx, wheel.P, wheel.a, box, { t, rot: 0 });
  else if (fig.k === 'wheel-bare') drawPiece(ctx, wheel.P, wheel.a.map(() => ''), box, { t });
  else if (fig.k === 'wheel-clash') {
    const a = wheel.a.slice(); const e = wheel.P.edges.find((q) => q.oa !== q.ob); a[e.ob] = a[e.oa];
    const conflicts = wheel.P.edges.map((q, i) => (a[q.oa] && a[q.oa] === a[q.ob] ? i : -1)).filter((i) => i >= 0);
    drawPiece(ctx, wheel.P, a, box, { t, conflicts });
  } else if (fig.k === 'wheel-set') {
    const hi = new Set([wheel.P.cells[Math.min(5, wheel.P.cells.length - 1)].orbit]);
    drawPiece(ctx, wheel.P, wheel.a, box, { t, hi });
  } else if (fig.k === 'panel') { const p = stockPanel(); drawPiece(ctx, p.P, p.a, fitRect(p.P, R(r.x, y, r.w, S)), { t }); }
  else if (fig.k === 'yoke') { const p = stockYoke(); drawPiece(ctx, p.P, p.a, fitRect(p.P, R(r.x, y + S * 0.2, r.w, S * 0.6)), { t }); }
  else if (fig.k === 'jars') {
    const cols = ['red', 'yellow', 'blue', 'green', 'orange', 'white'], jw = r.w / 6;
    cols.forEach((c, i) => drawJar(ctx, R(r.x + i * jw + 4, r.y + (r.h - jw * 1.3) / 2, jw - 8, jw * 1.3), c, [0.9, 0.6, 0.4, 0.75, 0.25, 0.5][i], { count: [8, 5, 4, 7, 3, 6][i], dark: T.dark }));
  } else if (fig.k === 'cart') {
    drawScene(ctx, R(r.x, r.y + (r.h - Math.min(r.h, r.w * 0.62)) / 2, r.w, Math.min(r.h, r.w * 0.62)), 0.9, { P: wheel.P, a: wheel.a, kind: 'wheel', t, x: (t * 0.8) % 30 - 15, moving: true });
  } else if (fig.k === 'stars') { for (let k = 0; k < 3; k++) icons.star(ctx, x + S / 2 + (k - 1) * S * 0.3, y + S / 2, S * 0.28, '#ffc93c'); }
}

// ================================================================ title ====================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(170, Math.max(74, H * 0.3)), gs = Math.max(90, Math.min(hero.w * (v3.on ? 0.92 : 0.72), H - tb - 16, 560));
  const x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
  paintingWheel(ctx, R(x0, y0, gs, gs), s.t, s.prefs.calm);
  const cx = hero.x + hero.w / 2, ty = y0 + gs + tb * 0.34;
  if (v3.on) {
    embossText(ctx, 'COSTA RICAN', cx, ty, { size: tb * 0.22, maxW: hero.w * 0.92, color: '#ffd978', edge: '#6a2a0c', hi: '#fff6d0' });
    embossText(ctx, 'PAINTED OXCART', cx, ty + tb * 0.4, { size: tb * 0.36, maxW: hero.w * 0.98, color: '#fff3d2', edge: '#8a2a12' });
  } else {
    txt(ctx, 'COSTA RICAN', cx, ty, { size: tb * 0.22, weight: 700, color: T.accent, align: 'center', maxW: hero.w * 0.92, min: 14 });
    txt(ctx, 'PAINTED OXCART', cx, ty + tb * 0.36, { size: tb * 0.34, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 20, face: DISPLAY, weight: 400 });
  }
  if (v3.on) panel(ctx, R(hero.x + hero.w * 0.02, ty - tb * 0.34, hero.w * 0.96, tb * 0.98), { radius: 22, fill: 'rgba(0,0,0,0.28)' });
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${s.saved.title}  ·  ${fmtTime(s.saved.t)}` : ''],
    play: ['Commissions', '24 pieces to paint'], daily: ['Daily Commission', s.dailyInfo],
    free: ['Free Painting', ''], gallery: ['Gallery', ''], learn: ['Watch and Learn', ''], stats: ['Progress', ''], howto: ['How to Play', ''], rules: ['Rules', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star', free: 'brush', gallery: 'save' };
  for (const id of Object.keys(B)) {
    const prim = id === 'continue' || id === 'play' || id === 'daily', r = B[id];
    button(ctx, r, lab[id][0], { kind: id === 'play' || id === 'continue' ? 'accent' : 'solid', size: prim ? 32 : 24, sub: prim ? lab[id][1] : '', radius: 20, flash: flashOf(s, id), icon: prim ? '' : (iconOf[id] ?? '') });
    if (id === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ headers and scrolling ============================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(40), color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 18, face: DISPLAY, weight: 400 });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  v3.clip = { x: rect.x - 6, y: rect.y, w: rect.w + 12, h: rect.h }; v3.off = -s.scrollY;
  const ch = draw();
  v3.clip = null; v3.off = 0;
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}

// ================================================================ commission list ==================================================================
export function pickItems() {
  const items = [];
  SETS.forEach((set, si) => {
    items.push({ t: 'h', label: set.name, sub: set.blurb });
    for (const c of CAMPAIGN.filter((x) => x.set === si)) items.push({ t: 'c', id: c.id, c, label: c.title, sub: `${c.n}. ${c.geom.kind === 'wheel' ? 'Wheel' : c.geom.kind === 'panel' ? 'Side panel' : 'Yoke'} · ${c.nc} colours` });
  });
  return items;
}
function drawPick(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), items = pickItems(), PL = pickLayout(w, h, items, sc);
  header(ctx, s, PL, 'Commissions');
  scrollBody(ctx, s, PL.body, () => {
    items.forEach((it, i) => {
      const r = PL.rects[i];
      if (it.t === 'h') { txt(ctx, it.label, r.x + 4, r.y + r.h * 0.36, { size: F(28) * Math.min(sc, 1.5), color: T.accent, face: DISPLAY, weight: 400, maxW: r.w - 8, min: 14 }); txt(ctx, it.sub, r.x + 4, r.y + r.h * 0.84, { size: F(20) * Math.min(sc, 1.4), weight: 500, color: T.dim, maxW: r.w - 8, min: 11 }); return; }
      const st = s.stats.stars[it.id] ?? 0, done = s.stats.done[it.id] ?? 0;
      panel(ctx, r, { radius: 22 });
      const th = Math.min(r.h - 24, 100), tr = R(r.x + 14, r.y + (r.h - th) / 2, th, th), Pc = pieceOf(it.c.geom);
      drawPiece(ctx, Pc, done ? Pc.orbits.map((_, k) => thumbDesign(Pc, it.c.nc)[k]) : thumbDesign(Pc, it.c.nc), tr, { dark: T.dark });
      const tx = tr.x + th + 16, tw = r.x + r.w - 16 - tx;
      txt(ctx, it.label, tx, r.y + r.h * 0.3, { size: F(30) * Math.min(sc, 1.4), weight: 700, color: T.text, maxW: tw, min: 15 });
      txt(ctx, it.sub, tx, r.y + r.h * 0.56, { size: F(21) * Math.min(sc, 1.4), weight: 500, color: T.dim, maxW: tw, min: 11 });
      if (done) starsRow(ctx, tx, r.y + r.h * 0.8, 24, st);
      else txt(ctx, 'New', tx, r.y + r.h * 0.8, { size: F(20) * Math.min(sc, 1.4), weight: 600, color: T.accent, maxW: tw, min: 11 });
    });
    return PL.contentH;
  });
  button(ctx, PL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawShapes(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = shapeLayout(w, h, FREE_SHAPES.length, sc);
  header(ctx, s, SL, 'Free Painting');
  scrollBody(ctx, s, SL.body, () => {
    FREE_SHAPES.forEach((sh, i) => {
      const c = SL.cards[i], Pc = pieceOf(sh.geom);
      panel(ctx, c, { radius: 22 });
      drawPiece(ctx, Pc, thumbDesign(Pc, 6), R(c.x + 14, c.y + 12, c.w - 28, c.h - 70), { dark: T.dark });
      txt(ctx, sh.name, c.x + c.w / 2, c.y + c.h - 30, { size: F(26) * Math.min(sc, 1.4), weight: 700, color: T.text, align: 'center', maxW: c.w - 20, min: 12 });
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ play =============================================================================
function drawPlay(ctx, s, w, h) {
  const T = theme(), L = playLayout(w, h, playOpts(s)), ch = s.ch, Pc = ch.piece;
  const rect = boardRect(L, Pc);
  const hi = new Set(), sel = new Set();
  if (s.hint?.step) hi.add(s.hint.step.o);
  if (s.press >= 0) sel.add(s.press);
  if (s.cursor >= 0 && !s.auto.on) sel.add(s.cursor);
  let in3 = false;
  if (v3.on) {
    try { in3 = v3.setPiece({ P: Pc, a: s.a, rect, pop: s.pop, hi, sel, given: new Set(ch.given), rot: 0, t: s.t, pick: s.erase ? '' : s.pick }, w, h); } catch (e) { console.warn('3D piece failed', e); v3.on = false; }
  }
  if (in3) drawPieceOverlay(ctx, Pc, s.a, rect, { marks: s.prefs.marks, conflicts: s.ev.conflicts });
  else drawPiece(ctx, Pc, s.a, rect, { pop: s.pop, hi, sel, conflicts: s.ev.conflicts, marks: s.prefs.marks, given: new Set(ch.given), t: s.t, dark: T.dark });
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  drawHud(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; drawSide(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) { drawSide(ctx, s, L, true); drawAutoCard(ctx, s, L); }
  else if (s.hint) { drawSide(ctx, s, L, true); drawCoach(ctx, s, L); }
  else drawSide(ctx, s, L);
  drawMsg(ctx, s, L);
}
function drawHud(ctx, s, L) {
  const T = theme(), ch = s.ch, hud = L.hud, stacked = L.mode === 'stacked', kind = ch.piece.kind;
  txt(ctx, ch.title, hud.x, hud.y + 28, { size: F(stacked ? 34 : 30), color: T.text, maxW: hud.w - 130, min: 16, face: DISPLAY, weight: 400 });
  const nm = kind === 'wheel' ? 'Wheel' : kind === 'panel' ? 'Side panel' : 'Yoke';
  const sub = [ch.mode === 'free' ? 'Free painting' : nm, s.prefs.timer && !s.auto.on ? fmtTime(s.secs) : s.auto.on ? 'Watch and Learn' : ''].filter(Boolean).join('  ·  ');
  txt(ctx, sub, hud.x, hud.y + 62, { size: F(22), weight: 500, color: T.dim, maxW: hud.w - 130, min: 12 });
  button(ctx, L.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
}
function drawSide(ctx, s, L, dimBrief = false) {
  if (!dimBrief) drawBrief(ctx, s, L);
  drawPots(ctx, s, L);
  drawTools(ctx, s, L);
}
function drawBrief(ctx, s, L) {
  const T = theme(), ch = s.ch, r = L.brief, ev = s.ev;
  panel(ctx, r, { radius: 22, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.24 : 0.5) });
  edgeStroke(ctx, r, 22, 0.3);
  const pad = 16;
  if (ch.mode === 'free') {
    const t = s.erase ? 'Eraser on: tap a segment to scrape it bare.' : 'Choose a paint, then tap or drag across the piece. One stroke paints every matching segment. There are no rules here, and the pots never run out. Save hangs your piece in the Gallery.';
    let fz = F(24);
    while (fz > 12 && paraHeight(ctx, t, r.w - 2 * pad, fz, 500, 1.28) > r.h - 2 * pad) fz -= 1;
    para(ctx, t, r.x + pad, r.y + pad, r.w - 2 * pad, { size: fz, weight: 500, color: T.dim, lh: 1.28 });
    return;
  }
  const inner = R(r.x + pad, r.y + pad, r.w - 2 * pad, r.h - 2 * pad), head = F(24);
  txt(ctx, 'Brief', inner.x, inner.y + head * 0.5, { size: head, weight: 700, color: T.accent });
  const done = ev.items.filter((i) => i.ok).length;
  txt(ctx, `${done} of ${ev.items.length}`, inner.x + inner.w, inner.y + head * 0.5, { size: head, weight: 600, color: T.dim, align: 'right' });
  const top = inner.y + head + 10, avail = inner.h - head - 10;
  let fs = F(30);
  const lines = ev.items.map((it) => it.text + (it.detail ? `  (${it.detail})` : ''));
  const heightFor = (sz) => lines.reduce((acc, t) => acc + Math.max(sz * 1.3, paraHeight(ctx, t, inner.w - 40, sz, 600, 1.2)) + 7, 0);
  while (fs > 12 && heightFor(fs) > avail) fs -= 1;
  let y = top;
  ev.items.forEach((it, i) => {
    const hh = Math.max(fs * 1.3, paraHeight(ctx, lines[i], inner.w - 40, fs, 600, 1.2));
    ctx.beginPath(); ctx.arc(inner.x + 14, y + fs * 0.65, Math.min(14, fs * 0.55), 0, 7); ctx.fillStyle = it.ok ? T.good : 'rgba(128,128,128,0.3)'; ctx.fill();
    if (it.ok) icons.check(ctx, inner.x + 14, y + fs * 0.65, Math.min(22, fs * 0.9), '#06241a'); else icons.exit(ctx, inner.x + 14, y + fs * 0.65, Math.min(14, fs * 0.55), T.dim);
    para(ctx, lines[i], inner.x + 40, y, inner.w - 40, { size: fs, weight: 600, color: it.ok ? T.text : T.dim, lh: 1.2 });
    y += hh + 7;
  });
}
function drawPots(ctx, s, L) {
  const T = theme(), ch = s.ch, lf = potLeft(ch, s.a), hintC = s.hint?.step?.kind === 'place' ? s.hint.step.c : '';
  ch.colors.forEach((c, i) => {
    const r = L.potRects[i], total = ch.pots[c], have = lf[c];
    const frac = total === null ? 1 : total <= 0 ? 0 : have / total;
    if (hintC === c) { rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 16); ctx.fillStyle = rgba('#ffe27a', 0.35 + 0.2 * Math.sin(s.t * 6)); ctx.fill(); }
    drawJar(ctx, r, c, frac, { sel: s.pick === c && !s.erase, empty: total !== null && have <= 0, count: total === null ? null : have, shake: s.shake?.c === c ? 1 : 0, t: s.t, dark: T.dark });
    if (r.w > 60) txt(ctx, String(i + 1), r.x + 8, r.y + r.h * 0.2, { size: F(16), weight: 700, color: T.dim, base: 'middle' });
  });
}
const TOOL_DEF = { undo: ['Undo', 'undo'], redo: ['Redo', 'redo'], erase: ['Eraser', 'erase'], hint: ['Hint', 'bulb'], clear: ['Clear', 'exit'], save: ['Save', 'save'] };
function drawTools(ctx, s, L) {
  const T = theme(), ids = toolsFor(s.ch);
  L.toolRects.forEach((r, i) => {
    const id = ids[i], [label, icon] = TOOL_DEF[id];
    const dis = (id === 'undo' && !s.un.length) || (id === 'redo' && !s.re.length), on = id === 'erase' && s.erase, hint = id === 'hint';
    const in3 = v3.on && ctx.globalAlpha > 0.9;
    if (in3) v3.buttons.push({ r: { x: r.x, y: r.y + v3.off, w: r.w, h: r.h }, rad: 18, accent: hint, active: on, disabled: dis, flash: flashOf(s, id), clip: v3.clip });
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    if (!in3) {
      rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = hint ? T.accent : on ? rgba(T.accent, 0.28) : T.btn; ctx.fill();
      const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
      ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? T.accent : hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    }
    const col = hint ? T.onAccent : T.text;
    if (r.h >= 56 && r.w >= 58) {
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.38, Math.min(r.h * 0.42, r.w * 0.5, 42), col);
      txt(ctx, label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(18), weight: 600, color: col, align: 'center', maxW: r.w - 6, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 34), col);
    ctx.restore();
  });
}
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#0a0604' : '#ffffff', T.dark ? 0.78 : 0.86) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 18, w = C.w - 36, ts = F(C.h > 300 ? 30 : 26), chip = hnt.stage === 'look' ? 'Where to look' : 'Why it works';
  txt(ctx, hnt.step.kind === 'stuck' ? 'Hint: dead end' : 'Hint', x, C.y + 12 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w * 0.6, min: 16 });
  txt(ctx, chip, x + w, C.y + 12 + ts * 0.6, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: w * 0.4, min: 11 });
  const bodyTop = C.y + 12 + ts * 1.5, bodyH = B.close.y - 8 - bodyTop;
  let size = F(C.w > 520 ? 26 : 23);
  while (size > 12 && paraHeight(ctx, hnt.text, w, size, 600, 1.26) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, w, { size, weight: 600, color: T.text, lh: 1.26 });
  button(ctx, B.close, 'Close', { size: 26, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : hnt.step.kind === 'stuck' ? 'Scrape it' : 'Paint it', { kind: 'accent', size: 26, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoCard(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint, T0 = L.coachText;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#0a0604' : '#ffffff', T.dark ? 0.78 : 0.86) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 18, w = C.w - 36, ts = F(C.h > 300 ? 28 : 24);
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Thinking: where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'Finished' : 'Next stroke';
  txt(ctx, a.done ? 'Done' : `Stroke ${a.n}`, x, T0.y + 10 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w * 0.4, min: 16 });
  txt(ctx, phase, x + w, T0.y + 10 + ts * 0.6, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: w * 0.58, min: 11 });
  const bodyTop = T0.y + 10 + ts * 1.5, bodyH = T0.y + T0.h - bodyTop - 24;
  const text = hnt?.text ?? (a.done ? 'The piece is finished. Tap Exit to go back to the menu.' : 'Looking for the next stroke.');
  let size = F(C.w > 520 ? 25 : 22);
  while (size > 12 && paraHeight(ctx, text, w, size, 600, 1.26) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, w, { size, weight: 600, color: T.text, lh: 1.26 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 24, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 24, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 24, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 24, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + 18, L.rail.exit.y - 14, { size: F(17), weight: 600, color: T.dim });
}
function drawPaused(ctx, s, L) {
  const T = theme(), area = L.board, pl = pauseLayout(L.F.w, L.F.h, area);
  ctx.fillStyle = rgba(T.dark ? '#000000' : '#442a10', 0.7); rr(ctx, area.x, area.y, area.w, area.h, 18); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(30,18,10,0.97)' : 'rgba(255,250,240,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 42, { size: F(38), color: T.text, align: 'center', face: DISPLAY, weight: 400 });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 28, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Start over', { size: 26, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 26, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 26, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), bw = Math.min(L.board.w - 30, 560), cx = L.board.x + L.board.w / 2;
  const size = F(24), lines = wrap(ctx, m.text, bw - 36, size, 600), hh = lines.length * size * 1.22 + 22, y = L.board.y + 10;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx - bw / 2, y, bw, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,6,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx - bw / 2 + 18, y + 11, bw - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ docs ===============================================================================
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = docOf(s.doc), page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s), n = doc.pages.length;
  header(ctx, s, DL, doc.title);
  button(ctx, DL.menu, 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
  button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
  txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  const drawText = (top, width, x) => {
    let y = top;
    y += para(ctx, page.title, x, y, width, { size: F(36) * sc, weight: 400, color: T.accent, lh: 1.2 }) + 18 * sc;
    for (const b of page.body) {
      if (b.p) y += para(ctx, b.p, x, y, width, { size: F(27) * sc, weight: 500, color: T.text, lh: 1.34 }) + 14 * sc;
      else if (b.h) y += para(ctx, b.h, x, y, width, { size: F(30) * sc, weight: 700, color: T.text }) + 8 * sc;
      else if (b.note) { const hh = paraHeight(ctx, b.note, width - 36 * sc, F(26) * sc, 700, 1.3) + 28 * sc; panel(ctx, R(x, y, width, hh), { radius: 16, fill: rgba(T.accent, 0.16), line: T.accent }); para(ctx, b.note, x + 18 * sc, y + 14 * sc, width - 36 * sc, { size: F(26) * sc, weight: 700, color: T.text, lh: 1.3 }); y += hh + 14 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(26) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 500, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  const textR = DL.text, figR = DL.fig;
  if (v3.on) {   // a carved plaque under the reading text, so the lettering never sits on the bench grain
    if (DL.split) { panel(ctx, R(textR.x - 14, textR.y - 8, textR.w + 28, textR.h + 16), { radius: 22, fill: 'rgba(0,0,0,0.3)' }); panel(ctx, R(figR.x - 6, figR.y, figR.w + 12, figR.h), { radius: 22, fill: 'rgba(0,0,0,0.22)' }); }
    else panel(ctx, R(textR.x - 14, textR.y - 8, textR.w + 28, textR.h + 16), { radius: 22, fill: 'rgba(0,0,0,0.3)' });
  }
  if (DL.split) {
    if (page.fig) drawFigure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w, Math.max(260, textR.h * (sc > 1.6 ? 0.4 : 0.5)), 560), fr = R(textR.x, y, textR.w, fh);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings, progress =================================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), ROWS = settingsRows(s), SL = settingsLayout(w, h, sc, ROWS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    ROWS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(26) * Math.min(sc, 1.5), weight: 700, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', disabled: false, flash: flashOf(s, `set${i}.${k}`) }));
    });
    return SL.contentH;
  });
  drawMsg(ctx, s, { board: { x: SL.body.x, y: SL.body.y + SL.body.h - 96, w: SL.body.w, h: 90 } });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = backFooter(w, h), st = s.stats;
  header(ctx, s, SL, 'Progress');
  const stars = Object.values(st.stars).reduce((a, b) => a + b, 0), done = Object.values(st.done).reduce((a, b) => a + b, 0);
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, cols = r.w > 900 ? 4 : 2, g = 12, th = 110 * Math.min(sc, 1.8), tw = (r.w - g * (cols - 1)) / cols;
    const cdone = CAMPAIGN.filter((c) => (st.done[c.id] ?? 0) > 0).length;
    const tiles = [['Commissions finished', `${cdone} of ${CAMPAIGN.length}`], ['Pieces painted', done], ['Stars earned', stars], ['In the Gallery', s.gallery.length], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies finished', st.days.length], ['Three-star pieces', Object.values(st.stars).filter((v) => v >= 3).length]];
    tiles.forEach(([l, v], i) => {
      const tr = R(r.x + (i % cols) * (tw + g), r.y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(42) * Math.min(sc, 1.6), weight: 700, color: T.text, maxW: tw - 30, min: 16 });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(21) * Math.min(sc, 1.6), weight: 500, color: T.dim, maxW: tw - 30, min: 11 });
    });
    return Math.ceil(tiles.length / cols) * (th + g);
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ gallery and result ===================================================================
function drawGallery(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), GL = galleryLayout(w, h, s.gallery.length);
  header(ctx, s, GL, 'Gallery');
  if (!s.gallery.length) para(ctx, 'Your finished pieces hang here. Finish a commission or save a Free Painting.', GL.body.x + 10, GL.body.y + 20, GL.body.w - 20, { size: F(28) * sc, weight: 500, color: T.dim, align: 'center' });
  scrollBody(ctx, s, GL.body, () => {
    s.gallery.forEach((g, i) => {
      const c = GL.cards[i], Pc = pieceOf(g.geom);
      panel(ctx, c, { radius: 18 });
      drawPiece(ctx, Pc, g.a, R(c.x + 12, c.y + 10, c.w - 24, c.w - 24), { dark: T.dark });
      txt(ctx, g.title, c.x + c.w / 2, c.y + c.h - 24, { size: F(22) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: c.w - 16, min: 11 });
    });
    return GL.contentH;
  });
  button(ctx, GL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawShow(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), v = s.show;
  if (!v) return;
  const O = showLayout(w, h, v.buttons.length), Pc = pieceOf(v.ch.geom), t = s.sceneT, tr = 4.2;
  const u = Math.min(1, t / tr), x = t < tr ? -11 * (1 - u) * (1 - u) : 0;
  const pic = O.pic;
  rr(ctx, pic.x - 4, pic.y - 4, pic.w + 8, pic.h + 8, 24); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.5)' : 'rgba(80,45,10,0.35)'; ctx.fill();
  ctx.save(); rr(ctx, pic.x, pic.y, pic.w, pic.h, 20); ctx.clip();
  drawScene(ctx, pic, 1, { P: Pc, a: v.a, kind: v.kind, t: s.t, x, moving: t < tr, marks: false });
  ctx.restore();
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    txt(ctx, v.title, body.x + body.w / 2, y + 26 * Math.min(sc, 1.5), { size: F(38) * Math.min(sc, 1.5), color: T.text, align: 'center', maxW: body.w, min: 16, face: DISPLAY, weight: 400 }); y += 60 * Math.min(sc, 1.5);
    if (v.stars) { const sz = 44; starsRow(ctx, body.x + body.w / 2 - (3 * sz + 8) / 2, y + sz / 2, sz, v.stars); y += sz + 14; }
    for (const line of v.lines) y += para(ctx, line, body.x, y, body.w, { size: F(25) * sc, weight: 500, color: T.dim, align: 'center', lh: 1.3 }) + 6;
    return y - body.y + 8;
  });
  v.buttons.forEach((b, i) => button(ctx, O.btns[i], b.label, { kind: b.accent ? 'accent' : 'solid', size: 28, flash: flashOf(s, `sb${i}`) }));
  drawMoreLine(ctx, O.F.U.x0 + O.F.U.w / 2, O.F.U.y1 - 6, 13);
}
function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 460);
  panel(ctx, c, { radius: 28, fill: T.dark ? 'rgba(30,18,10,0.95)' : 'rgba(255,250,240,0.96)' }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(34), color: T.text, align: 'center', maxW: c.w - 40, min: 18, face: DISPLAY, weight: 400 });
  para(ctx, 'The full game has all 24 commissions, the Daily Commission, Free Painting, the Gallery and Watch and Learn. Get Costa Rican Painted Oxcart on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(27), weight: 500, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth, drawMark, PAINT, COLOR_NAME, UI };
