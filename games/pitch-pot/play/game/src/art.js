// All the drawing for Pitch Pot: a misty garden pavilion, ink-wash mountains, a lit bronze vase, bamboo arrows, ink and petal effects,
// and the diagrams used by the How to Play / Rules pages. Pure canvas 2D, no DOM.
// World units are centimetres; a camera cam = { ox, cx, s, floorY } maps them: X = ox + (x - cx) * s, Y = floorY - y * s.
import { ARROW, VASE_PROFILE, RIM_Y, EAR, WALL, vaseOuterR, vaseInnerR, HAND, FLOOR_IN } from './sim.js';
import { roundPath, FONT, NUM } from './ui.js';

export const SERIF = "'Songti SC', 'Noto Serif CJK SC', 'Hiragino Mincho ProN', 'Iowan Old Style', Georgia, 'Times New Roman', serif";
export const TEAM = [
  { name: 'Red', main: '#d9422b', dark: '#7a1c10', light: '#ff9d84', feather: '#e24a30' },
  { name: 'Jade', main: '#2fae8c', dark: '#145a47', light: '#9be8cf', feather: '#35b894' },
];
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const grad = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rgrad = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };

// ---- camera -------------------------------------------------------------------------------------------------------------------------
// scene = { x, w, floorY, top }; z = 0 wide view of the whole throw, 1 close on the vase.
export function cameraFor(scene, D, z) {
  const hAvail = Math.max(120, scene.floorY - scene.top);
  const sWide = Math.min(scene.w / (D + 112), hAvail / 190), sFocus = Math.min((scene.w * 0.94) / 88, hAvail / 98);
  const e = smooth(z), s = Math.exp(lerp(Math.log(sWide), Math.log(Math.max(sWide, sFocus)), e));
  const cxWide = (D - 34) / 2, cxFocus = D - 8;
  return { ox: scene.x + scene.w / 2, cx: lerp(cxWide, cxFocus, e), s, floorY: scene.floorY };
}
export const sx = (cam, x) => cam.ox + (x - cam.cx) * cam.s;
export const sy = (cam, y) => cam.floorY - y * cam.s;

