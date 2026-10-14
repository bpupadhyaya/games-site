// Drawing the play screen from the session state: the stage (pitch view or field view), the people and the ball, the HUD
// and the controls. Pure drawing; game.js owns state and input and asks `layoutOf` for the same rectangles.
import { W, H, host, TEXT_SCALES, playLayout, cams, proj, clamp, followCam } from './layout.js';
import * as M from './sim.js';
import { drawGround, drawBoard, drawPerson, drawBall, drawPaddle, PAL } from './art.js';
import { FONT, DISPLAY, C, roundPath, paintButton, drawButton, panel, textShadow, wrapLines, ease } from './ui.js';
import { fieldersOf, situation, need, ballsLeft, followNeed } from './play.js';
import { GL } from './glbridge.js';

const TAU = Math.PI * 2;

export const roleOf = (S) => (S.humanBat ? 'bat' : 'bowl');
export function layoutOf(state) {
  const S = state.run;
  const z = Math.min(1.5, TEXT_SCALES[state.settings.textIdx]);
  return playLayout(z, S ? roleOf(S) : 'bat', !!(S && S.auto && !S.attract));
}
let camKey = '', camVal = null;
export function camsFor(L) {
  const k = `${L.key}`;
  if (k !== camKey) { camVal = cams(L.stage, L.land); camKey = k; }
  return camVal;
}
// The title screen's living backdrop: a slow pan from the striker's end to the pavilion and the crowd (L.hero is set by menus.js).
function heroCam(L, t) {
  const u = 0.5 - 0.5 * Math.cos(t * 0.1), land = L.land;
  const wm = land ? 24 + 10 * u : 17 + 12 * u;
  return followCam(L.stage, land, Math.sin(t * 0.045) * 2.2, 8.5 + 28 * u, wm, 0.8);
}
export const activeCam = (S, C2, L, t = 0) => {
  if (L.hero) return heroCam(L, t);
  if (S.cam !== 'field') return C2.pitch;
  const f = S.camF;
  if (!(f && L)) return C2.field;
  return followCam(L.stage, L.land, f.x, f.y, Math.max(f.w, followNeed(S, f, { w: L.stage.w, h: L.stage.h, land: L.land })));
};
// the paddle plane position on screen (for hit-testing drags and placing the ring)
export const pitchProj = (C2, x, y, z = 0) => proj(C2.pitch, x, y, z);

const personH = (cam) => Math.max(cam.s * 1.75 * 1.18, 15);
const ballR = (cam) => Math.max(cam.s * 0.16, 5.5);

// ---- the stage -------------------------------------------------------------------------------------------------------
export function drawStage(ctx, S, L, t, opt = {}) {
  const C2 = camsFor(L), cam = activeCam(S, C2, L, t);
  ctx.save();
  ctx.beginPath(); ctx.rect(L.stage.x, L.stage.y, L.stage.w, L.stage.h); ctx.clip();
  // With the 3D layer on, the green, the boards and the people are drawn behind this canvas; it only asks for them here.
  if (GL.on) { GL.req = { S, cam, rect: L.stage, t, field: S.cam === 'field' && !!S.F }; GL.ball = null; }
  else drawGround(ctx, cam, t);
  if (S.cam === 'field' && S.F) drawFieldScene(ctx, S, cam, t);
  else drawPitchScene(ctx, S, cam, C2, t, opt);
  ctx.restore();
  return cam;
}

function runPhase(f) { return ((f.walk || 0) / 1.5) % 1; }

