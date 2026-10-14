// Lezginka: drawing helpers for the game's own art (backdrop, woven rug, step pads, rings, the dancers). Pure canvas, no clock, no randomness:
// everything is a function of the time handed in, so a paused game stays still and a screenshot is repeatable.

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Cormorant Garamond", "Palatino Linotype", Georgia, serif';
export const PAL = {
  text: '#fff4e0', dim: 'rgba(255,240,220,0.64)', gold: '#ffd36b', ember: '#ff6a3c', teal: '#35c7b4', rose: '#ff6f91', violet: '#a98bff',
  night: '#120d2c', plum: '#2a1646',
};
export const PADCOL = ['#ffc247', '#ff6f91', '#3fd0c0', '#a98bff'];       // left, right, arms, spin
export const PADDARK = ['#6b4208', '#6e1633', '#0b4b45', '#3a2878'];
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };

// ---- backdrop: dusk over the mountains --------------------------------------------------------------------------------------------
// Drawn the same way on every screen; `light` (0..1) warms the sky with the energy of the dance.
function ridge(ctx, w, base, amp, seed, f1, f2, color, snow) {
  ctx.beginPath(); ctx.moveTo(-10, base + 400);
  const pts = [];
  for (let x = -10; x <= w + 10; x += 14) {
    const y = base - amp * (0.5 + 0.28 * Math.sin(x * f1 + seed) + 0.17 * Math.sin(x * f2 + seed * 2.3) + 0.12 * Math.sin(x * f1 * 3.1 + seed * 0.7)) ;
    pts.push([x, y]); ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 10, base + 400); ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  if (snow) {
    ctx.fillStyle = snow;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      if (y < pts[i - 1][1] && y < pts[i + 1][1] && base - y > amp * 0.62) {
        ctx.beginPath(); ctx.moveTo(x - 20, y + amp * 0.12); ctx.lineTo(x, y - 1); ctx.lineTo(x + 20, y + amp * 0.12); ctx.lineTo(x + 7, y + amp * 0.07); ctx.lineTo(x - 4, y + amp * 0.13); ctx.closePath(); ctx.fill();
      }
    }
  }
}
export function drawBackdrop(ctx, w, h, t, light = 0, bunting = true) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#120c33'); g.addColorStop(0.35, '#3a1c5e'); g.addColorStop(0.58, lerpCol([156, 63, 96], [214, 98, 78], light)); g.addColorStop(0.72, lerpCol([236, 124, 84], [255, 168, 88], light)); g.addColorStop(1, '#1a0f28');
  ctx.fillStyle = g; ctx.fillRect(-10, -10, w + 20, h + 20);
  // a few stars
  ctx.fillStyle = 'rgba(255,244,224,0.8)';
  for (let i = 0; i < 38; i++) {
    const x = (i * 97.3 + 31) % w, y = ((i * 53.1 + 17) % (h * 0.36));
    const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + i * 1.7);
    ctx.globalAlpha = 0.25 + 0.45 * tw; ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // a low sun glow behind the far ridge
  const sy = h * 0.6, rg = ctx.createRadialGradient(w * 0.7, sy, 10, w * 0.7, sy, Math.max(w, h) * 0.5);
  rg.addColorStop(0, `rgba(255,190,110,${0.5 + 0.2 * light})`); rg.addColorStop(1, 'rgba(255,150,90,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);
  const hb = h * 0.66;
  ridge(ctx, w, hb - 40, Math.min(h * 0.2, 260), 1.3, 0.0062, 0.017, '#4b2a6a', 'rgba(255,230,230,0.55)');
  ridge(ctx, w, hb, Math.min(h * 0.17, 220), 4.1, 0.0085, 0.021, '#2f1c52', 'rgba(255,225,230,0.28)');
  ridge(ctx, w, hb + 40, Math.min(h * 0.12, 150), 7.7, 0.013, 0.031, '#1d1238', null);
  // stone watch-towers on the near ridge (simple silhouettes)
  ctx.fillStyle = '#150d2b';
  for (const k of [0.16, 0.74]) {
    const x = w * k, y = hb + 36, tw = Math.max(18, w * 0.03), th = tw * 3.2;
    ctx.beginPath(); ctx.moveTo(x - tw / 2, y + 40); ctx.lineTo(x - tw / 2, y - th); ctx.lineTo(x - tw * 0.62, y - th); ctx.lineTo(x - tw * 0.62, y - th - tw * 0.4); ctx.lineTo(x - tw * 0.2, y - th - tw * 0.4); ctx.lineTo(x - tw * 0.2, y - th - tw * 0.15); ctx.lineTo(x + tw * 0.2, y - th - tw * 0.15); ctx.lineTo(x + tw * 0.2, y - th - tw * 0.4); ctx.lineTo(x + tw * 0.62, y - th - tw * 0.4); ctx.lineTo(x + tw * 0.62, y - th); ctx.lineTo(x + tw / 2, y - th); ctx.lineTo(x + tw / 2, y + 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,196,110,0.8)'; ctx.fillRect(x - 2, y - th * 0.55, 4, 7); ctx.fillStyle = '#150d2b';
  }
  if (!bunting) return;
  // bunting
  const n = Math.max(8, Math.round(w / 70));
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,240,220,0.35)';
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const x = (w * i) / n, y = 24 + 10 * Math.sin((i / n) * Math.PI); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  const cols = [PADCOL[0], PADCOL[1], PADCOL[2], PADCOL[3]];
  for (let i = 0; i < n; i++) {
    const x0 = (w * (i + 0.2)) / n, x1 = (w * (i + 0.8)) / n, xm = (x0 + x1) / 2, y0 = 24 + 10 * Math.sin(((i + 0.2) / n) * Math.PI), y1 = 24 + 10 * Math.sin(((i + 0.8) / n) * Math.PI);
    const sw = Math.sin(t * 1.6 + i) * 2;
    ctx.fillStyle = rgba(cols[i % 4], 0.85); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.lineTo(xm + sw, Math.max(y0, y1) + 20); ctx.closePath(); ctx.fill();
  }
}
function lerpCol(a, b, k) { return `rgb(${Math.round(lerp(a[0], b[0], k))},${Math.round(lerp(a[1], b[1], k))},${Math.round(lerp(a[2], b[2], k))})`; }

