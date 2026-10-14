// Offline app-icon render: the same courtyard, dancer and tower as the game, posed and lit for a square picture (tools/render-icon.mjs).
import { THREE, board3d as B } from '../vendor3d/index.js';
import { buildRoom, setAct } from './room.js';
import { createDancer } from './dancer.js';
import { createPots } from './pots.js';
import { createBand } from './band.js';
import { createFx } from './fx.js';
import { ACTS } from '../src/courses.js';

const T = THREE;

export async function renderIconScene(q) {
  const size = Number(q.get('size') || 2048);
  const canvas = document.createElement('canvas');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const room = buildRoom({ quality: 'high' });
  const scene = room.scene;
  B.createEnvironment(renderer, scene, { intensity: 0.5 });
  const camera = new T.PerspectiveCamera(36, 1, 0.5, 140);
  const dancer = await createDancer(scene, { quality: 'high' });
  const pots = createPots(scene, { quality: 'high' });
  const band = await createBand(scene, camera, { quality: 'medium' });
  const fx = createFx(scene);
  setAct(room, ACTS[Number(q.get('act') || 4)]);
  const ev = [];
  const v = { x: 0.0, v: 0.2, th: 0.07, om: 0.1, acc: 1.0, n: 5, bp: 0.45, beatCount: 1, look: 0, ai: 0, wind: 0.0, pulse: 0.5, playing: true, scene: 'play', targets: [], ev, shake: 0 };
  // settle the cloth and the tower: a second of presentation time
  for (let i = 0; i < 90; i++) {
    v.th = 0.07 + 0.02 * Math.sin(i * 0.1);
    dancer.update(v, 1 / 60, i / 60, pots, [], fx);
    v.yawSpin = dancer.S.yawSpin;
    pots.update(v, 1 / 60, dancer.S.pivot, dancer.S.headQ, [], fx, i / 60);
    band.update(v, 1 / 60, i / 60, []);
  }
  band.hideAll();
  room.bulbs.forEach((b) => { b.b.visible = false; b.hs.visible = false; });
  room.torches.forEach((t) => { t.fl.group.visible = false; });
  scene.traverse((o) => { if (o.isLine || (o.geometry && o.geometry.type === 'CylinderGeometry' && o.position.y > 0.5 && Math.abs(o.position.x) > 2 && o.position.z > -3)) o.visible = false; });
  room.torches.forEach((t, k) => { t.light.intensity = k === 0 ? 5 : 1.5; });
  fx.petals(new T.Vector3(0.5, 0.05, 0.4), 22, [0xffb52e, 0xff6f9c, 0xffe08a, 0xff8a1f], 1.2);
  for (let i = 0; i < 12; i++) fx.update(1 / 30);
  const e = q.get('cam') ? q.get('cam').split(',').map(Number) : [0.9, 1.2, 7.6, 0.0, 1.95, 0.0, 30];
  camera.position.set(e[0], e[1], e[2]); camera.lookAt(e[3], e[4], e[5]); camera.fov = e[6]; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  fx.setScale(camera, size);
  window.__icon = () => { const r = B.renderIcon({ scene, camera, size, renderer, background: '#07101f', bloom: 0.35, vignette: 0.45, exposure: 1.0 }); return r.png1024; };
  window.__iconJpeg = () => null;
  document.title = 'ready';
}
