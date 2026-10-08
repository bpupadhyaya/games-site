// Every screen that is not the play screen: title, setup, fold workshop, collection, settings, result, pause, and the
// About / How to play / Rules reader with its illustrations (drawn with the game's own tile art). Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, setupPins, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PROFILES, UNLOCKS } from './profiles.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { PATTERNS, drawFlatTile, drawFloor } from './art.js';
import { makeCam } from './cam.js';
import { drawTable } from './view.js';
import { STEPS, drawFold, crispness } from './fold.js';
import { tileMass } from './sim.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; COLL.rects = []; }
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.saved ? 1 : 0}|${state.setup.mode}|${state.setup.goal}|${state.setup.opp}|${state.pat}|${state.fold ? state.fold.step + (state.fold.done ? 9 : 0) : 0}|${state.collSel}|${state.newUnlocks ? state.newUnlocks.length : 0}|${state.record.owned.join('')}`;
const land = () => W > H;
const oyOf = () => Math.max(0, (H - 1280) / 2);
const COLL = { rects: [] };
export const collectionHit = (x, y) => { for (const r of COLL.rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.i; return -1; };

const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };

// The columns of a screen: [{ widgets, x, w, top, bottom, center? }], plus the pins / stage rectangles that go with them.
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const colTop = Math.max(bottom - btnH, host.t + 400), heroTop = host.t + 16 + Math.max(0, Math.min(70, (colTop - 760) / 4));
      const zy = heroTop + 322;
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop }, zone: { x: 0, y: zy, w: W, h: Math.max(160, colTop - 8 - zy) } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  if (key === 'setup') {
    const pins = setupPins(), cw = L ? Math.min(640, W - 80) : 640, x0 = L ? Math.round((W - cw) / 2) : 40;
    return { cols: [{ widgets: setupWidgets(state), x: x0, w: cw, top: host.t, bottom: pins.start.y - 20 }], pins };
  }
  if (key === 'fold') {
    if (!L) {
      const s = Math.min(W - 60, H * 0.44, 560), sy = Math.max(host.t, 0) + 70, stage = { x: (W - s) / 2, y: sy, s };
      return { cols: [{ widgets: foldWidgets(state), x: 40, w: 640, top: sy + s + 14, bottom: H - host.b }], stage };
    }
    const s = Math.min(H - host.t - host.b - 30, W * 0.52), stage = { x: host.l + 24, y: host.t + 15 + (H - host.t - host.b - 30 - s) / 2, s };
    const cx = stage.x + s + 36, cw = Math.min(560, W - cx - host.r - 24);
    return { cols: [{ widgets: foldWidgets(state), x: cx, w: cw, top: host.t + 6, bottom: H - host.b - 6, center: true }], stage };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'collection') return { cols: [{ widgets: collectionWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: L }], oy: L ? 0 : oyOf() };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, L ? 0 : oyOf()), bottom: H - host.b, center: L }], oy: L ? 0 : oyOf() };
  return null;
}

function layColumns(ctx, state, key, fr) {
  const sc = TEXT_SCALES[state.settings.textIdx];
  const cols = fr.cols.map((c) => {
    const lay = flowLayout(ctx, c.widgets, sc, { x: c.x, w: c.w });
    const avail = c.bottom - c.top;
    const top = c.center && lay.contentH < avail ? c.top + (avail - lay.contentH) / 2 : c.top;
    return { lay, top, bottom: c.bottom, x: c.x, w: c.w };
  });
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols, pins: fr.pins ?? null, stage: fr.stage ?? null };
  if (key === 'title') {
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
export function ensureLayout(state, key) {
  if (LAID.key === key && LAID.lay && LAID.sig === sigOf(state)) return;
  const fr = frameFor(state, key);
  if (!fr) return;
  layColumns(estCtx, state, key, fr);
}
export const lockupZone = () => (LAID.lock ? LAID.lock.tap : null);
export function hitScreen(x, y, scroll) {
  { const t = LAID.key === 'title' && LAID.lock && LAID.lock.tap; if (t && x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return 'arcforge'; }
  for (let i = 0; i < LAID.cols.length; i++) {
    const c = LAID.cols[i], id = flowHit(c.lay, c.top, i === 0 ? scroll : 0, x, y);
    if (id) return id;
  }
  return null;
}
export const setupPinRects = (state) => (LAID.key === 'setup' && LAID.pins) || frameFor(state, 'setup').pins;
export const foldStage = (state) => (LAID.key === 'fold' && LAID.stage) || frameFor(state, 'fold').stage;

// ---- widgets ---------------------------------------------------------------------------------------------------
const heroArt = (h = 360) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `italic 900 150px ${FONT}`;
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(36,12,2,0.92)'; ctx.strokeText('Ddakji', cx, 190);
    const g = ctx.createLinearGradient(0, 80, 0, 200); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.55, '#f6c35a'); g.addColorStop(1, '#df6c28'); ctx.fillStyle = g; ctx.fillText('Ddakji', cx, 190);
    ctx.font = `700 54px "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", ${FONT}`;
    ctx.lineWidth = 9; ctx.strokeText('딱지', cx, 262); ctx.fillStyle = '#fff1cf'; ctx.fillText('딱지', cx, 262);
    ctx.font = `600 27px ${FONT}`; textShadow(ctx, 'The Korean paper-tile game', cx, 312, '#ffe9bf', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  if (state.saved) {
    const sn = state.saved, who = sn.cfg.mode === 'two' ? 'Two players' : `vs ${PROFILES[sn.cfg.opp].name}`;
    wd.push({ t: 'btn', id: 'resume', label: 'Continue match', sub: `${who} · ${sn.scores[0]}–${sn.scores[1]}`, primary: true, h: 92 });
  }
  wd.push({ t: 'btn', id: 'play', label: 'Play vs Computer', primary: !state.saved, h: 92 });
  wd.push({ t: 'btn', id: 'two', label: 'Two Players', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 1 });
  wd.push({ t: 'btn', id: 'fold', label: 'Fold Workshop', row: 2 });
  wd.push({ t: 'btn', id: 'collection', label: 'Collection', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export const patName = (i) => (PATTERNS[i] ? PATTERNS[i].name : '');
export function setupWidgets(state) {
  const s = state.setup, rec = state.record, demo = state.demo, wd = [];
  wd.push({ t: 'gap', h: 10 }, { t: 'h', label: s.mode === 'two' ? 'Two Players' : 'New Match', size: 48 });
  if (s.mode !== 'two') {
    wd.push({ t: 'p', label: 'Choose your rival', bold: true, color: '#ffe9bf', size: 26 });
    PROFILES.forEach((pf, i) => {
      const won = rec.wins[i] ?? 0, locked = demo && i > 1;
      wd.push({ t: 'btn', id: `opp${i}`, label: pf.name, sub: locked ? 'In the full game' : `${'★'.repeat(pf.stars)}${'☆'.repeat(5 - pf.stars)}  ${pf.tag}${won ? ` · won ${won}` : ''}`, active: s.opp === i && !locked, disabled: locked, hitDisabled: true, h: 84 });
    });
  }
  wd.push({ t: 'p', label: 'Match length', bold: true, color: '#ffe9bf', size: 26 });
  wd.push({ t: 'btn', id: 'len2', label: 'Quick: first to 2 flips', row: 9, active: s.goal === 2 });
  wd.push({ t: 'btn', id: 'len3', label: 'Full: first to 3', row: 9, active: s.goal === 3 });
  wd.push({ t: 'p', label: `Your tile: ${patName(state.pat)}. Weight ${tileMass(state.record.crisp).toFixed(2)} (crispness ${Math.round(state.record.crisp * 100)}%).`, size: 24, color: '#ffe9bf' });
  wd.push({ t: 'btn', id: 'tilepick', label: 'Choose tile', row: 10 });
  wd.push({ t: 'btn', id: 'foldnew', label: 'Fold a fresh tile', row: 10 });
  if (state.setupMsg) wd.push({ t: 'p', label: state.setupMsg, size: 24, color: '#ffd9a0', bold: true });
  wd.push({ t: 'gap', h: 24 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-guide', label: st.guide ? 'Lift guide: On' : 'Lift guide: Off', sub: 'A small label by the ghost tile: barely a breeze, wobble, flip, too hard', active: st.guide },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe9bf', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe9bf' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const owned = state.record.owned, n = owned.filter(Boolean).length, sel = state.collSel;
  const rows = 4, cols = 3, cell = Math.min(190, Math.floor((w - 20 * (cols - 1)) / cols)), gh = rows * (cell + 20);
  const grid = {
    t: 'art', h: gh,
    draw(ctx, ww, hh, at) {
      COLL.rects = [];
      const gap = 20, total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      for (let i = 0; i < 12; i++) {
        const r = Math.floor(i / cols), c = i % cols, cx = x0 + c * (cell + gap) + cell / 2, cy = r * (cell + gap) + cell / 2 + 10, has = owned[i];
        const slot = UNLOCKS.find((u) => u.pat === i);
        if (sel === i) { roundPath(ctx, cx - cell / 2 - 8, cy - cell / 2 - 8, cell + 16, cell + 16, 18); ctx.fillStyle = 'rgba(240,194,90,0.3)'; ctx.fill(); ctx.strokeStyle = '#f0c25a'; ctx.lineWidth = 3; ctx.stroke(); }
        drawFlatTile(ctx, cx, cy, cell * 0.86, i, { lock: !has, rot: ((i * 7) % 5 - 2) * 0.03 });
        if (state.pat === i) { ctx.fillStyle = '#2f7a62'; roundPath(ctx, cx - cell * 0.3, cy + cell * 0.32, cell * 0.6, 26, 13); ctx.fill(); ctx.fillStyle = '#fff6dc'; ctx.font = `700 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('In use', cx, cy + cell * 0.32 + 13); }
        COLL.rects.push({ i, x: at.x + cx - cell / 2, y: at.y + cy - cell / 2, w: cell, h: cell });
        void slot;
      }
    },
  };
  const u = UNLOCKS.find((q) => q.pat === sel);
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: `${n} of 12 patterns. Tap one to see it; tap an owned one to play with it.`, size: 24, color: '#ffe9bf' },
    grid,
    ...(sel >= 0 ? [{ t: 'h', label: owned[sel] ? patName(sel) : 'Locked', size: 38, cap: 1.2 }, { t: 'p', label: owned[sel] ? (state.pat === sel ? 'This is your tile.' : 'Owned. Tap again to play with it.') : (u ? `How to win it: ${u.how}.` : ''), size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function foldWidgets(state) {
  const f = state.fold, wd = [];
  if (f.done) {
    wd.push({ t: 'h', label: 'Your tile is ready', size: 40, cap: 2.2 });
    wd.push({ t: 'p', label: `Crispness ${Math.round(f.result * 100)}%. Weight ${tileMass(f.result).toFixed(2)}. ${f.result >= 0.9 ? 'A crisp, tight fold.' : 'Straighter drags make a crisper, heavier tile.'}`, size: 26 });
    wd.push({ t: 'btn', id: 'fold-use', label: 'Use this tile', primary: true, h: 84 });
    wd.push({ t: 'btn', id: 'fold-again', label: 'Fold another', row: 11 });
    wd.push({ t: 'btn', id: 'fold-back', label: 'Back', row: 11, dark: true });
    return wd;
  }
  const s = STEPS[f.step];
  wd.push({ t: 'p', label: `Step ${f.step + 1} of ${STEPS.length}`, bold: true, color: '#ffd97a', size: 24 });
  wd.push({ t: 'h', label: s.title, size: 36, cap: 2.2 });
  wd.push({ t: 'p', label: s.hint, size: 25 });
  wd.push({ t: 'btn', id: 'fold-show', label: f.show ? 'Stop demo' : 'Show me', row: 12, active: f.show });
  wd.push({ t: 'btn', id: 'fold-back', label: 'Back', row: 12, dark: true });
  return wd;
}

export function resultWidgets(state, wide = false) {
  const m = state.m, o = m.over, mode = m.cfg.mode, winner = o.win;
  const title = mode === 'two' ? `Player ${winner + 1} wins` : mode === 'watch' ? `${PROFILES[winner === 0 ? m.cfg.watchA : m.cfg.opp].name} wins` : winner === 0 ? 'You win!' : 'You lose';
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 120 }, { t: 'h', label: title, size: wide ? 56 : 64, cap: big ? 1.2 : 1.5 }, { t: 'h', label: `${m.scores[0]} – ${m.scores[1]}`, size: wide ? 72 : 84, cap: big ? 1.1 : 1.3, color: '#ffd97a' }];
  wd.push({ t: 'p', label: `${m.exchanges} exchange${m.exchanges === 1 ? '' : 's'} · ${m.totalThrows} throw${m.totalThrows === 1 ? '' : 's'}`, size: 26, cap: big ? 2 : 3 });
  if (state.newUnlocks && state.newUnlocks.length) {
    for (const p of state.newUnlocks) wd.push({ t: 'p', label: `New pattern: ${patName(p)}`, bold: true, color: '#9be8b0', size: 28, cap: big ? 2 : 3 });
    wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  }
  wd.push({ t: 'gap', h: wide ? 8 : 24 });
  wd.push({ t: 'btn', id: 'again', label: 'Rematch', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'new', label: 'New match', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
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
    { t: 'btn', id: 'p-guide', label: st.guide ? 'Guide: On' : 'Guide: Off', row: 8, active: st.guide },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}

export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 160 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free exchanges of the web demo. The full game on iPhone and Android has all six rivals, every pattern to win and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- drawing ---------------------------------------------------------------------------------------------------
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,10,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,10,4,${a})`); g.addColorStop(1, `rgba(20,10,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#33231a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,233,191,0.9)'; ctx.fill();
    ctx.fillStyle = '#33231a'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
  }
}
function drawFlowScreen(ctx, state, key) {
  const fr = frameFor(state, key);
  const cols = layColumns(ctx, state, key, fr);
  const c0 = cols[0], maxScroll = Math.max(0, c0.lay.contentH - (c0.bottom - c0.top));
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  const scroll = state.ui.scroll;
  cols.forEach((c, i) => {
    const mx = Math.max(0, c.lay.contentH - (c.bottom - c.top)), sc = i === 0 ? scroll : 0;
    drawFlow(ctx, c.lay, c.top, c.bottom, sc, { clipX: c.x - 40, clipW: c.w + 80 });
    if (mx > 0) {
      const top = c.top, bottom = c.bottom, th = Math.max(60, (bottom - top) * ((bottom - top) / c.lay.contentH)), ty = top + (sc / mx) * (bottom - top - th);
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,240,204,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: the same floor and tiles as the game, with two tiles trading slaps.
function attract(ctx, state, zone, dim = 0.2) {
  const cam = makeCam(zone, 0.02);
  drawTable(ctx, cam, state.att, state.t, { W, H });
  scrim(ctx, dim);
  return cam;
}

function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(30,12,6,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, fr.zone, 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(20,8,2,0.66)'); g.addColorStop(1, 'rgba(20,8,2,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(20,10,4,0)'); g2.addColorStop(1, 'rgba(20,10,4,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: H * 0.24, w: hw, h: H * 0.74 }, 0.12);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(20,8,2,0.62)'); g.addColorStop(1, 'rgba(20,8,2,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) {
  attract(ctx, state, { x: 0, y: 0, w: W, h: H }, dim);
}
export function renderSetup(ctx, state) {
  backdrop(ctx, state, 0.62);
  const fr = drawFlowScreen(ctx, state, 'setup'), pins = fr.pins;
  if (!land()) {
    const g = ctx.createLinearGradient(0, H - 180, 0, H); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(0.2, 'rgba(20,10,4,0.85)'); g.addColorStop(1, 'rgba(20,10,4,0.95)'); ctx.fillStyle = g; ctx.fillRect(0, H - 180, W, 180);
  }
  drawButton(ctx, pins.start, 'Start the match', { primary: true, size: 32 });
  drawButton(ctx, pins.back, 'Back', { dark: true, size: 28 });
}
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.66); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) {
  backdrop(ctx, state, land() ? 0.6 : 0.5); drawFlowScreen(ctx, state, 'result');
}
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderFold(ctx, state) {
  backdrop(ctx, state, 0.7);
  const fr = drawFlowScreen(ctx, state, 'fold'), s = fr.stage;
  ctx.save(); ctx.translate(s.x + s.s / 2, s.y + s.s / 2); ctx.scale(s.s / 480, s.s / 480); drawFold(ctx, state.fold, state.pat); ctx.restore();
  void crispness;
}
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(40,22,12,0.93)', stroke: 'rgba(255,214,140,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }], pins: null };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages ----------------------------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
export const pageCount = () => PAGE_COUNT;
function buildFlow(ctx, list, scale, PANEL) {
  const fs = Math.round(28 * scale), lh = fs * 1.28, tw = PANEL.w - 80, secFs = Math.round(34 * Math.min(scale, 1.3)), items = [];
  let y = 6;
  list.forEach((sec, si) => {
    if (si > 0) { items.push({ t: 'rule', y }); y += 20; }
    ctx.font = `700 ${secFs}px ${FONT}`;
    const tl = wrapLines(ctx, sec.title, tw);
    items.push({ t: 'title', tl, y }); y += tl.length * secFs * 1.2 + 16;
    if (sec.art && scale <= 2) { items.push({ t: 'art', art: sec.art, y }); y += 210; }
    ctx.font = `400 ${fs}px ${FONT}`;
    sec.p.forEach((para, pi) => { if (pi > 0) y += lh * 0.45; wrapLines(ctx, para, tw).forEach((l) => { items.push({ t: 'line', text: l, y }); y += lh; }); });
    y += 26;
  });
  return { items, fs, lh, secFs, total: y + 10 };
}
const pageCache = new Map();
export function renderPages(ctx, state, list, header) {
  backdrop(ctx, state, 0.7);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,241,220,0.97)', stroke: 'rgba(120,60,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.terraDark; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(120,60,30,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(120,60,30,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(120,60,30,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(120,60,30,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations ---------------------------------------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(40,20,10,0.8)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function floor(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e9bd62'); g.addColorStop(1, '#c88a2c'); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,12,0.6)'; ctx.lineWidth = 2; ctx.stroke(); ctx.strokeStyle = 'rgba(110,60,10,0.15)'; ctx.lineWidth = 1.5;
  for (let i = 1; i < 12; i++) { ctx.beginPath(); ctx.moveTo((w * i) / 12, 0); ctx.lineTo((w * i) / 12 + 8, h); ctx.stroke(); }
}
const ghost = (ctx, x, y, s, rot = 0) => { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.setLineDash([6, 5]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeRect(-s / 2, -s / 2, s, s); ctx.restore(); };

export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const pat = state.pat ?? 0, S = Math.min(h * 0.5, 96);
  const A = {
    tile() {
      floor(ctx, w, h);
      drawFlatTile(ctx, w * 0.3, h * 0.5, S * 1.5, pat, { rot: -0.1 }); drawFlatTile(ctx, w * 0.7, h * 0.5, S * 1.5, 0, { reverse: true, rot: 0.08 });
      label(ctx, 'printed face', w * 0.3, h - 14, 20); label(ctx, 'plain underside', w * 0.7, h - 14, 20);
    },
    flip() {
      floor(ctx, w, h);
      const xs = [w * 0.17, w * 0.5, w * 0.83];
      drawFlatTile(ctx, xs[0], h * 0.46, S, pat); ghost(ctx, xs[0] + S * 0.9, h * 0.72, S * 0.7, 0.2);
      ctx.save(); ctx.translate(xs[1], h * 0.46); ctx.scale(1, 0.55); drawFlatTile(ctx, 0, 0, S, pat); ctx.restore();
      arrow(ctx, xs[1] - 24, h * 0.22, xs[1] + 24, h * 0.22, '#7a2d0c', 4);
      drawFlatTile(ctx, xs[2], h * 0.46, S, 0, { reverse: true });
      label(ctx, 'slap beside it', xs[0], h - 14, 18); label(ctx, 'it tips up', xs[1], h - 14, 18); label(ctx, 'and lands flipped', xs[2], h - 14, 18);
    },
    aim() {
      floor(ctx, w, h);
      drawFlatTile(ctx, w * 0.5, h * 0.36, S, pat);
      ghost(ctx, w * 0.5, h * 0.36 + S * 1.1, S, 0.05);
      ctx.save(); ctx.setLineDash([5, 6]); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(w * 0.5, h * 0.36 + S * 1.1, S * 0.8, S * 0.62, 0, 0, TAU); ctx.stroke(); ctx.restore();
      arrow(ctx, w * 0.5, h - 18, w * 0.5, h * 0.36 + S * 1.65, '#7a2d0c', 5);
      tag(ctx, 'where your tile lands', w * 0.77, h * 0.36 + S * 1.1, '#fff6e2', 17); tag(ctx, 'scatter ring', w * 0.2, h * 0.36 + S * 1.5, '#ffe08a', 16);
    },
    power() {
      floor(ctx, w, h);
      const x0 = w * 0.1, x1 = w * 0.9, yy = h * 0.5;
      roundPath(ctx, x0, yy - 14, x1 - x0, 28, 14); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
      const cols = [['#d98a6a', 0, 0.4], ['#f0c25a', 0.4, 0.65], ['#7ad69b', 0.65, 0.88], ['#e0702e', 0.88, 1]];
      cols.forEach(([c, a, b]) => { ctx.fillStyle = c; ctx.fillRect(x0 + (x1 - x0) * a, yy - 14, (x1 - x0) * (b - a), 28); });
      tag(ctx, 'barely stirs', x0 + (x1 - x0) * 0.2, yy - 44, '#ffe9bf', 17); tag(ctx, 'wobble', x0 + (x1 - x0) * 0.52, yy - 44, '#ffe9bf', 17); tag(ctx, 'flip', x0 + (x1 - x0) * 0.76, yy - 44, '#9be8b0', 17); tag(ctx, 'scatters', x0 + (x1 - x0) * 0.94, yy - 44, '#ffb48a', 17);
      label(ctx, 'Strength', x0, yy + 56, 22, C.terraDark, 'left'); label(ctx, 'Twist turns the tile: more wind, less accuracy', w / 2, h - 18, 19);
    },
    pin() {
      floor(ctx, w, h);
      const cx = [w * 0.17, w * 0.5, w * 0.83], cy = h * 0.46;
      drawFlatTile(ctx, cx[0], cy, S, pat); ghost(ctx, cx[0] + S * 0.3, cy + S * 0.2, S, 0.1);
      drawFlatTile(ctx, cx[1], cy, S, pat); ghost(ctx, cx[1] + S * 1.0, cy + S * 1.1, S, 0.5);
      drawFlatTile(ctx, cx[2], cy - 20, S * 0.8, pat); ghost(ctx, cx[2], cy + S * 1.5, S * 0.8, 0);
      label(ctx, 'on top: pinned', cx[0], h - 14, 17); label(ctx, 'corner: weak', cx[1], h - 14, 17); label(ctx, 'too far: a miss', cx[2], h - 14, 17);
    },
    match() {
      floor(ctx, w, h);
      for (let i = 0; i < 3; i++) { drawFlatTile(ctx, w * 0.22 + i * S * 0.9, h * 0.38, S * 0.7, 0, { reverse: i < 2 }); }
      for (let i = 0; i < 3; i++) { drawFlatTile(ctx, w * 0.78 - i * S * 0.9, h * 0.38, S * 0.7, 1, { reverse: i < 1 }); }
      label(ctx, 'You: 2', w * 0.22 + S * 0.9, h * 0.72, 24, C.terraDark); label(ctx, 'Rival: 1', w * 0.78 - S * 0.9, h * 0.72, 24, '#1d5a8c'); label(ctx, 'first to 2 or 3 flips wins', w / 2, h - 14, 20);
    },
    fold() {
      floor(ctx, w, h);
      ctx.fillStyle = '#e0702e'; ctx.fillRect(w * 0.1, h * 0.3, S * 1.3, S * 1.3); label(ctx, 'sheet', w * 0.1 + S * 0.65, h - 14, 18);
      arrow(ctx, w * 0.1 + S * 1.5, h * 0.5, w * 0.1 + S * 2.1, h * 0.5, '#7a2d0c', 4);
      ctx.fillStyle = '#f1e5c4'; ctx.fillRect(w * 0.1 + S * 2.2, h * 0.4, S * 1.3, S * 0.65); label(ctx, 'half', w * 0.1 + S * 2.85, h - 14, 18);
      arrow(ctx, w * 0.1 + S * 3.7, h * 0.5, w * 0.1 + S * 4.2, h * 0.5, '#7a2d0c', 4);
      ctx.fillStyle = '#f1e5c4'; ctx.fillRect(w * 0.1 + S * 4.3, h * 0.45, S * 1.3, S * 0.33); label(ctx, 'strip', w * 0.1 + S * 4.95, h - 14, 18);
      drawFlatTile(ctx, w * 0.9, h * 0.45, S * 0.75, pat);
    },
    patterns() {
      floor(ctx, w, h);
      for (let i = 0; i < 12; i++) drawFlatTile(ctx, w * (0.09 + (i % 6) * 0.164), h * (0.3 + Math.floor(i / 6) * 0.42), S * 0.78, i, { shadow: true });
    },
  };
  (A[key] ?? A.tile)();
  ctx.restore();
}
