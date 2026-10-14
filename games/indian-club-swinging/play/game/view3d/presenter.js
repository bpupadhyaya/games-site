// Indian Club Swinging 3D presenter (game-owned). It ONLY READS what the screens hand to hooks.scene (grip and head of each club, the
// beat pulse) and never writes back to the simulation. One full-screen WebGL scene is rendered off-screen and drawn into the 2D canvas
// as the BACKGROUND of the play screen and the title: the akhara courtyard, the raked pit, the athlete (real hands gripping the club
// necks, weight shift, breathing, sash), the two turned clubs and their light trails. The 2D layer then paints only the guidance
// (ghost paths, target ring), particles and HUD on top.
// If WebGL or the library is missing, or the context is lost, hooks.scene returns false and the 2D scene in art.js is drawn instead.
import { hooks } from '../src/hooks.js';
import { buildWorld } from './world.js';
import { buildClub, CLUB_LEN, HEAD_AT } from './club.js';
import { createHand } from './hand3d.js';

const LIB = '../vendor3d/index.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const HAND_Y = 1.3;        // metres: height of the pad's centre line (the sim's hand plane) above the floor
const HAND_Z = 0.3;        // metres in front of the body
const CAM_Z = 5.4, CAM_Y = 2.3;   // camera: 5.4 m away, 2.3 m up, looking straight ahead (lens shifted, so the hand plane stays exactly parallel)
const GRIP_S = 0.2;        // where along the club (0 knob .. 1 end) the hand holds the neck
const TAU = Math.PI * 2;

export async function createPresenter() {
  const off = { ok: false };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D scene', e); return off; }
  const { createStage, loadHuman, THREE, CLIP_BONES } = V3;
  const { semanticRot } = V3;
  const doc = document;

  const canvas = doc.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:256px;height:256px;visibility:hidden;pointer-events:none;z-index:-1';
  doc.body.appendChild(canvas);
  let stage;
  try { stage = createStage({ canvas, quality: 'high', dprCap: 1, lighting: 'evening', transparent: false, preserveDrawingBuffer: true, shadows: true, shadowSize: 2.6, fov: 30 }); } catch (e) { canvas.remove(); return off; }
  if (!stage.supported || !stage.ok) { canvas.remove(); return off; }
  const camera = stage.camera, scene = stage.scene;
  camera.near = 0.5; camera.far = 60;

  stage.setLighting('evening', { hemiSky: 0x8fd0c4, hemiGround: 0x5a3a24, hemi: 0.55, key: 0xffd9a8, keyI: 2.6, rim: 0x58e0c8, rimI: 1.6, exposure: 0.95 });
  stage._shadowOffset.set(2.6, 4.8, 3.6);
  stage.setShadowTarget(0, 1, 0);
  stage.setSky?.(null, null);

  // ---- world + athlete
  let world;
  try { world = buildWorld(V3, stage); } catch (e) { console.warn('view3d world failed; using the 2D scene', e); stage.dispose(); canvas.remove(); return off; }
  let human;
  try {
    human = await loadHuman({ character: 'athlete_m', kit: { top: '#f1e6cc', bottoms: '#f4efe0', socks: '#d9c8a4', shoes: '#c9a47a' }, skin: 'brown', hair: 'black' });
  } catch (e) { console.warn('view3d athlete failed; using the 2D scene', e); stage.dispose(); canvas.remove(); return off; }
  stage.add(human); stage.track(human);
  human.groundClamp = 'off'; human.footPlanting = false;
  human.setPosition(0, 0, 0); human.setFacing(0);
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; } });
  human.play('idle_relaxed', { fade: 0, loop: true });
  stage.update(0.001, { renderNow: false });

  // ---- procedural body offsets: written into the evaluated pose just before it is applied, so IK (hands, feet) solves on top of them
  const BI = (n) => CLIP_BONES.indexOf('Bip01_' + n);
  const off3 = { pelvis: [0, 0, 0], spine: { twist: 0, side: 0, flex: 0 }, neck: { twist: 0, side: 0, flex: 0 }, knee: 0 };
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
  const rotBone = (pose, name, p) => {
    const rot = semanticRot(name, p), i = BI(name);
    _e.set(rot[0] * Math.PI / 180, rot[1] * Math.PI / 180, rot[2] * Math.PI / 180, 'XYZ'); _q2.setFromEuler(_e);
    _q.set(pose.q[i * 4], pose.q[i * 4 + 1], pose.q[i * 4 + 2], pose.q[i * 4 + 3]).multiply(_q2);
    pose.q[i * 4] = _q.x; pose.q[i * 4 + 1] = _q.y; pose.q[i * 4 + 2] = _q.z; pose.q[i * 4 + 3] = _q.w;
  };
  const writePose0 = human._writePose.bind(human);
  human._writePose = (pose, rest) => {
    if (!rest) {
      const s = off3.spine, n = off3.neck, ph = human.pelvisHeight;
      pose.p[0] += off3.pelvis[0] / ph; pose.p[1] += off3.pelvis[1] / ph; pose.p[2] += off3.pelvis[2] / ph;
      for (const nm of ['Spine', 'Spine1', 'Spine2']) rotBone(pose, nm, { twist: s.twist / 3, side: s.side / 3, flex: s.flex / 3 });
      rotBone(pose, 'Neck', { twist: n.twist * 0.5, side: n.side * 0.5, flex: n.flex * 0.5 }); rotBone(pose, 'Head', { twist: n.twist * 0.5, side: n.side * 0.5, flex: n.flex * 0.5 });
    }
    writePose0(pose, rest);
  };

  // ---- feet: planted, shoulder-width, the pelvis moves over them (legs solve with IK, so the soles never slide)
  const ankle = {};
  {
    const v = new THREE.Vector3();
    for (const s of ['L', 'R']) { human.bonePosition(`${s}_Foot`, v); ankle[s] = v.clone(); ankle[s].x = (s === 'L' ? 1 : -1) * 0.15; ankle[s].z = 0.02; }
  }

  // ---- hands: the athlete's own hands, driven through the hand3d module (finger curl presets + palm/finger frame math)
  const hands = {};
  for (const s of ['L', 'R']) { hands[s] = await createHand(V3, { human, side: s }); hands[s].setPreset('gripRod'); }

  // ---- clubs (+ trails)
  const clubs = [buildClub(V3, doc, 0), buildClub(V3, doc, 1)];   // 0 = lead (athlete's left hand, screen right), 1 = second
  for (const c of clubs) { scene.add(c); }
  // spare clubs in the stand (left of the pit)
  if (world.clubStand) {
    [-0.15, 0, 0.15].forEach((x, i) => { const c = buildClub(V3, doc, i % 2); c.scale.setScalar(0.62); c.position.set(x, 0.1, 0); c.rotation.z = (i - 1) * 0.05; c.rotation.x = 0.05; world.clubStand.add(c); });
    world.clubStand.rotation.y = 0.5;
  }
  const TRAIL_N = 40;
  const mkTrail = (hex) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3));
    const idx = []; for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.frustumCulled = false; m.renderOrder = 5; scene.add(m);
    return { m, g, rgb: new THREE.Color(hex) };
  };
  const trails = [mkTrail(0xffc83c), mkTrail(0x46d6c0)];

  // ---- sash: a cotton waist cloth with a tail that swings with the hips (verlet chain, 7 points)
  const sashMat = new THREE.MeshStandardMaterial({ color: 0xa3262b, roughness: 0.8 });
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.03, 10, 32), sashMat);
  belt.rotation.x = Math.PI / 2; belt.scale.set(1.0, 0.82, 1.0); belt.castShadow = true; scene.add(belt);
  const TAIL_N = 7, tail = { p: [], q: [], seg: 0.06 };
  for (let i = 0; i < TAIL_N; i++) { tail.p.push(new THREE.Vector3()); tail.q.push(new THREE.Vector3()); }
  const tailGeo = new THREE.BufferGeometry();
  tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_N * 2 * 3), 3));
  { const idx = []; for (let i = 0; i < TAIL_N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tailGeo.setIndex(idx); }
  const tailMesh = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0xb8302f, roughness: 0.85, side: THREE.DoubleSide }));
  tailMesh.frustumCulled = false; tailMesh.castShadow = true; scene.add(tailMesh);
  let tailInit = false;

  // ---- camera: the hand plane (z = HAND_Z) is exactly parallel to the image, R virtual units = 1 metre there
  let camKey = '';
  const setCamera = (w, h, cx, cy, R) => {
    const key = `${w}|${h}|${cx.toFixed(1)}|${cy.toFixed(1)}|${R.toFixed(2)}`;
    if (key === camKey) return; camKey = key;
    const dPlane = CAM_Z - HAND_Z, e = CAM_Y - HAND_Y;
    const ppx = cx, ppy = cy - e * R;                                    // principal point (px) so that the hand-plane centre lands on (cx, cy)
    const fullW = 2 * Math.max(ppx, w - ppx), fullH = 2 * Math.max(ppy, h - ppy);
    camera.fov = 2 * Math.atan(fullH / (2 * R * dPlane)) * 180 / Math.PI;
    camera.aspect = fullW / fullH;
    camera.setViewOffset(fullW, fullH, fullW / 2 - ppx, fullH / 2 - ppy, w, h);
    camera.position.set(0, CAM_Y, CAM_Z); camera.rotation.set(0, 0, 0);
    camera.updateProjectionMatrix();
  };

  // ---- quality governor: first frames at full size; drop the pixel ratio (and shadows) when frames run long
  const gov = { tier: 0, last: 0, acc: 0, n: 0, pr: 1 };
  const PR = [1, 0.8, 0.62];
  const govern = (nowMs) => {
    if (gov.last) {
      const d = nowMs - gov.last;
      if (d < 250) { gov.acc += d; gov.n++; }
      if (gov.n >= 45) {
        const avg = gov.acc / gov.n; gov.acc = 0; gov.n = 0;
        if (avg > 26 && gov.tier < 2) { gov.tier++; gov.pr = PR[gov.tier]; if (gov.tier === 2) { stage.renderer.shadowMap.enabled = false; stage.lights.key.castShadow = false; } stage.invalidate(); sizeKey = ''; }
      }
    }
    gov.last = nowMs;
  };

  let lost = false, failed = false, sizeKey = '', lastT = null, tScene = 0;
  stage.onContextLost(() => { lost = true; snaps.clear(); });
  stage.onContextRestored(() => { lost = false; stage.invalidate(); sizeKey = ''; camKey = ''; });

  // ---- smoothed body state
  const sm = { lean: 0, dip: 0.3, twist: 0, raise: 0, headX: 0, speed: 0, breath: 0, weight: 0, flex: 0 };
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(), s: new THREE.Vector3(), t: new THREE.Vector3() };
  const handQ = { L: new THREE.Quaternion(), R: new THREE.Quaternion() }, roll = { L: 0, R: 0 }, rollV = { L: 0, R: 0 }, rollTarget = { L: 0, R: 0 };
  let lastPulse = 0, lastWeightSide = 0, handInit = false;
  const clubAng = [null, null]; let headS = null;
  const toW = (f, px, py, out) => out.set((px - f.cx) / f.R, HAND_Y - (py - f.cy) / f.R, HAND_Z);

  function poseAndRender(f, dt) {
    const R = f.R, k = (tau) => (dt > 0 ? 1 - Math.exp(-dt / tau) : 1);
    // ---- targets from the sim
    const mx = clamp((f.hLead.x + f.hSecond.x) * 0.5, -1, 1), my = clamp((f.hLead.y + f.hSecond.y) * 0.5, -1, 1);
    const hLeadWorldX = f.hLead.x, tw = clamp((f.hLead.y - f.hSecond.y) * 0.5, -1, 1);
    sm.lean += (mx - sm.lean) * k(0.16);
    sm.dip += ((my * 0.5 + 0.5) - sm.dip) * k(0.18);
    sm.twist += (tw - sm.twist) * k(0.14);
    sm.speed += (clamp(f.speed || 0, 0, 8) - sm.speed) * k(0.2);
    const tbr = f.t * TAU * 0.28;                                       // breathing: 0.28 Hz, deeper when the swing is fast (effort)
    const breathAmp = 0.6 + 0.12 * sm.speed;
    sm.breath = Math.sin(tbr) * breathAmp;
    // weight shift: the hips go to the side opposite the clubs' mass, the chest follows a little
    off3.pelvis[0] = -sm.lean * 0.055;
    off3.pelvis[1] = -(0.02 + 0.045 * sm.dip) + Math.sin(tbr) * 0.004;
    off3.pelvis[2] = 0;
    off3.spine.side = sm.lean * 5.5; off3.spine.twist = sm.twist * 11; off3.spine.flex = 1.2 + 4 * (sm.dip - 0.5) + sm.breath * 0.9;
    off3.neck.side = -sm.lean * 3.5; off3.neck.twist = -sm.twist * 5; off3.neck.flex = -1.5;
    // feet planted (ankles at fixed spots)
    human.setReachFoot('L', ankle.L, 1); human.setReachFoot('R', ankle.R, 1);

    // ---- clubs: knob = head - dir * HEAD_AT * L; grip on the neck at GRIP_S
    const parts = [f.lead, f.second];
    for (let i = 0; i < 2; i++) {
      const g = parts[i], club = clubs[i], H = toW(f, g.hx, g.hy, tmp.a);
      // the second club's head follows the pair rule, which can step when a move changes: speed-limited so it glides there (the lead stays exact)
      if (i === 1) {
        if (!headS) headS = { x: H.x, y: H.y, vx: 0, vy: 0 };
        const ex = H.x - headS.x, ey = H.y - headS.y, dd = Math.hypot(ex, ey);
        if (dd < 0.05 && Math.hypot(headS.vx, headS.vy) < 0.4) { headS.x = H.x; headS.y = H.y; headS.vx = headS.vy = 0; }
        else {
          const want = Math.min(5, dd * 18), ux = dd > 1e-6 ? ex / dd : 0, uy = dd > 1e-6 ? ey / dd : 0;
          const dvx = ux * want - headS.vx, dvy = uy * want - headS.vy, dl = Math.hypot(dvx, dvy), la = 55 * dt;
          const sc = dl > la && dl > 1e-9 ? la / dl : 1;
          headS.vx += dvx * sc; headS.vy += dvy * sc; headS.x += headS.vx * dt; headS.y += headS.vy * dt;
        }
        H.x = headS.x; H.y = headS.y;
      }
      // the club's direction follows the sim's, rate-limited: where a figure eight passes the pivot the sim turns the club half a circle in a
      // few frames; here it turns over in about a quarter second, so the hands never jump
      const tgt = Math.atan2(-g.dy, g.dx);
      if (clubAng[i] === null) clubAng[i] = tgt;
      else { const d = Math.atan2(Math.sin(tgt - clubAng[i]), Math.cos(tgt - clubAng[i])), lim = 12 * dt; clubAng[i] += clamp(d * k(0.03), -lim, lim); }
      const dx = Math.cos(clubAng[i]), dy = Math.sin(clubAng[i]);       // world: y up
      club.position.set(H.x - dx * HEAD_AT * CLUB_LEN, H.y - dy * HEAD_AT * CLUB_LEN, HAND_Z);
      club.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
      club.userData.mat.emissiveIntensity = (i === 0 ? (f.glow || 0) : (f.glow || 0) * 0.6) * 0.55 + 0.04 * (f.pulse || 0);
      // hand: back of the hand faces outward, fingers run toward the viewer, wrapped round the neck
      const side = i === 0 ? 'L' : 'R', hand = hands[side];
      const ax = tmp.b.set(dx, dy, 0).normalize();
      const out = side === 'L' ? 1 : -1;
      const fromBase = tmp.c.set(ax.y, -ax.x, 0);                       // ax x zc: the back-of-hand direction for fingers toward +z
      // the grip flips side only well past horizontal (hysteresis); the wrist ROLLS there (a continuous angle about the club), never snaps
      let want = rollTarget[side];
      if (fromBase.x * out * (want ? -1 : 1) < -0.35) want = 1 - want;
      rollTarget[side] = want;
      { // critically damped spring (omega 11 rad/s): the roll eases in and out, no velocity step
        const om = 11, tg = want ? Math.PI : 0, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
        for (let s2 = 0; s2 < n; s2++) { rollV[side] += (om * om * (tg - roll[side]) - 2 * om * rollV[side]) * h; roll[side] += rollV[side] * h; }
      }
      const cph = Math.cos(roll[side]), sph = Math.sin(roll[side]);
      const from = tmp.s.set(fromBase.x * cph, fromBase.y * cph, -sph).clone();
      const centre = tmp.d.set(club.position.x + ax.x * GRIP_S * CLUB_LEN, club.position.y + ax.y * GRIP_S * CLUB_LEN, HAND_Z);
      hand.gripCylinder({ radius: 0.017, axis: ax, center: centre, from, thumbSide: 1 });
      // finger pressure: a tighter hold on fast turns, a looser one at rest
      const tight = clamp(0.62 + 0.05 * sm.speed, 0.6, 0.85);
      hand.setPose({ index: tight, middle: tight + 0.02, ring: tight + 0.05, pinky: tight + 0.07, thumb: 0.5 + 0.2 * (tight - 0.6) / 0.25 });
      // smooth the hand orientation (a rod turning through horizontal flips the grip side: let the wrist roll there instead of snapping)
      const pl = hand.placement;
      if (!handInit) handQ[side].copy(pl.q); else handQ[side].slerp(pl.q, k(0.03));
      pl.q.copy(handQ[side]);
      // elbow: a pole below and outside the midpoint of shoulder and wrist
      const sh = human.bonePosition(`${side}_UpperArm`, tmp.s), w = pl.wrist;
      const pole = tmp.t.set((sh.x + w.x) / 2 + out * 0.2, Math.min(sh.y, w.y) - 0.22, (sh.z + w.z) / 2 - 0.12);
      hand.apply(pole);
    }
    handInit = true;

    // ---- head follows the lead club (eyes on the work), a little lag
    toW(f, f.lead.hx, f.lead.hy, tmp.a); tmp.a.z = 0.6;
    sm.headX += (tmp.a.x - sm.headX) * k(0.25);
    human.lookAt({ x: sm.headX, y: clamp(tmp.a.y, 1.0, 2.0), z: 0.9 }, { weight: 0.55 });

    // ---- trails (3D ribbons in the hand plane)
    const lists = [f.trail, f.trail2];
    for (let i = 0; i < 2; i++) {
      const tr = trails[i], pts = lists[i] || [], g = tr.g, pa = g.attributes.position, ca = g.attributes.color;
      const show = !!f.showTrail && pts.length > 2;
      tr.m.visible = show;
      if (!show) continue;
      const n = Math.min(TRAIL_N, pts.length), off0 = pts.length - n;
      for (let j = 0; j < TRAIL_N; j++) {
        const pj = pts[Math.min(pts.length - 1, off0 + Math.min(j, n - 1))], u = n > 1 ? Math.min(j, n - 1) / (n - 1) : 1;
        const p1 = pts[Math.min(pts.length - 1, off0 + Math.min(j + 1, n - 1))], p0 = pts[Math.max(0, off0 + Math.min(j, n - 1) - 1)];
        let tx = p1.x - p0.x, ty = p1.y - p0.y; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        const wv = (0.012 + 0.05 * u * u) * (0.5 + 0.1 * Math.min(6, sm.speed));
        toW(f, pj.x, pj.y, tmp.a);
        const nx = -ty, ny = tx;   // screen normal: (nx, ny) in px space; world y is flipped
        pa.setXYZ(j * 2, tmp.a.x + nx * wv, tmp.a.y - ny * wv, HAND_Z - 0.03);
        pa.setXYZ(j * 2 + 1, tmp.a.x - nx * wv, tmp.a.y + ny * wv, HAND_Z - 0.03);
        const a = u * u * (f.trailGain ?? 0.9) * (j >= n ? 0 : 1);
        for (let q = 0; q < 2; q++) ca.setXYZ(j * 2 + q, tr.rgb.r * a, tr.rgb.g * a, tr.rgb.b * a);
      }
      pa.needsUpdate = true; ca.needsUpdate = true;
    }

    // ---- sand puffs where the weight lands: when the hips pass the turning point of the sway
    const side = Math.sign(sm.lean) * (Math.abs(sm.lean) > 0.25 ? 1 : 0);
    if (side !== 0 && side !== lastWeightSide) { lastWeightSide = side; if (dt > 0) world.puff(-side * 0.2, 0.04, 1, 0.7); }
    if ((f.pulse || 0) > 0.95 && lastPulse <= 0.95 && dt > 0) world.puff((lastWeightSide >= 0 ? -1 : 1) * 0.2, 0.05, 1, 0.5);
    lastPulse = f.pulse || 0;
    world.update(f.t, dt);

  }

  // ---- sash follows the pelvis (called after the body update so it sees the final pose)
  const _pel = new THREE.Vector3();
  function sash(dt) {
    human.bonePosition('Pelvis', _pel);
    belt.position.set(_pel.x, _pel.y + 0.2, _pel.z + 0.0);
    belt.rotation.z = off3.spine.side * -0.012;
    const anchor = tmp.a.set(_pel.x - 0.19, _pel.y + 0.17, _pel.z + 0.07);
    if (!tailInit) { for (let i = 0; i < TAIL_N; i++) { tail.p[i].set(anchor.x, anchor.y - i * tail.seg, anchor.z); tail.q[i].copy(tail.p[i]); } tailInit = true; }
    const steps = dt > 0 ? Math.max(1, Math.min(4, Math.round(dt * 120))) : 0, h = steps ? dt / steps : 0;
    for (let s = 0; s < steps; s++) {
      tail.p[0].copy(anchor);
      for (let i = 1; i < TAIL_N; i++) {
        const p = tail.p[i], q = tail.q[i];
        const vx = (p.x - q.x) * 0.9, vy = (p.y - q.y) * 0.9, vz = (p.z - q.z) * 0.9;
        q.copy(p);
        p.x += vx; p.y += vy - 3.2 * h * h; p.z += vz + 0.5 * h * h;
        if (p.z < 0.05) p.z = 0.05;
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < TAIL_N; i++) {
        const a = tail.p[i - 1], b = tail.p[i];
        tmp.b.copy(b).sub(a); const l = tmp.b.length() || 1e-4; tmp.b.multiplyScalar((l - tail.seg) / l);
        if (i === 1) b.sub(tmp.b); else { b.sub(tmp.b.multiplyScalar(0.5)); a.add(tmp.b); }
      }
    }
    const pa = tailGeo.attributes.position;
    for (let i = 0; i < TAIL_N; i++) {
      const w = 0.026 * (1 - i / TAIL_N * 0.55);
      pa.setXYZ(i * 2, tail.p[i].x - w, tail.p[i].y, tail.p[i].z); pa.setXYZ(i * 2 + 1, tail.p[i].x + w, tail.p[i].y, tail.p[i].z);
    }
    pa.needsUpdate = true; tailGeo.computeVertexNormals();
  }

  function renderFrame(f, dt) {
    const wpx = Math.max(64, Math.round(f.w * f.unit * gov.pr * (f.scale || 1))), hpx = Math.max(64, Math.round(f.h * f.unit * gov.pr * (f.scale || 1)));
    // cap the pixel count (huge tablets): scale the whole picture down
    const cap = f.cap || 1.7e6, kk = Math.min(1, Math.sqrt(cap / (wpx * hpx)));
    const W = Math.round(wpx * kk), H = Math.round(hpx * kk);
    const key = `${W}x${H}`;
    if (key !== sizeKey) { sizeKey = key; canvas.style.width = `${W}px`; canvas.style.height = `${H}px`; stage.setSize(W, H); camKey = ''; }
    setCamera(f.w, f.h, f.cx, f.cy, f.R);
    poseAndRender(f, dt);
    stage.update(dt, { renderNow: false });
    sash(dt);
    stage.render();
    return true;
  }

  // ---- hooks ---------------------------------------------------------------------------------------------------------------------------
  hooks.scene = (ctx, f) => {
    if (failed || lost || !stage.ok) return false;
    try {
      const tr = ctx.getTransform(); f.unit = Math.hypot(tr.a, tr.b);
      let dt = lastT === null ? 0 : f.t - lastT; lastT = f.t;
      dt = clamp(dt, 0, 0.1);
      govern(performance.now());
      renderFrame(f, dt);
      ctx.drawImage(canvas, 0, 0, f.w, f.h);
      return true;
    } catch (e) { console.warn('view3d scene failed; using the 2D scene', e); failed = true; return false; }
  };
  // a still picture of the courtyard (with the athlete at rest) behind the menu, routine, move and text screens: rendered once per size
  const snaps = new Map();
  hooks.backdrop = (ctx, w, h) => {
    if (failed || lost || !stage.ok) return false;
    try {
      const tr = ctx.getTransform(), unit = Math.hypot(tr.a, tr.b), key = `${Math.round(w)}x${Math.round(h)}@${unit.toFixed(2)}`;
      let c = snaps.get(key);
      if (!c) {
        const R = Math.min(w, h) * 0.3, rest = (x) => ({ x, y: -0.35 });
        const fig = { w, h, cx: w / 2, cy: h * 0.55, R, t: 0.5, unit, scale: 0.6, paused: true, speed: 0, showTrail: false, pulse: 0, glow: 0,
          lead: { hx: w / 2 + R * 0.2, hy: h * 0.55 + R * 0.78, dx: Math.cos(Math.PI * 0.62), dy: Math.sin(Math.PI * 0.62) },
          second: { hx: w / 2 - R * 0.2, hy: h * 0.55 + R * 0.78, dx: Math.cos(Math.PI * 0.38), dy: Math.sin(Math.PI * 0.38) },
          hLead: rest(0.2), hSecond: rest(-0.2), trail: [], trail2: [] };
        // let the pose settle for a few frames so the arms reach the grips, then keep the picture
        for (let i = 0; i < 4; i++) renderFrame(fig, 0.05);
        if (snaps.size > 3) snaps.clear();
        const cc = doc.createElement('canvas'); cc.width = canvas.width; cc.height = canvas.height;
        cc.getContext('2d').drawImage(canvas, 0, 0);
        c = cc; snaps.set(key, c); sizeKey = ''; camKey = '';
      }
      ctx.drawImage(c, 0, 0, w, h);
      return true;
    } catch (e) { console.warn('view3d backdrop failed', e); return false; }
  };

  // ---- app icon: the same scene, framed close on the athlete with the two clubs swung out in a V, trails behind (dev/offline only)
  function iconFrame(size = 2048, o = {}) {
    gov.pr = 1; sizeKey = ''; camKey = '';
    const R = size * (o.R ?? 0.5), cx = size / 2, cy = size * (o.cy ?? 0.64), L = CLUB_LEN * R;
    const ang = (o.ang ?? 62) * Math.PI / 180, reach = (HEAD_AT - GRIP_S) * L;
    const mk = (sgn) => {
      const hx = cx + sgn * 0.2 * R, hy = cy - 0.1 * R, a = Math.PI + sgn * (Math.PI / 2 - ang) - (sgn > 0 ? 0 : 0);
      const dx = sgn * Math.cos(ang), dy = -Math.sin(ang);
      return { hx: hx + dx * reach, hy: hy + dy * reach, dx, dy, a, gx: hx, gy: hy };
    };
    const A = mk(1), B = mk(-1);
    const arc = (g, sgn) => {
      const pts = [], r = reach, a1 = Math.atan2(g.hy - g.gy, g.hx - g.gx);
      for (let i = 0; i <= 30; i++) { const a = a1 - sgn * (1 - i / 30) * 1.9; pts.push({ x: g.gx + Math.cos(a) * r, y: g.gy + Math.sin(a) * r }); }
      return pts;
    };
    const fig = { w: size, h: size, cx, cy, R, t: o.t ?? 3.1, unit: 1, scale: 1, cap: 1e9, paused: false, speed: 3, pulse: 0, glow: 0.12, showTrail: true, trailGain: 0.5,
      lead: { hx: A.hx, hy: A.hy, dx: A.dx, dy: -A.dy }, second: { hx: B.hx, hy: B.hy, dx: B.dx, dy: -B.dy },
      hLead: { x: 0.45, y: -0.5 }, hSecond: { x: -0.45, y: -0.5 }, trail: arc(A, 1), trail2: arc(B, -1) };
    // dx/dy in the scene are SCREEN-space (y down): the club points up, so dy is negative; mk() already built it that way
    fig.lead.dy = A.dy; fig.second.dy = B.dy;
    world.setIcon?.(true);
    // icon light: a tight warm spot on the athlete so the courtyard falls into shadow, a teal rim from behind
    scene.environmentIntensity = 0.24; stage.lights.hemi.intensity = 0.3; stage.lights.key.intensity = 0.7; stage.renderer.toneMappingExposure = 1.2; stage.lights.rim.intensity = 2.6; stage.lights.rim.position.set(-3, 3, -2.5);
    if (!iconFrame.spot) {
      const sp = new THREE.SpotLight(0xffe0b0, 120, 14, 0.42, 0.85, 1.6); sp.position.set(2.2, 3.6, 4.6); sp.target.position.set(0, 1.4, 0.2);
      scene.add(sp, sp.target); iconFrame.spot = sp;
    }
    for (let i = 0; i < 40; i++) { fig.t += 0.05; renderFrame(fig, 0.05); }
    return canvas;
  }
  return { ok: true, stage, human, hooks, world, gov, scene, off3, sm, hands, clubs, iconFrame };
}
