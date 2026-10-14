// Castells: all drawing of people, the crowd (pinya), the square and the particles. Canvas 2D only, no assets.
// People are stylised but proportioned like real ones: head, neck, shirt, black sash, white trousers, jointed arms and legs, hair
// styles, helmets for the children. Nothing here touches the simulation.

const TAU = Math.PI * 2;
export const FX = { soft: true };
const clampv = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export const SKIN = ['#f7d6b9', '#ebbd93', '#cd925f', '#9c673f', '#6c4228'];
export const SKIN_D = ['#dcae8c', '#cc9a70', '#ad7545', '#7d4f2f', '#4f2f1c'];
export const HAIR = ['#1a1514', '#3b2417', '#6b4526', '#8f3d1c', '#d6ad5d', '#aaa5a0'];

// The colla shirt colours (the player picks one in the Colla screen; the rest unlock with stars).
export const COLLAS = [
  { id: 'green', name: 'Green', c: '#2e9a5f', d: '#1b6641', l: '#5fcf8c', need: 0 },
  { id: 'terra', name: 'Terracotta', c: '#c4553a', d: '#8a3322', l: '#ee8a6a', need: 0 },
  { id: 'blue', name: 'Blue', c: '#2f6fc0', d: '#1c4584', l: '#69a2ec', need: 3 },
  { id: 'saffron', name: 'Saffron', c: '#dd9a22', d: '#9c6a10', l: '#fbcb5f', need: 6 },
  { id: 'plum', name: 'Plum', c: '#7a4aa6', d: '#4d2c70', l: '#a883d2', need: 10 },
  { id: 'teal', name: 'Teal', c: '#1f9c9a', d: '#10635f', l: '#55d0cb', need: 14 },
];

// The squares (backdrops). need = total stars.
export const PLAZAS = [
  { name: 'Evening square', need: 0, sky: ['#2a3468', '#c6648a', '#f4b379'], sun: '#fff1c4', floor: ['#8a7762', '#5d4f43'], walls: ['#e6d2a6', '#d9b987', '#cfa27a', '#efe1bf', '#c98f6c'], dark: 'rgba(24,18,40,0.55)', lamps: false, glow: 'rgba(255,214,150,0.5)' },
  { name: 'Morning square', need: 3, sky: ['#6cb6e8', '#a9d9f0', '#f7ecd0'], sun: '#fffbe5', floor: ['#b3a58c', '#8a7d68'], walls: ['#f1e6c8', '#e4cb9a', '#dcb28a', '#f6efd9', '#d6a584'], dark: 'rgba(30,40,70,0.4)', lamps: false, glow: 'rgba(255,248,214,0.4)' },
  { name: 'Lantern night', need: 8, sky: ['#0b1030', '#1c2656', '#3b3f7a'], sun: '#e8ecff', floor: ['#4d4b5e', '#2c2a3a'], walls: ['#8e84a0', '#7a7092', '#9a8a8a', '#8a8fa8', '#7d7a98'], dark: 'rgba(5,6,20,0.62)', lamps: true, glow: 'rgba(255,205,120,0.55)' },
  { name: 'Festival square', need: 14, sky: ['#3d2a6a', '#e0708a', '#ffc27a'], sun: '#fff0c0', floor: ['#92806a', '#64564a'], walls: ['#f0d9a6', '#e9b98a', '#e0a07a', '#f4e7c8', '#d9926c'], dark: 'rgba(30,14,44,0.5)', lamps: true, glow: 'rgba(255,190,140,0.55)' },
];

