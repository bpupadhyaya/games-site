// Drawing the play screen: the baked court scene, balls with shadows, aim guides, particles, the scoreboard, the control bar and the
// end-of-frame close-up. Pure drawing from `state` and the layout; game.js owns state.
import { COURT, HALF, R_B, ranking, thePallino, TYPES, spinName } from './sim.js';
import { getScene, drawBall, drawShadow, drawBallIcon, identityRot, rollRot, canBake, setHost, TEAM } from './art.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, textShadow, wrapLines, ease } from './ui.js';
import { TEXT_SCALES, THINK_STEPS, PULL } from './layout.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
import { PROFILES } from './opponents.js';

const TAU = Math.PI * 2;
const rots = new WeakMap();

function updateRot(b) {
  let o = rots.get(b);
  if (!o) { o = { R: identityRot(), x: b.x, y: b.y }; rots.set(b, o); }
  const dx = b.x - o.x, dy = b.y - o.y;
  if (dx || dy) { o.R = rollRot(o.R, dx, dy, b.r); o.x = b.x; o.y = b.y; }
  return o.R;
}

// ---- the world on its own: used behind every menu and by the play screen ---------------------------------------------------
export function worldBackdrop(ctx, L, state, world, parts, o = {}) {
  setHost(ctx);
  const scene = world ? getScene(L, world.surf) : null;
  if (!canBake() || !scene) { ctx.fillStyle = '#18321f'; ctx.fillRect(0, 0, L.w, L.h); return true; }
  // the follow camera: a gentle zoom about the moving ball while a throw is in flight (presentation only)
  const zc = o.follow ? state.zoom : null;
  ctx.save();
  if (zc && zc.z > 1.001) { const a = zc.ax, b = zc.ay; ctx.transform(zc.z, 0, 0, zc.z, a * (1 - zc.z), b * (1 - zc.z)); }
  ctx.drawImage(scene.back, 0, 0, L.w, L.h);
  if (world) drawBalls(ctx, L, state, world, o);
  if (o.extra) o.extra();
  if (parts && parts.length) drawParts(ctx, L.cam, parts);
  if (scene.front) ctx.drawImage(scene.front, 0, 0, L.w, L.h);
  ctx.restore();
  return true;
}

