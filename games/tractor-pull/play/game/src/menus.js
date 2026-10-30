// Every screen that is not the play screen: title, settings, garage, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawRigProfile, PALS } from './art.js';
import { drawWorldState, drawDial } from './view.js';
import { RIGS, GROUNDS, SESSION_PULLS, TRACK_FT, SLIP_GOOD, LIFT_WARN, rankFor } from './sim.js';
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
export const rigOwned = (rec, i) => rec.lifeFt >= RIGS[i].need;
export const groundOwned = (rec, i) => rec.lifeFt >= GROUNDS[i].need;
export const bestOf = (rec) => Math.max(rec.bestPull, rec.bestDaily);
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    // Embossed title: a stack of dark extrusion layers, a bevel (light top-left, dark bottom-right), a metal-gold face and a moving glint.
    const cx = w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    const fit = (t) => { let s = 124; ctx.font = `italic 800 ${s}px ${DISPLAY}`; while (ctx.measureText(t).width > w - 20 && s > 50) { s -= 4; ctx.font = `italic 800 ${s}px ${DISPLAY}`; } return s; };
    const s1 = fit('Tractor'), y1 = 130, y2 = 130 + s1 * 0.86;
    const word = (t, y) => {
      // soft ground shadow
      ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#000'; ctx.filter = 'blur(6px)'; for (let d = 6; d < 20; d += 4) ctx.fillText(t, cx + 6, y + d); ctx.restore();
      ctx.lineWidth = 24; ctx.strokeStyle = 'rgba(26,8,2,0.96)'; ctx.strokeText(t, cx, y);
      // extrusion
      for (let d = 9; d >= 1; d--) { ctx.fillStyle = d > 6 ? '#3a0f06' : d > 3 ? '#6a1d0c' : '#8e2c12'; ctx.fillText(t, cx, y + d); }
      // face
      const g = ctx.createLinearGradient(0, y - s1 * 0.8, 0, y + 4);
      g.addColorStop(0, '#fffbe0'); g.addColorStop(0.28, '#ffe27a'); g.addColorStop(0.55, '#f2a528'); g.addColorStop(0.8, '#e0661c'); g.addColorStop(1, '#b8340f');
      ctx.fillStyle = g; ctx.fillText(t, cx, y);
      // bevel highlights
      ctx.save(); ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.translate(-1.2, -1.4); ctx.strokeText(t, cx, y); ctx.restore();
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(70,16,0,0.55)'; ctx.translate(1.2, 1.6); ctx.strokeText(t, cx, y); ctx.restore();
    };
    word('Tractor', y1); word('Pull', y2);
    ctx.font = `700 26px ${FONT}`;
    // plaque for the tagline
    const tw = ctx.measureText('Pull it to 300 feet').width + 44, ty = y2 + 52;
    roundPath(ctx, cx - tw / 2, ty - 24, tw, 40, 20); ctx.fillStyle = 'rgba(34,18,8,0.78)'; ctx.fill();
    const bg = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0); bg.addColorStop(0, '#f1cf84'); bg.addColorStop(0.5, '#a8782a'); bg.addColorStop(1, '#f1cf84');
    ctx.lineWidth = 2; ctx.strokeStyle = bg; ctx.stroke();
    ctx.fillStyle = '#fff1d6'; ctx.fillText('Pull it to 300 feet', cx, ty + 5);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state), gn = GROUNDS[rec.groundSel].name;
  const bs = rec.bestSession[rec.groundSel];
  wd.push({ t: 'btn', id: 'session', label: 'Pull Session', sub: bs ? `${gn} · best ${bs} ft` : `${gn} · three pulls`, primary: true, gold: true, h: 100 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Pull', sub: dk >= 0 ? `Today ${dk} ft` : 'Same strips for everyone', row: 1 });
  wd.push({ t: 'btn', id: 'free', label: 'Free Pull', sub: 'No score, just practise', row: 1 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'collection', label: 'Garage', row: 2 });
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
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#ffe3b0', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#ffe3b0', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : [{ t: 'btn', id: 'restore', label: 'Restore purchases', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#ffe3b0' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 2, gap = 16, cell = Math.floor((w - gap * (cols - 1)) / cols), ch = Math.round(cell * 0.78), shH = 2 * (ch + gap) - gap;
  const rigs = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'r');
      RIGS.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = c * (cell + gap), y = r * (ch + gap), has = rigOwned(rec, i);
        roundPath(ctx, x, y, cell, ch, 20); ctx.fillStyle = sel && sel.kind === 'r' && sel.i === i ? 'rgba(255,200,100,0.32)' : 'rgba(40,22,12,0.7)'; ctx.fill();
        const cur = rec.rigSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#a8e88a' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        ctx.save(); ctx.globalAlpha = has ? 1 : 0.35;
        drawRigProfile(ctx, x + cell / 2, y + ch * 0.46, cell * 0.78, i, state.t * 0.3);
        ctx.restore();
        if (!has) { ctx.fillStyle = '#fff6e2'; ctx.font = `700 ${Math.round(cell * 0.14)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + ch * 0.42); }
        ctx.fillStyle = '#fff6e2'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.085))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + ch - 20);
        COLL.rects.push({ kind: 'r', i, x: at.x + x, y: at.y + y, w: cell, h: ch });
      });
    },
  };
  const yc = Math.round(cell * 0.5), yh = 2 * (yc + gap) - gap;
  const grounds = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'g');
      GROUNDS.forEach((gd, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (cell + gap), y = r * (yc + gap), has = groundOwned(rec, i), pal = PALS[i];
        ctx.save(); roundPath(ctx, x, y, cell, yc, 18); ctx.clip();
        const T3 = globalThis.__track3d, img3 = T3 && T3.groundThumb ? T3.groundThumb(i) : null;
        if (img3) ctx.drawImage(img3, x, y, cell, yc);
        else {
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, pal.sky[0]); g.addColorStop(0.5, pal.sky[2]); g.addColorStop(0.51, pal.dirt[0]); g.addColorStop(1, pal.dirt[2]); ctx.fillStyle = g; ctx.fillRect(x, y, cell, yc);
        ctx.fillStyle = pal.far; ctx.beginPath(); ctx.moveTo(x, y + yc * 0.5); ctx.quadraticCurveTo(x + cell * 0.3, y + yc * 0.28, x + cell * 0.55, y + yc * 0.42); ctx.quadraticCurveTo(x + cell * 0.8, y + yc * 0.5, x + cell, y + yc * 0.36); ctx.lineTo(x + cell, y + yc * 0.5); ctx.lineTo(x, y + yc * 0.5); ctx.fill();
        ctx.fillStyle = `rgba(${pal.sun.c},0.9)`; ctx.beginPath(); ctx.arc(x + cell * pal.sun.x, y + yc * Math.min(0.3, pal.sun.y * 0.7), 9, 0, TAU); ctx.fill();
        for (let k = 0; k < 6; k++) { const d = ((k * 37) % 5 - 2) * 0.06; ctx.fillStyle = d >= 0 ? `rgba(${pal.moist},0.45)` : `rgba(${pal.dry},0.4)`; ctx.fillRect(x + (cell * k) / 6, y + yc * 0.52, cell / 6 + 1, yc * 0.48); }
        }
        if (!has) { ctx.fillStyle = 'rgba(20,10,4,0.6)'; ctx.fillRect(x, y, cell, yc); }
        ctx.restore();
        const cur = rec.groundSel === i;
        ctx.lineWidth = cur ? 4 : 2; ctx.strokeStyle = cur ? '#a8e88a' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, cell, yc, 18); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(cell * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? gd.name : `🔒 ${gd.name}`, x + cell / 2, y + yc - 18, '#fff6e2', 6);
        COLL.rects.push({ kind: 'g', i, x: at.x + x, y: at.y + y, w: cell, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 'r') { const d = RIGS[sel.i]; info = rigOwned(rec, sel.i) ? (rec.rigSel === sel.i ? `${d.name} is your rig. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to drive it.`) : `${d.name}: pull ${d.need} feet in total to unlock (${Math.max(0, d.need - rec.lifeFt)} to go).`; }
    else { const d = GROUNDS[sel.i]; info = groundOwned(rec, sel.i) ? (rec.groundSel === sel.i ? `${d.name} is your ground. ${d.blurb}` : `${d.name}. ${d.blurb} Tap again to pull here.`) : `${d.name}: pull ${d.need} feet in total to unlock (${Math.max(0, d.need - rec.lifeFt)} to go).`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Garage', size: 48 },
    { t: 'p', label: `Pulled in total: ${rec.lifeFt} ft`, bold: true, color: '#ffe3b0', size: 24 },
    { t: 'p', label: 'Rigs', bold: true, color: '#ffe3b0', size: 26 },
    rigs,
    { t: 'p', label: 'Grounds', bold: true, color: '#ffe3b0', size: 26 },
    grounds,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'free' ? 'Good practice' : r.newBest ? 'New best session!' : rankFor(r.total);
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }, { t: 'h', label, size: wide ? 46 : 54, cap: big ? 1.2 : 1.5 }];
  if (r.mode !== 'free') {
    wd.push({ t: 'h', label: `${r.total} ft`, size: wide ? 80 : 104, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
    wd.push({ t: 'p', label: `in ${r.pulls.length} pulls · best pull ${r.bestPull} ft${r.full ? ` · ${r.full} full pull${r.full > 1 ? 's' : ''}` : ''}`, size: 26, cap: big ? 2 : 3 });
    if (!big) wd.push({ t: 'art', h: wide ? 120 : 190, draw: (ctx, w, h) => drawPullBars(ctx, w, h, r) });
  } else {
    wd.push({ t: 'p', label: `${r.pulls.length} pull${r.pulls.length > 1 ? 's' : ''} · best ${r.bestPull} ft`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice session and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#b6f09a', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Garage', active: true });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Pull again', primary: true, gold: true, h: 92 });
  if (r.mode !== 'watch' && r.mode !== 'free') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
  wd.push({ t: 'btn', id: 'menu', label: 'Main menu', row: 6, dark: true });
  wd.push(moreWidget());
  wd.push({ t: 'gap', h: wide ? 6 : 30 });
  return wd;
}
function drawPullBars(ctx, w, h, r) {
  const n = r.pulls.length, mx = TRACK_FT;
  const bw = Math.min(90, (w - 20) / n - 10), x0 = (w - n * (bw + 10) + 10) / 2;
  r.pulls.forEach((t, i) => {
    const x = x0 + i * (bw + 10), bh = Math.max(6, ((h - 46) * t.ft) / mx), y = h - 26 - bh, best = t.ft === r.bestPull;
    roundPath(ctx, x, y, bw, bh, 10);
    const g = ctx.createLinearGradient(0, y, 0, y + bh); g.addColorStop(0, best ? '#ffd36a' : '#e08a4c'); g.addColorStop(1, best ? '#e09a2a' : '#8c3a1c'); ctx.fillStyle = g; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `800 ${Math.round(Math.min(26, bw * 0.34))}px ${FONT}`; ctx.fillText(String(t.ft), x + bw / 2, y - 6);
    ctx.font = `600 ${Math.round(Math.min(15, bw * 0.18))}px ${FONT}`; ctx.fillStyle = '#ffe3b0'; ctx.fillText(`Round ${i + 1}`, x + bw / 2, h - 6);
  });
}
export function pauseWidgets(state) {
  const st = state.settings;
  return [
    { t: 'h', label: 'Paused', size: 52 },
    { t: 'btn', id: 'resume', label: 'Resume', primary: true, gold: true, h: 88 },
    { t: 'btn', id: 'p-rules', label: 'Rules', row: 7 },
    { t: 'btn', id: 'p-howto', label: 'How to Play', row: 7 },
    { t: 'btn', id: 'p-sound', label: st.sound ? 'Sound: On' : 'Sound: Off', row: 8 },
    { t: 'btn', id: 'quit', label: 'Quit to menu', row: 8, dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free pulls of the web demo. The full game on iPhone and Android has every rig and ground, the daily pull and unlimited play.', size: 28 },
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
  g.addColorStop(0, `rgba(20,10,4,${a * 0.7})`); g.addColorStop(0.5, `rgba(20,10,4,${a})`); g.addColorStop(1, `rgba(20,10,4,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(20,10,4,0)'); g.addColorStop(1, 'rgba(20,10,4,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,226,170,0.92)'; ctx.fill();
    ctx.fillStyle = '#2b1d14'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,226,170,0.92)'; ctx.fill();
    ctx.fillStyle = '#2b1d14'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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
      roundPath(ctx, c.x + c.w + 18, ty, 5, th, 3); ctx.fillStyle = 'rgba(255,226,170,0.5)'; ctx.fill();
      scrollHint(ctx, top, bottom, sc, mx, c.x, c.w);
    }
  });
  return fr;
}

