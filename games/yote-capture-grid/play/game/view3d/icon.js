// Offline app-icon render for Yote (developer tool, not shipped in play): the same models as the game, composed as one subject:
// an indigo river pebble caught mid-jump over an ivory pebble sitting in its pit, a gold arc behind it, a low golden-hour sun.
// The 3D layer (board, pebbles, shadows) renders with a transparent background and is composited over a painted, blurred
// village-sunset backdrop (shallow depth of field), then bloom, vignette and sparkles. Tunables via the query: size, pitch, dist, fov, lx, ly, yaw, jx, jy, jz, sunx, suny.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { buildBoard, makePebble, tex, radialCanvas, BED_Y, PIT_BOTTOM } from './models.js';

const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const size = num('size', 2048);
const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(size, size, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = num('exp', 0.8);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
B.lightingRig(scene, 'duskOutdoor', {
  renderer, shadow: 4096, extent: 5, background: false, fog: false, target: [0, 0.3, 0],
  overrides: { hemiSky: 0xffc890, hemiGround: 0x5a3a24, hemi: 0.5, key: 0xffa24a, keyI: num('key', 2.0), keyPos: [-5.5, 3.0, 5.0], fill: 0x7a8ee0, fillI: 0.45, fillPos: [6, 3, 6], rim: 0xffe4b8, rimI: 3.4, rimPos: [3, 4.5, -6], exposure: num('exp', 0.8), env: 0.22 },
});
renderer.toneMappingExposure = num('exp', 0.8);
B.createEnvironment(renderer, scene, { intensity: 0.25 });

// sand ground that fades away at the edges (the painted backdrop shows through)
const gc = document.createElement('canvas'); gc.width = gc.height = 256;
{ const x = gc.getContext('2d'); const g = x.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(168,108,58,1)'); g.addColorStop(0.55, 'rgba(150,92,48,0.9)'); g.addColorStop(1, 'rgba(120,70,40,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256); }
const ground = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.MeshStandardMaterial({ map: tex(gc), transparent: true, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true; ground.visible = false;
const board = buildBoard(q.get('kind') || 'laterite', 3, 2); scene.add(board);

// the ivory pebble in its pit, the indigo one caught in the air above-left, a second ivory behind it (the bonus pebble)
const pit = (c, r) => ({ x: c - 1, z: r - 0.5 });
const ivory = makePebble('river', 2, 1); const pv = pit(1, 1); ivory.position.set(pv.x, PIT_BOTTOM, pv.z); ivory.scale.setScalar(1.35); ivory.rotation.y = 0.6; scene.add(ivory);
const second = makePebble('river', 2, 0); const p2 = pit(2, 0); second.position.set(p2.x, PIT_BOTTOM, p2.z); second.rotation.y = 2; second.scale.setScalar(1.0); scene.add(second);
const jumper = makePebble('river', 1, 1); jumper.position.set(num('jx', -0.3), PIT_BOTTOM + num('jy', 1.6), num('jz', 0.5)); jumper.scale.setScalar(1.7); jumper.rotation.set(-0.3, 0.8, 0.2); scene.add(jumper);
// gold arc: a glowing ribbon along the jump path
const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.95, 0.45, 0.9), new THREE.Vector3(-1.5, 1.25, 0.85), new THREE.Vector3(-0.7, 1.65, 0.65), new THREE.Vector3(0.05, 1.4, 0.55), new THREE.Vector3(0.75, 0.8, 0.4)]);
scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.042, 10, false), new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.14, 10, false), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: tex(radialCanvas('255,200,110', 1, 128, 0.35)), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
glow.rotation.x = -Math.PI / 2; glow.position.set(pv.x, BED_Y + 0.03, pv.z); scene.add(glow);
// sand chips thrown off the pit
const chipG = new THREE.SphereGeometry(0.035, 6, 5), chipM = new THREE.MeshBasicMaterial({ color: 0xf2d9a4 });
for (let i = 0; i < 10; i++) { const a = i * 0.8, r = 0.4 + (i % 5) * 0.12; const c = new THREE.Mesh(chipG, chipM); c.position.set(pv.x + Math.cos(a) * r, BED_Y + 0.12 + (i % 4) * 0.16, pv.z + Math.sin(a) * r * 0.7); c.scale.setScalar(0.45 + (i % 3) * 0.3); scene.add(c); }

const camera = new THREE.PerspectiveCamera(num('fov', 32), 1, 0.5, 100);
const pitch = (num('pitch', 22) * Math.PI) / 180, dist = num('dist', 6.3), look = new THREE.Vector3(num('lx', 0.1), num('ly', 0.85), 0.2), yaw = (num('yaw', -6) * Math.PI) / 180;
camera.position.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
camera.lookAt(look); camera.updateMatrixWorld();

