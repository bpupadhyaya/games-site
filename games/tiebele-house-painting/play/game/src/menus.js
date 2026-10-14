// Every screen that is not the play screen: title, wall list, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { FR, TEXT_SCALES, THINK_STEPS, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { drawBackdrop, drawHero, drawDiagram, drawPanel, drawWall, wordmark, triangleBand } from './art.js';
import { drawLockupImg } from './brand.js';
import { LEVELS, COURTYARDS, KIND_INFO, levelUnlocked } from './sim.js';
import { HOWTO, ABOUT, RULES } from './content.js';
import { v3 } from './v3.js';

// ---- text measuring that does not need a canvas -------------------------------------------------------------------------
export const metrics = {
  font: '16px sans-serif',
  measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); const sz = m ? Number(m[1]) : 16; return { width: String(t).length * sz * 0.58 }; },
};

const LOCK_H = 74;
export const scaleOf = (state) => TEXT_SCALES[state.settings.textIdx];
const starsStr = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ---- widget lists -------------------------------------------------------------------------------------------------------------
const lockupWidget = (lh = LOCK_H) => ({ t: 'art', id: 'arcforge', hitW: 300, h: lh + 16, draw(ctx, w) { drawLockupImg(ctx, w / 2, 8, lh, { align: 'center' }); } });
export const nextWall = (rec) => { for (let i = 0; i < LEVELS.length; i++) if (levelUnlocked(rec, i) && !(rec.stars[i] > 0)) return i; return LEVELS.length - 1; };

export function titleWidgets(state, land) {
  const w = [], rec = state.record, nx = nextWall(rec);
  // short portrait screens (tablets): tighter buttons so the 3D hero keeps room
  const tight = v3.on && !land && FR.h < 1150 && state.settings.textIdx === 0, k = tight ? 0.8 : 1;
  const hb = (n) => Math.round(n * k);
  if (!land) w.push({ t: 'art', h: state.settings.textIdx > 0 ? 250 : Math.round(Math.min(v3.on ? 780 : 600, Math.max(250, FR.h - (tight ? 690 : 760)))), draw: (ctx, cw, ch, abs) => titleHero(ctx, cw, ch, state, abs) });
  w.push({ t: 'btn', id: 'play', label: `Play  ·  ${LEVELS[nx].name}`, sub: `${COURTYARDS[LEVELS[nx].court]}  ·  ${KIND_INFO[LEVELS[nx].kind].short}`, primary: true, h: hb(92) });
  w.push({ t: 'btn', id: 'walls', label: 'Walls', sub: `${rec.stars.reduce((a, b) => a + b, 0)} of ${LEVELS.length * 3} stars`, h: hb(80) });
  w.push({ t: 'btn', id: 'daily', label: 'Daily Wall', sub: rec.daily.day === state.day && rec.daily.stars > 0 ? `Done today  ${starsStr(rec.daily.stars)}` : 'A new wall every day', h: hb(80) });
  w.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The wall is painted for you, with reasons', h: hb(80) });
  w.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: hb(72) }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: hb(72) });
  w.push({ t: 'btn', id: 'about', label: 'About', row: 2, h: hb(72) }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: hb(72) });
  w.push(lockupWidget(tight ? 54 : LOCK_H));
  return w;
}

export function wallsWidgets(state) {
  const rec = state.record, w = [];
  w.push({ t: 'h', label: 'Walls', size: 46 });
  COURTYARDS.forEach((name, c) => {
    w.push({ t: 'p', label: name, bold: true, size: 26 });
    for (let k = 0; k < 3; k++) {
      const i = c * 3 + k, l = LEVELS[i], open = levelUnlocked(rec, i) || state.dev;
      w.push({ t: 'btn', id: `w${i}`, label: `${i + 1}`, sub: open ? `${KIND_INFO[l.kind].short}  ${starsStr(rec.stars[i] || 0)}` : 'Locked', disabled: !open, row: 100 + c, h: 92 });
    }
  });
  w.push({ t: 'gap', h: 10 });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: 76 });
  return w;
}

