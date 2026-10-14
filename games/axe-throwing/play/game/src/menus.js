// Every screen that is not the play screen: title, settings, collection, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp, boardRect } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { THEMES, drawAxe, drawAxeIcon, drawVenueThumb, drawBoardUnits, drawStuck, drawReticle } from './art.js';
import { drawScene } from './view.js';
import { GL } from './glbridge.js';
import { AXES, VENUES, LEVELS, RIVALS, ROUNDS, PER, BS, rankFor, axeOwned, venueOwned } from './sim.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
const COLL = { rects: [] };
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; COLL.rects = []; }
export const collectionHit = (x, y) => { for (const r of COLL.rects) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r; return null; };
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);
export const bestOf = (rec) => Math.max(rec.bestSession | 0, rec.bestDaily | 0);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t, s0) => { let s = s0; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('AXE', 150);
    ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(30,12,4,0.94)';
    ctx.strokeText('AXE', cx, 128);
    ctx.font = `italic 800 ${Math.round(s1 * 0.5)}px ${DISPLAY}`; ctx.strokeText('THROWING', cx, 128 + s1 * 0.5);
    ctx.font = `italic 800 ${s1}px ${DISPLAY}`;
    const g = ctx.createLinearGradient(0, 30, 0, 250); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, '#ffb43a'); g.addColorStop(1, '#c4561a');
    ctx.fillStyle = g; ctx.fillText('AXE', cx, 128);
    ctx.font = `italic 800 ${Math.round(s1 * 0.5)}px ${DISPLAY}`; ctx.fillText('THROWING', cx, 128 + s1 * 0.5);
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, 'Turn it once. Bite the bull.', cx, 128 + s1 * 0.5 + 44, '#ffe9c8', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state, compactLevel = false) {
  const tight = compactLevel === 2, compact = !!compactLevel;
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), vn = VENUES[rec.venueSel].name, lv = LEVELS[rec.level];
  wd.push({ t: 'btn', id: 'match', label: 'Play a Match', sub: `${vn} vs ${RIVALS[rec.venueSel].name}${rec.bestByVenue[rec.venueSel] ? ` · best ${rec.bestByVenue[rec.venueSel]}` : ''}`, primary: true, h: tight ? 62 : compact ? 76 : 92 });
  wd.push({ t: 'btn', id: 'venue', label: vn, sub: tight ? 'Change venue' : 'Tap to change venue', row: 9, h: tight ? 54 : compact ? 62 : undefined });
  wd.push({ t: 'btn', id: 'level', label: lv.name, sub: tight ? 'Change level' : 'Tap to change level', row: 9, h: tight ? 54 : compact ? 62 : undefined });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Round', sub: dk >= 0 ? `Today ${dk}` : 'Same lane for all', row: 1, h: tight ? 54 : compact ? 62 : undefined });
  wd.push({ t: 'btn', id: 'free', label: 'Free Practice', sub: tight ? 'No score' : 'No score, endless axes', row: 1, h: tight ? 54 : compact ? 62 : undefined });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'collection', label: 'Collection', row: 2, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4, h: tight ? 52 : compact ? 60 : undefined });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4, h: tight ? 52 : compact ? 60 : undefined });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe3b8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [state.owned
      ? { t: 'btn', id: 'restore', label: 'Full game unlocked', sub: 'Thank you for playing', disabled: true, dark: true }
      : { t: 'btn', id: 'restore', label: 'Restore purchase', sub: state.restoreBusy ? 'Checking with the store…' : 'Already bought it? Get it back', disabled: !!state.restoreBusy, dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe3b8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 2, gap = 16, cell = Math.min(250, Math.floor((w - gap * (cols - 1)) / cols)), shH = 2 * (cell * 0.82 + gap) - gap;
  const ch = Math.round(cell * 0.82);
  const axes = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'f');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      AXES.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (ch + gap), has = axeOwned(rec, i), cur = rec.axeSel === i;
        roundPath(ctx, x, y, cell, ch, 20); ctx.fillStyle = sel && sel.kind === 'f' && sel.i === i ? 'rgba(255,214,120,0.35)' : 'rgba(30,18,10,0.7)'; ctx.fill();
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd36a' : 'rgba(255,230,190,0.3)'; ctx.stroke();
        ctx.save(); ctx.beginPath(); ctx.rect(x + 4, y + 4, cell - 8, ch - 8); ctx.clip();
        drawAxeIcon(ctx, i, x + cell / 2, y + ch * 0.46, cell * 0.5, !has, -0.5);
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.round(cell * 0.18)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + ch * 0.42); }
        ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.085))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(has ? d.name : '???', x + cell / 2, y + ch - 30);
        ctx.font = `600 ${Math.max(11, Math.round(cell * 0.07))}px ${FONT}`; ctx.fillStyle = 'rgba(255,230,190,0.8)';
        ctx.fillText(has ? (cur ? 'In your hand' : 'Tap again to use') : `${d.need} axes stuck`, x + cell / 2, y + ch - 12);
        COLL.rects.push({ kind: 'f', i, x: at.x + x, y: at.y + y, w: cell, h: ch });
      });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - gap;
  const venues = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 't');
      VENUES.forEach((vn, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = venueOwned(rec, i);
        drawVenueThumb(ctx, i, x, y, yw, yc, state.t);
        if (!has) { ctx.fillStyle = 'rgba(8,6,6,0.62)'; roundPath(ctx, x, y, yw, yc, 14); ctx.fill(); }
        const cur = rec.venueSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd36a' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 14); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? vn.name : `🔒 ${vn.name}`, x + yw / 2, y + yc - 18, '#fff6e6', 6);
        COLL.rects.push({ kind: 't', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'f') { const d = AXES[sel.i]; info = axeOwned(rec, sel.i) ? `${d.name}: ${d.note}` : `${d.name}: stick ${d.need} axes in total to open it.`; }
    else { const d = VENUES[sel.i]; info = venueOwned(rec, sel.i) ? (rec.venueSel === sel.i ? `${d.name} is your venue. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to use it.`) : `${d.name}: win ${d.need} match${d.need === 1 ? '' : 'es'} to open it.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: 'Axes', bold: true, color: '#ffe3b8', size: 26 },
    axes,
    { t: 'p', label: 'Venues', bold: true, color: '#ffe3b8', size: 26 },
    venues,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const solo = r.mode === 'daily' || r.mode === 'free';
  const label = r.mode === 'free' ? 'Good practice' : solo ? (r.newBest ? 'New best!' : rankFor(r.total)) : r.draw ? 'A draw' : r.won ? (r.newBest ? 'You win: a new best!' : 'You win!') : 'Rival wins';
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: solo ? `${r.total}` : `${r.total} - ${r.rival}`, size: wide ? 76 : 100, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${solo ? '' : `against ${r.rivalName} · `}${r.sticks} of ${r.throws} axes stuck · ${r.bulls} bull${r.bulls === 1 ? '' : 's'}${r.clutch ? ` · ${r.clutch} clutch` : ''}`, size: 26, cap: big ? 2 : 3 });
  } else {
    wd.push({ t: 'p', label: `${r.sticks} of ${r.throws} axes stuck`, size: 26, cap: big ? 2 : 3 });
  }
  if (!big && r.rounds && r.rounds.length) wd.push({ t: 'art', h: wide ? 120 : 150, draw: (ctx, w, h) => drawRounds(ctx, w, h, r) });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice run and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
// Round by round totals as little bars.
function drawRounds(ctx, w, h, r) {
  roundPath(ctx, 0, 0, w, h, 18); ctx.fillStyle = 'rgba(22,14,8,0.7)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,150,0.3)'; ctx.stroke();
  const n = r.rounds.length, bw = Math.min(70, (w - 40) / Math.max(1, n) * 0.6), top = 28, base = h - 34, mx = Math.max(10, ...r.rounds.map((q) => Math.max(q.you, q.rival)));
  r.rounds.forEach((q, i) => {
    const cx = 20 + (i + 0.5) * ((w - 40) / n);
    const bar = (x, v, col) => { const bh = Math.max(3, (base - top) * (v / mx)); roundPath(ctx, x, base - bh, bw / 2 - 2, bh, 4); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.font = `700 ${Math.max(11, Math.round(h * 0.11))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(v), x + bw / 4 - 1, base - bh - 2); };
    bar(cx - bw / 2, q.you, '#ffb83a');
    if (r.mode === 'match' || r.mode === 'watch') bar(cx + 2, q.rival, '#35c9b6');
    ctx.fillStyle = 'rgba(255,230,190,0.85)'; ctx.font = `600 ${Math.max(11, Math.round(h * 0.1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(q.sd ? 'SD' : `R${i + 1}`, cx, base + 6);
  });
}

export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', row: 8, dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every venue, every axe, the daily round and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip;
      let wds = titleWidgets(state), btnH = flowLayout(estCtx, wds, sc, { x: 40, w: 640 }).contentH, minTop = host.t + 380;
      if (bottom - btnH < minTop) {   // not enough room: tighter buttons and a shorter hero so the whole menu is visible without scrolling
        const w2 = titleWidgets(state, true), h2 = flowLayout(estCtx, w2, sc, { x: 40, w: 640 }).contentH;
        if (h2 < btnH) { wds = { compact: true }; btnH = h2; minTop = host.t + 300; }
      }
      const colTop = Math.max(bottom - btnH, minTop), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 700) / 4));
      return { cols: [{ widgets: titleWidgets(state, wds.compact), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.42), 420, 680), x = W - host.r - 28 - cw, bot = H - host.b - 8 - lockSize(cw).strip, top0 = host.t + 8;
    let lvl = 0;
    for (const t of [0, 1, 2]) { lvl = t; if (flowLayout(estCtx, titleWidgets(state, t), sc, { x, w: cw }).contentH <= bot - top0) break; }
    return { cols: [{ widgets: titleWidgets(state, lvl), x, w: cw, top: top0, bottom: bot, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'collection') return { cols: [{ widgets: collectionWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'result') return { cols: [{ widgets: resultWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
  if (key === 'demolimit') return { cols: [{ widgets: demoLimitWidgets(state, L), x, w, top: Math.max(host.t, oy), bottom: H - host.b, center: L }] };
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
  LAID = { key, sig: sigOf(state), lay: cols[0].lay, top: cols[0].top, bottom: cols[0].bottom, h: cols[0].lay.contentH, cols };
  if (key === 'title') {
    const c = cols[cols.length - 1], ls = lockSize(c.w), used = c.top + c.lay.contentH, cx = c.x + c.w / 2;
    const pinned = H - host.b - ls.h - 12, y = Math.min(used + 12, pinned), m = 44 / Math.max(0.2, host.px || 0.6), tw = Math.max(ls.w + 24, m), th = Math.max(ls.h + 12, m);
    LAID.lock = { cx, y, w: ls.w, h: ls.h, tap: { x: cx - tw / 2, y: y - 4, w: tw, h: Math.max(th, ls.h + 8) } };
  }
  return cols;
}
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

// ---- drawing ---------------------------------------------------------------------------------------------------------------
function scrim(ctx, a = 0.55) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(20,12,8,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,12,8,${a})`); g.addColorStop(1, `rgba(20,12,8,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,12,8,0)'); g.addColorStop(1, 'rgba(20,12,8,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a24'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a24'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: a venue where the game throws a match on its own.
function attract(ctx, state, rect, dim = 0.2) {
  if (GL.on && rect.w >= W && rect.h < H * 0.8) rect = { x: 0, y: rect.y + 250, w: rect.w, h: Math.max(200, rect.h - 250) };   // 3D title: the lettering sits above the board
  const w = state.att, br = boardRect(rect.w >= W && rect.h >= H ? { x: 0, y: 0, w: W, h: H } : rect, VENUES[w.venue].rail);
  drawScene(ctx, rect, br, w, state.t, { noRet: true, noHand: false, kind: 'att' });
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(20,12,8,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(24,12,6,0.62)'); g.addColorStop(1, 'rgba(24,12,6,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(20,12,8,0)'); g2.addColorStop(1, 'rgba(20,12,8,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.14);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(24,12,6,0.62)'); g.addColorStop(1, 'rgba(24,12,6,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,220,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.64 : 0.58); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(36,22,12,0.95)', stroke: 'rgba(255,224,160,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }] };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages -----------------------------------------------------------------------------------------------------------
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
  backdrop(ctx, state, 0.74);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(252,244,226,0.97)', stroke: 'rgba(60,30,50,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(60,30,50,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,30,50,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,30,50,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,30,50,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own board and axes) --------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e6', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(20,12,6,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, th = 0) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, THEMES[th].wall[0]); g.addColorStop(1, THEMES[th].wall[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(30,20,10,0.6)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function boardAt(ctx, cx, cy, size, th = 0, axes = []) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size / BS, size / BS); drawBoardUnits(ctx, THEMES[th]);
  axes.forEach((a) => drawStuck(ctx, { ang: 0.1, side: 'you', ...a }, THEMES[th], 1));
  ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, key === 'venues' || key === 'levels' ? 1 : key === 'wind' ? 2 : 0);
  const bsz = Math.min(h * 0.86, w * 0.5);
  const A = {
    board() { boardAt(ctx, w * 0.5, h * 0.5, bsz, 0, [{ x: 0, y: -20 }, { x: -170, y: 120, side: 'rival' }]); tag(ctx, 'painted rings', w * 0.14, h * 0.2, '#fff6e6', 16); tag(ctx, '6 in the bull', w * 0.86, h * 0.85, '#ffd36a', 16); },
    rings() { boardAt(ctx, w * 0.5, h * 0.5, bsz, 0); tag(ctx, '6', w * 0.5, h * 0.5, '#ffd36a', 18); tag(ctx, '7 clutch', w * 0.5 + bsz * 0.4, h * 0.5 - bsz * 0.4, '#ffd36a', 14); tag(ctx, '4  3  2  1', w * 0.84, h * 0.5, '#fff6e6', 18); },
    aim() { boardAt(ctx, w * 0.5, h * 0.5, bsz, 0); drawReticle(ctx, w * 0.5 + 6, h * 0.5 + 2, 20); arrow(ctx, w * 0.8, h * 0.82, w * 0.58, h * 0.58, '#ffd36a', 5); tag(ctx, 'drag to aim', w * 0.82, h * 0.9, '#ffd36a', 18); tag(ctx, 'hand drifts', w * 0.16, h * 0.3, '#fff6e6', 16); },
    meter() {
      const bx = w * 0.08, bw = w * 0.84, by = h * 0.46, bh = 30;
      roundPath(ctx, bx, by, bw, bh, 15); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
      ctx.fillStyle = '#4fd07a'; ctx.fillRect(bx + bw * 0.42, by, bw * 0.16, bh);
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx + bw * 0.5 - 3, by - 8, 6, bh + 16);
      tag(ctx, 'green band = whole turns', w * 0.5, h * 0.2, '#9be8b0', 18); tag(ctx, 'slow', w * 0.1, h * 0.8, '#fff6e6', 16); tag(ctx, 'fast', w * 0.9, h * 0.8, '#fff6e6', 16); tag(ctx, 'let go here', w * 0.5, h * 0.84, '#ffd36a', 17);
    },
    wind() {
      boardAt(ctx, w * 0.55, h * 0.5, bsz * 0.9, 2);
      arrow(ctx, w * 0.08, h * 0.28, w * 0.28, h * 0.28, '#fff6e6', 5); tag(ctx, 'wind', w * 0.18, h * 0.14, '#fff6e6', 16);
      arrow(ctx, w * 0.74, h * 0.9, w * 0.9, h * 0.9, '#ffd36a', 4); tag(ctx, 'board slides', w * 0.8, h * 0.78, '#ffd36a', 15);
    },
    venues() { VENUES.forEach((v, i) => drawVenueThumb(ctx, i, w * (0.04 + i * 0.24), h * 0.14, w * 0.22, h * 0.7)); },
    axes() { AXES.forEach((a, i) => { drawAxeIcon(ctx, i, w * (0.14 + i * 0.24), h * 0.46, Math.min(h * 0.55, w * 0.18), false, -0.4); label(ctx, a.name.split(' ')[0], w * (0.14 + i * 0.24), h * 0.92, 15, '#fff6e6'); }); },
    levels() { LEVELS.forEach((l, i) => { label(ctx, l.name, w * (0.2 + i * 0.3), h * 0.4, 22, '#fff6e6'); label(ctx, `window ${l.win}`, w * (0.2 + i * 0.3), h * 0.62, 17, '#ffd36a'); label(ctx, `${l.period} s swing`, w * (0.2 + i * 0.3), h * 0.8, 16, '#fff6e6'); }); },
  };
  (A[key] ?? A.board)();
  ctx.restore();
}
void drawAxe; void ROUNDS; void PER; void clamp; void THINK_STEPS; void TAU;
