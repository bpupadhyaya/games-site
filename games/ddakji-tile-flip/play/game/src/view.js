// The play screen: floor scene, tiles, ghost footprint, effects and the HUD (cards, info strip, sliders, buttons).
// Reads `state`, never writes game values (it only caches the camera).
import { W, H, host, playLayout, sliderGeom, TEXT_SCALES, THINK_STEPS, clamp } from './layout.js';
import { makeCam } from './cam.js';
import { drawFloor, drawTile, drawTileShadow, drawFx, drawFlatTile, FONT, PATTERNS } from './art.js';
import { THICK, HAND, THROWER, flightPose, yawFor, scatterSigma, corners, quickQ, lift, MAT } from './sim.js';
import { C, roundPath, drawButton, panel, textShadow, wrapLines } from './ui.js';
import { flipQ } from './ai.js';
import { PROFILES } from './profiles.js';

let camKey = '', camCache = null;
export function camFor(state) {
  const L = playLayout(TEXT_SCALES[state.settings.textIdx], state.m.cfg.mode === 'watch');
  const z = state.m.cfg.mode === 'watch' ? L.zoneWatch : L.zone;
  const key = `${L.key}|${z.x},${z.y},${z.w},${z.h}`;
  if (key !== camKey) { camCache = makeCam(z); camKey = key; }
  return { cam: camCache, L };
}
export const layoutOf = (state) => playLayout(TEXT_SCALES[state.settings.textIdx], state.m.cfg.mode === 'watch');

export const nameOf = (state, side) => {
  const m = state.m;
  if (m.cfg.mode === 'two') return side === 0 ? 'Player 1' : 'Player 2';
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
  return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
};
export const patOf = (state, side) => {
  const m = state.m;
  if (m.cfg.mode === 'two') return side === 0 ? state.pat : m.cfg.p2pat;
  if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].pat;
  return side === 0 ? state.pat : PROFILES[m.cfg.opp].pat;
};

// ---- scene -----------------------------------------------------------------------------------------------------
function tileObj(t, extra = {}) { return { x: t.x, y: t.y, z: t.z || 0, yaw: t.yaw, theta: t.theta || 0, lift: t.lift, pitch: t.pitch || 0, pat: t.pat, alpha: t.alpha, ...extra }; }

export function sceneTiles(tb, showHeld) {
  const out = [];
  const tg = tb.target;
  if (tg && tg.alpha !== 0) out.push({ key: 'target', t: tileObj(tg), shadow: tg.alpha ?? 1 });
  if (tb.rest) out.push({ key: 'rest', t: tileObj(tb.rest), shadow: 1, atop: !!tb.rest.atop });
  if (tb.fly) out.push({ key: 'fly', t: tileObj(tb.fly), shadow: 1 });
  else if (tb.held && showHeld) {
    const bob = Math.sin((tb.t || 0) * 2.2) * 0.05;
    out.push({ key: 'held', t: tileObj({ x: HAND.x, y: HAND.y, z: HAND.z - THICK / 2 + bob, yaw: 0, pitch: -0.6, pat: tb.held.pat }), shadow: 0.5 });
  }
  out.sort((a, b) => (a.atop ? 1 : 0) - (b.atop ? 1 : 0) || b.t.y - a.t.y);
  return out;
}

// Floor + tiles + effects for any table (the match, or the menus' background). `o.shake` jolts the whole scene a little.
export function drawTable(ctx, cam, tb, t, scr, o = {}) {
  drawFloor(ctx, cam, scr.W, scr.H, t, { x: 0, y: 2.6 });
  ctx.save();
  if (o.shake) ctx.translate(Math.sin(t * 70) * o.shake * 5, Math.cos(t * 83) * o.shake * 4);
  const tiles = sceneTiles(tb, o.showHeld);
  drawFx(ctx, cam, tb.fx.filter((p) => p.kind === 2));
  for (const it of tiles) drawTileShadow(ctx, cam, it.t, Math.max(0.2, it.shadow) * (it.t.alpha ?? 1));
  for (const it of tiles) drawTile(ctx, cam, it.t);
  drawFx(ctx, cam, tb.fx.filter((p) => p.kind !== 2));
  ctx.restore();
}

function drawGhost(ctx, cam, state) {
  const { aim } = state;
  const yaw = yawFor(aim.x, aim.y, aim.w);
  const sg = scatterSigma(aim.s, aim.w, state.humanTurn ? 0 : 0), pts = corners(aim.x, aim.y, yaw).map((p) => cam.proj(p.x, p.y, 0.012));
  const c0 = cam.proj(aim.x, aim.y, 0.012);
  ctx.save();
  // scatter ring
  const e = cam.proj(aim.x + sg * 1.5, aim.y, 0.012), f = cam.proj(aim.x, aim.y + sg * 1.5, 0.012);
  const pulse = 0.5 + 0.5 * Math.sin(state.t * 5);
  ctx.beginPath(); ctx.ellipse(c0.x, c0.y, Math.abs(e.x - c0.x), Math.abs(f.y - c0.y), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,248,214,0.13)'; ctx.fill(); ctx.strokeStyle = `rgba(255,248,214,${0.45 + 0.2 * pulse})`; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
  // footprint
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.20)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.6; ctx.stroke();
  ctx.restore();
  return c0;
}

