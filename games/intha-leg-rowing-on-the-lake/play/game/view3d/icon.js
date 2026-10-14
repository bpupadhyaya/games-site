// Offline app-icon render (developer tool, not part of the game): headless Chrome loads web/icon.html?size=2048. It builds the SAME 3D lake
// the game draws (karst hills, floating gardens, mist, the rower with the leg round the oar and the conical net), renders a hero close-up,
// and composites warm sun glow + a soft vignette. Exposes window.__icon() -> 1024 px PNG data URL and sets document.title = 'ready'.
import { createPresenter } from './presenter.js';
import { createWorld, stepWorld } from '../src/sim.js';
import { createRng } from '../kit/rng.js';

const q = new URLSearchParams(location.search);
const SIZE = Number(q.get('size') || 2048), COURSE = Number(q.get('course') || 0);
const kit = document.createElement('canvas'); document.body.appendChild(kit);
const p = await createPresenter({ kitCanvas: kit, quality: 'high' });
if (!p.ok) throw new Error('WebGL unavailable for the icon render');
const W = createWorld(COURSE, { mode: 'auto' }, createRng(5));
for (let i = 0; i < 60 * 9; i++) stepWorld(W, 1 / 60, null);
const cam = { solo: !q.has('rivals') }; for (const k of ['fov', 'az', 'el', 'd', 'fx', 'fy', 'fz']) if (q.has(k)) cam[k] = Number(q.get(k));
if (q.has('hide')) cam.hide = q.get('hide').split(',').map(Number);
const url = await p.renderIcon({ W, size: SIZE, cam });
const img = new Image(); await new Promise((r) => { img.onload = r; img.src = url; });
const out = document.createElement('canvas'); out.width = out.height = 1024; document.body.appendChild(out);
out.style.cssText = 'position:fixed;left:0;top:0;width:1024px;height:1024px;z-index:99';
const g = out.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, 1024, 1024);
const glow = g.createRadialGradient(1024 * 0.78, 1024 * 0.2, 0, 1024 * 0.78, 1024 * 0.2, 1024 * 0.55);
glow.addColorStop(0, 'rgba(255,214,150,0.5)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
g.globalCompositeOperation = 'screen'; g.fillStyle = glow; g.fillRect(0, 0, 1024, 1024); g.globalCompositeOperation = 'source-over';
const vg = g.createRadialGradient(512, 540, 330, 512, 540, 760); vg.addColorStop(0, 'rgba(6,20,32,0)'); vg.addColorStop(1, 'rgba(6,20,32,0.5)');
g.fillStyle = vg; g.fillRect(0, 0, 1024, 1024);
window.__icon = () => out.toDataURL('image/png');
window.__iconJpeg = () => out.toDataURL('image/jpeg', 0.93);
document.title = 'ready';
