// Lawn Bowls 3D presenter. It READS the game state (game.getState()) and never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas; the 2D layer draws the HUD, the menus and a few labels. The camera of this scene is built from the very
// numbers src/cam.js uses for its perspective projector (camera3), so the aim label, the measuring lines and touch picking land on
// the pixel they belong to.
//
// Scene: a manicured club green at a soft English afternoon (mown stripes, ditch and bank, rink strings), lacquered bowls and a jack
// at real size, a bowler in whites (view3d athlete rig, authored delivery), a pavilion with a veranda, benches under hedges,
// flowerbeds and seated spectators in sunhats (crowd3d). Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws
// with the flat 2D art; context restored -> back to 3D.
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { camera3 } from '../src/cam.js';
import { ranking, R_BOWL, R_JACK } from '../src/sim.js';
import { buildWorld } from './world.js';
import { makeBowlKit } from './bowls.js';
import { createFigures } from './bowler.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const QS = (() => { try { return new URLSearchParams(globalThis.location.search); } catch { return new URLSearchParams(''); } })();
const PAGES = new Set(['howto', 'about', 'rules']);

function pickQuality() {
  const m = QS.get('q'); if (m === 'low' || m === 'medium' || m === 'high') return m;
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  let touch = false; try { touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches); } catch { /* ignore */ }
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { ok: false, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, THREE } = V3;
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 8, preserveDrawingBuffer: QS.has('shot') }); }
  catch (e) { canvas.remove(); console.warn('stage failed', e); return none; }
  if (!stage.supported) { canvas.remove(); return none; }
  const renderer = stage.renderer, cam = stage.camera, scene = stage.scene;
  renderer.autoClear = false;
  cam.near = 0.1; cam.far = 700;

  // ---- soft English afternoon: warm low sun from the left-behind, blue sky fill, green bounce -------------------------------------
  stage.setLighting('day', { sky: 0xb9d4ea, fog: 0xd7e3e8, hemiSky: 0xcfe2ff, hemiGround: 0x7a9a4a, hemi: 0.95, key: 0xfff0d2, keyI: 3.1, rim: 0xcfdcff, rimI: 0.7, exposure: 1.0 });
  stage.setSky(0xb9d4ea, 0xd7e3e8, { near: 70, far: 330 });
  stage._shadowOffset.set(-15, 11, -7);
  stage.lights.rim.position.set(6, 5, 14);
  const key = stage.lights.key;
  if (renderer.shadowMap.enabled) {
    const sc = key.shadow.camera; sc.near = 1; sc.far = 80; sc.updateProjectionMatrix();
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; key.shadow.radius = 3;
  }
  const setShadowExtent = (ext) => {
    const sc = key.shadow.camera;
    if (Math.abs(sc.right - ext) > 0.2) { sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix(); }
  };

  const P = { stage, THREE, V3, ok: true, ready: false, lost: false, quality, clock: 0, cam };
  const world = buildWorld(V3, stage, { quality });
  P.world = world;
  const kit = makeBowlKit(V3);

  // ---- soft sprites / marks --------------------------------------------------------------------------------------------------------
  const texFrom = (draw, w = 128, h = 128) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const glowTex = texFrom((g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); });
  const ringTex = texFrom((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = w * 0.045; g.beginPath(); g.arc(w / 2, h / 2, w * 0.4, 0, TAU); g.stroke(); g.lineWidth = w * 0.018; g.globalAlpha = 0.6; g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, TAU); g.stroke(); });
  const crossTex = texFrom((g, w, h) => { g.strokeStyle = '#fff'; g.lineWidth = w * 0.04; g.lineCap = 'round'; for (let a = 0; a < 4; a++) { g.save(); g.translate(w / 2, h / 2); g.rotate((a * Math.PI) / 2); g.beginPath(); g.moveTo(w * 0.16, 0); g.lineTo(w * 0.34, 0); g.stroke(); g.restore(); } g.beginPath(); g.arc(w / 2, h / 2, w * 0.05, 0, TAU); g.fillStyle = '#fff'; g.fill(); });
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const mark = (map, color, op = 0.9) => {
    const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op, fog: false }));
    m.renderOrder = 4; m.visible = false; scene.add(m); return m;
  };
  const aimRing = mark(ringTex, 0xffd54a, 0.95), aimCross = mark(crossTex, 0xffffff, 0.9), aimGlow = mark(glowTex, 0xffe9a8, 0.35);
  const restRing = mark(ringTex, 0xffffff, 0.8), spreadRing = mark(ringTex, 0xffe9a8, 0.55), hintRing = mark(ringTex, 0x7dffb8, 0.9);
  const crownRing = mark(ringTex, 0xffd24a, 0.9);
  const pulses = []; for (let i = 0; i < 6; i++) pulses.push({ m: mark(ringTex, 0xfff3cf, 0.9), t: 9, x: 0, z: 0 });
  const NDOT = 160, dotGeo = new THREE.CircleGeometry(0.028, 10); dotGeo.rotateX(-Math.PI / 2);
  const dots = new THREE.InstancedMesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: false }), NDOT);
  dots.renderOrder = 5; dots.frustumCulled = false; dots.count = 0; scene.add(dots);
  const NS = 120, sprites = [];
  for (let i = 0; i < NS; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xd9c9a0, transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.visible = false; s.renderOrder = 6; scene.add(s); sprites.push(s);
  }
  // the faint trail of the bowl that is rolling: a flat ribbon on the grass
  const TRAIL_N = 420;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 6), 3));
  trailGeo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2), 1));
  trailGeo.setIndex((() => { const ix = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } return ix; })());
  const trailMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uCol: { value: new THREE.Color(0xffffff) } },
    vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA * 0.4); }' });
  const trailMesh = new THREE.Mesh(trailGeo, trailMat); trailMesh.frustumCulled = false; trailMesh.renderOrder = 3; trailMesh.visible = false; scene.add(trailMesh);

  // ---- the bowls ---------------------------------------------------------------------------------------------------------------------
  const NB = 12;
  const pools = [[], []];
  const mk = (team) => { const b = kit.make(team, R_BOWL); b.visible = false; scene.add(b); return { m: b, px: 0, pz: 0, inited: false, bias: 0, hd: 0, kind: 'bowl', team }; };
  for (let i = 0; i < NB; i++) { pools[0].push(mk(0)); pools[1].push(mk(1)); }
  const jacks = [0, 1, 2].map(() => { const j = kit.jack(R_JACK); j.visible = false; scene.add(j); return { m: j, px: 0, pz: 0, inited: false, kind: 'jack', hd: 0 }; });
  const ghosts = [];
  const mkGhost = (team) => {
    const g = kit.make(team, R_BOWL);
    g.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.42; o.material.depthWrite = false; } if (o.isMesh) o.castShadow = false; });
    g.visible = false; scene.add(g); return { m: g, team, px: 0, pz: 0, inited: false, bias: 0, hd: 0, kind: 'bowl' };
  };
  for (let i = 0; i < 4; i++) ghosts.push(mkGhost(i % 2));
  const jackGhost = (() => { const j = kit.jack(R_JACK); j.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.45; } o.castShadow = false; }); j.visible = false; scene.add(j); return j; })();

  // place one ball: position on the grass (sim metres), rolled by the distance it travelled, turned to its heading
  const _ax = new THREE.Vector3(), _q = new THREE.Quaternion();
  function placeBall(e, x, y, o = {}) {
    const m = e.m, r = e.kind === 'jack' ? R_JACK : R_BOWL;
    m.visible = true; m.position.set(x, r, -y);
    m.scale.setScalar(o.scale ?? 1);
    if (e.kind === 'bowl') {
      const bias = o.bias || e.bias || 1;
      if (bias !== e.bias) { e.bias = bias; m.children[0].rotation.z = bias >= 0 ? Math.PI / 2 : -Math.PI / 2; }
    }
    if (e.inited && !o.still) {
      const dx = x - e.px, dz = -y - e.pz, d = Math.hypot(dx, dz);
      if (d > 1e-5 && d < 1.5) {
        const sp = m.userData.spin;
        if (e.kind === 'jack') { _ax.set(dz, 0, -dx).normalize(); _q.setFromAxisAngle(_ax, d / r); sp.quaternion.premultiply(_q); }
        else {
          // heading follows the motion, smoothly; the bowl spins about its own axis by the distance rolled
          const hd = Math.atan2(-dx, -dz);
          let da = hd - e.hd; da = Math.atan2(Math.sin(da), Math.cos(da));
          e.hd += da * Math.min(1, d * 14 + 0.05);
          m.rotation.y = e.hd;
          sp.rotation.y += (m.children[0].rotation.z > 0 ? 1 : -1) * (d / r);
        }
      }
    } else if (!e.inited) { e.hd = m.rotation.y = o.yaw ?? 0; }
    e.px = x; e.pz = -y; e.inited = true;
  }
  const hideBalls = () => {
    for (const e of [...pools[0], ...pools[1], ...jacks, ...ghosts]) { e.m.visible = false; if (!e.keep) e.inited = false; }
    jackGhost.visible = false;
  };

  // ---- the people -------------------------------------------------------------------------------------------------------------------------
  const figs = createFigures(V3, stage, { kit, world, quality, qs: QS, R_BOWL, THREE });
  P.figs = figs;
  let crowd = null;
  function makeCrowd() {
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    try {
      const n = quality === 'low' ? 16 : quality === 'medium' ? 30 : 44;
      const S = world.SIDE, F = world.FAR;
      const rows = [];
      for (const sx of [-1, 1]) for (const yy of [6, 14, 22, 30]) rows.push({ from: [sx * (S + 0.05), 0, -yy + 1.0], to: [sx * (S + 0.05), 0, -yy - 1.0], count: 3, face: [0, 0, -yy], seated: true });
      for (const xx of [-7, -3.5, 0, 3.5, 7]) rows.push({ from: [xx - 0.9, 0, -F - 0.05], to: [xx + 0.9, 0, -F - 0.05], count: 3, face: [xx, 0, 0], seated: true });
      rows.push({ from: [-4, 0.0, -F - 6.4], to: [4, 0.0, -F - 6.4], count: 5, face: [0, 0, 0], seated: false });
      V3.CULTURES.english_club = {
        ...V3.CULTURES.european_village,
        hats: [[2, 6], [0, 2.5], [1, 1.5]], womenHat: [[2, 6.5], [0, 2], [5, 0.3]],
        garment: [[0, 4], [1, 3.5], [2, 0.4]], womanGarment: [[3, 4], [0, 3], [1, 2]],
        top: ['#f1eee3', '#d9e6ee', '#e8d7b8', '#bcd2ae', '#e8c6c2', '#c9d2dc', '#fff3c4', '#a9c2d6'], bottom: ['#f2efe6', '#cfd2c8', '#3a4a5a', '#c9bfa5'],
        hair: [['grey', 4], ['white', 3], ['brown', 2], ['blond', 1.5], ['dkbrown', 1]], scarf: 0.02,
      };
      crowd = V3.createCrowd3d(stage, { rows, count: n, seed: 41, culture: 'english_club', quality: quality === 'high' ? 'high' : 'medium', props: { flag: 0, phone: 0.05, child: 0.02 }, excitement: 0.15, viewportHeight: 800 });
    } catch (e) { console.warn('crowd unavailable', e); crowd = null; }
  }
  makeCrowd();

  // ---- cameras -----------------------------------------------------------------------------------------------------------------------
  let W = 1, H = 1;
  const focus = new THREE.Vector3();
  // gameplay camera: exactly the perspective projector of src/cam.js, rendered full screen (the head rect's centre is the principal point)
  function setPlayCamera(L, c) {
    const k = W / L.w, R = L.play.head;
    const c3 = camera3(R, L.wide, c);
    const fpx = c3.f * k;                                   // focal length in css px
    cam.fov = (2 * Math.atan((H / 2) / fpx)) * 180 / Math.PI;
    cam.aspect = W / H;
    cam.position.set(c3.px, c3.ph, -c3.py);
    focus.set(c.cx, 0, -c.cy);
    cam.up.set(0, 1, 0); cam.lookAt(focus);
    const cx = (R.x + R.w / 2) * k, cy = (R.y + R.h / 2) * k;
    cam.setViewOffset(W, H, -(cx - W / 2), -(cy - H / 2), W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    return c3;
  }
  // hero camera for the menus: low on the grass beyond the jack, looking back down the rink at the bowler
  const HERO = QS.get('hero') ? QS.get('hero').split('_').map(Number) : null;
  function setHeroCamera(L, t, calm) {
    const portrait = L.h > L.w * 0.9, sw = calm ? 0 : 1;
    // behind and to the right of the mat, low: the bowler delivers away from us down the green toward the pavilion
    let px = (portrait ? 0.9 : 2.0) + 0.1 * Math.sin(t * 0.13) * sw, py = portrait ? -8.2 : -3.6, pz = (portrait ? 1.7 : 1.25) + 0.04 * Math.sin(t * 0.21) * sw;
    let tx = portrait ? -0.3 : -0.15, ty = portrait ? 1.5 : 1.4, tz = portrait ? 0.7 : 0.62;
    let fov = portrait ? 41 : 36;
    if (HERO && HERO.length >= 6) [px, pz, py, tx, tz, ty] = HERO;
    if (HERO && HERO[6]) fov = HERO[6];
    cam.fov = fov; cam.aspect = W / H;
    cam.position.set(px, pz, -py);
    cam.up.set(0, 1, 0); cam.lookAt(tx, tz, -ty);
    // keep the bowler in the lower part of a portrait screen, below the title and the menu buttons
    // (the bowler's head used to sit behind the last row of buttons; farther camera + lower shift clears it. Landscape: shifted right of the title)
    const sh = portrait ? -H * 0.375 : 0, shx = portrait ? (W / H >= 0.6 ? W * 0.27 : 0) : -W * 0.085;
    cam.setViewOffset(W, H, shx, sh, W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const CU = QS.get('cu') ? QS.get('cu').split(',').map(Number) : null;   // QA: ?cu=px,py,pz,tx,ty,tz[,fov] a free camera in three coordinates
  function setCuCamera() {
    cam.clearViewOffset(); cam.position.set(CU[0], CU[1], CU[2]); cam.up.set(0, 1, 0); cam.lookAt(CU[3], CU[4], CU[5]); cam.fov = CU[6] || 30; cam.aspect = W / H;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }

  // ---- one frame ---------------------------------------------------------------------------------------------------------------------------
  let lastT = null, lastWall = null, frames = 0, slowFrames = 0, ema = 16, lastPhase = '', tier = quality === 'high' ? 0 : quality === 'medium' ? 1 : 2;
  function updateTrail(state, inPlay) {
    const tr = inPlay ? state.trail : null;
    if (!tr || tr.length < 6) { trailMesh.visible = false; return; }
    const total = Math.floor(tr.length / 2), step = Math.max(1, Math.ceil(total / TRAIL_N));
    const pos = trailGeo.attributes.position.array, al = trailGeo.attributes.alpha.array;
    let k = 0;
    for (let i = 0; i < total && k < TRAIL_N; i += step) {
      const x = tr[i * 2], y = tr[i * 2 + 1];
      const j = Math.min(total - 1, i + step), x2 = tr[j * 2], y2 = tr[j * 2 + 1];
      let dx = x2 - x, dy = y2 - y; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
      const nx = -dy, ny = dx, w = 0.014;
      pos[k * 6] = x + nx * w; pos[k * 6 + 1] = 0.006; pos[k * 6 + 2] = -(y + ny * w);
      pos[k * 6 + 3] = x - nx * w; pos[k * 6 + 4] = 0.006; pos[k * 6 + 5] = -(y - ny * w);
      const a = i / Math.max(1, total - 1);
      al[k * 2] = al[k * 2 + 1] = 0.12 + 0.88 * a;
      k++;
    }
    if (k < 2) { trailMesh.visible = false; return; }
    trailGeo.setDrawRange(0, (k - 1) * 6);
    trailGeo.attributes.position.needsUpdate = true; trailGeo.attributes.alpha.needsUpdate = true;
    trailMesh.visible = true;
  }

  const _d = new THREE.Object3D();
  function present(state, L, dt, wall) {
    const sc = state.scene, calm = !!(state.settings && state.settings.calm);
    const inPlay = !!(sc === 'play' && state.m && state.w);
    const w = inPlay ? state.w : state.att ? state.att.w : null;
    const parts = inPlay ? state.parts : state.att ? state.att.parts : [];
    hideBalls();
    // ---- bowls and the jack
    crownRing.visible = false;
    if (w) {
      const used = [0, 0]; let ji = 0;
      for (const b of w.balls) {
        if (b.fade > 1.1) continue;
        const dead = (b.out || (b.ditch && !b.toucher)) && !b.k;
        const s2 = dead ? clamp(1 - b.fade * 0.8, 0.001, 1) : 1;
        if (b.k) placeBall(jacks[Math.min(ji++, jacks.length - 1)], b.x, b.y, { scale: s2 });
        else { const t = b.team === 1 ? 1 : 0; placeBall(pools[t][Math.min(used[t]++, NB - 1)], b.x, b.y, { scale: s2, bias: b.bias || 1 }); }
      }
      if (inPlay && w.balls.length && state.m.phase === 'score') {
        const rk = ranking(w);
        if (rk.length) { const b = rk[0].b; crownRing.visible = true; crownRing.position.set(b.x, 0.012, -b.y); crownRing.scale.setScalar(0.5 + 0.03 * Math.sin(P.clock * 4)); crownRing.material.opacity = 0.6 + 0.3 * Math.sin(P.clock * 4); }
      }
    }
    // ---- aim ring, flight dots, ghost bowl, spread
    for (const m of [aimRing, aimCross, aimGlow, restRing, spreadRing, hintRing]) m.visible = false;
    dots.count = 0;
    const a = inPlay ? state.aim : null, pv = inPlay ? state.prev : null, m = inPlay ? state.m : null;
    const showAim = !!(inPlay && a && (state.humanTurn || (state.think && (state.think.phase === 'reveal' || state.think.phase === 'pull'))) && (m.phase === 'aim' || m.phase === 'jack') && !state.paused);
    if (showAim) {
      const pulse = 0.5 + 0.5 * Math.sin(P.clock * 6), jack = m.phase === 'jack', gm = state.settings.guide;
      aimRing.position.set(a.x, 0.014, -a.y); aimRing.scale.setScalar(0.36 + pulse * 0.025); aimRing.visible = true;
      aimCross.material.color.setHex(jack ? 0xfff0aa : 0xffffff); aimCross.position.set(a.x, 0.015, -a.y); aimCross.scale.setScalar(0.62 + pulse * 0.04); aimCross.visible = true;
      aimGlow.position.set(a.x, 0.012, -a.y); aimGlow.scale.setScalar(0.8); aimGlow.material.opacity = 0.2 + 0.12 * pulse; aimGlow.visible = true;
      const full = gm !== 2 || !state.humanTurn;
      if (pv && full) {
        const pts = pv.path;
        let total = 0; for (let i = 2; i < pts.length; i += 2) total += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
        const lim = gm === 1 && state.humanTurn ? total * 0.38 : total;
        let acc = 0, run = 0, n = 0; const every = 0.42;
        for (let i = 2; i < pts.length && n < NDOT && run < lim; i += 2) {
          const sx = pts[i - 2], sy = pts[i - 1], ex = pts[i], ey = pts[i + 1], seg = Math.hypot(ex - sx, ey - sy);
          let off = every - acc;
          while (off <= seg && run + off <= lim && n < NDOT) {
            const u = off / seg; _d.position.set(sx + (ex - sx) * u, 0.012, -(sy + (ey - sy) * u)); _d.scale.setScalar(n % 4 === 0 ? 1.2 : 0.9); _d.updateMatrix(); dots.setMatrixAt(n++, _d.matrix); off += every;
          }
          acc = (acc + seg) % every; run += seg;
        }
        dots.count = n; dots.instanceMatrix.needsUpdate = true;
        dots.material.color.setHex(jack ? 0xfff0aa : 0xffffff);
        if (!jack && pv.rest && (gm === 0 || !state.humanTurn)) {
          restRing.visible = true; restRing.position.set(pv.rest.x, 0.013, -pv.rest.y); restRing.scale.setScalar(R_BOWL * 3.8); restRing.material.opacity = 0.55 + 0.25 * pulse;
          if (pv.spread && state.humanTurn && gm !== 2) { spreadRing.visible = true; spreadRing.position.set(pv.rest.x, 0.011, -pv.rest.y); spreadRing.scale.set(Math.max(0.2, pv.spread.x * 4), 1, Math.max(0.2, pv.spread.y * 4)); }
        }
        if (!jack && pv.rest && (gm === 0 || !state.humanTurn)) {
          placeBall(ghosts[m.turn === 1 ? 1 : 0], pv.rest.x, pv.rest.y, { bias: a.hand || 1 });
          let gi = 0;
          for (const mv of pv.moved || []) {
            if (mv.k) { jackGhost.visible = true; jackGhost.position.set(mv.x, R_JACK, -mv.y); }
            else if (gi < 2) { const g = ghosts[2 + gi++]; g.m.visible = true; g.m.position.set(mv.x, R_BOWL, -mv.y); }
          }
        }
      }
    }
    if (inPlay && state.hintPlan && state.humanTurn) { hintRing.visible = true; hintRing.position.set(state.hintPlan.tx, 0.014, -state.hintPlan.ty); hintRing.scale.setScalar(0.5 + 0.03 * Math.sin(P.clock * 6)); }
    // ---- sparks, dust and contact rings from the sim's particles
    let si = 0;
    for (const p of parts) {
      if (si >= NS) break;
      const k = Math.max(0, 1 - p.t / p.max);
      if (p.kind === 2) {
        const r = pulses.find((q) => q.t > 0.5 && !q.keyed);
        if (p.t < 0.06) { const free = pulses.find((q) => q.t > 0.5); if (free && !(free.x === p.x && free.z === -p.y)) { free.t = 0; free.x = p.x; free.z = -p.y; } }
        void r; continue;
      }
      const s = sprites[si++];
      s.visible = true; s.position.set(p.x, Math.max(0.02, p.z * 0.6 + 0.03), -p.y);
      if (p.kind === 1) { s.material.color.setHex(0xfff0b8); s.material.blending = THREE.AdditiveBlending; s.material.opacity = k; s.scale.setScalar(0.045 + 0.04 * k); }
      else {
        const col = p.col && p.col.startsWith('rgba') ? p.col.match(/\d+/g).slice(0, 3).map(Number) : [210, 190, 140];
        s.material.color.setRGB(col[0] / 255, col[1] / 255, col[2] / 255); s.material.blending = THREE.NormalBlending; s.material.opacity = k * 0.5; s.scale.setScalar((0.1 + p.size * 0.05) * (1 + p.t * 2.4));
      }
    }
    for (; si < NS; si++) sprites[si].visible = false;
    for (const r of pulses) { r.t += wall; if (r.t < 0.5) { r.m.visible = true; r.m.position.set(r.x, 0.016, r.z); r.m.scale.setScalar(0.18 + r.t * 1.5); r.m.material.opacity = 0.8 * (1 - r.t / 0.5); } else r.m.visible = false; }
    updateTrail(state, inPlay);

    // ---- people
    figs.update({ state, inPlay, dt, wall, calm, w, clock: P.clock });
    if (crowd && state.m) {
      const ph = state.m.phase;
      if (ph !== lastPhase) {
        if (ph === 'score' && state.m.endInfo && state.m.endInfo.pts > 0) crowd.react('cheer', { intensity: 0.7, origin: [0, 0, -30], radius: 60 });
        if (ph === 'over') crowd.react('ovation', { intensity: 1, origin: [0, 0, -30], radius: 60 });
        lastPhase = ph;
      }
    }
    if (crowd) crowd.update(wall);
    world.update(P.clock, calm);
    if (world.scenery) world.scenery.update(calm ? 0 : wall, cam);

    // ---- camera + draw
    if (CU) setCuCamera();
    else if (inPlay && !PAGES.has(sc)) setPlayCamera(L, state.cam);
    else setHeroCamera(L, P.clock, calm);
    const fx = inPlay && !CU ? state.cam.cx : 0, fz = inPlay && !CU ? -state.cam.cy : -26;
    const dist = Math.hypot(cam.position.x - fx, cam.position.y, cam.position.z - fz);
    setShadowExtent(clamp(dist * 0.62, 5, 24));
    stage.setShadowTarget(CU ? CU[3] : fx, 0, CU ? CU[5] : fz);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    renderer.clear(true, true, true);
    renderer.render(scene, cam);
    stage.stats.renders++;
  }

  function prepare() {
    const w = Math.max(1, Math.floor(globalThis.innerWidth)), h = Math.max(1, Math.floor(globalThis.innerHeight));
    if (w !== W || h !== H) { W = w; H = h; stage.resize(); }
  }
  function applyTier() {
    const q = ['high', 'medium', 'low'][tier];
    if (stage.setQuality) stage.setQuality(q);
    scene.traverse((o) => { if (o.material) for (const mm of [].concat(o.material)) mm.needsUpdate = true; });
    if (crowd) crowd.setQuality(q === 'high' ? 'high' : q === 'medium' ? 'medium' : 'low');
  }

  stage.onContextLost(() => { P.lost = true; v3.on = false; });
  stage.onContextRestored(() => { P.lost = false; W = 0; v3.on = true; stage.resize(); stage.invalidate(); });
  v3.on = true;

  P.wrap = (game) => Object.assign({}, game, {
    render(ctx, view) {
      const state = game.getState();
      if (!v3.on) { game.render(ctx, view); return; }
      ctx.clearRect(0, 0, 1e5, 1e5);
      game.render(ctx, view);
      if (QS.has('bare')) ctx.clearRect(0, 0, 1e5, 1e5);
      try {
        const now = globalThis.performance.now();
        const wall = lastWall === null ? 0 : clamp((now - lastWall) / 1000, 0, 0.1); lastWall = now;
        let dt = lastT === null ? 0 : state.t - lastT; lastT = state.t; dt = clamp(dt, 0, 0.1);
        if (P.manualDt != null) dt = P.manualDt;
        P.clock += wall;
        ema = ema * 0.95 + wall * 1000 * 0.05; frames++;
        if (frames > 120 && ema > 30 && tier < 2) { tier++; applyTier(); frames = 0; ema = 16; }
        // Software-GL / very slow devices (emulators): a frame that takes a third of a second or more starves the main thread, so the kit
        // misses rotations and the page looks hung. Drop straight to the lowest tier after two such frames instead of waiting for 120.
        if (wall > 0.3 && tier < 2 && ++slowFrames >= 2) { tier = 2; applyTier(); frames = 0; ema = 16; slowFrames = 0; }
        const L = layoutFor(view?.width ?? 720, view?.height ?? 1560);
        prepare();
        stage.setVisible(true);
        present(state, L, dt, wall);
      } catch (e) { console.warn('3D present failed', e); v3.on = false; }
    },
  });
  P.setTier = (t) => { tier = clamp(t, 0, 2); applyTier(); };
  P.makeCrowd = makeCrowd;
  P.crowdRef = () => crowd;
  P.placeBall = placeBall;
  return P;
}
