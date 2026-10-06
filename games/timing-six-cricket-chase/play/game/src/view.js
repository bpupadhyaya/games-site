// All drawing for screens and the in-play HUD. Reads `state`; the only thing it writes is state._ui (hit
// rectangles for the update step), which is non-enumerable so it never enters getState().
import { THEMES, LEVELS, clamp, lerp, ease, DEG } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow, drawBall, drawParticles, shade, vGrad, mix, KIT, drawStumps, drawBin } from './art.js';
import { drawDelivery, drawOverheadGround, drawFieldFigure, drawBatterTop, drawTopBall, drawRadar, toScreen, drawBackdrop, CAM, makeProj, OH } from './scene.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, maxScroll, scrollbar, inRect } from './ui.js';
import { LY, host, placeBowl, placeField } from './layout.js';
import { drawLockup } from './brand.js';
import { drawFigure } from './figures.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { MODES, strikerOf, nonStrikerOf, bowlerOf, ballsLeft, requiredRate, runRate, ballPos, currentRunTime } from './engine.js';
import { TYPES, TYPE_KEYS } from './ball.js';
import { PRESETS, PRESET_KEYS, SECTOR_NAMES } from './field.js';

const CREDITS_3D = [
  '# 3D people and credits',
  'The people in the batter\'s-eye view are real-time 3D athletes. Characters: Microsoft Rocketbox Avatar Library (MIT licence, copyright 2020 Microsoft), textures repainted. Motion data: Quaternius Universal Animation Library (CC0), Carnegie Mellon University Graphics Lab Motion Capture Database (mocap.cs.cmu.edu, funded by NSF EIA-0196217, BVH conversion by Bruce Hahne). Rendering: three.js, copyright 2010-2024 three.js authors, MIT licence.',
  'The MIT licence grants permission, free of charge, to use, copy, modify, merge, publish, distribute, sublicense and sell copies of the software, provided the copyright notice and this permission notice are included. The software is provided as is, without warranty of any kind.',
];
const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(state, ui) { if (!('_ui' in state)) hidden(state, '_ui', ui); else state._ui = ui; }

export const scaleOf = (state) => TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)];


