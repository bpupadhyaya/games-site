// Everything drawn each frame. Reads state, changes nothing (except the texture bake queue, which is a cache).
import {
  UI, DISPLAY, INK, INK2, INK3, CARD, CARD2, EDGE, VERM, INDIGO, GOLD, SAKURA, MOSS, text, rr, panel, button, desk, star, icon,
  drawParticles, clamp01, ease, easeIO, backOut,
} from './art.js';
import {
  makeCam, project, drawFaces, drawDecals, getPaper, peekPaper, bakeStep, PAPERS,
} from './paperview.js';
import {
  flatFaces, foldFaces, foldMapper, turnFaces, planFold, commitFold, newSheet, bounds, side, reflectPt, toward, lastFold,
} from './paper.js';
import { MODELS, stateAt, finalState } from './models.js';
import { tr, RULES } from './content.js';
import { TEXT_SCALES, wrap } from './ui.js';
import { layout, host } from './layout.js';
import { drawLockup } from './brand.js';
import { rectsFor, camOf, sceneOf, stepOf, textScaleCap } from './playcommon.js';
import { THINK_STEPS, rec, modelLocked, paperOf } from './screens.js';

const finalCache = new Map();
const finalOf = (m) => { let f = finalCache.get(m.id); if (!f) { const st = finalState(m); f = { st, b: bounds(st.polys) }; finalCache.set(m.id, f); } return f; };
const stateCache = new Map();
const stateOf = (m, k) => { const key = `${m.id}:${k}`; let s = stateCache.get(key); if (!s) { s = stateAt(m, k); stateCache.set(key, s); } return s; };

