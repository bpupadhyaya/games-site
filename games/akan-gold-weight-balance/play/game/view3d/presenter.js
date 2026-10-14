// Akan Gold-Weight Balance 3D presenter. READS the simulation state (game.getState()) and the records the 2D layer left in v3
// (plaques, buttons, weights, balances); never writes sim state. One WebGL canvas sits behind the kit's transparent 2D canvas.
// World = the 2D layer's virtual units (x right, y = -virtual y, z toward the viewer). The camera is off-axis: the z = 0 plane maps
// EXACTLY onto the virtual layout (hit-testing and text stay aligned) while the camera sits above and in front, so tabletops, pan
// floors and plate tops are really seen from above and parallax gives true depth.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { slotPos } from '../src/weights.js';
import * as MD from './models.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, dust: 160 },
  { name: 'medium', dpr: 1.5, shadow: 1024, dust: 110 },
  { name: 'low', dpr: 1, shadow: 0, dust: 60 },
];
const LOOKS3 = {
  dusk: { bg: 0x120a22, wall: 0x8a76aa, key: 0xffd8a0, keyI: 1.9, hemiSky: 0xffd8b0, hemiGround: 0x2a1a3a, hemi: 0.5, rim: 0x9db8ff, exposure: 0.98 },
  ember: { bg: 0x1c0a05, wall: 0xb88a68, key: 0xffc080, keyI: 2.0, hemiSky: 0xffc89a, hemiGround: 0x3a1608, hemi: 0.5, rim: 0xff9a5a, exposure: 1.04 },
  sand: { bg: 0x3a2a18, wall: 0xd8b888, key: 0xfff0d0, keyI: 2.2, hemiSky: 0xfff0d8, hemiGround: 0x6a4a28, hemi: 0.7, rim: 0xffe6b0, exposure: 1.1 },
};

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  try { await Promise.race([document.fonts.load('400 40px "Dela Gothic One"'), new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* fallback font */ }

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.autoClear = false;
  renderer.setClearColor(0x120a22, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scene, camera, light
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 10, 9000);
  const hemi = new THREE.HemisphereLight(0xffd8b0, 0x2a1a3a, 0.62);
  const key = new THREE.DirectionalLight(0xffd8a0, 2.7);
  const rim = new THREE.DirectionalLight(0x9db8ff, 1.2);
  const fillL = new THREE.DirectionalLight(0xffb070, 0.5);
  key.castShadow = true; key.shadow.bias = -0.0003; key.shadow.normalBias = 1.2; key.shadow.radius = 3;
  for (const l of [hemi, key, rim, fillL, key.target, rim.target]) l.layers.enable(1);
  scene.add(hemi, key, key.target, rim, rim.target, fillL);
  let envHandle = null;
  function buildEnv() {
    try { envHandle?.dispose?.(); envHandle = B.createEnvironment(renderer, scene, { intensity: 0.35 }); } catch (e) { /* no IBL */ }
  }
  buildEnv();

  // ---------------------------------------------------------------- backdrop: kente wall, hanging lamp, table
  const root = new THREE.Group(); scene.add(root);
  let look = '', wallTex = null;
  const wallMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, color: 0x8a76aa });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMat); wall.receiveShadow = false; root.add(wall);
  function setLook(id) {
    const want = LOOKS3[id] ? id : 'dusk';
    if (want === look && wallTex) return;
    look = want;
    wallTex?.dispose();
    wallTex = new THREE.CanvasTexture(MD.kenteCanvas(1024, 1024, 4, look)); wallTex.colorSpace = THREE.SRGBColorSpace; wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping; wallTex.anisotropy = 4;
    wallMat.map = wallTex; wallMat.needsUpdate = true;
    const L = LOOKS3[look];
    wallMat.color.setHex(L.wall); hemi.color.setHex(L.hemiSky); hemi.groundColor.setHex(L.hemiGround); hemi.intensity = L.hemi;
    key.color.setHex(L.key); key.intensity = L.keyI; rim.color.setHex(L.rim); renderer.toneMappingExposure = L.exposure; renderer.setClearColor(L.bg, 1);
  }
  setLook('dusk');

  const glowTexCache = new Map();
  const glowTex = (rgb) => { let t = glowTexCache.get(rgb); if (!t) { t = new THREE.CanvasTexture(MD.glowCanvas(rgb, 128, 1)); t.colorSpace = THREE.SRGBColorSpace; glowTexCache.set(rgb, t); } return t; };
  const sparkTex = new THREE.CanvasTexture(MD.sparkCanvas(64)); sparkTex.colorSpace = THREE.SRGBColorSpace;
  const addGlow = (rgb, opacity = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTex(rgb), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, fog: false }));
    m.renderOrder = 5; m.frustumCulled = false; return m;
  };

  const lamp = new THREE.Group(); root.add(lamp);
  const lampGlow = addGlow('255,196,110', 0.9); root.add(lampGlow);
  const glow2 = addGlow('255,150,70', 0.5); root.add(glow2);
  const glow3 = addGlow('255,210,140', 0.35); root.add(glow3);

  // table: dark wood top slab, with a woven runner under the balance
  const tableG = new THREE.Group(); root.add(tableG);
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), MD.M.wood()); tableTop.castShadow = tableTop.receiveShadow = true; tableG.add(tableTop);
  const runnerTex = new THREE.CanvasTexture(MD.runnerCanvas(9)); runnerTex.colorSpace = THREE.SRGBColorSpace; runnerTex.wrapS = runnerTex.wrapT = THREE.RepeatWrapping; runnerTex.anisotropy = 4;
  const runnerMat = new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 0.95, color: 0xb8a890 });
  const runner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), runnerMat); runner.receiveShadow = true; runner.castShadow = true; tableG.add(runner);
  tableG.visible = false;

  // drifting motes of gold dust in the lamp light
  const MOTES = 36;
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(MOTES * 3), 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: sparkTex, size: 9, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35, fog: false }));
  motes.frustumCulled = false; motes.renderOrder = 6; root.add(motes);
  const moteSeed = Array.from({ length: MOTES }, (_, i) => ({ a: MD.hash(i, 1), b: MD.hash(i, 2), c: MD.hash(i, 3), d: MD.hash(i, 4) }));

  // ---------------------------------------------------------------- HUD plaques and buttons
  const geoCache = new Map();
  const slabG = (w, h, dep, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(h)}|${dep}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 220) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, h, dep, Math.max(1, Math.min(rad, w / 2 - 0.5, h / 2 - 0.5)), bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const pm = (c, o) => new THREE.MeshStandardMaterial({ color: c, ...o });
  const brassTrim = MD.mat('hbrass', () => pm('#d9a33a', { metalness: 0.9, roughness: 0.3, envMapIntensity: 2.2 }));
  const INNER = {
    plate: MD.mat('h-plate', () => pm('#2a1a30', { roughness: 0.85 })),
    slip: MD.mat('h-slip', () => pm('#3a2412', { roughness: 0.8 })),
    fig: MD.mat('h-fig', () => pm('#1c2040', { roughness: 0.92 })),
    chip: MD.mat('h-chip', () => pm('#1a0f06', { roughness: 0.7 })),
    toast: MD.mat('h-toast', () => pm('#1d1208', { roughness: 0.7 })),
    gold: MD.mat('h-gold', () => pm('#241506', { roughness: 0.6 })),
    cell: MD.mat('h-cell', () => pm('#3a2820', { roughness: 0.8 })),
    good: MD.mat('h-good', () => pm('#2d8a52', { roughness: 0.6, emissive: '#0a3a1c', emissiveIntensity: 0.6 })),
    ghost: MD.mat('h-ghost', () => pm('#241a2a', { roughness: 0.9 })),
    tray: MD.mat('h-tray', () => pm('#1b1226', { roughness: 0.95 })),
  };
  const woodHud = MD.mat('hwood', () => B.material('darkWood', { color: '#4e2c15', color2: '#6e4224', repeat: [3, 1], seed: 31, roughness: 0.5 }));
  const btnBody = MD.mat('b-body', () => new THREE.MeshPhysicalMaterial({ color: '#3b2112', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }));
  const btnAcc = MD.mat('b-acc', () => new THREE.MeshPhysicalMaterial({ color: '#d9961a', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, emissive: '#5a2c00', emissiveIntensity: 0.2 }));
  const btnOn = MD.mat('b-on', () => new THREE.MeshPhysicalMaterial({ color: '#1f7a55', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#0a3a28', emissiveIntensity: 0.7 }));
  const btnDis = MD.mat('b-dis', () => new THREE.MeshStandardMaterial({ color: '#2a1d16', roughness: 0.8 }));
  const hudPlates = [], hudBtns = [];
  const flatQuad = new THREE.PlaneGeometry(1, 1);
  const ROT = Math.PI / 2;
  const setLayer = (g, layer) => { g.traverse((o) => { o.layers.set(layer); }); };
  function plateAt(i) {
    let p = hudPlates[i];
    if (!p) {
      const g = new THREE.Group(), o = new THREE.Mesh(flatQuad, woodHud), t = new THREE.Mesh(flatQuad, brassTrim), n = new THREE.Mesh(flatQuad, INNER.plate);
      for (const m of [o, t, n]) { m.castShadow = true; m.receiveShadow = true; m.rotation.x = ROT; g.add(m); }
      scene.add(g); p = { g, o, t, n, layer: 0 }; hudPlates.push(p);
    }
    return p;
  }
  function placePlate(i, r, rad, kind, off, clipped, zUp, base) {
    const p = plateAt(i); p.g.visible = true;
    if (kind === 'tray') {
      if (!p.ledge) { p.ledge = new THREE.Mesh(B.roundedBox(1, 1, 1, 0.3, 3), MD.M.wood()); p.ledge.castShadow = p.ledge.receiveShadow = true; p.g.add(p.ledge); setLayer(p.ledge, p.layer); }
      p.ledge.visible = base !== null; if (base !== null) { p.ledge.scale.set(r.w - 18, 11, 66); p.ledge.position.set(r.x + r.w / 2, -(base - off) - 5.5, 36); }
    } else if (p.ledge) p.ledge.visible = false;
    const w = r.w, h = r.h, cx = r.x + w / 2, cy = -(r.y - off + h / 2);
    const small = kind === 'chip' || kind === 'cell' || kind === 'good' || kind === 'ghost';
    const dep = small ? 7 : kind === 'toast' || kind === 'gold' ? 12 : 16, ins = small ? 3.5 : kind === 'tray' ? 9 : 6;
    p.o.geometry = slabG(w, h, dep, rad, small ? 2.5 : 5); p.o.position.set(cx, cy, zUp);
    p.t.geometry = slabG(w - ins * 1.1, h - ins * 1.1, dep + 1.6, Math.max(3, rad - ins * 0.5), 1.4); p.t.position.set(cx, cy, zUp);
    p.n.geometry = slabG(w - ins * 2.3, h - ins * 2.3, dep + 2.8, Math.max(2, rad - ins), 1.8); p.n.position.set(cx, cy, zUp);
    p.n.material = INNER[kind] || INNER.plate;
    p.o.material = kind === 'gold' ? brassTrim : woodHud;
    const lay = clipped ? 1 : 0;
    if (p.layer !== lay) { setLayer(p.g, lay); p.layer = lay; }
  }
  function btnAt(i) {
    let b = hudBtns[i];
    if (!b) {
      const g = new THREE.Group(), rimM = new THREE.Mesh(flatQuad, brassTrim), body = new THREE.Mesh(flatQuad, btnBody);
      for (const m of [rimM, body]) { m.castShadow = true; m.receiveShadow = true; m.rotation.x = ROT; g.add(m); }
      scene.add(g); b = { g, rim: rimM, body, layer: 0 }; hudBtns.push(b);
    }
    return b;
  }
  function placeBtn(i, bt, pressed, off, clipped, zUp) {
    const b = btnAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y - off + r.h / 2), rad = Math.min(bt.rad ?? 18, r.h / 2.2), dep = pressed ? 7 : 15;
    b.rim.geometry = slabG(r.w, r.h, dep - 2.5, rad, 3.5); b.rim.position.set(cx, cy, zUp);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 2), 5); b.body.position.set(cx, cy, zUp);
    b.body.material = bt.disabled ? btnDis : bt.accent ? btnAcc : bt.active ? btnOn : btnBody;
    b.rim.visible = !bt.ghost;
    b.g.position.set(0, pressed ? -3 : 0, 0);
    const lay = clipped ? 1 : 0;
    if (b.layer !== lay) { setLayer(b.g, lay); b.layer = lay; }
  }
  const scrimM = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050208, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scrimM.renderOrder = 20; scene.add(scrimM);

  // ---------------------------------------------------------------- weights and bags (pooled)
  const wPool = new Map();
  const bagPool = [];
  const shadowTex = new THREE.CanvasTexture(MD.glowCanvas('0,0,0', 128, 1));
  function mkExtras(g) {
    const glow = addGlow('255,216,120', 0); g.add(glow);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55, fog: false }));
    sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1; g.add(sh);
    const ped = new THREE.Mesh(B.roundedBox(1.12, 0.07, 0.62, 0.025, 3), MD.M.wood()); ped.castShadow = ped.receiveShadow = true; g.add(ped);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050208, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    shade.renderOrder = 4; g.add(shade);
    return { glow, sh, ped, shade };
  }
  function weightFor(v, n) {
    const k = String(v);
    let arr = wPool.get(k); if (!arr) { arr = []; wPool.set(k, arr); }
    while (arr.length <= n) {
      const g = new THREE.Group(), model = MD.makeWeight(v);
      g.add(model); const ex = mkExtras(g); scene.add(g); g.visible = false;
      arr.push({ g, model, ...ex, layer: 0 });
    }
    return arr[n];
  }
  function bagFor(n) {
    while (bagPool.length <= n) {
      const g = new THREE.Group(), model = MD.makeBag();
      g.add(model); const ex = mkExtras(g); scene.add(g); g.visible = false;
      bagPool.push({ g, model, ...ex, layer: 0 });
    }
    return bagPool[n];
  }
  const hideAllItems = () => { for (const arr of wPool.values()) for (const o of arr) o.g.visible = false; for (const o of bagPool) o.g.visible = false; };

  function placeItem(o, isBag, x, y, z, s, { lift = 0, glow = 0, dim = 0, stand = true, shadowOn = true, fill = 0, amount = 0, layer = 0, squash = 1 } = {}) {
    o.g.visible = true;
    o.g.position.set(x, y, z);
    o.model.scale.set(s, s * squash, s);
    // stand the piece toward the camera (partly) so a cut-out figure keeps its shape seen from above
    o.model.rotation.x = -0.4 * Math.atan2(cam.Y - y, cam.D - z);
    const lf = clamp(lift, 0, 1.5);
    o.sh.scale.set(s * 1.1, s * 0.5, 1); o.sh.position.set(0, 0.5, 0);
    o.sh.material.opacity = shadowOn ? 0.5 * (1 - lf * 0.45) : 0;
    o.ped.scale.setScalar(s); o.ped.position.y = -0.035 * s; o.ped.visible = stand && lf < 0.3 && shadowOn;
    o.glow.position.set(0, s * 0.5, -s * 0.5); o.glow.scale.set(s * 2.0, s * 2.0, 1); o.glow.material.opacity = clamp(glow, 0, 1) * 0.9;
    o.shade.scale.set(s * 1.05, s * 1.15, 1); o.shade.position.set(0, s * 0.55, s * 0.24); o.shade.material.opacity = clamp(dim, 0, 1) * 0.6;
    if (isBag) MD.setBagState(o.model, amount, fill);
    if (o.layer !== layer) { setLayer(o.g, layer); o.layer = layer; }
  }

  // ---------------------------------------------------------------- balances (pooled)
  const balances = [];
  function makeBalanceInstance() {
    const parts = MD.makeBalance(), g = new THREE.Group();
    g.add(parts); scene.add(g);
    const pans = [MD.makePan(), MD.makePan()]; for (const p of pans) scene.add(p);
    const links = [[], []];
    for (let s = 0; s < 2; s++) for (let i = 0; i < 4; i++) { const l = MD.makeLink(MD.M.brassOld()); scene.add(l); links[s].push(l); }
    const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), MD.M.gold(), 200); dust.castShadow = true; dust.count = 0; dust.frustumCulled = false; scene.add(dust);
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), MD.M.gold()); mound.castShadow = true; scene.add(mound);
    const sparks = [];
    for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.renderOrder = 6; scene.add(sp); sparks.push(sp); }
    const ladle = MD.makeLadle(); scene.add(ladle);
    const cord = MD.makeLink(MD.M.leatherDark()); scene.add(cord);
    const stream = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), MD.M.gold(), 20); stream.frustumCulled = false; stream.count = 0; scene.add(stream);
    const hot = [addGlow('140,255,190', 0), addGlow('140,255,190', 0)]; for (const h of hot) scene.add(h);
    const all = [g, ...pans, ...links.flat(), dust, mound, ...sparks, ladle, cord, stream, ...hot];
    return { g, parts, pans, links, dust, mound, sparks, ladle, cord, stream, hot, all, layer: 0 };
  }
  const balanceAt = (i) => { while (balances.length <= i) balances.push(makeBalanceInstance()); return balances[i]; };
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let clock = 0, lastSceneId = '';

  function layoutBalance(inst, rec, off, layer) {
    const { G, m } = rec, hl = G.hl, ang = G.ang, dw = G.dw;
    inst.g.visible = true;
    const zb = m.mini ? 30 : 0;
    const P = inst.parts, u = P.userData;
    P.position.set(G.piv.x, -(G.piv.y - off), zb); P.scale.setScalar(hl);
    const baseTopY = G.tableY - hl * 0.13, pillarH = Math.max(0.2, (baseTopY - G.piv.y) / hl);
    u.pillar.scale.set(1, pillarH, 1); u.pillar.position.set(0, -pillarH, 0);
    u.base.scale.set(0.72, 0.72, 0.72 * 0.45); u.base.position.set(0, -(G.tableY - G.piv.y) / hl, 0);
    u.beam.rotation.z = ang;
    if (u.needle.parent !== u.beam) { u.beam.add(u.needle); u.needle.position.set(0, 0, 0.07); }
    const ends = [G.le, G.re], centres = [G.L, G.R];
    for (let s = 0; s < 2; s++) {
      const pan = inst.pans[s], c = centres[s], e = ends[s];
      pan.visible = true; pan.position.set(c.x, -(c.y - off), zb); pan.scale.set(dw, dw * 0.35, dw);
      const hook = [e.x, -(e.y - off) - hl * 0.07, zb], cy = -(c.y - off) + dw * 0.02;
      const lugs = [[c.x - dw, cy, zb], [c.x + dw, cy, zb], [c.x, cy, zb - dw * 0.95], [c.x, cy, zb + dw * 0.95]];
      for (let i = 0; i < 4; i++) { const lk = inst.links[s][i]; MD.placeLink(lk, hook, lugs[i], Math.max(0.9, hl * 0.0085)); lk.visible = true; }
    }
    if (layer !== inst.layer) { inst.layer = layer; for (const o of inst.all) setLayer(o, layer); }
    // dust heap in the left pan (behind the weights)
    const amount = m.dust || 0, c = G.L, cy = -(c.y - off), floorY = cy - dw * 0.05, sc = TIERS[tier];
    if (amount > 0.001) {
      const hh = dw * (0.12 + 0.34 * (1 - Math.exp(-amount / 30))), wd = dw * (0.36 + 0.48 * (1 - Math.exp(-amount / 14)));
      inst.mound.visible = true; inst.mound.position.set(c.x, floorY, zb - dw * 0.3); inst.mound.scale.set(wd, hh, wd * 0.62);
      const n = Math.min(sc.dust, Math.round(clamp(10 + Math.sqrt(amount) * 12, 10, 200))), gr = Math.max(1.4, dw * 0.04);
      inst.dust.count = n; inst.dust.visible = true;
      for (let i = 0; i < n; i++) {
        const a = MD.hash(i, 7), b = MD.hash(i, 17), cc = MD.hash(i, 31);
        const a0 = a * Math.PI * 2, rr = Math.sqrt(b) * 0.97, x = Math.cos(a0) * rr * wd, zz = Math.sin(a0) * rr * wd * 0.62;
        const k = Math.max(0, 1 - rr * rr), y = floorY + hh * Math.pow(k, 0.8) * (0.92 + 0.12 * cc);
        _p.set(c.x + x, y, zb - dw * 0.3 + zz); _s.setScalar(gr * (0.6 + 0.7 * MD.hash(i, 5))); _q.identity(); _m.compose(_p, _q, _s);
        inst.dust.setMatrixAt(i, _m);
      }
      inst.dust.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < inst.sparks.length; i++) {
        const sp = inst.sparks[i], ph = Math.sin(clock * 3 + i * 1.7 + MD.hash(i, 9) * 6), a = MD.hash(i, 21) * 2 - 1;
        sp.visible = ph > 0.2 && !m.calm;
        if (sp.visible) { const xx = c.x + a * wd * 0.7, k = Math.max(0, 1 - ((xx - c.x) * (xx - c.x)) / (wd * wd)); sp.position.set(xx, floorY + hh * Math.pow(k, 0.8) + gr, -dw * 0.1); sp.scale.setScalar(dw * 0.26 * (ph - 0.1)); sp.material.opacity = ph; }
      }
    } else { inst.mound.visible = false; inst.dust.count = 0; inst.dust.visible = false; for (const sp of inst.sparks) sp.visible = false; }
    // the ladle above the left pan and its stream
    const k = rec.spout ?? 0, lx = G.L.x + dw * 0.25, ly = -(G.rect.y - off + G.chain * 0.22);
    inst.ladle.visible = !m.mini;
    inst.ladle.position.set(lx, ly, 20); inst.ladle.scale.setScalar(dw * 0.78);
    inst.ladle.rotation.z = 0.25 + 0.54 * k;
    inst.ladle.userData.gold.visible = k > 0.02;
    inst.cord.visible = false;
    if (k > 0.05 && !m.mini) {
      const top = ly - dw * 0.28, bot = -(G.L.y - off) - dw * 0.02;
      inst.stream.visible = true; inst.stream.count = 16;
      for (let i = 0; i < 16; i++) {
        const ph = ((clock * 2.2 + i / 16) % 1), yy = top + (bot - top) * ph, xx = lx - dw * 0.04 + (MD.hash(i, 3) - 0.5) * dw * 0.12;
        _p.set(xx, yy, 18); _s.setScalar(Math.max(1.4, dw * 0.026)); _m.compose(_p, _q.identity(), _s); inst.stream.setMatrixAt(i, _m);
      }
      inst.stream.instanceMatrix.needsUpdate = true;
    } else { inst.stream.visible = false; inst.stream.count = 0; }
    for (let s = 0; s < 2; s++) {
      const hs = m.hot === (s === 0 ? 'left' : 'right'), gl = inst.hot[s];
      gl.position.set(centres[s].x, -(centres[s].y - off) + dw * 0.1, -30); gl.scale.set(dw * 3.0, dw * 1.5, 1);
      gl.material.opacity = hs ? 0.75 : 0;
    }
    if (rec.table) {
      tableG.visible = true;
      const topY = -(G.tableY - off), Wd = Math.max(G.rect.w, 100), xC = G.rect.x + G.rect.w / 2, depth = Math.max(360, hl * 1.7);
      const bottom = -(G.rect.y + G.rect.h - off);
      const hgt = Math.max(60, topY - bottom + 40);
      tableTop.scale.set(Wd + 160, hgt, depth); tableTop.position.set(xC, topY - hgt / 2, 60 - depth / 2);
      const rw = Math.min(Wd * 0.9, hl * 2.6);
      runner.scale.set(rw, 3.5, depth * 0.7); runner.position.set(xC, topY + 1.8, 60 - depth * 0.5);
      tableG.userData.top = topY;
    }
  }

  // slot items on the pans (positions from the same slotPos the 2D hit-testing uses)
  function itemsOnPans(rec, off, layer) {
    const { G, m } = rec, out = [];
    for (const side of ['left', 'right']) {
      const keys = m.items?.[side] || [];
      keys.forEach((k, i) => {
        if (k === m.skip) return;
        const sp = slotPos(G, side, i, keys.length), row = sp.row || 0;
        out.push({ key: k, x: sp.x, y: -(sp.y - off), z: (m.mini ? 30 : 0) + G.dw * 0.14 - row * sp.s * 0.55, s: sp.s, glow: m.glow?.[k] ?? 0, layer, bagShown: m.bagShown, fill: m.bagFill });
      });
    }
    return out;
  }

  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }
  const cam = { D: 2000, Y: 100 };
  function setCamera(vw, vh) {
    const D = 1.7 * Math.max(vw, vh), camX = vw / 2, camY = vh * 0.12, near = D * 0.08, far = D * 4;
    cam.D = D; cam.Y = camY;
    camera.position.set(camX, camY, D);
    camera.quaternion.identity(); camera.updateMatrixWorld(true);
    const k = near / D;
    camera.projectionMatrix.makePerspective((0 - camX) * k, (vw - camX) * k, (0 - camY) * k, (-vh - camY) * k, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    key.position.set(-vw * 0.15, vh * 0.3, vh * 0.95);
    key.target.position.set(vw * 0.55, -vh * 0.5, 0);
    const ext = Math.max(vw, vh) * 0.9;
    Object.assign(key.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 10, far: Math.max(vw, vh) * 4 });
    key.shadow.camera.updateProjectionMatrix();
    rim.position.set(vw * 1.2, 0, -vh * 0.5); rim.target.position.set(vw * 0.5, -vh * 0.5, 0);
    fillL.position.set(vw * 0.9, -vh * 0.4, vh * 0.9);
    wall.position.set(vw / 2, -vh * 0.5, -380); wall.scale.set(vw * 2.1, vh * 1.9, 1);
    wallTex.repeat.set(1, 1);
  }

  // ---------------------------------------------------------------- one frame
  let lastT = 0, ema = 16, frames = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  const disp = new Map(), lastPos = new Map();

  function present(state, vw, vh, dt) {
    resize(); setLook(state.prefs?.look || 'dusk'); setCamera(vw, vh);
    clock += dt;
    const sceneId = state.scene, play = sceneId === 'play';
    if (sceneId !== lastSceneId) { disp.clear(); lastPos.clear(); lastSceneId = sceneId; }
    // lamp, glows
    const lx = vw * 0.2, lk = 1, fl = 0.92 + 0.08 * Math.sin(clock * 7.3) * Math.sin(clock * 3.1);
    lampGlow.position.set(lx, -vh * 0.04, -50); lampGlow.scale.setScalar(vh * 0.55 * fl);
    glow2.position.set(vw * 0.82, -vh * 0.2, -300); glow2.scale.setScalar(vh * 0.5 * (0.95 + 0.05 * Math.sin(clock * 2.1)));
    glow3.position.set(vw * 0.5, -vh * 0.5, -300); glow3.scale.set(vw * 1.3, vh * 0.8, 1);
    const pos = moteGeo.attributes.position;
    for (let i = 0; i < MOTES; i++) {
      const s = moteSeed[i], t = clock * (0.012 + s.c * 0.02) + s.a;
      pos.setXYZ(i, ((s.a + Math.sin(clock * 0.2 + s.b * 6) * 0.04) % 1) * vw, -((((s.b - t) % 1) + 1) % 1) * vh, -80 + s.d * 120);
    }
    pos.needsUpdate = true; motes.visible = !state.prefs?.calm;

    // plaques and buttons
    const sc0 = v3.scrimAt;
    let trayBase = null;
    for (const it of v3.items) if (it.z === 1) trayBase = Math.max(trayBase ?? -1e9, it.y);
    let n = 0;
    for (let i = 0; i < v3.panels.length; i++) {
      const p = v3.panels[i];
      placePlate(n++, p.r, p.rad, p.kind, p.clip ? p.clip.off : 0, !!p.clip, sc0 && i >= sc0.p ? 150 : 0, trayBase);
    }
    for (let i = n; i < hudPlates.length; i++) hudPlates[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (let i = 0; i < v3.buttons.length; i++) {
      const b = v3.buttons[i], off = b.clip ? b.clip.off : 0;
      const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y - off && pr.y <= b.r.y + b.r.h - off;
      placeBtn(n++, b, pressed, off, !!b.clip, 20 + (sc0 && i >= sc0.b ? 150 : 0));
    }
    for (let i = n; i < hudBtns.length; i++) hudBtns[i].g.visible = false;
    scrimM.visible = v3.scrim > 0; scrimM.material.opacity = v3.scrim; scrimM.scale.set(vw * 3, vh * 3, 1); scrimM.position.set(vw / 2, -vh / 2, 100);

    // balances
    tableG.visible = false;
    let bi = 0;
    for (const rec of v3.balances) layoutBalance(balanceAt(bi++), rec, rec.clip ? rec.clip.off : 0, rec.clip ? 1 : 0);
    for (let i = bi; i < balances.length; i++) { const b = balances[i]; for (const o of b.all) o.visible = false; b.hot.forEach((h) => { h.material.opacity = 0; }); }

    // items: pan contents first, then everything the 2D layer recorded (tray, dragged, lists, figures, slip)
    hideAllItems();
    const used = new Map(); let bagN = 0;
    const take = (isBag, v) => { if (isBag) return bagFor(bagN++); const k = String(v), c = used.get(k) ?? 0; used.set(k, c + 1); return weightFor(v, c); };
    const seen = new Set();
    const drive = (id, tx, ty, tz, s, still) => {
      if (!play || still) { disp.set(id, { tx, ty, tz, from: null, t0: -9 }); return { x: tx, y: ty, z: tz, lift: 0, sq: 1 }; }
      let d = disp.get(id);
      if (!d) { d = { tx, ty, tz, from: null, t0: -9 }; disp.set(id, d); }
      else if (Math.hypot(d.tx - tx, d.ty - ty) > 2) {
        const prev = lastPos.get(id) || { x: d.tx, y: d.ty, z: d.tz };
        if (Math.hypot(prev.x - tx, prev.y - ty) > s * 0.2) { d.from = { x: prev.x, y: prev.y, z: prev.z }; d.t0 = clock; }
        d.tx = tx; d.ty = ty; d.tz = tz;
      }
      if (d.from) {
        const r = B.pieceMoveAt(d.from, { x: tx, y: ty, z: tz }, clock - d.t0, { duration: 0.42, lift: s * 0.9, bounce: s * 0.06, settle: 0.26 });
        if (r.done) d.from = null; else return { x: r.x, y: r.y, z: r.z, lift: (r.y - ty) / s, sq: r.squash ?? 1 };
      }
      return { x: tx, y: ty, z: tz, lift: 0, sq: 1 };
    };
    for (const rec of v3.balances) {
      for (const it of itemsOnPans(rec, rec.clip ? rec.clip.off : 0, rec.clip ? 1 : 0)) {
        const isBag = it.key === 'bag', id = isBag ? 'bag' : `w${it.key}`, o = take(isBag, it.key), tw = drive(id, it.x, it.y, it.z, it.s, false);
        seen.add(id); lastPos.set(id, { x: tw.x, y: tw.y, z: tw.z });
        placeItem(o, isBag, tw.x, tw.y, tw.z, it.s, { lift: tw.lift, glow: it.glow, stand: false, shadowOn: true, layer: it.layer, amount: Math.round(it.bagShown ?? 0), fill: it.fill ?? 0, squash: tw.sq });
      }
    }
    for (const rec of v3.items) {
      const off = rec.clip ? rec.clip.off : 0, layer = rec.clip ? 1 : 0, dragging = rec.z === 2, tray = rec.z === 1, isBag = rec.k === 'bag';
      const id = isBag ? 'bag' : `w${rec.v}`, o = take(isBag, rec.v);
      const ty = -(rec.y - off) + (dragging ? rec.s * 0.16 * rec.lift : 0), z0 = dragging ? 70 : 26 + (tray ? rec.s * 0.25 : 0);
      const keyId = tray || dragging ? id : `${id}#${rec.x | 0},${rec.y | 0}`;
      const tw = drive(keyId, rec.x, ty, z0, rec.s, dragging);
      if (tray || dragging) { seen.add(id); lastPos.set(id, { x: tw.x, y: tw.y, z: tw.z }); }
      placeItem(o, isBag, tw.x, tw.y, tw.z, rec.s * (dragging ? 1.06 : 1), { lift: dragging ? 1 : tw.lift, glow: rec.glow, dim: rec.dim, stand: rec.stand && !dragging && !tray, shadowOn: rec.shadow !== false || rec.stand, layer, amount: isBag ? rec.v : 0, fill: rec.fill, squash: tw.sq });
    }
    for (const k of [...lastPos.keys()]) if (!seen.has(k)) lastPos.delete(k);
    if (disp.size > 300) disp.clear();

    // ---- draw: pass 0 = everything unclipped; pass 1 = scroll-body content under a scissor
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    camera.layers.set(0);
    renderer.render(scene, camera);
    const clips = [];
    for (const arr of [v3.panels, v3.buttons, v3.items, v3.balances]) for (const r of arr) if (r.clip && !clips.some((c) => c.x === r.clip.x && c.y === r.clip.y && c.w === r.clip.w && c.h === r.clip.h)) clips.push(r.clip);
    if (clips.length) {
      const kx = W / vw, ky = H / vh;
      camera.layers.set(1);
      for (const c of clips) {
        renderer.setScissorTest(true);
        renderer.setScissor(Math.floor(c.x * kx), Math.floor(H - (c.y + c.h) * ky), Math.ceil(c.w * kx), Math.ceil(c.h * ky));
        renderer.clearDepth();
        renderer.render(scene, camera);
      }
      renderer.setScissorTest(false);
      camera.layers.set(0);
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnv(); } catch (e) { /* no reflections, still playable */ }
    W = 0; resize();
    scene.traverse((o) => { if (o.material) { for (const mm of Array.isArray(o.material) ? o.material : [o.material]) { mm.needsUpdate = true; if (mm.map) mm.map.needsUpdate = true; if (mm.bumpMap) mm.bumpMap.needsUpdate = true; } } });
    v3.on = true;
  });

  try { applyTier(); setCamera(720, 1560); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const state = game.getState();
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.reset();
          game.render(ctx, view);
          try { present(state, view?.width ?? 720, view?.height ?? 1560, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
