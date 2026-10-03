// The pitch, the H-shaped goals with net, the stands and the ball: simple, cheap meshes (few draw calls).
// World convention: x is mirrored against the sim (sim +x = screen right = world -x), z is the same.
import { THREE } from '../vendor3d/index.js';
import { HW, HL, GOAL_HW, BAR, POST_H, NET_D, SMALL_D, LINE_13, LINE_20 } from '../src/consts.js';

export const BALL_VIS_R = 0.115;

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };
// Merge primitive meshes into ONE geometry with vertex colours (one draw call). part = { geo, p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz], c: 0xrrggbb }
export function mergeParts(parts) {
  const pos = [], nor = [], col = [], uv = [], idx = [];
  let base = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), nm = new THREE.Matrix3();
  for (const pt of parts) {
    const g = pt.geo.clone();
    e.set(...(pt.r || [0, 0, 0])); q.setFromEuler(e);
    m.compose(new THREE.Vector3(...(pt.p || [0, 0, 0])), q, new THREE.Vector3(...(pt.s || [1, 1, 1])));
    g.applyMatrix4(m);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    c.set(pt.c ?? 0xffffff);
    const R = pt.uvr, K = pt.uvc;   // uvr = [u0, v0, u1, v1]: map the part's 0..1 UVs into that atlas window; uvc = [u, v]: every vertex samples that single atlas point
    for (let i = 0; i < P.count; i++) {
      pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); col.push(c.r, c.g, c.b);
      if (K) uv.push(K[0], K[1]); else if (R && U) uv.push(R[0] + (R[2] - R[0]) * U.getX(i), R[1] + (R[3] - R[1]) * U.getY(i)); else uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
    }
    const I = g.index; if (I) for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + base); else for (let i = 0; i < P.count; i++) idx.push(i + base);
    base += P.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
const seeded = (seed) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

