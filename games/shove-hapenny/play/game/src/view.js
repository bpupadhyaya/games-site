// Drawing of the play screen and the board behind the menus. Pure drawing of `state` (game.js owns it).
import { W, H, TEXT_SCALES, playLayout, applyBoard, toScreen } from './layout.js';
import { R, TW, NEAR_Y, START_Y, BEDS, MU, BEDS_H, FAR_EDGE, bedOf } from './sim.js';
import { drawBoardStill, drawCoin, drawChalks, drawLamp, setRot, DISPLAY } from './art.js';
import { FONT, roundPath, drawButton, wrapLines, textShadow } from './ui.js';
import { PROFILES, HAND } from './ai.js';
import { beds, chalkTotals, perRound } from './match.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const BG_TOP = '#2a1409', BG_BOT = '#0b0503';

export function layoutOf(state) {
  const m = state.m;
  return playLayout(TEXT_SCALES[state.settings.textIdx], !!m && m.cfg.mode === 'watch');
}

// The bar top in lamplight: dark planks, a warm pool of light, a slow vignette.
export function drawBackdrop(ctx, t = 0) {
  if (v3.on) return;   // the 3D pub (table, wall, lamp) is behind the transparent 2D canvas
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, BG_TOP); g.addColorStop(1, BG_BOT);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // planks: long boards with a faint seam and grain
  const pw = 92;
  for (let x = 0, i = 0; x < W + pw; x += pw, i++) {
    ctx.fillStyle = i % 2 ? 'rgba(255,190,120,0.035)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(x, 0, pw, H);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, 0, 2, H);
    ctx.strokeStyle = 'rgba(255,196,130,0.05)'; ctx.lineWidth = 1;
    for (let k = 0; k < 4; k++) { const xx = x + 14 + k * 21; ctx.beginPath(); ctx.moveTo(xx, 0); ctx.bezierCurveTo(xx + 6, H * 0.3, xx - 5, H * 0.6, xx + 2, H); ctx.stroke(); }
  }
  const cx = W / 2 + Math.sin(t * 0.37) * 14, cy = H * 0.4;
  const r = ctx.createRadialGradient(cx, cy, 30, cx, cy, Math.max(W, H) * 0.75);
  r.addColorStop(0, 'rgba(255,196,110,0.30)'); r.addColorStop(0.55, 'rgba(255,150,70,0.07)'); r.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = r; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

