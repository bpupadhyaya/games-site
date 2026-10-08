// All drawing for screens and the in-play HUD. Reads `state`; the only thing it writes is state._ui (hit rectangles for the update step),
// which is non-enumerable so it never enters getState().
import { PARKS, PARK_KEYS, LEVELS, PITCHES, clamp, lerp, DEG, smooth, sectorCentre, SECTORS, FOUL_DEG, fenceDist, MOONSHOT_M, PITCH_Z } from './core.js';
import { PAL, FONT, SANS, rr, textFill, wrapLines, glow, drawParticles, vGrad } from './art.js';
import { TEXT_SCALES, drawButton, drawPill, panel, layoutColumn, drawColumn, maxScroll, scrollbar, inRect } from './ui.js';
import { LY, host } from './layout.js';
import { drawLockup, edgeStroke, drawMoreLine } from './brand.js';
import { ABOUT, HOWTO, RULES, CREDITS_FALLBACK } from './content.js';
import { ballNow, READY_T, WINDUP_T, outsLeft } from './engine.js';
import { flyBall, aimFromDrag, DEFAULT_AIM, LEAD, WINDOWS } from './ball.js';
import { cameraFor, titleCam, project } from './cam.js';
import { drawBallpark } from './scene2d.js';
import { ROUND_NAMES, youMatch } from './derby.js';

const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); };
function setUi(state, ui) { if (!('_ui' in state)) hidden(state, '_ui', ui); else state._ui = ui; }
export const scaleOf = (state) => TEXT_SCALES[clamp(state.prefs.textIdx, 0, TEXT_SCALES.length - 1)];
const txt = (n) => Math.max(n, LY.minText);
function fitFont(ctx, text, size, maxW, weight = 600, family = SANS, minSize = null) {
  const lo = minSize ?? Math.min(size, LY.minText);
  let sz = size; ctx.font = `${weight} ${sz}px ${family}`;
  while (sz > lo && ctx.measureText(text).width > maxW) { sz -= 1; ctx.font = `${weight} ${sz}px ${family}`; }
  return sz;
}
const gradTitle = [[0, '#fff3c2'], [0.6, '#ffc54d'], [1, '#ff8a3d']];

// ---- backgrounds ---------------------------------------------------------------------------------------------------------------
// When the 3D layer is live it paints the ballpark behind the (transparent) canvas; otherwise the same ballpark is drawn in 2D here.
const live3d = (state) => !!(state.env && state.env.view3d && state.env.view3d.active);
export const wants3d = (scene) => ['play', 'auto', 'title', 'modes', 'setup', 'bracket', 'recap', 'results', 'break', 'demolimit'].includes(scene);

export function drawMenuBackdrop(ctx, state, t) {
  const VW = LY.w, VH = LY.h, sc = state.scene;
  const dim = sc === 'title' ? 0.05 : ['modes', 'setup', 'bracket', 'recap', 'results', 'break', 'demolimit'].includes(sc) ? 0.6 : 1;
  if (dim < 1 && live3d(state)) { ctx.clearRect(0, 0, VW, VH); }
  else {
    ctx.fillStyle = '#0d1226'; ctx.fillRect(0, 0, VW, VH);
    if (dim < 1) drawBallpark(ctx, VW, VH, titleCam(t, VW / VH, state.prefs.hand), null, state.prefs.park, t);
  }
  if (dim > 0) { const g = ctx.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, `rgba(8,12,30,${0.7 * dim + 0.15})`); g.addColorStop(1, `rgba(8,12,30,${0.8 * dim + 0.12})`); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH); }
}

function drawHero(ctx, w, h, state) {
  const t = state.t, cx = w / 2, th = Math.max(60, h - 34);
  let s1 = Math.min(w * 0.13, th * 0.26), s2 = Math.min(w * 0.19, th * 0.4);
  ctx.font = `700 ${s2 * 0.93}px ${FONT}`; const mw = ctx.measureText('MOONSHOT').width; if (mw > w - 24) { const k = (w - 24) / mw; s2 *= k; s1 *= Math.min(1, k * 1.1); }
  const base = Math.max(th * 0.34, s1 * 1.0);
  textFill(ctx, 'MOONSHOT', cx, base, s2 * 0.93, { grad: [[0, '#ffffff'], [0.6, '#ffe6b0'], [1, '#ffb347']], stroke: 'rgba(40,14,60,0.7)' });
  textFill(ctx, 'BASEBALL', cx, base + s1 * 1.25, s1, { grad: [[0, '#d9f4ff'], [0.6, '#7fd0ff'], [1, '#3a8dff']], stroke: 'rgba(10,20,60,0.7)' });
  const u = (t * 0.4) % 1;
  const bx = lerp(w * 0.08, w * 0.92, u), by = h * 0.9 - Math.sin(u * Math.PI) * h * 0.55;
  for (let i = 1; i < 10; i++) { const uu = Math.max(0, u - i * 0.012); glow(ctx, lerp(w * 0.08, w * 0.92, uu), h * 0.9 - Math.sin(uu * Math.PI) * h * 0.55, 12 - i, 'rgba(255,240,200,A)', 0.5 - i * 0.045); }
  ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(bx, by, 13, 0, 7); ctx.fill(); ctx.strokeStyle = '#d9402f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 8, -0.9 + t * 4, 0.9 + t * 4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.textAlign = 'center';
  const tag = 'Read the pitch. Time the swing. Clear the fence.', ts = scaleOf(state);
  fitFont(ctx, tag, Math.min(24, w * 0.036) * Math.min(ts, 2.2), w - 40, 600, SANS, LY.minText);
  ctx.fillText(tag, cx, h - 12);
}

