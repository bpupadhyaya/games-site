// The circle: eight athletes in the pit, the drummer on the dais, and their props. Presentation only: acts and drum hits come from the
// simulation (state.v3); the athletes' poses are authored clips scrubbed by act age (see moves.js) so picture and drum agree.
import { THREE, loadHuman, buildClip, createCrowd3d, SKIN_TONES } from '../vendor3d/index.js';
import { createDust, createLang, updateLang, createChime } from './fx.js';
import { RW, DAIS_Y } from './room.js';
import { makeMats, makeClub, makeShield, makeStand, makeDrum, makeBell, makeStool } from './props.js';
import { buildMoveClips, playhead, figure, DUR, SHIELD_FLOOR, D_REST, H_REST } from './moves.js';

const T = THREE;
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease3 = (x) => 1 - (1 - clamp(x, 0, 1)) ** 3;
const ATH_K = 0.7;
const KIND_COLOR = { tap: 0xf4b942, l: 0x35d0c0, r: 0x35d0c0, u: 0x35d0c0, d: 0x35d0c0, hold: 0x8aa4ff, whirl: 0xff7a5c };
const WORLD_DIR = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] };

const LOOKS = [
  { skin: 'deep', hair: 'black' }, { skin: 'brown', hair: 'black' }, { skin: 'light', hair: '#3a2616' }, { skin: 'tan', hair: 'black' },
  { skin: 'tan', hair: 'black' }, { skin: 'brown', hair: '#2a1c14' }, { skin: 'tan', hair: 'grey' }, { skin: 'light', hair: 'black' },
];
// Traditional kit: bare torso, dark tanban (knee breeches / trousers), and a striped lang (waist cloth) in a distinct colour each.
const KITS = [
  { bottoms: '#2c2420', lang: ['#b3342a', '#f6ead2', '#1f4fa8'] }, { bottoms: '#1f2530', lang: ['#1f4fa8', '#f6ead2', '#c9942e'] }, { bottoms: '#2a2218', lang: ['#1f7a5a', '#f6ead2', '#c9942e'] }, { bottoms: '#24201c', lang: ['#c47a1c', '#2a1c14', '#f6ead2'] },
  { bottoms: '#2c2420', lang: ['#7a2a5a', '#f6ead2', '#c9942e'] }, { bottoms: '#1f2530', lang: ['#1c6c80', '#f6ead2', '#c9942e'] }, { bottoms: '#2a2218', lang: ['#a63a1a', '#f6ead2', '#1f4fa8'] }, { bottoms: '#24201c', lang: ['#3a4aa0', '#f4b942', '#f6ead2'] },
];
const dim = (hex, k) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('');
const BARE = { light: '#d9a47e', tan: SKIN_TONES.tan, brown: SKIN_TONES.brown, deep: SKIN_TONES.deep };

const v1 = new T.Vector3(), v2 = new T.Vector3(), v3 = new T.Vector3(), q1 = new T.Quaternion(), m1 = new T.Matrix4();
const Y = new T.Vector3(0, 1, 0);

export function athleteSpot(i) {
  const a = Math.PI / 2 + (i * TAU) / 8, x = Math.cos(a) * ATH_K * RW, z = Math.sin(a) * ATH_K * RW;
  return { x, z, yaw: Math.atan2(-x, -z) };            // the athlete faces the middle of the pit
}

