// Drawing primitives: lit balls (with a spin mark so rolling is visible), the table (baked once per layout), the cue and the spin
// circle. Pure drawing, no state. There are no people anywhere in the art: a cue, a small lit bridge marker and the balls.
import { TW, TL, R, MID_X, BAULK_Y, D_R, SPOT, GEOM, JAWS, POCKETS } from './sim.js';
import { MARGIN } from './cam.js';
import { W, H } from './layout.js';

const TAU = Math.PI * 2;
export const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- host (off-screen surfaces) ------------------------------------------------------------------------------------------
let hostDoc = null;
export function setHost(ctx) {
  if (hostDoc || typeof OffscreenCanvas !== 'undefined') return;
  const d = ctx && ctx.canvas && ctx.canvas.ownerDocument;
  if (d && typeof d.createElement === 'function') hostDoc = d;
}
export const canBake = () => typeof OffscreenCanvas !== 'undefined' || hostDoc !== null;
export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  if (hostDoc) { const c = hostDoc.createElement('canvas'); c.width = w; c.height = h; return c; }
  return null;
}

// ---- balls -----------------------------------------------------------------------------------------------------------------
export const BALL = {
  0: { main: '#f6f2e4', hi: '#ffffff', dark: '#b9b39c', name: 'White' },
  red: { main: '#cf2220', hi: '#ff7b6d', dark: '#6e0d0d', name: 'Red' },
  16: { main: '#efc72f', hi: '#fff3a0', dark: '#9a7608', name: 'Yellow' },
  17: { main: '#169a52', hi: '#6df0a4', dark: '#07502a', name: 'Green' },
  18: { main: '#8a5428', hi: '#d79a62', dark: '#40230d', name: 'Brown' },
  19: { main: '#2d63d8', hi: '#8fb5ff', dark: '#0f2f78', name: 'Blue' },
  20: { main: '#f08cb0', hi: '#ffd0e2', dark: '#a8456f', name: 'Pink' },
  21: { main: '#26262c', hi: '#8a8a96', dark: '#050507', name: 'Black' },
};
export const ballStyle = (id) => (id >= 1 && id <= 15 ? BALL.red : BALL[id] ?? BALL.red);

// A lit sphere. (X, Y) screen centre, r radius in px. mark: [mx, my, mz] the spin mark on the surface (optional).
export function drawBall(ctx, X, Y, r, id, o = {}) {
  const st = ballStyle(id);
  const { alpha = 1, mark = null, glow = 0, ghost = false } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (ghost) {
    ctx.globalAlpha = alpha * 0.55;
    ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fillStyle = st.main; ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.12); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.stroke();
    ctx.restore();
    return;
  }
  if (glow > 0) {
    const g = ctx.createRadialGradient(X, Y, r * 0.8, X, Y, r * 2.1);
    g.addColorStop(0, `rgba(255,236,150,${0.55 * glow})`); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 2.1, 0, TAU); ctx.fill();
  }
  const g = ctx.createRadialGradient(X - r * 0.36, Y - r * 0.42, r * 0.08, X + r * 0.1, Y + r * 0.12, r * 1.12);
  g.addColorStop(0, st.hi); g.addColorStop(0.35, st.main); g.addColorStop(1, st.dark);
  ctx.beginPath(); ctx.arc(X, Y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  if (mark) {
    const [mx, my, mz] = mark;
    if (mz > -0.15) {
      const k = Math.min(1, (mz + 0.15) / 0.5);
      const px = X + mx * r * 0.92, py = Y - my * r * 0.75 - (mz > 0 ? 0 : 0);
      ctx.globalAlpha = alpha * k * 0.9;
      ctx.fillStyle = id === 0 ? '#c8261f' : id === 21 ? '#d9d9e6' : 'rgba(255,255,255,0.78)';
      ctx.beginPath(); ctx.ellipse(px, py, r * 0.17, r * 0.17 * (0.5 + 0.5 * Math.abs(mz)), 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = alpha;
    }
  }
  // crisp specular spot
  const sp = ctx.createRadialGradient(X - r * 0.4, Y - r * 0.46, 0, X - r * 0.4, Y - r * 0.46, r * 0.4);
  sp.addColorStop(0, 'rgba(255,255,255,0.85)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sp; ctx.beginPath(); ctx.arc(X - r * 0.4, Y - r * 0.46, r * 0.4, 0, TAU); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(X, Y, r - 0.5, 0, TAU); ctx.stroke();
  ctx.restore();
}
export function drawShadow(ctx, X, Y, r, k = 0.8, a = 0.38) {
  ctx.save();
  ctx.translate(X + r * 0.28, Y + r * 0.34);
  ctx.scale(1, k);
  const g = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.25);
  g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.25, 0, TAU); ctx.fill();
  ctx.restore();
}