export function buildPitch(stage) {
  const g = new THREE.Group(); g.name = 'pitch';
  // ONE mesh, ONE material, ONE draw call for everything static: the atlas holds the mown pitch with every marking (top), then a white
  // swatch (for flat vertex-coloured parts: frames, steps, boards, surround), the crowd strip and the net strip.
  const PW = 2 * (HW + 5), PL = 2 * (HL + 7), TW = 1024, TH = Math.round(TW * PL / PW);
  const SW = 8, CR = 128, NT = 128, AH = TH + SW + CR + NT + 16;
  const atlas = canvasTex(TW, AH, (c, w, h) => {
    const S = w / PW;
    const X = (x) => (x + PW / 2) * S, Z = (z) => (1 - (z + PL / 2) / PL) * TH;
    c.fillStyle = '#3e8a45'; c.fillRect(0, 0, w, TH);
    // mown bands across the pitch
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#3a8341' : '#46934d'; const z0 = -HL + (i * 2 * HL) / 16; c.fillRect(X(-HW), Z(z0 + (2 * HL) / 16), 2 * HW * S, (2 * HL / 16) * S + 1); }
    // outside the lines: darker
    c.fillStyle = '#2e6d36'; c.fillRect(0, 0, X(-HW), TH); c.fillRect(X(HW), 0, w - X(HW), TH); c.fillRect(0, 0, w, Z(HL + 0)); c.fillRect(0, Z(-HL), w, TH - Z(-HL));
    // grain
    const id = c.getImageData(0, 0, w, TH), rnd = seeded(9);
    for (let i = 0; i < id.data.length; i += 4) { const n = (rnd() - 0.5) * 10; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n * 0.6; }
    c.putImageData(id, 0, 0);
    c.strokeStyle = '#f4f7f2'; c.lineWidth = 0.1 * S; c.lineCap = 'butt';
    c.strokeRect(X(-HW), Z(HL), 2 * HW * S, 2 * HL * S);
    c.lineWidth = 0.07 * S;
    const hl = (z) => { c.beginPath(); c.moveTo(X(-HW), Z(z)); c.lineTo(X(HW), Z(z)); c.stroke(); };
    hl(0); hl(HL - LINE_13); hl(-HL + LINE_13); hl(HL - LINE_20); hl(-HL + LINE_20);
    for (const sg of [-1, 1]) {
      c.strokeRect(X(-GOAL_HW - 2.2), Z(sg * HL), (GOAL_HW * 2 + 4.4) * S, -sg * SMALL_D * S);   // small rectangle
      c.beginPath(); c.arc(X(0), Z(sg * (HL - LINE_20)), 5 * S, sg > 0 ? 0.0 : Math.PI, sg > 0 ? Math.PI : 2 * Math.PI, false); c.stroke();
    }
    // white swatch
    c.fillStyle = '#fff'; c.fillRect(0, TH, w, SW);
    // crowd strip
    const y0 = TH + SW;
    c.fillStyle = '#1b2a22'; c.fillRect(0, y0, w, CR);
    const rc = seeded(17), cols = ['#c9544a', '#e6c24f', '#3f86c9', '#eeeeee', '#58a67e', '#8a63b8', '#df8f3d', '#2a2a2e'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 200; i++) { c.fillStyle = cols[Math.floor(rc() * cols.length)]; c.globalAlpha = 0.7; c.beginPath(); c.arc(i * 5.2 + rc() * 3, y0 + 12 + row * 16 + rc() * 4, 3.1 + rc() * 1.5, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
    // net strip (transparent background, cut out with alphaTest)
    const n0 = y0 + CR + 8;
    c.strokeStyle = 'rgba(245,245,240,0.95)'; c.lineWidth = 1.6;
    for (let x = 0; x <= w; x += 32) { c.beginPath(); c.moveTo(x, n0); c.lineTo(x, n0 + NT); c.stroke(); }
    for (let y = 0; y <= NT; y += 16) { c.beginPath(); c.moveTo(0, n0 + y); c.lineTo(w, n0 + y); c.stroke(); }
  });
  atlas.generateMipmaps = true;
  const V_ = (y) => 1 - y / AH;     // canvas row -> texture v
  const WH = [0.5, V_(TH + SW / 2)];                       // white swatch point
  const CRW = [0, V_(TH + SW + CR - 2), 1, V_(TH + SW + 2)];   // crowd window (u0, vBottom, u1, vTop)
  const NTW = [0, V_(TH + SW + CR + 8 + NT - 2), 1, V_(TH + SW + CR + 8 + 2)];
  const parts = [];
  // ground: the pitch window uses the top TH rows; the surround is flat colour
  parts.push({ geo: new THREE.PlaneGeometry(PW, PL), p: [0, 0, 0], r: [-Math.PI / 2, 0, 0], uvr: [0, V_(TH), 1, 1] });
  parts.push({ geo: new THREE.PlaneGeometry(160, 160), p: [0, -0.01, 0], r: [-Math.PI / 2, 0, 0], uvc: WH, c: 0x25552c });

  // ---- goals: H-shaped posts, crossbar, net behind the line
  for (const sg of [1, -1]) {
    const z0 = sg * HL, d = NET_D * sg;
    for (const x of [-GOAL_HW, GOAL_HW]) parts.push({ geo: new THREE.CylinderGeometry(0.075, 0.085, POST_H, 12), p: [x, POST_H / 2, z0], uvc: WH, c: 0xf6f6f2 });
    parts.push({ geo: new THREE.CylinderGeometry(0.065, 0.065, GOAL_HW * 2, 12), p: [0, BAR, z0], r: [0, 0, Math.PI / 2], uvc: WH, c: 0xf6f6f2 });
    parts.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, GOAL_HW * 2, 8), p: [0, 0.03, z0 + d], r: [0, 0, Math.PI / 2], uvc: WH, c: 0xf6f6f2 });
    parts.push({ geo: new THREE.PlaneGeometry(GOAL_HW * 2, BAR), p: [0, BAR / 2, z0 + d], uvr: NTW });
    for (const sx of [-1, 1]) parts.push({ geo: new THREE.PlaneGeometry(NET_D, BAR), p: [sx * GOAL_HW, BAR / 2, z0 + d / 2], r: [0, Math.PI / 2, 0], uvr: NTW });
    parts.push({ geo: new THREE.PlaneGeometry(GOAL_HW * 2, NET_D), p: [0, BAR, z0 + d / 2], r: [-Math.PI / 2, 0, 0], uvr: NTW });
  }

  // ---- stands: tiers with a crowd on the long sides and behind the far goal; dark boards in front
  const tier = (len, x, z, ry, rows = 3) => {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const W = (lx, ly, lz) => [x + lx * cs + lz * sn, ly, z - lx * sn + lz * cs];   // local -> world (rotation about Y)
    for (let r = 0; r < rows; r++) {
      parts.push({ geo: new THREE.BoxGeometry(len, 0.9, 1.4), p: W(0, 0.45 + r * 0.9, r * 1.4), r: [0, ry, 0], uvc: WH, c: 0x3c4540 });
      parts.push({ geo: new THREE.PlaneGeometry(len, 0.9), p: W(0, 1.1 + r * 0.9, r * 1.4 - 0.71), r: [0, ry, 0], uvr: CRW });
    }
  };
  tier(HL * 2 + 12, HW + 5.2, 0, Math.PI / 2);
  tier(HL * 2 + 12, -HW - 5.2, 0, -Math.PI / 2);
  tier(HW * 2 + 14, 0, HL + 7.0, 0);
  const bd = (len, x, z, ry) => parts.push({ geo: new THREE.BoxGeometry(len, 0.9, 0.12), p: [x, 0.45, z], r: [0, ry, 0], uvc: WH, c: 0x173d2b });
  bd(HL * 2 + 6, HW + 2.6, 0, Math.PI / 2); bd(HL * 2 + 6, -HW - 2.6, 0, Math.PI / 2); bd(HW * 2 + 6, 0, HL + 6.5, 0);
  const mat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.2 });
  const mesh = new THREE.Mesh(mergeParts(parts), mat);
  g.add(mesh);
  stage.add(g);
  return g;
}

