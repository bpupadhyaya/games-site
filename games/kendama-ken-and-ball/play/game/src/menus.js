// Every screen that is not the play screen: title, ladder, settings, result, pause, demo limit, and the paginated
// About / How to Play / Rules reader with illustrations drawn with the game's own ken and ball. Pure drawing.
import { W, H, TEXT_SCALES, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, THINK_STEPS } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawBackdrop, drawKen, drawBall, COL, rr, drawRope, drawParticles } from './art.js';
import { drawWorld } from './hud.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TIERS, TRICKS, tierOpen, totalStars, stepsText, trickOpen, starsFor } from './tricks.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
let LAID = { key: '', lay: null, top: 0, bottom: H };
let PAGE_COUNT = 1;
export const flowMeta = () => LAID;
// A new game starts with no remembered layout, so two games with the same seed and input behave identically.
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: H }; PAGE_COUNT = 1; };
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, or
// headless runs): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay) return;
  const defs = {
    title: [titleWidgets, 0, H], ladder: [ladderWidgets, 0, 1130], settings: [settingsWidgets, 0, H],
    result: [resultWidgets, 0, H], demolimit: [demoLimitWidgets, 0, H],
  };
  const d = defs[key];
  if (!d) return;
  const lay = flowLayout(estCtx, d[0](state), TEXT_SCALES[state.settings.textIdx]);
  LAID = { key, lay, top: d[1], bottom: d[2], h: lay.contentH };
}
export function hitScreen(x, y, scroll) { return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null; }

const heroArt = () => ({
  t: 'art', h: 600,
  draw(ctx, w) {
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = w / 2;
    ctx.font = `700 112px ${FONT}`; textShadow(ctx, 'Ken', cx - 150, 160, '#fff6e2', 14);
    ctx.font = `italic 400 64px ${FONT}`; textShadow(ctx, 'and', cx + 6, 150, '#ffcf7a', 10);
    ctx.font = `700 112px ${FONT}`; textShadow(ctx, 'Ball', cx + 168, 160, '#fff6e2', 14);
    ctx.font = `400 30px ${FONT}`; textShadow(ctx, 'A Japanese skill toy', cx, 214, '#ffe9bf', 6);
    ctx.strokeStyle = 'rgba(255,233,191,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - 190, 240); ctx.lineTo(cx - 24, 240); ctx.moveTo(cx + 24, 240); ctx.lineTo(cx + 190, 240); ctx.stroke();
    ctx.fillStyle = COL.ball; ctx.beginPath(); ctx.arc(cx, 240, 7, 0, TAU); ctx.fill();
    ctx.restore();
  },
});

