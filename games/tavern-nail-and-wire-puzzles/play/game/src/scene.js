// The 3D picture: a small software renderer for lit metal wire (orbit camera, perspective, tubes, mat, shadows, picking).
// Reads puzzle state, never changes it. Everything is drawn with 2D canvas strokes, so it runs the same everywhere.
import { prepare } from './wire.js';
import { theme, mix, rgba, txt, F } from './ui.js';
import { v3 } from './v3.js';

export const TUBE = 0.165;                      // wire radius in lattice units
export const AXIS_COL = ['#ee6a55', '#62d484', '#5aaaff'];
export const AXIS_NAME = ['X', 'Y', 'Z'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const LIGHT = (() => { const l = Math.hypot(-0.55, -0.83); return [-0.55 / l, -0.83 / l]; })();

export const newCamera = () => ({ yaw: 0.62, pitch: v3.on ? 0.66 : 0.55, zoom: 1 });
export function orbit(cam, dx, dy) {
  cam.yaw += dx;
  if (cam.yaw > Math.PI) cam.yaw -= 2 * Math.PI; else if (cam.yaw < -Math.PI) cam.yaw += 2 * Math.PI;
  cam.pitch = clamp(cam.pitch + dy, 0.1, 1.38);
}

// ---- projection ------------------------------------------------------------------------------------------------------------
// view = { c:[x,y,z] orbit centre, r: radius to fit, rect }
export function setup(cam, rect, view) {
  const cyaw = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
  const r = view.r / clamp(cam.zoom, 0.6, 2.4), D = r * 3.4, fit = Math.min(rect.w, rect.h) * 0.5 * 0.98, f = fit * D * 0.955 / r;
  const P = { cyaw, syaw, cp, sp, D, f, c: view.c, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2, matY: view.matY, view };
  // Fit the zone box (padded; the mat is just a floor that runs off the edges) to the rectangle on each axis separately, over every yaw, so a tall field is filled
  // vertically and the picture does not drift while orbiting; the user's zoom then scales around that fit.
  if (view.zone && view.fit !== false && rect.w > 0 && rect.h > 0) {
    const key = `${rect.w}|${rect.h}|${cam.pitch.toFixed(2)}|${view.r}`;
    let fl = view.__fit;
    if (!fl || fl.key !== key) {
      const r1 = view.r, D1 = r1 * 3.4, f1 = fit * D1 * 0.955 / r1;
      const pad = (view.pad ?? 0.4) * 1.1 + 0.6, lo = view.zone.lo, hi = view.zone.hi;
      const pts = [];
      for (const x of [lo[0] - pad, hi[0] + pad]) for (const y of [lo[1] - pad, hi[1] + pad]) for (const z of [lo[2] - pad, hi[2] + pad]) pts.push([x, y, z]);
      let ax = 0, up = 0, down = 0;
      for (let k = 0; k < 24; k++) {
        const yaw = (k / 24) * Math.PI * 2, cy_ = Math.cos(yaw), sy_ = Math.sin(yaw);
        for (const q of pts) {
          const x = q[0] - view.c[0], y = q[1] - view.c[1], z = q[2] - view.c[2];
          const x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_, y2 = y * cp + z1 * sp, z2 = -y * sp + z1 * cp, kk = f1 / (D1 + z2);
          ax = Math.max(ax, Math.abs(x1 * kk)); up = Math.max(up, y2 * kk); down = Math.max(down, -y2 * kk);
        }
      }
      const kx = (rect.w * 0.5 * 0.97) / Math.max(1, ax), ky = (rect.h * 0.97) / Math.max(1, up + down);
      const k = Math.max(1, Math.min(kx, ky, 2));
      fl = view.__fit = { key, k, shift: ((up - down) / 2) * k };   // screen y grows downward: content centre sits (up-down)/2 above the orbit centre
    }
    P.f = f * fl.k; P.cy += fl.shift * clamp(cam.zoom, 0.6, 2.4);
  }
  return P;
}
export function proj(P, x, y, z) {
  x -= P.c[0]; y -= P.c[1]; z -= P.c[2];
  const x1 = x * P.cyaw + z * P.syaw, z1 = -x * P.syaw + z * P.cyaw;
  const y2 = y * P.cp + z1 * P.sp, z2 = -y * P.sp + z1 * P.cp;
  const d = P.D + z2, k = P.f / d;
  return { x: P.cx + x1 * k, y: P.cy - y2 * k, d, k };
}
// direction vectors only (no translation), for the axis gizmo and drag mapping
export function projDir(P, v) {
  const x1 = v[0] * P.cyaw + v[2] * P.syaw, z1 = -v[0] * P.syaw + v[2] * P.cyaw;
  return { x: x1, y: -(v[1] * P.cp + z1 * P.sp), z: -v[1] * P.sp + z1 * P.cp };
}

// ---- geometry of a posed (and maybe animating) piece ----------------------------------------------------------------------------
function rotAxis(p, ax, c, s) {
  const x = p[0], y = p[1], z = p[2];
  if (ax === 0) return [x, y * c - z * s, y * s + z * c];
  if (ax === 1) return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}
// anim: { kind: 's'|'t', from: pose, to: pose, turn: 0..5, e: 0..1 progress (eased) } or null
export function liveGeometry(def, pose, anim) {
  let units, joints, ox = pose.x, oy = pose.y, oz = pose.z, a = null;
  const pp = prepare(def);
  if (anim && anim.e < 1) {
    if (anim.kind === 's') {
      const c = pp.at(pose.o); units = c.units; joints = c.joints;
      ox = pose.x + (anim.from.x - pose.x) * (1 - anim.e); oy = pose.y + (anim.from.y - pose.y) * (1 - anim.e); oz = pose.z + (anim.from.z - pose.z) * (1 - anim.e);
    } else {
      const c = pp.at(anim.from.o); units = c.units; joints = c.joints;
      const ang = anim.e * Math.PI / 2 * (anim.turn & 1 ? -1 : 1);
      a = { ax: anim.turn >> 1, c: Math.cos(ang), s: Math.sin(ang) };
    }
  } else { const c = pp.at(pose.o); units = c.units; joints = c.joints; }
  const outU = new Array(units.length), outJ = new Array(joints.length);
  const T = (p) => { const q = a ? rotAxis(p, a.ax, a.c, a.s) : p; return [q[0] + ox, q[1] + oy, q[2] + oz]; };
  for (let i = 0; i < units.length; i++) { const u = units[i], p = T([u[0], u[1], u[2]]), q = T([u[3], u[4], u[5]]); outU[i] = [p[0], p[1], p[2], q[0], q[1], q[2]]; }
  for (let i = 0; i < joints.length; i++) outJ[i] = T(joints[i]);
  return { units: outU, joints: outJ, pivot: [ox, oy, oz] };
}

// ---- drawing ---------------------------------------------------------------------------------------------------------------------
function tube(ctx, a, b, w, m, fade, hot) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const edge = fade ? mix(m.edge, fade.c, fade.k) : m.edge, body = fade ? mix(m.body, fade.c, fade.k) : m.body, light = fade ? mix(m.light, fade.c, fade.k * 0.6) : m.light;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
  ctx.lineWidth = w; ctx.strokeStyle = edge; ctx.stroke();
  ctx.lineWidth = w * 0.76; ctx.strokeStyle = body; ctx.stroke();
  // highlight rides the side of the tube that faces the light
  let ux = len > 0.01 ? dx / len : 1, uy = len > 0.01 ? dy / len : 0;
  let nx = LIGHT[0] - (LIGHT[0] * ux + LIGHT[1] * uy) * ux, ny = LIGHT[1] - (LIGHT[0] * ux + LIGHT[1] * uy) * uy;
  const nl = Math.hypot(nx, ny);
  if (nl < 0.05) { nx = LIGHT[0]; ny = LIGHT[1]; } else { nx /= nl; ny /= nl; }
  const off = w * 0.17;
  ctx.beginPath(); ctx.moveTo(a.x + nx * off, a.y + ny * off); ctx.lineTo(b.x + nx * off, b.y + ny * off);
  ctx.lineWidth = w * 0.36; ctx.strokeStyle = light; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(a.x + nx * off * 1.35, a.y + ny * off * 1.35); ctx.lineTo(b.x + nx * off * 1.35, b.y + ny * off * 1.35);
  ctx.lineWidth = Math.max(1, w * 0.1); ctx.strokeStyle = hot ? '#ffffff' : m.spec; ctx.globalAlpha = hot ? 0.95 : 0.75; ctx.stroke(); ctx.globalAlpha = 1;
}
function ball(ctx, p, rad, m, fade) {
  const g = ctx.createRadialGradient(p.x - rad * 0.32, p.y - rad * 0.38, rad * 0.08, p.x, p.y, rad);
  g.addColorStop(0, m.light); g.addColorStop(0.55, fade ? mix(m.body, fade.c, fade.k) : m.body); g.addColorStop(1, m.edge);
  ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 7); ctx.fillStyle = g; ctx.fill();
}

