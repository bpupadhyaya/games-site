// A girl in hanbok, seen from the side: braided hair with a ribbon, a short jacket (jeogori) with a white collar and a long ribbon, a
// high-waisted full skirt (chima) and white shoes. Drawn from a handful of continuous parameters (crouch, arm swing, vertical speed),
// so every pose in between is a smooth blend. Lit with soft gradients and a dark rim. Pure canvas 2D; a function of its arguments.
const TAU = Math.PI * 2;
const H = Math.PI / 2;

export const OUTFITS = [
  { jeo: '#ffd24a', jeoDk: '#d99a14', jeoHi: '#fff0a6', collar: '#fffaf0', trim: '#d43a56', chima: '#cf2a50', chimaDk: '#7c1130', chimaHi: '#ff7390', hair: '#1c1215', ribbon: '#e8344f', gold: '#ffe08a' },
  { jeo: '#ffc4da', jeoDk: '#e78cb0', jeoHi: '#fff0f6', collar: '#ffffff', trim: '#1fa59c', chima: '#2468b4', chimaDk: '#0e2f62', chimaHi: '#6fa8ec', hair: '#1c1215', ribbon: '#ffd24a', gold: '#ffe9a0' },
  { jeo: '#9ad66f', jeoDk: '#5fa63a', jeoHi: '#dcf7b8', collar: '#fffaf0', trim: '#f08a24', chima: '#d83c3c', chimaDk: '#7a1616', chimaHi: '#ff8b7a', hair: '#1c1215', ribbon: '#ffffff', gold: '#ffe08a' },
  { jeo: '#b9a2f0', jeoDk: '#7d61cf', jeoHi: '#e6dcff', collar: '#ffffff', trim: '#ffd24a', chima: '#16938c', chimaDk: '#085049', chimaHi: '#6fe0d4', hair: '#1c1215', ribbon: '#ff6f91', gold: '#ffe9a0' },
];
const SKIN = { base: '#f6cba2', hi: '#ffe6cc', lo: '#d79c70', blush: 'rgba(255,120,120,0.42)' };
const RIM = 'rgba(30,12,16,0.5)';

