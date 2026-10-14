// Drawing primitives for Hide and Seek: three painted places (backdrop + ground), the hiding-spot sprites, and the children.
// Everything is canvas paths and gradients. A spot sprite is drawn with its feet at (0,0), about 150 wide and 170 tall (before scale).
const TAU = Math.PI * 2;

export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const lg = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const hash = (n) => { let x = Math.imul(n | 0, 0x9e3779b1) ^ 0x85ebca6b; x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d); return ((x ^ (x >>> 12)) >>> 0) / 4294967296; };

// ---- places --------------------------------------------------------------------------------------------------------------
export const THEMES = [
  { // piazza at dusk
    name: 'dusk', sky: ['#5b4a9a', '#e98f7a', '#ffd9a0'], ground: ['#c9ad86', '#9c7c58'], line: 'rgba(80,50,30,0.18)', wall: ['#d8a97c', '#c58a63', '#e3c497', '#b97f6a'],
    roof: '#8e4a3c', stone: '#d8cbb0', stoneD: '#9c8c72', wood: '#8a5a34', woodD: '#55351a', cloth: ['#c8453a', '#2f6f8f', '#e5b94a', '#f3ead8'], leaf: '#4f8a3a', leafD: '#2f5c26',
    glow: 'rgba(255,196,110,0.32)', ink: '#2c1b2e', dim: 0.1,
  },
  { // kampung yard, warm afternoon
    name: 'afternoon', sky: ['#7fd0ee', '#cdeef2', '#fff3c6'], ground: ['#cdaa72', '#a57d49'], line: 'rgba(90,60,20,0.16)', wall: ['#d9c08a', '#b98f55', '#e8d4a0', '#a47c4a'],
    roof: '#7c5a32', stone: '#cbbfa5', stoneD: '#8c7e62', wood: '#9a6a3a', woodD: '#5e3d1d', cloth: ['#d9483a', '#2a8f7a', '#f0c24a', '#fff4dc'], leaf: '#5aa63a', leafD: '#2f6f26',
    glow: 'rgba(255,240,170,0.3)', ink: '#2c2012', dim: 0,
  },
  { // town house, courtyard at evening
    name: 'evening', sky: ['#2f3a68', '#8a6f9a', '#f0b98c'], ground: ['#b8ab94', '#8a806c'], line: 'rgba(40,36,30,0.2)', wall: ['#8a6a4a', '#6f4f34', '#a5845c', '#5c4029'],
    roof: '#3c3e4c', stone: '#cfc7b4', stoneD: '#8f8873', wood: '#7a4b28', woodD: '#42260f', cloth: ['#2a4a7a', '#b8382c', '#e8d6a0', '#f3ead8'], leaf: '#4a7a3a', leafD: '#2a4c25',
    glow: 'rgba(255,206,130,0.34)', ink: '#201828', dim: 0.16,
  },
];

