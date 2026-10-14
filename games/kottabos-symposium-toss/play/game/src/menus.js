// Every screen that is not the play screen: title, ladder, set-up, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, textShadow } from './ui.js';
import { FR, TEXT_SCALES, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { drawRoom, drawHero, drawDiagram, wordmark, PAL, SERIF } from './art.js';
import { drawLockupImg } from './brand.js';
import { LEVELS, LENGTHS, LENGTH_NAMES, DISTANCES, LADDER } from './sim.js';
import { HOWTO, ABOUT, RULES } from './content.js';
import { THINK_STEPS } from './layout.js';
import { v3 } from './v3.js';

export const DEMO_LEVELS = 3;

// ---- text measuring that does not need a canvas -------------------------------------------------------------------------
export const metrics = {
  font: '16px sans-serif',
  measureText(t) { const m = /(\d+(?:\.\d+)?)px/.exec(this.font); const sz = m ? Number(m[1]) : 16; return { width: String(t).length * sz * 0.58 }; },
};

const LOCK_H = 74;
export const scaleOf = (state) => TEXT_SCALES[state.settings.textIdx];
export const totalStars = (state) => (state.record.stars || []).reduce((a, b) => a + (b || 0), 0);
export const unlockedTo = (state) => Math.min(LADDER.length - 1, (state.record.stars || []).filter((s) => s > 0).length);

// ---- widget lists -------------------------------------------------------------------------------------------------------------
const lockupWidget = () => ({ t: 'art', id: 'arcforge', hitW: 300, h: LOCK_H + 16, draw(ctx, w) { drawLockupImg(ctx, w / 2, 8, LOCK_H, { align: 'center' }); } });

export function titleWidgets(state, land) {
  const w = [];
  if (!land) w.push({ t: 'art', h: Math.round(Math.min(560, Math.max(240, FR.h * 0.32))), draw: (ctx, cw, ch) => titleHero(ctx, cw, ch, state) });
  const next = Math.min(LADDER.length, unlockedTo(state) + 1);
  if (state.resume) w.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: resumeLine(state.resume), primary: true, h: 92 });
  w.push({ t: 'btn', id: 'ladder', label: 'Symposium Ladder', sub: `Level ${next} of ${LADDER.length}  ·  ${totalStars(state)} stars`, primary: !state.resume, h: 90 });
  w.push({ t: 'btn', id: 'ai', label: 'Play the computer', h: 80 });
  w.push({ t: 'btn', id: 'two', label: 'Two players', sub: 'Pass the phone', h: 80 });
  w.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two players show how it is done', h: 80 });
  w.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: 72 }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: 72 });
  w.push({ t: 'btn', id: 'about', label: 'About', row: 2, h: 72 }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: 72 });
  w.push(lockupWidget());
  return w;
}
const resumeLine = (r) => `${r.cfg.mode === 'two' ? 'Two players' : LEVELS[r.cfg.opp].name}  round ${r.round}  ${r.score[0]} : ${r.score[1]}`;

export function ladderWidgets(state) {
  const w = [{ t: 'h', label: 'Symposium Ladder', size: 46 }];
  const open = unlockedTo(state), best = state.record.best || [], st = state.record.stars || [];
  w.push({ t: 'p', label: `${totalStars(state)} of ${LADDER.length * 3} stars`, bold: true, size: 26 });
  LADDER.forEach((lv, i) => {
    const demoLocked = state.demo && i >= DEMO_LEVELS, locked = i > open;
    w.push({
      t: 'btn', id: `lv${i}`, label: `${i + 1}. ${lv.name}`, sub: locked ? 'Win a star on the level before' : demoLocked ? 'In the full game' : `${lv.sc.kind === 'stands' ? 'Disc stand' : 'Basin of cups'}${best[i] ? `  ·  best ${best[i]}` : ''}`,
      stars: st[i] || 0, disabled: locked, hitDisabled: false, active: i === open && !st[i], h: 84,
    });
  });
  w.push({ t: 'gap', h: 8 });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: 76 });
  return w;
}

