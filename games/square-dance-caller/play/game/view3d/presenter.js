// Square Dance Caller 3D presenter (game-owned). It ONLY READS the game (floorFrame: the floor rectangle, the dancers and the call being danced,
// handed over by the 2D drawing code in the same frame) and draws the hall with the shared view3d layer: eight real-looking people on a plank
// floor, seen from a high three-quarter camera. Where each dancer is comes from the deterministic sim; the feet are scrubbed from the distance
// walked, so a still frame (store shot, pause) is exactly as correct as a running one and nothing ever slides.
import { fitCamera, FOV, S, HALF } from '../src/geo3d.js';
import { floorFrame, paintBoards, LOOKS, drawRoom } from '../src/scene.js';
import { COUPLES } from '../src/consts.js';
import { slotPos, dancerAt } from '../src/sim.js';
import { CALL_BY_ID, SWING } from '../src/consts.js';
import { setCredits } from '../src/credits.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKIN = ['#e9bf9c', '#d9a07a', '#b57a52', '#7d4e32', '#e8b48f', '#9a6a45', '#f1cdb0', '#6a3f27'];
const HAIR = ['#3a2416', '#6b4120', '#c79d55', '#1c1818', '#8b8b92', '#5a2e1a', '#d8b36a', '#2a1f33'];
const WALK_STRIDE = 1.5;            // metres per cycle of the library walk
const ARM = 0.62;                    // reach of an arm from the shoulder, metres

