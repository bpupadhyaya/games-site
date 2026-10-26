// Every screen that is not the play screen: title, duel setup, figure ladder, settings, result, pause, figure summary and the
// paginated About / How to play / Rules reader with its illustrations (drawn with the game's own pins and bat through the same
// true-perspective camera). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, clamp, host, safe, shape, column, readerGeo, setupPinsGeo, tapH, backClear, minFont } from './layout.js';
import { drawBrandLockup, drawMoreLine, lockupHeight } from './brand.js';
import { SQ, STYLES, ORIGIN } from './sim.js';
import { FIGURES, figurePins } from './figures.js';
import { drawStandingPin, groundRing, PAL } from './art.js';
import { drawAttract, makeCam } from './view.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { RIVALS } from './ai.js';
import { THINK_STEPS } from './layout.js';

const TAU = Math.PI * 2;
const SUB = '#bcd6f2';

// ---- flow screens ----------------------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H }; colCache.clear(); }
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.55 }; } };
const MODALS = new Set(['pause', 'reason', 'figres']);
const wideNow = () => shape() === 'wide';
const WIDGETS = () => ({
  title: titleWidgets, setup: setupWidgets, ladder: ladderWidgets, settings: settingsWidgets, result: resultWidgets, demolimit: demoLimitWidgets,
  pause: pauseWidgets, reason: reasonWidgets, figres: figresWidgets,
});
let PIN = false;
const LOCK_W = 250;
const PIN_H = () => Math.round(lockupHeight(LOCK_W)) + 24;
const pinRect = (g) => ({ cx: g.x + g.w / 2, y: g.bottom + 8, w: LOCK_W, h: Math.round(lockupHeight(LOCK_W)) });
export function flowGeo(key) {
  const u = safe(), c = column(), wide = wideNow();
  const pin = key === 'title' && PIN ? PIN_H() : 0;
  if (MODALS.has(key)) {
    const mw = wide ? Math.min(660, u.w - 120) : c.w - 60, mx = u.x0 + (u.w - mw) / 2;
    return { x: mx + 30, w: mw - 60, top: u.y0 + 60, bottom: u.y1 - 60, panelX: mx, panelW: mw, modal: true };
  }
  if (key === 'title' && wide) {
    const pw = clamp(Math.round(u.w * 0.4), 440, 600), x = u.x1 - 24 - pw;
    return { x, w: pw, top: u.y0 + 8, bottom: u.y1 - 8 - pin, center: true, hero: { x: u.x0 + 16, w: x - u.x0 - 40, y0: u.y0, y1: u.y1 } };
  }
  const w = wide ? clamp(Math.round(u.w * 0.5), 560, 720) : c.w - 80, x = wide ? u.x0 + (u.w - w) / 2 : c.x + 40;
  const top = u.y0 + (wide ? 0 : backClear()), bottom = key === 'setup' ? setupPinsGeo().top - 26 : u.y1 - pin;
  return { x, w, top, bottom, center: wide && (key === 'result' || key === 'demolimit') };
}
export function ensureLayout(state, key) {
  const sk = `${W}x${H}|${key}`;
  if (LAID.key === key && LAID.lay && LAID.sk === sk) return;
  const make = WIDGETS()[key];
  if (!make) return;
  if (key === 'title') PIN = state.settings.textIdx > 0;
  const g = flowGeo(key);
  const lay = flowLayout(estCtx, make(state), TEXT_SCALES[state.settings.textIdx], { x: g.x, w: g.w });
  const room = g.bottom - g.top, off = g.center && lay.contentH < room ? (room - lay.contentH) / 2 : 0;
  LAID = { key, sk, lay, top: g.top + off, bottom: g.bottom, h: lay.contentH };
}
export function hitScreen(x, y, scroll) {
  if (LAID.key === 'title' && PIN) { const r = pinRect(flowGeo('title')), hw = Math.max(r.w, 44 / Math.max(host.px, 1e-6)) / 2, hh = Math.max(r.h, 44 / Math.max(host.px, 1e-6)); if (x >= r.cx - hw && x <= r.cx + hw && y >= r.y - 4 && y <= r.y - 4 + hh + 4) return 'arcforge'; }
  return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null;
}

