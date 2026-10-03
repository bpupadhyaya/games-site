// Drawing for the swept yard, the hole, the chalk circle, the pebbles, the throwing stone, the glass-ring hand, routes and
// particles. Pure canvas drawing. World units: the yard is 660 x 800, the stones are R units in radius.
import { R, GHO_R, PIT, YARD_R, HOME } from './sim.js';
import { roundPath } from './ui.js';

const TAU = Math.PI * 2;

// ---- a tiny seeded generator for the fixed ground texture (never touches the game's own random numbers) ----------
let seed = 20261003;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

export const STONE_PAL = [
  { hi: '#f4eee0', mid: '#cfc4ae', lo: '#8a7f6a', dot: 'rgba(90,80,64,0.35)', name: 'Quartz' },
  { hi: '#e7b79a', mid: '#bd7650', lo: '#7a4228', dot: 'rgba(70,32,16,0.32)', name: 'Terracotta' },
  { hi: '#c5ced8', mid: '#7f8fa3', lo: '#46536a', dot: 'rgba(30,40,56,0.3)', name: 'Slate' },
  { hi: '#e9e0c0', mid: '#c4b078', lo: '#8a763a', dot: 'rgba(80,66,28,0.3)', name: 'Sandstone' },
  { hi: '#bdb7b0', mid: '#6e6862', lo: '#35312d', dot: 'rgba(15,12,10,0.38)', name: 'Basalt' },
  { hi: '#d8e2c4', mid: '#93a67a', lo: '#56673f', dot: 'rgba(36,50,24,0.3)', name: 'Moss' },
  { hi: '#f1cdc4', mid: '#d29a8f', lo: '#92574f', dot: 'rgba(90,40,34,0.28)', name: 'Rose' },
  { hi: '#e0d6c8', mid: '#a89a86', lo: '#625748', dot: 'rgba(50,42,32,0.34)', name: 'Granite' },
  { hi: '#f0d9a6', mid: '#d3a24e', lo: '#8a5f1c', dot: 'rgba(90,56,10,0.3)', name: 'Amber' },
  { hi: '#c9d6d2', mid: '#7ea29a', lo: '#436862', dot: 'rgba(24,52,48,0.3)', name: 'Jade' },
];

// ---- the ground -------------------------------------------------------------------------------------------------------
const GW = 720, GH = 1280;
const BLOTCH = Array.from({ length: 16 }, () => ({ x: rnd() * GW, y: rnd() * GH, r: 90 + rnd() * 240, light: rnd() < 0.55, a: 0.05 + rnd() * 0.07 }));
const ARCS = Array.from({ length: 150 }, () => {
  const fan = Math.floor(rnd() * 6), cx = [-260, 980, 360, -420, 1100, 360][fan], cy = [300, 420, 1700, 1000, 900, -520][fan];
  const r = 330 + rnd() * 760, a0 = rnd() * TAU, sp = 0.12 + rnd() * 0.5;
  return { cx, cy, r, a0, a1: a0 + sp, w: 0.8 + rnd() * 1.9, light: rnd() < 0.58 };
});
const ARC_BATCH = [[true, 0, 1.4], [true, 1.4, 2.2], [true, 2.2, 9], [false, 0, 1.4], [false, 1.4, 2.2], [false, 2.2, 9]];
const SPECKS = Array.from({ length: 420 }, () => ({ x: rnd() * GW, y: rnd() * GH, r: 0.6 + rnd() * 1.7, tone: rnd() }));
const GRAVEL = Array.from({ length: 46 }, () => ({ x: rnd() * GW, y: rnd() * GH, rx: 3 + rnd() * 6, ry: 2 + rnd() * 4, a: rnd() * 3, tone: rnd() }));
const TUFTS = [[26, 90], [694, 150], [18, 560], [706, 700], [30, 1180], [690, 1220], [360, 1262], [60, 1010]].map(([x, y]) => ({ x, y, n: 5 + Math.floor(rnd() * 3), s: 0.8 + rnd() * 0.5, seed: rnd() * 10 }));
const CHALK_N = 150;
const CHALK = Array.from({ length: 3 }, () => Array.from({ length: CHALK_N }, () => (rnd() - 0.5) * 3.2));
const CHALK_DUST = Array.from({ length: 70 }, () => ({ a: rnd() * TAU, off: (rnd() - 0.5) * 16, r: 0.7 + rnd() * 1.6, al: 0.15 + rnd() * 0.3 }));

