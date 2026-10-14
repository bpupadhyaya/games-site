// A real 3D sega dancer (presentation only: it READS the groove numbers the 2D dancer uses and never writes back).
//
// platform/view3d supplies the person (athlete_f), the stage and the skeleton. This file dresses her in a wide layered sega skirt, a cream
// bodice, a sash and a hibiscus in her hair, sways her hips on the beat with two-bone IK (actor.js), waves one arm and holds the skirt out
// with the other, and renders her in an OFF-SCREEN WebGL pass that the 2D scene composites with drawImage. Everything else (drum, beam, pads,
// HUD, shadows) stays 2D. When WebGL2 is missing or the context is lost, art.js drawDancer paints her instead.
import { createStage, loadHuman, THREE } from '../vendor3d/index.js';
import { Actor } from './actor.js';

const { Vector3, Quaternion } = THREE;
const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const mat = (c, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, ...extra });

// ---- skirt cloth texture: v = 0 at the waist, 1 at the hem; u wraps around -------------------------------------------------------------
function skirtTexture() {
  const cv = globalThis.document.createElement('canvas'); cv.width = 1024; cv.height = 512;
  const g = cv.getContext('2d'), W = 1024, H = 512;
  const bands = [[0, 0.46, '#ffe08a', '#f2a21e'], [0.46, 0.74, '#ff8e7a', '#d93a52'], [0.74, 1, '#46e6d0', '#119184']];
  for (const [a, b, c0, c1] of bands) {
    const gr = g.createLinearGradient(0, a * H, 0, b * H); gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.fillRect(0, a * H, W, (b - a) * H + 1);
  }
  // gores and a soft woven grain
  for (let i = 0; i < 40; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)'; g.fillRect((i * W) / 40, 0, W / 40, H); }
  g.strokeStyle = 'rgba(255,255,255,0.42)'; g.lineWidth = 5;
  for (const y of [0.46, 0.74]) { g.beginPath(); g.moveTo(0, y * H); g.lineTo(W, y * H); g.stroke(); }
  g.fillStyle = 'rgba(255,250,235,0.65)';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i + 0.5) * (W / 40), 0.6 * H, 7, 0, TAU); g.fill(); g.beginPath(); g.arc((i + 0.5) * (W / 40), 0.88 * H, 6, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// ---- dressing: rigid pieces parented to bones ---------------------------------------------------------------------------------------------
const wscale = (bone) => bone.getWorldScale(V()).x || 1;
function attachTube(bone, child, r0, r1, m, ext = 0) {
  const ws = wscale(bone);
  const a = bone.getWorldPosition(V()), b = child.getWorldPosition(V());
  const dir = b.clone().sub(a), len = dir.length() / ws; dir.normalize();
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  const ld = dir.clone().applyQuaternion(inv);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1 / ws, r0 / ws, len * (1 + ext), 16, 1), m);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), ld);
  mesh.position.copy(ld).multiplyScalar((len * (1 + ext)) / 2);
  bone.add(mesh);
  return mesh;
}
function attachWorld(bone, obj, worldOff) {      // an object built in world axes (y up, metres) placed at a rest-world offset from the bone
  const ws = wscale(bone);
  const inv = bone.getWorldQuaternion(new Quaternion()).invert();
  obj.position.copy(worldOff.clone().applyQuaternion(inv)).divideScalar(ws);
  obj.quaternion.copy(inv);
  obj.scale.setScalar(1 / ws);
  bone.add(obj);
  return obj;
}

