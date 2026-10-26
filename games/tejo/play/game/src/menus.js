// Every screen that is not the play screen: title, set-up, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { FR, TEXT_SCALES, THINK_STEPS, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { drawBackdrop, drawHero, drawDiagram, wordmark, drawDisc, TEAM } from './art.js';
import { drawLockupImg } from './brand.js';
import { v3 } from './v3.js';
import { LEVELS, TARGETS } from './sim.js';
import { HOWTO, ABOUT, RULES } from './content.js';

// ---- text measuring that does not need a canvas -------------------------------------------------------------------------
export const metrics = {
  font: '16px sans-serif',
  measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); const sz = m ? Number(m[1]) : 16; return { width: String(t).length * sz * 0.58 }; },
};

const LOCK_H = 74;
const TARGET_NAMES = ['Quick', 'Standard', 'Classic'];
export const scaleOf = (state) => TEXT_SCALES[state.settings.textIdx];

// ---- widget lists -------------------------------------------------------------------------------------------------------------
const lockupWidget = () => ({ t: 'art', id: 'arcforge', hitW: 300, h: LOCK_H + 16, draw(ctx, w) { drawLockupImg(ctx, w / 2, 8, LOCK_H, { align: 'center' }); } });

export function titleWidgets(state, land) {
  const w = [];
  if (!land) w.push({ t: 'art', h: Math.round(v3.on ? Math.min(520, Math.max(240, FR.h - topSafe() - botSafe() - 1010)) : Math.min(380, Math.max(240, FR.h * 0.24))), draw: (ctx, cw, ch) => titleHero(ctx, cw, ch, state) });
  if (state.resume) w.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: resumeLine(state.resume), primary: true, h: 92 });
  w.push({ t: 'btn', id: 'ai', label: 'Play the computer', primary: !state.resume, h: land ? 76 : 88 });
  w.push({ t: 'btn', id: 'two', label: 'Two players', sub: 'Pass the phone', h: land ? 70 : 80 });
  w.push({ t: 'btn', id: 'solo', label: 'Practice', sub: state.record.practiceBest ? `Best ${state.record.practiceBest}` : 'Twelve discs on your own', h: land ? 70 : 80 });
  w.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two players show how it is done', h: land ? 70 : 80 });
  w.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: land ? 64 : 72 }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: land ? 64 : 72 });
  w.push({ t: 'btn', id: 'about', label: 'About', row: 2, h: land ? 64 : 72 }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: land ? 64 : 72 });
  w.push(lockupWidget());
  return w;
}
const resumeLine = (r) => `${r.cfg.mode === 'two' ? 'Two players' : r.cfg.mode === 'solo' ? 'Practice' : LEVELS[r.cfg.opp].name}  ${r.score[0]} : ${r.score[1]}`;

export function setupWidgets(state, land = false) {
  const s = state.setup, two = s.mode === 'two', w = [];
  w.push({ t: 'h', label: two ? 'Two players' : 'Play the computer', size: 46 });
  if (!two) {
    w.push({ t: 'p', label: 'Opponent', bold: true, size: 26 });
    LEVELS.forEach((l, i) => w.push({ t: 'btn', id: `lv${i}`, label: l.name, sub: l.note, active: s.opp === i, h: land ? 76 : 82, ...(land ? { row: 8 + (i >> 1) } : {}) }));
  }
  w.push({ t: 'p', label: 'First to', bold: true, size: 26 });
  TARGETS.forEach((n, i) => w.push({ t: 'btn', id: `tg${i}`, label: `${n}`, sub: TARGET_NAMES[i], active: s.target === i, row: 7, h: 84 }));
  w.push({ t: 'gap', h: 10 });
  // Landscape phones are only 720 units tall: Start and Back share one row so they never fall below the fold.
  w.push({ t: 'btn', id: 'start', label: 'Start', primary: true, h: land ? 80 : 92, ...(land ? { row: 20 } : {}) });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: land ? 80 : 76, ...(land ? { row: 20 } : {}) });
  return w;
}

