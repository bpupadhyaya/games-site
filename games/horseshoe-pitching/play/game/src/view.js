// Drawing the play screen: the lane (a chase camera in a small pinhole 3D scene), the pit board (top-down, drag to aim), the arm
// gauge, the score cards and the controls. Pure drawing from state; game.js owns state.
import { PIT, LANE, R_STAKE, SIX, CL, HALF_T, TIP, FLIPS, SWING, armAngle, windowDeg, shoeOutline, flightPos, FLIGHT_T, TARGET_LIMITS } from './sim.js';
import { FONT, DISPLAY, C, roundPath, drawButton, panel, wrapLines, textShadow } from './ui.js';
export { glWindow, woodBackdrop } from './ui.js';

const TAU = Math.PI * 2;
export const TEAM = [
  { name: 'Blue', main: '#2f80d6', dark: '#16407a', light: '#8cc4ff' },
  { name: 'Red', main: '#df3d33', dark: '#7d1a14', light: '#ff9f8f' },
];
const STEEL = '#c3ccd4';
const hash = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---- the pinhole camera ----------------------------------------------------------------------------------------------------
export const CAM_REST = { x: 0.36, y: 1.45, z: -1.85, lx: 0, ly: 0.25, lz: LANE, fov: 14 };
export const CAM_CLOSE = { x: 0.1, y: 0.7, z: LANE - 1.55, lx: 0, ly: 0.02, lz: LANE + 0.02, fov: 40 };

export function makeProj(rect, cam, fovDeg = 40) {
  let fx = cam.lx - cam.x, fy = cam.ly - cam.y, fz = cam.lz - cam.z;
  const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
  let rx = fz, rz = -fx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h * 0.52;
  const focal = (rect.w * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
  const P = (x, y, z) => {
    const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
    const zc = dx * fx + dy * fy + dz * fz;
    if (zc < 0.12) return null;
    return { x: cx + (focal * (dx * rx + dz * rz)) / zc, y: cy - (focal * (dx * ux + dy * uy + dz * uz)) / zc, s: focal / zc, zc };
  };
  P.focal = focal; P.cx = cx; P.cy = cy;
  P.horizon = (() => { const h = P(cam.x + fx * 400, 0, cam.z + fz * 400); return h ? h.y : rect.y + rect.h * 0.4; })();
  return P;
}

function poly(ctx, pts, fill, stroke, lw = 1) {
  if (pts.some((p) => !p)) return false;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  return true;
}

// ---- the lane --------------------------------------------------------------------------------------------------------------
function drawSky(ctx, rect, hz, t) {
  const g = ctx.createLinearGradient(0, rect.y, 0, hz);
  g.addColorStop(0, '#4c9be0'); g.addColorStop(0.62, '#a9d8f5'); g.addColorStop(1, '#fcebc2');
  ctx.fillStyle = g; ctx.fillRect(rect.x, rect.y, rect.w, Math.max(0, hz - rect.y + 2));
  // sun glow
  const sx = rect.x + rect.w * 0.78, sy = Math.max(rect.y + 10, hz - rect.h * 0.22);
  const rg = ctx.createRadialGradient(sx, sy, 2, sx, sy, rect.w * 0.28);
  rg.addColorStop(0, 'rgba(255,248,214,0.95)'); rg.addColorStop(0.18, 'rgba(255,236,170,0.55)'); rg.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = rg; ctx.fillRect(rect.x, rect.y, rect.w, Math.max(0, hz - rect.y + 2));
  // a few soft clouds that drift slowly
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 4; i++) {
    const cx = rect.x + ((hash(i + 3) * rect.w * 1.4 + t * (3 + i)) % (rect.w * 1.4)) - rect.w * 0.2, cy = rect.y + (hz - rect.y) * (0.14 + 0.18 * hash(i + 9));
    const sz = rect.w * (0.05 + 0.04 * hash(i + 1));
    ctx.beginPath(); ctx.ellipse(cx, cy, sz * 1.8, sz * 0.5, 0, 0, TAU); ctx.ellipse(cx - sz * 0.8, cy + 2, sz, sz * 0.4, 0, 0, TAU); ctx.ellipse(cx + sz, cy + 3, sz * 1.1, sz * 0.36, 0, 0, TAU); ctx.fill();
  }
}

