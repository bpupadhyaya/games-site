// Takoyaki Flip Stall 3D presenter. READS the simulation (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the lit night stall with a cast-iron takoyaki pan (real hemispherical moulds, oily sheen), batter that pours
// with a viscous stream, vertex-coloured balls that turn on their axis, steam, picks, a HUD scene (carved plaques, lacquer buttons,
// paper tickets, customer busts, served balls with sauce / mayo / bonito flakes). Fallbacks: no WebGL / context lost -> v3.on = false
// and every screen draws with the flat 2D art; context restored -> back to 3D without a reload.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { v3 } from '../src/v3.js';
import { playLayout, plateGeo, titleArt, overLayout } from '../src/layout.js';
import { toolIds } from '../src/view.js';
import { K } from '../src/engine.js';
import { cookColor } from '../src/art.js';
import { sprites } from '../src/sprites.js';
import * as M3 from './models.js';
import { createCook } from './cook.js';
import { createBusts } from './busts.js';

const { TAU, MOULD_R, BALL_R } = M3;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, q: 1, steam: 72 },
  { name: 'medium', dpr: 1.5, shadow: 1024, q: 0.8, steam: 48 },
  { name: 'low', dpr: 1, shadow: 0, q: 0.5, steam: 24 },
];

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  const noop = { wrap: (g) => g, ok: false };
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(0x0d0709, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);
  const Q = () => TIERS[tier];

  await tick();
  // ---------------------------------------------------------------- scene, stall, lights
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.5, 400);
  const stall = M3.buildStall({ cols: 4, rows: 3, quality: Q().q });
  scene.add(stall.group);
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: Q().shadow || 0, extent: 9, fog: false, target: [0, 0, 0],
    overrides: { bg: 0x0d0709, keyPos: [-7, 15, 9], keyI: 3.0, hemi: 0.42, fillI: 0.35, fillPos: [9, 5, 8], rimI: 1.7, rimPos: [6, 6, -9], exposure: 0.95, env: 0.34, key: 0xffd9a6 },
  });
  rig.key.shadow.camera.near = 2; rig.key.shadow.camera.far = 60; rig.key.shadow.bias = -0.0006; rig.key.shadow.normalBias = 0.02;
  const keyBase = rig.config.keyI;
  const fire = new THREE.PointLight(0xff7a2a, 0, 14, 1.6); fire.position.set(0, -0.6, 3.4); scene.add(fire);
  const lampL = new THREE.PointLight(0xffb870, 18, 40, 1.6); lampL.position.set(-3.5, 7, 3); scene.add(lampL);
  const lamp = new THREE.SpotLight(0xffd8a0, 0, 60, 0.55, 0.85, 1.2); lamp.position.set(-2, 16, 10); lamp.target.position.set(0, 0, 0); scene.add(lamp, lamp.target);
  lamp.intensity = 70;
  const env = B.createEnvironment(renderer, scene, { intensity: 0.38 });

  await tick();
  // ---------------------------------------------------------------- shared small textures
  const blobTex = M3.canvasTex(M3.blobCanvas('0,0,0', 0.7), {});
  const steamTex = M3.canvasTex(M3.blobCanvas('255,255,255', 0.9, 64), {});
  const ringTex = M3.canvasTex(M3.ringCanvas('255,255,255', 128, 0.72), {});
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  await tick();
  // ---------------------------------------------------------------- the pan rig (pan + balls + steam), one per plate size
  const M = M3.mats();
  const rigs = new Map();
  function makeRig(cols, rows) {
    const root = new THREE.Group();
    const pan = M3.buildPan(cols, rows, Q().q); root.add(pan);
    const W = pan.userData.W, D = pan.userData.D;
    const well = new THREE.Mesh(B.slab(W + 1.1, D + 1.1, 0.26, 0.5, 0.06), M.stove); well.position.set(0, M3.COUNTER_Y, 0); well.receiveShadow = true; well.castShadow = true; root.add(well);
    const balls = [];
    for (let i = 0; i < cols * rows; i++) {
      const b = M3.makeBall(Q().q), mo = pan.userData.moulds[i];
      b.raw.material = M.batter.clone(); b.root.position.set(mo.x, 0, mo.z); b.root.visible = false;
      root.add(b.root);
      const shadow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.0 })); shadow.position.set(mo.x, 0.02, mo.z); shadow.scale.setScalar(1.2); root.add(shadow);
      const ready = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: '#fff0a8', opacity: 0 })); ready.position.set(mo.x, 0.035, mo.z); ready.scale.setScalar(1.3); ready.renderOrder = 3; root.add(ready);
      balls.push({ b, shadow, ready, key: '', fil: null, filId: '', mo, wob: 0, lastFill: 0 });
    }
    const r = { cols, rows, root, pan, W, D, well, balls };
    rigs.set(`${cols}x${rows}`, r);
    return r;
  }
  const rigFor = (c, r) => rigs.get(`${c}x${r}`) || makeRig(c, r);
  let active = null;     // the rig currently shown
  const showRig = (r) => { if (active === r) return; if (active) scene.remove(active.root); scene.add(r.root); active = r; };

  await tick();
  // ---------------------------------------------------------------- tools in the scene: ladle, batter stream, picks
  const ladle = M3.makeLadle(); ladle.scale.setScalar(0.62); scene.add(ladle);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.026, 1, 10, 6), M.batter); stream.visible = false; scene.add(stream);
  const picks = M3.makePicks(); scene.add(picks);
  const pickState = { t0: -9, cell: -1 };

  await tick();
  // ---------------------------------------------------------------- steam + sparks
  const steam = [];
  const steamRoot = new THREE.Group(); scene.add(steamRoot);
  function ensureSteam(n) {
    while (steam.length < n) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      sp.visible = false; steamRoot.add(sp); steam.push(sp);
    }
  }
  const NS = 56;
  const spark = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), NS);
  spark.frustumCulled = false; scene.add(spark);
  const parts = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function burst(x, y, z, n, vy = 1.6, sp0 = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + i * 0.7, sp = sp0 + ((i * 37) % 10) * 0.1;
      parts.push({ x, y, z, vx: Math.cos(a) * sp, vy: vy + ((i * 13) % 7) * 0.25, vz: Math.sin(a) * sp, life: 0, max: 0.55 + ((i * 7) % 5) * 0.1 });
    }
    if (parts.length > NS) parts.splice(0, parts.length - NS);
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life += dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.life >= p.max || p.y < -0.1) parts.splice(i, 1); }
    for (let i = 0; i < NS; i++) {
      const p = parts[i];
      if (!p) _m.makeScale(0, 0, 0); else { const k = 1 - p.life / p.max; _p.set(p.x, p.y, p.z); _s.setScalar(0.5 + k); _m.compose(_p, _q, _s); }
      spark.setMatrixAt(i, _m);
    }
    spark.instanceMatrix.needsUpdate = true;
  }

  // flying balls (served to a customer / sent to the tray / scraped)
  const flights = [], flightPool = [];
  function flyBall(x, z, kind, tint) {
    const g = flightPool.pop() || (() => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshPhysicalMaterial({ color: '#d99a3a', roughness: 0.5, clearcoat: 0.4 })); m.castShadow = true; scene.add(m); return m; })();
    g.material.color.set(tint || '#d99a3a'); g.visible = true;
    flights.push({ g, x0: x, z0: z, t: 0, kind });
  }
  function stepFlights(dt) {
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]; f.t += dt;
      const T = f.kind === 'serve' ? 0.7 : 0.5, u = clamp(f.t / T, 0, 1), e = ease(u);
      const dz = f.kind === 'serve' ? -9 : f.kind === 'tray' ? 6 : 0, dx = f.kind === 'serve' ? (f.x0 > 0 ? 1 : -1) * 1.5 : 0;
      f.g.position.set(f.x0 + dx * e, 0.4 + Math.sin(Math.PI * u) * (f.kind === 'scrape' ? 1.2 : 2.6) - (f.kind === 'tray' ? u * 0.4 : 0), f.z0 + dz * e);
      f.g.scale.setScalar(BALL_R * (1 - 0.35 * e)); f.g.rotation.x = u * 7;
      if (u >= 1) { f.g.visible = false; flightPool.push(f.g); flights.splice(i, 1); }
    }
  }

  await tick();
  // ---------------------------------------------------------------- HUD: carved plaques, lacquer buttons, trays, busts
  const hud = new THREE.Scene(), hudScroll = new THREE.Group(), hudStatic = new THREE.Group();
  hud.add(hudStatic, hudScroll);
  const hudCam = new THREE.PerspectiveCamera();
  const hudLight = new THREE.DirectionalLight(0xffe9c8, 1.8); hudLight.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xaec4ff, 0.4); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x1a1208, 0.4), hudLight, hudFill);
  const syncHudEnv = () => { hud.environment = scene.environment; hud.environmentIntensity = 0.32; };
  syncHudEnv();
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const woodHud = B.material('darkWood', { color: '#4a2a16', color2: '#7a4a26', repeat: [3, 3], seed: 9 });
  const lac = (c, em, ei = 0.5) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.4, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.4, emissive: em, emissiveIntensity: ei });
  const inkHud = new THREE.MeshStandardMaterial({ color: '#16100d', roughness: 0.86, metalness: 0.04 });
  const inkDeep = new THREE.MeshStandardMaterial({ color: '#0e0a08', roughness: 0.9 });
  const inkHot = new THREE.MeshStandardMaterial({ color: '#2a1d10', roughness: 0.8, emissive: '#3a2406', emissiveIntensity: 0.9 });
  const steelIn = new THREE.MeshStandardMaterial({ color: '#7d8087', roughness: 0.38, metalness: 0.85, envMapIntensity: 1.1 });
  const paperHud = new THREE.MeshStandardMaterial({ color: '#f3e8cb', roughness: 0.85 });
  const brassHud = B.material('brass', { envIntensity: 1.4 });
  const lacRed = lac('#a4261a', '#4a0c06'), lacDark = lac('#35201a', '#100806', 0.3), lacOn = lac('#b9801f', '#5a3606', 0.7), lacGold = lac('#e0a22e', '#6a4306', 0.8), lacDim = lac('#241714', '#0a0605', 0.2);
  const lacGreen = lac('#3f9b4a', '#0a3a10', 0.6), lacGrey = lac('#6a6a6a', '#101010', 0.1);
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x050202, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x080303, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(dim);
  const panels = [], buttons = [];
  const ROT = Math.PI / 2;
  const layerZ = (l) => -1500 + l * 520;
  let clock = 0;
  function panelAt(i) {
    let p = panels[i];
    if (!p) {
      const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, woodHud), trim = new THREE.Mesh(flatQuad, brassHud), inner = new THREE.Mesh(flatQuad, inkHud), hdr = new THREE.Mesh(flatQuad, lacRed);
      g.add(outer, trim, inner, hdr); p = { g, outer, trim, inner, hdr }; panels.push(p);
    }
    return p;
  }
  function placePanel(i, it) {
    const p = panelAt(i), r = it.r, kind = it.kind;
    if (kind === 'none') { p.g.visible = false; return; }
    const parent = it.clip ? hudScroll : hudStatic;
    if (p.g.parent !== parent) parent.add(p.g);
    p.g.visible = true;
    const paper = kind === 'ticket';
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), z = layerZ(it.layer || 0) + (paper ? 150 : 0);
    const dep = kind === 'banner' ? 8 : paper ? 9 : kind === 'sign' ? 18 : 14, ins = kind === 'tray' ? 9 : kind === 'banner' ? 5 : 7;
    const rad = Math.max(4, it.rad || 14);
    p.outer.visible = !paper; p.trim.visible = !paper;
    p.g.position.set(paper && it.urgent ? Math.sin(clock * 60) * 1.4 : 0, 0, 0);
    if (paper) {
      p.inner.geometry = slabG(r.w, r.h, dep, rad, 3); p.inner.rotation.x = ROT; p.inner.position.set(cx0, cy0, z); p.inner.material = paperHud;
      const hd = it.hdr;
      if (hd) {
        const left = it.hdrSide === 'left', hh = left ? r.h : it.hdrH, ww = left ? it.hdrH : r.w;
        p.hdr.visible = true; p.hdr.geometry = slabG(ww, hh, dep + 2, Math.min(rad, 12), 2); p.hdr.rotation.x = ROT;
        p.hdr.position.set(left ? r.x + ww / 2 : cx0, -(left ? r.y + r.h / 2 : r.y + hh / 2), z);
        p.hdr.material = hd === '#3f9b4a' ? lacGreen : hd === '#7a7a7a' ? lacGrey : lacRed;
      } else p.hdr.visible = false;
    } else {
      p.hdr.visible = false;
      p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx0, cy0, z);
      p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx0, cy0, z);
      p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx0, cy0, z);
      p.inner.material = kind === 'tray' ? steelIn : kind === 'banner' ? (it.hot ? inkHot : inkDeep) : kind === 'tileCur' ? inkHot : kind === 'tileLocked' ? inkDeep : inkHud;
    }
  }
  function buttonAt(i) {
    let b = buttons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(flatQuad, lacDark), rim = new THREE.Mesh(flatQuad, brassHud), halo = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ color: '#8be08a', transparent: true, opacity: 0.0 })); g.add(halo, rim, body); b = { g, body, rim, halo }; buttons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r, parent = bt.clip ? hudScroll : hudStatic;
    if (b.g.parent !== parent) parent.add(b.g);
    b.g.visible = true;
    const cx0 = r.x + r.w / 2, cy0 = -(r.y + r.h / 2), rad = Math.min(bt.radius || 18, r.h / 3), z = layerZ(bt.layer || 0) + 70, dep = pressed || bt.flash > 0.4 ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx0, cy0, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx0, cy0, z);
    b.body.material = bt.dim ? lacDim : bt.primary ? lacGold : bt.on ? lacOn : lacDark;
    b.g.position.set(0, pressed ? -3 : 0, 0);
    if (bt.pulse) { b.halo.visible = true; b.halo.geometry = slabG(r.w + 10, r.h + 10, 4, rad + 3, 2); b.halo.rotation.x = ROT; b.halo.position.set(cx0, cy0, z - 6); b.halo.material.opacity = 0.5 + 0.4 * Math.sin(clock * 8); } else b.halo.visible = false;
  }

  // served balls in the warm tray (screen-space, same HUD scene)
  const trayBalls = [];
  const trayRoot = new THREE.Group(); hudStatic.add(trayRoot);
  function trayBall(i) {
    let b = trayBalls[i];
    if (!b) { const g = new THREE.Group(), s = M3.makeServed(i + 1); g.add(s); trayRoot.add(g); b = { g, s }; trayBalls.push(b); }
    return b;
  }

  await tick();
  // ---------------------------------------------------------------- camera fitting
  let W = 1, H = 1, dprNow = 1, L_ = null, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, Q().dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3(), tmpW = new THREE.Vector3();
  // Fit the NEAR edge of a panW x panD pan (top plane y=0) to rect.w and centre the pan on rect (virtual units).
  function fitCamera(rect, L, panW, panD, pitchDeg, fov, yawDeg = 0, lookY = 0) {
    const k = W / L.w, targetW = rect.w * k, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 20;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    };
    for (let it = 0; it < 6; it++) {
      place();
      const a = tmpV.set(-panW / 2, 0, panD / 2).project(camera).x, b = tmpW.set(panW / 2, 0, panD / 2).project(camera).x;
      d *= (((b - a) / 2) * W) / targetW;
    }
    place();
    const c = tmpV.set(0, 0, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const toVirt = (x, y, z, out = {}) => { tmpV.set(x, y, z).project(camera); out.x = ((tmpV.x + 1) / 2) * L_.w; out.y = ((1 - tmpV.y) / 2) * L_.h; return out; };
  function projectCells(r) {
    const cells = [], a = {}, b = {}, c = {}, d = {};
    for (const mo of r.pan.userData.moulds) {
      toVirt(mo.x, 0.1, mo.z, a); toVirt(mo.x + 0.5, 0.1, mo.z, b); toVirt(mo.x - 0.5, 0.1, mo.z, c); toVirt(mo.x, 0.1, mo.z + 0.5, d);
      const cw = Math.hypot(b.x - c.x, b.y - c.y), dz = Math.abs(d.y - a.y) * 2;
      cells.push({ cx: a.x, cy: a.y, c: cw, r: cw * 0.4, ky: clamp(dz / Math.max(1, cw), 0.35, 1) });
    }
    v3.cells = cells; v3.cellsFor = `${r.cols}x${r.rows}`; v3.ky = cells[0] ? cells[0].ky : 0.8;
  }

  await tick();
  // ---------------------------------------------------------------- frame state
  let lastT = 0, frames = 0, ema = 16, fdt = 0.016, lastEv = 0;
  const synth = (cols, rows, T) => {   // a looping demonstration plate for the title and the rules figures
    const out = [];
    for (let i = 0; i < cols * rows; i++) {
      const ph = (T * 0.16 + i * 0.37) % 4, b = Math.floor(ph) % 4, f = ph - Math.floor(ph), q = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) q[k] = clamp(0.1 + ((ph - k + 8) % 4) * 0.26, 0.1, 1.0);
      q[b] = clamp(0.2 + f * 0.8, 0, 1.0);
      out.push({ i, hs: i === 4 ? 1.3 : 1, st: 'ball', fill: 0.95, fil: i === 1 ? 'cheese' : i === 4 ? 'corn' : null, q, b: (b + 1) % 4, flips: 1, spill: 0, ovf: 0, flipT: f < 0.12 ? f * 2.8 : 9, age: 0, ready: false });
    }
    return out;
  };

  // one frame of the pan: balls, fillings, bowls, steam
  function updateRig(r, plate, o) {
    const flame = o.flame ?? 1, hotMul = 0.5 + 0.5 * flame;
    let sN = 0;
    ensureSteam(Q().steam);
    for (let i = 0; i < plate.length; i++) {
      const m = plate[i], E = r.balls[i], mo = E.mo, b = E.b;
      const hot = clamp((m.hs - 1.0) / 0.4, 0, 1) * hotMul;
      mo.mat.emissiveIntensity = hot * (0.55 + 0.15 * Math.sin(clock * 3 + i)) + (m.st === 'burnt' ? 0.05 : 0);
      const empty = m.st === 'empty' || (m.fill <= 0.002 && m.st !== 'burnt');
      const isReady = m.st === 'ball' && m.fill >= 0.35 && Math.min(...m.q) >= K.GOLD * 0.97;
      E.ready.material.opacity = isReady ? 0.45 + 0.35 * Math.sin(clock * 6) : 0;
      if (empty) { b.root.visible = false; E.shadow.material.opacity = 0; if (E.fil) E.fil.visible = false; continue; }
      b.root.visible = true;
      const fillK = clamp(m.fill / 0.95, 0, 1.15), burnt = m.st === 'burnt';
      if (m.fill > E.lastFill + 0.002) E.wob = clock;           // settle wobble after the ladle (viscous batter)
      E.lastFill = m.fill;
      const tw = clock - E.wob, wob = tw < 0.9 ? Math.exp(-tw * 5) * Math.sin(tw * 26) : 0;
      if (m.fill < 0.35 && !burnt) {
        // a thin pool of batter in the bowl
        const lv = clamp(m.fill / 0.35, 0, 1), depth = MOULD_R * (0.82 - 0.38 * lv), rad = Math.sqrt(Math.max(0.01, MOULD_R * MOULD_R - depth * depth)) * 0.97;
        b.root.scale.setScalar(1); b.root.position.set(mo.x, 0, mo.z); b.root.rotation.z = 0;
        b.disc.visible = true; b.disc.scale.set(rad * (1 + wob * 0.04), rad * (1 + wob * 0.04), 1); b.disc.position.y = -depth + wob * 0.01;
        b.spin.visible = false; b.skirt.visible = false; b.disc.material = b.raw.material;
        b.raw.material.color.set('#f4e7bb');
        E.shadow.material.opacity = 0; if (E.fil) E.fil.visible = false;
        continue;
      }
      b.disc.visible = false; b.spin.visible = true;
      const R = BALL_R * (0.74 + 0.26 * Math.min(1, fillK)) * (fillK > 1 ? 1 + (fillK - 1) * 0.35 : 1);
      const yc = R <= MOULD_R ? -(MOULD_R - R) * 0.9 : (R - MOULD_R) * 0.8 + 0.02;
      const fe = m.flipT < 0.34 ? m.flipT / 0.34 : 1, e = 1 - (1 - fe) ** 3, pop = m.flipT < 0.34 ? Math.sin(Math.PI * fe) : 0;
      const liquid = m.flips === 0 && m.q[m.b] < K.RAW;
      b.mesh.visible = !burnt && !liquid; b.raw.visible = !burnt && liquid; b.burnt.visible = burnt;
      if (liquid) b.raw.material.color.set(cookColor(clamp(m.q[m.b] * 0.8, 0, 1)));   // pale batter warming to cream
      if (b.mesh.visible) {
        const sig = `${Math.round(m.q[0] * 40)},${Math.round(m.q[1] * 40)},${Math.round(m.q[2] * 40)},${Math.round(m.q[3] * 40)}`;
        if (sig !== E.key) { E.key = sig; b.paint(m.q, m.hs); }
      }
      // rotation about the pan's x axis: the bottom quarter faces down; a flip turns the ball a quarter
      const theta = (m.b + 1) * (Math.PI / 2) - (1 - e) * (Math.PI / 2) * (m.flipT < 0.34 ? 1 : 0);
      b.spin.rotation.set(theta, hash(i) * 0.5, 0);
      const sq = 1 + pop * 0.04, wv = 1 + wob * 0.025, lift = pop * R * 0.55;
      b.root.position.set(mo.x, yc + lift, mo.z);
      b.root.scale.set(R * (2 - sq), R * sq * wv, R * (2 - sq));
      b.root.rotation.z = m.flipT >= 0.34 && m.flipT < 1.2 ? Math.exp(-(m.flipT - 0.34) * 5) * Math.sin((m.flipT - 0.34) * 26) * 0.05 : 0;
      const sk = m.ovf > 0;
      b.skirt.visible = sk;
      if (sk) { b.skirt.scale.setScalar(MOULD_R * (1.2 + Math.min(0.5, m.ovf * 0.5)) / R); b.skirt.position.y = (0.015 - (yc + lift)) / R; b.skirt.material.opacity = clamp(m.ovf * 1.2, 0.2, 0.65); }
      E.shadow.material.opacity = 0.6 * (1 - clamp(pop * 0.8, 0, 0.7)); E.shadow.scale.setScalar(1.0 + R * 0.6 + pop * 0.2);
      // filling visible in the batter before the first flip
      if (m.fil && m.flips === 0) {
        if (E.filId !== m.fil) { if (E.fil) r.root.remove(E.fil); E.fil = M3.makeFilling(m.fil, i + 1); r.root.add(E.fil); E.filId = m.fil; }
        E.fil.visible = true; E.fil.position.set(mo.x, yc + R * 0.86 + wob * 0.01, mo.z); E.fil.scale.setScalar(R * 1.4);
      } else if (E.fil) E.fil.visible = false;
      // steam: rising puffs, dark for burnt
      if (!o.noSteam && sN < steam.length - 3) {
        const base = clamp(m.q[m.b] / 1.0, 0.15, 1), n = burnt ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const sp = steam[sN++], ph = (clock * (burnt ? 0.45 : 0.3) + k / n + i * 0.173) % 1;
          sp.visible = true;
          sp.position.set(mo.x + Math.sin(ph * 6 + k * 2 + i) * 0.28, yc + R + 0.15 + ph * 2.4, mo.z + Math.cos(ph * 5 + k) * 0.2);
          sp.scale.setScalar(0.5 + ph * 1.1);
          sp.material.color.set(burnt ? '#2a2422' : '#ffffff'); sp.material.opacity = (burnt ? 0.5 : 0.2 * base) * (1 - ph) * Math.min(1, ph * 6);
        }
      }
    }
    for (let k = sN; k < steam.length; k++) steam[k].visible = false;
  }

  await tick();
  // ---------------------------------------------------------------- events from the sim (one way: game -> presenter)
  let cookApi = null, bustApi = null;
  function consumeEvents(r) {
    for (const e of v3.events) {
      if (e.id <= lastEv) continue;
      lastEv = e.id;
      if (!r || v3.scene !== 'play') continue;
      const mo = e.i !== undefined && e.i >= 0 ? r.balls[e.i]?.mo : null;
      switch (e.type) {
        case 'flip': if (mo) { pickState.cell = e.i; pickState.t0 = clock; burst(mo.x, 0.5, mo.z, e.golden ? 14 : 6, 1.4, 0.8); cookApi?.flipAt?.(mo.x, mo.z); } break;
        case 'spill': if (mo) { burst(mo.x, 0.4, mo.z, 9, 1.0, 1.0); pickState.cell = e.i; pickState.t0 = clock; } break;
        case 'topping': if (mo) burst(mo.x, 0.7, mo.z, 5, 0.9, 0.5); break;
        case 'overflow': if (mo) burst(mo.x, 0.3, mo.z, 8, 0.8, 0.9); break;
        case 'ready': if (mo) burst(mo.x, 0.9, mo.z, 6, 1.2, 0.5); break;
        case 'burnt': if (mo) burst(mo.x, 0.6, mo.z, 8, 1.0, 0.8); break;
        case 'serve': { const m2 = r.balls[e.from]?.mo; if (e.from >= 0 && m2) { flyBall(m2.x, m2.z, 'serve', '#d99a3a'); pickState.cell = e.from; pickState.t0 = clock; } bustApi?.react?.(e.cust, 'happy'); break; }
        case 'tray': if (mo) { flyBall(mo.x, mo.z, 'tray', '#d99a3a'); pickState.cell = e.i; pickState.t0 = clock; } break;
        case 'scrape': if (mo) { flyBall(mo.x, mo.z, 'scrape', '#3a2a1a'); burst(mo.x, 0.4, mo.z, 6, 0.8, 0.8); } break;
        case 'ticket': bustApi?.react?.(e.cust, 'thanks'); break;
        case 'leave': bustApi?.react?.(e.cust, 'leave'); break;
        default: break;
      }
    }
  }

  await tick();
  // ---------------------------------------------------------------- tools animation
  const ladleRest = new THREE.Vector3(), ladlePos = new THREE.Vector3(), ladleTgt = new THREE.Vector3();
  const tipTgt = new THREE.Vector3(), pdir = new THREE.Vector3(), zNeg = new THREE.Vector3(0, 0, -1);
  let ladleInit = false, ladleTilt = 0, tipInit = false; const tipS = new THREE.Vector3(), tipV = new THREE.Vector3();
  function animateTools(r, state, dt) {
    const D = r.D;
    ladleRest.set(-(r.W / 2 + 0.4) + 0.2, M3.COUNTER_Y + 1.15, -(D / 2 + 1.9));   // rests in the batter bowl
    const pf = state.pourFx, pouring = !!pf && pf.age < 0.22 && !!state.sim && !state.paused;
    let tgtTilt = 0.35;
    if (pouring) { const mo = r.balls[pf.i]?.mo; if (mo) { ladleTgt.set(mo.x + 0.28, 0.8, mo.z - 0.05); tgtTilt = 1.0; } else ladleTgt.copy(ladleRest); }
    else ladleTgt.copy(ladleRest);
    if (!ladleInit) { ladlePos.copy(ladleRest); ladleInit = true; }
    const k = 1 - Math.exp(-dt * (pouring ? 14 : 7));
    ladlePos.lerp(ladleTgt, k); ladleTilt += (tgtTilt - ladleTilt) * k;
    ladle.position.copy(ladlePos); ladle.rotation.set(0, 0.5, -ladleTilt * 0.1 + (pouring ? 0.15 : 0));
    ladle.visible = true;
    // viscous stream: a column from the lip to the batter, swaying slowly, thicker at the lip
    stream.visible = false;
    if (pouring) {
      const mo = r.balls[pf.i]?.mo, m = state.sim.plate[pf.i];
      if (mo && m) {
        const topY = ladlePos.y + 0.05, surfY = m.fill < 0.35 ? -MOULD_R * (0.82 - 1.0 * m.fill) : BALL_R * (0.74 + 0.26 * Math.min(1, m.fill / 0.95)) * 0.8;
        const h = Math.max(0.1, topY - surfY), sway = Math.sin(clock * 9) * 0.02;
        stream.visible = true; stream.position.set(mo.x + sway, surfY + h / 2, mo.z - 0.05); stream.scale.set(1 + Math.sin(clock * 22) * 0.08, h, 1 + Math.sin(clock * 22 + 1) * 0.08);
      }
    }
    // picks: hover over the last cell for a moment, then rest at the right of the pan
    const tt = clock - pickState.t0, activeP = pickState.cell >= 0 && tt < 0.7 && !!r.balls[pickState.cell];
    let ph = 0;
    if (activeP) {
      const mo = r.balls[pickState.cell].mo;
      ph = tt < 0.1 ? ease(tt / 0.1) : tt < 0.36 ? 1 : 1 - ease((tt - 0.36) / 0.34);
      const dip = tt > 0.08 && tt < 0.36 ? Math.sin(((tt - 0.08) / 0.28) * Math.PI) * 0.2 : 0;
      tipTgt.set(mo.x, 0.4 + (1 - ph) * 1.8 - dip, mo.z + 0.05);
    } else tipTgt.set(r.W / 2 + 1.2, 1.6, D / 2 + 1.4);
    if (!tipInit) { tipS.copy(tipTgt); tipInit = true; }
    { const w0 = activeP ? 26 : 14, sub = 4, h = Math.min(dt, 0.05) / sub;    // critically damped spring: continuous velocity, no teleport between cells
      for (let q = 0; q < sub; q++) { tipV.addScaledVector(tipTgt.clone().sub(tipS), w0 * w0 * h).multiplyScalar(1 - 2 * w0 * h); tipS.addScaledVector(tipV, h); } }
    tipTgt.copy(tipS);
    pdir.set(-0.52, -0.46, -0.72).normalize();   // the cook's right hand reaches in from the bottom-right at a steady angle
    picks.position.copy(tipTgt).addScaledVector(pdir, -3.8);
    picks.quaternion.setFromUnitVectors(zNeg, pdir);
    picks.children.forEach((p, ix) => { p.rotation.y = (ix ? 1 : -1) * (0.025 + (1 - ph) * 0.02) * (activeP ? 1 : 0); });
    picks.visible = activeP;
    cookApi?.update?.(dt, { picks, ladle, pouring, active: activeP, tool: state.tool, tipTarget: tipTgt, ladlePos, r, clock });
  }

  await tick();
  // ---------------------------------------------------------------- title / doc hero, result boat
  let boat = null, boatN = 0;
  function ensureBoat(n) { if (boat && boatN === n) return; if (boat) scene.remove(boat); boat = M3.makeBoat(n); boatN = n; scene.add(boat); }

  await tick();
  // ---------------------------------------------------------------- phase 1: before the 2D UI draws
  function prepare(state, L) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const sc = state.scene; v3.scene = sc;
    v3.cells = null;
    if (sc === 'play' && state.sim) {
      const sim = state.sim, r = rigFor(sim.cols, sim.rows); showRig(r);
      r.root.visible = true; if (boat) boat.visible = false;
      const pl = playLayout(L.w, L.h, { ids: toolIds(sim.spec), auto: state.auto.on });
      const rect = plateGeo(pl.area, sim.cols, sim.rows, false).rect;
      fitCamera({ x: rect.x, y: rect.y, w: rect.w, h: rect.h }, L, r.W, r.D, pl.mode === 'land' ? 56 : 50, 26, 0, 0);
      projectCells(r);
      consumeEvents(r);
      updateRig(r, sim.plate, { flame: sim.flame });
      animateTools(r, state, fdt);
      fire.intensity = 5 + 8 * sim.flame;
      cookApi?.setVisible?.(true);
      return;
    }
    cookApi?.setVisible?.(false);
    consumeEvents(null);
    const r = rigFor(3, 2); showRig(r);
    ladle.visible = false; picks.visible = false; stream.visible = false;
    fire.intensity = 8;
    const T = state.prefs && state.prefs.calm ? 1.2 : clock;
    let rect;
    if (sc === 'title') rect = titleArt(L.w, L.h).hero;
    else if (sc === 'over') { const A = overLayout(L.w, L.h).art; rect = { x: A.x, y: A.y + A.h * 0.1, w: A.w, h: A.h * 0.68 }; }
    else rect = { x: L.w * 0.08, y: L.h * 0.6, w: L.w * 0.84, h: L.w * 0.5 };
    if (sc === 'over') {
      r.root.visible = false; ensureBoat(clamp((state.result && state.result.balls) || 6, 2, 8)); boat.visible = true;
      const bw = Math.max(3.2, boatN * 0.62) + 0.3;
      fitCamera(rect, L, bw, 2.3, 46, 28, Math.sin(clock * 0.3) * 6, 0);
    } else {
      r.root.visible = true; if (boat) boat.visible = false;
      fitCamera(rect, L, r.W, r.D, 42, 30, Math.sin(clock * 0.2) * 5, 0);
      updateRig(r, synth(3, 2, T), { flame: 1 });
    }
  }

  await tick();
  // ---------------------------------------------------------------- phase 2: after the 2D UI registered panels and buttons
  function present(state, L, dt) {
    const sim = state.sim;
    stall.update(clock, state.prefs && state.prefs.calm, sim ? sim.flame : 1);
    rig.key.intensity = keyBase * (1 + 0.04 * Math.sin(clock * 9.1) * Math.sin(clock * 3.3 + 1));
    stepParts(dt); stepFlights(dt);
    if (boat && boat.visible) boat.userData.update(clock);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p);
    if (v3.scene === 'title') placePanel(n++, { r: titleArt(L.w, L.h).sign, rad: 26, kind: 'sign', layer: 0 });
    for (let i = n; i < panels.length; i++) panels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const r = b.r, pressed = !!pr && pr.x >= r.x && pr.x <= r.x + r.w && pr.y >= r.y && pr.y <= r.y + r.h && !b.dim;
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < buttons.length; i++) buttons[i].g.visible = false;
    // warm tray: served balls with sauce, mayo, aonori and bonito flakes
    let t = 0;
    for (const it of v3.trays) {
      const tb = trayBall(t++); tb.g.visible = true;
      tb.g.position.set(it.x, -it.y, layerZ(0) + 60); tb.g.scale.setScalar(it.r * 0.92); tb.g.rotation.set(-0.95, 0.3 * t, 0);
      tb.s.userData.update(clock + t, 1);
    }
    for (let i = t; i < trayBalls.length; i++) trayBalls[i].g.visible = false;
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, layerZ(1) - 40);
    const dimK = ['title', 'play'].includes(state.scene) ? 0 : 0.62;
    dim.visible = dimK > 0; dim.material.opacity = dimK; dim.scale.set(L.w * 2, L.h * 2, 1); dim.position.set(L.w / 2, -L.h / 2, layerZ(0) - 80);
    bustApi?.update?.(dt, state, clock, v3.custs);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    if (v3.scene === 'play') cookApi?.render?.(renderer, camera);
    renderer.clearDepth();
    renderer.clippingPlanes = [];
    hudScroll.visible = false; hudStatic.visible = true;
    renderer.render(hud, hudCam);
    const clipItem = v3.panels.find((p) => p.clip) || v3.buttons.find((b) => b.clip);
    if (clipItem) {
      const c = clipItem.clip;
      renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), -c.y), new THREE.Plane(new THREE.Vector3(0, 1, 0), c.y + c.h)];
      hudStatic.visible = false; hudScroll.visible = true;
      renderer.render(hud, hudCam);
      renderer.clippingPlanes = [];
      hudStatic.visible = true;
    }
    bustApi?.render?.(renderer, W / L.w, H);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; resize(); try { env.rebuild(); syncHudEnv(); } catch { /* keep going without IBL */ } v3.on = true; });

  function applyTier() {
    const t = Q();
    renderer.shadowMap.enabled = t.shadow > 0; rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (rig.key.shadow.map) { rig.key.shadow.map.dispose(); rig.key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  await tick();
  // ---------------------------------------------------------------- sprites for the flat 2D layer (rules figures)
  function buildSprites() {
    const SW = 560, SH = 380, r = rigFor(3, 2), prW = renderer.getPixelRatio();
    const hide = [stall.group, ladle, picks, stream, spark, steamRoot];
    const vis = hide.map((o) => o.visible);
    const bg = scene.background; scene.background = new THREE.Color('#16100d');
    showRig(r); r.root.visible = true;
    renderer.setPixelRatio(1); renderer.setSize(SW, SH, false);
    renderer.shadowMap.enabled = false;
    const grab = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(renderer.domElement, 0, 0, w, h); return c; };
    const shoot = (fn) => { hide.forEach((o) => { o.visible = false; }); fn(); renderer.setViewport(0, 0, SW, SH); renderer.clear(true, true, true); renderer.render(scene, camera); hide.forEach((o, i) => { o.visible = vis[i]; }); };
    const plate = [];
    for (let i = 0; i < 6; i++) plate.push({ i, hs: i === 4 ? 1.3 : 1, st: i === 5 ? 'empty' : 'ball', fill: i === 5 ? 0 : i === 3 ? 0.3 : 0.95, fil: i === 1 ? 'cheese' : null, q: [0.5 + i * 0.08, 0.2, 0.05, 0.1], b: 0, flips: i === 2 ? 1 : 0, spill: 0, ovf: 0, flipT: 9, age: 0, ready: false });
    camera.clearViewOffset(); camera.fov = 30; camera.aspect = SW / SH; camera.updateProjectionMatrix();
    camera.position.set(0, 5.6, 4.7); camera.lookAt(0, 0, -0.1); camera.updateMatrixWorld();
    updateRig(r, plate, { flame: 1, noSteam: true });
    shoot(() => {});
    sprites.plate = grab(SW, SH);
    const one = (q, b) => {
      const pl = []; for (let i = 0; i < 6; i++) pl.push({ i, hs: 1, st: i === 0 ? 'ball' : 'empty', fill: i === 0 ? 0.95 : 0, fil: null, q, b, flips: 1, spill: 0, ovf: 0, flipT: 9, age: 0, ready: false });
      updateRig(r, pl, { flame: 1, noSteam: true });
      const mo = r.balls[0].mo;
      camera.position.set(mo.x, 3.1, mo.z + 1.0); camera.lookAt(mo.x, 0.15, mo.z); camera.fov = 34; camera.aspect = 1; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      shoot(() => {});
      return grab(SH, SH);
    };
    sprites.ball = one([0.95, 0.55, 0.12, 0.32], 3);
    sprites.ring = one([0.84, 0.3, 0.1, 0.4], 0);
    ensureBoat(6); r.root.visible = false;
    camera.fov = 30; camera.aspect = SW / SH; camera.updateProjectionMatrix(); camera.position.set(0, 5.2, 4.6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    shoot(() => {});
    sprites.boat = grab(SW, SH);
    boat.visible = false; r.root.visible = true;
    scene.background = bg; renderer.setPixelRatio(prW); W = 0;
    renderer.shadowMap.enabled = Q().shadow > 0;
    sprites.ready = true;
  }

  try {
    applyTier(); ensureSteam(Q().steam); rigFor(3, 2);
    cookApi = await createCook({ scene, THREE, renderer }).catch((e) => { console.warn('cook hands unavailable', e); return null; });
    bustApi = await createBusts({ THREE, hud, layerZ }).catch((e) => { console.warn('customer busts unavailable', e); return null; });
  } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  await tick();
  try { buildSprites(); } catch (e) { console.warn('sprite build failed', e); }
  await tick();
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, env, v3, stall, rigs, picks, ladle, cook: () => cookApi,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = { w: view?.width ?? 720, h: view?.height ?? 1560 };
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += state.paused ? 0 : dt; fdt = Math.max(dt, 0.001);
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.trays.length = 0; v3.custs.length = 0; v3.scrim = 0; v3.layer = 0; v3.sign = null; v3.boat = null; v3.heroRect = null;
          try { prepare(state, L); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