export function settingsWidgets(state) {
  const st = state.settings, w = [];
  w.push({ t: 'h', label: 'Settings', size: 46 });
  w.push({ t: 'p', label: `Text size ${Math.round(scaleOf(state) * 100)}%`, bold: true, size: 28 });
  w.push({ t: 'btn', id: 'dec', label: 'Smaller', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'inc', label: 'Larger', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 });
  w.push({ t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 78 });
  w.push({ t: 'btn', id: 'guide', label: st.guide ? 'Colour dots: on' : 'Colour dots: off', sub: 'Show the colour each empty cell needs', h: 84 });
  w.push({ t: 'btn', id: 'think', label: `Think time: ${THINK_STEPS[st.thinkIdx]} s`, sub: 'Watch & Learn', h: 84 });
  if (!state.demo) {
    const owned = state.owned;
    w.push({ t: 'btn', id: 'restore', label: owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (owned ? 'Thank you for playing' : 'Already bought it? Get it back'), disabled: owned, h: 90 });
  }
  w.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  return w;
}

// Landscape: the heading, stars and the wall sit in a hero on the left (drawResultHero); the stats and every button are in the right column,
// so a 390-unit-tall phone never has to scroll to reach Next / Paint again / Menu / Walls.
const resultHeading = (r) => (r.stars >= 3 ? 'A fine wall!' : r.stars >= 1 ? 'Wall finished' : 'Not quite there');
export function resultWidgets(state, land = false) {
  const r = state.result, w = [];
  if (!land) {
    w.push({ t: 'h', label: resultHeading(r), size: 50, color: '#ffe3a0' });
    w.push({ t: 'p', label: starsStr(r.stars), size: 56, color: '#ffd36a', bold: true });
    w.push({ t: 'art', h: Math.round(Math.min(300, Math.max(190, FR.h * 0.22))), draw: (ctx, cw, ch, abs) => drawResultWall(ctx, cw, ch, state, abs) });
  }
  const l = [
    `${r.right} of ${r.total} cells right`,
    `${r.paintStrokes} stroke${r.paintStrokes === 1 ? '' : 's'} to paint (par ${r.par})${r.repairStrokes ? `, ${r.repairStrokes} to repair` : ''}`,
  ];
  if (r.rain) l.push(`${r.shields} drop${r.shields === 1 ? '' : 's'} shielded, ${r.washed} washed`);
  l.push(`Score ${r.score}${r.isBest ? '  ·  a new best!' : r.best ? `  ·  best ${r.best}` : ''}`);
  l.forEach((t) => w.push({ t: 'p', label: t, size: land ? 24 : 27 }));
  if (r.stars === 0) w.push({ t: 'p', label: 'Paint at least three quarters of the cells right for a star.', size: 24 });
  w.push({ t: 'gap', h: land ? 6 : 12 });
  if (r.next >= 0) w.push({ t: 'btn', id: 'next', label: `Next  ·  Wall ${r.next + 1}`, primary: true, h: land ? 64 : 88 });
  w.push({ t: 'btn', id: 'again', label: 'Paint again', primary: r.next < 0, h: land ? 58 : 80 });
  w.push({ t: 'btn', id: 'menu', label: 'Menu', row: 3, h: land ? 58 : 76 }, { t: 'btn', id: 'walls', label: 'Walls', row: 3, h: land ? 58 : 76 });
  if (!land) w.push(lockupWidget());
  return w;
}

