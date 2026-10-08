// Every screen that is not the play screen: title, year select, settings, result, pause, journal and the scrolling About / How to Play / Rules reader with its diagrams.
// Pure drawing; game.js owns state. All text follows the 100-300% size.
import { W, H, SW, OX, LAND, MENU, PANEL, host, minU, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_CLOSE, SETUP_PINS } from './layout.js';
import { drawLockupImage, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, flowLayout, drawFlow, flowHit } from './ui.js';
import { LEVELS, CHAPTERS, SEASONS, chapterLevels } from './levels.js';
import { JOURNAL } from './content.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 1280 };
export const flowMeta = () => LAID;
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  const sk = `${key}|${W}x${H}|${state.settings.textIdx}`;
  if (LAID.sk === sk && LAID.lay) return;
  const T = MENU.top, B = MENU.bottom, PB = MENU.pinBottom;
  const defs = { title: [titleWidgets, T, B], levels: [levelWidgets, T, PB], settings: [settingsWidgets, T, B], result: [resultWidgets, T, B], demolimit: [demoLimitWidgets, T, B], journal: [journalWidgets, T, PB] };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, sk, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const STAR = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function drawHero(ctx, w, flat) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const cx = w / 2, k = Math.min(1, (w - 20) / 640);
  ctx.fillStyle = flat ? 'rgba(5,14,8,0.5)' : 'rgba(5,14,8,0.58)'; roundPath(ctx, 2, 40, w - 4, 288, 30); ctx.fill();
  let px = Math.round(32 * k);
  ctx.font = `700 ${px}px ${FONT}`;
  const sub = 'PHILIPPINES  ·  BALI';
  while (ctx.measureText(sub).width > w - 24 && px > 12) { px--; ctx.font = `700 ${px}px ${FONT}`; }
  ctx.fillStyle = '#f0c455'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
  ctx.fillText(sub, cx, 96);
  let hp = Math.round(116 * Math.min(1, k * 1.1));
  ctx.font = `700 ${hp}px ${DISPLAY}`;
  while (ctx.measureText('Rice').width > w - 28 && hp > 24) { hp -= 2; ctx.font = `700 ${hp}px ${DISPLAY}`; }
  ctx.fillStyle = '#f3f6ea'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillText('Rice', cx, 214);
  ctx.font = `700 ${Math.round(72 * Math.min(1, k * 1.1))}px ${DISPLAY}`; ctx.fillStyle = '#a9dc7a'; ctx.fillText('Terraces', cx, 290);
  ctx.restore();
}
const heroArt = () => { const k = H < 1200 ? 0.75 : 1; return { t: 'art', h: Math.round(380 * k), draw(ctx, w) { ctx.save(); ctx.scale(k, k); drawHero(ctx, w / k); ctx.restore(); } }; };
const LOCK_W = 300;
let titleLockTap = null;
export const getLockTap = () => titleLockTap;
const brandArt = () => ({ t: 'art', h: 120, brand: true, draw(ctx, w) {
  const lw = Math.min(w - 40, LOCK_W), lh = Math.round(lw * 327 / 1200);
  ctx.save(); ctx.fillStyle = lockDownFlag ? 'rgba(240,196,85,0.5)' : 'rgba(5,14,8,0.55)'; roundPath(ctx, w / 2 - lw / 2 - 12, 60 - lh / 2 - 6, lw + 24, lh + 12, (lh + 12) / 2); ctx.fill(); ctx.restore();
  drawLockupImage(ctx, w / 2, 60, lw, 1);
} });
let lockDownFlag = false;
export const setLockDown = (v) => { lockDownFlag = v; };

