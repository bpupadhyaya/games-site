// The two wrestlers: a small procedural rig (hips, spine, two-bone legs and arms) drawn as smooth shaded tubes with the satba sash.
// rigFor() turns a wrestler's pose (lean, sway, fall, win, act) into joint positions; drawWrestlers() paints both.
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
export const FLOOR_Y = 420;
export const CX = 360;
const GAP = 64;                 // hip distance from the centre line at rest

// A smooth tube through pts with widths ws (sampled into round-ended segments: robust at any bend).
function samples(pts, ws, S = 9) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < S; k++) {
      const q = k / S;
      out.push({ x: lerp(pts[i].x, pts[i + 1].x, q), y: lerp(pts[i].y, pts[i + 1].y, q), w: lerp(ws[i], ws[i + 1], q) });
    }
  }
  const e = pts.length - 1;
  out.push({ x: pts[e].x, y: pts[e].y, w: ws[e] });
  return out;
}
function pass(ctx, sm, wf, off, color, grow = 0) {
  // smoothed normals per sample so the lit core follows the bend without scallops
  const nrm = sm.map((q, i) => {
    const a = sm[Math.max(0, i - 2)], b = sm[Math.min(sm.length - 1, i + 2)];
    let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
    let nx = -dy / d, ny = dx / d; if (nx * -0.55 + ny * -0.83 < 0) { nx = -nx; ny = -ny; }
    return { x: nx, y: ny };
  });
  const P = sm.map((q, i) => ({ x: q.x + nrm[i].x * q.w * off, y: q.y + nrm[i].y * q.w * off, w: q.w * wf + grow }));
  ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < P.length - 1; i++) {
    ctx.lineWidth = (P[i].w + P[i + 1].w) / 2;
    ctx.beginPath(); ctx.moveTo(P[i].x, P[i].y); ctx.lineTo(P[i + 1].x, P[i + 1].y); ctx.stroke();
  }
}
// A shaded limb: one filled contour (smooth taper, a little muscle swell at the middle of each segment) with a cross-body gradient
// from the shadow side to the lit side, a thin ink edge and a soft highlight stripe. No stroked tubes.
function tube(ctx, pts, ws, base, dark) {
  const sm = samples(pts, ws, 10);
  const n = sm.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = sm[Math.max(0, i - 1)], c = sm[Math.min(n - 1, i + 1)];
    let dx = c.x - a.x, dy = c.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const k = i / (n - 1), swell = 1 + 0.07 * Math.sin(k * Math.PI * (pts.length - 1));
    const hw = sm[i].w * 0.5 * swell;
    L.push({ x: sm[i].x - dy * hw, y: sm[i].y + dx * hw });
    R.push({ x: sm[i].x + dy * hw, y: sm[i].y - dx * hw });
  }
  const trace = (off) => {
    ctx.beginPath(); ctx.moveTo(L[0].x, L[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i].x, L[i].y);
    const e = sm[n - 1], s0 = sm[0];
    ctx.arc(e.x, e.y, sm[n - 1].w * 0.5 + off, Math.atan2(L[n - 1].y - e.y, L[n - 1].x - e.x), Math.atan2(R[n - 1].y - e.y, R[n - 1].x - e.x), true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
    ctx.arc(s0.x, s0.y, sm[0].w * 0.5 + off, Math.atan2(R[0].y - s0.y, R[0].x - s0.x), Math.atan2(L[0].y - s0.y, L[0].x - s0.x), true);
    ctx.closePath();
  };
  // gradient across the middle of the limb, lit from the upper left
  const m = sm[Math.floor(n / 2)], mw = m.w * 0.55;
  const g = ctx.createLinearGradient(m.x - mw * 0.83, m.y - mw * 0.55, m.x + mw * 0.83, m.y + mw * 0.55);
  g.addColorStop(0, base); g.addColorStop(0.45, base); g.addColorStop(1, dark);
  ctx.save(); ctx.lineJoin = 'round';
  trace(0); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(40,20,10,0.8)'; ctx.stroke();
  // soft highlight along the lit edge
  ctx.globalAlpha = 0.22; ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = Math.max(2, sm[Math.floor(n / 2)].w * 0.14); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 1; i < n - 1; i++) { const p = { x: lerp(L[i].x, sm[i].x, 0.55), y: lerp(L[i].y, sm[i].y, 0.55) }; if (i === 1) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke(); ctx.restore();
}
function ik2(a, t, l1, l2, bend) {
  let dx = t.x - a.x, dy = t.y - a.y, d = Math.hypot(dx, dy) || 0.001;
  const max = l1 + l2 - 0.5;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), A = Math.acos(cosA), base = Math.atan2(dy, dx), ang = base + bend * A;
  return { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1, end: { x: a.x + dx, y: a.y + dy } };
}

