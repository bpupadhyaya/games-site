// Everything drawn each frame. Reads state, changes nothing.
import {
  W, H, setSize, DISPLAY, THEMES, themeById, PALETTE, GLASS, text, rr, panel, button, background, icon, drawParticles, drawLion, drawMarble, drawStick,
  drawBoard, fillCell, drawMiniTrack, arrow, alpha, clamp01, ease, backOut, smooth, light,
} from './art.js';
import { TEXT_SCALES, wrap, tw, clampScroll } from './ui.js';
import { TRACK, HEAD, isSafe, isHome, isBack, cellOf, LENGTHS, VALUE_P, THROW_VALUES } from './rules.js';
import { tr, getRules, lvName, lenName, themeName, seatColor, lionsText } from './content.js';
import { SCREEN, host, playFrame, titleFrame } from './layout.js';
import { drawLockup } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { trackGeo, pathBetween, CELL_PTS } from './geo.js';
import { actionsNow, allActions, humanTurn, STICK_T, STEP_T } from './match.js';
import { STICKS } from './rules.js';

const theme = (S) => themeById(S.themeId);

const floor = (min) => Math.max(min, Math.ceil(11 / Math.max(0.3, host.px)));
export function fitText(str, w, h, start, min = 18, lh = 1.28) {
  min = floor(min);
  let size = Math.max(start, min);
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 16) => { min = floor(min); let s = Math.max(start, min); while (s > min && tw(str, s) > w) s -= 1; return s; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  scroll = clampScroll(scroll, layout.height, region.h);
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
        text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, b.dim ? 'rgba(246,236,214,0.5)' : 'rgba(250,240,222,0.94)', { weight: 500, align: center ? 'center' : 'left' });
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
    ctx.fillStyle = alpha(th.accent.length === 7 ? th.accent : '#f1c45a', 0.75);
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

// ----------------------------------------------------------------------------------- illustrations
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.84)', maxW = 0) => { let s = size; if (maxW) while (s > 11 && tw(str, s) > maxW) s -= 1; text(ctx, str, x, y, s, col, { weight: 600 }); };

