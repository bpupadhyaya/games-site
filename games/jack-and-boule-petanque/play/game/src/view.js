// Drawing for the play screen (pitch, balls, aim guide, HUD, control bar, overlays). Pure: reads
// `state`, never mutates it. Menus, pages and settings live in menus.js.
import { W, H, project, depthScale } from './cam.js';
import { LANE, JACK_ZONE, LOFTS, SPINS, HAND_Z, R_B, R_J, flightPath, rollOutEstimate, reachFor, theJack, ranking, dist2D } from './sim.js';
import { bakePitch, drawBoule, drawJack, dustSprite, bouleSprite, palOf, TEAM, setHost, canBake } from './art.js';
import { LOFT_BTN, SPIN_BTN, HINT_BTN, MENU_BTN, HUD, PULL, FAST_BTN, DEMO_BAR, THINK_STEPS } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, textShadow, wrapLines } from './ui.js';
import { PROFILES } from './opponents.js';

const TAU = Math.PI * 2;
const pitchCache = new Map();
let bakeWait = 0, bakeKey = '';
const LOAD_BEAT = 7;   // frames of "Raking the gravel…" shown before the one-off pitch bake, so the pause reads as a loading beat
export function invalidatePitch() { pitchCache.clear(); bakeWait = 0; }
function artRes(ctx) {
  try { const a = typeof ctx.getTransform === 'function' ? ctx.getTransform().a : 2; return Math.min(2, Math.max(1, Math.ceil(a * 2) / 2)); } catch { return 2; }
}

