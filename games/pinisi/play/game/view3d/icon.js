// Offline app-icon scene: the pinisi under full sail at golden hour on the same sea shader as the game. Rendered by tools/render-icon.mjs.
import { THREE, board3d } from '../vendor3d/index.js';
import { createSky, createSea, bakeShore, createWake } from './sea.js';
import { buildPinisi } from './ship.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(size, size, false); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
const sky = createSky(); scene.add(sky.mesh);
const sea = createSea(bakeShore([])); scene.add(sea.mesh); sea.uni.uTime.value = 7.3; sea.uni.uFogK.value = 0.0016; sea.uni.uChop.value = 1.2;
const ship = buildPinisi({ size: 'pinisi', timber: 'teak', rig: 'balanced' });
scene.add(ship.root);
ship.update(3, { setting: 'full', side: 1, rel: 1.15, str: 1.0, dt: 0 });
ship.ship.rotation.x = 0.1;
ship.root.rotation.y = -0.15; ship.root.position.set(0, -0.6, 0);
const wake = createWake(); scene.add(wake.mesh);
for (let i = 0; i < 60; i++) wake.update(0.1, i * 0.1, -6.2 - i * 0.55, 0, 0, 1, 1.6);
scene.add(new THREE.HemisphereLight('#ffdcb4', '#1f5c66', 0.8));
const key = new THREE.DirectionalLight('#ffc589', 3.0); key.position.set(-14, 16, 12); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 70 });
scene.add(key, key.target);
const rim = new THREE.DirectionalLight('#8fb8ff', 1.2); rim.position.set(12, 6, -14); scene.add(rim);
const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 3000);
cam.position.set(17, 4.2, 27); cam.lookAt(0.2, 4.6, 0);
sky.mesh.position.copy(cam.position);
sea.mesh.position.set(0, 0, 0);
board3d.renderIcon({ scene, camera: cam, size, renderer, exposure: 0.8, bloom: 0.15, vignette: 0.28, background: '#0a3a4a' });