// the sticks, drawn flat in a row; flats[i] true = the flat face shows
function stickRow(ctx, x, y, w, h, flats) {
  const n = flats.length, len = Math.min(h * 0.92, w / n * 3.4), wid = Math.min(len * 0.2, w / n * 0.62);
  flats.forEach((f, i) => drawStick(ctx, x + w * (i + 0.5) / n, y + h / 2, len, wid, Math.PI / 2 + (i % 2 ? 0.05 : -0.04), f));
}

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,4,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const mt = (side, o) => drawMiniTrack(ctx, th, cx - side / 2, y + 12, side, o);
  const one = (extra = 40) => Math.min(h - extra, w - 40, 380);
  const single = (o, caption, tone, extra = 52) => { mt(one(extra), o); cap(ctx, caption, cx, y + h - 18, 20, tone ?? 'rgba(246,236,214,0.84)', w - 30); };
  if (name === 'logo') {
    const s = Math.min(h - 24, 280);
    mt(s, { lions: [[3, 0, -1], [11, 1, -1], [20, 2, -1]] });
  } else if (name === 'goal' || name === 'board') {
    single({ numbers: true, arrows: [[1, 29]], lions: [[1, 0, -1]] }, name === 'goal' ? 'Tail (1) to the head (30)' : 'Resting stones: 5, 10, 15, 20, 25', th.accent);
  } else if (name === 'sticks') {
    const rows = 4, ex = [[true, true, false, false], [true, false, false, false], [false, false, false, false]];
    const labels = ['2', '1', '5'];
    const cw = (w - 40) / 3;
    ex.forEach((fl, i) => { stickRow(ctx, x + 20 + i * cw, y + 18, cw - 10, h - 90, fl); text(ctx, labels[i], x + 20 + i * cw + (cw - 10) / 2, y + h - 40, 36, th.accent, { font: DISPLAY, weight: 800 }); });
    cap(ctx, 'Flat sides up = steps; none up = 5', cx, y + h - 14, 20, undefined, w - 30);
  } else if (name === 'move') {
    single({ lions: [[4, 0, -1], [9, 1, -1]], arrows: [[4, 7]], hl: [7] }, 'Move forward by the throw', undefined);
  } else if (name === 'nudge') {
    const vals = [['2', 'One less'], ['3', 'Throw'], ['4', 'One more']];
    const cw = (w - 40) / 3;
    vals.forEach(([v, l], i) => {
      const px = x + 20 + cw * (i + 0.5), py = y + h * 0.4;
      ctx.fillStyle = i === 1 ? th.btn[0] : th.btnOn[0]; rr(ctx, px - cw * 0.4, py - h * 0.26, cw * 0.8, h * 0.52, 16); ctx.fill();
      text(ctx, v, px, py + 18, 58, th.ink, { font: DISPLAY, weight: 800 });
      if (i !== 1) drawMarble(ctx, px, py - h * 0.18, 16, GLASS, { shadow: false });
      cap(ctx, l, px, y + h - 22, 20, undefined, cw - 6);
    });
  } else if (name === 'rest') {
    single({ hl: [5, 10, 15, 20, 25], lions: [[10, 0, -1], [13, 1, -1]] }, tr('cRest'), th.accent);
  } else if (name === 'capture') {
    single({ lions: [[16, 0, -1], [18, 1, -1]], arrows: [[16, 18]], hl: [18] }, 'Land on a rival: back to the tail, and a marble is yours', undefined);
  } else if (name === 'head') {
    single({ lions: [[27, 0, -1]], arrows: [[27, 30]], hl: [30] }, 'The head needs an exact count', th.accent);
  } else if (name === 'full') {
    single({ lions: [[24, 0, -1]], arrows: [[24, 30]], dots: [20, 14] }, 'Long race: to the head, then back out', undefined);
  } else if (name === 'win') {
    mt(Math.min(h - 70, 280), { hl: [30], lions: [[29, 0, -1]] });
    cap(ctx, 'All your lions home: you win', cx, y + h - 20, 22, th.accent, w - 30);
  } else if (name === 'recon') {
    single({ numbers: true }, 'A coiled track, lions, marbles: rules rebuilt', th.accent);
  } else if (name === 'seats') {
    const n = 6, cw = (w - 30) / n;
    PALETTE.forEach((p, i) => { drawLion(ctx, x + 15 + cw * (i + 0.5), cy, Math.min(cw * 0.95, h * 0.5), p, { face: 1 }); cap(ctx, seatColor(i), x + 15 + cw * (i + 0.5), y + h - 22, Math.min(18, cw / 5), undefined, cw); });
  } else if (name === 'think') {
    const s = Math.min(h - 80, 240);
    mt(s, { lions: [[8, 0, -1]], hl: [11], arrows: [[8, 11]] });
    ctx.fillStyle = 'rgba(8,8,12,0.8)'; rr(ctx, x + 30, y + h - 62, w - 60, 44, 22); ctx.fill();
    cap(ctx, 'Think: land on the resting stone (11 is not; try 10)', cx, y + h - 33, 20, th.accent, w - 80);
  } else if (name === 'sound') {
    icon(ctx, 'plus', cx - 100, cy, 56, th.accent); text(ctx, 'A+', cx - 100, cy + 72, 30, th.ink, { weight: 800 });
    text(ctx, '300%', cx + 100, cy + 14, 56, th.accent, { font: DISPLAY, weight: 800 });
  } else if (name === 'setup') {
    const n = Math.min(6, S.setup.n), cw = (w - 40) / 6;
    for (let i = 0; i < n; i++) {
      const px = cx - (n * cw) / 2 + cw * (i + 0.5);
      drawLion(ctx, px, cy - 6, Math.min(cw * 0.95, h * 0.48), PALETTE[i], { face: 1, glow: S.setup.seats[i] ? 0 : 0.35 });
      cap(ctx, S.setup.seats[i] ? 'CPU' : (i === 0 ? 'You' : 'P' + (i + 1)), px, y + h - 16, 17, undefined, cw);
    }
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    const ss = Math.min(150, h * 0.95);
    if (e.winner >= 0) drawLion(ctx, cx, cy + 6, ss, PALETTE[e.winner % 6], { scale: k, glow: 0.5 + 0.4 * Math.sin(S.ovT * 4), face: 1 });
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------------------- title
const ATTRACT_LIONS = [
  { pal: 0, start: 2, speed: 0.9 }, { pal: 1, start: 9, speed: 0.75 }, { pal: 3, start: 17, speed: 0.6 }, { pal: 2, start: 24, speed: 0.5 },
];
const faceAt = (g, cell, back) => { const p = g.cells[Math.max(1, Math.min(TRACK, cell))]; const dx = Math.cos(p.ang) * (back ? -1 : 1); return dx >= 0 ? 1 : -1; };
const cellPos = (g, c) => g.cells[Math.max(0, Math.min(TRACK, c))];
function posAlong(g, a, b, k) {
  const path = pathBetween(g, a, b, 5);
  const f = clamp01(k) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), r = f - i;
  return { x: path[i].x + (path[i + 1].x - path[i].x) * r, y: path[i].y + (path[i + 1].y - path[i].y) * r, ang: path[i].ang };
}