// ---- backgrounds -------------------------------------------------------------------------------------------------
// The sunset backdrop fills the live virtual size: x follows the width, y is the 1280-unit portrait design squeezed or stretched to the height
// (the sun stays round). Pure function of (size, t).
export function drawMenuBackdrop(ctx, state, t) {
  const VW = LY.w, VH = LY.h, ys = VH / 1280;
  ctx.fillStyle = vGrad(ctx, 0, VH, [[0, '#26407a'], [0.22, '#6a5a98'], [0.42, '#e0806a'], [0.6, '#ffb36b'], [0.72, '#ffd98a'], [0.73, '#4d3a5e'], [1, '#1c1230']]);
  ctx.fillRect(0, 0, VW, VH);
  const sx = VW * (LY.land ? 0.62 : 0.65), sy = 800 * ys;
  glow(ctx, sx, sy, 560, 'rgba(255,226,150,A)', 0.7);
  ctx.fillStyle = '#fff3c8'; ctx.beginPath(); ctx.arc(sx, sy, 76 + Math.sin(t * 0.8) * 2, 0, 7); ctx.fill();
  glow(ctx, sx, sy, 140, 'rgba(255,255,235,A)', 0.8);
  ctx.save(); ctx.scale(1, ys);
  // clouds
  for (let i = 0; i < 6 + (LY.land ? 4 : 0); i++) { const cx = ((i * 190 + t * 6) % (VW + 300)) - 150, cy = 120 + (i * 83) % 460; ctx.fillStyle = 'rgba(255,200,170,0.28)'; ctx.beginPath(); ctx.ellipse(cx, cy, 130, 15, 0, 0, 7); ctx.ellipse(cx + 40, cy - 9, 80, 12, 0, 0, 7); ctx.fill(); }
  // skyline of trees and floodlights against the sun
  ctx.fillStyle = 'rgba(52,32,70,0.92)';
  ctx.beginPath(); ctx.moveTo(0, 940); for (let x = 0; x <= VW; x += 20) ctx.lineTo(x, 905 - Math.abs(Math.sin(x * 0.045 + 1)) * 40 - Math.abs(Math.sin(x * 0.011)) * 28); ctx.lineTo(VW, 1280); ctx.lineTo(0, 1280); ctx.closePath(); ctx.fill();
  for (const x of [70, VW - 70]) { ctx.fillStyle = 'rgba(52,32,70,0.95)'; ctx.fillRect(x - 3, 690, 6, 250); ctx.fillRect(x - 34, 660, 68, 36); ctx.fillStyle = 'rgba(255,238,190,0.9)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x - 30 + i * 16, 664 + j * 15, 12, 10); }
  // pitch and stumps silhouette in the foreground
  const px = VW / 2;
  ctx.fillStyle = 'rgba(40,26,58,0.95)'; ctx.beginPath(); ctx.moveTo(px - 60, 940); ctx.lineTo(px + 60, 940); ctx.lineTo(px + 200, 1280); ctx.lineTo(px - 200, 1280); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,0.16)'; ctx.beginPath(); ctx.moveTo(px - 42, 940); ctx.lineTo(px + 42, 940); ctx.lineTo(px + 140, 1280); ctx.lineTo(px - 140, 1280); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,226,170,0.9)'; for (const dx of [-7, 0, 7]) ctx.fillRect(px + dx - 1.2, 920, 2.4, 22);
  // stars
  for (let i = 0; i < 40 + (LY.land ? 30 : 0); i++) { const a = 0.35 + 0.35 * Math.sin(t * 1.5 + i); ctx.fillStyle = `rgba(255,255,255,${a * 0.55})`; ctx.fillRect((i * 97) % VW, (i * 53) % 260, 2, 2); }
  ctx.restore();
  if (state.scene !== 'title') { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, 'rgba(12,8,28,0.62)'); g.addColorStop(1, 'rgba(12,8,28,0.72)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
}

function drawHero(ctx, w, h, state) {
  const t = state.t;
  const cx = w / 2;
  const th = Math.max(60, h - 34);   // the title block leaves room for the tagline line at the bottom of the hero
  const base = Math.max(th * 0.34, 90);
  textFill(ctx, 'GOLDEN HOUR', cx, base, Math.min(w * 0.115, th * 0.25), { italic: true, grad: [[0, '#fff3c2'], [0.6, '#ffc54d'], [1, '#ff8a3d']], stroke: 'rgba(70,24,10,0.65)' });
  const s1 = Math.min(w * 0.115, th * 0.25), s2 = Math.min(w * 0.17, th * 0.38);
  textFill(ctx, 'CRICKET', cx, Math.max(base + (th * 0.62 - th * 0.34), base + s1 * 0.2 + s2 * 0.85), s2, { italic: true, grad: [[0, '#ffffff'], [0.6, '#ffe6b0'], [1, '#ffb347']], stroke: 'rgba(70,24,10,0.65)' });
  // ball arcing over the title
  const u = (t * 0.45) % 1;
  const bx = lerp(w * 0.08, w * 0.92, u), by = h * 0.86 - Math.sin(u * Math.PI) * h * 0.6;
  for (let i = 1; i < 10; i++) { const uu = Math.max(0, u - i * 0.012); glow(ctx, lerp(w * 0.08, w * 0.92, uu), h * 0.86 - Math.sin(uu * Math.PI) * h * 0.6, 12 - i, 'rgba(255,210,150,A)', 0.5 - i * 0.045); }
  drawBall(ctx, bx, by, 15, 'leather', t * 12);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center';
  const tag = 'Swipe to bat. Flick to bowl. Beat the sunset.', ts = scaleOf(state);
  fitFont(ctx, tag, Math.min(24, w * 0.036) * Math.min(ts, 2.2), w - 40, 600, SANS, LY.minText);
  ctx.fillText(tag, cx, h - 12);
}

// A- / A+ and the current size: top right in portrait, a stack in the right margin in landscape (top-left belongs to the host's back button).
function zoomPills(ctx, state) {
  const s = state.prefs.textIdx, z = LY.zoom;
  drawPill(ctx, z.dec, 'A−', { disabled: s === 0 });
  drawPill(ctx, z.inc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 ${Math.max(22, LY.minText)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, z.label.x, z.label.y);
}

// Generic scrolling-column screen with optional fixed footer buttons. Everything scrolls (drag, wheel, keys, the scroll bar in the right gutter).
function columnScreen(ctx, state, spec) {
  const s = scaleOf(state);
  drawMenuBackdrop(ctx, state, state.t);
  zoomPills(ctx, state);
  const col = spec.col ?? LY.col;
  if (spec.hero) { ctx.save(); ctx.translate(spec.hero.x, spec.hero.y); drawHero(ctx, spec.hero.w, spec.hero.h, state); ctx.restore(); }
  const fy = footerLayout(ctx, spec.footer ?? [], s, col);
  const lk = spec.lockup ? lockupBox(col) : null;
  const top = col.top, bottom = fy.top - 10 - (lk ? lk.h + 24 : 0);
  const view = { x: col.x, y: top, w: col.w, h: Math.max(80, bottom - top) };
  const gutter = 26, contentW = view.w - gutter;
  const lay = layoutColumn(ctx, spec.items, contentW, s, { cols: spec.cols ?? 1 });
  const maxS = maxScroll(lay, view.h);
  const sc = clamp(state.ui.scroll, 0, maxS);
  state.ui.scroll = sc;
  const hits = drawColumn(ctx, lay, { x: view.x, y: view.y, w: contentW, h: view.h }, sc, s, state, null);
  const bar = { x: view.x + view.w - 14, y: view.y, w: 10, h: view.h };
  const thumb = scrollbar(ctx, bar, sc, lay.total, view.h);
  for (const b of fy.buttons) drawButton(ctx, b.rect, b.label, { primary: b.primary, disabled: b.disabled, size: b.size, sub: b.sub, active: b.active });
  let lockTap = null;
  if (lk) {   // bottom centre, directly under the last row of buttons (pinned to the bottom when the menu scrolls)
    const ly = Math.min(view.y + Math.min(lay.total, view.h) + 12, bottom + 10);
    const lx = col.x + col.w / 2, m = 44 / Math.max(0.2, host.px || 0.54);
    ctx.save(); ctx.fillStyle = state.lockDown > state.t ? 'rgba(255,226,122,0.5)' : 'rgba(20,12,40,0.55)'; rr(ctx, lx - lk.w / 2 - 12, ly - 6, lk.w + 24, lk.h + 12, (lk.h + 12) / 2); ctx.fill(); ctx.restore();
    drawLockup(ctx, lx, ly, lk.w, 1);
    const tw = Math.max(lk.w + 24, m), th = Math.max(lk.h + 12, m);
    lockTap = { x: lx - tw / 2, y: ly + lk.h + 6 - th, w: tw, h: th };
  }
  setUi(state, { lockTap, hits, footer: fy.buttons.filter((b) => !b.disabled).map((b) => ({ id: b.id, rect: b.rect })), view, lay, maxS, bar, thumb });
}

function lockupBox(col) { const w = clamp(col.w * 0.5, 240, LY.land || LY.h < 1200 ? 260 : 340); return { w, h: Math.round(w * 327 / 1200) }; }

function footerLayout(ctx, btns, s, col) {
  if (!btns.length) return { top: col.bottom + 6, buttons: [] };
  const gapx = 14, fx = col.x - 10, fw = col.w + 20;
  const stack = s >= 2 && btns.length > 1 && !LY.land;
  const size = 30 * (LY.land ? Math.min(s, 1.5) : Math.min(s, 2.2));   // footer buttons grow with the text size, but never so far that they eat the page
  const out = [];
  let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, fw - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0);
    top = col.bottom - total + gapx;
    let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: fx, y, w: fw, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (fw - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44));
    const hh = Math.max(...hs);
    top = col.bottom - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: fx + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}

