// Menko scene extras (game-owned): the child's hand that holds and slams the discs, and the neighbourhood kids kneeling on the veranda
// who watch (crowd3d). Everything here only READS the sim state through the presenter; failures degrade to "no hand / no kids".
import * as V3D from '../vendor3d/index.js';
import { createHand } from './hand3d.js';
import { FLOOR, R as DISC_R } from '../src/sim.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (f) => f * f * (3 - 2 * f);

export async function createSceneExtras({ THREE, renderer, scene, camera, worldRoot, tier, U }) {
  const T = THREE;
  const out = { hand: null, crowd: null, setQuality: null, frame() {} };
  const wx = (fx) => (fx - FLOOR / 2) * U, wz = (fy) => (fy - FLOOR / 2) * U;

  // ---------------------------------------------------------------- the hand
  let hand = null, handGroup = null, cuff = null;
  const HS = 9.4;                                  // an adult hand is ~18.5 cm; scaled so it reads as a child's hand ~2 discs long
  try {
    hand = await createHand(V3D, { side: 'R', skin: 'light', character: 'athlete_f', preset: 'pinch', base: new URL('../assets3d/', import.meta.url).href });
    handGroup = new T.Group(); handGroup.add(hand.object); hand.object.scale.setScalar(HS); worldRoot.add(handGroup);
    handGroup.visible = false;
    hand.human.groundClamp = 'off'; hand.human.footPlanting = false;
    // the arm is cut a short way behind the wrist (a kimono sleeve covers the cut): clip the skinned arm
    const clipPlane = new T.Plane(new T.Vector3(0, 0, 1), 0);
    hand.clips = [clipPlane, new T.Plane(), new T.Plane(), new T.Plane()];
    hand.object.traverse((o) => { if (o.isMesh && o.material) { for (const m of [].concat(o.material)) { m.clippingPlanes = hand.clips; m.clipShadows = true; } } });
    renderer.localClippingEnabled = true;
    hand.clip = clipPlane;
  } catch (e) { console.warn('hand3d unavailable', e); hand = null; }

  let sleeve = null;
  if (hand) {
    sleeve = new T.Mesh(new T.CylinderGeometry(0.5, 0.64, 1.6, 24, 1, true), new T.MeshStandardMaterial({ color: '#9c2f20', roughness: 0.9, side: T.DoubleSide }));
    sleeve.geometry.rotateX(Math.PI / 2); sleeve.castShadow = true; worldRoot.add(sleeve);
  }
  // ---------------------------------------------------------------- kids
  let crowd = null, crowdGroup = null, crowdCam = null;
  const KS = 2.3;                                  // crowd works in metres; the diorama is ~15x life size, the kids are drawn about 5x
  try {
    crowdGroup = new T.Group(); crowdGroup.scale.setScalar(KS); crowdGroup.position.set(0, -0.22, 0);
    scene.add(crowdGroup);
    crowdCam = new T.PerspectiveCamera();
    const pts = [];
    const spots = [[-4.6, -5.3, 0.15], [-1.5, -5.9, -0.1], [1.6, -5.4, 0.12], [4.5, -5.8, -0.15], [-7.6, -3.2, 0.7], [7.8, -3.4, -0.7]];
    for (const [x, z, yaw] of spots) pts.push({ x: x / KS, y: 0, z: z / KS, yaw, seated: 0 });
    crowd = V3D.createCrowd3d({ scene: crowdGroup, camera: crowdCam, renderer }, {
      points: pts, seed: 11, culture: 'east_asian', kids: 1, quality: tier().kids || 'low', props: { flag: 0, phone: 0, child: 0 }, excitement: 0.35, camera: crowdCam, viewportHeight: 800, blobShadows: true,
    });
  } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; if (crowdGroup) scene.remove(crowdGroup); crowdGroup = null; }
  out.setQuality = (q) => { if (crowd) { if (q) { crowd.setQuality(q); crowdGroup.visible = true; } else crowdGroup.visible = false; } };

  // ---------------------------------------------------------------- per frame
  const hp = new T.Vector3(0, 3, 4), hv = new T.Vector3(), fingers = new T.Vector3(), elbow = new T.Vector3(), wrist = new T.Vector3();
  let heldFor = 0, lastSide = 0, shown = 0, lastPose = '';
  let slapT = 99;
  out.frame = (c) => {
    const { state, dt, clock, play, camera: cam } = c;
    if (crowd) {
      crowdCam.position.copy(cam.position).sub(crowdGroup.position).divideScalar(KS);
      crowdCam.quaternion.copy(cam.quaternion); crowdCam.fov = cam.fov; crowdCam.aspect = cam.aspect; crowdCam.near = cam.near / KS; crowdCam.far = cam.far / KS;
      crowdCam.projectionMatrix.copy(cam.projectionMatrix); crowdCam.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      crowdCam.updateMatrixWorld(true);
      crowd.update(dt, crowdCam);
      if (c.shake) crowd.react?.('gasp', { intensity: 0.5 });
    }
    if (!hand) return;
    // what is the hand doing?
    let tgt = null;                                  // { x, y (floor units), h (world height of the wrist), side, pose, snap }
    const holder = c.holder;
    if (play && state.m) {
      const m = state.m, a = state.act, side = a ? a.side : m.turn;
      if (holder) tgt = { x: holder.x, y: holder.y, h: holder.h, side: holder.side, pose: 'pinch', snap: true, held: holder.held };
      else if (a && a.out) {                         // after the release: the hand springs up and away
        const k = state.act.t - a.impactAt;
        const lp = a.out.land || a.out.card;
        tgt = { x: lp.x, y: lp.y + (a.side === 0 ? 70 : -70), h: 0.5 + clamp(k / 0.5, 0, 1) * 3.2, side: a.side, pose: 'open' };
        if (k > 0.6) tgt = null;
      } else if (c.aim || (state.think && state.think.phase === 'aim')) {
        const dir = side === 0 ? 1 : -1;
        tgt = { x: state.aim.x, y: state.aim.y + dir * 70, h: 1.9 + Math.sin(clock * 2.2) * 0.04, side, pose: 'pinch', held: true };
      }
    } else if (state.att && state.att.act) {
      // title / menus: a hand slaps the floor beside a card, the card jumps
      const k = state.att.act.t, cd = state.att.act.c;
      tgt = { x: cd.x - 70, y: cd.y + 20, h: k < 0.18 ? 2.4 * (1 - k / 0.18) + 0.25 : 0.25 + clamp((k - 0.22) / 0.4, 0, 1) * 2.8, side: 0, pose: 'flat', snap: true };
      if (k > 0.62) tgt = null;
    }
    if (!tgt) { shown = Math.max(0, shown - dt * 5); if (shown <= 0.001) { handGroup.visible = false; sleeve.visible = false; return; } tgt = { ...lastTgt }; }
    else { shown = Math.min(1, shown + dt * 10); lastTgt = tgt; }
    handGroup.visible = true;
    const dir = tgt.side === 0 ? 1 : -1;
    // damped follow unless we are riding the thrown disc
    const wxp = wx(tgt.x), wzp = wz(tgt.y), k = tgt.snap ? 1 : 1 - Math.exp(-dt * 12);
    // the wrist sits behind the disc (toward the player's edge) and a little above it
    const tx = wxp, tz = wzp + dir * 1.15, ty = tgt.h + 0.55;
    hp.x += (tx - hp.x) * k; hp.y += (ty - hp.y) * k; hp.z += (tz - hp.z) * k;
    if (shown < 1) hp.y += (1 - shown) * 1.5;
    if (tgt.pose !== lastPose) { hand.setPreset(tgt.pose === 'open' ? 'open' : tgt.pose === 'flat' ? 'flat' : 'pinch'); lastPose = tgt.pose; }
    // the athlete body stands behind the wrist (toward the player's edge) so the arm reaches forward; everything behind the cut is clipped away
    const yaw = tgt.side === 0 ? Math.PI : 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const lx = -0.2, ly = 1.02, lz = 0.5;                      // wrist in the character's own frame (m): right hand, hip-high, forward
    handGroup.rotation.y = yaw;
    handGroup.position.set(hp.x - (lx * cy + lz * sy) * HS, hp.y - ly * HS, hp.z - (-lx * sy + lz * cy) * HS);
    fingers.set(0, -0.12, -dir).normalize();
    elbow.set(tgt.side === 0 ? 3 : -3, 3.5, dir * 6).add(hp);
    wrist.copy(hp);
    handGroup.updateMatrixWorld(true);
    hand.place({ wrist, palmDown: true, fingers, elbowHint: elbow });
    hand.update(dt, 5);
    sleeve.visible = true; sleeve.position.set(hp.x, hp.y + 0.1, hp.z + dir * 1.55); sleeve.material.color.set(tgt.side === 0 ? '#9c2f20' : '#27468f');
    hand.clips[0].setFromNormalAndCoplanarPoint(new T.Vector3(0, 0, -dir), new T.Vector3(hp.x, hp.y, hp.z + dir * 1.5));
    hand.clips[1].setFromNormalAndCoplanarPoint(new T.Vector3(0, 1, 0), new T.Vector3(hp.x, hp.y - 2.4, hp.z));
    hand.clips[2].setFromNormalAndCoplanarPoint(new T.Vector3(1, 0, 0), new T.Vector3(hp.x - 3.0, hp.y, hp.z));
    hand.clips[3].setFromNormalAndCoplanarPoint(new T.Vector3(-1, 0, 0), new T.Vector3(hp.x + 3.0, hp.y, hp.z));
    hand.object.traverse((o) => { if (o.isMesh && o.material) for (const m of [].concat(o.material)) if (!m.clippingPlanes) { m.clippingPlanes = hand.clips; m.clipShadows = true; m.needsUpdate = true; } });
    heldFor += dt; lastSide = tgt.side; void lastSide; void heldFor; void slapT; void DISC_R; void TAU; void ease; void cuff;
  };
  let lastTgt = { x: 320, y: 320, h: 3, side: 0, pose: 'pinch' };
  out.hand = hand; out.crowd = crowd;
  return out;
}