function drawAttract(ctx, S, A) {
  const th = theme(S), t = S.t;
  const side = 440, bx = (720 - side) / 2, by = 300;
  const g = trackGeo(bx, by, side);
  ctx.save();
  ctx.translate(A.x, A.y); ctx.scale(A.s, A.s);
  const glow = ctx.createRadialGradient(360, by + side / 2, 30, 360, by + side / 2, 380);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, by - 140, 720, side + 300);
  drawBoard(ctx, th, g, S.baked, t);
  // lions pace round the snake, one cell at a time, with a hop between
  const items = [];
  for (const L of ATTRACT_LIONS) {
    const cyc = 22, step = (t * L.speed) % cyc, base = Math.floor(step), k = ease(clamp01((step - base) * 1.6));
    const c0 = ((L.start + base) % 27) + 1, c1 = (c0 % 27) + 1;
    if (c1 < c0) { const p = cellPos(g, c1); items.push({ y: p.y, L, p, hop: 0, face: Math.cos(p.ang) >= 0 ? 1 : -1 }); continue; }
    const p = posAlong(g, c0, c1, k);
    items.push({ y: p.y, L, p, hop: Math.sin(Math.min(1, (step - base) * 1.6) * Math.PI), face: Math.cos(p.ang) >= 0 ? 1 : -1 });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) drawLion(ctx, it.p.x, it.p.y + g.cellW * 0.06, g.cellW * 1.2, PALETTE[it.L.pal], { face: it.face, lift: it.hop * 0.7 });
  // a marble rolls from the tail to the head
  const mk = (t % 5.2) / 3.6;
  if (mk < 1) { const p = posAlong(g, 0, TRACK, ease(mk)); drawMarble(ctx, p.x, p.y, g.cellW * 0.2, GLASS, { rot: mk * 40 }); }
  // title
  const gr = ctx.createLinearGradient(0, 70, 0, 200);
  gr.addColorStop(0, light(th.accent, 0.55)); gr.addColorStop(0.5, th.accent); gr.addColorStop(1, '#9a7428');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 126px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = gr;
  ctx.fillText('MEHEN', 360, 168);
  ctx.restore();
  ctx.strokeStyle = alpha(th.accent.length === 7 ? th.accent : '#f1c45a', 0.5); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(150, 196); ctx.lineTo(570, 196); ctx.stroke();
  ctx.fillStyle = alpha(th.accent.length === 7 ? th.accent : '#f1c45a', 0.9); ctx.beginPath(); ctx.moveTo(360, 188); ctx.lineTo(368, 196); ctx.lineTo(360, 204); ctx.lineTo(352, 196); ctx.closePath(); ctx.fill();
  text(ctx, tr('tagline'), 360, 242, 32, 'rgba(250,238,214,0.9)', { weight: 600, font: DISPLAY });
  text(ctx, tr('taglineSub'), 360, 276, 24, 'rgba(250,238,214,0.62)', { weight: 500 });
  ctx.restore();
}

function drawTitle(ctx, S, ui) {
  const T = ui.title ?? titleFrame(S.w, S.h);
  background(ctx, theme(S), S.t, T.art.y + 520 * T.art.s, true, T.art.x + 360 * T.art.s);
  drawAttract(ctx, S, T.art);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  drawLockup(ctx, T.lock, 0.9, Boolean(S.press && S.press.id === 'af:home' && S.press.active));
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,2,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  const cx = ui.panel.x + ui.panel.w / 2, cy = ui.panel.y + ui.panel.h / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-cx, -cy);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
const nameOf = (M, i) => {
  const c = seatColor(i);
  if (M.auto || M.humans > 1) return M.seats[i].ai ? c : `${c}`;
  return M.seats[i].ai ? c : tr('you');
};
export const seatName = nameOf;

function drawHud(ctx, S, L, title, sub, showPause) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], tb = L.titleBox, cx = tb.x + tb.w / 2;
  if (L.mode === 'stack' && showPause) {
    button(ctx, th, L.pause, [], 'normal', { pressed: S.press && S.press.id === 'tool:pause' && S.press.active });
    icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2, 34, th.ink);
  }
  const tSize = fitOne(title, tb.w, (L.mode === 'stack' ? 42 : 34) * (1 + (z - 1) * 0.25), 20);
  text(ctx, title, cx, tb.y + tb.h * 0.5 + tSize * 0.33, tSize, th.accent, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  // the second line (seats and length) shares its place with the free-preview pill, so it shows only once the game is owned
  if (sub && !S.previewPill) {
    const sSize = fitOne(sub, tb.w, 22, 15);
    text(ctx, sub, cx, tb.y + tb.h + 24, sSize, 'rgba(250,238,214,0.7)', { weight: 500 });
  }
}