export function titleWidgets(state) {
  const sound = state.settings.sound;
  return [
    heroArt(),
    { t: 'btn', id: 'ladder', label: 'Trick Ladder', sub: `${totalStars(state.record)} stars`, primary: true, h: 100 },
    { t: 'btn', id: 'run', label: 'Combo Run', sub: state.record.runBest ? `Best ${state.record.runBest}` : 'Choose your catches', row: 1 },
    { t: 'btn', id: 'practice', label: 'Free Practice', row: 1 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn' },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 2 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 2 },
    { t: 'btn', id: 'about', label: 'About', row: 2 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 3 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 3 },
  ];
}

export function ladderWidgets(state) {
  const rec = state.record, tot = totalStars(rec), max = TRICKS.length * 3;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Trick Ladder', size: 52 }, { t: 'p', label: `${tot} of ${max} stars`, bold: true, color: '#ffe9bf', size: 26 }];
  TIERS.forEach((tier, ti) => {
    const open = tierOpen(ti, rec);
    const demoLock = state.demo && ti > 0;
    wd.push({ t: 'gap', h: 8 });
    wd.push({ t: 'p', label: tier.name, bold: true, color: '#ffd97a', size: 30, cap: 1.6 });
    if (!open) wd.push({ t: 'p', label: `Earn ${tier.need - tot} more star${tier.need - tot === 1 ? '' : 's'} to open`, size: 22, cap: 2 });
    else if (demoLock) wd.push({ t: 'p', label: 'In the full game', size: 22, cap: 2 });
    TRICKS.filter((t) => t.tier === ti).forEach((tr) => {
      const st = rec.stars[tr.id] | 0;
      const locked = !open || demoLock;
      wd.push({ t: 'btn', id: `t:${tr.id}`, label: tr.name, sub: stepsText(tr.steps), disabled: locked, hitDisabled: true, stars: locked ? 0 : st, starMax: 3, active: false, h: 92 });
    });
  });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  const assistName = ['Off', 'Light', 'Strong'][st.assist];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Steady hands: ${assistName}`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'p', label: 'A little help at the spike and over the cups.', size: 22, cap: 2 },
    { t: 'btn', id: 'as-dec', label: 'Less', row: 10, disabled: st.assist === 0 },
    { t: 'btn', id: 'as-inc', label: 'More', row: 10, disabled: st.assist === 2 },
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
  const r = state.res;
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: big ? 24 : 80 }];
  if (r.kind === 'trick') {
    wd.push({ t: 'h', label: 'Trick landed', size: 60, cap: big ? 1.2 : 1.5 });
    wd.push({ t: 'h', label: r.name, size: 38, cap: big ? 1.2 : 1.5, color: '#ffe9bf' });
    wd.push({ t: 'h', label: '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), size: 92, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    wd.push({ t: 'p', label: r.drops === 0 ? 'No drops at all.' : `${r.drops} drop${r.drops === 1 ? '' : 's'}.${r.best > r.stars ? '' : ''}`, size: 28, cap: big ? 2 : 3 });
    wd.push({ t: 'p', label: r.stars === 3 ? 'A clean trick.' : 'Fewer drops earn more stars.', size: 24, cap: big ? 2 : 3 });
    wd.push({ t: 'gap', h: 20 });
    if (r.next) wd.push({ t: 'btn', id: 'next', label: 'Next trick', sub: r.next.name, primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'again', label: 'Try again', primary: !r.next, row: 6 });
    wd.push({ t: 'btn', id: 'ladder', label: 'Ladder', row: 6 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    wd.push({ t: 'h', label: 'Run over', size: 60, cap: big ? 1.2 : 1.5 });
    wd.push({ t: 'h', label: String(r.bank), size: 100, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    wd.push({ t: 'p', label: r.newBest ? 'A new best score!' : `Best ${r.best}`, bold: true, color: '#ffe9bf', size: 28, cap: big ? 2 : 3 });
    wd.push({ t: 'p', label: `${r.catches} catch${r.catches === 1 ? '' : 'es'} this run.`, size: 26, cap: big ? 2 : 3 });
    wd.push({ t: 'gap', h: 20 });
    wd.push({ t: 'btn', id: 'again', label: 'Run again', primary: true, h: 92 });
    wd.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  }
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    ...(state.mode === 'trick' ? [{ t: 'btn', id: 'p-restart', label: 'Restart trick', dark: true }] : []),
    ...(state.mode === 'run' ? [{ t: 'btn', id: 'p-endrun', label: 'End run and bank', dark: true }] : []),
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'p-assist', label: `Steady: ${['Off', 'Light', 'Strong'][st.assist]}`, row: 8, active: st.assist > 0 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets() {
  return [
    { t: 'gap', h: 200 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'The web demo has the first row of tricks and two runs. The full game on iPhone and Android has all twenty tricks, unlimited runs and everything else.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(10,12,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,12,34,${a})`); g.addColorStop(1, `rgba(10,12,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,12,34,0)'); g.addColorStop(1, 'rgba(10,12,34,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}

function drawFlowScreen(ctx, state, key, widgets, top, bottom) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, widgets, sc);
  LAID = { key, lay, top, bottom, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - (bottom - top));
  if (state.ui.focusId) {
    const it = lay.items.find((i) => i.w.id === state.ui.focusId);
    if (it) state.ui.scroll = Math.max(0, Math.min(maxScroll, it.y - (bottom - top) / 2 + it.h / 2));
    state.ui.focusId = null;
  }
  const scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, top, bottom, scroll);
  if (maxScroll > 0) {
    const th = Math.max(60, (bottom - top) * ((bottom - top) / lay.contentH)), ty = top + (scroll / maxScroll) * (bottom - top - th);
    roundPath(ctx, W - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    scrollHint(ctx, top, bottom, scroll, maxScroll);
  }
  return { scroll, maxScroll, lay };
}

export function renderTitle(ctx, state, rope) {
  const a = state.att;
  drawBackdrop(ctx);
  // the ken plays by itself between the title and the buttons
  ctx.save();
  ctx.translate(180, 100); ctx.scale(0.5, 0.5);
  drawWorld(ctx, a.w, a.rope, { parts: a.parts, noBackdrop: true });
  ctx.restore();
  const g = ctx.createRadialGradient(W / 2, 200, 40, W / 2, 200, 420);
  g.addColorStop(0, 'rgba(8,10,34,0.5)'); g.addColorStop(1, 'rgba(8,10,34,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 560);
  drawFlowScreen(ctx, state, 'title', titleWidgets(state), 0, H);
  ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)';
  if (state.demo) ctx.fillText('Web demo', W / 2, H - 14);
}
export function renderLadder(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'ladder', ladderWidgets(state), 0, 1130);
  const g = ctx.createLinearGradient(0, 1100, 0, H);
  g.addColorStop(0, 'rgba(10,12,34,0)'); g.addColorStop(0.2, 'rgba(10,12,34,0.85)'); g.addColorStop(1, 'rgba(10,12,34,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1100, W, H - 1100);
  drawButton(ctx, { x: 20, y: 1164, w: 680, h: 100 }, 'Back', { dark: true, size: 30 });
  if (state.ladderMsg) { ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.fillText(state.ladderMsg, W / 2, 1146); }
}
export function renderSettings(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'settings', settingsWidgets(state), 0, H);
}
export function renderResult(ctx, state, rope) {
  drawWorld(ctx, state.w, rope, { parts: state.parts });
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result', resultWidgets(state), 0, H);
}
export function renderDemoLimit(ctx, state) {
  drawBackdrop(ctx); scrim(ctx, 0.7);
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
  panel(ctx, 30, y0 - 20, 660, ch + 40, { r: 30, fill: 'rgba(24,28,64,0.92)', stroke: 'rgba(255,214,140,0.5)' });
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
    const artH = sec.art ? 220 : 0;
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
  drawBackdrop(ctx); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc); pageCache.set(pkey, pages); }
  PAGE_COUNT = pages.length;
  const idx = Math.min(state.page, pages.length - 1);
  const pg = pages[idx];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(60,60,90,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, W / 2, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,60,90,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  let y = PANEL.y + 120;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(60,60,90,0.22)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
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
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(50,50,80,0.7)';
  ctx.fillText(`Page ${idx + 1} of ${pages.length}`, W / 2, PANEL.y + PANEL.h - 28);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(sc * 100)}%`, W / 2, 56);
  drawButton(ctx, REF_BACK, idx === 0 ? 'Close' : 'Back', { size: 32 });
  drawButton(ctx, REF_NEXT, idx === pages.length - 1 ? 'Done' : 'Next', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e2', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function artBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1b2556'); g.addColorStop(0.7, '#3a3f7e'); g.addColorStop(1, '#8a6a8e');
  rr(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.save(); rr(ctx, 0, 0, w, h, 16); ctx.clip();
  ctx.fillStyle = 'rgba(255,240,210,0.8)'; ctx.beginPath(); ctx.arc(w - 50, 40, 18, 0, TAU); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; rr(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd45a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
const KEN0 = { x: 0, y: 0, th: 0 };
const ball = (ctx, x, y, r = 36, a = -Math.PI / 2) => { ctx.save(); ctx.translate(x, y); drawBall(ctx, { x: 0, y: 0, a }, 1, r / 36); ctx.restore(); };
const ken = (ctx, x, y, s, th = 0, glow = {}) => { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); drawKen(ctx, { ...KEN0, th }, glow); ctx.restore(); };
const stringLine = (ctx, x0, y0, x1, y1, sag = 0) => {
  ctx.strokeStyle = '#efe3c6'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag, x1, y1); ctx.stroke();
};

export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  artBg(ctx, w, h);
  const A = {
    parts() {
      const s = 0.55, kx = w * 0.4, ky = h * 0.5;
      ken(ctx, kx, ky, s);
      stringLine(ctx, kx, ky - 3, kx + 110, ky + 62, 14);
      ball(ctx, kx + 130, ky + 78, 26, -2.4);
      label(ctx, 'Spike', kx + 38, ky - 40, 18, '#ffe9bf', 'left');
      label(ctx, 'Big cup', kx - 106, ky + 4 - 56 * s + 4, 17, '#9dbdff', 'right');
      label(ctx, 'Small cup', kx + 108, ky - 4 - 26, 17, '#8be6c9', 'left');
      label(ctx, 'Base cup', kx + 54, ky + 100, 17, '#d6b8ff', 'left');
      label(ctx, 'Ball', kx + 168, ky + 56, 17, '#ffb09f', 'left');
      label(ctx, 'String', kx + 62, ky + 22, 16, '#fff6e2', 'left');
    },
    drag() {
      const kx = w * 0.56, ky = h * 0.54;
      ken(ctx, kx - 46, ky + 6, 0.5, -0.2); ctx.globalAlpha = 1;
      ctx.save(); ctx.globalAlpha = 0.35; ken(ctx, kx + 54, ky - 6, 0.5, 0); ctx.restore();
      arrow(ctx, kx - 140, ky + 64, kx + 30, ky + 64, '#ffd45a', 5);
      ctx.strokeStyle = 'rgba(255,246,226,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(kx - 140, ky + 64, 22, 0, TAU); ctx.stroke();
      label(ctx, 'finger', kx - 140, ky + 110, 18, '#fff6e2');
      label(ctx, 'the ken follows a little late', kx + 10, ky + 108, 18, '#ffe9bf');
    },
    pop() {
      [[0.2, 0], [0.5, 1], [0.8, 2]].forEach(([fx, i]) => {
        const kx = w * fx, ky = h * (i === 0 ? 0.3 : i === 1 ? 0.18 : 0.46);
        ken(ctx, kx, ky, 0.36);
        const by = i === 0 ? ky + 100 : i === 1 ? ky + 84 : ky - 56;
        if (i < 2) stringLine(ctx, kx, ky - 2, kx, by, 0); else stringLine(ctx, kx, ky - 2, kx + 10, by + 18, 6);
        ball(ctx, kx + (i === 2 ? 10 : 0), by, 18);
        label(ctx, ['hang', 'pull up', 'stop: it flies'][i], kx, h - 12, 17);
      });
      arrow(ctx, w * 0.5 + 42, h * 0.2 + 30, w * 0.5 + 42, h * 0.2 - 8, '#ffd45a', 4);
    },
    catch() {
      const cx = w * 0.5, cy = h * 0.58;
      ken(ctx, cx - 110, cy - 20, 0.6);
      ball(ctx, cx - 110 + (-90 * 0.6), cy - 20 + (-42.8 * 0.6), 22);
      arrow(ctx, cx - 160, cy - 100, cx - 160, cy - 56, '#ffd45a', 4);
      label(ctx, 'both rims hold it', cx + 100, cy - 20, 20, '#fff6e2', 'left');
      label(ctx, 'gentle: it stays', cx + 100, cy + 12, 18, '#8fe0b0', 'left');
      label(ctx, 'hard: it bounces', cx + 100, cy + 40, 18, '#ffb09f', 'left');
    },
    spike() {
      const cx = w * 0.5, cy = h * 0.82;
      ken(ctx, cx, cy, 0.6);
      ball(ctx, cx + 8, cy - 130, 26, Math.PI / 2);
      arrow(ctx, cx + 8, cy - 98, cx + 2, cy - 74, '#ffd45a', 4);
      label(ctx, 'the hole faces down', cx + 54, cy - 134, 18, '#ffe9bf', 'left');
      label(ctx, 'to the spike', cx + 54, cy - 108, 18, '#ffe9bf', 'left');
      stringLine(ctx, cx, cy - 3, cx - 40, cy - 120, -10);
    },
    flip() {
      ken(ctx, w * 0.25, h * 0.42, 0.42, 0); ken(ctx, w * 0.75, h * 0.5, 0.42, Math.PI);
      arrow(ctx, w * 0.4, h * 0.46, w * 0.6, h * 0.46, '#ffd45a', 5);
      label(ctx, 'spike up', w * 0.25, h - 14, 18); label(ctx, 'base cup up', w * 0.75, h - 14, 18);
      ball(ctx, w * 0.75, h * 0.5 - 98 * 0.42 - 10, 15);
    },
    drops() {
      ball(ctx, w * 0.3, h * 0.55, 24); stringLine(ctx, w * 0.3, 8, w * 0.3, h * 0.55 - 24, 0);
      label(ctx, 'hanging still = a drop', w * 0.3, h - 14, 17, '#fff6e2');
      [[0.58, 3], [0.7, 2], [0.82, 1]].forEach(([fx, n]) => {
        ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd45a'; ctx.fillText('★'.repeat(n), w * fx + 8, h * 0.4);
        label(ctx, n === 3 ? '0-2' : n === 2 ? '3-6' : '7+', w * fx + 8, h * 0.4 + 36, 20, '#fff6e2');
      });
      label(ctx, 'drops', w * 0.7 + 8, h * 0.4 + 70, 18, '#ffe9bf');
    },
    run() {
      [['Big cup', COL.big, 10], ['Spike', COL.spike, 22], ['Base cup', COL.base, 30]].forEach(([nm, col, pts], i) => {
        const x0 = 14 + i * ((w - 28) / 3), cw = (w - 28) / 3 - 10;
        rr(ctx, x0, 40, cw, 74, 18); ctx.fillStyle = 'rgba(255,255,255,0.09)'; ctx.fill(); ctx.lineWidth = i === 1 ? 4 : 2; ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x0 + 22, 77, 9, 0, TAU); ctx.fill();
        label(ctx, nm, x0 + 38, 70, 20, '#fff6e2', 'left'); label(ctx, `+${pts}${i === 1 ? '  ×2' : ''}`, x0 + 38, 98, 20, '#ffd45a', 'left');
      });
      label(ctx, 'Bank keeps your points safe', w / 2, 160, 21, '#ffe9bf');
      ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ff6a54'; ctx.fillText('♥ ♥ ♥', w / 2, 196);
    },
    ladder() {
      for (let i = 0; i < 6; i++) {
        const bw = 60, x0 = 20 + i * (bw + 8), bh = 30 + i * 22;
        rr(ctx, x0, h - 14 - bh, bw, bh, 8); ctx.fillStyle = i < 2 ? '#e8b84a' : 'rgba(255,255,255,0.18)'; ctx.fill();
        label(ctx, String(i + 1), x0 + bw / 2, h - 22, 20, i < 2 ? '#232844' : '#fff6e2');
      }
      label(ctx, 'stars open the next row', w - 20, 34, 18, '#ffe9bf', 'right');
    },
  };
  (A[key] ?? A.parts)();
  ctx.restore();
}