export async function createPresenter({ kitCanvas, quality = 'medium' }) {
  const off = { ok: false, wrap: (g) => g };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D floor', e); return off; }
  const { createStage, loadHuman, THREE } = V3;

  // room (2D, behind) + WebGL (transparent, middle) + kit canvas (top, input and HUD)
  const bg = document.createElement('canvas'), canvas = document.createElement('canvas');
  for (const c of [bg, canvas]) c.setAttribute('aria-hidden', 'true');
  const base = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;';
  bg.style.cssText = base + 'z-index:0;visibility:hidden';
  canvas.style.cssText = base + 'z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(bg, kitCanvas);
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadowSize: 4.2, fov: 31, transparent: true });
  if (!stage.supported) { bg.remove(); canvas.remove(); return off; }
  const scene = stage.scene, camera = stage.camera;
  camera.near = 1; camera.far = 60; camera.fov = (FOV * 180) / Math.PI; camera.updateProjectionMatrix();
  stage.setLighting('indoor', { hemiSky: 0xfff0d8, hemiGround: 0x5a3a24, hemi: 1.0, key: 0xffe2b0, keyI: 2.5, rim: 0x9fb4ff, rimI: 0.9, exposure: 1.05 });
  stage.lights.key.position.set(2.5, 7, 4.5); stage._shadowOffset.set(2.5, 7, 4.5);
  scene.background = null; scene.fog = null;      // the room is the 2D canvas behind
  const world = new THREE.Group(); scene.add(world);

  // ------------------------------------------------------------------ the floor: a plank slab painted by the 2D code, home rings, ghosts
  const floorTex = new Map();
  const floorTexFor = (look) => {
    const k = look % LOOKS.length;
    let t = floorTex.get(k);
    if (!t) {
      const c = document.createElement('canvas'); c.width = c.height = 1024;
      paintBoards(c.getContext('2d'), 1024, k);
      t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      floorTex.set(k, t);
    }
    return t;
  };
  const FW = 2 * HALF * S;
  const topMat = new THREE.MeshStandardMaterial({ map: floorTexFor(0), roughness: 0.8, metalness: 0, transparent: true, alphaTest: 0.45 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x4d2f17, roughness: 0.9 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(FW, 0.16, FW), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  slab.position.y = -0.08; slab.receiveShadow = true; world.add(slab);
  {   // soft contact shadow under the slab
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 20, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(FW * 1.35, FW * 1.35), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = -0.17; world.add(m);
  }
  // chalk rings, one per home place (colour of the couple), a dashed outer ring, a glow when the dancer is home, and the place label
  const labelTex = (txt, col) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d'); g.font = '800 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 9; g.lineJoin = 'round'; g.strokeStyle = 'rgba(30,14,50,0.9)'; g.strokeText(txt, 64, 34); g.fillStyle = col; g.fillText(txt, 64, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const dashTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d'); g.strokeStyle = '#fff'; g.lineWidth = 9; g.setLineDash([22, 20]); g.beginPath(); g.arc(128, 128, 118, 0, TAU); g.stroke();
    return new THREE.CanvasTexture(c);
  })();
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(255,240,170,0.85)'); r.addColorStop(1, 'rgba(255,240,170,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const flat = (geo, mat, x, z, y = 0.004) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = 2; world.add(m); return m; };
  const rings = [];
  for (let slot = 0; slot < 8; slot++) {
    const sp = slotPos(slot), cp = COUPLES[slot >> 1], x = sp.x * S, z = -sp.y * S;
    const ring = flat(new THREE.RingGeometry(0.3, 0.355, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(cp.col), transparent: true, opacity: 0.9, depthWrite: false }), x, z);
    const dash = flat(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: dashTex, transparent: true, opacity: 0.55, depthWrite: false }), x, z, 0.005);
    const glow = flat(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), x, z, 0.006);
    const lab = flat(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: labelTex(`${cp.n}${slot & 1 ? 'L' : 'G'}`, cp.light), transparent: true, depthWrite: false }), x, z + 0.58, 0.007);
    rings.push({ ring, dash, glow, lab });
  }
  const ghosts = [];
  for (let i = 0; i < 8; i++) {
    const m = flat(new THREE.CircleGeometry(0.26, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0, 0.008);
    m.visible = false; ghosts.push(m);
  }

  // ------------------------------------------------------------------ the people
  const procedural = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } }); return g; };
  // a surface of revolution about +Y from [radius, y] points (the bundled three.js has no LatheGeometry)
  const latheGeo = (pts, seg = 40) => {
    const n = pts.length, pos = new Float32Array((seg + 1) * n * 3), nor = new Float32Array((seg + 1) * n * 3), idx = [];
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * TAU, c = Math.cos(a), sn = Math.sin(a);
      for (let i = 0; i < n; i++) {
        const [r, y] = pts[i], [r0, y0] = pts[Math.max(0, i - 1)], [r1, y1] = pts[Math.min(n - 1, i + 1)];
        let tx = r1 - r0, ty = y1 - y0; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;       // tangent (r, y); normal = (ty, -tx)
        const o = (j * n + i) * 3;
        pos[o] = r * c; pos[o + 1] = y; pos[o + 2] = r * sn;
        nor[o] = ty * c; nor[o + 1] = -tx; nor[o + 2] = ty * sn;
        if (j < seg && i < n - 1) { const a0 = j * n + i, b0 = (j + 1) * n + i; idx.push(a0, b0, a0 + 1, b0, b0 + 1, a0 + 1); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  };
  const stdMat = (c, r = 0.8) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, side: THREE.DoubleSide });
  function worldAligned(h, boneName, restName) {   // a group that follows the bone but is oriented like the avatar at rest (world up / forward / left)
    const bone = h.bones[`Bip01_${boneName}`], q = (h._restQ[restName] || bone.getWorldQuaternion(new THREE.Quaternion())).clone().invert();
    const g = new THREE.Group(); g.quaternion.copy(q);
    bone.add(g);
    return { g, bone, q };
  }
  function addHat(h, cp) {
    const { g } = worldAligned(h, 'Head', 'Head');
    const f = h.boneFrame('Head'), box = h.headBox;
    const c = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0.07, 0, 0);
    const upExt = box ? Math.max(box.max.dot(f.up), box.min.dot(f.up)) : 0.2;
    const top = c.clone().addScaledVector(f.up, upExt - c.dot(f.up));
    g.position.copy(top).addScaledVector(f.up, -0.105);
    const prof = [[0.0001, 0.145], [0.06, 0.147], [0.105, 0.135], [0.123, 0.105], [0.127, 0.045], [0.129, 0.0], [0.16, -0.004], [0.195, 0.006], [0.215, 0.03], [0.219, 0.048], [0.21, 0.042], [0.19, 0.016], [0.16, 0.006], [0.131, 0.012]];
    const felt = new THREE.Mesh(latheGeo(prof, 36), stdMat(0xe9d8a6, 0.9));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.131, 0.034, 30, 1, true), stdMat(new THREE.Color(cp.col).getHex(), 0.7));
    band.position.y = 0.026;
    const hat = new THREE.Group(); hat.add(felt, band);
    // the hat sits a touch tilted back, as worn
    hat.rotation.x = -0.1; hat.scale.setScalar(1);
    g.add(procedural(hat));
    return hat;
  }
  // shirt sleeves and denim legs: tubes riding on the arm / leg bones (the base athlete wears a vest and shorts)
  const seg = (bone, child, ra, rb, m, { from = 0, to = 1 } = {}) => {
    const dir = child.position.clone(), len = dir.length(); dir.normalize();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rb, ra, len * (to - from), 18, 1, true), m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); mesh.position.copy(dir).multiplyScalar(len * (from + to) / 2);
    mesh.castShadow = true; bone.add(mesh); return mesh;
  };
  function addSleeves(h, hex, { long = true, r0 = 0.068, r1 = 0.057, r2 = 0.046 } = {}) {
    const m = stdMat(hex, 0.85);
    for (const s of ['L', 'R']) {
      const up = h.bones[`Bip01_${s}_UpperArm`], fo = h.bones[`Bip01_${s}_Forearm`], hand = h.bones[`Bip01_${s}_Hand`];
      // (radius at the parent end, radius at the child end)
      seg(up, fo, r0, r1, m, { from: 0.0, to: long ? 1.0 : 0.66 });
      const ball = (bone, r, at) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m); b.position.copy(at); b.castShadow = true; bone.add(b); };
      ball(up, r0 * 0.98, new THREE.Vector3());            // shoulder cap
      if (long) { seg(fo, hand, r1, r2, m, { from: 0.0, to: 0.9 }); ball(fo, r1 * 0.98, new THREE.Vector3()); }   // elbow
      else ball(up, r1 * 1.02, fo.position.clone().multiplyScalar(0.66));
    }
  }
  function addDenim(h, hex) {
    const m = stdMat(hex, 0.9);
    for (const s of ['L', 'R']) {
      const th = h.bones[`Bip01_${s}_Thigh`], ca = h.bones[`Bip01_${s}_Calf`], fo = h.bones[`Bip01_${s}_Foot`];
      seg(th, ca, 0.125, 0.1, m, { from: 0.0, to: 1.0 });
      seg(ca, fo, 0.1, 0.068, m, { from: 0.0, to: 0.97 });
      const kn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), m); kn.castShadow = true; ca.add(kn);
    }
  }
  function addSkirt(h, cp) {
    const { g, bone } = worldAligned(h, 'Pelvis', null);
    h.root.updateMatrixWorld(true);
    const wp = bone.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0)), wq = bone.getWorldQuaternion(new THREE.Quaternion());
    g.quaternion.copy(wq.invert());
    g.position.copy(bone.worldToLocal(wp.clone()));
    const lathe = (pts, col, r = 0.85) => new THREE.Mesh(latheGeo(pts, 44), stdMat(col, r));
    const skirt = lathe([[0.12, 0.0], [0.16, -0.06], [0.22, -0.14], [0.29, -0.26], [0.35, -0.4], [0.39, -0.52], [0.405, -0.62]], new THREE.Color(cp.col).getHex());
    const under = lathe([[0.13, -0.04], [0.2, -0.2], [0.3, -0.42], [0.38, -0.58], [0.43, -0.68], [0.44, -0.7]], 0xfff6e4, 0.95);
    under.position.y = -0.01;
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.012, 6, 44), stdMat(new THREE.Color(cp.light).getHex(), 0.8)); hem.rotation.x = Math.PI / 2; hem.position.y = -0.62;
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.122, 0.13, 0.05, 28, 1, true), stdMat(new THREE.Color(cp.dark).getHex(), 0.7)); sash.position.y = 0.02;
    const sk = new THREE.Group(); sk.add(under, skirt, hem, sash);
    g.add(procedural(sk));
    return sk;
  }
  const people = new Array(8);
  try {
    await Promise.all(Array.from({ length: 8 }, async (_, id) => {
      const cp = COUPLES[id >> 1], lady = (id & 1) === 1;
      const kit = lady
        ? { top: '#fdf1dc', bottoms: '#eadfc6', socks: '#fdf6e8', shoes: '#3b2416' }
        : { top: cp.col, bottoms: '#2a3a5c', socks: '#e8e0d0', shoes: '#4a2c16' };
      const h = await loadHuman({ character: lady ? 'athlete_f' : 'athlete_m', kit, skin: SKIN[(id * 3 + 1) % SKIN.length], hair: HAIR[(id * 5 + 2) % HAIR.length] });
      h.footPlanting = false; h.groundClamp = 'off'; h.turnRate = 9;
      stage.add(h); stage.track(h);
      let extra;
      if (lady) { extra = addSkirt(h, cp); addSleeves(h, 0xfdf1dc, { long: false, r0: 0.07, r1: 0.062 }); }
      else { addDenim(h, 0x2a3a5c); addSleeves(h, new THREE.Color(cp.col).getHex(), { r0: 0.088, r1: 0.074, r2: 0.058 }); extra = addHat(h, cp); }
      people[id] = { h, lady, cp, extra, odo: 0, prev: null, wR: 0, wL: 0, mode: 'idle', seed: id * 0.37 };
    }));
  } catch (e) { console.warn('view3d people failed to load; using the 2D floor', e); stage.dispose(); bg.remove(); canvas.remove(); return off; }
  for (const p of people) p.h.play('idle_relaxed', { loop: true });

  // ------------------------------------------------------------------ pose helpers
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const wpos = (d) => v3(d.x * S, 0, -d.y * S);                 // floor -> world
  const yawOf = (face) => Math.atan2(Math.cos(face), -Math.sin(face));   // sim heading (math angle, y up) -> avatar yaw (0 faces +Z)
  const fwdOf = (yaw) => v3(Math.sin(yaw), 0, Math.cos(yaw));
  const leftOf = (yaw) => v3(Math.cos(yaw), 0, -Math.sin(yaw));
  const clipOf = (h, name) => h.getClip(name);
  let frameDt = 0;
  // scrub a looping clip at a time (never advances by itself)
  const scrub = (p, name, time, fade = 0.18) => {
    const h = p.h, clip = clipOf(h, name);
    let tr = h.layers.base.current;
    if (!tr || tr.clip !== clip) { h.play(name, { fade: frameDt > 0 ? fade : 0, loop: true }); tr = h.layers.base.current; }
    tr.speed = 0; tr.time = ((time % clip.dur) + clip.dur) % clip.dur;
  };
  // set one hand: target point (or null), elbow pole; weight eases in and out
  const reach = (p, side, pt, pole, dt, rate = 7) => {
    const k = side === 'L' ? 'wL' : 'wR', goal = pt ? 1 : 0;
    p[k] = dt > 0 ? p[k] + (goal - p[k]) * Math.min(1, dt * rate) : goal;
    if (pt) p['pt' + side] = pt; if (pole) p['po' + side] = pole;
    const w = p[k];
    if (w > 0.02 && p['pt' + side]) p.h.setReach(side, p['pt' + side], { weight: w, pole: p['po' + side] || null });
    else p.h.setReach(side, null);
  };
  const shoulderOf = (pos, yaw, side) => pos.clone().addScaledVector(leftOf(yaw), side === 'L' ? 0.2 : -0.2).add(v3(0, 1.4, 0));
  const poleFor = (pos, yaw, side, target) => {
    const sh = shoulderOf(pos, yaw, side), mid = sh.clone().lerp(target, 0.5);
    return mid.add(v3(0, -0.3, 0)).addScaledVector(leftOf(yaw), side === 'L' ? 0.18 : -0.18);
  };

  // pose everything for one frame of the floor
  const pathLen = (call, a, b, u0, u1) => {   // metres walked by the dancer going from slot a to slot b between phrase times u0..u1
    let d = 0, prev = dancerAt(call, a, b, u0);
    for (let k = 1; k <= 24; k++) { const q = dancerAt(call, a, b, u0 + (u1 - u0) * k / 24); d += Math.hypot(q.x - prev.x, q.y - prev.y) * S; prev = q; }
    return d;
  };
  function poseAll(info, dt, t) {
    const D = info.dancers, n = D.length;
    const dancing = info.phase === 'dance' && !!info.callId;
    const fin = info.phase === 'fin';
    const call = dancing ? CALL_BY_ID[info.callId] || (info.callId === SWING.id ? SWING : null) : null;
    const kind = call ? call.kind : null;
    const P = D.map((d) => wpos(d)), Y = D.map((d) => yawOf(d.face));
    if (kind === 'swing') {   // a swing is danced close: the pair draws in towards its middle (presentation only)
      for (let a = 0; a < n; a += 2) {
        const mid = P[a].clone().add(P[a + 1]).multiplyScalar(0.5);
        for (const i of [a, a + 1]) P[i].copy(mid).addScaledVector(P[i].clone().sub(mid), 1.0);
      }
    }
    // distance walked: continuous after the first frame; a first frame mid-phrase starts from the path walked so far (so a still is a real pose)
    for (let i = 0; i < n; i++) {
      const p = people[D[i].id], pos = P[i];
      if (!p.prev || dt > 0.5) {
        let odo = p.seed * 3, v = 0;
        if (call && info.u > 0) {
          const a = i, b = call.to[a];
          odo += pathLen(call, a, b, 0, info.u);
          const u0 = Math.max(0, info.u - 0.02), u1 = Math.min(1, info.u + 0.02);
          v = pathLen(call, a, b, u0, u1) / Math.max(1e-3, (u1 - u0) * (info.dur || 4));
        }
        p.odo = odo; p.v = v; p.prev = pos.clone();
      } else {
        const step = pos.distanceTo(p.prev);
        if (step < 0.9) p.odo += step;
        p.v = dt > 0 ? p.v + ((step / dt) - p.v) * Math.min(1, dt * 10) : p.v;
        p.prev.copy(pos);
      }
    }
    // partners by position: mutual nearest within a metre, whoever they are (home couples, couples walking together, a promenade)
    const mate = new Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      let best = -1, bd = 1.1;
      for (let j = 0; j < n; j++) if (j !== i) { const d = P[i].distanceTo(P[j]); if (d < bd) { bd = d; best = j; } }
      if (best >= 0) {
        let back = -1, bb = 1.1;
        for (let j = 0; j < n; j++) if (j !== best) { const d = P[best].distanceTo(P[j]); if (d < bb) { bb = d; back = j; } }
        if (back === i) mate[i] = best;
      }
    }
    const hands = D.map(() => ({ L: null, R: null }));
    const sideTo = (i, pt) => (pt.clone().sub(P[i]).dot(leftOf(Y[i])) >= 0 ? 'L' : 'R');
    const midpoint = (i, j, y) => { const m = P[i].clone().add(P[j]).multiplyScalar(0.5); m.y = y; return m; };
    const holdBySide = (i, j, y = 1.0) => {   // inside hands: each dancer uses the hand on the side the other stands
      const m = midpoint(i, j, y);
      hands[i][sideTo(i, P[j])] = m; hands[j][sideTo(j, P[i])] = m.clone();
    };
    const isGent = (i) => (D[i].id & 1) === 0;
    if (fin || info.idle) {
      // celebration or the idle hall: no holds (the idle floor is only a backdrop)
    } else if (!kind) {
      for (let i = 0; i < n; i++) if (mate[i] > i) holdBySide(i, mate[i], 0.92);
    } else if (kind === 'rot') {
      const order = D.map((d, i) => i).sort((i, j) => Math.atan2(D[i].y, D[i].x) - Math.atan2(D[j].y, D[j].x));
      order.forEach((i, k) => {
        const nb = [order[(k + 1) % n], order[(k + n - 1) % n]];
        nb.sort((a, b) => fwdOf(Y[i]).dot(P[b].clone().sub(P[i])) - fwdOf(Y[i]).dot(P[a].clone().sub(P[i])));   // ahead first
        const sA = sideTo(i, P[nb[0]]);
        hands[i][sA] = midpoint(i, nb[0], 1.12);
        hands[i][sA === 'L' ? 'R' : 'L'] = midpoint(i, nb[1], 1.12);
      });
    } else if (kind === 'swing') {
      for (let a = 0; a < n; a += 2) {
        const g = isGent(a) ? a : a + 1, l = g === a ? a + 1 : a;
        const mid = P[a].clone().add(P[a + 1]).multiplyScalar(0.5);
        const away = P[g].clone().sub(P[l]).setY(0).normalize();
        // ballroom hold: his right hand at her back, her left hand on his arm, the other two hands joined out to the side
        hands[g].R = P[l].clone().addScaledVector(away, -0.16).setY(1.18);
        hands[l].L = P[g].clone().addScaledVector(leftOf(Y[g]), -0.2).setY(1.38);
        const out = mid.clone().addScaledVector(rightOfPair(P[g], P[l], Y[g]), 0.5); out.y = 1.33;
        hands[g].L = out; hands[l].R = out.clone();
      }
    } else if (kind === 'star') {
      for (let i = 0; i < n; i++) if (isGent(i)) hands[i].L = v3(0, 1.28, 0).addScaledVector(P[i].clone().setY(0).normalize(), 0.1);
    } else if (kind === 'chain') {
      for (let a = 0; a < n; a++) {
        const b = call.to[a];
        if (b === a) continue;                       // a lady who crosses; the gents hold their places
        const j = b;                                 // the lady she meets in the middle starts on the slot she is going to
        const d = P[a].distanceTo(P[j]);
        if (info.u < 0.7 && d < 1.7) hands[a].R = midpoint(a, j, 1.12);
        else if (info.u >= 0.7) {                    // courtesy turn: she takes the hand of the gent she arrives beside, and he gives his
          const g = b ^ 1;
          holdBySide(a, g, 1.05);
        }
      }
    } else if (kind === 'grand') {
      if (info.u < 0.62) {
        for (let i = 0; i < n; i++) {
          let best = -1, bd = 1.15;
          for (let j = 0; j < n; j++) if (j !== i && fwdOf(Y[i]).dot(fwdOf(Y[j])) < -0.2) { const d = P[i].distanceTo(P[j]); if (d < bd) { bd = d; best = j; } }
          if (best >= 0) hands[i][sideTo(i, P[best])] = midpoint(i, best, 1.08);
        }
      } else for (let i = 0; i < n; i++) if (mate[i] > i) holdBySide(i, mate[i], 0.98);
    } else if (kind === 'rlt' || kind === 'sashay') {
      for (let i = 0; i < n; i++) if (mate[i] > i) holdBySide(i, mate[i], 0.98);
    }

    // ---- apply: legs from the distance walked, arms from the holds, head towards the partner
    for (let i = 0; i < n; i++) {
      const d = D[i], p = people[d.id], h = p.h, pos = P[i];
      h.setPosition(pos.x, 0, pos.z);
      h.setFacing(Y[i], { snap: dt <= 0 || p.fresh !== false });
      p.fresh = false;
      const moving = p.v > 0.14 && !fin;
      if (fin) scrub(p, 'celebrate_2', t * 1.0 + p.seed * 2);
      else if (moving) scrub(p, 'walk', (p.odo / WALK_STRIDE) * clipOf(h, 'walk').dur + clipOf(h, 'walk').events.footL, 0.2);
      else scrub(p, 'idle_relaxed', t * 0.9 + p.seed * 5);
      for (const side of ['L', 'R']) {
        let pt = hands[i][side];
        // a lady with a free hand holds her skirt
        if (!pt && p.lady && !fin && !info.idle) pt = pos.clone().addScaledVector(leftOf(Y[i]), side === 'L' ? 0.4 : -0.4).addScaledVector(fwdOf(Y[i]), 0.06).setY(0.74);
        const pole = pt ? poleFor(pos, Y[i], side, pt) : null;
        reach(p, side, pt, pole, dt);
        h.setFingers(side, pt && hands[i][side] ? 'relaxed' : 'relaxed');
      }
      // look at the partner when there is one, else a little ahead
      const m = mate[i];
      const look = m >= 0 ? P[m].clone().setY(1.55) : pos.clone().addScaledVector(fwdOf(Y[i]), 3).setY(1.5);
      h.lookAt(look, { weight: 0.7, maxYaw: 1.0 });
      // the skirt swirls with the walking pace
      if (p.lady) { const k = 1 + 0.07 * Math.min(1.6, p.v) + (kind === 'swing' ? 0.06 : 0) + (fin ? 0.05 * Math.sin(t * 6 + i) : 0); p.extra.scale.set(k, 1, k); }
    }
  }
  const rightOfPair = (pg, pl, yawG) => {   // the open side of a swinging pair: away from the line joining the two, on the gent's left
    const l = leftOf(yawG);
    const d = pl.clone().sub(pg).setY(0);
    const perp = v3(-d.z, 0, d.x).normalize();
    return perp.dot(l) >= 0 ? perp : perp.multiplyScalar(-1);
  };

  // ------------------------------------------------------------------ camera, rings, frame
  const dbg = { cam: null };
  let lastT = null, frames = 0, slow = 0, tier = quality, prevNow = 0, gameRef = null, shownLook = -1, bgTick = 0, wasShown = false;
  const ringUpdate = (info) => {
    for (let s = 0; s < 8; s++) {
      const lit = !!(info.lit && info.lit[s]);
      rings[s].glow.visible = lit; rings[s].ring.material.opacity = lit ? 1 : 0.85;
    }
    const g = info.ghosts;
    for (let i = 0; i < 8; i++) {
      const m = ghosts[i];
      if (g && g[i] && !info.idle) {
        const sp = slotPos(g[i].slot), cp = COUPLES[g[i].id >> 1];
        m.visible = true; m.position.x = sp.x * S; m.position.z = -sp.y * S; m.material.color.set(cp.col);
      } else m.visible = false;
    }
  };
  function frame(game, view) {
    const ff = floorFrame, st = game.getState();
    const show = ff.drawn && ff.R && ff.info && st.has3d;
    ff.drawn = false;
    if (!show) {
      if (wasShown) { canvas.style.visibility = 'hidden'; bg.style.visibility = 'hidden'; wasShown = false; }
      lastT = null;
      return;
    }
    if (!wasShown) { canvas.style.visibility = 'visible'; bg.style.visibility = 'visible'; wasShown = true; }
    const R = ff.R, info = ff.info, cw = window.innerWidth, ch = window.innerHeight, s = cw / Math.max(1, view.width);
    // the room behind (2D), every other frame
    if (((bgTick++) & 1) === 0) {
      const sc = Math.min(1.5, Math.max(0.5, (window.devicePixelRatio || 1)));
      const bw = Math.round(view.width * sc), bh = Math.round(view.height * sc);
      if (bg.width !== bw || bg.height !== bh) { bg.width = bw; bg.height = bh; }
      const c = bg.getContext('2d'); c.setTransform(sc, 0, 0, sc, 0, 0);
      drawRoom(c, view.width, view.height, info.look, info.time, info.beat);
    }
    const look = info.look % LOOKS.length;
    if (look !== shownLook) { topMat.map = floorTexFor(look); topMat.needsUpdate = true; shownLook = look; }
    // camera: fitted to the floor rectangle that the 2D layout reserved
    const cam = fitCamera(R.w, R.h);
    camera.fov = (FOV * 180) / Math.PI; camera.aspect = R.w / R.h;
    camera.position.set(cam.C[0], cam.C[1], cam.C[2]); camera.lookAt(cam.T[0], cam.T[1], cam.T[2]);
    camera.setViewOffset(R.w * s, R.h * s, -R.x * s, -R.y * s, cw, ch);
    if (dbg.cam) { camera.clearViewOffset(); camera.aspect = cw / ch; camera.fov = dbg.cam.fov || 30; camera.position.set(...dbg.cam.pos); camera.lookAt(...dbg.cam.look); }
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    let dt = lastT === null ? 0 : st.t - lastT; lastT = st.t; dt = clamp(dt, 0, 0.1);
    frameDt = dt;
    ringUpdate(info);
    poseAll(info, dt, st.t);
    stage.setShadowTarget(0, 0, 0);
    stage.update(dt);
    frames += 1;
    const now = performance.now();
    if (frames > 30 && frames < 900 && prevNow) {
      if (now - prevNow > 34) slow += 1; else slow = Math.max(0, slow - 0.25);
      if (slow > 24 && tier !== 'low') { tier = tier === 'high' ? 'medium' : 'low'; stage.setQuality(tier); slow = 0; }
    }
    prevNow = now;
  }
  stage.onContextLost(() => { gameRef?.setStage3d?.(false); canvas.style.visibility = 'hidden'; bg.style.visibility = 'hidden'; wasShown = false; });
  stage.onContextRestored(() => { gameRef?.setStage3d?.(true); stage.invalidate(); });
  fetch(new URL('../vendor3d/LICENSES.md', import.meta.url)).then((r) => (r.ok ? r.text() : '')).then((txt) => { if (txt) setCredits(txt); }).catch(() => {});
  if (new URLSearchParams(location.search).has('dev')) window.__sd3 = { stage, people, dbg, THREE, camera, get tier() { return tier; } };
  return {
    ok: true, stage, people, dbg,
    get tier() { return tier; },
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); frame(game, view || { width: ctx.canvas.width, height: ctx.canvas.height }); };
      gameRef = game;
      game.setStage3d?.(true);
      return game;
    },
  };
}