export const nameOf = (state, side) => {
  const m = state.m, mode = m.cfg.mode;
  if (mode === 'two') return `Player ${side + 1}`;
  if (mode === 'solo') return 'You';
  if (mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
};

function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.5 + 0.5 * k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 0.8 + 2.2 * k; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * k), 0, TAU); ctx.stroke(); }
    else if (q.kind === 3) {
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(q.x, q.y); ctx.rotate(q.t * 6);
      const s = q.size * (0.4 + 0.6 * k);
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.38 : s, a = (i / 8) * TAU; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

const pathTrace = (ctx, tr, col, dash, w) => {
  if (!tr || tr.length < 4) return;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(tr[0], tr[1]);
  for (let i = 2; i < tr.length; i += 2) ctx.lineTo(tr[i], tr[i + 1]);
  ctx.stroke(); ctx.restore();
};

// The target marker: where the coin is meant to stop, with a small ellipse for the unsteadiness of the hand.
function drawMarker(ctx, a, col, withHand) {
  const dist = Math.hypot(a.tx - a.x, START_Y - a.ty);
  ctx.save();
  ctx.strokeStyle = col; ctx.lineWidth = 1.2; ctx.setLineDash([2.5, 4]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, START_Y); ctx.lineTo(a.tx, a.ty); ctx.stroke(); ctx.setLineDash([]);
  if (withHand) {
    const ang = Math.atan2(a.tx - a.x, START_Y - a.ty);
    ctx.save(); ctx.translate(a.tx, a.ty); ctx.rotate(-ang);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1.5, HAND.aim * 2.2), Math.max(1.5, dist * HAND.pow * 2.2), 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(a.tx, a.ty, 2.6, 0, TAU); ctx.moveTo(a.tx - 7, a.ty); ctx.lineTo(a.tx - 3.6, a.ty); ctx.moveTo(a.tx + 3.6, a.ty); ctx.lineTo(a.tx + 7, a.ty);
  ctx.moveTo(a.tx, a.ty - 7); ctx.lineTo(a.tx, a.ty - 3.6); ctx.moveTo(a.tx, a.ty + 3.6); ctx.lineTo(a.tx, a.ty + 7); ctx.stroke();
  ctx.restore();
}

// The board and everything on it, in world units.
// scene: { table, side, ready, aim, ghost, hint, moving, falls, parts, chalks, pulse, heel, dead, t, sides, showAim }
// ---- the 3D board: coins, slate and chalk are lit meshes (view3d/presenter.js); only the aim guides, dead-coin marks and
// sparkles are drawn here, projected through the same perspective camera (toScreen is v3-aware).
const ringPoly = (ctx, L, x, y, r, n = 28, lift = 0) => {
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, p = toScreen(L, x + Math.cos(a) * r, y + Math.sin(a) * r, lift); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
};
const lineW = (L, w) => Math.max(1.2, w * L.s * 0.8);
function trace3(ctx, L, tr, col, dash, w) {
  if (!tr || tr.length < 4) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [lw, a] of [[w * 3.2, 0.18], [w, 1]]) {
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash(a === 1 ? dash : []);
    ctx.beginPath();
    for (let i = 0; i < tr.length; i += 2) { const p = toScreen(L, tr[i], tr[i + 1], 1.4); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); }
    ctx.stroke();
  }
  ctx.restore();
}
function marker3(ctx, L, a, col, withHand) {
  const dist = Math.hypot(a.tx - a.x, START_Y - a.ty), w = lineW(L, 1.4);
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = col;
  ctx.lineWidth = w; ctx.setLineDash([w * 1.6, w * 3.2]);
  const p0 = toScreen(L, a.x, START_Y, 1.4), p1 = toScreen(L, a.tx, a.ty, 1.4);
  ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); ctx.setLineDash([]);
  if (withHand) {
    const ang = Math.atan2(a.tx - a.x, START_Y - a.ty), rx = Math.max(1.5, HAND.aim * 2.2), ry = Math.max(1.5, dist * HAND.pow * 2.2);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1, w * 0.6); ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * TAU, ex = Math.cos(t) * rx, ey = Math.sin(t) * ry, c = Math.cos(-ang), sn = Math.sin(-ang);
      const q = toScreen(L, a.tx + ex * c - ey * sn, a.ty + ex * sn + ey * c, 1.4); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y);
    }
    ctx.stroke();
  }
  // crosshair ring, glowing
  for (const [lw, al] of [[w * 3, 0.22], [w * 1.1, 1]]) {
    ctx.globalAlpha = al; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ringPoly(ctx, L, a.tx, a.ty, 2.8, 20, 1.4);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const q0 = toScreen(L, a.tx + dx * 3.8, a.ty + dy * 3.8, 1.4), q1 = toScreen(L, a.tx + dx * 8, a.ty + dy * 8, 1.4);
      ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function ghostRing3(ctx, L, g, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lineW(L, 1.5); ctx.shadowColor = col; ctx.shadowBlur = 8;
  ctx.beginPath(); ringPoly(ctx, L, g.x, g.y, R + 2.6, 32, 1.4); ctx.stroke(); ctx.restore();
}
function overlays3d(ctx, L, scene) {
  const u = L.s;
  for (const c of scene.table) {
    if (c.sc || bedOf(c) >= 0) continue;
    const p = toScreen(L, c.x, c.y, 2.4), a = toScreen(L, c.x + 3.4, c.y + 3.4, 2.4), b = toScreen(L, c.x - 3.4, c.y - 3.4, 2.4), a2 = toScreen(L, c.x + 3.4, c.y - 3.4, 2.4), b2 = toScreen(L, c.x - 3.4, c.y + 3.4, 2.4);
    ctx.save(); ctx.strokeStyle = 'rgba(255,120,90,0.97)'; ctx.lineWidth = Math.max(2, 1.6 * u); ctx.lineCap = 'round'; ctx.shadowColor = 'rgba(255,60,30,0.8)'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y); ctx.stroke(); ctx.restore();
    void p;
  }
  const side = scene.side ?? 0;
  if (scene.hint) {
    const h = scene.hint;
    trace3(ctx, L, h.trace, 'rgba(255,214,90,0.95)', [lineW(L, 3), lineW(L, 5)], lineW(L, 1.8));
    marker3(ctx, L, h, 'rgba(255,214,90,0.95)', false);
    if (h.ghost) ghostRing3(ctx, L, h.ghost, 'rgba(255,214,90,0.95)');
  }
  if (scene.ready && scene.showAim) {
    const a = scene.aim;
    trace3(ctx, L, scene.guideTrace, 'rgba(255,255,255,0.7)', [lineW(L, 2), lineW(L, 5)], lineW(L, 1.4));
    marker3(ctx, L, a, 'rgba(255,255,255,0.97)', true);
    if (scene.ghost) ghostRing3(ctx, L, scene.ghost, 'rgba(255,255,255,0.85)');
  }
  void side;
  // sparkles and rings from impacts and scores (the sim's own particle list)
  for (const q of scene.parts) {
    const k = 1 - q.t / q.max;
    if (k <= 0) continue;
    const p = toScreen(L, q.x, q.y, 4 + 6 * (1 - k));
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, q.size * (0.5 + 0.5 * k) * u * 0.8), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.globalAlpha = k * 0.85; ctx.strokeStyle = q.col; ctx.lineWidth = Math.max(1, (0.8 + 2.2 * k) * u * 0.7); ctx.beginPath(); ringPoly(ctx, L, q.x, q.y, q.size * (1 - k * k), 24, 2); ctx.stroke(); }
    else if (q.kind === 3) {
      ctx.globalAlpha = k; ctx.fillStyle = q.col; ctx.translate(p.x, p.y); ctx.rotate(q.t * 6);
      const s = q.size * (0.4 + 0.6 * k) * u * 0.9;
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? s * 0.34 : s, ang = (i / 8) * TAU; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

export function drawScene(ctx, L, scene, raw = false) {
  if (v3.on && !raw) { v3.scene = scene; overlays3d(ctx, L, scene); return; }
  ctx.save();
  if (!raw) { setRot(L.rot); applyBoard(ctx, L); }
  drawBoardStill(ctx);
  drawLamp(ctx, scene.t ?? 0);
  drawChalks(ctx, scene.chalks, scene.pulse, scene.sides ?? 2);
  const side = scene.side ?? 0;
  for (const d of scene.dead ?? []) {
    const k = d.t / d.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); drawCoin(ctx, d.x + d.vx * k * 0.3, d.y + d.vy * k * 0.3, d.side, { r: R * (1 - 0.3 * k), shadow: false }); ctx.restore();
  }
  for (const c of scene.table) {
    drawCoin(ctx, c.x, c.y, c.side);
    if (c.sc) {
      // chalked: a small bright pip, so a coin that has scored is told apart from one that is still dead
      ctx.fillStyle = 'rgba(255,250,220,0.95)'; ctx.beginPath(); ctx.arc(c.x, c.y, 1.7, 0, TAU); ctx.fill();
    } else if (bedOf(c) < 0) {
      ctx.save(); ctx.fillStyle = 'rgba(16,8,4,0.42)'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,90,0.95)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(c.x - 3.4, c.y - 3.4); ctx.lineTo(c.x + 3.4, c.y + 3.4); ctx.moveTo(c.x + 3.4, c.y - 3.4); ctx.lineTo(c.x - 3.4, c.y + 3.4); ctx.stroke();
      ctx.restore();
    }
  }
  if (scene.hint) {
    const h = scene.hint;
    pathTrace(ctx, h.trace, 'rgba(255,214,90,0.9)', [3, 5], 1.8);
    drawMarker(ctx, h, 'rgba(255,214,90,0.95)', false);
    if (h.ghost) drawCoin(ctx, h.ghost.x, h.ghost.y, side, { alpha: 0.55, shadow: false, ring: 'rgba(255,214,90,0.95)' });
  }
  if (scene.ready) {
    const a = scene.aim;
    if (scene.showAim) {
      pathTrace(ctx, scene.guideTrace, 'rgba(255,255,255,0.55)', [2, 5], 1.4);
      drawMarker(ctx, a, 'rgba(255,255,255,0.95)', true);
      if (scene.ghost) drawCoin(ctx, scene.ghost.x, scene.ghost.y, side, { alpha: 0.5, shadow: false, ring: 'rgba(255,255,255,0.85)' });
    }
    drawCoin(ctx, a.x, START_Y, side, { lift: 1.0, ring: scene.readyGlow ? 'rgba(255,240,200,0.7)' : null });
  }
  if (scene.heel) {
    const h = scene.heel, k = Math.min(1, h.t / 0.22);
    ctx.save(); ctx.globalAlpha = Math.max(0, 0.85 * (1 - k));
    const y = START_Y + 15 - 15 * Math.min(1, k * 3);
    roundPath(ctx, h.x - 13, y, 26, 18, 8); ctx.fillStyle = '#d6a47c'; ctx.fill(); ctx.strokeStyle = 'rgba(80,40,20,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  }
  if (scene.moving) drawCoin(ctx, scene.moving.x, scene.moving.y, scene.moving.side, { lift: 0.5 });
  for (const f of scene.falls) {
    ctx.save(); const k = Math.min(1, f.t / f.max); ctx.globalAlpha = 1 - k;
    drawCoin(ctx, f.x, f.y, f.side, { r: R * (1 - 0.45 * k), shadow: false }); ctx.restore();
  }
  drawParts(ctx, scene.parts);
  ctx.restore();
}