function drawBalls(ctx, L, state, world, o = {}) {
  const cam = L.cam, list = world.balls.filter((b) => !(b.out && b.fade > 1.2));
  for (const b of list) { if (b.out && !b.dead && b.z < -1) continue; drawShadow(ctx, cam, b, b.dead || b.out ? Math.max(0, 1 - b.fade * 2) : 1); }
  // gold ring under the ball that is "in" (closest)
  if (!o.noMarker && state.m && state.m.phase !== 'pallino') {
    const rk = ranking(world), pal = thePallino(world);
    if (rk.length && pal) {
      const b = rk[0].b, q = cam.project(b.x, b.y, 0), rp = b.r * q.s * 1.35, pulse = 0.65 + 0.35 * Math.sin(state.t * 4);
      ctx.save(); ctx.strokeStyle = `rgba(255,214,90,${0.55 + 0.3 * pulse})`; ctx.lineWidth = Math.max(1.5, rp * 0.14);
      ctx.beginPath(); ctx.ellipse(q.x, q.y, rp, rp * 0.42, 0, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  list.sort((a, b) => b.y - a.y);
  for (const b of list) {
    if (b.dead || b.out) { drawBall(ctx, cam, b, updateRot(b), { alpha: Math.max(0, 1 - b.fade * 1.6) }); continue; }
    drawBall(ctx, cam, b, updateRot(b));
  }
}

function drawParts(ctx, cam, parts) {
  for (const q of parts) {
    const k = q.t / q.max, p = cam.project(q.x, q.y, q.z);
    if (q.kind === 0) {
      const r = q.size * p.s * 0.011 * (0.6 + k) + 1, a = (1 - k) * 0.32 * q.a;
      ctx.fillStyle = `rgba(${q.col ?? '232,214,176'},${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    } else if (q.kind === 1) {
      ctx.fillStyle = `rgba(255,${230 - 80 * k | 0},150,${1 - k})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, p.s * 0.012 * (1 - k)), 0, TAU); ctx.fill();
    } else {
      const g = cam.project(q.x, q.y, 0), rr = (0.15 + k * 0.9) * g.s;
      ctx.strokeStyle = `rgba(255,255,240,${(1 - k) * 0.75})`; ctx.lineWidth = Math.max(1, 3 * (1 - k)); ctx.beginPath(); ctx.ellipse(g.x, g.y, rr, rr * 0.42, 0, 0, TAU); ctx.stroke();
    }
  }
}

// ---- guides ------------------------------------------------------------------------------------------------------------------
function floorDots(ctx, cam, pts, col, size) {
  ctx.fillStyle = col;
  for (let i = 0; i < pts.length; i++) { const p = cam.project(pts[i].x, pts[i].y, pts[i].z ?? 0); const r = Math.max(1.4, size * p.s * 0.02); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
}
function ring(ctx, cam, x, y, rm, col, lw = 3, dash = null) {
  const c = cam.project(x, y, 0), a = rm * c.s;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.ellipse(c.x, c.y, a, a * 0.42, 0, 0, TAU); ctx.stroke(); ctx.restore();
}

function drawGuides(ctx, L, state) {
  const cam = L.cam, m = state.m, w = state.w;
  // the zone the pallino has to reach
  if (m.phase === 'pallino' && state.humanTurn) {
    const a = cam.project(-HALF, COURT.center, 0), b = cam.project(HALF, COURT.center, 0), c = cam.project(HALF, COURT.L, 0), d = cam.project(-HALF, COURT.L, 0);
    ctx.save(); ctx.fillStyle = `rgba(255,236,140,${0.12 + 0.05 * Math.sin(state.t * 3)})`;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,236,140,0.6)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  }
  const g = state.guide;
  if (g && state.humanTurn) {
    const dist = state.preview ? 0 : 5, ox = g.x, oy = COURT.startY;
    if (state.preview) {
      floorDots(ctx, cam, state.preview.path.filter((p) => p.z < 0.4), 'rgba(255,255,240,0.8)', 1.6);
      floorDots(ctx, cam, state.preview.path.filter((p) => p.z >= 0.4), 'rgba(255,255,240,0.4)', 1.1);
      if (state.preview.land) ring(ctx, cam, state.preview.land.x, state.preview.land.y, 0.22, 'rgba(255,255,255,0.85)', 2.5);
      if (state.preview.rest) ring(ctx, cam, state.preview.rest.x, state.preview.rest.y, 0.2, 'rgba(255,214,90,0.95)', 3);
    } else {
      const pts = [];
      for (let i = 1; i <= 12; i++) { const d = (dist * i) / 12; pts.push({ x: ox + Math.sin(g.ang) * d, y: oy + Math.cos(g.ang) * d }); }
      floorDots(ctx, cam, pts.map((p, i) => ({ ...p })), 'rgba(255,255,240,0.7)', 1.5);
    }
  }
  // the hint: a ghost target
  if (state.hint && state.hintRest) {
    const t = state.hintRest, pulse = 0.5 + 0.5 * Math.sin(state.t * 5);
    ring(ctx, cam, t.x, t.y, 0.3 + 0.04 * pulse, `rgba(120,255,190,${0.7 + 0.3 * pulse})`, 3.5, [7, 5]);
  }
  if (state.alts && state.think && state.think.phase === 'reveal') {
    state.alts.forEach((a, i) => { if (a.rest) ring(ctx, cam, a.rest.x, a.rest.y, 0.17, i === 0 ? 'rgba(120,255,190,0.95)' : 'rgba(255,255,255,0.35)', i === 0 ? 3.5 : 2); });
  }
}

// the ball waiting at the foul line, the rubber band and the power gauge
function drawReady(ctx, L, state) {
  const m = state.m, cam = L.cam;
  if (!state.humanTurn && !state.aiDrag) return;
  if (!(m.phase === 'aim' || m.phase === 'pallino')) return;
  const side = m.turn, rel = state.rel;
  const b = { x: rel, y: COURT.startY, z: m.phase === 'pallino' ? 0.045 : R_B, r: m.phase === 'pallino' ? 0.045 : R_B, k: m.phase === 'pallino', team: side, vx: 0, vy: 0 };
  const hover = state.drag || state.aiDrag ? 0 : 0.015 * Math.sin(state.t * 3);
  b.z += hover;
  drawShadow(ctx, cam, b);
  drawBall(ctx, cam, b, state.readyRot ?? identityRot());
  const p = cam.project(b.x, b.y, b.z), rp = b.r * p.s;
  if (state.coach && !state.drag) {
    // a pulsing hint of the gesture: the pull goes away from the throw direction
    const ph = (state.t * 1.4) % 1, q = cam.project(b.x, b.y + 1, b.z);
    let dx = p.x - q.x, dy = p.y - q.y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    ctx.save(); ctx.strokeStyle = 'rgba(255,246,220,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - ph * 0.7;
    const s0 = rp * 1.6, s1 = s0 + 90 * ph + 10, x0 = p.x + dx * s0, y0 = p.y + dy * s0, x1 = p.x + dx * s1, y1 = p.y + dy * s1, nx = -dy, ny = dx;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1 - dx * 12 + nx * 12, y1 - dy * 12 + ny * 12); ctx.lineTo(x1 + dx * 2, y1 + dy * 2); ctx.lineTo(x1 - dx * 12 - nx * 12, y1 - dy * 12 - ny * 12); ctx.stroke();
    ctx.restore();
  }
  const d = state.drag ?? (state.aiDrag ? { len: state.aiDrag.len, vx: state.aiDrag.vx, vy: state.aiDrag.vy } : null);
  if (d && d.len > 4) {
    const pw = Math.min(1, Math.max(0, (d.len - PULL.min) / (PULL.max - PULL.min)));
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,210,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + (d.vx ?? 0), p.y + (d.vy ?? 0)); ctx.stroke(); ctx.setLineDash([]);
    // gauge arc around the ball
    const r2 = rp * 2.1 + 6;
    ctx.lineWidth = Math.max(4, rp * 0.4); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y - rp * 0.2, r2, Math.PI * 0.8, Math.PI * 2.2); ctx.stroke();
    ctx.strokeStyle = pw < 0.7 ? '#9be37a' : pw < 0.92 ? '#f4d35e' : '#ff7a5a';
    ctx.beginPath(); ctx.arc(p.x, p.y - rp * 0.2, r2, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * pw)); ctx.stroke();
    ctx.restore();
  }
}