// ---- UI scenes -----------------------------------------------------------------------------------------------------
// The reading column of the wide screens (Rules, About, How to Play, the match list): a comfortable measure, centred.
const readerCol = () => (LY.land ? { x: LY.readerX, w: LY.readerW, top: LY.col.top, bottom: LY.col.bottom } : LY.col);

export function sceneSpec(state) {
  const s = scaleOf(state);
  const pf = state.prefs;
  switch (state.scene) {
    case 'title': {
      const tight = !LY.land && LY.h < 1200 && s < 2, hf = {};
      let bh = LY.land ? 66 : LY.h < 1200 ? 60 : 84, heroH = s >= 2 ? 340 : tight ? 250 : LY.title.heroH;
      if (!LY.land && s < 2) {   // fit without scrolling: the real minimum button heights are label + padding, so shrink the hero, then the label size
        const c = LY.title.col, avail = c.bottom - c.top - lockupBox(c).h - 40;
        const need = (hh, fs) => hh + 4 * Math.max(bh, fs * 1.18 + 36) + 2 * Math.max(bh, fs * 1.18 + fs * 0.62 * 1.25 + 44) + 6 * 14;
        let fs = 31;
        if (need(heroH, fs) > avail) fs = 26;
        const ex = need(heroH, fs) - avail;
        if (ex > 0) heroH = Math.max(140, heroH - ex);
        if (fs < 31) hf.size = fs;
      }
      const items = [];
      if (!LY.land) items.push({ t: 'fig', h: Math.round(heroH), draw: (ctx, w, h) => drawHero(ctx, w, h, state) });
      items.push(
        { t: 'btn', id: 'play', label: 'Play', sub: 'Chase, full match, backyard rules', primary: true, h: bh, ...hf },
        { t: 'btn', id: 'auto', label: 'Auto Play', sub: 'Watch the computer bat and learn', h: bh, ...hf },
        { t: 'btn', id: 'howto', label: 'How to Play', h: bh, ...hf },
        { t: 'btn', id: 'rules', label: 'Rules', h: bh, ...hf },
        { t: 'btn', id: 'about', label: 'About', h: bh, ...hf },
        { t: 'btn', id: 'settings', label: 'Settings', h: bh, ...hf },
      );
      return { lockup: true, items, footer: [], col: LY.title.col, hero: LY.land ? LY.title.hero : null };
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
      return { items, footer: [{ id: 'back', label: 'Back' }], cols: LY.land ? 2 : 1, col: readerCol() };
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
      let items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => drawFigure(ctx, it.key, w, h) } : it));
      if (state.scene === 'about') items = items.concat((state.env?.view3d?.credits ?? CREDITS_3D).map((text) => (text.startsWith('# ') ? { t: 'h', text: text.slice(2) } : { t: 'para', text })));
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }], col: readerCol() };
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
        ...rs.card.map((c) => ({ t: 'stat', wide: true, label: c.name, value: c.line, color: c.out ? '#ff9a8a' : PAL.cream })),
        { t: 'gap', h: 10 },
        { t: 'more' },
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
function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = null) {
  const lo = minSize ?? Math.min(size, LY.minText);
  let sz = size;
  ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > lo && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}
const txt = (n) => Math.max(n, LY.minText);

// The scoreboard model: zoomed (rows that follow the Text size) or the standard 124-unit bar. `bottom` = where it ends.
function hudModel(ctx, state) {
  const m = state.m, i = m.inn, hud = LY.hud;
  const zs = inPlayScale(state);
  if (zs > 1.001) {
    const rrr = requiredRate(m), crr = runRate(m);
    const maxW = hud.textMaxW;
    const rows = [];
    rows.push({ t: `${i.runs}/${i.wk}   ${fmtOvers(i.balls)}/${m.overs} ov`, size: 34 * zs, w: 700, col: '#fff' });
    if (i.target != null) {
      const need = Math.max(0, i.target - i.runs), bl = ballsLeft(m);
      rows.push({ t: need > 0 ? `Need ${need} from ${bl}` : 'Target reached', size: 24 * zs, w: 700, col: PAL.gold });
      rows.push({ t: `RRR ${rrr > 40 ? '-' : rrr.toFixed(1)}   CRR ${crr.toFixed(1)}`, size: 19 * zs, w: 500, col: 'rgba(255,244,224,0.85)' });
    } else {
      rows.push({ t: i.role === 'bowl' ? 'YOU ARE BOWLING' : `CRR ${crr.toFixed(1)}   ${ballsLeft(m)} left`, size: 22 * zs, w: 700, col: PAL.gold });
    }
    const s0 = strikerOf(m);
    rows.push({ t: `${s0.name}* ${s0.runs} (${s0.balls})`, size: 20 * zs, w: 600, col: PAL.gold });
    if (i.role === 'bat') rows.push({ t: `${bowlerOf(m).name} to bowl`, size: 18 * zs, w: 500, col: 'rgba(255,244,224,0.7)' });
    const lh = 1.18;
    let h = 22;
    for (const r of rows) { r.fs = fitFont(ctx, r.t, r.size, maxW, r.w); h += r.fs * lh; }
    return { zoom: true, rows, lh, h, bottom: hud.y + h };
  }
  return { zoom: false, h: hud.h, bottom: hud.y + hud.h };
}

