// The lane scene: alley hall, lane, gutters, deck, pit, pins, wood, ball, particles and the aim overlay, drawn through the
// camera in cam.js. Presentation only: reads state, never changes it.
import { LANE } from './sim.js';
import { makeCam } from './cam.js';
import { drawPin, drawLying, drawBall, alley, hash2 } from './art.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
const H = LANE.headY;
const FONT = "'Avenir Next', 'Trebuchet MS', 'Segoe UI', Roboto, system-ui, sans-serif";


const NEAR = 0.25;
// polygon / segment clipping against the camera's near plane, so geometry behind or beside the eye never inverts
function clipPts(P, pts) {
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n], da = P(a[0], a[1], a[2] ?? 0).d, db = P(b[0], b[1], b[2] ?? 0).d;
    const ia = da > NEAR, ib = db > NEAR;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (NEAR - da) / (db - da); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t]); }
  }
  return out;
}
function quad(ctx, P, pts0, fill, stroke = null) {
  const pts = clipPts(P, pts0);
  if (pts.length < 3) return;
  ctx.beginPath();
  pts.forEach((p, i) => { const q = P(p[0], p[1], p[2] ?? 0); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}
function seg(ctx, P, a, b) {
  const da = P(a[0], a[1], a[2] ?? 0).d, db = P(b[0], b[1], b[2] ?? 0).d;
  if (da <= NEAR && db <= NEAR) return;
  let A = a, B = b;
  if (da <= NEAR) { const t = (NEAR - da) / (db - da); A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t]; }
  if (db <= NEAR) { const t = (NEAR - db) / (da - db); B = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, (b[2] ?? 0) + ((a[2] ?? 0) - (b[2] ?? 0)) * t]; }
  const p = P(A[0], A[1], A[2] ?? 0), q = P(B[0], B[1], B[2] ?? 0);
  ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
}

