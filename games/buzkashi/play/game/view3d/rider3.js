// One mounted chapandaz in the 3D field: a horse3d horse (planted-foot gaits, strand mane and tail) with a view3d athlete in period costume on it.
// The horse and the seat are the shared modules; this file adds what buzkashi needs on top: the lean down the horse's flank for the scoop, the
// two-handed tug, the sack held against the saddle, shoulder contact with a neighbour, and the whip. Presentation only: everything is driven by the
// state object `st` that the presenter builds each frame from the sim (never written back).
import { loadHorse, loadHuman, semanticRot, THREE } from '../vendor3d/index.js';
import { dressRider, recolour } from './costume.js';

const { Vector3, Quaternion, Euler, Matrix4, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (v) => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
const lerp = (a, b, t) => a + (b - a) * t;
const SKINS = ['#d6a27a', '#c48a60', '#deb088', '#b87f58', '#caa07a', '#c28f66'];
const HAIRS = ['black', 'black', 'brown', 'black', 'black', 'brown'];
const CAPS = ['karakul', 'turban', 'kalpak', 'karakul', 'turban', 'karakul', 'kalpak', 'turban'];

// critically damped follow: x moves to target with natural frequency w (rad/s); v is the state velocity
function spring(o, key, target, w, dt) {
  const k = key, x = o[k] ?? 0, v = o[k + 'V'] ?? 0;
  const e = Math.exp(-w * dt), d = x - target;
  const nx = target + (d + (v + w * d) * dt) * e;
  const nv = (v - w * (v + w * d) * dt) * e;
  o[k] = nx; o[k + 'V'] = nv;
  return nx;
}

export async function createRider3({ base, variant = 0, quality = 'medium', look }) {
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: look.kit, bottoms: '#2a2f45', socks: '#1c120c' }, skin: SKINS[variant % SKINS.length], hair: HAIRS[variant % HAIRS.length] });
  const horse = await loadHorse({ base, coat: look.horse, mane: 'loose', tack: 'centralasian', quality });
  const group = new Group(); group.name = 'rider3';
  group.add(horse.root); group.add(human.root);
  const dress = dressRider(human, { ...look, cap: CAPS[variant % CAPS.length] }, variant);
  horse.attachRider(human, { style: 'centralasian', hat: false });
  horse.setTack('centralasian', { blanket: look.blanket, trim: look.trim2 || look.trim });
  horse.attachRider(human, { style: 'centralasian', hat: false });
  human.setFingers('L', 'relaxed'); human.setFingers('R', 'relaxed');

  // ---- the whip: a short plaited lash that trails behind the free hand
  const whip = new Group();
  const handle = new Mesh(new CylinderGeometry(0.012, 0.014, 0.34, 8), new MeshStandardMaterial({ color: 0x4a2c14, roughness: 0.6 }));
  handle.rotation.x = Math.PI / 2; handle.position.z = 0.05; whip.add(handle);
  const lashM = new MeshStandardMaterial({ color: 0x2b1a0e, roughness: 0.8 });
  const lash = []; let parent = whip;
  for (let i = 0; i < 4; i++) {
    const seg = new Group(); seg.position.z = i === 0 ? -0.12 : -0.14;
    const m = new Mesh(new CylinderGeometry(0.006 - i * 0.001, 0.008 - i * 0.001, 0.15, 6), lashM); m.rotation.x = Math.PI / 2; m.position.z = -0.075; seg.add(m);
    parent.add(seg); parent = seg; lash.push(seg);
  }
  const whipHand = human.bones.Bip01_L_Hand;
  whipHand.add(whip); whip.position.set(0.0, -0.02, 0.0); whip.rotation.set(0.0, 0.0, 0.0);

  // ---- per-frame hooks: the rider's own update sets seat, stirrups and rein hands, then calls human.update: we adjust between
  const mods = { roll: 0, slide: 0, spineFlex: 0, spineSide: 0, twist: 0, reach: null, reachSide: 'R', fingers: 'relaxed', reachW: 0, pole: null };
  const sp = {};                                   // spring state
  const e = new Euler(), qa = new Quaternion(), qb = new Quaternion();
  const baseUpdate = human.update.bind(human);
  const baseWrite = human._writePose.bind(human);
  const fwdW = new Vector3(), tmp = new Vector3(), piv = new Vector3(), qroll = new Quaternion();
  human._writePose = (pose, rest) => {
    baseWrite(pose, rest);
    if (rest) return;
    const o = mods.offs;
    if (!o) return;
    for (const n in o) {
      const bone = human.bones[`Bip01_${n}`]; if (!bone) continue;
      const r = semanticRot(`Bip01_${n}`, o[n]);
      qb.setFromEuler(e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      bone.quaternion.multiply(qb);
    }
  };
  human.update = (dt) => {
    // 1. torso hanging off the near side: the whole man swings about the saddle (the feet stay in the stirrups by IK)
    if (Math.abs(mods.roll) > 1e-3 || Math.abs(mods.slide) > 1e-3) {
      horse.root.updateMatrixWorld(true);
      fwdW.set(0, 0, 1).transformDirection(horse.root.matrixWorld);
      qroll.setFromAxisAngle(fwdW, mods.roll);
      piv.copy(human.root.position);
      const seat = horse.tack ? horse.tack.saddle.getWorldPosition(tmp) : piv;
      human.root.position.sub(seat).applyQuaternion(qroll).add(seat);
      tmp.set(1, 0, 0).transformDirection(horse.root.matrixWorld);
      human.root.position.addScaledVector(tmp, mods.slide);
      human.root.quaternion.premultiply(qroll);
      human.root.updateMatrixWorld(true);
    }
    // 2. the working hand
    if (mods.reach && mods.reachW > 0.001) {
      human.setReach(mods.reachSide, mods.reach, { weight: mods.reachW, pole: mods.pole || null });
      human.setFingers(mods.reachSide, mods.fingers);
    }
    return baseUpdate(dt);
  };

  const api = {
    group, horse, human, dress, mods, sp, look, variant,
    setLook(l) {
      const key = [l.kit, l.trim, l.accent, l.dark, l.horse, l.blanket].join('|');
      if (api._lookKey === key) return;
      api._lookKey = key;
      human.setKit({ top: l.kit });
      recolour(dress, l);
      horse.setCoat({ coat: l.horse, blaze: variant % 2 === 0 ? 'blaze' : undefined, socks: variant % 3 === 1 ? { LF: 0.25, RH: 0.2 } : undefined });
      horse.setTack('centralasian', { blanket: l.blanket, trim: l.trim2 || l.trim });
      horse.attachRider(human, { style: 'centralasian', hat: false });
    },
    setQuality(q) { horse.setQuality(q); },
    // world position of a hand (for the sack)
    hand(side, out) { return human.handPosition(side, out); },
    /** cloth, whip and head dress secondary motion; speed m/s, yawRate rad/s (+ left), t seconds */
    cloth(dt, speed, yawRate, t) {
      const wind = clamp(speed / 9, 0, 1);
      for (const p of dress.halves) {
        // each half lifts away from the leg with speed, trails back, and swings with a turn
        const lift = 0.04 + wind * 0.32 + Math.sin(t * 9 + p.side * 2) * 0.05 * wind;
        p.pivot.rotation.set(-wind * 0.22 + Math.sin(t * 7 + p.side) * 0.04 * wind, 0, -p.side * lift - yawRate * 0.04 * p.side);
      }
      if (dress.sashTail) { dress.sashTail.rotation.x = 0.1 - wind * 0.9 + Math.sin(t * 10) * 0.12 * wind; }
      if (dress.turbanTail) { dress.turbanTail.rotation.x = 0.15 - wind * 0.7 + Math.sin(t * 8) * 0.1 * wind; }
      // whip lash: a chain that lags behind the hand
      lash.forEach((s, i) => { s.rotation.x = -0.12 - wind * 0.25 + Math.sin(t * 12 - i * 0.9) * 0.18 * wind; s.rotation.y = Math.sin(t * 9 - i) * 0.12 * wind; });
    },
  };
  api.setLook(look);
  return api;
}
export { spring, sm, lerp, clamp };