// ---- the woven rug (the dance floor) ---------------------------------------------------------------------------------------------
export function drawRug(ctx, rug, t, beat = 0, glow = 0) {
  const { x, y, rx, ry } = rug;
  ctx.save();
  // shadow under the rug
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y + ry * 0.18, rx * 1.03, ry * 1.06, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y); ctx.scale(1, ry / rx);
  const R = rx;
  // fringe
  ctx.strokeStyle = 'rgba(246,223,174,0.75)'; ctx.lineWidth = 2.5;
  for (let i = 0; i < 90; i++) { const a = (i / 90) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.99, Math.sin(a) * R * 0.99); ctx.lineTo(Math.cos(a) * R * 1.045, Math.sin(a) * R * 1.045); ctx.stroke(); }
  // border
  let g = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R);
  g.addColorStop(0, '#8e2b2f'); g.addColorStop(0.7, '#6d1d2c'); g.addColorStop(1, '#4a1226');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  ctx.lineWidth = R * 0.018; ctx.strokeStyle = '#f2c46a'; ctx.beginPath(); ctx.arc(0, 0, R * 0.985, 0, TAU); ctx.stroke();
  // border diamonds
  const nD = 28;
  for (let i = 0; i < nD; i++) {
    const a = (i / nD) * TAU, r = R * 0.925, cx = Math.cos(a) * r, cy = Math.sin(a) * r, s = R * 0.034;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2);
    ctx.fillStyle = i % 2 ? '#f2c46a' : '#2fb6a3'; ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.lineTo(s, 0); ctx.lineTo(0, s * 1.5); ctx.lineTo(-s, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.lineWidth = R * 0.012; ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.865, 0, TAU); ctx.stroke();
  // zig-zag band
  const nZ = 40;
  ctx.fillStyle = '#c7782f';
  for (let i = 0; i < nZ; i++) {
    const a0 = (i / nZ) * TAU, a1 = ((i + 0.5) / nZ) * TAU, a2 = ((i + 1) / nZ) * TAU;
    ctx.beginPath(); ctx.moveTo(Math.cos(a0) * R * 0.78, Math.sin(a0) * R * 0.78); ctx.lineTo(Math.cos(a1) * R * 0.855, Math.sin(a1) * R * 0.855); ctx.lineTo(Math.cos(a2) * R * 0.78, Math.sin(a2) * R * 0.78); ctx.closePath(); ctx.fill();
  }
  ctx.lineWidth = R * 0.012; ctx.strokeStyle = 'rgba(242,196,106,0.7)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.775, 0, TAU); ctx.stroke();
  // field
  g = ctx.createRadialGradient(0, 0, R * 0.05, 0, 0, R * 0.77);
  g.addColorStop(0, `rgb(${Math.round(150 + 40 * glow)},${Math.round(44 + 20 * glow)},${Math.round(48)})`); g.addColorStop(1, '#5a1830');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 0.765, 0, TAU); ctx.fill();
  // eight-point star medallion
  ctx.strokeStyle = 'rgba(246,200,110,0.85)'; ctx.lineWidth = R * 0.014;
  for (let k = 0; k < 2; k++) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + k * TAU / 16 + Math.PI / 8, r = R * (k ? 0.36 : 0.5), a2 = a + TAU / 16; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a2) * r * 0.55, Math.sin(a2) * r * 0.55); }
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = `rgba(47,182,163,${0.55 + 0.25 * beat})`; ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(246,200,110,0.9)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.12, 0, TAU); ctx.stroke();
  // small guls between star and band
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU, r = R * 0.64, s = R * 0.028;
    ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a);
    ctx.fillStyle = i % 2 ? 'rgba(242,196,106,0.85)' : 'rgba(47,182,163,0.85)'; ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.restore();
  }
  ctx.restore();
}

