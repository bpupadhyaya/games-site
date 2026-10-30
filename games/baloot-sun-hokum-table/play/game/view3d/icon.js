// Store icon, rendered from the game's own 3D world (icon.html, 1024 x 1024, opaque). One subject: a fanned hand of cards, the ace of
// spades in front, on the indigo Sadu-woven cloth, the brass dallah and its cups glowing behind in the lantern light.
import * as THREE from '../vendor3d/three.js';
import { CLOTH_Y, CARD_H, makeMats, makeTable, makeTray, makeIncense, buildRoom, radialTex, makeCardMesh } from './world.js';
import { cardSprite, backSprite } from '../src/art.js';

const S = 1024, canvas = document.createElement('canvas'); canvas.width = canvas.height = S; document.body.appendChild(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S, false);
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.72;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0812); scene.fog = new THREE.Fog(0x07040c, 70, 230);
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.3;
const M = makeMats(); scene.add(buildRoom(M));
const table = makeTable(70, 108, M); scene.add(table);
const tray = makeTray(M, 1.35, true); tray.position.set(-19, CLOTH_Y, -14); tray.rotation.y = 0.9; scene.add(tray);
const inc = makeIncense(M, 1.3); inc.position.set(31, CLOTH_Y, -18); scene.add(inc);
const key = new THREE.SpotLight(0xffb866, 3200, 600, 0.7, 0.8, 1.5); key.position.set(-30, 130, 40); key.target.position.set(0, CLOTH_Y, 10); key.castShadow = true; key.shadow.mapSize.set(4096, 4096); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.4;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x7a96ff, 1.7); rim.position.set(90, 80, -120); scene.add(rim);
scene.add(new THREE.HemisphereLight(0x8fa6ff, 0x3a2418, 0.35));
const glowTex = radialTex('255,190,100', 0.95, 128);
{ const c = document.createElement('canvas'); c.width = c.height = 512; const q = c.getContext('2d');
  const g0 = q.createRadialGradient(300, 230, 20, 256, 256, 330); g0.addColorStop(0, '#4a2812'); g0.addColorStop(0.35, '#1a0c18'); g0.addColorStop(1, '#030106'); q.fillStyle = g0; q.fillRect(0, 0, 512, 512);
  q.globalCompositeOperation = 'screen'; for (const [x, y, r, a] of [[80, 90, 46, 0.5], [190, 40, 30, 0.35], [420, 120, 60, 0.55], [470, 40, 26, 0.4], [350, 30, 38, 0.3], [40, 220, 30, 0.35]]) { const g = q.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(255,190,100,${a})`); g.addColorStop(0.6, `rgba(255,150,60,${a * 0.5})`); g.addColorStop(1, 'rgba(255,150,60,0)'); q.fillStyle = g; q.fillRect(x - r, y - r, 2 * r, 2 * r); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const bd = new THREE.Mesh(new THREE.PlaneGeometry(340, 340), new THREE.MeshBasicMaterial({ map: t, fog: false })); bd.position.set(0, 60, -70); scene.add(bd); }
for (const [x, y, z, sc, o] of [[-48, 34, -50, 80, 0.7], [44, 46, -64, 110, 0.6], [0, 30, -60, 160, 0.45], [60, 20, -20, 46, 0.5]]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sc, sc), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: o })); m.position.set(x, y, z); scene.add(m);
}
const tex = (id) => { const t = new THREE.Texture(id < 0 ? backSprite() : cardSprite(id, false, false)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; return t; };
const back = tex(-1), fan = new THREE.Group(); scene.add(fan);
[27, 22, 12, 14, 7].forEach((id, i) => {
  const piv = new THREE.Group(), cm = makeCardMesh(back, back); cm.userData.top.material.map = tex(id); cm.position.z = -CARD_H / 2; piv.add(cm);
  piv.rotation.y = (i - 2) * 0.3; piv.position.set((i - 2) * 3.8, i * 0.36, 0); fan.add(piv);
});
fan.scale.setScalar(1.28); fan.position.set(5, CLOTH_Y + 9, 20); fan.traverse((o) => { if (o.isMesh) o.castShadow = false; });
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('0,0,12', 0.85, 128), transparent: true, depthWrite: false, fog: false })); blob.rotation.x = -Math.PI / 2; blob.scale.set(44, 32, 1); blob.position.set(6, CLOTH_Y + 0.08, 14); scene.add(blob); fan.rotation.x = Math.PI / 2 - 0.34;
const cam = new THREE.PerspectiveCamera(33, 1, 1, 4000); cam.position.set(2, CLOTH_Y + 26, 92); cam.lookAt(0, CLOTH_Y + 13, 0);
renderer.render(scene, cam);
const out = document.createElement('canvas'); out.width = out.height = S; const x = out.getContext('2d');
x.drawImage(canvas, 0, 0);
x.globalCompositeOperation = 'screen'; x.filter = 'blur(18px)'; x.globalAlpha = 0.14; x.drawImage(canvas, 0, 0); x.filter = 'none'; x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
const g = x.createRadialGradient(S / 2, S * 0.52, S * 0.24, S / 2, S / 2, S * 0.72); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,4,16,0.8)'); x.fillStyle = g; x.fillRect(0, 0, S, S);
canvas.replaceWith(out); out.style.cssText = 'display:block;width:1024px;height:1024px';
window.__icon = out.toDataURL('image/png'); window.__iconDone = true; document.title = 'icon done';
