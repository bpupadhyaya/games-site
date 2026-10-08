// Every screen that is not the play screen: title, setup, cup, settings, result, pause and the scrolling About / How to Play / Rules reader
// with its diagrams. Pure drawing; game.js owns state. All text follows the 100-300% text size.
import { W, H, TEXT_SCALES, colGeom, readerLayout, setupPins, host, isWide, minFont } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, MATCH_GOALS, THINK_STEPS, CUP, HW, HL, KINDS, ROD_LAYOUT, ROD_Y, HOME_KIT, RIVAL_KITS } from './consts.js';
import { drawTable, KIT_PAL } from './draw.js';
import { createSim } from './sim.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const LOCKUP_H = 70, LOCK_STRIP = LOCKUP_H + 30;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;

function geomFor(key) {
  const c = colGeom(), wide = c.wide, hk = wide ? 0.82 : 1;
  if (key === 'title') {
    if (!wide) return { x: c.x, w: c.w, top: host.t, bottom: H - host.b - LOCK_STRIP, hk: H < 1100 ? 0.86 : 1, wide };
    const cw = Math.min(560, Math.round(W * 0.4)), x = W - host.r - 40 - cw;
    return { x, w: cw, top: host.t + 12, bottom: H - host.b - 12 - LOCK_STRIP + 12, hk, wide, heroCx: Math.round((x - 20) / 2) };
  }
  if (key === 'setup') return { x: c.x, w: c.w, top: host.t, bottom: setupPins().start.y - 26, hk, wide };
  return { x: c.x, w: c.w, top: host.t, bottom: H - host.b, hk, wide };
}

const GOLD = '#ffd77a';
const heading = (label, size = 48) => ({ t: 'h', label, size });
const sub = (label) => ({ t: 'p', label, bold: true, color: GOLD, size: 26 });

