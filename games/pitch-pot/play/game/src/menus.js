// Every screen that is not the play screen: title, set-up, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { FR, TEXT_SCALES, THINK_STEPS, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { drawBackdrop, drawHero, drawDiagram, wordmark, TEAM, SERIF } from './art.js';
import { drawLockupImg } from './brand.js';
import { LEVELS, STYLES, LENGTHS, LENGTH_NAMES, DISTANCES } from './sim.js';
import { HOWTO, ABOUT, RULES } from './content.js';

// ---- text measuring that does not need a canvas -------------------------------------------------------------------------
export const metrics = {
  font: '16px sans-serif',
  measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); const sz = m ? Number(m[1]) : 16; return { width: String(t).length * sz * 0.58 }; },
};

const LOCK_H = 74;
export const scaleOf = (state) => TEXT_SCALES[state.settings.textIdx];

// ---- widget lists -------------------------------------------------------------------------------------------------------------
const lockupWidget = () => ({ t: 'art', id: 'arcforge', hitW: 300, h: LOCK_H + 16, draw(ctx, w) { drawLockupImg(ctx, w / 2, 8, LOCK_H, { align: 'center' }); } });

export function titleWidgets(state, land) {
  const w = [];
  // the live 3D pavilion shows through the hero slot; the wordmark is painted over it
  if (!land) w.push({ t: 'art', h: Math.round(Math.max(250, Math.min(FR.h * 0.5, FR.h - 640 - topSafe() - botSafe()))), draw: (ctx, cw, ch) => titleHero(ctx, cw, ch, state) });
  if (state.resume) w.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: resumeLine(state.resume), primary: true, icon: 'resume', h: 92 });
  w.push({ t: 'btn', id: 'ai', label: 'Play the computer', primary: !state.resume, icon: 'play', h: 88 });
  w.push({ t: 'btn', id: 'two', label: 'Two players', sub: 'Pass the phone', row: 3, icon: 'two', h: 84 }, { t: 'btn', id: 'solo', label: 'Practice', sub: state.record.practiceBest ? `Best ${state.record.practiceBest}` : 'On your own', row: 3, icon: 'solo', h: 84 });
  w.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two players show how it is done', icon: 'watch', h: 80 });
  w.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1, icon: 'howto', h: 68 }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, icon: 'rules', h: 68 });
  w.push({ t: 'btn', id: 'about', label: 'About', row: 2, icon: 'about', h: 68 }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, icon: 'settings', h: 68 });
  w.push(lockupWidget());
  return w;
}
const resumeLine = (r) => `${r.cfg.mode === 'two' ? 'Two players' : r.cfg.mode === 'solo' ? 'Practice' : LEVELS[r.cfg.opp].name}  ${r.score[0]} : ${r.score[1]}`;

export function setupWidgets(state) {
  const s = state.setup, two = s.mode === 'two', w = [];
  w.push({ t: 'h', label: two ? 'Two players' : 'Play the computer', size: 46 });
  if (!two) {
    w.push({ t: 'p', label: 'Opponent', bold: true, size: 26 });
    LEVELS.forEach((l, i) => w.push({ t: 'btn', id: `lv${i}`, label: l.name, sub: l.note, active: s.opp === i, h: 82 }));
  }
  w.push({ t: 'p', label: 'Scoring style', bold: true, size: 26 });
  STYLES.forEach((st, i) => w.push({ t: 'btn', id: `st${i}`, label: st.name, sub: st.note, active: s.style === i, h: 82 }));
  w.push({ t: 'p', label: s.style === 0 ? 'Rounds' : 'First to', bold: true, size: 26 });
  LENGTH_NAMES.forEach((n, i) => w.push({ t: 'btn', id: `ln${i}`, label: `${LENGTHS[STYLES[s.style].id][i]}`, sub: n, active: s.len === i, row: 7, h: 84 }));
  w.push({ t: 'p', label: 'Distance', bold: true, size: 26 });
  DISTANCES.forEach((d, i) => w.push({ t: 'btn', id: `ds${i}`, label: d.name, sub: d.note, active: state.settings.dist === i, row: 8, h: 84 }));
  w.push({ t: 'gap', h: 10 });
  w.push({ t: 'btn', id: 'start', label: 'Start', primary: true, h: 92 });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: 76 });
  return w;
}

