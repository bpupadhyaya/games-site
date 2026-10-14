// Every screen that is not the play screen: title, set-up, settings, results, pause, demo limit and the reader (How to Play / About / Rules).
// Layout is measured with an ESTIMATED text width (see metrics) so that update() and render() agree exactly on where every button is.
import { FONT, NUM, C, flowLayout, drawFlow, flowHit, panel, roundPath, paintButton, wrapLines, textShadow } from './ui.js';
import { geom } from './art.js';
import { FR, TEXT_SCALES, THINK_STEPS, colW, colX, topSafe, botSafe, readerLayout } from './layout.js';
import { drawSky, drawGround, drawProps, drawHero, drawDiagram, wordmark, PALETTES, UNLOCKS } from './art.js';
import { drawLockupImg } from './brand.js';
import { LEVELS, RIDERS, K } from './sim.js';
import { HOWTO, ABOUT, RULES } from './content.js';
import { scene3d, draw3d } from './scene3d.js';

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
  if (!land) w.push({ t: 'art', h: scene3d() ? titleHeroH() : Math.round(Math.min(380, Math.max(240, FR.h * 0.24))), draw: (ctx, cw, ch) => titleHero(ctx, cw, ch, state) });
  if (state.resume) w.push({ t: 'btn', id: 'resume', label: 'Continue outing', sub: resumeLine(state.resume), primary: true, h: 92 });
  const k = land ? 0.82 : 1;
  w.push({ t: 'btn', id: 'solo', label: 'Ride out', sub: 'Five hunts on the steppe', primary: !state.resume, h: Math.round(88 * k) });
  w.push({ t: 'btn', id: 'ai', label: 'Ride against a rider', sub: land ? 'Same fox, same wind' : 'Same fox, same wind, best total wins', h: Math.round(82 * k) });
  w.push({ t: 'btn', id: 'two', label: 'Two riders', sub: 'Pass the phone', h: Math.round(80 * k) });
  w.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', sub: land ? 'A master explains each hunt' : 'A master rider explains each hunt', h: Math.round(80 * k) });
  w.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1, h: Math.round(72 * k) }, { t: 'btn', id: 'rules', label: 'Rules', row: 1, h: Math.round(72 * k) });
  w.push({ t: 'btn', id: 'about', label: 'About', row: 2, h: Math.round(72 * k) }, { t: 'btn', id: 'settings', label: 'Settings', row: 2, h: Math.round(72 * k) });
  w.push(lockupWidget());
  return w;
}
const resumeLine = (r) => `Hunt ${r.i + 1} of ${r.nHunts}  ·  ${r.totals[0]}${r.cfg.mode === 'solo' ? '' : ` : ${r.totals[1]}`}`;

export function setupWidgets(state) {
  const s = state.setup, w = [];
  const title = s.mode === 'ai' ? 'Ride against a rider' : s.mode === 'two' ? 'Two riders' : 'Ride out';
  w.push({ t: 'h', label: title, size: 46 });
  w.push({ t: 'p', label: 'Conditions', bold: true, size: 26 });
  LEVELS.forEach((l, i) => w.push({ t: 'btn', id: `lv${i}`, label: l.name, sub: l.note, active: s.level === i, h: 82 }));
  if (s.mode === 'ai') {
    w.push({ t: 'p', label: 'Your rival', bold: true, size: 26 });
    RIDERS.forEach((r, i) => w.push({ t: 'btn', id: `rv${i}`, label: r.name, sub: r.note, active: s.opp === i, h: 82 }));
  }
  w.push({ t: 'gap', h: 10 });
  w.push({ t: 'btn', id: 'start', label: 'Ride out', primary: true, h: 92 });
  w.push({ t: 'btn', id: 'back', label: 'Back', h: 76 });
  return w;
}

export function settingsWidgets(state) {
  const st = state.settings, w = [];
  const un = unlockedCount(state.record.career);
  w.push({ t: 'h', label: 'Settings', size: 46 });
  w.push({ t: 'p', label: `Text size ${Math.round(scaleOf(state) * 100)}%`, bold: true, size: 28 });
  w.push({ t: 'btn', id: 'dec', label: 'Smaller', row: 1, disabled: st.textIdx === 0, h: 76 }, { t: 'btn', id: 'inc', label: 'Larger', row: 1, disabled: st.textIdx === TEXT_SCALES.length - 1, h: 76 });
  w.push({ t: 'btn', id: 'sound', label: st.sound ? 'Sound: on' : 'Sound: off', h: 78 });
  w.push({ t: 'btn', id: 'guide', label: st.guide ? 'Guides: on' : 'Guides: off', sub: 'Den ring, wind arrow, stoop cue', h: 84 });
  w.push({ t: 'btn', id: 'think', label: `Think time: ${THINK_STEPS[st.thinkIdx]} s`, sub: 'Watch & Learn', h: 84 });
  w.push({ t: 'btn', id: 'eagle', label: `Eagle: ${PALETTES[Math.min(st.plum, un - 1)].name}`, sub: un < PALETTES.length ? `Next plumage at ${UNLOCKS[un]} career points` : 'All plumages found', h: 88 });
  if (!state.demo) {
    const owned = state.owned;
    w.push({ t: 'btn', id: 'restore', label: owned ? 'Full game unlocked' : 'Restore purchase', sub: state.restoreMsg || (owned ? 'Thank you for playing' : 'Already bought it? Get it back'), disabled: owned, h: 90 });
  }
  w.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  return w;
}
export const unlockedCount = (career) => UNLOCKS.filter((n) => career >= n).length;