// ---- HUD --------------------------------------------------------------------------------------------------------------
function card(ctx, r, name, big, sub, active, L, fs, side) {
  if (v3.on) v3.panels.push({ r, rad: 16, kind: active ? 'cardOn' : 'card', side });
  else {
    roundPath(ctx, r.x, r.y + 3, r.w, r.h, 16); ctx.fillStyle = 'rgba(8,4,0,0.45)'; ctx.fill();
    roundPath(ctx, r.x, r.y, r.w, r.h, 16);
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, active ? '#5a3418' : '#3a2410'); g.addColorStop(1, active ? '#3e2210' : '#27160a');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? '#ffd97a' : 'rgba(255,214,150,0.3)'; ctx.stroke();
  }
  drawCoin(ctx, r.x + 23, r.y + 24, side, { r: 12, shadow: false });
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.font = `700 ${fs.name}px ${FONT}`; ctx.fillStyle = '#fff3d8';
  let nm = name; while (ctx.measureText(nm).width > r.w - 150 && nm.length > 4) nm = nm.slice(0, -2);
  ctx.fillText(nm === name ? nm : `${nm}…`, r.x + 44, r.y + 6 + fs.name * 0.9);
  ctx.textAlign = 'right'; ctx.font = `800 ${fs.score}px ${DISPLAY}`; ctx.fillStyle = '#ffd97a';
  ctx.fillText(big, r.x + r.w - 14, r.y + r.h - 12);
  const bigW = ctx.measureText(big).width, room = r.w - 28 - bigW - 10;
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,238,200,0.82)';
  // the small line never runs under the score: shrink it a little, then fall back to its short form
  let sf = fs.sub, line = sub;
  ctx.font = `400 ${sf}px ${FONT}`;
  while (ctx.measureText(line).width > room && sf > fs.sub * 0.72) { sf -= 1; ctx.font = `400 ${sf}px ${FONT}`; }
  if (ctx.measureText(line).width > room && line.includes(' · ')) {
    line = line.split(' · ')[0]; sf = fs.sub; ctx.font = `400 ${sf}px ${FONT}`;
    while (ctx.measureText(line).width > room && sf > fs.sub * 0.72) { sf -= 1; ctx.font = `400 ${sf}px ${FONT}`; }
  }
  ctx.fillText(line, r.x + 14, r.y + r.h - 14);
}

