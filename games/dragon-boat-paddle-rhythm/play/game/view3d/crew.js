// The people in a dragon boat: 20 paddlers (two per thwart), the drummer facing aft and the steerer at the stern, as real
// athlete models on the view3d rig. The paddling cycle is an authored clip (seated, torso lean and twist, arms by IK on the
// paddle) driven by the SIMULATION'S stroke phase, so the picture always agrees with the drum and the sync meter.
import { THREE, loadHuman, buildClip } from '../vendor3d/index.js';
import { ROWS, rowZ, SEAT_Y, FLOOR_Y, makePaddleSet } from './boat.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (t) => t * t * (3 - 2 * t);
export const CYCLE = 1.0;           // clip seconds per stroke cycle (phase 0..1 maps to it)
const SEAT_DX = 0.27;

// Paddle blade tip and hands (character space, metres; +X = the avatar's left, +Z forward) through a stroke u in [0,1):
// u = 0 catch (blade enters), 0 .. 0.5 drive, ~0.5 exit, 0.5 .. 1 recovery.
export function paddleAt(u, side) {
  const L = 1.5;
  let bz, by;
  if (u < 0.5) { const s = u / 0.5; bz = lerp(0.98, -0.22, s * (2 - s) * 0.35 + s * 0.65); by = -0.22 + 0.04 * Math.sin(Math.PI * s); }
  else { const s = (u - 0.5) / 0.5, e = sm(s); bz = lerp(-0.22, 0.98, e); by = -0.22 + 0.95 * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.05)), 0.8); }
  const bx = side * 0.6;
  const topX = side * 0.16, topZ = bz * 0.42 + 0.28;
  const dx = topX - bx, dz = topZ - bz;
  const topY = by + Math.sqrt(Math.max(L * L - dx * dx - dz * dz, 0.3));
  const k = 0.52;
  return { tip: [bx, by, bz], top: [topX, topY, topZ], low: [lerp(bx, topX, k), lerp(by, topY, k), lerp(bz, topZ, k)] };
}
// Torso for the same stroke: lean forward at the catch, rock back through the drive, upright at the exit, coil in the recovery.
const torsoAt = (u) => {
  const c = Math.cos(u * Math.PI * 2), s = Math.sin(u * Math.PI * 2);
  return { flex: 14 + 18 * (0.5 + 0.5 * c) * (u < 0.5 ? 1 : 1) - 6 * Math.max(0, s) , twist: 15 + 8 * c, side: 5 * (0.5 + 0.5 * c) };
};

const SKINS = ['tan', 'brown', 'light', 'tan', 'deep', 'brown'];
const HAIRS = ['black', 'black', 'brown', 'black', 'black', 'grey'];

function paddlerClip(h, side) {
  const N = 14, keys = [], ikTop = [], ikLow = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N, t = u * CYCLE, tor = torsoAt(u % 1), p = paddleAt(u % 1, side);
    keys.push({
      t, ease: 'inOut',
      pose: {
        Pelvis: { pos: [0, -0.5, -0.04] },
        Spine1: { flex: tor.flex, twist: side * tor.twist, side: side * -tor.side },
        Neck: { flex: -tor.flex * 0.35, twist: -side * tor.twist * 0.4 },
        Head: { flex: -tor.flex * 0.25 },
        L_Thigh: { flex: 88, abduct: 5 }, R_Thigh: { flex: 88, abduct: 5 }, L_Calf: { flex: 94 }, R_Calf: { flex: 94 },
        L_Foot: { rot: [0, 0, -10] }, R_Foot: { rot: [0, 0, -10] },
      },
    });
    ikTop.push({ t, pos: p.top, ease: 'inOut' }); ikLow.push({ t, pos: p.low, ease: 'inOut' });
  }
  // the hand opposite the paddling side holds the T-grip on top
  const topHand = side > 0 ? 'R_Hand' : 'L_Hand', lowHand = side > 0 ? 'L_Hand' : 'R_Hand';
  return buildClip(h, { name: 'paddle' + (side > 0 ? 'L' : 'R'), duration: CYCLE, base: { clip: 'idle', time: 0 }, keys, loop: true, grounded: false, ik: { [topHand]: ikTop, [lowHand]: ikLow }, fingers: 'batGrip' });
}
function drummerClips(h) {
  const base = { clip: 'idle', time: 0 };
  const seat = { Pelvis: { pos: [0, -0.5, 0] }, L_Thigh: { flex: 88, abduct: 6 }, R_Thigh: { flex: 88, abduct: 6 }, L_Calf: { flex: 94 }, R_Calf: { flex: 94 }, Spine1: { flex: 8 }, L_Foot: { rot: [0, 0, -10] }, R_Foot: { rot: [0, 0, -10] } };
  const out = {};
  for (const hand of ['L', 'R']) {
    const sx = hand === 'L' ? 1 : -1, other = hand === 'L' ? 'R' : 'L';
    const rest = (s) => [s * 0.2, 1.3, 0.62], hit = (s) => [s * 0.2, 1.17, 0.88], up = (s) => [s * 0.2, 1.62, 0.7];
    out[hand] = buildClip(h, {
      name: 'drum' + hand, duration: 0.7, base, grounded: false, fingers: 'fist', events: { hit: 0.2 },
      keys: [{ t: 0, pose: seat }, { t: 0.2, pose: { ...seat, Spine1: { flex: 14, twist: -sx * 5 } }, ease: 'in' }, { t: 0.7, pose: seat, ease: 'out' }],
      ik: {
        [hand + '_Hand']: [{ t: 0, pos: up(sx) }, { t: 0.2, pos: hit(sx), ease: 'in' }, { t: 0.42, pos: [sx * 0.2, 1.46, 0.78], ease: 'out' }, { t: 0.7, pos: up(sx), ease: 'inOut' }],
        [other + '_Hand']: [{ t: 0, pos: rest(-sx) }, { t: 0.7, pos: rest(-sx) }],
      },
    });
  }
  return out;
}

