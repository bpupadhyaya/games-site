// Drawing for the play screen: the fixed table, balls, guide, cue, fine-aim magnifier, scoreboard and control bar. Pure: reads
// `state`, never mutates it (menus and pages live in menus.js). All text follows the 100-300% text size setting; the table region
// shrinks to make room instead of clipping.
import { TW, TL, R, CUE, POCKETS, GEOM, BAULK_Y, D_R, MID_X, SPOT, nameOf, ballById } from './sim.js';
import { makeCamera } from './cam.js';
import { W, H, TEXT_SCALES, playLayout, inRect } from './layout.js';
import { FONT, SERIF, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
import { drawBall, drawShadow, drawTable, bakedTable, drawCue, drawBridge, drawSpinFace, setHost, ballStyle, BALL } from './art.js';
import { onLabel, pointsLeft } from './rules.js';

const TAU = Math.PI * 2;
export const textScale = (state) => TEXT_SCALES[state.settings.textIdx];

// ---- layout and camera -----------------------------------------------------------------------------------------------------------
export function layoutFor(state) {
  const m = state.m;
  const kind = m && m.cfg.mode === 'watch' ? 'watch' : state.ctl === 'roll' ? 'roll' : state.ctl === 'verdict' ? 'verdict' : 'aim';
  return playLayout(textScale(state), kind);
}
let camKey = '', camCache = null;
export function camFor(state) {
  const sc = textScale(state);
  const key = String(sc);
  if (camKey !== key || !camCache) {
    const lay = playLayout(sc, 'aim');
    camCache = makeCamera(lay.regionTop, lay.regionBottom);
    camKey = key;
  }
  return camCache;
}
export const FINGER_LIFT = 58;
// Screen point (a finger) to a table point: the aim target sits a little above the finger so the finger never hides it.
export function aimToTable(cam, px, py) { return cam.unproj(px, py - FINGER_LIFT); }

export const interp = (b, a) => ({ x: b.ox === undefined ? b.x : b.ox + (b.x - b.ox) * a, y: b.oy === undefined ? b.y : b.oy + (b.y - b.oy) * a });

// pocket hole centres (same numbers the table art uses)
export function holeOf(i) {
  const p = POCKETS[i];
  if (p.kind === 'c') return { x: p.x < 0.5 ? -0.012 : TW + 0.012, y: p.y < 0.5 ? -0.012 : TL + 0.012, r: 0.085 };
  return { x: p.x < 0.5 ? -0.03 : TW + 0.03, y: p.y, r: 0.07 };
}

// ---- the table and balls -------------------------------------------------------------------------------------------------------
function drawBalls(ctx, cam, state) {
  const w = state.w;
  if (!w) return;
  const al = state.alpha ?? 1;
  const list = [];
  for (const b of w.b) {
    if (b.on) { const p = interp(b, al); list.push({ b, x: p.x, y: p.y, falling: false }); }
    else if (b.pt < 0.5 && b.pk >= 0 && !b.gone) list.push({ b, x: b.x, y: b.y, falling: true });
  }
  list.sort((a, c) => c.y - a.y);
  // shadows first so no shadow falls on a neighbouring ball
  for (const it of list) {
    if (it.falling) continue;
    const pr = cam.px(it.x, it.y), r = cam.ballR(it.y);
    drawShadow(ctx, pr[0], pr[1], r, 0.8, 0.4);
  }
  const hl = state.hl;
  for (const it of list) {
    const b = it.b;
    if (it.falling) {
      const hole = holeOf(b.pk), k = Math.min(1, b.pt / 0.42), e = k * k * (3 - 2 * k);
      const x = it.x + (hole.x - it.x) * e, y = it.y + (hole.y - it.y) * e;
      const [X, Y] = cam.px(x, y, R * (1 - 0.9 * e));
      ctx.save();
      ctx.beginPath();
      for (const [px, py] of [cam.px(0, 0), cam.px(TW, 0), cam.px(TW, TL), cam.px(0, TL)]) ctx.lineTo(px, py);
      ctx.closePath();
      for (let i = 0; i < 6; i++) { const h = holeOf(i); for (let j = 0; j < 24; j++) { const a = (j / 24) * TAU; const [qx, qy] = cam.px(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r); j ? ctx.lineTo(qx, qy) : ctx.moveTo(qx, qy); } ctx.closePath(); }
      ctx.clip();
      drawBall(ctx, X, Y, cam.ballR(y) * (1 - 0.55 * e), b.id, { alpha: 1 - 0.85 * e, mark: [b.mx, b.my, b.mz] });
      ctx.restore();
      continue;
    }
    const [X, Y] = cam.px(it.x, it.y, R), r = cam.ballR(it.y);
    let alpha = 1;
    if (b.respotted && b.rt !== undefined && b.rt < 0.5) alpha = 0.3 + 1.4 * b.rt;
    const glow = hl && hl.has && hl.has(b.id) ? 1 : 0;
    drawBall(ctx, X, Y, r, b.id, { alpha: Math.min(1, alpha), mark: [b.mx, b.my, b.mz], glow });
  }
}

// the D, lit while the white is in hand
function drawD(ctx, cam, state) {
  const a0 = state.t * 2;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = Math.PI + (i / 48) * Math.PI; const p = cam.px(MID_X + Math.cos(a) * D_R, BAULK_Y + Math.sin(a) * D_R); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  void a0;
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,224,120,0.16)'; ctx.fill();
  ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,120,0.95)'; ctx.stroke();
  ctx.restore();
}

