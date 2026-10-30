// Pick-up Sticks 3D presenter. READS what the 2D layer published this frame (src/v3.js: table centre, scale and the stick list) and never
// writes game state. One WebGL canvas sits behind the kit's canvas; on the play screens the kit canvas is cleared and the table underneath
// is real 3D: a slate slab with a chamfered edge and copper studs on a pale ash floor in daylight, lacquered stick models (tapered turned
// bodies with value bands) casting soft shadows. The camera is orthographic and looks straight down, fitted to the layout's table, with a
// slight height shear, so a tap on the glass hits exactly the stick the 2D hit-test finds. No WebGL, or a lost context that never comes
// back: v3.on = false and the flat 2D art draws everything (three.js itself restores a lost context).
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/layout.js';
import { SR, TABLE } from '../src/sim.js';

const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 512 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const SHEAR = 0.16, SLAB = TABLE + 18, DEPTH = 16, BEV = 5, FLOOR_Y = -(DEPTH + 2 * BEV + 2);
const KIND = {
  gold: { c: 0xe9b93a, band: 0x1b130a, bands: [[-0.86, 11], [-0.52, 5], [0, 14], [0.52, 5], [0.86, 11]], rough: 0.28, metal: 0.55 },
  red: { c: 0xc2262b, band: 0xf1c255, bands: [[-0.1, 5], [0.06, 5], [0.22, 5]], rough: 0.3, metal: 0 },
  jade: { c: 0x1f9e6e, band: 0xf6f1df, bands: [[-0.5, 7], [0.5, 7]], rough: 0.25, metal: 0 },
  indigo: { c: 0x2a49ac, band: 0xdfe5f0, bands: [[0, 9]], rough: 0.3, metal: 0 },
  bamboo: { c: 0xdcbf80, band: 0x6a3d18, bands: [[-0.62, 3], [0.1, 3], [0.7, 3]], rough: 0.5, metal: 0 },
  tool: { c: 0xf0c24a, band: 0x2a1a08, bands: [[-0.85, 9], [0.85, 9]], rough: 0.25, metal: 0.6 },
};

