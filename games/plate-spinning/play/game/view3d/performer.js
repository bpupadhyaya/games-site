// The performer: a real 3D person (view3d athlete_m) in a period acrobat costume: sapphire silk tunic with gold frog buttons and trim, crimson sash with
// two silk tails (verlet ribbons), flared black silk trousers and a robe skirt whose flaps lag and swing with his run. The presenter drives him
// (position goals, whip events); he owns locomotion (cadence from distance travelled, facing from velocity), the wrist-flick reach and the cloth.
// Presentation only: nothing here is read by the simulation.
import { THREE, createRibbon } from './models.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (cur, tgt, k, dt) => cur + (tgt - cur) * (1 - Math.exp(-k * dt));
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const COSTUME = { tunic: '#1c3f94', trim: '#e9c45c', sash: '#b3202f', trousers: '#16121c', cap: '#b3202f', slipper: '#15111a' };

function silk(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, metalness: 0.02, sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color(o.sheen || '#c8d6ff'), side: THREE.DoubleSide, envMapIntensity: 0.9, ...o.extra });
}

function dress(human, C = COSTUME) {
  const parts = [];
  const Y = new THREE.Vector3(0, 1, 0);
  const tunicM = silk(C.tunic), trimM = new THREE.MeshStandardMaterial({ color: C.trim, roughness: 0.32, metalness: 0.75, envMapIntensity: 1.2 });
  const sashM = silk(C.sash, { sheen: '#ffb0a0' }), pantsM = silk(C.trousers, { sheen: '#8a90c8' });
  const add = (bone, obj) => { bone.add(obj); parts.push({ bone, obj }); return obj; };
  // a tapered tube from a bone origin towards its child, optionally running past it
  const tube = (bone, child, r0, r1, extra = 0, mat = tunicM, seg = 22) => {
    const d = child.position.clone(), len = d.length(); d.normalize();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len + extra, seg, 1, true), mat);
    m.quaternion.setFromUnitVectors(Y, d); m.position.copy(d).multiplyScalar((len + extra) * 0.5); m.castShadow = true;
    return add(bone, m);
  };
  const B = (n) => human.bones[`Bip01_${n}`];
  for (const s of ['L', 'R']) {
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), ha = B(`${s}_Hand`);
    if (up && fo && ha) {
      tube(up, fo, 0.056, 0.053);
      add(up, new THREE.Mesh(new THREE.SphereGeometry(0.06, 18, 12), tunicM));
      add(fo, new THREE.Mesh(new THREE.SphereGeometry(0.054, 16, 10), tunicM));
      tube(fo, ha, 0.053, 0.062, 0.05);                       // forearm sleeve flaring slightly at the wrist
      const dd = ha.position.clone().normalize();
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.02, 24, 1, true), trimM);
      cuff.quaternion.setFromUnitVectors(Y, dd); cuff.position.copy(ha.position).addScaledVector(dd, 0.045);
      add(fo, cuff);
    }
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`), fe = B(`${s}_Foot`);
    if (th && ca && fe) {
      tube(th, ca, 0.098, 0.074, 0, pantsM);
      add(th, new THREE.Mesh(new THREE.SphereGeometry(0.096, 16, 10), pantsM));
      add(ca, new THREE.Mesh(new THREE.SphereGeometry(0.073, 14, 10), pantsM));
      tube(ca, fe, 0.072, 0.07, 0.015, pantsM);               // flared at the ankle
      const dd = fe.position.clone().normalize();
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.035, 20, 1, true), trimM);
      band.quaternion.setFromUnitVectors(Y, dd); band.position.copy(fe.position).addScaledVector(dd, -0.03);
      add(ca, band);
    }
  }
  human.root.updateMatrixWorld(true);
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const sp = B('Spine'), sp1 = B('Spine1'), sp2 = B('Spine2'), neck = B('Neck'), head = B('Head'), pel = B('Pelvis');
  const toLocal = (bone, obj, p) => { obj.position.copy(bone.worldToLocal(p.clone())); const q = new THREE.Quaternion(); bone.getWorldQuaternion(q); obj.quaternion.copy(q.invert()); };
  const wSp = wp(sp), wSp2 = wp(sp2), wNeck = wp(neck), wPel = wp(pel);
  {
    // sash
    const sashH = 0.1;
    const sg = new THREE.CylinderGeometry(1, 1, sashH, 30, 1, true), sm = new THREE.Mesh(sg, sashM);
    sm.scale.set(0.2 * 1.06, 1, 0.2 * 0.84 + 0.012); sm.castShadow = true;
    toLocal(sp, sm, new THREE.Vector3(wSp.x, wSp.y - 0.02, wSp.z)); add(sp, sm);
    for (const dy of [0.055, -0.055]) {
      const e = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.008, 30, 1, true), trimM); e.scale.set(0.202 * 1.06, 1, 0.202 * 0.84 + 0.012);
      toLocal(sp, e, new THREE.Vector3(wSp.x, wSp.y - 0.02 + dy, wSp.z)); add(sp, e);
    }
  }
  // soft black cloth shoes with a white sole line over the trainers
  for (const sd of ['L', 'R']) {
    const ft = B(`${sd}_Foot`); if (!ft) continue;
    const wf = wp(ft);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), pantsM); shoe.scale.set(0.058, 0.05, 0.135);
    const q = new THREE.Quaternion(); ft.getWorldQuaternion(q);
    shoe.position.copy(ft.worldToLocal(new THREE.Vector3(wf.x, wf.y - 0.02, wf.z + 0.065))); shoe.quaternion.copy(q.invert()); shoe.castShadow = true; add(ft, shoe);
  }
  // sash anchors (world rest points) for the verlet tails and the robe flaps hinge
  const tails = [];
  for (const side of [1, -1]) {
    const r = createRibbon({ n: 8, length: 0.62, width: 0.085, color: side > 0 ? C.sash : '#8c1624' });
    tails.push({ r, side });
  }
  return { parts, tails, tunicM, trimM, sashM, pantsM, remove() { parts.forEach((p) => p.bone.remove(p.obj)); } };
}

// Robe skirt: eight hanging silk flaps parented to the performer root, hinged at the waist, swung by velocity with a damped spring.
function makeFlaps(C = COSTUME, trimM) {
  const g = new THREE.Group(), flaps = [];
  const mat = silk(C.tunic);
  const N = 8, R = 0.185, len = 0.52, wdt = (TAU * R) / N * 1.05;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const hinge = new THREE.Group(); hinge.position.set(Math.sin(a) * R * 0.74, 0, Math.cos(a) * R);
    hinge.rotation.y = a;
    const geo = new THREE.PlaneGeometry(wdt, len, 3, 6); geo.translate(0, -len / 2, 0);
    const p = geo.attributes.position; for (let k = 0; k < p.count; k++) { const u = -p.getY(k) / len; p.setZ(k, 0.02 * Math.sin(p.getX(k) / wdt * Math.PI * 2) * (0.4 + u) + 0.05 * u * u); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = true;
    const hem = new THREE.Mesh(new THREE.BoxGeometry(wdt, 0.022, 0.004), trimM); hem.position.set(0, -len + 0.011, 0.05);
    hinge.add(m, hem); g.add(hinge);
    flaps.push({ hinge, a, vx: 0, ax: 0, vz: 0, az: 0 });
  }
  return { group: g, flaps };
}

export async function createPerformer(V3, stage, { quality = 'high', character = 'athlete_m', costume = COSTUME } = {}) {
  const { loadHuman, FINGER_POSES } = V3;
  const human = await loadHuman({ character, kit: { top: costume.tunic, bottoms: costume.trousers, socks: '#e9e2d0', shoes: costume.slipper }, skin: '#d8a883', hair: 'black', lod: quality === 'low' ? 1 : 0 });
  human.groundClamp = 'feet'; human.footPlanting = false; human.turnRate = 7;
  stage.add(human); stage.track(human);
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  human.play('idle', { fade: 0, loop: true }); human.update(0);
  const initialClip = 'idle';
  let dr = null;
  try { dr = dress(human, costume); } catch (e) { console.warn('costume failed', e); }
  const flapsAPI = makeFlaps(costume, dr ? dr.trimM : new THREE.MeshStandardMaterial({ color: costume.trim }));
  stage.add(flapsAPI.group);
  if (dr) for (const t of dr.tails) stage.add(t.r.mesh);

  const S = {
    human, x: 0, z: 0, goalX: 0, goalZ: 0, vx: 0, vz: 0, speed: 0, yaw: 0, idleYaw: 0, moving: false, lastClip: 'idle',
    lastClipInit: 1, whip: null, flinch: 0, cheer: 0, look: null, lookW: 0, mode: 'ready', handSide: 'R', shoulderY: 1.42,
    log: null,
  };
  human.setPosition(0, 0, 0);
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _sh = new THREE.Vector3(), _anchor = new THREE.Vector3(), _side = new THREE.Vector3(), _wind = new THREE.Vector3();
  const accel = new THREE.Vector2();
  let t = 0, prevSpeed = 0, stepWhip = 0;

  S.teleport = (x, z) => { S.x = S.goalX = x; S.z = S.goalZ = z; S.vx = S.vz = 0; human.setPosition(x, 0, z); if (dr) for (const tl of dr.tails) tl.r.reset(_anchor.set(x, 1.0, z)); };
  S.goTo = (x, z) => { S.goalX = x; S.goalZ = z; };
  // start a wrist flick on a pole: grip = world point on the shaft, pointFn(t) gives the live shaft point (it bends)
  S.startWhip = (side, grade, gripFn) => { S.whip = { t: 0, side, grade, gripFn, dur: grade === 'perfect' ? 0.55 : grade === 'jolt' ? 0.4 : 0.48 }; S.handSide = side; };
  S.react = (kind) => { if (kind === 'flinch') S.flinch = 1; else if (kind === 'cheer') S.cheer = 1; };
  S.lookAt = (p, w = 0.8) => { S.look = p; S.lookW = w; };
  S.setIdleYaw = (y) => { S.idleYaw = y; };
  S.setMode = (m) => { S.mode = m; };

  S.update = (dt) => {
    if (dt <= 0) { human.update(0); return; }
    t += dt;
    // ---- planar motion: accelerate toward the goal, arrive smoothly (speed limit 5 m/s, accel 14 m/s2)
    const dx = S.goalX - S.x, dz = S.goalZ - S.z, dist = Math.hypot(dx, dz);
    const vmax = Math.min(4.6, Math.sqrt(2 * 7 * dist));
    const tx = dist > 1e-3 ? (dx / dist) * vmax : 0, tz = dist > 1e-3 ? (dz / dist) * vmax : 0;
    const dvx = tx - S.vx, dvz = tz - S.vz, dl = Math.hypot(dvx, dvz), maxdv = 9 * dt;
    if (dl > maxdv) { S.vx += (dvx / dl) * maxdv; S.vz += (dvz / dl) * maxdv; } else { S.vx = tx; S.vz = tz; }
    if (dist < 0.02 && Math.hypot(S.vx, S.vz) < 0.3) { S.vx = S.vz = 0; }
    S.x += S.vx * dt; S.z += S.vz * dt;
    const sp = Math.hypot(S.vx, S.vz);
    accel.set((S.vx - (S._pvx || 0)) / dt, (S.vz - (S._pvz || 0)) / dt); S._pvx = S.vx; S._pvz = S.vz;
    S.speed = sp;
    // ---- locomotion state with hysteresis; clip cadence comes from the distance actually covered (locomote matches foot speed)
    if (!S.moving && sp > 0.22) S.moving = true; else if (S.moving && sp < 0.1) S.moving = false;
    if (S.moving) {
      if (S.gait !== 'jog' && sp > 2.5) S.gait = 'jog'; else if (S.gait !== 'walk' && sp < 1.5) S.gait = 'walk';
      S.gait = S.gait || 'walk';
      human.locomote(S.gait === 'jog' ? Math.max(sp, 2.0) : clamp(sp, 0.9, 1.6), { fade: 0.28 });      // the gait is chosen with hysteresis here; cadence below follows the real speed
      const cur = human.layers.base.current, v0 = S.gait === 'jog' ? 3.07 : 1.4;
      if (cur) cur.speed = clamp(sp / v0, 0.3, 1.7);
      S.lastClip = 'loco';
    }
    else {
      const want = S.mode === 'relaxed' ? 'idle_relaxed' : 'idle';
      if (S.lastClip !== want) { human.crossfade(want, 0.3, { loop: true }); S.lastClip = want; }
    }
    // ---- facing: the smoothed velocity heading while he really runs; a slow damped turn to the working yaw while he is planted or shuffling
    S.hx = damp(S.hx || 0, S.vx, 6, dt); S.hz = damp(S.hz || 0, S.vz, 6, dt);
    const hs = Math.hypot(S.hx, S.hz);
    if (!S.running && sp > 1.0) S.running = true; else if (S.running && sp < 0.6) S.running = false;
    let want = S.running && sp > 0.5 ? Math.atan2(S.vx, S.vz) : (S.whip ? S.idleYawWhip ?? S.idleYaw : S.idleYaw);
    const d = wrapPi(want - S.yaw);
    S.yaw += clamp(d * (1 - Math.exp(-(S.running ? 14 : 7) * dt)), -(S.running ? 12 : 3.2) * dt, (S.running ? 12 : 3.2) * dt);
    human.setPosition(S.x, 0, S.z); human.setFacing(S.yaw);
    // ---- whip: reach the grip hand to the shaft. The hand's own animated position (rest) is read first, then the IK target is slid from it to the
    // shaft by an eased envelope at full weight, so the reach starts and ends exactly where the animation already is (no pop).
    if (S.whip) {
      const w = S.whip; w.t += dt;
      const u = w.t / w.dur;
      S.reachSide = w.side; S.reachEnv = ss(0, 0.22, u) * (1 - ss(0.58, 1, u));
      S.reachP = (S.reachP || new THREE.Vector3()).copy(w.gripFn(w.t, _w));
      if (w.t >= w.dur) { S.whip = null; S.reachEnv = 0; }
    } else S.reachEnv = 0;
    if (S.reachSide && S.reachEnv > 0.002 && S.reachP) {
      const side = S.reachSide;
      human.setReach(side, null); human.update(0);                            // FK-only pose of this frame
      const rest = human.bonePosition(side + '_Hand', _anchor).clone();
      const target = rest.lerp(S.reachP, S.reachEnv);
      const shoulder = human.bonePosition(side + '_UpperArm', _sh);
      const out = side === 'R' ? -1 : 1, cx = Math.cos(S.yaw), sx = Math.sin(S.yaw);
      human.setReach(side, target, { weight: 1, pole: { x: shoulder.x + out * cx * 0.22 + sx * 0.05, y: shoulder.y - 0.32, z: shoulder.z - out * sx * 0.22 + cx * 0.05 } });
      human.setFingers(side, 'batGrip');
    } else if (S.reachSide && !S.whip) { human.setReach(S.reachSide, null); human.setFingers(S.reachSide, 'auto'); S.reachSide = null; }
    // ---- head: look at the plate being tended
    if (S.look) human.lookAt(S.look, { weight: S.lookW * (S.flinch > 0 ? 1 : 1), maxYaw: 0.9, maxPitch: 0.6 });
    S.flinch = Math.max(0, S.flinch - dt * 2.2); S.cheer = Math.max(0, S.cheer - dt * 1.2);
    human.update(dt);
    // ---- cloth: flaps swing back with speed and lateral acceleration (damped springs), sash tails are verlet ribbons from the waist
    human.root.updateMatrixWorld(true);
    const pel = human.bones.Bip01_Pelvis; pel.getWorldPosition(_v);
    const waistY = _v.y + 0.06;
    flapsAPI.group.position.set(_v.x, waistY, _v.z); flapsAPI.group.rotation.y = S.yaw;
    const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw);
    const fwdSpeed = S.vx * sy + S.vz * cy, latSpeed = S.vx * cy - S.vz * sy;       // along / across the facing
    const fAcc = accel.x * sy + accel.y * cy, lAcc = accel.x * cy - accel.y * sy;
    for (const f of flapsAPI.flaps) {
      // flap normal direction in the group frame is (sin a, cos a); wind pushes flaps whose normal opposes the velocity
      const nx = Math.sin(f.a), nz = Math.cos(f.a);
      const push = (nz * fwdSpeed + nx * latSpeed) * 0.085 + (nz * fAcc + nx * lAcc) * 0.012;      // radians of outward swing
      const k = 70, c = 11, tgt = clamp(push, -0.9, 0.9);
      f.x0 = f.x0 || 0;
      f.vx += ((tgt - f.x0) * k - f.vx * c) * Math.min(dt, 1 / 30); f.x0 += f.vx * Math.min(dt, 1 / 30);
      f.hinge.rotation.x = clamp(f.x0, -0.9, 0.9) + 0.04 * Math.sin(t * 2.1 + f.a * 3) * (S.moving ? 1 : 0.4);
    }
    // thigh clearance: the flaps ride up a little when the knee comes forward (hip flexion); approximated with speed
    if (dr) {
      const sashP = human.bones.Bip01_Spine.getWorldPosition(_anchor); sashP.y -= 0.02;
      _side.set(cy, 0, -sy);
      for (const tl of dr.tails) {
        const a = _anchor.clone().addScaledVector(_side, tl.side * 0.17).addScaledVector(new THREE.Vector3(sy, 0, cy), -0.1);
        _wind.set(-S.vx * 2.2, 0.0, -S.vz * 2.2);
        tl.r.step(dt, a, _side, _wind);
      }
    }
    prevSpeed = sp; stepWhip += dt;
  };
  S.dispose = () => { try { dr && dr.remove(); } catch { /* ignore */ } };
  return S;
}