export function rigFor(s, look, build, pw, t) {
  const f = s === 0 ? 1 : -1, b = build;
  const lean = pw.lean, sway = pw.sway, fall = pw.fall, win = pw.win, fd = pw.fallDir;
  const fe = fall * fall * (3 - 2 * fall);
  const breathe = Math.sin(t * 2.3 + s * 1.7) * 1.4;
  const braceK = pw.actKind === 'brace' ? pw.act : 0, pullK = pw.actKind === 'pull' ? pw.act : 0, hookK = pw.actKind === 'hook' ? pw.act : 0;
  const crouch = 24 + Math.abs(sway) * 14 + braceK * 16 - win * 22 + hookK * 6;
  const rest = CX - f * GAP;
  const hipX0 = rest + f * (lean * 20 + pullK * -9 + hookK * 6) - sway * 7;
  const stand = 150 * b;
  const hipX = hipX0 + f * -fd * fe * 80 * b;
  const hipY = FLOOR_Y - (stand - crouch) + fe * (stand - 56 * b) * 0.92 + breathe;
  const torsoA0 = 0.46 + lean * 0.3 - win * 0.45 + sway * 0.07 - pullK * 0.1;
  const torsoA = lerp(torsoA0, fd > 0 ? 1.5 : -1.65, fe);
  const Lt = 116 * b;
  const sh = { x: hipX + f * Math.sin(torsoA) * Lt, y: hipY - Math.cos(torsoA) * Lt };
  const neckA = torsoA + 0.34 + win * 0.22 - fe * 0.25;
  const head = { x: sh.x + f * Math.sin(neckA) * 42 * b, y: sh.y - Math.cos(neckA) * 42 * b };
  const ff = { x: rest + f * (46 * b + lean * 10) + f * fe * 28 * fd, y: FLOOR_Y - fe * 5 };
  const bf = { x: rest - f * (40 * b + lean * 4) - f * fe * fd * 44, y: FLOOR_Y - fe * 3 };
  return { s, f, b, look, hip: { x: hipX, y: hipY }, sh, head, ff, bf, torsoA, fe, win, sway, Lt, act: pw.act, actKind: pw.actKind, pw };
}

function drawFoot(ctx, a, f, b, col, dark) {
  ctx.fillStyle = 'rgba(30,18,8,0.28)'; ctx.beginPath(); ctx.ellipse(a.x + f * 8 * b, a.y + 2, 26 * b, 6 * b, 0, 0, TAU); ctx.fill();
  tube(ctx, [{ x: a.x - f * 5 * b, y: a.y - 7 * b }, { x: a.x + f * 14 * b, y: a.y - 3 * b }, { x: a.x + f * 26 * b, y: a.y - 1 * b }], [17 * b, 15 * b, 10 * b], col, dark);
}

function legs(ctx, R) {
  const { f, b, look, hip } = R;
  const thigh = 78 * b, shin = 76 * b;
  const bend = f > 0 ? -1 : 1;
  const out = {};
  for (const [name, foot] of [['back', R.bf], ['front', R.ff]]) {
    const k = ik2(hip, foot, thigh, shin, bend);
    out[name] = { knee: { x: k.x, y: k.y }, foot: k.end };
  }
  return out;
}

