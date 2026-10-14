// Horse tack: saddle (western | english | centralasian | ottoman), bridle (headstall, browband, noseband, bit) and reins (ribbons from the bit to the rider's
// hands, or looped over the neck when riderless). Everything is attached to the skeleton (saddle on Spine2, bridle on Head); stirrup irons hang as
// small pendulums and expose `stirrup.L/R.tread` (the point the rider's ankle goes to).
import * as THREE from './three.js';

const V3 = THREE.Vector3;
const lin = (h) => new THREE.Color(h);
function mergeParts(parts) {
  const pos = [], nor = [], col = [], idx = [];
  let base = 0;
  for (const { geo, matrix, color } of parts) {
    const g = geo.clone();
    g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal, c = lin(color);
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i)); else for (let i = 0; i < p.count; i++) idx.push(base + i);
    base += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
const M = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new V3(sx, sy, sz));
const ball = (seg = 14) => new THREE.SphereGeometry(1, seg, Math.max(6, seg >> 1));
const tube = (pts, r, seg = 24, rad = 6) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), seg, r, rad, false);

export const TACK_STYLES = {
  western:      { seatLen: 0.46, cantle: 0.1, horn: true, fender: 0.46, leather: '#6a3e1c', dark: '#2e1b0e', blanket: '#a8322a', trim: '#c8a24a', drop: 0.5 },
  english:      { seatLen: 0.40, cantle: 0.045, horn: false, fender: 0.4, leather: '#4b2c16', dark: '#241309', blanket: '#f2efe8', trim: '#c9c9cf', drop: 0.44, flaps: true },
  centralasian: { seatLen: 0.40, cantle: 0.13, horn: false, wooden: true, fender: 0.0, leather: '#5a3a22', dark: '#2a1b10', blanket: '#b8442a', trim: '#e0b43c', drop: 0.40, felt: true },
  ottoman:      { seatLen: 0.42, cantle: 0.16, horn: false, wooden: true, fender: 0.0, leather: '#7a1f2a', dark: '#3a0f14', blanket: '#1c3f77', trim: '#e0b43c', drop: 0.38, cloth: true },
  jockey:       { seatLen: 0.30, cantle: 0.02, horn: false, fender: 0.0, leather: '#3a2a1c', dark: '#1c120a', blanket: '#e6e1d4', trim: '#c9c9cf', drop: 0.3, flaps: false },
};

