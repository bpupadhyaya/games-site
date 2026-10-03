// The hall: floor with court lines, net with posts and antennae, a crowd stand and the ball. Few meshes on purpose
// (floor, net, one merged decor mesh, ball) so the whole scene stays small on phones.
import { THREE } from '../vendor3d/index.js';

const HW = 4.5, HL = 9.0;

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso ?? 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };

// Merge boxes (with vertex colours) into one geometry: [x, y, z, w, h, d, '#rrggbb', ry?]
function mergeBoxes(list) {
  const pos = [], col = [], nor = [], idx = [];
  const c = new THREE.Color();
  for (const [x, y, z, w, h, d, hex, ry = 0] of list) {
    const g = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Matrix4().makeRotationY(ry); m.setPosition(x, y, z);
    g.applyMatrix4(m);
    const base = pos.length / 3;
    const p = g.attributes.position, n = g.attributes.normal;
    c.set(hex);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

export function buildCourt(stage, { netHeight = 2.43 } = {}) {
  const g = new THREE.Group(); g.name = 'court';
  // --- floor: 3 m free zone all round the 9 x 18 court. The texture carries every line (one mesh).
  const FW = 2 * (HW + 3.2), FL = 2 * (HL + 3.2), TW = 1024, TH = Math.round(1024 * FL / FW);
  const floorTex = canvasTex(TW, TH, (c, w, h) => {
    const S = w / FW;                                   // px per metre
    const X = (x) => (x + FW / 2) * S, Z = (z) => (1 - (z + FL / 2) / FL) * h;
    c.fillStyle = '#26566f'; c.fillRect(0, 0, w, h);    // free zone
    c.fillStyle = '#d28a4a'; c.fillRect(X(-HW), Z(HL), 2 * HW * S, 2 * HL * S);   // playing court
    // wood grain: thin planks along the length with slight tone variation
    let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 70; i++) { const x = X(-HW) + (i / 70) * 2 * HW * S; c.fillStyle = `rgba(${rnd() < 0.5 ? '255,235,200' : '90,45,15'},${0.04 + rnd() * 0.05})`; c.fillRect(x, Z(HL), 2 * HW * S / 70, 2 * HL * S); }
    for (let i = 0; i < 60; i++) { const x = (i / 60) * w; c.fillStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`; c.fillRect(x, 0, w / 60, Z(HL)); c.fillRect(x, Z(-HL), w / 60, h - Z(-HL)); }
    // sheen band from the lights
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.04)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.10)'); gr.addColorStop(1, 'rgba(255,255,255,0.03)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f7f8fb'; c.lineCap = 'butt';
    c.lineWidth = 0.05 * S; c.strokeRect(X(-HW), Z(HL), 2 * HW * S, 2 * HL * S);
    c.beginPath(); c.moveTo(X(-HW), Z(0)); c.lineTo(X(HW), Z(0)); c.stroke();                       // centre line
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(X(-HW), Z(sg * 3)); c.lineTo(X(HW), Z(sg * 3)); c.stroke(); }   // attack lines
    c.lineWidth = 0.05 * S; c.setLineDash([0.15 * S, 0.15 * S]);
    for (const sg of [-1, 1]) for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(X(sx * HW), Z(sg * 3)); c.lineTo(X(sx * HW), Z(sg * 4.7)); c.stroke(); }   // extended attack-line ticks
    c.setLineDash([]);
  });
  const floor = plane(FW, FL, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0 }), 0, 0, 0);
  floor.receiveShadow = true; g.add(floor);

  // --- net: one textured plane, 9.5 m long x 1 m deep, tape on top, white side bands
  const NW = 9.5, NH = 1.0 + 0.06;
  const netTex = canvasTex(1024, Math.round(1024 * NH / NW * 2.0), (c, w, h) => {
    c.clearRect(0, 0, w, h);
    const px = (m) => (m / NW) * w, py = (m) => (m / NH) * h;
    c.strokeStyle = 'rgba(240,242,248,0.85)'; c.lineWidth = 1.4;
    const top = py(0.06), bot = py(1.06);
    for (let x = px(0.05); x <= w - px(0.05); x += px(0.10)) { c.beginPath(); c.moveTo(x, top); c.lineTo(x, bot); c.stroke(); }
    for (let y = top; y <= bot; y += py(0.10)) { c.beginPath(); c.moveTo(px(0.05), y); c.lineTo(w - px(0.05), y); c.stroke(); }
    c.fillStyle = '#f8f8fa'; c.fillRect(px(0.02), 0, w - px(0.04), py(0.07));                             // top tape
    c.fillStyle = '#e9ebf0'; c.fillRect(px(0.02), py(1.0), w - px(0.04), py(0.06));                       // bottom band
    c.fillStyle = '#f8f8fa'; for (const sx of [-HW, HW]) c.fillRect(px(NW / 2 + sx) - 0.025 * w / NW * 2, top, 0.05 * w / NW * 2, bot - top);   // side bands
  });
  const net = plane(NW, NH, new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.04, roughness: 1, side: THREE.DoubleSide }), 0, netHeight - NH / 2 + 0.03, 0, 0);
  g.add(net);

  // --- decor in ONE mesh (vertex colours): posts, antennae, referee stand, side boards, benches and a crowd stand of coloured blocks
  const L = [];
  for (const sx of [-1, 1]) {
    L.push([sx * 5.1, (netHeight + 0.12) / 2, 0, 0.12, netHeight + 0.12, 0.12, '#cfd3da']);                    // post
    for (let k = 0; k < 6; k++) L.push([sx * (HW + 0.02), netHeight + 0.03 + 0.1 + k * 0.2, 0, 0.04, 0.2, 0.04, k % 2 ? '#f2f2f2' : '#d83a32']);   // antenna stripes
    L.push([sx * (HW + 3.3), 0.45, 0, 0.12, 0.9, 2 * (HL + 3.3), '#16384d']);                                  // side boards
    L.push([sx * (HW + 3.3), 0.92, 0, 0.14, 0.05, 2 * (HL + 3.3), '#e7ecf2']);
  }
  L.push([0, 0.45, HL + 3.3, 2 * (HW + 3.3), 0.9, 0.12, '#16384d']); L.push([0, 0.45, -HL - 3.3, 2 * (HW + 3.3), 0.9, 0.12, '#16384d']);
  L.push([HW + 0.9, 0.9, 0.0, 0.5, 1.8, 0.5, '#d9dde4']);                                                    // referee stand
  L.push([HW + 0.9, 1.9, 0.0, 0.7, 0.1, 0.7, '#6d7a8c']);
  L.push([-HW - 1.3, 0.2, -3.6, 1.6, 0.4, 0.5, '#2a3f55']); L.push([-HW - 1.3, 0.2, 3.6, 1.6, 0.4, 0.5, '#2a3f55']);   // benches
  // crowd stand behind the far end and along both sides: rows of coloured blocks that step upwards
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a', '#7b8794'];
  for (let row = 0; row < 3; row++) {
    const y = 0.9 + row * 0.42, z = HL + 4.6 + row * 0.55;
    L.push([0, y - 0.25, z + 0.1, 2 * (HW + 5), 0.5, 0.9, '#1d2c3c']);
    for (let i = -15; i <= 15; i++) { const x = i * 0.66 + rnd() * 0.1; L.push([x, y + 0.2, z, 0.34, 0.5 + rnd() * 0.1, 0.3, cols[Math.floor(rnd() * cols.length)]]); }
  }
  for (const sx of [-1, 1]) for (let row = 0; row < 2; row++) {
    const y = 0.9 + row * 0.42, x = sx * (HW + 4.6 + row * 0.55);
    L.push([x + sx * 0.1, y - 0.25, 0, 0.9, 0.5, 2 * (HL + 3), '#1d2c3c']);
    for (let i = -11; i <= 11; i++) { const z = i * 0.95 + rnd() * 0.1; if (Math.abs(z) < 2.4 && row === 0 && sx > 0) continue; L.push([x, y + 0.2, z, 0.3, 0.5 + rnd() * 0.1, 0.34, cols[Math.floor(rnd() * cols.length)]]); }
  }
  const decor = new THREE.Mesh(mergeBoxes(L), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  g.add(decor);
  stage.add(g);
  return g;
}

// A volleyball: three colours in curved panels, drawn on an equirectangular texture. Radius `r` is the sim's ball radius.
export function buildBall(r) {
  const tex = canvasTex(1024, 512, (c, w, h) => {
    c.fillStyle = '#f4f1e6'; c.fillRect(0, 0, w, h);
    const cols = ['#2a63c8', '#f2c230', '#f4f1e6'];
    // six panels around the equator, each a band of three coloured strips that bows with latitude
    for (let p = 0; p < 6; p++) {
      const x0 = (p / 6) * w;
      for (let s = 0; s < 3; s++) {
        c.fillStyle = cols[(s + p) % 3];
        c.beginPath();
        for (let y = 0; y <= h; y += 16) { const bow = Math.sin((y / h) * Math.PI) * 26; const xx = x0 + (s / 3) * (w / 6) + bow * (s - 1) * 0.5; if (y === 0) c.moveTo(xx, y); else c.lineTo(xx, y); }
        for (let y = h; y >= 0; y -= 16) { const bow = Math.sin((y / h) * Math.PI) * 26; const xx = x0 + ((s + 1) / 3) * (w / 6) + bow * (s - 0.5) * 0.5; c.lineTo(xx, y); }
        c.closePath(); c.fill();
      }
      c.strokeStyle = 'rgba(40,40,60,0.55)'; c.lineWidth = 3;
      c.beginPath(); for (let y = 0; y <= h; y += 16) { const bow = Math.sin((y / h) * Math.PI) * 26; const xx = x0 + bow * -0.25; if (y === 0) c.moveTo(xx, y); else c.lineTo(xx, y); } c.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
  m.castShadow = true; m.name = 'ball';
  return m;
}