// ---- people ------------------------------------------------------------------------------------------------------------------
// Tapered, lit limb segment: a filled quad (w0 at the start, w1 at the end) with round joints and a side-lit gradient.
function shadeHex(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
  const n = parseInt(m[1], 16); const f = (v) => clampv(Math.round(v + (amt < 0 ? v * amt : (255 - v) * amt)), 0, 255);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function seg(ctx, x0, y0, x1, y1, w0, w1, col) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const g = ctx.createLinearGradient(x0 - nx * w0 / 2, y0 - ny * w0 / 2, x0 + nx * w0 / 2, y0 + ny * w0 / 2);
  g.addColorStop(0, shadeHex(col, 0.22)); g.addColorStop(0.55, col); g.addColorStop(1, shadeHex(col, -0.32));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.lineTo(x1 - nx * w1 / 2, y1 - ny * w1 / 2); ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(x1, y1, w1 / 2, 0, TAU); ctx.arc(x0, y0, w0 / 2, 0, TAU); ctx.fill();
}
function limb(ctx, x0, y0, x1, y1, w, col) { seg(ctx, x0, y0, x1, y1, w, w * 0.9, col); }
function limb2(ctx, x0, y0, x1, y1, x2, y2, w, col) {
  seg(ctx, x0, y0, x1, y1, w, w * 0.86, col);
  seg(ctx, x1, y1, x2, y2, w * 0.86, w * 0.7, col);
}

// Arm targets for a pose. Returns [elbowX, elbowY, handX, handY] in units of u (x right, y down from shoulder line `sh`).
function armPose(pose, sd, t, ph) {
  switch (pose) {
    case 'up': return [sd * 0.2, -0.04, sd * 0.15, -0.26];
    case 'push': return [sd * 0.2, 0.02, -sd * 0.06, -0.12];
    case 'brace': return [sd * 0.24, 0.1, sd * 0.33, 0.0];
    case 'cheer': {
      if (sd > 0) { const w = Math.sin(t * 9) * 0.03; return [0.25, -0.12, 0.2 + w, -0.34]; }
      return [-0.22, 0.12, -0.28, 0.03];
    }
    case 'climb': {
      const a = Math.sin(ph * 2 + (sd > 0 ? 0 : Math.PI));
      return [sd * 0.2, -0.05 - 0.07 * a, sd * 0.13, -0.24 - 0.12 * a];
    }
    case 'sit': return [sd * 0.2, 0.15, sd * 0.12, 0.26];
    default: return [sd * 0.22, 0.13, sd * 0.28, 0.04];       // hold: hands on the neighbours' shoulders
  }
}

// Head and shoulders badge (for cards and the slot strip).
export function drawBadge(ctx, cx, cy, r, p, col, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, o.bg0 || '#cdbb97'); g.addColorStop(1, o.bg1 || '#a8926b');
  ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  // shoulders
  const sg = ctx.createLinearGradient(cx - r, 0, cx + r, 0); sg.addColorStop(0, col.l); sg.addColorStop(0.5, col.c); sg.addColorStop(1, col.d);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.92, r * 0.95, r * 0.62, 0, Math.PI, 0); ctx.fill();
  headParts(ctx, cx, cy - r * 0.08, r * (p.kid ? 0.5 : 0.44), p, col, o);
  ctx.restore();
  ctx.strokeStyle = o.ring || 'rgba(30,30,50,0.55)'; ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
}