function drawPlate(ctx, S, M, r, i) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], pal = PALETTE[i % 6];
  const st = M.st, active = !M.over && st.turn === i, won = M.over && M.over.winner === i;
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,3,0.58)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = active || won ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = active || won ? 3 : 1.5;
  if (active || won) { ctx.shadowColor = alpha(th.accent.length === 7 ? th.accent : '#f1c45a', 0.7); ctx.shadowBlur = 14; }
  rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  ctx.restore();
  // a coloured stripe on the left edge
  ctx.fillStyle = pal.base; rr(ctx, r.x + 6, r.y + 10, 5, r.h - 20, 3); ctx.fill();
  const narrow = r.w < 250;
  const ls = Math.min(r.h * (narrow ? 0.74 : 0.86), r.w * (narrow ? 0.3 : 0.36));
  const lionX = r.x + 16 + ls * 0.5;
  drawLion(ctx, lionX, r.y + r.h / 2 + ls * 0.04, ls, pal, { face: 1, glow: active ? 0.5 + 0.3 * Math.sin(S.t * 5) : won ? 0.7 : 0, shadow: false });
  const tx = r.x + 20 + ls, avail = r.x + r.w - tx - 10;
  const lions = st.lions[i];
  const nShow = lions.length;
  const ns = fitOne(nameOf(M, i), avail, Math.min(26 * (1 + (z - 1) * 0.5), r.h * 0.34), 14);
  const y1 = r.y + r.h * 0.13 + ns * 0.85;
  text(ctx, nameOf(M, i), tx, y1, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  const ms = Math.max(6, Math.min(11, r.h * 0.13));
  const y2 = r.y + r.h - ms - r.h * 0.11;
  // lions: small discs at the right end of the second line (waiting hollow, on the board filled, home gold)
  const dsz = Math.max(5, Math.min(9, r.h * 0.11)), dstep = dsz * 2.6;
  lions.forEach((c, k) => {
    const px = r.x + r.w - 12 - dsz - (nShow - 1 - k) * dstep, py = y2;
    ctx.beginPath(); ctx.arc(px, py, dsz, 0, Math.PI * 2);
    if (isHome(c)) { ctx.fillStyle = '#f3c85a'; ctx.fill(); ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 2; ctx.stroke(); }
    else if (c === 0) { ctx.strokeStyle = pal.base; ctx.lineWidth = 2.5; ctx.stroke(); }
    else { ctx.fillStyle = pal.base; ctx.fill(); ctx.strokeStyle = pal.hi; ctx.lineWidth = 1.5; ctx.stroke(); }
  });
  // marbles: as many as fit before the lion discs, then "+n"
  const n = st.marbles[i];
  const room = Math.max(1, Math.floor((r.x + r.w - 12 - nShow * dstep - tx) / (ms * 1.7)));
  const shown = Math.min(n, Math.max(1, room > 1 && n > room ? room - 1 : room)), step = ms * 1.7;
  for (let k = 0; k < shown; k++) drawMarble(ctx, tx + ms + k * step, y2, ms, GLASS, { shadow: false });
  if (n > shown) text(ctx, `+${n - shown}`, tx + ms + shown * step - ms * 0.4, y2 + ms * 0.42, Math.max(12, ms * 1.4), th.ink, { weight: 700, align: 'left' });
  if (n === 0) text(ctx, '0', tx + ms * 0.2, y2 + ms * 0.42, Math.max(12, ms * 1.5), 'rgba(246,236,214,0.5)', { weight: 700, align: 'left' });
  if (M.thinking && active && !M.auto) {
    const dots = Math.floor(S.t * 3) % 4;
    text(ctx, '.'.repeat(dots), r.x + r.w - 18, r.y + 18 + ns * 0.4, 22, th.accent, { align: 'right', weight: 800 });
  }
}

// positions of the lions on plates (for marbles flying between seats): the plate's marble corner
const plateMarblePt = (lay, i) => { const r = lay.plates[i]; return { x: r.x + r.w * 0.5, y: r.y + r.h * 0.62 }; };

function drawStatusCard(ctx, S, r) {
  const th = theme(S);
  ctx.save();
  ctx.fillStyle = 'rgba(10,6,3,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill();
  ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 22); ctx.stroke();
  ctx.restore();
}

