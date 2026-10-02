// Drawing the beach court and everything on it: backdrop, guides, players, ball, particles and the HUD.
// Pure drawing; game.js owns state. All positions are court metres projected with cam.js.
import { W, H, project, clamp } from './cam.js';
import { drawSky, drawSea, drawShore, lightAt, rgb, startBake, canBake, setHost, SHORE, BAKE_STEPS } from './art.js';
import { drawFigure, LOOKS } from './figure.js';
import { G, HW, LEN, MID, SWEET_LO, SWEET_HI, ballAt, shotFor, velFor, timeToZ, REACH } from './sim.js';
import { FONT, C, roundPath, wrapLines, drawButton } from './ui.js';
import { PAUSE_BTN, HINT_BTN, WATCH_BAR } from './layout.js';

const TAU = Math.PI * 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();

// ---- the baked sand: prepared in slices behind the menus -----------------------------------------------------------------
let sand = null, job = null, bakeFailed = false, bakeDone = 0;
export function ensureSand(ctx, steps = 3) {
  if (sand || bakeFailed) return sand;
  setHost(ctx);
  if (!canBake()) { bakeFailed = true; return null; }
  if (!job) job = startBake();
  if (job.failed) { bakeFailed = true; return null; }
  const cv = job.step(SHOT_MODE ? 99 : steps);
  if (cv) sand = cv;
  return sand;
}
export const sandReady = () => !!sand;
export const sandProgress = () => (sand ? 1 : 0);
void BAKE_STEPS; void bakeDone;

const groundEllipse = (x, y, r) => {
  const c = project(x, y, 0), a = project(x + r, y, 0), b = project(x, y + r, 0), b2 = project(x, y - r, 0);
  return { cx: c.x, cy: c.y, rx: Math.abs(a.x - c.x), ry: Math.abs(b.y - b2.y) / 2 };
};
function ring(ctx, x, y, r, col, lw = 3, dash = null, fill = null) {
  const e = groundEllipse(x, y, r);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = lw; ctx.strokeStyle = col; if (dash) ctx.setLineDash(dash); ctx.stroke();
  ctx.restore();
}

