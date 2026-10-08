// Every screen that is not the play screen: title, trick book, settings, result, pause, demo limit, and the scrolling
// About / How to Play / Rules reader with illustrations drawn with the game's own toys. Pure drawing.
// Everything is laid out from the live layout (layout.js): portrait = one centred column, wide = art on the left + a column.
import { LAY, TEXT_SCALES, THINK_STEPS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { gfx, drawBackdrop, drawToy2D, scrim } from './art.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { TRICKS, ROWS, TOY_NAME, tricksOf, rowOpen, starsOfToy, totalStars } from './tricks.js';
import { createWorld, DB } from './phys.js';
import { makeCam } from './cam.js';

const TAU = Math.PI * 2;
let LAID = { key: '', lay: null, top: 0, bottom: 0 };
export const flowMeta = () => LAID;
export const resetMenus = () => { LAID = { key: '', lay: null, top: 0, bottom: 0 }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

function flowSpec(key, state) {
  const L = LAY, land = L.land;
  switch (key) {
    case 'title': return { cols: [{ w: titleWidgets(state), col: L.titleFlow, center: true }] };
    case 'book': return { cols: [{ w: bookWidgets(state, land), col: L.book.flow }] };
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
  if (key === 'title' && lastCol) {
    const k = LAY.lock, cx = lastCol.x + lastCol.w / 2, pinned = LAY.U.y1 - k.h - 12, y = Math.min(lastEnd + 12, pinned), m = 44 / k.cpu, tw = Math.max(k.w + 24, m), th = Math.max(k.h + 12, m);
    out.lock = { cx, y, w: k.w, h: k.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, k.h + 8) } };
  }
  return out;
}
export function ensureLayout(state, key) {
  const k = `${key}|${LAY.key}|${state.settings.textIdx}|${state.settings.toy}|${state.res ? state.res.kind : ''}`;
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

// ---- widgets ----------------------------------------------------------------------------------
export function titleWidgets(state) {
  const sound = state.settings.sound, toy = state.settings.toy, dl = state.record.daily;
  return [
    { t: 'btn', id: 'toy-yoyo', label: 'Yo-yo', row: 0, active: toy === 'yoyo', dark: toy !== 'yoyo', h: 76 },
    { t: 'btn', id: 'toy-diabolo', label: 'Diabolo', row: 0, active: toy === 'diabolo', dark: toy !== 'diabolo', h: 76 },
    { t: 'btn', id: 'book', label: 'Trick Book', sub: `${starsOfToy(state.record, toy)} of 21 stars`, primary: true, h: 92 },
    { t: 'btn', id: 'show', label: 'Show', sub: state.record.showBest[toy] ? `Best ${state.record.showBest[toy]}` : 'Chain tricks', row: 1, h: 80 },
    { t: 'btn', id: 'daily', label: 'Daily', sub: dl.done && dl.day === (state.dayNow | 0) ? 'Done today' : 'New goals', row: 1, h: 80 },
    { t: 'btn', id: 'free', label: 'Free Play', row: 2, h: 76 },
    { t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2, h: 76 },
    { t: 'btn', id: 'howto', label: 'How to Play', row: 3, h: 76 },
    { t: 'btn', id: 'rules', label: 'Rules', row: 3, h: 76 },
    { t: 'btn', id: 'about', label: 'About', row: 3, h: 76 },
    { t: 'btn', id: 'settings', label: 'Settings', row: 4, h: 76 },
    { t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4, h: 76 },
  ];
}
export function bookWidgets(state, land = false) {
  const rec = state.record, toy = state.settings.toy, tot = starsOfToy(rec, toy), max = 21;
  const wd = [{ t: 'gap', h: 8 },
    { t: 'btn', id: 'toy-yoyo', label: 'Yo-yo', row: 0, active: toy === 'yoyo', dark: toy !== 'yoyo', h: 70 },
    { t: 'btn', id: 'toy-diabolo', label: 'Diabolo', row: 0, active: toy === 'diabolo', dark: toy !== 'diabolo', h: 70 }];
  if (!land) wd.push({ t: 'h', label: 'Trick Book', size: 48 });
  wd.push({ t: 'p', label: `${tot} of ${max} stars`, bold: true, color: '#ffe9bf', size: 26 });
  ROWS.forEach((row, ri) => {
    const open = rowOpen(ri, rec, toy);
    const demoLock = state.demo && tricksOf(toy).filter((t) => t.row === ri).every((t) => tricksOf(toy).indexOf(t) >= 3);
    wd.push({ t: 'gap', h: 8 });
    wd.push({ t: 'p', label: row.name, bold: true, color: '#ffd97a', size: 30, cap: 1.6 });
    if (!open) wd.push({ t: 'p', label: `Earn ${row.need - tot} more star${row.need - tot === 1 ? '' : 's'} to open`, size: 22, cap: 2 });
    else if (demoLock) wd.push({ t: 'p', label: 'In the full game', size: 22, cap: 2 });
    tricksOf(toy).filter((t) => t.row === ri).forEach((tr) => {
      const st = rec.stars[tr.id] | 0, idx = tricksOf(toy).indexOf(tr), locked = !open || (state.demo && idx >= 3);
      wd.push({ t: 'btn', id: `t:${tr.id}`, label: tr.name, sub: tr.goal, disabled: locked, hitDisabled: true, stars: locked ? 0 : st, starMax: 3, h: 112 });
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
    { t: 'p', label: 'A little forgiveness for the sleeper and for catching a wobbling diabolo.', size: 22, cap: 2 },
    { t: 'btn', id: 'as-dec', label: 'Less', row: 10, disabled: st.assist === 0 },
    { t: 'btn', id: 'as-inc', label: 'More', row: 10, disabled: st.assist === 2 },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe9bf', size: 26 },
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
  const info = [{ t: 'gap', h: big ? 24 : LAY.land ? 10 : 70 }], actions = [];
  if (r.kind === 'trick') {
    info.push({ t: 'h', label: 'Trick landed', size: 60, cap: big ? 1.2 : 1.5 });
    info.push({ t: 'h', label: r.name, size: 38, cap: big ? 1.2 : 1.5, color: '#ffe9bf' });
    info.push({ t: 'h', label: '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), size: 92, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    info.push({ t: 'p', label: r.drops === 0 ? 'No drops at all.' : `${r.drops} drop${r.drops === 1 ? '' : 's'}.`, size: 28, cap: big ? 2 : 3 });
    info.push({ t: 'p', label: r.stars === 3 ? 'A clean trick.' : 'Fewer drops earn more stars.', size: 24, cap: big ? 2 : 3 });
    info.push({ t: 'gap', h: 20 });
    if (r.next) actions.push({ t: 'btn', id: 'next', label: 'Next trick', sub: r.next.name, primary: true, h: 92 });
    actions.push({ t: 'btn', id: 'again', label: 'Try again', primary: !r.next, row: 6 });
    actions.push({ t: 'btn', id: 'book', label: 'Trick Book', row: 6 });
    actions.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else if (r.kind === 'show') {
    info.push({ t: 'h', label: 'Show over', size: 60, cap: big ? 1.2 : 1.5 });
    info.push({ t: 'h', label: String(r.score), size: 100, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    info.push({ t: 'p', label: r.newBest ? 'A new best score!' : `Best ${r.best}`, bold: true, color: '#ffe9bf', size: 28, cap: big ? 2 : 3 });
    info.push({ t: 'p', label: `${r.tricks} trick${r.tricks === 1 ? '' : 's'}, longest chain ${r.chain}.`, size: 26, cap: big ? 2 : 3 });
    info.push({ t: 'gap', h: 20 });
    actions.push({ t: 'btn', id: 'again', label: 'Another show', primary: true, h: 92 });
    actions.push({ t: 'btn', id: 'menu', label: 'Main menu', dark: true });
  } else {
    info.push({ t: 'h', label: r.won ? 'Daily complete' : 'Daily over', size: 60, cap: big ? 1.2 : 1.5 });
    info.push({ t: 'h', label: String(r.score), size: 90, cap: big ? 1.1 : 1.3, color: '#ffd45a' });
    info.push({ t: 'p', label: `${r.done} of ${r.total} goals. Best today ${r.best}.`, bold: true, color: '#ffe9bf', size: 26, cap: big ? 2 : 3 });
    info.push({ t: 'p', label: r.won ? `Streak: ${r.streak} day${r.streak === 1 ? '' : 's'}.` : r.names.join(', '), size: 24, cap: big ? 2 : 3 });
    info.push({ t: 'gap', h: 20 });
    actions.push({ t: 'btn', id: 'again', label: 'Try again', primary: true, h: 92 });
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
    ...(state.mode !== 'watch' ? [{ t: 'btn', id: 'p-restart', label: state.mode === 'trick' ? 'Restart trick' : 'Restart', dark: true }] : []),
    ...(state.mode === 'show' || state.mode === 'daily' ? [{ t: 'btn', id: 'p-endshow', label: state.mode === 'show' ? 'End show and score' : 'Give up today', dark: true }] : []),
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
    { t: 'p', label: 'The web demo has the first three tricks of each toy and two shows. The full game on iPhone and Android has all fourteen tricks, unlimited shows and everything else.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- drawing helpers -------------------------------------------------------------------------
function base(ctx, state, cam, a = 0.55) {
  ctx.clearRect(0, 0, LAY.W, LAY.H);
  if (!gfx.has3d) { drawBackdrop(ctx, LAY, cam); const w = state.scene === 'result' ? state.w : state.att ? state.att.w : null; if (w) drawToy2D(ctx, cam, w); }
  if (a > 0) scrim(ctx, LAY, a);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0, w) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(4,16,22,0)'); g.addColorStop(1, 'rgba(4,16,22,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const f = buildFlow(ctx, state, key);
  const { lay, top, bottom } = f;
  LAID = { key: `${key}|${LAY.key}|${state.settings.textIdx}|${state.settings.toy}|${state.res ? state.res.kind : ''}`, lay, top, bottom, h: lay.contentH, lock: f.lock };
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
function heroDraw(ctx, cx, y, size) {
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${size}px ${FONT}`;
  const g = ctx.createLinearGradient(0, y - size, 0, y + 6); g.addColorStop(0, '#fff3cf'); g.addColorStop(1, '#f0bd4a');
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = g; ctx.fillText('SPIN', cx, y);
  ctx.font = `600 ${Math.round(size * 0.42)}px ${FONT}`; ctx.fillStyle = '#9ff4f6'; ctx.fillText('and', cx, y + size * 0.42);
  ctx.font = `800 ${size}px ${FONT}`; ctx.fillStyle = g; ctx.fillText('STRING', cx, y + size * 1.3);
  ctx.restore();
}

export function renderTitle(ctx, state, cam) {
  const L = LAY;
  base(ctx, state, cam, 0.0);
  // soft shade behind the menu so the buttons read over the scene
  const f0 = buildFlow(ctx, state, 'title');
  const sh = ctx.createLinearGradient(0, f0.top - 60, 0, f0.top + 40); sh.addColorStop(0, 'rgba(4,16,22,0)'); sh.addColorStop(1, 'rgba(4,16,22,0.62)');
  if (!L.land) { ctx.fillStyle = sh; ctx.fillRect(0, f0.top - 60, L.W, 100); ctx.fillStyle = 'rgba(4,16,22,0.62)'; ctx.fillRect(0, f0.top + 40, L.W, L.H); }
  else { const g2 = ctx.createLinearGradient(L.titleFlow.x - 120, 0, L.titleFlow.x - 10, 0); g2.addColorStop(0, 'rgba(4,16,22,0)'); g2.addColorStop(1, 'rgba(4,16,22,0.7)'); ctx.fillStyle = g2; ctx.fillRect(L.titleFlow.x - 120, 0, L.W, L.H); ctx.fillStyle = 'rgba(4,16,22,0.7)'; ctx.fillRect(L.titleFlow.x - 10, 0, L.W, L.H); }
  if (!L.land) { const A = L.titleArt, sz = Math.min(66, A.h * 0.33); heroDraw(ctx, A.x + A.w / 2, A.y + sz + 10, sz); }
  else { const A = L.titleArt, sz = Math.min(110, A.w / 4.2); heroDraw(ctx, A.x + A.w / 2, A.y + sz + 20, sz); }
  ctx.save(); ctx.textAlign = 'center'; ctx.font = `600 24px ${FONT}`; ctx.fillStyle = 'rgba(230,246,246,0.9)';
  const sub = 'Yo-yo and diabolo, with real physics';
  if (!L.land) ctx.fillText(sub, L.W / 2, L.titleArt.y + L.titleArt.h - 8); else ctx.fillText(sub, L.titleArt.x + L.titleArt.w / 2, L.U.y1 - 24);
  ctx.restore();
  drawFlowScreen(ctx, state, 'title');
  { const k = LAID.lock; if (k) {
    const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
    ctx.save(); ctx.fillStyle = 'rgba(8,24,32,0.7)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, k.cx - (k.w * (dn ? 0.96 : 1)) / 2, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1); } }
  if (state.demo) { ctx.textAlign = L.land ? 'right' : 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', L.land ? L.U.x1 - 16 : L.W / 2, L.U.y1 - 4); }
}
export function renderBook(ctx, state, cam) {
  const L = LAY, ld = L.book;
  base(ctx, state, cam, 0.68);
  drawFlowScreen(ctx, state, 'book');
  if (ld.fade) {
    const g = ctx.createLinearGradient(0, ld.fade.y, 0, ld.fade.y + ld.fade.h);
    g.addColorStop(0, 'rgba(4,16,22,0)'); g.addColorStop(0.2, 'rgba(4,16,22,0.85)'); g.addColorStop(1, 'rgba(4,16,22,0.95)');
    ctx.fillStyle = g; ctx.fillRect(ld.fade.x, ld.fade.y, ld.fade.w, ld.fade.h);
  } else if (ld.side) {
    const sd = ld.side, toy = state.settings.toy, tot = starsOfToy(state.record, toy);
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 52px ${FONT}`;
    const tl = wrapLines(ctx, 'Trick Book', sd.w); tl.forEach((l, i) => textShadow(ctx, l, sd.x + sd.w / 2, sd.y + 60 + i * 60, '#fff6e2', 6));
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, `${TOY_NAME[toy]}: ${tot} of 21 stars`, sd.x + sd.w / 2, sd.y + 60 + tl.length * 60 + 6, '#ffe9bf', 4);
    ctx.restore();
  }
  drawButton(ctx, ld.back, 'Back', { dark: true, size: 30 });
  if (state.bookMsg) { ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffd9a0'; ctx.textBaseline = 'alphabetic';
    const lines = wrapLines(ctx, state.bookMsg, ld.back.w + 40); lines.forEach((l, i) => ctx.fillText(l, ld.msg.x, ld.msg.y - (lines.length - 1 - i) * 26)); ctx.restore(); }
}
export function renderSettings(ctx, state, cam) { base(ctx, state, cam, 0.72); drawFlowScreen(ctx, state, 'settings'); }
export function renderResult(ctx, state, cam) {
  base(ctx, state, cam, 0.66);
  drawFlowScreen(ctx, state, 'result');
  drawMoreLine(ctx, (LAY.U.x0 + LAY.U.x1) / 2, LAY.U.y1 - 26, 22);
}
export function renderDemoLimit(ctx, state, cam) { base(ctx, state, cam, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  const L = LAY, P = L.pause;
  scrim(ctx, L, 0.5);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const lay = flowLayout(ctx, wd, sc, { x: P.x + 30, w: P.w - 60 });
  const top = P.top + 20, bottom = P.bottom - 20, ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (L.H - ch) / 2);
  panel(ctx, P.x, y0 - 20, P.w, ch + 40, { r: 30, fill: 'rgba(10,36,46,0.94)', stroke: 'rgba(240,189,74,0.55)' });
  LAID = { key: 'pause', lay, top: y0, bottom: y0 + ch, h: lay.contentH };
  const maxScroll = Math.max(0, lay.contentH - ch), sc0 = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, sc0);
  scrollHint(ctx, y0, y0 + ch, sc0, maxScroll, P.x, P.w);
}

// ---- reference pages ---------------------------------------------------------------------------
export const READER = { max: 0, view: 0, y0: 0, y1: 0 };
const REF_CLOSE = () => ({ x: REF_BACK.x, y: REF_BACK.y, w: REF_NEXT.x + REF_NEXT.w - REF_BACK.x, h: REF_BACK.h });
export const refCloseRect = () => REF_CLOSE();

function buildPages(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = Math.min(PANEL.w - 80, 800);
  const secFs = Math.round(34 * Math.min(scale, 1.3));
  const blocks = []; let total = 0;
  list.forEach((sec) => {
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw), titleH = tl.length * secFs * 1.2 + 16;
    ctx.font = `400 ${fs}px ${FONT}`;
    const lines = [];
    sec.p.forEach((para, pi) => { wrapLines(ctx, para, tw).forEach((l, k) => lines.push({ text: l, gapBefore: k === 0 && pi > 0 })); });
    const artH = sec.art ? 250 : 0;
    let h = titleH + artH + 26;
    lines.forEach((l, k) => { h += lh + (l.gapBefore && k > 0 ? lh * 0.45 : 0); });
    blocks.push({ title: sec.title, tl, titleH, art: sec.art, artH, lines });
    total += h + 8;
  });
  return [{ blocks, fs, lh, secFs, total }];
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header, cam) {
  const L = LAY, PG = L.pages, PANEL = PG.panel;
  base(ctx, state, cam, 0.7);
  const sc = TEXT_SCALES[state.settings.textIdx];
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let pages = pageCache.get(pkey);
  if (!pages) { pages = buildPages(ctx, list, sc, PANEL); pageCache.set(pkey, pages); if (pageCache.size > 60) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, twid = Math.min(PANEL.w - 80, 800), tx = pcx - twid / 2;
  const pg = pages[0];
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(60,60,90,0.6)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`;
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
    ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `800 ${pg.secFs}px ${FONT}`;
    blk.tl.forEach((l, k) => ctx.fillText(l, pcx, y + pg.secFs * (0.9 + k * 1.2) - 8));
    y += blk.titleH;
    if (blk.art) { if (y + blk.artH > cy0 - 20 && y < cy1 + 20) { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, blk.artH); ctx.clip(); drawArt(blk.art, ctx, pcx - Math.min(PANEL.w - 80, 620) / 2, y, Math.min(PANEL.w - 80, 620), blk.artH - 12); ctx.restore(); } y += blk.artH; }
    ctx.fillStyle = C.ink; ctx.font = `400 ${pg.fs}px ${FONT}`; ctx.textAlign = 'left';
    blk.lines.forEach((l, k) => { if (l.gapBefore && k > 0) y += pg.lh * 0.45; ctx.fillText(l.text, tx, y + pg.fs * 0.85); y += pg.lh; });
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

// ---- illustrations: drawn with the same 2D toys, from tiny fake worlds -------------------------------
function label(ctx, t, x, y, size = 20, col = '#fff6e2', align = 'center') {
  ctx.fillStyle = col; ctx.font = `700 ${Math.max(20, size)}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y);
}
function artBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0c2c36'); g.addColorStop(0.7, '#1a5560'); g.addColorStop(1, '#6a4a38');
  roundPath(ctx, 0, 0, w, h, 16); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd45a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function mini(toy, w, h, top, bot) {                      // a little world + camera for one illustration
  const wd = createWorld(toy, 1);
  const cam = makeCam(w, h, { x: 0, y: 0, w, h }, toy, top, true);
  void bot;
  return { wd, cam };
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  artBg(ctx, w, h);
  const yo = (px, py, hx = 0, hy = 0) => { const m = mini('yoyo', w, h); m.cam = makeCam(w, h, { x: 0, y: 0, w, h }, 'yoyo', 0.7, true); m.wd.hand.x = hx; m.wd.hand.y = hy; m.wd.yy.x = px; m.wd.yy.y = py; m.wd.yy.mode = 'fly'; return m; };
  const A = {
    both() {
      const a = yo(-0.45, -0.95, -0.45, 0.05); drawToy2D(ctx, a.cam, a.wd);
      const d = createWorld('diabolo', 1); d.hand.x = 0.5; d.hand.y = 0.3; d.db.x = 0.5; d.db.y = -0.45;
      const cam = makeCam(w, h, { x: 0, y: 0, w, h }, 'diabolo', 0.95, true); ctx.save(); ctx.scale(0.8, 0.8); ctx.translate(w * 0.12, h * 0.06); drawToy2D(ctx, cam, d); ctx.restore();
      label(ctx, 'Yo-yo', w * 0.25, h - 14, 22); label(ctx, 'Diabolo', w * 0.75, h - 14, 22);
    },
    yoyo() {
      const a = yo(0, -0.95, 0, 0.1); drawToy2D(ctx, a.cam, a.wd);
      const p = a.cam.project(0, -0.95); const q = a.cam.project(0, 0.1);
      label(ctx, 'hand', q.x + 60, q.y + 6, 20, '#ffe9bf', 'left'); label(ctx, 'string', (p.x + q.x) / 2 + 20, (p.y + q.y) / 2, 20, '#ffe9bf', 'left'); label(ctx, 'yo-yo', p.x + 56, p.y + 6, 20, '#ffe9bf', 'left');
      arrow(ctx, w * 0.82, h * 0.2, w * 0.82, h * 0.7, '#ffd45a', 5); label(ctx, 'flick down', w * 0.82, h - 14, 20);
    },
    walk() {
      const a = yo(0.5, -1.27, -0.4, -0.4); drawToy2D(ctx, a.cam, a.wd);
      arrow(ctx, w * 0.14, h * 0.26, w * 0.4, h * 0.26, '#ffd45a', 5); label(ctx, 'slide slowly', w * 0.28, h * 0.2, 20);
      label(ctx, 'it rolls on the floor', w * 0.7, h - 14, 20, '#ffe9bf');
    },
    loop() {
      const a = yo(0.55, 0.7, 0, 0); drawToy2D(ctx, a.cam, a.wd);
      ctx.strokeStyle = 'rgba(255,214,90,0.8)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3; ctx.beginPath(); const c = a.cam.project(0, 0); ctx.arc(c.x, c.y, 1.1 * c.s * 0.9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, 'a hard forward flick whips it round', w / 2, h - 12, 20);
    },
    diabolo() {
      const d = createWorld('diabolo', 1); d.hand.x = 0; d.hand.y = 0.2; d.db.x = 0; d.db.y = -0.55;
      const cam = makeCam(w, h, { x: 0, y: 0, w, h }, 'diabolo', 0.95, true); drawToy2D(ctx, cam, d);
      arrow(ctx, w * 0.12, h * 0.8, w * 0.28, h * 0.8, '#ffd45a', 4); arrow(ctx, w * 0.28, h * 0.8 + 10, w * 0.12, h * 0.8 + 10, '#ffd45a', 4);
      label(ctx, 'shake left and right to spin it up', w / 2, h - 12, 20);
    },
    toss() {
      const d = createWorld('diabolo', 1); d.hand.x = 0.2; d.hand.y = 0; d.hand.sp = DB.spMax - 0.05; d.db.x = 0.2; d.db.y = 0.55; d.db.air = true; d.db.tilt = 0.1;
      const cam = makeCam(w, h, { x: 0, y: 0, w, h }, 'diabolo', 1.0, true); drawToy2D(ctx, cam, d);
      const p = cam.project(0.2, 0.55); arrow(ctx, p.x, p.y + 56, p.x, p.y + 20, '#ffd45a', 4);
      label(ctx, 'flick up, then slide under it', w / 2, h - 12, 20);
    },
    flick() {
      const p0 = { x: w * 0.3, y: h * 0.7 }, p1 = { x: w * 0.3, y: h * 0.25 };
      ctx.strokeStyle = 'rgba(255,246,226,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p0.x, p0.y, 22, 0, TAU); ctx.stroke();
      arrow(ctx, p0.x, p0.y - 30, p1.x, p1.y, '#ffd45a', 6); label(ctx, 'fast = a throw or toss', p0.x + 60, h * 0.45, 20, '#fff6e2', 'left');
      arrow(ctx, w * 0.62, h * 0.8, w * 0.92, h * 0.8, '#6fe8ee', 3); label(ctx, 'slow and steady = walk or swing', w * 0.62, h * 0.7, 20, '#bff8fa', 'left');
    },
    gauge() {
      const bw = w - 80, bx = 40, by = h * 0.35;
      roundPath(ctx, bx, by, bw, 34, 17); ctx.fillStyle = 'rgba(4,16,22,0.7)'; ctx.fill();
      roundPath(ctx, bx + 4, by + 4, bw * 0.55, 26, 13); const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#f0bd4a'); g.addColorStop(1, '#6fe8ee'); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * 0.17, by - 4, 4, 42);
      label(ctx, 'the white mark: enough spin to climb back (yo-yo) or to stay steady (diabolo)', w / 2, h * 0.75, 20, '#ffe9bf');
    },
    ladder() {
      for (let i = 0; i < 4; i++) { const bw = 100, x0 = 24 + i * (bw + 14), bh = 40 + i * 30; roundPath(ctx, x0, h - 24 - bh, bw, bh, 8); ctx.fillStyle = i < 2 ? '#f0bd4a' : 'rgba(255,255,255,0.18)'; ctx.fill(); label(ctx, String(i + 1), x0 + bw / 2, h - 34, 22, i < 2 ? '#1b2a36' : '#fff6e2'); }
      label(ctx, 'stars open the next row', w - 20, 34, 20, '#ffe9bf', 'right');
    },
  };
  (A[key] ?? A.both)();
  ctx.restore();
}
void TRICKS; void totalStars;