// ---- helpers ------------------------------------------------------------------------------------
const shadowGrad = (ctx, x, y, rx, ry, a) => {
  ctx.save();
  ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(28,16,6,${a})`); g.addColorStop(0.6, `rgba(28,16,6,${a * 0.6})`); g.addColorStop(1, 'rgba(28,16,6,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill();
  ctx.restore();
};
export const ballScreen = (b) => {
  const p = project(b.x, b.y, b.z + b.r);
  return { x: p.x, y: p.y, r: b.r * p.s, s: p.s };
};
const restPos = () => project(0, -6, HAND_Z + R_B);

function drawGroundShadow(ctx, b) {
  const h = b.z + b.r;
  const sp = project(b.x + h * 0.5, b.y - h * 0.38, 0);
  const ds = depthScale(b.y);
  const rx = b.r * sp.s * (1.12 + h * 0.003), ry = rx * (ds / sp.s) * 0.95;
  const fade = b.out ? Math.max(0, 1 - b.fade) : 1;
  shadowGrad(ctx, sp.x, sp.y, rx * 1.15, ry * 1.15, 0.46 * (1 - Math.min(0.65, b.z / 160)) * fade);
}

function drawParticles(ctx, parts) {
  const sp = dustSprite();
  for (const q of parts) {
    const k = q.t / q.max;
    const p = project(q.x, q.y, q.z);
    if (q.kind === 2) {
      const r = (4 + k * 26) * p.s * 0.5;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k) * 0.8; ctx.strokeStyle = '#fff6d8'; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.8, 0, 0, TAU); ctx.stroke(); ctx.restore();
    } else if (q.kind === 1) {
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k); ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 2.4;
      const p2 = project(q.x - q.vx * 0.03, q.y - q.vy * 0.03, q.z - q.vz * 0.03);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.restore();
    } else if (sp) {
      const r = (q.size + k * q.size * 1.8) * p.s;
      ctx.globalAlpha = Math.max(0, (1 - k) * (1 - k)) * q.a;
      ctx.drawImage(sp, p.x - r, p.y - r * 0.8, r * 2, r * 1.6);
      ctx.globalAlpha = 1;
    }
  }
}

function drawDots(ctx, pts, color, r0 = 3.2) {
  ctx.fillStyle = color;
  pts.forEach((q, i) => {
    const p = project(q.x, q.y, q.z + R_B);
    ctx.globalAlpha = 0.45 + 0.55 * (i / Math.max(1, pts.length - 1));
    const rr = r0 * (0.8 + 0.6 * p.s / 3.3);
    ctx.fillStyle = 'rgba(30,16,6,0.55)'; ctx.beginPath(); ctx.arc(p.x + 1, p.y + 1.5, rr + 1.2, 0, TAU); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
  });
  ctx.globalAlpha = 1;
}
function groundRing(ctx, x, y, r, color, width = 3.5, fill = null) {
  const p = project(x, y, 0), rx = r * p.s, ry = rx * (depthScale(y) / p.s);
  ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = width; ctx.strokeStyle = color; ctx.stroke();
}

// ---- the throw guide ---------------------------------------------------------------------------
function drawGuide(ctx, state, p, t) {
  const m = state.m, jack = m.phase === 'jack';
  const col = jack ? '#ffe9a0' : '#fff6e2';
  const loft = p.loft;
  const pulse = (Math.sin(t * 6) + 1) / 2;
  if (state.settings.calm && state.preview) {
    const pv = state.preview;
    drawDots(ctx, pv.path.filter((_, i) => i % 1 === 0), 'rgba(255,246,226,0.9)', 2.6);
    groundRing(ctx, pv.rest.x, pv.rest.y, R_B * 1.15, 'rgba(255,246,226,0.95)', 3, `rgba(255,246,226,${0.12 + pulse * 0.1})`);
    if (pv.land && loft !== 0) groundRing(ctx, pv.land.x, pv.land.y, 4, 'rgba(120,200,255,0.9)', 2.5);
    return;
  }
  const d = reachFor(loft, p.power), sa = Math.sin(p.ang), ca = Math.cos(p.ang);
  if (loft === 0) {
    // rolled: a ground line to where it should stop on flat gravel
    const pts = [];
    for (let i = 4; i <= 24; i++) { const k = i / 24; pts.push({ x: sa * d * k, y: ca * d * k, z: -R_B + 1 }); }
    drawDots(ctx, pts, col, 2.6);
    groundRing(ctx, sa * d, ca * d, R_B * 1.15, col, 3.5, `rgba(255,246,226,${0.14 + pulse * 0.12})`);
    return;
  }
  const path = flightPath(p, 1 / 18);
  drawDots(ctx, path.slice(1, -1), col, 3.2);
  const land = path[path.length - 1];
  groundRing(ctx, land.x, land.y, R_B * 1.1, 'rgba(120,200,255,0.95)', 3.5, `rgba(120,200,255,${0.14 + pulse * 0.12})`);
  const roll = rollOutEstimate(p);
  if (roll > 6) {
    const ch = [];
    for (let k = 0.15; k <= 1.001; k += 0.2) ch.push({ x: land.x + sa * roll * k, y: land.y + ca * roll * k, z: -R_B + 1 });
    drawDots(ctx, ch, 'rgba(255,230,160,0.9)', 2.4);
    groundRing(ctx, land.x + sa * roll, land.y + ca * roll, R_B * 0.9, 'rgba(255,230,160,0.55)', 2.4);
  }
}

// ---- slingshot ---------------------------------------------------------------------------------
function drawSling(ctx, state, humanTurn) {
  const base = restPos();
  const dr = state.drag ?? state.aiDrag;
  let bx = base.x, by = base.y;
  if (dr) {
    bx += dr.vx * PULL.draw * Math.min(1, PULL.max / Math.max(1, dr.len)); by += dr.vy * PULL.draw * Math.min(1, PULL.max / Math.max(1, dr.len));
  }
  const lp = project(-30, -4, 0), rp = project(30, -4, 0), lt = project(-30, -4, 40), rt = project(30, -4, 40);
  // posts
  for (const [a, b] of [[lp, lt], [rp, rt]]) {
    const g = ctx.createLinearGradient(a.x - 6, 0, a.x + 6, 0);
    g.addColorStop(0, '#6a4a2c'); g.addColorStop(0.5, '#b88a58'); g.addColorStop(1, '#4e341c');
    ctx.strokeStyle = g; ctx.lineWidth = 11 * (a.s / 3.3); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const tension = dr ? Math.min(1, dr.len / PULL.max) : 0;
  // band
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const t of [lt, rt]) {
    ctx.strokeStyle = 'rgba(30,16,6,0.4)'; ctx.lineWidth = 8 - tension * 3; ctx.beginPath(); ctx.moveTo(t.x + 2, t.y + 3); ctx.lineTo(bx + 2, by + 3); ctx.stroke();
    ctx.strokeStyle = `rgb(${150 + tension * 70},${88 - tension * 20},${50 - tension * 15})`; ctx.lineWidth = 7 - tension * 3;
    ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(bx, by); ctx.stroke();
  }
  if (state.hint && !dr) {
    const len = PULL.min + state.hint.power * (PULL.max - PULL.min);
    const gx = base.x - Math.sin(state.hint.ang) * len * PULL.draw, gy = base.y + Math.cos(state.hint.ang) * len * PULL.draw;
    ctx.save(); ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(255,236,160,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(gx, gy); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(gx, gy, R_B * base.s * 0.95, 0, TAU); ctx.fill(); ctx.restore();
  }
  // shadow of the held boule
  const side = state.m.turn;
  const rpx = R_B * base.s * 1.0;
  shadowGrad(ctx, bx + rpx * 0.5, by + rpx * 1.2 + (dr ? 0 : 6), rpx * 1.1, rpx * 0.55, 0.38);
  // pouch + ball
  ctx.fillStyle = '#4a2e1a'; ctx.beginPath(); ctx.ellipse(bx, by + rpx * 0.15, rpx * 1.15, rpx * 0.95, 0, 0, TAU); ctx.fill();
  const heldJack = state.m.phase === 'jack';
  if (heldJack) drawJack(ctx, bx, by, R_J * base.s * 1.0 + 3);
  else drawBoule(ctx, side, bx, by, rpx, state.heldN ?? [0.3, 0.2, 0.93]);
  return { bx, by };
}

function drawSnap(ctx, state) {
  const sn = state.snap;
  if (!sn || sn.t > 0.7) return;
  const base = restPos();
  const lp = project(-30, -4, 40), rp = project(30, -4, 40);
  const k = Math.exp(-7 * sn.t) * Math.cos(26 * sn.t);
  const f = Math.min(1, PULL.max / Math.max(1, sn.len));
  const bx = base.x - sn.vx * PULL.draw * f * k * 0.35, by = base.y - sn.vy * PULL.draw * f * k * 0.35;
  for (const [a, b] of [[project(-30, -4, 0), lp], [project(30, -4, 0), rp]]) {
    const g = ctx.createLinearGradient(a.x - 6, 0, a.x + 6, 0);
    g.addColorStop(0, '#6a4a2c'); g.addColorStop(0.5, '#b88a58'); g.addColorStop(1, '#4e341c');
    ctx.strokeStyle = g; ctx.lineWidth = 11 * (a.s / 3.3); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#a05830'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(bx, by); ctx.lineTo(rp.x, rp.y); ctx.stroke();
}

// ---- HUD ---------------------------------------------------------------------------------------
function sideName(state, side) {
  const m = state.m;
  if (m.cfg.mode === 'watch') return side === 0 ? PROFILES[m.cfg.watchA ?? 3].name : PROFILES[m.cfg.opp].name;
  if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
}
export { sideName };

function drawHud(ctx, state, t) {
  const m = state.m;
  // gradient scrim so text reads over the sky
  const g = ctx.createLinearGradient(0, 0, 0, HUD.h + 30);
  g.addColorStop(0, 'rgba(24,14,6,0.78)'); g.addColorStop(0.8, 'rgba(24,14,6,0.5)'); g.addColorStop(1, 'rgba(24,14,6,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HUD.h + 30);
  for (const side of [0, 1]) {
    const x = side === 0 ? 20 : W - 20 - 300, active = m.turn === side && (m.phase === 'aim' || m.phase === 'jack');
    ctx.save();
    roundPath(ctx, x, 14, 300, 94, 22);
    ctx.fillStyle = active ? 'rgba(255,240,204,0.2)' : 'rgba(255,240,204,0.08)'; ctx.fill();
    ctx.lineWidth = active ? 3 : 1.5; ctx.strokeStyle = active ? 'rgba(255,214,120,0.95)' : 'rgba(255,240,204,0.25)'; ctx.stroke();
    ctx.restore();
    ctx.textBaseline = 'middle';
    ctx.textAlign = side === 0 ? 'left' : 'right';
    ctx.font = `700 22px ${FONT}`; ctx.fillStyle = '#ffe9bf';
    const nx = side === 0 ? x + 18 : x + 282;
    ctx.fillText(sideName(state, side), nx, 36);
    ctx.font = `700 58px ${FONT}`; ctx.fillStyle = '#fff6e2';
    ctx.fillText(String(m.scores[side]), side === 0 ? x + 18 : x + 282, 78);
    // boules still in hand
    const sp = bouleSprite(side);
    for (let i = 0; i < 3; i++) {
      const bxx = side === 0 ? x + 296 - 34 * (3 - i) + 10 : x + 296 - 34 * (3 - i) + 10 - (300 - 296);
      const px = side === 0 ? x + 150 + i * 34 : x + 138 + i * 34;
      const have = i < m.hand[side];
      if (sp) { ctx.globalAlpha = have ? 1 : 0.22; ctx.drawImage(sp, px, 62, 30, 30); ctx.globalAlpha = 1; }
    }
  }
  if (state.think && state.think.phase === 'think' && m.cfg.mode !== 'watch') {
    for (let i = 0; i < 3; i++) {
      const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * 6 - i * 0.9));
      ctx.fillStyle = `rgba(255,233,191,${a})`; ctx.beginPath(); ctx.arc(W - 70 - i * 22, 118, 6, 0, TAU); ctx.fill();
    }
  }
  if (state.ff > 1) { ctx.font = `700 26px ${FONT}`; ctx.fillStyle = '#ffe9bf'; ctx.textAlign = 'center'; ctx.fillText('\u25b6\u25b6 x3', W / 2, 300); }
  ctx.textAlign = 'center';
  ctx.font = `700 21px ${FONT}`; ctx.fillStyle = '#ffe9bf';
  ctx.fillText(`End ${m.end}`, W / 2, 64);
  ctx.font = `400 19px ${FONT}`; ctx.fillStyle = 'rgba(255,233,191,0.8)';
  ctx.fillText(`to ${m.cfg.target}`, W / 2, 86);
  // jack indicator
  const js = jackSprite2(ctx);
}
function jackSprite2(ctx) { drawJack(ctx, W / 2, 106, 8); return null; }

// ---- control bar -------------------------------------------------------------------------------
function drawLoftIcon(ctx, id, x, y, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  if (id === 0) { ctx.moveTo(x - 20, y + 10); ctx.lineTo(x + 18, y + 10); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 20, y + 4, 6, 0, TAU); ctx.fill(); }
  else if (id === 1) { ctx.moveTo(x - 20, y + 12); ctx.quadraticCurveTo(x, y - 12, x + 18, y + 10); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 20, y + 5, 5, 0, TAU); ctx.fill(); }
  else if (id === 2) { ctx.moveTo(x - 14, y + 14); ctx.quadraticCurveTo(x - 2, y - 28, x + 14, y + 12); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 16, y + 7, 5, 0, TAU); ctx.fill(); }
  else { ctx.moveTo(x - 22, y + 6); ctx.lineTo(x + 6, y + 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 4, y - 6); ctx.lineTo(x + 20, y + 4); ctx.lineTo(x + 4, y + 14); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawBar(ctx, state) {
  if (state.m.cfg.mode === 'watch') { drawDemoBar(ctx, state); return; }
  const g = ctx.createLinearGradient(0, 1096, 0, H);
  g.addColorStop(0, 'rgba(32,20,10,0)'); g.addColorStop(0.18, 'rgba(32,20,10,0.82)'); g.addColorStop(1, 'rgba(24,14,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1096, W, H - 1096);
  const jack = state.m.phase === 'jack', human = state.humanTurn;
  LOFTS.forEach((L, i) => {
    const dis = (jack && i === 3) || !human;
    drawButton(ctx, LOFT_BTN[i], L.name, { active: state.sel.loft === i && !dis, disabled: dis, size: 22, icon: (c, x, y, col) => drawLoftIcon(c, i, x, y, col) });
  });
  const sp = SPINS[state.sel.spin];
  drawButton(ctx, SPIN_BTN, `Spin: ${sp.name}`, { disabled: !human, active: state.sel.spin !== 0 && human, size: 25 });
  drawButton(ctx, HINT_BTN, state.hintBusy ? 'Thinking…' : 'Hint', { disabled: !human || state.m.phase === 'jack', size: 25 });
  drawButton(ctx, MENU_BTN, 'Menu', { dark: true, size: 25 });
}


// ---- Watch & Learn bar -------------------------------------------------------------------------
function drawDemoBar(ctx, state) {
  const g = ctx.createLinearGradient(0, 1096, 0, H);
  g.addColorStop(0, 'rgba(32,20,10,0)'); g.addColorStop(0.18, 'rgba(32,20,10,0.82)'); g.addColorStop(1, 'rgba(24,14,6,0.95)');
  ctx.fillStyle = g; ctx.fillRect(0, 1096, W, H - 1096);
  const th = state.think;
  drawButton(ctx, DEMO_BAR.dec, `Think −`, { size: 24, disabled: state.settings.thinkIdx === 0 });
  drawButton(ctx, DEMO_BAR.pause, state.paused ? 'Resume' : 'Pause', { size: 30, primary: state.paused });
  drawButton(ctx, DEMO_BAR.inc, `Think +`, { size: 24, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
  drawButton(ctx, DEMO_BAR.exit, 'Exit Watch & Learn', { dark: true, size: 24 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let phase = '';
  if (state.m.phase === 'score') phase = 'SCORING';
  else if (th && th.phase === 'think') phase = `THINK  ${Math.max(0, Math.ceil(th.dur - th.t))}s  (${THINK_STEPS[state.settings.thinkIdx]}s)`;
  else if (th && th.phase === 'reveal') phase = 'REVEAL';
  else if (state.m.phase === 'fly' || state.m.phase === 'jack-fly') phase = 'ACT';
  if (state.paused) phase = 'PAUSED';
  if (phase) {
    ctx.font = `700 24px ${FONT}`;
    const w = ctx.measureText(phase).width + 50;
    roundPath(ctx, W / 2 - w / 2, 238, w, 44, 22); ctx.fillStyle = state.paused ? 'rgba(196,85,42,0.9)' : 'rgba(28,16,8,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,214,140,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff3d6'; ctx.fillText(phase, W / 2, 261);
  }
}

// ---- end-of-end close-up -----------------------------------------------------------------------
function drawScoreCard(ctx, state) {
  const m = state.m, w = state.w, info = m.endInfo;
  const jack = theJack(w);
  const cx = W / 2, cy = 932, R = 142;
  panel(ctx, 30, 690, 660, 570, { r: 30, fill: 'rgba(248,238,214,0.95)', stroke: 'rgba(110,76,40,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${FONT}`; ctx.fillStyle = C.terraDark;
  const head = info.deadJack ? 'Dead jack' : info.tie ? 'Dead heat' : info.pts ? `${info.team === 0 ? (state.m.cfg.mode === 'ai' ? 'You score' : sideName(state, 0) + ' scores') : sideName(state, 1) + ' scores'} ${info.pts}` : 'No score';
  ctx.fillText(head, W / 2, 742);
  if (jack) {
    const rk = ranking(w);
    const far = Math.max(40, ...rk.map((r) => dist2D(r.b, jack)));
    const sc = R / far;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R + 34, 0, TAU); ctx.fillStyle = 'rgba(214,190,140,0.55)'; ctx.fill(); ctx.strokeStyle = 'rgba(110,76,40,0.5)'; ctx.lineWidth = 3; ctx.stroke(); ctx.clip();
    const scoring = new Set();
    if (info.team >= 0 && info.pts > 0) { for (const r of rk) { if (r.b.team !== info.team) break; scoring.add(r.b.id); } }
    const rpx = Math.min(40, Math.max(15, R_B * sc));
    rk.forEach((r, k) => {
      const dx = (r.b.x - jack.x) * sc, dy = -(r.b.y - jack.y) * sc;
      ctx.setLineDash([6, 6]); ctx.strokeStyle = scoring.has(r.b.id) ? '#c4552a' : 'rgba(70,50,30,0.45)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + dx, cy + dy); ctx.stroke(); ctx.setLineDash([]);
    });
    for (const r of rk.slice().reverse()) {
      const dx = (r.b.x - jack.x) * sc, dy = -(r.b.y - jack.y) * sc;
      drawBoule(ctx, r.b.team, cx + dx, cy + dy, rpx, r.b.n);
      if (scoring.has(r.b.id)) { ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx + dx, cy + dy, rpx + 5, 0, TAU); ctx.stroke(); }
    }
    drawJack(ctx, cx, cy, Math.max(8, R_J * sc));
    rk.forEach((r, k) => {
      const dx = (r.b.x - jack.x) * sc, dy = -(r.b.y - jack.y) * sc;
      const bx = cx + dx + rpx * 0.75, by = cy + dy - rpx * 0.75;
      ctx.fillStyle = 'rgba(40,24,10,0.85)'; ctx.beginPath(); ctx.arc(bx, by, 12, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff6e2'; ctx.font = `700 15px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText(String(k + 1), bx, by + 5.5);
    });
    ctx.restore();
    // the ranking, nearest first
    ctx.font = `700 21px ${FONT}`;
    rk.slice(0, 6).forEach((r, k) => {
      const col = k % 3, row = Math.floor(k / 3), x = 70 + col * 205, y = 1152 + row * 40;
      ctx.fillStyle = r.b.team === 0 ? '#2f5f9a' : '#a8501e'; ctx.beginPath(); ctx.arc(x + 10, y - 7, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = C.ink; ctx.textAlign = 'left';
      ctx.fillText(`${k + 1}.  ${Math.max(0, Math.round(r.d * 1.667))} cm`, x + 28, y);
    });
  } else {
    ctx.font = `400 26px ${FONT}`; ctx.fillStyle = C.ink; ctx.fillText('The jack left the lane.', W / 2, 880);
  }
  ctx.textAlign = 'center'; ctx.font = `400 22px ${FONT}`; ctx.fillStyle = 'rgba(70,50,30,0.75)';
  ctx.fillText(state.m.cfg.mode === 'watch' ? 'Next end starts soon' : 'Tap to continue', W / 2, 1240);
}

