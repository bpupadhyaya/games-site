// Developer check page (not shipped in the game flow): the storyteller in his key poses from the front, side and three-quarter views.
import { createStage, THREE } from '../vendor3d/index.js';
import * as V3 from '../vendor3d/index.js';
import { GY } from './world.js';
import { createTeller } from './teller.js';
const W = 1500, H = 700;
const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H; document.body.appendChild(canvas);
const stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'day', mode: 'ondemand', shadows: false, preserveDrawingBuffer: true });
const { renderer, camera, scene } = stage;
renderer.setPixelRatio(1); renderer.setSize(W, H, false); renderer.setScissorTest(true);
scene.background = new THREE.Color('#586070');
const g = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: '#3a3a3a' })); g.rotation.x = -Math.PI / 2; g.position.y = GY; scene.add(g);
const t = await createTeller(V3, stage, { quality: 'high' });
const base = { dt: 1 / 60, pos: [0.1, -0.6], yaw: -0.15, speaking: 0, pull: null, restL: { x: 0.27, y: -0.06, z: -0.2 }, restR: { x: 0.06, y: -0.02, z: -0.4 }, lookAt: { x: 0, y: GY + 0.55, z: 2 }, lookW: 0.8, strike: false, bow: false };
const states = [['rest', {}, 60], ['pull', { pull: { x: 0.45, y: -0.04, z: -0.04 } }, 60], ['strike', { strike: true }, 22], ['bow', { bow: true }, 90]];
const views = [[0, 0.5, 3.0], [2.8, 0.5, 0.2], [2.0, 0.5, 2.0]];
const labels = [];
for (let si = 0; si < states.length; si++) {
  const [name, over, frames] = states[si];
  const c = { ...base, ...over };
  for (let i = 0; i < frames; i++) { t.update({ ...c, strike: over.strike && i === 0 }); stage.update(1 / 60, { renderNow: false }); }
  for (let vi = 0; vi < 3; vi++) {
    const cw = W / 3, ch = H / 4;
    const x = vi * cw, y = H - (si + 1) * ch;
    renderer.setViewport(x, y, cw, ch); renderer.setScissor(x, y, cw, ch);
    camera.aspect = cw / ch; camera.fov = 38; camera.near = 0.1; camera.far = 50; camera.updateProjectionMatrix();
    camera.position.set(0.1 + views[vi][0] * 0.55, GY + 1.25, -0.6 + views[vi][2] * 0.55 + (vi === 1 ? 0 : 0.0)); camera.lookAt(0.1, GY + 1.2, -0.6);
    renderer.render(scene, camera);
  }
  labels.push(name);
}
document.title = 'ready';
