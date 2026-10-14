// Drawing the people and the scenery. Pure canvas code: no state of its own except small caches.
import { FONT } from './ui.js';

const TAU = Math.PI * 2;
export const SKINS = ['#8a5a3c', '#6f4328', '#a36a45', '#5a3620'];

// 2-bone IK in the plane: from a to b with segment lengths l1, l2; bend toward +side (side = 1 knee/elbow forward-up)
function ik(ax, ay, bx, by, l1, l2, side) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const dm = Math.min(d, l1 + l2 - 0.001), k = (l1 * l1 - l2 * l2 + dm * dm) / (2 * dm);
  const h = Math.sqrt(Math.max(0, l1 * l1 - k * k));
  const ux = dx / (d || 1), uy = dy / (d || 1);
  return { x: ax + ux * k - uy * h * side, y: ay + uy * k + ux * h * side };
}

// A cyclist seen from the side. Origin: the ground under the rear wheel; the bike points to +x. k = pixels per metre.
// o: { k, phase (pedal angle), pose (0 seated, 1 tucked, 2 out of the saddle), jersey, trim, helmet, skin, spin (wheel angle) }
export function drawCyclist(ctx, x, y, ang, o) {
  const k = o.k, r = 0.335 * k;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-ang);
  const Y = (m) => -m * k, X = (m) => m * k;
  // contact shadow
  ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(X(0.5), 2, X(0.95), k * 0.07, 0, 0, TAU); ctx.fill(); ctx.restore();
  const wheel = (cx) => {
    ctx.strokeStyle = '#14161c'; ctx.lineWidth = Math.max(1.6, k * 0.055); ctx.beginPath(); ctx.arc(cx, Y(0.335), r, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(220,226,238,0.55)'; ctx.lineWidth = Math.max(1, k * 0.018);
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = o.spin + (i * Math.PI) / 4; ctx.moveTo(cx + Math.cos(a) * r * 0.92, Y(0.335) + Math.sin(a) * r * 0.92); ctx.lineTo(cx - Math.cos(a) * r * 0.92, Y(0.335) - Math.sin(a) * r * 0.92); } ctx.stroke();
  };
  wheel(X(0.02)); wheel(X(1.04));
  const bb = { x: X(0.46), y: Y(0.30) }, seat = { x: X(0.2), y: Y(0.99) }, bar = { x: X(0.9), y: Y(0.96) }, head = { x: X(0.88), y: Y(0.72) };
  const hip = o.pose === 2 ? { x: X(0.3), y: Y(1.10) } : o.pose === 1 ? { x: X(0.17), y: Y(1.02) } : { x: X(0.16), y: Y(1.04) };
  const sh = o.pose === 2 ? { x: X(0.60), y: Y(1.62) } : o.pose === 1 ? { x: X(0.76), y: Y(1.30) } : { x: X(0.62), y: Y(1.50) };
  const lerpPt = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const pedal = (a) => ({ x: bb.x + Math.cos(a) * X(0.17), y: bb.y + Math.sin(a) * X(0.17) * -1 });
  const legs = [o.phase + Math.PI, o.phase].map((a) => {
    const f = pedal(a), kn = ik(hip.x, hip.y, f.x + X(0.04), f.y - X(0.02), X(0.43), X(0.43), -1);
    return { f, kn };
  });
  const line = (p, q, w, c) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
  const leg = (L, far) => {
    const shade = far ? 0.72 : 1;
    line(hip, L.kn, k * 0.15, far ? '#16181f' : '#20232d');
    line(L.kn, L.f, k * 0.105, far ? o.skinFar : o.skin);
    line({ x: L.f.x - X(0.02), y: L.f.y }, { x: L.f.x + X(0.12), y: L.f.y + X(0.01) }, k * 0.075, far ? '#2a2c35' : '#f4f1ea');
  };
  // far leg, frame, torso, near leg, arms, head
  leg(legs[0], true);
  const P = (px, py) => ({ x: X(px), y: Y(py) });
  const frameC = o.frame ?? '#242831';
  const rear = P(0.02, 0.335), front = P(1.04, 0.335);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  line(rear, bb, k * 0.04, frameC); line(rear, seat, k * 0.04, frameC); line(bb, seat, k * 0.045, frameC); line(seat, head, k * 0.045, frameC); line(bb, head, k * 0.05, frameC);
  line(head, front, k * 0.04, frameC); line(head, bar, k * 0.035, frameC);
  line({ x: seat.x - X(0.06), y: seat.y - X(0.01) }, { x: seat.x + X(0.08), y: seat.y - X(0.01) }, k * 0.05, '#111');
  // torso: shorts then jersey
  line(hip, lerpPt(hip, sh, 0.28), k * 0.19, '#1c1f28');
  line(lerpPt(hip, sh, 0.2), sh, k * 0.21, o.jersey);
  line(lerpPt(hip, sh, 0.55), lerpPt(hip, sh, 0.7), k * 0.075, o.trim);
  leg(legs[1], false);
  const hand = bar, elbow = ik(sh.x, sh.y, hand.x, hand.y, X(0.3), X(0.3), 1);
  line(sh, elbow, k * 0.1, o.jersey); line(elbow, hand, k * 0.085, o.skin);
  // head and helmet
  const hd = { x: sh.x + X(o.pose === 1 ? 0.14 : 0.1), y: sh.y - X(o.pose === 2 ? 0.2 : 0.17) };
  line(sh, { x: hd.x - X(0.02), y: hd.y + X(0.06) }, k * 0.085, o.skin);
  ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(hd.x, hd.y, k * 0.1, 0, TAU); ctx.fill();
  ctx.fillStyle = o.helmet; ctx.beginPath(); ctx.ellipse(hd.x - k * 0.02, hd.y - k * 0.035, k * 0.135, k * 0.09, -0.15, Math.PI * 0.95, Math.PI * 2.1); ctx.fill();
  ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(hd.x + k * 0.07, hd.y - k * 0.005, k * 0.026, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---- scenery -------------------------------------------------------------------------------------------------------
export const hash = (n) => { let h = (n | 0) * 374761393 + 668265263; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export const TONES = {
  dawn: { sky: ['#f9c8a0', '#e9a6a8', '#6b79b8'], sun: '#fff0c8', sunAt: [0.78, 0.5], far: ['#8e7fb0', '#7568a0'], mid: ['#a2754f', '#8c6040'], haze: 'rgba(255,215,190,0.35)', ground: ['#b8814f', '#8a5a34'], road: '#4a4f5c' },
  morning: { sky: ['#8ec8f0', '#cfe7f5', '#f6f0d8'], sun: '#fffbe0', sunAt: [0.2, 0.28], far: ['#7aa2c0', '#5f8aa8'], mid: ['#7a9a5a', '#5f7f46'], haze: 'rgba(240,248,255,0.32)', ground: ['#a8854e', '#7c5c34'], road: '#474c58' },
  noon: { sky: ['#4aa4e8', '#9ad0f2', '#e8f2f4'], sun: '#ffffff', sunAt: [0.5, 0.18], far: ['#6c9cc0', '#5588b0'], mid: ['#8aa458', '#6c8a40'], haze: 'rgba(255,255,255,0.25)', ground: ['#b48c50', '#85602f'], road: '#4b505c' },
  dusk: { sky: ['#4a5ea8', '#e49a7c', '#ffd894'], sun: '#ffe2a8', sunAt: [0.7, 0.62], far: ['#6a5c92', '#54497e'], mid: ['#8a6a58', '#6e5044'], haze: 'rgba(255,190,140,0.35)', ground: ['#a8744a', '#7a4e2e'], road: '#434756' },
};

function ridge(ctx, x0, x1, base, amp, wl, shift, seed, col, mult = 1) {
  ctx.beginPath(); ctx.moveTo(x0, base + amp * 3 + 400);
  for (let x = x0; x <= x1 + 8; x += 8) {
    const u = (x + shift) / wl;
    const h = Math.sin(u * 1.0 + seed) * 0.5 + Math.sin(u * 2.3 + seed * 1.7) * 0.28 + Math.sin(u * 5.1 + seed * 0.3) * 0.12;
    ctx.lineTo(x, base - h * amp * mult);
  }
  ctx.lineTo(x1 + 8, base + amp * 3 + 400); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// Sky and distant mountains. cam.s is the world distance of the camera, so the hills creep past as the race goes on.
export function drawBackdrop(ctx, r, tone, camS, horizon, unit, skyOnly = false) {
  const T = TONES[tone] ?? TONES.morning;
  const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  g.addColorStop(0, T.sky[0]); g.addColorStop(0.55, T.sky[1]); g.addColorStop(1, T.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  // sun
  const sx = r.x + r.w * T.sunAt[0], sy = r.y + r.h * T.sunAt[1] * 0.8;
  const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 150 * unit);
  sg.addColorStop(0, T.sun); sg.addColorStop(0.18, 'rgba(255,240,200,0.55)'); sg.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = sg; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = T.sun; ctx.beginPath(); ctx.arc(sx, sy, 22 * unit, 0, TAU); ctx.fill();
  // a few slow clouds
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 5; i++) {
    const cx = r.x + ((i * 0.23 + 0.05) * r.w * 1.4 - camS * (0.05 + (i % 3) * 0.02) * unit) % (r.w * 1.4) , cy = r.y + r.h * (0.1 + (i % 3) * 0.07);
    const x = cx < r.x - 120 ? cx + r.w * 1.4 : cx;
    for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.ellipse(x + q * 26 * unit, cy + (q % 2) * 5 * unit, 36 * unit, 12 * unit, 0, 0, TAU); ctx.fill(); }
  }
  // layers: far ranges (slow), near ranges
  if (skyOnly) return;
  ridge(ctx, r.x, r.x + r.w, horizon - 40 * unit, 92 * unit, 330 * unit, camS * 0.25 * unit, 1.3, T.far[0]);
  ctx.fillStyle = T.haze; ctx.fillRect(r.x, horizon - 100 * unit, r.w, 120 * unit);
  ridge(ctx, r.x, r.x + r.w, horizon + 4 * unit, 70 * unit, 240 * unit, camS * 0.7 * unit, 4.1, T.far[1]);
}

// Terraced hillside with road switchbacks cut into it, for the climbing stages.
export function drawHillside(ctx, r, tone, camS, base, unit, tilt, climbing) {
  const T = TONES[tone] ?? TONES.morning;
  const sh = camS * 1.6 * unit;
  ridge(ctx, r.x, r.x + r.w, base, 60 * unit, 190 * unit, sh, 7.7, T.mid[0], 1);
  // terrace stripes + a zig-zag of road on the slope behind
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)'; ctx.lineWidth = 2 * unit;
  for (let i = 0; i < 6; i++) {
    const y = base + (10 + i * 14) * unit;
    ctx.beginPath(); for (let x = r.x; x <= r.x + r.w + 10; x += 20) { const yy = y + Math.sin((x + sh * 0.9) / (60 * unit) + i) * 3 * unit; if (x === r.x) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke();
  }
  if (climbing > 0.15) {
    ctx.globalAlpha = 0.55 * Math.min(1, climbing * 1.2); ctx.strokeStyle = 'rgba(244,226,180,0.9)'; ctx.lineWidth = 3 * unit; ctx.lineJoin = 'round';
    ctx.beginPath();
    const period = 520 * unit;
    for (let x = r.x - period; x <= r.x + r.w + period; x += period) {
      const xo = x - (sh * 0.9 % period);
      ctx.moveTo(xo, base - 8 * unit);
      for (let j = 0; j < 4; j++) { ctx.lineTo(xo + (j % 2 ? 40 : 190) * unit, base - (8 + (j + 1) * 15) * unit); }
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export function drawTree(ctx, x, y, h, kind, shade) {
  if (kind === 0) {           // eucalyptus: tall pale trunk, sparse blue-green crown
    ctx.strokeStyle = shade ? '#b9ad94' : '#d6cdb6'; ctx.lineWidth = Math.max(2, h * 0.045); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - h * 0.04, y - h * 0.5, x + h * 0.02, y - h * 0.82); ctx.stroke();
    ctx.fillStyle = shade ? '#4f7a6a' : '#5f9078';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 1.5) * h * 0.08, y - h * (0.78 + (i % 2) * 0.1), h * 0.16, h * 0.07, i * 0.3 - 0.5, 0, TAU); ctx.fill(); }
  } else if (kind === 1) {    // prickly pear
    ctx.fillStyle = shade ? '#4c7a3e' : '#5e9248';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 1) * h * 0.17, y - h * (0.18 + 0.2 * (i % 2)), h * 0.12, h * 0.17, (i - 1) * 0.4, 0, TAU); ctx.fill(); }
  } else {                    // acacia
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = Math.max(2, h * 0.05); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + h * 0.03, y - h * 0.55); ctx.stroke();
    ctx.fillStyle = shade ? '#5f7f3e' : '#759a4c'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.62, h * 0.36, h * 0.11, 0, 0, TAU); ctx.fill();
  }
}

