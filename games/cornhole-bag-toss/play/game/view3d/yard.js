// The lit backyard (game-owned 3D art): sky dome, mown lawn with blades, a plank fence with posts and rails, string lights, flower beds, trees,
// a cooler and a stool, and the regulation cornhole board (24 x 48 in, tilted, painted top with a cob emblem, a real 6 in hole, side rails, legs)
// plus the soft fabric bags. Everything is procedural (canvas textures and analytic geometry): no asset bytes.
//
// Axes: three (X, Y, Z) = sim (x, y, -z): x across, y up, the sim's z (away from the thrower) runs into -Z.
import * as THREE from '../vendor3d/three.js';
import { BOARD_W, BOARD_L, BOARD_Z0, H_FRONT, H_BACK, SIN_A, COS_A, HOLE_R, HOLE_V, BAG_HALF, surfaceH } from '../src/phys.js';

export const TAU = Math.PI * 2;
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function cvs(w, h, paint) { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; }
export function tex(c, { repeat, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
export function glowTexture(inner = 'rgba(255,240,200,1)', mid = 'rgba(255,200,110,0.35)') {
  return tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, inner); r.addColorStop(0.22, mid); r.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
}
export const FENCE_Z = 15.4, FENCE_H = 1.8;
// the sun is behind the thrower, low and to the left: long shadows run back and to the right
export const SUN_DIR = new THREE.Vector3(-0.5, 0.52, 0.78).normalize();

export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = clamp(normalize(vP).y, 0.0, 1.0);
      vec3 hor = vec3(0.98,0.87,0.67), mid = vec3(0.90,0.80,0.66), top = vec3(0.30,0.52,0.80);
      vec3 c = mix(hor, mid, smoothstep(0.0, 0.10, h)); c = mix(c, top, smoothstep(0.08, 0.62, h));
      gl_FragColor = vec4(pow(c, vec3(2.2)) , 1.0); }`,
  });
}
// a small scene that only feeds the reflections (sky above, grass below, a warm sun)
export function envScene() {
  const sc = new THREE.Scene();
  sc.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), skyMaterial()));
  const g = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x4f7a3a })); g.rotation.x = -Math.PI / 2; g.position.y = -1; sc.add(g);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff0cc })); sun.position.copy(SUN_DIR).multiplyScalar(40); sc.add(sun);
  return sc;
}

// ---- textures -----------------------------------------------------------------------------------------------------------------
function lawnMap() {
  // 4 m across x 2.4 m along z: one light and one dark mown band, with fine blade noise
  const c = cvs(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#5c9a40'; g.fillRect(0, 0, w, h / 2); g.fillStyle = '#4c8836'; g.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < 9000; i++) { const x = r() * w, y = r() * h, l = 2 + r() * 5, a = r() * 0.5 + 0.1; g.strokeStyle = r() > 0.5 ? `rgba(150,200,90,${a * 0.5})` : `rgba(20,60,15,${a * 0.5})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke(); }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${90 + r() * 60},${150 + r() * 50},${60},0.18)`; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 6, 0, TAU); g.fill(); }
  });
  return tex(c, { repeat: [100, 166], aniso: 8 });
}
function fenceMap() {
  const c = cvs(1024, 256, (g, w, h) => {
    const r = rng(3), n = 8, bw = w / n;
    for (let i = 0; i < n; i++) {
      const k = r(); g.fillStyle = `rgb(${150 + k * 26},${106 + k * 18},${66 + k * 12})`; g.fillRect(i * bw, 0, bw, h);
      for (let j = 0; j < 26; j++) { const x = i * bw + 4 + r() * (bw - 8); g.strokeStyle = `rgba(${r() > 0.5 ? '255,226,170' : '50,28,10'},${0.05 + r() * 0.12})`; g.lineWidth = 1 + r() * 1.5; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, h * 0.3, x + (r() - 0.5) * 10, h * 0.7, x + (r() - 0.5) * 8, h); g.stroke(); }
      if (r() > 0.7) { const kx = i * bw + 20 + r() * (bw - 40), ky = 30 + r() * (h - 60); g.fillStyle = 'rgba(60,32,12,0.55)'; g.beginPath(); g.ellipse(kx, ky, 6, 9, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(25,12,4,0.7)'; g.fillRect(i * bw, 0, 3, h); g.fillStyle = 'rgba(255,230,170,0.12)'; g.fillRect(i * bw + 3, 0, 2, h);
    }
  });
  return tex(c, { repeat: [20, 1] });
}
function boardMap() {
  // 512 x 1024 = 0.6096 x 1.2192 m (840 px per m). Row 0 is the back edge. u from the left, v from the front edge.
  const c = cvs(512, 1024, (g, w, h) => {
    const r = rng(7), ppm = w / BOARD_W;
    g.fillStyle = '#efdcb4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { const x = (i / 16) * w; g.fillStyle = `rgba(${150 + r() * 40},${110 + r() * 30},60,${0.05 + r() * 0.08})`; g.fillRect(x, 0, w / 16, h); g.fillStyle = 'rgba(120,80,40,0.18)'; g.fillRect(x, 0, 1.5, h); }
    for (let i = 0; i < 380; i++) { const x = r() * w, y = r() * h; g.strokeStyle = `rgba(140,98,52,${0.05 + r() * 0.12})`; g.lineWidth = 0.8 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (r() - 0.5) * 6, y + 40, x + (r() - 0.5) * 6, y + 90, x + (r() - 0.5) * 8, y + 150 + r() * 120); g.stroke(); }
    const Y = (v) => h - v * ppm;   // v in metres from the front edge
    // painted border, a red band at the front and a blue band at the back
    g.strokeStyle = '#2d5fb4'; g.lineWidth = 0.014 * ppm; g.strokeRect(0.02 * ppm, 0.02 * ppm, w - 0.04 * ppm, h - 0.04 * ppm);
    g.fillStyle = '#c23a2f'; g.fillRect(0.035 * ppm, Y(0.115), w - 0.07 * ppm, 0.08 * ppm);
    g.fillStyle = '#2d5fb4'; g.fillRect(0.035 * ppm, Y(BOARD_L - 0.035), w - 0.07 * ppm, 0.075 * ppm);
    g.fillStyle = 'rgba(255,246,222,0.9)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(w * (0.16 + i * 0.136), Y(0.075), 0.011 * ppm, 0, TAU); g.fill(); }
    // the hole ring and a thin guide ring
    const hx = w / 2, hy = Y(HOLE_V);
    g.strokeStyle = '#2d5fb4'; g.lineWidth = 0.022 * ppm; g.beginPath(); g.arc(hx, hy, (HOLE_R + 0.03) * ppm, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(194,58,47,0.9)'; g.lineWidth = 0.008 * ppm; g.beginPath(); g.arc(hx, hy, (HOLE_R + 0.062) * ppm, 0, TAU); g.stroke();
    // a golden corn cob with husk leaves
    g.save(); g.translate(w / 2, Y(0.52)); g.rotate(-0.12);
    const cl = 0.2 * ppm, cw = 0.062 * ppm;
    g.fillStyle = '#5c9a3a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, cl * 0.1); g.bezierCurveTo(s * cw * 1.9, cl * 0.05, s * cw * 1.6, -cl * 0.6, s * cw * 0.2, -cl * 0.62); g.bezierCurveTo(s * cw * 0.9, -cl * 0.35, s * cw * 0.5, -cl * 0.1, 0, cl * 0.1); g.fill(); }
    g.fillStyle = '#f1c232'; g.beginPath(); g.ellipse(0, -cl * 0.18, cw * 0.78, cl * 0.5, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(160,100,10,0.65)'; g.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * cw * 0.2, -cl * 0.66); g.lineTo(i * cw * 0.2, cl * 0.28); g.stroke(); }
    for (let j = 0; j < 12; j++) { g.beginPath(); g.moveTo(-cw * 0.75, -cl * 0.64 + j * cl * 0.08); g.lineTo(cw * 0.75, -cl * 0.64 + j * cl * 0.08); g.stroke(); }
    g.restore();
    // a worn, lived-in edge
    const eg = g.createLinearGradient(0, 0, w, 0); eg.addColorStop(0, 'rgba(90,50,20,0.28)'); eg.addColorStop(0.06, 'rgba(90,50,20,0)'); eg.addColorStop(0.94, 'rgba(90,50,20,0)'); eg.addColorStop(1, 'rgba(90,50,20,0.28)');
    g.fillStyle = eg; g.fillRect(0, 0, w, h);
  });
  return tex(c, { aniso: 8 });
}
const BAG_RGB = [[208, 56, 46], [48, 108, 214]];
function bagMaps(side) {
  const col = BAG_RGB[side];
  const css = (k, a = 1) => `rgba(${Math.min(255, Math.round(col[0] * k))},${Math.min(255, Math.round(col[1] * k))},${Math.min(255, Math.round(col[2] * k))},${a})`;
  const weave = (g, w, h) => { g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; for (let i = -h; i < w; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); } g.strokeStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < w + h; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - h, h); g.stroke(); } };
  const top = cvs(256, 256, (g, w, h) => {
    g.fillStyle = css(1); g.fillRect(0, 0, w, h); weave(g, w, h);
    const r = g.createRadialGradient(w * 0.46, h * 0.44, 10, w / 2, h / 2, w * 0.72); r.addColorStop(0, 'rgba(255,255,255,0.22)'); r.addColorStop(0.55, 'rgba(255,255,255,0)'); r.addColorStop(1, 'rgba(0,0,0,0.30)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
    g.save(); g.setLineDash([9, 7]); g.strokeStyle = 'rgba(255,244,214,0.85)'; g.lineWidth = 2.4;
    const m = 24, rr = 22; g.beginPath(); g.roundRect ? g.roundRect(m, m, w - 2 * m, h - 2 * m, rr) : g.rect(m, m, w - 2 * m, h - 2 * m); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 3; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2 + s * 46, h * 0.22); g.quadraticCurveTo(w / 2 + s * 30, h / 2, w / 2 + s * 46, h * 0.78); g.stroke(); }
    g.fillStyle = g.strokeStyle = 'rgba(255,248,230,0.95)'; g.lineWidth = 9;
    if (side === 0) { g.beginPath(); g.moveTo(w / 2, h / 2 - 38); g.lineTo(w / 2 + 38, h / 2); g.lineTo(w / 2, h / 2 + 38); g.lineTo(w / 2 - 38, h / 2); g.closePath(); g.fill(); }
    else { g.beginPath(); g.arc(w / 2, h / 2, 34, 0, TAU); g.stroke(); }
  });
  const side_ = cvs(64, 64, (g, w, h) => { g.fillStyle = css(0.82); g.fillRect(0, 0, w, h); weave(g, w, h); });
  return { top: tex(top), side: tex(side_, { repeat: [4, 1] }) };
}

// ---- the bag: a rounded pillow, domed top, fabric weave --------------------------------------------------------------------------------
export function bagGeometry() {
  const T = 0.034, hx = BAG_HALF, g = new THREE.BoxGeometry(2 * hx, T, 2 * hx, 14, 2, 14), p = g.attributes.position, rr = 0.022, ci = hx - rr;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const cx = Math.max(-ci, Math.min(ci, x)), cz = Math.max(-ci, Math.min(ci, z)), dx = x - cx, dz = z - cz, l = Math.hypot(dx, dz);
    if (l > 1e-6) { x = cx + (dx / l) * Math.min(l, rr); z = cz + (dz / l) * Math.min(l, rr); }
    const r2 = Math.min(1, (x * x + z * z) / (2 * hx * hx)), k = Math.pow(1 - r2, 1.2);
    if (y > 0.0001) y += 0.016 * k; else if (y < -0.0001) y -= 0.006 * k; else { const puff = 1 + 0.05 * (1 - Math.min(1, Math.abs(Math.max(Math.abs(x), Math.abs(z)) - hx) / 0.01)); x *= puff; z *= puff; }
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// ---- the yard --------------------------------------------------------------------------------------------------------------------------
export async function buildYard(tierName = 'high', nap = async () => {}) {
  const hi = tierName === 'high', mid = tierName !== 'low';
  const root = new THREE.Group();
  const glows = [], sway = [];
  const r = rng(21);
  const W3 = (x, y, z) => new THREE.Vector3(x, y, -z);
  const add = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; root.add(m); return m; };

  // sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMaterial()); sky.renderOrder = -10; sky.position.y = -8; root.add(sky);
  // soft clouds: a few flat glow sprites high in the sky
  const cloudTex = glowTexture('rgba(255,248,232,0.9)', 'rgba(255,236,206,0.4)');
  for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.55 })); sp.position.set(-120 + i * 30 + r() * 12, 40 + r() * 26, -150 - r() * 30); sp.scale.set(70 + r() * 40, 9 + r() * 6, 1); root.add(sp); }
  await nap();

  // lawn
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: lawnMap(), roughness: 1, metalness: 0, color: 0xe6f0d6 }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -150); lawn.receiveShadow = true; root.add(lawn);
  if (mid) {   // blades near the lane
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute([-0.005, 0, 0, 0.005, 0, 0, 0.001, 0.05, 0.006], 3)); bg.computeVertexNormals();
    const N = hi ? 14000 : 7000, bl = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, color: 0xffffff }), N);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 11, z = 3 + r() * 11.8; e.set((r() - 0.5) * 0.5, r() * TAU, (r() - 0.5) * 0.5);
      const s = 0.8 + r() * 1.4; m4.compose(W3(x, 0, z), q.setFromEuler(e), new THREE.Vector3(s, s, s)); bl.setMatrixAt(i, m4);
      c.setHSL(0.25 + r() * 0.06, 0.5, 0.26 + r() * 0.2); bl.setColorAt(i, c);
    }
    root.add(bl);
  }
  await nap();

  // fence: planks, rails, posts with caps
  const fw = 220;
  const fence = new THREE.Mesh(new THREE.PlaneGeometry(fw, FENCE_H), new THREE.MeshStandardMaterial({ map: (() => { const t = fenceMap(); t.repeat.set(fw / 1.1, 1); return t; })(), roughness: 0.85 }));
  fence.position.copy(W3(0, FENCE_H / 2, FENCE_Z)); fence.receiveShadow = true; fence.castShadow = false; root.add(fence);
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 0.8 }), woodD = new THREE.MeshStandardMaterial({ color: 0x4d311a, roughness: 0.85 });
  const NP = Math.round(fw / 1.9);
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.15, FENCE_H + 0.14, 0.15), wood, NP), caps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.06, 0.2), woodD, NP);
  const m4 = new THREE.Matrix4(); const postX = [];
  for (let i = 0; i < NP; i++) { const x = (i - NP / 2) * 1.9; postX.push(x); m4.makeTranslation(x, (FENCE_H + 0.14) / 2, -(FENCE_Z - 0.1)); posts.setMatrixAt(i, m4); m4.makeTranslation(x, FENCE_H + 0.17, -(FENCE_Z - 0.1)); caps.setMatrixAt(i, m4); }
  posts.castShadow = true; posts.receiveShadow = true; caps.castShadow = true; root.add(posts, caps);
  for (const yy of [0.4, 1.35]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.1, 0.05), woodD); rail.position.copy(W3(0, yy, FENCE_Z - 0.06)); rail.castShadow = true; rail.receiveShadow = true; root.add(rail); }
  await nap();

  // string lights: a wire sagging between posts, bulbs and glows
  {
    const bulbG = new THREE.SphereGeometry(0.035, 8, 6), bulbs = [], wirePts = [], gp = [];
    const xs = postX.filter((x) => Math.abs(x) < 26);
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = xs[i], b = xs[i + 1], y0 = FENCE_H + 0.06, sag = 0.3;
      let prev = null;
      for (let k = 0; k <= 12; k++) {
        const u = k / 12, x = a + (b - a) * u, y = y0 - sag * 4 * u * (1 - u), p = W3(x, y, FENCE_Z - 0.32);
        if (prev) wirePts.push(prev.x, prev.y, prev.z, p.x, p.y, p.z); prev = p;
        if (k > 0 && k < 12 && k % 2 === 1) { bulbs.push(p.clone().setY(p.y - 0.04)); gp.push(p.x, p.y - 0.04, p.z); }
      }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
    root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x1c1208 })));
    const bm = new THREE.InstancedMesh(bulbG, new THREE.MeshBasicMaterial({ color: 0xfff0c0, fog: false }), bulbs.length);
    bulbs.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bm.setMatrixAt(i, m4); }); root.add(bm);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    const pm = new THREE.PointsMaterial({ size: 0.55, map: glowTexture('rgba(255,236,170,1)', 'rgba(255,204,120,0.45)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85, sizeAttenuation: true, fog: false });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; root.add(pts);
    glows.push({ pose(t) { pm.opacity = 0.78 + 0.1 * Math.sin(t * 1.7); } });
  }
  await nap();

  // flower bed along the fence
  {
    const soil = new THREE.Mesh(new THREE.PlaneGeometry(fw, 0.9), new THREE.MeshStandardMaterial({ color: 0x4a3622, roughness: 1 })); soil.rotation.x = -Math.PI / 2; soil.position.copy(W3(0, 0.012, FENCE_Z - 0.55)); soil.receiveShadow = true; root.add(soil);
    const N = hi ? 700 : 350, leaf = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3f8a3a, roughness: 0.9 }), N);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), N);
    const pal = [0xe25c70, 0xfad65a, 0xf4f0ea, 0x9a6edc, 0xff8a4a], c = new THREE.Color(), sc = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i < N; i++) {
      const x = (r() - 0.5) * 60, z = FENCE_Z - 0.3 - r() * 0.7, s = 0.7 + r() * 0.9;
      m4.compose(W3(x, 0.07 * s, z), q, sc.set(s * 1.3, s * 0.7, s * 1.3)); leaf.setMatrixAt(i, m4);
      m4.compose(W3(x + (r() - 0.5) * 0.06, 0.15 * s + 0.05, z - 0.05), q, sc.set(s, s, s)); head.setMatrixAt(i, m4); c.setHex(pal[(r() * pal.length) | 0]); head.setColorAt(i, c);
    }
    leaf.castShadow = false; leaf.receiveShadow = true; head.receiveShadow = true; root.add(leaf, head);
  }
  await nap();

  // trees behind the fence
  {
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 });
    const leafG = new THREE.SphereGeometry(1, 12, 9);
    for (let i = 0; i < (hi ? 26 : 16); i++) {
      const x = -52 + i * (104 / (hi ? 25 : 15)) + (r() - 0.5) * 4, z = FENCE_Z + 9 + r() * 14, h = 4.5 + r() * 3;
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h * 0.6, 8), trunkM); t.position.copy(W3(x, h * 0.3, z)); root.add(t);
      const grp = new THREE.Group(); grp.position.copy(W3(x, h * 0.78, z));
      for (let k = 0; k < 4; k++) {
        const col = new THREE.Color().setHSL(0.27 + r() * 0.05, 0.45, 0.2 + r() * 0.12), m = new THREE.Mesh(leafG, new THREE.MeshStandardMaterial({ color: col, roughness: 0.95, flatShading: false }));
        const s = h * (0.26 + r() * 0.12); m.scale.set(s * 1.1, s, s * 1.1); m.position.set((r() - 0.5) * s * 1.3, (r() - 0.3) * s * 0.9, (r() - 0.5) * s); m.castShadow = false; grp.add(m);
      }
      root.add(grp); sway.push({ obj: grp, ph: r() * TAU, amp: 0.012 });
    }
    // a far tree line
    const far = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0x4d7a48, roughness: 1, fog: true }), 36), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    for (let i = 0; i < 36; i++) { const s = 8 + r() * 6; m4.compose(W3(-120 + i * 6.8 + r() * 3, s * 0.45, 70 + r() * 14), q, sc.set(s * 1.1, s, s * 1.1)); far.setMatrixAt(i, m4); }
    root.add(far);
  }
  await nap();

  // props: a cooler with a white lid and a folding stool, both out of the way of every throw
  {
    const blue = new THREE.MeshStandardMaterial({ color: 0x2f78bd, roughness: 0.45 }), white = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 0.4 }), dark = new THREE.MeshStandardMaterial({ color: 0x3c342e, roughness: 0.6 });
    const body = add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.34), blue)); body.position.copy(W3(-1.1, 0.15, 9.4));
    const lid = add(new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.05, 0.38), white)); lid.position.copy(W3(-1.1, 0.325, 9.4));
    const handle = add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), dark)); handle.position.copy(W3(-1.1, 0.35, 9.4)); handle.rotation.z = 0;
    const seat = add(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.3), new THREE.MeshStandardMaterial({ color: 0x96704a, roughness: 0.8 }))); seat.position.copy(W3(1.12, 0.36, 9.3));
    for (const dx of [-0.15, 0.15]) for (const dz of [-0.11, 0.11]) { const l = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.34, 0.035), dark)); l.position.copy(W3(1.12 + dx, 0.17, 9.3 + dz)); }
    const jug = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.17, 12), new THREE.MeshStandardMaterial({ color: 0xf6d36a, roughness: 0.2, transparent: true, opacity: 0.92 }))); jug.position.copy(W3(1.12, 0.465, 9.3));
  }
  await nap();

  // ---- the board ------------------------------------------------------------------------------------------------------------------
  const board = new THREE.Group();
  {
    const hw = BOARD_W / 2, TH = 0.04;
    const shape = new THREE.Shape(); shape.moveTo(-hw, 0); shape.lineTo(hw, 0); shape.lineTo(hw, BOARD_L); shape.lineTo(-hw, BOARD_L); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, HOLE_V, HOLE_R, 0, TAU, true); shape.holes.push(hole);
    const eg = new THREE.ExtrudeGeometry(shape, { depth: TH, bevelEnabled: false, curveSegments: 40 });
    eg.translate(0, 0, -TH);
    const p = eg.attributes.position, uv = eg.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + hw) / BOARD_W, p.getY(i) / BOARD_L);
    const topMat = new THREE.MeshPhysicalMaterial({ map: boardMap(), roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.3, envMapIntensity: 0.9 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb58a52, roughness: 0.7 });
    const top = new THREE.Mesh(eg, [topMat, edgeMat]); top.castShadow = true; top.receiveShadow = true; board.add(top);
    // frame rails under the top (the 2 x 4 sides and the cross pieces)
    const railM = new THREE.MeshStandardMaterial({ color: 0xa87a44, roughness: 0.75 });
    const rail = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railM); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; board.add(m); };
    for (const s of [-1, 1]) rail(0.04, BOARD_L, 0.07, s * (hw - 0.02), BOARD_L / 2, -TH - 0.035);
    rail(BOARD_W - 0.08, 0.04, 0.07, 0, 0.02, -TH - 0.035); rail(BOARD_W - 0.08, 0.04, 0.07, 0, BOARD_L - 0.02, -TH - 0.035);
    // the hole: a dark wooden bin below
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(HOLE_R, HOLE_R, 0.2, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.9, side: THREE.DoubleSide }));
    wall.rotation.x = Math.PI / 2; wall.position.set(0, HOLE_V, -0.1); board.add(wall);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R, 24), new THREE.MeshBasicMaterial({ color: 0x080503 })); floor.position.set(0, HOLE_V, -0.2); board.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(HOLE_R + 0.002, 0.006, 6, 36), new THREE.MeshStandardMaterial({ color: 0x2b4f94, roughness: 0.5 })); rim.position.set(0, HOLE_V, 0.001); board.add(rim);
    // board space -> world: local x across, y along the slope (v), z the normal
    const bx = new THREE.Vector3(1, 0, 0), by = new THREE.Vector3(0, SIN_A, -COS_A), bz = new THREE.Vector3(0, COS_A, SIN_A);
    board.matrixAutoUpdate = false; board.matrix.makeBasis(bx, by, bz).setPosition(0, H_FRONT, -BOARD_Z0); board.matrixWorldNeedsUpdate = true;
    root.add(board);
    // legs: short at the front, tall at the back (vertical, under the rails)
    const legM = railM;
    for (const [v, ] of [[0.12], [BOARD_L - 0.1]]) {
      const topH = surfaceH(BOARD_Z0 + v * COS_A) - TH - 0.02;
      for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.045, topH, 0.045), legM); l.position.copy(W3(s * (hw - 0.04), topH / 2, BOARD_Z0 + v * COS_A)); l.castShadow = true; l.receiveShadow = true; root.add(l); }
    }
  }
  await nap();

  return { root, glows, sway, board };
}

// the two bag materials (top + sides), the shared geometry
export function makeBagKit() {
  const geo = bagGeometry(), mats = [];
  for (const side of [0, 1]) {
    const mp = bagMaps(side);
    const top = new THREE.MeshStandardMaterial({ map: mp.top, roughness: 0.9, metalness: 0, bumpMap: mp.top, bumpScale: 0.35 });
    const sd = new THREE.MeshStandardMaterial({ map: mp.side, roughness: 0.92, metalness: 0 });
    mats.push([sd, sd, top, top, sd, sd]);
  }
  return { geo, mats };
}
