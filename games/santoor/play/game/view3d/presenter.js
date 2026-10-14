// Santoor 3D presenter. READS what the 2D interface layer reports into src/v3.js, never touches the simulation.
// One WebGL canvas sits behind the kit's transparent 2D canvas. The scene is the player's own view from above: a Kashmiri carpet, the
// walnut santoor with brass pins, rosewood bridges and steel and bronze strings, glowing note discs that close onto lacquered spots, the
// two mallets, marigold petals, brass oil lamps; and the interface plaques and buttons as carved walnut / lacquer slabs lit by the same
// lamp. A virtual unit is one unit of the 2D layout; the camera looks straight down at the 2D plane so text, touch and 3D line up.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D (no reload).
// Load: built in slices (await tick) AFTER the flat title is already interactive, then cross-faded in.
import { THREE, B, TAU, cv, tex, blobCanvas, rngOf, makeMats, buildSantoor, buildMallet, buildLamp, petalGeometry, starGeometry, SIDE_COL, SIDE_HI } from './models.js';
import { v3 } from '../src/v3.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const D = 3000;                                    // camera height above the plane, in virtual units
const FLOOR_AFTER_SCRIM = 150;
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas, quality = 'high', room = null }) {
  const noop = { ok: false, ready: Promise.resolve(false) };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;opacity:0;transition:opacity 0.5s ease';
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; flat 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x120808, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 1, 400, D + 400);
  let envHandle = null, key = null, M = null;
  const state = { W: 0, H: 0, vw: 0, vh: 0, dpr: 1, clock: 0, last: 0, frames: 0, ema: 16, ready: false };

  // ------------------------------------------------------------------------- slice 1: renderer, lights, environment
  await tick();
  scene.background = new THREE.Color(0x120808);
  const hemi = new THREE.HemisphereLight(0xffe2bc, 0x3a1e12, 0.5);
  key = new THREE.DirectionalLight(0xffd9a6, 2.3); key.castShadow = TIERS[tier].shadow > 0;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6; key.shadow.radius = 3;
  if (TIERS[tier].shadow) key.shadow.mapSize.set(TIERS[tier].shadow, TIERS[tier].shadow);
  const fill = new THREE.DirectionalLight(0xa9c4ff, 0.3);
  const rim = new THREE.DirectionalLight(0xffb27a, 0.7);
  scene.add(hemi, key, key.target, fill, rim, fill.target, rim.target);
  envHandle = B.createEnvironment(renderer, scene, { intensity: 0.32 });

  // ------------------------------------------------------------------------- slice 2: textures and materials
  await tick();
  M = makeMats();
  const carpetTile = 620;
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), M.carpet);
  carpet.receiveShadow = true; scene.add(carpet);
  const wallDark = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));

  // ------------------------------------------------------------------------- slice 3: shared geometry, petals, lamps, motes
  await tick();
  const petalGeo = petalGeometry();
  const mkPetals = (n, color) => { const m = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide, emissive: '#3a1400', emissiveIntensity: 0.4 }), n); m.frustumCulled = false; m.count = 0; scene.add(m); return m; };
  const rnd = rngOf(1234);
  // loose petals scattered on the carpet (static) + falling ambient petals (title and menus) + strike petals
  const SCATTER = 64, scatter = mkPetals(SCATTER, '#ffffff');
  const scatterData = Array.from({ length: SCATTER }, () => ({ u: rnd(), v: rnd(), rot: rnd() * TAU, s: 9 + rnd() * 9, c: rnd() < 0.78 ? ['#f2a33a', '#ff8a2a', '#ffc24a'][(rnd() * 3) | 0] : ['#c2412f', '#e8d9b0'][(rnd() * 2) | 0] }));
  const FALL = 22, fall = mkPetals(FALL, '#ffffff');
  const fallData = Array.from({ length: FALL }, () => ({ u: rnd(), t: rnd(), sp: 0.05 + rnd() * 0.05, ph: rnd() * TAU, s: 10 + rnd() * 8, c: ['#f2a33a', '#ff8a2a', '#ffc24a'][(rnd() * 3) | 0] }));
  const PETALS = 120, strike = mkPetals(PETALS, '#ffffff');
  const sparkTex = tex(blobCanvas('255,226,160', 1, 64));
  const SPARKS = 160;
  const sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sparkTex, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), SPARKS);
  sparks.frustumCulled = false; sparks.count = 0; sparks.renderOrder = 8; scene.add(sparks);
  const lamps = [];
  for (let i = 0; i < 2; i++) {
    const g = buildLamp(M), flame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(blobCanvas('255,200,110', 1, 64)), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    flame.renderOrder = 7; flame.position.set(10, 0, 30);
    const pl = new THREE.PointLight(0xffa860, 320, 1100, 1); pl.position.set(10, 0, 48); g.add(flame, pl);
    scene.add(g); lamps.push({ g, flame, pl, side: i ? 1 : -1 });
  }
  const MOTES = 48, motePos = new Float32Array(MOTES * 3), moteData = Array.from({ length: MOTES }, () => ({ u: rnd(), v: rnd(), z: 40 + rnd() * 260, sp: 0.01 + rnd() * 0.02, ph: rnd() * TAU }));
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: tex(blobCanvas('255,226,170', 0.9, 32)), size: 22, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, sizeAttenuation: true }));
  motes.frustumCulled = false; motes.renderOrder = 9; scene.add(motes);
  const vigC = cv(256), vx = vigC.getContext('2d'), vg = vx.createRadialGradient(128, 128, 70, 128, 128, 190);
  vg.addColorStop(0, 'rgba(6,2,2,0)'); vg.addColorStop(1, 'rgba(6,2,2,0.7)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(vigC), transparent: true, depthWrite: false, depthTest: false }));
  vig.renderOrder = 100; scene.add(vig);
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x040a0c, transparent: true, opacity: 0, depthWrite: false }));
  scrim.renderOrder = 50; scene.add(scrim);

  // ------------------------------------------------------------------------- slice 4: interface materials + pools
  await tick();
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev, U = 1) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}|${U.toFixed(2)}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5, uvScale: U }); geoCache.set(k, g); }
    return g;
  };
  const woodTex = M.walnutTex.clone(); woodTex.repeat.set(1, 1); woodTex.needsUpdate = true;
  const woodHud = new THREE.MeshPhysicalMaterial({ map: woodTex, color: '#a98562', roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.25, envMapIntensity: 0.5 });
  const leatherT = M.leather;
  const inner = new THREE.MeshPhysicalMaterial({ map: leatherT, color: '#ffffff', roughness: 0.78, clearcoat: 0.12, clearcoatRoughness: 0.5, envMapIntensity: 0.25 });
  const innerDeep = new THREE.MeshPhysicalMaterial({ map: leatherT, color: '#55666a', roughness: 0.85, envMapIntensity: 0.2 });
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const BTN = {
    primary: phys('#d65f1a', { emissive: '#5a1c04', emissiveIntensity: 0.45 }), quiet: phys('#5a3620', { clearcoat: 0.7 }), ghost: phys('#2c1c14', { clearcoat: 0.6 }),
    on: phys('#1f9c8c', { emissive: '#06362f', emissiveIntensity: 0.4 }), gold: phys('#eab649', { metalness: 0.6, roughness: 0.3 }), danger: phys('#a82a40'),
    disabled: phys('#2a2220', { clearcoat: 0.15, roughness: 0.8 }),
  };
  const ROT = Math.PI / 2;
  const panels = [], buttons = [], starsPool = [];
  const mkMesh = (g, m, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; o.receiveShadow = true; return o; };
  const emptyG = new THREE.BufferGeometry();
  function panelAt(i) {
    let p = panels[i];
    if (!p) { const g = new THREE.Group(), outer = mkMesh(emptyG, woodHud), trim = mkMesh(emptyG, M.brass), inn = mkMesh(emptyG, inner, false); g.add(outer, trim, inn); scene.add(g); p = { g, outer, trim, inn }; panels.push(p); }
    return p;
  }
  function buttonAt(i) {
    let b = buttons[i];
    if (!b) { const g = new THREE.Group(), rim = mkMesh(emptyG, M.brass), body = mkMesh(emptyG, BTN.ghost); g.add(rim, body); scene.add(g); b = { g, rim, body }; buttons.push(b); }
    return b;
  }
  const padProfile = [[0, 0], [1, 0], [1.03, 0.07], [0.97, 0.16], [0.8, 0.28], [0.48, 0.37], [0.14, 0.41], [0, 0.42]].map(([r, y]) => new THREE.Vector2(r, y));
  const padG = new THREE.LatheGeometry(padProfile, 48); padG.rotateX(ROT);
  const padMat = new THREE.MeshStandardMaterial({ color: '#d9a04a', metalness: 1, roughness: 0.3, emissive: '#ff9a3c', emissiveIntensity: 0.2, envMapIntensity: 1.5 });
  const padObj = mkMesh(padG, padMat); padObj.visible = false; scene.add(padObj);
  const starGeos = new Map();
  const starGeo = (size, filled) => { const k = `${Math.round(size)}|${filled}`; let g = starGeos.get(k); if (!g) { if (starGeos.size > 20) { for (const v of starGeos.values()) v.dispose(); starGeos.clear(); } g = starGeometry(size, filled); starGeos.set(k, g); } return g; };
  const starMatOn = new THREE.MeshStandardMaterial({ color: '#ffd24a', metalness: 1, roughness: 0.25, emissive: '#6a4400', emissiveIntensity: 0.5, envMapIntensity: 1.6 });
  const starMatOff = new THREE.MeshPhysicalMaterial({ color: '#2a2a30', roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.8 });

  // spots (engraved lacquered rings), notes (glass-lacquer cabochons + closing rings), mallets
  const ringG = new THREE.TorusGeometry(1, 0.05, 8, 48), ringThinG = new THREE.TorusGeometry(1, 0.03, 6, 40), discG = new THREE.CircleGeometry(1, 36), glowG = new THREE.PlaneGeometry(1, 1);
  const ringTex = (() => { const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 40, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c); })();
  const glowTexW = tex(blobCanvas('255,255,255', 1, 64));
  const spotPool = [];
  const SPOT_MAT = [0, 1].map((s) => ({
    ring: new THREE.MeshStandardMaterial({ color: SIDE_COL[s], emissive: SIDE_COL[s], emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.3 }),
  }));
  const brassRing = M.brass;
  const darkDisc = new THREE.MeshStandardMaterial({ color: '#1a0c05', roughness: 0.6, transparent: true, opacity: 0.38, depthWrite: false });
  function spotAt(i) {
    let s = spotPool[i];
    if (!s) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(discG, darkDisc); disc.renderOrder = 1;
      const br = new THREE.Mesh(ringG, brassRing); br.receiveShadow = true;
      const col = new THREE.Mesh(ringThinG, SPOT_MAT[0].ring.clone());
      const glow = new THREE.Mesh(glowG, new THREE.MeshBasicMaterial({ map: glowTexW, color: SIDE_COL[0], transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.renderOrder = 5;
      const fl = new THREE.Mesh(glowG, new THREE.MeshBasicMaterial({ map: ringTex, color: '#ffe6a0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); fl.renderOrder = 5;
      g.add(disc, br, col, glow, fl); scene.add(g); s = { g, disc, br, col, glow, fl }; spotPool.push(s);
    }
    return s;
  }
  const cabProfile = [[0, 0], [0.92, 0], [1, 0.07], [0.98, 0.2], [0.84, 0.36], [0.55, 0.5], [0.2, 0.57], [0, 0.58]].map(([r, y]) => new THREE.Vector2(r, y));
  const cabG = new THREE.LatheGeometry(cabProfile, 32); cabG.rotateX(ROT);
  const rollTex = (() => { const c = cv(128), x = c.getContext('2d'); x.strokeStyle = 'rgba(40,20,0,0.9)'; x.lineWidth = 11; x.lineCap = 'round'; x.beginPath(); for (let i = 0; i <= 18; i++) { const t = i / 18, xx = 24 + 80 * t, yy = 64 + Math.sin(t * Math.PI * 3) * 17; i ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); return tex(c); })();
  const NOTE_COL = { 0: ['#ffb347', '#ffe3a0', '#7a3f08'], 1: ['#35d6c0', '#cffff4', '#0b5a50'], g: ['#b9d4ff', '#ffffff', '#3a5a98'] };
  const notePool = [], holdBoxG = new THREE.BoxGeometry(0.2, 0.13, 0.05);
  const noteAt = (i) => {
    let n = notePool[i];
    if (!n) {
      const g = new THREE.Group();
      const cabMat = new THREE.MeshPhysicalMaterial({ color: '#ffb347', emissive: '#ffb347', emissiveIntensity: 0.3, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true, envMapIntensity: 0.6 });
      const cab = new THREE.Mesh(cabG, cabMat); cab.castShadow = true;
      const rimM = new THREE.MeshBasicMaterial({ color: '#fff8e2', transparent: true });
      const rimR = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.045, 6, 40), rimM);
      const closeM = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, depthWrite: false });
      const close = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 56), closeM); close.renderOrder = 6;
      const decalM = new THREE.MeshBasicMaterial({ map: rollTex, transparent: true, depthWrite: false });
      const decal = new THREE.Mesh(glowG, decalM); decal.renderOrder = 6;
      const hold = new THREE.Group(); const holdMat = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, depthWrite: false });
      const holdSegs = [];
      for (let k = 0; k < 28; k++) { const sg = new THREE.Mesh(holdBoxG, holdMat); const a = -Math.PI / 2 + (k / 28) * TAU; sg.position.set(Math.cos(a) * 1.22, -Math.sin(a) * 1.22, 0); sg.rotation.z = -a - Math.PI / 2; sg.visible = false; hold.add(sg); holdSegs.push(sg); }
      const fl = new THREE.Mesh(glowG, new THREE.MeshBasicMaterial({ map: glowTexW, color: '#fff0c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); fl.renderOrder = 7;
      g.add(cab, rimR, close, decal, hold, fl); scene.add(g); n = { g, cab, cabMat, rimR, rimM, close, closeM, decal, decalM, hold, holdSegs, holdMat, fl };
      notePool.push(n);
    }
    return n;
  };
  const malletPool = [[], []];
  const malletAt = (side, i) => { const p = malletPool[side]; if (!p[i]) { const m = buildMallet(side, M); scene.add(m); p[i] = m; } return p[i]; };

  // instruments (built on demand, cached by their rectangle)
  const instCache = new Map();
  function instFor(inst) {
    let e = instCache.get(inst.key);
    if (!e) {
      const built = buildSantoor({ hb: inst.hb, len: inst.len, rh: inst.rh, m: inst.m, half: inst.half }, M);
      built.group.traverse((o) => { if (o.isMesh && !o.castShadow && o.geometry && o.material && !o.material.transparent) o.receiveShadow = true; });
      const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(blobCanvas('0,0,0', 0.8, 64)), transparent: true, depthWrite: false, opacity: 0.8 }));
      shade.renderOrder = 1;
      const root = new THREE.Group(); root.add(built.group);
      scene.add(root);
      e = { root, built, shade, used: 0 };
      root.add(shade);
      instCache.set(inst.key, e);
      if (instCache.size > 8) { for (const [k, v] of instCache) { if (v.used !== state.frames) { scene.remove(v.root); v.built.dispose(); instCache.delete(k); if (instCache.size <= 8) break; } } }
    }
    e.used = state.frames; return e;
  }

  // ------------------------------------------------------------------------- slice 5: warm up shaders off the first frame
  await tick();
  function sizeNow(vw, vh) {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== state.W || h !== state.H || dpr !== state.dpr) { state.W = w; state.H = h; state.dpr = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
    // the kit fits the virtual view into the canvas with scale = min(W / vw, H / vh) (letterboxed beyond its max aspect)
    const scale = Math.min(w / vw, h / vh), hv = h / scale;
    camera.fov = (2 * Math.atan(hv / 2 / D) * 180) / Math.PI; camera.aspect = w / h;
    state.vw = vw; state.vh = vh;
    const cx = vw / 2, cy = -vh / 2;
    camera.position.set(cx, cy, D); camera.up.set(0, 1, 0); camera.lookAt(cx, cy, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    // carpet, vignette, scrim cover the whole canvas
    const cover = Math.max(vw, vh) * 1.5;
    carpet.scale.set(cover, cover, 1); carpet.position.set(cx, cy, 0);
    const rep = cover / carpetTile; M.carpetTex.repeat.set(rep, rep); M.carpetBump.repeat.set(rep, rep);
    M.carpetTex.offset.set(0.5 - rep / 2, 0.5 - rep / 2); M.carpetBump.offset.copy(M.carpetTex.offset);
    vig.scale.set(w / scale * 1.25, h / scale * 1.25, 1); vig.position.set(cx, cy, 800);
    scrim.scale.set(cover, cover, 1); scrim.position.set(cx, cy, 0);
    // lights
    const L = 2600, dir = new THREE.Vector3(-0.62, 0.78, 1.0).normalize();
    key.position.set(cx + dir.x * L, cy + dir.y * L, dir.z * L); key.target.position.set(cx, cy, 0);
    const half = Math.hypot(vw, vh) * 0.52;
    Object.assign(key.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 800, far: L + 900 }); key.shadow.camera.updateProjectionMatrix();
    fill.position.set(cx + 900, cy - 700, 1400); fill.target.position.set(cx, cy, 0);
    rim.position.set(cx + 1000, cy + 800, 700); rim.target.position.set(cx, cy, 0);
    return { cx, cy, scale };
  }
  // a warm-up frame with one of everything, compiled asynchronously so the first visible frame has no shader hitch
  {
    sizeNow(720, 1560);
    const ex = instFor({ key: 'warm', hb: 320, len: 900, rh: 112, m: 20, half: (ly) => 320 + (320 * 0.62 - 320) * clamp(ly / 900, 0, 1) });
    ex.root.position.set(360, -800, 0);
    const pa = panelAt(0); pa.outer.geometry = slabG(300, 200, 12, 20, 5); pa.trim.geometry = slabG(290, 190, 13, 16, 2); pa.inn.geometry = slabG(280, 180, 15, 14, 2); pa.g.position.set(360, -300, 0); pa.g.rotation.x = 0;
    for (const m of [pa.outer, pa.trim, pa.inn]) m.rotation.x = ROT;
    const nn = noteAt(0), mm = malletAt(0, 0), ss = spotAt(0); void nn; void mm; void ss;
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* compile hints only */ }
    pa.g.visible = false; ex.root.visible = false; nn.g.visible = false; mm.visible = false; ss.g.visible = false;
    for (const l of lamps) { l.g.visible = true; for (const c of l.g.children) if (c.isMesh) c.visible = false; }
  }
  await tick();

  // ------------------------------------------------------------------------- per frame
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  let camInfo = { cx: 360, cy: -780 };
  // virtual (x, y down) at height z -> world, compensating the perspective so the 3D surface lines up with the 2D plane
  const sAt = (z) => (D - z) / D;
  const wx = (x, z) => camInfo.cx + (x - camInfo.cx) * sAt(z);
  const wy = (y, z) => camInfo.cy + (-y - camInfo.cy) * sAt(z);
  const placed = [];                   // { r, top, surf?, kind } (cleared at a scrim: what follows stacks from the scrim up)
  const insts = [];                    // every instrument of this frame, for spots / notes / mallets
  const floorAt = (x, y, floor) => {
    let z = floor;
    for (const p of placed) if (x >= p.r.x && x <= p.r.x + p.r.w && y >= p.r.y && y <= p.r.y + p.r.h && p.top > z) z = p.top;
    return z;
  };
  function surfaceAt(x, y, floor) {                  // top of the instrument under (x, y), else of the panel/floor
    let best = null;
    for (const p of insts) if (x >= p.r.x && x <= p.r.x + p.r.w && y >= p.r.y && y <= p.r.y + p.r.h && (!best || p.surf > best)) best = p.surf;
    if (best !== null) return best;
    return floorAt(x, y, floor);
  }

  function placePanel(i, it, floor) {
    const p = panelAt(i), r = it.r, k = it.kind;
    p.g.visible = true;
    const U = Math.max(1, (r.w + r.h) / 2 / 420);
    const base = floorAt(r.x + r.w / 2, r.y + r.h / 2, floor);
    let dep = 12, ins = 7, top;
    p.outer.visible = p.trim.visible = true;
    if (k === 'inset') { dep = 4; p.outer.visible = false; p.trim.visible = false; p.inn.geometry = slabG(r.w, r.h, dep, Math.min(it.rad, r.h / 2 - 1), 1.6, U); p.inn.material = innerDeep; top = base + dep; }
    else {
      if (k === 'band') { dep = 9; ins = 5; }
      p.outer.geometry = slabG(r.w, r.h, dep, it.rad, 5, 2);
      p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.3, Math.max(4, it.rad - ins * 0.5), 1.4, 1);
      p.inn.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.4, Math.max(3, it.rad - ins), 2, U);
      p.inn.material = inner; p.outer.material = woodHud; top = base + dep + 2.4;
    }
    for (const m of [p.outer, p.trim, p.inn]) m.rotation.x = ROT;
    p.g.scale.set(sAt(top), sAt(top), 1);
    p.g.position.set(wx(r.x + r.w / 2, top), wy(r.y + r.h / 2, top), base);
    placed.push({ r, top, kind: 'panel' });
    return top;
  }
  function placeButton(i, it, floor, pressed) {
    const b = buttonAt(i), r = it.r;
    b.g.visible = true;
    const rad = Math.min(it.rad ?? 18, r.h / 2 - 1), base = floorAt(r.x + r.w / 2, r.y + r.h / 2, floor), dep = pressed ? 8 : 15;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4, 1);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 3), 6, 1);
    b.body.material = BTN[it.kind] ?? BTN.ghost;
    for (const m of [b.rim, b.body]) m.rotation.x = ROT;
    const top = base + dep;
    b.g.scale.set(sAt(top), sAt(top), 1);
    b.g.position.set(wx(r.x + r.w / 2, top), wy(r.y + r.h / 2, top), base);
    b.rim.position.set(0, 0, 0); b.body.position.set(0, 0, 0);
    return top;
  }

  function frame(view, dt) {
    const vw = view.width, vh = view.height;
    camInfo = sizeNow(vw, vh);
    state.clock += dt; const T = state.clock, calm = v3.calm;
    placed.length = 0; insts.length = 0;
    let floor = 0, pn = 0, bn = 0, sn = 0, scr = false;
    for (const e of instCache.values()) e.root.visible = false;
    const press = v3.pressed;
    for (const it of v3.items) {
      if (it.t === 'panel') placePanel(pn++, it, floor);
      else if (it.t === 'button') {
        const r = it.r, pressed = !!press && press.x >= r.x && press.x <= r.x + r.w && press.y >= r.y && press.y <= r.y + r.h;
        placeButton(bn++, it, floor, pressed || it.press);
      } else if (it.t === 'scrim') {
        scr = true; scrim.material.opacity = it.a; scrim.position.z = FLOOR_AFTER_SCRIM - 4; floor = FLOOR_AFTER_SCRIM; placed.length = 0;
      } else if (it.t === 'pad') {
        const g = padObj, base = floorAt(it.x, it.y, floor), e = clamp(it.pulse, 0, 1), f = clamp(it.flash, 0, 1);
        g.visible = true; g.scale.set(it.r * sAt(base + it.r * 0.4), it.r * sAt(base + it.r * 0.4), it.r * 0.9); g.position.set(wx(it.x, base + it.r * 0.4), wy(it.y, base + it.r * 0.4), base + 1);
        padMat.emissiveIntensity = 0.12 + 0.55 * e + 0.9 * f; padObj.userData.on = true;
      } else if (it.t === 'stars') {
        const gap = it.size * it.gap * 1.2, base = floorAt(it.cx, it.cy, floor);
        for (let k = 0; k < it.total; k++) {
          let s = starsPool[sn];
          if (!s) { s = new THREE.Mesh(starGeo(it.size, true), starMatOn); s.castShadow = true; s.receiveShadow = true; scene.add(s); starsPool[sn] = s; }
          const on = k < it.n; s.visible = true; s.geometry = starGeo(it.size, on); s.material = on ? starMatOn : starMatOff;
          const x = it.cx + (k - (it.total - 1) / 2) * gap;
          s.position.set(wx(x, base + 6), wy(it.cy, base + 6), base + 1);
          s.rotation.set(0, on ? Math.sin(T * 1.4 + k) * 0.25 : 0, on ? Math.sin(T * 0.9 + k * 2) * 0.05 : 0); sn++;
        }
      } else if (it.t === 'inst') {
        const inst = it.inst, e = instFor(inst), Hb = e.built.Hb, base = floorAt(inst.r.x + (it.ox ?? 0) + inst.r.w / 2, inst.r.y + (it.oy ?? 0) + inst.r.h / 2, floor);
        e.root.visible = true;
        const o = { x: it.ox ?? 0, y: it.oy ?? 0 }, O0 = inst.ptL(0, 0), O = { x: O0.x + o.x, y: O0.y + o.y }, s = sAt(base + Hb);
        const rr = { x: inst.r.x + o.x, y: inst.r.y + o.y, w: inst.r.w, h: inst.r.h };
        e.root.scale.set(s, s, 1); e.root.rotation.z = inst.vert ? 0 : -Math.PI / 2;
        e.root.position.set(wx(O.x, base + Hb), wy(O.y, base + Hb), base);
        e.built.update(it.ss, it.focus, it.hot, T);
        // soft contact shadow under the body (local frame, in front of the carpet)
        e.shade.scale.set(2 * (inst.hb + inst.m * 1.5) * 1.12, inst.len + inst.m * 3, 1); e.shade.position.set(0, inst.len / 2, 0.4 - 0);
        e.shade.position.z = 0.3;
        placed.push({ r: rr, top: base + e.built.bridgeTop, kind: 'inst' }); insts.push({ r: rr, surf: base + Hb });
      }
    }
    for (let i = pn; i < panels.length; i++) panels[i].g.visible = false;
    for (let i = bn; i < buttons.length; i++) buttons[i].g.visible = false;
    for (let i = sn; i < starsPool.length; i++) starsPool[i].visible = false;
    if (!padObj.userData.on) padObj.visible = false; padObj.userData.on = false;
    scrim.visible = scr;

    // playing spots
    let si = 0;
    for (const sp of v3.spots) {
      const z = surfaceAt(sp.x, sp.y, floor) + 0.9, s = spotAt(si++);
      s.g.visible = true; s.g.position.set(wx(sp.x, z), wy(sp.y, z), z); s.g.scale.setScalar(sp.r * 1.04 * sAt(z));
      const g = clamp(sp.glow, 0, 1);
      s.disc.scale.setScalar(0.98);
      s.col.scale.setScalar(0.64); s.col.material.color.set(SIDE_COL[sp.side]); s.col.material.emissive.set(SIDE_COL[sp.side]); s.col.material.emissiveIntensity = 0.35 + 1.4 * g;
      s.glow.scale.setScalar(2.3); s.glow.material.color.set(SIDE_COL[sp.side]); s.glow.material.opacity = 0.55 * g; s.glow.visible = g > 0.02;
      s.fl.visible = sp.flash > 0.01; if (s.fl.visible) { s.fl.scale.setScalar(2 * (1.04 + (1 - sp.flash) * 1.3) / 1.04); s.fl.material.opacity = sp.flash; }
      s.br.position.z = 0.4; s.col.position.z = 0.5;
    }
    for (let i = si; i < spotPool.length; i++) spotPool[i].g.visible = false;

    // notes: lacquered glass cabochons with a ring that closes onto the spot
    let ni = 0;
    for (const nt of v3.notes) {
      const surf = surfaceAt(nt.x, nt.y, floor), z = surf + 2.2, n = noteAt(ni++), ghost = nt.ghost, col = ghost ? NOTE_COL.g : NOTE_COL[nt.side];
      const sz = nt.kind === 'run' ? nt.r * 0.82 : nt.r * 0.94, a = clamp(nt.alpha, 0, 1), sc = sAt(z);
      n.g.visible = true; n.g.position.set(wx(nt.x, z), wy(nt.y, z), z);
      const showDisc = !nt.blind || nt.k < 0.2;
      n.cab.visible = n.rimR.visible = showDisc;
      n.cab.scale.set(sz * sc, sz * sc, sz * sc * 0.9); n.cabMat.color.set(col[0]); n.cabMat.emissive.set(col[0]); n.cabMat.emissiveIntensity = 0.3 + nt.flash * 1.2; n.cabMat.opacity = a;
      n.rimR.scale.setScalar(sz * sc); n.rimR.position.z = 0.2 * sz; n.rimM.opacity = a * 0.85;
      const closeR = nt.r * (1 + 1.7 * clamp(nt.k, 0, 1)) * sc;
      n.close.visible = !nt.blind; n.close.scale.setScalar(closeR); n.closeM.color.set(col[0]); n.closeM.opacity = a * (0.25 + 0.65 * (1 - clamp(nt.k, 0, 1)));
      n.decal.visible = nt.kind === 'roll' && showDisc; n.decal.scale.setScalar(sz * 1.15 * sc); n.decal.position.z = sz * 0.6; n.decalM.opacity = a;
      const holdN = nt.kind === 'roll' ? Math.round(clamp(nt.hold, 0, 1) * 28) : 0;
      n.hold.visible = holdN > 0; n.hold.scale.setScalar(sz * sc); n.hold.position.z = 0.4;
      for (let k = 0; k < 28; k++) n.holdSegs[k].visible = k < holdN;
      n.fl.visible = nt.flash > 0.02; n.fl.scale.setScalar(sz * 3.2 * sc * (1 + nt.flash * 0.3)); n.fl.material.opacity = 0.6 * nt.flash; n.fl.position.z = sz * 0.5;
      n.cab.castShadow = !ghost;
    }
    for (let i = ni; i < notePool.length; i++) notePool[i].g.visible = false;

    // mallets
    const used = [0, 0];
    for (const ml of v3.mallets) {
      const m = malletAt(ml.side, used[ml.side]++);
      const surf = surfaceAt(ml.x, ml.y, floor), d = clamp(ml.down, 0, 1);
      const lean = (ml.side === 0 ? -1 : 1) * 0.42;
      let dx = ml.grip.x + ml.across.x * lean, dy = ml.grip.y + ml.across.y * lean; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const tipZ = surf + 3.5 + (1 - d) * 11, elev = 0.5 - 0.16 * d, ox = dx * d * 6, oy = dy * d * 6;
      const sc = ml.scale * sAt(tipZ);
      m.visible = true; m.scale.setScalar(sc);
      m.position.set(wx(ml.x + ox, tipZ), wy(ml.y + oy, tipZ), tipZ);
      m.rotation.set(0, -elev, Math.atan2(-dy, dx), 'ZYX');
      m.userData.glow.material.opacity = clamp(ml.glow, 0, 1) * 0.9 * ml.alpha;
      m.userData.bandMat.emissiveIntensity = 0.3 + ml.glow * 0.9;
      for (const mt of m.userData.mats) mt.opacity = ml.alpha;
    }
    for (let side = 0; side < 2; side++) for (let i = used[side]; i < malletPool[side].length; i++) malletPool[side][i].visible = false;

    // particles: marigold petals and sparks from strikes
    let pc = 0, sk = 0;
    if (v3.parts && !calm) {
      for (const p of v3.parts) {
        const k = clamp(p.life / p.max, 0, 1);
        if (p.petal) {
          if (pc >= PETALS) continue;
          const z = surfaceAt(p.x, p.y, floor) + 6 + (1 - k) * 22;
          _p.set(wx(p.x, z), wy(p.y, z), z); _e.set(Math.sin(p.rot * 2) * 0.6, Math.cos(p.rot * 1.7) * 0.5, p.rot); _q.setFromEuler(_e);
          _s.set(p.size * 1.15, p.size * 2.1, 1); _m.compose(_p, _q, _s); strike.setMatrixAt(pc, _m); _c.set(p.c).multiplyScalar(0.5 + 0.5 * Math.min(1, k * 2)); strike.setColorAt(pc, _c); pc++;
        } else {
          if (sk >= SPARKS) continue;
          const z = surfaceAt(p.x, p.y, floor) + 8 + (1 - k) * 16, r = p.size * (0.4 + 0.6 * k) * 4.4;
          _p.set(wx(p.x, z), wy(p.y, z), z); _s.set(r, r, 1); _q.identity(); _m.compose(_p, _q, _s); sparks.setMatrixAt(sk, _m); sparks.setColorAt(sk, _c.setRGB(k, k * 0.85, k * 0.55)); sk++;
        }
      }
    }
    strike.count = pc; sparks.count = sk;
    strike.instanceMatrix.needsUpdate = true; sparks.instanceMatrix.needsUpdate = true;
    if (strike.instanceColor) strike.instanceColor.needsUpdate = true; if (sparks.instanceColor) sparks.instanceColor.needsUpdate = true;

    // carpet petals (static), falling petals on the menus, lamps, motes
    {
      const cx = camInfo.cx, cy = camInfo.cy, W = vw, H = vh;
      for (let i = 0; i < SCATTER; i++) {
        const d = scatterData[i];
        _p.set(cx - W / 2 + d.u * W, cy - H / 2 + d.v * H, 1.2 + (i % 3) * 0.3); _e.set(0, 0, d.rot); _q.setFromEuler(_e); _s.set(d.s * 0.9, d.s * 1.8, 1); _m.compose(_p, _q, _s);
        scatter.setMatrixAt(i, _m); scatter.setColorAt(i, _c.set(d.c));
      }
      scatter.count = SCATTER; scatter.instanceMatrix.needsUpdate = true; if (scatter.instanceColor) scatter.instanceColor.needsUpdate = true;
      const showFall = !calm && (v3.scene === 'title' || v3.scene === 'songs' || v3.scene === 'piece' || v3.scene === 'result');
      let nfall = 0;
      if (showFall) for (let i = 0; i < FALL; i++) {
        const d = fallData[i], t = (T * d.sp + d.t) % 1, x = cx - W / 2 + (d.u + Math.sin(T * 0.5 + d.ph) * 0.05) * W, y = cy + H / 2 - t * H * 1.1, z = 60 + 110 * (1 - t);
        _p.set(x, y, z); _e.set(T * 0.9 + d.ph, T * 0.7 + d.ph * 2, T * 0.6 + d.ph * 3); _q.setFromEuler(_e); _s.set(d.s, d.s * 1.9, 1); _m.compose(_p, _q, _s);
        fall.setMatrixAt(nfall, _m); fall.setColorAt(nfall, _c.set(d.c)); nfall++;
      }
      fall.count = nfall; fall.instanceMatrix.needsUpdate = true; if (fall.instanceColor) fall.instanceColor.needsUpdate = true;
      for (const l of lamps) {
        const fl = 0.86 + 0.14 * Math.sin(T * 11 + l.side) + 0.07 * Math.sin(T * 23.7 + 1.3 * l.side);
        l.g.position.set(l.side < 0 ? cx - W / 2 + 40 : cx + W / 2 - 40, cy - H / 2 + 120, 20);
        l.g.scale.setScalar(1.15);
        l.flame.scale.set(34 * (0.9 + 0.1 * fl), 52 * fl, 1); l.pl.intensity = 320 * fl;
      }
      for (let i = 0; i < MOTES; i++) {
        const d = moteData[i], t = (T * d.sp + d.v) % 1;
        motePos[i * 3] = cx - W / 2 + (d.u + Math.sin(T * 0.3 + d.ph) * 0.03) * W; motePos[i * 3 + 1] = cy - H / 2 + t * H; motePos[i * 3 + 2] = d.z;
      }
      moteGeo.attributes.position.needsUpdate = true; motes.visible = !calm;
    }

    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------------------- context loss / restore, tiers
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    state.W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }
  applyTier();
  const api = {
    ok: true, ready: null, renderer, scene, camera, tier: () => tier,
    // call once per displayed frame, after the 2D layer has reported into v3
    present(view) {
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - state.last) / 1000)); state.last = now;
      state.ema = state.ema * 0.95 + dt * 1000 * 0.05; state.frames++;
      if (state.frames > 120 && state.ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); state.frames = 0; state.ema = 16; }
      frame(view, state.paused ? 0 : dt);
    },
    activate() { v3.on = true; canvas.style.opacity = '1'; state.ready = true; },
  };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle.rebuild(); } catch { /* playable without reflections */ }
    state.W = 0; applyTier();
    for (const t of [M.walnutTex, M.walnutBump, M.carpetTex, M.carpetBump, M.leather]) t.needsUpdate = true;
    v3.on = true;
  });
  void wallDark; void room;
  api.ready = Promise.resolve(true);
  return api;
}