function paintBackLeg(ctx, R, L) {
  const { f, b, look, hip } = R, k = L.back.knee, ft = L.back.foot;
  const mid = (a, c, q) => ({ x: lerp(a.x, c.x, q), y: lerp(a.y, c.y, q) });
  tube(ctx, [hip, mid(hip, k, 0.5), k], [50 * b, 44 * b, 30 * b], look.skinD, '#6e4129');
  tube(ctx, [k, mid(k, ft, 0.38), ft], [30 * b, 32 * b, 19 * b], look.skinD, '#6e4129');
  drawFoot(ctx, ft, f, b, look.skinD, '#6e4129');
  // shorts cover the top of the back leg
  tube(ctx, [hip, mid(hip, k, 0.45)], [46 * b, 40 * b], look.shorts, '#8f866f');
}
function paintBody(ctx, R, L, t) {
  const { f, b, look, hip, sh } = R;
  const mid = (a, c, q) => ({ x: lerp(a.x, c.x, q), y: lerp(a.y, c.y, q) });
  const dx = sh.x - hip.x, dy = sh.y - hip.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  // the spine bows a little backward
  const bow = (q) => ({ x: hip.x + dx * q - f * 0 + uy * -f * Math.sin(q * Math.PI) * 7 * -1, y: hip.y + dy * q + ux * f * Math.sin(q * Math.PI) * 7 * -1 });
  const spine = [bow(0), bow(0.32), bow(0.7), bow(1.0)];
  // legs first (the front leg overlaps the body) then torso
  const kf = L.front.knee, ff = L.front.foot;
  // torso
  tube(ctx, spine, [56 * b, 50 * b, 68 * b, 60 * b], look.skin, look.skinD);
  // pec / abdomen lines and the centre line, drawn lightly
  ctx.strokeStyle = 'rgba(90,50,30,0.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  const nx = -uy, ny = ux;
  ctx.beginPath(); ctx.moveTo(spine[1].x + ux * 8 + nx * f * 8, spine[1].y + uy * 8 + ny * f * 8); ctx.lineTo(spine[2].x + nx * f * 10, spine[2].y + ny * f * 10); ctx.stroke();
  for (let q = 0; q < 3; q++) { const p = mid(spine[0], spine[1], 0.3 + q * 0.3); ctx.beginPath(); ctx.moveTo(p.x + nx * f * 5, p.y + ny * f * 5); ctx.lineTo(p.x + nx * f * 15, p.y + ny * f * 15); ctx.globalAlpha = 0.6; ctx.stroke(); ctx.globalAlpha = 1; }
  // shorts at the hips
  tube(ctx, [hip, mid(hip, spine[1], 0.35)], [50 * b, 46 * b], look.shorts, '#8f866f');
  // waist sash: a band across the body, knot and tails
  const wx = hip.x + ux * 22, wy = hip.y + uy * 22;
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = look.sashD; ctx.lineWidth = 18 * b; ctx.beginPath(); ctx.moveTo(wx - nx * 21 * b, wy - ny * 21 * b); ctx.lineTo(wx + nx * 21 * b, wy + ny * 21 * b); ctx.stroke();
  ctx.strokeStyle = look.sash; ctx.lineWidth = 12 * b; ctx.beginPath(); ctx.moveTo(wx - nx * 20 * b, wy - ny * 20 * b - 1.5); ctx.lineTo(wx + nx * 20 * b, wy + ny * 20 * b - 1.5); ctx.stroke();
  ctx.strokeStyle = look.sashD; ctx.lineWidth = 8 * b;
  const kx = wx + nx * f * 18 * b, ky = wy + ny * f * 18 * b;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.quadraticCurveTo(kx - f * 16, ky + 22, kx - f * 8 + Math.sin(t * 3) * 3, ky + 46); ctx.stroke();
  ctx.strokeStyle = look.sash; ctx.lineWidth = 6 * b;
  ctx.beginPath(); ctx.moveTo(kx, ky); ctx.quadraticCurveTo(kx + f * 10, ky + 24, kx + f * 18 + Math.sin(t * 3 + 1) * 3, ky + 40); ctx.stroke();
  ctx.restore();
  // front leg over the body: thigh in shorts, thigh band, bare shin
  tube(ctx, [hip, mid(hip, kf, 0.5), kf], [56 * b, 48 * b, 33 * b], look.skin, look.skinD);
  tube(ctx, [kf, mid(kf, ff, 0.38), ff], [33 * b, 35 * b, 20 * b], look.skin, look.skinD);
  drawFoot(ctx, ff, f, b, look.skin, look.skinD);
  tube(ctx, [hip, mid(hip, kf, 0.52)], [50 * b, 42 * b], look.shorts, '#8f866f');
  const tp = mid(hip, kf, 0.42), tdx = kf.x - hip.x, tdy = kf.y - hip.y, td = Math.hypot(tdx, tdy) || 1, tn = { x: -tdy / td, y: tdx / td };
  ctx.save(); ctx.lineCap = 'round';
  ctx.strokeStyle = look.sashD; ctx.lineWidth = 15 * b; ctx.beginPath(); ctx.moveTo(tp.x + tn.x * 21 * b, tp.y + tn.y * 21 * b); ctx.lineTo(tp.x - tn.x * 21 * b, tp.y - tn.y * 21 * b); ctx.stroke();
  ctx.strokeStyle = look.sash; ctx.lineWidth = 10 * b; ctx.beginPath(); ctx.moveTo(tp.x + tn.x * 20 * b, tp.y + tn.y * 20 * b - 1); ctx.lineTo(tp.x - tn.x * 20 * b, tp.y - tn.y * 20 * b - 1); ctx.stroke();
  ctx.restore();
  R.thighBand = tp; R.waistPt = { x: wx, y: wy };
  // neck
  tube(ctx, [{ x: sh.x - f * 2, y: sh.y + 2 }, { x: lerp(sh.x, R.head.x, 0.7), y: lerp(sh.y, R.head.y, 0.7) + 6 }], [30 * b, 24 * b], look.skin, look.skinD);
}
function paintHead(ctx, R) {
  const { f, b, look, head } = R;
  const r = 25 * b;
  ctx.save(); ctx.translate(head.x, head.y);
  if (look.long) { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(-f * r * 0.9, r * 0.2, r * 0.55, r * 0.95, 0, 0, TAU); ctx.fill(); }
  const fg = ctx.createRadialGradient(f * 5, -7, 3, 0, 0, r * 1.2); fg.addColorStop(0, look.skin); fg.addColorStop(1, look.skinD);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 1.05, f * 0.08, 0, TAU); ctx.fill();
  // nose and chin toward the rival
  ctx.fillStyle = look.skin; ctx.beginPath(); ctx.moveTo(f * r * 0.78, -r * 0.18); ctx.quadraticCurveTo(f * r * 1.2, r * 0.1, f * r * 0.8, r * 0.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = look.skinD; ctx.beginPath(); ctx.ellipse(-f * r * 0.2, r * 0.12, r * 0.2, r * 0.3, 0, 0, TAU); ctx.fill();   // ear
  // hair cap, with a top knot for the long-haired wrestler
  ctx.fillStyle = look.hair; ctx.beginPath(); ctx.ellipse(-f * 2, -r * 0.3, r * 0.98, r * 0.8, f * 0.06, Math.PI, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(-f * r * 0.5, -r * 0.05, r * 0.46, r * 0.7, 0, 0, TAU); ctx.fill();
  if (look.long) { ctx.beginPath(); ctx.arc(-f * r * 0.35, -r * 1.05, r * 0.36, 0, TAU); ctx.fill(); }
  // headband in the sash colour (wrestlers tie one on)
  ctx.strokeStyle = look.sash; ctx.lineWidth = 6 * b; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-f * r * 0.95, -r * 0.34); ctx.quadraticCurveTo(0, -r * 0.62, f * r * 0.84, -r * 0.34); ctx.stroke();
  // brow, eye, mouth: set jaw; eyes shut when going down
  ctx.strokeStyle = '#2a1812'; ctx.lineWidth = 2.4;
  const strain = Math.max(R.act, R.fe) * 0.8;
  ctx.beginPath(); ctx.moveTo(f * r * 0.3, -r * 0.18 + strain); ctx.lineTo(f * r * 0.82, -r * 0.14 - strain * 1.3); ctx.stroke();
  if (R.fe > 0.4) { ctx.beginPath(); ctx.moveTo(f * r * 0.38, r * 0.06); ctx.lineTo(f * r * 0.72, r * 0.06); ctx.stroke(); }
  else {
    ctx.fillStyle = '#f6ecd8'; ctx.beginPath(); ctx.ellipse(f * r * 0.55, r * 0.06, 5.2 * b, 3.4 * b, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#160b08'; ctx.beginPath(); ctx.arc(f * r * 0.62, r * 0.06, 2.5 * b, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#2a1812'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(f * r * 0.4, r * 0.03); ctx.quadraticCurveTo(f * r * 0.55, -r * 0.1, f * r * 0.72, r * 0.02); ctx.stroke();
    ctx.lineWidth = 2.4;
  }
  // cheek warmth and a soft nostril so the face reads at phone size
  ctx.fillStyle = 'rgba(190,80,60,0.16)'; ctx.beginPath(); ctx.ellipse(f * r * 0.42, r * 0.36, r * 0.2, r * 0.13, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(60,30,18,0.5)'; ctx.beginPath(); ctx.arc(f * r * 0.86, r * 0.17, 1.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(f * r * 0.4, r * 0.56); ctx.lineTo(f * r * 0.74, r * 0.52 + (R.win > 0.3 ? -3 : 0)); ctx.stroke();
  ctx.restore();
}
function paintArms(ctx, R, O, t) {
  const { f, b, look } = R;
  const up = 70 * b, fo = 66 * b;
  const shN = { x: R.sh.x - f * 6, y: R.sh.y + 6 };
  const tug = (R.actKind === 'pull' ? R.act : 0) * 8;
  // right hand wraps the rival's waist band, left hand holds the thigh band
  const grabW = { x: O.waistPt.x + O.f * 8, y: O.waistPt.y + 2 }, grabT = { x: O.thighBand.x + O.f * 10, y: O.thighBand.y + 8 };
  let hands = [{ x: grabT.x - f * tug, y: grabT.y }, { x: grabW.x - f * tug, y: grabW.y }];
  if (R.fe > 0.1) hands = [{ x: R.sh.x + f * 44, y: R.sh.y - 56 }, { x: R.sh.x - f * 30, y: R.sh.y - 40 }];
  if (R.win > 0.1) hands = hands.map((h, i) => ({ x: lerp(h.x, R.sh.x + f * (i ? 26 : -6), R.win), y: lerp(h.y, R.sh.y - 104 + Math.sin(t * 6 + i) * 5, R.win) }));
  hands.forEach((h, i) => {
    const e = ik2(shN, h, up, fo, f > 0 ? 1 : -1);
    const w = i ? 1 : 0.92;
    tube(ctx, [shN, { x: lerp(shN.x, e.x, 0.5), y: lerp(shN.y, e.y, 0.5) }, { x: e.x, y: e.y }], [31 * b * w, 28 * b * w, 22 * b * w], look.skin, look.skinD);
    tube(ctx, [{ x: e.x, y: e.y }, { x: lerp(e.x, e.end.x, 0.4), y: lerp(e.y, e.end.y, 0.4) }, e.end], [22 * b * w, 20 * b * w, 15 * b * w], look.skin, look.skinD);
    // hand: a rounded palm along the forearm, four finger knuckles wrapped over the band, and a thumb
    const ang = Math.atan2(e.end.y - e.y, e.end.x - e.x);
    ctx.save(); ctx.translate(e.end.x, e.end.y); ctx.rotate(ang);
    const hb = b * (i ? 1 : 0.95);
    ctx.fillStyle = 'rgba(34,18,8,0.92)'; ctx.beginPath(); ctx.ellipse(5 * hb, 0, 17 * hb, 13.5 * hb, 0, 0, TAU); ctx.fill();
    const hg = ctx.createRadialGradient(2 * hb, -4 * hb, 2, 5 * hb, 0, 17 * hb); hg.addColorStop(0, look.skin); hg.addColorStop(1, look.skinD);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(5 * hb, 0, 15 * hb, 11.5 * hb, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(70,36,20,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(12 * hb, k * 4.2 * hb - 0.5); ctx.lineTo(19 * hb, k * 4.4 * hb); ctx.stroke(); }
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.ellipse(1 * hb, -10 * hb, 7.5 * hb, 4.6 * hb, -0.5, 0, TAU); ctx.fill();   // thumb
    ctx.restore();
  });
}

export function drawWrestlers(ctx, R0, R1, t) {
  const rigs = [R0, R1];
  const L = rigs.map((R) => legs(ctx, R));
  const order = R0.pw.fall > R1.pw.fall ? [0, 1] : [1, 0];
  // ground shadows
  for (const R of rigs) { ctx.fillStyle = 'rgba(40,24,10,0.30)'; ctx.beginPath(); ctx.ellipse(R.hip.x + R.f * 4, FLOOR_Y + 8, 100 * R.b, 14, 0, 0, TAU); ctx.fill(); }
  for (const i of order) paintBackLeg(ctx, rigs[i], L[i]);
  for (const i of order) paintBody(ctx, rigs[i], L[i], t);
  for (const i of order) paintHead(ctx, rigs[i]);
  paintArms(ctx, R0, R1, t); paintArms(ctx, R1, R0, t);
}
