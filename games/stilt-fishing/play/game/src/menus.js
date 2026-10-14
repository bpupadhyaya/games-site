// Every screen that is not the play screen: title, settings, logbook, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawWorldState } from './view.js';
import { drawMiniFish, drawSeatMini, lightAt, sceneGeom } from './art.js';
import { SPECIES, SPOTS, rankFor, DAY_SECS } from './sim.js';
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
export const spotOwned = (rec, i) => rec.kg >= SPOTS[i].need;
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 270) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t) => { let s = 120; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('Stilt Fishing');
    ctx.lineWidth = 20; ctx.strokeStyle = 'rgba(40,12,6,0.88)';
    ctx.strokeText('Stilt', cx, 118); ctx.strokeText('Fishing', cx, 118 + s1 * 0.9);
    const g = ctx.createLinearGradient(0, 30, 0, 250); g.addColorStop(0, '#fff6d8'); g.addColorStop(0.5, '#ffc06a'); g.addColorStop(1, '#e8602a');
    ctx.fillStyle = g; ctx.fillText('Stilt', cx, 118); ctx.fillText('Fishing', cx, 118 + s1 * 0.9);
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, 'Keep your seat. Land the fish.', cx, 118 + s1 * 0.9 + 50, '#fff0d8', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), sn = SPOTS[rec.spotSel].name;
  wd.push({ t: 'btn', id: 'day', label: 'Day on the Stilt', sub: rec.bestDay[rec.spotSel] ? `${sn} · best ${rec.bestDay[rec.spotSel]}` : `${sn} · dawn to dusk`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Tide', sub: dk >= 0 ? `Today ${dk}` : 'A new sea today', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Fishing', sub: 'No clock, no score', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'logbook', label: 'Logbook', row: 2 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe3c0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#ffe3c0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe3c0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function logbookWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 14, cell = Math.min(200, Math.floor((w - gap * (cols - 1)) / cols)), shH = 3 * (Math.round(cell * 0.78) + gap) - gap;
  const ch = Math.round(cell * 0.78);
  const fish = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 's');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      SPECIES.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (ch + gap), n = rec.species[i].n;
        panel(ctx, x, y, cell, ch, { r: 18, fill: sel && sel.kind === 's' && sel.i === i ? 'rgba(90,70,30,0.9)' : 'rgba(10,26,50,0.72)', stroke: n ? 'rgba(255,214,140,0.6)' : 'rgba(255,255,255,0.25)', shadow: false });
        ctx.save(); ctx.globalAlpha = n ? 1 : 0.28;
        drawMiniFish(ctx, x + cell / 2, y + ch * 0.4, Math.min(cell * 0.7, 40 + d.cm[1] * 0.9), i, 1);
        ctx.restore();
        ctx.fillStyle = '#fff6e8'; ctx.font = `700 ${Math.max(12, Math.round(cell * 0.1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n ? d.name : '? ? ?', x + cell / 2, y + ch - 28);
        ctx.font = `600 ${Math.max(11, Math.round(cell * 0.088))}px ${FONT}`; ctx.fillStyle = '#ffd89a';
        ctx.fillText(n ? `${n} · best ${rec.species[i].best.toFixed(1)} kg` : 'not yet caught', x + cell / 2, y + ch - 11);
        COLL.rects.push({ kind: 's', i, x: at.x + x, y: at.y + y, w: cell, h: ch });
      });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - gap;
  const spots = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'p');
      SPOTS.forEach((pd, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = spotOwned(rec, i), L = lightAt((pd.tod[0] + pd.tod[1]) / 2, pd.storm);
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, L.sky[0]); g.addColorStop(0.3, L.sky[1]); g.addColorStop(0.42, L.sky[2]); g.addColorStop(0.43, L.near); g.addColorStop(1, L.deep); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc);
        ctx.fillStyle = '#2a1a10'; ctx.fillRect(x + yw * 0.2, y + yc * 0.22, 4, yc * 0.3);
        ctx.fillRect(x + yw * 0.2 - 9, y + yc * 0.22, 22, 3);
        if (!has) { ctx.fillStyle = 'rgba(8,16,36,0.6)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        const cur = rec.spotSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd36a' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? pd.name : `🔒 ${pd.name}`, x + yw / 2, y + yc - 18, '#fff6e8', 6);
        COLL.rects.push({ kind: 'p', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 's') { const d = SPECIES[sel.i], e = rec.species[sel.i]; info = e.n ? `${d.name}: ${d.note} ${d.kg[0]} to ${d.kg[1]} kg. Landed ${e.n}, best ${e.best.toFixed(2)} kg.` : `${d.name}: not yet caught. Look for it at ${SPOTS.filter((p) => p.mix[sel.i] > 0).map((p) => p.name).join(' or ')}.`; }
    else { const d = SPOTS[sel.i]; info = spotOwned(rec, sel.i) ? (rec.spotSel === sel.i ? `${d.name} is your spot. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to fish here.`) : `${d.name}: land ${d.need} kg of fish in total to open it. You have landed ${rec.kg.toFixed(1)} kg.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Logbook', size: 48 },
    { t: 'p', label: `${rec.kg.toFixed(1)} kg landed · ${rec.fish} fish released`, bold: true, color: '#ffe3c0', size: 26 },
    fish,
    { t: 'p', label: 'Spots', bold: true, color: '#ffe3c0', size: 26 },
    spots,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Calm waters' : r.newBest ? 'New best day!' : rankFor(r.points);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 40 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: `${r.points}`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `${r.kg.toFixed(1)} kg in ${r.count} fish${r.steady ? ` · steady seat bonus +${r.bonus}` : ` · fell in ${r.falls} time${r.falls === 1 ? '' : 's'}`}`, size: 26, cap: big ? 2 : 3 });
    if (!big && r.catches.length) wd.push({ t: 'art', h: wide ? 110 : 150, draw: (ctx, w, h) => drawCatchRow(ctx, w, h, r) });
  } else {
    wd.push({ t: 'p', label: `${r.count} fish · ${r.kg.toFixed(1)} kg landed and released`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.best) wd.push({ t: 'p', label: `Biggest: ${SPECIES[r.best.sp].name}, ${r.best.kg.toFixed(2)} kg`, size: 24, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice day and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Opened: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'logbook', label: 'Open the Logbook', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Fish again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
function drawCatchRow(ctx, w, h, r) {
  const list = r.catches.slice(0, 10), n = list.length;
  const mx = Math.max(...list.map((c) => c.kg), 1);
  const cw = Math.min(88, (w - 10) / n);
  const x0 = (w - n * cw) / 2;
  list.forEach((c, i) => {
    const len = Math.min(cw * 1.05, 26 + Math.sqrt(c.kg / mx) * (cw * 0.95));
    drawMiniFish(ctx, x0 + i * cw + cw / 2, h * 0.4, len, c.sp, 1);
    ctx.fillStyle = '#fff6e8'; ctx.font = `700 ${Math.max(11, Math.round(cw * 0.2))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(c.kg.toFixed(1), x0 + i * cw + cw / 2, h * 0.88);
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
    { t: 'p', label: 'You have played the free days of the web demo. The full game on iPhone and Android has every spot and fish, the daily tide and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------------
export function frameFor(state, key) {
  const sc = TEXT_SCALES[state.settings.textIdx], L = land();
  if (key === 'title') {
    if (!L) {
      const bottom = H - host.b - lockSize(600).strip, btnH = flowLayout(estCtx, titleWidgets(state), sc, { x: 40, w: 640 }).contentH;
      const colTop = Math.max(bottom - btnH, host.t + 380), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 700) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'logbook') return { cols: [{ widgets: logbookWidgets(state, w), x, w, top: host.t, bottom: H - host.b }] };
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
  g.addColorStop(0, `rgba(20,10,28,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,10,28,${a})`); g.addColorStop(1, `rgba(12,10,28,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(14,10,28,0)'); g.addColorStop(1, 'rgba(14,10,28,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2536'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2536'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: the sea with the game playing itself.
function attract(ctx, state, rect, dim = 0.2) {
  if (rect.y > 0) { ctx.fillStyle = lightAt(state.att.rig.tod, SPOTS[state.att.rig.spot].storm).sky[0]; ctx.fillRect(0, 0, W, rect.y + 1); }
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  drawWorldState(ctx, rect, state.att);
  ctx.restore();
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(14,10,36,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: Math.round(top + 215), w: W, h: H - Math.round(top + 215) }, 0.08);
    const g = ctx.createRadialGradient(W / 2, top + 140, 40, W / 2, top + 140, 430); g.addColorStop(0, 'rgba(30,8,10,0.55)'); g.addColorStop(1, 'rgba(30,8,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(10,12,34,0)'); g2.addColorStop(1, 'rgba(10,12,34,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,220,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const g0 = sceneGeom(fullRect()), left = Math.min(fr.hero.x1 - 300, Math.max(fr.hero.x0, g0.poleX + 130 * g0.k));
  const hx = (left + fr.hero.x1) / 2, hw = fr.hero.x1 - left;
  attract(ctx, state, fullRect(), 0.1);
  const g = ctx.createRadialGradient(hx, 140, 30, hx, 140, 360); g.addColorStop(0, 'rgba(30,8,10,0.55)'); g.addColorStop(1, 'rgba(30,8,10,0)'); ctx.fillStyle = g; ctx.fillRect(hx - 420, 0, 840, 560);
  const g3 = ctx.createLinearGradient(fr.cols[0].x - 60, 0, fr.cols[0].x, 0); g3.addColorStop(0, 'rgba(10,12,34,0)'); g3.addColorStop(1, 'rgba(10,12,34,0.7)'); ctx.fillStyle = g3; ctx.fillRect(fr.cols[0].x - 60, 0, W - fr.cols[0].x + 60, H);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,220,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'settings'); }
export function renderLogbook(ctx, state) { backdrop(ctx, state, 0.8); drawFlowScreen(ctx, state, 'logbook'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.7 : 0.68); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(30,24,52,0.95)', stroke: 'rgba(255,214,150,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,242,226,0.97)', stroke: 'rgba(70,40,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(70,40,30,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(70,40,30,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = '#b8431c'; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(70,40,30,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(70,40,30,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own fish and stilt) -------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e8', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  panel(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, { r: size * 0.7, fill: 'rgba(10,26,48,0.9)', stroke: 'rgba(255,214,140,0.45)' });
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, tod = 0.18) {
  const L = lightAt(tod, false), sy = h * 0.46;
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, sy); g.addColorStop(0, L.sky[0]); g.addColorStop(0.7, L.sky[1]); g.addColorStop(1, L.sky[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, sy);
  const wg = ctx.createLinearGradient(0, sy, 0, h); wg.addColorStop(0, L.top); wg.addColorStop(1, L.deep); ctx.fillStyle = wg; ctx.fillRect(0, sy, w, h - sy);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
  ctx.restore(); ctx.strokeStyle = 'rgba(30,50,80,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
  return sy;
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
  const sy = panelBg(ctx, w, h, key === 'fight' ? 0.5 : 0.18);
  const px = w * 0.2, k = Math.min(h / 330, 0.62);
  const stilt = (lean = 0) => { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(px - 5 * k, sy - 20 * k, 10 * k, h); return drawSeatMini(ctx, px, sy - 75 * k, k, lean, 0.18); };
  const A = {
    scene() {
      stilt(0.05);
      drawMiniFish(ctx, w * 0.62, h * 0.72, 70, 4, -1); drawMiniFish(ctx, w * 0.82, h * 0.6, 44, 1, 1); drawMiniFish(ctx, w * 0.45, h * 0.86, 36, 0, -1);
      tag(ctx, 'a seat on a pole in the surf', w * 0.6, h * 0.2, '#fff6e8', 19);
    },
    balance() {
      stilt(-0.35);
      arrow(ctx, w * 0.8, sy - 14, w * 0.5, sy - 14, '#ffd36a', 5);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.62, sy); ctx.quadraticCurveTo(w * 0.78, sy - 34, w * 0.9, sy); ctx.stroke();
      tag(ctx, 'swell pushes you toward the shore', w * 0.64, h * 0.12, '#fff6e8', 18);
      tag(ctx, 'lean into it', w * 0.5, h * 0.9, '#ffd36a', 20);
    },
    cast() {
      stilt(0.05);
      drawMiniFish(ctx, w * 0.7, h * 0.74, 64, 2, -1);
      ctx.setLineDash([6, 6]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.28, sy - 50 * k); ctx.quadraticCurveTo(w * 0.5, sy - 120 * k, w * 0.7, h * 0.72); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.74, 44, 0, TAU); ctx.stroke();
      tag(ctx, 'tap here', w * 0.7, h * 0.52, '#ffd36a', 20);
    },
    strike() {
      for (let i = 0; i < 2; i++) {
        const cx = w * (0.3 + i * 0.4);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, h * 0.04); ctx.lineTo(cx, sy + (i ? 20 : 0)); ctx.stroke();
        ctx.fillStyle = i ? '#ffd75a' : '#ff5a3c'; ctx.beginPath(); ctx.ellipse(cx, sy + (i ? 16 : -6), 7, 12, 0, 0, TAU); ctx.fill();
        label(ctx, i ? 'dives: press!' : 'bobs: wait', cx, h * 0.28, 18, '#fff6e8');
      }
      drawMiniFish(ctx, w * 0.74, h * 0.76, 64, 3, -1);
    },
    fight() {
      const gx = w * 0.12, gh = h * 0.78, gy = h * 0.1, gw = 34;
      roundPath(ctx, gx, gy, gw, gh, 17); ctx.fillStyle = 'rgba(8,22,44,0.7)'; ctx.fill();
      ctx.fillStyle = 'rgba(240,90,70,0.7)'; ctx.fillRect(gx + 3, gy + 4, gw - 6, gh * 0.28);
      ctx.fillStyle = 'rgba(90,210,160,0.7)'; ctx.fillRect(gx + 3, gy + 4 + gh * 0.28, gw - 6, gh * 0.37);
      ctx.fillStyle = '#fff'; ctx.fillRect(gx - 6, gy + gh * 0.52, gw + 12, 4);
      tag(ctx, 'too tight: let go', gx + 190, gy + gh * 0.14, '#ffb090', 19);
      tag(ctx, 'green: reel', gx + 150, gy + gh * 0.5, '#9be8b0', 19);
      tag(ctx, 'slack: reel more', gx + 190, gy + gh * 0.82, '#fff6e8', 19);
      drawMiniFish(ctx, w * 0.78, h * 0.5, 100, 5, -1);
    },
    fish() {
      SPECIES.forEach((s, i) => {
        const c = i % 3, r = Math.floor(i / 3), cx = w * (0.18 + c * 0.32), cy = h * (0.2 + r * 0.3);
        drawMiniFish(ctx, cx, cy, Math.min(w * 0.2, 30 + s.cm[1] * 0.6), i, 1);
        label(ctx, s.name.split(' ')[0], cx, cy + h * 0.13, Math.max(12, Math.round(h * 0.07)), '#fff6e8');
      });
    },
  };
  (A[key] ?? A.scene)();
  ctx.restore();
  void state; void DAY_SECS;
}