function headParts(ctx, hx, hy, hr, p, col, o = {}) {
  const skin = SKIN[p.skin % 5], skinD = SKIN_D[p.skin % 5], hair = HAIR[p.hairCol % 6];
  // neck
  ctx.fillStyle = skinD; ctx.fillRect(hx - hr * 0.38, hy + hr * 0.6, hr * 0.76, hr * 0.85);
  const style = p.hair % 5;
  // hair behind the head
  ctx.fillStyle = hair;
  if (!p.kid && (style === 1 || style === 2)) { ctx.beginPath(); ctx.ellipse(hx, hy + hr * 0.28, hr * 1.08, hr * (style === 1 ? 1.35 : 1.0), 0, 0, TAU); ctx.fill(); }
  if (style === 2) { ctx.beginPath(); ctx.ellipse(hx + hr * 1.05, hy + hr * 0.5, hr * 0.28, hr * 0.7, -0.35, 0, TAU); ctx.fill(); }
  // head
  const hg = ctx.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.2, hx, hy, hr * 1.15);
  hg.addColorStop(0, skin); hg.addColorStop(1, skinD);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(hx, hy, hr * 0.92, hr, 0, 0, TAU); ctx.fill();
  // ears
  ctx.fillStyle = skinD; ctx.beginPath(); ctx.arc(hx - hr * 0.9, hy + hr * 0.1, hr * 0.17, 0, TAU); ctx.arc(hx + hr * 0.9, hy + hr * 0.1, hr * 0.17, 0, TAU); ctx.fill();
  // hair on top
  ctx.fillStyle = hair;
  if (!p.kid || style !== 0) {
    ctx.beginPath(); ctx.ellipse(hx, hy - hr * 0.2, hr * 0.98, hr * 0.85, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx, hy - hr * 0.42, hr * 0.98, hr * 0.62, 0, Math.PI, TAU); ctx.fill();
  }
  if (style === 3) { ctx.beginPath(); ctx.arc(hx, hy - hr * 1.12, hr * 0.38, 0, TAU); ctx.fill(); }
  if (style === 4) { for (let i = 0; i < 5; i++) { const a = Math.PI * (1.08 + i * 0.21); ctx.beginPath(); ctx.arc(hx + Math.cos(a) * hr * 0.88, hy - hr * 0.12 + Math.sin(a) * hr * 0.9, hr * 0.32, 0, TAU); ctx.fill(); } }
  // helmet (the children)
  if (p.kid) {
    const hc = o.helmet || '#f2f0ea';
    ctx.fillStyle = hc;
    ctx.beginPath(); ctx.ellipse(hx, hy - hr * 0.12, hr * 1.06, hr * 0.98, 0, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath(); ctx.fill();
    ctx.fillStyle = col.c; ctx.fillRect(hx - hr * 1.0, hy - hr * 0.26, hr * 2.0, hr * 0.22);
    ctx.strokeStyle = 'rgba(40,40,50,0.7)'; ctx.lineWidth = Math.max(1, hr * 0.1);
    ctx.beginPath(); ctx.moveTo(hx - hr * 0.88, hy + hr * 0.05); ctx.lineTo(hx - hr * 0.62, hy + hr * 0.82); ctx.moveTo(hx + hr * 0.88, hy + hr * 0.05); ctx.lineTo(hx + hr * 0.62, hy + hr * 0.82); ctx.stroke();
  }
  // face: eyes and a mouth, small and quiet
  const ex = hr * 0.36, ey = hy + hr * 0.12, er = Math.max(0.9, hr * 0.09);
  if (hr > 5) {
    ctx.fillStyle = 'rgba(255,250,244,0.92)';
    ctx.beginPath(); ctx.ellipse(hx - ex, ey, er * 1.7, er * 1.1, 0, 0, TAU); ctx.ellipse(hx + ex, ey, er * 1.7, er * 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = HAIR[p.hairCol % 6]; ctx.lineWidth = Math.max(0.8, hr * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hx - ex - er * 1.8, ey - er * 2.2); ctx.lineTo(hx - ex + er * 1.8, ey - er * 2.5); ctx.moveTo(hx + ex - er * 1.8, ey - er * 2.5); ctx.lineTo(hx + ex + er * 1.8, ey - er * 2.2); ctx.stroke();
    ctx.fillStyle = skinD; ctx.beginPath(); ctx.ellipse(hx + hr * 0.04, hy + hr * 0.36, hr * 0.12, hr * 0.17, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(40,24,18,0.9)';
  ctx.beginPath(); ctx.arc(hx - ex, ey, er, 0, TAU); ctx.arc(hx + ex, ey, er, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(70,30,24,0.65)'; ctx.lineWidth = Math.max(0.8, hr * 0.08); ctx.lineCap = 'round';
  ctx.beginPath();
  if (o.smile) ctx.arc(hx, hy + hr * 0.38, hr * 0.28, 0.15, Math.PI - 0.15);
  else { ctx.moveTo(hx - hr * 0.2, hy + hr * 0.52); ctx.lineTo(hx + hr * 0.2, hy + hr * 0.52); }
  ctx.stroke();
}

// A whole person standing with feet at (x, y). s = height in px of a 1.0 adult. o: shirt, pose, t, ph, rot, alpha, strain, smile, bust.
export function drawPerson(ctx, x, y, s, p, o = {}) {
  const col = o.shirt || COLLAS[0];
  const u = s * (p.h || 1), kid = !!p.kid, t = o.t || 0;
  const strain = o.strain || 0;
  const trem = strain > 0 ? Math.sin(t * 38 + p.id * 3) * u * 0.006 * strain : 0;
  ctx.save();
  ctx.translate(x + trem, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  const hip = kid ? -0.44 * u : -0.5 * u, sh = kid ? -0.72 * u : -0.8 * u;
  const hr = u * (kid ? 0.115 : 0.077), headY = sh - hr * (kid ? 1.15 : 1.35);
  const pose = o.pose || 'hold';
  const bob = Math.sin(t * 2.1 + p.id * 1.9) * u * 0.004;
  const trousers = '#efece4', trousersD = '#c9c4b8';
  if (!o.bust) {
    // legs: slight stance, knees soft; a climber lifts a knee
    const climbing = pose === 'climb';
    for (const sd of [-1, 1]) {
      const lift = climbing ? Math.max(0, Math.sin(o.ph * 2 + (sd > 0 ? 0 : Math.PI))) : 0;
      const fx = sd * 0.1 * u, fy = -lift * 0.14 * u, kx = sd * (0.12 + lift * 0.06) * u, ky = hip * 0.45 - lift * 0.08 * u;
      limb2(ctx, sd * 0.07 * u, hip, kx, ky, fx, fy, u * 0.105, trousers);
      limb(ctx, sd * 0.07 * u, hip + u * 0.02, kx, ky, u * 0.04, trousersD);
      ctx.fillStyle = '#2a2623';
      ctx.beginPath(); ctx.ellipse(fx + sd * 0.012 * u, fy - u * 0.012, u * 0.075, u * 0.03, 0, 0, TAU); ctx.fill();
    }
  }
  // far arm first for a hint of depth, then torso, then near arm
  const arm = (sd, sleeve) => {
    const [ex, ey, hx, hy] = armPose(pose, sd, t, o.ph || 0);
    const sx = sd * 0.15 * u, sy = sh + u * 0.03;
    limb2(ctx, sx, sy, sx + (ex - sd * 0.15) * u * 1.0 + sd * 0.0, sh + ey * u, hx * u, sh + hy * u, u * (kid ? 0.085 : 0.075), sleeve);
    const hxp = hx * u, hyp = sh + hy * u, ang = Math.atan2(hyp - (sh + ey * u), hxp - (sx + (ex - sd * 0.15) * u + sd * 0.0)) ;
    ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(ang);
    ctx.fillStyle = SKIN[p.skin % 5];
    ctx.beginPath(); ctx.ellipse(u * 0.02, 0, u * 0.036, u * 0.026, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = SKIN_D[p.skin % 5];
    ctx.beginPath(); ctx.ellipse(u * 0.0, u * 0.02 * sd, u * 0.016, u * 0.011, 0.5 * sd, 0, TAU); ctx.fill();
    ctx.restore();
  };
  arm(-1, col.d);
  // torso
  const lw = (kid ? 0.14 : 0.16) * u, ww = (kid ? 0.115 : 0.12) * u;
  const tg = ctx.createLinearGradient(-lw, 0, lw, 0);
  tg.addColorStop(0, col.l); tg.addColorStop(0.45, col.c); tg.addColorStop(1, col.d);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-lw, sh + u * 0.02);
  ctx.quadraticCurveTo(-lw * 1.02, sh - u * 0.015, -lw * 0.55, sh - u * 0.02);
  ctx.lineTo(lw * 0.55, sh - u * 0.02);
  ctx.quadraticCurveTo(lw * 1.02, sh - u * 0.015, lw, sh + u * 0.02);
  ctx.lineTo(ww, hip + u * 0.04); ctx.lineTo(-ww, hip + u * 0.04); ctx.closePath(); ctx.fill();
  if (o.bust) { const bg = ctx.createLinearGradient(0, hip, 0, hip + u * 0.2); bg.addColorStop(0, col.d); bg.addColorStop(1, 'rgba(10,10,20,0.9)'); ctx.fillStyle = bg; ctx.fillRect(-ww, hip + u * 0.03, ww * 2, u * 0.2); }
  // collar highlight and the black sash (faixa)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = u * 0.012; ctx.beginPath(); ctx.moveTo(-lw * 0.92, sh + u * 0.035); ctx.lineTo(-ww * 0.95, hip); ctx.stroke();
  ctx.fillStyle = '#1b1a22'; ctx.fillRect(-ww * 1.04, hip - u * 0.055, ww * 2.08, u * 0.095);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(-ww * 1.04, hip - u * 0.055, ww * 2.08, u * 0.014);
  if (strain > 0) { ctx.fillStyle = `rgba(255,60,40,${0.28 * strain})`; ctx.fillRect(-lw, sh - u * 0.02, lw * 2, hip - sh + u * 0.07); }
  arm(1, col.c);
  // head
  headParts(ctx, 0, headY + bob, hr, p, col, { smile: o.smile, helmet: o.helmet });
  if (strain > 0.4) {
    ctx.fillStyle = 'rgba(160,220,255,0.85)';
    ctx.beginPath(); ctx.ellipse(hr * 1.25, headY - hr * 0.2 + Math.abs(Math.sin(t * 5 + p.id)) * hr * 0.4, hr * 0.14, hr * 0.22, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---- the pinya (the crowd at the foot of the tower) --------------------------------------------------------------------------
// cam: { cx, gy, s, colW, N }. lean in [-1,1]; push in {-1,0,1}: the side the crowd is pushing from.
// pinyaSpecs lists the crowd (position, look, pose); drawPinya paints the 2D version, the 3D layer (view3d/castells3d.js) reads the same list.
export function pinyaSpecs(cam, t, lean, push) {
  const N = cam.N, half = (N * cam.colW) / 2, s = cam.s;
  const count = Math.max(8, Math.round(N * 3.4));
  const list = [];
  for (let i = 0; i < count; i++) {
    const a = (i + 0.5) / count;            // 0..1 along the arc
    const front = i % 2 === 1;
    const xx = cam.cx + (a - 0.5) * (half * 2 + s * 1.5) * (front ? 0.92 : 1.0);
    const yy = cam.gy + (front ? s * 0.07 : -s * 0.02) - Math.sin(a * Math.PI) * s * 0.02;
    const look = { id: 100 + i, kid: false, h: 0.84 + hash(i * 3.1) * 0.12, skin: Math.floor(hash(i * 1.7) * 5), hair: Math.floor(hash(i * 2.3) * 5), hairCol: Math.floor(hash(i * 5.9) * 6), cheer: 0 };
    const side = xx < cam.cx ? 1 : -1;
    const shove = push !== 0 && side === -push ? 1 : 0;
    const wob = Math.sin(t * 2.4 + i * 1.3) * s * 0.006 + lean * s * 0.015 * side;
    list.push({ i, count, front, x: xx + wob, y: yy, look, shove, side, wob });
  }
  return list;
}
export function drawPinya(ctx, cam, colla, t, lean, push, rows = 'back') {
  const s = cam.s;
  for (const it of pinyaSpecs(cam, t, lean, push)) {
    if ((rows === 'front') !== it.front) continue;
    drawPerson(ctx, it.x, it.y + s * 0.52, s * 0.9, it.look, { shirt: colla, pose: it.shove ? 'push' : 'up', t, bust: true, alpha: 1 });
  }
}

// ---- the square ------------------------------------------------------------------------------------------------------------------
function paintPlaza(c, W, H, R, plaza) {
  const hz = R.y + R.h * 0.6;       // the street line
  const sky = c.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, plaza.sky[0]); sky.addColorStop(0.55, plaza.sky[1]); sky.addColorStop(1, plaza.sky[2]);
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  // sun or moon glow
  const sx = W * (plaza.lamps && plaza.name === 'Lantern night' ? 0.78 : 0.2), sy = R.y + R.h * 0.2;
  const rg = c.createRadialGradient(sx, sy, 4, sx, sy, Math.max(W, H) * 0.28); rg.addColorStop(0, plaza.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = rg; c.fillRect(0, 0, W, hz);
  c.fillStyle = plaza.sun; c.beginPath(); c.arc(sx, sy, Math.min(W, H) * 0.035, 0, TAU); c.fill();
  if (plaza.name === 'Lantern night') {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 34; i++) { c.globalAlpha = 0.35 + hash(i) * 0.5; c.fillRect(hash(i * 2.1) * W, hash(i * 3.7) * hz * 0.5, 2, 2); }
    c.globalAlpha = 1;
  }
  // buildings along the street, in blocks
  const unit = Math.max(120, W / 5);
  let x = -hash(7) * unit * 0.6, k = 0;
  const bell = Math.floor(hash(3) * 3);
  while (x < W + 10) {
    const bw = unit * (0.8 + hash(k + 11) * 0.7), bh = R.h * (0.26 + hash(k + 21) * 0.18);
    const wall = plaza.walls[Math.floor(hash(k + 31) * plaza.walls.length)];
    const top = hz - bh;
    // wall
    const wg = c.createLinearGradient(x, 0, x + bw, 0); wg.addColorStop(0, wall); wg.addColorStop(1, shade(wall, -0.18));
    c.fillStyle = wg; c.fillRect(x, top, bw, bh);
    // roof tiles
    c.fillStyle = shade('#b1573a', plaza.lamps ? -0.45 : -0.05); c.fillRect(x - 3, top - bh * 0.07, bw + 6, bh * 0.07);
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x - 3, top - bh * 0.015, bw + 6, bh * 0.015);
    // windows with arches, shutters, balconies
    const cols = Math.max(2, Math.round(bw / (unit * 0.3))), rows2 = bh > R.h * 0.34 ? 2 : 1;
    for (let r = 0; r < rows2; r++) for (let q = 0; q < cols; q++) {
      const wx = x + bw * ((q + 0.5) / cols), wy = top + bh * (0.14 + r * 0.34), ww = bw / cols * 0.42, wh = bh * 0.22;
      const lit = plaza.lamps && hash(k * 7 + q * 3 + r) > 0.35;
      c.fillStyle = lit ? 'rgba(255,214,130,0.95)' : plaza.dark;
      c.beginPath(); c.moveTo(wx - ww / 2, wy + wh); c.lineTo(wx - ww / 2, wy + ww * 0.5); c.arc(wx, wy + ww * 0.5, ww / 2, Math.PI, 0); c.lineTo(wx + ww / 2, wy + wh); c.closePath(); c.fill();
      c.fillStyle = shade('#4f7a52', plaza.lamps ? -0.5 : 0); c.fillRect(wx - ww * 0.95, wy + ww * 0.4, ww * 0.38, wh - ww * 0.4); c.fillRect(wx + ww * 0.57, wy + ww * 0.4, ww * 0.38, wh - ww * 0.4);
      if (r === 0 && hash(k + q * 5) > 0.4) { c.fillStyle = 'rgba(20,20,30,0.7)'; c.fillRect(wx - ww * 0.8, wy + wh - 2, ww * 1.6, 2.5); for (let b = 0; b < 5; b++) c.fillRect(wx - ww * 0.78 + b * ww * 0.39, wy + wh - bh * 0.07, 1.5, bh * 0.07); }
    }
    // arcade at the foot
    const ar = Math.max(2, Math.round(bw / (unit * 0.38)));
    for (let q = 0; q < ar; q++) {
      const ax = x + bw * ((q + 0.5) / ar), aw = bw / ar * 0.62, ah = bh * 0.2;
      c.fillStyle = plaza.dark; c.beginPath(); c.moveTo(ax - aw / 2, hz); c.lineTo(ax - aw / 2, hz - ah + aw * 0.5); c.arc(ax, hz - ah + aw * 0.5, aw / 2, Math.PI, 0); c.lineTo(ax + aw / 2, hz); c.closePath(); c.fill();
    }
    if (k % 5 === bell && bw > unit * 0.7) {
      // a bell tower rising behind the block
      const tw = bw * 0.36, tx = x + bw * 0.5 - tw / 2, th = bh * 1.1;
      c.fillStyle = shade(wall, -0.1); c.fillRect(tx, top - th, tw, th);
      c.fillStyle = plaza.dark; c.beginPath(); c.moveTo(tx + tw * 0.22, top - th * 0.55); c.arc(tx + tw / 2, top - th * 0.62, tw * 0.28, Math.PI, 0); c.lineTo(tx + tw * 0.78, top - th * 0.3); c.lineTo(tx + tw * 0.22, top - th * 0.3); c.closePath(); c.fill();
      c.fillStyle = shade(wall, -0.25); for (let m = 0; m < 4; m++) c.fillRect(tx + m * tw / 3.2, top - th - tw * 0.12, tw / 5, tw * 0.14);
    }
    x += bw + unit * 0.02; k++;
  }
  // haze over the far buildings
  const hg = c.createLinearGradient(0, hz - R.h * 0.3, 0, hz); hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(1, plaza.lamps ? 'rgba(80,90,150,0.2)' : 'rgba(255,230,190,0.22)');
  c.fillStyle = hg; c.fillRect(0, hz - R.h * 0.3, W, R.h * 0.3);
  // bunting
  for (let l = 0; l < 2; l++) {
    const y0 = R.y + R.h * (0.12 + l * 0.08), sag = R.h * 0.035;
    c.strokeStyle = 'rgba(30,24,40,0.6)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, y0); c.quadraticCurveTo(W / 2, y0 + sag * 2, W, y0 + (l ? 8 : -6)); c.stroke();
    const cols = ['#f4efe2', '#33a89a', '#f0b84a', '#d9674b'];
    for (let q = 1; q < 22; q++) {
      const tt = q / 22, px = W * tt, py = (1 - tt) * (1 - tt) * y0 + 2 * (1 - tt) * tt * (y0 + sag * 2) + tt * tt * (y0 + (l ? 8 : -6));
      c.fillStyle = cols[(q + l) % cols.length]; c.beginPath(); c.moveTo(px - 6, py); c.lineTo(px + 6, py); c.lineTo(px, py + 15); c.closePath(); c.fill();
    }
  }
  // paving
  const fg = c.createLinearGradient(0, hz, 0, H); fg.addColorStop(0, plaza.floor[0]); fg.addColorStop(1, plaza.floor[1]);
  c.fillStyle = fg; c.fillRect(0, hz, W, H - hz);
  c.strokeStyle = 'rgba(0,0,0,0.13)'; c.lineWidth = 1.5;
  for (let i = -6; i <= 14; i++) { c.beginPath(); c.moveTo(W / 2 + i * W * 0.05, hz); c.lineTo(W / 2 + (i - 3.5) * W * 0.5, H); c.stroke(); }
  for (let j = 1; j < 9; j++) { const yy = hz + (H - hz) * Math.pow(j / 9, 1.8); c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); }
  // lanterns
  if (plaza.lamps) for (const lx of [0.08, 0.92]) {
    const px = W * lx, py = hz + (H - hz) * 0.05;
    c.fillStyle = 'rgba(20,20,30,0.85)'; c.fillRect(px - 2, py - R.h * 0.28, 4, R.h * 0.28);
    const lg = c.createRadialGradient(px, py - R.h * 0.28, 2, px, py - R.h * 0.28, R.h * 0.2); lg.addColorStop(0, 'rgba(255,214,140,0.95)'); lg.addColorStop(1, 'rgba(255,214,140,0)');
    c.fillStyle = lg; c.fillRect(px - R.h * 0.2, py - R.h * 0.48, R.h * 0.4, R.h * 0.4);
  }
  // spectators: dark silhouettes along the edges, some with raised arms
  c.fillStyle = plaza.lamps ? 'rgba(6,8,22,0.8)' : 'rgba(26,20,40,0.72)';
  const sp = Math.max(18, W * 0.028);
  for (const side of [0, 1]) for (let i = 0; i < 9; i++) {
    const px = side ? W - (i + 0.5) * sp * 1.05 : (i + 0.5) * sp * 1.05, py = hz + (H - hz) * (0.12 + hash(i + side * 9) * 0.1), r = sp * (0.42 + hash(i * 3 + side) * 0.12);
    c.beginPath(); c.arc(px, py - r * 2.1, r, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(px, py, r * 1.35, r * 1.8, 0, Math.PI, 0); c.fill();
    if (hash(i * 7 + side * 3) > 0.55) { c.strokeStyle = c.fillStyle; c.lineWidth = r * 0.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(px + r, py - r * 0.4); c.lineTo(px + r * 1.7, py - r * 2.9); c.stroke(); }
  }
  // vignette
  const vg = c.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, plaza.lamps ? 'rgba(0,0,10,0.5)' : 'rgba(20,10,30,0.32)');
  c.fillStyle = vg; c.fillRect(0, 0, W, H);
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => clampv(Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

let CACHE = { key: '', canvas: null };
export const resetArt = () => { CACHE = { key: '', canvas: null }; };
// R = the rectangle the tower stage occupies; the street line sits at 60 percent of it.
export function drawBackdrop(ctx, W, H, R, plazaIdx) {
  const plaza = PLAZAS[plazaIdx] ?? PLAZAS[0];
  const tr = ctx.getTransform ? ctx.getTransform() : null;
  const k = clampv(tr && tr.a ? tr.a : 1, 1, 2.2);
  const key = `${Math.round(W)}x${Math.round(H)}|${Math.round(R.x)},${Math.round(R.y)},${Math.round(R.w)},${Math.round(R.h)}|${plazaIdx}|${k.toFixed(1)}`;
  if (typeof OffscreenCanvas !== 'undefined') {
    if (CACHE.key !== key) {
      try {
        const c = new OffscreenCanvas(Math.max(2, Math.round(W * k)), Math.max(2, Math.round(H * k)));
        const cc = c.getContext('2d'); cc.scale(k, k);
        paintPlaza(cc, W, H, R, plaza);
        CACHE = { key, canvas: c };
      } catch { CACHE = { key: '', canvas: null }; }
    }
    if (CACHE.canvas && CACHE.key === key) { ctx.drawImage(CACHE.canvas, 0, 0, W, H); return; }
  }
  paintPlaza(ctx, W, H, R, plaza);
}
export const streetY = (R) => R.y + R.h * 0.6;

// ---- particles -------------------------------------------------------------------------------------------------------------------
// kinds: 0 dust, 1 confetti, 2 spark, 3 ring. Screen-space px. Deterministic: callers pass the values.
export function stepFx(list, dt) {
  for (const q of list) {
    q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.kind === 1) { q.vy += 520 * dt; q.vx *= 0.99; q.rot += q.spin * dt; }
    else if (q.kind === 0) { q.vy -= 20 * dt; q.vx *= 0.96; }
    else if (q.kind === 2) { q.vy += 300 * dt; }
  }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].t >= list[i].max) list.splice(i, 1);
}
export function drawFx(ctx, list) {
  for (const q of list) {
    const k = clampv(q.t / q.max, 0, 1);
    ctx.save();
    if (q.kind === 0) { ctx.globalAlpha = (1 - k) * 0.5; ctx.fillStyle = '#e9dcc0'; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.6 + k), 0, TAU); ctx.fill(); }
    else if (q.kind === 1) { ctx.globalAlpha = 1 - k * k; ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillStyle = q.col; ctx.fillRect(-q.size, -q.size * 0.5, q.size * 2, q.size); }
    else if (q.kind === 2) { ctx.globalAlpha = 1 - k; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * 0.5), 0, TAU); ctx.fill(); }
    else { ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = q.col; ctx.lineWidth = 4 * (1 - k) + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.3 + k), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
}