export function outlineText(ctx, text, x, y, size, fill = '#fff', stroke = 'rgba(8,28,44,0.85)', weight = 900, lw = null) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.lineJoin = 'round';
  ctx.lineWidth = lw ?? Math.max(3, size * 0.14); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawBall(ctx, x, y, r, glow = 0, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (glow > 0) {
    ctx.strokeStyle = `rgba(80,255,170,${0.55 * glow})`; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.arc(x, y, r + 5 + glow * 4, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(80,255,170,${0.22 * glow})`; ctx.beginPath(); ctx.arc(x, y, r + 5 + glow * 4, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ff9a72'); g.addColorStop(0.45, '#ff5a3c'); g.addColorStop(1, '#a8230f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(70,10,0,0.55)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.22, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- backdrop -----------------------------------------------------------------------------------------------------------
export function drawBackdrop(ctx, L, t) {
  drawSky(ctx, L, t);
  drawSea(ctx, L, t);
  const sp = ensureSand(ctx);
  if (sp) ctx.drawImage(sp, 0, 0, W, H);
  else {
    const g = ctx.createLinearGradient(0, SHORE, 0, H);
    g.addColorStop(0, '#ecd6a0'); g.addColorStop(1, '#e6cc92');
    ctx.fillStyle = g; ctx.fillRect(0, SHORE - 6, W, H - SHORE + 6);
  }
  drawShore(ctx, L, t);
}
export function drawGrade(ctx, L) {
  const [r, g, b, a] = L.tint;
  if (a > 0.005) { ctx.fillStyle = `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`; ctx.fillRect(0, 0, W, H); }
  const sx = L.sunX * W;
  const gl = ctx.createRadialGradient(sx, 120, 20, sx, 120, 780);
  gl.addColorStop(0, rgb(L.sun, 0.12 * L.glow)); gl.addColorStop(1, rgb(L.sun, 0));
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, 700, 380, W / 2, 700, 900);
  v.addColorStop(0, 'rgba(10,24,44,0)'); v.addColorStop(1, 'rgba(10,24,44,0.28)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ---- guides ------------------------------------------------------------------------------------------------------------------
const H_MEET = 1.15;
// Where the incoming ball will pass through hitting height: { x, y, t } or null.
export function dropPoint(w, h = H_MEET) {
  const b = w.b;
  if (!b.live) return null;
  const t = timeToZ(b, h);
  if (t === null) return null;
  const q = ballAt(b, w.wind, t);
  return { x: q.x, y: q.y, t };
}

function arcFor(w, P, shot) {
  const from = { x: P.x, y: P.y, z: H_MEET };
  const v = velFor(from, shot.tx, shot.ty, shot.T, w.wind);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * shot.T;
    const q = ballAt({ ...from, ...v }, w.wind, t);
    pts.push(project(q.x, q.y, Math.max(0, q.z)));
  }
  return pts;
}

export function drawReticle(ctx, x, y, sigma, col, t, label = null) {
  const e = groundEllipse(x, y, Math.max(0.45, sigma * 1.2 + 0.3));
  ctx.save();
  ctx.fillStyle = col.replace(/[\d.]+\)$/, '0.14)');
  ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 18;
  ctx.beginPath(); ctx.ellipse(e.cx, e.cy, e.rx, e.ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  const c = project(x, y, 0);
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - 12, c.y); ctx.lineTo(c.x + 12, c.y); ctx.moveTo(c.x, c.y - 12); ctx.lineTo(c.x, c.y + 12); ctx.stroke();
  if (label) { ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(8,28,44,0.8)'; ctx.lineWidth = 4; ctx.strokeText(label, c.x, c.y - e.ry - 8); ctx.fillText(label, c.x, c.y - e.ry - 8); }
  ctx.restore();
}

function drawArc(ctx, pts, col) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.setLineDash([2, 9]); ctx.lineCap = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.restore();
}

export function drawPlan(ctx, w, plan, t, o = {}) {
  if (!plan || !plan.feasible) return;
  const col = o.col ?? 'rgba(96,255,180,0.95)';
  const P = plan.P;
  const alts = o.alts && plan.ranked ? plan.ranked.slice(1, 4) : [];
  alts.forEach((a, i) => { if (a.S) ring(ctx, a.S.x, a.S.y + 0.0, 0.55, 'rgba(255,255,255,0.45)', 2.4, [5, 6]); void i; });
  // stand point
  const pulse = 0.5 + 0.5 * Math.sin(t * 5);
  ring(ctx, plan.S.x, plan.S.y + (w.p[o.side ?? 0].face) * 0.3, 0.62, col, 3.5, null, 'rgba(96,255,180,0.18)');
  ring(ctx, plan.S.x, plan.S.y + (w.p[o.side ?? 0].face) * 0.3, 0.62 + pulse * 0.12, col.replace('0.95', '0.5'), 2);
  const sp = project(plan.S.x, plan.S.y + (w.p[o.side ?? 0].face) * 0.3, 0);
  ctx.save(); ctx.font = `800 17px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(8,28,44,0.8)'; ctx.lineWidth = 4;
  ctx.strokeText(o.standLabel ?? 'STAND HERE', sp.x, sp.y + 30); ctx.fillText(o.standLabel ?? 'STAND HERE', sp.x, sp.y + 30); ctx.restore();
  // meet point
  ring(ctx, P.x, P.y, 0.22, 'rgba(255,255,255,0.9)', 2.5);
  // shot
  const p = w.p[o.side ?? 0];
  const sh = shotFor(p, { x: P.x, y: P.y }, plan.h, { aim: plan.aim, pace: w.pace });
  const pts = arcFor(w, P, { tx: plan.aim.tx, ty: sh.ty, T: sh.T });
  drawArc(ctx, pts, col.replace('0.95', '0.8'));
  drawReticle(ctx, plan.aim.tx, sh.ty, plan.aim.sigma ?? 0.1, col, t, o.aimLabel ?? 'AIM');
}

// ---- actors ------------------------------------------------------------------------------------------------------------------
function drawPlayerSprite(ctx, p, look, L) {
  const pr = project(p.x, p.y, 0);
  drawFigure(ctx, { x: pr.x, y: pr.y, s: pr.s, back: p.side === 0, look, run: p.run, speed: Math.hypot(p.vx, p.vy), swingT: p.swingT, lean: clamp(p.vx / 5, -1, 1) * (p.side === 0 ? 1 : -1), shade: L.shade });
}

export function drawActors(ctx, w, looks, L, trail, t, o = {}) {
  const b = w.b;
  // ball shadow first (on the ground)
  if (b.live || w.phase === 'dead') {
    const sp = project(b.x, b.y, 0), s = sp.s, rx = 0.2 * s * (1 + b.z * 0.1), a = 0.38 / (1 + b.z * 0.45);
    ctx.fillStyle = `rgba(50,34,16,${a})`; ctx.beginPath(); ctx.ellipse(sp.x + L.shade[0] * b.z * 0.1 * s, sp.y, rx, rx * 0.5, 0, 0, TAU); ctx.fill();
  }
  const items = [];
  items.push({ y: w.p[1].y, f: () => drawPlayerSprite(ctx, w.p[1], looks[1], L) });
  items.push({ y: w.p[0].y, f: () => drawPlayerSprite(ctx, w.p[0], looks[0], L) });
  if (b.live || w.phase === 'dead') items.push({ y: b.y, f: () => drawBallWithTrail(ctx, w, trail, o) });
  items.sort((a, c) => c.y - a.y);
  for (const it of items) it.f();
  void t;
}

function drawBallWithTrail(ctx, w, trail, o) {
  const b = w.b;
  if (trail && trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const a = project(trail[i - 1].x, trail[i - 1].y, trail[i - 1].z), c = project(trail[i].x, trail[i].y, trail[i].z), k = i / trail.length;
      ctx.strokeStyle = `rgba(255,236,206,${0.5 * k})`; ctx.lineWidth = 1 + 5 * k * (c.s / 60); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    }
  }
  const p = project(b.x, b.y, Math.max(0, b.z)), r = Math.max(5, 0.15 * p.s);
  // timing cue for the human: green when a swing right now would be sweet and the ball is in reach
  let glow = 0;
  if (o.cue && b.live && b.last !== 0) {
    const pl = w.p[0], d = Math.hypot(b.x - pl.x, b.y - (pl.y + 0.3));
    if (d <= pl.reach && b.z >= SWEET_LO - 0.1 && b.z <= SWEET_HI + 0.35) glow = b.z >= SWEET_LO && b.z <= SWEET_HI ? 1 : 0.5;
  }
  drawBall(ctx, p.x, p.y, r, glow);
}

// ---- particles ---------------------------------------------------------------------------------------------------------------
export function drawParts(ctx, parts) {
  for (const q of parts) {
    const k = q.t / q.max;
    const p = project(q.x, q.y, q.z);
    if (q.kind === 0) {
      ctx.fillStyle = `rgba(214,184,128,${0.55 * (1 - k)})`; ctx.beginPath(); ctx.arc(p.x, p.y, q.size * p.s * 0.07 * (1 + k), 0, TAU); ctx.fill();
    } else if (q.kind === 1) {
      ctx.strokeStyle = `rgba(255,236,170,${1 - k})`; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      const p2 = project(q.x - q.vx * 0.04, q.y - q.vy * 0.04, q.z - q.vz * 0.04);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    } else if (q.kind === 2) {
      ctx.strokeStyle = (q.col ?? 'rgba(255,255,255,A)').replace('A', String(0.8 * (1 - k))); ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, (14 + q.size * 36 * k) * (p.s / 60), (14 + q.size * 36 * k) * (p.s / 60) * 0.8, 0, 0, TAU); ctx.stroke();
    } else if (q.kind === 3) {
      const e = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      ctx.save(); ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      outlineText(ctx, q.text, p.x, p.y - e * 46, q.size, q.col ?? '#fff');
      ctx.restore();
    } else if (q.kind === 4) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.t * 7 + q.rot); ctx.fillStyle = q.col; ctx.globalAlpha = 1 - k * k; ctx.fillRect(-4, -2, 8, 4); ctx.restore();
    }
  }
}

