// Every screen that is not the play screen: title, settings, the Moves journal, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, lacquerPlate, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { TOUCHES, COMBOS, TEMPOS, WIN, N, spot, ROUNDS, ROUND_TOUCHES } from './sim.js';
import { drawTouchIcon, TOUCH_COL, drawScene2D } from './hud.js';
import { rigFor, project } from './camera.js';

export const YARD_NAMES = ['Village Green', 'Golden Hour', 'Lantern Night'];
export const YARD_NEED = [0, 3, 4];   // stars needed (best of any dance)
const TAU = Math.PI * 2;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); }
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

// ---- widgets ---------------------------------------------------------------------------------------------------------
const heroArt = (h = 300) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    ctx.font = `italic 800 150px ${DISPLAY}`;
    // embossed gold lettering: a stack of dark-bronze extrusion layers, a dark rim, then the lit gold face with a top sheen
    for (let i = 14; i >= 1; i--) { ctx.fillStyle = i > 8 ? '#3a0f06' : '#6a2610'; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 8; ctx.strokeText('Chinlone', cx, 160 + i * 0.9); ctx.fillText('Chinlone', cx, 160 + i * 0.9); }
    ctx.lineWidth = 12; ctx.strokeStyle = '#2a0a04'; ctx.strokeText('Chinlone', cx, 160);
    const g = ctx.createLinearGradient(0, 40, 0, 172); g.addColorStop(0, '#fff7cf'); g.addColorStop(0.35, '#ffd96a'); g.addColorStop(0.62, '#e8a22a'); g.addColorStop(0.64, '#c2761a'); g.addColorStop(1, '#f0b84a');
    ctx.fillStyle = g; ctx.fillText('Chinlone', cx, 160);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,248,214,0.85)'; ctx.strokeText('Chinlone', cx, 158.5);
    // Burmese name on a small red lacquer plaque with gold rim
    ctx.font = `700 50px "Myanmar MN", "Myanmar Sangam MN", "Noto Sans Myanmar", "Padauk", ${FONT}`;
    const tw = Math.max(210, ctx.measureText('ချင်းလုံး').width + 70);
    lacquerPlate(ctx, cx - tw / 2, 190, tw, 66, 18, 'primary');
    ctx.fillStyle = '#ffe9a8'; ctx.shadowColor = 'rgba(40,6,0,0.7)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 2; ctx.fillText('ချင်းလုံး', cx, 240);
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.font = `700 25px ${FONT}`; textShadow(ctx, 'The cane-ball circle dance', cx, 292, '#ffeec4', 6);
    ctx.restore();
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });
const dailyKey = (state) => (state.record.dailyDay === state.day ? state.record.bestDaily : -1);