export function drawFloor(ctx, W = GW, H = GH) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c98e55'); g.addColorStop(0.5, '#bb8049'); g.addColorStop(1, '#a96e3b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (const b of BLOTCH) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    const c = b.light ? '255,226,180' : '92,48,20';
    rg.addColorStop(0, `rgba(${c},${b.a})`); rg.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = rg; ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
  // broom sweeps: faint arcs in fans (batched into a few strokes)
  ctx.save(); ctx.lineCap = 'round';
  for (const [light, wMin, wMax] of ARC_BATCH) {
    ctx.strokeStyle = light ? 'rgba(246,214,168,0.16)' : 'rgba(96,52,24,0.14)'; ctx.lineWidth = (wMin + wMax) / 2; ctx.beginPath();
    for (const a of ARCS) { if (a.light !== light || a.w < wMin || a.w >= wMax) continue; ctx.moveTo(a.cx + Math.cos(a.a0) * a.r, a.cy + Math.sin(a.a0) * a.r); ctx.arc(a.cx, a.cy, a.r, a.a0, a.a1); }
    ctx.stroke();
  }
  ctx.restore();
  for (const tone of [0, 1]) {
    ctx.fillStyle = tone ? 'rgba(255,236,200,0.28)' : 'rgba(80,40,16,0.3)'; ctx.beginPath();
    for (const s of SPECKS) { if ((s.tone > 0.5 ? 1 : 0) !== tone) continue; ctx.moveTo(s.x + s.r, s.y); ctx.arc(s.x, s.y, s.r, 0, TAU); }
    ctx.fill();
  }
  for (const s of GRAVEL) {
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a);
    ctx.fillStyle = 'rgba(70,34,12,0.22)'; ctx.beginPath(); ctx.ellipse(1.5, 2, s.rx, s.ry, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = s.tone < 0.5 ? 'rgba(214,170,120,0.8)' : 'rgba(150,104,66,0.8)'; ctx.beginPath(); ctx.ellipse(0, 0, s.rx, s.ry, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // dry grass tufts at the edge of the yard
  ctx.save(); ctx.lineCap = 'round';
  for (const t of TUFTS) {
    for (let i = 0; i < t.n; i++) {
      const k = (i - (t.n - 1) / 2) / t.n, len = (34 + 18 * Math.sin(t.seed + i * 2.1)) * t.s;
      ctx.strokeStyle = i % 2 ? 'rgba(150,132,62,0.75)' : 'rgba(112,100,44,0.75)'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(t.x + k * 14, t.y); ctx.quadraticCurveTo(t.x + k * 30, t.y - len * 0.6, t.x + k * 56 + 6, t.y - len); ctx.stroke();
    }
  }
  ctx.restore();
  // soft sun from the upper left, darker edges
  const sun = ctx.createRadialGradient(W * 0.3, H * 0.22, 60, W * 0.5, H * 0.5, H * 0.85);
  sun.addColorStop(0, 'rgba(255,232,190,0.2)'); sun.addColorStop(0.55, 'rgba(255,232,190,0)'); sun.addColorStop(1, 'rgba(50,22,6,0.42)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
}

// The chalk circle, the hole and the resting place of the hand (world coordinates).
export function drawYard(ctx) {
  // chalk circle: three uneven passes
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const passes = [[7, 0.55, 0], [3.6, 0.5, 1], [2, 0.4, 2]];
  for (const [w, a, k] of passes) {
    ctx.strokeStyle = `rgba(252,246,230,${a})`; ctx.lineWidth = w; ctx.beginPath();
    for (let i = 0; i <= CHALK_N; i++) {
      const ang = (i % CHALK_N) / CHALK_N * TAU, r = YARD_R + CHALK[k][i % CHALK_N] + (k - 1) * 1.6;
      const x = PIT.x + Math.cos(ang) * r, y = PIT.y + Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  for (const d of CHALK_DUST) { ctx.fillStyle = `rgba(252,246,230,${d.al})`; ctx.beginPath(); ctx.arc(PIT.x + Math.cos(d.a) * (YARD_R + d.off), PIT.y + Math.sin(d.a) * (YARD_R + d.off), d.r, 0, TAU); ctx.fill(); }
  ctx.restore();
  drawPit(ctx);
}

export function drawPit(ctx) {
  const { x, y, r } = PIT;
  ctx.save();
  // packed earth around the lip
  const rim = ctx.createRadialGradient(x, y, r - 4, x, y, r + 22);
  rim.addColorStop(0, 'rgba(90,50,24,0.5)'); rim.addColorStop(0.5, 'rgba(236,196,146,0.28)'); rim.addColorStop(1, 'rgba(236,196,146,0)');
  ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(x, y, r + 22, 0, TAU); ctx.fill();
  // the hollow
  const g = ctx.createRadialGradient(x + 18, y + 22, 8, x, y, r);
  g.addColorStop(0, '#6a3d20'); g.addColorStop(0.7, '#512c16'); g.addColorStop(1, '#3d200e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(22,8,2,0.5)'; ctx.lineWidth = 46; ctx.beginPath(); ctx.arc(x + 16, y + 20, r + 22, 0, TAU); ctx.stroke();
  ctx.restore();
  // lit lower lip
  ctx.strokeStyle = 'rgba(255,228,184,0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r - 1, 0.1, 1.55); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,12,4,0.55)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 1, 0, TAU); ctx.stroke();
  ctx.restore();
}

// The resting place of the hand: a soft worn ring on the dirt.
export function drawHomeMark(ctx, x = HOME.x, y = HOME.y, glow = 0) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,238,206,${0.34 + 0.4 * glow})`; ctx.lineWidth = 3; ctx.setLineDash([5, 8]);
  ctx.beginPath(); ctx.arc(x, y, 46, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}

// ---- pebbles -----------------------------------------------------------------------------------------------------------
const soft = (ctx, x, y, rx, ry, a) => {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(30,12,4,${a})`); g.addColorStop(0.6, `rgba(30,12,4,${a * 0.55})`); g.addColorStop(1, 'rgba(30,12,4,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, TAU); ctx.fill(); ctx.restore();
};
export function drawShadow(ctx, x, y, z = 0, scale = 1, rr = R) {
  const k = 1 + z / 520;
  soft(ctx, x + 5 + z * 0.12, y + 11 + z * 0.06, rr * 1.25 * k * scale, rr * 0.95 * k * scale, 0.5 / (1 + z / 140));
}

// One pebble. o: { z, glow (0-1), ring (colour), alpha, scale, spin, inPit }
export function drawStone(ctx, s, o = {}) {
  const z = o.z ?? 0, sc = (o.scale ?? 1) * (1 + z / 380);
  const P = STONE_PAL[s.id % STONE_PAL.length];
  if (!o.noShadow) drawShadow(ctx, s.x, s.y, z, o.scale ?? 1);
  const x = s.x, y = s.y - z * 0.55;
  const rx = R * (1.04 + 0.07 * Math.sin(s.id * 1.9)), ry = R * (0.94 - 0.05 * Math.cos(s.id * 2.3));
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y); ctx.rotate((s.rot ?? 0) + (o.spin ?? 0)); ctx.scale(sc, sc);
  if (o.glow) {
    const g = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 2.1);
    g.addColorStop(0, `rgba(255,236,170,${0.55 * o.glow})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 2.1, 0, TAU); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  const g = ctx.createRadialGradient(-R * 0.38, -R * 0.42, R * 0.1, 0, 0, R * 1.18);
  g.addColorStop(0, P.hi); g.addColorStop(0.5, P.mid); g.addColorStop(1, P.lo);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(36,18,8,0.5)'; ctx.stroke();
  ctx.fillStyle = P.dot;
  const sp = [[0.3, 0.25, 2.1], [-0.15, 0.5, 1.5], [0.55, -0.1, 1.3], [-0.5, 0.05, 1.7], [0.05, -0.45, 1.2]];
  for (const [a, b, r] of sp) { ctx.beginPath(); ctx.arc(a * R, b * R, r, 0, TAU); ctx.fill(); }
  if (o.inPit) { ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fillStyle = 'rgba(26,10,2,0.2)'; ctx.fill(); }
  ctx.restore();
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * 0.8; ctx.translate(x - R * 0.34 * sc, y - R * 0.4 * sc); ctx.rotate(-0.5); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.ellipse(0, 0, R * 0.28, R * 0.14, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (o.ring) { ctx.save(); ctx.strokeStyle = o.ring; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, R * 1.4, 0, TAU); ctx.stroke(); ctx.restore(); }
}

// The throwing stone: larger, pale and smooth, with a warm band so it is never confused with the pile.
export function drawGho(ctx, x, y, z = 0, o = {}) {
  const sc = (o.scale ?? 1) * (1 + z / 380), r = GHO_R;
  if (!o.noShadow) drawShadow(ctx, x, y, z, o.scale ?? 1, GHO_R);
  const cy = y - z * 0.55;
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1; ctx.translate(x, cy); ctx.rotate(o.spin ?? 0); ctx.scale(sc, sc);
  const gl = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 2); gl.addColorStop(0, `rgba(255,240,190,${0.32 + 0.4 * (o.glow ?? 0)})`); gl.addColorStop(1, 'rgba(255,240,190,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.1, 0, 0, r * 1.15);
  g.addColorStop(0, '#fffdf2'); g.addColorStop(0.55, '#f0e6cc'); g.addColorStop(1, '#b4a687');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(196,92,50,0.55)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-r, r * 0.15); ctx.quadraticCurveTo(0, -r * 0.2, r, r * 0.15); ctx.stroke();
  ctx.restore();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(36,18,8,0.5)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.globalAlpha = (o.alpha ?? 1) * 0.85; ctx.translate(x - r * 0.36 * sc, cy - r * 0.42 * sc); ctx.rotate(-0.5); ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 0.15, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// ---- the hand marker --------------------------------------------------------------------------------------------------
// A glass ring with a bright core. closed (0-1) tightens it as the hand closes on a stone; the trail fades behind.
export function drawTrail(ctx, trail) {
  if (trail.length < 2) return;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1], b = trail[i], k = i / trail.length;
    ctx.strokeStyle = `rgba(255,240,200,${0.32 * k})`; ctx.lineWidth = 4 + 18 * k;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}
export function drawHand(ctx, x, y, o = {}) {
  const r = (o.r ?? 30) * (1 - 0.22 * (o.closed ?? 0)), a = o.alpha ?? 1;
  ctx.save(); ctx.globalAlpha = a;
  soft(ctx, x + 3, y + 22, r * 1.1, r * 0.7, 0.35);
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 1.9);
  g.addColorStop(0, `rgba(255,244,208,${0.5 + 0.3 * (o.glow ?? 0)})`); g.addColorStop(1, 'rgba(255,244,208,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.9, 0, TAU); ctx.fill();
  const gl = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
  gl.addColorStop(0, 'rgba(255,255,255,0.55)'); gl.addColorStop(1, 'rgba(255,240,200,0.16)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,250,234,0.95)'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(70,36,18,0.45)'; ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- routes, badges, rings --------------------------------------------------------------------------------------------
export function drawRoute(ctx, pts, o = {}) {
  if (pts.length < 2) return;
  const col = o.bad ? '255,110,90' : '255,244,214';
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${col},${o.alpha ?? 0.3})`; ctx.lineWidth = 24;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.setLineDash([10, 12]); ctx.strokeStyle = `rgba(${col},${Math.min(1, (o.alpha ?? 0.3) * 3)})`; ctx.lineWidth = 3;
  ctx.lineDashOffset = -(o.t ?? 0) * 40;
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  ctx.restore();
}
export function drawBadge(ctx, x, y, label, o = {}) {
  ctx.save();
  const r = o.r ?? 17;
  ctx.fillStyle = o.fill ?? '#d5553a'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#fffaf0'; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.font = `700 ${Math.round(r * 1.15)}px 'Avenir Next', 'Segoe UI', system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}
export function drawRing(ctx, x, y, r, col = 'rgba(255,240,190,0.9)', w = 4, dash = null) {
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}

// ---- particles ----------------------------------------------------------------------------------------------------------
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = p.t / p.max, a = Math.max(0, 1 - k);
    ctx.save(); ctx.globalAlpha = a;
    if (p.kind === 'ring') { ctx.strokeStyle = p.col ?? '#fff3c4'; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.2 + 0.8 * k), 0, TAU); ctx.stroke(); }
    else if (p.kind === 'dust') { const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (0.6 + k)); g.addColorStop(0, 'rgba(240,206,160,0.55)'); g.addColorStop(1, 'rgba(240,206,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + k), 0, TAU); ctx.fill(); }
    else { // sparkle: a four-point star
      ctx.translate(p.x, p.y); ctx.rotate(p.rot ?? 0); ctx.fillStyle = p.col ?? '#fff6cf'; const s = p.size * (1 - k * 0.5);
      ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.18, -s * 0.18, s, 0); ctx.quadraticCurveTo(s * 0.18, s * 0.18, 0, s); ctx.quadraticCurveTo(-s * 0.18, s * 0.18, -s, 0); ctx.quadraticCurveTo(-s * 0.18, -s * 0.18, 0, -s); ctx.fill();
    }
    ctx.restore();
  }
}
void roundPath;