// o: { x, y (feet centre on screen), s (pixels per metre), face (+1 looks right, -1 left), crouch 0..1, arm (radians: 0 down, PI/2
//      forward, PI up), vy (m/s, up positive), t (seconds, for the braid and blink), outfit (index or object), open (mouth 0..1),
//      alpha, rise (0..1 how far the legs are extended: tiptoe) }
export function drawGirl(ctx, o) {
  const s = o.s, face = o.face ?? 1, c = Math.max(0, Math.min(1, o.crouch ?? 0)), vy = o.vy ?? 0, t = o.t ?? 0;
  const pal = typeof o.outfit === 'object' ? o.outfit : OUTFITS[(o.outfit ?? 0) % OUTFITS.length];
  const X = (lx) => o.x + face * lx * s, Y = (ly) => o.y - ly * s;
  const air = o.air ?? false;
  const drop = c * 0.2 + (o.land ?? 0) * 0.05;
  const lean = 0.05 + c * 0.2 - (air ? Math.max(-0.1, Math.min(0.12, vy * 0.03)) : 0);
  const waist = [0, 0.95 - drop];
  const sh = [waist[0] + Math.sin(lean) * 0.27, waist[1] + Math.cos(lean) * 0.27];       // shoulder
  const tilt = lean + (air ? 0.05 : 0) - c * 0.05;
  const head = [sh[0] + Math.sin(tilt) * 0.19 + 0.01, sh[1] + Math.cos(tilt) * 0.19];
  const hr = 0.118;
  const flare = air ? Math.max(0, -vy) * 0.018 : 0, drag = air ? Math.max(0, vy) * 0.012 : 0;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const poly = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1])))); };
  const circ = (cx, cy, r) => { ctx.beginPath(); ctx.arc(X(cx), Y(cy), r * s, 0, TAU); };

  // ---- the far arm (behind the body, a little darker) ---------------------------------------------------------------------------
  const armGeom = (ang, spread) => {
    const a = ang + spread, ux = Math.sin(a), uy = -Math.cos(a);            // direction of the upper arm (0 = straight down)
    const el = [sh[0] + ux * 0.25, sh[1] + uy * 0.25];
    const bend = 0.2 + 0.25 * (1 - Math.min(1, Math.abs(Math.sin(ang))));
    const b = a + bend, hand = [el[0] + Math.sin(b) * 0.23, el[1] - Math.cos(b) * 0.23];
    return { el, hand };
  };
  const sleeve = (g, col, colDk, dark) => {
    const p0 = [sh[0] - 0.005, sh[1] - 0.02], d1 = [g.el[0] - p0[0], g.el[1] - p0[1]], d2 = [g.hand[0] - g.el[0], g.hand[1] - g.el[1]];
    const len1 = Math.hypot(d1[0], d1[1]) || 1, len2 = Math.hypot(d2[0], d2[1]) || 1;
    const n1 = [-d1[1] / len1, d1[0] / len1], n2 = [-d2[1] / len2, d2[0] / len2];
    const w0 = 0.055, w1 = 0.062, w2 = 0.095;       // the sleeve widens towards the cuff
    const pts = [
      [p0[0] + n1[0] * w0, p0[1] + n1[1] * w0], [g.el[0] + (n1[0] + n2[0]) * 0.5 * w1, g.el[1] + (n1[1] + n2[1]) * 0.5 * w1], [g.hand[0] + n2[0] * w2, g.hand[1] + n2[1] * w2],
      [g.hand[0] - n2[0] * w2, g.hand[1] - n2[1] * w2], [g.el[0] - (n1[0] + n2[0]) * 0.5 * w1, g.el[1] - (n1[1] + n2[1]) * 0.5 * w1], [p0[0] - n1[0] * w0, p0[1] - n1[1] * w0],
    ];
    poly(pts); ctx.closePath();
    const g0 = ctx.createLinearGradient(X(p0[0]), Y(p0[1]), X(g.hand[0]), Y(g.hand[1]));
    g0.addColorStop(0, col); g0.addColorStop(1, colDk);
    ctx.fillStyle = dark ? colDk : g0; ctx.fill();
    ctx.lineWidth = 0.014 * s; ctx.strokeStyle = RIM; ctx.stroke();
    // coloured stripe near the cuff and the white cuff band
    const m = (k) => [g.el[0] + d2[0] * k, g.el[1] + d2[1] * k];
    const band = (k0, k1, color) => {
      const a0 = m(k0), a1 = m(k1), wA = w1 + (w2 - w1) * k0, wB = w1 + (w2 - w1) * k1;
      poly([[a0[0] + n2[0] * wA, a0[1] + n2[1] * wA], [a1[0] + n2[0] * wB, a1[1] + n2[1] * wB], [a1[0] - n2[0] * wB, a1[1] - n2[1] * wB], [a0[0] - n2[0] * wA, a0[1] - n2[1] * wA]]);
      ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    };
    if (!dark) { band(0.55, 0.68, pal.trim); band(0.76, 0.99, pal.collar); }
    else { band(0.76, 0.99, '#cfc3ad'); }
    circ(g.hand[0] + d2[0] / len2 * 0.05, g.hand[1] + d2[1] / len2 * 0.05, 0.043); ctx.fillStyle = dark ? SKIN.lo : SKIN.base; ctx.fill();
    ctx.lineWidth = 0.01 * s; ctx.strokeStyle = RIM; ctx.stroke();
  };
  const armAng = o.arm ?? 0.2;
  const farG = armGeom(armAng * 0.92 - 0.12, -0.22);
  sleeve(farG, pal.jeoDk, pal.jeoDk, true);

  // ---- braid, behind the back ----------------------------------------------------------------------------------------------------
  {
    const nx = head[0] - 0.085, ny = head[1] - 0.02;
    const sway = -vy * 0.075 + Math.sin(t * 3.1) * 0.05 + c * 0.12;
    ctx.beginPath(); ctx.moveTo(X(nx), Y(ny));
    const pts = [];
    for (let k = 1; k <= 7; k++) {
      const u = k / 7, a = -0.25 - sway * u * 1.4 - (air ? 0.15 * u : 0);
      pts.push([nx - Math.sin(-a) * 0.7 * u * 0.55 - 0.02 * u, ny - Math.cos(a) * 0.62 * u + (air ? 0.05 * Math.sin(t * 5 + u * 3) * u : 0)]);
    }
    pts.forEach((p) => ctx.lineTo(X(p[0]), Y(p[1])));
    ctx.lineWidth = 0.062 * s; ctx.strokeStyle = pal.hair; ctx.stroke();
    ctx.lineWidth = 0.02 * s; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
    const e = pts[pts.length - 1], e0 = pts[pts.length - 2];
    const ang = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
    // the daenggi ribbon at the end, with two tails
    ctx.fillStyle = pal.ribbon;
    for (const k of [-0.3, 0.3]) {
      ctx.beginPath(); ctx.moveTo(X(e[0]), Y(e[1]));
      ctx.quadraticCurveTo(X(e[0] + Math.cos(ang + k) * 0.1 - 0.02), Y(e[1] + Math.sin(ang + k) * 0.1), X(e[0] + Math.cos(ang + k * 1.4) * 0.2), Y(e[1] + Math.sin(ang + k * 1.4) * 0.2 - 0.03));
      ctx.quadraticCurveTo(X(e[0] + Math.cos(ang + k) * 0.12 + 0.03), Y(e[1] + Math.sin(ang + k) * 0.12), X(e[0]), Y(e[1]));
      ctx.fill();
    }
    circ(e[0], e[1], 0.04); ctx.fillStyle = pal.ribbon; ctx.fill();
  }

  // ---- shoes (small white points under the hem) -----------------------------------------------------------------------------------
  const hem = 0.1 + (air ? 0.015 : 0) + drag;
  const toe = (fx) => { circ(fx + 0.04, 0.045 + (air ? 0.025 : 0), 0.05); ctx.fillStyle = '#fbf7ee'; ctx.fill(); ctx.lineWidth = 0.01 * s; ctx.strokeStyle = 'rgba(60,40,30,0.5)'; ctx.stroke(); };
  toe(-0.13); toe(0.14);

  // ---- skirt (chima): a bell from the high waist to the hem ----------------------------------------------------------------------
  {
    const top = waist[1] + 0.2 - drop * 0.1, topX = lean * 0.2;
    const hw = 0.36 + c * 0.1 + flare + (air ? 0.02 : 0);
    const left = topX - 0.1, right = topX + 0.12;
    ctx.beginPath();
    ctx.moveTo(X(left), Y(top));
    ctx.bezierCurveTo(X(left - 0.06), Y(top - 0.3), X(-hw - 0.01), Y(hem + 0.3 - c * 0.08), X(-hw), Y(hem));
    ctx.bezierCurveTo(X(-hw * 0.5), Y(hem - 0.035 + Math.sin(t * 4) * 0.004), X(hw * 0.5), Y(hem + 0.025), X(hw), Y(hem + 0.01));
    ctx.bezierCurveTo(X(hw + 0.01), Y(hem + 0.3 - c * 0.08), X(right + 0.07), Y(top - 0.3), X(right), Y(top));
    ctx.closePath();
    const g = ctx.createLinearGradient(X(-hw), 0, X(hw), 0);
    g.addColorStop(0, pal.chimaDk); g.addColorStop(0.55, pal.chima); g.addColorStop(0.82, pal.chimaHi); g.addColorStop(1, pal.chima);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.016 * s; ctx.strokeStyle = RIM; ctx.stroke();
    ctx.save(); ctx.clip();
    // folds
    ctx.strokeStyle = 'rgba(40,0,12,0.2)'; ctx.lineWidth = 0.012 * s;
    for (let k = 0; k < 5; k++) {
      const u = (k + 0.5) / 5;
      ctx.beginPath(); ctx.moveTo(X(left + (right - left) * u), Y(top));
      ctx.quadraticCurveTo(X(-hw + 2 * hw * u * 0.9 - 0.02), Y(top - 0.45), X(-hw + 2 * hw * u), Y(hem + 0.01)); ctx.stroke();
    }
    // a gold print band near the hem
    ctx.fillStyle = pal.gold; ctx.globalAlpha *= 0.85;
    for (let k = 0; k < 9; k++) { const u = (k + 0.5) / 9; circ(-hw * 0.92 + 1.84 * hw * u, hem + 0.07 + 0.01 * Math.sin(k * 1.7), 0.0125); ctx.fill(); }
    ctx.globalAlpha /= 0.85;
    ctx.restore();
    // the waistband
    poly([[left - 0.005, top - 0.02], [right + 0.005, top - 0.02], [right + 0.005, top + 0.025], [left - 0.005, top + 0.025]]); ctx.closePath();
    ctx.fillStyle = pal.collar; ctx.fill(); ctx.strokeStyle = RIM; ctx.stroke();
  }

  // ---- jacket (jeogori) ----------------------------------------------------------------------------------------------------------
  {
    const bx = waist[0] - 0.115 + lean * 0.05, fx = waist[0] + 0.115 + lean * 0.05, by = waist[1] + 0.14;
    const sb = [sh[0] - 0.115, sh[1] - 0.005], sf = [sh[0] + 0.09, sh[1] - 0.012];
    ctx.beginPath();
    ctx.moveTo(X(bx), Y(by - 0.02));
    ctx.quadraticCurveTo(X(sb[0] - 0.015), Y((sb[1] + by) / 2), X(sb[0]), Y(sb[1]));
    ctx.quadraticCurveTo(X((sb[0] + sf[0]) / 2), Y(sb[1] + 0.045), X(sf[0]), Y(sf[1]));
    ctx.quadraticCurveTo(X(fx + 0.025), Y((sf[1] + by) / 2), X(fx), Y(by - 0.02));
    ctx.closePath();
    const g = ctx.createLinearGradient(X(bx), Y(sb[1]), X(fx), Y(by));
    g.addColorStop(0, pal.jeoHi); g.addColorStop(0.5, pal.jeo); g.addColorStop(1, pal.jeoDk);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.014 * s; ctx.strokeStyle = RIM; ctx.stroke();
    // the white collar (git): a band down the front, crossing at the chest
    ctx.beginPath(); ctx.moveTo(X(sf[0] + 0.01), Y(sf[1] + 0.03)); ctx.quadraticCurveTo(X(sh[0] + 0.0), Y(sh[1] - 0.14), X(fx - 0.04), Y(by - 0.02));
    ctx.lineWidth = 0.038 * s; ctx.strokeStyle = pal.collar; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(sb[0] + 0.01), Y(sb[1] + 0.012)); ctx.lineTo(X(sf[0] + 0.01), Y(sf[1] + 0.03));
    ctx.lineWidth = 0.032 * s; ctx.strokeStyle = pal.collar; ctx.stroke();
    // the goreum (long ribbon tied at the chest, trailing with motion)
    const kx = sh[0] + 0.07, ky = sh[1] - 0.115;
    const fl = Math.sin(t * 4.2) * 0.02 + vy * 0.025;
    ctx.fillStyle = pal.trim;
    ctx.beginPath(); ctx.moveTo(X(kx), Y(ky)); ctx.quadraticCurveTo(X(kx + 0.06 + fl), Y(ky - 0.2), X(kx + 0.02 - fl), Y(ky - 0.4 - drag)); ctx.lineTo(X(kx - 0.035 - fl), Y(ky - 0.38 - drag)); ctx.quadraticCurveTo(X(kx - 0.01), Y(ky - 0.2), X(kx), Y(ky)); ctx.fill();
    ctx.beginPath(); ctx.moveTo(X(kx), Y(ky)); ctx.quadraticCurveTo(X(kx - 0.07 + fl), Y(ky - 0.15), X(kx - 0.12 - fl), Y(ky - 0.3 - drag)); ctx.lineTo(X(kx - 0.16 - fl), Y(ky - 0.27 - drag)); ctx.quadraticCurveTo(X(kx - 0.05), Y(ky - 0.12), X(kx), Y(ky)); ctx.fill();
    circ(kx, ky, 0.026); ctx.fillStyle = pal.trim; ctx.fill(); ctx.lineWidth = 0.008 * s; ctx.strokeStyle = RIM; ctx.stroke();
  }

  // ---- the near arm ---------------------------------------------------------------------------------------------------------------
  const nearG = armGeom(armAng, 0);
  sleeve(nearG, pal.jeo, pal.jeoDk, false);

  // ---- head -----------------------------------------------------------------------------------------------------------------------
  {
    const hx = head[0], hy = head[1];
    // neck
    poly([[sh[0] - 0.02, sh[1] + 0.005], [sh[0] + 0.04, sh[1] + 0.005], [hx + 0.04, hy - 0.08], [hx - 0.03, hy - 0.08]]); ctx.closePath();
    ctx.fillStyle = SKIN.lo; ctx.fill();
    // face
    circ(hx, hy, hr);
    const g = ctx.createRadialGradient(X(hx + 0.03), Y(hy + 0.04), hr * s * 0.1, X(hx), Y(hy), hr * s * 1.08);
    g.addColorStop(0, SKIN.hi); g.addColorStop(0.6, SKIN.base); g.addColorStop(1, SKIN.lo);
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 0.014 * s; ctx.strokeStyle = RIM; ctx.stroke();
    // hair: the back and top of the head, a centre parting, a soft fringe
    ctx.save(); circ(hx, hy, hr + 0.004); ctx.clip();
    ctx.fillStyle = pal.hair;
    ctx.beginPath();
    ctx.ellipse(X(hx - 0.03), Y(hy + 0.03), hr * 1.08 * s, hr * 1.02 * s, 0, 0, TAU); ctx.fill();
    // face area re-covered by skin, leaving hair on top and back
    ctx.beginPath(); ctx.ellipse(X(hx + 0.045), Y(hy - 0.028), hr * 0.86 * s, hr * 0.84 * s, 0, 0, TAU);
    const fg = ctx.createRadialGradient(X(hx + 0.05), Y(hy + 0.0), hr * s * 0.1, X(hx + 0.04), Y(hy - 0.03), hr * s * 0.95);
    fg.addColorStop(0, SKIN.hi); fg.addColorStop(0.65, SKIN.base); fg.addColorStop(1, SKIN.lo); ctx.fillStyle = fg; ctx.fill();
    // fringe
    ctx.beginPath(); ctx.moveTo(X(hx - 0.02), Y(hy + hr * 0.95)); ctx.quadraticCurveTo(X(hx + hr * 0.7), Y(hy + hr * 0.85), X(hx + hr * 0.86), Y(hy + 0.0));
    ctx.quadraticCurveTo(X(hx + hr * 0.45), Y(hy + hr * 0.5), X(hx - 0.04), Y(hy + hr * 0.38)); ctx.closePath(); ctx.fillStyle = pal.hair; ctx.fill();
    // highlight on the hair
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.012 * s;
    ctx.beginPath(); ctx.arc(X(hx - 0.01), Y(hy + 0.03), hr * 0.8 * s, -Math.PI * (face > 0 ? 0.85 : 0.15), -Math.PI * (face > 0 ? 0.55 : 0.45), face < 0); ctx.stroke();
    ctx.restore();
    // a small ribbon bow on the head
    circ(hx - 0.075, hy + 0.045, 0.026); ctx.fillStyle = pal.ribbon; ctx.fill();
    // nose bump (profile) and ear
    circ(hx + hr * 0.98, hy - 0.012, 0.019); ctx.fillStyle = SKIN.base; ctx.fill();
    circ(hx - 0.02, hy - 0.025, 0.027); ctx.fillStyle = SKIN.lo; ctx.fill();
    // eye (blinks now and then), brow, blush, mouth
    const blink = (t * 0.43) % 1 > 0.965;
    const ex = hx + hr * 0.5, ey = hy - 0.012;
    if (blink || (o.eyes === 'closed')) { ctx.beginPath(); ctx.moveTo(X(ex - 0.025), Y(ey)); ctx.lineTo(X(ex + 0.022), Y(ey - 0.004)); ctx.lineWidth = 0.011 * s; ctx.strokeStyle = '#2a1618'; ctx.stroke(); }
    else {
      ctx.beginPath(); ctx.ellipse(X(ex), Y(ey), 0.017 * s, 0.026 * s, 0, 0, TAU); ctx.fillStyle = '#26141a'; ctx.fill();
      circ(ex + 0.006, ey + 0.01, 0.0065); ctx.fillStyle = '#fff'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(X(ex - 0.03), Y(ey + 0.052)); ctx.quadraticCurveTo(X(ex), Y(ey + 0.068), X(ex + 0.032), Y(ey + 0.05)); ctx.lineWidth = 0.011 * s; ctx.strokeStyle = '#3a2020'; ctx.stroke();
    circ(ex - 0.01, ey - 0.05, 0.03); ctx.fillStyle = SKIN.blush; ctx.fill();
    const open = o.open ?? 0, mx = hx + hr * 0.62, my = hy - 0.075;
    if (open > 0.3) { ctx.beginPath(); ctx.ellipse(X(mx), Y(my), 0.022 * s, (0.012 + 0.016 * open) * s, 0, 0, TAU); ctx.fillStyle = '#7a2230'; ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(X(mx - 0.025), Y(my + 0.006)); ctx.quadraticCurveTo(X(mx), Y(my - 0.014), X(mx + 0.024), Y(my + 0.01)); ctx.lineWidth = 0.011 * s; ctx.strokeStyle = '#8a3040'; ctx.stroke(); }
  }
  ctx.restore();
  return { head: [X(head[0]), Y(head[1])], hand: [X(nearG.hand[0]), Y(nearG.hand[1])] };
}

// Small girl for lists and the Rules book: stands, crouches or flies in a fixed pose set.
export const POSES = {
  stand: { crouch: 0, arm: 0.15, vy: 0 },
  crouch: { crouch: 1, arm: -0.4, vy: 0 },
  rise: { crouch: 0, arm: 2.6, vy: 3, air: true, open: 1 },
  apex: { crouch: 0, arm: 1.9, vy: 0, air: true, open: 1 },
  fall: { crouch: 0, arm: 1.3, vy: -3, air: true },
  land: { crouch: 0.5, arm: 0.5, vy: 0, land: 1 },
};
