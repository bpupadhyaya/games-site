// All the drawing of Elastic Jump: the playground, three children, the elastic, the pose icons and the particles. Pure canvas.
// The scene is a painted 3/4 view: the ground runs away from the camera, so a foot's DEPTH (in strand units, see moves.js) is a
// vertical offset on the screen. The near strand is drawn over the jumper, the far strand behind.
import { POSES } from './moves.js';

export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const DISPLAY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const PAL = {
  text: '#fff8ec', dim: 'rgba(255,248,236,0.7)', gold: '#ffd23f', pink: '#ff4f8b', pinkHi: '#ff9cc0', navy: '#14204a', navyDeep: '#0c1433',
  teal: '#25c7c2', sky: '#74d0ff', good: '#26c281', bad: '#ff5a5f',
};
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

// ---- geometry of the scene for a given stage rectangle -------------------------------------------------------------------
export function stageGeo(r) {
  let Bh = Math.min(r.h * 0.58, r.w * 0.56);
  const D = () => Bh * 0.062;
  let gy = r.y + r.h * 0.78;
  gy = Math.max(gy, r.y + Bh * 1.28 + 18);                 // room for the head and the biggest jump
  gy = Math.min(gy, r.y + r.h - D() * 3.1 - 8);
  if (gy - Bh * 1.28 < r.y + 10) Bh = Math.max(40, (gy - r.y - 10) / 1.28);
  return { r, Bh, D: Bh * 0.062, gy, jx: r.x + r.w / 2, ax: r.x + r.w * 0.16, bx: r.x + r.w * 0.84, horizon: gy - Bh * 0.62 };
}

// ---- background ------------------------------------------------------------------------------------------------------------------
function cloud(ctx, x, y, s) {
  ctx.beginPath(); ctx.ellipse(x, y, 70 * s, 26 * s, 0, 0, TAU); ctx.ellipse(x - 42 * s, y + 8 * s, 40 * s, 20 * s, 0, 0, TAU); ctx.ellipse(x + 46 * s, y + 6 * s, 46 * s, 22 * s, 0, 0, TAU); ctx.ellipse(x + 8 * s, y - 16 * s, 40 * s, 24 * s, 0, 0, TAU); ctx.fill();
}