// Left half of the landscape result screen: heading, stars, the finished wall.
function drawResultHero(ctx, state, x0, x1) {
  const r = state.result, top = topSafe(), bot = botSafe(), w = x1 - x0, cx = x0 + w / 2;
  const hs = Math.max(34, Math.min(46, (FR.h - top - bot) * 0.12));
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(hs)}px ${FONT}`; ctx.fillStyle = '#ffe3a0'; ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6;
  ctx.fillText(resultHeading(r), cx, top + hs * 0.8, w);
  ctx.font = `800 ${Math.round(hs * 1.05)}px ${FONT}`; ctx.fillStyle = '#ffd36a';
  ctx.fillText(starsStr(r.stars), cx, top + hs * 2.0, w);
  ctx.restore();
  const ay = top + hs * 2.8, ah = FR.h - bot - ay - 8;
  ctx.save(); ctx.translate(x0, ay); drawResultWall(ctx, w, ah, state, { x: x0, y: ay }); ctx.restore();
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'rules', label: 'Rules', h: 76 },
    { t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave the wall', sub: 'Your records are kept', h: 84 },
  ];
}

export function demoWidgets() {
  return [
    { t: 'h', label: 'That was the free demo', size: 44 },
    { t: 'p', label: 'Tiebele House Painting is a full game with 18 walls, a Daily Wall and Watch & Learn. Get it on iPhone and Android to play on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

// ---- flow layout cache --------------------------------------------------------------------------------------------------------
const CACHE = { key: '', lay: null, top: 0, bottom: 0, x: 0, w: 0, max: 0 };
export function flowGeom(scene, land) {
  const top = topSafe() + (scene === 'title' && !land ? 6 : 0), bottom = FR.h - botSafe();
  if (scene === 'title' && land) {
    const w = Math.max(340, Math.min(500, FR.w * 0.34));
    return { top, bottom, x: FR.w - FR.r - w - Math.max(24, FR.w * 0.05), w };
  }
  if (scene === 'result' && land) {
    const w = Math.max(340, Math.min(460, FR.w * 0.36));
    return { top, bottom, x: FR.w - FR.r - w - 24, w };
  }
  const w = scene === 'pause' ? Math.min(colW(), 560) : colW();
  return { top, bottom, x: scene === 'pause' ? FR.l + (FR.w - FR.l - FR.r - w) / 2 : colX(), w };
}
export function widgetsFor(state, scene) {
  switch (scene) {
    case 'title': return titleWidgets(state, FR.land);
    case 'walls': return wallsWidgets(state);
    case 'settings': return settingsWidgets(state);
    case 'result': return resultWidgets(state, FR.land);
    case 'pause': return pauseWidgets(state);
    case 'demolimit': return demoWidgets();
    default: return [];
  }
}
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.record.stars.join('')}|${state.record.daily.stars}|${state.day}|${state.result ? state.result.score + ':' + state.result.stars : ''}|${state.dev}|${!!state.owned}|${state.restoreMsg}|${!!state.demo}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const lay = flowLayout(metrics, widgetsFor(state, scene), scale, { x: 0, w: g.w, btn: 28 });
  const room = g.bottom - g.top - lay.contentH;
  Object.assign(CACHE, { key, lay, top: g.top + (room > 0 ? Math.min(room / 2, scene === 'title' ? 90 : 140) : 0), bottom: g.bottom, x: g.x, w: g.w, max: Math.max(0, lay.contentH - (g.bottom - g.top)) });
  return CACHE;
}
export function hitFlow(state, scene, x, y, scroll) {
  const c = ensureLayout(state, scene);
  return flowHit(c.lay, c.top, scroll, x - c.x, y);
}
export const flowMax = (state, scene) => ensureLayout(state, scene).max;
export function flowRects(state, scene, scroll) {
  const c = ensureLayout(state, scene), out = [];
  for (const it of c.lay.items) if (it.w.t === 'btn') out.push({ id: it.w.id, x: c.x + it.x, y: c.top + it.y - scroll, w: it.wd, h: it.h });
  return out;
}

// ---- drawing --------------------------------------------------------------------------------------------------------------------
export function drawYard(ctx, state, a = 0.5) {
  if (v3.on) { v3.scrim = Math.max(v3.scrim, Math.min(0.62, a * 0.9)); return; }
  drawBackdrop(ctx, FR.w, FR.h, state.t, 0);
  ctx.fillStyle = `rgba(30,12,4,${a})`; ctx.fillRect(0, 0, FR.w, FR.h);
}

function titleHero(ctx, w, h, state, abs = { x: 0, y: 0 }) {
  if (v3.on) {
    // 3D: the lettering sits on a painted plaster plaque above the live wall (the painter's hand is working on it)
    const ph = Math.min(h * 0.28, 176), px = abs.x + w * 0.03, pw = w * 0.94;
    v3.panels.push({ r: { x: px, y: abs.y, w: pw, h: ph }, rad: 24, kind: 'title', clip: null });
    wordmark(ctx, 'TIEBELE', w / 2, ph * 0.38, Math.min(ph * 0.42, 84), w * 0.78);
    ctx.save(); ctx.font = `900 ${Math.round(Math.min(32, ph * 0.15))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,16,4,0.9)';
    const sub = 'HOUSE PAINTING', y = ph * 0.74;
    ctx.strokeText(sub, w / 2, y, w * 0.8); ctx.fillStyle = '#ffd68a'; ctx.fillText(sub, w / 2, y, w * 0.8);
    ctx.font = `700 ${Math.round(Math.min(19, h * 0.05))}px ${NUM}`; ctx.fillStyle = 'rgba(255,240,205,0.98)';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(30,12,2,0.8)';
    ctx.strokeText('KASSENA WALLS  ·  BURKINA FASO', w / 2, h - 14, w * 0.9); ctx.fillText('KASSENA WALLS  ·  BURKINA FASO', w / 2, h - 14, w * 0.9);
    ctx.restore();
    v3.heroRect = { x: px, y: abs.y + ph + 8, w: pw, h: Math.max(80, h - ph - 40) };
    return;
  }
  drawHero(ctx, w, h, state.t);
  const bandH = Math.min(26, h * 0.07);
  triangleBand(ctx, w * 0.06, h - bandH - 8, w * 0.88, bandH, 16);
  wordmark(ctx, 'TIEBELE', w / 2, h * 0.2, Math.min(h * 0.2, 80), w * 0.8);
  ctx.save(); ctx.font = `900 ${Math.round(Math.min(34, h * 0.1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(40,16,4,0.9)';
  const sub = 'HOUSE PAINTING', y = h * 0.34;
  ctx.strokeText(sub, w / 2, y, w * 0.8); ctx.fillStyle = '#fff2cf'; ctx.fillText(sub, w / 2, y, w * 0.8);
  ctx.restore();
  ctx.save(); ctx.font = `700 ${Math.round(Math.min(20, h * 0.055))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,240,205,0.95)'; ctx.fillText('KASSENA WALLS  ·  BURKINA FASO', w / 2, h - bandH - 22, w * 0.9); ctx.restore();
}