// the tray of four sticks, tumbling while M.sticks.t < STICK_T, then resting with the value beside them
function drawSticks(ctx, S, M, r) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  ctx.save();
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, 'rgba(60,40,24,0.9)'); g.addColorStop(1, 'rgba(30,18,10,0.95)');
  ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = alpha(th.accent.length === 7 ? th.accent : '#f1c45a', 0.35); ctx.lineWidth = 2; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip();
  const showNum = r.w > 260 && r.h > 70;
  const numW = showNum ? Math.min(r.w * 0.28, 90) : 0;
  const area = { x: r.x + 10, y: r.y + 6, w: r.w - 20 - numW, h: r.h - 12 };
  const len = Math.min(area.h * 0.86, area.w / STICKS * 3.2), wid = Math.min(len * 0.22, area.w / STICKS * 0.62);
  const sk = M.sticks;
  ctx.globalAlpha = sk && M.phase === 'throw' ? 0.5 : 1;
  for (let i = 0; i < STICKS; i++) {
    const px = area.x + area.w * (i + 0.5) / STICKS;
    const flat = sk ? sk.flats[i] : i % 2 === 0;
    if (sk && sk.t < STICK_T) {
      const k = clamp01(sk.t / STICK_T), air = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      const bounce = k > 0.8 ? Math.abs(Math.sin((k - 0.8) * 5 * Math.PI)) * (1 - k) * 1.4 : 0;
      const ang = Math.PI / 2 + sk.ang[i] + sk.spin[i] * (1 - ease(k)) * 1;
      const showFlat = k > 0.82 ? flat : Math.sin(sk.t * 22 + i * 1.7) > 0;
      drawStick(ctx, px + sk.x[i] * 4 * (1 - k), area.y + area.h / 2 + sk.dy[i] * area.h * 0.2 - 0, len, wid, ang, showFlat, { lift: air * 0.9 + bounce * 0.3 });
    } else drawStick(ctx, px, area.y + area.h / 2 + (sk ? sk.dy[i] * area.h * 0.15 : 0), len, wid, Math.PI / 2 + (sk ? sk.ang[i] * 0.6 : (i % 2 ? 0.05 : -0.05)), flat);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (showNum && M.value && (!M.sticks || M.sticks.t >= STICK_T)) {
    const adj = M.adj;
    const col = adj ? th.accent : th.ink;
    const big = Math.min(r.h * 0.6, 72 * (1 + (z - 1) * 0.2));
    const nx = r.x + r.w - numW / 2 - 4, ny = r.y + r.h / 2 + big * 0.34;
    const k = backOut(clamp01((M.sticks ? M.sticks.t - STICK_T : 1) / 0.35 + 0.1));
    ctx.save(); ctx.translate(nx, ny); ctx.scale(k, k); ctx.translate(-nx, -ny);
    text(ctx, String(M.value + adj), nx, ny, big, col, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
    if (adj) text(ctx, `(${M.value}${adj > 0 ? '+1' : '-1'})`, nx, ny + big * 0.38, Math.max(14, big * 0.28), 'rgba(246,236,214,0.7)', { weight: 600 });
    ctx.restore();
  }
}

const pulse = (S, rate = 5) => 0.5 + 0.5 * Math.sin(S.t * rate);

// Board scene: the carved board, highlights, lions, marbles, particles.
function drawBoardScene(ctx, S, M, g, lay, auto) {
  const th = theme(S), st = M.st, acc = th.accent.length === 7 ? th.accent : '#f1c45a';
  const t = S.t, pl = pulse(S);
  drawBoard(ctx, th, g, S.baked, t);
  const p = st.turn;
  // last move trail
  if (M.lastMove && !M.lastMove.pass && !M.over && M.lastMove.to != null) {
    const lm = M.lastMove, a = cellOf(lm.from), b = isHome(lm.to) ? (st.mode === 'full' ? 0 : HEAD) : cellOf(lm.to);
    if (b >= 1) fillCell(ctx, g, b, 0.98, alpha(acc, 0.1 + 0.06 * pl), null);
    if (a >= 1) fillCell(ctx, g, a, 0.98, alpha(acc, 0.06), null);
  }
  // choices: the lit stones and the lions that can go
  const choosing = M.phase === 'choose' && ((humanTurn(M) && !auto) || (auto && auto.phase === 'reveal'));
  const acts = choosing ? (auto ? allActions(M).filter((a) => a.adj === 0 || (auto.plan && auto.plan.act && a.adj === auto.plan.act.adj)) : actionsNow(M)) : [];
  const chosen = auto && auto.phase === 'reveal' && auto.plan ? auto.plan.act : M.hint ? M.hint.act : null;
  const selAct = !auto && M.sel >= 0 ? acts.find((a) => a.i === M.sel) : null;
  const movingLions = new Set();
  if (M.anim) movingLions.add(`${M.anim.p}:${M.anim.i}`);
  const destCell = (a) => (isHome(a.to) ? (st.mode === 'full' ? 0 : HEAD) : cellOf(a.to));
  for (const a of acts) {
    const dc = destCell(a);
    if (dc < 1) continue;
    const isSel = selAct === a, isChosen = chosen && chosen.i === a.i && chosen.adj === a.adj && chosen.from === a.from;
    const col = a.kind === 'capture' ? '#ff7a5c' : a.kind === 'safe' || a.kind === 'head' || a.kind === 'home' ? '#ffe08a' : acc;
    fillCell(ctx, g, dc, 0.98, alpha(col.length === 7 ? col : acc, (isSel || isChosen ? 0.34 : 0.15) + 0.1 * pl), col, isSel || isChosen ? 4 : 2.5);
    if (isChosen && auto) fillCell(ctx, g, dc, 1.1, null, alpha(col, 0.5 + 0.5 * pl), 4);
  }
  if (selAct || (chosen && !auto) || (auto && chosen)) {
    const a = selAct ?? chosen;
    const dc = destCell(a), sc = cellOf(a.from);
    const path = pathBetween(g, sc, dc >= 1 ? dc : 0, 6);
    ctx.save(); ctx.strokeStyle = alpha(acc, 0.8); ctx.lineWidth = Math.max(3, g.side * 0.008); ctx.setLineDash([g.side * 0.018, g.side * 0.014]); ctx.lineCap = 'round';
    ctx.lineDashOffset = -S.t * 40;
    ctx.beginPath(); path.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.restore();
    if (dc >= 1) {
      const q = g.cells[dc];
      drawLion(ctx, q.x, q.y + g.cellW * 0.06, g.cellW * 1.2, PALETTE[p % 6], { face: faceAt(g, dc, false), alpha: 0.42 + 0.2 * pl, shadow: false });
    }
  }
  // ring on the lions that could move
  const draw = [];
  for (let q = 0; q < st.n; q++) {
    const lions = st.lions[q];
    const headIdx = [];
    lions.forEach((c, i) => {
      if (movingLions.has(`${q}:${i}`)) return;
      if (c === 0) return;
      if (isHome(c) && st.mode === 'full') return;
      if (isHome(c) || cellOf(c) === HEAD) { headIdx.push(i); return; }
      const pt = g.cells[cellOf(c)];
      draw.push({ y: pt.y, q, i, x: pt.x, py: pt.y, cell: cellOf(c), back: isBack(c) });
    });
    headIdx.forEach((i, k) => {
      const n = headIdx.length, a = (k / Math.max(1, n)) * Math.PI * 2 + (q * 0.9) - Math.PI / 2, rr0 = n > 1 ? g.head.r * 0.34 : 0;
      draw.push({ y: g.head.y + Math.sin(a) * rr0, q, i, x: g.head.x + Math.cos(a) * rr0, py: g.head.y + Math.sin(a) * rr0, cell: HEAD, head: true });
    });
  }
  // the lion in motion
  if (M.anim) {
    const a = M.anim, steps = Math.max(1, Math.abs(a.toCell - a.fromCell));
    const k = clamp01(a.t / a.dur), e = smooth(k);
    const fc = a.fromCell, tc = a.toCell;
    const path = pathBetween(g, fc, tc, 6);
    const f = e * (path.length - 1), i0 = Math.min(path.length - 2, Math.floor(f)), r0 = f - i0;
    const pa = path[i0], pb = path[i0 + 1];
    const mx = pa.x + (pb.x - pa.x) * r0, my = pa.y + (pb.y - pa.y) * r0;
    const hop = a.t < 0 || a.t > a.dur ? 0 : Math.abs(Math.sin(e * steps * Math.PI));
    const face = pb.x < pa.x - 0.01 ? -1 : pb.x > pa.x + 0.01 ? 1 : -1;
    draw.push({ y: my + 1000, q: a.p, i: a.i, x: mx, py: my, cell: -1, hop, face, moving: true });
  }
  draw.sort((u, v) => u.y - v.y);
  const lionS = g.cellW * 1.2;
  const canMove = new Set(acts.map((a) => `${p}:${a.i}`));
  const penHint = acts.find((a) => a.from === 0);
  for (const d of draw) {
    const pal = PALETTE[d.q % 6];
    const sel = !auto && d.q === p && M.sel === d.i && !d.moving;
    const isChosenLion = chosen && d.q === p && chosen.i === d.i && !d.moving;
    const movable = canMove.has(`${d.q}:${d.i}`) && !d.moving;
    const small = d.head ? 0.62 : 1;
    const o = { face: d.face ?? faceAt(g, d.cell, d.back), lift: d.moving ? d.hop * 0.8 : sel ? 0.6 : 0, glow: sel ? 0.8 : isChosenLion ? 0.6 + 0.4 * pl : movable ? 0.25 + 0.2 * pl : (M.over && M.over.winner === d.q ? 0.5 + 0.3 * Math.sin(M.winT * 6) : 0), scale: small };
    if (M.over && M.over.winner !== d.q) o.dim = true;
    drawLion(ctx, d.x, d.py + g.cellW * 0.06, lionS, pal, o);
  }
  // captured lions (still standing until the mover arrives, then shrinking away)
  for (const gh of M.ghosts) {
    const q = g.cells[Math.max(1, gh.cell)], pal = PALETTE[gh.p % 6];
    if (gh.t < gh.delay) { drawLion(ctx, q.x, q.y + g.cellW * 0.06, lionS, pal, { face: faceAt(g, gh.cell, false), lift: 0 }); continue; }
    const k = clamp01((gh.t - gh.delay) / gh.dur);
    drawLion(ctx, q.x, q.y + g.cellW * 0.06, lionS, pal, { face: faceAt(g, gh.cell, false), alpha: 1 - k, scale: 1 - 0.35 * k, lift: k * 1.2, shadow: false });
  }
  void penHint;
  // marbles rolling
  for (const m of M.marbles) {
    if (m.t < 0) continue;
    const k = clamp01(m.t / m.dur);
    if (m.kind === 'spend') {
      const src = lay && lay.plates ? plateMarblePt(lay, m.p) : null;
      // from the seat's plate to the tail, then down the snake to the head
      const kk = smooth(k);
      let x, y, rot;
      if (kk < 0.18) { const a = kk / 0.18; x = src.x + (g.cells[0].x - src.x) * a; y = src.y + (g.cells[0].y - src.y) * a - Math.sin(a * Math.PI) * 30; rot = a * 6; }
      else { const a = (kk - 0.18) / 0.82; const q = posAlong(g, 0, TRACK, a); x = q.x; y = q.y; rot = a * 60; }
      drawMarble(ctx, x, y, g.cellW * 0.2, GLASS, { rot, alpha: 1 - (kk > 0.95 ? (kk - 0.95) * 20 : 0) });
    } else if (m.kind === 'steal' && lay && lay.plates) {
      const a = plateMarblePt(lay, m.from), b = plateMarblePt(lay, m.to), kk = smooth(k);
      drawMarble(ctx, a.x + (b.x - a.x) * kk, a.y + (b.y - a.y) * kk - Math.sin(kk * Math.PI) * 50, g.cellW * 0.2, GLASS, { rot: kk * 10 });
    } else if (m.kind === 'gain' && lay && lay.plates) {
      const b = plateMarblePt(lay, m.p), kk = smooth(k);
      drawMarble(ctx, g.head.x + (b.x - g.head.x) * kk, g.head.y + (b.y - g.head.y) * kk - Math.sin(kk * Math.PI) * 50, g.cellW * 0.2, GLASS, { rot: kk * 10 });
    }
  }
  // auto "think" scan
  if (auto && auto.phase === 'think' && auto.scan != null) {
    const c = auto.scan; if (c >= 1) fillCell(ctx, g, c, 1.05, null, 'rgba(255,255,255,0.7)', 3);
  }
  drawParticles(ctx, M.parts);
}

function toolButton(ctx, S, r, ic, label, { off = false, kind = 'normal', pressed = false, sub = '', icColor = null } = {}) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  button(ctx, th, r, [], kind, { disabled: off, pressed, radius: 22 });
  const yy = r.y + (pressed ? 2 : 0), ink = icColor ?? (kind === 'primary' ? th.primaryInk : th.ink);
  ctx.save();
  if (off) ctx.globalAlpha = 0.4;
  const horiz = r.h < 100 || r.w > r.h * 1.6 || r.w < 150;
  const hasSub = Boolean(sub);
  const is = horiz ? Math.min(36 * (1 + (z - 1) * 0.35), r.h * 0.46, r.w * 0.26) : 44 * (1 + (z - 1) * 0.35);
  if (horiz) {
    const ls = fitOne(label, Math.max(40, r.w - is - 40), (kind === 'primary' ? 28 : 24) * (1 + (z - 1) * 0.5), 15);
    const total = is + 10 + tw(label, ls), x0 = r.x + (r.w - total) / 2;
    if (ic) icon(ctx, ic, x0 + is / 2, yy + r.h / 2 - (hasSub ? ls * 0.2 : 0), is, ink);
    text(ctx, label, x0 + is + 10, yy + r.h / 2 + ls * 0.34 - (hasSub ? ls * 0.2 : 0), ls, ink, { weight: 800, align: 'left' });
    if (hasSub) text(ctx, sub, r.x + r.w / 2, yy + r.h - 9, Math.max(12, ls * 0.62), kind === 'primary' ? alpha(th.primaryInk, 0.78) : 'rgba(246,236,214,0.7)', { weight: 600 });
  } else {
    const ls = fitOne(label, r.w - 20, 24 * (1 + (z - 1) * 0.6), 15), total = is + ls + 10;
    if (ic) icon(ctx, ic, r.x + r.w / 2, yy + (r.h - total) / 2 + is / 2, is, ink);
    text(ctx, label, r.x + r.w / 2, yy + (r.h - total) / 2 + is + 10 + ls * 0.85, ls, ink, { weight: 700 });
  }
  ctx.restore();
}

