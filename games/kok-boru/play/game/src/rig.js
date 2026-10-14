// The horse and the rider, drawn procedurally in 2D with a real gait: four legs follow foot paths (stance slides back, swing lifts and reaches)
// and a two-bone solve puts the knee or hock where it belongs, so walking, trotting and galloping all come from one stride phase.
// Local space: metres, x forward, up is negative y. The caller has set the transform (scale = pixels per metre, mirrored when facing left).
const TAU = Math.PI * 2;
const sm = (v) => v * v * (3 - 2 * v);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// walk, then gallop: foot-fall offsets for HN, FN, HF, FF (gallop: hind far, hind near, fore far, fore near)
const WALK = { hn: 0.0, fn: 0.25, hf: 0.5, ff: 0.75 };
const GAL = { hf: 0.0, hn: 0.14, ff: 0.5, fn: 0.64 };
const L1 = 0.52, L2 = 0.58;           // upper and lower bone

function foot(u, st, half, lift) {
  // u in [0,1): returns [dx, dy(up positive)]
  if (u < st) { const k = u / st; return [half * (1 - 2 * k), 0]; }
  const v = (u - st) / (1 - st);
  return [-half + 2 * half * sm(v), lift * Math.pow(Math.sin(Math.PI * v), 0.8)];
}
// two-bone solve from hip (hx, hy) to foot (fx, fy); sign = +1 knee forward (fore), -1 knee backward (hind)
function solve(hx, hy, fx, fy, sign) {
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
  const maxd = L1 + L2 - 0.01;
  if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; fx = hx + dx; fy = hy + dy; }
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const mx = hx + dx * a / d, my = hy + dy * a / d;
  const kx = mx + sign * (dy / d) * h, ky = my - sign * (dx / d) * h;
  return { kx, ky, fx, fy };
}
// a tapered limb: the hull of two circles (radius ar at a, br at b), filled with the current fillStyle
function taper(ctx, ax, ay, ar, bx, by, br) {
  const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  if (d < 1e-4) { ctx.beginPath(); ctx.arc(ax, ay, Math.max(ar, br), 0, TAU); ctx.fill(); return; }
  const a = Math.atan2(dy, dx), k = Math.acos(clamp((ar - br) / d, -1, 1));
  ctx.beginPath();
  ctx.arc(ax, ay, ar, a + k, a - k + TAU, false);
  ctx.arc(bx, by, br, a - k, a + k, false);
  ctx.closePath(); ctx.fill();
}
function smoothClosed(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255), b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
};
export { shade };

