// Painted actors: camels (Bactrian and dromedary), horses, walking and standing people, and lit portraits. Pure canvas.
import { hex, mix, rgb, shade, clamp, hash, lerp } from './paint.js';

const TAU = Math.PI * 2;
const ell = (ctx, x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); };

// A tapered limb from (x0,y0) to (x1,y1), width w0 -> w1, filled (not stroked) so it can be shaded.
function limb(ctx, x0, y0, x1, y1, w0, w1, fill) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(x0 + nx * w0 / 2, y0 + ny * w0 / 2); ctx.lineTo(x1 + nx * w1 / 2, y1 + ny * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, Math.atan2(ny, nx), Math.atan2(ny, nx) + Math.PI, false);
  ctx.lineTo(x0 - nx * w0 / 2, y0 - ny * w0 / 2);
  ctx.arc(x0, y0, w0 / 2, Math.atan2(-ny, -nx), Math.atan2(-ny, -nx) + Math.PI, false);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
const groundShadow = (ctx, x, y, rx, ry, a = 0.28) => { ctx.save(); const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, `rgba(30,18,8,${a})`); g.addColorStop(1, 'rgba(30,18,8,0)'); ctx.fillStyle = g; ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y); ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill(); ctx.restore(); };

export const COAT = { bactrian: ['#c89a62', '#7d5630', '#e0b87e'], dromedary: ['#d6ae78', '#8d6840', '#ecc994'], dark: ['#a87a4c', '#5e3d22', '#c79a68'], pale: ['#dcc08e', '#9a7a4c', '#f0dcac'] };
const LOADCOL = { silk: '#c8456a', paper: '#e8dcb4', spice: '#c06a2a', glass: '#4aa6b4', horse: '#7a5a3a', jade: '#4f9a6a', supplies: '#8a6a3a' };

