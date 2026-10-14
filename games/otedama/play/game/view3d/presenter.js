// Otedama 3D presenter (game-owned). It ONLY READS what the play screen / title hero hands to hooks.hands (where each hand is, how far it is
// raised, a clap, the bag the performer is looking at) and never writes back to the simulation.
// A seated performer is rendered by the shared view3d layer into an off-screen WebGL canvas that is drawn into the 2D canvas between the
// room and the bags, so bags, rings and the HUD stay in front of her. Her palms hold the bags: each frame the two hands are placed under the
// bags with a palm-and-ball solve (the palm faces up, the fingers cup), the elbows are steered by pole points, the head follows the bag in
// flight. If WebGL2 or the library is missing, or the context is lost, hooks.hands returns false and the 2D hands in art.js are drawn instead.
import { hooks } from '../src/hooks.js';
import { createPerformer, HAND_Y, HAND_Z } from './performer.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FOV = 11;
const ELEV = 17 * Math.PI / 180;            // the camera looks slightly down at the lap: palms and the bags in them read
const BAG_R = 0.05;                          // a bag is a 10 cm pouch
const BAG_M = 0.12;                          // metres a screen bag of size `bag` stands for
const WIN_W = 1.5, WIN_H = 1.9;              // the world window (metres) the off-screen canvas shows, centred on the hands