// Rough odds for the current aim: a fixed ring of sample throws around it, scored with the same lift as the real throw.
const RING = Array.from({ length: 14 }, (_, i) => { const r = Math.sqrt((i + 0.5) / 14) * 1.6, a = i * 2.39996; return [Math.cos(a) * r, Math.sin(a) * r, 0.9 + ((i * 7) % 14) / 70]; });
export function flipOdds(aim, target, massA) {
  const sg = scatterSigma(aim.s, aim.w, 0), qc = flipQ();
  let n = 0;
  for (const [dx, dy, flat] of RING) {
    const x = aim.x + dx * sg, y = aim.y + dy * sg;
    const L = lift({ px: x, py: y, yaw: yawFor(x, y, aim.w), s: aim.s, w: aim.w, flat }, target, massA);
    if (L.kind === 'ok' && L.Q >= qc) n++;
  }
  return n / RING.length;
}
function liftChip(ctx, cam, state, c0, L) {
  const t = state.target; if (!t || !state.settings.guide) return;
  const mass = state.held ? state.held.mass : 1, q = quickQ(state.aim, t, mass), qc = flipQ();
  let txt, col;
  if (q.kind === 'pinned') { txt = 'On top: pins it'; col = '#ffb48a'; }
  else if (q.kind === 'miss') { txt = 'Too far away'; col = '#ffb48a'; }
  else {
    const p = flipOdds(state.aim, t, mass), r = q.Q / qc;
    if (p >= 0.12) { txt = `Flip chance about ${Math.round(p * 10) * 10}%`; col = p >= 0.5 ? '#9be8b0' : '#ffe08a'; }
    else if (r < 0.55) { txt = 'Barely a breeze'; col = '#ffb48a'; } else if (r < 0.9) { txt = 'Only a wobble'; col = '#ffe08a'; } else { txt = 'Scatters too much'; col = '#ffb48a'; }
  }
  ctx.save(); const fs = Math.round(L.fs.pip * 1.1); ctx.font = `700 ${fs}px ${FONT}`; const w = ctx.measureText(txt).width + 26, h = fs * 1.7;
  const zone = cam.zone; const x = clamp(c0.x, zone.x + w / 2 + 6, zone.x + zone.w - w / 2 - 6), y = clamp(c0.y + cam.unit(state.aim.y) * 0.95, zone.y + h, zone.y + zone.h - 6);
  roundPath(ctx, x - w / 2, y, w, h, h / 2); ctx.fillStyle = 'rgba(28,14,6,0.78)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x, y + h / 2 + 1); ctx.restore();
}

function worldLabel(ctx, cam, x, y, z, text, col, size, a = 1) {
  const q = cam.proj(x, y, z);
  ctx.save(); ctx.globalAlpha = a; ctx.font = `800 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(30,12,2,0.85)'; ctx.strokeText(text, q.x, q.y); ctx.fillStyle = col; ctx.fillText(text, q.x, q.y); ctx.restore();
}

export function renderScene(ctx, state, L, cam) {
  state.held = state.held ?? null;
  drawTable(ctx, cam, state, state.t, { W, H }, { shake: state.shake > 0 ? state.shake : 0, showHeld: state.m.phase === 'aim' });
  let c0 = null;
  if (state.m.phase === 'aim' && (state.humanTurn || state.showAim)) c0 = drawGhost(ctx, cam, state);
  if (c0 && state.humanTurn) liftChip(ctx, cam, state, c0, L);
  for (const p of state.pops) { const k = p.t / p.max; worldLabel(ctx, cam, p.x, p.y, 0.4 + k * 0.9, p.text, p.col, Math.round(p.size * (0.7 + 0.3 * Math.min(1, k * 6))), Math.min(1, (1 - k) * 2.5)); }
}

// ---- HUD -------------------------------------------------------------------------------------------------------
function pips(ctx, x, y, goal, n, state, side, size) {
  for (let i = 0; i < goal; i++) {
    const cx = x + i * (size * 1.25) + size / 2;
    if (i < n) drawFlatTile(ctx, cx, y, size, patOf(state, 1 - side), { reverse: true, shadow: true });
    else { roundPath(ctx, cx - size / 2, y - size / 2, size, size, size * 0.18); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,238,200,0.35)'; ctx.lineWidth = 1.6; ctx.stroke(); }
  }
}

function drawCard(ctx, r, state, side, L) {
  const m = state.m, active = m.turn === side && m.phase !== 'score' && m.phase !== 'over';
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(40,24,14,0.86)', stroke: active ? '#f0c25a' : 'rgba(255,222,160,0.28)' });
  const pad = 12, tile = Math.min(r.h - 2 * pad, 64);
  drawFlatTile(ctx, r.x + pad + tile / 2, r.y + r.h / 2, tile * 0.95, patOf(state, side), { rot: side ? 0.08 : -0.08 });
  const tx = r.x + pad * 2 + tile, tw = r.w - (tx - r.x) - pad;
  ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${L.fs.name}px ${FONT}`;
  let nm = nameOf(state, side); while (ctx.measureText(nm).width > tw && nm.length > 3) nm = nm.slice(0, -2);
  ctx.fillText(nm, tx, r.y + pad + L.fs.name * 0.85);
  ctx.font = `600 ${L.fs.sub}px ${FONT}`; ctx.fillStyle = active ? '#ffd97a' : 'rgba(255,238,200,0.6)';
  ctx.fillText(active ? 'Throwing' : m.phase === 'score' || m.phase === 'over' ? '' : 'Defending', tx, r.y + pad + L.fs.name * 0.85 + L.fs.sub * 1.3);
  ctx.restore();
  const ps = Math.max(18, Math.min(30, (tw - 4) / (m.goal * 1.25 + 0.2)));
  pips(ctx, tx, r.y + r.h - pad - ps * 0.55, m.goal, m.scores[side], state, side, ps);
}