export async function loadCrew({ boat, hue, quality, count = 20, seed = 1, withHuman = true, shirt, shadows = false }) {
  const crew = { boat, paddlers: [], drummer: null, steerer: null, paddles: [], ready: false, hue, paddleSet: makePaddleSet({ wood: boat.mats.wood, paddle: boat.mats.paddle }, 24) };
  boat.root.add(crew.paddleSet.wood); boat.root.add(crew.paddleSet.paint);
  crew.paddleSet.wood.castShadow = crew.paddleSet.paint.castShadow = shadows && quality !== 'low';
  const lod = quality === 'low' ? 'auto' : 'auto';
  const kit = (i) => ({ top: shirt ?? `hsl(${hue},75%,48%)`, bottoms: '#1b2230', socks: '#e8e8e8' });
  const kitCol = (i) => { const c = new T.Color().setHSL(hue / 360, 0.7, 0.4); return { top: '#' + c.getHexString(), bottoms: '#1b2230', socks: '#e8e8e8' }; };
  const ids = [];
  for (let k = 0; k < ROWS; k++) for (const sd of [1, -1]) if (ids.length < count) ids.push({ k, side: sd });
  let rs = seed * 7919 + 13;
  const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };
  const proto = {};
  const make = async (character, i) => {
    const h = await loadHuman({ character, lod: 'auto', quality, kit: kitCol(i), skin: SKINS[i % SKINS.length], hair: HAIRS[(i * 3) % HAIRS.length], castShadow: quality !== 'low' && shadows });
    h.lodAuto = false;
    h.groundClamp = 'off'; h.footPlanting = false;
    return h;
  };
  const paddleMats = { wood: boat.mats.wood, paddle: boat.mats.paddle };
  for (let i = 0; i < ids.length; i++) {
    const { k, side } = ids[i];
    const character = (i * 5) % 7 === 3 ? 'athlete_f' : 'athlete_m';
    const h = await make(character, i);
    const key = `${character}${side}`;
    if (!proto[key]) proto[key] = paddlerClip(h, side); else h.addClip(proto[key]);
    if (!h.hasClip(proto[key].name)) h.addClip(proto[key]);
    h.setPosition(side * SEAT_DX, FLOOR_Y, rowZ(k)); h.setFacing(0);
    boat.root.add(h.root);
    const tr = h.play(proto[key].name, { fade: 0, loop: true }); tr.speed = 0;
    crew.paddlers.push({ h, side, k, jit: (rnd() - 0.5) * 2, off2: rnd(), idx: i, clip: proto[key].name });
    if (i % 4 === 3) await new Promise((r) => setTimeout(r, 0));
  }
  // drummer, facing the crew (aft)
  {
    const h = await make('athlete_m', 3);
    const cl = drummerClips(h); h.addClip(cl.L); h.addClip(cl.R);
    h.setPosition(0, FLOOR_Y + 0.0, 5.3); h.setFacing(Math.PI); boat.root.add(h.root);
    h.play('drumL', { fade: 0, loop: false, startTime: 0 });
    // headband to read as the pacer
    crew.drummer = { h, next: 0, hand: 'L', cl, sched: -1 };
  }
  // steerer, standing at the stern with both hands on the sweep oar
  {
    const h = await make('athlete_m', 5);
    h.setPosition(0, 0.22, -5.0); h.setFacing(0); boat.root.add(h.root);
    h.play('idle_relaxed', { fade: 0 }); h.groundClamp = 'off';
    crew.steerer = { h };
  }
  crew.ready = true;
  return crew;
}