// The kit tints the shirt region to skin; this adds the anatomy a bare chest has (sternum, pectoral edge, ab grooves, nipples) in the
// body shader, in model space, so the torso reads as a trained body at any size. Pure shading: no geometry or sim involved.
function bareTorso(h) {
  for (const m of h.mats) {
    if (m.userData.kind !== 'body') continue;
    const orig = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => {
      orig(sh, r);
      sh.fragmentShader = sh.fragmentShader.replace('diffuseColor.rgb = c;', `diffuseColor.rgb = c;
        {
          float tp = clamp(m.r * 1.4, 0.0, 1.0) * step(0.55, vBy) * step(vBy, 1.5);
          float x = vBx, y = vBy;
          float sternum = (1.0 - smoothstep(0.004, 0.016, x)) * smoothstep(1.08, 1.18, y) * (1.0 - smoothstep(1.34, 1.40, y));
          float pec = (1.0 - smoothstep(0.0, 0.014, abs(y - (1.19 - 0.55 * x)))) * step(x, 0.17) * step(0.012, x);
          float grv = 0.0;
          for (int k = 0; k < 3; k++) { float gy = 1.1 - 0.075 * float(k); grv += (1.0 - smoothstep(0.0, 0.009, abs(y - gy))) * step(x, 0.075); }
          float nip = (1.0 - smoothstep(0.012, 0.024, length(vec2(x - 0.085, y - 1.2))));
          float sh = 1.0 - tp * (0.30 * sternum + 0.22 * pec + 0.18 * min(grv, 1.0) + 0.22 * nip);
          float form = 1.0 + tp * 0.10 * smoothstep(0.16, 0.0, x) * smoothstep(1.06, 1.22, y);
          diffuseColor.rgb *= sh * form;
        }`);
    };
    m.customProgramCacheKey = () => 'view3d-body-bare';
    m.needsUpdate = true;
  }
}

// Pose low-pass: the posed local rotations are eased with a critically damped-style filter (tau ~ 40 ms) so a clip switch or a scrub step
// can never pop a limb between two frames. The filter runs on the final pose each frame (clips are re-evaluated from scratch), never on the sim.
const SMOOTH_BONES = ['Pelvis', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm', 'L_Hand', 'R_Hand', 'L_Thigh', 'R_Thigh', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot'];
function smoothPose(A, dt, tau = 0.055) {
  const h = A.h;
  if (!A.sm) A.sm = SMOOTH_BONES.map((n) => { const b = h.bones['Bip01_' + n]; return b ? { b, q: b.quaternion.clone(), p: b.position.clone() } : null; }).filter(Boolean);
  const k = dt > 0 ? 1 - Math.exp(-dt / tau) : 0;
  for (const s of A.sm) {
    if (k > 0) { s.q.slerp(s.b.quaternion, k); if (s.b.name.endsWith('Pelvis')) s.p.lerp(s.b.position, k); }
    s.b.quaternion.copy(s.q); if (s.b.name.endsWith('Pelvis')) s.b.position.copy(s.p);
  }
  h.root.updateMatrixWorld(true);
}

function drummerClips(h) {
  const base = { clip: 'idle', time: 0 };
  const seat = { Pelvis: { pos: [0, -0.43, 0.02] }, L_Thigh: { flex: 88, abduct: 7 }, R_Thigh: { flex: 88, abduct: 7 }, L_Calf: { flex: 92 }, R_Calf: { flex: 92 }, Spine1: { flex: 7 }, Neck: { flex: -3 } };
  const out = {};
  const rest = (s) => [0.19 * s, 1.0, 0.42], up = (s) => [0.15 * s, 1.15, 0.4], hit = (s) => [0.1 * s, 0.94, 0.53], hold = (s) => [0.17 * s, 0.99, 0.46];
  for (const hand of ['L', 'R']) {
    const sx = hand === 'L' ? 1 : -1, other = hand === 'L' ? 'R' : 'L';
    out[hand] = buildClip(h, {
      name: 'drum' + hand, duration: 0.7, base, grounded: false, fingers: 'relaxed', events: { hit: 0.2 },
      keys: [{ t: 0, pose: seat }, { t: 0.2, pose: { ...seat, Spine1: { flex: 11, twist: -sx * 4 } }, ease: 'in' }, { t: 0.7, pose: seat, ease: 'out' }],
      ik: {
        [hand + '_Hand']: { keys: [{ t: 0, pos: up(sx) }, { t: 0.2, pos: hit(sx), ease: 'in' }, { t: 0.42, pos: [0.14 * sx, 1.08, 0.46], ease: 'out' }, { t: 0.7, pos: up(sx), ease: 'inOut' }], pole: [{ t: 0, pos: [0.38 * sx, 0.8, 0.1] }] },
        [other + '_Hand']: { keys: [{ t: 0, pos: hold(-sx) }, { t: 0.7, pos: hold(-sx) }], pole: [{ t: 0, pos: [0.38 * -sx, 0.8, 0.1] }] },
      },
    });
  }
  out.idle = buildClip(h, { name: 'drumIdle', duration: 2.73, base: 'idle', inherit: true, loop: true, grounded: false, fingers: 'relaxed', keys: [{ t: 0, pose: seat }, { t: 1.3, pose: { ...seat, Spine1: { flex: 8 } } }, { t: 2.73, pose: seat }], ik: {
    L_Hand: { keys: [{ t: 0, pos: hold(1) }, { t: 2.73, pos: hold(1) }], pole: [{ t: 0, pos: [0.38, 0.8, 0.1] }] }, R_Hand: { keys: [{ t: 0, pos: hold(-1) }, { t: 2.73, pos: hold(-1) }], pole: [{ t: 0, pos: [-0.38, 0.8, 0.1] }] },
  } });
  return out;
}

