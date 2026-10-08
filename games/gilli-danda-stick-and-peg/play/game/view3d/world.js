// The 3D village. World frame: x right, y up, -z down the field (sim z maps to -z). Everything is generated in code: canvas textures (earth, plaster, tiles,
// a painted horizon) and merged vertex-coloured geometry. Three grounds share the parts: a golden-hour lane (Mango Lane), an open stubble field with
// haystacks (Harvest Field) and the lane after dark under string lights (Lamp Night).
import { THREE } from '../vendor3d/index.js';
import { FIELDS } from '../src/core.js';

export const V3 = THREE.Vector3;
const BoxG = THREE.BoxGeometry;
const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
const Attr = new BoxG().attributes.position.constructor;
const IndexAttr = THREE.BufferAttribute;

/** sim (x, y, z) -> world */
export const toWorld = (x, y, z, out = new V3()) => out.set(x, y, -z);
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const mkCanvas = (doc, w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = false, aniso = 4) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; return t; };
const mixHex = (a, b, t) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return `#${[c(16), c(8), c(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`; };

// ---- a tiny mesh accumulator (positions, normals, uv, vertex colours) ----------------------------------------------------------------------
class MB {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  get count() { return this.p.length / 3; }
  vert(p, n, uv, c) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(uv[0], uv[1]); this.c.push(c[0], c[1], c[2]); return this.count - 1; }
  /** quad p0 p1 p2 p3 counter-clockwise seen from the front */
  quad(p0, p1, p2, p3, color = [1, 1, 1], uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
    const a = new V3(...p1).sub(new V3(...p0)), b = new V3(...p3).sub(new V3(...p0)), nn = a.cross(b).normalize(), n = [nn.x, nn.y, nn.z];
    const i0 = this.vert(p0, n, uv[0], color), i1 = this.vert(p1, n, uv[1], color), i2 = this.vert(p2, n, uv[2], color), i3 = this.vert(p3, n, uv[3], color);
    this.i.push(i0, i1, i2, i0, i2, i3);
  }
  tri(p0, p1, p2, color = [1, 1, 1], uv = [[0, 0], [1, 0], [0.5, 1]]) {
    const a = new V3(...p1).sub(new V3(...p0)), b = new V3(...p2).sub(new V3(...p0)), nn = a.cross(b).normalize(), n = [nn.x, nn.y, nn.z];
    this.i.push(this.vert(p0, n, uv[0], color), this.vert(p1, n, uv[1], color), this.vert(p2, n, uv[2], color));
  }
  /** axis-aligned box (optionally yawed about its own centre). faces get a slight shade so the shape reads without lights */
  box(cx, cy, cz, sx, sy, sz, color, yaw = 0, uvScale = 1) {
    const hx = sx / 2, hy = sy / 2, hz = sz / 2, s = Math.sin(yaw), co = Math.cos(yaw);
    const P = (x, y, z) => [cx + x * co + z * s, cy + y, cz - x * s + z * co];
    const shade = (k) => [color[0] * k, color[1] * k, color[2] * k];
    const f = (a, b, c2, d, k, u = [sx, sy]) => this.quad(a, b, c2, d, shade(k), [[0, 0], [u[0] * uvScale, 0], [u[0] * uvScale, u[1] * uvScale], [0, u[1] * uvScale]]);
    f(P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz), 1, [sx, sy]);
    f(P(hx, -hy, -hz), P(-hx, -hy, -hz), P(-hx, hy, -hz), P(hx, hy, -hz), 0.86, [sx, sy]);
    f(P(hx, -hy, hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(hx, hy, hz), 0.93, [sz, sy]);
    f(P(-hx, -hy, -hz), P(-hx, -hy, hz), P(-hx, hy, hz), P(-hx, hy, -hz), 0.9, [sz, sy]);
    f(P(-hx, hy, hz), P(hx, hy, hz), P(hx, hy, -hz), P(-hx, hy, -hz), 1.08, [sx, sz]);
    f(P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, -hy, hz), P(-hx, -hy, hz), 0.6, [sx, sz]);
  }
  /** vertical cylinder / cone with smooth normals */
  cyl(cx, cy, cz, rTop, rBot, h, seg, color, cap = true, tilt = null) {
    const base = this.count;
    const T = (x, y, z) => (tilt ? [cx + x + tilt[0] * y, cy + y, cz + z + tilt[1] * y] : [cx + x, cy + y, cz + z]);
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2, s = Math.sin(a), co = Math.cos(a);
      const slope = (rBot - rTop) / Math.max(1e-6, h), nl = Math.hypot(1, slope), n = [s / nl, slope / nl, co / nl];
      this.vert(T(s * rBot, 0, co * rBot), n, [k / seg, 0], color); this.vert(T(s * rTop, h, co * rTop), n, [k / seg, 1], color);
    }
    for (let k = 0; k < seg; k++) { const a = base + k * 2; this.i.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    if (cap && rTop > 0.001) {
      const c0 = this.vert(T(0, h, 0), [0, 1, 0], [0.5, 0.5], color), b0 = this.count;
      for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; this.vert(T(Math.sin(a) * rTop, h, Math.cos(a) * rTop), [0, 1, 0], [0.5, 0.5], color); }
      for (let k = 0; k < seg; k++) this.i.push(c0, b0 + k + 1, b0 + k);
    }
  }
  ellipsoid(cx, cy, cz, rx, ry, rz, color, ws = 8, hs = 6, jitter = 0, seed = 1) {
    const base = this.count, r = rng(seed);
    for (let j = 0; j <= hs; j++) for (let k = 0; k <= ws; k++) {
      const th = (j / hs) * Math.PI, ph = (k / ws) * Math.PI * 2, s = Math.sin(th);
      const jx = 1 + (r() - 0.5) * jitter;
      const x = s * Math.cos(ph), y = Math.cos(th), z = s * Math.sin(ph);
      const sh = 0.82 + 0.22 * (y * 0.5 + 0.5);
      this.vert([cx + x * rx * jx, cy + y * ry * jx, cz + z * rz * jx], [x, y, z], [k / ws, j / hs], [color[0] * sh, color[1] * sh, color[2] * sh]);
    }
    for (let j = 0; j < hs; j++) for (let k = 0; k < ws; k++) { const a = base + j * (ws + 1) + k, b = a + 1, c = a + ws + 1, d = c + 1; this.i.push(a, c, b, b, c, d); }
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Attr(new Float32Array(this.p), 3)); g.setAttribute('normal', new Attr(new Float32Array(this.n), 3));
    g.setAttribute('uv', new Attr(new Float32Array(this.uv), 2)); g.setAttribute('color', new Attr(new Float32Array(this.c), 3));
    g.setIndex(new IndexAttr(this.count > 65000 ? new Uint32Array(this.i) : new Uint16Array(this.i), 1));
    return g;
  }
}

