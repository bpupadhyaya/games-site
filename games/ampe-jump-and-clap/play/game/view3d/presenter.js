// 3D presenter: READS the engine state (game.getState().sim) and draws the playground and the two mannequins. It never writes back.
// Contact discipline: the engine owns every time (beats, take-off, apex, landing); pose.js turns those exact times into poses.
import { Actor } from './actor.js';
import { playerPose, BODY } from './pose.js';
import { buildYard, skyTexture } from './yard.js';

const LIB = '../vendor3d/index.js';
const STEP = 1 / 60;
const KITS = [
  { top: '#f2a900', bottoms: '#1f6f78', socks: '#fff3d6', trim: '#fff3d6', shoes: '#fff3d6' },
  { top: '#1f9d8f', bottoms: '#e4572e', socks: '#fff3d6', trim: '#ffd98a', shoes: '#fff3d6' },
];
const SKINS = ['brown', 'tan'];
const HAIRS = ['black', 'black'];
export const SPOT = [{ x: 0, z: -0.78 }, { x: 0, z: 0.78 }];     // where the two players stand (metres); they face each other
// title screen cut: a steady, wider shot with the players in the middle band (menu text above, buttons below)
export const TITLE_CAM = { x: 5.5, y: 2.5, z: -4.1, lx: 0, ly: -0.12, lz: 0, fov: 46 };
export const CAM = { x: 4.4, y: 2.5, z: -3.2, lx: 0, ly: 0.7, lz: 0, fov: 46 };

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
  const canvas = globalThis.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 3 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  stage.camera.near = 0.3; stage.camera.far = 80; stage.camera.fov = CAM.fov; stage.camera.updateProjectionMatrix();
  stage.setLighting('day', { exposure: 0.95, hemi: 0.95, keyI: 2.4 });
  stage.scene.background = skyTexture();
  stage.scene.fog = null;
  buildYard(stage, { gapZ: Math.abs(SPOT[0].z) });
  const blobs = stage.enableBlobShadows ? stage.enableBlobShadows(4, { radius: 0.5, opacity: 0.9 }) : null;

  const P = { stage, THREE, humans: [], actors: [], ready: false, lost: false, gender: ['m', 'f'], overlay: { feet: [null, null], heads: [null, null] }, idleT: 0, perf: 0 };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; });

  async function build(g0, g1) {
    P.ready = false;
    for (const h of P.humans) stage.remove(h);
    P.humans = []; P.actors = [];
    const gens = [g0, g1];
    for (let i = 0; i < 2; i++) {
      const h = await loadHuman({ character: gens[i] === 'f' ? 'mannequin_f' : 'mannequin_m', kit: KITS[i], skin: SKINS[i], hair: HAIRS[i], legs: 'shorts' });
      h.groundClamp = 'off'; h.footPlanting = false;
      h.play('ready_stance', { fade: 0 });
      if (quality === 'low') h.model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; });
      h.setPosition(SPOT[i].x, 0, SPOT[i].z);
      stage.add(h);
      P.humans.push(h);
      P.actors.push(new Actor(h));
    }
    P.gender = gens;
    P.ready = true;
    stage.invalidate();
  }
  P.build = build;
  P.ready_p = build('m', 'f');

  // adaptive quality: if frames run long, drop shadows, then the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick(now) {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false; else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }

  let lastSimT = null, updAt = 0, lastNow = 0, building = false, pillar = -1, camKey = '';
  const idleSeed = [0.6, 2.9];
  const proj = V();
  function project(v) {
    proj.copy(v).project(stage.camera);
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280;
    const px = (proj.x * 0.5 + 0.5) * W, py = (-proj.y * 0.5 + 0.5) * H;
    const cw = kitCanvas.clientWidth || W, ch = kitCanvas.clientHeight || H;
    const sc = Math.min(cw / 720, ch / 1280), ox = (cw - 720 * sc) / 2, oy = (ch - 1280 * sc) / 2;
    const offX = canvas.offsetLeft || 0;
    return { x: (px + offX - ox) / sc, y: (py - oy) / sc };
  }

  function frame(game, view, nowOverride) {
    if (!P.ready || P.lost) return;
    const G = game.getState();
    const s = G.sim;
    if (!s) { stage.setVisible(false); return; }
    const want = G.look || { hero: 'm' };
    const g0 = want.hero === 'f' ? 'f' : 'm', g1 = g0 === 'm' ? 'f' : 'm';
    if ((g0 !== P.gender[0]) && !building) { building = true; build(g0, g1).finally(() => { building = false; }); return; }
    stage.setVisible(true);
    const dim = G.scene === 'play' || G.scene === 'result' || G.scene === 'title' ? '' : 'brightness(0.62) saturate(0.9)';
    const now = nowOverride ?? globalThis.performance.now();
    const realDt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
    P.idleT += realDt;
    if (lastSimT === null || s.t !== lastSimT) { lastSimT = s.t; updAt = now; }
    const adv = (now - updAt) < 45;
    const alpha = adv ? Math.min(1, (now - updAt) / (STEP * 1000)) : 0;
    const tD = P.fixedT !== undefined ? P.fixedT : s.t + alpha * STEP;
    P.tD = tD;
    // ---- the two players
    const heads = P.humans.map((h) => h.bonePosition('Head'));
    const out = [];
    for (let i = 0; i < 2; i++) {
      const h = P.humans[i], a = P.actors[i];
      const yaw = i === 0 ? 0 : Math.PI;
      h.setPosition(SPOT[i].x, 0, SPOT[i].z); h.setFacing(yaw);
      h.update(realDt);
      const pose = playerPose({ s, t: tD, i, actor: a, base: SPOT[i], yaw, idle: { phase: idleSeed[i] + (G.vseed || 0) * 0.37, t: P.idleT }, oppHead: heads[1 - i].clone() });
      a.apply(pose, realDt);
      h.setFingers('L', 'flat'); h.setFingers('R', 'flat');
      out.push(pose.out);
    }
    P.out = out;
    // ---- shadows (blob under each player, shrinking while airborne)
    if (blobs) { for (let i = 0; i < 2; i++) { const dy = Math.max(0, out[i].dy); blobs.set(i, SPOT[i].x, SPOT[i].z, 0.5 - dy * 0.35, 0.012); } blobs.mesh.count = 2; }
    // ---- camera (fixed) with a wider vertical field on tall phones so the horizontal framing stays the same
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== pillar) {
      pillar = wantW;
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0` : 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
      P.dim = undefined; stage.resize();
    }
    if (dim !== P.dim) { P.dim = dim; canvas.style.filter = dim; }
    const W = canvas.clientWidth || 720, H_ = canvas.clientHeight || 1280;
    const th = Math.tan((CAM.fov * Math.PI) / 360) * Math.max(1, 0.5625 / Math.max(0.2, W / H_));
    const fov = (2 * Math.atan(th) * 180) / Math.PI;
    const cam = stage.camera, co = P.camOverride || (G.scene === 'title' ? TITLE_CAM : CAM);
    const key = `${fov.toFixed(3)}:${co.x},${co.y},${co.z},${co.lx},${co.ly},${co.lz}`;
    if (key !== camKey) {
      camKey = key;
      cam.fov = P.camOverride && P.camOverride.fov ? P.camOverride.fov : fov;
      cam.position.set(co.x, co.y, co.z); cam.lookAt(co.lx, co.ly, co.lz); cam.updateProjectionMatrix();
    }
    stage.setShadowTarget(0, 0, 0);
    // ---- overlay anchors for the HUD (screen positions of the feet and heads), computed from this frame's pose
    cam.updateMatrixWorld(true);
    const feetNow = [];
    for (let i = 0; i < 2; i++) feetNow.push([project(P.humans[i].bonePosition('L_Foot')), project(P.humans[i].bonePosition('R_Foot'))]);
    P.overlay.feet = feetNow;
    P.overlay.heads = P.humans.map((h) => project(h.bonePosition('Head').add(V(0, 0.22, 0))));
    if (!P.noRender) { stage.render(); perfTick(now); }
  }
  P.frame = frame;

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      frame(game, view);
      view.overlay = P.overlay;
      r(ctx, view);
    };
    return game;
  };
  P.BODY = BODY;
  return P;
}
