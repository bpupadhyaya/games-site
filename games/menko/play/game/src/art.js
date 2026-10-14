// Drawing of the world: the wooden floor, the rug, and the discs with their twelve original motifs. All in world units
// (the floor is 640 x 640, a disc radius is 44); the caller sets the transform. Pure drawing, no state.
import { R, RUG, FLOOR, DESIGNS } from './sim.js';
import { v3 } from './v3.js';

const TAU = Math.PI * 2;
export const TEAM = [
  { rim: '#e0452f', dark: '#8d2217', name: 'vermilion' },
  { rim: '#3d78d8', dark: '#1d3f86', name: 'indigo' },
];

// ---- floor --------------------------------------------------------------------------------------------------------
const PLANKS = 8;
export function drawFloor(ctx, x0 = 0, y0 = 0, size = FLOOR) {
  ctx.save();
  ctx.translate(x0, y0);
  const k = size / FLOOR;
  ctx.scale(k, k);
  const ph = FLOOR / PLANKS;
  for (let i = 0; i < PLANKS; i++) {
    const t = (i * 37 % 7) / 7;
    const g = ctx.createLinearGradient(0, i * ph, 0, (i + 1) * ph);
    g.addColorStop(0, `hsl(${27 + t * 6},${48 + t * 8}%,${44 + t * 6}%)`);
    g.addColorStop(1, `hsl(${25 + t * 6},${46 + t * 8}%,${36 + t * 6}%)`);
    ctx.fillStyle = g; ctx.fillRect(0, i * ph, FLOOR, ph + 1);
    // grain
    ctx.strokeStyle = 'rgba(70,32,10,0.16)'; ctx.lineWidth = 1.2;
    for (let j = 0; j < 4; j++) {
      const yy = i * ph + 10 + ((i * 53 + j * 29) % (ph - 20));
      ctx.beginPath(); ctx.moveTo(0, yy);
      ctx.bezierCurveTo(FLOOR * 0.3, yy + ((j % 2) ? 4 : -4), FLOOR * 0.65, yy + ((j % 2) ? -5 : 5), FLOOR, yy + 2);
      ctx.stroke();
    }
    // end joints
    ctx.strokeStyle = 'rgba(40,16,4,0.5)'; ctx.lineWidth = 2;
    const jx = ((i * 211) % 400) + 120;
    ctx.beginPath(); ctx.moveTo(jx, i * ph); ctx.lineTo(jx, (i + 1) * ph); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,12,2,0.62)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(0, i * ph); ctx.lineTo(FLOOR, i * ph); ctx.stroke();
    // bevel: a lit lip under every seam, fine long grain, one knot per few planks
    ctx.strokeStyle = 'rgba(255,214,150,0.22)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(0, i * ph + 3); ctx.lineTo(FLOOR, i * ph + 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,26,6,0.10)'; ctx.lineWidth = 0.8;
    for (let j = 0; j < 9; j++) {
      const yy = i * ph + 6 + ((i * 31 + j * 17) % (ph - 12));
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.bezierCurveTo(FLOOR * 0.35, yy + (j % 3) - 1, FLOOR * 0.7, yy - (j % 3) + 1, FLOOR, yy + 1); ctx.stroke();
    }
    if (i % 3 === 1) {
      const kx = 60 + ((i * 97) % 520), ky = i * ph + ph * 0.5;
      ctx.strokeStyle = 'rgba(50,20,4,0.35)'; ctx.lineWidth = 1.4;
      for (let q = 1; q <= 3; q++) { ctx.beginPath(); ctx.ellipse(kx, ky, 5 * q, 2.6 * q, 0, 0, TAU); ctx.stroke(); }
    }
  }
  // rug
  const rg = ctx.createRadialGradient(RUG.x - 20, RUG.y - 26, 10, RUG.x, RUG.y, RUG.r + 14);
  rg.addColorStop(0, '#3f8a72'); rg.addColorStop(1, '#245c4c');
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(RUG.x, RUG.y, RUG.r + 12, 0, TAU); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#e8cf8a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(RUG.x, RUG.y, RUG.r + 6, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,226,170,0.55)'; ctx.lineWidth = 2;
  for (const rr of [RUG.r - 18, RUG.r - 44, RUG.r - 78]) { ctx.beginPath(); ctx.arc(RUG.x, RUG.y, rr, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(232,207,138,0.35)'; ctx.lineWidth = 3;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU;
    ctx.beginPath(); ctx.moveTo(RUG.x + Math.cos(a) * (RUG.r - 18), RUG.y + Math.sin(a) * (RUG.r - 18)); ctx.lineTo(RUG.x + Math.cos(a) * (RUG.r - 2), RUG.y + Math.sin(a) * (RUG.r - 2)); ctx.stroke();
  }
  // wall shade
  const v = ctx.createRadialGradient(FLOOR / 2, FLOOR / 2, FLOOR * 0.38, FLOOR / 2, FLOOR / 2, FLOOR * 0.78);
  v.addColorStop(0, 'rgba(20,8,2,0)'); v.addColorStop(1, 'rgba(20,8,2,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, FLOOR, FLOOR);
  // varnish sheen: a broad soft reflection from the window
  const sh = ctx.createLinearGradient(0, 0, FLOOR, FLOOR);
  sh.addColorStop(0, 'rgba(255,236,190,0.16)'); sh.addColorStop(0.35, 'rgba(255,236,190,0.0)'); sh.addColorStop(0.7, 'rgba(255,236,190,0.07)'); sh.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = sh; ctx.fillRect(0, 0, FLOOR, FLOOR);
  ctx.restore();
}

// ---- motifs --------------------------------------------------------------------------------------------------------
// Each draws inside the unit circle (radius 1) with `c` = { bg, a, b, c } colours. Called with ctx scaled to the face.
const poly = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
const starPts = (n, ro, ri, rot = -Math.PI / 2) => Array.from({ length: n * 2 }, (_, i) => { const r = i % 2 ? ri : ro, a = rot + (i * Math.PI) / n; return [Math.cos(a) * r, Math.sin(a) * r]; });
const MOTIFS = {
  sun(ctx, c) {
    ctx.fillStyle = c.b;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; poly(ctx, [[Math.cos(a - 0.14) * 0.52, Math.sin(a - 0.14) * 0.52], [Math.cos(a) * 0.92, Math.sin(a) * 0.92], [Math.cos(a + 0.14) * 0.52, Math.sin(a + 0.14) * 0.52]]); ctx.fill(); }
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.arc(0, 0, 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(-0.1, -0.1, 0.16, 0, TAU); ctx.fill();
  },
  wave(ctx, c) {
    ctx.lineWidth = 0.11; ctx.lineCap = 'round';
    for (let r = 0; r < 4; r++) {
      ctx.strokeStyle = r % 2 ? c.b : c.a;
      for (let i = -3; i <= 3; i++) {
        const cx = i * 0.34 + (r % 2 ? 0.17 : 0), cy = -0.5 + r * 0.36;
        ctx.beginPath(); ctx.arc(cx, cy + 0.2, 0.2, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      }
    }
  },
  moon(ctx, c) {
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.arc(-0.05, 0, 0.58, 0, TAU); ctx.fill();
    ctx.fillStyle = c.bg; ctx.beginPath(); ctx.arc(0.2, -0.08, 0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = c.b;
    for (const [x, y, s] of [[0.5, -0.42, 0.1], [0.62, 0.15, 0.07], [0.32, 0.5, 0.09]]) { poly(ctx, starPts(5, s, s * 0.45).map(([a, b]) => [a + x, b + y])); ctx.fill(); }
  },
  mountain(ctx, c) {
    ctx.fillStyle = c.b; ctx.beginPath(); ctx.arc(0.42, -0.4, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = c.a; poly(ctx, [[-0.95, 0.62], [-0.3, -0.45], [0.35, 0.62]]); ctx.fill();
    ctx.fillStyle = c.c; poly(ctx, [[-0.3, -0.45], [-0.52, -0.1], [-0.38, -0.16], [-0.3, -0.02], [-0.18, -0.16], [-0.06, -0.1]]); ctx.fill();
    ctx.fillStyle = c.b; ctx.globalAlpha = 0.85; poly(ctx, [[-0.1, 0.62], [0.42, -0.12], [0.95, 0.62]]); ctx.fill(); ctx.globalAlpha = 1;
  },
  fish(ctx, c) {
    ctx.fillStyle = c.b; poly(ctx, [[0.45, 0], [0.92, -0.34], [0.8, 0], [0.92, 0.34]]); ctx.fill();
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.ellipse(-0.05, 0, 0.58, 0.34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.bg; ctx.lineWidth = 0.05; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 3; i++) for (let j = -1; j <= 1; j++) { ctx.beginPath(); ctx.arc(-0.1 + i * 0.2, j * 0.15, 0.1, -1.2, 1.2); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(-0.36, -0.08, 0.06, 0, TAU); ctx.fill();
    ctx.fillStyle = c.b; poly(ctx, [[-0.1, -0.3], [0.2, -0.52], [0.18, -0.28]]); ctx.fill();
  },
  crane(ctx, c) {
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.ellipse(0.05, 0.1, 0.42, 0.2, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = c.b; poly(ctx, [[-0.2, 0.0], [-0.1, -0.7], [0.3, -0.05]]); ctx.fill();
    poly(ctx, [[0.3, 0.2], [0.85, 0.5], [0.15, 0.4]]); ctx.fill();
    ctx.strokeStyle = c.a; ctx.lineWidth = 0.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-0.28, 0.05); ctx.bezierCurveTo(-0.65, -0.1, -0.5, -0.5, -0.6, -0.6); ctx.stroke();
    ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(-0.6, -0.62, 0.09, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.c; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(-0.67, -0.6); ctx.lineTo(-0.88, -0.52); ctx.stroke();
  },
  leaf(ctx, c) {
    ctx.fillStyle = c.a;
    const pts = [];
    const n = 5;
    for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? 0.34 : 0.86; pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.95 - 0.04]); }
    poly(ctx, pts); ctx.fill();
    ctx.strokeStyle = c.b; ctx.lineWidth = 0.06; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; ctx.beginPath(); ctx.moveTo(0, 0.02); ctx.lineTo(Math.cos(a) * 0.62, Math.sin(a) * 0.62); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, 0.1); ctx.lineTo(0, 0.78); ctx.stroke();
  },
  flower(ctx, c) {
    ctx.fillStyle = c.a;
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate((i / 5) * TAU); ctx.beginPath(); ctx.ellipse(0, -0.5, 0.26, 0.4, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = c.bg; ctx.lineWidth = 0.04; ctx.globalAlpha = 0.6;
    for (let i = 0; i < 5; i++) { ctx.save(); ctx.rotate((i / 5) * TAU); ctx.beginPath(); ctx.moveTo(0, -0.75); ctx.lineTo(0, -0.62); ctx.stroke(); ctx.restore(); }
    ctx.globalAlpha = 1; ctx.fillStyle = c.b; ctx.beginPath(); ctx.arc(0, 0, 0.18, 0, TAU); ctx.fill();
    ctx.fillStyle = c.c; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.03, 0, TAU); ctx.fill(); }
  },
  lantern(ctx, c) {
    ctx.fillStyle = c.b; ctx.fillRect(-0.28, -0.82, 0.56, 0.1); ctx.fillRect(-0.28, 0.62, 0.56, 0.1);
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.ellipse(0, -0.05, 0.5, 0.64, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.bg; ctx.lineWidth = 0.045; ctx.globalAlpha = 0.55;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.ellipse(0, -0.05, 0.5 * Math.abs(i) * 0.5 + 0.02, 0.64, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = c.c; ctx.beginPath(); ctx.ellipse(0, -0.05, 0.2, 0.3, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.b; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, 0.72); ctx.lineTo(0, 0.94); ctx.stroke();
  },
  star(ctx, c) {
    ctx.fillStyle = c.a; poly(ctx, starPts(5, 0.92, 0.4)); ctx.fill();
    ctx.fillStyle = c.b; poly(ctx, starPts(5, 0.5, 0.22)); ctx.fill();
    ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(0, 0.02, 0.1, 0, TAU); ctx.fill();
  },
  fan(ctx, c) {
    ctx.save(); ctx.translate(0, 0.5);
    ctx.fillStyle = c.a; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 1.18, -Math.PI * 0.86, -Math.PI * 0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.bg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 0.42, -Math.PI * 0.9, -Math.PI * 0.1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = c.b; ctx.lineWidth = 0.05;
    for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.86 - (0.72 * i) / 5); ctx.beginPath(); ctx.moveTo(Math.cos(a) * 0.42, Math.sin(a) * 0.42); ctx.lineTo(Math.cos(a) * 1.18, Math.sin(a) * 1.18); ctx.stroke(); }
    ctx.fillStyle = c.c; ctx.beginPath(); ctx.arc(0, 0, 0.1, 0, TAU); ctx.fill();
    ctx.restore();
  },
  kite(ctx, c) {
    ctx.fillStyle = c.a; poly(ctx, [[0, -0.88], [0.5, -0.1], [0, 0.55], [-0.5, -0.1]]); ctx.fill();
    ctx.fillStyle = c.b; poly(ctx, [[0, -0.88], [0.5, -0.1], [0, -0.1]]); ctx.fill(); poly(ctx, [[0, 0.55], [-0.5, -0.1], [0, -0.1]]); ctx.fill();
    ctx.strokeStyle = c.c; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, -0.88); ctx.lineTo(0, 0.55); ctx.moveTo(-0.5, -0.1); ctx.lineTo(0.5, -0.1); ctx.stroke();
    ctx.strokeStyle = c.a; ctx.lineWidth = 0.05; ctx.beginPath(); ctx.moveTo(0, 0.55); ctx.bezierCurveTo(0.3, 0.7, -0.3, 0.8, 0.1, 0.95); ctx.stroke();
  },
};
// colourways (cream paper / midnight paper) with a distinct accent per motif
const ACC = {
  sun: ['#e04a2c', '#f2b432', '#ffe9a8'], wave: ['#2d6fb8', '#7fb7e6', '#fff'], moon: ['#f7e9a8', '#ffd35a', '#fff'], mountain: ['#4a6a8f', '#d95e3a', '#ffffff'],
  fish: ['#e8802a', '#c85a14', '#1c1c1c'], crane: ['#fdf8ec', '#202636', '#d12f2b'], leaf: ['#d9452a', '#8a2412', '#fff'], flower: ['#f08aa6', '#e84a78', '#ffe08a'],
  lantern: ['#e8452c', '#3a2a1a', '#ffe28a'], star: ['#f2b432', '#e04a2c', '#fff3c0'], fan: ['#3a8f6a', '#1f5a40', '#f2d27a'], kite: ['#d84a3a', '#2f6fb8', '#ffffff'],
};
const ALT = {
  sun: ['#ffcf4a', '#ff7a3c', '#fff6c8'], wave: ['#7fd0f0', '#3a86d0', '#ffffff'], moon: ['#ff6a4a', '#ffd35a', '#ffffff'], mountain: ['#9ab4d8', '#ffb27a', '#ffffff'],
  fish: ['#d8dde6', '#8a96aa', '#10131c'], crane: ['#ff5a4a', '#fdf8ec', '#fdf8ec'], leaf: ['#f2c22e', '#c58a10', '#fff'], flower: ['#e0356a', '#ffd2e0', '#ffe08a'],
  lantern: ['#ffb43a', '#e8d9a8', '#fff3b0'], star: ['#c9d4ff', '#7f93ff', '#fff'], fan: ['#ffb0d0', '#e85a98', '#fff3c0'], kite: ['#ffd23a', '#e8503a', '#ffffff'],
};
const BG = ['#f6ecd0', '#1e2a52'];

