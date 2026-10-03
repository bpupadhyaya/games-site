// The oval, its lines, the four posts at each end, the boundary fence, the stands and the ball. Few meshes (low draw-call count).
import { THREE } from '../vendor3d/index.js';
import { HW, HL, ZG, GHW, BHW } from '../src/consts.js';

const canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
function mergeGeo(list) {
  const pos = [], uv = [], idx = []; let base = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), u = g.getAttribute('uv'), ix = g.index;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); out.setIndex(idx); out.computeVertexNormals();
  return out;
}
const rnd = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

export function buildField(stage) {
  const g = new THREE.Group(); g.name = 'field';
  const M = 14;                                              // margin of mown grass beyond the boundary (m)
  const TW = HW + M, TL = HL + M;
  // --- ground: mown stripes, boundary line, centre circle and squares, goal squares, all in one texture (1 draw call)
  const PXM = 14, tw = Math.round(2 * TW * PXM), th = Math.round(2 * TL * PXM);
  const tex = canvasTex(tw, th, (c, w, h) => {
    const X = (x) => (x + TW) * PXM, Z = (z) => (TL - z) * PXM;
    c.fillStyle = '#2c7c3f'; c.fillRect(0, 0, w, h);
    const r = rnd(5);
    for (let i = 0; i < 2 * TL; i += 4) { c.fillStyle = (i / 4) % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)'; c.fillRect(0, Z(TL - i), w, 4 * PXM); }
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(20,70,25,0.18)' : 'rgba(120,170,70,0.12)'; c.fillRect(r() * w, r() * h, 2, 3); }
    // outside the boundary: darker grass
    c.save(); c.beginPath(); c.rect(0, 0, w, h); c.ellipse(X(0), Z(0), HW * PXM, HL * PXM, 0, 0, Math.PI * 2, true); c.fillStyle = 'rgba(8,40,20,0.35)'; c.fill('evenodd'); c.restore();
    c.strokeStyle = '#f4f6f0'; c.lineWidth = 0.22 * PXM; c.beginPath(); c.ellipse(X(0), Z(0), HW * PXM, HL * PXM, 0, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 0.12 * PXM; c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.beginPath(); c.arc(X(0), Z(0), 3 * PXM, 0, Math.PI * 2); c.stroke();
    c.strokeRect(X(-4.5), Z(4.5), 9 * PXM, 9 * PXM);
    for (const sg of [-1, 1]) {
      c.beginPath(); c.moveTo(X(-BHW), Z(sg * ZG)); c.lineTo(X(BHW), Z(sg * ZG)); c.stroke();
      c.strokeRect(X(-4.5), sg > 0 ? Z(sg * ZG) : Z(sg * ZG + 6.4) - 0, 9 * PXM, 6.4 * PXM * (sg > 0 ? 1 : 1));
      c.beginPath(); c.arc(X(0), Z(sg * (ZG - 10)), 5 * PXM, sg > 0 ? Math.PI * 0.18 : -Math.PI * 0.82, sg > 0 ? Math.PI * 0.82 : -Math.PI * 0.18, sg > 0 ? false : false); c.stroke();
    }
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2 * TW, 2 * TL), new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; g.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#1c4d2a', roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; g.add(outer);

  // --- posts: 4 per end (goal posts 6 m, behind posts 3 m) as ONE merged mesh
  const posts = [];
  for (const sg of [-1, 1]) for (const x of [-BHW, -GHW, GHW, BHW]) posts.push({ x, z: sg * ZG, h: Math.abs(x) < 4 ? 6 : 3 });
  const pgeo = new THREE.BufferGeometry(), pos = [], idx = [], puv = [];
  const seg = 8;
  posts.forEach((p, k) => {
    const r = 0.07, base = pos.length / 3;
    for (let y = 0; y <= 1; y++) for (let a = 0; a < seg; a++) { const t = (a / seg) * Math.PI * 2; pos.push(p.x + Math.cos(t) * r, y * p.h, p.z + Math.sin(t) * r); puv.push(0.5, 0.345); }
    for (let a = 0; a < seg; a++) { const a2 = (a + 1) % seg; idx.push(base + a, base + seg + a, base + a2, base + a2, base + seg + a, base + seg + a2); }
    void k;
  });
  pgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); pgeo.setAttribute('uv', new THREE.Float32BufferAttribute(puv, 2)); pgeo.setIndex(idx); pgeo.computeVertexNormals();

  // --- boundary fence with ad boards, and low stands: one strip each, built as a ring of quads
  const ringGeo = (rx, rz, h, y0, n = 72, uRep = 6, a0 = 0, a1 = Math.PI * 2, v1 = 1, v0 = 0) => {
    const p = [], uv = [], ix = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * (a1 - a0), x = Math.cos(a) * rx, z = Math.sin(a) * rz; p.push(x, y0, z, x, y0 + h, z); uv.push(i / n * uRep, v0, i / n * uRep, v1); }
    for (let i = 0; i < n; i++) { const b = i * 2; ix.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(ix); geo.computeVertexNormals();
    return geo;
  };
  // one atlas for the boards, the white of the posts and the crowd (one material, one draw call): ad boards in the bottom 68 rows, crowd above
  const AT_H = 196, AD_V = 68 / AT_H;
  const atlas = canvasTex(1024, AT_H, (c, w, h) => {
    c.fillStyle = '#13251c'; c.fillRect(0, 0, w, h - 68); const r = rnd(11);
    const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a', '#2a2f36'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 180; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.7; c.beginPath(); c.arc(i * 5.7 + r() * 3, 10 + row * 17 + r() * 4, 3 + r() * 1.5, 0, 6.3); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = '#2a3340'; c.fillRect(0, h - 76, w, 8);
    const y0 = h - 68; c.fillStyle = '#f6f2e6'; c.fillRect(0, y0, w, 4);
    const bcols = ['#c8372d', '#f2b705', '#1f7a4d', '#2a62c9', '#f4f4f0'];
    for (let i = 0; i < 16; i++) { c.fillStyle = bcols[i % bcols.length]; c.fillRect(i * 64, y0 + 4, 64, 64); c.fillStyle = i % 5 === 4 ? '#222' : '#fff'; c.font = '700 26px sans-serif'; c.textAlign = 'center'; c.fillText(['FOOTY', 'MARK', 'KICK', 'GOAL', 'PLAY', 'TEAM', 'SPORT', 'GAME'][i % 8], i * 64 + 32, y0 + 46); }
  });
  const fenceGeo = ringGeo(HW + 2.2, HL + 2.2, 1.0, 0, 96, 5, 0, Math.PI * 2, AD_V * 0.93, 0.003);
  const roofGeo = ringGeo(HW + 11, HL + 11, 1.4, 9.8, 96, 1, -0.28, Math.PI + 0.28); { const u = roofGeo.getAttribute('uv'); for (let i = 0; i < u.count; i++) u.setY(i, AD_V + 0.03); }
  const standGeo = ringGeo(HW + 9, HL + 9, 9, 0.6, 96, 3, -0.28, Math.PI + 0.28, 1, AD_V + 0.05);
  const stands = new THREE.Mesh(mergeGeo([fenceGeo, pgeo, standGeo, roofGeo]), new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.9, side: THREE.DoubleSide }));
  g.add(stands);
  stage.add(g);
  return g;
}

// the ball: an ellipsoid with four panels and stitching, a little larger than life so it reads on a phone (VIS)
export const BALL_VIS = 1.9;
export function buildBall() {
  const tex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#b8321f'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#9a2616'; for (let i = 0; i < 4; i++) c.fillRect(i * w / 4 + 6, 0, w / 4 - 12, h);
    c.strokeStyle = '#f4efe2'; c.lineWidth = 5; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(i * w / 4, 0); c.lineTo(i * w / 4, h); c.stroke(); }
    c.lineWidth = 3; for (let i = 0; i < 4; i++) for (let y = 14; y < h; y += 20) { c.beginPath(); c.moveTo(i * w / 4 - 8, y); c.lineTo(i * w / 4 + 8, y); c.stroke(); }
    c.fillStyle = '#f4efe2'; c.fillRect(0, h / 2 - 5, w, 10);
  });
  const geo = new THREE.SphereGeometry(1, 28, 18); geo.rotateX(Math.PI / 2);          // poles along +Z
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
  m.scale.set(0.095 * BALL_VIS, 0.095 * BALL_VIS, 0.14 * BALL_VIS);
  m.name = 'ball';
  return m;
}
