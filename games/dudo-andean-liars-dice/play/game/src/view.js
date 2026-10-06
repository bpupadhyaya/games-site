// Everything drawn each frame. Reads state, changes nothing.
import {
  DISPLAY, THEMES, themeById, text, rr, panel, button, background, mat, icon, drawParticles, drawDie, drawBack, drawCup, weaveBand, tumbleFace,
  alpha, clamp01, ease, backOut,
} from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { LEVELS } from './ai.js';
import { tr, getLang, faceWord, bidWords } from './content.js';
import { autoLayout, playLayout, hud, scr, frame, host, clamp } from './layout.js';
import { drawLockup, drawMoreLine } from './brand.js';
import { THINK_STEPS } from './screens.js';
import { countIn, wildApplies, prevBid, totalDice, canCalzo } from './rules.js';
import { handVisible, bottomSeat, seatOrder, faceAllowed, selLegal, qtyMin } from './match.js';

const W = 720;   // the design width of the title attract scene (drawn scaled into the art area)
const theme = (S) => themeById(S.themeId);

// Largest text size (<= start) whose wrapped lines fit w x h. Used by every HUD text so zoom never overflows.
const minU = () => clamp(11 / (host.px || 0.6), 12, 22);   // ~11 css px, in virtual units (tablets: 12, phones: up to 22)
export function fitText(str, w, h, start, min = 16, lh = 1.28) {
  min = Math.min(Math.max(min, minU()), start);
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  const lines = wrap(str, min, w);
  return { lines, size: min, line: min * lh };
}
export const fitOne = (str, w, start, min = 14) => { min = Math.min(Math.max(min, minU()), start); let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };
const zf = (S) => TEXT_SCALES[S.textIdx];
const grow = (z, base, k = 0.5) => base * (1 + (z - 1) * k);

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
    ctx.fillStyle = alpha(th.accent, 0.75);
    rr(ctx, region.x + region.w + 8, ty, 6, tH, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.lockup) {
      const q = f.lockup, dn = S.press && S.press.id === f.id && S.press.active;
      ctx.save(); ctx.fillStyle = 'rgba(20,6,8,0.62)'; ctx.beginPath(); ctx.roundRect(q.x - 10, q.y - 5, q.w + 20, q.h + 10, (q.h + 10) / 2); ctx.fill(); ctx.restore();
      drawLockup(ctx, q.x + q.w / 2, q.y + (dn ? 1 : 0), q.w * (dn ? 0.96 : 1), dn ? 0.7 : 1); continue;
    }
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
const cap = (ctx, str, x, y, size = 22, col = 'rgba(246,236,214,0.82)') => text(ctx, str, x, y, size, col, { weight: 600 });
const bidChip = (ctx, th, x, y, q, f, size, o = {}) => {
  // "q x [die]" centred at x, y (vertical centre)
  const qs = size * 0.9, ds = size, gap = size * 0.16;
  const qw = tw(String(q), qs * 1.1), xw = tw('×', qs * 0.8);
  const total = qw + gap + xw + gap + ds;
  let cx = x - total / 2;
  text(ctx, String(q), cx + qw / 2, y + qs * 0.36, qs * 1.1, o.color ?? th.ink, { weight: 800, font: DISPLAY });
  cx += qw + gap;
  text(ctx, '×', cx + xw / 2, y + qs * 0.3, qs * 0.8, o.color ?? 'rgba(246,236,214,0.7)', { weight: 600 });
  cx += xw + gap;
  drawDie(ctx, th, cx + ds / 2, y, ds, f, { noShadow: o.noShadow, glow: o.glow, scale: o.scale, alpha: o.alpha });
};
const row5 = (ctx, th, x, cy, hand, ds, o = {}) => {
  const gap = ds * 0.18, total = hand.length * ds + (hand.length - 1) * gap;
  hand.forEach((d, i) => drawDie(ctx, th, x - total / 2 + ds / 2 + i * (ds + gap), cy, ds, d, o.each ? o.each(d, i) : {}));
};

