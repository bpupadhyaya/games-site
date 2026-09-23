// Drawing only. Reads the run state and a list of visual-only effects; changes neither.
import { SLOTS, BOSS_SLOT } from './tuning.js';
import { birdPoint, perchPoint, chooseDest, threatened } from './rules.js';

export const W = 720, H = 1280, HORIZON = 330;
const TAU = Math.PI * 2;
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const COATS = ['#c8553d', '#3d7ec8', '#8a5cc8', '#2f9e78', '#c89a3d', '#c84f8a', '#5c7a8a', '#a8663d'];

const mix = (a, b, f) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16), c = (sh) => Math.round(((pa >> sh) & 255) * (1 - f) + ((pb >> sh) & 255) * f); return `rgb(${c(16)},${c(8)},${c(0)})`; };

function sky(ctx, t, prog = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON + 40);
  g.addColorStop(0, mix('#5fa3dc', '#3a4f9a', prog)); g.addColorStop(0.7, mix('#a9d3ea', '#f3a86a', prog)); g.addColorStop(1, mix('#f8dfae', '#ffd08a', prog));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, HORIZON + 40);
  // sun, upper left: it is the one light in the scene
  const sunY = 150 + prog * 190;
  const sg = ctx.createRadialGradient(120, sunY, 6, 120, sunY, 200);
  sg.addColorStop(0, 'rgba(255,248,214,0.95)'); sg.addColorStop(0.2, 'rgba(255,236,170,0.4)'); sg.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = sg; ctx.fillRect(0, Math.max(0, sunY - 200), 420, 420);
  ctx.fillStyle = mix('#fffbe6', '#ffb86a', prog); ctx.beginPath(); ctx.arc(120, sunY, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 230 + t * (6 + i * 3)) % (W + 240)) - 120, y = 210 + i * 62;
    ctx.beginPath(); ctx.ellipse(x, y, 74, 17, 0, 0, TAU); ctx.ellipse(x + 34, y - 11, 42, 15, 0, 0, TAU); ctx.fill();
  }
}

function ground(ctx) {
  for (const [y0, col, amp, ph] of [[HORIZON - 40, '#7fb069', 22, 0], [HORIZON - 4, '#6ba05a', 14, 2]]) {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 - Math.sin(x * 0.011 + ph) * amp);
    ctx.lineTo(W, H); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, HORIZON, 0, H);
  g.addColorStop(0, '#6ba05a'); g.addColorStop(0.5, '#4f8c48'); g.addColorStop(1, '#2f6a3a');
  ctx.fillStyle = g; ctx.fillRect(0, HORIZON, W, H - HORIZON);
  // mown stripes that widen toward you: cheap perspective
  ctx.fillStyle = 'rgba(255,255,255,0.045)';
  for (let i = 0; i < 9; i++) { const y = HORIZON + Math.pow(i / 9, 1.8) * (H - HORIZON), h = 4 + i * 5; ctx.fillRect(0, y, W, h); }
}

export function drawTree(ctx, tr, wind = null) {
  ctx.save(); ctx.translate(tr.x, tr.y); ctx.scale(tr.s, tr.s);
  const dusk = 0;
  void dusk;
  // canopy behind the perches
  const cr = tr.crown ?? 1;
  for (const [x0, y0, r0, c] of [[0, -424, 130, '#3e7f45'], [-105, -364, 96, '#468a4c'], [105, -364, 96, '#468a4c'], [0, -474, 92, '#4e964f'], [-60, -424, 70, '#57a057']]) {
    const x = x0 * cr, y = (y0 + 330) * cr - 330 - (cr < 1 ? 30 : 0), r = r0 * cr;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, c); g.addColorStop(1, '#2d6a3a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // trunk lit from the left
  const tg = ctx.createLinearGradient(-38, 0, 38, 0);
  tg.addColorStop(0, '#9a6a3c'); tg.addColorStop(0.55, '#6b4526'); tg.addColorStop(1, '#3f2814');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-22, -334); ctx.lineTo(22, -334); ctx.lineTo(38, 0); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#5b3a1f'; ctx.lineCap = 'round';
  for (const o of tr.offs) {
    if (o.dx === 0) continue;
    const by = o.dy > -180 ? -54 : -124;
    ctx.lineWidth = o.dy > -180 ? 20 : 16; ctx.beginPath(); ctx.moveTo(Math.sign(o.dx) * 8, by); ctx.quadraticCurveTo(o.dx / 2, by + 8, o.dx, o.dy + 4); ctx.stroke();
  }
  ctx.fillStyle = '#4a2f18'; for (const o of tr.offs) { ctx.beginPath(); ctx.ellipse(o.dx, o.dy + 2, 22, 8, 0, 0, TAU); ctx.fill(); }
  // ground shadow toward the lower right, away from the sun
  ctx.fillStyle = 'rgba(0,0,10,0.28)'; ctx.beginPath(); ctx.ellipse(40, 6, 150, 24, 0, 0, TAU); ctx.fill();
  if (wind) {
    // a pennant on the crown streams downwind: the wind you must read
    const top = ((-474 + 330) * cr - 330 - (cr < 1 ? 30 : 0)) - 92 * cr - 6, dirw = Math.sign(wind.w) || 1, len = 18 + Math.abs(wind.w) * 46;
    ctx.strokeStyle = '#4a2f18'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, top - 46); ctx.stroke();
    ctx.fillStyle = '#ffd35c'; ctx.beginPath(); ctx.moveTo(0, top - 46);
    for (let i = 1; i <= 6; i++) ctx.lineTo(dirw * len * i / 6, top - 44 + Math.sin(wind.t * 9 + i) * 3 * Math.abs(wind.w));
    ctx.lineTo(0, top - 26); ctx.fill();
  }
  ctx.restore();
}