// Camel facing right, ground point (x, y), body length ~ 1 unit * s. phase 0..1 is the walk cycle. o: { dir: 1|-1, kind, coat, load: [good ids], lead, blanket, bell, still }
export function camel(ctx, x, y, s, phase = 0, o = {}) {
  const dir = o.dir ?? 1, kind = o.kind ?? 'bactrian', C = COAT[o.coat ?? kind] ?? COAT.bactrian, still = !!o.still;
  const bob = still ? 0 : Math.sin(phase * TAU * 2) * 0.012;
  groundShadow(ctx, x - dir * s * 0.02, y + s * 0.01, s * 0.5, s * 0.1, 0.32);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  const lw = (n) => n; // unit-space widths
  const near = [0.25, 0.64], far = [0.5, 0.0];
  // leg phases: far legs in anti-phase
  const legs = [
    { hx: 0.27, p: 0, far: true }, { hx: -0.3, p: 0.5, far: true },
    { hx: 0.21, p: 0.5, far: false }, { hx: -0.25, p: 0, far: false },
  ];
  const hipY = -0.30 + bob;
  const drawLeg = (L) => {
    const ph = still ? 0.12 : (phase + L.p) % 1, swing = Math.sin(ph * TAU);
    const a1 = swing * 0.42 * (still ? 0.3 : 1), lift = Math.max(0, Math.sin(ph * TAU + 0.9));
    const upper = 0.17, lower = 0.17;
    const kx = L.hx + Math.sin(a1) * upper, ky = hipY + Math.cos(a1) * upper;
    const a2 = a1 - lift * 0.7 + (L.hx > 0 ? 0 : 0.1) * 0, fx = kx + Math.sin(a2) * lower, fy = Math.min(0, ky + Math.cos(a2) * lower);
    const col = L.far ? shade(C[0], -0.35) : C[0];
    limb(ctx, L.hx, hipY, kx, ky, 0.085, 0.052, col);
    limb(ctx, kx, ky, fx, fy, 0.05, 0.034, col);
    ctx.fillStyle = shade(C[1], -0.3); ell(ctx, fx + 0.012, fy - 0.004, 0.034, 0.016); ctx.fill();   // pad
    if (!L.far) { ctx.strokeStyle = 'rgba(255,236,196,0.22)'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(L.hx - 0.02, hipY); ctx.lineTo(kx - 0.015, ky); ctx.stroke(); }
  };
  drawLeg(legs[0]); drawLeg(legs[1]);
  // tail
  ctx.strokeStyle = C[1]; ctx.lineWidth = 0.02; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.45, -0.43 + bob); ctx.quadraticCurveTo(-0.5, -0.36 + bob, -0.49, -0.24 + bob + Math.sin(phase * TAU * 2) * 0.01); ctx.stroke();
  ctx.fillStyle = C[1]; ell(ctx, -0.49, -0.22 + bob, 0.016, 0.03); ctx.fill();
  // neck (behind body): S curve to the head
  const g = ctx.createLinearGradient(0, -0.9, 0, -0.3);
  g.addColorStop(0, C[2]); g.addColorStop(0.5, C[0]); g.addColorStop(1, C[1]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(0.22, -0.50 + bob);
  ctx.bezierCurveTo(0.34, -0.50 + bob, 0.38, -0.66, 0.42, -0.78 + bob);
  ctx.lineTo(0.46, -0.86 + bob); ctx.lineTo(0.56, -0.84 + bob);
  ctx.bezierCurveTo(0.53, -0.7 + bob, 0.5, -0.52, 0.42, -0.36 + bob);
  ctx.lineTo(0.2, -0.3 + bob); ctx.closePath(); ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(-0.44, -0.40 + bob);
  ctx.bezierCurveTo(-0.46, -0.50 + bob, -0.30, -0.56 + bob, -0.1, -0.54 + bob);
  ctx.bezierCurveTo(0.08, -0.53 + bob, 0.22, -0.55 + bob, 0.32, -0.46 + bob);
  ctx.bezierCurveTo(0.36, -0.34 + bob, 0.3, -0.24 + bob, 0.14, -0.2 + bob);
  ctx.bezierCurveTo(-0.05, -0.17 + bob, -0.3, -0.2 + bob, -0.4, -0.27 + bob);
  ctx.bezierCurveTo(-0.46, -0.31 + bob, -0.46, -0.36 + bob, -0.44, -0.40 + bob);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, -0.56, 0, -0.17); bg.addColorStop(0, C[2]); bg.addColorStop(0.35, C[0]); bg.addColorStop(1, C[1]);
  ctx.fillStyle = bg; ctx.fill();
  // humps
  const humps = kind === 'dromedary' ? [[-0.04, 0.15]] : [[-0.14, 0.14], [0.1, 0.13]];
  for (const [hx, hh] of humps) {
    const hg = ctx.createLinearGradient(hx - 0.1, 0, hx + 0.1, 0); hg.addColorStop(0, C[2]); hg.addColorStop(1, C[1]);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(hx - 0.11, -0.52 + bob); ctx.bezierCurveTo(hx - 0.08, -0.52 - hh * 1.3 + bob, hx + 0.08, -0.52 - hh * 1.3 + bob, hx + 0.11, -0.52 + bob); ctx.closePath(); ctx.fill();
    if (!o.load || !o.load.length) { ctx.strokeStyle = shade(C[1], -0.2); ctx.lineWidth = 0.01; ctx.beginPath(); ctx.moveTo(hx - 0.04, -0.52 - hh * 0.9 + bob); ctx.quadraticCurveTo(hx + 0.02, -0.52 - hh * 1.1 + bob, hx + 0.06, -0.52 - hh * 0.5 + bob); ctx.stroke(); }
  }
  // fur on the neck and the throat
  ctx.fillStyle = shade(C[1], -0.1);
  for (let i = 0; i < 5; i++) { const u = i / 4, px = 0.42 + u * 0.06, py = -0.78 + u * 0.3 + bob; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 0.03, py + 0.07); ctx.lineTo(px + 0.01, py + 0.04); ctx.closePath(); ctx.fill(); }
  // head
  const hg2 = ctx.createLinearGradient(0.5, -0.9, 0.66, -0.76); hg2.addColorStop(0, C[2]); hg2.addColorStop(1, C[0]);
  ctx.fillStyle = hg2; ctx.beginPath(); ctx.moveTo(0.47, -0.86 + bob); ctx.bezierCurveTo(0.54, -0.9 + bob, 0.62, -0.86 + bob, 0.67, -0.8 + bob);
  ctx.bezierCurveTo(0.69, -0.77 + bob, 0.68, -0.74 + bob, 0.64, -0.745 + bob); ctx.bezierCurveTo(0.58, -0.75 + bob, 0.54, -0.74 + bob, 0.5, -0.77 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C[1]; ctx.beginPath(); ctx.moveTo(0.485, -0.88 + bob); ctx.lineTo(0.47, -0.93 + bob); ctx.lineTo(0.51, -0.89 + bob); ctx.closePath(); ctx.fill();   // ear
  ctx.fillStyle = '#1d1209'; ell(ctx, 0.545, -0.835 + bob, 0.01, 0.007); ctx.fill();                                                                  // eye
  ctx.fillStyle = 'rgba(40,20,10,0.5)'; ell(ctx, 0.66, -0.775 + bob, 0.007, 0.005); ctx.fill();                                                        // nostril
  // blanket and load
  const blank = o.blanket ?? '#a83a3a';
  const mid = kind === 'dromedary' ? -0.04 : -0.02;
  ctx.fillStyle = blank; ctx.beginPath(); ctx.moveTo(mid - 0.13, -0.49 + bob); ctx.quadraticCurveTo(mid, -0.545 + bob, mid + 0.13, -0.49 + bob); ctx.lineTo(mid + 0.12, -0.3 + bob); ctx.lineTo(mid - 0.12, -0.3 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(blank, 0.35); ctx.fillRect(mid - 0.12, -0.34 + bob, 0.24, 0.018); ctx.fillStyle = shade(blank, -0.3); ctx.fillRect(mid - 0.12, -0.31 + bob, 0.24, 0.01);
  const load = o.load ?? [];
  load.slice(0, 3).forEach((id, i) => {
    const col = LOADCOL[id] ?? '#8a6a3a', bx = mid - 0.1 + i * 0.1, by = -0.62 + bob - (i === 1 ? 0.05 : 0.0);
    if (i === 1) { // pack across the top
      const pg = ctx.createLinearGradient(0, by - 0.1, 0, by + 0.05); pg.addColorStop(0, shade(col, 0.3)); pg.addColorStop(1, shade(col, -0.25));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(mid - 0.14, by - 0.1, 0.28, 0.14, 0.04); ctx.fill();
      ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(mid - 0.14, by - 0.03); ctx.lineTo(mid + 0.14, by - 0.03); ctx.stroke();
    }
  });
  if (load.length) {
    // hanging bales on the near side
    load.slice(0, 2).forEach((id, i) => {
      const col = LOADCOL[id] ?? '#8a6a3a', bx = mid - 0.1 + i * 0.12, by = -0.4 + bob;
      const pg = ctx.createLinearGradient(bx, by, bx + 0.1, by + 0.16); pg.addColorStop(0, shade(col, 0.28)); pg.addColorStop(1, shade(col, -0.35));
      ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(bx, by, 0.11, 0.17, 0.03); ctx.fill();
      ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(bx + 0.055, by); ctx.lineTo(bx + 0.055, by + 0.17); ctx.stroke();
    });
  }
  // near legs
  drawLeg(legs[2]); drawLeg(legs[3]);
  // belly shade and back highlight
  ctx.strokeStyle = 'rgba(255,238,200,0.28)'; ctx.lineWidth = 0.012; ctx.beginPath(); ctx.moveTo(-0.38, -0.5 + bob); ctx.bezierCurveTo(-0.3, -0.54 + bob, -0.2, -0.55 + bob, -0.22, -0.54 + bob); ctx.stroke();
  // bell and halter
  if (o.bell !== false) { ctx.fillStyle = '#e0b040'; ell(ctx, 0.49, -0.6 + bob, 0.016, 0.02); ctx.fill(); ctx.strokeStyle = '#6b3a28'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(0.46, -0.64 + bob); ctx.lineTo(0.5, -0.59 + bob); ctx.stroke(); }
  ctx.restore();
}

// Horse facing right. o: { dir, coat, phase, still, rider }
export function horse(ctx, x, y, s, phase = 0, o = {}) {
  const dir = o.dir ?? 1, col = o.coat ?? '#7a4b2a', still = !!o.still;
  const bob = still ? 0 : Math.sin(phase * TAU * 2) * 0.012;
  groundShadow(ctx, x, y + s * 0.01, s * 0.48, s * 0.09, 0.3);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  const hipY = -0.34 + bob;
  const legs = [{ hx: 0.28, p: 0.0, far: true }, { hx: -0.3, p: 0.5, far: true }, { hx: 0.22, p: 0.5, far: false }, { hx: -0.25, p: 0.0, far: false }];
  const drawLeg = (L) => {
    const ph = still ? 0.1 : (phase + L.p) % 1, sw = Math.sin(ph * TAU), a1 = sw * 0.5 * (still ? 0.3 : 1), lift = Math.max(0, Math.sin(ph * TAU + 0.9));
    const kx = L.hx + Math.sin(a1) * 0.18, ky = hipY + Math.cos(a1) * 0.18, a2 = a1 - lift * 0.9, fx = kx + Math.sin(a2) * 0.18, fy = Math.min(0, ky + Math.cos(a2) * 0.18);
    const c = L.far ? shade(col, -0.4) : col;
    limb(ctx, L.hx, hipY, kx, ky, 0.075, 0.04, c); limb(ctx, kx, ky, fx, fy, 0.038, 0.028, c);
    ctx.fillStyle = '#2a1a10'; ell(ctx, fx + 0.008, fy - 0.004, 0.026, 0.014); ctx.fill();
  };
  drawLeg(legs[0]); drawLeg(legs[1]);
  // tail
  ctx.fillStyle = shade(col, -0.45); ctx.beginPath(); ctx.moveTo(-0.42, -0.5 + bob); ctx.bezierCurveTo(-0.55, -0.45, -0.56, -0.25, -0.5, -0.12 + Math.sin(phase * TAU) * 0.02); ctx.bezierCurveTo(-0.5, -0.28, -0.46, -0.4, -0.4, -0.45 + bob); ctx.closePath(); ctx.fill();
  // neck + head
  const ng = ctx.createLinearGradient(0, -0.9, 0, -0.4); ng.addColorStop(0, shade(col, 0.28)); ng.addColorStop(1, shade(col, -0.15));
  ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(0.18, -0.55 + bob); ctx.bezierCurveTo(0.3, -0.62, 0.38, -0.78, 0.4, -0.9 + bob); ctx.lineTo(0.5, -0.92 + bob);
  ctx.bezierCurveTo(0.62, -0.88, 0.7, -0.78, 0.74, -0.7 + bob); ctx.bezierCurveTo(0.74, -0.66, 0.7, -0.65, 0.66, -0.68 + bob); ctx.bezierCurveTo(0.6, -0.72, 0.54, -0.74, 0.5, -0.72 + bob);
  ctx.bezierCurveTo(0.46, -0.6, 0.42, -0.48, 0.38, -0.4 + bob); ctx.lineTo(0.2, -0.36 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, -0.55); ctx.beginPath(); ctx.moveTo(0.4, -0.9 + bob); ctx.bezierCurveTo(0.34, -0.8, 0.3, -0.7, 0.26, -0.58 + bob); ctx.lineTo(0.33, -0.6 + bob); ctx.bezierCurveTo(0.36, -0.7, 0.4, -0.8, 0.45, -0.88 + bob); ctx.closePath(); ctx.fill();   // mane
  ctx.fillStyle = shade(col, -0.2); ctx.beginPath(); ctx.moveTo(0.52, -0.92 + bob); ctx.lineTo(0.55, -0.99 + bob); ctx.lineTo(0.58, -0.91 + bob); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#140b06'; ell(ctx, 0.6, -0.82 + bob, 0.009, 0.007); ctx.fill();
  // body
  ctx.beginPath(); ctx.moveTo(-0.45, -0.47 + bob); ctx.bezierCurveTo(-0.4, -0.58 + bob, -0.1, -0.6 + bob, 0.1, -0.58 + bob); ctx.bezierCurveTo(0.24, -0.57, 0.34, -0.5, 0.34, -0.4 + bob);
  ctx.bezierCurveTo(0.32, -0.28 + bob, 0.1, -0.22 + bob, -0.1, -0.22 + bob); ctx.bezierCurveTo(-0.3, -0.22 + bob, -0.46, -0.3 + bob, -0.45, -0.47 + bob); ctx.closePath();
  const bg = ctx.createLinearGradient(0, -0.6, 0, -0.2); bg.addColorStop(0, shade(col, 0.3)); bg.addColorStop(0.4, col); bg.addColorStop(1, shade(col, -0.4));
  ctx.fillStyle = bg; ctx.fill();
  // saddle cloth
  ctx.fillStyle = o.cloth ?? '#6a2a2a'; ctx.beginPath(); ctx.roundRect(-0.12, -0.56 + bob, 0.26, 0.2, 0.03); ctx.fill();
  drawLeg(legs[2]); drawLeg(legs[3]);
  ctx.restore();
  if (o.rider) walker(ctx, x + dir * s * 0.0, y - s * 0.38 + (still ? 0 : Math.sin(phase * TAU * 2) * s * 0.01), s * 0.72, 0, { ...o.rider, dir, seated: true, still: true });
}

const SKIN = ['#e3b898', '#d4a47c', '#c48d62', '#b57c52'];
// Person walking / standing, facing right, ground point (x,y), s = body height in px. o: { dir, robe, trim, hat, skin, staff, seated, still, carry, bag }
export function walker(ctx, x, y, s, phase = 0, o = {}) {
  const dir = o.dir ?? 1, robe = o.robe ?? '#2f5f8a', skin = o.skin ?? '#d4a47c', still = !!o.still, hat = o.hat ?? 'cap';
  if (!o.seated) groundShadow(ctx, x, y + s * 0.01, s * 0.28, s * 0.05, 0.3);
  ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
  const sw = still ? 0 : Math.sin(phase * TAU), bob = still ? 0 : Math.abs(Math.sin(phase * TAU)) * 0.012;
  const hipY = -0.46 - bob;
  if (o.seated) {
    // legs bent over the horse's side
    limb(ctx, 0.0, -0.5, 0.1, -0.28, 0.08, 0.06, shade(robe, -0.3)); limb(ctx, 0.1, -0.28, 0.05, -0.12, 0.06, 0.05, '#2a1a10');
  } else {
    const leg = (a, col) => { const kx = Math.sin(a) * 0.2, ky = hipY + Math.cos(a) * 0.22; const fx = kx + Math.sin(a * 0.5 - (a > 0 ? 0 : 0.2)) * 0.2, fy = Math.min(0, ky + 0.23); limb(ctx, 0, hipY, kx, ky, 0.085, 0.06, col); limb(ctx, kx, ky, fx, fy, 0.055, 0.045, col); ctx.fillStyle = '#2a1a10'; ell(ctx, fx + 0.025, fy - 0.01, 0.045, 0.02); ctx.fill(); };
    leg(-sw * 0.5, shade(robe, -0.5)); leg(sw * 0.5, shade(robe, -0.35));
  }
  // staff behind
  if (o.staff) { ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.moveTo(0.12 + sw * 0.04, -0.98); ctx.lineTo(0.2 + sw * 0.06, 0); ctx.stroke(); }
  // robe
  const rg = ctx.createLinearGradient(-0.12, 0, 0.12, 0); rg.addColorStop(0, shade(robe, 0.22)); rg.addColorStop(0.55, robe); rg.addColorStop(1, shade(robe, -0.4));
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(-0.07, -0.84 - bob); ctx.bezierCurveTo(-0.14, -0.7 - bob, -0.16, -0.5 - bob, -0.15, -0.3 - bob + (o.seated ? 0.1 : 0));
  ctx.lineTo(0.15, -0.3 - bob + (o.seated ? 0.1 : 0)); ctx.bezierCurveTo(0.14, -0.5 - bob, 0.12, -0.7 - bob, 0.07, -0.84 - bob); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(robe, -0.45); ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(0.0, -0.84 - bob); ctx.lineTo(0.02, -0.34 - bob); ctx.stroke();   // front seam
  ctx.fillStyle = o.trim ?? shade(robe, 0.5); ctx.fillRect(-0.1, -0.6 - bob, 0.2, 0.025);                                                             // sash
  // arms
  const arm = (a, col) => { const ex = Math.sin(a) * 0.12, ey = -0.78 - bob + Math.cos(a) * 0.14; limb(ctx, 0, -0.82 - bob, ex, ey, 0.06, 0.05, col); limb(ctx, ex, ey, ex + Math.sin(a + 0.3) * 0.1, ey + 0.12, 0.045, 0.038, col); ctx.fillStyle = skin; ell(ctx, ex + Math.sin(a + 0.3) * 0.1, ey + 0.13, 0.025, 0.025); ctx.fill(); };
  arm(sw * 0.4, shade(robe, -0.25));
  if (o.staff || o.carry) { limb(ctx, 0.0, -0.8 - bob, 0.14, -0.7 - bob, 0.055, 0.045, robe); ctx.fillStyle = skin; ell(ctx, 0.15, -0.7 - bob, 0.025, 0.025); ctx.fill(); }
  else arm(-sw * 0.4, robe);
  if (o.bag) { ctx.fillStyle = o.bag; ctx.beginPath(); ctx.roundRect(-0.2, -0.7 - bob, 0.12, 0.18, 0.03); ctx.fill(); }
  // head
  head(ctx, 0.0, -0.92 - bob, 0.056, skin, hat, o);
  ctx.restore();
}
function head(ctx, cx, cy, r, skin, hat, o = {}) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r * 1.2); g.addColorStop(0, shade(skin, 0.2)); g.addColorStop(1, shade(skin, -0.3));
  ctx.fillStyle = skin; ctx.fillRect(cx - r * 0.3, cy + r * 0.6, r * 0.6, r * 0.6);
  ctx.fillStyle = g; ell(ctx, cx, cy, r * 0.85, r); ctx.fill();
  const robe = o.robe ?? '#2f5f8a';
  if (hat === 'turban') { ctx.fillStyle = '#e8dfc8'; ell(ctx, cx - r * 0.05, cy - r * 0.55, r * 1.05, r * 0.62); ctx.fill(); ctx.strokeStyle = '#b8ac90'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.arc(cx, cy - r * 0.55, r * 0.8, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
  else if (hat === 'straw') { ctx.fillStyle = '#d9b862'; ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.4, r * 1.7, r * 0.45, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#c4a24e'; ell(ctx, cx, cy - r * 0.7, r * 0.8, r * 0.5); ctx.fill(); }
  else if (hat === 'fur') { ctx.fillStyle = '#5a3a24'; ell(ctx, cx, cy - r * 0.55, r * 1.05, r * 0.55); ctx.fill(); ctx.fillStyle = '#8a6a4a'; ell(ctx, cx, cy - r * 0.3, r * 1.0, r * 0.28); ctx.fill(); }
  else if (hat === 'official') { ctx.fillStyle = '#1c1c24'; ell(ctx, cx, cy - r * 0.6, r * 0.9, r * 0.5); ctx.fill(); ctx.fillRect(cx - r * 1.5, cy - r * 0.72, r * 3, r * 0.1); }
  else if (hat === 'veil') { ctx.fillStyle = shade(robe, 0.1); ctx.beginPath(); ctx.moveTo(cx - r * 1.05, cy + r * 1.3); ctx.bezierCurveTo(cx - r * 1.3, cy - r * 0.3, cx - r * 0.8, cy - r * 1.2, cx, cy - r * 1.15); ctx.bezierCurveTo(cx + r * 0.8, cy - r * 1.2, cx + r * 1.3, cy - r * 0.3, cx + r * 1.05, cy + r * 1.3); ctx.lineTo(cx + r * 0.7, cy + r * 0.2); ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.7, cx - r * 0.5, cy - r * 0.7, cx - r * 0.7, cy + r * 0.2); ctx.closePath(); ctx.fill(); }
  else if (hat === 'sogdian') { ctx.fillStyle = '#7a2a34'; ctx.beginPath(); ctx.moveTo(cx - r * 0.9, cy - r * 0.3); ctx.quadraticCurveTo(cx - r * 0.4, cy - r * 1.9, cx + r * 0.3, cy - r * 1.5); ctx.quadraticCurveTo(cx + r * 0.9, cy - r * 1.0, cx + r * 0.9, cy - r * 0.3); ctx.closePath(); ctx.fill(); }
  else if (hat === 'scholar') { ctx.fillStyle = '#1c2236'; ell(ctx, cx, cy - r * 0.6, r * 0.95, r * 0.55); ctx.fill(); }
  else { ctx.fillStyle = shade(robe, -0.2); ell(ctx, cx, cy - r * 0.65, r * 0.9, r * 0.45); ctx.fill(); }
}

// A lit bust portrait inside a framed plate. size = plate width/height in px. look from data.js PEOPLE[].look
export function portrait(ctx, cx, cy, size, look, o = {}) {
  const S = size, x = cx - S / 2, y = cy - S / 2;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, S, S, S * 0.08); ctx.clip();
  // backdrop: warm wall with soft light from the upper left
  const bg = ctx.createLinearGradient(x, y, x + S, y + S); bg.addColorStop(0, o.bg0 ?? '#6a4a34'); bg.addColorStop(1, o.bg1 ?? '#2b1c14');
  ctx.fillStyle = bg; ctx.fillRect(x, y, S, S);
  const rl = ctx.createRadialGradient(x + S * 0.3, y + S * 0.25, 0, x + S * 0.3, y + S * 0.25, S * 0.8); rl.addColorStop(0, 'rgba(255,230,180,0.35)'); rl.addColorStop(1, 'rgba(255,230,180,0)'); ctx.fillStyle = rl; ctx.fillRect(x, y, S, S);
  const skin = look.skin ?? '#d4a47c', robe = look.robe ?? '#2f5f8a', age = look.age ?? 0.5, female = !!look.female;
  const u = S / 100;
  // shoulders and robe
  const rg = ctx.createLinearGradient(x, y + 70 * u, x + S, y + S); rg.addColorStop(0, shade(robe, 0.25)); rg.addColorStop(1, shade(robe, -0.45));
  ctx.fillStyle = rg; ctx.beginPath(); ctx.moveTo(x + 6 * u, y + S + 2); ctx.bezierCurveTo(x + 8 * u, y + 76 * u, x + 26 * u, y + 70 * u, x + 38 * u, y + 68 * u); ctx.lineTo(x + 62 * u, y + 68 * u); ctx.bezierCurveTo(x + 76 * u, y + 70 * u, x + 92 * u, y + 76 * u, x + 94 * u, y + S + 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = shade(robe, 0.55); ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(x + 42 * u, y + 69 * u); ctx.lineTo(x + 50 * u, y + 86 * u); ctx.lineTo(x + 58 * u, y + 69 * u); ctx.stroke();
  // neck
  const ng = ctx.createLinearGradient(x + 40 * u, 0, x + 62 * u, 0); ng.addColorStop(0, shade(skin, -0.05)); ng.addColorStop(1, shade(skin, -0.4));
  ctx.fillStyle = ng; ctx.beginPath(); ctx.moveTo(x + 41 * u, y + 58 * u); ctx.lineTo(x + 41 * u, y + 71 * u); ctx.quadraticCurveTo(x + 50 * u, y + 76 * u, x + 59 * u, y + 71 * u); ctx.lineTo(x + 59 * u, y + 58 * u); ctx.closePath(); ctx.fill();
  // ears
  ctx.fillStyle = shade(skin, -0.2); ell(ctx, x + 31 * u, y + 44 * u, 3.2 * u, 5.5 * u); ctx.fill(); ell(ctx, x + 69 * u, y + 44 * u, 3.2 * u, 5.5 * u); ctx.fill();
  // hair behind
  const gray = age > 0.75, hairCol = gray ? '#b9b4aa' : age > 0.55 ? '#3a3330' : '#1a1210';
  if (female || look.hat === 'veil') { ctx.fillStyle = hairCol; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 40 * u, 21 * u, 25 * u, 0, 0, TAU); ctx.fill(); }
  // head
  const hg = ctx.createRadialGradient(x + 42 * u, y + 34 * u, 4 * u, x + 50 * u, y + 44 * u, 34 * u);
  hg.addColorStop(0, shade(skin, 0.28)); hg.addColorStop(0.6, skin); hg.addColorStop(1, shade(skin, -0.38));
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(x + 32 * u, y + 38 * u);
  ctx.bezierCurveTo(x + 32 * u, y + 20 * u, x + 68 * u, y + 20 * u, x + 68 * u, y + 38 * u);
  ctx.bezierCurveTo(x + 69 * u, y + 52 * u, x + 63 * u, y + 63 * u, x + 50 * u, y + 65 * u);
  ctx.bezierCurveTo(x + 37 * u, y + 63 * u, x + 31 * u, y + 52 * u, x + 32 * u, y + 38 * u); ctx.closePath(); ctx.fill();
  // brow, eyes, nose, mouth
  ctx.lineCap = 'round';
  const brow = (px, dir) => { ctx.strokeStyle = shade(hairCol, 0.0); ctx.lineWidth = 2.2 * u; ctx.beginPath(); ctx.moveTo(px - 5.5 * u * dir, y + 37.5 * u); ctx.quadraticCurveTo(px, y + 35 * u, px + 5.5 * u * dir, y + 37 * u); ctx.stroke(); };
  brow(42 * u + x, 1); brow(58 * u + x, -1);
  for (const px of [42, 58]) {
    ctx.fillStyle = '#f5ede0'; ell(ctx, x + px * u, y + 42.5 * u, 4.4 * u, 2.5 * u); ctx.fill();
    ctx.fillStyle = '#3a2418'; ell(ctx, x + (px + (o.look ?? 0.4)) * u, y + 42.6 * u, 2.1 * u, 2.1 * u); ctx.fill();
    ctx.fillStyle = '#0c0705'; ell(ctx, x + (px + (o.look ?? 0.4)) * u, y + 42.6 * u, 1 * u, 1 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, x + (px + 0.9) * u, y + 41.9 * u, 0.6 * u, 0.6 * u); ctx.fill();
    ctx.strokeStyle = shade(skin, -0.55); ctx.lineWidth = 1.1 * u; ctx.beginPath(); ctx.moveTo(x + (px - 4.6) * u, y + 42.6 * u); ctx.quadraticCurveTo(x + px * u, y + 39.8 * u, x + (px + 4.6) * u, y + 42.4 * u); ctx.stroke();
  }
  ctx.strokeStyle = shade(skin, -0.38); ctx.lineWidth = 1.5 * u; ctx.beginPath(); ctx.moveTo(x + 50 * u, y + 42 * u); ctx.quadraticCurveTo(x + 47 * u, y + 51 * u, x + 47.5 * u, y + 53.5 * u); ctx.quadraticCurveTo(x + 50 * u, y + 55 * u, x + 53 * u, y + 53.5 * u); ctx.stroke();
  ctx.fillStyle = 'rgba(255,240,215,0.2)'; ell(ctx, x + 51.2 * u, y + 47 * u, 1.2 * u, 4.6 * u); ctx.fill();
  const mood = o.mood ?? 0.15;
  ctx.strokeStyle = shade(skin, -0.5); ctx.lineWidth = 1.6 * u; ctx.beginPath(); ctx.moveTo(x + 44 * u, y + 59.5 * u); ctx.quadraticCurveTo(x + 50 * u, y + (60 + 3 * mood * 4) * u, x + 56 * u, y + 59.5 * u); ctx.stroke();
  if (female) { ctx.fillStyle = 'rgba(190,70,70,0.45)'; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 59.6 * u, 4.5 * u, 1.3 * u, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(200,80,60,0.12)'; ell(ctx, x + 38 * u, y + 52 * u, 5 * u, 3 * u); ctx.fill(); ell(ctx, x + 62 * u, y + 52 * u, 5 * u, 3 * u); ctx.fill();
  if (age > 0.6) { ctx.strokeStyle = shade(skin, -0.3); ctx.lineWidth = 0.9 * u; ctx.beginPath(); ctx.moveTo(x + 37 * u, y + 29 * u); ctx.quadraticCurveTo(x + 50 * u, y + 26 * u, x + 63 * u, y + 29 * u); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 39 * u, y + 32 * u); ctx.quadraticCurveTo(x + 50 * u, y + 29.5 * u, x + 61 * u, y + 32 * u); ctx.stroke(); }
  // beard
  const bc = gray ? '#cfcac0' : '#201814';
  if (look.beard === 1) { ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(x + 35 * u, y + 50 * u); ctx.bezierCurveTo(x + 38 * u, y + 66 * u, x + 62 * u, y + 66 * u, x + 65 * u, y + 50 * u); ctx.bezierCurveTo(x + 62 * u, y + 56 * u, x + 38 * u, y + 56 * u, x + 35 * u, y + 50 * u); ctx.fill(); ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 56.5 * u, 6.5 * u, 1.7 * u, 0, 0, TAU); ctx.fill(); }
  else if (look.beard === 2) { ctx.fillStyle = bc; ctx.beginPath(); ctx.moveTo(x + 33 * u, y + 46 * u); ctx.bezierCurveTo(x + 33 * u, y + 72 * u, x + 67 * u, y + 72 * u, x + 67 * u, y + 46 * u); ctx.bezierCurveTo(x + 62 * u, y + 56 * u, x + 38 * u, y + 56 * u, x + 33 * u, y + 46 * u); ctx.fill(); ctx.strokeStyle = shade(skin, -0.45); ctx.lineWidth = 1.4 * u; ctx.beginPath(); ctx.moveTo(x + 44 * u, y + 59 * u); ctx.quadraticCurveTo(x + 50 * u, y + 60.5 * u, x + 56 * u, y + 59 * u); ctx.stroke(); ctx.fillStyle = bc; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 56 * u, 8 * u, 2 * u, 0, 0, TAU); ctx.fill(); }
  // hat
  const hat = look.hat;
  const hc = (c) => c;
  if (hat === 'turban') { const tg = ctx.createLinearGradient(x + 28 * u, y + 10 * u, x + 70 * u, y + 34 * u); tg.addColorStop(0, '#f2ead6'); tg.addColorStop(1, '#b8a98a'); ctx.fillStyle = tg; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 25 * u, 23 * u, 14 * u, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(120,100,70,0.5)'; ctx.lineWidth = 1 * u; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 25 * u, 23 * u - i * 1.5 * u, 14 * u - i * 2.5 * u, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); } }
  else if (hat === 'straw') { ctx.fillStyle = '#d9b862'; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 28 * u, 38 * u, 8 * u, 0, 0, TAU); ctx.fill(); const sg = ctx.createLinearGradient(0, y + 8 * u, 0, y + 28 * u); sg.addColorStop(0, '#ecd27e'); sg.addColorStop(1, '#b8943e'); ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(x + 30 * u, y + 28 * u); ctx.quadraticCurveTo(x + 50 * u, y - 4 * u, x + 70 * u, y + 28 * u); ctx.closePath(); ctx.fill(); }
  else if (hat === 'fur') { const fg = ctx.createLinearGradient(0, y + 8 * u, 0, y + 34 * u); fg.addColorStop(0, '#8a6a4c'); fg.addColorStop(1, '#4a2e1c'); ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 24 * u, 24 * u, 13 * u, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a2214'; ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 32 * u, 23 * u, 5 * u, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(210,180,140,0.5)'; ctx.lineWidth = 0.8 * u; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(x + (30 + i * 3) * u, y + 30 * u); ctx.lineTo(x + (30 + i * 3 + 1) * u, y + 22 * u); ctx.stroke(); } }
  else if (hat === 'official') { ctx.fillStyle = '#17171f'; ctx.beginPath(); ctx.moveTo(x + 32 * u, y + 30 * u); ctx.bezierCurveTo(x + 32 * u, y + 8 * u, x + 68 * u, y + 8 * u, x + 68 * u, y + 30 * u); ctx.lineTo(x + 68 * u, y + 32 * u); ctx.lineTo(x + 32 * u, y + 32 * u); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 8 * u, y + 24 * u, 22 * u, 3 * u); ctx.fillRect(x + 70 * u, y + 24 * u, 22 * u, 3 * u); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 36 * u, y + 14 * u, 12 * u, 2 * u); }
  else if (hat === 'veil') { const vg = ctx.createLinearGradient(x, y, x + S, y + S); vg.addColorStop(0, shade(robe, 0.3)); vg.addColorStop(1, shade(robe, -0.3)); ctx.fillStyle = vg; ctx.beginPath(); ctx.moveTo(x + 24 * u, y + 76 * u); ctx.bezierCurveTo(x + 18 * u, y + 40 * u, x + 26 * u, y + 12 * u, x + 50 * u, y + 11 * u); ctx.bezierCurveTo(x + 74 * u, y + 12 * u, x + 82 * u, y + 40 * u, x + 76 * u, y + 76 * u); ctx.lineTo(x + 68 * u, y + 56 * u); ctx.bezierCurveTo(x + 70 * u, y + 40 * u, x + 66 * u, y + 24 * u, x + 50 * u, y + 24 * u); ctx.bezierCurveTo(x + 34 * u, y + 24 * u, x + 30 * u, y + 40 * u, x + 32 * u, y + 56 * u); ctx.closePath(); ctx.fill(); }
  else if (hat === 'sogdian') { const sg = ctx.createLinearGradient(x + 30 * u, y, x + 70 * u, y + 30 * u); sg.addColorStop(0, '#b24350'); sg.addColorStop(1, '#6a2230'); ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(x + 31 * u, y + 32 * u); ctx.bezierCurveTo(x + 30 * u, y + 12 * u, x + 44 * u, y + 2 * u, x + 60 * u, y + 6 * u); ctx.bezierCurveTo(x + 70 * u, y + 12 * u, x + 70 * u, y + 24 * u, x + 69 * u, y + 32 * u); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8c870'; ctx.fillRect(x + 31 * u, y + 29 * u, 38 * u, 3.5 * u); }
  else if (hat === 'scholar') { ctx.fillStyle = '#161c30'; ctx.beginPath(); ctx.moveTo(x + 31 * u, y + 32 * u); ctx.bezierCurveTo(x + 31 * u, y + 12 * u, x + 69 * u, y + 12 * u, x + 69 * u, y + 32 * u); ctx.closePath(); ctx.fill(); ctx.fillRect(x + 28 * u, y + 29 * u, 44 * u, 4 * u); }
  else { // hair or cap
    ctx.fillStyle = hairCol; ctx.beginPath(); ctx.moveTo(x + 31 * u, y + 40 * u); ctx.bezierCurveTo(x + 28 * u, y + 14 * u, x + 72 * u, y + 14 * u, x + 69 * u, y + 40 * u); ctx.bezierCurveTo(x + 66 * u, y + 28 * u, x + 34 * u, y + 28 * u, x + 31 * u, y + 40 * u); ctx.fill();
    if (hat === 'cap') { ctx.fillStyle = shade(robe, 0.1); ctx.beginPath(); ctx.ellipse(x + 50 * u, y + 25 * u, 20 * u, 9 * u, 0, 0, TAU); ctx.fill(); }
  }
  // rim light from the left and edge darkening
  const rim = ctx.createLinearGradient(x, y, x + S, y); rim.addColorStop(0, 'rgba(255,220,170,0.22)'); rim.addColorStop(0.3, 'rgba(255,220,170,0)'); rim.addColorStop(0.75, 'rgba(0,0,0,0)'); rim.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = rim; ctx.fillRect(x, y, S, S);
  ctx.restore();
  ctx.save(); ctx.lineWidth = Math.max(2, S * 0.025); ctx.strokeStyle = o.frame ?? '#e8b84a'; ctx.beginPath(); ctx.roundRect(x, y, S, S, S * 0.08); ctx.stroke(); ctx.restore();
}