function drawArt(ctx, S, name, x, y, w, h, b) {
  const th = theme(S);
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,8,0.5)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const ds = Math.min(80, (w - 60) / 6);
  if (name === 'logo') {
    drawCup(ctx, th, cx - 60, cy - 6, 130, 150, { tilt: -0.12 });
    drawDie(ctx, th, cx + 80, cy + 30, 70, 1, { angle: 0.3 });
    drawDie(ctx, th, cx + 150, cy + 50, 60, 5, { angle: -0.2 });
  } else if (name === 'cups') {
    [-190, 0, 190].forEach((dx, i) => drawCup(ctx, th, cx + dx, cy - 20, 130, 150, { tilt: Math.sin(t * 2 + i) * 0.02 }));
    row5(ctx, th, cx, y + h - 54, [3, 1, 6, 4, 2], 52);
  } else if (name === 'bidpick') {
    const s = Math.min(70, (w - 70) / 6);
    [1, 2, 3, 4, 5, 6].forEach((f, i) => { const px = x + 35 + s / 2 + i * ((w - 70) / 6); rr(ctx, px - s / 2 - 4, cy - s - 14, s + 8, s + 8, 12); ctx.fillStyle = f === 4 ? th.btnOn[0] : th.btn[0]; ctx.fill(); drawDie(ctx, th, px, cy - s / 2 - 10, s * 0.82, f, { noShadow: true }); });
    bidChip(ctx, th, cx, cy + 50, 3, 4, 64);
  } else if (name === 'ladder') {
    const defs = [[3, 4], [3, 5], [4, 2]];
    defs.forEach(([q, f], i) => { bidChip(ctx, th, x + w * (0.2 + i * 0.3), cy, q, f, 54); if (i < 2) text(ctx, '›', x + w * (0.35 + i * 0.3), cy + 14, 44, th.accent, { weight: 800 }); });
  } else if (name === 'paco') {
    row5(ctx, th, cx, cy - 10, [4, 1, 3, 4, 1], ds, { each: (d) => (d === 4 || d === 1 ? { glow: 0.7 } : { dim: 0.4 }) });
    bidChip(ctx, th, cx, y + h - 36, 4, 4, 44);
  } else if (name === 'pacoladder') {
    [[5, 4], [3, 1], [7, 5]].forEach(([q, f], i) => { bidChip(ctx, th, x + w * (0.2 + i * 0.3), cy, q, f, 54, f === 1 ? { glow: 0.5 } : {}); if (i < 2) text(ctx, '›', x + w * (0.35 + i * 0.3), cy + 14, 44, th.accent, { weight: 800 }); });
  } else if (name === 'dudo') {
    row5(ctx, th, cx, cy + 40, [4, 4, 1, 6, 4], ds * 0.9, { each: (d) => (d === 4 || d === 1 ? { glow: 0.55 } : { dim: 0.4 }) });
    text(ctx, tr('dudo'), cx, y + 78, 62, th.accent, { font: DISPLAY, weight: 800 });
  } else if (name === 'calzo') {
    row5(ctx, th, cx, cy + 40, [2, 2, 1, 5, 2], ds * 0.9, { each: (d) => (d === 2 || d === 1 ? { glow: 0.55 } : { dim: 0.4 }) });
    text(ctx, tr('calzo'), cx, y + 78, 62, th.accent, { font: DISPLAY, weight: 800 });
  } else if (name === 'lose') {
    drawDie(ctx, th, cx - 40, cy, 100, 3, { angle: 0.1, glow: 0.4 });
    text(ctx, '−1', cx + 100, cy + 22, 70, '#ff8d7a', { font: DISPLAY, weight: 800 });
  } else if (name === 'palifico') {
    drawDie(ctx, th, cx - 90, cy, 100, 5, { glow: 0.5 });
    icon(ctx, 'lock', cx + 70, cy, 70, th.accent);
    text(ctx, tr('palTag'), cx, y + h - 24, 26, th.accent, { weight: 700 });
  } else if (name === 'odds') {
    const bw = (w - 100) / 6;
    [1, 2, 3, 4, 5, 6].forEach((f, i) => {
      const bh = (f === 1 ? 1 / 6 : 1 / 3) * (h - 100) * 2.4;
      ctx.fillStyle = f === 1 ? th.die.ace : th.accent; rr(ctx, x + 50 + i * bw + 6, y + h - 46 - bh, bw - 12, bh, 8); ctx.fill();
      drawDie(ctx, th, x + 50 + i * bw + bw / 2, y + h - 28, Math.min(34, bw - 12), f, { noShadow: true });
    });
    cap(ctx, '1/3', x + 50 + 3 * bw, y + 30, 24, th.accent); cap(ctx, '1/6', x + 50 + bw / 2, y + h - 100, 22);
  } else if (name === 'levels') {
    LEVELS.forEach((l, i) => {
      const yy = y + 24 + i * ((h - 48) / 5);
      cap(ctx, l.name, x + 110, yy + 30, 24, th.ink);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rr(ctx, x + 220, yy + 12, w - 260, 26, 13); ctx.fill();
      ctx.fillStyle = th.accent; rr(ctx, x + 220, yy + 12, (w - 260) * (0.2 + 0.2 * i), 26, 13); ctx.fill();
    });
  } else if (name === 'pass') {
    rr(ctx, cx - 70, cy - 120, 140, 240, 24); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill(); ctx.strokeStyle = th.accent; ctx.lineWidth = 3; ctx.stroke();
    drawCup(ctx, th, cx, cy - 10, 70, 80, {});
    text(ctx, '→', cx + 140, cy + 14, 70, th.accent, { weight: 800 }); text(ctx, '←', cx - 140, cy + 14, 70, th.accent, { weight: 800 });
  } else if (name === 'think') {
    row5(ctx, th, cx, cy - 36, [4, 1, 6, 4, 2], ds * 0.9);
    ctx.fillStyle = 'rgba(10,8,8,0.8)'; rr(ctx, x + 60, y + h - 90, w - 120, 64, 32); ctx.fill();
    ctx.strokeStyle = th.stroke; ctx.lineWidth = 1.5; rr(ctx, x + 60, y + h - 90, w - 120, 64, 32); ctx.stroke();
    cap(ctx, '25 ÷ 3 ≈ 8.3   ·   62%', cx, y + h - 49, 26, th.accent);
  } else if (name === 'auto') {
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.arc(cx - 150, cy, 46, -Math.PI / 2, -Math.PI / 2 + ((t * 0.4) % 1) * Math.PI * 2); ctx.stroke();
    drawDie(ctx, th, cx + 10, cy, 96, 1 + (Math.floor(t * 1.2) % 6), { glow: 0.5 + 0.5 * Math.sin(t * 5) });
    icon(ctx, 'pause', cx + 150, cy, 52, th.accent);
  } else if (name === 'quiz') {
    const d = b.data ?? {};
    if (d.hand) row5(ctx, th, cx, y + 70, d.hand, 74);
    const lineY = d.hand ? y + h - 52 : cy - 8;
    if (d.prev) { cap(ctx, d.pal ? tr('palTag') : '', cx - 150, lineY + 8, 22, th.accent); bidChip(ctx, th, cx, lineY, d.prev.q, d.prev.f, 44); }
    if (d.total) cap(ctx, `${d.total} ${getLang() === 'es' ? 'dados' : 'dice'}`, d.prev ? cx + 200 : cx, lineY + 8, 30, th.accent);
  } else if (name === 'lock') {
    icon(ctx, 'lock', cx, cy, 90, th.accent);
  } else if (name === 'endmark') {
    const e = b.data ?? {};
    const k = backOut(clamp01((S.ovT - 0.15) / 0.5));
    drawDie(ctx, th, cx, cy + 6, 100, e.win ? 1 : 3, { scale: k, glow: e.win ? 0.5 + 0.4 * Math.sin(S.ovT * 4) : 0, dim: e.win ? 0 : 0.25 });
  } else if (name === 'end') {
    drawDie(ctx, th, cx, cy, 110, 1, { glow: 0.6 + 0.3 * Math.sin(t * 3) });
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
function drawAttract(ctx, S) {
  const th = theme(S), t = S.t;
  const cyc = 4.2, tt = t % cyc;
  const glow = ctx.createRadialGradient(W / 2, 520, 30, W / 2, 520, 340);
  glow.addColorStop(0, th.glow); glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 220, W, 640);
  // the cup shakes, then lifts and the dice tumble out and settle
  const shaking = tt < 1.5;
  const lift = tt < 1.5 ? 0 : Math.min(1, (tt - 1.5) / 0.4) * 150;
  drawCup(ctx, th, W / 2, 492, 190, 220, { tilt: shaking ? Math.sin(tt * 34) * 0.16 : 0, lift, alpha: tt > 1.9 ? Math.max(0, 1 - (tt - 1.9) / 0.5) * 0.9 + 0.1 : 1 });
  const faces = [5, 1, 3, 1, 6];
  if (tt > 1.6) faces.forEach((f, i) => {
    const a = tt - 1.6 - i * 0.06;
    if (a < 0) return;
    const k = clamp01(a / 0.55);
    const px = W / 2 + (i - 2) * 100, py = 640 - Math.abs(Math.sin(a * 11)) * 70 * (1 - k);
    drawDie(ctx, th, px, py, 82, k < 1 ? tumbleFace(i, a) : f, { angle: (1 - k) * Math.sin(a * 30 + i) * 0.9, glow: k >= 1 && f === 1 ? 0.7 : 0 });
  });
  const g = ctx.createLinearGradient(0, 120, 0, 290);
  g.addColorStop(0, '#fff0c0'); g.addColorStop(0.5, th.accent); g.addColorStop(1, '#a8782a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 150px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g;
  ctx.fillText('Dudo', 360, 240);
  ctx.restore();
  weaveBand(ctx, th, 140, 262, 440, 22, {});
  text(ctx, tr('subtitle'), 360, 322, 30, 'rgba(246,236,214,0.9)', { weight: 600, font: DISPLAY });
  text(ctx, tr('tagline'), 360, 360, 23, 'rgba(246,236,214,0.62)', { weight: 500 });
}

function drawTitle(ctx, S, ui) {
  const th = theme(S), F = frame(), art = ui.art;
  const top = F.cols ? art.y : art.y + 80, hh = art.h - 80;
  const sc = clamp(Math.min(art.w / 700, hh / 580), 0.3, F.cols ? 1.2 : 1);
  const cx = art.x + art.w / 2, cy = top + hh / 2;
  background(ctx, th, S.t, cy, cx);
  ctx.save(); ctx.translate(cx - 360 * sc, cy - 410 * sc); ctx.scale(sc, sc); drawAttract(ctx, S); ctx.restore();
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  background(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) {
    drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]);
    text(ctx, ui.nav.label, ui.nav.labelAt.x, ui.nav.labelAt.y, 26, 'rgba(246,236,214,0.75)', { weight: 600 });
  }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,4,4,${0.62 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, scr.w, scr.h);
  const k = ease(clamp01(S.ovT / 0.3));
  const ocx = ui.panel.x + ui.panel.w / 2, ocy = ui.panel.y + ui.panel.h / 2;
  ctx.save();
  ctx.translate(ocx, ocy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-ocx, -ocy);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
  if (S.overlay === 'end') { // a quiet pointer to the rest of the collection, under the card, only when there is room
    const y = ui.panel.y + ui.panel.h + 34;
    if (y < frame().U.y1 - 6) { ctx.save(); ctx.globalAlpha = k; drawMoreLine(ctx, ocx, y, 21); ctx.restore(); }
  }
}