export async function createPresenter() {
  const off = { ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D hands', e); return off; }
  const { createStage, solvePalmBall, THREE, FINGER_POSES } = V3;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:512px;height:512px;visibility:hidden;pointer-events:none;z-index:-1';
  document.body.appendChild(canvas);
  let stage;
  try { stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'evening', transparent: true, preserveDrawingBuffer: true, shadows: false, fov: FOV }); } catch (e) { canvas.remove(); return off; }
  if (!stage.supported) { canvas.remove(); return off; }
  const camera = stage.camera;

  // lantern light: warm key from the upper right, cool paper-screen rim from the left
  stage.setLighting('evening', { hemiSky: 0xcfd8ff, hemiGround: 0x6a4a30, hemi: 0.9, key: 0xffd9a8, keyI: 2.5, rim: 0x7fa6ff, rimI: 1.3, exposure: 1.05 });
  stage.lights.key.position.set(2.5, 4, 4);
  stage.setSky(null, null);

  let human;
  try { human = await createPerformer(V3, stage); } catch (e) { console.warn('view3d performer failed to load; using the 2D hands', e); stage.dispose(); return off; }

  // ---- world <-> picture ----------------------------------------------------------------------------------------------------------------
  const TGT = new THREE.Vector3(0, HAND_Y + 0.08, HAND_Z);
  const D = (WIN_H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
  camera.fov = FOV; camera.near = 1; camera.far = 40;
  camera.position.set(0, TGT.y + D * Math.sin(ELEV), TGT.z + D * Math.cos(ELEV)); camera.lookAt(TGT); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  const proj = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; };   // fraction of the canvas

  let lost = false, lastT = null, failed = false, size = [0, 0];
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; stage.invalidate(); });

  const sm = { look: null, lift: [null, null], lv: [0, 0], g: [0.55, 0.55], gv: [0, 0], imp: [0, 0], rel: [0, 0], held: [0, 0], prevLift: [0, 0], lean: 0, dip: 0, tf: 0, bagY: [], wander: 0 };
  // finger work: one scalar per hand, 0 = open hand, ~0.74 = the relaxed cup around a bag, 1 = squeezing a caught bag
  const OPEN = FINGER_POSES.open, GRIP = FINGER_POSES.ballGrip;
  const fingerPose = (g) => ({
    curl: OPEN.curl.map((row, f) => row.map((v, k) => v + (GRIP.curl[f][k] - v) * g)),
    spread: OPEN.spread.map((v, f) => v + (GRIP.spread[f] - v) * g),
  });
  const _c = new THREE.Vector3(), _n = new THREE.Vector3(), _f = new THREE.Vector3();

  hooks.hands = (ctx, f) => {
    if (failed || lost || !stage.ok) return false;
    try {
      const tf = ctx.getTransform(), unit = Math.hypot(tf.a, tf.b);          // canvas pixels per virtual unit
      const xl = f.hands[0].x0, xr = f.hands[1].x0, mid = (xl + xr) / 2, sep = xr - xl;
      let upm = f.bag / BAG_M;                                               // virtual units per metre
      const sepW = clamp(sep / upm, 0.3, 0.58); upm = sep / sepW;
      const restY = f.handY - f.bag * 0.34;                                 // where a resting bag's centre is on screen
      const W = WIN_W * upm, H = WIN_H * upm;
      const pw = clamp(Math.round(W * unit), 160, 1100), ph = Math.round(pw * WIN_H / WIN_W);
      if (pw !== size[0] || ph !== size[1]) { size = [pw, ph]; canvas.style.width = `${pw}px`; canvas.style.height = `${ph}px`; stage.setSize(pw, ph); }
      let dt = lastT === null ? 0 : f.t - lastT; lastT = f.t;
      dt = f.paused ? 0 : clamp(dt, 0, 0.1);
      const k = dt > 0 ? 1 - Math.exp(-dt / 0.1) : 1;

      // what each hand is doing, from the bags the play screen hands over (read-only): holding, just released, bag coming down
      const bags = f.bags || [];
      const held = [0, 0], incoming = [9, 9];
      bags.forEach((b, i) => {
        if (b.held === 0 || b.held === 1) held[b.held]++;
        else if (!b.lying) {
          const vy = dt > 0 && sm.bagY[i] !== undefined ? (b.y - sm.bagY[i]) / dt : 0;     // screen y grows downwards: vy > 0 = falling
          for (let h = 0; h < 2; h++) { const d = Math.hypot(b.x - f.hands[h].x0, b.y - (f.handY - f.bag * 0.34)) / f.bag; if (vy > 0 && d < incoming[h]) incoming[h] = d; }
        }
        sm.bagY[i] = b.y;
      });
      for (let h = 0; h < 2; h++) {
        if (dt > 0) {
          if (held[h] > sm.held[h]) sm.imp[h] = 1;                                // a catch: the fingers close round the bag
          else if (held[h] < sm.held[h]) sm.rel[h] = 1;                           // a toss: the fingers spring open
          sm.held[h] = held[h];
          sm.imp[h] *= Math.exp(-dt / 0.14); sm.rel[h] *= Math.exp(-dt / 0.16);
        }
        const rdy = clamp((2.8 - incoming[h]) / 1.4, 0, 1);                          // empty hand opens as the bag comes down
        let tg = held[h] > 0 ? 0.74 : 0.5 - 0.28 * rdy;
        tg += sm.imp[h] * 0.26 - sm.rel[h] * 0.4;
        // critically damped spring: no popping when the target steps, the fingers still move briskly (settles in ~0.12 s)
        if (dt > 0) { const w = 22, n = Math.max(1, Math.ceil(dt / 0.008)), hh = dt / n; for (let i = 0; i < n; i++) { sm.gv[h] += (w * w * (tg - sm.g[h]) - 2 * w * sm.gv[h]) * hh; sm.g[h] += sm.gv[h] * hh; } } else sm.g[h] = tg;
        human.setFingers(h === 0 ? 'R' : 'L', fingerPose(clamp(sm.g[h], 0, 1.05)), { rate: 1000 });
      }
      // trunk: lean towards the hand that is tossing, a small dip as a catch lands (additive layers, weights are smoothed)
      {
        const lv = (f.hands[1].lift - f.hands[0].lift) / (f.bag * 0.5);          // + = her left hand is up
        const kl = dt > 0 ? 1 - Math.exp(-dt / 0.16) : 1;
        sm.lean += (clamp(lv, -1, 1) - sm.lean) * kl;
        const dp = clamp(-(f.hands[0].lift + f.hands[1].lift) / (f.bag * 0.3), 0, 1) + (sm.imp[0] + sm.imp[1]) * 0.25;
        sm.dip += (clamp(dp, 0, 1) - sm.dip) * (dt > 0 ? 1 - Math.exp(-dt / 0.09) : 1);
        const L = human.live;
        if (L) { L.leanL.weight = Math.max(0, sm.lean); L.leanR.weight = Math.max(0, -sm.lean); L.dip.weight = sm.dip; }
      }

      // hands: the screen-left hand is the performer's RIGHT hand (she faces the viewer; +x is her left = screen right)
      for (let h = 0; h < 2; h++) {
        const d = f.hands[h], side = h === 0 ? 'R' : 'L', sg = h === 0 ? -1 : 1;
        const pull = f.pull || 0;                                             // a clap brings the palms together at the middle
        const xs = d.x0 + (mid - d.x0) * pull * 0.93;
        const lift = d.lift - d.press * f.bag * 0.12;   // (smoothed below)
        if (sm.lift[h] === null) { sm.lift[h] = lift; sm.lv[h] = 0; }
        else if (dt > 0) { const w = 34, n = Math.max(1, Math.ceil(dt / 0.006)), hh = dt / n; for (let i = 0; i < n; i++) { sm.lv[h] += (w * w * (lift - sm.lift[h]) - 2 * w * sm.lv[h]) * hh; sm.lift[h] += sm.lv[h] * hh; } }
        _c.set((xs - mid) / upm, HAND_Y + sm.lift[h] / (upm * Math.cos(ELEV)), HAND_Z + pull * 0.04);
        const tilt = clamp(pull * 1.4, 0, 1.4);                               // palms turn inwards to meet
        _n.set(-sg * Math.sin(tilt) * 0.95, Math.cos(tilt) * 0.97 + 0.05, 0.1).normalize();
        const vel = sm.lv[h];   // wrist flick: the fingers tip up as the hand drives a toss
        _f.set(-sg * 0.35, 0.02 + clamp(vel / (f.bag * 9), -0.28, 0.4), 0.94).normalize();
        const s = solvePalmBall(human, side, _c, _n, _f, BAG_R);
        human.setReach(side, s.wrist, { weight: 1, pole: { x: _c.x + sg * 0.09, y: _c.y - 0.08, z: _c.z - 0.3 }, quat: s.quat });
      }
      // head: follows the bag in flight (smoothed); back to a calm forward gaze when nothing is up
      if (f.look) {
        const lx = clamp((f.look.x - mid) / upm, -0.6, 0.6), ly = clamp(HAND_Y + (restY - f.look.y) / (upm * Math.cos(ELEV)), 0.3, 1.8);
        if (!sm.look) sm.look = { x: lx, y: ly }; else { sm.look.x += (lx - sm.look.x) * k * 0.6; sm.look.y += (ly - sm.look.y) * k * 0.6; }
      } else if (sm.look) {
        // nothing in the air: the gaze settles on the hands with a slow drift, not a fixed stare
        sm.wander += dt;
        sm.look.x += (Math.sin(sm.wander * 0.7) * 0.06 - sm.look.x) * k * 0.5; sm.look.y += (HAND_Y + 0.12 + Math.sin(sm.wander * 0.5) * 0.04 - sm.look.y) * k * 0.5;
      }
      if (sm.look) human.lookAt({ x: sm.look.x, y: sm.look.y, z: HAND_Z + 0.2 }, { weight: 0.9, maxYaw: 0.7, maxPitch: 0.6 });

      stage.update(dt, { renderNow: false });
      if (dt > 0 && human.kimono) human.kimono.step(dt);
      stage.render();
      // where the picture goes: a resting bag's centre (world 0, HAND_Y, HAND_Z) lands on (mid, restY)
      const c = proj(0, HAND_Y, HAND_Z);
      ctx.drawImage(canvas, mid - c.x * W, restY - c.y * H, W, H);
      return true;
    } catch (e) { console.warn('view3d performer failed; using the 2D hands', e); failed = true; return false; }
  };
  return { ok: true, stage, human, hooks };
}