// The title lettering, drawn at scale k with its top-left at (x, y); 720 x 300 units at k = 1.
function drawHero(ctx, cx, y, k) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${Math.round(124 * k)}px ${FONT}`; ctx.lineJoin = 'round';
  // embossed gilded lettering: a deep shadow, a dark outline, a brass gradient and a thin light edge on top
  ctx.fillStyle = 'rgba(20,10,4,0.55)'; ctx.fillText('GORODKI', cx + 3 * k, y + 150 * k + 8 * k);
  ctx.lineWidth = Math.max(4, 14 * k); ctx.strokeStyle = '#3a1c08'; ctx.strokeText('GORODKI', cx, y + 150 * k);
  const g = ctx.createLinearGradient(0, y + 60 * k, 0, y + 150 * k); g.addColorStop(0, '#fff6c8'); g.addColorStop(0.5, '#f2b83a'); g.addColorStop(1, '#a8601a');
  ctx.fillStyle = g; ctx.fillText('GORODKI', cx, y + 150 * k);
  ctx.lineWidth = Math.max(1.5, 2.5 * k); ctx.strokeStyle = 'rgba(255,255,230,0.75)'; ctx.strokeText('GORODKI', cx, y + 148 * k);
  // a painted red band with the translation
  const bw = 400 * k, bh = 46 * k, by = y + 178 * k;
  roundPath(ctx, cx - bw / 2, by, bw, bh, bh / 2); ctx.fillStyle = PAL.red; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = PAL.gold; ctx.stroke();
  ctx.font = `800 ${Math.round(26 * k)}px ${FONT}`; ctx.fillStyle = '#fff5dc'; ctx.textBaseline = 'middle'; ctx.fillText('TOWN SKITTLES', cx, by + bh / 2 + 1);
  ctx.restore();
}
const heroK = () => clamp(0.6 + (H - 960) * 0.00075, 0.6, 1);
const heroArt = () => { const k = heroK(); return { t: 'art', h: Math.round(250 * k), draw(ctx, w) { drawHero(ctx, w / 2, 0, k); } }; };
const lockupArt = () => {
  const lh = Math.round(lockupHeight(LOCK_W));
  return { t: 'art', id: 'arcforge', hitW: LOCK_W, h: lh + 20, draw(ctx, w) {
    ctx.save(); ctx.beginPath(); ctx.roundRect(w / 2 - LOCK_W / 2 - 10, 0, LOCK_W + 20, lh + 16, 14); ctx.fillStyle = 'rgba(14,26,46,0.55)'; ctx.fill(); ctx.restore();
    drawBrandLockup(ctx, w / 2, 8, LOCK_W, { alpha: 0.95 });
  } };
};
const moreArt = () => ({ t: 'art', h: 54, draw(ctx, w) { drawMoreLine(ctx, w / 2, 28, 20); } });
const starsText = (n) => `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`;

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wide = wideNow();
  const done = state.record.ladder.filter((v) => v > 0).length;
  const wd = wide ? [{ t: 'gap', h: 4 }] : [heroArt(), { t: 'gap', h: H < 1000 ? 12 : H < 1250 ? 30 : 90 }];
  wd.push({ t: 'btn', id: 'ladder', label: 'Figure ladder', sub: `${done} of 15 figures cleared`, primary: true, h: 96 });
  wd.push({ t: 'btn', id: 'duel', label: 'Duel', sub: 'Play a rival, figure by figure', h: 92 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 1 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  if (wide) {
    wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
    wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', dark: true, row: 3 });
  } else {
    wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
    wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', dark: true, row: 3 });
  }
  if (state.settings.textIdx > 0) { wd.push({ t: 'gap', h: 12 }); return wd; }
  wd.push({ t: 'gap', h: wide ? 2 : 22 }, lockupArt());
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Duel', size: 48 }];
  wd.push({ t: 'p', label: 'Five figures. You and your rival play each one from the start; fewer bats wins the figure.', size: 25, color: SUB });
  wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#cfe6ff', size: 26 });
  const rows = wideNow();
  RIVALS.forEach((r, i) => {
    const won = rec.wins[i] ?? 0;
    const locked = demo && i > 1;
    wd.push({ t: 'btn', id: `lvl${i}`, label: r.name, sub: locked ? 'In the full game' : `${'★'.repeat(r.stars)}${'☆'.repeat(4 - r.stars)}  ${r.tag}${won ? ` · won ${won}` : ''}`, active: s.rival === i && !locked, disabled: locked, hitDisabled: true, h: 88, row: rows ? 40 + (i >> 1) : undefined });
  });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function ladderWidgets(state) {
  const rec = state.record, demo = state.demo;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Figure ladder', size: 48 },
    { t: 'p', label: 'Clear the figures in order, alone. Fewer bats earn more stars.', size: 24, color: SUB }];
  FIGURES.forEach((f, i) => {
    const n = figurePins(i).length, st = rec.ladder[i] | 0;
    const open = state.dev || (i === 0 || rec.ladder[i - 1] > 0);
    const locked = demo && i >= 3;
    const sub = locked ? 'In the full game' : !open ? 'Clear the figure before this one' : `${n} pins · ${f.bats} bats${st ? `  ${starsText(st)}` : ''}`;
    wd.push({ t: 'btn', id: `fig${i}`, label: `${i + 1}. ${f.name}`, sub, active: st > 0, dark: !st, disabled: !open || locked, hitDisabled: true, h: 90 });
  });
  wd.push({ t: 'gap', h: 10 }); wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }); wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const guide = ['Lane and ring', 'Ring only', 'Off'][st.guide];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-haptics', label: st.haptics ? 'Vibration: On' : 'Vibration: Off', sub: 'A short buzz when the bat lands or pins fly (on phones that allow it)' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#cfe6ff', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'set-guide', label: `Aim guide: ${guide}`, sub: 'What the lane and the ring show before you throw' },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#cfe6ff', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: SUB }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.m, o = m.over;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wide = wideNow();
  const wd = [{ t: 'gap', h: big || wide ? 14 : 50 }, { t: 'h', label: o.draw ? 'A draw' : o.win ? 'You win!' : 'Good match', size: wide ? 52 : 64, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: `${m.pts.you} : ${m.pts.rival}`, size: wide ? 60 : 76, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `You against ${state.names.rival}${o.extra ? ' (decided on an extra figure)' : ''}.`, bold: true, size: 26, cap: big ? 2 : 3 });
  const rows = m.res.map((r) => `${r.name}: you ${r.you === null ? 'not cleared' : `${r.you} bat${r.you === 1 ? '' : 's'}`}, ${state.names.rival} ${r.rival === null ? 'not cleared' : `${r.rival} bat${r.rival === 1 ? '' : 's'}`}`);
  for (const r of rows) wd.push({ t: 'p', label: r, size: big ? 22 : 26, cap: 2 });   // one line per figure
  wd.push({ t: 'gap', h: 20 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New duel', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreArt());
  wd.push({ t: 'gap', h: 14 });
  return wd;
}

export function figresWidgets(state) {
  const r = state.figRes ?? { title: '', text: '', score: '', good: true, buttons: [] };
  const wd = [
    { t: 'h', label: r.title, size: 48, color: r.good ? '#8bf0c0' : '#ffd9a0' },
    { t: 'p', label: r.text, size: 26 },
  ];
  if (r.score) wd.push({ t: 'p', label: r.score, size: 26, bold: true, color: '#ffd97a' });
  r.buttons.forEach((b, i) => wd.push({ t: 'btn', id: b.id, label: b.label, primary: i === 0, dark: i > 0, h: i === 0 ? 88 : undefined }));
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-guide', label: `Guide: ${['Lane', 'Ring', 'Off'][st.guide]}`, row: 8 },
    { t: 'btn', id: 'p-txtdec', label: 'A−', row: 10, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'p-txtinc', label: 'A+', row: 10, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function reasonWidgets(state) {
  const k = state.cardFull ?? { title: '', text: '' };
  return [{ t: 'h', label: k.title, size: 40, color: '#ffd447' }, { t: 'p', label: k.text || 'The reason appears when the choice is revealed.', size: 26, align: 'left', pad: 4 }, { t: 'btn', id: 'reason-close', label: 'Close', primary: true, h: 84 }];
}
export function demoLimitWidgets(state) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: big ? 30 : 160 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free figures of the web demo. The full game on iPhone and Android has all fifteen figures, every rival and unlimited duels.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(14,26,46,${a * 0.75})`); g.addColorStop(0.5, `rgba(14,26,46,${a})`); g.addColorStop(1, `rgba(14,26,46,${Math.min(0.94, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(14,26,46,0)'); g.addColorStop(1, 'rgba(14,26,46,0.75)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(236,244,255,0.92)'; ctx.fill();
    ctx.fillStyle = '#14233a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    const ux = Math.min(x0 + w - 52, cx + 120);   // tucked to the right so it never covers the first line of text
    roundPath(ctx, ux - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(236,244,255,0.78)'; ctx.fill();
    ctx.fillStyle = '#14233a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', ux, top + 24);
  }
}
function drawFlowScreen(ctx, state, key, widgets, sceneHook) {
  if (key === 'title') PIN = state.settings.textIdx > 0;
  const sc = TEXT_SCALES[state.settings.textIdx], g = flowGeo(key);
  const lay = flowLayout(ctx, widgets, sc, { x: g.x, w: g.w });
  const room = g.bottom - g.top, off = g.center && lay.contentH < room ? (room - lay.contentH) / 2 : 0, top = g.top + off, bottom = g.bottom;
  LAID = { key, sk: `${W}x${H}|${key}`, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  if (sceneHook) sceneHook(g);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, g.x + g.w + 14, ty, 5, th, 3); ctx.fillStyle = 'rgba(236,244,255,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll, g.x - 20, g.w + 40);
  }
  if (key === 'title' && PIN) {
    const r = pinRect(g);
    ctx.save(); ctx.beginPath(); ctx.roundRect(r.cx - LOCK_W / 2 - 10, r.y - 4, LOCK_W + 20, r.h + 16, 14); ctx.fillStyle = 'rgba(14,26,46,0.7)'; ctx.fill(); ctx.restore();
    drawBrandLockup(ctx, r.cx, r.y + 4, LOCK_W, { alpha: 0.95 });
  }
  return { scroll, maxScroll, lay };
}

const attract = (ctx, state) => drawAttract(ctx, state);

export function renderTitle(ctx, state) {
  attract(ctx, state);
  scrim(ctx, 0.3);
  const wide = wideNow(), u = safe();
  const hx = wide ? flowGeo('title').hero : null;
  const cxHero = wide ? hx.x + hx.w / 2 : W / 2, cyHero = wide ? (hx.y0 + hx.y1) / 2 - 80 : 170;
  const g = ctx.createRadialGradient(cxHero, cyHero, 40, cxHero, cyHero, wide ? 380 : 420);
  g.addColorStop(0, 'rgba(14,26,46,0.6)'); g.addColorStop(1, 'rgba(14,26,46,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, wide ? H : 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), wide ? () => {
    const k = clamp(Math.min(hx.w / 560, (hx.y1 - hx.y0 - 100) / 330), 0.5, 1.1);
    const blockH = 250 * k, y0 = (hx.y0 + hx.y1) / 2 - blockH / 2;
    drawHero(ctx, hx.x + hx.w / 2, y0, k);
  } : null);
  ctx.textAlign = 'center'; ctx.font = `400 ${Math.max(18, minFont())}px ${FONT}`; ctx.fillStyle = 'rgba(236,244,255,0.7)';
  if (state.demo) ctx.fillText('Web demo', wide ? flowGeo('title').hero.x + flowGeo('title').hero.w / 2 : W / 2, u.y1 - 16);
}
export function renderSetup(ctx, state) {
  attract(ctx, state); scrim(ctx, 0.72);
  const pins = setupPinsGeo();
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state));
  const gy = pins.top - 50;
  const g = ctx.createLinearGradient(0, gy, 0, H);
  g.addColorStop(0, 'rgba(14,26,46,0)'); g.addColorStop(0.2, 'rgba(14,26,46,0.88)'); g.addColorStop(1, 'rgba(14,26,46,0.96)');
  ctx.fillStyle = g; ctx.fillRect(0, gy, W, H - gy);
  drawButton(ctx, pins.start, 'Start the duel', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(22, minFont())}px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, pins.start.x + (pins.back.x + pins.back.w - pins.start.x) / 2, pins.top - 14); }
}
export function renderSettings(ctx, state) { attract(ctx, state); scrim(ctx, 0.74); drawFlowScreen(ctx, state, 'settings', settingsWidgets(state)); }
export function renderLadder(ctx, state) { attract(ctx, state); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'ladder', ladderWidgets(state)); }
export function renderResult(ctx, state) { attract(ctx, state); scrim(ctx, 0.66); drawFlowScreen(ctx, state, 'result', resultWidgets(state)); }
export function renderDemoLimit(ctx, state) { attract(ctx, state); scrim(ctx, 0.76); drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(state)); }

function modal(ctx, state, key, widgets) {
  scrim(ctx, 0.5);
  const sc = TEXT_SCALES[state.settings.textIdx], g = flowGeo(key);
  const lay = flowLayout(ctx, widgets, sc, { x: g.x, w: g.w });
  const top = g.top, bottom = g.bottom;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, g.panelX, y0 - 20, g.panelW, ch + 40, { r: 30, fill: 'rgba(20,36,62,0.96)', stroke: 'rgba(160,205,245,0.6)' });
  LAID = { key, sk: `${W}x${H}|${key}`, lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, g.panelX, g.panelW);
}
export const renderPause = (ctx, state) => modal(ctx, state, 'pause', pauseWidgets(state));
export const renderReason = (ctx, state) => modal(ctx, state, 'reason', reasonWidgets(state));
export const renderFigRes = (ctx, state) => modal(ctx, state, 'figres', figresWidgets(state));

// ---- reference pages -----------------------------------------------------------------------------------------------
const PANEL = () => readerGeo().panel;
export const reader = () => { const p = PANEL(); return { x: p.x + 14, y: p.y + 92, w: p.w - 28, h: p.h - 92 - 16 }; };
let READ = { key: '', contentH: 0 };
export const readerMax = () => Math.max(0, READ.contentH - reader().h);
export const readerKey = () => READ.key;

function buildColumn(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL().w - 96;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const artH = Math.min(300, Math.round(tw * 0.5));
  const items = [];
  let y = 10;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ k: 'rule', y: y - 6 }); y += 14; }
    ctx.font = `800 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ k: 'title', y, lines: tl, fs: secFs });
    y += tl.length * secFs * 1.2 + 14;
    if (sec.art) { items.push({ k: 'art', y, h: artH, art: sec.art }); y += artH + 10; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => {
      if (pi > 0) y += lh * 0.45;
      wrapLines(ctx, para, tw).forEach((l) => { items.push({ k: 'line', y, text: l }); y += lh; });
    });
    y += 22;
  });
  return { items, contentH: y + 8, fs, lh };
}
const colCache = new Map();
const colKey = (header, sc) => `${header}:${sc}:${Math.round(PANEL().w)}`;
function ensureColumn(ctx, list, header, sc) {
  const key = colKey(header, sc);
  let col = colCache.get(key);
  if (!col) { col = buildColumn(ctx, list, sc); colCache.set(key, col); }
  READ = { key, contentH: col.contentH };
  return col;
}
export function ensureReader(state, list, header) { const sc = TEXT_SCALES[state.settings.textIdx], key = colKey(header, sc); READ = { key, contentH: (colCache.get(key) ?? buildColumn(estCtx, list, sc)).contentH }; }

