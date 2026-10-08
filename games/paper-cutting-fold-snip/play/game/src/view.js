// Everything drawn each frame. Reads state, changes nothing (except the texture bake queue, which is a cache).
import {
  UI, DISPLAY, INK, INK2, INK3, CARD, CARD2, EDGE, VERM, GOLD, MOSS, CREAM_TEXT, text, rr, panel, button, desk, mat, star, icon, shapeIcon,
  drawParticles, clamp01, ease, easeIO, backOut, kindInk,
} from './art.js';
import { makeCam, project, drawFaces, getPaper, bakeCut, getLayer, PAPERS } from './paperview.js';
import { flatFaces, foldFaces } from './paper.js';
import {
  SHEETS, SHAPES, SHAPE_NAMES, SIZE_NAMES, foldPlan, cutPoly, layersOf, punch, wedgeAngles, foldName, viewRoll, rayDist,
} from './shapes.js';
import { LEVELS, traditionOf } from './levels.js';
import { tr, RULES } from './content.js';
import { TEXT_SCALES, wrap } from './ui.js';
import { layout } from './layout.js';
import { drawLockup } from './brand.js';
import { rectsFor, camOf, sceneOf, levelOf, textScaleCap, resultButtons, paperFor, fitTarget, planOf, cutsKey, flatState } from './playcommon.js';
import { THINK_STEPS, rec } from './screens.js';

// ----------------------------------------------------------------------------------------- thumbnails (baked one per frame)
const thumbs = new Map(), thumbQ = [];
function makeThumb(d) {
  if (typeof OffscreenCanvas === 'undefined') return false;
  const def = PAPERS[d.paper] ?? PAPERS.red;
  const p = bakeCut(d.paper, `${d.sheet}:${d.n}:${d.cuts.length}:${cutsKey(d.cuts)}`, layersOf(d.sheet, d.n), d.cuts.map(cutPoly), SHEETS[d.sheet].pts, foldPlan(d.sheet, d.n).creases);
  if (!p.front) return false;
  const T = new OffscreenCanvas(220, 220), g = T.getContext('2d');
  g.fillStyle = def.mat; g.fillRect(0, 0, 220, 220);
  g.save(); g.shadowColor = 'rgba(30,10,4,0.4)'; g.shadowBlur = 8; g.shadowOffsetY = 3;
  g.drawImage(p.front, 14, 14, 192, 192); g.restore();
  return T;
}
function thumb(key, d) {
  if (thumbs.has(key)) return thumbs.get(key);
  if (!thumbQ.some((q) => q.key === key)) thumbQ.push({ key, d });
  return null;
}
function bakeStep() {
  const q = thumbQ.shift();
  if (!q) return;
  thumbs.set(q.key, makeThumb(q.d));
  if (thumbs.size > 90) thumbs.delete(thumbs.keys().next().value);
}
const levelThumb = (li) => { const l = LEVELS[li]; return thumb(`L${li}`, { sheet: l.sheet, paper: l.paper, n: l.ref, cuts: l.cuts }); };
const savedThumb = (g) => thumb(`G${g.sheet}${g.paper}${g.n}${cutsKey(g.cuts)}`, g);

function drawThumbBox(ctx, T, x, y, w, h, def, opts = {}) {
  ctx.save(); rr(ctx, x, y, w, h, 12); ctx.clip();
  ctx.fillStyle = def.mat; ctx.fillRect(x, y, w, h);
  if (T) { const s = Math.min(w, h); ctx.drawImage(T, x + (w - s) / 2, y + (h - s) / 2, s, s); }
  else { ctx.fillStyle = 'rgba(120,80,40,0.12)'; ctx.fillRect(x, y, w, h); }
  ctx.restore();
  if (opts.frame) { ctx.strokeStyle = opts.frame; ctx.lineWidth = opts.fw ?? 2; rr(ctx, x, y, w, h, 12); ctx.stroke(); }
}

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
    ctx.fillStyle = 'rgba(200,38,28,0.7)'; rr(ctx, region.x + region.w + 8, ty, 6, th, 3); ctx.fill();
  }
}

function drawFixed(ctx, S, list) {
  for (const f of list) {
    if (f.static) { text(ctx, f.label, f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2 + 10, f.size, CREAM_TEXT, { weight: 700 }); continue; }
    const pressed = S.press && S.press.id === f.id && S.press.active;
    if (f.icon) {
      button(ctx, f.rect, [], f.kind, { disabled: f.disabled, pressed });
      icon(ctx, f.icon, f.rect.x + 36, f.rect.y + f.rect.h / 2 + (pressed ? 3 : 0), 30, INK);
      text(ctx, f.label, f.rect.x + 62 + (f.rect.w - 72) / 2, f.rect.y + f.rect.h / 2 + f.size * 0.34 + (pressed ? 3 : 0), f.size, INK, { weight: 700 });
    } else button(ctx, f.rect, f.lines ?? [f.label], f.kind, { size: f.size, line: f.line, disabled: f.disabled, pressed });
  }
}

function drawCell(ctx, S, r, c, pressed) {
  const y = r.y + (pressed ? 3 : 0), z = TEXT_SCALES[S.textIdx] ?? 1;
  ctx.save();
  const locked = c.state === 'locked';
  if (locked) ctx.globalAlpha = 0.62;
  ctx.shadowColor = 'rgba(40,20,8,0.3)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = c.state === 'done' ? CARD : CARD2; rr(ctx, r.x, y, r.w, r.h, 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = c.state === 'done' && !c.noStars ? 'rgba(214,161,58,0.95)' : EDGE; ctx.lineWidth = 2; rr(ctx, r.x, y, r.w, r.h, 18); ctx.stroke();
  const showStars = !c.noStars;
  const labelH = Math.min(26 * (1 + (z - 1) * 0.45), r.w / 5);
  const th = r.h - (showStars ? labelH + 44 : labelH + 22);
  const item = c.level ?? c.saved;
  const def = PAPERS[item?.paper] ?? PAPERS.red;
  if (!locked && item) drawThumbBox(ctx, c.level ? levelThumb(c.idx) : savedThumb(c.saved), r.x + 8, y + 8, r.w - 16, th, def);
  else { ctx.fillStyle = 'rgba(80,50,30,0.1)'; rr(ctx, r.x + 8, y + 8, r.w - 16, th, 12); ctx.fill(); icon(ctx, locked ? 'lock' : 'gallery', r.x + r.w / 2, y + 8 + th / 2, Math.min(60, r.w * 0.34), INK3); }
  if (c.label) text(ctx, c.label, r.x + r.w / 2, y + r.h - (showStars ? 40 : 14) - (z > 1 ? 4 : 0) + labelH * 0.1, labelH * 0.8, INK, { weight: 700 });
  if (showStars) for (let i = 0; i < 3; i++) star(ctx, r.x + r.w / 2 + (i - 1) * Math.min(28, r.w / 5), y + r.h - 18, Math.min(11, r.w / 12), i < c.stars ? '#e8b23a' : 'rgba(43,27,24,0.14)', i < c.stars ? '#b8821d' : null);
  ctx.restore();
}

