// Every screen that is not the play screen: title, set-up, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { FR, TEXT_SCALES, THINK_STEPS, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { geom, drawGround, drawScenery, drawHero, drawDiagram, wordmark, ornament, PALETTES, UNLOCKS } from './art.js';
import { drawLockupImg } from './brand.js';
import { GL } from './glbridge.js';
import { LEVELS, RIVALS, K, starsFor } from './sim.js';
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
  if (!land) w.push({ t: 'art', h: Math.round(Math.min(520, Math.max(240, FR.h - 770 - (state.resume ? 106 : 0)))), draw: (ctx, cw, ch) => titleHero(ctx, cw, ch, state) });
  if (state.resume) w.push({ t: 'btn', id: 'resume', icon: 'resume', label: 'Continue innings', sub: resumeLine(state.resume), primary: true, h: 92 });
  const k = land ? 0.82 : 1;
  w.push({ t: 'btn', id: 'solo', icon: 'bat', label: 'Play an innings', sub: 'Up to eight batters, three outs', primary: !state.resume, h: Math.round(88 * k) });
  w.push({ t: 'btn', id: 'ai', icon: 'rival', label: 'Play a rival side', sub: land ? 'Both bat, best total wins' : 'You bat, then they bat: best total wins', h: Math.round(82 * k) });
  w.push({ t: 'btn', id: 'two', icon: 'two', label: 'Two players', sub: 'Pass the phone', h: Math.round(80 * k) });
  w.push({ t: 'btn', id: 'watch', icon: 'watch', label: 'Watch & Learn', sub: land ? 'A champion explains each turn' : 'A champion batter explains each turn', h: Math.round(80 * k) });
  w.push({ t: 'btn', id: 'howto', icon: 'howto', label: 'How to Play', row: 1, h: Math.round(72 * k) }, { t: 'btn', id: 'rules', icon: 'rules', label: 'Rules', row: 1, h: Math.round(72 * k) });
  w.push({ t: 'btn', id: 'about', icon: 'about', label: 'About', row: 2, h: Math.round(72 * k) }, { t: 'btn', id: 'settings', icon: 'settings', label: 'Settings', row: 2, h: Math.round(72 * k) });
  w.push(lockupWidget());
  return w;
}
const resumeLine = (r) => `Batter ${r.i + 1} of ${r.nTurns}  ·  ${r.totals[0]}${r.cfg.mode === 'solo' ? '' : ` : ${r.totals[1]}`}`;

export function setupWidgets(state) {
  const s = state.setup, w = [];
  const title = s.mode === 'ai' ? 'Play a rival side' : s.mode === 'two' ? 'Two players' : 'Play an innings';
  w.push({ t: 'h', label: title, size: 46 });
  w.push({ t: 'p', label: 'Fielding side', bold: true, size: 26 });
  LEVELS.forEach((l, i) => w.push({ t: 'btn', id: `lv${i}`, label: l.name, sub: l.note, active: s.level === i, h: 82 }));
  if (s.mode === 'ai') {
    w.push({ t: 'p', label: 'Your rival batter', bold: true, size: 26 });
    RIVALS.forEach((r, i) => w.push({ t: 'btn', id: `rv${i}`, label: r.name, sub: r.note, active: s.opp === i, h: 82 }));
  }
  w.push({ t: 'gap', h: 10 });
  w.push({ t: 'btn', id: 'start', label: 'Play ball', primary: true, h: 92 });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: 76 });
  return w;
}