// ---- the hunter -------------------------------------------------------------------------
// Drawn in a local space facing +x (feet at 0,0, about 150 tall) and mirrored for hunters on the right.
const CHEEK = { x: 15, y: -121 }, SH_FRONT = { x: 11, y: -101 }, SH_BACK = { x: -9, y: -101 };
const HIP_HAND = { x: -16, y: -64 }, IDLE_F = { x: 38, y: -70 }, IDLE_ANG = 0.7, DRAW_LEN = 54;
const lerp = (a, b, f) => a + (b - a) * f;
const smooth = (a, b, x) => { const f = Math.max(0, Math.min(1, (x - a) / (b - a))); return f * f * (3 - 2 * f); };

// Aim: the direction the stone will leave, from the cheek toward the perch (lobs aim high).
function aimOf(perches, slot, target, kind) {
  const sl = SLOTS[slot], k = sl.s, tp = perchPoint(perches, target);
  const face = tp.x >= sl.x ? 1 : -1, cx = sl.x + face * CHEEK.x * k, cy = sl.y + CHEEK.y * k;
  const lift = kind === 'flat' ? 0 : 150;
  const ang = Math.max(-1.1, Math.min(0.25, Math.atan2(tp.y - lift - cy, Math.max(20, Math.abs(tp.x - cx)))));
  return { face, ang, k };
}

// Where the stone leaves from: the fork tip at full draw. Used by the flying stone and the ring arc.
export function handOrigin(perches, slot, target, kind) {
  const sl = SLOTS[slot], { face, ang, k } = aimOf(perches, slot, target, kind);
  const fx = CHEEK.x + Math.cos(ang) * (DRAW_LEN + 16), fy = CHEEK.y + Math.sin(ang) * (DRAW_LEN + 16);
  return { x: sl.x + face * fx * k, y: sl.y + fy * k, ang, face };
}

// Two-bone arm: shoulder to hand with the elbow bent to one side.
function arm(ctx, S, T, bend, col, w) {
  const l = 36, dx = T.x - S.x, dy = T.y - S.y;
  const d = Math.min(l * 2 - 0.5, Math.max(8, Math.hypot(dx, dy))), base = Math.atan2(dy, dx);
  const a = Math.acos(Math.max(-1, Math.min(1, d / (2 * l))));
  const E = { x: S.x + Math.cos(base + bend * a) * l, y: S.y + Math.sin(base + bend * a) * l };
  const H = { x: S.x + Math.cos(base) * d, y: S.y + Math.sin(base) * d };
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(S.x, S.y); ctx.lineTo(E.x, E.y); ctx.lineTo(H.x, H.y); ctx.stroke();
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(H.x, H.y, w * 0.58, 0, TAU); ctx.fill();
  return H;
}

