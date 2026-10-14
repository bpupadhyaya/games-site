// Every screen that is not the play screen: title, settings, collection, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { PALS, drawBoard, drawRider } from './art.js';
import { drawWorldState } from './view.js';
import { BOARDS, BEACHES, RIDES_PER_SESSION, rankFor, rideRank } from './sim.js';
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

// ---- widgets ---------------------------------------------------------------------------------------------------------
export const bestOf = (rec) => rec.bestRide;
export const boardOwned = (rec, i) => bestOf(rec) >= BOARDS[i].need;
export const beachOwned = (rec, i) => bestOf(rec) >= BEACHES[i].need;
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t) => { let s = 120; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = Math.min(fit('Wave'), fit('Riding'));
    ctx.font = `italic 800 ${s1}px ${DISPLAY}`;
    const y1 = 128, y2 = 128 + s1 * 0.86;
    // real lettering: a deep extrusion, a dark outline, a water-gradient face with a rim light and a glow, foam droplets
    const lines = [['Wave', y1], ['Riding', y2]];
    ctx.save();
    ctx.shadowColor = 'rgba(40,200,255,0.55)'; ctx.shadowBlur = 30; ctx.fillStyle = '#04223f';
    for (const [t, y] of lines) ctx.fillText(t, cx, y + 10);
    ctx.restore();
    for (let d = 16; d >= 1; d--) {
      const k = d / 16;
      ctx.fillStyle = `rgb(${Math.round(3 + 8 * (1 - k))},${Math.round(30 + 60 * (1 - k))},${Math.round(70 + 70 * (1 - k))})`;
      for (const [t, y] of lines) ctx.fillText(t, cx, y + d * 0.8);
    }
    ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(3,26,58,0.96)';
    for (const [t, y] of lines) ctx.strokeText(t, cx, y);
    const g = ctx.createLinearGradient(0, 40, 0, 270); g.addColorStop(0, '#ffffff'); g.addColorStop(0.3, '#d8fff6'); g.addColorStop(0.6, '#4fe0cf'); g.addColorStop(1, '#168fc0');
    ctx.fillStyle = g;
    for (const [t, y] of lines) ctx.fillText(t, cx, y);
    // rim light on the top edges and a darker lower edge, so the letters read as a solid lit shape
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    for (const [t, y] of lines) ctx.strokeText(t, cx, y - 2);
    ctx.save(); ctx.globalAlpha = 0.35; ctx.lineWidth = 3; ctx.strokeStyle = '#0a4a78';
    for (const [t, y] of lines) ctx.strokeText(t, cx, y + 3);
    ctx.restore();
    // foam spray caught on the lettering
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const hx = ((Math.sin(i * 12.9898) * 43758.5) % 1 + 1) % 1, hy = ((Math.sin(i * 78.233) * 12543.7) % 1 + 1) % 1;
      ctx.globalAlpha = 0.5 + 0.5 * hy; ctx.beginPath(); ctx.arc(cx - w * 0.42 + hx * w * 0.84, 28 + hy * 40, 2 + 3 * hx, 0, 6.3); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = `700 26px ${FONT}`; textShadow(ctx, 'Carve the face. Beat the foam.', cx, y2 + 50, '#e6fbff', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), bn = BEACHES[rec.beachSel].name;
  wd.push({ t: 'btn', id: 'session', label: 'Surf Session', sub: rec.bestSession[rec.beachSel] ? `${bn} · best ${fmt(rec.bestSession[rec.beachSel])}` : `${bn} · three waves`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Break', sub: dk >= 0 ? `Today ${fmt(dk)}` : 'New waves today', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Ride', sub: 'No score, just ride', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'collection', label: 'Boards & Beaches', row: 2 });
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
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#cfe9fb', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]}\u00a0s`, bold: true, color: '#cfe9fb', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#cfe9fb' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 2, gap = 16, cw = Math.floor((w - gap) / 2), ch = Math.round(cw * 0.62);
  const boards = {
    t: 'art', h: 2 * (ch + gap) - gap,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 's');
      BOARDS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = c * (cw + gap), y = r * (ch + gap), has = boardOwned(rec, i), cur = rec.boardSel === i;
        roundPath(ctx, x, y, cw, ch, 20); ctx.fillStyle = sel && sel.kind === 's' && sel.i === i ? 'rgba(255,214,120,0.35)' : 'rgba(10,26,50,0.6)'; ctx.fill();
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#7fe8d0' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.35; ctx.translate(x + cw / 2, y + ch * 0.42); ctx.rotate(-0.12);
        drawBoard(ctx, cw * 0.74, Math.max(7, cw * 0.05), d.col); ctx.restore();
        ctx.fillStyle = '#f4fbff'; ctx.font = `700 ${Math.max(14, Math.round(cw * 0.085))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(has ? d.name : `🔒 ${d.name}`, x + cw / 2, y + ch - 20);
        COLL.rects.push({ kind: 's', i, x: at.x + x, y: at.y + y, w: cw, h: ch });
      });
    },
  };
  const beaches = {
    t: 'art', h: 2 * (ch + gap) - gap,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'p');
      BEACHES.forEach((bd, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = c * (cw + gap), y = r * (ch + gap), has = beachOwned(rec, i), pal = PALS[i];
        ctx.save(); roundPath(ctx, x, y, cw, ch, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + ch); g.addColorStop(0, pal.sky[0]); g.addColorStop(0.35, pal.sky[1]); g.addColorStop(0.5, pal.sky[2]); g.addColorStop(0.51, pal.far[0]); g.addColorStop(1, pal.far[1]); ctx.fillStyle = g; ctx.fillRect(x, y, cw, ch);
        // a little wave
        const fg = ctx.createLinearGradient(0, y + ch * 0.3, 0, y + ch); fg.addColorStop(0, pal.face[0]); fg.addColorStop(0.4, pal.face[1]); fg.addColorStop(1, pal.face[3]);
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x, y + ch); ctx.lineTo(x, y + ch * 0.55); ctx.quadraticCurveTo(x + cw * 0.3, y + ch * 0.28, x + cw * 0.6, y + ch * 0.42); ctx.quadraticCurveTo(x + cw * 0.85, y + ch * 0.55, x + cw, y + ch * 0.62); ctx.lineTo(x + cw, y + ch); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x + cw * 0.18, y + ch * 0.62, cw * 0.18, ch * 0.1, 0, 0, TAU); ctx.fill();
        if (!has) { ctx.fillStyle = 'rgba(8,16,36,0.6)'; ctx.fillRect(x, y, cw, ch); }
        ctx.restore();
        const cur = rec.beachSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#7fe8d0' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, cw, ch, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(cw * 0.085))}px ${FONT}`;
        textShadow(ctx, has ? bd.name : `🔒 ${bd.name}`, x + cw / 2, y + ch - 20, '#f4fbff', 6);
        COLL.rects.push({ kind: 'p', i, x: at.x + x, y: at.y + y, w: cw, h: ch });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 's') { const d = BOARDS[sel.i]; info = boardOwned(rec, sel.i) ? (rec.boardSel === sel.i ? `${d.name} is your board. ${d.how}` : `${d.name}: ${d.how} Tap again to ride it.`) : `${d.name}: score ${fmt(d.need)} points in one ride to unlock.`; }
    else { const d = BEACHES[sel.i]; info = beachOwned(rec, sel.i) ? (rec.beachSel === sel.i ? `${d.name} is your beach. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to surf here.`) : `${d.name}: score ${fmt(d.need)} points in one ride to unlock.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Boards & Beaches', size: 46 },
    { t: 'p', label: 'Boards', bold: true, color: '#cfe9fb', size: 26 },
    boards,
    { t: 'p', label: 'Beaches', bold: true, color: '#cfe9fb', size: 26 },
    beaches,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Good vibes' : r.newBest ? 'New best session!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  const longest = Math.max(0, ...r.rides.map((x) => x.dist)), tube = r.rides.reduce((a, x) => a + x.tube, 0);
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: fmt(r.total), size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `points over ${r.rides.length} waves · best ride ${fmt(r.best)} · longest ${longest} m · ${tube.toFixed(1)} s in the tube`, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'art', h: wide ? 120 : 190, draw: (ctx, w, h) => drawRideBars(ctx, w, h, r) });
  } else {
    wd.push({ t: 'p', label: `${r.rides.length} waves · best ride ${fmt(r.best)} · longest ${longest} m`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice session and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open Boards & Beaches', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Ride again', primary: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
function drawRideBars(ctx, w, h, r) {
  const n = r.rides.length, mx = Math.max(1000, ...r.rides.map((t) => t.score));
  const bw = Math.min(110, (w - 20) / n - 14), x0 = (w - n * (bw + 14) + 14) / 2;
  r.rides.forEach((t, i) => {
    const x = x0 + i * (bw + 14), bh = Math.max(8, ((h - 66) * t.score) / mx), y = h - 28 - bh, best = t.score === r.best;
    roundPath(ctx, x, y, bw, bh, 12);
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, best ? '#ffd36a' : '#57d6c3'); g.addColorStop(1, best ? '#e09a2a' : '#1d7f90'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(Math.min(26, bw * 0.26))}px ${FONT}`; ctx.fillText(fmt(t.score), x + bw / 2, y - 6);
    ctx.font = `600 ${Math.round(Math.min(16, bw * 0.17))}px ${FONT}`; ctx.fillStyle = '#cfe9fb'; ctx.fillText(t.wiped ? 'wipeout' : rideRank(t.score), x + bw / 2, h - 7);
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
    { t: 'p', label: 'You have played the free sessions of the web demo. The full game on iPhone and Android has every beach and board, the daily break and unlimited play.', size: 28 },
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
  g.addColorStop(0, `rgba(10,14,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(10,14,34,${a})`); g.addColorStop(1, `rgba(10,14,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(10,14,34,0)'); g.addColorStop(1, 'rgba(10,14,34,0.7)');
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

// The living background of the menus: a rider on a wave.
function attract(ctx, state, rect, dim = 0.2) {
  drawWorldState(ctx, rect, state.att);
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(10,14,36,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.06);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(6,16,40,0.6)'); g.addColorStop(1, 'rgba(6,16,40,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(6,16,36,0)'); g2.addColorStop(1, 'rgba(6,16,36,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(220,238,255,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  { const pal = PALS[state.att.beach], pg = ctx.createLinearGradient(0, 0, 0, H); pg.addColorStop(0, pal.sky[0]); pg.addColorStop(0.5, pal.face[3]); pg.addColorStop(1, pal.deep); ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H); }
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.1);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(6,16,40,0.6)'); g.addColorStop(1, 'rgba(6,16,40,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(220,238,255,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
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
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(24,32,58,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(248,242,226,0.97)', stroke: 'rgba(40,50,90,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(40,50,90,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(40,50,90,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(40,50,90,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(40,50,90,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}


// ---- illustrations (drawn with the game's own boards and sea) ----------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#f4fbff', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(10,26,48,0.84)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#f0b44c', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
// The sea backdrop: sky, a wave wall that is tall on the left and tapers right, and foam on the left.
function seaBg(ctx, w, h, pi = 0, o = {}) {
  const p = PALS[pi];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(0.4, p.sky[1]); g.addColorStop(0.5, p.sky[2]); g.addColorStop(0.51, p.far[0]); g.addColorStop(1, p.far[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const top = (x) => h * (0.2 + 0.2 * (x / w));
  const fg = ctx.createLinearGradient(0, h * 0.2, 0, h); fg.addColorStop(0, p.face[0]); fg.addColorStop(0.3, p.face[1]); fg.addColorStop(0.7, p.face[2]); fg.addColorStop(1, p.face[3]);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 8) ctx.lineTo(x, top(x));
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 2;
  for (let j = 1; j < 6; j++) { ctx.beginPath(); for (let x = 0; x <= w; x += 8) { const y = top(x) + (h - top(x)) * (j / 7) + Math.sin(x * 0.05 + j) * 3; if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke(); }
  if (o.foam !== false) {
    ctx.fillStyle = '#f2fbff'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * 0.4);
    for (let x = 0; x <= w * 0.2; x += 8) ctx.lineTo(x, h * 0.4 + Math.sin(x * 0.2) * 5);
    ctx.lineTo(w * 0.2, h); ctx.fill();
  }
  ctx.restore(); ctx.strokeStyle = 'rgba(30,50,80,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
  return top;
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  const live = key === 'wave' || key === 'line' || key === 'steer';
  let top = () => h * 0.4;
  if (live && state && state.att) {
    // the real sea: the same drawing as the game, a rider on a wave, animated
    ctx.save(); roundPath(ctx, 0, 0, w, h, 16); ctx.clip();
    drawWorldState(ctx, { x: 0, y: 0, w, h }, state.att, { line: key === 'line', fill: 1.55, base: 0.93 });
    ctx.restore();
    ctx.strokeStyle = 'rgba(30,50,80,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
  } else top = seaBg(ctx, w, h, key === 'beaches' ? 2 : 0, { foam: key !== 'line' });
  const rider = (cx, cy, size, board = 0, pose = {}) => drawRider(ctx, cx, cy, size, { mode: 'ride', crouch: 0.5, ...pose }, board, 0);
  const A = {
    wave() {
      tag(ctx, 'the foam chases from the left', w * 0.24, h * 0.14, '#f4fbff', 17);
      tag(ctx, 'the wall stretches ahead', w * 0.74, h * 0.14, '#f4fbff', 17);
    },
    line() {
      tag(ctx, 'pass through the glints to build a combo', w * 0.5, h * 0.12, '#f4fbff', 17);
    },
    steer() {
      const cx = w * 0.84;
      arrow(ctx, cx, h * 0.78, cx, h * 0.3, '#ffe58a', 7);
      tag(ctx, 'drag up: climb the face', w * 0.7, h * 0.14, '#f4fbff', 17);
      tag(ctx, 'drag down: drop to the trough', w * 0.66, h * 0.9, '#f4fbff', 17);
    },
    meter() {
      const mx = w * 0.06, mw = w * 0.88, my = h * 0.42, mh = h * 0.2;
      const zones = [[0, 0.1, '#e0503e'], [0.1, 0.22, '#27b6c4'], [0.22, 0.4, '#3fcf7a'], [0.4, 1, '#8fa6bd']];
      zones.forEach(([a, b, c]) => { ctx.fillStyle = c; ctx.fillRect(mx + mw * a, my, mw * (b - a), mh); });
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundPath(ctx, mx, my, mw, mh, mh / 2); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + mw * 0.3, my + mh / 2, mh * 0.4, 0, TAU); ctx.fill();
      label(ctx, 'FOAM', mx + 6, my - 10, 15, '#f4fbff', 'left'); label(ctx, 'TUBE', mx + mw * 0.16, my + mh + 22, 15, '#f4fbff'); label(ctx, 'POCKET', mx + mw * 0.31, my + mh + 22, 15, '#f4fbff'); label(ctx, 'OPEN WATER', mx + mw * 0.72, my + mh + 22, 15, '#f4fbff');
    },
    tube() {
      ctx.fillStyle = 'rgba(2,30,60,0.78)'; ctx.beginPath(); ctx.ellipse(w * 0.45, h * 0.6, w * 0.3, h * 0.34, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(w * 0.45, h * 0.6, w * 0.3, h * 0.34, 0, Math.PI * 1.02, Math.PI * 1.95); ctx.stroke();
      rider(w * 0.5, h * 0.82, h * 0.42, 1, { crouch: 0.9 });
      tag(ctx, 'sit low, close to the foam', w * 0.5, h * 0.12, '#8ff0ff', 17);
    },
    burst() {
      ctx.fillStyle = '#f2fbff'; roundPath(ctx, w * 0.54, h * 0.5, w * 0.14, h * 0.5, 14); ctx.fill();
      rider(w * 0.28, h * 0.8, h * 0.4, 0, { crouch: 0.5 });
      arrow(ctx, w * 0.36, h * 0.55, w * 0.62, h * 0.3, '#ffe58a', 5);
      tag(ctx, 'foam burst low: climb over it', w * 0.55, h * 0.14, '#f4fbff', 17);
    },
    air() {
      ctx.strokeStyle = '#ffe58a'; ctx.setLineDash([3, 9]); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.15, h * 0.75); ctx.quadraticCurveTo(w * 0.4, h * 0.05, w * 0.5, h * 0.3); ctx.quadraticCurveTo(w * 0.62, h * 0.6, w * 0.85, h * 0.75); ctx.stroke(); ctx.setLineDash([]);
      rider(w * 0.5, h * 0.52, h * 0.34, 2, { crouch: 0.3, yaw: 60 });
      tag(ctx, 'flick sideways to spin', w * 0.5, h * 0.9, '#f4fbff', 17);
    },
    paddle() {
      ctx.strokeStyle = '#7dffb0'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.3, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, h * 0.44, 0, TAU); ctx.stroke();
      drawRider(ctx, w * 0.5, h * 0.58, h * 0.4, { mode: 'paddle', stroke: 0.4 }, 0, 0);
      tag(ctx, 'tap to paddle, tap in the green ring', w * 0.5, h * 0.92, '#f4fbff', 17);
    },
    boards() {
      BOARDS.forEach((b, i) => { const cx = w * (0.25 + (i % 2) * 0.5), cy = h * (0.28 + Math.floor(i / 2) * 0.44); ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.1); drawBoard(ctx, w * 0.36, 8, b.col); ctx.restore(); label(ctx, b.name, cx, cy + 34, 17, '#f4fbff'); });
    },
    beaches() {
      label(ctx, BEACHES.map((b) => b.name).join(' · '), w / 2, h * 0.5, 18, '#f4fbff');
    },
  };
  (A[key] ?? A.wave)();
  ctx.restore();
  void state;
}