const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
function canvasTex(w, h, paint, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
// pale ash planks with grain, seen from above
function floorTex(n) {
  return canvasTex(n, n, (g, w, h) => {
    const r = lcg(7); g.fillStyle = '#a98a5a'; g.fillRect(0, 0, w, h);
    const plank = w / 4;
    for (let p = 0; p < 4; p++) {
      const tone = 0.9 + r() * 0.2; g.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(140 * tone)},${Math.round(92 * tone)})`; g.fillRect(p * plank, 0, plank, h);
      for (let i = 0; i < 110; i++) { const x = p * plank + r() * plank, y = r() * h, l = 60 + r() * 260; g.strokeStyle = r() < 0.5 ? `rgba(110,80,40,${0.04 + r() * 0.07})` : `rgba(255,248,225,${0.05 + r() * 0.07})`; g.lineWidth = 0.6 + r() * 1.6; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 3, y + l / 3, x - 3, y + (2 * l) / 3, x + (r() - 0.5) * 6, y + l); g.stroke(); }
      g.fillStyle = 'rgba(70,48,24,0.55)'; g.fillRect(p * plank, 0, 2, h);
    }
  }, 4);
}
// dark green-blue slate with speckle, soft veins and a fine inlaid line
function slateTex(n) {
  return canvasTex(n, n, (g, w, h) => {
    const r = lcg(31), k = n / (2 * SLAB);
    const gr = g.createRadialGradient(w * 0.4, h * 0.38, w * 0.05, w / 2, h / 2, w * 0.75); gr.addColorStop(0, '#3a5d56'); gr.addColorStop(0.6, '#2a4742'); gr.addColorStop(1, '#1b3230'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(190,225,215,${0.03 + r() * 0.05})`; g.lineWidth = 0.6 + r() * 1.8; g.beginPath(); let x = r() * w, y = r() * h; g.moveTo(x, y); for (let j = 0; j < 5; j++) { x += (r() - 0.35) * w * 0.25; y += (r() - 0.5) * h * 0.18; g.lineTo(x, y); } g.stroke(); }
    for (let i = 0; i < 7000; i++) { g.fillStyle = r() < 0.5 ? `rgba(220,240,232,${0.03 + r() * 0.06})` : `rgba(0,0,0,${0.06 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); }
    g.strokeStyle = 'rgba(226,190,120,0.55)'; g.lineWidth = Math.max(1.5, 2.2 * k); const m = (SLAB - TABLE + 22) * k, q = 26 * k;
    g.beginPath(); g.moveTo(m + q, m); g.arcTo(w - m, m, w - m, h - m, q); g.arcTo(w - m, h - m, m, h - m, q); g.arcTo(m, h - m, m, m, q); g.arcTo(m, m, w - m, m, q); g.closePath(); g.stroke();
  });
}
const radial = (stops) => canvasTex(256, 256, (g) => { const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); for (const [o, c] of stops) gr.addColorStop(o, c); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); });

// A turned stick along the x axis: full radius over most of its length, rounding and tapering to a blunt tip at each end.
const TAPER = [[1, 0.84], [0.95, 0.9], [0.82, 0.925], [0.62, 0.955], [0.42, 0.985], [0.28, 0.998]];
function lathe(L, R) {
  const out = [new THREE.Vector2(0.001, -L)];
  for (let i = TAPER.length - 1; i >= 0; i--) out.push(new THREE.Vector2(R * TAPER[i][0], -L * TAPER[i][1]));
  for (let i = 0; i < TAPER.length; i++) out.push(new THREE.Vector2(R * TAPER[i][0], L * TAPER[i][1]));
  out.push(new THREE.Vector2(0.001, L));
  const g = new THREE.LatheGeometry(out, 22); g.rotateZ(-Math.PI / 2); return g;
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const qt = new URLSearchParams(location.search).get('tier'); if (qt != null && TIERS[+qt]) tier = +qt;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5a4630);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 3000);
  try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ }
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5a40, 0.5));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2); sun.position.set(-190, 660, -140); sun.target.position.set(0, 0, 0);
  Object.assign(sun.shadow.camera, { left: -460, right: 460, top: 460, bottom: -460, near: 50, far: 1400 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.6; sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  await tick();

  // ---- the table: floor, slab, studs, light pool, vignette (the top of the slab is y = 0)
  const tex = {};
  const mats = { floor: new THREE.MeshStandardMaterial({ roughness: 0.78 }), slab: new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0.04 }), edge: new THREE.MeshStandardMaterial({ color: 0x9aa7a0, roughness: 0.5, metalness: 0.05 }), stud: new THREE.MeshStandardMaterial({ color: 0xc27a45, roughness: 0.3, metalness: 0.9 }) };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), mats.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);
  const sh = new THREE.Shape(), S = SLAB, rad = 40;
  sh.moveTo(-S + rad, -S); sh.lineTo(S - rad, -S); sh.quadraticCurveTo(S, -S, S, -S + rad); sh.lineTo(S, S - rad); sh.quadraticCurveTo(S, S, S - rad, S); sh.lineTo(-S + rad, S); sh.quadraticCurveTo(-S, S, -S, S - rad); sh.lineTo(-S, -S + rad); sh.quadraticCurveTo(-S, -S, -S + rad, -S);
  const slabGeo = new THREE.ExtrudeGeometry(sh, { depth: DEPTH, bevelEnabled: true, bevelThickness: BEV, bevelSize: BEV, bevelSegments: 3, curveSegments: 10 });
  slabGeo.rotateX(Math.PI / 2);                                            // extruded along -y; the top face ends at y = +BEV
  { const uv = slabGeo.attributes.uv, pos = slabGeo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + S) / (2 * S), (pos.getZ(i) + S) / (2 * S)); }
  const slab = new THREE.Mesh(slabGeo, [mats.slab, mats.edge]); slab.castShadow = true; slab.receiveShadow = true; slab.position.y = -BEV; scene.add(slab);
  const studs = new THREE.Group();
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 3.4, 20), mats.stud); m.position.set(sx * (TABLE - 6), 1.4, sz * (TABLE - 6)); m.castShadow = true; studs.add(m); }
  scene.add(studs);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(0,0,0,0)'], [0.2, 'rgba(10,6,0,0.06)'], [0.5, 'rgba(10,6,0,0.45)'], [1, 'rgba(8,4,0,0.88)']]), transparent: true, depthWrite: false }));
  vig.rotation.x = -Math.PI / 2; vig.position.y = FLOOR_Y + 0.5; vig.renderOrder = 1; scene.add(vig);

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    for (const k of Object.keys(tex)) tex[k].dispose();
    tex.floor = floorTex(t.tex); tex.slab = slateTex(t.tex);
    mats.floor.map = tex.floor; mats.slab.map = tex.slab; mats.slab.bumpMap = tex.slab; mats.slab.bumpScale = 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();
  await tick();

  // ---- sticks (one group per live stick id; models cached per kind and length)
  const geos = new Map(), stickMats = new Map(), bandMats = new Map(), live = new Map();
  const matFor = (kind) => { let m = stickMats.get(kind); if (!m) { const k = KIND[kind] || KIND.bamboo; m = new THREE.MeshPhysicalMaterial({ color: k.c, roughness: k.rough, metalness: k.metal, clearcoat: kind === 'bamboo' ? 0.2 : 0.6, clearcoatRoughness: 0.25 }); stickMats.set(kind, m); } return m; };
  const bandFor = (kind) => { let m = bandMats.get(kind); if (!m) { m = new THREE.MeshStandardMaterial({ color: (KIND[kind] || KIND.bamboo).band, roughness: 0.4, metalness: kind === 'red' ? 0.6 : 0.1 }); bandMats.set(kind, m); } return m; };
  function makeStick(s) {
    const g = new THREE.Group(), L = s.lh, key = `${s.kind}|${L}`, k = KIND[s.kind] || KIND.bamboo;
    let geo = geos.get(key); if (!geo) { geo = lathe(L, SR); geos.set(key, geo); }
    const body = new THREE.Mesh(geo, matFor(s.kind).clone()); body.castShadow = true; body.receiveShadow = true; g.add(body);
    for (const [f, wd] of k.bands) { const bg = new THREE.CylinderGeometry(SR * 1.035, SR * 1.035, wd, 20, 1, false); bg.rotateZ(Math.PI / 2); const b = new THREE.Mesh(bg, bandFor(s.kind)); b.position.x = f * L; b.castShadow = true; g.add(b); }
    g.userData = { body, kind: s.kind, L, lift: 0 }; scene.add(g); return g;
  }
  const drop = (id, g) => { scene.remove(g); g.userData.body.material.dispose(); live.delete(id); };
  function setSticks(list, dt) {
    const seen = new Set();
    for (const s of list) {
      let g = live.get(s.id);
      if (g && (g.userData.kind !== s.kind || g.userData.L !== s.lh)) { drop(s.id, g); g = null; }
      if (!g) { g = makeStick(s); live.set(s.id, g); }
      seen.add(s.id);
      const u = g.userData; u.lift += (s.lift - u.lift) * Math.min(1, dt * 14);
      const base = s.kind === 'tool' ? SR : SR + (Math.min(s.z, 6) - 1) * 2 * SR * 0.96;
      g.position.set(s.x, base + u.lift * (s.kind === 'tool' ? 22 : 17), s.y);
      g.rotation.y = -s.a;
      const hot = Math.max(s.warn || 0, 0), f = s.fault || 0, m = u.body.material;
      m.emissive.setRGB(Math.min(1, f + hot * 0.85), Math.min(1, f * 0.25 + hot * 0.5), f * 0.18); m.emissiveIntensity = Math.max(f, hot) * 0.75;
    }
    for (const [id, g] of live) if (!seen.has(id)) drop(id, g);
  }

  // ---- camera fitted to the layout (virtual units -> css px: the kit scales the virtual area uniformly to the window)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const shear = new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, SHEAR, SHEAR * 1000, 0, 0, 1, 0, 0, 0, 0, 1);
  function place(f) {
    const W = cssW(), H = cssH(), cpu = W / meta.width, k = cpu * f.s;
    const camx = -(f.cx * cpu - W / 2) / k, camz = -(f.cy * cpu - H / 2) / k;     // the table centre lands on (cx, cy)
    camera.left = -W / (2 * k); camera.right = W / (2 * k); camera.top = H / (2 * k); camera.bottom = -H / (2 * k);
    camera.position.set(camx, 1000, camz); camera.up.set(0, 0, -1); camera.lookAt(camx, 0, camz);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    camera.projectionMatrix.multiply(shear);            // things higher above the table shift up the screen a little; the table plane stays exact
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  let lastStamp = -1, last = performance.now(), slow = 0, nf = 0, first = true;
  function resize() { const W = cssW(), H = cssH(); if (canvas.__w !== W || canvas.__h !== H) { canvas.__w = W; canvas.__h = H; renderer.setSize(W, H, false); } }
  function loop(now) {
    requestAnimationFrame(loop);
    const f = v3.frame;
    if (!f || f.stamp === lastStamp) return;
    lastStamp = f.stamp;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    resize(); place(f); setSticks(f.sticks, dt);
    renderer.render(scene, camera);
    if (first) { first = false; v3.on = true; }
    nf++; if (dt > 0.034) slow++;                                        // degrade one tier when frames stay slow
    if (nf >= 90) { if (slow > 45 && tier < 2) { tier++; applyTier(); } nf = 0; slow = 0; }
  }
  // first render of an empty table so the switch from flat to 3D never shows a blank frame
  v3.frame = v3.frame || { cx: meta.width / 2, cy: meta.height / 2, s: 1, sticks: [], stamp: ++v3.n };
  requestAnimationFrame(loop);
  canvas.addEventListener('webglcontextlost', () => { v3.on = false; }, false);
  canvas.addEventListener('webglcontextrestored', () => { applyTier(); lastStamp = -1; first = true; v3.frame = { cx: meta.width / 2, cy: meta.height / 2, s: 1, sticks: [], stamp: ++v3.n }; }, false);
  return { ok: true };
}