function zoomPills(ctx, state) {
  const s = state.prefs.textIdx, z = LY.zoom;
  drawPill(ctx, z.dec, 'A−', { disabled: s === 0 });
  drawPill(ctx, z.inc, 'A+', { disabled: s === TEXT_SCALES.length - 1 });
  ctx.font = `600 ${Math.max(22, LY.minText)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,220,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(TEXT_SCALES[s] * 100)}%`, z.label.x, z.label.y);
}

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
  if (lk) {
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
  const size = 30 * (LY.land ? Math.min(s, 1.5) : Math.min(s, 2.2));
  const out = []; let top;
  ctx.font = `700 ${size}px ${FONT}`;
  if (stack) {
    const hs = btns.map((b) => Math.max(88, wrapLines(ctx, b.label, fw - 28).length * size * 1.2 + 44));
    const total = hs.reduce((a, b) => a + b + gapx, 0); top = col.bottom - total + gapx; let y = top;
    btns.forEach((b, i) => { out.push({ ...b, size, rect: { x: fx, y, w: fw, h: hs[i] } }); y += hs[i] + gapx; });
  } else {
    const n = btns.length, bw = (fw - gapx * (n - 1)) / n;
    const hs = btns.map((b) => Math.max(92, wrapLines(ctx, b.label, bw - 28).length * size * 1.2 + 44)); const hh = Math.max(...hs); top = col.bottom - hh;
    btns.forEach((b, i) => out.push({ ...b, size, rect: { x: fx + i * (bw + gapx), y: top, w: bw, h: hh } }));
  }
  return { top, buttons: out };
}
const readerCol = () => (LY.land ? { x: LY.readerX, w: LY.readerW, top: LY.col.top, bottom: LY.col.bottom } : LY.col);

