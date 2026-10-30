// Store icon, rendered offline from the game's own 3D world (icon.html?size=2048): close over a red cut-paper window flower lifted just above a dark
// mat, lit by the desk lamp, with a glint of steel scissors in the corner. No text. Sets window.__icon() (PNG data URL).
import * as THREE from '../vendor3d/three.js';
import { renderIcon } from '../vendor3d/board3d.js';
import { flatFaces } from '../src/paper.js';
import { SHEETS, foldPlan, cutPoly, layersOf } from '../src/shapes.js';
import { LEVELS } from '../src/levels.js';
import { bakeCut } from '../src/paperview.js';
import { buildLights, buildSet, matMaterial, buildMat, layoutProps, PaperStack, MAT_H } from './world.js';

const q = new URLSearchParams(location.search), num = (k, d) => (q.has(k) ? Number(q.get(k)) : d), size = Number(q.get('size') || 2048);
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a0605); scene.fog = new THREE.Fog(0x0a0605, 5, 16);
const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), antialias: true, alpha: true, preserveDrawingBuffer: true });
const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.18;
const L = buildLights(scene);
L.sun.castShadow = true; L.sun.shadow.mapSize.set(4096, 4096); L.sun.intensity = num('sun', 1.8); L.hemi.intensity = 0.05; L.rim.intensity = 0.1;
L.sun.position.set(-2.4, 4, -1.6); L.lamp.position.set(-1.4, 1.6, -0.6); L.lamp.intensity = num('lamp', 10);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.NoToneMapping;

const lv = LEVELS.find((l) => l.id === 'lotus'), plan = foldPlan(lv.sheet, lv.ref);
const paperTex = bakeCut(q.get('paper') || 'red', 'icon', layersOf(lv.sheet, lv.ref), lv.cuts.map(cutPoly), SHEETS[lv.sheet].pts, plan.creases);
const paper = new PaperStack(); scene.add(paper.group);
paper.update({ faces: flatFaces(plan.states[0]), paper: paperTex, cam: { cx: 0, cy: 0, roll: 0 } }, true);
paper.group.position.y = 0.035;   // lifted a little: the lamp throws the whole pattern as a shadow on the mat
const set = buildSet(0); scene.add(set); set.position.y = -0.004 - MAT_H;
const mat = buildMat(); mat.userData.mesh.geometry.dispose(); mat.userData.mesh.geometry = (await import('../vendor3d/board3d.js')).slab(2.3, 2.3, MAT_H, 0.08, 0.02, { uvScale: 1 });
mat.userData.mesh.material = new THREE.MeshStandardMaterial({ color: 0x1b0d0b, roughness: 0.55, metalness: 0.05 }); set.add(mat);
layoutProps(set, 0, 0, 2.3, 2.3);
for (const k of ['pad', 'chop', 'cup', 'folder']) set.userData.props[k].visible = false;
set.userData.props.scissors.position.set(1.25, 0, 0.95); set.userData.props.scissors.rotation.y = -0.9; set.userData.props.scissors.scale.setScalar(1.0);
const cam = new THREE.PerspectiveCamera(num('fov', 38), 1, 0.2, 60);
cam.position.set(num('cx', 0.35), num('cy', 1.7), num('cz', 1.35)); cam.lookAt(new THREE.Vector3(num('tx', 0.0), 0, num('tz', 0.02)));
renderIcon({ scene, camera: cam, size, renderer, background: '#0a0605', bloom: 0.2, vignette: 0.8, exposure: num('exp', 0.95) });
