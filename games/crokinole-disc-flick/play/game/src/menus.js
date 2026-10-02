// Every screen that is not the play screen: title, setup, settings, result, pause, and the paginated
// About / How to play / Rules reader with its illustrations (drawn with the game's own disc, peg and board art).
// Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS, SETUP_PINS } from './layout.js';
import { R_BOARD, R_BASE, R_DISC, RINGS, R_POCKET, PEGS, R_PEG_RING, startPoint, MAX_U, U_ANGLE } from './sim.js';
import { drawDisc, leafPath, drawPeg } from './art.js';
import { drawTable, drawBoardMini } from './view.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES } from './opponents.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
let PAGE_COUNT = 1;
let LAID = { key: '', lay: null, top: 0, bottom: H };
export const flowMeta = () => LAID;
// A new game starts with no layout left over from a previous one.
export function resetMenus() { LAID = { key: '', lay: null, top: 0, bottom: H }; PAGE_COUNT = 1; }
// A layout for the scene being updated right now, before anything has been drawn (first frame after a
// scene change, or headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], setup: [setupWidgets, 0, 1130], settings: [settingsWidgets, 0, H],
    result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 470,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.fillStyle = 'rgba(255,205,150,0.9)'; ctx.font = `400 26px ${FONT}`;
    ctx.fillStyle = '#e4504a'; leafPath(ctx, cx - 188, 88, 20, 0); ctx.fill();
    leafPath(ctx, cx + 188, 88, 20, 0); ctx.fill();
    ctx.font = `700 112px ${FONT}`; textShadow(ctx, 'Disc Flick', cx, 160, '#fff3d6', 16);
    ctx.font = `italic 700 74px ${FONT}`; textShadow(ctx, 'Table', cx, 238, '#ffcf7a', 12);
    ctx.font = `400 28px ${FONT}`; textShadow(ctx, 'A Canadian tabletop classic', cx, 292, '#ffe9bf', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 190, 318); ctx.lineTo(cx - 30, 318); ctx.moveTo(cx + 30, 318); ctx.lineTo(cx + 190, 318); ctx.stroke();
    drawDisc(ctx, cx - 14, 318, 0, 0.4, { scale: 0.55 }); drawDisc(ctx, cx + 14, 318, 1, 0.4, { scale: 0.55 });
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound;
  const wd = [heroArt(), { t: 'gap', h: 250 }];
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 2 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 2 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 2 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 3 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 });
  return wd;
}