// ---- scene specs ----------------------------------------------------------------------------------------------------------------
export function sceneSpec(state) {
  const s = scaleOf(state), pf = state.prefs, demo = state.env.config.demo;
  switch (state.scene) {
    case 'title': {
      const tight = !LY.land && LY.h < 1200 && s < 2, hf = {};
      let bh = LY.land ? 66 : LY.h < 1200 ? 60 : 84, heroH = s >= 2 ? 340 : tight ? 250 : LY.title.heroH;
      if (!LY.land && s < 2) {
        const c = LY.title.col, avail = c.bottom - c.top - lockupBox(c).h - 40;
        const need = (hh, fs) => hh + 4 * Math.max(bh, fs * 1.18 + 36) + 2 * Math.max(bh, fs * 1.18 + fs * 0.62 * 1.25 + 44) + 6 * 14;
        let fs = 31; if (need(heroH, fs) > avail) fs = 26;
        const ex = need(heroH, fs) - avail; if (ex > 0) heroH = Math.max(140, heroH - ex);
        if (fs < 31) hf.size = fs;
      }
      const items = [];
      if (!LY.land) items.push({ t: 'fig', h: Math.round(heroH), draw: (ctx, w, h) => drawHero(ctx, w, h, state) });
      items.push(
        { t: 'btn', id: 'play', label: 'Play', sub: 'The bracket, a quick round, the daily round', primary: true, h: bh, ...hf },
        { t: 'btn', id: 'auto', label: 'Auto Play', sub: 'Watch the computer bat and learn', h: bh, ...hf },
        { t: 'btn', id: 'howto', label: 'How to Play', h: bh, ...hf },
        { t: 'btn', id: 'rules', label: 'Rules', h: bh, ...hf },
        { t: 'btn', id: 'about', label: 'About', h: bh, ...hf },
        { t: 'btn', id: 'settings', label: 'Settings', h: bh, ...hf });
      return { lockup: true, items, footer: [], col: LY.title.col, hero: LY.land ? LY.title.hero : null };
    }
    case 'modes': {
      const rec = state.records;
      const items = [
        { t: 'title', text: 'Choose a contest', size: 40 },
        { t: 'card', id: 'mode:bracket', title: demo ? 'The Bracket (app only)' : 'The Bracket', text: 'Eight batters. Beat three in a row to win the title.', tag: `Titles ${rec.titles ?? 0}  |  Best finish ${rec.bestRound ?? 'none yet'}`, accent: PAL.gold },
        { t: 'card', id: 'mode:quick', title: 'Quick Round', text: 'One round on a ballpark of your choice.', tag: `Best ${rec.bestHr ?? 0} home runs  |  Longest ${Math.round(rec.bestDist ?? 0)} m`, accent: PAL.teal },
        { t: 'card', id: 'mode:daily', title: demo ? 'Daily Round (app only)' : 'Daily Round', text: 'The same pitches for everyone, today.', tag: rec.dailyDay === state.env.config.day ? `Today: ${rec.dailyScore ?? 0} points` : 'Not played today', accent: PAL.coral },
      ];
      return { items, footer: [{ id: 'back', label: 'Back' }], cols: 1, col: readerCol() };
    }
    case 'setup': {
      const su = state.setup, L = LEVELS[su.level];
      const items = [{ t: 'title', text: su.title, size: 38, sub: su.blurb }];
      items.push({ t: 'chips', id: 'level', label: 'Level', value: su.level, options: LEVELS.map((l, i) => ({ v: i, label: l.name })) });
      items.push({ t: 'para', text: L.blurb, color: PAL.peach });
      if (su.mode !== 'bracket' || true) items.push({ t: 'chips', id: 'park', label: 'Ballpark', value: su.park, options: PARK_KEYS.map((k) => ({ v: k, label: PARKS[k].short, disabled: demo && k !== 'lantern' })) });
      items.push({ t: 'para', text: PARKS[su.park].blurb });
      items.push({ t: 'para', text: `${pf.hand === 1 ? 'Right' : 'Left'}-handed batter, ${['relaxed', 'standard', 'sharp'][pf.assist]} timing (change both in Settings).` });
      return { items, footer: [{ id: 'back', label: 'Back' }, { id: 'start', label: su.mode === 'bracket' ? 'Start the bracket' : 'Play', primary: true }] };
    }
    case 'settings': {
      const items = [
        { t: 'title', text: 'Settings', size: 42 },
        { t: 'row', id: 'set:sound', label: 'Sound', value: pf.sound ? 'On' : 'Off' },
        { t: 'row', id: 'set:hand', label: 'Batting hand', value: pf.hand === 1 ? 'Right' : 'Left' },
        { t: 'row', id: 'set:assist', label: 'Timing window', value: ['Relaxed', 'Standard', 'Sharp'][pf.assist] },
        { t: 'row', id: 'set:guide', label: 'Timing guide bar', value: pf.guide ? 'On' : 'Off' },
        { t: 'row', id: 'set:think', label: 'Auto Play thinking time', value: `${[2, 5, 8, 10][pf.thinkIdx]} s` },
        { t: 'para', text: 'Tap a row to change it. Use A− and A+ at the top of any screen to change the text size from 100% to 300%.' },
        { t: 'btn', id: 'set:restore', label: 'Restore purchase' },
      ];
      if (state.env.config.dev) items.push({ t: 'btn', id: 'set:dev', label: 'Developer: unlock all' });
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }] };
    }
    case 'howto': case 'about': case 'rules': {
      const doc = state.scene === 'howto' ? HOWTO : state.scene === 'about' ? ABOUT : RULES;
      let items = doc.map((it) => (it.t === 'fig' ? { ...it, draw: (ctx, w, h) => drawFigure(ctx, it.key, w, h, state) } : it));
      if (state.scene === 'about') items = items.concat((state.env?.view3d?.credits ?? CREDITS_FALLBACK).map((text) => (text.startsWith('# ') ? { t: 'h', text: text.slice(2) } : { t: 'para', text })));
      return { items, footer: [{ id: 'back', label: 'Back', primary: true }], col: readerCol() };
    }
    case 'bracket': {
      const b = state.br, m = youMatch(b);
      const opp = b.players[m.b];
      const items = [
        { t: 'title', text: ROUND_NAMES[b.rd], size: 40, sub: `You face ${opp.name} of ${opp.home}.` },
        { t: 'fig', h: LY.land ? 300 : 380, draw: (ctx, w, h) => drawBracket(ctx, w, h, state) },
        { t: 'para', text: `${LEVELS[b.level].name} level, ${LEVELS[b.level].outs} outs. ${opp.name} is a ${opp.hand > 0 ? 'right' : 'left'}-handed hitter with ${opp.pow > 0.95 ? 'big power' : opp.con > 0.85 ? 'a very steady swing' : 'a balanced game'}.` },
      ];
      return { items, footer: [{ id: 'quit', label: 'Menu' }, { id: 'next', label: 'Bat', primary: true }], col: readerCol() };
    }
    case 'recap': {
      const rc = state.recap;
      const items = [{ t: 'title', text: rc.headline, size: 44, sub: rc.sub }];
      const row = (label, a, b) => items.push({ t: 'stat', wide: true, label, value: `${a}    vs    ${b}` });
      row('Score', rc.you.score, rc.opp.score); row('Home runs', rc.you.hr, rc.opp.hr); row('Longest', `${Math.round(rc.you.longest)} m`, `${Math.round(rc.opp.longest)} m`);
      row('Total distance', `${rc.you.totalDist} m`, `${rc.opp.totalDist} m`); row('In the spotlight', rc.you.spot, rc.opp.spot);
      items.push({ t: 'para', text: `${rc.you.name}: ${rc.you.hrList.map((x) => `${Math.round(x.d)}`).join(', ') || 'no home runs'}.` });
      items.push({ t: 'para', text: `${rc.opp.name}: ${rc.opp.hrList.map((x) => `${Math.round(x.d)}`).join(', ') || 'no home runs'}.` });
      if (rc.tie) items.push({ t: 'para', text: 'Level on points and distance: three swings each decide it.', color: PAL.peach });
      return { items, footer: [{ id: 'next', label: rc.tie ? 'Swing-off' : 'Continue', primary: true }], col: readerCol() };
    }
    case 'results': {
      const rs = state.results;
      const items = [
        { t: 'title', text: rs.headline, size: 46, sub: rs.sub },
        { t: 'stat', label: 'Home runs', value: String(rs.hr), color: PAL.cream },
        { t: 'stat', label: 'Points', value: String(rs.score) },
        { t: 'stat', label: 'Longest', value: `${Math.round(rs.longest)} m`, color: PAL.teal },
        { t: 'stat', label: 'In the spotlight', value: String(rs.spot) },
        { t: 'stat', label: 'Moonshots', value: String(rs.moon) },
        { t: 'stat', label: 'Pitches', value: String(rs.pitches) },
        { t: 'stat', label: 'Perfect / good swings', value: `${rs.perfect} / ${rs.good}` },
        ...(rs.best != null ? [{ t: 'stat', label: 'Your best here', value: `${rs.best} HR`, color: PAL.teal }] : []),
        { t: 'gap', h: 10 }, { t: 'more' },
      ];
      const footer = [{ id: 'again', label: rs.mode === 'bracket' ? 'New bracket' : 'Play again', primary: true }, { id: 'menu', label: 'Menu' }];
      return { items, footer, col: readerCol() };
    }
    case 'demolimit': {
      const items = [
        { t: 'title', text: 'That was the free taste', size: 40 },
        { t: 'para', text: 'You have played the free rounds in this web preview. The full game, with the bracket, all three ballparks and unlimited play, is on iPhone and Android.' },
        { t: 'para', text: 'Auto Play is still free to watch.' },
      ];
      return { items, footer: [{ id: 'auto', label: 'Watch Auto Play' }, { id: 'menu', label: 'Menu', primary: true }] };
    }
    default: return { items: [], footer: [] };
  }
}