export function drawScene(ctx, W, H, g, t, o = {}) {
  const { horizon, Bh, gy } = g, wallH = Bh * 0.95;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5cc4ff'); sky.addColorStop(1, '#d9f5ff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon + 2);
  // sun and clouds
  const sx = W * 0.82, sy = Math.max(70, horizon - wallH - Bh * 0.35);
  const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, Bh * 0.8);
  sg.addColorStop(0, 'rgba(255,248,200,0.95)'); sg.addColorStop(0.25, 'rgba(255,236,150,0.55)'); sg.addColorStop(1, 'rgba(255,236,150,0)');
  ctx.fillStyle = sg; ctx.fillRect(sx - Bh, sy - Bh, Bh * 2, Bh * 2);
  ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(sx, sy, Bh * 0.13, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const drift = (t * 6) % (W + 300);
  cloud(ctx, ((W * 0.2 + drift) % (W + 300)) - 150, Math.max(40, horizon - wallH - Bh * 0.55), Bh / 280);
  cloud(ctx, ((W * 0.65 + drift * 0.6) % (W + 300)) - 150, Math.max(30, horizon - wallH - Bh * 0.8), Bh / 380);
  // distant roofs and trees above the wall
  const roofY = horizon - wallH;
  ctx.fillStyle = '#9ad0e8';
  for (let i = 0; i < 6; i++) { const bx = (i * 0.2 - 0.05) * W, bw = W * 0.17, bh = Bh * (0.28 + ((i * 37) % 5) * 0.05); ctx.fillRect(bx, roofY - bh, bw, bh + 2); }
  ctx.fillStyle = '#4fbf86';
  for (let i = 0; i < 9; i++) { const tx = (i / 8) * W + ((i * 53) % 40), tr = Bh * (0.22 + ((i * 29) % 5) * 0.035); ctx.beginPath(); ctx.arc(tx, roofY + 6, tr, Math.PI, TAU); ctx.fill(); }
  ctx.fillStyle = '#39a876';
  for (let i = 0; i < 7; i++) { const tx = (i / 6) * W + 40 - ((i * 31) % 70), tr = Bh * (0.15 + ((i * 17) % 4) * 0.03); ctx.beginPath(); ctx.arc(tx, roofY + 8, tr, Math.PI, TAU); ctx.fill(); }
  // the school wall: warm brick with a painted mural
  const wy = roofY;
  const wg = ctx.createLinearGradient(0, wy, 0, horizon);
  wg.addColorStop(0, '#f6b183'); wg.addColorStop(1, '#e98c63');
  ctx.fillStyle = wg; ctx.fillRect(0, wy, W, wallH + 1);
  ctx.strokeStyle = 'rgba(120,50,30,0.22)'; ctx.lineWidth = 1.5;
  const bh = Math.max(14, Bh * 0.052);
  ctx.beginPath();
  for (let y = wy + bh, r = 0; y < horizon; y += bh, r++) {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    const bw = bh * 2.6;
    for (let x = (r % 2) * bw * 0.5; x < W; x += bw) { ctx.moveTo(x, y); ctx.lineTo(x, y - bh); }
  }
  ctx.stroke();
  // mural: a rainbow over the left and a sun on the right, painted flat
  const mr = wallH * 0.62, mx = W * 0.2, my = horizon - 4;
  ['#ff5a5f', '#ffb938', '#ffe14f', '#4fd38a', '#4aa8ff'].forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = mr * 0.075; ctx.beginPath(); ctx.arc(mx, my, mr * (1 - i * 0.1), Math.PI, TAU); ctx.stroke(); });
  ctx.fillStyle = '#ffe14f'; ctx.beginPath(); ctx.arc(W * 0.62, wy + wallH * 0.42, wallH * 0.17, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffe14f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU, r0 = wallH * 0.21, r1 = wallH * 0.29; ctx.beginPath(); ctx.moveTo(W * 0.62 + Math.cos(a) * r0, wy + wallH * 0.42 + Math.sin(a) * r0); ctx.lineTo(W * 0.62 + Math.cos(a) * r1, wy + wallH * 0.42 + Math.sin(a) * r1); ctx.stroke(); }
  // bunting along the top of the wall
  const flags = ['#ff4f8b', '#ffd23f', '#26c281', '#2f8cff', '#b266ff', '#ff9a2e'], fw = Math.max(26, Bh * 0.13);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, wy + 14); ctx.lineTo(W, wy + 14); ctx.stroke();
  for (let x = fw * 0.4, i = 0; x < W; x += fw * 1.15, i++) { ctx.fillStyle = flags[i % flags.length]; ctx.beginPath(); ctx.moveTo(x, wy + 14); ctx.lineTo(x + fw, wy + 14); ctx.lineTo(x + fw / 2, wy + 14 + fw * 0.95); ctx.closePath(); ctx.fill(); }
  // coping and a thin fence shadow
  ctx.fillStyle = '#fff3e0'; ctx.fillRect(0, wy - 6, W, 10);
  ctx.fillStyle = 'rgba(80,30,10,0.25)'; ctx.fillRect(0, horizon - 8, W, 12);
  // the ground: cool grey tarmac with painted lines
  const gr = ctx.createLinearGradient(0, horizon, 0, H);
  gr.addColorStop(0, '#aab2d6'); gr.addColorStop(0.5, '#8d96bf'); gr.addColorStop(1, '#6e789f');
  ctx.fillStyle = gr; ctx.fillRect(0, horizon, W, H - horizon);
  ctx.save(); ctx.beginPath(); ctx.rect(0, horizon, W, H - horizon); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(3, Bh * 0.016);
  ctx.beginPath(); ctx.ellipse(g.jx, gy + g.D * 1.5, Bh * 1.25, Bh * 0.34, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,225,79,0.7)';
  ctx.beginPath(); ctx.moveTo(0, horizon + (gy - horizon) * 0.55); ctx.lineTo(W, horizon + (gy - horizon) * 0.55); ctx.stroke();
  // hopscotch squares on the far left, drawn in perspective
  const hs = Bh * 0.2;
  ['#ff7aa8', '#6ee0d8', '#ffd23f'].forEach((c, i) => {
    const yy = gy + g.D * 2.8 + i * hs * 0.34, w2 = hs * (1.1 + i * 0.12);
    ctx.fillStyle = rgba(c, 0.55); ctx.beginPath(); ctx.moveTo(W * 0.5 - w2 * 4.3, yy); ctx.lineTo(W * 0.5 - w2 * 3.3, yy); ctx.lineTo(W * 0.5 - w2 * 3.4, yy + hs * 0.3); ctx.lineTo(W * 0.5 - w2 * 4.5, yy + hs * 0.3); ctx.closePath(); ctx.fill();
  });
  ctx.restore();
  // a soft vignette keeps the eye on the middle
  const vg = ctx.createRadialGradient(W / 2, gy - Bh * 0.4, Bh * 0.8, W / 2, gy - Bh * 0.4, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(20,32,74,0)'); vg.addColorStop(1, `rgba(20,32,74,${o.vignette ?? 0.28})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}

// ---- a child ----------------------------------------------------------------------------------------------------------------------
export const KIDS = {
  holderA: { skin: '#f2c19a', hair: '#3b2418', kind: 'bob', shirt: '#ffcf3f', shirt2: '#f0a81b', shorts: '#2f6fe0', shoes: '#ffffff' },
  holderB: { skin: '#a8714b', hair: '#1c1412', kind: 'buns', shirt: '#52d6a4', shirt2: '#2fa57c', shorts: '#8a4bd8', shoes: '#ff7aa8' },
  jumper: { skin: '#e7ad82', hair: '#241812', kind: 'pony', shirt: '#ff4f8b', shirt2: '#d92d6d', shorts: '#20315f', shoes: '#fff8ec' },
};

function limb(ctx, ax, ay, bx, by, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}

// o: { x, k, feet:[{x,y,s}x2], lift, lean, armL, armR (angle from hanging down, + = outward), hairSwing, mouth, look, look:-1..1, squash }
export function drawKid(ctx, style, o) {
  const k = o.k, f = o.feet, L = 0.43 * k;
  const avgY = (f[0].y + f[1].y) / 2, avgX = (f[0].x + f[1].x) / 2;
  const hx = (o.x ?? avgX) + (o.sway ?? 0);
  let hy = avgY - L * 0.975 * (1 - (o.crouch ?? 0)) - (o.lift ?? 0);
  for (let it = 0; it < 6; it++) {                                           // lower the hips until both legs can reach their feet
    const d = Math.max(Math.hypot(f[0].x - (hx - 0.05 * k), f[0].y - 0.03 * k - hy), Math.hypot(f[1].x - (hx + 0.05 * k), f[1].y - 0.03 * k - hy));
    if (d <= L * 0.985) break;
    hy += (d - L * 0.985) * 1.1;
  }
  const lean = o.lean ?? 0, shY = hy - 0.27 * k * (1 - (o.crouch ?? 0) * 0.2), shX = hx + lean * 0.27 * k;
  const joints = [-1, 1].map((s, i) => {
    const jx = hx + s * 0.05 * k, jy = hy, fx = f[i].x, fy = f[i].y - 0.03 * k;
    let dx = fx - jx, dy = fy - jy, d = Math.hypot(dx, dy);
    const reach = Math.min(d, L * 0.985), ux = dx / (d || 1), uy = dy / (d || 1);
    const ex = jx + ux * reach, ey = jy + uy * reach, half = L / 2;
    const h = Math.sqrt(Math.max(0, half * half - (reach / 2) * (reach / 2)));
    const kx = (jx + ex) / 2 + s * h * 0.95 + (-uy) * h * 0.1, ky = (jy + ey) / 2 + ux * h * 0.1 * s;
    return { jx, jy, kx, ky, ex, ey, s };
  });
  const sc = (i) => f[i].s ?? 1;
  // shadow on the ground under each foot
  ctx.fillStyle = 'rgba(20,28,70,0.28)';
  for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.ellipse(f[i].x, (o.shadowY ?? f[i].y) + 3, 0.075 * k * sc(i) * (1 + (o.lift ?? 0) * 0.002), 0.026 * k, 0, 0, TAU); ctx.fill(); }
  // back hair (behind the head and body)
  const headR = 0.088 * k, hcx = shX + lean * 0.03 * k, hcy = shY - 0.04 * k - headR;
  if (style.kind === 'pony') {
    const sw = o.hairSwing ?? 0, bx = hcx + 0.09 * k * Math.sign(sw || 1) * 0.5, by = hcy - headR * 0.2;
    const tx = hcx - sw * 0.28 * k - (o.dir ?? 1) * 0.0, ty = hcy + headR * 0.6 + Math.abs(sw) * 0.06 * k;
    ctx.strokeStyle = style.hair; ctx.lineCap = 'round'; ctx.lineWidth = 0.05 * k;
    ctx.beginPath(); ctx.moveTo(hcx, hcy - headR * 0.55); ctx.quadraticCurveTo(bx - sw * 0.2 * k, by - 0.1 * k, tx, ty); ctx.stroke();
    ctx.strokeStyle = o.ribbon ?? '#ffd23f'; ctx.lineWidth = 0.03 * k; ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.62, headR * 0.34, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  // legs
  for (let i = 0; i < 2; i++) {
    const j = joints[i];
    ctx.strokeStyle = style.skin; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 0.064 * k * sc(i);
    ctx.beginPath(); ctx.moveTo(j.jx, j.jy); ctx.lineTo(j.kx, j.ky); ctx.lineTo(f[i].x, f[i].y - 0.03 * k); ctx.stroke();
    // shorts leg
    const mx = lerp(j.jx, j.kx, 0.55), my = lerp(j.jy, j.ky, 0.55);
    ctx.strokeStyle = style.shorts; ctx.lineWidth = 0.09 * k; ctx.beginPath(); ctx.moveTo(j.jx, j.jy); ctx.lineTo(mx, my); ctx.stroke();
    // shoe
    const s = sc(i);
    ctx.fillStyle = style.shoes; ctx.beginPath(); ctx.ellipse(f[i].x + (i ? 0.012 : -0.012) * k, f[i].y - 0.005 * k, 0.062 * k * s, 0.034 * k * s, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(20,28,70,0.35)'; ctx.beginPath(); ctx.ellipse(f[i].x + (i ? 0.012 : -0.012) * k, f[i].y + 0.012 * k, 0.062 * k * s, 0.016 * k * s, 0, 0, Math.PI); ctx.fill();
  }
  // hips (shorts) and torso (shirt)
  ctx.fillStyle = style.shorts; ctx.beginPath(); ctx.roundRect(hx - 0.105 * k, hy - 0.05 * k, 0.21 * k, 0.12 * k, 0.04 * k); ctx.fill();
  const tg = ctx.createLinearGradient(hx - 0.12 * k, 0, hx + 0.12 * k, 0);
  tg.addColorStop(0, style.shirt); tg.addColorStop(1, style.shirt2);
  ctx.fillStyle = tg; ctx.beginPath();
  ctx.moveTo(hx - 0.095 * k, hy - 0.02 * k); ctx.lineTo(hx + 0.095 * k, hy - 0.02 * k);
  ctx.quadraticCurveTo(shX + 0.115 * k, shY + 0.08 * k, shX + 0.115 * k, shY + 0.01 * k);
  ctx.quadraticCurveTo(shX + 0.1 * k, shY - 0.04 * k, shX, shY - 0.04 * k);
  ctx.quadraticCurveTo(shX - 0.1 * k, shY - 0.04 * k, shX - 0.115 * k, shY + 0.01 * k);
  ctx.quadraticCurveTo(shX - 0.115 * k, shY + 0.08 * k, hx - 0.095 * k, hy - 0.02 * k);
  ctx.fill();
  // arms
  const arm = (side, ang) => {
    const sxp = shX + side * 0.115 * k, syp = shY + 0.015 * k;
    const a = ang * side, len1 = 0.15 * k, len2 = 0.15 * k;
    const ex = sxp + Math.sin(a) * len1, ey = syp + Math.cos(a) * len1;
    const a2 = a * 0.85 + side * 0.1;
    const hxp = ex + Math.sin(a2) * len2, hyp = ey + Math.cos(a2) * len2;
    ctx.strokeStyle = style.skin; ctx.lineWidth = 0.05 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hxp, hyp); ctx.stroke();
    ctx.fillStyle = style.skin; ctx.beginPath(); ctx.arc(hxp, hyp, 0.03 * k, 0, TAU); ctx.fill();
    ctx.strokeStyle = style.shirt2; ctx.lineWidth = 0.075 * k; ctx.beginPath(); ctx.moveTo(sxp, syp); ctx.lineTo(ex, ey); ctx.stroke();
  };
  arm(-1, o.armL ?? 0.18); arm(1, o.armR ?? 0.18);
  // neck and head
  ctx.fillStyle = style.skin; ctx.fillRect(shX - 0.025 * k, shY - 0.07 * k, 0.05 * k, 0.05 * k);
  ctx.beginPath(); ctx.arc(hcx, hcy, headR, 0, TAU); ctx.fill();
  // hair on top
  ctx.fillStyle = style.hair;
  if (style.kind === 'bob') {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.1, headR * 1.08, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.beginPath(); ctx.roundRect(hcx - headR * 1.08, hcy - headR * 0.15, headR * 0.34, headR * 1.15, headR * 0.15); ctx.fill();
    ctx.beginPath(); ctx.roundRect(hcx + headR * 0.74, hcy - headR * 0.15, headR * 0.34, headR * 1.15, headR * 0.15); ctx.fill();
  } else if (style.kind === 'buns') {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.1, headR * 1.05, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.beginPath(); ctx.arc(hcx - headR * 0.95, hcy - headR * 0.85, headR * 0.42, 0, TAU); ctx.arc(hcx + headR * 0.95, hcy - headR * 0.85, headR * 0.42, 0, TAU); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(hcx, hcy - headR * 0.12, headR * 1.06, Math.PI * 0.98, Math.PI * 2.02); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hcx - headR * 0.35, hcy - headR * 0.78, headR * 0.7, headR * 0.3, -0.25, 0, TAU); ctx.fill();
  }
  // face
  const lx = (o.look ?? 0) * headR * 0.18;
  ctx.fillStyle = '#2a1a14';
  ctx.beginPath(); ctx.ellipse(hcx - headR * 0.36 + lx, hcy + headR * 0.08, headR * 0.1, headR * 0.14, 0, 0, TAU); ctx.ellipse(hcx + headR * 0.36 + lx, hcy + headR * 0.08, headR * 0.1, headR * 0.14, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,90,120,0.35)';
  ctx.beginPath(); ctx.arc(hcx - headR * 0.58, hcy + headR * 0.38, headR * 0.17, 0, TAU); ctx.arc(hcx + headR * 0.58, hcy + headR * 0.38, headR * 0.17, 0, TAU); ctx.fill();
  const m = o.mouth ?? 0;
  ctx.strokeStyle = '#7a2a2a'; ctx.lineWidth = Math.max(1.5, 0.014 * k); ctx.lineCap = 'round';
  if (m > 0.3) { ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.ellipse(hcx + lx, hcy + headR * 0.52, headR * 0.2, headR * 0.12 * m, 0, 0, TAU); ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(hcx + lx, hcy + headR * 0.34, headR * 0.26, 0.2, Math.PI - 0.2); ctx.stroke(); }
  return { hx, hy, shX, shY, hcx, hcy, headR };
}

