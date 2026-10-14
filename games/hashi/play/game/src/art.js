// The archipelago: sea, islands and plank bridges. One renderer used by the play screen, the result screen, the title and every
// Rules figure, so what the pages show is exactly what the game draws.
import { theme, mix, rgba, rr, txt, F } from './ui.js';
import { remAll, islandStatus } from './hashi.js';
import { pt, cellPx, is3d, PLAQUE_Y, DECK_Y } from './v3.js';

const TAU = Math.PI * 2;

export function drawSea(ctx, r, t = 0, calm = false, radius = 24) {
  const T = theme();
  ctx.save();
  rr(ctx, r.x - 2, r.y + 3, r.w + 4, r.h + 3, radius + 2); ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.clip();
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, T.water0); g.addColorStop(1, T.water1);
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // slow light bands + wave lines (cheap: a few sine strokes)
  const ph = calm ? 0 : t * 0.5, rows = Math.max(5, Math.round(r.h / 70));
  ctx.lineWidth = Math.max(1.5, r.w * 0.003); ctx.strokeStyle = T.wave; ctx.lineCap = 'round';
  for (let k = 0; k < rows; k++) {
    const y0 = r.y + ((k + 0.5) / rows) * r.h, amp = r.h * 0.006 + 1.5, step = Math.max(14, r.w / 28), off = k * 1.7 + ph * (k % 2 ? 1 : -1);
    ctx.beginPath();
    for (let x = r.x; x <= r.x + r.w + step; x += step) { const y = y0 + Math.sin(x / (r.w * 0.09) + off) * amp; if (x === r.x) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(k * 2.1 + ph * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const v = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.4, r.w * 0.25, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.8);
  v.addColorStop(0, 'rgba(255,255,255,0.07)'); v.addColorStop(1, 'rgba(0,0,0,0.20)');
  ctx.fillStyle = v; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  rr(ctx, r.x, r.y, r.w, r.h, radius); ctx.lineWidth = Math.max(2.5, r.w * 0.007); ctx.strokeStyle = T.rim; ctx.stroke();
}

// One plank run along +x from 0 to len, centred on y. `w` is the plank width. shadowOnly draws just a flat dark shape.
function planks(ctx, len, w, T, tint, alpha = 1, shadowOnly = false) {
  if (shadowOnly) { ctx.save(); ctx.globalAlpha = 0.30 * alpha; rr(ctx, 0, -w / 2, len, w, w * 0.18); ctx.fillStyle = '#001018'; ctx.fill(); ctx.restore(); return; }
  const slat = Math.max(7, w * 0.78);
  const col = tint ? mix(T.plank, tint, 0.55) : T.plank, dark = tint ? mix(T.plankDark, tint, 0.45) : T.plankDark, hi = tint ? mix(T.plankHi, tint, 0.45) : T.plankHi;
  ctx.save(); ctx.globalAlpha = alpha;
  const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  g.addColorStop(0, hi); g.addColorStop(0.5, col); g.addColorStop(1, dark);
  rr(ctx, 0, -w / 2, len, w, w * 0.16); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.07); ctx.strokeStyle = rgba(dark, 0.55);
  for (let x = slat; x < len - slat * 0.4; x += slat) { ctx.beginPath(); ctx.moveTo(x, -w / 2 + 1); ctx.lineTo(x, w / 2 - 1); ctx.stroke(); }
  ctx.lineWidth = Math.max(1.2, w * 0.1); ctx.strokeStyle = T.rail;
  ctx.beginPath(); ctx.moveTo(0, -w / 2); ctx.lineTo(len, -w / 2); ctx.moveTo(0, w / 2); ctx.lineTo(len, w / 2); ctx.stroke();
  ctx.restore();
}