// ---- the HUD ---------------------------------------------------------------------------------------------------------------------
function hairline(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#6a5cff'); g.addColorStop(0.5, '#3d8bff'); g.addColorStop(1, '#2ee6c8');
  ctx.fillStyle = g; ctx.globalAlpha = 0.85; ctx.fillRect(x + 14, y, w - 28, 2); ctx.globalAlpha = 1;
}
function scoreCard(ctx, r, side, state, compact) {
  const m = state.m, lab = state.labels[side], turn = m.turn === side && (m.phase === 'aim' || m.phase === 'pallino' || m.phase === 'fly' || m.phase === 'pallino-fly');
  const col = TEAM[side];
  panel(ctx, r.x, r.y, r.w, r.h, { r: 20, fill: 'rgba(10,34,22,0.88)', stroke: turn ? 'rgba(255,224,130,0.9)' : 'rgba(255,255,255,0.18)' });
  hairline(ctx, r.x, r.y + 2, r.w);
  ctx.fillStyle = col.base; roundPath(ctx, r.x + 8, r.y + 12, 7, r.h - 24, 3); ctx.fill();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const nm = lab.name;
  let fs = 25; ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(nm).width > r.w - 120 && fs > 14) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.fillStyle = '#fff6dc'; ctx.fillText(nm, r.x + 26, r.y + 33);
  ctx.font = `400 15px ${FONT}`; ctx.fillStyle = 'rgba(255,246,220,0.62)'; ctx.fillText(lab.sub ?? col.name, r.x + 26, r.y + 53);
  // ball tray
  const left = m.hand[side];
  for (let i = 0; i < 4; i++) drawBallIcon(ctx, r.x + 36 + i * 28, r.y + r.h - 22, 10, side, i < left ? 1 : 0.2);
  ctx.textAlign = 'right'; ctx.font = `700 ${compact ? 44 : 52}px ${DISPLAY}`; ctx.fillStyle = '#ffd97a';
  ctx.fillText(String(m.scores[side]), r.x + r.w - 18, r.y + r.h - 22);
  if (turn) { ctx.fillStyle = 'rgba(255,224,130,0.95)'; ctx.beginPath(); ctx.arc(r.x + r.w - 20, r.y + 18, 5 + Math.sin(state.t * 6), 0, TAU); ctx.fill(); }
}