// A group of camels walking in a line. spec: { n, dir, phase, kind, loads: [[ids]...] }. Returns the x extent.
export function caravan(ctx, x, y, s, t, o = {}) {
  const n = o.n ?? 4, dir = o.dir ?? -1, kind = o.kind ?? 'bactrian', gap = s * 0.82, still = !!o.still;
  const items = [];
  // leader on foot, then camels (the head of the line is furthest in the travel direction)
  for (let i = 0; i < n; i++) items.push({ type: 'camel', i });
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k], px = x - dir * (k - (n - 1) / 2) * gap, py = y + (it.i % 2 ? s * 0.012 : -s * 0.01) + (k % 2) * s * 0.0;
    camel(ctx, px, py, s * (it.i % 2 ? 0.98 : 1), (t * 0.9 + it.i * 0.19) % 1, { dir, kind, load: (o.loads ?? [])[it.i % Math.max(1, (o.loads ?? []).length)] ?? [], blanket: ['#a83a3a', '#2e5a8a', '#c78a2a', '#5a7a3a'][it.i % 4], still, coat: it.i % 3 === 2 ? 'dark' : it.i % 3 === 1 ? 'pale' : undefined });
  }
  const lead = x + dir * ((n - 1) / 2 + 0.95) * gap;
  walker(ctx, lead, y + s * 0.02, s * 0.62, (t * 0.9 + 0.3) % 1, { dir, robe: '#2f5f8a', hat: 'turban', staff: true, still, skin: '#c48d62' });
  walker(ctx, x - dir * ((n - 1) / 2 + 0.85) * gap, y + s * 0.02, s * 0.6, (t * 0.9 + 0.1) % 1, { dir, robe: '#8a5a2a', hat: 'fur', carry: true, still, skin: '#b57c52' });
}