// The place behind the spots: sky, a row of buildings or foliage on the horizon, and the ground. `hz` is the horizon y; the
// ground fills from there to the bottom of the rect. t drives small ambient motion (a drifting cloud, swaying leaves).
export function drawPlace(ctx, th, r, hz, t, kind = 0, scale = 1) {
  const T = THEMES[th] ?? THEMES[0];
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = lg(ctx, 0, r.y, 0, hz, [[0, T.sky[0]], [0.65, T.sky[1]], [1, T.sky[2]]]); ctx.fillRect(r.x, r.y, r.w, hz - r.y + 1);
  // sun / moon glow and a slow cloud
  const gx = r.x + r.w * (th === 1 ? 0.78 : th === 0 ? 0.22 : 0.7), gy = hz - (hz - r.y) * 0.32;
  const rg = ctx.createRadialGradient(gx, gy, 4, gx, gy, 150 * scale); rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = rg; ctx.fillRect(r.x, r.y, r.w, hz - r.y);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let c = 0; c < 2; c++) {
    const cx = r.x + ((t * (5 + c * 3) + c * 400 + 90) % (r.w + 260)) - 130, cy = r.y + (hz - r.y) * (0.22 + c * 0.2);
    ctx.beginPath(); ctx.ellipse(cx, cy, 70 * scale, 14 * scale, 0, 0, TAU); ctx.ellipse(cx + 34 * scale, cy - 8 * scale, 40 * scale, 12 * scale, 0, 0, TAU); ctx.fill();
  }
  // horizon row
  const base = hz;
  if (th === 0) {
    let x = r.x - 20;
    for (let i = 0; x < r.x + r.w + 40; i++) {
      const w = (110 + hash(i) * 90) * scale, h = (70 + hash(i + 40) * 90) * scale, col = T.wall[i % 4];
      ctx.fillStyle = col; ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(x - 6, base - h); ctx.lineTo(x + w / 2, base - h - 26 * scale); ctx.lineTo(x + w + 6, base - h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(40,24,40,0.55)';
      for (let wy = 0; wy < 2; wy++) for (let wx = 0; wx < 2; wx++) { const px = x + w * (0.2 + wx * 0.42), py = base - h + 14 * scale + wy * 34 * scale; if (py + 24 * scale < base - 6) { ctx.fillRect(px, py, 18 * scale, 24 * scale); } }
      ctx.fillStyle = 'rgba(255,200,110,0.7)';
      if (hash(i + 9) > 0.45) ctx.fillRect(x + w * 0.2 + 3, base - h + 14 * scale + 3, 12 * scale, 18 * scale);
      x += w - 4;
    }
    // a bell tower
    const tx = r.x + r.w * 0.84;
    ctx.fillStyle = '#b98a68'; ctx.fillRect(tx - 18 * scale, base - 190 * scale, 36 * scale, 190 * scale);
    ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(tx - 24 * scale, base - 190 * scale); ctx.lineTo(tx, base - 236 * scale); ctx.lineTo(tx + 24 * scale, base - 190 * scale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(40,24,40,0.6)'; ctx.fillRect(tx - 6 * scale, base - 170 * scale, 12 * scale, 30 * scale);
  } else if (th === 1) {
    // palms and a thatched hut line
    for (let i = 0; i < 9; i++) {
      const x = r.x + (i + 0.4) * r.w / 8, h = (110 + hash(i) * 110) * scale, sway = Math.sin(t * 0.8 + i) * 4 * scale;
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 7 * scale; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 10 * scale, base - h * 0.5, x + sway, base - h); ctx.stroke();
      ctx.fillStyle = T.leafD;
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55 + sway * 0.01;
        ctx.beginPath(); ctx.moveTo(x + sway, base - h); ctx.quadraticCurveTo(x + sway + Math.cos(a) * 50 * scale, base - h + Math.sin(a) * 50 * scale - 12 * scale, x + sway + Math.cos(a) * 82 * scale, base - h + Math.sin(a) * 40 * scale + 26 * scale);
        ctx.quadraticCurveTo(x + sway + Math.cos(a) * 46 * scale, base - h + Math.sin(a) * 40 * scale + 4 * scale, x + sway, base - h); ctx.fill();
      }
    }
    const hx = r.x + r.w * 0.2, hw = 190 * scale;
    ctx.fillStyle = T.wall[1]; ctx.fillRect(hx, base - 70 * scale, hw, 70 * scale);
    ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(hx - 16 * scale, base - 68 * scale); ctx.lineTo(hx + hw / 2, base - 130 * scale); ctx.lineTo(hx + hw + 16 * scale, base - 68 * scale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(50,30,10,0.65)'; ctx.fillRect(hx + hw * 0.4, base - 48 * scale, hw * 0.2, 48 * scale);
  } else {
    // wooden town-house facade with a tiled roof and lattice windows
    let x = r.x - 10;
    for (let i = 0; x < r.x + r.w + 20; i++) {
      const w = (170 + hash(i + 3) * 60) * scale, h = (110 + hash(i + 7) * 40) * scale;
      ctx.fillStyle = T.wall[0]; ctx.fillRect(x, base - h, w, h);
      ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(x - 10 * scale, base - h + 6 * scale); ctx.lineTo(x + w + 10 * scale, base - h + 6 * scale); ctx.lineTo(x + w - 8 * scale, base - h - 30 * scale); ctx.lineTo(x + 8 * scale, base - h - 30 * scale); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20,12,6,0.6)'; ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255,214,150,0.55)';
      const wx = x + w * 0.16, ww = w * 0.28, wy = base - h + 22 * scale, wh = h * 0.42;
      ctx.fillRect(wx, wy, ww, wh); ctx.strokeRect(wx, wy, ww, wh);
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(wx + (ww * k) / 4, wy); ctx.lineTo(wx + (ww * k) / 4, wy + wh); ctx.stroke(); }
      ctx.fillStyle = 'rgba(30,18,10,0.7)'; ctx.fillRect(x + w * 0.58, base - h * 0.62, w * 0.28, h * 0.62);
      x += w;
    }
  }
  // ground
  ctx.fillStyle = lg(ctx, 0, hz, 0, r.y + r.h, [[0, T.ground[0]], [1, T.ground[1]]]); ctx.fillRect(r.x, hz, r.w, r.y + r.h - hz + 1);
  ctx.strokeStyle = T.line; ctx.lineWidth = 2;
  const span = r.y + r.h - hz;
  for (let k = 1; k <= 5; k++) {
    const yy = hz + span * Math.pow(k / 5.5, 1.6);
    ctx.beginPath(); ctx.moveTo(r.x, yy); ctx.lineTo(r.x + r.w, yy); ctx.stroke();
  }
  if (T.dim > 0) { ctx.fillStyle = `rgba(14,10,40,${T.dim})`; ctx.fillRect(r.x, r.y, r.w, r.h); }
  void kind;
  ctx.restore();
}

// ---- hiding-spot sprites ----------------------------------------------------------------------------------------------------
const shadow = (ctx, w = 120, a = 0.28) => { ctx.save(); ctx.fillStyle = `rgba(10,8,20,${a})`; ctx.beginPath(); ctx.ellipse(0, 3, w / 2, 12, 0, 0, TAU); ctx.fill(); ctx.restore(); };
function plank(ctx, x, y, w, h, c0, c1) { ctx.fillStyle = lg(ctx, x, y, x + w, y + h, [[0, c0], [1, c1]]); ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(20,10,4,0.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h); }