const SEG = 48, RING = 14;
function lathe() {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((SEG + 1) * (RING + 1) * 3), uv = new Float32Array((SEG + 1) * (RING + 1) * 2), idx = [];
  for (let j = 0; j <= RING; j++) for (let i = 0; i <= SEG; i++) { const k = j * (SEG + 1) + i; uv[k * 2] = i / SEG; uv[k * 2 + 1] = 1 - j / RING; }
  for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

async function makeDancer(stage) {
  const h = await loadHuman({ character: 'athlete_f', kit: { top: '#fff4dc', bottoms: '#2a1612', socks: '#c98a58' }, skin: 'tan', hair: 'black' });
  h.groundClamp = 'off'; h.footPlanting = false;
  h.play('idle', { fade: 0 });
  const B = (n) => h.bones[`Bip01_${n}`];
  h.root.updateMatrixWorld(true);
  const actor = new Actor(h);
  const D = { human: h, actor };
  const wp = (n) => B(n).getWorldPosition(V());
  D.pelvisY = wp('Pelvis').y;
  D.sh = { L: wp('L_UpperArm').sub(wp('Pelvis')), R: wp('R_UpperArm').sub(wp('Pelvis')) };
  D.armU = wp('L_UpperArm').distanceTo(wp('L_Forearm'));
  D.armF = wp('L_Forearm').distanceTo(wp('L_Hand'));
  D.stand = D.pelvisY - 0.03;
  D.height = 1.74;
  D.headTop = D.height;

  const bodice = mat('#fff4dc', 0.7), brass = mat('#ffc04d', 0.3, { metalness: 0.5 });
  for (const s of ['L', 'R']) {
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), hd = B(`${s}_Hand`);
    // bangle at each wrist
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 8, 20), brass);
    const ws = wscale(fo);
    const a = fo.getWorldPosition(V()), b = hd.getWorldPosition(V());
    const dir = b.clone().sub(a).normalize(), inv = fo.getWorldQuaternion(new Quaternion()).invert();
    ring.quaternion.setFromUnitVectors(V(0, 0, 1), dir.clone().applyQuaternion(inv));
    ring.position.copy(b.clone().sub(a).multiplyScalar(0.84).applyQuaternion(inv)).divideScalar(ws);
    ring.scale.setScalar(1 / ws);
    fo.add(ring);
    void up;
  }
  // hibiscus behind the left ear (her left = screen right)
  const flower = new THREE.Group();
  const petal = mat('#ff3d56', 0.55);
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 8), petal);
    p.scale.set(1, 0.45, 1); const an = (i / 5) * TAU;
    p.position.set(Math.cos(an) * 0.036, Math.sin(an) * 0.036, 0); p.rotation.z = an;
    flower.add(p);
  }
  const heart = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mat('#ffd37a', 0.4)); heart.position.z = 0.012; flower.add(heart);
  flower.rotation.set(0, -0.5, 0);
  const fw = new THREE.Group(); fw.add(flower);
  attachWorld(B('Head'), fw, V(0.095, 0.115, 0.0));

  // sash (a rolled band at the waist, rebuilt in the skirt update)
  D.sash = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 10, 36), mat('#d93a52', 0.5));
  D.sash.frustumCulled = false; stage.add(D.sash);
  D.skirtGeo = lathe();
  D.skirt = new THREE.Mesh(D.skirtGeo, mat('#ffffff', 0.78, { map: skirtTexture(), side: THREE.DoubleSide }));
  D.skirt.frustumCulled = false; stage.add(D.skirt);
  stage.add(h); stage.track(h);
  void bodice; void attachTube;
  D.setVisible = (v) => { h.root.visible = v; D.skirt.visible = v; D.sash.visible = v; };
  D.setVisible(false);
  return D;
}