function pitBox(ctx, P, zc, o = {}) {
  const f = PIT.front - 0.07, b = PIT.back + 0.07, w = PIT.halfW + 0.07;
  poly(ctx, [P(-w, 0, zc + f), P(w, 0, zc + f), P(w, 0, zc + b), P(-w, 0, zc + b)], '#6b4423', '#3e2713', 1.2);
  const g = [P(-PIT.halfW, 0, zc + PIT.front), P(PIT.halfW, 0, zc + PIT.front), P(PIT.halfW, 0, zc + PIT.back), P(-PIT.halfW, 0, zc + PIT.back)];
  poly(ctx, g, o.clay ?? '#b2693b', null);
  // backboard
  poly(ctx, [P(-w, 0, zc + b), P(w, 0, zc + b), P(w, 0.34, zc + b), P(-w, 0.34, zc + b)], '#8a5a2e', '#3e2713', 1);
  poly(ctx, [P(-w, 0.34, zc + b), P(w, 0.34, zc + b), P(w, 0.36, zc + b + 0.04), P(-w, 0.36, zc + b + 0.04)], '#a8743c', null);
}

function shoeOn(ctx, P, sh, team, zc, y = 0) {
  const pts = shoeOutline(sh).map(([x, v]) => P(x, y + 0.028, zc + v));
  if (pts.some((p) => !p)) return;
  const base = shoeOutline(sh).map(([x, v]) => P(x, y, zc + v));
  poly(ctx, base, 'rgba(0,0,0,0.38)', null);
  poly(ctx, pts, TEAM[team].main, TEAM[team].dark, 1.2);
  // steel edge highlight on the top face
  const s = pts[0].s;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(0.6, s * 0.006);
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
}