export function resultWidgets(state) {
  const m = state.m, w = [];
  const names = sideNames(m.cfg), solo = m.cfg.mode === 'solo' || m.cfg.mode === 'watch';
  const title = solo ? 'Outing done' : m.winner < 0 ? 'A tie' : winLine(names[m.winner]);
  w.push({ t: 'h', label: title, size: 52, color: '#ffe08a' });
  if (solo) w.push({ t: 'p', label: `${m.totals[0]} points over ${m.hunts.length} hunts`, bold: true, size: 34 });
  else w.push({ t: 'p', label: `${names[0]} ${m.totals[0]}  :  ${m.totals[1]} ${names[1]}`, bold: true, size: 34 });
  m.hunts.forEach((hh, i) => {
    const a = hh[0], b = hh[1];
    w.push({ t: 'p', label: solo ? `Hunt ${i + 1}: ${a.total}  ·  ${a.name}` : `Hunt ${i + 1}: ${a.total} : ${b ? b.total : '-'}`, size: 26 });
  });
  if (solo && m.cfg.mode === 'solo') w.push({ t: 'p', label: m.totals[0] > state.prevBest ? 'A new best outing!' : `Best outing ${state.record.best}`, size: 28, bold: true });
  w.push({ t: 'gap', h: 14 });
  w.push({ t: 'btn', id: 'again', label: 'Ride again', primary: true, h: 92 });
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
    { t: 'btn', id: 'quit', label: 'Leave outing', sub: 'Your progress is kept', h: 84 },
  ];
}

export function sumWidgets(state) {
  const m = state.m, sc = m.last, w = [];
  const names = sideNames(m.cfg);
  const who = m.cfg.mode === 'solo' || m.cfg.mode === 'watch' ? '' : `${names[m.side] || 'You'}: `;
  w.push({ t: 'h', label: sc.name, size: 40, color: sc.cls === 'perfect' ? '#ffe08a' : sc.cls === 'den' || sc.cls === 'wait' ? '#ffb3a0' : '#f4f8ff' });
  w.push({ t: 'p', label: `${who}${sc.total} points${sc.missM !== null ? `  ·  ${sc.missM.toFixed(1)} m` : ''}`, bold: true, size: 30 });
  const P = K.POINTS;
  [['Track', sc.track, P.track], ['Release', sc.release, P.release], ['Flight', sc.flight, P.flight], ['Stoop', sc.strike, P.strike], ['Return', sc.recall, P.recall]]
    .forEach(([n, v, mx]) => w.push({ t: 'p', label: `${n}  ${v} / ${mx}`, size: 26 }));
  w.push({ t: 'gap', h: 8 });
  const last = m.i >= m.nHunts - 1 && (m.side >= m.nSides - 1);
  w.push({ t: 'btn', id: 'next', label: last ? 'See the outing' : m.side < m.nSides - 1 ? `Pass to ${names[m.side + 1]}` : 'Next hunt', primary: true, h: 88 });
  return w;
}

export function demoWidgets() {
  return [
    { t: 'h', label: 'That was the free demo', size: 44 },
    { t: 'p', label: 'Steppe Eagle Hunting is a full game with computer riders, two-rider play and Watch & Learn. Get it on iPhone and Android to ride on.', size: 28 },
    { t: 'btn', id: 'menu', label: 'Back to the menu', primary: true, h: 88 },
  ];
}