// ---- the pose ----------------------------------------------------------------------------------------------------------------------------
// o: { t: seconds of groove time, energy 0..1.2, beat 0..1, bounce 0..1 }.  sway is the same signal the 2D dancer uses.
function pose(D, o, wy, lookAt) {
  const A = D.actor;
  const sway = Math.sin(o.t * Math.PI * 1.0) * (0.4 + o.energy * 0.8);                 // -1.2 .. 1.2
  const sway2 = Math.sin(o.t * Math.PI * 2.0 + 0.6);
  const beatPulse = Math.abs(Math.sin(o.beat * Math.PI));
  const dip = 0.012 + 0.018 * beatPulse + 0.03 * o.bounce;
  const pel = V(sway * 0.045, wy + D.stand - dip, 0);
  const yaw = sway * 0.16;
  // feet planted a hip apart; the weight foot alternates with the sway (a small heel lift on the free side)
  const legs = {};
  const lift = { L: Math.max(0, -sway) * 0.05, R: Math.max(0, sway) * 0.05 };
  for (const s of ['L', 'R']) {
    const sx = s === 'L' ? 1 : -1;
    legs[s] = {
      p: [sx * (0.12 + 0.02 * Math.abs(sway)) - sway * 0.045, A.groundAnkle + lift[s], 0.02 + lift[s] * 1.4], f: 'g', w: 1,
      pole: [sx * 0.15, 0.3, 1], pf: 'g',
      aim: { n: [0, 1, 0], face: 'sole', fwd: [0, 0, 1], w: 1 },
    };
  }
  // arms
  const U = D.armU, F = D.armF, reach = U + F;
  const wv = Math.sin(o.t * Math.PI * 2.0 + 1.2);
  const raise = 0.28 + 0.1 * clamp(o.energy, 0, 1.2);
  const SR = D.sh.R, SL = D.sh.L;
  const handR = [SR.x - 0.16 + 0.09 * wv - sway * 0.03, SR.y + raise + 0.04 * Math.abs(wv), SR.z + 0.07];
  const handL = [0.33 + sway * 0.035, SL.y - 0.46 + 0.02 * sway2, 0.05];
  const cl = (hnd, S) => { const d = V(hnd[0] - S.x, hnd[1] - S.y, hnd[2] - S.z), l = d.length(); if (l > reach * 0.98) d.multiplyScalar((reach * 0.98) / l); return [S.x + d.x, S.y + d.y, S.z + d.z]; };
  const arms = {
    R: { p: cl(handR, SR), f: 'b', w: 1, pole: [-1, -0.25, -0.35], pf: 'b' },
    L: { p: cl(handL, SL), f: 'b', w: 1, pole: [0.8, -0.35, -0.55], pf: 'b' },
  };
  return {
    pelvis: pel, yaw, pitch: 0, roll: 0, groundY: wy,
    torso: { bend: 2 + 3 * beatPulse, side: -sway * 5.5, twist: sway * 4 },
    pelvisTilt: { bend: 0, side: sway * 5, twist: -sway * 3 },
    legs, arms,
    look: { target: lookAt, w: 0.75 },
    headAdd: { pitch: 0, yaw: 0 },
    sway, handR, handL,
  };
}

// ---- the skirt (rebuilt every frame from the live bones) --------------------------------------------------------------------------------
function updateSkirt(D, P, o, wy) {
  const h = D.human, B = (n) => h.bones[`Bip01_${n}`], pos = D.skirtGeo.attributes.position;
  h.root.updateMatrixWorld(true);
  const pel = B('Pelvis').getWorldPosition(V()), sp = B('Spine').getWorldPosition(V());
  const waistY = lerp(pel.y, sp.y, 0.55) + 0.04, waistX = lerp(pel.x, sp.x, 0.55), waistZ = lerp(pel.z, sp.z, 0.55);
  const hemY = wy + 0.09;
  const e = clamp(o.energy, 0, 1.2), sw = P.sway;
  const r0x = 0.165, r0z = 0.14, r1x = 0.5 + 0.1 * e, r1z = 0.46 + 0.1 * e;
  const yawC = Math.cos(P.yaw), yawS = Math.sin(P.yaw);
  const hand = V(P.handL[0], P.handL[1], P.handL[2]);       // body frame of the held side (a small lift of the cloth under the hand)
  for (let j = 0; j <= RING; j++) {
    const s = j / RING;
    const y0 = waistY + (hemY - waistY) * s;
    const hk = Math.min(1, s * 2.4), hipK = hk * hk * (3 - 2 * hk);
    const fl = Math.pow(s, 1.55);
    const rx = r0x + 0.07 * hipK + (r1x - r0x - 0.07) * fl, rz = r0z + 0.065 * hipK + (r1z - r0z - 0.065) * fl;
    // the hem swings against the hips
    const swing = -sw * 0.15 * s * s, cx = lerp(waistX, pel.x, s) + swing, cz = lerp(waistZ, pel.z, s) + 0.03 * Math.min(1, s * 3);
    for (let i = 0; i <= SEG; i++) {
      const a = (i / SEG) * TAU;
      const wave = 1 + s * (0.035 + 0.05 * e) * Math.sin(a * 6 + o.t * 4.5 + sw * 2) + s * 0.02 * Math.cos(a * 10 - o.t * 3);
      let lx = Math.cos(a) * rx * wave, lz = Math.sin(a) * rz * wave, y = y0;
      // scalloped hem
      if (s > 0.92) y += 0.02 * Math.cos(a * 12) * ((s - 0.92) / 0.08);
      // the held side rides out and up under the hand
      const dx = lx - hand.x, dz = lz - 0.02, d2 = dx * dx + dz * dz * 0.5;
      if (s > 0.1 && s < 0.9) { const k = Math.exp(-d2 / 0.05) * Math.sin(s * Math.PI); lx += (lx > 0 ? 1 : 0) * 0.05 * k; y += 0.05 * k; }
      pos.setXYZ(j * (SEG + 1) + i, cx + lx * yawC + lz * yawS, y, cz - lx * yawS + lz * yawC);
    }
  }
  pos.needsUpdate = true; D.skirtGeo.computeVertexNormals();
  D.sash.position.set(waistX, waistY - 0.015, waistZ + 0.03);
  D.sash.rotation.set(Math.PI / 2, 0, -P.yaw);
  D.sash.scale.set(1, 0.84, 1);
}