function drawPitchScene(ctx, S, cam, C2, t, opt) {
  const h = personH(cam), P = S.path;
  const set = fieldersOf(S);
  const items = [];
  // boards and the other batter
  if (!GL.on) items.push({ y: 0, draw: () => drawBoard(ctx, cam, 0, S.boardFall) });
  if (!GL.on) items.push({ y: M.PITCH, draw: () => drawBoard(ctx, cam, M.PITCH, 0) });
  if (!GL.on) {
    const [nx, ny] = proj(cam, 0.5, M.END_Y[1]);
    items.push({ y: M.END_Y[1], draw: () => drawPerson(ctx, nx, ny, personH(cam) * 0.92, { id: 8, team: 'bat', pose: 'ready', paddle: true, paddleAng: 0.1, face: 1 }) });
  }
  // fielders in view
  if (!GL.on) set.forEach((p, i) => {
    if (p.y > 10.6 || p.y < -3.2 || Math.abs(p.x) > 9) return;
    const [sx, sy] = proj(cam, p.x, p.y);
    if (i === 0) return;
    items.push({ y: p.y, draw: () => drawPerson(ctx, sx, sy, h, { id: i + 3, team: 'field', pose: 'ready', face: p.x > 0 ? -1 : 1 }) });
  });
  // the bowler
  if (!GL.on) {
    const b0 = set[0], by = M.BOWL_Y - 0.3, bx = b0.x;
    const [sx, sy] = proj(cam, bx, by);
    let a = 0, pose = 'ready', ph = 0, run = 0;
    if (S.phase === 'ready') { a = clamp(S.windT, 0, 1); pose = S.windT > 0 ? 'bowl' : 'ready'; a = S.windT > 0 ? ease.inOut(clamp(S.windT / 0.9, 0, 1)) * 0.82 : 0; run = 0; }
    else if (S.phase === 'flight') { pose = 'bowl'; a = clamp(0.82 + S.tf * 1.8, 0, 1); }
    else pose = 'ready';
    items.push({ y: by, draw: () => drawPerson(ctx, sx, sy, h, { id: 1, team: 'field', pose, arm: a, ph, run, face: 1, ball: S.phase === 'ready' }) });
  }
  // the striker and the paddle
  if (!GL.on) {
    const px = S.paddleX, bx = px - 0.42, by = M.STRIKE_Y + 0.15;
    const [sx, sy] = proj(cam, bx, by);
    const sw = S.swing && S.swingAnim >= 0 ? S.swingAnim : -1;
    const pose = sw >= 0 ? 'swing' : 'ready';
    const a = sw >= 0 ? ease.outCubic(clamp(sw, 0, 1)) : 0;
    items.push({ y: by, draw: () => drawPerson(ctx, sx, sy, h, { id: 7, team: 'bat', pose, arm: a, face: 1, paddle: true, paddleAng: pose === 'swing' ? 1.7 - a * 3.0 : 0.05 }) });
  }
  items.sort((a, b) => (cam.land ? 0 : b.y - a.y));
  for (const it of items) it.draw();
  // the ball in the delivery
  if (P && (S.phase === 'ready' || S.phase === 'flight' || S.phase === 'settle')) {
    let pos = null;
    if (S.phase === 'ready') {
      const set0 = set[0];
      pos = GL.on && GL.hand && GL.handFor === S ? GL.hand : { x: set0.x + 0.15, y: M.BOWL_Y - 0.3, z: 0.9 + 0.3 * clamp(S.windT, 0, 1) };
    } else {
      let tt = S.phase === 'flight' ? S.tf : P.T;
      if (S.res && S.res.kind === 'blocked') tt = Math.min(tt, S.res.at);
      if (S.res && S.res.kind === 'hit') tt = Math.min(tt, S.res.at);
      if (S.phase === 'settle' && S.outcome && S.outcome.kind !== 'bowled') tt = Math.min(tt, S.res ? S.res.at : P.T);
      if (S.phase === 'settle' && S.outcome && S.outcome.kind === 'bowled') tt = P.T;
      pos = M.ballAt(P, clamp(tt, 0, P.T));
    }
    const g = proj(cam, pos.x, pos.y, 0), a = proj(cam, pos.x, pos.y, pos.z);
    // a flight trail
    if (S.phase === 'flight' && !S.res) {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= 6; k++) { const q = M.ballAt(P, Math.max(0, S.tf - k * 0.025)), pp = proj(cam, q.x, q.y, q.z); if (k === 0) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[0], pp[1]); }
      ctx.stroke();
    }
    if (GL.on) GL.ball = { x: pos.x, y: pos.y, z: pos.z };
    drawBall(ctx, g, a, ballR(cam) * (1 + (M.BOWL_Y - pos.y) * 0.02), t * 9, true, GL.on);
  }
  // the arrival ring: closes on the paddle as the ball arrives
  if (P && S.phase === 'flight' && S.humanBat && !S.auto && !S.res) {
    const left = P.tArr - S.tf, k = clamp(left / 0.6, 0, 1);
    const [rx, ry] = proj(cam, S.paddleX, M.STRIKE_Y, 0.9);
    const base = M.PADDLE_R * cam.s * 1.15, rad = base * (1 + 1.6 * k);
    ctx.save();
    ctx.lineWidth = Math.max(3, cam.s * 0.07);
    ctx.strokeStyle = left < 0.14 && left > -0.02 ? '#7dff9a' : `rgba(255,248,200,${0.35 + 0.5 * (1 - k)})`;
    ctx.beginPath(); ctx.arc(rx, ry, rad, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(rx, ry, base, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  }
  drawFx(ctx, S, cam);
  // the Think hint: where the paddle should sit
  if (S.hint && S.hint.kind === 'bat' && S.humanBat && S.phase !== 'settle') {
    const adv = S.hint.adv, [rx, ry] = proj(cam, adv.paddleX, M.STRIKE_Y, 0.9);
    ctx.save(); ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 4; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(rx, ry, M.PADDLE_R * cam.s * 1.2, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffe36a'; ctx.font = `800 ${Math.max(14, Math.round(cam.s * 0.4))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(adv.kind === 'block' ? 'BLOCK' : adv.kind === 'lift' ? 'LIFT' : 'DRIVE', rx, ry - M.PADDLE_R * cam.s * 1.45 - 6);
    ctx.restore();
  }
  // the board strike flash
  if (S.boardFall > 0 && S.boardFall < 0.5) {
    const [bx, by] = proj(cam, 0, 0, 1.2);
    ctx.save(); ctx.globalAlpha = 1 - S.boardFall * 2; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8, r0 = cam.s * 0.3, r1 = cam.s * (0.5 + S.boardFall * 1.4); ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0); ctx.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1); ctx.stroke(); }
    ctx.restore();
  }
  if (S.thwock > 0.2 && S.res && S.res.kind === 'hit') {
    const [bx, by] = proj(cam, S.res.ball.x, S.res.ball.y, S.res.ball.z);
    ctx.save(); ctx.globalAlpha = (S.thwock - 0.2) / 0.15; ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(bx, by, cam.s * 0.5 * (1.4 - S.thwock), 0, TAU); ctx.fill(); ctx.restore();
  }
  void C2; void opt;
}