// ---- a disc -------------------------------------------------------------------------------------------------------
// o: { r (default R), spin, flip (0 = face up .. 1 = back up, animating), lift (0..1 raised off the floor), a, ghost,
//      glow (0..1 white pulse), dim, backSide }
export function drawDisc(ctx, x, y, design, side, o = {}) {
  const r = o.r ?? R, dsg = DESIGNS[design], lift = o.lift ?? 0, a = o.a ?? 1;
  let sx = 1, back = false;
  if (o.flip !== undefined && o.flip > 0) { const ang = o.flip * Math.PI; sx = Math.cos(ang); back = ang > Math.PI / 2; sx = Math.max(0.04, Math.abs(sx)); }
  const lr = r * (1 + lift * 0.28);
  // 3D build: a lit, rendered disc sprite stands in for the flat art (tray chips, score cards, collection)
  if (v3.on && v3.sprites && !o.face && !o.ghost && !(o.flip > 0)) {
    const sp = v3.sprites(design, side);
    if (sp) { const S = (lr / 0.4) * 2; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(sp, x - S / 2, y - S / 2 - lift * 10, S, S); ctx.restore(); return; }
  }
  const faceOnly = !!o.face;
  ctx.save();
  ctx.globalAlpha = a * (o.ghost ? 0.62 : 1);
  // contact + soft cast shadow (further and softer when lifted)
  if (!faceOnly) { ctx.save(); ctx.translate(x + 3 + lift * 14, y + 5 + lift * 18); ctx.scale(sx, 1);
  ctx.shadowColor = `rgba(10,4,0,${0.55 - lift * 0.2})`; ctx.shadowBlur = 9 + lift * 14; ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(0, 0, r * (1 + lift * 0.06) * 0.97, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.translate(x, y - (faceOnly ? 0 : lift * 16)); ctx.scale(sx, 1);
  ctx.rotate(0);
  // thickness: stacked card layers under the face, darker at the bottom
  const layers = ['#8f7d52', '#a99763', '#c4b583', '#d9cca0'];
  if (!faceOnly) for (let k = 0; k < layers.length; k++) { ctx.fillStyle = layers[k]; ctx.beginPath(); ctx.arc(0, 3.6 - k * 0.9, lr, 0, TAU); ctx.fill(); }
  const eg = ctx.createLinearGradient(-lr, -lr, lr, lr); eg.addColorStop(0, '#fffaf0'); eg.addColorStop(1, '#d8c99c');
  ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(0, 0, lr, 0, TAU); ctx.fill();
  if (back) {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, lr);
    g.addColorStop(0, '#46557f'); g.addColorStop(1, '#222c52');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, lr * 0.93, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,160,0.55)'; ctx.lineWidth = 1.6;
    for (const k of [0.3, 0.52, 0.74]) { ctx.beginPath(); ctx.arc(0, 0, lr * k, 0, TAU); ctx.stroke(); }
  } else {
    // team rim band: solid vermilion or notched indigo (shape differs too, not just colour)
    const t = TEAM[side] ?? TEAM[0];
    const rg2 = ctx.createLinearGradient(-lr, -lr, lr, lr); rg2.addColorStop(0, t.rim); rg2.addColorStop(1, t.dark);
    ctx.fillStyle = rg2; ctx.beginPath(); ctx.arc(0, 0, lr * 0.93, 0, TAU); ctx.fill();
    if (side === 1) {
      ctx.fillStyle = t.dark;
      for (let i = 0; i < 12; i++) { const an = (i / 12) * TAU; ctx.beginPath(); ctx.arc(Math.cos(an) * lr * 0.86, Math.sin(an) * lr * 0.86, lr * 0.055, 0, TAU); ctx.fill(); }
    }
    ctx.fillStyle = BG[dsg.ink]; ctx.beginPath(); ctx.arc(0, 0, lr * 0.76, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, lr * 0.765, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, lr * 0.925, 0, TAU); ctx.stroke();
    const pal = (dsg.ink ? ALT : ACC)[dsg.motif];
    ctx.save(); ctx.rotate(o.spin ?? 0); ctx.scale(lr * 0.62, lr * 0.62);
    ctx.beginPath(); ctx.arc(0, 0, 1.14, 0, TAU); ctx.clip();
    MOTIFS[dsg.motif](ctx, { bg: BG[dsg.ink], a: pal[0], b: pal[1], c: pal[2] });
    ctx.restore();
    // stars pips on the rim
    if (!o.noPips) {
      ctx.fillStyle = '#ffd35a'; ctx.strokeStyle = 'rgba(60,30,0,0.7)'; ctx.lineWidth = 0.8;
      for (let i = 0; i < dsg.stars; i++) {
        const an = Math.PI / 2 + (i - (dsg.stars - 1) / 2) * 0.34;
        ctx.beginPath(); ctx.arc(Math.cos(an) * lr * 0.84, Math.sin(an) * lr * 0.84, lr * 0.065, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    // soft highlight
    const hl = ctx.createLinearGradient(-lr, -lr, lr, lr);
    hl.addColorStop(0, 'rgba(255,255,255,0.30)'); hl.addColorStop(0.45, 'rgba(255,255,255,0)'); hl.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(0, 0, lr * 0.93, 0, TAU); ctx.fill();
    // printed-varnish glint
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1.5, lr * 0.05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, lr * 0.84, Math.PI * 1.08, Math.PI * 1.34); ctx.stroke();
  }
  if (o.glow) { ctx.globalAlpha = o.glow * 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, lr, 0, TAU); ctx.fill(); }
  ctx.restore();
}

// Weight dots, drawn under a disc chip or a label: `w` dots of radius d.
export function drawDots(ctx, cx, y, w, d, col = '#2a2f55') {
  ctx.fillStyle = col;
  for (let i = 0; i < w; i++) { ctx.beginPath(); ctx.arc(cx + (i - (w - 1) / 2) * d * 2.5, y, d, 0, TAU); ctx.fill(); }
}
