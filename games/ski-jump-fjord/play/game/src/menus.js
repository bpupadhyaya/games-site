// Every screen that is not the play screen: title, setup, settings, result, pause and the scrolling About / How to Play / Rules reader with its diagrams.
// Pure drawing; game.js owns state. All text follows the 100-300% size.
import { W, H, SW, OX, LAND, MENU, PANEL, host, minU, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, THINK_STEPS, SETUP_PINS } from './layout.js';
import { drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { HILLS, groundY } from './hills.js';
import { LEVELS } from './jump.js';
import { MEDALS } from './sim.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const sk = `${key}|${W}x${H}|${state.settings.textIdx}`;
  if (LAID.sk === sk && LAID.lay) return;
  const T = MENU.top, B = MENU.bottom, PB = MENU.pinBottom;
  const defs = { title: [titleWidgets, T, B], setup: [setupWidgets, T, PB], settings: [settingsWidgets, T, B], result: [resultWidgets, T, B], demolimit: [demoLimitWidgets, T, B] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, sk, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

function drawHero(ctx, w, flat) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = w / 2, k = Math.min(1, (w - 20) / 640);
  ctx.fillStyle = flat ? 'rgba(5,11,20,0.5)' : 'rgba(5,11,20,0.62)'; roundPath(ctx, 2, 40, w - 4, 288, 30); ctx.fill();
  let px = Math.round(34 * k);
  ctx.font = `700 ${px}px ${FONT}`;
  while (ctx.measureText('FLY THE FJORD, LAND THE TELEMARK').width > w - 16 && px > 12) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = '#f2c14e'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText('FLY THE FJORD, LAND THE TELEMARK', cx, 96);
  let hp = Math.round(112 * Math.min(1, k * 1.1));
  ctx.font = `700 ${hp}px ${DISPLAY}`;
  while (ctx.measureText('Ski Jump').width > w - 28 && hp > 24) { hp -= 2; ctx.font = `700 ${hp}px ${DISPLAY}`; }
  ctx.fillStyle = '#eef3f7'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Ski Jump', cx, 212);
  ctx.font = `700 ${Math.round(70 * Math.min(1, k * 1.1))}px ${DISPLAY}`; ctx.fillStyle = '#8fd3e6'; ctx.fillText('Fjord', cx, 290);
  ctx.restore();
}
const heroArt = () => { const k = H < 1200 ? 0.75 : 1; return { t: 'art', h: Math.round(380 * k), draw(ctx, w) { ctx.save(); ctx.scale(k, k); drawHero(ctx, w / k); ctx.restore(); } }; };
const LOCK_W = 300;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
const brandArt = () => ({ t: 'art', h: 120, brand: true, draw(ctx, w) {
  const lw = Math.min(w - 40, LOCK_W), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = lockDownFlag ? 'rgba(240,196,85,0.5)' : 'rgba(5,11,20,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 60 - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, w / 2, 60, lw, 1);
} });
let lockDownFlag = false;
export const setLockDown = (v) => { lockDownFlag = v; };

export function titleWidgets(state) {
  return [
    ...(LAND ? [{ t: 'gap', h: 24 }] : [heroArt()]),
    { t: 'btn', id: 'play', label: 'Play the competition', sub: 'Three rounds against seven jumpers', primary: true, h: !LAND && H < 1200 ? 80 : 92 },
    { t: 'btn', id: 'single', label: 'Practice jump', sub: 'Any hill, as often as you like', row: 1 },
    { t: 'btn', id: 'daily', label: 'Daily Cup', sub: "Today's wind and rivals", row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'The computer jumps, step by step' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    brandArt(),
  ];
}

export function setupWidgets(state) {
  const s = state.setup;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.watch ? 'Watch & Learn' : s.single ? 'Practice jump' : 'The competition', size: 48 }];
  wd.push({ t: 'p', label: s.single ? 'Choose the hill' : s.watch ? 'Which hill should the computer jump?' : 'Choose the hill for the three rounds. Seven rivals jump after you each round.', bold: true, color: '#ffd98a', size: 26 });
  HILLS.forEach((h) => wd.push({ t: 'btn', id: `hill-${h.id}`, label: `${h.name}  (K ${h.k})`, sub: h.blurb, active: s.hill === h.id, h: 92 }));
  wd.push({ t: 'p', label: 'Competition level', bold: true, color: '#ffd98a', size: 26 });
  LEVELS.forEach((l) => wd.push({ t: 'btn', id: `lv${l.id}`, label: l.name, sub: l.blurb, active: s.level === l.id, h: 92 }));
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-jumper', label: st.jumper === 'f' ? 'Jumper: Woman' : 'Jumper: Man' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A\u2212  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    { t: 'p', label: 'The hill and competition level are chosen when you start.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd98a' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const s = state.sim, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big || LAND ? 24 : 70 }];
  if (s.mode === 'practice') {
    const j = s.res;
    wd.push({ t: 'h', label: j.kindText, size: 50, cap: 1.3 });
    wd.push({ t: 'h', label: `${j.dist.toFixed(1)} m`, size: 76, color: '#f2c14e', cap: 1.15 });
    wd.push({ t: 'p', label: `${j.total.toFixed(1)} points  ·  style ${j.style.toFixed(1)}`, size: 26, cap: big ? 2 : 3 });
  } else {
    const me = s.standings.find((x) => x.you);
    const medal = me.rank <= 3 ? `${MEDALS[me.rank - 1]} medal` : `Finished ${me.rank} of ${s.standings.length}`;
    wd.push({ t: 'h', label: medal, size: 52, color: me.rank <= 3 ? '#f2c14e' : '#eef3f7', cap: 1.3 });
    wd.push({ t: 'h', label: `${me.total.toFixed(1)} points`, size: 70, cap: 1.15 });
    wd.push({ t: 'p', label: `Jumps: ${s.you.jumps.map((x) => x.dist.toFixed(1) + ' m').join('  ·  ')}`, size: 26, cap: big ? 2 : 3 });
    s.standings.forEach((r) => wd.push({ t: 'p', label: `${r.rank}.  ${r.name}   ${r.total.toFixed(1)}`, bold: r.you, color: r.you ? '#f2c14e' : undefined, size: 24, cap: big ? 2 : 2.5 }));
  }
  wd.push({ t: 'gap', h: 18 });
  wd.push({ t: 'btn', id: 'again', label: 'Play again', primary: true, h: 88 });
  wd.push({ t: 'btn', id: 'new', label: 'Change hill', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push({ t: 'art', h: 56, draw: (ctx, w) => drawMoreLine(ctx, w / 2, 24, 19) });
  wd.push({ t: 'gap', h: 20 });
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
    { t: 'p', label: `Text size: ${Math.round(TEXT_SCALES[st.textIdx] * 100)}%`, bold: true, color: '#ffd98a', size: 24 },
    { t: 'btn', id: 'p-txt-dec', label: 'A\u2212  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have used the free jumps of the web demo. The full game on iPhone and Android has all four hills, every competition level, the Daily Cup, Watch & Learn and the slow-motion replays.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(5,14,26,${a * 0.7})`); g.addColorStop(0.5, `rgba(5,14,26,${a})`); g.addColorStop(1, `rgba(5,14,26,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(5,14,26,0)'); g.addColorStop(1, 'rgba(5,14,26,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(240,246,250,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(240,246,250,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, sk: `${key}|${W}x${H}|${state.settings.textIdx}`, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 14, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(240,246,250,0.14)'; ctx.fill();
    roundPath(ctx, W - 14, ty, 8, th, 4); ctx.fillStyle = 'rgba(240,246,250,0.72)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, a); };


export function renderTitle(ctx, state) {
  ctx.clearRect(-OX, 0, SW, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); if (LAND) { g.addColorStop(0, 'rgba(5,11,20,0.0)'); g.addColorStop(0.6, 'rgba(5,11,20,0.12)'); g.addColorStop(1, 'rgba(5,11,20,0.45)'); } else { g.addColorStop(0, 'rgba(5,11,20,0.06)'); g.addColorStop(0.4, 'rgba(5,11,20,0.34)'); g.addColorStop(0.65, 'rgba(5,11,20,0.10)'); g.addColorStop(1, 'rgba(5,11,20,0.0)'); }
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
  if (LAND) {
    // landscape: a compact heading at the top left, the athlete below it in the open grass, the menu on the right
    const lw = OX - host.l - 24, k = Math.min(0.62, Math.max(0.4, (H - host.t) / 640));
    ctx.save(); ctx.translate(host.l - OX + 14, host.t + 2); ctx.scale(k, k); drawHero(ctx, lw / k, true); ctx.restore();
  }
  const fr = drawFlowScreen(ctx, state, 'title', titleWidgets(state), MENU.top, MENU.bottom);
  titleLockTap = null;
  {
    const it = LAID.lay.items.find((i) => i.w.brand);
    if (it) {
      const lw = Math.min(it.wd - 40, LOCK_W), lh = Math.round(lw * 327 / 1200), cy = LAID.top + it.y - fr.scroll + 60, cx = it.x + it.wd / 2;
      const m = 44 / Math.max(0.2, host.px), tw = Math.max(lw + 24, m), th = Math.max(lh + 12, m);
      if (cy - th / 2 >= MENU.top && cy + th / 2 <= MENU.bottom) titleLockTap = { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th };
    }
  }
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 20px ${FONT}`; ctx.fillStyle = 'rgba(238,243,247,0.6)'; ctx.fillText('Web demo', LAND ? (host.l - OX) / 2 : W / 2, H - 14 - host.b); }
}
function pinned(ctx, state, key, widgets, label, back) {
  bg(ctx, 0.78);
  const pb = MENU.pinBottom;
  drawFlowScreen(ctx, state, key, widgets, MENU.top, pb);
  const g = ctx.createLinearGradient(0, pb - 30, 0, H);
  g.addColorStop(0, 'rgba(5,11,20,0)'); g.addColorStop(0.2, 'rgba(5,11,20,0.88)'); g.addColorStop(1, 'rgba(5,11,20,0.95)');
  ctx.fillStyle = g; ctx.fillRect(-OX, pb - 30, SW, H - pb + 30);
  drawButton(ctx, SETUP_PINS.start, label, { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, back, { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pb + 14); }
}
export const renderSetup = (ctx, state) => pinned(ctx, state, 'setup', setupWidgets(state), state.setup.watch ? 'Start Watch & Learn' : 'Start', 'Back');
export const renderSettings = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), MENU.top, MENU.bottom); };
export const renderResult = (ctx, state) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, 0.62); drawFlowScreen(ctx, state, 'result', resultWidgets(state), MENU.top, MENU.bottom); };
export const renderDemoLimit = (ctx, state) => { bg(ctx, 0.8); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), MENU.top, MENU.bottom); };
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 40), px0 = (W - pw) / 2;
  const lay = flowLayout(ctx, wd, sc, { x: px0 + 30, w: pw - 60 });
  const top = LAND ? MENU.top + 34 : 70 + MENU.top, bottom = LAND ? MENU.bottom - 34 : H - 70 - host.b;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px0, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(10,26,42,0.96)', stroke: 'rgba(240,246,250,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  if (maxScroll > 0) {
    const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, px0 + pw - 20, y0, 8, ch, 4); ctx.fillStyle = 'rgba(240,246,250,0.14)'; ctx.fill();
    roundPath(ctx, px0 + pw - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(240,246,250,0.72)'; ctx.fill();
  }
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px0, pw);
}

// ---- reference pages (Rules, How to Play, About): ONE continuous document that scrolls --------------------------------------
// Drag / swipe, mouse wheel, arrows, PageUp / PageDown, Space, Home / End all scroll it; a visible scroll bar shows where you are. The text size
// (100-300%) only changes how long the document is, never what is on screen being cut off.
export const READER = { h: 0, view: 0, max: 0 };
const hdrH = () => (LAND ? 64 : 84);
const viewT = () => PANEL.y + hdrH(), viewB = () => PANEL.y + PANEL.h - 14;
export const pageViewH = () => viewB() - viewT();

function buildDoc(ctx, list, scale) {
  const fs = Math.round(26 * scale), lh = fs * 1.2, tw = PANEL.w - 64;
  const secFs = Math.round(32 * Math.min(scale, 1.5));
  const items = []; let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y + 6 }); y += 22; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    tl.forEach((l) => { items.push({ k: 'title', y, text: l, fs: secFs }); y += secFs * 1.18; });
    y += 8;
    if (sec.art) { items.push({ k: 'art', y, art: sec.art, h: 210 }); y += 222; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l, fs }); y += lh; });
    });
    y += 10;
  });
  return { items, h: y + 12, fs };
}
const docCache = new Map();
export function docFor(ctx, list, header, scale) {
  const key = `${header}:${scale}:${list.length}:${PANEL.w}`;
  let d = docCache.get(key);
  if (!d) { d = buildDoc(ctx, list, scale); docCache.set(key, d); }
  return d;
}
export function readerMax(state, ctx, list, header) { return Math.max(0, docFor(ctx, list, header, TEXT_SCALES[state.settings.textIdx]).h - pageViewH()); }
export function renderPages(ctx, state, list, header) {
  bg(ctx, 0.8);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const VIEW_T = viewT(), VIEW_B = viewB(), HD = hdrH();
  const doc = docFor(ctx, list, header, sc);
  const viewH = pageViewH(), max = Math.max(0, doc.h - viewH);
  READER.h = doc.h; READER.view = viewH; READER.max = max;
  const scroll = Math.max(0, Math.min(state.ui.scroll, max));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(240,246,250,0.97)', stroke: 'rgba(14,34,52,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round((LAND ? 36 : 42) * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, PANEL.x + PANEL.w / 2, PANEL.y + HD * 0.6);
  ctx.strokeStyle = 'rgba(14,34,52,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 40, PANEL.y + HD - 18); ctx.lineTo(PANEL.x + PANEL.w - 40, PANEL.y + HD - 18); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW_T, PANEL.w - 12, viewH); ctx.clip();
  const top = VIEW_T - scroll;
  for (const it of doc.items) {
    const y = top + it.y;
    if (y > VIEW_B + 40 || y + (it.h || it.fs * 1.4 || 20) < VIEW_T - 40) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(14,34,52,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + PANEL.w / 2 - 8, y + it.fs * 0.9); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 30, y, PANEL.w - 72, it.h - 12); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + 22, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    // scroll bar: track + thumb on the panel's right edge, and "more" / "up" cues
    const tx = PANEL.x + PANEL.w - 16;
    roundPath(ctx, tx, VIEW_T, 8, viewH, 4); ctx.fillStyle = 'rgba(14,34,52,0.16)'; ctx.fill();
    const th = Math.max(56, viewH * (viewH / doc.h)), ty = VIEW_T + (scroll / max) * (viewH - th);
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(14,34,52,0.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, VIEW_B - 70, 0, VIEW_B); g.addColorStop(0, 'rgba(240,246,250,0)'); g.addColorStop(1, 'rgba(240,246,250,0.97)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, VIEW_B - 70, PANEL.w - 40, 70);
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 52, VIEW_B - 42, 104, 32, 16); ctx.fillStyle = 'rgba(14,34,52,0.82)'; ctx.fill();
      ctx.fillStyle = '#f0f6fa'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▼ scroll', PANEL.x + PANEL.w / 2, VIEW_B - 25);
    } else if (scroll > 4) {
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 40, VIEW_T + 6, 80, 30, 15); ctx.fillStyle = 'rgba(14,34,52,0.82)'; ctx.fill();
      ctx.fillStyle = '#f0f6fa'; ctx.font = `700 21px ${FONT}`; ctx.fillText('▲ up', PANEL.x + PANEL.w / 2, VIEW_T + 21);
    }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f0f6fa'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, (TEXT_DEC.x + TEXT_DEC.w + TEXT_INC.x) / 2, TEXT_DEC.y + TEXT_DEC.h / 2); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, REF_CLOSE, 'Close', { primary: true, size: 32 });
}


// ---- diagrams -------------------------------------------------------------------------------------
function arrow(ctx, x0, y0, x1, y1, col = '#f0c455', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 11 * Math.cos(a - 0.45), y1 - 11 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 11 * Math.cos(a + 0.45), y1 - 11 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function label(ctx, t, x, y, size = 18, col = '#eef3f7', align = 'center') {
  size = Math.max(size, minU());
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,30,44,0.94)'; ctx.fill();
  const cx = x + w / 2, cy = y + h / 2;
  const A = {
    hill() {
      const hl = HILLS[1], sc = Math.min((w - 70) / (hl.k * 1.5), (h - 60) / 62);
      const ox = x + 36, oy = y + 38;
      ctx.beginPath(); ctx.moveTo(ox - 26, oy - 20);
      ctx.lineTo(ox, oy);
      for (let u = 0; u <= hl.k * 1.5; u += 3) ctx.lineTo(ox + u * sc, oy - groundY(hl, u) * sc);
      ctx.lineTo(ox + hl.k * 1.5 * sc, y + h - 10); ctx.lineTo(ox - 26, y + h - 10); ctx.closePath(); ctx.fillStyle = '#eef3f7'; ctx.fill();
      const kx = ox + hl.k * sc, ky = oy - groundY(hl, hl.k) * sc;
      ctx.strokeStyle = '#d9902f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(kx, ky - 16); ctx.lineTo(kx, ky + 12); ctx.stroke();
      label(ctx, 'K-point = 60 points', kx + 6, ky - 24, 17, '#f2c14e', 'left');
      ctx.strokeStyle = '#8fd3e6'; ctx.lineWidth = 3; ctx.setLineDash([8, 7]); ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const u = i / 40, px = ox + u * hl.k * 1.04 * sc, py = oy - (-4 * 9 * u * (1 - u) * 1.0 + groundY(hl, u * hl.k * 1.04) + 9 * 4 * u * (1 - u) * 1.2) * sc; i ? ctx.lineTo(px, py - 4) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'take-off', ox + 4, oy - 30, 16, '#eef3f7', 'left');
    },
    ring() {
      const r = Math.min(h * 0.26, 56), c1 = x + w * 0.27, c2 = x + w * 0.73;
      ctx.beginPath(); ctx.arc(c1, cy - 4, r, 0, TAU); ctx.strokeStyle = 'rgba(238,243,247,0.7)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(c1, cy - 4, r * 1.7, 0, TAU); ctx.strokeStyle = '#8fd3e6'; ctx.lineWidth = 3; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
      label(ctx, 'ring closing', c1, y + h - 12, 17);
      ctx.beginPath(); ctx.arc(c2, cy - 4, r, 0, TAU); ctx.fillStyle = 'rgba(242,193,78,0.3)'; ctx.fill(); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 5; ctx.stroke();
      label(ctx, 'JUMP', c2, cy + 5, Math.max(18, r * 0.36), '#eef3f7'); label(ctx, 'lift your finger now', c2, y + h - 12, 17, '#f2c14e');
    },
    band() {
      const gx = x + w * 0.3, gy = y + 18, gh = h - 40;
      roundPath(ctx, gx, gy, 24, gh, 12); ctx.fillStyle = 'rgba(5,11,20,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(238,243,247,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      roundPath(ctx, gx + 3, gy + gh * 0.3, 18, gh * 0.22, 9); ctx.fillStyle = 'rgba(88,194,143,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(gx - 12, gy + gh * 0.58 - 11); ctx.lineTo(gx + 36, gy + gh * 0.58); ctx.lineTo(gx - 12, gy + gh * 0.58 + 11); ctx.closePath(); ctx.fillStyle = '#ff8f7a'; ctx.fill();
      arrow(ctx, gx + 70, gy + gh * 0.58, gx + 70, gy + gh * 0.44, '#f2c14e', 4);
      label(ctx, 'drag up', gx + 74, gy + gh * 0.72, 17, '#f2c14e', 'left');
      label(ctx, 'green band', gx + 40, gy + gh * 0.4, 17, '#58c28f', 'left');
      const lx = x + w * 0.58, ly = cy + 6, lw = w * 0.34;
      roundPath(ctx, lx, ly, lw, 20, 10); ctx.fillStyle = 'rgba(5,11,20,0.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(238,243,247,0.5)'; ctx.stroke();
      roundPath(ctx, lx + lw / 2 - 9, ly + 3, 18, 14, 7); ctx.fillStyle = 'rgba(88,194,143,0.9)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(lx + lw * 0.78, ly - 10); ctx.lineTo(lx + lw * 0.78 + 11, ly + 28); ctx.lineTo(lx + lw * 0.78 - 11, ly + 28); ctx.closePath(); ctx.fillStyle = '#ff8f7a'; ctx.fill();
      arrow(ctx, lx + lw * 0.74, ly - 22, lx + lw * 0.46, ly - 22, '#f2c14e', 4);
      label(ctx, 'drag toward the middle', lx + lw / 2, ly + 58, 17, '#eef3f7');
    },
    judges() {
      const marks = [18, 18.5, 17.5, 19, 18], drop = [2, 3];
      const bw = (w - 60) / 5;
      marks.forEach((m, i) => { const dropped = drop.includes(i); label(ctx, m.toFixed(1), x + 30 + bw * (i + 0.5), cy, 30, dropped ? 'rgba(238,243,247,0.35)' : '#eef3f7'); if (dropped) { ctx.fillStyle = 'rgba(238,243,247,0.5)'; ctx.fillRect(x + 30 + bw * (i + 0.5) - 24, cy - 10, 48, 3); } });
      label(ctx, 'highest and lowest are dropped', cx, y + h - 14, 18, '#f2c14e');
      label(ctx, 'five judges', cx, y + 30, 18, '#8fd3e6');
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffd98a'], ['REVEAL', '#7fd6c2'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const bx = x + 10 + i * (cw + 10); roundPath(ctx, bx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, bx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.hill)();
  ctx.restore();
}