export function titleWidgets(state) {
  const heroH = H < 1200 ? 285 : 380;
  return [
    ...(LAND ? [{ t: 'gap', h: 24 }] : [heroArt(), { t: 'gap', h: Math.max(10, Math.round(H - host.t - host.b - heroH - 690 - (state.demo ? 30 : 0))) }]),
    { t: 'btn', id: 'play', label: 'Begin the year', sub: 'Choose a chapter and a year', primary: true, h: !LAND && H < 1200 ? 80 : 92 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', sub: 'A whole year, with every decision explained' },
    { t: 'btn', id: 'journal', label: 'Journal and village', sub: `${state.stars} stars · ${state.houses} houses`, row: 1 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: state.settings.sound ? 'Sound: On' : 'Sound: Off', row: 3 },
    brandArt(),
  ];
}

export function levelWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: state.setup.watch ? 'Watch & Learn' : 'Choose a year', size: 48 }];
  wd.push({ t: 'p', label: state.setup.watch ? 'Which hillside should the computer farmer tend?' : 'Each year is a new hillside with new weather.', bold: true, color: '#ffd98a', size: 26 });
  CHAPTERS.forEach((ch, ci) => {
    wd.push({ t: 'h', label: `${ch.name}, ${ch.place}`, size: 34, cap: 1.4, color: '#a9dc7a' });
    chapterLevels(ci).forEach((lv, k) => {
      const rec = state.record.done[lv.id];
      const open = k === 0 || !!state.record.done[chapterLevels(ci)[k - 1].id] || state.setup.watch;
      const demoLocked = state.demo && k > 0;
      wd.push({ t: 'btn', id: `lv-${lv.id}`, label: `Year ${lv.year}: ${lv.name}`, sub: demoLocked ? 'In the full game' : open ? `${lv.R} tiers of ${lv.C} fields${rec ? `  ·  ${STAR(rec.stars)}` : ''}` : 'Finish the year before first', active: state.setup.lv === lv.id, disabled: !open || demoLocked, h: 92 });
    });
  });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${state.thinkSteps[st.thinkIdx]} s`, bold: true, color: '#ffd98a', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === state.thinkSteps.length - 1 },
    { t: 'p', label: 'The chapter and the year are chosen when you begin.', size: 22 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffd98a' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const f = state.farm.f, sc = f.score, lv = state.lv, big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big || LAND ? 24 : 56 }];
  wd.push({ t: 'h', label: sc.stars >= 3 ? 'A golden year' : sc.stars === 2 ? 'A good harvest' : sc.stars === 1 ? 'The village is fed' : 'A hard year', size: 52, cap: 1.3, color: sc.stars >= 2 ? '#f0c455' : '#f3f6ea' });
  wd.push({ t: 'h', label: STAR(sc.stars), size: 76, color: '#f0c455', cap: 1.1 });
  wd.push({ t: 'p', label: `Year ${lv.year}: ${lv.name}`, size: 28, bold: true, cap: big ? 2 : 3 });
  const pc = (x) => `${Math.round(x * 100)}%`;
  wd.push({ t: 'p', label: `Your harvest ${pc(sc.yield)}`, size: 26, cap: big ? 2 : 3 });
  if (sc.shared !== null) wd.push({ t: 'p', label: `Neighbours' harvest ${pc(sc.shared)}`, size: 26, cap: big ? 2 : 3 });
  if (sc.valley !== null) wd.push({ t: 'p', label: `Valley's share of water ${pc(sc.valley)}`, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'p', label: `Walls ${pc(sc.walls)}  ·  Total ${pc(sc.total)}`, size: 26, cap: big ? 2 : 3 });
  if (state.newPages.length) wd.push({ t: 'p', label: `New journal page${state.newPages.length > 1 ? 's' : ''}: ${state.newPages.map((id) => JOURNAL.find((j) => j.id === id).title).join(', ')}`, size: 24, color: '#ffd98a', bold: true, cap: big ? 2 : 2.5 });
  if (state.houseGain > 0) wd.push({ t: 'p', label: `The village grows by ${state.houseGain} house${state.houseGain > 1 ? 's' : ''}.`, size: 24, color: '#a9dc7a', bold: true, cap: big ? 2 : 2.5 });
  wd.push({ t: 'gap', h: 14 });
  const next = state.nextLevel;
  if (next) wd.push({ t: 'btn', id: 'next', label: `Next: Year ${next.year}, ${next.name}`, primary: true, h: 88 });
  wd.push({ t: 'btn', id: 'again', label: 'Play this year again', primary: !next, row: 6 });
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
    { t: 'btn', id: 'p-txt-dec', label: 'A−  Smaller', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txt-inc', label: 'A+  Larger', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'The web demo has the first year of each chapter. The full game on iPhone and Android has all eight years, the Daily weather of the Bali council, Watch & Learn on every hillside and the whole journal.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

export function journalWidgets(state) {
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Journal and village', size: 46 }];
  wd.push({ t: 'art', h: 150, draw: (ctx, w, h) => drawVillage(ctx, w, h, state.houses, state.stars) });
  wd.push({ t: 'p', label: `${state.stars} stars earned · ${state.houses} houses · ${state.record.pages.length} of ${JOURNAL.length} pages`, bold: true, color: '#ffd98a', size: 24 });
  for (const j of JOURNAL) {
    const have = state.record.pages.includes(j.id);
    wd.push({ t: 'h', label: have ? j.title : 'A page not yet found', size: 30, cap: 1.5, color: have ? '#a9dc7a' : 'rgba(243,246,234,0.45)' });
    wd.push({ t: 'p', label: have ? j.text : 'Finish more years and keep the walls, the rice and the neighbours well to find it.', size: 24, color: have ? undefined : 'rgba(243,246,234,0.45)' });
  }
  wd.push({ t: 'gap', h: 24 });
  return wd;
}
function drawVillage(ctx, w, h, houses) {
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 20); ctx.fillStyle = 'rgba(8,22,14,0.62)'; ctx.fill(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b4a3a'); g.addColorStop(1, '#16301f'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3d6b3a'; ctx.beginPath(); ctx.moveTo(0, h * 0.78); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * (0.66 + 0.06 * Math.sin(x * 0.02))); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  const n = Math.max(1, Math.min(12, houses));
  for (let i = 0; i < 12; i++) {
    const x = 28 + (i * (w - 60)) / 11, y = h * (0.66 + 0.06 * Math.sin(x * 0.02)) - 4 - (i % 3) * 8;
    const on = i < n;
    ctx.globalAlpha = on ? 1 : 0.18;
    ctx.fillStyle = on ? '#d9b46a' : '#8aa07a'; ctx.fillRect(x - 11, y - 16, 22, 16);
    ctx.fillStyle = on ? '#7b3f26' : '#6a7a5a'; ctx.beginPath(); ctx.moveTo(x - 15, y - 15); ctx.lineTo(x, y - 30); ctx.lineTo(x + 15, y - 15); ctx.closePath(); ctx.fill();
    if (on) { ctx.fillStyle = '#ffe9a0'; ctx.fillRect(x - 3, y - 11, 6, 7); }
  }
  ctx.restore();
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(6,16,10,${a * 0.7})`); g.addColorStop(0.5, `rgba(6,16,10,${a})`); g.addColorStop(1, `rgba(6,16,10,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
}
export function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(6,16,10,0)'); g.addColorStop(1, 'rgba(6,16,10,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(243,246,234,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${Math.max(22, minU())}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(243,246,234,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 ${Math.max(22, minU())}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
    roundPath(ctx, W - 14, top, 8, bottom - top, 4); ctx.fillStyle = 'rgba(243,246,234,0.14)'; ctx.fill();
    roundPath(ctx, W - 14, ty, 8, th, 4); ctx.fillStyle = 'rgba(243,246,234,0.72)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}
const bg = (ctx, a) => { ctx.clearRect(-OX, 0, SW, H); scrim(ctx, a); };

export function renderTitle(ctx, state) {
  ctx.clearRect(-OX, 0, SW, H);
  const g = ctx.createLinearGradient(0, 0, 0, H); if (LAND) { g.addColorStop(0, 'rgba(5,14,8,0.0)'); g.addColorStop(0.6, 'rgba(5,14,8,0.12)'); g.addColorStop(1, 'rgba(5,14,8,0.45)'); } else { g.addColorStop(0, 'rgba(5,14,8,0.06)'); g.addColorStop(0.4, 'rgba(5,14,8,0.34)'); g.addColorStop(0.65, 'rgba(5,14,8,0.10)'); g.addColorStop(1, 'rgba(5,14,8,0.0)'); }
  ctx.fillStyle = g; ctx.fillRect(-OX, 0, SW, H);
  if (LAND) {
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
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(20, minU())}px ${FONT}`; ctx.fillStyle = 'rgba(243,246,234,0.6)'; ctx.fillText('Web demo', LAND ? (host.l - OX) / 2 : W / 2, H - 14 - host.b); }
}
function pinned(ctx, state, key, widgets, label, back) {
  bg(ctx, 0.78);
  const pb = MENU.pinBottom;
  drawFlowScreen(ctx, state, key, widgets, MENU.top, pb);
  const g = ctx.createLinearGradient(0, pb - 30, 0, H);
  g.addColorStop(0, 'rgba(5,14,8,0)'); g.addColorStop(0.2, 'rgba(5,14,8,0.88)'); g.addColorStop(1, 'rgba(5,14,8,0.95)');
  ctx.fillStyle = g; ctx.fillRect(-OX, pb - 30, SW, H - pb + 30);
  if (label) drawButton(ctx, SETUP_PINS.start, label, { primary: true, size: 32 });
  drawButton(ctx, label ? SETUP_PINS.back : { x: 30, y: SETUP_PINS.back.y, w: W - 60, h: SETUP_PINS.back.h }, back, { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, minU())}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, pb + 14); }
}
export const renderLevels = (ctx, state) => pinned(ctx, state, 'levels', levelWidgets(state), state.setup.lv ? (state.setup.watch ? 'Start Watch & Learn' : 'Begin') : '', 'Back');
export const renderJournal = (ctx, state) => pinned(ctx, state, 'journal', journalWidgets(state), '', 'Back');
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
  panel(ctx, px0, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(12,30,20,0.96)', stroke: 'rgba(243,246,234,0.45)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  if (maxScroll > 0) {
    const th = Math.max(50, ch * (ch / lay.contentH)), ty = y0 + (sc0 / maxScroll) * (ch - th);
    roundPath(ctx, px0 + pw - 20, y0, 8, ch, 4); ctx.fillStyle = 'rgba(243,246,234,0.14)'; ctx.fill();
    roundPath(ctx, px0 + pw - 20, ty, 8, th, 4); ctx.fillStyle = 'rgba(243,246,234,0.72)'; ctx.fill();
  }
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, px0, pw);
}

// ---- reference pages (Rules, How to Play, About): ONE continuous document that scrolls --------------------------------------
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(244,248,238,0.97)', stroke: 'rgba(20,48,30,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.vermDark; ctx.font = `700 ${Math.round((LAND ? 36 : 42) * Math.min(sc, 1.15))}px ${DISPLAY}`;
  ctx.fillText(header, PANEL.x + PANEL.w / 2, PANEL.y + HD * 0.6);
  ctx.strokeStyle = 'rgba(20,48,30,0.3)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 40, PANEL.y + HD - 18); ctx.lineTo(PANEL.x + PANEL.w - 40, PANEL.y + HD - 18); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(PANEL.x + 6, VIEW_T, PANEL.w - 12, viewH); ctx.clip();
  const top = VIEW_T - scroll;
  for (const it of doc.items) {
    const y = top + it.y;
    if (y > VIEW_B + 40 || y + (it.h || it.fs * 1.4 || 20) < VIEW_T - 40) continue;
    if (it.k === 'rule') { ctx.strokeStyle = 'rgba(20,48,30,0.2)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.k === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.indigo; ctx.font = `700 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + PANEL.w / 2 - 8, y + it.fs * 0.9); }
    else if (it.k === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 52, it.h); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 30, y, PANEL.w - 72, it.h - 12); ctx.restore(); }
    else { ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `400 ${it.fs}px ${FONT}`; ctx.fillText(it.text, PANEL.x + 22, y + it.fs * 0.85); }
  }
  ctx.restore();
  if (max > 0) {
    const tx = PANEL.x + PANEL.w - 16;
    roundPath(ctx, tx, VIEW_T, 8, viewH, 4); ctx.fillStyle = 'rgba(20,48,30,0.16)'; ctx.fill();
    const th = Math.max(56, viewH * (viewH / doc.h)), ty = VIEW_T + (scroll / max) * (viewH - th);
    roundPath(ctx, tx, ty, 8, th, 4); ctx.fillStyle = 'rgba(20,48,30,0.62)'; ctx.fill();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    if (scroll < max - 4) {
      const g = ctx.createLinearGradient(0, VIEW_B - 70, 0, VIEW_B); g.addColorStop(0, 'rgba(244,248,238,0)'); g.addColorStop(1, 'rgba(244,248,238,0.97)');
      ctx.fillStyle = g; ctx.fillRect(PANEL.x + 6, VIEW_B - 70, PANEL.w - 40, 70);
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 52, VIEW_B - 42, 104, 32, 16); ctx.fillStyle = 'rgba(20,48,30,0.82)'; ctx.fill();
      ctx.fillStyle = '#f3f6ea'; ctx.font = `700 ${Math.max(21, minU())}px ${FONT}`; ctx.fillText('▼ scroll', PANEL.x + PANEL.w / 2, VIEW_B - 25);
    } else if (scroll > 4) {
      roundPath(ctx, PANEL.x + PANEL.w / 2 - 40, VIEW_T + 6, 80, 30, 15); ctx.fillStyle = 'rgba(20,48,30,0.82)'; ctx.fill();
      ctx.fillStyle = '#f3f6ea'; ctx.font = `700 ${Math.max(21, minU())}px ${FONT}`; ctx.fillText('▲ up', PANEL.x + PANEL.w / 2, VIEW_T + 21);
    }
    ctx.textBaseline = 'alphabetic';
  }
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f3f6ea'; ctx.font = `700 ${Math.max(24, minU())}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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
function label(ctx, t, x, y, size = 18, col = '#f3f6ea', align = 'center') {
  size = Math.max(size, minU());
  ctx.save(); ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; ctx.fillText(t, x, y); ctx.restore();
}
export const SEASON_COL = ['#6fb7d6', '#8fd06a', '#3f9b4a', '#e6b93e'];
export function gateIcon(ctx, x, y, r, open, blocked) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = blocked ? 'rgba(60,66,60,0.85)' : open ? 'rgba(30,150,170,0.92)' : 'rgba(205,140,45,0.94)'; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.1); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = Math.max(2.5, r * 0.15); ctx.lineCap = 'round';
  if (blocked) { const d = r * 0.4; ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.stroke(); }
  else if (open) { // a lifted board and a drop of water below
    ctx.beginPath(); ctx.moveTo(x - r * 0.42, y - r * 0.12); ctx.lineTo(x + r * 0.42, y - r * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.4, y - r * 0.5); ctx.lineTo(x - r * 0.4, y - r * 0.12); ctx.moveTo(x + r * 0.4, y - r * 0.5); ctx.lineTo(x + r * 0.4, y - r * 0.12); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + r * 0.34, r * 0.17, 0, TAU); ctx.fill();
  } else { // the board is down
    ctx.beginPath(); ctx.moveTo(x - r * 0.46, y + r * 0.02); ctx.lineTo(x + r * 0.46, y + r * 0.02); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.46, y - r * 0.4); ctx.lineTo(x - r * 0.46, y + r * 0.42); ctx.moveTo(x + r * 0.46, y - r * 0.4); ctx.lineTo(x + r * 0.46, y + r * 0.42); ctx.stroke();
  }
  ctx.restore();
}
export function gaugeBar(ctx, x, y, w, h, level, band, cap = 4) {
  roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = 'rgba(6,18,12,0.78)'; ctx.fill();
  if (band) { ctx.fillStyle = 'rgba(110,210,120,0.55)'; ctx.fillRect(x + w * (band[0] / cap), y + 1, w * ((band[1] - band[0]) / cap), h - 2); }
  const ok = !band || (level >= band[0] - 1e-6 && level <= band[1] + 1e-6);
  roundPath(ctx, x, y, Math.max(h, w * Math.min(1, level / cap)), h, h / 2); ctx.fillStyle = ok ? '#5ad0e6' : '#f2a03a'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(243,246,234,0.7)'; roundPath(ctx, x, y, w, h, h / 2); ctx.stroke();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save();
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(14,34,22,0.95)'; ctx.fill();
  const cx = x + w / 2, cy = y + h / 2;
  const A = {
    seasons() {
      const bw = (w - 50) / 4;
      SEASONS.forEach((s, i) => {
        const bx = x + 10 + i * (bw + 10);
        roundPath(ctx, bx, y + 22, bw, h - 44, 14); ctx.fillStyle = SEASON_COL[i]; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1;
        label(ctx, s.name, bx + bw / 2, y + h / 2 + 6, 24, '#10230f');
        label(ctx, `${s.len} s`, bx + bw / 2, y + h / 2 + 34, 18, '#10230f');
      });
    },
    gates() {
      const items = [[true, false, 'open'], [false, false, 'closed'], [false, true, 'plugged']];
      const cw = w / 3;
      items.forEach((it, i) => { gateIcon(ctx, x + cw * (i + 0.5), cy - 12, Math.min(34, h * 0.2), it[0], it[1]); label(ctx, it[2], x + cw * (i + 0.5), cy + 52, 20); });
    },
    band() {
      gaugeBar(ctx, x + 40, cy - 30, w - 80, 30, 2.4, [1.5, 3]);
      label(ctx, 'the green band is what the field wants now', cx, cy + 28, 19, '#a9dc7a');
      label(ctx, '0', x + 40, cy + 58, 17, '#f3f6ea', 'left'); label(ctx, '4 hands', x + w - 40, cy + 58, 17, '#f3f6ea', 'right');
    },
    water() {
      const sx = x + 30, sw = (w - 80) / 2;
      [0, 1].forEach((k) => {
        const px = sx + k * (sw + 20), py = y + 40 + k * 66;
        ctx.fillStyle = '#6b4f33'; ctx.fillRect(px, py + 18, sw, 70 - k * 20);
        ctx.fillStyle = 'rgba(80,190,215,0.9)'; ctx.fillRect(px + 6, py + 4, sw - 12, 16);
        ctx.fillStyle = '#8c8c86'; ctx.fillRect(px + sw - 6, py, 8, 70);
      });
      arrow(ctx, sx + sw - 4, y + 56, sx + sw + 28, y + 108, '#5ad0e6', 4);
      label(ctx, 'spill gate', sx + sw + 8, y + 40, 18, '#f0c455'); label(ctx, 'water runs downhill', cx, y + h - 14, 18, '#a9dc7a');
    },
    think() { const cw = (w - 40) / 3; [['THINK', '#ffd98a'], ['REVEAL', '#7fd6c2'], ['ACT', '#ff9a86']].forEach(([nm, col], i) => { const bx = x + 10 + i * (cw + 10); roundPath(ctx, bx, y + 24, cw, h - 48, 16); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fill(); label(ctx, nm, bx + cw / 2, y + h / 2 + 8, 26, col); }); },
  };
  (A[key] ?? A.seasons)();
  ctx.restore();
}
