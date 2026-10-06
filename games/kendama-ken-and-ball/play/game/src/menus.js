// Every screen that is not the play screen: title, ladder, settings, result, pause, demo limit, and the paginated
// About / How to Play / Rules reader with illustrations drawn with the game's own ken and ball. Pure drawing.
// Everything is laid out from the live layout (layout.js): portrait = one centred column, wide = art / side cards + a column.
import { LAY, TEXT_SCALES, THINK_STEPS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawMenuBack, drawKen, drawBall, COL, rr, drawRope, drawParticles } from './art.js';
import { drawStageWorld, drawWorld } from './hud.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TIERS, TRICKS, tierOpen, totalStars, stepsText, trickOpen, starsFor } from './tricks.js';

const TAU = Math.PI * 2;

// ---- flow screens ------------------------------------------------------------------------------
// A flow screen is a vertical list of widgets in a column; LAID remembers the last laid-out one for hit-testing.
let LAID = { key: '', lay: null, top: 0, bottom: 0 };
let PAGE_COUNT = 1;
export const flowMeta = () => LAID;
// A new game starts with no remembered layout, so two games with the same seed and input behave identically.
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: 0 }; PAGE_COUNT = 1; };
// A layout for the scene being updated right now, before anything has been drawn (first frame after a scene change, headless
// runs, or a resize): same widgets, text widths estimated instead of measured.
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// Which column, widgets and vertical placement a flow screen uses on the current layout.
function flowSpec(key, state) {
  const L = LAY, land = L.land;
  switch (key) {
    case 'title': return { cols: [{ w: titleWidgets(state, land), col: L.titleFlow, center: true }] };
    case 'ladder': return { cols: [{ w: ladderWidgets(state, land), col: L.ladder.flow }] };
    case 'settings': return { cols: [{ w: settingsWidgets(state), col: L.flow }] };
    case 'demolimit': return { cols: [{ w: demoLimitWidgets(), col: L.flow, center: true }] };
    case 'result': {
      const r = resultWidgets(state);
      if (!land) return { cols: [{ w: [...r.info, ...r.actions], col: L.flow, center: true }] };
      const cw = Math.min(420, (L.U.w - 120) / 2), cx = (L.U.x0 + L.U.x1) / 2;
      return { cols: [{ w: r.info, col: { ...L.flow, x: cx - 24 - cw, w: cw }, center: true }, { w: r.actions, col: { ...L.flow, x: cx + 24, w: cw }, center: true }] };
    }
    default: return null;
  }
}
// Lays the screen out with `ctx` (measuring) and merges the columns into one list, vertical centring baked in.
function buildFlow(ctx, state, key) {
  const spec = flowSpec(key, state);
  if (!spec) return null;
  const sc = TEXT_SCALES[state.settings.textIdx];
  const first = spec.cols[0].col, top = first.top, bottom = first.bottom, avail = bottom - top;
  const items = []; let contentH = 0, lastEnd = 0, lastCol = null;
  spec.cols.forEach((c) => {
    const lay = flowLayout(ctx, c.w, sc, { x: c.col.x, w: c.col.w });
    const off = c.center && lay.contentH < avail ? (avail - lay.contentH) / 2 : 0;
    lay.items.forEach((it) => { it.y += off; items.push(it); });
    contentH = Math.max(contentH, lay.contentH + off);
    lastEnd = top + lay.contentH + off; lastCol = c.col;
  });
  const out = { lay: { items, contentH }, top, bottom };
  if (key === 'title' && lastCol) {      // the lockup: right under the last button row, pinned at the bottom when the menu scrolls
    const k = LAY.lock, cx = lastCol.x + lastCol.w / 2, pinned = LAY.U.y1 - k.h - 12, y = Math.min(lastEnd + 12, pinned), m = 44 / k.cpu, tw = Math.max(k.w + 24, m), th = Math.max(k.h + 12, m);
    out.lock = { cx, y, w: k.w, h: k.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, k.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key) {
  const k = `${key}|${LAY.key}|${state.settings.textIdx}`;
  if (LAID.key === k && LAID.lay) return;
  const f = buildFlow(estCtx, state, key);
  if (!f) return;
  LAID = { key: k, lay: f.lay, top: f.top, bottom: f.bottom, h: f.lay.contentH, lock: f.lock };
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  return LAID.lay ? flowHit(LAID.lay, LAID.top, scroll, x, y) : null;
}

// "Ken and Ball" title art, drawn in a 640-wide box.
function heroDraw(ctx, w) {
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
}
const heroArt = () => ({ t: 'art', h: 600, draw: (ctx, w) => heroDraw(ctx, w) });

export function titleWidgets(state, land = false) {
  const sound = state.settings.sound;
  return [
    ...(land ? [] : [heroArt()]),
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

export function ladderWidgets(state, land = false) {
  const rec = state.record, tot = totalStars(rec), max = TRICKS.length * 3;
  const wd = land ? [{ t: 'gap', h: 10 }] : [{ t: 'gap', h: 10 }, { t: 'h', label: 'Trick Ladder', size: 52 }, { t: 'p', label: `${tot} of ${max} stars`, bold: true, color: '#ffe9bf', size: 26 }];
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
  const info = [{ t: 'gap', h: big ? 24 : LAY.land ? 10 : 80 }], actions = [];
  if (r.kind === 'trick') {
    info.push({ t: 'h', label: 'Trick landed', size: 60, cap: big ? 1.2 : 1.5 });
    info.push({ t: 'h', label: r.name, size: 38, cap: big ? 1.2 : 1.5, color: '#ffe9bf' });
    info.push({ t: 'h', label: '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), size: 92, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    info.push({ t: 'p', label: r.drops === 0 ? 'No drops at all.' : `${r.drops} drop${r.drops === 1 ? '' : 's'}.`, size: 28, cap: big ? 2 : 3 });
    info.push({ t: 'p', label: r.stars === 3 ? 'A clean trick.' : 'Fewer drops earn more stars.', size: 24, cap: big ? 2 : 3 });
    info.push({ t: 'gap', h: 20 });
    if (r.next) actions.push({ t: 'btn', id: 'next', label: 'Next trick', sub: r.next.name, primary: true, h: 92 });
    actions.push({ t: 'btn', id: 'again', label: 'Try again', primary: !r.next, row: 6 });
    actions.push({ t: 'btn', id: 'ladder', label: 'Ladder', row: 6 });
    actions.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    info.push({ t: 'h', label: 'Run over', size: 60, cap: big ? 1.2 : 1.5 });
    info.push({ t: 'h', label: String(r.bank), size: 100, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    info.push({ t: 'p', label: r.newBest ? 'A new best score!' : `Best ${r.best}`, bold: true, color: '#ffe9bf', size: 28, cap: big ? 2 : 3 });
    info.push({ t: 'p', label: `${r.catches} catch${r.catches === 1 ? '' : 'es'} this run.`, size: 26, cap: big ? 2 : 3 });
    info.push({ t: 'gap', h: 20 });
    actions.push({ t: 'btn', id: 'again', label: 'Run again', primary: true, h: 92 });
    actions.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  }
  actions.push({ t: 'gap', h: 30 });
  return { info, actions };
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
  const W = LAY.W, H = LAY.H;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(10,12,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,12,34,${a})`); g.addColorStop(1, `rgba(10,12,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// An obvious "there is more below / above" cue for any list that scrolls: soft fade plus a chevron pill.
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
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

// Lays out (with real text measuring), remembers for hit-testing, draws; returns scroll info.
function drawFlowScreen(ctx, state, key) {
  const f = buildFlow(ctx, state, key);
  const { lay, top, bottom } = f;
  LAID = { key: `${key}|${LAY.key}|${state.settings.textIdx}`, lay, top, bottom, h: lay.contentH, lock: f.lock };
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
    roundPath(ctx, LAY.U.x1 - 10, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
    const xs = lay.items.map((i) => i.x), xe = lay.items.map((i) => i.x + i.wd), x0 = Math.min(...xs), x1 = Math.max(...xe);
    scrollHint(ctx, top, bottom, scroll, maxScroll, x0, x1 - x0);
  }
  return { scroll, maxScroll, lay, top, bottom };
}

export function renderTitle(ctx, state) {
  const L = LAY, a = state.att, W = L.W;
  drawMenuBack(ctx, L);
  const f = buildFlow(ctx, state, 'title');
  if (!L.land) {
    // the ken plays by itself between the title and the buttons (the hero art is the first item of the flow)
    const col = L.titleFlow, y0 = f.top + Math.max(0, (col.bottom - col.top - f.lay.contentH) / 2);
    const cx = col.x + col.w / 2;
    ctx.save(); ctx.translate(cx - 180, y0 + 100); ctx.scale(0.5, 0.5);
    drawWorld(ctx, a.w, a.rope, { parts: a.parts, noBackdrop: true });
    ctx.restore();
    const g = ctx.createRadialGradient(cx, y0 + 200, 40, cx, y0 + 200, 420);
    g.addColorStop(0, 'rgba(8,10,34,0.5)'); g.addColorStop(1, 'rgba(8,10,34,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - 360, y0, 720, 560);
  } else {
    const A = L.titleArt, k = Math.min(1, A.w / 640), heroH = 250 * k, tk = Math.min(0.5, (A.h - heroH - 8) / 758);
    const cx = A.x + A.w / 2;
    ctx.save(); ctx.translate(cx - 360 * tk, A.y + heroH - 330 * tk); ctx.scale(tk, tk);
    drawWorld(ctx, a.w, a.rope, { parts: a.parts, noBackdrop: true });
    ctx.restore();
    const g = ctx.createRadialGradient(cx, A.y + heroH * 0.6, 20, cx, A.y + heroH * 0.6, 360);
    g.addColorStop(0, 'rgba(8,10,34,0.55)'); g.addColorStop(1, 'rgba(8,10,34,0)');
    ctx.fillStyle = g; ctx.fillRect(A.x, A.y, A.w, A.h);
    ctx.save(); ctx.translate(cx - 320 * k, A.y + 6); ctx.scale(k, k); heroDraw(ctx, 640); ctx.restore();
  }
  drawFlowScreen(ctx, state, 'title');
  { const k = LAID.lock; if (k) {      // the themed Arcforge lockup under the menu; a tap opens the Arcforge home
    const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(12,10,36,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx - (k.w * (dn ? 0.96 : 1)) / 2, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); } }
  if (state.demo) { ctx.textAlign = L.land ? 'right' : 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', L.land ? L.U.x1 - 16 : W / 2, L.U.y1 - 4); }
}
export function renderLadder(ctx, state) {
  const L = LAY, ld = L.ladder;
  drawMenuBack(ctx, L); scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'ladder');
  if (ld.fade) {
    const g = ctx.createLinearGradient(0, ld.fade.y, 0, ld.fade.y + ld.fade.h);
    g.addColorStop(0, 'rgba(10,12,34,0)'); g.addColorStop(0.2, 'rgba(10,12,34,0.85)'); g.addColorStop(1, 'rgba(10,12,34,0.95)');
    ctx.fillStyle = g; ctx.fillRect(ld.fade.x, ld.fade.y, ld.fade.w, ld.fade.h);
  } else if (ld.side) {
    const sd = ld.side, tot = totalStars(state.record), max = TRICKS.length * 3;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 52px ${FONT}`;
    const lines = wrapLines(ctx, 'Trick Ladder', sd.w);
    lines.forEach((l, i) => textShadow(ctx, l, sd.x + sd.w / 2, sd.y + 60 + i * 60, '#fff6e2', 6));
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, `${tot} of ${max} stars`, sd.x + sd.w / 2, sd.y + 60 + lines.length * 60 + 10, '#ffe9bf', 4);
    ctx.restore();
  }
  drawButton(ctx, ld.back, 'Back', { dark: true, size: 30 });
  if (state.ladderMsg) { ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.textBaseline = 'alphabetic';
    const lines = wrapLines(ctx, state.ladderMsg, ld.back.w + 40); lines.forEach((l, i) => ctx.fillText(l, ld.msg.x, ld.msg.y - (lines.length - 1 - i) * 26)); ctx.restore(); }
}
export function renderSettings(ctx, state) {
  drawMenuBack(ctx, LAY); scrim(ctx, 0.66);
  drawFlowScreen(ctx, state, 'settings');
}
export function renderResult(ctx, state, rope) {
  const L = LAY;
  drawStageWorld(ctx, state, rope);
  scrim(ctx, 0.62);
  drawFlowScreen(ctx, state, 'result');
  drawMoreLine(ctx, (L.U.x0 + L.U.x1) / 2, L.U.y1 - 26, 22);
}
export function renderDemoLimit(ctx, state) {
  drawMenuBack(ctx, LAY); scrim(ctx, 0.7);
  drawFlowScreen(ctx, state, 'demolimit');
}
export function renderPause(ctx, state) {
  const L = LAY, P = L.pause;
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: P.x + 30, w: P.w - 60 });
  const top = P.top + 20, bottom = P.bottom - 20;
  const ch = Math.min(lay.contentH + 20, bottom - top);
  const y0 = Math.max(top, (L.H - ch) / 2);
  panel(ctx, P.x, y0 - 20, P.w, ch + 40, { r: 30, fill: 'rgba(24,28,64,0.92)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch);
  const sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, P.x, P.w);
}

// ---- reference pages --------------------------------------------------------------------------
// One continuous SCROLLING reader (drag, wheel, keys, scroll bar): READER is refreshed on every draw for the input code.
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };
const REF_CLOSE = () => ({ x: REF_BACK.x, y: REF_BACK.y, w: REF_NEXT.x + REF_NEXT.w - REF_BACK.x, h: REF_BACK.h });
export const refCloseRect = () => REF_CLOSE();

function buildPages(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = Math.min(PANEL.w - 80, 800);
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const top = PANEL.y + 120, limit = Infinity;
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
  pages.forEach((pg) => { pg.total = used; });
  return pages;
}

const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  const L = LAY, PG = L.pages, PANEL = PG.panel;
  drawMenuBack(ctx, L); scrim(ctx, 0.66);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc, { ...PANEL, ft: PG.ftH }); pageCache.set(pkey, pages); if (pageCache.size > 60) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, twid = Math.min(PANEL.w - 80, 800), tx = pcx - twid / 2;
  const pg = pages[0];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(60,60,90,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
  ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,60,90,0.35)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  const cy0 = PANEL.y + 112, cy1 = PANEL.y + PANEL.h - PG.ftH;
  READER.max = Math.max(0, Math.ceil(pg.total - (cy1 - cy0 - 8))); READER.view = cy1 - cy0; READER.y0 = cy0; READER.y1 = cy1;
  state.ui.scroll = Math.max(0, Math.min(READER.max, state.ui.scroll || 0));
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 4, cy0, PANEL.w - 8, cy1 - cy0); ctx.clip();
  let y = PANEL.y + 120 - state.ui.scroll;
  pg.blocks.forEach((blk, bi) => {
    if (bi > 0) { ctx.strokeStyle = 'rgba(60,60,90,0.22)'; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y - 8); ctx.lineTo(PANEL.x + PANEL.w - 80, y - 8); ctx.stroke(); y += 8; }
    ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l + (blk.part > 0 && k === blk.tl.length - 1 ? ' (cont.)' : ''), pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, pcx - Math.min(PANEL.w - 80, 620) / 2, y, Math.min(PANEL.w - 80, 620), blk.artH - 12, state); ctx.restore(); y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => {
      if (l.gapBefore && k > 0) y += pg.lh * 0.45;
      ctx.fillText(l.text, tx, y + pg.fs * 0.85);
      y += pg.lh;
    });
    y += 26;
  });
  ctx.restore();
  if (READER.max > 0) {
    const th = Math.max(50, (cy1 - cy0) * ((cy1 - cy0) / pg.total)), ty = cy0 + (state.ui.scroll / READER.max) * (cy1 - cy0 - th);
    roundPath(ctx, PANEL.x + PANEL.w - 14, ty, 6, th, 3); ctx.fillStyle = 'rgba(60,60,90,0.5)'; ctx.fill();
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(50,50,80,0.7)';
  ctx.fillText(READER.max > 0 ? (state.ui.scroll < READER.max - 4 ? 'Scroll for more' : 'End') : '', pcx, PANEL.y + PANEL.h - PG.ftH / 2 + 8);
  drawButton(ctx, TEXT_DEC, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, TEXT_INC, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = PG.land ? C.ink : '#fff6e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(sc * 100)}%`, PG.pct.x, PG.pct.y);
  drawButton(ctx, REF_CLOSE(), 'Close', { primary: true, size: 32 });
}

// ---- illustrations ----------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e2', align = 'center') {
  size = Math.max(20, size);
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