const mk = (w) => { const c = document.createElement('canvas'); c.width = c.height = w; return c; };
function paintBackdrop(S) {
  const c = mk(S), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#0c0830'); g.addColorStop(0.3, '#2a1458'); g.addColorStop(0.46, '#8a2a50'); g.addColorStop(0.62, '#e0622e'); g.addColorStop(0.78, '#b8683a'); g.addColorStop(1, '#6a3a22');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const sx = S * num('sunx', 0.72), sy = S * num('suny', 0.46), sr = S * 0.13;
  const halo = x.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 5); halo.addColorStop(0, 'rgba(255,244,200,1)'); halo.addColorStop(0.22, 'rgba(255,205,115,0.7)'); halo.addColorStop(1, 'rgba(255,140,60,0)');
  x.fillStyle = halo; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff6d2'; x.beginPath(); x.arc(sx, sy, sr, 0, 6.3); x.fill();
  // silhouettes along a horizon at y = 0.6 S
  const hy = S * num('hy', 0.4); x.fillStyle = '#3a1638';
  const hut = (cx, w, h, rh) => { x.fillRect(cx - w / 2, hy - h, w, h); x.beginPath(); x.moveTo(cx - w * 0.66, hy - h + 4); x.lineTo(cx, hy - h - rh); x.lineTo(cx + w * 0.66, hy - h + 4); x.closePath(); x.fill(); };
  hut(S * 0.08, S * 0.1, S * 0.05, S * 0.055); hut(S * 0.24, S * 0.08, S * 0.04, S * 0.045); hut(S * 0.63, S * 0.12, S * 0.06, S * 0.07); hut(S * 0.82, S * 0.09, S * 0.045, S * 0.05);
  x.fillRect(0, hy - S * 0.014, S, S * 0.03);
  { const gg = x.createLinearGradient(0, hy, 0, S); gg.addColorStop(0, '#e89a50'); gg.addColorStop(0.35, '#c07a3e'); gg.addColorStop(1, '#6a3a22'); x.fillStyle = gg; x.fillRect(0, hy + S * 0.008, S, S);
    x.strokeStyle = 'rgba(255,230,180,0.18)'; x.lineWidth = S * 0.0025; for (let k = 0; k < 24; k++) { const y = hy + S * 0.03 + k * S * 0.022 * (1 + k * 0.08); x.beginPath(); for (let X = 0; X <= S; X += S / 40) { const yy = y + Math.sin(X * 0.02 + k) * S * 0.003; X ? x.lineTo(X, yy) : x.moveTo(X, yy); } x.stroke(); }
    const sh = x.createRadialGradient(S * 0.5, S * 0.86, S * 0.05, S * 0.5, S * 0.86, S * 0.5); sh.addColorStop(0, 'rgba(20,6,10,0.65)'); sh.addColorStop(1, 'rgba(20,6,10,0)'); x.fillStyle = sh; x.fillRect(0, S * 0.5, S, S); }
  x.fillStyle = '#3a1638';
  x.beginPath(); x.moveTo(S * 0.93, hy); x.lineTo(S * 0.94, hy - S * 0.17); x.lineTo(S * 0.965, hy - S * 0.17); x.lineTo(S * 0.975, hy); x.fill();
  for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(S * (0.9 + 0.1 * ((k * 37) % 10) / 10), hy - S * (0.19 + 0.02 * (k % 3)), S * 0.06, S * 0.025, 0, 0, 6.3); x.fill(); }
  const o = mk(S), ox = o.getContext('2d'); ox.filter = `blur(${S * num('dof', 0.015)}px)`; ox.drawImage(c, 0, 0); ox.filter = 'none';
  return o;
}
const star = (x, cx, cy, r, a = 1) => { x.save(); x.translate(cx, cy); x.globalAlpha = a; x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(0, 0, 0, 0, 0, r * 0.45); g.addColorStop(0, 'rgba(255,248,220,1)'); g.addColorStop(1, 'rgba(255,220,140,0)'); x.fillStyle = g; x.fillRect(-r, -r, r * 2, r * 2); x.fillStyle = 'rgba(255,250,235,0.95)'; x.beginPath(); for (let i = 0; i < 8; i++) { const an = (i / 8) * 6.2832 - 1.5708, rr = i % 2 ? r * 0.07 : r; x.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } x.closePath(); x.fill(); x.restore(); };

requestAnimationFrame(() => requestAnimationFrame(() => {
  renderer.clear(); renderer.render(scene, camera);
  const out = mk(size), x = out.getContext('2d');
  x.drawImage(paintBackdrop(size), 0, 0);
  x.drawImage(renderer.domElement, 0, 0);
  x.save(); x.globalCompositeOperation = 'lighter'; x.filter = `blur(${size * 0.012}px)`; x.globalAlpha = num('bloom', 0.05); x.drawImage(renderer.domElement, 0, 0); x.restore();
  star(x, size * 0.3, size * 0.27, size * 0.05, 0.85);
  const vg = x.createRadialGradient(size / 2, size / 2, size * 0.4, size / 2, size / 2, size * 0.78); vg.addColorStop(0, 'rgba(20,6,20,0)'); vg.addColorStop(1, 'rgba(10,3,16,0.6)'); x.fillStyle = vg; x.fillRect(0, 0, size, size);
  const small = mk(1024), sx2 = small.getContext('2d'); sx2.imageSmoothingQuality = 'high'; sx2.drawImage(out, 0, 0, 1024, 1024);
  const png = small.toDataURL('image/png'), jpg = small.toDataURL('image/jpeg', 0.93);
  globalThis.__icon = () => png; globalThis.__iconJpeg = () => jpg; document.title = 'ready';
}));
