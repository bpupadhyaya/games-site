// Bhavai Pot Balance Dance: palette, small helpers, particles and the courtyard (sky, wall, arches, lights, floor, rangoli).
// Everything is a function of its arguments and the clock handed in; scenery uses a position hash, never random.
export const PAL = {
  ink: '#07182c', navy: '#0c2340', deep: '#12345c', blue: '#2b6fb0', sky: '#7ec3ee', turq: '#27c4c0', turqHi: '#8ff0e6',
  marigold: '#ffb52e', marigoldHi: '#ffe08a', saffron: '#ff8a1f', magenta: '#d81b60', rose: '#ff6f9c', clay: '#c75b34', clayDeep: '#8e3a1e',
  cream: '#fff4de', text: '#fdf6e8', dim: 'rgba(253,246,232,0.68)', gold: '#ffc94d', goldDeep: '#d29a2e', leaf: '#4fb06a', warn: '#ff7a6a',
};
export const DISPLAY = '"Fredoka", "Trebuchet MS", system-ui, sans-serif';
export const UI = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const ease = (x) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
export const lerp = (a, b, t) => a + (b - a) * t;
export const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const mixHex = (a, b, t) => {
  const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

// ---- the camera: metres to pixels -----------------------------------------------------------------------------------------------------
// ox: screen x of x = 0, oy: screen y of the dancer's feet, ppm: pixels per metre.
export function makeCam(S, ppm) { return { S, ppm, ox: S.x + S.w / 2, oy: S.y + S.h * 0.84 }; }
export const sx = (cam, xm) => cam.ox + xm * cam.ppm;
export const sy = (cam, ym) => cam.oy - ym * cam.ppm;

// ---- particles (world metres) ------------------------------------------------------------------------------------------------------
export function burst(list, rng, x, y, n, col, power = 1, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, TAU), s = rng.range(0.4, 1.4) * power;
    list.push({ x, y, vx: Math.cos(a) * s * (o.flat ? 1.3 : 1), vy: Math.abs(Math.sin(a)) * s * (o.up ?? 1) + (o.lift ?? 0.6), life: rng.range(0.5, 1.1), age: 0, col: Array.isArray(col) ? col[i % col.length] : col, size: rng.range(0.025, 0.06) * (o.size ?? 1), kind: o.kind ?? 'dot', rot: rng.range(0, TAU), vr: rng.range(-6, 6), g: o.g ?? 3.2 });
  }
  if (list.length > 220) list.splice(0, list.length - 220);
}
export function stepParticles(list, dt) {
  for (const p of list) { p.age += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y < 0 && p.kind === 'shard') { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; p.vr *= 0.5; } }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].age >= list[i].life) list.splice(i, 1);
}
export function drawParticles(ctx, list, cam) {
  for (const p of list) {
    const a = clamp(1 - p.age / p.life, 0, 1), px = sx(cam, p.x), py = sy(cam, p.y), s = Math.max(2.5, p.size * cam.ppm);
    ctx.globalAlpha = Math.min(1, a * 1.6); ctx.fillStyle = p.col;
    if (p.kind === 'petal') { ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot); ctx.beginPath(); ctx.ellipse(0, 0, s * 1.3, s * 0.6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.kind === 'shard') { ctx.save(); ctx.translate(px, py); ctx.rotate(p.rot); ctx.beginPath(); ctx.moveTo(-s, s * 0.5); ctx.lineTo(s * 1.2, 0); ctx.lineTo(-s * 0.3, -s); ctx.closePath(); ctx.fill(); ctx.restore(); }
    else if (p.kind === 'ring') { ctx.strokeStyle = p.col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, s * (1 + p.age * 6), 0, TAU); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(px, py, s, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

export function drawStars(ctx, cx, cy, size, n, total = 3, gap = 1.25) {
  const w = size * 2 * gap, x0 = cx - (w * (total - 1)) / 2;
  for (let i = 0; i < total; i++) {
    const x = x0 + i * w, on = i < n;
    ctx.save(); ctx.translate(x, cy); ctx.beginPath();
    for (let k = 0; k < 10; k++) { const r = k % 2 ? size * 0.45 : size, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    ctx.closePath();
    ctx.fillStyle = on ? PAL.gold : 'rgba(255,255,255,0.16)'; ctx.fill();
    ctx.lineWidth = Math.max(1.5, size * 0.1); ctx.strokeStyle = on ? PAL.goldDeep : 'rgba(255,255,255,0.28)'; ctx.stroke();
    ctx.restore();
  }
}

// ---- the courtyard -----------------------------------------------------------------------------------------------------------------
// act: the ACTS entry (look, sky, wall, night, rain, festival). t: the clock. beat: 0..1 phase within the beat (the lights pulse).
export function drawCourtyard(ctx, cam, act, t, beat) {
  const S = cam.S, ppm = cam.ppm, oy = cam.oy;
  const floorBack = oy - 0.62 * ppm, wallTop = oy - 3.3 * ppm;
  // sky
  const g = ctx.createLinearGradient(0, S.y, 0, floorBack);
  g.addColorStop(0, act.sky[0]); g.addColorStop(0.55, act.sky[1]); g.addColorStop(1, act.sky[2]);
  ctx.fillStyle = g; ctx.fillRect(S.x, S.y, S.w, floorBack - S.y + 2);
  if (act.night) {
    for (let i = 0; i < 60; i++) {
      const x = S.x + hash(i) * S.w, y = S.y + hash(i + 70) * (floorBack - S.y) * 0.85, r = 0.7 + hash(i + 9) * 1.4;
      ctx.globalAlpha = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * (1 + hash(i + 3)) + i));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const mx = S.x + S.w * 0.78, my = S.y + (floorBack - S.y) * 0.2, mr = Math.max(18, ppm * 0.34);
    const mg = ctx.createRadialGradient(mx, my, mr * 0.2, mx, my, mr * 3.2); mg.addColorStop(0, 'rgba(255,248,214,0.55)'); mg.addColorStop(1, 'rgba(255,248,214,0)');
    ctx.fillStyle = mg; ctx.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
    ctx.fillStyle = '#fff6dc'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(180,170,200,0.35)'; ctx.beginPath(); ctx.arc(mx - mr * 0.3, my - mr * 0.15, mr * 0.22, 0, TAU); ctx.fill();
  } else {
    const sxn = S.x + S.w * 0.74, syn = floorBack - (floorBack - S.y) * 0.42, sr = Math.max(26, ppm * 0.5);
    const sg = ctx.createRadialGradient(sxn, syn, sr * 0.3, sxn, syn, sr * 4); sg.addColorStop(0, 'rgba(255,240,190,0.9)'); sg.addColorStop(0.25, 'rgba(255,200,120,0.4)'); sg.addColorStop(1, 'rgba(255,170,90,0)');
    ctx.fillStyle = sg; ctx.fillRect(S.x, S.y, S.w, floorBack - S.y);
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(sxn, syn, sr, 0, TAU); ctx.fill();
  }
  // clouds / far kites
  for (let i = 0; i < 4; i++) {
    const w = (150 + hash(i) * 180) * (ppm / 140), x = ((hash(i * 3 + 1) * 1.3 * S.w + t * (5 + i * 2)) % (S.w * 1.5)) - w * 0.5 + S.x - S.w * 0.15;
    const y = S.y + (floorBack - S.y) * (0.1 + 0.3 * hash(i * 7));
    ctx.fillStyle = act.night ? 'rgba(140,150,200,0.18)' : 'rgba(255,255,255,0.4)';
    for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x + (j - 1.5) * w * 0.2, y + (j % 2 ? -4 : 3), w * 0.19, w * 0.075, 0, 0, TAU); ctx.fill(); }
  }
  // far background by look
  if (act.look === 'dunes') drawDunes(ctx, cam, floorBack, t);
  else if (act.look === 'lake') drawLake(ctx, cam, floorBack, t, act);
  else if (act.look === 'fort') drawFort(ctx, cam, floorBack, act);
  else drawHaveli(ctx, cam, floorBack, wallTop, act, t, beat);
  drawFloor(ctx, cam, floorBack, act, t);
}

function drawDunes(ctx, cam, fb, t) {
  const S = cam.S, ppm = cam.ppm;
  const layer = (base, amp, col, k) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(S.x, fb + 2);
    for (let x = 0; x <= S.w + 8; x += 8) ctx.lineTo(S.x + x, fb - base * ppm - Math.sin(x * 0.006 * k + k) * amp * ppm - Math.sin(x * 0.015 * k) * amp * 0.3 * ppm);
    ctx.lineTo(S.x + S.w, fb + 2); ctx.closePath(); ctx.fill();
  };
  layer(1.6, 0.35, '#e9a15c', 1); layer(0.9, 0.3, '#d98a45', 1.7); layer(0.35, 0.18, '#c7753a', 2.4);
  // a distant fort silhouette
  ctx.fillStyle = 'rgba(150,80,60,0.55)'; const fx = S.x + S.w * 0.2, fy = fb - 1.7 * ppm;
  ctx.fillRect(fx, fy - 0.5 * ppm, 1.6 * ppm, 0.5 * ppm); for (let i = 0; i < 6; i++) ctx.fillRect(fx + i * 0.28 * ppm, fy - 0.62 * ppm, 0.16 * ppm, 0.12 * ppm);
  // a drifting haze
  ctx.fillStyle = 'rgba(255,230,180,0.12)'; ctx.fillRect(S.x, fb - 0.8 * ppm + Math.sin(t * 0.3) * 4, S.w, 0.8 * ppm);
}
function drawLake(ctx, cam, fb, t, act) {
  const S = cam.S, ppm = cam.ppm;
  // hills
  ctx.fillStyle = '#6b8fb8'; ctx.beginPath(); ctx.moveTo(S.x, fb); for (let x = 0; x <= S.w; x += 10) ctx.lineTo(S.x + x, fb - 1.3 * ppm - Math.sin(x * 0.011 + 1) * 0.5 * ppm); ctx.lineTo(S.x + S.w, fb); ctx.fill();
  const g = ctx.createLinearGradient(0, fb - 1.2 * ppm, 0, fb); g.addColorStop(0, '#9fd4ee'); g.addColorStop(1, '#3a8bc4');
  ctx.fillStyle = g; ctx.fillRect(S.x, fb - 0.9 * ppm, S.w, 0.9 * ppm + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) { const y = fb - (0.1 + i * 0.09) * ppm, x = S.x + ((hash(i) * S.w + t * 12 * (1 + i * 0.1)) % S.w); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.5 * ppm, y); ctx.stroke(); }
  // palace terrace balustrade
  const by = fb - 0.05 * ppm; ctx.fillStyle = '#f3e6cc'; ctx.fillRect(S.x, by - 0.34 * ppm, S.w, 0.34 * ppm);
  ctx.fillStyle = '#d9c7a4'; for (let x = S.x; x < S.x + S.w; x += 0.42 * ppm) ctx.fillRect(x, by - 0.3 * ppm, 0.12 * ppm, 0.3 * ppm);
  void act;
}
function drawFort(ctx, cam, fb, act) {
  const S = cam.S, ppm = cam.ppm, top = fb - 2.9 * ppm;
  const g = ctx.createLinearGradient(0, top, 0, fb); g.addColorStop(0, act.wall[0]); g.addColorStop(1, act.wall[1]);
  ctx.fillStyle = g; ctx.fillRect(S.x, top, S.w, fb - top + 2);
  const m = 0.34 * ppm; ctx.fillStyle = act.wall[0];
  for (let x = S.x; x < S.x + S.w; x += m * 1.7) ctx.fillRect(x, top - m * 0.7, m, m * 0.72);
  ctx.strokeStyle = 'rgba(80,40,20,0.3)'; ctx.lineWidth = 2;
  for (let r = 0; r < 6; r++) { const y = top + r * 0.5 * ppm; ctx.beginPath(); ctx.moveTo(S.x, y); ctx.lineTo(S.x + S.w, y); ctx.stroke(); for (let x = S.x + (r % 2) * 0.5 * ppm; x < S.x + S.w; x += ppm) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 0.5 * ppm); ctx.stroke(); } }
  // torches
  for (let i = 0; i < 3; i++) { const x = S.x + S.w * (0.18 + 0.32 * i), y = fb - 1.9 * ppm; ctx.fillStyle = '#4a2a14'; ctx.fillRect(x - 3, y, 6, 0.4 * ppm); const fg = ctx.createRadialGradient(x, y, 2, x, y, 0.5 * ppm); fg.addColorStop(0, 'rgba(255,200,90,0.9)'); fg.addColorStop(1, 'rgba(255,120,30,0)'); ctx.fillStyle = fg; ctx.fillRect(x - 0.5 * ppm, y - 0.5 * ppm, ppm, ppm); }
}

