// All drawing for screens and the in-play HUD. Reads `state`; the only thing it writes is state._ui (hit
// rectangles for the update step), which is non-enumerable so it never enters getState().
import { W, H, THEMES, LEVELS, clamp, lerp, ease, DEG } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow, drawBall, drawParticles, shade, vGrad, mix, KIT, drawStumps, drawBin } from './art.js';
import { drawDelivery, drawOverheadGround, drawFieldFigure, drawBatterTop, drawTopBall, drawRadar, toScreen, drawBackdrop, CAM, makeProj } from './scene.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, pageStarts, pageClip, maxScroll, scrollbar, inRect } from './ui.js';
import { drawFigure } from './figures.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { MODES, strikerOf, nonStrikerOf, bowlerOf, ballsLeft, requiredRate, runRate, ballPos, currentRunTime } from './engine.js';
import { TYPES, TYPE_KEYS } from './ball.js';
import { PRESETS, PRESET_KEYS, SECTOR_NAMES } from './field.js';

export const R = {
  zoomDec: { x: 16, y: 14, w: 100, h: 58 }, zoomInc: { x: 604, y: 14, w: 100, h: 58 },
  pause: { x: 640, y: 20, w: 56, h: 56 }, think: { x: 572, y: 20, w: 60, h: 56 },
  run: { x: 150, y: 1096, w: 420, h: 112 },
  radar: { x: 550, y: 186, w: 154, h: 154 },
  speed: { x: 16, y: 1196, w: 120, h: 56 }, autoPause: { x: 150, y: 1196, w: 420, h: 56 }, autoThinkDec: { x: 584, y: 1196, w: 56, h: 56 }, autoThinkInc: { x: 648, y: 1196, w: 56, h: 56 },
};

const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(state, ui) { if (!('_ui' in state)) hidden(state, '_ui', ui); else state._ui = ui; }

export const scaleOf = (state) => TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)];

// ---- backgrounds -------------------------------------------------------------------------------------------------
export function drawMenuBackdrop(ctx, state, t) {
  ctx.fillStyle = vGrad(ctx, 0, H, [[0, '#26407a'], [0.22, '#6a5a98'], [0.42, '#e0806a'], [0.6, '#ffb36b'], [0.72, '#ffd98a'], [0.73, '#4d3a5e'], [1, '#1c1230']]);
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 470, 800, 560, 'rgba(255,226,150,A)', 0.7);
  ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(470, 800, 76 + Math.sin(t * 0.8) * 2, 0, 7); ctx.fill();
  glow(ctx, 470, 800, 140, 'rgba(255,255,235,A)', 0.8);
  // clouds
  for (let i = 0; i < 6; i++) { const cx = ((i * 190 + t * 6) % (W + 300)) - 150, cy = 120 + (i * 83) % 460; ctx.fillStyle = 'rgba(255,200,170,0.28)'; ctx.beginPath(); ctx.ellipse(cx, cy, 130, 15, 0, 0, 7); ctx.ellipse(cx + 40, cy - 9, 80, 12, 0, 0, 7); ctx.fill(); }
  // skyline of trees and floodlights against the sun
  ctx.fillStyle = 'rgba(52,32,70,0.92)';
  ctx.beginPath(); ctx.moveTo(0, 940); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 905 - Math.abs(Math.sin(x * 0.045 + 1)) * 40 - Math.abs(Math.sin(x * 0.011)) * 28); ctx.lineTo(W, 1280); ctx.lineTo(0, 1280); ctx.closePath(); ctx.fill();
  for (const x of [70, 650]) { ctx.fillStyle = 'rgba(52,32,70,0.95)'; ctx.fillRect(x - 3, 690, 6, 250); ctx.fillRect(x - 34, 660, 68, 36); ctx.fillStyle = 'rgba(255,238,190,0.9)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x - 30 + i * 16, 664 + j * 15, 12, 10); }
  // pitch and stumps silhouette in the foreground
  ctx.fillStyle = 'rgba(40,26,58,0.95)'; ctx.beginPath(); ctx.moveTo(300, 940); ctx.lineTo(420, 940); ctx.lineTo(560, 1280); ctx.lineTo(160, 1280); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,0.16)'; ctx.beginPath(); ctx.moveTo(318, 940); ctx.lineTo(402, 940); ctx.lineTo(500, 1280); ctx.lineTo(220, 1280); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,226,170,0.9)'; for (const dx of [-7, 0, 7]) ctx.fillRect(360 + dx - 1.2, 920, 2.4, 22);
  // stars
  for (let i = 0; i < 40; i++) { const a = 0.35 + 0.35 * Math.sin(t * 1.5 + i); ctx.fillStyle = `rgba(255,255,255,${a * 0.55})`; ctx.fillRect((i * 97) % W, (i * 53) % 260, 2, 2); }
  if (state.scene !== 'title') { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(12,8,28,0.62)'); g.addColorStop(1, 'rgba(12,8,28,0.72)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}

function drawHero(ctx, w, h, state) {
  const t = state.t;
  const cx = w / 2;
  textFill(ctx, 'GOLDEN HOUR', cx, h * 0.34, Math.min(w * 0.115, h * 0.25), { italic: true, grad: [[0, '#fff3c2'], [0.6, '#ffc54d'], [1, '#ff8a3d']], stroke: 'rgba(70,24,10,0.65)' });
  textFill(ctx, 'CRICKET', cx, h * 0.62, Math.min(w * 0.17, h * 0.38), { italic: true, grad: [[0, '#ffffff'], [0.6, '#ffe6b0'], [1, '#ffb347']], stroke: 'rgba(70,24,10,0.65)' });
  // ball arcing over the title
  const u = (t * 0.45) % 1;
  const bx = lerp(w * 0.08, w * 0.92, u), by = h * 0.86 - Math.sin(u * Math.PI) * h * 0.6;
  for (let i = 1; i < 10; i++) { const uu = Math.max(0, u - i * 0.012); glow(ctx, lerp(w * 0.08, w * 0.92, uu), h * 0.86 - Math.sin(uu * Math.PI) * h * 0.6, 12 - i, 'rgba(255,210,150,A)', 0.5 - i * 0.045); }
  drawBall(ctx, bx, by, 15, 'leather', t * 12);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
  const tag = 'Swipe to bat. Flick to bowl. Beat the sunset.', ts = scaleOf(state);
  fitFont(ctx, tag, Math.min(24, w * 0.036) * Math.min(ts, 2.2), w - 40, 600);
  ctx.fillText(tag, cx, h - 12);
}

