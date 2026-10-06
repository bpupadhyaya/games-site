// The falcon and the hawk, drawn as articulated vector art and posed by interpolation. Cartoon-clean to match the game, but built like a real bird:
//  - each WING is a 3-segment chain (shoulder -> elbow -> wrist -> tip) whose joint angles lag one another through the flap (the tip trails the shoulder),
//    drawn as ONE smooth tapered shape (leading-edge curve + trailing edge), with individual primary feathers fanning at the tip, a secondary-feather row,
//    fine barring across the panel and a warm rim light on the leading edge;
//  - the BODY is a streamlined teardrop with a slate back, a cream chest with fine barring (clipped), a helmeted head with moustache, cream cheek,
//    bright eye and a hooked beak with a yellow cere; legs tuck in cruise, fold along the tail in the stoop and thrust forward at the strike;
//  - the TAIL is a fan of 9 barred feathers that opens and closes (closed in the stoop, spread in the pull-up);
//  - poses: cruise / flap, wait-on soar, STOOP (wings tucked back into a dart, tail closed, body along the velocity), strike (talons forward, wings flared),
//    pull-up (wings opening). Falcon = peregrine (sickle wings, slate, cream); hawk = buteo (broad fingered wings, brown back, rust tail, pale head).
// Everything is a handful of paths per frame; one predator only.
import { pxPerCm, REAL_CM } from './tuning.js';
const D = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const dirA = (a) => [-Math.sin(a), -Math.cos(a)];   // 0 = up, growing = swept toward the tail (the tail is at -x)
const nrm = (a) => [-Math.cos(a), Math.sin(a)];    // the normal on the tail side of a segment
const OUTLINE = 'rgba(52,34,22,0.85)';

const STYLE = {
  falcon: { seg: [28, 32, 62], wid: [20, 17, 11, 0], fingers: 9, fl: 13, back: '#4f6379', backDark: '#2b3644', wingIn: '#6c8097', wingMid: '#566c84', wingOut: '#34425a', under: '#d6dde6', bar: 'rgba(24,32,46,0.32)', tail: '#566a80', tailBand: '#26303d', tailTip: '#e9eef3', tailLen: 42, bodyRx: 28, bodyRy: 12, headR: 9.2, scale: 1.1 },
  hawk: { seg: [30, 34, 40], wid: [26, 24, 19, 4], fingers: 8, fl: 15, back: '#7b5432', backDark: '#4a3220', wingIn: '#946843', wingMid: '#8a6240', wingOut: '#4a3220', under: '#ead8bb', bar: 'rgba(96,52,20,0.55)', tail: '#bd6a22', tailBand: '#5a3012', tailTip: '#f0d8a8', tailLen: 32, bodyRx: 27, bodyRy: 14.5, headR: 10.5, scale: 1.15 },
};

function pose(P, time, speed) {
  const falcon = P.kind === 'falcon', ph = P.phase, s = P.seed || 0;
  let alpha, spread = 1, tail = 0.5, legs = 0.1, freq = 0, amp = 0;
  if (ph === 'stoop') {
    const fold = clamp(speed / (falcon ? 800 : 620), 0, 1) * (falcon ? 1 : 0.65);
    alpha = lerp(46 * D, 96 * D, fold); spread = lerp(1, falcon ? 0.5 : 0.7, fold); tail = lerp(0.5, 0, fold); legs = 0;   // tucked into a dart, tail closed
    if (P.strike) { alpha = 58 * D; spread = 1; legs = 1; tail = 0.9; } else if (P.near) legs = 0.55;
  } else if (ph === 'pullup') {
    const k = clamp(P.t / 1.2, 0, 1);
    alpha = lerp(62 * D, 34 * D, k); spread = lerp(0.7, 1, k); tail = 0.8 + 0.2 * k; legs = P.carry || P.strikeT > 0 ? 1 : 0.25;   // wings open in a strong downstroke V, tail fanned for braking
    freq = falcon ? 6.5 : 2.6; amp = (falcon ? 34 : 14) * D;
  } else if (ph === 'climb') {   // wait-on: wings spread, slow wheeling, the falcon beats quickly now and then
    alpha = (falcon ? 56 : 36) * D; freq = falcon ? 7 : 2.4; amp = (falcon ? 26 : 9) * D; tail = 0.85;
  } else if (ph === 'flinch') {   // startled: wings thrown wide, tail fanned
    alpha = 40 * D; spread = 1; tail = 1; legs = 0.6; freq = 16; amp = 30 * D;
  } else {   // leave / mobbed: easy cruise
    alpha = (falcon ? 58 : 38) * D; freq = falcon ? 9 : 3.2; amp = (falcon ? 28 : 11) * D; tail = 0.6;
  }
  return { alpha, spread, tail, legs, phase: time * freq + s, amp };
}

