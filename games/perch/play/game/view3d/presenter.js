// Perch 3D presenter. READS the game state (v3.frame, filled by render.js each frame), never writes it. One WebGL canvas sits
// behind the kit's transparent 2D canvas. The camera's projection is built from the flat layout (layout.js `V`), so a point of the
// flat 720 x 1280 field lands on exactly the same screen pixel in 3D: every perch, hunter and stone the rules know is where the
// player taps, and the flat cues (aim rings, choice rings) stay on top of the 3D picture. Each model is placed at the depth that
// gives it its REAL size (oak ~9 m, people ~1.8 m, robin ~14 cm) at its flat-art screen size, and the field is drawn in the flat
// art's painter order (far hunters, trees, near hunters, then stones and the bird), clearing depth between the groups.
// No WebGL, ?flat=1 or a lost context: v3.on = false and the flat art draws; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { loadHuman } from '../vendor3d/index.js';
import { v3, launchPoint } from '../src/v3.js';
import { meta } from '../src/game.js';
import { SLOTS, BOSS_SLOT } from '../src/tuning.js';
import { birdPoint, perchPoint } from '../src/rules.js';
import { aimOf, handOrigin, shownHunters, sideTreeList, HORIZON } from '../src/render.js';
import {
  hash, buildTree, buildPennant, wavePennant, crownTop, buildBird, poseBird, buildSlingshot, buildBow, buildHat, stick, setStick,
  buildStone, buildArrow, buildAcorn, buildSeed, buildNet, buildDog, poseDog, skyMaterial, grassTexture, radialTex, cloudTexture,
} from './world.js';