export function buildTack(horse, styleName, opts = {}) {
  const S = { ...(TACK_STYLES[styleName] || TACK_STYLES.western), ...(opts || {}) };
  const rest = horse.rest, bones = horse.b;
  const parent = bones.Spine2; const pr = rest.Spine2;
  // back surface under the saddle: top of the body at x~0 around z=0.12
  const bodyM = horse.meshes.find((m) => m.userData.cls === 'body');
  let top = 1.52;
  { const p = bodyM.geometry.attributes.position; let best = -1; for (let i = 0; i < p.count; i++) { if (Math.abs(p.getX(i)) < 0.05 && Math.abs(p.getZ(i) - 0.1) < 0.07) best = Math.max(best, p.getY(i)); } if (best > 0) top = best; }
  const zc = 0.10;
  const root = new THREE.Group(); root.name = 'tack';
  const saddle = new THREE.Group(); saddle.position.set(0, top - pr.y, zc - pr.z); parent.add(saddle);
  // everything below is in the saddle frame: origin on the back at the seat centre, +Z forward, +X left
    // ---- barrel cross-section under the saddle: radius by angle from straight up, measured from the body mesh (so every panel hugs the horse)
  const prof = (() => {
    const pp = bodyM.geometry.attributes.position; let bot = top;
    for (let i = 0; i < pp.count; i++) if (Math.abs(pp.getZ(i) - zc) < 0.07 && Math.abs(pp.getX(i)) < 0.2) bot = Math.min(bot, pp.getY(i));
    const yc = (top + bot) / 2, NB = 36, r = new Array(NB).fill(0);
    for (let i = 0; i < pp.count; i++) {
      if (Math.abs(pp.getZ(i) - zc) > 0.08) continue;
      const dx = Math.abs(pp.getX(i)), dy = pp.getY(i) - yc; const th = Math.atan2(dx, dy), rr = Math.hypot(dx, dy);
      const k = Math.min(NB - 1, Math.floor(th / Math.PI * NB)); if (rr > r[k]) r[k] = rr;
    }
    for (let k = 0; k < NB; k++) if (!r[k]) { let l = k - 1, h = k + 1; while (l >= 0 && !r[l]) l--; while (h < NB && !r[h]) h++; r[k] = l >= 0 && h < NB ? (r[l] + r[h]) / 2 : (r[l] || r[h] || 0.3); }
    const at = (th) => { const f = Math.min(NB - 1.001, Math.max(0, th / Math.PI * NB - 0.5)); const i = Math.floor(f); return r[i] + (r[i + 1] - r[i]) * (f - i); };
    return { yc, at, top };
  })();
  const dtr = Math.PI / 180;
  // panel that follows the barrel: angles t0..t1 (from up), length z0..z1 along the horse, `off` metres outside the hide, rounded corners
  function shell(t0, t1, z0, z1, off, color, round = 0.25, sg = 1) {
    const nt = 10, nz = 8, pos = [], nor = [], idx = [];
    const zm = (z0 + z1) / 2, zh = (z1 - z0) / 2;
    for (let i = 0; i <= nt; i++) for (let j = 0; j <= nz; j++) {
      const th = t0 + (t1 - t0) * i / nt, u = j / nz * 2 - 1;
      const e = Math.abs(i / nt * 2 - 1);                       // 0 at the panel's middle, 1 at the ends
      const f = 1 - round * Math.pow(e, 3);
      const z = zm + u * zh * f - 0.0;
      const r = prof.at(th) + off;
      pos.push(sg * r * Math.sin(th), prof.yc + r * Math.cos(th) - top, z - zc);
      nor.push(sg * Math.sin(th), Math.cos(th), 0);
    }
    for (let i = 0; i < nt; i++) for (let j = 0; j < nz; j++) { const a = i * (nz + 1) + j, b = a + 1, c = a + nz + 1, d = c + 1; if (sg > 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return { geo: g, matrix: new THREE.Matrix4(), color };
  }
  const both = (fn) => [fn(1), fn(-1)];
  const L = lin(S.leather);
  const Lh = S.leather, Dh = S.dark, TRh = S.trim, STEEL = '#bfc3c8';
  const P = [];
  const z0 = zc - zc;   // saddle frame: z = 0 at the seat centre
  const Z = (a, b) => [zc + a, zc + b];
  const sh = (t0, t1, a, b, off, col, rd, sg) => { const [za, zb] = Z(a, b); return shell(t0 * dtr, t1 * dtr, za, zb, off, col, rd, sg); };
  // blanket with a trim border (underlay slightly larger)
  const bl = S.felt || S.cloth ? 0.36 : 0.30, bt = S.felt || S.cloth ? 100 : 88;
  for (const sg of [1, -1]) {
    P.push(sh(0, bt + 3, -bl - 0.012, bl + 0.012, 0.004, S.trim, 0.3, sg));
    P.push(sh(0, bt, -bl, bl, 0.0085, S.blanket, 0.3, sg));
    if (S.felt) P.push(sh(0, bt - 6, -bl + 0.03, bl - 0.03, 0.013, S.blanket, 0.3, sg));
  }
  const isW = styleName === 'western', isE = styleName === 'english', isJ = styleName === 'jockey';
  const sl = S.seatLen / 2;
  // saddle tree
  const seatY = 0.03;
  P.push({ geo: ball(), matrix: M(0, seatY, 0.0, 0, 0, 0, 0.14, 0.035, isJ ? 0.14 : 0.21), color: Lh });                         // seat
  if (isW) {
    P.push({ geo: ball(), matrix: M(0, 0.085, -0.2, -0.45, 0, 0, 0.145, 0.075, 0.04), color: Lh });                                // cantle (upright, dished)
    P.push({ geo: ball(), matrix: M(0, 0.1, -0.215, -0.45, 0, 0, 0.15, 0.015, 0.045), color: TRh });                              // cantle binding
    P.push({ geo: ball(), matrix: M(0, 0.07, 0.17, 0.35, 0, 0, 0.11, 0.075, 0.075), color: Lh });                                // swell / fork
    P.push({ geo: new THREE.CylinderGeometry(0.014, 0.022, 0.09, 12), matrix: M(0, 0.16, 0.18), color: Dh });                      // horn stem
    P.push({ geo: new THREE.CylinderGeometry(0.052, 0.045, 0.02, 16), matrix: M(0, 0.21, 0.18), color: TRh });                    // horn cap
  } else if (isE) {
    P.push({ geo: ball(), matrix: M(0, 0.05, -0.2, -0.3, 0, 0, 0.14, 0.04, 0.035), color: Lh });                                  // low cantle
    P.push({ geo: ball(), matrix: M(0, 0.06, 0.17, 0.4, 0, 0, 0.08, 0.06, 0.05), color: Lh });                                    // pommel
    for (const sg of [1, -1]) P.push({ geo: ball(), matrix: M(sg * 0.17, 0.0, 0.1, 0, 0, sg * -0.3, 0.035, 0.055, 0.1), color: Dh });   // knee rolls
  } else if (styleName === 'centralasian') {
    P.push({ geo: ball(), matrix: M(0, 0.12, 0.2, 0.25, 0, 0, 0.15, 0.13, 0.035), color: Lh });                                   // front arch
    P.push({ geo: ball(), matrix: M(0, 0.13, -0.2, -0.3, 0, 0, 0.16, 0.14, 0.035), color: Lh });                                  // rear arch
    P.push({ geo: ball(), matrix: M(0, 0.2, 0.2, 0.25, 0, 0, 0.1, 0.02, 0.04), color: TRh }); P.push({ geo: ball(), matrix: M(0, 0.24, -0.2, -0.3, 0, 0, 0.1, 0.02, 0.04), color: TRh });
    P.push({ geo: ball(), matrix: M(0, 0.04, 0, 0, 0, 0, 0.16, 0.03, 0.24), color: S.blanket });                                   // seat rug
  } else if (styleName === 'ottoman') {
    P.push({ geo: ball(), matrix: M(0, 0.15, 0.19, 0.3, 0, 0, 0.12, 0.17, 0.04), color: Lh });
    P.push({ geo: ball(), matrix: M(0, 0.17, -0.2, -0.35, 0, 0, 0.16, 0.19, 0.04), color: Lh });
    P.push({ geo: ball(), matrix: M(0, 0.33, 0.19, 0.3, 0, 0, 0.03, 0.03, 0.03), color: TRh }); P.push({ geo: ball(), matrix: M(0, 0.37, -0.2, -0.35, 0, 0, 0.035, 0.035, 0.035), color: TRh });
  }
  // skirts / flaps / fenders: curved panels
  for (const sg of [1, -1]) {
    if (isW) {
      P.push(sh(12, 76, -0.265, 0.255, 0.02, Lh, 0.28, sg));
      P.push(sh(12, 76, -0.272, 0.262, 0.016, TRh, 0.28, sg));                          // edge binding
      P.push(sh(30, 84, -0.1, 0.12, 0.035, Dh, 0.25, sg));                              // fender (stirrup leather cover)
      P.push({ geo: ball(8), matrix: M(sg * (prof.at(46 * dtr) + 0.045) * Math.sin(46 * dtr), prof.yc + (prof.at(46 * dtr) + 0.045) * Math.cos(46 * dtr) - top, 0.1 - 0.0, 0, 0, 0, 0.012, 0.012, 0.012), color: TRh });   // concho
    } else if (isE) {
      P.push(sh(14, 70, -0.16, 0.2, 0.016, Lh, 0.3, sg));                              // saddle flap
      P.push(sh(24, 62, -0.0, 0.17, 0.024, Dh, 0.3, sg));                              // knee panel
    } else if (isJ) {
      P.push(sh(10, 52, -0.12, 0.14, 0.014, Lh, 0.3, sg));
    } else {
      P.push(sh(10, 70, -0.2, 0.2, 0.016, Lh, 0.3, sg));                               // wooden tree side bars
    }
  }
  // girth / cinch: a band under the belly
  for (const sg of [1, -1]) P.push(sh(88, 180, 0.06, 0.15, 0.018, Dh, 0.1, sg));
  P.push({ geo: ball(8), matrix: M(0.1, prof.yc - prof.at(Math.PI) - top + 0.0, 0.1 + 0.0, 0, 0, 0, 0.018, 0.012, 0.018), color: STEEL });   // girth buckle
  const geo = mergeParts(P);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; saddle.add(body);

  // stirrups: leather strap + iron hung from the fender, swinging
  const stirrup = {};
  const sGeo = (() => {
    const pp = [];
    pp.push({ geo: new THREE.BoxGeometry(0.03, 1, 0.012), matrix: M(0, -0.5, 0), color: Lh });                    // leather strap (unit length, scaled below)
    pp.push({ geo: new THREE.TorusGeometry(0.058, 0.009, 6, 18), matrix: M(0, -1.0, 0, 0, Math.PI / 2, 0, 1, 1.15, 1), color: S.wooden ? S.trim : STEEL });
    pp.push({ geo: new THREE.BoxGeometry(0.1, 0.012, 0.075), matrix: M(0, -1.06, 0.0), color: S.wooden ? Dh : STEEL });
    if (isW) pp.push({ geo: new THREE.BoxGeometry(0.1, 0.1, 0.012), matrix: M(0, -1.0, 0.0), color: Dh });         // tapadero hood
    return pp;
  })();
  const thS = 62 * dtr;
  const rS = prof.at(thS) + 0.045;
  const sx = rS * Math.sin(thS), sy = prof.yc + rS * Math.cos(thS) - top;
  const drop = Math.max(0.2, S.drop + sy + 0.04);
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const pivot = new THREE.Group(); pivot.position.set(sg * sx, sy, isW ? 0.0 : 0.0); saddle.add(pivot);
    const g2 = mergeParts(sGeo.map((p) => ({ ...p, matrix: p.matrix.clone().premultiply(new THREE.Matrix4().makeScale(1, drop, 1)) })));
    const mesh = new THREE.Mesh(g2, mat); mesh.castShadow = true; pivot.add(mesh);
    const tread = new THREE.Object3D(); tread.position.set(0, -drop * 1.06, 0); pivot.add(tread);
    stirrup[side] = { pivot, tread, ang: 0, vel: 0, drop };
  }

  // bridle on the head: headstall, browband, cheekpieces, noseband, bit rings
  const head = bones.Head; const hr = rest.Head;
  const hp = (x, y, z) => [x - hr.x, y - hr.y, z - hr.z];
  const bGeo = [];
  const lc = Dh;
  for (const sg of [1, -1]) {
    bGeo.push({ geo: tube([hp(sg * 0.06, 2.17, 1.24), hp(sg * 0.115, 2.0, 1.30), hp(sg * 0.125, 1.86, 1.42), hp(sg * 0.1, 1.77, 1.58)], 0.007, 20, 5), matrix: M(0, 0, 0), color: lc });  // cheekpiece
    bGeo.push({ geo: new THREE.TorusGeometry(0.022, 0.004, 6, 12), matrix: M(...hp(sg * 0.1, 1.76, 1.6), 0, Math.PI / 2, 0), color: STEEL });   // bit ring
  }
  bGeo.push({ geo: tube([hp(-0.1, 2.075, 1.3), hp(0, 2.11, 1.36), hp(0.1, 2.075, 1.3)], 0.008, 12, 5), matrix: M(0, 0, 0), color: lc });         // browband
  bGeo.push({ geo: tube([hp(-0.118, 1.84, 1.46), hp(-0.09, 1.78, 1.6), hp(0, 1.755, 1.64), hp(0.09, 1.78, 1.6), hp(0.118, 1.84, 1.46)], 0.007, 24, 5), matrix: M(0, 0, 0), color: lc });   // noseband
  bGeo.push({ geo: new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6), matrix: M(...hp(0, 1.752, 1.6), 0, 0, Math.PI / 2), color: STEEL });         // bit bar
  bGeo.push({ geo: tube([hp(-0.062, 2.15, 1.22), hp(-0.09, 2.2, 1.12), hp(-0.11, 2.1, 1.02), hp(-0.1, 1.9, 1.0), hp(-0.07, 1.83, 1.2)], 0.006, 16, 5), matrix: M(0, 0, 0), color: lc });   // throatlash
  const bridle = new THREE.Mesh(mergeParts(bGeo), mat); bridle.castShadow = true; head.add(bridle);

  // reins: ribbons bit -> hand targets (or neck)
  const reinN = 9;
  const reinGeo = new THREE.BufferGeometry();
  const rpos = new Float32Array(2 * reinN * 2 * 3), rcol = new Float32Array(2 * reinN * 2 * 3);
  const ridx = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < reinN - 1; i++) { const a = (r * reinN + i) * 2; ridx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const rc = lin(Dh); for (let i = 0; i < rcol.length; i += 3) { rcol[i] = rc.r; rcol[i + 1] = rc.g; rcol[i + 2] = rc.b; }
  reinGeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3).setUsage(35048)); reinGeo.setAttribute('color', new THREE.BufferAttribute(rcol, 3)); reinGeo.setIndex(ridx);
  const reinMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const reins = new THREE.Mesh(reinGeo, reinMat); reins.frustumCulled = false; horse.root.add(reins);
  const handTargets = { L: null, R: null };   // group-local points; set by the rider module (or null)

  const api = {
    style: styleName, saddle, stirrup, seatTop: top, zc, S, handTargets, tread: { L: stirrup.L.tread, R: stirrup.R.tread },
    seat: saddle, root,
    update(dt, h) {
      // stirrup pendulum: swings back with acceleration, springs back
      const a = h.accelLocal.z;
      for (const k of ['L', 'R']) {
        const s = stirrup[k];
        const f = -a * 0.045 - s.ang * 40 - s.vel * 3.2;
        s.vel += f * dt; s.ang += s.vel * dt; s.ang = Math.max(-0.5, Math.min(0.5, s.ang));
        s.pivot.rotation.x = s.ang + 0.0;
      }
      // reins
      const inv = new THREE.Matrix4().copy(h.root.matrixWorld).invert();
      const bitW = [];
      for (const sg of [1, -1]) bitW.push(new V3(...[sg * 0.1 - hr.x, 1.76 - hr.y, 1.6 - hr.z]).applyMatrix4(head.matrixWorld).applyMatrix4(inv));
      const p = rpos;
      const tmp = new V3(), dir = new V3();
      for (let r = 0; r < 2; r++) {
        const bit = bitW[r];
        let hand = handTargets[r === 0 ? 'L' : 'R'] || handTargets[r === 0 ? 'R' : 'L'];
        if (!hand) {   // riderless: loop over the withers
          const w = saddle.getWorldPosition(new V3()).applyMatrix4(inv); hand = new V3(r === 0 ? 0.05 : -0.05, w.y + 0.05, w.z + 0.42);
          hand = hand.clone().add(new V3(0, 0.18, -0.02));
        }
        const sag = Math.min(0.12, bit.distanceTo(hand) * 0.12);
        for (let i = 0; i < reinN; i++) {
          const u = i / (reinN - 1);
          tmp.lerpVectors(bit, hand, u); tmp.y -= Math.sin(u * Math.PI) * sag;
          const o = (r * reinN + i) * 6;
          const w = 0.007;
          p[o] = tmp.x - w; p[o + 1] = tmp.y; p[o + 2] = tmp.z; p[o + 3] = tmp.x + w; p[o + 4] = tmp.y; p[o + 5] = tmp.z;
        }
      }
      reinGeo.attributes.position.needsUpdate = true;
    },
    dispose() { saddle.removeFromParent(); bridle.removeFromParent(); reins.removeFromParent(); geo.dispose(); mat.dispose(); reinGeo.dispose(); reinMat.dispose(); },
  };
  return api;
}