// The wing chain: joint angles lag along the wing (shoulder leads, elbow later, wrist later still, the tip trails).
function chainOf(K, ps, sx, sy, lag) {
  const k = 0.45 + 0.55 * ps.spread, a0 = ps.alpha, ph = ps.phase;
  const a1 = a0 + ps.amp * Math.sin(ph - lag), a2 = a1 + (10 * D) * ps.spread + ps.amp * 0.5 * Math.sin(ph - lag - 0.8), a3 = a2 + (16 * D) * ps.spread + ps.amp * 0.8 * Math.sin(ph - lag - 1.6);
  const A = [a1, a2, a3], pts = [[sx, sy]];
  for (let i = 0; i < 3; i++) { const d = dirA(A[i]), p = pts[i]; pts.push([p[0] + d[0] * K.seg[i] * k, p[1] + d[1] * K.seg[i] * k]); }
  return { pts, A, k };
}

const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
function smoothTo(ctx, pts) { for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); }

function drawWing(ctx, K, ch, shade, rim, spread) {
  const { pts, A, k } = ch, w = K.wid.map((x) => x * (0.6 + 0.4 * spread));
  const lead = pts, trail = pts.map((p, i) => { const n = nrm(A[Math.min(i, 2)]); return [p[0] + n[0] * w[i], p[1] + n[1] * w[i]]; });
  const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
  g.addColorStop(0, shade ? K.backDark : K.wingIn); g.addColorStop(0.5, shade ? '#2d3a4b' : K.wingMid); g.addColorStop(1, shade ? '#27313f' : K.wingOut);
  ctx.beginPath(); ctx.moveTo(lead[0][0], lead[0][1]); smoothTo(ctx, lead);
  const rev = trail.slice().reverse(); ctx.lineTo(rev[0][0], rev[0][1]); smoothTo(ctx, rev); ctx.closePath();
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; ctx.lineJoin = 'round'; ctx.stroke();
  if (!shade) {   // fine underwing barring across the panel
    ctx.strokeStyle = K.bar; ctx.lineWidth = 1.3;
    for (let i = 0; i < 3; i++) for (let j = 1; j <= 3; j++) { const f = j / 4, a = [lerp(lead[i][0], lead[i + 1][0], f), lerp(lead[i][1], lead[i + 1][1], f)], b = [lerp(trail[i][0], trail[i + 1][0], f), lerp(trail[i][1], trail[i + 1][1], f)]; ctx.beginPath(); ctx.moveTo(lerp(a[0], b[0], 0.2), lerp(a[1], b[1], 0.2)); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
  }
  const blade = (bx, by, ang, len, wd, col) => {
    const d = dirA(ang), n = nrm(ang);
    ctx.beginPath(); ctx.moveTo(bx - n[0] * wd * 0.5, by - n[1] * wd * 0.5); ctx.quadraticCurveTo(bx + d[0] * len * 0.7 - n[0] * wd * 0.7, by + d[1] * len * 0.7 - n[1] * wd * 0.7, bx + d[0] * len, by + d[1] * len);
    ctx.quadraticCurveTo(bx + d[0] * len * 0.7 + n[0] * wd * 0.7, by + d[1] * len * 0.7 + n[1] * wd * 0.7, bx + n[0] * wd * 0.5, by + n[1] * wd * 0.5); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  };
  // secondaries: a row of short rounded feathers along the arm's trailing edge (tilting a little toward the tail)
  const sec = shade ? '#34425a' : K.wingMid;
  for (let j = 0; j < 8; j++) { const f = j / 7, seg = f < 0.5 ? 0 : 1, ff = f < 0.5 ? f * 2 : (f - 0.5) * 2, bx = lerp(trail[seg][0], trail[seg + 1][0], ff), by = lerp(trail[seg][1], trail[seg + 1][1], ff); blade(bx, by, A[seg] + 0.2 + 0.05 * j / 7, 11 * k, 6.2, sec); ctx.strokeStyle = 'rgba(30,22,16,0.28)'; ctx.lineWidth = 0.7; ctx.stroke(); }
  // primaries: individual feathers fanning at the hand, longest in the middle
  const nF = K.fingers;
  for (let j = 0; j < nF; j++) {
    const f = j / (nF - 1), bx = lerp(trail[2][0], trail[3][0], f * 0.9), by = lerp(trail[2][1], trail[3][1], f * 0.9);
    const ang = A[2] + 0.06 + (f - 0.35) * 0.78 * spread, len = K.fl * k * (1 - Math.abs(f - 0.5) * 0.55) * (j === 0 ? 1.12 : 1);
    blade(bx, by, ang, len, 6.4, shade ? '#222c3a' : K.wingOut); ctx.strokeStyle = 'rgba(20,16,12,0.35)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  if (!shade) {   // wing-bone line and the sun-side rim light along the leading edge
    ctx.strokeStyle = 'rgba(30,22,16,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(lead[0][0], lead[0][1]); smoothTo(ctx, lead); ctx.stroke();
    ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lead[0][0], lead[0][1] - 1); smoothTo(ctx, lead.map((p) => [p[0], p[1] - 1])); ctx.stroke();
  }
}