const SPRITES = {
  arch(ctx, T) {
    shadow(ctx, 150);
    ctx.fillStyle = lg(ctx, -70, 0, 70, 0, [[0, T.stone], [1, T.stoneD]]);
    ctx.fillRect(-70, -150, 36, 150); ctx.fillRect(34, -150, 36, 150);
    ctx.beginPath(); ctx.moveTo(-70, -150); ctx.lineTo(-70, -108); ctx.arc(0, -108, 70, Math.PI, 0); ctx.lineTo(70, -150); ctx.arc(0, -150, 70, 0, Math.PI, true); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-34, -108); ctx.arc(0, -108, 34, Math.PI, 0); ctx.lineTo(34, 0); ctx.closePath();
    ctx.fillStyle = lg(ctx, 0, -140, 0, 0, [[0, '#241a2c'], [1, '#4a3a4a']]); ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,10,0.35)'; ctx.lineWidth = 2;
    for (let y = -130; y < 0; y += 28) { ctx.beginPath(); ctx.moveTo(-70, y); ctx.lineTo(-34, y); ctx.moveTo(34, y); ctx.lineTo(70, y); ctx.stroke(); }
  },
  fountain(ctx, T, o) {
    shadow(ctx, 150);
    ctx.fillStyle = lg(ctx, -70, 0, 70, 0, [[0, T.stone], [1, T.stoneD]]);
    ctx.beginPath(); ctx.ellipse(0, -18, 72, 22, 0, 0, TAU); ctx.fill();
    ctx.fillRect(-70, -34, 140, 20);
    ctx.fillStyle = '#6fb6d0'; ctx.beginPath(); ctx.ellipse(0, -34, 62, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = lg(ctx, -12, 0, 12, 0, [[0, T.stone], [1, T.stoneD]]); ctx.fillRect(-12, -118, 24, 90);
    ctx.beginPath(); ctx.ellipse(0, -96, 40, 12, 0, 0, TAU); ctx.fillStyle = T.stone; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -100, 32, 8, 0, 0, TAU); ctx.fillStyle = '#7ec4dc'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) { const a = (o.t * 1.6 + i * 0.7) % 1; ctx.beginPath(); ctx.arc((i - 2) * 9 * a, -112 + a * 30 - Math.sin(a * Math.PI) * 18, 3, 0, TAU); ctx.fill(); }
  },
  curtain(ctx, T, o) {
    shadow(ctx, 130);
    const noren = o.v === 'noren';
    if (!noren) {
      plank(ctx, -62, -162, 124, 162, T.wood, T.woodD);
      ctx.fillStyle = lg(ctx, 0, -150, 0, 0, [[0, '#1a1220'], [1, '#3a2a36']]); ctx.fillRect(-48, -148, 96, 148);
      ctx.fillStyle = lg(ctx, -56, 0, 56, 0, [[0, T.cloth[0]], [1, '#7c241c']]);
      ctx.beginPath(); ctx.moveTo(-56, -150); ctx.lineTo(0, -150); ctx.lineTo(-6, -4); ctx.quadraticCurveTo(-30, 6, -56, -4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(56, -150); ctx.lineTo(8, -150); ctx.lineTo(14, -4); ctx.quadraticCurveTo(34, 6, 56, -4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
      for (let x = -48; x < 56; x += 16) { ctx.beginPath(); ctx.moveTo(x, -150); ctx.lineTo(x * 0.9, -6); ctx.stroke(); }
      ctx.fillStyle = T.wood; ctx.fillRect(-66, -166, 132, 10);
    } else {
      ctx.fillStyle = T.woodD; ctx.fillRect(-70, -150, 140, 10); ctx.fillRect(-64, -150, 6, 150); ctx.fillRect(58, -150, 6, 150);
      ctx.fillStyle = 'rgba(16,10,12,0.9)'; ctx.fillRect(-58, -140, 116, 140);
      ctx.fillStyle = lg(ctx, 0, -140, 0, -50, [[0, T.cloth[0]], [1, '#8e2a22']]);
      [[-58, -8], [-4, 54]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(a, -140); ctx.lineTo(b, -140); ctx.lineTo(b - 2, -52); ctx.lineTo(a + 2, -52); ctx.closePath(); ctx.fill(); });
      ctx.fillStyle = '#f3ead8'; ctx.beginPath(); ctx.arc(-33, -96, 14, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(31, -96, 14, 0, TAU); ctx.fill();
    }
  },
  cart(ctx, T, o) {
    shadow(ctx, 150);
    const hand = o.v === 'hand';
    ctx.strokeStyle = T.woodD; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-64, -42); ctx.lineTo(-86, -20); ctx.stroke();
    plank(ctx, -62, -80, 124, 34, T.wood, T.woodD);
    if (!hand) {
      ctx.fillStyle = lg(ctx, 0, -130, 0, -80, [[0, T.cloth[0]], [1, '#8e2a22']]);
      ctx.beginPath(); ctx.moveTo(-58, -80); ctx.quadraticCurveTo(-40, -138, 0, -128); ctx.quadraticCurveTo(44, -138, 58, -80); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-34, -86); ctx.quadraticCurveTo(0, -118, 34, -86); ctx.stroke();
    } else {
      ctx.fillStyle = '#d6c08a'; ctx.beginPath(); ctx.ellipse(-24, -92, 30, 22, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(26, -96, 28, 26, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-24, -92, 12, 0, TAU); ctx.stroke();
    }
    [[-34, 0], [38, 0]].forEach(([x]) => {
      ctx.fillStyle = T.woodD; ctx.beginPath(); ctx.arc(x, -26, 26, 0, TAU); ctx.fill();
      ctx.fillStyle = T.wood; ctx.beginPath(); ctx.arc(x, -26, 20, 0, TAU); ctx.fill();
      ctx.strokeStyle = T.woodD; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 20, -26 + Math.sin(a) * 20); ctx.lineTo(x - Math.cos(a) * 20, -26 - Math.sin(a) * 20); ctx.stroke(); }
      ctx.fillStyle = T.woodD; ctx.beginPath(); ctx.arc(x, -26, 5, 0, TAU); ctx.fill();
    });
  },
  barrels(ctx, T) {
    shadow(ctx, 150);
    const barrel = (x, y, s) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = lg(ctx, -34, 0, 34, 0, [[0, T.wood], [0.5, '#b07a46'], [1, T.woodD]]);
      ctx.beginPath(); ctx.moveTo(-28, 0); ctx.quadraticCurveTo(-42, -42, -28, -84); ctx.lineTo(28, -84); ctx.quadraticCurveTo(42, -42, 28, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#3a3a44'; ctx.lineWidth = 5;
      [-66, -42, -16].forEach((yy) => { ctx.beginPath(); ctx.moveTo(-36 + Math.abs(yy + 42) * 0.12, yy); ctx.lineTo(36 - Math.abs(yy + 42) * 0.12, yy); ctx.stroke(); });
      ctx.fillStyle = T.woodD; ctx.beginPath(); ctx.ellipse(0, -84, 28, 8, 0, 0, TAU); ctx.fill();
      ctx.restore();
    };
    barrel(-34, 0, 1); barrel(36, 0, 0.95); barrel(0, -62, 0.9);
  },
  plant(ctx, T, o) {
    shadow(ctx, 110);
    const v = o.v || 'lemon', sway = Math.sin(o.t * 1.1) * 3;
    if (v === 'lemon') {
      ctx.fillStyle = '#b5683a'; ctx.beginPath(); ctx.moveTo(-34, -52); ctx.lineTo(34, -52); ctx.lineTo(26, 0); ctx.lineTo(-26, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8c4a26'; ctx.fillRect(-38, -60, 76, 12);
      ctx.strokeStyle = T.woodD; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(sway * 0.4, -104); ctx.stroke();
      [[0, -138, 52], [-34, -112, 36], [34, -114, 36]].forEach(([x, y, r]) => { const g = ctx.createRadialGradient(x - 8 + sway, y - 10, 4, x + sway, y, r); g.addColorStop(0, '#79b848'); g.addColorStop(1, T.leafD); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + sway, y, r, 0, TAU); ctx.fill(); });
      ctx.fillStyle = '#f5d84a'; [[-22, -128], [18, -150], [30, -112], [-40, -108], [4, -112]].forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x + sway, y, 8, 6, 0.5, 0, TAU); ctx.fill(); });
    } else if (v === 'bamboo') {
      for (let i = 0; i < 6; i++) {
        const x = (i - 2.5) * 20, h = 130 + (i % 3) * 22, b = Math.sin(o.t * 0.9 + i) * 3;
        ctx.strokeStyle = i % 2 ? '#7aa83a' : '#5e9230'; ctx.lineWidth = 11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + b, -h * 0.5, x + b * 1.6, -h); ctx.stroke();
        ctx.strokeStyle = 'rgba(30,60,10,0.5)'; ctx.lineWidth = 3;
        for (let j = 1; j < 4; j++) { const yy = -h * j / 4; ctx.beginPath(); ctx.moveTo(x - 6 + b * j / 4, yy); ctx.lineTo(x + 6 + b * j / 4, yy); ctx.stroke(); }
        ctx.fillStyle = T.leaf;
        [-1, 1].forEach((s) => { ctx.beginPath(); ctx.moveTo(x + b * 1.6, -h); ctx.quadraticCurveTo(x + b * 1.6 + s * 34, -h - 8, x + b * 1.6 + s * 50, -h + 18); ctx.quadraticCurveTo(x + b * 1.6 + s * 26, -h + 6, x + b * 1.6, -h); ctx.fill(); });
      }
    } else if (v === 'banana') {
      ctx.strokeStyle = '#7a8f3a'; ctx.lineWidth = 12; ctx.lineCap = 'round';
      [[-24, 0.0], [10, 0.2], [34, 0.5]].forEach(([x, k], i) => {
        const h = 128 - i * 12;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x * 0.6 + sway * 0.5, -h); ctx.stroke();
        for (let l = 0; l < 4; l++) {
          const a = -Math.PI / 2 + (l - 1.5) * 0.75 + k * 0.1 + sway * 0.012, tx = x * 0.6 + sway * 0.5, ty = -h;
          ctx.fillStyle = l % 2 ? T.leaf : '#6cb840';
          ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + Math.cos(a - 0.3) * 50, ty + Math.sin(a - 0.3) * 40 - 14, tx + Math.cos(a) * 92, ty + Math.sin(a) * 40 + 34);
          ctx.quadraticCurveTo(tx + Math.cos(a + 0.3) * 50, ty + Math.sin(a + 0.3) * 40 + 8, tx, ty); ctx.fill();
        }
      });
    } else {
      ctx.strokeStyle = T.woodD; ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.bezierCurveTo(-30, -50, 24, -70, 0, -128); ctx.stroke();
      [[-34, -120, 40], [34, -96, 36], [2, -146, 34], [-40, -76, 28]].forEach(([x, y, r]) => {
        const g = ctx.createRadialGradient(x - 6, y - 8, 4, x, y, r); g.addColorStop(0, '#5a9444'); g.addColorStop(1, T.leafD);
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * 1.25, r * 0.7, 0, 0, TAU); ctx.fill();
      });
    }
  },
  laundry(ctx, T, o) {
    shadow(ctx, 140);
    const rack = o.v === 'rack', sw = Math.sin(o.t * 1.4) * 2.5;
    ctx.strokeStyle = rack ? '#a58b3a' : T.woodD; ctx.lineWidth = rack ? 7 : 8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-64, 0); ctx.lineTo(-58, -150); ctx.moveTo(64, 0); ctx.lineTo(58, -150); ctx.stroke();
    if (rack) { ctx.beginPath(); ctx.moveTo(-60, -140); ctx.lineTo(60, -140); ctx.moveTo(-62, -96); ctx.lineTo(62, -96); ctx.stroke(); }
    else { ctx.lineWidth = 2.5; ctx.strokeStyle = '#3a2a1a'; ctx.beginPath(); ctx.moveTo(-58, -146); ctx.quadraticCurveTo(0, -132, 58, -146); ctx.stroke(); }
    const cloths = [[-44, T.cloth[0], 34], [-4, T.cloth[3], 36], [40, T.cloth[1], 30]];
    cloths.forEach(([x, c, w], i) => {
      const y0 = rack ? -138 : -140 + Math.abs(x) * 0.07, h = rack ? 92 : 104 - i * 6;
      ctx.fillStyle = lg(ctx, 0, y0, 0, y0 + h, [[0, c], [1, 'rgba(0,0,0,0.25)']]); ctx.beginPath(); ctx.moveTo(x - w / 2, y0); ctx.lineTo(x + w / 2, y0); ctx.lineTo(x + w / 2 + sw, y0 + h); ctx.quadraticCurveTo(x + sw, y0 + h + 6, x - w / 2 + sw, y0 + h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x - w / 2 + 4, y0 + 8, 5, h - 24);
    });
  },
  crates(ctx, T) {
    shadow(ctx, 150);
    const crate = (x, y, w, h) => {
      plank(ctx, x, y, w, h, '#b88a52', T.woodD);
      ctx.strokeStyle = 'rgba(40,20,6,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.stroke();
    };
    crate(-68, -62, 68, 62); crate(4, -62, 64, 62); crate(-42, -122, 70, 60);
  },
  jar(ctx, T) {
    shadow(ctx, 120);
    ctx.fillStyle = lg(ctx, -52, 0, 52, 0, [[0, '#b35a34'], [0.45, '#d98a52'], [1, '#6e3418']]);
    ctx.beginPath(); ctx.moveTo(-26, -150); ctx.quadraticCurveTo(-64, -120, -58, -64); ctx.quadraticCurveTo(-52, -8, -28, 0); ctx.lineTo(28, 0); ctx.quadraticCurveTo(52, -8, 58, -64); ctx.quadraticCurveTo(64, -120, 26, -150); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7a3a1c'; ctx.beginPath(); ctx.ellipse(0, -150, 30, 9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8c88a'; ctx.beginPath(); ctx.ellipse(0, -152, 22, 6, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,180,0.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-54, -92); ctx.quadraticCurveTo(0, -78, 54, -92); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-50, -52); ctx.quadraticCurveTo(0, -40, 50, -52); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-26, -86, 8, 34, 0.1, 0, TAU); ctx.fill();
  },
  sacks(ctx, T) {
    shadow(ctx, 150);
    const sack = (x, y, s) => {
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      ctx.fillStyle = lg(ctx, -34, 0, 34, 0, [[0, '#d8c08a'], [1, '#a98c52']]);
      ctx.beginPath(); ctx.moveTo(-22, -78); ctx.quadraticCurveTo(-46, -44, -36, -6); ctx.quadraticCurveTo(0, 8, 36, -6); ctx.quadraticCurveTo(46, -44, 22, -78); ctx.quadraticCurveTo(0, -88, -22, -78); ctx.fill();
      ctx.strokeStyle = '#6a4a22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-18, -76); ctx.quadraticCurveTo(0, -68, 18, -76); ctx.stroke();
      ctx.strokeStyle = 'rgba(80,50,20,0.3)'; ctx.lineWidth = 2; for (let k = -20; k <= 20; k += 10) { ctx.beginPath(); ctx.moveTo(k, -64); ctx.lineTo(k * 1.2, -12); ctx.stroke(); }
      ctx.restore();
    };
    sack(-38, 0, 1); sack(40, 0, 0.96); sack(2, -58, 0.92);
  },
  table(ctx, T, o) {
    shadow(ctx, 150);
    if (o.v === 'bale') {
      ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-60, -70); ctx.moveTo(60, 0); ctx.lineTo(60, -70); ctx.moveTo(-56, -158); ctx.lineTo(-56, -70); ctx.moveTo(56, -158); ctx.lineTo(56, -70); ctx.stroke();
      ctx.fillStyle = '#c9a85a'; ctx.fillRect(-72, -76, 144, 14);
      for (let x = -66; x < 70; x += 14) { ctx.fillStyle = 'rgba(80,50,10,0.3)'; ctx.fillRect(x, -76, 2, 14); }
      ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(-82, -150); ctx.lineTo(0, -184); ctx.lineTo(82, -150); ctx.lineTo(70, -142); ctx.lineTo(-70, -142); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-56, -62, 112, 56);
    } else {
      ctx.fillStyle = lg(ctx, 0, -78, 0, 0, [[0, T.cloth[1]], [1, '#1c3a55']]);
      ctx.beginPath(); ctx.moveTo(-74, -64); ctx.lineTo(74, -64); ctx.lineTo(84, 0); ctx.lineTo(-84, 0); ctx.closePath(); ctx.fill();
      plank(ctx, -80, -78, 160, 16, '#b8864e', T.woodD);
      ctx.fillStyle = T.cloth[3]; ctx.beginPath(); ctx.ellipse(-18, -88, 16, 6, 0, 0, TAU); ctx.fill(); ctx.fillRect(-34, -100, 32, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; for (let x = -60; x < 70; x += 28) ctx.fillRect(x, -58, 4, 54);
    }
  },
  gate(ctx, T, o) {
    shadow(ctx, 150);
    if (o.v === 'veranda') {
      ctx.fillStyle = 'rgba(14,8,6,0.85)'; ctx.fillRect(-72, -40, 144, 40);
      plank(ctx, -78, -62, 156, 22, '#a5784a', T.woodD);
      ctx.strokeStyle = T.woodD; ctx.lineWidth = 9; [-66, 0, 66].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, -62); ctx.lineTo(x, -162); ctx.stroke(); });
      ctx.fillStyle = T.roof; ctx.beginPath(); ctx.moveTo(-86, -158); ctx.lineTo(86, -158); ctx.lineTo(70, -176); ctx.lineTo(-70, -176); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,190,0.75)'; ctx.fillRect(-60, -150, 56, 82); ctx.strokeStyle = '#42260f'; ctx.lineWidth = 3; ctx.strokeRect(-60, -150, 56, 82);
      ctx.beginPath(); ctx.moveTo(-32, -150); ctx.lineTo(-32, -68); ctx.moveTo(-60, -110); ctx.lineTo(-4, -110); ctx.stroke();
    } else if (o.v === 'bamboo') {
      for (let i = 0; i < 9; i++) {
        const x = -64 + i * 16, h = 110 + hash(i) * 22;
        ctx.fillStyle = lg(ctx, x - 6, 0, x + 6, 0, [[0, '#a8c456'], [1, '#6a8c2a']]); ctx.fillRect(x - 6, -h, 12, h);
        ctx.fillStyle = 'rgba(40,60,10,0.5)'; ctx.fillRect(x - 6, -h * 0.5, 12, 3);
      }
      ctx.fillStyle = '#8a6a30'; ctx.fillRect(-72, -74, 144, 8); ctx.fillRect(-72, -36, 144, 8);
    } else {
      plank(ctx, -66, -140, 20, 140, T.wood, T.woodD); plank(ctx, 46, -140, 20, 140, T.wood, T.woodD);
      for (let i = 0; i < 4; i++) plank(ctx, -44 + i * 22, -120 + (i % 2) * 6, 20, 118, '#a5784a', T.woodD);
      ctx.fillStyle = '#2a2a34'; ctx.fillRect(-44, -90, 88, 6); ctx.fillRect(-44, -40, 88, 6);
    }
  },
  screen(ctx, T) {
    shadow(ctx, 150);
    for (let i = 0; i < 3; i++) {
      const x = -66 + i * 44, sk = i % 2 ? 6 : -6;
      ctx.fillStyle = T.woodD; ctx.beginPath(); ctx.moveTo(x, -4 + sk * 0.2); ctx.lineTo(x + 44, -4 - sk * 0.2); ctx.lineTo(x + 44, -150 - sk * 0.2); ctx.lineTo(x, -150 + sk * 0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = lg(ctx, x, 0, x + 44, 0, [[0, '#f3e6c4'], [1, '#d8c48a']]);
      ctx.beginPath(); ctx.moveTo(x + 4, -8 + sk * 0.2); ctx.lineTo(x + 40, -8 - sk * 0.2); ctx.lineTo(x + 40, -146 - sk * 0.2); ctx.lineTo(x + 4, -146 + sk * 0.2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = i === 1 ? T.cloth[1] : T.cloth[0]; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 10, -40); ctx.quadraticCurveTo(x + 22, -90, x + 34, -50); ctx.moveTo(x + 22, -110); ctx.quadraticCurveTo(x + 14, -126, x + 30, -134); ctx.stroke();
    }
  },
  wardrobe(ctx, T) {
    shadow(ctx, 140);
    plank(ctx, -62, -160, 124, 160, T.wood, T.woodD);
    ctx.fillStyle = '#efe2bd'; ctx.fillRect(-56, -154, 54, 148);
    ctx.fillStyle = '#d8c48e'; ctx.fillRect(2, -154, 54, 148);
    ctx.fillStyle = 'rgba(20,10,6,0.78)'; ctx.fillRect(2, -154, 18, 148);
    ctx.strokeStyle = T.woodD; ctx.lineWidth = 3;
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-56, -154 + k * 49); ctx.lineTo(56, -154 + k * 49); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-29, -154); ctx.lineTo(-29, -6); ctx.moveTo(29, -154); ctx.lineTo(29, -6); ctx.stroke();
    ctx.fillStyle = '#2a2a34'; ctx.beginPath(); ctx.arc(-8, -80, 5, 0, TAU); ctx.fill();
  },
  chest(ctx, T) {
    shadow(ctx, 140);
    plank(ctx, -66, -112, 132, 112, T.wood, T.woodD);
    for (let r = 0; r < 3; r++) {
      const y = -108 + r * 36;
      ctx.fillStyle = r % 2 ? '#a5784a' : '#94683c'; ctx.fillRect(-60, y, 120, 32); ctx.strokeStyle = T.woodD; ctx.lineWidth = 2; ctx.strokeRect(-60, y, 120, 32);
      ctx.fillStyle = '#34343e'; ctx.fillRect(-10, y + 10, 20, 12); ctx.fillStyle = '#c9c9d4'; ctx.fillRect(-7, y + 13, 14, 6);
    }
    ctx.fillStyle = '#34343e'; [[-60, -108], [52, -108], [-60, -12], [52, -12]].forEach(([x, y]) => ctx.fillRect(x, y, 8, 12));
  },
  rocks(ctx, T) {
    shadow(ctx, 150);
    [[-42, -2, 46, 46], [36, -2, 40, 38], [-4, -34, 38, 36]].forEach(([x, y, w, h], i) => {
      const g = ctx.createRadialGradient(x - 8, y - h * 0.9, 4, x, y - h * 0.5, w); g.addColorStop(0, '#b4b8a8'); g.addColorStop(1, '#5e6258');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y - h * 0.5, w * 0.9, h * 0.62 + i * 4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(70,140,60,0.5)'; ctx.beginPath(); ctx.ellipse(x - 6, y - h * 0.95, w * 0.5, h * 0.18, 0, 0, TAU); ctx.fill();
    });
    ctx.fillStyle = T.wood; ctx.fillRect(40, -70, 30, 40); ctx.fillStyle = T.woodD; ctx.fillRect(40, -70, 30, 6);
    ctx.fillStyle = '#7ec4dc'; ctx.fillRect(43, -66, 24, 5);
  },
};
export const SPOT_W = 150, SPOT_H = 170;
// Draws spot `kind` with its feet at (x, y), scaled by k. o: { v, t, shake (0..1), light (0..1 highlight), dim }
export function drawSpot(ctx, th, kind, x, y, k, o = {}) {
  const T = THEMES[th] ?? THEMES[0], f = SPRITES[kind] ?? SPRITES.crates;
  ctx.save(); ctx.translate(x + (o.shake ? Math.sin(o.shake * 40) * 4 * (1 - o.shake) * k : 0), y); ctx.scale(k, k);
  if (o.light) {
    const g = ctx.createRadialGradient(0, -80, 10, 0, -80, 120); g.addColorStop(0, `rgba(255,236,150,${0.7 * o.light})`); g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -80, 110, 120, 0, 0, TAU); ctx.fill();
  }
  f(ctx, T, { v: o.v, t: o.t || 0 });
  ctx.restore();
}

