// Drawing the sled and its rider. Everything is drawn in metres inside a local frame (x forward, y up) that is
// scaled to pixels, so the figure stays proportioned at any zoom. The pose follows the simulation: the kicking leg
// swings with the leg phase `p`, a tuck crouches the rider, a bump makes the body bob, wind lifts the scarf.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

// two-bone IK: the middle joint of a chain from `a` to `b` with segment lengths l1, l2; `dir` picks the bend side.
function ik(ax, ay, bx, by, l1, l2, dir) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const dm = clamp(d, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.005);
  if (d < 1e-6) { dx = 1; dy = 0; d = 1; }
  const ux = dx / d, uy = dy / d;
  const along = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return [ax + ux * along - uy * h * dir, ay + uy * along + ux * h * dir];
}

function limb(ctx, u, pts, w, col, edge) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0][0] * u, -pts[0][1] * u);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * u, -pts[i][1] * u);
  ctx.strokeStyle = edge; ctx.lineWidth = (w + 0.035) * u; ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = w * u; ctx.stroke();
}
function blob(ctx, u, x, y, rx, ry, rot, fill) {
  ctx.beginPath(); ctx.ellipse(x * u, -y * u, rx * u, ry * u, -rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
}

// o: { x, y (ground contact px), s (px per metre), ang (slope, radians), p, push, side, tuck, wobble, hop, v, t, skid,
//      jacket, hat, alpha, ghost, who (racer name, picks the 3D person), light ('day' | 'evening') }
export function drawRider(ctx, o) {
  const u = o.s;
  const tuck = o.tuckT ?? (o.tuck ? 1 : 0);
  const bob = Math.sin(o.t * 5.3) * 0.012 * (o.v > 0.5 ? 1 : 0) + (o.wobble ? Math.sin(o.t * 30) * 0.05 * o.wobble : 0);
  const hop = o.hop ? Math.sin(Math.PI * (1 - o.hop)) * 0.22 : 0;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(-o.ang + (o.wobble ? Math.sin(o.t * 24) * 0.05 * o.wobble : 0));
  if (o.ghost) ctx.globalAlpha = 0.45; else if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.translate(0, -hop * u);
  const jacket = o.jacket ?? '#2a8fd6', hat = o.hat ?? '#d33b2f';
  const dark = '#1b2733', skin = '#f1c9a5';

  // shadow on the snow
  ctx.save(); ctx.globalAlpha *= 0.28; ctx.translate(0, hop * u + 0.02 * u);
  ctx.beginPath(); ctx.ellipse(0.1 * u, 0.04 * u, 1.1 * u, 0.11 * u, 0, 0, Math.PI * 2); ctx.fillStyle = '#10203a'; ctx.fill(); ctx.restore();

  // real 3D rider and sled (presentation layer: web/view3d/riders.js), drawn into this same frame; the 2D figure below is the fallback
  const r3 = globalThis.__rider3d;
  if (r3 && r3.draw && r3.draw(ctx, o, u)) { ctx.restore(); return; }

  // ---- pose ----
  const hipX = lerp(-0.42, -0.34, tuck), hipY = lerp(0.98, 0.78, tuck) + bob - 0.05 * Math.sin(Math.PI * Math.min(1, o.push)) * 0.6;
  const lean = Math.sin(Math.PI * Math.min(1, o.push ?? 0));   // the whole body drives into the kick
  const shX = lerp(-0.12, 0.16, tuck) + 0.07 * lean * (1 - tuck), shY = lerp(1.62, 1.22, tuck) + bob - 0.05 * lean * (1 - tuck);
  const handX = 0.05, handY = 1.08;
  const standFoot = [-0.52, 0.33];
  // kicking foot: planted and pushing back (p < 0.3), then lifted and swung forward to hover by the footboard
  let kfx, kfy;
  if (tuck > 0.5) { kfx = -0.2; kfy = 0.33; }
  else if (o.p < 0.3) { const k = ease(o.p / 0.3); kfx = lerp(-0.6, -0.9, k); kfy = lerp(0.03, 0.1, k); }
  else { const k = ease((o.p - 0.3) / 0.7); kfx = lerp(-0.9, -0.5, k); kfy = 0.1 + Math.sin(Math.PI * k) * 0.32 + (o.p >= 1 ? 0.07 : 0) * k; }
  if (o.ghost) { /* same pose, faded */ }

  // far arm and kicking leg first (they sit behind the sled)
  const kneeK = ik(hipX, hipY, kfx, kfy, 0.52, 0.52, 1);
  limb(ctx, u, [[hipX, hipY], kneeK, [kfx, kfy]], 0.17, '#26364a', '#101a26');
  blob(ctx, u, kfx + 0.1, kfy + 0.02, 0.17, 0.07, 0, '#18222e');

  // far arm: the second hand on the handle, a touch behind
  { const e2 = ik(shX - 0.03, shY - 0.05, handX - 0.07, handY + 0.04, 0.33, 0.33, -1);
    limb(ctx, u, [[shX - 0.03, shY - 0.05], e2, [handX - 0.07, handY + 0.04]], 0.11, shade(jacket, -0.34), '#0e1a26'); }

  // ---- the sled ----
  // runner blade (steel) and its curled tip
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.8 * u, -0.03 * u); ctx.lineTo(0.92 * u, -0.03 * u);
  ctx.quadraticCurveTo(1.16 * u, -0.03 * u, 1.2 * u, -0.3 * u);
  ctx.lineTo(1.14 * u, -0.3 * u); ctx.quadraticCurveTo(1.1 * u, -0.1 * u, 0.9 * u, -0.1 * u);
  ctx.lineTo(-0.8 * u, -0.1 * u); ctx.closePath();
  ctx.fillStyle = '#c3cfdb'; ctx.fill(); ctx.strokeStyle = '#4b5b6b'; ctx.lineWidth = 0.025 * u; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-0.74 * u, -0.095 * u, 1.6 * u, 0.018 * u);
  // posts and the footboard
  ctx.strokeStyle = '#8c5a2b'; ctx.lineWidth = 0.05 * u;
  for (const px of [-0.55, 0.15, 0.82]) { ctx.beginPath(); ctx.moveTo(px * u, -0.08 * u); ctx.lineTo(px * u, -0.3 * u); ctx.stroke(); }
  ctx.fillStyle = '#b57a3a'; ctx.strokeStyle = '#5b3a18'; ctx.lineWidth = 0.02 * u;
  ctx.beginPath(); ctx.roundRect(-0.85 * u, -0.34 * u, 1.05 * u, 0.07 * u, 0.03 * u); ctx.fill(); ctx.stroke();
  // chair: seat, back and the handle that reaches back to the rider
  ctx.fillStyle = '#b57a3a';
  ctx.beginPath(); ctx.roundRect(0.18 * u, -0.5 * u, 0.82 * u, 0.07 * u, 0.03 * u); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#d6423a'; ctx.beginPath(); ctx.roundRect(0.26 * u, -0.57 * u, 0.7 * u, 0.09 * u, 0.04 * u); ctx.fill();
  ctx.strokeStyle = '#8c5a2b'; ctx.lineWidth = 0.05 * u;
  ctx.beginPath(); ctx.moveTo(0.22 * u, -0.34 * u); ctx.lineTo(0.2 * u, -0.5 * u); ctx.lineTo(0.3 * u, -1.0 * u); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0.82 * u, -0.3 * u); ctx.lineTo(0.84 * u, -0.5 * u); ctx.stroke();
  ctx.strokeStyle = '#2b3946'; ctx.lineWidth = 0.045 * u;
  ctx.beginPath(); ctx.moveTo(0.3 * u, -1.0 * u); ctx.lineTo(0.22 * u, -1.08 * u); ctx.lineTo(-0.05 * u, -1.08 * u); ctx.stroke();

  // standing leg, torso, arms, head
  const kneeS = ik(hipX, hipY, standFoot[0], standFoot[1], 0.52, 0.52, 1);
  limb(ctx, u, [[hipX, hipY], kneeS, standFoot], 0.18, '#2f4259', '#101a26');
  blob(ctx, u, standFoot[0] + 0.1, standFoot[1] + 0.03, 0.18, 0.075, 0, '#18222e');
  // torso: a tapered lit jacket
  const tx = shX - hipX, ty = shY - hipY, tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;
  ctx.beginPath();
  ctx.moveTo((hipX - nx * 0.13) * u, -(hipY - ny * 0.13) * u);
  ctx.quadraticCurveTo(((hipX + shX) / 2 - nx * 0.2) * u, -((hipY + shY) / 2 - ny * 0.2) * u, (shX - nx * 0.14) * u, -(shY - ny * 0.14) * u);
  ctx.lineTo((shX + nx * 0.14) * u, -(shY + ny * 0.14) * u);
  ctx.quadraticCurveTo(((hipX + shX) / 2 + nx * 0.17) * u, -((hipY + shY) / 2 + ny * 0.17) * u, (hipX + nx * 0.14) * u, -(hipY + ny * 0.14) * u);
  ctx.closePath();
  ctx.fillStyle = jacket; ctx.fill(); ctx.strokeStyle = 'rgba(8,16,28,0.65)'; ctx.lineWidth = 0.03 * u; ctx.stroke();
  // jacket highlight and a stripe
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse((shX + hipX) / 2 * u, -(shY + hipY) / 2 * u - 0.1 * u, 0.09 * u, 0.3 * u, -Math.atan2(tx, ty), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect((hipX - 0.3) * u, -(hipY + ty * 0.25 + 0.03) * u, 0.7 * u, 0.06 * u);
  ctx.restore();
  // arms to the handle (near arm)
  const elbow = ik(shX, shY - 0.04, handX, handY, 0.33, 0.33, -1);
  limb(ctx, u, [[shX, shY - 0.04], elbow, [handX, handY]], 0.12, shade(jacket, -0.18), '#0e1a26');
  blob(ctx, u, handX, handY, 0.07, 0.07, 0, '#2b3946');
  // head, hat, scarf
  const hx = shX + 0.09 + tuck * 0.1, hy = shY + 0.2 - tuck * 0.03;
  blob(ctx, u, hx, hy, 0.12, 0.135, 0, skin);
  ctx.beginPath(); ctx.ellipse(hx * u, -hy * u, 0.12 * u, 0.135 * u, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 0.02 * u; ctx.stroke();
  blob(ctx, u, hx + 0.045, hy + 0.01, 0.018, 0.022, 0, '#1b2733');
  // knit hat with a pom
  ctx.beginPath(); ctx.moveTo((hx - 0.13) * u, -(hy + 0.03) * u);
  ctx.quadraticCurveTo((hx - 0.1) * u, -(hy + 0.2) * u, (hx + 0.02) * u, -(hy + 0.19) * u);
  ctx.quadraticCurveTo((hx + 0.12) * u, -(hy + 0.17) * u, (hx + 0.12) * u, -(hy + 0.05) * u);
  ctx.closePath(); ctx.fillStyle = hat; ctx.fill(); ctx.strokeStyle = 'rgba(8,16,28,0.6)'; ctx.lineWidth = 0.02 * u; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect((hx - 0.13) * u, -(hy + 0.07) * u, 0.26 * u, 0.045 * u);
  blob(ctx, u, hx - 0.14, hy + 0.12, 0.05, 0.05, 0, '#fff');
  // scarf tail: a tapering ribbon that streams backward with speed and ripples (droops when slow)
  const sp = clamp((o.v ?? 0) / 9, 0, 1), len = 0.34 + sp * 0.5, N = 7;
  const sx0 = shX + 0.02, sy0 = shY + 0.03;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < N; k++) {
    const t0 = k / N, t1 = (k + 1) / N;
    const pt = (t) => [sx0 - t * len, sy0 - (1 - sp) * 0.5 * t * t + Math.sin(o.t * 9 - t * 6) * 0.05 * t * (0.4 + sp)];
    const A = pt(t0), B = pt(t1);
    ctx.beginPath(); ctx.moveTo(A[0] * u, -A[1] * u); ctx.lineTo(B[0] * u, -B[1] * u);
    ctx.strokeStyle = k % 3 === 1 ? '#d33b2f' : '#ffd36a'; ctx.lineWidth = lerp(0.11, 0.05, t1) * u; ctx.stroke();
  }
  ctx.restore();
}