// ---- the elastic -------------------------------------------------------------------------------------------------------------------
// One strand from x0 to x1 at screen height y. dips: [{x, a, w}] pressed by feet. wob: wobble amplitude (units), ph: phase.
function strand(ctx, x0, x1, y, k, dips, wob, ph, col, hi, width) {
  const N = 28; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = lerp(x0, x1, u);
    let yy = y + Math.sin(Math.PI * u) * k * 0.012 + Math.sin(u * Math.PI * 3 + ph) * wob * Math.sin(Math.PI * u);
    for (const d of dips) { const z = (x - d.x) / d.w; yy += d.a * Math.exp(-z * z); }
    pts.push([x, yy]);
  }
  ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.strokeStyle = hi; ctx.lineWidth = Math.max(1.5, width * 0.32); ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - width * 0.22) : ctx.moveTo(p[0], p[1] - width * 0.22))); ctx.stroke();
}

// Which strand and where: depth -1 far, +1 near. Called twice by the scene: far first (behind everyone), near last.
export function drawStrand(ctx, g, hgt, depth, e = {}) {
  const k = g.Bh, y = g.gy + depth * g.D - hgt * k;
  const half = 0.095 * k, w = Math.max(5, k * 0.04);
  const x0 = g.ax + (depth > 0 ? -half : half), x1 = g.bx + (depth > 0 ? half : -half);
  const dips = (e.dips ?? []).filter((d) => d.depth === depth).map((d) => ({ x: d.x, a: d.a, w: k * 0.09 }));
  // shadow on the ground
  ctx.strokeStyle = 'rgba(20,28,70,0.22)'; ctx.lineWidth = w * 0.9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, g.gy + depth * g.D + 5); ctx.lineTo(x1, g.gy + depth * g.D + 5); ctx.stroke();
  const tight = e.tight ?? 0;
  strand(ctx, x0, x1, y, k, dips, (e.wob ?? 0) * k, e.ph ?? 0, tight > 0.5 ? '#ff2d73' : PAL.pink, '#ffc2d8', w);
}
// The ends of the loop: round the holders' legs, behind them.
export function drawLoopEnds(ctx, g, hgt) {
  const k = g.Bh, w = Math.max(5, k * 0.04), yN = g.gy + g.D - hgt * k, yF = g.gy - g.D - hgt * k;
  ctx.strokeStyle = PAL.pink; ctx.lineWidth = w; ctx.lineCap = 'round';
  const half = 0.095 * k;
  for (const [x, s] of [[g.ax, -1], [g.bx, 1]]) {
    ctx.beginPath(); ctx.moveTo(x - s * half, yF); ctx.quadraticCurveTo(x + s * 0.2 * k, (yF + yN) / 2, x + s * half, yN); ctx.stroke();
  }
}