// ------------------------------------------------------------------------------------------ play
const REVEAL_PH = ['call', 'reveal', 'verdict', 'result'];
const inReveal = (M) => REVEAL_PH.includes(M.phase) && M.snap;
const handsOf = (M) => (inReveal(M) ? M.snap.hands : M.st.players.map((p) => p.hand));
const diceOf = (M, seat) => {
  if (!inReveal(M)) return M.st.players[seat].dice;
  return M.phase === 'verdict' || M.phase === 'result' ? M.snap.after[seat] : M.snap.dice[seat];
};
const bidOfSeat = (M, seat) => {
  const list = inReveal(M) ? [M.snap.bid] : M.st.bids;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].p === seat) return list[i];
  return null;
};
const turnPhase = (M) => ['human', 'cpu', 'gap', 'autowait', 'handoff'].includes(M.phase);

function drawHud(ctx, S, title, sub, showPause) {
  const th = theme(S), Hd = hud();
  button(ctx, th, Hd.back, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', Hd.back.x + Hd.back.w / 2, Hd.back.y + Hd.back.h / 2, 34, th.ink);
  if (showPause) {
    button(ctx, th, Hd.pause, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', Hd.pause.x + Hd.pause.w / 2, Hd.pause.y + Hd.pause.h / 2, 34, th.ink);
  }
  // the kit's preview clock sits at the top centre by default: park it in the title row, left of the pause button, clear of the title
  globalThis.__previewBadge = { x: Hd.pause.x - 10, y: Hd.pause.y + 4, align: 'right' };
  const z = zf(S);
  const tSize = fitOne(title, Hd.titleMaxW, 40 * (1 + (z - 1) * 0.1), 22);
  text(ctx, title, Hd.titleCx, Hd.titleY, tSize, th.ink, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.6)' });
  const sSize = fitOne(sub, Hd.titleMaxW, 24 * (1 + (z - 1) * 0.2), 15);
  text(ctx, sub, Hd.titleCx, Hd.subY, sSize, 'rgba(246,236,214,0.7)', { weight: 500 });
}

function drawSeat(ctx, S, M, r, seat) {
  const th = theme(S), z = zf(S), p = M.st.players[seat];
  const n = diceOf(M, seat), out = n === 0;
  const myTurn = turnPhase(M) && M.st.turn === seat && !out;
  const showFaces = (M.auto || inReveal(M)) && M.phase !== 'shake' && !(M.phase === 'roll' && M.rollT < 0.6);
  ctx.save();
  if (out) ctx.globalAlpha = 0.45;
  ctx.fillStyle = 'rgba(8,6,6,0.6)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = myTurn ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = myTurn ? 3 : 1.5;
  if (myTurn) { ctx.shadowColor = alpha(th.accent, 0.7); ctx.shadowBlur = 16; }
  rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  ctx.save();
  if (out) ctx.globalAlpha = 0.45;
  const cupW = Math.min(54, r.h * 0.34);
  const tilt = M.phase === 'shake' ? Math.sin(M.t * 34 + seat * 2) * 0.2 : 0;
  drawCup(ctx, th, r.x + 18 + cupW / 2, r.y + r.h - 16 - cupW * 0.55, cupW, cupW * 1.1, { tilt, shadow: false });
  const tx = r.x + 30 + cupW, avail = r.w - cupW - 40;
  const ns = fitOne(p.name, avail, grow(z, 25, 0.5), 15);
  text(ctx, p.name, tx, r.y + 10 + ns * 0.9, ns, th.ink, { weight: 800, align: 'left', font: DISPLAY });
  if (p.kind === 'human' && M.hot) { /* people in pass-and-play are marked by name only */ }
  const hands = handsOf(M);
  const ds = Math.min(grow(z, 28, 0.2), (avail - 6) / 5 - 3);
  const dyRow = r.y + 14 + ns + ds * 0.62;
  for (let i = 0; i < n; i++) {
    const dx = tx + ds / 2 + i * (ds + 3), dy = dyRow + (M.phase === 'shake' ? Math.sin(M.t * 30 + i * 1.7 + seat) * 2.5 : 0);
    if (showFaces && hands[seat][i]) drawDie(ctx, th, dx, dy, ds, hands[seat][i], { noShadow: true });
    else drawBack(ctx, th, dx, dy, ds);
  }
  if (out) text(ctx, tr('outTag'), tx, dyRow + ds * 0.4, fitOne(tr('outTag'), avail, grow(z, 22, 0.4), 14), 'rgba(255,130,110,1)', { weight: 800, align: 'left' });
  const bd = bidOfSeat(M, seat);
  if (bd && !out) {
    const cs = Math.min(grow(z, 26, 0.35), r.h * 0.26);
    const fl = M.bidT < 0.5 && M.st.bids.length && M.st.bids[M.st.bids.length - 1] === bd ? 1 + 0.25 * (1 - M.bidT / 0.5) : 1;
    bidChip(ctx, th, tx + Math.min(avail * 0.5, 70), r.y + r.h - 10 - cs * 0.6, bd.q, bd.f, cs * fl, { noShadow: true });
  }
  if (M.st.palifico && n === 1 && !out) text(ctx, tr('palTag'), r.x + r.w - 12, r.y + 12 + ns * 0.6, fitOne(tr('palTag'), 80, 16, 11), th.accent, { weight: 700, align: 'right' });
  ctx.restore();
}

function statusFor(S, M) {
  const st = M.st, name = st.players[st.turn].name;
  if (M.phase === 'shake') return { head: tr('roundN', { n: st.round }), body: st.palifico ? tr('pal') : '' };
  if (M.phase === 'roll') return { head: tr('roundN', { n: st.round }), body: st.palifico ? tr('pal') : '' };
  if (M.phase === 'call') { const s = M.snap; return { head: tr(s.kind === 'dudo' ? 'callDudo' : 'callCalzo', { name: st.players[s.caller].name }), body: bidWords(s.bid.q, s.bid.f) }; }
  if (inReveal(M)) return verdictText(M);
  if (M.phase === 'human') {
    if (M.hint) return { head: M.hint.head, body: M.hint.why };
    return { head: st.bids.length ? tr('toRaise') : tr('toOpen'), body: st.palifico ? tr('pal') : '' };
  }
  if (M.phase === 'handoff') return { head: tr('handoffTable', { name }), body: '' };
  if (M.auto && S.auto) return { head: S.auto.note.head || tr('autoSession'), body: S.auto.note.why };
  return { head: tr('botWait', { name }), body: '' };
}
function verdictText(M) {
  const s = M.snap, r = s.res, st = M.st;
  const nm = (i) => st.players[i].name;
  const you = (i) => st.players[i].kind === 'human' && !M.hot;
  const count = tr('countIs', { n: r.actual, w: faceWord(s.bid.f, r.actual) });
  let head, body;
  if (r.kind === 'dudo') {
    head = r.actual >= s.bid.q ? tr('callerWrong') : tr('callerRight');
    body = you(r.loser) ? tr('youLose') : tr('loseDie', { name: nm(r.loser) });
  } else if (r.gainer >= 0) {
    head = tr('calzoRight');
    body = r.capped ? tr('capDie', { name: nm(r.gainer) }) : you(r.gainer) ? tr('youGain') : tr('gainDie', { name: nm(r.gainer) });
  } else { head = tr('calzoWrong'); body = you(r.loser) ? tr('youLose') : tr('loseDie', { name: nm(r.loser) }); }
  if (r.loser >= 0 && s.after[r.loser] === 0) body += ` ${tr('elim', { name: nm(r.loser) })}`;
  if (r.palifico) body += ` ${tr('palNext', { name: nm(r.loser) })}`;
  return { head: `${head} ${count}`, body };
}

function statusCard(ctx, S, r, head, body, col) {
  const th = theme(S), z = zf(S);
  ctx.save();
  ctx.fillStyle = 'rgba(6,4,4,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const pad = 20, w = r.w - pad * 2;
  const full = body ? `${head}\n${body}` : head;
  const f = fitText(full, w, r.h - 20, grow(z, 29, 0.6), 15);
  const hl = wrap(head, f.size, w).length;
  const all = body ? [...wrap(head, f.size, w), ...wrap(body, f.size, w)] : wrap(head, f.size, w);
  const total = all.length * f.line;
  let ty = r.y + (r.h - total) / 2 + f.size * 0.95;
  all.forEach((ln, i) => { text(ctx, ln, r.x + r.w / 2, ty, f.size, i < hl ? (col ?? th.accent) : 'rgba(246,236,214,0.92)', { weight: i < hl ? 800 : 500 }); ty += f.line; });
}

function drawTable(ctx, S, M, lay) {
  const th = theme(S), T = lay.table, st = M.st, z = zf(S);
  mat(ctx, th, T.x, T.y, T.w, T.h);
  const prev = prevBid(st);
  const cx = T.x + T.w / 2;
  const roomy = T.h >= 500, topPad = roomy ? 62 : 48;
  const info = `${tr('roundN', { n: st.round })}  ·  ${tr('diceInPlay', { n: totalDice(st) })}`;
  text(ctx, info, T.x + 24, T.y + (roomy ? 52 : 38), fitOne(info, T.w * 0.62, grow(z, 21, 0.3), 14), 'rgba(246,236,214,0.7)', { weight: 600, align: 'left' });
  if (st.palifico) { const ps = fitOne(tr('palTag'), T.w * 0.25, grow(z, 22, 0.3), 14); text(ctx, tr('palTag'), T.x + T.w - 24, T.y + (roomy ? 52 : 38), ps, th.accent, { weight: 800, align: 'right' }); }
  const shMax = grow(z, 150, 0.7);
  let shH = clamp(Math.min(shMax, T.h - topPad - 140), 78, shMax);
  if (!roomy) shH = Math.min(shH, Math.max(T.h < 260 ? 46 : 78, T.h * (T.h < 260 ? 0.3 : 0.36)));
  const sr = { x: T.x + 16, y: T.y + T.h - 16 - shH, w: T.w - 32, h: shH };
  const midTop = T.y + topPad, midH = sr.y - midTop, mid = midTop + midH / 2;
  const hasHist = st.bids.length > 1 && midH > 250 && z < 2;
  const bigS = clamp(Math.max((sr.y - T.y - 140) * 0.42, midH * 0.5), Math.min(60, midH * 0.6), 150) * Math.min(1, T.w / 420);
  const by = mid - (hasHist ? 34 : 14) - Math.max(0, bigS - 104) * 0.3 + (bigS < 104 ? 8 : 0);
  if (M.phase === 'shake') {
    const cs = Math.min(1, midH / 260);
    drawCup(ctx, th, cx, mid, 170 * cs, 200 * cs, { tilt: Math.sin(M.t * 34) * 0.2, lift: Math.abs(Math.sin(M.t * 17)) * 14 * cs });
  } else if (prev) {
    const pop = M.bidT < 0.45 ? backOut(clamp01(M.bidT / 0.3)) : 1;
    ctx.save(); ctx.translate(cx, by); ctx.scale(pop, pop);
    bidChip(ctx, th, 0, 0, prev.q, prev.f, bigS, { glow: prev.f === 1 ? 0.5 : 0.25 });
    ctx.restore();
    const nm = st.players[prev.p].name;
    if (midH > 110) text(ctx, tr('bidBy', { name: nm }), cx, by + bigS * 0.83, fitOne(tr('bidBy', { name: nm }), T.w - 112, grow(z, 24, 0.3), 14), 'rgba(246,236,214,0.75)', { weight: 600 });
    if (hasHist) {
      const hist = st.bids.slice(-5, -1), sp = Math.min(120, (T.w - 80) / Math.max(1, hist.length));
      hist.forEach((b, i) => { ctx.globalAlpha = 0.55; bidChip(ctx, th, cx + (i - (hist.length - 1) / 2) * sp, by + bigS * 0.83 + 48, b.q, b.f, 30, { noShadow: true }); ctx.globalAlpha = 1; });
    }
  } else {
    text(ctx, tr('noBid'), cx, mid + 12, fitOne(tr('noBid'), T.w - 60, 40, 18), 'rgba(246,236,214,0.6)', { font: DISPLAY, weight: 700 });
  }
  const sx = statusFor(S, M);
  if (M.phase === 'handoff') return;
  if (sr.h > 40 && !M.auto) statusCard(ctx, S, sr, sx.head, sx.body);
  if (M.phase === 'cpu' || M.phase === 'autowait') {
    for (let i = 0; i < 3; i++) { ctx.fillStyle = `rgba(242,184,75,${0.35 + 0.5 * Math.max(0, Math.sin(S.t * 6 - i * 0.9))})`; ctx.beginPath(); ctx.arc(cx - 20 + i * 20, sr.y - 14, 5, 0, Math.PI * 2); ctx.fill(); }
  }
}

function drawHandoff(ctx, S, M, lay) {
  const th = theme(S), T = lay.table, z = zf(S);
  const name = M.st.players[M.st.turn].name;
  const sc = clamp(T.h / 608, 0.5, 1);
  mat(ctx, th, T.x, T.y, T.w, T.h); ctx.fillStyle = 'rgba(6,4,4,0.94)'; rr(ctx, T.x + 12, T.y + 12, T.w - 24, T.h - 24, 20); ctx.fill();
  drawCup(ctx, th, T.x + T.w / 2, T.y + 112 * sc, 90 * sc, 106 * sc, { tilt: Math.sin(S.t * 2) * 0.04 });
  const tf = fitText(tr('handoffTitle', { name }), T.w - 80, 110 * sc, grow(z, 38, 0.5) * Math.max(0.7, sc), 20, 1.2);
  tf.lines.forEach((ln, i) => text(ctx, ln, T.x + T.w / 2, T.y + 204 * sc + i * tf.line, tf.size, th.accent, { font: DISPLAY, weight: 800 }));
  const bt = T.y + 204 * sc + tf.lines.length * tf.line + 10, bh = lay.handoff.y - bt - 10;
  if (bh >= 44) {
    const bf = fitText(tr('handoffBody', { name }), T.w - 90, bh, grow(z, 25, 0.5), 15);
    bf.lines.forEach((ln, i) => text(ctx, ln, T.x + T.w / 2, bt + bf.size + i * bf.line, bf.size, 'rgba(246,236,214,0.88)', { weight: 500 }));
  }
  const r = lay.handoff, pressed = S.press && S.press.id === 'hand:ack' && S.press.active;
  const bf2 = fitText(tr('handoffBtn'), r.w - 30, r.h - 20, grow(z, 32, 0.5), 16);
  button(ctx, th, r, bf2.lines, 'primary', { size: bf2.size, pressed });
}

function drawBottomDice(ctx, S, M, lay) {
  const th = theme(S), z = zf(S), r = lay.dice, st = M.st;
  const seat = bottomSeat(M), p = st.players[seat];
  ctx.save();
  ctx.fillStyle = 'rgba(8,6,6,0.55)'; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.fill();
  const mine = turnPhase(M) && st.turn === seat;
  ctx.strokeStyle = mine ? th.accent : 'rgba(255,255,255,0.14)'; ctx.lineWidth = mine ? 3 : 1.5; rr(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.restore();
  const label = M.hot || M.auto ? tr('dicesOf', { name: p.name }) : tr('youPoss');
  const ls = fitOne(label, r.w - 40, grow(z, 21, 0.4), 14);
  text(ctx, label, r.x + 20, r.y + 14 + ls * 0.9, ls, 'rgba(246,236,214,0.7)', { weight: 600, align: 'left' });
  const n = p.dice, hand = p.hand;
  const visible = handVisible(M, seat) || (M.phase === 'roll' && !M.hot && p.kind === 'human') || M.auto;
  const hideCover = !visible && !(M.phase === 'roll' && M.rollT >= 0 && (p.kind === 'human' && (!M.hot || M.ack)));
  const ds = Math.min(100, (r.w - 40) / Math.max(n, 5) - 10, r.h - ls - 34);
  const cy = r.y + r.h - 10 - ds / 2;
  if (p.dice === 0) { text(ctx, tr('youOut'), r.x + r.w / 2, r.y + r.h / 2 + 12, 32, '#ff8d7a', { font: DISPLAY, weight: 800 }); return; }
  if (M.phase === 'shake' || (M.hot && !M.ack && M.phase !== 'roll') || (!visible && M.phase !== 'roll')) {
    drawCup(ctx, th, r.x + r.w / 2, cy - 4, Math.min(110, r.h * 0.62), Math.min(r.h * 0.7, 120), { tilt: M.phase === 'shake' ? Math.sin(M.t * 34) * 0.18 : 0 });
    if (M.phase !== 'shake') text(ctx, tr('hiddenDice'), r.x + r.w - 20, r.y + 14 + ls * 0.9, ls, 'rgba(246,236,214,0.55)', { weight: 600, align: 'right' });
    return;
  }
  void hideCover;
  const gap = ds * 0.2, total = n * ds + (n - 1) * gap;
  const myPrev = prevBid(st);
  for (let i = 0; i < n; i++) {
    const dx = r.x + r.w / 2 - total / 2 + ds / 2 + i * (ds + gap);
    let o = {};
    if (M.phase === 'roll' && M.rollT < 90) {
      const tt = M.rollT - 0.06 * i;
      if (tt < 0) continue;
      const k = clamp01(tt / 0.55);
      if (k < 1) { drawDie(ctx, th, dx + Math.sin(tt * 19 + i) * 14 * (1 - k), cy - Math.abs(Math.sin(tt * 13 + i)) * 46 * (1 - k), ds, tumbleFace(i + st.round, tt), { angle: Math.sin(tt * 31 + i * 2) * 0.9 * (1 - k), lift: 0.4 * (1 - k) }); continue; }
      o = { scale: 1 + 0.1 * Math.max(0, 1 - (tt - 0.55) / 0.2) };
    } else if (M.phase === 'human' || M.phase === 'cpu' || M.phase === 'gap') {
      const sf = M.phase === 'human' ? M.sel.f : myPrev ? myPrev.f : 0;
      if (sf && (hand[i] === sf || (hand[i] === 1 && wildApplies(st, sf)))) o = { glow: 0.55 + 0.2 * Math.sin(S.t * 4) };
    } else if (M.auto && S.auto && S.auto.phase === 'reveal') { /* watching: plain dice */ }
    drawDie(ctx, th, dx, cy, ds, hand[i], o);
  }
}

function drawControls(ctx, S, M, lay) {
  const th = theme(S), z = zf(S), st = M.st;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  const on = M.phase === 'human' && !S.overlay;
  const prev = prevBid(st);
  ctx.save();
  if (!on) ctx.globalAlpha = 0.4;
  lay.face.forEach((r, i) => {
    const f = i + 1, ok = faceAllowed(M, f), sel = on && M.sel.f === f;
    button(ctx, th, r, [], sel ? 'on' : 'normal', { disabled: !ok, pressed: on && pr(`face:${f}`), radius: 16 });
    const ds = Math.min(r.w - 18, r.h - 22);
    ctx.save(); if (!ok) ctx.globalAlpha = 0.4;
    drawDie(ctx, th, r.x + r.w / 2, r.y + r.h / 2, ds, f, { noShadow: true });
    ctx.restore();
  });
  const qlo = on ? qtyMin(M, M.sel.f) : 1;
  button(ctx, th, lay.minus, [], 'normal', { disabled: !on || M.sel.q <= qlo, pressed: on && pr('qty:-') });
  icon(ctx, 'minus', lay.minus.x + lay.minus.w / 2, lay.minus.y + lay.minus.h / 2, 44, th.ink);
  button(ctx, th, lay.plus, [], 'normal', { disabled: !on || M.sel.q >= totalDice(st), pressed: on && pr('qty:+') });
  icon(ctx, 'plus', lay.plus.x + lay.plus.w / 2, lay.plus.y + lay.plus.h / 2, 44, th.ink);
  ctx.fillStyle = 'rgba(6,4,4,0.55)'; rr(ctx, lay.qty.x, lay.qty.y, lay.qty.w, lay.qty.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, lay.qty.x, lay.qty.y, lay.qty.w, lay.qty.h, 18); ctx.stroke();
  const qs = Math.min(grow(z, 56, 0.3), lay.qty.h * 0.72);
  text(ctx, String(on ? M.sel.q : '–'), lay.qty.x + lay.qty.w / 2, lay.qty.y + lay.qty.h / 2 + qs * 0.39, qs, th.ink, { font: DISPLAY, weight: 800 });
  // the Bid button: label and the chosen bid
  const b = lay.bid, bp = on && pr('bid');
  button(ctx, th, b, [], 'primary', { disabled: !on || !selLegal(M), pressed: bp });
  if (b.w < 240) { // narrow button (landscape card): the word above, the chosen bid below
    const bl = fitOne(tr('bid'), b.w - 24, Math.min(grow(z, 30, 0.4), b.h * 0.3), 13);
    text(ctx, tr('bid'), b.x + b.w / 2, b.y + b.h * 0.34 + bl * 0.3 + (bp ? 2 : 0), bl, th.primaryInk, { weight: 800 });
    if (on) bidChip(ctx, { ...th, ink: th.primaryInk }, b.x + b.w / 2, b.y + b.h * 0.68 + (bp ? 2 : 0), M.sel.q, M.sel.f, Math.min(b.h * 0.34, b.w * 0.21), { color: th.primaryInk, noShadow: true });
  } else {
    const bl = fitOne(tr('bid'), b.w * 0.42, grow(z, 32, 0.4), 16);
    text(ctx, tr('bid'), b.x + 18 + (b.w * 0.42) / 2, b.y + b.h / 2 + bl * 0.34 + (bp ? 2 : 0), bl, th.primaryInk, { weight: 800 });
    if (on) bidChip(ctx, { ...th, ink: th.primaryInk }, b.x + b.w * 0.72, b.y + b.h / 2 + (bp ? 2 : 0), M.sel.q, M.sel.f, Math.min(b.h * 0.5, 56), { color: th.primaryInk, noShadow: true });
  }
  // Dudo / Calzo / Think
  const hintAct = on && M.hint ? M.hint.act : '';
  const act = (r, id, label, kind, extra = {}) => {
    button(ctx, th, r, [], kind, { disabled: extra.disabled, pressed: on && pr(id), radius: 20 });
    const fs = fitOne(label, r.w - 28, grow(z, 32, 0.45), 15);
    const ic = extra.icon;
    if (ic) {
      const is = Math.min(grow(z, 38, 0.3), r.h * 0.42), total = is + fs + 8, yy = r.y + (r.h - total) / 2;
      icon(ctx, ic, r.x + r.w / 2, yy + is / 2, is, extra.ink ?? th.ink);
      text(ctx, label, r.x + r.w / 2, yy + is + 8 + fs * 0.85, fs, extra.ink ?? th.ink, { weight: 800 });
    } else text(ctx, label, r.x + r.w / 2, r.y + r.h / 2 + fs * 0.34 + (on && pr(id) ? 2 : 0), fs, th.ink, { weight: 800 });
    if (extra.ring) { ctx.save(); ctx.strokeStyle = th.win; ctx.lineWidth = 5; ctx.globalAlpha = 0.55 + 0.45 * Math.sin(S.t * 6); rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 24); ctx.stroke(); ctx.restore(); }
  };
  act(lay.dudo, 'dudo', tr('dudo'), 'danger', { disabled: !on || !st.bids.length, ring: hintAct === 'dudo' });
  act(lay.calzo, 'calzo', tr('calzo'), 'normal', { disabled: !on || !st.bids.length || !canCalzo(st), ring: hintAct === 'calzo' });
  act(lay.think, 'think', tr('think'), 'normal', { disabled: !on, icon: 'hint' });
  void prev;
  ctx.restore();
}

function drawReveal(ctx, S, M, lay) {
  const th = theme(S), z = zf(S), s = M.snap, st = M.st;
  const RV = lay.rev, T = RV.T;
  mat(ctx, th, T.x, T.y, T.w, T.h);
  const f = s.bid.f, wild = !s.palifico && f !== 1;
  const alive = s.dice.map((d, i) => (d > 0 ? i : -1)).filter((i) => i >= 0);
  const headerY = T.y + 70;
  const callPhase = M.phase === 'call';
  // header: the bid and the running count
  bidChip(ctx, th, T.x + 150, headerY, s.bid.q, f, grow(z, 54, 0.15), {});
  const rowsTop0 = RV.rowsTop, rowsH = RV.rowsBottom - RV.rowsTop;
  const rh = Math.min(104, rowsH / Math.max(1, alive.length));
  const ds = Math.min(66, rh - 12, (T.w - 214 - 100) / 5 - 8);
  const rowsTop = rowsTop0 + Math.max(0, (rowsH - rh * alive.length) / 6);
  let running = 0;
  if (callPhase) { // fixed surface: flash the called bid instead of sliding the rows
    const fl = Math.max(0, 1 - M.t / 1.2) * (0.55 + 0.45 * Math.sin(M.t * 26));
    ctx.save(); ctx.strokeStyle = `rgba(242,184,75,${clamp01(fl)})`; ctx.lineWidth = 4; rr(ctx, T.x + 14, headerY - 48, 270, 96, 18); ctx.stroke(); ctx.restore();
  }
  ctx.save();
  alive.forEach((seat, k) => {
    const age = M.phase === 'call' ? -1 : M.phase === 'reveal' ? M.t - k * 0.5 : 9;
    const y = rowsTop + k * rh + rh / 2;
    const isCaller = seat === s.caller, isBidder = seat === s.bid.p;
    ctx.fillStyle = isBidder ? 'rgba(242,184,75,0.10)' : 'rgba(255,255,255,0.04)'; rr(ctx, T.x + 14, y - rh / 2 + 3, T.w - 28, rh - 6, 14); ctx.fill();
    const nm = st.players[seat].name;
    const ns = fitOne(nm, 150, grow(z, 24, 0.35), 13);
    text(ctx, nm, T.x + 28, y + ns * 0.34, ns, th.ink, { weight: 700, align: 'left' });
    if ((isBidder || isCaller) && rh > ns * 2.4) text(ctx, isBidder ? (getLang() === 'es' ? 'apostó' : 'bid') : (s.kind === 'dudo' ? tr('dudo').replace('!', '').replace('¡', '') : tr('calzo')), T.x + 28, y + ns * 0.34 + ns * 0.95, Math.max(11, ns * 0.55), th.accent, { weight: 600, align: 'left' });
    const hand = s.hands[seat];
    let matches = 0;
    hand.forEach((d, i) => {
      const dx = T.x + 214 + i * (ds + 8) + ds / 2;
      const a = age - i * 0.04;
      const hit = d === f || (wild && d === 1);
      if (a < 0) { drawBack(ctx, th, dx, y, ds); return; }
      const kk = clamp01(a / 0.3);
      ctx.save(); ctx.translate(dx, y); ctx.scale(Math.max(0.05, kk), 1); ctx.translate(-dx, -y);
      drawDie(ctx, th, dx, y, ds, d, kk >= 1 && hit ? { glow: 0.5 + 0.3 * Math.sin(S.t * 5), noShadow: true } : { dim: kk >= 1 && !hit ? 0.5 : 0, noShadow: true });
      ctx.restore();
      if (kk >= 1 && hit) matches++;
    });
    if (age >= 0.3 + (hand.length - 1) * 0.04) { running += matches; text(ctx, `+${matches}`, T.x + T.w - 34, y + 10, Math.min(36, grow(z, 26, 0.3)), matches ? th.accent : 'rgba(246,236,214,0.4)', { weight: 800, align: 'right' }); }
  });
  ctx.restore();
  const done = M.phase === 'verdict' || M.phase === 'result';
  const shown = done ? s.res.actual : running;
  text(ctx, `${shown}`, T.x + T.w - 90, headerY + grow(z, 24, 0.3), grow(z, 70, 0.3), done ? (s.res.actual >= s.bid.q ? th.accent : '#ff8d7a') : th.ink, { font: DISPLAY, weight: 800 });
  text(ctx, '≥', T.x + T.w - 190, headerY + grow(z, 20, 0.3), grow(z, 40, 0.2), 'rgba(246,236,214,0.55)', { weight: 700 });
  const sr = RV.status;
  if (callPhase) {
    const sx = statusFor(S, M);
    statusCard(ctx, S, sr, sx.head, sx.body);
  } else if (done) {
    const sx = statusFor(S, M);
    statusCard(ctx, S, sr, sx.head, sx.body, s.res.loser >= 0 ? '#ffb09f' : '#9ff0c5');
  }
}

function drawAutoBar(ctx, S, M, auto, lay) {
  const th = theme(S), z = zf(S), b = autoLayout(z, lay.seats.length);
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  const side = (r, ic, label, off, id) => {
    button(ctx, th, r, [], 'normal', { disabled: off, pressed: pr(id), radius: 22 });
    ctx.save(); if (off) ctx.globalAlpha = 0.4;
    const is = 40 * (1 + (z - 1) * 0.35), ls = fitOne(label, r.w - 20, 22 * (1 + (z - 1) * 0.6), 13), total = is + ls + 10, yy = r.y + (r.h - total) / 2;
    icon(ctx, ic, r.x + r.w / 2, yy + is / 2, is, th.ink);
    text(ctx, label, r.x + r.w / 2, yy + is + 10 + ls * 0.85, ls, th.ink, { weight: 700 });
    ctx.restore();
  };
  side(b.slower, 'minus', tr('autoSlower'), S.thinkIdx === 0, 'auto:slower');
  side(b.faster, 'plus', tr('autoFaster'), S.thinkIdx === THINK_STEPS.length - 1, 'auto:faster');
  button(ctx, th, b.pause, [], 'primary', { pressed: pr('auto:pause'), radius: 22 });
  const lab = auto.paused ? tr('autoPlay') : tr('autoPause');
  const ps = fitOne(lab, b.pause.w - 140, 32 * (1 + (z - 1) * 0.5), 16), is = 44 * (1 + (z - 1) * 0.3);
  icon(ctx, auto.paused ? 'play' : 'pause', b.pause.x + 52 + is / 2, b.pause.y + b.pause.h / 2, is, th.primaryInk);
  text(ctx, lab, b.pause.x + 52 + is + (b.pause.w - 52 - is) / 2 - 16, b.pause.y + b.pause.h / 2 + ps * 0.35, ps, th.primaryInk, { weight: 800 });
  return b;
}

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = zf(S), st = M.st;
  background(ctx, th, S.t, 800);
  const auto = S.scene === 'auto' ? S.auto : null;
  const others = seatOrder(M);
  const lay = playLayout(z, others.length);
  const sub = auto ? `${tr('autoSession')} · ${tr('thinkTime').split(' ')[0] === '' ? '' : ''}${tr('autoThink')} ${THINK_STEPS[S.thinkIdx]}${tr('seconds')}` : M.hot ? tr('passPlay') : tr('vsComputer');
  drawHud(ctx, S, tr('title'), sub, !auto);
  const reveal = inReveal(M);
  if (reveal) {
    drawReveal(ctx, S, M, lay);
  } else {
    others.forEach((seat, i) => drawSeat(ctx, S, M, lay.seats[i], seat));
    drawTable(ctx, S, M, lay);
    drawBottomDice(ctx, S, M, lay);
    if (M.phase === 'handoff') drawHandoff(ctx, S, M, lay);
  }
  if (auto) {
    const b = drawAutoBar(ctx, S, M, auto, lay);
    const sx = statusFor(S, M);
    const nr = b.status;
    if (!reveal || M.phase === 'result') {
      let head = sx.head, body = sx.body;
      if (reveal) { head = tr('nextRound'); body = ''; }
      else if (auto.paused) { head = tr('paused'); body = ''; }
      else if (auto.phase === 'think') { head = `${tr('autoThink')} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - auto.t))}`; body = `${st.players[st.turn].name}`; }
      else if (auto.phase === 'reveal' || auto.phase === 'act') { head = auto.note.head; body = auto.note.why; }
      statusCard(ctx, S, nr, head, body);
      if (auto.phase === 'think' && !auto.paused) {
        const frac = clamp01(auto.t / THINK_STEPS[S.thinkIdx]);
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, nr.x + 24, nr.y + nr.h - 16, nr.w - 48, 7, 3.5); ctx.fill();
        ctx.fillStyle = th.accent; rr(ctx, nr.x + 24, nr.y + nr.h - 16, (nr.w - 48) * frac, 7, 3.5); ctx.fill();
      }
    }
  } else if (reveal) {
    if (M.phase === 'result') {
      const r = lay.next, pressed = S.press && S.press.id === 'next:round' && S.press.active;
      const lab = M.over ? tr('next') : tr('nextRound');
      const f = fitText(lab, r.w - 40, r.h - 30, grow(z, 40, 0.4), 18);
      button(ctx, th, r, f.lines, 'primary', { size: f.size, line: f.line, pressed, radius: 24 });
    }
  } else drawControls(ctx, S, M, lay);
  drawParticles(ctx, M.parts);
  if (S.toast) {
    const T = lay.table, tw2 = Math.min(600, T.w - 24), tx = T.x + (T.w - tw2) / 2, ty = T.y + T.h - 110, cx = tx + tw2 / 2;
    const tf = fitText(S.toast, tw2 - 40, 80, grow(z, 26, 0.4), 14);
    ctx.fillStyle = 'rgba(10,6,6,0.9)'; rr(ctx, tx, ty, tw2, 90, 20); ctx.fill();
    tf.lines.forEach((ln, i) => text(ctx, ln, cx, ty + 45 - ((tf.lines.length - 1) * tf.line) / 2 + i * tf.line + tf.size * 0.34, tf.size, th.ink, { weight: 600 }));
  }
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'setup': case 'learn': case 'lesson': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
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

export { THEMES };