// o: { ph, spd (m/s), t (clock for idle sway), horse, kit, trim, carry, lean (0..1), reachX, reachY, kind: 'grab'|'tug'|null, tugKick, throwP (0..1 throw progress, -1 none),
//      charge (0..1), stun, cheer }
export function drawHorseRider(ctx, o) {
  const spd = o.spd, g = clamp((spd - 2.4) / 4.2, 0, 1), mv = clamp(spd / 1.2, 0, 1);
  const ph = o.ph;
  const st = lerp(0.64, 0.36, g), half = lerp(0.22, 0.62, g) * mv, lift = lerp(0.1, 0.36, g) * mv;
  const off = { hn: lerp(WALK.hn, GAL.hn, g), fn: lerp(WALK.fn, GAL.fn, g), hf: lerp(WALK.hf, GAL.hf, g), ff: lerp(WALK.ff, GAL.ff, g) };
  const bob = (Math.sin(TAU * ph * 2 + 0.6) * 0.045 * g + Math.sin(TAU * ph * 2) * 0.012 * (1 - g)) * mv + Math.sin(o.t * 1.7) * 0.008 * (1 - mv);
  const pitch = (Math.sin(TAU * ph + 0.9) * 0.05 * g) * mv + Math.sin(o.t * 1.3) * 0.004;
  const coat = o.horse, dark = shade(o.horse, 0.62), mid = shade(o.horse, 0.82), hi = shade(o.horse, 1.25);
  const hipX = -0.78, shX = 0.62, hipY = -1.08 + bob, shY = -1.08 + bob;
  const leg = (hx, hy, u, sign) => {
    const [dx, dy] = foot(((u % 1) + 1) % 1, st, half, lift);
    return solve(hx, hy, hx + dx + (sign > 0 ? 0.1 : -0.1), -dy, sign);
  };
  const legs = {
    hf: leg(hipX - 0.04, hipY, ph + off.hf, -1), hn: leg(hipX + 0.04, hipY, ph + off.hn, -1),
    ff: leg(shX - 0.03, shY, ph + off.ff, 1), fn: leg(shX + 0.05, shY, ph + off.fn, 1),
  };
  const drawLeg = (L, hx, hy, col, hoofCol, w = 1) => {
    ctx.fillStyle = col;
    taper(ctx, hx, hy, 0.105 * w, L.kx, L.ky, 0.058 * w);                  // forearm / gaskin with its muscle
    taper(ctx, L.kx, L.ky, 0.052 * w, L.fx, L.fy - 0.07, 0.036 * w);       // cannon
    ctx.beginPath(); ctx.arc(L.kx, L.ky, 0.06 * w, 0, TAU); ctx.fill();    // knee / hock
    ctx.beginPath(); ctx.arc(L.fx, L.fy - 0.07, 0.044 * w, 0, TAU); ctx.fill();   // fetlock
    ctx.fillStyle = shade(o.horse, 0.5);
    taper(ctx, L.fx, L.fy - 0.07, 0.036 * w, L.fx + 0.05, L.fy - 0.02, 0.034 * w);
    ctx.fillStyle = hoofCol; ctx.beginPath(); ctx.moveTo(L.fx - 0.03, L.fy - 0.07); ctx.lineTo(L.fx + 0.13, L.fy); ctx.lineTo(L.fx - 0.045, L.fy); ctx.closePath(); ctx.fill();
  };
  ctx.save();
  // far legs
  drawLeg(legs.hf, hipX - 0.04, hipY, dark, '#241b16');
  drawLeg(legs.ff, shX - 0.03, shY, dark, '#241b16');
  // tail (behind the body): follow-through grows with speed
  const sway = Math.sin(TAU * ph * 2 + 1.7) * 0.12 * (0.4 + g) + Math.sin(o.t * 2.1) * 0.05;
  const tlen = lerp(0.55, 1.05, g);
  ctx.strokeStyle = dark; ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.lineWidth = 0.1 - k * 0.012; ctx.beginPath();
    ctx.moveTo(-1.0, -1.28 + bob);
    ctx.bezierCurveTo(-1.1 - 0.2 * g, -1.2 + bob + k * 0.02, -1.0 - tlen * 0.6, -1.1 + bob + 0.15 * g + sway * 0.6 + k * 0.03, -1.02 - tlen, -0.9 + bob + sway + k * 0.06 - 0.25 * g);
    ctx.stroke();
  }
  // body, whole torso pitching a little around the middle
  ctx.save(); ctx.translate(0, -1.0 + bob); ctx.rotate(pitch); ctx.translate(0, 1.0 - bob);
  const body = [[0.9, -0.88], [0.86, -1.2], [0.58, -1.5], [0.0, -1.46], [-0.55, -1.47], [-0.93, -1.38], [-1.1, -1.12], [-1.0, -0.86], [-0.55, -0.7], [0.1, -0.68], [0.55, -0.72]].map(([x, y]) => [x, y + bob]);
  const bg = ctx.createLinearGradient(0, -1.55 + bob, 0, -0.62 + bob);
  bg.addColorStop(0, hi); bg.addColorStop(0.45, coat); bg.addColorStop(1, dark);
  smoothClosed(ctx, body); ctx.fillStyle = bg; ctx.fill();
  // neck and head
  const ext = lerp(0, 0.12, g) + Math.sin(TAU * ph + 0.3) * 0.03 * g * mv;
  const hdn = 0.05 + Math.sin(TAU * ph * 2 + 2.0) * 0.04 * g * mv + (o.stun ? 0.18 : 0);
  const poll = [1.2 + ext, -1.82 + bob + 0.05 * g];
  const neck = [[0.4, -1.5 + bob], [0.72, -1.66 + bob], [poll[0] - 0.02, poll[1] - 0.05], [poll[0] + 0.12, poll[1] + 0.16], [1.02, -1.02 + bob], [0.75, -0.86 + bob]];
  smoothClosed(ctx, neck); ctx.fillStyle = coat; ctx.fill();
  ctx.save(); ctx.translate(poll[0], poll[1]); ctx.rotate(hdn);
  const head = [[-0.08, -0.04], [0.1, -0.08], [0.46, 0.2], [0.52, 0.34], [0.4, 0.4], [0.18, 0.3], [-0.02, 0.2]];
  smoothClosed(ctx, head); ctx.fillStyle = mid; ctx.fill();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.moveTo(0.02, -0.06); ctx.lineTo(0.0, -0.3); ctx.lineTo(0.12, -0.08); ctx.closePath(); ctx.fill();            // ear
  ctx.fillStyle = '#17120f'; ctx.beginPath(); ctx.arc(0.16, 0.03, 0.026, 0, TAU); ctx.fill();                                                          // eye
  ctx.fillStyle = shade(o.horse, 0.5); ctx.beginPath(); ctx.ellipse(0.47, 0.34, 0.07, 0.05, 0.4, 0, TAU); ctx.fill();                                // muzzle
  ctx.restore();
  // mane
  ctx.strokeStyle = dark; ctx.lineWidth = 0.07; ctx.beginPath();
  ctx.moveTo(0.5, -1.56 + bob); ctx.quadraticCurveTo(0.8, -1.75 + bob, poll[0] - 0.02, poll[1] - 0.04); ctx.stroke();
  for (let k = 0; k < 5; k++) {
    const f = k / 4, mx = lerp(0.52, poll[0] - 0.04, f), my = lerp(-1.55, poll[1] - 0.03, f) + bob - Math.sin(f * 3) * 0.1;
    ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 0.13 - 0.05 * g, my + 0.1 + Math.sin(TAU * ph * 2 + k) * 0.03 * g); ctx.stroke();
  }
  // blanket and saddle
  ctx.fillStyle = o.kit; ctx.beginPath(); ctx.moveTo(-0.42, -1.47 + bob); ctx.lineTo(0.38, -1.5 + bob); ctx.lineTo(0.34, -0.98 + bob); ctx.lineTo(-0.38, -0.98 + bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = o.trim; ctx.lineWidth = 0.035; ctx.beginPath(); ctx.moveTo(-0.38, -1.02 + bob); ctx.lineTo(0.34, -1.02 + bob); ctx.stroke();
  ctx.fillStyle = shade(o.kit, 0.7);
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-0.3 + k * 0.2, -1.0 + bob); ctx.lineTo(-0.2 + k * 0.2, -1.0 + bob); ctx.lineTo(-0.25 + k * 0.2, -0.9 + bob); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#5a3a24'; ctx.beginPath(); ctx.ellipse(0.0, -1.5 + bob, 0.34, 0.1, 0, Math.PI, TAU); ctx.fill();
  // reins to the bit
  ctx.strokeStyle = 'rgba(30,20,16,0.9)'; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.moveTo(0.62, -1.6 + bob); ctx.quadraticCurveTo(1.1 + ext, -1.55 + bob, poll[0] + 0.55, poll[1] + 0.6); ctx.stroke();
  ctx.restore();   // end of pitch
  // rider
  drawRider(ctx, o, bob, g, ph);
  // near legs over the body and the rider's boot
  drawLeg(legs.hn, hipX + 0.04, hipY, coat, '#1a1410');
  drawLeg(legs.fn, shX + 0.05, shY, coat, '#1a1410');
  ctx.restore();
}