// ---- palettes ------------------------------------------------------------------------------------------------------------------------------------
const LOOKS = {
  lane: { soil: '#b78a57', soilB: '#a67848', dust: '#d9b886', walls: ['#efe4cc', '#e4b86e', '#a9c8d8', '#e8a98c', '#f3ead6', '#c9d9a8'], dado: ['#7a4528', '#2f5f78', '#8a3a2a'], roof: '#b5532f', night: false, fog: 0xf0c890 },
  harvest: { soil: '#c9a468', soilB: '#b98f52', dust: '#e2c690', walls: ['#efe4cc', '#e8cf9a', '#d9c3a0'], dado: ['#7a5a38'], roof: '#a8502e', night: false, fog: 0xdfeaf2 },
  lamp: { soil: '#7b5c42', soilB: '#6a4d38', dust: '#a98866', walls: ['#d9cfb6', '#d2a868', '#8fb0c4', '#d89a82', '#e0d6bf', '#b6c896'], dado: ['#5a3320', '#264a60', '#6c2c20'], roof: '#8f4226', night: true, fog: 0x2a2b52 },
};

// ---- textures ------------------------------------------------------------------------------------------------------------------------------------
function paintSoil(doc, look) {
  const c = mkCanvas(doc, 512, 512), g = c.getContext('2d'), r = rng(7);
  g.fillStyle = look.soil; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 2400; k++) { const dark = r() < 0.5; g.fillStyle = dark ? `rgba(60,36,18,${0.03 + r() * 0.08})` : `rgba(255,236,196,${0.03 + r() * 0.08})`; g.beginPath(); g.ellipse(r() * 512, r() * 512, 2 + r() * 12, 1 + r() * 6, r() * 3, 0, 7); g.fill(); }
  for (let k = 0; k < 500; k++) { g.fillStyle = r() < 0.5 ? 'rgba(90,60,34,0.5)' : 'rgba(240,220,180,0.45)'; g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
  // wrap-around copies so the tile is seamless at the edges
  const img = g.getImageData(0, 0, 512, 512); g.putImageData(img, 0, 0);
  return c;
}
const GX0 = -70, GX1 = 70, GZ0 = -34, GZ1 = 100;       // sim metres covered by the macro decal
function paintMacro(doc, key, look) {
  const c = mkCanvas(doc, 2048, 1920), g = c.getContext('2d'), r = rng(31);
  const X = (x) => (x - GX0) / (GX1 - GX0) * c.width, Z = (z) => (GZ1 - z) / (GZ1 - GZ0) * c.height, S = c.width / (GX1 - GX0);
  g.clearRect(0, 0, c.width, c.height);
  // worn lane: lighter packed earth down the middle, mottled
  const lane = g.createLinearGradient(X(-26), 0, X(26), 0); lane.addColorStop(0, 'rgba(0,0,0,0)'); lane.addColorStop(0.18, `${look.dust}aa`); lane.addColorStop(0.82, `${look.dust}aa`); lane.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = lane; g.fillRect(X(-26), Z(95), X(26) - X(-26), Z(-30) - Z(95));
  for (let k = 0; k < 900; k++) { const x = (r() - 0.5) * 50, z = -20 + r() * 100; g.fillStyle = r() < 0.5 ? 'rgba(255,236,190,0.07)' : 'rgba(80,50,26,0.07)'; g.beginPath(); g.ellipse(X(x), Z(z), (0.4 + r() * 2.4) * S, (0.2 + r() * 1.2) * S, r() * 3, 0, 7); g.fill(); }
  // cart ruts down the lane
  g.strokeStyle = 'rgba(70,44,24,0.18)'; g.lineWidth = 0.28 * S; for (const dx of [-3.2, -1.9, 4.6, 6.0]) { g.beginPath(); g.moveTo(X(dx), Z(95)); for (let z = 95; z > -30; z -= 4) g.lineTo(X(dx + Math.sin(z * 0.11 + dx) * 0.9), Z(z)); g.stroke(); }
  // grass tufts and verge along the sides, dry stubble across the field
  const grass = key === 'harvest' ? ['#9a9a4a', '#b2a85a', '#8a8240'] : look.night ? ['#2c4a30', '#35563a'] : ['#6a8a3a', '#7a9a44', '#587a32'];
  const nG = key === 'harvest' ? 5200 : 2600;
  for (let k = 0; k < nG; k++) {
    const side = r() < 0.5 ? -1 : 1, x = key === 'harvest' ? (r() - 0.5) * 130 : side * (24 + r() * 40), z = GZ0 + r() * (GZ1 - GZ0);
    if (key === 'harvest' && Math.abs(x) < 4 && z < 14) continue;
    g.fillStyle = grass[Math.floor(r() * grass.length)] + (key === 'harvest' ? '99' : 'cc');
    const w = (0.2 + r() * 0.9) * S, h2 = (0.3 + r() * 1.1) * S;
    g.beginPath(); g.ellipse(X(x), Z(z), w, h2 * 0.5, r() * 3, 0, 7); g.fill();
  }
  if (key === 'harvest') { g.strokeStyle = 'rgba(120,96,40,0.28)'; g.lineWidth = 0.1 * S; for (let k = -34; k < 34; k++) { g.beginPath(); g.moveTo(X(k * 2), Z(95)); g.lineTo(X(k * 2 + 6), Z(-30)); g.stroke(); } }
  return c;
}
function paintPlay(doc, look) {
  const c = mkCanvas(doc, 1536, 1536), g = c.getContext('2d'), r = rng(11);
  const S = c.width / 12;                          // px per metre; covers x -6..6, z -6..6 (sim)
  const X = (x) => (x + 6) * S, Z = (z) => (6 - z) * S;
  g.clearRect(0, 0, c.width, c.height);
  // soft packed dust disc that fades out
  const dg = g.createRadialGradient(c.width / 2, c.height / 2, 1.2 * S, c.width / 2, c.height / 2, 6 * S); dg.addColorStop(0, `${look.dust}ee`); dg.addColorStop(0.55, `${look.dust}88`); dg.addColorStop(1, `${look.dust}00`);
  g.fillStyle = dg; g.fillRect(0, 0, c.width, c.height);
  for (let k = 0; k < 1400; k++) { g.fillStyle = r() < 0.55 ? 'rgba(80,52,28,0.07)' : 'rgba(255,240,205,0.08)'; g.beginPath(); g.ellipse(X((r() - 0.5) * 11), Z((r() - 0.5) * 11), (0.04 + r() * 0.3) * S, (0.03 + r() * 0.14) * S, r() * 3, 0, 7); g.fill(); }
  // the scratched circle the game starts from and the line the striker stands behind
  g.strokeStyle = 'rgba(70,44,24,0.35)'; g.lineWidth = 0.05 * S; g.beginPath(); g.arc(X(0), Z(0), 0.9 * S, 0, 7); g.stroke();
  g.strokeStyle = 'rgba(70,44,24,0.28)'; g.beginPath(); g.moveTo(X(-1.4), Z(-1.1)); g.lineTo(X(1.4), Z(-1.1)); g.stroke();
  // the hole: a small oval pit with a raised rim
  g.fillStyle = 'rgba(40,24,12,0.9)'; g.beginPath(); g.ellipse(X(0), Z(0), 0.14 * S, 0.075 * S, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,230,190,0.5)'; g.lineWidth = 0.035 * S; g.beginPath(); g.ellipse(X(0), Z(0), 0.17 * S, 0.095 * S, 0, 0, 7); g.stroke();
  // footprints near the stance and in the lane
  for (let k = 0; k < 26; k++) { g.save(); g.translate(X(-0.7 + (r() - 0.5) * 1.8), Z(-1.0 + (r() - 0.5) * 1.6)); g.rotate((r() - 0.5) * 1.6); g.fillStyle = 'rgba(62,40,22,0.12)'; g.beginPath(); g.ellipse(0, 0, 0.035 * S, 0.085 * S, 0, 0, 7); g.fill(); g.restore(); }
  for (let k = 0; k < 14; k++) { g.save(); g.translate(X((r() - 0.5) * 8), Z(1 + r() * 4.8)); g.rotate((r() - 0.5) * 0.9); g.fillStyle = 'rgba(62,40,22,0.08)'; g.beginPath(); g.ellipse(0, 0, 0.04 * S, 0.09 * S, 0, 0, 7); g.fill(); g.restore(); }
  for (let k = 0; k < 18; k++) { g.fillStyle = 'rgba(120,98,52,0.5)'; g.save(); g.translate(X((r() - 0.5) * 9), Z((r() - 0.5) * 9)); g.rotate(r() * 3); g.fillRect(0, 0, (0.1 + r() * 0.22) * S, 0.012 * S); g.restore(); }
  return c;
}