// ---- backdrop: sky, ink mountains, pines, pavilion beams, floor --------------------------------------------------------------------
export function drawBackdrop(ctx, w, h, t, cam, o = {}) {
  const fy = cam.floorY, top = 0;
  // sky: pale jade at the top into warm rice-paper light at the horizon
  ctx.fillStyle = grad(ctx, 0, 0, 0, fy, [[0, '#6f9f94'], [0.35, '#b9cfc0'], [0.7, '#efe3c3'], [1, '#f6e8c6']]);
  ctx.fillRect(0, 0, w, fy + 1);
  // a low sun behind the ridges, drifting almost imperceptibly
  const sunx = w * 0.7 + Math.sin(t * 0.05) * 6, suny = fy * 0.55;
  ctx.fillStyle = rgrad(ctx, sunx, suny, 0, fy * 0.5, [[0, 'rgba(255,248,222,0.95)'], [0.15, 'rgba(255,236,190,0.7)'], [1, 'rgba(255,230,180,0)']]);
  ctx.fillRect(0, 0, w, fy);
  ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(sunx, suny, Math.max(14, fy * 0.04), 0, 7); ctx.fill();
  // ink-wash ridges in three depths, mist between them
  const ridge = (base, amp, f, ph, col, mist) => {
    ctx.beginPath(); ctx.moveTo(0, fy + 2);
    for (let x = 0; x <= w + 16; x += 16) {
      const v = Math.sin(x * f + ph) * 0.55 + Math.sin(x * f * 2.7 + ph * 1.9) * 0.3 + Math.sin(x * f * 5.1 + ph * 0.7) * 0.15;
      ctx.lineTo(x, base - amp * (0.55 + 0.45 * v));
    }
    ctx.lineTo(w, fy + 2); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    if (mist) { ctx.fillStyle = grad(ctx, 0, base - amp * 0.6, 0, base + amp * 0.6, [[0, 'rgba(246,236,210,0)'], [0.6, 'rgba(246,236,210,0.55)'], [1, 'rgba(246,236,210,0.0)']]); ctx.fillRect(0, base - amp * 0.6, w, amp * 1.2); }
  };
  const H = Math.max(140, fy * 0.5);
  ridge(fy - H * 0.55, H * 0.55, 0.0052, 1.7, '#9db8ae', true);
  ridge(fy - H * 0.30, H * 0.45, 0.0075, 4.6, '#6f948b', true);
  ridge(fy - H * 0.10, H * 0.32, 0.0105, 2.2, '#42655e', true);
  // far pavilion roof on the middle ridge, tiny
  const px = w * 0.2, py = fy - H * 0.30 - H * 0.22;
  ctx.fillStyle = '#2c4742'; ctx.beginPath(); ctx.moveTo(px - 26, py + 4); ctx.quadraticCurveTo(px - 8, py + 2, px, py - 14); ctx.quadraticCurveTo(px + 8, py + 2, px + 26, py + 4); ctx.closePath(); ctx.fill();
  ctx.fillRect(px - 15, py + 4, 30, 12);
  // pines at the left and right, bamboo near the edges
  const pine = (x, y, k, flip) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(flip * k, k);
    ctx.fillStyle = '#1d2a26'; ctx.fillRect(-3, -40, 6, 40);
    for (let i = 0; i < 5; i++) { const yy = -30 - i * 18, ww = 54 - i * 8; ctx.beginPath(); ctx.moveTo(-ww, yy + 12); ctx.quadraticCurveTo(0, yy - 12, ww, yy + 12); ctx.quadraticCurveTo(0, yy + 2, -ww, yy + 12); ctx.fill(); }
    ctx.restore();
  };
  const pk = Math.max(0.7, Math.min(1.6, fy / 600));
  pine(w * 0.07, fy - 4, pk, 1); pine(w * 0.93, fy - 2, pk * 0.9, -1);
  // bamboo stalks (sway slowly)
  for (let i = 0; i < 6; i++) {
    const x = (i < 3 ? w * 0.02 + i * 18 : w * 0.98 - (i - 3) * 18), hh = fy * (0.55 + hash(i) * 0.3), sw = Math.sin(t * 0.6 + i) * 3;
    ctx.strokeStyle = i % 2 ? '#2f6b4b' : '#3d8159'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, fy); ctx.quadraticCurveTo(x + sw * 0.4, fy - hh * 0.5, x + sw, fy - hh); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,50,30,0.7)'; ctx.lineWidth = 1.5;
    for (let k = 1; k < 6; k++) { const f = k / 6, bx = x + sw * f * f * 1.0, by = fy - hh * f; ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.stroke(); }
  }
  // falling petals (pure function of time)
  for (let i = 0; i < 16; i++) {
    const sp = 18 + hash(i * 3.3) * 22, ph = hash(i * 5.1) * 900;
    const px2 = ((hash(i * 7.7) * w + t * (8 + hash(i) * 12) + Math.sin(t * 0.8 + i) * 18) % (w + 40) + w + 40) % (w + 40) - 20;
    const py2 = ((hash(i * 2.9) * fy + t * sp + ph) % (fy + 40)) - 20;
    ctx.save(); ctx.translate(px2, py2); ctx.rotate(t * 0.9 + i); ctx.fillStyle = i % 3 ? 'rgba(255,214,214,0.85)' : 'rgba(255,240,230,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.6, 0, 0, 7); ctx.fill(); ctx.restore();
  }
  // pavilion: eave beam across the top, pillars at both edges, hanging lanterns
  const eave = Math.max(26, Math.min(46, h * 0.034));
  ctx.fillStyle = '#17110d'; ctx.fillRect(0, top, w, eave);
  ctx.fillStyle = grad(ctx, 0, top + eave - 2, 0, top + eave + 14, [[0, '#a8261a'], [1, '#6e150c']]); ctx.fillRect(0, top + eave - 2, w, 14);
  ctx.fillStyle = '#d8a54a';
  for (let x = 14; x < w; x += 46) { ctx.beginPath(); ctx.arc(x, top + eave + 5, 3.2, 0, 7); ctx.fill(); }
  ctx.fillStyle = grad(ctx, 0, top + eave + 12, 0, top + eave + 22, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, top + eave + 12, w, 10);
  const pw = Math.max(16, Math.min(28, w * 0.034));
  for (const x0 of [0, w - pw]) {
    ctx.fillStyle = grad(ctx, x0, 0, x0 + pw, 0, [[0, '#6e150c'], [0.35, '#d0402a'], [0.55, '#e8604a'], [1, '#5a0f08']]); ctx.fillRect(x0, top, pw, fy + 2);
    ctx.fillStyle = '#d8a54a'; ctx.fillRect(x0 - 2, top + eave + 16, pw + 4, 7); ctx.fillRect(x0 - 2, fy - 22, pw + 4, 7);
  }
  for (const [lx, d] of [[w * 0.2, 0], [w * 0.5, 1], [w * 0.8, 2]]) {
    const sw = Math.sin(t * 0.7 + d * 2) * 3, ly = top + eave + 20 + 10 * d % 2, len = Math.min(54, fy * 0.08) + 6 * d;
    ctx.strokeStyle = '#17110d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, top + eave + 6); ctx.lineTo(lx + sw, ly + len); ctx.stroke();
    ctx.fillStyle = rgrad(ctx, lx + sw, ly + len + 18, 0, 46, [[0, 'rgba(255,196,110,0.5)'], [1, 'rgba(255,170,80,0)']]); ctx.fillRect(lx + sw - 50, ly + len - 30, 100, 100);
    ctx.fillStyle = grad(ctx, lx + sw - 15, 0, lx + sw + 15, 0, [[0, '#c9381f'], [0.5, '#ff9a5c'], [1, '#b02c16']]);
    ctx.beginPath(); ctx.ellipse(lx + sw, ly + len + 18, 15, 20, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d8a54a'; ctx.fillRect(lx + sw - 8, ly + len - 3, 16, 5); ctx.fillRect(lx + sw - 8, ly + len + 36, 16, 5);
  }
  // floor: dark polished wood boards in a gentle perspective, a brass rail at the edge
  ctx.fillStyle = grad(ctx, 0, fy, 0, h, [[0, '#4a2c19'], [0.3, '#2e1b10'], [1, '#150c07']]); ctx.fillRect(0, fy, w, h - fy);
  ctx.strokeStyle = 'rgba(0,0,0,0.38)'; ctx.lineWidth = 2;
  const cxm = cam.ox;
  for (let i = -14; i <= 14; i++) {
    const xx = cxm + i * (cam.s * 14 + 8);
    ctx.beginPath(); ctx.moveTo(xx, fy); ctx.lineTo(cxm + (xx - cxm) * 2.6, h); ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) { const yy = fy + (h - fy) * (k * k) / 14; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
  ctx.fillStyle = grad(ctx, 0, fy, 0, fy + 26, [[0, 'rgba(255,220,160,0.5)'], [1, 'rgba(255,220,160,0)']]); ctx.fillRect(0, fy, w, 26);
  ctx.fillStyle = '#d8a54a'; ctx.fillRect(0, fy - 1.5, w, 3);
}

// The 3D vase as a picture for the diagrams (rendered offline by web/vase.html; spans x -12.5..12.5 cm, y -1..46 cm). Null until loaded: drawVase draws it flat.
let vaseImg = null;
export const setVaseImg = (img) => { vaseImg = img; };
function vaseArt(ctx, cam, D, t) {
  if (!vaseImg || !vaseImg.width) { drawVase(ctx, cam, D, t); return; }
  const s = cam.s, X = sx(cam, D - 12.5), Y = sy(cam, 46);
  ctx.save(); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(sx(cam, D) + s * 2, sy(cam, 0) + 1, s * 13, Math.max(3, s * 1.6), 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.drawImage(vaseImg, X, Y, 25 * s, 47 * s);
}

// ---- world objects --------------------------------------------------------------------------------------------------------------------
export function drawMat(ctx, cam, D) {
  const x0 = sx(cam, D - 26), x1 = sx(cam, D + 26), y = sy(cam, 0), hgt = Math.max(5, cam.s * 1.4);
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, y + 2, (x1 - x0) / 2 + 4, Math.max(3, cam.s * 1.1), 0, 0, 7); ctx.fill();
  roundPath(ctx, x0, y - hgt, x1 - x0, hgt, 3); ctx.fillStyle = grad(ctx, 0, y - hgt, 0, y, [[0, '#f0e2bb'], [1, '#c4a96c']]); ctx.fill();
  ctx.fillStyle = '#b72d1c'; ctx.fillRect(x0 + 2, y - hgt, 6, hgt); ctx.fillRect(x1 - 8, y - hgt, 6, hgt);
  ctx.strokeStyle = 'rgba(90,60,20,0.5)'; ctx.lineWidth = 1;
  for (let x = x0 + 12; x < x1 - 10; x += 8) { ctx.beginPath(); ctx.moveTo(x, y - hgt + 1); ctx.lineTo(x, y - 1); ctx.stroke(); }
  ctx.restore();
}
export function drawThrowLine(ctx, cam) {
  const x = sx(cam, 0), y = sy(cam, 0);
  ctx.save();
  ctx.fillStyle = '#d8a54a'; ctx.fillRect(x - 3, y - 2, 6, 18);
  ctx.fillStyle = 'rgba(255,240,200,0.5)'; ctx.fillRect(x - 3, y - 2, 2, 18);
  ctx.restore();
}

// The thrower: a robed sleeve entering from the left and a hand holding the arrow, drawn at HAND.
export function drawSleeve(ctx, cam, swing = 0) {
  const P = (x, y) => [sx(cam, x), sy(cam, y)];
  const rot = swing * 0.5;
  ctx.save();
  const [hx, hy] = P(HAND.x, HAND.y);
  ctx.translate(hx, hy); ctx.rotate(-rot); ctx.translate(-hx, -hy);
  const pts = [[-140, 150], [-70, 140], [-30, 124], [-10, 110], [-4, 100], [-14, 91], [-34, 92], [-70, 100], [-140, 104]].map(([x, y]) => P(x, y));
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, pts[0][1], 0, pts[5][1], [[0, '#e8523a'], [0.5, '#b7301c'], [1, '#6e150c']]); ctx.fill();
  ctx.lineWidth = Math.max(2, cam.s * 0.8); ctx.strokeStyle = '#17110d'; ctx.stroke();
  // gold trim along the cuff and a fold line
  const [c0x, c0y] = P(-10, 110), [c1x, c1y] = P(-14, 91);
  ctx.strokeStyle = '#d8a54a'; ctx.lineWidth = Math.max(2.5, cam.s * 1.4); ctx.beginPath(); ctx.moveTo(c0x, c0y); ctx.lineTo(P(-4, 98)[0], P(-4, 98)[1]); ctx.lineTo(c1x, c1y); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2; ctx.beginPath(); const f0 = P(-110, 140), f1 = P(-30, 110); ctx.moveTo(f0[0], f0[1]); ctx.quadraticCurveTo(P(-60, 116)[0], P(-60, 116)[1], f1[0], f1[1]); ctx.stroke();
  // hand
  ctx.fillStyle = '#e6b995'; ctx.strokeStyle = '#7a4a2a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(hx - cam.s * 1.2, hy + cam.s * 0.2, cam.s * 4.2, cam.s * 3, 0.3, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// One arrow: bamboo shaft, iron tip, two fletching feathers in the side's colour. (x, y) = centre in cm, th = tip direction.
export function drawArrow(ctx, cam, x, y, th, side, o = {}) {
  const s = cam.s, hl = ARROW.hl, c = Math.cos(th), si = Math.sin(th);
  const X = sx(cam, x), Y = sy(cam, y);
  const dx = c, dy = -si;   // screen direction of the tip
  const tx = X + dx * hl * s, ty = Y + dy * hl * s, ux = X - dx * hl * s, uy = Y - dy * hl * s;
  const tm = TEAM[side] || TEAM[0], wdt = Math.max(2.4, s * 1.0);
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.glow) { ctx.strokeStyle = o.glow; ctx.lineWidth = wdt + 8; ctx.lineCap = 'round'; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.globalAlpha = o.alpha ?? 1; }
  // shaft
  ctx.lineCap = 'butt';
  ctx.strokeStyle = '#4a2f14'; ctx.lineWidth = wdt + 1.6; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = '#e1b66a'; ctx.lineWidth = wdt; ctx.beginPath(); ctx.moveTo(ux, uy); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,245,210,0.7)'; ctx.lineWidth = Math.max(1, wdt * 0.28);
  const nx = -dy, ny = dx;
  ctx.beginPath(); ctx.moveTo(ux + nx * wdt * 0.2, uy + ny * wdt * 0.2); ctx.lineTo(tx + nx * wdt * 0.2, ty + ny * wdt * 0.2); ctx.stroke();
  // team band + feathers near the tail
  const f0 = 0.0, f1 = 5.5 * s, bandAt = 8 * s;
  ctx.strokeStyle = tm.main; ctx.lineWidth = wdt + 1; ctx.beginPath(); ctx.moveTo(ux + dx * bandAt, uy + dy * bandAt); ctx.lineTo(ux + dx * (bandAt + 2.2 * s), uy + dy * (bandAt + 2.2 * s)); ctx.stroke();
  for (const sg of [-1, 1]) {
    ctx.fillStyle = sg < 0 ? tm.feather : tm.dark;
    ctx.beginPath();
    ctx.moveTo(ux + dx * f0, uy + dy * f0);
    ctx.lineTo(ux + dx * f1 + nx * sg * s * 2.1, uy + dy * f1 + ny * sg * s * 2.1);
    ctx.lineTo(ux + dx * (f1 + 1.5 * s), uy + dy * (f1 + 1.5 * s));
    ctx.lineTo(ux + nx * sg * s * 0.4, uy + ny * sg * s * 0.4);
    ctx.closePath(); ctx.fill();
  }
  // iron tip
  ctx.fillStyle = '#2e2a28'; ctx.beginPath();
  ctx.moveTo(tx + dx * s * 2.8, ty + dy * s * 2.8);
  ctx.lineTo(tx - dx * s * 2.2 + nx * wdt * 0.75, ty - dy * s * 2.2 + ny * wdt * 0.75);
  ctx.lineTo(tx - dx * s * 2.2 - nx * wdt * 0.75, ty - dy * s * 2.2 - ny * wdt * 0.75);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// The bronze vase with lit material: horizontal light bands, patina in the hollows, key-pattern bands, flared lip with a dark mouth, ear tubes.