export function settingsWidgets(state, land = false) {
  const st = state.settings, w = [], R = (n) => (land ? { row: n } : {});
  w.push({ t: 'h', label: 'Settings', size: 46 });
  w.push({ t: 'p', label: `Text size ${Math.round(scaleOf(state) * 100)}%`, bold: true, size: 28 });
  w.push({ t: 'btn', id: 'dec', label: 'Smaller', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'inc', label: 'Larger', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 });
  w.push({ t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 78, ...R(2) });
  w.push({ t: 'btn', id: 'guide', label: st.guide ? 'Aim guide: on' : 'Aim guide: off', sub: 'Dashed arc and scatter circle', h: 84, ...R(2) });
  w.push({ t: 'btn', id: 'think', label: `Think time: ${THINK_STEPS[st.thinkIdx]} s`, sub: 'Watch & Learn', h: 84, ...R(3) });
  if (!state.demo) {
    const owned = state.owned;
    w.push({ t: 'btn', id: 'restore', label: owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (owned ? 'Thank you for playing' : 'Already bought it? Get it back'), disabled: owned, h: 90, ...R(3) });
  }
  w.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  return w;
}

export function resultWidgets(state) {
  const m = state.m, w = [];
  const names = sideNames(m.cfg);
  const solo = m.cfg.mode === 'solo';
  const title = solo ? 'Practice done' : m.winner < 0 ? 'Match over' : winLine(names[m.winner]);
  w.push({ t: 'h', label: title, size: 52, color: '#ffe08a' });
  if (!solo) w.push({ t: 'p', label: `${names[0]} ${m.score[0]}  :  ${m.score[1]} ${names[1]}`, bold: true, size: 36 });
  const sum = (a) => a[0] + a[1];
  const sd = solo || m.cfg.mode === 'ai' ? 0 : -1, get = (a) => (sd < 0 ? sum(a) : a[sd]);
  const who = sd < 0 ? 'Together: ' : '';
  const lines = [`${who}Rings ${get(m.stats.rings)}   Pops ${get(m.stats.pops)}   Moñonas ${get(m.stats.monas)}`, `${sum(m.stats.throws)} discs thrown in ${m.round} round${m.round === 1 ? '' : 's'}`];
  if (solo) lines.push(m.score[0] > state.prevBest ? 'A new best!' : `Best ${state.record.practiceBest}`);
  lines.forEach((l) => w.push({ t: 'p', label: l, size: 28 }));
  w.push({ t: 'gap', h: 14 });
  w.push({ t: 'btn', id: 'again', label: 'Play again', primary: true, h: 92 });
  w.push({ t: 'btn', id: 'menu', label: 'Menu', h: 80 });
  w.push(lockupWidget());
  return w;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 46 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'rules', label: 'Rules', h: 76 },
    { t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 76 },
    { t: 'btn', id: 'quit', label: 'Leave match', sub: 'Your progress is kept', h: 84 },
  ];
}

