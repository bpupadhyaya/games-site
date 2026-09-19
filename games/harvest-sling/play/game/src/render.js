// Every pixel of Golden Sling. Reads state, never changes it. All art is drawn in code.
import { W, H, SLING, STONE_R, CROP_MAX, CROP_DRAIN_FROM_LEVEL, DAILY, comboMultiplier, woodFor, stoneFor, SIBLINGS } from './tuning.js';
import { previewArc } from './physics.js';

export const BUTTONS = {
  play: { x: 140, y: 560, w: 440, h: 112 },
  daily: { x: 140, y: 694, w: 440, h: 92 },
  endless: { x: 140, y: 806, w: 440, h: 92 },
  colors: { x: 140, y: 918, w: 440, h: 80 },
  playColors: { x: 596, y: 1196, w: 108, h: 64 },
  again: { x: 140, y: 1040, w: 440, h: 104 },
  share: { x: 90, y: 1156, w: 250, h: 76 },
  home: { x: 380, y: 1156, w: 250, h: 76 },
  sound: { x: 476, y: 1196, w: 108, h: 64 },
  soundTitle: { x: 610, y: 24, w: 84, h: 64 },
};

// Tally screen: one tappable chip per sibling game (2 x 2 grid).
export const chipRect = (i) => ({ x: 90 + (i % 2) * 280, y: 892 + Math.floor(i / 2) * 72, w: 260, h: 60 });