// ---- rules figures ---------------------------------------------------------------------------------------------------------------
function drawFigure(ctx, key, w, h, state) {
  ctx.save();
  if (key === 'aim') {
    const cam = { pos: [0, 40, -30], look: [0, 0, 55], fov: 40 };
    ctx.fillStyle = '#2d6a3a'; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    const cx = w / 2, by = h - 20;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    for (const a of [-FOUL_DEG, 0, FOUL_DEG]) { ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx + Math.sin(a * DEG) * h * 1.2, by - Math.cos(a * DEG) * h * 0.95); ctx.stroke(); }
    ctx.setLineDash([8, 8]); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 4;
    for (const [a, lift] of [[-30, 0.6], [0, 1], [26, 0.75]]) { ctx.beginPath(); ctx.moveTo(cx, by); ctx.quadraticCurveTo(cx + Math.sin(a * DEG) * h * 0.45, by - h * 0.7 - lift * 20, cx + Math.sin(a * DEG) * h * 0.95, by - Math.cos(a * DEG) * h * 0.78); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = `600 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('drag left or right to aim, up to lift', cx, 30);
  } else if (key === 'timing') {
    const y = h / 2, x0 = 30, x1 = w - 30; ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x0, y - 16, x1 - x0, 32, 16); ctx.fill();
    const mid = x0 + (x1 - x0) * 0.72, sc = (x1 - x0) * 0.72 / 0.5;
    for (const [k, col] of [['weak', '#7a7a8a'], ['ok', '#c8a050'], ['good', '#6bdc8b'], ['perfect', '#ffd34d']]) { const d = WINDOWS[k] * sc * 1.0; ctx.fillStyle = col; rr(ctx, mid - d, y - 16, d * 2, 32, 12); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('ball arrives', mid, y - 28); ctx.fillText('early', x0 + 40, y + 50); ctx.fillText('late', x1 - 30, y + 50);
  } else if (key === 'field') {
    const cx = w / 2, by = h - 14, sc = (h - 30) / 125;
    ctx.fillStyle = '#2d6a3a'; rr(ctx, 0, 0, w, h, 18); ctx.fill();
    ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 5; ctx.beginPath();
    for (let a = -FOUL_DEG; a <= FOUL_DEG; a += 3) { const d = fenceDist(state.prefs.park, a) * sc; const x = cx + Math.sin(a * DEG) * d, y = by - Math.cos(a * DEG) * d; if (a === -FOUL_DEG) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
    for (let i = 0; i < SECTORS; i++) { const a0 = -FOUL_DEG + i * 18, a1 = a0 + 18; ctx.beginPath(); ctx.moveTo(cx, by); for (let a = a0; a <= a1; a += 3) ctx.lineTo(cx + Math.sin(a * DEG) * 128 * sc, by - Math.cos(a * DEG) * 128 * sc); ctx.closePath(); ctx.fillStyle = i === 3 ? 'rgba(255,236,150,0.55)' : 'rgba(255,255,255,0.08)'; ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText('lit section = double', cx, 30);
  }
  ctx.restore();
}

function drawBracket(ctx, w, h, state) {
  const b = state.br; ctx.save();
  const land = w > h * 1.2;
  const box = (m, bx, by, bw, bh, k) => {
    ctx.fillStyle = 'rgba(40,30,66,0.85)'; rr(ctx, bx, by, bw, bh, 12); ctx.fill();
    if (!m) { ctx.fillStyle = 'rgba(255,244,220,0.4)'; ctx.textAlign = 'center'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.fillText('?', bx + bw / 2, by + bh / 2 + 7); return; }
    ctx.strokeStyle = m.a === 0 || m.b === 0 ? PAL.gold : 'rgba(255,214,140,0.25)'; ctx.lineWidth = 2; rr(ctx, bx, by, bw, bh, 12); ctx.stroke();
    for (const [q, id, sc] of [[0, m.a, m.sa], [1, m.b, m.sb]]) {
      const nm = b.players[id].name, yy = by + bh * (q ? 0.74 : 0.36), win = m.winner === id;
      const f = fitFont(ctx, nm, txt(20), bw - 56, win ? 700 : 500); ctx.font = `${win ? 700 : 500} ${f}px ${SANS}`; ctx.fillStyle = win ? PAL.gold : '#fff4dc'; ctx.textAlign = 'left'; ctx.fillText(nm, bx + 10, yy + 6);
      ctx.textAlign = 'right'; ctx.fillText(sc ? String(sc.score) : '', bx + bw - 10, yy + 6);
    }
  };
  if (land) {
    const cols = 3, cw = w / cols;
    for (let r = 0; r < cols; r++) {
      const n = 4 >> r;
      ctx.fillStyle = r === b.rd ? PAL.gold : 'rgba(255,244,220,0.6)'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'center'; ctx.fillText(ROUND_NAMES[r], r * cw + cw / 2, 20);
      for (let i = 0; i < n; i++) { const y = 36 + (h - 50) * (i + 0.5) / n, bh = Math.min(86, (h - 50) / n - 8); box(b.rounds[r] ? b.rounds[r][i] : null, r * cw + 8, y - bh / 2, cw - 16, bh); }
    }
  } else {
    const rowH = h / 3;
    for (let r = 0; r < 3; r++) {
      const n = 4 >> r, bw = (w - 8 * (n + 1)) / n, y0 = r * rowH;
      ctx.fillStyle = r === b.rd ? PAL.gold : 'rgba(255,244,220,0.6)'; ctx.font = `700 ${txt(20)}px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(ROUND_NAMES[r], 8, y0 + 22);
      for (let i = 0; i < n; i++) box(b.rounds[r] ? b.rounds[r][i] : null, 8 + i * (bw + 8), y0 + 32, bw, rowH - 44);
    }
  }
  ctx.restore();
}