export function settingsWidgets(state) {
  const st = state.settings, w = [];
  w.push({ t: 'h', label: 'Settings', size: 46 });
  w.push({ t: 'p', label: `Text size ${Math.round(scaleOf(state) * 100)}%`, bold: true, size: 28 });
  w.push({ t: 'btn', id: 'dec', label: 'Smaller', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'inc', label: 'Larger', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 });
  w.push({ t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 78 });
  w.push({ t: 'btn', id: 'guide', label: st.guide ? 'Aim guide: on' : 'Aim guide: off', sub: 'Dotted path and spread bar', h: 84 });
  w.push({ t: 'btn', id: 'dist', label: `Distance: ${DISTANCES[st.dist].name}`, sub: DISTANCES[st.dist].note, h: 84 });
  w.push({ t: 'btn', id: 'think', label: `Think time: ${THINK_STEPS[st.thinkIdx]} s`, sub: 'Watch & Learn', h: 84 });
  if (!state.demo) {
    const owned = state.owned;
    w.push({ t: 'btn', id: 'restore', label: owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (owned ? 'Thank you for playing' : 'Already bought it? Get it back'), disabled: owned, h: 90 });
  }
  w.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  return w;
}

export function resultWidgets(state) {
  const m = state.m, w = [];
  const names = sideNames(m.cfg);
  const solo = m.cfg.mode === 'solo';
  const title = solo ? 'Practice done' : m.winner < 0 ? 'Match over' : winLine(names[m.winner]);
  w.push({ t: 'h', label: title, size: 52, color: '#ffd98a' });
  if (!solo) w.push({ t: 'p', label: `${names[0]} ${m.score[0]}  :  ${m.score[1]} ${names[1]}`, bold: true, size: 36 });
  const sum = (a) => a[0] + a[1];
  const sd = solo || m.cfg.mode === 'ai' ? 0 : -1, get = (a) => (sd < 0 ? sum(a) : a[sd]);
  const who = sd < 0 ? 'Together: ' : '';
  const lines = [`${who}Mouth ${get(m.stats.mouth)}   Bounce-ins ${get(m.stats.bounce)}   Ears ${get(m.stats.ear)}`, `${sum(m.stats.throws)} arrows thrown in ${m.round} round${m.round === 1 ? '' : 's'}`];
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
    { t: 'p', label: 'Pitch Pot is a full game with computer opponents, practice and Watch & Learn. Get it on iPhone and Android to play on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

export const winLine = (name) => (name === 'You' ? 'You win!' : `${name} wins!`);
export function sideNames(cfg) {
  if (cfg.mode === 'ai') return ['You', LEVELS[cfg.opp].name];
  if (cfg.mode === 'two') return ['Red', 'Jade'];
  if (cfg.mode === 'solo') return ['You', ''];
  return [LEVELS[cfg.watch[0]].name, LEVELS[cfg.watch[1]].name];
}

// ---- flow layout cache --------------------------------------------------------------------------------------------------------
const CACHE = { key: '', lay: null, top: 0, bottom: 0, x: 0, w: 0, max: 0 };
export function flowGeom(scene, land) {
  const top = topSafe() + (scene === 'title' && !land ? 6 : 0) + (FR.back && FR.t < 30 ? 0 : 0), bottom = FR.h - botSafe();
  if (scene === 'title' && land) {
    const w = Math.max(540, Math.min(580, FR.w * 0.4));
    return { top, bottom, x: FR.w - FR.r - w - Math.max(24, FR.w * 0.05), w };
  }
  const w = scene === 'pause' ? Math.min(colW(), 560) : colW();
  return { top, bottom, x: scene === 'pause' ? FR.l + (FR.w - FR.l - FR.r - w) / 2 : colX(), w };
}
export function widgetsFor(state, scene) {
  switch (scene) {
    case 'title': return titleWidgets(state, FR.land);
    case 'setup': return setupWidgets(state);
    case 'settings': return settingsWidgets(state);
    case 'result': return resultWidgets(state);
    case 'pause': return pauseWidgets(state);
    case 'demolimit': return demoWidgets();
    default: return [];
  }
}
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.setup.opp}|${state.setup.style}|${state.setup.len}|${state.settings.dist}|${state.setup.mode}|${!!state.resume}|${state.m ? state.m.winner + ':' + state.m.score.join('-') : ''}|${state.record.practiceBest}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const lay = flowLayout(metrics, widgetsFor(state, scene), scale, { x: 0, w: g.w, btn: 28 });
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
  if (state.has3d) { ctx.fillStyle = `rgba(14,9,6,${a})`; ctx.fillRect(0, 0, w, h); return; }
  drawBackdrop(ctx, w, h, state.t, { ox: w / 2, cx: 0, s: Math.max(2, Math.min(w, h) / 200), floorY: Math.round(h * 0.86) });
  ctx.fillStyle = `rgba(14,9,6,${a})`; ctx.fillRect(0, 0, w, h);
}