function drawTools(ctx, S, M, lay) {
  const pr = (id) => S.press && S.press.id === `tool:${id}` && S.press.active;
  const st = M.st, p = st.turn;
  const mine = humanTurn(M);
  const choose = M.phase === 'choose' && mine;
  const canThrow = M.phase === 'throw' && mine;
  const mar = st.marbles[p];
  const T = lay.tools;
  const nudgeOn = (d) => M.adj === d;
  toolButton(ctx, S, T.nudgeM, 'marble', tr('nudgeM'), { off: !choose || !M.value || (!nudgeOn(-1) && !actionsFor0(M, -1)), kind: nudgeOn(-1) ? 'on' : 'normal', pressed: pr('nudgeM'), icColor: '#ffffff', sub: choose ? `${mar} ${mar === 1 ? 'marble' : 'marbles'}` : '' });
  toolButton(ctx, S, T.nudgeP, 'marble', tr('nudgeP'), { off: !choose || !M.value || (!nudgeOn(1) && !actionsFor0(M, 1)), kind: nudgeOn(1) ? 'on' : 'normal', pressed: pr('nudgeP'), icColor: '#ffffff', sub: choose ? `${mar} ${mar === 1 ? 'marble' : 'marbles'}` : '' });
  toolButton(ctx, S, T.think, 'hint', tr('think'), { off: !choose || Boolean(M.hintTask), pressed: pr('think') });
  toolButton(ctx, S, T.pause, 'pause', tr('pauseBtn'), { pressed: pr('pause') });
  toolButton(ctx, S, T.pass, 'skip', tr('skipBtn'), { off: !(choose && M.allowSkip), pressed: pr('pass') });
  const label = choose ? tr('moveBtn') : tr('throwBtn');
  toolButton(ctx, S, T.throw, canThrow || !choose ? 'throw' : 'play', label, { off: !(canThrow || (choose && M.sel >= 0)), kind: 'primary', pressed: pr('throw') });
}
function actionsFor0(M, d) {
  // is a nudge in this direction possible (a marble and a move)?
  return M.st.marbles[M.st.turn] > 0 && allActions(M).some((a) => a.adj === d);
}

