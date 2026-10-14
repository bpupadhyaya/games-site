// Every screen that is not the play screen: title, setup, ladder, settings, result, pause and the scrolling About / How to Play / Rules reader.
// Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { live, host, TEXT_SCALES, THINK_STEPS, colFor, setupPins, refLayout, MIN_FONT, fz } from './layout.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, PERIOD_SECS, LADDER, TEAMS, TACTICS, SIZES, GOAL_R, DROP_R, HL, HW, GOAL_X, SPOTS } from './consts.js';
import { drawLockup, drawMoreLine, LOCKUP_RATIO } from './brand.js';
import { drawPennant } from './hud.js';
import { drawHorseRider, drawBall } from './rig.js';

const TAU = Math.PI * 2;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
let measureCtx = estCtx;
export const setMeasureCtx = (c) => { if (c) measureCtx = c; };
let LAID = { key: '', lay: null, top: 0, bottom: 0 };
export const flowMeta = () => LAID;
const kindOf = (key) => (key === 'title' ? 'title' : key === 'setup' || key === 'ladder' ? 'wide' : 'one');
const isWide = () => colFor('wide').w0 >= 760;
function place(key, lay) {
  const c = colFor(kindOf(key));
  const top = c.top, bottom = key === 'setup' ? setupPins().bar.y : c.bottom;
  const oy = lay ? Math.max(0, Math.floor((bottom - top - lay.contentH) / 2)) : 0;
  return { c, top, bottom, oy };
}
const WIDGETS = { title: (s) => titleWidgets(s), setup: (s) => setupWidgets(s), settings: (s) => settingsWidgets(s), result: (s) => resultWidgets(s), demolimit: () => demoLimitWidgets(), ladder: (s) => ladderWidgets(s) };
function build(state, key) {
  const c = colFor(kindOf(key));
  const lay = flowLayout(measureCtx, WIDGETS[key](state), TEXT_SCALES[state.settings.textIdx], { x: c.x0, w: c.w0 });
  const p = place(key, lay);
  LAID = { key, lay, top: p.top + p.oy, bottom: p.bottom, h: lay.contentH, band: p };
  return LAID;
}
export function ensureLayout(state, key) {
  if (key === 'pause') { pauseGeom(state); return; }
  if (WIDGETS[key]) build(state, key);
}
export function invalidateLayout() { LAID = { key: '', lay: null, top: 0, bottom: 0 }; }
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