export function drawVase(ctx, cam, D, t, o = {}) {
  const s = cam.s, X = (x) => sx(cam, x), Y = (y) => sy(cam, y), cx = X(D);
  const P = VASE_PROFILE;
  ctx.save();
  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(cx + s * 2, Y(0) + 1, s * 13, Math.max(3, s * 1.6), 0, 0, 7); ctx.fill();
  const body = () => {
    ctx.beginPath(); ctx.moveTo(cx - P[0][1] * s, Y(0));
    for (let i = 0; i < P.length; i++) ctx.lineTo(cx - P[i][1] * s, Y(P[i][0]));
    for (let i = P.length - 1; i >= 0; i--) ctx.lineTo(cx + P[i][1] * s, Y(P[i][0]));
    ctx.closePath();
  };
  // ear tubes: a bronze channel standing off each side of the neck, open at the top, with a gold lip ring and a bracket to the neck
  for (const sg of [-1, 1]) {
    const yl = EAR.yLow, yt = EAR.yTop + 0.9, xi = vaseOuterR(EAR.yLow) - 0.2, xo = EAR.outer + 0.9;
    const wallA = cx + sg * (EAR.outer - 0.45) * s, wallB = cx + sg * xo * s;
    ctx.fillStyle = grad(ctx, Math.min(wallA, wallB), 0, Math.max(wallA, wallB), 0, sg < 0 ? [[0, '#5c3c14'], [0.5, '#d9ad5c'], [1, '#8a5f27']] : [[0, '#8a5f27'], [0.5, '#d9ad5c'], [1, '#5c3c14']]);
    ctx.fillRect(Math.min(wallA, wallB), Y(yt), Math.abs(wallB - wallA), (yt - yl + 0.6) * s);
    // floor of the slot and the bracket to the neck
    const bx0 = Math.min(cx + sg * xi * s, wallB), bx1 = Math.max(cx + sg * xi * s, wallB);
    ctx.fillStyle = '#6d4a1b'; ctx.fillRect(bx0, Y(yl + 0.2), bx1 - bx0, s * 1.5);
    ctx.fillStyle = '#f0d58a'; ctx.fillRect(Math.min(wallA, wallB) - s * 0.3, Y(yt), Math.abs(wallB - wallA) + s * 0.6, Math.max(2.5, s * 0.7));
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(Math.min(wallA, wallB), Y(yt) + 2, Math.max(1, s * 0.25), (yt - yl) * s);
    // a small scroll finial
    ctx.fillStyle = '#d8a54a'; ctx.beginPath(); ctx.arc(wallB + sg * s * 0.5, Y(yt + 0.2), Math.max(2, s * 0.8), 0, 7); ctx.fill();
  }
  // body fill: bronze lit from the upper left
  body();
  ctx.fillStyle = grad(ctx, cx - 12 * s, 0, cx + 12 * s, 0, [[0, '#2d1d0a'], [0.1, '#6d4a1b'], [0.28, '#c79a52'], [0.4, '#f6dc9b'], [0.5, '#d9ad5c'], [0.72, '#8a5f27'], [0.92, '#47300f'], [1, '#2a1b08']]);
  ctx.fill();
  ctx.save(); body(); ctx.clip();
  // patina: green-blue bloom in the hollows (shoulder, neck base, foot)
  for (const [py, px, pr, a] of [[25, 3.5, 6, 0.45], [4, -3, 6, 0.4], [33, -2, 4, 0.3], [18, 8, 5, 0.25]]) {
    ctx.fillStyle = rgrad(ctx, cx + px * s, Y(py), 0, pr * s, [[0, `rgba(70,160,130,${a})`], [1, 'rgba(70,160,130,0)']]); ctx.fillRect(cx - 14 * s, Y(44), 28 * s, 46 * s);
  }
  // decoration bands: front-facing arcs follow the roundness
  const band = (y, w1) => {
    const r = vaseOuterR(y) * s;
    ctx.strokeStyle = 'rgba(30,18,6,0.65)'; ctx.lineWidth = Math.max(1.5, s * w1); ctx.beginPath(); ctx.ellipse(cx, Y(y), r, Math.max(2, s * 1.7), 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,238,180,0.55)'; ctx.lineWidth = Math.max(1, s * w1 * 0.5); ctx.beginPath(); ctx.ellipse(cx, Y(y) + s * w1 * 0.9, r, Math.max(2, s * 1.7), 0, 0, Math.PI); ctx.stroke();
  };
  [3.8, 9, 21.5, 26, 30.3, 37.5, 40.5].forEach((y, i) => band(y, i % 2 ? 0.7 : 1.0));
  // key-pattern squares on the belly band and a mask motif
  ctx.fillStyle = 'rgba(40,24,6,0.55)';
  for (let k = -5; k <= 5; k++) { const r = vaseOuterR(15) * s, a = k * 0.2, xx = cx + Math.sin(a) * r, w2 = Math.cos(a) * s * 1.7; ctx.fillRect(xx - w2 / 2, Y(16.2) + s * 0.2, w2, s * 1.6); }
  for (const sg of [-1, 1]) {
    ctx.strokeStyle = 'rgba(40,24,6,0.7)'; ctx.lineWidth = Math.max(1.2, s * 0.55);
    ctx.beginPath(); ctx.arc(cx + sg * 4.6 * s, Y(12), 2.1 * s, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,232,160,0.5)'; ctx.beginPath(); ctx.arc(cx + sg * 4.6 * s, Y(12), 0.8 * s, 0, 7); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,24,6,0.6)'; ctx.lineWidth = Math.max(1.2, s * 0.6); ctx.beginPath(); ctx.moveTo(cx, Y(14)); ctx.lineTo(cx, Y(10)); ctx.stroke();
  // moving glint
  const gx = cx + Math.sin(t * 0.35) * 2 * s;
  ctx.fillStyle = 'rgba(255,250,220,0.35)'; ctx.fillRect(gx - 5.6 * s, Y(36), 0.9 * s, 34 * s);
  ctx.restore();
  // rim: flared lip seen slightly from above, dark mouth
  const rl = vaseOuterR(RIM_Y) * s, ri = vaseInnerR(RIM_Y) * s, ry = Math.max(2.5, s * 1.3);
  ctx.fillStyle = grad(ctx, cx - rl, 0, cx + rl, 0, [[0, '#9a6f2b'], [0.4, '#fbe7a8'], [1, '#6a4716']]);
  ctx.beginPath(); ctx.ellipse(cx, Y(RIM_Y), rl, ry, 0, 0, 7); ctx.fill();
  ctx.fillStyle = grad(ctx, 0, Y(RIM_Y) - ry, 0, Y(RIM_Y) + ry, [[0, '#0b0603'], [1, '#2a1a0a']]);
  ctx.beginPath(); ctx.ellipse(cx, Y(RIM_Y), ri, ry * 0.72, 0, 0, 7); ctx.fill();
  ctx.restore();
}

// ---- effects -----------------------------------------------------------------------------------------------------------------------
export function emit(fx, kind, x, y, n, rngf, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rngf() * Math.PI * 2, sp = (o.speed ?? 240) * (0.35 + rngf() * 0.9);
    fx.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up ?? 60), life: 0, max: (o.life ?? 0.9) * (0.6 + rngf() * 0.7), size: (o.size ?? 7) * (0.6 + rngf() * 0.8), rot: rngf() * 6, vr: (rngf() - 0.5) * 10, col: o.cols ? o.cols[Math.floor(rngf() * o.cols.length)] : '#fff' });
  }
  if (fx.length > 360) fx.splice(0, fx.length - 360);
}
export function stepFx(fx, dt) {
  for (const p of fx) {
    p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    const drag = p.kind === 'petal' ? 2.2 : 1.6;
    p.vx *= Math.max(0, 1 - drag * dt);
    p.vy = p.vy * Math.max(0, 1 - drag * dt) + (p.kind === 'petal' ? 90 : p.kind === 'mist' ? -12 : p.kind === 'ink' ? 520 : 600) * dt;
  }
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life >= fx[i].max) fx.splice(i, 1);
}
export function drawFx(ctx, fx) {
  for (const p of fx) {
    const k = 1 - p.life / p.max;
    ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.5)); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.kind === 'petal') { ctx.fillStyle = p.col; ctx.scale(1, Math.abs(Math.cos(p.rot * 1.3)) * 0.8 + 0.2); ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.9, p.size * 0.5, 0, 0, 7); ctx.fill(); }
    else if (p.kind === 'mist') { ctx.fillStyle = 'rgba(255,248,230,0.35)'; ctx.beginPath(); ctx.arc(0, 0, p.size * (1.2 + (1 - k) * 1.2), 0, 7); ctx.fill(); }
    else if (p.kind === 'ink') { ctx.fillStyle = 'rgba(20,14,10,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.4 * (0.7 + k * 0.5), 0, 0, 7); ctx.fill(); }
    else if (p.kind === 'ring') { ctx.strokeStyle = p.col; ctx.lineWidth = 3 * k + 1; ctx.beginPath(); ctx.arc(0, 0, p.size * (1 + (1 - k) * 5), 0, 7); ctx.stroke(); }
    else { ctx.fillStyle = p.col; ctx.fillRect(-p.size * 0.15, -p.size, p.size * 0.3, p.size * 2); }
    ctx.restore();
  }
}