export function settingsWidgets(state) {
  const st = state.settings, w = [], land = FR.land;
  const un = unlockedCount(state.record.career);
  const restore = state.demo ? null : { t: 'btn', id: 'restore', label: state.owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (state.owned ? 'Thank you for playing' : land ? 'Already bought it?' : 'Already bought it? Get it back'), disabled: state.owned || state.restoreBusy, h: land ? 76 : 90 };
  const back = { t: 'btn', id: 'back', label: 'Back', primary: true, h: land ? 70 : 84 };
  w.push({ t: 'h', label: 'Settings', size: land ? 38 : 46 });
  w.push({ t: 'p', label: `Text size ${Math.round(scaleOf(state) * 100)}%`, bold: true, size: land ? 24 : 28 });
  w.push({ t: 'btn', id: 'dec', label: 'Smaller', row: 1, disabled: st.textIdx === 0, h: land ? 64 : 76 }, { t: 'btn', id: 'inc', label: 'Larger', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: land ? 64 : 76 });
  const sound = { t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: land ? 64 : 78 };
  const guide = { t: 'btn', id: 'guide', label: st.guide ? 'Guides: on' : 'Guides: off', sub: land ? undefined : 'Closing ring, landing mark, throw path', h: land ? 64 : 84 };
  const think = { t: 'btn', id: 'think', label: `Think time: ${THINK_STEPS[st.thinkIdx]} s`, sub: land ? undefined : 'Watch & Learn', h: land ? 64 : 84 };
  const kit = { t: 'btn', id: 'kit', label: `Kit: ${PALETTES[Math.min(st.kit, un - 1)].name}`, sub: un < PALETTES.length ? (land ? `Next at ${UNLOCKS[un]} points` : `Next colour at ${UNLOCKS[un]} career points`) : 'All kit colours found', h: land ? 76 : 88 };
  if (land) {
    w.push({ ...sound, row: 2 }, { ...guide, row: 2 }, { ...think, row: 3 }, { ...kit, row: 3 });
    if (restore) w.push({ ...restore, row: 4 }, { ...back, row: 4 }); else w.push(back);
  } else {
    w.push(sound, guide, think, kit);
    if (restore) w.push(restore);
    w.push(back);
  }
  return w;
}
export const unlockedCount = (career) => UNLOCKS.filter((n) => career >= n).length;

export function resultWidgets(state) {
  const m = state.m, w = [];
  const names = sideNames(m.cfg), solo = m.cfg.mode === 'solo' || m.cfg.mode === 'watch';
  const title = solo ? 'Innings over' : m.winner < 0 ? 'A tie' : winLine(names[m.winner]);
  w.push({ t: 'h', label: title, size: 52, color: '#ffe08a' });
  if (solo) w.push({ t: 'p', label: `${m.totals[0]} points  ·  ${'★'.repeat(starsFor(m.totals[0]))}${'☆'.repeat(5 - starsFor(m.totals[0]))}`, bold: true, size: 34 });
  else w.push({ t: 'p', label: `${names[0]} ${m.totals[0]}  :  ${m.totals[1]} ${names[1]}`, bold: true, size: 34 });
  const btns = [{ t: 'btn', id: 'again', label: 'Bat again', primary: true, h: FR.land ? 72 : 92 }, { t: 'btn', id: 'menu', label: 'Menu', h: FR.land ? 64 : 80 }];
  if (FR.land) w.push(...btns.map((b) => ({ ...b, row: 1 })), { t: 'gap', h: 6 });
  for (let side = 0; side < m.nSides; side++) {
    if (!solo) w.push({ t: 'p', label: names[side], bold: true, size: 26, color: '#ffe08a' });
    (m.turns[side] || []).forEach((x, i) => w.push({ t: 'p', label: `Batter ${i + 1}: ${x.name}${x.pts ? `  +${x.pts}` : ''}`, size: 25 }));
  }
  if (m.cfg.mode === 'solo') w.push({ t: 'p', label: m.totals[0] > state.prevBest ? 'A new best innings!' : `Best innings ${state.record.best}`, size: 28, bold: true });
  if (!FR.land) w.push({ t: 'gap', h: 14 }, ...btns);
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
    { t: 'btn', id: 'quit', label: 'Leave innings', sub: 'Your progress is kept', h: 84 },
  ];
}

export function sumWidgets(state) {
  const m = state.m, x = m.last, w = [];
  const names = sideNames(m.cfg);
  const who = m.cfg.mode === 'solo' || m.cfg.mode === 'watch' ? '' : `${names[m.side] || 'You'}: `;
  w.push({ t: 'h', label: x.name, size: 40, color: x.kind === 'round' ? '#ffe08a' : x.out ? '#ffb3a0' : '#f4f8ff' });
  w.push({ t: 'p', label: `${who}${x.pts} point${x.pts === 1 ? '' : 's'}${x.out ? '  ·  out' : ''}`, bold: true, size: 30 });
  w.push({ t: 'p', label: `Innings total ${m.totals[m.side]}  ·  ${m.outs} out${m.outs === 1 ? '' : 's'}`, size: 26 });
  w.push({ t: 'gap', h: 8 });
  const over = m.outs >= K.OUTS || m.i >= m.nTurns - 1;
  const lastSide = m.side >= m.nSides - 1;
  w.push({ t: 'btn', id: 'next', label: over ? (lastSide ? 'See the innings' : `Pass to ${names[m.side + 1]}`) : 'Next batter', primary: true, h: 88 });
  return w;
}