// scene: { cam, view, pieces: [{ def, pose, anim, metal, sel, fixed, done }], opts: { grid, shadows, t, hint, win, bump } }
export function drawScene(ctx, rect, sc) {
  const T = theme(), P = setup(sc.cam, rect, sc.view), o = sc.opts ?? {};
  if (v3.on) {
    // the lit 3D scene draws behind this canvas (view3d/presenter.js); here only the flat overlay (grip bead, hints, win sweep)
    v3.req = { rect, sc };
    for (const pc of sc.pieces) pc._geo = liveGeometry(pc.def, pc.pose, pc.anim);
    ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
    drawOverlay(ctx, rect, sc, P, o);
    ctx.restore();
    return;
  }
  const [cx, cy, cz] = sc.view.c, h = sc.view.r, matY = sc.view.matY;
  ctx.save();
  ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
  // ---- mat ----
  const corner = (x, z) => proj(P, x, matY, z), mx0 = cx - h * 0.98, mx1 = cx + h * 0.98, mz0 = cz - h * 0.98, mz1 = cz + h * 0.98;
  const q = [corner(mx0, mz0), corner(mx1, mz0), corner(mx1, mz1), corner(mx0, mz1)];
  const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
  const ys = q.map((p) => p.y), g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
  g.addColorStop(0, T.mat1); g.addColorStop(1, T.mat0);
  // soft drop under the mat
  ctx.save(); ctx.translate(0, 10); poly(q); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill(); ctx.restore();
  poly(q); ctx.fillStyle = g; ctx.fill();
  if (T.wood) {
    // oak bar-top: planks along X, per-plank tone, seams, grain strokes and a soft sheen (deterministic, no randomness per frame)
    ctx.save(); poly(q); ctx.clip();
    const pw = 2.2, nP = Math.ceil((mz1 - mz0) / pw), hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < nP; i++) {
      const za = mz0 + i * pw, zb2 = Math.min(mz1, za + pw), tone = hash(i, 1);
      const pq = [corner(mx0, za), corner(mx1, za), corner(mx1, zb2), corner(mx0, zb2)];
      poly(pq); ctx.fillStyle = `rgba(${Math.round(70 + tone * 34)},${Math.round(44 + tone * 20)},${Math.round(22 + tone * 10)},0.92)`; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,214,150,0.07)'; ctx.beginPath();
      for (let k = 1; k <= 5; k++) {
        const zz = za + (zb2 - za) * (k / 6) + (hash(i, k) - 0.5) * 0.25, wob = (hash(k, i) - 0.5) * 0.9;
        const a = corner(mx0, zz), m = corner((mx0 + mx1) / 2, zz + wob), b = corner(mx1, zz);
        ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(m.x, m.y, b.x, b.y);
      }
      ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(8,3,0,0.55)'; ctx.beginPath(); { const a = corner(mx0, za), b = corner(mx1, za); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke();
    }
    const sh = ctx.createRadialGradient(P.cx, P.cy - 30, 10, P.cx, P.cy, Math.max(rect.w, rect.h) * 0.6);
    sh.addColorStop(0, 'rgba(255,196,120,0.16)'); sh.addColorStop(1, 'rgba(0,0,0,0.28)'); poly(q); ctx.fillStyle = sh; ctx.fill();
    ctx.restore();
  }
  ctx.lineJoin = 'round'; ctx.lineWidth = T.wood ? 9 : 6; ctx.strokeStyle = T.matEdge; ctx.stroke();
  if (T.wood) { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,224,150,0.55)'; poly(q); ctx.stroke(); }
  if (o.grid !== false) {
    ctx.save(); poly(q); ctx.clip();
    ctx.lineWidth = 1; ctx.strokeStyle = T.matLine; ctx.beginPath();
    for (let x = Math.ceil(mx0); x <= mx1; x++) { const a = corner(x, mz0), b = corner(x, mz1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    for (let z = Math.ceil(mz0); z <= mz1; z++) { const a = corner(mx0, z), b = corner(mx1, z); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke(); ctx.restore();
  }
  // ---- the zone (the frame's footprint) ----
  const zb = sc.view.zone;
  if (zb) {
    const zc = o.win ? T.good : T.zone, x0 = zb.lo[0] - 0.5, x1 = zb.hi[0] + 0.5, z0 = zb.lo[2] - 0.5, z1 = zb.hi[2] + 0.5, y0 = zb.lo[1] - 0.5, y1 = zb.hi[1] + 0.5;
    const f = [corner(x0, z0), corner(x1, z0), corner(x1, z1), corner(x0, z1)];
    poly(f); ctx.fillStyle = rgba(zc.length === 7 ? zc : '#f1c15a', 0.1); ctx.fill();
    ctx.setLineDash([9, 7]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(zc.length === 7 ? zc : '#f1c15a', 0.55); poly(f); ctx.stroke();
    ctx.beginPath();
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) { const a = proj(P, x, y0, z), b = proj(P, x, y1, z); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    const tp = [proj(P, x0, y1, z0), proj(P, x1, y1, z0), proj(P, x1, y1, z1), proj(P, x0, y1, z1)];
    tp.forEach((p, i) => { ctx.moveTo(p.x, p.y); const n = tp[(i + 1) % 4]; ctx.lineTo(n.x, n.y); });
    ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(zc.length === 7 ? zc : '#f1c15a', 0.35); ctx.stroke();
    ctx.setLineDash([]);
  }
  // ---- geometry ----
  const items = [], shadow = [];
  const rad = (p) => TUBE * p.k;
  const sel = [];
  sc.pieces.forEach((pc, pi) => {
    const geo = liveGeometry(pc.def, pc.pose, pc.anim), m = T.metals[pc.metal] ?? T.metals.iron;
    let ox = 0, oy = 0;
    if (pc.shake) { ox = Math.sin(pc.shake * 60) * 4 * Math.min(1, pc.shake * 5); oy = 0; }
    pc._geo = geo;
    for (const u of geo.units) {
      const a = proj(P, u[0], u[1], u[2]), b = proj(P, u[3], u[4], u[5]);
      a.x += ox; b.x += ox; a.y += oy; b.y += oy;
      const d = (a.d + b.d) / 2, w = TUBE * 2 * (a.k + b.k) / 2;
      items.push({ t: 0, a, b, d, w, m, pc, pi });
      if (o.shadows !== false) shadow.push([proj(P, u[0], matY, u[2]), proj(P, u[3], matY, u[5]), w]);
      if (pc.sel) sel.push([a, b, w]);
    }
    for (const j of geo.joints) {
      const p = proj(P, j[0], j[1], j[2]); p.x += ox; p.y += oy;
      items.push({ t: 1, a: p, d: p.d - 0.001, w: TUBE * 2 * p.k, m, pc, pi });
    }
  });
  // shadows (one stroke path => no double darkening)
  if (shadow.length) {
    ctx.lineCap = 'round'; ctx.beginPath();
    for (const [a, b] of shadow) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.lineWidth = shadow[0][2] * 1.55; ctx.strokeStyle = T.shadow; ctx.stroke();
  }
  // selection glow
  if (sel.length) {
    ctx.lineCap = 'round'; ctx.beginPath();
    for (const [a, b] of sel) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    const pulse = 0.5 + 0.5 * Math.sin((o.t ?? 0) * 4);
    ctx.lineWidth = sel[0][2] * 2.5; ctx.strokeStyle = rgba(T.accent, 0.2 + 0.1 * pulse); ctx.stroke();
    ctx.lineWidth = sel[0][2] * 1.6; ctx.strokeStyle = rgba(T.accent, 0.28 + 0.12 * pulse); ctx.stroke();
  }
  items.sort((p, q) => q.d - p.d);
  // fade distant metal toward the mat colour a little (depth cue)
  const dMin = P.D - h, dMax = P.D + h;
  for (const it of items) {
    const fk = clamp((it.d - dMin) / (dMax - dMin), 0, 1) * 0.28, fade = { c: T.mat1, k: fk };
    if (it.t === 0) tube(ctx, it.a, it.b, it.w, it.m, fade, it.pc.sel);
    else ball(ctx, it.a, it.w / 2, it.m, fade);
  }
  drawOverlay(ctx, rect, sc, P, o);
  ctx.restore();
}

// grip bead, hint arrows and the win sweep: drawn flat over either renderer (same projection)
function drawOverlay(ctx, rect, sc, P, o) {
  const T = theme();
  const selPc = sc.pieces.find((p) => p.sel && p._geo);
  if (selPc && !o.hideGrip) {
    const v = selPc._geo.pivot, p = proj(P, v[0], v[1], v[2]), r = Math.max(6, TUBE * 1.5 * p.k);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = rgba(T.accent, 0.35); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = T.accent; ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.35, 0, 7); ctx.fillStyle = T.accent; ctx.fill();
  }
  if (o.hint) drawHint(ctx, P, sc, o.hint, o.t ?? 0);
  if (o.win > 0) {
    // a bright sweep over the zone
    const zb2 = sc.view.zone;
    if (zb2) { const a = proj(P, (zb2.lo[0] + zb2.hi[0]) / 2, (zb2.lo[1] + zb2.hi[1]) / 2, (zb2.lo[2] + zb2.hi[2]) / 2); const rg = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, Math.min(rect.w, rect.h) * 0.6); rg.addColorStop(0, rgba(T.gold, 0.22 * Math.min(1, o.win))); rg.addColorStop(1, rgba(T.gold, 0)); ctx.fillStyle = rg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
  }
}

function drawHint(ctx, P, sc, h, t) {
  const T = theme(), pc = sc.pieces[h.piece + 1];
  if (!pc || !pc._geo) return;
  const v = pc._geo.pivot, pulse = 0.5 + 0.5 * Math.sin(t * 6);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const col = T.accent;
  if (h.k === 's') {
    const d = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][h.i];
    const a = proj(P, v[0], v[1], v[2]), b = proj(P, v[0] + d[0] * 1.5, v[1] + d[1] * 1.5, v[2] + d[2] * 1.5);
    arrow(ctx, a, b, col, 5 + 2 * pulse);
  } else {
    const ax = h.i >> 1, sg = h.i & 1 ? -1 : 1, R = 1.55, pts = [];
    for (let k = 0; k <= 16; k++) {
      const ang = (k / 16) * (Math.PI / 2) * sg + (sg > 0 ? 0 : 0);
      const c = Math.cos(ang + 0.0), s = Math.sin(ang);
      // a quarter circle in the plane perpendicular to the axis, starting on the first in-plane axis
      let p;
      if (ax === 0) p = [0, c * R, s * R]; else if (ax === 1) p = [s * R, 0, c * R]; else p = [c * R, s * R, 0];
      pts.push(proj(P, v[0] + p[0], v[1] + p[1], v[2] + p[2]));
    }
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.lineWidth = 5 + 2 * pulse; ctx.strokeStyle = col; ctx.stroke();
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    arrow(ctx, a, b, col, 5 + 2 * pulse, true);
  }
  ctx.restore();
}
function arrow(ctx, a, b, col, w, headOnly = false) {
  const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hs = Math.max(16, w * 3.2);
  ctx.strokeStyle = col; ctx.fillStyle = col;
  if (!headOnly) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x - ux * hs * 0.6, b.y - uy * hs * 0.6); ctx.lineWidth = w; ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(b.x + ux * hs * 0.45, b.y + uy * hs * 0.45); ctx.lineTo(b.x - ux * hs * 0.7 - uy * hs * 0.55, b.y - uy * hs * 0.7 + ux * hs * 0.55); ctx.lineTo(b.x - ux * hs * 0.7 + uy * hs * 0.55, b.y - uy * hs * 0.7 - ux * hs * 0.55); ctx.closePath(); ctx.fill();
}

