// App icon: rendered from the game's own 3D scene (offline, 2048 px, downsampled): a real athlete at the top of a jumping smash on a Brazilian
// beach, the palm meeting the peteca, net and sea behind. Used by tools/render-icon.mjs (icon.html?size=2048). Not loaded by the game.
import { createStage, loadHuman, THREE, board3d as B } from '../vendor3d/index.js';
import { buildWorld, COURT_STYLE } from './world.js';
import { createAthleteKit } from './athlete.js';
import { createPeteca, createParticles } from './fx3d.js';
import { LOOKS } from '../src/figure.js';
import { PETECAS } from '../src/art.js';

const size = Number(new URLSearchParams(location.search).get('size')) || 2048;
const V3 = await import('../vendor3d/index.js');
const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
document.body.appendChild(canvas); canvas.style.width = '512px'; canvas.style.height = '512px';
const stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'day', mode: 'ondemand', shadows: true, shadowSize: 7, preserveDrawingBuffer: true });
const { scene, camera, renderer } = stage;
renderer.setPixelRatio(1); renderer.setSize(size, size, false);
const world = buildWorld({ courtId: 0, quality: 'high', wind: 0.3 });
scene.add(world.group);
const st = world.style;
stage.setLighting('day', { hemiSky: st.hemiSky, hemiGround: st.hemiGround, hemi: 0.9, key: '#fff0d2', keyI: 2.2, rim: '#cfe6ff', rimI: 1.9, exposure: 0.88 });
stage._shadowOffset.set(-4, 8, 6); stage.setShadowTarget(-1, 0, 0);
scene.fog = null;
await world.scenery.ready;

const L = LOOKS[5];
const h = await loadHuman({ character: 'athlete_m', kit: { top: '#1f6fe0', bottoms: '#f6f0dc', socks: '#f4f4f0' }, skin: L.skin, hair: L.hair });
h.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
scene.add(h.root);
const { Athlete } = createAthleteKit(V3);
const ath = new Athlete(h, 5);
// run the smash up to the apex: the AI-style plan drives the jump, the wind-up and the palm to the contact point
const contact = { xw: -1.05, zHit: 2.12 };
const S = (tcd) => ({ x: contact.xw + 6 - 0.35, depth: 0, dir: 1, ready: 1, anim: null, mine: true, tcd, plan: { shot: 'smash', zHit: contact.zHit, xw: contact.xw }, ball: { x: contact.xw, y: contact.zHit, z: 0 }, mood: null, jumpSim: 0, held: false });
for (let k = 0; k < 40; k++) ath.update(1 / 60, S(0.9));
const T_END = -0.075 + 0.012;   // the palm is through the contact, a hair after
for (let t = 0.5; t >= T_END; t -= 1 / 60) ath.update(1 / 60, S(t));
// hold the apex pose

const pet = createPeteca(PETECAS[1]);
scene.add(pet);
pet.position.set(contact.xw + 0.1, contact.zHit + 0.04, 0);
pet.rotation.z = -0.5; pet.scale.setScalar(1.9);                              // base leading, going over the net and down
pet.userData.animate(1.3, 16, 1, 0, 0.2);
// sand thrown up by the take-off
const parts = createParticles(200); scene.add(parts.points);
for (let i = 0; i < 26; i++) {
  const a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.1;
  parts.spawn({ kind: 0, x: -1.4 + Math.cos(a) * 0.35, y: 0.05 + Math.random() * 0.5, z: Math.sin(a) * 0.35, size: 0.1 + Math.random() * 0.12, col: [0.95, 0.83, 0.6], a: 0.55, t: 0.3, max: 0.9, floor: false });
}
camera.fov = 34; camera.near = 0.5; camera.far = 500;
camera.position.set(-4.0, 0.62, 3.9); camera.lookAt(-0.7, 1.5, 0);
camera.updateProjectionMatrix();
parts.setScale(size / (2 * Math.tan((36 * Math.PI / 180) / 2)));
parts.update(0.0001);
world.update(2.0, 0.016, 0.3);
world.scenery.update(0.1, camera);
const drop = world.scenery;
for (let i = 0; i < 4; i++) { stage.render(); await new Promise((r) => setTimeout(r, 120)); }
B.renderIcon({ scene, camera, size, renderer, background: '#7fb8e6', bloom: 0.1, vignette: 0.4, exposure: 0.86 });
void drop; void COURT_STYLE;
