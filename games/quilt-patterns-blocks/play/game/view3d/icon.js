// Offline app-icon render (developer tool, not part of the game): open icon.html?size=2048 in headless Chrome with real WebGL; the result
// is window.__icon (PNG data URL, 1024). Same world as the game (world.js): a finished Ohio Star block of pillowed cloth with running
// stitches on the cutting mat, the last star point still settling into place, a spool and pins at the edge, warm raking lamp light.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { LOOK3D, MAT, BOARD, CLOTH_Y, woodTable, cuttingMat, blockPieces, patchGeometry, mergeGeometries, fabricMaterial, makeStitches, writeStitches, spool, pincushion } from './world.js';
import { blockOf } from '../src/blocks.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const L = LOOK3D.hearth, scene = new THREE.Scene(); scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.bg, num('fn', 120), num('ff', 260));
scene.add(woodTable('hearth'), cuttingMat('hearth'));
const id = q.get('block') || 'ohio-star', pal = (q.get('pal') || 'parchment,crimson,indigo').split(','), paint = blockOf(id).patches.map((p) => pal[p.role]), pieces = blockPieces(id, paint), cloth = new THREE.Group(); cloth.position.y = CLOTH_Y; scene.add(cloth);
const lastI = num('last', -1), byFid = new Map();
pieces.forEach((pc, i) => { pc.geo = patchGeometry(pc.pts, BOARD, false); if (i === lastI) return; if (!byFid.has(pc.fid)) byFid.set(pc.fid, []); byFid.get(pc.fid).push(pc.geo); });
for (const [fid, geos] of byFid) { const m = new THREE.Mesh(mergeGeometries(geos), fabricMaterial(fid, false, BOARD, L.paper)); m.castShadow = m.receiveShadow = true; cloth.add(m); }
const st = makeStitches(4000); cloth.add(st); writeStitches(st, pieces, BOARD, 0, 0);
// the last piece settling into place (lifted and turned a touch), casting a real shadow on the block
if (lastI >= 0) {
  const lp = pieces[lastI], lm = new THREE.Mesh(lp.geo, fabricMaterial(lp.fid, false, BOARD, L.paper)); lm.castShadow = lm.receiveShadow = true;
  const piv = new THREE.Group(), c = lp.geo.userData.c; piv.position.set(c[0], num('lift', 1.6), c[1]); lm.position.set(-c[0], 0, -c[1]); piv.rotation.set(num('ptilt', 0.06), num('prot', -0.12), 0); piv.add(lm); cloth.add(piv);
}
const sp = spool('#c9453a'); sp.position.set(num('sx', 26), 0, num('sz', -14)); scene.add(sp);
const pc = pincushion(); pc.position.set(num('px', -60), 0, num('pz', -MAT / 2 + 2)); scene.add(pc);
const lamp = new THREE.SpotLight(0xffd6a6, num('lamp', 3.6), 0, 0.5, 0.8, 0); lamp.position.set(num('lx', -90), num('ly', 80), num('lz', -60)); lamp.target.position.set(0, 0, 0);
lamp.castShadow = true; lamp.shadow.mapSize.set(4096, 4096); lamp.shadow.bias = -0.0002; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 5; Object.assign(lamp.shadow.camera, { near: 40, far: 300 });
const rim = new THREE.DirectionalLight(0x9fb8ff, num('rim', 0.8)); rim.position.set(70, 40, 90);
scene.add(lamp, lamp.target, rim, new THREE.HemisphereLight(0xf0dcc0, 0x24160c, num('hemi', 0.4)));
const cam = new THREE.PerspectiveCamera(num('fov', 28), 1, 1, 800);
const yaw = num('yaw', -30) * Math.PI / 180, tilt = num('tilt', 40) * Math.PI / 180, dist = num('dist', 68);
const tgt = new THREE.Vector3(num('tx', 5), CLOTH_Y, num('tz', -3));
cam.position.set(tgt.x + Math.sin(yaw) * Math.cos(tilt) * dist, tgt.y + Math.sin(tilt) * dist, tgt.z + Math.cos(yaw) * Math.cos(tilt) * dist); cam.lookAt(tgt);
const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = num('env', 0.22);
B.renderIcon({ scene, camera: cam, size: SIZE, background: '#120a06', bloom: num('bloom', 0.1), vignette: num('vig', 0.5), renderer: r, exposure: num('exp', 1.0) });