// ---- title ---------------------------------------------------------------------------------------------------------------------------
const heroArt = () => { const hk = live.h < 1200 ? 0.74 : 1; return { t: 'art', h: Math.round(280 * hk), draw(ctx, w) { ctx.save(); ctx.scale(hk, hk); drawHero(ctx, w / hk / 2, 0); ctx.restore(); } }; };
function drawHero(ctx, cx, y) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 30px ${FONT}`; ctx.fillStyle = '#ffd97a'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('THE HORSE GAME OF THE STEPPE', cx, y + 56);
  ctx.font = `900 italic 112px ${DISPLAY}`; ctx.fillStyle = '#fff4de'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Kok-boru', cx, y + 190);
  ctx.font = `400 italic 40px ${DISPLAY}`; ctx.fillStyle = '#ffd97a'; ctx.shadowBlur = 8;
  ctx.fillText('Ulak-tartysh · Көк бөрү', cx, y + 252);
  ctx.restore();
}
let titleLockTap = null, lockDownNow = false;
export const getLockTap = () => titleLockTap;
export const setLockDown = (v) => { lockDownNow = v; };
const LOCK_CAP = 300;
const lockupArt = (cap = LOCK_CAP) => ({ t: 'art', brand: true, h: Math.round(cap * LOCKUP_RATIO) + 40, draw(ctx, w) {
  const lw = Math.min(w - 30, cap), lh = Math.round(lw * LOCKUP_RATIO);
  ctx.save(); ctx.fillStyle = lockDownNow ? 'rgba(255,226,122,0.5)' : 'rgba(10,18,44,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 20 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, w / 2, 20, lw, 1);
} });

export function titleWidgets(state) {
  const sv = state.saved, split = !!colFor('title').hero;
  const lad = state.ladder.rung;
  return [
    ...(split ? [] : [heroArt()]),
    ...(sv ? [{ t: 'btn', id: 'continue', label: 'Continue match', sub: `Period ${sv.period} · ${sv.score[0]}-${sv.score[1]}`, primary: true, h: 88 }] : []),
    { t: 'btn', id: 'ladder', label: 'Steppe Ladder', sub: lad >= LADDER.length ? 'Champion! Replay any rung' : `Next: ${LADDER[lad].name}`, primary: !sv, h: !live.land && live.h < 1200 ? 76 : 90 },
    { t: 'btn', id: 'play', label: 'Friendly match', sub: 'Choose your team size, tactic and rivals' },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Computer teams play while you learn why' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    lockupArt(),
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, wide = isWide();
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : 'Friendly match', size: 48 }];
  if (!s.watch) {
    wd.push({ t: 'p', label: 'Riders on each team', bold: true, color: '#ffe9a0', size: 26 });
    SIZES.forEach((n) => wd.push({ t: 'btn', id: `size${n}`, label: `${n} a side`, active: s.size === n, row: 40, h: 76 }));
    wd.push({ t: 'p', label: 'Your tactic', bold: true, color: '#ffe9a0', size: 26 });
    TACTICS.forEach((t, i) => wd.push({ t: 'btn', id: `tac${i}`, label: t, active: s.tactic === i, row: 41, h: 76 }));
    wd.push({ t: 'p', label: 'Rival team', bold: true, color: '#ffe9a0', size: 26 });
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: l.name, sub: locked ? 'In the full game' : `${'★'.repeat(l.stars)}${'☆'.repeat(5 - l.stars)}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 84, row: wide ? 12 + (i < 3 ? 0 : 1) : undefined });
    });
    wd.push({ t: 'p', label: 'Length of each of the 2 periods', bold: true, color: '#ffe9a0', size: 26 });
    PERIOD_SECS.forEach((p, i) => wd.push({ t: 'btn', id: `len${i}`, label: `${p} s`, row: 9, active: s.lenIdx === i }));
  } else {
    wd.push({ t: 'p', label: 'Your side (attacks to the right)', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i}`, label: l.name, active: s.watchA === i, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push({ t: 'p', label: 'The other side', bold: true, color: '#ffe9a0', size: 24 });
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `opp${i}`, label: l.name, active: s.opp === i, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function ladderWidgets(state) {
  const lad = state.ladder, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Steppe Ladder', size: 48 }, { t: 'p', label: 'Beat each team to climb. A drawn match goes to a golden goal.', size: 26 }];
  LADDER.forEach((r, i) => {
    const done = i < lad.rung, next = i === lad.rung, locked = i > lad.rung && !(lad.rung >= LADDER.length);
    const demoLocked = demo && i > 1;
    wd.push({ t: 'btn', id: `rung${i}`, label: `${i + 1}. ${r.name}`, sub: demoLocked ? 'In the full game' : `${TEAMS[r.team].name} · ${LEVELS[r.level].name}${done ? ' · won' : ''}`, active: done, primary: next && !demoLocked, disabled: (locked && !done) || demoLocked, hitDisabled: false, h: 96, stars: LEVELS[r.level].stars });
  });
  wd.push({ t: 'gap', h: 8 });
  wd.push({ t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9a0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'Controls: stick on the left; GRAB / THROW, PASS, SPRINT and SWAP on the right. Keyboard: arrows or WASD, Space to grab or throw, E to pass, Shift to sprint, Q to switch, C for the call.', size: 22 },
    { t: 'p', label: 'Language: English', size: 22 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', size: 24, color: '#ffe9a0' }] : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9a0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const watch = state.mode === 'watch';
  const youWin = s.winner === 0;
  const title = watch ? (s.winner < 0 ? 'A draw' : `${TEAMS[s.winner === 0 ? state.homeTeam : state.awayTeam].name} win`) : s.winner < 0 ? 'A draw' : youWin ? 'You win the match!' : `${TEAMS[state.awayTeam].name} win`;
  const st = s.stats[0], ot = s.stats[1];
  const wd = [{ t: 'gap', h: big ? 24 : 40 }, { t: 'h', label: title, size: 54, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${s.score[0]} – ${s.score[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `${TEAMS[state.homeTeam].name}: ${st.goals} goals, ${st.grabs} grabs, ${st.passes} passes, ${st.tugs} tugs.  ${TEAMS[state.awayTeam].name}: ${ot.goals} goals, ${ot.grabs} grabs, ${ot.passes} passes, ${ot.tugs} tugs.`, size: 24, cap: big ? 2 : 3 });
  if (state.lastLadder) wd.push({ t: 'p', label: state.lastLadder, bold: true, color: '#ffe9a0', size: 28 });
  wd.push({ t: 'gap', h: 24 });
  if (state.lastLadderNext) wd.push({ t: 'btn', id: 'nextrung', label: 'Next rung', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'again', label: state.mode === 'ladder' && !youWin ? 'Try again' : 'Rematch', primary: !state.lastLadderNext, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: state.mode === 'ladder' ? 'Ladder' : 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'gap', h: 16 });
  wd.push({ t: 'art', h: 52, draw(ctx, w) { drawMoreLine(ctx, w / 2, 26, 22); } });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 10 },
    { t: 'btn', id: 'p-txt-dec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffe9a0', size: 24 },
    { t: 'btn', id: 'quit', label: state.mode === 'match' || state.mode === 'ladder' ? 'Save and quit to menu' : 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every rival, the full Steppe Ladder, Watch & Learn and longer matches.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, live.h);
  g.addColorStop(0, `rgba(10,18,44,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,18,44,${a})`); g.addColorStop(1, `rgba(10,18,44,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, live.w, live.h);
}
function colBand(ctx, c, top, bottom) {
  if (!live.land) return;
  roundPath(ctx, c.x0 - 26, top - 4, c.w0 + 52, bottom - top + 8, 30); ctx.fillStyle = 'rgba(10,18,44,0.5)'; ctx.fill();
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = live.w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,18,44,0)'); g.addColorStop(1, 'rgba(10,18,44,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 54, bottom - 46, 108, 38, 19); ctx.fillStyle = 'rgba(255,244,222,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 26);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 54, top + 8, 108, 38, 19); ctx.fillStyle = 'rgba(255,244,222,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 27);
  }
}
function drawFlowScreen(ctx, state, key, bandOn = true) {
  const L = build(state, key), p = L.band, lay = L.lay;
  const top = L.top, bottom = p.bottom, vh = bottom - p.top;
  const maxScroll = Math.max(0, lay.contentH - vh);
  const scroll = Math.min(state.ui.scroll, maxScroll);
  if (bandOn) colBand(ctx, p.c, p.top, bottom);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, vh * (vh / lay.contentH)), ty = top + (scroll / maxScroll) * (vh - th);
    roundPath(ctx, p.c.x0 + p.c.w0 + 12, ty, 6, th, 3); ctx.fillStyle = 'rgba(255,244,222,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, p.c.x0 - 20, p.c.w0 + 40);
  }
  return { scroll, maxScroll, lay, top, bottom };
}
// the live demo match runs behind the menus: the caller draws it first, then these draw their scrim and columns over it
const bg = (ctx, a) => scrim(ctx, a);