// ---- the alley around the lane (static per camera; cheap polygons) --------------------------------------
function drawHall(ctx, R, P, A, vy, sign = true) {
  const g = ctx.createLinearGradient(0, R.y, 0, R.y + R.h);
  g.addColorStop(0, A.wall[1]); g.addColorStop(0.55, A.wall[0]); g.addColorStop(1, A.wall[1]);
  ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, R.h);
  // carpet and approach
  quad(ctx, P, [[-7, -6], [7, -6], [7, H + 6], [-7, H + 6]], null);
  const f0 = P(0, vy, 0), f1 = P(0, H + 2, 0);
  const cg = ctx.createLinearGradient(0, f1.y, 0, f0.y);
  cg.addColorStop(0, A.carpet[1]); cg.addColorStop(1, A.carpet[0]);
  quad(ctx, P, [[-3.4, -6], [3.4, -6], [3.4, H + 2.4], [-3.4, H + 2.4]], cg);
  // carpet pattern: soft diagonal bands
  ctx.save(); ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
  ctx.strokeStyle = A.glow;
  for (let i = -3; i <= 3; i += 1) seg(ctx, P, [i * 0.8, -3, 0], [i * 0.8, H, 0]);
  ctx.restore();
  // side walls
  for (const sgn of [-1, 1]) {
    const x = sgn * 3.4;
    const a = P(x, -3, 0), b = P(x, H + 2.4, 2.6);
    const wg = ctx.createLinearGradient(sgn < 0 ? a.x : b.x, 0, sgn < 0 ? b.x : a.x, 0);
    wg.addColorStop(0, A.wall[0]); wg.addColorStop(1, A.wall[1]);
    quad(ctx, P, [[x, -3, 0], [x, H + 2.4, 0], [x, H + 2.4, 2.8], [x, -3, 2.8]], wg);
    // light strips and panels
    ctx.save();
    ctx.strokeStyle = A.glow; ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(1.2, Math.abs(P(x, H - 4, 1.6).s) * 0.03);
    for (const z of [0.5, 1.9]) seg(ctx, P, [x, -3, z], [x, H + 2.4, z]);
    ctx.restore();
  }
  // back: pinsetter housing with a sign, curtain at the pit
  const yb = LANE.pitY + 0.1;
  quad(ctx, P, [[-3.4, yb, 0], [3.4, yb, 0], [3.4, yb, 2.8], [-3.4, yb, 2.8]], '#0a0c14');
  const hg = ctx.createLinearGradient(0, P(0, yb, 2.4).y, 0, P(0, yb, 0.95).y);
  hg.addColorStop(0, A.wall[0]); hg.addColorStop(1, '#10131c');
  quad(ctx, P, [[-2.6, yb, 0.95], [2.6, yb, 0.95], [2.6, yb, 2.5], [-2.6, yb, 2.5]], hg, 'rgba(255,255,255,0.12)');
  const sc = P(0, yb, 1.72);
  if (sign) {
  ctx.save();
  ctx.font = `800 ${Math.max(10, 0.42 * sc.s)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = A.sign; ctx.shadowBlur = 0.2 * sc.s; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.95;
  ctx.fillText('CANDLEPIN', sc.x, sc.y);
  ctx.lineWidth = Math.max(1, 0.012 * sc.s); ctx.strokeStyle = A.sign; ctx.strokeText('CANDLEPIN', sc.x, sc.y);
  ctx.restore();
  }
  // pit curtain (black, glossy)
  const cu = ctx.createLinearGradient(0, P(0, yb, 0.95).y, 0, P(0, yb, 0).y);
  cu.addColorStop(0, '#05060a'); cu.addColorStop(1, '#161a28');
  quad(ctx, P, [[-1.3, yb - 0.02, 0], [1.3, yb - 0.02, 0], [1.3, yb - 0.02, 0.95], [-1.3, yb - 0.02, 0.95]], cu);
}

function drawLane(ctx, R, P, A, vy) {
  const yEnd = H + 1.3, hw = LANE.halfW;
  // approach (lighter, in front of the foul line)
  quad(ctx, P, [[-hw - 0.5, -4, 0], [hw + 0.5, -4, 0], [hw + 0.5, 0, 0], [-hw - 0.5, 0, 0]], '#c9a06a');
  // the lane
  const a = P(0, Math.max(0, vy), 0), b = P(0, yEnd, 0);
  const lg = ctx.createLinearGradient(0, b.y, 0, a.y);
  lg.addColorStop(0, A.maple[1]); lg.addColorStop(0.4, A.maple[1]); lg.addColorStop(1, A.maple[0]);
  quad(ctx, P, [[-hw, 0, 0], [hw, 0, 0], [hw, yEnd, 0], [-hw, yEnd, 0]], lg);
  // boards: alternate shades, 13 boards of 3 planks
  const N = 13, bw = (hw * 2) / N;
  ctx.save();
  for (let i = 0; i < N; i += 1) {
    const x0 = -hw + i * bw;
    quad(ctx, P, [[x0, 0, 0], [x0 + bw, 0, 0], [x0 + bw, yEnd, 0], [x0, yEnd, 0]], i % 2 ? 'rgba(255,240,200,0.10)' : 'rgba(60,30,0,0.07)');
  }
  ctx.lineWidth = 1; ctx.strokeStyle = A.board;
  for (let i = 0; i <= N * 3; i++) { const x = -hw + (i * hw * 2) / (N * 3); seg(ctx, P, [x, 0, 0], [x, yEnd, 0]); }
  // plank joints
  ctx.strokeStyle = 'rgba(70,35,5,0.22)';
  for (let y = 1.1; y < H; y += 1.9) { const jx = (hash2(Math.floor(y * 10), 3) - 0.5) * 0.6; seg(ctx, P, [-hw + 0.1 + (jx > 0 ? jx : 0), y, 0], [hw - 0.1 + (jx < 0 ? jx : 0), y, 0]); }
  ctx.restore();
  // lights reflected in the varnish
  ctx.save();
  for (let y = 1.5; y < H + 1; y += 3.2) quad(ctx, P, [[-0.34, y - 0.35, 0], [0.34, y - 0.35, 0], [0.34, y + 0.35, 0], [-0.34, y + 0.35, 0]], 'rgba(255,248,225,0.13)');
  const sh = ctx.createLinearGradient(P(-hw, Math.max(0, vy), 0).x, 0, P(hw, Math.max(0, vy), 0).x, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0.0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.10)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  quad(ctx, P, [[-hw, 0, 0], [hw, 0, 0], [hw, yEnd, 0], [-hw, yEnd, 0]], sh);
  ctx.restore();
  // pin spots and arrows
  ctx.fillStyle = 'rgba(40,20,0,0.5)';
  for (let i = -3; i <= 3; i++) { const ay = 4.5 + Math.abs(i) * -0.25 + 0.75; quad(ctx, P, [[i * 0.12 - 0.022, ay + 0.2], [i * 0.12 + 0.022, ay + 0.2], [i * 0.12, ay - 0.1]], 'rgba(60,30,0,0.55)'); }
  for (const i of [-2, 0, 2]) { const p = P(i * 0.13, 1.5, 0); if (p.d < 0.5) continue; ctx.fillStyle = 'rgba(60,30,0,0.45)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.012 * p.s, 0.006 * p.s, 0, 0, TAU); ctx.fill(); }
  // foul line
  quad(ctx, P, [[-hw, -0.025, 0], [hw, -0.025, 0], [hw, 0.025, 0], [-hw, 0.025, 0]], '#d4262f');
  // pit
  const pg = ctx.createLinearGradient(0, P(0, LANE.pitY, 0).y, 0, P(0, yEnd, 0).y);
  pg.addColorStop(0, '#05060a'); pg.addColorStop(1, '#1a1e2c');
  quad(ctx, P, [[-LANE.deckHalf, yEnd, 0], [LANE.deckHalf, yEnd, 0], [LANE.deckHalf, LANE.pitY, 0], [-LANE.deckHalf, LANE.pitY, 0]], pg);
  // gutters
  for (const sgn of [-1, 1]) {
    const x0 = sgn * hw, x1 = sgn * (hw + 0.13);
    const gg = ctx.createLinearGradient(P(x0, 0, 0).x, 0, P(x1, 0, 0).x, 0);
    gg.addColorStop(0, '#0b0e18'); gg.addColorStop(0.5, '#2c3144'); gg.addColorStop(1, '#10131f');
    quad(ctx, P, [[x0, 0, 0], [x1, 0, 0], [x1, LANE.pitY, 0], [x0, LANE.pitY, 0]], gg);
    // lane edge strip
    quad(ctx, P, [[sgn * (hw - 0.01), 0, 0], [sgn * (hw + 0.01), 0, 0], [sgn * (hw + 0.01), yEnd, 0], [sgn * (hw - 0.01), yEnd, 0]], 'rgba(255,255,255,0.18)');
  }
  // kickback boards beside the deck (low walls)
  for (const sgn of [-1, 1]) {
    const x = sgn * LANE.deckHalf, y0 = LANE.deckStart, y1 = LANE.pitY - 0.02;
    const g = ctx.createLinearGradient(0, P(x, y1, 0.24).y, 0, P(x, y0, 0).y);
    g.addColorStop(0, '#3b2412'); g.addColorStop(1, '#6e4724');
    quad(ctx, P, [[x, y0, 0], [x, y1, 0], [x, y1, 0.2], [x, y0, 0.2]], g);
    quad(ctx, P, [[x, y0, 0.2], [x, y1, 0.2], [x + sgn * 0.07, y1, 0.2], [x + sgn * 0.07, y0, 0.2]], '#9d6f3c');
  }
}

// ---- the whole scene ----------------------------------------------------------------------------------
// R: the panel rectangle the scene is clipped to; pose: a camera pose (cam.js).
// o: { world, ball, parts, shake, aim: { x0, aimX, pts, gutter, hintPts }, ghost: bool, noAim, sweepAlpha }
export function drawScene(ctx, R, pose, o) {
  const A = alley();
  const cam = makeCam(pose), P = cam.project;
  if (v3.on) return cam;          // the 3D presenter draws the whole scene; the camera is still returned for hit testing
  ctx.save();
  ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
  if (o.shake) ctx.translate(Math.sin(o.shake.t * 90) * o.shake.a, Math.cos(o.shake.t * 77) * o.shake.a * 0.6);
  const vy = cam.ground(R.x + R.w / 2, R.y + R.h).y;
  drawHall(ctx, R, P, A, vy, !o.noAim);
  drawLane(ctx, R, P, A, vy);

  // aim overlay on the floor
  const aim = o.aim;
  if (aim && !o.noAim) {
    ctx.save();
    const paths = [];
    if (aim.hintPts) paths.push({ pts: aim.hintPts, col: 'rgba(255,214,90,0.95)' });
    if (aim.pts) paths.push({ pts: aim.pts, col: aim.gutter ? 'rgba(255,110,90,0.95)' : 'rgba(255,255,255,0.92)' });
    for (const pa of paths) {
      ctx.fillStyle = pa.col;
      pa.pts.forEach((q, i) => { if (i % 1) return; const p = P(q[0], q[1], 0.004); if (p.d < 0.4) return; const r = Math.max(1.4, 0.016 * p.s); ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.7, 0, 0, TAU); ctx.fill(); });
    }
    // target marker where the aim crosses the head pin line
    if (aim.aimX !== undefined) {
      const c = P(aim.aimX, H, 0.003), r = 0.085 * c.s;
      if (c.d > 0.4) {
      ctx.lineWidth = Math.max(1.5, 0.012 * c.s); ctx.strokeStyle = aim.hintPts ? '#ffd65a' : '#ffffff';
      ctx.beginPath(); ctx.ellipse(c.x, c.y, r, r * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c.x - r * 1.5, c.y); ctx.lineTo(c.x + r * 1.5, c.y); ctx.moveTo(c.x, c.y - r * 0.8); ctx.lineTo(c.x, c.y + r * 0.8); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // pins, wood and the ball, far to near
  const items = [];
  for (const p of o.world.pins) {
    if (p.s === 2) { if (p.fade !== undefined && p.fade < 1) items.push({ y: p.y, p, gone: true }); continue; }
    items.push({ y: p.y, p });
  }
  const b = o.ball ?? o.world.ball;
  if (b && !b.gone) items.push({ y: b.y, ball: b });
  items.sort((u, v) => v.y - u.y);
  for (const it of items) {
    if (it.p) {
      const p = it.p;
      if (p.s === 0) {
        const c = P(p.x, p.y, 0);
        if (c.d < 0.4) continue;
        drawPin(ctx, c.x, c.y, c.s, { alpha: o.sweepAlpha?.(p) ?? 1 });
      } else if (p.s === 1) {
        const ca = Math.cos(p.a) * LANE.woodHL, sa = Math.sin(p.a) * LANE.woodHL;
        const A0 = P(p.x - ca, p.y - sa, LANE.woodR), B0 = P(p.x + ca, p.y + sa, LANE.woodR), m = P(p.x, p.y, LANE.woodR);
        if (m.d < 0.4) continue;
        drawLying(ctx, A0.x, A0.y, B0.x, B0.y, m.s, { alpha: o.sweepAlpha?.(p) ?? 1 });
      }
    } else if (it.ball) {
      const bb = it.ball, c = P(bb.x, bb.y, bb.r), g0 = P(bb.x, bb.y, 0);
      if (c.d < 0.4) continue;
      drawBall(ctx, c.x, c.y, bb.r * c.s, { rot: bb.rot, shadowY: g0.y });
    }
  }
  // the ball waiting on the foul line
  if (o.ghost && aim) {
    const c = P(aim.x0, 0.12, LANE.ballR), g0 = P(aim.x0, 0.12, 0);
    if (c.d > 0.4) drawBall(ctx, c.x, c.y, LANE.ballR * c.s * 1.0, { rot: 0.6, shadowY: g0.y });
  }
  // particles
  if (o.parts) {
    for (const q of o.parts) {
      const p = P(q.x, q.y, q.z), a = Math.max(0, 1 - q.t / q.max);
      if (p.d < 0.4) continue;
      ctx.fillStyle = q.kind === 1 ? `rgba(255,236,170,${a})` : `rgba(235,215,175,${a * 0.55})`;
      const r = Math.max(0.8, q.size * p.s * 0.0035);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
  return cam;
}

// For the menu screens: the scene with a slow attract roll, no overlays.
export function worldBackdrop(ctx, L, state, world, parts, o = {}) {
  if (v3.on) return true;
  drawScene(ctx, { x: 0, y: 0, w: L.w, h: L.h }, o.pose ?? L.poses.title, { world, parts, noAim: true, ball: world.ball });
  return true;
}