// ----------------------------------------------------------------------------------- the paper board
// The paper is drawn on a transparent layer, then composited with one soft shadow, so holes show the mat. Without OffscreenCanvas it is drawn directly.
function cutHoles(l, cam, cuts, def, sx) {
  const polys = cuts.map((c) => cutPoly(c).map((p) => project(cam, [p[0], p[1], 0])));
  if (!polys.length) return;
  const path = (dx) => { l.beginPath(); for (const P of polys) { l.moveTo(P[0][0] + dx, P[0][1]); for (let i = 1; i < P.length; i++) l.lineTo(P[i][0] + dx, P[i][1]); l.closePath(); } };
  l.save();
  l.globalCompositeOperation = 'destination-out'; l.fillStyle = '#000';
  for (const P of polys) { l.beginPath(); l.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) l.lineTo(P[i][0], P[i][1]); l.closePath(); l.fill(); }
  l.restore();
  const off = 9999 / sx;
  l.save(); l.globalCompositeOperation = 'source-atop';
  l.shadowColor = def.edge; l.shadowBlur = 9; l.shadowOffsetX = 9999 + 2; l.shadowOffsetY = 3; l.fillStyle = '#000'; path(-off); l.fill();
  l.shadowColor = 'rgba(255,244,230,0.35)'; l.shadowBlur = 3; l.shadowOffsetX = 9999 - 1.5; l.shadowOffsetY = -1.5; path(-off); l.fill();
  l.restore();
}

function paintBoard(ctx, S, P, R, cam, sc, paper, lift) {
  const b = R.board, def = PAPERS[P.paper], tm = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null, kd = (tm && tm.a) || 1;
  const useLayer = (sc.baked || sc.stack) && typeof OffscreenCanvas !== 'undefined' && Boolean(tm);
  ctx.save(); ctx.beginPath(); ctx.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 8); ctx.clip();
  if (!useLayer) {
    drawFaces(ctx, sc.faces, cam, paper, sc.creases, { ...sc.mode, direct: true });
    if (sc.stack) { ctx.fillStyle = def.mat; for (const c of P.cuts) { const pp = cutPoly(c).map((p) => project(cam, [p[0], p[1], 0])); ctx.beginPath(); pp.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.closePath(); ctx.fill(); } }
    ctx.restore();
    return;
  }
  const k = clamp01((kd - 1) / 1) + 1, lay = getLayer(b.w + 8, b.h + 8, Math.min(2, Math.max(1, kd)) * 0.9 + 0.1 * k);
  const sx = lay.cw / (b.w + 8), sy = lay.ch / (b.h + 8), l = lay.ctx;
  l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, lay.cw, lay.ch);
  l.setTransform(sx, 0, 0, sy, -(b.x - 4) * sx, -(b.y - 4) * sy);
  drawFaces(l, sc.faces, cam, paper, sc.creases, sc.mode);
  if (sc.stack) cutHoles(l, cam, P.cuts, def, sx);
  l.setTransform(1, 0, 0, 1, 0, 0);
  ctx.save();
  ctx.shadowColor = `rgba(24,8,4,${0.42 + Math.min(0.2, lift * 0.8)})`; ctx.shadowBlur = (9 + lift * cam.S * 0.2) * kd; ctx.shadowOffsetX = 2 * kd; ctx.shadowOffsetY = (4 + lift * cam.S * 0.18) * kd;
  ctx.drawImage(lay.canvas, b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  ctx.restore();
  ctx.restore();
}

// the outline of a cut (dashed) with a soft fill, in screen space
function drawCutGhost(ctx, cam, cut, color, o = {}) {
  const pp = cutPoly(cut).map((p) => project(cam, [p[0], p[1], 0]));
  if (pp.length < 3) return;
  ctx.save();
  ctx.beginPath(); pp.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.closePath();
  ctx.fillStyle = o.fill ?? 'rgba(255,248,230,0.35)'; ctx.fill();
  ctx.setLineDash(o.dash ?? [10, 8]); ctx.lineWidth = o.w ?? 3.4; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.restore();
}

function finger(ctx, x, y, s, a = 0.5) {
  ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(60,40,30,0.85)';
  ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
}

