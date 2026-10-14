// The players: jointed, shaded people drawn on canvas in a side view. Legs and arms are solved with two-bone IK, so a run
// cycle, a ready crouch, a high-reaching smash and a follow-through all come from the same skeleton and move smoothly.
// Pure drawing: reads a pose description and never writes game state.

const TAU = Math.PI * 2;
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => { const k = clampv(t, 0, 1); return k * k * (3 - 2 * k); };

// look 0..4 rivals, 5 you, 6 your partner
export const LOOKS = [
  { skin: '#d9a273', skinD: '#b07a50', hair: '#1f140e', style: 'short', shirt: '#e5483a', shirtD: '#aa2d22', trim: '#ffe7a8', shorts: '#243b6b', shoes: '#f3f0e6', fem: false, band: null, name: 'tan' },
  { skin: '#8d5a3b', skinD: '#6b3f27', hair: '#150d0a', style: 'pony', shirt: '#1fb5a6', shirtD: '#138074', trim: '#ffffff', shorts: '#f4f0e0', shoes: '#ffcf44', fem: true, band: '#ffcf44', name: 'brown' },
  { skin: '#f0c9a4', skinD: '#cf9b74', hair: '#c79a43', style: 'short', shirt: '#f4c534', shirtD: '#c79715', trim: '#1b6a3a', shorts: '#1b6a3a', shoes: '#f5f5f5', fem: false, band: '#1b6a3a', name: 'light' },
  { skin: '#b97a50', skinD: '#935c38', hair: '#2b1810', style: 'bun', shirt: '#7a4fd0', shirtD: '#5634a0', trim: '#ffd1ef', shorts: '#2a2440', shoes: '#ff7ab0', fem: true, band: null, name: 'bronze' },
  { skin: '#5c3a28', skinD: '#432616', hair: '#0f0a08', style: 'curly', shirt: '#2f9a45', shirtD: '#1d6d2f', trim: '#f7e04a', shorts: '#14243a', shoes: '#f2f2f2', fem: false, band: null, name: 'dark' },
  { skin: '#c68a5e', skinD: '#9f6a43', hair: '#19100c', style: 'short', shirt: '#2a62d9', shirtD: '#1c43a0', trim: '#ffcf44', shorts: '#f6f0dc', shoes: '#ff9b2b', fem: false, band: '#ffcf44', name: 'you' },
  { skin: '#d2a07a', skinD: '#ab7852', hair: '#3a2314', style: 'pony', shirt: '#ff8a2b', shirtD: '#c4600f', trim: '#ffffff', shorts: '#2a3d6e', shoes: '#ffffff', fem: true, band: '#ffffff', name: 'partner' },
];

// Two-bone IK in the x/z plane (z up). Returns the middle joint; bend > 0 puts the knee/elbow forward (+x).
function ik(ax, az, tx, tz, l1, l2, bend) {
  let dx = tx - ax, dz = tz - az, d = Math.hypot(dx, dz);
  const dmax = l1 + l2 - 0.002, dmin = Math.abs(l1 - l2) + 0.02;
  if (d > dmax) { dx *= dmax / d; dz *= dmax / d; d = dmax; }
  if (d < dmin) d = dmin;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / (d || 1), uz = dz / (d || 1);
  const mx = ax + ux * a, mz = az + uz * a;
  // perpendicular, chosen so the joint points forward (bend > 0) or backward
  const px = -uz, pz = ux;
  const s = (px * bend >= 0) ? 1 : -1;
  return { x: mx + px * h * s, z: mz + pz * h * s, ex: ax + dx, ez: az + dz };
}

// A tapered limb segment between two points (metres -> pixels through `P`).
function limb(ctx, P, x0, z0, r0, x1, z1, r1, fill, edge) {
  const [ax, ay] = P(x0, z0), [bx, by] = P(x1, z1);
  const s = P.s;
  const a = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
  const c = Math.cos(a), sn = Math.sin(a);
  ctx.beginPath();
  ctx.moveTo(ax + c * r0 * s, ay + sn * r0 * s);
  ctx.lineTo(bx + c * r1 * s, by + sn * r1 * s);
  ctx.arc(bx, by, r1 * s, a, a + Math.PI, true);
  ctx.lineTo(ax - c * r0 * s, ay - sn * r0 * s);
  ctx.arc(ax, ay, r0 * s, a + Math.PI, a + TAU, true);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (edge) { ctx.lineWidth = Math.max(0.6, s * 0.008); ctx.strokeStyle = edge; ctx.stroke(); }
}