const WIDGETS = { title: titleWidgets, setup: setupWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets, cup: cupWidgets };
export function ensureLayout(state, key) {
  const wf = WIDGETS[key] || (key === 'pause' ? pauseWidgets : null);
  if (!wf) return;
  const g = geomFor(key);
  const lay = flowLayout(estCtx, wf(state, g.wide), TEXT_SCALES[state.settings.textIdx], { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top: g.top, bottom: g.bottom, h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = (k = 1) => ({
  t: 'art', h: Math.round(330 * k),
  draw(ctx, w) {
    ctx.save(); ctx.scale(k, k); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / k / 2;
    ctx.font = `700 34px ${FONT}`; ctx.fillStyle = '#ffd77a'; ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    ctx.fillText('TABLE FOOTBALL', cx, 70);
    ctx.font = `800 118px ${DISPLAY}`; ctx.fillStyle = '#fff3d6'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.fillText('Futbolín', cx, 200);
    ctx.font = `600 30px ${FONT}`; ctx.fillStyle = 'rgba(255,230,190,0.9)'; ctx.shadowBlur = 6;
    ctx.fillText('Slide. Spin. Score.', cx, 262);
    ctx.restore();
  },
});

export function titleWidgets(state, wide = false) {
  const cup = state.cup;
  return [
    ...(wide ? [] : [heroArt(H < 1100 ? 0.78 : 1)]),
    { t: 'btn', id: 'play', label: 'Play a match', primary: true, h: 88 },
    { t: 'btn', id: 'cup', label: cup.round > 0 && cup.round < CUP.length ? 'Continue the Cup' : 'The Cup', sub: cup.won ? 'You have won the Cup' : `Round ${Math.min(CUP.length, cup.round + 1)} of ${CUP.length}`, row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'Two sides play, you learn why', row: 1 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, heading(s.watch ? 'Watch & Learn' : 'New match')];
  wd.push(sub('First to'));
  MATCH_GOALS.forEach((g, i) => wd.push({ t: 'btn', id: `goals${g}`, label: `${g} goals`, active: s.goals === g, row: 8, disabled: demo && g !== 3, hitDisabled: true, h: 76 }));
  if (!s.watch) {
    wd.push(sub('Players'));
    wd.push({ t: 'btn', id: 'pl1', label: 'One player', sub: 'Against the computer', active: s.players !== 2, row: 9, h: 90 });
    wd.push({ t: 'btn', id: 'pl2', label: 'Two players', sub: 'Pass and play, two thumbs', active: s.players === 2, row: 9, h: 90 });
  }
  if (!s.watch && s.players === 2) {
    wd.push({ t: 'p', label: 'Red plays the right half of the screen, Blue the left half (the bottom and the top when the table is turned). Each of you slides and flicks your own rods at the same time.', size: 24 });
  } else if (!s.watch) {
    wd.push(sub('Choose your rival'));
    LEVELS.forEach((l, i) => {
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i + 1}`, label: l.name, sub: locked ? 'In the full game' : ['Slow to react, easy to beat', 'Steady and fair', 'Quick and accurate', 'Fast, hard to fool', 'Almost never misses'][i], active: s.opp === i + 1 && !locked, disabled: locked, hitDisabled: true, h: 90 });
    });
  } else {
    wd.push(sub('Red side'));
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wa${i + 1}`, label: l.name, active: s.watchA === i + 1, row: 20 + (i < 3 ? 0 : 1), h: 70 }));
    wd.push(sub('Rival side'));
    LEVELS.forEach((l, i) => wd.push({ t: 'btn', id: `wb${i + 1}`, label: l.name, active: s.opp === i + 1, row: 30 + (i < 3 ? 0 : 1), h: 70 }));
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function cupWidgets(state) {
  const c = state.cup;
  const wd = [{ t: 'gap', h: 10 }, heading('The Cup'), { t: 'p', label: 'Three matches in a row. Win them all to lift the Cup. Your progress is saved.', size: 26 }];
  CUP.forEach((r, i) => {
    const done = i < c.round, cur = i === c.round && !c.won;
    wd.push({ t: 'btn', id: cur ? 'cup-go' : `cup-x${i}`, label: `${r.round}: ${r.team}`, sub: done ? 'Won' : `${LEVELS[r.level - 1].name} · first to ${r.goals}`, primary: cur, active: done, disabled: !done && !cur, hitDisabled: false, h: 92 });
  });
  if (c.won) wd.push({ t: 'p', label: 'You have lifted the Cup. Play it again any time.', bold: true, color: GOLD, size: 28 }, { t: 'btn', id: 'cup-again', label: 'Play the Cup again', primary: true });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', dark: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, heading('Settings'),
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    sub(`Text size: ${Math.round(sc * 100)}%`),
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    sub('Rod pick'),
    { t: 'btn', id: 'pick-touch', label: 'Touch', sub: 'The rod under your finger', row: 11, active: st.pick === 'touch' },
    { t: 'btn', id: 'pick-auto', label: 'Auto', sub: 'The rod that plays the ball next', row: 11, active: st.pick === 'auto' },
    sub(`Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`),
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: GOLD }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const S = state.sim.s, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const watch = state.mode === 'watch', cup = state.mode === 'cup', youWin = S.winner === 0 && !watch, two = state.two;
  const title = two ? `${state.names[S.winner]} wins!` : watch ? `${state.names[S.winner]} win` : youWin ? (cup && state.cup.won ? 'You lifted the Cup!' : 'You win!') : 'You lose this one';
  const wd = [{ t: 'gap', h: big ? 24 : 150 }, { t: 'h', label: title, size: 56, cap: big ? 1.15 : 1.4 }];
  wd.push({ t: 'h', label: `${S.score[0]} – ${S.score[1]}`, size: 90, cap: big ? 1.1 : 1.3, color: GOLD });
  wd.push({ t: 'p', label: `Kicks: ${two ? 'Red' : 'you'} ${S.stats.shots[0]}, ${two ? 'Blue' : 'rival'} ${S.stats.shots[1]}. Time ${Math.floor(S.t / 60)}:${String(Math.floor(S.t % 60)).padStart(2, '0')}.`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  if (cup) {
    if (youWin && !state.cup.won) wd.push({ t: 'btn', id: 'cup-next', label: 'Next round', primary: true, h: 92 });
    else if (!youWin) wd.push({ t: 'btn', id: 'cup-retry', label: 'Try the round again', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  }
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    ...(state.two ? [] : [{ t: 'btn', id: 'p-pick', label: st.pick === 'auto' ? 'Rod pick: Auto' : 'Rod pick: Touch' }]),
    sub(`Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`),
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, heading('That is the free preview'),
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has all five rivals, longer matches, the Cup and Watch & Learn.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(14,5,0,${a * 0.7})`); g.addColorStop(0.5, `rgba(14,5,0,${a})`); g.addColorStop(1, `rgba(14,5,0,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(14,5,0,0)'); g.addColorStop(1, 'rgba(14,5,0,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,246,228,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, g = geomFor(key)) {
  const { top, bottom } = g, sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc, { x: g.x, w: g.w, hk: g.hk });
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, Math.min(W - 10, g.x + g.w + 14), ty, 5, th, 3); ctx.fillStyle = 'rgba(255,246,228,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, g.x - 20, g.w + 40);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => scrim(ctx, a);

export function renderTitle(ctx, state) {
  const g = geomFor('title');
  if (!g.wide) {
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(14,5,0,0.15)'); gr.addColorStop(0.35, 'rgba(14,5,0,0.5)'); gr.addColorStop(1, 'rgba(14,5,0,0.9)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  } else {
    const gr = ctx.createLinearGradient(g.x - 90, 0, g.x + 40, 0); gr.addColorStop(0, 'rgba(14,5,0,0)'); gr.addColorStop(1, 'rgba(14,5,0,0.82)');
    ctx.fillStyle = gr; ctx.fillRect(g.x - 90, 0, W - g.x + 90, H);
    ctx.fillStyle = 'rgba(14,5,0,0.82)'; ctx.fillRect(g.x + 40, 0, W, H);
    const gl = ctx.createLinearGradient(0, 0, g.x * 0.8, 0); gl.addColorStop(0, 'rgba(14,5,0,0.45)'); gl.addColorStop(1, 'rgba(14,5,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, g.x, H);
  }
  drawFlowScreen(ctx, state, 'title', titleWidgets(state, g.wide), g);
  if (g.wide) {
    const hw = g.heroCx * 2;
    const hk = Math.max(0.4, Math.min(1, (hw - 40) / 740)); ctx.save(); ctx.translate(g.heroCx - hw / 2, Math.round((H - 330 * hk) / 2) - 34); heroArt(hk).draw(ctx, hw); ctx.restore();
  }
  {   // themed lockup: bottom centre, under the menu buttons
    const btns = LAID.lay.items.filter((i) => i.w.t === 'btn');
    const x0 = Math.min(...btns.map((i) => i.x)), x1 = Math.max(...btns.map((i) => i.x + i.wd)), lcx = (x0 + x1) / 2;
    const ly = Math.min(H - host.b - LOCKUP_H - 8, LAID.top + Math.max(0, ...btns.map((i) => i.y + i.h)) + 20);
    const lw = Math.round(LOCKUP_H * 1200 / 327), m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(LOCKUP_H + 12, m);
    titleLockTap = { x: lcx - tw / 2, y: ly + LOCKUP_H + 6 - th, w: tw, h: th };
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(14,5,0,0.55)'; roundPath(ctx, lcx - lw / 2 - 12, ly - 6, lw + 24, LOCKUP_H + 12, (LOCKUP_H + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lcx, ly, LOCKUP_H, 1);
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${minFont(18)}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,228,0.6)'; ctx.fillText('Web demo', g.wide ? g.heroCx : W / 2, H - 8 - host.b); }
}
export function renderSetup(ctx, state) {
  bg(ctx, 0.78);
  const pins = setupPins(), g = geomFor('setup');
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), g);
  const y0 = pins.start.y - 56;
  const gr = ctx.createLinearGradient(0, y0, 0, H);
  gr.addColorStop(0, 'rgba(14,5,0,0)'); gr.addColorStop(0.2, 'rgba(14,5,0,0.88)'); gr.addColorStop(1, 'rgba(14,5,0,0.95)');
  ctx.fillStyle = gr; ctx.fillRect(0, y0, W, H - y0);
  const pz = Math.min(TEXT_SCALES[state.settings.textIdx], 1.4);
  drawButton(ctx, pins.start, state.setup.watch ? 'Watch the match' : 'Kick off', { primary: true, size: Math.round(32 * pz) });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: Math.round(28 * pz) });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pins.start.y - 16); }
}
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); };
export const renderCup = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'cup', cupWidgets(state)); };
export function renderResult(ctx, state) {
  scrim(ctx, 0.62);
  const g = geomFor('result'), r = drawFlowScreen(ctx, state, 'result', resultWidgets(state), g);
  const endY = g.top + r.lay.contentH - r.scroll, y = r.maxScroll > 0 ? Math.min(g.bottom - 4, endY + 20) : Math.min(H - host.b - 30, endY + 26);
  if (y > g.top + 40 && y < H) drawMoreLine(ctx, W / 2, y, minFont(22));
}
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets()); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), wide = isWide();
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60 - 2 * Math.max(host.l, host.r));
  const lay = flowLayout(ctx, wd, sc, { x: Math.round((W - pw) / 2) + 30, w: pw - 60, hk: wide ? 0.82 : 1 });
  const top = (wide ? 24 : 70) + host.t, bottom = H - (wide ? 24 : 70) - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, Math.round((W - pw) / 2), y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(40,18,8,0.95)', stroke: 'rgba(255,214,150,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, Math.round((W - pw) / 2), pw);
}

