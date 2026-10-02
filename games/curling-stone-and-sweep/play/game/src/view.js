// Drawing for the play screen: the ice (fixed, never scrolls), stones, sweeping brushes, aim guide, scoreboard and
// control bar. Pure: reads `state`, never mutates it. Menus and pages live in menus.js. All text follows the 100-300%
// text size setting; the ice region shrinks to make room instead of clipping.
import { R, HALF_W, HOG_FAR, HOG_NEAR, BACK, HOUSE_R, BUTTON_R, FOUR_R, EIGHT_R, NEAR_TEE, toButton } from './sim.js';
import { TEAM, drawStone, drawBrushes, startIceBake, TILE_M, setHost, canBake, lcg } from './art.js';
import { W, H, TEXT_SCALES, playLayout, inRect } from './layout.js';
import { FONT, C, roundPath, drawButton, panel, wrapLines } from './ui.js';
import { WEIGHTS } from './match.js';

const TAU = Math.PI * 2;
const SHOT_MODE = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
export const AIM_TOP = BACK + 0.5;

// ---- baked ice tile ------------------------------------------------------------------------------------------------
let iceJob = null, iceTile = null, icePat = null;
function ensureIce(ctx) {
  setHost(ctx);
  if (iceTile) return iceTile;
  if (!canBake()) return false;
  if (!iceJob) iceJob = startIceBake();
  if (iceJob.failed) return false;
  const r = iceJob.step(SHOT_MODE);
  if (r) iceTile = r;
  return iceTile ?? null;
}

// ---- camera -------------------------------------------------------------------------------------------------------------
export function textScale(state) { return TEXT_SCALES[state.settings.textIdx]; }
export function layoutFor(state) {
  const m = state.m;
  const kind = m && m.cfg.mode === 'watch' ? 'watch' : state.ctl === 'fly' ? 'fly' : state.ctl === 'score' ? 'score' : 'aim';
  return playLayout(textScale(state), kind);
}
// Fixed view (the playing surface never moves). A real sheet is ~45 m long and 4.75 m wide, so the lengthwise map is a smooth curve:
// the on-screen scale is constant over the house and its guard area (rings are true circles), then eases down smoothly (a
// smoothstep, so there is no jump in the scale or its slope) to a small constant over the long run-up to the delivery end. A
// stone's on-screen speed is therefore always real speed times a smoothly varying, monotonically falling scale. Across the sheet
// the scale is uniform (ppm, the house scale). Only the drawing map is non-linear; the physics stays in real metres.
export const VIEW_TOP = BACK + 0.55, VIEW_BOT = HOG_NEAR - 1.05;
const T0 = 4.6, TW = 10, TE = 0.12;        // uniform zone length (m), easing length (m), far-end scale as a fraction of the house scale
const shape = (t) => { if (t <= T0) return 1; const u = Math.min(1, (t - T0) / TW); return 1 - (1 - TE) * u * u * (3 - 2 * u); };
// Relative on-screen scale at world y (1 over the house, falling to TE): game.js paces the slide by its inverse, so on-screen speed
// is exactly proportional to real speed along the whole path.
export const lengthShape = (y) => shape(Math.max(0, VIEW_TOP - y));
export function makeCam(state, lay0) {
  // Always built from the tallest-controls layout (aim), whatever the phase, so the sheet never shifts when the control bar changes.
  const lay = playLayout(textScale(state), 'aim');
  void lay0;
  const rh = lay.regionBottom - lay.regionTop, top = lay.regionTop;
  const L = VIEW_TOP - VIEW_BOT;
  const A = (t) => {                          // exact integral of shape, any t >= 0
    if (t <= T0) return t;
    const d = t - T0;
    if (d <= TW) { const u = d / TW; return T0 + d - (1 - TE) * TW * (u * u * u - u * u * u * u / 2); }
    return T0 + TW - (1 - TE) * TW * 0.5 + (d - TW) * TE;
  };
  const s0 = rh / A(L);                        // px per metre over the house
  const Y = (y) => top + s0 * A(VIEW_TOP - y);
  const yAt = (py) => { const target = (py - top) / s0; let lo = -5, hi = 80; for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (A(Math.max(0, mid)) + Math.min(0, mid) < target) lo = mid; else hi = mid; } return VIEW_TOP - (lo + hi) / 2; };
  const sy = (y) => s0 * shape(Math.max(0, VIEW_TOP - y));   // px per metre lengthwise at world y
  const ppm = Math.min(112, s0);
  return { ppm, top, rh, bottom: lay.regionBottom, X: (x) => W / 2 + x * ppm, Y, yAt, sy };
}
export function camToWorld(cam, sx, sy) { return { x: (sx - W / 2) / cam.ppm, y: cam.yAt(sy) }; }

