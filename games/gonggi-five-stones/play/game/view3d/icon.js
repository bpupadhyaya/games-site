// Store icon, rendered from the game's own 3D world (open icon.html?s=1024 in a 1024x1024 window; the page sets document.title = 'READY').
// One subject: a glossy jade pebble tossed high above the bojagi cloth, the other four lying below it, warm lattice-window light, a dark room.
import * as THREE from '../vendor3d/three.js';
import { CLOTH_Y, STONE_R, STONE_H, w2x, w2z, floorMesh, clothMesh, stoneMesh, latticeCookie } from './world.js';

const T = THREE, q = new URLSearchParams(location.search);
const S = Number(q.get('s') || 1024);
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(S, S); document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = Number(q.get('exp') || 1.0);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
const BG = new T.Color(0x120a06);
const scene = new T.Scene(); scene.background = BG; scene.fog = new T.Fog(BG, Number(q.get('fn') || 22), Number(q.get('ff') || 60));
const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.45;
const sun = new T.SpotLight(0xffd2a0, Number(q.get('sun') || 2.2), 0, 0.38, 0.8, 0); sun.position.set(-50, 80, -45); sun.target.position.set(w2x(345), 0, w2z(470)); sun.map = latticeCookie();
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02; Object.assign(sun.shadow.camera, { near: 50, far: 200 });
const rim = new T.DirectionalLight(0xbcd0ff, 1.6); rim.position.set(30, 25, -60);
const key = new T.DirectionalLight(0xffe2c0, Number(q.get('key') || 0.45)); key.position.set(-20, 30, 40);
scene.add(sun, sun.target, rim, key, new T.HemisphereLight(0xcfd4ff, 0x4a2612, 0.18));
const fl = floorMesh(); fl.material.roughness = 0.75; fl.material.envMapIntensity = 0.05; scene.add(fl, clothMesh(2.4));
const rest = CLOTH_Y + STONE_H * STONE_R * 0.8;
const lay = (q.get('lay') || '2,250,380,0.3;4,420,330,1.2').split(';').filter(Boolean).map((t) => t.split(',').map(Number));
for (const [id, x, y, r] of lay) { const g = stoneMesh(id); g.position.set(w2x(x), rest, w2z(y)); g.rotation.y = r; scene.add(g); const sh = g.userData.shadow; sh.scale.set(STONE_R * 3, STONE_R * 2.6, 1); sh.position.set(w2x(x), CLOTH_Y + 0.02, w2z(y)); scene.add(sh); }
// the tossed pebble, high and close
const hx = 345, hy = 470, hz = Number(q.get('hz') || 7.5);
const hero = stoneMesh(3); hero.position.set(w2x(hx), rest + hz, w2z(hy)); hero.rotation.set(0.5, 0.9, -0.35); hero.scale.setScalar(1.0); scene.add(hero);
const hs = hero.userData.shadow; hs.scale.set(STONE_R * 4.6, STONE_R * 4, 1); hs.position.set(w2x(hx) + 0.8, CLOTH_Y + 0.02, w2z(hy) + 0.4); hs.material.opacity = 0.42; scene.add(hs);
const cam = new T.PerspectiveCamera(Number(q.get('fov') || 30), 1, 0.5, 400);
const ce = Number(q.get('el') || 26) * Math.PI / 180, cd = Number(q.get('d') || 26), cy = Number(q.get('ty') || 4.2);
const tgt = new T.Vector3(w2x(hx), cy, w2z(hy) - 1.5);
cam.position.set(tgt.x + Math.sin(-0.35) * Math.cos(ce) * cd, tgt.y + Math.sin(ce) * cd, tgt.z + Math.cos(-0.35) * Math.cos(ce) * cd);
cam.lookAt(tgt);
renderer.render(scene, cam);
requestAnimationFrame(() => { renderer.render(scene, cam); document.title = 'READY'; });