// ---- title art ---------------------------------------------------------------------------------------------------------------------
export function wordmark(ctx, text, cx, cy, size, maxW = 4000) {
  ctx.save();
  ctx.font = `900 ${size}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  // soft warm glow behind the lettering
  ctx.shadowColor = 'rgba(255,200,110,0.55)'; ctx.shadowBlur = size * 0.5; ctx.fillStyle = 'rgba(0,0,0,0.01)'; ctx.fillText(text, cx, cy, maxW);
  ctx.shadowColor = 'transparent';
  // extrusion: a stack of dark bronze copies stepping down and right gives the letters real thickness
  const depth = Math.max(4, Math.round(size * 0.11));
  for (let k = depth; k >= 1; k--) {
    ctx.fillStyle = k > depth * 0.55 ? '#2a1808' : '#6a431a';
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = size * 0.1;
    ctx.strokeText(text, cx + k * 0.55, cy + k, maxW); ctx.fillText(text, cx + k * 0.55, cy + k, maxW);
  }
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = depth + 4;
  ctx.lineWidth = size * 0.12; ctx.strokeStyle = '#14100d'; ctx.strokeText(text, cx, cy, maxW);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = grad(ctx, 0, cy - size * 0.5, 0, cy + size * 0.5, [[0, '#fff6cc'], [0.38, '#f0c466'], [0.55, '#d79a38'], [0.8, '#f1cc72'], [1, '#a9742a']]);
  ctx.fillText(text, cx, cy, maxW);
  // engraved highlight along the top of the letters
  ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,0.0)';
  ctx.restore();
}
export function drawHero(ctx, w, h, t) {
  // a small framed scene: vase on its mat with one arrow arcing in, ink-wash behind
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 26); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#17110d'], [0.5, '#2c211a'], [1, '#17110d']]); ctx.fillRect(0, 0, w, h);
  const cam = { ox: w * 0.5, cx: 160, s: Math.min(w / 270, h / 175), floorY: h * 0.9 };
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#7aa89c'], [0.7, '#efe3c3'], [1, '#f6e8c6']]); ctx.globalAlpha = 0.9; ctx.fillRect(0, 0, w, cam.floorY); ctx.globalAlpha = 1;
  ctx.fillStyle = '#6f948b'; ctx.beginPath(); ctx.moveTo(0, cam.floorY);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, cam.floorY - h * 0.28 - Math.sin(x * 0.02 + 1) * h * 0.1 - Math.sin(x * 0.05) * h * 0.04);
  ctx.lineTo(w, cam.floorY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#42655e'; ctx.beginPath(); ctx.moveTo(0, cam.floorY);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, cam.floorY - h * 0.12 - Math.sin(x * 0.03 + 3) * h * 0.06);
  ctx.lineTo(w, cam.floorY); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2e1b10'; ctx.fillRect(0, cam.floorY, w, h - cam.floorY);
  ctx.fillStyle = '#d8a54a'; ctx.fillRect(0, cam.floorY - 1, w, 3);
  drawMat(ctx, cam, 160);
  const k = (t * 0.42) % 1.6;
  if (k < 1) {
    const x0 = 20, y0 = 40, x1 = 150, y1 = 60;
    const ax = lerp(x0, x1, k), ay = lerp(y0, y1, k) + 70 * 4 * k * (1 - k) * 0.7 - 20 * k;
    const dyk = (y1 - y0) - 20 + 280 * 0.7 * (1 - 2 * k);
    drawArrow(ctx, cam, ax, ay, Math.atan2(dyk, x1 - x0), 0);
  }
  drawArrow(ctx, cam, 160 + 3.4, 51, 1.33, 1);
  drawArrow(ctx, cam, 160 - 7.6, 50, 1.42, 0);
  drawVase(ctx, cam, 160, t);
  ctx.restore();
}

// ---- diagrams used by How to Play / Rules ------------------------------------------------------------------------------------------
function labelPill(ctx, text, x, y, size, col = '#ffe3a0', maxW = 4000) {
  ctx.save(); ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(14,10,8,0.9)'; ctx.strokeText(text, x, y, maxW);
  ctx.fillStyle = col; ctx.fillText(text, x, y, maxW); ctx.restore();
}
export function drawDiagram(key, ctx, w, h) {
  ctx.save();
  roundPath(ctx, 0, 0, w, h, 18); ctx.clip();
  ctx.fillStyle = grad(ctx, 0, 0, 0, h, [[0, '#cfe0d4'], [0.7, '#f1e6c6'], [1, '#f6e8c6']]); ctx.fillRect(0, 0, w, h);
  const fy = h * 0.86;
  ctx.fillStyle = '#35200f'; ctx.fillRect(0, fy, w, h - fy); ctx.fillStyle = '#d8a54a'; ctx.fillRect(0, fy - 1, w, 3);
  const fs = Math.max(13, Math.min(22, w * 0.034));
  if (key === 'vase' || key === 'anatomy') {
    const s = Math.min((h * 0.8) / 46, w / 70), cam = { ox: w * 0.42, cx: 0, s, floorY: fy };
    vaseArt(ctx, cam, 0, 0);
    const cx = cam.ox;
    const note = (txt, ux, uy, tx, ty) => {
      ctx.strokeStyle = 'rgba(20,14,10,0.75)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx(cam, ux), sy(cam, uy)); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.save(); ctx.font = `700 ${fs}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#2a1a0a'; ctx.fillText(txt, tx + 6, ty); ctx.restore();
    };
    note('Mouth', 3, RIM_Y, cx + 9 * s + 14, sy(cam, 46));
    note('Ear', EAR.outer, 33, cx + 12 * s + 14, sy(cam, 38));
    note('Neck', 4.4, 33, cx + 15 * s + 14, sy(cam, 31));
    note('Belly', 10, 14, cx + 13 * s + 14, sy(cam, 16));
  } else if (key === 'throw' || key === 'aim') {
    const D = 240, s = Math.min(w / (D + 80), (fy - 8) / 140), cam = { ox: w / 2, cx: D / 2, s, floorY: fy };
    drawMat(ctx, cam, D); drawSleeve(ctx, cam, 0); vaseArt(ctx, cam, D, 0);
    ctx.setLineDash([3, 9]); ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = '#b72d1c'; ctx.beginPath();
    for (let t = 0; t < 1.7; t += 0.04) { const x = 18 + 470 * Math.cos(1.1) * t * 0.8, y = 120 + 470 * Math.sin(1.1) * t * 0.8 - 490 * t * t * 0.8 * 0.8; if (x > D + 8) break; if (t === 0) ctx.moveTo(sx(cam, x), sy(cam, y)); else ctx.lineTo(sx(cam, x), sy(cam, y)); }
    ctx.stroke(); ctx.setLineDash([]);
    drawArrow(ctx, cam, 18, 120, 1.1, 0);
    labelPill(ctx, 'pull back, lift to throw', w * 0.5, h * 0.12, fs, '#fff1c4');
  } else if (key === 'scoring' || key === 'bounce' || key === 'ear') {
    const s = Math.min(w / 120, (fy - 14) / 66), cams = [-36, 0, 36].map((o) => ({ ox: w / 2 + o * s * 1.15, cx: 0, s, floorY: fy }));
    const tipArrow = (cam, tx, ty, th, side) => drawArrow(ctx, cam, tx - Math.cos(th) * ARROW.hl, ty - Math.sin(th) * ARROW.hl, th, side);
    tipArrow(cams[0], 0.4, 31, -1.5, 0); vaseArt(ctx, cams[0], 0, 0);
    tipArrow(cams[1], -1.2, 27, -1.42, 1); tipArrow(cams[1], -14, 0.5, 0.18, 1); vaseArt(ctx, cams[1], 0, 0);
    tipArrow(cams[2], 6.0, 29, -1.52, 0); vaseArt(ctx, cams[2], 0, 0);
    const lab = ['Mouth', 'Bounce-in', 'Ear'];
    cams.forEach((c, i) => labelPill(ctx, lab[i], c.ox, h * 0.1, fs, '#fff1c4', s * 1.15 * 34));
  } else if (key === 'rounds' || key === 'court') {
    const D = 240, s = Math.min(w / (D + 90), (fy - 8) / 150), cam = { ox: w / 2, cx: (D + 20) / 2, s, floorY: fy };
    drawMat(ctx, cam, D); drawThrowLine(ctx, cam); vaseArt(ctx, cam, D, 0); drawSleeve(ctx, cam, 0);
    ctx.strokeStyle = '#7a1c10'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
    const x0 = sx(cam, 0), x1 = sx(cam, D), yy = sy(cam, -0) + 22;
    ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.moveTo(x0, yy - 6); ctx.lineTo(x0, yy + 6); ctx.moveTo(x1, yy - 6); ctx.lineTo(x1, yy + 6); ctx.stroke(); ctx.setLineDash([]);
    labelPill(ctx, '1.8 to 3.0 m', (x0 + x1) / 2, yy - 12, fs, '#fff1c4');
    for (let i = 0; i < 4; i++) { drawArrow(ctx, cam, D - 60 - i * 8, 4 + i * 0.1, 0.02 + i * 0.01, i % 2); }
  }
  ctx.restore();
}
export { grad, rgrad, lerp, smooth, FLOOR_IN, WALL, NUM };