// A bridge between two island centres. count 1 or 2. grow 0..1 draws it growing from the first island. kind tints it.
export function drawBridge(ctx, a, b, count, s, R, { grow = 1, tint = null, alpha = 1 } = {}) {
  const T = theme(), dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), len = Math.max(0, d - 2 * R * 0.78);
  if (len <= 0 || count <= 0) return;
  const ang = Math.atan2(dy, dx), L = len * Math.max(0.02, grow), sh = Math.max(2, s * 0.07);
  for (const pass of [0, 1]) {
    ctx.save();
    if (pass === 0) ctx.translate(sh * 0.5, sh);          // shadow falls down and right on the water, in screen space
    ctx.translate(a.x, a.y); ctx.rotate(ang); ctx.translate(R * 0.78, 0);
    if (count === 1) planks(ctx, L, s * 0.25, T, tint, alpha, pass === 0);
    else {
      const w = s * 0.17, off = s * 0.14;
      ctx.save(); ctx.translate(0, -off); planks(ctx, L, w, T, tint, alpha, pass === 0); ctx.restore();
      ctx.save(); ctx.translate(0, off); planks(ctx, L, w, T, tint, alpha, pass === 0); ctx.restore();
    }
    ctx.restore();
  }
}

export function drawIsland(ctx, p, R, label, { status = 'open', sel = false, hot = false, pop = 0, shake = 0, t = 0, dim = false } = {}) {
  const T = theme(), k = pop > 0 && pop < 0.3 ? 1 + 0.22 * Math.sin((Math.PI * pop) / 0.3) : 1, dx = shake > 0 && shake < 0.4 ? Math.sin(shake * 60) * R * 0.1 * (1 - shake / 0.4) : 0;
  const x = p.x + dx, y = p.y, r = R * k;
  ctx.save();
  if (dim) ctx.globalAlpha = 0.55;
  // ripple + shadow
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.28, r * 1.18, r * 1.02, 0, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.05, y + r * 0.2, r * 1.04, r * 0.98, 0, 0, TAU); ctx.fillStyle = 'rgba(0,15,25,0.30)'; ctx.fill();
  // body: side (depth) then face
  const face = status === 'full' ? mix(T.sand, T.done, 0.62) : status === 'over' ? mix(T.sand, T.err, 0.5) : T.sand;
  const side = status === 'full' ? mix(T.sandSide, T.done, 0.7) : T.sandSide;
  ctx.beginPath(); ctx.arc(x, y + r * 0.13, r, 0, TAU); ctx.fillStyle = side; ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, mix(face, '#ffffff', 0.45)); g.addColorStop(0.65, face); g.addColorStop(1, mix(face, '#000000', 0.12));
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  // grass fringe (a broken ring in the lower-left, like a shoreline)
  if (status !== 'full') { ctx.beginPath(); ctx.arc(x, y, r * 0.93, Math.PI * 0.55, Math.PI * 1.15); ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.strokeStyle = rgba(T.grass, 0.85); ctx.stroke(); }
  if (status === 'full') { ctx.beginPath(); ctx.arc(x, y, r * 1.12, 0, TAU); ctx.lineWidth = Math.max(2, r * 0.12); ctx.strokeStyle = rgba('#ffe28a', 0.55 + 0.2 * Math.sin(t * 3)); ctx.stroke(); }
  if (status === 'over') { ctx.beginPath(); ctx.arc(x, y, r * 1.08, 0, TAU); ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.strokeStyle = T.err; ctx.stroke(); }
  if (hot) { ctx.beginPath(); ctx.arc(x, y, r * 1.2 + Math.sin(t * 5) * r * 0.06, 0, TAU); ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.strokeStyle = '#3fe0b8'; ctx.stroke(); }
  if (sel) { ctx.beginPath(); ctx.arc(x, y, r * 1.14, 0, TAU); ctx.lineWidth = Math.max(3, r * 0.16); ctx.strokeStyle = T.sel; ctx.stroke(); }
  txt(ctx, label, x, y + r * 0.06, { size: r * 1.15, weight: 700, color: status === 'full' ? T.doneInk : status === 'over' ? T.err : T.ink, align: 'center' });
  ctx.restore();
}