function drawHud(ctx, state, hm) {
  const m = state.m, i = m.inn, hud = LY.hud;
  hudBottom = hm.bottom;
  const paused = state.paused;
  const hintsOut = state.scene === 'play' && m.hints <= 0;
  const thinkOff = hintsOut || (m.phase !== 'ready' && m.phase !== 'runup' && m.phase !== 'flight' && m.phase !== 'aim' && m.phase !== 'live');
  if (hm.zoom) {
    panel(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hm.h }, { radius: 26, top: 'rgba(36,26,62,0.92)', bottom: 'rgba(16,11,30,0.94)' });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let y = hud.y + 12;
    for (const r of hm.rows) { y += r.fs * hm.lh; ctx.font = `${r.w} ${r.fs}px ${SANS}`; ctx.fillStyle = r.col; ctx.fillText(r.t, hud.x + 22, y - r.fs * 0.2); }
    drawPill(ctx, LY.pause, paused ? '▶' : 'II', { size: 28 });
    if (state.scene !== 'auto') drawPill(ctx, LY.think, `?${m.hints}`, { size: 26, disabled: thinkOff });
    if (i.fh && m.rules.extras) textFill(ctx, 'FREE HIT', LY.freeHitX, hudBottom + 44, 30, { color: '#ffd34d', italic: true, stroke: 'rgba(80,20,10,0.8)' });
    return;
  }
  panel(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, { radius: 26, top: 'rgba(36,26,62,0.88)', bottom: 'rgba(16,11,30,0.9)' });
  const mx = hud.midX, yy = hud.y;
  const scoreSz = Math.min(62, Math.max(46, (mx - hud.x - 40) / 3.4));
  textFill(ctx, `${i.runs}/${i.wk}`, hud.x + 22, yy + 72, scoreSz, { align: 'left', weight: 700, color: '#fff' });
  ctx.font = `600 ${txt(22)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${fmtOvers(i.balls)} / ${m.overs} ov`, hud.x + 24, yy + 104);
  // middle: target or batting side
  const rrr = requiredRate(m), crr = runRate(m);
  ctx.textAlign = 'left';
  const line = (text, size, w, col, y) => { const f = fitFont(ctx, text, size, hud.midMaxW, w); ctx.font = `${w} ${f}px ${SANS}`; ctx.fillStyle = col; ctx.fillText(text, mx, y); };
  if (i.target != null) {
    line(`TARGET ${i.target}`, txt(17), 700, PAL.gold, yy + 44);
    const need = Math.max(0, i.target - i.runs), bl = ballsLeft(m);
    line(need > 0 ? `Need ${need} from ${bl}` : 'Target reached', 25, 700, '#fff', yy + 76);
    line(`RRR ${rrr > 40 ? '-' : rrr.toFixed(1)}   CRR ${crr.toFixed(1)}`, txt(20), 500, 'rgba(255,244,224,0.85)', yy + 106);
  } else {
    line(i.role === 'bowl' ? 'YOU ARE BOWLING' : 'BATTING', txt(17), 700, PAL.gold, yy + 44);
    line(`CRR ${crr.toFixed(1)}`, 25, 700, '#fff', yy + 76);
    line(`${ballsLeft(m)} balls left`, txt(20), 500, 'rgba(255,244,224,0.85)', yy + 106);
  }
  // buttons
  drawPill(ctx, LY.pause, paused ? '▶' : 'II', { size: 28 });
  if (state.scene !== 'auto') drawPill(ctx, LY.think, `?${m.hints}`, { size: 26, disabled: thinkOff });
  // batters strip
  const s0 = strikerOf(m), s1 = nonStrikerOf(m), sy = yy + 154;
  ctx.font = `600 ${txt(21)}px ${SANS}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = PAL.gold; ctx.fillText(`${s0.name}* ${s0.runs} (${s0.balls})`, hud.x + 10, sy);
  ctx.fillStyle = 'rgba(255,244,224,0.85)'; ctx.fillText(`${s1.name} ${s1.runs} (${s1.balls})`, hud.x + 220, sy);
  if (i.role === 'bat') { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,244,224,0.7)'; ctx.fillText(`${bowlerOf(m).name} to bowl`, hud.x + hud.w - 10, sy); ctx.textAlign = 'left'; }
  if (i.fh && m.rules.extras) { textFill(ctx, 'FREE HIT', LY.freeHitX, hudBottom + 71, 30, { color: '#ffd34d', italic: true, stroke: 'rgba(80,20,10,0.8)' }); }
}

function drawOverStrip(ctx, state) {
  const m = state.m, i = m.inn, o = LY.over;
  const toks = i.over.slice(-8);
  const y = o.y;
  const n = Math.max(6, toks.length);
  const step = o.r * 2 + o.gap;
  const x0 = o.cx - (n * step) / 2 + step / 2;
  for (let k = 0; k < n; k++) {
    const tkn = toks[k];
    const x = x0 + k * step;
    ctx.fillStyle = tkn ? tokenColor(tkn) : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.arc(x, y, o.r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.stroke();
    if (tkn) { textFill(ctx, tkn, x, y + 8, tkn.length > 2 ? 16 : 21, { font: SANS, weight: 700, color: '#fff', shadow: false }); }
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
  const bw = Math.min(620, (LY.U.w - 24) / sc);
  ctx.save();
  ctx.globalAlpha = a; ctx.translate(LY.cx, y); ctx.scale(sc, sc);
  const hs = 76, bs = c.big ? 30 : 32;
  ctx.font = `italic 700 ${bs}px ${FONT}`;
  const lines = wrapLines(ctx, rest, bw - 60).slice(0, 3);
  const hh = (head ? hs * 0.95 : 0) + lines.length * bs * 1.2 + 26;
  rr(ctx, -bw / 2, -hs * 0.8 - 12, bw, hh, 30); ctx.fillStyle = 'rgba(14,10,26,0.66)'; ctx.fill();
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
  ctx.save(); ctx.globalAlpha = a; ctx.translate(LY.cx, y - Math.min(age, 0.4) * 30);
  const txtL = r.kind === 'miss' ? (r.why === 'out of reach' ? 'OUT OF REACH' : r.label) : r.label;
  textFill(ctx, txtL, 0, 0, 36, { italic: true, color: col, stroke: 'rgba(20,10,10,0.8)' });
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const m = state.m, v = state.v;
  const live = !!m.live && (m.phase === 'live' || (m.phase === 'result' && m.live));
  const vv = state.env?.view3d;
  const useOver = (live && !(vv && vv.hold)) || state.scene === 'replay';
  const VW = LY.w, VH = LY.h;
  ctx.save();
  if (useOver) renderOverhead(ctx, state); else renderDeliveryView(ctx, state);
  ctx.restore();
  drawParticles(ctx, v.parts);
  if (v.flash > 0.01) { ctx.fillStyle = `rgba(255,248,220,${v.flash})`; ctx.fillRect(0, 0, VW, VH); }
  if (state.scene === 'replay') { renderReplayHud(ctx, state); return; }
  const hm = hudModel(ctx, state);
  hudBottom = hm.bottom;
  const bowlAim = state.scene === 'play' && m.inn.role === 'bowl' && m.phase === 'aim';
  const fieldPick = m.phase === 'overbreak' && m.inn.role === 'bowl';
  // the bowling screens dim the picture first, so the scoreboard stays on top of them
  if (bowlAim || fieldPick) {
    if (bowlAim) placeBowl(LY, hudBottom + 52); else placeField(LY, hudBottom + 52);
    const top = LY.land ? 0 : hudBottom + 48;
    ctx.fillStyle = bowlAim ? 'rgba(10,6,24,0.78)' : 'rgba(10,6,24,0.8)'; ctx.fillRect(0, top, VW, VH - top);
  }
  drawHud(ctx, state, hm);
  const human = m.inn.role === 'bat' && !m.inn.ai;
  if (!useOver) {
    const showRadar = m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight';
    if (showRadar) {
      const o = { cands: [] };
      if (state.touch.aimDeg != null) o.aim = state.touch.aimDeg;
      if (state.scene === 'auto' && state.auto.revealing && m.aiPlan) { if (m.aiPlan.kind === 'swing') { o.aim = m.aiPlan.angle; o.cands = [...(m.aiPlan.top ?? []).map((c) => ({ angle: c.angle, boundary: c.boundary })), { angle: m.aiPlan.angle, chosen: true, boundary: m.aiPlan.best?.boundary }]; } }
      if (state.think.open && state.think.plan?.kind === 'swing') { o.aim = state.think.plan.angle; o.aimColor = 'rgba(120,255,200,0.4)'; }
      drawRadar(ctx, m, { ...LY.radar, y: Math.max(LY.radar.y, LY.land ? LY.radar.y : hudBottom + 10) }, o);
    }
  }
  timingChip(ctx, state, LY.land ? LY.chipY : (useOver ? Math.max(252, hudBottom + 60) : LY.chipY));
  if (!state.paused) drawCall(ctx, state, LY.land ? LY.callY.over : (useOver ? Math.max(300, hudBottom + 110) : Math.max(330, hudBottom + 120)));
  drawOverStrip(ctx, state);
  if (state.scene === 'play' && human) drawBattingControls(ctx, state, useOver || !!(vv && vv.hold));
  if (bowlAim) drawBowlingUi(ctx, state);
  if (fieldPick) drawFieldPicker(ctx, state);
  if (state.scene === 'auto') drawAutoPanel(ctx, state);
  if (state.think.open) drawThink(ctx, state);
  if (state.paused && state.scene !== 'auto') drawPauseMenu(ctx, state);
  if (m.phase === 'inningsEnd') { ctx.fillStyle = 'rgba(10,6,24,0.35)'; ctx.fillRect(0, 0, VW, VH); }
  // the 3D action cam shows through a hole in the 2D picture
  if (vv && vv.pip) {
    const p = vv.pip;
    ctx.save(); rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.clip(); ctx.clearRect(p.x, p.y, p.w, p.h); ctx.restore();
    ctx.strokeStyle = 'rgba(255,214,140,0.9)'; ctx.lineWidth = 4; rr(ctx, p.x, p.y, p.w, p.h, 18); ctx.stroke();
  }
}

function renderDeliveryView(ctx, state) {
  drawDelivery(ctx, { ...state.v, m: state.m, use3d: !!state.env?.view3d?.active });
}

function renderOverhead(ctx, state) {
  const m = state.m, v = state.v, L = m.live, th = THEMES[m.theme];
  const hand = m.hand;
  ctx.save();
  if (hand === -1) { ctx.translate(OH.w, 0); ctx.scale(-1, 1); }
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
    const len = 300 * OH.k;
    ctx.strokeStyle = 'rgba(120,255,200,0.9)'; ctx.setLineDash([14, 10]); ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.sin(a) * hand * len, py - Math.cos(a) * len); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawBattingControls(ctx, state, over) {
  const m = state.m, L = m.live;
  if (over && L && !L.dead && !L.over && m.phase === 'live') {
    const rn = L.run, run = LY.run;
    const label = rn.mode === 'rest' ? 'RUN' : rn.mode === 'start' ? 'GO!' : (rn.q ? 'RUN AGAIN: queued (tap to cancel)' : 'RUN AGAIN?');
    const pulse = 1 + Math.sin(state.t * 8) * 0.03;
    ctx.save(); ctx.translate(run.x + run.w / 2, run.y + run.h / 2); ctx.scale(pulse, pulse); ctx.translate(-(run.x + run.w / 2), -(run.y + run.h / 2));
    drawButton(ctx, run, label, { primary: rn.mode === 'rest' || rn.mode === 'start', active: rn.q, size: LY.runSize });
    ctx.restore();
    state._ui.run = run;
  }
  const maxW = Math.min(680, LY.U.w - 24);
  if (!over && (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight')) {
    const a = clamp(1 - (m.inn.balls / 8), 0.25, 1);
    const zs = inPlayScale(state), msg = m.phase === 'flight' ? 'SWIPE NOW' : m.phase === 'runup' ? 'Wait for the ball...' : 'Read the field. Swipe the gap. Tap to block.';
    fitFont(ctx, msg, 24 * zs, maxW, 600); ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,244,220,${0.85 * a})`;
    ctx.fillText(msg, LY.cx, LY.hintY);
  }
  // first-balls coach: a ghost finger shows the swipe
  if (!over && (state.prefs.coach ?? 0) < 6 && (m.phase === 'ready' || m.phase === 'runup' || m.phase === 'flight') && !state.touch.down) {
    const c = LY.coach;
    const u = (state.t * 0.8) % 1.5, k = clamp(u / 0.8, 0, 1), e = ease.out(k);
    const gx = lerp(c.x0, c.x1, e), gy = lerp(c.y0, c.y1, e);
    const al = u < 1.1 ? 1 : clamp(1 - (u - 1.1) / 0.4, 0, 1);
    ctx.save(); ctx.globalAlpha = 0.85 * al;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.lineTo(gx, gy); ctx.stroke();
    ctx.fillStyle = 'rgba(255,244,220,0.9)'; ctx.beginPath(); ctx.arc(gx, gy, 30, 0, 7); ctx.fill(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4; ctx.stroke();
    ctx.restore();
    const zs = inPlayScale(state), msg = 'Swipe the way you want the ball to go';
    fitFont(ctx, msg, 26 * zs, maxW, 700); ctx.textAlign = 'center'; ctx.fillStyle = PAL.gold; ctx.fillText(msg, LY.cx, c.textY - 30 * (zs - 1));
  }
  // live swipe feedback
  const tc = state.touch;
  if (!over && tc.down && tc.committed && tc.path.length > 1) {
    ctx.strokeStyle = tc.committed ? 'rgba(255,207,107,0.95)' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = tc.committed ? 10 : 6; ctx.lineCap = 'round';
    ctx.beginPath(); tc.path.slice(-8).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  }
}