// the sliotar: cream leather with a raised seam, drawn larger than life so it reads on a phone
export function buildBall() {
  const tex = canvasTex(512, 256, (c, w, h) => {
    c.fillStyle = '#f2ead7'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#b9ae94'; c.lineWidth = 7;
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    c.lineWidth = 3; c.strokeStyle = '#8f8467';
    for (let x = 0; x < w; x += 12) { c.beginPath(); c.moveTo(x, h / 2 - 11); c.lineTo(x + 6, h / 2 + 11); c.stroke(); }
    c.strokeStyle = '#c9bea4'; c.lineWidth = 5;
    c.beginPath(); c.arc(w / 4, 0, h / 2, 0, 6.3); c.stroke(); c.beginPath(); c.arc((3 * w) / 4, h, h / 2, 0, 6.3); c.stroke();
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_VIS_R, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0 }));
  m.castShadow = true; m.name = 'ball';
  return m;
}

// the hurley: +Y long axis from the butt (origin); the ball centre when struck is on the axis at 0.88 m (HURLEY_SWEET); the bas sits behind the axis.
export const HURLEY_SWEET = 0.88;
export function hurleyGeometry() {
  const wood = 0xc99b5c, grip = 0xe6e2d6, band = 0xd8d0c0;
  return mergeParts([
    { geo: new THREE.CylinderGeometry(0.017, 0.013, 0.72, 6), p: [0, 0.36, 0], c: wood },
    { geo: new THREE.CylinderGeometry(0.019, 0.019, 0.26, 6), p: [0, 0.14, 0], c: grip },
    { geo: new THREE.CylinderGeometry(0.013, 0.015, 0.2, 6), p: [0, 0.8, -0.058], r: [0.55, 0, 0], c: wood },
    { geo: new THREE.BoxGeometry(0.108, 0.2, 0.026), p: [0, 0.89, -0.123], r: [-0.18, 0, 0], c: wood },
    { geo: new THREE.BoxGeometry(0.112, 0.022, 0.03), p: [0, 0.79, -0.12], c: band },
  ]);
}
// helmet cap (tinted per team through the instance colour) and its steel face guard (fixed colour); both in head-centre space, +Y up, +Z forward
export function helmetCapGeometry() {
  return mergeParts([
    { geo: new THREE.SphereGeometry(0.118, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), p: [0, 0.02, 0], s: [1, 1, 1.08], c: 0xffffff },
    { geo: new THREE.TorusGeometry(0.113, 0.011, 4, 12), p: [0, -0.045, 0], r: [Math.PI / 2, 0, 0], s: [1, 1.08, 1], c: 0xffffff },
  ]);
}
export function helmetGuardGeometry() {
  const parts = [];
  for (const x of [-0.06, 0, 0.06]) parts.push({ geo: new THREE.CylinderGeometry(0.0045, 0.0045, 0.11, 4), p: [x * 1.1, -0.065, 0.1 - Math.abs(x) * 0.5], r: [0.18, 0, 0], c: 0xcfd3d6 });
  parts.push({ geo: new THREE.TorusGeometry(0.078, 0.0045, 4, 12), p: [0, -0.105, 0.075], s: [1, 0.5, 1], r: [Math.PI / 2 - 0.2, 0, 0], c: 0xcfd3d6 });
  parts.push({ geo: new THREE.TorusGeometry(0.08, 0.0045, 4, 12), p: [0, -0.04, 0.09], s: [1, 0.5, 1], r: [Math.PI / 2 - 0.2, 0, 0], c: 0xcfd3d6 });
  return mergeParts(parts);
}