// facade atlas: 4 columns x 2 rows of 512x512 tiles
function paintFacades(doc, look) {
  const T = 512, c = mkCanvas(doc, T * 4, T * 2), g = c.getContext('2d'), r = rng(5);
  for (let v = 0; v < 8; v++) {
    const ox = (v % 4) * T, oy = Math.floor(v / 4) * T;
    const wall = look.walls[v % look.walls.length], dado = look.dado[v % look.dado.length];
    g.save(); g.translate(ox, oy); g.beginPath(); g.rect(0, 0, T, T); g.clip();
    g.fillStyle = wall; g.fillRect(0, 0, T, T);
    // plaster: mottled patches, rain streaks, exposed brick at the corners
    for (let k = 0; k < 140; k++) { g.fillStyle = r() < 0.5 ? 'rgba(120,90,60,0.06)' : 'rgba(255,255,255,0.08)'; g.beginPath(); g.ellipse(r() * T, r() * T, 8 + r() * 46, 5 + r() * 24, r() * 3, 0, 7); g.fill(); }
    for (let k = 0; k < 26; k++) { const x = r() * T; g.fillStyle = 'rgba(90,60,40,0.07)'; g.fillRect(x, 0, 2 + r() * 6, 140 + r() * 360); }
    g.fillStyle = 'rgba(170,96,60,0.55)'; g.beginPath(); g.moveTo(0, T * 0.72); g.lineTo(34 + r() * 30, T * 0.7); g.lineTo(20, T * 0.62 + r() * 30); g.lineTo(0, T * 0.6); g.fill();
    // painted dado
    g.fillStyle = dado; g.fillRect(0, T * 0.78, T, T * 0.22); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, T * 0.78, T, 4);
    // door with a pointed arch and a studded plank door
    const dw = 128, dx = v % 2 ? T * 0.14 : T * 0.62, dh = T * 0.62;
    const doorCol = ['#4a2a18', '#2f5f78', '#6a3a1c', '#355a40'][v % 4];
    g.fillStyle = 'rgba(40,24,14,0.5)'; g.fillRect(dx - 14, T - dh - 14, dw + 28, dh + 14);
    g.fillStyle = doorCol; g.beginPath(); g.moveTo(dx, T); g.lineTo(dx, T - dh + 54); g.quadraticCurveTo(dx, T - dh, dx + dw / 2, T - dh - 14); g.quadraticCurveTo(dx + dw, T - dh, dx + dw, T - dh + 54); g.lineTo(dx + dw, T); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(dx + k * dw / 4, T - dh + 30); g.lineTo(dx + k * dw / 4, T); g.stroke(); }
    g.fillStyle = 'rgba(230,200,120,0.8)'; for (let k = 0; k < 8; k++) g.fillRect(dx + 12 + (k % 4) * 28, T - dh + 70 + Math.floor(k / 4) * 120, 5, 5);
    g.fillStyle = '#d6b36a'; g.beginPath(); g.arc(dx + dw - 18, T - dh * 0.46, 7, 0, 7); g.fill();
    // doorstep
    g.fillStyle = 'rgba(200,190,170,0.9)'; g.fillRect(dx - 20, T - 14, dw + 40, 14);
    // window with shutters
    const wx = v % 2 ? T * 0.58 : T * 0.12, wy = T * 0.18, ww = 120, wh = 138;
    g.fillStyle = 'rgba(30,20,12,0.55)'; g.fillRect(wx - 10, wy - 10, ww + 20, wh + 20);
    const glow = look.night && (v % 3 !== 1);
    const pane = g.createLinearGradient(0, wy, 0, wy + wh);
    if (glow) { pane.addColorStop(0, '#ffe7a0'); pane.addColorStop(1, '#ffb855'); } else { pane.addColorStop(0, '#41505c'); pane.addColorStop(1, '#202a32'); }
    g.fillStyle = pane; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh / 2 - 2, ww, 4);
    g.fillStyle = doorCol; g.fillRect(wx - ww * 0.5 - 6, wy - 4, ww * 0.5, wh + 8); g.fillRect(wx + ww + 6, wy - 4, ww * 0.5, wh + 8);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let k = 1; k < 6; k++) { const y = wy + k * wh / 6; g.beginPath(); g.moveTo(wx - ww * 0.5 - 6, y); g.lineTo(wx - 6, y); g.moveTo(wx + ww + 6, y); g.lineTo(wx + ww * 1.5 + 6, y); g.stroke(); }
    // a painted band and hanging cloth or a rope of marigolds
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, T * 0.02, T, 5);
    if (v % 4 === 0) for (let k = 0; k < 14; k++) { g.fillStyle = k % 2 ? '#f0a020' : '#e8791a'; g.beginPath(); g.arc(T * 0.05 + k * 34, T * 0.08 + Math.sin(k * 0.8) * 8, 9, 0, 7); g.fill(); }
    g.restore();
  }
  return c;
}
function paintTiles(doc, look) {
  const c = mkCanvas(doc, 256, 256), g = c.getContext('2d'), r = rng(9);
  g.fillStyle = look.roof; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const x = col * 32 + (row % 2 ? 16 : 0), y = row * 32, k = 0.84 + r() * 0.28;
    g.fillStyle = mixHex(look.roof, r() < 0.5 ? '#000000' : '#ffffff', 0.04 + r() * 0.1); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 32, y); g.lineTo(x + 32, y + 24); g.quadraticCurveTo(x + 16, y + 40 * k, x, y + 24); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,16,8,0.45)'; g.lineWidth = 2; g.stroke();
  }
  return c;
}
function paintSky(doc, key) {
  const F = FIELDS[key], c = mkCanvas(doc, 64, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, F.sky[0]); gr.addColorStop(0.5, F.sky[0]); gr.addColorStop(0.8, F.sky[1]); gr.addColorStop(1, F.sky[2]); g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  return c;
}
function paintHorizon(doc, key, look) {
  const W = 4096, H = 512, c = mkCanvas(doc, W, H), g = c.getContext('2d'), r = rng(key.length * 91 + 3);
  const F = FIELDS[key];
  g.clearRect(0, 0, W, H);
  const hz = H * 0.86;
  // far hills
  const hill = (col, base, amp, f, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 16) g.lineTo(x, hz - base - Math.abs(Math.sin(x * f + ph)) * amp - Math.sin(x * f * 3.1 + ph) * amp * 0.2); g.lineTo(W, hz); g.fill(); };
  if (look.night) { hill('#10163a', 30, 90, 0.0036, 1); hill('#0a0f2a', 10, 55, 0.0072, 3); }
  else if (key === 'harvest') { hill('#a9c0b8', 40, 70, 0.0033, 1); hill('#8fb08c', 18, 48, 0.0061, 2); hill('#79a06a', 4, 30, 0.012, 5); }
  else { hill('#c79a82', 40, 80, 0.0036, 1); hill('#a47a6a', 20, 55, 0.0068, 3); hill('#7f6a4a', 6, 30, 0.012, 5); }
  // village rooftops and trees in silhouette-ish colour
  for (let k = 0; k < 120; k++) {
    const x = r() * W, w = 36 + r() * 70, h = 28 + r() * 60;
    if (key === 'harvest' && r() < 0.7) continue;
    g.fillStyle = look.night ? '#0c1230' : mixHex('#8a6a54', '#c0a088', r()); g.fillRect(x, hz - h, w, h + 4); g.fillStyle = look.night ? '#1a1a38' : mixHex('#8a3a24', '#a85a34', r()); g.beginPath(); g.moveTo(x - 6, hz - h); g.lineTo(x + w / 2, hz - h - 22); g.lineTo(x + w + 6, hz - h); g.fill();
    if (look.night && r() < 0.5) { g.fillStyle = '#ffd98a'; g.fillRect(x + w * 0.3, hz - h * 0.6, 8, 10); }
  }
  for (let k = 0; k < 150; k++) { const x = r() * W, h = 50 + r() * 90, w = 34 + r() * 56; g.fillStyle = look.night ? '#0a1a1e' : mixHex('#4a6a34', '#6f8a40', r()); g.beginPath(); g.ellipse(x, hz - h * 0.55, w / 2, h / 2, 0, 0, 7); g.fill(); g.fillStyle = look.night ? '#0a0a12' : '#4a3626'; g.fillRect(x - 3, hz - h * 0.3, 6, h * 0.3 + 4); }
  // ground haze at the bottom edge
  const hzg = g.createLinearGradient(0, hz - 60, 0, H); hzg.addColorStop(0, 'rgba(255,255,255,0)'); hzg.addColorStop(1, look.night ? '#2a2b52' : `rgba(${(look.fog >> 16) & 255},${(look.fog >> 8) & 255},${look.fog & 255},1)`); g.fillStyle = hzg; g.fillRect(0, hz - 60, W, H - hz + 60);
  void F;
  return c;
}
function glowTexture(doc, warm = true) {
  const c = mkCanvas(doc, 64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, warm ? 'rgba(255,230,170,0.6)' : 'rgba(255,255,255,0.55)'); gr.addColorStop(1, warm ? 'rgba(255,200,120,0)' : 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}
function blobTexture(doc) {
  const c = mkCanvas(doc, 64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(20,12,4,0.62)'); gr.addColorStop(0.55, 'rgba(20,12,4,0.3)'); gr.addColorStop(1, 'rgba(20,12,4,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}

// ---- the world -------------------------------------------------------------------------------------------------------------------------------------
export class World {
  constructor(stage, key, doc = globalThis.document) {
    this.stage = stage; this.key = key; this.doc = doc; this.F = FIELDS[key]; this.look = LOOKS[key];
    this.group = new THREE.Group(); this.group.name = `ground-${key}`;
    stage.scene.add(this.group);
    this.blobTex = blobTexture(doc); this.glowTex = glowTexture(doc);
    this.t = 0; this.motes = []; this.flicker = [];
    this._build();
  }

  _mat(opts) { return new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...opts }); }

  _build() {
    const { doc, look, key, group, stage } = this, S = THREE;
    const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
    // ground: tiled earth, a macro decal for the lane/grass, a high-detail decal round the hole
    const soil = tex(paintSoil(doc, look), true, aniso); soil.repeat.set(70, 70);
    const ground = new S.Mesh(new S.PlaneGeometry(420, 420), this._mat({ map: soil }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -30); ground.receiveShadow = true; group.add(ground);
    const macro = new S.Mesh(new S.PlaneGeometry(GX1 - GX0, GZ1 - GZ0), this._mat({ map: tex(paintMacro(doc, key, look), false, aniso), transparent: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    macro.rotation.x = -Math.PI / 2; macro.position.set((GX0 + GX1) / 2, 0.004, -(GZ0 + GZ1) / 2); macro.receiveShadow = true; macro.renderOrder = 1; group.add(macro);
    const play = new S.Mesh(new S.PlaneGeometry(12, 12), this._mat({ map: tex(paintPlay(doc, look), false, aniso), transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    play.rotation.x = -Math.PI / 2; play.position.set(0, 0.008, 0); play.receiveShadow = true; play.renderOrder = 2; group.add(play);
    this.facade = tex(paintFacades(doc, look), false, aniso);
    this.tiles = tex(paintTiles(doc, look), true, aniso);
    this.walls = new MB(); this.roofs = new MB(); this.facades = new MB(); this.stuff = new MB(); this.wood = new MB(); this.leaves = new MB();
    if (key === 'harvest') this._fieldScene(); else this._laneScene();
    this._finishMeshes();
    this._backdrop();
    this._atmosphere();
    // soft blob shadows for people and the gilli (the directional shadow only covers the striker's patch)
    this.blobs = []; for (let i = 0; i < 9; i++) { const m = new S.Mesh(new S.PlaneGeometry(1, 1), new S.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.renderOrder = 3; m.visible = false; group.add(m); this.blobs.push(m); }
  }

  // one house: a body, a gabled tile roof along z, a facade quad from the atlas facing the lane, eaves and a plinth. side = -1 (left of the lane) or +1.
  _house(side, cz, w, d, h, variant, facing = 'lane') {
    const { walls, roofs, facades, wood, look } = this;
    const wallCol = srgb(look.walls[variant % look.walls.length]);
    const dark = srgb(look.dado[variant % look.dado.length]);
    const cx = side * 32;
    // body (z along the lane); the lane face sits at x = side*(32 - d/2)
    walls.box(cx, h / 2, -cz, d, h, w, wallCol);
    walls.box(cx, 0.18, -cz, d + 0.3, 0.36, w + 0.3, [0.55, 0.5, 0.45]);
    const fx = cx - side * (d / 2) - side * 0.012;
    // facade atlas tile
    const col = variant % 4, row = Math.floor((variant % 8) / 4), u0 = col / 4, v0 = 1 - (row + 1) / 2, du = 1 / 4, dv = 1 / 2;
    const zA = -cz - w / 2, zB = -cz + w / 2;
    const uvs = [[u0, v0], [u0 + du, v0], [u0 + du, v0 + dv], [u0, v0 + dv]];
    // the facade is a square tile: stretch it across the wall (w by h)
    if (side > 0) facades.quad([fx, 0, zA], [fx, 0, zB], [fx, h, zB], [fx, h, zA], [1, 1, 1], uvs);
    else facades.quad([fx, 0, zB], [fx, 0, zA], [fx, h, zA], [fx, h, zB], [1, 1, 1], uvs);
    // roof: gable along z, ridge above the centre line, eaves overhang toward the lane
    const rh = d * 0.34, ov = 0.7, x0 = cx - d / 2 - ov, x1 = cx + d / 2 + ov, xm = cx, zr0 = -cz - w / 2 - 0.5, zr1 = -cz + w / 2 + 0.5, y0 = h - 0.05, y1 = h + rh;
    const tileU = (zr1 - zr0) / 2.4, tileV = (Math.hypot(xm - x0, y1 - y0)) / 2.4;
    const rc = [1, 1, 1];
    roofs.quad([x0, y0, zr0], [x0, y0, zr1], [xm, y1, zr1], [xm, y1, zr0], rc, [[0, 0], [tileU, 0], [tileU, tileV], [0, tileV]]);
    roofs.quad([xm, y1, zr0], [xm, y1, zr1], [x1, y0, zr1], [x1, y0, zr0], rc, [[0, 0], [tileU, 0], [tileU, tileV], [0, tileV]]);
    roofs.quad([x1, y0 - 0.12, zr0], [x1, y0, zr0], [xm, y1, zr0], [xm, y1 - 0.12, zr0], [0.5, 0.5, 0.5]);
    roofs.cyl(xm, y1 - 0.05, -cz, 0.18, 0.2, w + 1.0, 8, [0.45, 0.2, 0.12], false, null);
    // gable end triangles in the wall colour
    for (const zz of [-cz - w / 2, -cz + w / 2]) walls.tri([cx - d / 2, h, zz], [cx + d / 2, h, zz], [xm, y1, zz], wallCol);
    // a verandah post pair and a charpai (rope bed) in front of some houses
    if (variant % 2 === 0) {
      const px = cx - side * (d / 2 + 1.4);
      for (const dz of [-w * 0.3, w * 0.3]) wood.cyl(px, 0, -cz + dz, 0.07, 0.09, 2.4, 6, srgb('#6a4a2a'));
      roofs.quad([cx - side * (d / 2) - side * 0.05, 2.5, -cz - w * 0.36], [cx - side * (d / 2) - side * 0.05, 2.5, -cz + w * 0.36], [px - side * 0.2, 2.2, -cz + w * 0.36], [px - side * 0.2, 2.2, -cz - w * 0.36], rc, [[0, 0], [3, 0], [3, 1.6], [0, 1.6]]);
      this._charpai(px + side * 0.3, -cz + (variant % 4 === 0 ? 1.4 : -1.4), side * Math.PI / 2 + (variant > 3 ? 0.2 : 0));
    }
    void dark;
  }

  _charpai(x, z, yaw) {
    const { wood, stuff } = this, wd = srgb('#7a5430'), rope = srgb('#d9c8a0');
    wood.box(x, 0.38, z, 1.9, 0.07, 1.0, rope, yaw);
    for (const [dx, dz] of [[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.45], [0.85, 0.45]]) { const c = Math.cos(yaw), s = Math.sin(yaw); wood.box(x + dx * c + dz * s, 0.19, z - dx * s + dz * c, 0.08, 0.38, 0.08, wd, yaw); }
    wood.box(x, 0.42, z, 2.0, 0.06, 0.07, wd, yaw); wood.box(x, 0.42, z + 0.0, 0.07, 0.06, 1.1, wd, yaw);
    stuff.box(x + 0.4, 0.46, z, 0.7, 0.06, 0.6, srgb('#c24a3a'), yaw + 0.2);
  }

  _pots(x, z, n = 4) {
    const { stuff } = this, cols = [srgb('#b5532f'), srgb('#a54624'), srgb('#c46a3a')];
    for (let i = 0; i < n; i++) { const a = i * 2.1; stuff.ellipsoid(x + Math.cos(a) * 0.5, 0.3, z + Math.sin(a) * 0.5, 0.26, 0.3, 0.26, cols[i % 3], 10, 8, 0, i); stuff.cyl(x + Math.cos(a) * 0.5, 0.52, z + Math.sin(a) * 0.5, 0.13, 0.15, 0.1, 10, cols[i % 3]); }
  }

  _haystack(x, z, s = 1, seed = 1) {
    const { stuff } = this, straw = srgb('#d5b05a'), straw2 = srgb('#bf9a48');
    stuff.cyl(x, 0, z, 1.6 * s, 1.8 * s, 1.5 * s, 12, straw2, false);
    stuff.ellipsoid(x, 1.5 * s, z, 1.62 * s, 1.5 * s, 1.62 * s, straw, 12, 7, 0.1, seed);
    stuff.cyl(x, 2.5 * s, z, 0.02, 0.4 * s, 0.9 * s, 8, straw2, false);
  }

  _banyan(x, z, scale = 1, seed = 3) {
    const { wood, leaves } = this, bark = srgb('#6b5a48'), r = rng(seed);
    for (let k = 0; k < 5; k++) { const a = k * 1.3, rr = 0.35 * scale; wood.cyl(x + Math.cos(a) * rr * 2, 0, z + Math.sin(a) * rr * 2, 0.35 * scale, 0.7 * scale, 6 * scale, 9, bark, true, [Math.cos(a) * 0.1 * scale, Math.sin(a) * 0.1 * scale]); }
    wood.cyl(x, 0, z, 1.0 * scale, 1.6 * scale, 3.5 * scale, 12, bark);
    // main limbs
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.3; wood.cyl(x, 4.2 * scale, z, 0.22 * scale, 0.55 * scale, 5.5 * scale, 7, bark, true, [Math.cos(a) * 3.0 * scale, Math.sin(a) * 3.0 * scale]); }
    // hanging aerial roots
    for (let k = 0; k < 26; k++) { const a = r() * 6.28, d = (2 + r() * 6) * scale, h = (2.5 + r() * 3.5) * scale; wood.cyl(x + Math.cos(a) * d, 0, z + Math.sin(a) * d, 0.04 * scale, 0.07 * scale, h, 5, srgb('#7a6650')); }
    // canopy
    const greens = [srgb('#3f6f2a'), srgb('#4f8232'), srgb('#365f26'), srgb('#5b8f3a')];
    if (this.look.night) for (const g2 of greens) { g2[0] *= 0.5; g2[1] *= 0.55; g2[2] *= 0.6; }
    for (let k = 0; k < 46; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 8.5 * scale; leaves.ellipsoid(x + Math.cos(a) * d, (7.2 + r() * 3.4 - d * 0.1) * scale, z + Math.sin(a) * d, (2.6 + r() * 2.2) * scale, (1.6 + r() * 1.4) * scale, (2.6 + r() * 2.2) * scale, greens[k % 4], 8, 5, 0.25, seed + k); }
  }

  _handpump(x, z) {
    const { stuff } = this, iron = srgb('#3a4048');
    stuff.cyl(x, 0, z, 0.55, 0.65, 0.5, 10, srgb('#a9a69c'));
    stuff.cyl(x, 0.5, z, 0.08, 0.1, 1.15, 8, iron);
    stuff.cyl(x, 1.55, z, 0.12, 0.11, 0.2, 8, iron);
    stuff.box(x + 0.3, 1.5, z, 0.9, 0.07, 0.1, iron, 0.0);
    stuff.box(x + 0.62, 1.35, z, 0.12, 0.4, 0.1, iron);
    stuff.box(x - 0.22, 1.1, z, 0.55, 0.12, 0.12, iron);
    stuff.cyl(x - 0.45, 0.05, z, 0.22, 0.24, 0.06, 10, srgb('#8d8a82'));
  }

  _well(x, z) {
    const { stuff, wood } = this;
    stuff.cyl(x, 0, z, 1.0, 1.1, 0.95, 14, srgb('#c9b890'), false); stuff.cyl(x, 0.95, z, 1.1, 1.1, 0.12, 14, srgb('#a89874'), true);
    wood.box(x - 0.95, 1.7, z, 0.14, 1.5, 0.14, srgb('#5b4128')); wood.box(x + 0.95, 1.7, z, 0.14, 1.5, 0.14, srgb('#5b4128')); wood.box(x, 2.45, z, 2.2, 0.14, 0.16, srgb('#5b4128'));
    stuff.cyl(x, 1.55, z, 0.2, 0.22, 0.32, 10, srgb('#8a6a3a'));
  }

  _cart(x, z, yaw) {
    const { wood, stuff } = this, c = Math.cos(yaw), s = Math.sin(yaw), wd = srgb('#8a5a2e'), dk = srgb('#5a3c20');
    const P = (lx, ly, lz) => [x + lx * c + lz * s, ly, z - lx * s + lz * c];
    const B = (lx, ly, lz, sx, sy, sz, col) => { const p = P(lx, ly, lz); wood.box(p[0], p[1], p[2], sx, sy, sz, col, yaw); };
    B(0, 1.0, 0, 3.0, 0.12, 1.7, wd); B(0, 1.35, 0.85, 3.0, 0.5, 0.08, wd); B(0, 1.35, -0.85, 3.0, 0.5, 0.08, wd); B(-1.5, 1.35, 0, 0.08, 0.5, 1.7, wd);
    B(2.3, 0.7, 0, 3.2, 0.12, 0.12, dk); B(2.3, 0.7, 0.55, 3.2, 0.1, 0.1, dk);
    for (const lz of [-1.0, 1.0]) { const p = P(0, 0.72, lz); wood.cyl(p[0], 0.0, p[2], 0.06, 0.06, 0.01, 4, dk); this._wheel(p[0], 0.72, p[2], yaw, 0.72); }
    const axle = P(0, 0.72, 0); wood.box(axle[0], axle[1], axle[2], 0.1, 0.1, 2.2, dk, yaw);
    void stuff;
  }

  _wheel(x, y, z, yaw, r) {
    const { wood } = this, dk = srgb('#5a3c20'), rim = srgb('#3a3a3a');
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // wheel plane is x-y (axle along z in cart space): rim as a ring of boxes, spokes as long boxes
    const n = 16;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; const lx = Math.cos(a) * r, ly = Math.sin(a) * r; wood.box(x + lx * c, y + ly, z - lx * s, 0.2, 0.12, 0.12, rim, yaw + Math.PI / 2 * 0 + (-a)); }
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI; wood.box(x, y, z, 0.07, 0.07, 0.07, dk); const lx = Math.cos(a) * r * 0.5, ly = Math.sin(a) * r * 0.5; wood.box(x + lx * c, y + ly, z - lx * s, 0.1, 0.1, 0.1, dk); wood.box(x - lx * c, y - ly, z + lx * s, 0.1, 0.1, 0.1, dk); }
    wood.cyl(x, y - 0.14, z, 0.14, 0.14, 0.28, 8, dk, true, null);
  }

  _laneScene() {
    const { look, key, stuff, wood } = this, r = rng(17);
    // two rows of houses lining the lane, different widths and heights
    const zs = [-8, 4, 16.5, 29, 42, 54];
    for (const side of [-1, 1]) zs.forEach((z, i) => this._house(side, z + (side > 0 ? 3 : 0) + (r() - 0.5) * 1.5, 9.5 + r() * 2.5, 6.2 + r() * 1.5, 3.9 + r() * 1.0, (i * 2 + (side > 0 ? 1 : 0)) % 8));
    // a back row behind the striker: three houses facing the field, plus a wall with a gateway
    for (const [bx, bw] of [[-18, 11], [-2, 12], [15, 11]]) this._backHouse(bx, -17.5 - (bx === -2 ? 1 : 0), bw, (bx + 40) % 8);
    // the banyan and its raised seat at the far end of the lane, a second one behind-left
    this._banyan(-8, 66, 1.3, 5); this._banyan(-26, -13, 0.85, 11);
    stuff.cyl(-8, 0, 66, 3.8, 4.1, 0.55, 20, srgb('#d6cdb6'));
    for (let k = 0; k < 2; k++) stuff.cyl(-8, 0, 66, 4.6 - k * 0.4, 4.9 - k * 0.4, 0.2 + k * 0.2, 20, srgb('#c3b99f'));
    this._handpump(-22, 9); this._well(23.5, 31);
    this._cart(24, 14, 0.5); this._cart(-24.5, 35, -0.3);
    for (const [x, z] of [[-21, 21], [20.5, 5], [-23, 47], [22, 52], [-4, -13], [7, -13.5]]) this._pots(x, z, 4);
    this._haystack(26, 24, 0.9, 3); this._haystack(-27, 28, 1.1, 8);
    // a tree or two along the verge
    for (const [x, z, s] of [[-26.5, 17, 0.45], [26.5, 40, 0.5], [-26.5, 62, 0.5]]) this._banyan(x, z, s, Math.floor(x + z) & 15);
    // low mud wall along the far ends
    wood.box(0, 0.5, -78, 90, 1.0, 0.8, srgb('#c9b27a'));
    void look; void key;
  }

  _backHouse(cx, cz, w, variant) {
    const { walls, roofs, facades, look } = this, d = 6.5, h = 4.4;
    const wallCol = srgb(look.walls[variant % look.walls.length]);
    walls.box(cx, h / 2, -cz, w, h, d, wallCol);
    const fz = -cz - d / 2 - 0.012, col = variant % 4, row = Math.floor((variant % 8) / 4), u0 = col / 4, v0 = 1 - (row + 1) / 2;
    const uvs = [[u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v0 + 0.5], [u0, v0 + 0.5]];
    facades.quad([cx + w / 2, 0, fz], [cx - w / 2, 0, fz], [cx - w / 2, h, fz], [cx + w / 2, h, fz], [1, 1, 1], uvs);
    const rh = d * 0.32, ov = 0.7, y0 = h - 0.05, y1 = h + rh, tU = (w + 1.4) / 2.4, tV = Math.hypot(d / 2 + ov, rh) / 2.4;
    roofs.quad([cx - w / 2 - 0.7, y0, -cz + d / 2 + ov], [cx + w / 2 + 0.7, y0, -cz + d / 2 + ov], [cx + w / 2 + 0.7, y1, -cz], [cx - w / 2 - 0.7, y1, -cz], [1, 1, 1], [[0, 0], [tU, 0], [tU, tV], [0, tV]]);
    roofs.quad([cx - w / 2 - 0.7, y1, -cz], [cx + w / 2 + 0.7, y1, -cz], [cx + w / 2 + 0.7, y0, -cz - d / 2 - ov], [cx - w / 2 - 0.7, y0, -cz - d / 2 - ov], [1, 1, 1], [[0, 0], [tU, 0], [tU, tV], [0, tV]]);
    for (const xx of [cx - w / 2, cx + w / 2]) walls.tri([xx, h, -cz + d / 2], [xx, h, -cz - d / 2], [xx, y1, -cz], wallCol);
    this._charpai(cx + (variant % 2 ? 2.4 : -2.4), -cz - d / 2 - 1.9, 0.2 * (variant % 3));
  }

  _fieldScene() {
    const { stuff, wood } = this, r = rng(23);
    // haystacks scattered across the stubble, a low field wall, a farm shed and a line of trees
    for (let k = 0; k < 14; k++) { const side = k % 2 ? 1 : -1; this._haystack(side * (16 + r() * 18), -4 + r() * 70, 0.8 + r() * 0.6, k); }
    this._haystack(-9, -11, 1.0, 2); this._haystack(11, -10, 0.9, 4);
    for (let k = 0; k < 18; k++) { const z = -10 + k * 5; for (const side of [-1, 1]) wood.box(side * 38, 0.45, -z, 0.7, 0.9, 5.4, srgb('#b9a27a')); }
    for (const x of [-30, 30]) this._shed(x, -20);
    this._banyan(-16, 70, 1.2, 4); this._banyan(18, 76, 1.0, 6); this._banyan(-36, 38, 0.9, 9); this._banyan(40, 20, 0.8, 12);
    this._cart(-20, 12, -0.4);
    this._handpump(-12, -6);
    for (let k = 0; k < 9; k++) this._pots(-8 + r() * 16, -9 - r() * 3, 2);
    // far tree line
    for (let k = 0; k < 24; k++) { const x = -90 + k * 8 + r() * 4; this._banyan(x, 100 + r() * 12, 0.5 + r() * 0.3, k + 40); }
    void stuff;
  }

  _shed(x, z) {
    const { walls, roofs } = this, col = srgb('#e0cfa4'), w = 9, d = 6, h = 3.6;
    walls.box(x, h / 2, -z, w, h, d, col);
    const y1 = h + 1.3;
    roofs.quad([x - w / 2 - 0.6, h, -z + d / 2 + 0.6], [x + w / 2 + 0.6, h, -z + d / 2 + 0.6], [x + w / 2 + 0.6, y1, -z], [x - w / 2 - 0.6, y1, -z], [1, 1, 1], [[0, 0], [4, 0], [4, 1.6], [0, 1.6]]);
    roofs.quad([x - w / 2 - 0.6, y1, -z], [x + w / 2 + 0.6, y1, -z], [x + w / 2 + 0.6, h, -z - d / 2 - 0.6], [x - w / 2 - 0.6, h, -z - d / 2 - 0.6], [1, 1, 1], [[0, 0], [4, 0], [4, 1.6], [0, 1.6]]);
    walls.box(x, 1.2, -z + d / 2 + 0.02, 1.8, 2.4, 0.06, srgb('#5a3a22'));
  }

  _finishMeshes() {
    const { group, look } = this, S = THREE;
    const lit = look.night;
    const mk = (mb, mat) => { if (!mb.count) return null; const m = new S.Mesh(mb.geometry(), mat); m.castShadow = false; m.receiveShadow = true; group.add(m); return m; };
    mk(this.walls, this._mat({ vertexColors: true }));
    mk(this.roofs, this._mat({ vertexColors: true, map: this.tiles, side: S.DoubleSide }));
    mk(this.facades, this._mat({ map: this.facade, emissive: lit ? 0xffb050 : 0x000000, emissiveMap: lit ? this.facade : null, emissiveIntensity: lit ? 0.85 : 0 }));
    mk(this.stuff, this._mat({ vertexColors: true }));
    mk(this.wood, this._mat({ vertexColors: true, roughness: 0.9 }));
    mk(this.leaves, this._mat({ vertexColors: true, roughness: 1 }));
  }

  _backdrop() {
    const { look, key, group, doc } = this, S = THREE;
    const ht = tex(paintHorizon(doc, key, look), false, 4);
    const band = new S.Mesh(new S.CylinderGeometry(300, 300, 210, 64, 1, true), new S.MeshBasicMaterial({ map: ht, side: S.BackSide, fog: false, transparent: true }));
    band.position.y = 62; group.add(band);
    const dome = new S.Mesh(new S.SphereGeometry(360, 24, 16), new S.MeshBasicMaterial({ map: tex(paintSky(doc, key)), side: S.BackSide, fog: false }));
    dome.scale.y = 0.9; group.add(dome); this.dome = dome; this.band = band;
    // sun or moon with a halo
    const sun = new S.Sprite(new S.SpriteMaterial({ map: this.glowTex, blending: S.AdditiveBlending, transparent: true, depthWrite: false, opacity: look.night ? 0.5 : key === 'harvest' ? 0.55 : 0.9, fog: false }));
    sun.scale.set(look.night ? 60 : 130, look.night ? 60 : 130, 1); sun.position.set(look.night ? 90 : -120, look.night ? 120 : 50, look.night ? -220 : 220); group.add(sun); this.sun = sun;
    if (look.night) { const moon = new S.Mesh(new S.CircleGeometry(9, 28), new S.MeshBasicMaterial({ color: 0xf4eed8, fog: false })); moon.position.set(90, 120, -218); moon.lookAt(0, 20, 0); group.add(moon); }
    // clouds
    for (let k = 0; k < 8; k++) {
      const c = mkCanvas(doc, 256, 96), g = c.getContext('2d'); const r = rng(k + 4);
      for (let j = 0; j < 9; j++) { const gr = g.createRadialGradient(40 + j * 22, 52 + r() * 10, 2, 40 + j * 22, 52, 34 + r() * 14); gr.addColorStop(0, look.night ? 'rgba(80,80,130,0.5)' : 'rgba(255,248,240,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 96); }
      const sp = new S.Sprite(new S.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false, opacity: look.night ? 0.35 : 0.8, fog: false }));
      const a = (k / 8) * 6.28 + 0.4; sp.position.set(Math.sin(a) * 240, 70 + (k % 3) * 22, -Math.cos(a) * 240); sp.scale.set(120 + (k % 3) * 30, 45, 1); group.add(sp);
    }
  }

  _atmosphere() {
    const { group, look, key } = this, S = THREE;
    // floating dust motes catching the light
    for (let i = 0; i < 46; i++) {
      const s = new S.Sprite(new S.SpriteMaterial({ map: this.glowTex, blending: S.AdditiveBlending, transparent: true, depthWrite: false, opacity: look.night ? 0.28 : 0.4 }));
      s.userData = { a: i * 2.399, d: 1.5 + (i % 9) * 0.9, h: 0.4 + (i % 7) * 0.5, sp: 0.1 + (i % 5) * 0.04 };
      s.scale.set(0.09, 0.09, 1); group.add(s); this.motes.push(s);
    }
    // bunting across the lane (flags on a sagging string) and, at night, lanterns
    const lines = key === 'harvest' ? [] : [[-30, 6.3, 12, 30, 6.4, 12], [-30, 6.0, 26, 30, 6.1, 27], [-30, 6.6, 40, 30, 6.5, 41], [-30, 6.1, -4, 30, 6.2, -3]];
    const cols = ['#e8451f', '#f2b02e', '#2fae8c', '#3a78c8', '#f4efe2', '#d94f8e'].map((h) => new S.Color(h));
    const flag = new BufferGeometry();
    flag.setAttribute('position', new Attr(new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, -0.42, 0]), 3)); flag.setAttribute('normal', new Attr(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
    flag.setIndex(new IndexAttr(new Uint16Array([0, 2, 1]), 1));
    const nFlags = lines.length * 34;
    if (nFlags) {
      const im = new S.InstancedMesh(flag, new S.MeshBasicMaterial({ side: S.DoubleSide }), nFlags);
      const m = new S.Matrix4(), q = new S.Quaternion(), e = new S.Euler(), sc = new V3(1, 1, 1);
      let n = 0;
      lines.forEach((L, li) => {
        for (let k = 0; k < 34; k++) {
          const t = (k + 0.5) / 34, x = L[0] + (L[3] - L[0]) * t, y = L[1] + (L[4] - L[1]) * t - Math.sin(t * Math.PI) * 1.4, z = L[2] + (L[5] - L[2]) * t;
          e.set(0, Math.PI / 2, (k % 2 ? 0.05 : -0.05)); q.setFromEuler(e); m.compose(new V3(x, y, -z), q, sc); im.setMatrixAt(n, m); im.setColorAt(n, cols[(k + li) % cols.length]); n++;
        }
        // the string itself
        const pts = []; for (let k = 0; k <= 24; k++) { const t = k / 24; pts.push(new V3(L[0] + (L[3] - L[0]) * t, L[1] + (L[4] - L[1]) * t - Math.sin(t * Math.PI) * 1.4 + 0.02, -(L[2] + (L[5] - L[2]) * t))); }
        const geo = new BufferGeometry(); const pa = []; pts.forEach((p) => pa.push(p.x, p.y, p.z)); geo.setAttribute('position', new Attr(new Float32Array(pa), 3));
        group.add(new S.Line(geo, new S.LineBasicMaterial({ color: 0x3a2a1a })));
      });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.frustumCulled = false; group.add(im);
    }
    if (look.night) {
      const lan = [];
      for (const L of lines) for (let k = 0; k < 11; k++) { const t = (k + 0.5) / 11; lan.push([L[0] + (L[3] - L[0]) * t, L[1] + (L[4] - L[1]) * t - Math.sin(t * Math.PI) * 1.4 - 0.35, L[2] + (L[5] - L[2]) * t, k]); }
      const orb = new S.Mesh(new S.SphereGeometry(0.26, 10, 8), new S.MeshBasicMaterial({ color: 0xffffff }));
      const im2 = new S.InstancedMesh(orb.geometry, new S.MeshBasicMaterial({}), lan.length);
      const lc = ['#ff5a3c', '#ffc23a', '#ff8a3a', '#ffd98a'].map((h) => new S.Color(h));
      const m2 = new S.Matrix4();
      lan.forEach((p, i) => { m2.makeTranslation(p[0], p[1], -p[2]); im2.setMatrixAt(i, m2); im2.setColorAt(i, lc[i % lc.length]); });
      im2.instanceMatrix.needsUpdate = true; if (im2.instanceColor) im2.instanceColor.needsUpdate = true; im2.frustumCulled = false; group.add(im2);
      for (const p of lan) { const g = new S.Sprite(new S.SpriteMaterial({ map: this.glowTex, blending: S.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.75 })); g.position.set(p[0], p[1], -p[2]); g.scale.set(2.6, 2.6, 1); group.add(g); this.flicker.push(g); }
      // lamp glow on the ground at the houses
      for (const side of [-1, 1]) for (const z of [4, 16, 29, 42]) { const g = new S.Sprite(new S.SpriteMaterial({ map: this.glowTex, blending: S.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.35 })); g.position.set(side * 26, 1.6, -z); g.scale.set(11, 7, 1); group.add(g); this.flicker.push(g); }
    }
  }

  setBlob(i, x, z, r, a = 1) { const m = this.blobs[i]; if (!m) return; m.visible = a > 0.01; m.position.set(x, 0.03, z); m.scale.set(r * 1.7, r * 1.2, 1); m.material.opacity = a; }

  update(t, camPos) {
    this.t = t;
    for (const s of this.motes) {
      const u = s.userData, a = u.a + t * u.sp;
      s.position.set(Math.cos(a) * u.d * 1.4 + (camPos ? camPos.x * 0.3 : 0), u.h + Math.sin(t * 0.7 + u.a) * 0.25, -(Math.sin(a) * u.d * 2.6) + 2.5);
      s.material.opacity = (this.look.night ? 0.22 : 0.34) * (0.6 + 0.4 * Math.sin(t * 1.3 + u.a * 3));
    }
    this.flicker.forEach((g, i) => { g.material.opacity = (g.scale.x > 5 ? 0.3 : 0.7) * (0.85 + 0.15 * Math.sin(t * 6 + i * 1.7)); });
  }

  dispose() { this.group.removeFromParent(); }
}