export function setupWidgets(state) {
  const s = state.setup, demo = state.demo, rec = state.record ?? {};
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 }];
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = (rec.wins ?? [])[i] ?? 0;
      const locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 92 });
    });
  }
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  wd.push({ t: 'btn', id: 'len2', label: 'Quick: 2 rounds', row: 9, active: s.rounds === 2 });
  wd.push({ t: 'btn', id: 'len4', label: 'Full: 4 rounds', row: 9, active: s.rounds === 4 });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-calm', label: st.calm ? 'Calm mode: On' : 'Calm mode: Off', sub: 'Shows the whole predicted path, bounces and all', active: st.calm },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state) {
  const m = state.m, o = m.over, mode = m.cfg.mode;
  const winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${PROFILES[winner === 0 ? m.cfg.watchA : m.cfg.opp].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 70 }, { t: 'h', label: title, size: 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  const per = m.roundLog.map((r) => `${r.pts[0]}–${r.pts[1]}`).join('   ');
  wd.push({ t: 'p', label: `${m.roundLog.length} round${m.roundLog.length === 1 ? '' : 's'}: ${per}`, size: 26, cap: big ? 2 : 3 });
  if (o.extra) wd.push({ t: 'p', label: 'Settled in an extra round.', bold: true, color: '#ffe9bf', size: 26, cap: big ? 2 : 3 });
  const rec = mode === 'ai' ? `Your record against ${PROFILES[m.cfg.opp].name}: ${(state.record?.wins ?? [])[m.cfg.opp] ?? 0} won.` : '';
  if (rec) wd.push({ t: 'p', label: rec, size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
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
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-calm', label: st.calm ? 'Calm: On' : 'Calm: Off', row: 8, active: st.calm },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free rounds of the web demo. The full game on iPhone and Android has every rival, the full matches and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,8,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,8,6,${a})`); g.addColorStop(1, `rgba(20,8,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,8,6,0)'); g.addColorStop(1, 'rgba(20,8,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#3a2414'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

const attractTable = (ctx, state, scale = 0.95, cy) => drawTable(ctx, state, state.att.w, state.att.parts, { rot: state.t * 0.05, scale, noShake: true, cy });

export function renderTitle(ctx, state) {
  attractTable(ctx, state, 0.62, 560);
  scrim(ctx, 0.2);
  const g = ctx.createRadialGradient(W / 2, 220, 40, W / 2, 220, 400);
  g.addColorStop(0, 'rgba(20,8,6,0.55)'); g.addColorStop(1, 'rgba(20,8,6,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 30);
}

export function renderSetup(ctx, state) {
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'setup', setupWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(20,8,6,0)'); g.addColorStop(0.2, 'rgba(20,8,6,0.85)'); g.addColorStop(1, 'rgba(20,8,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, SETUP_PINS.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, SETUP_PINS.back, 'Back', { dark: true, size: 28 });
  if (state.setupMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.setupMsg, W / 2, 1140); }
}
export function renderSettings(ctx, state) {
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.68);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderResult(ctx, state) {
  drawTable(ctx, state, state.w, [], { rot: 0, noShake: true, scale: 0.9 });
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.72);
  drawFlowScreen(ctx, state, 'demolimit', demoLimitWidgets(), 0, H);
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: 60, w: 600 });
  const top = 70, bottom = H - 70;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(40,18,12,0.92)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, 30, 660);
}

// ---- reference pages --------------------------------------------------------------------------
export const pageCount = () => PAGE_COUNT;
const PANEL = { x: 34, y: 100, w: 652, h: 1030 };

function buildPages(ctx, list, scale) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80;
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = PANEL.y + PANEL.h - 70;
  const pages = [];
  let cur = null, used = 0;
  const newPage = () => { cur = { blocks: [], fs, lh, secFs }; used = 0; pages.push(cur); };
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    const titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => {
      const wl = wrapLines(ctx, para, tw);
      wl.forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 }));
    });
    const lineH = (l, n) => lh + (l.gapBefore && n > 0 ? lh * 0.45 : 0);
    const artH = sec.art ? 210 : 0;
    let full = titleH + artH + 26;
    lines.forEach((l, k) => { full += lineH(l, k); });
    if (!cur || used + full > limit - top) newPage();
    let i = 0, part = 0;
    while (true) {
      const blk = { title: sec.title, tl, titleH, art: part === 0 ? sec.art : null, artH: part === 0 ? artH : 0, lines: [], part };
      let h = titleH + blk.artH + 26;
      while (i < lines.length) {
        const add = lineH(lines[i], blk.lines.length);
        if (used + h + add > limit - top && (blk.lines.length > 0 || used > 0)) break;
        blk.lines.push({ ...lines[i] }); h += add; i++;
      }
      cur.blocks.push(blk); used += h;
      part++;
      if (i >= lines.length) break;
      newPage();
    }
  });
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  attractTable(ctx, state, 0.9);
  scrim(ctx, 0.7);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,240,218,0.97)', stroke: 'rgba(110,60,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(110,60,40,0.4)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(110,60,40,0.25)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), W / 2, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, PANEL.x + 40, y, PANEL.w - 80, blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, PANEL.x + 40, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,40,30,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(40,18,12,0.78)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}

// A little board in a frame; returns helpers to draw in board coordinates.
function mini(ctx, w, h, state, o = {}) {
  roundPath(ctx, 0, 0, w, h, 16);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a1a1e'); g.addColorStop(1, '#2a0d11');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(110,60,40,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  const s = (h - 10) / ((R_BOARD + 24) * 2) * (o.zoom ?? 1), cx = w * (o.fx ?? 0.5) + (o.dx ?? 0) * s, cy = h / 2 + (o.dy ?? 0) * s;
  ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  drawBoardMini(ctx, state, cx, cy, s);
  ctx.restore();
  return { s, cx, cy, X: (x) => cx + x * s, Y: (y) => cy + y * s };
}