function infoStrip(ctx, r, state, L) {
  const text = state.toastT > 0 ? state.toast : state.defaultInfo || '';
  if (!text) return;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 16, fill: 'rgba(36,20,10,0.72)', stroke: 'rgba(255,222,160,0.22)', shadow: false });
  ctx.save(); ctx.fillStyle = '#fff3d6'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = L.fs.info; ctx.font = `600 ${fs}px ${FONT}`;
  let lines = wrapLines(ctx, text, r.w - 28);
  while (lines.length * fs * 1.2 > r.h - 8 && fs > 12) { fs -= 1; ctx.font = `600 ${fs}px ${FONT}`; lines = wrapLines(ctx, text, r.w - 28); }
  lines.forEach((l, i) => ctx.fillText(l, r.x + r.w / 2, r.y + r.h / 2 + (i - (lines.length - 1) / 2) * fs * 1.2));
  ctx.restore();
}

function slider(ctx, r, label, valueText, v, centered, L, disabled) {
  const g = sliderGeom(r, centered);
  ctx.save(); ctx.globalAlpha = disabled ? 0.5 : 1;
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = 'rgba(40,24,14,0.78)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,222,160,0.22)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff3d6'; ctx.font = `700 ${L.fs.slider}px ${FONT}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(label, g.x0 - 10, g.labelY);
  ctx.textAlign = 'right'; ctx.fillStyle = '#ffd97a'; ctx.fillText(valueText, g.x1 + 10, g.labelY);
  const th = Math.max(10, r.h * 0.13);
  roundPath(ctx, g.x0, g.y - th / 2, g.x1 - g.x0, th, th / 2); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();
  const kx = g.x0 + (centered ? (v + 1) / 2 : v) * (g.x1 - g.x0), fx0 = centered ? g.cx : g.x0;
  roundPath(ctx, Math.min(fx0, kx), g.y - th / 2, Math.abs(kx - fx0), th, th / 2); const gr = ctx.createLinearGradient(g.x0, 0, g.x1, 0); gr.addColorStop(0, '#f0c25a'); gr.addColorStop(1, '#e0702e'); ctx.fillStyle = gr; ctx.fill();
  if (centered) { ctx.fillStyle = 'rgba(255,238,200,0.7)'; ctx.fillRect(g.cx - 1.5, g.y - th * 0.9, 3, th * 1.8); }
  const kr = Math.max(17, r.h * 0.23);
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  const kg = ctx.createRadialGradient(kx - kr * 0.3, g.y - kr * 0.3, 2, kx, g.y, kr); kg.addColorStop(0, '#fff6dc'); kg.addColorStop(1, '#e6c98a');
  ctx.beginPath(); ctx.arc(kx, g.y, kr, 0, Math.PI * 2); ctx.fillStyle = kg; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#7a4d1c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

export const pctText = (v) => `${Math.round(v * 100)}%`;
export const twistText = (w) => (Math.abs(w) < 0.05 ? 'none' : `${w < 0 ? 'left' : 'right'} ${Math.round(Math.abs(w) * 100)}%`);

function hud(ctx, state, L) {
  const m = state.m, watch = m.cfg.mode === 'watch';
  drawCard(ctx, L.cards[0], state, 0, L); drawCard(ctx, L.cards[1], state, 1, L);
  infoStrip(ctx, L.info, state, L);
  const barHidden = m.phase === 'score' || m.phase === 'over';
  if (watch) {
    const D = L.demo, paused = state.paused;
    drawButton(ctx, D.pause, paused ? 'Resume' : 'Pause', { primary: !paused, active: paused, size: L.fs.demoBtn + 2 });
    drawButton(ctx, D.dec, 'Think −', { size: L.fs.demoBtn, disabled: state.settings.thinkIdx === 0 });
    drawButton(ctx, D.inc, 'Think +', { size: L.fs.demoBtn, disabled: state.settings.thinkIdx === THINK_STEPS.length - 1 });
    drawButton(ctx, D.exit, 'Leave', { dark: true, size: L.fs.demoBtn });
    ctx.save(); ctx.fillStyle = 'rgba(255,238,200,0.85)'; ctx.font = `600 ${L.fs.pip}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ph = state.think ? state.think.phase : '';
    ctx.fillText(`Thinking time ${THINK_STEPS[state.settings.thinkIdx]} s${ph === 'think' ? ' · thinking' : ph === 'reveal' ? ' · revealing' : ''}`, D.pause.x + D.pause.w / 2, D.pause.y - L.fs.pip * 0.9);
    ctx.restore();
    return;
  }
  if (barHidden) return;
  const can = state.humanTurn && m.phase === 'aim' && !state.pass && !state.paused;
  slider(ctx, L.strength, 'Strength', pctText(state.aim.s), state.aim.s, false, L, !can);
  slider(ctx, L.twist, 'Twist', twistText(state.aim.w), state.aim.w, true, L, !can);
  drawButton(ctx, L.hint, state.hintBusy ? '…' : 'Think', { size: L.fs.btn - 2, disabled: !can });
  drawButton(ctx, L.throw, 'THROW', { primary: true, size: L.fs.btn + 4, disabled: !can });
  drawButton(ctx, L.menu, 'Menu', { dark: true, size: L.fs.btn - 2 });
}