// ---- guide, cue, hand marker -----------------------------------------------------------------------------------------------------
function dotted(ctx, cam, pts, col, wd, dash = [10, 9], z = 0.002) {
  if (pts.length < 2) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.setLineDash(dash); ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => { const p = cam.px(x, y, z); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); ctx.restore();
}
function drawGuide(ctx, cam, state) {
  const gd = state.guide, w = state.w, mode = state.settings.guide;
  if (!gd || mode === 0 || !w) return;
  const c = ballById(w, CUE);
  if (!c || !c.on) return;
  const ray = gd.ray;
  if (!ray) return;
  const al = state.alpha ?? 1; void al;
  if (mode === 2 && gd.pv) {
    const pv = gd.pv;
    dotted(ctx, cam, pv.cuePath, 'rgba(255,255,255,0.8)', 3, [4, 9]);
    if (pv.objPath.length > 1) dotted(ctx, cam, pv.objPath, 'rgba(255,214,90,0.95)', 3.4, [3, 8]);
    if (pv.cueEnd) { const [X, Y] = cam.px(pv.cueEnd.x, pv.cueEnd.y, R); drawBall(ctx, X, Y, cam.ballR(pv.cueEnd.y), 0, { ghost: true, alpha: 0.7 }); }
    if (ray.ghost) { const [X, Y] = cam.px(ray.ghost.x, ray.ghost.y, R); drawBall(ctx, X, Y, cam.ballR(ray.ghost.y), 0, { ghost: true, alpha: 0.9 }); }
    if (pv.potted && pv.potted.id !== CUE) {
      const hole = holeOf(pv.potted.p), [X, Y] = cam.px(hole.x, hole.y);
      ctx.save(); ctx.strokeStyle = 'rgba(120,255,170,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, cam.scaleAt(hole.y) * 0.1, 0, TAU); ctx.stroke(); ctx.restore();
    } else if (pv.potted && pv.potted.id === CUE) {
      const hole = holeOf(pv.potted.p), [X, Y] = cam.px(hole.x, hole.y);
      ctx.save(); ctx.strokeStyle = 'rgba(255,120,100,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(X, Y, cam.scaleAt(hole.y) * 0.1, 0, TAU); ctx.stroke(); ctx.restore();
    }
    return;
  }
  // line mode: the aim line to the first contact, the ghost white, the object ball's line and the white's tangent
  const pts = [[c.x, c.y], [ray.end.x, ray.end.y]];
  dotted(ctx, cam, pts, 'rgba(255,255,255,0.92)', 3.2, [11, 9]);
  if (ray.ghost) {
    const [X, Y] = cam.px(ray.ghost.x, ray.ghost.y, R);
    drawBall(ctx, X, Y, cam.ballR(ray.ghost.y), 0, { ghost: true, alpha: 0.9 });
    if (gd.obj) {
      dotted(ctx, cam, [[gd.obj.from.x, gd.obj.from.y], [gd.obj.to.x, gd.obj.to.y]], 'rgba(255,214,90,0.95)', 3.4, [3, 8]);
      if (gd.obj.pocket >= 0) {
        const hole = holeOf(gd.obj.pocket), [hx, hy] = cam.px(hole.x, hole.y);
        ctx.save(); ctx.strokeStyle = 'rgba(120,255,170,0.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy, cam.scaleAt(hole.y) * 0.1, 0, TAU); ctx.stroke(); ctx.restore();
      }
    }
    // the white's path after a plain (centre) strike: along the tangent
    const nx = ray.n.x, ny = ray.n.y, tx = -ny, ty = nx;
    const dx = Math.cos(state.aim.angle), dy = Math.sin(state.aim.angle);
    const sgn = dx * tx + dy * ty >= 0 ? 1 : -1;
    const len = 0.32 * Math.min(1, Math.sin(ray.cut * Math.PI / 180) + 0.15);
    dotted(ctx, cam, [[ray.ghost.x, ray.ghost.y], [ray.ghost.x + tx * sgn * len, ray.ghost.y + ty * sgn * len]], 'rgba(255,255,255,0.55)', 2.2, [4, 7]);
  } else {
    const [X, Y] = cam.px(ray.end.x, ray.end.y, R);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X, Y, cam.ballR(ray.end.y) * 0.6, 0, TAU); ctx.stroke(); ctx.restore();
  }
}