// The living background of the menus: a pull being driven by the game on its own.
function attract(ctx, state, rect, dim = 0.2) {
  ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  drawWorldState(ctx, rect, state.att);
  ctx.restore();
  scrim(ctx, dim);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(30,14,6,0.66)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top) }, 0.06);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(20,8,2,0.6)'); g.addColorStop(1, 'rgba(20,8,2,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(20,8,2,0)'); g2.addColorStop(1, 'rgba(20,8,2,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,236,204,0.7)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: 0, w: hw, h: H }, 0.1);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(20,8,2,0.6)'); g.addColorStop(1, 'rgba(20,8,2,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,236,204,0.7)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
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
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(40,24,14,0.96)', stroke: 'rgba(255,200,120,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,242,224,0.97)', stroke: 'rgba(80,50,20,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `700 ${Math.round(40 * Math.min(sc, 1.15))}px ${FONT}`; ctx.fillText(header, pcx, PANEL.y + 58);
  ctx.strokeStyle = 'rgba(80,50,20,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(80,50,20,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(80,50,20,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(80,50,20,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e2'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}


// ---- illustrations (drawn with the game's own rigs and gauges) --------------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(30,14,6,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#f2b134', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, pi = 0) {
  const p = PALS[pi];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, p.sky[0]); g.addColorStop(0.55, p.sky[2]); g.addColorStop(0.57, p.dirt[0]); g.addColorStop(1, p.dirt[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(60,30,10,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
const DIAL = (ctx, x, y, w, h, o) => { ctx.save(); ctx.translate(x, y); drawDial(ctx, { x: 0, y: 0, w, h }, { fs: 18, ...o }); ctx.restore(); };
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, key === 'strips' ? 1 : key === 'nose' ? 2 : 0);
  const gy = h * 0.58;
  const A = {
    rig() {
      drawRigProfile(ctx, w * 0.5, h * 0.5, Math.min(w * 0.6, 330), 1, state.t * 0.5, 0.0);
      tag(ctx, 'a farm tractor, no brand', w * 0.5, h * 0.92, '#fff6e2', 19);
    },
    overview() {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(w * 0.08, gy, w * 0.84, 4);
      for (let i = 0; i <= 6; i++) { const xx = w * (0.08 + 0.84 * i / 6); ctx.fillStyle = '#fff'; ctx.fillRect(xx - 1.5, gy - 12, 3, 18); if (i % 2 === 0) label(ctx, String(i * 50), xx, gy + 30, 16, '#fff6e2'); }
      drawRigProfile(ctx, w * 0.16, gy - 38, 110, 1, 0, 0);
      ctx.fillStyle = '#4a5560'; roundPath(ctx, w * 0.02, gy - 30, w * 0.07, 14, 4); ctx.fill();
      ctx.fillStyle = '#f5c518'; ctx.fillRect(w * 0.035, gy - 46, w * 0.025, 16);
      label(ctx, 'FULL PULL', w * 0.9, gy - 56, 18, '#fff', 'right');
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * 0.92, gy - 40); ctx.lineTo(w * 0.92, gy); ctx.stroke();
      arrow(ctx, w * 0.3, gy - 70, w * 0.62, gy - 70, '#ffd36a', 5);
      tag(ctx, '300 feet', w * 0.5, h * 0.2, '#ffd36a', 20);
      tag(ctx, 'the sled gets heavier as it goes', w * 0.5, h * 0.9, '#fff6e2', 18);
    },
    lever() {
      const cx = w * 0.5, t0 = h * 0.12, t1 = h * 0.78;
      roundPath(ctx, cx - 12, t0 - 4, 24, t1 - t0 + 8, 12); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill();
      const lg = ctx.createLinearGradient(0, t1, 0, t0); lg.addColorStop(0, '#58b24a'); lg.addColorStop(0.65, '#e0b02a'); lg.addColorStop(1, '#e0452a');
      roundPath(ctx, cx - 7, t0 + (t1 - t0) * 0.45, 14, (t1 - t0) * 0.55, 7); ctx.fillStyle = lg; ctx.fill();
      const ky = t0 + (t1 - t0) * 0.45;
      const kg = ctx.createRadialGradient(cx - 8, ky - 8, 2, cx, ky, 28); kg.addColorStop(0, '#ff9a7a'); kg.addColorStop(0.5, '#d83a1e'); kg.addColorStop(1, '#6e1408'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(cx, ky, 28, 0, TAU); ctx.fill();
      arrow(ctx, cx + 90, t1 - 10, cx + 90, t0 + 10, '#ffd36a', 5);
      tag(ctx, 'drag up to open', cx + 120, h * 0.45, '#fff6e2', 18);
      tag(ctx, 'it stays put', cx - 100, h * 0.7, '#ffd36a', 18);
    },
    gears() {
      const bw = w * 0.34, bh = h * 0.28;
      roundPath(ctx, w * 0.1, h * 0.14, bw, bh, 14); ctx.fillStyle = '#b3331f'; ctx.fill(); label(ctx, '▲ Shift up', w * 0.1 + bw / 2, h * 0.14 + bh * 0.62, 20, '#fff');
      roundPath(ctx, w * 0.1, h * 0.58, bw, bh, 14); ctx.fillStyle = '#b3331f'; ctx.fill(); label(ctx, '▼ Shift down', w * 0.1 + bw / 2, h * 0.58 + bh * 0.62, 20, '#fff');
      DIAL(ctx, w * 0.52, h * 0.1, w * 0.38, h * 0.62, { label: 'ENGINE', v: 0.62, bands: [{ a: 0, b: 0.476, col: '#c75a3a' }, { a: 0.476, b: 0.952, col: '#58b24a' }, { a: 0.952, b: 1, col: '#e03a2a' }], valueText: '65%', sub: 'Gear 2' });
      label(ctx, 'keep the needle in the green', w * 0.5, h * 0.92, 17, '#fff6e2');
    },
    gauges() {
      const cw = w * 0.3;
      DIAL(ctx, w * 0.03, h * 0.08, cw, h * 0.74, { label: 'ENGINE', v: 0.7, bands: [{ a: 0, b: 0.476, col: '#c75a3a' }, { a: 0.476, b: 0.952, col: '#58b24a' }, { a: 0.952, b: 1, col: '#e03a2a' }], valueText: '73%' });
      DIAL(ctx, w * 0.35, h * 0.08, cw, h * 0.74, { label: 'WHEEL SLIP', v: 0.25, bands: [{ a: 0, b: SLIP_GOOD[0] / 0.6, col: '#c4a23a' }, { a: SLIP_GOOD[0] / 0.6, b: SLIP_GOOD[1] / 0.6, col: '#58b24a' }, { a: SLIP_GOOD[1] / 0.6, b: 0.667, col: '#d98a2a' }, { a: 0.667, b: 1, col: '#e03a2a' }], valueText: '15%' });
      DIAL(ctx, w * 0.67, h * 0.08, cw, h * 0.74, { label: 'NOSE LIFT', v: 0.4, bands: [{ a: 0, b: LIFT_WARN, col: '#58b24a' }, { a: LIFT_WARN, b: 0.92, col: '#e0a52a' }, { a: 0.92, b: 1, col: '#e03a2a' }], valueText: '40%' });
      label(ctx, 'green is good, red is trouble', w * 0.5, h * 0.93, 17, '#fff6e2');
    },
    engine() {
      // the power band: a curve of engine power against engine speed
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.08, h * 0.8); ctx.lineTo(w * 0.92, h * 0.8); ctx.moveTo(w * 0.08, h * 0.8); ctx.lineTo(w * 0.08, h * 0.12); ctx.stroke();
      ctx.fillStyle = 'rgba(88,178,74,0.35)'; ctx.fillRect(w * 0.08 + (w * 0.84) * 0.5, h * 0.12, (w * 0.84) * 0.5, h * 0.68);
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 5; ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const r = i / 40 * 1.05, T = Math.max(0, 1 - ((r - 0.62) / 0.52) ** 2) * (r > 1 ? Math.max(0, 1 - (r - 1) * 12) : 1), pw = T * r / 0.62; const xx = w * 0.08 + w * 0.84 * (r / 1.05), yy = h * 0.8 - h * 0.6 * Math.min(1, pw); if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
      label(ctx, 'engine speed', w * 0.5, h * 0.93, 17, '#fff6e2'); label(ctx, 'power', w * 0.08, h * 0.08, 16, '#fff6e2', 'left');
      tag(ctx, 'green band', w * 0.72, h * 0.3, '#b6f09a', 18);
    },
    strips() {
      const pal = PALS[1], ws = [0.16, -0.12, 0.2, -0.2, 0.04, -0.08, 0.12, -0.16];
      ws.forEach((d, i) => { ctx.fillStyle = d >= 0 ? `rgba(${pal.moist},${0.2 + Math.abs(d) * 2})` : `rgba(${pal.dry},${0.15 + Math.abs(d) * 2.4})`; ctx.fillRect(w * 0.06 + (w * 0.88 * i) / 8, h * 0.2, w * 0.88 / 8 + 1, h * 0.55); });
      tag(ctx, 'dark: damp, more grip', w * 0.3, h * 0.12, '#fff6e2', 17);
      tag(ctx, 'pale: dusty, less grip', w * 0.7, h * 0.86, '#fff6e2', 17);
    },
    nose() {
      drawRigProfile(ctx, w * 0.42, h * 0.55, Math.min(w * 0.5, 300), 3, 0, 0.9);
      ctx.setLineDash([7, 7]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.8); ctx.lineTo(w * 0.9, h * 0.8); ctx.stroke(); ctx.setLineDash([]);
      tag(ctx, 'front end rising', w * 0.75, h * 0.3, '#ffd36a', 19);
      tag(ctx, 'ease the lever', w * 0.78, h * 0.55, '#fff6e2', 17);
    },
    load() {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.82); ctx.lineTo(w * 0.92, h * 0.82); ctx.moveTo(w * 0.1, h * 0.82); ctx.lineTo(w * 0.1, h * 0.12); ctx.stroke();
      ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 5; ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const u = i / 30, f = (0.25 + 0.75 * Math.pow(u, 1.5)) * (0.55 + 0.45 * Math.min(1, u * 91 / 8)); const xx = w * 0.1 + w * 0.82 * u, yy = h * 0.82 - h * 0.62 * f; if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
      label(ctx, '0 ft', w * 0.1, h * 0.93, 16, '#fff6e2'); label(ctx, `${TRACK_FT} ft`, w * 0.92, h * 0.93, 16, '#fff6e2', 'right'); label(ctx, 'load', w * 0.1, h * 0.08, 16, '#fff6e2', 'left');
    },
    rigs() {
      RIGS.forEach((rg, i) => { const c = i % 2, r = Math.floor(i / 2); drawRigProfile(ctx, w * (0.27 + c * 0.46), h * (0.3 + r * 0.42), w * 0.34, i, state.t * 0.2, 0); label(ctx, rg.name, w * (0.27 + c * 0.46), h * (0.52 + r * 0.42), Math.max(13, Math.round(h * 0.075)), '#fff6e2'); });
    },
  };
  (A[key] ?? A.rig)();
  ctx.restore();
}