// ---- reference pages (About, How to Play, Rules): one continuous reader that scrolls ---------------------------------------------
let READER = { key: '', contentH: 0, viewH: 0 };
export const readerMeta = () => READER;

function buildDoc(ctx, list, scale, pw) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = pw - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const items = []; let y = 18;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 4 }); y += 14; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', tl, y });
    y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale < 2) { items.push({ k: 'art', key: sec.art, y, h: 218 }); y += 230; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', text: l, y }); y += lh; });
    });
    y += 22;
  });
  return { items, contentH: y + 10, fs, lh, secFs };
}
const docCache = new Map();
function getDoc(ctx, list, header, sc) {
  const pw = readerLayout().panel.w, key = `${header}:${sc}:${list.length}:${pw}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, sc, pw); docCache.set(key, d); }
  return { d, key };
}
export function ensureReader(state, list, header) {
  const { d, key } = getDoc(estCtx, list, 'est' + header, TEXT_SCALES[state.settings.textIdx]);
  if (READER.key !== key.replace('est', '')) READER = { key: key.replace('est', ''), contentH: d.contentH, viewH: readerLayout().view.h, est: true };
}
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.84);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = readerLayout(), PANEL = RL.panel, VIEW = RL.view;
  const { d, key } = getDoc(ctx, list, header, sc);
  READER = { key, contentH: d.contentH, viewH: VIEW.h };
  const maxScroll = Math.max(0, d.contentH - VIEW.h);
  const scroll = Math.min(Math.max(0, state.ui.scroll), maxScroll);
  const mid = PANEL.x + PANEL.w / 2;
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(252,246,230,0.97)', stroke: 'rgba(60,30,12,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, mid, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,30,12,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(VIEW.x, VIEW.y, VIEW.w, VIEW.h); ctx.clip();
  const oy = VIEW.y - scroll;
  const vis = (y, h) => y + h >= scroll - 4 && y <= scroll + VIEW.h + 4;
  for (const it of d.items) {
    if (it.k === 'rule') { if (vis(it.y, 2)) { ctx.strokeStyle = 'rgba(60,30,12,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, oy + it.y); ctx.lineTo(PANEL.x + PANEL.w - 80, oy + it.y); ctx.stroke(); } }
    else if (it.k === 'title') {
      if (!vis(it.y, it.tl.length * d.secFs * 1.2)) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${d.secFs}px ${FONT}`;
      it.tl.forEach((l, k) => ctx.fillText(l, mid, oy + it.y + d.secFs * (0.9 + k * 1.2) - 8));
    } else if (it.k === 'art') {
      if (!vis(it.y, it.h)) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, oy + it.y, PANEL.w - 40, it.h); ctx.clip(); drawArt(it.key, ctx, PANEL.x + 40, oy + it.y, PANEL.w - 80, it.h - 12); ctx.restore();
    } else {
      if (!vis(it.y, d.lh)) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${d.fs}px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(it.text, PANEL.x + 40, oy + it.y + d.fs * 0.85);
    }
  }
  ctx.restore();
  if (maxScroll > 0) {
    const th = Math.max(60, VIEW.h * (VIEW.h / d.contentH)), ty = VIEW.y + (scroll / maxScroll) * (VIEW.h - th);
    roundPath(ctx, PANEL.x + PANEL.w - 18, VIEW.y, 8, VIEW.h, 4); ctx.fillStyle = 'rgba(60,30,12,0.12)'; ctx.fill();
    roundPath(ctx, PANEL.x + PANEL.w - 18, ty, 8, th, 4); ctx.fillStyle = 'rgba(60,30,12,0.55)'; ctx.fill();
    const pillW = Math.round(124 * Math.max(1, minFont(22) / 22)), pillH = Math.round(36 * Math.max(1, minFont(22) / 22));
    const lab = scroll < maxScroll - 4 ? '▼ more' : 'The end';
    if (scroll < maxScroll - 4) {
      const g = ctx.createLinearGradient(0, VIEW.y + VIEW.h - 80, 0, VIEW.y + VIEW.h); g.addColorStop(0, 'rgba(252,246,230,0)'); g.addColorStop(1, 'rgba(252,246,230,0.95)');
      ctx.fillStyle = g; ctx.fillRect(VIEW.x, VIEW.y + VIEW.h - 80, VIEW.w, 80);
    }
    roundPath(ctx, mid - pillW / 2, VIEW.y + VIEW.h - pillH - 8, pillW, pillH, pillH / 2); ctx.fillStyle = 'rgba(60,30,12,0.9)'; ctx.fill();
    ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, mid, VIEW.y + VIEW.h - pillH / 2 - 8);
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${minFont(24)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x + RL.pct.w / 2, RL.pct.y + RL.pct.h / 2); ctx.textBaseline = 'alphabetic';
  const rz = Math.min(sc, 1.4);
  drawButton(ctx, RL.back, 'Close', { size: Math.round(32 * rz) });
  drawButton(ctx, RL.next, scroll >= maxScroll - 4 ? (maxScroll > 0 ? 'Top ▲' : 'Done') : 'Next ▼', { primary: true, size: Math.round(32 * rz) });
}

