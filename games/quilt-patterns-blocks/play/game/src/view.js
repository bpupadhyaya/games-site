// All drawing. Reads the game state and the layout; never changes game state (apart from the scroll metrics it reports back).
import { toolsFor, playLayout, titleLayout, docLayout, settingsLayout, pickLayout, galleryLayout, showLayout, backFooter, pauseLayout, centerCard, playOpts, TEXT_SCALES, host, inRect, R, clamp, grid } from './layout.js';
import { theme, LOOKS, LOOK_IDS, background, panel, button, rr, txt, para, paraHeight, wrap, F, mix, rgba, icons } from './ui.js';
import { setBrandTone, drawCredit, drawMoreLine, edgeStroke, drawBadgeStack } from './brand.js';
import { drawTable, drawMat, drawBlock, drawQuilt, drawSwatch, drawSpool, drawPatch, patchPoints } from './art.js';
import { blockOf, BLOCKS } from './blocks.js';
import { fab, FABRICS, BAND_NAME } from './fabrics.js';
import { evaluate, SASH_NAME, quiltGeo } from './rules.js';
import { CARDS, LESSONS, STARTER_TILES } from './gen.js';
import { docOf } from './content.js';

export const metrics = { max: 0, view: 0, rect: null };
export const SETTINGS = [
  { id: 'look', label: 'Look', opts: LOOK_IDS.map((k) => LOOKS[k].name) },
  { id: 'hand', label: 'Side panel', opts: ['Right', 'Left'] },
  { id: 'timer', label: 'Show timer', opts: ['On', 'Off'] },
  { id: 'labels', label: 'Piece letters', opts: ['On', 'Off'] },
  { id: 'sound', label: 'Sound', opts: ['On', 'Off'] },
  { id: 'calm', label: 'Calm motion', opts: ['Off', 'On'] },
  { id: 'restore', label: 'Purchases', opts: ['Restore'] },
];
export const settingIndex = (s, id) => {
  const p = s.prefs;
  switch (id) {
    case 'look': return LOOK_IDS.indexOf(p.look);
    case 'hand': return p.hand === 'left' ? 1 : 0;
    case 'timer': return p.timer ? 0 : 1;
    case 'labels': return p.labels ? 0 : 1;
    case 'sound': return p.sound ? 0 : 1;
    case 'calm': return p.calm ? 1 : 0;
    default: return -1;
  }
};
const scaleOf = (s) => TEXT_SCALES[s.prefs.textIdx] ?? 1;
const smooth = (t) => t * t * (3 - 2 * t);
export const fmtTime = (t) => { const x = Math.floor(t); return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`; };
const flashOf = (s, id) => (s.flash && s.flash.id === id ? Math.max(0, 1 - s.flash.t / 0.2) : 0);

// ---- sample designs used for pictures on the menu, lessons and Rules -------------------------------------------------------------------
const SAMPLE_ROLES = { 'nine-patch': ['parchment', 'brick'], 'log-cabin': ['ivory', 'denim', 'crimson'], 'flying-geese': ['ivory', 'forest', 'mustard'], pinwheel: ['ivory', 'indigo'], 'ohio-star': ['ivory', 'denim', 'mustard'], 'bear-paw': ['parchment', 'rust', 'forest'] };
export const samplePaint = (id) => blockOf(id).patches.map((p) => SAMPLE_ROLES[id][p.role]);
const SAMPLE_QUILT = (() => {
  const tiles = STARTER_TILES(); const cells = Array.from({ length: 9 }, (_, i) => ({ t: (i + Math.floor(i / 3)) % 3, r: i % 4 }));
  return { ch: { cols: 3, tiles }, d: { cells, sashW: 1, sashF: 'sky', bordW: 1, bordF: 'indigo' } };
})();

export function render(ctx, s, view) {
  const w = view.width, h = view.height, T = theme();
  drawTable(ctx, w, h, s.t, T, s.prefs.calm);
  metrics.max = 0; metrics.rect = null;
  const sc = s.scene;
  if (sc === 'title') drawTitle(ctx, s, w, h);
  else if (sc === 'play') drawPlay(ctx, s, w, h);
  else if (sc === 'pick') drawPick(ctx, s, w, h);
  else if (sc === 'doc') drawDoc(ctx, s, w, h);
  else if (sc === 'settings') drawSettings(ctx, s, w, h);
  else if (sc === 'stats') drawStats(ctx, s, w, h);
  else if (sc === 'gallery') drawGallery(ctx, s, w, h);
  else if (sc === 'show') drawShow(ctx, s, w, h);
  else if (sc === 'demo-limit') drawDemoLimit(ctx, s, w, h);
  if (s.sceneT < 0.25 && sc !== 'play') { ctx.fillStyle = `rgba(0,0,0,${0.7 * (1 - smooth(s.sceneT / 0.25))})`; ctx.fillRect(0, 0, w, h); }
}

// ================================================================ figures (menu, Rules, lessons) =================================================
export function drawFigure(ctx, r, fig, t, s = null) {
  const T = theme(), S = Math.min(r.w, r.h) * 0.9, x = r.x + (r.w - S) / 2, y = r.y + (r.h - S) / 2;
  if (fig.k === 'block') {
    const m = S * 0.07, mat = R(x, y, S, S);
    drawMat(ctx, mat, T);
    const paint = fig.empty ? blockOf(fig.id).patches.map(() => '') : samplePaint(fig.id);
    drawBlock(ctx, fig.id, paint, x + m, y + m, S - 2 * m, 0, { roleLabels: true, empty: T.empty });
  } else if (fig.k === 'quilt') {
    drawQuilt(ctx, SAMPLE_QUILT.ch, SAMPLE_QUILT.d, x + S * 0.04, y + S * 0.04, S * 0.9, { quilted: true });
  } else if (fig.k === 'values') {
    const ids = ['ivory', 'butter', 'rose', 'rust', 'indigo', 'jet'], w = S / ids.length, h = S * 0.3;
    ids.forEach((id, i) => { drawSwatch(ctx, id, R(x + i * w + 3, y + S * 0.12, w - 6, h)); drawSwatch(ctx, id, R(x + i * w + 3, y + S * 0.12 + h + S * 0.1, w - 6, h), { squint: true }); });
    txt(ctx, 'colour', x + S / 2, y + S * 0.06, { size: F(24), weight: 600, color: T.dim, align: 'center' });
    txt(ctx, 'squint: value only', x + S / 2, y + S * 0.12 + h * 2 + S * 0.17, { size: F(24), weight: 600, color: T.dim, align: 'center' });
  } else if (fig.k === 'swatches') {
    const ids = ['ivory', 'rust', 'sky', 'sage', 'wheat', 'indigo'], cols = 3, w = S / cols, h = S * 0.36;
    ids.forEach((id, i) => { const rr0 = R(x + (i % cols) * w + 4, y + Math.floor(i / cols) * (h + S * 0.16) + S * 0.06, w - 8, h); drawSwatch(ctx, id, rr0); txt(ctx, fab(id).busy ? 'busy' : 'quiet', rr0.x + rr0.w / 2, rr0.y + h + 18, { size: F(22), weight: 600, color: T.dim, align: 'center' }); });
  } else if (fig.k === 'stars') {
    for (let k = 0; k < 3; k++) icons.star(ctx, x + S / 2 + (k - 1) * S * 0.3, y + S / 2, S * 0.28, '#ffc93c');
  }
}

// ================================================================ title ====================================================================
function drawTitle(ctx, s, w, h) {
  const T = theme(), L = titleLayout(w, h, !!s.saved), hero = L.hero; setBrandTone(T.dark);
  const H = hero.h, tb = Math.min(150, Math.max(66, H * 0.26)), gs = Math.max(90, Math.min(hero.w * 0.66, H - tb - 24, 520));
  const x0 = hero.x + (hero.w - gs) / 2, y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
  // a block that stitches itself together, then the next one
  const ids = BLOCKS.map((b) => b.id), step = 0.16, hold = 2.6;
  let tt = s.t, k = 0; const durOf = (id) => blockOf(id).patches.length * step + hold;
  while (tt > durOf(ids[k % 6])) { tt -= durOf(ids[k % 6]); k += 1; }
  const id = ids[k % 6], block = blockOf(id), pop = block.patches.map((_, i) => tt - i * step), paint = samplePaint(id).map((f, i) => (pop[i] >= 0 ? f : ''));
  const mat = R(x0, y0, gs, gs); drawMat(ctx, mat, T);
  drawBlock(ctx, id, paint, x0 + gs * 0.06, y0 + gs * 0.06, gs * 0.88, 0, { pop, empty: T.empty });
  drawSpool(ctx, x0 - gs * 0.02, y0 + gs * 0.95, Math.min(60, gs * 0.14), '#c9453a');
  drawSpool(ctx, x0 + gs * 1.02, y0 + gs * 0.12, Math.min(52, gs * 0.12), '#2f6fb0');
  const ty = y0 + gs + tb * 0.5;
  txt(ctx, 'QUILT PATTERNS', hero.x + hero.w / 2, ty, { size: tb * 0.46, weight: 700, color: T.text, align: 'center', maxW: hero.w * 0.96, min: 22 });
  txt(ctx, `${block.name.toUpperCase()}  ·  PIECE  ·  ARRANGE  ·  FRAME`, hero.x + hero.w / 2, ty + tb * 0.36, { size: tb * 0.19, weight: 600, color: T.accent, align: 'center', maxW: hero.w * 0.94, min: 12 });
  const B = L.buttons, lab = {
    continue: ['Continue', s.saved ? `${s.saved.title}  ·  ${fmtTime(s.saved.t)}` : ''],
    play: ['Play', 'Lessons and challenges'], daily: ['Daily Brief', s.dailyInfo],
    studio: ['Free Studio', ''], gallery: ['Gallery', ''], learn: ['Watch and Learn', ''], stats: ['Progress', ''], howto: ['How to Play', ''], rules: ['Rules', ''], settings: ['Settings', ''], about: ['About', ''],
  };
  const iconOf = { learn: 'eye', settings: 'gear', stats: 'star', studio: 'grid', gallery: 'save' };
  for (const bid of Object.keys(B)) {
    const prim = bid === 'continue' || bid === 'play' || bid === 'daily', r = B[bid];
    button(ctx, r, lab[bid][0], { kind: bid === 'play' || bid === 'continue' ? 'accent' : 'solid', size: prim ? 34 : 24, sub: prim ? lab[bid][1] : '', radius: 20, flash: flashOf(s, bid), icon: prim ? '' : (iconOf[bid] ?? '') });
    if (bid === 'daily' && s.dailyDone) icons.check(ctx, r.x + r.w - 36, r.y + r.h / 2, 28, T.good);
  }
  drawCredit(ctx, L.brand.x, L.brand.y, Math.min(16, Math.max(12.5, 13.5 / (host.px || 0.55) * 0.5 + 6)), { dim: 0.95 });
}

// ================================================================ headers and scrolling ===========================================================
function header(ctx, s, P, title) {
  const T = theme(), sc = scaleOf(s);
  txt(ctx, title, P.titleX, P.header.y + P.header.h / 2, { size: F(44), weight: 700, color: T.text, maxW: P.textDec.x - P.titleX - 14, min: 20 });
  button(ctx, P.textDec, 'A−', { size: 28, disabled: s.prefs.textIdx === 0, flash: flashOf(s, 'tdec'), radius: 16 });
  button(ctx, P.textInc, 'A+', { size: 28, disabled: s.prefs.textIdx === TEXT_SCALES.length - 1, flash: flashOf(s, 'tinc'), radius: 16 });
  if (sc > 1) txt(ctx, `${Math.round(sc * 100)}%`, P.textDec.x - 12, P.header.y + P.header.h / 2, { size: F(22), weight: 500, color: T.dim, align: 'right' });
}
function scrollBody(ctx, s, rect, draw) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x - 6, rect.y, rect.w + 12, rect.h); ctx.clip();
  ctx.translate(0, -s.scrollY);
  const ch = draw();
  ctx.restore();
  metrics.max = Math.max(0, ch - rect.h); metrics.view = rect.h; metrics.rect = rect;
  if (metrics.max > 0) {
    const T = theme(), bx = rect.x + rect.w + 4, th = Math.max(40, rect.h * rect.h / ch), ty = rect.y + (rect.h - th) * clamp(s.scrollY / metrics.max, 0, 1);
    rr(ctx, bx, rect.y, 6, rect.h, 3); ctx.fillStyle = 'rgba(128,128,128,0.2)'; ctx.fill();
    rr(ctx, bx, ty, 6, th, 3); ctx.fillStyle = T.accent; ctx.fill();
  }
}
const starsRow = (ctx, x, y, size, n, gap = 4) => { for (let k = 0; k < 3; k++) icons.star(ctx, x + k * (size + gap) + size / 2, y, size, k < n ? '#ffc93c' : 'rgba(128,128,128,0.35)'); };

// ================================================================ pick (lessons and challenges) ================================================
export function pickItems() {
  const items = [{ t: 'h', label: 'Lessons' }];
  LESSONS.forEach((l, i) => items.push({ t: 'c', id: l.id, lesson: l, label: l.title, sub: `Lesson ${i + 1} · ${blockOf(l.block).name}`, block: l.block }));
  let group = '';
  for (const c of CARDS) {
    if (c.group !== group) { group = c.group; items.push({ t: 'h', label: group }); }
    items.push({ t: 'c', id: c.id, card: c, label: c.name, sub: c.sub });
  }
  return items;
}
const CARD_THUMB = { copy1: 'nine-patch', copy2: 'pinwheel', brief1: 'log-cabin', brief2: 'ohio-star', brief3: 'bear-paw' };
function drawPick(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), items = pickItems(), PL = pickLayout(w, h, items, sc);
  header(ctx, s, PL, 'Play');
  scrollBody(ctx, s, PL.body, () => {
    items.forEach((it, i) => {
      const r = PL.rects[i];
      if (it.t === 'h') { txt(ctx, it.label, r.x + 4, r.y + r.h * 0.62, { size: F(32) * Math.min(sc, 1.5), weight: 700, color: T.accent }); return; }
      const st = s.stats.stars[it.id] ?? 0, done = (s.stats.done[it.id] ?? 0);
      panel(ctx, r, { radius: 22 });
      const th = Math.min(r.h - 28, 96), tr = R(r.x + 16, r.y + (r.h - th) / 2, th, th);
      if (it.card && it.card.kind === 'quilt') drawQuilt(ctx, SAMPLE_QUILT.ch, SAMPLE_QUILT.d, tr.x + 3, tr.y + 3, th - 6, { drape: false });
      else { const bid = it.block ?? CARD_THUMB[it.id] ?? 'nine-patch'; drawBlock(ctx, bid, samplePaint(bid), tr.x + 2, tr.y + 2, th - 4, 0, {}); }
      const tx = tr.x + th + 18, tw = r.x + r.w - 16 - tx;
      txt(ctx, it.label, tx, r.y + r.h * 0.3, { size: F(30) * Math.min(sc, 1.4), weight: 700, color: T.text, maxW: tw, min: 15 });
      txt(ctx, it.sub, tx, r.y + r.h * 0.56, { size: F(21) * Math.min(sc, 1.4), weight: 400, color: T.dim, maxW: tw, min: 11 });
      if (it.lesson) starsRow(ctx, tx, r.y + r.h * 0.8, 24, st);
      else txt(ctx, done ? `${done} finished · best ${st} star${st === 1 ? '' : 's'}` : 'New', tx, r.y + r.h * 0.8, { size: F(20) * Math.min(sc, 1.4), weight: 500, color: done ? T.good : T.dim, maxW: tw, min: 11 });
    });
    return PL.contentH;
  });
  button(ctx, PL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ play ==========================================================================
function drawPlay(ctx, s, w, h) {
  const T = theme(), L = playLayout(w, h, playOpts(s)), ch = s.ch, d = s.d;
  drawMat(ctx, L.mat, T);
  const hi = new Set(), step = s.hint?.step;
  if (step) { if (ch.kind === 'block') hi.add(step.i); else if (step.op === 'cell') hi.add(step.i); }
  if (ch.kind === 'block') {
    const b = L.board;
    ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fillRect(b.x + b.w * 0.012, b.y + b.w * 0.022, b.w, b.w);
    drawBlock(ctx, ch.block, d.paint, b.x, b.y, b.w, 0, { squint: s.squint, pop: s.pop, hi, pulse: s.t, sel: s.sel, roleLabels: s.prefs.labels, empty: T.empty });
    if (s.pressT > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, s.pressT / 0.6) * 0.35; ctx.fillStyle = '#fff3c4'; ctx.fillRect(b.x, b.y, b.w, b.w); ctx.restore(); }
  } else {
    const b = L.board;
    drawQuilt(ctx, ch, d, b.x, b.y, b.w, { squint: s.squint, pop: s.pop, hi, pulse: s.t, quilted: s.pressT > 0 || !!s.finished, empty: T.empty });
  }
  drawHud(ctx, s, L);
  if (s.paused) { ctx.save(); ctx.globalAlpha = 0.3; drawSide(ctx, s, L); ctx.restore(); drawPaused(ctx, s, L); }
  else if (s.auto.on) { drawSide(ctx, s, L, true); drawAutoCard(ctx, s, L); }
  else if (s.hint) { drawSide(ctx, s, L, true); drawCoach(ctx, s, L); }
  else drawSide(ctx, s, L);
  drawMsg(ctx, s, L);
}

function drawHud(ctx, s, L) {
  const T = theme(), ch = s.ch, hud = L.hud, stacked = L.mode === 'stacked';
  txt(ctx, ch.title, hud.x, hud.y + 26, { size: F(stacked ? 36 : 32), weight: 700, color: T.text, maxW: hud.w, min: 16 });
  const sub = [ch.sub, s.prefs.timer && !s.auto.on ? fmtTime(s.secs) : s.auto.on ? 'Watch and Learn' : ''].filter(Boolean).join('  ·  ');
  txt(ctx, sub, hud.x, hud.y + 58, { size: F(22), weight: 400, color: T.dim, maxW: stacked && !s.auto.on ? hud.w - 150 : hud.w, min: 12 });
  button(ctx, L.pause, '', { icon: s.paused ? 'play' : 'pause', size: 28, radius: 20, flash: flashOf(s, 'pause') });
  const f = fab(s.fab);
  if (f && ch.kind === 'block' && stacked) txt(ctx, `${f.name} · ${BAND_NAME[f.band]}, ${f.busy ? 'busy' : 'quiet'}`, hud.x, hud.y + 84, { size: F(20), weight: 500, color: T.accent, maxW: hud.w + 70, min: 11 });
}
const stackedOrSide = () => true;

// rules card / sample card, tray and tools
function drawSide(ctx, s, L, dimBrief = false) {
  if (!dimBrief) { drawBrief(ctx, s, L); drawTray(ctx, s, L); }
  drawTools(ctx, s, L);
}

function drawBrief(ctx, s, L) {
  const T = theme(), ch = s.ch, r = L.brief;
  panel(ctx, r, { radius: 22, fill: rgba(T.dark ? '#000000' : '#ffffff', T.dark ? 0.22 : 0.45) });
  edgeStroke(ctx, r, 22, 0.3);
  const ev = s.ev;
  if (ch.mode === 'studio') {
    if (ch.kind === 'block') {
      const tb = L.typeBar; button(ctx, L.typePrev, '', { icon: 'back', size: 26, flash: flashOf(s, 'tprev') }); button(ctx, L.typeNext, '', { icon: 'next', size: 26, flash: flashOf(s, 'tnext') });
      txt(ctx, blockOf(ch.block).name, tb.x + tb.w / 2, tb.y + tb.h / 2, { size: F(32), weight: 700, color: T.text, align: 'center', maxW: tb.w - 160, min: 16 });
      const bt = `${blockOf(ch.block).blurb} Roles: ${blockOf(ch.block).roles.join(', ')}.`; let bz = F(22);
      while (bz > 12 && 62 + paraHeight(ctx, bt, r.w - 36, bz, 400, 1.25) > r.h - 6) bz -= 1;
      para(ctx, bt, r.x + 18, r.y + 62, r.w - 36, { size: bz, weight: 400, color: T.dim, lh: 1.25 });
    } else para(ctx, 'Choose a block, tap a square to place it, tap again to turn it. Use the Sash and Border tabs to frame the top, then Save to hang it in the Gallery.', r.x + 18, r.y + 16, r.w - 36, { size: F(24), weight: 400, color: T.dim, lh: 1.3 });
    return;
  }
  if (ch.mode === 'copy') {
    const head = F(24), pad = 16, avail = Math.min(r.h - 2 * pad - head - 6, r.w * 0.5), S0 = Math.max(60, avail), sx = r.x + pad, sy = r.y + pad + head + 6;
    txt(ctx, 'Sample', r.x + pad, r.y + pad + head * 0.5, { size: head, weight: 700, color: T.accent });
    if (ch.kind === 'block') {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx + 3, sy + 5, S0, S0);
      drawBlock(ctx, ch.block, ch.sol.paint, sx, sy, S0, 0, { squint: s.squint });
    } else drawQuilt(ctx, ch, ch.sol, sx, sy, S0, { squint: s.squint, drape: false });
    const tx = sx + S0 + 18, tw = r.x + r.w - pad - tx;
    const it = ev.items[0];
    txt(ctx, it.detail, tx, sy + 26, { size: F(40), weight: 700, color: it.ok ? T.good : T.text, maxW: tw, min: 18 });
    para(ctx, ch.kind === 'block' ? 'pieces match the sample. A piece counts only when it holds exactly the same fabric.' : ch.mode === 'copy' ? 'Place and turn each block like the sample, then match sashing and border.' : '', tx, sy + 62, tw, { size: F(20), weight: 400, color: T.dim, lh: 1.25 });
    if (ch.kind === 'quilt') { ev.items.slice(1).forEach((x, i) => txt(ctx, `${x.ok ? '✓' : '·'} ${x.text}`, tx, sy + 140 + i * 30, { size: F(20), weight: 500, color: x.ok ? T.good : T.dim, maxW: tw, min: 11 })); }
    return;
  }
  // brief: rules with live ticks
  const pad = 16, inner = R(r.x + pad, r.y + pad, r.w - 2 * pad, r.h - 2 * pad), head = F(24);
  txt(ctx, 'Brief', inner.x, inner.y + head * 0.5, { size: head, weight: 700, color: T.accent });
  const done = ev.items.filter((i) => i.ok).length;
  txt(ctx, `${done} of ${ev.items.length}`, inner.x + inner.w, inner.y + head * 0.5, { size: head, weight: 600, color: T.dim, align: 'right' });
  const top = inner.y + head + 10, avail = inner.h - head - 10;
  let fs = F(32);
  const heightFor = (sz) => ev.items.reduce((a, it) => a + Math.max(sz * 1.3, paraHeight(ctx, it.text + (it.detail ? ` (${it.detail})` : ''), inner.w - 40, sz, 500, 1.2)) + 8, 0);
  while (fs > 12 && heightFor(fs) > avail) fs -= 1;
  let y = top;
  for (const it of ev.items) {
    const t = it.text + (it.detail ? `  (${it.detail})` : ''), hh = Math.max(fs * 1.3, paraHeight(ctx, t, inner.w - 40, fs, 500, 1.2));
    ctx.beginPath(); ctx.arc(inner.x + 14, y + fs * 0.65, Math.min(14, fs * 0.55), 0, 7); ctx.fillStyle = it.ok ? T.good : 'rgba(128,128,128,0.28)'; ctx.fill();
    if (it.ok) icons.check(ctx, inner.x + 14, y + fs * 0.65, Math.min(22, fs * 0.9), '#06241a'); else icons.exit(ctx, inner.x + 14, y + fs * 0.65, Math.min(14, fs * 0.55), T.dim);
    para(ctx, t, inner.x + 40, y, inner.w - 40, { size: fs, weight: 500, color: it.ok ? T.text : T.dim, lh: 1.2 });
    y += hh + 8;
  }
}

function drawTray(ctx, s, L) {
  const T = theme(), ch = s.ch, d = s.d, tr = L.tray;
  if (ch.kind === 'block') {
    ch.tray.forEach((id, i) => drawSwatch(ctx, id, tr.items[i], { on: s.fab === id, squint: s.squint, ring: T.accent }));
    return;
  }
  const tabs = ['tiles', 'sash', 'border'], names = ['Blocks', 'Sash', 'Border'];
  tabs.forEach((t, i) => button(ctx, tr.tabs[i], names[i], { size: 24, active: s.tab === t, radius: 14, flash: flashOf(s, 'tab' + t) }));
  if (s.tab === 'tiles') {
    ch.tiles.forEach((t, i) => {
      const r = tr.items[i], sz = Math.min(r.w, r.h) - 8, bx = r.x + (r.w - sz) / 2, by = r.y + (r.h - sz) / 2;
      rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.fillStyle = T.btn; ctx.fill(); ctx.lineWidth = s.tileSel === i ? 4 : 1.2; ctx.strokeStyle = s.tileSel === i ? T.accent : T.line; ctx.stroke();
      drawBlock(ctx, t.type, t.paint, bx, by, sz, s.tileSel === i ? s.rot : 0, { squint: s.squint });
    });
    return;
  }
  const w = s.tab === 'sash' ? d.sashW : d.bordW, cur = s.tab === 'sash' ? d.sashF : d.bordF;
  SASH_NAME.forEach((n, i) => button(ctx, tr.chips[i], n, { size: 22, active: w === i, radius: 14, flash: flashOf(s, 'chip' + i) }));
  ch.tray.forEach((id, i) => drawSwatch(ctx, id, tr.items[i], { on: cur === id, squint: s.squint, ring: T.accent }));
}

const TOOL_DEF = {
  undo: ['Undo', 'undo'], redo: ['Redo', 'redo'], role: ['Fill shape', 'fill'], squint: ['Squint', 'squint'], hint: ['Hint', 'bulb'], rotate: ['Turn', 'rotate'], save: ['Save', 'save'],
};
function drawTools(ctx, s, L) {
  const T = theme(), ids = toolsFor(s.ch);
  L.toolRects.forEach((r, i) => {
    const id = ids[i], [label, icon] = TOOL_DEF[id];
    const dis = (id === 'undo' && !s.un.length) || (id === 'redo' && !s.re.length), on = (id === 'role' && s.roleFill) || (id === 'squint' && s.squint), hint = id === 'hint';
    ctx.save(); if (dis) ctx.globalAlpha = 0.38;
    rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = hint ? T.accent : on ? rgba(T.accent, 0.28) : T.btn; ctx.fill();
    const fl = flashOf(s, id); if (fl) { ctx.fillStyle = `rgba(255,255,255,${0.3 * fl})`; ctx.fill(); }
    ctx.lineWidth = on ? 3 : 1.5; ctx.strokeStyle = on ? T.accent : hint ? 'rgba(0,0,0,0)' : T.line; ctx.stroke();
    const col = hint ? T.onAccent : T.text;
    if (r.h >= 56 && r.w >= 58) {
      icons[icon](ctx, r.x + r.w / 2, r.y + r.h * 0.38, Math.min(r.h * 0.42, r.w * 0.5, 42), col);
      txt(ctx, id === 'rotate' ? `Turn ${s.rot * 90}°` : id === 'role' && r.w < 84 ? 'Fill' : label, r.x + r.w / 2, r.y + r.h * 0.8, { size: F(18), weight: 500, color: col, align: 'center', maxW: r.w - 6, min: 11 });
    } else icons[icon](ctx, r.x + r.w / 2, r.y + r.h / 2, Math.min(r.h * 0.5, 34), col);
    ctx.restore();
  });
}

function sampleMini(ctx, s, C) {
  const ch = s.ch; if (ch.mode !== 'copy') return 0;
  const S0 = Math.min(100, C.h * 0.32), x = C.x + C.w - S0 - 16, y = C.y + 84;
  txt(ctx, 'Sample', x + S0 / 2, y - 10, { size: F(18), weight: 600, color: theme().dim, align: 'center' });
  if (ch.kind === 'block') drawBlock(ctx, ch.block, ch.sol.paint, x, y, S0, 0, {}); else drawQuilt(ctx, ch, ch.sol, x, y, S0, { drape: false });
  return S0 + 24;
}
function drawCoach(ctx, s, L) {
  const T = theme(), hnt = s.hint, C = L.coachR, B = L.coachBtns;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#0a0604' : '#ffffff', T.dark ? 0.72 : 0.8) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40;
  const ts = F(C.h > 300 ? 32 : 28), chip = hnt.stage === 'look' ? 'Where to look' : 'Why it works';
  txt(ctx, 'Hint', x, C.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w, min: 16 });
  txt(ctx, chip, x + w, C.y + 14 + ts * 0.6, { size: F(20), weight: 500, color: T.dim, align: 'right' });
  const bodyTop = C.y + 14 + ts * 1.5, bodyH = B.close.y - 10 - bodyTop, sm = sampleMini(ctx, s, C), bw0 = w - sm;
  let size = F(C.w > 500 ? 28 : 25);
  while (size > 14 && paraHeight(ctx, hnt.text, bw0, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, hnt.text, x, bodyTop, bw0, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, B.close, 'Close', { size: 26, flash: flashOf(s, 'close') });
  button(ctx, B.go, hnt.stage === 'look' ? 'Explain' : 'Apply', { kind: 'accent', size: 26, flash: flashOf(s, 'go') });
}
const THINK_LABEL = ['2 s', '5 s', '8 s', '10 s'];
function drawAutoCard(ctx, s, L) {
  const T = theme(), a = s.auto, C = L.coachR, rl = L.rail, hnt = s.hint, T0 = L.coachText;
  panel(ctx, C, { radius: 24, fill: rgba(T.dark ? '#0a0604' : '#ffffff', T.dark ? 0.72 : 0.8) });
  edgeStroke(ctx, C, 24, 0.5);
  const x = C.x + 20, w = C.w - 40, ts = F(C.h > 300 ? 30 : 26);
  const phase = a.paused ? 'Paused' : a.phase === 'think' ? 'Thinking: where to look' : a.phase === 'reveal' ? 'Why it works' : a.done ? 'Finished' : 'Next step';
  txt(ctx, a.done ? 'Done' : `Step ${a.n}`, x, T0.y + 14 + ts * 0.6, { size: ts, weight: 700, color: T.accent, maxW: w * 0.4, min: 16 });
  txt(ctx, phase, x + w, T0.y + 14 + ts * 0.6, { size: F(20), weight: 500, color: T.dim, align: 'right', maxW: w * 0.58, min: 11 });
  const bodyTop = T0.y + 14 + ts * 1.5, bodyH = T0.y + T0.h - bodyTop;
  const text = hnt?.text ?? (a.done ? (a.stage === 'quilt' ? 'The quilt is finished. Tap Exit to go back to the menu.' : 'The block is finished.') : 'Looking for the next piece.');
  const sm = sampleMini(ctx, s, C), bw0 = w - sm;
  let size = F(C.w > 500 ? 26 : 23);
  while (size > 14 && paraHeight(ctx, text, bw0, size, 500, 1.28) > bodyH) size -= 1;
  para(ctx, text, x, bodyTop, bw0, { size, weight: 500, color: T.text, lh: 1.28 });
  button(ctx, rl.exit, 'Exit', { icon: 'exit', size: 24, flash: flashOf(s, 'aexit') });
  button(ctx, rl.pause, a.paused ? 'Resume' : 'Pause', { icon: a.paused ? 'play' : 'pause', kind: 'accent', size: 24, flash: flashOf(s, 'apause') });
  button(ctx, rl.dec, '', { icon: 'minus', size: 24, flash: flashOf(s, 'adec') });
  button(ctx, rl.inc, '', { icon: 'plus', size: 24, flash: flashOf(s, 'ainc') });
  txt(ctx, `Think ${THINK_LABEL[s.prefs.thinkIdx]}`, C.x + 20, L.rail.exit.y - 22, { size: F(18), weight: 500, color: T.dim });
}

function drawPaused(ctx, s, L) {
  const T = theme(), pl = pauseLayout(L.w, L.h, L.mat);
  ctx.fillStyle = rgba(T.dark ? '#000000' : '#442a10', 0.7); rr(ctx, L.mat.x, L.mat.y, L.mat.w, L.mat.h, L.mat.w * 0.025); ctx.fill();
  panel(ctx, pl.card, { radius: 26, fill: T.dark ? 'rgba(30,18,10,0.97)' : 'rgba(255,250,240,0.97)' });
  edgeStroke(ctx, pl.card, 26, 0.5);
  txt(ctx, 'Paused', pl.card.x + pl.card.w / 2, pl.card.y + 44, { size: F(40), weight: 700, color: T.text, align: 'center' });
  button(ctx, pl.resume, 'Resume', { kind: 'accent', icon: 'play', size: 30, flash: flashOf(s, 'resume') });
  button(ctx, pl.restart, 'Start over', { size: 28, flash: flashOf(s, 'restart') });
  button(ctx, pl.settings, 'Settings', { icon: 'gear', size: 28, flash: flashOf(s, 'psettings') });
  button(ctx, pl.menu, 'Save and menu', { size: 28, flash: flashOf(s, 'pmenu') });
}
function drawMsg(ctx, s, L) {
  const m = s.msg;
  if (!m) return;
  const T = theme(), a = Math.min(1, (m.hold - m.t) / 0.4, m.t / 0.12), bw = Math.min(L.mat.w - 30, 560), cx = L.mat.x + L.mat.w / 2;
  const size = F(24), lines = wrap(ctx, m.text, bw - 36, size, 600), hh = lines.length * size * 1.22 + 22, y = L.mat.y + 12;
  ctx.save(); ctx.globalAlpha = a;
  rr(ctx, cx - bw / 2, y, bw, hh, 18); ctx.fillStyle = T.dark ? 'rgba(20,12,6,0.96)' : 'rgba(255,255,255,0.97)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
  para(ctx, m.text, cx - bw / 2 + 18, y + 11, bw - 36, { size, weight: 600, color: T.text, align: 'center', lh: 1.22 });
  ctx.restore();
}

// ================================================================ docs ===========================================================================
function drawDoc(ctx, s, w, h) {
  const T = theme(), doc = docOf(s.doc), page = doc.pages[s.doc.page], DL = docLayout(w, h), sc = scaleOf(s), lesson = s.doc.kind === 'lesson';
  header(ctx, s, DL, doc.title);
  const n = doc.pages.length;
  button(ctx, DL.menu, lesson ? 'Back' : 'Menu', { icon: 'back', size: 26, flash: flashOf(s, 'back') });
  if (lesson) button(ctx, DL.next, 'Start', { size: 28, kind: 'accent', flash: flashOf(s, 'next') });
  else {
    button(ctx, DL.prev, 'Prev', { size: 26, disabled: s.doc.page === 0, flash: flashOf(s, 'prev') });
    button(ctx, DL.next, 'Next', { size: 26, kind: s.doc.page < n - 1 ? 'accent' : 'solid', disabled: s.doc.page >= n - 1, flash: flashOf(s, 'next') });
    txt(ctx, `${s.doc.page + 1} / ${n}`, DL.count.x + DL.count.w / 2, DL.count.y + DL.count.h / 2, { size: F(26), weight: 600, color: T.dim, align: 'center' });
  }
  const textR = DL.text, figR = DL.fig;
  const drawText = (top, width, x) => {
    let y = top;
    txt(ctx, page.title, x, y + 26 * sc, { size: F(38) * sc, weight: 700, color: T.accent, maxW: width, min: 16 }); y += 26 * sc + 30 * sc;
    for (const b of page.body) {
      if (b.p) { y += para(ctx, b.p, x, y, width, { size: F(28) * sc, weight: 400, color: T.text, lh: 1.34 }) + 14 * sc; }
      else if (b.h) { y += para(ctx, b.h, x, y, width, { size: F(32) * sc, weight: 700, color: T.text }) + 8 * sc; }
      else if (b.note) { const hh = paraHeight(ctx, b.note, width - 36 * sc, F(27) * sc, 600, 1.3) + 28 * sc; panel(ctx, R(x, y, width, hh), { radius: 16, fill: rgba(T.accent, 0.16), line: T.accent }); para(ctx, b.note, x + 18 * sc, y + 14 * sc, width - 36 * sc, { size: F(27) * sc, weight: 600, color: T.text, lh: 1.3 }); y += hh + 14 * sc; }
      else if (b.li) for (const it of b.li) {
        const sz = F(27) * sc;
        ctx.beginPath(); ctx.arc(x + 8 * sc, y + sz * 0.62, 5 * sc, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
        y += para(ctx, it, x + 28 * sc, y, width - 28 * sc, { size: sz, weight: 400, color: T.text, lh: 1.3 }) + 10 * sc;
      }
    }
    return y - top + 20;
  };
  if (DL.split) {
    if (page.fig) drawFigure(ctx, figR, page.fig, s.t);
    scrollBody(ctx, s, textR, () => drawText(textR.y, textR.w - 10, textR.x));
  } else {
    scrollBody(ctx, s, textR, () => {
      let y = textR.y;
      if (page.fig) {
        const fh = Math.min(textR.w, Math.max(300, textR.h * (sc > 1.6 ? 0.45 : 0.62)), 640), fr = R(textR.x + (textR.w - Math.min(textR.w, fh + 20)) / 2, y, Math.min(textR.w, fh + 20), fh + 36);
        drawFigure(ctx, fr, page.fig, s.t); y += fr.h + 14;
      }
      return y - textR.y + drawText(y, textR.w - 10, textR.x);
    });
  }
}

// ================================================================ settings, stats ===============================================================
function drawSettings(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = settingsLayout(w, h, sc, SETTINGS.length);
  header(ctx, s, SL, 'Settings');
  scrollBody(ctx, s, SL.body, () => {
    SETTINGS.forEach((row, i) => {
      const g = SL.rows[i];
      panel(ctx, g.rect, { radius: 20 });
      txt(ctx, row.label, g.rect.x + 22, g.rect.y + g.rect.h / 2, { size: F(28) * Math.min(sc, 1.5), weight: 600, color: T.text, maxW: g.rect.w - g.ctrl.w - 50, min: 14 });
      const n = row.opts.length, seg = grid(g.ctrl, n, 1, 8), cur = settingIndex(s, row.id);
      row.opts.forEach((o, k) => button(ctx, seg[k], o, { size: 24, active: k === cur, radius: 14, kind: row.id === 'restore' ? 'accent' : 'solid', flash: flashOf(s, 'set' + i + '.' + k) }));
    });
    return SL.contentH;
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawStats(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), SL = backFooter(w, h), st = s.stats;
  header(ctx, s, SL, 'Progress');
  const stars = Object.values(st.stars).reduce((a, b) => a + b, 0), done = Object.values(st.done).reduce((a, b) => a + b, 0);
  scrollBody(ctx, s, SL.body, () => {
    const r = SL.body, cols = r.w > 900 ? 4 : 2, g = 12, th = 110 * Math.min(sc, 1.8), tw = (r.w - g * (cols - 1)) / cols;
    const tiles = [['Tasks finished', done], ['Stars earned', stars], ['Lessons done', LESSONS.filter((l) => (st.stars[l.id] ?? 0) > 0).length + ' of ' + LESSONS.length], ['Quilts in the Gallery', s.gallery.length], ['Daily streak', s.streak], ['Best streak', st.bestStreak], ['Dailies finished', st.days.length], ['Blocks on the shelf', s.shelf.length]];
    tiles.forEach(([l, v], i) => {
      const tr = R(r.x + (i % cols) * (tw + g), r.y + Math.floor(i / cols) * (th + g), tw, th);
      panel(ctx, tr, { radius: 20 });
      txt(ctx, v, tr.x + 20, tr.y + th * 0.42, { size: F(44) * Math.min(sc, 1.6), weight: 700, color: T.text, maxW: tw - 30, min: 16 });
      txt(ctx, l, tr.x + 20, tr.y + th * 0.8, { size: F(22) * Math.min(sc, 1.6), weight: 400, color: T.dim, maxW: tw - 30, min: 11 });
    });
    return Math.ceil(tiles.length / cols) * (th + g);
  });
  button(ctx, SL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}

// ================================================================ gallery and result ===============================================================
function drawGallery(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), GL = galleryLayout(w, h, s.gallery.length, sc);
  header(ctx, s, GL, 'Gallery');
  if (!s.gallery.length) para(ctx, 'Your finished quilts hang here. Finish a quilt challenge or save one from the Free Studio.', GL.body.x + 10, GL.body.y + 20, GL.body.w - 20, { size: F(28) * sc, weight: 400, color: T.dim, align: 'center' });
  scrollBody(ctx, s, GL.body, () => {
    s.gallery.forEach((g, i) => {
      const c = GL.cards[i], S = c.w - 28;
      panel(ctx, c, { radius: 18 });
      drawQuilt(ctx, { cols: g.cols, tiles: g.tiles }, g.d, c.x + 14, c.y + 14, S, { quilted: true });
      txt(ctx, g.name, c.x + c.w / 2, c.y + c.h - 22, { size: F(22) * Math.min(sc, 1.5), weight: 600, color: T.text, align: 'center', maxW: c.w - 16, min: 11 });
    });
    return GL.contentH;
  });
  button(ctx, GL.back, 'Back', { icon: 'back', size: 30, flash: flashOf(s, 'back') });
}
function drawShow(ctx, s, w, h) {
  const T = theme(), sc = scaleOf(s), v = s.show;
  if (!v) return;
  const O = showLayout(w, h, v.buttons.length);
  const pic = O.pic, S = pic.w;
  drawMat(ctx, R(pic.x - S * 0.03, pic.y - S * 0.03, S * 1.06, S * 1.06), T);
  const lift = v.lift ? Math.min(1, s.sceneT / 0.7) : 1;
  if (v.kind === 'quilt') drawQuilt(ctx, v.ch, v.d, pic.x, pic.y - S * 0.015 * (1 - lift), S, { quilted: true });
  else drawBlock(ctx, v.ch.block, v.d.paint, pic.x + S * 0.03, pic.y + S * 0.03, S * 0.94, 0, {});
  for (const p of s.sparks) { ctx.globalAlpha = Math.max(0, 1 - p.t / p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  const body = O.body;
  scrollBody(ctx, s, body, () => {
    let y = body.y + 4;
    txt(ctx, v.title, body.x + body.w / 2, y + 24 * sc, { size: F(44) * Math.min(sc, 1.5), weight: 700, color: T.text, align: 'center', maxW: body.w, min: 18 }); y += 56 * Math.min(sc, 1.5);
    if (v.stars) { const sz = 44; starsRow(ctx, body.x + body.w / 2 - (3 * sz + 8) / 2, y + sz / 2, sz, v.stars); y += sz + 14; }
    for (const line of v.lines) y += para(ctx, line, body.x, y, body.w, { size: F(26) * sc, weight: 500, color: T.dim, align: 'center', lh: 1.3 }) + 6;
    return y - body.y + 8;
  });
  v.buttons.forEach((b, i) => button(ctx, O.btns[i], b.label, { kind: b.accent ? 'accent' : 'solid', size: 28, flash: flashOf(s, 'sb' + i) }));
  if (v.more) drawMoreLine(ctx, O.F.U.x0 + O.F.U.w / 2, O.F.U.y1 - 6, 14);
}
function drawDemoLimit(ctx, s, w, h) {
  setBrandTone(theme().dark);
  const T = theme(), c = centerCard(w, h, 640, 440);
  panel(ctx, c, { radius: 28, fill: T.dark ? 'rgba(30,18,10,0.95)' : 'rgba(255,250,240,0.96)' }); edgeStroke(ctx, c, 28, 0.5);
  txt(ctx, 'That was the free preview', c.x + c.w / 2, c.y + 70, { size: F(38), weight: 700, color: T.text, align: 'center', maxW: c.w - 40, min: 18 });
  para(ctx, 'The full game has every lesson, the challenges, the Daily Brief, Free Studio, the Gallery and Watch and Learn. Get Quilt Patterns on iPhone and Android.', c.x + 30, c.y + 120, c.w - 60, { size: F(28), weight: 400, color: T.text, align: 'center' });
  drawCredit(ctx, c.x + c.w / 2, c.y + c.h - 28, 14);
}
export { smooth };