export function renderTitle(ctx, state) {
  const w = live.w, h = live.h;
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(10,18,44,0.15)'); g.addColorStop(0.35, 'rgba(10,18,44,0.45)'); g.addColorStop(1, 'rgba(10,18,44,0.9)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const c = colFor('title');
  if (c.hero) {
    const blockH = 280 + 28;
    const sc = Math.min(1, (c.hero.w - 30) / 520, (c.bottom - c.top) / blockH), top = c.top + Math.max(0, (c.bottom - c.top - blockH * sc) / 2);
    ctx.save(); ctx.translate(c.hero.x + c.hero.w / 2, top); ctx.scale(sc, sc); drawHero(ctx, 0, 0); ctx.restore();
    roundPath(ctx, c.x0 - 22, c.top - 2, c.w0 + 44, c.bottom - c.top + 4, 30); ctx.fillStyle = 'rgba(10,18,44,0.5)'; ctx.fill();
  }
  const fr = drawFlowScreen(ctx, state, 'title', false);
  titleLockTap = null;
  const it = fr.lay.items.find((i) => i.w && i.w.brand);
  if (it) {
    const lw = Math.min(it.wd - 30, LOCK_CAP), lh = Math.round(lw * LOCKUP_RATIO), cx = it.x + it.wd / 2, cy = fr.top + it.y - fr.scroll + 20 + lh / 2;
    const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
    if (cy - th / 2 >= fr.top - 4 && cy + th / 2 <= fr.bottom + 4) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(255,244,222,0.6)'; ctx.fillText('Web demo', w / 2, h - 14 - host.b); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), w = live.w, h = live.h;
  drawFlowScreen(ctx, state, 'setup');
  const g = ctx.createLinearGradient(0, pins.bar.y, 0, h);
  g.addColorStop(0, 'rgba(10,18,44,0)'); g.addColorStop(0.2, 'rgba(10,18,44,0.88)'); g.addColorStop(1, 'rgba(10,18,44,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, pins.bar.y, w, pins.bar.h);
  drawButton(ctx, pins.start, state.setup.watch ? 'Watch the match' : 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${fz(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, w / 2, pins.bar.y + 20); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings'); };
export const renderResult = (ctx, state) => { scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result'); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit'); };
export const renderLadder = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'ladder'); };

function pauseGeom(state) {
  const w = live.w, h = live.h, I = host;
  const pw = Math.min(660, w - I.l - I.r - 24), px = Math.round((w - pw) / 2);
  const lay = flowLayout(measureCtx, pauseWidgets(state), TEXT_SCALES[state.settings.textIdx], { x: px + 30, w: pw - 60 });
  const top = I.t + 16, bottom = h - I.b - 16;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, Math.round((top + bottom - ch) / 2));
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH, panel: { x: px, w: pw } };
  return LAID;
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const L = pauseGeom(state), { lay, top: y0, bottom } = L, ch = bottom - y0;
  panel(ctx, L.panel.x, y0 - 20, L.panel.w, ch + 40, { r: 30, fill: 'rgba(18,32,70,0.95)', stroke: 'rgba(255,244,222,0.45)' });
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, L.panel.x, L.panel.w);
}

