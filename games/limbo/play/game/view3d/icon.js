// Offline app-icon render (developer tool): node tools/render-icon.mjs --root web --page icon.html?size=2048 --out store
// The SAME models as the game: the dancer arched under the fire bar on the beach at sunset, rendered at 2048 and downsampled to 1024.
// The subject is composited sharp over a softly defocused background (shallow depth of field), with a warm bloom from the flames.
import { createStage, loadHuman, THREE } from '../vendor3d/index.js';
import { pose as enginePose } from '../src/engine.js';
import { LOOKS, dancerJoints } from '../src/art.js';
import { glowTexture, flameTexture } from './fx.js';
import { buildSky, buildSea, buildSand, buildPalm, buildTorch } from './world.js';
import { createBar } from './bar.js';
import { createDancer } from './dancer.js';

const q = new URLSearchParams(location.search), SIZE = Number(q.get('size') || 2048);
const K = 1.74;
const out = document.createElement('canvas'); out.width = out.height = SIZE; out.style.cssText = 'width:1024px;height:1024px'; document.body.appendChild(out);
const ctx = out.getContext('2d');
const glc = document.createElement('canvas'); glc.width = glc.height = SIZE;
glc.style.cssText = `position:fixed;left:-${SIZE * 2}px;top:0;width:${SIZE}px;height:${SIZE}px`; document.body.appendChild(glc);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

const stage = createStage({ canvas: glc, quality: 'high', dprCap: 1, lighting: 'evening', mode: 'continuous', shadowSize: 3.2, transparent: true, preserveDrawingBuffer: true });
const { scene, camera, renderer } = stage;
renderer.setPixelRatio(1); renderer.setSize(SIZE, SIZE, false);
const lean = Number(q.get('lean') || 0.86);
const camAz = Number(q.get('az') || 36) * Math.PI / 180, camEl = Number(q.get('el') || 4) * Math.PI / 180, fov = Number(q.get('fov') || 26), dist = Number(q.get('dist') || 5.35);
const camTarget = V(Number(q.get('tx') || 0.25), Number(q.get('ty') || 0.86), 0);

// light: low sun behind the bar to the left, warm; the fire lights the face; violet fill from the camera side
const tw = Number(q.get('tw') || 1);          // twilight: the sun has just set, the fire is the light
const sunDir = V(-0.35, tw ? 0.004 : 0.028, -0.9).normalize();
stage.setLighting('evening', tw ? { sky: 0x000000, fog: 0x7a3a70, hemiSky: 0x8a74e0, hemiGround: 0x4a2840, hemi: 0.5, key: 0xff8a5a, keyI: 1.5, rim: 0xff9a70, rimI: 1.5, exposure: 0.92 } : { sky: 0x000000, fog: 0xe0865e, hemiSky: 0xff9a80, hemiGround: 0x8a5038, hemi: 0.5, key: 0xff9a58, keyI: 2.1, rim: 0xff9cb0, rimI: 1.1, exposure: 0.78 });
scene.background = null; scene.fog = new THREE.Fog(tw ? 0x7a3a70 : 0xe0865e, 14, 110);
stage._shadowOffset.set(sunDir.x * 14, 6.0, sunDir.z * 14);
stage.setShadowTarget(0, 0, 0);
stage.lights.rim.position.set(-2.5, 2.4, 7);
scene.environmentIntensity = 0.3;

const sky = buildSky(); sky.material.uniforms.uSun.value.copy(sunDir); scene.add(sky);
const sea = buildSea(); sea.material.uniforms.uSun.value.copy(sunDir); sea.material.uniforms.uTime.value = 3.1; scene.add(sea);
const sand = buildSand(8); scene.add(sand);
if (tw) { sky.material.uniforms.uDim.value = 0.62; sea.material.uniforms.uDim.value = 0.55; sand.children[0].material.color.setHex(0xb08c9a); }
const glowTex = glowTexture(128), flameTex = flameTexture();
const background = [];
for (const [x, z, h, l, seed] of [[-4.6, -1.0, 6.0, 0.6, 1]]) { const p = buildPalm({ height: h, lean: l, seed, frondLen: 2.4 }); p.position.set(x, 0, z); p.rotation.y = seed; scene.add(p); background.push(p); }
for (const [x, z] of [[1.4, -2.9], [-1.1, -3.4]]) { const t = buildTorch({ height: 1.75, seed: x, flameTex, glowTex, light: false }); t.group.position.set(x, 0, z); scene.add(t.group); background.push(t.group); t.flame.scale.set(0.26, 0.55, 1); t.flame2.scale.set(0.2, 0.4, 1); }

// the fire bar
const bar = createBar({ flameTex, glowTex, particles: null, embers: null });
scene.add(bar.root);
bar.setVariant('fire'); bar.S.fire = 1;
const barY = Number(q.get('bar') || 0.8) * K;
for (let i = 0; i < 4; i++) bar.update(0.5, { calm: true, h: barY, wind: 0.3 });
bar.light.intensity = tw ? 5.5 : 2.4;
scene.add(bar.root);
// heat glow around the bar
{
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a30, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sp.position.set(0, barY + 0.25, 0); sp.scale.set(2.6, 1.0, 1); sp.material.opacity = 0.28; scene.add(sp);
}

