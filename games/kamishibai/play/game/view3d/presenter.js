// The 3D presenter for Kamishibai. It READS the game state (getState) and the layout the 2D layer publishes (GL.f); it never writes back.
//
// A WebGL canvas sits behind the transparent kit canvas: a dusk street corner, the storyteller's wooden box on a bicycle with its three
// doors open, the picture cards (real paper slabs that slide in and out of the frame, lie on a lantern-lit card rack while you arrange
// them), the storyteller himself (a real 3D man), and a ring of seated children (crowd3d). The kit canvas keeps the HUD, text, menus and
// input. Without WebGL, or while the context is lost, GL.active is false and the 2D scene in view.js / art.js draws instead.
//
// Camera: a perspective camera aimed at the middle of the front card. The layout rects the 2D layer uses (in virtual units) are mapped to CSS
// pixels (GL.f.k, ox, oy) and the camera is solved so that the card plane sits at exactly that pixel size, which keeps the 2D overlays
// (pull tab, beat ring, selection frames) glued to the 3D cards.
import { GL } from '../src/gl.js';
import { STORIES } from '../src/stories.js';
import { buildWorld, GY, canvasTex, makeLantern } from './world.js';
import { buildButai, buildBicycle, buildCandy, CARD_W, CARD_H } from './butai.js';
import { createCardKit, makeCardMesh } from './cards.js';
import { createTeller } from './teller.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const D2R = Math.PI / 180;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const mid = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'low' : mid ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { ready: false, ready_p: null, wrap: (g) => g, abort() {} };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE, createCrowd3d, board3d: B } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'night', mode: 'continuous', shadows: quality !== 'low', shadowSize: 1.5, autoLOD: false, fov: 24, transparent: false });
  if (!stage.supported || !stage.renderer) { canvas.remove(); return none; }
  const scene = stage.scene, cam = stage.camera;
  scene.background = new THREE.Color('#1a1636');

  const P = { stage, THREE, ready: false, active: false, lost: false, tier: quality, quality, frames: 0, dbg: /[?&]dbg=1/.test(location.search), mode: '' };
  const qs = new URLSearchParams(location.search);
  P.camOverride = qs.get('cam');
  P.kidPpm = Number(qs.get('kppm')) || 0;
  P.cv = qs.get('cv') ? Object.fromEntries(qs.get('cv').split(',').map((kv) => { const [k, v] = kv.split(':'); return [k, Number(v)]; })) : null;

  // ---- lighting: lantern-warm key from the front left above, cool moon rim from behind, dusk hemisphere ----------------------------------------
  stage.setLighting('night', { hemiSky: 0x6670b8, hemiGround: 0x4a3326, hemi: 0.75, key: 0xffc784, keyI: 2.6, rim: 0x7a96ff, rimI: 1.4, exposure: 1.05 });
  scene.fog = new THREE.Fog('#2b2048', 14, 62);
  stage._shadowOffset.set(-1.2, 2.4, 2.6);
  scene.environmentIntensity = 0.55;

  // ---- objects --------------------------------------------------------------------------------------------------------------------------
  const world = buildWorld({ quality: P.tier });
  scene.add(world.group);
  const rig = new THREE.Group(); scene.add(rig);           // the storyteller's set: box, bicycle, candy
  let butai = null, bike = null;
  const cards = createCardKit({ aniso: P.tier === 'low' ? 2 : 4 });
  P.cards = cards;
  const frontCard = makeCardMesh(), outCard = makeCardMesh();
  rig.add(frontCard, outCard);
  const gridCards = [], gridFrames = [];
  const gridGroup = new THREE.Group(); scene.add(gridGroup);

  function buildSet(padM) {
    if (butai) { rig.remove(butai.group); butai.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    butai = buildButai({ pad: padM });
    rig.add(butai.group);
    if (!bike) { bike = buildBicycle(); rig.add(bike.group); const jar = buildCandy(); jar.position.set(-0.62, GY, 0.32); jar.scale.setScalar(1.1); rig.add(jar); P.jar = jar; }
    butai.padM = padM;
  }
  buildSet(0.05);

  // arrange board: a big card rack of dark wood with a ledge under each row and two hanging lanterns
  const board = new THREE.Group(); scene.add(board);
  const boardWood = B.material('darkWood', { color: '#3a2315', color2: '#5a3a22', seed: 12, repeat: [3, 4], size: 512, roughness: 0.55 });
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), boardWood);
  boardMesh.position.z = -0.05; boardMesh.receiveShadow = true;
  board.add(boardMesh);
  const ledgeMat = B.material('wood', { color: '#8a5a33', color2: '#b07a48', seed: 4, repeat: [4, 1], size: 256, roughness: 0.5 });
  const ledges = [];
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(B.roundedBox(1, 0.02, 0.03, 0.006, 2), ledgeMat); m.castShadow = true; m.receiveShadow = true; m.visible = false; board.add(m); ledges.push(m); }
  const rackLanterns = [makeLantern('#ff9a3c', 0.45), makeLantern('#ff8a30', 0.45)];
  rackLanterns.forEach((l) => board.add(l));
  const rackLights = [new THREE.PointLight('#ffb060', 2.2, 6, 1.6), new THREE.PointLight('#ffa050', 2.0, 6, 1.6)];
  rackLights.forEach((l) => board.add(l));
  board.visible = false;

  // performance lanterns (the audience's attention): five paper lanterns on a string above the box
  const attStrip = new THREE.Group(); scene.add(attStrip);
  const attLanterns = [], attGlow = [];
  for (let i = 0; i < 5; i++) { const l = makeLantern('#ffb347', 1.0); attStrip.add(l); attLanterns.push(l); }
  const glowTex = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,100,0.9)'); gr.addColorStop(0.4, 'rgba(255,160,70,0.35)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { aniso: 1 });
  for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); s.renderOrder = 6; attStrip.add(s); attGlow.push(s); }
  const attCord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 5), new THREE.MeshBasicMaterial({ color: '#15101a' }));
  attStrip.add(attCord);

  // ---- particles: dust motes in the lantern light and bursts of sparkle ------------------------------------------------------------------------
  const MOTE_N = P.tier === 'low' ? 30 : 80, SPK_N = 60;
  function makePoints(n, size, tex) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({ size, map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true, fog: false });
    const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = 8;
    return pts;
  }
  const dotTex = canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }, { aniso: 1 });
  const motes = makePoints(MOTE_N, 0.022, dotTex); scene.add(motes);
  const moteData = Array.from({ length: MOTE_N }, (_, i) => ({ x: Math.sin(i * 12.9) * 1.0, y: ((i * 0.37) % 1) * 2.2, z: -0.6 + ((i * 0.61) % 1) * 2.2, ph: i * 1.7, sp: 0.02 + (i % 7) * 0.006 }));
  const sparks = makePoints(SPK_N, 0.05, dotTex); scene.add(sparks);
  const sparkData = Array.from({ length: SPK_N }, () => ({ life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1 }));
  let sparkI = 0;
  function burst(x, y, z, n, col, power = 1) {
    for (let i = 0; i < n; i++) {
      const s = sparkData[sparkI++ % SPK_N], a = Math.random() * Math.PI * 2, v = (0.4 + Math.random() * 0.9) * power;
      s.life = 0.7 + Math.random() * 0.5; s.x = x; s.y = y; s.z = z; s.vx = Math.cos(a) * v; s.vy = (0.3 + Math.random() * 0.9) * power; s.vz = Math.sin(a) * v * 0.6 + 0.2;
      s.r = col[0]; s.g = col[1]; s.b = col[2];
    }
  }

  // ---- kids: a foreground audience layer ---------------------------------------------------------------------------------------------------------
  // The children sit in front of the box, but at the box's real scale the ground (and so the children) is below the bottom of a phone screen.
  // So they are a second render pass with their own camera and lights: backs of heads along a band of the screen, like the dark foreground
  // figures in a film over-the-shoulder shot, big enough to read as people (child proportions, seated) and cheering with the show.
  const kidScene = new THREE.Scene();
  const kidCam = new THREE.PerspectiveCamera(22, 1, 0.5, 40);
  const kHemi = new THREE.HemisphereLight(0x8a90d8, 0x5a4030, 0.85), kKey = new THREE.DirectionalLight(0xffc784, 2.0);
  kKey.position.set(-1.5, 3, 4); kidScene.add(kHemi, kKey, kKey.target);
  const kRim = new THREE.DirectionalLight(0xffb070, 1.1); kRim.position.set(1.5, 2, -3); kidScene.add(kRim);
  let crowd = null;       // (the children are individual view3d humans scaled to child size, see loadKids)
  const kids = [];
  const KID_LOOKS = [
    { top: '#c8553d', bottoms: '#2e3a5c', skin: '#e6b995', hair: 'black' }, { top: '#e9dfc8', bottoms: '#3d3a33', skin: '#dba886', hair: 'black' },
    { top: '#3f6a8f', bottoms: '#4b3a2b', skin: '#e0b28e', hair: '#2a1d15' }, { top: '#d9b24a', bottoms: '#2c3340', skin: '#e8c2a0', hair: 'black' },
    { top: '#6f9a58', bottoms: '#3a3024', skin: '#d9a47f', hair: '#1b1410' }, { top: '#b8658a', bottoms: '#2d3550', skin: '#ebc7a6', hair: 'black' },
    { top: '#e4e0d4', bottoms: '#2c3a5a', skin: '#e0b090', hair: '#3a2a1c' }, { top: '#8a5a3a', bottoms: '#33383f', skin: '#d8a27c', hair: 'black' },
  ];
  // [x as a fraction of the 390 px width, row: 0 front (big), 1 behind (smaller, a bit higher)]
  const KID_SLOTS = [[0.1, 0], [0.4, 0], [0.7, 0], [0.97, 0], [0.25, 1], [0.55, 1], [0.85, 1], [-0.02, 1]];
  async function loadKids(V3x) {
    for (let i = 0; i < KID_SLOTS.length; i++) {
      const L = KID_LOOKS[i % KID_LOOKS.length];
      const h = await V3x.loadHuman({ character: 'athlete_m', kit: { top: L.top, bottoms: L.bottoms, socks: '#222' }, skin: L.skin, hair: L.hair });
      const [fx, row] = KID_SLOTS[i], sc = row === 0 ? 0.72 : 0.64;
      h.root.scale.setScalar(sc);
      h.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      h.groundClamp = 'off'; h.footPlanting = false;
      h.setPosition((fx * 390 - 195) / 300, -1.62 * sc + 0.02 + row * 0.0, -row * 0.5);
      h.setFacing(Math.PI + Math.sin(i * 3.7) * 0.25);
      h.setFingers('L', 'relaxed'); h.setFingers('R', 'relaxed');
      h.play('idle_relaxed', { fade: 0, loop: true, startTime: i * 0.37 });
      h.lookAt({ x: 0, y: 0.9, z: -6 }, { weight: 0.7, maxYaw: 0.6, maxPitch: 0.5 });
      kidScene.add(h.root); stage.track(h);
      kids.push({ h, ph: i * 1.3, cheer: -9 });
    }
  }

  // ---- context loss: the 2D scene takes over until the context is back (the stage rebuilds the environment) -------------------------------------
  stage.onContextLost(() => { P.lost = true; GL.active = false; });
  stage.onContextRestored(() => { P.lost = false; GL.active = P.ready; stage.invalidate(); });

  let teller = null;

  // ---- camera ------------------------------------------------------------------------------------------------------------------------------
  const vw = () => canvas.clientWidth || window.innerWidth, vh = () => canvas.clientHeight || window.innerHeight;
  const CAM = { cx: 0, cy: 0, ppm: 900, yaw: 0, pitch: 0, fov: 24, ty: 0, set: false, D: 3, W: 1, H: 1 };
  function setCamera(t, dt, instant) {
    const W = vw(), H = vh();
    const k = instant || !CAM.set ? 1 : 1 - Math.exp(-dt / 0.3);
    for (const key of ['cx', 'cy', 'ppm', 'yaw', 'pitch', 'fov', 'ty']) CAM[key] = CAM.set ? lerp(CAM[key], t[key], k) : t[key];
    CAM.set = true;
    const D = (H / 2) / (CAM.ppm * Math.tan((CAM.fov * D2R) / 2));
    const yw = CAM.yaw * D2R, pt = CAM.pitch * D2R;
    cam.fov = CAM.fov; cam.aspect = W / H; cam.near = Math.max(0.05, D * 0.1); cam.far = 160;
    cam.position.set(Math.sin(yw) * Math.cos(pt) * D, CAM.ty + Math.sin(pt) * D, Math.cos(yw) * Math.cos(pt) * D);
    cam.up.set(0, 1, 0); cam.lookAt(0, CAM.ty, 0);
    cam.setViewOffset(W, H, -(CAM.cx - W / 2), -(CAM.cy - H / 2), W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    CAM.D = D; CAM.W = W; CAM.H = H;
  }
  const vx = (f, x) => f.ox + x * f.k, vy = (f, y) => f.oy + y * f.k;      // virtual -> css px
  const toWorld = (f, x, y) => ({ x: (vx(f, x) - CAM.cx) / CAM.ppm, y: -(vy(f, y) - CAM.cy) / CAM.ppm });

  // ---- run display state --------------------------------------------------------------------------------------------------------------------
  const R = { lastGrade: null, lastShow: null, lastPull: null, lastMode: '', overT: 0, simT: 0, lastT: null, strike: false };
  const TELLER_X = 0.14;
  const TELLER = { perf: { pos: [TELLER_X, -0.75], yaw: -0.2 }, title: { pos: [0.3, -0.42], yaw: -0.35 }, land: { pos: [0.3, -0.62], yaw: -0.35 } };
  let frameMs = 16, slowCount = 0, clockReal = performance.now();

  function setTier(t) {
    P.tier = t;
    try { stage.setQuality(t); } catch { /* ignore */ }
    
    if (t === 'low') stage.renderer.shadowMap.enabled = false;
  }
  P.setTier = setTier;

  // ---- one frame ---------------------------------------------------------------------------------------------------------------------------------
  function frame(game) {
    if (!P.ready || P.lost) return;
    const f = GL.f; if (!f) return;
    const S = game.getState();
    const tReal = performance.now(), dtReal = Math.min(0.1, (tReal - clockReal) / 1000); clockReal = tReal;
    frameMs = frameMs * 0.95 + dtReal * 1000 * 0.05;
    if (frameMs > 26) slowCount++; else slowCount = 0;
    if (slowCount > 100 && P.tier !== 'low') { setTier(P.tier === 'high' ? 'medium' : 'low'); slowCount = 0; frameMs = 16; }
    // the game clock drives all motion so Pause freezes everything
    const dt = R.lastT === null ? 0 : clamp(S.t - R.lastT, 0, 0.1); R.lastT = S.t;
    const frozen = S.paused || (S.auto.on && S.auto.paused);
    const sdt = frozen ? 0 : dt;
    R.simT += sdt;
    const T = R.simT;

    const mode = f.mode;
    P.mode = mode;
    const perf = mode === 'perform', arr = mode === 'arrange', hero = !perf && !arr;

    // the physical frame pad follows the 2D frame in the performance view
    if (perf && f.stage) {
      const st = f.stage, cardW = st.card.w * f.k;
      const padM = clamp(((st.frame.w - st.card.w) / 2 * f.k) / (cardW / CARD_W), 0.02, 0.09);
      if (Math.abs(padM - butai.padM) > 0.004) buildSet(padM);
    }

    // ---- camera per mode
    const t = { cx: vw() / 2, cy: vh() / 2, ppm: 900, yaw: 0, pitch: 0, fov: 24, ty: 0 };
    const drift = Math.sin(T * 0.23) * 1.1, bob = Math.sin(T * 0.17 + 1) * 0.5;
    if (perf && f.stage) {
      const c = f.stage.card;
      t.cx = vx(f, c.x + c.w / 2); t.cy = vy(f, c.y + c.h / 2); t.ppm = (c.w * f.k) / CARD_W; t.fov = 26; t.yaw = drift; t.pitch = 7 + bob;
    } else if (arr && f.grid) {
      const r0 = f.grid[0];
      t.ppm = (r0.w * f.k) / CARD_W; t.fov = 26; t.yaw = drift * 0.6; t.pitch = 1.5;
    } else {
      const h = f.hero || { x: 0, y: 0, w: vw() / f.k, h: vh() / f.k };
      const hw = h.w * f.k, hh = h.h * f.k;
      t.ppm = Math.min(hw / 1.15, hh / 0.8); t.cx = vx(f, h.x + h.w / 2) - 0.04 * t.ppm; t.cy = vy(f, h.y + h.h / 2) + 0.17 * t.ppm; t.fov = 28; t.yaw = -14 + drift * 1.6; t.pitch = 5 + bob;
      if (mode === 'menu') { t.yaw = -20 + drift * 2; t.ppm = Math.min(vw() / 0.9, vh() / 0.9); t.cy = vh() * 0.42; t.cx = vw() * 0.5; }
    }
    if (P.camOverride === 'side') { t.ppm = vh() / 2.0; t.cx = vw() / 2; t.cy = vh() / 2; t.yaw = 90; t.pitch = 3; t.fov = 22; t.ty = -0.35; }
    if (P.camOverride === 'front') { t.ppm = vh() / 1.6; t.cx = vw() / 2; t.cy = vh() / 2; t.yaw = 0; t.pitch = 4; t.fov = 22; t.ty = -0.15; }
    if (P.camOverride === 'close') { t.ppm = vh() / 0.9; t.cx = vw() / 2; t.cy = vh() / 2; t.yaw = -15; t.pitch = 4; t.fov = 22; t.ty = 0.1; }
    if (P.camOverride === 'wide') { t.ppm = Math.min(vw() / 3.2, vh() / 2.6); t.cx = vw() / 2; t.cy = vh() / 2; t.yaw = -22; t.pitch = 8; t.fov = 34; }
    if (P.cv) for (const [k, v] of Object.entries(P.cv)) { if (k === 'cx' || k === 'cy') t[k] = v * (k === 'cx' ? vw() : vh()); else t[k] = v; }
    setCamera(t, dt || dtReal, perf || arr || !!P.cv);
    R.lastMode = mode;

    // ---- the audience layer: where the band of heads sits on screen
    {
      const band = f.band;       // { y } in virtual units: where the middle of the heads goes, or null (hidden)
      const show = !!band && !arr && (perf || mode === 'over');
      P.kidsOn = show;
      if (show) {
        const W = vw(), H = vh(), ppmK = (P.kidPpm || 300) * (Math.min(W, H) / 390);
        const D = (H / 2) / (ppmK * Math.tan((kidCam.fov * D2R) / 2));
        kidCam.aspect = W / H; kidCam.near = 0.5; kidCam.far = 40;
        kidCam.position.set(0, 0, D); kidCam.lookAt(0, 0, 0);
        kidCam.setViewOffset(W, H, -(W / 2 - W / 2), -(vy(f, band.y) - H / 2), W, H);
        kidCam.updateProjectionMatrix(); kidCam.updateMatrixWorld(true);
      }
    }

    // ---- visibility of the sets
    rig.visible = !arr; board.visible = arr; gridGroup.visible = arr;
    attStrip.visible = perf && !!f.lanterns;
    world.group.visible = !arr;
    if (teller) teller.human.root.visible = !arr;
    if (!arr) for (const d of butai.doors) d.pivot.rotation.y = d.side * (Math.PI * 0.58 + Math.sin(T * 0.6 + d.side) * 0.008);

    // ---- cards ---------------------------------------------------------------------------------------------------------------------------------
    const Pp = S.P, sh = S.show;
    if (perf && Pp && sh) {
      const story = Pp.story, ci = sh.i < Pp.n ? sh.i : Pp.n - 1, pa = S.pullAnim;
      frontCard.userData.setFace(cards.live(story, ci, S.t));
      frontCard.visible = true; frontCard.position.set(0, 0, 0.003); frontCard.rotation.set(0, 0, 0);
      outCard.visible = false;
      if (pa) {
        const k = smooth(clamp(pa.t / 0.5, 0, 1)), d = pa.dir;
        outCard.visible = true;
        outCard.userData.setFace(cards.front(story, pa.card));
        outCard.position.set(d * k * CARD_W * 1.25, -k * 0.04 - k * k * 0.05, 0.02 + k * 0.05);
        outCard.rotation.set(-0.06 * k, d * 0.14 * k, d * 0.12 * k);
        if (R.lastPull !== pa) { R.lastPull = pa; burst(d * 0.22, 0, 0.05, 8, [1, 0.85, 0.55], 0.5); }
      } else if (S.pullDrag) {
        const dx = S.pullDrag.dx * f.k / CAM.ppm;
        frontCard.position.set(dx, -Math.abs(dx) * 0.02, 0.02); frontCard.rotation.z = dx * 0.35;
      }
      for (let i = 0; i < butai.stack.children.length; i++) butai.stack.children[i].visible = (ci + i + 1 < Pp.n) || i === 0;
    } else if (hero) {
      // the title and menu pages cycle through the first card of each tale, sliding the old one out (as the 2D hero did)
      const cyc = 4.2, kk = Math.floor(S.t / cyc), tt = S.t - kk * cyc, ids = Object.keys(STORIES);
      const A = ids[kk % ids.length], Bk = ids[(kk + 1) % ids.length];
      const slide = smooth(clamp((tt - (cyc - 0.7)) / 0.7, 0, 1));
      frontCard.visible = true; frontCard.userData.setFace(cards.front(slide > 0 ? Bk : A, slide > 0 ? Math.min(1, STORIES[Bk].cards.length - 1) : 0));
      frontCard.position.set(0, 0, 0.003); frontCard.rotation.set(0, 0, 0);
      outCard.visible = slide > 0;
      if (slide > 0) { outCard.userData.setFace(cards.front(A, 0)); outCard.position.set(slide * CARD_W * 1.25, -slide * 0.05, 0.02 + slide * 0.04); outCard.rotation.set(0, 0.12 * slide, 0.1 * slide); }
      if (slide > 0 && R.lastPull !== kk) { R.lastPull = kk; burst(0.2, 0, 0.05, 6, [1, 0.85, 0.55], 0.4); }
    } else { frontCard.visible = false; outCard.visible = false; }

    // ---- arrange: the card rack ------------------------------------------------------------------------------------------------------------------
    if (arr && Pp && f.grid) {
      const rects = f.grid, n = Math.min(rects.length, Pp.n);
      while (gridCards.length < n) {
        const c = makeCardMesh(); gridGroup.add(c); gridCards.push(c);
        const fr = new THREE.Mesh(new THREE.BoxGeometry(CARD_W + 0.016, CARD_H + 0.016, 0.003), new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#ffb81a', emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.5 }));
        gridGroup.add(fr); gridFrames.push(fr);
      }
      for (let i = 0; i < gridCards.length; i++) {
        const vis = i < n; gridCards[i].visible = vis; gridFrames[i].visible = false;
        if (!vis) continue;
        const r = rects[i], c = gridCards[i], story = Pp.story, idx = Pp.order[i];
        const flipped = (Pp.flipped[idx] || Pp.flipped.all) && !S.paused;
        c.userData.setFace(flipped ? cards.back(story, idx, Pp.tier, S.prefs.caps) : cards.front(story, idx));
        const w = toWorld(f, r.x + r.w / 2, r.y + r.h / 2);
        const dragging = S.drag && S.drag.slot === i && S.drag.moved;
        const s = (r.w * f.k) / CAM.ppm / CARD_W;
        const locked = Pp.locked[i], selected = S.sel === i;
        const sk = S.fx.shake[i], shx = sk !== undefined && sk < 0.45 ? Math.sin(sk * 60) * 0.008 * (1 - sk / 0.45) : 0;
        const pop = S.fx.lock[i], ps = pop !== undefined && pop > 0 && pop < 0.35 ? 1 + 0.06 * Math.sin((Math.PI * pop) / 0.35) : 1;
        const tilt = (((i * 7919) % 13) - 6) * 0.0009;
        c.position.set(w.x + shx, w.y, selected ? 0.03 : 0.004);
        c.rotation.set(0, 0, tilt);
        c.scale.setScalar(s * ps * (selected ? 1.03 : 1));
        if (dragging) {
          const d = S.drag, wp = toWorld(f, d.x, d.y);
          c.position.set(wp.x, wp.y, 0.09); c.rotation.set(-0.03, 0.02, -0.04); c.scale.setScalar(s * 1.08);
        }
        const hl = S.hint && S.hint.h.slot === i, hf = S.hint && S.hint.h.from === i;
        const fr = gridFrames[i], col = locked ? '#ffd24a' : selected ? '#5cc8ff' : hl ? '#7fe0a8' : hf ? '#5cc8ff' : null;
        if (col && !dragging) {
          fr.visible = true; fr.material.color.set(col); fr.material.emissive.set(col);
          fr.position.set(w.x, w.y, -0.004); fr.scale.setScalar(s * ps * (selected ? 1.03 : 1)); fr.rotation.set(0, 0, tilt);
          fr.material.emissiveIntensity = selected ? 1.1 : 0.7 + 0.15 * Math.sin(T * 4);
        }
      }
      // ledges under each row, and the two hanging lanterns at the top corners of the rack
      const used = rects.slice(0, n), rowsY = [...new Set(used.map((r) => Math.round(r.y)))].sort((a, b) => a - b);
      const x0 = Math.min(...used.map((q) => q.x)), x1 = Math.max(...used.map((q) => q.x + q.w));
      ledges.forEach((l, k) => {
        if (k < rowsY.length) {
          const r = used.find((q) => Math.round(q.y) === rowsY[k]);
          const a = toWorld(f, x0 - 6, r.y + r.h), b2 = toWorld(f, x1 + 6, r.y + r.h);
          l.visible = true; l.scale.set(Math.abs(b2.x - a.x), 1, 1); l.position.set((a.x + b2.x) / 2, a.y - 0.006, 0.0);
        } else l.visible = false;
      });
      const left = toWorld(f, 0, 0), right = toWorld(f, vw() / f.k, 0), topY = left.y;
      rackLanterns[0].position.set(left.x + 0.2, topY - 0.08, 0.35); rackLanterns[1].position.set(right.x - 0.2, topY - 0.08, 0.35);
      rackLights[0].position.set(left.x + 0.2, topY - 0.15, 0.55); rackLights[1].position.set(right.x - 0.2, topY - 0.15, 0.55);
      rackLanterns.forEach((l, i) => { l.rotation.z = Math.sin(T * 0.8 + i * 2) * 0.05; l.userData.mat.emissiveIntensity = 1.5 * (0.92 + 0.08 * Math.sin(T * 9 + i)); });
    }

    // ---- lanterns (attention): positions follow the 2D lantern row ---------------------------------------------------------------------------------
    if (perf && f.lanterns && sh) {
      const lr = f.lanterns, n = 5, gap = Math.min(lr.w / n, 120);
      const x0 = lr.x + lr.w / 2 - gap * (n - 1) / 2, yy = lr.y + lr.h * 0.55;
      const a = toWorld(f, x0, yy), b2 = toWorld(f, x0 + gap * (n - 1), yy);
      const gx = (b2.x - a.x) / (n - 1), sizeS = clamp(Math.abs(gx) * 2.4, 0.18, 0.4);
      attCord.position.set((a.x + b2.x) / 2, a.y + 0.05 * sizeS / 0.3, 0.15); attCord.scale.set(1, Math.abs(b2.x - a.x) + 0.4, 1); attCord.rotation.z = Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const lit = clamp(sh.att - i, 0, 1), L = attLanterns[i];
        L.position.set(a.x + gx * i, a.y - (S.prefs.calm ? 0 : Math.sin(T * 2 + i) * 0.002), 0.15);
        L.scale.setScalar(sizeS);
        L.rotation.z = Math.sin(T * 1.1 + i) * 0.04;
        L.userData.mat.emissiveIntensity = 0.12 + lit * 1.7 * (0.92 + 0.08 * Math.sin(T * 8 + i * 2));
        L.userData.mat.emissive.set(lit > 0 ? '#ffb347' : '#3a1a10');
        const gs = attGlow[i]; gs.position.set(L.position.x, L.position.y, 0.2); gs.scale.setScalar(0.5 * sizeS * lit + 0.001); gs.visible = lit > 0.02; gs.material.opacity = 0.8 * lit;
      }
    }

    // ---- reactions ---------------------------------------------------------------------------------------------------------------------------------
    if (S.lastGrade && R.lastGrade !== S.lastGrade) {
      R.lastGrade = S.lastGrade;
      const g = S.lastGrade.grade;
      for (const k of kids) k.cheer = g === 'perfect' || g === 'good' ? T + (k.ph % 0.3) : -9;
      if (g === 'perfect') burst(0, 0.15, 0.2, 22, [1, 0.82, 0.4], 1.1);
      else if (g === 'good') burst(0, 0.1, 0.2, 10, [0.7, 1, 0.8], 0.8);
    }
    if (sh && R.lastShow !== sh) { R.lastShow = sh; R.strike = true; }
    if (S.scene === 'over' && R.overT === 0) { R.overT = 1; for (const k of kids) k.cheer = T + (k.ph % 0.4); }
    if (S.scene !== 'over') R.overT = 0;
    for (const k of kids) {
      if (k.cheer > -5 && T >= k.cheer && !k.on) { k.on = true; k.h.play('clap', { fade: 0.15, loop: false, onDone: () => { k.on = false; k.cheer = -9; k.h.play('idle_relaxed', { fade: 0.25, loop: true }); } }); }
    }

    // ---- the storyteller ----------------------------------------------------------------------------------------------------------------------------
    if (teller) {
      const to = perf ? (f.land ? TELLER.land : TELLER.perf) : TELLER.title;
      const speaking = perf && sh && !sh.done && !frozen && sh.wait <= 0 && sh.t < sh.beat * 0.8 ? 1 : 0;
      let pullPt = null;
      if (perf && (S.pullAnim || S.pullDrag)) {
        const pa = S.pullAnim;
        if (pa) { const k = smooth(clamp(pa.t / 0.5, 0, 1)); pullPt = { x: pa.dir * k * CARD_W * 1.25 + (CARD_W / 2) * pa.dir, y: -k * 0.04 - 0.02, z: -0.04 }; }
        else pullPt = { x: S.pullDrag.dx * f.k / CAM.ppm + CARD_W / 2, y: -0.02, z: -0.03 };
      }
      const rest = { x: CARD_W / 2 + 0.09, y: -0.06, z: -0.2 }, restR = { x: TELLER_X - 0.04, y: -0.02, z: -0.4 };
      const lookAt = S.pullAnim || S.pullDrag ? { x: 0, y: 0, z: 0 } : { x: 0.1, y: GY + 0.55, z: 2.0 };
      teller.update({ dt: sdt, pos: to.pos, yaw: to.yaw, speaking, pull: pullPt, restL: rest, restR, lookAt, lookW: pullPt ? 0.6 : 0.85, strike: R.strike, bow: S.scene === 'over' });
      R.strike = false;
    }

    // ---- fx ------------------------------------------------------------------------------------------------------------------------------------------
    {
      const pa = motes.geometry.attributes.position, ca = motes.geometry.attributes.color;
      for (let i = 0; i < MOTE_N; i++) {
        const m = moteData[i];
        const x = m.x + Math.sin(T * m.sp * 6 + m.ph) * 0.12, y = GY + 0.2 + ((m.y + T * m.sp) % 2.2), z = m.z + Math.cos(T * m.sp * 5 + m.ph) * 0.1;
        pa.setXYZ(i, x, y, z);
        const a = (0.35 + 0.65 * Math.abs(Math.sin(T * 0.9 + m.ph))) * (arr ? 0 : 0.55);
        ca.setXYZ(i, a, 0.78 * a, 0.45 * a);
      }
      pa.needsUpdate = true; ca.needsUpdate = true;
      const sp = sparks.geometry.attributes.position, sc = sparks.geometry.attributes.color;
      for (let i = 0; i < SPK_N; i++) {
        const s = sparkData[i];
        if (s.life > 0) { s.life -= sdt; s.vy -= 1.2 * sdt; s.x += s.vx * sdt; s.y += s.vy * sdt; s.z += s.vz * sdt; }
        const a = clamp(s.life / 0.8, 0, 1);
        sp.setXYZ(i, s.x, s.y, s.z); sc.setXYZ(i, s.r * a, s.g * a, s.b * a);
      }
      sp.needsUpdate = true; sc.needsUpdate = true;
    }

    world.update(T, sdt, 0.4);
    world.sky.position.copy(cam.position);
    const ext = perf || arr ? 1.25 : 2.4, kc = stage.lights.key.shadow.camera;
    if (kc.right !== ext) { kc.left = -ext; kc.right = ext; kc.top = ext; kc.bottom = -ext; kc.updateProjectionMatrix(); }
    stage.setShadowTarget(0, arr ? 0 : -0.15, 0);
    stage.update(sdt, { renderNow: false });
    stage.render();
    if (P.kidsOn && kids.length) { const r = stage.renderer; r.autoClear = false; r.clearDepth(); r.render(kidScene, kidCam); r.autoClear = true; }
    P.frames += 1;
    if ((P.frames & 15) === 1) { try { document.body.setAttribute('data-k3d', `frames=${P.frames} tier=${P.tier} mode=${mode} calls=${stage.renderer.info.render.calls} tris=${stage.renderer.info.render.triangles}`); } catch { /* ignore */ } }
  }

  // ---- boot: the storyteller loads in the background -----------------------------------------------------------------------------------------------
  P.ready_p = (async () => {
    P.tStart = Math.round(performance.now());
    try { teller = await createTeller(V3, stage, { quality: P.tier }); P.teller = teller; } catch (e) { console.warn('storyteller failed', e); teller = null; }
    try { await loadKids(V3); } catch (e) { console.warn('children failed', e); }
    if (P.aborted) return;
    P.tReady = Math.round(performance.now());
    P.ready = true; GL.active = true; P.active = true;
    stage.invalidate();
  })();
  P.abort = () => { P.aborted = true; P.ready = false; GL.active = false; try { canvas.remove(); } catch { /* ignore */ } };
  P.ready_p.catch((e) => { console.warn('presenter failed', e); P.ready = false; GL.active = false; try { canvas.remove(); } catch { /* ignore */ } });

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      r(ctx, view);
      if (GL.active && !P.lost) {
        try { frame(game); } catch (e) { P.errMsg = String(e && e.message || e).slice(0, 120); if (!P.warned) { console.warn('presenter frame error', e); P.warned = true; try { document.body.setAttribute('data-k3d-err', String(e && e.stack || e).slice(0, 500)); } catch { /* ignore */ } } }
      }
    };
    return game;
  };
  return P;
}