// ---- HUD ---------------------------------------------------------------------------------------------------------------------
function iconBtn(ctx, r, kind, o = {}) {
  ctx.save();
  roundPath(ctx, r.x, r.y + 4, r.w, r.h, 22); ctx.fillStyle = C.shadow; ctx.fill();
  roundPath(ctx, r.x, r.y, r.w, r.h, 22); ctx.fillStyle = o.disabled ? 'rgba(205,214,217,0.7)' : o.on ? C.sea : 'rgba(255,249,234,0.95)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(16,50,74,0.4)'; ctx.stroke();
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.fillStyle = o.on ? '#fff' : C.ink; ctx.strokeStyle = o.on ? '#fff' : C.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  if (kind === 'pause') { roundPath(ctx, cx - 14, cy - 15, 9, 30, 3); ctx.fill(); roundPath(ctx, cx + 5, cy - 15, 9, 30, 3); ctx.fill(); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(cx - 10, cy - 16); ctx.lineTo(cx + 16, cy); ctx.lineTo(cx - 10, cy + 16); ctx.closePath(); ctx.fill(); }
  else if (kind === 'hint') {
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy - 4, 13, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 6, cy + 14); ctx.lineTo(cx + 6, cy + 14); ctx.moveTo(cx - 4, cy + 20); ctx.lineTo(cx + 4, cy + 20); ctx.stroke();
  }
  ctx.restore();
}