function drawCueAndHand(ctx, cam, state) {
  const w = state.w, c = w && ballById(w, CUE);
  if (!c || !c.on || state.ctl === 'roll' || state.ctl === 'verdict') return;
  if (state.phaseKind === 'place' && state.humanTurn) return;
  const a = state.aim;
  let pull = a.pulling ? a.pull : (state.stroke ? 0 : a.pull);
  let gap = 0.07 + pull * 0.34;
  let alpha = 1;
  if (state.stroke) {
    const k = Math.min(1, state.stroke.t / state.stroke.dur);
    const back = 0.16 + 0.1 * state.stroke.power;
    // pull back then drive forward
    if (k < 0.55) gap = 0.07 + back * (k / 0.55);
    else { const kk = (k - 0.55) / 0.45; gap = 0.07 + back * (1 - kk * kk) - 0.07 * kk * kk; }
  }
  drawBridge(ctx, cam, c.x, c.y, a.angle, 0.22 + gap * 0.0, alpha);
  drawCue(ctx, cam, c.x, c.y, a.angle, Math.max(0.0, gap), { alpha });
}

// ---- fx -----------------------------------------------------------------------------------------------------------------------------
function drawFx(ctx, cam, state) {
  for (const q of state.parts) {
    const k = q.t / q.max;
    const [X, Y] = cam.px(q.x, q.y, q.z ?? 0.01);
    ctx.save();
    if (q.kind === 2) {
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(X, Y, q.size * (0.35 + 0.9 * k), q.size * (0.35 + 0.9 * k) * 0.75, 0, 0, TAU); ctx.stroke();
    } else {
      ctx.globalAlpha = Math.max(0, 1 - k); ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(X, Y, q.size * (1 - 0.5 * k), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  for (const p of state.pops) {
    const k = p.t / p.max, [X, Y] = cam.px(p.x, p.y, 0.1);
    ctx.save(); ctx.globalAlpha = Math.min(1, 2.2 * (1 - k)); ctx.font = `800 ${p.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    textShadow(ctx, p.text, X, Y - 26 * k - 10, p.col, 4);
    ctx.restore();
  }
}

// ---- the fine-aim magnifier (fixed on screen; its picture follows the aim) ----------------------------------------------------------------
export const INSET_ZOOM = 560;   // px per metre
export function insetFocus(state) {
  const gd = state.guide, w = state.w, c = w && ballById(w, CUE);
  if (!c) return { x: MID_X, y: TL / 2 };
  if (gd && gd.ray && gd.ray.ghost) return { x: (gd.ray.ghost.x + gd.ray.obj.x) / 2, y: (gd.ray.ghost.y + gd.ray.obj.y) / 2 };
  const a = state.aim.angle;
  return { x: c.x + Math.cos(a) * 0.3, y: c.y + Math.sin(a) * 0.3 };
}
function drawInset(ctx, state, r, fs) {
  const w = state.w, c = w && ballById(w, CUE);
  ctx.save();
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, '#118045'); g.addColorStop(1, '#0a5c32');
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  const fo = insetFocus(state);
  const Z = INSET_ZOOM, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  const X = (x) => cx + (x - fo.x) * Z, Y = (y) => cy - (y - fo.y) * Z;
  // cloth edge and rails, if the window reaches them
  const rail = (x0, y0, x1, y1) => { ctx.fillStyle = '#5b3016'; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); };
  const left = X(0), right = X(TW), bot = Y(0), top = Y(TL);
  if (left > r.x) { rail(r.x, r.y, left, r.y + r.h); ctx.fillStyle = '#0a5a32'; ctx.fillRect(left - 0.058 * Z, r.y, 0.058 * Z, r.h); }
  if (right < r.x + r.w) { rail(right, r.y, r.x + r.w, r.y + r.h); ctx.fillStyle = '#0a5a32'; ctx.fillRect(right, r.y, 0.058 * Z, r.h); }
  if (bot < r.y + r.h) { rail(r.x, bot, r.x + r.w, r.y + r.h); ctx.fillStyle = '#0a5a32'; ctx.fillRect(r.x, bot, r.w, 0.058 * Z); }
  if (top > r.y) { rail(r.x, r.y, r.x + r.w, top); ctx.fillStyle = '#0a5a32'; ctx.fillRect(r.x, top - 0.058 * Z, r.w, 0.058 * Z); }
  if (w) {
    for (const b of w.b) {
      if (!b.on) continue;
      const bx = X(b.x), by = Y(b.y);
      if (bx < r.x - 40 || bx > r.x + r.w + 40 || by < r.y - 40 || by > r.y + r.h + 40) continue;
      drawShadow(ctx, bx, by, R * Z, 0.9, 0.35);
    }
    for (const b of w.b) {
      if (!b.on) continue;
      const bx = X(b.x), by = Y(b.y);
      if (bx < r.x - 40 || bx > r.x + r.w + 40 || by < r.y - 40 || by > r.y + r.h + 40) continue;
      drawBall(ctx, bx, by, R * Z, b.id, { mark: [b.mx, b.my, b.mz] });
    }
  }
  const gd = state.guide;
  if (gd && gd.ray && c && c.on && state.settings.guide !== 0) {
    const ray = gd.ray;
    ctx.save(); ctx.setLineDash([9, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y)); ctx.lineTo(X(ray.end.x), Y(ray.end.y)); ctx.stroke(); ctx.restore();
    if (ray.ghost) {
      drawBall(ctx, X(ray.ghost.x), Y(ray.ghost.y), R * Z, 0, { ghost: true, alpha: 0.95 });
      if (gd.obj) { ctx.save(); ctx.setLineDash([4, 8]); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.beginPath(); ctx.moveTo(X(gd.obj.from.x), Y(gd.obj.from.y)); ctx.lineTo(X(gd.obj.to.x), Y(gd.obj.to.y)); ctx.stroke(); ctx.restore(); }
    }
  } else if (c && c.on) {
    ctx.save(); ctx.setLineDash([9, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y)); ctx.lineTo(X(c.x + Math.cos(state.aim.angle) * 2), Y(c.y + Math.sin(state.aim.angle) * 2)); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,224,150,0.85)'; ctx.stroke();
  // caption and drag arrows
  ctx.save(); ctx.font = `700 ${Math.max(13, Math.round(fs * 0.62))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  roundPath(ctx, r.x + 8, r.y + 7, r.w - 16, Math.max(26, fs * 0.9), 10); ctx.fillStyle = 'rgba(6,24,16,0.72)'; ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillText('◄ Fine aim ►', r.x + r.w / 2, r.y + 7 + Math.max(26, fs * 0.9) / 2);
  ctx.restore();
}

// ---- scoreboard -----------------------------------------------------------------------------------------------------------------------------
export function drawHud(ctx, state, lay) {
  const { hud } = lay, f = state.f, m = state.m;
  if (!f || !m) return;
  const names = state.names, cur = f.turn;
  const x0 = 10, w0 = W - 20;
  panel(ctx, x0, hud.y, w0, hud.h - 4, { r: 22, fill: 'rgba(6,26,18,0.92)', stroke: 'rgba(214,170,80,0.55)' });
  const fs = hud.fs;
  const clip = (t, mw, px) => { ctx.font = `700 ${px}px ${FONT}`; let s = t; while (ctx.measureText(s).width > mw && s.length > 3) s = s.slice(0, -2); return s === t ? t : `${s}…`; };
  const wins = m.frames;
  const pips = (side) => `${m.cfg.best > 1 ? `${wins[side]}` : ''}`;
  const frameTxt = m.cfg.best > 1 ? `Frame ${m.frameNo} of ${m.cfg.best} · ` : '';
  const left = pointsLeft(f, state.w);
  const info1 = `On: ${onLabel(f)}`, info2 = `${f.visit > 0 ? `Break ${f.visit} · ` : ''}${left} left`;
  if (!hud.stacked) {
    // two halves: name + score
    for (const side of [0, 1]) {
      const mine = side === cur;
      const bx = side === 0 ? x0 + 8 : W / 2 + 4, bw = w0 / 2 - 12;
      if (mine && !f.over) { roundPath(ctx, bx, hud.y + 6, bw, 58 * (fs / 24), 16); ctx.fillStyle = 'rgba(214,170,80,0.22)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.stroke(); }
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f4eed8'; ctx.textAlign = side === 0 ? 'left' : 'right';
      ctx.font = `700 ${Math.round(fs * 0.95)}px ${FONT}`;
      const nameX = side === 0 ? bx + 14 : bx + bw - 14;
      const nm = clip(names[side] + (m.cfg.best > 1 ? `  (${wins[side]})` : ''), bw - 128, Math.round(fs * 0.95));
      ctx.font = `700 ${Math.round(fs * 0.95)}px ${FONT}`;
      ctx.fillText(nm, nameX, hud.y + 6 + 29 * (fs / 24));
      ctx.font = `800 ${Math.round(fs * 1.9)}px ${SERIF}`; ctx.textAlign = side === 0 ? 'right' : 'left';
      ctx.fillStyle = mine ? '#ffe08a' : '#ffffff';
      ctx.fillText(String(f.scores[side]), side === 0 ? bx + bw - 12 : bx + 12, hud.y + 6 + 29 * (fs / 24));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `600 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#cfe8d8';
    ctx.fillText(clip(`${frameTxt}${info1} · ${info2}`, w0 - 24, Math.round(fs * 0.86)), W / 2, hud.y + hud.h - 22 * (fs / 24));
  } else {
    const row = hud.row;
    for (const side of [0, 1]) {
      const mine = side === cur;
      const bx = side === 0 ? x0 + 8 : W / 2 + 4, bw = w0 / 2 - 12;
      if (mine && !f.over) { roundPath(ctx, bx, hud.y + 6, bw, row, 14); ctx.fillStyle = 'rgba(214,170,80,0.22)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,0.9)'; ctx.stroke(); }
      ctx.textBaseline = 'middle'; ctx.fillStyle = '#f4eed8'; ctx.textAlign = side === 0 ? 'left' : 'right';
      ctx.font = `700 ${Math.round(fs * 0.8)}px ${FONT}`;
      const sc = String(f.scores[side]);
      ctx.font = `800 ${Math.round(fs * 1.15)}px ${SERIF}`; const sw = ctx.measureText(sc).width;
      const nm = clip(names[side], bw - sw - 32, Math.round(fs * 0.8));
      ctx.font = `700 ${Math.round(fs * 0.8)}px ${FONT}`;
      ctx.fillText(nm, side === 0 ? bx + 12 : bx + bw - 12, hud.y + 6 + row / 2);
      ctx.font = `800 ${Math.round(fs * 1.15)}px ${SERIF}`; ctx.textAlign = side === 0 ? 'right' : 'left'; ctx.fillStyle = mine ? '#ffe08a' : '#ffffff';
      ctx.fillText(sc, side === 0 ? bx + bw - 10 : bx + 10, hud.y + 6 + row / 2);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#ffe9a8';
    ctx.fillText(clip(info1 + (f.visit > 0 ? ` · Break ${f.visit}` : ''), w0 - 24, Math.round(fs * 0.86)), W / 2, hud.y + 6 + row * 1.5 + 4);
    ctx.font = `600 ${Math.round(fs * 0.78)}px ${FONT}`; ctx.fillStyle = '#cfe8d8';
    ctx.fillText(clip(`${frameTxt}${left} left`, w0 - 24, Math.round(fs * 0.78)), W / 2, hud.y + 6 + row * 2.5 + 2);
  }
}

// ---- controls -----------------------------------------------------------------------------------------------------------------------------------
function drawPower(ctx, state, r, fs) {
  const a = state.aim;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(8,30,22,0.94)', stroke: a.pulling ? 'rgba(255,214,120,0.95)' : 'rgba(214,170,80,0.5)' });
  const disabled = !state.humanTurn || state.paused || state.ctl !== 'aim';
  const x0 = r.x + Math.round(fs * 3.4), x1 = r.x + r.w - 18, cy = r.y + r.h / 2;
  const T = x1 - x0 - 120;
  const pull = Math.max(0, Math.min(1, a.pulling ? a.pull : 0));
  // meter bed
  roundPath(ctx, x0, cy - 12, x1 - x0, 24, 12); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  if (pull > 0.005) {
    const wf = Math.max(10, (x1 - x0) * pull);
    const g = ctx.createLinearGradient(x1 - wf, 0, x1, 0);
    g.addColorStop(0, '#2fd37a'); g.addColorStop(0.55, '#e8d447'); g.addColorStop(1, '#f2503a');
    roundPath(ctx, x1 - wf, cy - 12, wf, 24, 12); ctx.fillStyle = g; ctx.fill();
  }
  // the cue slides left as the player pulls
  const tipX = x1 - 14 - pull * T;
  ctx.save();
  roundPath(ctx, r.x + 6, r.y + 4, r.w - 12, r.h - 8, 16); ctx.clip();
  const cy2 = cy;
  const bw = Math.max(6, r.h * 0.12);
  const grad = ctx.createLinearGradient(tipX - 380, 0, tipX, 0);
  grad.addColorStop(0, '#2a1408'); grad.addColorStop(0.45, '#5c3217'); grad.addColorStop(0.62, '#e0bc84'); grad.addColorStop(1, '#f2dcae');
  ctx.beginPath(); ctx.moveTo(tipX - 380, cy2 - bw * 1.6); ctx.lineTo(tipX - 12, cy2 - bw * 0.6); ctx.lineTo(tipX - 12, cy2 + bw * 0.6); ctx.lineTo(tipX - 380, cy2 + bw * 1.6); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();
  ctx.fillStyle = '#f4efe0'; ctx.fillRect(tipX - 12, cy2 - bw * 0.6, 8, bw * 1.2);
  ctx.fillStyle = '#3a78d8'; ctx.beginPath(); ctx.ellipse(tipX - 2, cy2, 5, bw * 0.6, 0, 0, TAU); ctx.fill();
  ctx.restore();
  // little white ball the cue is aimed at
  drawBall(ctx, x1 + 4, cy, 12, 0, {});
  // suggested power marker
  if (a.hint !== null && a.hint !== undefined) {
    const hx = x1 - 14 - a.hint * T + 0; ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.moveTo(hx, cy - 22); ctx.lineTo(hx - 9, cy - 36); ctx.lineTo(hx + 9, cy - 36); ctx.closePath(); ctx.fill();
  }
  // text
  ctx.fillStyle = disabled ? 'rgba(200,225,210,0.5)' : '#f4eed8'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(fs * 0.62)}px ${FONT}`;
  ctx.fillText('Power', r.x + 16, cy - fs * 0.45);
  ctx.font = `800 ${Math.round(fs * 0.95)}px ${SERIF}`; ctx.fillStyle = disabled ? 'rgba(200,225,210,0.5)' : pull > 0.005 ? '#ffe08a' : '#f4eed8';
  ctx.fillText(pull > 0.005 ? `${Math.round(pull * 100)}%` : '--', r.x + 16, cy + fs * 0.35);
  if (pull <= 0.005 && !disabled) {
    ctx.font = `600 ${Math.round(fs * 0.62)}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(244,238,216,0.85)';
    ctx.fillText('Pull back, release to shoot', (x0 + x1) / 2 - 20, cy - r.h * 0.3);
  }
}

function drawCtrlText(ctx, text, x, y, w, fs, color = '#f4eed8', align = 'center', lh = 1.25) {
  ctx.font = `600 ${fs}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  let yy = y;
  for (const l of wrapLines(ctx, text, w)) { ctx.fillText(l, align === 'center' ? x + w / 2 : x, yy); yy += fs * lh; }
  return yy;
}

export function drawControls(ctx, state, lay) {
  const c = lay.ctrl, kind = state.ctl;
  const watch = state.m && state.m.cfg.mode === 'watch';
  // bar background
  const bg = ctx.createLinearGradient(0, c.top, 0, H);
  bg.addColorStop(0, 'rgba(5,20,14,0.95)'); bg.addColorStop(1, 'rgba(4,14,10,1)');
  ctx.fillStyle = bg; ctx.fillRect(0, c.top - 2, W, H - c.top + 2);
  ctx.fillStyle = 'rgba(214,170,80,0.5)'; ctx.fillRect(0, c.top - 2, W, 2);
  const fs = c.fs, fsG = Math.min(c.fs, 40);
  if (watch) {
    ctx.textBaseline = 'alphabetic';
    drawCtrlText(ctx, state.wlabel || 'Watch & Learn', 20, c.labelY + fs * 0.9, W - 40, Math.round(fs * 0.82), '#ffe9a8');
    drawButton(ctx, c.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: Math.round(fs * 1.05) });
    drawButton(ctx, c.dec, 'Think −', { dark: true, size: Math.round(fs * 0.9) });
    drawButton(ctx, c.exit, 'Exit', { dark: true, size: Math.round(fs * 0.9) });
    drawButton(ctx, c.inc, 'Think +', { dark: true, size: Math.round(fs * 0.9) });
    return;
  }
  if (kind === 'roll') {
    drawCtrlText(ctx, state.rollLabel || 'The balls are rolling', 20, c.labelY + fs * 0.95, W - 40, Math.round(fs * 0.9), '#ffe9a8');
    drawButton(ctx, c.pause, 'Pause', { dark: true, size: Math.round(fs * 1.0) });
    drawButton(ctx, c.fast, state.ff ? 'Fast ▶▶' : 'Hold for fast', { dark: true, size: Math.round(fs * 0.9) });
    return;
  }
  if (kind === 'verdict') {
    const v = state.verdict ?? { title: '', lines: [], buttons: [] };
    ctx.textBaseline = 'alphabetic';
    let y = c.textTop + fs * 1.0;
    ctx.font = `800 ${Math.round(fs * 1.12)}px ${FONT}`; ctx.fillStyle = v.tone === 'bad' ? '#ffb6a0' : v.tone === 'good' ? '#9af0c0' : '#ffe9a8'; ctx.textAlign = 'center';
    for (const l of wrapLines(ctx, v.title, W - 40)) { ctx.fillText(l, W / 2, y); y += fs * 1.25; }
    for (const ln of v.lines) y = drawCtrlText(ctx, ln, 20, y, W - 40, Math.round(fs * 0.82), '#e6f2ea');
    const n = v.buttons.length;
    const rects = n === 1 ? [c.go] : n === 2 ? [c.half1, c.half2] : [c.go2, c.go];
    v.buttons.forEach((b, i) => drawButton(ctx, rects[i] ?? c.go, b.label, { primary: !!b.primary, dark: !b.primary, size: Math.round(fs * 1.0) }));
    return;
  }
  // aim
  drawPower(ctx, state, c.power, fsG);
  drawInset(ctx, state, c.inset, fsG);
  const guideLbl = ['Guide: Off', 'Guide: Line', 'Guide: Preview'][state.settings.guide];
  const dis = !state.humanTurn || state.paused;
  if (c.small) {
    const S = c.spin;
    drawSpinFace(ctx, S.x + S.w / 2, S.y + S.h / 2, S.w / 2 - 4, state.aim.a, state.aim.b, {});
    ctx.fillStyle = 'rgba(255,233,168,0.95)'; ctx.font = `700 ${Math.round(fs * 0.58)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    drawButton(ctx, c.think, state.think ? 'Thinking…' : 'Think', { dark: true, disabled: dis, size: Math.round(fs * 0.95) });
    drawButton(ctx, c.guide, guideLbl, { dark: true, size: Math.round(fs * 0.78) });
    drawButton(ctx, c.menu, 'Menu', { dark: true, size: Math.round(fs * 0.95) });
  } else {
    drawButton(ctx, c.shot, 'Spin', { dark: true, size: Math.round(fs * 0.95), sub: state.aim.a || state.aim.b ? 'set' : 'centre' });
    drawButton(ctx, c.think, state.think ? 'Thinking…' : 'Think', { dark: true, disabled: dis, size: Math.round(fs * 0.95) });
    drawButton(ctx, c.menu, 'Menu', { dark: true, size: Math.round(fs * 0.95) });
  }
}

function drawTarget(ctx, cam, state) {
  const t = state.lesson && state.lesson.def.target;
  if (!t) return;
  ctx.save(); ctx.setLineDash([8, 7]); ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,224,120,0.95)'; ctx.fillStyle = 'rgba(255,224,120,0.14)';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, p = cam.px(t.x + Math.cos(a) * t.r, t.y + Math.sin(a) * t.r); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}

// ---- the whole play screen -------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const lay = layoutFor(state), cam = camFor(state);
  setHost(ctx);
  const baked = bakedTable(ctx, cam, String(textScale(state)));
  if (baked) ctx.drawImage(baked, 0, 0); else drawTable(ctx, cam);
  if (state.f && state.f.inHand && state.humanTurn && state.ctl !== 'roll') drawD(ctx, cam, state);
  drawTarget(ctx, cam, state);
  drawGuide(ctx, cam, state);
  drawBalls(ctx, cam, state);
  drawCueAndHand(ctx, cam, state);
  drawFx(ctx, cam, state);
  drawHud(ctx, state, lay);
  drawControls(ctx, state, lay);
  drawToast(ctx, state, lay);
  drawCard(ctx, state, lay);
  if (state.paused && !state.pauseMenu && state.m && state.m.cfg.mode === 'watch') {
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, lay.regionTop, W, lay.regionBottom - lay.regionTop);
    ctx.font = `800 54px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; textShadow(ctx, 'Paused', W / 2, (lay.regionTop + lay.regionBottom) / 2, '#ffffff', 8); ctx.restore();
  }
}

export function cardRect(state, lay) {
  const big = lay.fs > 38;
  const fs = Math.round(26 * Math.min(lay.fs / 26, 1.4) * 0.78);
  const h = Math.round(fs * (big ? 2.6 : 3.7));
  return { x: 22, y: lay.regionTop + 8, w: W - 44, h, fs, big };
}
function drawCard(ctx, state, lay) {
  const k = state.card;
  if (!k) return;
  const r = cardRect(state, lay), fs = r.fs;
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = 'rgba(6,26,18,0.9)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,0.8)'; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${fs}px ${FONT}`; ctx.fillStyle = '#ffe08a';
  let t = wrapLines(ctx, k.title, r.w - 36)[0] ?? '';
  if (t.length < k.title.length) t = `${t.slice(0, -1)}…`;
  ctx.fillText(t, r.x + 18, r.y + fs * 1.15);
  if (!r.big) {
    ctx.font = `500 ${Math.round(fs * 0.86)}px ${FONT}`; ctx.fillStyle = '#e6f2ea';
    const lines = wrapLines(ctx, k.text, r.w - 36);
    let l0 = lines[0] ?? '';
    if (lines.length > 1) { while (ctx.measureText(`${l0}…`).width > r.w - 36 && l0.length > 4) l0 = l0.slice(0, -2); l0 += '…'; }
    ctx.fillText(l0, r.x + 18, r.y + fs * 2.2);
  }
  ctx.fillStyle = 'rgba(255,233,168,0.9)'; ctx.font = `700 ${Math.round(fs * 0.74)}px ${FONT}`; ctx.textAlign = 'right';
  ctx.fillText('Tap for the full reason', r.x + r.w - 16, r.y + r.h - 10);
}
function drawToast(ctx, state, lay) {
  if (state.toastT <= 0 || !state.toast || state.card) return;
  const fs = Math.round(lay.fs * 0.85);
  ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, state.toast, W - 90);
  const h = lines.length * fs * 1.25 + 24, w = Math.min(W - 40, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
  const y = lay.regionTop + 10, x = (W - w) / 2;
  ctx.save(); ctx.globalAlpha = Math.min(1, state.toastT * 3);
  roundPath(ctx, x, y, w, h, 20); ctx.fillStyle = 'rgba(6,26,18,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,120,0.7)'; ctx.stroke();
  ctx.fillStyle = '#f4eed8'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (1 + i * 1.25) - 4));
  ctx.restore();
}

// ---- attract table for the menus ---------------------------------------------------------------------------------------------------------------------
// A slowly drifting still life behind the menus: the baked table at a fixed place, a few balls, no motion.
export function drawAttract(ctx, state) {
  const lay = playLayout(1, 'aim');
  const cam = makeCamera(lay.regionTop, lay.regionBottom);
  setHost(ctx);
  ctx.fillStyle = '#07120d'; ctx.fillRect(0, 0, W, H);
  const baked = bakedTable(ctx, cam, 'attract');
  if (baked) ctx.drawImage(baked, 0, 0); else drawTable(ctx, cam);
  const balls = state.attract ?? [];
  for (const b of balls) {
    const [X, Y] = cam.px(b.x, b.y, R), r = cam.ballR(b.y);
    drawShadow(ctx, X, Y, r, 0.8, 0.4);
  }
  for (const b of balls) { const [X, Y] = cam.px(b.x, b.y, R); drawBall(ctx, X, Y, cam.ballR(b.y), b.id, { mark: [b.mx ?? 0, b.my ?? 0, b.mz ?? 1] }); }
}
void nameOf; void SPOT; void ballStyle; void BALL; void C; void drawButton; void inRect; void GEOM;
