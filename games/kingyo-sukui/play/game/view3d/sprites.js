// Goldfish portraits baked once from the same 3D models the game uses, for the places that stay flat (collection cards, how-to
// illustrations, the catch flying to the bowl). A separate small WebGL context is made and released again.
import * as THREE from '../vendor3d/three.js';
import { createFish } from './fish.js';

export const SPRITE = { w: 256, h: 160, pxPerM: 256 / 0.215, cx: 178.6, cy: 80, bodyM: 0.1 };

export function bakeFishSprites(count = 8) {
  const out = [];
  const cv = document.createElement('canvas'); cv.width = SPRITE.w; cv.height = SPRITE.h;
  let r;
  try { r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return null; }
  r.setPixelRatio(1); r.setSize(SPRITE.w, SPRITE.h, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.7; pm.dispose();
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4); key.position.set(-0.4, 1, 0.6); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x5a4a3a, 0.9));
  const wView = 0.215, hView = wView * SPRITE.h / SPRITE.w;
  const cam = new THREE.OrthographicCamera(-0.15, 0.065, hView / 2, -hView / 2, 0.05, 3);
  // top-down with a touch of tilt so the dorsal fin and eyes read as 3D
  cam.position.set(0, 1.0, 0.18); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
  for (let k = 0; k < count; k++) {
    const f = createFish(k, 2);
    f.pose(SPRITE.bodyM, 0.9, 0.15, 0);
    f.group.position.y = 0; scene.add(f.group);
    r.render(scene, cam);
    const c = document.createElement('canvas'); c.width = SPRITE.w; c.height = SPRITE.h;
    c.getContext('2d').drawImage(cv, 0, 0);
    out.push(c);
    scene.remove(f.group); f.dispose();
  }
  try { scene.environment && scene.environment.dispose(); r.dispose(); r.forceContextLoss?.(); } catch { /* fine */ }
  return out;
}