function titleHero(ctx, w, h, state) {
  if (!state.has3d) drawHero(ctx, w, h, state.t);
  wordmark(ctx, 'PITCH POT', w / 2, h * 0.17, Math.min(h * 0.22, 104), w * 0.94);
  ctx.save(); ctx.font = `800 ${Math.round(Math.min(26, h * 0.075))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,9,6,0.9)';
  const sub = '投壺  ·  TUHO  ·  CHINA AND KOREA', y = h * 0.32;
  ctx.strokeText(sub, w / 2, y, w * 0.96); ctx.fillStyle = '#ffe9b0'; ctx.fillText(sub, w / 2, y, w * 0.96);
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
  drawCourt(ctx, state, state.has3d ? 0 : 0.35);
  if (state.has3d) shadeTitle(ctx, state);
  if (FR.land) {
    // hero and name on the left, buttons right
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    state.hero = { x: FR.l + (g.x - FR.l - hw) / 2, y: topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2, w: hw, h: hh };
    ctx.save(); ctx.translate(FR.l + (g.x - FR.l - hw) / 2, topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2); titleHero(ctx, hw, hh, state); ctx.restore();
  }
  else {
    const c = ensureLayout(state, 'title'), it = c.lay.items.find((i) => i.w.t === 'art' && !i.w.id);
    if (it) state.hero = { x: c.x + it.x, y: c.top + it.y, w: it.wd, h: it.h };
  }
  drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
// A soft dark gradient behind the menu column so the buttons read over the live 3D scene, and a light one at the top for the wordmark.
function shadeTitle(ctx, state) {
  const g = flowGeom('title', FR.land);
  if (FR.land) {
    const x0 = g.x - 60, gr = ctx.createLinearGradient(x0, 0, x0 + 90, 0);
    gr.addColorStop(0, 'rgba(14,9,6,0)'); gr.addColorStop(1, 'rgba(14,9,6,0.82)');
    ctx.fillStyle = gr; ctx.fillRect(x0, 0, FR.w - x0, FR.h);
    const tg = ctx.createLinearGradient(0, 0, 0, FR.h * 0.3); tg.addColorStop(0, 'rgba(14,9,6,0.55)'); tg.addColorStop(1, 'rgba(14,9,6,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, x0, FR.h * 0.3);
  } else {
    const tg = ctx.createLinearGradient(0, 0, 0, FR.h * 0.3); tg.addColorStop(0, 'rgba(14,9,6,0.6)'); tg.addColorStop(1, 'rgba(14,9,6,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, FR.w, FR.h * 0.3);
    const y0 = state.hero ? state.hero.y + state.hero.h * 0.6 : FR.h * 0.3, gr = ctx.createLinearGradient(0, y0, 0, y0 + 160);
    gr.addColorStop(0, 'rgba(14,9,6,0)'); gr.addColorStop(1, 'rgba(14,9,6,0.84)');
    ctx.fillStyle = gr; ctx.fillRect(0, y0, FR.w, FR.h - y0);
  }
}
export function renderFlow(ctx, state, scene, a = 0.72) { drawCourt(ctx, state, a); drawFlowIn(ctx, state, scene, state.ui.scroll); }
export function renderModal(ctx, state, scene) {
  ctx.fillStyle = 'rgba(10,6,3,0.66)'; ctx.fillRect(0, 0, FR.w, FR.h);
  const c = ensureLayout(state, scene);
  panel(ctx, c.x - 26, Math.max(topSafe(), c.top - 30), c.w + 52, Math.min(FR.h - topSafe() - botSafe(), c.lay.contentH + 56), { r: 28 });
  drawFlowIn(ctx, state, scene, state.ui.scroll);
}

// ---- the reader ------------------------------------------------------------------------------------------------------------------
export const DOCS = { howto: { list: HOWTO, name: 'How to Play' }, about: { list: ABOUT, name: 'About' }, rules: { list: RULES, name: 'Rules' } };
const readerCache = { key: '', lay: null, max: 0, artH: 0 };
export function readerState(state, scene) {
  const base = DOCS[scene];
  let doc = base;
  if (scene === 'about' && state.credits) {
    // the shared 3D layer's licence credits, shown as one more page in the same zoomable text screen
    const paras = state.credits.split(/\n\s*\n/).map((p) => p.replace(/^#+\s*/gm, '').replace(/[*`]/g, '').replace(/\s*\n\s*/g, ' ').replace(/(https?:\/\/\S+)/g, (u) => u.replace(/(.{28})/g, '$1 ')).trim()).filter(Boolean);
    doc = { name: base.name, list: [...base.list, { title: '3D credits', text: paras.length ? paras : ['three.js (MIT), Rocketbox characters (MIT), CMU motion capture, Quaternius (CC0).'] }] };
  }
  const L = readerLayout(), page = Math.max(0, Math.min(doc.list.length - 1, state.ui.page)), pg = doc.list[page];
  const scale = scaleOf(state), w = L.text.w;
  const key = `${scene}|${page}|${scale}|${Math.round(w)}|${Math.round(L.text.h)}|${doc.list.length}`;
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
  drawCourt(ctx, state, 0.78);
  const r = readerState(state, scene), L = r.L;
  // header
  ctx.save(); ctx.font = `800 ${Math.round(34)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, r.doc.name, L.title.x, L.title.y, '#ffd98a', 6);
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
export { wrapLines, TEAM };