export async function loadCircle(scene, room, { quality = 'high', onStep, camera } = {}) {
  const M = makeMats();
  const C = { athletes: [], drummer: null, ready: false, M, quality, rings: [], lastCamKey: '', clock: 0, sweat: 0, crowd: null, dust: createDust(scene, { quality, floorR: room.floorR || 2.5 }), chime: createChime(scene), lastBell: 0 };
  const lod = quality === 'low' ? 2 : 1;
  const mk = async (i, kit, look) => {
    const h = await loadHuman({ character: 'athlete_m', lod: 'auto', quality, kit: { top: dim(BARE[look.skin] || SKIN_TONES.tan, 1.03), bottoms: dim(kit.lang[0], 0.7), socks: kit.bottoms }, skin: look.skin, hair: look.hair, castShadow: quality !== 'low' });
    h.lodAuto = false; h.groundClamp = 'feet'; h.footPlanting = true;
    bareTorso(h);
    return h;
  };
  let clips = null;
  // the hand-to-hand stands for the shields, between each athlete and the dais
  for (let i = 0; i < 8; i++) {
    const sp = athleteSpot(i);
    const h = await mk(i, KITS[i], LOOKS[i]);
    if (!clips) clips = buildMoveClips(h);
    for (const k in clips) h.addClip(clips[k]);
    h.setPosition(sp.x, 0, sp.z); h.setFacing(sp.yaw);
    scene.add(h.root);
    h.play('z_idle', { fade: 0, loop: true });
    h.setLOD(lod);
    const clubL = makeClub(M), clubR = makeClub(M), shield = makeShield(M), stand = makeStand(M);
    const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);                          // facing direction in the world
    stand.position.set(sp.x + fx * SHIELD_FLOOR[2], 0, sp.z + fz * SHIELD_FLOOR[2]); stand.rotation.y = sp.yaw; stand.receiveShadow = true;
    scene.add(clubL, clubR, shield, stand);
    // glow ring under the athlete while a move runs
    const ring = new T.Mesh(new T.RingGeometry(0.42, 0.56, 36), new T.MeshBasicMaterial({ color: 0xf4b942, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, 0.02, sp.z); scene.add(ring);
    const lang = createLang(scene, KITS[i].lang);
    C.athletes.push({ lang, footOff: [0.1, 0.0], puffed: false, whirlT: 0, h, i, sp, clubL, clubR, shield, standPos: new T.Vector3(sp.x + fx * SHIELD_FLOOR[2], SHIELD_FLOOR[1], sp.z + fz * SHIELD_FLOOR[2]), ring, cur: '', tr: null, spin: 0, restL: null, restR: null, ph: i * 0.37, glow: 0 });
    onStep && onStep(i + 1, 9);
    await new Promise((r) => setTimeout(r, 0));
  }
  // the drummer, facing the viewer, on a stool on the dais, with the drum on a tripod in front of him
  {
    const h = await loadHuman({ character: 'athlete_m', lod: 'auto', quality, kit: { top: '#27408f', bottoms: '#e9e0cc', socks: '#e8e0d0' }, skin: 'tan', hair: 'grey', castShadow: quality !== 'low' });
    h.lodAuto = false; h.groundClamp = 'off'; h.footPlanting = false;
    const dc = drummerClips(h);
    for (const k in dc) h.addClip(dc[k]);
    h.setPosition(0, DAIS_Y, -0.02); h.setFacing(0);
    scene.add(h.root);
    h.play('drumIdle', { fade: 0, loop: true });
    h.setLOD(lod);
    const stool = makeStool(M); stool.position.set(0, DAIS_Y, -0.02); scene.add(stool);
    const drum = makeDrum(M);
    const dg = new T.Group(); dg.position.set(0, DAIS_Y + 0.88, 0.52); dg.add(drum); dg.rotation.x = -0.62;
    scene.add(dg);
    for (let k = 0; k < 3; k++) {
      const a = (k * TAU) / 3 + Math.PI / 2 + 0.5, leg = new T.Mesh(new T.CylinderGeometry(0.014, 0.018, 0.66, 6), M.woodDark);
      const bx = Math.cos(a) * 0.2, bz = Math.sin(a) * 0.2 + 0.6;
      leg.position.set(bx * 0.5, DAIS_Y + 0.33 + 0.12, 0.42 + (bz - 0.6) * 0.5 + 0.2); leg.rotation.set(Math.sin(a) * 0.28, 0, -Math.cos(a) * 0.28); leg.castShadow = quality !== 'low';
      scene.add(leg);
    }
    const bell = makeBell(M); bell.position.set(0.92, DAIS_Y, 0.15); bell.rotation.y = -0.4; scene.add(bell);
    C.drummer = { h, drum: dg, bell, hand: 'L', last: { l: 0, r: 0, bell: 0 }, nextAllowed: 0, bellK: 0 };
    onStep && onStep(9, 9);
  }
  // spectators on the benches round the step (far and side arcs; the near wall is cut away): real instanced 3D people
  if (camera) {
    const pts = [], rr = room.floorR + 0.3;
    const per = quality === 'low' ? 0.8 : 0.52;
    for (let a = 0; a < Math.PI * 2; a += per / rr) {
      if (Math.cos(a) > 0.28) continue;
      const x = Math.sin(a) * rr, z = Math.cos(a) * rr;
      pts.push({ x, y: room.stepY - 0.04, z, yaw: Math.atan2(-x, -z), seated: 1 });
    }
    C.crowd = createCrowd3d({ scene, camera }, { points: pts, count: pts.length, seed: 21, culture: 'middle_eastern', quality: quality === 'high' ? 'medium' : 'low', excitement: 0.25 });
  }
  C.ready = true;
  return C;
}

// Direction index of a swipe seen from an athlete: the clip azimuth (multiples of 45 degrees, 0 = ahead, 90 = to the athlete's left).
function swingIndex(kind, yaw) {
  const [wx, wz] = WORLD_DIR[kind];
  const fwd = wx * Math.sin(yaw) + wz * Math.cos(yaw), left = wx * Math.cos(yaw) - wz * Math.sin(yaw);
  return ((Math.round(Math.atan2(left, fwd) / (Math.PI / 4)) % 8) + 8) % 8;
}
const spinPos = (a) => (a < 0.25 ? (6.4 * a * a) / 0.5 : 6.4 * (a - 0.125));

// The world pose of a club held by `side` of athlete A at char-space direction `dir`, resting weight `restW`.
function placeClub(A, side, dirChar, restW, club, yaw) {
  const h = A.h, wrist = h.bonePosition(side + '_Hand', v1), fore = h.bonePosition(side + '_Forearm', v2);
  v3.copy(wrist).sub(fore).normalize();
  // grip point: a little beyond the wrist along the forearm
  const grip = wrist.clone().addScaledVector(v3, 0.06);
  const sn = Math.sin(yaw), cs = Math.cos(yaw);
  const dw = new T.Vector3(dirChar[0] * cs + dirChar[2] * sn, dirChar[1], -dirChar[0] * sn + dirChar[2] * cs);
  const butt = grip.clone().addScaledVector(dw, -0.1);
  if (restW > 0.001) {
    const sp = h.bones.Bip01_Spine2, key = side === 'L' ? 'restL' : 'restR';
    if (!A[key]) return null;
    sp.updateWorldMatrix(true, false);
    const rb = A[key].butt.clone().applyMatrix4(sp.matrixWorld);
    const rd = A[key].dir.clone().transformDirection(sp.matrixWorld);
    butt.lerp(rb, restW); dw.lerp(rd, restW).normalize();
  }
  club.position.copy(butt);
  q1.setFromUnitVectors(Y, dw); club.quaternion.copy(q1);
  club.visible = true;
}

// Per frame. v: state.v3 (acts, drum, ...), dt: seconds of presentation time (0 while paused), cam: { ppm } for the level of detail.
export function updateCircle(C, v, dt, frozenClock) {
  if (!C.ready) return;
  C.clock = frozenClock;
  // sweat sheen builds with effort (unison and time in the piece), and eases off when the circle rests
  const effort = clamp((v.unison ?? 0) * 0.6 + (v.acts ? v.acts.filter((a) => a && a.age >= 0).length / 8 : 0) * 0.5, 0, 1);
  C.sweat += (effort - C.sweat) * Math.min(1, (dt || 0) * 0.35);
  const rough = 0.66 - 0.3 * C.sweat;
  if (C._rough === undefined || Math.abs(C._rough - rough) > 0.01) {
    C._rough = rough;
    for (const A of C.athletes) for (const m of A.h.mats) if (m.userData.kind === 'body') { m.roughness = rough; m.envMapIntensity = 0.8 + 0.8 * C.sweat; }
  }
  for (const A of C.athletes) {
    const { h, i } = A, act = v.acts && v.acts[i] && v.acts[i].age >= 0 ? v.acts[i] : null;
    let name = 'z_idle', t = (C.clock + A.ph) % DUR.idle, spinYaw = 0, kind = 'idle', theta = 0, glowK = 0;
    if (act) {
      kind = act.kind; const dur = act.dur || 0.38;
      if (kind === 'tap') { name = 'z_tap' + (act.cw > 0 ? 'L' : 'R'); t = Math.min(act.age, DUR.tap); glowK = clamp(1 - act.age / 0.5, 0, 1); }
      else if (kind === 'hold') { const p = playhead('hold', act.age, dur); name = 'z_hold'; t = p.t; glowK = 0.8; }
      else if (kind === 'whirl') {
        const p = playhead('whirl', act.age, dur); name = 'z_whirl'; t = p.t;
        const s0 = spinPos(dur); let sp = spinPos(act.age);
        if (act.age > dur) { const target = Math.ceil(s0 / TAU) * TAU; sp = s0 + (target - s0) * ease3((act.age - dur) / 0.3); }
        spinYaw = -sp * (act.cw || 1); glowK = 0.8;
      } else { const k = swingIndex(kind, A.sp.yaw); name = 'z_swing' + k; t = Math.min(act.age, DUR.swing); theta = k * 45 > 180 ? k * 45 - 360 : k * 45; glowK = clamp(1 - act.age / 0.6, 0, 1); }
    }
    if (A.cur !== name) { A.tr = h.play(name, { fade: name === 'z_idle' ? 0.22 : 0.09, loop: name === 'z_idle' }); A.cur = name; }
    if (A.tr) { A.tr.speed = 0; A.tr.time = Math.min(t, A.tr.clip.dur); }
    const yaw = A.sp.yaw + spinYaw;
    h.setFacing(yaw);
    if (spinYaw === 0) { h.setPosition(A.sp.x, 0, A.sp.z); A.pivot = null; }
    // look at the drummer unless turning
    if (kind === 'whirl' || kind === 'hold') h.lookAt(null); else h.lookAt({ x: 0, y: 1.25, z: 0 }, { weight: kind === 'idle' ? 0.8 : 0.4, maxYaw: 0.9, maxPitch: 0.5 });
    h.update(dt);
    smoothPose(A, dt); h.limbSanity?.();
    if (spinYaw !== 0) {                                                       // a whirl pirouettes on the planted left foot: it stays exactly where it was
      if (!A.pivot) { A.pivot = new T.Vector3(A.sp.x + A.footOff[0] * Math.cos(A.sp.yaw) + A.footOff[1] * Math.sin(A.sp.yaw), 0, A.sp.z - A.footOff[0] * Math.sin(A.sp.yaw) + A.footOff[1] * Math.cos(A.sp.yaw)); }
      const f = h.bonePosition('L_Foot', v1);
      h.setPosition(h.root.position.x + (A.pivot.x - f.x), 0, h.root.position.z + (A.pivot.z - f.z));
      h.root.updateMatrixWorld(true);
    }
    if (kind === 'idle' && !A.footDone) { const f = h.bonePosition('L_Foot', new T.Vector3()), dx = f.x - A.sp.x, dz = f.z - A.sp.z, sy = Math.sin(A.sp.yaw), cy = Math.cos(A.sp.yaw); A.footOff = [dx * cy - dz * sy, dx * sy + dz * cy]; A.footDone = true; }
    // waist cloth, dust and sweat (secondary motion; all driven by the posed body)
    {
      const pel = h.bonePosition('Pelvis', v1);
      updateLang(A.lang, pel.x, pel.y, pel.z, yaw, dt || 0.0001, C.clock, i);
      if (dt > 0) {
        if (kind === 'tap') { if (!A.puffed && act.age >= 0.1) { A.puffed = true; const f = act.cw > 0 ? 1 : -1; C.dust.puff(A.sp.x + Math.sin(A.sp.yaw + 1.57) * 0.12 * f, A.sp.z + Math.cos(A.sp.yaw + 1.57) * 0.12 * f, 9, 1.1); } }
        else if (kind === 'whirl') { A.whirlT += dt; if (A.whirlT > 0.16) { A.whirlT = 0; C.dust.puff(A.sp.x, A.sp.z, 2, 0.6); } A.puffed = false; }
        else if (kind === 'idle') A.puffed = false;
        else if (!A.puffed && act && act.age >= 0.2) { A.puffed = true; C.dust.puff(A.sp.x, A.sp.z, 3, 0.5); }       // a swing's follow-through scuffs the clay
        if (kind !== 'tap' && kind !== 'whirl' && !act) A.puffed = false;
      }
    }
    // props from the same authored figure
    const fig = figure(kind === 'tap' ? 'tap' : kind === 'hold' ? 'hold' : kind === 'whirl' ? 'whirl' : kind === 'idle' ? 'idle' : 'swing', kind === 'hold' || kind === 'whirl' ? t : kind === 'idle' ? t : t, { theta, foot: act && act.cw > 0 ? 'L' : 'R' });
    if (!A.restL) {                                                              // capture the rest hold in the torso frame once, from the idle pose
      const sp = h.bones.Bip01_Spine2; sp.updateWorldMatrix(true, false); const inv = sp.matrixWorld.clone().invert();
      for (const [side, key, s] of [['L', 'restL', 1], ['R', 'restR', -1]]) {
        const wrist = h.bonePosition(side + '_Hand', new T.Vector3()), fore = h.bonePosition(side + '_Forearm', new T.Vector3());
        const grip = wrist.clone().addScaledVector(wrist.clone().sub(fore).normalize(), 0.06);
        const dir = D_REST(s), sn = Math.sin(yaw), cs = Math.cos(yaw);
        const dw = new T.Vector3(dir[0] * cs + dir[2] * sn, dir[1], -dir[0] * sn + dir[2] * cs);
        A[key] = { butt: grip.clone().addScaledVector(dw, -0.1).applyMatrix4(inv), dir: dw.clone().transformDirection(inv) };
      }
    }
    // clubs ride the torso frame rotated by the spin: pass the ACTUAL yaw so the held direction is world-correct
    placeClub(A, 'L', fig.dir.L, fig.rest, A.clubL, yaw);
    placeClub(A, 'R', fig.dir.R, fig.rest, A.clubR, yaw);
    // the shield: on its stand, or between the hands
    const c = fig.carry;
    if (c <= 0.001) { A.shield.position.copy(A.standPos).y += 0.045; A.shield.quaternion.setFromAxisAngle(Y, A.sp.yaw); }
    else {
      const hl = h.bonePosition('L_Hand', new T.Vector3()), hr = h.bonePosition('R_Hand', new T.Vector3());
      const mid = hl.clone().add(hr).multiplyScalar(0.5), xAx = hl.clone().sub(hr).normalize();
      const high = clamp((mid.y - 0.3) / 1.67, 0, 1), tilt = 0.9 * Math.sin(Math.PI * high) + 0.2 * high;
      const fwd = new T.Vector3(Math.sin(A.sp.yaw), 0, Math.cos(A.sp.yaw));
      const n = new T.Vector3(0, 1, 0).lerp(fwd, tilt * 0.9).normalize();
      const zAx = new T.Vector3().crossVectors(xAx, n).normalize(); n.crossVectors(zAx, xAx).normalize();
      m1.makeBasis(xAx, n, zAx);
      const q = new T.Quaternion().setFromRotationMatrix(m1);
      const hp = mid.clone().addScaledVector(n, 0.05);
      const fp = A.standPos.clone(); fp.y += 0.045;
      A.shield.position.copy(fp.lerp(hp, c)); A.shield.quaternion.copy(new T.Quaternion().setFromAxisAngle(Y, A.sp.yaw).slerp(q, c));
    }
    A.glow += (glowK - A.glow) * Math.min(1, (dt || 0.016) * 14);
    A.ring.material.opacity = 0.55 * A.glow * (v.calm ? 0.6 : 1);
    A.ring.material.color.setHex(KIND_COLOR[kind] ?? 0xf4b942);
    A.ring.scale.setScalar(1 + (1 - A.glow) * 0.3);
  }
  // the drummer: strike on the rising edge of the sim's drum hits so a stick lands with the sound
  const D = C.drummer;
  if (D) {
    const d = v.drum || { l: 0, r: 0, bell: 0 };
    for (const [key, hand] of [['l', 'L'], ['r', 'R']]) {
      if (d[key] > 0.5 && D.last[key] <= 0.5 && C.clock >= D.nextAllowed - 0.0001) {
        D.h.play('drum' + hand, { fade: 0.03, startTime: 0.15, loop: false });
        D.nextAllowed = C.clock + 0.06;
      }
      D.last[key] = d[key];
    }
    if (d.bell > 0.5 && D.last.bell <= 0.5) { D.bellK = 1; C.chime.trigger(D.bell.position.x, D.bell.position.y + 0.12, D.bell.position.z); if (C.crowd) C.crowd.react('cheer', { origin: [0, 0.4, 0], radius: 8, intensity: 0.5 }); }
    D.last.bell = d.bell;
    D.bellK = Math.max(0, D.bellK - (dt || 0.016) * 3);
    D.bell.rotation.z = Math.sin(C.clock * 50) * 0.12 * D.bellK;
    D.h.update(dt);
  }
  C.dust.update(dt || 0, C.clock, v.calm);
  C.chime.update(dt || 0);
  if (C.crowd) { C.crowd.setExcitement(0.2 + 0.7 * clamp(v.unison ?? 0, 0, 1)); C.crowd.update(dt || 0); }
}

export function setCircleLod(C, ppm) {
  const px = ppm * 1.1;                                                          // an athlete's height on screen, roughly
  const want = C.quality === 'low' ? 2 : px < 62 ? 2 : px < 150 ? 1 : 0;
  if (C.lodNow === want) return;
  C.lodNow = want;
  for (const A of C.athletes) A.h.setLOD(want);
  if (C.drummer) C.drummer.h.setLOD(want);
}
