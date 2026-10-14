// Offline app-icon render (developer tool, not part of the game): node + headless Chrome load web/icon.html?size=2048. It draws the SAME performer, kimono
// and cloth bags the game uses into a small lit tatami room, renders room and subject separately (the room is blurred for depth of field) and composites
// glow, vignette and lantern bokeh. The finished canvas is exposed as window.__icon.
import * as V3 from '../vendor3d/index.js';
import { createPerformer, HAND_Y, HAND_Z } from './performer.js';
import { drawSwatch } from '../src/art.js';

const { THREE, solvePalmBall } = V3;
const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048);
const out = document.createElement('canvas'); out.width = out.height = SIZE; document.body.appendChild(out);
out.style.width = '1024px'; out.style.height = '1024px';
const ctx = out.getContext('2d');
const gl = document.createElement('canvas'); gl.width = gl.height = SIZE;
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const snap = () => { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(gl, 0, 0); return c; };

const scene = new THREE.Scene();
const pm = new THREE.PMREMGenerator(renderer);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.05).texture; scene.environmentIntensity = 0.35; pm.dispose();

// ---- the room (rendered separately, then blurred) ------------------------------------------------------------------------------------
const room = new THREE.Group(); scene.add(room);
const mat = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
const tex = (w, h, draw, rep = [1, 1]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; return t; };
// tatami floor
const floorTex = tex(512, 512, (g, w, h) => {
  g.fillStyle = '#a79c5a'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(${40 + (y * 7) % 30},${50 + (y * 3) % 20},20,0.10)`; g.fillRect(0, y, w, 1); }
  g.strokeStyle = '#1f2a18'; g.lineWidth = 6; g.strokeRect(0, 0, w, h); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
}, [3, 3]);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat({ map: floorTex, roughness: 0.75 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; room.add(floor);
// back wall: indigo lower half with a faint wave print, shoji screens above
const waveTex = tex(512, 256, (g, w, h) => {
  g.fillStyle = '#16265a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(160,190,255,0.16)'; g.lineWidth = 3;
  for (let r = 0; r < 6; r++) for (let x = r % 2 ? 0 : 32; x < w + 64; x += 64) for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, r * 24 + 20, 30 * k / 3, Math.PI, 0); g.stroke(); }
}, [3, 1]);
const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.1), mat({ map: waveTex })); wall.position.set(0, 0.55, -2.2); room.add(wall);
const paperTex = tex(256, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffe7ba'); gr.addColorStop(1, '#ffd08a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(70,90,50,0.35)'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(150, h); g.lineTo(158, 0); g.stroke();
  for (let k = 0; k < 4; k++) { g.lineWidth = 6; g.beginPath(); g.moveTo(154, 40 + k * 55); g.quadraticCurveTo(154 + (k % 2 ? 40 : -40), 28 + k * 55, 154 + (k % 2 ? 62 : -62), 54 + k * 55); g.stroke(); }
});
const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, emissive: 0xffc070, emissiveMap: paperTex, emissiveIntensity: 0.7, roughness: 1 });
const frameMat = mat({ color: 0x1a0f08 });
for (let i = -3; i <= 3; i++) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), paperMat); p.position.set(i * 1.3, 1.85, -2.19); room.add(p);
  for (let k = 0; k <= 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.5, 0.04), frameMat); b.position.set(i * 1.3 - 0.6 + k * 0.3, 1.85, -2.17); room.add(b); }
  for (let k = 0; k <= 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.03, 0.04), frameMat); b.position.set(i * 1.3, 1.1 + k * 0.25, -2.17); room.add(b); }
}
const rail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.1, 0.08), mat({ color: 0x5a3a1e })); rail.position.set(0, 1.1, -2.16); room.add(rail);
const beam = new THREE.Mesh(new THREE.BoxGeometry(14, 0.16, 0.2), mat({ color: 0x3a2412 })); beam.position.set(0, 2.62, -2.1); room.add(beam);
// lanterns
const lanternMat = new THREE.MeshStandardMaterial({ color: 0xffb860, emissive: 0xff8a2c, emissiveIntensity: 2.2, roughness: 0.6 });
for (const [x, y, z, s] of [[-0.78, 1.52, -1.3, 0.12], [0.86, 1.42, -1.5, 0.11], [0.05, 1.7, -1.9, 0.09], [-1.4, 1.6, -1.8, 0.1]]) {
  const l = new THREE.Mesh(new THREE.SphereGeometry(s, 24, 16), lanternMat); l.scale.set(1, 1.25, 1); l.position.set(x, y, z); room.add(l);
  const pl = new THREE.PointLight(0xffa850, 0.9, 5, 1.6); pl.position.set(x, y, z + 0.2); room.add(pl);
}
// an alcove scroll for depth: dark indigo mounting with pale paper
const scrollM = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.1), mat({ color: 0x243a72, emissive: 0x0a1030, emissiveIntensity: 0.4 })); scrollM.position.set(1.7, 1.6, -2.15); room.add(scrollM);
const scrollP = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.8), mat({ color: 0xefe2c0, emissive: 0x6a5a3a, emissiveIntensity: 0.5 })); scrollP.position.set(1.7, 1.6, -2.14); room.add(scrollP);

// ---- the subject: the performer, her kimono and three cloth bags ----------------------------------------------------------------------
const subject = new THREE.Group(); scene.add(subject);
const stub = { add: (h) => subject.add(h.root), track() {} };
const human = await createPerformer(V3, stub);
const FAB = [{ i: 0 }, { i: 1 }, { i: 2 }];
const bagTex = (fi) => tex(256, 256, (g, w) => { drawSwatch(g, w / 2, w / 2, w * 0.98, fi, false); });
const bagMesh = (fi) => {
  const g = new THREE.SphereGeometry(1, 56, 36), p = g.attributes.position, uv = g.attributes.uv, v = new THREE.Vector3();
  const sq = (c) => Math.sign(c) * Math.pow(Math.abs(c), 0.42);        // pillow: a superellipsoid, flat faces, rounded corners
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const x = sq(v.x) * 0.058, y = sq(v.y) * 0.054, z = sq(v.z) * 0.034;
    p.setXYZ(i, x, y, z); uv.setXY(i, 0.5 + x / 0.124, 0.5 + y / 0.124);   // the cloth pattern is printed on the broad face (planar projection)
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ map: bagTex(fi), roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color(0xffffff), sheenRoughness: 0.5 }));
  m.castShadow = true; return m;
};
const T = new THREE.Vector3(), N = new THREE.Vector3(), F = new THREE.Vector3();
const sideDefs = [['R', -1, -0.19, 0.0], ['L', 1, 0.19, 0.0]];
const bagIdx = [0, 1];
sideDefs.forEach(([side, sg, x, lift], k) => {
  T.set(x, HAND_Y + lift, HAND_Z + 0.02);
  N.set(-sg * 0.12, 0.99, 0.05).normalize(); F.set(-sg * 0.3, 0.02, 0.95).normalize();
  const s = solvePalmBall(human, side, T, N, F, 0.05);
  human.setReach(side, s.wrist, { weight: 1, pole: { x: T.x + sg * 0.09, y: T.y - 0.08, z: T.z - 0.3 }, quat: s.quat });
  const b = bagMesh(bagIdx[k] + 1); b.position.copy(T); b.rotation.set(-0.35, sg * 0.35, sg * 0.1); subject.add(b);
});
// the third bag, high in its arc, tilted; the performer's eyes follow it
const air = bagMesh(0); air.position.set(0.1, 1.06, 0.3); air.rotation.set(-0.2, 0.45, -0.5); subject.add(air);
human.lookAt({ x: 0.1, y: 1.06, z: 0.3 }, { weight: 1, maxYaw: 0.7, maxPitch: 0.6 });
human.setFingers('R', { curl: V3.FINGER_POSES.ballGrip.curl, spread: V3.FINGER_POSES.ballGrip.spread }, { rate: 1000 });
human.setFingers('L', { curl: V3.FINGER_POSES.ballGrip.curl, spread: V3.FINGER_POSES.ballGrip.spread }, { rate: 1000 });
for (let i = 0; i < 40; i++) { human.update(1 / 30); human.kimono && human.kimono.step(1 / 30); }
subject.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
// light the subject: warm key (lantern), cool rim from the screens behind, soft fill
const key = new THREE.DirectionalLight(0xffd9a8, 2.6); key.position.set(1.6, 2.6, 2.6); key.castShadow = true; key.target.position.set(0, 0.7, 0.2);
Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 1.5, bottom: -1.5, near: 0.5, far: 9 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x9fc0ff, 2.6); rim.position.set(-2.2, 2.2, -1.8);
const rim2 = new THREE.DirectionalLight(0xffb070, 1.1); rim2.position.set(2.6, 1.4, -1.4);
const fill = new THREE.HemisphereLight(0xcfd8ff, 0x6a4a30, 0.7);
scene.add(key, key.target, rim, rim2, fill);

const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.2, 40);
const target = new THREE.Vector3(Number(q.get('lx') || 0.02), Number(q.get('ly') || 0.80), 0.2);
cam.position.set(Number(q.get('cx') || 0.1), Number(q.get('cy') || 1.0), Number(q.get('cz') || 2.15)); cam.lookAt(target);

// 1) room only
subject.visible = false; room.visible = true;
renderer.setClearColor(0x04060f, 1); renderer.clear(); renderer.render(scene, cam);
const back = snap();
// 2) subject (on a transparent clear), with the room present for light but invisible: render subject only
subject.visible = true; room.visible = false;
renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
const sub = snap();

ctx.fillStyle = '#04070f'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.010}px)`; ctx.drawImage(back, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
const g = ctx.createRadialGradient(SIZE * 0.5, SIZE * 0.45, SIZE * 0.05, SIZE * 0.5, SIZE * 0.45, SIZE * 0.55);
g.addColorStop(0, 'rgba(255,200,130,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, SIZE, SIZE);
// lantern bokeh behind her
ctx.save(); ctx.globalCompositeOperation = 'lighter';
for (const [x, y, r, a] of [[0.1, 0.1, 0.07, 0.22], [0.9, 0.17, 0.06, 0.2], [0.27, 0.27, 0.035, 0.16], [0.78, 0.33, 0.04, 0.15], [0.5, 0.05, 0.05, 0.14], [0.06, 0.4, 0.03, 0.12], [0.95, 0.5, 0.03, 0.12]]) {
  const gg = ctx.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, r * SIZE); gg.addColorStop(0, `rgba(255,214,140,${a})`); gg.addColorStop(0.8, `rgba(255,170,80,${a * 0.7})`); gg.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x * SIZE, y * SIZE, r * SIZE, 0, Math.PI * 2); ctx.fill();
}
ctx.restore();
ctx.drawImage(sub, 0, 0);
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.globalAlpha = 0.22; ctx.drawImage(sub, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.36, SIZE / 2, SIZE / 2, SIZE * 0.78);
v.addColorStop(0, 'rgba(2,4,14,0)'); v.addColorStop(1, 'rgba(2,4,14,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
window.__icon = () => out.toDataURL('image/png');
document.title = 'ready';