// ----------------------------------------------------------------------------------- illustrations
function paperDirect(ctx, rect, faces, cam, paper, creases, mode) {
  ctx.save(); rr(ctx, rect.x, rect.y, rect.w, rect.h, 14); ctx.clip();
  drawFaces(ctx, faces, cam, paper, creases, { ...mode, direct: true });
  ctx.restore();
}
function sheetCam(rect, pts, tilt = 0.3, extra = 0.2) {
  const f = fitTarget(rect, pts, 0, extra);
  return makeCam({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, S: f.S, cx: f.cx, cy: f.cy, tilt });
}
const SHEET_COLORS = ['red', 'gold', 'turquoise', 'pink'];
function wedgeDraw(ctx, rect, sheet, n, paperId, cuts, o = {}) {
  const plan = foldPlan(sheet, n), def = PAPERS[paperId];
  const roll = viewRoll(n), f = fitTarget(rect, plan.wedge, roll, 0.16);
  const cam = makeCam({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, S: f.S, cx: f.cx, cy: f.cy, tilt: 0, roll });
  const pp = plan.wedge.map((p) => project(cam, [p[0], p[1], 0]));
  ctx.save();
  ctx.fillStyle = def.c0; ctx.beginPath(); pp.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.closePath(); ctx.shadowColor = 'rgba(30,10,4,0.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  ctx.fillStyle = def.mat;
  for (const c of cuts) { const q = cutPoly(c).map((p) => project(cam, [p[0], p[1], 0])); ctx.beginPath(); q.forEach((t, i) => ctx[i ? 'lineTo' : 'moveTo'](t[0], t[1])); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  return { cam, pp };
}

function drawArt(ctx, name, x, y, w, h, S, b) {
  const cx = x + w / 2, cy = y + h / 2, t = S.t;
  ctx.save();
  ctx.fillStyle = 'rgba(216,191,147,0.35)'; rr(ctx, x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(214,161,58,0.5)'; ctx.lineWidth = 1.5; rr(ctx, x, y, w, h, 18); ctx.stroke();
  ctx.beginPath(); rr(ctx, x, y, w, h, 18); ctx.clip();
  const box = { x: x + 10, y: y + 8, w: w - 20, h: h - 16 };
  const lv = (id) => LEVELS.find((l) => l.id === id);
  if (name === 'logo') {
    ['lotus', 'snow1', 'tree'].forEach((id, i) => { const l = lv(id), iw = (w - 40) / 3; drawThumbBox(ctx, levelThumb(LEVELS.indexOf(l)), x + 12 + i * (iw + 8), y + 12, iw, h - 24, PAPERS[l.paper]); });
  } else if (name === 'sheets') {
    SHEET_COLORS.forEach((c, i) => {
      const ids = ['square', 'banner', 'hex', 'pent'], r = { x: x + 10 + i * (w - 20) / 4, y: y + 10, w: (w - 20) / 4 - 4, h: h - 44 };
      const cam = sheetCam(r, SHEETS[ids[i]].pts, 0.3, 0.12);
      ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); drawFaces(ctx, flatFaces(flatState(ids[i])), cam, getPaper(c), [], { direct: true }); ctx.restore();
      text(ctx, SHEETS[ids[i]].name, r.x + r.w / 2, y + h - 14, 22, INK, { weight: 700 });
    });
  } else if (name === 'folds' || name === 'refold') {
    const n = 4, plan = foldPlan('square', n), steps = plan.plans.length, T = (t * 0.55) % (steps + 1.3), k = Math.min(steps - 1, Math.floor(T)), ph = Math.min(1, Math.max(0, (T - k) * 1.1));
    const th = T >= steps ? Math.PI : Math.PI * easeIO(Math.min(1, ph));
    const st = plan.states[Math.min(k, steps - 1)], pl = plan.plans[Math.min(k, steps - 1)];
    const cam = sheetCam(box, [...st.polys.flatMap((q) => q.pts), ...plan.states[Math.min(steps, k + 1)].polys.flatMap((q) => q.pts)], 0.4, 0.2);
    paperDirect(ctx, box, foldFaces(st, pl, T >= steps ? 0 : th), cam, getPaper('red'), th > 0.04 ? pl.creasesAll : st.creases, { fold: true, theta: th, kind: 'valley' });
    text(ctx, `${foldName(n)}: ${Math.min(steps, k + 1)} / ${steps}`, cx, y + h - 12, 22, CARD, { weight: 700 });
  } else if (name === 'wedge' || name === 'cut' || name === 'mirror' || name === 'hint') {
    const l = lv('eighth');
    const cuts = name === 'wedge' ? [] : l.cuts;
    const lr = { x: x + 10, y: y + 10, w: w * 0.46, h: h - 20 };
    const wd = wedgeDraw(ctx, lr, l.sheet, l.ref, l.paper, name === 'hint' ? l.cuts.slice(0, 1) : name === 'cut' ? l.cuts.slice(0, 1) : cuts);
    if (name === 'wedge') {
      const plan = foldPlan(l.sheet, l.ref), pts = plan.wedge.map((p) => project(wd.cam, [p[0], p[1], 0]));
      text(ctx, 'fold edge', (pts[0][0] + pts[2][0]) / 2 - 56, (pts[0][1] + pts[2][1]) / 2, 20, GOLD, { weight: 700 });
      text(ctx, 'paper edge', (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2 - 12, 20, GOLD, { weight: 700 });
      text(ctx, 'centre', pts[2][0] + 10, pts[2][1] + 28, 20, GOLD, { weight: 700 });
    }
    if (name === 'cut') {
      const sc = project(wd.cam, [0.05, -0.3, 0, 0].slice(0, 3));
      ctx.save(); ctx.setLineDash([9, 8]); ctx.strokeStyle = VERM; ctx.lineWidth = 4; ctx.beginPath(); const a = t * 1.2 % 6.28;
      for (let i = 0; i <= 24; i++) { const u = (i / 24) * Math.min(6.28, a), px = sc[0] + Math.cos(u) * 36, py = sc[1] + Math.sin(u) * 52; ctx[i ? 'lineTo' : 'moveTo'](px, py); } ctx.stroke(); ctx.restore();
      icon(ctx, 'scissors', sc[0] + Math.cos(a) * 36, sc[1] + Math.sin(a) * 52, 44, INK);
    }
    if (name === 'hint') drawCutGhost(ctx, wd.cam, l.cuts[1], VERM);
    // the unfolded result beside it
    const rr0 = { x: x + w * 0.52, y: y + 10, w: w * 0.46, h: h - 20 };
    drawThumbBox(ctx, name === 'wedge' ? null : levelThumb(LEVELS.indexOf(l)), rr0.x, rr0.y, rr0.w, rr0.h, PAPERS[l.paper]);
    icon(ctx, 'unfold', x + w * 0.5, cy, 44, GOLD);
  } else if (name === 'punch') {
    SHAPES.forEach((s, i) => {
      const bx = x + 10 + (i % 3) * (w - 20) / 3, by = y + 10 + Math.floor(i / 3) * (h - 20) / 2, bw = (w - 20) / 3 - 8, bh = (h - 20) / 2 - 8;
      ctx.fillStyle = CARD; rr(ctx, bx, by, bw, bh, 14); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; ctx.stroke();
      shapeIcon(ctx, s, bx + bw / 2, by + bh / 2 - 8, bh * 0.5, VERM, 0);
      text(ctx, SHAPE_NAMES[s], bx + bw / 2, by + bh - 10, 19, INK, { weight: 700 });
    });
  } else if (name === 'unfold') {
    const l = lv('half'), plan = foldPlan(l.sheet, l.ref), steps = plan.plans.length;
    const T = (t * 0.5) % (steps + 1.6), k = Math.min(steps - 1, steps - 1 - Math.floor(Math.max(0, T - 0.2))), ph = Math.max(0, T - 0.2) % 1;
    const done = T - 0.2 >= steps, th = done ? 0 : Math.PI * (1 - easeIO(Math.min(1, ph * 1.05)));
    const kk = done ? 0 : Math.max(0, k);
    const paper = bakeCut(l.paper, `art:${l.id}`, layersOf(l.sheet, l.ref), l.cuts.map(cutPoly), SHEETS[l.sheet].pts, plan.creases);
    const st = plan.states[kk], pl = plan.plans[kk];
    const cam = sheetCam(box, [...st.polys.flatMap((q) => q.pts), ...plan.states[kk + 1].polys.flatMap((q) => q.pts)], 0.38, 0.2);
    ctx.save(); ctx.fillStyle = PAPERS[l.paper].mat; rr(ctx, box.x, box.y, box.w, box.h, 14); ctx.fill(); ctx.restore();
    paperDirect(ctx, box, foldFaces(st, pl, th), cam, paper, [], { fold: true, theta: th, kind: 'valley' });
  } else if (name === 'score' || name === 'stars') {
    [3, 2, 1].forEach((n, r) => {
      for (let i = 0; i < 3; i++) star(ctx, cx - 150 + i * 56, y + 48 + r * 70, 22, i < n ? '#e8b23a' : 'rgba(43,27,24,0.14)', i < n ? '#b8821d' : null);
      text(ctx, ['94% + par + no hints', '87% match', '75% match'][r], cx + 40, y + 58 + r * 70, 22, INK, { weight: 700, align: 'left' });
    });
  } else if (name === 'chapters') {
    [0, 3, 4].forEach((i, r) => {
      const bw = w * 0.62, bx = cx - bw / 2, by = y + 14 + r * 94, li = [0, 12, 15][r] ?? 0;
      ctx.fillStyle = CARD; rr(ctx, bx, by, bw, 76, 14); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; rr(ctx, bx, by, bw, 76, 14); ctx.stroke();
      drawThumbBox(ctx, levelThumb(Math.min(li, LEVELS.length - 1)), bx + 8, by + 6, 64, 64, PAPERS[LEVELS[Math.min(li, LEVELS.length - 1)].paper]);
      text(ctx, ['First Snips', 'Papel Picado', 'Snowflakes'][r], bx + 88, by + 46, 26, INK, { weight: 700, align: 'left' });
      if (r === 2) icon(ctx, 'lock', bx + bw - 40, by + 38, 36, INK3);
    });
  } else if (name === 'studio' || name === 'gallery') {
    ['lotus', 'snow1', 'tree', 'butterfly'].forEach((id, i) => { const l = lv(id), iw = (w - 50) / 4; drawThumbBox(ctx, levelThumb(LEVELS.indexOf(l)), x + 10 + i * (iw + 10), y + 12, iw, h - 24, PAPERS[l.paper], { frame: EDGE }); });
  } else if (name === 'auto') {
    const l = lv('eighth'), r = { x: x + 10, y: y + 10, w: w - 20, h: h - 20 };
    const wd = wedgeDraw(ctx, r, l.sheet, l.ref, l.paper, l.cuts.slice(0, 1));
    const cands = [l.cuts[1], { ...l.cuts[1], x: l.cuts[1].x + 0.06, a: 3 }, { ...l.cuts[1], y: l.cuts[1].y + 0.05, s: 'diamond' }], act = Math.floor(t / 0.8) % 3;
    cands.forEach((c, i) => drawCutGhost(ctx, wd.cam, c, act === i ? VERM : 'rgba(58,36,32,0.5)', { w: act === i ? 4 : 2.4 }));
  } else if (name === 'preview') {
    ctx.strokeStyle = 'rgba(43,27,24,0.15)'; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx - 100, cy, 52, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = VERM; ctx.beginPath(); ctx.arc(cx - 100, cy, 52, -Math.PI / 2, -Math.PI / 2 + 0.75 * 6.2832); ctx.stroke();
    text(ctx, '90 s', cx - 100, cy + 10, 30, INK, { weight: 800 });
    icon(ctx, 'check', cx + 70, cy - 40, 54, MOSS); icon(ctx, 'check', cx + 70, cy + 20, 54, MOSS);
    text(ctx, 'Menus', cx + 120, cy - 30, 26, INK, { weight: 700, align: 'left' }); text(ctx, 'Rules', cx + 120, cy + 30, 26, INK, { weight: 700, align: 'left' });
  } else if (name === 'lock') icon(ctx, 'lock', cx, cy, 90, VERM);
  void b;
  ctx.restore();
}

// --------------------------------------------------------------------------------------- title
let attractPaper = null;
function drawAttract(ctx, S, cx, cy, size) {
  const l = LEVELS.find((q) => q.id === 'eighth'), plan = foldPlan(l.sheet, l.ref), steps = plan.plans.length;
  if (!attractPaper && typeof OffscreenCanvas !== 'undefined' && S.t > 0.3) attractPaper = bakeCut(l.paper, 'attract', layersOf(l.sheet, l.ref), l.cuts.map(cutPoly), SHEETS[l.sheet].pts, plan.creases);
  const FOLD = 1.0, CUT = 0.55, UNF = 1.0, HOLD = 2.4, total = steps * FOLD + 0.4 + l.cuts.length * CUT + 0.4 + steps * UNF + HOLD;
  const T = S.t % total;
  const rect = { x: cx - size * 1.15, y: cy - size * 1.15, w: size * 2.3, h: size * 2.3 };
  const paperPlain = getPaper(l.paper);
  let faces, creases = [], mode = {}, paper = paperPlain, cutsShown = 0, pts, roll = 0, tilt = 0.4;
  if (T < steps * FOLD) {
    const k = Math.floor(T / FOLD), ph = (T - k * FOLD) / FOLD, th = Math.PI * easeIO(clamp01((ph - 0.1) / 0.8));
    faces = foldFaces(plan.states[k], plan.plans[k], th); creases = th > 0.04 ? plan.plans[k].creasesAll : plan.states[k].creases; mode = { fold: true, theta: th, kind: 'valley' };
    pts = [...plan.states[k].polys, ...plan.states[k + 1].polys].flatMap((q) => q.pts);
  } else if (T < steps * FOLD + 0.4 + l.cuts.length * CUT + 0.4) {
    const u = T - steps * FOLD - 0.4;
    cutsShown = clamp01(Math.floor(u / CUT) + 1 > l.cuts.length ? l.cuts.length : Math.max(0, Math.floor(u / CUT) + 1)) ? Math.max(0, Math.min(l.cuts.length, Math.floor(u / CUT) + 1)) : 0;
    faces = flatFaces(plan.final).sort((a, b) => b.z - a.z).map((F, i) => ({ ...F, pts3: F.pts3.map((p) => [p[0], p[1], -i * 0.006]), c3: [F.c3[0], F.c3[1], -i * 0.006] }));
    pts = plan.wedge; roll = viewRoll(l.ref); tilt = 0.2;
  } else if (T < total - HOLD) {
    const u = T - (steps * FOLD + 0.4 + l.cuts.length * CUT + 0.4), k = steps - 1 - Math.floor(u / UNF), ph = (u - Math.floor(u / UNF) * UNF) / UNF, th = Math.PI * (1 - easeIO(clamp01((ph - 0.1) / 0.8)));
    faces = foldFaces(plan.states[k], plan.plans[k], th); mode = { fold: true, theta: th, kind: 'valley' }; if (attractPaper) paper = attractPaper;
    pts = [...plan.states[k].polys, ...plan.states[k + 1].polys].flatMap((q) => q.pts); roll = viewRoll(l.ref) * k / steps;
  } else { faces = flatFaces(plan.states[0]); if (attractPaper) paper = attractPaper; pts = plan.states[0].polys.flatMap((q) => q.pts); tilt = 0.32; }
  const f = fitTarget({ x: 0, y: 0, w: size * 2.1, h: size * 2.1 }, pts, roll, 0.2);
  const cam = makeCam({ x: cx, y: cy, S: f.S, cx: f.cx, cy: f.cy, tilt, roll });
  ctx.save();
  // the mat the paper lies on
  ctx.fillStyle = PAPERS[l.paper].mat; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; rr(ctx, cx - size * 1.1, cy - size * 1.1, size * 2.2, size * 2.2, 30); ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.restore();
  ctx.save(); rr(ctx, cx - size * 1.1, cy - size * 1.1, size * 2.2, size * 2.2, 30); ctx.clip();
  if (cutsShown > 0 && !mode.fold) {
    const sc = { faces, creases, mode, baked: false, stack: true }, P = { cuts: l.cuts.slice(0, cutsShown), paper: l.paper };
    paintBoard(ctx, S, P, { board: { x: rect.x, y: rect.y, w: rect.w, h: rect.h } }, cam, sc, paper, 0);
  } else if (mode.fold && paper.baked) {
    paintBoard(ctx, S, { cuts: [], paper: l.paper }, { board: rect }, cam, { faces, creases, mode, baked: true }, paper, 0.1);
  } else if (paper.baked) {
    paintBoard(ctx, S, { cuts: [], paper: l.paper }, { board: rect }, cam, { faces, creases, mode, baked: true }, paper, 0);
  } else drawFaces(ctx, faces, cam, paper, creases, mode);
  ctx.restore();
  void ease; void backOut;
}

function drawTitle(ctx, S, ui) {
  const L = layout(), Tt = L.title;
  desk(ctx, L.w, L.h, S.t, 0.5, 0.18);
  ctx.save();
  ctx.translate(Tt.tx, Tt.ty); ctx.scale(Tt.k, Tt.k);
  // title block
  text(ctx, 'Paper Cutting', 360, 168, 100, CREAM_TEXT, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.5)', sy: 4 });
  // red seal
  ctx.save(); ctx.translate(640, 232); ctx.rotate(-0.08); ctx.fillStyle = VERM; rr(ctx, -30, -30, 60, 60, 8); ctx.fill();
  ctx.fillStyle = '#fff3e8'; ctx.font = `800 36px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.fillText('剪', 0, 13); ctx.restore();
  text(ctx, 'FOLD  ·  SNIP  ·  UNFOLD', 340, 244, 32, GOLD, { weight: 800, font: DISPLAY });
  text(ctx, tr('tagline'), 360, 296, 26, 'rgba(246,233,207,0.78)', { weight: 500 });
  drawAttract(ctx, S, 360, 560, 196);
  ctx.restore();
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
}

function drawDocScreen(ctx, S, ui) {
  const L = layout();
  desk(ctx, L.w, L.h, S.t, 0.7, 0.1);
  if (ui.panel) panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
  drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0);
  drawFixed(ctx, S, ui.fixed);
}

function drawOverlay(ctx, S, ui) {
  const L = layout();
  ctx.fillStyle = `rgba(12,4,2,${0.6 * clamp01(S.ovT / 0.25)})`;
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
function drawCaption(ctx, S, P, R, cap) {
  const c = R.card, lv = levelOf(P), L = layout();
  panel(ctx, c.x, c.y, c.w, c.h, { r: 22, blur: 14, dy: 5 });
  const pad = 24, def = PAPERS[P.paper];
  text(ctx, cap.label.toUpperCase(), c.x + pad, c.y + 22 + Math.round(cap.size * 0.62), Math.round(cap.size * 0.62), VERM, { weight: 800, align: 'left' });
  let y = c.y + 22 + Math.round(cap.size * 0.9) + 8 + cap.size;
  let tx = c.x + pad, ty = y;
  if (cap.thumb && lv) {
    const th = cap.thumb;
    drawThumbBox(ctx, levelThumb(P.li), c.x + c.w - pad - th + 8, c.y + 18, th, th, def, { frame: EDGE }); text(ctx, 'TARGET', c.x + c.w - pad - th / 2 + 8, c.y + 18 + th + 18, 15, INK3, { weight: 800 });
  }
  for (const ln of cap.lines) { text(ctx, ln, tx, ty, cap.size, INK, { weight: 500, align: 'left' }); ty += cap.line; }
  if (P.mode === 'level' && P.phase === 'cut' && ty - cap.line < c.y + c.h - 14 - cap.size * 0.8) {
    const lab = `${tr('cuts')} ${P.cuts.length}  ·  ${tr('par')} ${lv.par}${P.hints ? `  ·  ${tr('hint')} ${P.hints}` : ''}`;
    text(ctx, lab, c.x + pad, c.y + c.h - 14, Math.round(cap.size * 0.7), INK3, { weight: 700, align: 'left' });
  }
}

function tipText(ctx, r, P) {
  ctx.save(); ctx.fillStyle = 'rgba(249,241,224,0.12)'; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill(); ctx.restore();
  const msg = 'Scissors: drag a path around the part to cut away. Lift your finger and the path closes with a straight line. Start or end outside the wedge to snip in from an edge.';
  let size = Math.min(22, r.w / 20), lines = wrap(msg, size, r.w - 28);
  while (size > 11 && lines.length * size * 1.3 + 22 > r.h) { size -= 1; lines = wrap(msg, size, r.w - 28); }
  lines.forEach((ln, i) => text(ctx, ln, r.x + 14, r.y + 14 + size + i * size * 1.3, size, CREAM_TEXT, { weight: 500, align: 'left' }));
  void P;
}

function drawTools(ctx, S, P, R) {
  const phase = P.phase;
  const pr = (id) => S.press && S.press.id === `tool:${id}` && S.press.active;
  for (const r of R.rects) {
    if (r.tip) { tipText(ctx, r, P); continue; }
    const id = r.id;
    let kind = r.kind ?? 'normal', dis = false, on = false;
    if (id === 'tool:scissors') on = P.tool === 'scissors'; else if (id === 'tool:punch') on = P.tool === 'punch';
    if (id && id.startsWith('shape:')) on = P.shape === id.slice(6);
    if (id && id.startsWith('size:')) on = P.size === Number(id.slice(5));
    if (id === 'undo' || id === 'clear') dis = !P.cuts.length;
    if (id === 'unfold') dis = !P.cuts.length;
    if (id === 'changefold' && P.confirmChange) kind = 'danger';
    if (id && id.startsWith('fold:')) on = false;
    if (id && id.startsWith('sheet:')) on = P.sheet === id.slice(6);
    if (id && id.startsWith('paper:')) { drawSwatch(ctx, r, id.slice(6), P.paper === id.slice(6), pr(id)); continue; }
    if (on) kind = 'on';
    const lv = levelOf(P), hot = id && id.startsWith('fold:') && P.hintFold && lv && Number(id.slice(5)) === lv.ref;
    if (hot) kind = 'gold';
    button(ctx, r, [], kind, { disabled: dis, pressed: pr(id), r: 18 });
    const dy = pr(id) ? 3 : 0, col = on ? '#f6e9cf' : kindInk(kind);
    ctx.save(); if (dis) ctx.globalAlpha = 0.45;
    if (r.shape) shapeIcon(ctx, r.shape, r.x + r.w / 2, r.y + r.h / 2 + dy, Math.min(r.h * 0.6, 44), on ? '#f6e9cf' : VERM);
    else if (id && id.startsWith('fold:')) {
      text(ctx, r.label, r.x + r.w / 2, r.y + r.h * 0.5 + dy, Math.min(34, r.h * 0.42), col, { weight: 800, font: DISPLAY });
      text(ctx, r.sub, r.x + r.w / 2, r.y + r.h * 0.5 + 24 + dy, Math.min(19, r.h * 0.26), INK2, { weight: 600 });
    } else if (id && id.startsWith('size:')) {
      const k = Number(id.slice(5));
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h * 0.4 + dy, 5 + k * 3.4, 0, 6.2832); ctx.fill();
      text(ctx, r.label, r.x + r.w / 2, r.y + r.h - 9 + dy, Math.min(18, r.h * 0.3), col, { weight: 700 });
    } else if (r.icon) {
      const isz = Math.min(r.h * 0.5, 40), hasLab = Boolean(r.label);
      if (hasLab && r.w > 130) { icon(ctx, r.icon, r.x + 34, r.y + r.h / 2 + dy, isz, col); text(ctx, r.label, r.x + 56 + (r.w - 66) / 2, r.y + r.h / 2 + 8 + dy, Math.min(24, r.h * 0.36), col, { weight: 700 }); }
      else if (hasLab) { icon(ctx, r.icon, r.x + r.w / 2, r.y + r.h * 0.38 + dy, isz * 0.9, col); text(ctx, r.label, r.x + r.w / 2, r.y + r.h - 10 + dy, Math.min(18, r.h * 0.28), col, { weight: 700 }); }
      else icon(ctx, r.icon, r.x + r.w / 2, r.y + r.h / 2 + dy, isz, col);
      if (id === 'turn') text(ctx, `${P.turn * 45}°`, r.x + r.w / 2, r.y + r.h - 8 + dy, 15, col, { weight: 700 });
    } else if (r.label) text(ctx, r.label, r.x + r.w / 2, r.y + r.h / 2 + 8 + dy, Math.min(24, r.h * 0.4), col, { weight: 700 });
    ctx.restore();
  }
  void phase;
}
function drawSwatch(ctx, r, pid, sel, pressed) {
  const def = PAPERS[pid], dy = pressed ? 2 : 0;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h); g.addColorStop(0, def.c0); g.addColorStop(1, def.c1);
  ctx.fillStyle = g; rr(ctx, r.x + 2, r.y + 2 + dy, r.w - 4, r.h - 4, 12); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.strokeStyle = sel ? '#fff4d0' : 'rgba(0,0,0,0.35)'; ctx.lineWidth = sel ? 4 : 2; rr(ctx, r.x + 2, r.y + 2 + dy, r.w - 4, r.h - 4, 12); ctx.stroke();
  if (sel) { ctx.strokeStyle = VERM; ctx.lineWidth = 2; rr(ctx, r.x - 1, r.y - 1 + dy, r.w + 2, r.h + 2, 14); ctx.stroke(); }
  ctx.restore();
}

function drawAutoControls(ctx, S, P, R, A) {
  const a = S.auto;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  button(ctx, A.slower, [], 'normal', { pressed: pr('auto:slower'), r: 18 }); text(ctx, '-', A.slower.x + A.slower.w / 2, A.slower.y + A.slower.h / 2 + 14, 44, INK, { weight: 800 });
  button(ctx, A.faster, [], 'normal', { pressed: pr('auto:faster'), r: 18 }); text(ctx, '+', A.faster.x + A.faster.w / 2, A.faster.y + A.faster.h / 2 + 14, 44, INK, { weight: 800 });
  button(ctx, A.pause, [], a.paused ? 'primary' : 'normal', { pressed: pr('auto:pause'), r: 18 });
  icon(ctx, a.paused ? 'play' : 'pause', A.pause.x + A.pause.w / 2 - 54, A.pause.y + A.pause.h / 2, 40, a.paused ? '#fff8ee' : INK);
  text(ctx, a.paused ? tr('resume') : 'Pause', A.pause.x + A.pause.w / 2 + 14, A.pause.y + A.pause.h / 2 + 10, 28, a.paused ? '#fff8ee' : INK, { weight: 700 });
  text(ctx, `${THINK_STEPS[S.thinkIdx]} s`, A.pause.x + A.pause.w / 2, A.pause.y - 10, 20, CREAM_TEXT, { weight: 700 });
}

function statusChip(ctx, S, P, board, a) {
  let label = '', k = 0;
  if (a.paused) label = tr('autoPaused');
  else if (a.phase === 'think') { label = tr('autoThink'); k = clamp01(a.t / THINK_STEPS[S.thinkIdx]); }
  else if (a.phase === 'reveal') { label = tr('autoReveal'); k = clamp01(a.t / 2.2); }
  else if (a.phase === 'act') label = tr('autoAct');
  else if (a.phase === 'fold') label = tr('autoFold');
  else if (a.phase === 'unfold') label = tr('autoUnfold');
  else label = levelOf(P)?.name ?? '';
  const w = 260, h = 52, x = board.x + board.w / 2 - w / 2, y = board.y + 8;
  ctx.save(); ctx.fillStyle = 'rgba(249,241,224,0.94)'; rr(ctx, x, y, w, h, 26); ctx.fill(); ctx.strokeStyle = EDGE; ctx.lineWidth = 2; rr(ctx, x, y, w, h, 26); ctx.stroke();
  text(ctx, label, x + w / 2, y + 34, 26, INK, { weight: 700 });
  if (k > 0) { ctx.strokeStyle = VERM; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 24, y + h - 5); ctx.lineTo(x + 24 + (w - 48) * k, y + h - 5); ctx.stroke(); }
  ctx.restore();
}

function drawResult(ctx, S, P, R) {
  const rr0 = R.result, r = P.result, L = layout();
  if (!r) return;
  panel(ctx, rr0.x, rr0.y, rr0.w, rr0.h, { r: 22, blur: 14, dy: 5 });
  const lv = levelOf(P), sc = textScaleCap(S);
  let size = Math.round(24 * Math.min(sc, 1.6)), starsR = Math.min(34, rr0.w / 11);
  const btnTop = Math.min(...resultButtons(S, P, R).map((b) => b.y)) - 8;
  if (lv) {   // shrink the content until it clears the buttons (small landscape phones at large text zoom)
    const stat0 = `${tr('match')} ${Math.round(r.match * 100)}%  ·  ${tr('cuts')} ${r.cuts} (${tr('par')} ${r.par})  ·  ${tr('pieces')} ${r.pieces}`;
    const msg0 = r.stars >= 3 ? tr('stars3') : r.stars === 2 ? tr('stars2') : r.stars === 1 ? tr('stars1') : tr('stars0');
    for (;;) {
      const need = 20 + starsR * 2 + 14 + size * 1.2 + (wrap(stat0, Math.round(size * 0.9), rr0.w - 30).length + wrap(msg0, Math.round(size * 0.9), rr0.w - 40).length) * size * 1.2 + size * 0.4 + (r.newChapter != null ? size * 1.2 : 0);
      if (rr0.y + need <= btnTop || size <= 13) break;
      size -= 1; starsR = Math.max(16, starsR - 1.2);
    }
  }
  let y = rr0.y + 20;
  if (lv) {
    for (let i = 0; i < 3; i++) {
      const k = clamp01((P.revT - 0.4 - i * 0.3) / 0.45), s = k > 0 ? backOut(k) : 0;
      ctx.save(); ctx.translate(rr0.x + rr0.w / 2 + (i - 1) * starsR * 2.6, y + starsR); ctx.scale(s, s);
      star(ctx, 0, 0, starsR, i < r.stars ? '#e8b23a' : 'rgba(43,27,24,0.14)', i < r.stars ? '#b8821d' : null); ctx.restore();
    }
    y += starsR * 2 + 14;
    const trd = traditionOf(lv.tradition);
    if (trd) { text(ctx, `${trd.name} · ${trd.place}`, rr0.x + rr0.w / 2, y + size * 0.55, Math.round(size * 0.78), GOLD, { weight: 800, font: DISPLAY }); y += size * 1.2; }
    const stat = `${tr('match')} ${Math.round(r.match * 100)}%  ·  ${tr('cuts')} ${r.cuts} (${tr('par')} ${r.par})  ·  ${tr('pieces')} ${r.pieces}`;
    for (const ln of wrap(stat, Math.round(size * 0.9), rr0.w - 30)) { text(ctx, ln, rr0.x + rr0.w / 2, y + size * 0.6, Math.round(size * 0.9), INK, { weight: 700 }); y += size * 1.2; }
    y += size * 0.2;
    const msg = r.stars >= 3 ? tr('stars3') : r.stars === 2 ? tr('stars2') : r.stars === 1 ? tr('stars1') : tr('stars0');
    for (const ln of wrap(msg, Math.round(size * 0.9), rr0.w - 40)) { text(ctx, ln, rr0.x + rr0.w / 2, y + size * 0.6, Math.round(size * 0.9), INK2, { weight: 500 }); y += size * 1.2; }
    if (r.newChapter != null) text(ctx, `${tr('chapter')} ${r.newChapter + 1} open`, rr0.x + rr0.w / 2, y + size * 0.6, Math.round(size * 0.9), MOSS, { weight: 800 });
  } else {
    text(ctx, tr('done'), rr0.x + rr0.w / 2, y + size, Math.round(size * 1.3), VERM, { weight: 800, font: DISPLAY });
    y += size * 1.9;
    for (const ln of wrap(`Cut area ${Math.round(r.hole * 100)}%  ·  ${tr('cuts')} ${r.cuts}  ·  ${tr('pieces')} ${r.pieces}`, Math.round(size * 0.9), rr0.w - 30)) { text(ctx, ln, rr0.x + rr0.w / 2, y + size * 0.6, Math.round(size * 0.9), INK, { weight: 700 }); y += size * 1.2; }
    text(ctx, r.pieces <= 1 ? 'It holds together in one piece.' : `It falls into ${r.pieces} pieces.`, rr0.x + rr0.w / 2, y + size * 0.6, Math.round(size * 0.85), INK2, { weight: 500 });
  }
  for (const b of resultButtons(S, P, R)) {
    const pressed = S.press && S.press.id === `res:${b.id}` && S.press.active;
    button(ctx, b, [b.label], b.kind ?? 'normal', { size: Math.min(26, b.h * 0.38), disabled: b.disabled, pressed });
  }
  void L;
}

function drawPlay(ctx, S) {
  const P = S.play, L = layout();
  if (!P) { desk(ctx, L.w, L.h, S.t); return; }
  const def = PAPERS[P.paper];
  desk(ctx, L.w, L.h, S.t, 0.5, 0.12);
  const { R, cap, auto } = rectsFor(S, P);
  const a = S.scene === 'auto' ? S.auto : null;
  const pr = (id) => S.press && S.press.id === id && S.press.active;
  // header
  button(ctx, L.back, [], 'normal', { pressed: pr('hud:back') || pr('auto:exit'), r: 18 }); icon(ctx, 'back', L.back.x + L.back.w / 2 - 2, L.back.y + L.back.h / 2, 38, INK);
  if (!a && P.mode !== 'view') { button(ctx, L.pause, [], 'normal', { pressed: pr('hud:pause'), r: 18 }); icon(ctx, 'pause', L.pause.x + L.pause.w / 2, L.pause.y + L.pause.h / 2, 38, INK); }
  const lv = levelOf(P);
  const title = P.mode === 'studio' ? tr('studioBtn') : a ? tr('autoBtn') : P.mode === 'view' ? (P.title || tr('gallery')) : lv.name;
  text(ctx, title, L.titleC.x, L.titleC.y + 12, Math.min(44, (L.xr - L.xl - 200) / Math.max(4, title.length * 0.62)), CREAM_TEXT, { font: DISPLAY, weight: 800, shadow: 'rgba(0,0,0,0.5)', sy: 3 });
  // the mat and the paper
  mat(ctx, R.board, def.mat, { dark: def.mat[1] < '5' && def.mat[2] < '5' });
  const cam = camOf(P, R.board);
  const sc = sceneOf(P);
  const paper = paperFor(P);
  const lift = sc.mode.fold ? Math.max(0, ...sc.faces.map((F) => F.lift ?? 0)) : 0;
  paintBoard(ctx, S, P, R, cam, sc, paper, lift);
  ctx.save(); ctx.beginPath(); ctx.rect(R.board.x - 4, R.board.y - 4, R.board.w + 8, R.board.h + 8); ctx.clip();
  // overlays on the sheet: the mirror lines the folds will use
  if (P.phase === 'choose' && P.mode !== 'view') {
    const nmax = Math.max(...(P.mode === 'studio' ? SHEETS[P.sheet].folds : lv.folds)), ls = [];
    for (let k = 0; k < nmax; k++) ls.push(-90 + (180 * k) / nmax);
    ctx.save(); ctx.setLineDash([12, 10]); ctx.lineCap = 'round';
    ctx.strokeStyle = P.hintFold ? 'rgba(214,161,58,0.95)' : 'rgba(255,236,190,0.6)'; ctx.lineWidth = 3;
    for (const a of ls) {
      const r0 = rayDist(P.sheet, a), r1 = rayDist(P.sheet, a + 180), c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180);
      const p0 = project(cam, [c * r0, s * r0, 0.002]), p1 = project(cam, [-c * r1, -s * r1, 0.002]);
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
    }
    ctx.restore();
  }
  if (P.phase === 'cut') {
    for (const f of P.flash) { const k = f.t / 0.8; ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; drawCutGhost(ctx, cam, f.cut, '#fff6d8', { fill: 'rgba(255,246,216,0)', dash: [], w: 8 * (1 - k) + 2 }); ctx.restore(); }
    if (P.stroke && P.stroke.pts.length > 1) {
      const pp = P.stroke.pts.map((p) => project(cam, [p[0], p[1], 0]));
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); pp.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.closePath(); ctx.fillStyle = 'rgba(255,240,210,0.38)'; ctx.fill();
      ctx.setLineDash([]); ctx.strokeStyle = 'rgba(255,250,235,0.9)'; ctx.lineWidth = 7; ctx.beginPath(); pp.forEach((q, i) => ctx[i ? 'lineTo' : 'moveTo'](q[0], q[1])); ctx.stroke();
      ctx.strokeStyle = VERM; ctx.lineWidth = 3.4; ctx.stroke();
      ctx.setLineDash([8, 8]); ctx.strokeStyle = 'rgba(200,38,28,0.8)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(pp[pp.length - 1][0], pp[pp.length - 1][1]); ctx.lineTo(pp[0][0], pp[0][1]); ctx.stroke();
      ctx.restore();
      const e = pp[pp.length - 1]; icon(ctx, 'scissors', e[0] + 26, e[1] - 30, 54, '#2b1b18');
    }
    if (P.ghost) {
      drawCutGhost(ctx, cam, punch(P.shape, P.ghost.x, P.ghost.y, P.size, P.turn), VERM, { fill: 'rgba(255,246,222,0.55)', dash: [] });
      const g = project(cam, [P.ghost.x, P.ghost.y, 0]); ctx.strokeStyle = VERM; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g[0] - 9, g[1]); ctx.lineTo(g[0] + 9, g[1]); ctx.moveTo(g[0], g[1] - 9); ctx.lineTo(g[0], g[1] + 9); ctx.stroke();
    }
    if (P.hintCut >= 0 && lv && P.n === lv.ref) { const k = P.hintT; ctx.save(); ctx.globalAlpha = k < 0.3 ? k / 0.3 : k > 3.4 ? Math.max(0, (4 - k) / 0.6) : 1; drawCutGhost(ctx, cam, lv.cuts[P.hintCut], VERM, { fill: 'rgba(200,38,28,0.14)', w: 3.8 }); ctx.restore(); }
    if (a && (a.phase === 'think' || a.phase === 'reveal')) {
      const act = Math.floor(a.t / 0.8) % a.cands.length;
      a.cands.forEach((c, i) => {
        const real = c.real && a.phase === 'reveal', hot = a.phase === 'think' && act === i;
        if (a.phase === 'reveal' && !real) return;
        drawCutGhost(ctx, cam, c, real ? VERM : hot ? '#3a2420' : 'rgba(58,36,32,0.4)', { fill: real ? 'rgba(200,38,28,0.18)' : hot ? 'rgba(255,248,230,0.4)' : 'rgba(255,248,230,0.12)', w: hot || real ? 4.4 : 2.6 });
      });
    }
  }
  ctx.restore();
  drawParticles(ctx, S.particles);
  if (cap.boardThumb && lv) {
    const th = cap.boardThumb, bx = R.board.x + 16, by = R.board.y + 16;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; ctx.fillStyle = CARD; rr(ctx, bx - 8, by - 8, th + 16, th + 38, 16); ctx.fill(); ctx.restore();
    drawThumbBox(ctx, levelThumb(P.li), bx, by, th, th, def, { frame: EDGE }); text(ctx, 'TARGET', bx + th / 2, by + th + 20, 15, INK3, { weight: 800 });
  }
  // caption + controls
  drawCaption(ctx, S, P, R, a ? { ...cap, label: levelOf(P).name, lines: wrap(a.line ?? '', cap.size, cap.innerW), text: a.line } : cap);
  if (a) { statusChip(ctx, S, P, R.board, a); drawAutoControls(ctx, S, P, R, auto); }
  else if (P.phase === 'result' && P.mode !== 'view') drawResult(ctx, S, P, R);
  else drawTools(ctx, S, P, R);
  if (S.toast) {
    const w = Math.min(L.w - 40, 560), h = 64, x = (L.w - w) / 2, y = R.board.y + R.board.h * 0.5;
    ctx.save(); ctx.globalAlpha = clamp01(S.toastT * 2); ctx.fillStyle = 'rgba(43,27,24,0.9)'; rr(ctx, x, y, w, h, 18); ctx.fill();
    text(ctx, S.toast, x + w / 2, y + 41, 24, '#f9f1e0', { weight: 600 }); ctx.restore();
  }
}

export function render(ctx, S, ui) {
  bakeStep();
  const sc = S.scene;
  if (sc === 'title') drawTitle(ctx, S, ui);
  else if (sc === 'play' || sc === 'auto') drawPlay(ctx, S);
  else if (sc === 'demo-limit') {
    const L = layout(); desk(ctx, L.w, L.h, S.t);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, L.w, L.h);
    panel(ctx, ui.panel.x, ui.panel.y, ui.panel.w, ui.panel.h, {});
    drawDocBlocks(ctx, S, ui, S.scroll[ui.scrollKey] ?? 0); drawFixed(ctx, S, ui.fixed);
  } else drawDocScreen(ctx, S, ui);
  if (S.overlay) drawOverlay(ctx, S, ui);
  void rec; void RULES; void INK3; void CARD; void UI; void SIZE_NAMES; void wedgeAngles; void planOf; void CARD2;
}
