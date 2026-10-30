// Dudo 3D presenter. READS what the 2D layer recorded this frame (v3.dice / v3.cups / v3.cloths, see src/v3.js), never game state it
// could change. One WebGL canvas sits behind the kit's transparent 2D canvas: a dark polished table under a warm lamp. Every die, cup and
// cloth the 2D layout asks for is placed on that table so it projects exactly where the flat art would have drawn it (a ray through the
// screen point onto the table, sized from the distance), so the HUD, the bid numbers and every tap target stay where they were.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { FACE_UP, diceMaterials, dieGeometry, makeCup, setCupTheme, clothMaterials, buildTable, buildLights, radialTex, rectShadowTex } from './world.js';

const CAP = 48, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0705);
  scene.fog = new THREE.Fog(0x0c0705, 330, 760);
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.18; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  buildTable(scene, tier);
  await tick();

  // dice: one instanced mesh; its material set is swapped when the theme changes
  let themeId = v3.theme;
  const dice = new THREE.InstancedMesh(dieGeometry(), diceMaterials(themeId), CAP);
  dice.castShadow = true; dice.receiveShadow = true; dice.frustumCulled = false; dice.count = 0;
  { const w = new THREE.Color(1, 1, 1); for (let i = 0; i < CAP; i++) dice.setColorAt(i, w); }
  scene.add(dice);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 1), transparent: true, depthWrite: false, opacity: 0.55 }), CAP + 4);
  blobs.renderOrder = 2; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);
  const glowT = radialTex('255,206,120', 1);
  const glows = Array.from({ length: 24 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: glowT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  await tick();
  // cups
  const cups = Array.from({ length: 3 }, () => { const m = makeCup(themeId); m.visible = false; scene.add(m); return m; });
  // cloths: a quad whose four corners are placed under the 2D rectangle's corners (so it projects exactly onto the rectangle)
  const quad = (mat, order) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(8), 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
    g.setIndex([0, 2, 1, 1, 2, 3]);
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; m.visible = false; m.renderOrder = order; scene.add(m); return m;
  };
  const shadowMat = new THREE.MeshBasicMaterial({ map: rectShadowTex(), transparent: true, depthWrite: false, opacity: 0.75 });
  const clothPool = Array.from({ length: 3 }, () => ({ shadow: quad(shadowMat, 1), field: quad(clothMaterials(themeId).field, 1), top: quad(clothMaterials(themeId).band, 1), bot: quad(clothMaterials(themeId).band, 1) }));
  // dust in the lamp light: slow motes drifting through the beam
  const NM = 70, mp = new Float32Array(NM * 3), seeds = [];
  for (let i = 0; i < NM; i++) seeds.push([hash(i, 1), hash(i, 2), hash(i, 3), hash(i, 4)]);
  const motesG = new THREE.BufferGeometry(); motesG.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(motesG, new THREE.PointsMaterial({ map: radialTex('255,226,180', 1, 64), size: 1.6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  motes.frustumCulled = false; scene.add(motes);

  function setTheme(id) {
    if (id === themeId) return; themeId = id;
    dice.material = diceMaterials(id);
    for (const c of cups) setCupTheme(c, id);
    const cm = clothMaterials(id);
    for (const p of clothPool) { p.field.material = cm.field; p.top.material = cm.band; p.bot.material = cm.band; }
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lights.lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lights.lamp.shadow.map) { lights.lamp.shadow.map.dispose(); lights.lamp.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.42 : 0.62;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: looking down the table at a fixed tilt; screen points -> table
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const TILT = 62 * Math.PI / 180, DIST = 300, UNITS_PER_PX = 0.18;
  let camKey = '';
  function placeCamera() {
    const k = `${cssW()}x${cssH()}`; if (k === camKey) return; camKey = k;
    camera.aspect = cssW() / cssH();
    camera.fov = 2 * Math.atan((cssH() * UNITS_PER_PX / 2) / DIST) * 180 / Math.PI;
    camera.position.set(0, Math.sin(TILT) * DIST, Math.cos(TILT) * DIST); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  // css point -> point on the horizontal plane y = h; out.k = world size of one css px there
  function onPlane(x, y, h = 0, out = new THREE.Vector3()) {
    ndc.set((x / cssW()) * 2 - 1, 1 - (y / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -h;
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, h, -2000);
    out.k = out.distanceTo(camera.position) * 2 * Math.tan(camera.fov * Math.PI / 360) / cssH();
    return out;
  }

  // ---------------------------------------------------------------- per frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _w = new THREE.Vector3(), _ax = new THREE.Vector3(), _c = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, clock = 0;
  const pxScale = () => (kitCanvas.width / Math.max(1, kitCanvas.clientWidth || cssW()));
  function pre() {
    v3.dice.length = 0; v3.cups.length = 0; v3.cloths.length = 0;
    if (game) { const st = game.getState(); v3.scene = st.scene; v3.theme = st.theme; }
  }
  function drawDice(dpr) {
    let n = 0, nb = 0, ng = 0;
    for (const d of v3.dice) {
      if (n >= CAP) break;
      const cx = d.px / dpr, cy = d.py / dpr, sPx = d.s / dpr;
      const ws = sPx * onPlane(cx, cy, 0, _p).k * 0.86;
      const p = onPlane(cx, cy, ws / 2, _w);            // aim at the die's centre, half a die above the cloth
      const hop = (d.hop || 0) * ws, tumble = d.tumble || 0;
      // orientation: the face on top, a yaw from the 2D angle, a tumble toward that rest pose, and a flip for the reveal
      _q.setFromAxisAngle(Y, -(d.yaw || 0)).multiply(FACE_UP[d.face] || FACE_UP[1]);
      if (tumble > 0.001) { _ax.set(hash(d.seed, 7) - 0.5, hash(d.seed, 8) * 0.5, hash(d.seed, 9) - 0.5).normalize(); _q2.setFromAxisAngle(_ax, Math.pow(tumble, 1.4) * (7 + hash(d.seed, 5) * 5)); _q.premultiply(_q2); }
      if (d.flip != null && d.flip < 1) { _q2.setFromAxisAngle(X, (1 - d.flip) * Math.PI * 0.5); _q.premultiply(_q2); }
      const sc = ws * (d.flip != null ? 0.6 + 0.4 * d.flip : 1);
      _s.set(sc, sc, sc); p.y = ws / 2 + hop;
      dice.setMatrixAt(n, _m.compose(p, _q, _s));
      const dim = clamp(d.dim || 0, 0, 0.85); _c.setRGB(1 - dim * 0.8, 1 - dim * 0.82, 1 - dim * 0.85); dice.setColorAt(n, _c);
      n++;
      if (nb < CAP + 4) { const bs = ws * (1.9 + (hop / ws) * 0.6); _q.identity(); _s.set(bs, 1, bs); blobs.setMatrixAt(nb++, _m.compose(_p.set(p.x + ws * 0.12, 0.6, p.z + ws * 0.1), _q, _s)); }
      if (d.glow && ng < glows.length) { const g = glows[ng++]; g.visible = true; g.position.set(p.x, 0.8, p.z); const gs = ws * 2.6; g.scale.set(gs, 1, gs); g.material.opacity = clamp(d.glow, 0, 1) * 0.9; }
    }
    dice.count = n; dice.instanceMatrix.needsUpdate = true; if (dice.instanceColor) dice.instanceColor.needsUpdate = true;
    for (; ng < glows.length; ng++) glows[ng].visible = false;
    return nb;
  }
  function drawCups(dpr, nb) {
    let k = 0;
    for (const c of v3.cups) {
      if (k >= cups.length) break;
      const m = cups[k++], cx = c.px / dpr, cy = c.py / dpr;
      const p = onPlane(cx, cy, 0, _p), w = (c.w / dpr) * p.k * 0.95, h = (c.h / dpr) * p.k * 0.95;
      m.visible = true; m.scale.set(w, h * 1.05, w);
      m.position.set(p.x, (c.lift / dpr) * p.k, p.z);
      m.rotation.set(0, 0.6, -(c.tilt || 0) * 0.9, 'ZYX');
      if (nb < CAP + 4) { const lift = m.position.y, bs = w * (1.5 + (lift / w) * 0.5); _q.identity(); _s.set(bs, 1, bs); blobs.setMatrixAt(nb++, _m.compose(_w.set(p.x + w * 0.1, 0.5, p.z + w * 0.12), _q, _s)); }
    }
    for (; k < cups.length; k++) cups[k].visible = false;
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
  }
  const corner = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  function setQuad(mesh, x, y, w, h, yy, uvf) {
    const pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([a, b], i) => { onPlane(a, b, yy, corner[i]); pos.setXYZ(i, corner[i].x, yy, corner[i].z); });
    uvf(corner, uv);
    pos.needsUpdate = true; uv.needsUpdate = true; mesh.visible = true;
  }
  const fullUv = (q, uv) => { uv.setXY(0, 0, 1); uv.setXY(1, 1, 1); uv.setXY(2, 0, 0); uv.setXY(3, 1, 0); };
  function drawCloths(dpr) {
    let k = 0;
    for (const c of v3.cloths) {
      if (k >= clothPool.length) break;
      const P = clothPool[k++], x = c.x / dpr, y = c.y / dpr, w = c.w / dpr, h = c.h / dpr;
      const tray = c.kind === 'tray', cm = clothMaterials(themeId);
      P.field.material = tray ? cm.tray : cm.field;
      setQuad(P.shadow, x - 12, y - 6, w + 24, h + 22, 0.1, fullUv);
      const T = tray ? 30 : 16;                         // the weave tiles in world units
      setQuad(P.field, x, y, w, h, 0.25, (q, uv) => q.forEach((v, i) => uv.setXY(i, v.x / T, -v.z / T)));
      if (tray) { P.top.visible = false; P.bot.visible = false; continue; }
      const bh = clamp(h * 0.03, 9, 13);
      const bandUv = (q, uv) => { const r = q[0].distanceTo(q[1]) / (q[0].distanceTo(q[2]) * 4); uv.setXY(0, 0, 1); uv.setXY(1, r, 1); uv.setXY(2, 0, 0); uv.setXY(3, r, 0); };
      setQuad(P.top, x, y, w, bh, 0.3, bandUv);
      setQuad(P.bot, x, y + h - bh, w, bh, 0.3, bandUv);
    }
    for (; k < clothPool.length; k++) { const P = clothPool[k]; P.shadow.visible = P.field.visible = P.top.visible = P.bot.visible = false; }
  }
  function drawMotes() {
    const c = onPlane(cssW() * 0.5, cssH() * 0.45, 0, _p), spread = cssH() * c.k * 0.6;
    for (let i = 0; i < NM; i++) {
      const [a, b, s, ph] = seeds[i];
      mp[i * 3] = c.x + (a - 0.5) * spread * 1.4 + Math.sin(clock * 0.3 + ph * TAU) * 4;
      mp[i * 3 + 1] = ((b * 90 + clock * (1.2 + s * 1.5)) % 90) + 8;
      mp[i * 3 + 2] = c.z + (s - 0.5) * spread + Math.cos(clock * 0.23 + ph * 9) * 4;
    }
    motesG.attributes.position.needsUpdate = true;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    setTheme(v3.theme);
    placeCamera();
    const dpr = pxScale();
    drawCups(dpr, drawDice(dpr));
    drawCloths(dpr);
    drawMotes();
    // the lamp breathes very slightly (warmth, not a flicker)
    lights.lamp.intensity = lights.base * (1 + 0.02 * Math.sin(clock * 1.7) + 0.01 * Math.sin(clock * 4.3));
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }
  lights.base = lights.lamp.intensity;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; camKey = ''; });

  await tick();
  placeCamera(); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