function drawTutorial(ctx, state) {
  const k = (state.t * 0.7) % 1.4;
  const e = Math.min(1, k / 0.9), ease = 1 - Math.pow(1 - e, 3);
  const x = 360, y0 = 780, y = y0 + ease * 150;
  ctx.save();
  const fade = k > 1.15 ? 1 - (k - 1.15) / 0.25 : 1;
  ctx.globalAlpha = 0.9 * Math.max(0, fade);
  ctx.strokeStyle = 'rgba(255,246,226,0.9)'; ctx.lineWidth = 6; ctx.setLineDash([4, 12]); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,246,226,0.85)'; ctx.beginPath(); ctx.arc(x, y, 30, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.font = `700 28px ${FONT}`; ctx.textAlign = 'center'; textShadow(ctx, 'Drag back like a slingshot, then let go', W / 2, 700);
  ctx.restore();
}

function drawPop(ctx, state) {
  const p = state.pop;
  if (!p) return;
  const k = Math.min(1, p.t / 1.6), a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
  ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(110 + (1 - Math.min(1, p.t * 5)) * 40)}px ${FONT}`;
  ctx.shadowColor = 'rgba(20,10,4,0.8)'; ctx.shadowBlur = 12;
  ctx.fillStyle = p.team === 0 ? '#bfe0ff' : '#ffc79a';
  ctx.fillText(p.text, W / 2, 520 - p.t * 40);
  ctx.restore();
}

// ---- toast / banner ----------------------------------------------------------------------------
function drawToast(ctx, text, y = 150, alpha = 1) {
  if (!text) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 26px ${FONT}`;
  const lines = wrapLines(ctx, text, 600);
  const h = 22 + lines.length * 32, w = Math.min(640, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 56);
  roundPath(ctx, W / 2 - w / 2, y, w, h, 24); ctx.fillStyle = 'rgba(28,16,8,0.74)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,140,0.5)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 28 + i * 32));
  ctx.restore();
}