// ---- icons ---------------------------------------------------------------------------------------------------------------------------
// The pose as a plan view: two strands (lines) and where the feet land. Used on pads, cue tokens and the Rules pages.
export function drawPoseIcon(ctx, pose, cx, cy, size, o = {}) {
  const P = POSES[pose], u = size * 0.18, half = size / 2;
  ctx.save();
  if (o.bg !== false) {
    ctx.fillStyle = o.fill ?? P.col; ctx.beginPath(); ctx.roundRect(cx - half, cy - half, size, size, size * 0.2); ctx.fill();
  }
  ctx.strokeStyle = o.line ?? 'rgba(255,255,255,0.95)'; ctx.lineWidth = Math.max(2, size * 0.045); ctx.lineCap = 'round';
  for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx - half * 0.82, cy + d * u); ctx.lineTo(cx + half * 0.82, cy + d * u); ctx.stroke(); }
  const fx = [-1, 1].map((s) => cx + s * P.spread * size * 1.35);
  ctx.fillStyle = o.foot ?? '#14204a';
  P.depth.forEach((d, i) => {
    const y = cy + d * u * (Math.abs(d) > 1.5 ? 0.95 : 1);
    ctx.beginPath(); ctx.ellipse(fx[i], y, size * 0.075, size * 0.105, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(fx[i], y - size * 0.13, size * 0.05, size * 0.04, 0, 0, TAU); ctx.fill();
  });
  ctx.restore();
}

