// Stone and Sweep 3D presenter (game-owned). It ONLY READS the game state; it never writes to it (except the v3 hand-off flag).
// One WebGL canvas sits behind the kit's transparent 2D canvas. The 2D layer keeps all text, HUD, input, hit testing, the aim guide,
// sweepers, trails and the house inset; this draws the lit hall, the glossy pebbled ice and the granite stones.
// Camera: the SAME pinhole the 2D layer maps with (cam.pin from view.js makeCam, frame coordinates; landscape = the frame turned a quarter),
// so every guide, ring and finger lands on the lit ice exactly. With no WebGL / init failure nothing is created (the baked 2D sheet stays);
// on context loss v3.on = false (2D sheet) and on restore the 3D comes back.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/ui.js';
import { W, H } from '../src/layout.js';
import { makeCam, dispOf, stoneScale } from '../src/view.js';
import { R } from '../src/sim.js';
import { buildRink, envScene, makeStone, cvs, tex } from './rink.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2 }, { name: 'medium', dpr: 1.5 }, { name: 'low', dpr: 1 }];

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D sheet kept', e); return noop; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.setClearColor(0x0a1422, 1);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1422, 55, 150);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x1b2c44, 0.7);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.8); key.position.set(-6, 14, 10); key.target.position.set(0, 0, -14);
  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.6); fill.position.set(7, 6, 18);
  scene.add(hemi, key, key.target, fill);
  function buildEnv() {
    const pm = new THREE.PMREMGenerator(renderer);
    if (scene.environment && scene.environment.dispose) { try { scene.environment.dispose(); } catch { /* lost */ } }
    scene.environment = pm.fromScene(envScene(), 0.03).texture;
    scene.environmentIntensity = 0.85;
    pm.dispose();
  }
  const nap = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const rink = buildRink(TIERS[tier].name, nap);
  scene.add(rink.root);

  // stones: id -> { g, blob, team }
  const blobTex = tex(cvs(128, 128, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(0.5, 'rgba(0,10,30,0.4)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); }));
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  const stones = new Map();
  function dropStone(id) { const e = stones.get(id); scene.remove(e.g, e.blob); e.blob.material.dispose(); e.g.userData.handleMat.dispose(); stones.delete(id); }
  function syncStones(state) {
    const w = state.w, seen = new Set();
    for (const s of w.stones) {
      if (s.mode === 'out' && s.out > 0.9) continue;
      let e = stones.get(s.id);
      if (e && e.team !== s.team) { dropStone(s.id); e = null; }
      if (!e) {
        const g = makeStone(s.team);
        const blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6 }));
        blob.renderOrder = 1; scene.add(g, blob); e = { g, blob, team: s.team }; stones.set(s.id, e);
      }
      seen.add(s.id);
      const dp = dispOf(state, s);
      const out = s.mode === 'out' ? clamp(s.out / 0.9, 0, 1) : 0;
      const dp0 = dp.y, k = stoneScale(dp0) * (1 - 0.9 * out);
      e.g.scale.set(k, k, k);
      e.g.position.set(dp.x, 0.002, -dp.y);
      e.g.rotation.y = dp.a;
      const sp = Math.hypot(s.vx, s.vy);
      e.blob.position.set(dp.x + 0.015, 0.004, -dp.y + 0.02); const bs = R * 3.1 * k; e.blob.scale.set(bs, 1, bs);
      e.blob.material.opacity = 0.55 * (1 - out);
      const hl = state.hl && state.hl.has(s.id) ? 0.35 + 0.3 * Math.sin(state.t * 6) : 0;
      e.g.userData.handleMat.emissiveIntensity = Math.max(hl, (s.heat ?? 0) * 0.7, sp > 0.3 ? 0 : 0);
    }
    for (const id of [...stones.keys()]) if (!seen.has(id)) dropStone(id);
  }

  let Wv = 0, Hv = 0, dprNow = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== Wv || h !== Hv || dpr !== dprNow) { Wv = w; Hv = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  // the 2D layer's pinhole (frame px) as a three.js projection onto the virtual screen (W x H); landscape = the frame turned a quarter
  function setPose(cam) {
    const p = cam.pin, f = p.f, k = p.k, ox = p.ox, oy = p.oy;
    camera.position.set(p.eye[0], p.eye[2], -p.eye[1]);
    camera.up.set(0, 1, 0);
    camera.lookAt(p.eye[0] + f[0], p.eye[2] + f[2], -(p.eye[1] + f[1]));
    camera.updateMatrixWorld(true);
    const n = 0.1, fa = 220, A = -(fa + n) / (fa - n), B = -(2 * fa * n) / (fa - n);
    if (!cam.rot) {
      camera.projectionMatrix.set((2 * k) / W, 0, -(2 * ox / W - 1), 0, 0, (2 * k) / H, -(1 - 2 * oy / H), 0, 0, 0, A, B, 0, 0, -1, 0);
    } else {
      const sh = cam.sheet, c1 = sh.x + sh.w, c2 = sh.y;
      camera.projectionMatrix.set(0, (2 * k) / W, -(2 * (c1 - oy) / W - 1), 0, -(2 * k) / H, 0, -(1 - 2 * (c2 + ox) / H), 0, 0, 0, A, B, 0, 0, -1, 0);
    }
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  let lost = false, first = true, ema = 16, frames = 0, lastNow = performance.now(), clock = 0;
  function frame(state) {
    if (lost) return;
    const play = !!(state && state.scene === 'play' && state.m && state.w);
    if (!play) { if (v3.on) { v3.on = false; canvas.style.opacity = '0'; } return; }
    resize();
    const now = performance.now(), raw = Math.max(0, (now - lastNow) / 1000), dt = Math.min(0.1, raw); lastNow = now; clock += dt;
    ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
    if (frames > 90 && ema > 32 && tier < TIERS.length - 1) { tier++; frames = 0; ema = 16; Wv = 0; }
    if (raw > 0.3 && frames > 2 && tier < TIERS.length - 1) { tier = TIERS.length - 1; frames = 0; Wv = 0; }
    const cam = makeCam(state);
    syncStones(state);
    setPose(cam);
    for (const g of rink.glows) g.material.opacity = 0.5 + 0.06 * Math.sin(clock * 1.7 + g.position.x);
    renderer.render(scene, camera);
    if (first) { first = false; window.__first3d = window.__first3d || performance.now(); }
    canvas.style.opacity = '1';
    v3.on = true;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.opacity = '0'; });
  canvas.addEventListener('webglcontextrestored', () => { try { buildEnv(); } catch { /* playable without reflections */ } lost = false; Wv = 0; first = true; });

  try {
    await nap(); buildEnv();
    await nap();
    const warm = [makeStone(0), makeStone(1)]; warm.forEach((g) => scene.add(g));
    camera.position.set(0, 3, 6); camera.lookAt(0, 0, -20); camera.updateMatrixWorld(true);
    if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera);
    warm.forEach((g) => scene.remove(g));
    await nap();
  } catch (e) { console.warn('3D init failed; 2D sheet kept', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';

  return {
    ok: true, renderer, scene, camera, THREE, rink, frame,
    get tier() { return tier; },
    setTier(t) { tier = clamp(t, 0, TIERS.length - 1); Wv = 0; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (ext) { ext.loseContext(); setTimeout(() => ext.restoreContext(), 600); } return !!ext; },
    stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tier: TIERS[tier].name, on: v3.on }),
  };
}
