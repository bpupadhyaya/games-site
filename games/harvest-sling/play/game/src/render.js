// Every pixel of Golden Sling. Reads state, never changes it. All art is drawn in code.
// Two coordinate systems (layout.js): the WORLD (sky, trees, birds, sling; ctx scaled by V.z) and the SCREEN (HUD, buttons, text panels).
import { V, SLING, STONE_R, CROP_MAX, CROP_DRAIN_FROM_LEVEL, DAILY, BIRDS, comboMultiplier, woodFor, stoneKind, SIBLINGS, AP_THINK_STEPS, skyY, STREAK_GIFTS, MISS_ASSIST } from './tuning.js';
import { previewArc } from './physics.js';
import { flowRules } from './content.js';
import { TEXT_SCALES, inRect } from './layout.js';
import { drawPredator, drawPerched } from './predator-art.js';
import { drawLockup, drawMoreLine, drawBadge } from './brand.js';

export { TEXT_SCALES };

// Light schemes (index 0 = default look; players can cycle). Colours: sky top/mid/bottom, sun,
// far hill, near hill, light tint drawn over the whole scene.
export const SCHEMES = [
  { name: 'Golden hour', day: true, sky: ['#3b6fb5', '#f0a65a', '#ffd98a'], sun: '#fff1c2', hills: ['#7d8f5e', '#5f7a45'], tint: 'rgba(255,170,60,0.10)', ink: '#2a1c0e' },
  { name: 'Dawn', deer: true, sky: ['#2b3a67', '#e38b8b', '#ffd0a8'], sun: '#ffe3cf', hills: ['#6f7f86', '#4f6a5a'], tint: 'rgba(255,120,120,0.08)', ink: '#1f1a2a' },
  { name: 'Clear noon', day: true, sky: ['#1e6fd0', '#6db7f2', '#cfeaff'], sun: '#ffffff', hills: ['#6fa05a', '#4c8a3f'], tint: 'rgba(255,255,255,0.0)', ink: '#10233a' },
  { name: 'Misty morning', deer: true, sky: ['#8fa6b5', '#c4d3d8', '#eef3f2'], sun: '#ffffff', hills: ['#93a79b', '#73907f'], tint: 'rgba(220,235,235,0.18)', ink: '#22313a' },
  { name: 'Sunset', deer: true, sky: ['#2a1f4f', '#c4456b', '#ff9a4a'], sun: '#ffd27a', hills: ['#5b4a63', '#3f3a4f'], tint: 'rgba(255,90,60,0.12)', ink: '#1a1024' },
  { name: 'Autumn', deer: true, sky: ['#6b5a8a', '#e8955a', '#ffd9a0'], sun: '#ffe2b0', hills: ['#a0743c', '#7a5430'], tint: 'rgba(255,140,40,0.12)', ink: '#2a1c0e', leaf: ['#8a3a1c', '#c4601f', '#e8a23a'], fall: 'leaf' },
  { name: 'Rain-fresh', sky: ['#5d7894', '#9db4c6', '#d3e0e6'], sun: '#f4f8fb', hills: ['#6f8f7c', '#4f7a66'], tint: 'rgba(120,160,190,0.14)', ink: '#10233a', leaf: ['#2a6a4a', '#3f9060', '#6cbf7a'], rain: true },
  { name: 'Moonlit', sky: ['#060a1e', '#14204a', '#2f4577'], sun: '#dfe8ff', hills: ['#1d2a4a', '#15203a'], tint: 'rgba(40,60,140,0.22)', ink: '#05070f' },
];

// Slingshot woods: [dark edge, light face, dark edge]. Index = woodFor(stars): the 5 stages unlock
// at STAR_UNLOCKS (oak is the default).
export const WOODS = [
  { name: 'Oak', colors: ['#5f3d1e', '#b58450', '#4f3218'] },
  { name: 'Olive', colors: ['#4a4a1e', '#a6a052', '#3a3a16'] },
  { name: 'Bamboo', colors: ['#7a8a3a', '#d9d68a', '#5f6e2a'] },
  { name: 'Ebony', colors: ['#120f0d', '#4a3f38', '#0a0807'] },
  { name: 'Gilded', colors: ['#8a5a10', '#ffd75a', '#6a4208'] },
];

const FIELDS = {
  wheat: { top: '#e2b84c', bottom: '#a9781f', row: 'rgba(120,80,10,0.35)', grass: ['#c9a23a', '#8a6a1a'] },
  rice: { top: '#8fcf6a', bottom: '#2f7d3a', row: 'rgba(200,240,255,0.35)', grass: ['#6fbf4a', '#2f7d3a'] },
  orchard: { top: '#9bc653', bottom: '#4d7f2a', row: 'rgba(40,80,20,0.25)', grass: ['#7fb83f', '#3f6f22'] },
  savanna: { top: '#dcbd6c', bottom: '#a4783a', row: 'rgba(110,70,20,0.28)', grass: ['#cfa955', '#94682c'] },
  snow: { top: '#f2f7fd', bottom: '#bccfe4', row: 'rgba(120,150,190,0.30)', grass: ['#ffffff', '#c9d8ea'] },
};

