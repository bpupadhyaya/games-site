// Offline app-icon render (developer tool): the SAME box models as the game, lit like the game, composited by board3d.renderIcon.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { LOOKS } from '../src/ui.js';
import { buildFace, buildDesk, buildKeepsake } from './models.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), look = 'cherry', T = LOOKS[look];
const scene = new THREE.Scene();
const probe = document.createElement('canvas'); probe.width = probe.height = 64;
const tmp = new THREE.WebGLRenderer({ canvas: probe, antialias: false });
const pm = new THREE.PMREMGenerator(tmp);
scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.5;
B.lightingRig(scene, 'warmIndoor', { shadow: 2048, extent: 6, background: false, fog: false, overrides: { keyI: 3.4, keyPos: [-4.5, 8, 5], rimI: 2.2, hemi: 0.45 } });
scene.background = new THREE.Color(0x120a06); scene.fog = new THREE.Fog(0x140a06, 10.5, 19);
const desk = buildDesk(look, T, { lanternLight: false });
scene.add(desk.group);
const spec = { lanes: 3, steps: 2, laneSteps: [2, 2, 2], vertical: false, ids: [3, 8, 12], goals: [2, 2, 2] };
const face = buildFace(spec, T, look, { shadows: true });
scene.add(face.group);
face.update([{ lane: 0, vis: 2, goal: 2 }, { lane: 1, vis: 1, goal: 2 }, { lane: 2, vis: 0.0, goal: 2 }].map((p, i) => ({ ...p, lane: i, lift: 0 })), 0, { dt: 1 });
for (let i = 0; i < 80; i++) face.update([{ lane: 0, vis: 2 }, { lane: 1, vis: 1 }, { lane: 2, vis: 0 }].map((p, i) => ({ ...p, lane: i })), 0, { dt: 0.02 });
const key = buildKeepsake('key', T); key.position.set(2.6, 0.3, 2.9); key.rotation.set(-Math.PI / 2, 0, 0.5); key.scale.setScalar(0.9); // brass key resting beside
scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.5, 100);
const pitch = (Number(q.get('pitch') || 46) * Math.PI) / 180, dist = Number(q.get('dist') || 11.5), look0 = [Number(q.get('lx') || 0), Number(q.get('ly') || -0.4), Number(q.get('lz') || 0.2)];
cam.position.set(look0[0] - 0.8, look0[1] + Math.sin(pitch) * dist, look0[2] + Math.cos(pitch) * dist); cam.lookAt(...look0);
desk.update(3.2, cam, false);
const r = B.renderIcon({ scene, camera: cam, size: SIZE, background: '#0b0604', bloom: 0.25, vignette: 0.6, exposure: 1.0 });
void r; document.title = 'ready';
