// Conkers 3D presenter. READS the game state (game.getState()) and the duel the 2D layer recorded this frame (v3.job), never writes
// either. One WebGL canvas sits behind the kit's transparent 2D canvas: a golden-hour park through a long lens, two knitted mittens,
// the strings and two glossy conkers. The camera looks straight at the duel plane (z = 0) and is fitted so that plane maps onto the
// kit canvas EXACTLY like the 2D camera (pixels per metre, origin, mirror): the 2D aim arc, angle label, rings and taps line up.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { R, PD, bobPos } from '../src/sim.js';
import { makeConker, makeString, setString, makeMitten, buildPark, buildLights, radialTex } from './world.js';

const T = THREE, TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 1024 }, { name: 'medium', dpr: 1.5, shadow: 512 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
export const HAND_Y = 1.39;      // height of the hands above the lawn (m): an adult holding a conker out at chest height
const FOV = 26;
const CAM_Y = 0.62;     // lens height above the lawn (m)

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new T.Scene();
  scene.background = new T.Color(0x3a2612);
  scene.fog = new T.Fog(0xd6ad6c, 7, 30);
  const camera = new T.PerspectiveCamera(FOV, 1, 0.05, 200);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.55; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const park = buildPark(scene, { quality: TIERS[tier].name });
  await tick();
  // the two conkers (textures per seed), their strings, holes and knots
  const conkers = [makeConker(3), makeConker(7)];
  for (const c of conkers) { c.mesh.scale.setScalar(R); scene.add(c.mesh, c.hole, c.knot); c.hole.scale.setScalar(R); c.knot.scale.setScalar(R * 0.55); }
  await tick();
  const strings = [makeString(), makeString()]; scene.add(...strings);
  // mittens: the left player in teal wool and a navy coat, the right player in rust wool and an olive waxed jacket
  const mitts = [
    makeMitten({ wool: '#2f7f7c', woolDark: '#14423f', woolLight: '#6cb7ad', sleeve: '#27304a', cuff: '#e9dfc4', seed: 1 }),
    makeMitten({ wool: '#b8572a', woolDark: '#5e2410', woolLight: '#e38a52', sleeve: '#4a4a2a', cuff: '#efe2bc', seed: 2 }),
  ];
  for (const m of mitts) { m.scale.setScalar(1.25); scene.add(m); }
  await tick();
  // chips of shell when a conker breaks, and puffs of dust (from the game's own particle list)
  const chipGeo = new T.SphereGeometry(1, 4, 3); { const p = chipGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.35); chipGeo.computeVertexNormals(); }
  const chipMat = new T.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2, flatShading: true });
  const chips = new T.InstancedMesh(chipGeo, chipMat, 90); chips.count = 0; chips.frustumCulled = false; chips.castShadow = true; scene.add(chips);
  chips.setColorAt(0, new T.Color());
  const dustT = radialTex('230,205,160', 0.8), puffs = Array.from({ length: 24 }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: dustT, transparent: true, depthWrite: false, fog: false })); s.visible = false; scene.add(s); return s; });
  // a soft warm glow behind the striker's conker while it is being aimed
  const glow = new T.Sprite(new T.SpriteMaterial({ map: radialTex('255,214,120', 0.9), transparent: true, depthWrite: false, blending: T.AdditiveBlending, fog: false })); glow.visible = false; scene.add(glow);

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ------------------------------------------------------------------------------------------------ camera fitted to the 2D mapping
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const pxPerCss = () => kitCanvas.width / Math.max(1, kitCanvas.clientWidth || cssW());
  let lastMap = null;
  function placeCamera(map) {
    const W = cssW(), H = cssH(), f = pxPerCss();
    let kc, oxc, oyc;
    if (map) { kc = map.k / f; oxc = map.ox / f; oyc = map.oy / f; lastMap = { kc, oxc, oyc }; }
    else if (lastMap) ({ kc, oxc, oyc } = lastMap);
    else { kc = Math.min(W, H) / 1.25; oxc = W * 0.4; oyc = H * 0.3; }
    const D = H / (kc * 2 * Math.tan((FOV * Math.PI) / 360));
    const Xc = (W / 2 - oxc) / kc, Yc = HAND_Y - (H / 2 - oyc) / kc;
    // the lens sits low (about knee height, looking level): the horizon drops below the conkers so they hang against the trees.
    // Moving the camera parallel to the duel plane and shifting the image by the same amount keeps that plane's mapping exact.
    const Ycam = CAM_Y;
    camera.fov = FOV; camera.aspect = W / H;
    camera.position.set(Xc, Ycam, D); camera.up.set(0, 1, 0); camera.lookAt(Xc, Ycam, 0);
    camera.setViewOffset(W, H, 0, -(Yc - Ycam) * kc, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  }

  // ------------------------------------------------------------------------------------------------ the duel
  const _v = new T.Vector3(), _w = new T.Vector3(), _up = new T.Vector3(), _n = new T.Vector3(), _m = new T.Matrix4(), _x = new T.Vector3(), _y = new T.Vector3(), _z = new T.Vector3(), _e = new T.Euler(), _g = new T.Vector3();
  const to3 = (x, y, m, out) => out.set(m * x, HAND_Y - y, 0);
  const handP = [new T.Vector3(), new T.Vector3()], bob = [new T.Vector3(), new T.Vector3()];
  function placeMitten(mitt, hand, side, lean) {
    // side = -1: the arm comes in from the left of the screen, +1 from the right
    const e = _v.set(side * 0.86, 0.42, 0.28).normalize();               // toward the elbow
    _x.copy(e).negate();                                                    // knuckles point at the other player
    _y.set(0, 1, 0).addScaledVector(_x, -_x.y).normalize();                 // thumb up
    _z.crossVectors(_x, _y);
    _m.makeBasis(_x, _y, _z); mitt.quaternion.setFromRotationMatrix(_m);
    mitt.rotateZ(lean);
    _w.copy(mitt.userData.grip).multiplyScalar(mitt.scale.x).applyQuaternion(mitt.quaternion);
    mitt.position.copy(hand).sub(_w);
  }
  function placeConker(c, pos, hand, theta, dmg, gone) {
    c.mesh.visible = c.hole.visible = c.knot.visible = !gone;
    if (gone) return;
    c.setDamage(dmg);
    _up.subVectors(hand, pos).normalize();
    _n.set(Math.cos(theta) * 0.78, Math.sin(theta) * 0.78, 0.62).normalize();   // the pale patch faces this way (tilted toward the lens)
    _y.copy(_up).addScaledVector(_n, -_up.dot(_n)).normalize(); _z.crossVectors(_n, _y);
    _m.makeBasis(_n, _y, _z); c.mesh.quaternion.setFromRotationMatrix(_m); c.mesh.position.copy(pos);
    c.hole.position.copy(pos).addScaledVector(_up, R * 0.93); c.hole.quaternion.setFromUnitVectors(_v.set(0, 0, 1), _up);
    c.knot.position.copy(pos).addScaledVector(_up, -R * 1.02); c.knot.quaternion.setFromUnitVectors(_v.set(0, 1, 0), _up);
  }
  const gripOf = (mi, out) => out.copy(mitts[mi].userData.grip).multiplyScalar(mitts[mi].scale.x).applyQuaternion(mitts[mi].quaternion).add(mitts[mi].position);
  const col = new T.Color();
  function drawDuel(job, t) {
    const sim = job.sim, m = job.mirror ? -1 : 1, si = job.sSide, di = 1 - si;
    const pd = sim.pd || PD;
    const S = bobPos(sim.ps, sim.S.phi), Dp = bobPos(pd, sim.D.phi);
    to3(sim.ps.x, sim.ps.y, m, handP[0]); to3(pd.x, pd.y, m, handP[1]);
    to3(S.x, S.y, m, bob[0]); to3(Dp.x, Dp.y, m, bob[1]);
    const cS = job.conkers[si], cD = job.conkers[di];
    // each player keeps its own conker texture and mitten colours whichever of them is striking
    const meshS = conkers[si], meshD = conkers[di];
    let thS = -Math.PI / 2 + (cS.psi || 0) + sim.S.phi, thD = -Math.PI / 2 - (cD.psi || 0) + sim.D.phi;
    if (m < 0) { thS = Math.PI - thS; thD = Math.PI - thD; }
    placeConker(meshS, bob[0], handP[0], thS, cS.dmg || 0, !!cS.gone);
    placeConker(meshD, bob[1], handP[1], thD, cD.dmg || 0, !!cD.gone);
    // the defender's hand leans a little with its wobble; the striker's wrist follows through after the release
    const wob = (pd.x - PD.x) * 3;
    placeMitten(mitts[si], handP[0], -m, -0.08 + (sim.released ? 0.12 : 0));
    placeMitten(mitts[di], handP[1], m, wob * m);
    mitts[0].visible = mitts[1].visible = true;
    // strings: from the fist to the hole in the top of the conker (a broken conker leaves the string end dangling)
    const end = (k, c) => (c.gone ? _x.copy(handP[k]).addScaledVector(_v.subVectors(bob[k], handP[k]).normalize(), 0.36) : _x.copy(bob[k]).addScaledVector(_v.subVectors(handP[k], bob[k]).normalize(), R * 0.95));
    setString(strings[0], gripOf(si, _g), end(0, cS));
    setString(strings[1], gripOf(di, _g), end(1, cD));
    strings[0].visible = strings[1].visible = true;
    // hit flash: a warm point light at the meeting point and a little lift in the shells' emissive
    const fl = job.flash || 0;
    if (fl > 0.01) { lights.flash.position.copy(bob[0]).add(bob[1]).multiplyScalar(0.5); lights.flash.position.z = 0.15; lights.flash.intensity = fl * 1.2; }
    else lights.flash.intensity = 0;
    for (const c of conkers) c.mat.emissive.setRGB(fl * 0.06, fl * 0.035, fl * 0.012);
    // aim glow behind the striker's conker
    glow.visible = job.glowS > 0 && !cS.gone;
    if (glow.visible) { glow.position.copy(bob[0]).setZ(-0.05); glow.scale.setScalar(R * 5.5); glow.material.opacity = 0.3 + 0.08 * Math.sin(t * 4); }
    // particles from the game's own list (chips of shell in 3D; sparks and rings stay in the 2D layer)
    let n = 0, pi = 0;
    for (const p of job.parts || []) {
      if (p.k === 'chip' && n < 90) {
        const a = clamp(1 - p.t / p.max, 0, 1), s = p.size * (0.4 + 0.6 * Math.min(1, a * 2)) * 0.8;
        _e.set(p.rot + p.vr * p.t, (n * 1.7) % TAU, p.rot * 0.7 + p.vr * p.t * 0.6); _m.makeRotationFromEuler(_e); _m.scale(_v.set(s * 1.1, s, s * 0.9));
        _m.setPosition(m * p.x, HAND_Y - p.y, ((n * 37) % 11 - 5) * 0.012);
        chips.setMatrixAt(n, _m); chips.setColorAt(n, col.set(p.col || '#6a2a0e')); n++;
      } else if (p.k === 'dust' && pi < puffs.length) {
        const s = puffs[pi++], a = clamp(1 - p.t / p.max, 0, 1);
        s.visible = true; s.position.set(m * p.x, HAND_Y - p.y, 0.02); s.scale.setScalar(p.size * (1 + p.t * 1.4) * 2); s.material.opacity = a * 0.5;
      }
    }
    chips.count = n; chips.instanceMatrix.needsUpdate = true; if (chips.instanceColor) chips.instanceColor.needsUpdate = true;
    for (; pi < puffs.length; pi++) puffs[pi].visible = false;
  }
  function hideDuel() {
    for (const c of conkers) c.mesh.visible = c.hole.visible = c.knot.visible = false;
    for (const mm of mitts) mm.visible = false;
    strings[0].visible = strings[1].visible = false; chips.count = 0; glow.visible = false; lights.flash.intensity = 0;
    for (const s of puffs) s.visible = false;
  }

  // ------------------------------------------------------------------------------------------------ per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function pre() { v3.job = null; }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const state = game.getState(), t = state.t || 0, job = v3.job;
    placeCamera(job);
    if (job) drawDuel(job, t); else hideDuel();
    lights.key.target.position.set(camera.position.x, HAND_Y - 0.4, 0); lights.key.position.set(camera.position.x - 2.2, HAND_Y + 1.6, 3.2);
    lights.rim.target.position.set(camera.position.x, HAND_Y - 0.4, 0);
    park.update(t, camera);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; });

  await tick();
  hideDuel(); placeCamera(null);
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, conkers, mitts,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}