// squarer portrait screens (iPad, 7 and 10 inch tablets): tighter title so the whole menu fits without scrolling
const compactTitle = (state) => !land() && H < 1100 && TEXT_SCALES[state.settings.textIdx] <= 1;
export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [], rec = state.record, dk = dailyKey(state), tp = state.settings.tempo;
  if (!land()) wd.push({ t: 'gap', h: 0 });
  wd.push({ t: 'btn', id: 'dance', icon: 'dance', label: 'Dance', sub: rec.best[tp] ? `Best ${rec.best[tp].toLocaleString('en-US')} · ${starsText(rec.bestStars[tp])}` : `${TEMPOS[tp].name} tempo`, primary: true, h: 92 });
  wd.push({ t: 'btn', id: 'tempo-0', label: 'Gentle', row: 1, active: tp === 0, dark: tp !== 0 });
  wd.push({ t: 'btn', id: 'tempo-1', label: 'Steady', row: 1, active: tp === 1, dark: tp !== 1 });
  wd.push({ t: 'btn', id: 'tempo-2', label: 'Lively', row: 1, active: tp === 2, dark: tp !== 2 });
  wd.push({ t: 'btn', id: 'daily', icon: 'daily', label: 'Daily Dance', sub: dk >= 0 ? `Today ${dk.toLocaleString('en-US')}` : 'A new dance today', row: 2 });
  wd.push({ t: 'btn', id: 'watch', icon: 'watch', label: 'Watch & Learn', row: 2 });
  wd.push({ t: 'btn', id: 'journal', icon: 'moves', label: 'Moves', row: 3 });
  wd.push({ t: 'btn', id: 'howto', icon: 'howto', label: 'How to Play', row: 3 });
  wd.push({ t: 'btn', id: 'rules', icon: 'rules', label: 'Rules', row: 4 });
  wd.push({ t: 'btn', id: 'about', icon: 'about', label: 'About', row: 4 });
  wd.push({ t: 'btn', id: 'settings', icon: 'settings', label: 'Settings', row: 5 });
  wd.push({ t: 'btn', id: 'sound', icon: sound ? 'sound' : 'mute', label: sound ? 'Sound: On' : 'Sound: Off', row: 5 });
  if (compactTitle(state)) for (const w of wd) if (w.t === 'btn') w.h = w.primary ? 72 : 56;
  return wd;
}

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'btn', id: 'set-names', label: st.names ? 'Touch names above dancers: On' : 'Touch names above dancers: Off', sub: 'The name of the touch shown over the dancer who plays it', active: st.names },
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

