// Durak 3D presenter: a card table on a dacha veranda in summer light. READS the game state (game.getState()), never writes it.
// One WebGL canvas sits behind the kit's transparent 2D canvas: scrubbed pine boards with a sage linen mat (red cross-stitch border),
// a brass samovar with a blue-and-white teapot, a tea glass in its podstakannik, cherry jam, a plate of sushki, window light and
// drifting dust. The cards themselves are 3D: dealt one at a time from the talon, the trump card lying sideways under the talon, the
// attack and its beating card overlapping on the mat, beaten pairs swept to the discard, a taken pile gathered into the taker's hand.
// The 2D canvas keeps your own hand, every panel, button and text. Positions come from the same layout as the 2D art (layout.js):
// a 2D point is cast onto the table through the camera, so every tap target stays exactly where the 2D layout put it. No WebGL,
// ?flat=1 or a lost context: v3.on = false and every screen draws the flat painted veranda; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3, covers } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor, variantOf, CARD } from '../src/layout.js';
import { drawFace, drawBack } from '../src/art.js';
import * as W from './world.js';

const { TAU, cv, rng, texOf, radialTex } = W;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);
const ease = (f) => f * f * (3 - 2 * f);
const tick = () => new Promise((r) => setTimeout(r, 0));
const K0 = 0.075;                           // cm per layout unit at the table centre (a pair card at 0.8 scale is 9 cm wide: about 1.4x a real card, for phone readability)
const CW = CARD.w, CH = CARD.h;
const FLOOR = -74;
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const HERO = [32, 24, 16, 15, 8];           // the title fan: jack of clubs, queen of diamonds, king of hearts, queen of hearts, ace of spades in front

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const noop = { ok: false };
  const iconMode = qs.has('icon');
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: iconMode }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = iconMode ? 0.62 : 0.92;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  await tick();
  // ---------------------------------------------------------------- scene, lights, environment
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x120a06); scene.fog = new THREE.Fog(0x1a0e08, 160, 380);
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 900);
  const sun = new THREE.DirectionalLight(0xffe2b4, 2.5);                         // low summer sun through the veranda window
  sun.position.set(58, 150, -40); sun.target.position.set(0, 0, 0);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -95, right: 95, top: 95, bottom: -95, near: 40, far: 330 });
  const hemi = new THREE.HemisphereLight(0xc9defc, 0x5a3a1c, 0.45);
  scene.add(sun, sun.target, hemi);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = iconMode ? 0.5 : 0.42; } catch { /* no IBL */ } };
  buildEnv();

  await tick();
  // ---------------------------------------------------------------- the table: scrubbed pine, a linen mat, the veranda floor
  const pineMat = new THREE.MeshPhysicalMaterial({ map: texOf(W.pineTexture(), { repeat: [11.8, 9.5] }), roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const tableG = new THREE.Group(); scene.add(tableG);
  const top = new THREE.Mesh(new THREE.BoxGeometry(520, 5, 420), pineMat); top.position.set(0, -2.5, 0); top.castShadow = true; top.receiveShadow = true; tableG.add(top);
  await tick();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ map: texOf(W.floorTexture(), { repeat: [60, 60] }), roughness: 0.75, color: 0xb8a090 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; scene.add(floor);
  // the mat the game is played on: its corners follow the 2D layout's mat rectangle, cast onto the table every frame
  let matKey = '', matTex = null;
  const matGeo = new THREE.BufferGeometry();
  matGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  matGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
  matGeo.setIndex([0, 2, 1, 1, 2, 3]);
  const matMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const matMesh = new THREE.Mesh(matGeo, matMat); matMesh.receiveShadow = true; matMesh.frustumCulled = false; scene.add(matMesh);
  const shGeo = matGeo.clone(); shGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  const matShadow = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false })); matShadow.frustumCulled = false; scene.add(matShadow);
  // window light on the boards (additive decal) and dust in the sunbeam
  const lightMat = new THREE.MeshBasicMaterial({ map: texOf(W.windowLightTexture()), transparent: true, opacity: 0.26, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const winLight = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), lightMat); winLight.rotation.x = -Math.PI / 2; winLight.position.y = 0.06; scene.add(winLight);
  const MOTES = 36, moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(MOTES * 3), moteSeed = [];
  { const r = rng(4); for (let i = 0; i < MOTES; i++) moteSeed.push([r(), r(), r(), r()]); }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,244,210', 0.9), size: 2.4, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); motes.frustumCulled = false; scene.add(motes);

  await tick();
  // ---------------------------------------------------------------- props
  const samovar = W.makeSamovar(); scene.add(samovar);
  const tea = W.makeTeaGlass(); scene.add(tea);
  await tick();
  const jam = W.makeJam(); scene.add(jam);
  const sushki = W.makeSushki(); scene.add(sushki);
  const steamTex = radialTex('255,255,255', 0.5);
  const mkSteam = (n) => Array.from({ length: n }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false, opacity: 0 })); s.renderOrder = 6; scene.add(s); return s; });
  const steamS = mkSteam(6), steamT = mkSteam(3);
  const glowTex = radialTex('255,255,255', 0.95, 0.5);

  await tick();
  // ---------------------------------------------------------------- cards (positions in layout units; `s` converts a layout unit to cm)
  const cardGeo = W.cardGeometry(CW, CH, 12);
  const texScale = iconMode ? 5 : 2.5;
  const faceTex = new Map(), backTexes = new Map();
  const faceTexOf = (c, four, big) => {
    const k = c * 4 + (four ? 2 : 0) + (big ? 1 : 0); let t = faceTex.get(k);
    if (!t) { const cc = cv(Math.round(CW * texScale), Math.round(CH * texScale)), x = cc.getContext('2d'); x.scale(texScale, texScale); drawFace(x, c, { four, big }); t = texOf(cc); faceTex.set(k, t); }
    return t;
  };
  const backTexOf = (theme) => {
    let t = backTexes.get(theme);
    if (!t) { const cc = cv(Math.round(CW * texScale), Math.round(CH * texScale)), x = cc.getContext('2d'); x.scale(texScale, texScale); drawBack(x, theme); t = texOf(cc); backTexes.set(theme, t); }
    return t;
  };
  const backMat = new THREE.MeshStandardMaterial({ map: backTexOf('gzhel'), roughness: 0.5 });
  let backTheme = 'gzhel';
  const backGeoDown = cardGeo.clone(); backGeoDown.rotateZ(Math.PI);
  const MAXB = 220;
  const backs = new THREE.InstancedMesh(cardGeo, backMat, MAXB); backs.count = 0; backs.frustumCulled = false; backs.receiveShadow = true; backs.castShadow = true; scene.add(backs);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.8 });
  const edges = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), edgeMat, 64); edges.count = 0; edges.frustumCulled = false; edges.castShadow = true; edges.receiveShadow = true; scene.add(edges);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: W.cardShadowTex(), transparent: true, depthWrite: false, opacity: 0.62 }), 160);
  shadows.count = 0; shadows.frustumCulled = false; shadows.renderOrder = 1; scene.add(shadows);
  const glows = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), 16);
  glows.count = 0; glows.frustumCulled = false; glows.renderOrder = 3; glows.setColorAt(0, new THREE.Color()); scene.add(glows);
  const facePool = [];
  function face(i) {
    if (!facePool[i]) {
      const g = new THREE.Group(), m = new THREE.Mesh(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 })), b = new THREE.Mesh(backGeoDown, backMat);
      m.castShadow = true; b.castShadow = true; m.receiveShadow = true; m.position.y = 0.012; g.add(m, b); g.userData = { m, key: -1 }; scene.add(g); facePool[i] = g;
    }
    return facePool[i];
  }
  let nFace = 0, nBack = 0, nEdge = 0, nShadow = 0, nGlow = 0, fourNow = false, bigNow = false;
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  // s = cm per layout unit for this card; yaw is the world yaw (a 2D clockwise rotation r is yaw = -r)
  function putFace(card, x, y, z, yaw, s, flip = 0, roll = 0) {
    const g = face(nFace++), u = g.userData, key = card * 4 + (fourNow ? 2 : 0) + (bigNow ? 1 : 0);
    if (u.key !== key) { u.key = key; u.m.material.map = faceTexOf(card, fourNow, bigNow); u.m.material.needsUpdate = true; }
    g.visible = true; g.position.set(x, y, z); g.rotation.set(0, 0, 0); g.rotateY(yaw); g.rotateZ(flip); g.rotateX(roll); g.scale.set(s, s, s);
  }
  function putBack(x, y, z, yaw, s, tiltX = 0) { if (nBack >= MAXB) return; _e.set(tiltX, yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(s, s, s); _m.compose(_p, _q, _s); backs.setMatrixAt(nBack++, _m); }
  function putEdge(x, y, z, yaw, h, s) { if (nEdge >= 64) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x, y + h / 2, z); _s.set((CW - 3) * s, h, (CH - 3) * s); _m.compose(_p, _q, _s); edges.setMatrixAt(nEdge++, _m); }
  function putShadow(x, z, yaw, s, k = 1, lift = 0) { if (nShadow >= 160) return; _e.set(0, yaw, 0, 'XYZ'); _q.setFromEuler(_e); _p.set(x + 0.4 + lift * 0.25, 0.03, z + 0.5 + lift * 0.3); _s.set(CW * 1.32 * s * k, 1, CH * 1.27 * s * k); _m.compose(_p, _q, _s); shadows.setMatrixAt(nShadow++, _m); }
  function putGlow(x, z, w, r, g, b) { if (nGlow >= 16) return; _q.identity(); _p.set(x, 0.05, z); _s.set(w, 1, w * 1.4); _m.compose(_p, _q, _s); glows.setMatrixAt(nGlow, _m); glows.setColorAt(nGlow++, _c.setRGB(r, g, b)); }

  let sizeKey = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(iconMode ? 1 : Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    sizeKey = '';
  }
  applyTier();
  for (const o of [samovar, tea, jam, sushki]) o.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });

  // ---------------------------------------------------------------- camera fitting (tilt/yaw/fov per screen; distance + off-axis shift fitted to a rectangle)
  const cur = { yaw: 0, tilt: 58, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  let snapNext = true;
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const Wc = cssW(), Hc = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = Wc / Hc; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(Wc, Hc, p.ox, p.oy, Wc, Hc); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, b) {
    const p = { ...b, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 };
    let bb = null;
    for (let it = 0; it < 7; it++) {
      place(fitCam, p);
      bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  // a 2D layout point (layout units) cast onto the horizontal plane y = h (world)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc = new THREE.Vector2();
  function onTable(vx, vy, h = 0, out = new THREE.Vector3()) {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera); plane.constant = -h;
    if (!ray.ray.intersectPlane(plane, out)) out.set(0, h, 0);
    return out;
  }
  const _k1 = new THREE.Vector3(), _k2 = new THREE.Vector3();
  const kAt = (vx, vy) => onTable(vx - 40, vy, 0, _k1).distanceTo(onTable(vx + 40, vy, 0, _k2)) / 80;    // cm per layout unit here (perspective makes it vary)

  // ---------------------------------------------------------------- framing per screen
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, viewKey = '', camMode = '', clock = 0;
  if (iconMode) kitCanvas.style.visibility = 'hidden';
  let Lc = null, anchors = null, boxW = 80, boxD = 60;
  function framing(state) {
    if (iconMode) return { yaw: -4, tilt: 40, fov: 26, dist: 50, ox: 0, oy: 0, tx: -0.5, ty: 2, tz: -2.5 };
    const drift = calm || state.calm ? 0 : 1, t = state.t;
    if (state.scene === 'title') {
      const T = Lc.title(state.saved ? 8 : 7), land = Lc.land;
      const r = land ? { x: Lc.U.x0, y: 0, w: Math.max(260, 2 * (T.word.x - Lc.U.x0)), h: Lc.h } : { x: 0, y: Lc.U.y0, w: Lc.w, h: Math.min(Lc.h * 0.7, T.cards.y + 150 - Lc.U.y0) };
      const tilt = 42; boxW = r.w * K0; boxD = clamp(boxW * (r.h / r.w) / Math.sin(tilt * D2R), 30, 220);
      const pts = [[-boxW / 2, 0, -boxD / 2], [boxW / 2, 0, -boxD / 2], [-boxW / 2, 0, boxD / 2], [boxW / 2, 0, boxD / 2]];
      return fit(rectCss(r), pts, { yaw: -5 + 5 * Math.sin(t * TAU / 26) * drift, tilt: tilt + 2 * Math.sin(t * TAU / 19) * drift, fov: 30, tx: 0, ty: 0, tz: 0 });
    }
    const oz = Lc.oppZone, tb = Lc.table, r = { x: 0, y: oz.y, w: Lc.w, h: tb.y + tb.h - oz.y }, tilt = Lc.land ? 52 : 58;
    boxW = r.w * K0; boxD = clamp(boxW * (r.h / r.w) / Math.sin(tilt * D2R), 30, 220);
    const pts = [[-boxW / 2, 0, -boxD / 2], [boxW / 2, 0, -boxD / 2], [-boxW / 2, 0, boxD / 2], [boxW / 2, 0, boxD / 2]];
    return fit(rectCss(r), pts, { yaw: 0, tilt, fov: 30, tx: 0, ty: 0, tz: 0 });
  }

  // ---------------------------------------------------------------- props placement (world anchors computed when the camera snaps)
  function computeAnchors(state) {
    if (iconMode) return { samovar: [-15, 0, -17], tea: [14, 0, -13], jam: [4, 0, -24], sushki: [-40, 0, 20], light: [-12, 0, -16], samovarS: 0.85, ps: 1 };
    if (state.scene === 'title') {
      const T = Lc.title(state.saved ? 8 : 7), a = onTable(Lc.w * 0.2, T.word.y - 88, 0, new THREE.Vector3()), b = onTable(Lc.w * (Lc.land ? 0.4 : 0.8), T.word.y - 70, 0, new THREE.Vector3()), c = onTable(Lc.w * (Lc.land ? 0.34 : 0.62), T.word.y - 100, 0, new THREE.Vector3());
      const d = onTable(Lc.land ? T.word.x - 190 : Lc.w * 0.1, T.cards.y + 24, 0, new THREE.Vector3());
      return { samovar: [a.x, 0, a.z], tea: [b.x, 0, b.z], jam: [c.x, 0, c.z], sushki: [d.x, 0, d.z], light: [a.x + 20, 0, a.z + 8], samovarS: 0.62, ps: 1 };
    }
    // a still life along the far edge of the table, in the strip between the top bar and the opponents (screen anchors cast once per snap)
    const y = Math.max(Lc.U.y0 + 60, Lc.oppZone.y - (Lc.land ? 6 : 78)), at = (fx, dy = 0) => onTable(Lc.w * fx, y + dy, 0, new THREE.Vector3());
    const a = at(Lc.land ? 0.27 : 0.1, 6), b = at(Lc.land ? 0.66 : 0.9, 10), c = at(Lc.land ? 0.4 : 0.3, 16), d = at(Lc.land ? 0.55 : 0.7, 20), l = at(Lc.land ? 0.72 : 0.7, -10);
    return { samovar: [a.x, 0, a.z], tea: [b.x, 0, b.z], jam: [c.x, 0, c.z], sushki: [d.x, 0, d.z], light: [l.x, 0, l.z], samovarS: 0.5, ps: 0.72 };
  }
  function placeProps() {
    const A = anchors;
    samovar.position.set(A.samovar[0], 0, A.samovar[2]); samovar.scale.setScalar(A.samovarS); samovar.rotation.y = 0.5;
    tea.position.set(A.tea[0], 0, A.tea[2]); tea.rotation.y = -0.6; tea.scale.setScalar(1.25 * (A.ps || 1));
    jam.position.set(A.jam[0], 0, A.jam[2]); jam.rotation.y = 0.3; jam.scale.setScalar(1.1 * (A.ps || 1));
    sushki.position.set(A.sushki[0], 0, A.sushki[2]); sushki.rotation.y = 0.8; sushki.scale.setScalar(1.05 * (A.ps || 1));
    winLight.position.x = A.light[0]; winLight.position.z = A.light[2]; winLight.rotation.z = 0.5;
  }

  // ---------------------------------------------------------------- per-match memory: what is new on the table, the deal, sweeps
  let lastG = null, prevSig = null, flights = [], sweeps = [], dealing = null;
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
  const sigOf = (g) => ({ hands: g.hands.map((h) => h.length), mine: new Set(g.hands[0]), table: new Set(g.table.flatMap((p) => (p.d >= 0 ? [p.a, p.d] : [p.a]))), tableList: g.table.map((p) => ({ a: p.a, d: p.d })), discard: g.discard.length });
  const isFresh = (g) => g.discard.length === 0 && g.table.length === 0 && g.stock.length === 36 - 6 * g.n;
  function track(g, now) {
    const sg = sigOf(g);
    if (g !== lastG) { lastG = g; flights = []; sweeps = []; dealing = isFresh(g) && !iconMode ? { t: 0 } : null; v3.dealing = !!dealing; prevSig = sg; return; }
    if (prevSig) {
      // a card that appeared on the table: from your hand, or from the seat whose hand got smaller
      for (const c of sg.table) if (!prevSig.table.has(c)) {
        let from;
        if (prevSig.mine.has(c)) from = { mine: true };
        else { const k = sg.hands.findIndex((n, i) => i > 0 && n < prevSig.hands[i]); from = { seat: k > 0 ? k : 1 }; }
        flights.push({ c, from, t0: now, dur: 0.36 });
      }
      // beaten pairs swept to the discard (the table emptied and the discard grew; a taken pile goes through state.pickup)
      if (prevSig.tableList.length && !sg.tableList.length && sg.discard > prevSig.discard) sweeps.push({ cards: prevSig.tableList.flatMap((p, i) => (p.d >= 0 ? [{ c: p.a, i, d: 0 }, { c: p.d, i, d: 1 }] : [{ c: p.a, i, d: 0 }])), t0: now, dur: 0.7 });
    }
    prevSig = sg;
    flights = flights.filter((f) => now - f.t0 < f.dur + 0.05); sweeps = sweeps.filter((s) => now - s.t0 < s.dur + 0.05);
  }
  const seatPos = (seat, n, out) => { const sp = Lc.seat(n, seat); return onTable(sp.x, sp.y, 0, out); };

  function pre() {
    if (!game || lost) return;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) return;
    Lc = layoutFor(meta.width, meta.height, variantOf(state.scene));
    const mode = state.scene === 'title' ? 'title' : 'play';
    const vk = `${cssW()}x${cssH()}|${Lc.key}`;
    if (vk !== viewKey || mode !== camMode) { viewKey = vk; camMode = mode; snapNext = true; }
    const goal = framing(state);
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const a = snapNext ? 1 : 1 - Math.exp(-dt * 6);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    place(camera, cur);
    if (snapNext) {
      // anchor the props in world space once the camera has settled on this screen (the hero drift then moves camera and props together)
      const keep = { ...cur }; Object.assign(cur, goal); place(camera, cur); anchors = computeAnchors(state); Object.assign(cur, keep); place(camera, cur); placeProps(); snapNext = false;
    }
  }

  const stackH = 0.05;
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const state = game.getState();
    if (!covers(state.scene) && !iconMode) { canvas.style.visibility = 'hidden'; v3.dealing = false; return; }
    canvas.style.visibility = 'visible';
    if (!Lc || !anchors) return;
    const t = state.t, title = state.scene === 'title' || iconMode;
    nFace = 0; nBack = 0; nEdge = 0; nShadow = 0; nGlow = 0;
    fourNow = !!state.four; bigNow = !!state.big;
    if ((state.back || 'gzhel') !== backTheme) { backTheme = state.back || 'gzhel'; backMat.map = backTexOf(backTheme); backMat.needsUpdate = true; }
    tableG.position.z = -boxD / 2 - 34 + 210;                       // the table's far edge sits 34 cm beyond the top of the play region
    matMesh.visible = !title; matShadow.visible = !title;

    if (title) {
      const T = Lc.title(state.saved ? 8 : 7), cs = T.cards.scale;
      const piv = onTable(T.cards.x, T.cards.y + 40 * cs, 0, _a), s = kAt(T.cards.x, T.cards.y) * cs;
      if (iconMode) {
        HERO.forEach((c, i) => { const a = (i - 2) * 0.27, sc = 0.06, L0 = CH * 0.42 * sc; const x = Math.sin(a) * L0 * 1.5, z = -Math.cos(a) * L0 * 0.9 + 4.5; putFace(c, x, 0.05 + i * 0.05, z, -a, sc); putShadow(x, z, -a, sc); });
      } else {
        const px = piv.x, pz = piv.z;
        HERO.forEach((c, i) => {
          const a = (i - 2) * 0.2 + (calm || state.calm ? 0 : Math.sin(t * 0.7 + i) * 0.006), L0 = CH * 0.55 * s * 1.15;
          const x = px + Math.sin(a) * L0, z = pz - Math.cos(a) * L0 + CH * 0.3 * s; putFace(c, x, 0.05 + i * 0.045, z, -a, s * 1.15); putShadow(x, z, -a, s * 1.15);
        });
        // the deck, squared up
        const dk = onTable(Lc.land ? T.cards.x + 250 * cs : Lc.w * 0.84, T.cards.y + 20, 0, _b), ds = s * 1.1;
        for (let i = 0; i < 18; i++) putBack(dk.x + (i % 3) * 0.04, 0.05 + i * stackH, dk.z - (i % 2) * 0.05, 0.28 + ((i * 37) % 7) * 0.004, ds);
        putEdge(dk.x, 0, dk.z, 0.28, 17.2 * stackH, ds); putShadow(dk.x, dk.z, 0.28, ds, 1.05);
      }
    } else {
      const g = state.game; if (!g) return;
      const n = g.n, now2 = clock;
      track(g, now2);
      const P = Lc.tablePairs, ps = P.scale;
      // the mat, cast from the layout's mat rectangle (with a margin so the border reads), and its soft shadow
      { const m = Lc.sceneMat, mg = 4, rr = { x: m.x - mg, y: m.y - mg, w: m.w + 2 * mg, h: m.h + 2 * mg }, pos = matGeo.attributes.position;
        const c0 = onTable(rr.x, rr.y, 0.03, _a), c1 = onTable(rr.x + rr.w, rr.y, 0.03, _b), c2 = onTable(rr.x, rr.y + rr.h, 0.03, _d);
        const x0 = c0.x, z0 = c0.z, x1 = c1.x, z1 = c1.z, x2 = c2.x, z2 = c2.z;
        pos.setXYZ(0, x0, 0.03, z0); pos.setXYZ(1, x1, 0.03, z1); pos.setXYZ(2, x2, 0.03, z2);
        const c3 = onTable(rr.x + rr.w, rr.y + rr.h, 0.03, _a); pos.setXYZ(3, c3.x, 0.03, c3.z); pos.needsUpdate = true;
        const wCm = Math.hypot(x1 - x0, z1 - z0), hCm = Math.hypot(x2 - x0, z2 - z0), mk = `${Math.round(wCm)}x${Math.round(hCm)}`;
        if (mk !== matKey) { matKey = mk; if (matTex) matTex.dispose(); matTex = texOf(W.matTexture(wCm, hCm)); matMat.map = matTex; matMat.needsUpdate = true; }
        const sp2 = shGeo.attributes.position; [[x0, z0], [x1, z1], [x2, z2], [c3.x, c3.z]].forEach(([px, pz], k) => sp2.setXYZ(k, px + 0.7, 0.02, pz + 0.9)); sp2.needsUpdate = true; }
      // --- the deal: cards leave the talon one at a time to each seat
      let seq = null;
      if (dealing) {
        dealing.t += dt;
        const total = n * 6, gap = 0.06, flight = 0.34;
        seq = new Array(n).fill(0);
        const S = Lc.stock; if (S) {
          const sk = kAt(S.x, S.y) * S.scale, from = onTable(S.x, S.y, 0.5, _b), fx = from.x, fz = from.z;
          for (let k = 0; k < total; k++) {
            const f = (dealing.t - k * gap) / flight, seat = k % n; if (f <= 0) continue;
            if (f >= 1) { seq[seat]++; continue; }
            const e = ease(f); let to;
            if (seat === 0) { const hs = Lc.hand.slot(Math.min(5, Math.floor(k / n)), 6); to = onTable(hs.x, hs.y, 0, _d); } else to = seatPos(seat, n, _d);
            const x = fx + (to.x - fx) * e, z = fz + (to.z - fz) * e, y = 0.6 + Math.sin(Math.PI * e) * 2.6;
            putBack(x, y, z, 0.2 * (1 - e), sk * (1 - 0.1 * e), Math.sin(e * Math.PI) * 0.1); putShadow(x, z, 0, sk, 0.9 + y * 0.02);
          }
        }
        if (dealing.t > (total - 1) * gap + flight + 0.15) { dealing = null; v3.dealing = false; }
      }
      // --- opponents' hands: face down, fanned in front of each seat
      for (let seat = 1; seat < n; seat++) {
        const sp = Lc.seat(n, seat), cnt = dealing ? seq[seat] : g.hands[seat].length, cw = CARD.w * sp.scale;
        const step = Math.min(0.42 * cw, (sp.maxW - cw) / Math.max(1, cnt - 1)), sk = kAt(sp.x, sp.y) * sp.scale;
        for (let i = 0; i < cnt; i++) {
          const o = i - (cnt - 1) / 2, w = onTable(sp.x + o * step, sp.y, 0, _a);
          putBack(w.x, 0.1 + i * 0.03, w.z, -o * 0.05, sk); putShadow(w.x, w.z, -o * 0.05, sk, 0.9);
        }
      }
      // --- stock, trump, discard
      const S = Lc.stock, T = Lc.trump, D = Lc.discard;
      if (S) {
        const ns = g.stock.length, sk = kAt(S.x, S.y) * S.scale, tw = onTable(T.x, T.y, 0, _a), sw = onTable(S.x, S.y, 0, _b);
        if (ns > 0) {
          putFace(g.trumpCard, tw.x, 0.04, tw.z, -(Math.PI / 2 - 0.06), sk); putShadow(tw.x, tw.z, -(Math.PI / 2 - 0.06), sk, 1);
          const h = ns * stackH, yaw = 0.015;
          putEdge(sw.x, 0.06, sw.z, yaw, h, sk); putBack(sw.x, 0.06 + h + 0.025, sw.z, yaw, sk); putShadow(sw.x, sw.z, yaw, sk, 1.05, h * 4);
        } else {
          const o = onTable(T.x - 16 * S.scale / 0.7, T.y - 10 * S.scale / 0.7, 0, _a); putFace(g.trumpCard, o.x, 0.04, o.z, 0.06, sk); putShadow(o.x, o.z, 0.06, sk, 1);
        }
      }
      if (D && g.discard.length) {
        const dw = onTable(D.x, D.y, 0, _a), dk = kAt(D.x, D.y) * D.scale, nd = g.discard.length, shown = Math.min(nd, 14), hgt = Math.max(0.02, (shown - 1) * stackH * Math.max(1, nd / 14) + 0.02);
        for (let i = 0; i < Math.min(nd, 14); i++) putBack(dw.x + (((i * 37) % 7) - 3) * 0.1, 0.05 + i * stackH * Math.max(1, nd / 14), dw.z + (((i * 29) % 5) - 2) * 0.08, -0.5 + (((i * 53) % 11) - 5) * 0.03, dk);
        putEdge(dw.x, 0.04, dw.z, -0.5, hgt, dk); putShadow(dw.x, dw.z, -0.5, dk, 1.05, hgt * 4);
      }
      // --- the table: each attack with the beating card laid over it
      const live = new Map(); for (const f of flights) live.set(f.c, f);
      const lay = (c, spot, off, rot, role) => {
        const base = onTable(spot.x + off.x, spot.y + off.y, 0, _a), sk = kAt(spot.x, spot.y) * ps, y = 0.05 + (role === 'd' ? 0.09 : 0);
        const f = live.get(c);
        if (f) {
          const e = ease(clamp01((now2 - f.t0) / f.dur)); let from;
          if (f.from.mine) { const h = Lc.hand.slot(Math.min(g.hands[0].length, 4), Math.max(5, g.hands[0].length)); from = onTable(h.x, h.y - 20, 8, _b); } else from = seatPos(f.from.seat, n, _b);
          const y0 = f.from.mine ? 8 : 0.6, x = from.x + (base.x - from.x) * e, z = from.z + (base.z - from.z) * e, yy = y0 + (y - y0) * e + Math.sin(Math.PI * e) * 3.4;
          putFace(c, x, yy, z, -rot * e, sk * (1 + 0.1 * (1 - e)), f.from.mine ? 0 : Math.PI * (1 - ease(clamp01(e * 1.25))), f.from.mine ? (1 - e) * 0.45 : 0);
          putShadow(x, z, -rot * e, sk, 1 + yy * 0.04, yy);
          if (e > 0.8) { const gg = (1 - e) / 0.2; putGlow(base.x, base.z, CW * sk * 1.8 * (1.35 - gg * 0.35), 0.5 * gg, 0.38 * gg, 0.18 * gg); }
        } else { putFace(c, base.x, y, base.z, -rot, sk); putShadow(base.x, base.z, -rot, sk, 1, role === 'd' ? 0.5 : 0); }
      };
      g.table.forEach((pair, i) => {
        const s = Lc.pair(i);
        lay(pair.a, s, { x: -P.off.x / 2, y: -P.off.y / 2 }, -0.05, 'a');
        if (pair.d >= 0) lay(pair.d, s, { x: P.off.x / 2, y: P.off.y / 2 }, 0.09, 'd');
        if (state.beatSlots && state.beatSlots.has(i)) { const gp = onTable(s.x - P.off.x / 2, s.y - P.off.y / 2, 0, _a), sk = kAt(s.x, s.y) * ps, pu = 0.8 + 0.2 * Math.sin(now2 * 5); putGlow(gp.x, gp.z, CW * sk * 1.6, 0.9 * pu, 0.72 * pu, 0.25 * pu); }
      });
      // --- bito: beaten pairs swept to the discard, turning face down on the way
      for (const sw of sweeps) {
        const e = clamp01((now2 - sw.t0) / sw.dur), D2 = Lc.discard, dw = onTable(D2.x, D2.y, 0, _d), dk = kAt(D2.x, D2.y) * D2.scale;
        sw.cards.forEach((cd, k) => {
          const s = Lc.pair(cd.i), off = cd.d ? { x: P.off.x / 2, y: P.off.y / 2 } : { x: -P.off.x / 2, y: -P.off.y / 2 };
          const from = onTable(s.x + off.x, s.y + off.y, 0, _a), sk = kAt(s.x, s.y) * ps, le = ease(clamp01((e - k * 0.04) / 0.8));
          const x = from.x + (dw.x - from.x) * le, z = from.z + (dw.z - from.z) * le, y = 0.14 + k * 0.02 + Math.sin(Math.PI * le) * 4;
          putFace(cd.c, x, y, z, (cd.d ? -0.09 : 0.05) * (1 - le) - 0.5 * le, sk + (dk - sk) * le, Math.PI * ease(clamp01((le - 0.35) / 0.4)));
          putShadow(x, z, -0.5 * le, sk + (dk - sk) * le, 1 + y * 0.03, y);
        });
      }
      // --- take: the pile gathers into the taker's hand
      const pk = state.pickup;
      if (pk) {
        const e = clamp01(pk.t / pk.dur), ee = ease(e);
        let to; if (pk.seat === 0) { const hs = Lc.hand.slot(0, 1); to = onTable(Lc.w / 2 + (Lc.land ? (Lc.table.x + Lc.table.w / 2 - Lc.w / 2) : 0), hs.y - 40, 6, _d); } else to = seatPos(pk.seat, n, _d);
        pk.cards.forEach((c, i) => {
          const s = Lc.pair(Math.min(5, i)), from = onTable(s.x, s.y, 0, _a), sk = kAt(s.x, s.y) * ps;
          const x = from.x + (to.x - from.x) * ee, z = from.z + (to.z - from.z) * ee, y = 0.2 + i * 0.03 + Math.sin(Math.PI * ee) * 3.2 + ee * (pk.seat === 0 ? 5 : 0);
          putFace(c, x, y, z, -((i - pk.cards.length / 2) * 0.1) * ee, sk * (1 - 0.35 * ee), pk.seat === 0 ? 0 : Math.PI * ease(clamp01(e * 1.5)));
          putShadow(x, z, 0, sk * (1 - 0.3 * ee), 1 + y * 0.03, y);
        });
      }
    }
    for (let i = nFace; i < facePool.length; i++) facePool[i].visible = false;
    backs.count = nBack; backs.instanceMatrix.needsUpdate = true;
    edges.count = nEdge; edges.instanceMatrix.needsUpdate = true;
    shadows.count = nShadow; shadows.instanceMatrix.needsUpdate = true;
    glows.count = nGlow; glows.instanceMatrix.needsUpdate = true; if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    // steam from the samovar's teapot and the glass; dust drifting in the window light
    const still = calm || state.calm, tt = still ? 0 : state.t;
    const sp = samovar.position, ss = samovar.scale.x;
    steamS.forEach((s, i) => { const ph = ((tt * 0.3 + i / steamS.length) % 1); s.position.set(sp.x + (Math.sin(tt * 0.8 + i * 2) * 1.4 + ph * 2) * ss, (58 + ph * 16) * ss, sp.z + Math.cos(tt * 0.7 + i) * 0.8); const sc = (4 + ph * 9) * ss; s.scale.set(sc, sc, 1); s.material.opacity = still ? 0 : 0.2 * Math.sin(ph * Math.PI); });
    steamT.forEach((s, i) => { const ph = ((tt * 0.34 + i / steamT.length) % 1); s.position.set(tea.position.x + Math.sin(tt * 0.9 + i * 2) * 0.7, 14 + ph * 9, tea.position.z + Math.cos(tt * 0.7 + i) * 0.5); const sc = 2.4 + ph * 5; s.scale.set(sc, sc, 1); s.material.opacity = still ? 0 : 0.22 * Math.sin(ph * Math.PI); });
    for (let i = 0; i < MOTES; i++) { const [a, b, c, d] = moteSeed[i], ph = still ? 0 : (tt * 0.02 * (0.5 + d) + a) % 1; motePos[i * 3] = anchors.light[0] + (b - 0.5) * 70 + Math.sin(tt * 0.3 + c * 9) * 3; motePos[i * 3 + 1] = 4 + ((ph + c) % 1) * 38; motePos[i * 3 + 2] = anchors.light[2] + (c - 0.5) * 50; }
    moteGeo.attributes.position.needsUpdate = true; motes.material.opacity = still ? 0.25 : 0.5;
    lightMat.opacity = still ? 0.26 : 0.24 + 0.05 * Math.sin(state.t * 0.35) + 0.02 * Math.sin(state.t * 0.9);

    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    const sk2 = `${cssW()}x${cssH()}|${tier}`;
    if (sk2 !== sizeKey) { sizeKey = sk2; renderer.setSize(cssW(), cssH(), false); }
    scene.fog.near = cur.dist * 1.5; scene.fog.far = cur.dist * 3.8;
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.dealing = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); matKey = ''; applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true;
  });

  let loseExt = null;
  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  for (const c of HERO) faceTexOf(c, false, false);
  await tick();

  return {
    ok: true,
    renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    // offline store icon (scratch tool): one square render at size x size
    iconPng(size = 2048) {
      pre(); post();
      renderer.setPixelRatio(1); renderer.setSize(size, size, false);
      Object.assign(cur, framing(game.getState())); camera.aspect = 1; place(camera, cur); camera.aspect = 1; camera.clearViewOffset(); camera.updateProjectionMatrix();
      renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png');
    },
    loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return loseExt; },
    restoreContext() { loseExt?.restoreContext(); return loseExt; },
  };
}
