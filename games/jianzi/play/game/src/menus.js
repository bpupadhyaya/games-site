// Every screen that is not the play screen: title, settings, collection, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { gl } from './glhook.js';
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { YARDS, SHUTTLES, makeCam, drawBackdrop, drawAmbient, drawChalk, drawKicker, drawShuttle, drawFx, glowDraw, SHUTTLE_U, COSTUMES } from './art.js';
import { TRICKS, KINDS, CIRCLE_SPOTS as SPOTS, PARTNERS, inBand } from './sim.js';
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

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 330, t = 0) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.miterLimit = 2;
    ctx.font = `italic 800 160px ${DISPLAY}`;
    const word = 'Jianzi', by = 170;
    // soft glow plate behind the lettering
    const gl0 = ctx.createRadialGradient(cx, by - 50, 20, cx, by - 50, 330); gl0.addColorStop(0, 'rgba(255,196,90,0.34)'); gl0.addColorStop(1, 'rgba(255,196,90,0)');
    ctx.fillStyle = gl0; ctx.fillRect(cx - 340, by - 240, 680, 420);
    // extruded body: a stack of darker copies stepping down and right (real depth), then the ink outline
    for (let k = 16; k >= 1; k--) {
      ctx.lineWidth = 24; ctx.strokeStyle = `rgb(${Math.round(58 + k * 2)},${Math.round(16 + k)},${Math.round(8)})`;
      ctx.strokeText(word, cx + k * 0.7, by + k * 1.5);
    }
    ctx.lineWidth = 24; ctx.strokeStyle = 'rgba(12,14,36,0.95)'; ctx.strokeText(word, cx, by);
    // gold face: brushed gradient + a bright upper bevel + a darker lower lip
    const g = ctx.createLinearGradient(0, by - 120, 0, by + 12);
    g.addColorStop(0, '#fff8d6'); g.addColorStop(0.32, '#ffd75a'); g.addColorStop(0.58, '#f2a52b'); g.addColorStop(0.8, '#d9701d'); g.addColorStop(1, '#a8420f');
    ctx.fillStyle = g; ctx.fillText(word, cx, by);
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - 330, by - 130, 660, 150); ctx.clip();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,250,220,0.85)'; ctx.strokeText(word, cx - 1, by - 2);
    ctx.restore();
    // a slow glint sweeps across the letters (masked to the word on an offscreen layer)
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const oc = (heroArt.glint = heroArt.glint || new OffscreenCanvas(680, 190)), g2 = oc.getContext('2d');
        g2.clearRect(0, 0, 680, 190);
        g2.font = `italic 800 160px ${DISPLAY}`; g2.textAlign = 'center'; g2.textBaseline = 'alphabetic'; g2.fillStyle = '#fff'; g2.fillText(word, 340, 150);
        g2.globalCompositeOperation = 'source-in';
        const sx = -80 + (((t * 0.22) % 2.2) / 2.2) * 840;
        const sg = g2.createLinearGradient(sx - 50, 0, sx + 30, 190); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,0.75)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
        g2.fillStyle = sg; g2.fillRect(0, 0, 680, 190);
        ctx.drawImage(oc, cx - 340, by - 150);
      } catch { /* optional */ }
    }
    ctx.restore();
    // vermilion seal plate with the Chinese name, brass edged
    const pw = 150, ph = 70, px = cx - pw / 2, py = 205;
    ctx.save();
    roundPath(ctx, px, py + 4, pw, ph, 12); ctx.fillStyle = 'rgba(5,6,20,0.45)'; ctx.fill();
    roundPath(ctx, px, py, pw, ph, 12);
    const sg2 = ctx.createLinearGradient(0, py, 0, py + ph); sg2.addColorStop(0, '#e8492a'); sg2.addColorStop(1, '#9f2410'); ctx.fillStyle = sg2; ctx.fill();
    const bg = ctx.createLinearGradient(0, py, 0, py + ph); bg.addColorStop(0, '#f6dc8f'); bg.addColorStop(1, '#8a6422');
    ctx.lineWidth = 3; ctx.strokeStyle = bg; roundPath(ctx, px + 2, py + 2, pw - 4, ph - 4, 10); ctx.stroke();
    ctx.font = `800 52px "PingFang SC", "Noto Sans SC", "Microsoft YaHei", ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(70,10,0,0.55)'; ctx.fillText('毽子', cx, py + ph / 2 + 3); ctx.fillStyle = '#ffe9a6'; ctx.fillText('毽子', cx, py + ph / 2 + 1);
    ctx.restore();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = `700 27px ${FONT}`; textShadow(ctx, 'The feathered kicking game', cx, 316, '#ffe9bf', 6);
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [];
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const rec = state.record, dk = dailyKey(state);
  wd.push({ t: 'btn', id: 'solo', icon: 'solo', label: 'Solo Streak', sub: rec.best ? `Best ${rec.best}` : 'Keep it in the air', primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'circle', icon: 'circle', label: 'Park Circle', sub: rec.bestCircle ? `Best chain ${rec.bestCircle}` : 'Pass with friends', row: 1 });
  wd.push({ t: 'btn', id: 'daily', icon: 'daily', label: 'Daily Streak', sub: dk >= 0 ? `Today ${dk}` : 'New wind today', row: 1 });
  wd.push({ t: 'btn', id: 'watch', icon: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'collection', icon: 'collection', label: 'Collection', row: 2 });
  wd.push({ t: 'btn', id: 'howto', icon: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', icon: 'rules', label: 'Rules', row: 3 });
  wd.push({ t: 'btn', id: 'about', icon: 'about', label: 'About', row: 3 });
  wd.push({ t: 'btn', id: 'settings', icon: 'settings', label: 'Settings', row: 4 });
  wd.push({ t: 'btn', id: 'sound', icon: sound ? 'sound' : 'mute', label: sound ? 'Sound: On' : 'Sound: Off', row: 4 });
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-gauge', label: st.gauge ? 'Strike gauge: On' : 'Strike gauge: Off', sub: 'The coloured height bar beside your leg', active: st.gauge },
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

export function collectionWidgets(state, w) {
  const rec = state.record, sel = state.collSel;
  const cols = 3, gap = 18, cell = Math.min(180, Math.floor((w - gap * (cols - 1)) / cols)), shH = 2 * (cell + gap) - 6;
  const shuttles = {
    t: 'art', h: shH,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 's');
      const total = cols * cell + (cols - 1) * gap, x0 = (ww - total) / 2;
      SHUTTLES.forEach((d, i) => {
        const r = Math.floor(i / cols), c = i % cols, x = x0 + c * (cell + gap), y = r * (cell + gap), has = rec.owned[i];
        roundPath(ctx, x, y, cell, cell, 20); ctx.fillStyle = sel && sel.kind === 's' && sel.i === i ? 'rgba(255,224,138,0.35)' : 'rgba(14,18,40,0.55)'; ctx.fill();
        ctx.lineWidth = state.record.shuttleSel === i ? 4 : 2; ctx.strokeStyle = state.record.shuttleSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.3)'; ctx.stroke();
        drawShuttle(ctx, x + cell / 2, y + cell * 0.62, cell * 0.105, -0.25, i, 0.5 + i, has ? 1 : 0.28);
        if (!has) { ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.round(cell * 0.2)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🔒', x + cell / 2, y + cell * 0.5); }
        ctx.fillStyle = '#fff6e0'; ctx.font = `700 ${Math.max(13, Math.round(cell * 0.115))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.name, x + cell / 2, y + cell - 14);
        COLL.rects.push({ kind: 's', i, x: at.x + x, y: at.y + y, w: cell, h: cell });
      });
    },
  };
  const yh = 2 * (Math.round(cell * 0.62) + gap) - 6;
  const yw = Math.floor((w - gap) / 2), yc = Math.round(cell * 0.62);
  const yards = {
    t: 'art', h: yh,
    draw(ctx, ww, hh, at) {
      COLL.rects = COLL.rects.filter((r) => r.kind !== 'y');
      YARDS.forEach((yd, i) => {
        const r = Math.floor(i / 2), c = i % 2, x = c * (yw + gap), y = r * (yc + gap), has = Math.max(rec.best, rec.bestDaily) >= yd.need;
        ctx.save(); roundPath(ctx, x, y, yw, yc, 18); ctx.clip();
        const g = ctx.createLinearGradient(0, y, 0, y + yc); g.addColorStop(0, yd.sky[0]); g.addColorStop(0.62, yd.sky[1]); g.addColorStop(0.63, yd.floor[0]); g.addColorStop(1, yd.floor[1]); ctx.fillStyle = g; ctx.fillRect(x, y, yw, yc);
        ctx.fillStyle = yd.mid; ctx.beginPath(); ctx.moveTo(x, y + yc * 0.6); ctx.quadraticCurveTo(x + yw * 0.3, y + yc * 0.28, x + yw * 0.55, y + yc * 0.5); ctx.quadraticCurveTo(x + yw * 0.8, y + yc * 0.62, x + yw, y + yc * 0.4); ctx.lineTo(x + yw, y + yc * 0.63); ctx.lineTo(x, y + yc * 0.63); ctx.fill();
        ctx.fillStyle = yd.roof; ctx.fillRect(x + yw * 0.38, y + yc * 0.28, yw * 0.3, yc * 0.12); ctx.fillStyle = yd.wall; ctx.fillRect(x + yw * 0.42, y + yc * 0.4, yw * 0.22, yc * 0.22);
        if (!has) { ctx.fillStyle = 'rgba(10,14,34,0.55)'; ctx.fillRect(x, y, yw, yc); }
        ctx.restore();
        ctx.lineWidth = state.record.yardSel === i ? 4 : 2; ctx.strokeStyle = state.record.yardSel === i ? '#7fe0c8' : 'rgba(255,255,255,0.35)'; roundPath(ctx, x, y, yw, yc, 18); ctx.stroke();
        ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.max(14, Math.round(yw * 0.075))}px ${FONT}`;
        textShadow(ctx, has ? yd.name : `🔒 ${yd.name}`, x + yw / 2, y + yc - 18, '#fff6e0', 6);
        COLL.rects.push({ kind: 'y', i, x: at.x + x, y: at.y + y, w: yw, h: yc });
      });
    },
  };
  let info = '';
  if (sel) {
    if (sel.kind === 's') { const d = SHUTTLES[sel.i]; info = rec.owned[sel.i] ? (rec.shuttleSel === sel.i ? `${d.name} is in use.` : `${d.name}. Tap again to use it.`) : `${d.name}: ${d.how}.`; }
    else { const d = YARDS[sel.i]; const has = Math.max(rec.best, rec.bestDaily) >= d.need; info = has ? (rec.yardSel === sel.i ? `${d.name} is in use.` : `${d.name}. Tap again to play there.`) : `${d.name}: reach a streak of ${d.need}.`; }
  }
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Collection', size: 48 },
    { t: 'p', label: 'Shuttles', bold: true, color: '#ffe9bf', size: 26 },
    shuttles,
    { t: 'p', label: 'Courtyards', bold: true, color: '#ffe9bf', size: 26 },
    yards,
    ...(info ? [{ t: 'p', label: info, size: 26 }] : []),
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'watch' ? 'Session complete' : r.streak >= 1 ? (r.newBest ? 'New best streak!' : 'Dropped') : 'Dropped';
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 80 }, { t: 'h', label, size: wide ? 52 : 60, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: `${r.streak}`, size: wide ? 84 : 100, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: `${r.mode === 'circle' || r.mode === 'watch' ? 'kicks in the chain' : 'kicks in a row'} · ${r.points.toLocaleString('en-US')} points · ${r.perfects} perfect`, size: 26, cap: big ? 2 : 3 });
  if (r.tricks.length) wd.push({ t: 'p', label: `Combos: ${r.tricks.join(', ')}`, size: 24, color: '#9be8b0', bold: true, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice run and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  if (r.unlocks.length) wd.push({ t: 'btn', id: 'collection', label: 'Open the Collection', active: true });
  wd.push({ t: 'gap', h: wide ? 8 : 20 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Play again', primary: true, h: 92 });
  if (r.mode !== 'watch') wd.push({ t: 'btn', id: 'share', label: 'Share', row: 6 });
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
    { t: 'btn', id: 'p-gauge', label: st.gauge ? 'Gauge: On' : 'Gauge: Off', row: 8, active: st.gauge },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the free preview', size: 48 },
    { t: 'p', label: 'You have played the free runs of the web demo. The full game on iPhone and Android has every courtyard, shuttle and combo, the daily streak and unlimited play.', size: 28 },
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

// The living background of the menus: the same courtyard, with four friends passing the shuttle on their own.
function attract(ctx, state, rect, dim = 0.2) {
  const run = state.att;
  const cam = makeCam(rect, true);
  const G3 = gl.active ? (gl.frame = { W, H, cam, yard: state.record.yardSel, circle: true, run, people: [], t: state.t, design: state.record.shuttleSel }) : null;
  if (!G3) { drawBackdrop(ctx, W, H, cam, state.record.yardSel); drawChalk(ctx, cam, true); }
  if (!G3) drawAmbient(ctx, W, H, cam, state.record.yardSel, state.t);
  const sh = run.sh, order = [2, 1, 3, 0];
  order.sort((p, q) => run.pz[q] - run.pz[p]);
  for (const i of order) {
    const look = run.expect === i ? sh.x : run.spots[run.expect].x;
    if (G3) G3.people.push({ i, x: run.px[i], z: run.pz[i], anim: run.anim[i], look });
    else drawKicker(ctx, cam, i, { x: run.px[i], z: run.pz[i] }, run.anim[i], look, state.t);
  }
  const f = cam.persp(sh.z);
  if (G3) glowDraw(ctx, cam.X(sh.x, sh.z), cam.Y(Math.max(0, sh.y), sh.z), cam.s * f, state.t);
  else {
    ctx.fillStyle = 'rgba(10,14,30,0.3)'; ctx.beginPath(); ctx.ellipse(cam.X(sh.x, sh.z), cam.Y(0, sh.z), cam.s * f * 0.22, cam.s * f * 0.08, 0, 0, TAU); ctx.fill();
    drawShuttle(ctx, cam.X(sh.x, sh.z), cam.Y(Math.max(0, sh.y), sh.z), Math.max(4, cam.s * f * SHUTTLE_U), sh.ang, state.record.shuttleSel, state.t);
  }
  drawFx(ctx, cam, state.attFx);
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
    attract(ctx, state, { x: 0, y: top + 120, w: W, h: Math.max(300, fr.cols[0].top - top - 120) }, 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(10,12,34,0.62)'); g.addColorStop(1, 'rgba(10,12,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(10,14,34,0)'); g2.addColorStop(1, 'rgba(10,14,34,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt(330, state.t).draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: H * 0.18, w: hw, h: H * 0.8 }, 0.12);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(10,12,34,0.6)'); g.addColorStop(1, 'rgba(10,12,34,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt(330, state.t).draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.68); drawFlowScreen(ctx, state, 'settings'); }
export function renderCollection(ctx, state) { backdrop(ctx, state, 0.72); drawFlowScreen(ctx, state, 'collection'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.54); drawFlowScreen(ctx, state, 'result'); }
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
  const pkey = `${header}:${list.length}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}`;
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

// ---- illustrations (drawn with the game's own figures and shuttle) -------------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(20,28,54,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = C.terra, wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h, yard = 0) {
  const yd = YARDS[yard];
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, yd.sky[0]); g.addColorStop(0.7, yd.sky[1]); g.addColorStop(0.71, yd.floor[0]); g.addColorStop(1, yd.floor[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(40,50,90,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function miniCam(w, h, circle) { return makeCam({ x: 0, y: 0, w, h }, circle); }
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h, 0);
  const dsg = state.record.shuttleSel;
  const A = {
    shuttle() {
      drawShuttle(ctx, w * 0.5, h * 0.62, Math.min(h * 0.12, 22), 0.15, dsg, state.t);
      tag(ctx, 'feathers', w * 0.5 + 100, h * 0.26, '#fff6e2', 18); arrow(ctx, w * 0.5 + 70, h * 0.3, w * 0.5 + 20, h * 0.4, '#7d2a12', 3);
      tag(ctx, 'weighted coin', w * 0.5 - 120, h * 0.84, '#fff6e2', 18); arrow(ctx, w * 0.5 - 85, h * 0.78, w * 0.5 - 12, h * 0.69, '#7d2a12', 3);
    },
    overview() {
      const c = miniCam(w, h, false); c.s *= 0.62; c.gy = h * 0.88;
      drawKicker(ctx, c, 0, { x: 0, z: 0 }, { t: 0.08, kind: 'inside', side: 0, cx: 0.1, cy: 0.3 }, 0, 0);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.X(0.15), c.Y(0.3)); ctx.quadraticCurveTo(c.X(0.5), c.Y(3.4), c.X(0.9), c.Y(0.4)); ctx.stroke(); ctx.setLineDash([]);
      drawShuttle(ctx, c.X(0.52), c.Y(1.55), 11, 0.4, dsg, state.t);
      tag(ctx, 'kick it up, keep it up', w * 0.72, h * 0.2, '#fff6e2', 19);
    },
    gauge() {
      const c = miniCam(w, h, false); c.s *= 0.6; c.gy = h * 0.9; c.cx = w * 0.36;
      drawKicker(ctx, c, 0, { x: 0, z: 0 }, null, 0.4, 0);
      const gx = w * 0.62, y0 = h * 0.9, sc = h * 0.62;
      const zone = (a, b, col, nm) => { ctx.fillStyle = col; ctx.fillRect(gx - 14, y0 - b * sc, 28, (b - a) * sc); label(ctx, nm, gx + 46, y0 - ((a + b) / 2) * sc + 6, 18, C.ink, 'left'); };
      zone(0, 0.16, '#e0a43a', 'Toe scoop'); zone(0.16, 0.48, '#2fae9a', 'Foot'); zone(0.48, 0.88, '#7d68c8', 'Knee');
      ctx.fillStyle = '#fff'; ctx.fillRect(gx - 18, y0 - 0.3 * sc - 1.5, 36, 3); ctx.fillRect(gx - 18, y0 - 0.66 * sc - 1.5, 36, 3);
      drawShuttle(ctx, gx - 52, y0 - 0.55 * sc, 9, 0, dsg, state.t); arrow(ctx, gx - 52, y0 - 0.9 * sc, gx - 52, y0 - 0.7 * sc, '#7d2a12', 3);
      label(ctx, 'white lines: best height', w * 0.66, h * 0.12, 17, C.deep, 'left');
    },
    pads() {
      const names = ['Left', 'Straight', 'Right'], ic = ['◄', '▲', '►'];
      for (let i = 0; i < 3; i++) {
        const px = w * (0.08 + i * 0.3), pw = w * 0.26;
        roundPath(ctx, px, h * 0.18, pw, h * 0.6, 14); ctx.fillStyle = i === 1 ? '#d9542a' : '#2e3a5c'; ctx.fill();
        ctx.fillStyle = '#fffaf0'; ctx.font = `800 ${Math.round(h * 0.22)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic[i], px + pw / 2, h * 0.4);
        ctx.font = `700 ${Math.round(h * 0.11)}px ${FONT}`; ctx.fillText(names[i], px + pw / 2, h * 0.65);
      }
      label(ctx, 'Solo: nudge left, straight up, nudge right. Circle: pass to a friend.', w / 2, h * 0.93, 16, C.deep);
    },
    kinds() {
      const c = miniCam(w / 3, h, false); c.s *= 0.5; c.gy = h * 0.8;
      const poses = [{ kind: 'scoop', cy: 0.1, nm: 'Toe scoop' }, { kind: 'inside', cy: 0.3, nm: 'Inside foot' }, { kind: 'knee', cy: 0.66, nm: 'Knee' }];
      poses.forEach((p, i) => {
        ctx.save(); ctx.translate(i * (w / 3), 0);
        const cc = { ...c, cx: w / 6, X: (xx, z = 0) => w / 6 + xx * c.s * c.persp(z) };
        drawKicker(ctx, cc, 0, { x: 0, z: 0 }, { t: 0.07, kind: p.kind === 'scoop' ? 'inside' : p.kind, side: 0, cx: 0.12, cy: p.cy }, 0.1, 0);
        drawShuttle(ctx, cc.X(0.14), c.Y(p.cy + 0.2), 8, 0.2, dsg, 0);
        label(ctx, p.nm, w / 6, h * 0.94, 17, C.deep);
        ctx.restore();
      });
    },
    combos() {
      const list = TRICKS.slice(0, 6), col = [C.terra, '#2a8f80', '#5a4a9c', '#d38a2b', '#3a7fb0', '#8a4a8f'];
      list.forEach((t, i) => {
        const r = Math.floor(i / 2), cI = i % 2, cx = w * (0.26 + cI * 0.5), cy = h * (0.2 + r * 0.3);
        tag(ctx, `${t.name}  +${t.pts}`, cx, cy, '#fff6e2', 19);
        ctx.fillStyle = col[i]; ctx.beginPath(); ctx.arc(cx - w * 0.22, cy, 6, 0, TAU); ctx.fill();
      });
      label(ctx, 'Finish a pattern with your latest kicks', w / 2, h * 0.94, 17, C.deep);
    },
    circle() {
      const c = miniCam(w, h, true); c.s *= 0.78; c.gy = h * 0.86;
      drawChalk(ctx, c, true);
      for (const i of [2, 1, 3, 0]) drawKicker(ctx, c, i, { x: SPOTS[i].x, z: SPOTS[i].z }, null, 0, 0);
      drawShuttle(ctx, c.X(-1.0, 1.6), c.Y(1.6, 1.6), 9, -0.3, dsg, state.t);
      arrow(ctx, c.X(-0.3, 0), c.Y(1.0, 0), c.X(-1.9, 1.0), c.Y(1.4, 1.0), '#7d2a12', 3);
      void KINDS; void PARTNERS; void COSTUMES; void inBand;
    },
  };
  (A[key] ?? A.shuttle)();
  ctx.restore();
}