// ---- children -------------------------------------------------------------------------------------------------------------
// 0-3 hiders, 4 the seeker, 5 you
export const KIDS = [
  { skin: '#f1c9a0', hair: '#2b1b12', shirt: '#d9473b', pants: '#33496e', long: false },
  { skin: '#8d5a3b', hair: '#15100d', shirt: '#2f9c8a', pants: '#5a4a8c', long: true },
  { skin: '#c68e5f', hair: '#3a2415', shirt: '#e8b53a', pants: '#2d5d8a', long: false },
  { skin: '#e9b996', hair: '#8a4a1f', shirt: '#6b8fd6', pants: '#6a3b3b', long: true },
  { skin: '#d7a37a', hair: '#101018', shirt: '#f08a3a', pants: '#2a3a5a', long: false },
  { skin: '#e0ad86', hair: '#20140e', shirt: '#7bd16a', pants: '#3a3a6a', long: true },
];
// A child with feet at (x, y) and height h. pose: 'stand' | 'walk' | 'cheer' | 'eyes' | 'peek' | 'crouch'. t: seconds (animation).
export function drawKid(ctx, kid, x, y, h, pose = 'stand', t = 0, o = {}) {
  const K = KIDS[kid % KIDS.length], s = h / 100;
  // Real 3D children (web/view3d/kids.js) when the layer is loaded; the 2D figure below is the fallback (no WebGL2, load failure, context loss).
  const k3 = globalThis.__kids3d;
  if (k3) {
    if (k3.pending) return;
    const sh = o.alpha == null ? 1 : o.alpha;
    ctx.save(); ctx.globalAlpha = 0.28 * sh; ctx.fillStyle = 'rgba(10,8,20,1)'; ctx.beginPath(); ctx.ellipse(x, y + s, 20 * s, 5.2 * s, 0, 0, TAU); ctx.fill(); ctx.restore();
    if (k3.draw(ctx, kid, x, y, h, pose, t, o)) return;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  if (o.flip) ctx.scale(-1, 1);
  const walk = pose === 'walk', cheer = pose === 'cheer', crouch = pose === 'crouch' ? 16 : 0;
  const ph = t * 9, st = Math.sin(ph);
  // a soft bob (walk: two steps per cycle; cheer: bounce; otherwise a slow breath)
  const bob = walk ? Math.abs(st) * 3 : cheer ? Math.abs(Math.sin(t * 6)) * 6 : Math.sin(t * 2) * 0.7;
  const sway = walk ? st * 1.6 : 0;
  ctx.fillStyle = 'rgba(10,8,20,0.28)'; ctx.beginPath(); ctx.ellipse(0, 1, 19 - bob * 0.6, 5, 0, 0, TAU); ctx.fill();
  const hipY = -33 + crouch - bob, shY = hipY - 27;
  const line = (col, wd, pts) => { ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke(); };
  const shoe = (px, py) => { ctx.fillStyle = '#35241e'; ctx.beginPath(); ctx.ellipse(px + 2, py, 9, 4.4, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(px + 3, py - 1.5, 5, 1.6, 0, 0, TAU); ctx.fill(); };
  // legs: hip -> knee -> foot, the stepping foot lifts
  const leg = (side, ph0) => {
    const sw = walk ? Math.sin(ph + ph0) : 0, lift = walk ? Math.max(0, Math.cos(ph + ph0)) * 5 : 0;
    const hx = side * 6.5, fx = side * 7.5 + sw * 9, fy = -3 - lift;
    const kx = (hx + fx) / 2 + (crouch ? side * 7 : 1.5), ky = (hipY + fy) / 2 - (crouch ? 2 : 0);
    line(K.pants, 10.5, [hx, hipY, kx, ky, fx, fy - 2]);
    shoe(fx, fy);
  };
  leg(-1, 0); leg(1, Math.PI);
  // a long-hair ponytail sits behind the body
  const headY = shY - 18 - (crouch ? 2 : 0);
  if (K.long) { ctx.fillStyle = K.hair; ctx.beginPath(); ctx.ellipse(-13 + sway, headY + 12, 6.5, 15, 0.18, 0, TAU); ctx.ellipse(13 + sway, headY + 12, 6.5, 15, -0.18, 0, TAU); ctx.fill(); }
  // torso: a soft tapered body with a lit side and a small collar
  ctx.save(); ctx.translate(sway, 0);
  ctx.beginPath(); ctx.moveTo(-14, shY + 6); ctx.quadraticCurveTo(-14, shY - 1, -8, shY - 1); ctx.lineTo(8, shY - 1); ctx.quadraticCurveTo(14, shY - 1, 14, shY + 6);
  ctx.lineTo(12.5, hipY + 4); ctx.quadraticCurveTo(0, hipY + 9, -12.5, hipY + 4); ctx.closePath();
  ctx.fillStyle = K.shirt; ctx.fill();
  ctx.fillStyle = lg(ctx, -14, 0, 14, 0, [[0, 'rgba(255,255,255,0.20)'], [0.55, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.26)']]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.ellipse(0, shY - 1, 6.5, 2.6, 0, 0, Math.PI); ctx.fill();
  ctx.restore();
  // arms: sleeve + forearm + hand
  const arm = (side, a1, a2) => {
    const sx = side * 13.5 + sway, sy = shY + 4;
    const ex = sx + Math.cos(a1) * 11 * side, ey = sy + Math.sin(a1) * 11;
    const hx = ex + Math.cos(a2) * 11 * side, hy = ey + Math.sin(a2) * 11;
    line(K.skin, 6.2, [ex, ey, hx, hy]); line(K.shirt, 8, [sx, sy, ex, ey]);
    ctx.fillStyle = K.skin; ctx.beginPath(); ctx.arc(hx, hy, 4.2, 0, TAU); ctx.fill();
  };
  const down = 1.25;
  if (cheer) { const w = Math.sin(t * 6) * 0.25; arm(-1, -0.7 + w, -1.15 + w); arm(1, -0.7 - w, -1.15 - w); }
  else if (pose === 'eyes') { arm(-1, -0.5, -1.35); arm(1, -0.5, -1.35); }
  else if (pose === 'peek') { arm(-1, 1.2, 0.2); arm(1, 1.2, 0.2); }
  else { const a = walk ? st * 0.55 : 0; arm(-1, down + a * 0.4, down + 0.15 + a); arm(1, down - a * 0.4, down + 0.15 - a); }
  // head
  const hx = sway * 1.3, nod = walk ? st * 0.04 : 0;
  ctx.save(); ctx.translate(hx, headY); ctx.rotate(nod);
  ctx.fillStyle = K.skin; ctx.beginPath(); ctx.arc(-15.5, 1.5, 3.4, 0, TAU); ctx.arc(15.5, 1.5, 3.4, 0, TAU); ctx.fill();            // ears
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = lg(ctx, -14, -14, 14, 16, [[0, 'rgba(255,255,255,0.22)'], [1, 'rgba(120,60,30,0.16)']]); ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill();
  // hair: a cap with a side-swept fringe
  ctx.fillStyle = K.hair; ctx.beginPath(); ctx.arc(0, -2, 16.6, Math.PI * 1.0, TAU); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-16, -3); ctx.quadraticCurveTo(-4, -9, 3, -12); ctx.quadraticCurveTo(10, -6, 16, -3); ctx.lineTo(16, -7); ctx.lineTo(-16, -7); ctx.fill();
  if (K.long) { ctx.fillRect(-16.6, -4, 4.4, 16); ctx.fillRect(12.2, -4, 4.4, 16); }
  if (pose === 'eyes') {
    // hands over the eyes
    ctx.fillStyle = K.skin; ctx.beginPath(); ctx.ellipse(0, 1, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,60,30,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, 1); ctx.lineTo(9, 1); ctx.stroke();
  } else {
    const blink = (t * 0.4) % 1 < 0.05;
    for (const ex of [-5.6, 5.6]) {
      if (blink) { ctx.strokeStyle = '#20141c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ex - 2.5, 2.5); ctx.lineTo(ex + 2.5, 2.5); ctx.stroke(); continue; }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(ex, 2.5, 3.1, 3.5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a1a18'; ctx.beginPath(); ctx.arc(ex + 0.5, 3, 2.1, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 1.2, 2.2, 0.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(235,110,100,0.30)'; ctx.beginPath(); ctx.ellipse(-9.5, 8, 3.2, 2, 0, 0, TAU); ctx.ellipse(9.5, 8, 3.2, 2, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(130,45,40,0.85)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath();
    if (cheer) { ctx.arc(0, 7, 5.2, 0.15, Math.PI - 0.15); } else ctx.arc(0, 8.4, 3.6, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// A number badge or word on a rounded plate (clue badge, labels). size in px.
export function badge(ctx, text, x, y, size, fill, ink = '#fff') {
  ctx.save();
  ctx.font = `800 ${size}px 'Avenir Next','Segoe UI','Helvetica Neue',Roboto,Arial,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.max(size * 1.5, ctx.measureText(text).width + size * 0.9), h = size * 1.5;
  roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(10,8,24,0.35)'; ctx.save(); ctx.translate(0, 2); ctx.fill(); ctx.restore();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  ctx.fillStyle = ink; ctx.fillText(text, x, y + size * 0.04);
  ctx.restore();
  return { w, h };
}