// flat little ball for the scoreboard and the Rules pages
export function drawBallIcon(ctx, x, y, r, id, dim = false) {
  drawBall(ctx, x, y, r, id, { alpha: dim ? 0.3 : 1 });
}

// ---- the spin circle: the cue ball face with the tip marker ------------------------------------------------------------------
export function drawSpinFace(ctx, cx, cy, r, a, b, o = {}) {
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f1ecd8'); g.addColorStop(1, '#bdb6a0');
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = o.edge ?? 'rgba(30,50,40,0.8)'; ctx.stroke();
  // guide rings and cross hair
  ctx.strokeStyle = 'rgba(40,60,50,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, TAU); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
  // the tip marker
  const px = cx + a * r * 0.86, py = cy - b * r * 0.86;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.arc(px + 2, py + 3, r * 0.15, 0, TAU); ctx.fill();
  const hg = ctx.createRadialGradient(px - r * 0.04, py - r * 0.05, 1, px, py, r * 0.16);
  hg.addColorStop(0, '#ff8a76'); hg.addColorStop(1, '#c21f1f');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(px, py, r * 0.15, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#6e0d0d'; ctx.stroke();
  if (o.labels) {
    ctx.fillStyle = 'rgba(30,50,40,0.75)'; ctx.font = `700 ${Math.round(r * 0.2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('top', cx, cy - r * 0.9); ctx.fillText('draw', cx, cy + r * 0.9);
  }
  ctx.restore();
}

// ---- the table (static) ------------------------------------------------------------------------------------------------------------
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
const rectPts = (cam, x0, y0, x1, y1, z = 0) => [cam.px(x0, y0, z), cam.px(x1, y0, z), cam.px(x1, y1, z), cam.px(x0, y1, z)];
function circlePts(cam, cx, cy, r, n = 28, z = 0) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; out.push(cam.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z)); }
  return out;
}

export const CLOTH = { base: '#0c6a3b', light: '#17894d', dark: '#064a28', nap: 'rgba(255,255,255,0.025)' };

export function drawTable(ctx, cam) {
  const M = MARGIN, CB = 0.058;          // rail width, cushion top width
  // room: soft vignette and the shadow the table throws on the floor
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1a14'); bg.addColorStop(0.5, '#0c1f18'); bg.addColorStop(1, '#07120d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const fl = rectPts(cam, -M - 0.05, -M - 0.05, TW + M + 0.05, TL + M + 0.06, -0.12);
  poly(ctx, fl); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
  // front face of the rail (the table's side, visible towards the player)
  const face = [cam.px(-M, -M, 0), cam.px(TW + M, -M, 0), cam.px(TW + M, -M, -0.1), cam.px(-M, -M, -0.1)];
  poly(ctx, face); const fg = ctx.createLinearGradient(0, face[0][1], 0, face[2][1]); fg.addColorStop(0, '#4a260f'); fg.addColorStop(1, '#2a1408'); ctx.fillStyle = fg; ctx.fill();
  const sideFace = (sgn) => [cam.px(sgn * (TW + 2 * M) / 2 + TW / 2, -M, 0), cam.px(sgn * (TW + 2 * M) / 2 + TW / 2, TL + M, 0), cam.px(sgn * (TW + 2 * M) / 2 + TW / 2, TL + M, -0.1), cam.px(sgn * (TW + 2 * M) / 2 + TW / 2, -M, -0.1)];
  for (const s of [-1, 1]) { poly(ctx, sideFace(s)); ctx.fillStyle = '#35190a'; ctx.fill(); }
  // wooden rail (top surface)
  const rail = rectPts(cam, -M, -M, TW + M, TL + M);
  poly(ctx, rail);
  const wg = ctx.createLinearGradient(0, rail[2][1], 0, rail[0][1] > rail[2][1] ? rail[0][1] : rail[2][1] + 400);
  const wy0 = Math.min(rail[2][1], rail[3][1]), wy1 = Math.max(rail[0][1], rail[1][1]);
  const wg2 = ctx.createLinearGradient(0, wy0, 0, wy1);
  wg2.addColorStop(0, '#6b3a1a'); wg2.addColorStop(0.5, '#7d4521'); wg2.addColorStop(1, '#8c4f27');
  void wg;
  ctx.fillStyle = wg2; ctx.fill();
  // wood grain: long faint strokes along the rails
  const r = lcg(31);
  ctx.save(); poly(ctx, rail); ctx.clip();
  ctx.lineWidth = 1;
  for (let i = 0; i < 140; i++) {
    const side = r() < 0.5, t = r() * (TL + 2 * M) - M, off = r() * M - M;
    const a = side ? cam.px(off, t) : cam.px(TW - off - 0, t);
    const len = 0.25 + r() * 0.6;
    const b = side ? cam.px(off, t + len) : cam.px(TW - off, t + len);
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,200,140,0.07)' : 'rgba(30,10,0,0.14)';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    const near = r() < 0.5, off = r() * M, s = r() * TW;
    const y0 = near ? -off : TL + off;
    const a = cam.px(s, y0), b = cam.px(s + 0.3 + r() * 0.5, y0);
    ctx.strokeStyle = r() < 0.5 ? 'rgba(255,200,140,0.07)' : 'rgba(30,10,0,0.14)';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  ctx.restore();
  // rail highlights
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,214,160,0.35)'; poly(ctx, rail); ctx.stroke();
  // diamonds on the rails
  ctx.fillStyle = 'rgba(244,236,214,0.9)';
  const dia = (x, y) => { const [X, Y] = cam.px(x, y, 0.001); const s = Math.max(2.2, cam.ballR(Math.max(0.1, Math.min(TL, y))) * 0.2); ctx.beginPath(); ctx.moveTo(X, Y - s); ctx.lineTo(X + s * 1.25, Y); ctx.lineTo(X, Y + s); ctx.lineTo(X - s * 1.25, Y); ctx.closePath(); ctx.fill(); };
  for (let i = 1; i < 8; i++) if (i !== 4) for (const y of [-(M - CB) / 2 - CB / 2 + 0.004, TL + (M - CB) / 2 + CB / 2 - 0.004]) dia(TW * i / 8, y);
  for (let i = 1; i < 8; i++) for (const x of [-(M - CB) / 2 - CB / 2 + 0.004, TW + (M - CB) / 2 + CB / 2 - 0.004]) { if (i % 2 === 0 || true) dia(x, TL * i / 8 + (i === 4 ? 0 : 0)); }
  // cushion band (top surface of the rubber)
  const cushion = (pts) => {
    poly(ctx, pts);
    ctx.fillStyle = '#0a5a32'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.stroke();
  };
  const { CE, MG } = GEOM;
  cushion(rectPts(cam, CE, -CB, TW - CE, 0));
  cushion(rectPts(cam, CE, TL, TW - CE, TL + CB));
  for (const [x0, x1] of [[-CB, 0], [TW, TW + CB]]) {
    cushion(rectPts(cam, x0, CE, x1, TL / 2 - MG / 2));
    cushion(rectPts(cam, x0, TL / 2 + MG / 2, x1, TL - CE));
  }
  // cloth
  const cl = rectPts(cam, 0, 0, TW, TL);
  poly(ctx, cl);
  const cg = ctx.createLinearGradient(0, cam.px(0, TL)[1], 0, cam.px(0, 0)[1]);
  cg.addColorStop(0, CLOTH.dark); cg.addColorStop(0.5, CLOTH.base); cg.addColorStop(1, '#0e7a44');
  ctx.fillStyle = cg; ctx.fill();
  ctx.save(); poly(ctx, cl); ctx.clip();
  const lc = cam.px(MID_X, TL * 0.42);
  const lg = ctx.createRadialGradient(lc[0], lc[1], 20, lc[0], lc[1], 520);
  lg.addColorStop(0, 'rgba(120,255,170,0.20)'); lg.addColorStop(0.6, 'rgba(60,200,120,0.06)'); lg.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
  // nap: faint lengthwise strokes in world space
  const rr = lcg(99);
  for (let i = 0; i < 520; i++) {
    const x = rr() * TW, y = rr() * TL, len = 0.05 + rr() * 0.12;
    const a = cam.px(x, y), b = cam.px(x + (rr() - 0.5) * 0.01, y + len);
    ctx.strokeStyle = rr() < 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  // markings
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = Math.max(1.2, cam.scaleAt(BAULK_Y) * 0.012);
  const b0 = cam.px(0, BAULK_Y), b1 = cam.px(TW, BAULK_Y);
  ctx.beginPath(); ctx.moveTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) { const a = Math.PI + (i / 48) * Math.PI; const p = cam.px(MID_X + Math.cos(a) * D_R, BAULK_Y + Math.sin(a) * D_R); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.stroke();
  // spots
  for (const id of [16, 17, 18, 19, 20, 21]) {
    const p = cam.px(SPOT[id].x, SPOT[id].y), rs = Math.max(1.6, cam.ballR(SPOT[id].y) * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(p[0], p[1], rs, 0, TAU); ctx.fill();
  }
  ctx.restore();
  // raised cushions: a soft shadow on the cloth, the sloped rubber face, the nose and the top of the rubber, so the rails have depth
  {
    const ZN = 0.034, BACK = 0.012;
    const seg = (x0, y0, x1, y1, nx, ny) => {
      const P = (x, y, z) => cam.px(x, y, z);
      for (const [wd, al] of [[0.05, 0.07], [0.034, 0.09], [0.018, 0.12], [0.008, 0.16]]) {
        poly(ctx, [P(x0, y0, 0), P(x1, y1, 0), P(x1 + nx * wd, y1 + ny * wd, 0), P(x0 + nx * wd, y0 + ny * wd, 0)]); ctx.fillStyle = `rgba(0,18,8,${al})`; ctx.fill();
      }
      const ax = x0 - nx * BACK, ay = y0 - ny * BACK, bx = x1 - nx * BACK, by = y1 - ny * BACK;
      const face = [P(x0, y0, 0.002), P(x1, y1, 0.002), P(bx, by, ZN), P(ax, ay, ZN)];
      poly(ctx, face);
      const fy0 = Math.min(face[0][1], face[2][1]), fy1 = Math.max(face[0][1], face[2][1]);
      const fgl = ctx.createLinearGradient(0, fy0, 0, fy1 + 0.01); const lit = ny > 0 ? 0 : 1;
      fgl.addColorStop(lit, '#0f7b44'); fgl.addColorStop(1 - lit, '#075a30'); ctx.fillStyle = Math.abs(ny) > 0.5 ? fgl : (nx > 0 ? '#0c6a3a' : '#095f33'); ctx.fill();
      const top = [P(ax, ay, ZN), P(bx, by, ZN), P(bx - nx * CB, by - ny * CB, ZN), P(ax - nx * CB, ay - ny * CB, ZN)];
      poly(ctx, top); ctx.fillStyle = '#0a5f34'; ctx.fill();
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(205,255,225,0.55)'; ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(top[1][0], top[1][1]); ctx.stroke();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.moveTo(top[3][0], top[3][1]); ctx.lineTo(top[2][0], top[2][1]); ctx.stroke();
    };
    seg(CE, TL, TW - CE, TL, 0, -1);                                     // far cushion first: it is behind the side ones in the picture
    for (const [x, nx] of [[0, 1], [TW, -1]]) { seg(x, TL - CE, x, TL / 2 + MG / 2, nx, 0); seg(x, TL / 2 - MG / 2, x, CE, nx, 0); }
    seg(CE, 0, TW - CE, 0, 0, 1);
  }
  // cushion nose highlight
  ctx.strokeStyle = 'rgba(190,255,215,0.5)'; ctx.lineWidth = 1.5;
  const nose = (a, b) => { const p = cam.px(a[0], a[1]), q = cam.px(b[0], b[1]); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); };
  nose([CE, 0], [TW - CE, 0]); nose([CE, TL], [TW - CE, TL]);
  for (const x of [0, TW]) { nose([x, CE], [x, TL / 2 - MG / 2]); nose([x, TL / 2 + MG / 2], [x, TL - CE]); }
  // pockets: dark holes with a leather ring, jaws on top
  for (const p of POCKETS) {
    const rp = p.kind === 'c' ? 0.085 : 0.07;
    const cxp = p.kind === 'c' ? (p.x < 0.5 ? -0.012 : TW + 0.012) : (p.x < 0.5 ? -0.03 : TW + 0.03);
    const cyp = p.kind === 'c' ? (p.y < 0.5 ? -0.012 : TL + 0.012) : p.y;
    poly(ctx, circlePts(cam, cxp, cyp, rp + 0.012, 30)); ctx.fillStyle = '#2a1608'; ctx.fill();
    const pc = cam.px(cxp, cyp), prr = cam.ballR(Math.max(0.1, Math.min(TL, cyp))) * 2.1;
    poly(ctx, circlePts(cam, cxp, cyp, rp, 30)); const pg = ctx.createRadialGradient(pc[0], pc[1] - prr * 0.25, 2, pc[0], pc[1], prr); pg.addColorStop(0, '#000'); pg.addColorStop(0.7, '#050403'); pg.addColorStop(1, '#1c1109'); ctx.fillStyle = pg; ctx.fill();
  }
  for (const j of JAWS) {
    poly(ctx, circlePts(cam, j.x, j.y, GEOM.RK + 0.001, 14)); ctx.fillStyle = '#0a5a32'; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(190,255,215,0.45)'; ctx.stroke();
  }
  // brass pocket plates
  ctx.strokeStyle = 'rgba(214,170,80,0.85)'; ctx.lineWidth = 2;
  for (const p of POCKETS) {
    const rp = p.kind === 'c' ? 0.097 : 0.082;
    const cxp = p.kind === 'c' ? (p.x < 0.5 ? -0.012 : TW + 0.012) : (p.x < 0.5 ? -0.03 : TW + 0.03);
    const cyp = p.kind === 'c' ? (p.y < 0.5 ? -0.012 : TL + 0.012) : p.y;
    const pts = circlePts(cam, cxp, cyp, rp, 30);
    ctx.save(); poly(ctx, rail); ctx.clip(); poly(ctx, pts); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,170,0.55)'; ctx.lineWidth = 1; poly(ctx, circlePts(cam, cxp, cyp, rp + 0.004, 30)); ctx.stroke(); ctx.strokeStyle = 'rgba(214,170,80,0.85)'; ctx.lineWidth = 2; ctx.restore();
  }
  // inner edge of the wooden rail: a thin dark bevel where wood meets rubber
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(25,10,0,0.55)'; poly(ctx, rectPts(cam, -CB - 0.003, -CB - 0.003, TW + CB + 0.003, TL + CB + 0.003)); ctx.stroke();
}

// bake the whole static table into one surface (one blit per frame afterwards)
const bakes = new Map();
export function bakedTable(ctx, cam, key) {
  setHost(ctx);
  if (bakes.has(key)) return bakes.get(key);
  const cv = canBake() ? makeCanvas(W, H) : null;
  if (!cv) return null;
  const c2 = cv.getContext('2d');
  drawTable(c2, cam);
  if (bakes.size >= 4) bakes.delete(bakes.keys().next().value);
  bakes.set(key, cv);
  return cv;
}
export function clearBake() { bakes.clear(); }

// ---- the cue ---------------------------------------------------------------------------------------------------------------------------
// Draws the cue in perspective: tip at distance `gap` behind the cue ball centre along -dir, rising slightly towards the butt.
export function drawCue(ctx, cam, cx, cy, ang, gap, o = {}) {
  const { alpha = 1, len = 1.45, lift = 0.22 } = o;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const seg = (t0, t1, w0, w1, c0, c1) => {
    // t is distance behind the tip; z rises linearly with t
    const pt = (t, side) => { const px = cx - dx * (gap + t) + (-dy) * side, py = cy - dy * (gap + t) + dx * side; return cam.px(px, py, R + lift * ((gap + t) / len)); };
    const q = [pt(t0, -w0), pt(t1, -w1), pt(t1, w1), pt(t0, w0)];
    ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    const a = cam.px(cx - dx * (gap + t0), cy - dy * (gap + t0), R), b = cam.px(cx - dx * (gap + t1), cy - dy * (gap + t1), R);
    const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, c0); g.addColorStop(1, c1);
    ctx.fillStyle = g; ctx.fill();
  };
  ctx.save();
  ctx.globalAlpha = alpha;
  // soft shadow on the cloth
  const s0 = cam.px(cx - dx * gap, cy - dy * gap, 0), s1 = cam.px(cx - dx * (gap + len), cy - dy * (gap + len), 0);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = Math.max(2, cam.scaleAt(cy) * 0.03); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s0[0] + 3, s0[1] + 5); ctx.lineTo(s1[0] + 6, s1[1] + 12); ctx.stroke();
  seg(0, 0.012, 0.0048, 0.0052, '#3a78d8', '#2a5fb8');            // chalked tip
  seg(0.012, 0.03, 0.0052, 0.0056, '#f4efe0', '#e9e2cc');         // ferrule
  seg(0.03, 0.62, 0.0056, 0.0105, '#f0d9a6', '#d8b074');          // ash shaft
  seg(0.62, 0.64, 0.0106, 0.0108, '#b8903a', '#8c6a22');          // joint ring
  seg(0.64, len, 0.0108, 0.0165, '#5c3217', '#2a1408');           // butt
  ctx.restore();
}

// a small lit bridge marker: where the supporting hand would rest (a simple lit ring, no hand drawn)
export function drawBridge(ctx, cam, cx, cy, ang, dist, alpha = 1) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const x = cx - dx * dist, y = cy - dy * dist;
  const [X, Y] = cam.px(x, y, 0.004), r = Math.max(7, cam.scaleAt(y) * 0.05);
  ctx.save(); ctx.globalAlpha = alpha * 0.9;
  const g = ctx.createRadialGradient(X, Y, r * 0.2, X, Y, r * 1.6);
  g.addColorStop(0, 'rgba(255,230,150,0.55)'); g.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(X, Y, r * 1.6, r * 1.1, 0, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(255,236,170,0.95)';
  ctx.beginPath(); ctx.ellipse(X, Y, r, r * 0.65, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  ctx.restore();
}
