// Everything drawn each frame. Reads state, changes nothing (apart from small caches).
import {
  W, H, DISPLAY, THEMES, themeById, text, rr, panel, button, background, icon, drawParticles, drawPiece, boardGeo, pointXY, drawBoard,
  routeGeom, pointAlong, strokeRoute, tracePath, arrow, alpha, clamp01, ease, easeIO, backOut,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { parse, captureRoute, attackedBy, countOf, QUIET_LIMIT, other, sideName, colOf, rowOf } from './rules.js';
import { LEVELS } from './ai.js';
import { LESSONS } from './lessons.js';
import { tr } from './content.js';
import { layoutFor } from './layout.js';
import { drawCredit, drawMoreLine, drawLockup } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { targetsOf, humanTurn, movesOf } from './match.js';

const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
export function fitText(str, w, h, start, min = 20, lh = 1.28) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 16) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };

const acc = (th) => (th.accent.length === 7 ? th.accent : '#e8c46a');

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18);
  ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of layout.items) {
    const b = it.b;
    const top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, th.accent, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) {
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(246,236,214,0.93)', { weight: 500, align: center ? 'center' : 'left' });
      }
    } else if (b.t === 'img') {
      drawArt(ctx, S, b.name, ox, top, it.w, b.h, b);
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 });
        else button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    }
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = alpha(acc(th), 0.75);
    rr(ctx, region.x + region.w + 8, ty, 6, tH, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(246,236,214,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, th, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 2 : 0), 30, th.ink);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 2 : 0), f.size, th.ink, { weight: 700 });
    } else button(ctx, th, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// ------------------------------------------------------------------------------- boards for illustrations
// cells: 6 rows of 6 as a string (X Light, O Dark, . empty). o: { caps: [[from, to]], dots: [i], rings: [i], hl: [i], circuit: 1|2, flip, who }
export function drawMini(ctx, th, x, y, side, cells, o = {}) {
  const geo = boardGeo(x, y, side, Boolean(o.flip));
  const st = typeof cells === 'string' ? parse(cells) : cells;
  drawBoard(ctx, th, geo, { flat: true, thick: side * 0.02 });
  if (o.circuit) {
    const c = o.circuit === 1 ? th.outer : th.inner;
    ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = `rgba(${c.glow},0.9)`; ctx.shadowBlur = geo.u * 0.35;
    ctx.beginPath(); tracePath(ctx, geo, o.circuit); ctx.strokeStyle = `rgba(${c.glow},0.55)`; ctx.lineWidth = Math.max(5, geo.u * 0.3); ctx.stroke();
    ctx.restore();
  }
  for (const [f, t] of o.caps ?? []) {
    const who = st.cells[f];
    const route = captureRoute(st.cells, f, t, who);
    if (route) { const rg = routeGeom(route, geo); const gl = (who === 1 ? th.light : th.dark).glow; strokeRoute(ctx, rg, 0, rg.len, who === 1 ? '#ffffff' : th.dark.rim, gl, Math.max(4, geo.u * 0.12), 0.95); }
  }
  for (const i of o.hl ?? []) { const [px, py] = pointXY(geo, i); ctx.fillStyle = alpha(acc(th), 0.3); ctx.beginPath(); ctx.arc(px, py, geo.u * 0.44, 0, Math.PI * 2); ctx.fill(); }
  for (const i of o.dots ?? []) { const [px, py] = pointXY(geo, i); ctx.fillStyle = alpha(acc(th), 0.9); ctx.beginPath(); ctx.arc(px, py, geo.u * 0.12, 0, Math.PI * 2); ctx.fill(); }
  st.cells.forEach((v, i) => { if (v) { const [px, py] = pointXY(geo, i); drawPiece(ctx, th, v, px, py, geo.d, { noShadow: side < 200 }); } });
  for (const r of o.rings ?? []) { const [px, py] = pointXY(geo, r.i); ctx.strokeStyle = r.color; ctx.lineWidth = Math.max(3, geo.u * 0.09); ctx.beginPath(); ctx.arc(px, py, geo.d * 0.68, 0, Math.PI * 2); ctx.stroke(); }
  return geo;
}

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.82)') => text(ctx, str, x, y, size, col, { weight: 600 });
const START = 'OOOOOO/OOOOOO/....../....../XXXXXX/XXXXXX';
const RED = '#ff6a5a';

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,8,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const side = (reserve) => Math.min(h - reserve, w - 24);
  const mb = (s, bx, by, cells, o) => drawMini(ctx, th, bx, by, s, cells, o);
  if (name === 'logo') {
    const s = Math.min(h - 24, 300); mb(s, cx - s / 2, y + 12, 'OOO.../OOO.O./O.O.../.X.X.X/X.X.../XX.X.X', { caps: [[26, 10]] });
  } else if (name === 'setupart' || name === 'setup') {
    const s = side(46); mb(s, cx - s / 2, y + 8, START, {});
    cap(ctx, 'Light starts at the bottom, Dark at the top', cx, y + h - 14, 20);
  } else if (name === 'circuits') {
    const s = Math.min(w * 0.46, h - 60);
    mb(s, x + 14, y + 14, '....../....../....../....../....../......', { circuit: 1 });
    mb(s, x + w - s - 14, y + 14, '....../....../....../....../....../......', { circuit: 2 });
    cap(ctx, 'outer circuit', x + 14 + s / 2, y + h - 18, 22, th.outer.line); cap(ctx, 'inner circuit', x + w - s / 2 - 14, y + h - 18, 22, th.inner.line);
  } else if (name === 'step') {
    const s = side(56); const g = mb(s, cx - s / 2, y + 8, '....../....../..O.../..X.../....../......', { dots: [8, 9, 10, 14, 16, 20, 21, 22].filter((i) => i !== 14 && i !== 8) });
    void g; cap(ctx, 'one step in any of eight directions', cx, y + h - 16, 21);
  } else if (name === 'capture1') {
    const s = side(56); mb(s, cx - s / 2, y + 8, '....O./....../..O.../....../....X./X.....', { caps: [[28, 4]] });
    cap(ctx, 'along a circuit, round a loop, onto an enemy', cx, y + h - 16, 20, th.accent);
  } else if (name === 'loopneeded') {
    const s = Math.min(w * 0.46, h - 70);
    mb(s, x + 14, y + 12, '....../....../..OO../....../..X.../......', { rings: [{ i: 14, color: RED }] });
    mb(s, x + w - s - 14, y + 12, '....../....../..O.../....../..X.../......', { caps: [[26, 14]] });
    cap(ctx, 'no loop: no capture', x + 14 + s / 2, y + h - 18, 20, '#ff9d8f'); cap(ctx, 'round a loop: capture', x + w - s / 2 - 14, y + h - 18, 20, th.accent);
  } else if (name === 'own') {
    const s = side(56); mb(s, cx - s / 2, y + 8, '.....O/O....O/...O../...X../....../.....X', { caps: [[21, 15]] });
    cap(ctx, 'the route passes over its own starting point', cx, y + h - 16, 20, th.accent);
  } else if (name === 'blocked') {
    const s = Math.min(w * 0.46, h - 70);
    mb(s, x + 14, y + 12, '....../..O.../..XX../....../....../......', { rings: [{ i: 14, color: RED }] });
    mb(s, x + w - s - 14, y + 12, '....../..O.../...X../....../....../......', { caps: [[15, 8]] });
    cap(ctx, 'your own piece blocks', x + 14 + s / 2, y + h - 18, 20, '#ff9d8f'); cap(ctx, 'clear path: capture', x + w - s / 2 - 14, y + h - 18, 20, th.accent);
  } else if (name === 'corner') {
    const s = side(56); mb(s, cx - s / 2, y + 8, 'O...../....../....../....../....../.....X', { rings: [{ i: 0, color: th.accent }, { i: 35, color: th.accent }] });
    cap(ctx, 'corners are on no circuit: safe, but they cannot capture', cx, y + h - 16, 19);
  } else if (name === 'cross') {
    const s = side(56); mb(s, cx - s / 2, y + 8, '....../....../....../....../....../......', { hl: [8, 9, 13, 19, 16, 22, 26, 27] });
    cap(ctx, 'the 8 crossing points are on both circuits', cx, y + h - 16, 20, th.accent);
  } else if (name === 'win') {
    const s = side(56); mb(s, cx - s / 2, y + 8, '....../....../..X.../....../....../......', {});
    cap(ctx, 'capture every enemy piece to win', cx, y + h - 16, 21, th.accent);
  } else if (name === 'draw') {
    const s = side(56); mb(s, cx - s / 2, y + 8, 'O.O.../....../.O..../..X.../....../.X.X..', {});
    cap(ctx, `${QUIET_LIMIT} moves without a capture: more pieces wins`, cx, y + h - 16, 20);
  } else if (name === 'think') {
    const s = side(100); const g = mb(s, cx - s / 2, y + 8, '....O./....../..O.../....../....X./X.....', { caps: [[28, 4]] });
    void g;
    ctx.fillStyle = 'rgba(10,8,8,0.8)'; rr(ctx, x + 30, y + h - 76, w - 60, 56, 28); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 30, y + h - 76, w - 60, 56, 28); ctx.stroke();
    cap(ctx, 'Wins a piece, and nothing of yours is attacked.', cx, y + h - 40, fitOne('Wins a piece, and nothing of yours is attacked.', w - 90, 22, 14), th.accent);
  } else if (name === 'threats') {
    const s = side(56); mb(s, cx - s / 2, y + 8, '....O./....../..O.../....../....X./X.....', { rings: [{ i: 28, color: RED }, { i: 4, color: th.accent }] });
    cap(ctx, 'red ring: in danger   gold ring: you could take it', cx, y + h - 16, 19);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, l.name, x + 120, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 250, yy + 12, w - 290, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 250, yy + 12, (w - 290) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'learn') {
    [['Step one point', true], ['Capture round a loop', true], ['Through your own square', false]].forEach(([nm, done], i) => {
      const yy = y + 20 + i * 112;
      ctx.fillStyle = done ? th.btnOn[0] : th.btn[0]; rr(ctx, x + 24, yy, w - 48, 96, 16); ctx.fill();
      mb(80, x + 36, yy + 8, i === 0 ? '....../....../..O.../..X.../....../......' : i === 1 ? '....O./....../..O.../....../....X./X.....' : '.....O/O....O/...O../...X../....../.....X', { noBand: true });
      text(ctx, nm, x + 140, yy + 56, 26, th.ink, { weight: 700, align: 'left' });
      if (done) icon(ctx, 'check', x + w - 70, yy + 48, 40, th.ink);
    });
  } else if (name === 'undo') {
    icon(ctx, 'undo', cx - 130, cy - 14, 84, th.accent); icon(ctx, 'pause', cx + 130, cy - 14, 84, th.accent);
    cap(ctx, 'Undo', cx - 130, cy + 70, 24); cap(ctx, 'Pause and Continue', cx + 130, cy + 70, 24);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawPiece(ctx, th, 1, cx + 10, cy, 96, { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
    cap(ctx, 'THINK  ·  REVEAL  ·  ACT', cx, y + h - 18, 22, th.accent);
  } else if (name === 'themes') {
    const s = (w - 4 * 16) / 3;
    THEMES.forEach((tt, i) => {
      const bx = x + 16 + i * (s + 16);
      drawMini(ctx, tt, bx, cy - s / 2 - 14, s, '....O./....../..O.../....../....X./X.....', { caps: [[28, 4]] });
      cap(ctx, tt.name.split(' ')[1], bx + s / 2, cy + s / 2 + 22, 19);
    });
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    const pd = Math.min(110, h * 0.62);
    if (e.winner === 1 || e.winner === 2) drawPiece(ctx, th, e.winner, cx, cy + 4, pd, { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4) });
    else { drawPiece(ctx, th, 1, cx - 80, cy + 4, pd * 0.9, { scale: k }); drawPiece(ctx, th, 2, cx + 80, cy + 4, pd * 0.9, { scale: k }); }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
// The title's attract scene: a real capture is played out on a real board over and over.
const ATTRACT = 'OOO.../OOO.O./O.O.../.X.X.X/X.X.../XX.X.X';
const ATTRACT_MV = [26, 10];

function drawAttract(ctx, S) {
  const th = theme(S), t = S.t;
  const side = 440, bx = (W - side) / 2, by = 352;
  const geo = boardGeo(bx, by, side, false);
  const glow = ctx.createRadialGradient(W / 2, by + side / 2, 30, W / 2, by + side / 2, 360);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, by - 140, W, side + 280);
  drawBoard(ctx, th, geo, {});
  const st = parse(ATTRACT);
  const route = captureRoute(st.cells, ATTRACT_MV[0], ATTRACT_MV[1], 1);
  const rg = routeGeom(route, geo);
  const cycle = 7, tt = t % cycle;
  const go = clamp01((tt - 1.2) / 2.6), e = easeIO(go), s = e * rg.len;
  const landed = go >= 1;
  const fade = tt > 5.8 ? 1 - clamp01((tt - 5.8) / 0.8) : 1;
  ctx.save(); ctx.globalAlpha = fade;
  if (tt > 0.6 && !landed) strokeRoute(ctx, rg, 0, rg.len, 'rgba(255,255,255,0.5)', th.light.glow, 7, 0.45 * clamp01((tt - 0.6) / 0.6));
  if (go > 0) strokeRoute(ctx, rg, Math.max(0, s - rg.len * 0.35), s, '#ffffff', th.light.glow, 8, landed ? Math.max(0, 1 - (tt - 3.8) * 1.4) : 1);
  st.cells.forEach((v, i) => {
    if (!v) return;
    const [px, py] = pointXY(geo, i);
    if (i === ATTRACT_MV[0]) { if (go <= 0) drawPiece(ctx, th, v, px, py, geo.d, {}); return; }
    if (i === ATTRACT_MV[1] && landed) return;
    drawPiece(ctx, th, v, px, py, geo.d, { glow: i === ATTRACT_MV[1] && go > 0.7 ? 0.8 : 0 });
  });
  if (go > 0) { const [px, py] = landed ? pointXY(geo, ATTRACT_MV[1]) : pointAlong(rg, s); drawPiece(ctx, th, 1, px, py, geo.d, { lift: landed ? 0 : 0.6, glow: 0.5 }); }
  ctx.restore();
  const g = ctx.createLinearGradient(0, 120, 0, 290);
  g.addColorStop(0, light2(th.accent)); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 108px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText('Surakarta', 360, 206);
  ctx.restore();
  text(ctx, 'The looping capture game', 360, 262, 30, 'rgba(246,236,214,0.88)', { weight: 600 });
  text(ctx, tr('tagline') === 'The looping capture game' ? 'Circuits  ·  Loops  ·  Captures' : tr('tagline'), 360, 306, 24, 'rgba(246,236,214,0.6)', { weight: 500 });
}
const light2 = (c) => (c.length === 7 ? `rgb(${Math.min(255, parseInt(c.slice(1, 3), 16) + 70)},${Math.min(255, parseInt(c.slice(3, 5), 16) + 70)},${Math.min(255, parseInt(c.slice(5, 7), 16) + 70)})` : '#fff3c4');

function drawTitle(ctx, S, ui) {
  const L = S.L, m = L.menu, h = m.hero;
  background(ctx, theme(S), S.t, h.ty + 560 * h.sc, L.w, L.h, h.tx + 360 * h.sc);
  ctx.save(); ctx.translate(h.tx, h.ty); ctx.scale(h.sc, h.sc); drawAttract(ctx, S); ctx.restore();
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  let cs = 20; while (cs > 17 && tw('AF  ARCFORGE · World Heritage Games', cs) * 1.5 > m.credit.maxW) cs -= 1;
  { const c = m.lock, pad = c.h * 0.12, dim = S.press && S.press.kind === 'lock'; ctx.save(); ctx.globalAlpha = dim ? 0.7 : 1; ctx.fillStyle = 'rgba(10,8,24,0.55)'; ctx.beginPath(); ctx.roundRect(c.x - pad, c.y - pad, c.w + 2 * pad, c.h + 2 * pad, (c.h + 2 * pad) * 0.3); ctx.fill(); if (!drawLockup(ctx, c.x + c.w / 2, c.y + c.h, c.w, 1)) drawCredit(ctx, m.credit.x, m.credit.y, cs, { dim: 0.9 }); ctx.restore(); }
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S), L = S.L;
  background(ctx, th, S.t, 700, L.w, L.h);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, ui.nav.x, ui.nav.y, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S), L = S.L;
  ctx.fillStyle = `rgba(6,4,4,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, L.w, L.h);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  const ox = ui.panel.x + ui.panel.w / 2, oy = ui.panel.y + ui.panel.h / 2;
  ctx.translate(ox, oy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-ox, -oy);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.foot) drawMoreLine(ctx, ui.panel.x + ui.panel.w / 2, ui.panel.y + ui.panel.h - 18, 19);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
// Top header: title + sub line (centred on its anchor), plus the icon buttons that live there (back / pause / exit).
function drawHud(ctx, S, P, title, sub) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const tSize = fitOne(title, P.title.maxW, 40 * (1 + (z - 1) * 0.25), 22);
  text(ctx, title, P.title.cx, P.title.y, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  let sSize = 24 * (1 + (z - 1) * 0.3), lines = [sub];
  while (sSize > 20 && tw(sub, sSize) > P.sub.maxW) sSize -= 1;
  if (tw(sub, sSize) > P.sub.maxW) {
    sSize = 20; lines = wrap(sub, sSize, P.sub.maxW).slice(0, 2);
    if (lines.length === 2 && tw(sub, sSize) > P.sub.maxW * 2) sSize = 18;
  }
  const y0 = P.sub.y - (lines.length > 1 ? P.sub.shift : 0);
  lines.forEach((ln, i) => text(ctx, ln, P.sub.cx, y0 + i * (sSize + 4), sSize, 'rgba(246,236,214,0.7)', { weight: 500 }));
}

function drawPlate(ctx, S, r, who, name, sub, active) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = active ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active ? 3 : 1.5;
  if (active) { ctx.shadowColor = alpha(acc(th), 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const md = Math.min(r.h - 28, 74, r.w * 0.2);
  drawPiece(ctx, th, who, r.x + 14 + md / 2, r.y + r.h / 2, md * 0.85, { noShadow: true, glow: active ? 0.4 : 0 });
  const tx = r.x + 24 + md, avail = r.w - md - 40;
  const ns = fitOne(name, avail, 30 * (1 + (z - 1) * 0.55), 18);
  let ss = 21 * (1 + (z - 1) * 0.55), sl = wrap(sub, ss, avail);
  while (ss > 18 && (sl.length > 2 || (sl.length > 1 && ns + 8 + sl.length * ss * 1.15 > r.h - 16))) { ss -= 1; sl = wrap(sub, ss, avail); }
  sl = sl.slice(0, 2);
  const total = ns + 8 + sl.length * ss * 1.15, ty = r.y + (r.h - total) / 2 + ns * 0.88;
  text(ctx, name, tx, ty, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  sl.forEach((ln, i) => text(ctx, ln, tx, ty + 8 + ss * (1 + i * 1.15), ss, active ? th.accent : 'rgba(246,236,214,0.62)', { weight: 600, align: 'left' }));
}

function drawStatus(ctx, S, r, head, body, col) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
  const pad = 22, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 24, 32 * (1 + (z - 1) * 0.6), 20);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(246,236,214,0.92)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

const pulse = (S, rate = 5) => 0.5 + 0.5 * Math.sin(S.t * rate);

// Routes of the selected piece's captures, cached on the match for the current position and selection.
function selRoutes(M) {
  if (M.sel < 0) return [];
  if (!M.rc || M.rc.st !== M.st || M.rc.sel !== M.sel) {
    const list = [];
    for (const m of movesOf(M)) if (m.from === M.sel && m.cap) { const route = captureRoute(M.st.cells, m.from, m.to, M.st.turn); if (route) list.push({ to: m.to, route }); }
    M.rc = { st: M.st, sel: M.sel, list };
  }
  return M.rc.list;
}
function routeGeomCached(holder, route, geo) {
  const key = `${geo.x}|${geo.y}|${geo.side}|${geo.flip ? 1 : 0}`;
  if (!holder.rg || holder.rgKey !== key) { holder.rg = routeGeom(route, geo); holder.rgKey = key; }
  return holder.rg;
}

// Draws the board and its pieces for a match. `auto` carries Watch & Learn's reveal info.
export function drawBoardScene(ctx, S, M, geo, auto) {
  const th = theme(S);
  ctx.save();
  const glow = ctx.createRadialGradient(geo.x + geo.side / 2, geo.y + geo.side / 2, 40, geo.x + geo.side / 2, geo.y + geo.side / 2, geo.side * 0.85);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(geo.x - 160, geo.y - 160, geo.side + 320, geo.side + 320);
  drawBoard(ctx, th, geo, {});
  const st = M.st, pl = pulse(S), a = acc(th), A = M.anim;
  const mover = st.turn;
  const glowOf = (who) => (who === 1 ? th.light : th.dark).glow;
  const ringAt = (i, col, lw = 4, al = 1, rad = 0.62) => {
    const [cx, cy] = pointXY(geo, i);
    ctx.save(); ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(cx, cy, geo.d * rad, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };
  const fillAt = (i, col, al, rad = 0.5) => {
    const [cx, cy] = pointXY(geo, i);
    ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(cx, cy, geo.d * rad, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  // last move marks
  if (M.last && !M.over && !A) { ringAt(M.last.to, a, 3, 0.3 + 0.2 * pl, 0.58); fillAt(M.last.from, a, 0.18, 0.2); }
  // threat view
  if (S.threats && !M.over && !auto) {
    const mine = attackedBy(st.cells, mover), theirs = attackedBy(st.cells, other(mover));
    for (const i of mine) ringAt(i, a, 4, 0.55 + 0.35 * pl, 0.7);
    for (const i of theirs) ringAt(i, '#ff6a5a', 4, 0.55 + 0.35 * pl, 0.7);
  }
  // selection: steps and capture trails
  if (M.sel >= 0 && !A) {
    fillAt(M.sel, a, 0.22 + 0.12 * pl, 0.62);
    const who = st.cells[M.sel], gl = glowOf(who);
    for (const m of targetsOf(M)) {
      if (m.cap) continue;
      const [cx, cy] = pointXY(geo, m.to);
      ctx.fillStyle = a; ctx.globalAlpha = 0.6 + 0.3 * pl; ctx.beginPath(); ctx.arc(cx, cy, geo.d * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    for (const r of selRoutes(M)) {
      const rg = routeGeomCached(r, r.route, geo);
      strokeRoute(ctx, rg, 0, rg.len, who === 1 ? '#ffffff' : th.dark.rim, gl, Math.max(4, geo.u * 0.13), 0.55 + 0.35 * pl);
      ringAt(r.to, '#ff6a5a', 4, 0.7 + 0.3 * pl, 0.68);
    }
  }
  // keyboard cursor
  if (S.kbd && humanTurn(M) && !M.over) ringAt(M.cur, '#ffffff', 3, 0.7, 0.66);
  if (M.flash >= 0) fillAt(M.flash, '#ff6a5a', 0.4 * clamp01(M.flashT / 0.3), 0.55);
  // hint
  if (M.hint && !M.over) {
    const mv = M.hint.mv, who = st.cells[mv.from];
    if (M.hint.route) {
      const rg = routeGeomCached(M.hint, M.hint.route, geo);
      strokeRoute(ctx, rg, 0, rg.len, a, glowOf(who), Math.max(5, geo.u * 0.16), 0.6 + 0.4 * pl);
    } else {
      const [x0, y0] = pointXY(geo, mv.from), [x1, y1] = pointXY(geo, mv.to);
      arrow(ctx, a, ...nudge([x0, y0], [x1, y1], geo.d * 0.4));
    }
    ringAt(mv.from, a, 5, 0.8, 0.66); ringAt(mv.to, a, 5, 0.6 + 0.4 * pl, 0.66);
  }
  // Watch & Learn reveal
  if (auto && auto.plan && (auto.phase === 'reveal' || auto.phase === 'act')) {
    const mv = auto.plan.mv, who = st.cells[mv.from] || (A ? A.who : 0);
    if (auto.phase === 'reveal') {
      for (const m of auto.plan.moves) { if (m.cap && !(m.from === mv.from && m.to === mv.to)) ringAt(m.to, 'rgba(160,190,255,0.9)', 3, 0.5 + 0.2 * pl, 0.62); }
      if (auto.plan.route) { const rg = routeGeomCached(auto.plan, auto.plan.route, geo); strokeRoute(ctx, rg, 0, rg.len, a, glowOf(who || 1), Math.max(5, geo.u * 0.16), 0.7 + 0.3 * pl); }
      else { const [x0, y0] = pointXY(geo, mv.from), [x1, y1] = pointXY(geo, mv.to); arrow(ctx, a, ...nudge([x0, y0], [x1, y1], geo.d * 0.4)); }
      ringAt(mv.from, a, 5, 0.9, 0.66); ringAt(mv.to, a, 5, 0.7 + 0.3 * pl, 0.66);
    }
  }
  if (auto && auto.phase === 'think' && auto.scan != null) fillAt(auto.scan, 'rgba(255,255,255,0.8)', 0.08 + 0.08 * pl, 0.5);
  // pieces
  const winner = M.over ? M.over.winner : -1;
  for (let i = 0; i < 36; i++) {
    const who = st.cells[i];
    if (!who) continue;
    if (A && i === A.to) continue; // drawn below, in motion
    const [cx, cy] = pointXY(geo, i);
    let o = {};
    if (M.sel === i) o = { glow: 0.5 + 0.3 * pl, lift: 0.5 };
    else if (M.hint && M.hint.mv.from === i) o = { glow: 0.6 };
    else if (auto && auto.phase === 'reveal' && auto.plan && auto.plan.mv.from === i) o = { glow: 0.5 + 0.4 * pl };
    else if (M.over && M.winT > 0.3 && winner === who) o = { glow: 0.4 + 0.3 * Math.sin(M.winT * 5 + i) };
    else if (M.over && winner > 0 && winner !== who) o = { alpha: 0.7 };
    drawPiece(ctx, th, who, cx, cy, geo.d, o);
  }
  // the moving piece, and the piece about to be captured
  if (A) {
    const [tx, ty] = pointXY(geo, A.to);
    const k = clamp01(A.t / A.dur);
    if (A.cap) {
      const warn = k > 0.55 ? clamp01((k - 0.55) / 0.4) : 0;
      if (k < 1) drawPiece(ctx, th, A.capWho, tx, ty, geo.d, { glow: 0.3 + 0.6 * warn, scale: 1 + 0.08 * warn * Math.sin(S.t * 30) });
      const rg = routeGeomCached(A, A.route, geo), e = easeIO(k), s = e * rg.len;
      strokeRoute(ctx, rg, Math.max(0, s - rg.len * 0.5), s, '#ffffff', glowOf(A.who), Math.max(5, geo.u * 0.16), 1 - clamp01((k - 0.9) / 0.1) * 0.4);
      const [px, py] = k >= 1 ? [tx, ty] : pointAlong(rg, s);
      drawPiece(ctx, th, A.who, px, py, geo.d, { lift: k >= 1 ? 0 : 0.55, glow: 0.7 });
    } else {
      const e = easeIO(k), [fx, fy] = pointXY(geo, A.from);
      drawPiece(ctx, th, A.who, fx + (tx - fx) * e, fy + (ty - fy) * e, geo.d, { lift: Math.sin(k * Math.PI) * 0.7 });
    }
  }
  ctx.restore();
  drawParticles(ctx, M.parts);
}
const nudge = (a, b, pad) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return [a[0] + (dx / len) * pad, a[1] + (dy / len) * pad, b[0] - (dx / len) * pad, b[1] - (dy / len) * pad];
};

// One generic button painter for every play-screen control (bar, column, header). Narrow rects show the icon alone, wide short ones
// put icon and label side by side, the rest stack icon over label (the approved phone bar).
function drawTools(ctx, S, M, P) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], auto = S.auto;
  const lesson = Boolean(M.lesson);
  const defs = {
    back: { icon: 'back', label: tr('back'), kind: 'normal' },
    menu: { icon: 'back', label: tr('quitMenu').replace('Main ', ''), kind: 'normal' },
    exit: { icon: 'back', label: tr('autoExit'), kind: 'normal' },
    pause: { icon: 'pause', label: tr('autoPause'), kind: 'normal' },
    undo: { icon: 'undo', label: tr('undo'), off: M.over || lesson || !S.canUndo, kind: 'normal' },
    think: { icon: 'hint', label: tr('think'), off: M.over || !humanTurn(M) || S.hintBusy, kind: 'primary' },
    threats: { icon: 'eye', label: tr('threats'), off: Boolean(M.over), kind: S.threats ? 'on' : 'normal' },
    slower: { icon: 'minus', label: tr('autoSlower'), off: S.thinkIdx === 0, kind: 'normal' },
    faster: { icon: 'plus', label: tr('autoFaster'), off: S.thinkIdx === THINK_STEPS.length - 1, kind: 'normal' },
    apause: { icon: auto && auto.paused ? 'play' : 'pause', label: auto && auto.paused ? tr('autoPlay') : tr('autoPause'), kind: 'primary' },
  };
  for (const { id, rect: r } of P.buttons) {
    const d = defs[id];
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, th, r, [], d.kind, { disabled: d.off, pressed, radius: r.w < 110 ? 18 : 22 });
    const yy = r.y + (pressed ? 2 : 0), ink = d.kind === 'primary' ? th.primaryInk : th.ink;
    ctx.save();
    if (d.off) ctx.globalAlpha = 0.4;
    if (r.w < 110) icon(ctx, d.icon, r.x + r.w / 2, yy + r.h / 2, 34, ink);
    else if (r.w > r.h * 1.6) {
      const is = Math.min(44 * (1 + (z - 1) * 0.3), r.h - 24), ls = fitOne(d.label, r.w - is - 56, 28 * (1 + (z - 1) * 0.5), 20);
      const tw2 = tw(d.label, ls), tot = is + 14 + tw2, x0 = r.x + (r.w - tot) / 2;
      icon(ctx, d.icon, x0 + is / 2, yy + r.h / 2, is, ink);
      text(ctx, d.label, x0 + is + 14, yy + r.h / 2 + ls * 0.35, ls, ink, { weight: 800, align: 'left' });
    } else {
      const is = Math.min(44 * (1 + (z - 1) * 0.35), r.h * 0.42);
      const ls = fitOne(d.label, r.w - 16, Math.min(24 * (1 + (z - 1) * 0.6), r.h * 0.3), 18);
      const total = is + ls + 10;
      icon(ctx, d.icon, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
      text(ctx, d.label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
    }
    ctx.restore();
  }
}

const sideLabel = (M, who) => {
  if (M.auto) return `${sideName(who)} · ${LEVELS.find((l) => l.id === M.autoLv[who - 1])?.name ?? ''}`;
  if (M.two) return sideName(who);
  if (M.lesson && M.lesson.type !== 'game') return who === M.human ? `${sideName(who)} (${tr('youWord')})` : sideName(who);
  return who === M.human ? `${sideName(who)} (${tr('youWord')})` : `${sideName(who)} · ${LEVELS.find((l) => l.id === M.level)?.name ?? ''}`;
};

export function playGeo(S, M) {
  const lay = (S.L ?? layoutFor()).play(TEXT_SCALES[S.textIdx], Boolean(M.auto));
  const flip = !M.two && !M.auto && M.human === 2;
  return { lay, geo: boardGeo(lay.board.x, lay.board.y, lay.board.side, flip) };
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  const auto = S.scene === 'auto' ? S.auto : null;
  const { lay, geo } = playGeo(S, M);
  background(ctx, th, S.t, geo.y + geo.side / 2, S.L.w, S.L.h, geo.x + geo.side / 2);
  const title = M.lesson ? M.lesson.title : 'Surakarta';
  const quiet = `${tr('quiet')} ${M.st.quiet}/${QUIET_LIMIT}`;
  const sub = M.lesson ? `Lesson ${S.lessonIdx + 1} of ${LESSONS.length}` : auto ? `${tr('autoSession')} · ${tr('think')} ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}` : `${M.two ? tr('twoPlayers') : `${tr('vsComputer')} · ${LEVELS.find((l) => l.id === M.level)?.name}`} · ${quiet}`;
  drawHud(ctx, S, lay, title, sub);
  const st = M.st;
  const toMove = M.over ? 0 : st.turn;
  const plateSub = (who) => {
    const n = countOf(st.cells, who);
    const cnt = `${n} ${n === 1 ? 'piece' : 'pieces'}`;
    if (M.over) return M.over.winner === who ? `Winner · ${cnt}` : M.over.winner === 0 ? `Draw · ${cnt}` : cnt;
    if (toMove === who) return M.thinking && !M.two && !M.lesson && who !== M.human ? `thinking · ${cnt}` : `to move · ${cnt}`;
    return cnt;
  };
  drawPlate(ctx, S, lay.chips[0], 1, sideLabel(M, 1), plateSub(1), toMove === 1);
  drawPlate(ctx, S, lay.chips[1], 2, sideLabel(M, 2), plateSub(2), toMove === 2);
  drawBoardScene(ctx, S, M, geo, auto);
  let head = '', body = '', col = null;
  if (M.over) {
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo && !(M.lesson && M.lesson.type === 'game') ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = tr('paused');
    else if (auto.phase === 'think') { head = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`; body = `${sideName(st.turn)} to move`; }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = 'Surakarta';
  } else if (S.toast) head = S.toast;
  else if (M.anim) head = M.anim.cap ? `${sideName(M.anim.who)} captures a piece` : `${sideName(M.anim.who)} steps`;
  else if (M.msg) { head = M.msg; col = '#ffb3a6'; }
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (S.hintBusy) head = tr('thinking');
  else if (M.lesson && M.lesson.type !== 'game') head = M.lesson.task;
  else if (M.thinking) head = tr('thinking');
  else if (humanTurn(M)) {
    head = M.two ? (st.turn === 1 ? tr('lightTurn') : tr('darkTurn')) : tr('yourMove');
    body = M.sel >= 0 ? 'Tap a free neighbouring point to step, or the end of a glowing trail to capture.' : 'Tap one of your pieces.';
    if (S.threats) body = tr('threatKey');
  } else if (M.lesson) head = M.lesson.task;
  drawStatus(ctx, S, lay.status, head, body, col);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 16, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  drawTools(ctx, S, M, lay);
  void z;
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  S.L = layoutFor(S.vw, S.vh);
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'learn': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, theme(S), S.t, 700, S.L.w, S.L.h);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { background(ctx, theme(S), S.t, 700, S.L.w, S.L.h); break; }
      drawPlay(ctx, S);
      break;
    default: background(ctx, theme(S), S.t, 700, S.L.w, S.L.h);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { H, W, colOf, rowOf };