// ---- the renderer ------------------------------------------------------------------------------------------------------------------------
export async function createDancer({ quality = 'medium' } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'evening', fov: 10 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const cam = stage.camera;
  const api = { stage, ok: true, lost: false, quality, ready: false, off: false };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; fitKey = ''; });
  const D = await makeDancer(stage);
  api.ready = true; api.D = D;
  let fitKey = '', costAvg = 0, costN = 0;
  const fov = 10, tanH = Math.tan((fov / 2) * D2R);

  /** (x, y) = her waist in 2D units, s = 2D scale (1 = 175 units waist to head top), o = { t, energy, beat, bounce }. Returns true when drawn. */
  api.draw = function (ctx, x, y, s, o) {
    if (api.off || api.lost || stage.contextLost || !api.ready) return false;
    const t0 = globalThis.performance.now();
    const ppm = (175 * s) / (D.headTop - D.pelvisY + 0.03);              // 2D units per metre
    const x0 = x - 0.95 * ppm, x1 = x + 0.95 * ppm, y0 = y - (D.headTop - D.pelvisY + 0.22) * ppm, y1 = y + (D.pelvisY + 0.05) * ppm;
    const rw = x1 - x0, rh = y1 - y0, rcx = (x0 + x1) / 2, rcy = (y0 + y1) / 2;
    const m = ctx.getTransform(), pxu = Math.hypot(m.a, m.b);
    const cap = api.quality === 'low' ? 700 : 1100;
    const devW = clamp(Math.round(rw * pxu), 160, cap), devH = Math.max(100, Math.round((devW * rh) / rw));
    const key = `${devW}x${devH}|${rw.toFixed(1)}|${rh.toFixed(1)}`;
    if (key !== fitKey) {
      const r = stage.renderer; r.setPixelRatio(1); r.setSize(devW, devH, false);
      cam.aspect = devW / devH; cam.fov = fov; cam.near = 1; cam.far = 200; cam.updateProjectionMatrix();
      fitKey = key;
    }
    const Dm = rh / ppm / (2 * tanH);
    cam.position.set(0, 0, Dm); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
    const wx = (x - rcx) / ppm, wy = -((y + D.pelvisY * ppm) - rcy) / ppm;          // feet row in world metres
    D.setVisible(true);
    D.human.root.position.set(wx, 0, 0); D.human.root.quaternion.identity();
    const P = pose(D, o, wy, V(wx, wy + 1.55, Dm + 4));
    P.pelvis.x += wx;
    stage.update(0, { renderNow: false });
    D.actor.apply(P, 0);
    D.human.setFingers('L', 'relaxed'); D.human.setFingers('R', 'open');
    D.human.root.updateMatrixWorld(true);
    updateSkirt(D, P, o, wy);
    stage.render();
    ctx.drawImage(stage.renderer.domElement, x0, y0, rw, rh);
    const ms = globalThis.performance.now() - t0;
    costAvg = costN ? costAvg * 0.95 + ms * 0.05 : ms; costN++;
    if (costN > 90 && costAvg > 12 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); fitKey = ''; costN = 0; }
    else if (costN > 120 && costAvg > 20) api.off = true;                   // too slow for this device: the 2D dancer takes over
    return true;
  };
  return api;
}