function stakeOn(ctx, P, zc, glow) {
  const b = P(0, 0, zc), t = P(0, 0.37, zc);
  if (!b || !t) return;
  if (glow > 0) { const g = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, b.s * 0.35); g.addColorStop(0, `rgba(255,236,150,${0.7 * glow})`); g.addColorStop(1, 'rgba(255,236,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.s * 0.35, 0, TAU); ctx.fill(); }
  const wd = Math.max(1.6, b.s * 0.026);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#4b5663'; ctx.lineWidth = wd + 1.2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
  ctx.strokeStyle = '#dfe6ec'; ctx.lineWidth = wd * 0.7; ctx.beginPath(); ctx.moveTo(b.x - 0.4, b.y); ctx.lineTo(t.x - 0.4, t.y); ctx.stroke();
  ctx.fillStyle = '#f2f6f9'; ctx.beginPath(); ctx.ellipse(t.x, t.y, wd * 0.62, wd * 0.34, 0, 0, TAU); ctx.fill();
}

const AIR = 1.7;   // the shoe in the air is drawn this much larger so it reads on a small lane view
function flyingShoe(ctx, P, fl) {
  const { pos, phi, roll, team } = fl;
  // a short fading trail along the arc, so the throw can be followed (the shoe itself is drawn a little oversize in the air)
  if (fl.land && fl.k > 0) {
    for (let j = 7; j >= 1; j--) {
      const q = flightPos(fl.land, Math.max(0, fl.k - j * 0.035)), p = P(q.x, q.y, q.z);
      if (p) { ctx.fillStyle = `rgba(255,255,255,${0.5 * (1 - j / 8)})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.2, p.s * 0.05 * (1 - j / 9)), 0, TAU); ctx.fill(); }
    }
  }
  const pts = [];
  const ro = CL + HALF_T, ri = CL - HALF_T, loc = [];
  loc.push([-ro, TIP]);
  for (let i = 0; i <= 12; i++) { const a = Math.PI + (Math.PI * i) / 12; loc.push([ro * Math.cos(a), ro * Math.sin(a)]); }
  loc.push([ro, TIP], [ri, TIP]);
  for (let i = 12; i >= 0; i--) { const a = Math.PI + (Math.PI * i) / 12; loc.push([ri * Math.cos(a), ri * Math.sin(a)]); }
  loc.push([-ri, TIP]);
  const cp = Math.cos(phi), sp = Math.sin(phi), cr = Math.cos(roll), sr = Math.sin(roll);
  for (const [lat, al] of loc) {
    const along = al * cp, up = al * sp;
    const x = pos.x + (lat * cr) * AIR, y = pos.y + (up * cr + lat * sr * 0.4) * AIR, z = pos.z + along * AIR;
    pts.push(P(x, y, z));
  }
  // ground shadow
  const sh = P(pos.x, 0, pos.z);
  if (sh) { ctx.fillStyle = `rgba(0,0,0,${0.28 / (1 + pos.y)})`; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, sh.s * 0.11, sh.s * 0.035, 0, 0, TAU); ctx.fill(); }
  if (pts.some((p) => !p)) return;
  poly(ctx, pts, TEAM[team].main, TEAM[team].dark, 1.4);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
}

// st: { cam, shoes:[{x,v,ang,side,dead,ringer}], fly, parts, t, pitClay, target }
export function drawLane(ctx, rect, st) {
  ctx.save();
  roundPath(ctx, rect.x, rect.y, rect.w, rect.h, 22); ctx.clip();
  const P = makeProj(rect, st.cam, st.cam.fov || 30);
  const hz = clampN(P.horizon, rect.y + 10, rect.y + rect.h - 10);
  drawSky(ctx, rect, hz, st.t);
  // tree line
  for (let i = 0; i < 26; i++) {
    const tx = rect.x + (i / 25) * (rect.w + 60) - 30, hh = rect.h * (0.05 + 0.05 * hash(i + 40));
    ctx.fillStyle = i % 2 ? '#2f6b3a' : '#3b7d3e';
    ctx.beginPath(); ctx.ellipse(tx, hz - hh * 0.2, rect.w * 0.045, hh, 0, 0, TAU); ctx.fill();
  }
  // lawn
  const lg = ctx.createLinearGradient(0, hz, 0, rect.y + rect.h);
  lg.addColorStop(0, '#6fb04a'); lg.addColorStop(0.3, '#4e9a3a'); lg.addColorStop(1, '#2f7a2e');
  ctx.fillStyle = lg; ctx.fillRect(rect.x, hz - 1, rect.w, rect.y + rect.h - hz + 2);
  // mowing stripes
  const z0 = Math.floor((st.cam.z + 0.6) / 1.6) * 1.6;
  for (let z = z0, i = 0; z < st.cam.z + 70; z += 1.6, i++) {
    if (i % 2) continue;
    poly(ctx, [P(-14, 0, z), P(14, 0, z), P(14, 0, z + 1.6), P(-14, 0, z + 1.6)], 'rgba(255,255,255,0.055)', null);
  }
  // picket fence behind the far pit and two side rails
  const zf = LANE + 5.5;
  const fl = P(-9, 0, zf), fr = P(9, 0, zf), tl = P(-9, 1.1, zf), tr = P(9, 1.1, zf);
  if (fl && fr && tl && tr) {
    poly(ctx, [fl, fr, tr, tl], '#f4efe2', '#bdb59f', 1);
    ctx.strokeStyle = 'rgba(120,110,90,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) { const x = -9 + (18 * k) / 60, a = P(x, 0, zf), b = P(x, 1.1, zf); if (a && b) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,110,90,0.7)';
    for (const hy of [0.3, 0.8]) { const a = P(-9, hy, zf), b = P(9, hy, zf); if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
  }
  // pits and what lies in them
  const clay = st.pitClay;
  pitBox(ctx, P, 0, { clay });
  pitBox(ctx, P, LANE, { clay });
  stakeOn(ctx, P, 0, 0);
  const items = [];
  for (const s of st.shoes) items.push({ z: LANE + s.v, s });
  items.sort((a, b) => b.z - a.z);
  const ringer = st.shoes.some((s) => s.ringer && !s.dead);
  stakeOn(ctx, P, LANE, ringer ? 0.5 + 0.3 * Math.sin(st.t * 4) : 0);
  for (const it of items) shoeOn(ctx, P, it.s, it.s.side, LANE);
  if (st.fly) flyingShoe(ctx, P, st.fly);
  // particles
  for (const q of st.parts || []) {
    const p = P(q.x, q.y, q.z);
    if (!p) continue;
    const a = 1 - q.t / q.max;
    if (q.kind === 1) { ctx.fillStyle = `rgba(255,240,170,${a})`; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
    else { ctx.fillStyle = `rgba(190,140,92,${0.55 * a})`; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.5, p.s * 0.018 * (q.size || 1) * (1 + 1.5 * q.t)), 0, TAU); ctx.fill(); }
  }
  // soft vignette
  const vg = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  vg.addColorStop(0, 'rgba(0,0,0,0.18)'); vg.addColorStop(0.2, 'rgba(0,0,0,0)'); vg.addColorStop(0.85, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = vg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  ctx.save(); roundPath(ctx, rect.x, rect.y, rect.w, rect.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.restore();
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- the pit board ---------------------------------------------------------------------------------------------------------
const WIN = { x: 0.5, v0: -0.66, v1: 0.66 };
export function boardView(rect) {
  const sc = Math.min((rect.w - 14) / (WIN.x * 2), (rect.h - 14) / (WIN.v1 - WIN.v0));
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2, vm = (WIN.v0 + WIN.v1) / 2;
  return { sc, sx: (x) => cx + x * sc, sy: (v) => cy - (v - vm) * sc, inv: (px, py) => ({ x: (px - cx) / sc, v: vm - (py - cy) / sc }) };
}
const shoePath = (ctx, V, sh) => {
  const pts = shoeOutline(sh);
  ctx.beginPath();
  pts.forEach(([x, v], i) => (i ? ctx.lineTo(V.sx(x), V.sy(v)) : ctx.moveTo(V.sx(x), V.sy(v))));
  ctx.closePath();
};

// st: { shoes, target:{tx,tv,flip,team}|null, t, pit, boardShoe }
export function drawBoard(ctx, rect, st) {
  const V = boardView(rect);
  ctx.save();
  roundPath(ctx, rect.x, rect.y, rect.w, rect.h, 22); ctx.clip();
  // lawn around
  ctx.fillStyle = '#3f8c33'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)'; ctx.fillRect(rect.x, rect.y + (i * rect.h) / 12, rect.w, rect.h / 12); }
  // frame and clay
  const fx0 = V.sx(-PIT.halfW - 0.07), fx1 = V.sx(PIT.halfW + 0.07), fy0 = V.sy(PIT.back + 0.07), fy1 = V.sy(PIT.front - 0.07);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(fx0 + 4, fy0 + 5, fx1 - fx0, fy1 - fy0);
  ctx.fillStyle = '#6b4423'; ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  ctx.strokeStyle = '#3e2713'; ctx.lineWidth = 2; ctx.strokeRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
  const cx0 = V.sx(-PIT.halfW), cx1 = V.sx(PIT.halfW), cy0 = V.sy(PIT.back), cy1 = V.sy(PIT.front);
  const cg = ctx.createLinearGradient(0, cy0, 0, cy1);
  cg.addColorStop(0, st.clay0 || '#a35f35'); cg.addColorStop(1, st.clay1 || '#c27a47');
  ctx.fillStyle = cg; ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
  // grain: fixed specks
  ctx.save(); ctx.beginPath(); ctx.rect(cx0, cy0, cx1 - cx0, cy1 - cy0); ctx.clip();
  const sp = Math.max(1, V.sc / 140);
  for (let i = 0; i < 220; i++) {
    const x = cx0 + hash(i) * (cx1 - cx0), y = cy0 + hash(i + 500) * (cy1 - cy0);
    ctx.fillStyle = hash(i + 900) > 0.5 ? 'rgba(60,30,10,0.22)' : 'rgba(255,225,180,0.18)';
    ctx.fillRect(x, y, sp * (1 + 2 * hash(i + 60)), sp * (1 + hash(i + 70)));
  }
  // scuffs from shoes that have landed here
  ctx.restore();
  // the six-inch ring and the stake
  const sx = V.sx(0), sy = V.sy(0);
  ctx.setLineDash([6, 7]); ctx.strokeStyle = 'rgba(255,248,214,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy, (SIX + R_STAKE) * V.sc, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  // shoes, far first
  const list = [...st.shoes].filter((s) => !s.dead || (Math.abs(s.x) < WIN.x && s.v > WIN.v0 && s.v < WIN.v1)).sort((a, b) => b.v - a.v);
  for (const s of list) {
    if (s.dead && !(Math.abs(s.x) <= PIT.halfW + 0.07)) continue;
    ctx.save();
    ctx.translate(2, 4); shoePath(ctx, V, s); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
    shoePath(ctx, V, s);
    const T = TEAM[s.side];
    ctx.fillStyle = s.dead ? 'rgba(120,120,120,0.7)' : T.main; ctx.fill();
    ctx.lineWidth = Math.max(1.5, V.sc * 0.007); ctx.strokeStyle = T.dark; ctx.stroke();
    ctx.save(); shoePath(ctx, V, s); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1.2, V.sc * 0.006); shoePath(ctx, V, s); ctx.stroke();
    ctx.restore();
    if (s.ringer && !s.dead) {
      ctx.strokeStyle = `rgba(255,236,140,${0.6 + 0.3 * Math.sin(st.t * 5)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(V.sx(s.x), V.sy(s.v), V.sc * 0.14, 0, TAU); ctx.stroke();
    }
  }
  // stake on top
  const sr = Math.max(4.5, R_STAKE * V.sc * 1.9);
  const sg = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 1, sx, sy, sr);
  sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.5, '#c8d0d8'); sg.addColorStop(1, '#58626d');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#2c333b'; ctx.stroke();
  // target ghost
  if (st.target) {
    const tg = st.target, g = { x: tg.tx, v: tg.tv, ang: 0 };
    const T = TEAM[tg.team ?? 0];
    ctx.save();
    ctx.setLineDash([7, 6]); ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    // scatter ellipse
    const rx = 0.07 * (tg.k ?? 1) * 1.4 * V.sc, ry = 0.075 * (tg.k ?? 1) * 1.4 * V.sc;
    ctx.beginPath(); ctx.ellipse(V.sx(tg.tx), V.sy(tg.tv), rx, ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    shoePath(ctx, V, g); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = T.light; shoePath(ctx, V, g); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2;
    const cx = V.sx(tg.tx), cy = V.sy(tg.tv), c = 9;
    ctx.beginPath(); ctx.moveTo(cx - c, cy); ctx.lineTo(cx + c, cy); ctx.moveTo(cx, cy - c); ctx.lineTo(cx, cy + c); ctx.stroke();
    ctx.restore();
  }
  // labels
  ctx.fillStyle = 'rgba(255,248,224,0.9)'; ctx.font = `700 ${Math.round(clampN(rect.w * 0.035, 13, 20))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('BACK BOARD', V.sx(0), V.sy(PIT.back + 0.035));
  ctx.restore();
  ctx.save(); roundPath(ctx, rect.x, rect.y, rect.w, rect.h, 22); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke(); ctx.restore();
  return V;
}

// ---- the arm gauge ---------------------------------------------------------------------------------------------------------
// The pivot sits at the bottom centre; 0 degrees is straight up; the green wedge is the release window for the chosen flip.
// shrink a one-line label until it fits the given width (never below 9px)
export function fitHintPx(ctx, text, px, maxW) {
  let p = px;
  for (; p > 9; p--) { ctx.font = `700 ${p}px ${FONT}`; if (ctx.measureText(text).width <= maxW) break; }
  return p;
}

export function drawGauge(ctx, r, st) {
  const R = Math.min(r.h * 0.68, r.w * 0.34), cx = r.x + r.w / 2, cy = r.y + r.h - 12;
  const rad = (deg) => ((deg - 90) * Math.PI) / 180;
  const flip = st.flip, W = windowDeg(flip, st.calm);
  ctx.save();
  roundPath(ctx, r.x + 1, r.y + 6, r.w - 2, r.h, 20); ctx.fillStyle = 'rgba(5,10,18,0.5)'; ctx.fill();
  const bz = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); bz.addColorStop(0, '#cfd8e0'); bz.addColorStop(0.5, '#7d8a97'); bz.addColorStop(1, '#4a5560');
  roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.fillStyle = bz; ctx.fill();
  const fc = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); fc.addColorStop(0, '#16283a'); fc.addColorStop(1, '#0a1622');
  roundPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 16); ctx.fillStyle = fc; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(20,10,4,0.7)'; roundPath(ctx, r.x, r.y, r.w, r.h, 20); ctx.stroke();
  ctx.save(); roundPath(ctx, r.x + 5, r.y + 5, r.w - 10, r.h - 10, 16); ctx.clip();
  // dial track
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(cx, cy, R, rad(-SWING.A), rad(SWING.A)); ctx.stroke();
  // good window and perfect window
  ctx.strokeStyle = st.live ? '#3fe08a' : '#2ca866'; ctx.lineWidth = 22; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(cx, cy, R, rad(SWING.mark - W), rad(SWING.mark + W)); ctx.stroke();
  ctx.strokeStyle = '#c9ffe0'; ctx.lineWidth = 22;
  ctx.beginPath(); ctx.arc(cx, cy, R, rad(SWING.mark - W * 0.35), rad(SWING.mark + W * 0.35)); ctx.stroke();
  // mark
  const mk = rad(SWING.mark);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(mk) * (R - 20), cy + Math.sin(mk) * (R - 20)); ctx.lineTo(cx + Math.cos(mk) * (R + 20), cy + Math.sin(mk) * (R + 20)); ctx.stroke();
  // arm
  const deg = st.arm ? st.arm.deg : 0, a = rad(deg), ex = cx + Math.cos(a) * (R - 6), ey = cy + Math.sin(a) * (R - 6);
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(cx + 2, cy + 3); ctx.lineTo(ex + 2, ey + 3); ctx.stroke();
  ctx.strokeStyle = st.live ? '#ffe28a' : 'rgba(255,255,255,0.55)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
  // the shoe in the hand at the end of the arm
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(a + Math.PI / 2);
  const sc = R * 0.0016;
  ctx.scale(sc * 100, sc * 100);
  ctx.beginPath();
  const ro = CL + HALF_T, ri = CL - HALF_T;
  ctx.moveTo(-ro, -TIP);
  for (let i = 0; i <= 14; i++) { const q = Math.PI + (Math.PI * i) / 14; ctx.lineTo(ro * Math.cos(q), -ro * Math.sin(q)); }
  ctx.lineTo(ro, -TIP); ctx.lineTo(ri, -TIP);
  for (let i = 14; i >= 0; i--) { const q = Math.PI + (Math.PI * i) / 14; ctx.lineTo(ri * Math.cos(q), -ri * Math.sin(q)); }
  ctx.lineTo(-ri, -TIP); ctx.closePath();
  ctx.fillStyle = TEAM[st.team ?? 0].main; ctx.fill(); ctx.lineWidth = 0.014; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#e9f1f7'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, TAU); ctx.fill();
  ctx.restore();
  // words
  ctx.fillStyle = 'rgba(235,245,255,0.9)'; ctx.font = `700 ${Math.round(clampN(r.h * 0.14, 15, 22))}px ${FONT}`; ctx.textBaseline = 'alphabetic';
  { const sidePx = Math.min(fitHintPx(ctx, 'early: short', Math.round(clampN(r.h * 0.14, 15, 22)), r.w / 2 - 34), fitHintPx(ctx, 'late: long', Math.round(clampN(r.h * 0.14, 15, 22)), r.w / 2 - 34)); ctx.font = `700 ${sidePx}px ${FONT}`; }
  ctx.textAlign = 'left'; ctx.fillText('early: short', r.x + 14, r.y + r.h - 12);
  ctx.textAlign = 'right'; ctx.fillText('late: long', r.x + r.w - 14, r.y + r.h - 12);
  ctx.textAlign = 'center'; ctx.fillStyle = '#9dffc7';
  const hint = st.live ? 'let go in the green' : 'hold PITCH, let go in the green';
  const fitPx = fitHintPx(ctx, hint, Math.round(clampN(r.h * 0.14, 15, 22)), r.w - 24);
  ctx.font = `700 ${fitPx}px ${FONT}`;
  ctx.fillText(hint, cx, r.y + 24);
  ctx.restore();
}

// ---- HUD pieces ------------------------------------------------------------------------------------------------------------
// a small forged shoe, open end up: thick steel U with a highlight, two nail holes and heel calks; dimmed when already thrown
function miniShoe(ctx, cx, bottom, s, col, on) {
  const R = s * 0.34, arm = s * 0.34, lw = s * 0.26, cy = bottom - lw / 2 - R;
  const path = () => { ctx.beginPath(); ctx.moveTo(cx - R, cy - arm); ctx.lineTo(cx - R, cy); ctx.arc(cx, cy, R, Math.PI, 0, true); ctx.lineTo(cx + R, cy - arm); };
  ctx.save(); ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
  path(); ctx.lineWidth = lw + 3; ctx.strokeStyle = on ? 'rgba(10,16,24,0.85)' : 'rgba(10,16,24,0.35)'; ctx.stroke();
  const g = ctx.createLinearGradient(cx - R - lw / 2, 0, cx + R + lw / 2, 0);
  if (on) { g.addColorStop(0, '#9fb0bf'); g.addColorStop(0.35, '#f6f9fc'); g.addColorStop(0.7, '#c4d0db'); g.addColorStop(1, '#7e8e9d'); } else { g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0.22)'); }
  path(); ctx.lineWidth = lw; ctx.strokeStyle = g; ctx.stroke();
  if (on) {
    ctx.fillStyle = '#3b4652'; const d = Math.max(1.2, lw * 0.12);
    for (const sx of [-1, 1]) for (const k of [0.35, 0.75]) { ctx.beginPath(); ctx.arc(cx + sx * R, cy - arm * k, d, 0, 6.3); ctx.fill(); }
    ctx.fillStyle = '#dfe6ec'; for (const sx of [-1, 1]) ctx.fillRect(cx + sx * R - lw * 0.62, cy - arm - lw * 0.12, lw * 1.24, lw * 0.34);
  }
  ctx.restore();
}
export function drawCard(ctx, r, side, name, score, shoesLeft, active) {
  const T = TEAM[side];
  ctx.save();
  // walnut plaque with a team enamel plate set into it
  roundPath(ctx, r.x + 1, r.y + 6, r.w - 2, r.h, 18); ctx.fillStyle = 'rgba(5,10,18,0.5)'; ctx.fill();
  const fr = ctx.createLinearGradient(0, r.y, 0, r.y + r.h); fr.addColorStop(0, '#a87a48'); fr.addColorStop(0.55, '#6a4425'); fr.addColorStop(1, '#46290f');
  roundPath(ctx, r.x, r.y, r.w, r.h, 18); ctx.fillStyle = fr; ctx.fill();
  ctx.lineWidth = active ? 3.5 : 1.6; ctx.strokeStyle = active ? '#ffe28a' : 'rgba(255,226,150,0.45)'; roundPath(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 17); ctx.stroke();
  const b = 6, ix = r.x + b, iy = r.y + b, iw = r.w - 2 * b, ih = r.h - 2 * b;
  const g = ctx.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, T.light); g.addColorStop(0.18, T.main); g.addColorStop(1, T.dark);
  roundPath(ctx, ix, iy, iw, ih, 13); ctx.fillStyle = g; ctx.fill();
  ctx.save(); roundPath(ctx, ix, iy, iw, ih, 13); ctx.clip();
  const sh = ctx.createLinearGradient(0, iy, 0, iy + ih * 0.5); sh.addColorStop(0, 'rgba(255,255,255,0.34)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sh; ctx.fillRect(ix, iy, iw, ih * 0.5);
  if (active) { const pulse = ctx.createLinearGradient(ix, 0, ix + iw, 0); pulse.addColorStop(0, 'rgba(255,240,170,0.22)'); pulse.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = pulse; ctx.fillRect(ix, iy, iw, ih); }
  ctx.restore();
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
  let fs = Math.round(r.h * 0.22);
  ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left';
  while (ctx.measureText(name).width > r.w - 102 && fs > 11) { fs--; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
  ctx.fillText(name, r.x + 16, r.y + r.h * 0.36);
  ctx.restore();
  for (let i = 0; i < 2; i++) miniShoe(ctx, r.x + 30 + i * (r.h * 0.42), r.y + r.h - 12, r.h * 0.42, '#e8eef4', i < shoesLeft);
  ctx.font = `700 ${Math.round(r.h * 0.6)}px ${DISPLAY}`; ctx.textAlign = 'right';
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2.5;
  ctx.fillText(String(score), r.x + r.w - 16, r.y + r.h * 0.72); ctx.restore();
  ctx.restore();
}

export function drawPopup(ctx, rect, st) {
  // inning result panel over the lane/board area
  const { head, lines } = st;
  const wd = Math.min(rect.w - 20, 560), x = rect.x + (rect.w - wd) / 2;
  ctx.save();
  ctx.font = `400 ${Math.round(26 * st.zoom)}px ${FONT}`;
  const wrapped = lines.flatMap((l) => wrapLines(ctx, l, wd - 60));
  const fs = Math.round(26 * st.zoom), hh = 96 * Math.min(st.zoom, 1.5) + wrapped.length * fs * 1.3 + 70;
  const y = rect.y + Math.min(30, Math.max(8, (rect.h - hh) / 2));
  panel(ctx, x, y, wd, hh, { r: 26, fill: 'rgba(16,34,52,0.95)', stroke: 'rgba(255,226,138,0.7)' });
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${Math.round(46 * Math.min(st.zoom, 1.5))}px ${DISPLAY}`;
  textShadow(ctx, head, x + wd / 2, y + 62 * Math.min(st.zoom, 1.5), '#ffe28a', 6);
  ctx.font = `400 ${fs}px ${FONT}`; ctx.fillStyle = '#eaf3fb';
  wrapped.forEach((l, i) => ctx.fillText(l, x + wd / 2, y + 100 * Math.min(st.zoom, 1.5) + i * fs * 1.3));
  ctx.font = `600 ${Math.round(20 * Math.min(st.zoom, 1.5))}px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('tap to continue', x + wd / 2, y + hh - 18);
  ctx.restore();
}

export function drawToast(ctx, T, text, t) {
  if (!text) return;
  ctx.save();
  ctx.font = `700 24px ${FONT}`;
  const lines = wrapLines(ctx, text, T.maxW - 40), lh = 30, h = lines.length * lh + 22, w = Math.min(T.maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44);
  const a = Math.min(1, t * 3);
  ctx.globalAlpha = a;
  roundPath(ctx, T.x - w / 2, T.y - 22 + 4, w, h, 20); ctx.fillStyle = 'rgba(5,10,18,0.45)'; ctx.fill();
  const tg = ctx.createLinearGradient(0, T.y - 22, 0, T.y - 22 + h); tg.addColorStop(0, '#6a4425'); tg.addColorStop(1, '#3a2210');
  roundPath(ctx, T.x - w / 2, T.y - 22, w, h, 20); ctx.fillStyle = tg; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,226,138,0.85)'; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, T.x, T.y - 22 + 11 + lh / 2 + i * lh));
  ctx.restore();
}

export { drawButton, FLIGHT_T, flightPos, TARGET_LIMITS, FLIPS, armAngle };