function zoomPills(ctx, state) {
  const s = state.prefs.textIdx;
  drawPill(ctx, R.zoomDec, 'A−', { disabled: s === 0 });
  drawPill(ctx, R.zoomInc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, W / 2, 43);
}

// Generic scrolling-column screen with optional fixed footer buttons.
function columnScreen(ctx, state, spec) {
  const s = scaleOf(state);
  drawMenuBackdrop(ctx, state, state.t);
  zoomPills(ctx, state);
  const fy = footerLayout(ctx, spec.footer ?? [], s);
  const top = 90, bottom = fy.top - 10 - (spec.paged ? 34 : 0);
  const view = { x: 34, y: top, w: W - 68, h: bottom - top };
  const lay = layoutColumn(ctx, spec.items, view.w - 10, s);
  const pages = spec.paged ? pageStarts(lay, view.h) : null;
  let sc = clamp(state.ui.scroll, 0, maxScroll(lay, view.h));
  let pi = 0, clipH = null;
  if (pages) {
    // paged screens snap to page starts and hide any half-visible item below the page
    for (let i = 0; i < pages.length; i++) if (sc >= pages[i] - 2) pi = i;
    sc = pages[pi];
    clipH = pageClip(lay, sc, view.h);
  }
  state.ui.scroll = sc;
  const hits = drawColumn(ctx, lay, view, sc, s, state, clipH);
  if (!pages) scrollbar(ctx, view, sc, lay.total);
  for (const b of fy.buttons) drawButton(ctx, b.rect, b.label, { primary: b.primary, disabled: b.disabled, size: b.size, sub: b.sub, active: b.active });
  setUi(state, { hits, footer: fy.buttons.filter((b) => !b.disabled).map((b) => ({ id: b.id, rect: b.rect })), view, lay, pages, maxS: maxScroll(lay, view.h) });
  if (pages) {
    const n = pages.length;
    ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.85)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Page ${pi + 1} of ${n}`, W / 2, fy.top - 14);
    state.ui.pageIdx = pi; state.ui.pageN = n;
  }
}

function footerLayout(ctx, btns, s) {
  if (!btns.length) return { top: H - 30, buttons: [] };
  const m = 24, gapx = 14;
  const stack = s >= 2 && btns.length > 1;
  const size = 30 * s;
  const out = [];
  let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, W - m * 2 - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0);
    top = H - 24 - total + gapx;
    let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: m, y, w: W - m * 2, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (W - m * 2 - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44));
    const hh = Math.max(...hs);
    top = H - 24 - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: m + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}

// ---- UI scenes -----------------------------------------------------------------------------------------------------
export function sceneSpec(state) {
  const s = scaleOf(state);
  const pf = state.prefs;
  switch (state.scene) {
    case 'title': {
      const items = [
        { t: 'fig', h: s >= 2 ? 340 : 440, draw: (ctx, w, h) => drawHero(ctx, w, h, state) },
        { t: 'btn', id: 'play', label: 'Play', sub: 'Chase, full match, backyard rules', primary: true },
        { t: 'btn', id: 'auto', label: 'Auto Play', sub: 'Watch the computer bat and learn' },
        { t: 'btn', id: 'howto', label: 'How to Play' },
        { t: 'btn', id: 'rules', label: 'Rules' },
        { t: 'btn', id: 'about', label: 'About' },
        { t: 'btn', id: 'settings', label: 'Settings' },
      ];
      return { items, footer: [] };
    }
    case 'modes': {
      const rec = state.records;
      const tagFor = (k) => (rec[k] ? `Best ${rec[k].best}  |  Won ${rec[k].wins} of ${rec[k].played}` : 'Not played yet');
      const demo = state.env.config.demo;
      const lock = (k) => demo && !['chase5', 'yard'].includes(k);
      const items = [
        { t: 'title', text: 'Choose a match', size: 40 },
        { t: 'h', text: 'Premium cricket' },
        { t: 'card', id: 'mode:chase', title: 'Premium Chase', text: 'Bat second against a target. 5, 10 or 20 overs, real scoring.', tag: tagFor('chase5'), accent: PAL.teal },
        { t: 'card', id: 'mode:full5', title: lock('full5') ? 'Full Match (app only)' : 'Full Match', text: 'Bowl five overs, then chase the total you gave away.', tag: tagFor('full5'), accent: PAL.gold },
        { t: 'card', id: 'mode:super', title: lock('super') ? 'Super Over (app only)' : 'Super Over', text: 'One over, two wickets, a tight target.', tag: tagFor('super'), accent: PAL.coral },
        { t: 'card', id: 'mode:daily', title: lock('daily') ? 'Daily Innings (app only)' : 'Daily Innings', text: 'The same target for everyone, today.', tag: tagFor('daily'), accent: PAL.peach },
        { t: 'h', text: 'Backyard house rules' },
        { t: 'card', id: 'mode:yard', title: 'Classic Backyard', text: 'Tennis ball, bin wicket, garden fence.', tag: tagFor('yard'), accent: '#58c46a' },
        { t: 'card', id: 'mode:tippy', title: lock('tippy') ? 'Tippy-Go (app only)' : 'Tippy-Go', text: 'Touch the ball at all and you must run.', tag: tagFor('tippy'), accent: '#58c46a' },
        { t: 'card', id: 'mode:ohob', title: lock('ohob') ? 'One-Hand One-Bounce (app only)' : 'One-Hand One-Bounce', text: 'A one-handed catch after one bounce is out.', tag: tagFor('ohob'), accent: '#58c46a' },
        { t: 'card', id: 'mode:sixout', title: lock('sixout') ? 'Six and Out (app only)' : 'Six and Out', text: 'Hit it over the fence and you score 6, but you are out.', tag: tagFor('sixout'), accent: '#58c46a' },
      ];
      return { items, footer: [{ id: 'back', label: 'Back' }] };
    }
    case 'setup': {
      const su = state.setup, mode = MODES[su.mode] ?? MODES.chase5;
      const lvl = LEVELS[su.level];
      const chaseFam = su.family === 'chase';
      const items = [
        { t: 'title', text: su.title, size: 38, sub: su.blurb },
      ];
      if (chaseFam) items.push({ t: 'chips', id: 'overs', label: 'Overs', value: su.overs, options: [{ v: 5, label: '5 overs' }, { v: 10, label: '10 overs', disabled: state.env.config.demo }, { v: 20, label: '20 overs', disabled: state.env.config.demo }] });
      items.push({ t: 'chips', id: 'level', label: 'Opponent', value: su.level, options: LEVELS.map((l, i) => ({ v: i, label: l.name })) });
      items.push({ t: 'para', text: lvl.blurb, color: PAL.peach });
      if (!su.fixedTheme) items.push({ t: 'chips', id: 'theme', label: 'Ground', value: su.theme, options: [{ v: 'stadium', label: 'Stadium' }, { v: 'backyard', label: 'Backyard' }, { v: 'beach', label: 'Beach' }] });
      items.push({ t: 'para', text: `Target in ${su.family === 'chase' ? su.overs : mode.overs} over${mode.overs === 1 ? '' : 's'}: set by the opponent level. ${pf.hand === 1 ? 'Right-handed' : 'Left-handed'} batter, ${['relaxed', 'standard', 'sharp'][pf.assist]} timing (change in Settings).` });
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: 'Start', primary: true }] };
    }
    case 'settings': {
      const items = [
        { t: 'title', text: 'Settings', size: 42 },
        { t: 'row', id: 'set:sound', label: 'Sound', value: pf.sound ? 'On' : 'Off' },
        { t: 'row', id: 'set:hand', label: 'Batting hand', value: pf.hand === 1 ? 'Right' : 'Left' },
        { t: 'row', id: 'set:assist', label: 'Timing window', value: ['Relaxed', 'Standard', 'Sharp'][pf.assist] },
        { t: 'row', id: 'set:think', label: 'Auto Play thinking time', value: `${[2, 5, 8, 10][pf.thinkIdx]} s` },
        { t: 'para', text: 'Tap a row to change it. Use A− and A+ at the top of any screen to change the text size from 100% to 300%.' },
        { t: 'btn', id: 'set:restore', label: 'Restore purchase' },
      ];
      if (state.env.config.dev) items.push({ t: 'btn', id: 'set:dev', label: 'Developer: unlock all' });
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'howto': case 'about': case 'rules': {
      const doc = state.scene === 'howto' ? HOWTO : state.scene === 'about' ? ABOUT : RULES;
      const items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => drawFigure(ctx, it.key, w, h) } : it));
      return { items, paged: true, footer: [{ id: 'prev', label: 'Back' }, { id: 'next', label: state.ui.pageIdx >= state.ui.pageN - 1 ? 'Done' : 'Next', primary: true }] };
    }
    case 'results': {
      const rs = state.results;
      const items = [
        { t: 'title', text: rs.headline, size: 46, sub: rs.sub },
        { t: 'stat', label: 'Score', value: `${rs.runs}/${rs.wk}`, color: PAL.cream },
        { t: 'stat', label: 'Overs', value: rs.overs },
        { t: 'stat', label: 'Run rate', value: rs.rr },
        ...(rs.target != null ? [{ t: 'stat', label: 'Target', value: String(rs.target) }] : []),
        { t: 'stat', label: 'Fours and sixes', value: `${rs.fours} and ${rs.sixes}` },
        { t: 'stat', label: 'Best for this mode', value: String(rs.best), color: PAL.teal },
        { t: 'rule' },
        { t: 'h', text: 'Scorecard' },
        ...rs.card.map((c) => ({ t: 'stat', label: c.name, value: c.line, color: c.out ? '#ff9a8a' : PAL.cream })),
      ];
      const footer = [];
      if (rs.canReplay) footer.push({ id: 'replay', label: 'Replay the winning shot' });
      footer.push({ id: 'again', label: 'Play again', primary: true }, { id: 'menu', label: 'Menu' });
      return { items, footer };
    }
    case 'break': {
      const rs = state.results;
      const items = [
        { t: 'title', text: 'Innings break', size: 42, sub: rs.sub },
        { t: 'stat', label: 'You gave away', value: `${rs.runs}/${rs.wk}`, color: PAL.cream },
        { t: 'stat', label: 'Overs', value: rs.overs },
        { t: 'stat', label: 'Target to chase', value: String(rs.target), color: PAL.teal },
        { t: 'para', text: 'Now it is your turn to bat. Swipe on the ball, find the gaps, and beat the target.' },
      ];
      return { items, footer: [{ id: 'bat', label: 'Start batting', primary: true }] };
    }
    case 'demolimit': {
      const items = [
        { t: 'title', text: 'That was the free taste', size: 40 },
        { t: 'para', text: 'You have played the free matches in this web preview. The full game, with every mode, all grounds and unlimited play, is on iPhone and Android.' },
        { t: 'para', text: 'Auto Play is still free to watch.' },
      ];
      return { items, footer: [{ id: 'auto', label: 'Watch Auto Play' }, { id: 'menu', label: 'Menu', primary: true }] };
    }
    default: return { items: [], footer: [] };
  }
}

// ---- play rendering --------------------------------------------------------------------------------------------------
const fmtOvers = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

// Where the scoreboard ends (the radar, banners and over strip stay clear of it).
let hudBottom = 134;
// In-play text zoom: the scoreboard follows the Text size setting up to 200% so the pitch stays visible;
// every line is also shrunk to fit its width, so nothing ever clips.
const IN_PLAY_ZOOM_CAP = 2;
const inPlayScale = (state) => Math.min(scaleOf(state), IN_PLAY_ZOOM_CAP);
function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = 12) {
  let sz = size;
  ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > minSize && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}

function drawHudZoom(ctx, state, s) {
  const m = state.m, i = m.inn;
  const rrr = requiredRate(m), crr = runRate(m);
  const maxW = 548 - 22;
  const rows = [];
  rows.push({ t: `${i.runs}/${i.wk}   ${fmtOvers(i.balls)}/${m.overs} ov`, size: 34 * s, w: 700, col: '#fff' });
  if (i.target != null) {
    const need = Math.max(0, i.target - i.runs), bl = ballsLeft(m);
    rows.push({ t: need > 0 ? `Need ${need} from ${bl}` : 'Target reached', size: 24 * s, w: 700, col: PAL.gold });
    rows.push({ t: `RRR ${rrr > 40 ? '-' : rrr.toFixed(1)}   CRR ${crr.toFixed(1)}`, size: 19 * s, w: 500, col: 'rgba(255,244,224,0.85)' });
  } else {
    rows.push({ t: i.role === 'bowl' ? 'YOU ARE BOWLING' : `CRR ${crr.toFixed(1)}   ${ballsLeft(m)} left`, size: 22 * s, w: 700, col: PAL.gold });
  }
  const s0 = strikerOf(m);
  rows.push({ t: `${s0.name}* ${s0.runs} (${s0.balls})`, size: 20 * s, w: 600, col: PAL.gold });
  if (i.role === 'bat') rows.push({ t: `${bowlerOf(m).name} to bowl`, size: 18 * s, w: 500, col: 'rgba(255,244,224,0.7)' });
  const lh = 1.18;
  let h = 22;
  for (const r of rows) { r.fs = fitFont(ctx, r.t, r.size, maxW, r.w); h += r.fs * lh; }
  hudBottom = 10 + h;
  panel(ctx, { x: 12, y: 10, w: W - 24, h }, { radius: 26, top: 'rgba(36,26,62,0.92)', bottom: 'rgba(16,11,30,0.94)' });
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = 10 + 12;
  for (const r of rows) { y += r.fs * lh; ctx.font = `${r.w} ${r.fs}px ${SANS}`; ctx.fillStyle = r.col; ctx.fillText(r.t, 34, y - r.fs * 0.2); }
  const paused = state.paused;
  drawPill(ctx, R.pause, paused ? '▶' : 'II', { size: 28 });
  const hintsOut = state.scene === 'play' && m.hints <= 0;
  if (state.scene !== 'auto') drawPill(ctx, R.think, `?${m.hints}`, { size: 26, disabled: hintsOut || (m.phase !== 'ready' && m.phase !== 'runup' && m.phase !== 'flight' && m.phase !== 'aim' && m.phase !== 'live') });
  if (i.fh && m.rules.extras) textFill(ctx, 'FREE HIT', 360, hudBottom + 44, 30, { color: '#ffd34d', italic: true, stroke: 'rgba(80,20,10,0.8)' });
}

function drawHud(ctx, state) {
  const m = state.m, i = m.inn;
  const zs = inPlayScale(state);
  if (zs > 1.001) { drawHudZoom(ctx, state, zs); return; }
  hudBottom = 134;
  panel(ctx, { x: 12, y: 10, w: W - 24, h: 124 }, { radius: 26, top: 'rgba(36,26,62,0.88)', bottom: 'rgba(16,11,30,0.9)' });
  textFill(ctx, `${i.runs}/${i.wk}`, 34, 82, 62, { align: 'left', weight: 700, color: '#fff' });
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${fmtOvers(i.balls)} / ${m.overs} ov`, 36, 114);
  // middle: target or batting side
  const rrr = requiredRate(m), crr = runRate(m);
  ctx.textAlign = 'left';
  if (i.target != null) {
    ctx.font = `700 17px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.fillText(`TARGET ${i.target}`, 232, 54);
    const need = Math.max(0, i.target - i.runs), bl = ballsLeft(m);
    ctx.font = `700 25px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(need > 0 ? `Need ${need} from ${bl}` : 'Target reached', 232, 86);
    ctx.font = `500 20px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(`RRR ${rrr > 40 ? '-' : rrr.toFixed(1)}   CRR ${crr.toFixed(1)}`, 232, 116);
  } else {
    ctx.font = `700 17px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.fillText(i.role === 'bowl' ? 'YOU ARE BOWLING' : 'BATTING', 232, 54);
    ctx.font = `700 25px ${SANS}`; ctx.fillStyle = '#fff'; ctx.fillText(`CRR ${crr.toFixed(1)}`, 232, 86);
    ctx.font = `500 20px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(`${ballsLeft(m)} balls left`, 232, 116);
  }
  if (i.fh && m.rules.extras) { ctx.fillStyle = PAL.coral; rr(ctx, 232, 112, 108, 0, 0); }
  // buttons
  const paused = state.paused;
  drawPill(ctx, R.pause, paused ? '▶' : 'II', { size: 28 });
  const hintsOut = state.scene === 'play' && m.hints <= 0;
  if (state.scene !== 'auto') drawPill(ctx, R.think, `?${m.hints}`, { size: 26, disabled: hintsOut || (m.phase !== 'ready' && m.phase !== 'runup' && m.phase !== 'flight' && m.phase !== 'aim' && m.phase !== 'live') });
  // batters strip
  const s0 = strikerOf(m), s1 = nonStrikerOf(m);
  if (i.role === 'bat') {
    ctx.font = `600 21px ${SANS}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = PAL.gold; ctx.fillText(`${s0.name}* ${s0.runs} (${s0.balls})`, 22, 164);
    ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.textAlign = 'left'; ctx.fillText(`${s1.name} ${s1.runs} (${s1.balls})`, 232, 164);
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,244,224,0.7)'; ctx.fillText(`${bowlerOf(m).name} to bowl`, W - 22, 164);
    ctx.textAlign = 'left';
  } else {
    ctx.font = `600 21px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillText(`${s0.name}* ${s0.runs} (${s0.balls})`, 22, 164); ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(`${s1.name} ${s1.runs} (${s1.balls})`, 232, 164);
  }
  if (i.fh && m.rules.extras) { textFill(ctx, 'FREE HIT', 360, 205, 30, { color: '#ffd34d', italic: true, stroke: 'rgba(80,20,10,0.8)' }); }
}

function drawOverStrip(ctx, state) {
  const m = state.m, i = m.inn;
  const toks = i.over.slice(-8);
  const legalDone = i.balls % 6;
  const y = 1236;
  const n = Math.max(6, toks.length);
  const x0 = 360 - (n * 54) / 2 + 27;
  for (let k = 0; k < n; k++) {
    const tkn = toks[k];
    const x = x0 + k * 54;
    ctx.fillStyle = tkn ? tokenColor(tkn) : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, 21, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    if (tkn) { textFill(ctx, tkn, x, y + 8, tkn.length > 2 ? 15 : 21, { font: SANS, weight: 700, color: '#fff', shadow: false }); }
  }
}
function tokenColor(t) {
  if (t === 'W') return '#d8443a';
  if (t === '6') return '#9a52d9';
  if (t === '4') return '#2a8fd0';
  if (t === '.') return '#4c4660';
  if (t.includes('Wd') || t.includes('Nb')) return '#d98a2a';
  return '#3f8f5a';
}

function drawCall(ctx, state, y) {
  const m = state.m, c = m.call;
  if (!c) return;
  const age = c.t;
  const dur = c.big ? 1.9 : 1.5;
  if (c.pin && age < 2.6) { /* intro banner stays up */ } else if (age > dur || (m.phase !== 'result' && m.phase !== 'live' && age > 0.6 && m.phase !== 'overbreak')) return;
  const dd = c.pin ? 2.6 : dur;
  const a = clamp(1 - Math.max(0, age - (dd - 0.4)) / 0.4, 0, 1) * clamp(age / 0.08, 0, 1);
  const sc = c.big ? lerp(1.3, 1, ease.back(clamp(age / 0.3, 0, 1))) : lerp(0.92, 1, clamp(age / 0.2, 0, 1));
  const colors = { six: ['#fff3a8', '#ff9d2b'], four: ['#d4fff2', '#2ec4b6'], wicket: ['#ffd9d0', '#ff5a48'], extra: ['#fff0c0', '#ff9d3d'], run: ['#ffffff', '#ffe08a'], dot: ['#eeeaf6', '#b9b0d0'], info: ['#fff4dc', '#ffcf6b'] };
  const col = colors[c.kind] ?? colors.info;
  // headline word (up to the first punctuation) is shown big, the rest as a smaller line
  const mt = /^([A-Z][A-Z' ]*!)\s*(.*)$/.exec(c.text);
  const head = mt && c.big ? mt[1] : null, rest = mt && c.big ? mt[2] : c.text;
  ctx.save();
  ctx.globalAlpha = a; ctx.translate(360, y); ctx.scale(sc, sc);
  const hs = 76, bs = c.big ? 30 : 32;
  ctx.font = `italic 700 ${bs}px ${FONT}`;
  const lines = wrapLines(ctx, rest, 560).slice(0, 3);
  const hh = (head ? hs * 0.95 : 0) + lines.length * bs * 1.2 + 26;
  rr(ctx, -310, -hs * 0.8 - 12, 620, hh, 30); ctx.fillStyle = 'rgba(14,10,26,0.66)'; ctx.fill();
  ctx.strokeStyle = col[1]; ctx.lineWidth = 3; ctx.stroke();
  let yy = -hs * 0.8 + (head ? hs * 0.85 : bs * 0.9);
  if (head) { textFill(ctx, head, 0, yy - 6, hs * (head.length > 9 ? 0.8 : 1), { italic: true, grad: [[0, col[0]], [1, col[1]]], stroke: 'rgba(40,10,10,0.75)' }); yy += hs * 0.2 + 6; }
  lines.forEach((l, k) => { textFill(ctx, l, 0, yy + k * bs * 1.2, bs, { italic: true, color: '#fff4dc', stroke: 'rgba(30,10,10,0.6)' }); });
  ctx.restore();
}

function timingChip(ctx, state, y) {
  const m = state.m, r = m.res;
  if (!r || !r.label || !m.sw) return;
  const age = state.v.sinceSwing;
  if (age > 1.3) return;
  const col = r.label.startsWith('PERFECT') ? '#ffd34d' : r.label.startsWith('GOOD') ? '#8be07a' : r.label.includes('WAY') ? '#ff6b57' : '#ffb347';
  const a = clamp(1 - Math.max(0, age - 0.9) / 0.4, 0, 1);
  ctx.save(); ctx.globalAlpha = a; ctx.translate(360, y - Math.min(age, 0.4) * 30);
  const txt = r.kind === 'miss' ? (r.why === 'out of reach' ? 'OUT OF REACH' : r.label) : r.label;
  textFill(ctx, txt, 0, 0, 36, { italic: true, color: col, stroke: 'rgba(20,10,10,0.8)' });
  ctx.restore();
}

function drawBowlerIntro(ctx, state) {
  // hint line for batters
}

export function renderPlay(ctx, state) {
  const m = state.m, v = state.v;
  const t = state.t;
  const live = !!m.live && (m.phase === 'live' || (m.phase === 'result' && m.live));
  const useOver = live || state.scene === 'replay';
  ctx.save();
  if (v.shake > 0.1) ctx.translate((Math.sin(t * 90) * v.shake), (Math.cos(t * 77) * v.shake * 0.7));
  if (m.phase === 'contact') { const z = 1 + 0.06 * clamp(m.pt / 0.13, 0, 1); ctx.translate(360, 760); ctx.scale(z, z); ctx.translate(-360, -760); }
  if (useOver) renderOverhead(ctx, state); else renderDeliveryView(ctx, state);
  ctx.restore();
  drawParticles(ctx, v.parts);
  if (v.flash > 0.01) { ctx.fillStyle = `rgba(255,248,220,${v.flash})`; ctx.fillRect(0, 0, W, H); }
  if (state.scene === 'replay') { renderReplayHud(ctx, state); return; }
  drawHud(ctx, state);
  const human = m.inn.role === 'bat' && !m.inn.ai;
  if (!useOver) {
    const showRadar = m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight';
    if (showRadar) {
      const o = { cands: [] };
      if (state.touch.aimDeg != null) o.aim = state.touch.aimDeg;
      if (state.scene === 'auto' && state.auto.revealing && m.aiPlan) { if (m.aiPlan.kind === 'swing') { o.aim = m.aiPlan.angle; o.cands = [...(m.aiPlan.top ?? []).map((c) => ({ angle: c.angle, boundary: c.boundary })), { angle: m.aiPlan.angle, chosen: true, boundary: m.aiPlan.best?.boundary }]; } }
      if (state.think.open && state.think.plan?.kind === 'swing') { o.aim = state.think.plan.angle; o.aimColor = 'rgba(120,255,200,0.4)'; }
      drawRadar(ctx, m, { ...R.radar, y: Math.max(R.radar.y, hudBottom + 10) }, o);
    }
  }
  timingChip(ctx, state, useOver ? Math.max(252, hudBottom + 60) : 700);
  if (!state.paused) drawCall(ctx, state, useOver ? Math.max(300, hudBottom + 110) : Math.max(330, hudBottom + 120));
  drawOverStrip(ctx, state);
  if (state.scene === 'play' && human) drawBattingControls(ctx, state, useOver);
  if (state.scene === 'play' && m.inn.role === 'bowl') drawBowlingUi(ctx, state);
  if (m.phase === 'overbreak' && m.inn.role === 'bowl') drawFieldPicker(ctx, state);
  if (state.scene === 'auto') drawAutoPanel(ctx, state);
  if (state.think.open) drawThink(ctx, state);
  if (state.paused && state.scene !== 'auto') drawPauseMenu(ctx, state);
  if (m.phase === 'inningsEnd') { ctx.fillStyle = 'rgba(10,6,24,0.35)'; ctx.fillRect(0, 0, W, H); }
}

function renderDeliveryView(ctx, state) {
  drawDelivery(ctx, { ...state.v, m: state.m });
}

function renderOverhead(ctx, state) {
  const m = state.m, v = state.v, L = m.live, th = THEMES[m.theme];
  const hand = m.hand;
  ctx.save();
  if (hand === -1) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  drawOverheadGround(ctx, m.theme);
  ctx.restore();
  // scoring-view helpers use right-handed coordinates mirrored via toScreen hand
  const tx = (x, z) => { const p = toScreen(m.theme, x * hand, z); return p; };
  // runners
  const rn = L?.run;
  const bats = [];
  if (L && rn) {
    for (let k = 0; k < 2; k++) {
      const from = rn.from[k], to = 1 - from;
      const u = rn.mode === 'run' ? rn.u[k] : (rn.mode === 'start' ? 0 : 0);
      const z = lerp(from === 0 ? 0 : th.pitchLen, to === 0 ? 0 : th.pitchLen, u) ;
      const rz = rn.mode === 'run' ? z : (from === 0 ? 0 : th.pitchLen);
      const heading = to === 0 ? -1 : 1;
      bats.push({ k, x: (k === 0 ? 0.55 : -0.55) * (from === 0 ? 1 : 1), z: rz + (from === 0 && rn.mode !== 'run' ? -0.6 : from === 1 && rn.mode !== 'run' ? 0.6 : 0), fz: rn.mode === 'run' ? heading : (from === 0 ? 1 : -1), run: rn.mode === 'run' ? 1 : 0, striker: k === 0 });
    }
  } else {
    bats.push({ x: 0.55, z: -0.6, fz: 1, striker: true, run: 0 }, { x: -0.55, z: th.pitchLen + 0.6, fz: -1, run: 0 });
  }
  // stumps (overhead dots)
  for (const z of [0, th.pitchLen]) { const [sx, sy] = tx(0, z); ctx.fillStyle = '#f4e1b0'; ctx.fillRect(sx - 8, sy - 2, 16, 4); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx - 8 - 3, sy + 1, 16, 3); }
  for (const f of m.field) {
    const [sx, sy] = tx(f.x, f.z);
    const ff = { ...f, x: f.x * hand };
    drawFieldFigure(ctx, m.theme, { ...ff, fx: f.fx * hand }, { t: state.t, arms: (L && L.holder === f.id) ? 1 : 0, label: (L && (f.id === L.chaser || L.holder === f.id) && !L?.dead) ? f.name : null, ring: (L && L.holder === f.id) ? '#ffd34d' : null });
  }
  for (const b of bats) drawBatterTop(ctx, m.theme, b.x * hand, b.z, { striker: b.striker, fz: b.fz, run: b.run, t: state.t });
  // where a lofted ball will first land
  if (L && L.bs === 'track' && L.track.bounces.length && L.i < L.track.bounces[0] && L.track.bounces[0] > 14) {
    const bi = L.track.bounces[0], tp = [L.track.p[bi * 3], L.track.p[bi * 3 + 2]];
    const [lx, ly] = toScreen(m.theme, tp[0] * hand, tp[1]);
    const pr = 1 + 0.12 * Math.sin(state.t * 10);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.ellipse(lx, ly, 17 * pr, 11 * pr, 0, 0, 7); ctx.stroke(); ctx.restore();
  }
  // ball
  if (state.scene === 'replay' && state.replay) {
    const r = state.replay, idx = Math.min(Math.floor(r.i), r.n - 1);
    drawTopBall(ctx, m.theme, [r.p[idx * 3] * hand, r.p[idx * 3 + 1], r.p[idx * 3 + 2]], v, 1.2);
  } else if (L) {
    const bp = ballPos(m);
    drawTopBall(ctx, m.theme, [bp[0] * hand, bp[1], bp[2]], v, 1);
  }
  // aim ghost (Think)
  if (state.think.open && state.think.plan?.kind === 'swing') {
    const a = state.think.plan.angle * DEG; const [px, py] = tx(0, 0);
    ctx.strokeStyle = 'rgba(120,255,200,0.9)'; ctx.setLineDash([14, 10]); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * hand * 300, py - Math.cos(a) * 300); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawBattingControls(ctx, state, over) {
  const m = state.m, L = m.live, v = state.v;
  if (over && L && !L.dead && !L.over && m.phase === 'live') {
    const rn = L.run;
    const label = rn.mode === 'rest' ? 'RUN' : rn.mode === 'start' ? 'GO!' : (rn.q ? 'RUN AGAIN: queued (tap to cancel)' : 'RUN AGAIN?');
    const forced = L.forced;
    const pulse = 1 + Math.sin(state.t * 8) * 0.03;
    ctx.save(); ctx.translate(R.run.x + R.run.w / 2, R.run.y + R.run.h / 2); ctx.scale(pulse, pulse); ctx.translate(-(R.run.x + R.run.w / 2), -(R.run.y + R.run.h / 2));
    drawButton(ctx, R.run, label, { primary: rn.mode === 'rest' || rn.mode === 'start', active: rn.q, size: 40 });
    ctx.restore();
    state._ui.run = R.run;
  }
  if (!over && (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight')) {
    const a = clamp(1 - (m.inn.balls / 8), 0.25, 1);
    const zs = inPlayScale(state), msg = m.phase === 'flight' ? 'SWIPE NOW' : m.phase === 'runup' ? 'Wait for the ball...' : 'Read the field. Swipe the gap. Tap to block.';
    fitFont(ctx, msg, 24 * zs, 680, 600); ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,244,220,${0.85 * a})`;
    ctx.fillText(msg, 360, 1176);
  }
  // first-balls coach: a ghost finger shows the swipe
  if (!over && (state.prefs.coach ?? 0) < 6 && (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight') && !state.touch.down) {
    const u = (state.t * 0.8) % 1.5, k = clamp(u / 0.8, 0, 1), e = ease.out(k);
    const x0 = 290, y0 = 1010, x1 = 468, y1 = 760, gx = lerp(x0, x1, e), gy = lerp(y0, y1, e);
    const al = u < 1.1 ? 1 : clamp(1 - (u - 1.1) / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.85 * al;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(gx, gy); ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,220,0.9)'; ctx.beginPath(); ctx.arc(gx, gy, 30, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    const zs = inPlayScale(state), msg = 'Swipe the way you want the ball to go';
    fitFont(ctx, msg, 26 * zs, 680, 700); ctx.textAlign = 'center'; ctx.fillStyle = PAL.gold; ctx.fillText(msg, 360, 1130 - 30 * (zs - 1));
  }
  // live swipe feedback
  const tc = state.touch;
  if (!over && tc.down && tc.committed && tc.path.length > 1) {
    ctx.strokeStyle = tc.committed ? 'rgba(255,207,107,0.95)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = tc.committed ? 10 : 6; ctx.lineCap = 'round';
    ctx.beginPath(); tc.path.slice(-8).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
}

// ---- bowling UI ---------------------------------------------------------------------------------------------------------
export const PITCHMAP = { x: 150, y: 250, w: 420, h: 640, xr: 1.7, z0: -0.8, z1: 9.8 };
export const toMap = (x, z) => [PITCHMAP.x + PITCHMAP.w / 2 + (x / PITCHMAP.xr) * (PITCHMAP.w / 2), PITCHMAP.y + PITCHMAP.h - ((z - PITCHMAP.z0) / (PITCHMAP.z1 - PITCHMAP.z0)) * PITCHMAP.h];
export const fromMap = (sx, sy) => [((sx - PITCHMAP.x - PITCHMAP.w / 2) / (PITCHMAP.w / 2)) * PITCHMAP.xr, PITCHMAP.z0 + ((PITCHMAP.y + PITCHMAP.h - sy) / PITCHMAP.h) * (PITCHMAP.z1 - PITCHMAP.z0)];
export const TYPE_CHIPS = TYPE_KEYS.filter((k) => k !== 'wide').map((k, i) => ({ k, rect: { x: 14 + (i % 4) * 174, y: 1070 + Math.floor(i / 4) * 62, w: 166, h: 54 } }));

function drawBowlingUi(ctx, state) {
  const m = state.m;
  if (m.phase !== 'aim') return;
  const a = m.aim, P = PITCHMAP;
  ctx.fillStyle = 'rgba(10,6,24,0.78)'; ctx.fillRect(0, 190, W, 1090);
  panel(ctx, { x: P.x - 14, y: P.y - 14, w: P.w + 28, h: P.h + 28 }, { radius: 24 });
  // pitch strip
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, '#9c8a5c'); g.addColorStop(1, '#cdb987'); ctx.fillStyle = g; rr(ctx, P.x, P.y, P.w, P.h, 14); ctx.fill();
  const bands = [[0.4, 1.2, 'Yorker', '#ff6b57'], [1.6, 3.0, 'Full', '#ff9d3d'], [3.1, 4.8, 'Good length', '#ffd34d'], [4.9, 6.6, 'Short', '#7ac05a'], [6.7, 8.6, 'Bouncer', '#2ec4b6']];
  for (const [z0, z1, name, col] of bands) {
    const [, y0] = toMap(0, z1), [, y1] = toMap(0, z0);
    ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fillRect(P.x, y0, P.w, y1 - y0); ctx.globalAlpha = 1;
    ctx.font = `600 18px ${SANS}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(name, P.x + P.w - 10, (y0 + y1) / 2 + 6);
  }
  const [sx0, sy0] = toMap(0, 0);
  // stumps at the batter end
  drawStumps(ctx, sx0, sy0 + 28, 220, 0, false);
  // batter silhouette
  ctx.fillStyle = 'rgba(40,30,70,0.5)'; ctx.beginPath(); ctx.ellipse(sx0 - 70, sy0 + 20, 30, 14, 0, 0, 7); ctx.fill();
  // off/leg labels
  ctx.font = `600 18px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.textAlign = 'left'; ctx.fillText(m.hand === 1 ? 'Leg' : 'Off', P.x + 8, P.y + 26); ctx.textAlign = 'right'; ctx.fillText(m.hand === 1 ? 'Off' : 'Leg', P.x + P.w - 8, P.y + 26);
  // reticle with error ellipse
  const [rx, ry] = toMap(a.tx * m.hand, a.tz);
  const ex = (0.06 + 0.22 * a.pace) / P.xr * (P.w / 2), ey = (0.06 + 0.22 * a.pace) * 3.2 / (P.z1 - P.z0) * P.h;
  ctx.strokeStyle = 'rgba(255,207,107,0.9)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(rx, ry, ex, ey, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rx, ry, 14, 0, 7); ctx.moveTo(rx - 24, ry); ctx.lineTo(rx + 24, ry); ctx.moveTo(rx, ry - 24); ctx.lineTo(rx, ry + 24); ctx.stroke();
  drawBall(ctx, rx, ry, 9, THEMES[m.theme].ball, 0.7);
  // pace meter
  const T = TYPES[a.type];
  const spd = T.speed[0] + (T.speed[1] - T.speed[0]) * a.pace;
  ctx.font = `700 22px ${SANS}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(`${T.name}   ${(spd * 3.6).toFixed(0)} km/h   accuracy ${Math.round((1 - a.pace) * 70 + 30)}%`, 360, 214);
  ctx.font = `500 20px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.fillText(T.cue, 360, 238);
  // type chips
  TYPE_CHIPS.forEach((c) => drawButton(ctx, c.rect, TYPES[c.k].name, { active: a.type === c.k, size: 22 }));
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.textAlign = 'center';
  ctx.fillText('Drag the ring to aim. Flick UP anywhere below the pitch to bowl.', 360, 1048);
  // flick feedback
  const tc = state.touch;
  if (tc.down && tc.path.length > 1 && tc.mode === 'flick') { ctx.strokeStyle = 'rgba(255,207,107,0.9)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); tc.path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
}

export const FIELD_CHIPS = PRESET_KEYS.map((k, i) => ({ k, rect: { x: 18 + (i % 2) * 346, y: 720 + Math.floor(i / 2) * 110, w: 338, h: 100 } }));
export const GO = { x: 150, y: 1060, w: 420, h: 120 };
function drawFieldPicker(ctx, state) {
  const m = state.m;
  ctx.fillStyle = 'rgba(10,6,24,0.8)'; ctx.fillRect(0, 190, W, 1090);
  textFill(ctx, 'Set your field', 360, 250, 44, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.5)' });
  drawRadar(ctx, m, { x: 190, y: 270, w: 340, h: 340 }, {});
  ctx.font = `600 22px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.9)'; ctx.textAlign = 'center';
  ctx.fillText(PRESETS[m.fieldPick].blurb, 360, 660);
  FIELD_CHIPS.forEach((c) => drawButton(ctx, c.rect, PRESETS[c.k].name, { active: m.fieldPick === c.k, sub: PRESETS[c.k].blurb, size: 28 }));
  drawButton(ctx, GO, 'Next over', { primary: true, size: 40 });
}

// ---- think / pause / auto ---------------------------------------------------------------------------------------------------
function drawThink(ctx, state) {
  const th = state.think;
  const zs = inPlayScale(state);
  const bottom = 1030, maxH = bottom - Math.max(hudBottom + 20, 200);
  // shrink the text just enough that every line fits above the button
  let fs = 25 * zs, wrapped;
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    wrapped = th.lines.map((line) => wrapLines(ctx, line, 620));
    const n = wrapped.reduce((a, w) => a + w.length, 0);
    const need = 96 + n * fs * 1.32 + wrapped.length * 8;
    if (need <= maxH || fs <= 14) { wrapped.need = need; break; }
    fs -= 1;
  }
  const r = { x: 24, y: Math.min(700, bottom - wrapped.need - 10), w: 672, h: 0 };
  r.h = 1130 - r.y;
  const top0 = Math.max(190, hudBottom + 4);
  ctx.fillStyle = 'rgba(8,5,20,0.55)'; ctx.fillRect(0, top0, W, H - top0);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', 360, r.y + 52, 38, { italic: true, grad: [[0, '#d4fff2'], [1, '#2ec4b6']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2;
  for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, 48, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, { x: 200, y: 1040, w: 320, h: 70 }, 'Got it', { primary: true, size: 30 });
}

function drawPauseMenu(ctx, state) {
  ctx.fillStyle = 'rgba(8,5,20,0.72)'; ctx.fillRect(0, 0, W, H);
  textFill(ctx, 'Paused', 360, 360, 66, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.5)' });
  const fs = 30 * Math.min(inPlayScale(state), 1.5);
  drawButton(ctx, { x: 160, y: 430, w: 400, h: 96 }, 'Resume', { primary: true, size: fs });
  drawButton(ctx, { x: 160, y: 550, w: 400, h: 96 }, state.prefs.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, { x: 160, y: 670, w: 400, h: 96 }, 'Quit to menu', { danger: true, size: fs });
}

function drawAutoPanel(ctx, state) {
  const a = state.auto, m = state.m;
  // bottom controls
  drawButton(ctx, R.speed, `x${a.speed}`, { size: 26 });
  drawButton(ctx, R.autoPause, state.paused ? 'RESUME' : 'PAUSE', { primary: state.paused, size: 28 });
  drawButton(ctx, R.autoThinkDec, '−', { size: 32 }); drawButton(ctx, R.autoThinkInc, '+', { size: 32 });
  ctx.font = `500 16px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.textAlign = 'center'; ctx.fillText(`think ${[2, 5, 8, 10][state.prefs.thinkIdx]}s`, 644, 1190);
  drawPill(ctx, { x: 18, y: 1130, w: 96, h: 56 }, 'Exit', { size: 24 });
  // reasoning card
  const lines = a.lines;
  if (!lines.length) return;
  const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
  const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
  const r = { x: 18, y: 0, w: 684, h: 0 };
  const zs = inPlayScale(state);
  let fs = 21 * zs, wrapped;
  const maxH = 1110 - Math.max(hudBottom + 160, 340);
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, 640));
    if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= 14) break;
    fs -= 1;
  }
  r.h = 58 + wrapped.length * fs * 1.33 + 14; r.y = 1110 - r.h;
  panel(ctx, r, { radius: 22, top: 'rgba(14,10,30,0.85)', bottom: 'rgba(14,10,30,0.8)' });
  textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, italic: true, weight: 700 });
  const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
  ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; let y = r.y + 58 + fs * 1.05;
  for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  if (state.paused) { textFill(ctx, 'PAUSED', 360, 1100, 56, { italic: true, color: '#fff', stroke: 'rgba(40,10,10,0.7)' }); }
}

function renderReplayHud(ctx, state) {
  textFill(ctx, 'WINNING SHOT', 360, 120, 54, { italic: true, grad: [[0, '#fff3a8'], [1, '#ff9d2b']], stroke: 'rgba(60,20,10,0.6)' });
  const sn = state.replay?.shot;
  if (sn) textFill(ctx, sn, 360, 172, 34, { italic: true, color: '#fff4dc' });
  drawButton(ctx, { x: 160, y: 1130, w: 400, h: 100 }, 'Continue', { primary: true });
}

export function renderScene(ctx, state) {
  const sc = state.scene;
  if (sc === 'play' || sc === 'auto' || sc === 'replay') { renderPlay(ctx, state); return; }
  if (sc === 'pageloading') return;
  columnScreen(ctx, state, sceneSpec(state));
}