// ---- reference pages ---------------------------------------------------------------------------------------------------------------------
export const REF_VIEW = { top: 0, bottom: 0 };
let REF = { max: 0, vh: 1, total: 0 };
export const refMeta = () => REF;
const ART_H = { gaits: 250, pennants: 190, field: 290, grab: 250, throw: 250, tug: 230 };
function buildFlow(ctx, list, scale, R) {
  const PW = R.panel.w, vh = R.view.bottom - R.view.top;
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PW - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = []; let y = 8;
  list.forEach((sec, si) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artH = sec.art ? Math.min(ART_H[sec.art] || 240, Math.max(180, vh - 40)) : 0;
    const blk = { y, tl, titleH, art: sec.art || null, artH, lines, rule: si > 0 };
    let h = (blk.rule ? 16 : 0) + titleH + artH;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    h += 30; blk.h = h; blocks.push(blk); y += h;
  });
  return { blocks, total: y, fs, lh, secFs };
}
const flowCache = new Map();
export function refPrepare(state, list, header) {
  const R = refLayout(), P = R.panel;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${list.length}:${list[list.length - 1].p.length}:${Math.round(P.w)}x${Math.round(R.view.bottom - R.view.top)}`;
  let F = flowCache.get(pkey);
  if (!F) { F = buildFlow(measureCtx, list, sc, R); flowCache.set(pkey, F); if (flowCache.size > 30) flowCache.delete(flowCache.keys().next().value); }
  const { top, bottom } = R.view, vh = bottom - top, max = Math.max(0, F.total - vh);
  REF = { max, vh, total: F.total }; REF_VIEW.top = top; REF_VIEW.bottom = bottom;
  return { R, P, F, sc, top, bottom, vh, max };
}
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const { R, P, F, sc, top, bottom, vh, max } = refPrepare(state, list, header), w = live.w;
  const scroll = Math.min(Math.max(0, state.ui.scroll), max); state.ui.scroll = scroll;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(255,244,222,0.97)', stroke: 'rgba(26,34,51,0.6)' });
  const cx = P.x + P.w / 2, hy = P.y + R.headH - 40;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `italic 700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, cx, hy);
  ctx.strokeStyle = 'rgba(26,34,51,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, hy + 20); ctx.lineTo(P.x + P.w - 60, hy + 20); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(P.x + 8, top, P.w - 16, vh); ctx.clip();
  for (const blk of F.blocks) {
    let y = top + blk.y - scroll;
    if (y > bottom || y + blk.h < top) continue;
    if (blk.rule) { ctx.strokeStyle = 'rgba(26,34,51,0.2)'; ctx.beginPath(); ctx.moveTo(P.x + 80, y + 4); ctx.lineTo(P.x + P.w - 80, y + 4); ctx.stroke(); y += 16; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${F.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, cx, y + F.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(P.x + 20, Math.max(y, top), P.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, P.x + 40, y, P.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${F.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += F.lh * 0.45; ctx.fillText(l.text, P.x + 40, y + F.fs * 0.85); y += F.lh; });
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, vh * vh / F.total), ty = top + (scroll / max) * (vh - th);
    roundPath(ctx, P.x + P.w - 18, ty, 7, th, 3.5); ctx.fillStyle = 'rgba(26,34,51,0.45)'; ctx.fill();
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, bottom - 70, 0, bottom); g.addColorStop(0, 'rgba(255,244,222,0)'); g.addColorStop(1, 'rgba(255,244,222,0.97)'); ctx.fillStyle = g; ctx.fillRect(P.x + 10, bottom - 70, P.w - 20, 70);
      roundPath(ctx, cx - 64, bottom - 42, 128, 36, 18); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff4de'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ scroll', cx, bottom - 23);
    }
    if (scroll > 4) {
      roundPath(ctx, cx - 46, top + 6, 92, 34, 17); ctx.fillStyle = C.indigo; ctx.fill();
      ctx.fillStyle = '#fff4de'; ctx.font = `700 ${MIN_FONT}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 23);
    }
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.font = `400 ${MIN_FONT}px ${FONT}`; ctx.fillStyle = 'rgba(26,34,51,0.75)';
  const pages = Math.max(1, Math.ceil(F.total / vh)), cur = max <= 0 ? 1 : Math.min(pages, 1 + Math.round(scroll / max * (pages - 1)));
  ctx.fillText(`${max > 0 ? `Screen ${cur} of ${pages}   ` : ''}Text ${Math.round(sc * 100)}%`, cx, P.y + P.h - (R.foot > 40 ? 22 : 8));
  drawButton(ctx, R.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 32 });
  drawButton(ctx, R.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 32 });
  drawButton(ctx, R.back, scroll <= 4 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, R.next, scroll >= max - 4 ? 'Done' : 'Next', { primary: true, size: 32 });
  void w;
}

// ---- diagrams drawn with the game's own horse, rider and ball -------------------------------------------------------------------------------
const lbl = (ctx, t, x, y, size = 24, col = '#fff4de', align = 'center') => {
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${Math.max(MIN_FONT, size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  if (col !== '#1a2233') { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; }
  ctx.fillText(t, x, y); ctx.restore();
};
function ground(ctx, x, y, w, h) {
  roundPath(ctx, x, y, w, h, 16);
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#9bc0e8'); g.addColorStop(0.6, '#f3dfb8'); g.addColorStop(0.6001, '#b49a55'); g.addColorStop(1, '#8a7440');
  ctx.fillStyle = g; ctx.fill();
}
function horseAt(ctx, x, y, s, o, flip = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * flip, s);
  drawHorseRider(ctx, { ph: 0.3, spd: 0, t: 0, horse: TEAMS[0].horse, kit: TEAMS[0].kit, trim: TEAMS[0].trim, carry: false, lean: 0, kind: null, throwP: -1, charge: 0, ...o });
  ctx.restore();
}
function arrowTo(ctx, x0, y0, x1, y1, col = '#ffe36a', wd = 5) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 14 * Math.cos(a - 0.45), y1 - 14 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 14 * Math.cos(a + 0.45), y1 - 14 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  if (key === 'gaits') {
    ground(ctx, x, y, w, h);
    const s = Math.min(h / 3.3, w / 8.6), gy = y + h * 0.82;
    [['walk', 1.6, 0.2], ['trot', 3.6, 0.2], ['gallop', 8, 0.35]].forEach(([n, sp, ph], i) => {
      const cx = x + w * (0.18 + i * 0.32);
      horseAt(ctx, cx, gy, s, { spd: sp, ph });
      lbl(ctx, n, cx, y + 36, 26, '#1a2233');
    });
  } else if (key === 'pennants') {
    roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(26,34,51,0.92)'; ctx.fill();
    const n = TEAMS.length, cw = w / n, pw = Math.min(cw - 18, 110), ph = pw * 0.7;
    TEAMS.forEach((t, i) => { const px = x + cw * i + (cw - pw) / 2; drawPennant(ctx, px, y + h * 0.28, pw, ph, i); lbl(ctx, t.name, x + cw * i + cw / 2, y + h * 0.28 + ph + 34, 20, '#fff4de'); });
  } else if (key === 'field') {
    roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(26,34,51,0.92)'; ctx.fill();
    const fw = w * 0.84, fh = fw * (2 * HW) / (2 * HL), sc = Math.min(1, (h - 70) / fh), fW = fw * sc, fH = fh * sc;
    const fx = x + (w - fW) / 2, fy = y + 40 + (h - 70 - fH) / 2, s = fW / (2 * HL);
    roundPath(ctx, fx, fy, fW, fH, 6); ctx.fillStyle = '#a3a257'; ctx.fill(); ctx.strokeStyle = '#fff6e4'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx + fW / 2, fy); ctx.lineTo(fx + fW / 2, fy + fH); ctx.stroke();
    for (const sx of [-1, 1]) {
      const gx = fx + fW / 2 + sx * GOAL_X * s, gy = fy + fH / 2;
      ctx.fillStyle = '#e0c48c'; ctx.beginPath(); ctx.arc(gx, gy, GOAL_R * s * 2.2, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(gx, gy, DROP_R * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    SPOTS.slice(0, 3).forEach((p, i) => {
      for (const t of [0, 1]) {
        const px = fx + fW / 2 + (t === 0 ? p.x : -p.x) * s, py = fy + fH / 2 + (t === 0 ? p.z : -p.z) * s;
        ctx.fillStyle = TEAMS[t === 0 ? 0 : 3].kit; ctx.beginPath(); ctx.arc(px, py, 11, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
    });
    lbl(ctx, `${HL * 2} m x ${HW * 2} m`, x + w / 2, y + 30, 22, '#fff4de');
    lbl(ctx, 'you attack right', x + w / 2, y + h - 12, 22, '#ffe9a0');
  } else if (key === 'grab') {
    ground(ctx, x, y, w, h);
    const s = Math.min(h / 3.6, w / 9), gy = y + h * 0.84, hx = x + w * 0.64;
    horseAt(ctx, hx, gy, s, { spd: 2.2, lean: 0.9, kind: 'grab', reachX: 1.15, reachY: -0.22 });
    const bx = hx + 1.15 * s, by = gy - 0.3 * s;
    ctx.strokeStyle = '#2fbf6a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(bx, by + 0.28 * s, 1.0 * s, 0.32 * s, 0, 0, TAU); ctx.stroke();
    drawBall(ctx, bx, by, 0.3 * s, 0.4);
    lbl(ctx, 'Green ring: in reach', x + 14, y + 40, 22, '#1a2233', 'left');
    lbl(ctx, 'and slow enough', x + 14, y + 68, 22, '#1a2233', 'left');
    ctx.strokeStyle = '#ffb13a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + 50, y + 118, 34, 11, 0, 0, TAU); ctx.stroke();
    lbl(ctx, 'Amber: too fast', x + 14, y + 156, 22, '#1a2233', 'left');
  } else if (key === 'throw') {
    ground(ctx, x, y, w, h);
    const s = Math.min(h / 3.8, w / 12), gy = y + h * 0.86, hx = x + w * 0.16;
    horseAt(ctx, hx, gy, s, { spd: 6, carry: true, throwP: 0.4 });
    const px = x + w * 0.82, pw = w * 0.12;
    ctx.fillStyle = '#e0c48c'; ctx.beginPath(); ctx.ellipse(px, gy, pw, pw * 0.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.setLineDash([6, 8]); ctx.strokeStyle = '#1a2233'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(hx + 0.4 * s, gy - 2.2 * s); ctx.quadraticCurveTo((hx + px) / 2, y + 28, px, gy - 4); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = '#2fbf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(px, gy, pw * 0.5, pw * 0.16, 0, 0, TAU); ctx.stroke();
    lbl(ctx, 'Let go when the landing', x + w - 14, y + h * 0.5, 22, '#1a2233', 'right');
    lbl(ctx, 'ring is in the circle', x + w - 14, y + h * 0.5 + 28, 22, '#1a2233', 'right');
  } else if (key === 'tug') {
    ground(ctx, x, y, w, h);
    const s = Math.min(h / 3.4, w / 9), gy = y + h * 0.86;
    horseAt(ctx, x + w * 0.3, gy, s, { spd: 6.5, lean: 0.45, kind: 'tug', reachX: 1.2, reachY: -1.15 });
    ctx.save(); ctx.translate(x + w * 0.66, gy + 6); ctx.scale(s, s);
    drawHorseRider(ctx, { ph: 0.5, spd: 6.5, t: 0, horse: TEAMS[1].horse, kit: TEAMS[1].kit, trim: TEAMS[1].trim, carry: true, lean: 0, kind: null, throwP: -1, charge: 0 });
    ctx.restore();
    ctx.strokeStyle = '#2fbf6a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(x + w * 0.66, gy + 8, 1.7 * s, 0.5 * s, 0, 0, TAU); ctx.stroke();
    lbl(ctx, 'Alongside him: green ring, press GRAB', x + w / 2, y + 30, 20, '#1a2233');
  }
  ctx.restore();
}
export { LEVELS };
