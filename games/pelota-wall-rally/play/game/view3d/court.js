// The fronton: front wall, left wall, a clear back wall (so rebotes can be seen from behind the court), floor lines, the open right side with a
// low stand. Few draw calls: floor, surround, front wall, left wall, back wall, stand, ball, shadow blob, effect pool.
import { THREE } from '../vendor3d/index.js';
import { HW, L, WALL_H, TOP, TIN, SERVE_LINE, SHORT, BACK_H, BR } from '../src/consts.js';

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const rnd = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };

const STONE = '#d8cdb6', STONE2 = '#cdc1a8', TINCOL = '#2b5d4b', LINE = '#a8322a';

// A wall texture for a plane w (m) x h (m): stone blocks, a dark metal band at the bottom (the tin), painted lines at given heights.
function wallTexture(wm, hm, { tinH = 0, lines = [], px = 90 } = {}) {
  const W = Math.round(wm * px), H = Math.round(hm * px);
  return canvasTex(W, H, (c) => {
    const r = rnd(7);
    c.fillStyle = STONE; c.fillRect(0, 0, W, H);
    // big stone blocks with slight tone variation
    const bw = px * 1.1, bh = px * 0.55;
    for (let row = 0; row * bh < H; row++) for (let col = -1; col * bw < W; col++) {
      const off = (row % 2) * bw * 0.5;
      const tone = (r() - 0.5) * 16;
      c.fillStyle = `rgb(${216 + tone},${205 + tone},${182 + tone})`;
      c.fillRect(col * bw + off + 1, H - (row + 1) * bh + 1, bw - 2, bh - 2);
    }
    c.fillStyle = 'rgba(80,66,44,0.16)';
    for (let row = 0; row * bh < H; row++) { c.fillRect(0, H - row * bh - 1, W, 2); }
    // the tin
    if (tinH > 0) {
      const th = tinH * px;
      const g = c.createLinearGradient(0, H - th, 0, H);
      g.addColorStop(0, '#356f59'); g.addColorStop(1, '#244f40');
      c.fillStyle = g; c.fillRect(0, H - th, W, th);
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(0, H - th, W, 3);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      for (let x = 0; x < W; x += px * 0.45) c.fillRect(x, H - th + 3, 2, th - 3);
    }
    for (const ln of lines) { c.fillStyle = ln.color || LINE; const y = H - ln.y * px; c.fillRect(0, y - (ln.w || 0.05) * px / 2, W, (ln.w || 0.05) * px); }
  });
}

const plane = (w, h, mat, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.set(rx, ry, 0); m.position.set(x, y, z); return m; };