// The blue-washed haveli wall: a row of arched alcoves with lit doorways, a scalloped parapet, strings of bulbs.
function drawHaveli(ctx, cam, fb, wallTop, act, t, beat) {
  const S = cam.S, ppm = cam.ppm, top = Math.max(wallTop, fb - 3.2 * ppm);
  const g = ctx.createLinearGradient(0, top, 0, fb); g.addColorStop(0, act.wall[0]); g.addColorStop(1, act.wall[1]);
  ctx.fillStyle = g; ctx.fillRect(S.x, top, S.w, fb - top + 2);
  // parapet scallops
  ctx.fillStyle = act.wall[0];
  const sc = 0.42 * ppm;
  for (let x = S.x - sc; x < S.x + S.w + sc; x += sc) { ctx.beginPath(); ctx.arc(x + sc / 2, top, sc / 2, Math.PI, 0); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(S.x, top + 0.18 * ppm, S.w, 0.05 * ppm);
  // alcoves
  const aw = 1.05 * ppm, ah = 1.9 * ppm, gap = 0.5 * ppm, step = aw + gap;
  const x0 = S.x + (S.w % step) / 2 - step * 0.2;
  for (let x = x0; x < S.x + S.w; x += step) {
    const ax = x + gap / 2, ay = fb - ah;
    // frame
    ctx.fillStyle = 'rgba(255,244,222,0.9)'; archPath(ctx, ax - 0.07 * ppm, ay - 0.07 * ppm, aw + 0.14 * ppm, ah + 0.07 * ppm); ctx.fill();
    // lit interior
    const ig = ctx.createLinearGradient(0, ay, 0, fb);
    if (act.night) { ig.addColorStop(0, '#ffcf6a'); ig.addColorStop(1, '#ff9a3a'); } else { ig.addColorStop(0, '#3a1f4a'); ig.addColorStop(1, '#6a2d4a'); }
    ctx.fillStyle = ig; archPath(ctx, ax, ay, aw, ah); ctx.fill();
    // painted trim
    ctx.strokeStyle = act.night ? 'rgba(255,255,255,0.4)' : PAL.marigold; ctx.lineWidth = Math.max(2, ppm * 0.03); archPath(ctx, ax + 0.1 * ppm, ay + 0.1 * ppm, aw - 0.2 * ppm, ah - 0.1 * ppm); ctx.stroke();
    // a small lamp in the alcove
    const lx = ax + aw / 2, ly = fb - 0.34 * ppm, lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 0.55 * ppm);
    lg.addColorStop(0, 'rgba(255,214,120,0.95)'); lg.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx - 0.55 * ppm, ly - 0.55 * ppm, 1.1 * ppm, 1.1 * ppm);
  }
  // strings of bulbs
  const cols = ['#ffd45a', '#ff7aa2', '#7fe3d6', '#ffa25a'];
  for (let row = 0; row < 2; row++) {
    const y0 = top + (0.55 + row * 0.5) * ppm, sag = 0.28 * ppm, seg = 3.2 * ppm;
    ctx.strokeStyle = 'rgba(20,10,30,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let x = S.x - 8; x <= S.x + S.w + 8; x += 8) { const u = ((x - S.x + row * seg * 0.5) % seg) / seg, y = y0 + Math.sin(u * Math.PI) * sag; if (x === S.x - 8) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    for (let x = S.x + 6; x <= S.x + S.w; x += 0.5 * ppm) {
      const u = ((x - S.x + row * seg * 0.5) % seg) / seg, y = y0 + Math.sin(u * Math.PI) * sag, i = Math.round(x / (0.5 * ppm)) + row * 3;
      const pulse = 0.65 + 0.35 * Math.sin(t * 3 + i) * (0.5 + 0.5 * Math.cos(beat * TAU));
      const c = cols[i % cols.length], r = Math.max(2.5, ppm * 0.045);
      ctx.globalAlpha = 0.22 * pulse; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (act.festival) { // paper streamers
    for (let i = 0; i < 12; i++) { const x = S.x + (i + 0.5) * (S.w / 12); ctx.strokeStyle = cols[i % 4]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, top + 0.2 * ppm); ctx.bezierCurveTo(x + Math.sin(t + i) * 10, top + 0.8 * ppm, x - Math.sin(t * 1.3 + i) * 12, top + 1.1 * ppm, x + Math.sin(t + i * 2) * 8, top + 1.6 * ppm); ctx.stroke(); }
  }
}
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y + r); ctx.bezierCurveTo(x, y + r * 0.2, x + r * 0.6, y - r * 0.1, x + r, y - r * 0.55);
  ctx.bezierCurveTo(x + r * 1.4, y - r * 0.1, x + w, y + r * 0.2, x + w, y + r); ctx.lineTo(x + w, y + h); ctx.closePath();
}