// ---- in-play HUD ---------------------------------------------------------------------------------------------------------------------
function pips(ctx, x, y, n, used, size, color) {
  for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(x + i * (size * 1.5) + size / 2, y, size / 2, 0, 7); ctx.fillStyle = i < used ? color : 'rgba(255,255,255,0.18)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.stroke(); }
}

function drawHud(ctx, state) {
  const r = state.r, hud = LY.hud, zs = Math.min(scaleOf(state), 2);
  panel(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, { radius: 22, top: 'rgba(14,20,44,0.82)', bottom: 'rgba(10,14,32,0.82)' });
  edgeStroke(ctx, { x: hud.x, y: hud.y, w: hud.w, h: hud.h }, 22, 0.5);
  const pad = 18, mw = hud.textMaxW, compact = hud.h < 100;
  ctx.textBaseline = 'alphabetic';
  const lab = `${r.label} · ${r.batter.name}`;
  const f1 = fitFont(ctx, lab, txt(20) * zs, compact ? mw * 0.5 : mw, 600); ctx.font = `600 ${f1}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,180,0.9)'; ctx.textAlign = 'left'; ctx.fillText(lab, hud.x + pad, hud.y + 8 + f1);
  const big = Math.min(58, hud.h * (compact ? 0.42 : 0.44)) * Math.min(zs, 1.3);
  const by = compact ? hud.y + hud.h - 12 : hud.y + 18 + f1 + big * 0.82;
  textFill(ctx, String(r.score), hud.x + pad, by, big, { align: 'left', grad: gradTitle, stroke: 'rgba(60,20,10,0.5)' });
  ctx.font = `700 ${big}px ${FONT}`; const sw = ctx.measureText(String(r.score)).width;
  const info = `pts   ${r.hr} HR   best ${Math.round(r.longest)} m`;
  const f2 = fitFont(ctx, info, txt(20) * zs, mw - sw - 20, 600); ctx.font = `600 ${f2}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.fillText(info, hud.x + pad + sw + 10, by);
  const ps = 16;
  if (r.swingOff) { ctx.font = `700 ${txt(20) * zs}px ${SANS}`; ctx.fillStyle = PAL.peach; ctx.fillText(`swing ${Math.min(r.pitches + (['pitch', 'flight', 'swing'].includes(r.phase) ? 0 : 1), r.limit)} of ${r.limit}`, hud.x + pad, hud.y + hud.h - 14); }
  else {
    const n = r.outsMax;
    if (compact) { const pw = Math.min(ps, (mw * 0.5) / (n * 1.5)); pips(ctx, hud.x + hud.w - 18 - n * pw * 1.5 - (LY.think.x < hud.x + hud.w ? 0 : 0) + (compact ? -0 : 0) - 64 + 64 - (hud.w - mw - 22 > 0 ? 0 : 0), hud.y + 8 + f1 * 0.62, n, r.outs, pw, '#ff6b57'); }
    else { const pw = Math.min(ps, (mw - 80) / (n * 1.5)); const label = 'outs'; ctx.font = `600 ${txt(18) * zs}px ${SANS}`; ctx.fillStyle = 'rgba(255,230,180,0.85)'; ctx.fillText(label, hud.x + pad, hud.y + hud.h - 12); const lw = ctx.measureText(label).width; pips(ctx, hud.x + pad + lw + 12, hud.y + hud.h - 18, n, r.outs, pw, '#ff6b57'); }
  }
  // pause / think
  drawPill(ctx, LY.pause, state.paused ? '▶' : 'II', { size: 28 });
  drawPill(ctx, LY.think, '?', { size: 32, disabled: r.hints <= 0 || !['ready', 'windup'].includes(r.phase) || state.scene === 'auto' });
  ctx.font = `700 ${txt(14)}px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'; ctx.fillText(String(r.hints), LY.think.x + LY.think.w - 8, LY.think.y + LY.think.h + 14);
  // spotlight strip
  const S = LY.strip, cw = S.w / SECTORS;
  for (let i = 0; i < SECTORS; i++) {
    const on = i === r.spot, c = { x: S.x + i * cw + 3, y: S.y, w: cw - 6, h: S.h };
    ctx.fillStyle = on ? 'rgba(255,224,120,0.95)' : 'rgba(255,255,255,0.1)'; rr(ctx, c.x, c.y, c.w, c.h, 12); ctx.fill();
    if (on) { ctx.fillStyle = '#3a2204'; ctx.font = `800 ${Math.min(26, S.h * 0.5)}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('x2', c.x + c.w / 2, c.y + c.h / 2 + 1); }
    else { ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; rr(ctx, c.x, c.y, c.w, c.h, 12); ctx.stroke(); }
  }
  ctx.textBaseline = 'alphabetic';
}

