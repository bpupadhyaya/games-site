// Three Voices 3D presenter. It READS the simulation state (game.getState()) and never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a dusk courtyard with a supra table and three real 3D singers in Georgian dress (view3d athlete rigs), plus a
// screen-space HUD scene (walnut plaques with brass trim, lacquered buttons, embossed gold title).
// Load pattern: the flat 2D art boots at once; this module builds the scene in small slices (await tick between them), compiles the
// shaders asynchronously, then crossfades (v3.mix 0 -> 1). With no WebGL, or when the context is lost, every screen keeps the flat art.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { FINGER_POSES } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { SINGERS, buildSetting, buildSinger, fingerPose, floorBlob, tick, tex, cv } from './world.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(1e-4, tau)));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];
const MOUTH = { a: [0.040, 0.034], o: [0.026, 0.030], e: [0.044, 0.020], i: [0.046, 0.012], u: [0.019, 0.020] };
const vowelOf = (syl) => { const m = String(syl || 'a').match(/[aeiou]/); return m ? m[0] : 'a'; };

export function createPresenter({ kitCanvas, quality = 'high', onReady }) {
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) { console.warn('WebGL unavailable; 2D art stays', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false; renderer.setClearColor(0x120709, 1);
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1230);
  scene.fog = new THREE.Fog(0x2a1c36, 9, 26);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 80);
  const hemi = new THREE.HemisphereLight(0x9a88c8, 0x3a2418, 0.62);
  const key = new THREE.DirectionalLight(0xffc890, 2.5); key.position.set(-3.2, 4.6, 5.2); key.target.position.set(0, 1.3, 0);
  Object.assign(key.shadow.camera, { left: -3.6, right: 3.6, top: 3.2, bottom: -1.2, near: 1, far: 18 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x8aa4ff, 1.5); rim.position.set(3.8, 3.2, -4.0); rim.target.position.set(0, 1.4, 0);
  const fill = new THREE.DirectionalLight(0xffd8b0, 0.55); fill.position.set(4, 1.6, 4);
  scene.add(hemi, key, key.target, rim, rim.target, fill);
  const lampL = new THREE.PointLight(0xffa860, 5, 7, 1.6); lampL.position.set(-1.5, 2.3, -0.2); scene.add(lampL);
  const lampR = new THREE.PointLight(0xffa860, 5, 7, 1.6); lampR.position.set(1.5, 2.3, -0.2); scene.add(lampR);
  const envHandle = B.createEnvironment(renderer, scene, { intensity: 0.5 });

  // ---------------------------------------------------------------- HUD scene (virtual units, y down)
  const hud = new THREE.Scene(), hudCam = new THREE.PerspectiveCamera();
  const hudKey = new THREE.DirectionalLight(0xfff0d6, 1.1); hudKey.position.set(-500, 800, 1000);
  const hudFill = new THREE.DirectionalLight(0xffc890, 0.5); hudFill.position.set(700, -300, 600);
  hud.add(new THREE.HemisphereLight(0xffe6c8, 0x2a1a10, 0.35), hudKey, hudFill);
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
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
  const walnut = B.material('darkWood', { color: '#3a2014', color2: '#5a3220', repeat: [2, 2], seed: 31 });
  const lacquerPanel = phys('#22100f', { roughness: 0.55, clearcoat: 0.6 });
  const insetM = new THREE.MeshPhysicalMaterial({ color: '#0e0607', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.82 });
  const brassMat = new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.92, roughness: 0.32, envMapIntensity: 1.3 });
  const BTN = {
    primary: phys('#e8a232', { emissive: '#5a2a08', emissiveIntensity: 0.28 }), gold: phys('#f2d27a', { metalness: 0.35, roughness: 0.28 }),
    quiet: phys('#4a2418', { clearcoat: 0.8 }), ghost: phys('#2c1612', { clearcoat: 0.5, roughness: 0.5, emissive: '#1a0806', emissiveIntensity: 0.4 }), on: phys('#2fb3a4'), disabled: phys('#1e1412', { clearcoat: 0.2 }), danger: phys('#a82a3e'),
  };
  const ROT = Math.PI / 2;
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x0a0405, transparent: true, opacity: 0, depthWrite: false }));
  hud.add(scrim);
  const vigC = cv(256), vx = vigC.getContext('2d'), vg = vx.createRadialGradient(128, 128, 70, 128, 128, 186);
  vg.addColorStop(0, 'rgba(6,2,4,0)'); vg.addColorStop(1, 'rgba(6,2,4,0.6)'); vx.fillStyle = vg; vx.fillRect(0, 0, 256, 256);
  const vig = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(vigC), transparent: true, depthWrite: false })); hud.add(vig);
  const panels = [], buttons = [];
  function panelAt(i) {
    let p = panels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(new THREE.BufferGeometry(), walnut), trim = new THREE.Mesh(new THREE.BufferGeometry(), brassMat), inner = new THREE.Mesh(new THREE.BufferGeometry(), lacquerPanel); g.add(outer, trim, inner); hud.add(g); p = { g, outer, trim, inner }; panels.push(p); }
    return p;
  }
  function placePanel(i, r, rad, kind) {
    const p = panelAt(i); p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700;
    p.outer.visible = p.trim.visible = p.inner.visible = true;
    if (kind === 'glass') {                           // the ladder: a smoked, recessed glass plate inside a brass-lipped frame
      p.outer.geometry = slabG(r.w + 10, r.h + 10, 10, rad + 4, 4); p.outer.material = walnut; p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
      p.trim.geometry = slabG(r.w + 3, r.h + 3, 11.5, rad + 1, 1.4); p.trim.material = brassMat; p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
      p.inner.geometry = slabG(r.w - 2, r.h - 2, 13, Math.max(2, rad - 1), 2); p.inner.material = insetM; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z + 0.5);
      return;
    }
    if (kind === 'bar') {                             // the HUD bar: a carved walnut rail with a brass lower edge
      p.outer.geometry = slabG(r.w, r.h, 14, 1, 5); p.outer.material = walnut; p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
      p.trim.geometry = slabG(r.w, 5, 17, 1, 1.4); p.trim.material = brassMat; p.trim.rotation.x = ROT; p.trim.position.set(cx, -(r.y + r.h) + 4, z);
      p.inner.visible = false; return;
    }
    const ins = 7, dep = 12;
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.material = walnut; p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.material = brassMat; p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.8, Math.max(3, rad - ins), 2.2); p.inner.material = lacquerPanel; p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
  }
  function buttonAt(i) {
    let b = buttons[i];
    if (!b) { const g = new THREE.Group(), body = new THREE.Mesh(new THREE.BufferGeometry(), BTN.quiet), rimM = new THREE.Mesh(new THREE.BufferGeometry(), brassMat); g.add(rimM, body); hud.add(g); b = { g, body, rim: rimM }; buttons.push(b); }
    return b;
  }
  function placeButton(i, bt, pressed) {
    const b = buttonAt(i), r = bt.r; b.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(bt.rad ?? 18, r.h / 2 - 1), z = -400, dep = pressed ? 8 : 18;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, Math.max(2, rad - 3), 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    b.body.material = BTN[bt.kind] ?? BTN.ghost;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }
  // embossed gold lettering: colour + alpha from a canvas, a normal map from its blurred height, metal reflections from the environment
  const title = (() => {
    const W = 1536, H = 320, c = cv(W, H), x = c.getContext('2d');
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ transparent: true, metalness: 0.88, roughness: 0.34, alphaTest: 0.02, envMapIntensity: 1.6 }));
    m.visible = false; hud.add(m);
    return { m, c, x, W, H, label: '' };
  })();
  function paintTitle(label) {
    const { x, c, W, H } = title;
    x.clearRect(0, 0, W, H); x.textAlign = 'center'; x.textBaseline = 'middle';
    let size = 250; x.font = `700 ${size}px "Cormorant Garamond", Georgia, serif`;
    const w = x.measureText(label).width; if (w > W - 80) { size *= (W - 80) / w; x.font = `700 ${size}px "Cormorant Garamond", Georgia, serif`; }
    x.lineJoin = 'round'; x.lineWidth = size * 0.07; x.strokeStyle = '#2a1208'; x.strokeText(label, W / 2, H / 2 + 6);
    const g = x.createLinearGradient(0, H * 0.18, 0, H * 0.82); g.addColorStop(0, '#fff6d8'); g.addColorStop(0.35, '#f6cf6a'); g.addColorStop(0.62, '#d89a2c'); g.addColorStop(1, '#8a5412');
    x.fillStyle = g; x.fillText(label, W / 2, H / 2 + 6);
    const hc = cv(W, H), hx = hc.getContext('2d'); hx.filter = `blur(${size * 0.035}px)`; hx.drawImage(c, 0, 0); hx.filter = 'none';
    const hd = hx.getImageData(0, 0, W, H).data, nc = cv(W, H), nx = nc.getContext('2d'), out = nx.createImageData(W, H), od = out.data;
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const a = (j * W + i) * 4, dx = (hd[a + 3 + 4] - hd[a + 3 - 4]) / 255, dy = (hd[a + 3 + W * 4] - hd[a + 3 - W * 4]) / 255, k = 2.2;
      let nxv = -dx * k, nyv = dy * k, nzv = 1; const l = Math.hypot(nxv, nyv, nzv); nxv /= l; nyv /= l; nzv /= l;
      od[a] = (nxv * 0.5 + 0.5) * 255; od[a + 1] = (nyv * 0.5 + 0.5) * 255; od[a + 2] = (nzv * 0.5 + 0.5) * 255; od[a + 3] = 255;
    }
    nx.putImageData(out, 0, 0);
    const mm = title.m.material;
    if (mm.map) mm.map.dispose(); if (mm.normalMap) mm.normalMap.dispose();
    mm.map = tex(c); mm.normalMap = tex(nc, { linear: true }); mm.normalScale = new THREE.Vector2(1.6, 1.6); mm.needsUpdate = true;
    title.label = label;
  }

  // ---------------------------------------------------------------- the world (built in slices, behind the flat art)
  let world = null;
  const singers = [], blobs = [], youTags = [], spots = [];
  const youTex = (() => {
    const c = cv(256, 128), x = c.getContext('2d');
    x.fillStyle = 'rgba(20,8,8,0.82)'; x.beginPath(); x.roundRect(8, 8, 240, 84, 40); x.fill();
    x.lineWidth = 6; x.strokeStyle = '#f4d27c'; x.stroke();
    x.fillStyle = '#f4d27c'; x.font = '800 54px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('YOU', 128, 52);
    x.beginPath(); x.moveTo(108, 92); x.lineTo(148, 92); x.lineTo(128, 120); x.closePath(); x.fill();
    return tex(c);
  })();

  let ready = false, failed = false;
  async function build() {
    world = buildSetting(scene, { tier });
    await tick();
    for (const spec of SINGERS) {
      const S = await buildSinger(scene, spec, { quality: TIERS[tier].name });
      S.look = { x: 0, y: 1.5, z: 3 };
      S.k = { amp: 0, pitch: 0.5, mw: 0.03, mh: 0, vowel: 'a', lungs: 1, chest: 0.5, you: 0, sway: 0, handUp: 0, onT: 0, was: false };
      S.fingers = { L: 0.25, R: 0.25 };
      singers.push(S);
      blobs.push(floorBlob(scene, spec.x, 0.0, 0.5));
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: youTex, transparent: true, depthTest: false, opacity: 0 })); tag.scale.set(0.3, 0.15, 1); tag.position.set(spec.x, 1.12, 0.45); tag.renderOrder = 20; scene.add(tag); youTags.push(tag);
      const sp = new THREE.SpotLight(0xfff0d0, 0, 7, 0.34, 0.85, 1.6); sp.position.set(spec.x + 0.1, 3.4, 2.6); sp.target.position.set(spec.x, 1.5, 0); scene.add(sp, sp.target); spots.push(sp);
      await tick();
    }
    applyTier();
    // warm every shader variant that would otherwise compile mid-song: mouths visible, one of each plaque / button kind, the title
    for (const S of singers) { S.mouth.visible = true; S.mouth.scale.set(0.03, 0.02, 1); }
    ['wood', 'glass', 'bar'].forEach((k, i) => placePanel(i, { x: 0, y: 0, w: 100, h: 60 }, 10, k));
    Object.keys(BTN).forEach((k, i) => placeButton(i, { r: { x: 0, y: 0, w: 100, h: 60 }, rad: 10, kind: k }, false));
    paintTitle('THREE VOICES'); title.m.visible = true; title.m.scale.set(100, 20, 1);
    hud.environment = scene.environment;
    if (renderer.compileAsync) { try { await renderer.compileAsync(scene, camera); await renderer.compileAsync(hud, hudCam); } catch { /* compile on the first frame instead */ } }
    for (const S of singers) S.mouth.visible = false;
    panels.forEach((p) => { p.g.visible = false; }); buttons.forEach((b) => { b.g.visible = false; }); title.m.visible = false;
    await tick();
  }

  // ---------------------------------------------------------------- camera
  let W = 1, H = 1, dprNow = 1, hudW = 0, hudH = 0;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3();
  // Fit a world window of `worldW` metres centred on (0, cy) into rect (virtual units).
  function fitRect(rect, L, worldW, cy, { pitchDeg = 6, fov = 26 } = {}) {
    const k = W / L.w, targetPx = rect.w * k, p = (pitchDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    const visW = (W / targetPx) * worldW;
    const d = visW / (2 * Math.tan((fov * Math.PI) / 360) * camera.aspect);
    camera.position.set(0, cy + Math.sin(p) * d, Math.cos(p) * d); camera.lookAt(0, cy, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const c = tmpV.set(0, cy, 0).project(camera);
    const px0 = ((c.x + 1) / 2) * W, py0 = ((1 - c.y) / 2) * H, cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, px0 - cxp, py0 - cyp, W, H); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- driving the singers from the sim state
  function voicesFrom(state) {
    const sc = state.scene, o = { src: 'idle', amp: [0, 0, 0], pitch: [0.5, 0.5, 0.5], vowel: ['a', 'a', 'a'], mine: [false, false, false], locked: false, glow: 0.2, beat: state.t * 1.6, lead: -1 };
    if (sc === 'play' && state.pl) {
      const pl = state.pl, w = pl.win; o.src = 'play'; o.glow = pl.glow; o.locked = pl.locked; o.beat = (pl.t * (pl.piece ? pl.piece.bpm : 96)) / 60;
      for (let p = 0; p < 3; p++) {
        const vs = pl.vs[p], n = pl.now[p], mine = pl.mode !== 'auto' && pl.can[p];
        o.mine[p] = mine;
        const sing = mine ? vs.amp : n ? Math.max(vs.amp, 0.85) : 0;
        o.amp[p] = pl.paused ? 0 : sing;
        const c = vs.disp ?? (n ? n.c : null);
        o.pitch[p] = c === null || c === undefined ? 0.5 : clamp((c - w.lo) / (w.hi - w.lo), 0, 1);
        o.vowel[p] = n ? vowelOf(n.syl) : 'a';
        if (n && n.t > pl.t - 0.12 && n.t <= pl.t + 0.02) o.lead = p;
      }
    } else if (sc === 'lab' && state.lab) {
      const lab = state.lab; o.src = 'lab'; o.glow = lab.glow; o.locked = lab.locked; o.beat = lab.t * 1.2;
      for (let p = 0; p < 3; p++) { const vs = lab.vs[p]; o.mine[p] = p > 0; o.amp[p] = p === 0 ? (lab.drone ? 0.7 : 0) : vs.on ? vs.amp : 0; o.pitch[p] = vs.disp !== null && vs.disp !== undefined ? clamp((vs.disp + 1000) / 2400, 0, 1) : 0.4 + p * 0.1; }
    } else if (sc === 'title' || sc === 'result' || sc === 'songs' || sc === 'piece') {
      o.src = 'title'; const t = state.t, cyc = (t % 9) / 9, lockK = Math.max(0, Math.sin(Math.PI * clamp((cyc - 0.5) / 0.35, 0, 1)));
      o.locked = lockK > 0.5; o.glow = 0.25 + 0.6 * lockK; o.beat = t * 1.5;
      const VW = ['a', 'o', 'e', 'a', 'u'];
      for (let p = 0; p < 3; p++) {
        const ph = (t * 0.5 + p * 0.37) % 1, on = sc === 'title' ? (cyc > 0.12 + p * 0.1 && cyc < 0.9) : (cyc > 0.3 && cyc < 0.7);
        o.amp[p] = on ? 0.55 + 0.17 * Math.sin(TAU * ph) + 0.2 * lockK : 0;
        o.pitch[p] = 0.35 + p * 0.15 + 0.1 * Math.sin(t * 0.7 + p * 2);
        o.vowel[p] = VW[Math.floor((t * 0.35 + p) % VW.length)];
      }
    }
    return o;
  }

  const Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), AX = new THREE.Vector3();
  function rotWorld(bone, axis, ang) {
    if (!bone || Math.abs(ang) < 1e-5) return;
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(Q);
    Q2.setFromAxisAngle(AX.copy(axis).applyQuaternion(Q.invert()), ang);
    bone.quaternion.premultiply(Q2);
  }
  const X = new THREE.Vector3(1, 0, 0), Zv = new THREE.Vector3(0, 0, 1);
  let clock = 0, introT = 0;

  function driveSingers(state, dt, calm) {
    const v = voicesFrom(state), t = clock;
    const youOn = state.scene === 'play' || state.scene === 'lab';
    const beatPh = v.beat * TAU * 0.5;
    singers.forEach((S, i) => {
      const k = S.k, h = S.human, sp = S.spec, mine = youOn && v.mine[i];
      k.amp = damp(k.amp, v.amp[i], dt, v.amp[i] > k.amp ? 0.05 : 0.12);
      k.pitch = damp(k.pitch, v.pitch[i], dt, 0.12);
      k.you = damp(k.you, mine ? 1 : 0, dt, 0.25);
      k.vowel = v.vowel[i];
      const singing = k.amp > 0.12;
      // lungs: drain slowly while singing, refill quickly in rests and gaps (chest and shoulders follow)
      k.lungs = clamp(k.lungs + (singing ? -0.11 * dt : 0.9 * dt), 0.12, 1);
      const idle = 0.5 + 0.5 * Math.sin(t * 1.35 + i * 1.7);
      k.chest = damp(k.chest, calm ? 0.5 : singing ? 0.25 + 0.75 * k.lungs : 0.35 + 0.65 * Math.max(k.lungs * 0.6, idle * 0.5), dt, 0.18);
      // mouth: the vowel's shape x loudness, vibrato blooms after the onset
      if (singing && !k.was) k.onT = 0;
      k.was = singing; k.onT += dt;
      const vib = singing ? 1 + 0.07 * Math.sin(t * TAU * 5.4 + i) * clamp((k.onT - 0.25) / 0.5, 0, 1) : 1;
      const shape = MOUTH[k.vowel] ?? MOUTH.a, eff = 0.75 + 0.5 * k.pitch;
      k.mw = damp(k.mw, shape[0] * (0.72 + 0.28 * k.amp), dt, 0.06);
      k.mh = damp(k.mh, shape[1] * k.amp * eff * vib, dt, 0.05);
      if (S.mouth) { const mh = Math.max(0, k.mh - 0.003), vis = mh > 0.002; S.mouth.visible = vis; S.mouth.scale.set(k.mw, Math.max(0.001, mh), 1); }
      // sway on the beat (all together once the chord locks)
      const sw = (calm ? 0 : 1) * (0.012 + 0.014 * (v.locked ? 1 : 0.3));
      k.sway = damp(k.sway, Math.sin(v.locked ? beatPh : beatPh * 0.5 + i * 1.9) * sw, dt, 0.08);
      // reach targets: inner arms hook over the neighbour's shoulder, the free hand gestures with the voice
      k.handUp = damp(k.handUp, calm ? 0 : k.amp * (0.5 + k.pitch * 0.5), dt, 0.25);
      const sh = 1.40 + k.chest * 0.012, sx = sp.x;
      const arm = (side, x, y, z, pole) => h.setReach(side, { x, y, z }, { weight: 1, pole });
      if (i === 0) {
        arm('L', sx + 0.50 + 0.01 * Math.sin(beatPh), sh - 0.02, -0.13, { x: sx + 0.35, y: 1.15, z: -0.55 });
        arm('R', sx - 0.20 - 0.02 * k.handUp, 1.06 + 0.12 * k.handUp, 0.14 + 0.05 * k.handUp, { x: sx - 0.45, y: 1.0, z: -0.15 });
      } else if (i === 1) {
        const sq = v.locked ? 0.012 * Math.sin(beatPh * 2) : 0;
        arm('L', sx + 0.50 + sq, sh - 0.02, -0.13, { x: sx + 0.35, y: 1.15, z: -0.55 });
        arm('R', sx - 0.50 - sq, sh - 0.02, -0.13, { x: sx - 0.35, y: 1.15, z: -0.55 });
      } else {
        arm('R', sx - 0.50, sh - 0.02, -0.13, { x: sx - 0.35, y: 1.15, z: -0.55 });
        const ear = clamp(k.amp * (0.4 + k.pitch * 0.8), 0, 1);
        S.ear = damp(S.ear ?? 0, ear, dt, 0.3);
        arm('L', sx + 0.30 - 0.04 * S.ear, 1.14 + 0.26 * S.ear, 0.20 + 0.06 * S.ear, { x: sx + 0.62, y: 1.0 + 0.2 * S.ear, z: -0.1 });
      }
      const free = i === 0 ? 'R' : i === 2 ? 'L' : null;
      for (const sd of ['L', 'R']) {
        const want = sd === free ? 0.15 + 0.7 * k.handUp : 0.2 + (v.locked ? 0.1 : 0);
        S.fingers[sd] = damp(S.fingers[sd], want, dt, 0.12);
        h.setFingers(sd, fingerPose(FINGER_POSES, S.fingers[sd]));
      }
      // head: glance at whoever just entered, chins up at the lock, otherwise at a neighbour
      let tgt;
      const others = singers.filter((o) => o !== S);
      if (state.scene !== 'play' && state.scene !== 'lab' && state.scene !== 'title') tgt = { x: sp.x * 0.3, y: 1.55, z: 3 };
      else if (v.locked) tgt = { x: 0, y: 1.62 + 0.08 * Math.sin(t * 0.8 + i), z: 2.6 };
      else if (v.lead >= 0 && v.lead !== i) tgt = { x: SINGERS[v.lead].x, y: 1.55, z: 0.3 };
      else tgt = { x: others[(Math.floor(t / 2.6) + i) % others.length].spec.x, y: 1.55, z: 0.3 };
      S.look.x = damp(S.look.x, tgt.x, dt, 0.32); S.look.y = damp(S.look.y, tgt.y, dt, 0.32); S.look.z = damp(S.look.z, tgt.z, dt, 0.32);
      h.lookAt(S.look, { weight: 0.85, maxYaw: 0.75, maxPitch: 0.45 });
      h.setPosition(sp.x, 0, damp(h.root.position.z, mine ? 0.1 : 0, dt, 0.3));
      h.update(dt);
      // additive posture after the mixer + IK: breath lifts the chest, pitch tips the head, sway rolls the torso
      const b = S.bones;
      rotWorld(b.Bip01_Spine1, X, -0.035 * k.chest + 0.02);
      rotWorld(b.Bip01_Spine2, X, -0.05 * k.chest + 0.02);
      rotWorld(b.Bip01_Spine1, Zv, k.sway * 0.7); rotWorld(b.Bip01_Spine2, Zv, k.sway * 0.6);
      rotWorld(b.Bip01_Neck, X, 0.10 * (k.pitch - 0.5) * k.amp);
      rotWorld(b.Bip01_Head, X, -0.16 * (k.pitch - 0.5) * (0.3 + k.amp) - 0.05 * k.amp);
      rotWorld(b.Bip01_L_Clavicle, Zv, 0.05 * k.chest); rotWorld(b.Bip01_R_Clavicle, Zv, -0.05 * k.chest);
      h.root.updateMatrixWorld(true);
      h.limbSanity();
      if (S.veil) {                                              // veil: a damped lag behind the head
        S.veilA = S.veilA ?? { x: 0, z: 0 };
        S.veilA.x = damp(S.veilA.x, -0.5 * (k.pitch - 0.5) * (0.3 + k.amp) - 3 * k.sway, dt, 0.18);
        S.veilA.z = damp(S.veilA.z, -5 * k.sway, dt, 0.22);
        S.veil.rotation.x = S.veilA.x; S.veil.rotation.z = S.veilA.z;
      }
      youTags[i].material.opacity = k.you * (0.78 + 0.2 * Math.sin(t * 3));
      youTags[i].position.y = 1.1 + 0.02 * Math.sin(t * 2.4 + i);
      spots[i].intensity = damp(spots[i].intensity, 4 + 26 * k.you, dt, 0.25);
      blobs[i].position.z = h.root.position.z;
    });
    const glow = clamp(v.glow, 0, 1);
    if (world) {
      world.lanterns.forEach((l, n) => {
        const fl = 0.88 + 0.12 * Math.sin(t * (6 + n) + n * 2.1) + 0.05 * Math.sin(t * 17 + n);
        l.halo.scale.setScalar((0.9 + 0.9 * glow) * fl); l.halo.material.opacity = 0.55 + 0.45 * glow;
        l.g.rotation.z = calm ? 0 : Math.sin(t * 0.7 + n) * 0.025; l.flame.scale.setScalar(0.9 + 0.3 * fl);
      });
      lampL.intensity = (3.5 + 6 * glow) * (0.9 + 0.1 * Math.sin(t * 7)); lampR.intensity = (3.5 + 6 * glow) * (0.9 + 0.1 * Math.sin(t * 8 + 1.7));
      const bass = singers[0] ? singers[0].k.amp : 0;
      (world.wines || []).forEach((w, n) => { w.scale.setScalar(1 + (calm ? 0 : 0.02 * bass * Math.sin(t * 60 + n))); });
      if (world.motes) {
        const p = world.motes.geometry.attributes.position;
        for (let n = 0; n < p.count; n++) { let y = p.getY(n) + dt * (0.05 + 0.04 * ((n * 7) % 5)); if (y > 3.4) y = 0.8; p.setY(n, y); p.setX(n, p.getX(n) + Math.sin(t * 0.4 + n) * dt * 0.04); }
        p.needsUpdate = true; world.motes.visible = !calm;
      }
    }
    key.intensity = 2.3 + 0.5 * glow;
  }

  // ---------------------------------------------------------------- frames
  let frames = 0, ema = 16, lastT = 0;
  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }
  function present(state, L, dt) {
    const sc = state.scene, calm = !!state.prefs?.calm;
    resize();
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    clock += dt;
    const cam = qs.has('cam') ? qs.get('cam').split(',').map(Number) : null;
    if (v3.choirRect && (sc === 'play' || sc === 'lab') && v3.choirRect.h > 20) fitRect(v3.choirRect, L, cam ? cam[0] : Math.max(2.55, 0.92 * (v3.choirRect.w / v3.choirRect.h)), cam ? cam[1] : 1.5, { pitchDeg: 3 });
    else if (v3.heroRect && sc === 'title') {
      fitRect(v3.heroRect, L, cam ? cam[0] : L.vert ? 3.3 : 3.3, cam ? cam[1] : 1.3, { pitchDeg: 5, fov: 28 });
      if (!calm) camera.position.x += Math.sin(clock * 0.25) * 0.08;
    } else fitRect({ x: L.w * 0.05, y: L.h * 0.02, w: L.w * 0.9, h: L.h * 0.3 }, L, 3.6, 1.35, { pitchDeg: 6, fov: 28 });
    driveSingers(state, dt, calm);
    let n = 0;
    for (const p of v3.panels) placePanel(n++, p.r, p.rad, p.kind);
    for (let i = n; i < panels.length; i++) panels[i].g.visible = false;
    n = 0; const pr = v3.pressed;
    for (const b of v3.buttons) {
      const pressed = !!b.press || (!!pr && pr.x >= b.r.x && pr.x <= b.r.x + b.r.w && pr.y >= b.r.y && pr.y <= b.r.y + b.r.h);
      placeButton(n++, b, pressed);
    }
    for (let i = n; i < buttons.length; i++) buttons[i].g.visible = false;
    if (v3.title) {
      if (title.label !== v3.title.label) paintTitle(v3.title.label);
      const tt = v3.title, wpx = Math.min(tt.maxW ?? 1e9, tt.size * 7.2), hpx = wpx * (title.H / title.W);
      title.m.visible = true; title.m.scale.set(wpx, hpx, 1); title.m.position.set(tt.cx, -tt.y, -300);
    } else title.m.visible = false;
    vig.scale.set(L.w * 1.5, L.h * 1.5, 1); vig.position.set(L.w / 2, -L.h / 2, -790);
    scrim.visible = v3.scrim > 0; scrim.material.opacity = v3.scrim; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -760);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    hud.environment = scene.environment; hud.environmentIntensity = 0.28;
    renderer.render(hud, hudCam);
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; v3.mix = 0; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { envHandle.rebuild(); } catch { /* no reflections, still playable */ }
    W = 0; resize(); v3.on = true; v3.mix = 0; introT = 0;
  });

  build().then(() => { ready = true; v3.on = true; v3.mix = 0; introT = 0; lastT = performance.now(); onReady?.(); })
    .catch((e) => { failed = true; console.warn('3D build failed; 2D art stays', e); canvas.style.display = 'none'; v3.on = false; });

  return {
    ok: true, renderer, scene, camera, singers: () => singers, world: () => world, isReady: () => ready, isFailed: () => failed,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!ready || !v3.on) { game.render(ctx, view); return; }
          const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
          introT += dt; v3.mix = clamp(introT / 0.6, 0, 1);
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          game.render(ctx, view);
          try { present(state, L, state.pl && state.pl.paused && state.scene === 'play' ? 0.0001 : dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}
