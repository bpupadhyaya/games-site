// 3D presenter: READS the simulation (game.getState()) and draws the pitch, the ball and twelve stylised players with hurleys. It never writes back.
// Everything is shown at the interpolated display time (between two fixed 60 Hz simulation steps) so motion is smooth at 60 / 120 Hz:
// the sim owns where and when each contact happens; the clip layer makes the bas meet the ball at exactly that time.
import { buildPitch, buildBall, hurleyGeometry, helmetCapGeometry, helmetGuardGeometry, BALL_VIS_R } from './pitch.js';
import { createAnimator, DT, HELMET_COL, GK_HELMET_COL } from './animator.js';
import { fovFor } from '../src/camera.js';

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
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.5; stage.camera.far = 260; stage.camera.updateProjectionMatrix();
  const P = { stage, THREE, humans: [], hurleys: [], pitch: null, ball: null, ready: false, lost: false, st: [] };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });
  stage.setLighting('day', { exposure: 0.95, hemi: 1.0, keyI: 2.6 });
  stage.setSky('#8fc6ee', '#bfdcef', { near: 90, far: 230 });
  P.pitch = buildPitch(stage);
  P.ball = buildBall(); stage.add(P.ball);
  stage.enableBlobShadows(16, { radius: 0.6, opacity: 0.9 });
  const blobs = stage.blobs;      // one instanced draw call: a soft disc under every player, and index 12 for the ball (grows and fades with height)

  // ---- hurleys and helmets: one instanced draw call each for all twelve (matrices copied from the bones every frame)
  const stickMesh = new THREE.InstancedMesh(hurleyGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), 12);
  const capMesh = new THREE.InstancedMesh(helmetCapGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }), 12);
  const guardMesh = new THREE.InstancedMesh(helmetGuardGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.5 }), 12);
  for (const m of [stickMesh, capMesh, guardMesh]) { m.frustumCulled = false; stage.add(m); }
  const mtx = new THREE.Matrix4();
  function syncInstances() {
    for (let i = 0; i < P.humans.length; i++) {
      const h = P.humans[i];
      P.hurleys[i].updateWorldMatrix(true, false);
      stickMesh.setMatrixAt(i, P.hurleys[i].matrixWorld);
      h.bones.Bip01_Head.updateWorldMatrix(true, false);
      mtx.multiplyMatrices(h.bones.Bip01_Head.matrixWorld, anim.helmetM[i]);
      capMesh.setMatrixAt(i, mtx); guardMesh.setMatrixAt(i, mtx);
    }
    stickMesh.count = capMesh.count = guardMesh.count = P.humans.length;
    stickMesh.instanceMatrix.needsUpdate = capMesh.instanceMatrix.needsUpdate = guardMesh.instanceMatrix.needsUpdate = true;
  }

  const anim = createAnimator(V3, { lod: quality === 'high' ? 1 : 2, onHuman: (h, i) => {
    stage.add(h); stage.track(h);
    const gk = i % 6 === 0, team = i < 6 ? 0 : 1;
    capMesh.setColorAt(i, new THREE.Color(gk ? GK_HELMET_COL[team] : HELMET_COL[team])); guardMesh.setColorAt(i, new THREE.Color(0xffffff)); stickMesh.setColorAt(i, new THREE.Color(0xffffff));
  } });
  P.anim = anim;
  P.ready_p = anim.build().then(() => { P.humans = anim.humans; P.hurleys = anim.hurleys; P.ready = true; stage.invalidate(); });

  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 1) { perfLevel++; stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio())); stage.invalidate(); }
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
    // --- ball
    const bm = P.ball;
    bm.position.copy(ballW);
    if (dt > 0) { bm.rotation.x += (s.ball.vz * dt) / BALL_VIS_R * 0.5; bm.rotation.z += (s.ball.vx * dt) / BALL_VIS_R * 0.5; }
    const hh = Math.max(0, ballW.y - BALL_VIS_R);
    // --- camera: the fixed broadcast position from the sim (pillarboxed on screens wider than 9:16 so the picture matches the HUD)
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== P.pillar) {
      P.pillar = wantW;
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      stage.resize();
    }
    const cam = stage.camera, c = s.cam;
    const W = canvas.clientWidth || 720, H_ = canvas.clientHeight || 1280;
    const fov = fovFor(W / H_, c.fov);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const co = P.camOverride;
    if (co) { cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz); if (co.fov && cam.fov !== co.fov) { cam.fov = co.fov; cam.updateProjectionMatrix(); } }
    else { cam.position.set(-c.x, c.y, c.z); cam.lookAt(-c.lx, c.ly, c.lz); }
    stage.update(dt, { renderNow: false }); anim.fix(s, Tp, ballW); syncInstances(); blobs.set(12, ballW.x, ballW.z, BALL_VIS_R * (1.5 + hh * 0.25), 0.014); blobs.mesh.count = 13; if (!P.noRender) { stage.render(); perfTick(); }
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