// ---- the scene ---------------------------------------------------------------------------------
function ensurePitch(ctx, T) {
  setHost(ctx);
  const key = `${T.id}:${T.seed}`;
  const hit = pitchCache.get(key);
  if (hit) return hit;
  if (key !== bakeKey) { bakeKey = key; bakeWait = 0; }
  if (bakeWait < LOAD_BEAT) { bakeWait++; return null; }
  const sp = bakePitch(T, artRes(ctx));
  if (sp) {
    if (pitchCache.size >= 3) pitchCache.delete(pitchCache.keys().next().value);
    pitchCache.set(key, sp);
  }
  return sp;
}

function drawLoading(ctx, T) {
  const P = palOf(T);
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, P.skyA); g.addColorStop(1, `rgb(${P.base.join(',')})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff6e2'; ctx.font = `700 40px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  textShadow(ctx, 'Raking the gravel…', W / 2, H / 2);
}

// The pitch and everything lying on it (shared by play, title, result and the pages).
export function drawWorldLayer(ctx, state, w, parts, o = {}) {
  const T = w.terrain, t = state.t;
  const sprite = ensurePitch(ctx, T);
  if (!sprite) {
    if (canBake()) { drawLoading(ctx, T); return false; }
    const P = palOf(T);
    ctx.fillStyle = `rgb(${P.base.join(',')})`; ctx.fillRect(0, 0, W, H);
  } else ctx.drawImage(sprite, 0, 0, W, H);
  if (o.zone) {
    ctx.save();
    const pulse = (Math.sin(t * 3) + 1) / 2;
    ctx.beginPath();
    const n = 40, top = [], bot = [];
    for (let i = 0; i <= n; i++) {
      const a = -0.55 + (1.1 * i) / n;
      for (const [arr, r] of [[top, JACK_ZONE.max], [bot, JACK_ZONE.min]]) {
        const x = Math.sin(a) * r, y = Math.cos(a) * r;
        if (Math.abs(x) <= LANE.halfW - 2) arr.push(project(x, y, 0));
      }
    }
    top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    bot.slice().reverse().forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath(); ctx.fillStyle = `rgba(255,232,130,${0.2 + pulse * 0.14})`; ctx.fill();
    ctx.strokeStyle = `rgba(255,236,160,${0.5 + pulse * 0.3})`; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
  for (const s of w.scars) {
    const p = project(s.x, s.y, 0), r = s.r * p.s, ry = r * (depthScale(s.y) / p.s);
    ctx.fillStyle = `rgba(70,46,24,${0.2 * s.a})`; ctx.beginPath(); ctx.ellipse(p.x, p.y, r, ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = `rgba(255,236,200,${0.12 * s.a})`; ctx.beginPath(); ctx.ellipse(p.x - r * 0.25, p.y - ry * 0.3, r * 0.6, ry * 0.5, 0, 0, TAU); ctx.fill();
  }
  if (o.guide) drawGuide(ctx, state, o.guide, t);
  if (o.hint) drawGuide(ctx, { ...state, settings: { ...state.settings, calm: false }, preview: null }, o.hint, t);
  if (o.alts) {
    o.alts.slice(1).forEach((a) => { if (a.rest) groundRing(ctx, a.rest.x, a.rest.y, R_B * 1.1, 'rgba(255,246,226,0.5)', 2.5); });
  }
  const order = w.balls.slice().sort((a, b) => b.y - a.y);
  for (const b of order) drawGroundShadow(ctx, b);
  const jack = theJack(w);
  if (jack && !o.noRing) {
    const calm = state.settings.calm;
    groundRing(ctx, jack.x, jack.y, calm ? 16 : 11, `rgba(255,236,190,${calm ? 0.55 : 0.28})`, calm ? 3 : 2);
  }
  if (o.holding && jack) {
    const rk = ranking(w);
    if (rk.length) {
      const lead = rk[0].b, pulse = (Math.sin(t * 4) + 1) / 2;
      groundRing(ctx, lead.x, lead.y, lead.r * (1.55 + pulse * 0.12), lead.team === 0 ? 'rgba(150,200,255,0.9)' : 'rgba(255,190,130,0.9)', 3.5);
    }
  }
  for (const b of order) {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 260 && !b.out) {
      const a = project(b.x, b.y, b.z + b.r), c = project(b.x - b.vx * 0.045, b.y - b.vy * 0.045, b.z + b.r - b.vz * 0.045);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(255,248,230,${Math.min(0.4, (sp - 260) / 900)})`; ctx.lineWidth = b.r * a.s * 1.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.restore();
    }
  }
  for (const b of order) {
    const s = ballScreen(b);
    const alpha = b.out ? Math.max(0, 1 - b.fade) : 1;
    if (b.k) drawJack(ctx, s.x, s.y, s.r, alpha);
    else drawBoule(ctx, b.team, s.x, s.y, s.r, b.n, alpha);
    if (o.mark && o.mark === b.id) {
      ctx.strokeStyle = 'rgba(255,230,120,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r + 6 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke();
    }
  }
  drawParticles(ctx, parts);
  return true;
}

export function renderPlay(ctx, state) {
  const w = state.w, m = state.m, t = state.t;
  const sh = state.shake;
  if (sh && sh.t < sh.dur) { const k = 1 - sh.t / sh.dur; ctx.save(); ctx.translate(Math.sin(sh.t * 90) * sh.amp * k, Math.cos(sh.t * 71) * sh.amp * k * 0.7); renderPlayInner(ctx, state); ctx.restore(); return; }
  renderPlayInner(ctx, state);
}

function renderPlayInner(ctx, state) {
  const w = state.w, m = state.m, t = state.t;
  const ok = drawWorldLayer(ctx, state, w, state.parts, {
    zone: m.phase === 'jack' && state.humanTurn, holding: m.phase === 'aim' || m.phase === 'score', guide: state.guide, hint: state.hint, mark: state.mark, alts: state.alts,
  });
  if (!ok) return;
  if (state.showSling) drawSling(ctx, state, state.humanTurn); else drawSnap(ctx, state);
  drawHud(ctx, state, t);
  if (m.phase === 'score') drawScoreCard(ctx, state); else drawBar(ctx, state);
  drawPop(ctx, state);
  if (state.humanTurn && !state.drag && (state.record.thrown | 0) < 4 && !state.paused && m.cfg.mode !== 'watch') drawTutorial(ctx, state);
  if (state.toast && state.toastT > 0) drawToast(ctx, state.toast, 142, Math.min(1, state.toastT * 2));
  if (state.drag && state.guide) {
    ctx.save(); ctx.font = `700 22px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const L = LOFTS[state.guide.loft];
    const d = Math.round(reachFor(state.guide.loft, state.guide.power) / 60 * 10) / 10;
    textShadow(ctx, `${L.name} · ${SPINS[state.guide.spin].name} · ${d.toFixed(1)} m`, W / 2, 1080);
    ctx.restore();
  }
}

export { drawToast, drawHud, drawBar, drawLoading };