export function demoWidgets() {
  return [
    { t: 'h', label: 'That was the free demo', size: 44 },
    { t: 'p', label: 'Tejo is a full game with computer opponents, practice and Watch & Learn. Get it on iPhone and Android to play on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

export const winLine = (name) => (name === 'You' ? 'You win!' : `${name} wins!`);
export function sideNames(cfg) {
  if (cfg.mode === 'ai') return ['You', LEVELS[cfg.opp].name];
  if (cfg.mode === 'two') return ['Gold', 'Blue'];
  if (cfg.mode === 'solo') return ['You', ''];
  return [LEVELS[cfg.watch[0]].name, LEVELS[cfg.watch[1]].name];
}

// ---- flow layout cache --------------------------------------------------------------------------------------------------------
const CACHE = { key: '', lay: null, top: 0, bottom: 0, x: 0, w: 0, max: 0 };
export function flowGeom(scene, land) {
  const top = topSafe() + (scene === 'title' && !land ? 6 : 0) + (FR.back && FR.t < 30 ? 0 : 0), bottom = FR.h - botSafe();
  if (scene === 'title' && land) {
    const w = Math.max(440, Math.min(520, FR.w * 0.4));
    return { top, bottom, x: FR.w - FR.r - w - Math.max(24, FR.w * 0.05), w };
  }
  const wide = FR.land && (scene === 'setup' || scene === 'settings');   // two-column screens on landscape phones
  const w = scene === 'pause' ? Math.min(colW(), 560) : wide ? Math.min(900, FR.w - FR.l - FR.r - 80) : colW();
  return { top, bottom, x: scene === 'pause' ? FR.l + (FR.w - FR.l - FR.r - w) / 2 : colX(), w };
}
export function widgetsFor(state, scene) {
  switch (scene) {
    case 'title': return titleWidgets(state, FR.land);
    case 'setup': return setupWidgets(state, FR.land);
    case 'settings': return settingsWidgets(state, FR.land);
    case 'result': return resultWidgets(state);
    case 'pause': return pauseWidgets(state);
    case 'demolimit': return demoWidgets();
    default: return [];
  }
}
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.setup.opp}|${state.setup.target}|${state.setup.mode}|${!!state.resume}|${state.m ? state.m.winner + ':' + state.m.score.join('-') : ''}|${state.record.practiceBest}|${!!state.owned}|${state.restoreMsg}|${!!state.demo}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const lay = flowLayout(metrics, widgetsFor(state, scene), scale, { x: 0, w: g.w, btn: FR.land && (scene === 'setup' || scene === 'settings' || scene === 'title') ? 25 : 28 });
  // centre short screens vertically (not the title: it stays at the top)
  const room = g.bottom - g.top - lay.contentH;
  Object.assign(CACHE, { key, lay, top: g.top + (room > 0 && scene !== 'title' ? Math.min(room / 2, 140) : 0), bottom: g.bottom, x: g.x, w: g.w, max: Math.max(0, lay.contentH - (g.bottom - g.top)) });
  return CACHE;
}
// The id of the button at screen point (x, y), or null.
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
export function drawCourt(ctx, state, a = 0.6) {
  const w = FR.w, h = FR.h;
  if (v3.on) {   // the 3D court is behind this canvas: only a scrim so the text stays readable
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, `rgba(10,6,26,${a * 0.55})`); g.addColorStop(1, `rgba(10,6,26,${Math.min(0.92, a * 1.15)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); return;
  }
  drawBackdrop(ctx, w, h, state.t, { horizon: h * 0.42, ground: h * 0.58, laneHalf: Math.min(w, h) * 0.12, cx: w / 2 });
  ctx.fillStyle = `rgba(10,6,26,${a})`; ctx.fillRect(0, 0, w, h);
}

function titleHero(ctx, w, h, state) {
  if (!v3.on) drawHero(ctx, w, h, state.t);
  const sz = Math.min(h * (v3.on ? 0.3 : 0.34), 120), cy = h * (v3.on ? 0.2 : 0.3);
  wordmark(ctx, 'TEJO', w / 2, cy, sz);
  // a small brass plaque under the name
  const sub = 'TURMEQUÉ  ·  COLOMBIA', fs = Math.round(Math.min(26, h * 0.075)), y = cy + sz * 0.62 + fs * 0.9;
  ctx.save(); ctx.font = `800 ${fs}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(sub).width + 44;
  roundPath(ctx, w / 2 - tw / 2, y - fs * 0.85, tw, fs * 1.7, fs * 0.85);
  const g = ctx.createLinearGradient(0, y - fs, 0, y + fs); g.addColorStop(0, 'rgba(70,44,22,0.92)'); g.addColorStop(1, 'rgba(30,18,10,0.92)');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(240,190,90,0.9)'; ctx.stroke();
  ctx.fillStyle = '#ffe6a8'; ctx.fillText(sub, w / 2, y + 1);
  ctx.restore();
}

function drawFlowIn(ctx, state, scene, scroll) {
  const c = ensureLayout(state, scene);
  ctx.save(); ctx.translate(c.x, 0);
  drawFlow(ctx, c.lay, c.top, c.bottom, Math.min(scroll, c.max));
  ctx.restore();
  if (c.max > 0) scrollHint(ctx, c, Math.min(scroll, c.max));
}
function scrollHint(ctx, c, scroll) {
  const x = c.x + c.w + 8, th = c.bottom - c.top, kh = Math.max(36, th * (th / (th + c.max))), ky = c.top + (th - kh) * (scroll / c.max);
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; roundPath(ctx, Math.min(x, FR.w - FR.r - 8), ky, 5, kh, 3); ctx.fill();
}

export function renderTitle(ctx, state) {
  drawCourt(ctx, state, v3.on ? 0.1 : 0.35);
  v3.heroRect = null;
  if (FR.land) {
    // hero and name on the left, buttons right
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    const hx = FR.l + (g.x - FR.l - hw) / 2, hy = topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2;
    v3.heroRect = { x: FR.l, y: topSafe(), w: g.x - FR.l - 10, h: FR.h - topSafe() - botSafe() };
    ctx.save(); ctx.translate(hx, hy); titleHero(ctx, hw, hh, state); ctx.restore();
  } else {
    const c = ensureLayout(state, 'title'), it = c.lay.items.find((q) => q.w.t === 'art' && !q.w.id);
    if (it) { const y0 = c.top + it.y - Math.min(state.ui.scroll, c.max); v3.heroRect = { x: c.x + it.x, y: y0 + it.h * 0.28, w: it.wd, h: it.h * 0.72 }; }
  }
  drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
export function renderFlow(ctx, state, scene, a = 0.72) {
  if (v3.on) {
    // the 3D court stays visible behind a carved plaque that carries the controls and text
    drawCourt(ctx, state, 0.28);
    const c = ensureLayout(state, scene), padY = 26, y0 = Math.max(topSafe() - 6, c.top - padY), y1 = Math.min(FR.h - botSafe() + 6, c.top + c.lay.contentH + padY);
    panel(ctx, c.x - 26, y0, c.w + 52, y1 - y0, { r: 28 });
    v3.heroRect = y1 + 260 < FR.h ? { x: 0, y: y1 + 10, w: FR.w, h: FR.h - y1 - 20 } : null;
    drawFlowIn(ctx, state, scene, state.ui.scroll);
    return;
  }
  drawCourt(ctx, state, a); drawFlowIn(ctx, state, scene, state.ui.scroll);
}
export function renderModal(ctx, state, scene) {
  ctx.fillStyle = 'rgba(8,4,20,0.66)'; ctx.fillRect(0, 0, FR.w, FR.h);
  const c = ensureLayout(state, scene);
  panel(ctx, c.x - 26, Math.max(topSafe(), c.top - 30), c.w + 52, Math.min(FR.h - topSafe() - botSafe(), c.lay.contentH + 56), { r: 28 });
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
    const artH = pg.art ? Math.round(Math.min(L.land ? 250 : 300, Math.max(150, L.text.h * 0.34))) : 0;
    if (pg.art) widgets.push({ t: 'art', h: artH, draw: (ctx, aw, ah) => drawDiagram(pg.art, ctx, aw, ah) });
    widgets.push({ t: 'h', label: pg.title, size: 40, cap: 1.5 });
    pg.text.forEach((p) => widgets.push({ t: 'p', label: p, size: 27, align: 'left' }));
    const lay = flowLayout(metrics, widgets, scale, { x: 0, w });
    Object.assign(readerCache, { key, lay, max: Math.max(0, lay.contentH - L.text.h), artH });
  }
  return { L, doc, page, pg, ...readerCache };
}
export function renderReader(ctx, state, scene) {
  drawCourt(ctx, state, v3.on ? 0.5 : 0.78); v3.heroRect = null;
  const r = readerState(state, scene), L = r.L;
  // header
  ctx.save(); ctx.font = `800 ${Math.round(34)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, r.doc.name, L.title.x, L.title.y, '#ffe08a', 6);
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
export { wrapLines, drawDisc, TEAM };