// ---- axis gizmo ---------------------------------------------------------------------------------------------------------------------
export function drawGizmo(ctx, cam, x, y, size) {
  const T = theme();
  const P = { cyaw: Math.cos(cam.yaw), syaw: Math.sin(cam.yaw), cp: Math.cos(cam.pitch), sp: Math.sin(cam.pitch) };
  const ax = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v, i) => ({ i, d: projDir(P, v) })).sort((a, b) => b.d.z - a.d.z);
  ctx.save(); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, size * 1.12, 0, 7); ctx.fillStyle = T.dark ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.4)'; ctx.fill();
  for (const a of ax) {
    const ex = x + a.d.x * size, ey = y + a.d.y * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.lineWidth = Math.max(3, size * 0.12); ctx.strokeStyle = AXIS_COL[a.i]; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, size * 0.2, 0, 7); ctx.fillStyle = AXIS_COL[a.i]; ctx.fill();
    txt(ctx, AXIS_NAME[a.i], ex, ey + 1, { size: Math.max(F(15), size * 0.3), weight: 800, color: '#0b0b0b', align: 'center' });
  }
  ctx.restore();
}

// ---- picking ----------------------------------------------------------------------------------------------------------------------------
// Returns the index in sc.pieces of the piece whose wire is nearest the point (or -1). Uses the same geometry as drawScene.
export function pickPiece(rect, sc, x, y) {
  const P = setup(sc.cam, rect, sc.view);
  let best = -1, bd = 1e9;
  sc.pieces.forEach((pc, pi) => {
    const geo = liveGeometry(pc.def, pc.pose, pc.anim);
    for (const u of geo.units) {
      const a = proj(P, u[0], u[1], u[2]), b = proj(P, u[3], u[4], u[5]);
      const w = TUBE * (a.k + b.k), vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
      let t = L2 > 0 ? ((x - a.x) * vx + (y - a.y) * vy) / L2 : 0; t = clamp(t, 0, 1);
      const dx = a.x + vx * t - x, dy = a.y + vy * t - y, dist = Math.hypot(dx, dy) - w;
      // prefer the nearer (smaller depth) piece when the finger covers two
      const score = dist + (a.d + b.d) * 0.0005;
      if (dist < Math.max(16, w * 0.9) && score < bd) { bd = score; best = pi; }
    }
  });
  return best;
}
export { smooth };

// The orbit centre, fit radius, mat height and zone box for one puzzle's rules (see wire.makeRules).
export function makeView(rules) {
  const fb = rules.frameBox, R = rules.R;
  const c = [(fb.lo[0] + fb.hi[0]) / 2, (fb.lo[1] + fb.hi[1]) / 2, (fb.lo[2] + fb.hi[2]) / 2];
  const half = Math.max(fb.hi[0] - fb.lo[0], fb.hi[1] - fb.lo[1], fb.hi[2] - fb.lo[2]) / 2;
  return { c, r: (half + R * 1.35 + 1.0) * 0.93, matY: fb.lo[1] - Math.min(R, 2) - 0.7, zone: fb, pad: R };
}