const BIRD_LOOK = {
  sparrow: { body: '#a5744a', belly: '#e8d2b0', wing: '#6f4a2c', beak: '#3a2a1a', scale: 0.8 },
  pigeon: { body: '#8d97a8', belly: '#c7cedb', wing: '#5f6a80', beak: '#d9a066', scale: 1.05 },
  parrot: { body: '#2fae4f', belly: '#ffd23f', wing: '#1f7fd0', beak: '#e04a3a', scale: 0.9 },
  duck: { body: '#7a5a3a', belly: '#e9dcc3', wing: '#2f6f4f', beak: '#f2a71b', scale: 1.0 },
  crow: { body: '#1d1f2a', belly: '#2d3040', wing: '#0f1018', beak: '#2a2a2a', scale: 0.95 },
  owl: { body: '#8a6a44', belly: '#e6d3b0', wing: '#5f452a', beak: '#d9a066', scale: 1.05 },
  swallow: { body: '#2f4a8a', belly: '#f0e4d0', wing: '#1c2f5f', beak: '#2a2a2a', scale: 0.85 },
  bigcrow: { body: '#1d1f2a', belly: '#2d3040', wing: '#0f1018', beak: '#3a3a3a', scale: 1.0 },
  hawk: { body: '#6b4a2a', belly: '#e8d2b0', wing: '#3d2a18', beak: '#e0a020', scale: 1.0 },
  goldfinch: { body: '#ffc93f', belly: '#fff3b0', wing: '#e08a1a', beak: '#c9701a', scale: 0.8 },
  hummingbird: { body: '#18b89a', belly: '#e9fff8', wing: 'rgba(255,255,255,0.55)', beak: '#22303a', scale: 0.5 },
};
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Fits `text` into maxW by shrinking the font (the font string's first "NNpx").
function fitFont(ctx, text, font, maxW) {
  ctx.font = font;
  if (!maxW) return;
  const w = ctx.measureText(text).width;
  if (w > maxW) ctx.font = font.replace(/(\d+(?:\.\d+)?)px/, (m, n) => `${Math.max(9, Math.floor(n * (maxW / w)))}px`);
}

function button(ctx, r, label, style, disabled) {
  ctx.save();
  ctx.globalAlpha = disabled ? 0.45 : 1;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  if (style === 'primary') {
    g.addColorStop(0, '#ffd75a');
    g.addColorStop(1, '#f08a24');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,0.30)');
    g.addColorStop(1, 'rgba(255,255,255,0.14)');
  }
  roundRect(ctx, r.x, r.y, r.w, r.h, r.h / 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = style === 'primary' ? '#3a1d05' : '#ffffff';
  fitFont(ctx, label, `700 ${Math.round(r.h * 0.36)}px system-ui, sans-serif`, r.w - 30);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

function drawSky(ctx, scheme, time) {
  const { WW, hy } = V, sh = hy + 40;
  const g = ctx.createLinearGradient(0, 0, 0, sh);
  g.addColorStop(0, scheme.sky[0]);
  g.addColorStop(0.62, scheme.sky[1]);
  g.addColorStop(1, scheme.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WW, sh);
  const sunX = WW * 0.75;
  const sunY = hy * 0.316;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 330);
  glow.addColorStop(0, scheme.sun);
  glow.addColorStop(0.12, scheme.sun);
  glow.addColorStop(0.16, 'rgba(255,240,200,0.45)');
  glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WW, sh);
  // soft god-rays from the low sun (a few translucent wedges that breathe slowly)
  ctx.save();
  for (let k = 0; k < (QUALITY.level >= 2 ? 0 : 5); k++) {
    const a = 1.9 + k * 0.32 + Math.sin(time * 0.15 + k) * 0.03, w = 0.07, len = hy * 1.4;
    ctx.fillStyle = `rgba(255,236,170,${0.045 + 0.02 * Math.sin(time * 0.4 + k * 2)})`;
    ctx.beginPath(); ctx.moveTo(sunX, sunY); ctx.lineTo(sunX + Math.cos(a - w) * len, sunY + Math.sin(a - w) * len); ctx.lineTo(sunX + Math.cos(a + w) * len, sunY + Math.sin(a + w) * len); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  const n = Math.max(4, Math.round(WW / 180)), ky = hy / 790;
  for (let i = 0; i < n; i++) {
    const cx = ((i * 230 + time * (6 + (i % 4) * 2)) % (WW + 300)) - 150;
    const cy = (110 + (i % 4) * 62) * ky;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 38 - 50, cy + (k % 2) * 8, 54 - k * 5, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHills(ctx, scheme, time = 0) {
  const { WW, hy } = V;
  ctx.save();
  ctx.translate(0, hy - 790);
  [[640, 70, 0.006, time * 0.03], [720, 50, 0.011, 2 + time * 0.12]].forEach(([base, amp, freq, phase], i) => {   // the two hill layers drift at different speeds (parallax)
    ctx.fillStyle = scheme.hills[i];
    ctx.beginPath();
    ctx.moveTo(0, 840);
    for (let x = 0; x <= WW; x += 12) ctx.lineTo(x, base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.7 + phase) * amp * 0.35);
    ctx.lineTo(WW, 840);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function drawField(ctx, world, time, wind) {
  const { WW, WH, hy } = V, o = hy - 790, H = WH - o, W = WW;
  ctx.save();
  ctx.translate(0, o);
  const f = FIELDS[world] ?? FIELDS.wheat;
  const g = ctx.createLinearGradient(0, 790, 0, H);
  g.addColorStop(0, f.top);
  g.addColorStop(1, f.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 790, W, H - 790 + 2);
  ctx.strokeStyle = f.row;
  ctx.lineWidth = 3;
  const rows = Math.max(8, Math.round(W / 90));
  for (let i = -rows; i <= rows; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 14, 792);
    ctx.lineTo(W / 2 + i * 150, H);
    ctx.stroke();
  }
  if (world === 'rice') {
    // Terrace steps: a darker earth bank under each paddy row, with water shine drifting across.
    for (let y = 850, i = 0; y < H; y += 110, i++) {
      ctx.fillStyle = 'rgba(70,45,20,0.45)';
      ctx.fillRect(0, y + 16, W, 8);
      ctx.fillStyle = 'rgba(200,235,255,0.26)';
      ctx.fillRect(0, y, W, 16);
      const shine = ((time * 40 + i * 170) % (W + 200)) - 100;
      const g2 = ctx.createLinearGradient(shine - 90, 0, shine + 90, 0);
      g2.addColorStop(0, 'rgba(255,255,255,0)');
      g2.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g2.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(shine - 90, y, 180, 16);
    }
  }
  if (world === 'savanna') {
    // waterhole near the horizon, with a soft sky reflection
    const wg = ctx.createLinearGradient(0, 838, 0, 878);
    wg.addColorStop(0, '#7fc4d8');
    wg.addColorStop(1, '#2f7f9a');
    ctx.fillStyle = 'rgba(80,50,20,0.5)';
    ctx.beginPath();
    ctx.ellipse(150, 856, 172, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(150, 854, 156, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(120 + Math.sin(time * 0.8) * 8, 848, 60, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (world === 'snow') {
    const dots = Math.round((14 * W) / 720);
    for (let i = 0; i < dots; i++) {
      const a = 0.35 + 0.35 * Math.sin(time * 2.4 + i * 1.9);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      const sx = (i * 61 + 30) % W;
      const sy = 830 + ((i * 97) % 400);
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // swaying stalks along the horizon line of the field
  ctx.lineWidth = 3;
  for (let x = 6; x < W; x += 14) {
    const sway = Math.sin(time * 1.6 + x * 0.05) * (5 + Math.abs(wind) * 0.06) + wind * 0.05;
    ctx.strokeStyle = x % 28 === 6 ? f.grass[0] : f.grass[1];
    ctx.beginPath();
    ctx.moveTo(x, 812);
    ctx.quadraticCurveTo(x + sway * 0.5, 795, x + sway, 776);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFence(ctx, scene, wave = 0, time = 0) {
  const W = V.WW;
  ctx.save();
  ctx.translate(0, V.hy - 790);
  const y = 830;
  ctx.fillStyle = '#7a5433';
  for (let x = 30; x < W; x += 60) {
    roundRect(ctx, x - 7, y - 50, 14, 76, 4);
    ctx.fill();
  }
  ctx.fillStyle = '#946a42';
  ctx.fillRect(0, y - 34, W, 9);
  ctx.fillRect(0, y - 6, W, 9);
  if (scene.world === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(0, y - 39, W, 7);
    for (let x = 30; x < W; x += 60) {
      roundRect(ctx, x - 9, y - 56, 18, 9, 4);
      ctx.fill();
    }
  }
  // scarecrow
  const sx = scene.scarecrowX;
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx, 850);
  ctx.lineTo(sx, 650);
  ctx.moveTo(sx - 64, 702);
  ctx.lineTo(sx - 4, 702);
  ctx.moveTo(sx + 4, 702);
  if (wave > 0) { const a = -0.9 + Math.sin(time * 18) * 0.35; ctx.lineTo(sx + 4 + Math.cos(a) * 62, 702 + Math.sin(a) * 62); }   // the scarecrow waves when a bird is scared off
  else ctx.lineTo(sx + 64, 702);
  ctx.stroke();
  ctx.fillStyle = '#b5452f';
  roundRect(ctx, sx - 30, 700, 60, 78, 10);
  ctx.fill();
  ctx.fillStyle = '#e9c98f';
  ctx.beginPath();
  ctx.arc(sx, 672, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c99a3a';
  ctx.beginPath();
  ctx.ellipse(sx, 656, 40, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, sx - 20, 630, 40, 28, 8);
  ctx.fill();
  // hay sheaves (only on wide fields): a stook of bound stalks, the top is a perch
  for (const h of scene.sheaves || []) {
    const hx = h.x, hyy = h.y - (V.hy - 790);
    ctx.fillStyle = '#c99a3a'; ctx.beginPath(); ctx.moveTo(hx - 34, hyy + 10); ctx.lineTo(hx - 8, hyy - 52); ctx.lineTo(hx + 8, hyy - 52); ctx.lineTo(hx + 34, hyy + 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#8a6a1a'; ctx.lineWidth = 3;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(hx + k * 12, hyy + 8); ctx.lineTo(hx + k * 3, hyy - 50); ctx.stroke(); }
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx - 22, hyy - 14); ctx.lineTo(hx + 22, hyy - 14); ctx.stroke();
  }
  ctx.restore();
}

const LEAF = { cols: ['#2f6b2f', '#4c9a3f', '#7cc65a'] };   // leaf colours of the current look (set per frame from the scheme)
function drawTree(ctx, tree, time, wind, world) {
  const topY = tree.groundY - tree.height;
  const trunk = ctx.createLinearGradient(tree.x - 22, 0, tree.x + 22, 0);
  trunk.addColorStop(0, '#4a2f18');
  trunk.addColorStop(0.5, '#7a5230');
  trunk.addColorStop(1, '#3d2612');
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(tree.x - 24, tree.groundY + 20);
  ctx.quadraticCurveTo(tree.x - 10, tree.groundY - tree.height * 0.5, tree.x - 8, topY + 30);
  ctx.lineTo(tree.x + 8, topY + 30);
  ctx.quadraticCurveTo(tree.x + 10, tree.groundY - tree.height * 0.5, tree.x + 24, tree.groundY + 20);
  ctx.closePath();
  ctx.fill();
  const swayNow = Math.sin(time * 0.9 + tree.x) * 4 + wind * 0.04;
  if (world === 'snow') drawPine(ctx, tree, topY, swayNow);
  ctx.strokeStyle = world === 'snow' ? '#4a3a2a' : '#5f3f22';
  ctx.lineCap = 'round';
  for (const b of tree.branches) {
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(b.x0, b.y0);
    ctx.quadraticCurveTo((b.x0 + b.x1) / 2, b.y1 + 16, b.x1, b.y1);
    ctx.stroke();
  }
  const sway = swayNow;
  if (world === 'snow') {
    // snow resting on the bare branches
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 5;
    for (const b of tree.branches) {
      ctx.beginPath();
      ctx.moveTo(b.x0, b.y0 - 6);
      ctx.quadraticCurveTo((b.x0 + b.x1) / 2, b.y1 + 10, b.x1, b.y1 - 5);
      ctx.stroke();
    }
    return;
  }
  if (world === 'savanna') {
    // acacia: flat umbrella crown in three layers
    for (const [color, wx, hy, dy] of [['#587a2c', 1.55, 0.34, 8], ['#7a9c3a', 1.35, 0.28, -6], ['#98bc4c', 1.0, 0.2, -18]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(tree.x + sway, topY + dy, tree.crown * wx, tree.crown * hy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const crownDots = world === 'orchard';
  const LC = LEAF.cols;
  const blobs = [[0, 0, 1], [-0.62, 0.28, 0.72], [0.62, 0.3, 0.74], [-0.3, -0.42, 0.7], [0.34, -0.38, 0.68]];
  for (const [shade, dy] of [[LC[0], 10], [LC[1], 0], [LC[2], -12]]) {
    ctx.fillStyle = shade;
    for (const [ox, oy, s] of blobs) {
      ctx.beginPath();
      ctx.arc(tree.x + ox * tree.crown + sway, topY + oy * tree.crown + dy, tree.crown * s * (shade === LC[2] ? 0.62 : 0.78), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (crownDots) {
    // Ripe mangoes hanging in the crown: fixed offsets so they never flicker.
    const spots = [[-0.7, 0.35], [0.05, 0.55], [0.7, 0.4], [-0.3, -0.05], [0.4, -0.15], [-0.05, 0.15], [0.55, 0.7], [-0.6, -0.4]];
    spots.forEach(([ox, oy], i) => {
      const mx = tree.x + ox * tree.crown + sway;
      const my = topY + oy * tree.crown;
      ctx.fillStyle = i % 2 ? '#ffb02e' : '#ff7a2e';
      ctx.beginPath();
      ctx.ellipse(mx, my, 9, 12, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.arc(mx - 3, my - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

// Leaves / pollen specks drifting with the wind. Pure function of time and wind: no state, no rng.
// Seasonal ambience by world: pink petals in the orchard, snowflakes in the snowy village, drifting rice-mist wisps. Pure functions of time.
function drawSeason(ctx, world, time, scheme = {}) {
  if (QUALITY.level >= 2) return;
  if (scheme.rain) {   // a soft drizzle (thin slanted lines) and a wet shine on the field
    ctx.save(); ctx.strokeStyle = 'rgba(210,230,245,0.35)'; ctx.lineWidth = 1.4; const nr = Math.round((46 * V.WW) / 720);
    for (let i = 0; i < nr; i++) { const x = (((i * 131 + time * 60) % (V.WW + 80)) + V.WW + 80) % (V.WW + 80) - 40, y = (((i * 211 + time * 520) % (V.hy + 160)) + V.hy + 160) % (V.hy + 160); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 16); ctx.stroke(); }
    const wg = ctx.createLinearGradient(0, V.hy, 0, V.WH); wg.addColorStop(0, 'rgba(255,255,255,0.16)'); wg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = wg; ctx.fillRect(0, V.hy, V.WW, V.WH - V.hy); ctx.restore();
  }
  const n = Math.round((14 * V.WW) / 720);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const sp = world === 'snow' ? 34 : 22, x = (((i * 173 + Math.sin(time * 0.6 + i) * 40 + time * 9) % (V.WW + 60)) + V.WW + 60) % (V.WW + 60) - 30;
    const y = (((i * 97 + time * sp) % (V.hy + 40)) + V.hy + 40) % (V.hy + 40);
    if (scheme.fall === 'leaf') { ctx.fillStyle = i % 2 ? 'rgba(214,110,40,0.85)' : 'rgba(232,170,60,0.85)'; ctx.translate(x, y); ctx.rotate(time * 1.1 + i); ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate(-(time * 1.1 + i)); ctx.translate(-x, -y); }
    else if (world === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.beginPath(); ctx.arc(x, y, 2.4 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
    else if (world === 'orchard') { ctx.fillStyle = i % 2 ? 'rgba(255,200,215,0.85)' : 'rgba(255,225,232,0.85)'; ctx.translate(x, y); ctx.rotate(time * 1.2 + i); ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.rotate(-(time * 1.2 + i)); ctx.translate(-x, -y); }
    else if (world === 'rice') { ctx.fillStyle = 'rgba(235,245,255,0.10)'; ctx.beginPath(); ctx.ellipse(x, V.hy - 30 + Math.sin(i * 2.3) * 40, 120, 14, 0, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

function drawMotes(ctx, time) {   // golden dust motes rising slowly through the light
  if (QUALITY.level >= 2) return;
  const n = Math.round((16 * V.WW) / 720);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = ((i * 211 + time * (6 + (i % 3) * 3) + Math.sin(time * 0.5 + i) * 30) % (V.WW + 40) + V.WW + 40) % (V.WW + 40) - 20;
    const y = V.hy - ((i * 137 + time * (14 + (i % 4) * 4)) % (V.hy - 40));
    const a = 0.25 + 0.2 * Math.sin(time * 1.7 + i * 2.1);
    ctx.fillStyle = `rgba(255,226,140,${a})`;
    ctx.beginPath(); ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawWindSpecks(ctx, time, wind, scheme, world = 'wheat') {
  drawMotes(ctx, time); drawSeason(ctx, world, time, scheme);
  if (!AMBIENT.off && QUALITY.level < 2) { drawCat(ctx, time); drawDeer(ctx, time, scheme); drawDayButterflies(ctx, time, scheme); }
  const drift = wind === 0 ? 8 : wind * 0.9;
  const n = Math.round((12 * V.WW) / 720);
  for (let i = 0; i < n; i++) {
    const span = V.WW + 160;
    let x = (i * 137 + time * drift) % span;
    if (x < 0) x += span;
    x -= 80;
    const y = skyY(190 + ((i * 89) % 560)) + Math.sin(time * 1.4 + i * 1.7) * 26;
    const size = 5 + (i % 3) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 2 + i);
    ctx.globalAlpha = wind === 0 ? 0.35 : 0.8;
    ctx.fillStyle = i % 3 === 0 ? '#e6c25a' : i % 3 === 1 ? '#8fcf5a' : scheme.sun;
    ctx.beginPath();
    ctx.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Snowy pine: four stacked triangle tiers, each with a snow cap. Drawn before the bare branches.
function drawPine(ctx, tree, topY, sway) {
  for (let i = 3; i >= 0; i--) {
    const y = topY - 30 + i * tree.crown * 0.62;
    const half = tree.crown * (0.55 + i * 0.3);
    ctx.fillStyle = i % 2 ? '#1c5645' : '#256b55';
    ctx.beginPath();
    ctx.moveTo(tree.x + sway * 0.6, y - tree.crown * 0.55);
    ctx.lineTo(tree.x - half, y + tree.crown * 0.42);
    ctx.lineTo(tree.x + half, y + tree.crown * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.moveTo(tree.x + sway * 0.6, y - tree.crown * 0.55);
    ctx.lineTo(tree.x - half * 0.55, y - tree.crown * 0.55 + tree.crown * 0.5);
    ctx.quadraticCurveTo(tree.x, y - tree.crown * 0.3, tree.x + half * 0.55, y - tree.crown * 0.55 + tree.crown * 0.5);
    ctx.closePath();
    ctx.fill();
  }
}

// Harmless ambient life: a rabbit hops across the foreground field for a few seconds every ~45 s (a pure function of time).
function drawRabbit(ctx, time) {
  const per = 45, t = time % per, dur = 9;
  if (t > dur || time < 12) return;
  const k = t / dur, x = -60 + k * (V.WW + 120), hop = Math.abs(Math.sin(t * 3.4)), y = V.hy + 150 - hop * 34, dir = 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ctx.fillStyle = 'rgba(30,20,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 22 + hop * 34, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#b89a78'; ctx.beginPath(); ctx.ellipse(0, 0, 20, 13, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(18, -8, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -24, 3.4, 11, 0.15, 0, Math.PI * 2); ctx.ellipse(23, -23, 3.4, 11, 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f4efe6'; ctx.beginPath(); ctx.arc(-20, -2, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1c0e'; ctx.beginPath(); ctx.arc(22, -10, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Light-touch ambient life (harmless, off in Calm, pure functions of time): a cat stalking along the fence now and then, a deer at the treeline in the dawn / dusk / mist / autumn
// looks, and a couple of small butterflies near the field in daylight looks.
function drawCat(ctx, time) {
  const per = 80, t = (time + 50) % per, dur = 16;
  if (t > dur) return;
  const k = t / dur, dir = (Math.floor((time + 50) / per) % 2) ? -1 : 1, x = dir > 0 ? -50 + k * (V.WW + 100) : V.WW + 50 - k * (V.WW + 100), y = V.hy - 18, step = Math.sin(t * 5);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.fillStyle = '#3a2f2a';
  ctx.beginPath(); ctx.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(24, -6, 8.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(19, -12); ctx.lineTo(21, -22); ctx.lineTo(25, -13); ctx.moveTo(26, -13); ctx.lineTo(30, -21); ctx.lineTo(31, -10); ctx.fill();
  ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = '#3a2f2a'; ctx.beginPath(); ctx.moveTo(-20, -2); ctx.quadraticCurveTo(-42, -20 + step * 4, -34, -34); ctx.stroke();
  ctx.lineWidth = 4; for (const [lx, ph] of [[-14, 0], [-6, 2], [10, 1], [18, 3]]) { ctx.beginPath(); ctx.moveTo(lx, 6); ctx.lineTo(lx + Math.sin(t * 5 + ph) * 5, 17); ctx.stroke(); }
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(28, -8, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawDeer(ctx, time, scheme) {
  if (!scheme.deer) return;
  const per = 100, t = (time + 75) % per, dur = 30;
  if (t > dur) return;
  const a = Math.min(1, t / 3, (dur - t) / 3) * 0.78, x = V.WW * 0.14, y = V.hy - 36, head = Math.sin(t * 0.8) * 0.18, graze = Math.sin(t * 0.25) > 0.5 ? 0.9 : 0;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.fillStyle = '#6b5a48';
  ctx.beginPath(); ctx.ellipse(0, 0, 30, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#6b5a48'; ctx.lineCap = 'round'; for (const lx of [-20, -12, 12, 20]) { ctx.beginPath(); ctx.moveTo(lx, 8); ctx.lineTo(lx, 36); ctx.stroke(); }
  ctx.save(); ctx.translate(26, -6); ctx.rotate(head + graze); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(10, -22 + graze * 30); ctx.stroke(); ctx.beginPath(); ctx.ellipse(14, -26 + graze * 40, 9, 6, 0.4, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#4a3b2c'; ctx.beginPath(); ctx.moveTo(12, -31 + graze * 40); ctx.lineTo(8, -46 + graze * 44); ctx.moveTo(10, -38 + graze * 42); ctx.lineTo(18, -44 + graze * 44); ctx.stroke(); ctx.restore();
  ctx.restore();
}
function drawDayButterflies(ctx, time, scheme) {
  if (!scheme.day) return;
  for (let i = 0; i < 2; i++) {
    const x = ((i * 0.43 + time * 0.012) % 1) * (V.WW + 80) - 40, y = V.hy + 95 + Math.sin(time * 0.9 + i * 2) * 26 + Math.sin(time * 3.1 + i) * 6;
    const f = Math.abs(Math.sin(time * 9 + i)); ctx.save(); ctx.translate(x, y); ctx.scale(0.55, 0.55);
    for (const [sx, c] of [[-1, '#fff3b0'], [1, '#ffe08a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sx * 9 * (0.3 + f * 0.7), -2, 11 * (0.3 + f * 0.7), 14, sx * 0.4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#3a1d05'; ctx.fillRect(-1.5, -9, 3, 20); ctx.restore();
  }
}

function drawWire(ctx) {
  ctx.strokeStyle = 'rgba(20,20,30,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, skyY(282));
  ctx.quadraticCurveTo(V.WW / 2, skyY(330), V.WW + 10, skyY(282));
  ctx.stroke();
}

function drawButterfly(ctx, bird, time) {
  const f = Math.abs(Math.sin(bird.flap * 0.6 + bird.id));
  const gy = V.hy + 70, hgt = Math.max(0, Math.min(1, (gy - bird.y) / 500));   // a tiny fluttering shadow on the ground
  ctx.fillStyle = `rgba(30,20,0,${0.16 * (1 - hgt * 0.6)})`; ctx.beginPath(); ctx.ellipse(bird.x, gy, (10 + 8 * f) * (1 - 0.4 * hgt), 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(bird.x, bird.y + Math.sin(time * 4 + bird.id) * 4); ctx.scale(0.8, 0.8);
  for (const [sx, c] of [[-1, '#ff9f40'], [1, '#ff7a2e']]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(sx * 11 * (0.4 + f * 0.6), -4, 14 * (0.4 + f * 0.6), 18, sx * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8fd0ff'; ctx.beginPath(); ctx.ellipse(sx * 9 * (0.4 + f * 0.6), 8, 8 * (0.4 + f * 0.6), 10, -sx * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3a1d05'; roundRect(ctx, -2, -12, 4, 26, 2); ctx.fill();
  ctx.restore();
}

export function drawBird(ctx, bird, time) {
  if (bird.type === 'butterfly') { drawButterfly(ctx, bird, time); return; }
  const look = BIRD_LOOK[bird.type];
  const s = (bird.r / 30) * 1.15;
  const flying = bird.phase !== 'perched';
  const flap = flying ? Math.sin(bird.flap) : 0;
  const bob = flying ? 0 : Math.sin(time * 3 + bird.id) * 1.5;
  ctx.save();
  ctx.translate(bird.x, bird.y + bob);
  if (bird.type === 'goldfinch') {   // a soft golden halo so the rare bird reads at once
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 60 * s);
    halo.addColorStop(0, 'rgba(255,230,120,0.65)'); halo.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(0, 0, 60 * s, 0, Math.PI * 2); ctx.fill();
  }
  ctx.scale(bird.facing * s, s);
  // tail
  ctx.fillStyle = look.wing;
  ctx.beginPath();
  ctx.moveTo(-20, 2);
  ctx.lineTo(-46, -6);
  ctx.lineTo(-44, 10);
  ctx.closePath();
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -20, 0, 22);
  g.addColorStop(0, look.body);
  g.addColorStop(1, look.belly);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 2, 26, 19, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.arc(20, -12, bird.type === 'owl' ? 16 : 12, 0, Math.PI * 2);
  ctx.fill();
  if (bird.type === 'duck') {
    ctx.fillStyle = '#1f5f3f';
    ctx.beginPath();
    ctx.arc(22, -13, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  if (bird.type === 'owl') {
    ctx.beginPath();
    ctx.moveTo(8, -24);
    ctx.lineTo(12, -36);
    ctx.lineTo(18, -24);
    ctx.moveTo(24, -24);
    ctx.lineTo(30, -36);
    ctx.lineTo(34, -24);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    for (const ex of [14, 27]) {
      ctx.beginPath();
      ctx.arc(ex, -13, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // beak
  ctx.fillStyle = look.beak;
  ctx.beginPath();
  const beakLen = bird.type === 'hummingbird' ? 30 : bird.type === 'duck' ? 16 : 11;
  ctx.moveTo(30, -15);
  ctx.lineTo(30 + beakLen, -11);
  ctx.lineTo(30, -7);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = '#0b0b10';
  ctx.beginPath();
  ctx.arc(bird.type === 'owl' ? 27 : 24, -14, bird.type === 'owl' ? 3 : 2.6, 0, Math.PI * 2);
  ctx.fill();
  if (bird.type === 'owl') {
    ctx.beginPath();
    ctx.arc(14, -13, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // wing
  ctx.fillStyle = look.wing;
  ctx.save();
  ctx.translate(-2, -2);
  ctx.rotate(flying ? -0.5 + flap * 0.9 : 0.15);
  ctx.beginPath();
  ctx.ellipse(-6, flying ? -12 : 4, flying ? 24 : 18, flying ? 10 : 11, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // feet when perched
  if (!flying) {
    ctx.strokeStyle = '#c98a3a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-4, 19);
    ctx.lineTo(-4, 27);
    ctx.moveTo(8, 19);
    ctx.lineTo(8, 27);
    ctx.stroke();
  }
  ctx.restore();
}

// `pos` = where the sling stands (world units); `handleEnd` = how far the handle runs down (default: off the bottom of the world).
function drawSlingshot(ctx, state, pos = SLING, handleEnd = V.WH + 30) {
  const { x, y } = pos;
  const pull = state.aim ? state.aim.pull : { x: 0, y: 0, len: 0 };
  const overshoot = state.snap > 0 ? Math.sin((state.snap / 0.18) * Math.PI) * 26 : 0;
  const pouch = { x: x - pull.x, y: y - pull.y - overshoot };
  const forkL = { x: x - 74, y: y - 46 };
  const forkR = { x: x + 74, y: y - 46 };
  const band = (from, behind) => {
    ctx.strokeStyle = behind ? '#8f1d1d' : '#d9352b';
    ctx.lineWidth = Math.max(5, 11 - pull.len * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo((from.x + pouch.x) / 2, (from.y + pouch.y) / 2 + (pull.len < 10 ? 16 : 0), pouch.x, pouch.y);
    ctx.stroke();
  };
  band(forkR, true);
  // wooden fork
  const wood = ctx.createLinearGradient(x - 80, 0, x + 80, 0);
  const woodColors = WOODS[woodFor(state.stars)].colors;
  wood.addColorStop(0, woodColors[0]);
  wood.addColorStop(0.45, woodColors[1]);
  wood.addColorStop(1, woodColors[2]);
  ctx.strokeStyle = wood;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(x, handleEnd);
  ctx.lineTo(x, y + 92);
  ctx.stroke();
  ctx.lineWidth = 27;
  ctx.beginPath();
  ctx.moveTo(forkL.x, forkL.y);
  ctx.quadraticCurveTo(x - 70, y + 70, x, y + 100);
  ctx.quadraticCurveTo(x + 70, y + 70, forkR.x, forkR.y);
  ctx.stroke();
  // grain + band wraps
  ctx.strokeStyle = 'rgba(60,35,12,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 8 + i * 4, y + 118 + i * 14);
    ctx.lineTo(x - 6 + i * 4, y + 190 + i * 8);
    ctx.stroke();
  }
  ctx.fillStyle = '#23180e';
  for (const f of [forkL, forkR]) {
    roundRect(ctx, f.x - 16, f.y + 2, 32, 12, 5);
    ctx.fill();
  }
  band(forkL, false);
  // leather pouch + stone
  ctx.fillStyle = '#6b3f22';
  ctx.beginPath();
  ctx.ellipse(pouch.x, pouch.y, 24, 17, Math.atan2(pull.y, pull.x) + Math.PI / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a2110';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (state.power === 'wide') { ctx.strokeStyle = 'rgba(255,215,90,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(pouch.x, pouch.y - 2, 26 + Math.sin((state.time || 0) * 6) * 3, 0, Math.PI * 2); ctx.stroke(); }
  if (state.stonesLeft > 0 && state.snap <= 0) drawStone(ctx, pouch.x, pouch.y - 2, stoneKind(state), state.power === 'wide' ? 1.9 : 1);
}

// Level-1 tutorial: a translucent finger repeatedly drags back from the pouch, shows the arc, and lets
// go. Pure function of state.time (no state, no rng).
function drawTutorialGhost(ctx, state) {
  const cycle = 3.2;
  const t = state.time % cycle;
  const dragTo = { x: SLING.x - 50, y: SLING.y + 120 };
  let f = 0; // 0 = at the pouch, 1 = fully pulled back
  if (t < 0.5) f = 0;
  else if (t < 1.6) f = (t - 0.5) / 1.1;
  else f = 1;
  const fx = SLING.x + (dragTo.x - SLING.x) * f;
  const fy = SLING.y + (dragTo.y - SLING.y) * f;
  const fade = t < 0.3 ? t / 0.3 : t > 2.9 ? Math.max(0, (cycle - t) / 0.3) : 1;
  ctx.save();
  ctx.globalAlpha = 0.85 * fade;
  if (t >= 1.6 && t < 2.9) {
    const pull = { x: SLING.x - dragTo.x, y: SLING.y - dragTo.y, len: Math.hypot(SLING.x - dragTo.x, SLING.y - dragTo.y) };
    previewArc(pull, 0, 12).forEach((d, i) => {
      ctx.fillStyle = `rgba(255,255,255,${0.9 - i * 0.05})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6 - i * 0.25, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  // fingertip: soft halo + rounded pad
  const halo = ctx.createRadialGradient(fx, fy, 4, fx, fy, 44);
  halo.addColorStop(0, 'rgba(255,255,255,0.75)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(fx, fy, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,224,190,0.95)';
  roundRect(ctx, fx - 15, fy - 6, 30, 58, 15);
  ctx.fill();
  ctx.restore();
}

// Stones unlock with stars (index = stoneFor(stars)): river pebble, clay ball, river glass.
export const STONES = [
  { name: 'River pebble', light: '#e6e6e6', dark: '#6f747c' },
  { name: 'Clay ball', light: '#f0b184', dark: '#8a4a24' },
  { name: 'River glass', light: '#d9fff8', dark: '#2a8f86' },
  { name: 'Ember', light: '#ffd0a0', dark: '#c2410c' },
  { name: 'Moonstone', light: '#f4f6ff', dark: '#6f7fb8' },
  { name: 'Sunstone', light: '#fff2a8', dark: '#d98a00' },
  { name: 'Starlight', light: '#ffffff', dark: '#b27cff' },
];

function drawStone(ctx, x, y, kind = 0, k = 1) {
  const st = STONES[kind] ?? STONES[0];
  const R0 = STONE_R * k;
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, R0 + 2);
  g.addColorStop(0, st.light);
  g.addColorStop(1, st.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R0, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 2 || kind >= 5) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx, state, L) {
  const H = L.hud, spec = state.spec;
  ctx.save();
  ctx.textBaseline = 'middle';
  const pill = (r) => { ctx.fillStyle = 'rgba(10,12,20,0.42)'; roundRect(ctx, r.x, r.y, r.w, r.h, 22); ctx.fill(); };
  const daily = state.mode === 'daily';
  const hawk = state.boss && !state.boss.gone ? Math.max(0, state.boss.hp) : 0;
  const quotaText = state.mode === 'zen' ? `${state.hits} birds sent off` : spec.boss && state.mode !== 'daily' ? `HAWK  ${'♥'.repeat(hawk)}${'♡'.repeat(Math.max(0, 5 - hawk))}` : daily ? `${state.hits} birds` : `${Math.min(state.hits, spec.quota)} / ${spec.quota} birds`;
  if (!H.land) {
    pill(H.bar);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '800 38px system-ui, sans-serif'; ctx.fillText(String(state.score), H.score.x, H.score.y);
    ctx.font = '600 20px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(daily ? 'DAILY HUNT' : `LEVEL ${state.level}`, H.level.x, H.level.y);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 26px system-ui, sans-serif'; ctx.fillText(quotaText, H.quota.x, H.quota.y);
    if (state.combo > 1) { ctx.fillStyle = '#ffd75a'; ctx.font = '800 22px system-ui, sans-serif'; ctx.fillText(`COMBO x${comboMultiplier(state.combo)}`, H.combo.x, H.combo.y); }
  } else {
    pill(H.lp); pill(H.cp);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = '800 34px system-ui, sans-serif'; ctx.fillText(String(state.score), H.score.x, H.score.y);
    ctx.font = '600 17px system-ui, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(daily ? 'DAILY HUNT' : `LEVEL ${state.level}`, H.level.x, H.level.y);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = '700 24px system-ui, sans-serif'; ctx.fillText(quotaText, H.quota.x, H.quota.y);
    if (state.combo > 1) { ctx.fillStyle = '#ffd75a'; ctx.font = '800 20px system-ui, sans-serif'; ctx.fillText(`COMBO x${comboMultiplier(state.combo)}`, H.combo.x, H.combo.y); }
    if (state.wind !== 0) pill(H.rp);
  }
  // a quiet cue while a predator is about (and while the crop is guarded)
  if (state.predator || state.guardT > 0 || state.falconHits > 0) {
    const base = state.predator && state.predator.phase !== 'flinch' ? (state.predator.kind === 'falcon' ? '🦅 Falcon hunting' : '🦅 Hawk hunting') : state.guardT > 0 ? '🛡 Crop guarded' : '🦅';
    const label = state.falconHits > 0 ? `${base}${base === '🦅' ? ' ' : ' · '}hit ×${state.falconHits}` : base;
    const x = H.land ? H.lp.x : H.bar.x, y = H.land ? H.lp.y + H.lp.h + 8 : H.bar.y + H.bar.h + (state.spec.n >= CROP_DRAIN_FROM_LEVEL && !state.spec.boss ? 32 : 8);
    ctx.font = '700 18px system-ui, sans-serif'; const w = ctx.measureText(label).width + 28;
    ctx.fillStyle = 'rgba(10,12,20,0.5)'; roundRect(ctx, x, y, w, 30, 15); ctx.fill();
    ctx.fillStyle = '#ffe9b0'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x + 14, y + 16);
  }
  // wind
  if (state.wind !== 0) {
    const dir = state.wind > 0 ? 1 : -1;
    const cx = H.wind.x;
    const ay = H.land ? H.wind.y : H.wind.y + 14;
    ctx.strokeStyle = '#bfe3ff';
    ctx.fillStyle = '#bfe3ff';
    ctx.lineWidth = 5;
    const len = 18 + (Math.abs(state.wind) / 140) * 34;
    ctx.beginPath(); ctx.moveTo(cx - (dir * len) / 2, ay); ctx.lineTo(cx + (dir * len) / 2, ay); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + (dir * len) / 2 + dir * 12, ay); ctx.lineTo(cx + (dir * len) / 2, ay - 10); ctx.lineTo(cx + (dir * len) / 2, ay + 10); ctx.closePath(); ctx.fill();
    ctx.font = '600 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('WIND', cx, H.wind.ly);
  }
  // crop meter
  if (!daily && !spec.boss && spec.n >= CROP_DRAIN_FROM_LEVEL) {
    const c = H.crop;
    ctx.fillStyle = 'rgba(10,12,20,0.42)'; roundRect(ctx, c.x, c.y, c.w, c.h, c.h / 2); ctx.fill();
    const frac = state.crop / CROP_MAX;
    ctx.fillStyle = frac > 0.5 ? '#8fdc5a' : frac > 0.25 ? '#ffc93f' : '#ff6b5a';
    roundRect(ctx, c.x + 2, c.y + 2, Math.max(8, (c.w - 4) * frac), c.h - 4, (c.h - 4) / 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = '600 16px system-ui, sans-serif'; ctx.textAlign = 'right'; ctx.fillText('CROP', c.x - 10, c.y + c.h / 2);
  }
  // stones left
  const sr = H.stones;
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(10,12,20,0.42)'; roundRect(ctx, sr.x, sr.y, state.mode === 'zen' ? 170 : sr.w, sr.h, 22); ctx.fill();
  if (state.mode === 'zen') {
    ctx.fillStyle = '#fff'; ctx.font = '800 26px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('∞  stones', sr.x + 20, sr.y + 33);
    button(ctx, L.btn.zenDone, 'Done', 'ghost');
  }
  const shown = state.mode === 'zen' ? 0 : Math.min(state.stonesLeft, 12);
  for (let i = 0; i < shown; i++) drawStone(ctx, sr.x + 26 + i * 21, sr.y + 32, stoneKind(state));
  if (state.stonesLeft > 12 && state.mode !== 'zen') { ctx.fillStyle = '#fff'; ctx.font = '700 20px system-ui, sans-serif'; ctx.fillText(`+${state.stonesLeft - 12}`, sr.x + 26 + 12 * 21, sr.y + 33); }
  button(ctx, L.btn.playColors, '🎨', 'ghost');
  button(ctx, L.btn.sound, state.muted ? '🔇' : '🔊', 'ghost');
  button(ctx, L.btn.menu, 'Menu', 'ghost');
  ctx.restore();
}

function title(ctx, text, x, y, size) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fff6dc';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'rgba(16,20,34,0.78)';
  roundRect(ctx, x, y, w, h, 30);
  ctx.fill();
  ctx.restore();
}

function centered(ctx, text, x, y, font, color, maxW) {
  fitFont(ctx, text, font, maxW);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// Wraps `text` centred at cx starting at y, returns the y just below the last line drawn.
function wrapCentered(ctx, text, cx, y, font, color, maxW, lh = 32) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const words = text.split(' ');
  let line = '', ly = y;
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width > maxW && line) { ctx.fillText(line, cx, ly); line = w; ly += lh; }
    else line = cand;
  }
  ctx.fillText(line, cx, ly);
  return ly + lh;
}

// Auto Play: the real game is rendered by a completely separate instance (`apGame`, built in game.js's startAutoplay() - its own
// state, storage, audio, never the real player's), then a control band is drawn on top.
function drawAutoplay(ctx, state, apGame, L) {
  if (apGame) apGame.render(ctx);
  const A = state.ap;
  if (!A) return;
  const P = L.ap, apState = apGame ? apGame.getState() : null;
  const left = Math.max(0, AP_THINK_STEPS[state.apThinkIdx] - A.t);
  const phaseText = A.phase === 'finished' ? "That run is over - here's the tally below."
    : A.paused ? 'Paused'
    : A.phase === 'idle' ? 'Watching the field for the next bird…'
    : A.phase === 'think' ? `Think: what shot would you take? (${left.toFixed(1)}s)`
    : A.phase === 'reveal' ? 'Here is the aim about to be loosed…'
    : apState && apState.stones.length ? 'Loosed - watching it fly…' : 'Watching it land…';
  ctx.fillStyle = 'rgba(6,10,4,0.82)';
  roundRect(ctx, P.band.x, P.band.y, P.band.w, P.band.h, 20);
  ctx.fill();
  centered(ctx, `Auto Play — ${phaseText}`, P.head.x, P.head.y, '700 20px system-ui, sans-serif', '#ffe9b0', P.band.w - 30);
  if (A.phase === 'finished') {
    centered(ctx, L.land ? 'Tap "Play again" for another run, or "Home" to leave.' : 'Tap "Play again" for another run, or "Home" to leave (below).', P.hint.x, P.hint.y, '600 19px system-ui, sans-serif', '#ffe9b0', P.band.w - 30);
    return;
  }
  button(ctx, P.exit, 'Exit', 'ghost');
  button(ctx, P.pause, A.paused ? 'Resume' : 'Pause', A.paused ? 'primary' : 'ghost');
  button(ctx, P.skip, 'Skip', 'ghost');
  button(ctx, P.dec, '−', 'ghost', state.apThinkIdx === 0);
  button(ctx, P.inc, '+', 'ghost', state.apThinkIdx === AP_THINK_STEPS.length - 1);
  centered(ctx, `Think time: ${AP_THINK_STEPS[state.apThinkIdx]}s`, P.think.x, P.think.y, '700 19px system-ui, sans-serif', '#ffe9b0', 146);
}

// Rules-page scroll limits, measured while drawing and read by game.js to clamp scrolling.
export const rulesMetrics = { max: 0, view: 0 };
// Rules layout cache (wrapped lines + total height). rulesStats.layouts counts rebuilds (tests read it).
const rulesCache = { key: '', items: [], endY: 0 };
export const rulesStats = { layouts: 0 };

// One Rules illustration (bird portrait or a small demo), drawn live (the bird and slingshot animate) only while on screen.
function drawRulesArt(ctx, state, RL, card, titleScale, page, boxTop, boxH) {
  const cx = RL.cx;
  if (page.bird) {
    const def = BIRDS[page.bird];
    drawBird(ctx, { type: page.bird, r: def.r, x: cx, y: boxTop + 110, phase: 'perched', flap: 0, facing: 1, id: 0 }, state.time);
  } else if (page.demo === 'aim') {
    // The real slingshot illustration, framed as a window onto the actual in-game view.
    ctx.save();
    roundRect(ctx, cx - Math.min(RL.textW, card.w - 20) / 2, boxTop, Math.min(RL.textW, card.w - 20), boxH, 18);
    ctx.clip();
    const pos = { x: cx, y: boxTop + 15 + 46 };
    const pull = { x: 66, y: -96, len: 116 };
    const dots = previewArc(pull, 0, 7, 0.06, pos);
    dots.forEach((d, i) => {
      ctx.fillStyle = `rgba(255,255,255,${0.9 - (i / dots.length) * 0.65})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6 - (i / dots.length) * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    drawSlingshot(ctx, { stars: 0, snap: 0, stonesLeft: 1, aim: { pull } }, pos, boxTop + boxH);
    ctx.restore();
  } else if (page.demo === 'combo') {
    const labels = ['+10', '+15  x1.5', '+20  x2'];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    labels.forEach((l, i) => {
      const x = cx - 180 + i * 180;
      drawStone(ctx, x, boxTop + 70, 0);
      ctx.font = `800 ${Math.round(22 * titleScale)}px system-ui, sans-serif`;
      ctx.fillStyle = i === 2 ? '#ffd75a' : '#fff';
      ctx.fillText(l, x, boxTop + 120);
    });
  } else if (page.demo === 'wind') {
    const cyy = boxTop + 80, len = 70;
    ctx.strokeStyle = '#bfe3ff';
    ctx.fillStyle = '#bfe3ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx - len / 2, cyy);
    ctx.lineTo(cx + len / 2, cyy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + len / 2 + 16, cyy);
    ctx.lineTo(cx + len / 2, cyy - 16);
    ctx.lineTo(cx + len / 2, cyy + 16);
    ctx.closePath();
    ctx.fill();
  } else if (page.demo === 'upgrades') {
    const names = ['River pebble', 'Clay ball', 'River glass'];
    names.forEach((n, i) => {
      const x = cx - 180 + i * 180;
      drawStone(ctx, x, boxTop + 70, i);
      ctx.font = `600 ${Math.round(18 * titleScale)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(n, x, boxTop + 110);
    });
  }
}


// The Rules reference page: one framed reader card (header with the A-/A+ stepper, fixed page title, a SCROLLING body, page counter)
// and Back / Next below. Text zoom up to 300 % always stays reachable by scrolling.
function drawRules(ctx, state, L) {
  const scheme = SCHEMES[state.scheme] ?? SCHEMES[0];
  ctx.save(); ctx.scale(V.z, V.z);
  drawSky(ctx, scheme, state.time);
  drawHills(ctx, scheme, state.time);
  drawField(ctx, 'wheat', state.time, 0);
  ctx.restore();
  ctx.fillStyle = 'rgba(8,10,18,0.5)';
  ctx.fillRect(0, 0, L.w, L.h);

  const RL = L.rules, card = RL.card, vp = RL.viewport, land = L.land;
  const scale = TEXT_SCALES[state.textScaleIdx] ?? 1;
  const secs = flowRules();

  roundRect(ctx, card.x, card.y, card.w, card.h, 30);
  const cardFill = ctx.createLinearGradient(0, card.y, 0, card.y + card.h);
  cardFill.addColorStop(0, 'rgba(14,18,32,0.6)');
  cardFill.addColorStop(1, 'rgba(6,8,16,0.76)');
  ctx.fillStyle = cardFill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,246,220,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, card.x + 6, card.y + 6, card.w - 12, card.h - 12, 24);
  ctx.strokeStyle = 'rgba(255,246,220,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();

  centered(ctx, 'Rules', RL.cx, RL.headerY, `900 ${Math.round((land ? 38 : 46) * Math.min(scale, 1.15))}px system-ui, sans-serif`, '#fff6dc');
  ctx.strokeStyle = 'rgba(255,246,220,0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(card.x + 60, card.y + RL.hdr.sepY);
  ctx.lineTo(card.x + card.w - 60, card.y + RL.hdr.sepY);
  ctx.stroke();
  // Section titles are inline in the scrolling body; their font is capped at 1.3x so every title stays inside the card at every zoom step.
  const titleScale = Math.min(scale, 1.3);

  // ---- scrolling body ----
  const sc = Math.max(0, Math.min(state.rulesScroll || 0, rulesMetrics.max));
  const origin = vp.y + 8;
  const fontPx = Math.round(29 * scale), lh = Math.round(fontPx * 1.42), gap = Math.round(10 * scale);
  // The wrapped document is laid out once per (text size, geometry, font) and reused; a frame draws only the visible slice.
  ctx.font = '800 40px system-ui, sans-serif'; const fontKey = ctx.measureText('Hamburgefonstiv').width;   // changes if the system font changes
  const key = [scale, vp.x, vp.y, vp.w, vp.h, card.w, RL.cx, RL.textW, fontKey].join('|');
  if (rulesCache.key !== key) {
    rulesStats.layouts++;
    const items = []; let y = origin + 6;
    secs.forEach((page, si) => {
      if (si > 0) y += Math.round(30 * scale);
      fitFont(ctx, page.title, `800 ${Math.round(32 * titleScale)}px system-ui, sans-serif`, card.w - 60);
      items.push({ k: 't', str: page.title, y: y + Math.round(24 * titleScale), font: ctx.font });
      y += Math.round(58 * titleScale);
      if (page.bird || page.demo) {
        items.push({ k: 'art', page, top: y, h: 220 + 26 });
        y = y + 220 + 26;
      } else y += Math.round(18 * scale);
      y += lh / 2;
      for (const line of page.paras) {
        ctx.font = `500 ${fontPx}px system-ui, sans-serif`;
        const ls = []; let cur = '';
        for (const w of line.split(' ')) { const cand = cur ? `${cur} ${w}` : w; if (ctx.measureText(cand).width > RL.textW && cur) { ls.push(cur); cur = w; } else cur = cand; }
        ls.push(cur);
        items.push({ k: 'l', ls, y });
        y += ls.length * lh + gap;
      }
      y -= lh / 2;
    });
    rulesCache.key = key; rulesCache.items = items; rulesCache.endY = y;
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  ctx.translate(0, -sc);
  const vtop = vp.y + sc - 60, vbot = vp.y + vp.h + sc + 60;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const it of rulesCache.items) {
    if (it.k === 't') {
      if (it.y < vtop || it.y > vbot) continue;
      ctx.font = it.font; ctx.fillStyle = '#ffd75a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.str, RL.cx, it.y);
    } else if (it.k === 'l') {
      if (it.y + it.ls.length * lh < vtop || it.y > vbot) continue;
      ctx.font = `500 ${fontPx}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      it.ls.forEach((ln, i) => { const ly = it.y + i * lh; if (ly > vtop && ly < vbot) ctx.fillText(ln, RL.cx, ly); });
    } else if (it.top + it.h >= vtop && it.top <= vbot) drawRulesArt(ctx, state, RL, card, titleScale, it.page, it.top, 220);
  }
  const y = rulesCache.endY;
  ctx.restore();
  const contentH = y - origin + 16;
  rulesMetrics.max = contentH - vp.h <= 8 ? 0 : Math.ceil(contentH - vp.h);
  rulesMetrics.view = vp.h;
  if (rulesMetrics.max > 0) {   // scroll bar
    const sb = RL.scrollbar, th = Math.max(48, (sb.h * vp.h) / contentH), ty = sb.y + (sc / rulesMetrics.max) * (sb.h - th);
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; roundRect(ctx, sb.x, sb.y, sb.w, sb.h, 5); ctx.fill();
    ctx.fillStyle = 'rgba(255,215,90,0.75)'; roundRect(ctx, sb.x, ty, sb.w, th, 5); ctx.fill();
  }

  if (rulesMetrics.max > 0) centered(ctx, sc >= rulesMetrics.max - 1 ? 'End' : 'Scroll or tap Next for more', RL.cx, RL.counterY, '600 22px system-ui, sans-serif', 'rgba(255,255,255,0.65)');
  button(ctx, RL.back, 'Back', 'ghost');
  button(ctx, RL.next, rulesMetrics.max <= 0 || sc >= rulesMetrics.max - 1 ? 'Done' : 'Next', 'primary');
  button(ctx, RL.dec, 'A−', 'ghost', state.textScaleIdx === 0);
  button(ctx, RL.inc, 'A+', 'ghost', state.textScaleIdx === TEXT_SCALES.length - 1);
}

// Automatic quality degrade: the time between frames is averaged; when it rises (a slow phone with many birds + the predator) the motion ghosts go first, then the
// dust motes and god-rays. It recovers when frames are fast again. Purely visual, never touches the simulation.
export const QUALITY = { level: 0, ema: 16.7, last: 0 };
const AMBIENT = { off: false };   // set per frame: ambient life is off in Calm
function trackQuality() {
  const now = globalThis.performance?.now?.() ?? 0;
  if (QUALITY.last && now > QUALITY.last) {
    const dt = Math.min(100, now - QUALITY.last);
    QUALITY.ema += (dt - QUALITY.ema) * 0.05;
    if (QUALITY.ema > 27) QUALITY.level = 2; else if (QUALITY.ema > 21) QUALITY.level = Math.max(QUALITY.level, 1); else if (QUALITY.ema < 18.5) QUALITY.level = 0;
  }
  QUALITY.last = now;
}

export function drawGame(ctx, state, manifest, day, apGame, L) {
  trackQuality();
  AMBIENT.off = !!state.calm;
  if (state.scene === 'rules') { drawRules(ctx, state, L); return; }
  if (state.scene === 'autoplay') { drawAutoplay(ctx, state, apGame, L); return; }
  const scheme = state.mode === 'daily' && state.scene !== 'title' ? SCHEMES[(day * 3) % (SCHEMES.length - 1)] : (SCHEMES[state.scheme] ?? SCHEMES[0]);   // the Daily Hunt wears a different light each day
  LEAF.cols = scheme.leaf ?? ['#2f6b2f', '#4c9a3f', '#7cc65a'];
  const time = state.time;
  const worldName = state.world?.world ?? 'wheat';
  // ---- the world (scaled by z) ----
  ctx.save();
  ctx.scale(V.z, V.z);
  const PR = state.predator;
  if (PR && PR.push > 0.001) { const zz = 1 + 0.035 * PR.push, cx = SLING.x, cy = SLING.y; ctx.translate(cx, cy); ctx.scale(zz, zz); ctx.translate(-cx, -cy); }   // camera push (<= 3.5 %), centred on the sling so aiming stays true
  if (state.shake > 0) ctx.translate(Math.sin(state.time * 90) * state.shake * 0.6, Math.cos(state.time * 77) * state.shake * 0.6);   // subtle: <= ~8 units
  drawSky(ctx, scheme, time);
  drawHills(ctx, scheme, state.time);
  if (state.world?.hasWire) drawWire(ctx);
  if (state.world) for (const tree of state.world.trees) drawTree(ctx, tree, time, state.wind, worldName);
  drawField(ctx, worldName, time, state.wind);
  if (state.world) drawFence(ctx, state.world, state.scareT, time);
  drawRabbit(ctx, time);
  drawWindSpecks(ctx, time, state.wind, scheme, worldName);
  for (const S of state.sitters || []) if (S.state !== 'gone' && S.state !== 'away') drawPerched(ctx, S, time, BIRD_LOOK, V);
  for (const bird of state.birds) drawBird(ctx, bird, time);
  if (state.predator) drawPredator(ctx, state.predator, time, BIRD_LOOK, V, 0, QUALITY.level);
  for (const s of state.stones) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s.px - s.vx * 0.02, s.py - s.vy * 0.02);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    if (s.trail) s.trail.forEach((t, i) => { ctx.fillStyle = `rgba(255,${s.wide ? 215 : 240},${s.wide ? 120 : 200},${(i / s.trail.length) * 0.4})`; ctx.beginPath(); ctx.arc(t.x, t.y, (s.wide ? 11 : 6) * (i / s.trail.length), 0, Math.PI * 2); ctx.fill(); });
    drawStone(ctx, s.x, s.y, stoneKind(state), s.wide ? 1.9 : 1);
  }
  for (const p of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 1.6);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = scheme.tint;
  ctx.fillRect(-20, -20, V.WW + 40, V.WH + 40);
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,236,160,${Math.min(0.4, state.flash)})`; ctx.fillRect(-20, -20, V.WW + 40, V.WH + 40); }
  if (state.breathe && state.scene === 'playing') {   // Calm: breathe: a very slow glow (~5 s in, ~5 s out); nothing flashes, no sound
    const ph = 0.5 - 0.5 * Math.cos((state.breatheT / 10) * Math.PI * 2);
    const gg = ctx.createRadialGradient(SLING.x, SLING.y - 120, 20, SLING.x, SLING.y - 120, 420 + 120 * ph);
    gg.addColorStop(0, `rgba(255,236,170,${0.05 + 0.1 * ph})`); gg.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = gg; ctx.fillRect(-20, -20, V.WW + 40, V.WH + 40);
    ctx.strokeStyle = `rgba(255,243,190,${0.18 + 0.3 * ph})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(SLING.x, SLING.y, 52 + 26 * ph, 0, Math.PI * 2); ctx.stroke();
  }
  if (PR && PR.fx > 0) { ctx.fillStyle = `rgba(20,16,40,${0.1 * PR.fx * (PR.phase === 'leave' ? 0.4 : 1)})`; ctx.fillRect(-20, -20, V.WW + 40, V.WH + 40); }   // the sky darkens a hair
  if (state.slowT > 0) { ctx.fillStyle = 'rgba(120,170,255,0.10)'; ctx.fillRect(-20, -20, V.WW + 40, V.WH + 40); }
  const playing = state.scene === 'playing' || state.scene === 'levelclear';
  if (playing) {
    if (state.aim && state.aim.pull.len >= SLING.minPull) {
      const dots = previewArc(state.aim.pull, state.wind, state.spec.guideDots + (state.missStreak >= MISS_ASSIST ? 8 : 0));
      dots.forEach((d, i) => {
        ctx.fillStyle = `rgba(255,255,255,${0.9 - (i / dots.length) * 0.65})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, 6 - (i / dots.length) * 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    drawSlingshot(ctx, state);
    for (const p of state.popups) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.font = `800 ${p.size ?? 30}px system-ui, sans-serif`;
      ctx.fillStyle = p.bad ? '#ff8a7a' : p.gold ? '#ffd75a' : '#fff3b0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, Math.max(90, Math.min(V.WW - 90, p.x)), p.y);
      ctx.globalAlpha = 1;
    }
    if (state.scene === 'playing' && state.level === 1 && state.tally.thrown === 0 && !state.aim) {
      centered(ctx, 'Drag back from the slingshot, then release', SLING.x, SLING.y - 60, '600 26px system-ui, sans-serif', 'rgba(255,255,255,0.92)', V.WW - 60);
      if (state.mode === 'campaign') drawTutorialGhost(ctx, state);
    } else if (state.scene === 'playing' && state.level === 1 && state.hits === 0 && !state.aim && state.mode === 'campaign') {
      centered(ctx, 'Aim at a bird - the dots show your path', SLING.x, SLING.y - 60, '600 26px system-ui, sans-serif', 'rgba(255,255,255,0.92)', V.WW - 60);
    }
  }
  if (state.scene === 'title' && L.title.sling) drawSlingshot(ctx, state, L.title.sling);
  else if (state.scene === 'title') drawSlingshot(ctx, state);
  ctx.restore();

  // ---- screen furniture ----
  if (playing) drawHud(ctx, state, L);

  if (state.scene === 'levelclear') {
    const f = L.centerFrame;
    ctx.save(); ctx.translate(f.ox, f.oy);
    panel(ctx, 90, 440, 540, 300);
    centered(ctx, `Level ${state.level} clear!`, 360, 510, '800 46px system-ui, sans-serif', '#fff');
    centered(ctx, '★'.repeat(state.lastStars) + '☆'.repeat(3 - state.lastStars), 360, 600, '700 80px system-ui, sans-serif', '#ffd75a');
    centered(ctx, `+${state.stonesLeft * 5} for stones saved`, 360, 690, '600 24px system-ui, sans-serif', 'rgba(255,255,255,0.8)');
    if (state.restNote) centered(ctx, 'A moment to rest your eyes? Look far away for a little while.', 360, 760, '500 22px system-ui, sans-serif', 'rgba(200,230,255,0.95)', 520);
    if (state.newWood >= 0) centered(ctx, `New slingshot unlocked: ${WOODS[state.newWood].name}!`, 360, 725, '700 26px system-ui, sans-serif', '#ffd75a', 500);
    else if (state.newStone >= 0) centered(ctx, `New stone unlocked: ${STONES[state.newStone].name}!`, 360, 725, '700 26px system-ui, sans-serif', '#ffd75a', 500);
    ctx.restore();
  }

  if (state.scene === 'title') {
    const T = L.title, f = T.f, r = T.r;
    ctx.save(); ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
    title(ctx, manifest.title, T.title.x, T.title.y, T.title.size);
    centered(ctx, manifest.tagline ?? '', T.tag.x, T.tag.y, `600 ${Math.round(T.tag.size)}px system-ui, sans-serif`, 'rgba(255,255,255,0.92)', L.land ? 480 : 640);
    centered(ctx, `★ ${state.stars}     Best ${state.best}     Level ${state.highestLevel}${state.visit.count > 0 ? `     🔥 Day ${state.visit.count}` : ''}`, T.stats.x, T.stats.y, `700 ${Math.round(T.stats.size)}px system-ui, sans-serif`, '#fff3b0', L.land ? 480 : 640);
    const nextGift = STREAK_GIFTS.find((d) => d > (state.bestVisit || 0));
    const gift = state.giftNote || (nextGift ? `Come back each day: a new stone skin waits on day ${nextGift}` : '');
    if (gift) centered(ctx, gift, T.stats.x, T.stats.y + (L.land ? 34 : 38), `600 ${L.land ? 17 : 20}px system-ui, sans-serif`, state.giftNote ? '#ffd75a' : 'rgba(255,243,176,0.8)', L.land ? 480 : 640);
    button(ctx, r.play, state.highestLevel > 1 && !state.demo ? `Play — Level ${state.highestLevel}` : 'Play', 'primary');
    const playedToday = state.daily.day === day;
    button(ctx, r.daily, state.demo ? 'Daily Hunt — in the app' : playedToday ? `Daily done: ${state.daily.score}  🔥${state.daily.streak}` : `Daily Hunt${state.daily.streak ? `  🔥${state.daily.streak}` : ''}`, 'ghost', state.demo || playedToday);
    button(ctx, r.endless, state.demo ? 'Endless' : 'Endless', 'ghost', state.demo);
    button(ctx, r.zen, '🌿 Zen', 'ghost', state.demo);
    button(ctx, r.colors, `🎨 Light: ${scheme.name}`, 'ghost');
    button(ctx, r.rules, '📖 Rules', 'ghost');
    button(ctx, r.calm, `🌿 Calm: ${state.calm ? (state.breathe ? 'breathe' : 'on') : 'off'}`, 'ghost');
    button(ctx, r.auto, '🎬 Auto Play — watch and learn', 'ghost');
    button(ctx, r.soundTitle, state.muted ? '🔇' : '🔊', 'ghost');
    ctx.restore();
    drawLockup(ctx, L.brand.x, L.brand.y, L.brand.size, { align: L.brand.align });
  }

  if (state.scene === 'tally') {
    const Tl = L.tally, f = Tl.f, r = Tl.r;
    ctx.save(); ctx.translate(f.ox, f.oy); ctx.scale(f.s, f.s);
    panel(ctx, r.panel.x, r.panel.y, r.panel.w, r.panel.h);
    centered(ctx, state.mode === 'daily' ? 'Daily Hunt' : "Day's Tally", r.title.x, r.title.y, `800 ${r.title.size}px system-ui, sans-serif`, '#fff');
    centered(ctx, String(state.score), r.score.x, r.score.y, `900 ${r.score.size}px system-ui, sans-serif`, '#ffd75a');
    centered(ctx, state.score >= state.best && state.score > 0 && state.mode !== 'zen' ? 'New best!' : `Best ${state.best}`, r.best.x, r.best.y, '600 24px system-ui, sans-serif', 'rgba(255,255,255,0.8)');
    const acc = state.tally.thrown ? Math.round((state.tally.hit / state.tally.thrown) * 100) : 0;
    const lines = [`Reached level ${state.level}`, `Birds scared off: ${state.tally.hit}`, `Accuracy: ${acc}%`, `Best combo: ${state.bestCombo}`];
    lines.forEach((l, i) => centered(ctx, l, r.lines.x, r.lines.y0 + i * r.lines.dy, `600 ${r.lines.size}px system-ui, sans-serif`, '#fff'));
    const kinds = Object.entries(state.tally.byType).map(([k, v]) => `${k} ${v}`).join('   ');
    centered(ctx, kinds, r.kinds.x, r.kinds.y, '500 22px system-ui, sans-serif', 'rgba(255,255,255,0.75)', r.panel.w * (L.land ? 0.5 : 0.9));
    // shot-by-shot squares (the Daily Hunt share pattern)
    const shots = state.shots.slice(0, DAILY.stones + 10);
    const per = 12;
    shots.forEach((s, i) => {
      ctx.fillStyle = s === 'hit' ? '#6fdc6a' : s === 'owl' ? '#ff6b5a' : 'rgba(255,255,255,0.28)';
      roundRect(ctx, r.squares.cx - (per * 34) / 2 + (i % per) * 34, r.squares.y + Math.floor(i / per) * 34, 28, 28, 6);
      ctx.fill();
      // Colour-blind safe: every square also carries a mark (hit tick, owl cross, miss dot).
      ctx.fillStyle = s === 'miss' ? 'rgba(255,255,255,0.7)' : '#0d2b12';
      ctx.font = '800 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s === 'hit' ? '✓' : s === 'owl' ? '✕' : '·', r.squares.cx - (per * 34) / 2 + (i % per) * 34 + 14, r.squares.y + Math.floor(i / per) * 34 + 15);
    });
    if (state.summary) centered(ctx, state.summary, r.msg.x, r.msg.y, '600 20px system-ui, sans-serif', 'rgba(255,243,176,0.9)', r.panel.w * (L.land ? 0.46 : 0.88));
    if (state.restNote) centered(ctx, 'A moment to rest your eyes? Look far away for a little while.', r.msg.x, r.msg.y + (L.land ? 26 : 28), '500 18px system-ui, sans-serif', 'rgba(200,230,255,0.9)', r.panel.w * (L.land ? 0.46 : 0.88));
    drawMoreLine(ctx, r.more.x, r.more.y, L.land ? 19 : 22);
    SIBLINGS.forEach((g, i) => button(ctx, r.chips[i], g.title, 'ghost'));
    button(ctx, r.again, 'Play again', 'primary');
    button(ctx, r.share, state.shareNote || 'Share', 'ghost');
    button(ctx, r.home, 'Home', 'ghost');
    if (r.badge) drawBadge(ctx, r.badge.x, r.badge.y, r.badge.size, 0.8);
    ctx.restore();
  }

  if (state.scene === 'demo-limit') {
    const f = L.centerFrame;
    ctx.save(); ctx.translate(f.ox, f.oy);
    panel(ctx, 70, 430, 580, 330);
    centered(ctx, "That's the free preview!", 360, 510, '800 42px system-ui, sans-serif', '#fff', 540);
    centered(ctx, 'Get Golden Sling free on iPhone and', 360, 590, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)', 540);
    centered(ctx, 'Android: every level, Endless and', 360, 628, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)', 540);
    centered(ctx, 'the Daily Hunt.', 360, 666, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)', 540);
    ctx.restore();
  }
}