function drawAimPreview(ctx, state, cam) {
  const r = state.r, a = r.aim;
  if (!a || !a.active || !['ready', 'windup', 'pitch'].includes(r.phase) || r.sw) return;
  const fly = flyBall({ launch: a.loft, spray: a.s * 42, v: 47, bp: [0, 0.9, 0.3], qt: 1 }, r.park);
  const pts = []; const n = fly.traj.length / 3;
  for (let i = 0; i < n; i += 4) { const p = project(cam, LY.w, LY.h, [fly.traj[i * 3], fly.traj[i * 3 + 1], fly.traj[i * 3 + 2]], {}); if (p.ok) pts.push(p); }
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,224,120,0.9)'; ctx.lineWidth = 5; ctx.setLineDash([2, 14]);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
  const e = pts[pts.length - 1]; if (e) { ctx.fillStyle = 'rgba(255,224,120,0.95)'; ctx.beginPath(); ctx.arc(e.x, e.y, 9, 0, 7); ctx.fill(); }
  ctx.restore();
}

function drawTimingBar(ctx, state) {
  const r = state.r;
  if (!state.prefs.guide || r.phase !== 'pitch' || !r.pitch) return;
  const T = r.pitch.T, W = Math.min(360, LY.U.w - 60), x0 = LY.cx - W / 2, y = LY.chip.y;
  ctx.fillStyle = 'rgba(10,14,32,0.6)'; rr(ctx, x0 - 8, y - 18, W + 16, 36, 18); ctx.fill();
  const ideal = (T - LEAD) / T;
  const sc = r.win * r.assist * (r.pitch ? PITCHES[r.pitch.type].win : 1);
  const span = (k) => (WINDOWS[k] * sc) / T * W;
  const cx = x0 + ideal * W;
  for (const [k, col] of [['weak', '#7a7a8a'], ['ok', '#c8a050'], ['good', '#6bdc8b'], ['perfect', '#ffd34d']]) { const d = span(k); ctx.fillStyle = col; ctx.globalAlpha = 0.9; rr(ctx, cx - d, y - 9, d * 2, 18, 8); ctx.fill(); }
  ctx.globalAlpha = 1;
  const px = x0 + clamp(r.pt / T, 0, 1.1) * W;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, y, 9, 0, 7); ctx.fill();
  ctx.font = `700 ${txt(16)}px ${SANS}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.textAlign = 'center'; ctx.fillText('lift here', cx, y - 24);
}

function drawBanner(ctx, state) {
  const r = state.r, res = r.res;
  if (!res || r.phase !== 'result') return;
  const k = smooth(r.pt / 0.22), y = LY.callY;
  const size = (res.hr ? 84 : 58) * Math.min(1, LY.w / 520) * (0.7 + 0.3 * k);
  ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.5) * (r.pt > (res.hr ? 2.2 : 1.2) ? clamp(1 - (r.pt - (res.hr ? 2.2 : 1.2)) / 0.3, 0, 1) : 1);
  textFill(ctx, res.text, LY.cx, y, size, { grad: res.hr ? [[0, '#fff3a8'], [1, '#ff9d2b']] : [[0, '#e8eefc'], [1, '#9db0d8']], stroke: 'rgba(40,16,10,0.7)' });
  textFill(ctx, res.sub + (res.spot ? '   SPOTLIGHT x2' : '') + (res.moon ? '   MOONSHOT' : ''), LY.cx, y + size * 0.5, Math.max(txt(26), size * 0.36), { color: res.hr ? '#fff4dc' : '#c9d3ee' });
  if (res.refund) textFill(ctx, 'Out given back', LY.cx, y + size * 0.5 + 40, txt(26), { color: PAL.teal });
  ctx.restore();
}

function drawPitchTag(ctx, state) {
  const r = state.r;
  if (!r.pitch || r.phase !== 'pitch' || r.pt > 0.9) return;
  const T = PITCHES[r.pitch.type], y = LY.pitchTag.y, a = clamp(1 - (r.pt - 0.6) / 0.3, 0, 1);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${txt(30)}px ${SANS}`; const w = ctx.measureText(T.name.toUpperCase()).width + 44;
  ctx.fillStyle = T.color; rr(ctx, LY.cx - w / 2, y - 26, w, 52, 26); ctx.fill();
  ctx.fillStyle = '#10142a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(T.name.toUpperCase(), LY.cx, y + 2); ctx.restore();
}