const tv = new T.Vector3(), tv2 = new T.Vector3(), tq = new T.Quaternion(), up = new T.Vector3(0, 1, 0), axis = new T.Vector3();
const pPos = new T.Vector3(), pLow = new T.Vector3();
function placePaddle(crew, p) {
  const hr = p.h.bonePosition('R_Hand', tv), hl = p.h.bonePosition('L_Hand', tv2);
  const top = p.side > 0 ? hr : hl, low = p.side > 0 ? hl : hr;
  const root = crew.boat.root;                                        // world -> boat-local
  const a = root.worldToLocal(top.clone()), b = root.worldToLocal(low.clone());
  axis.copy(a).sub(b); const len = axis.length() || 1; axis.multiplyScalar(1 / len);
  tq.setFromUnitVectors(up, axis);
  pPos.copy(a).addScaledVector(axis, -1.15 + 0.04);                   // the shaft's top end sits in the top hand
  crew.paddleSet.set(p.idx, pPos, tq);
}

// Per frame. st = { t, boat: { sT0, sT1, S, v, steer }, beatIn: seconds to the next drum hit, ... } from the published state.
const lv = new T.Vector3();
// level of detail by distance to the camera (the stock policy is by screen pixels and keeps everyone at medium on a phone)
function setLod(h, camera, quality) {
  h.root.getWorldPosition(lv);
  const d = lv.distanceTo(camera.position);
  const want = quality === 'low' ? 2 : quality === 'high' ? (d < 6 ? 0 : d < 24 ? 1 : 2) : (d < 15 ? 1 : 2);
  if (h.lod !== want) h.setLOD(want);
}
export function updateCrew(crew, st, dt, camera, vh, fi = 0, quality = 'high', rival = false) {
  if (!crew.ready) return;
  // phones: rival crews animate at ~24 Hz (the crew is small on screen); the player's own crew stays at full rate
  if (rival && quality !== 'high') { crew.slow = (crew.slow || 0) + dt; if (crew.slow < 1 / 24 && dt > 0) return; dt = crew.slow; crew.slow = 0; }
  const period = Math.max(0.3, st.sT1 - st.sT0);
  const spread = clamp(st.spread, 0, 1);
  const going = st.v > 0.4 || st.strokeOn;
  let idx = 0;
  for (const p of crew.paddlers) {
    idx += 1;
    const phase = going ? ((st.t - st.sT0 - p.jit * spread * 0.2 + 0.001) / period) : 0;
    const u = going ? ((phase % 1) + 1) % 1 : 0;
    const tr = p.h.layers.base.current;
    if (tr) { tr.time = u * CYCLE; tr.speed = 0; }
    setLod(p.h, camera, quality);
    p.acc = (p.acc || 0) + dt;
    if (p.h.lod === 2 && (fi + idx) % 2) continue;
    p.h.update(p.acc); p.acc = 0;
    placePaddle(crew, p);
  }
  // drummer: schedule the next strike so the stick lands on the beat
  const d = crew.drummer;
  if (d) {
    const eta = st.nextBeatT - st.t;
    if (st.nextBeatT > d.sched && eta < 0.2 && eta > -0.05) {
      d.sched = st.nextBeatT; d.hand = d.hand === 'L' ? 'R' : 'L';
      d.h.playTimed('drum' + d.hand, 'hit', Math.max(0, eta), { fade: 0.04, frameDt: dt });
    }
    setLod(d.h, camera, quality); d.h.update(dt);
  }
  const s = crew.steerer;
  if (s) {
    // hands on the oar handle: the handle swings with the steering angle
    const oar = crew.boat.oar; oar.rotation.y = -st.steer * 0.32;
    oar.updateMatrixWorld(true);
    const hp1 = new T.Vector3(0.12, 0.1, 0.5), hp2 = new T.Vector3(-0.12, 0.1, 0.9);
    oar.localToWorld(hp1); oar.localToWorld(hp2);
    s.h.setReach('R', hp1); s.h.setReach('L', hp2);
    setLod(s.h, camera, quality); s.h.update(dt);
  }
}
