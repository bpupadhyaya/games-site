// Castells: the Catalan placa as a real lit 3D set (presentation only, no sim state).
// Stone facades with shuttered windows, balconies, an arcaded town hall with banners, a bell tower, terracotta roofs, bunting that
// sways in the wind, lanterns, a flagstone floor, a hazy mountain ridge behind the roofs. Everything is procedural: canvas textures
// and primitives, no image files. Built once; setPlaza() re-tints it for the four squares.
import { THREE } from '../vendor3d/index.js';

const {
  Group, Mesh, BoxGeometry, PlaneGeometry, CylinderGeometry, CircleGeometry, SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture,
  RepeatWrapping, SRGBColorSpace, InstancedMesh, Object3D, Color, DoubleSide, PointLight, Line, BufferGeometry, Vector3, LineBasicMaterial,
  LinearMipmapLinearFilter, Float32BufferAttribute, ExtrudeGeometry, Shape, Path, AdditiveBlending,
} = THREE;

const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mixHex = (a, b, t) => {
  const A = new Color(a), B = new Color(b); A.lerp(B, t); return `#${A.getHexString()}`;
};
const shade = (hex, amt) => {
  const c = new Color(hex);
  if (amt >= 0) c.lerp(new Color('#ffffff'), amt); else c.lerp(new Color('#000000'), -amt);
  return `#${c.getHexString()}`;
};
const mkCanvas = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
const tex = (c, { repeat = null, aniso = 4 } = {}) => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace; t.anisotropy = aniso; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true;
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
const noise = (g, w, h, n, a, seed) => {
  for (let i = 0; i < n; i++) {
    const x = hash(seed + i * 1.7) * w, y = hash(seed + i * 2.9) * h, s = 1 + hash(seed + i * 4.1) * 3;
    g.fillStyle = hash(seed + i * 5.3) > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`;
    g.fillRect(x, y, s, s);
  }
};

// ---- the flagstone floor --------------------------------------------------------------------------------------------------------
function floorTexture(plaza) {
  const N = 1024, c = mkCanvas(N, N), g = c.getContext('2d');
  const base = plaza.floor[0], dark = plaza.floor[1];
  g.fillStyle = dark; g.fillRect(0, 0, N, N);
  // 4 m x 4 m tile: slabs about 0.62 x 0.36 m in a running bond, each with its own tint and chipped edge
  const rows = 11, rh = N / rows;
  for (let r = 0; r < rows; r++) {
    let x = -hash(r * 3.3) * 160;
    while (x < N) {
      const w = 130 + hash(r * 17.1 + x) * 90, k = hash(r * 9.7 + x * 0.13);
      const col = mixHex(base, dark, 0.15 + k * 0.55);
      const y = r * rh;
      g.fillStyle = col; g.fillRect(x + 2, y + 2, w - 4, rh - 4);
      const gr = g.createLinearGradient(x, y, x + w, y + rh);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.16)');
      g.fillStyle = gr; g.fillRect(x + 2, y + 2, w - 4, rh - 4);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, w - 4, rh - 4);
      g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 4, y + rh - 4); g.lineTo(x + 4, y + 4); g.lineTo(x + w - 4, y + 4); g.stroke();
      x += w;
    }
  }
  noise(g, N, N, 5200, 0.07, 11);
  // worn darker patches
  for (let i = 0; i < 14; i++) {
    const rg = g.createRadialGradient(hash(i * 3.1) * N, hash(i * 7.7) * N, 4, hash(i * 3.1) * N, hash(i * 7.7) * N, 80 + hash(i) * 120);
    rg.addColorStop(0, 'rgba(20,14,10,0.12)'); rg.addColorStop(1, 'rgba(20,14,10,0)');
    g.fillStyle = rg; g.fillRect(0, 0, N, N);
  }
  return tex(c, { repeat: [14, 8], aniso: 8 });
}

// ---- facades --------------------------------------------------------------------------------------------------------------------
const SHUTTERS = ['#3f6a47', '#6b3f2a', '#2f4f7a', '#4f6a3a', '#7a2f2a'];
function paintFacade(o) {
  const ppm = 44, W = Math.round(o.w * ppm), H = Math.round(o.h * ppm);
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const ce = mkCanvas(W, H), ge = ce.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const { wall, lamps, seed } = o;
  const trim = shade(wall, 0.35), stone = shade(wall, -0.2);
  // plaster
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, shade(wall, 0.06)); bg.addColorStop(1, shade(wall, -0.1));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  noise(g, W, H, Math.round(W * H / 90), 0.05, seed * 3.7);
  for (let i = 0; i < 9; i++) {         // rain streaks
    const x = hash(seed + i * 5.1) * W;
    const sg = g.createLinearGradient(0, 0, 0, H * 0.7); sg.addColorStop(0, 'rgba(60,40,20,0.0)'); sg.addColorStop(0.5, 'rgba(60,40,20,0.07)'); sg.addColorStop(1, 'rgba(60,40,20,0)');
    g.fillStyle = sg; g.fillRect(x, H * 0.1, 3 + hash(seed + i) * 5, H * 0.7);
  }
  const gh = (o.ground || 3.5) * ppm;                       // ground storey (px)
  // ashlar ground floor
  g.fillStyle = stone; g.fillRect(0, H - gh, W, gh);
  const courseH = 0.42 * ppm;
  for (let r = 0, y = H - gh; y < H; r++, y += courseH) {
    let x = -hash(seed + r) * 40;
    while (x < W) {
      const bw = (0.7 + hash(seed * 2 + r * 7 + x) * 0.55) * ppm;
      g.fillStyle = shade(stone, (hash(seed + r * 11 + x * 0.3) - 0.5) * 0.18); g.fillRect(x + 1, y + 1, bw - 2, courseH - 2);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.strokeRect(x + 1, y + 1, bw - 2, courseH - 2);
      x += bw;
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, H - gh - 3, W, 3);
  g.fillStyle = trim; g.fillRect(0, H - gh - 9, W, 6);
  // ground openings: arched doors and shop fronts with awnings
  const gcols = Math.max(2, Math.round(o.w / 3.1));
  for (let q = 0; q < gcols; q++) {
    const cx = (q + 0.5) * W / gcols, dw = 1.5 * ppm, dh = 2.55 * ppm, dy = H - dh;
    const kind = Math.floor(hash(seed * 5 + q * 3.3) * 3);
    g.fillStyle = trim; g.beginPath(); g.moveTo(cx - dw / 2 - 5, H); g.lineTo(cx - dw / 2 - 5, dy + dw / 2); g.arc(cx, dy + dw / 2, dw / 2 + 5, Math.PI, 0); g.lineTo(cx + dw / 2 + 5, H); g.fill();
    const dg = g.createLinearGradient(0, dy, 0, H);
    if (kind === 0) { dg.addColorStop(0, '#2c1c12'); dg.addColorStop(1, '#4a2e1c'); }
    else if (kind === 1) { dg.addColorStop(0, lamps ? '#ffd48a' : '#26303a'); dg.addColorStop(1, lamps ? '#e8a84a' : '#38444f'); }
    else { dg.addColorStop(0, '#14100d'); dg.addColorStop(1, '#2a1f18'); }
    g.fillStyle = dg; g.beginPath(); g.moveTo(cx - dw / 2, H); g.lineTo(cx - dw / 2, dy + dw / 2); g.arc(cx, dy + dw / 2, dw / 2, Math.PI, 0); g.lineTo(cx + dw / 2, H); g.fill();
    if (kind === 1 && lamps) { ge.fillStyle = '#c88a3a'; ge.beginPath(); ge.moveTo(cx - dw / 2, H); ge.lineTo(cx - dw / 2, dy + dw / 2); ge.arc(cx, dy + dw / 2, dw / 2, Math.PI, 0); ge.lineTo(cx + dw / 2, H); ge.fill(); }
    if (kind === 0) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; for (let p = -2; p <= 2; p++) { g.beginPath(); g.moveTo(cx + p * dw * 0.18, dy + dw * 0.5); g.lineTo(cx + p * dw * 0.18, H); g.stroke(); } }
    if (kind === 1) {   // striped awning
      const ay = dy - 0.15 * ppm, aw = dw * 1.5, ah = 0.5 * ppm, cols = hash(seed + q * 9) > 0.5 ? ['#c43c2e', '#f2ead6'] : ['#2f7d5a', '#f2ead6'];
      for (let s = 0; s < 8; s++) { g.fillStyle = cols[s % 2]; g.beginPath(); g.moveTo(cx - aw / 2 + s * aw / 8, ay); g.lineTo(cx - aw / 2 + (s + 1) * aw / 8, ay); g.lineTo(cx - aw / 2 + (s + 1) * aw / 8 + 3, ay + ah); g.lineTo(cx - aw / 2 + s * aw / 8 + 3, ay + ah); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - aw / 2, ay + ah, aw, 4);
    }
  }
  // upper floors
  const floorH = 3.1 * ppm, upper = H - gh;
  const floors = Math.max(1, Math.floor((upper - 1.6 * ppm) / floorH));
  const ucols = Math.max(2, Math.round(o.w / 2.45));
  for (let f = 0; f < floors; f++) {
    const yTop = upper - (f + 1) * floorH;
    g.fillStyle = trim; g.fillRect(0, yTop + floorH - 6, W, 5);
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, yTop + floorH - 1, W, 3);
    for (let q = 0; q < ucols; q++) {
      const cx = (q + 0.5) * W / ucols, ww = 1.05 * ppm, wh = 1.9 * ppm, wy = yTop + floorH * 0.5 - wh * 0.5;
      const k = hash(seed * 13 + f * 5.1 + q * 2.3);
      const arch = k > 0.45;
      // reveal and frame
      g.fillStyle = trim;
      g.beginPath(); g.moveTo(cx - ww / 2 - 6, wy + wh + 4); g.lineTo(cx - ww / 2 - 6, wy + (arch ? ww / 2 : 0)); if (arch) g.arc(cx, wy + ww / 2, ww / 2 + 6, Math.PI, 0); else { g.lineTo(cx - ww / 2 - 6, wy - 6); g.lineTo(cx + ww / 2 + 6, wy - 6); } g.lineTo(cx + ww / 2 + 6, wy + wh + 4); g.fill();
      // glass: dusk reflection, or a warm lit room
      const lit = lamps && hash(seed * 7 + f * 3 + q * 1.9) > 0.35;
      const gg = g.createLinearGradient(0, wy, 0, wy + wh);
      if (lit) { gg.addColorStop(0, '#ffe2a0'); gg.addColorStop(1, '#f0a850'); } else { gg.addColorStop(0, o.sky); gg.addColorStop(1, '#1d2432'); }
      g.fillStyle = gg;
      g.beginPath(); g.moveTo(cx - ww / 2, wy + wh); g.lineTo(cx - ww / 2, wy + (arch ? ww / 2 : 0)); if (arch) g.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0); else { g.lineTo(cx - ww / 2, wy); g.lineTo(cx + ww / 2, wy); } g.lineTo(cx + ww / 2, wy + wh); g.fill();
      if (lit) { ge.fillStyle = '#9a6020'; ge.beginPath(); ge.moveTo(cx - ww / 2, wy + wh); ge.lineTo(cx - ww / 2, wy + (arch ? ww / 2 : 0)); if (arch) ge.arc(cx, wy + ww / 2, ww / 2, Math.PI, 0); else { ge.lineTo(cx - ww / 2, wy); ge.lineTo(cx + ww / 2, wy); } ge.lineTo(cx + ww / 2, wy + wh); ge.fill(); }
      g.strokeStyle = 'rgba(30,24,20,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, wy + (arch ? 2 : 0)); g.lineTo(cx, wy + wh); g.moveTo(cx - ww / 2, wy + wh * 0.5); g.lineTo(cx + ww / 2, wy + wh * 0.5); g.stroke();
      // shutters: open leaves at both sides (louvres), or closed
      const sc = SHUTTERS[Math.floor(hash(seed + 31) * SHUTTERS.length)];
      const sk = hash(seed * 3 + f * 8.8 + q * 4.7);
      const leaf = (x0, w0) => {
        g.fillStyle = lamps ? shade(sc, -0.4) : sc; g.fillRect(x0, wy - 2, w0, wh + 4);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5;
        for (let y = wy + 3; y < wy + wh; y += 5) { g.beginPath(); g.moveTo(x0 + 1, y); g.lineTo(x0 + w0 - 1, y); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.strokeRect(x0, wy - 2, w0, wh + 4);
      };
      if (sk < 0.62) { leaf(cx - ww / 2 - ww * 0.5, ww * 0.46); leaf(cx + ww / 2 + ww * 0.04, ww * 0.46); }
      else if (sk < 0.8) { leaf(cx - ww / 2, ww / 2); leaf(cx, ww / 2); }
      // sill
      g.fillStyle = shade(trim, 0.1); g.fillRect(cx - ww / 2 - 9, wy + wh + 3, ww + 18, 7);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - ww / 2 - 9, wy + wh + 10, ww + 18, 3);
      // balcony railing on the first floor
      if (f === 0 && hash(seed + q * 17) > 0.25) {
        const by = wy + wh - 2;
        g.fillStyle = '#16151a'; g.fillRect(cx - ww * 0.9, by - 0.9 * ppm * 0.45, ww * 1.8, 3);
        g.fillRect(cx - ww * 0.9, by - 3, ww * 1.8, 4);
        g.strokeStyle = '#16151a'; g.lineWidth = 2;
        for (let b = 0; b <= 10; b++) { g.beginPath(); g.moveTo(cx - ww * 0.9 + b * ww * 0.18, by - 0.9 * ppm * 0.45); g.lineTo(cx - ww * 0.9 + b * ww * 0.18, by); g.stroke(); }
        g.fillStyle = shade(trim, -0.05); g.fillRect(cx - ww * 1.05, by + 2, ww * 2.1, 9);
        if (hash(seed + q * 5) > 0.5) { g.fillStyle = '#4c8a3c'; g.beginPath(); g.arc(cx - ww * 0.5, by - 5, 7, 0, 7); g.arc(cx + ww * 0.4, by - 6, 8, 0, 7); g.fill(); g.fillStyle = '#d6453a'; g.beginPath(); g.arc(cx - ww * 0.5, by - 9, 3, 0, 7); g.arc(cx + ww * 0.45, by - 10, 3.5, 0, 7); g.fill(); }
      }
    }
  }
  // cornice and eaves brackets
  g.fillStyle = shade(trim, 0.08); g.fillRect(0, 0, W, 0.42 * ppm);
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0.42 * ppm, W, 5);
  g.fillStyle = shade(wall, -0.3);
  for (let x = 6; x < W; x += 20) g.fillRect(x, 0.42 * ppm, 8, 0.2 * ppm);
  // soft vertical shading toward the edges (fake ambient occlusion)
  const eg = g.createLinearGradient(0, 0, W, 0); eg.addColorStop(0, 'rgba(0,0,0,0.22)'); eg.addColorStop(0.1, 'rgba(0,0,0,0)'); eg.addColorStop(0.9, 'rgba(0,0,0,0)'); eg.addColorStop(1, 'rgba(0,0,0,0.2)');
  g.fillStyle = eg; g.fillRect(0, 0, W, H);
  // light: the low sun rakes the upper storeys, the street itself is in cool shade
  const lg = g.createLinearGradient(0, 0, 0, H);
  if (o.tone === 'night') { lg.addColorStop(0, 'rgba(60,70,140,0.18)'); lg.addColorStop(1, 'rgba(10,10,40,0.40)'); }
  else if (o.tone === 'day') { lg.addColorStop(0, 'rgba(255,248,220,0.14)'); lg.addColorStop(1, 'rgba(60,70,110,0.20)'); }
  else { lg.addColorStop(0, 'rgba(255,170,90,0.24)'); lg.addColorStop(0.55, 'rgba(255,150,90,0.04)'); lg.addColorStop(1, 'rgba(40,30,80,0.34)'); }
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  return { map: tex(c), emissive: lamps ? tex(ce) : null };
}

function paintTower(plaza, seed) {
  const ppm = 44, W = Math.round(3.6 * ppm), H = Math.round(26 * ppm);
  const c = mkCanvas(W, H), g = c.getContext('2d');
  const wall = shade(plaza.walls[1], -0.08), trim = shade(wall, 0.3);
  const bg = g.createLinearGradient(0, 0, W, 0); bg.addColorStop(0, shade(wall, 0.1)); bg.addColorStop(1, shade(wall, -0.2));
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let y = 0, r = 0; y < H; y += 0.5 * ppm, r++) {
    let x = -hash(r * 3.1) * 30;
    while (x < W) { const bw = (0.7 + hash(r * 9 + x) * 0.6) * ppm; g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.5; g.strokeRect(x, y, bw, 0.5 * ppm); g.fillStyle = `rgba(${hash(r + x) > 0.5 ? '255,255,255' : '0,0,0'},0.03)`; g.fillRect(x + 1, y + 1, bw - 2, 0.5 * ppm - 2); x += bw; }
  }
  // belfry: three arched openings
  const by = 2.2 * ppm, bh = 4 * ppm;
  g.fillStyle = trim; g.fillRect(0, by - 8, W, 8); g.fillRect(0, by + bh, W, 8);
  for (let i = 0; i < 2; i++) {
    const cx = W * (0.3 + 0.4 * i), aw = 0.95 * ppm;
    g.fillStyle = '#0c0a10'; g.beginPath(); g.moveTo(cx - aw / 2, by + bh); g.lineTo(cx - aw / 2, by + aw); g.arc(cx, by + aw / 2 + 8, aw / 2, Math.PI, 0); g.lineTo(cx + aw / 2, by + bh); g.fill();
    g.fillStyle = '#6a5a34'; g.beginPath(); g.arc(cx, by + bh * 0.62, 0.3 * ppm, 0, 7); g.fill();
  }
  // clock
  const ky = by + bh + 3 * ppm, kr = 1.1 * ppm;
  g.fillStyle = trim; g.beginPath(); g.arc(W / 2, ky, kr + 7, 0, 7); g.fill();
  g.fillStyle = '#efe6cf'; g.beginPath(); g.arc(W / 2, ky, kr, 0, 7); g.fill();
  g.strokeStyle = '#1b1812'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(W / 2, ky); g.lineTo(W / 2 + 0.2 * kr, ky - 0.75 * kr); g.moveTo(W / 2, ky); g.lineTo(W / 2 + 0.55 * kr, ky + 0.3 * kr); g.stroke();
  for (let h = 0; h < 12; h++) { const a = h * Math.PI / 6; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * kr * 0.82, ky + Math.sin(a) * kr * 0.82); g.lineTo(W / 2 + Math.cos(a) * kr * 0.95, ky + Math.sin(a) * kr * 0.95); g.stroke(); }
  // slit windows
  for (let k = 0; k < 4; k++) { const y = by + bh + 6.5 * ppm + k * 3.2 * ppm; g.fillStyle = '#17141a'; g.fillRect(W / 2 - 4, y, 8, 1.2 * ppm); }
  void seed;
  return tex(c);
}

function roofTexture(plaza) {
  const c = mkCanvas(256, 128), g = c.getContext('2d');
  const base = plaza.lamps ? '#6e3a2a' : '#b5583a';
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 16; q++) {
    const x = q * 16 + (r % 2) * 8, y = r * 16;
    g.fillStyle = shade(base, (hash(r * 13 + q) - 0.5) * 0.3); g.fillRect(x + 1, y + 1, 14, 15);
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x, y + 12, 16, 4); g.fillRect(x + 14, y, 2, 16);
  }
  return tex(c, { repeat: [3, 1] });
}

// ---- sky and the mountain ridge (pinned to the camera: they do not parallax) ------------------------------------------------------
function skyTexture(plaza, night) {
  const W = 512, H = 768, c = mkCanvas(W, H), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, plaza.sky[0]); gr.addColorStop(0.55, plaza.sky[1]); gr.addColorStop(1, plaza.sky[2]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // sun / moon glow
  const sx = plaza.name === 'Lantern night' ? W * 0.78 : W * 0.2, sy = H * 0.34;
  const rg = g.createRadialGradient(sx, sy, 2, sx, sy, W * 0.6); rg.addColorStop(0, plaza.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg; g.fillRect(0, 0, W, H);
  g.fillStyle = plaza.sun; g.beginPath(); g.arc(sx, sy, 17, 0, 7); g.fill();
  if (night) { g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { g.globalAlpha = 0.3 + hash(i) * 0.7; g.fillRect(hash(i * 2.1) * W, hash(i * 3.7) * H * 0.6, 1.6, 1.6); } g.globalAlpha = 1; }
  // streaky clouds
  for (let i = 0; i < 9; i++) {
    const y = H * (0.12 + hash(i * 3) * 0.5), x = hash(i * 7) * W, w = 120 + hash(i) * 180;
    const cg = g.createRadialGradient(x, y, 2, x, y, w); cg.addColorStop(0, night ? 'rgba(120,130,190,0.18)' : 'rgba(255,230,220,0.30)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.save(); g.translate(x, y); g.scale(1, 0.14); g.translate(-x, -y); g.fillStyle = cg; g.fillRect(x - w, y - w, 2 * w, 2 * w); g.restore();
  }
  return tex(c, { aniso: 1 });
}
function ridgeTexture(plaza) {
  const W = 1024, H = 256, c = mkCanvas(W, H), g = c.getContext('2d');
  const base = mixHex(plaza.sky[1], plaza.walls[2], 0.15), top = mixHex(base, plaza.sky[0], 0.4);
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, base);
  g.fillStyle = gr;
  // a serrated, rounded-peak ridge (the Montserrat silhouette: many bulbous stone pinnacles)
  g.beginPath(); g.moveTo(0, H);
  let x = 0;
  while (x < W) {
    const h = 60 + hash(x * 0.37) * 120, w = 22 + hash(x * 0.91) * 36;
    g.lineTo(x, H - h * 0.35); g.quadraticCurveTo(x + w * 0.25, H - h * 1.05, x + w * 0.5, H - h);
    g.quadraticCurveTo(x + w * 0.75, H - h * 1.0, x + w, H - h * 0.4);
    x += w;
  }
  g.lineTo(W, H); g.closePath(); g.fill();
  const vg = g.createLinearGradient(0, H * 0.4, 0, H); vg.addColorStop(0, 'rgba(255,255,255,0)'); vg.addColorStop(1, 'rgba(255,230,210,0.35)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  return tex(c, { aniso: 1 });
}

// soft shadow blob
function blobTexture() {
  const c = mkCanvas(128, 128), g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,0.75)'); r.addColorStop(0.6, 'rgba(0,0,0,0.35)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return tex(c, { aniso: 1 });
}
function glowTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 1, 32, 32, 31); r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(0.35, 'rgba(255,190,100,0.45)'); r.addColorStop(1, 'rgba(255,180,90,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return tex(c, { aniso: 1 });
}

// ---- the set ----------------------------------------------------------------------------------------------------------------------
export function createPlaza({ quality = 'medium' } = {}) {
  const root = new Group(); root.name = 'plaza';
  const camAttached = new Group(); camAttached.name = 'plazaCam';   // sky and ridge: add to the camera
  const disposables = [];
  const stdMat = (o) => { const m = new MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o }); disposables.push(m); return m; };

  // floor
  const floorMat = stdMat({ roughness: 0.82 });
  const floor = new Mesh(new PlaneGeometry(90, 52), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -8);
  root.add(floor);

  // facades
  const row = new Group(); root.add(row);
  const buildings = [];       // { mesh materials to refresh }
  const BLD = [];
  { // deterministic street: x from -34 to 34
    let x = -36, i = 0;
    while (x < 36) {
      const w = 5.6 + hash(i * 3.7) * 3.2, h = 9.5 + hash(i * 5.1) * 5.5, z = -8.4 - hash(i * 2.3) * 0.9 + (i % 3 === 1 ? 0.7 : 0);
      BLD.push({ x: x + w / 2, w, h, z, i });
      x += w; i++;
    }
  }
  const roofMat = stdMat({ roughness: 0.9 });
  const trimMat = stdMat({ roughness: 0.9 });
  const sideMat = stdMat({ roughness: 0.95 });
  for (const b of BLD) {
    const geo = new BoxGeometry(b.w, b.h, 1.4);
    const front = stdMat({});
    const mats = [sideMat, sideMat, trimMat, trimMat, front, sideMat];
    const m = new Mesh(geo, mats);
    m.position.set(b.x, b.h / 2, b.z);
    // roof: a pitched prism (triangle cylinder) plus a chimney
    const rg = new CylinderGeometry(1, 1, b.w + 0.5, 3);
    const roof = new Mesh(rg, roofMat);
    roof.rotation.z = Math.PI / 2; roof.rotation.y = 0; roof.rotation.x = 0;
    roof.scale.set(0.9 + 0.2 * hash(b.i), 1, 1.25);
    // after rotation.z=90deg the triangle apex points +x; rotate about x axis to make it point up
    roof.rotation.set(0, 0, Math.PI / 2);
    roof.rotateOnWorldAxis(new Vector3(1, 0, 0), -Math.PI / 2);
    roof.position.set(b.x, b.h + 0.55, b.z - 0.1);
    row.add(m, roof);
    if (hash(b.i * 9.1) > 0.35) {
      const ch = new Mesh(new BoxGeometry(0.7, 1.6, 0.7), sideMat);
      ch.position.set(b.x + (hash(b.i * 4) - 0.5) * b.w * 0.5, b.h + 1.7, b.z - 0.3); row.add(ch);
    }
    buildings.push({ b, front, mesh: m });
  }
  // town hall: wide arcaded block in the middle with a balcony and banners
  const hall = new Group(); root.add(hall);
  const hallMat = stdMat({});
  const HW = 13.5, HH = 13.0;
  const hallBody = new Mesh(new BoxGeometry(HW, HH, 2.2), [sideMat, sideMat, trimMat, trimMat, hallMat, sideMat]);
  hallBody.position.set(1.5, HH / 2, -7.0); hall.add(hallBody);
  const hallRoof = new Mesh(new CylinderGeometry(1, 1, HW + 0.8, 3), roofMat);
  hallRoof.rotation.set(0, 0, Math.PI / 2); hallRoof.rotateOnWorldAxis(new Vector3(1, 0, 0), -Math.PI / 2);
  hallRoof.scale.set(1.9, 1, 1.9); hallRoof.position.set(1.5, HH + 0.9, -7.1); hall.add(hallRoof);
  // arcade columns and the arches' soffits
  const colMat = stdMat({ roughness: 0.75 });
  for (let k = 0; k < 4; k++) {
    const x = 1.5 - HW / 2 + HW * (k + 0.5) / 4 - 0 + (k === 0 ? 0 : 0);
    void x;
  }
  const colX = [-3.6, -0.0, 3.6, 7.2].map((v) => v - 0.6);
  for (const cx of colX) {
    const col = new Mesh(new CylinderGeometry(0.22, 0.26, 3.4, 14), colMat); col.position.set(cx, 1.7, -5.7); hall.add(col);
    const cap = new Mesh(new BoxGeometry(0.62, 0.22, 0.62), colMat); cap.position.set(cx, 3.5, -5.7); hall.add(cap);
    const base = new Mesh(new BoxGeometry(0.62, 0.2, 0.62), colMat); base.position.set(cx, 0.1, -5.7); hall.add(base);
  }
  const arcBeam = new Mesh(new BoxGeometry(HW - 0.8, 0.5, 0.7), colMat); arcBeam.position.set(1.5, 3.7, -5.7); hall.add(arcBeam);
  // balcony slab and railing above the arcade
  const slab = new Mesh(new BoxGeometry(7.4, 0.28, 1.1), colMat); slab.position.set(1.5, 4.2, -6.0); hall.add(slab);
  const railMat = stdMat({ color: '#15141a', roughness: 0.5, metalness: 0.6 });
  const rail = new Mesh(new BoxGeometry(7.4, 0.07, 0.07), railMat); rail.position.set(1.5, 5.25, -5.5); hall.add(rail);
  for (let b = 0; b <= 28; b++) { const p = new Mesh(new CylinderGeometry(0.022, 0.022, 1.0, 5), railMat); p.position.set(1.5 - 3.6 + b * 0.257, 4.75, -5.5); hall.add(p); }
  // lanterns on the arcade columns
  const lampMat = new MeshBasicMaterial({ color: '#ffd9a0' }); disposables.push(lampMat);
  const lamps = [];
  for (const lx of [-8.0, 5.2, 11.5, -13.5]) {
    const arm = new Mesh(new BoxGeometry(0.06, 0.06, 0.5), railMat); arm.position.set(lx, 3.9, -6.5); root.add(arm);
    const lamp = new Mesh(new BoxGeometry(0.26, 0.4, 0.26), lampMat); lamp.position.set(lx, 3.75, -6.1); root.add(lamp);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.0 }));
    glow.scale.set(2.6, 2.6, 1); glow.position.set(lx, 3.75, -5.9); root.add(glow);
    lamps.push({ lamp, glow });
  }
  // banners hanging from the balcony and the hall: plain cloth, wind-driven
  const bannerGeo = [];
  const BAN = [];
  const bannerColors = ['#c4553a', '#f2ead6', '#2f6fc0', '#dd9a22', '#2e9a5f', '#7a4aa6'];
  const bannerTex = (col) => {
    const c = mkCanvas(96, 320), g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, 96, 320);
    const gl = g.createLinearGradient(0, 0, 96, 0); gl.addColorStop(0, 'rgba(255,255,255,0.18)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.22)');
    g.fillStyle = gl; g.fillRect(0, 0, 96, 320);
    g.strokeStyle = 'rgba(250,236,190,0.95)'; g.lineWidth = 6; g.strokeRect(8, 8, 80, 290);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.strokeRect(14, 14, 68, 278);
    // a woven diamond motif (plain ornament, no emblem)
    g.fillStyle = 'rgba(250,236,190,0.9)';
    for (let k = 0; k < 3; k++) { const y = 70 + k * 70; g.beginPath(); g.moveTo(48, y - 24); g.lineTo(70, y); g.lineTo(48, y + 24); g.lineTo(26, y); g.closePath(); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(48, y - 12); g.lineTo(58, y); g.lineTo(48, y + 12); g.lineTo(38, y); g.closePath(); g.fill(); g.fillStyle = 'rgba(250,236,190,0.9)'; }
    // fringe
    g.fillStyle = 'rgba(240,210,120,0.95)'; for (let x = 6; x < 90; x += 8) g.fillRect(x, 304, 4, 16);
    return tex(c, { aniso: 2 });
  };
  const banTexCache = {};
  const addBanner = (x, y, w, h, ci, z) => {
    const g = new PlaneGeometry(w, h, 3, 8);
    const col = bannerColors[ci % bannerColors.length];
    const map = banTexCache[col] || (banTexCache[col] = bannerTex(col));
    const m = new MeshStandardMaterial({ map, roughness: 0.8, side: DoubleSide }); disposables.push(m);
    const mesh = new Mesh(g, m); mesh.position.set(x, y - h / 2, z);
    const rodMesh = new Mesh(new BoxGeometry(w + 0.25, 0.07, 0.07), railMat); rodMesh.position.set(x, y + 0.03, z);
    root.add(mesh, rodMesh);
    const p0 = g.attributes.position.array.slice();
    BAN.push({ mesh, g, p0, h, w, ph: hash(x * 3.1 + y) * 6 });
    bannerGeo.push(g);
  };
  for (let k = 0; k < 6; k++) addBanner(-4.2 + k * 2.1, 12.0, 0.95, 3.1 - (k % 2) * 0.5, k, -5.85);
  for (let k = 0; k < 3; k++) addBanner(-7.4 + k * 1.7, 7.4, 0.8, 2.2, k + 2, -5.7);
  addBanner(10.6, 8.6, 0.95, 3.2, 1, -5.7);

  // a warm pool of low sun on the flagstones where the tower stands (additive, soft)
  const poolTex = (() => { const c = mkCanvas(128, 128), g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 2, 64, 64, 62); r.addColorStop(0, 'rgba(255,214,150,0.55)'); r.addColorStop(0.5, 'rgba(255,190,120,0.2)'); r.addColorStop(1, 'rgba(255,180,100,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return tex(c, { aniso: 1 }); })();
  const poolGeo = new PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
  const poolMat = new MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: AdditiveBlending }); disposables.push(poolMat);
  const pool = new Mesh(poolGeo, poolMat); pool.scale.set(11, 1, 6); pool.position.set(0.5, 0.02, 0.2); pool.renderOrder = 2; root.add(pool);

  // bell tower
  const towerMat = stdMat({});
  const towerBody = new Mesh(new BoxGeometry(3.6, 26, 3.6), [sideMat, sideMat, trimMat, trimMat, towerMat, sideMat]);
  towerBody.position.set(-12.5, 13, -10.5); root.add(towerBody);
  const spire = new Mesh(new CylinderGeometry(0.05, 2.7, 5.2, 4), roofMat);
  spire.rotation.y = Math.PI / 4; spire.position.set(-12.5, 28.4, -10.5); root.add(spire);

  // bunting: three strings of pennants between the facades
  const penCount = 3 * 62;
  const penGeo = new PlaneGeometry(0.2, 0.28);
  penGeo.translate(0, -0.14, 0);
  const penMat = new MeshBasicMaterial({ side: DoubleSide, vertexColors: false }); disposables.push(penMat);
  const pennants = new InstancedMesh(penGeo, penMat, penCount); pennants.frustumCulled = false;
  root.add(pennants);
  const STR = [
    { y0: 11.2, y1: 10.8, sag: 1.0, z: -4.4, x0: -26, x1: 26 },
    { y0: 9.1, y1: 9.5, sag: 0.9, z: -3.2, x0: -26, x1: 26 },
    { y0: 12.4, y1: 12.0, sag: 1.2, z: -5.6, x0: -26, x1: 26 },
  ];
  const penCol = ['#f4efe2', '#33a89a', '#f0b84a', '#d9674b', '#c43c2e', '#2f6fc0'];
  const strLines = [];
  for (const s of STR) {
    const pts = [];
    for (let k = 0; k <= 48; k++) { const u = k / 48; pts.push(new Vector3(s.x0 + (s.x1 - s.x0) * u, s.y0 + (s.y1 - s.y0) * u - Math.sin(u * Math.PI) * s.sag * 2.2, s.z)); }
    const geo = new BufferGeometry().setFromPoints(pts);
    const lm = new LineBasicMaterial({ color: '#2a2230' }); disposables.push(lm);
    const ln = new Line(geo, lm); root.add(ln); strLines.push(ln);
  }
  const dummy = new Object3D();
  const col = new Color();
  const setPennants = (t) => {
    let n = 0;
    STR.forEach((s, si) => {
      for (let k = 1; k <= 61; k++) {
        const u = k / 62;
        dummy.position.set(s.x0 + (s.x1 - s.x0) * u, s.y0 + (s.y1 - s.y0) * u - Math.sin(u * Math.PI) * s.sag * 2.2, s.z);
        dummy.rotation.set(0, 0, 0);
        dummy.rotation.z = Math.sin(t * 2.1 + k * 0.7 + si * 2) * 0.16 + Math.sin(t * 0.7 + k) * 0.05;
        dummy.rotation.y = Math.sin(t * 1.6 + k * 1.1 + si) * 0.35;
        dummy.updateMatrix(); pennants.setMatrixAt(n, dummy.matrix);
        n++;
      }
    });
    pennants.instanceMatrix.needsUpdate = true;
  };
  {
    let n = 0;
    for (let si = 0; si < STR.length; si++) for (let k = 1; k <= 61; k++) { col.set(penCol[(k + si * 2) % penCol.length]); pennants.setColorAt(n++, col); }
    pennants.count = n;
    if (pennants.instanceColor) pennants.instanceColor.needsUpdate = true;
  }

  // soft shadow blobs under people + the tower's long shadow
  const blobTex = blobTexture();
  const blobMat = new MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 1 }); disposables.push(blobMat);
  const blobGeo = new PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const blobs = [];
  const blobGroup = new Group(); root.add(blobGroup);
  const blob = (i) => {
    while (blobs.length <= i) { const m = new Mesh(blobGeo, blobMat); m.renderOrder = 1; m.visible = false; blobGroup.add(m); blobs.push(m); }
    return blobs[i];
  };
  const shadowTower = new Mesh(blobGeo, blobMat); shadowTower.renderOrder = 1; shadowTower.visible = false; root.add(shadowTower);

  // sky + ridge on the camera
  const skyMat = new MeshBasicMaterial({ depthWrite: false, fog: false }); disposables.push(skyMat);
  const sky = new Mesh(new PlaneGeometry(1, 1), skyMat); sky.renderOrder = -10; sky.position.set(0, 0, -150);
  sky.scale.set(150, 220, 1);
  const ridgeMat = new MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }); disposables.push(ridgeMat);
  const ridge = new Mesh(new PlaneGeometry(1, 1), ridgeMat); ridge.renderOrder = -9; ridge.position.set(0, -2, -140);
  ridge.scale.set(210, 52, 1);
  camAttached.add(sky, ridge);

  // optional point lights for the lantern squares
  const pl = [new PointLight('#ffb865', 0, 16, 1.6), new PointLight('#ffb865', 0, 16, 1.6)];
  pl[0].position.set(-3.5, 4.2, 1.5); pl[1].position.set(4.5, 4.2, 1.2);
  root.add(...pl);

  let cur = { idx: -1, textures: [] };
  const api = {
    root, camAttached, floor, blob, shadowTower, lamps, blobs,
    setPlaza(idx, plaza) {
      if (cur.idx === idx) return;
      cur.idx = idx;
      for (const t of cur.textures) t.dispose();
      cur.textures = [];
      const night = plaza.name === 'Lantern night';
      const lampsOn = !!plaza.lamps;
      const tone = night ? 'night' : plaza.name === 'Morning square' ? 'day' : 'dusk';
      const ft = floorTexture(plaza); cur.textures.push(ft);
      floorMat.map = ft; floorMat.color.set('#ffffff'); floorMat.needsUpdate = true;
      const rt = roofTexture(plaza); cur.textures.push(rt); roofMat.map = rt; roofMat.needsUpdate = true;
      const wallBase = mixHex(plaza.walls[0], '#b87a52', 0.2);
      trimMat.color.set(shade(wallBase, -0.25)); sideMat.color.set(shade(wallBase, -0.12));
      for (const bd of buildings) {
        const wall = mixHex(plaza.walls[bd.b.i % plaza.walls.length], '#b87a52', 0.18);
        const f = paintFacade({ w: bd.b.w, h: bd.b.h, wall, lamps: lampsOn, seed: bd.b.i + 1, sky: mixHex(plaza.sky[1], '#223048', 0.25), tone });
        cur.textures.push(f.map); bd.front.map = f.map; bd.front.color.set('#ffffff');
        if (f.emissive) { cur.textures.push(f.emissive); bd.front.emissiveMap = f.emissive; bd.front.emissive.set('#ffffff'); bd.front.emissiveIntensity = 1.0; } else { bd.front.emissiveMap = null; bd.front.emissive.set('#000000'); }
        bd.front.needsUpdate = true;
      }
      const hw = paintFacade({ w: HW, h: HH, wall: mixHex(plaza.walls[3], '#c8905a', 0.28), lamps: lampsOn, seed: 41, sky: mixHex(plaza.sky[1], '#223048', 0.25), ground: 4.3, tone });
      cur.textures.push(hw.map); hallMat.map = hw.map; hallMat.color.set('#ffffff');
      if (hw.emissive) { cur.textures.push(hw.emissive); hallMat.emissiveMap = hw.emissive; hallMat.emissive.set('#ffffff'); } else { hallMat.emissiveMap = null; hallMat.emissive.set('#000000'); }
      hallMat.needsUpdate = true;
      const tt = paintTower(plaza, 5); cur.textures.push(tt); towerMat.map = tt; towerMat.needsUpdate = true;
      const st = skyTexture(plaza, night); cur.textures.push(st); skyMat.map = st; skyMat.needsUpdate = true;
      const rg = ridgeTexture(plaza); cur.textures.push(rg); ridgeMat.map = rg; ridgeMat.needsUpdate = true;
      colMat.color.set(shade(plaza.walls[3], -0.15));
      for (const l of lamps) { l.glow.material.opacity = lampsOn ? 0.9 : 0.0; l.lamp.material.color.set(lampsOn ? '#ffe0a0' : '#8a7e6a'); }
      pl[0].intensity = lampsOn ? 14 : 0; pl[1].intensity = lampsOn ? 14 : 0;
      // pennants a touch dimmer at night
      penMat.color.set(night ? '#a9a9c8' : '#ffffff');
      cur.night = night;
    },
    update(dt, t) {
      setPennants(t);
      for (const b of BAN) {
        const pos = b.g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y0 = b.p0[i * 3 + 1], k = clamp(-y0 / b.h + 0.5, 0, 1);   // 0 at the rod, 1 at the hem
          pos.array[i * 3 + 2] = Math.sin(t * 1.9 + b.ph + k * 3.2 + b.p0[i * 3] * 1.4) * 0.09 * k;
          pos.array[i * 3] = b.p0[i * 3] + Math.sin(t * 1.3 + b.ph + k * 2.0) * 0.05 * k;
        }
        pos.needsUpdate = true;
      }
      // lanterns flicker a little
      for (let i = 0; i < lamps.length; i++) if (lamps[i].glow.material.opacity > 0.1) lamps[i].glow.material.opacity = 0.82 + 0.1 * Math.sin(t * 7 + i * 2.3) + 0.05 * Math.sin(t * 17 + i);
    },
    setVisible(v) { root.visible = v; camAttached.visible = v; for (const p of pl) p.visible = v && p.intensity > 0; },
    dispose() { for (const d of disposables) d.dispose(); for (const t of cur.textures) t.dispose(); },
  };
  void ExtrudeGeometry; void Shape; void Path; void CircleGeometry; void SphereGeometry; void Float32BufferAttribute; void strLines; void quality;
  return api;
}