function drawRider(ctx, o, bob, g, ph) {
  const seatX = 0.0, seatY = -1.52 + bob;
  const lean = o.lean || 0;
  const forward = 0.1 + g * 0.2 + lean * 0.95 + (o.charge || 0) * -0.15;
  const tl = 0.58;
  const sx = seatX + Math.sin(forward) * tl, sy = seatY - Math.cos(forward) * tl;
  const coat = o.kit, coatDark = shade(o.kit, 0.7);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // far leg and arm first
  ctx.fillStyle = coatDark; taper(ctx, seatX - 0.02, seatY + 0.04, 0.095, 0.28, -1.22 + bob, 0.065);
  ctx.fillStyle = '#2a1a12'; taper(ctx, 0.28, -1.22 + bob, 0.062, 0.2, -0.95 + bob, 0.05);
  // far arm: holds the reins
  const hand = { x: 0.62 + Math.sin(TAU * ph * 2) * 0.01, y: -1.55 + bob };
  { const mx = lerp(sx, hand.x, 0.5) - 0.02, my = lerp(sy, hand.y, 0.5) + 0.14;
    ctx.fillStyle = coatDark; taper(ctx, sx - 0.04, sy + 0.08, 0.06, mx, my, 0.048); taper(ctx, mx, my, 0.045, hand.x, hand.y, 0.036); }
  // torso (felt coat with sash)
  ctx.fillStyle = coat; taper(ctx, seatX, seatY, 0.18, sx, sy, 0.17);
  { const g2 = ctx.createLinearGradient(seatX - 0.2, 0, seatX + 0.25, 0); g2.addColorStop(0, 'rgba(0,0,0,0.0)'); g2.addColorStop(1, 'rgba(0,0,0,0.22)'); ctx.fillStyle = g2; taper(ctx, seatX, seatY, 0.18, sx, sy, 0.17); }
  ctx.strokeStyle = o.trim; ctx.lineWidth = 0.09; ctx.beginPath();
  ctx.moveTo(seatX + Math.sin(forward) * 0.12 - 0.15, seatY - Math.cos(forward) * 0.12); ctx.lineTo(seatX + Math.sin(forward) * 0.12 + 0.15, seatY - Math.cos(forward) * 0.12 + 0.01); ctx.stroke();
  // head and hat
  const hx = sx + Math.sin(forward) * 0.18, hy = sy - Math.cos(forward) * 0.18 - 0.05;
  ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(hx + 0.03, hy, 0.135, 0, TAU); ctx.fill();
  ctx.fillStyle = '#f6f2e8';                                           // tall white felt hat with a dark band
  ctx.beginPath(); ctx.moveTo(hx - 0.17, hy - 0.04); ctx.lineTo(hx - 0.11, hy - 0.3); ctx.quadraticCurveTo(hx + 0.03, hy - 0.4, hx + 0.17, hy - 0.3); ctx.lineTo(hx + 0.2, hy - 0.04); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c1f2e'; ctx.beginPath(); ctx.moveTo(hx - 0.17, hy - 0.04); ctx.lineTo(hx + 0.2, hy - 0.04); ctx.lineTo(hx + 0.19, hy - 0.11); ctx.lineTo(hx - 0.16, hy - 0.11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = o.trim; ctx.beginPath(); ctx.arc(hx + 0.02, hy - 0.36, 0.035, 0, TAU); ctx.fill();
  // near arm: depends on what the rider is doing
  let hX = hand.x, hY = hand.y + 0.0;
  const sh = { x: sx + 0.02, y: sy + 0.1 };
  if (o.throwP >= 0) {                                               // the throw: arm sweeps up and over
    const t = clamp(o.throwP, 0, 1), a = lerp(-2.7, 0.2, t);
    hX = sh.x + Math.cos(a) * 0.85; hY = sh.y + Math.sin(a) * 0.85;
  } else if (o.charge > 0.02) {
    const a = lerp(2.2, 3.5, clamp(o.charge, 0, 1)); hX = sh.x + Math.cos(a) * 0.75; hY = sh.y - Math.sin(a) * 0.75 * 0.9 - 0.2 + 0.15;
    hX = sh.x - 0.45 - 0.2 * o.charge; hY = sh.y - 0.45 - 0.3 * o.charge;
  } else if (o.kind === 'grab') {
    hX = o.reachX; hY = o.reachY;
  } else if (o.kind === 'tug') {
    const k = (o.tugKick || 0) * 0.15;
    hX = o.reachX + k; hY = o.reachY;
  } else if (o.carry) { hX = 0.52; hY = -1.12 + bob; }
  else if (o.cheer) { hX = sh.x + 0.25; hY = sh.y - 0.75 + Math.sin(o.t * 12) * 0.08; }
  // upper arm and forearm with an elbow that bends away from the target
  const ax = hX - sh.x, ay = hY - sh.y, ad = Math.hypot(ax, ay) || 0.001, ul = 0.34, fl = 0.36;
  const reach = Math.min(ad, ul + fl - 0.02);
  const a2 = (ul * ul - fl * fl + reach * reach) / (2 * reach), hh = Math.sqrt(Math.max(0, ul * ul - a2 * a2));
  const ex = sh.x + (ax / ad) * a2 + (ay / ad) * hh * 0.9, ey = sh.y + (ay / ad) * a2 - (ax / ad) * hh * 0.9;
  const hx2 = sh.x + (ax / ad) * reach, hy2 = sh.y + (ay / ad) * reach;
  ctx.fillStyle = coat; taper(ctx, sh.x, sh.y, 0.075, ex, ey, 0.058);
  ctx.fillStyle = shade(o.kit, 0.9); taper(ctx, ex, ey, 0.056, hx2, hy2, 0.042);
  ctx.fillStyle = '#e0b48c'; ctx.beginPath(); ctx.arc(hx2, hy2, 0.065, 0, TAU); ctx.fill();
  // near leg and boot
  ctx.fillStyle = coat; taper(ctx, seatX + 0.02, seatY + 0.05, 0.11, 0.36, -1.2 + bob, 0.075);
  ctx.fillStyle = '#3a2418'; taper(ctx, 0.36, -1.2 + bob, 0.072, 0.28, -0.92 + bob, 0.055);
  ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.ellipse(0.34, -0.9 + bob, 0.11, 0.05, 0.1, 0, TAU); ctx.fill();
  return { hand: { x: hx2, y: hy2 } };
}

// The ball: heavy stuffed leather, patched, with a soft highlight. (x, y) screen centre, r pixels.
export function drawBall(ctx, x, y, r, spin) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#d7a46a'); g.addColorStop(0.6, '#a2683a'); g.addColorStop(1, '#5d3820');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = 'rgba(40,22,10,0.75)'; ctx.lineWidth = Math.max(1, r * 0.1);
  for (let k = 0; k < 3; k++) {
    const a = spin + k * 1.05;
    ctx.beginPath(); ctx.ellipse(x, y, r * Math.abs(Math.cos(a)) + 0.5, r, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,16,8,0.85)'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
}
