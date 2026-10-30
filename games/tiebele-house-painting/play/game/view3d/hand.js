// The painter's hand: a real-proportioned right hand and forearm (view3d/handmesh.js, one smooth surface modelled and meshed in this
// game) holding a chicken-feather brush in a writing grip: the quill pinched between the thumb pad and the index pad, the middle finger
// under it, the quill resting back across the web of the thumb. Loose brass bangles hang on the wrist under gravity and an indigo sleeve
// with a woven cuff covers the arm. It comes in from the lower right in front of the wall, the brush tip follows the stroke with a
// critically damped spring (frame-rate independent), presses into the plaster, and the hand drifts out of view between strokes.
// How the hand holds the brush: the brush is fixed in the grip (never slides): the hand is placed so its pinch sits on the quill at a
// fixed distance behind the tip, its quill axis along the brush. The hand turns about the quill to keep the curled fingers off the
// plaster. Orientation is smoothed (critically damped), so the hand never pops.
import * as V3D from '../vendor3d/index.js';
import { buildHandGeometry, skinMaterial, nailMaterial } from './handmesh.js';

const { THREE } = V3D;
const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t * t * (3 - 2 * t);
const hashf = (i, k) => { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); };

function featherTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.clearRect(0, 0, 64, 256);
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#6b4a2a'); g.addColorStop(0.5, '#caa070'); g.addColorStop(1, '#f1e1c0');
  // vane: an elongated leaf with barbs
  x.fillStyle = g; x.beginPath(); x.moveTo(32, 4);
  x.bezierCurveTo(60, 50, 62, 170, 32, 252); x.bezierCurveTo(2, 170, 4, 50, 32, 4); x.fill();
  x.strokeStyle = 'rgba(70,44,20,0.5)'; x.lineWidth = 1.2;
  for (let y = 20; y < 244; y += 5) { const k = Math.sin((y / 256) * Math.PI), w = 26 * k; x.beginPath(); x.moveTo(32, y); x.lineTo(32 - w, y + 18); x.moveTo(32, y); x.lineTo(32 + w, y + 18); x.stroke(); }
  x.strokeStyle = '#4a3018'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 256); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const SKINS = { deep: '#5e3a26', brown: '#7a4a30', tan: '#9a6a48' };

