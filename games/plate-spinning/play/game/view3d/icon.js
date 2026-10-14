// Offline app-icon render (developer tool): web/icon.html?size=2048 draws the SAME models the game uses: the performer in silk mid-whip on a pole, a
// spinning painted porcelain plate against the moon and the pagoda, lantern bokeh, key + rim light. Never loaded by the game itself.
import { createStage, THREE } from '../vendor3d/index.js';
import * as V3 from '../vendor3d/index.js';
import * as B from '../vendor3d/board3d.js';
import { PLATE_R, plateGeometry, plateMaterials, createPole, createFoot } from './models.js';
import { buildWorld } from './world.js';
import { createPerformer } from './performer.js';

const SIZE = Number(new URLSearchParams(location.search).get('size') || 2048);
const canvas = document.getElementById('c'); canvas.width = canvas.height = SIZE;
const stage = createStage({ canvas, quality: 'high', dprCap: 1, preserveDrawingBuffer: true, mode: 'ondemand' });
const { scene, camera, renderer } = stage;
for (const l of Object.values(stage.lights)) scene.remove(l);
scene.remove(stage.lights.key.target);
scene.environmentIntensity = 0.6;
const world = buildWorld({ quality: 'high' });
scene.add(world.group); world.setShadows(2048); renderer.shadowMap.enabled = true;
world.lights.key.position.set(-2.6, 4.6, 5.2); world.lights.key.target.position.set(0, 1.6, 0); world.lights.key.intensity = 12; world.lights.hemi.intensity = 0.4; world.lights.warmL.intensity = 8; world.lights.warmR.intensity = 8;
world.lights.rim.intensity = 2.6;
world.update(2, false, 0.016);

// two poles with plates: the hero plate (porcelain, near its spin) above and a second one to the side, farther back
const geo = plateGeometry(96);
function addPole(x, z, h, type, tilt, spinA) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const foot = createFoot(); g.add(foot);
  const pole = createPole(h); g.add(pole.mesh);
  const bx = Math.sin(tilt) * 0.0, tip = pole.update((s) => ({ x: bx * s * s, z: 0, sag: 0 }));
  const m = plateMaterials(type);
  const pg = new THREE.Group(), spin = new THREE.Group();
  const mesh = new THREE.Mesh(geo, m.sharp); mesh.castShadow = true; spin.add(mesh); spin.rotation.y = spinA; pg.add(spin);
  pg.scale.setScalar(PLATE_R * 1.12); pg.position.set(tip.x, tip.y + 0.01, tip.z);
  pg.rotation.z = tilt; pg.rotation.x = -0.12;
  g.add(pg); scene.add(g);
  return { g, pg };
}
const hero = addPole(0.3, 0.0, 2.1, 'porcelain', 0.1, 0.0);
hero.pg.rotation.x = 0.62; hero.pg.scale.setScalar(PLATE_R * 1.4);
addPole(-0.9, -1.1, 2.35, 'lacquer', -0.12, 1.0).pg.rotation.x = 0.35;
addPole(1.3, -1.4, 2.4, 'jade', 0.1, 2.0).pg.rotation.x = 0.3;

const perf = await createPerformer(V3, stage, { quality: 'high' });
perf.teleport(-0.12, 0.1); perf.setIdleYaw(0.5); perf.setMode('relaxed');
perf.yaw = 0.55; perf.human.setFacing(0.55);
perf.lookAt(new THREE.Vector3(0.34, 2.15, 0.2), 1);
for (let i = 0; i < 45; i++) {
  perf.human.setReach('R', { x: 0.3, y: 1.75, z: 0.04 }, { weight: 1, pole: { x: 0.0, y: 1.2, z: 0.35 } });
  perf.human.setFingers('R', 'batGrip');
  perf.update(1 / 30);
}
camera.fov = 27;
camera.position.set(0.38, 2.02, 3.2); camera.lookAt(0.14, 2.0, 0);
const res = B.renderIcon({ scene, camera, size: SIZE, background: '#14060e', bloom: 0.28, vignette: 0.42, renderer, exposure: 0.85 });
void res;