function phaseText(state) {
  const m = state.m;
  if (m.phase === 'score') return state.m.endInfo && state.m.endInfo.text ? 'Frame over' : 'Counting the balls';
  if (m.phase === 'over') return 'Match over';
  const lab = state.labels[m.turn];
  if (m.phase === 'pallino') return state.humanTurn ? 'Throw the pallino past the centre line' : `${lab.name} throws the pallino`;
  if (m.phase === 'fly' || m.phase === 'pallino-fly') return 'Rolling…';
  if (state.humanTurn) return m.cfg.mode === 'two' ? `${lab.name}: your throw` : `Your throw: ${TYPES[state.sel.type].name}`;
  if (state.think) return state.think.phase === 'reveal' ? `${lab.name} chooses…` : state.think.phase === 'pull' ? `${lab.name} throws` : `${lab.name} is thinking…`;
  return lab.name;
}

function pill(ctx, x, y, text, maxW, a = 1) {
  ctx.save(); ctx.font = `600 20px ${FONT}`;
  const lines = wrapLines(ctx, text, maxW - 36).slice(0, 2), lh = 24;
  const w = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36), h = 34 + (lines.length - 1) * lh;
  roundPath(ctx, x - w / 2, y - 17, w, h, 17); ctx.fillStyle = `rgba(8,26,16,${0.8 * a})`; ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.2 * a})`; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = `rgba(255,246,220,${a})`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, y + 1 + i * lh));
  ctx.restore();
}

function drawToast(ctx, L, state) {
  if (state.toastT <= 0 || !state.toast) return;
  const T = L.play.toast, a = Math.min(1, state.toastT * 2), sc = TEXT_SCALES[state.settings.textIdx];
  ctx.save(); const fs = Math.round(22 * Math.min(sc, 1.6)); ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, state.toast, T.maxW - 36), lh = fs * 1.25, h = lines.length * lh + 20, w = Math.min(T.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36);
  const x = T.left ? T.x : T.x;
  ctx.globalAlpha = a;
  roundPath(ctx, x - w / 2, T.y - 4, w, h, 18); ctx.fillStyle = 'rgba(10,30,20,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,224,130,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, x, T.y + 8 + fs * 0.85 + i * lh));
  ctx.restore();
}

const spinLabel = (s) => (s === 0 ? 'Straight' : `${s < 0 ? 'Left' : 'Right'}${Math.abs(s) === 2 ? ' ×2' : ''}`);
function triangle(ctx, cx, cy, s, dir, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(cx + dir * s, cy); ctx.lineTo(cx - dir * s * 0.7, cy - s * 0.95); ctx.lineTo(cx - dir * s * 0.7, cy + s * 0.95); ctx.closePath(); ctx.fill();
}

function drawControls(ctx, L, state) {
  const P = L.play, m = state.m, watch = m.cfg.mode === 'watch', dis = !state.humanTurn || state.paused || state.pauseMenu;
  {
    const y = P.barTop - 4, g = ctx.createLinearGradient(0, y, 0, L.h);
    g.addColorStop(0, 'rgba(8,24,14,0.0)'); g.addColorStop(0.08, 'rgba(8,24,14,0.9)'); g.addColorStop(1, 'rgba(8,24,14,0.96)');
    ctx.fillStyle = g; ctx.fillRect(0, y, L.w, L.h - y);
    hairline(ctx, 0, P.barTop, L.w);
  }
  const fsz = 27;
  if (watch) {
    const D = P.demo;
    drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: !state.paused, active: state.paused, size: fsz });
    drawButton(ctx, D.dec, 'Think −', { disabled: state.settings.thinkIdx === 0, size: fsz - 4, dark: true });
    drawButton(ctx, D.inc, `Think + ${THINK_STEPS[state.settings.thinkIdx]}s`, { disabled: state.settings.thinkIdx === THINK_STEPS.length - 1, size: fsz - 4, dark: true });
    drawButton(ctx, D.exit, 'Exit', { dark: true, size: fsz });
    return;
  }
  const pal = m.phase === 'pallino';
  TYPES.forEach((t, i) => drawButton(ctx, P.types[i], t.name, { active: state.sel.type === i, disabled: dis || (pal && i === 2), sub: t.it, size: fsz, dark: !dis && state.sel.type !== i }));
  drawButton(ctx, P.spinDec, '', { disabled: dis || state.sel.spin <= -2, dark: true });
  drawButton(ctx, P.spinInc, '', { disabled: dis || state.sel.spin >= 2, dark: true });
  triangle(ctx, P.spinDec.x + P.spinDec.w / 2, P.spinDec.y + P.spinDec.h / 2, 10, -1, dis || state.sel.spin <= -2 ? 'rgba(255,255,255,0.3)' : '#fff6dc');
  triangle(ctx, P.spinInc.x + P.spinInc.w / 2, P.spinInc.y + P.spinInc.h / 2, 10, 1, dis || state.sel.spin >= 2 ? 'rgba(255,255,255,0.3)' : '#fff6dc');
  drawButton(ctx, P.spinLabel, spinLabel(state.sel.spin), { disabled: dis, active: state.sel.spin !== 0, sub: 'Curve', size: fsz - 4 });
  drawButton(ctx, P.hint, 'Hint', { disabled: dis || m.phase !== 'aim', size: fsz });
  drawButton(ctx, P.menu, 'Menu', { dark: true, size: fsz });
}

function drawExplain(ctx, L, state) {
  const P = L.play, R = P.explain, ex = state.explain;
  if (!L.wide || !R || R.w < 260 || !ex || state.m.cfg.mode !== 'watch') return;
  panel(ctx, R.x, R.y, R.w, R.h, { r: 18, fill: 'rgba(10,34,22,0.88)', stroke: 'rgba(255,224,130,0.35)' });
  hairline(ctx, R.x, R.y + 2, R.w);
  ctx.save(); ctx.beginPath(); ctx.rect(R.x + 6, R.y + 4, R.w - 12, R.h - 8); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  let fs = 19; ctx.font = `700 ${fs}px ${FONT}`; ctx.fillStyle = '#ffd97a';
  let head = ex.head; while (ctx.measureText(head).width > R.w - 28 && head.length > 12) head = head.slice(0, -2);
  ctx.fillText(head === ex.head ? head : `${head}…`, R.x + 14, R.y + 27);
  const rows = ex.lines.slice(0, 4), lh = Math.min(20, (R.h - 40) / Math.max(1, rows.length));
  ctx.font = `400 ${Math.min(16, lh - 3)}px ${FONT}`;
  rows.forEach((l, i) => { ctx.fillStyle = i === 0 && ex.lines.length > 1 ? '#8cf0b8' : 'rgba(255,246,220,0.85)'; let t = l; while (ctx.measureText(t).width > R.w - 28 && t.length > 8) t = t.slice(0, -2); ctx.fillText(t, R.x + 14, R.y + 48 + i * lh); });
  ctx.restore();
}

function drawHUD(ctx, L, state) {
  const P = L.play, m = state.m;
  scoreCard(ctx, P.cards[0], 0, state, L.wide); scoreCard(ctx, P.cards[1], 1, state, L.wide);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${L.wide ? 22 : 24}px ${FONT}`; ctx.fillStyle = '#fff6dc';
  if (m.cfg.mode === 'tour') { ctx.fillText(`Cup: ${['Quarter-final', 'Semi-final', 'Final'][state.tour ? state.tour.round : 0]}`, P.info.x, P.info.y); }
  else ctx.fillText(`Frame ${m.frame}`, P.info.x, P.info.y);
  ctx.font = `400 ${L.wide ? 16 : 18}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,220,0.7)';
  ctx.fillText(`first to ${m.cfg.target}`, P.info.x, P.info.y2);
  drawExplain(ctx, L, state);
  pill(ctx, P.pill.x, P.pill.y, phaseText(state), P.pill.w || L.w - 40);
  drawToast(ctx, L, state);
  if (state.ff > 1) { ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,246,220,0.85)'; ctx.fillText('▶▶ fast', P.ffPos.x, P.ffPos.y); }
  if (state.paused && m.cfg.mode === 'watch') {
    ctx.font = `700 54px ${DISPLAY}`; textShadow(ctx, 'Paused', L.camRect.x + L.camRect.w / 2, L.camRect.y + L.camRect.h * 0.4, '#fff6dc', 10);
  }
  if (state.pop && m.phase !== 'score') {
    const k = Math.min(1, state.pop.t / 1.2), cx = L.camRect.x + L.camRect.w / 2, cy = L.camRect.y + L.camRect.h * 0.42 - ease.outCubic(k) * 50;
    ctx.save(); ctx.globalAlpha = 1 - Math.max(0, (state.pop.t - 1.1) / 0.7); ctx.font = `700 ${Math.round(110 * ease.outBack(Math.min(1, state.pop.t * 3)))}px ${DISPLAY}`;
    ctx.textAlign = 'center'; textShadow(ctx, state.pop.text, cx, cy, state.pop.team === 0 ? TEAM[0].hi : TEAM[1].hi, 14); ctx.restore();
  }
  // watch & learn: the think timer
  if (state.think && m.cfg.mode === 'watch' && state.think.phase !== 'pull') {
    const th = state.think, k = Math.min(1, th.t / th.dur), x = P.pill.x, y = P.pill.y + 30, w = Math.min(280, (P.pill.w || L.w) - 40);
    roundPath(ctx, x - w / 2, y, w, 8, 4); ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill();
    roundPath(ctx, x - w / 2, y, Math.max(8, w * k), 8, 4); ctx.fillStyle = th.phase === 'reveal' ? '#7cf0b0' : '#f4d35e'; ctx.fill();
  }
}

// ---- the end-of-frame close-up: the balls from above, with the measured distances -------------------------------------------
function drawScorePanel(ctx, L, state) {
  const m = state.m, info = m.endInfo, S = L.play.score, w = state.w, pal = thePallino(w);
  const k = Math.min(1, info.t / 0.5);
  ctx.save(); ctx.globalAlpha = ease.outCubic(k);
  panel(ctx, S.x, S.y, S.w, S.h, { r: 28, fill: 'rgba(8,30,20,0.95)', stroke: 'rgba(255,224,130,0.6)' });
  hairline(ctx, S.x, S.y + 3, S.w);
  const sc = TEXT_SCALES[state.settings.textIdx];
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(34 * Math.min(1.3, sc))}px ${DISPLAY}`; ctx.fillStyle = '#fff6dc';
  const head = info.void ? 'Frame void' : info.team >= 0 && info.pts > 0 ? `${state.labels[info.team].name} ${state.labels[info.team].plural ? 'score' : 'scores'} ${info.pts}` : 'No score';
  ctx.fillText(head, S.x + S.w / 2, S.y + 56);
  const fy0 = S.y + 76, fh = S.h - 76 - 74, fx0 = S.x + 22, fw = S.w - 44;
  ctx.save(); roundPath(ctx, fx0, fy0, fw, fh, 18); ctx.clip();
  const g = ctx.createLinearGradient(0, fy0, 0, fy0 + fh); g.addColorStop(0, '#d9ccae'); g.addColorStop(1, '#bfb08c');
  ctx.fillStyle = g; ctx.fillRect(fx0, fy0, fw, fh);
  if (pal) {
    const rk = ranking(w), cx = fx0 + fw / 2, cy = fy0 + fh / 2;
    const rank = rk.map((r, i) => ({ ...r, i, scoring: !info.void && r.b.team === info.team && r.i < info.pts }));
    // zoom on the balls that decided the frame: the scoring ones and the closest rival ball
    const rel = rank.filter((r) => r.scoring || r.i <= Math.max(1, info.pts));
    const maxd = Math.max(0.35, ...rel.map((r) => r.d));
    const ppm = Math.min(Math.min(fw, fh) * 0.42 / maxd, 300);
    ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    for (const r of rank) {
      const bx = cx + (r.b.x - pal.x) * ppm, by = cy - (r.b.y - pal.y) * ppm;
      ctx.strokeStyle = r.scoring ? 'rgba(255,224,130,0.95)' : 'rgba(60,40,20,0.3)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(bx, by); ctx.stroke();
    }
    ctx.setLineDash([]);
    const rr = Math.max(17, Math.min(38, R_B * ppm));
    for (const r of [...rank].reverse()) {
      const bx = cx + (r.b.x - pal.x) * ppm, by = cy - (r.b.y - pal.y) * ppm;
      if (bx < fx0 - rr || bx > fx0 + fw + rr || by < fy0 - rr || by > fy0 + fh + rr) continue;
      ctx.fillStyle = 'rgba(40,24,10,0.25)'; ctx.beginPath(); ctx.ellipse(bx + 3, by + 5, rr, rr * 0.9, 0, 0, TAU); ctx.fill();
      drawBallIcon(ctx, bx, by, rr, r.b.team, 1);
      if (r.scoring) { ctx.strokeStyle = 'rgba(255,214,90,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(bx, by, rr + 4, 0, TAU); ctx.stroke(); }
      if (rel.includes(r)) {
        const txt = `${Math.round(r.d * 100)} cm`, fs = Math.round(15 * Math.min(1.4, sc));
        ctx.font = `700 ${fs}px ${FONT}`; const tw = ctx.measureText(txt).width + 12, tx = bx >= cx ? bx + rr + 6 : bx - rr - 6 - tw;
        const ty = clamp(by - fs / 2 - 3, fy0 + 4, fy0 + fh - fs - 10);
        roundPath(ctx, clamp(tx, fx0 + 4, fx0 + fw - tw - 4), ty, tw, fs + 8, 8); ctx.fillStyle = 'rgba(20,40,28,0.82)'; ctx.fill();
        ctx.fillStyle = '#fff6dc'; ctx.textAlign = 'left'; ctx.fillText(txt, clamp(tx, fx0 + 4, fx0 + fw - tw - 4) + 6, ty + fs + 1);
      }
    }
    drawBallIcon(ctx, cx, cy, Math.max(8, Math.min(16, pal.r * ppm * 1.4)), -1, 1);
  }
  ctx.restore();
  ctx.font = `400 ${Math.round(20 * Math.min(1.5, sc))}px ${FONT}`; ctx.fillStyle = 'rgba(255,246,220,0.85)';
  const msg = info.text || (info.pts > 0 ? `${info.pts === 1 ? 'The closest ball scores' : `Closest ${info.pts} balls score`}` : '');
  const lines = wrapLines(ctx, msg, S.w - 60);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, S.x + S.w / 2, S.y + S.h - 56 + i * 24));
  ctx.font = `600 ${Math.round(18 * Math.min(1.4, sc))}px ${FONT}`; ctx.fillStyle = 'rgba(255,224,130,0.9)';
  ctx.fillText(state.m.cfg.mode === 'watch' ? 'Next frame in a moment' : 'Tap to continue', S.x + S.w / 2, S.y + S.h - 16);
  ctx.restore();
}

export function renderPlay(ctx, state, L) {
  const ok = worldBackdrop(ctx, L, state, state.w, state.parts, { follow: true, extra: () => { drawGuides(ctx, L, state); drawReady(ctx, L, state); } });
  if (!ok) return;
  drawHUD(ctx, L, state);
  drawControls(ctx, L, state);
  if (state.m.phase === 'score' && state.m.endInfo) drawScorePanel(ctx, L, state);
}
export { drawParts, drawBalls };
