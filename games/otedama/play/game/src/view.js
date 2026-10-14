// Drawing for every screen. render() is the single entry point; the playing screen lives in playview.js, text screens in docview.js.
import { PAL, UI, DISPLAY, drawRoom, drawHands, drawBag, drawSwatch, drawStars, clamp, ease } from './art.js';
import { txt, button, panel, rrect, chip, icon, wrap } from './ui.js';
import { renderDoc } from './docview.js';
import { renderPlay } from './playview.js';
import { ABOUT, HOWTO, rulesPages } from './content.js';
import { PATTERNS, FABRICS, FREE_FABRICS, TIMING, THINK_CHOICES, gradeName, DEMO_RUNS, DWELL } from './pattern.js';
import { drawLockup, drawMoreLine, edgeStroke } from './brand.js';
import { menuRects } from './layout.js';

const TAU = Math.PI * 2;

export const ownedFabrics = (best) => FABRICS.map((_, i) => i).filter((i) => i < FREE_FABRICS || (best[PATTERNS[i]?.id]?.stars ?? 0) >= 1);

function titleText(ctx, cx, y, size, label, sub, maxW = 1e9) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${size}px ${DISPLAY}`;
  const w0 = ctx.measureText(label).width;
  if (w0 > maxW) { size *= maxW / w0; ctx.font = `700 ${size}px ${DISPLAY}`; }
  const wmax = ctx.measureText(label).width;
  const g = ctx.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5);
  g.addColorStop(0, '#fff6d6'); g.addColorStop(0.55, '#ffd77a'); g.addColorStop(1, '#e08a2c');
  ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.18; ctx.strokeStyle = '#0b1430'; ctx.strokeText(label, cx, y);
  ctx.shadowColor = 'rgba(255,190,90,0.55)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = g; ctx.fillText(label, cx, y);
  ctx.restore();
  if (sub) txt(ctx, sub, cx, y + size * 0.78, size * 0.3, PAL.text, { align: 'center', weight: 700, stroke: 6, maxW: wmax * 1.1 });
}

function backdrop(ctx, w, h, t, st) {
  drawRoom(ctx, w, h, t, { horizon: h * 0.5 }, 0, 0.1);
}

// Three bags in a cascade between two hands, used on the title and menu screens.
function hero(ctx, st, r, t) {
  const bag = Math.min(r.w * 0.2, r.h * 0.2, 120), handY = r.y + r.h * 0.86, xL = r.x + r.w * 0.3, xR = r.x + r.w * 0.7;
  const H = Math.min(r.h * 0.6, 520), bt = t * 1.7, restY = handY - bag * 0.34;
  ctx.fillStyle = 'rgba(20,14,6,0.3)'; ctx.beginPath(); ctx.ellipse(r.x + r.w / 2, handY + bag * 0.75, r.w * 0.34, bag * 0.14, 0, 0, TAU); ctx.fill();
  const own = ownedFabrics(st.best), A = bag * 0.5, T = 3 - DWELL, lifts = [0, 0];
  const pos = [0, 1, 2].map((k) => {
    const ph = (((bt - k) % 3) + 3) % 3, m = Math.floor((bt - k) / 3), hand = (((k + 3 * m) % 2) + 2) % 2;
    const x0 = hand === 0 ? xL : xR, x1 = hand === 0 ? xR : xL, land = 1 - hand;
    const d = ph > 2.5 ? ph - 3 : ph;                                  // beats since this bag was tossed (negative just before)
    const hh = ph > 2.5 ? 1 - hand : hand;                  // the hand about to toss it
    if (d > -0.14 && d < 0.2) lifts[hh] = Math.max(lifts[hh], A * Math.sin(Math.PI * (d + 0.14) / 0.34));
    if (ph >= T && ph < T + 0.3) lifts[land] -= A * 0.55 * Math.sin(Math.PI * (ph - T) / 0.3);
    return { ph, hand, land, x0, x1, k, m };
  });
  const bags = pos.map(({ ph, hand, land, x0, x1, k }) => {
    if (ph >= T) return { x: x1, y: restY - lifts[land], rot: 0, sq: 0, k, held: land };
    const u = ph / T;
    return { x: x0 + (x1 - x0) * u, y: restY - H * 4 * u * (1 - u) - A * 0.96 * (1 - u) * (1 - u), rot: (hand ? -1 : 1) * u * Math.PI * 1.4 + k, sq: 0, k };
  });
  drawHands(ctx, { t, paused: false, bag, handY, bottom: r.y + r.h + 200, xC: (xL + xR) / 2, pull: 0, look: bags.reduce((a, p) => (p.y < restY - bag * 0.4 && (!a || p.y < a.y) ? { x: p.x, y: p.y } : a), null),
    bags: bags.map((p) => ({ x: p.x, y: p.y, held: p.held ?? -1, lying: false })),
    hands: [0, 1].map((h) => ({ x0: h === 0 ? xL : xR, x: h === 0 ? xL : xR, lift: lifts[h], press: 0 })) });
  bags.forEach((p) => drawBag(ctx, p.x, p.y, bag, p.rot, own[p.k % own.length], p.sq));
}

export function render(ctx, st, L, view, meta, pauseItems) {
  const w = view?.width ?? meta.width, h = view?.height ?? meta.height, sc = st.scene;
  if (sc === 'play') { meta.previewBadge = { x: L.play.stage.x + L.play.stage.w / 2, y: L.play.stage.y + 6, align: 'center' }; renderPlay(ctx, st, L, view, meta, pauseItems, drawPauseMenu); drawToast(ctx, st, L); return; }
  backdrop(ctx, w, h, st.t, st);
  if (sc === 'title') renderTitle(ctx, st, L, w, h);
  else if (sc === 'routines') renderPatterns(ctx, st, L);
  else if (sc === 'detail') renderDetail(ctx, st, L);
  else if (sc === 'result') renderResult(ctx, st, L, w, h);
  else if (sc === 'rules') renderDoc(ctx, st, L, { key: 'rules' + st.rulesPage, title: 'Rules  ' + (st.rulesPage + 1) + '/' + rulesPages().length, blocks: rulesPages()[st.rulesPage].blocks, nav: true, page: st.rulesPage, pages: rulesPages().length, sub: rulesPages()[st.rulesPage].title });
  else if (sc === 'about') renderDoc(ctx, st, L, { key: 'about', title: ABOUT.title, blocks: ABOUT.blocks });
  else if (sc === 'howto') renderDoc(ctx, st, L, { key: 'howto', title: HOWTO.title, blocks: HOWTO.blocks });
  else if (sc === 'settings') renderDoc(ctx, st, L, { key: 'settings', title: 'Settings', blocks: settingsBlocks(st) });
  else if (sc === 'demo-limit') renderDemoLimit(ctx, st, L);
  drawToast(ctx, st, L);
}

function drawToast(ctx, st, L) {
  if (!st.toast) return;
  const a = clamp(Math.min(st.toast.t / 0.2, (st.toast.hold - st.toast.t) / 0.3), 0, 1);
  ctx.save(); ctx.globalAlpha = a;
  chip(ctx, L.S.x + L.S.w / 2, L.S.y + L.S.h - 120, st.toast.text, 28, { align: 'center', fill: 'rgba(10,14,40,0.9)', stroke: 'rgba(255,230,200,0.4)' });
  ctx.restore();
}

function settingsBlocks(st) {
  const p = st.prefs;
  const row = (id, label, kind, val, hint, extra = {}) => ({ row: id, label, kind, val, hint, ...extra });
  return [
    row('sound', 'Sound', 'toggle', () => p.sound),
    row('timing', 'Timing', 'cycle', () => TIMING[p.timingIdx].name, 'How strict the catch windows are'),
    row('think', 'Think time', 'cycle', () => THINK_CHOICES[p.thinkIdx] + ' s', 'Watch and Learn pause before each phrase'),
    row('song', 'Counting words', 'toggle', () => p.song, 'Show ichi, ni, san... on each clean catch'),
    row('calm', 'Reduced motion', 'toggle', () => p.calm, 'No screen shake'),
    ...(st.demo ? [] : [row('restore', 'Restore purchase', 'button', () => '', st.restoreMsg || 'Get an earlier purchase back', { btn: 'Restore' })]),
    row('rules', 'Rules', 'button', () => '', 'The full rule book', { btn: 'Open' }),
    { p: 'Text size: use A- and A+ at the top of this screen (up to 300%).' },
  ];
}

// ---- title ----------------------------------------------------------------------------------------------------------------------------
function renderTitle(ctx, st, L, w, h) {
  const T = L.title, S = L.S;
  hero(ctx, st, T.hero, st.t);
  const cx = L.mode === 'wide' ? S.x + (T.play.x - S.x) / 2 : S.x + S.w / 2;
  titleText(ctx, cx, T.titleY, T.size, 'OTEDAMA', 'Cloth bags, tossed and caught', (L.mode === 'wide' ? T.play.x - S.x - 40 : S.w - 40));
  button(ctx, T.play, 'Play', { kind: 'primary', size: 40, icon: 'play' });
  button(ctx, T.auto, 'Watch and Learn', { kind: 'quiet', size: 30, icon: 'eye' });
  button(ctx, T.how, 'How to Play', { kind: 'ghost', size: 26 });
  button(ctx, T.rules, 'Rules', { kind: 'ghost', size: 26 });
  button(ctx, T.about, 'About', { kind: 'ghost', size: 26 });
  button(ctx, T.settings, 'Settings', { kind: 'ghost', size: 26 });
  drawLockup(ctx, T.credit.x, T.credit.y, T.credit.h, { dim: 0.95 });
  if (st.demo) chip(ctx, S.x + S.w - 16, S.y + 28, `Demo: ${Math.max(0, DEMO_RUNS - st.demoRuns)} left`, 20, { align: 'right', fill: 'rgba(10,14,40,0.8)' });
}

// ---- patterns + detail ----------------------------------------------------------------------------------------------------------
function stars(ctx, cx, cy, size, n) { drawStars(ctx, cx, cy, size, n, 3, 1.25); }
const tossText = (p) => p.toss.join(' ');

function renderPatterns(ctx, st, L) {
  const G = L.routines, S = L.S, own = ownedFabrics(st.best);
  button(ctx, G.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, 'Choose a pattern', S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), G.titleY, 40, PAL.gold, { align: 'center', font: DISPLAY, stroke: 6, maxW: S.w - 380 });
  G.cards.forEach((r, i) => {
    const cfg = PATTERNS[i], best = st.best[cfg.id] ?? {};
    const locked = st.demo && i > 0;
    panel(ctx, r, { fill: 'rgba(12,18,48,0.82)', rad: 24, stroke: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,214,150,0.35)' });
    const pad = 16;
    const sw = Math.min(r.h * 0.3, 64);
    drawSwatch(ctx, r.x + r.w - pad - sw / 2, r.y + pad + sw / 2, sw, i, !own.includes(i));
    txt(ctx, `${i + 1}`, r.x + pad + 14, r.y + pad + 20, 32, PAL.gold, { font: DISPLAY });
    txt(ctx, cfg.name, r.x + pad + 44, r.y + pad + 20, 28, locked ? PAL.dim : PAL.text, { weight: 800, maxW: r.w - pad * 2 - 44 - sw - 8 });
    txt(ctx, cfg.en, r.x + pad, r.y + pad + sw + 12, 20, PAL.gold, { weight: 700, maxW: r.w - pad * 2 });
    ctx.font = `500 20px ${UI}`;
    wrap(ctx, cfg.blurb, r.w - pad * 2).slice(0, 2).forEach((ln, li) => txt(ctx, ln, r.x + pad, r.y + pad + sw + 44 + li * 26, 20, PAL.dim, { weight: 500 }));
    const ms = Math.min(44, (r.w - pad * 2) / 6.4, r.h * 0.16), my = r.y + r.h - 62 - ms * 0.9;
    for (let b = 0; b < cfg.bags; b++) drawBag(ctx, r.x + pad + ms * (b + 0.6) * 1.15, my, ms, (b - 2) * 0.14, own[(b + i) % own.length], 0);
    txt(ctx, `${cfg.bags} ${cfg.bags === 1 ? 'bag' : 'bags'}  ·  ${cfg.bpm} bpm`, r.x + pad, r.y + r.h - 62, 21, PAL.text, { weight: 700, maxW: r.w - pad * 2 });
    stars(ctx, r.x + pad + 50, r.y + r.h - 28, 15, best.stars ?? 0);
    if (best.score) txt(ctx, String(best.score), r.x + r.w - pad, r.y + r.h - 28, 24, PAL.cream, { align: 'right', weight: 800, maxW: r.w * 0.45 });
    if (locked) txt(ctx, 'Full game', r.x + r.w - pad, r.y + r.h - 28, 18, PAL.dim, { align: 'right', weight: 700 });
  });
}

function renderDetail(ctx, st, L) {
  const D = L.detail, S = L.S, cfg = PATTERNS[st.sel], best = st.best[cfg.id] ?? {}, own = ownedFabrics(st.best);
  button(ctx, D.back, 'Back', { icon: 'back', kind: 'ghost', size: 28 });
  txt(ctx, cfg.name, S.x + S.w / 2 + (L.backPad ? L.backPad / 2 : 0), L.routines.titleY, 44, PAL.gold, { align: 'center', font: DISPLAY, stroke: 6, maxW: S.w - 380 });
  const I = D.info;
  panel(ctx, I, { rad: 26 });
  const pad = 22;
  txt(ctx, cfg.en, I.x + pad, I.y + 36, 26, PAL.text, { weight: 800, maxW: I.w - pad * 2 });
  txt(ctx, cfg.blurb, I.x + pad, I.y + 72, 22, PAL.dim, { weight: 600, maxW: I.w - pad * 2 });
  // the toss sequence, big
  const seqY = I.y + 150;
  txt(ctx, 'TOSS', I.x + pad, seqY - 46, 17, PAL.gold, { weight: 800 });
  const seq = cfg.toss.length > 1 ? cfg.toss : [cfg.toss[0], cfg.toss[0], cfg.toss[0]];
  const cell = Math.min(86, (I.w - pad * 2) / (seq.length + 0.5));
  seq.forEach((v, j) => {
    const x = I.x + pad + cell * (j + 0.5);
    ctx.fillStyle = j % 2 ? 'rgba(255,215,122,0.14)' : 'rgba(156,240,220,0.14)'; rrect(ctx, { x: x - cell * 0.42, y: seqY - cell * 0.42, w: cell * 0.84, h: cell * 0.84 }, cell * 0.2); ctx.fill();
    txt(ctx, String(v), x, seqY, cell * 0.5, PAL.cream, { align: 'center', font: DISPLAY });
  });
  txt(ctx, 'repeats; the number is how many beats until the bag comes down', I.x + pad, seqY + cell * 0.62, 18, PAL.dim, { weight: 500, maxW: I.w - pad * 2 });
  // the bags that will be used, and the toss ladder: one arc per toss, from the beat it leaves to the beat it lands
  const bs = Math.min(76, (I.w - pad * 2) / (cfg.bags + 1)), by = I.y + I.h - 112 - bs;
  const lx0 = I.x + pad + 14, lx1 = I.x + I.w - pad - 14;
  let ly = by - bs * 0.7 - 12;
  const ltop = seqY + cell * 0.95 + 44;
  if (ly - ltop > 40) {
    const nb = Math.min(cfg.beats, 12), step = (lx1 - lx0) / (nb + 5), hmax = Math.min(ly - ltop, 240);
    ly = ltop + hmax + 6;
    txt(ctx, 'FIRST BEATS', I.x + pad, ltop - 14, 17, PAL.gold, { weight: 800 });
    ctx.lineCap = 'round';
    for (let j = 0; j < nb; j++) {
      const v = cfg.toss[j % cfg.toss.length];
      if (v) {
        const x0 = lx0 + j * step, x1 = lx0 + (j + v) * step, hh = Math.min(hmax, hmax * 0.2 * (v - 0.3), 190);
        ctx.strokeStyle = j % 2 ? '#ffd77a' : '#9cf0dc'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x0, ly); ctx.bezierCurveTo(x0 + (x1 - x0) * 0.1, ly - hh * 1.33, x1 - (x1 - x0) * 0.1, ly - hh * 1.33, x1, ly); ctx.stroke();
      }
      ctx.fillStyle = j % 2 ? '#ffd77a' : '#9cf0dc'; ctx.beginPath(); ctx.arc(lx0 + j * step, ly, 6, 0, TAU); ctx.fill();
    }
  }
  for (let b = 0; b < cfg.bags; b++) drawBag(ctx, I.x + pad + bs * (b + 0.7), by + bs * 0.3, bs * 0.82, (b - 2) * 0.12, own[(b + st.sel) % own.length], 0);
  txt(ctx, `${cfg.bags} ${cfg.bags === 1 ? 'bag' : 'bags'}  ·  ${cfg.bpm} beats per minute  ·  ${cfg.beats} beats${cfg.claps.length ? '  ·  claps' : ''}`, I.x + pad, by + bs * 1.0 + 8, 21, PAL.text, { weight: 700, maxW: I.w - pad * 2 });
  const fy = I.y + I.h - 56;
  stars(ctx, I.x + pad + 50, fy, 18, best.stars ?? 0);
  txt(ctx, best.score ? `Best ${best.score}  ·  ${Math.round((best.acc ?? 0) * 100)}%` : 'Not played yet', I.x + I.w - pad, fy, 24, PAL.cream, { align: 'right', weight: 700, maxW: I.w * 0.55 });
  button(ctx, D.learn, 'Learn it', { kind: 'quiet', size: 32, sub: 'Slower, forgiving, with hints', icon: 'bulb' });
  button(ctx, D.perform, 'Play', { kind: 'primary', size: 36, sub: 'Full tempo, scored', icon: 'play' });
  button(ctx, D.watch, 'Watch and Learn', { kind: 'ghost', size: 30, sub: 'The game juggles it for you', icon: 'eye' });
}

// ---- result ----------------------------------------------------------------------------------------------------------------------
function renderResult(ctx, st, L, w, h) {
  const Rr = L.result, r = st.result, p = Rr.panel, cfg = PATTERNS[r.ri];
  panel(ctx, p, { fill: 'rgba(10,14,38,0.92)', rad: 30 });
  edgeStroke(ctx, p, 30, 0.5);
  const cx = p.x + p.w / 2, wide = L.mode === 'wide';
  const o = wide ? { t: 40, n: 78, st: 134, ss: 32, sc: 206, ssz: 72, g: 262, top: 304, nb: 296 } : { t: 54, n: 98, st: 170, ss: 38, sc: 262, ssz: 88, g: 330, top: 384, nb: 372 };
  txt(ctx, r.failed ? 'THE FLOW BROKE' : r.mode === 'auto' ? 'WATCH COMPLETE' : 'WELL TOSSED', cx, p.y + o.t, 28, r.failed ? PAL.rose : PAL.gold, { align: 'center', font: DISPLAY, maxW: p.w - 40 });
  txt(ctx, cfg.name + '  ·  ' + cfg.en, cx, p.y + o.n, 24, PAL.text, { align: 'center', weight: 700, maxW: p.w - 40 });
  stars(ctx, cx, p.y + o.st, o.ss, r.stars);
  txt(ctx, String(Math.round(r.score)), cx, p.y + o.sc, o.ssz, PAL.cream, { align: 'center', font: DISPLAY, stroke: 8, maxW: p.w - 60 });
  txt(ctx, `${gradeName(r.acc)}  ·  accuracy ${Math.round(r.acc * 100)}%`, cx, p.y + o.g, 26, PAL.gold, { align: 'center', weight: 800, maxW: p.w - 60 });
  let top = p.y + o.top;
  if (r.newBest) { txt(ctx, 'NEW BEST', cx, p.y + o.nb, 24, PAL.tealHi, { align: 'center', weight: 800 }); top += 24; }
  if (r.newFabric !== null && r.newFabric !== undefined) {
    drawSwatch(ctx, cx - 120, top + 4, 40, r.newFabric, false);
    txt(ctx, `New fabric: ${FABRICS[r.newFabric].name}`, cx - 84, top + 4, 24, PAL.cream, { weight: 800, maxW: p.w / 2 - 20 });
    top += 54;
  }
  const rows = [['Perfect', r.counts.perfect, '#ffe07a'], ['Great', r.counts.great, '#9cf0dc'], ['Good', r.counts.good, '#a9c4ff'], ['Drop', r.counts.miss, '#ff8aa0']];
  if (wide) rows.push(['Longest chain', r.maxChain, PAL.dim]);
  const gx = p.x + 60, gw = p.w - 120, ch = wide ? 30 : 40;
  rows.forEach(([n, c, col], i) => {
    const y = top + i * ch;
    txt(ctx, n, gx, y, 24, col, { weight: 700 });
    txt(ctx, String(c), gx + gw, y, 26, PAL.text, { align: 'right', weight: 800 });
  });
  if (!wide) txt(ctx, `Longest chain ${r.maxChain}`, cx, top + rows.length * ch + 8, 22, PAL.dim, { align: 'center', weight: 600 });
  button(ctx, Rr.again, 'Again', { kind: 'primary', size: 30, icon: 'restart' });
  button(ctx, Rr.routines, 'Patterns', { kind: 'quiet', size: 30 });
  button(ctx, Rr.menu, 'Menu', { kind: 'ghost', size: 30 });
  drawMoreLine(ctx, Rr.more.x, Rr.more.y, 15);
}

// ---- pause / end menu + demo limit ---------------------------------------------------------------------------------------------
const PAUSE_LABELS = { resume: 'Resume', restart: 'Restart', quit: 'Patterns', again: 'Again', next: 'Next', exit: 'Exit' };
function drawPauseMenu(ctx, st, L, items, pl) {
  ctx.fillStyle = 'rgba(6,8,24,0.62)'; ctx.fillRect(0, 0, L.w, L.h);
  const M = menuRects(L, items.length, 96);
  panel(ctx, M.panel, { fill: 'rgba(12,18,46,0.95)', rad: 28 });
  txt(ctx, pl.over ? 'Pattern ended' : 'Paused', M.panel.x + M.panel.w / 2, M.panel.y + 52, 38, PAL.gold, { align: 'center', font: DISPLAY });
  items.forEach((it, i) => button(ctx, M.btns[i], PAUSE_LABELS[it] ?? it, { kind: it === 'resume' || it === 'again' ? 'primary' : 'quiet', size: 30 }));
}

function renderDemoLimit(ctx, st, L) {
  const S = L.S, pw = Math.min(S.w - 48, 620), ph = 420, p = { x: S.x + (S.w - pw) / 2, y: S.y + (S.h - ph) / 2, w: pw, h: ph };
  panel(ctx, p, { fill: 'rgba(10,14,38,0.94)', rad: 30 });
  txt(ctx, 'That was the demo', p.x + p.w / 2, p.y + 70, 40, PAL.gold, { align: 'center', font: DISPLAY, maxW: p.w - 40 });
  txt(ctx, 'The full game has every pattern,', p.x + p.w / 2, p.y + 160, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'up to five bags, with claps and fabrics.', p.x + p.w / 2, p.y + 200, 26, PAL.text, { align: 'center', weight: 600, maxW: p.w - 40 });
  txt(ctx, 'Get Otedama for iPhone and Android.', p.x + p.w / 2, p.y + 270, 26, PAL.tealHi, { align: 'center', weight: 800, maxW: p.w - 40 });
  txt(ctx, 'Tap to go back to the menu', p.x + p.w / 2, p.y + 350, 22, PAL.dim, { align: 'center', weight: 600 });
}
