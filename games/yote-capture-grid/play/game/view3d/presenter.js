// Yote 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: the lit board scene (sand bed, carved frame, river pebbles, golden-hour village courtyard, perspective camera fitted to the
// layout's board rectangle) and a screen-space HUD scene (carved plaques, lacquered buttons) drawn in the same frame.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { v3, sprites } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { TIMING as T } from '../src/timing.js';
import { SZ } from '../src/rules.js';
import { LESSONS } from '../src/content.js';
import { buildBoard, buildCourtyard, buildMat, buildMotes, makePebble, tex, radialCanvas, ringCanvas, BED_Y, PIT_BOTTOM, RIM_Y, BOARDS3, STONES } from './models.js';

const TAU = Math.PI * 2;
const ease = (f) => f * f * (3 - 2 * f);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const SEAT = PIT_BOTTOM;           // y of a resting pebble's local origin: the bottom of the scooped pit

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.autoClear = false;
  renderer.setClearColor(0x2a1a10, 1); renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);
  const tp = Number(qs.get('tp')) || 0, tf = Number(qs.get('tf')) || 0;

  // ---------------------------------------------------------------- the world
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 320);
  const rig = B.lightingRig(scene, 'duskOutdoor', {
    renderer, shadow: TIERS[tier].shadow, extent: 6.5, background: false, fog: { near: 26, far: 90 }, target: [0, 0, 0],
    overrides: { fog: 0xe6a15c, hemiSky: 0xffe0b0, hemiGround: 0x6a4224, hemi: 0.5, key: 0xffb468, keyI: 2.7, keyPos: [-9, 6.2, 5.5], fill: 0x8aa0e8, fillI: 0.3, fillPos: [7, 4, 7], rim: 0xffc890, rimI: 1.3, rimPos: [8, 4.5, -8], exposure: 0.92, env: 0.34 },
  });
  const key = rig.key;
  const envMap = B.createEnvironment(renderer, scene, { intensity: 0.42 });
  const court = buildCourtyard(); scene.add(court.group);
  const motes = buildMotes(); scene.add(motes);
  const boardRoot = new THREE.Group(); scene.add(boardRoot);
  const matRoot = new THREE.Group(); boardRoot.add(matRoot);
  const pieceRoot = new THREE.Group(); boardRoot.add(pieceRoot);
  const mkRoot = new THREE.Group(); boardRoot.add(mkRoot);
  const fxRoot = new THREE.Group(); boardRoot.add(fxRoot);

  const hud = new THREE.Scene();
  const hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0d0, 0.95); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffc890, 0.3); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c0, 0x20150c, 0.35), hudKey, hudFill);
  const buildHudEnv = () => { try { hud.environment = scene.environment; hud.environmentIntensity = 0.18; } catch (e) { /* none */ } };
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }

  // ---------------------------------------------------------------- board + mat (cached per kind and shape)
  const boards = new Map();
  let boardGrp = null, matMesh = null, curKey = '', bdW = 5, bdD = 6;
  function ensureBoard(kind, sc, sr) {
    const k = `${kind}|${sc}x${sr}`;
    if (k === curKey) return;
    if (boardGrp) boardRoot.remove(boardGrp);
    if (matMesh) { matRoot.remove(matMesh); matMesh.geometry.dispose(); matMesh.material.map?.dispose(); matMesh.material.dispose(); }
    let e = boards.get(k);
    if (!e) { e = buildBoard(kind, sc, sr); boards.set(k, e); if (boards.size > 5) { const o = boards.keys().next().value; boards.get(o).userData.dispose(); boards.delete(o); } }
    boardGrp = e; boardRoot.add(boardGrp); curKey = k; bdW = e.userData.W; bdD = e.userData.D;
    matMesh = buildMat(kind, bdW, bdD); matRoot.add(matMesh);
  }

  // ---------------------------------------------------------------- piece pool, markers, effects
  let style = 'river';
  const pool = [[], [], []], used = [0, 0, 0];
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobTex = tex(radialCanvas('20,8,0', 0.8, 128, 0.45), {});
  const glowTex = tex(radialCanvas('255,255,255', 0.95, 128, 0.5), {});
  const ringTex = tex(ringCanvas('255,255,255', 128, 0.7), {});
  function pieceAt(side) {
    const p = pool[side];
    while (p.length <= used[side]) {
      const wrap = new THREE.Group(), model = makePebble(style, side, p.length % 3);
      model.userData.body.material = model.userData.body.material.clone();           // own emissive for the capture flash
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      shadow.position.y = BED_Y + 0.004 - SEAT; shadow.renderOrder = 1; wrap.add(shadow, model); wrap.userData = { model, shadow };
      pieceRoot.add(wrap); p.push(wrap);
    }
    return p[used[side]++];
  }
  function setStyle(s) { if (s === style) return; style = s; for (const p of pool) { for (const w of p) pieceRoot.remove(w); p.length = 0; } for (const g of ghostPool) if (g) pieceRoot.remove(g); ghostPool.length = 0; }
  const ghostPool = []; let ghostN = 0;
  function ghostAt(side) {
    let g = ghostPool[ghostN];
    if (!g || g.userData.side !== side) { if (g) pieceRoot.remove(g); g = makePebble(style, side, 0, true); g.userData.side = side; pieceRoot.add(g); ghostPool[ghostN] = g; }
    ghostN++; return g;
  }
  // flat markers (glow discs and rings) lying in the pits
  const mkPool = []; let mkN = 0;
  function mark(x, z, tx, color, opacity, size, y = BED_Y + 0.025) {
    let m = mkPool[mkN];
    if (!m) { m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; mkRoot.add(m); mkPool.push(m); }
    mkN++; m.visible = true; m.material.map = tx; m.material.color.set(color); m.material.opacity = opacity; m.position.set(x, y, z); m.scale.set(size, 1, size);
  }
  // particles: sand puffs, chips, golden sparks (one instanced mesh, per-instance colour)
  const PN = 200;
  const partMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 5, 4), new THREE.MeshBasicMaterial({ fog: false }), PN);
  partMesh.frustumCulled = false; fxRoot.add(partMesh);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
  function spawn(x, y, z, n, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.9, sp = (o.speed ?? 1) * (0.55 + ((i * 37) % 10) * 0.09);
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: (o.up ?? 1.6) * (0.6 + ((i * 13) % 7) * 0.12), vz: Math.sin(a) * sp, life: 0, max: (o.life ?? 0.7) * (0.8 + ((i * 7) % 5) * 0.1), sz: (o.size ?? 1) * (0.7 + ((i * 11) % 6) * 0.12), col: o.cols ? o.cols[i % o.cols.length] : '#f2d9a4', g: o.g ?? 5.2 });
    }
    if (parts.length > PN) parts.splice(0, parts.length - PN);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < BED_Y + 0.02 && p.vy < 0) { p.y = BED_Y + 0.02; p.vy *= -0.2; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life >= p.max) parts.splice(i, 1);
    }
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (!p) { _m.makeScale(0, 0, 0); partMesh.setMatrixAt(i, _m); continue; }
      const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(p.sz * (0.4 + k)); _m.compose(_p, _q, _s); partMesh.setMatrixAt(i, _m); partMesh.setColorAt(i, _c.set(p.col));
    }
    partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;
  }
  // gold beads along an arc (the bonus beam: the jump "reaches" for the extra pebble)
  const BEADS = 22;
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd470, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), BEADS);
  beads.frustumCulled = false; beads.visible = false; fxRoot.add(beads);
  function beam(x0, z0, x1, z1, f, t) {
    for (let i = 0; i < BEADS; i++) {
      const u = (i / (BEADS - 1)) * f, h = Math.sin(u * Math.PI) * 0.9 + 0.55;
      _p.set(x0 + (x1 - x0) * u, BED_Y + h + Math.sin(t * 14 + i) * 0.03, z0 + (z1 - z0) * u); _s.setScalar(0.7 + 0.5 * Math.sin(i * 0.9 + t * 20) ** 2); _m.compose(_p, _q, _s); beads.setMatrixAt(i, _m);
    }
    beads.instanceMatrix.needsUpdate = true; beads.visible = true;
  }
  const fired = new Set();
  const once = (k, fn) => { if (!fired.has(k)) { if (fired.size > 64) fired.clear(); fired.add(k); fn(); } };
  const ids = new WeakMap(); let idc = 0;
  const idOf = (o) => { let v = ids.get(o); if (!v) { v = ++idc; ids.set(o, v); } return v; };

  // ---------------------------------------------------------------- HUD: carved plaques and lacquered buttons
  const hudPanels = [], hudButtons = [];
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const phys = (color, o) => new THREE.MeshPhysicalMaterial({ color, ...o });
  const woodHud = B.material('darkWood', { color: '#6a3a1c', color2: '#8a5a30', repeat: [3, 3], seed: 9 });
  const brassHud = new THREE.MeshStandardMaterial({ color: '#d9a43a', metalness: 0.9, roughness: 0.3 });
  const brassOn = new THREE.MeshStandardMaterial({ color: '#ffd36a', metalness: 0.9, roughness: 0.25, emissive: '#ff9a20', emissiveIntensity: 0.55 });
  const clothHud = B.material('cloth', { color: '#27437f', color2: '#162a58', repeat: [3, 2], seed: 4, roughness: 1 });
  const clothOn = B.material('cloth', { color: '#3a5ea8', color2: '#22407e', repeat: [3, 2], seed: 4, roughness: 1 });
  const clothDoc = B.material('cloth', { color: '#243f80', color2: '#16295a', repeat: [4, 5], seed: 6, roughness: 1 });
  const lacqGold = phys('#ffb830', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, emissive: '#c87400', emissiveIntensity: 0.6 });
  const lacqIndigo = phys('#335cb4', { roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12, emissive: '#0c2255', emissiveIntensity: 0.35 });
  const lacqTeal = phys('#1f9a8e', { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const lacqDim = phys('#2a3350', { roughness: 0.5, clearcoat: 0.4 });
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x120a04, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const ROT = Math.PI / 2;
  function placePanel(i, r, rad, kind) {
    let p = hudPanels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, clothHud); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; hudPanels.push(p); }
    p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, dep = kind === 'toast' ? 8 : 14, ins = kind === 'toast' ? 5 : 8;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.4, r.h - ins * 2.4, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    p.inner.material = kind === 'plateOn' ? clothOn : kind === 'doc' ? clothDoc : clothHud;
    p.trim.material = kind === 'plateOn' ? brassOn : brassHud;
  }
  function placeButton(i, bt, pressed) {
    let b = hudButtons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, lacqIndigo), rim = new THREE.Mesh(flatQuad, brassHud); g.add(rim, body); hud.add(g); b = { g, body, rim }; hudButtons.push(b); }
    const r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(r.h / 2, 30), z = -400, dep = pressed ? 7 : 17;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 8, r.h - 8, dep, rad - 3, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = bt.dim ? lacqDim : bt.primary ? lacqGold : bt.on ? lacqTeal : lacqIndigo;
    b.rim.material = bt.primary ? brassOn : brassHud;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- camera fitting and picking
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0, flat = { sc: 5, sr: 6, tr: true, flip: false };
  const camShake = { x: 0, y: 0 };
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3();
  function fitCamera(rect, L, pitchDeg, fov, yawDeg = 0, fitH = true) {
    const k = W / L.w, tw = rect.w * k, th = rect.h * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180, lookY = 0.3;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 24;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    const hw = bdW / 2, hd = bdD / 2;
    const meas = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const [x, y, z] of [[-hw, 0, hd], [hw, 0, hd], [-hw, RIM_Y + 0.35, -hd], [hw, RIM_Y + 0.35, -hd], [-hw, 0, -hd], [hw, 0, -hd]]) {
        tmpV.set(x, y, z).project(camera); x0 = Math.min(x0, tmpV.x); x1 = Math.max(x1, tmpV.x); y0 = Math.min(y0, tmpV.y); y1 = Math.max(y1, tmpV.y);
      }
      return { w: ((x1 - x0) / 2) * W, h: ((y1 - y0) / 2) * H, cx: ((x0 + x1) / 4 + 0.5) * W, cy: (0.5 - (y0 + y1) / 4) * H };
    };
    for (let it = 0; it < 6; it++) { place(); const m = meas(); let s = tw / m.w; if (fitH) s = Math.min(s, th / m.h); d /= s; }
    place(); const m = meas();
    const cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, m.cx - cxp - camShake.x * W, m.cy - cyp - camShake.y * H, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const cellAB = (i) => {
    const r = (i / 6) | 0, c = i % 6;
    let a = flat.tr ? r : c, b = flat.tr ? c : r;
    if (flat.flip) { a = flat.sc - 1 - a; b = flat.sr - 1 - b; }
    return [a, b];
  };
  const cellX = (i) => cellAB(i)[0] + 0.5 - flat.sc / 2, cellZ = (i) => cellAB(i)[1] + 0.5 - flat.sr / 2;
  const toVirt = (x, y, z) => { tmpV.set(x, y, z); boardRoot.localToWorld(tmpV); tmpV.project(camera); return { x: ((tmpV.x + 1) / 2) * L_.w, y: ((1 - tmpV.y) / 2) * L_.h }; };
  v3.sq = (i) => toVirt(cellX(i), BED_Y + 0.12, cellZ(i));
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hitV = new THREE.Vector3();
  const planeHit = (vx, vy, h) => {
    if (!L_) return null;
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return null;
    const t = (h - orig.y) / ray.y; if (t < 0) return null;
    hitV.copy(orig).addScaledVector(ray, t); boardRoot.worldToLocal(hitV); return { x: hitV.x, z: hitV.z };
  };
  v3.unproj = (vx, vy) => planeHit(vx, vy, BED_Y + 0.4);
  v3.pick = (vx, vy) => {
    const h = planeHit(vx, vy, BED_Y + 0.2); if (!h) return -1;
    const a = Math.floor(h.x + flat.sc / 2), b = Math.floor(h.z + flat.sr / 2);
    if (a < 0 || a > flat.sc - 1 || b < 0 || b > flat.sr - 1) return -1;
    let aa = a, bb = b; if (flat.flip) { aa = flat.sc - 1 - a; bb = flat.sr - 1 - b; }
    const r = flat.tr ? aa : bb, c = flat.tr ? bb : aa;
    return r * 6 + c;
  };

  // ---------------------------------------------------------------- sprites for the flat layer: the same pebbles, rendered once
  function buildSprites() {
    const SP = 240, sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-0.6, 0.6, 0.6, -0.6, 0.1, 20);
    const l1 = new THREE.DirectionalLight(0xfff0d8, 3.2); l1.position.set(-3, 6, 4); const l2 = new THREE.DirectionalLight(0x9fc4ff, 0.9); l2.position.set(4, 2, -3);
    sc.add(new THREE.HemisphereLight(0xffe6c0, 0x4a3a30, 1.2), l1, l2); sc.environment = scene.environment; sc.environmentIntensity = 0.55;
    const pr = renderer.getPixelRatio(), szw = Math.max(1, Math.floor(window.innerWidth)), szh = Math.max(1, Math.floor(window.innerHeight));
    renderer.setPixelRatio(1); renderer.setSize(SP, SP, false); renderer.setClearColor(0x000000, 0); renderer.shadowMap.enabled = false;
    const pitch = (38 * Math.PI) / 180;
    for (const st of Object.keys(STONES)) for (const v of [1, 2]) {
      const m = makePebble(st, v, 0); m.rotation.y = 0.5; sc.add(m);
      const tgt = new THREE.Vector3(0, 0.13 + 0.06 / Math.cos(pitch), 0);
      cam.position.set(0, tgt.y + Math.sin(pitch) * 6, Math.cos(pitch) * 6); cam.lookAt(tgt); cam.updateMatrixWorld();
      renderer.clear(); renderer.render(sc, cam);
      const c = document.createElement('canvas'); c.width = c.height = SP; c.getContext('2d').drawImage(renderer.domElement, 0, 0, SP, SP);
      sprites.pebble[`${st}|${v}`] = c; sc.remove(m);
    }
    renderer.setPixelRatio(pr); renderer.setSize(szw, szh, false); renderer.setClearColor(0x2a1a10, 1);
    renderer.shadowMap.enabled = TIERS[tier].shadow > 0; W = 0; sprites.ready = true;
  }

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0; scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }
  function setPiece(w, x, z, o = {}) {
    w.visible = true; w.position.set(x, SEAT, z);
    const m = w.userData.model, sh = w.userData.shadow, lift = (o.lift || 0) * 0.62, s = o.scale ?? 1, sq = o.squash || 0;
    m.position.y = lift; m.rotation.set(o.tilt || 0, (o.spin || 0) + (o.yaw || 0), o.tiltZ || 0);
    m.scale.set(s * (1 + sq * 0.14), s * (1 - sq * 0.2), s * (1 + sq * 0.14));
    sh.scale.setScalar(0.95 * s * (1 + clamp(lift * 0.5, 0, 0.5))); sh.material.opacity = 0.75 * (1 - clamp(lift * 0.8, 0, 0.6)) * (o.shadow ?? 1);
    sh.position.set(0.06 + lift * 0.18, BED_Y + 0.004 - SEAT, 0.05);
    const mat = m.userData.body.material; mat.emissive.setScalar(o.flash ? 0.9 : 0); mat.emissiveIntensity = o.flash || 0;
    if (o.wobble) { m.rotation.x += Math.sin(clock * 38) * o.wobble; m.rotation.z += Math.cos(clock * 33) * o.wobble; }
  }
  const hideAll = () => { for (const p of pool) for (const w of p) { w.visible = false; w.position.y = -50; } for (const g of ghostPool) if (g) g.visible = false; used[1] = used[2] = 0; ghostN = 0; mkN = 0; beads.visible = false; };
  const finishMarks = () => { for (let i = mkN; i < mkPool.length; i++) mkPool[i].visible = false; };
  const ring = (i, tx, col, op, size, y) => mark(cellX(i), cellZ(i), tx, col, op, size, y);

  function boardState(state) {
    const g = state.game, a = state.anim, over = state.scene === 'over', isLesson = state.scene === 'lesson';
    hideAll();
    const tn = a ? a.t / a.k : 0, pulse = state.calm ? 0.6 : 0.5 + 0.5 * Math.sin(clock * 5);
    const pend = state.pend, movingTo = a ? a.to : -1, dragging = state.drag && state.sel >= 0 && !pend;
    const eid = a ? idOf(a) : 0;
    // the board shivers a little as each pebble is taken; neighbours wobble
    let shake = 0;
    if (a && a.kind === 'jump' && !state.calm) for (const t0 of a.bonus >= 0 || a.bonusHand ? [T.capAt, T.bonusAt] : [T.capAt]) { const f = (tn - t0 - 0.05) / 0.35; if (f >= 0 && f < 1) shake = Math.max(shake, 1 - f); }
    camShake.x = shake ? Math.sin(clock * 90) * shake * 0.0035 : 0; camShake.y = shake ? Math.cos(clock * 77) * shake * 0.0025 : 0;
    const wobbleNear = (i) => (shake ? Math.max(0, 1 - Math.hypot(cellX(i) - cellX(a.to), cellZ(i) - cellZ(a.to)) / 2.2) * shake * 0.06 : 0);
    // markers lying in the pits
    const last = a ? null : g.last;
    if (last && !isLesson) { for (const q of [last.from, last.to]) if (q >= 0) ring(q, glowTex, '#ffd25a', 0.3, 1.0); if (last.cap >= 0) ring(last.cap, ringTex, '#ffd25a', 0.35, 0.95); }
    if (isLesson && state.lesson && !state.lesson.done) { const t = LESSONS[state.lesson.i].target; if (t !== undefined && t >= 0) ring(t, ringTex, '#ff4a2a', 0.6 + 0.4 * pulse, 1.0); }
    if (state.sel >= 0 && !a && !over && !pend) {
      ring(state.sel, glowTex, '#ffe27a', 0.5 + pulse * 0.25, 1.1);
      for (const m of state.selMoves) {
        if (m.jump) { ring(m.to, ringTex, '#ff4a2a', 0.8 + pulse * 0.2, 1.0); ring(m.to, glowTex, '#ff5a2a', 0.28 + pulse * 0.2, 1.0); }
        else { ring(m.to, glowTex, '#fff2c0', 0.55 + pulse * 0.25, 0.62); ring(m.to, ringTex, '#ffe9a8', 0.5 + pulse * 0.3, 0.86); }
      }
    }
    if (pend && !a && !over) {
      ring(pend.move.from, glowTex, '#ffe27a', 0.35, 1.0); ring(pend.move.to, ringTex, '#ffe27a', 0.9, 1.0);
      for (const q of pend.opts) if (q >= 0) { ring(q, ringTex, '#ff4a2a', 0.7 + 0.3 * pulse, 1.0 + 0.06 * pulse); ring(q, glowTex, '#ff4a2a', 0.18 + 0.18 * pulse, 1.0); }
    }
    if (state.hint && !a) {
      const h = state.hint;
      for (const q of [h.from, h.to]) if (q >= 0) { ring(q, glowTex, '#5af09a', 0.4 + pulse * 0.2, 1.05); ring(q, ringTex, '#5af09a', 0.9, 1.05); }
      if (h.bonus >= 0) { ring(h.bonus, glowTex, '#ffaa3c', 0.4 + pulse * 0.2, 1.05); ring(h.bonus, ringTex, '#ffaa3c', 0.95, 1.1); }
    }
    if (state.kb && !over) ring(state.cursor, ringTex, '#7dff9a', 1, 1.0);
    // pebbles at rest
    for (let i = 0; i < SZ; i++) {
      const v = g.board[i]; if (!v || (i === movingTo && a)) continue;
      if (dragging && i === state.sel) continue;
      const sel = state.sel === i && !pend;
      setPiece(pieceAt(v), cellX(i), cellZ(i), { lift: sel ? 0.5 + (state.calm ? 0 : Math.sin(clock * 3) * 0.07) : 0, yaw: (i * 0.7) % TAU, wobble: wobbleNear(i) });
    }
    if (pend && !a) { const gp = ghostAt(g.turn); gp.visible = true; gp.position.set(cellX(pend.move.to), SEAT, cellZ(pend.move.to)); }
    // jump: the taken pebbles stay until the jump passes over them, then flash, tumble out and fade
    if (a && a.kind === 'jump') {
      const opp = 3 - a.side;
      const capture = (q, t0, len, tag) => {
        const x = cellX(q), z = cellZ(q);
        if (tn < t0) { setPiece(pieceAt(opp), x, z, { yaw: (q * 0.7) % TAU }); return; }
        const f = (tn - t0) / len; if (f >= 1) return;
        once(`${tag}${eid}`, () => {
          spawn(x, SEAT + 0.35, z, 12, { cols: ['#f2d9a4', '#b9743c', '#ffe08a'], speed: 1.3, up: 2.2, life: 0.8, size: 1.1 });
          spawn(x, SEAT + 0.3, z, 8, { cols: ['#ffd470'], speed: 0.7, up: 2.8, life: 0.7, size: 0.8, g: 3 });
        });
        if (f < 0.22) { const e = f / 0.22; setPiece(pieceAt(opp), x, z, { scale: 1 + 0.12 * e, flash: 0.9 * e, lift: 0.2 * e }); }
        else {
          const gg = (f - 0.22) / 0.78, e = ease(gg), dir = q % 2 ? 1 : -1;
          setPiece(pieceAt(opp), x, z, { lift: 0.4 + e * 2.4, scale: 1.1 - 0.7 * e, tilt: dir * e * 1.2, spin: e * 7, flash: 0.5 * (1 - gg), shadow: 1 - gg });
          ring(q, ringTex, '#ffd470', 0.8 * (1 - gg), 0.9 + gg * 2.2, BED_Y + 0.03);
        }
      };
      if (a.cap >= 0) capture(a.cap, T.capAt, T.capLen, 'cap');
      if (a.bonus >= 0) {
        const bx = cellX(a.bonus), bz = cellZ(a.bonus), t1 = T.bonusAt - 0.25;
        if (tn < T.bonusAt) {
          const hit = clamp((tn - t1) / 0.25, 0, 1);
          setPiece(pieceAt(opp), bx, bz, { yaw: (a.bonus * 0.7) % TAU, flash: hit * 0.5, lift: hit * 0.25 });
          if (tn > T.hop && !state.calm) beam(cellX(a.to), cellZ(a.to), bx, bz, ease(clamp((tn - T.hop) / (T.bonusAt - T.hop), 0, 1)), clock);
          ring(a.bonus, ringTex, '#ff3a22', 0.5 + 0.5 * hit, 1.0 + 0.1 * hit);
        } else capture(a.bonus, T.bonusAt, T.bonusLen, 'bon');
      }
      // golden burst and a shockwave in the sand where the jump landed
      if (tn > T.capAt) {
        const f = (tn - T.capAt) / 0.9;
        if (f < 1) { ring(a.to, glowTex, '#ffd890', 0.4 * (1 - f), 0.9 + 1.4 * f, BED_Y + 0.5); ring(a.to, ringTex, '#ffcf7a', 0.9 * (1 - f), 0.8 + 3.0 * f, BED_Y + 0.03); }
      }
      // a bonus taken from the enemy's hand flies out of its tray
      if (a.bonusHand && tn >= T.bonusAt - 0.05) {
        const f = clamp((tn - (T.bonusAt - 0.05)) / T.bonusLen, 0, 1), plate = (opp === 1 ? L_.plateBot : L_.plateTop) || L_.plateTop;
        const s0 = planeHit(plate.x + plate.w * 0.7, plate.y + plate.h * 0.5, BED_Y + 1.2), x1 = cellX(a.to), z1 = cellZ(a.to);
        if (s0) { const e = ease(f); setPiece(pieceAt(opp), s0.x + (x1 - s0.x) * e, s0.z + (z1 - s0.z) * e, { lift: 1.2 * (1 - e) + Math.sin(f * Math.PI) * 1.2, scale: 1 - 0.35 * f, spin: f * 6, shadow: 1 - f }); }
      }
    }
    // the moving pebble
    if (a) {
      const x1 = cellX(a.to), z1 = cellZ(a.to), has0 = a.from >= 0, x0 = has0 ? cellX(a.from) : x1, z0 = has0 ? cellZ(a.from) : z1;
      if (a.kind === 'drop') {
        const f = clamp(tn / T.dropLand, 0, 1), e = f * f, land = tn - T.dropLand;
        const sq = land > 0 && land < 0.16 ? Math.sin((land / 0.16) * Math.PI) : 0;
        setPiece(pieceAt(a.side), x1, z1, { lift: (1 - e) * 2.6, scale: 1.12 - 0.12 * f, squash: sq, yaw: f * 2, shadow: f });
        if (land > 0) once(`land${eid}`, () => spawn(x1, BED_Y + 0.1, z1, 12, { cols: ['#f6dcaa', '#e0b878', '#fff0cc'], speed: 0.9, up: 1.1, life: 0.55, size: 1.0 }));
        if (land > 0 && land < 0.6) ring(a.to, ringTex, '#fff0cc', 0.6 * (1 - land / 0.6), 0.7 + land * 2.2, BED_Y + 0.025);
      } else if (a.kind === 'step') {
        const f = clamp(tn / T.step, 0, 1), e = ease(f);
        setPiece(pieceAt(a.side), x0 + (x1 - x0) * e, z0 + (z1 - z0) * e, { lift: Math.sin(Math.PI * f) * 0.4, yaw: f * 1.4 });
        ring(a.to, glowTex, '#fff2c0', 0.35 * f, 0.8);
        if (tn > T.step) once(`land${eid}`, () => spawn(x1, BED_Y + 0.1, z1, 6, { cols: ['#f6dcaa', '#fff0cc'], speed: 0.5, up: 0.7, life: 0.4, size: 0.8 }));
      } else {
        const f = clamp(tn / T.hop, 0, 1), e = ease(f), landed = tn >= T.hop, since = tn - T.hop;
        const lift = landed ? Math.max(0, 0.3 * (1 - since / 0.14)) : Math.sin(Math.PI * f) * 1.35;
        const sq = landed && since < 0.14 ? Math.sin((since / 0.14) * Math.PI) * 0.8 : 0;
        setPiece(pieceAt(a.side), x0 + (x1 - x0) * e, z0 + (z1 - z0) * e, { lift, squash: sq, yaw: f * 2.2, tilt: landed ? 0 : Math.sin(f * Math.PI * 2) * 0.1 });
        if (landed) once(`land${eid}`, () => spawn(x1, BED_Y + 0.1, z1, 14, { cols: ['#ffeccc', '#f2cf9a', '#fff6e0'], speed: 1.15, up: 1.4, life: 0.6, size: 1.1 }));
        if (landed && since < 0.6) ring(a.to, ringTex, '#fff6e0', 0.7 * (1 - since / 0.6), 0.7 + since * 2.6, BED_Y + 0.026);
      }
    }
    // a dragged pebble follows the finger, lifted, with a glow in the pit under it
    if (dragging) {
      const h = planeHit(state.drag.x, state.drag.y - 20, BED_Y + 0.9);
      if (h) setPiece(pieceAt(g.board[state.sel] || g.turn), clamp(h.x, -flat.sc / 2, flat.sc / 2), clamp(h.z, -flat.sr / 2, flat.sr / 2), { lift: 1.5, shadow: 0.7 });
    }
    finishMarks();
  }

  // title / documents: a looping demonstration (a drop, then a jump that takes a bonus pebble from the far corner)
  function heroState(state) {
    hideAll(); camShake.x = camShake.y = 0;
    const Tm = state.frozen ? 3.5 : state.calm ? 1.2 : state.t % 7.2, cyc = Math.floor(state.t / 7.2), cols = 6, rows = 4;
    const at = (r, c) => ({ x: c + 0.5 - cols / 2, z: r + 0.5 - rows / 2 });
    const op = Tm < 0.5 ? Tm / 0.5 : Tm > 6.4 ? Math.max(0, 1 - (Tm - 6.4) / 0.6) : 1;
    const put = (side, p, o = {}) => setPiece(pieceAt(side), p.x, p.z, { scale: op * (o.scale ?? 1), shadow: op, ...o });
    for (const [r, c, s] of [[3, 1, 1], [3, 4, 2], [0, 1, 1]]) put(s, at(r, c), { yaw: r * 2 + c });
    {
      const p = at(1, 4), f = clamp((Tm - 0.9) / 0.45, 0, 1), land = Tm - 1.35;
      if (Tm > 0.9) put(2, p, { lift: (1 - f * f) * 2.6, squash: land > 0 && land < 0.16 ? Math.sin((land / 0.16) * Math.PI) : 0, yaw: 1 });
      if (Tm > 1.35 && Tm < 1.9) mark(p.x, p.z, ringTex, '#fff0cc', 0.6 * (1 - (Tm - 1.35) / 0.55), 0.7 + (Tm - 1.35) * 2.4, BED_Y + 0.025);
    }
    const cap0 = 2.15, hop0 = 1.85, hop1 = 2.3, bon0 = 3.0, bon1 = 3.55;
    {
      const p = at(2, 2), f = (Tm - cap0) / 0.6;
      if (Tm < cap0) put(2, p, { yaw: 3 });
      else if (f < 1) { const e = ease(clamp((f - 0.22) / 0.78, 0, 1)); put(2, p, { lift: f < 0.22 ? 0.2 : 0.4 + e * 2.4, scale: 1.1 - 0.7 * e, spin: e * 7, flash: 0.6 * (1 - f) }); }
    }
    {
      const p = at(0, 5), f = (Tm - bon1) / 0.6;
      if (Tm < bon0 - 0.15) put(2, p, { yaw: 2 });
      else if (Tm < bon1) { const pu = 0.5 + 0.5 * Math.sin(Tm * 14); put(2, p, { flash: 0.4 * pu }); mark(p.x, p.z, ringTex, '#ff3a22', 0.6 + 0.4 * pu, 1.0); }
      else if (f < 1) { const e = ease(clamp((f - 0.22) / 0.78, 0, 1)); put(2, p, { lift: 0.4 + e * 2.4, scale: 1.1 - 0.7 * e, spin: e * 7 }); }
    }
    {
      const a0 = at(2, 1), a1 = at(2, 3); let pos = a0, lift = 0;
      if (Tm >= hop0 && Tm <= hop1) { const f = ease((Tm - hop0) / (hop1 - hop0)); pos = { x: a0.x + (a1.x - a0.x) * f, z: a0.z + (a1.z - a0.z) * f }; lift = Math.sin(Math.PI * f) * 1.2; }
      else if (Tm > hop1) pos = a1;
      if (Tm > 1.2 && Tm < hop0) mark(a0.x, a0.z, glowTex, '#ffe27a', clamp((Tm - 1.2) / 0.4, 0, 1) * 0.6, 1.1);
      put(1, pos, { lift, yaw: 0.4 });
      if (Tm > bon0 - 0.1 && Tm < bon1 && !state.calm) { const q = at(0, 5); beam(a1.x, a1.z, q.x, q.z, clamp((Tm - (bon0 - 0.1)) / 0.4, 0, 1), clock); }
      if (Tm > hop1 && Tm < hop1 + 0.5) {
        once(`hl${cyc}`, () => spawn(a1.x, BED_Y + 0.1, a1.z, 14, { cols: ['#ffeccc', '#f2cf9a'], speed: 1.1, up: 1.4, life: 0.6 }));
        mark(a1.x, a1.z, ringTex, '#fff6e0', 0.7 * (1 - (Tm - hop1) / 0.5), 0.7 + (Tm - hop1) * 5, BED_Y + 0.026);
      }
      if (Tm > cap0 && Tm < cap0 + 0.15) once(`hc${cyc}`, () => spawn(at(2, 2).x, SEAT + 0.35, at(2, 2).z, 12, { cols: ['#f2d9a4', '#b9743c', '#ffe08a'], speed: 1.3, up: 2.2, life: 0.8 }));
      if (Tm > bon1 && Tm < bon1 + 0.15) once(`hb${cyc}`, () => spawn(at(0, 5).x, SEAT + 0.35, at(0, 5).z, 12, { cols: ['#f2d9a4', '#b9743c', '#ffe08a'], speed: 1.3, up: 2.2, life: 0.8 }));
    }
    finishMarks();
  }

  // ----- phase 1: before the 2D UI draws (camera, pieces, projection used by 2D badges and picking)
  function prepare(state, L) {
    resize(); L_ = L; if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const kind = state.board && BOARDS3[state.board] ? state.board : 'laterite';
    setStyle(STONES[state.style] ? state.style : 'river');
    const playing = state.scene === 'play' || state.scene === 'over' || state.scene === 'lesson';
    court.fore.visible = !playing;
    if (playing) {
      const bd = L.board; flat = { sc: bd.sc, sr: bd.sr, tr: bd.tr, flip: bd.flip };
      ensureBoard(kind, bd.sc, bd.sr);
      fitCamera({ x: bd.x, y: bd.y, w: bd.W, h: bd.Hh }, L, tp || (L.land ? 54 : 63), tf || 30, state.calm ? 0 : Math.sin(clock * 0.25) * 1.6, true);
      boardState(state);
    } else {
      flat = { sc: 6, sr: 4, tr: false, flip: false };
      ensureBoard(kind, 6, 4);
      const hr = v3.heroRect || { x: L.w * 0.05, y: L.h * 0.38, w: L.w * 0.9, h: L.w * 0.6 };
      if (state.scene === 'doc') fitCamera({ x: L.w * 0.06, y: L.h * 0.3, w: L.w * 0.88, h: L.w * 0.6 }, L, 36, 36, state.calm ? 0 : Math.sin(clock * 0.15) * 8, false);
      else fitCamera(hr, L, tp || (L.land ? 28 : 24), tf || 40, state.calm ? 0 : Math.sin(clock * 0.2) * 7, true);
      heroState(state);
    }
  }
  // ----- phase 2: after the 2D UI recorded its panels and buttons
  function present(state, L, dt) {
    key.position.set(-9, 6.2, 5.5); key.target.position.set(0, 0, 0);
    motes.userData.update(clock);
    stepParts(dt);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < hudPanels.length; i++) hudPanels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) { const pressed = !!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h; placeButton(n++, b, pressed); }
    for (let i = n; i < hudButtons.length; i++) hudButtons[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -520);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envMap.rebuild(); buildHudEnv(); } catch (e) { /* no reflections, still playable */ }
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    W = 0; resize(); v3.on = true;
  });

  try { applyTier(); resize(); buildHudEnv(); ensureBoard('laterite', 6, 4); buildSprites(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; sprites.ready = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) { const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null; return game.update(dt, input); },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560, state.flip);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
