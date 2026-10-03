// Everything drawn each frame. Reads state, changes nothing.
import { W, H, UI, DISPLAY, themeById, text, rr, panel, button, floor, star, icon, drawParticles, alpha, clamp01, ease, easeInOut } from './art.js';
import { TEXT_SCALES, wrap, tw } from './ui.js';
import { STR as X } from './content.js';
import { hudOf, playLayout, autoLayout, sandboxLayout, SB_TOOLS } from './layout.js';
import { THINK_STEPS } from './screens.js';
import { boardGeo, drawPad, drawRings, drawDots, drawMarks, linePath, powder, patternSeq, drawPattern, toScreen } from './boardview.js';
import { drawArt } from './arts.js';
import { puzzleById, orderOf } from './puzzles.js';
import { progress, tipPoint, wrappedDots } from './play.js';
import { exits, headGate } from './trail.js';
import { curves as sbCurves, modeLabel, drawnCount } from './sandbox.js';
import { optCurve } from './play.js';
import { bezPoint } from './board.js';

const theme = (S) => themeById(S.themeId);

export function fitText(str, w, h, start, min = 16, lh = 1.28, wf = 1) {
  let size = start;
  for (; size > min; size -= 2) {
    const lines = wrap(str, size * wf, w);
    if (lines.length * size * lh <= h) return { lines, size, line: size * lh };
  }
  return { lines: wrap(str, min * wf, w), size: min, line: min * lh };
}
const fitOne = (str, w, start, min = 14) => { let s = start; while (s > min && tw(str, s) > w) s -= 1; return s; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const th = theme(S);
  const { region, layout } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18); ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of layout.items) {
    const b = it.b, top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, th.accent, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, 'rgba(244,239,228,0.93)', { weight: 500, align: center ? 'center' : 'left' });
    } else if (b.t === 'img') drawArt(ctx, S, b.name, ox, top, it.w, b.h, b, th);
    else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, th.ink, { weight: 700 });
        else button(ctx, th, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    } else if (b.t === 'grid') for (const bt of it.btns) drawPatternCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
  }
  ctx.restore();
  if (layout.height > region.h) {
    const track = region.h - 8, tH = Math.max(48, (region.h / layout.height) * track);
    const ty = region.y + 4 + (scroll / (layout.height - region.h)) * (track - tH);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = alpha('#e8c46a', 0.75); rr(ctx, region.x + region.w + 8, ty, 6, tH, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  const th = theme(S);
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, 'rgba(244,239,228,0.8)', { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, th, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 2 : 0), 30, th.ink);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 2 : 0), Math.min(f.size, fitOne(f.label, f.rect.w - 80, f.size, 14)), th.ink, { weight: 700 });
    } else button(ctx, th, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// a pattern tile: the finished line once drawn, dots and marks until then
function drawPatternCell(ctx, S, r, c, pressed) {
  const th = theme(S);
  const y = r.y + (pressed ? 2 : 0);
  const z = TEXT_SCALES[S.textIdx] ?? 1;
  const puz = puzzleById(c.pid);
  ctx.save();
  if (c.locked) ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, r.x, y + 4, r.w, r.h, 16); ctx.fill();
  ctx.fillStyle = c.stars ? th.btnOn[0] : th.btn[0]; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.5; rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
  const fs = Math.min(22 * (1 + (z - 1) * 0.5), 34);
  const area = { x: r.x + 8, y: y + 8, w: r.w - 16, h: r.h - fs * 2.2 - 8 };
  const g = boardGeo(puz.B, area, 6);
  if (c.stars) { drawPattern(ctx, th, g, patternSeq(puz.B, puz.sol), 1, Math.max(1.6, g.S * 0.07), 0.5); drawDots(ctx, th, puz.B, g, null); }
  else { drawRings(ctx, th, puz.B, g); drawDots(ctx, th, puz.B, g, null); }
  text(ctx, c.label, r.x + 14, y + 10 + fs * 0.9, fs, th.ink, { weight: 800, align: 'left' });
  if (c.stars) for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * fs * 1.15, y + r.h - fs * 0.8, fs * 0.42, i < c.stars ? th.accent : 'rgba(255,255,255,0.2)');
  else if (c.open) text(ctx, X.inProgress, r.x + r.w / 2, y + r.h - fs * 0.4, fs * 0.7, th.accent, { weight: 700 });
  if (c.locked) icon(ctx, 'lock', r.x + r.w - 26, y + 26, 26, 'rgba(244,239,228,0.9)');
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
function drawTitleScene(ctx, S) {
  const th = theme(S);
  const g0 = ctx.createLinearGradient(0, 100, 0, 300);
  g0.addColorStop(0, '#ffffff'); g0.addColorStop(0.5, th.accent); g0.addColorStop(1, '#a8884a');
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
  ctx.font = `800 112px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillStyle = g0; ctx.fillText(X.title, 360, 172);
  ctx.restore();
  text(ctx, X.tagline, 360, 232, 28, 'rgba(244,239,228,0.82)', { weight: 600 });
  const A = S.attract;
  if (!A) return;
  const area = { x: 110, y: 262, w: 500, h: 360 };
  const g = boardGeo(A.puz.B, area, 10);
  const cyc = 9, tt = S.t % cyc;
  const k = clamp01(tt / 5.2);
  drawRings(ctx, th, A.puz.B, g);
  const fin = clamp01((tt - 5.2) / 1.2);
  const lit = new Float32Array(A.puz.B.dots.length).fill(fin * (0.5 + 0.3 * Math.sin(S.t * 2)));
  drawPattern(ctx, th, g, A.seq, easeInOut(k), Math.max(3, g.S * 0.06), 1 + fin * 0.4);
  const fade = tt > 8 ? 1 - clamp01((tt - 8)) : 1; void fade;
  drawDots(ctx, th, A.puz.B, g, new Float32Array(A.puz.B.dots.length).fill(k), lit);
}

function drawTitle(ctx, S, ui) {
  floor(ctx, theme(S), S.t, 560);
  drawTitleScene(ctx, S);
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
}

function drawDocScreen(ctx, S, ui) {
  const th = theme(S);
  floor(ctx, th, S.t);
  if (ui.panel) panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  if (ui.nav) { drawFixed(ctx, S, [ui.nav.prev, ui.nav.next]); text(ctx, ui.nav.label, 360, 1500, 26, 'rgba(244,239,228,0.75)', { weight: 600 }); }
}

function drawOverlay(ctx, S, ui) {
  const th = theme(S);
  ctx.fillStyle = `rgba(6,6,8,${(S.overlay === 'end' ? 0.3 : 0.62) * clamp01(S.ovT / 0.25)})`; ctx.fillRect(0, 0, W, H);
  const k = ease(clamp01(S.ovT / 0.3));
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-W / 2, -H / 2);
  ctx.globalAlpha = k;
  panel(ctx, th, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function hudBar(ctx, S, title, sub, auto, noPause) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], Hd = hudOf(z);
  button(ctx, th, Hd.back, [], 'normal', { pressed: S.press && S.press.id === 'hud:back' && S.press.active });
  icon(ctx, 'back', Hd.back.x + Hd.back.w / 2, Hd.back.y + Hd.back.h / 2, 32 + 10 * Hd.k, th.ink);
  if (!auto && !noPause) {
    button(ctx, th, Hd.pause, [], 'normal', { pressed: S.press && S.press.id === 'hud:pause' && S.press.active });
    icon(ctx, 'pause', Hd.pause.x + Hd.pause.w / 2, Hd.pause.y + Hd.pause.h / 2, 32 + 10 * Hd.k, th.ink);
  }
  const r = Hd.name;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  const subS = 22 * Math.min(z, 1.5);
  const fs = fitOne(title, r.w - 24, Math.min(34 * Math.min(z, 1.7), r.h - subS - 14), 16);
  const total = fs + subS + 6, top = r.y + (r.h - total) / 2;
  text(ctx, title, r.x + r.w / 2, top + fs * 0.86, fs, th.ink, { weight: 800, font: DISPLAY });
  text(ctx, sub, r.x + r.w / 2, top + fs + 6 + subS * 0.82, fitOne(sub, r.w - 24, subS, 12), th.accent, { weight: 600 });
}

function drawFocusBar(ctx, S, M, lay) {
  const th = theme(S), r = lay.focus, z = TEXT_SCALES[S.textIdx];
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1.5; rr(ctx, r.x, r.y, r.w, r.h, 18); ctx.stroke();
  const p = progress(M);
  const l1 = `Arcs ${p.arcs} / ${p.nArc}`, l2 = `Dots wrapped ${p.wrapped} / ${p.dots}`;
  const innerW = r.w - 36, half = (r.h - 20) / 2;
  const a = fitText(l1, innerW, half, 30 * z, 18, 1.2), b = fitText(l2, innerW, half, 30 * z, 18, 1.2);
  const size = Math.min(a.size, b.size);
  const A = fitText(l1, innerW, half, size, 16, 1.2), B = fitText(l2, innerW, half, size, 16, 1.2);
  const total = A.lines.length * A.line + B.lines.length * B.line;
  let y = r.y + (r.h - total) / 2 + size * 0.88;
  for (const ln of A.lines) { text(ctx, ln, r.x + 18, y, size, th.ink, { weight: 700, align: 'left' }); y += A.line; }
  for (const ln of B.lines) { text(ctx, ln, r.x + 18, y, size, th.accent, { weight: 700, align: 'left' }); y += B.line; }
  // thin progress bar along the bottom edge
  ctx.fillStyle = alpha(th.accent, 0.5); rr(ctx, r.x + 12, r.y + r.h - 7, (r.w - 24) * clamp01(p.arcs / p.nArc), 4, 2); ctx.fill();
}

function drawStatus(ctx, S, rect, head, body, o = {}) {
  const th = theme(S);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, rect.x, rect.y, rect.w, rect.h, 20); ctx.fill();
  ctx.strokeStyle = o.hint ? th.hint : 'rgba(255,255,255,0.12)'; ctx.lineWidth = o.hint ? 2.5 : 1.5; rr(ctx, rect.x, rect.y, rect.w, rect.h, 20); ctx.stroke();
  const z = TEXT_SCALES[S.textIdx];
  const innerW = rect.w - 40 - (o.rightReserve ?? 0), innerH = rect.h - 24;
  const hs = head ? fitText(head, innerW, innerH * (body ? 0.4 : 1), 32 * z, 18, 1.2, 1.12) : null;
  const rest = innerH - (hs ? hs.lines.length * hs.line : 0);
  const bs = body ? fitText(body, innerW, rest, 26 * z, 16, 1.25, 1.04) : null;
  const total = (hs ? hs.lines.length * hs.line : 0) + (bs ? bs.lines.length * bs.line : 0);
  let y = rect.y + 12 + Math.max(0, (innerH - total) / 2) + (hs ? hs.size : bs.size) * 0.86;
  if (hs) for (const ln of hs.lines) { text(ctx, ln, rect.x + 20, y, hs.size, o.headColor ?? th.accent, { weight: 800, align: 'left' }); y += hs.line; }
  if (bs) for (const ln of bs.lines) { text(ctx, ln, rect.x + 20, y, bs.size, 'rgba(244,239,228,0.92)', { weight: 500, align: 'left' }); y += bs.line; }
}

const TOOL_ICON = { undo: 'undo', clear: 'clear', think: 'hint', guide: 'shield', sbDraw: 'draw', sbMirror: 'mirror', sbGrid: 'grid', sbWeave: 'weave', sbUndo: 'undo', sbClear: 'clear' };
function drawToolbar(ctx, S, lay, labels, states) {
  const th = theme(S), z = TEXT_SCALES[S.textIdx], lf = Math.min(22 * z, 44);
  for (const r of lay.tools) {
    const id = r.id, st = states[id] ?? {};
    const pressed = S.press && S.press.id === `tool:${id}` && S.press.active;
    button(ctx, th, r, [], st.on ? 'on' : 'normal', { disabled: st.disabled, pressed });
    const label = labels[id];
    const size = fitOne(label, r.w - 14, lf, 14);
    const iconS = Math.min(r.h - size * 1.2 - 26, 30 + 16 * (z - 1)), py = pressed ? 2 : 0;
    icon(ctx, st.icon ?? TOOL_ICON[id], r.x + r.w / 2, r.y + 14 + iconS / 2 + py, iconS, th.ink);
    text(ctx, label, r.x + r.w / 2, r.y + r.h - 14 + py, size, th.ink, { weight: 700 });
  }
}

// the board with the player's line, the tip, hints and the finish
function seqOf(M) {
  const seq = [];
  const T = M.T;
  for (let i = 0; i < T.arcs.length; i++) seq.push({ c: M.shape.get(T.arcs[i]) ?? optCurve(M, { arc: T.arcs[i], dir: 0, gate: -1, s: 0 }), dir: T.dirs[i] });
  if (M.cur) seq.push({ c: M.shape.get(M.cur.arc) ?? M.cur.c, dir: M.cur.dir });
  return seq;
}

function drawBoardPlay(ctx, S, M, area, o = {}) {
  const th = theme(S), B = M.B, g = boardGeo(B, area, 30);
  drawPad(ctx, th, B, g);
  drawRings(ctx, th, B, g);
  const sc = S.shot ? 1 : 1;
  const w = Math.max(3.2, g.S * 0.062) * sc;
  const R = M.reveal;
  const rk = R ? ease(clamp01(R.t / 1.2)) : 0;
  drawMarks(ctx, th, B, g, M.puz.marks, R ? 0.35 : 1);
  const seq = seqOf(M);
  // hint: the planned stretch pulses behind the line
  if (M.hint && M.hint.seg && M.hint.seg.length && !R) {
    const pulse = 0.55 + 0.45 * Math.sin(S.t * 5);
    const hs = M.hint.seg.map((q) => ({ c: q.c, dir: q.dir }));
    linePath(ctx, g, hs, 0, hs.length);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = alpha(th.hint, 0.22 * pulse + 0.1); ctx.lineWidth = w * 3.4; ctx.stroke();
    ctx.strokeStyle = alpha(th.hint, 0.85); ctx.lineWidth = w * 1.1; ctx.setLineDash([w * 1.6, w * 1.6]); ctx.lineDashOffset = -S.t * 18; ctx.stroke(); ctx.setLineDash([]);
  }
  // ghost options at the tip
  if (!R && !M.fail && M.T.arcs.length && !M.cur && (M.held || o.ghost)) {
    const opts = exits(M.T).filter((q) => q.valid && !q.closing);
    for (const q of opts) {
      const c = optCurve(M, q);
      linePath(ctx, g, [{ c, dir: 0 }], 0, 1);
      ctx.lineCap = 'round'; ctx.strokeStyle = alpha(th.powder, 0.22); ctx.lineWidth = w * 0.9; ctx.setLineDash([w * 1.2, w * 1.8]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // the line
  const len = Math.min(M.disp, seq.length);
  if (len > 0.001) {
    linePath(ctx, g, seq, 0, R ? seq.length : len);
    powder(ctx, th, w * (1 + 0.5 * rk), 1 + 0.6 * rk, 1);
    if (R) { // a bright ripple travels once round the closed line
      const f = clamp01((R.t - 0.2) / 2.2);
      if (f > 0 && f < 1) { const n = seq.length; linePath(ctx, g, seq, Math.max(0, f * n - n * 0.1), f * n); ctx.strokeStyle = alpha('#ffffff', 0.9); ctx.lineWidth = w * 1.1; ctx.lineCap = 'round'; ctx.stroke(); }
    }
  }
  // dots
  let lit = null;
  if (R) {
    lit = new Float32Array(B.dots.length);
    const n = B.nArc;
    for (let i = 0; i < lit.length; i++) { const tc = 0.2 + 2.2 * (Math.max(0, M.order[i]) / n); const d = R.t - tc; lit[i] = d < 0 ? 0 : clamp01(0.55 + 0.45 * Math.max(0, 1 - d / 0.8)); }
  }
  drawDots(ctx, th, B, g, M.wrap, lit);
  // the glowing tip
  if (!R && (M.T.arcs.length || M.cur) && !M.fail) {
    const tp = M.cur ? bezPoint(M.shape.get(M.cur.arc) ? (M.cur.dir === 1 ? rev(M.shape.get(M.cur.arc)) : M.shape.get(M.cur.arc)) : M.cur.c, M.cur.p) : tipPoint(M);
    const [x, y] = toScreen(g, tp[0], tp[1]);
    const pr = 1 + 0.18 * Math.sin(S.t * 6);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, w * 3.4 * pr);
    rg.addColorStop(0, alpha(th.hint, 0.65)); rg.addColorStop(1, alpha(th.hint, 0));
    ctx.fillStyle = rg; ctx.fillRect(x - w * 4, y - w * 4, w * 8, w * 8);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, w * 0.75, 0, 7); ctx.fill();
  }
  // local rings: wrong turns and where to look
  for (const f of M.flashes) {
    const G = f.gate >= 0 ? B.gates[f.gate] : null;
    if (!G) continue;
    const [x, y] = toScreen(g, G.x, G.y);
    const k = f.t / f.life, col = f.kind === 'bad' ? th.bad : th.hint;
    ctx.strokeStyle = alpha(col, 1 - k); ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, g.S * (0.18 + 0.35 * ease(k)), 0, 7); ctx.stroke();
    ctx.strokeStyle = alpha(col, (1 - k) * 0.5); ctx.beginPath(); ctx.arc(x, y, g.S * (0.1 + 0.2 * k), 0, 7); ctx.stroke();
  }
  if (M.fail) {
    const G = B.gates[M.fail.gate], [x, y] = toScreen(g, G.x, G.y), k = clamp01(M.fail.t / 1.4);
    ctx.strokeStyle = alpha(th.bad, 0.9 * (1 - k * 0.4)); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, g.S * (0.25 + 0.15 * Math.sin(S.t * 14)), 0, 7); ctx.stroke();
  }
  return g;
}
const rev = (c) => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];

function drawPlay(ctx, S) {
  const th = theme(S), M = S.match, z = TEXT_SCALES[S.textIdx], lay = playLayout(z);
  floor(ctx, th, S.t, 760);
  hudBar(ctx, S, M.lesson !== null ? `Lesson ${M.lesson + 1}` : M.daily ? X.dailyHead : `Pattern ${orderOf(M.puz.id)}`, `${M.puz.name} · ${M.puz.dots} dots${M.puz.markCount ? ` · ${M.puz.markCount} marks` : ''}`, false);
  drawFocusBar(ctx, S, M, lay);
  drawBoardPlay(ctx, S, M, lay.area, { ghost: S.kbd });
  let head = '', body = '', o = {};
  if (M.reveal) { head = X.endHead; body = ''; }
  else if (M.hint) { head = M.hint.head; body = z >= 2 && M.hint.seg && M.hint.seg.length ? '' : M.hint.why; o = { hint: true, rightReserve: M.hint.seg && M.hint.seg.length ? 210 * Math.min(1, z / 1.5) : 0 }; }
  else if (M.toast) { head = M.toast; o = { headColor: th.hint }; }
  else if (M.lessonTask) head = M.lessonTask;
  else head = M.T.arcs.length ? X.tipTip : X.tipDraw;
  drawStatus(ctx, S, lay.status, head, body, o);
  if (M.hint && M.hint.seg && M.hint.seg.length && !M.reveal) {
    const pr = S.press && S.press.id === 'hud:apply' && S.press.active;
    button(ctx, th, lay.applyBtn, [z >= 2 ? X.why : X.hintApply], 'primary', { size: Math.min(26 * Math.min(z, 1.6), 38), pressed: pr });
  }
  drawToolbar(ctx, S, lay, { undo: X.undo, clear: M.clearArm > 0 ? 'Sure?' : X.clear, think: X.think, guide: X.guide }, {
    undo: { disabled: !M.T.arcs.length || Boolean(M.reveal) }, clear: { on: M.clearArm > 0 }, think: {}, guide: { on: S.check },
  });
  if (M.parts.length) drawParticles(ctx, M.parts);
}

function drawAuto(ctx, S) {
  const th = theme(S), M = S.match, a = S.auto, z = TEXT_SCALES[S.textIdx], lay = autoLayout(z);
  floor(ctx, th, S.t, 760);
  hudBar(ctx, S, X.autoSession, `${M.puz.name} · ${M.puz.dots} dots`, true);
  const fr = lay.focus;
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, fr.x, fr.y, fr.w, fr.h, 18); ctx.fill();
  const p = progress(M);
  const fs = fitText(`Arcs ${p.arcs} / ${p.nArc}  ·  Dots wrapped ${p.wrapped} / ${p.dots}`, fr.w - 36, fr.h - 14, 28 * z, 16, 1.2);
  let yy = fr.y + (fr.h - fs.lines.length * fs.line) / 2 + fs.size * 0.88;
  for (const ln of fs.lines) { text(ctx, ln, fr.x + 18, yy, fs.size, th.ink, { weight: 700, align: 'left' }); yy += fs.line; }
  const showHint = a.phase === 'reveal';
  if (showHint && a.hint) M.hint = a.hint; else if (!showHint) M.hint = null;
  drawBoardPlay(ctx, S, M, lay.area, { ghost: a.phase === 'reveal' });
  let head = '', body = '';
  if (M.reveal) { head = X.endHead; body = 'The line is closed around every dot.'; }
  else if (a.paused) head = X.pauseTitle;
  else if (a.phase === 'think') head = `${X.autoThink} ${Math.max(0, Math.ceil(THINK_STEPS[S.thinkIdx] - a.t))}`;
  else if (a.phase === 'reveal' || a.phase === 'act') { head = a.note.head; body = a.note.why; }
  else head = M.puz.name;
  drawStatus(ctx, S, lay.status, head, body, {});
  if (a.phase === 'think' && !a.paused) {
    const frac = clamp01(a.t / THINK_STEPS[S.thinkIdx]);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 14, lay.status.w - 48, 7, 3.5); ctx.fill();
    ctx.fillStyle = th.accent; rr(ctx, lay.status.x + 24, lay.status.y + lay.status.h - 14, (lay.status.w - 48) * frac, 7, 3.5); ctx.fill();
  }
  const sm = z >= 2 ? 0.7 : 1, pressed = (id) => S.press && S.press.id === `auto:${id}` && S.press.active;
  button(ctx, th, lay.slower, [X.autoSlower], 'normal', { size: 22 * Math.min(z, 1.5) * sm, disabled: S.thinkIdx === 0, pressed: pressed('slower') });
  button(ctx, th, lay.pause, [a.paused ? X.autoPlay : X.autoPause], 'primary', { size: 30 * Math.min(z, 1.6) * sm, pressed: pressed('pause') });
  button(ctx, th, lay.faster, [X.autoFaster], 'normal', { size: 22 * Math.min(z, 1.5) * sm, disabled: S.thinkIdx === THINK_STEPS.length - 1, pressed: pressed('faster') });
  text(ctx, `${X.thinkTime}: ${THINK_STEPS[S.thinkIdx]}${X.seconds}`, 360, lay.labelY, 20 * Math.min(z, 1.4), 'rgba(244,239,228,0.7)', { weight: 600 });
}

function drawSandbox(ctx, S) {
  const th = theme(S), SB = S.sb, z = TEXT_SCALES[S.textIdx], lay = sandboxLayout(z);
  floor(ctx, th, S.t, 700);
  hudBar(ctx, S, X.sandboxBtn, `${SB.B.dots.length} dots · Mirror ${modeLabel(SB)}`, false);
  const g = boardGeo(SB.B, lay.area, 30);
  drawPad(ctx, th, SB.B, g); drawRings(ctx, th, SB.B, g);
  const w = Math.max(3.2, g.S * 0.062);
  const cs = sbCurves(SB);
  // arcs grow in as they are born
  const seq = cs.map((c) => ({ c: c.c, dir: 0 })), grow = cs.map((c) => clamp01((SB.t - c.born) / 0.25));
  const full = [], part = [];
  cs.forEach((c, i) => { if (grow[i] >= 1) full.push(seq[i]); else if (grow[i] > 0) part.push([seq[i], grow[i]]); });
  if (full.length) { linePath(ctx, g, full, 0, full.length); powder(ctx, th, w, 1); }
  for (const [s, k] of part) { linePath(ctx, g, [s], 0, k); powder(ctx, th, w, 1); }
  const wrapArr = new Float32Array(SB.B.dots.length);
  for (let i = 0; i < wrapArr.length; i++) { let n = 0; for (let k = 0; k < SB.B.D; k++) if (SB.drawn[i * SB.B.D + k]) n++; wrapArr[i] = n / SB.B.D; }
  drawDots(ctx, th, SB.B, g, wrapArr);
  const full2 = SB.wrapped === SB.B.dots.length;
  drawStatus(ctx, S, lay.status, full2 ? 'Every dot is wrapped.' : X.sbHint, `Arcs ${drawnCount(SB)} / ${SB.B.nArc} · Dots wrapped ${SB.wrapped} / ${SB.B.dots.length}`, {});
  drawToolbar(ctx, S, lay, { sbDraw: SB.erase ? X.sbErase : X.sbDraw, sbMirror: X.sbMirror, sbGrid: X.sbGrid, sbWeave: X.sbWeave, sbUndo: X.sbUndo, sbClear: S.sbClearArm > 0 ? 'Sure?' : X.sbClear }, {
    sbDraw: { on: SB.erase, icon: SB.erase ? 'erase' : 'draw' }, sbMirror: { on: SB.modeIdx > 0, disabled: SB.modes.length < 2 }, sbGrid: {}, sbWeave: {}, sbUndo: { disabled: !SB.undo.length }, sbClear: { on: S.sbClearArm > 0 },
  });
  void SB_TOOLS;
}

export function render(ctx, S, ui) {
  ctx.textBaseline = 'alphabetic';
  switch (S.scene) {
    case 'title': drawTitle(ctx, S, ui); break;
    case 'chapters': case 'patterns': case 'learn': case 'lesson': case 'howto': case 'rules': case 'about': case 'settings': drawDocScreen(ctx, S, ui); break;
    case 'daily': case 'demo-limit':
      floor(ctx, theme(S), S.t);
      panel(ctx, theme(S), ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
      drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
      drawFixed(ctx, S, ui.fixed);
      break;
    case 'play': if (!S.match) floor(ctx, theme(S), S.t); else drawPlay(ctx, S); break;
    case 'auto': if (!S.match || !S.auto) floor(ctx, theme(S), S.t); else drawAuto(ctx, S); break;
    case 'sandbox': if (!S.sb) floor(ctx, theme(S), S.t); else drawSandbox(ctx, S); break;
    default: floor(ctx, theme(S), S.t);
  }
  if (S.overlay) drawOverlay(ctx, S, ui);
}
export { headGate, wrappedDots };