export function infoText(state) {
  const m = state.m;
  if (m.over) return 'Match over';
  const sd = nameOf(state, m.side ?? 0);
  const rd = `Round ${m.round + 1}`;
  const per = perRound(m);
  const mine = m.sides === 1 ? m.idx + 1 : Math.floor(m.idx / 2) + 1;
  void per;
  return `${rd} · ${sd}: coin ${Math.min(5, mine)} of 5`;
}

export function renderPlay(ctx, state) {
  const m = state.m, L = layoutOf(state), fs = L.fs;
  drawBackdrop(ctx, state.t);
  const scene = sceneOf(state);
  drawScene(ctx, L, scene);
  const nb = beds(m), ct = chalkTotals(m);
  const names = [0, 1].map((s) => nameOf(state, s));
  const sub = (s) => `${ct[s]} chalk${ct[s] === 1 ? '' : 's'} · of ${m.target} beds`;
  card(ctx, L.cards[0], names[0], `${nb[0]}`, sub(0), m.side === 0 && !m.over, L, fs, 0);
  if (m.sides === 2) card(ctx, L.cards[1], names[1], `${nb[1]}`, sub(1), m.side === 1 && !m.over, L, fs, 1);
  else card(ctx, L.cards[1], 'Best run', state.record.bestSolo ? `${state.record.bestSolo}` : '-', 'fewest rounds', false, L, fs, 1);
  const I = L.info;
  ctx.fillStyle = 'rgba(255,238,200,0.92)'; ctx.font = `600 ${fs.info}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const lines = wrapLines(ctx, infoText(state), I.w);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, I.x + I.w / 2, I.y + fs.info * (1.05 + i * 1.2)));
  if (L.btns) {
    const human = state.humanTurn && !state.act && !m.over;
    drawButton(ctx, L.btns.hint, state.hintBusy ? 'Thinking…' : 'Hint', { size: fs.btn, disabled: !human || state.hintBusy });
    drawButton(ctx, L.btns.menu, 'Menu', { size: fs.btn, dark: true });
  }
  if (L.demo) {
    const D = L.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: Math.min(fs.btn, 30) });
    drawButton(ctx, D.dec, 'Think −', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { size: Math.min(fs.btn, 26), disabled: state.settings.thinkIdx === 3 });
    drawButton(ctx, D.exit, 'Leave Watch & Learn', { size: Math.min(fs.btn, 26), dark: true });
  }
  for (const p of state.pops) {
    const s = toScreen(L, p.x, p.y), k = p.t / p.max;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(p.size * (1 + 0.2 * Math.min(1, k * 6)))}px ${DISPLAY}`;
    textShadow(ctx, p.text, s.x, s.y - 50 * k, p.col, 6);
    ctx.restore();
  }
  if (state.toastT > 0 && state.toast) {
    ctx.save();
    const tf = Math.min(Math.round(fs.info), 30);
    ctx.font = `700 ${tf}px ${FONT}`;
    const tl = wrapLines(ctx, state.toast, Math.min(W - 60, 640));
    const tw = Math.max(...tl.map((l) => ctx.measureText(l).width)) + 36, th = tl.length * tf * 1.25 + 18;
    const ctrl = L.btns ? Math.min(...Object.values(L.btns).map((b) => b.y)) : L.demo ? Math.min(...Object.values(L.demo).map((b) => b.y)) : H;
    const below = Math.min(H, ctrl) - (L.rect.y + L.rect.h);
    const ty = below > th + 24 && !L.land ? L.rect.y + L.rect.h + 10 : L.rect.y + L.rect.h * 0.5 - th / 2;
    roundPath(ctx, W / 2 - tw / 2, ty, tw, th, 16); ctx.fillStyle = 'rgba(14,7,2,0.84)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff3d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    tl.forEach((l, i) => ctx.fillText(l, W / 2, ty + 9 + (i + 0.5) * tf * 1.25));
    ctx.restore();
  }
  if (state.pass) {
    ctx.fillStyle = 'rgba(8,4,0,0.8)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 ${Math.round(56 * Math.min(1.3, TEXT_SCALES[state.settings.textIdx]))}px ${DISPLAY}`;
    textShadow(ctx, `${nameOf(state, m.side)}`, W / 2, H / 2 - 20, '#ffd97a', 8);
    ctx.font = `600 ${Math.round(28 * Math.min(1.5, TEXT_SCALES[state.settings.textIdx]))}px ${FONT}`; ctx.fillStyle = '#fff3d8';
    wrapLines(ctx, 'Hand the phone over, then tap to play your coin.', W - 120).forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 30 + i * 38));
  }
}

// What the board shows right now.
export function sceneOf(state) {
  const m = state.m, side = m.side;
  return {
    side, sides: m.sides, t: state.t,
    table: (state.world ? state.world.coins : m.table).filter((c) => !c.out && c !== state.moving),
    moving: state.moving, falls: state.falls, parts: state.parts, dead: state.dead,
    chalks: displayChalks(state), pulse: state.pulse,
    aim: state.aim, ghost: state.ghost, guideTrace: state.guideTrace, showAim: state.showAim,
    hint: state.hint, heel: state.heel,
    ready: !state.act && !m.over && !state.moving && !state.pendingOver,
    readyGlow: state.humanTurn,
  };
}
// The chalks appear one by one a moment after the coin comes to rest.
const displayChalks = (state) => state.shown;
void NEAR_Y; void BEDS; void MU; void BEDS_H; void FAR_EDGE; void TW;
