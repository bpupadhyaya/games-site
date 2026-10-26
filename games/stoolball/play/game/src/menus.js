// Every screen that is not the play screen: title, settings, records, result, pause, the demo limit card and the
// About / How to play / Rules reader with its illustrations. Pure drawing; game.js owns state.
import { W, H, TEXT_SCALES, THINK_STEPS, host, refLayout, clamp, cams, proj } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow, flowLayout, drawFlow, flowHit } from './ui.js';
import { drawStage, fillOutside } from './view.js';
import { GL } from './glbridge.js';
import { drawGround, drawBoard, drawPerson, drawBall, drawPaddle, PAL } from './art.js';
import { LEVELS, PITCH, FIELD_C, FIELD_R, fieldSet, SHOTS } from './sim.js';
import { PAR } from './play.js';
import { ABOUT, HOWTO, RULES } from './content.js';

const TAU = Math.PI * 2;
let PAGE_COUNT = 1;
const blankLaid = () => ({ key: '', sig: '', lay: null, top: 0, bottom: H, cols: [] });
let LAID = blankLaid();
export const flowMeta = () => LAID;
export function resetMenus() { LAID = blankLaid(); PAGE_COUNT = 1; }
const land = () => W > H;
const sigOf = (state) => `${W}x${H}|${state.settings.textIdx}|${Math.round(host.t)},${Math.round(host.b)}|${state.rev}`;
const lockSize = (maxW) => { const w = Math.min(Math.max(240, 125 / Math.max(0.2, host.px || 0.6)), maxW); const h = w * 327 / 1200; return { w, h, strip: Math.round(h + 26) }; };
const estCtx = { font: '', measureText(t) { const m = /(\d+)px/.exec(this.font); return { width: String(t).length * (m ? +m[1] : 20) * 0.52 }; } };