// ---- step pads: woven medallions with a glyph -----------------------------------------------------------------------------------
export function glyph(ctx, idx, cx, cy, s, col, line = Math.max(3, s * 0.16)) {
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = line; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (idx === 0 || idx === 1) {
    const m = idx === 0 ? 1 : -1;                                        // a boot print: sole, toes and heel
    ctx.rotate(0.14 * m);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.02, s * 0.27, s * 0.36, 0, 0, TAU); ctx.fill();
    for (let k = 0; k < 4; k++) { const a = -0.62 + k * 0.41; ctx.beginPath(); ctx.arc(Math.sin(a) * s * 0.3, -s * 0.5 - Math.cos(a) * s * 0.1 + Math.abs(a) * s * 0.06 * 0 - (k === 0 || k === 3 ? -s * 0.08 : 0), s * 0.075, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(0, s * 0.5, s * 0.2, s * 0.17, 0, 0, TAU); ctx.fill();
  } else if (idx === 2) {                                                // two wings, lifted
    for (const m of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(m * s * 0.08, s * 0.5);
      ctx.bezierCurveTo(m * s * 0.55, s * 0.4, m * s * 0.8, -s * 0.05, m * s * 0.7, -s * 0.62);
      ctx.bezierCurveTo(m * s * 0.5, -s * 0.28, m * s * 0.26, -s * 0.08, m * s * 0.08, s * 0.05);
      ctx.closePath(); ctx.fill();
    }
  } else {                                                               // a turn: circular arrow
    ctx.beginPath(); ctx.arc(0, 0, s * 0.6, -0.4, Math.PI * 1.55); ctx.stroke();
    const a = -0.4, ex = Math.cos(a) * s * 0.6, ey = Math.sin(a) * s * 0.6;
    ctx.beginPath(); ctx.moveTo(ex + s * 0.05, ey - s * 0.38); ctx.lineTo(ex, ey); ctx.lineTo(ex + s * 0.38, ey + s * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, s * 0.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// state: { flash 0..1, press 0..1 (finger down), glow 0..1 (a note about to land) }
export function drawPad(ctx, p, idx, st = {}, labels = false) {
  const { x, y, r } = p, col = PADCOL[idx];
  ctx.save();
  // soft shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 1.0, r * 0.82, 0, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r * 1.02);
  g.addColorStop(0, rgba(PADDARK[idx], 0.98)); g.addColorStop(1, 'rgba(14,8,32,0.96)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  const fl = st.flash || 0, gl = st.glow || 0;
  if (fl > 0 || gl > 0) {
    const a = Math.max(fl * 0.9, gl * 0.35);
    const hg = ctx.createRadialGradient(x, y, r * 0.1, x, y, r * 1.5);
    hg.addColorStop(0, rgba(col, a)); hg.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, TAU); ctx.fill();
  }
  // woven rim: dashes
  ctx.lineWidth = Math.max(3, r * 0.08); ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 0.96, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(2, r * 0.045); ctx.strokeStyle = rgba(col, 0.55); ctx.setLineDash([r * 0.12, r * 0.1]); ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  glyph(ctx, idx, x, y, r * (0.5 + 0.08 * (st.press || 0)), fl > 0.2 ? '#fff' : rgba(col, 0.96));
  if (labels) {
    ctx.font = `800 ${Math.max(13, r * 0.2)}px ${UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,244,224,0.88)'; ctx.fillText(['LEFT', 'RIGHT', 'ARMS', 'SPIN'][idx], x, y + r * 0.74);
  }
  ctx.restore();
}

// The closing ring of a coming step. p: 0 (far) .. 1 (on the pad).
export function drawRing(ctx, pad, idx, p, soft = false) {
  const { x, y, r } = pad, rad = r * (0.98 + 1.7 * (1 - p)), a = clamp(0.15 + 0.85 * p, 0, 1);
  ctx.save(); ctx.globalAlpha = a * (soft ? 0.6 : 1);
  ctx.lineWidth = Math.max(4, r * 0.1 * (0.6 + 0.6 * p)); ctx.strokeStyle = PADCOL[idx];
  ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.stroke();
  ctx.lineWidth = Math.max(2, r * 0.03); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(x, y, rad - r * 0.06, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---- particles ------------------------------------------------------------------------------------------------------------------------------
export function burst(parts, rng, x, y, n, col, spd = 1, kind = 'spark') {
  for (let i = 0; i < n; i++) {
    const a = rng.next() * TAU, s = (60 + rng.next() * 260) * spd;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'dust' ? 40 : 90), age: 0, life: 0.45 + rng.next() * 0.45, col, kind, r: 2 + rng.next() * 4 });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.kind === 'dust' ? 30 : 420) * dt; p.vx *= 0.985; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age >= parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    const k = 1 - p.age / p.life;
    ctx.globalAlpha = clamp(k, 0, 1) * (p.kind === 'dust' ? 0.5 : 0.95); ctx.fillStyle = p.col;
    if (p.kind === 'dust') { ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.5 - k * 0.5) * 1.6, 0, TAU); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(p.x, p.y - p.r * 1.4); ctx.lineTo(p.x + p.r * 0.55, p.y); ctx.lineTo(p.x, p.y + p.r * 1.4); ctx.lineTo(p.x - p.r * 0.55, p.y); ctx.closePath(); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function drawStars(ctx, cx, cy, size, n, total = 3) {
  for (let i = 0; i < total; i++) {
    const x = cx + (i - (total - 1) / 2) * size * 1.15, on = i < n;
    ctx.save(); ctx.translate(x, cy - (i === 1 ? size * 0.12 : 0)); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? size * 0.22 : size * 0.5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = on ? '#ffd36b' : 'rgba(255,240,220,0.14)'; ctx.fill();
    if (on) { ctx.lineWidth = 3; ctx.strokeStyle = '#a56a12'; ctx.lineJoin = 'round'; ctx.stroke(); }
    ctx.restore();
  }
}

// ---- dancers --------------------------------------------------------------------------------------------------------------------------------
// A move is { pad, ti } with ti = the time of the stamp / lift / spin peak ("impact"). poseAt() blends every recent move into one pose.
export const MOVE_DUR = { L: 0.34, R: 0.34, A: 0.5, S: 0.6 };
const LEG = { L: 0, R: 1 };

export function poseAt(moves, t, beatPh = 0, o = {}) {
  const P = {
    liftL: 0, liftR: 0, hipL: 0.1, hipR: 0.1, dy: 0, squash: 0, lean: 0,
    a1L: 0.95, a2L: 0.7, a1R: 0.95, a2R: 0.7, spin: 0, flare: 0, impact: 0, head: 0, tip: 1,
  };
  const bob = Math.sin(beatPh * TAU);
  P.dy = 0.006 * bob * (o.calm ? 0.3 : 1); P.lean = 0.012 * Math.sin(beatPh * Math.PI);
  // idle arm sway
  P.a1L += 0.05 * Math.sin(beatPh * TAU + 0.6); P.a1R += 0.05 * Math.sin(beatPh * TAU + 0.6 + Math.PI);
  for (const m of moves) {
    const dur = MOVE_DUR[m.pad];
    const age = t - m.ti + dur * 0.5;                // age in seconds from the start of the move
    if (age < 0 || age > dur * 1.6) continue;
    const k = age / dur;
    if (m.pad === 'L' || m.pad === 'R') {
      // the knee comes up in the first half, the boot lands at k = 0.5, then the body settles
      const up = k < 0.5 ? smooth(k / 0.5) : Math.max(0, 1 - (k - 0.5) / 0.1);
      const settle = k >= 0.5 ? Math.exp(-(k - 0.5) * 7) * Math.cos((k - 0.5) * 18) : 0;
      const side = m.pad;
      if (side === 'L') { P.liftL = Math.max(P.liftL, up); P.hipL += 0.09 * up; } else { P.liftR = Math.max(P.liftR, up); P.hipR += 0.09 * up; }
      P.squash += Math.max(0, settle) * 0.9;
      P.lean += (side === 'L' ? -1 : 1) * (0.05 * up);
      if (k >= 0.5 && k < 0.7) P.impact = Math.max(P.impact, 1 - (k - 0.5) / 0.2);
      // arms counter-swing
      if (side === 'L') { P.a1R += 0.25 * up; } else { P.a1L += 0.25 * up; }
    } else if (m.pad === 'A') {
      const up = k < 0.4 ? smooth(k / 0.4) : Math.max(0, 1 - (k - 0.55) / 0.9);
      P.a1L = lerp(P.a1L, 2.55, up); P.a2L = lerp(P.a2L, 0.25, up);
      P.a1R = lerp(P.a1R, 2.55, up); P.a2R = lerp(P.a2R, 0.25, up);
      P.dy += 0.035 * up; P.lean -= 0.03 * up; P.head -= 0.12 * up;
      if (k >= 0.4 && k < 0.6) P.impact = Math.max(P.impact, 0.6);
    } else if (m.pad === 'S') {
      const kk = clamp(k / 1.1, 0, 1);
      P.spin = Math.max(P.spin, smooth(kk) * TAU * 1.0);
      const arc = Math.sin(kk * Math.PI);
      P.flare = Math.max(P.flare, arc);
      P.a1L = lerp(P.a1L, 1.5, arc); P.a2L = lerp(P.a2L, 0.1, arc);
      P.a1R = lerp(P.a1R, 1.5, arc); P.a2R = lerp(P.a2R, 0.1, arc);
      P.dy += 0.03 * arc;
    }
  }
  return P;
}

export const LOOKS = {
  man: { coat: ['#7d1d3f', '#4a0f26'], trim: '#f2c46a', hat: '#2b1d1a', hatTop: '#8a1f2b', skin: '#e3b08a', trouser: '#17101e', boot: '#0d0912', female: false },
  man2: { coat: ['#1e5f6b', '#0e3640'], trim: '#e8d6a0', hat: '#c9bba6', hatTop: '#2f6f7a', skin: '#d9a47e', trouser: '#17141e', boot: '#0d0b12', female: false },
  man3: { coat: ['#4a3a82', '#2a2050'], trim: '#f2c46a', hat: '#1b1522', hatTop: '#4a3a82', skin: '#e8bd98', trouser: '#17101e', boot: '#0d0912', female: false },
  woman: { coat: ['#2fb6a3', '#16706a'], trim: '#ffe7a8', hat: '#f3e7d1', hatTop: '#ff6f91', skin: '#efc3a2', trouser: '#16706a', boot: '#0d0912', female: true },
  woman2: { coat: ['#d9487a', '#8e2150'], trim: '#ffe7a8', hat: '#f3e7d1', hatTop: '#ffc247', skin: '#e8b995', trouser: '#8e2150', boot: '#0d0912', female: true },
};

function limb(ctx, a, b, w, col, hi) {
  ctx.lineCap = 'round'; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = w * 0.28; ctx.beginPath(); ctx.moveTo(a[0] - w * 0.18, a[1]); ctx.lineTo(b[0] - w * 0.18, b[1]); ctx.stroke(); }
}

// Draws one dancer standing on (x, footY), `H` units tall, from pose P. All geometry is in units of H with y up (flipped on draw).
export function drawDancer(ctx, x, footY, H, P, look = LOOKS.man, o = {}) {
  const fem = look.female, Lt = 0.245, Ls = 0.255;
  const sq = 1 - 0.28 * clamp(P.squash, 0, 1.2);
  const leg = (side) => {
    const m = side === 'L' ? -1 : 1, lift = side === 'L' ? P.liftL : P.liftR, a = (side === 'L' ? P.hipL : P.hipR);
    const hip = [m * 0.055, 0];
    const kneeV = Lt * Math.cos(a) * (1 - 0.82 * lift) * sq;
    const knee = [hip[0] + m * Lt * Math.sin(a) * (1 - 0.35 * lift), -kneeV];
    const b = 0.06 - 0.3 * lift;
    const foot = [knee[0] + m * Ls * Math.sin(b) * 0.6, knee[1] - Ls * Math.cos(b) * sq];
    return { hip, knee, foot };
  };
  const lL = leg('L'), lR = leg('R');
  const low = Math.min(lL.foot[1], lR.foot[1]);
  const base = -low + 0.012 + 0.01 * P.tip + P.dy;            // pelvis height above floor
  const spinSx = P.spin > 0.001 ? Math.max(0.16, Math.abs(Math.cos(P.spin))) : 1;
  ctx.save();
  ctx.translate(x, footY);
  ctx.scale(H * spinSx * (o.flip ? -1 : 1), -H);              // y up
  ctx.translate(0, base);
  const W = (px) => px / H;                                   // a line width given in screen units, in H units
  const col = look;
  const lineO = 'rgba(14,6,24,0.9)';
  const shade = (c, k) => { const n = parseInt(c.slice(1), 16); const f = (v) => Math.round(clamp(v + (k > 0 ? (255 - v) * k : v * k), 0, 255)); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  // ---- legs: trousers into tall boots
  const drawLeg = (L, side) => {
    const w = fem ? 0.05 : 0.066, m = side === 'L' ? -1 : 1;
    const raised = (side === 'L' ? P.liftL : P.liftR) > 0.25;
    if (raised && !fem) { limb(ctx, L.hip, L.knee, w * 1.55, lineO); limb(ctx, L.hip, L.knee, w * 1.35, col.coat[0], 'rgba(255,255,255,0.12)'); }
    else limb(ctx, L.hip, L.knee, w, col.trouser, 'rgba(255,255,255,0.08)');
    // boot: a tapered shaft from the knee to the ankle
    const dx = L.foot[0] - L.knee[0], dy = L.foot[1] - L.knee[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const w0 = w * 0.52, w1 = w * 0.4;
    ctx.fillStyle = col.boot; ctx.beginPath();
    ctx.moveTo(L.knee[0] + nx * w0, L.knee[1] + ny * w0); ctx.lineTo(L.foot[0] + nx * w1, L.foot[1] + ny * w1);
    ctx.lineTo(L.foot[0] - nx * w1, L.foot[1] - ny * w1); ctx.lineTo(L.knee[0] - nx * w0, L.knee[1] - ny * w0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = W(2); ctx.beginPath(); ctx.moveTo(L.knee[0] - nx * w0 * 0.3, L.knee[1] - ny * w0 * 0.3); ctx.lineTo(L.foot[0] - nx * w1 * 0.3, L.foot[1] - ny * w1 * 0.3); ctx.stroke();
    ctx.fillStyle = col.boot; ctx.beginPath(); ctx.ellipse(L.foot[0] + m * 0.022, L.foot[1] - 0.006, 0.05, 0.026, m * 0.08, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(L.foot[0] + m * 0.032, L.foot[1] - 0.015, 0.02, 0.008, m * 0.08, 0, TAU); ctx.fill();
  };
  if (!fem) { drawLeg(lL, 'L'); drawLeg(lR, 'R'); }
  // ---- torso and coat
  const ls = P.lean, torsoH = 0.29, shW = fem ? 0.09 : 0.115;
  const sh = [Math.sin(ls) * torsoH, Math.cos(ls) * torsoH];
  const sL = [sh[0] - shW * Math.cos(ls), sh[1] + shW * Math.sin(ls)], sR = [sh[0] + shW * Math.cos(ls), sh[1] - shW * Math.sin(ls)];
  const flare = (fem ? 0.2 : 0.095) + 0.1 * P.flare + 0.012 * Math.sin(P.impact * 6);
  const hemY = fem ? -(base - 0.012) + 0.018 : -0.31 - 0.02 * P.squash;
  const wst = fem ? 0.062 : 0.078, sx0 = Math.sin(ls) * 0.1;
  const wL = [-wst + sx0, 0.1], wR = [wst + sx0, 0.1];
  const gr = ctx.createLinearGradient(-0.2, 0, 0.2, 0);
  gr.addColorStop(0, shade(col.coat[0], 0.22)); gr.addColorStop(0.45, col.coat[0]); gr.addColorStop(1, col.coat[1]);
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(sL[0], sL[1]);
    ctx.quadraticCurveTo(sh[0], sh[1] + 0.025, sR[0], sR[1]);
    ctx.lineTo(wR[0] + 0.012, wR[1] + 0.03);
    ctx.bezierCurveTo(wR[0] + flare * 0.2, wR[1] - 0.08, wR[0] + flare * 0.7, hemY + 0.14, 0.06 + flare, hemY);
    ctx.quadraticCurveTo(0, hemY - 0.02 - 0.012 * Math.sin(P.impact * 5), -0.06 - flare, hemY);
    ctx.bezierCurveTo(wL[0] - flare * 0.7, hemY + 0.14, wL[0] - flare * 0.2, wL[1] - 0.08, wL[0] - 0.012, wL[1] + 0.03);
    ctx.closePath();
  };
  body(); ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = W(2); ctx.strokeStyle = lineO; ctx.stroke();
  ctx.save(); body(); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(0.03, hemY - 0.05, 0.4, 1);
  const hl = ctx.createLinearGradient(0, hemY, 0, sh[1]); hl.addColorStop(0, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = hl; ctx.fillRect(-0.4, hemY - 0.05, 0.8, 1);
  ctx.restore();
  ctx.strokeStyle = col.trim; ctx.lineWidth = W(2.4);
  ctx.beginPath(); ctx.moveTo(sh[0], sh[1] + 0.02); ctx.lineTo(sx0 * 0.5, 0.1); ctx.lineTo(0, hemY - 0.01); ctx.stroke();
  ctx.lineWidth = W(1.5);
  ctx.beginPath(); ctx.moveTo(sL[0] + 0.01, sL[1] - 0.005); ctx.quadraticCurveTo(sh[0], sh[1] + 0.045, sR[0] - 0.01, sR[1] - 0.005); ctx.stroke();   // collar line
  if (!fem) {
    ctx.fillStyle = '#1a0f12'; ctx.fillRect(wL[0] - 0.012, 0.083, wR[0] - wL[0] + 0.024, 0.034);
    ctx.fillStyle = col.trim; ctx.fillRect(-0.022 + sx0, 0.083, 0.044, 0.034);
    for (const m of [-1, 1]) { ctx.fillStyle = col.trim; ctx.beginPath(); ctx.arc(sx0 + m * 0.05, 0.1, 0.006, 0, TAU); ctx.fill(); }
    // two rows of braid across the chest, nothing else (no weapons)
    ctx.strokeStyle = rgba(col.trim, 0.8); ctx.lineWidth = W(1.8);
    for (const yy of [0.17, 0.22]) { ctx.beginPath(); ctx.moveTo(sx0 * 0.6 - 0.07, yy); ctx.lineTo(sx0 * 0.6 + 0.07, yy); ctx.stroke(); }
  } else {
    ctx.strokeStyle = col.trim; ctx.lineWidth = W(2); ctx.beginPath(); ctx.moveTo(wL[0] - 0.012, 0.1); ctx.lineTo(wR[0] + 0.012, 0.1); ctx.stroke();
    ctx.fillStyle = col.trim; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 0.04, hemY + 0.025, 0.008, 0, TAU); ctx.fill(); }
  }
  if (!fem) { if (P.liftL > 0.25) drawLeg(lL, 'L'); if (P.liftR > 0.25) drawLeg(lR, 'R'); }
  // ---- arms: tapered sleeves with a cuff and a real hand
  const taper = (a, b, wa, wb, fill) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.fillStyle = fill; ctx.beginPath();
    ctx.moveTo(a[0] + nx * wa / 2, a[1] + ny * wa / 2); ctx.lineTo(b[0] + nx * wb / 2, b[1] + ny * wb / 2);
    ctx.arc(b[0], b[1], wb / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, true);
    ctx.lineTo(a[0] - nx * wa / 2, a[1] - ny * wa / 2); ctx.arc(a[0], a[1], wa / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, true); ctx.closePath(); ctx.fill();
  };
  const arm = (s0, a1, a2, m) => {
    const aw = fem ? 0.046 : 0.058, u = 0.15, f = 0.155;
    const el = [s0[0] + m * u * Math.sin(a1), s0[1] - u * Math.cos(a1)];
    const b2 = a1 + a2;
    const wr = [el[0] + m * f * Math.sin(b2), el[1] - f * Math.cos(b2)];
    taper(s0, el, aw * 1.15, aw * 0.95, col.coat[0]);
    taper(el, wr, aw * 0.95, aw * 0.7, shade(col.coat[0], 0.06));
    ctx.fillStyle = col.coat[0]; ctx.beginPath(); ctx.arc(el[0], el[1], aw * 0.47, 0, TAU); ctx.fill();
    // cuff
    const cx0 = el[0] + (wr[0] - el[0]) * 0.8, cy0 = el[1] + (wr[1] - el[1]) * 0.8;
    ctx.strokeStyle = col.trim; ctx.lineWidth = aw * 0.3; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(cx0, cy0); ctx.lineTo(wr[0], wr[1]); ctx.stroke();
    // hand: palm along the forearm, thumb tucked
    const ang = Math.atan2(wr[1] - el[1], wr[0] - el[0]);
    ctx.fillStyle = col.skin; ctx.save(); ctx.translate(wr[0], wr[1]); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(0.032, 0, 0.037, 0.0185, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0.02, -0.016 * (m > 0 ? 1 : -1) * 0, 0.017, 0.009, 0.5 * m, 0, TAU); ctx.fill();
    ctx.restore();
    return wr;
  };
  const wrL = arm(sL, P.a1L, P.a2L, -1), wrR = arm(sR, P.a1R, P.a2R, 1);
  if (fem) {
    ctx.strokeStyle = rgba(col.hatTop, 0.85); ctx.lineWidth = W(3.4); ctx.lineCap = 'round';
    for (const [wr, m] of [[wrL, -1], [wrR, 1]]) { ctx.beginPath(); ctx.moveTo(wr[0], wr[1]); ctx.quadraticCurveTo(wr[0] + m * 0.08, wr[1] - 0.05 + 0.025 * Math.sin(P.spin * 2 + (o.ph || 0)), wr[0] + m * 0.16, wr[1] + 0.06); ctx.stroke(); }
  }
  // ---- head
  const hd = [sh[0] + Math.sin(ls + P.head) * 0.1, sh[1] + Math.cos(ls + P.head) * 0.1];
  ctx.fillStyle = shade(col.skin, -0.12); ctx.fillRect(sh[0] - 0.026, sh[1] - 0.005, 0.052, 0.075);
  const hr = 0.056;
  if (fem) {
    ctx.fillStyle = col.hatTop; ctx.beginPath(); ctx.ellipse(hd[0], hd[1] + 0.012, hr * 1.28, hr * 1.38, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(hd[0] - hr * 1.1, hd[1]); ctx.quadraticCurveTo(hd[0] - hr * 1.8, hd[1] - 0.13, hd[0] - hr * 0.6 + Math.sin(P.spin * 2) * 0.02, hd[1] - 0.18); ctx.lineTo(hd[0] + hr * 0.2, hd[1] - 0.02); ctx.closePath(); ctx.fill();
  }
  const fg = ctx.createRadialGradient(hd[0] - 0.016, hd[1] + 0.018, 0.005, hd[0], hd[1], hr);
  fg.addColorStop(0, '#fff0e0'); fg.addColorStop(0.35, col.skin); fg.addColorStop(1, '#a8714f');
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(hd[0], hd[1], hr * 0.9, hr, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2a1812';
  ctx.beginPath(); ctx.arc(hd[0] - 0.021, hd[1] + 0.008, 0.0068, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(hd[0] + 0.021, hd[1] + 0.008, 0.0068, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#2a1812'; ctx.lineCap = 'round';
  ctx.lineWidth = W(1.6);
  ctx.beginPath(); ctx.moveTo(hd[0] - 0.033, hd[1] - 0.008); ctx.quadraticCurveTo(hd[0] - 0.021, hd[1] - 0.017, hd[0] - 0.009, hd[1] - 0.009); ctx.moveTo(hd[0] + 0.009, hd[1] - 0.009); ctx.quadraticCurveTo(hd[0] + 0.021, hd[1] - 0.017, hd[0] + 0.033, hd[1] - 0.008); ctx.stroke();
  if (!fem) { ctx.strokeStyle = 'rgba(120,70,50,0.7)'; ctx.lineWidth = W(1.4); ctx.beginPath(); ctx.moveTo(hd[0], hd[1] + 0.004); ctx.lineTo(hd[0] - 0.004, hd[1] + 0.02); ctx.lineTo(hd[0] + 0.005, hd[1] + 0.021); ctx.stroke(); }
  if (fem) {
    ctx.strokeStyle = '#8e3a3a'; ctx.lineWidth = W(1.8); ctx.beginPath(); ctx.arc(hd[0], hd[1] + 0.03, 0.013, 0.3, Math.PI - 0.3); ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(38,22,16,0.92)'; ctx.beginPath(); ctx.moveTo(hd[0] - 0.034, hd[1] + 0.03); ctx.quadraticCurveTo(hd[0] - 0.014, hd[1] + 0.016, hd[0], hd[1] + 0.025); ctx.quadraticCurveTo(hd[0] + 0.014, hd[1] + 0.016, hd[0] + 0.034, hd[1] + 0.03); ctx.quadraticCurveTo(hd[0] + 0.012, hd[1] + 0.034, hd[0], hd[1] + 0.031); ctx.quadraticCurveTo(hd[0] - 0.012, hd[1] + 0.034, hd[0] - 0.034, hd[1] + 0.03); ctx.fill();
    ctx.strokeStyle = '#7a3a30'; ctx.lineWidth = W(1.6); ctx.beginPath(); ctx.moveTo(hd[0] - 0.012, hd[1] + 0.04); ctx.quadraticCurveTo(hd[0], hd[1] + 0.046 - 0.008 * P.impact, hd[0] + 0.012, hd[1] + 0.04); ctx.stroke();
  }
  // ---- tall fur hat, or a flower garland
  if (!fem) {
    const top = hd[1] + hr * 0.5, hw = 0.07;
    ctx.fillStyle = col.hat; ctx.beginPath(); ctx.roundRect(hd[0] - hw, top - 0.012, hw * 2, 0.11, 0.032); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(hd[0] + hw * 0.25, top, hw * 0.75, 0.09);
    ctx.fillStyle = 'rgba(255,255,255,0.13)'; for (let i = 0; i < 8; i++) ctx.fillRect(hd[0] - hw + 0.008 + i * 0.017, top + 0.008 + (i % 2) * 0.026, 0.009, 0.03);
    ctx.fillStyle = col.hatTop; ctx.beginPath(); ctx.ellipse(hd[0], top + 0.098, hw * 0.94, 0.015, 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = col.trim; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(hd[0] + i * 0.024, hd[1] + hr * 0.84 - Math.abs(i) * 0.005, 0.012, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

// A soft contact shadow under a dancer.
export function drawShadow(ctx, x, y, w, a = 0.35) {
  ctx.save(); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.22, 0, 0, TAU); ctx.fill(); ctx.restore();
}

// Motion arcs while spinning.
export function drawSpinTrail(ctx, x, y, h, k) {
  if (k <= 0.01) return;
  ctx.save(); ctx.globalAlpha = 0.5 * k; ctx.strokeStyle = PADCOL[3]; ctx.lineWidth = Math.max(3, h * 0.012); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x, y - h * (0.28 + i * 0.22), h * (0.22 - i * 0.03), h * 0.05, 0, 0.3, Math.PI * 1.3); ctx.stroke(); }
  ctx.restore();
}