function drawAutoBar(ctx, S, auto, lay) {
  const b = lay.auto, pr = (id) => S.press && S.press.id === `auto:${id}` && S.press.active;
  toolButton(ctx, S, b.exit, 'back', tr('autoExit'), { pressed: pr('exit') });
  toolButton(ctx, S, b.slower, 'minus', tr('autoSlower'), { off: S.thinkIdx === 0, pressed: pr('slower') });
  toolButton(ctx, S, b.faster, 'plus', tr('autoFaster'), { off: S.thinkIdx === THINK_STEPS.length - 1, pressed: pr('faster') });
  toolButton(ctx, S, b.pause, auto.paused ? 'play' : 'pause', auto.paused ? tr('autoPlay') : tr('autoPause'), { kind: 'primary', pressed: pr('pause') });
}

function statusText(S, M, auto) {
  const st = M.st;
  let head = '', body = '';
  const nm = (i) => nameOf(M, i);
  if (M.over) {
    head = S.endInfo ? S.endInfo.head : '';
    body = S.endInfo ? S.endInfo.body : '';
  } else if (auto) {
    if (auto.paused) head = tr('paused');
    else if (auto.phase === 'think') { head = tr('autoThink', { n: Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t)) }); body = `${nm(st.turn)}`; }
    else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
    else if (auto.phase === 'intro') head = tr('title');
    else if (M.phase === 'rolling') head = tr('seatThrows', { seat: nm(st.turn) });
    else if (M.phase === 'pass') { head = tr('noMove', { v: M.value }); }
    else head = nm(st.turn);
  } else if (S.toast) head = S.toast;
  else if (M.hintTask) head = tr('thinkingDots');
  else if (M.hint) { head = M.hint.head; body = M.hint.why; }
  else if (M.phase === 'rolling') head = tr('seatThrows', { seat: nm(st.turn) });
  else if (M.phase === 'pass') head = M.passInfo && M.passInfo.skipped ? 'Skipped' : tr(M.passInfo && M.passInfo.extra ? 'noMoveExtra' : 'noMove', { v: M.value });
  else if (M.phase === 'moving') {
    const lm = M.lastMove;
    if (lm && lm.cap) head = tr(lm.marbleFrom >= 0 ? 'capturedMarble' : 'captured', { seat: nm(lm.p), victim: seatColor(lm.cap.p) });
    else if (lm && lm.marbleGain && lm.kind === 'home') head = tr('homeLion', { seat: nm(lm.p) });
    else head = tr('threw', { seat: nm(lm ? lm.p : st.turn), v: lm ? lm.value : M.value });
  } else if (M.phase === 'choose' && humanTurn(M)) {
    if (M.allowSkip) head = tr('onlyNudge', { v: M.value });
    else head = M.adj ? tr('pickNudged', { v: M.value, w: M.value + M.adj }) : tr('pick', { v: M.value });
  } else if (M.phase === 'choose') { head = tr('seatThinks', { seat: nm(st.turn) }); body = tr('threw', { seat: nm(st.turn), v: M.value }); }
  else if (M.phase === 'throw') {
    if (humanTurn(M)) head = M.humans === 1 ? tr('yourThrow') : tr('seatThrow', { seat: nm(st.turn) });
    else head = tr('seatThinks', { seat: nm(st.turn) });
    if (!humanTurn(M) && !M.auto && M.st.n >= 4) body = tr('tSkip');
    if (st.extra) body = tr('extraThrow', { v: st.last ? st.last.value : '' });
  }
  return { head, body };
}