function pill(ctx, x, y, w, h, fill = 'rgba(8,28,44,0.6)') { roundPath(ctx, x, y, w, h, h / 2); ctx.fillStyle = fill; ctx.fill(); }

const TIERS = [{ at: 0, name: 'Warm-up' }, { at: 10, name: 'Steady' }, { at: 25, name: 'Flow' }, { at: 50, name: 'Beach Master' }, { at: 100, name: 'Legend' }];
export const tierOf = (n) => { let t = 0; for (let i = 0; i < TIERS.length; i++) if (n >= TIERS[i].at) t = i; return t; };
export const TIER_AT = TIERS.map((t) => t.at);
export const TIER_NAMES = TIERS.map((t) => t.name);

export function drawHud(ctx, st, t) {
  const run = st.run, mode = run.mode;
  const watch = mode === 'watch';
  if (!watch) {
    iconBtn(ctx, PAUSE_BTN, 'pause');
    iconBtn(ctx, HINT_BTN, 'hint', { on: !!run.guide, disabled: !st.hintOk });
  }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  if (mode === 'coop') {
    const tier = tierOf(run.rally), nextAt = TIER_AT[tier + 1] ?? null;
    outlineText(ctx, String(run.rally), W / 2, 150, 104, '#fff');
    ctx.font = `800 20px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText('RALLY', W / 2, 52 + 0);
    // tier chip and progress to the next tier
    const tw = 300, tx = W / 2 - tw / 2, ty = 168;
    pill(ctx, tx, ty, tw, 30);
    const from = TIER_AT[tier], to = nextAt ?? from + 50, f = clamp((run.rally - from) / (to - from), 0, 1);
    roundPath(ctx, tx + 3, ty + 3, Math.max(24, (tw - 6) * f), 24, 12); ctx.fillStyle = C.sun; ctx.fill();
    ctx.font = `800 17px ${FONT}`; ctx.fillStyle = f > 0.5 ? C.ink : '#fff'; ctx.textAlign = 'center';
    ctx.fillText(TIER_NAMES[tier].toUpperCase(), tx + tw / 2, ty + 21);
    // score, best
    ctx.textAlign = 'left'; ctx.font = `800 17px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('SCORE', 24, 150);
    outlineText(ctx, String(run.points), 24, 192, 44, '#ffe9a8'); ctx.textAlign = 'left';
    ctx.textAlign = 'right'; ctx.font = `800 17px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText('BEST', W - 24, 150);
    outlineText(ctx, String(Math.max(st.record.bestRally, run.rally)), W - 24, 192, 44, '#ffffff'); ctx.textAlign = 'center';
    if (run.mult >= 2) {
      const pw = 190, px = W / 2 - pw / 2, py = 208;
      pill(ctx, px, py, pw, 34, 'rgba(255,106,74,0.92)');
      ctx.font = `900 20px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(`RHYTHM x${run.mult}`, W / 2, py + 24);
    }
  } else if (mode === 'match' || watch) {
    const names = run.names;
    const bw = 440, bx = W / 2 - bw / 2, by = 46;
    roundPath(ctx, bx, by, bw, 78, 26); ctx.fillStyle = 'rgba(8,28,44,0.66)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.font = `800 20px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    const nm = (s) => (s.length > 9 ? `${s.slice(0, 8)}.` : s);
    ctx.fillText(nm(names[0]).toUpperCase(), bx + 90, by + 28); ctx.fillText(nm(names[1]).toUpperCase(), bx + bw - 90, by + 28);
    outlineText(ctx, String(run.score[0]), bx + 90, by + 68, 40, '#ffe9a8'); outlineText(ctx, String(run.score[1]), bx + bw - 90, by + 68, 40, '#fff');
    ctx.font = `800 18px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(`TO ${run.to}`, W / 2, by + 28);
    ctx.fillStyle = C.sun; ctx.beginPath(); ctx.arc(run.serve === 0 ? bx + 28 : bx + bw - 28, by + 39, 7, 0, TAU); ctx.fill();
    if (run.rally > 1) { ctx.font = `800 18px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillText(`Rally ${run.rally}`, W / 2, by + 62); }
  }
  if (!watch && st.record.played < 2 && run.phase !== 'point') {
    const msg = 'Drag anywhere to run  ·  lift your thumb to swing';
    ctx.font = `800 22px ${FONT}`;
    const tw = ctx.measureText(msg).width + 40;
    pill(ctx, W / 2 - tw / 2, 1196, tw, 48, 'rgba(8,28,44,0.6)');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(msg, W / 2, 1227);
  }
  // wind pennant
  if (Math.abs(run.w.wind) > 0.05) {
    const x = watch ? 650 : 662, y = watch ? 160 : 246;
    ctx.save(); ctx.translate(x, y);
    pill(ctx, -44, -18, 88, 36, 'rgba(8,28,44,0.55)');
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    const dir = Math.sign(run.w.wind), len = 8 + Math.min(14, Math.abs(run.w.wind) * 18);
    ctx.beginPath(); ctx.moveTo(-len * dir - 8, 0); ctx.lineTo(len * dir + 6, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * dir + 8, 0); ctx.lineTo(len * dir - dir * 4, -6); ctx.lineTo(len * dir - dir * 4, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.font = `800 13px ${FONT}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('WIND', x, y + 32);
  }
  if (watch) {
    // watch bar
    const B = WATCH_BAR, th = st.settings.thinkIdx;
    drawButton(ctx, B.dec, 'Think −', { size: 24, disabled: th === 0 });
    drawButton(ctx, B.pause, st.paused ? 'Resume' : 'Pause', { size: 32, primary: true });
    drawButton(ctx, B.inc, 'Think +', { size: 24, disabled: th === 3 });
    drawButton(ctx, B.exit, 'Exit', { size: 24, dark: true });
    ctx.font = `800 20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText(`Watch & Learn · thinking time ${st.thinkSecs}s`, W / 2, 1262);
  }
  void t;
}