export function hunter(ctx, h, t, perches) {
  const sl = SLOTS[h.slot], coat = h.slot === BOSS_SLOT ? '#8a1f2b' : COATS[h.slot % COATS.length];
  const pulling = h.phase === 'pull', cooling = h.phase === 'cool', stunned = h.phase === 'stunned';
  const p = pulling ? 1 - h.timer / h.total : 0;
  const dur = h.cancel ? 0.8 : 0.6, rel = cooling ? 1 - h.timer / dur : 1;
  const { face, ang: aim, k } = aimOf(perches, h.slot, h.target, h.kind);
  const snapped = cooling && !h.cancel;
  // how far along each part of the motion: raise the sling, then draw to the cheek
  let raise, draw;
  if (pulling) { raise = smooth(0, 0.3, p); draw = smooth(0.22, 1, p); }
  else if (cooling && h.cancel) { raise = 1 - smooth(0, 0.7, rel); draw = 1 - smooth(0, 0.4, rel); }
  else if (cooling) { raise = 1 - smooth(0.12, 0.7, rel); draw = 0; }
  else { raise = 0; draw = 0; }
  const ang = lerp(IDLE_ANG, aim, raise);
  const dir = { x: Math.cos(ang), y: Math.sin(ang) };
  const Ffull = { x: CHEEK.x + Math.cos(aim) * DRAW_LEN, y: CHEEK.y + Math.sin(aim) * DRAW_LEN };
  const kick = snapped && rel < 0.18 ? Math.sin((rel / 0.18) * Math.PI) * 5 : 0;
  const F = { x: lerp(IDLE_F.x, Ffull.x, raise) + dir.x * kick * 0.4, y: lerp(IDLE_F.y, Ffull.y, raise) - kick };
  const rest = { x: F.x + dir.x * 12, y: F.y + dir.y * 12 };                    // pouch resting on the fork
  const cheek = { x: CHEEK.x + 4, y: CHEEK.y + 7 };
  const P = snapped ? { x: rest.x + Math.sin(rel * 70) * (1 - Math.min(1, rel / 0.3)) * 5 * dir.x, y: rest.y + Math.sin(rel * 70) * (1 - Math.min(1, rel / 0.3)) * 5 * dir.y } : { x: lerp(rest.x, cheek.x, draw), y: lerp(rest.y, cheek.y, draw) };
  const holding = pulling && p > 0.04 || (cooling && h.cancel && draw > 0.02);
  const handBack = holding ? P : snapped ? { x: lerp(cheek.x, HIP_HAND.x, smooth(0, 0.35, rel)), y: lerp(cheek.y, HIP_HAND.y - 4, smooth(0, 0.35, rel)) } : HIP_HAND;
  const tremor = pulling ? Math.sin(t * 38) * Math.max(0, p - 0.7) * 1.6 : 0;
  const lean = stunned ? -0.5 + Math.sin(t * 6 + h.slot) * 0.05 : pulling ? -0.09 * draw : snapped ? -0.09 * (1 - smooth(0, 0.3, rel)) - 0.05 * Math.sin(Math.min(1, rel / 0.2) * Math.PI) : 0;
  const breathe = pulling ? 0 : Math.sin(t * 1.6 + h.slot * 2) * 1.2;

  ctx.save(); ctx.translate(sl.x, sl.y); ctx.scale(k * face, k);
  ctx.fillStyle = 'rgba(0,0,10,0.26)'; ctx.beginPath(); ctx.ellipse(-12, 6, 48, 10, 0, 0, TAU); ctx.fill();
  ctx.translate(tremor, 0);
  // legs: a planted stance, front foot toward the target
  ctx.lineCap = 'round'; ctx.strokeStyle = '#34344f'; ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(-5, -62); ctx.lineTo(-22, -8); ctx.moveTo(7, -62); ctx.lineTo(24, -8); ctx.stroke();
  ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.ellipse(-20, -3, 13, 6, 0, 0, TAU); ctx.ellipse(28, -3, 14, 6, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(0, -8); ctx.rotate(lean); ctx.translate(0, 8 + breathe * 0.5);
  // the far arm (holding the fork) sits behind the torso
  const Sf = { x: SH_FRONT.x, y: SH_FRONT.y };
  arm(ctx, Sf, F, 1, shade(coat, -28), 10);
  // torso: a tunic that tapers to the belt
  const tg = ctx.createLinearGradient(-18, 0, 20, 0); tg.addColorStop(0, shade(coat, 22)); tg.addColorStop(1, shade(coat, -34));
  ctx.fillStyle = tg; ctx.beginPath(); ctx.moveTo(-16, -60); ctx.lineTo(18, -60); ctx.quadraticCurveTo(22, -84, 19, -103); ctx.quadraticCurveTo(4, -110, -15, -103); ctx.quadraticCurveTo(-20, -82, -16, -60); ctx.fill();
  ctx.fillStyle = '#4a2f18'; ctx.fillRect(-17, -68, 36, 8); ctx.fillStyle = '#e2b84a'; ctx.fillRect(-2, -69, 8, 10);
  // head, hat, face: turns toward the target and squints once the sling is drawn
  ctx.fillStyle = '#f2c9a0'; ctx.fillRect(3, -114, 10, 10);
  ctx.beginPath(); ctx.arc(8, -124, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b2a1c'; ctx.beginPath(); ctx.arc(-1, -126, 12, Math.PI * 0.55, Math.PI * 1.55); ctx.fill();
  ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(24, -122, 3.6, 0, TAU); ctx.fill();                  // nose
  ctx.fillStyle = 'rgba(230,110,110,0.35)'; ctx.beginPath(); ctx.arc(12, -117, 4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#231a14'; ctx.lineWidth = 2.6;
  ctx.beginPath(); if (draw > 0.5) { ctx.moveTo(15, -127); ctx.lineTo(22, -126); } else { ctx.arc(19, -127, 2.6, 0, TAU); } ctx.stroke();
  if (draw > 0.5) { ctx.beginPath(); ctx.moveTo(14, -133); ctx.lineTo(23, -131); ctx.stroke(); }
  ctx.fillStyle = shade(coat, -10); ctx.beginPath(); ctx.ellipse(8, -139, 27, 6.5, 0.08, 0, TAU); ctx.fill();
  ctx.fillStyle = shade(coat, 8); ctx.beginPath(); ctx.moveTo(-6, -139); ctx.quadraticCurveTo(-4, -160, 8, -161); ctx.quadraticCurveTo(21, -160, 22, -139); ctx.fill();
  ctx.fillStyle = '#e2b84a'; ctx.fillRect(-5, -145, 27, 4);

  if (h.kind === 'arrow') {
    // a bow: limbs curve toward the target, string to the nocked arrow
    const n = { x: -dir.y, y: dir.x };
    const t1 = { x: F.x + n.x * 30 - dir.x * 6, y: F.y + n.y * 30 - dir.y * 6 }, t2 = { x: F.x - n.x * 30 - dir.x * 6, y: F.y - n.y * 30 - dir.y * 6 };
    ctx.strokeStyle = '#6b4a24'; ctx.lineWidth = 5.5;
    ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.quadraticCurveTo(F.x + dir.x * 22, F.y + dir.y * 22, t2.x, t2.y); ctx.stroke();
    ctx.strokeStyle = '#efe6d0'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(P.x, P.y); ctx.lineTo(t2.x, t2.y); ctx.stroke();
    if (holding || (!cooling && raise > 0)) {
      const tipx = F.x + dir.x * 26, tipy = F.y + dir.y * 26;
      ctx.strokeStyle = '#d9d0b6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(tipx, tipy); ctx.stroke();
      ctx.fillStyle = '#7b8090'; ctx.beginPath(); ctx.moveTo(tipx + dir.x * 8, tipy + dir.y * 8); ctx.lineTo(tipx - dir.y * 4, tipy + dir.x * 4); ctx.lineTo(tipx + dir.y * 4, tipy - dir.x * 4); ctx.fill();
    }
  } else {
  // the catapult: a forked stick, two elastic bands, a leather pouch with a stone
  const tip1 = { x: F.x + dir.x * 20 - dir.y * 11, y: F.y + dir.y * 20 + dir.x * 11 };
  const tip2 = { x: F.x + dir.x * 20 + dir.y * 11, y: F.y + dir.y * 20 - dir.x * 11 };
  ctx.strokeStyle = '#5a3a1c'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(F.x - dir.x * 12, F.y - dir.y * 12); ctx.lineTo(F.x + dir.x * 6, F.y + dir.y * 6); ctx.stroke();
  ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(F.x + dir.x * 6, F.y + dir.y * 6); ctx.lineTo(tip1.x, tip1.y); ctx.moveTo(F.x + dir.x * 6, F.y + dir.y * 6); ctx.lineTo(tip2.x, tip2.y); ctx.stroke();
  const tension = holding ? draw : 0, sag = (1 - tension) * 7;
  ctx.strokeStyle = `rgb(${120 + tension * 90},${50 - tension * 20},40)`; ctx.lineWidth = 4 - tension * 1.8;
  ctx.beginPath(); ctx.moveTo(tip1.x, tip1.y); ctx.quadraticCurveTo((tip1.x + P.x) / 2, (tip1.y + P.y) / 2 + sag, P.x, P.y);
  ctx.moveTo(tip2.x, tip2.y); ctx.quadraticCurveTo((tip2.x + P.x) / 2, (tip2.y + P.y) / 2 + sag, P.x, P.y); ctx.stroke();
  ctx.fillStyle = '#6b4327'; ctx.beginPath(); ctx.ellipse(P.x, P.y, 6, 9, ang, 0, TAU); ctx.fill();
  if (holding || (!snapped && !cooling && raise > 0)) { ctx.fillStyle = '#9a9eb0'; ctx.beginPath(); ctx.arc(P.x, P.y, 6.4, 0, TAU); ctx.fill(); }
  }
  // drawing arm in front: elbow up and back, hand at the pouch then the cheek
  arm(ctx, SH_BACK, handBack, -1, coat, 10.5);
  if (pulling && h.kind !== 'lob') { ctx.fillStyle = h.cancel ? '#ffd35c' : '#ff7a4a'; ctx.fillRect(2, -186, 8, 8); }
  if (stunned) {
    // dazed: stars circle the head
    ctx.fillStyle = '#ffe27a';
    for (let i = 0; i < 3; i++) { const a = t * 5 + i * 2.09, sx = 8 + Math.cos(a) * 26, sy = -160 + Math.sin(a) * 7; ctx.beginPath(); ctx.moveTo(sx, sy - 6); ctx.lineTo(sx + 2, sy - 2); ctx.lineTo(sx + 6, sy); ctx.lineTo(sx + 2, sy + 2); ctx.lineTo(sx, sy + 6); ctx.lineTo(sx - 2, sy + 2); ctx.lineTo(sx - 6, sy); ctx.lineTo(sx - 2, sy - 2); ctx.fill(); }
  }
  ctx.restore(); ctx.restore();
}

// Lighten (n > 0) or darken (n < 0) a #rrggbb colour.
function shade(hex, n) {
  const v = parseInt(hex.slice(1), 16), c = (sh) => Math.max(0, Math.min(255, ((v >> sh) & 255) + n));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

export function telegraph(ctx, s, t) {
  for (const h of s.hunters) {
    if (h.phase !== 'pull') continue;
    if (h.kind === 'net') {
      const tr = s.trees[s.perches[h.target].tree], c = { x: tr.x, y: tr.y - 210 * tr.s }, R = 215 * tr.s + 34, pr = 1 - h.timer / h.total;
      ctx.save(); ctx.globalAlpha = 0.18 + 0.3 * pr; ctx.fillStyle = '#ff5a4a'; ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.stroke(); ctx.restore();
      continue;
    }
    const p = perchPoint(s.perches, h.target), prog = 1 - h.timer / h.total;
    ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * prog;
    ctx.strokeStyle = '#fff3d0'; ctx.lineWidth = 3; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
    const ho = handOrigin(s.perches, h.slot, h.target, h.kind); ctx.beginPath(); ctx.moveTo(ho.x, ho.y);
    ctx.quadraticCurveTo((ho.x + p.x) / 2, Math.min(ho.y, p.y) - (h.kind === 'flat' ? 30 : 200), p.x, p.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = h.cancel ? '#ffd35c' : '#ff5a4a'; ctx.lineWidth = 4;
    const r = (46 - prog * 8 + Math.sin(t * 12) * 2) * Math.max(0.55, p.s);
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.45, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

export function stones(ctx, s) {
  for (const st of s.stones) {
    const f = Math.min(1, st.age / st.flight), p = perchPoint(s.perches, st.target);
    const sl = st.slot >= 0 ? SLOTS[st.slot] : null;
    const from = sl ? handOrigin(s.perches, st.slot, st.target, st.kind) : perchPoint(s.perches, st.fromPerch), k0 = sl ? sl.s : 1;
    const x = from.x + (p.x - from.x) * f, y = from.y + (p.y - from.y) * f - Math.sin(Math.PI * f) * st.arc;
    const r = (10 + 14 * (k0 + (Math.max(0.6, p.s) * 1.15 - k0) * f)) * 0.6;
    ctx.fillStyle = 'rgba(0,0,10,0.22)'; ctx.beginPath(); ctx.ellipse(x + 8, Math.min(H - 20, y + 30 + (1 - k0) * 10), r * 1.2, r * 0.4, 0, 0, TAU); ctx.fill();
    if (st.kind === 'arrow') {
      const f2 = Math.min(1, f + 0.03), x2 = from.x + (p.x - from.x) * f2, y2 = from.y + (p.y - from.y) * f2 - Math.sin(Math.PI * f2) * st.arc;
      const ang = Math.atan2(y2 - y, x2 - x), L = 30 * (0.5 + r / 16);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = '#e6dcc0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L * 0.4, 0); ctx.stroke();
      ctx.fillStyle = '#7b8090'; ctx.beginPath(); ctx.moveTo(L * 0.4 + 10, 0); ctx.lineTo(L * 0.4, -4); ctx.lineTo(L * 0.4, 4); ctx.fill();
      ctx.strokeStyle = '#e57a5a'; ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(-L - 6, -5); ctx.moveTo(-L, 0); ctx.lineTo(-L - 6, 5); ctx.stroke(); ctx.restore();
      continue;
    }
    if (st.kind === 'net') {
      ctx.strokeStyle = 'rgba(235,228,205,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 1.6, 0, TAU); ctx.moveTo(x - r * 1.6, y); ctx.lineTo(x + r * 1.6, y); ctx.moveTo(x, y - r * 1.6); ctx.lineTo(x, y + r * 1.6); ctx.stroke();
      continue;
    }
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r); g.addColorStop(0, '#d8dbe6'); g.addColorStop(1, '#6f7386');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
}

// From level 2 the player picks the perch. Faint rings show where the bird can go; on the first levels of
// choosing, a green ring also marks the safest one while a stone is coming (a teacher, not a crutch).
function choices(ctx, s, t) {
  if (!s.manual || s.over || s.won) return;
  const b = s.bird, cur = b.flit >= 0 ? b.dest : b.perch, here = perchPoint(s.perches, cur);
  const safe = s.level <= 3 && threatened(s) ? chooseDest(s, cur) : -1;
  s.perches.forEach((pp, i) => {
    if (i === cur) return;
    const p = perchPoint(s.perches, i), d = Math.hypot(p.x - here.x, p.y - here.y);
    if (d > 470 * 1.25) return;
    const k = Math.max(0.55, p.s);
    ctx.save(); ctx.globalAlpha = i === safe ? 0.55 + 0.35 * Math.sin(t * 8) : 0.22;
    ctx.strokeStyle = i === safe ? '#7dff9a' : '#ffffff'; ctx.lineWidth = i === safe ? 5 : 3;
    ctx.beginPath(); ctx.arc(p.x, p.y + 6 * k, 22 * k, 0, TAU); ctx.stroke();
    ctx.restore();
  });
}

export function seeds(ctx, s, t) {
  for (const sd of s.seeds) {
    const p = perchPoint(s.perches, sd.perch), k = Math.max(0.6, p.s);
    if (sd.ttl < 1.6 && Math.floor(t * 10) % 2 === 0) continue;
    const y = p.y - 36 * k + Math.sin(t * 3 + sd.perch) * 4;
    ctx.save(); ctx.translate(p.x, y); ctx.scale(k, k);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, 'rgba(255,226,120,0.85)'); g.addColorStop(1, 'rgba(255,226,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(10, 0); ctx.lineTo(0, 15); ctx.lineTo(-10, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.lineTo(2, -3); ctx.lineTo(-3, 0); ctx.fill();
    ctx.restore();
  }
}

export function beaters(ctx, s, t) {
  for (const bt of s.beaters) {
    const p = s.perches[bt.perch], tr = s.trees[p.tree], q = 1 - bt.timer / bt.total, e = q * q * (3 - 2 * q);
    const sx = p.x < W / 2 ? -50 : W + 50, tx = tr.x + Math.sign(sx - tr.x) * 46 * tr.s, x = sx + (tx - sx) * e, k = Math.max(0.55, tr.s);
    const face = Math.sign(tx - sx) || 1, run = Math.sin(t * 22);
    ctx.save(); ctx.translate(x, tr.y + 6); ctx.scale(face * k, k);
    ctx.fillStyle = 'rgba(0,0,10,0.25)'; ctx.beginPath(); ctx.ellipse(0, 4, 34, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, -14); ctx.lineTo(-22 + run * 8, 2); ctx.moveTo(-8, -14); ctx.lineTo(-10 - run * 8, 2); ctx.moveTo(14, -14); ctx.lineTo(20 + run * 8, 2); ctx.moveTo(22, -14); ctx.lineTo(24 - run * 8, 2); ctx.stroke();
    ctx.fillStyle = '#8a6238'; ctx.beginPath(); ctx.ellipse(0, -22, 30, 14, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(32, -32, 13, 11, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#4a2f18'; ctx.beginPath(); ctx.ellipse(28, -40, 5, 9, 0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#231a14'; ctx.beginPath(); ctx.arc(36, -34, 2.4, 0, TAU); ctx.arc(44, -30, 3, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#8a6238'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-28, -26); ctx.quadraticCurveTo(-42, -40 + run * 6, -36, -50); ctx.stroke();
    ctx.restore();
    // the rattled perch: a warning that blinks faster as the flush nears
    const pp = perchPoint(s.perches, bt.perch);
    if (Math.floor(t * (6 + q * 10)) % 2 === 0) { ctx.fillStyle = '#ffd35c'; ctx.font = `900 ${34 * k}px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('!', pp.x, pp.y - 46 * k); }
  }
}

// Acorns in flight, and a ring on every hunter you could knock down while you are holding one.
export function nuts(ctx, s, t) {
  if (s.ammo > 0 && !s.over && !s.won) {
    for (const h of s.hunters) {
      if (!(h.phase === 'pull' || h.phase === 'queued')) continue;
      const sl = SLOTS[h.slot], k = Math.max(0.6, sl.s), c = { x: sl.x, y: sl.y - 75 * sl.s };
      ctx.save(); ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 9); ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 3.5; ctx.setLineDash([7, 6]);
      ctx.beginPath(); ctx.arc(c.x, c.y, 62 * k, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  for (const n of s.nuts) {
    const f = Math.min(1, n.age / n.flight), sl = SLOTS[n.slot], to = { x: sl.x, y: sl.y - 75 * sl.s };
    const x = n.from.x + (to.x - n.from.x) * f, y = n.from.y + (to.y - n.from.y) * f - Math.sin(Math.PI * f) * 70, r = 13 * (1 - f * (1 - Math.max(0.5, sl.s)));
    ctx.save(); ctx.translate(x, y); ctx.rotate(f * 12);
    ctx.fillStyle = '#b07a3a'; ctx.beginPath(); ctx.ellipse(0, 2, r * 0.8, r, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6b4523'; ctx.beginPath(); ctx.ellipse(0, -r * 0.5, r * 0.9, r * 0.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export function bird(ctx, s, t, title) {
  const b = s.bird, p = birdPoint(s);
  if (b.inv > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  const rattled = s.beaters.some((bt) => bt.perch === b.perch && b.flit < 0 && bt.timer < 0.8);
  const flying = b.flit >= 0, shake = b.stun > 0 ? Math.sin(t * 60) * 4 : rattled ? Math.sin(t * 70) * 3 : 0;
  ctx.save(); ctx.translate(p.x + shake, p.y - 4);
  if (!flying) { ctx.fillStyle = 'rgba(0,0,10,0.24)'; ctx.beginPath(); ctx.ellipse(6, 30, 26, 6, 0, 0, TAU); ctx.fill(); }
  const dir = flying ? Math.sign(s.perches[b.dest].x - s.perches[b.from].x) || 1 : 1;
  const sc = Math.max(0.6, p.s);
  ctx.scale(dir * sc, sc);
  if (title) ctx.translate(0, Math.sin(t * 2) * 3);
  const flap = flying ? Math.sin(t * 50) : 0;
  ctx.fillStyle = '#7a5a3a'; ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-44, 16 + flap * 4); ctx.lineTo(-20, 16); ctx.fill();
  const body = ctx.createRadialGradient(-8, -10, 4, 0, 0, 34); body.addColorStop(0, '#f0a070'); body.addColorStop(1, '#b6603c');
  ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, 27, 24, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ffe6c8'; ctx.beginPath(); ctx.ellipse(8, 8, 15, 14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9a4c2e'; ctx.beginPath(); ctx.ellipse(-8, 2, 15, 9, -0.4 + flap * 0.9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b1a14'; ctx.beginPath(); ctx.arc(14, -8, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -9, 1.2, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f5b73a'; ctx.beginPath(); ctx.moveTo(24, -6); ctx.lineTo(38, -2); ctx.lineTo(24, 2); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
}

export function hud(ctx, s) {
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(20,30,50,0.55)'; ctx.lineJoin = 'round'; ctx.lineWidth = 10;
  ctx.font = `800 84px ${FONT}`; ctx.strokeText(String(s.score), W / 2, 150); ctx.fillText(String(s.score), W / 2, 150);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < s.lives ? '#ff9b6a' : 'rgba(255,255,255,0.28)';
    ctx.save(); ctx.translate(58 + i * 46, 110); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 22, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.textAlign = 'right'; ctx.font = `800 40px ${FONT}`; ctx.fillStyle = s.combo > 1 ? '#ffe27a' : 'rgba(255,255,255,0.55)';
  ctx.strokeText('×' + s.combo, W - 40, 122); ctx.fillText('×' + s.combo, W - 40, 122);
  // the day: a bar that fills as the sun sets. Survive until it does.
  const prog = Math.min(1, s.t / s.duration), bx = 140, bw = W - 280, by = 200;
  ctx.fillStyle = 'rgba(15,25,50,0.35)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, 12, 6); ctx.fill();
  ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(12, bw * prog), 12, 6); ctx.fill();
  ctx.textAlign = 'center'; ctx.font = `700 22px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText('LEVEL ' + s.level + ' · ' + s.name.toUpperCase(), W / 2, 186);
  if (s.feats.seeds) { ctx.textAlign = 'left'; ctx.font = `800 30px ${FONT}`; ctx.fillStyle = '#ffd24a'; ctx.strokeText('◆ ' + s.seedsGot, 44, 168); ctx.fillText('◆ ' + s.seedsGot, 44, 168); }
  if (s.feats.hitback) {
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.translate(56 + i * 40, 212); ctx.globalAlpha = i < s.ammo ? 1 : 0.28;
      ctx.fillStyle = '#b07a3a'; ctx.beginPath(); ctx.ellipse(0, 2, 10, 13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6b4523'; ctx.beginPath(); ctx.ellipse(0, -7, 11, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  if (s.feats.wind) {
    const w = s.wind, n = Math.max(1, Math.round(Math.abs(w) * 4)), str = Math.abs(w) < 0.25 ? 'calm' : (w > 0 ? '›'.repeat(n) : '‹'.repeat(n));
    ctx.textAlign = 'right'; ctx.font = `800 30px ${FONT}`; ctx.fillStyle = '#d6f0ff'; ctx.strokeText('WIND ' + str, W - 40, 168); ctx.fillText('WIND ' + str, W - 40, 168);
  }
  if (s.feats.boss && s.t < 4) drawText(ctx, 'THE MASTER HUNTER', W / 2, 330, 54, '#ffd0c0');
  if (s.blurb && s.t > 0.4 && s.t < 7) {
    ctx.globalAlpha = Math.min(1, (7 - s.t) / 1.2);
    ctx.font = `700 26px ${FONT}`;
    const words = s.blurb.split(' '), lines = []; let cur = '';
    for (const w of words) { const t2 = cur ? cur + ' ' + w : w; if (ctx.measureText(t2).width > W - 90 && cur) { lines.push(cur); cur = w; } else cur = t2; }
    lines.push(cur);
    lines.forEach((ln, i) => drawText(ctx, ln, W / 2, 1160 + i * 36, 26, '#fff', 700));
    ctx.globalAlpha = 1;
  }
}

export function drawScene(ctx, s, fx, t, title = false) {
  ctx.clearRect(0, 0, W, H);
  sky(ctx, t, title ? 0 : Math.min(1, s.t / s.duration)); ground(ctx);
  const shown = title ? 3 : Math.min(s.maxHunters, s.startHunters + s.wave);
  const hs = s.hunters.filter((h) => h.slot < shown || (!title && s.feats.boss && h.slot === BOSS_SLOT)).sort((a, b) => SLOTS[a.slot].y - SLOTS[b.slot].y);
  for (const h of hs) if (SLOTS[h.slot].s < 0.9) hunter(ctx, h, t, s.perches);
  const wind = s.feats.wind ? { w: s.wind, t } : null;
  for (const tr of [...s.trees].sort((a, b) => a.y - b.y)) drawTree(ctx, tr, wind);
  telegraph(ctx, s, t);
  for (const h of hs) if (SLOTS[h.slot].s >= 0.9) hunter(ctx, h, t, s.perches);
  if (!title) choices(ctx, s, t);
  seeds(ctx, s, t); beaters(ctx, s, t);
  stones(ctx, s); nuts(ctx, s, t);
  bird(ctx, s, t, title);
  for (const f of fx) {
    ctx.globalAlpha = Math.max(0, f.life / f.max); ctx.save(); ctx.translate(f.x, f.y);
    if (f.net) {
      const k = 0.55 + 0.45 * (1 - f.life / f.max), R = f.r * k;
      ctx.fillStyle = 'rgba(235,228,205,0.18)'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(235,228,205,0.9)'; ctx.lineWidth = 3;
      for (const rr of [1, 0.66, 0.33]) { ctx.beginPath(); ctx.arc(0, 0, R * rr, 0, TAU); ctx.stroke(); }
      ctx.beginPath(); for (let i = 0; i < 8; i++) { ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 8) * R, Math.sin(i * TAU / 8) * R); } ctx.stroke();
    } else { ctx.rotate(f.rot); ctx.fillStyle = f.col; ctx.beginPath(); ctx.ellipse(0, 0, 5, 12, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  if (!title) hud(ctx, s);
}

export function drawText(ctx, str, x, y, size, color = '#fff', weight = 800) {
  ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(20,30,50,0.6)';
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.strokeText(str, x, y); ctx.fillStyle = color; ctx.fillText(str, x, y);
}