// The rings follow the lengthwise map (each ring is a polygon through X/Y), so a stone on a ring edge sits exactly on the ring.
function drawHouseMapped(ctx, cam) {
  const ring = (r, fill, edge) => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, x = cam.X(Math.cos(a) * r), y = cam.Y(Math.sin(a) * r); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(1, cam.ppm * 0.012); ctx.strokeStyle = edge; ctx.stroke();
  };
  ring(HOUSE_R, 'rgba(38,104,186,0.80)', 'rgba(14,52,110,0.65)');
  ring(EIGHT_R, 'rgba(246,251,255,0.93)', 'rgba(120,160,200,0.7)');
  ring(FOUR_R, 'rgba(204,48,46,0.86)', 'rgba(110,20,20,0.6)');
  ring(BUTTON_R, 'rgba(250,253,255,0.98)', 'rgba(120,160,200,0.7)');
}

// ---- the ice ------------------------------------------------------------------------------------------------------------------
export function drawIce(ctx, cam, state) {
  const { X, Y, ppm } = cam;
  ctx.fillStyle = '#08121f'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d2036'); bg.addColorStop(1, '#091727');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const x0 = X(-HALF_W), x1 = X(HALF_W);
  const yEndTop = Y(AIM_TOP_END), yEndBot = Y(-37.2);
  const yLoW = -37.2, yHiW = AIM_TOP_END;
  const top = Math.max(-4, yEndTop), bot = Math.min(H + 4, yEndBot);
  if (bot > top) {
    // boards on both sides
    for (const [bx, dir] of [[x0, -1], [x1, 1]]) {
      const g = ctx.createLinearGradient(bx, 0, bx + dir * 26, 0);
      g.addColorStop(0, '#2a4056'); g.addColorStop(1, '#0c1826');
      ctx.fillStyle = g; ctx.fillRect(dir < 0 ? bx - 26 : bx, top, 26, bot - top);
      ctx.fillStyle = 'rgba(190,225,255,0.5)'; ctx.fillRect(dir < 0 ? bx - 2 : bx, top, 2, bot - top);
    }
    // ice base
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#b9d6ea'); g.addColorStop(0.18, '#dcedf8'); g.addColorStop(0.5, '#e9f4fb'); g.addColorStop(0.82, '#dcedf8'); g.addColorStop(1, '#b9d6ea');
    ctx.fillStyle = g; ctx.fillRect(x0, top, x1 - x0, bot - top);
    // pebble and frost, tied to the ice (fixed)
    const tile = ensureIce(ctx);
    if (tile) {
      if (!icePat) icePat = ctx.createPattern(tile, 'repeat');
      if (icePat) {
        const s = (ppm * TILE_M) / 512;
        ctx.save(); ctx.beginPath(); ctx.rect(x0, top, x1 - x0, bot - top); ctx.clip();
        ctx.translate(X(0), Y(0)); ctx.scale(s, s);
        ctx.fillStyle = icePat; ctx.globalAlpha = 0.9;
        ctx.fillRect((x0 - X(0)) / s, (top - Y(0)) / s, (x1 - x0) / s, (bot - top) / s);
        ctx.restore();
      }
    }
    ctx.save(); ctx.beginPath(); ctx.rect(x0, top, x1 - x0, bot - top); ctx.clip();
    // hairline scratches in world chunks
    const yHi = yHiW, yLo = yLoW;
    for (let c = Math.floor(yLo / 4) - 1; c <= Math.ceil(yHi / 4); c++) {
      const r = lcg((c + 400) * 2654435761);
      for (let i = 0; i < 7; i++) {
        const sx = (r() - 0.5) * 2 * HALF_W, sy = c * 4 + r() * 4, len = 0.8 + r() * 3, a = Math.PI / 2 + (r() - 0.5) * 0.35;
        ctx.strokeStyle = r() < 0.5 ? `rgba(255,255,255,${0.2 + r() * 0.2})` : `rgba(90,130,170,${0.1 + r() * 0.12})`;
        ctx.lineWidth = 0.8 + r() * 1.1;
        ctx.beginPath(); ctx.moveTo(X(sx), Y(sy)); ctx.lineTo(X(sx + Math.cos(a) * len * 0.35), Y(sy + Math.sin(a) * len)); ctx.stroke();
      }
    }
    // lines
    const line = (y, col, wm) => { ctx.fillStyle = col; ctx.fillRect(x0, Y(y) - wm * ppm / 2, x1 - x0, Math.max(1.5, wm * ppm)); };
    ctx.fillStyle = 'rgba(40,88,150,0.42)'; ctx.fillRect(X(0) - 1, top, 2, bot - top);
    line(0, 'rgba(40,88,150,0.5)', 0.025); line(BACK, 'rgba(40,88,150,0.45)', 0.025);
    line(HOG_FAR, 'rgba(204,52,48,0.8)', 0.1); line(HOG_NEAR, 'rgba(204,52,48,0.8)', 0.1);
    drawHouseMapped(ctx, cam);
    // the free guard zone, faintly
    if (state.showFgz) {
      ctx.fillStyle = 'rgba(255,255,255,0.0)';
    }
    // soft lights reflected in the ice (fixed on screen, a touch of parallax)
    const par = 0;
    for (const [lx, ly, lr, a] of [[210, 230 - par * 0.2, 260, 0.2], [530, 760 - par * 0.3, 300, 0.16], [260, 1120 - par * 0.1, 240, 0.12]]) {
      const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
      lg.addColorStop(0, `rgba(255,255,255,${a})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = lg; ctx.fillRect(x0, top, x1 - x0, bot - top);
    }
    ctx.restore();
    // the end board
    if (yEndTop > -2) { ctx.fillStyle = '#16293f'; ctx.fillRect(x0 - 26, yEndTop - 30, x1 - x0 + 52, 30); ctx.fillStyle = 'rgba(190,225,255,0.4)'; ctx.fillRect(x0, yEndTop - 2, x1 - x0, 2); }
  }
  // vignette keeps the eye on the centre
  const vg = ctx.createLinearGradient(0, 0, 0, H);
  vg.addColorStop(0, 'rgba(4,12,24,0.35)'); vg.addColorStop(0.2, 'rgba(4,12,24,0)'); vg.addColorStop(0.8, 'rgba(4,12,24,0)'); vg.addColorStop(1, 'rgba(4,12,24,0.4)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
const AIM_TOP_END = BACK + 0.55;

// Smooth motion: while a delivery runs, game.js keeps for every stone the displayed position/turn at the previous update (d0*)
// and at this update (d*), already placed at the sub-step fraction of the fixed physics step. Drawing blends the two by the time
// since the last update, so motion is continuous at any display rate. Everything here is drawing only.
export function dispOf(state, s) {
  const al = state && state.alpha !== undefined ? state.alpha : 1;
  if (!state || !state.fl || !state.m || state.m.phase !== 'fly' || s.dx === undefined) return { x: s.x, y: s.y, a: s.ang };
  const k = s.d0x === undefined ? 1 : al;
  const x0 = s.d0x ?? s.dx, y0 = s.d0y ?? s.dy, a0 = s.d0a ?? s.da;
  return { x: x0 + (s.dx - x0) * k, y: y0 + (s.dy - y0) * k, a: a0 + (s.da - a0) * k };
}
const lerpAng = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * k; };

// ---- stones, trail, brushes, particles ---------------------------------------------------------------------------------------
export function drawStones(ctx, cam, state, w, o = {}) {
  const rpx = R * cam.ppm;
  const hl = o.highlight ?? null;
  for (const s of w.stones) {
    if (s.mode === 'out' && s.out > 0.9) continue;
    const dp = dispOf(state, s);
    const x = cam.X(dp.x), y = cam.Y(dp.y);
    if (y < -60 || y > H + 60) continue;
    let a = 1, k = 1;
    if (s.mode === 'out') { a = Math.max(0, 1 - s.out / 0.9); k = 1 + s.out * 0.25; }
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > 0.3 && s.mode === 'play') {
      const hxp = s.vx * cam.ppm, hyp = -s.vy * cam.sy(s.y), hn = Math.hypot(hxp, hyp) || 1;
      const len = Math.min(1.1, sp * 0.2) * cam.ppm, nx = hxp / hn, ny = hyp / hn;
      const g = ctx.createLinearGradient(x, y, x - nx * len, y - ny * len);
      g.addColorStop(0, `rgba(255,255,255,${(0.4 * Math.min(1, (sp - 0.3) / 0.6)).toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = rpx * 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - nx * len, y - ny * len); ctx.stroke();
    }
    const gl = hl && hl.has(s.id) ? 0.55 + 0.35 * Math.sin(state.t * 6) : (s.heat ?? 0);
    drawStone(ctx, x, y, rpx * k, s.team, -dp.a, { a, glow: gl, speck: s.id });
  }
}

export function drawTrail(ctx, cam, state) {
  const tr = state.trail;
  if (!tr || tr.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(60,100,150,0.16)'; ctx.lineWidth = Math.max(1.5, R * cam.ppm * 0.5);
  ctx.beginPath();
  tr.forEach((p, i) => { const x = cam.X(p[0]), y = cam.Y(p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  if (state.fl && state.w) { const fs = state.w.stones.find((q) => q.id === state.fl.id); if (fs) { const d = dispOf(state, fs); ctx.lineTo(cam.X(d.x), cam.Y(d.y)); } }
  ctx.stroke();
  // where it was swept the ice is polished and brighter
  let open = false;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass === 0 ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = pass === 0 ? R * cam.ppm * 2.2 : R * cam.ppm * 0.6;
    ctx.beginPath(); open = false;
    for (let i = 0; i < tr.length; i++) {
      const p = tr[i];
      if (p[2] > 0.18) { const x = cam.X(p[0]), y = cam.Y(p[1]); if (!open) { ctx.moveTo(x, y); open = true; } else ctx.lineTo(x, y); } else open = false;
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawFlightBrushes(ctx, cam, state) {
  const f = state.fl, b = f && f.b;
  if (!b || b.a < 0.01 || state.m.phase !== 'fly') return;
  const al = state.alpha ?? 1, k = b.x0 === undefined ? 1 : al;
  const L = (p, q) => (b[p + '0'] ?? b[q]) + (b[q] - (b[p + '0'] ?? b[q])) * k;
  const bx = L('x', 'x'), by = L('y', 'y'), ph = L('ph', 'ph'), amp = L('amp', 'amp'), fade = L('a', 'a');
  const ang = lerpAng(b.ang0 ?? b.ang, b.ang, k);
  // heading on screen: world heading pushed through the fixed map, so the heads turn smoothly with the stone's path
  const hxw = Math.cos(ang), hyw = Math.sin(ang);
  const hxp = hxw * cam.ppm, hyp = -hyw * cam.sy(by), hn = Math.hypot(hxp, hyp) || 1;
  drawBrushes(ctx, cam.X(bx), cam.Y(by), hxp / hn, hyp / hn, cam.ppm, amp, ph, f.team, fade);
}

export function drawParts(ctx, cam, parts) {
  for (const q of parts) {
    const k = 1 - q.t / q.max, x = cam.X(q.x), y = cam.Y(q.y);
    if (q.kind === 2) {   // expanding ring
      ctx.strokeStyle = q.col; ctx.globalAlpha = Math.max(0, k) * 0.8; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, q.size * (1 - k * 0.7) * cam.ppm / 100, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.3));
      ctx.fillStyle = q.col;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.8, q.size * (0.5 + k * 0.6)), 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

// ---- aim guide -------------------------------------------------------------------------------------------------------------------
export function drawAim(ctx, cam, state) {
  const a = state.aim;
  if (!a || !a.placed) return;
  const tx = cam.X(a.x), ty = cam.Y(a.y), rpx = R * cam.ppm;
  const pv = state.pv;
  ctx.save();
  if (pv && pv.path) {
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 9]); ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); pv.path.forEach((p, i) => { const x = cam.X(p[0]), y = cam.Y(p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
    ctx.setLineDash([]); ctx.strokeStyle = 'rgba(30,90,170,0.35)'; ctx.lineWidth = 8;
    ctx.beginPath(); pv.path.forEach((p, i) => { const x = cam.X(p[0]), y = cam.Y(p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }); ctx.stroke();
    if (pv.end) {
      const ex = cam.X(pv.end.x), ey = cam.Y(pv.end.y);
      drawStone(ctx, ex, ey, rpx, state.m.turn, 0.6, { a: 0.5, ghost: true });
      ctx.lineWidth = 2.5; ctx.strokeStyle = pv.end.kind === 'contact' ? 'rgba(255,170,60,0.95)' : pv.end.kind === 'out' ? 'rgba(255,90,70,0.95)' : 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(ex, ey, rpx * 1.35, 0, TAU); ctx.stroke();
    }
  }
  if (state.finalPreview) for (const g of state.finalPreview) drawStone(ctx, cam.X(g.x), cam.Y(g.y), rpx, g.team, 0.5, { a: 0.5, ghost: true });
  // the broom: where the thrower is aiming. A flat brush head with a pole, drawn as an object.
  const pulse = 1 + Math.sin(state.t * 5) * 0.05;
  ctx.strokeStyle = 'rgba(25,60,110,0.85)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tx, ty, rpx * 1.9 * pulse, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(tx, ty, rpx * 1.9 * pulse + 2, 0, TAU); ctx.stroke();
  const bw = 0.62 * cam.ppm, bh = 0.17 * cam.ppm;
  ctx.strokeStyle = '#1b2b3d'; ctx.lineWidth = Math.max(3, cam.ppm * 0.03); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(tx, ty + bh * 0.5); ctx.lineTo(tx + cam.ppm * 0.15, ty + cam.ppm * 1.7); ctx.stroke();
  ctx.fillStyle = 'rgba(8,24,44,0.3)'; roundPath(ctx, tx - bw / 2 + 3, ty - bh / 2 + 5, bw, bh, bh * 0.4); ctx.fill();
  ctx.fillStyle = '#1d2c3c'; roundPath(ctx, tx - bw / 2, ty - bh / 2, bw, bh, bh * 0.4); ctx.fill();
  ctx.fillStyle = TEAM[state.m.turn].main; roundPath(ctx, tx - bw / 2 + 2, ty - bh / 2 + 2, bw - 4, bh * 0.45, bh * 0.2); ctx.fill();
  ctx.restore();
}

// ---- text helpers ------------------------------------------------------------------------------------------------------------------
export function fit(ctx, text, maxW, size, weight = 700, minK = 0.5) {
  let px = size;
  ctx.font = `${weight} ${px}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && px > size * minK) { px -= 1; ctx.font = `${weight} ${px}px ${FONT}`; }
  return px;
}
function pips(ctx, x, y, n, total, team, r) {
  for (let i = 0; i < total; i++) {
    const cx = x + i * (r * 2.5);
    ctx.beginPath(); ctx.arc(cx, y, r, 0, TAU);
    if (i < n) { ctx.fillStyle = TEAM[team].main; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke(); } else { ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(180,210,235,0.45)'; ctx.stroke(); }
  }
  return total * r * 2.5;
}

// ---- scoreboard --------------------------------------------------------------------------------------------------------------------
export function drawHud(ctx, state, lay) {
  const m = state.m, hud = lay.hud, sc = textScale(state), fs = hud.fs;
  const names = state.names;
  const total = m.fmt.perSide;
  const panelFill = 'rgba(8,22,40,0.86)';
  const left = (t) => total - m.thrown[t];
  const endTxt = m.cfg.mode === 'lesson' ? 'Lesson' : `End ${m.end} of ${m.ends}`;
  const lastTxt = m.cfg.mode === 'lesson' ? '' : `Last stone: ${m.hammer === 0 ? names[0] : names[1]}`;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if (!hud.stacked) {
    const cards = [{ x: 12, w: 262, t: 0 }, { x: 446, w: 262, t: 1 }];
    for (const c of cards) {
      const turn = m.turn === c.t && m.phase !== 'score' && m.phase !== 'over';
      roundPath(ctx, c.x, hud.y, c.w, hud.h, 20 * Math.min(sc, 1.2)); ctx.fillStyle = panelFill; ctx.fill();
      ctx.lineWidth = turn ? 3 : 1.5; ctx.strokeStyle = turn ? TEAM[c.t].tint : 'rgba(150,190,225,0.4)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(c.x + 22, hud.y + hud.h * 0.3, 8 * Math.min(sc, 1.25), 0, TAU); ctx.fillStyle = TEAM[c.t].main; ctx.fill();
      const nameX = c.x + 38 * Math.min(sc, 1.25);
      fit(ctx, names[c.t], c.w - (nameX - c.x) - 70 * Math.min(sc, 1.25), fs, 700, 0.55);
      ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.fillText(names[c.t], nameX, hud.y + hud.h * 0.38);
      const sf = Math.round(46 * Math.min(sc, 1.25));
      ctx.font = `800 ${sf}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff'; ctx.fillText(String(m.scores[c.t]), c.x + c.w - 14, hud.y + hud.h * 0.42);
      pips(ctx, c.x + 22, hud.y + hud.h * 0.8, left(c.t), total, c.t, 5.5 * Math.min(sc, 1.3));
    }
    const cw = 152, cx0 = 12 + 262 + 10;
    roundPath(ctx, cx0, hud.y, cw, hud.h, 20 * Math.min(sc, 1.2)); ctx.fillStyle = panelFill; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(150,190,225,0.4)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = C.text;
    fit(ctx, endTxt, cw - 12, fs * 1.05, 800, 0.5); ctx.fillText(endTxt, cx0 + cw / 2, hud.y + hud.h * 0.58);
    if (lastTxt) { ctx.fillStyle = C.gold; fit(ctx, lastTxt, cw - 10, fs * 0.72, 600, 0.5); ctx.fillText(lastTxt, cx0 + cw / 2, hud.y + hud.h * 0.86); }
  } else {
    const rowH = hud.row, pad = 12;
    roundPath(ctx, 10, hud.y, W - 20, hud.h, 22); ctx.fillStyle = panelFill; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(150,190,225,0.4)'; ctx.stroke();
    let y = hud.y + pad;
    // row 1: end and last stone
    const half = (W - 40) * 0.42;
    ctx.textAlign = 'left'; ctx.fillStyle = C.text;
    const px1 = fit(ctx, endTxt, half, fs * 1.0, 800, 0.5); ctx.fillText(endTxt, 24, y + rowH * 0.72);
    if (lastTxt) {
      ctx.textAlign = 'right'; ctx.fillStyle = C.gold;
      const room = W - 24 - 24 - ctx.measureText(endTxt).width - 14;
      fit(ctx, lastTxt, Math.max(120, room), fs * 0.8, 600, 0.4); ctx.fillText(lastTxt, W - 24, y + rowH * 0.72);
    }
    void px1;
    y += rowH;
    for (const t of [0, 1]) {
      const turn = m.turn === t && m.phase !== 'score' && m.phase !== 'over';
      if (turn) { roundPath(ctx, 16, y + 2, W - 32, rowH - 4, 14); ctx.strokeStyle = TEAM[t].tint; ctx.lineWidth = 2.5; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(34, y + rowH * 0.5, fs * 0.22, 0, TAU); ctx.fillStyle = TEAM[t].main; ctx.fill();
      ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(fs * 1.25)}px ${FONT}`; ctx.fillText(String(m.scores[t]), W - 28, y + rowH * 0.72);
      const scoreW = ctx.measureText(String(m.scores[t])).width;
      const pw = Math.min(total, 8) * fs * 0.28 * 2.5 / 2.2;
      ctx.textAlign = 'left'; ctx.fillStyle = C.text;
      fit(ctx, names[t], W - 28 - scoreW - 34 - 24 - Math.min(pw, 180), fs, 700, 0.5); ctx.fillText(names[t], 34 + fs * 0.4, y + rowH * 0.72);
      const nw = ctx.measureText(names[t]).width;
      pips(ctx, 34 + fs * 0.4 + nw + 16, y + rowH * 0.52, left(t), total, t, Math.max(4, fs * 0.13));
      y += rowH;
    }
  }
  ctx.restore();
}

// ---- control bar -------------------------------------------------------------------------------------------------------------------
function caption(ctx, text, x, y, w, size, col = C.text, align = 'center') {
  ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  fit(ctx, text, w, size, 700, 0.45);
  ctx.fillText(text, align === 'center' ? x + w / 2 : x, y);
}
export function drawControls(ctx, state, lay) {
  const c = lay.ctrl, fs = lay.fs, kind = state.ctl;
  const m = state.m;
  // bar background
  const g = ctx.createLinearGradient(0, c.top - 24, 0, c.top + 24);
  g.addColorStop(0, 'rgba(6,18,34,0)'); g.addColorStop(1, 'rgba(6,18,34,0.94)');
  ctx.fillStyle = g; ctx.fillRect(0, c.top - 24, W, 24);
  ctx.fillStyle = 'rgba(6,18,34,0.94)'; ctx.fillRect(0, c.top, W, H - c.top);
  ctx.save();
  if (m.cfg.mode === 'watch') {
    const wl = state.wlabel ?? '';
    caption(ctx, wl, 14, c.labelY + c.labelH * 0.8, W - 28, fs * 0.8, C.soft);
    drawButton(ctx, c.pause, state.paused ? 'Resume' : 'Pause', { primary: state.paused, size: fs });
    drawButton(ctx, c.dec, c.dec.w > 200 ? 'Think −' : 'Think −', { dark: true, size: fs * 0.85 });
    drawButton(ctx, c.inc, 'Think +', { dark: true, size: fs * 0.85 });
    drawButton(ctx, c.exit, 'Leave', { dark: true, size: fs * 0.8 });
  } else if (kind === 'aim') {
    const human = state.humanTurn;
    if (c.inline) {
      c.chips.forEach((r, i) => drawButton(ctx, r, WEIGHTS[i].name, { active: state.aim.w === i, dark: state.aim.w !== i, disabled: !human || !state.weightsOk[i], size: fs * 0.92 }));
      const hand = state.settings.left ? -1 : 1;
      drawButton(ctx, c.turn[0], 'In-turn', { sub: hand > 0 ? 'curls right' : 'curls left', active: state.aim.turn === 1, dark: state.aim.turn !== 1, disabled: !human, size: fs * 0.9 });
      drawButton(ctx, c.turn[1], 'Out-turn', { sub: hand > 0 ? 'curls left' : 'curls right', active: state.aim.turn === -1, dark: state.aim.turn !== -1, disabled: !human, size: fs * 0.9 });
      drawButton(ctx, c.think, state.hintBusy ? 'Thinking…' : 'Think', { dark: true, disabled: !human, size: fs });
      drawButton(ctx, c.throw, 'Throw', { primary: true, disabled: !human || !state.aim.placed, size: fs * 1.15 });
      drawButton(ctx, c.menu, 'Menu', { dark: true, size: fs * 0.9 });
    } else {
      const wt = WEIGHTS[state.aim.w];
      caption(ctx, `${wt.name} · ${state.aim.turn === 1 ? 'In-turn' : 'Out-turn'}`, 14, c.capY + c.capH * 0.82, W - 28, fs * 0.9, C.text);
      drawButton(ctx, c.shot, 'Shot', { dark: true, disabled: !human, size: fs });
      drawButton(ctx, c.think, state.hintBusy ? 'Thinking…' : 'Think', { dark: true, disabled: !human, size: fs });
      drawButton(ctx, c.throw, 'Throw', { primary: true, disabled: !human || !state.aim.placed, size: fs });
      drawButton(ctx, c.menu, 'Menu', { dark: true, size: fs });
    }
  } else if (kind === 'fly') {
    const f = state.fl, e = f ? f.disp : 0;
    const who = state.humanSweeps ? 'Sweep: rub the ice' : (state.names[m.turn] === 'You' ? 'Your sweepers are working' : `${state.names[m.turn]}'s sweepers are working`);
    caption(ctx, who, 14, c.labelY + c.labelH * 0.8, W - 28 - 120, fs * 0.9, C.text, 'left');
    ctx.textAlign = 'right'; ctx.fillStyle = C.gold; fit(ctx, `${Math.round(e * 100)}%`, 110, fs * 0.9, 800, 0.5); ctx.fillText(`${Math.round(e * 100)}%`, W - 20, c.labelY + c.labelH * 0.8);
    const r = c.meter;
    roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.fillStyle = 'rgba(160,200,235,0.18)'; ctx.fill();
    const wv = Math.max(r.h, r.w * e);
    roundPath(ctx, r.x, r.y, wv, r.h, r.h / 2);
    const gg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0); gg.addColorStop(0, '#41c9ff'); gg.addColorStop(1, '#ffffff');
    ctx.fillStyle = e > 0.02 ? gg : 'rgba(160,200,235,0.3)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(190,225,255,0.6)'; roundPath(ctx, r.x, r.y, r.w, r.h, r.h / 2); ctx.stroke();
    drawButton(ctx, c.pause, state.paused ? 'Resume' : 'Pause', { dark: !state.paused, primary: state.paused, size: fs * 0.95 });
    drawButton(ctx, c.fast, 'Hold: faster', { dark: true, size: fs * 0.8 });
  } else if (kind === 'score') {
    const info = m.endInfo;
    const txt = info ? (info.team === null ? 'Blank end: nobody scores' : `${state.names[info.team]} ${state.names[info.team] === 'You' ? 'score' : 'scores'} ${info.pts}${info.steal ? ' (a steal)' : ''}`) : '';
    caption(ctx, txt, 14, c.titleY + c.titleH * 0.82, W - 28, fs * 1.15, '#ffffff');
    const sub = info && info.team !== null ? `${info.pts === 1 ? '1 stone' : info.pts + ' stones'} closer than any of the other side` : 'No stone is in the house';
    caption(ctx, sub, 14, c.subY + c.subH * 0.78, W - 28, fs * 0.72, C.soft);
    drawButton(ctx, c.go, m.end >= m.ends && state.m.scores[0] !== state.m.scores[1] ? 'See the result' : 'Next end', { primary: true, size: fs });
  }
  ctx.restore();
}

// ---- toast and reason card --------------------------------------------------------------------------------------------
export function drawToast(ctx, state, lay) {
  if (!state.toast || state.toastT <= 0) return;
  const sc = Math.min(textScale(state), 2.2), fs = Math.round(24 * sc);
  ctx.save();
  ctx.font = `700 ${fs}px ${FONT}`;
  const lines = wrapLines(ctx, state.toast, W - 90).slice(0, 4);
  const h = lines.length * fs * 1.28 + 24, y = lay.regionTop + 10;
  ctx.globalAlpha = Math.min(1, state.toastT * 2.5);
  roundPath(ctx, 24, y, W - 48, h, 18); ctx.fillStyle = 'rgba(8,22,40,0.92)'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(160,205,240,0.5)'; ctx.stroke();
  ctx.fillStyle = '#f2f9ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 12 + fs * (0.95 + i * 1.28)));
  ctx.restore();
}

// The reason card (Think and Watch & Learn). Shows as much as fits at the chosen text size; tap it to read all.
export function cardRect(state, lay) {
  const k = state.card;
  if (!k) return null;
  const sc = textScale(state), fs = Math.round(22 * Math.min(sc, 3));
  const maxH = Math.max(150, (lay.regionBottom - lay.regionTop) * (sc >= 2 ? 0.34 : 0.46));
  const lines = Math.ceil((k.text.length * fs * 0.54) / (W - 80)) + 1;
  const h = Math.min(maxH, Math.round(fs * 1.12 * 1.6 + lines * fs * 1.3 + 26));
  return { x: 18, y: lay.regionBottom - h - 6, w: W - 36, h, fs };
}
export function drawCard(ctx, state, lay) {
  const k = state.card, r = cardRect(state, lay);
  if (!k || !r) return;
  ctx.save();
  panel(ctx, r.x, r.y, r.w, r.h, { r: 22, fill: 'rgba(8,24,44,0.94)', stroke: 'rgba(140,200,245,0.6)' });
  ctx.beginPath(); ctx.rect(r.x + 8, r.y + 4, r.w - 16, r.h - 8); ctx.clip();
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${Math.round(r.fs * 1.12)}px ${FONT}`; ctx.fillStyle = C.gold;
  let y = r.y + 14 + r.fs * 1.05;
  ctx.fillText(k.title, r.x + 22, y);
  ctx.font = `500 ${r.fs}px ${FONT}`; ctx.fillStyle = C.text;
  const lines = wrapLines(ctx, k.text, r.w - 44);
  let shown = 0;
  for (const l of lines) {
    y += r.fs * 1.3;
    if (y > r.y + r.h - 10 - (lines.length > shown + 1 ? r.fs * 1.2 : 0)) break;
    ctx.fillText(l, r.x + 22, y); shown++;
  }
  if (shown < lines.length) { ctx.fillStyle = C.gold; ctx.font = `700 ${Math.round(r.fs * 0.85)}px ${FONT}`; ctx.fillText('Tap to read all', r.x + 22, r.y + r.h - 12); }
  ctx.restore();
}

// ---- scoring highlight ---------------------------------------------------------------------------------------------------------------------
export function drawScoreMarks(ctx, cam, state) {
  const info = state.m.endInfo;
  if (!info || state.m.phase !== 'score') return;
  const bx = cam.X(0), by = cam.Y(0);
  const fs = Math.round(22 * Math.min(textScale(state), 2));
  ctx.save();
  let n = 0;
  for (const id of info.order) {
    const s = state.w.stones.find((q) => q.id === id);
    if (!s) continue;
    const counted = info.counted.includes(id);
    const x = cam.X(s.x), y = cam.Y(s.y);
    ctx.strokeStyle = counted ? '#ffffff' : 'rgba(180,210,235,0.35)'; ctx.lineWidth = counted ? 2 : 1; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke(); ctx.setLineDash([]);
    if (counted) {
      n++;
      ctx.beginPath(); ctx.arc(x, y, R * cam.ppm * (1.5 + Math.sin(state.t * 6) * 0.1), 0, TAU); ctx.strokeStyle = TEAM[s.team].tint; ctx.lineWidth = 3; ctx.stroke();
      roundPath(ctx, x - fs * 0.7, y - R * cam.ppm - fs * 1.7, fs * 1.4, fs * 1.4, fs * 0.7); ctx.fillStyle = 'rgba(8,22,40,0.92)'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${fs}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), x, y - R * cam.ppm - fs * 1.0);
    }
    void toButton; void HOUSE_R;
  }
  ctx.restore();
}

export function drawPops(ctx, cam, state) {
  for (const p of state.pops) {
    const k = p.t / p.max, x = cam.X(p.x), y = cam.Y(p.y) - k * 60;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - k * k);
    ctx.font = `800 ${Math.round(p.size * Math.min(textScale(state), 2))}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(6,20,40,0.85)'; ctx.strokeText(p.text, x, y);
    ctx.fillStyle = p.col; ctx.fillText(p.text, x, y);
    ctx.restore();
  }
}

// ---- the whole play screen ------------------------------------------------------------------------------------------------------------------------
export function renderPlay(ctx, state) {
  const lay = layoutFor(state);
  const cam = makeCam(state, lay);
  state.cam.lay = lay; state.cam.ppm = cam.ppm;
  drawIce(ctx, cam, state);
  drawTrail(ctx, cam, state);
  if (state.ctl === 'aim' && state.aim.placed) drawAim(ctx, cam, state);
  drawStones(ctx, cam, state, state.w, { highlight: state.hl });
  drawFlightBrushes(ctx, cam, state);
  drawParts(ctx, cam, state.parts);
  drawScoreMarks(ctx, cam, state);
  drawPops(ctx, cam, state);
  drawHud(ctx, state, lay);
  drawControls(ctx, state, lay);
  drawCard(ctx, state, lay);
  drawToast(ctx, state, lay);
}

// The ice for menus: a house view with the attract world.
export function drawAttract(ctx, state, ppm = 105, yTop = 2.2, top = 40) {
  const cam = { ppm, top, X: (x) => W / 2 + x * ppm, Y: (y) => top + (yTop - y) * ppm, yAt: (sy) => yTop - (sy - top) / ppm, sy: () => ppm };
  drawIce(ctx, cam, state);
  const a = state.att;
  if (a) {
    drawTrail(ctx, cam, { trail: a.trail });
    drawStones(ctx, cam, { t: state.t }, a.w);
    if (a.fl) drawBrushes(ctx, cam.X(a.fl.x), cam.Y(a.fl.y), 0, -1, ppm, 0.14 + 0.3 * a.fl.eff, a.fl.phase, a.fl.team, 1);
    drawParts(ctx, cam, a.parts);
  }
}
void inRect; void HOG_NEAR;