// Light schemes (index 0 = default look; players can cycle). Colours: sky top/mid/bottom, sun,
// far hill, near hill, light tint drawn over the whole scene.
export const SCHEMES = [
  { name: 'Golden hour', sky: ['#3b6fb5', '#f0a65a', '#ffd98a'], sun: '#fff1c2', hills: ['#7d8f5e', '#5f7a45'], tint: 'rgba(255,170,60,0.10)', ink: '#2a1c0e' },
  { name: 'Dawn', sky: ['#2b3a67', '#e38b8b', '#ffd0a8'], sun: '#ffe3cf', hills: ['#6f7f86', '#4f6a5a'], tint: 'rgba(255,120,120,0.08)', ink: '#1f1a2a' },
  { name: 'Clear noon', sky: ['#1e6fd0', '#6db7f2', '#cfeaff'], sun: '#ffffff', hills: ['#6fa05a', '#4c8a3f'], tint: 'rgba(255,255,255,0.0)', ink: '#10233a' },
  { name: 'Misty morning', sky: ['#8fa6b5', '#c4d3d8', '#eef3f2'], sun: '#ffffff', hills: ['#93a79b', '#73907f'], tint: 'rgba(220,235,235,0.18)', ink: '#22313a' },
  { name: 'Sunset', sky: ['#2a1f4f', '#c4456b', '#ff9a4a'], sun: '#ffd27a', hills: ['#5b4a63', '#3f3a4f'], tint: 'rgba(255,90,60,0.12)', ink: '#1a1024' },
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
  ctx.font = `700 ${Math.round(r.h * 0.36)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

function drawSky(ctx, scheme, time) {
  const g = ctx.createLinearGradient(0, 0, 0, 820);
  g.addColorStop(0, scheme.sky[0]);
  g.addColorStop(0.62, scheme.sky[1]);
  g.addColorStop(1, scheme.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 830);
  const sunX = 540;
  const sunY = 250;
  const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 330);
  glow.addColorStop(0, scheme.sun);
  glow.addColorStop(0.12, scheme.sun);
  glow.addColorStop(0.16, 'rgba(255,240,200,0.45)');
  glow.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 830);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 230 + time * (6 + i * 2)) % (W + 300)) - 150;
    const cy = 110 + i * 62;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + k * 38 - 50, cy + (k % 2) * 8, 54 - k * 5, 20, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHills(ctx, scheme) {
  [[640, 70, 0.006, 0], [720, 50, 0.011, 2]].forEach(([base, amp, freq, phase], i) => {
    ctx.fillStyle = scheme.hills[i];
    ctx.beginPath();
    ctx.moveTo(0, 840);
    for (let x = 0; x <= W; x += 12) ctx.lineTo(x, base - Math.sin(x * freq + phase) * amp - Math.sin(x * freq * 2.7 + phase) * amp * 0.35);
    ctx.lineTo(W, 840);
    ctx.closePath();
    ctx.fill();
  });
}

function drawField(ctx, world, time, wind) {
  const f = FIELDS[world] ?? FIELDS.wheat;
  const g = ctx.createLinearGradient(0, 790, 0, H);
  g.addColorStop(0, f.top);
  g.addColorStop(1, f.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 790, W, H - 790);
  ctx.strokeStyle = f.row;
  ctx.lineWidth = 3;
  for (let i = -8; i <= 8; i++) {
    ctx.beginPath();
    ctx.moveTo(360 + i * 14, 792);
    ctx.lineTo(360 + i * 150, H);
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
      const g = ctx.createLinearGradient(shine - 90, 0, shine + 90, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
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
    for (let i = 0; i < 14; i++) {
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
}

function drawFence(ctx, scene) {
  const y = scene.fenceY;
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
  ctx.lineTo(sx + 64, 702);
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
}

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
  const blobs = [[0, 0, 1], [-0.62, 0.28, 0.72], [0.62, 0.3, 0.74], [-0.3, -0.42, 0.7], [0.34, -0.38, 0.68]];
  for (const [shade, dy] of [['#2f6b2f', 10], ['#4c9a3f', 0], ['#7cc65a', -12]]) {
    ctx.fillStyle = shade;
    for (const [ox, oy, s] of blobs) {
      ctx.beginPath();
      ctx.arc(tree.x + ox * tree.crown + sway, topY + oy * tree.crown + dy, tree.crown * s * (shade === '#7cc65a' ? 0.62 : 0.78), 0, Math.PI * 2);
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
function drawWindSpecks(ctx, time, wind, scheme) {
  const drift = wind === 0 ? 8 : wind * 0.9;
  for (let i = 0; i < 12; i++) {
    const span = W + 160;
    let x = (i * 137 + time * drift) % span;
    if (x < 0) x += span;
    x -= 80;
    const y = 190 + ((i * 89) % 560) + Math.sin(time * 1.4 + i * 1.7) * 26;
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

function drawWire(ctx) {
  ctx.strokeStyle = 'rgba(20,20,30,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 282);
  ctx.quadraticCurveTo(360, 330, W + 10, 282);
  ctx.stroke();
}

function drawBird(ctx, bird, time) {
  const look = BIRD_LOOK[bird.type];
  const s = (bird.r / 30) * 1.15;
  const flying = bird.phase !== 'perched';
  const flap = flying ? Math.sin(bird.flap) : 0;
  const bob = flying ? 0 : Math.sin(time * 3 + bird.id) * 1.5;
  ctx.save();
  ctx.translate(bird.x, bird.y + bob);
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

function drawSlingshot(ctx, state) {
  const { x, y } = SLING;
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
  ctx.moveTo(x, H + 30);
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
  if (state.stonesLeft > 0 && state.snap <= 0) drawStone(ctx, pouch.x, pouch.y - 2, stoneFor(state.stars));
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
];

function drawStone(ctx, x, y, kind = 0) {
  const st = STONES[kind] ?? STONES[0];
  const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, STONE_R + 2);
  g.addColorStop(0, st.light);
  g.addColorStop(1, st.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
  ctx.fill();
  if (kind === 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx, state) {
  ctx.save();
  ctx.fillStyle = 'rgba(10,12,20,0.42)';
  roundRect(ctx, 14, 14, W - 28, 96, 22);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = '800 38px system-ui, sans-serif';
  ctx.fillText(String(state.score), 34, 48);
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(state.mode === 'daily' ? 'DAILY HUNT' : `LEVEL ${state.level}`, 34, 86);
  // quota
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(state.mode === 'daily' ? `${state.hits} birds` : `${Math.min(state.hits, state.spec.quota)} / ${state.spec.quota} birds`, W / 2, 46);
  if (state.combo > 1) {
    ctx.fillStyle = '#ffd75a';
    ctx.font = '800 22px system-ui, sans-serif';
    ctx.fillText(`COMBO x${comboMultiplier(state.combo)}`, W / 2, 84);
  }
  // wind
  if (state.wind !== 0) {
    const dir = state.wind > 0 ? 1 : -1;
    const cx = W - 92;
    ctx.strokeStyle = '#bfe3ff';
    ctx.fillStyle = '#bfe3ff';
    ctx.lineWidth = 5;
    const len = 18 + (Math.abs(state.wind) / 140) * 34;
    ctx.beginPath();
    ctx.moveTo(cx - (dir * len) / 2, 46);
    ctx.lineTo(cx + (dir * len) / 2, 46);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + (dir * len) / 2 + dir * 12, 46);
    ctx.lineTo(cx + (dir * len) / 2, 36);
    ctx.lineTo(cx + (dir * len) / 2, 56);
    ctx.closePath();
    ctx.fill();
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('WIND', cx, 84);
  }
  // crop meter
  if (state.mode !== 'daily' && state.spec.n >= CROP_DRAIN_FROM_LEVEL) {
    const bw = 300;
    const bx = (W - bw) / 2;
    ctx.fillStyle = 'rgba(10,12,20,0.42)';
    roundRect(ctx, bx, 122, bw, 18, 9);
    ctx.fill();
    const frac = state.crop / CROP_MAX;
    ctx.fillStyle = frac > 0.5 ? '#8fdc5a' : frac > 0.25 ? '#ffc93f' : '#ff6b5a';
    roundRect(ctx, bx + 2, 124, Math.max(8, (bw - 4) * frac), 14, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('CROP', bx - 10, 132);
  }
  // stones left
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,12,20,0.42)';
  roundRect(ctx, 14, 1196, 300, 64, 22);
  ctx.fill();
  const shown = Math.min(state.stonesLeft, 12);
  for (let i = 0; i < shown; i++) drawStone(ctx, 40 + i * 21, 1228, stoneFor(state.stars));
  if (state.stonesLeft > 12) {
    ctx.fillStyle = '#fff';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(`+${state.stonesLeft - 12}`, 40 + 12 * 21, 1229);
  }
  button(ctx, BUTTONS.playColors, '🎨', 'ghost');
  button(ctx, BUTTONS.sound, state.muted ? '🔇' : '🔊', 'ghost');
  ctx.restore();
}

function title(ctx, text, y, size, scheme) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px system-ui, sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = '#fff6dc';
  ctx.fillText(text, W / 2, y);
  ctx.restore();
  void scheme;
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

function centered(ctx, text, y, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, y);
}

export function drawGame(ctx, state, manifest, day) {
  const scheme = SCHEMES[state.scheme] ?? SCHEMES[0];
  const time = state.time;
  const worldName = state.world?.world ?? 'wheat';
  drawSky(ctx, scheme, time);
  drawHills(ctx, scheme);
  if (state.world?.hasWire) drawWire(ctx);
  if (state.world) for (const tree of state.world.trees) drawTree(ctx, tree, time, state.wind, worldName);
  drawField(ctx, worldName, time, state.wind);
  if (state.world) drawFence(ctx, state.world);
  drawWindSpecks(ctx, time, state.wind, scheme);
  for (const bird of state.birds) drawBird(ctx, bird, time);
  for (const s of state.stones) {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(s.px - s.vx * 0.02, s.py - s.vy * 0.02);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    drawStone(ctx, s.x, s.y, stoneFor(state.stars));
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
  ctx.fillRect(0, 0, W, H);

  if (state.scene === 'playing' || state.scene === 'levelclear') {
    if (state.aim && state.aim.pull.len >= SLING.minPull) {
      const dots = previewArc(state.aim.pull, state.wind, state.spec.guideDots);
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
      ctx.font = '800 30px system-ui, sans-serif';
      ctx.fillStyle = p.bad ? '#ff8a7a' : '#fff3b0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, Math.max(90, Math.min(W - 90, p.x)), p.y);
      ctx.globalAlpha = 1;
    }
    drawHud(ctx, state);
    if (state.scene === 'playing' && state.level === 1 && state.tally.thrown === 0 && !state.aim) {
      centered(ctx, 'Drag back from the slingshot, then release', 990, '600 26px system-ui, sans-serif', 'rgba(255,255,255,0.92)');
      if (state.mode === 'campaign') drawTutorialGhost(ctx, state);
    }
  }

  if (state.scene === 'levelclear') {
    panel(ctx, 90, 440, W - 180, 300);
    centered(ctx, `Level ${state.level} clear!`, 510, '800 46px system-ui, sans-serif', '#fff');
    centered(ctx, '★'.repeat(state.lastStars) + '☆'.repeat(3 - state.lastStars), 600, '700 80px system-ui, sans-serif', '#ffd75a');
    centered(ctx, `+${state.stonesLeft * 5} for stones saved`, 690, '600 24px system-ui, sans-serif', 'rgba(255,255,255,0.8)');
    if (state.newWood >= 0) centered(ctx, `New slingshot unlocked: ${WOODS[state.newWood].name}!`, 725, '700 26px system-ui, sans-serif', '#ffd75a');
    else if (state.newStone >= 0) centered(ctx, `New stone unlocked: ${STONES[state.newStone].name}!`, 725, '700 26px system-ui, sans-serif', '#ffd75a');
  }

  if (state.scene === 'title') {
    drawSlingshot(ctx, state);
    title(ctx, manifest.title, 250, 84, scheme);
    centered(ctx, manifest.tagline ?? '', 330, '600 28px system-ui, sans-serif', 'rgba(255,255,255,0.92)');
    centered(ctx, `★ ${state.stars}     Best ${state.best}     Level ${state.highestLevel}`, 470, '700 26px system-ui, sans-serif', '#fff3b0');
    button(ctx, BUTTONS.play, state.highestLevel > 1 && !state.demo ? `Play — Level ${state.highestLevel}` : 'Play', 'primary');
    const playedToday = state.daily.day === day;
    button(ctx, BUTTONS.daily, state.demo ? 'Daily Hunt — in the app' : playedToday ? `Daily done: ${state.daily.score}  🔥${state.daily.streak}` : `Daily Hunt${state.daily.streak ? `  🔥${state.daily.streak}` : ''}`, 'ghost', state.demo || playedToday);
    button(ctx, BUTTONS.endless, state.demo ? 'Endless — in the app' : 'Endless', 'ghost', state.demo);
    button(ctx, BUTTONS.colors, `🎨 Light: ${scheme.name}`, 'ghost');
    button(ctx, BUTTONS.soundTitle, state.muted ? '🔇' : '🔊', 'ghost');
  }

  if (state.scene === 'tally') {
    panel(ctx, 60, 190, W - 120, 1060);
    centered(ctx, state.mode === 'daily' ? 'Daily Hunt' : "Day's Tally", 260, '800 52px system-ui, sans-serif', '#fff');
    centered(ctx, String(state.score), 350, '900 84px system-ui, sans-serif', '#ffd75a');
    centered(ctx, state.score >= state.best && state.score > 0 ? 'New best!' : `Best ${state.best}`, 420, '600 24px system-ui, sans-serif', 'rgba(255,255,255,0.8)');
    const acc = state.tally.thrown ? Math.round((state.tally.hit / state.tally.thrown) * 100) : 0;
    const lines = [`Reached level ${state.level}`, `Birds scared off: ${state.tally.hit}`, `Accuracy: ${acc}%`, `Best combo: ${state.bestCombo}`];
    lines.forEach((l, i) => centered(ctx, l, 490 + i * 44, '600 28px system-ui, sans-serif', '#fff'));
    const kinds = Object.entries(state.tally.byType).map(([k, v]) => `${k} ${v}`).join('   ');
    centered(ctx, kinds, 680, '500 22px system-ui, sans-serif', 'rgba(255,255,255,0.75)');
    // shot-by-shot squares (the Daily Hunt share pattern)
    const shots = state.shots.slice(0, DAILY.stones + 10);
    const per = 12;
    shots.forEach((s, i) => {
      ctx.fillStyle = s === 'hit' ? '#6fdc6a' : s === 'owl' ? '#ff6b5a' : 'rgba(255,255,255,0.28)';
      roundRect(ctx, W / 2 - (per * 34) / 2 + (i % per) * 34, 730 + Math.floor(i / per) * 34, 28, 28, 6);
      ctx.fill();
    });
    centered(ctx, 'More from Arcforge', 868, '700 22px system-ui, sans-serif', 'rgba(255,255,255,0.85)');
    SIBLINGS.forEach((g, i) => button(ctx, chipRect(i), g.title, 'ghost'));
    button(ctx, BUTTONS.again, 'Play again', 'primary');
    button(ctx, BUTTONS.share, state.shareNote || 'Share', 'ghost');
    button(ctx, BUTTONS.home, 'Home', 'ghost');
  }

  if (state.scene === 'demo-limit') {
    panel(ctx, 70, 430, W - 140, 330);
    centered(ctx, "That's the free preview!", 510, '800 42px system-ui, sans-serif', '#fff');
    centered(ctx, 'Get Golden Sling free on iPhone and', 590, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)');
    centered(ctx, 'Android: every level, Endless and', 628, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)');
    centered(ctx, 'the Daily Hunt.', 666, '500 26px system-ui, sans-serif', 'rgba(255,255,255,0.85)');
  }
}