function drawMessage(ctx, S, r, head, body) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx];
  const pad = 8, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 6, 30 * (1 + (z - 1) * 0.55), 15);
  const hl = wrap(head, f.size, w);
  const all = body ? [...hl, ...wrap(body, f.size * 0.86, w)] : hl;
  const total = hl.length * f.line + (body ? wrap(body, f.size * 0.86, w).length * f.line * 0.86 : 0);
  let ty = r.y + (r.h - total) / 2 + f.size * 0.92;
  void all;
  hl.forEach((ln) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, th.accent, { weight: 800 }); ty += f.line; });
  if (body) for (const ln of wrap(body, f.size * 0.86, w)) { text(ctx, ln, r.x + r.w / 2, ty, f.size * 0.86, 'rgba(250,240,222,0.93)', { weight: 500 }); ty += f.line * 0.86; }
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx];
  const auto = S.scene === 'auto' ? S.auto : null;
  const lay = playFrame(S.w, S.h, z, M.st.n);
  background(ctx, th, S.t, lay.board.y + lay.board.side / 2, false, lay.board.x + lay.board.side / 2);
  for (const c of lay.cards) { ctx.fillStyle = 'rgba(8,5,3,0.3)'; rr(ctx, c.x, c.y, c.w, c.h, 24); ctx.fill(); ctx.strokeStyle = th.stroke; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; rr(ctx, c.x, c.y, c.w, c.h, 24); ctx.stroke(); ctx.globalAlpha = 1; }
  const sub = auto ? tr('watchSub', { n: THINK_STEPS[S.thinkIdx] }) : tr('lengthLine', { n: M.st.n, len: lenName(M.length) });
  drawHud(ctx, S, lay, 'Mehen', sub, !auto && lay.mode === 'stack');
  for (let i = 0; i < M.st.n; i++) drawPlate(ctx, S, M, lay.plates[i], i);
  const g = trackGeo(lay.board.x, lay.board.y, lay.board.side);
  drawBoardScene(ctx, S, M, g, lay, auto);
  drawStatusCard(ctx, S, lay.status);
  drawSticks(ctx, S, M, lay.sticks);
  const { head, body } = statusText(S, M, auto);
  drawMessage(ctx, S, lay.msg, head, body);
  if (auto && auto.phase === 'think' && !auto.paused) {
    const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
    const b = lay.msg;
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, b.x + 14, b.y + b.h - 10, b.w - 28, 6, 3); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, b.x + 14, b.y + b.h - 10, (b.w - 28) * frac, 6, 3); ctx.fill();
  }
  if (auto) drawAutoBar(ctx, S, auto, lay); else drawTools(ctx, S, M, lay);
  if (S.toast && !M.over) { /* the toast is shown in the message area */ }
}

export function render(ctx, S, ui) {
  setSize(S.w ?? SCREEN.width, S.h ?? SCREEN.height);
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'demo-limit':
      background(ctx, theme(S), S.t);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': case 'auto':
      if (!S.match) { background(ctx, theme(S), S.t); break; }
      drawPlay(ctx, S);
      break;
    default: background(ctx, theme(S), S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}

export { getRules, H, W, THEMES, themeName, lvName, lionsText, VALUE_P, THROW_VALUES, LENGTHS, STEP_T, STICK_T, CELL_PTS };
