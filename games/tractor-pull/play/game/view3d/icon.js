// Offline app-icon render (developer tool, not part of the shipped game flow): the same 3D track scene as the game, one pulling moment
// (a rig on its back wheels under the floodlights, dust and clods flying), rendered by board3d.renderIcon() into store/icon.png + icon.svg
// (see platform/view3d/tools/render-icon.mjs).
import { board3d as B } from '../vendor3d/index.js';
import { createTrack3d } from './track3d.js';

const q = new URLSearchParams(location.search), size = Number(q.get('size') || 2048);
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);
const api = await createTrack3d({ quality: 'high' });
const cam = (q.get('cam') || '').split(',').map(Number);
const look = (q.get('look') || '').split(',').map(Number);
const x = num('x', 18);
const st = await api.stillSetup({
  ground: num('g', 2), rig: num('r', 1), x, lift: num('lift', 0.8), t: num('t', 3.1),
  cam: cam.length === 3 && cam.every(Number.isFinite) ? cam : [x + 5.2, 1.1, 6.0], look: look.length === 3 && look.every(Number.isFinite) ? look : [x + 0.9, 1.55, 0], fov: num('fov', 38),
});
await new Promise((r) => setTimeout(r, 400));
st.relight();
B.renderIcon({ scene: st.scene, camera: st.camera, size, renderer: st.renderer, background: '#1a1030', bloom: num('bloom', 0.28), vignette: num('vig', 0.55), exposure: num('exp', 1.0) });
