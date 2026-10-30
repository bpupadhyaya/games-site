// The store icon, rendered from the game's own 3D instrument: one upright kora on a diagonal, lit by a warm lamp from the left with a
// cool dusk rim from behind, a soft halo behind the calabash and a few lamp lights out of focus. Used only by icon.html (offline).
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { kora, heroSpec, materials } from './world.js';

export function renderKoraIcon(q) {
  const scene = new THREE.Scene();
  const R = 26, K = kora(), spec = heroSpec(R);
  K.setSpec(spec);
  const amps = new Array(21).fill(0); [8, 9, 11, 12].forEach((i, k) => { amps[i] = 0.9 - k * 0.15; });
  K.setAmps(amps, 0.37, null);
  const g = new THREE.Group(); g.add(K.group); scene.add(g);
  K.group.rotation.set(Math.PI / 2 - 0.22, 0, 0);
  g.rotation.z = -0.5; g.rotation.y = 0.32;
  // halo and bokeh behind
  const halo = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,1)'); gr.addColorStop(0.3, 'rgba(255,150,70,0.45)'); gr.addColorStop(1, 'rgba(255,120,50,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xff8a40, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.position.set(-6, 22, -60); aura.scale.set(190, 190, 1); scene.add(aura);
  for (const [x, y, s, o] of [[58, 92, 22, 0.55], [80, 60, 14, 0.4], [-70, 88, 16, 0.35], [30, 112, 12, 0.35], [-88, 40, 10, 0.25]]) {
    const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffc070, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false }));
    b.position.set(x, y, -110); b.scale.setScalar(s); scene.add(b);
  }
  // light
  const key = new THREE.SpotLight(0xffc98e, 11000, 0, 0.6, 0.6, 1.6); key.position.set(-150, 120, 160); key.target.position.set(0, 20, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004;
  const rim = new THREE.DirectionalLight(0x9db4ff, 2.2); rim.position.set(120, 90, -160);
  const hemi = new THREE.HemisphereLight(0xffd7b0, 0x1a0a10, 0.35);
  scene.add(key, key.target, rim, hemi);
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  try { const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.4; } catch { /* no IBL */ }
  const cam = new THREE.PerspectiveCamera(30, 1, 5, 2000);
  cam.position.set(Number(q.get('cx') ?? 10), Number(q.get('cy') ?? 30), Number(q.get('cz') ?? 250)); cam.lookAt(Number(q.get('lx') ?? 2), Number(q.get('ly') ?? 36), 0);
  void materials;
  const res = B.renderIcon({ scene, camera: cam, size: 2048, background: '#1b0a14', bloom: 0.28, vignette: 0.55, renderer: r, exposure: 1.0 });
  // paint a warm-to-plum gradient UNDER the render (renderIcon fills a flat colour; repaint the backdrop for atmosphere)
  const out = document.createElement('canvas'); out.width = out.height = 1024; const x = out.getContext('2d');
  const bg = x.createRadialGradient(470, 430, 40, 512, 512, 760); bg.addColorStop(0, '#5a2414'); bg.addColorStop(0.45, '#2a0f18'); bg.addColorStop(1, '#0e0610');
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 1024);
  x.drawImage(r.domElement, 0, 0, 1024, 1024);
  x.save(); x.globalCompositeOperation = 'lighter'; x.filter = 'blur(14px)'; x.globalAlpha = 0.25; x.drawImage(r.domElement, 0, 0, 1024, 1024); x.restore();
  const v = x.createRadialGradient(512, 512, 380, 512, 512, 780); v.addColorStop(0, 'rgba(6,2,8,0)'); v.addColorStop(1, 'rgba(6,2,8,0.6)'); x.fillStyle = v; x.fillRect(0, 0, 1024, 1024);
  const png = out.toDataURL('image/png');
  window.__icon = () => png; document.title = 'ready'; void res;
  const img = new Image(); img.src = png; img.style.width = '512px'; document.body.appendChild(img);
}