// ----------------------------------------------------------------------------------------- documents
function drawDocBlocks(ctx, S, ui, scroll) {
  const { region, layout: lay } = ui;
  ctx.save();
  rr(ctx, region.x - 6, region.y - 4, region.w + 12, region.h + 8, 18);
  ctx.clip();
  const ox = region.x, oy = region.y - scroll + (ui.offY || 0);
  for (const it of lay.items) {
    const b = it.b, top = oy + it.y;
    if (top > region.y + region.h + 20 || top + it.h < region.y - 20) continue;
    if (b.t === 'h') {
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], ox + it.w / 2, top + i * it.line + it.size, it.size, VERM, { font: DISPLAY, weight: 800 });
    } else if (b.t === 'p') {
      const center = b.center || b.align === 'center';
      for (let i = 0; i < it.lines.length; i++) text(ctx, it.lines[i], center ? ox + it.w / 2 : ox, top + i * it.line + it.size * 0.98, it.size, INK2, { weight: 500, align: center ? 'center' : 'left' });
    } else if (b.t === 'img') {
      if (b.name === 'lockup') {
        const lw = b.hitW ?? 250, lh = Math.round(lw * 327 / 1200), cy = top + it.h / 2 - 2, pr = S.press && S.press.id === 'arcforge' && S.press.active;
        ctx.save();
        const g = ctx.createLinearGradient(ox + it.w / 2 - lw / 2 - 12, 0, ox + it.w / 2 + lw / 2 + 12, 0);
        g.addColorStop(0, '#1a1148'); g.addColorStop(0.5, '#26268f'); g.addColorStop(1, '#0f4a70');
        ctx.fillStyle = g; rr(ctx, ox + it.w / 2 - lw / 2 - 12, cy - lh / 2 - 6, lw + 24, lh + 12, 14); ctx.fill();
        ctx.restore();
        drawLockup(ctx, ox + it.w / 2, cy - lh / 2, lw, pr ? 0.5 : 0.95);
      } else { const aw = Math.min(it.w, 640); drawArt(ctx, b.name, ox + (it.w - aw) / 2, top, aw, b.h, S, b); }
    } else if (b.t === 'btn') {
      const bt = it.btns[0];
      button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, it.lines, b.kind ?? 'normal', { size: it.size, line: it.line, sub: it.sub, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
    } else if (b.t === 'row') {
      for (const bt of it.btns) {
        if (bt.id == null) text(ctx, bt.label, ox + bt.x + bt.w / 2, oy + bt.y + bt.h / 2 + it.size * 0.34, it.size, INK, { weight: 700 });
        else button(ctx, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.lines, bt.kind ?? 'normal', { size: it.size, line: it.line, disabled: bt.disabled, pressed: S.press && S.press.id === bt.id && S.press.active });
      }
    } else if (b.t === 'grid') {
      for (const bt of it.btns) drawCell(ctx, S, { x: ox + bt.x, y: oy + bt.y, w: bt.w, h: bt.h }, bt.cell, S.press && S.press.id === bt.id && S.press.active);
    }
  }
  ctx.restore();
  if (lay.height > region.h) {
    const track = region.h - 8, th = Math.max(48, (region.h / lay.height) * track);
    const ty = region.y + 4 + (scroll / (lay.height - region.h)) * (track - th);
    ctx.fillStyle = 'rgba(60,40,20,0.1)'; rr(ctx, region.x + region.w + 8, region.y + 4, 6, track, 3); ctx.fill();
    ctx.fillStyle = 'rgba(217,72,43,0.7)'; rr(ctx, region.x + region.w + 8, ty, 6, th, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, INK2, { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 3 : 0), 30, INK);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 3 : 0), f.size, INK, { weight: 700 });
    } else button(ctx, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

// A thumbnail of a finished model, drawn with the real paper renderer.
function drawThumb(ctx, m, x, y, w, h, paperId, o = {}) {
  const f = finalOf(m);
  const paper = o.sync ? getPaper(paperId, m.back) : peekPaper(paperId, m.back);
  const ex = m.decals?.length && o.decals ? (m.reveal ? m.reveal : f.b) : f.b;
  const b = o.decals && m.reveal ? m.reveal : f.b;
  const S = Math.min(w / (b.w + 0.14), h / (b.h * 0.95 + 0.14));
  const cam = makeCam({ x: x + w / 2, y: y + h / 2, S, cx: b.cx, cy: b.cy, tilt: 0.2 });
  drawFaces(ctx, flatFaces(f.st), cam, paper, f.st.creases, { noShadow: false });
  if (o.decals) drawDecals(ctx, m.decals, cam, 1);
  void ex;
}

function drawCell(ctx, S, r, c, pressed) {
  const y = r.y + (pressed ? 3 : 0), z = TEXT_SCALES[S.textIdx] ?? 1;
  ctx.save();
  if (c.model) {
    const locked = c.state === 'locked';
    if (locked) ctx.globalAlpha = 0.6;
    ctx.shadowColor = 'rgba(70,45,20,0.22)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.fillStyle = c.state === 'done' ? CARD : CARD2; rr(ctx, r.x, y, r.w, r.h, 18); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = c.state === 'done' ? 'rgba(199,154,46,0.9)' : EDGE; ctx.lineWidth = 2; rr(ctx, r.x, y, r.w, r.h, 18); ctx.stroke();
    const labelH = Math.min(30 * (1 + (z - 1) * 0.45), r.w / 5) * 1.0;
    const th = r.h - labelH - 44;
    if (!locked) drawThumb(ctx, c.model, r.x + 8, y + 8, r.w - 16, th, c.model.paper);
    else icon(ctx, 'lock', r.x + r.w / 2, y + 8 + th / 2, Math.min(60, r.w * 0.34), INK3);
    text(ctx, c.label, r.x + r.w / 2, y + r.h - 40 - (z > 1 ? 4 : 0) + labelH * 0.2, labelH * 0.78, INK, { weight: 700 });
    for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * Math.min(28, r.w / 5), y + r.h - 18, Math.min(11, r.w / 12), i < c.stars ? '#e8b23a' : 'rgba(43,37,48,0.14)', i < c.stars ? '#b8821d' : null);
  } else if (c.paper) {
    const sel = c.state === 'sel';
    const p = peekPaper(c.paper);
    ctx.shadowColor = 'rgba(70,45,20,0.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
    ctx.fillStyle = CARD; rr(ctx, r.x, y, r.w, r.h, 16); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save(); rr(ctx, r.x + 6, y + 6, r.w - 12, r.h - 12 - 24 * Math.min(z, 1.4), 12); ctx.clip();
    if (p.front) ctx.drawImage(p.front, r.x + 6, y + 6, r.w - 12, r.w - 12); else { ctx.fillStyle = p.base; ctx.fillRect(r.x, y, r.w, r.h); }
    ctx.restore();
    ctx.strokeStyle = sel ? VERM : EDGE; ctx.lineWidth = sel ? 4 : 2; rr(ctx, r.x, y, r.w, r.h, 16); ctx.stroke();
    text(ctx, c.label, r.x + r.w / 2, y + r.h - 8, Math.min(18 * (1 + (z - 1) * 0.3), r.w / 4.5), INK, { weight: 700 });
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
function artPaperCam(x, y, w, h, b, tilt = 0.28) {
  const S = Math.min(w / (b.w + 0.3), h / (b.h * 0.95 + 0.3));
  return makeCam({ x: x + w / 2, y: y + h / 2, S, cx: b.cx, cy: b.cy, tilt });
}
function dashedLine(ctx, cam, plan, color, w, mountain) {
  const { a, n } = plan.spec, t = [-n[1], n[0]], len = 0.9;
  const p0 = project(cam, [a[0] - t[0] * len, a[1] - t[1] * len, 0]), p1 = project(cam, [a[0] + t[0] * len, a[1] + t[1] * len, 0]);
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.setLineDash(mountain ? [16, 7, 3, 7] : [14, 10]);
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.restore();
}
function arrow(ctx, p0, p1, bend, color, w) {
  const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2, dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / l) * l * bend, cy = my + (dx / l) * l * bend;
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(cx, cy, p1[0], p1[1]); ctx.stroke();
  const ang = Math.atan2(p1[1] - cy, p1[0] - cx), hs = w * 3.6;
  ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p1[0] - Math.cos(ang - 0.45) * hs, p1[1] - Math.sin(ang - 0.45) * hs); ctx.lineTo(p1[0] - Math.cos(ang + 0.45) * hs, p1[1] - Math.sin(ang + 0.45) * hs); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function finger(ctx, x, y, s, a = 0.5) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(60,40,30,0.85)';
  ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}

