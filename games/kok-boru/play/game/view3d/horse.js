// A real 3D steppe horse, built from lofted cross-sections (no model files): barrel, neck, head, ears, mane, tail, four jointed legs with
// knees / hocks / fetlocks / hooves, blanket, saddle, stirrups and reins. Local space: metres, +Z forward, +Y up, +X is the horse's LEFT.
// The gait is the same foot-path solver the 2D picture uses (stride phase advanced by speed in the sim), so 2D and 3D agree.
import { THREE } from '../vendor3d/index.js';

const { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Group, Vector3, Quaternion, Color, BoxGeometry, SphereGeometry, CylinderGeometry, CatmullRomCurve3, DoubleSide, Matrix4 } = THREE;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (v) => v * v * (3 - 2 * v);
const Y = new Vector3(0, 1, 0), XA = new Vector3(1, 0, 0);

// ---- gait (mirrors src/rig.js so the sim's stride phase drives both pictures) -----------------------------------------------------------
const WALK = { hn: 0.0, fn: 0.25, hf: 0.5, ff: 0.75 };
const GAL = { hf: 0.0, hn: 0.14, ff: 0.5, fn: 0.64 };
function footPath(u, st, half, lift) {
  if (u < st) { const k = u / st; return [half * (1 - 2 * k), 0]; }
  const v = (u - st) / (1 - st);
  return [-half + 2 * half * sm(v), lift * Math.pow(Math.sin(Math.PI * v), 0.8)];
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------------------------
// Monotone cubic through (x, y) control points (no overshoot), sampled at x.
function curve(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m.push(d[0]);
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// rings: array of arrays of [x, y, z]; returns an indexed, vertex-coloured, welded-normal geometry closed with end fans.
function loft(rings, colorAt) {
  const R = rings.length, M = rings[0].length;
  const pos = [], col = [], idx = [];
  const c0 = new Color();
  for (let r = 0; r < R; r++) for (let m = 0; m < M; m++) {
    const p = rings[r][m]; pos.push(p[0], p[1], p[2]);
    colorAt(r / (R - 1), m / M, c0, r, m); col.push(c0.r, c0.g, c0.b);
  }
  for (let r = 0; r < R - 1; r++) for (let m = 0; m < M; m++) {
    const a = r * M + m, b = r * M + (m + 1) % M, c = (r + 1) * M + m, d = (r + 1) * M + (m + 1) % M;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (r, flip) => {
    let cx = 0, cy = 0, cz = 0;
    for (let m = 0; m < M; m++) { const p = rings[r][m]; cx += p[0]; cy += p[1]; cz += p[2]; }
    const ci = pos.length / 3; pos.push(cx / M, cy / M, cz / M);
    const cc = new Color(); colorAt(r / (R - 1), 0, cc, r, 0); col.push(cc.r, cc.g, cc.b);
    for (let m = 0; m < M; m++) { const a = r * M + m, b = r * M + (m + 1) % M; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  };
  cap(0, false); cap(R - 1, true);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // repaint hook: recolours every vertex through colorAt again (the team's coat changes between matches)
  g.userData.paint = () => {
    const a = g.attributes.color; const c1 = new Color();
    for (let r = 0; r < R; r++) for (let m = 0; m < M; m++) { colorAt(r / (R - 1), m / M, c1, r, m); a.setXYZ(r * M + m, c1.r, c1.g, c1.b); }
    const ci0 = R * M;
    colorAt(0, 0, c1, 0, 0); a.setXYZ(ci0, c1.r, c1.g, c1.b);
    colorAt(1, 0, c1, R - 1, 0); a.setXYZ(ci0 + 1, c1.r, c1.g, c1.b);
    a.needsUpdate = true;
  };
  return g;
}

// A superellipse ring around `c` in the plane spanned by X (sideways) and N (up in the section), with different heights above / below.
function ring(c, X, N, rx, up, down, M = 14, p = 2.35) {
  const out = [];
  for (let i = 0; i < M; i++) {
    const th = (i / M) * TAU, co = Math.cos(th), si = Math.sin(th);
    const ux = Math.sign(co) * Math.pow(Math.abs(co), 2 / p), uy = Math.sign(si) * Math.pow(Math.abs(si), 2 / p);
    const h = uy >= 0 ? up : down;
    out.push([c.x + X.x * rx * ux + N.x * h * uy, c.y + X.y * rx * ux + N.y * h * uy, c.z + X.z * rx * ux + N.z * h * uy]);
  }
  return out;
}

// A circular tapered bone along -Y from y = +L/2 (top) to y = -L/2 with a radius profile (list of radii, evenly spaced from top to bottom).
function bone(L, radii, M = 10, colorAt) {
  const rings = radii.map((r, i) => {
    const y = L / 2 - (i / (radii.length - 1)) * L, o = [];
    for (let m = 0; m < M; m++) { const a = (m / M) * TAU; o.push([Math.cos(a) * r, y, Math.sin(a) * r * 0.92]); }
    return o;
  });
  return loft(rings, colorAt || ((t, s, c) => c.setRGB(1, 1, 1)));
}

const matCache = new Map();
function mat(key, hex, rough = 0.62, extra = {}) {
  const k = key + hex + rough;
  let m = matCache.get(k);
  if (!m) { m = new MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, ...extra }); matCache.set(k, m); }
  return m;
}

// felt saddle blanket: a deep field with a cream diamond border and a trim stripe (the same felt pattern as the rails of the pitch)
function feltTexture(fieldHex, trimHex) {
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = fieldHex; g.fillRect(0, 0, 128, 128);
  g.fillStyle = trimHex;
  for (let i = 0; i < 4; i++) { const x = 16 + i * 32; g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 12, 20); g.lineTo(x, 32); g.lineTo(x - 12, 20); g.closePath(); g.fill(); }
  g.fillRect(0, 44, 128, 6); g.fillRect(0, 112, 128, 6);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 4; i++) { const x = 16 + i * 32; g.beginPath(); g.arc(x, 20, 3, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// ---- the horse -------------------------------------------------------------------------------------------------------------------------
export function createHorse({ coat = '#7a4a2a', blanket = '#c9772e', trim = '#fff1cf', mane = null, socks = null } = {}) {
  const base = new Color(coat), dark = new Color(), light = new Color(), belly = new Color(), maneC = new Color(), sockC = new Color(), muzzleC = new Color();
  const paints = [];
  const mk = { blaze: false };
  const fine = [];
  const setColors = (hex, maneHex, sockHex) => {
    base.set(hex);
    const hsl = {}; base.getHSL(hsl);
    dark.setHSL(hsl.h, Math.min(1, hsl.s * 1.05), clamp(hsl.l * 0.52, 0.04, 0.5));
    light.setHSL(hsl.h, hsl.s * 0.9, clamp(hsl.l * 1.2 + 0.03, 0.05, 0.9));
    belly.setHSL(hsl.h, hsl.s * 0.85, clamp(hsl.l * 0.72, 0.03, 0.8));
    if (maneHex) maneC.set(maneHex); else maneC.setHSL(hsl.h, hsl.s, clamp(hsl.l * 0.4, 0.03, 0.4));
    if (sockHex) sockC.set(sockHex); else sockC.copy(dark).lerp(new Color(0x16110d), 0.45);
    muzzleC.copy(dark).multiplyScalar(0.7);
  };
  setColors(coat, mane, socks);

  const root = new Group();
  const body = new Group();        // bobs and pitches
  root.add(body);
  const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0 });
  const legMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
  const hoofMat = mat('hoof', 0x1b1511, 0.5);
  const maneMat = new MeshStandardMaterial({ color: maneC.clone(), roughness: 0.85, side: DoubleSide });

  // body loft: rump -> chest, top line and underline from control points, widths from a third curve
  const topY = curve([[-1.04, 1.26], [-0.94, 1.4], [-0.72, 1.48], [-0.4, 1.44], [-0.1, 1.42], [0.15, 1.47], [0.38, 1.53], [0.6, 1.48], [0.8, 1.38], [0.88, 1.28]]);
  const botY = curve([[-1.04, 0.98], [-0.9, 0.9], [-0.65, 0.84], [-0.4, 0.77], [-0.15, 0.71], [0.1, 0.67], [0.4, 0.68], [0.6, 0.75], [0.78, 0.92], [0.88, 1.08]]);
  const halfW = curve([[-1.04, 0.09], [-0.95, 0.22], [-0.72, 0.285], [-0.4, 0.25], [-0.1, 0.245], [0.2, 0.26], [0.45, 0.26], [0.65, 0.24], [0.8, 0.18], [0.88, 0.1]]);
  const X = new Vector3(1, 0, 0), N = new Vector3(0, 1, 0);
  {
    const rings = [];
    const S = 26;
    for (let i = 0; i < S; i++) {
      const z = lerp(-1.04, 0.88, i / (S - 1));
      const t = topY(z), b = botY(z), cy = (t + b) / 2, ry = (t - b) / 2;
      const squareish = 2.2 + 0.5 * Math.exp(-Math.pow((z + 0.6) / 0.3, 2));
      rings.push(ring(new Vector3(0, cy, z), X, N, halfW(z), ry, ry * 1.03, 16, squareish));
    }
    const geo = loft(rings, (t, s, c, r, m) => {
      const a = (m / 16) * TAU, sn = Math.sin(a);                      // +1 top, -1 belly
      const k = clamp((sn + 1) / 2, 0, 1);
      c.copy(belly).lerp(base, clamp(k * 1.6, 0, 1)).lerp(light, Math.max(0, k - 0.62) * 0.9);
      // hind quarters and shoulder a touch lighter (muscle sheen), flanks darker toward the tail
      c.multiplyScalar(0.94 + 0.1 * Math.sin(t * 6));
    });
    const m = new Mesh(geo, bodyMat); m.name = 'barrel'; body.add(m); paints.push(geo.userData.paint);
  }

  // neck (pivots at the withers) and head (pivots at the poll)
  const neck = new Group(); neck.position.set(0, 1.36, 0.5); body.add(neck);
  const neckLen = new Vector3(0, 0.42, 0.52);   // base -> poll in the neck frame
  {
    const pts = [new Vector3(0, -0.04, -0.12), new Vector3(0, 0.06, 0.1), new Vector3(0, 0.24, 0.28), new Vector3(0, neckLen.y, neckLen.z)];
    const cr = new CatmullRomCurve3(pts);
    const S = 10, rings = [];
    const upR = (t) => lerp(0.25, 0.115, Math.pow(t, 0.8)), dnR = (t) => lerp(0.23, 0.125, Math.pow(t, 0.75)), rxx = (t) => lerp(0.16, 0.1, t);
    for (let i = 0; i < S; i++) {
      const t = i / (S - 1), c = cr.getPoint(t), tg = cr.getTangent(t);
      const Nn = new Vector3(0, tg.z, -tg.y).normalize();
      rings.push(ring(c, X, Nn, rxx(t), upR(t), dnR(t), 14, 2.3));
    }
    const geo = loft(rings, (t, s, c, r, m) => { const sn = Math.sin((m / 14) * TAU); c.copy(base).lerp(light, Math.max(0, sn) * 0.18).lerp(belly, Math.max(0, -sn) * 0.4); });
    const mesh = new Mesh(geo, bodyMat); neck.add(mesh); paints.push(geo.userData.paint);
    // mane anchors: points along the crest (neck-local); the locks themselves are simulated below
    neck.userData.maneAnch = [];
    const K = 16;
    for (let k = 0; k <= K; k++) {
      const t = 0.03 + (k / K) * 0.95, c = cr.getPoint(t), tg = cr.getTangent(t);
      const Nn = new Vector3(0, tg.z, -tg.y).normalize();
      neck.userData.maneAnch.push({ p: c.clone().addScaledVector(Nn, upR(t) * 0.92).add(new Vector3(0.012, 0, 0)), t });
    }
  }
  const head = new Group(); head.position.copy(neckLen); neck.add(head);
  {
    // head axis pointing forward and down, 0.6 m long
    const A = new Vector3(0, -0.78, 0.62).normalize(), L = 0.6;
    const Nn = new Vector3(0, A.z, -A.y);
    const st = [[0.0, 0.13, 0.14, 0.095], [0.12, 0.16, 0.2, 0.12], [0.35, 0.12, 0.14, 0.095], [0.7, 0.09, 0.095, 0.075], [0.93, 0.085, 0.085, 0.07], [1.0, 0.06, 0.06, 0.058]];
    const rings = st.map(([t, u, d, w]) => ring(A.clone().multiplyScalar(t * L).add(new Vector3(0, 0.04 * (1 - t), -0.03 * (1 - t))), X, Nn, w, u, d, 12, 2.3));
    const geo = loft(rings, (t, s, c, r, m) => {
      c.copy(base).lerp(light, 0.1);
      const sn = Math.sin((m / 12) * TAU);
      if (mk.blaze && sn > 0.55 && t > 0.08 && t < 0.97) c.lerp(new Color(0xf3ede0), clamp((sn - 0.55) * 3, 0, 1) * 0.92);   // blaze down the face
      if (t > 0.84) c.copy(muzzleC); else if (t > 0.7) c.lerp(muzzleC, 0.5);
    });
    head.add(new Mesh(geo, bodyMat)); paints.push(geo.userData.paint);
    // bridle: browband, noseband, cheek pieces and the bit (thin leather, no bars across the face)
    {
      const lm = mat('leatherB', 0x2a190f, 0.55);
      const ringAt = (t, rx, ry, tube) => {
        const c = A.clone().multiplyScalar(t * L).add(new Vector3(0, 0.04 * (1 - t), -0.03 * (1 - t)));
        const m = new Mesh(new THREE.TorusGeometry(1, tube, 6, 22), lm);
        m.scale.set(rx, ry, 1); m.position.copy(c);
        m.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), A);
        head.add(m); fine.push(m); return c;
      };
      const c1 = ringAt(0.1, 0.108, 0.12, 0.011);
      const c2 = ringAt(0.72, 0.082, 0.082, 0.012);
      for (const sx of [-1, 1]) {
        const a = c1.clone().add(new Vector3(sx * 0.105, -0.03, 0.03)), b = c2.clone().add(new Vector3(sx * 0.08, 0.0, 0.0));
        const cyl = new Mesh(new CylinderGeometry(0.008, 0.008, 1, 6), lm);
        const d = b.clone().sub(a); const len = d.length();
        cyl.position.copy(a).add(b).multiplyScalar(0.5); cyl.quaternion.setFromUnitVectors(Y, d.normalize()); cyl.scale.set(1, len, 1);
        head.add(cyl); fine.push(cyl);
      }
    }
    // ears and eyes
    const earG = new CylinderGeometry(0.006, 0.036, 0.115, 8, 1); earG.translate(0, 0.057, 0);
    const earMat = new MeshStandardMaterial({ color: dark.clone(), roughness: 0.7 }); head.userData.earMat = earMat;
    const eyeG = new SphereGeometry(0.02, 10, 8), eyeMat = new MeshStandardMaterial({ color: 0x0a0807, roughness: 0.2 });
    for (const sx of [-1, 1]) {
      const e = new Mesh(earG, earMat); e.position.set(sx * 0.062, 0.105, -0.055); e.rotation.set(-0.45, 0, sx * 0.22); e.scale.set(1.0, 1, 0.65); head.add(e);
      const eye = new Mesh(eyeG, eyeMat); eye.position.set(sx * 0.083, -0.035, 0.095); eye.scale.set(0.6, 1.0, 1.15); head.add(eye); fine.push(eye);
    }
    // forelock
    { const fl = new Mesh(new CylinderGeometry(0.002, 0.03, 0.13, 6, 1), maneMat); fl.position.set(0, 0.08, 0.04); fl.rotation.x = 2.4; head.add(fl); fine.push(fl); }
    head.userData.mouth = A.clone().multiplyScalar(L * 0.9).add(new Vector3(0, 0.0, 0));
  }

  // tail (rebuilt each frame as a tapered strip chain)
  const tailGeo = new BufferGeometry();
  const TS = 4, TM = 7;
  tailGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array((TS * TM + 2) * 3), 3));
  {
    const idx = [];
    for (let r = 0; r < TS - 1; r++) for (let m = 0; m < TM; m++) { const a = r * TM + m, b = r * TM + (m + 1) % TM, c = (r + 1) * TM + m, d = (r + 1) * TM + (m + 1) % TM; idx.push(a, c, b, b, c, d); }
    tailGeo.setIndex(idx);
  }
  const tail = new Mesh(tailGeo, maneMat); tail.frustumCulled = false; body.add(tail);
  const tailP = [];
  for (let i = 0; i < TS; i++) tailP.push(new Vector3(0, 1.3, -1.0 - i * 0.06));

  // ---- hair: tail and mane as many tapered ribbon locks, each a verlet chain simulated in root space. Lag, sway and swing come from the
  // anchor's own motion (bob, pitch, head nod) plus pseudo-forces from the horse's acceleration, its turning and the wind of its speed.
  const locks = [];
  const mkLock = (kind, n, len, w0, w1, fan, rest, stiff, anchorI = 0) => {
    const L = { kind, n, len, w0, w1, fan, rest: rest.clone().normalize(), stiff, anchorI, p: [], q: [], a: new Vector3(), ph: (locks.length * 2.399) % 6.283 };
    for (let k = 0; k < n; k++) { L.p.push(new Vector3(0, 1.3, -1.2 - k * len / n)); L.q.push(L.p[k].clone()); }
    locks.push(L); return L;
  };
  for (let i = 0; i < 11; i++) {
    const u = i / 10 - 0.5, h = Math.sin(i * 12.9898) * 0.5 + 0.5;
    { const L = mkLock('tail', 10, 0.8 + 0.25 * h + 0.12 * (1 - Math.abs(u) * 2), 0.085, 0.01, u * 0.1 + (h - 0.5) * 0.02, new Vector3(u * 0.3, -1, -0.28 - h * 0.1), 0.16); L.yv = (h - 0.5) * 0.5; L.zs = Math.sin(i * 3.7) * 0.4; L.wv = (i % 3) * 1.3; }
  }
  for (let k = 0; k < 17; k++) {
    const h = Math.sin(k * 7.13 + 1.7) * 0.5 + 0.5;
    mkLock('mane', 5, 0.2 + 0.14 * h, 0.05, 0.008, 0, new Vector3(0.45, -0.8, -0.28), 0.5, k);
  }
  const hairVerts = locks.reduce((a, L) => a + L.n * 2, 0);
  const hairGeo = new BufferGeometry();
  hairGeo.setAttribute('position', new Float32BufferAttribute(new Float32Array(hairVerts * 3), 3));
  {
    const idx = []; let o = 0;
    for (const L of locks) { for (let k = 0; k < L.n - 1; k++) { const a = o + k * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } L.vo = o; o += L.n * 2; }
    hairGeo.setIndex(idx);
  }
  const hairMesh = new Mesh(hairGeo, maneMat); hairMesh.frustumCulled = false; root.add(hairMesh);
  const hs = { prevSpd: 0, accEma: 0, turn: 0, first: true, rootInv: new Matrix4(), M: new Matrix4(), tmpV: new Vector3() };

  // legs: one continuous skin per leg (a lofted tube through hip, knee / hock, fetlock and pastern, rebuilt every frame), radius profile with
  // the forearm / gaskin muscle, the knee or hock, the slim cannon, the fetlock and the pastern; a hoof cone at the end
  const PAST = 0.2;
  const LEG = {
    fore: { U: 0.72, C: 0.4, top: [0.1, 1.22, 0.56], hind: false,
      rad: curve([[0, 0.115], [0.18, 0.112], [0.4, 0.088], [0.62, 0.066], [0.72, 0.068], [0.78, 0.052], [0.92, 0.044], [1.07, 0.043], [1.12, 0.058], [1.22, 0.042], [1.32, 0.04]]) },
    hind: { U: 0.74, C: 0.4, top: [0.1, 1.26, -0.74], hind: true,
      rad: curve([[0, 0.15], [0.15, 0.14], [0.38, 0.1], [0.6, 0.07], [0.74, 0.074], [0.8, 0.056], [0.95, 0.045], [1.09, 0.043], [1.14, 0.058], [1.24, 0.042], [1.34, 0.04]]) },
  };
  const LS = 17, LM = 10;               // rings per leg, vertices per ring
  const legs = {};
  const hoofGeo = bone(0.075, [0.064, 0.052, 0.042], 10, (t, s, c) => { c.setRGB(1, 1, 1); });
  const hoofMatLocal = new MeshStandardMaterial({ color: 0x1d1612, roughness: 0.5, vertexColors: true });
  for (const [name, type, sx] of [['hf', 'hind', 1], ['hn', 'hind', -1], ['ff', 'fore', 1], ['fn', 'fore', -1]]) {
    const d = LEG[type];
    const total = d.U + d.C + PAST;
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(LS * LM * 3), 3));
    const idx = [];
    for (let r = 0; r < LS - 1; r++) for (let m = 0; m < LM; m++) { const a2 = r * LM + m, b2 = r * LM + (m + 1) % LM, c2 = (r + 1) * LM + m, d2 = (r + 1) * LM + (m + 1) % LM; idx.push(a2, b2, c2, b2, d2, c2); }
    geo.setIndex(idx);
    const colorAtLeg = (r, c) => {
      const s = (r / (LS - 1)) * total;
      c.copy(base);
      if (s > d.U * 0.55) c.lerp(sockC, clamp((s - d.U * 0.55) / (d.U * 0.4), 0, 1) * (type === 'fore' ? 0.55 : 0.4));
      if (s > d.U + 0.04) c.copy(sockC);
    };
    const cols = new Float32Array(LS * LM * 3); const cc = new Color();
    const paintLeg = () => { const arr = geo.attributes.color.array; for (let r = 0; r < LS; r++) { colorAtLeg(r, cc); for (let m = 0; m < LM; m++) { const i = (r * LM + m) * 3; arr[i] = cc.r; arr[i + 1] = cc.g; arr[i + 2] = cc.b; } } geo.attributes.color.needsUpdate = true; };
    geo.setAttribute('color', new Float32BufferAttribute(cols, 3));
    paintLeg(); paints.push(paintLeg);
    const skin = new Mesh(geo, legMat); skin.frustumCulled = false;
    const hoof = new Mesh(hoofGeo, hoofMatLocal); hoof.frustumCulled = false;
    const g = new Group(); g.add(skin, hoof); body.add(g);
    legs[name] = { g, skin, geo, hoof, d, sx, type, hind: d.hind, total, pts: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] };
  }
  // fill a leg's rings: polyline hip -> knee -> fetlock -> coffin, smoothed, sections wider in the walking plane than across
  const SP = [];
  for (let i = 0; i < LS; i++) SP.push(new Vector3());
  function buildLeg(l) {
    const [p0, p1, p2, p3] = l.pts;
    const segs = [[p0, p1, l.d.U], [p1, p2, l.d.C], [p2, p3, PAST]];
    const total = l.total;
    for (let i = 0; i < LS; i++) {
      let s = (i / (LS - 1)) * total, k = 0;
      while (k < 2 && s > segs[k][2]) { s -= segs[k][2]; k++; }
      const [a2, b2, L2] = segs[k];
      SP[i].lerpVectors(a2, b2, clamp(s / L2, 0, 1));
    }
    // two smoothing passes round the knee / hock and the fetlock into continuous curves (ends fixed)
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < LS - 1; i++) { SP[i].x = SP[i].x; SP[i].y = (SP[i - 1].y + 2 * SP[i].y + SP[i + 1].y) / 4; SP[i].z = (SP[i - 1].z + 2 * SP[i].z + SP[i + 1].z) / 4; }
    const pa = l.geo.attributes.position;
    for (let i = 0; i < LS; i++) {
      const A = SP[Math.max(0, i - 1)], B = SP[Math.min(LS - 1, i + 1)];
      let ty = B.y - A.y, tz = B.z - A.z; const tl = Math.hypot(ty, tz) || 1; ty /= tl; tz /= tl;
      const ny = tz, nz = -ty;                    // in-plane normal
      const r = l.d.rad((i / (LS - 1)) * total);
      const rx = r * 0.82, rn = r * 1.08;
      for (let m = 0; m < LM; m++) {
        const an = (m / LM) * TAU, cx = Math.cos(an), sn = Math.sin(an);
        pa.setXYZ(i * LM + m, SP[i].x + cx * rx, SP[i].y + ny * sn * rn, SP[i].z + nz * sn * rn);
      }
    }
    pa.needsUpdate = true; l.geo.computeVertexNormals();
  }

  // tack: blanket with a trim stripe, saddle, girth strap
  const feltTex = feltTexture('#ffffff', '#f4e7c4');
  const blanketMat = new MeshStandardMaterial({ color: new Color(blanket), roughness: 0.9, map: feltTex });
  const trimMat = new MeshStandardMaterial({ color: new Color(trim), roughness: 0.8 });
  const leather = mat('leather', 0x4a2d1b, 0.55);
  const leatherDark = mat('leatherDk', 0x2d1b11, 0.6);
  const tack = new Group(); body.add(tack);
  {
    const top = new Mesh(new BoxGeometry(0.4, 0.03, 0.5), blanketMat); top.position.set(0, 1.43, 0.12); tack.add(top);
    for (const sx of [-1, 1]) {
      const fl = new Mesh(new BoxGeometry(0.03, 0.26, 0.5), blanketMat); fl.position.set(sx * 0.215, 1.31, 0.12); fl.rotation.z = -sx * 0.2; tack.add(fl);
      const st = new Mesh(new BoxGeometry(0.032, 0.035, 0.52), trimMat); st.position.set(sx * 0.255, 1.185, 0.12); st.rotation.z = -sx * 0.2; tack.add(st);
    }
    const st2 = new Mesh(new BoxGeometry(0.42, 0.034, 0.05), trimMat); st2.position.set(0, 1.434, -0.12); tack.add(st2);
    const sad = new Mesh(new SphereGeometry(0.2, 14, 10), leather); sad.scale.set(0.95, 0.26, 1.3); sad.position.set(0, 1.47, 0.1); tack.add(sad);
    const pom = new Mesh(new SphereGeometry(0.06, 10, 8), leatherDark); pom.scale.set(1.3, 0.9, 0.7); pom.position.set(0, 1.52, 0.31); tack.add(pom);
    const can = new Mesh(new SphereGeometry(0.075, 10, 8), leatherDark); can.scale.set(1.5, 0.8, 0.6); can.position.set(0, 1.52, -0.12); tack.add(can);
  }
  // stirrup leathers and irons (updated per frame to the rider's feet) and the reins
  const strapG = new BoxGeometry(0.025, 1, 0.012);
  const straps = [new Mesh(strapG, leatherDark), new Mesh(strapG, leatherDark)];
  const irons = [new Mesh(new BoxGeometry(0.1, 0.012, 0.075), mat('iron', 0x8a8f96, 0.35, { metalness: 0.6 })), new Mesh(new BoxGeometry(0.1, 0.012, 0.075), mat('iron', 0x8a8f96, 0.35, { metalness: 0.6 }))];
  const reinG = new BoxGeometry(0.007, 1, 0.007);
  const reins = [new Mesh(reinG, leatherDark), new Mesh(reinG, leatherDark)];
  for (const m of [...straps, ...irons, ...reins]) { m.frustumCulled = false; root.add(m); fine.push(m); }

  const V = { a: new Vector3(), b: new Vector3(), d: new Vector3(), q: new Quaternion() };
  const placeBetween = (m, a, b, scaleLen = true) => {
    V.d.subVectors(b, a); const L = V.d.length() || 1e-4; V.d.divideScalar(L);
    m.position.addVectors(a, b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Y, V.d);
    if (scaleLen) m.scale.set(1, L, 1);
  };

  // leg IK in the (z, y) plane, hip at `top`, fetlock at (fz, fy); the knee (fore) or hock (hind) bends forward / backward
  function solveLeg(L, hz, hy, fz, fy, fwd) {
    let dz = fz - hz, dy = fy - hy, d = Math.hypot(dz, dy);
    const maxd = L.U + L.C - 0.005;
    if (d > maxd) { dz *= maxd / d; dy *= maxd / d; d = maxd; fz = hz + dz; fy = hy + dy; }
    const a = (L.U * L.U - L.C * L.C + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L.U * L.U - a * a));
    const mz = hz + dz * a / d, my = hy + dy * a / d;
    const sg = fwd ? 1 : -1;
    // perpendicular (z, y) -> (dy, -dz)/d points forward-down for dz>0... choose by sign so knees point to the sg direction in z
    let kz = mz + (dy / d) * h, ky = my - (dz / d) * h;
    const kz2 = mz - (dy / d) * h, ky2 = my + (dz / d) * h;
    if ((kz2 - mz) * sg > (kz - mz) * sg) { kz = kz2; ky = ky2; }
    return { kz, ky, fz, fy };
  }

  function simHair(o, g) {
    const dt = clamp(o.dt ?? 1 / 60, 0, 0.05);
    // pseudo-forces from the horse's own acceleration and turning (smoothed)
    if (hs.first) { hs.prevSpd = o.spd; hs.first = false; }
    const acc = dt > 0 ? (o.spd - hs.prevSpd) / dt : 0; hs.prevSpd = o.spd;
    hs.accEma += (clamp(acc, -14, 14) - hs.accEma) * Math.min(1, dt * 8);
    hs.turn += (clamp(o.turn || 0, -8, 8) - hs.turn) * Math.min(1, dt * 10);
    body.updateMatrix(); root.updateWorldMatrix(true, false); neck.updateWorldMatrix(true, false);
    hs.rootInv.copy(root.matrixWorld).invert(); hs.M.multiplyMatrices(hs.rootInv, neck.matrixWorld);
    const wind = 4.2 * clamp(o.spd / 8, 0, 1.2), t = o.t;
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 90))), h = dt / steps || 0;
    const pa = hairGeo.attributes.position;
    const tv = hs.tmpV;
    for (const L of locks) {
      // anchor in root space
      if (L.kind === 'tail') L.a.set(L.fan, tailP[TS - 1].y + 0.01, tailP[TS - 1].z - 0.02).applyMatrix4(body.matrix);
      else { const m = neck.userData.maneAnch[L.anchorI]; L.a.copy(m.p).applyMatrix4(hs.M); }
      // rest direction (root space): tail hangs down and streams back with speed; mane lies on the near side of the neck
      const rest = V.d.copy(L.rest);
      if (L.kind === 'tail') { rest.y = lerp(-1, -0.12, g) + L.yv * g; rest.z = -lerp(0.3, 1, g) + L.zs * (1 - g * 0.6); rest.normalize(); }
      else rest.transformDirection(hs.M);
      const Lseg = L.len / (L.n - 1);
      L.p[0].copy(L.a); L.q[0].copy(L.a);
      if (dt > 0) for (let s = 0; s < steps; s++) {
        for (let k = 1; k < L.n; k++) {
          const p = L.p[k], q = L.q[k], f = k / (L.n - 1);
          tv.copy(p).sub(q).multiplyScalar(0.965);
          q.copy(p);
          let ax = 0, ay = -7.5, az = -wind * (0.4 + f * 0.9) - hs.accEma * 0.5;
          ax += -hs.turn * (L.kind === 'tail' ? 1.6 : 0.5) * f * clamp(o.spd, 0.5, 7) * 0.5 + Math.sin(t * 2.3 + L.ph + f * 2.2) * (0.5 + g * 2.2) * f;
          ay += Math.sin(t * 7.0 - f * 4.5 + L.ph) * g * 5.5 * f * f;
          p.x += tv.x + ax * h * h; p.y += tv.y + ay * h * h; p.z += tv.z + az * h * h;
          // soft spring toward the rest curve (strong near the root so the hair leaves the skin cleanly)
          const sK = L.stiff * (1 - f * 0.75) * Math.min(1, h * 60);
          p.x += (L.a.x + rest.x * Lseg * k - p.x) * sK;
          p.y += (L.a.y + rest.y * Lseg * k - p.y) * sK;
          p.z += (L.a.z + rest.z * Lseg * k - p.z) * sK;
        }
        for (let it = 0; it < 2; it++) for (let k = 1; k < L.n; k++) {
          const a = L.p[k - 1], b = L.p[k];
          tv.copy(b).sub(a); const d = tv.length() || 1e-4; tv.multiplyScalar((Lseg / d));
          b.copy(a).add(tv);
        }
      }
      // ribbon: width across the camera-ish direction, tapering to a fine tip
      for (let k = 0; k < L.n; k++) {
        const nx = L.p[Math.min(L.n - 1, k + 1)], pv = L.p[Math.max(0, k - 1)];
        const tz = nx.z - pv.z, ty = nx.y - pv.y, tl = Math.hypot(tz, ty) || 1;
        const f = k / (L.n - 1), w = lerp(L.w0, L.w1, Math.pow(f, 0.7)) * (L.kind === 'tail' ? 1 + 0.6 * Math.sin(f * 3 + L.ph) * f : 1);
        const wy = tz / tl, wz = -ty / tl;                 // in-plane normal (z-y plane): the ribbon seen from the side
        const wx = 0.45;                                    // plus some x so it keeps thickness from the front
        const vi = L.vo + k * 2;
        const p = L.p[k];
        pa.setXYZ(vi, p.x - wx * w, p.y - wy * w * 0.65, p.z - wz * w * 0.65);
        pa.setXYZ(vi + 1, p.x + wx * w, p.y + wy * w * 0.65, p.z + wz * w * 0.65);
      }
    }
    pa.needsUpdate = true; hairGeo.computeVertexNormals();
  }

  /**
   * Pose the horse. o: { ph, spd, t, stun, charge }  -> returns joints the rider needs: { seatY, withers..., mouth, bob }
   */
  const P = new Vector3(), Q = new Vector3();
  const out = { bob: 0, pitch: 0, g: 0, mv: 0, ext: 0, headNod: 0, mouth: new Vector3(), crest: new Vector3() };
  function pose(o) {
    const spd = o.spd, g = clamp((spd - 2.4) / 4.2, 0, 1), mv = clamp(spd / 1.2, 0, 1), ph = o.ph;
    const st = lerp(0.64, 0.36, g), half = lerp(0.22, 0.62, g) * mv, lift = lerp(0.1, 0.36, g) * mv;
    const off = { hn: lerp(WALK.hn, GAL.hn, g), fn: lerp(WALK.fn, GAL.fn, g), hf: lerp(WALK.hf, GAL.hf, g), ff: lerp(WALK.ff, GAL.ff, g) };
    const bob = (Math.sin(TAU * ph * 2 + 0.6) * 0.045 * g + Math.sin(TAU * ph * 2) * 0.012 * (1 - g)) * mv + Math.sin(o.t * 1.7) * 0.008 * (1 - mv);
    const pitch = (Math.sin(TAU * ph + 0.9) * 0.05 * g) * mv + Math.sin(o.t * 1.3) * 0.004;
    body.position.set(0, bob, 0);
    body.rotation.x = pitch;   // + rotation about X lowers the front
    // neck extends and the head nods with the stride
    const ext = lerp(0, 0.12, g) + Math.sin(TAU * ph + 0.3) * 0.03 * g * mv;
    const nod = 0.05 + Math.sin(TAU * ph * 2 + 2.0) * 0.04 * g * mv + (o.stun ? 0.2 : 0);
    neck.rotation.x = 0.04 + ext * 1.2 + (o.stun ? 0.3 : 0);
    head.rotation.x = -0.06 + nod * 1.1 - g * 0.1;
    // mane sways with speed
    // legs (root space, bob applied to the hip, pitch ignored: the feet stay on the ground)
    for (const nme of ['hf', 'hn', 'ff', 'fn']) {
      const l = legs[nme], d = l.d;
      const u = (((ph + off[nme]) % 1) + 1) % 1;
      const [dx, dy] = footPath(u, st, half, lift);
      const hz = d.top[2], hy = d.top[1] + bob;
      const fz = hz + dx + (l.hind ? -0.1 : 0.1) * 0.5 + (l.hind ? -0.04 : 0.02), fy = 0.17 + dy;
      const s = solveLeg(d, hz, hy, fz, fy, !l.hind);
      const x = l.sx * d.top[0];
      // the leg group undoes the body's bob and pitch: positions below are root-space metres
      l.g.rotation.x = -pitch;
      l.g.position.set(0, -bob, 0).applyAxisAngle(XA, -pitch);
      const lifted = clamp(dy / Math.max(0.05, lift), 0, 1);
      const pa = lerp(0.95, 1.25, lifted) + (l.hind ? 0.05 : 0);   // pastern angle below horizontal, radians
      l.pts[0].set(x, hy, hz);
      l.pts[1].set(x * 0.92, s.ky, s.kz);
      l.pts[2].set(x * 0.85, s.fy, s.fz);
      l.pts[3].set(x * 0.85, s.fy - Math.sin(pa) * PAST, s.fz + Math.cos(pa) * PAST);
      buildLeg(l);
      const hoofEnd = V.b.set(x * 0.85, s.fy - Math.sin(pa) * (PAST + 0.075), s.fz + Math.cos(pa) * (PAST + 0.075));
      placeBetween(l.hoof, l.pts[3], hoofEnd, false);
    }
    // tail dock: a short thick tube off the croup, carried a little higher at a gallop
    const dock = new Vector3(0, 1.36 + 0.04 * g, -0.98);
    for (let i = 0; i < TS; i++) { const f = i / (TS - 1); tailP[i].set(0, dock.y - f * (0.1 - 0.1 * g) - f * f * 0.03, dock.z - f * 0.2); }
    {
      const pa = tailGeo.attributes.position;
      for (let i = 0; i < TS; i++) {
        const f = i / (TS - 1), rr = lerp(0.055, 0.04, f), rx = rr * 1.5;
        const nx = i < TS - 1 ? tailP[i + 1] : tailP[i], pv = i > 0 ? tailP[i - 1] : tailP[i];
        const tz = nx.z - pv.z, ty = nx.y - pv.y, tl2 = Math.hypot(tz, ty) || 1;
        const nz = -ty / tl2, ny = tz / tl2;
        for (let m = 0; m < TM; m++) {
          const a = (m / TM) * TAU, cx = Math.cos(a), sn = Math.sin(a);
          pa.setXYZ(i * TM + m, tailP[i].x + cx * rx, tailP[i].y + ny * sn * rr, tailP[i].z + nz * sn * rr);
        }
      }
      pa.needsUpdate = true; tailGeo.computeVertexNormals();
    }
    simHair(o, g);
    out.bob = bob; out.pitch = pitch; out.g = g; out.mv = mv; out.ext = ext;
    return out;
  }

  // world-ish points on the horse (call after pose): the mouth for the reins
  function mouthPoint(v) {
    head.updateWorldMatrix(true, false);
    return v.copy(head.userData.mouth).applyMatrix4(head.matrixWorld);
  }
  function setDetail(on) { for (const m of fine) m.visible = !!on; }
  function setLook({ coat: c, blanket: b, trim: t, mane: m, socks: sk, blaze }) {
    mk.blaze = !!blaze;
    setColors(c, m, sk);
    if (head.userData.earMat) head.userData.earMat.color.copy(dark);
    for (const p of paints) p();
    maneMat.color.copy(maneC);
    if (b) blanketMat.color.set(b);
    if (t) trimMat.color.set(t);
  }
  void out;
  return { setLook, setDetail, root, body, neck, head, legs, tack, straps, irons, reins, pose, mouthPoint, placeBetween, bodyMat, legMat, maneMat, colors: { base, dark } };
}