export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const A = {
    board() {
      const m = mini(ctx, w, h, state, { fx: 0.3 });
      const L = (t, wx, wy, ty) => {
        const px = m.X(wx), py = m.Y(wy), lx = w * 0.62, ly = ty;
        ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx - 8, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(px, py, 3.5, 0, TAU); ctx.fill();
        label(ctx, t, lx, ly + 6, 20, '#ffe9bf', 'left');
      };
      L('20: the pocket', 0, 0, 30); L('15 ring', 0, 64, 68); L('10 ring', 0, 140, 106); L('5 ring', 0, 216, 144); L('8 pegs', PEGS[7].x, PEGS[7].y, 180);
    },
    discs() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8d4a0'; ctx.fill(); ctx.strokeStyle = 'rgba(110,60,40,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      drawDisc(ctx, w * 0.3, h * 0.46, 0, 0.3, { scale: 2.1 }); drawDisc(ctx, w * 0.7, h * 0.46, 1, 0.3, { scale: 2.1 });
      label(ctx, 'Red: maple leaf', w * 0.3, h - 24, 22); label(ctx, 'Blue: star', w * 0.7, h - 24, 22);
    },
    flick() {
      const m = mini(ctx, w, h, state, { zoom: 1.0 });
      const p = startPoint(0, 0.25), px = m.X(p.x), py = m.Y(p.y);
      drawDisc(ctx, px, py, 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, px, py + 6, px + 2, py + 58, '#ffd35a', 5); label(ctx, 'pull back', px + 56, py + 46, 18, '#ffd35a', 'left');
      ctx.save(); ctx.setLineDash([2, 9]); ctx.lineCap = 'round'; ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(px, py - 16); ctx.lineTo(m.X(-20), m.Y(-120)); ctx.stroke(); ctx.restore();
      drawDisc(ctx, m.X(-20), m.Y(-120), 0, 0, { scale: m.s * 2.2, a: 0.45, ghost: true });
      label(ctx, 'flick goes this way', m.X(60), m.Y(-150), 18, '#fffbe8', 'left');
    },
    spot() {
      const m = mini(ctx, w, h, state);
      const c = Math.PI / 2, half = MAX_U * U_ANGLE;
      ctx.strokeStyle = 'rgba(255,211,90,0.9)'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(m.cx, m.cy, R_BASE * m.s, c - half, c + half); ctx.stroke();
      [-0.6, 0, 0.6].forEach((u, i) => { const p = startPoint(0, u); drawDisc(ctx, m.X(p.x), m.Y(p.y), 0, 0, { scale: m.s * 2.2, a: i === 1 ? 1 : 0.5, ghost: i !== 1 }); });
      label(ctx, 'your line: slide the disc along it', w / 2, h - 12, 18, '#ffe9bf');
    },
    musthit() {
      const m = mini(ctx, w, h, state, { zoom: 1.1, dy: -30 });
      const t = startPoint(0, -0.2);
      drawDisc(ctx, m.X(-70), m.Y(-90), 1, 0.5, { scale: m.s * 2.2 });
      drawDisc(ctx, m.X(t.x), m.Y(t.y), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(t.x), m.Y(t.y) - 14, m.X(-66), m.Y(-70), '#7ee8a8', 5); tag(ctx, 'touches a rival: stays', m.X(-120), m.Y(60), '#7ee8a8', 17);
      const t2 = startPoint(0, 0.4);
      drawDisc(ctx, m.X(t2.x), m.Y(t2.y), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(t2.x), m.Y(t2.y) - 14, m.X(t2.x + 20), m.Y(110), '#ffb48a', 5); tag(ctx, 'misses: removed', m.X(190), m.Y(80), '#ffb48a', 17);
    },
    rings() {
      const m = mini(ctx, w, h, state);
      [['20', 0], ['15', 64], ['10', 140], ['5', 216]].forEach(([t, r], i) => {
        const px = m.X(0) - 0, py = m.Y(-r);
        const lx = i % 2 ? w * 0.84 : w * 0.16, ly = 28 + i * 40;
        ctx.strokeStyle = '#fff6e2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = '#fff6e2'; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill();
        tag(ctx, `${t} points`, lx, ly, '#ffe08a', 18);
      });
    },
    pegs() {
      const m = mini(ctx, w, h, state, { zoom: 2.2 });
      drawDisc(ctx, m.X(0), m.Y(70), 0, 0, { scale: m.s * 2.2, a: 0.6, ghost: true });
      arrow(ctx, m.X(0), m.Y(52), m.X(0), m.Y(6), '#7ee8a8', 5);
      tag(ctx, 'through a gap', m.X(0) + 150, m.Y(40), '#7ee8a8', 17);
      tag(ctx, 'peg', m.X(PEGS[1].x) - 10, m.Y(PEGS[1].y) + 36, '#ffe08a', 17);
      void R_PEG_RING; void drawPeg;
    },
    hit() {
      const m = mini(ctx, w, h, state, { zoom: 1.3, dy: 20 });
      drawDisc(ctx, m.X(-10), m.Y(-20), 1, 0.2, { scale: m.s * 2.2 });
      drawDisc(ctx, m.X(30), m.Y(180), 0, 0, { scale: m.s * 2.2 });
      arrow(ctx, m.X(26), m.Y(150), m.X(-2), m.Y(0), '#ffd35a', 5);
      arrow(ctx, m.X(-18), m.Y(-42), m.X(-50), m.Y(-130), '#ffffff', 4);
      label(ctx, 'rival bounces away', m.X(30), m.Y(-100), 17, '#fffbe8', 'left');
    },
    removed() {
      const m = mini(ctx, w, h, state);
      ctx.strokeStyle = '#ffb48a'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.arc(m.cx, m.cy, 306 * m.s, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.cx, m.cy, (RINGS[2].r + R_DISC) * m.s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      drawDisc(ctx, m.X(150), m.Y(250), 0, 0, { scale: m.s * 2.2, a: 0.5, ghost: true });
      drawDisc(ctx, m.X(-60), m.Y(-80), 1, 0, { scale: m.s * 2.2 });
      tag(ctx, 'short of the 5 ring: removed', m.X(120), m.Y(300), '#ffb48a', 16);
      tag(ctx, 'past the edge: gutter', m.X(-170), m.Y(-250), '#ffb48a', 16);
    },
    pocket() {
      const m = mini(ctx, w, h, state, { zoom: 3.6 });
      drawDisc(ctx, m.X(30), m.Y(34), 0, 0, { scale: m.s * 2.2, a: 0.6, ghost: true });
      arrow(ctx, m.X(30), m.Y(34), m.X(4), m.Y(4), '#ffd35a', 5);
      tag(ctx, '20 points', m.X(0), m.Y(-60), '#ffe08a', 20);
      void R_POCKET;
    },
    rounds() {
      roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = '#e8d4a0'; ctx.fill(); ctx.strokeStyle = 'rgba(110,60,40,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      const rows = [['Round 1', 54, 61], ['Round 2', 72, 49], ['Total', 126, 110]];
      rows.forEach(([t, a, b], i) => {
        const yy = 48 + i * 56;
        label(ctx, t, 40, yy, 24, C.ink, 'left'); label(ctx, String(a), w * 0.62, yy, 28, '#b32a2a'); label(ctx, String(b), w * 0.82, yy, 28, '#1d5a8c');
      });
      ctx.strokeStyle = 'rgba(110,60,40,0.4)'; ctx.beginPath(); ctx.moveTo(30, 134); ctx.lineTo(w - 30, 134); ctx.stroke();
    },
  };
  (A[key] ?? A.board)();
  ctx.restore();
}