export async function createPainter({ scene }) {
  const qs = new URLSearchParams(location.search);
  let H;
  try { H = await buildHandGeometry({ skin: SKINS[qs.get('skin')] || SKINS.deep }); } catch (e) { console.warn('painter hand build failed', e); return null; }
  const root = new T.Group(); root.visible = false; scene.add(root);
  const mesh = new T.Mesh(H.geometry, skinMaterial());
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const nails = new T.Mesh(H.nailGeometry, nailMaterial()); nails.receiveShadow = true; nails.frustumCulled = false;
  root.add(mesh, nails);

  // ---- sleeve: indigo strip-woven cloth from 12 cm up the forearm, a cream and ochre woven border at the cuff
  const cloth = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#26397a'; x.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 3000; i++) { x.fillStyle = hashf(i, 1) < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'; x.fillRect(hashf(i, 2) * 128, hashf(i, 3) * 256, 1, 4); }
    x.fillStyle = '#efe2c0'; x.fillRect(0, 250, 128, 6); x.fillStyle = '#d7a13a'; x.fillRect(0, 238, 128, 5); x.fillStyle = '#efe2c0'; x.fillRect(0, 228, 128, 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
  })();
  const SLEEVE_AT = 0.115, SLEEVE_LEN = 1.4;
  const sleeve = new T.Mesh(new T.CylinderGeometry(0.085, 0.046, SLEEVE_LEN, 28, 1, true), cloth); sleeve.castShadow = true; sleeve.visible = false; scene.add(sleeve);
  const cuff = new T.Mesh(new T.TorusGeometry(0.046, 0.007, 10, 32), new T.MeshStandardMaterial({ color: '#efe2c0', roughness: 0.9 })); cuff.castShadow = true; cuff.visible = false; scene.add(cuff);

  // ---- bangles: three loose brass rings; each hangs from the top of the wrist under gravity and slides a little with the wrist's motion
  const BANG = [{ R: 0.0322, r: 0.0034 }, { R: 0.0318, r: 0.0028 }, { R: 0.0322, r: 0.0034 }];
  const bangleM = new T.MeshStandardMaterial({ color: '#d9a640', metalness: 0.95, roughness: 0.28, envMapIntensity: 1.6 });
  const bangles = BANG.map((b) => { const m = new T.Mesh(new T.TorusGeometry(b.R, b.r, 12, 40), bangleM); m.castShadow = true; m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
  let at = 0.022;
  const bPos = BANG.map((b, i) => { const s = at + b.r; at += b.r * 2 + 0.0006; return { s0: s, s, v: 0, tilt: (hashf(i, 7) - 0.5) * 0.12 }; });

  // ---- the brush: quill + feather vane (two crossed planes) + the loaded pigment tip. Local -Z runs from the tip back to the hand.
  const QUILL = 0.15, GRIP = 0.139;   // m: quill length; the pinch holds the quill 1 cm from its end
  const brush = new T.Group(); brush.visible = false; scene.add(brush);
  const quill = new T.Mesh(new T.CylinderGeometry(0.0032, 0.0042, QUILL, 10), new T.MeshStandardMaterial({ color: '#e8d8b0', roughness: 0.55 }));
  quill.rotation.x = Math.PI / 2; quill.position.z = -QUILL / 2; quill.castShadow = true;
  const vaneM = new T.MeshStandardMaterial({ map: featherTexture(), alphaTest: 0.35, side: T.DoubleSide, roughness: 0.85 });
  for (const rz of [0, Math.PI / 2.3]) {
    const v = new T.Mesh(new T.PlaneGeometry(0.05, 0.11), vaneM); v.rotation.x = Math.PI / 2; v.rotation.y = rz; v.position.z = -0.042; v.castShadow = true; brush.add(v);
  }
  const loadM = new T.MeshStandardMaterial({ color: '#f3ecd8', roughness: 0.55 });
  const load = new T.Mesh(new T.SphereGeometry(0.0085, 12, 9), loadM); load.scale.set(0.9, 0.9, 2.1); load.position.z = -0.008; brush.add(quill, load);

  // ---- placement
  const P = H.pinch, QA = H.quill.axis, FA = H.forearm;
  const qHand = new T.Quaternion(), qWant = new T.Quaternion(), qTmp = new T.Quaternion(), qTry = new T.Quaternion();
  const UP = new T.Vector3(0, 1, 0), DOWN = new T.Vector3(0, -1, 0), ZN = new T.Vector3(0, 0, -1), Z = new T.Vector3(0, 0, 1), YH = new T.Vector3(0, 1, 0);
  const dirB = new T.Vector3(), qAxisW = new T.Vector3(), pinchW = new T.Vector3(), wrist = new T.Vector3(), tmp = new T.Vector3(), tmp2 = new T.Vector3(), tmp3 = new T.Vector3();
  const armAxis = new T.Vector3(), armY = new T.Vector3(), armZ = new T.Vector3(), g = new T.Vector3(), sideV = new T.Vector3(), lastWrist = new T.Vector3(), vel = new T.Vector3(), sway = new T.Vector3();
  const tipNow = new T.Vector3(), tipVel = new T.Vector3(), target = new T.Vector3(), tgtRaw = new T.Vector3(), tPose = new T.Vector3();
  const tune = { tipPref: new T.Vector3(-0.7, 0.3, -0.65).normalize(), clear: 0.014 };
  const armDir = new T.Vector3();
  // the forearm comes from the lower right, out of the wall; on the title (flat) it lies flatter so the wall shows
  const approachBase = new T.Vector3(0.62, -0.5, 0.6).normalize(), approachFlat = new T.Vector3(0.78, -0.3, 0.55).normalize();
  let presence = 0, presT = 0, started = false, hold = 0, press = 0, pressV = 0, presV = 0, color = 1, flat = 0, roll = 0, first = true;

  // the hand orientation: the forearm along armDir (it reaches in from the lower right, out of the wall), then turned about the forearm
  // so the brush points into the wall and a little up and toward the panel (as far as the wrist allows)
  function orient(out) {
    out.setFromUnitVectors(FA.axis, armDir);
    tmp.copy(QA).negate().applyQuaternion(out); tmp.addScaledVector(armDir, -tmp.dot(armDir)).normalize();
    tmp2.copy(tune.tipPref).addScaledVector(armDir, -tune.tipPref.dot(armDir)).normalize();
    const ang = Math.atan2(tmp3.crossVectors(tmp, tmp2).dot(armDir), tmp.dot(tmp2));
    qTmp.setFromAxisAngle(armDir, ang); out.premultiply(qTmp);
    dirB.copy(QA).applyQuaternion(out);
    return out;
  }
  // lowest finger joint / tip (toward the wall, z) with the hand turned by r about the quill
  function clearance(r) {
    qTry.setFromAxisAngle(dirB, r).multiply(qWant);
    let lo = Infinity;
    for (const p of H.probes) { tmp.copy(p).sub(P.point).applyQuaternion(qTry); lo = Math.min(lo, tmp.z + pinchW.z); }
    return lo;
  }

  function pose(t, dt, sway01) {
    armDir.copy(approachBase).lerp(approachFlat, flat); armDir.x += sway01 * 0.05; armDir.y -= (1 - press) * 0.08; armDir.normalize();
    orient(qWant);
    pinchW.copy(t).addScaledVector(dirB, GRIP);
    // keep the curled fingers off the plaster by turning about the quill (the brush stays in the grip); local search from last frame, eased
    const cost = (r) => Math.max(0, tune.clear - clearance(r)) * 80 + Math.abs(r) * 0.01;
    let best = first ? 0 : roll, bc = cost(best);
    for (let s = 0.4; s > 0.003; s *= 0.5) for (const c of [best + s, best - s]) { const v = cost(c); if (v < bc) { bc = v; best = c; } }
    roll = first ? best : roll + (best - roll) * (1 - Math.exp(-dt * 10));
    qTmp.setFromAxisAngle(dirB, roll); qWant.premultiply(qTmp);
    if (first) qHand.copy(qWant); else qHand.slerp(qWant, 1 - Math.exp(-dt * 12));
    // the brush lies along the hand's own quill axis with its tip on the target, the pinch on the quill: nothing slides
    qAxisW.copy(QA).applyQuaternion(qHand);
    pinchW.copy(t).addScaledVector(qAxisW, GRIP);
    wrist.copy(P.point).applyQuaternion(qHand).multiplyScalar(-1).add(pinchW);
    root.position.copy(wrist); root.quaternion.copy(qHand); root.updateMatrixWorld(true);
    brush.position.copy(t); brush.quaternion.setFromUnitVectors(ZN, qAxisW);
    // forearm, sleeve, cuff
    armAxis.copy(FA.axis).applyQuaternion(qHand); armY.copy(FA.y).applyQuaternion(qHand); armZ.copy(FA.z).applyQuaternion(qHand);
    sleeve.position.copy(wrist).addScaledVector(armAxis, SLEEVE_AT + SLEEVE_LEN / 2); sleeve.quaternion.setFromUnitVectors(UP, armAxis);
    cuff.position.copy(wrist).addScaledVector(armAxis, SLEEVE_AT); cuff.quaternion.setFromUnitVectors(Z, armAxis);
    // bangles: rest on the top of the oval wrist and hang below it, sliding with a damped lag behind the wrist's motion
    vel.copy(wrist).sub(lastWrist).multiplyScalar(1 / Math.max(dt, 1e-3)); if (first) vel.set(0, 0, 0); lastWrist.copy(wrist);
    sway.lerp(vel, 1 - Math.exp(-dt * 7));
    const along = sway.dot(armAxis);
    g.copy(DOWN).addScaledVector(armAxis, -DOWN.dot(armAxis));
    const gl = g.length(); if (gl > 1e-4) g.multiplyScalar(1 / gl); else g.copy(armY).multiplyScalar(-1);
    const gy = g.dot(armY), gz = g.dot(armZ), h = Math.min(dt, 0.05);
    bangles.forEach((b, i) => {
      const p = bPos[i], tgt = p.s0 + clamp(-along * 0.012, -0.004, 0.006) * (1 + i * 0.15);
      if (first) { p.s = tgt; p.v = 0; } else { p.v += ((tgt - p.s) * 260 - p.v * 22) * h; p.s += p.v * h; }
      const ar = H.armRadii(p.s), inner = BANG[i].R - BANG[i].r;
      const hgt = Math.hypot(ar.ry * gy, ar.rz * gz) - ar.yo * gy;
      b.position.copy(wrist).addScaledVector(armAxis, p.s).addScaledVector(g, Math.max(0, inner - hgt));
      b.quaternion.setFromUnitVectors(Z, armAxis);
      qTmp.setFromAxisAngle(sideV.crossVectors(armAxis, g).normalize(), p.tilt); b.quaternion.premultiply(qTmp);
    });
    first = false;
    api.dbg = { wrist: wrist.clone(), dir: qAxisW.clone(), pinch: pinchW.clone(), t: t.clone(), arm: armAxis.clone() };
  }

  const setVis = (v) => { root.visible = brush.visible = v; sleeve.visible = cuff.visible = v && !window.__dbgNoSleeve; for (const b of bangles) b.visible = v; };
  const api = {
    hand: { object: root }, mesh, brush, tip: new T.Vector3(), stats: H.stats, tune,
    // tip: {x,y,z?} world point on the wall or null; color: pigment id loaded on the brush; delta: seconds
    update(tip, dt, clock, o = {}) {
      const want = tip ? 1 : 0;
      hold = tip ? 0.45 : Math.max(0, hold - dt);
      const goal = (want || hold > 0) ? 1 : 0;
      // seconds-scale glide in and out: a critically damped spring, so turning back mid-exit never jolts the arm
      { const w = goal ? 5.5 : 4, ex = Math.exp(-w * dt), e = presT - goal, tm = (presV + w * e) * dt; presT = goal + (e + tm) * ex; presV = (presV - w * tm) * ex; }
      presence = ease(clamp(presT, 0, 1));
      color = o.color || color; flat = o.flat ? 1 : 0;
      loadM.color.set(color === 1 ? '#f3ecd8' : color === 2 ? '#2b2420' : color === 3 ? '#a8442a' : '#f3ecd8');
      if (presence < 0.02 && !goal) { setVis(false); started = false; first = true; presT = Math.max(presT, 0); return; }
      if (tip) {
        tgtRaw.set(tip.x, tip.y, 0.012);
        if (!started) { target.copy(tgtRaw); tipNow.copy(target); tipVel.set(0, 0, 0); started = true; }
        // the spring chases a lightly low-passed target, so a hop to a far cell starts with zero acceleration (no jolt)
        target.lerp(tgtRaw, o.raw ? 1 : 1 - Math.exp(-dt * 38 / (1 + target.distanceTo(tgtRaw) / 0.06)));   // far hops ease in slower
        // exact critically damped spring toward the target (stable at any frame rate)
        const w = o.raw ? 1e4 : 24, ex = Math.exp(-w * dt);
        for (const k of ['x', 'y', 'z']) {
          const e = tipNow[k] - target[k], tm = (tipVel[k] + w * e) * dt;
          tipNow[k] = target[k] + (e + tm) * ex; tipVel[k] = (tipVel[k] - w * tm) * ex;
        }
      }
      // press toward the plaster / lift off it: a critically damped spring (no velocity step when a stroke starts or ends)
      { const goalP = tip ? 1 : 0, w = tip ? 16 : 11, ex = Math.exp(-w * dt), e = press - goalP, tm = (pressV + w * e) * dt; press = goalP + (e + tm) * ex; pressV = (pressV - w * tm) * ex; }
      // lifted away between strokes: hover off the wall toward the lower right
      const away = 1 - ease(presence);
      const hover = (1 - ease(press)) * 0.06 + away * 0.18;
      tPose.set(tipNow.x + away * 0.5, tipNow.y - away * 0.42, 0.012 + hover + away * 0.12);
      pose(tPose, dt, Math.sin(clock * 1.7) * (1 - press));
      api.tip.set(tipNow.x, tipNow.y, 0.012);
      setVis(true);
    },
    get speed() { return tipVel.length(); },
  };
  return api;
}