export const F = 1000;          // focal length in flat-art units: at depth d metres, 1 m spans F/d flat units
const HC = 9;                   // camera height above the grass (m): the flat art's high, bird's-eye composition
const COATS = ['#8a4a2c', '#5a6a3a', '#3f5a6e', '#7a6a4a', '#6a3a2a', '#4a5e3a', '#8a7048', '#5a4a6a'];   // country wool and linen
const SKINS = ['light', 'tan', 'brown', 'light', 'deep', 'tan', 'brown', 'light'];
const HAIRS = ['brown', 'black', 'black', 'blond', 'black', 'brown', 'grey', 'ginger'];
const HATS = ['#5a4630', '#3a3a30', '#6a5a3a', '#4a3020'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const f = clamp((x - a) / (b - a), 0, 1); return f * f * (3 - 2 * f); };
const lerp = (a, b, f) => a + (b - a) * f;
const tick = () => new Promise((r) => setTimeout(r, 0));
const TIERS = [{ name: 'high', dpr: 2 }, { name: 'medium', dpr: 1.5 }, { name: 'low', dpr: 1 }];
// render groups (the flat art's painter order); depth is cleared between them
const G_SKY = 0, G_FAR = 1, G_TREES = 2, G_NEAR = 3, G_TOP = 4;
export const P = (X, Y, d, out = new THREE.Vector3()) => out.set((X - 360) * d / F, (HORIZON - Y) * d / F, -d);

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat art stays', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.autoClear = false;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xcfe0ea, 30, 420);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 6000);
  // ---------------------------------------------------------------- lights (every group sees them)
  const hemi = new THREE.HemisphereLight('#d6ecff', '#5d7a3e', 1.05);
  const sun = new THREE.DirectionalLight('#fff0d4', 2.7); sun.position.set(-6, 7, 5);
  const rim = new THREE.DirectionalLight('#ffe0b0', 1.4); rim.position.set(5, 3, -8);
  const fill = new THREE.DirectionalLight('#bcd6ff', 0.35); fill.position.set(4, 1, 6);
  for (const l of [hemi, sun, rim, fill]) { l.layers.enableAll(); scene.add(l); }
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.35; } catch { /* no IBL */ } };
  buildEnv();
  const inGroup = (o, gi) => { o.traverse((c) => c.layers.set(gi)); return o; };

  // ---------------------------------------------------------------- sky (screen-space), clouds, hills, grass
  const skyMat = skyMaterial();
  const skyQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat); skyQuad.frustumCulled = false; skyQuad.renderOrder = -10;
  scene.add(inGroup(skyQuad, G_SKY));
  const grass = grassTexture(); grass.repeat.set(900, 900); grass.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400), new THREE.MeshStandardMaterial({ map: grass, roughness: 0.95, metalness: 0, fog: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -HC, -2700); scene.add(inGroup(ground, G_SKY));
  // mown stripes: soft bands across the field, wider toward you (true perspective now)
  const stripeTex = (() => { const c = document.createElement('canvas'); c.width = 4; c.height = 64; const x = c.getContext('2d'); x.fillStyle = 'rgba(255,255,240,0.08)'; x.fillRect(0, 0, 4, 32); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 300); return t; })();
  const stripes = new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400), new THREE.MeshBasicMaterial({ map: stripeTex, transparent: true, depthWrite: false }));
  stripes.rotation.x = -Math.PI / 2; stripes.position.set(0, -HC + 0.01, -2700); scene.add(inGroup(stripes, G_SKY));
  // large patches of lusher and drier grass, so the field is not one flat colour
  const patchTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    for (let i = 0; i < 70; i++) { const px = hash(i, 61) * 256, py = hash(i, 62) * 256, r = 20 + hash(i, 63) * 50, dark = hash(i, 64) < 0.55, g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, dark ? 'rgba(20,60,20,0.22)' : 'rgba(220,230,140,0.16)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); x.restore(); } }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 60); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const patches = new THREE.Mesh(new THREE.PlaneGeometry(5400, 5400), new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, depthWrite: false, fog: false }));
  patches.rotation.x = -Math.PI / 2; patches.position.set(0, -HC + 0.005, -2700); scene.add(inGroup(patches, G_SKY));
  await tick();
  // hills: the flat art's two rolling ridges, a hazy blue range behind them, hedgerow trees along the ridges
  const hills = new THREE.Group(); scene.add(hills);
  const lumpGeo = new THREE.SphereGeometry(1, 10, 7);
  const ridge = (dist, y0, amp, ph, c0, c1, lumps) => {
    const pos = [], cols = [], idx = [], N = 220, X0 = -4200, X1 = 4920, k = dist / F, a = new THREE.Color(c0), b = new THREE.Color(c1);
    for (let i = 0; i <= N; i++) {
      const X = X0 + (X1 - X0) * i / N, Y = y0 - Math.sin(X * 0.011 + ph) * amp - Math.sin(X * 0.0031 + ph * 3) * amp * 0.8;
      pos.push((X - 360) * k, (HORIZON - Y) * k, -dist, (X - 360) * k, -30 * k, -dist);
      cols.push(a.r, a.g, a.b, b.r, b.g, b.b);
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      if (lumps && hash(i, ph * 10 + 3) < lumps) {
        const r = (5 + hash(i, 7) * 8) * k, m = new THREE.Mesh(lumpGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(c0).multiplyScalar(0.7 + hash(i, 9) * 0.14), fog: false }));
        m.scale.set(r, r * 0.85, r); m.position.set((X - 360) * k, (HORIZON - Y) * k + r * 0.35, -dist + 2); hills.add(m);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.setIndex(idx);
    hills.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
  };
  ridge(2400, HORIZON - 66, 16, 4, '#a3bccb', '#bccfd6', 0);
  ridge(2000, HORIZON - 40, 22, 0, '#8db474', '#74a060', 0.2);
  ridge(1600, HORIZON - 4, 14, 2, '#73a45d', '#62934f', 0.32);
  inGroup(hills, G_SKY);
  // clouds: soft sprites far away, drifting slowly (the flat art's rows)
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexture(i % 5 + 1), transparent: true, depthWrite: false, fog: false, opacity: 0.92 }));
    sp.userData = { row: (i % 4) - (i >= 8 ? 2 : 0), ph: hash(i, 3) * 3000, sp: 6 + (i % 4) * 3, w: 260 + hash(i, 5) * 160 };
    scene.add(inGroup(sp, G_SKY)); clouds.push(sp);
  }
  await tick();

  // ---------------------------------------------------------------- trees (built once per tree shape and kept)
  const treeGroup = new THREE.Group(); scene.add(treeGroup);
  const treeCache = new Map();
  const blobMat = new THREE.MeshBasicMaterial({ map: radialTex('12,24,10', 0.8), transparent: true, depthWrite: false, opacity: 0.6, fog: false });
  const blobGeo = new THREE.PlaneGeometry(1, 1); blobGeo.rotateX(-Math.PI / 2);
  function getTree(tr) {
    let e = treeCache.get(tr.key);
    if (!e) {
      const g = new THREE.Group(), m = buildTree(tr, (Math.round(tr.x * 7 + tr.y) % 97) + 1); g.add(m);
      const sh = new THREE.Mesh(blobGeo, blobMat); sh.scale.set(330 * (tr.crown ?? 1) + 80, 1, 110); sh.position.set(46, 0, 14); g.add(sh);
      const pen = buildPennant(); pen.position.y = crownTop(tr.crown ?? 1) - 6; pen.visible = false; g.add(pen);
      e = { g, pen, crown: m.userData.crown }; inGroup(g, G_TREES); treeCache.set(tr.key, e);
    }
    return e;
  }
  let treesKey = '';
  function placeTrees(list) {
    const key = list.map((t) => t.key).join('|');
    if (key !== treesKey) { treesKey = key; treeGroup.clear(); for (const t of list) treeGroup.add(getTree(t).g); }
    for (const t of list) {
      const e = getTree(t), d = F * 9 / (566 * t.s);         // a 9 m oak at its flat size
      P(t.x, t.y, d, e.g.position); e.g.scale.setScalar(t.s * d / F);
      e.g.rotation.y = (t.x - 360) / 3200;                    // a hair of turn: crowns read round
    }
  }

  // ---------------------------------------------------------------- hunters: real people (view3d athletes) with real props
  const hunters = [];
  const bandMat = new THREE.MeshStandardMaterial({ color: '#8a3a26', roughness: 0.55 }), stringMat = new THREE.MeshBasicMaterial({ color: '#efe6d0' });
  const pouchMat = new THREE.MeshStandardMaterial({ color: '#5a3820', roughness: 0.8 }), pebbleMat = new THREE.MeshStandardMaterial({ color: '#a2a6ae', roughness: 0.5 });
  let humanErr = null;
  const humansReady = (async () => {
    for (let i = 0; i < SLOTS.length; i++) {
      const boss = i === BOSS_SLOT, coat = boss ? '#7a1622' : COATS[i % COATS.length];
      let h;
      try { h = await loadHuman({ character: 'athlete_m', kit: { top: coat, bottoms: '#3a3a4c', socks: '#2a2a36', shoes: '#3a2414' }, skin: SKINS[i % SKINS.length], hair: HAIRS[i % HAIRS.length] }); } catch (e) { humanErr = e; console.warn('hunter model unavailable', e); return; }
      h.groundClamp = 'off'; h.footPlanting = false; h.turnRate = 0;
      h.play('idle', { startPhase: hash(i, 5) });
      const sling = buildSlingshot(), bow = buildBow(), hat = buildHat(boss ? '#241010' : HATS[i % 4]);
      const bands = [stick(0.0045, bandMat), stick(0.0045, bandMat)], strings = [stick(0.003, stringMat), stick(0.003, stringMat)];
      const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), pouchMat); pouch.scale.set(1, 0.7, 1.2);
      const pebble = new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), pebbleMat);
      const arrow = buildArrow(); arrow.scale.setScalar(0.011);
      const shadow = new THREE.Mesh(blobGeo, blobMat); shadow.scale.set(1.1, 1, 0.6);
      const g = new THREE.Group(); g.add(h.root, sling, bow, hat, ...bands, ...strings, pouch, pebble, arrow, shadow);
      g.visible = false; scene.add(g);
      hunters[i] = { h, g, sling, bow, hat, bands, strings, pouch, pebble, arrow, shadow, grp: -1, reach: 0, drawW: 0, stunT: 0, clip: 'idle', yaw: undefined };
      if (i % 2) await tick();
    }
  })();

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _dir = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _up = new THREE.Vector3();
  const _out = new THREE.Vector3(), _cheek = new THREE.Vector3(), _hand = new THREE.Vector3(), _mid = new THREE.Vector3(), _pp = new THREE.Vector3();
  const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
  function poseHunter(H, hs, s, dt) {
    const sl = SLOTS[hs.slot], d = F * 1.82 / (160 * sl.s);     // a 1.82 m person stands 160 x s flat units tall
    const grp = sl.s < 0.9 ? G_FAR : G_NEAR;
    if (grp !== H.grp) { inGroup(H.g, grp); H.grp = grp; }
    H.g.visible = true;
    P(sl.x, sl.y, d, H.h.root.position);
    // aim: the flat art's angle (cheek -> perch, lobs aim high), turned toward the viewer so the face and the draw read
    const { face, ang } = aimOf(s.perches, hs.slot, hs.target, hs.kind);
    _dir.set(face * Math.cos(ang), -Math.sin(ang), 0.42).normalize();
    const pulling = hs.phase === 'pull', cooling = hs.phase === 'cool', stunned = hs.phase === 'stunned';
    const p = pulling ? 1 - hs.timer / hs.total : 0, dur = hs.cancel ? 0.8 : 0.6, rel = cooling ? 1 - hs.timer / dur : 1, snapped = cooling && !hs.cancel;
    let raise, draw;
    if (pulling) { raise = smooth(0, 0.3, p); draw = smooth(0.22, 1, p); }
    else if (cooling && hs.cancel) { raise = 1 - smooth(0, 0.7, rel); draw = 1 - smooth(0, 0.4, rel); }
    else if (cooling) { raise = 1 - smooth(0.12, 0.7, rel); draw = 0; }
    else { raise = 0; draw = 0; }
    // body: a relaxed three-quarter stance toward the field; turns square to the aim as the sling comes up
    const targetYaw = lerp(face * 1.0, Math.atan2(_dir.x, _dir.z), raise);
    H.yaw = H.yaw === undefined ? targetYaw : H.yaw + (targetYaw - H.yaw) * Math.min(1, dt * 10);
    H.h.root.rotation.y = H.yaw;
    // clips: idle (breathing, weight shifts); knocked down = a hit reaction, then a dazed crouch; then back up to idle
    H.stunT = stunned ? H.stunT + dt : 0;
    const want = stunned ? (H.stunT < 0.5 ? 'hit' : 'crouch_idle') : 'idle';
    if (want !== H.clip) { H.h.play(want, { fade: want === 'hit' ? 0.08 : 0.35, loop: want !== 'hit' }); H.clip = want; }
    // arms by IK: the fork (or bow) hand pushes out along the aim, the drawing hand comes back to the cheek
    H.reach += ((stunned ? 0 : raise) - H.reach) * Math.min(1, dt * 14);
    // the draw follows the sim; after the release the hand follows through instead of snapping back (a slower ease)
    const wantDraw = stunned ? 0 : (pulling || (cooling && hs.cancel)) ? draw : 0;
    H.drawW += (wantDraw - H.drawW) * Math.min(1, dt * (wantDraw > H.drawW ? 16 : 7));
    if (H.reach > 0.003 || H.drawW > 0.003) {
      // the fork hand reaches toward where the flat art puts the fork (a straight arm at most); stones and aim arcs then leave from the 3D fork
      const ho = handOrigin(s.perches, hs.slot, hs.target, hs.kind);
      P(ho.x, ho.y, d, _out); _out.y -= 0.1;
      H.h.bonePosition('L_UpperArm', _a);
      _c.subVectors(_out, _a); if (_c.length() > 0.6) _out.copy(_a).addScaledVector(_c.normalize(), 0.6);   // a straight arm, not a stretched one
      _out.lerp(_a.clone().addScaledVector(_dir, 0.45), 1 - H.reach);
      H.h.setReach('L', _out, { weight: H.reach });
      H.h.bonePosition('Head', _b);
      _cheek.copy(_b).addScaledVector(_dir, 0.06); _cheek.y -= 0.05;
      _hand.copy(_out).addScaledVector(_dir, -0.1).lerp(_cheek, H.drawW);
      H.h.setReach('R', _hand, { weight: Math.min(1, Math.max(H.reach * 0.9, H.drawW)) });
      H.h.lookAt(_c.copy(_out).addScaledVector(_dir, 4), { weight: H.reach });
    } else { H.h.setReach('L', null); H.h.setReach('R', null); H.h.lookAt(null); }
    H.h.update(dt);                                   // pose first, THEN place the props from the posed hands
    H.h.root.updateMatrixWorld(true);
    const arrowKind = hs.kind === 'arrow';
    H.sling.visible = !arrowKind; H.bow.visible = arrowKind;
    const prop = arrowKind ? H.bow : H.sling;
    H.h.handPosition('L', _a);
    if (!arrowKind) {
      // the fork stands up in the fist and leans into the aim as it is raised
      _up.set(0, 1, 0).lerp(_dir, 0.22 * H.reach).normalize();
      _x.crossVectors(_up, _dir).normalize(); if (_x.lengthSq() < 1e-4) _x.set(1, 0, 0);
      _m.makeBasis(_x, _up, _c.crossVectors(_x, _up).normalize());
      prop.quaternion.setFromRotationMatrix(_m); prop.position.copy(_a).addScaledVector(_up, 0.015);
    } else {
      // the bow upright in the left fist, its belly toward the target
      _x.set(0, 1, 0).cross(_dir).normalize(); _y.crossVectors(_dir, _x).normalize();
      _m.makeBasis(_dir, _y, _x); prop.quaternion.setFromRotationMatrix(_m); prop.position.copy(_a).addScaledVector(_dir, 0.5);
    }
    prop.updateMatrixWorld(true);
    _t1.copy(prop.userData.tips[0]).applyMatrix4(prop.matrixWorld); _t2.copy(prop.userData.tips[1]).applyMatrix4(prop.matrixWorld);
    H.h.handPosition('R', _b);
    const holding = (pulling && p > 0.04) || (cooling && hs.cancel && draw > 0.02);
    _mid.addVectors(_t1, _t2).multiplyScalar(0.5);
    if (holding) _pp.copy(_b);
    else if (snapped) { const wob = Math.sin(rel * 70) * (1 - Math.min(1, rel / 0.3)) * 0.05; _pp.copy(_mid).addScaledVector(_dir, wob - 0.02); _pp.y -= 0.03; }
    else { _pp.copy(_mid).addScaledVector(_dir, -0.03); _pp.y -= 0.07; }
    if (pulling) { const q = arrowKind ? _a.clone().addScaledVector(_dir, 0.05) : _mid, dd = -q.z; v3.hand[hs.slot] = { x: 360 + F * q.x / dd, y: HORIZON - F * q.y / dd }; }
    H.pouch.position.copy(_pp); H.pouch.visible = !arrowKind;
    H.pebble.position.copy(_pp); H.pebble.visible = !arrowKind && (holding || (!snapped && !cooling && raise > 0));
    for (let i = 0; i < 2; i++) {
      const tip = i ? _t2 : _t1;
      setStick(H.bands[i], tip, _pp); H.bands[i].visible = !arrowKind;
      setStick(H.strings[i], tip, holding ? _b : _mid); H.strings[i].visible = arrowKind;
    }
    H.arrow.visible = arrowKind && (holding || (!cooling && raise > 0));
    if (H.arrow.visible) { _x.set(0, 1, 0).cross(_dir).normalize(); _y.crossVectors(_dir, _x).normalize(); _m.makeBasis(_dir, _y, _x); H.arrow.quaternion.setFromRotationMatrix(_m); H.arrow.position.copy(_b).addScaledVector(_dir, 0.33); }
    // a felt hat on the head (follows the head's position and the body's turn)
    H.h.bonePosition('Head', _a); H.hat.position.set(_a.x, _a.y + 0.1, _a.z); H.hat.quaternion.setFromEuler(new THREE.Euler(stunned ? 0.25 : 0, H.yaw, 0));
    // contact shadow under the feet, away from the sun
    const r = H.h.root.position; H.shadow.position.set(r.x + 0.2, r.y + 0.01, r.z - 0.05);
  }

  // ---------------------------------------------------------------- the bird, stones, arrows, acorns, seeds, nets, dogs
  const bird = buildBird(); scene.add(inGroup(bird, G_TOP));
  const birdShadow = new THREE.Mesh(blobGeo, blobMat); scene.add(inGroup(birdShadow, G_TOP));
  const pool = (make, n, gi) => Array.from({ length: n }, (_, i) => { const o = make(i); o.visible = false; scene.add(inGroup(o, gi)); return o; });
  const stoneMs = pool((i) => buildStone(i + 1), 24, G_TOP), arrowMs = pool(() => buildArrow(), 12, G_TOP), netMs = pool(() => buildNet(), 4, G_TOP);
  const acornMs = pool(() => buildAcorn(), 6, G_TOP), seedMs = pool(() => buildSeed(), 8, G_NEAR), dogMs = pool(() => buildDog(), 3, G_NEAR);

  // ---------------------------------------------------------------- camera: projection built from the flat layout
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  function setProjection(V, n = 0.05, f = 6000) {
    const W = cssW(), H = cssH(), c = cpu(), offX = (W - meta.width * c) / 2, offY = (H - meta.height * c) / 2;
    const Su = V.z * c, Ou = offX + V.ox * c, Ov = offY + V.oy * c;
    const A = 2 * Su * F / W, Bx = 2 * (Ou + Su * 360) / W - 1, Cy = 2 * Su * F / H, By = 1 - 2 * (Ov + Su * HORIZON) / H;
    // x_ndc = A x/d + Bx, y_ndc = Cy y/d + By  (d = -z): a flat-art point P(X, Y, d) lands on its flat screen pixel
    camera.projectionMatrix.set(A, 0, -Bx, 0, 0, Cy, -By, 0, 0, 0, -(f + n) / (f - n), -2 * f * n / (f - n), 0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    skyMat.uniforms.uHorizon.value = 1 - (Ov + Su * HORIZON) / H;
    skyMat.uniforms.uAspect.value = W / H;
    return { Su, Ou, Ov, W, H };
  }

  // ---------------------------------------------------------------- tiers, context loss
  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); renderer.setSize(cssW(), cssH(), false); }
  applyTier();
  let lost = false, attached = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; }, false);
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); if (attached) { v3.on = true; v3.fade = 0; onAt = performance.now(); canvas.style.visibility = 'visible'; } }, false);
  window.addEventListener('resize', applyTier);

  // ---------------------------------------------------------------- per frame
  let game = null, last = performance.now(), lastClock = null, onAt = 0, slow = 0;
  const birdPrev = { x: 0, y: 0, vx: 0, vy: 0 };
  let flap = 0, birdTilt = 0, birdYaw = -0.42;
  const C = (h) => new THREE.Color(h);
  const SKY0 = [C('#4f95d6'), C('#a8d3ec'), C('#f6e2b6')], SKY1 = [C('#3a4f9a'), C('#f0a46a'), C('#ffcf88')];
  const SUN0 = C('#fff0d4'), SUN1 = C('#ffae6a');

  function render() {
    const fr = v3.frame; if (!fr || lost) return;
    const { s, t, title, L } = fr;
    const now = performance.now(), wall = Math.min(0.1, (now - last) / 1000); last = now;
    // animation time follows the game clock (frozen on pause), never the wall clock alone
    let dt = lastClock === null ? 0 : clamp(t - lastClock, 0, 0.1); lastClock = t;
    const st = game.getState();
    if (st.scene === 'pause' || (st.auto && st.auto.paused)) dt = 0;
    const V = L.V;
    const pr = setProjection(V);
    // a slow drift on the menu: the near trees slide a little against the far hills
    camera.position.set(title ? Math.sin(t * 0.17) * 0.16 : 0, title ? Math.sin(t * 0.11) * 0.05 : 0, 0);
    camera.quaternion.identity(); camera.updateMatrixWorld(true);
    // the day: colours and sun follow the flat art's sunset
    const prog = title ? 0 : Math.min(1, s.t / s.duration);
    skyMat.uniforms.uTop.value.copy(SKY0[0]).lerp(SKY1[0], prog); skyMat.uniforms.uMid.value.copy(SKY0[1]).lerp(SKY1[1], prog); skyMat.uniforms.uLow.value.copy(SKY0[2]).lerp(SKY1[2], prog);
    const sunY = 150 + prog * 190;
    skyMat.uniforms.uSun.value.set((pr.Ou + 120 * pr.Su) / pr.W, 1 - (pr.Ov + sunY * pr.Su) / pr.H);
    sun.color.copy(SUN0).lerp(SUN1, prog); sun.intensity = 2.7 - prog * 0.8; sun.position.set(-6, 7 - prog * 4, 5);
    rim.color.copy(sun.color); rim.intensity = 1.4 + prog * 0.9; hemi.intensity = 1.05 - prog * 0.3;
    scene.fog.color.copy(skyMat.uniforms.uLow.value).lerp(skyMat.uniforms.uMid.value, 0.5);
    // clouds
    const span = V.vx1 - V.vx0;
    clouds.forEach((c, i) => {
      const u = c.userData, d = 2200, x = V.vx0 - 160 + ((u.ph + t * u.sp) % (span + 320)), y = 205 + u.row * 62 - (i >= 8 ? 40 : 0);
      c.visible = y > V.vy0 - 60 && y < HORIZON - 40; P(x, y, d, c.position); c.scale.set(u.w * d / F, u.w * 0.38 * d / F, 1);
    });
    // trees: the level's own, plus the margins on wide screens
    const list = s.trees.map((tr) => ({ ...tr, key: `L${tr.x},${tr.y},${tr.s},${tr.offs.length},${tr.crown}` }));
    for (const tr of sideTreeList(V)) list.push({ ...tr, crown: 0.92, key: `S${tr.key}` });
    placeTrees(list);
    const wind = s.feats.wind && !title;
    for (const tr of list) {
      const e = getTree(tr);
      e.pen.visible = !!wind && tr.key[0] === 'L'; if (e.pen.visible) wavePennant(e.pen, s.wind, t);
      if (e.crown) { e.crown.rotation.z = Math.sin(t * 0.9 + tr.x * 0.01) * 0.006 + (wind ? s.wind * 0.01 : 0); e.crown.position.x = Math.sin(t * 1.3 + tr.y) * 1.5; }
    }
    // hunters
    const shown = new Set();
    for (const hs of shownHunters(s, title)) { const H = hunters[hs.slot]; if (!H) continue; shown.add(hs.slot); poseHunter(H, hs, s, dt); }
    hunters.forEach((H, i) => { if (H && !shown.has(i)) H.g.visible = false; });
    // stones, arrows and nets in flight (the flat art's paths and sizes)
    let si = 0, ai = 0, ni = 0;
    for (const m of stoneMs) m.visible = false; for (const m of arrowMs) m.visible = false; for (const m of netMs) m.visible = false;
    for (const sto of s.stones) {
      const f = Math.min(1, sto.age / sto.flight), p = perchPoint(s.perches, sto.target);
      const sl = sto.slot >= 0 ? SLOTS[sto.slot] : null;
      const from = sl ? launchPoint(sto.slot, () => handOrigin(s.perches, sto.slot, sto.target, sto.kind)) : perchPoint(s.perches, sto.fromPerch), k0 = sl ? sl.s : 1;
      const x = from.x + (p.x - from.x) * f, y = from.y + (p.y - from.y) * f - Math.sin(Math.PI * f) * sto.arc;
      const r = (10 + 14 * (k0 + (Math.max(0.6, p.s) * 1.15 - k0) * f)) * 0.6, d = 6;
      if (sto.kind === 'arrow') {
        const m = arrowMs[ai++]; if (!m) continue;
        const f2 = Math.min(1, f + 0.03), x2 = from.x + (p.x - from.x) * f2, y2 = from.y + (p.y - from.y) * f2 - Math.sin(Math.PI * f2) * sto.arc;
        m.visible = true; P(x, y, d, m.position); m.scale.setScalar((0.5 + r / 16) * d / F); m.rotation.set(0, 0, -Math.atan2(y2 - y, x2 - x)); m.rotateX(sto.age * 14);
      } else if (sto.kind === 'net') {
        const m = netMs[ni++]; if (!m) continue;
        m.visible = true; P(x, y, d, m.position); m.scale.setScalar(r * 1.6 * d / F); m.rotation.set(0.45, 0, f * 4);
      } else {
        const m = stoneMs[si++]; if (!m) continue;
        m.visible = true; P(x, y, d, m.position); m.scale.setScalar(r * d / F); m.rotation.set(sto.age * 9 + sto.target, sto.age * 6, 0);
      }
    }
    acornMs.forEach((m) => { m.visible = false; });
    s.nuts.forEach((n, i) => {
      const m = acornMs[i]; if (!m) return;
      const f = Math.min(1, n.age / n.flight), sl = SLOTS[n.slot], to = { x: sl.x, y: sl.y - 75 * sl.s };
      const x = n.from.x + (to.x - n.from.x) * f, y = n.from.y + (to.y - n.from.y) * f - Math.sin(Math.PI * f) * 70, r = 13 * (1 - f * (1 - Math.max(0.5, sl.s))), d = 5;
      m.visible = true; P(x, y, d, m.position); m.scale.setScalar(r / 13 * d / F); m.rotation.set(0, f * 3, f * 12);
    });
    seedMs.forEach((m) => { m.visible = false; });
    s.seeds.forEach((sd, i) => {
      const m = seedMs[i]; if (!m) return;
      if (sd.ttl < 1.6 && Math.floor(t * 10) % 2 === 0) return;
      const p = perchPoint(s.perches, sd.perch), k = Math.max(0.6, p.s), d = 5;
      m.visible = true; P(p.x, p.y - 36 * k + Math.sin(t * 3 + sd.perch) * 4, d, m.position); m.scale.setScalar(k * d / F); m.userData.gem.rotation.y = t * 2.2;
    });
    dogMs.forEach((m) => { m.visible = false; });
    s.beaters.forEach((bt, i) => {
      const m = dogMs[i]; if (!m) return;
      const pp = s.perches[bt.perch], tr = s.trees[pp.tree], q = 1 - bt.timer / bt.total, e = q * q * (3 - 2 * q);
      const sx = pp.x < 360 ? V.vx0 - 50 : V.vx1 + 50, tx = tr.x + Math.sign(sx - tr.x) * 46 * tr.s, x = sx + (tx - sx) * e, k = Math.max(0.55, tr.s);
      const face = Math.sign(tx - sx) || 1, d = 7;
      m.visible = true; P(x, tr.y + 6, d, m.position); m.scale.setScalar(k * d / F * 1.15); m.rotation.y = face > 0 ? -0.35 : Math.PI + 0.35;
      poseDog(m, t, q < 0.98 ? 1 : 0.2);
    });
    // the bird
    const b = s.bird, bp = birdPoint(s), flying = b.flit >= 0, step = dt || wall;
    const sc = Math.max(0.6, bp.s), d = 4, bx = bp.x + (b.stun > 0 ? Math.sin(t * 60) * 4 : 0), by = bp.y - 4 + (title ? Math.sin(t * 2) * 3 : 0);
    if (dt > 0) { birdPrev.vx = (bp.x - birdPrev.x) / dt; birdPrev.vy = (bp.y - birdPrev.y) / dt; }
    birdPrev.x = bp.x; birdPrev.y = bp.y;
    const dirX = flying ? Math.sign(s.perches[b.dest].x - s.perches[b.from].x) || 1 : (birdYaw > Math.PI / 2 ? -1 : 1);
    birdYaw += ((dirX > 0 ? -0.42 : Math.PI + 0.42) - birdYaw) * Math.min(1, step * 9);
    const tiltT = flying ? clamp(-Math.atan2(birdPrev.vy, Math.abs(birdPrev.vx) + 1) * 0.6, -0.6, 0.6) : 0;
    birdTilt += (tiltT - birdTilt) * Math.min(1, step * 10);
    flap += (flying ? 50 : 0) * dt;
    bird.visible = !(b.inv > 0 && Math.floor(t * 16) % 2 === 0);
    P(bx, by, d, bird.position); bird.scale.setScalar(sc * d / F); bird.rotation.set(0, birdYaw, 0);
    poseBird(bird, { flying, phase: flap, breathe: Math.sin(t * 5), tilt: birdTilt });
    birdShadow.visible = !flying; P(bp.x + 6, bp.y + 26, d, birdShadow.position); birdShadow.scale.set(50 * sc * d / F, 1, 12 * sc * d / F);

    // draw: sky + grass + hills, then each group over a cleared depth buffer (the flat art's painter order)
    renderer.setClearColor(0x000000, 1); renderer.clear(true, true, true);
    for (const gi of [G_SKY, G_FAR, G_TREES, G_NEAR, G_TOP]) { camera.layers.set(gi); renderer.render(scene, camera); renderer.clearDepth(); }
    // quality: drop a tier after sustained slow frames
    if (wall > 0.026) slow += wall; else slow = Math.max(0, slow - wall * 0.5);
    if (slow > 1.5 && tier < 2) { tier += 1; slow = 0; applyTier(); }
    if (v3.fade < 1) v3.fade = Math.min(1, (now - onAt) / 450);
  }

  return {
    ok: true, ready: humansReady, error: () => humanErr,
    attach(g) { game = g; attached = true; canvas.style.visibility = 'visible'; v3.fade = 0; onAt = performance.now(); v3.on = true; },
    post() { if (attached && v3.on) render(); },
    tier: () => TIERS[tier].name,
    // measurement hook (check scripts): the bird and each visible hunter's hands and feet in metres, world space
    probe: () => ({ bird: bird.position.toArray(), birdScale: bird.scale.x, hunters: hunters.filter((H) => H && H.g.visible).map((H) => ({ R: H.h.handPosition('R', new THREE.Vector3()).toArray(), L: H.h.handPosition('L', new THREE.Vector3()).toArray(), fL: H.h.bonePosition('L_Foot', new THREE.Vector3()).toArray(), fR: H.h.bonePosition('R_Foot', new THREE.Vector3()).toArray() })) }),
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