// A whole limb (several segments) drawn as one silhouette: every segment's dark outline first, then every fill, so joints have no seams.
function limbs(ctx, P, segs, edge) {
  const g = 0.014;
  for (const q of segs) limb(ctx, P, q[0], q[1], q[2] + g, q[3], q[4], q[5] + g, edge, null);
  for (const q of segs) limb(ctx, P, q[0], q[1], q[2], q[3], q[4], q[5], q[6], null);
}

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const r = clampv(Math.round(((n >> 16) & 255) * k), 0, 255), g = clampv(Math.round(((n >> 8) & 255) * k), 0, 255), b = clampv(Math.round((n & 255) * k), 0, 255);
  return `rgb(${r},${g},${b})`;
};

// o: { x, gy, s, f (+1 faces right), look, run (distance run, m), v (m/s), ready 0..1, anim {t, shot, cx, cz, perfect}, jump (m), t (clock s), alpha }
// ball: optional { x, z } world position so a waiting player can look at the peteca.
// The optional 3D presenter (web/main.js) registers itself here; src never imports it. person3d(ctx, o) returns false when it cannot draw.
export const hooks = { person3d: null, beginFrame: null };

export function drawPerson(ctx, o) {
  if (hooks.person3d && hooks.person3d(ctx, o)) return;
  const L = LOOKS[o.look] ?? LOOKS[0], f = o.f, s = o.s;
  const P = (x, z) => [o.x + x * f * s, o.gy - z * s];
  P.s = s;
  const speed = Math.min(1, Math.abs(o.v || 0) / 4.5);
  const moving = speed > 0.08;
  const ph = (o.run || 0) * 2.9;                          // run phase from distance covered
  const idle = Math.sin((o.t || 0) * 2.1 + o.look) * 0.012;
  const an = o.anim;
  const k = an ? an.t : 9;                                // seconds since the palm hit
  const striking = an && k < 0.55;
  const rdy = o.ready || 0;

  // body height: a crouch when running hard or ready; a jump for a smash
  const crouch = 0.035 + speed * 0.05 + rdy * 0.03 + (striking ? 0.03 * Math.exp(-k * 6) : 0);
  const jump = o.jump || 0;
  const hipZ = 0.93 - crouch + jump + idle * 0.3;
  const lean = (0.1 + speed * 0.22 + rdy * 0.06) * (1) + (striking ? 0.18 * Math.sin(clampv(k / 0.3, 0, 1) * Math.PI) : 0);
  // visual lunge: when the contact is further than the arm reaches the body steps toward it
  let lunge = 0;
  if (an && an.cx !== undefined && k < 0.5) {
    const arm = 0.7, dxw = (an.cx - o.wx) * f;
    const over = Math.max(0, dxw - arm);
    lunge = clampv(over, 0, 0.55) * (1 - ease(k / 0.45));
  }
  const px = lunge;                                       // pelvis x offset (m, forward)
  const sh = [px + Math.sin(lean) * 0.5 + 0.03, hipZ + Math.cos(lean) * 0.5];  // shoulder
  const neck = [sh[0] + Math.sin(lean + 0.12) * 0.1, sh[1] + Math.cos(lean + 0.12) * 0.1];
  const head = [neck[0] + Math.sin(lean + 0.18) * 0.13, neck[1] + Math.cos(lean + 0.18) * 0.13];
  const rHead = 0.108;

  // ---- legs ---------------------------------------------------------------------------------------------------------------
  const stride = (0.12 + speed * 0.36);
  const legPose = (idx) => {
    const p = ph + idx * Math.PI;
    if (!moving) {
      const stance = idx === 0 ? 0.17 : -0.15;
      const lift = striking && idx === 0 ? 0.08 * Math.sin(clampv(k / 0.4, 0, 1) * Math.PI) : 0;
      return { x: px * 0.5 + stance + (rdy > 0 ? (idx === 0 ? 0.08 : -0.1) * rdy : 0), z: lift };
    }
    return { x: px * 0.5 + Math.sin(p) * stride, z: Math.max(0, Math.cos(p)) * (0.07 + speed * 0.22) };
  };
  const hip = [px - 0.02, hipZ];
  const jumpLegs = jump > 0.02;
  const legs = [0, 1].map((i) => {
    const ft = legPose(i);
    if (jumpLegs) { ft.x = px + (i === 0 ? 0.12 : -0.14); ft.z = jump * 0.9 + (i === 0 ? 0.0 : 0.1); }
    const foot = [hip[0] + 0.0 + ft.x, ft.z + (jumpLegs ? 0 : 0)];
    const j = ik(hip[0], hip[1], foot[0], foot[1] + 0.05, 0.47, 0.47, 1);
    return { hip, knee: [j.x, j.z], ankle: [foot[0], foot[1] + 0.05], toe: [foot[0] + 0.13, foot[1] + 0.025], heel: [foot[0] - 0.07, foot[1] + 0.03] };
  });

  // ---- arms ---------------------------------------------------------------------------------------------------------------
  const armSwing = moving ? Math.sin(ph) * (0.18 + speed * 0.3) : Math.sin((o.t || 0) * 1.6 + o.look) * 0.02;
  const farHand = [sh[0] + 0.06 - armSwing * 0.9, sh[1] - 0.52 + Math.abs(armSwing) * 0.12 + (rdy > 0.4 ? 0.14 : 0)];
  let nearHand;
  if (an && striking && an.cx !== undefined) {
    const cx = (an.cx - o.wx) * f, cz = an.cz - (jump > 0 ? 0 : 0);
    const c = [cx + lunge * 0 - 0.0, cz];
    const follow = [sh[0] + 0.5, sh[1] - 0.3];
    const wind = [sh[0] - 0.25, sh[1] + 0.12];
    if (k < 0.07) nearHand = [lerp(wind[0], c[0], ease(k / 0.07)), lerp(wind[1], c[1], ease(k / 0.07))];
    else nearHand = [lerp(c[0], follow[0], ease((k - 0.07) / 0.34)), lerp(c[1], follow[1], ease((k - 0.07) / 0.34))];
    if (k >= 0.07) { /* settle */ }
  } else if (rdy > 0.05) {
    // ready: the palm is cocked back and up, ready to swing through the contact height
    const up = [sh[0] - 0.14, sh[1] + 0.06 + 0.1 * Math.sin((o.t || 0) * 5) * 0.2];
    const down = [sh[0] + 0.1 + armSwing, sh[1] - 0.5];
    nearHand = [lerp(down[0], up[0], rdy), lerp(down[1], up[1], rdy)];
  } else nearHand = [sh[0] + 0.06 + armSwing * 0.9, sh[1] - 0.52 + Math.abs(armSwing) * 0.1];
  const U = 0.3, F = 0.3;
  const armJ = (hand, bend) => { const j = ik(sh[0], sh[1], hand[0], hand[1], U, F, bend); return { sh, elbow: [j.x, j.z], hand: [j.ex, j.ez] }; };
  const nearArm = armJ(nearHand, striking ? -1 : 1);
  const farArm = armJ(farHand, 1);

  // ---- draw ---------------------------------------------------------------------------------------------------------------
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const edge = 'rgba(30,18,10,0.35)';
  // ground shadow
  const [sx, sy] = P(px * 0.5 - 0.02, 0);
  const shw = (0.34 + speed * 0.06) * s * (1 - clampv(jump * 0.8, 0, 0.35));
  const sg = ctx.createRadialGradient(sx, o.gy + 2, 2, sx, o.gy + 2, shw);
  sg.addColorStop(0, 'rgba(30,20,10,0.38)'); sg.addColorStop(1, 'rgba(30,20,10,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(sx + 0.12 * s * f * 0 , o.gy + 2, shw, shw * 0.2, 0, 0, TAU); ctx.fill();
  void sy;

  const drawLeg = (g, far) => {
    const skin = far ? L.skinD : L.skin;
    // thigh and calf
    const shortsCol = far ? shade(L.shorts, 0.78) : L.shorts;
    const t = 0.55, mx = g.hip[0] + (g.knee[0] - g.hip[0]) * t, mz = g.hip[1] + (g.knee[1] - g.hip[1]) * t;
    const shoe = far ? shade(L.shoes, 0.75) : L.shoes;
    limbs(ctx, P, [
      [g.hip[0], g.hip[1], 0.1, g.knee[0], g.knee[1], 0.072, skin],
      [g.knee[0], g.knee[1], 0.07, g.ankle[0], g.ankle[1] + 0.02, 0.045, skin],
      [g.ankle[0], g.ankle[1] + 0.07, 0.048, g.ankle[0], g.ankle[1] - 0.005, 0.05, '#f2f2f2'],
      [g.heel[0], g.heel[1] + 0.025, 0.056, g.toe[0], g.toe[1] + 0.012, 0.045, shoe],
    ], 'rgba(40,22,10,0.62)');
    // shorts leg over the thigh
    limbs(ctx, P, [[g.hip[0], g.hip[1] + 0.03, 0.118, mx, mz, 0.098, shortsCol]], 'rgba(10,10,20,0.5)');
  };
  const drawArm = (a, far) => {
    const skin = far ? L.skinD : L.skin;
    const dx = a.hand[0] - a.elbow[0], dz = a.hand[1] - a.elbow[1], d = Math.hypot(dx, dz) || 1;
    limbs(ctx, P, [
      [a.sh[0], a.sh[1] - 0.02, 0.066, a.elbow[0], a.elbow[1], 0.052, skin],
      [a.elbow[0], a.elbow[1], 0.05, a.hand[0], a.hand[1], 0.036, skin],
      // open palm: a rounded hand continuing the forearm
      [a.hand[0], a.hand[1], 0.04, a.hand[0] + (dx / d) * 0.1, a.hand[1] + (dz / d) * 0.1, 0.043, skin],
    ], 'rgba(40,22,10,0.62)');
    const sl = 0.34;
    limbs(ctx, P, [[a.sh[0], a.sh[1] - 0.01, 0.082, a.sh[0] + (a.elbow[0] - a.sh[0]) * sl, a.sh[1] + (a.elbow[1] - a.sh[1]) * sl, 0.072, far ? L.shirtD : L.shirt]], 'rgba(10,10,20,0.45)');
  };

  // far arm and far leg first
  drawArm(farArm, true);
  drawLeg(legs[1], true);

  // torso: a tapered shape from hips to shoulders, shirt over it, shorts waist
  {
    const [hx, hy] = P(hip[0], hip[1]), [tx, ty] = P(sh[0], sh[1]);
    const ang = Math.atan2(ty - hy, tx - hx);
    const len = Math.hypot(tx - hx, ty - hy);
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    const wS = (L.fem ? 0.105 : 0.12) * s, wH = (L.fem ? 0.105 : 0.098) * s;       // half-depth at shoulder and hip
    const g = ctx.createLinearGradient(0, -wS, 0, wS); g.addColorStop(0, L.shirt); g.addColorStop(0.55, L.shirt); g.addColorStop(1, L.shirtD);
    ctx.beginPath();
    ctx.moveTo(0, -wH); ctx.quadraticCurveTo(len * 0.5, -wS * 0.92 - (L.fem ? 0 : 0), len, -wS);
    ctx.quadraticCurveTo(len + wS * 0.55, 0, len, wS);
    ctx.quadraticCurveTo(len * 0.5, wS * (L.fem ? 0.78 : 0.95), 0, wH);
    ctx.quadraticCurveTo(-wH * 0.7, 0, 0, -wH);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = Math.max(0.6, s * 0.008); ctx.strokeStyle = 'rgba(30,18,10,0.4)'; ctx.stroke();
    // trim stripe along the hem and a chest mark
    ctx.fillStyle = L.trim; ctx.globalAlpha = 0.9 * (o.alpha ?? 1);
    ctx.fillRect(len * 0.04, -wH * 0.98, len * 0.09, wH * 1.96);
    ctx.globalAlpha = o.alpha ?? 1;
    // shorts waist
    ctx.fillStyle = L.shorts; ctx.beginPath(); ctx.ellipse(-0.005 * s, 0, 0.1 * s, wH * 1.02, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  // neck
  limbs(ctx, P, [[sh[0] + 0.0, sh[1], 0.055, neck[0] + 0.01, neck[1] + 0.03, 0.05, L.skin]], 'rgba(40,22,10,0.62)');
  drawLeg(legs[0], false);
  // head
  {
    const [hx, hy] = P(head[0], head[1]), r = rHead * s;
    // back hair first (pony / bun / curls)
    ctx.fillStyle = L.hair;
    const bx = hx - f * r * 0.85, by = hy - r * 0.1;
    if (L.style === 'pony') {
      const sw = Math.sin((o.t || 0) * 6 + ph) * 0.12 * (0.3 + speed) - speed * 0.3 + (striking ? 0.15 : 0);
      ctx.beginPath(); ctx.ellipse(bx - f * r * 0.35, by + r * (0.2 + sw), r * 0.3, r * 0.75, -f * (0.5 + sw), 0, TAU); ctx.fill();
    } else if (L.style === 'bun') { ctx.beginPath(); ctx.arc(hx - f * r * 0.35, hy - r * 1.05, r * 0.42, 0, TAU); ctx.fill(); }
    else if (L.style === 'curly') { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.85 + i * 0.16) * -1; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * r * 0.95, hy + Math.sin(a) * r * 0.95, r * 0.38, 0, TAU); ctx.fill(); } }
    // face
    const fg = ctx.createRadialGradient(hx + f * r * 0.2, hy - r * 0.2, r * 0.2, hx, hy, r * 1.15);
    fg.addColorStop(0, L.skin); fg.addColorStop(1, L.skinD);
    ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(hx, hy, r * 0.96, r * 1.06, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = Math.max(0.6, s * 0.008); ctx.strokeStyle = 'rgba(30,18,10,0.4)'; ctx.stroke();
    // nose and ear
    ctx.fillStyle = L.skin; ctx.beginPath(); ctx.moveTo(hx + f * r * 0.86, hy - r * 0.05); ctx.lineTo(hx + f * r * 1.15, hy + r * 0.28); ctx.lineTo(hx + f * r * 0.8, hy + r * 0.34); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = L.skinD; ctx.beginPath(); ctx.ellipse(hx - f * r * 0.15, hy + r * 0.08, r * 0.2, r * 0.3, 0, 0, TAU); ctx.fill();
    // eye (looks at the peteca), brow, mouth
    let ex = 0, ey = 0;
    if (o.ball) { const dx = (o.ball.x - o.wx) * f, dz = o.ball.z - head[1]; const d = Math.hypot(dx, dz) || 1; ex = dx / d; ey = -dz / d; }
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.ellipse(hx + f * r * 0.5, hy - r * 0.12, r * 0.2, r * 0.15, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#20150e'; ctx.beginPath(); ctx.arc(hx + f * r * 0.5 + ex * r * 0.07 * f, hy - r * 0.12 + ey * r * 0.05, r * 0.08, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(L.hair, 1.2); ctx.lineWidth = Math.max(1, r * 0.12); ctx.beginPath(); ctx.moveTo(hx + f * r * 0.28, hy - r * 0.34); ctx.lineTo(hx + f * r * 0.74, hy - r * 0.3); ctx.stroke();
    ctx.strokeStyle = 'rgba(80,30,20,0.7)'; ctx.lineWidth = Math.max(1, r * 0.09); ctx.beginPath(); ctx.moveTo(hx + f * r * 0.42, hy + r * 0.5); ctx.lineTo(hx + f * r * 0.72, hy + r * 0.46); ctx.stroke();
    // top hair
    ctx.fillStyle = L.hair; ctx.beginPath();
    if (L.style === 'curly') { ctx.arc(hx - f * r * 0.1, hy - r * 0.45, r * 1.0, Math.PI * 1.02, Math.PI * 1.95); ctx.fill(); }
    else {
      ctx.moveTo(hx + f * r * 0.7, hy - r * 0.55);
      ctx.bezierCurveTo(hx + f * r * 0.6, hy - r * 1.3, hx - f * r * 0.9, hy - r * 1.3, hx - f * r * 1.0, hy - r * 0.1);
      ctx.bezierCurveTo(hx - f * r * 0.85, hy - r * 0.35, hx - f * r * 0.2, hy - r * 0.6, hx + f * r * 0.7, hy - r * 0.55);
      ctx.fill();
    }
    if (L.band) { ctx.strokeStyle = L.band; ctx.lineWidth = r * 0.28; ctx.beginPath(); ctx.arc(hx - f * r * 0.02, hy - r * 0.2, r * 0.98, Math.PI * 1.08, Math.PI * 1.9); ctx.stroke(); }
  }
  drawArm(nearArm, false);
  ctx.restore();
}

export const personHeight = 1.78;