function drawResultWall(ctx, w, h, state, abs = { x: 0, y: 0 }) {
  const r = state.result, wall = r.wall;
  const cs = Math.floor(Math.min((w - 20) / wall.W, (h - 16) / wall.H)), gw = cs * wall.W, gh = cs * wall.H, ox = (w - gw) / 2, oy = (h - gh) / 2;
  if (v3.on) { drawWall(ctx, wall, { cs, ox: abs.x + ox, oy: abs.y + oy }, r.cells, { three: true, wrong: r.wrong, marks: false }); return; }
  drawPanel(ctx, { x: ox, y: oy, w: gw, h: gh });
  drawWall(ctx, wall, { cs, ox, oy }, r.cells, { wrong: r.wrong, marks: false });
}

function drawFlowIn(ctx, state, scene, scroll) {
  const c = ensureLayout(state, scene);
  ctx.save(); ctx.translate(c.x, 0);
  drawFlow(ctx, c.lay, c.top, c.bottom, Math.min(scroll, c.max), c.x);
  ctx.restore();
  if (c.max > 0) scrollHint(ctx, c, Math.min(scroll, c.max));
}
function scrollHint(ctx, c, scroll) {
  const x = c.x + c.w + 8, th = c.bottom - c.top, kh = Math.max(36, th * (th / (th + c.max))), ky = c.top + (th - kh) * (scroll / c.max);
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; roundPath(ctx, Math.min(x, FR.w - FR.r - 8), ky, 5, kh, 3); ctx.fill();
}

