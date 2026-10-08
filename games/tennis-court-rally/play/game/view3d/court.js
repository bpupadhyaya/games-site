// The court: floor with painted lines (one texture per surface), net with posts and tape, a low surround with blank boards and a stand, an
// umpire chair, the ball and the racket. Few draw calls: floor, net, posts+chair+boards (one merged mesh), stand, ball, shadow blobs, effects.
import { THREE } from '../vendor3d/index.js';
import { HW, HL, SL, ALLEY, NET_C, NET_P, NET_HW, BR, SURFACES, netTop } from '../src/consts.js';

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

export const SURR = { x: HW + ALLEY + 4.2, zNear: HL + 6.0, zFar: HL + 6.0 };   // extent of the painted floor

// merge helper: parts [{geo, color, m(Matrix4)}] into one vertex-coloured geometry
export function mergeColored(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, color, m } of parts) {
    if (m) geo.applyMatrix4(m);
    const g = geo.index ? geo : geo.toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal, ix = g.index;
    const c = new THREE.Color(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const M4 = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

function floorTexture(surf) {
  const FW = 2 * SURR.x, FL = SURR.zNear + SURR.zFar, S = 56;
  const W = Math.round(FW * S), Hh = Math.round(FL * S);
  return canvasTex(W, Hh, (c) => {
    const r = rnd(5), X = (x) => (SURR.x - x) * S, Z = (z) => (SURR.zFar - z) * S;       // world +x is the left of the near player: mirror in the texture
    // run-off
    c.fillStyle = surf.run; c.fillRect(0, 0, W, Hh);
    // court area (+ alleys) a little brighter, with mowing stripes on the lawn
    const cx0 = X(HW + ALLEY + 0.2), cx1 = X(-(HW + ALLEY + 0.2));
    c.fillStyle = surf.court; c.fillRect(Math.min(cx0, cx1), Z(HL + 0.2), Math.abs(cx1 - cx0), Z(-HL - 0.2) - Z(HL + 0.2));
    if (surf.id === 'lawn') {
      for (let i = 0; i < 18; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.04)'; c.fillRect(0, Z(HL + 5.5) + i * (11 / 18 * S * 1.9), W, S * 1.0); }
      // worn patches near the baselines
      for (const zz of [-HL + 0.2, HL - 0.2]) { const g = c.createRadialGradient(X(0), Z(zz), 2, X(0), Z(zz), S * 2.6); g.addColorStop(0, 'rgba(176,160,96,0.55)'); g.addColorStop(1, 'rgba(176,160,96,0)'); c.fillStyle = g; c.fillRect(X(0) - S * 3, Z(zz) - S * 3, S * 6, S * 6); }
    }
    // grain
    const id = c.getImageData(0, 0, W, Hh);
    const k = surf.id === 'clay' ? 26 : surf.id === 'lawn' ? 18 : 10;
    for (let i = 0; i < id.data.length; i += 4) { const n = (r() - 0.5) * k; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    c.putImageData(id, 0, 0);
    // lines
    c.strokeStyle = surf.line; c.fillStyle = surf.line; c.lineCap = 'butt';
    const lw = 0.07 * S;
    c.lineWidth = lw;
    const seg = (x0, z0, x1, z1) => { c.beginPath(); c.moveTo(X(x0), Z(z0)); c.lineTo(X(x1), Z(z1)); c.stroke(); };
    seg(-HW - ALLEY, HL, HW + ALLEY, HL); seg(-HW - ALLEY, -HL, HW + ALLEY, -HL);           // baselines
    seg(-HW - ALLEY, -HL, -HW - ALLEY, HL); seg(HW + ALLEY, -HL, HW + ALLEY, HL);            // doubles sidelines
    seg(-HW, -HL, -HW, HL); seg(HW, -HL, HW, HL);                                           // singles sidelines
    seg(-HW, SL, HW, SL); seg(-HW, -SL, HW, -SL); seg(0, -SL, 0, SL);                        // service lines and the centre service line
    seg(0, HL, 0, HL - 0.3); seg(0, -HL, 0, -HL + 0.3);                                     // centre marks
  });
}

export function buildCourt(stage) {
  const g = new THREE.Group(); g.name = 'court';
  const FW = 2 * SURR.x, FL = SURR.zNear + SURR.zFar;
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(SURFACES.lawn), roughness: 0.9, metalness: 0, side: THREE.DoubleSide });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FL), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.scale.x = -1; floor.position.set(0, 0, (SURR.zFar - SURR.zNear) / 2);
  floor.receiveShadow = true; g.add(floor);
  const texCache = { lawn: floorMat.map };
  const setSurface = (id) => {
    if (!texCache[id]) texCache[id] = floorTexture(SURFACES[id]);
    floorMat.map = texCache[id]; floorMat.needsUpdate = true;
  };

  // ---- the net: a sagging mesh with a white tape on top, two posts and a centre strap
  const nw = 2 * NET_HW, nsX = 40;
  const netGeo = new THREE.PlaneGeometry(nw, 1, nsX, 1);
  const np = netGeo.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), top = netTop(x); np.setY(i, np.getY(i) > 0 ? top : 0.0); }
  netGeo.computeVertexNormals();
  const netTex = canvasTex(512, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(20,24,22,0.95)'; c.lineWidth = 2;
    for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 6); c.lineTo(x, h); c.stroke(); }
    for (let y = 8; y <= h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
    c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, w, 8);
  });
  const net = new THREE.Mesh(netGeo, new THREE.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide }));
  net.position.set(0, 0, 0); g.add(net);
  // ---- merged props: posts, centre strap, chair, boards
  const parts = [];
  for (const sx of [-1, 1]) parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.055, NET_P + 0.06, 10), color: '#3b4a42', m: M4(sx * (NET_HW + 0.04), (NET_P + 0.06) / 2, 0) });
  parts.push({ geo: new THREE.BoxGeometry(0.06, NET_C, 0.02), color: '#f4f4ef', m: M4(0, NET_C / 2, 0) });
  // the umpire chair on the left of the near player, beyond the post
  const cx = HW + ALLEY + 1.15;
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) parts.push({ geo: new THREE.BoxGeometry(0.07, 1.9, 0.07), color: '#5c6b64', m: M4(cx + dx, 0.95, dz) });
  parts.push({ geo: new THREE.BoxGeometry(0.85, 0.08, 0.8), color: '#d8dbd2', m: M4(cx, 1.9, 0) });
  parts.push({ geo: new THREE.BoxGeometry(0.85, 0.7, 0.07), color: '#d8dbd2', m: M4(cx + 0.0, 2.3, 0.4) });
  parts.push({ geo: new THREE.BoxGeometry(0.7, 0.6, 0.5), color: '#2f5d86', m: M4(cx, 2.3, 0.05) });   // seated official: a block, no detail
  // plain boards around the court (no marks)
  const bz = HL + 5.4, bx = SURR.x - 0.6;
  parts.push({ geo: new THREE.BoxGeometry(2 * bx, 0.9, 0.12), color: '#1d3a2b', m: M4(0, 0.45, bz) });
  parts.push({ geo: new THREE.BoxGeometry(2 * bx, 0.9, 0.12), color: '#1d3a2b', m: M4(0, 0.45, -bz) });
  parts.push({ geo: new THREE.BoxGeometry(0.12, 0.9, 2 * bz), color: '#1d3a2b', m: M4(bx, 0.45, 0) });
  parts.push({ geo: new THREE.BoxGeometry(0.12, 0.9, 2 * bz), color: '#1d3a2b', m: M4(-bx, 0.45, 0) });
  parts.push({ geo: new THREE.BoxGeometry(2 * bx, 0.05, 0.2), color: '#e8ece4', m: M4(0, 0.92, bz) });
  parts.push({ geo: new THREE.BoxGeometry(2 * bx, 0.05, 0.2), color: '#e8ece4', m: M4(0, 0.92, -bz) });
  const props = new THREE.Mesh(mergeColored(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }));
  props.castShadow = false; props.receiveShadow = false; g.add(props);
  // ---- stands: a crowd texture behind the far end and along the long sides
  const crowd = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#1b2a22'; c.fillRect(0, 0, w, h);
    const r = rnd(11);
    const cols = ['#a8564a', '#b99a48', '#4a74a0', '#b9bcc0', '#4f8468', '#74559a', '#a8733a', '#66717c', '#c9bfa8'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 100; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.5; c.beginPath(); c.arc(i * 5.2 + r() * 3, 12 + row * 16 + r() * 4, 3.4 + r() * 1.2, 0, 6.3); c.fill(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(i * 5.2 - 1, 17 + row * 16, 5, 7); }
    c.globalAlpha = 1;
  }, [3, 1]);
  const mk = (w, h, x, y, z, ry, rx) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: crowd, roughness: 1 })); m.rotation.order = 'YXZ'; m.rotation.set(rx, ry, 0); m.position.set(x, y, z); g.add(m); return m; };
  mk(2 * SURR.x + 8, 5.0, 0, 2.9, HL + 8.6, Math.PI, -0.32);
  mk(2 * (HL + 6), 4.0, SURR.x + 2.4, 2.4, 0, -Math.PI / 2, -0.32);
  mk(2 * (HL + 6), 4.0, -SURR.x - 2.4, 2.4, 0, Math.PI / 2, -0.32);
  stage.add(g);
  return { group: g, setSurface, floorMat };
}