export function buildCourt(stage) {
  const g = new THREE.Group(); g.name = 'fronton';
  const mats = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(o); mats.push(m); return m; };
  // ---- floor (lines painted into the texture): covers the court and a margin
  const MX = 3.0, MZ = 3.0;
  const FW = 2 * HW + 2 * MX, FL = L + 2 * MZ;
  const tex = canvasTex(512, Math.round(512 * FL / FW), (c, w, h) => {
    const r = rnd(3);
    c.fillStyle = '#cbbd9c'; c.fillRect(0, 0, w, h);
    const id = c.getImageData(0, 0, w, h);
    for (let i = 0; i < id.data.length; i += 4) { const n = (r() - 0.5) * 14; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
    // X = across (world -x is texture left... see the plane's mapping below), Z = along
    const S = w / FW;
    const X = (x) => (HW + MX - x) * S;                      // world +x is the left wall: texture x runs the other way (the plane is seen from behind)
    const Z = (z) => (1 - (z + MZ) / FL) * h;
    // out-of-court margin darker
    c.fillStyle = 'rgba(38,40,44,0.78)';
    c.fillRect(0, 0, X(HW) , h); c.fillRect(X(-HW), 0, w - X(-HW), h); c.fillRect(0, 0, w, Z(L)); c.fillRect(0, Z(0), w, h - Z(0));
    c.fillStyle = '#e9e1cf';
    c.strokeStyle = LINE; c.lineWidth = 0.07 * S; c.lineCap = 'butt';
    c.strokeRect(X(HW), Z(L), 2 * HW * S, L * S);            // court outline
    c.lineWidth = 0.06 * S;
    c.beginPath(); c.moveTo(X(HW), Z(SHORT)); c.lineTo(X(-HW), Z(SHORT)); c.stroke();   // short line
    c.lineWidth = 0.05 * S;
    c.beginPath(); c.moveTo(X(HW), Z(L - 1.0)); c.lineTo(X(-HW), Z(L - 1.0)); c.stroke();   // faint front court line
  });
  const floor = plane(FW, FL, M({ map: tex, roughness: 0.82, metalness: 0 }), 0, 0, L / 2, -Math.PI / 2);
  // the plane is viewed from +y; its texture x runs with world +x, so mirror it in the texture instead: flip via scale
  floor.scale.x = -1; floor.material.side = THREE.DoubleSide;
  floor.receiveShadow = true; g.add(floor);
  // ---- front wall (z = L, faces -z) and left wall (x = +HW, faces -x) in ONE mesh: both textures live in one atlas, so the two walls are a single draw call
  const PX = 90, fwT = 2 * HW * PX, lwT = L * PX, atlasW = Math.round(fwT + lwT), atlasH = Math.round(WALL_H * PX);
  const frontCan = wallTexture(2 * HW, WALL_H, { tinH: TIN, lines: [{ y: SERVE_LINE, w: 0.05 }, { y: TOP, w: 0.06 }] }).image;
  const leftCan = wallTexture(L, WALL_H, { tinH: TIN, lines: [] }).image;
  const atlas = canvasTex(atlasW, atlasH, (c) => { c.drawImage(frontCan, 0, 0); c.drawImage(leftCan, Math.round(fwT), 0); });
  const u1 = fwT / atlasW;
  const quad = (p0, p1, p2, p3, n, ua, ub) => ({ pos: [...p0, ...p1, ...p2, ...p3], nor: [...n, ...n, ...n, ...n], uv: [ua, 0, ub, 0, ub, 1, ua, 1] });
  const fq = quad([HW, 0, L], [-HW, 0, L], [-HW, WALL_H, L], [HW, WALL_H, L], [0, 0, -1], 0, u1);
  const lq = quad([HW, 0, 0], [HW, 0, L], [HW, WALL_H, L], [HW, WALL_H, 0], [-1, 0, 0], u1, 1);
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute([...fq.pos, ...lq.pos], 3));
  wg.setAttribute('normal', new THREE.Float32BufferAttribute([...fq.nor, ...lq.nor], 3));
  wg.setAttribute('uv', new THREE.Float32BufferAttribute([...fq.uv, ...lq.uv], 2));
  wg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const walls = new THREE.Mesh(wg, M({ map: atlas, roughness: 0.9, side: THREE.DoubleSide }));
  g.add(walls);
  // ---- back wall: clear panels (so a ball that rebounds off it stays visible), frame and a top rail
  const glassTex = canvasTex(256, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(200,230,245,0.05)'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(235,245,250,0.3)'; c.fillRect(0, 0, w, 1);
    c.fillStyle = 'rgba(235,245,250,0.3)'; c.fillRect(0, 0, 2, h); c.fillRect(w - 2, 0, 2, h);
  });
  const glass = plane(2 * HW, BACK_H, new THREE.MeshBasicMaterial({ map: glassTex, transparent: true, depthWrite: false, opacity: 1, side: THREE.DoubleSide }), 0, BACK_H / 2, 0);
  g.add(glass);
  // ---- surround: dark plaza under and behind everything, plus the low stand on the open right side
  const crowd = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#1a232b'; c.fillRect(0, 0, w, h);
    const r = rnd(11);
    const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a', '#7a8794'];
    for (let row = 0; row < 6; row++) for (let i = 0; i < 90; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.6; c.beginPath(); c.arc(i * 5.8 + r() * 3, 14 + row * 17 + r() * 4, 3.2 + r() * 1.4, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  }, [2, 1]);
  const stand = plane(L + 6, 3.2, new THREE.MeshStandardMaterial({ map: crowd, roughness: 1 }), -HW - 2.6, 1.7, L / 2, 0, Math.PI / 2);
  stand.rotation.set(0, Math.PI / 2, 0); stand.rotation.order = 'YXZ'; stand.rotation.x = -0.35;
  g.add(stand);
  stage.add(g);
  return g;
}

// ---- the ball: a textured sphere; hand ball is cream leather with seams, the paddle ball is bright rubber
export function buildBall(kind = 'cream') {
  const tex = canvasTex(256, 128, (c, w, h) => {
    if (kind === 'yellow') {
      c.fillStyle = '#e4ee3a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#f7fbd0'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, h * 0.28); c.bezierCurveTo(w * 0.3, h * 0.1, w * 0.5, h * 0.5, w, h * 0.3); c.stroke();
      c.beginPath(); c.moveTo(0, h * 0.78); c.bezierCurveTo(w * 0.3, h * 0.6, w * 0.5, h, w, h * 0.8); c.stroke();
    } else {
      c.fillStyle = '#f2e6c8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#7b4a2a'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(0, h * 0.5); c.lineTo(w, h * 0.5); c.stroke();
      for (let i = 0; i < 28; i++) { const x = i * w / 28 + 4; c.beginPath(); c.moveTo(x, h * 0.5 - 9); c.lineTo(x + 6, h * 0.5 + 9); c.stroke(); }
      c.strokeStyle = '#b38b58'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, h * 0.2); c.lineTo(w, h * 0.2); c.moveTo(0, h * 0.8); c.lineTo(w, h * 0.8); c.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0, emissive: kind === 'yellow' ? '#7a8a10' : '#6a5a3a', emissiveIntensity: 0.35 }));
  m.castShadow = false; m.name = 'ball';
  return m;
}

// ---- a wooden paddle (pala): ONE mesh (handle + blade merged with vertex colours); handle along +Y from the butt (origin), blade face toward +Z
function mergeColored(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, color, m } of parts) {
    geo.applyMatrix4(m);
    const p = geo.attributes.position, n = geo.attributes.normal, ix = geo.index;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
export function buildPaddle() {
  const M4 = (x, y, z, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
  const geo = mergeColored([
    { geo: new THREE.CylinderGeometry(0.018, 0.021, 0.16, 10), color: '#4a3220', m: M4(0, 0.08, 0) },
    { geo: new THREE.SphereGeometry(1, 22, 14), color: '#b88646', m: M4(0, 0.3, 0, 0.1, 0.15, 0.0075) },
    { geo: new THREE.SphereGeometry(1, 22, 8), color: '#4a3220', m: M4(0, 0.3, 0, 0.104, 0.154, 0.0062) },
  ]);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  mesh.name = 'pala'; mesh.castShadow = false;
  return mesh;
}
export const PADDLE = { palmToFace: 0.22, faceThick: 0.011 };