// The journal: the five touches, the named patterns and the courtyards.
export function journalWidgets(state) {
  const rec = state.record, wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Moves', size: 48 }];
  wd.push({ t: 'p', label: 'The five touches', bold: true, color: '#ffe9bf', size: 26 });
  TOUCHES.forEach((t, i) => {
    wd.push({ t: 'art', h: 78, draw(ctx, w) {
      roundPath(ctx, 0, 0, w, 74, 18); ctx.fillStyle = 'rgba(14,22,46,0.62)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
      drawTouchIcon(ctx, t.id, 44, 38, 58, TOUCH_COL[i], '#fffaf0');
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff6e0'; ctx.font = `700 25px ${FONT}`; ctx.fillText(t.name, 88, 32);
      ctx.font = `400 19px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.85)'; ctx.fillText(`${rec.touches[i].toLocaleString('en-US')} played · ${t.where}`, 88, 58, w - 100);
    } });
  });
  wd.push({ t: 'p', label: 'Named patterns', bold: true, color: '#ffe9bf', size: 26 });
  COMBOS.forEach((c) => {
    const found = rec.combosFound.includes(c.name);
    wd.push({ t: 'art', h: 74, draw(ctx, w) {
      roundPath(ctx, 0, 0, w, 70, 18); ctx.fillStyle = found ? 'rgba(20,48,60,0.7)' : 'rgba(14,22,46,0.5)'; ctx.fill(); ctx.strokeStyle = found ? '#7fe0c8' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = found ? 2.5 : 1.5; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = found ? '#fff6e0' : 'rgba(255,246,224,0.7)'; ctx.font = `700 24px ${FONT}`; ctx.fillText(found ? c.name : `${c.name}`, 20, 30);
      ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.8)'; ctx.fillText(`${c.seq.map((k) => TOUCHES[k].short).join(' → ')} · ${c.pts} points${found ? '' : ' · not yet danced'}`, 20, 56, w - 30);
    } });
  });
  wd.push({ t: 'p', label: 'Courtyards', bold: true, color: '#ffe9bf', size: 26 });
  const best = Math.max(...rec.bestStars);
  YARD_NAMES.forEach((nm, i) => {
    const has = best >= YARD_NEED[i];
    wd.push({ t: 'btn', id: `yard-${i}`, label: has ? nm : `${nm}`, sub: has ? (rec.yard === i ? 'In use' : 'Tap to dance here') : `Reach ${YARD_NEED[i]} stars in any dance`, active: rec.yard === i && has, disabled: !has, hitDisabled: true, dark: !has || rec.yard !== i });
  });
  wd.push({ t: 'gap', h: 6 });
  wd.push({ t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 });
  wd.push({ t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const label = r.mode === 'watch' ? 'Session complete' : r.newBest ? 'New best dance!' : 'Dance complete';
  const wd = [{ t: 'gap', h: wide ? 6 : big ? 24 : 70 }, { t: 'h', label, size: wide ? 50 : 58, cap: big ? 1.2 : 1.5 }];
  wd.push({ t: 'h', label: r.score.toLocaleString('en-US'), size: wide ? 78 : 96, cap: big ? 1.1 : 1.3, color: '#ffd97a' });
  wd.push({ t: 'p', label: starsText(r.stars), size: 40, color: '#ffd97a', cap: big ? 1.4 : 1.8 });
  wd.push({ t: 'p', label: `Harmony ${Math.round(r.harmony * 100)}% · ${r.perfects} perfect · ${r.goods} good · ${r.drops} dropped`, size: 26, cap: big ? 2 : 3 });
  if (r.combos.length) wd.push({ t: 'p', label: `Patterns: ${r.combos.join(', ')}`, size: 24, color: '#9be8b0', bold: true, cap: big ? 2 : 3 });
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was a practice dance and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  for (const u of r.unlocks) wd.push({ t: 'p', label: `Unlocked: ${u}`, bold: true, color: '#9be8b0', size: 26, cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 8 : 20 });
  wd.push({ t: 'btn', id: 'again', label: r.mode === 'watch' ? 'Watch again' : 'Dance again', primary: true, h: 92 });
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
    { t: 'btn', id: 'p-names', label: st.names ? 'Names: On' : 'Names: Off', row: 8, active: st.names },
    { t: 'btn', id: 'quit', label: 'Quit to menu', dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have danced the free rounds of the web demo. The full game on iPhone and Android has every tempo, courtyard and pattern, the daily dance and unlimited play.', size: 28 },
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
      const colTop = Math.max(bottom - btnH, host.t + (compactTitle(state) ? 320 : 400)), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 720) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.36), 420, 560), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'journal') return { cols: [{ widgets: journalWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
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
  g.addColorStop(0, `rgba(8,16,34,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,16,34,${a})`); g.addColorStop(1, `rgba(8,16,34,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,16,34,0)'); g.addColorStop(1, 'rgba(8,16,34,0.7)');
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

// The living background of the menus: the same plaza, with the six dancers keeping the ball up on their own (drawn by the 3D
// presenter behind this canvas, or by the flat fallback). `rect` is where the ring should sit.
function attract(ctx, state, rect, dimA = 0.2) {
  ctx.clearRect(0, 0, W, H);
  state.attRect = rect;
  if (!state.has3d && state.att) drawScene2D(ctx, state.att, rigFor(W, H, rect));
  scrim(ctx, dimA);
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(10,18,40,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  if (!land()) {
    const top = fr.hero.top;
    const hk = compactTitle(state) ? 0.72 : 1;
    attract(ctx, state, { x: 0, y: top + 250 * hk, w: W, h: Math.max(240, fr.cols[0].top - top - 250 * hk) }, 0.06);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(8,14,34,0.6)'); g.addColorStop(1, 'rgba(8,14,34,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(8,16,34,0)'); g2.addColorStop(1, 'rgba(8,16,34,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320 * hk, top); ctx.scale(hk, hk); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, { x: fr.hero.x0, y: H * 0.34, w: hw, h: H * 0.64 }, 0.08);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(8,14,34,0.6)'); g.addColorStop(1, 'rgba(8,14,34,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(255,240,204,0.6)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dimA) { attract(ctx, state, fullRect(), dimA); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderJournal(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'journal'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.56); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.76); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(18,30,54,0.95)', stroke: 'rgba(255,224,160,0.5)' });
  LAID = { key: 'pause', sig: sigOf(state), lay, top: y0, bottom: y0 + ch, h: lay.contentH, cols: [{ lay, top: y0, bottom: y0 + ch, x: px + 30, w: pw - 60 }] };
  const maxScroll = Math.max(0, lay.contentH - ch);
  state.ui.scroll = Math.min(state.ui.scroll, maxScroll);
  drawFlow(ctx, lay, y0, y0 + ch, state.ui.scroll, { clipX: px, clipW: pw });
  scrollHint(ctx, y0, y0 + ch, state.ui.scroll, maxScroll, px, pw);
}

// ---- reference pages -----------------------------------------------------------------------------------------------------------
export const REF = { max: 0, view: 400 };
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
  const pkey = `${header}:${sc}:${Math.round(PANEL.w)}x${Math.round(PANEL.h)}:${list.length}:${state.licRev || 0}`;
  let fl = pageCache.get(pkey);
  if (!fl) { fl = buildFlow(ctx, list, sc, PANEL); pageCache.set(pkey, fl); if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value); }
  const pcx = PANEL.x + PANEL.w / 2, top = PANEL.y + 96, viewH = Math.max(60, PANEL.h - 96 - 70);
  REF.max = Math.max(0, Math.ceil(fl.total - viewH)); REF.view = viewH;
  state.refScroll = Math.max(0, Math.min(REF.max, state.refScroll || 0));
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,228,0.97)', stroke: 'rgba(40,50,90,0.7)' });
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

// ---- illustrations (drawn with the game's own pictograms and ring) -----------------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff6e2', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(20,28,54,0.82)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function panelBg(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#bcdcf0'); g.addColorStop(0.62, '#dfeaee'); g.addColorStop(0.63, '#87ac62'); g.addColorStop(1, '#648a46'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.restore(); ctx.strokeStyle = 'rgba(40,50,90,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
export function drawArt(key, ctx, x, y, w, h, state) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h);
  const A = {
    circle() {
      // six dancers on a ring seen from above, with a pass drawn across it
      const cx = w / 2, cy = h * 0.52, rx = Math.min(w * 0.36, 230), ry = h * 0.34;
      ctx.fillStyle = '#e1d2ad'; ctx.beginPath(); ctx.ellipse(cx, cy, rx * 1.18, ry * 1.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b4533a'; ctx.lineWidth = 3; ctx.stroke();
      const pts = [];
      for (let j = 0; j < N; j++) { const a = Math.PI + (j * TAU) / N; pts.push({ x: cx + Math.sin(a) * rx, y: cy - Math.cos(a) * ry * 0.9 }); }
      ctx.setLineDash([7, 7]); ctx.strokeStyle = '#7d2a12'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.quadraticCurveTo(cx - rx * 0.4, cy - ry * 2.0, pts[2].x, pts[2].y); ctx.stroke(); ctx.setLineDash([]);
      pts.forEach((p, j) => { ctx.fillStyle = ['#1f5f8b', '#7a1f3d', '#2f7d5b', '#a8431f', '#43366b', '#c28a1f'][j]; ctx.beginPath(); ctx.arc(p.x, p.y, 17, 0, TAU); ctx.fill(); ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(p.x, p.y - 15, 9, 0, TAU); ctx.fill(); });
      tag(ctx, 'six dancers, one ball', w * 0.5, h * 0.12, '#fff6e2', 19);
    },
    timing() {
      const cx = w * 0.3, cy = h * 0.5;
      [0.9, 0.6, 0.34].forEach((k, i) => { ctx.strokeStyle = i === 2 ? '#e5b032' : 'rgba(34,48,79,0.55)'; ctx.lineWidth = i === 2 ? 6 : 3; ctx.beginPath(); ctx.arc(cx, cy, h * 0.42 * k, 0, TAU); ctx.stroke(); });
      ctx.fillStyle = '#e1b266'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, TAU); ctx.fill();
      tag(ctx, 'the ring closes', cx, h * 0.12, '#fff6e2', 18);
      const bx = w * 0.56, bw = w * 0.38;
      const zone = (a, b, col, nm, row) => { ctx.fillStyle = col; ctx.fillRect(bx + a * bw, h * 0.4, (b - a) * bw, 36); label(ctx, nm, bx + ((a + b) / 2) * bw, h * 0.4 + 54 + row * 18, 14, C.deep); };
      zone(0, 0.22, '#c8c2b0', 'early', 0); zone(0.22, 0.42, '#7fb88a', 'ok', 1); zone(0.42, 0.58, '#2fae9a', 'good', 0); zone(0.58, 0.7, '#e5b032', 'perfect', 1); zone(0.7, 0.82, '#cfa15c', 'late', 0);
      label(ctx, 'tap just before the ring closes', bx + bw / 2, h * 0.28, 16, C.deep);
    },
    touches() {
      TOUCHES.forEach((t, i) => {
        const px = w * (0.1 + i * 0.2);
        drawTouchIcon(ctx, t.id, px, h * 0.42, h * 0.5, TOUCH_COL[i], '#22304f');
        label(ctx, t.short, px, h * 0.84, 17, C.deep);
      });
    },
    cues() {
      const items = [0, 3, 1, 4];
      items.forEach((k, i) => {
        const bx = w * (0.04 + i * 0.235), bw = w * 0.22, bh = h * 0.42, by = h * 0.28;
        roundPath(ctx, bx, by, bw, bh, 12); ctx.fillStyle = i === 0 ? '#fff8e2' : 'rgba(22,32,62,0.8)'; ctx.fill(); ctx.lineWidth = i === 0 ? 3 : 1.5; ctx.strokeStyle = i === 0 ? TOUCH_COL[k] : 'rgba(255,255,255,0.3)'; ctx.stroke();
        drawTouchIcon(ctx, TOUCHES[k].id, bx + bw * 0.28, by + bh / 2, bh * 0.8, TOUCH_COL[k], i === 0 ? '#22304f' : '#fff');
        label(ctx, TOUCHES[k].short, bx + bw * 0.68, by + bh * 0.58, 15, i === 0 ? '#22304f' : '#fff6e0');
      });
      tag(ctx, 'now', w * 0.15, h * 0.18, '#fff6e2', 17); tag(ctx, 'next', w * 0.62, h * 0.18, '#fff6e2', 17);
    },
    combos() {
      COMBOS.slice(0, 6).forEach((c, i) => {
        const r = Math.floor(i / 2), cI = i % 2, cx = w * (0.26 + cI * 0.5), cy = h * (0.2 + r * 0.3);
        tag(ctx, `${c.name} +${c.pts}`, cx, cy, '#fff6e2', 18);
      });
      label(ctx, 'Land the touches of a pattern in a row', w / 2, h * 0.94, 17, C.deep);
    },
    flow() {
      const bx = w * 0.12, bw = w * 0.76, by = h * 0.4;
      roundPath(ctx, bx, by, bw, 18, 9); ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();
      const g = ctx.createLinearGradient(bx, 0, bx + bw, 0); g.addColorStop(0, '#2fb5a1'); g.addColorStop(0.6, '#e5b032'); g.addColorStop(1, '#f0743f');
      roundPath(ctx, bx, by, bw * 0.7, 18, 9); ctx.fillStyle = g; ctx.fill();
      ['x1', 'x1.5', 'x2', 'x2.5', 'x3'].forEach((t, i) => label(ctx, t, bx + (bw * i) / 4, by + 56, 17, C.deep));
      tag(ctx, 'Flow raises your score multiplier', w / 2, h * 0.16, '#fff6e2', 18);
    },
  };
  (A[key] ?? A.circle)();
  void state; void WIN; void ROUNDS; void ROUND_TOUCHES; void spot; void project;
  ctx.restore();
}