export const winLine = (name) => (name === 'You' ? 'You win!' : `${name} wins!`);
export function sideNames(cfg) {
  if (cfg.mode === 'ai') return ['You', RIDERS[cfg.opp].name];
  if (cfg.mode === 'two') return ['Rider 1', 'Rider 2'];
  if (cfg.mode === 'watch') return [RIDERS[cfg.watch].name, ''];
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
const sig = (state, scene) => `${scene}|${FR.key}|${state.settings.textIdx}|${state.settings.sound}|${state.settings.guide}|${state.settings.thinkIdx}|${state.setup.opp}|${state.setup.level}|${state.setup.mode}|${state.settings.plum}|${state.owned}|${state.restoreMsg}|${state.record.career}|${!!state.resume}|${state.m ? state.m.winner + ':' + state.m.totals.join('-') + ':' + state.m.i + ':' + state.m.side + ':' + (state.m.last ? state.m.last.total : '') : ''}|${state.record.best}`;
export function ensureLayout(state, scene) {
  const key = sig(state, scene);
  if (CACHE.key === key) return CACHE;
  const g = flowGeom(scene, FR.land), scale = scaleOf(state);
  const lay = flowLayout(metrics, widgetsFor(state, scene), scale, { x: 0, w: g.w, btn: 28 });
  // centre short screens vertically (not the title: it stays at the top)
  const room = g.bottom - g.top - lay.contentH;
  Object.assign(CACHE, { key, lay, top: g.top + (room > 0 ? (scene !== 'title' ? Math.min(room / 2, 140) : (FR.land ? 0 : Math.min(room * 0.3, 160))) : 0), bottom: g.bottom, x: g.x, w: g.w, max: Math.max(0, lay.contentH - (g.bottom - g.top)) });
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
const MENU_CAM = { x: 0, z: -14 };
// Where the glove sits on the title and flow screens (3D): bottom-left of the hero area, the eagle looking out over the steppe.
export const titleHeroH = () => Math.round(Math.min(640, Math.max(320, FR.h * 0.39)));
const DEVQ = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
function menuGlove(title) {
  const g = menuGlove0(title);
  if (DEVQ.has('hy')) g.yaw = +DEVQ.get('hy');
  if (DEVQ.has('gx')) g.x = +DEVQ.get('gx') * FR.w;
  if (DEVQ.has('gy')) g.y = +DEVQ.get('gy') * FR.h;
  return g;
}
function menuGlove0(title) {
  if (FR.land) {
    if (title) { const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560); return { x: FR.l + (g.x - FR.l - hw) / 2 + hw * 0.5, y: FR.h * 0.92, yaw: 3.4 }; }
    return { x: FR.w * 0.1, y: FR.h * 0.97, yaw: 3.4 };
  }
  if (title) return { x: FR.w * 0.62, y: topSafe() + titleHeroH() - 36, yaw: 3.4 };
  return { x: FR.w * 0.18, y: FR.h * 0.985, yaw: 3.4 };
}
export function drawCourt(ctx, state, a = 0.4, o = {}) {
  const w = FR.w, h = FR.h, g = geom(w, h), F3 = scene3d();
  if (F3) {
    const t = state.t, gl = menuGlove(!!o.title);
    const cam = { x: 0, z: -14, y: 2.5, yaw: -0.1 + 0.05 * Math.sin(t * 0.11), pitch: 0.055 + 0.01 * Math.sin(t * 0.17) };
    draw3d(ctx, F3, { mode: 'menu', t, cam, h: null, plum: Math.min(state.settings.plum, PALETTES.length - 1), level: state.setup.level, wind: { x: 2.0 + 0.6 * Math.sin(t * 0.3), z: 0.8 }, glove: gl, perchYaw: gl.yaw });
    ctx.fillStyle = `rgba(8,20,44,${a})`; ctx.fillRect(0, 0, w, h);
    return;
  }
  drawSky(ctx, g, MENU_CAM, state.t * 0.6);
  drawGround(ctx, g, MENU_CAM, state.t, 0);
  drawProps(ctx, g, MENU_CAM);
  ctx.fillStyle = `rgba(8,20,44,${a})`; ctx.fillRect(0, 0, w, h);
}

function titleHero(ctx, w, h, state) {
  if (!scene3d()) drawHero(ctx, w, h, state.t, PALETTES[Math.min(state.settings.plum, PALETTES.length - 1)]);
  const f3 = !!scene3d();
  wordmark(ctx, 'BERKUTCHI', w / 2, h * (f3 ? 0.125 : 0.22), Math.min(h * (f3 ? 0.17 : 0.24), w * 0.145));
  ctx.save(); ctx.font = `800 ${Math.round(Math.min(26, h * 0.075))}px ${NUM}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,26,52,0.9)';
  const sub = 'STEPPE EAGLE HUNTING  ·  KAZAKHSTAN', y = h * (f3 ? 0.245 : 0.4);
  ctx.strokeText(sub, w / 2, y); ctx.fillStyle = '#fff1c4'; ctx.fillText(sub, w / 2, y);
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
  drawCourt(ctx, state, scene3d() ? 0.0 : 0.12, { title: true });
  if (FR.land) {
    // hero and name on the left, buttons right
    const g = flowGeom('title', true), hw = Math.min(g.x - 60 - FR.l, 560), hh = Math.min(FR.h - topSafe() - botSafe() - 40, hw * 0.86);
    ctx.save(); ctx.translate(FR.l + (g.x - FR.l - hw) / 2, topSafe() + (FR.h - topSafe() - botSafe() - hh) / 2); titleHero(ctx, hw, hh, state); ctx.restore();
  }
  if (!DEVQ.has('hide')) drawFlowIn(ctx, state, 'title', state.ui.scroll);
}
export function renderFlow(ctx, state, scene, a = 0.55) { drawCourt(ctx, state, a); drawFlowIn(ctx, state, scene, state.ui.scroll); }
export function renderModal(ctx, state, scene) {
  ctx.fillStyle = 'rgba(6,16,36,0.55)'; ctx.fillRect(0, 0, FR.w, FR.h);
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