export function demoWidgets() {
  return [
    { t: 'h', label: 'That was the free demo', size: 44 },
    { t: 'p', label: 'Lapta is a full game with three fielding sides, rival batters, two-player play and Watch & Learn. Get it on iPhone and Android to play on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

export const winLine = (name) => (name === 'You' ? 'You win!' : `${name} wins!`);
export function sideNames(cfg) {
  if (cfg.mode === 'ai') return ['You', RIVALS[cfg.opp].name];
  if (cfg.mode === 'two') return ['Player 1', 'Player 2'];
  if (cfg.mode === 'watch') return [RIVALS[2].name, ''];
  return ['You', ''];
}

// ---- flow layout cache --------------------------------------------------------------------------------------------------------
const CACHE = { key: '', lay: null, top: 0, bottom: 0, x: 0, w: 0, max: 0 };
export function flowGeom(scene, land) {
  const top = topSafe() + (scene === 'title' && !land ? 6 : 0) + (FR.back && FR.t < 30 ? 0 : 0), bottom = FR.h - botSafe();
  if (scene === 'title' && land) {
    const w = Math.max(340, Math.min(500, FR.w * 0.34));
    return { top, bottom, x: FR.w - FR.r - w - Math.max(24, FR.w * 0.05), w };
  }
  const modal = scene === 'pause' || scene === 'sum';
  const w = modal ? Math.min(colW(), 560) : colW();
  return { top, bottom, x: modal ? FR.l + (FR.w - FR.l - FR.r - w) / 2 : colX(), w };
}
export function widgetsFor(state, scene) {
  switch (scene) {
    case 'title': return titleWidgets(state, FR.land);
    case 'setup': return setupWidgets(state);
    case 'settings': return settingsWidgets(state);
    case 'result': return resultWidgets(state);
    case 'pause': return pauseWidgets(state);
    case 'sum': return sumWidgets(state);
    case 'demolimit': return demoWidgets();
    default: return [];
  }
}
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.setup.opp}|${state.setup.level}|${state.setup.mode}|${state.settings.kit}|${state.record.career}|${!!state.resume}|${state.m ? state.m.winner + ':' + state.m.totals.join('-') + ':' + state.m.i + ':' + state.m.side + ':' + state.m.outs + ':' + (state.m.last ? state.m.last.kind : '') : ''}|${state.record.best}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const wl = widgetsFor(state, scene);
  let lay = flowLayout(metrics, wl, scale, { x: 0, w: g.w, btn: 28 });
  // the title: a tall phone gives the spare height to the hero picture, so the stack of buttons ends at the bottom edge
  if (scene === 'title' && !FR.land) {
    const spare = g.bottom - g.top - lay.contentH, hero = wl.find((q) => q.t === 'art' && !q.id);
    if (hero && spare > 20) { hero.h += Math.min(spare - 6, 320); lay = flowLayout(metrics, wl, scale, { x: 0, w: g.w, btn: 28 }); }
  }
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
export function drawCourt(ctx, state, a = 0.4) {
  const w = FR.w, h = FR.h, g = geom({ x: 0, y: 0, w, h });
  if (GL.on) { if (!GL.views.length) GL.views.push({ kind: 'menu', g, state }); }
  else { drawGround(ctx, g, w, h, state.t); drawScenery(ctx, g, state.t, 0); }
  ctx.fillStyle = `rgba(10,30,14,${a})`; ctx.fillRect(0, 0, w, h);
}

function titleHero(ctx, w, h, state) {
  if (!GL.on) drawHero(ctx, w, h, state.t, PALETTES[Math.min(state.settings.kit, PALETTES.length - 1)]);
  const size = Math.min(h * 0.26, w * 0.2, 150), wy = size * 0.62 + 10;
  wordmark(ctx, 'LAPTA', w / 2, wy, size);
  ctx.save(); ctx.font = `800 ${Math.round(Math.min(26, h * 0.075))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,40,16,0.9)';
  const sub = 'RUSSIAN BAT-AND-RUN  ·  VILLAGE GREEN', y = wy + size * 0.68;
  ctx.strokeText(sub, w / 2, y); ctx.fillStyle = '#fff6d0'; ctx.fillText(sub, w / 2, y);
  ctx.restore();
  ornament(ctx, w / 2, y + 26, Math.min(w * 0.62, 340));
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

// The 3D layer frames the title hero (batter, server and two fielders on a small green) in the rectangle the 2D hero would use.
function heroRect(state, scroll) {
  const c = ensureLayout(state, 'title');
  if (FR.land) {
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    return { x: FR.l + (g.x - FR.l - hw) / 2, y: topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2, w: hw, h: hh };
  }
  const it = c.lay.items.find((q) => q.w.t === 'art');
  return it ? { x: c.x + it.x, y: c.top + it.y - Math.min(scroll, c.max), w: it.wd, h: it.h } : null;
}

export function renderTitle(ctx, state) {
  if (GL.on) {
    const R = heroRect(state, state.ui.scroll), w = FR.w, h = FR.h;
    if (R) GL.views.push({ kind: 'hero', R, g: geom({ x: 0, y: 0, w, h }), state, pal: PALETTES[Math.min(state.settings.kit, PALETTES.length - 1)] });
  }
  drawCourt(ctx, state, 0.12);
  if (FR.land) {
    // hero and name on the left, buttons right
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    ctx.save(); ctx.translate(FR.l + (g.x - FR.l - hw) / 2, topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2); titleHero(ctx, hw, hh, state); ctx.restore();
  }
  drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
export function renderFlow(ctx, state, scene, a = 0.4) {
  drawCourt(ctx, state, a);
  const c = ensureLayout(state, scene);
  const top = Math.max(topSafe() - 6, c.top - 26), h = Math.min(FR.h - top - botSafe() + 6, c.lay.contentH + 52);
  panel(ctx, c.x - 22, top, c.w + 44, h, { r: 28 });
  drawFlowIn(ctx, state, scene, state.ui.scroll);
}
export function renderModal(ctx, state, scene) {
  ctx.fillStyle = 'rgba(6,16,36,0.55)'; ctx.fillRect(0, 0, FR.w, FR.h);
  const c = ensureLayout(state, scene);
  panel(ctx, c.x - 26, Math.max(topSafe(), c.top - 30), c.w + 52, Math.min(FR.h - topSafe() - botSafe(), c.lay.contentH + 56), { r: 28 });
  drawFlowIn(ctx, state, scene, state.ui.scroll);
}

// ---- the reader ------------------------------------------------------------------------------------------------------------------
// About, plus the third-party credits of the 3D layer when it is in use (web/vendor3d/LICENSES.md, shown whole, as its terms ask).
let aboutKey = '', aboutCache = ABOUT;
const aboutList = () => {
  const txt = GL.licenses || '';
  if (!GL.on || !txt) return ABOUT;
  if (aboutKey === txt) return aboutCache;
  aboutKey = txt;
  const from = txt.indexOf('## '), body = from >= 0 ? txt.slice(from) : txt;
  const paras = body.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  aboutCache = [...ABOUT, { title: 'Credits: the 3D people', text: paras }];
  return aboutCache;
};
export const DOCS = { howto: { list: HOWTO, name: 'How to Play' }, about: { get list() { return aboutList(); }, name: 'About' }, rules: { list: RULES, name: 'Rules' } };
const readerCache = { key: '', lay: null, max: 0, artH: 0 };
export function readerState(state, scene) {
  const L = readerLayout(), doc = DOCS[scene], page = Math.max(0, Math.min(doc.list.length - 1, state.ui.page)), pg = doc.list[page];
  const scale = scaleOf(state), w = L.text.w;
  const key = `${scene}|${page}|${doc.list.length}|${scale}|${Math.round(w)}|${Math.round(L.text.h)}`;
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
  drawCourt(ctx, state, 0.62);
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
export { wrapLines };