/** A western felt hat (pinched crown, curled brim), built +Y up then turned so +Y runs along the athlete head bone's +X. Parent it to Bip01_Head at (0.1, 0, 0). */
export function makeWesternHat(felt = '#d8c294', band = '#5a3a1e') {
  const prof = [[0.0, 0.0], [0.108, 0.0], [0.121, 0.012], [0.124, 0.05], [0.116, 0.09], [0.104, 0.118], [0.088, 0.128], [0.05, 0.122], [0.02, 0.112], [0.0, 0.108]].map(([x, y]) => new THREE.Vector2(x, y));
  const crown = new THREE.LatheGeometry(prof, 20);
  const p = crown.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.09) { const k = (y - 0.09) / 0.04; p.setX(i, p.getX(i) * (1 - 0.22 * k)); } }
  const brim = new THREE.RingGeometry(0.1, 0.235, 28, 2); brim.rotateX(-Math.PI / 2);
  const bp = brim.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), z = bp.getZ(i), r = Math.hypot(x, z), side = Math.abs(x) / Math.max(r, 1e-4);
    bp.setY(i, 0.004 + side * side * (r - 0.1) * 0.55);
    if (z > 0) bp.setZ(i, z * (1 + 0.14 * (r - 0.1) / 0.135));
  }
  const g = mergeParts([
    { geo: crown, matrix: M(0, 0, 0), color: felt },
    { geo: new THREE.CylinderGeometry(0.1235, 0.1255, 0.026, 20, 1, true), matrix: M(0, 0.028, 0), color: band },
    { geo: brim, matrix: M(0, 0, 0), color: felt },
  ]);
  g.rotateZ(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
  m.name = 'hat'; m.position.set(0.1, 0, 0);
  return m;
}