function drawFx(ctx, S, cam) {
  for (const p of S.fx) {
    const [sx, sy] = proj(cam, p.x, p.y, p.z), a = 1 - p.t / p.life;
    ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.col;
    const r = Math.max(2, cam.s * 0.07);
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFieldScene(ctx, S, cam, t) {
  const F = S.F, h = personH(cam), items = [];
  if (!GL.on) items.push({ y: 0, draw: () => drawBoard(ctx, cam, 0, S.boardFall) });
  if (!GL.on) items.push({ y: M.PITCH, draw: () => drawBoard(ctx, cam, M.PITCH, 0) });
  const chaser = F.plan ? F.plan.id : -1;
  F.fielders.forEach((f, i) => {
    const [sx, sy] = proj(cam, f.x, f.y);
    const moving = Math.hypot(f.vx, f.vy) > 0.5;
    const holding = F.ball.held === f.id;
    const cheer = F.over && F.outcome && F.outcome.wicket;
    const pose = cheer ? 'cheer' : holding ? 'throw' : f.act === 'hold' ? 'catch' : 'ready';
    items.push({
      y: f.y, draw: () => {
        if (i === chaser && !F.over) { ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(sx, sy, h * 0.3, h * 0.11, 0, 0, TAU); ctx.stroke(); }
        if (!GL.on) drawPerson(ctx, sx, sy, h, { id: i + 3, team: 'field', run: moving ? 1 : 0, ph: runPhase(f), pose: moving && !holding ? 'run' : pose, arm: 0.5, face: f.vx >= 0 ? 1 : -1, ball: holding });
      },
    });
  });
  // the batters
  F.bats.forEach((b, i) => {
    const R = F.run, frac = R.moving || R.frac > 0 ? R.frac : 0;
    const y = M.batY(b, frac), x = i === 0 ? -0.55 : 0.55;
    const [sx, sy] = proj(cam, x, y);
    const run = R.moving ? 1 : 0;
    const cheerB = F.over && F.outcome && !F.outcome.wicket && F.outcome.runs >= 4;
    if (!GL.on) items.push({ y, draw: () => drawPerson(ctx, sx, sy, h, { id: i === 0 ? 7 : 8, team: 'bat', run, ph: (frac * M.RUN_LEN) / 1.45, pose: cheerB ? 'cheer' : run ? 'run' : 'ready', paddle: !cheerB, paddleAng: run ? 0.9 : 0.1, face: 1 }) });
  });
  items.sort((a, b) => (cam.land ? 0 : b.y - a.y));
  for (const it of items) it.draw();
  // where a lofted ball will come down
  if (F.land && !F.over) {
    const [lx, ly] = proj(cam, F.land.x, F.land.y, 0), lr = Math.max(7, cam.s * 0.7);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.ellipse(lx, ly, lr, lr * cam.k, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx - lr * 0.5, ly - lr * 0.3); ctx.lineTo(lx + lr * 0.5, ly + lr * 0.3); ctx.moveTo(lx + lr * 0.5, ly - lr * 0.3); ctx.lineTo(lx - lr * 0.5, ly + lr * 0.3); ctx.stroke();
    ctx.restore();
  }
  drawFx(ctx, S, cam);
  // the ball
  const b = F.ball, g = proj(cam, b.x, b.y, 0), a = proj(cam, b.x, b.y, b.z);
  if (GL.on) GL.ball = { x: b.x, y: b.y, z: b.z };
  drawBall(ctx, g, a, ballR(cam) * 1.15, t * 12, true, GL.on);
  // run progress ticks along the pitch
  if (F.run.moving) {
    const p0 = proj(cam, 0, M.END_Y[0]), p1 = proj(cam, 0, M.END_Y[1]);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([5, 7]); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p0[0] + 0.0, p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.restore();
  }
}

// ---- HUD -------------------------------------------------------------------------------------------------------------------
function chip(ctx, x, y, w, h, label, o = {}) {
  roundPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = o.fill || 'rgba(14,34,18,0.78)'; ctx.fill();
  if (o.stroke) { ctx.lineWidth = 2; ctx.strokeStyle = o.stroke; ctx.stroke(); }
  ctx.fillStyle = o.col || '#fff8e4'; ctx.font = `700 ${o.size || 18}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

export function drawScore(ctx, S, L, state) {
  const r = L.score, I = S.innings[S.inn], fs = L.fs;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(16,40,24,0.92)', stroke: 'rgba(255,230,160,0.55)' });
  const cx = r.x + 16;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const big = Math.min(fs.big, r.h * 0.44);
  ctx.fillStyle = '#fff8e4'; ctx.font = `800 ${big}px ${DISPLAY}`;
  const t1 = `${I.runs}/${I.wkts}`;
  ctx.fillText(t1, cx, r.y + r.h * 0.42 + big * 0.3);
  const tw = ctx.measureText(t1).width;
  const sx = cx + tw + 14, mw = r.x + r.w - 12 - sx;
  const lines = [];
  const kn = !S.twoInnings;
  lines.push(`Over ${M.oversText(I.balls)} of ${kn ? '2' : M.OVERS}`);
  if (S.phase === 'break') lines.push('Innings complete');
  else if (S.target != null) { const n = need(S); lines.push(n > 0 ? `Need ${n} from ${ballsLeft(S)}` : 'Target passed'); }
  else if (kn) lines.push(`Beat ${state.par ?? 0}`);
  else lines.push(S.humanBat ? 'You bat first' : 'You bowl');
  lines.forEach((l, i) => {
    let size = fs.small;
    ctx.font = `700 ${size}px ${FONT}`;
    while (ctx.measureText(l).width > mw && size > 11) { size -= 1; ctx.font = `700 ${size}px ${FONT}`; }
    ctx.fillStyle = i === 0 ? '#fff0b8' : '#cfe8c8';
    ctx.fillText(l, sx, r.y + r.h * 0.3 + i * (fs.small * 1.3) + fs.small * 0.35);
  });
  // this over's balls, as little discs along the bottom of the panel
  const over = S.log.filter((b) => b.inn === S.inn);
  const cur = over.slice(Math.floor((S.phase === 'settle' || S.phase === 'done' ? Math.max(0, over.length - 1) : over.length) / M.BALLS_PER_OVER) * M.BALLS_PER_OVER);
  const dr = Math.max(8, Math.min(fs.small * 0.58, (r.w - 40) / (M.BALLS_PER_OVER * 2.6))), dy = r.y + r.h - dr - 8;
  for (let i = 0; i < M.BALLS_PER_OVER; i++) {
    const b = cur[i], x = cx + dr + i * (dr * 2 + 6);
    ctx.beginPath(); ctx.arc(x, dy, dr, 0, TAU);
    ctx.fillStyle = !b ? 'rgba(255,255,255,0.14)' : b.w ? '#d94a3a' : b.runs >= 4 ? '#e8b43c' : b.runs > 0 ? '#46a860' : 'rgba(255,255,255,0.4)';
    ctx.fill();
    if (b) { ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(dr * 1.1)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.w ? 'W' : String(b.runs), x, dy + 1); }
  }
  ctx.textBaseline = 'alphabetic';
}

// the small field radar: the rope circle with the fielders, so the gaps can be read from the pitch view
export function drawRadar(ctx, S, rect) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, r = Math.min(rect.w, rect.h) / 2 - 3;
  ctx.save();
  // a brass-rimmed dial on a walnut disc
  ctx.fillStyle = 'rgba(8,16,6,0.4)'; ctx.beginPath(); ctx.arc(cx, cy + 3, r + 4, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3f2716'; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, TAU); ctx.fill();
  { const bg = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r); bg.addColorStop(0, '#fbe9a4'); bg.addColorStop(0.5, '#c79a32'); bg.addColorStop(1, '#8a6218'); ctx.strokeStyle = bg; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, TAU); ctx.stroke(); }
  { const gg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r); gg.addColorStop(0, '#6fb455'); gg.addColorStop(1, '#3f8a2e'); ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#fbf6e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
  const k = r / M.FIELD_R, X = (x, y) => [cx + x * k, cy - (y - M.FIELD_C.y) * k];
  ctx.strokeStyle = '#d9d58a'; ctx.lineWidth = Math.max(2, r * 0.07);
  const a = X(0, 0), b = X(0, M.PITCH); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  const set = fieldersOf(S);
  set.forEach((f, i) => { const p = X(f.x, f.y); ctx.fillStyle = i === 0 ? '#9ad0ff' : '#2b5d9a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p[0], p[1], Math.max(3, r * 0.075), 0, TAU); ctx.fill(); ctx.stroke(); });
  if (S.hint && S.hint.kind === 'bat') {
    const an = S.hint.adv.ang * Math.PI / 180, p0 = X(0, M.STRIKE_Y), p1 = X(Math.sin(an) * M.FIELD_R, M.STRIKE_Y + Math.cos(an) * M.FIELD_R);
    ctx.strokeStyle = '#ffe36a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
  }
  ctx.restore();
}

// ---- controls ----------------------------------------------------------------------------------------------------------------
const SHOT_HELP = { block: 'safe: stops it dead', drive: 'along the ground', lift: 'in the air' };
export function drawBatControls(ctx, S, L, state) {
  const fs = L.fs, flight = S.phase === 'flight' && !S.swing && !S.res, ready = S.phase === 'ready';
  const field = S.phase === 'field' && S.F;
  if (field) {
    // the margin gauge and the RUN button
    const F = S.F, g = L.gauge, R = F.run;
    const m = M.runMargin(F), k = clamp(0.5 + m / 3, 0, 1);
    const gh = Math.max(20, Math.min(g.h * 0.7, 34)), gy = g.y + g.h / 2;
    roundPath(ctx, g.x, gy - gh / 2, g.w, gh, gh / 2); ctx.fillStyle = 'rgba(10,28,14,0.8)'; ctx.fill();
    const gr = ctx.createLinearGradient(g.x, 0, g.x + g.w, 0);
    gr.addColorStop(0, '#d94a3a'); gr.addColorStop(0.45, '#e8b43c'); gr.addColorStop(1, '#46a860');
    roundPath(ctx, g.x + 3, gy - gh / 2 + 3, g.w - 6, gh - 6, (gh - 6) / 2); ctx.fillStyle = gr; ctx.fill();
    const rr = gh * 0.5, mx = g.x + 3 + rr + k * (g.w - 6 - 2 * rr);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#16301f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, gy, rr, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#16301f'; ctx.font = `800 ${Math.max(11, Math.round(gh * 0.5))}px ${FONT}`; ctx.textAlign = k > 0.5 ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(k < 0.3 ? 'RISKY' : k < 0.58 ? 'TIGHT' : 'SAFE', k > 0.5 ? g.x + 14 : g.x + g.w - 14, gy + 1);
    const label = R.moving ? 'TURN BACK' : F.over ? 'RUN' : 'RUN';
    const sub = R.moving ? 'tap to return' : `${R.done} run${R.done === 1 ? '' : 's'} so far`;
    drawButton(ctx, L.run, label, { primary: !R.moving, active: R.moving, size: Math.round(fs.btn * 1.25), sub });
    return;
  }
  const g = L.gauge;
  ctx.fillStyle = '#fff8e4'; ctx.font = `700 ${Math.max(14, Math.round(fs.lab * 0.95))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const msg = ready ? 'Slide the paddle to the ball\'s line' : flight ? 'Tap a shot as the ring closes' : S.res && S.res.kind === 'hit' ? '' : '';
  textShadow(ctx, msg, g.x + g.w / 2, g.y + g.h / 2, '#fff8e4', 5);
  const kinds = ['block', 'drive', 'lift'];
  L.swing.forEach((r, i) => {
    const k = kinds[i], used = !!(S.swing && S.swing.type === k);
    const off = !(flight || ready) || !!S.swing;
    drawButton(ctx, r, k.toUpperCase(), { primary: k === 'drive' && !off, active: used, disabled: off && !used, size: Math.round(fs.btn * 0.95), sub: SHOT_HELP[k] });
  });
  void state;
}

export function drawPad(ctx, S, L, sel) {
  const r = L.pad;
  panel(ctx, r.x, r.y, r.w, r.h, { r: 18, fill: 'rgba(250,244,226,0.95)', stroke: 'rgba(60,55,30,0.6)' });
  // the board face: x in [-1, 1], h in [0, 1.8]
  const padX = (x) => r.x + r.w * (0.5 + (x / 2.0) * 0.9), padY = (h) => r.y + r.h - 16 - (h / 1.8) * (r.h - 34);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4); ctx.clip();
  ctx.fillStyle = 'rgba(80,150,60,0.25)'; ctx.fillRect(r.x, padY(0.0), r.w, r.y + r.h - padY(0.0));
  // the paddle's reach and the board
  ctx.fillStyle = 'rgba(232,180,60,0.35)'; ctx.fillRect(padX(-0.2), padY(1.42), padX(0.2) - padX(-0.2), padY(0.0) - padY(1.42));
  ctx.strokeStyle = PAL.boardEdge; ctx.lineWidth = 2; ctx.strokeRect(padX(-0.2), padY(1.42), padX(0.2) - padX(-0.2), padY(0.0) - padY(1.42));
  ctx.setLineDash([4, 6]); ctx.strokeStyle = 'rgba(40,50,30,0.45)'; ctx.lineWidth = 1.5;
  for (const gx of [-0.6, 0.6]) { ctx.beginPath(); ctx.moveTo(padX(gx), padY(0)); ctx.lineTo(padX(gx), padY(1.8)); ctx.stroke(); }
  for (const gy of [0.5, 1.0, 1.5]) { ctx.beginPath(); ctx.moveTo(r.x, padY(gy)); ctx.lineTo(r.x + r.w, padY(gy)); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.restore();
  // the aim marker
  const mx = padX(sel.aimX), my = padY(sel.aimH);
  ctx.strokeStyle = '#a8331f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, my, 15, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#a8331f'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.fill();
  if (S.hint && S.hint.kind === 'bowl') {
    const a = S.hint.adv, hx = padX(a.aimX), hy = padY(a.aimH);
    ctx.strokeStyle = '#d4a00a'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(hx, hy, 19, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(40,50,30,0.7)'; ctx.font = `700 ${Math.max(11, Math.round(L.fs.small * 0.72))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('BOARD', padX(0), padY(1.42) - 4);
  // the board's "height" labels
  ctx.textAlign = 'left'; ctx.fillText('high', r.x + 8, padY(1.65)); ctx.fillText('low', r.x + 8, padY(0.2));
}
export const padToAim = (L, x, y) => {
  const r = L.pad;
  const aimX = clamp(((x - r.x) / r.w - 0.5) / 0.9 * 2.0, -0.95, 0.95);
  const aimH = clamp((r.y + r.h - 16 - y) / (r.h - 34) * 1.8, 0.2, 1.75);
  return { aimX: Math.round(aimX * 20) / 20, aimH: Math.round(aimH * 20) / 20 };
};

export function drawBowlControls(ctx, S, L) {
  const fs = L.fs, sel = S.bowlSel, ready = S.phase === 'ready' && !S.bowlGo && !S.auto;
  drawPad(ctx, S, L, sel);
  const chipOpts = (on, dis) => ({ primary: on, disabled: dis, size: Math.round(fs.lab * 0.95) });
  const dis = !ready;
  ['Slow', 'Medium', 'Quick'].forEach((n, i) => drawButton(ctx, L.pace[i], n, chipOpts(sel.pace === i, dis)));
  ['Full', 'Bounce'].forEach((n, i) => drawButton(ctx, L.flight[i], n, chipOpts((sel.bounce ? 1 : 0) === i, dis)));
  ['Bow left', 'Straight', 'Bow right'].forEach((n, i) => drawButton(ctx, L.swingChips[i], n, chipOpts(sel.swing === i, dis)));
  const fieldDis = !(S.phase === 'ready' && !S.bowlGo) || S.auto;
  M.FIELD_SETS.forEach((f, i) => drawButton(ctx, L.fieldChips[i], f.name, { active: S.setId === f.id, disabled: fieldDis && S.setId !== f.id, size: Math.round(fs.lab * 0.95) }));
  drawButton(ctx, L.bowl, 'BOWL', { primary: ready, disabled: !ready, size: Math.round(fs.btn * 1.2), sub: ready ? undefined : 'Watch the ball' });
}

export function drawDemoRow(ctx, S, L, state) {
  const D = L.demo, st = state.settings;
  // what the game is thinking, in words, above the buttons
  if (S.dec) {
    const P = L.panel, top = P.y, bot = D.pause.y - 10, adv = S.dec.adv;
    const txt = S.dec.phase === 'think' ? 'Reading the ball, the field and the score...' : (adv && adv.why) || '';
    if (bot - top > 36 && txt) {
      ctx.fillStyle = '#fff8e4'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      let fz = Math.round(L.fs.mid * 1.0);
      ctx.font = `600 ${fz}px ${FONT}`;
      let lines = wrapLines(ctx, txt, P.w - 12);
      while (lines.length * fz * 1.25 > bot - top && fz > 12) { fz -= 1; ctx.font = `600 ${fz}px ${FONT}`; lines = wrapLines(ctx, txt, P.w - 12); }
      const y0 = top + Math.max(0, (bot - top - lines.length * fz * 1.25) / 2);
      lines.forEach((l, i) => textShadow(ctx, l, P.x + P.w / 2, y0 + i * fz * 1.25 + fz * 0.8, '#fff8e4', 5));
    }
  }
  drawButton(ctx, D.dec, '−', { size: Math.round(L.fs.btn * 1.1), disabled: st.thinkIdx === 0 });
  drawButton(ctx, D.pause, state.paused ? 'Resume' : 'Pause', { primary: true, size: Math.round(L.fs.btn * 0.9) });
  drawButton(ctx, D.inc, '+', { size: Math.round(L.fs.btn * 1.1), disabled: st.thinkIdx === 3 });
  drawButton(ctx, D.exit, 'Exit', { dark: true, size: Math.round(L.fs.btn * 0.9) });
}

export function drawSkip(ctx, S, L, state) {
  drawButton(ctx, L.skip, state.fast ? 'Normal speed' : 'Skip ahead', { dark: true, size: Math.round(L.fs.btn * 0.9) });
}

// the auto-play status strip on the stage: THINK -> REVEAL -> ACT
export function drawDecision(ctx, S, L, state) {
  if (!S.auto || S.attract || !S.dec) return;
  const D = S.dec, st = L.stage;
  const name = D.phase === 'think' ? 'Thinking' : D.phase === 'reveal' ? 'Chosen' : 'Go';
  const left = Math.max(0, D.dur - D.t);
  const w = Math.min(st.w - 24, 440), h = Math.max(46, L.fs.mid * 1.9), x = st.x + (st.w - w) / 2, y = st.y + st.h - h - 10;
  roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,40,24,0.88)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffe9a0'; ctx.font = `800 ${L.fs.mid}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(`${name}${D.phase === 'think' ? ` ${Math.ceil(left)}` : ''}`, x + 16, y + h / 2);
  const adv = D.adv;
  if (D.phase !== 'think' && adv) {
    ctx.fillStyle = '#fff8e4'; ctx.font = `600 ${Math.max(12, Math.round(L.fs.small))}px ${FONT}`; ctx.textAlign = 'right';
    const txt = S.humanBat ? (adv.kind === 'block' ? 'Block it' : adv.kind === 'lift' ? 'Lift it' : 'Drive it') : adv.why.split(',')[0];
    ctx.fillText(txt, x + w - 14, y + h / 2);
  }
  void state;
}

// big banner over the stage after each ball
export function drawBanner(ctx, S, L) {
  const b = S.banner; if (!b || S.phase !== 'settle') return;
  const st = L.stage, k = ease.outBack(clamp(b.t / 0.28, 0, 1)), a = clamp(1 - (b.t - b.max + 0.3) / 0.3, 0, 1);
  const size = Math.round(Math.min(st.w * 0.17, 120) * (0.7 + 0.3 * k));
  ctx.save(); ctx.globalAlpha = a;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `italic 800 ${size}px ${DISPLAY}`;
  const cx = st.x + st.w / 2, cy = st.y + st.h * 0.4;
  ctx.lineWidth = Math.max(8, size * 0.14); ctx.strokeStyle = 'rgba(14,30,14,0.85)'; ctx.lineJoin = 'round';
  ctx.strokeText(b.text, cx, cy);
  ctx.fillStyle = b.col; ctx.fillText(b.text, cx, cy);
  if (b.sub) { ctx.font = `700 ${Math.round(size * 0.26)}px ${FONT}`; textShadow(ctx, b.sub, cx, cy + size * 0.62, '#fff8e4', 6); }
  ctx.restore();
}

// fill the whole canvas with the current fillStyle, except the stage rectangle `r` (the 3D layer shows through there)
export function fillOutside(ctx, r) {
  if (!r) { ctx.fillRect(0, 0, W, H); return; }
  const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(W, r.x + r.w), y1 = Math.min(H, r.y + r.h);
  ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
  if (y0 > 0) ctx.fillRect(0, 0, W, y0);
  if (y1 < H) ctx.fillRect(0, y1, W, H - y1);
  if (x0 > 0) ctx.fillRect(0, y0, x0, y1 - y0);
  if (x1 < W) ctx.fillRect(x1, y0, W - x1, y1 - y0);
}

// the whole play screen
export function renderPlay(ctx, state) {
  const S = state.run, L = layoutOf(state), t = state.t;
  { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b4220'); g.addColorStop(1, '#10281a'); ctx.fillStyle = g; fillOutside(ctx, GL.on ? L.stage : null); }
  const cam = drawStage(ctx, S, L, t);
  void cam;
  if (GL.on) {     // a soft lens vignette over the lit scene
    const st = L.stage, cx0 = st.x + st.w / 2, cy0 = st.y + st.h / 2, rr0 = Math.hypot(st.w, st.h) / 2;
    const vg = ctx.createRadialGradient(cx0, cy0, rr0 * 0.55, cx0, cy0, rr0); vg.addColorStop(0, 'rgba(6,20,8,0)'); vg.addColorStop(1, 'rgba(6,20,8,0.34)');
    ctx.save(); ctx.beginPath(); ctx.rect(st.x, st.y, st.w, st.h); ctx.clip(); ctx.fillStyle = vg; ctx.fillRect(st.x, st.y, st.w, st.h); ctx.restore();
  }
  // radar and hint line on the pitch view
  if (S.cam === 'pitch') {
    const rd = Math.max(70, Math.min(L.stage.w, L.stage.h) * 0.2);
    drawRadar(ctx, S, { x: L.stage.x + 10, y: L.stage.y + 10 + (L.land && L.backClear ? 0 : 0), w: rd, h: rd });
  }
  // top strip
  const auto = S.auto && !S.attract;
  drawButton(ctx, L.pause, auto ? (state.paused ? '▶' : '❚❚') : '❚❚', { dark: true, size: Math.round(L.fs.btn * 1.05) });
  drawButton(ctx, L.think, 'Think', { disabled: auto, active: !!S.hint && !auto, size: Math.round(L.fs.btn * 0.78) });
  drawScore(ctx, S, L, state);
  // controls
  if (auto) drawDemoRow(ctx, S, L, state);
  else if (S.humanBat) drawBatControls(ctx, S, L, state);
  else if (S.phase === 'field' || S.phase === 'flight' || S.phase === 'settle') {
    // while the ball is in play the panel keeps the pad visible but dimmed, plus a fast-forward
    drawBowlControls(ctx, S, L);
    if (S.phase === 'field') drawSkip(ctx, S, L, state);
  } else drawBowlControls(ctx, S, L);
  drawDecision(ctx, S, L, state);
  drawBanner(ctx, S, L);
  // innings-break card
  if (S.phase === 'break') drawBreak(ctx, S, L);
  // the toast
  if (state.toastT > 0 && state.toast) {
    const w = Math.min(L.stage.w - 30, 560), h = Math.max(48, L.fs.toast * 2.4), x = L.stage.x + (L.stage.w - w) / 2, y = L.stage.y + L.stage.h * 0.1;
    ctx.save(); ctx.globalAlpha = clamp(state.toastT / 0.4, 0, 1);
    roundPath(ctx, x, y, w, h, 16); ctx.fillStyle = 'rgba(16,40,24,0.92)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff8e4'; ctx.font = `700 ${L.fs.toast}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = wrapLines(ctx, state.toast, w - 28);
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x + w / 2, y + h / 2 + (i - (Math.min(lines.length, 2) - 1) / 2) * L.fs.toast * 1.2));
    ctx.restore();
  }
}

function drawBreak(ctx, S, L) {
  const st = L.stage, a = S.innings[0];
  const w = Math.min(st.w - 30, 520), h = Math.min(st.h - 30, 300), x = st.x + (st.w - w) / 2, y = st.y + (st.h - h) / 2;
  panel(ctx, x, y, w, h, { r: 26, fill: 'rgba(250,244,226,0.97)', stroke: 'rgba(60,55,30,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.deep;
  ctx.font = `800 ${Math.round(L.fs.mid * 1.5)}px ${DISPLAY}`; ctx.fillText('End of your innings', x + w / 2, y + h * 0.2);
  ctx.font = `800 ${Math.round(L.fs.big * 1.2)}px ${DISPLAY}`; ctx.fillStyle = C.terra; ctx.fillText(`${a.runs}/${a.wkts}`, x + w / 2, y + h * 0.46);
  ctx.font = `600 ${L.fs.mid}px ${FONT}`; ctx.fillStyle = C.ink;
  ctx.fillText(`Now bowl: they need ${a.runs + 1} to win`, x + w / 2, y + h * 0.7);
  ctx.font = `700 ${Math.round(L.fs.small * 1.1)}px ${FONT}`; ctx.fillStyle = 'rgba(40,60,40,0.8)';
  ctx.fillText(S.auto ? 'Starting in a moment' : 'Tap anywhere to continue', x + w / 2, y + h * 0.88);
}
