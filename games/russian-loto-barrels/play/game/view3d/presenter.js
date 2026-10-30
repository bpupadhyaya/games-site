// Russian Loto 3D presenter. READS game state and the 2D layer's records (src/v3.js), never writes the sim. One WebGL canvas sits behind
// the kit's transparent 2D canvas: a parlour table under a warm lamp with the linen bag, turned birch kegs standing on end (number burned
// into the end grain), printed cards and lacquered chips. Every object the 2D code would paint is built at the same place on screen:
// its screen point is cast onto the table through the camera, its size taken from the local scale there, so the HUD, hints and taps line
// up while the table is seen in real perspective. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D art draws everything.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { drawCard, NUMFONT, THEMES } from '../src/art.js';
import { SAMPLE_CARD, SAMPLE_MARKS } from '../src/content.js';
import {
  CLOTH, clothTexture, bumpNoise, kegWoodTexture, numberAtlas, linenTexture, plankTexture, wallTexture, paperGrain, radialTex,
  kegGeometry, capGeometry, chipGeometry, bagGeometry, cardGeometry, trayGeometry, teaGlass, samovar,
} from './world.js';

const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ dpr: 2, shadow: 2048 }, { dpr: 1.5, shadow: 1024 }, { dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const CARD_T = 0.16;           // card stock thickness (cm)
const MAX_KEGS = 48, MAX_CHIPS = 220;

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search), noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const reduce = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  await tick();

  // ---------------------------------------------------------------- scene and light: one warm lamp over the table, cool window rim
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b0806); scene.fog = new THREE.Fog(0x0b0806, 260, 900);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 2000);
  const lamp = new THREE.SpotLight(0xffd9a8, 1000, 0, 0.62, 0.85, 1.6);
  lamp.shadow.bias = -0.00025; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 5;
  const hemi = new THREE.HemisphereLight(0xf2e2c8, 0x1a120a, 0.22);
  const rim = new THREE.DirectionalLight(0xa8c4ff, 0.7);
  const fill = new THREE.DirectionalLight(0xffc48a, 0.35);
  scene.add(lamp, lamp.target, hemi, rim, rim.target, fill, fill.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- materials
  const atlas = numberAtlas(NUMFONT), kegWood = kegWoodTexture(), bump = bumpNoise(256, 0.6), linen = linenTexture(), grain = paperGrain();
  const M = {
    keg: new THREE.MeshPhysicalMaterial({ map: kegWood, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.35, bumpMap: bump, bumpScale: 0.15 }),
    bag: new THREE.MeshStandardMaterial({ map: linen, roughness: 0.95, bumpMap: linen, bumpScale: 0.6, side: THREE.DoubleSide }),
    string: new THREE.MeshStandardMaterial({ color: 0xb8402c, roughness: 0.8 }),
    trayWood: new THREE.MeshPhysicalMaterial({ map: plankTexture('#6b3a18', 256, 3), roughness: 0.38, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
    trayFelt: new THREE.MeshStandardMaterial({ color: 0x163828, roughness: 1 }),
    cardEdge: new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.9 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.28 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd6a24a, metalness: 1, roughness: 0.24 }),
    china: new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: 0.25, clearcoat: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1 }),
    tea: new THREE.MeshStandardMaterial({ color: 0x8a2c08, roughness: 0.15, transparent: true, opacity: 0.88 }),
    floor: new THREE.MeshStandardMaterial({ map: plankTexture('#3a2010', 512, 6), roughness: 0.55 }),
    wall: new THREE.MeshStandardMaterial({ roughness: 0.9 }),
    cloth: new THREE.MeshStandardMaterial({ roughness: 0.97, bumpMap: bump, bumpScale: 0.25 }),
    rim: new THREE.MeshPhysicalMaterial({ roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    chip: new THREE.MeshPhysicalMaterial({ roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 }),
    blob: new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }),
    glow: new THREE.MeshBasicMaterial({ map: radialTex('255,210,120', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    dust: new THREE.MeshBasicMaterial({ map: radialTex('235,215,175', 0.7, 0.55), transparent: true, depthWrite: false }),
  };
  M.floor.map.repeat.set(6, 6);
  await tick();

  // ---------------------------------------------------------------- the room: floor, wall, table (rim + cloth), still-life props
  const room = new THREE.Group(); scene.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), M.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = -76; floor.receiveShadow = true; room.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1600, 500), M.wall); room.add(wall);
  const table = new THREE.Group(); room.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.cloth); top.receiveShadow = true; table.add(top);
  const rimMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.rim); rimMesh.receiveShadow = true; rimMesh.castShadow = true; table.add(rimMesh);
  const legs = []; for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 2.4, 72, 16), M.rim); l.castShadow = true; table.add(l); legs.push(l); }
  const still = new THREE.Group(); scene.add(still);      // menu props: tea glass and samovar
  const glassObj = teaGlass(M), samovarObj = samovar(M); still.add(glassObj, samovarObj);
  const cardTex = new Map();     // key -> CanvasTexture of a printed card (marks are chips, so it only changes with dead cells)
  let clothLook = '';
  function setLook(look) {
    if (look === clothLook) return; clothLook = look;
    const L = CLOTH[look] || CLOTH.felt;
    if (M.cloth.map) M.cloth.map.dispose(); M.cloth.map = clothTexture(look); M.cloth.needsUpdate = true;
    if (M.wall.map) M.wall.map.dispose(); M.wall.map = wallTexture(look); M.wall.map.repeat.set(10, 3); M.wall.needsUpdate = true;
    if (M.rim.map) M.rim.map.dispose(); M.rim.map = plankTexture(L.wood, 256, 2); M.rim.needsUpdate = true;
    const th = THEMES[look] || THEMES.felt; M.chip.color.set(th.chip[0]);
    M.trayFelt.color.set(L.dark); M.string.color.set(th.accent2);
    cardTex.forEach((t) => t.dispose()); cardTex.clear();
  }

  // ---------------------------------------------------------------- pools: kegs, caps, chips, cards, bag, trays, blobs
  const kegGeo = kegGeometry(), chipGeo = chipGeometry(), bagGeo = bagGeometry(), cardGeo = cardGeometry(CARD_T, 0.025), trayGeo = trayGeometry();
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const kegI = new THREE.InstancedMesh(kegGeo, M.keg, MAX_KEGS); kegI.castShadow = kegI.receiveShadow = true; kegI.frustumCulled = false; kegI.count = 0;
  const _col = new THREE.Color(1, 1, 1); for (let i = 0; i < MAX_KEGS; i++) kegI.setColorAt(i, _col); scene.add(kegI);
  const capGeos = new Map(), capMats = [];
  const caps = Array.from({ length: MAX_KEGS }, () => { const m = new THREE.Mesh(kegGeo, M.keg); m.visible = false; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); return m; });
  const capMat = (k) => { if (!capMats[k]) capMats[k] = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, emissive: 0xffc070, emissiveIntensity: 0, emissiveMap: atlas }); return capMats[k]; };
  const capGeo = (n) => { let g = capGeos.get(n); if (!g) { g = capGeometry(n); capGeos.set(n, g); } return g; };
  const chipI = new THREE.InstancedMesh(chipGeo, M.chip, MAX_CHIPS); chipI.castShadow = chipI.receiveShadow = true; chipI.frustumCulled = false; chipI.count = 0; scene.add(chipI);
  const blobI = new THREE.InstancedMesh(flatQuad, M.blob, MAX_KEGS + 8); blobI.frustumCulled = false; blobI.count = 0; blobI.renderOrder = 1; scene.add(blobI);
  const glowMesh = new THREE.Mesh(flatQuad, M.glow); glowMesh.visible = false; glowMesh.renderOrder = 2; scene.add(glowMesh);
  const dustMesh = new THREE.Mesh(flatQuad, M.dust); dustMesh.visible = false; dustMesh.renderOrder = 2; scene.add(dustMesh);
  const bags = [0, 1].map(() => {
    const g = new THREE.Group(), b = new THREE.Mesh(bagGeo, M.bag), s = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 8, 32), M.string), t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), M.string);
    b.castShadow = b.receiveShadow = true; s.rotation.x = Math.PI / 2; s.position.y = 0.83; t1.position.set(0.17, 0.72, 0.05); t1.rotation.z = 0.5; g.add(b, s, t1); g.visible = false; scene.add(g); return g;
  });
  const trays = [0, 1].map(() => {
    const g = new THREE.Group(), w = new THREE.Mesh(trayGeo, M.trayWood), f = new THREE.Mesh(flatQuad, M.trayFelt);
    w.castShadow = w.receiveShadow = true; f.receiveShadow = true; f.scale.set(0.86, 1, 0.86); f.position.y = 0.3; g.add(w, f); g.visible = false; scene.add(g); return g;
  });
  const cardMeshes = [];
  const cardMesh = (i) => { if (!cardMeshes[i]) { const m = new THREE.Mesh(cardGeo, [new THREE.MeshStandardMaterial({ roughness: 0.82 }), M.cardEdge]); m.castShadow = m.receiveShadow = true; scene.add(m); cardMeshes[i] = m; } return cardMeshes[i]; };
  function printed(rc, th, look) {
    const key = `${look}|${rc.id}|${rc.card.join(',')}|${rc.dead.map((d) => (d ? 1 : 0)).join('')}|${Math.round(rc.r.w)}x${Math.round(rc.r.h)}|${rc.r.nostrip ? 1 : 0}|${rc.label || ''}`;
    let t = cardTex.get(key); if (t) return t;
    const W = 1024, k = W / rc.r.w, H = Math.round(rc.r.h * k), c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = th.paper; x.fillRect(0, 0, W, H);
    x.save(); x.scale(k, k); v3.hold++;
    try { drawCard(x, { x: 0, y: 0, w: rc.r.w, h: rc.r.h, nostrip: rc.r.nostrip }, rc.card, th, { dead: rc.dead, label: rc.label }); } finally { v3.hold--; }
    x.restore();
    x.globalCompositeOperation = 'multiply'; x.fillStyle = x.createPattern(grain, 'repeat'); x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    const e = x.createLinearGradient(0, 0, 0, H); e.addColorStop(0, 'rgba(255,250,235,0.10)'); e.addColorStop(1, 'rgba(90,60,20,0.10)'); x.fillStyle = e; x.fillRect(0, 0, W, H);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    for (const [kk, old] of cardTex) if (kk.split('|')[1] === rc.id) { old.dispose(); cardTex.delete(kk); }
    cardTex.set(key, t); return t;
  }
  function applyTier() {
    const t = TIERS[tier]; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m) m.needsUpdate = true; }); });
  }
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera + screen <-> table mapping
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const dpr = () => kitCanvas.width / Math.max(1, kitCanvas.clientWidth || cssW());
  const cam = { E: 60, yaw: 0, fov: 30, wpp: 0.08, ax: 0, ay: 0 };
  let snap = true;
  const _v = new THREE.Vector3(), _d = new THREE.Vector3();
  function place() {
    const W = cssW(), H = cssH(), E = cam.E * D2R, Y = cam.yaw * D2R;
    const dist = cam.wpp * H / (2 * Math.tan(cam.fov * D2R / 2));
    _d.set(Math.sin(Y) * Math.cos(E), Math.sin(E), Math.cos(Y) * Math.cos(E));
    camera.fov = cam.fov; camera.aspect = W / H; camera.position.copy(_d).multiplyScalar(dist);
    camera.up.set(-Math.sin(Y) * Math.sin(E), Math.cos(E), -Math.cos(Y) * Math.sin(E)); camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, W / 2 - cam.ax, H / 2 - cam.ay, W, H);
    camera.near = Math.max(2, dist * 0.2); camera.far = dist * 6 + 900;
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function onTable(x, y, h = 0, out = new THREE.Vector3()) {      // CSS px -> point on the plane y = h
    ndc.set(x / cssW() * 2 - 1, 1 - y / cssH() * 2); ray.setFromCamera(ndc, camera); plane.constant = -h;
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, h, -400);
    return out;
  }
  const toCss = (x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(camera); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  // a record's point / size in CSS px (the record carries the canvas transform at draw time, in device px)
  const pt = (m, x, y) => { const k = dpr(); return { x: (m[0] * x + m[2] * y + m[4]) / k, y: (m[1] * x + m[3] * y + m[5]) / k }; };
  const scl = (m) => Math.hypot(m[0], m[1]) / dpr();
  const ang = (m) => Math.atan2(m[1], m[0]);
  const A = new THREE.Vector3(), B = new THREE.Vector3();
  function localScale(x, y, len) { onTable(x - len / 2, y, 0, A); onTable(x + len / 2, y, 0, B); return A.distanceTo(B) / Math.max(1e-6, len); }

  // ---------------------------------------------------------------- per-frame build from the records
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let game = null, lost = false, lastNow = 0, clock = 0, fadeIn = 0, frameAvg = 16, slow = 0, bagHeight = 0;
  const bbox = new THREE.Box3(), tb = { x0: -40, x1: 40, z0: -30, z1: 30 };
  let nk = 0, nb = 0, nChip = 0, nCard = 0, nBag = 0, nTray = 0, glowAt = null, dustAt = null;
  function addBlob(x, z, sx, sz) { if (nb >= MAX_KEGS + 8) return; _p.set(x, 0.03, z); _q.identity(); _s.set(sx, 1, sz); _m.compose(_p, _q, _s); blobI.setMatrixAt(nb++, _m); }
  function addKeg(rc) {
    if (nk >= MAX_KEGS || !rc.n) return;
    const m = rc.m, s = rc.size * scl(m), c = pt(m, rc.x, rc.y), a = rc.anim || {};
    const base = onTable(c.x, c.y + s * 0.18, 0, new THREE.Vector3()), size = s * localScale(c.x, c.y, s);
    const H = size * (a.drop !== undefined || a.settle !== undefined ? 0.74 : 0.84); let y = 0, tiltX = 0, tiltZ = 0, yaw = -ang(m);
    if (a.drop !== undefined) {            // tumbling out of the bag mouth, landing upright on the tray
      const t = a.drop, bagH = bagHeight || H * 2.2;
      y = bagH * 0.75 * (1 - t * t) + Math.sin(Math.PI * t) * H * 0.4; tiltX = (1 - t) * Math.PI * 3 * a.dir; tiltZ = (1 - t) * 0.6;
    } else if (a.settle !== undefined) {   // landed: a small hop and a rocking settle that dies away
      const cc = a.settle, dec = Math.exp(-cc * 5.5);
      y = Math.abs(Math.sin(cc * 16)) * dec * H * 0.1; tiltZ = Math.sin(cc * 17) * dec * 0.32 * a.dir; tiltX = Math.sin(cc * 13) * dec * 0.12;
      if (cc < 0.35) dustAt = { x: base.x, z: base.z, r: H * (0.8 + cc * 3), a: (1 - cc / 0.35) * 0.55 };
      glowAt = { x: base.x, z: base.z, r: H * 1.9 };
    } else if (a.air !== undefined) { y = (1 - a.air) * H * 1.6; tiltX = a.air * 7; tiltZ = a.air * 1.5; }
    else yaw += (rc.rot || 0) * 0.5;
    _e.set(tiltX, yaw, tiltZ); _q.setFromEuler(_e); _p.set(base.x, y, base.z); _s.set(H, H, H); _m.compose(_p, _q, _s);
    kegI.setMatrixAt(nk, _m);
    const dim = 1 - (rc.dim || 0) * 0.85; kegI.setColorAt(nk, _col.setRGB(dim, dim * 0.97, dim * 0.92));
    const cap = caps[nk]; cap.geometry = capGeo(rc.n); cap.material = capMat(nk); cap.material.color.setScalar(dim); cap.material.emissiveIntensity = (rc.glow || 0) * 0.35;
    cap.matrix.copy(_m); cap.matrixWorldNeedsUpdate = true; cap.visible = true;
    const shrink = 1 / (1 + y / H * 0.8);
    addBlob(base.x + H * 0.08, base.z + H * 0.1, H * 1.25 * shrink, H * 1.15 * shrink);
    bbox.expandByPoint(base);
    nk++;
  }
  function addBag(rc) {
    const g = bags[nBag++]; if (!g) return;
    const m = rc.m, s = rc.size * scl(m), c = pt(m, rc.x, rc.y), base = onTable(c.x, c.y + s * 0.34, 0, new THREE.Vector3()), H = s * localScale(c.x, c.y, s) * 0.9;
    bagHeight = H;
    g.position.copy(base); g.scale.setScalar(H); g.rotation.set(0, -0.5 - ang(m), Math.sin(rc.t * 38) * 0.06 * rc.shake + Math.sin(rc.t * 1.1) * 0.012); g.visible = true;
    addBlob(base.x + H * 0.1, base.z + H * 0.1, H * 1.1, H * 1.0);
    bbox.expandByPoint(base);
  }
  function quadOf(m, r) {    // a recorded rect -> centre, width, depth on the table, turn
    const c = pt(m, r.x + r.w / 2, r.y + r.h / 2), l = pt(m, r.x, r.y + r.h / 2), rr = pt(m, r.x + r.w, r.y + r.h / 2), t = pt(m, r.x + r.w / 2, r.y), b = pt(m, r.x + r.w / 2, r.y + r.h);
    const C0 = onTable(c.x, c.y, 0, new THREE.Vector3()), L0 = onTable(l.x, l.y, 0), R0 = onTable(rr.x, rr.y, 0), T0 = onTable(t.x, t.y, 0), B0 = onTable(b.x, b.y, 0);
    return { c: C0, w: L0.distanceTo(R0), d: T0.distanceTo(B0), yaw: -ang(m) };
  }
  function addTray(rc) {
    const g = trays[nTray++]; if (!g) return;
    const q = quadOf(rc.m, rc.r), h = Math.min(q.w, q.d) * 0.09;
    g.position.copy(q.c); g.rotation.set(0, q.yaw, 0); g.scale.set(q.w, h, q.d); g.visible = true;
    bbox.expandByPoint(q.c);
  }
  const projs = new Map(), picks = [];
  function cellGeom(r) {     // same numbers as art.js cardGeom
    const pad = Math.max(4, Math.min(r.w, r.h) * 0.03), cw = (r.w - pad * 2) / 9, strip = !r.nostrip && Math.min(r.h * 0.14, cw * 0.46) > 14 ? Math.min(r.h * 0.12, cw * 0.4) : 0;
    return { cw, ch: (r.h - pad * 2 - strip) / 3, gx: r.x + pad, gy: r.y + pad + strip };
  }
  function addCard(rc, look) {
    const i = nCard++, mesh = cardMesh(i), q = rc.world || quadOf(rc.m, rc.r), th = rc.th;
    mesh.position.set(q.c.x, 0.02, q.c.z); mesh.rotation.set(0, q.yaw, 0); mesh.scale.set(q.w, 1, q.d); mesh.visible = true;
    const t = printed(rc, th, look); if (mesh.material[0].map !== t) { mesh.material[0].map = t; mesh.material[0].needsUpdate = true; }
    mesh.material[0].color.setScalar(1 - (rc.dim || 0));
    const cy = Math.cos(q.yaw), sy = Math.sin(q.yaw), topY = CARD_T + 0.02;
    const world = (u, v, h = topY, out = _p) => { const lx = (u - 0.5) * q.w, lz = (v - 0.5) * q.d; return out.set(q.c.x + lx * cy + lz * sy, h, q.c.z - lx * sy + lz * cy); };
    const P = new THREE.Vector3();
    projs.set(rc.id, (u, v) => { world(u, v, topY, P); const o = toCss(P.x, P.y, P.z), k = dpr(); return { x: o.x * k, y: o.y * k }; });
    if (!rc.world) picks.push({ pi: rc.pi, ci: rc.ci, q, cy, sy, topY });
    bbox.expandByPoint(world(0, 0, 0, A)); bbox.expandByPoint(world(1, 1, 0, B));
    // chips on the marked cells (cell centres from the same geometry the 2D card uses)
    const g = cellGeom(rc.r);
    for (let cell = 0; cell < 27; cell++) {
      if (!rc.marks[cell] || nChip >= MAX_CHIPS) continue;
      const cx = g.gx + (cell % 9) * g.cw + g.cw / 2, cyy = g.gy + Math.floor(cell / 9) * g.ch + g.ch / 2;
      const u = (cx - rc.r.x) / rc.r.w, v = (cyy - rc.r.y) / rc.r.h, d = Math.min(g.cw / rc.r.w * q.w, g.ch / rc.r.h * q.d) * 0.84;
      const t01 = clamp((rc.chipT[cell] ?? 9) / 0.3, 0, 1), e = easeOutBack(t01), hsh = ((cell * 73 + i * 31) % 17) / 17;
      world(u + (hsh - 0.5) * 0.012, v + (((cell * 41) % 13) / 13 - 0.5) * 0.03, topY + (1 - e) * d * 2.6);
      _e.set((1 - t01) * 0.5 * (hsh - 0.5), hsh * 6, (1 - t01) * 0.4); _q.setFromEuler(_e); _s.set(d, d * 0.9, d); _m.compose(_p, _q, _s);
      chipI.setMatrixAt(nChip++, _m);
    }
  }
  v3.pick = (vx, vy) => {
    if (!v3.base) return null;
    const k = dpr(), x = (vx * v3.base.a + v3.base.e) / k, y = (vy * v3.base.d + v3.base.f) / k;
    for (let i = picks.length - 1; i >= 0; i--) {
      const p = picks[i]; onTable(x, y, p.topY, hit);
      const dx = hit.x - p.q.c.x, dz = hit.z - p.q.c.z, lx = dx * p.cy - dz * p.sy, lz = dx * p.sy + dz * p.cy;
      const u = lx / p.q.w + 0.5, v = lz / p.q.d + 0.5;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) return { pi: p.pi, ci: p.ci, u, v };
    }
    return null;
  };

  // ---------------------------------------------------------------- framing per screen
  function goalFor(sc, list) {
    const W = cssW(), H = cssH(), short = Math.min(W, H), land = W > H;
    const g = { E: 62, yaw: 0, fov: 30, wpp: 30 / short, ax: W / 2, ay: H / 2 };
    if (sc === 'play' || sc === 'auto') { g.E = land ? 56 : 64; g.fov = land ? 26 : 30; }
    else if (sc === 'duo') { g.E = 89.5; g.fov = 26; }
    else {
      const bag = list.find((r) => r.kind === 'bag');
      g.E = 44; g.fov = 30; g.yaw = reduce ? 0 : Math.sin(clock * 0.21) * 4;
      if (bag) { const c = pt(bag.m, bag.x, bag.y), s = bag.size * scl(bag.m); g.ax = c.x; g.ay = c.y + s * 0.3; g.wpp = 24 / s; }
      else g.ay = H * 0.42;
    }
    return g;
  }
  function stillLife(sc) {   // parlour still life for the menu and the reading screens: samovar behind, tea glass beside the bag
    still.visible = sc !== 'play' && sc !== 'auto' && sc !== 'duo';
    if (!still.visible) return;
    const b = bags[0].visible ? bags[0] : null, bx = b ? b.position.x : 0, bz = b ? b.position.z : 0, H = b ? b.scale.x : 24;
    samovarObj.position.set(bx + H * 1.5, 0, bz - H * 1.4); samovarObj.scale.setScalar(H / 30);
    glassObj.position.set(bx - H * 1.2, 0, bz - H * 0.6); glassObj.scale.setScalar(H / 26); glassObj.rotation.y = 0.6;
    bbox.expandByPoint(samovarObj.position); bbox.expandByPoint(glassObj.position);
    // a spare card on the cloth in front, half covered with chips, and two kegs lying beside it
    const th = THEMES[clothLook] || THEMES.felt, cw = H * 1.9;
    if (b) addCard({ kind: 'card', id: 'still', th, card: SAMPLE_CARD, dead: [], marks: SAMPLE_MARKS, chipT: [], label: '№1', pi: -1, ci: 0, r: { x: 0, y: 0, w: 600, h: 258 },
      world: { c: new THREE.Vector3(bx + H * 1.75, 0, bz + H * 0.35), w: cw, d: cw * 0.43, yaw: -0.45 } }, clothLook);
  }
  let snapTable = true, lastScene = '';
  function fitTable() {
    if (bbox.isEmpty()) bbox.set(new THREE.Vector3(-30, 0, -20), new THREE.Vector3(30, 0, 20));
    const pad = 6, g = { x0: bbox.min.x - pad, x1: bbox.max.x + pad, z0: bbox.min.z - pad * 1.6, z1: bbox.max.z + pad };
    const a = snapTable ? 1 : 0.12; for (const k of Object.keys(tb)) tb[k] += (g[k] - tb[k]) * a; snapTable = false;
    const w = tb.x1 - tb.x0, d = tb.z1 - tb.z0, cx = (tb.x0 + tb.x1) / 2, cz = (tb.z0 + tb.z1) / 2, rimW = Math.max(3, Math.min(w, d) * 0.04);
    top.scale.set(w, 1, d); top.position.set(cx, -0.5, cz);
    rimMesh.scale.set(w + rimW * 2, 4.5, d + rimW * 2); rimMesh.position.set(cx, -2.6, cz);
    M.cloth.map.repeat.set(w / 40, d / 40); if (M.rim.map) M.rim.map.repeat.set(w / 60, 1);
    legs.forEach((l, i) => l.position.set(cx + (i % 2 ? 1 : -1) * (w / 2 - 4), -40, cz + (i < 2 ? -1 : 1) * (d / 2 - 4)));
    wall.position.set(cx, 120, tb.z0 - 170);
    const span = Math.max(w, d), hgt = span * 1.2 + 40;
    lamp.position.set(cx - span * 0.22, hgt, cz + span * 0.3); lamp.target.position.set(cx, 0, cz);
    lamp.intensity = 3.4 * Math.pow(hgt, 1.6);
    lamp.angle = clamp(Math.atan(span * 0.62 / hgt), 0.3, 1.1); lamp.penumbra = 1;
    Object.assign(lamp.shadow.camera, { near: hgt * 0.4, far: hgt * 3 + 200 }); lamp.shadow.camera.updateProjectionMatrix?.();
    rim.position.set(cx + span, span * 0.6, cz - span * 1.2); rim.target.position.set(cx, 0, cz);
    fill.position.set(cx + span * 0.8, span * 0.5, cz + span); fill.target.position.set(cx, 0, cz);
  }

  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState(), sc = state.scene, list = v3.list;
    if (sc !== lastScene) { lastScene = sc; snap = true; snapTable = true; }
    setLook(state.theme);
    const goal = goalFor(sc, list), a = snap ? 1 : 1 - Math.exp(-dt * 6);
    for (const k of Object.keys(cam)) cam[k] += (goal[k] - cam[k]) * a;
    snap = false; place();
    bbox.makeEmpty(); nk = 0; nb = 0; nChip = 0; nCard = 0; nBag = 0; nTray = 0; glowAt = null; dustAt = null; projs.clear(); picks.length = 0;
    for (const b of bags) b.visible = false; for (const t of trays) t.visible = false;
    for (const rc of list) if (rc.kind === 'bag') addBag(rc);
    for (const rc of list) { if (rc.kind === 'keg') addKeg(rc); else if (rc.kind === 'tray') addTray(rc); else if (rc.kind === 'card') addCard(rc, state.theme); }
    v3.cards = projs;
    for (let i = nk; i < caps.length; i++) caps[i].visible = false;
    for (let i = nCard; i < cardMeshes.length; i++) cardMeshes[i].visible = false;

    if (glowAt) { glowMesh.visible = true; glowMesh.position.set(glowAt.x, 0.05, glowAt.z); glowMesh.scale.set(glowAt.r * 2, 1, glowAt.r * 2); glowMesh.material.opacity = 0.3 + 0.08 * Math.sin(clock * 3); } else glowMesh.visible = false;
    if (dustAt) { dustMesh.visible = true; dustMesh.position.set(dustAt.x, 0.06, dustAt.z); dustMesh.scale.set(dustAt.r * 2, 1, dustAt.r * 2); dustMesh.material.opacity = dustAt.a; } else dustMesh.visible = false;
    stillLife(sc);
    for (let i = nCard; i < cardMeshes.length; i++) cardMeshes[i].visible = false;
    kegI.count = nk; kegI.instanceMatrix.needsUpdate = true; if (kegI.instanceColor) kegI.instanceColor.needsUpdate = true;
    chipI.count = nChip; chipI.instanceMatrix.needsUpdate = true; blobI.count = nb; blobI.instanceMatrix.needsUpdate = true;
    if (still.visible) { const W = cssW(), H = cssH(); for (const [x, y] of [[0, H], [W, H], [0, H * 0.6], [W, H * 0.6]]) bbox.expandByPoint(onTable(x, y, 0, A)); }
    fitTable();
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 30 && tier < 2) { if (++slow > 90) { tier++; slow = 0; frameAvg = 16; applyTier(); } } else slow = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D without reload
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clothLook = ''; cardTex.forEach((t) => t.dispose()); cardTex.clear();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.map) m.map.needsUpdate = true; }); });
    atlas.needsUpdate = true; applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; snapTable = true;
  });

  await tick(); setLook('felt'); place();
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    post,
    get tier() { return tier; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext(ext) { ext?.restoreContext(); },
  };
}