export function renderPages(ctx, state, list, header) {
  attract(ctx, state); scrim(ctx, 0.78);
  const sc = TEXT_SCALES[state.settings.textIdx], G = readerGeo(), P = G.panel, RD = reader();
  const col = ensureColumn(ctx, list, header, sc);
  const max = readerMax(), scroll = clamp(state.ui.scroll, 0, max), pcx = P.x + P.w / 2;
  panel(ctx, P.x, P.y, P.w, P.h, { r: 30, fill: 'rgba(246,250,255,0.98)', stroke: 'rgba(60,90,130,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, P.y + 58);
  ctx.strokeStyle = 'rgba(60,90,130,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(P.x + 60, P.y + 78); ctx.lineTo(P.x + P.w - 60, P.y + 78); ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(RD.x, RD.y, RD.w, RD.h); ctx.clip();
  const x0 = P.x + 40, top = RD.y - scroll;
  for (const it of col.items) {
    const y = top + it.y;
    if (it.k === 'line') {
      if (y > RD.y + RD.h || y + col.lh < RD.y) continue;
      ctx.fillStyle = C.ink; ctx.font = `400 ${col.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, x0, y + col.fs * 0.85);
    } else if (it.k === 'title') {
      if (y > RD.y + RD.h || y + it.lines.length * it.fs * 1.2 < RD.y) continue;
      ctx.textAlign = 'center'; ctx.fillStyle = C.sky; ctx.font = `800 ${it.fs}px ${FONT}`;
      it.lines.forEach((l, k) => ctx.fillText(l, pcx, y + it.fs * (0.9 + k * 1.2)));
    } else if (it.k === 'rule') {
      ctx.strokeStyle = 'rgba(60,90,130,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x + 80, y); ctx.lineTo(P.x + P.w - 80, y); ctx.stroke();
    } else if (it.k === 'art') {
      if (y > RD.y + RD.h || y + it.h < RD.y) continue;
      ctx.save(); ctx.beginPath(); ctx.rect(P.x + 20, y, P.w - 40, it.h); ctx.clip(); drawArt(it.art, ctx, P.x + 40, y, P.w - 80, it.h - 12); ctx.restore();
    }
  }
  ctx.restore();
  if (max > 0) {
    const th = Math.max(60, RD.h * (RD.h / col.contentH)), ty = RD.y + (scroll / max) * (RD.h - th);
    roundPath(ctx, P.x + P.w - 16, ty, 8, th, 4); ctx.fillStyle = 'rgba(60,90,130,0.55)'; ctx.fill();
    scrollHint(ctx, RD.y, RD.y + RD.h, scroll, max, P.x + 14, P.w - 28);
  }
  drawButton(ctx, G.textDec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, G.textInc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#f4f9ff'; ctx.font = `700 ${Math.max(24, minFont())}px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, G.pct.x, G.pct.y);
  drawButton(ctx, G.close, 'Close', { primary: true, size: 32 });
}

// ---- illustrations: the game's own pins and bat in the same perspective ----------------------------------------------------
function tag(ctx, t, x, y, col = '#ffffff', size = 18, bg = 'rgba(14,26,46,0.86)') {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = bg; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function frame(ctx, w, h) {
  const cam = makeCam({ x: 0, y: 0, w, h }, { box: [1.55, -0.7, 2.7] });
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#dcebf7'); bg.addColorStop(1, '#f4f9fd'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const q = [[SQ.x0, SQ.z0], [SQ.x1, SQ.z0], [SQ.x1, SQ.z1], [SQ.x0, SQ.z1]].map(([x, z]) => cam.P(x, 0, z));
  ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
  ctx.fillStyle = '#c9dbec'; ctx.fill(); ctx.lineWidth = Math.max(3, cam.k(1) * 0.07); ctx.strokeStyle = PAL.red; ctx.stroke();
  return cam;
}
function pinsOf(cam, ctx, idx, only) {
  const ps = figurePins(idx).map((p) => ({ ...p, st: 'stand', ang: 0 })).sort((a, b) => b.z - a.z);
  ps.forEach((p, i) => { if (!only || only.includes(i)) drawStandingPin(ctx, cam, p, {}); });
  return ps;
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    town() {
      const cam = frame(ctx, w, h);
      pinsOf(cam, ctx, 1);
      const a = cam.P(-1, 0, 2), b = cam.P(1, 0, 2), c = cam.P(1.0, 0, 0.1);
      tag(ctx, 'the red line', cam.P(0, 0, 2.06)[0], cam.P(0, 0, 2.06)[1] - 14, '#ffd0cc', 17);
      tag(ctx, '2 m', (a[0] + b[0]) / 2, cam.P(0, 0, -0.18)[1] + 6, '#ffffff', 17);
      tag(ctx, 'pins', c[0] + 40, c[1] - 44, '#ffe9a8', 17);
      ctx.restore();
    },
    figures() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
      ctx.fillStyle = '#e6f0f9'; ctx.fillRect(0, 0, w, h);
      const cols = 5, rows = 3, cw = w / cols, ch = h / rows;
      FIGURES.forEach((f, i) => {
        const ox = (i % cols) * cw, oy = Math.floor(i / cols) * ch;
        const ps = figurePins(i);
        ctx.fillStyle = '#c9dbec'; ctx.fillRect(ox + cw * 0.14, oy + ch * 0.08, cw * 0.72, ch * 0.58);
        ctx.strokeStyle = PAL.red; ctx.lineWidth = 2; ctx.strokeRect(ox + cw * 0.14, oy + ch * 0.08, cw * 0.72, ch * 0.58);
        const sc = cw * 0.72 / 2.0;
        ps.forEach((p) => { ctx.beginPath(); ctx.arc(ox + cw * 0.5 + p.x * sc, oy + ch * 0.08 + (2 - p.z) * (ch * 0.58 / 2), Math.max(2.5, cw * 0.033), 0, TAU); ctx.fillStyle = '#c8312b'; ctx.fill(); });
        ctx.fillStyle = '#14233a'; ctx.font = `700 ${Math.max(13, Math.round(cw * 0.115))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(f.name, ox + cw / 2, oy + ch * 0.9);
      });
      ctx.restore();
    },
    aim() {
      const cam = frame(ctx, w, h);
      pinsOf(cam, ctx, 3);
      const lx = -0.5, lz = -0.1, st = STYLES.drive, len = Math.hypot(lx - ORIGIN.x, lz - ORIGIN.z), ux = (lx - ORIGIN.x) / len, uz = (lz - ORIGIN.z) / len;
      const dist = 1.3, p0 = cam.P(lx, 0.01, lz), p1 = cam.P(lx + ux * dist, 0.01, lz + uz * dist);
      ctx.strokeStyle = 'rgba(232,150,20,0.9)'; ctx.lineWidth = Math.max(6, cam.k(1) * 0.1); ctx.lineCap = 'round'; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([]);
      groundRing(ctx, cam, lx, lz, 0.17, '#14233a', 6); groundRing(ctx, cam, lx, lz, 0.17, '#ffffff', 3);
      tag(ctx, 'the bat lands here', p0[0] - 10, p0[1] + 30, '#ffffff', 17);
      tag(ctx, 'and slides on', (p0[0] + p1[0]) / 2 + 70, (p0[1] + p1[1]) / 2, '#ffe9a8', 17);
      ctx.restore();
      void st;
    },
    styles() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
      ctx.fillStyle = '#e6f0f9'; ctx.fillRect(0, 0, w, h);
      const items = [['sweep', 'Sweep', 0.9, 0.36], ['drive', 'Drive', 1.25, 0.06], ['smash', 'Smash', 1.7, 0.06]];
      const cw = w / 3;
      items.forEach(([id, nm, len, half], i) => {
        const cx = cw * (i + 0.5), top = h * 0.14, bot = h * 0.62, wd = Math.max(8, cw * half * 1.0);
        ctx.fillStyle = '#c9dbec'; ctx.fillRect(cx - cw * 0.4, top, cw * 0.8, bot - top);
        const L = (bot - top) * Math.min(1, len / 1.8);
        const g = ctx.createLinearGradient(0, bot, 0, bot - L); g.addColorStop(0, 'rgba(232,150,20,0.9)'); g.addColorStop(1, 'rgba(232,150,20,0.15)');
        ctx.fillStyle = g; ctx.fillRect(cx - wd, bot - L, wd * 2, L);
        ctx.strokeStyle = '#14233a'; ctx.lineWidth = 3;
        if (id === 'sweep') { ctx.beginPath(); ctx.moveTo(cx - wd, bot - 6); ctx.lineTo(cx + wd, bot - 6); ctx.stroke(); }
        else { ctx.beginPath(); ctx.moveTo(cx, bot); ctx.lineTo(cx, bot - Math.min(L, 46)); ctx.stroke(); }
        ctx.fillStyle = '#14233a'; ctx.font = `800 ${Math.max(15, Math.round(cw * 0.12))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(nm, cx, bot + (h - bot) * 0.45);
        ctx.font = `600 ${Math.max(12, Math.round(cw * 0.085))}px ${FONT}`; ctx.fillStyle = '#3a5575';
        ctx.fillText(`${STYLES[id].speed} m/s`, cx, bot + (h - bot) * 0.8);
      });
      ctx.restore();
    },
  };
  (A[key] ?? A.town)();
  ctx.restore();
}
export { SQ };