function drawArt(ctx, name, x, y, w, h, S, b) {
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(214,198,163,0.35)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(199,154,46,0.45)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const kite = MODELS[0], blank = newSheet(0), pW = getPaper('waves');
  const draw = (faces, cam, st, mode) => drawFaces(ctx, faces, cam, pW, st.creases, mode);
  const sheetB = { w: 1, h: 1, cx: 0, cy: 0 };
  if (name === 'logo') {
    const m = MODELS[0], f = finalOf(m);
    drawThumb(ctx, m, x + 20, y + 10, w * 0.3, h - 20, m.paper, { sync: true });
    drawThumb(ctx, MODELS[3], x + w * 0.35, y + 10, w * 0.3, h - 20, MODELS[3].paper, { sync: true, decals: true });
    drawThumb(ctx, MODELS[5], x + w * 0.68, y + 10, w * 0.3, h - 20, MODELS[5].paper, { sync: true });
    void f;
  } else if (name === 'sheet' || name === 'valley' || name === 'mountain' || name === 'grab' || name === 'neat' || name === 'hint') {
    const mountain = name === 'mountain';
    const st = blank, spec = toward([-0.5, 0.5], [0.5, -0.5], { kind: mountain ? 'mountain' : 'valley' });
    const pl = planFold(st, spec); pl.creasesAll = st.creases;
    const th = name === 'sheet' ? 2.1 : name === 'valley' ? 1.5 : mountain ? 1.5 : name === 'hint' ? 0.5 + 0.5 * Math.sin(t * 2) + 0.7 : 0;
    const cam = artPaperCam(x, y + 8, w, h - 16, sheetB, 0.32);
    draw(foldFaces(st, pl, th), cam, st, { fold: true, theta: th, kind: spec.kind });
    dashedLine(ctx, cam, pl, INDIGO, 3, mountain);
    if (name === 'grab' || name === 'neat' || name === 'valley' || name === 'hint') {
      const hp = project(cam, foldMapper(pl, th)(pl.handle)), tp = project(cam, [pl.target[0], pl.target[1], 0]);
      if (name !== 'neat') arrow(ctx, hp, tp, 0.25, VERM, 4);
      ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = VERM; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tp[0], tp[1], 24, 0, 6.2832); ctx.stroke(); ctx.restore();
      if (name !== 'neat') { const g = ctx.createRadialGradient(hp[0], hp[1], 2, hp[0], hp[1], 34); g.addColorStop(0, 'rgba(217,72,43,0.9)'); g.addColorStop(1, 'rgba(217,72,43,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp[0], hp[1], 34, 0, 6.2832); ctx.fill(); finger(ctx, hp[0] + 4, hp[1] + 12, 20); }
    }
    if (name === 'neat') {
      const tp = project(cam, [pl.target[0], pl.target[1], 0]);
      [[0, 0, '100%'], [-62, -34, '70%'], [66, 52, '30%']].forEach(([dx, dy, lab]) => { finger(ctx, tp[0] + dx, tp[1] + dy, 14, 0.7); text(ctx, lab, tp[0] + dx + (dx > 0 ? 40 : dx < 0 ? -40 : 0), tp[1] + dy + (dx === 0 ? 46 : 6), 24, INK, { weight: 800 }); });
    }
    if (name === 'hint') icon(ctx, 'hint', x + 52, y + 52, 56, VERM);
  } else if (name === 'layers') {
    const m = MODELS[4], st = stateOf(m, 3), step = m.steps[3];
    const pl = planFold(st, step.spec); pl.creasesAll = st.creases;
    const paper = getPaper(m.paper, m.back);
    const th = 0.9 + 0.5 * Math.sin(t * 1.5);
    const cam = artPaperCam(x, y + 8, w, h - 16, { w: 1, h: 0.9, cx: 0, cy: 0.25 }, 0.3);
    drawFaces(ctx, foldFaces(st, pl, th), cam, paper, st.creases, { fold: true, theta: th, kind: 'valley' });
    dashedLine(ctx, cam, pl, INDIGO, 3, false);
  } else if (name === 'unfold') {
    const st = stateAt(kite, 1), step = kite.steps[0];
    const before = stateAt(kite, 0), pl = planFold(before, step.spec); pl.creasesAll = st.creases;
    const th = Math.PI - (0.5 + 0.5 * Math.sin(t * 1.6)) * 2.4;
    const cam = artPaperCam(x, y + 8, w, h - 16, { w: 1.42, h: 1.42, cx: 0, cy: 0 }, 0.3);
    drawFaces(ctx, foldFaces(before, pl, th), cam, getPaper(kite.paper), st.creases, { fold: true, theta: th, kind: 'valley' });
  } else if (name === 'turn') {
    const psi = Math.PI * (0.5 + 0.5 * Math.sin(t * 1.4));
    const cam = artPaperCam(x, y + 8, w, h - 16, sheetB, 0.3);
    draw(turnFaces(blank, psi), cam, blank, {});
    icon(ctx, 'turn', x + w - 60, y + 56, 60, INDIGO);
  } else if (name === 'stars') {
    [3, 2, 1].forEach((n, r) => {
      for (let i = 0; i < 3; i++) star(ctx, cx - 90 + i * 56, y + 48 + r * 70, 22, i < n ? '#e8b23a' : 'rgba(43,37,48,0.14)', i < n ? '#b8821d' : null);
      text(ctx, ['70% + no hints', '45% + 2 hints', 'finished'][r], cx + 170, y + 58 + r * 70, 22, INK, { weight: 700, align: 'left' });
    });
  } else if (name === 'chapters') {
    [0, 1, 2].forEach((i) => {
      const bw = w * 0.5, bx = cx - bw / 2, by = y + 20 + i * 90;
      ctx.fillStyle = CARD; rr(ctx, bx, by, bw, 70, 14); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; rr(ctx, bx, by, bw, 70, 14); ctx.stroke();
      drawThumb(ctx, MODELS[[0, 3, 5][i]], bx + 8, by + 6, 70, 58, MODELS[[0, 3, 5][i]].paper, { sync: true });
      text(ctx, ['First folds', 'Classics', 'Challenge'][i], bx + 96, by + 42, 26, INK, { weight: 700, align: 'left' });
      if (i === 2) icon(ctx, 'lock', bx + bw - 40, by + 35, 36, INK3);
    });
  } else if (name === 'studio') {
    const st = newSheet(0), pl = planFold(st, toward([-0.5, -0.5], [0.05, 0.12])); pl.creasesAll = st.creases;
    const th = 1.7 + 0.5 * Math.sin(t * 1.8);
    const cam = artPaperCam(x, y + 8, w, h - 16, sheetB, 0.3);
    drawFaces(ctx, foldFaces(st, pl, th), cam, pW, st.creases, { fold: true, theta: th, kind: 'valley' });
    const hp = project(cam, foldMapper(pl, th)(pl.handle)); finger(ctx, hp[0] + 4, hp[1] + 14, 20, 0.7);
  } else if (name === 'auto') {
    const st = stateAt(kite, 2), step = kite.steps[2];
    const cam = artPaperCam(x, y + 8, w, h - 16, { w: 1.1, h: 1.2, cx: 0, cy: 0 }, 0.3);
    drawFaces(ctx, flatFaces(st), cam, getPaper(kite.paper), st.creases, {});
    const lines = [{ a: [0, 0], n: [1, 0] }, { a: [0, 0], n: [0, 1] }, { a: step.spec.a, n: step.spec.n, real: true }];
    const act = Math.floor(t / 0.8) % 3;
    lines.forEach((l, i) => dashedLine(ctx, cam, { spec: l }, l.real && act === i ? VERM : 'rgba(39,64,107,' + (act === i ? 0.95 : 0.4) + ')', act === i ? 4 : 2.5, false));
  } else if (name === 'preview') {
    ctx.strokeStyle = 'rgba(43,37,48,0.15)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx - 100, cy, 52, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = VERM; ctx.beginPath(); ctx.arc(cx - 100, cy, 52, -Math.PI / 2, -Math.PI / 2 + 0.75 * 6.2832); ctx.stroke();
    text(ctx, '90 s', cx - 100, cy + 10, 30, INK, { weight: 800 });
    icon(ctx, 'check', cx + 70, cy - 40, 54, MOSS); icon(ctx, 'check', cx + 70, cy + 20, 54, MOSS);
    text(ctx, 'Menus', cx + 120, cy - 30, 26, INK, { weight: 700, align: 'left' }); text(ctx, 'Rules', cx + 120, cy + 30, 26, INK, { weight: 700, align: 'left' });
  } else if (name === 'demo' || name === 'lock') icon(ctx, 'lock', cx, cy, 90, VERM);
  else if (name === 'modelhero') {
    const m = MODELS.find((q) => q.id === b.data), mi = MODELS.indexOf(m);
    drawThumb(ctx, m, x + 20, y + 10, w - 40, h - 20, paperOf(S, m), { sync: true, decals: true });
    void mi;
  } else if (name === 'winstars') {
    const n = b.data ?? 1;
    for (let i = 0; i < 3; i++) {
      const k = clamp01((S.ovT - 0.25 - i * 0.28) / 0.45), sc = k > 0 ? backOut(k) : 0;
      ctx.save(); ctx.translate(cx + (i - 1) * 110, cy + (i === 1 ? -12 : 4)); ctx.scale(sc, sc);
      star(ctx, 0, 0, 46, i < n ? '#e8b23a' : 'rgba(43,37,48,0.14)', i < n ? '#b8821d' : null);
      ctx.restore();
    }
  }
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
const attractCache = {};
function drawAttract(ctx, S, cx, cy, size) {
  const m = MODELS[0], paper = getPaper(m.paper, m.back);
  const STEP = 3.1, total = m.steps.length * STEP + 2.6;
  const T = S.t % total;
  const k = Math.min(m.steps.length, Math.floor(T / STEP)), ph = T - k * STEP;
  const st = stateOf(m, k);
  const cam = makeCam({ x: cx, y: cy, S: size, cx: 0, cy: 0.02, tilt: 0.36 });
  if (k >= m.steps.length) {
    const f = finalOf(m);
    const kk = clamp01(ph / 0.6);
    const c2 = makeCam({ x: cx, y: cy, S: size * (0.96 + 0.04 * kk), cx: f.b.cx, cy: f.b.cy + 0.2, tilt: 0.36, yaw: 0.12 * Math.sin(S.t * 0.8) });
    drawFaces(ctx, flatFaces(st), c2, paper, st.creases, {});
    drawDecals(ctx, m.decals, c2, clamp01(ph / 1.6));
    return;
  }
  const step = m.steps[k];
  let pl = attractCache[`${k}`];
  if (!pl) {
    if (step.type === 'fold') { pl = planFold(st, step.spec); pl.creasesAll = st.creases; }
    else { const h = lastFold(st); pl = planFold(h.before, h.spec); pl.creasesAll = st.creases; pl.dir = -1; }
    attractCache[`${k}`] = pl;
  }
  const w = easeIO(clamp01((ph - 0.8) / 1.3));
  const th = step.type === 'fold' ? Math.PI * w * 0.985 : Math.PI * (1 - w * 0.985);
  const cs = step.type === 'fold' ? (th > 0.04 ? pl.creasesAll : st.creases) : pl.creasesAll;
  drawFaces(ctx, foldFaces(st, pl, th), cam, paper, cs, { fold: true, theta: th, kind: pl.spec.kind });
}

function drawTitle(ctx, S, ui) {
  const L = layout(), Tt = L.title;
  desk(ctx, L.w, L.h, S.t, 0.3, 0.12);
  ctx.save();
  ctx.translate(Tt.tx, Tt.ty); ctx.scale(Tt.k, Tt.k);
  // title block
  text(ctx, 'Origami', 340, 212, 132, INK, { font: DISPLAY, weight: 800, shadow: 'rgba(255,250,235,0.7)', sy: 3 });
  // red hanko seal
  ctx.save(); ctx.translate(626, 120); ctx.rotate(-0.08); ctx.fillStyle = VERM; rr(ctx, -34, -34, 68, 68, 8); ctx.fill();
  ctx.fillStyle = '#fff3e8'; ctx.font = `800 40px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('折', 0, 14); ctx.restore();
  text(ctx, 'FOLD BY FOLD', 360, 276, 40, VERM, { weight: 800, font: DISPLAY });
  text(ctx, tr('tagline'), 360, 326, 26, INK2, { weight: 500 });
  drawAttract(ctx, S, 360, 610, 270);
  ctx.restore();
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
}

function drawDocScreen(ctx, S, ui) {
  const L = layout();
  desk(ctx, L.w, L.h, S.t, 0.8, 0.1);
  if (ui.panel) panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawOverlay(ctx, S, ui) {
  const L = layout();
  ctx.fillStyle = `rgba(40,28,16,${0.5 * clamp01(S.ovT / 0.25)})`;
  ctx.fillRect(0, 0, L.w, L.h);
  const k = ease(clamp01(S.ovT / 0.3)), cx = ui.panel.x + ui.panel.w / 2, cy = ui.panel.y + ui.panel.h / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k); ctx.translate(-cx, -cy);
  ctx.globalAlpha = k;
  panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ play
function lineSeg(cam, b, spec, pad = 0.09) {
  // the crease line clipped to the box b (+pad) so it never runs off to infinity
  const { a, n } = spec, t = [-n[1], n[0]];
  let lo = -3, hi = 3;
  const clipAxis = (o, d, min, max) => {
    if (Math.abs(d) < 1e-9) return;
    let t0 = (min - o) / d, t1 = (max - o) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    lo = Math.max(lo, t0); hi = Math.min(hi, t1);
  };
  clipAxis(a[0], t[0], b.x0 - pad, b.x1 + pad); clipAxis(a[1], t[1], b.y0 - pad, b.y1 + pad);
  if (hi < lo) return null;
  return [project(cam, [a[0] + t[0] * lo, a[1] + t[1] * lo, 0]), project(cam, [a[0] + t[0] * hi, a[1] + t[1] * hi, 0])];
}

function drawGuides(ctx, S, P, cam, a) {
  const pl = P.plan;
  if (!pl) return;
  const idle = P.phase === 'idle' || P.phase === 'hint' || P.phase === 'drag' || P.phase === 'settle';
  const autoShow = a && (a.phase === 'reveal' || a.phase === 'act' || a.phase === 'think');
  if (!idle && !autoShow) return;
  const t = S.t, vis = a ? (a.phase === 'reveal' ? 1 : a.phase === 'act' ? 0.35 : 0) : 1;
  if (vis <= 0) return;
  const bnd = bounds(P.st.polys);
  const seg = lineSeg(cam, { x0: bnd.x0, y0: bnd.y0, x1: bnd.x1, y1: bnd.y1 }, pl.spec);
  const mountain = pl.spec.kind === 'mountain';
  ctx.save(); ctx.globalAlpha = vis;
  if (seg) {
    ctx.strokeStyle = 'rgba(255,250,240,0.8)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.setLineDash(mountain ? [16, 7, 3, 7] : [14, 10]);
    ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
    ctx.strokeStyle = a ? VERM : INDIGO; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
    ctx.setLineDash([]);
  }
  const home = pl.dir > 0 ? pl.handle : pl.target, away = pl.dir > 0 ? pl.target : pl.handle;
  const mapper = foldMapper(pl, P.theta);
  const hp = project(cam, mapper(pl.dir > 0 ? pl.handle : pl.handle)), awayP = project(cam, [away[0], away[1], 0]);
  const homeP = project(cam, [home[0], home[1], 0]);
  const prog = pl.dir > 0 ? P.theta / Math.PI : 1 - P.theta / Math.PI;
  // landing ring
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.setLineDash([7, 7]); ctx.strokeStyle = VERM; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.arc(awayP[0], awayP[1], 22 + pulse * 3, 0, 6.2832); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(217,72,43,0.2)'; ctx.beginPath(); ctx.arc(awayP[0], awayP[1], 14, 0, 6.2832); ctx.fill();
  // arrow while the flap is still near its start
  if (prog < 0.2 && P.phase !== 'hint') arrow(ctx, homeP, awayP, 0.22, 'rgba(217,72,43,0.8)', 4);
  // glowing handle on the flap
  const glow = 0.55 + 0.45 * Math.sin(t * 5) + (P.glow > 0 ? 0.4 : 0);
  const g = ctx.createRadialGradient(hp[0], hp[1], 2, hp[0], hp[1], 40 + glow * 12);
  g.addColorStop(0, 'rgba(255,230,190,0.95)'); g.addColorStop(0.35, 'rgba(217,72,43,0.75)'); g.addColorStop(1, 'rgba(217,72,43,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hp[0], hp[1], 40 + glow * 12, 0, 6.2832); ctx.fill();
  ctx.fillStyle = '#fff6e8'; ctx.strokeStyle = VERM; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hp[0], hp[1], 10, 0, 6.2832); ctx.fill(); ctx.stroke();
  if (P.phase === 'hint') finger(ctx, hp[0] + 5, hp[1] + 16, 22, 0.55);
  ctx.restore();
}

function drawAutoLines(ctx, S, P, cam, a) {
  if (!a || !a.cands.length || (a.phase !== 'think' && a.phase !== 'reveal')) return;
  const bnd = bounds(P.st.polys);
  const act = Math.floor(a.t / 0.8) % a.cands.length;
  a.cands.forEach((l, i) => {
    const seg = lineSeg(cam, { x0: bnd.x0, y0: bnd.y0, x1: bnd.x1, y1: bnd.y1 }, { a: l.a, n: l.n });
    if (!seg) return;
    const hot = a.phase === 'think' && act === i, real = l.real && a.phase === 'reveal';
    ctx.save(); ctx.setLineDash([12, 10]); ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,250,240,0.7)'; ctx.lineWidth = hot ? 7 : 5; ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
    ctx.strokeStyle = real ? 'rgba(0,0,0,0)' : hot ? INDIGO : 'rgba(39,64,107,0.38)'; ctx.lineWidth = hot ? 4 : 2.5;
    ctx.beginPath(); ctx.moveTo(seg[0][0], seg[0][1]); ctx.lineTo(seg[1][0], seg[1][1]); ctx.stroke();
    ctx.restore();
  });
}

function drawCaption(ctx, S, P, R, cap, a, swatchFn) {
  const c = R.card;
  panel(ctx, c.x, c.y, c.w, c.h, { r: 22, blur: 14, dy: 5 });
  const sc = textScaleCap(S), pad = 24;
  text(ctx, cap.label.toUpperCase(), c.x + pad, c.y + 22 + cap.lab, cap.lab, VERM, { weight: 800, align: 'left' });
  let y = c.y + 22 + cap.lab + 8 + cap.size;
  for (const ln of cap.lines) { text(ctx, ln, c.x + pad, y, cap.size, INK, { weight: 600, align: 'left' }); y += cap.line; }
  if (P.studio) {
    const sw = swatchFn(P);
    PAPER_IDS_LIST.forEach((pid, i) => {
      const r = sw[i], p = peekPaper(pid), sel = pid === P.paperId;
      ctx.save(); rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.clip();
      if (p.front) ctx.drawImage(p.front, r.x, r.y, r.w, r.w); else { ctx.fillStyle = p.base; ctx.fillRect(r.x, r.y, r.w, r.h); }
      ctx.restore();
      ctx.strokeStyle = sel ? VERM : EDGE; ctx.lineWidth = sel ? 4 : 2; rr(ctx, r.x, r.y, r.w, r.h, 12); ctx.stroke();
    });
    return;
  }
  // progress dots
  const m = MODELS[P.mi], n = m.steps.length, dy = c.y + c.h - 22, gap = Math.min(26, (c.w - 2 * pad) / n);
  for (let i = 0; i < n; i++) {
    const x = c.x + pad + 8 + i * gap, done = i < P.k, cur = i === P.k;
    ctx.beginPath(); ctx.arc(x, dy, cur ? 8 : 6, 0, 6.2832);
    ctx.fillStyle = done ? MOSS : cur ? VERM : 'rgba(43,37,48,0.16)'; ctx.fill();
  }
  void sc; void a;
}
let PAPER_IDS_LIST = Object.keys(PAPERS);

function drawTools(ctx, S, P, R, a) {
  if (a) return;
  const step = P.studio ? null : stepOf(P);
  const turnNow = P.studio || (step && step.type === 'turn');
  const idle = P.phase === 'idle';
  const items = P.studio
    ? [{ ic: 'layers', lab: P.topOnly ? 'Top layer' : 'All layers', on: P.topOnly }, { ic: 'undo', lab: 'Undo' }, { ic: 'restart', lab: 'Restart' }, { ic: 'turn', lab: 'Turn over' }]
    : [{ ic: 'hint', lab: 'Hint', dis: !step }, { ic: 'undo', lab: 'Undo', dis: P.k <= 0 }, { ic: 'restart', lab: 'Restart' }, { ic: 'turn', lab: 'Turn over', dis: !turnNow, hot: turnNow && !P.studio }];
  items.forEach((it, i) => {
    const r = R.tools[i], pressed = S.press && S.press.id === `tool:${i}` && S.press.active;
    const dis = (it.dis || (!idle && P.phase !== 'reveal')) && !(P.phase === 'reveal' && i === 2);
    button(ctx, r, [], it.hot ? 'primary' : it.on ? 'on' : 'normal', { disabled: dis, pressed, r: 18 });
    const dy = pressed ? 3 : 0, col = it.hot ? '#fff8ee' : it.on ? '#f6f1e4' : INK;
    ctx.save(); if (dis) ctx.globalAlpha = 0.45;
    icon(ctx, it.ic, r.x + r.w / 2, r.y + r.h * 0.38 + dy, Math.min(46, r.h * 0.46), col);
    text(ctx, it.lab, r.x + r.w / 2, r.y + r.h - 20 + dy, Math.max(Math.min(21, r.w / 6.2), Math.min(r.w / 5.4, 11.5 / Math.max(0.3, host.px))), col, { weight: 700 });
    ctx.restore();
  });
}

function drawAutoControls(ctx, S, P, R, A) {
  const a = S.auto;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  button(ctx, A.slower, [], 'normal', { pressed: pr('auto:slower'), r: 18 }); text(ctx, '-', A.slower.x + A.slower.w / 2, A.slower.y + A.slower.h / 2 + 14, 44, INK, { weight: 800 });
  button(ctx, A.faster, [], 'normal', { pressed: pr('auto:faster'), r: 18 }); text(ctx, '+', A.faster.x + A.faster.w / 2, A.faster.y + A.faster.h / 2 + 14, 44, INK, { weight: 800 });
  button(ctx, A.pause, [], a.paused ? 'primary' : 'normal', { pressed: pr('auto:pause'), r: 18 });
  icon(ctx, a.paused ? 'play' : 'pause', A.pause.x + A.pause.w / 2 - 54, A.pause.y + A.pause.h / 2, 40, a.paused ? '#fff8ee' : INK);
  text(ctx, a.paused ? tr('resume') : 'Pause', A.pause.x + A.pause.w / 2 + 14, A.pause.y + A.pause.h / 2 + 10, 28, a.paused ? '#fff8ee' : INK, { weight: 700 });
  text(ctx, `${THINK_STEPS[S.thinkIdx]} s`, A.pause.x + A.pause.w / 2, A.pause.y - 10, Math.max(20, 11.5 / Math.max(0.3, host.px)), INK3, { weight: 700 });
}

function statusChip(ctx, S, P, board, a) {
  let label = '', k = 0;
  if (a.paused) label = tr('autoPaused');
  else if (a.phase === 'think') { label = tr('autoThink'); k = clamp01(a.t / THINK_STEPS[S.thinkIdx]); }
  else if (a.phase === 'reveal') { label = tr('autoReveal'); k = clamp01(a.t / 2); }
  else if (a.phase === 'act') label = tr('autoAct');
  else if (a.phase === 'intro') label = MODELS[P.mi].name;
  else label = MODELS[P.mi].name;
  const w = 250, h = 52, x = board.x + board.w / 2 - w / 2, y = board.y + 4;
  ctx.save(); ctx.fillStyle = 'rgba(251,246,234,0.92)'; rr(ctx, x, y, w, h, 26); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 26); ctx.stroke();
  text(ctx, label, x + w / 2, y + 34, 26, INK, { weight: 700 });
  if (k > 0) { ctx.strokeStyle = VERM; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 24, y + h - 5); ctx.lineTo(x + 24 + (w - 48) * k, y + h - 5); ctx.stroke(); }
  ctx.restore();
}

function drawPlay(ctx, S, ui, extras) {
  const P = S.play, L = layout();
  desk(ctx, L.w, L.h, S.t, 0.3, 0.1);
  if (!P) return;
  const { R, cap, auto } = rectsFor(S, P);
  const a = S.scene === 'auto' ? S.auto : null;
  const m = MODELS[P.mi];
  // header
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  if (!a || true) { button(ctx, L.back, [], 'normal', { pressed: pr('hud:back') || pr('auto:exit'), r: 18 }); icon(ctx, 'back', L.back.x + L.back.w / 2 - 2, L.back.y + L.back.h / 2, 38, INK); }
  if (!a) { button(ctx, L.pause, [], 'normal', { pressed: pr('hud:pause'), r: 18 }); icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2, 38, INK); }
  const title = P.studio ? tr('studioBtn') : a ? tr('autoBtn') : m.name;
  text(ctx, title, L.titleC.x, L.titleC.y + 12, Math.min(44, (L.xr - L.xl - 200) / Math.max(4, title.length * 0.62)), INK, { font: DISPLAY, weight: 800 });
  // the paper
  const cam = camOf(P, R.board);
  const sc = sceneOf(P);
  const paper = getPaper(P.paperId, P.studio ? undefined : m.back);
  ctx.save(); ctx.beginPath(); ctx.rect(R.board.x - 8, R.board.y - 6, R.board.w + 16, R.board.h + 12); ctx.clip();
  drawFaces(ctx, sc.faces, cam, paper, sc.creases, sc.mode);
  if (P.phase === 'reveal') drawDecals(ctx, m.decals, cam, P.decalK);
  if (a) drawAutoLines(ctx, S, P, cam, a);
  if (!P.studio && P.phase !== 'reveal' && P.plan) drawGuides(ctx, S, P, cam, a);
  if (P.studio && P.plan && P.phase === 'drag' && P.drag) {
    const hp = project(cam, [P.drag.f[0], P.drag.f[1], 0]); finger(ctx, hp[0], hp[1] + 10, 24, 0.55);
  }
  // crease flash
  if (P.flash) {
    const k = P.flash.t / 0.7;
    ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 10 * (1 - k) + 2; ctx.beginPath(); ctx.moveTo(P.flash.x0, P.flash.y0); ctx.lineTo(P.flash.x1, P.flash.y1); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  drawParticles(ctx, S.particles);
  for (const p of P.pops) {
    const k = p.t / 1.6;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); text(ctx, p.text, p.x, p.y - 60 * ease(k), 34, p.c, { weight: 800, font: DISPLAY, shadow: 'rgba(255,250,235,0.9)', sy: 2 }); ctx.restore();
  }
  // caption + controls
  drawCaption(ctx, S, P, R, cap, a, extras.swatchRects);
  if (a) { statusChip(ctx, S, P, R.board, a); drawAutoControls(ctx, S, P, R, auto); } else drawTools(ctx, S, P, R, a);
  if (S.toast) {
    const w = Math.min(L.w - 40, 560), h = 64, x = (L.w - w) / 2, y = R.board.y + R.board.h * 0.5;
    ctx.save(); ctx.globalAlpha = clamp01(S.toastT * 2); ctx.fillStyle = 'rgba(43,37,48,0.88)'; rr(ctx, x, y, w, h, 18); ctx.fill();
    text(ctx, S.toast, x + w / 2, y + 41, 24, '#fbf6ea', { weight: 600 }); ctx.restore();
  }
}

export function render(ctx, S, ui, extras = {}) {
  bakeStep();
  const sc = S.scene;
  if (sc === 'title') drawTitle(ctx, S, ui);
  else if (sc === 'play' || sc === 'studio' || sc === 'auto') drawPlay(ctx, S, ui, extras);
  else if (sc === 'demo-limit') {
    const L = layout(); desk(ctx, L.w, L.h, S.t);
    ctx.fillStyle = 'rgba(40,28,16,0.35)'; ctx.fillRect(0, 0, L.w, L.h);
    panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
    drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0); drawFixed(ctx, S, ui.fixed);
  } else drawDocScreen(ctx, S, ui);
  if (S.overlay) drawOverlay(ctx, S, ui);
  void rec; void modelLocked; void wrap; void RULES; void INK3; void GOLD; void SAKURA; void CARD; void reflectPt; void side; void commitFold; void UI; void easeIO;
}