// ---- the ball: a yellow-green sphere with the two white seams
export function buildBall() {
  const tex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#d7e83a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#f6faea'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, h * 0.3); c.bezierCurveTo(w * 0.22, h * 0.02, w * 0.4, h * 0.62, w * 0.5, h * 0.32); c.bezierCurveTo(w * 0.62, h * 0.04, w * 0.8, h * 0.64, w, h * 0.3); c.stroke();
    c.beginPath(); c.moveTo(0, h * 0.75); c.bezierCurveTo(w * 0.22, h * 0.48, w * 0.4, h * 1.08, w * 0.5, h * 0.78); c.bezierCurveTo(w * 0.62, h * 0.5, w * 0.8, h * 1.1, w, h * 0.75); c.stroke();
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(BR, 28, 18), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, emissive: '#7f8e10', emissiveIntensity: 0.4 }));
  m.castShadow = false; m.name = 'ball';
  return m;
}

// ---- the racket: frame, throat, handle and grip merged into ONE mesh with vertex colours, plus a strings plane. Handle along +Y from the butt (origin),
// the string bed faces +Z. The centre of the string bed is RACKET.head above the butt.
export const RACKET = { head: 0.5, palmToFace: 0.43, faceThick: 0.008 };
export function buildRacket(frameColor = '#1d3f78') {
  const geo = mergeColored([
    { geo: new THREE.CylinderGeometry(0.019, 0.021, 0.2, 10), color: '#222a30', m: M4(0, 0.1, 0) },
    { geo: new THREE.CylinderGeometry(0.016, 0.019, 0.07, 8), color: '#e9edf2', m: M4(0, 0.05, 0) },
    { geo: new THREE.CylinderGeometry(0.012, 0.016, 0.1, 8), color: frameColor, m: M4(0, 0.25, 0) },
    { geo: new THREE.TorusGeometry(0.135, 0.0105, 8, 36), color: frameColor, m: M4(0, RACKET.head, 0, 0.9, 1.2, 1) },
    { geo: new THREE.BoxGeometry(0.03, 0.12, 0.012), color: frameColor, m: M4(0, 0.3, 0, 1, 1, 1) },
  ]);
  const frame = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }));
  frame.castShadow = false;
  const tex = canvasTex(64, 64, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(245,247,240,0.95)'; c.lineWidth = 1.4; for (let i = 3; i < w; i += 5) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, h); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(w, i); c.stroke(); } });
  const strings = new THREE.Mesh(new THREE.CircleGeometry(0.125, 28), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  strings.scale.set(0.9, 1.2, 1); strings.position.set(0, RACKET.head, 0.0);
  const g = new THREE.Group(); g.add(frame); g.add(strings); g.name = 'racket';
  return g;
}