// Floor: a tiled courtyard in perspective with a rangoli ring where the dancer stands.
function drawFloor(ctx, cam, fb, act, t) {
  const S = cam.S, ppm = cam.ppm, ox = cam.ox, oy = cam.oy, bottom = S.y + S.h;
  const g = ctx.createLinearGradient(0, fb, 0, bottom);
  g.addColorStop(0, act.night ? '#4a3a58' : '#c99c78'); g.addColorStop(1, act.night ? '#241a34' : '#7a4f3a');
  ctx.fillStyle = g; ctx.fillRect(S.x, fb, S.w, bottom - fb);
  // tile lines in perspective (vanishing point above the floor back edge)
  ctx.strokeStyle = 'rgba(30,14,10,0.22)'; ctx.lineWidth = 1.5;
  const vpY = fb - 1.5 * ppm;
  for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(ox + i * 0.45 * ppm * 0.5, fb); ctx.lineTo(ox + i * 1.3 * ppm, bottom + 4); ctx.stroke(); }
  for (let k = 1; k < 7; k++) { const y = fb + (bottom - fb) * (k / 7) ** 1.6; ctx.beginPath(); ctx.moveTo(S.x, y); ctx.lineTo(S.x + S.w, y); ctx.stroke(); }
  void vpY;
  // rangoli ring
  const cy = oy - 0.12 * ppm, rx = 1.9 * ppm, ry = 0.5 * ppm;
  const rg = ctx.createRadialGradient(ox, cy, 4, ox, cy, rx); rg.addColorStop(0, 'rgba(255,214,120,0.22)'); rg.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(ox, cy, rx * 1.15, ry * 1.3, 0, 0, TAU); ctx.fill();
  const rings = [[1, '#ffd45a'], [0.8, '#ff6f9c'], [0.6, '#27c4c0'], [0.4, '#fff4de']];
  ctx.lineWidth = Math.max(2, ppm * 0.03);
  for (const [k, c] of rings) { ctx.strokeStyle = c; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(ox, cy, rx * k, ry * k, 0, 0, TAU); ctx.stroke(); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU, px = ox + Math.cos(a) * rx * 0.9, py = cy + Math.sin(a) * ry * 0.9;
    ctx.fillStyle = i % 2 ? '#ffb52e' : '#ff6f9c'; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.ellipse(px, py, ppm * 0.075, ppm * 0.035, a, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  void t;
}

export function drawRain(ctx, S, t, ppm) {
  ctx.strokeStyle = 'rgba(200,225,255,0.55)'; ctx.lineWidth = 1.6;
  const n = 70, len = Math.max(12, ppm * 0.16);
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x0 = S.x + hash(i) * (S.w + 80) - 40, sp = 520 + hash(i + 5) * 380, y = S.y + (((hash(i + 11) * S.h + t * sp) % (S.h + 60)) - 30);
    ctx.moveTo(x0 + (y - S.y) * 0.12, y); ctx.lineTo(x0 + (y - S.y) * 0.12 + len * 0.14, y + len);
  }
  ctx.stroke();
}