export function drawBuilding(ctx, x, y, h, w, seed, tone) {
  const cols = ['#f1e3c4', '#e6c8a2', '#d9e0d0', '#f4d9c0', '#cfe0e6'];
  const c = cols[Math.floor(hash(seed) * cols.length)];
  ctx.fillStyle = c; ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x + w * 0.74, y - h, w * 0.26, h);
  ctx.fillStyle = 'rgba(40,50,70,0.55)';
  const rows = Math.max(1, Math.floor(h / (w * 0.5)));
  for (let r = 0; r < rows; r++) for (let q = 0; q < 2; q++) ctx.fillRect(x + w * (0.14 + q * 0.4), y - h + (r + 0.35) * (h / rows), w * 0.2, h / rows * 0.34);
  ctx.fillStyle = tone === 'dusk' ? '#e0a070' : '#c9492f'; ctx.fillRect(x - 2, y - h - h * 0.07, w + 4, h * 0.07);   // roof band (deco)
  if (hash(seed + 9) > 0.55) { ctx.fillStyle = c; ctx.fillRect(x + w * 0.4, y - h - h * 0.34, w * 0.2, h * 0.34); ctx.fillStyle = '#c9492f'; ctx.fillRect(x + w * 0.36, y - h - h * 0.38, w * 0.28, h * 0.05); }
}

// icons used by the HUD
export function jerseyIcon(ctx, cx, cy, s, jersey, trim, letter) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = jersey; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = Math.max(1.5, s * 0.05);
  ctx.beginPath(); ctx.moveTo(-s * 0.52, -s * 0.34); ctx.lineTo(-s * 0.26, -s * 0.5); ctx.quadraticCurveTo(0, -s * 0.38, s * 0.26, -s * 0.5); ctx.lineTo(s * 0.52, -s * 0.34); ctx.lineTo(s * 0.4, -s * 0.1); ctx.lineTo(s * 0.28, -s * 0.16); ctx.lineTo(s * 0.28, s * 0.5); ctx.lineTo(-s * 0.28, s * 0.5); ctx.lineTo(-s * 0.28, -s * 0.16); ctx.lineTo(-s * 0.4, -s * 0.1); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = trim; ctx.fillRect(-s * 0.28, s * 0.0, s * 0.56, s * 0.1);
  if (letter) { ctx.fillStyle = trim === '#fff4dc' || trim === '#f2c14e' ? '#2a1a08' : '#fff'; ctx.font = `800 ${Math.round(s * 0.34)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(letter, 0, -s * 0.2); }
  ctx.restore();
}