export function renderTitle(ctx, state) {
  drawYard(ctx, state, 0.3);
  if (FR.land) {
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    const hx = FR.l + (g.x - FR.l - hw) / 2, hy = topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2;
    ctx.save(); ctx.translate(hx, hy); titleHero(ctx, hw, hh, state, { x: hx, y: hy }); ctx.restore();
  }
  drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
export function renderFlow(ctx, state, scene, a = 0.55) {
  drawYard(ctx, state, a);
  if (scene === 'result' && FR.land && state.result) drawResultHero(ctx, state, FR.l + 16, flowGeom('result', true).x - 16);
  drawFlowIn(ctx, state, scene, state.ui.scroll);
}
export function renderModal(ctx, state, scene) {
  if (v3.on) v3.scrim = 0.6; else { ctx.fillStyle = 'rgba(20,8,2,0.68)'; ctx.fillRect(0, 0, FR.w, FR.h); }
  const c = ensureLayout(state, scene);
  panel(ctx, c.x - 26, Math.max(topSafe(), c.top - 30), c.w + 52, Math.min(FR.h - topSafe() - botSafe(), c.lay.contentH + 56), { r: 28, front: true });
  drawFlowIn(ctx, state, scene, state.ui.scroll);
}

// ---- the reader ------------------------------------------------------------------------------------------------------------------
export const DOCS = { howto: { list: HOWTO, name: 'How to Play' }, about: { list: ABOUT, name: 'About' }, rules: { list: RULES, name: 'Rules' } };
const readerCache = { key: '', lay: null, max: 0, artH: 0 };
export function readerState(state, scene) {
  const L = readerLayout(), doc = DOCS[scene], page = Math.max(0, Math.min(doc.list.length - 1, state.ui.page)), pg = doc.list[page];
  const scale = scaleOf(state), w = L.text.w;
  const key = `${scene}|${page}|${scale}|${Math.round(w)}|${Math.round(L.text.h)}`;
  if (readerCache.key !== key) {
    const widgets = [];
    const zoomK = scale > 2 ? 0.55 : 1;
    const artH = pg.art ? Math.round(zoomK * Math.min(L.land ? 250 : 300, Math.max(150, L.text.h * 0.34))) : 0;
    if (pg.art) widgets.push({ t: 'art', h: artH, draw: (ctx, aw, ah) => drawDiagram(pg.art, ctx, aw, ah) });
    widgets.push({ t: 'h', label: pg.title, size: 40, cap: 1.5 });
    pg.text.forEach((p) => widgets.push({ t: 'p', label: p, size: 27, align: 'left' }));
    const lay = flowLayout(metrics, widgets, scale, { x: 0, w });
    Object.assign(readerCache, { key, lay, max: Math.max(0, lay.contentH - L.text.h), artH });
  }
  return { L, doc, page, pg, ...readerCache };
}
export function renderReader(ctx, state, scene) {
  drawYard(ctx, state, 0.62);
  const r = readerState(state, scene), L = r.L;
  ctx.save(); ctx.font = `800 34px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, r.doc.name, L.title.x, L.title.y, '#ffe3a0', 6);
  ctx.restore();
  paintBtn(ctx, L.dec, 'A−', state.settings.textIdx === 0);
  paintBtn(ctx, L.inc, 'A+', state.settings.textIdx === TEXT_SCALES.length - 1);
  ctx.save(); ctx.font = `700 22px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff1d2';
  ctx.fillText(`${Math.round(scaleOf(state) * 100)}%`, L.pct.x, L.pct.y); ctx.restore();
  panel(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, { r: 26 });
  ctx.save(); ctx.beginPath(); ctx.rect(L.text.x - 6, L.text.y, L.text.w + 12, L.text.h); ctx.clip();
  const sc = Math.min(state.ui.scroll, r.max);
  ctx.translate(L.text.x, L.text.y - sc);
  drawFlow(ctx, r.lay, 0, 100000, 0);
  ctx.restore();
  if (r.max > 0) {
    const th = L.text.h, kh = Math.max(30, th * (th / (th + r.max))), ky = L.text.y + (th - kh) * (sc / r.max);
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; roundPath(ctx, L.panel.x + L.panel.w - 12, ky, 5, kh, 3); ctx.fill();
  }
  ctx.save(); ctx.font = `700 22px ${NUM}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0';
  ctx.fillText(`${r.page + 1} / ${r.doc.list.length}`, L.counter.x, L.counter.y); ctx.restore();
  const last = r.page === r.doc.list.length - 1;
  paintBtn(ctx, L.back, r.page === 0 ? 'Close' : 'Back', false, false);
  paintBtn(ctx, L.next, last ? 'Done' : 'Next', false, !last);
}
function paintBtn(ctx, r, label, disabled, primary = false) {
  const { dy } = paintButton(ctx, r, { disabled, primary });
  ctx.save(); ctx.fillStyle = disabled ? 'rgba(255,255,255,0.35)' : primary ? C.ink : '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.min(30, Math.round(r.h * 0.4))}px ${FONT}`; ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + dy); ctx.restore();
}
export { wrapLines };