function drawHints(ctx, state) {
  const r = state.r; if (state.scene !== 'play') return;
  let msg = null;
  if (r.phase === 'ready' || r.phase === 'windup') msg = state.prefs.coach < 6 ? 'Hold and drag to aim. Lift your finger to swing.' : null;
  else if (r.phase === 'pitch' && !r.sw && state.prefs.coach < 3) msg = 'Lift now!';
  if (msg) { ctx.font = `600 ${txt(22)}px ${SANS}`; const w = ctx.measureText(msg).width + 36; ctx.fillStyle = 'rgba(10,14,32,0.62)'; rr(ctx, LY.cx - w / 2, LY.hintY - 28, w, 44, 22); ctx.fill(); ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(msg, LY.cx, LY.hintY - 6); ctx.textBaseline = 'alphabetic'; }
}

function drawThink(ctx, state) {
  const th = state.think, TC = LY.thinkCard, zs = Math.min(scaleOf(state), 2);
  const maxH = TC.bottom - (LY.U.y0 + LY.hud.h + 30);
  let fs = 25 * zs, wrapped; const textW = TC.w - 52;
  for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = th.lines.map((l) => wrapLines(ctx, l, textW)); const n = wrapped.reduce((a, w) => a + w.length, 0); const need = 96 + n * fs * 1.32 + wrapped.length * 8; if (need <= maxH || fs <= LY.minText) { wrapped.need = need; break; } fs -= 1; }
  const r = { x: TC.x, y: Math.min(TC.bottom - (LY.land ? 250 : 330), TC.bottom - wrapped.need - 10), w: TC.w, h: 0 };
  r.h = TC.btn.y + TC.btn.h + 20 - r.y;
  ctx.fillStyle = 'rgba(8,5,20,0.45)'; ctx.fillRect(0, 0, LY.w, LY.h);
  panel(ctx, r, { radius: 30 });
  textFill(ctx, 'THINK', LY.cx, r.y + 52, 38, { grad: [[0, '#d4fff2'], [1, '#2ec4b6']], stroke: 'rgba(0,40,40,0.5)' });
  ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let y = r.y + 100 + fs * 0.2; for (const ws of wrapped) { for (const l of ws) { ctx.fillText(l, r.x + 24, y); y += fs * 1.32; } y += 8; }
  drawButton(ctx, TC.btn, 'Got it', { primary: true, size: 30 });
}

function drawPauseMenu(ctx, state) {
  const P = LY.pauseMenu; ctx.fillStyle = 'rgba(8,5,20,0.72)'; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, 'Paused', LY.cx, P.titleY, 66, { grad: gradTitle, stroke: 'rgba(60,20,10,0.5)' });
  const fs = 30 * Math.min(Math.min(scaleOf(state), 2), 1.5);
  drawButton(ctx, P.resume, 'Resume', { primary: true, size: fs });
  drawButton(ctx, P.sound, state.prefs.sound ? 'Sound: On' : 'Sound: Off', { size: fs });
  drawButton(ctx, P.quit, 'Quit to menu', { danger: true, size: fs });
}