// ---- diagrams: drawn with the game's own table, kits and men -----------------------------------------------------------------------
let ART_SIM = null;
const fakeRng = { next: () => 0.5, range: (a, b) => (a + b) / 2, fork() { return fakeRng; }, int: () => 0, chance: () => false };
function artSim() { if (!ART_SIM) ART_SIM = createSim({ goals: 5, level: 2 }, fakeRng); return ART_SIM.s; }
const KITS = [KIT_PAL(HOME_KIT.col, HOME_KIT.trim), KIT_PAL(RIVAL_KITS[0].col, RIVAL_KITS[0].trim)];
function label(ctx, t, x, y, size = 18, col = '#4a2a14', align = 'center') {
  ctx.save(); ctx.font = `700 ${minFont(size)}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#e8a33a', wd = 5) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 14 * Math.cos(a - 0.45), y1 - 14 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 14 * Math.cos(a + 0.45), y1 - 14 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  const S = artSim();
  if (key === 'table' || key === 'rods') {
    // the real table, turned sideways so it fits the page; your side on the left
    const lay = { wide: true, s: Math.min(h / 112, w / 150), cx: x + w / 2, cy: y + h / 2 + 4 };
    ctx.save(); ctx.fillStyle = '#4a2a14'; roundPath(ctx, x, y, w, h, 14); ctx.fill(); ctx.clip();
    S.ball.x = 0; S.ball.y = 0;
    drawTable(ctx, lay, S, { kits: KITS, active: key === 'rods' ? -1 : 6 });
    ctx.restore();
    label(ctx, 'YOUR GOAL', x + 74, y + h - 14, 15, '#ffe9c8'); label(ctx, 'RIVAL GOAL', x + w - 78, y + h - 14, 15, '#ffe9c8');
  } else if (key === 'kick') {
    ctx.save(); ctx.fillStyle = '#2f8a46'; roundPath(ctx, x, y, w, h, 14); ctx.fill(); ctx.clip();
    const cx = x + w * 0.3, cy = y + h * 0.62, k = h / 120;
    ctx.fillStyle = '#c8452c'; roundPath(ctx, cx - 24 * k, cy - 14 * k, 48 * k, 36 * k, 8 * k); ctx.fill();
    ctx.fillStyle = '#ffe6bf'; ctx.fillRect(cx - 20 * k, cy - 2 * k, 40 * k, 5 * k);
    ctx.fillStyle = '#f3efe4'; ctx.beginPath(); ctx.arc(cx + 8 * k, cy - 40 * k, 18 * k, 0, TAU); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.stroke();
    arrow(ctx, cx + 8 * k, cy - 62 * k, cx + 8 * k, y + 12, '#ffd77a', 6);
    arrow(ctx, x + w * 0.62, cy + 36 * k, x + w * 0.62, cy - 50 * k, '#fff3d6', 7);
    label(ctx, 'FLICK UP', x + w * 0.62, cy + 54 * k, 18, '#fff3d6');
    label(ctx, 'ball goes this way', x + w * 0.5, y + 22, 15, '#fff3d6');
    ctx.restore();
  }
}