export function setupWidgets(state) {
  const s = state.setup, two = s.mode === 'two', w = [];
  w.push({ t: 'h', label: two ? 'Two players' : 'Play the computer', size: 46 });
  if (!two) {
    w.push({ t: 'p', label: 'Opponent', bold: true, size: 26 });
    LEVELS.forEach((l, i) => w.push({ t: 'btn', id: `lv${i}`, label: l.name, sub: l.note, active: s.opp === i, h: 82 }));
  }
  w.push({ t: 'p', label: 'Rounds', bold: true, size: 26 });
  LENGTH_NAMES.forEach((n, i) => w.push({ t: 'btn', id: `ln${i}`, label: `${LENGTHS[i]}`, sub: n, active: s.len === i, row: 7, h: 84 }));
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
  w.push({ t: 'btn', id: 'guide', label: st.guide ? 'Aim guide: on' : 'Aim guide: off', sub: 'Dotted arc, spread lines and your last stream', h: 84 });
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
  if (m.cfg.mode === 'ladder') {
    const lv = LADDER[m.cfg.level], got = m.starsGot || 0, last = m.cfg.level >= LADDER.length - 1;
    w.push({ t: 'h', label: got ? 'Well flicked!' : 'Not quite', size: 52, color: '#ffd98a' });
    w.push({ t: 'p', label: `${'★'.repeat(got)}${'☆'.repeat(3 - got)}`, bold: true, size: 56, color: '#ffd36a' });
    w.push({ t: 'p', label: `${lv.name}: ${m.score[0]} points`, bold: true, size: 30 });
    const parts = [`${m.stats.clang[0]} clang${m.stats.clang[0] === 1 ? '' : 's'}`, `${m.stats.off[0]} knocked off`, `${m.stats.sunk[0]} cup${m.stats.sunk[0] === 1 ? '' : 's'} sunk`];
    w.push({ t: 'p', label: parts.join('   '), size: 26 });
    w.push({ t: 'p', label: `Stars at ${lv.stars.join(' / ')} points${m.score[0] > state.prevBest ? '  ·  a new best!' : ''}`, size: 24 });
    w.push({ t: 'gap', h: 14 });
    if (got && !last) w.push({ t: 'btn', id: 'next', label: 'Next level', primary: true, h: 92 });
    w.push({ t: 'btn', id: 'again', label: 'Try again', primary: !(got && !last), h: 84 });
    w.push({ t: 'btn', id: 'ladder', label: 'Ladder', h: 76 });
    w.push({ t: 'btn', id: 'menu', label: 'Menu', h: 76 });
    w.push(lockupWidget());
    return w;
  }
  const title = m.winner < 0 ? 'A draw' : winLine(names[m.winner]);
  w.push({ t: 'h', label: title, size: 52, color: '#ffd98a' });
  w.push({ t: 'p', label: `${names[0]} ${m.score[0]}  :  ${m.score[1]} ${names[1]}`, bold: true, size: 36 });
  const sum = (a) => a[0] + a[1];
  const sd = m.cfg.mode === 'ai' ? 0 : -1, get = (a) => (sd < 0 ? sum(a) : a[sd]);
  const who = sd < 0 ? 'Together: ' : '';
  w.push({ t: 'p', label: `${who}Clangs ${get(m.stats.clang)}   Knocked off ${get(m.stats.off)}   Cups sunk ${get(m.stats.sunk)}`, size: 28 });
  w.push({ t: 'p', label: `${sum(m.stats.flicks)} flicks in ${m.round} round${m.round === 1 ? '' : 's'}`, size: 26 });
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
    { t: 'btn', id: 'quit', label: 'Leave', sub: state.m && state.m.cfg.mode === 'ladder' ? 'Back to the ladder' : 'Your match is kept', h: 84 },
  ];
}

