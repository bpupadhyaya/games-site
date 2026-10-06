// 3D presenter: READS the simulation (game.getState()) and draws the pitch, the ball and twelve stylised players with hurleys. It never writes back.
// Everything is shown at the interpolated display time (between two fixed 60 Hz simulation steps) so motion is smooth at 60 / 120 Hz:
// the sim owns where and when each contact happens; the clip layer makes the bas meet the ball at exactly that time.
import { buildPitch, buildBall, hurleyGeometry, helmetCapGeometry, helmetGuardGeometry, BALL_VIS_R } from './pitch.js';
import { createAnimator, DT, HELMET_COL, GK_HELMET_COL } from './animator.js';
import { camFor } from '../src/camera.js';

const LIB = '../vendor3d/index.js';

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, loadHuman, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.5; stage.camera.far = 260; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, humans: [], hurleys: [], pitch: null, ball: null, ready: false, lost: false, st: [] };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  stage.setLighting('day', { exposure: 0.95, hemi: 1.0, keyI: 2.6 });
  stage.setSky('#8fc6ee', '#bfdcef', { near: 90, far: 230 });
  P.pitch = buildPitch(stage);
  P.ball = buildBall(); stage.add(P.ball);
  stage.enableBlobShadows(16, { radius: 0.6, opacity: 0.9 });
  const blobs = stage.blobs;      // one instanced draw call: a soft disc under every player, and index 12 for the ball (grows and fades with height)

  // ---- hurleys and helmets: one instanced draw call each for all twelve (matrices copied from the bones every frame)
  const stickMesh = new THREE.InstancedMesh(hurleyGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), 12);
  // helmet = cap (tinted per team through the instance colour) + steel face guard (fixed colour) in ONE geometry / ONE draw call: aGuard = 1 on the guard vertices
  // keeps them out of the instance tint.
  const helmetGeo = (() => {
    const A = helmetCapGeometry(), B = helmetGuardGeometry(), pos = [], nor = [], col = [], uv = [], gd = [], idx = [];
    let base = 0;
    for (const [g, v] of [[A, 0], [B, 1]]) {
      for (let i = 0; i < g.attributes.position.count; i++) {
        pos.push(g.attributes.position.getX(i), g.attributes.position.getY(i), g.attributes.position.getZ(i));
        nor.push(g.attributes.normal.getX(i), g.attributes.normal.getY(i), g.attributes.normal.getZ(i));
        col.push(g.attributes.color.getX(i), g.attributes.color.getY(i), g.attributes.color.getZ(i)); uv.push(0, 0); gd.push(v);
      }
      for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
      base += g.attributes.position.count;
    }
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    o.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    o.setAttribute('aGuard', new THREE.Float32BufferAttribute(gd, 1)); o.setIndex(idx);
    return o;
  })();
  const helmetMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.25 });
  helmetMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', 'attribute float aGuard;\n#include <common>')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor.xyz = color.xyz * mix(instanceColor.xyz, vec3(1.0), aGuard);\n#endif');
  };
  const capMesh = new THREE.InstancedMesh(helmetGeo, helmetMat, 12);
  for (const m of [stickMesh, capMesh]) { m.frustumCulled = false; stage.add(m); }
  const mtx = new THREE.Matrix4();
  function syncInstances() {
    for (let i = 0; i < P.humans.length; i++) {
      const h = P.humans[i];
      P.hurleys[i].updateWorldMatrix(true, false);
      stickMesh.setMatrixAt(i, P.hurleys[i].matrixWorld);
      h.bones.Bip01_Head.updateWorldMatrix(true, false);
      mtx.multiplyMatrices(h.bones.Bip01_Head.matrixWorld, anim.helmetM[i]);
      capMesh.setMatrixAt(i, mtx);
    }
    stickMesh.count = capMesh.count = P.humans.length;
    stickMesh.instanceMatrix.needsUpdate = capMesh.instanceMatrix.needsUpdate = true;
  }

  const anim = createAnimator(V3, { lod: quality === 'high' ? 1 : 2, onHuman: (h, i) => {
    stage.add(h); stage.track(h);
    const gk = i % 6 === 0, team = i < 6 ? 0 : 1;
    capMesh.setColorAt(i, new THREE.Color(gk ? GK_HELMET_COL[team] : HELMET_COL[team])); stickMesh.setColorAt(i, new THREE.Color(0xffffff));
  } });
  P.anim = anim;

  // ---- one real (planar, cast-along-the-sun) shadow for the active player: the controlled player, else the ball carrier. The light-LOD skinned
  // geometry is drawn a second time, flattened onto the grass along the sun direction (1 extra draw call, about 1.2k triangles). Min-blending
  // against the grass means overlapping limbs darken the pixel once, not twice.
  const SUN = V(0.32, 0, -0.38);       // ground offset per metre of height (sun is up-left of the camera, shadow falls away to the right)
  const shMat = new THREE.MeshBasicMaterial({ color: 0x357c3d, toneMapped: false, transparent: true, depthWrite: false, blending: 5, blendEquation: 103, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });   // MIN blend: overlapping limbs never darken twice
  shMat.onBeforeCompile = (sh) => {
    sh.uniforms.uSun = { value: SUN };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', 'uniform vec3 uSun;\n#include <common>')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 wp = modelMatrix * vec4(transformed, 1.0); wp.xz += max(wp.y, 0.0) * uSun.xz; wp.y = 0.035; gl_Position = projectionMatrix * viewMatrix * wp; }');
  };
  let shadowMesh = null, shadowOn = -2;
  function setShadow(id) {
    if (id === shadowOn) return;
    shadowOn = id;
    if (id < 0 || !P.humans[id]) { if (shadowMesh) shadowMesh.visible = false; return; }
    const src = P.humans[id].lodSets.light[0];
    if (!shadowMesh) { shadowMesh = new THREE.SkinnedMesh(src.geometry, shMat); shadowMesh.frustumCulled = false; shadowMesh.renderOrder = 2; }
    if (shadowMesh.parent) shadowMesh.parent.remove(shadowMesh);
    src.parent.add(shadowMesh);
    shadowMesh.bind(src.skeleton, src.bindMatrix); shadowMesh.visible = true;
  }
  P.ready_p = anim.build().then(() => { P.humans = anim.humans; P.hurleys = anim.hurleys; P.ready = true; stage.invalidate(); });

  // Pixel budget: the canvas fills the whole screen, so on a big tablet the device pixel ratio is lowered until the drawing buffer is about as large as a
  // phone's (about 1.7 million pixels), which keeps the frame rate where it was on a phone.
  const PIXELS = 1.75e6;
  let sizeKey = '', budgetR = 1;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    // stage.resize() (its own resize observer) resets the ratio to the tier default, so re-assert the budget every frame
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); }
    }
  }

    let lastTp = null;

  // ------------------------------------------------------------------ the frame
  function frame(G, view) {
    if (!P.ready || P.lost) return;
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    stage.setVisible(true);
    const alpha = G.alpha ?? 1, snap = G.snap;
    const Tp = s.t - DT * (1 - alpha);
    let dt = lastTp === null ? 0 : Tp - lastTp;
    if (dt < 0 || dt > 0.25) dt = 0;
    lastTp = Tp;
    dt = Math.min(dt, 0.1);
    const ok = !!(snap && snap.prev && snap.cur);
    const at = (arr, i, fb) => (ok ? snap.prev[arr][i] + (snap.cur[arr][i] - snap.prev[arr][i]) * alpha : fb);
    const bp = (k, fb) => (ok ? snap.prev.b[k] + (snap.cur.b[k] - snap.prev.b[k]) * alpha : fb);
    const ballW = V(-bp(0, s.ball.x), Math.max(bp(1, s.ball.y), BALL_VIS_R), bp(2, s.ball.z));
    anim.step(s, Tp, dt, at, ballW);
    setShadow(s.cfg.human >= 0 ? s.cfg.human : s.ball.holder);
    // --- ball
    const bm = P.ball;
    bm.position.copy(ballW);
    if (dt > 0) { bm.rotation.x += (s.ball.vz * dt) / BALL_VIS_R * 0.5; bm.rotation.z += (s.ball.vx * dt) / BALL_VIS_R * 0.5; }
    const hh = Math.max(0, ballW.y - BALL_VIS_R);
    // --- camera: a function of the screen shape only (portrait: behind the near end line; landscape: side-on). The canvas always fills the whole screen,
    // so the aspect comes from the live canvas box and the HUD (which projects through the same camera) always matches the picture.
    const cam = stage.camera;
    const W = canvas.clientWidth || 720, H_ = canvas.clientHeight || 1280;
    sizeBudget(W, H_);
    const c = camFor(W / H_);
    if (Math.abs(cam.fov - c.fov) > 1e-3 || Math.abs(cam.aspect - W / H_) > 1e-4) { cam.fov = c.fov; cam.aspect = W / H_; cam.updateProjectionMatrix(); }
    const co = P.camOverride;
    if (co) { cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz); if (co.fov && cam.fov !== co.fov) { cam.fov = co.fov; cam.updateProjectionMatrix(); } }
    else { cam.position.set(-c.x, c.y, c.z); cam.lookAt(-c.lx, c.ly, c.lz); }
    if (P.lastCam !== c) { P.lastCam = c; P.camChanges = (P.camChanges || 0) + 1; }
    stage.update(dt, { renderNow: false }); anim.post(s, Tp); anim.fix(s, Tp, ballW); syncInstances(); blobs.set(12, ballW.x, ballW.z, BALL_VIS_R * (1.5 + hh * 0.25), 0.014); blobs.mesh.count = 13; if (!P.noRender) { stage.render(); perfTick(); }
  }
  P.frame = frame;
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      const cv = kitCanvas;
      view.cssW = cv.clientWidth || 720; view.cssH = cv.clientHeight || 1280;
      r(ctx, view);
      frame(game.getState(), view);
    };
    return game;
  };
  return P;
}