// ---- bowling UI ---------------------------------------------------------------------------------------------------------
// The pitch map: z0..z1 metres bottom to top, +-xr metres across. Its rectangle comes from the live layout (LY.bowl.pm).
const MAP = { xr: 1.7, z0: -0.8, z1: 9.8 };
export const toMap = (x, z) => { const P = LY.bowl.pm; return [P.x + P.w / 2 + (x / MAP.xr) * (P.w / 2), P.y + P.h - ((z - MAP.z0) / (MAP.z1 - MAP.z0)) * P.h]; };
export const fromMap = (sx, sy) => { const P = LY.bowl.pm; return [((sx - P.x - P.w / 2) / (P.w / 2)) * MAP.xr, MAP.z0 + ((P.y + P.h - sy) / P.h) * (MAP.z1 - MAP.z0)]; };
export const CHIP_KEYS = TYPE_KEYS.filter((k) => k !== 'wide');
export const FIELD_KEYS = PRESET_KEYS;

function textBlock(ctx, text, x, y, w, size, lh, align, color, weight = 500) {
  ctx.font = `${weight} ${size}px ${SANS}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, text, w);
  lines.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
  return lines.length * lh;
}

function drawBowlingUi(ctx, state) {
  const m = state.m;
  if (m.phase !== 'aim') return;
  const a = m.aim, B = LY.bowl, P = B.pm;
  panel(ctx, { x: P.x - 14, y: P.y - 14, w: P.w + 28, h: P.h + 28 }, { radius: 24 });
  // pitch strip
  const g = ctx.createLinearGradient(0, P.y, 0, P.y + P.h); g.addColorStop(0, '#9c8a5c'); g.addColorStop(1, '#cdb987'); ctx.fillStyle = g; rr(ctx, P.x, P.y, P.w, P.h, 14); ctx.fill();
  const bands = [[0.4, 1.2, 'Yorker', '#ff6b57'], [1.6, 3.0, 'Full', '#ff9d3d'], [3.1, 4.8, 'Good length', '#ffd34d'], [4.9, 6.6, 'Short', '#7ac05a'], [6.7, 8.6, 'Bouncer', '#2ec4b6']];
  for (const [z0, z1, name, col] of bands) {
    const [, y0] = toMap(0, z1), [, y1] = toMap(0, z0);
    ctx.fillStyle = col; ctx.globalAlpha = 0.28; ctx.fillRect(P.x, y0, P.w, y1 - y0); ctx.globalAlpha = 1;
    ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(name, P.x + P.w - 10, (y0 + y1) / 2 + 6);
  }
  const [sx0, sy0] = toMap(0, 0), ms = P.w / 420;
  // stumps at the batter end
  drawStumps(ctx, sx0, sy0 + 28 * ms, 220 * ms, 0, false);
  // batter silhouette
  ctx.fillStyle = 'rgba(40,30,70,0.5)'; ctx.beginPath(); ctx.ellipse(sx0 - 70 * ms, sy0 + 20 * ms, 30 * ms, 14 * ms, 0, 0, 7); ctx.fill();
  // off/leg labels
  ctx.font = `600 ${txt(18)}px ${SANS}`; ctx.fillStyle = PAL.gold; ctx.textAlign = 'left'; ctx.fillText(m.hand === 1 ? 'Leg' : 'Off', P.x + 8, P.y + 26); ctx.textAlign = 'right'; ctx.fillText(m.hand === 1 ? 'Off' : 'Leg', P.x + P.w - 8, P.y + 26);
  // reticle with error ellipse
  const [rx, ry] = toMap(a.tx * m.hand, a.tz);
  const ex = (0.06 + 0.22 * a.pace) / MAP.xr * (P.w / 2), ey = (0.06 + 0.22 * a.pace) * 3.2 / (MAP.z1 - MAP.z0) * P.h;
  ctx.strokeStyle = 'rgba(255,207,107,0.9)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(rx, ry, ex, ey, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(rx, ry, 14, 0, 7); ctx.moveTo(rx - 24, ry); ctx.lineTo(rx + 24, ry); ctx.moveTo(rx, ry - 24); ctx.lineTo(rx, ry + 24); ctx.stroke();
  drawBall(ctx, rx, ry, 9, THEMES[m.theme].ball, 0.7);
  // pace meter and the delivery cue
  const T = TYPES[a.type];
  const spd = T.speed[0] + (T.speed[1] - T.speed[0]) * a.pace;
  const head = `${T.name}   ${(spd * 3.6).toFixed(0)} km/h   accuracy ${Math.round((1 - a.pace) * 70 + 30)}%`;
  const I = B.info;
  if (!LY.land) {
    fitFont(ctx, head, txt(22), I.w, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(head, I.x, I.y1);
    fitFont(ctx, T.cue, txt(20), I.w, 500); ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.fillText(T.cue, I.x, I.y2);
  } else {
    let y = I.y1;
    y += textBlock(ctx, T.name, I.x, y, I.w, txt(26), 32, 'left', '#fff', 700);
    y += textBlock(ctx, `${(spd * 3.6).toFixed(0)} km/h`, I.x, y + 2, I.w, txt(22), 28, 'left', '#fff', 600);
    y += textBlock(ctx, `Accuracy ${Math.round((1 - a.pace) * 70 + 30)}%`, I.x, y + 4, I.w, txt(22), 28, 'left', '#fff', 600);
    textBlock(ctx, T.cue, I.x, y + 12, I.w, txt(20), 26, 'left', 'rgba(255,244,224,0.8)', 500);
  }
  // type chips
  CHIP_KEYS.forEach((k, i) => drawButton(ctx, B.chips[i], TYPES[k].name, { active: a.type === k, size: 22 }));
  const hintText = LY.land ? 'Drag the ring to aim. Flick UP anywhere else on the screen to bowl.' : 'Drag the ring to aim. Flick UP anywhere below the pitch to bowl.';
  if (!LY.land) { fitFont(ctx, hintText, txt(22), B.hint.w, 600); ctx.fillStyle = PAL.gold; ctx.textAlign = 'center'; ctx.fillText(hintText, B.hint.x, B.hint.y); }
  else textBlock(ctx, hintText, B.hint.x, B.hint.y, B.hint.w, txt(22), 28, 'left', PAL.gold, 600);
  // flick feedback
  const tc = state.touch;
  if (tc.down && tc.path.length > 1 && tc.mode === 'flick') { ctx.strokeStyle = 'rgba(255,207,107,0.9)'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath(); tc.path.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke(); }
}

function drawFieldPicker(ctx, state) {
  const m = state.m, F = LY.field;
  textFill(ctx, 'Set your field', F.titleX, F.titleY, 44, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.5)' });
  drawRadar(ctx, m, F.radar, {});
  const blurb = PRESETS[m.fieldPick].blurb;
  fitFont(ctx, blurb, txt(22), LY.land ? F.chips[0].w * 2 : LY.U.w - 40, 600); ctx.fillStyle = 'rgba(255,244,224,0.9)'; ctx.textAlign = 'center'; ctx.fillText(blurb, F.blurbX, F.blurbY);
  FIELD_KEYS.forEach((k, i) => drawButton(ctx, F.chips[i], PRESETS[k].name, { active: m.fieldPick === k, sub: PRESETS[k].blurb, size: LY.land ? 24 : 28 }));
  drawButton(ctx, F.go, 'Next over', { primary: true, size: 40 });
}

// ---- think / pause / auto ---------------------------------------------------------------------------------------------------
function drawThink(ctx, state) {
  const th = state.think, TC = LY.thinkCard;
  const zs = inPlayScale(state);
  const bottom = TC.bottom, maxH = bottom - Math.max(hudBottom + 20, LY.U.y0 + 190);
  const textW = TC.w - 52;
  // shrink the text just enough that every line fits above the button
  let fs = 25 * zs, wrapped;
  for (;;) {
    ctx.font = `500 ${fs}px ${SANS}`;
    wrapped = th.lines.map((line) => wrapLines(ctx, line, textW));
    const n = wrapped.reduce((a, w) => a + w.length, 0);
    const need = 96 + n * fs * 1.32 + wrapped.length * 8;
    if (need <= maxH || fs <= LY.minText) { wrapped.need = need; break; }
    fs -= 1;
  }
  const r = { x: TC.x, y: Math.min(bottom - (LY.land ? 250 : 330), bottom - wrapped.need - 10), w: TC.w, h: 0 };
  r.h = TC.btn.y + TC.btn.h + 20 - r.y;
  const top0 = Math.max(LY.U.y0 + 190, hudBottom + 4);
  ctx.fillStyle = 'rgba(8,5,20,0.55)'; ctx.fillRect(0, top0, LY.w, LY.h - top0);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', LY.cx, r.y + 52, 38, { italic: true, grad: [[0, '#d4fff2'], [1, '#2ec4b6']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2;
  for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, r.x + 24, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, TC.btn, 'Got it', { primary: true, size: 30 });
}

function drawPauseMenu(ctx, state) {
  const P = LY.pauseMenu;
  ctx.fillStyle = 'rgba(8,5,20,0.72)'; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, 'Paused', LY.cx, P.titleY, 66, { italic: true, grad: [[0, '#fff3c2'], [1, '#ffb347']], stroke: 'rgba(60,20,10,0.5)' });
  const fs = 30 * Math.min(inPlayScale(state), 1.5);
  drawButton(ctx, P.resume, 'Resume', { primary: true, size: fs });
  drawButton(ctx, P.sound, state.prefs.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, P.quit, 'Quit to menu', { danger: true, size: fs });
}

function drawAutoPanel(ctx, state) {
  const a = state.auto, A = LY.auto;
  // bottom controls
  drawButton(ctx, A.speed, `Speed x${a.speed}`, { size: 24 });
  drawButton(ctx, A.pause, state.paused ? 'RESUME' : 'PAUSE', { primary: state.paused, size: 28 });
  drawButton(ctx, A.dec, '−', { size: 32 }); drawButton(ctx, A.inc, '+', { size: 32 });
  ctx.font = `500 ${txt(16)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`think ${[2, 5, 8, 10][state.prefs.thinkIdx]}s`, A.thinkLbl.x, A.thinkLbl.y);
  drawPill(ctx, A.exit, 'Exit', { size: 24 });
  // reasoning card
  const lines = a.lines;
  if (lines.length) {
    const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
    const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
    const C = A.card, r = { x: C.x, y: 0, w: C.w, h: 0 };
    const zs = inPlayScale(state);
    let fs = 21 * zs, wrapped;
    const maxH = C.bottom - Math.max(hudBottom + (LY.land ? 12 : 160), LY.land ? 0 : 340);
    for (;;) {
      ctx.font = `500 ${fs}px ${SANS}`;
      wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, C.w - 44));
      if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= LY.minText) break;
      fs -= 1;
    }
    r.h = 58 + wrapped.length * fs * 1.33 + 14; r.y = C.bottom - r.h;
    panel(ctx, r, { radius: 22, top: 'rgba(14,10,30,0.85)', bottom: 'rgba(14,10,30,0.8)' });
    textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, italic: true, weight: 700 });
    const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
    ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
    ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; let y = r.y + 58 + fs * 1.05;
    for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  }
  if (state.paused) { textFill(ctx, 'PAUSED', LY.cx, A.pausedY, 56, { italic: true, color: '#fff', stroke: 'rgba(40,10,10,0.7)' }); }
}

function renderReplayHud(ctx, state) {
  const R = LY.replay;
  textFill(ctx, 'WINNING SHOT', LY.cx, R.titleY, 54, { italic: true, grad: [[0, '#fff3a8'], [1, '#ff9d2b']], stroke: 'rgba(60,20,10,0.6)' });
  const sn = state.replay?.shot;
  if (sn) textFill(ctx, sn, LY.cx, R.subY, 34, { italic: true, color: '#fff4dc' });
  drawButton(ctx, R.btn, 'Continue', { primary: true });
}

export function renderScene(ctx, state) {
  const sc = state.scene;
  if (sc === 'play' || sc === 'auto' || sc === 'replay') { renderPlay(ctx, state); return; }
  if (sc === 'pageloading') return;
  columnScreen(ctx, state, sceneSpec(state));
}