export function demoWidgets() {
  return [
    { t: 'h', label: 'That was the free demo', size: 44 },
    { t: 'p', label: 'Kottabos Symposium Toss is a full game with twelve ladder levels, four computer opponents, two players and Watch & Learn. Get it on iPhone and Android to play on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

export const winLine = (name) => (name === 'You' ? 'You win!' : `${name} wins!`);
export function sideNames(cfg) {
  if (cfg.mode === 'ai') return ['You', LEVELS[cfg.opp].name];
  if (cfg.mode === 'two') return ['Madder', 'Olive'];
  if (cfg.mode === 'ladder') return ['You', ''];
  return [LEVELS[cfg.watch[0]].name, LEVELS[cfg.watch[1]].name];
}

// ---- flow layout cache --------------------------------------------------------------------------------------------------------
const CACHE = { key: '', lay: null, top: 0, bottom: 0, x: 0, w: 0, max: 0 };
export function flowGeom(scene, land) {
  const top = topSafe() + (scene === 'title' && !land ? 6 : 0), bottom = FR.h - botSafe();
  if (scene === 'title' && land) {
    const w = Math.max(340, Math.min(500, FR.w * 0.34));
    return { top, bottom, x: FR.w - FR.r - w - Math.max(24, FR.w * 0.05), w };
  }
  const w = scene === 'pause' ? Math.min(colW(), 560) : colW();
  return { top, bottom, x: scene === 'pause' ? FR.l + (FR.w - FR.l - FR.r - w) / 2 : colX(), w };
}
export function widgetsFor(state, scene) {
  switch (scene) {
    case 'title': return titleWidgets(state, FR.land);
    case 'ladder': return ladderWidgets(state);
    case 'setup': return setupWidgets(state);
    case 'settings': return settingsWidgets(state);
    case 'result': return resultWidgets(state);
    case 'pause': return pauseWidgets(state);
    case 'demolimit': return demoWidgets();
    default: return [];
  }
}
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.setup.opp}|${state.setup.len}|${state.settings.dist}|${state.setup.mode}|${!!state.resume}|${state.m ? `${state.m.winner}:${state.m.score.join('-')}:${state.m.starsGot}:${state.m.cfg.mode}` : ''}|${(state.record.stars || []).join('')}|${state.demo}|${!!state.owned}|${state.restoreMsg}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const lay = flowLayout(metrics, widgetsFor(state, scene), scale, { x: 0, w: g.w, btn: 28 });
  const room = g.bottom - g.top - lay.contentH;
  Object.assign(CACHE, { key, lay, top: g.top + (room > 0 && scene !== 'title' ? Math.min(room / 2, 140) : 0), bottom: g.bottom, x: g.x, w: g.w, max: Math.max(0, lay.contentH - (g.bottom - g.top)) });
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
export function drawBackdropFlow(ctx, state, a = 0.6) {
  const w = FR.w, h = FR.h, s = Math.max(2, Math.min(w, h) / 200);
  if (v3.on) {
    // the live 3D andron is behind this canvas: dim it and pull the corners in so the plaques and text read
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(14,7,3,${Math.min(0.9, a * 0.85)})`; ctx.fillRect(0, 0, w, h);
    const vg = ctx.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.3, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    return;
  }
  drawRoom(ctx, w, h, state.t, { ox: w / 2, cx: 0, cy: 0, my: Math.round(h * 0.86), s });
  ctx.fillStyle = `rgba(18,9,5,${a})`; ctx.fillRect(0, 0, w, h);
}

function titleHero(ctx, w, h, state) {
  if (!v3.on) drawHero(ctx, w, h, state.t);
  wordmark(ctx, 'KOTTABOS', w / 2, h * 0.3, Math.min(h * 0.27, 96), w * 0.94);
  ctx.save(); ctx.font = `800 ${Math.round(Math.min(26, h * 0.075))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(21,16,13,0.92)';
  const sub = 'ΚΟΤΤΑΒΟΣ  ·  SYMPOSIUM TOSS  ·  GREECE', y = h * 0.5;
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
  if (v3.on) {
    // where the live 3D hero goes (the 3D camera frames the player and the stand inside this rectangle)
    if (FR.land) {
      const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
      v3.heroRect = { x: FR.l + (g.x - FR.l - hw) / 2, y: topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2, w: hw, h: hh };
    } else {
      const c = ensureLayout(state, 'title'), it = c.lay.items.find((q) => q.w.t === 'art');
      v3.heroRect = it ? { x: c.x, y: c.top + it.y - Math.min(state.ui.scroll, c.max), w: c.w, h: it.h } : null;
    }
  }
  drawBackdropFlow(ctx, state, v3.on ? 0.28 : 0.5);
  if (FR.land) {
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    ctx.save(); ctx.translate(FR.l + (g.x - FR.l - hw) / 2, topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2); titleHero(ctx, hw, hh, state); ctx.restore();
  }
  drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
export function renderFlow(ctx, state, scene, a = 0.72) { drawBackdropFlow(ctx, state, a); drawFlowIn(ctx, state, scene, state.ui.scroll); }
export function renderModal(ctx, state, scene) {
  ctx.fillStyle = 'rgba(10,5,2,0.68)'; ctx.fillRect(0, 0, FR.w, FR.h);
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
    const artH = pg.art ? Math.round(Math.min(L.land ? 250 : 300, Math.max(L.land ? 80 : 150, L.text.h * (L.land ? 0.3 : 0.34)))) : 0;
    if (pg.art) widgets.push({ t: 'art', h: artH, draw: (ctx, aw, ah) => drawDiagram(pg.art, ctx, aw, ah) });
    widgets.push({ t: 'h', label: pg.title, size: 40, cap: 1.5 });
    pg.text.forEach((p) => widgets.push({ t: 'p', label: p, size: 27, align: 'left' }));
    const lay = flowLayout(metrics, widgets, scale, { x: 0, w });
    Object.assign(readerCache, { key, lay, max: Math.max(0, lay.contentH - L.text.h), artH });
  }
  return { L, doc, page, pg, ...readerCache };
}
export function renderReader(ctx, state, scene) {
  drawBackdropFlow(ctx, state, 0.78);
  const r = readerState(state, scene), L = r.L;
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
export { PAL, SERIF };