export function drawStars(ctx, cx, cy, size, n, max = 3) {
  for (let i = 0; i < max; i++) {
    const x = cx + (i - (max - 1) / 2) * size * 1.15, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let p = 0; p < 10; p++) { const r = p % 2 ? size * 0.22 : size * 0.5, a = -Math.PI / 2 + (p * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.06); ctx.lineJoin = 'round'; ctx.strokeStyle = on ? '#b8860b' : 'rgba(255,255,255,0.28)'; ctx.stroke();
    ctx.restore();
  }
}

// A foot print used in the trip counter: a small sneaker.
export function drawSneaker(ctx, cx, cy, s, on) {
  ctx.save(); ctx.translate(cx, cy);
  ctx.fillStyle = on ? '#fff8ec' : 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.roundRect(-s * 0.5, -s * 0.18, s, s * 0.36, s * 0.16); ctx.fill();
  ctx.fillStyle = on ? PAL.pink : 'rgba(255,255,255,0.1)';
  ctx.beginPath(); ctx.roundRect(-s * 0.1, -s * 0.34, s * 0.6, s * 0.3, s * 0.12); ctx.fill();
  ctx.restore();
}

// ---- particles -----------------------------------------------------------------------------------------------------------------------
const CONFETTI = ['#ff4f8b', '#ffd23f', '#26c281', '#2f8cff', '#b266ff', '#ff9a2e'];
export function burst(parts, rng, x, y, n, power = 1) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(-Math.PI * 0.95, -Math.PI * 0.05), v = rng.range(120, 360) * power;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rng.range(3, 7), life: rng.range(0.6, 1.1), age: 0, col: rng.pick(CONFETTI), rot: rng.range(0, TAU), spin: rng.range(-9, 9) });
  }
  if (parts.length > 160) parts.splice(0, parts.length - 160);
}
export function stepParticles(parts, dt) {
  for (const p of parts) { p.age += dt; p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].age > parts[i].life) parts.splice(i, 1);
}
export function drawParticles(ctx, parts) {
  for (const p of parts) {
    ctx.save(); ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.col; ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r); ctx.restore();
  }
}
export { smooth, clamp, lerp, TAU };