export function drawBanner(ctx, run) {
  const b = run.banner;
  if (!b) return;
  const a = clamp(Math.min(b.t / 0.18, (b.dur - b.t) / 0.3), 0, 1);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${b.size ?? 44}px ${FONT}`;
  const lines = wrapLines(ctx, b.text, 600), lh = (b.size ?? 44) * 1.12;
  ctx.font = `800 24px ${FONT}`;
  const sub = b.sub ? wrapLines(ctx, b.sub, 560) : [];
  const h = lines.length * lh + sub.length * 30 + 34, y0 = b.y ?? 330;
  const lift = (1 - clamp(b.t / 0.25, 0, 1)) * 14;
  roundPath(ctx, 60, y0 - 20 + lift, 600, h, 28); ctx.fillStyle = b.fill ?? 'rgba(8,28,44,0.72)'; ctx.fill();
  ctx.font = `900 ${b.size ?? 44}px ${FONT}`; ctx.fillStyle = b.color ?? '#fff';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 20 + i * lh + lift));
  ctx.font = `700 24px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  sub.forEach((l, i) => ctx.fillText(l, W / 2, y0 + 20 + lines.length * lh + 14 + i * 30 + lift));
  ctx.restore();
}

export function drawThink(ctx, st, t) {
  const th = st.run.think;
  if (!th) return;
  const rev = th.phase === 'reveal';
  ctx.save();
  ctx.fillStyle = rev ? 'rgba(8,28,44,0.10)' : 'rgba(8,28,44,0.22)'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const px = 24, py = 132, pw = 672, ph = 218;
  roundPath(ctx, px, py, pw, ph, 28); ctx.fillStyle = 'rgba(255,249,234,0.96)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(16,50,74,0.35)'; ctx.stroke();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const head = rev ? `${th.name}: ${th.plan.text}` : `${th.name} is thinking`;
  let hs = 30;
  ctx.font = `900 ${hs}px ${FONT}`;
  while (ctx.measureText(head).width > pw - 52 - 130 && hs > 16) { hs -= 1; ctx.font = `900 ${hs}px ${FONT}`; }
  ctx.fillStyle = C.ink;
  ctx.fillText(head, px + 26, py + 46);
  // timer bar
  const f = clamp(th.t / th.dur, 0, 1);
  roundPath(ctx, px + 26, py + 64, pw - 52, 14, 7); ctx.fillStyle = 'rgba(16,50,74,0.14)'; ctx.fill();
  roundPath(ctx, px + 26, py + 64, Math.max(14, (pw - 52) * f), 14, 7); ctx.fillStyle = rev ? C.good : C.sea; ctx.fill();
  ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(16,50,74,0.85)';
  const lines = th.lines, shown = rev ? lines.length : Math.min(lines.length, 1 + Math.floor(f * lines.length * 1.2));
  for (let i = 0; i < shown; i++) ctx.fillText(lines[i], px + 26, py + 112 + i * 32);
  ctx.font = `800 18px ${FONT}`; ctx.fillStyle = rev ? C.good : 'rgba(16,50,74,0.6)'; ctx.textAlign = 'right';
  ctx.fillText(rev ? 'REVEAL' : `THINK ${Math.max(0, th.dur - th.t).toFixed(1)}s`, px + pw - 26, py + 46);
  void t;
}

// ---- the whole play scene -----------------------------------------------------------------------------------------------------
export function renderScene(ctx, st, s) {
  // s: { w, L, parts, trail, looks, t, cue, guideBall, hintPlan, thinkPlan, shake }
  ctx.save();
  if (s.shake) ctx.translate((Math.sin(s.shake.t * 90) * s.shake.amp * (1 - s.shake.t / s.shake.dur)), (Math.cos(s.shake.t * 73) * s.shake.amp * 0.6 * (1 - s.shake.t / s.shake.dur)));
  drawBackdrop(ctx, s.L, s.t);
  if (s.guides) s.guides(ctx);
  drawActors(ctx, s.w, s.looks, s.L, s.trail, s.t, { cue: s.cue });
  drawParts(ctx, s.parts);
  drawGrade(ctx, s.L);
  ctx.restore();
}
void G; void HW; void LEN; void MID; void REACH; void LOOKS; void ring;
export { ring, groundEllipse };