// the dancer, at the deepest point of the lean under the bar
const dancer = await createDancer({ quality: 'high' });
scene.add(dancer.root, dancer.group);
const look = LOOKS[Number(q.get('look') || 0)];
dancer.setLook(look);
const p = enginePose(lean, 0.04, 0.9);
const J = dancerJoints(p, {});
dancer.t = 1.0;
// settle the cloth and the gait over a few steps of the same pose, like a held frame
dancer.resetGait();
for (let i = 0; i < 40; i++) dancer.apply({ p, att: { wobble: 0.04, phase: 'run' }, dt: 1 / 60, rootX: Number(q.get('x') || -0.02), phase: 0.9, beat: 0, wind: 0.8, J });

// embers and a few sparks (static sprites)
{
  const pts = [];
  for (let i = 0; i < 70; i++) { const a = i * 2.4; pts.push((Math.sin(a * 1.7) * 0.9), barY + 0.2 + ((i * 37) % 100) / 100 * 1.4, (Math.cos(a) * 0.8)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const m = new THREE.PointsMaterial({ map: glowTex, color: 0xffb050, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  scene.add(new THREE.Points(g, m));
}

const az = camAz, el = camEl;
camera.fov = fov; camera.aspect = 1; camera.near = 0.5; camera.far = 700;
camera.position.set(camTarget.x + Math.sin(az) * Math.cos(el) * dist, camTarget.y + Math.sin(el) * dist, camTarget.z + Math.cos(az) * Math.cos(el) * dist);
camera.lookAt(camTarget); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);

function snapCanvas() { const c = document.createElement('canvas'); c.width = c.height = SIZE; c.getContext('2d').drawImage(glc, 0, 0); return c; }
function renderPass() { renderer.setClearColor(0x000000, 0); renderer.render(scene, camera); return snapCanvas(); }

// pass 1: everything, sharp
const full = renderPass();
// pass 2: the background alone (the dancer and bar hidden), to be defocused
dancer.root.visible = false; dancer.group.visible = false; bar.root.visible = false;
const back = renderPass();
dancer.root.visible = true; dancer.group.visible = true; bar.root.visible = true;
// pass 3: the subject alone, for a soft mask (alpha)
const hideList = [sky, sea, sand, ...background];
hideList.forEach((o) => { o.visible = false; });
const subj = renderPass();
hideList.forEach((o) => { o.visible = true; });

// composite
ctx.fillStyle = '#10060c'; ctx.fillRect(0, 0, SIZE, SIZE);
ctx.filter = `blur(${SIZE * 0.012}px)`; ctx.drawImage(back, -SIZE * 0.02, -SIZE * 0.02, SIZE * 1.04, SIZE * 1.04); ctx.filter = 'none';
// the sharp layer: the full render masked by the (slightly grown, softened) subject silhouette plus the sand near it, so shadows stay attached
{
  const sharp = document.createElement('canvas'); sharp.width = sharp.height = SIZE; const s = sharp.getContext('2d');
  s.drawImage(full, 0, 0);
  const mask = document.createElement('canvas'); mask.width = mask.height = SIZE; const m = mask.getContext('2d');
  m.filter = `blur(${SIZE * 0.012}px)`; m.drawImage(subj, 0, 0); m.drawImage(subj, 0, 0); m.filter = 'none';
  // keep the near ground sharp: a soft band at the bottom
  const gr = m.createLinearGradient(0, SIZE * 0.62, 0, SIZE * 0.95); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.75)');
  m.globalCompositeOperation = 'lighter'; m.fillStyle = gr; m.fillRect(0, 0, SIZE, SIZE); m.globalCompositeOperation = 'source-over';
  s.globalCompositeOperation = 'destination-in'; s.drawImage(mask, 0, 0);
  ctx.drawImage(sharp, 0, 0);
}
// bloom from the flames, vignette
ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.filter = `blur(${SIZE * 0.02}px)`; ctx.globalAlpha = 0.07; ctx.drawImage(full, 0, 0); ctx.restore();
const v = ctx.createRadialGradient(SIZE / 2, SIZE * 0.54, SIZE * 0.34, SIZE / 2, SIZE / 2, SIZE * 0.78); v.addColorStop(0, 'rgba(10,2,8,0)'); v.addColorStop(1, 'rgba(10,2,8,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
const small = document.createElement('canvas'); small.width = small.height = 1024; const sm2 = small.getContext('2d'); sm2.imageSmoothingQuality = 'high'; sm2.filter = 'saturate(1.22) contrast(1.08)'; sm2.drawImage(out, 0, 0, 1024, 1024);
window.__icon = () => small.toDataURL('image/png'); window.__iconJpeg = () => small.toDataURL('image/jpeg', 0.93);
void loadHuman;
document.title = 'ready';
