// Every screen that is not the play screen: title, settings, logbook, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawNetIcon, drawFishIcon, drawFishShape, PALS, WATER_PAL } from './art.js';
import { drawWorldState } from './view.js';
import { NETS, DEPTHS, SPECIES, WATERS, SEASONS, SESSION_CASTS, WIDE_OPEN, rankFor } from './sim.js';
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
export const bestOf = (rec) => Math.max(rec.bestCast, rec.bestDaily);
export const netOwned = (rec, i) => bestOf(rec) >= NETS[i].need;
export const waterOwned = (rec, i) => bestOf(rec) >= WATERS[i].need;
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t) => { let s = 118; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('Net Casting');
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(30,14,4,0.9)';
    ctx.strokeText('Bozo', cx, 120); ctx.strokeText('Net Casting', cx, 120 + s1 * 0.9);
    const g = ctx.createLinearGradient(0, 40, 0, 270); g.addColorStop(0, '#fff6d0'); g.addColorStop(0.5, '#ffd36a'); g.addColorStop(1, '#e0862a');
    ctx.fillStyle = g; ctx.fillText('Bozo', cx, 120); ctx.fillText('Net Casting', cx, 120 + s1 * 0.9);
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, 'Open the net over the river', cx, 120 + s1 * 0.9 + 52, '#ffeccc', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), wn = WATERS[rec.waterSel].name, sn = SEASONS[rec.seasonSel].name;
  const bs = rec.bestSession[rec.waterSel];
  wd.push({ t: 'btn', id: 'session', label: 'Cast Session', sub: bs ? `${wn} · ${sn} · best ${bs}` : `${wn} · ${sn} · six casts`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Water', sub: dk >= 0 ? `Today ${dk}` : 'A new river today', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Cast', sub: 'No score, just cast', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'collection', label: 'Logbook', row: 2 });
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
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe2b0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe2b0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.monetization?.owns?.('unlock_game') ? [{ t: 'p', label: 'Full game unlocked', bold: true, size: 26, color: '#bfffd0' }]
      : [{ t: 'btn', id: 'restore', label: state.restoreMsg === 'Checking with the store…' ? 'Checking…' : 'Restore purchase', dark: true }]),
    ...(state.restoreMsg && !state.monetization?.owns?.('unlock_game') ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe2b0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

const card = (ctx, x, y, w, h, sel) => {
  roundPath(ctx, x, y, w, h, 18); ctx.fillStyle = sel ? 'rgba(255,214,120,0.34)' : 'rgba(40,22,10,0.62)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = sel ? '#ffd36a' : 'rgba(255,230,180,0.3)'; ctx.stroke();
};
export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 14, cell = Math.min(200, Math.floor((w - gap * (cols - 1)) / cols));
  const fishH = 3 * (cell * 0.86 + gap) - gap;
  const fish = {
    t: 'art', h: fishH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'f');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2, ch = cell * 0.86;
      SPECIES.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (ch + gap), n = rec.species[i] | 0;
        card(ctx, x, y, cell, ch, sel && sel.kind === 'f' && sel.i === i);
        drawFishIcon(ctx, x + cell / 2, y + ch * 0.4, cell * 0.66, i, { shadow: false, rot: -0.12, sil: n ? null : 'rgba(20,10,4,0.85)' });
        ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n ? d.name : '?', x + cell / 2, y + ch - 30);
        ctx.fillStyle = '#ffd97a'; ctx.font = `700 ${Math.max(12, Math.round(cell * 0.09))}px ${FONT}`;
        ctx.fillText(n ? `${d.pts} pt · seen ${n}` : 'not seen yet', x + cell / 2, y + ch - 12);
        COLL.rects.push({ kind: 'f', i, x: at.x + x, y: at.y + y, w: cell, h: ch });
      });
    },
  };
  const netsH = 2 * (cell * 0.9 + gap) - gap;
  const nets = {
    t: 'art', h: netsH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'n');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2, ch = cell * 0.9;
      NETS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (ch + gap), has = netOwned(rec, i);
        card(ctx, x, y, cell, ch, sel && sel.kind === 'n' && sel.i === i);
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.35;
        drawNetIcon(ctx, x + cell / 2, y + ch * 0.4, cell * 0.3, i, { shadow: false });
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + ch * 0.4); }
        ctx.fillStyle = '#fff6e4'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.1))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + ch - 16);
        COLL.rects.push({ kind: 'n', i, x: at.x + x, y: at.y + y, w: cell, h: ch });
      });
    },
  };
  const yc = Math.round(cell * 0.62), yw = Math.floor((w - gap) / 2), yh = 2 * (yc + gap) - gap;
  const waters = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'w');
      WATERS.forEach((wt, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = waterOwned(rec, i), pal = PALS[WATER_PAL[i]];
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, pal.sky[0]); g.addColorStop(0.4, pal.sky[2]); g.addColorStop(0.41, pal.water[0]); g.addColorStop(1, pal.water[2]); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc);
        ctx.fillStyle = pal.bank[1]; ctx.beginPath(); ctx.moveTo(x, y + yc * 0.4); ctx.quadraticCurveTo(x + yw * 0.3, y + yc * 0.26, x + yw * 0.55, y + yc * 0.36); ctx.quadraticCurveTo(x + yw * 0.8, y + yc * 0.44, x + yw, y + yc * 0.3); ctx.lineTo(x + yw, y + yc * 0.41); ctx.lineTo(x, y + yc * 0.41); ctx.fill();
        ctx.fillStyle = `rgb(${pal.sun.c})`; ctx.beginPath(); ctx.arc(x + yw * pal.sun.x, y + yc * Math.min(0.34, pal.sun.y * 0.36), 8, 0, TAU); ctx.fill();
        if (!has) { ctx.fillStyle = 'rgba(20,10,4,0.6)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        const cur = rec.waterSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#ffd36a' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(13, Math.round(yw * 0.066))}px ${FONT}`;
        textShadow(ctx, has ? wt.name : `🔒 ${wt.name}`, x + yw / 2, y + yc - 18, '#fff6e4', 6);
        COLL.rects.push({ kind: 'w', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'f') { const d = SPECIES[sel.i]; info = rec.species[sel.i] ? `${d.name}: ${d.how} ${d.pts} ${d.pts === 1 ? 'point' : 'points'}; usually ${d.depth[0].toFixed(1)} to ${d.depth[1].toFixed(1)} m down.` : 'A fish you have not netted yet. Keep casting to find it.'; }
    else if (sel.kind === 'n') { const d = NETS[sel.i]; info = netOwned(rec, sel.i) ? `${d.name}: ${d.how}` : `${d.name}: cast ${d.need} points in one cast to unlock.`; }
    else { const d = WATERS[sel.i]; info = waterOwned(rec, sel.i) ? (rec.waterSel === sel.i ? `${d.name} is your water. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to fish here.`) : `${d.name}: cast ${d.need} points in one cast to unlock.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Logbook', size: 48 },
    { t: 'p', label: `${rec.species.filter((n) => n > 0).length} of ${SPECIES.length} kinds of fish seen`, bold: true, color: '#ffe2b0', size: 26 },
    fish,
    { t: 'p', label: 'Nets', bold: true, color: '#ffe2b0', size: 26 },
    nets,
    { t: 'p', label: 'Waters', bold: true, color: '#ffe2b0', size: 26 },
    waters,
    { t: 'p', label: 'Season', bold: true, color: '#ffe2b0', size: 26 },
    ...SEASONS.map((s) => ({ t: 'btn', id: `season-${s.id}`, label: s.name, sub: s.blurb, active: rec.seasonSel === s.id })),
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Calm waters' : r.newBest ? 'New best session!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: `${r.total}`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `points in ${r.casts.length} casts · ${r.fish} fish · best cast ${r.bestCast}`, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'art', h: wide ? 120 : 190, draw: (ctx, w, h) => drawCastBars(ctx, w, h, r) });
  } else {
    wd.push({ t: 'p', label: `${r.casts.length} casts · ${r.fish} fish · best cast ${r.bestCast}`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice session and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Logbook', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
function drawCastBars(ctx, w, h, r) {
  const n = r.casts.length, mx = Math.max(10, ...r.casts.map((t) => t.score));
  const bw = Math.min(70, (w - 20) / n - 10), x0 = (w - n * (bw + 10) + 10) / 2;
  r.casts.forEach((t, i) => {
    const x = x0 + i * (bw + 10), bh = Math.max(6, ((h - 46) * t.score) / mx), y = h - 26 - bh;
    roundPath(ctx, x, y, bw, bh, 10);
    const top = t.score === r.bestCast;
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, top ? '#ffd36a' : '#e8a45a'); g.addColorStop(1, top ? '#e09a2a' : '#a8561c'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(Math.min(26, bw * 0.46))}px ${FONT}`; ctx.fillText(String(t.score), x + bw / 2, y - 6);
    ctx.font = `600 ${Math.round(Math.min(15, bw * 0.24))}px ${FONT}`; ctx.fillStyle = '#ffe2b0'; ctx.fillText(t.wide ? 'wide' : `${t.count} fish`, x + bw / 2, h - 6);
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
    { t: 'p', label: 'You have played the free sessions of the web demo. The full game on iPhone and Android has every water, net and season, the daily water and unlimited play.', size: 28 },
    { t: 'gap', h: 20 },
    { t: 'btn', id: 'menu', label: 'Main menu', primary: true },
  ];
}

// ---- frames --------------------------------------------------------------------------------------------------------
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
  g.addColorStop(0, `rgba(24,12,6,${a * 0.7})`); g.addColorStop(0.5, `rgba(24,12,6,${a})`); g.addColorStop(1, `rgba(24,12,6,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(24,12,6,0)'); g.addColorStop(1, 'rgba(24,12,6,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#2a1a10'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: the river with a cast replaying on its own.
function attract(ctx, state, rect, dim = 0.2) {
  drawWorldState(ctx, rect, state.att, state.attPose);
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(30,14,6,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.06);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(30,14,4,0.6)'); g.addColorStop(1, 'rgba(30,14,4,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(30,14,6,0)'); g2.addColorStop(1, 'rgba(30,14,6,0.88)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    const hk = Math.max(0.72, Math.min(1, (fr.cols[0].top - top) / 540));      // squarer screens: a smaller title so the fisher shows
    ctx.save(); ctx.translate(W / 2 - 320 * hk, top); ctx.scale(hk, hk); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,210,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.1);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(30,14,4,0.6)'); g.addColorStop(1, 'rgba(30,14,4,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,238,210,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.56); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(48,26,12,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  backdrop(ctx, state, 0.72);
  const sc = TEXT_SCALES[state.settings.textIdx], RL = refLayout(), PANEL = RL.panel;
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(252,244,226,0.97)', stroke: 'rgba(80,40,10,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(80,40,10,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(80,40,10,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(80,40,10,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(80,40,10,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own nets and fish) ---------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e4', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(30,16,8,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#ffd36a', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, pi = 0) {
  const p = PALS[pi];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(0.3, p.sky[2]); g.addColorStop(0.32, p.water[0]); g.addColorStop(0.6, p.water[1]); g.addColorStop(1, p.water[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function ellipseRing(ctx, x, y, rx, ry, col, lw = 3, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.restore();
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, key === 'dart' ? 1 : key === 'swing' ? 2 : 0);
  const A = {
    river() {
      drawNetIcon(ctx, w * 0.5, h * 0.64, Math.min(w * 0.3, 190), 0, { flat: 0.34 });
      [[0.44, 0.62, 0], [0.5, 0.67, 0], [0.56, 0.62, 0], [0.5, 0.58, 0], [0.4, 0.68, 0]].forEach(([fx, fy], i) => drawFishIcon(ctx, w * fx, h * fy, 54, i === 3 ? 2 : 0, { shadow: false, rot: -0.3 + i * 0.4 }));
      tag(ctx, 'every fish inside the net counts', w * 0.5, h * 0.12, '#fff6e4', 19);
    },
    shoal() {
      for (let i = 0; i < 9; i++) drawFishIcon(ctx, w * (0.26 + 0.07 * (i % 5) + 0.02 * Math.floor(i / 5)), h * (0.56 + 0.09 * ((i * 3) % 4)), 46, 0, { shadow: false, rot: 0.12 * Math.sin(i) });
      ellipseRing(ctx, w * 0.36, h * 0.4, 20, 6, 'rgba(255,255,255,0.8)', 2.5); ellipseRing(ctx, w * 0.36, h * 0.4, 34, 10, 'rgba(255,255,255,0.45)', 2);
      arrow(ctx, w * 0.62, h * 0.7, w * 0.82, h * 0.6, '#ffd36a', 5);
      tag(ctx, 'drifting: aim a little ahead', w * 0.66, h * 0.86, '#ffd36a', 18);
      tag(ctx, 'rings show rising fish', w * 0.36, h * 0.18, '#fff6e4', 18);
    },
    tray() {
      [0, 1, 2].forEach((ni, i) => {
        const px = w * (0.06 + i * 0.32), pw = w * 0.28;
        roundPath(ctx, px, h * 0.1, pw, h * 0.56, 14); ctx.fillStyle = i === 1 ? 'rgba(255,246,222,0.98)' : 'rgba(250,243,228,0.92)'; ctx.fill();
        ctx.lineWidth = i === 1 ? 4 : 2; ctx.strokeStyle = i === 1 ? '#b8501c' : 'rgba(80,50,20,0.5)'; ctx.stroke();
        drawNetIcon(ctx, px + pw / 2, h * 0.3, pw * 0.3, ni, { shadow: false });
        label(ctx, NETS[ni].name, px + pw / 2, h * 0.56, Math.max(13, Math.round(h * 0.075)), C.ink);
      });
      DEPTHS.forEach((d, i) => {
        const sx = w * (0.18 + i * 0.27), sw = w * 0.24;
        roundPath(ctx, sx, h * 0.74, sw, h * 0.18, 12); ctx.fillStyle = i === 1 ? '#c85f22' : 'rgba(40,20,8,0.5)'; ctx.fill();
        label(ctx, d.name, sx + sw / 2, h * 0.86, Math.max(13, Math.round(h * 0.075)), '#fff6e4');
      });
    },
    swing() {
      const px = w * 0.08, pw = w * 0.84, py = h * 0.14, ph = h * 0.66;
      ctx.fillStyle = 'rgba(30,16,8,0.45)'; roundPath(ctx, px, py, pw, ph, 12); ctx.fill();
      ctx.fillStyle = 'rgba(125,255,176,0.28)'; ctx.fillRect(px, py, pw, ph * (1 - WIDE_OPEN));
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 60; i++) { const t = i / 60, v = 0.5 - 0.5 * Math.cos(t * TAU * 1.5); const X = px + pw * (0.04 + 0.92 * t), Y = py + ph - ph * v; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
      ctx.stroke();
      tag(ctx, 'closed', px + pw * 0.06, py + ph + 18, '#fff6e4', 16); tag(ctx, 'wide open: let go', px + pw * 0.34, py + 18, '#7dffb0', 16); tag(ctx, 'closed', px + pw * 0.66, py + ph + 18, '#fff6e4', 16);
    },
    flight() {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 7]); ctx.beginPath(); ctx.moveTo(w * 0.14, h * 0.5); ctx.quadraticCurveTo(w * 0.4, h * 0.02, w * 0.68, h * 0.62); ctx.stroke(); ctx.setLineDash([]);
      drawNetIcon(ctx, w * 0.72, h * 0.7, Math.min(w * 0.17, 100), 0, { flat: 0.34 });
      tag(ctx, `flies for half a second`, w * 0.4, h * 0.1, '#fff6e4', 18); tag(ctx, 'lands where the circle was', w * 0.7, h * 0.92, '#ffd36a', 17);
    },
    dart() {
      const cx = w * 0.5, cy = h * 0.5, R = Math.min(h * 0.3, 70);
      ellipseRing(ctx, cx, cy, R * 1.7, R * 1.7 * 0.5, '#fff', 2, [5, 6]);
      ellipseRing(ctx, cx, cy, R, R * 0.5, '#ffd36a', 4);
      [[-0.5, 0.1], [0.4, -0.2], [0.1, 0.5], [-0.2, -0.45], [0.7, 0.4]].forEach(([fx, fy], i) => {
        const X = cx + fx * R, Y = cy + fy * R * 0.5, dx = fx, dy = fy;
        drawFishIcon(ctx, X, Y, 36, i % 2 ? 1 : 0, { shadow: false, rot: Math.atan2(dy * 0.5, dx) });
        arrow(ctx, X, Y, X + dx * 40, Y + dy * 24, 'rgba(255,255,255,0.8)', 3);
      });
      tag(ctx, 'alarmed fish dart away from the centre', w * 0.5, h * 0.9, '#fff6e4', 17);
    },
    nets() {
      NETS.forEach((n, i) => {
        const c = i % 3, r = Math.floor(i / 3), px = w * (0.05 + c * 0.32), py = h * (0.06 + r * 0.48);
        drawNetIcon(ctx, px + w * 0.14, py + h * 0.17, w * 0.1 * (0.7 + 0.3 * n.R / 3), i, { shadow: false });
        label(ctx, n.name, px + w * 0.14, py + h * 0.4, Math.max(12, Math.round(h * 0.07)), '#fff6e4');
      });
    },
    fish() {
      SPECIES.forEach((s, i) => {
        const c = i % 4, r = Math.floor(i / 4), px = w * (0.04 + c * 0.24), py = h * (0.08 + r * 0.48);
        drawFishIcon(ctx, px + w * 0.11, py + h * 0.16, w * 0.15, i, { shadow: false });
        label(ctx, `${s.name} · ${s.pts}`, px + w * 0.11, py + h * 0.4, Math.max(11, Math.round(h * 0.062)), '#fff6e4');
      });
    },
  };
  (A[key] ?? A.river)();
  ctx.restore();
  void drawFishShape;
}