export function shade(hex, amt) {
  let r, g, b;
  if (hex[0] === 'r') { [r, g, b] = hex.match(/\d+/g).map(Number); } else { const n = parseInt(hex.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  const f = (c) => Math.round(clamp(c + 255 * amt, 0, 255));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// the timing ring: a dial that fills as the leg swings back and glows when the kick is ready
export function drawRing(ctx, cx, cy, rad, p, late, kind) {
  const two = Math.PI * 2, a0 = -Math.PI / 2;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, two); ctx.strokeStyle = 'rgba(8,24,44,0.55)'; ctx.lineWidth = rad * 0.34; ctx.stroke();
  // the target zone
  ctx.beginPath(); ctx.arc(cx, cy, rad, a0 + two * 0.82, a0 + two, false); ctx.strokeStyle = 'rgba(70,220,160,0.55)'; ctx.lineWidth = rad * 0.34; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, rad, a0 + two * 0.9, a0 + two, false); ctx.strokeStyle = 'rgba(255,230,120,0.75)'; ctx.lineWidth = rad * 0.34; ctx.stroke();
  const ready = p >= 1;
  ctx.beginPath(); ctx.arc(cx, cy, rad, a0, a0 + two * Math.min(1, p), false);
  ctx.strokeStyle = ready ? '#ffffff' : p >= 0.82 ? '#d9fff0' : '#9fd0ff'; ctx.lineWidth = rad * 0.2; ctx.stroke();
  if (ready) {
    const k = Math.max(0, 1 - late / 0.5);
    ctx.beginPath(); ctx.arc(cx, cy, rad * (1.3 + (1 - k) * 0.3), 0, two); ctx.strokeStyle = `rgba(255,236,150,${0.2 + 0.5 * k})`; ctx.lineWidth = rad * 0.1; ctx.stroke();
  }
  ctx.restore();
}