function drawAutoPanel(ctx, state) {
  const a = state.auto, A = LY.auto;
  drawButton(ctx, A.speed, `Speed x${a.speed}`, { size: 24 });
  drawButton(ctx, A.pause, state.paused ? 'RESUME' : 'PAUSE', { primary: state.paused, size: 28 });
  drawButton(ctx, A.dec, '−', { size: 32 }); drawButton(ctx, A.inc, '+', { size: 32 });
  ctx.font = `500 ${txt(16)}px ${SANS}`; ctx.fillStyle = 'rgba(255,244,224,0.8)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(`think ${[2, 5, 8, 10][state.prefs.thinkIdx]}s`, A.thinkLbl.x, A.thinkLbl.y);
  drawPill(ctx, A.exit, 'Exit', { size: 24 });
  const lines = a.lines;
  if (lines.length) {
    const phaseName = a.revealing ? 'REVEAL' : a.phase === 'think' ? 'THINK' : 'ACT';
    const phaseCol = a.revealing ? PAL.gold : a.phase === 'think' ? PAL.teal : '#fff';
    const C = A.card, r = { x: C.x, y: 0, w: C.w, h: 0 }, zs = Math.min(scaleOf(state), 2);
    let fs = 21 * zs, wrapped; const maxH = C.bottom - (LY.hud.y + LY.hud.h + 70);
    for (;;) { ctx.font = `500 ${fs}px ${SANS}`; wrapped = []; for (const l of lines) wrapped.push(...wrapLines(ctx, l, C.w - 44)); if (58 + wrapped.length * fs * 1.33 + 14 <= maxH || fs <= LY.minText) break; fs -= 1; }
    r.h = 58 + wrapped.length * fs * 1.33 + 14; r.y = C.bottom - r.h;
    panel(ctx, r, { radius: 22, top: 'rgba(14,10,30,0.85)', bottom: 'rgba(14,10,30,0.8)' });
    textFill(ctx, phaseName, r.x + 22, r.y + 42, 28, { align: 'left', color: phaseCol, weight: 700 });
    const frac = a.total > 0 ? clamp(1 - a.timer / a.total, 0, 1) : 1;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(ctx, r.x + 150, r.y + 28, r.w - 180, 10, 5); ctx.fill();
    ctx.fillStyle = phaseCol; rr(ctx, r.x + 150, r.y + 28, (r.w - 180) * frac, 10, 5); ctx.fill();
    ctx.font = `500 ${fs}px ${SANS}`; ctx.fillStyle = '#fff4dc'; ctx.textAlign = 'left'; let y = r.y + 58 + fs * 1.05;
    for (const l of wrapped) { ctx.fillText(l, r.x + 22, y); y += fs * 1.33; }
  }
  if (state.paused) textFill(ctx, 'PAUSED', LY.cx, A.pausedY, 56, { color: '#fff', stroke: 'rgba(40,10,10,0.7)' });
}

function drawEnd(ctx, state) {
  const r = state.r; if (r.phase !== 'end') return;
  ctx.fillStyle = `rgba(8,12,30,${0.55 * smooth(r.pt / 0.4)})`; ctx.fillRect(0, 0, LY.w, LY.h);
  textFill(ctx, r.swingOff ? 'SWING-OFF DONE' : 'ROUND OVER', LY.cx, LY.h * 0.42, 64 * Math.min(1, LY.w / 600), { grad: gradTitle, stroke: 'rgba(60,20,10,0.6)' });
  textFill(ctx, `${r.hr} home runs, ${r.score} points`, LY.cx, LY.h * 0.42 + 60, txt(34), { color: '#fff4dc' });
}

export function renderPlay(ctx, state) {
  const r = state.r, v = state.v, aspect = LY.w / LY.h;
  const cam = (state.env && state.env.view3d && state.env.view3d.active && state.env.view3d.cam) || cameraFor(r, aspect, r.batter.hand);
  if (live3d(state)) ctx.clearRect(0, 0, LY.w, LY.h);
  else { ctx.fillStyle = '#0d1226'; ctx.fillRect(0, 0, LY.w, LY.h); drawBallpark(ctx, LY.w, LY.h, cam, r, r.park, state.t); }
  if (v.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${v.flash * 0.3})`; ctx.fillRect(0, 0, LY.w, LY.h); }
  if (v.cut > 0.01) { ctx.fillStyle = `rgba(10,14,30,${clamp(v.cut, 0, 1)})`; ctx.fillRect(0, 0, LY.w, LY.h); }
  drawAimPreview(ctx, state, cam);
  drawParticles(ctx, v.parts);
  drawPitchTag(ctx, state); drawTimingBar(ctx, state);
  drawBanner(ctx, state);
  drawHud(ctx, state); drawHints(ctx, state);
  if (state.scene === 'auto') drawAutoPanel(ctx, state);
  if (r.phase === 'end') drawEnd(ctx, state);
  if (state.think.open) drawThink(ctx, state);
  if (state.paused && state.scene === 'play') drawPauseMenu(ctx, state);
  // live touch trail
  const tc = state.touch;
  if (tc.down && tc.cur && state.scene === 'play') { ctx.strokeStyle = 'rgba(255,207,107,0.85)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(tc.sx, tc.sy); ctx.lineTo(tc.cur[0], tc.cur[1]); ctx.stroke(); ctx.fillStyle = 'rgba(255,207,107,0.9)'; ctx.beginPath(); ctx.arc(tc.sx, tc.sy, 12, 0, 7); ctx.fill(); }
}

export function renderScene(ctx, state) {
  const sc = state.scene;
  if (sc === 'play' || sc === 'auto') { renderPlay(ctx, state); return; }
  columnScreen(ctx, state, sceneSpec(state));
}
export { MOONSHOT_M, ballNow, READY_T, WINDUP_T, outsLeft, aimFromDrag, DEFAULT_AIM, lerp, vGrad, drawMoreLine };