function banner(ctx, state, L, cam) {
  const b = state.banner; if (!b) return;
  const k = b.t / b.max, pop = k < 0.12 ? k / 0.12 : 1, a = k > 0.8 ? (1 - k) / 0.2 : 1;
  const z = cam.zone, cx = z.x + z.w / 2, cy = z.y + z.h * 0.2;
  ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, a)); ctx.translate(cx, cy); ctx.scale(0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)), 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3)));
  const fs = Math.round(Math.min(z.w * 0.12, 86)); ctx.font = `italic 900 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.2; ctx.strokeStyle = 'rgba(40,14,2,0.9)'; ctx.strokeText(b.text, 0, 0);
  const g = ctx.createLinearGradient(0, -fs / 2, 0, fs / 2); g.addColorStop(0, b.top || '#fff3c4'); g.addColorStop(1, b.col || '#f0a832'); ctx.fillStyle = g; ctx.fillText(b.text, 0, 0);
  if (b.sub) { ctx.font = `600 ${Math.round(fs * 0.3)}px ${FONT}`; ctx.lineWidth = fs * 0.06; ctx.strokeText(b.sub, 0, fs * 0.62); ctx.fillStyle = '#fff3d6'; ctx.fillText(b.sub, 0, fs * 0.62); }
  ctx.restore();
}

function passCard(ctx, state, L) {
  const p = state.pass; if (!p) return;
  ctx.save(); ctx.fillStyle = 'rgba(14,6,0,0.72)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  const w = Math.min(W - 60, 560), h = Math.max(220, L.fs.name * 6), x = (W - w) / 2, y = H / 2 - h / 2;
  panel(ctx, x, y, w, h, { r: 28, fill: 'rgba(250,240,214,0.97)', stroke: '#c4551f' });
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.terraDark; ctx.font = `800 ${Math.round(L.fs.name * 1.5)}px ${FONT}`;
  ctx.fillText(`${nameOf(state, p.side)}`, W / 2, y + h * 0.34); ctx.fillStyle = C.ink; ctx.font = `600 ${L.fs.info}px ${FONT}`;
  ctx.fillText('Your throw. Tap to begin.', W / 2, y + h * 0.62);
  drawFlatTile(ctx, W / 2, y - 6, 56, patOf(state, p.side), { rot: 0.1 });
  ctx.restore();
}

export function renderPlay(ctx, state) {
  const { cam, L } = camFor(state);
  renderScene(ctx, state, L, cam);
  banner(ctx, state, L, cam);
  hud(ctx, state, L);
  passCard(ctx, state, L);
  void host; void PATTERNS; void THROWER; void flightPose; void MAT;
}