// ---- widgets ---------------------------------------------------------------------------------------------------------
// The title lettering: embossed gold. Painted once per width into an offscreen canvas (outline, bronze edge, metal gradient with a bright
// reflection band and a lower shade), then blitted with a soft drop shadow.
const TITLE_CACHE = new Map();
function titleLetters(w) {
  const key = Math.round(w);
  if (TITLE_CACHE.has(key)) return TITLE_CACHE.get(key);
  const doc = globalThis.document;
  if (!doc) return null;
  const c = doc.createElement('canvas'), pad = 24;
  const mc = doc.createElement('canvas').getContext('2d');
  let z = 132; mc.font = `italic 800 ${z}px ${DISPLAY}`;
  while (mc.measureText('Stoolball').width > w - 40 && z > 50) { z -= 4; mc.font = `italic 800 ${z}px ${DISPLAY}`; }
  const tw = Math.ceil(mc.measureText('Stoolball').width) + pad * 2, th = Math.ceil(z * 1.3) + pad * 2;
  c.width = tw; c.height = th;
  const g = c.getContext('2d'), cx = tw / 2, by = pad + z * 1.0;
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.font = `italic 800 ${z}px ${DISPLAY}`;
  g.strokeStyle = '#1b0f06'; g.lineWidth = Math.max(10, z * 0.2); g.strokeText('Stoolball', cx, by);          // dark casing
  g.strokeStyle = '#8a5a1c'; g.lineWidth = Math.max(5, z * 0.085); g.strokeText('Stoolball', cx, by);          // bronze edge
  const gr = g.createLinearGradient(0, by - z * 0.75, 0, by + z * 0.12);
  gr.addColorStop(0, '#fff8d8'); gr.addColorStop(0.28, '#ffe38a'); gr.addColorStop(0.5, '#f1b83a'); gr.addColorStop(0.58, '#fbe39a'); gr.addColorStop(0.78, '#d8902a'); gr.addColorStop(1, '#a8651a');
  g.fillStyle = gr; g.fillText('Stoolball', cx, by);
  // specular band + top-left rim light, clipped to the letters
  g.globalCompositeOperation = 'source-atop';
  const sp = g.createLinearGradient(0, by - z * 0.62, 0, by - z * 0.34); sp.addColorStop(0, 'rgba(255,255,255,0)'); sp.addColorStop(0.5, 'rgba(255,255,255,0.42)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sp; g.fillRect(0, 0, tw, th);
  g.globalCompositeOperation = 'source-over';
  const out = { c, tw, th, z, by };
  TITLE_CACHE.set(key, out);
  return out;
}
const heroArt = (h = 280) => ({
  t: 'art', h,
  draw(ctx, w) {
    const cx = w / 2, L = titleLetters(w);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
    if (L) {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.drawImage(L.c, cx - L.tw / 2, 142 - L.by);
      ctx.restore();
    }
    // a little brass-edged ribbon under the lettering
    ctx.font = `700 26px ${FONT}`;
    const tx = 'Defend the board. Run for it.', tw2 = ctx.measureText(tx).width + 46, rx = cx - tw2 / 2, ry = 142 + 20;
    roundPath(ctx, rx, ry, tw2, 44, 22); ctx.fillStyle = 'rgba(28,16,6,0.62)'; ctx.fill();
    roundPath(ctx, rx + 1, ry + 1, tw2 - 2, 42, 21); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(232,180,60,0.85)'; ctx.stroke();
    ctx.fillStyle = '#fff6dc'; ctx.textBaseline = 'middle'; ctx.fillText(tx, cx, ry + 23);
    ctx.textBaseline = 'alphabetic';
  },
});
const moreWidget = () => ({ t: 'art', h: 30, draw(ctx, w) { drawMoreLine(ctx, w / 2, 14, 19); } });

export function titleWidgets(state) {
  const sound = state.settings.sound, wd = [], rec = state.record;
  if (!land()) wd.push({ t: 'gap', h: 0 });
  const lv = LEVELS[state.settings.level];
  wd.push({ t: 'btn', id: 'match', label: 'Village Match', sub: `You bat, then you bowl · vs ${lv.name}${rec.wins[state.settings.level] ? ` · won ${rec.wins[state.settings.level]}` : ''}`, primary: true, h: 96 });
  wd.push({ t: 'btn', id: 'level', label: `Opponent: ${lv.name}`, sub: lv.blurb, row: 1 });
  wd.push({ t: 'btn', id: 'knock', label: 'Quick Knock', sub: rec.bestKnock[state.settings.level] ? `${KN(state)} · best ${rec.bestKnock[state.settings.level]}` : `${KN(state)} · 12 balls`, row: 2 });
  wd.push({ t: 'btn', id: 'daily', label: 'Daily Knock', sub: rec.dailyDay === state.day ? `Today ${rec.bestDaily}` : 'Same balls for everyone', row: 2 });
  wd.push({ t: 'btn', id: 'watch', label: 'Watch & Learn', row: 3 });
  wd.push({ t: 'btn', id: 'records', label: 'Records', row: 3 });
  wd.push({ t: 'btn', id: 'howto', label: 'How to Play', row: 4 });
  wd.push({ t: 'btn', id: 'rules', label: 'Rules', row: 4 });
  wd.push({ t: 'btn', id: 'about', label: 'About', row: 4 });
  wd.push({ t: 'btn', id: 'settings', label: 'Settings', row: 5 });
  wd.push({ t: 'btn', id: 'sound', label: sound ? 'Sound: On' : 'Sound: Off', row: 5 });
  return wd;
}
const KN = (state) => `Par ${PAR[state.settings.level]}`;

export function settingsWidgets(state) {
  const st = state.settings, sc = TEXT_SCALES[st.textIdx];
  return [
    { t: 'gap', h: 10 }, { t: 'h', label: 'Settings', size: 48 },
    { t: 'btn', id: 'set-sound', label: st.sound ? 'Sound: On' : 'Sound: Off' },
    { t: 'p', label: `Text size: ${Math.round(sc * 100)}%`, bold: true, color: '#e8f2c8', size: 26 },
    { t: 'btn', id: 'txt-dec', label: 'A−  Smaller', row: 4, disabled: st.textIdx === 0 },
    { t: 'btn', id: 'txt-inc', label: 'A+  Larger', row: 4, disabled: st.textIdx === TEXT_SCALES.length - 1 },
    { t: 'p', label: `Watch & Learn thinking time: ${THINK_STEPS[st.thinkIdx]} s`, bold: true, color: '#e8f2c8', size: 26 },
    { t: 'btn', id: 'think-dec', label: 'Shorter', row: 5, disabled: st.thinkIdx === 0 },
    { t: 'btn', id: 'think-inc', label: 'Longer', row: 5, disabled: st.thinkIdx === THINK_STEPS.length - 1 },
    ...(state.demo ? [] : state.owned ? [{ t: 'p', label: 'Full game unlocked', bold: true, color: '#e8f2c8', size: 26 }] : [{ t: 'btn', id: 'restore', label: 'Restore purchase', dark: true }]),
    ...(state.restoreMsg ? [{ t: 'p', label: state.restoreMsg, size: 24, color: '#e8f2c8' }] : []),
    { t: 'gap', h: 10 },
    { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 },
    { t: 'gap', h: 30 },
  ];
}

export function recordsWidgets(state) {
  const r = state.record;
  const wd = [{ t: 'gap', h: 10 }, { t: 'h', label: 'Records', size: 48 }];
  LEVELS.forEach((l, i) => {
    wd.push({ t: 'p', label: l.name, bold: true, color: '#ffe9a0', size: 30 });
    wd.push({ t: 'p', label: `Matches won ${r.wins[i]} of ${r.played[i]} · best win by ${r.bestMargin[i]} · best knock ${r.bestKnock[i]}`, size: 24 });
  });
  wd.push({ t: 'p', label: `Daily Knock: best today ${r.dailyDay === state.day ? r.bestDaily : 0} · overall best ${r.bestDailyEver}`, size: 24 });
  wd.push({ t: 'p', label: `Highest single innings ${r.highest} · fours ${r.fours} · sixes ${r.sixes} · wickets taken ${r.wicketsTaken}`, size: 24 });
  wd.push({ t: 'gap', h: 10 }, { t: 'btn', id: 'back', label: 'Back', primary: true, h: 84 }, { t: 'gap', h: 30 });
  return wd;
}

export function resultWidgets(state, wide = false) {
  const r = state.last; if (!r) return [{ t: 'btn', id: 'menu', label: 'Main menu', primary: true }];
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  const wd = [{ t: 'gap', h: wide ? 4 : big ? 20 : 50 }];
  if (r.kind === 'match') {
    wd.push({ t: 'h', label: r.win ? 'You win!' : r.tie ? 'A tie' : 'They win', size: wide ? 50 : 62, cap: big ? 1.2 : 1.5, color: r.win ? '#ffd97a' : '#fff8e4' });
    wd.push({ t: 'h', label: `${r.you} to ${r.opp}`, size: wide ? 56 : 80, cap: big ? 1.1 : 1.3, color: '#ffffff' });
    wd.push({ t: 'p', label: r.tie ? 'Level on runs.' : `${r.win ? 'You won' : 'You lost'} by ${r.margin} run${r.margin === 1 ? '' : 's'} against ${LEVELS[r.level].name}. You lost ${r.wktsYou} wicket${r.wktsYou === 1 ? '' : 's'}, they lost ${r.wktsOpp}.`, size: 26, cap: big ? 2 : 3 });
  } else {
    wd.push({ t: 'h', label: r.beat ? 'Par beaten!' : 'Knock over', size: wide ? 50 : 62, cap: big ? 1.2 : 1.5, color: r.beat ? '#ffd97a' : '#fff8e4' });
    wd.push({ t: 'h', label: `${r.runs}`, size: wide ? 80 : 110, cap: big ? 1.1 : 1.3, color: '#ffffff' });
    wd.push({ t: 'p', label: `${r.runs} runs from ${r.balls} balls, ${r.wkts} wicket${r.wkts === 1 ? '' : 's'} · par ${r.par}${r.newBest ? ' · a new best!' : ''}`, size: 26, cap: big ? 2 : 3 });
  }
  if (r.hints) wd.push({ t: 'p', label: 'Think was used: this was practice and is not saved as a best.', size: 22, color: '#ffd9a0', cap: big ? 2 : 3 });
  wd.push({ t: 'gap', h: wide ? 6 : 14 });
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
    { t: 'btn', id: 'quit', label: 'Quit to menu', row: 8, dark: true },
  ];
}
export function demoLimitWidgets(state, wide = false) {
  const big = TEXT_SCALES[state.settings.textIdx] > 1.5;
  return [
    { t: 'gap', h: wide ? 6 : big ? 30 : 140 }, { t: 'h', label: 'That is the demo end', size: 48 },
    { t: 'p', label: 'You have played the free matches of the web demo. The full game on iPhone and Android has every level, the daily knock and unlimited play.', size: 28 },
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
      const colTop = Math.max(bottom - btnH, host.t + 270), heroTop = host.t + 14 + Math.max(0, Math.min(60, (colTop - 720) / 4));
      return { cols: [{ widgets: titleWidgets(state), x: 40, w: 640, top: colTop, bottom }], hero: { top: heroTop } };
    }
    const cw = clamp(Math.round(W * 0.42), 420, 600), x = W - host.r - 28 - cw;
    return { cols: [{ widgets: titleWidgets(state), x, w: cw, top: host.t + 8, bottom: H - host.b - 8 - lockSize(cw).strip, center: true }], hero: { x0: host.l, x1: x - 16 } };
  }
  const w = L ? Math.min(640, W - 80) : 640, x = Math.round((W - w) / 2);
  const oy = L ? 0 : Math.max(0, (H - 1280) / 2);
  if (key === 'settings') return { cols: [{ widgets: settingsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
  if (key === 'records') return { cols: [{ widgets: recordsWidgets(state), x, w, top: host.t, bottom: H - host.b }] };
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
  g.addColorStop(0, `rgba(8,24,10,${a * 0.7})`); g.addColorStop(0.5, `rgba(8,24,10,${a})`); g.addColorStop(1, `rgba(8,24,10,${Math.min(0.92, a + 0.3)})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function scrollHint(ctx, top, bottom, scroll, maxScroll, x0 = 0, w = W) {
  if (maxScroll <= 0) return;
  const cx = x0 + w / 2;
  if (scroll < maxScroll - 4) {
    const g = ctx.createLinearGradient(0, bottom - 90, 0, bottom); g.addColorStop(0, 'rgba(8,24,10,0)'); g.addColorStop(1, 'rgba(8,24,10,0.7)');
    ctx.fillStyle = g; ctx.fillRect(x0, bottom - 90, w, 90);
    roundPath(ctx, cx - 44, bottom - 40, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2a1e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▼ more', cx, bottom - 23);
  } else if (scroll > 4) {
    roundPath(ctx, cx - 44, top + 8, 88, 32, 16); ctx.fillStyle = 'rgba(255,240,204,0.92)'; ctx.fill();
    ctx.fillStyle = '#1c2a1e'; ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('▲ up', cx, top + 24);
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

// The living background of the menus: the computer plays a match on the green.
let attCam = null, attKey = '';
function attract(ctx, state, rect, dim = 0.2) {
  const S = state.att;
  if (S) {
    const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.w)},${Math.round(rect.h)}`;
    if (key !== attKey) { attCam = cams(rect, rect.w > rect.h); attKey = key; }
    const L = { stage: rect, land: rect.w > rect.h, key: `att${key}`, hero: true };
    if (GL.on) ctx.clearRect(rect.x, rect.y, rect.w, rect.h);
    drawStageWith(ctx, S, L, attCam, state.t);
  }
  scrim(ctx, dim);
}
function drawStageWith(ctx, S, L, C2, t) {
  // drawStage uses camsFor(L) internally through the layout key; the attract show passes its own key
  drawStage(ctx, S, L, t);
  void C2;
}
function drawTitleLockup(ctx, state) {
  const k = LAID.lock; if (!k) return;
  const d = state.ui && state.ui.drag, dn = !!(d && d.x0 >= k.tap.x && d.x0 <= k.tap.x + k.tap.w && d.y0 >= k.tap.y && d.y0 <= k.tap.y + k.tap.h);
  ctx.save(); ctx.fillStyle = 'rgba(10,28,14,0.62)'; roundPath(ctx, k.cx - k.w / 2 - 10, k.y - 5, k.w + 20, k.h + 10, (k.h + 10) / 2); ctx.fill(); ctx.restore();
  drawLockup(ctx, k.cx, k.y + (dn ? 1 : 0), k.h * (dn ? 0.96 : 1), dn ? 0.7 : 1);
}
const fullRect = () => ({ x: 0, y: 0, w: W, h: H });
// the area of the title screen where the show plays (above the buttons; left of them in landscape)
export function attractRect(state) {
  const fr = frameFor(state, 'title');
  if (!land()) return { x: 0, y: 0, w: W, h: Math.max(420, fr.cols[0].top + 20) };
  return { x: 0, y: 0, w: Math.max(300, fr.hero.x1 + 10), h: H };
}
const underlay = (ctx, keep = null) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b4220'); g.addColorStop(1, '#10281a'); ctx.fillStyle = g; fillOutside(ctx, GL.on ? keep : null); };
export function renderTitle(ctx, state) {
  const fr = frameFor(state, 'title');
  underlay(ctx, attractRect(state));
  if (!land()) {
    const top = fr.hero.top;
    attract(ctx, state, attractRect(state), 0.1);
    const g = ctx.createRadialGradient(W / 2, top + 150, 40, W / 2, top + 150, 430); g.addColorStop(0, 'rgba(8,24,10,0.62)'); g.addColorStop(1, 'rgba(8,24,10,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top + 560);
    const ytop = fr.cols[0].top, g2 = ctx.createLinearGradient(0, ytop - 70, 0, ytop + 40); g2.addColorStop(0, 'rgba(8,24,10,0)'); g2.addColorStop(1, 'rgba(8,24,10,0.86)'); ctx.fillStyle = g2; ctx.fillRect(0, ytop - 70, W, H - ytop + 70);
    ctx.save(); ctx.translate(W / 2 - 320, top); heroArt().draw(ctx, 640); ctx.restore();
    drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
    if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(240,248,220,0.65)'; ctx.fillText('Web demo', W / 2, H - 4 - host.b); }
    return;
  }
  const hx = (fr.hero.x0 + fr.hero.x1) / 2, hw = fr.hero.x1 - fr.hero.x0;
  attract(ctx, state, attractRect(state), 0.1);
  const g = ctx.createRadialGradient(hx, 160, 30, hx, 160, 360); g.addColorStop(0, 'rgba(8,24,10,0.62)'); g.addColorStop(1, 'rgba(8,24,10,0)'); ctx.fillStyle = g; ctx.fillRect(fr.hero.x0, 0, hw, 560);
  const k = Math.min(1, hw / 640);
  ctx.save(); ctx.translate(hx - 320 * k, Math.max(host.t, 0) + 6); ctx.scale(k, k); heroArt().draw(ctx, 640); ctx.restore();
  drawFlowScreen(ctx, state, 'title'); drawTitleLockup(ctx, state);
  if (state.demo) { ctx.textAlign = 'center'; ctx.font = `400 18px ${FONT}`; ctx.fillStyle = 'rgba(240,248,220,0.65)'; ctx.fillText('Web demo', hx, H - 8 - host.b); }
}
function backdrop(ctx, state, dim) { attract(ctx, state, fullRect(), dim); }
export function renderSettings(ctx, state) { backdrop(ctx, state, 0.7); drawFlowScreen(ctx, state, 'settings'); }
export function renderRecords(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'records'); }
export function renderResult(ctx, state) { backdrop(ctx, state, land() ? 0.62 : 0.56); drawFlowScreen(ctx, state, 'result'); }
export function renderDemoLimit(ctx, state) { backdrop(ctx, state, 0.74); drawFlowScreen(ctx, state, 'demolimit'); }
export function renderPause(ctx, state) {
  scrim(ctx, 0.55);
  const wd = pauseWidgets(state), sc = TEXT_SCALES[state.settings.textIdx];
  const pw = Math.min(660, W - 60), px = Math.round((W - pw) / 2);
  const lay = flowLayout(ctx, wd, sc, { x: px + 30, w: pw - 60 });
  const top = Math.max(70, host.t + 20), bottom = H - Math.max(70, host.b + 20);
  const ch = Math.min(lay.contentH + 20, bottom - top), y0 = Math.max(top, (H - ch) / 2);
  panel(ctx, px, y0 - 20, pw, ch + 40, { r: 30, fill: 'rgba(20,46,28,0.95)', stroke: 'rgba(255,224,160,0.5)' });
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
  panel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { r: 30, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(60,55,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.deep; ctx.font = `800 ${Math.round(42 * Math.min(sc, 1.15))}px ${DISPLAY}`; ctx.fillText(header, pcx, PANEL.y + 60);
  ctx.strokeStyle = 'rgba(60,55,30,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PANEL.x + 60, PANEL.y + 78); ctx.lineTo(PANEL.x + PANEL.w - 60, PANEL.y + 78); ctx.stroke();
  ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 8, top, PANEL.w - 16, viewH); ctx.clip();
  for (const it of fl.items) {
    const y = top + it.y - state.refScroll;
    if (y < top - 260 || y > top + viewH + 40) continue;
    if (it.t === 'rule') { ctx.strokeStyle = 'rgba(60,55,30,0.22)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(PANEL.x + 80, y); ctx.lineTo(PANEL.x + PANEL.w - 80, y); ctx.stroke(); }
    else if (it.t === 'title') { ctx.textAlign = 'center'; ctx.fillStyle = C.terra; ctx.font = `700 ${fl.secFs}px ${FONT}`; it.tl.forEach((l, k) => ctx.fillText(l, pcx, y + fl.secFs * (0.9 + k * 1.2) - 8)); }
    else if (it.t === 'art') { ctx.save(); ctx.beginPath(); ctx.rect(PANEL.x + 20, y, PANEL.w - 40, 210); ctx.clip(); drawArt(it.art, ctx, PANEL.x + 40, y, PANEL.w - 80, 198, state); ctx.restore(); }
    else { ctx.fillStyle = C.ink; ctx.font = `400 ${fl.fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.fillText(it.text, PANEL.x + 40, y + fl.fs * 0.85); }
  }
  ctx.restore();
  if (REF.max > 0) {
    const th = Math.max(36, viewH * viewH / (viewH + REF.max)), ty = top + (viewH - th) * (state.refScroll / REF.max);
    ctx.fillStyle = 'rgba(60,55,30,0.15)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, top, 6, viewH, 3); ctx.fill();
    ctx.fillStyle = 'rgba(60,55,30,0.55)'; ctx.beginPath(); ctx.roundRect(PANEL.x + PANEL.w - 20, ty, 6, th, 3); ctx.fill();
  }
  drawButton(ctx, RL.dec, 'A−', { disabled: state.settings.textIdx === 0, size: 30 });
  drawButton(ctx, RL.inc, 'A+', { disabled: state.settings.textIdx === TEXT_SCALES.length - 1, size: 30 });
  ctx.fillStyle = '#fff6e0'; ctx.font = `700 24px ${FONT}`; ctx.textAlign = RL.pct.right ? 'right' : 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${Math.round(sc * 100)}%`, RL.pct.x, RL.pct.y); ctx.textBaseline = 'alphabetic';
  drawButton(ctx, RL.back, 'Back', { size: 32 });
  drawButton(ctx, RL.next, 'Done', { primary: true, size: 32 });
}

// ---- illustrations (drawn with the game's own people, board, paddle and ball) ---------------------------------------------------
function label(ctx, t, x, y, size = 20, col = C.ink, align = 'center') { ctx.fillStyle = col; ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x, y); }
function tag(ctx, t, x, y, col = '#fff8e4', size = 18) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; const tw = ctx.measureText(t).width + 16;
  roundPath(ctx, x - tw / 2, y - size * 0.8, tw, size * 1.55, size * 0.7); ctx.fillStyle = 'rgba(12,32,16,0.86)'; ctx.fill();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y); ctx.restore();
}
function arrow(ctx, x0, y0, x1, y1, col = '#f0b44c', wd = 4) {
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 12 * Math.cos(a - 0.45), y1 - 12 * Math.sin(a - 0.45)); ctx.lineTo(x1 - 12 * Math.cos(a + 0.45), y1 - 12 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
}
function panelBg(ctx, w, h) {
  roundPath(ctx, 0, 0, w, h, 16); ctx.save(); ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6cb455'); g.addColorStop(1, '#3f8a2c'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(14,60,16,0.16)'; for (let i = 0; i < 8; i += 2) ctx.fillRect(0, i * h / 8, w, h / 8);
  ctx.restore(); ctx.strokeStyle = 'rgba(30,50,20,0.5)'; ctx.lineWidth = 2; roundPath(ctx, 0, 0, w, h, 16); ctx.stroke();
}
function bigBoard(ctx, x, y, s) {
  // a board on its post, y = ground
  ctx.fillStyle = 'rgba(0,30,0,0.28)'; ctx.beginPath(); ctx.ellipse(x, y + 2, s * 0.32, s * 0.09, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = PAL.post; ctx.fillRect(x - s * 0.035, y - s * 0.62, s * 0.07, s * 0.62);
  ctx.fillStyle = PAL.boardEdge; ctx.fillRect(x - s * 0.19, y - s * 0.95, s * 0.38, s * 0.36);
  ctx.fillStyle = PAL.board; ctx.fillRect(x - s * 0.165, y - s * 0.925, s * 0.33, s * 0.31);
}
export function drawArt(key, ctx, x, y, w, h) {
  ctx.save(); ctx.translate(x, y);
  panelBg(ctx, w, h);
  const A = {
    wicket() {
      bigBoard(ctx, w * 0.62, h * 0.9, h * 0.78);
      drawPerson(ctx, w * 0.36, h * 0.9, h * 0.62, { id: 7, team: 'bat', pose: 'ready', paddle: true, paddleAng: 0.1 });
      tag(ctx, 'the board', w * 0.62, h * 0.12, '#fff8e4', 18); tag(ctx, 'the paddle', w * 0.2, h * 0.34, '#ffe9a0', 18);
      drawBall(ctx, [w * 0.86, h * 0.9], [w * 0.86, h * 0.55], 9, 0.4, false);
      tag(ctx, 'the ball', w * 0.86, h * 0.32, '#fff8e4', 18);
    },
    ring() {
      const cx = w * 0.55, cy = h * 0.66;
      drawPaddle(ctx, cx, cy + 20, h * 0.5, 0);
      ctx.strokeStyle = 'rgba(255,248,200,0.7)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy - 20, 64, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#7dff9a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy - 20, 38, 0, TAU); ctx.stroke();
      drawBall(ctx, [w * 0.2, h * 0.9], [w * 0.2, h * 0.2], 10, 0.5, true);
      arrow(ctx, w * 0.24, h * 0.3, cx - 52, cy - 36, '#ffe9a0', 4);
      tag(ctx, 'the ring closes as the ball arrives', w * 0.5, h * 0.1, '#fff8e4', 18);
      arrow(ctx, cx - 100, h * 0.88, cx + 100, h * 0.88, '#ffffff', 4); arrow(ctx, cx + 100, h * 0.88, cx - 100, h * 0.88, '#ffffff', 4);
      tag(ctx, 'slide', cx, h * 0.8, '#fff8e4', 18);
    },
    shots() {
      const base = h * 0.84;
      ['Block', 'Drive', 'Lift'].forEach((n, i) => {
        const x0 = w * (0.1 + i * 0.3);
        ctx.strokeStyle = '#fff8e4'; ctx.lineWidth = 4; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(x0, base);
        if (i === 0) ctx.lineTo(x0 + w * 0.05, base - 6);
        else if (i === 1) ctx.quadraticCurveTo(x0 + w * 0.12, base - h * 0.2, x0 + w * 0.24, base - 4);
        else ctx.quadraticCurveTo(x0 + w * 0.1, base - h * 0.85, x0 + w * 0.26, base);
        ctx.stroke(); ctx.setLineDash([]);
        drawPaddle(ctx, x0 - 6, base, h * 0.34, 0.2);
        tag(ctx, n, x0 + w * 0.1, h * 0.12, '#ffe9a0', 20);
        label(ctx, ['dead stop', 'along the ground', 'high, can be caught'][i], x0 + w * 0.1, h * 0.96, Math.max(12, Math.round(h * 0.075)), '#fff8e4');
      });
    },
    aim() {
      const cx = w * 0.5, cy = h * 0.82;
      for (const a of [-52, -26, 0, 26, 52]) {
        const r = a * Math.PI / 180; arrow(ctx, cx, cy, cx + Math.sin(r) * h * 0.75, cy - Math.cos(r) * h * 0.75, a === 0 ? '#ffe9a0' : 'rgba(255,255,255,0.8)', 3);
      }
      drawPaddle(ctx, cx, cy + 10, h * 0.45, 0);
      tag(ctx, 'left of the paddle', w * 0.16, h * 0.3, '#fff8e4', 17); tag(ctx, 'right of the paddle', w * 0.84, h * 0.3, '#fff8e4', 17);
      label(ctx, 'where the ball meets the paddle sets the direction', w * 0.5, h * 0.12, 17, '#fff8e4');
    },
    run() {
      const y0 = h * 0.55;
      bigBoard(ctx, w * 0.1, y0 + 30, h * 0.8); bigBoard(ctx, w * 0.9, y0 + 30, h * 0.8);
      drawPerson(ctx, w * 0.4, y0 + 40, h * 0.5, { id: 7, team: 'bat', run: 1, ph: 0.2, pose: 'run', paddle: true, paddleAng: 0.9 });
      drawPerson(ctx, w * 0.62, y0 + 40, h * 0.5, { id: 8, team: 'bat', run: 1, ph: 0.7, pose: 'run', paddle: true, paddleAng: 0.9 });
      arrow(ctx, w * 0.22, h * 0.9, w * 0.78, h * 0.9, '#ffe9a0', 4);
      tag(ctx, `RUN: about ${(RUN_LEN_TXT)} s`, w * 0.5, h * 0.12, '#fff8e4', 18);
    },
    bowl() {
      const px = w * 0.08, py = h * 0.12, pw = w * 0.5, ph = h * 0.76;
      ctx.fillStyle = 'rgba(250,244,226,0.96)'; roundPath(ctx, px, py, pw, ph, 12); ctx.fill();
      ctx.strokeStyle = PAL.boardEdge; ctx.lineWidth = 3; ctx.strokeRect(px + pw * 0.4, py + ph * 0.12, pw * 0.2, ph * 0.78);
      ctx.fillStyle = '#a8331f'; ctx.beginPath(); ctx.arc(px + pw * 0.64, py + ph * 0.56, 11, 0, TAU); ctx.fill();
      label(ctx, 'drag the marker', px + pw / 2, py + ph - 10, 16, C.ink);
      ['Slow', 'Medium', 'Quick'].forEach((n, i) => { roundPath(ctx, w * 0.62 + i * w * 0.12, h * 0.16, w * 0.11, h * 0.2, 10); ctx.fillStyle = i === 1 ? '#d4553a' : '#fbf6e6'; ctx.fill(); label(ctx, n, w * 0.62 + i * w * 0.12 + w * 0.055, h * 0.29, Math.max(11, Math.round(h * 0.07)), i === 1 ? '#fff' : C.ink); });
      roundPath(ctx, w * 0.62, h * 0.6, w * 0.34, h * 0.22, 12); ctx.fillStyle = '#d4553a'; ctx.fill(); label(ctx, 'BOWL', w * 0.79, h * 0.74, Math.max(16, Math.round(h * 0.12)), '#fff');
    },
    field() {
      const cx = w * 0.5, cy = h * 0.52, r = h * 0.4;
      ctx.fillStyle = '#4f9a3c'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fbf6e8'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = '#d9d58a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.25); ctx.lineTo(cx, cy - r * 0.2); ctx.stroke();
      const set = fieldSet('balanced'), k = r / FIELD_R;
      set.forEach((f, i) => { ctx.fillStyle = i === 0 ? '#9ad0ff' : '#2b5d9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx + f.x * k, cy - (f.y - FIELD_C.y) * k, 7, 0, TAU); ctx.fill(); ctx.stroke(); });
      arrow(ctx, cx, cy + r * 0.2, cx + r * 0.55, cy - r * 0.55, '#ffe36a', 4);
      tag(ctx, 'aim for a gap', cx + r * 0.9, cy - r * 0.7, '#ffe36a', 17);
    },
  };
  (A[key] ?? A.wicket)();
  ctx.restore();
}
const RUN_LEN_TXT = '2';
void proj; void drawGround; void drawBoard; void SHOTS; void PITCH;
