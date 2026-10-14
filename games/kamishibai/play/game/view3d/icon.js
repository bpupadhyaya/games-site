// App icon: rendered from the game's own 3D scene (offline, 2048 px, downsampled): the storyteller in his flat cap behind the open
// kamishibai box with a painted card, lantern string above, dusk street behind. Used by tools/render-icon.mjs. Not loaded by the game.
import { createStage, THREE, board3d as B } from '../vendor3d/index.js';
import * as V3 from '../vendor3d/index.js';
import { buildWorld, GY, makeLantern } from './world.js';
import { buildButai, buildBicycle } from './butai.js';
import { createCardKit, makeCardMesh } from './cards.js';
import { createTeller } from './teller.js';

const size = Number(new URLSearchParams(location.search).get('size')) || 2048;
const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
document.body.appendChild(canvas); canvas.style.width = '512px'; canvas.style.height = '512px';
const stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'night', mode: 'ondemand', shadows: true, shadowSize: 1.4, preserveDrawingBuffer: true });
const { scene, camera, renderer } = stage;
renderer.setPixelRatio(1); renderer.setSize(size, size, false);
stage.setLighting('night', { hemiSky: 0x7a80c8, hemiGround: 0x5a4030, hemi: 0.8, key: 0xffc784, keyI: 3.0, rim: 0x8aa6ff, rimI: 1.6, exposure: 1.0 });
scene.fog = new THREE.Fog('#2b2048', 12, 60);
stage._shadowOffset.set(-1.2, 2.4, 2.6); stage.setShadowTarget(0, -0.1, 0);

const world = buildWorld({ quality: 'high' });
scene.add(world.group);
const butai = buildButai({ pad: 0.05 }); scene.add(butai.group);
const bike = buildBicycle(); scene.add(bike.group);
const cards = createCardKit();
const card = makeCardMesh(); card.userData.setFace(cards.front('boat', 2)); card.position.set(0, 0, 0.003); scene.add(card);
// a second card half pulled out to the right (the signature gesture)
const out = makeCardMesh(); out.userData.setFace(cards.front('boat', 1)); out.position.set(0.2, -0.015, 0.03); out.rotation.set(-0.03, 0.1, 0.1); scene.add(out);
const teller = await createTeller(V3, stage, { quality: 'high' });
teller.update({ dt: 0, pos: [0.06, -0.6], yaw: -0.15, speaking: 0, pull: { x: 0.36, y: -0.02, z: -0.02 }, restL: { x: 0.27, y: -0.06, z: -0.2 }, restR: { x: 0.3, y: 0.0, z: -0.3 }, lookAt: { x: 0, y: 0, z: 0 }, lookW: 0.7, strike: false, bow: false });
for (let i = 0; i < 40; i++) { teller.update({ dt: 1 / 60, pos: [0.06, -0.6], yaw: -0.15, speaking: 0, pull: { x: 0.36, y: -0.02, z: -0.02 }, restL: { x: 0.27, y: -0.06, z: -0.2 }, restR: { x: 0.3, y: 0.0, z: -0.3 }, lookAt: { x: 0, y: 0, z: 0 }, lookW: 0.7, strike: false, bow: false }); stage.update(1 / 60, { renderNow: false }); }
// two lanterns hanging at the top corners, the storyteller's face stays clear
for (const [x, y, z, sc] of [[-0.36, 0.36, 0.25, 0.7], [0.4, 0.4, 0.15, 0.6], [-0.58, 0.5, -0.2, 0.55]]) { const l = makeLantern('#ffb347', sc); l.position.set(x, y, z); scene.add(l); }
camera.fov = 30; camera.near = 0.2; camera.far = 160; camera.aspect = 1;
camera.position.set(-0.3, 0.3, 2.35); camera.lookAt(0.02, 0.2, 0);
camera.updateProjectionMatrix();
world.update(2.0, 0.016, 0.3);
for (let i = 0; i < 4; i++) { stage.render(); await new Promise((r) => setTimeout(r, 120)); }
B.renderIcon({ scene, camera, size, renderer, background: '#241a40', bloom: 0.18, vignette: 0.4, exposure: 0.95 });