function foot(ctx, hx, hy, fx, fy) {   // yellow leg + toes + dark claws
  ctx.lineCap = 'round'; ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(fx, fy); ctx.stroke();
  for (const [dx, dy] of [[7, -2], [6, 3.5], [-3, 5]]) { ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + dx, fy + dy); ctx.stroke(); ctx.strokeStyle = '#2a2024'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(fx + dx, fy + dy); ctx.lineTo(fx + dx * 1.4 + 1, fy + dy * 1.4 + 1.6); ctx.stroke(); }
}

function drawBody(ctx, P, K, ps, rim, look) {
  const falcon = P.kind === 'falcon', rx = K.bodyRx, ry = K.bodyRy;
  // tail: nine barred feathers that fan open and shut
  const spreadA = (3 + 19 * ps.tail) * D, root = [-rx + 9, 0], tl = K.tailLen;
  for (let i = 8; i >= 0; i--) {
    const a = (i - 4) / 4 * spreadA, dx = -Math.cos(a), dy = Math.sin(a), len = tl * (1 - Math.abs(i - 4) * 0.025), wd = 3.4 + 2 * ps.tail;
    const ex = root[0] + dx * len, ey = root[1] + dy * len, nx = -dy, ny = dx;
    ctx.beginPath(); ctx.moveTo(root[0] + nx * 1.5, root[1] + ny * 1.5); ctx.quadraticCurveTo(lerp(root[0], ex, 0.6) + nx * wd, lerp(root[1], ey, 0.6) + ny * wd, ex, ey); ctx.quadraticCurveTo(lerp(root[0], ex, 0.6) - nx * wd, lerp(root[1], ey, 0.6) - ny * wd, root[0] - nx * 1.5, root[1] - ny * 1.5); ctx.closePath();
    ctx.fillStyle = K.tail; ctx.fill(); ctx.strokeStyle = 'rgba(52,34,22,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = K.tailBand; ctx.beginPath(); ctx.ellipse(lerp(root[0], ex, 0.8), lerp(root[1], ey, 0.8), len * 0.07, wd * 0.8, a, 0, Math.PI * 2); ctx.fill();   // dark sub-terminal band
    ctx.fillStyle = K.tailTip; ctx.beginPath(); ctx.ellipse(ex + dx * 0.5, ey + dy * 0.5, 2, wd * 0.75, a, 0, Math.PI * 2); ctx.fill();
  }
  // legs: tucked in cruise, folded along the tail in the stoop, thrust forward at the strike
  const lg = ps.legs, fxp = lerp(-9, 31, lg), fyp = lerp(ry * 0.9, ry + 11, lg);
  if (lg >= 0) foot(ctx, 3, ry * 0.5, fxp, fyp);
  if (P.carry && look) { const l = look[P.carry] ?? look.sparrow, cx = fxp + 5, cy = fyp + 7; ctx.fillStyle = l.body; ctx.beginPath(); ctx.ellipse(cx, cy, 13, 8, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = l.belly; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 3, 8, 4, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = l.body; ctx.beginPath(); ctx.arc(cx + 11, cy - 2, 4.5, 0, Math.PI * 2); ctx.fill(); }
  // torso: a teardrop, slate back to cream chest, with fine barring clipped to it
  const body = () => { ctx.beginPath(); ctx.moveTo(-rx, 0); ctx.bezierCurveTo(-rx * 0.45, -ry * 1.3, rx * 0.35, -ry * 1.2, rx, -ry * 0.25); ctx.bezierCurveTo(rx * 1.02, ry * 0.2, rx * 0.4, ry * 1.2, -rx * 0.1, ry * 1.15); ctx.bezierCurveTo(-rx * 0.55, ry * 1.05, -rx * 0.9, ry * 0.5, -rx, 0); ctx.closePath(); };
  const g = ctx.createLinearGradient(0, -ry * 1.2, 0, ry * 1.2);
  g.addColorStop(0, K.back); g.addColorStop(0.42, K.back); g.addColorStop(0.58, K.under); g.addColorStop(1, K.under);
  ctx.fillStyle = g; body(); ctx.fill();
  ctx.save(); body(); ctx.clip(); ctx.strokeStyle = K.bar; ctx.lineWidth = 1.3;
  for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const x = -rx * 0.55 + i * 7.5 + (r % 2) * 3.5, y = ry * (0.15 + r * 0.32); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y + 2.2); ctx.lineTo(x + 6, y); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, -ry, 0, ry * 1.2); sh.addColorStop(0, 'rgba(255,214,140,0.25)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,30,50,0.18)'); ctx.fillStyle = sh; ctx.fillRect(-rx - 4, -ry * 1.4, rx * 2 + 8, ry * 2.8);
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; body(); ctx.stroke();
  ctx.strokeStyle = rim; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-rx * 0.6, -ry * 0.95); ctx.bezierCurveTo(-rx * 0.2, -ry * 1.18, rx * 0.2, -ry * 1.12, rx * 0.8, -ry * 0.5); ctx.stroke();
  // head: dark helmet + moustache + cream cheek (falcon) / pale streaked head (hawk), bright eye, hooked beak
  const hx = rx - 3 + (ps.legs > 0.8 ? 1 : 0), hy = -2.5 - ry * 0.1, hr = K.headR;
  ctx.fillStyle = falcon ? '#222a37' : '#d4bd98'; ctx.beginPath(); ctx.ellipse(hx, hy, hr * 1.08, hr, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = OUTLINE; ctx.stroke();
  if (falcon) {
    ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.moveTo(hx - 2, hy + 1); ctx.quadraticCurveTo(hx + 6, hy - 1, hx + 9, hy + 5); ctx.quadraticCurveTo(hx + 3, hy + hr + 1, hx - 4, hy + hr - 1); ctx.closePath(); ctx.fill();   // cream cheek
    ctx.fillStyle = '#222a37'; ctx.beginPath(); ctx.moveTo(hx + 1, hy + 1); ctx.lineTo(hx + 5, hy + 3); ctx.quadraticCurveTo(hx + 5, hy + 9, hx + 2, hy + hr + 2); ctx.lineTo(hx - 1.5, hy + hr); ctx.quadraticCurveTo(hx + 0.5, hy + 6, hx + 1, hy + 1); ctx.closePath(); ctx.fill();   // moustache
  } else { ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(hx - 3, hy - 3, hr * 0.75, hr * 0.5, -0.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = falcon ? '#f2c230' : '#f0b030'; ctx.beginPath(); ctx.arc(hx + 3.6, hy - 2.2, 3.9, 0, Math.PI * 2); ctx.fill();   // eye ring
  if (P.blink) { ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx + 1.2, hy - 2); ctx.lineTo(hx + 6.4, hy - 2); ctx.stroke(); }
  else { ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(hx + 4.1, hy - 2.2, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 4.9, hy - 3.1, 0.85, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(hx + hr - 1, hy + 0.6, 3, 2.6, 0, 0, Math.PI * 2); ctx.fill();   // cere
  ctx.fillStyle = '#8a93a1'; ctx.beginPath(); ctx.moveTo(hx + hr - 2.5, hy - 2.2); ctx.quadraticCurveTo(hx + hr + 8, hy - 2.4, hx + hr + 7, hy + 6.5); ctx.quadraticCurveTo(hx + hr + 4, hy + 2.8, hx + hr - 2, hy + 2); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = OUTLINE; ctx.stroke();
}

// P = predator state, look = the game's bird colours (carried prey), V = live world geometry. ghost = 1 draws a faded motion copy.
export function drawPredator(ctx, P, time, look, V, ghost = 0, quality = 0) {
  const K = STYLE[P.kind], falcon = P.kind === 'falcon';
  const artLen = 2 * K.bodyRx + K.headR + K.tailLen - 5, s = (REAL_CM[P.kind] * pxPerCm()) / artLen;   // real body length (cm) x the shared px-per-cm
  if (P.phase === 'telegraph') {   // the cue: a gold warning sign where it is about to enter, and a small shadow gliding over the field
    const mx = clamp(P.x, 40, V.WW - 40), my = V.top + 14 + Math.sin(time * 14) * 3;
    ctx.save(); ctx.fillStyle = 'rgba(30,20,0,0.12)'; ctx.beginPath(); ctx.ellipse(mx, V.hy + 60, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,215,90,0.95)'; ctx.beginPath(); ctx.moveTo(mx, my - 26); ctx.lineTo(mx + 26, my + 20); ctx.lineTo(mx - 26, my + 20); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a1d05'; ctx.font = '900 26px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', mx, my + 6); ctx.restore();
    return;
  }
  const rvx = P.rvx ?? 0, rvy = P.rvy ?? 0, speed = Math.hypot(rvx, rvy);
  const fx = Math.abs(rvx) > 25 ? (rvx > 0 ? 1 : -1) : (P.facing || 1);
  const diving = P.phase === 'stoop' || P.phase === 'pullup';
  const raw = Math.atan2(rvy, Math.max(Math.abs(rvx), 1));
  const ang = P.angS !== undefined ? P.angS : raw * (diving ? 1 : 0.3);
  const ps = pose(P, time, speed);
  if (!ghost) {
    // soft ground shadow that grows as it descends; speed streaks on the dive; a little dust if it skims the crop
    const gy = V.hy + 60, low = clamp((P.y - V.top) / Math.max(1, gy - V.top), 0, 1);
    ctx.save(); ctx.fillStyle = `rgba(30,20,0,${0.1 + 0.2 * low})`; ctx.beginPath(); ctx.ellipse(P.x, gy, (28 + 50 * low) * s * 0.6, (5 + 7 * low) * s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (P.phase === 'stoop' && speed > 450) {
      ctx.save(); ctx.lineCap = 'round'; const ux = rvx / speed, uy = rvy / speed;
      for (let i = 0; i < 6; i++) { const o = (i - 2.5) * 9, a = 0.16 + 0.22 * ((i + 1) % 3) / 3, len = speed * (0.06 + 0.02 * (i % 3)); ctx.strokeStyle = `rgba(255,240,200,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(P.x - uy * o - ux * 30, P.y + ux * o - uy * 30); ctx.lineTo(P.x - uy * o - ux * (30 + len), P.y + ux * o - uy * (30 + len)); ctx.stroke(); }
      ctx.restore();
    }
    if (P.mode === 'skim' && P.y > V.hy - 140 && diving) { ctx.save(); for (let i = 0; i < 4; i++) { ctx.fillStyle = `rgba(214,178,110,${0.22 - i * 0.045})`; ctx.beginPath(); ctx.ellipse(P.x - fx * (20 + i * 26), gy - 4 - i * 3, 16 + i * 8, 6 + i * 2, 0, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
    if (quality < 1 && P.phase === 'stoop' && P.hist && P.hist.length) {   // motion ghosting: 2-3 faded copies
      const base = { ...P, strike: false, hist: null };
      P.hist.forEach((h, i) => { ctx.save(); ctx.globalAlpha = 0.2 - i * 0.06; drawPredator(ctx, { ...base, x: h.x, y: h.y }, time, look, V, 1); ctx.restore(); });
    }
  }
  ctx.save();
  ctx.translate(P.x, P.y); ctx.rotate((fx > 0 ? ang : -ang) + (P.spin || 0)); ctx.scale(fx * s, s);
  const rim = 'rgba(255,224,160,0.8)', ox = 6, oy = -K.bodyRy * 0.55;
  drawWing(ctx, K, chainOf(K, { ...ps, alpha: clamp(ps.alpha * 0.94 + 7 * D, 0, 2.7), amp: ps.amp * 0.9 }, ox - 2, oy + 1, 0.5), true, rim, ps.spread);   // far wing, darker and behind
  drawBody(ctx, P, K, ps, rim, look);
  drawWing(ctx, K, chainOf(K, ps, ox, oy, 0), false, rim, ps.spread);   // near wing in front
  ctx.restore();
}

// A falcon / hawk SITTING on a branch. Drawn upright (not a rotated flight pose): fuller chest and belly, rounded shoulder, the folded wing laid along the back with its tip crossing
// over the barred tail, heavy-browed head with a bright eye, yellow feet gripping the branch. Locked on: it crouches and leans toward the target.
export function drawPerched(ctx, S, time, look, V) {
  void look; void V;
  const falcon = S.kind === 'falcon', K = STYLE[S.kind], H = 100, s = (REAL_CM[S.kind] * 0.92 * pxPerCm()) / H;
  const lock = S.state === 'lock' ? clamp(S.lock / 0.6, 0, 1) : 0, tum = S.state === 'tumble', face = S.face || 1, t = time + S.seed;
  const ruffle = Math.max(0, Math.sin(t * 0.55)) ** 24, grip = Math.sin(t * 0.37) > 0.97 ? 1.5 : 0, head = Math.sin(t * 0.7) * 0.06 * (1 - lock);
  const wob = Math.sin(t * 2.3) * (Math.sin(t * 0.8) > 0.6 ? 1 : 0.15);
  ctx.save();
  ctx.translate(S.x, S.y - 46 * s + (tum ? 0 : lock * 4)); if (tum) ctx.rotate(S.spin);
  ctx.scale(face * s * (1 + 0.035 * ruffle), s * (1 + 0.035 * ruffle)); ctx.rotate(lock * 0.5);
  const rim = 'rgba(255,224,160,0.85)';
  // tail: nine barred feathers hanging down behind the legs
  for (let i = 8; i >= 0; i--) {
    const a = ((i - 4) / 4) * (0.1 + 0.03 * wob), len = 38 - Math.abs(i - 4) * 0.8, x0 = -7 + (i - 4) * 0.8, y0 = 22, ex = x0 - Math.sin(a - 0.12) * len - 3, ey = y0 + Math.cos(a) * len;
    ctx.beginPath(); ctx.moveTo(x0 - 1.8, y0); ctx.quadraticCurveTo(x0 - 3 + (ex - x0) * 0.4, y0 + len * 0.55, ex - 1.7, ey); ctx.quadraticCurveTo(ex + 0.4, ey + 2, ex + 1.7, ey); ctx.quadraticCurveTo(x0 + 3 + (ex - x0) * 0.4, y0 + len * 0.55, x0 + 1.8, y0); ctx.closePath();
    ctx.fillStyle = K.tail; ctx.fill(); ctx.strokeStyle = 'rgba(52,34,22,0.5)'; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = K.tailBand; ctx.fillRect(Math.min(x0, ex) - 1.4, y0 + len * 0.66, 3.6, 3.4);
  }
  // legs: feathered "trousers" with yellow feet gripping the branch (y = 46)
  ctx.fillStyle = falcon ? '#cfd7e0' : '#e1cba6'; ctx.beginPath(); ctx.ellipse(1, 28, 11, 12, 0, 0, Math.PI * 2); ctx.fill();
  for (const dx of [-3, 8]) { ctx.strokeStyle = '#f2c230'; ctx.lineCap = 'round'; ctx.lineWidth = 3.8; ctx.beginPath(); ctx.moveTo(dx, 34); ctx.lineTo(dx + grip, 45); ctx.stroke(); ctx.lineWidth = 2.4; for (const k of [-5.5, 0, 5.5]) { ctx.beginPath(); ctx.moveTo(dx + grip, 45); ctx.lineTo(dx + grip + k, 47); ctx.stroke(); ctx.strokeStyle = '#2a2024'; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(dx + grip + k, 47); ctx.lineTo(dx + grip + k * 1.2, 49.5); ctx.stroke(); ctx.strokeStyle = '#f2c230'; ctx.lineWidth = 2.4; } }
  // body: a full teardrop, slate back to cream chest, barring clipped inside
  const body = () => { ctx.beginPath(); ctx.moveTo(-6, -22); ctx.bezierCurveTo(-24, -14, -24, 22, -8, 34); ctx.bezierCurveTo(2, 40, 16, 34, 20, 14); ctx.bezierCurveTo(24, -6, 16, -24, 6, -26); ctx.bezierCurveTo(2, -27, -2, -25, -6, -22); ctx.closePath(); };
  const g = ctx.createLinearGradient(-22, 0, 22, 0); g.addColorStop(0, K.back); g.addColorStop(0.35, K.back); g.addColorStop(0.55, K.under); g.addColorStop(1, K.under);
  body(); ctx.fillStyle = g; ctx.fill();
  ctx.save(); body(); ctx.clip(); ctx.strokeStyle = K.bar; ctx.lineWidth = 1.3;
  for (let r = 0; r < 7; r++) for (let i = 0; i < 4; i++) { const x = 1 + i * 5.2 + (r % 2) * 2.6, y = -12 + r * 7; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2.6, y + 2.4); ctx.lineTo(x + 5.2, y); ctx.stroke(); }
  const sh = ctx.createLinearGradient(0, -26, 0, 36); sh.addColorStop(0, 'rgba(255,214,140,0.22)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(40,30,50,0.2)'); ctx.fillStyle = sh; ctx.fillRect(-26, -28, 52, 70);
  ctx.restore(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; body(); ctx.stroke();
  // folded wing: rounded shoulder, laid along the back; the tip crosses over the tail
  const wg = ctx.createLinearGradient(-20, -14, -4, 58); wg.addColorStop(0, K.wingMid); wg.addColorStop(1, K.wingOut);
  const wingP = () => { ctx.beginPath(); ctx.moveTo(-2, -20); ctx.bezierCurveTo(-18, -22, -27, 0, -23, 24); ctx.bezierCurveTo(-21, 40, -16, 54, -9, 63); ctx.bezierCurveTo(-5, 52, 1, 36, 1, 20); ctx.bezierCurveTo(1, 4, 2, -12, -2, -20); ctx.closePath(); };
  wingP(); ctx.fillStyle = wg; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.save(); wingP(); ctx.clip(); ctx.strokeStyle = K.bar; ctx.lineWidth = 1.1; for (let i = 0; i < 9; i++) { const y = -14 + i * 7.5; ctx.beginPath(); ctx.moveTo(-26, y); ctx.lineTo(2, y + 3); ctx.stroke(); }
  ctx.fillStyle = K.wingOut; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.moveTo(-12 + j * 2, 44 + j * 3); ctx.lineTo(-13 + j * 3.2, 66); ctx.lineTo(-6 + j * 2, 50 + j * 3); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  ctx.strokeStyle = rim; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(-2, -20); ctx.bezierCurveTo(-18, -22, -27, 0, -23, 24); ctx.stroke();
  // head: heavier brow, dark helmet + moustache + cream cheek (falcon) or paler streaked head (hawk), bright eye, hooked beak with a yellow cere
  ctx.save(); ctx.translate(5, -33); ctx.rotate(head + lock * -0.2);
  ctx.fillStyle = falcon ? '#222a37' : '#d4bd98'; ctx.beginPath(); ctx.ellipse(0, 0, 12, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = OUTLINE; ctx.stroke();
  if (falcon) {
    ctx.fillStyle = '#efe6d2'; ctx.beginPath(); ctx.moveTo(-2, 1); ctx.quadraticCurveTo(7, -1, 11, 6); ctx.quadraticCurveTo(5, 12, -3, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222a37'; ctx.beginPath(); ctx.moveTo(1.5, 1.5); ctx.lineTo(6, 3.5); ctx.quadraticCurveTo(6.5, 10, 3, 14); ctx.lineTo(-1, 11.5); ctx.quadraticCurveTo(1, 7, 1.5, 1.5); ctx.closePath(); ctx.fill();
  } else { ctx.fillStyle = '#6b4a2a'; ctx.beginPath(); ctx.ellipse(-3, -4, 9, 5.5, -0.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = falcon ? '#f2c230' : '#f0b030'; ctx.beginPath(); ctx.arc(5, -2.5, 4.4, 0, Math.PI * 2); ctx.fill();   // eye ring
  if (S.blink > 0) { ctx.strokeStyle = '#0b0b10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(2, -2.5); ctx.lineTo(8, -2.5); ctx.stroke(); }
  else { ctx.fillStyle = '#0b0b10'; ctx.beginPath(); ctx.arc(5.6, -2.5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(6.5, -3.5, 1, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = falcon ? '#151b25' : '#4a3220'; ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.5, -6.8); ctx.quadraticCurveTo(6, -9.5, 11, -5.8); ctx.stroke();   // heavy brow
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.ellipse(11, 1, 3.4, 3, 0, 0, Math.PI * 2); ctx.fill();   // cere
  ctx.fillStyle = '#8a93a1'; ctx.beginPath(); ctx.moveTo(10, -1.8); ctx.quadraticCurveTo(21, -2.2, 19.5, 9); ctx.quadraticCurveTo(15.5, 4, 10, 3.4); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.3; ctx.strokeStyle = OUTLINE; ctx.stroke();
  ctx.restore();
  ctx.restore();
}