// Draw the whole archipelago. st = { br, cap }. opts:
//   t, calm, numbers 'target'|'remaining', check 'off'|'conflicts'|'check', sol (for check mode), sel (island), targets Set<edge>,
//   focus Set<island>, lanes Map<edge, 'place'|'forbid'|'look'>, ghost Map<edge, count>, fx { grow, pop, shake, wave, blink }, win (0..1), plain (no sea)
//   world: true when the 3D presenter draws the sea, islands and bridges and this layer only adds numbers and marks on top of them.
export function drawArchipelago(ctx, geo, P, st, o = {}) {
  const T = theme(), s = geo.s, R = s * 0.37, t = o.t ?? 0, fx = o.fx ?? {}, rem = remAll(P, st.br);
  const world = !!o.world && is3d(geo);
  if (!world && !o.plain) drawSea(ctx, geo.rect, t, o.calm, geo.size * 0.04);
  const pos = world ? (i) => pt(geo, P.isl[i].x, P.isl[i].y, DECK_Y) : (i) => ({ x: geo.cx(P.isl[i].x), y: geo.cy(P.isl[i].y) });
  if (!world) {
    // lattice dots
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) if (P.at[y * P.w + x] < 0) { ctx.beginPath(); ctx.arc(geo.cx(x), geo.cy(y), Math.max(1.4, s * 0.045), 0, TAU); ctx.fill(); }
    // lanes the player may add to (selected island): faint dashed guide
    if (o.targets) {
      ctx.save(); ctx.setLineDash([s * 0.16, s * 0.14]); ctx.lineWidth = Math.max(2, s * 0.06); ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineCap = 'round';
      for (const e of o.targets) { const a = pos(P.ea[e]), b = pos(P.eb[e]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      ctx.restore();
    }
    // ghost previews from hints
    if (o.ghost) for (const [e, n] of o.ghost) { const a = pos(P.ea[e]), b = pos(P.eb[e]); drawBridge(ctx, a, b, n, s, R, { tint: '#3fe0b8', alpha: 0.55 + 0.25 * Math.sin(t * 5) }); }
    // bridges
    for (let e = 0; e < P.E; e++) {
      const n = st.br[e];
      if (!n) continue;
      const a = pos(P.ea[e]), b = pos(P.eb[e]);
      let tint = null;
      const bad = o.check && o.check !== 'off' && ((o.check === 'check' && o.sol && n > o.sol[e]) || (rem[P.ea[e]] < 0 || rem[P.eb[e]] < 0));
      if (bad) tint = T.err;
      if (fx.blink && fx.blink.e === e && fx.blink.t < 0.5) tint = T.err;
      drawBridge(ctx, a, b, n, s, R, { grow: fx.grow ? Math.min(1, fx.grow[e] / 0.2) : 1, tint });
    }
  }
  // lane marks: proved empty (x) and hint marks
  const mark = (e, kind) => {
    const a = pos(P.ea[e]), b = pos(P.eb[e]), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, r = (world ? cellPx(geo) : s) * 0.2;
    ctx.save();
    if (kind === 'forbid' || kind === 'limit') {
      ctx.beginPath(); ctx.arc(mx, my, r, 0, TAU); ctx.fillStyle = kind === 'forbid' ? T.err : 'rgba(10,20,30,0.55)'; ctx.fill();
      ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round'; ctx.strokeStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(mx - r * 0.42, my - r * 0.42); ctx.lineTo(mx + r * 0.42, my + r * 0.42); ctx.moveTo(mx + r * 0.42, my - r * 0.42); ctx.lineTo(mx - r * 0.42, my + r * 0.42); ctx.stroke();
    } else if (kind === 'look') {
      ctx.beginPath(); ctx.arc(mx, my, r * (0.8 + 0.12 * Math.sin(t * 5)), 0, TAU); ctx.lineWidth = Math.max(2.5, s * 0.08); ctx.strokeStyle = '#3fe0b8'; ctx.stroke();
    }
    ctx.restore();
  };
  for (let e = 0; e < P.E; e++) if (st.cap[e] < 2 && st.cap[e] <= st.br[e] && !(o.lanes && o.lanes.has(e))) mark(e, 'limit');
  if (o.lanes) for (const [e, k] of o.lanes) if (k === 'forbid' || k === 'look') mark(e, k);
  // islands on top (world: only the carved numbers; the 3D presenter draws the stone)
  for (let i = 0; i < P.n; i++) {
    const stt = islandStatus(P, st.br, i);
    const wv = fx.wave ? fx.wave[i] : 99, wl = wv > 0 && wv < 0.55 ? Math.sin((Math.PI * wv) / 0.55) : 0;
    const label = o.numbers === 'remaining' ? Math.max(0, rem[i]) : P.isl[i].n;
    const status = o.check === 'off' && stt === 'over' ? 'open' : stt;
    if (world) {
      const pw = fx.pop ? fx.pop[i] : 0, sh = fx.shake ? fx.shake[i] : 0;
      const k = pw > 0 && pw < 0.3 ? 1 + 0.22 * Math.sin((Math.PI * pw) / 0.3) : 1, dx = sh > 0 && sh < 0.4 ? Math.sin(sh * 60) * 0.037 * (1 - sh / 0.4) : 0;
      const p = pt(geo, P.isl[i].x + dx, P.isl[i].y, PLAQUE_Y + 0.13 * wl + 0.01), u = cellPx(geo);
      drawLabel(ctx, p, u * 0.6 * k, label, status, !!(o.focus && o.focus.has(i)), t);
      continue;
    }
    const p = pos(i);
    drawIsland(ctx, wl ? { x: p.x, y: p.y - R * 0.35 * wl } : p, R, label, {
      status, sel: o.sel === i, hot: !!(o.focus && o.focus.has(i)),
      pop: fx.pop ? fx.pop[i] : 0, shake: fx.shake ? fx.shake[i] : 0, t, dim: false,
    });
  }
}

// A carved numeral on a 3D plaque: ink with a thin light edge below so it reads as cut into the stone.
function drawLabel(ctx, p, size, label, status, hot, t) {
  const T = theme(), col = status === 'full' ? T.doneInk : status === 'over' ? T.err : T.ink;
  ctx.save();
  txt(ctx, label, p.x + size * 0.03, p.y + size * 0.05, { size, weight: 700, color: status === 'full' ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)', align: 'center' });
  txt(ctx, label, p.x, p.y, { size, weight: 700, color: col, align: 'center' });
  ctx.restore();
}

// Bridge hit test: nearest lane (with bridges) to a point, within `tol`.
export function laneAt(geo, P, st, px, py, tol) {
  let best = -1, bd = tol;
  for (let e = 0; e < P.E; e++) {
    if (!st.br[e]) continue;
    const A = pt(geo, P.isl[P.ea[e]].x, P.isl[P.ea[e]].y, DECK_Y), Bp = pt(geo, P.isl[P.eb[e]].x, P.isl[P.eb[e]].y, DECK_Y);
    const ax = A.x, ay = A.y, bx = Bp.x, by = Bp.y;
    const vx = bx - ax, vy = by - ay, l2 = vx * vx + vy * vy, u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / l2));
    const d = Math.hypot(px - (ax + u * vx), py - (ay + u * vy));
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
export function islandAt(geo, P, px, py, tol = 0.55) {
  let best = -1, bd = cellPx(geo) * tol;
  for (let i = 0; i < P.n; i++) {
    const c = pt(geo, P.isl[i].x, P.isl[i].y, PLAQUE_Y), d = Math.hypot(px - c.x, py - c.y);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
