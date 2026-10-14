// Two real 3D wrestlers in the ssireum hold (presentation only: reads the pose springs of the 2D picture, never writes back).
//
// The shared view3d layer supplies the person (athlete_m), the stage and the IK; this file authors the pose procedurally on its skeleton:
// feet planted on the sand, knees bent, torsos leaning in, heads on opposite shoulders, the right hand on the rival's waist sash and the left on
// the thigh band (satba). The result is drawn into an off-screen WebGL canvas and composited by the 2D picture (see drawFigures()).
import { createStage, loadHuman, Clip, CLIP_BONES, semanticRot, FINGER_POSES, handQuat, THREE } from '../vendor3d/index.js';
import { createWorld } from './world.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// pixels per metre of the 2D picture (a standing wrestler is about 330 design px tall) and the world region the 3D picture covers
export const PX_PER_M = 190;
export const REGION = { x: 30, y: 6, w: 660, h: 478 };       // design units (WORLD: floor at y = 420, centre line at x = 360)
const FLOOR = 420, CX = 360;

const LIGHTS = { day: 'day', night: 'night', evening: 'evening' };
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// ---------------------------------------------------------------------------------------------------------------------------------
// One wrestler: a Human, a one-frame "pose clip" that is rewritten every frame, and the sash meshes.
class Wrestler {
  constructor(human, side, sashHex) {
    this.h = human; this.side = side;                    // side 0 faces +X (left of the picture), side 1 faces -X
    this.yaw = side === 0 ? Math.PI / 2 : -Math.PI / 2;
    this.clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
    human.addClip(this.clip);
    human.groundClamp = 'off'; human.footPlanting = false;
    this.restQ = new Float32Array(human.restPose.q);
    this.e = new Euler(); this.qa = new Quaternion(); this.qb = new Quaternion();
    this.ph = human.pelvisHeight;
    human.play(this.clip, { fade: 0 });
    this.sash = makeSash(human, sashHex, side);
  }

  // offs: { Bone: { flex, side, twist, abduct, rot:[x,y,z] } } applied on top of the rest pose; pel = [left, up, fwd] metres
  writePose(offs, pel) {
    const q = this.clip.quats;
    q.set(this.restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      this.qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      this.qb.setFromEuler(this.e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      this.qa.multiply(this.qb);
      q[i * 4] = this.qa.x; q[i * 4 + 1] = this.qa.y; q[i * 4 + 2] = this.qa.z; q[i * 4 + 3] = this.qa.w;
    }
    this.clip.pelvis[0] = pel[0] / this.ph; this.clip.pelvis[1] = pel[1] / this.ph; this.clip.pelvis[2] = pel[2] / this.ph;
  }
}


// Shirtless, barefoot, trunks above the knee: the shipped athlete wears a tank top, trainers and long shorts, so this repaints the body texture
// of THIS person at load (a canvas copy: the shared vendored textures stay untouched) and clears the matching tint masks.
function bareBody(human) {
  const N = 1024;
  // bare feet: drop every triangle that sits on the foot / toe bones (the trainers); real feet are added by addFeet() below.
  // Degenerate triangles keep the draw-group ranges intact.
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const a = ix.array;
    // keep the shin down to the ankle joint (so the leg skins smoothly into the foot); only the trainer below it goes
    const py = geo.attributes.position, cut = (human._ankleRest || 0.085) + (globalThis.__ankleCut ?? 9);
    for (let t = 0; t < a.length; t += 3) if ((w[a[t]] > 0.5 || w[a[t + 1]] > 0.5 || w[a[t + 2]] > 0.5) && Math.min(py.getY(a[t]), py.getY(a[t + 1]), py.getY(a[t + 2])) < cut) { a[t + 1] = a[t]; a[t + 2] = a[t]; }
    // the kept shin must not follow the foot (the skinned ankle sleeve does the bending): re-bind its foot weights to the same-side calf
    const names = o.skeleton.bones.map((bn) => bn.name);
    for (const sd of ['L', 'R']) {
      const fI = names.findIndex((n) => n.endsWith(`_${sd}_Foot`)), cI = names.findIndex((n) => n.endsWith(`_${sd}_Calf`));
      if (fI < 0 || cI < 0) continue;
      for (let i = 0; i < py.count; i++) for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === fI && py.getY(i) >= cut) si.setComponent(i, k, cI);
    }
    si.needsUpdate = true;
    ix.needsUpdate = true; geo.userData.barefoot = true;
  });
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  // the head texture ends in a bright, streaked fringe at the bottom of the neck: this is the pale V line on the chest; stretch clean neck skin over it
  for (const m of human.mats) {
    if (m.userData.kind !== 'head' || !m.map || m.userData.fringeFixed) continue;
    const H = read(m.map.image), d = H.d.data;
    const isSkin = (x, y) => { const i = (y * N + x) * 4; return d[i + 3] > 200 && d[i] > 90 && d[i] > d[i + 2] + 15 && d[i] + d[i + 1] + d[i + 2] > 270; };
    for (let x = 0; x < N; x++) {
      let yb = -1;
      for (let y = 780; y > 560; y--) if (isSkin(x, y)) { yb = y; break; }
      if (yb < 0) continue;
      const span = 46, src = yb - span - 8;
      for (let y = yb - span; y <= yb + 3; y++) {
        const t = clamp((y - (yb - span)) / span, 0, 1), i = (y * N + x) * 4, j = (src * N + x) * 4;
        const k = Math.min(1, t * 1.6);
        for (let c = 0; c < 3; c++) d[i + c] = d[i + c] * (1 - k) + d[j + c] * k;
        d[i + 3] = 255;
      }
    }
    // the lower neck / collarbone part of the head texture is paler than the body: bring it down to the chest tone
    for (let y = 500; y < 780; y++) {
      const f = 1 - 0.2 * sstep((y - 500) / 140);
      for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (d[i + 3] < 200 || !(d[i] > d[i + 2] + 10)) continue; d[i] *= f; d[i + 1] *= f * 0.985; d[i + 2] *= f * 0.97; }
    }
    H.g.putImageData(H.d, 0, 0);
    const t = new THREE.CanvasTexture(H.c); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
    m.map = t; m.needsUpdate = true; m.userData.fringeFixed = true;
  }
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    // mean skin colour (and luminance) from the arm strip of the texture, where the original skin shows
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 540; y < 760; y += 2) for (let x = 40; x < 270; x += 2) { const i = (y * N + x) * 4; r += a[i]; g += a[i + 1]; b += a[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    const skinLum = 0.299 * r + 0.587 * g + 0.114 * b;
    const paint = (x0, y0, x1, y1, test, flat) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (test && !test(i, x, y)) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        // keep a trace of the fabric folds as soft shading of the skin (muscle shadow), never the cloth edges
        const sh = flat ? 1 : Math.pow(clamp(L / 215, 0.55, 1.12), 0.55);
        a[i] = clamp(r * sh, 0, 255); a[i + 1] = clamp(g * sh, 0, 255); a[i + 2] = clamp(b * sh, 0, 255); a[i + 3] = 255;
        sk[i] = 255; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      }
    };
    // the whole tank-top island becomes bare skin: flat skin first, then musculature rasterised into the texture from the 3D positions
    paint(318, 24, 708, 884, null, true);
    torsoMuscle(human, a, sk, mk, N, r, g, b);
    // the shell's hem becomes the waistband of the trunks (the satba covers it)
    for (let y = 828; y < 884; y++) for (let x = 318; x < 708; x++) { const i = (y * N + x) * 4; a[i] = 214; a[i + 1] = 214; a[i + 2] = 214; a[i + 3] = 255; sk[i] = 0; mk[i] = 0; mk[i + 1] = 255; mk[i + 2] = 0; }
    paint(225, 868, 400, 1024);                                                                          // trainers -> bare feet
    paint(630, 868, 805, 1024);
    paint(0, 436, 330, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));                   // sock tops
    paint(700, 436, 1024, 500, (i) => mk[i + 2] > 100 || (a[i] > 200 && a[i + 1] > 200));
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(K.c, false);
    m.needsUpdate = true;
    void skinLum;
  }
}


// Smooth normals across the UV seams (positions that coincide share one normal), once per geometry: removes the hard shading steps at the armholes.
function weldNormals(geo) {
  if (geo.userData.welded) return; geo.userData.welded = true;
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map(), uv0 = geo.attributes.uv;
  const key = (i) => `${Math.round(p.getX(i) * 2000)},${Math.round(p.getY(i) * 2000)},${Math.round(p.getZ(i) * 2000)}`;
  for (let i = 0; i < p.count; i++) { const k = key(i); let e = map.get(k); if (!e) { e = [0, 0, 0]; map.set(k, e); } e[0] += n.getX(i); e[1] += n.getY(i); e[2] += n.getZ(i); }
  for (let i = 0; i < p.count; i++) { const e = map.get(key(i)); const l = Math.hypot(e[0], e[1], e[2]) || 1; n.setXYZ(i, e[0] / l, e[1] / l, e[2] / l); }
  // the shell's open rims (collar, armholes) stand proud of the neck and arm tubes as a ridge: tuck them under (rim vertices 1.3 cm, next ring 0.6 cm)
  {
    const ix = geo.index.array, key2 = (i) => `${Math.round(p.getX(i) * 2000)},${Math.round(p.getY(i) * 2000)},${Math.round(p.getZ(i) * 2000)}`;
    const inTorso = (i) => { const u = uv0.getX(i) * 1024, v = uv0.getY(i) * 1024; return u > 322 && u < 704 && v > 28 && v < 880 && p.getY(i) > 1.04; };
    const edges = new Map();
    for (let t = 0; t < ix.length; t += 3) {
      const tri = [ix[t], ix[t + 1], ix[t + 2]];
      if (tri[0] === tri[1] || tri[0] === tri[2] || tri[1] === tri[2]) continue;
      if (!tri.every(inTorso)) continue;
      for (let e = 0; e < 3; e++) {
        const a = key2(tri[e]), b = key2(tri[(e + 1) % 3]); const k = a < b ? a + '|' + b : b + '|' + a;
        edges.set(k, (edges.get(k) || 0) + 1);
      }
    }
    const rim = new Set();
    for (const [k, c] of edges) if (c === 1) { const [a, b] = k.split('|'); rim.add(a); rim.add(b); }
    const ring2 = new Set();
    for (let t = 0; t < ix.length; t += 3) {
      const tri = [ix[t], ix[t + 1], ix[t + 2]];
      if (!tri.every(inTorso)) continue;
      if (tri.some((i) => rim.has(key2(i)))) for (const i of tri) if (!rim.has(key2(i))) ring2.add(key2(i));
    }
    const done = new Set();
    for (let i = 0; i < p.count; i++) {
      if (!inTorso(i)) continue;
      if (Math.abs(p.getX(i)) < 0.11 && p.getY(i) > 1.36) continue;     // the collar stays: the head's neck patch sits there
      const k = key2(i), d = rim.has(k) ? 0.013 : ring2.has(k) ? 0.006 : 0; if (!d) continue;
      const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      p.setXYZ(i, p.getX(i) - nx * d, p.getY(i) - ny * d, p.getZ(i) - nz * d);
    }
    p.needsUpdate = true; void done;
  }
  // the shell is boxy: pull the torso normals toward a rounded (elliptic) body so the light wraps instead of stepping at the facets
  const uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i) * 1024, v = uv.getY(i) * 1024, y = p.getY(i);
    if (u < 322 || u > 704 || v < 28 || v > 880 || y < 0.9 || y > 1.52) continue;
    let nx = p.getX(i) / (0.17 * 0.17), nz = (p.getZ(i) - 0.02) / (0.13 * 0.13), ny = 0;
    const sh = smooth(1.36, 1.5, y); ny = sh * 35; nx *= 1 - 0.5 * sh;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const ox = n.getX(i), oy = n.getY(i), oz = n.getZ(i);
    const mx = ox * 0.4 + nx * 0.6, my = oy * 0.4 + ny * 0.6, mz = oz * 0.4 + nz * 0.6, ml = Math.hypot(mx, my, mz) || 1;
    n.setXYZ(i, mx / ml, my / ml, mz / ml);
  }
  n.needsUpdate = true;
}

// Shade of a bare male torso at a body point (metres, character space: x left, y up, z front; nz is the surface normal's front component).
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
function muscleShade(x, y, z, nx, nz) {
  const ax = Math.abs(x);
  let s = 1;
  if (nz > -0.15) {
    // pectorals: two soft lobes with a crisp lower edge, the sternum groove, collarbones
    const lobe = gauss(ax - 0.088, 0.058) * gauss(y - 1.335, 0.06);
    s *= 1 + 0.07 * lobe;
    const under = gauss(y - (1.272 - 0.012 * clamp(ax / 0.1, 0, 1)), 0.0085) * smooth(0.012, 0.035, ax) * (1 - smooth(0.13, 0.17, ax));
    s *= 1 - 0.2 * under;
    s *= 1 - 0.1 * gauss(x, 0.007) * smooth(1.1, 1.17, y) * (1 - smooth(1.34, 1.4, y));
    s *= 1 - 0.07 * gauss(y - 1.43, 0.008) * (1 - smooth(0.07, 0.13, ax));
    // nipples
    s *= 1 - 0.14 * gauss(ax - 0.093, 0.011) * gauss(y - 1.285, 0.011);
    // abdomen: linea alba, three rows of blocks, the soft lateral edge
    const abs = smooth(0.93, 0.98, y) * (1 - smooth(1.2, 1.25, y)) * (1 - smooth(0.06, 0.085, ax));
    s *= 1 - 0.14 * abs * gauss(x, 0.0055) * (1 - smooth(1.14, 1.2, y));
    for (const yy of [1.17, 1.095, 1.025]) s *= 1 - 0.13 * gauss(y - yy, 0.0075) * (1 - smooth(0.065, 0.085, ax)) * smooth(0.0, 0.012, ax + 0.012);
    s *= 1 + 0.035 * abs * Math.sin((y - 0.93) * 78 + 1.2) * Math.min(1, ax / 0.03 + 0.3);
    s *= 1 - 0.1 * gauss(ax - 0.085, 0.01) * smooth(0.95, 1.0, y) * (1 - smooth(1.18, 1.24, y));
  }
  if (nz < 0.25) {
    // back: spine groove, shoulder blades, lower-back dimples
    s *= 1 - 0.1 * gauss(x, 0.008) * smooth(0.9, 0.98, y) * (1 - smooth(1.4, 1.46, y));
    s *= 1 - 0.1 * gauss(ax - 0.1, 0.012) * gauss(y - 1.3, 0.07);
    s *= 1 + 0.045 * gauss(ax - 0.085, 0.05) * gauss(y - 1.31, 0.07);
  }
  // flanks fall into shade, armpits deepest
  s *= 1 - 0.1 * smooth(0.12, 0.2, ax) - 0.12 * gauss(ax - 0.19, 0.03) * gauss(y - 1.36, 0.06);
  return s;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Rasterise the shading of the torso triangles into the body texture (RGBA array `a`, skin mask `sk`, tint mask `mk`) at the UV positions.
function torsoMuscle(human, a, sk, mk, N, r, g, b) {
  let body = null;
  human.root.traverse((o) => { if (o.isSkinnedMesh && o.geometry.attributes.uv && /body_1|body$/.test(o.name) && o.material && o.material.userData && o.material.userData.kind === 'body') body = o; });
  if (!body) human.root.traverse((o) => { if (!body && o.isSkinnedMesh && o.material.userData && o.material.userData.kind === 'body') body = o; });
  if (!body) return;
  const geo = body.geometry; weldNormals(geo);
  const P = geo.attributes.position, U = geo.attributes.uv, Nn = geo.attributes.normal, ix = geo.index.array;
  const inBox = (i) => { const u = U.getX(i) * N, v = U.getY(i) * N; return u > 322 && u < 704 && v > 28 && v < 880; };
  for (let t = 0; t < ix.length; t += 3) {
    const i0 = ix[t], i1 = ix[t + 1], i2 = ix[t + 2];
    if (!inBox(i0) || !inBox(i1) || !inBox(i2)) continue;
    const ym = (P.getY(i0) + P.getY(i1) + P.getY(i2)) / 3; if (ym < 0.86 || ym > 1.56) continue;
    const ux = [U.getX(i0) * N, U.getX(i1) * N, U.getX(i2) * N], uy = [U.getY(i0) * N, U.getY(i1) * N, U.getY(i2) * N];
    const den = (uy[1] - uy[2]) * (ux[0] - ux[2]) + (ux[2] - ux[1]) * (uy[0] - uy[2]); if (Math.abs(den) < 1e-6) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...ux)) - 1), x1 = Math.min(N - 1, Math.ceil(Math.max(...ux)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...uy)) - 1), y1 = Math.min(N - 1, Math.ceil(Math.max(...uy)) + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((uy[1] - uy[2]) * (px - ux[2]) + (ux[2] - ux[1]) * (py - uy[2])) / den;
      const w1 = ((uy[2] - uy[0]) * (px - ux[2]) + (ux[0] - ux[2]) * (py - uy[2])) / den;
      const w2 = 1 - w0 - w1; if (w0 < -0.08 || w1 < -0.08 || w2 < -0.08) continue;
      const X = w0 * P.getX(i0) + w1 * P.getX(i1) + w2 * P.getX(i2), Y = w0 * P.getY(i0) + w1 * P.getY(i1) + w2 * P.getY(i2), Z = w0 * P.getZ(i0) + w1 * P.getZ(i1) + w2 * P.getZ(i2);
      const NX = w0 * Nn.getX(i0) + w1 * Nn.getX(i1) + w2 * Nn.getX(i2), NZ = w0 * Nn.getZ(i0) + w1 * Nn.getZ(i1) + w2 * Nn.getZ(i2);
      const s = clamp(muscleShade(X, Y, Z, NX, NZ), 0.6, 1.15);
      const k = (y * N + x) * 4;
      a[k] = clamp(r * s, 0, 255); a[k + 1] = clamp(g * s, 0, 255); a[k + 2] = clamp(b * s, 0, 255); a[k + 3] = 255; sk[k] = 255; mk[k] = 0; mk[k + 1] = 0; mk[k + 2] = 0;
    }
  }
}

// Bare feet: one lofted, flat-soled foot (heel, arch, ball) with five toes and ankle bones, in the person's skin colour, parented to the foot
// bone, plus an ankle cuff on the calf that covers the raw edge where the trainers were removed.
function footGeometry() {
  // sections: z (forward), y centre, half width, half height  (foot frame: x left, y up, z forward, ankle at the origin, sole at -0.10)
  const S = [
    [-0.0785, -0.084, 0.0015, 0.0015], [-0.074, -0.082, 0.009, 0.011], [-0.068, -0.078, 0.018, 0.02], [-0.058, -0.072, 0.026, 0.028], [-0.045, -0.068, 0.03, 0.031], [-0.03, -0.063, 0.035, 0.037], [0.0, -0.06, 0.037, 0.04],
    [0.035, -0.063, 0.0375, 0.0345], [0.07, -0.069, 0.041, 0.0285], [0.105, -0.081, 0.0465, 0.0205], [0.135, -0.0865, 0.0465, 0.0145], [0.16, -0.0905, 0.0425, 0.0105], [0.178, -0.093, 0.034, 0.0075], [0.186, -0.0945, 0.02, 0.005], [0.19, -0.095, 0.0015, 0.0015],
  ];
  const K = 18, pos = [], idx = [];
  const ex = 2.6;
  for (let i = 0; i < S.length; i++) {
    const [z, cy, hw, hh] = S[i];
    for (let k = 0; k < K; k++) {
      const ph = k / K * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      const sx = Math.sign(c) * Math.pow(Math.abs(c), 2 / ex), sy = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / ex);
      // the arch lifts the inner side of the sole
      const arch = (sy < 0 && c > 0.2 ? 0.006 * Math.exp(-Math.pow((z - 0.04) / 0.05, 2)) : 0);
      pos.push(sx * hw, cy + sy * hh + (sy < 0 ? arch : 0), z);
    }
  }
  for (let i = 0; i < S.length - 1; i++) for (let k = 0; k < K; k++) {
    const a = i * K + k, b = i * K + (k + 1) % K, c = a + K, d = b + K;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function addFeet(human, hex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });
  const toeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.97), roughness: 0.7, metalness: 0 });
  const nailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#ffe3d2'), 0.35), roughness: 0.4, metalness: 0 });
  const sph = new THREE.SphereGeometry(1, 14, 10);
  const geo = footGeometry();
  for (const side of ['L', 'R']) {
    const fb = human.bones[`Bip01_${side}_Foot`];
    const fr = human._sole[side];
    const upV = fr.up.clone().normalize(), fwdV = fr.fwd.clone().normalize();
    fwdV.addScaledVector(upV, -fwdV.dot(upV)).normalize();
    const leftV = upV.clone().cross(fwdV).normalize();
    const g = new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(leftV, upV, fwdV));
    g.add(new THREE.Mesh(geo, mat));
    const add = (m, p, sc) => { const o = new THREE.Mesh(sph, m); o.position.set(p[0], p[1], p[2]); o.scale.set(sc[0], sc[1], sc[2]); g.add(o); return o; };
    // ankle bones and the rounded heel pad
    add(mat, [0, -0.045, 0.004], [0.036, 0.044, 0.04]);
    const medial = side === 'L' ? -1 : 1;                              // the big toe is on the inner side
    // toes: (x, z, rx, ry, rz)
    const T = [[0.0245, 0.178, 0.0155, 0.0105, 0.0225], [0.0075, 0.176, 0.0105, 0.0088, 0.0195], [-0.0075, 0.17, 0.0098, 0.0082, 0.0175], [-0.0215, 0.162, 0.0092, 0.0078, 0.0155], [-0.0335, 0.15, 0.0085, 0.0072, 0.0135]];
    for (const [x, z, rx, ry, rz] of T) {
      add(toeMat, [medial * x, -0.0905, z + 0.004], [rx, ry, rz]);
      add(nailMat, [medial * x, -0.0905 + ry * 0.62, z + rz * 0.55], [rx * 0.62, ry * 0.5, rz * 0.5]);
    }
    fb.add(g); g.position.set(0, 0, 0);
  }
  // ankle sleeve: a SKINNED tube between the leg's cut edge and the foot, weighted calf (top) -> foot (bottom) on the human's own skeleton, so the
  // ankle bends like skin instead of a rigid collar
  const cuffMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.95), roughness: 0.74, metalness: 0, side: THREE.DoubleSide });
  let body = null; human.root.traverse((o) => { if (!body && o.isSkinnedMesh) body = o; });
  if (body) {
    const sk = body.skeleton;
    for (const side of ['L', 'R']) {
      const cb = human.bones[`Bip01_${side}_Calf`], fb = human.bones[`Bip01_${side}_Foot`];
      const ci = sk.bones.indexOf(cb), fi = sk.bones.indexOf(fb);
      if (ci < 0 || fi < 0) continue;
      const a0 = fb.getWorldPosition(new Vector3()), k0 = cb.getWorldPosition(new Vector3());
      const dir = k0.clone().sub(a0).normalize();
      const ref = Math.abs(dir.z) < 0.9 ? V(0, 0, 1) : V(1, 0, 0);
      const e1 = new Vector3().crossVectors(dir, ref).normalize(), e2 = new Vector3().crossVectors(dir, e1).normalize();
      const RS = 20, HS = 6, H0 = -0.012, H1 = 0.1, pos = [], si = [], sw = [], idx = [];
      for (let j = 0; j <= HS; j++) {
        const t = j / HS, h = H0 + (H1 - H0) * t;
        const rad = 0.0305 - 0.0085 * t;
        const wc = smooth(0.0, 0.85, t);                       // calf weight
        for (let k = 0; k < RS; k++) {
          const ph = k / RS * Math.PI * 2;
          const w = a0.clone().addScaledVector(dir, h).addScaledVector(e1, Math.cos(ph) * rad).addScaledVector(e2, Math.sin(ph) * rad);
          body.worldToLocal(w); pos.push(w.x, w.y, w.z);
          si.push(ci, fi, 0, 0); sw.push(wc, 1 - wc, 0, 0);
        }
      }
      for (let j = 0; j < HS; j++) for (let k = 0; k < RS; k++) { const aa = j * RS + k, bb = j * RS + (k + 1) % RS, cc = aa + RS, dd = bb + RS; idx.push(aa, bb, cc, bb, dd, cc); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(si), 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      geo.setIndex(idx); geo.computeVertexNormals();
      const sm = new THREE.SkinnedMesh(geo, cuffMat);
      sm.frustumCulled = false; sm.castShadow = true;
      body.parent.add(sm);
      sm.bind(sk, body.bindMatrix);
      sm.position.copy(body.position); sm.quaternion.copy(body.quaternion); sm.scale.copy(body.scale);
    }
  }
  return [mat, toeMat, cuffMat];
}

// ---------------------------------------------------------------------------------------------------------------------------------
// The satba: real wrapped cloth. A flattened-tube mesh with thickness, wound 2+ turns round the waist (layers overlap, fold waves, a woven
// texture), a knot with loops and two tails at the near hip, a gathered grip loop at the back, and the same on the right thigh. The cloth is
// parented to the bones, so it follows every pose. Geometry is authored in the rest pose, character space (x left, y up, z front, metres).
const V = (x, y, z) => new Vector3(x, y, z);
const UPV = V(0, 1, 0);

function weaveTexture(hex) {
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64);
  for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(0,0,0,${x % 4 === 0 ? 0.13 : 0.04})`; g.fillRect(x, 0, 1, 64); }
  for (let y = 0; y < 64; y += 2) { g.fillStyle = `rgba(255,255,255,${y % 4 === 0 ? 0.1 : 0})`; g.fillRect(0, y, 128, 1); }
  const grad = g.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.22)'); grad.addColorStop(0.15, 'rgba(0,0,0,0)'); grad.addColorStop(0.85, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  void hex; return t;
}

// A rounded-rectangle tube along `pts`. wd[i]: the cloth's width direction, as[i]/bs[i]: half width / half thickness. Ends are capped.
function flatTube(pts, wd, as, bs, sides = 12, uvLen = 1) {
  const n = pts.length, pos = [], uv = [], idx = [];
  const T = new Vector3(), W = new Vector3(), N = new Vector3();
  let len = 0;
  for (let i = 0; i < n; i++) {
    T.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
    W.copy(wd[i]); W.addScaledVector(T, -W.dot(T)).normalize();
    N.crossVectors(T, W).normalize();
    if (i) len += pts[i].distanceTo(pts[i - 1]);
    for (let k = 0; k <= sides; k++) {
      const ph = (k % sides) / sides * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
      const cx = Math.sign(c) * Math.pow(Math.abs(c), 0.5), sy = Math.sign(sn) * Math.pow(Math.abs(sn), 0.75);
      pos.push(pts[i].x + W.x * as[i] * cx + N.x * bs[i] * sy, pts[i].y + W.y * as[i] * cx + N.y * bs[i] * sy, pts[i].z + W.z * as[i] * cx + N.z * bs[i] * sy);
      uv.push(len * uvLen, k / sides);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < sides; k++) {
    const a = i * row + k, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  for (const [ring, flip] of [[0, true], [n - 1, false]]) {
    const ci = pos.length / 3; const o = ring * row;
    let sx = 0, sy = 0, sz = 0; for (let k = 0; k < sides; k++) { sx += pos[(o + k) * 3]; sy += pos[(o + k) * 3 + 1]; sz += pos[(o + k) * 3 + 2]; }
    pos.push(sx / sides, sy / sides, sz / sides); uv.push(0, 0.5);
    for (let k = 0; k < sides; k++) { const a = o + k, b = o + k + 1; if (flip) idx.push(ci, b, a); else idx.push(ci, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
const catmull = (ctrl, n) => { const c = new THREE.CatmullRomCurve3(ctrl); return c.getSpacedPoints(n); };

// Measure the body's cross-section near a height: the centre and a radius profile R(theta) (theta: x = cos, z = sin) from the torso vertices.
function waistSection(human, y0, dy) {
  const pts = [];
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material.userData || o.material.userData.kind !== 'body') return;
    const P = o.geometry.attributes.position, U = o.geometry.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), u = U.getX(i) * 1024, v = U.getY(i) * 1024;
      if (Math.abs(y - y0) > dy || u < 322 || u > 704 || v < 28 || v > 880) continue;
      const x = P.getX(i), z = P.getZ(i); if (Math.abs(x) > 0.3) continue;
      pts.push([x, z]);
    }
  });
  let mnx = 9, mxx = -9, mnz = 9, mxz = -9;
  for (const [x, z] of pts) { mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); }
  const cx = (mnx + mxx) / 2, cz = (mnz + mxz) / 2, K = 48, R = new Array(K).fill(0);
  for (const [x, z] of pts) { const k = Math.floor((Math.atan2(z - cz, x - cx) + Math.PI) / (Math.PI * 2) * K) % K; R[k] = Math.max(R[k], Math.hypot(x - cx, z - cz)); }
  const fallback = Math.max(mxx - mnx, mxz - mnz) / 2;
  for (let k = 0; k < K; k++) if (!R[k]) R[k] = fallback;
  const S = R.map((_, k) => (R[(k + K - 1) % K] + 2 * R[k] + R[(k + 1) % K]) / 4);
  const radius = (th) => { const f = ((th + Math.PI) / (Math.PI * 2) * K) % K; const k = ((Math.floor(f) % K) + K) % K, t = f - Math.floor(f); return S[k] * (1 - t) + S[(k + 1) % K] * t; };
  return { cx, cz, rx: (mxx - mnx) / 2, rz: (mxz - mnz) / 2, radius };
}

function makeSash(human, hex, side) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const out = { meshes: [], mats: [] };
  const tex = weaveTexture(hex);
  const mat = new THREE.MeshStandardMaterial({ color: hex, map: tex, roughness: 0.78, metalness: 0, side: THREE.DoubleSide });
  const matD = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).multiplyScalar(0.8), map: tex, roughness: 0.82, metalness: 0, side: THREE.DoubleSide });
  out.mats.push(mat, matD);
  const near = side === 0 ? -1 : 1;                       // character-space x of the side the camera sees (side 0 faces +X, so its right, -x, is the near one)
  const origin = human.root.getWorldPosition(new Vector3());
  const attach = (bone, obj) => {
    const b = human.bones[`Bip01_${bone}`];
    const inv = b.getWorldQuaternion(new Quaternion()).invert();
    obj.quaternion.copy(inv);
    obj.position.copy(origin.clone().sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv));
    b.add(obj);
  };
  const add = (grp, geo, m) => { const mesh = new THREE.Mesh(geo, m); grp.add(mesh); return mesh; };
  const tail = (grp, from, dirOut, len, width, sway, m, seed) => {
    // a ribbon hanging from the knot: out of the knot, then down, with fold waves and a slight twist
    const pts = [], wd = [], as = [], bs = [], n = 14;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const p = from.clone();
      p.addScaledVector(dirOut, 0.03 * Math.sin(t * Math.PI * 0.8) + sway.x * t * t);
      p.y -= len * t; p.z += sway.z * t * t + 0.006 * Math.sin(t * 9 + seed);
      pts.push(p);
      const tw = 0.7 * Math.sin(t * 3.1 + seed) + 0.4;
      wd.push(V(Math.cos(tw), 0, Math.sin(tw)));
      as.push(width * (0.55 + 0.45 * Math.min(1, t * 4 + 0.3)) * (1 + 0.12 * Math.sin(t * 13 + seed)) * (1 - 0.2 * t * t));
      bs.push(0.0045 * (1 + 0.5 * Math.sin(t * 11 + seed * 2)));
    }
    return add(grp, flatTube(pts, wd, as, bs, 8, 20), m);
  };
  const knotLump = (grp, c, r, m) => { const k = add(grp, new THREE.SphereGeometry(r, 14, 10), m); k.position.copy(c); k.scale.set(1, 0.85, 0.9); return k; };

  // ---- waist ----
  const yW = 0.96;
  const sec = waistSection(human, yW, 0.03);
  const wrap = new THREE.Group();
  {
    const turns = 1.85, N = 150, pitch = 0.024, aW = 0.031, y00 = 0.934;
    const thK = Math.atan2(0.5, 0.86 * near);                 // the knot angle (front-near hip)
    const th0 = thK - Math.PI * 2 * turns;
    const pts = [], wd = [], as = [], bs = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, th = th0 + t * Math.PI * 2 * turns, turn = t * turns;
      const base = sec.radius(th) + 0.012 + 0.009 * turn + 0.004 * Math.sin(th * 5 + turn * 3);
      pts.push(V(sec.cx + base * Math.cos(th), y00 + pitch * turn + 0.0035 * Math.sin(th * 3 + 1), sec.cz + base * Math.sin(th)));
      const tilt = 0.2 * Math.sin(th * 2 + turn);
      wd.push(V(tilt * Math.cos(th) * 0.5, 1, tilt * Math.sin(th) * 0.5));
      as.push(aW * (1 + 0.08 * Math.sin(th * 7 + turn * 2.1)));
      bs.push(0.0055 * (1 + 0.4 * Math.sin(th * 9 + turn)));
    }
    add(wrap, flatTube(pts, wd, as, bs, 12, 22), mat);
    const kp = pts[pts.length - 1];
    const outd = V(near, 0, 0.35).normalize();
    // the knot: a folded pad lying across the belt, with a pinched centre
    const pad = [], pw = [], pa = [], pb = [];
    for (let i = 0; i < 7; i++) {
      const t = i / 6 - 0.5;
      pad.push(kp.clone().add(V(near * 0.012, 0.002 + t * 0.075, 0.016 + 0.006 * Math.cos(t * 3))));
      pw.push(V(0.6 * near, 0.0, 0.8).normalize()); pa.push(0.03 * (1 - 0.7 * Math.pow(Math.abs(t) * 2, 2.2) * 0.4) * (1 - 0.3 * Math.exp(-t * t * 90))); pb.push(0.0085 * (1 + 0.8 * Math.exp(-t * t * 60)));
    }
    add(wrap, flatTube(pad, pw, pa, pb, 10, 20), matD);
    tail(wrap, kp.clone().add(V(near * 0.016, -0.022, 0.024)), outd, 0.25, 0.026, V(near * 0.03, 0, 0.03), mat, 1.3);
    tail(wrap, kp.clone().add(V(near * 0.01, -0.022, 0.02)), outd, 0.19, 0.022, V(near * -0.012, 0, 0.045), matD, 4.1);
    // gathered grip loop at the back, on the character's left (the rival's right hand takes it)
    const thG = Math.atan2(-0.3, 0.95);
    const gr = sec.radius(thG) + 0.02;
    const gp = V(sec.cx + gr * Math.cos(thG), y00 + 0.035, sec.cz + gr * Math.sin(thG));
    const hp = [], hwd = [], has = [], hbs = [], H = 12;
    const dirG = V(Math.cos(thG), 0, Math.sin(thG));
    for (let i = 0; i < H; i++) {
      const t = i / (H - 1), u = Math.sin(Math.PI * t);
      hp.push(gp.clone().addScaledVector(dirG, 0.05 * u).add(V(0, 0.07 * (t - 0.5), 0)));
      hwd.push(V(-dirG.z, 0, dirG.x)); has.push(0.017 * (1 + 0.2 * u)); hbs.push(0.0075);
    }
    add(wrap, flatTube(hp, hwd, has, hbs, 10, 30), matD);
    const mk = new THREE.Group(); mk.position.copy(gp.clone().addScaledVector(dirG, 0.04)); wrap.add(mk); out.grip = mk;
  }
  attach('Spine', wrap);
  out.meshes.push(wrap);

  // ---- right thigh (character right, -x) ----
  const th = human.bones.Bip01_R_Thigh.getWorldPosition(new Vector3());
  const ca = human.bones.Bip01_R_Calf.getWorldPosition(new Vector3());
  const ax = ca.clone().sub(th).normalize();
  const cen = th.clone().lerp(ca, 0.38);
  // thigh radius profile (trunk leg included) from the mesh around the thigh axis
  const KT = 24, RT = new Array(KT).fill(0);
  const e1 = V(0, 0, 1).addScaledVector(ax, -ax.z).normalize(), e2 = new Vector3().crossVectors(ax, e1).normalize();
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || !o.material.userData || o.material.userData.kind !== 'body') return;
    const P = o.geometry.attributes.position, tmp = new Vector3();
    for (let i = 0; i < P.count; i++) {
      tmp.fromBufferAttribute(P, i).sub(cen);
      const along = tmp.dot(ax); if (Math.abs(along) > 0.035) continue;
      tmp.addScaledVector(ax, -along);
      const d = tmp.length(); if (d > 0.22) continue;
      if (cen.x + tmp.x > -0.015) continue;                              // right leg only
      const k = Math.floor((Math.atan2(tmp.dot(e2), tmp.dot(e1)) + Math.PI) / (Math.PI * 2) * KT) % KT;
      RT[k] = Math.max(RT[k], d);
    }
  });
  const mean = RT.filter(Boolean).reduce((m, v, _, A) => m + v / A.length, 0) || 0.1;
  for (let k = 0; k < KT; k++) if (!RT[k]) RT[k] = mean;
  const RTs = RT.map((_, k) => (RT[(k + KT - 1) % KT] + 2 * RT[k] + RT[(k + 1) % KT]) / 4);
  const thR = (a) => { const f = ((a + Math.PI) / (Math.PI * 2) * KT) % KT, k = ((Math.floor(f) % KT) + KT) % KT, t = f - Math.floor(f); return RTs[k] * (1 - t) + RTs[(k + 1) % KT] * t; };
  const ctr = new Vector3(), rr = mean, cn = 0;
  const tg = new THREE.Group();
  {
    const turns = 1.8, N = 90, aT = 0.026, pitch = 0.02;
    const c0 = cen.clone().add(ctr);
    const thK = Math.atan2(0.95, 0.35);                       // knot on the outer-front side of the thigh (e2 is the outer, -x, direction)
    const th0 = thK - Math.PI * 2 * turns;
    const pts = [], wd = [], as = [], bs = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, a = th0 + t * Math.PI * 2 * turns, turn = t * turns;
      const r = (thR(a) + 0.01 + 0.007 * turn) * (1 + 0.015 * Math.sin(a * 4 + turn * 2));
      const p = c0.clone().addScaledVector(e1, r * Math.cos(a)).addScaledVector(e2, r * Math.sin(a)).addScaledVector(ax, -0.025 + pitch * turn + 0.003 * Math.sin(a * 3));
      pts.push(p); wd.push(ax.clone()); as.push(aT * (1 + 0.1 * Math.sin(a * 6 + turn))); bs.push(0.0055 * (1 + 0.4 * Math.sin(a * 8 + turn)));
    }
    add(tg, flatTube(pts, wd, as, bs, 12, 22), mat);
    const kp = pts[pts.length - 1];
    const outd = kp.clone().sub(c0).addScaledVector(ax, -kp.clone().sub(c0).dot(ax)).normalize();
    {
      const pad = [], pw = [], pa = [], pb = [];
      for (let i = 0; i < 7; i++) { const t = i / 6 - 0.5; pad.push(kp.clone().addScaledVector(outd, 0.014).addScaledVector(ax, t * 0.07)); pw.push(e2.clone()); pa.push(0.026 * (1 - 0.3 * Math.exp(-t * t * 90))); pb.push(0.008 * (1 + 0.8 * Math.exp(-t * t * 60))); }
      add(tg, flatTube(pad, pw, pa, pb, 10, 20), matD);
    }
    const mk2 = (from, len, w, sw, m, seed) => {
      const pts2 = [], wd2 = [], as2 = [], bs2 = [], n2 = 12;
      for (let i = 0; i < n2; i++) {
        const t = i / (n2 - 1);
        const p = from.clone().addScaledVector(outd, 0.02 * Math.sin(t * 2.5) + sw * t * t).addScaledVector(ax, len * t).addScaledVector(e2, 0.01 * Math.sin(t * 8 + seed));
        pts2.push(p); wd2.push(e2.clone().multiplyScalar(Math.cos(0.6 * t + seed * 0.2)).addScaledVector(outd, Math.sin(0.6 * t + seed * 0.2)));
        as2.push(w * (0.6 + 0.4 * Math.min(1, t * 4)) * (1 + 0.1 * Math.sin(t * 12 + seed))); bs2.push(0.0042);
      }
      add(tg, flatTube(pts2, wd2, as2, bs2, 8, 20), m);
    };
    mk2(kp.clone().addScaledVector(outd, 0.01), 0.17, 0.021, 0.025, matD, 0.7);
    mk2(kp.clone().addScaledVector(outd, 0.005).addScaledVector(e2, 0.012), 0.13, 0.018, -0.01, mat, 2.2);
    // grip loop on the outer-front of the thigh (the rival's left hand takes it)
    const gdir = outd.clone().multiplyScalar(0.8).addScaledVector(e1, 0.0).add(V(0, 0, 0.25)).normalize();
    const base = c0.clone().addScaledVector(gdir, rr + 0.012).addScaledVector(ax, 0.01);
    const hp = [], hwd = [], has = [], hbs = [], H = 12;
    const perp = new Vector3().crossVectors(gdir, ax).normalize();
    for (let i = 0; i < H; i++) {
      const t = i / (H - 1), u = Math.sin(Math.PI * t);
      hp.push(base.clone().addScaledVector(gdir, 0.05 * u).addScaledVector(ax, 0.07 * (t - 0.5)));
      hwd.push(perp.clone()); has.push(0.015); hbs.push(0.007);
    }
    add(tg, flatTube(hp, hwd, has, hbs, 10, 30), matD);
    const mk = new THREE.Group(); mk.position.copy(base.clone().addScaledVector(gdir, 0.048)); tg.add(mk); out.thighGrip = mk;
  }
  attach('R_Thigh', tg);
  out.meshes.push(tg);
  out.thigh = out.thighGrip;
  void cn;
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createWrestlers({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: quality !== 'low', shadowSize: 3.2, lighting: 'day', fov: 20 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const world = createWorld(stage, { quality });
  const spec = (hex) => ({ character: 'athlete_m', base, kit: { top: '#ffffff', bottoms: hex, socks: '#ffffff' }, skin: '#d9a47c', hair: 'black' });
  const SASH = ['#c8312f', '#2c5fb8'];
  const FEET = ['#d9a47c', '#d9a47c'];
  const humans = await Promise.all([loadHuman(spec('#f1e8d2')), loadHuman(spec('#f1e8d2'))]);
  const footMats = humans.map((h, i) => { bareBody(h); return addFeet(h, FEET[i]); });
  const ws = humans.map((h, i) => new Wrestler(h, i, SASH[i]));
  for (const w of ws) { stage.add(w.h); stage.track(w.h); }
  const cam = stage.camera;
  cam.fov = 20; cam.near = 0.5; cam.far = 400;
  for (const h of humans) h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } });
  const api = {
    stage, ws, quality, footMats, world,
    fitted: { w: 0, h: 0 },
    ok: true, lost: false,
  };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted.w = 0; api.fitted.sig = ''; });
  return Object.assign(api, makeApi(api));
}

// camera: near-orthographic, a little above and in front of the pair so the grips and the faces read
const CAM = { dist: 9.5, yaw: 36 * D2R, pitch: 14 * D2R };

function makeApi(api) {
  const { stage, ws, world } = api;
  const cam = stage.camera, renderer = stage.renderer;
  const v = new Vector3(), v2 = new Vector3(), qy = new Quaternion();
  const up = new Vector3(0, 1, 0);

  // region: the part of the design world the picture covers { x, y, w, h } (design units; floor at y = 420, centre line at x = 360)
  function frameCamera(devW, devH, rg) {
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    const hM = rg.h / PX_PER_M, D = CAM.dist;
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R;
    const cx = (rg.x + rg.w / 2 - CX) / PX_PER_M;                           // metres
    const cyM = (FLOOR - (rg.y + rg.h / 2)) / PX_PER_M;                     // metres above the floor at the region centre
    const tgt = new Vector3(cx, cyM, 0);
    cam.position.set(tgt.x + D * Math.sin(CAM.yaw) * Math.cos(CAM.pitch), tgt.y + D * Math.sin(CAM.pitch), tgt.z + D * Math.cos(CAM.yaw) * Math.cos(CAM.pitch));
    cam.lookAt(tgt);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    // shift so that the floor point under the centre line lands exactly on the design FLOOR row / CX column
    const p = new Vector3(0, 0, 0).project(cam);
    const wantY = 1 - 2 * (FLOOR - rg.y) / rg.h, wantX = 2 * (CX - rg.x) / rg.w - 1;
    const e = cam.projectionMatrix.elements;
    e[8] -= (wantX - p.x); e[9] -= (wantY - p.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  // one wrestler's solved body for this frame (character-space targets; world positions come from the root transform)
  function solve(w, p, other, t, over) {
    const s = w.side, f = s === 0 ? 1 : -1;
    const lean = clamp(p.lean, -1.2, 1.2), sway = clamp(p.sway, -1.2, 1.2);
    const fall = sstep(p.fall), win = sstep(p.win), fd = p.fallDir || 1;
    const act = p.act || 0, kind = p.actKind || 'none';
    const adir = p.actDir || 0, ax = Math.sin(adir * Math.PI / 4), ay = Math.cos(adir * Math.PI / 4);
    const breath = Math.sin(t * 2.2 + s * 1.7);
    const pull = kind === 'pull' ? act : 0, hook = kind === 'hook' ? act : 0, brace = kind === 'brace' ? act : 0;

    // pelvis (relative to the ground point between the feet: left, up, forward)
    let crouch = 0.285 + brace * 0.05 + Math.abs(sway) * 0.025 + hook * 0.02 - win * 0.2;
    let pelU = 0.895 - crouch + breath * 0.004;
    let pelF = -0.03 + lean * 0.09 - pull * 0.07 + brace * 0.03;
    let pelL = -sway * 0.05 + ax * pull * 0.03;
    let flex = 38 + lean * 15 - pull * 9 + brace * 4 - win * 52;       // total forward lean of the trunk, degrees
    let sideLean = -sway * 8;
    let twist = ax * pull * 10 + (hook ? -ax * 6 * hook : 0);
    let headFlex = -flex * 0.5 + 6 + win * 10;
    // stance: a lead (right) and trail foot, wider when braced
    const spread = 0.20 + brace * 0.03;
    const feet = {
      R: { l: -spread, u: 0, f: 0.27 + lean * 0.03 },       // avatar-right is -x
      L: { l: spread, u: 0, f: -0.25 },
    };
    if (hook > 0) { const e = Math.sin(Math.PI * clamp(1 - hook, 0, 1)); feet.L = { l: spread - 0.1 * e, u: 0.16 * e, f: -0.25 + (0.55 + ay * 0.12) * e }; }
    // falling
    const ft = fall;
    let fallArms = null;
    if (ft > 0) {
      if (fd < 0) {            // backwards onto the sand: hips drop and slide back, the trunk goes over
        pelU = lerp(pelU, 0.14, ft); pelF = lerp(pelF, -0.3, ft); flex = lerp(flex, -72, ft); headFlex = lerp(headFlex, 14, ft);
        feet.R.f = lerp(feet.R.f, -0.28, ft); feet.L.f = lerp(feet.L.f, -0.42, ft);
        feet.R.l = lerp(feet.R.l, -0.24, ft); feet.L.l = lerp(feet.L.l, 0.22, ft);
        fallArms = { kind: 'back', k: ft };
      } else {                 // forwards onto the hands and knees
        pelU = lerp(pelU, 0.4, ft); pelF = lerp(pelF, 0.12, ft); flex = lerp(flex, 78, ft); headFlex = lerp(headFlex, -42, ft);
        fallArms = { kind: 'fwd', k: ft };
      }
      twist *= 1 - ft;
    }
    return { s, f, pelL, pelU, pelF, flex, sideLean, twist, headFlex, feet, fallArms, win, fall: ft, pull, hook, brace, lean, sway, kind };
  }

  // bone offsets for a solved body
  function offsets(S) {
    const o = {};
    const fl = S.flex;
    o.Pelvis = { flex: fl * 0.22, side: S.sideLean * 0.2, twist: S.twist * 0.15 };
    o.Spine = { flex: fl * 0.26, side: S.sideLean * 0.3, twist: S.twist * 0.3 };
    o.Spine1 = { flex: fl * 0.26, side: S.sideLean * 0.3, twist: S.twist * 0.35 };
    o.Spine2 = { flex: fl * 0.26, side: S.sideLean * 0.2, twist: S.twist * 0.2 };
    o.Neck = { flex: S.headFlex * 0.55, twist: 6 * (S.s === 0 ? 1 : 1) };
    o.Head = { flex: S.headFlex * 0.45 };
    // rough knee bend; IK on the feet finishes it
    const th = 62 - S.win * 40, ca = 74 - S.win * 48;
    o.R_Thigh = { flex: th + 8, abduct: 10 }; o.L_Thigh = { flex: th - 6, abduct: 10 };
    o.R_Calf = { flex: ca + 4 }; o.L_Calf = { flex: ca - 4 };
    return o;
  }

  // world transform helpers
  const toWorld = (w, l, u, f, out) => out.set(l, u, f).applyAxisAngle(up, w.yaw).add(w.h.root.position);

  // ---- hands: five distinct fingers, curl driven from the grip state (never a mitten) ----
  const FP = FINGER_POSES;
  const FPOSE = {
    // hooked round the satba: fingers wrapped, little finger tightest, thumb pressing along the band
    hook: [[0.5, 0.72, 0.42], [1.08, 1.38, 0.9], [1.16, 1.48, 0.96], [1.24, 1.56, 1.0], [1.3, 1.6, 1.02]],
    // open and relaxed (celebration, balancing): fingers long and slightly fanned
    open: [[0.12, 0.18, 0.1], [0.1, 0.26, 0.16], [0.12, 0.3, 0.2], [0.16, 0.34, 0.22], [0.2, 0.38, 0.26]],
    // palm pressing on the sand: fingers spread, finger pads down
    brace: [[0.18, 0.22, 0.12], [0.14, 0.34, 0.22], [0.16, 0.38, 0.24], [0.18, 0.4, 0.26], [0.22, 0.44, 0.28]],
    // a hand left hanging while the body goes over
    loose: [[0.22, 0.28, 0.14], [0.3, 0.42, 0.28], [0.36, 0.5, 0.32], [0.42, 0.56, 0.36], [0.48, 0.6, 0.4]],
    // pushing flat palm
    push: [[0.1, 0.12, 0.06], [0.06, 0.12, 0.08], [0.06, 0.12, 0.08], [0.08, 0.14, 0.1], [0.1, 0.16, 0.12]],
  };
  const SPREAD = { hook: [0.02, 0, 0, 0, 0.02], open: FP.open.spread.map((x) => -x * 1.5), brace: FP.open.spread.map((x) => -x * 1.9), loose: FP.open.spread.map((x) => -x * 0.8), push: FP.open.spread.map((x) => -x * 1.1) };
  const handCache = {};
  function fingers(kind, squeeze = 0, t = 0, seed = 0) {
    const base = FPOSE[kind];
    // squeeze: 0..1 adds curl on the hooked grip; open hands flutter a little so they are alive
    const flutter = kind === 'open' ? 0.05 : 0;
    const out = base.map((r, f) => r.map((c, k) => c * (1 + 0.1 * squeeze) + flutter * Math.sin(t * 5.1 + f * 0.9 + k * 0.5 + seed)));
    const key = kind + seed;
    const o = handCache[key] || (handCache[key] = { curl: null, spread: SPREAD[kind] });
    o.curl = out; return o;
  }
  const camDir = new Vector3(Math.sin(CAM.yaw), 0.12, Math.cos(CAM.yaw)).normalize();
  const tmpA = new Vector3(), tmpB = new Vector3(), tmpC = new Vector3();
  const edge = [{ act: 0, fall: 0, win: 0 }, { act: 0, fall: 0, win: 0 }];
  const evq = [];   // events for the world, drained in draw()

  /**
   * Pose both wrestlers from the 2D picture's pose springs and advance the animation by dt.
   * pose: { s: [{lean, sway, fall, fallDir, win, act, actKind, actDir}, ...] }, builds: [b0, b1] (scale), looks: [{skin, hair}, ...]
   */
  api.pose = function (pose, t, dt, builds) {
    const S = ws.map((w, i) => solve(w, pose.s[i], ws[1 - i], t));
    ws.forEach((w, i) => {
      const bld = (builds && builds[i]) || 1, s = S[i];
      w.h.root.scale.setScalar(bld);
      const gap = 0.25;                                // half distance between the two ground points
      const zOff = i === 0 ? 0.21 : -0.21;           // each head passes the rival's shoulder on its own side
      const gx = (i === 0 ? -gap : gap), gz = zOff;
      w.h.root.position.set(gx, 0, gz);
      w.h.root.rotation.y = w.yaw; w.h.facing = w.yaw;
      w.writePose(offsets(s), [s.pelL, s.pelU - 0.895, s.pelF]);
      // feet
      for (const side of ['L', 'R']) {
        const ft = s.feet[side];
        toWorld(w, ft.l * bld, (ft.u + w.h._ankleRest) * bld, ft.f * bld, v);
        const rq = w.h._restQ[`${side}_Foot`];
        qy.setFromAxisAngle(up, w.yaw);
        const fq = qy.clone().multiply(rq);
        w.h.setReachFoot(side, v, 1, fq);
      }
      w.h.setReach('L', null); w.h.setReach('R', null);
    });
    // world events from the pose springs (sand kicks and the crowd's reactions)
    ws.forEach((w, i) => {
      const p = pose.s[i], e = edge[i];
      if (p.act > 0.97 && e.act <= 0.97) evq.push({ type: 'act', i, kind: p.actKind, dir: p.actDir });
      if (p.fall > 0.05 && e.fall <= 0.05) evq.push({ type: 'fall', i, dir: p.fallDir });
      if (p.fall > 0.85 && e.fall <= 0.85) evq.push({ type: 'down', i, dir: p.fallDir });
      if (p.win > 0.3 && e.win <= 0.3) evq.push({ type: 'win', i });
      e.act = p.act; e.fall = p.fall; e.win = p.win;
    });
    // phase 1: bodies without hands
    for (const w of ws) w.h.update(dt);
    // phase 2: hands, then the final solve (stage/mixers have advanced first; overrides, props and cloth follow the posed bones)
    ws.forEach((w, i) => {
      const o = ws[1 - i], s = S[i];
      const bld = (builds && builds[i]) || 1;
      const sh = (side) => w.h.bonePosition ? w.h.bonePosition(`${side}_UpperArm`, tmpC) : tmpC.set(0, 1.4, 0);
      if (s.win > 0.05 || s.fall > 0.15) {
        const k = s.win > 0.05 ? s.win : s.fall;
        for (const side of ['L', 'R']) {
          const sg = side === 'L' ? 1 : -1;
          let target, pole, palm, fdir, kind;
          if (s.win > 0.05) {
            // the champion's arms: one fist-high-but-open hand raised overhead with a bent elbow, the other out to the crowd, palms to the stands
            if (sg > 0) { target = [0.52 + Math.sin(t * 3.1) * 0.02, 1.5 + Math.sin(t * 5) * 0.02, 0.1]; pole = [0.62, 0.95, -0.28]; }
            else { target = [-0.34 + Math.sin(t * 3.4) * 0.03, 1.72 + Math.sin(t * 4.4 + 1) * 0.025, 0.04]; pole = [-0.62, 1.2, -0.34]; }
            palm = camDir.clone(); fdir = new Vector3(sg > 0 ? 0.35 : -0.1, 1, 0.1);
            kind = 'open';
          } else if (s.fallArms && s.fallArms.kind === 'fwd') {
            target = [sg * 0.2, 0.05, 0.55]; pole = [sg * 0.55, 0.5, 0.0];
            palm = new Vector3(0, -1, 0); fdir = new Vector3(0, 0, 1).applyAxisAngle(up, w.yaw);
            kind = 'brace';
          } else {
            target = [sg * 0.6, 0.1 + 0.4 * (1 - s.fall), -0.5 * s.fall - 0.1]; pole = [sg * 0.7, 0.3, -0.2];
            palm = new Vector3(0, -1, 0); fdir = new Vector3(0, 0, -1).applyAxisAngle(up, w.yaw).add(new Vector3(0, 0.0, 0));
            kind = s.fall > 0.9 ? 'brace' : 'loose';
          }
          toWorld(w, target[0] * bld, target[1] * bld, target[2] * bld, v);
          const tp = toWorld(w, pole[0] * bld, pole[1] * bld, pole[2] * bld, tmpA).clone();
          if (s.win > 0.05) { palm.applyAxisAngle(up, 0); }
          const q = handQuat(w.h, side, palm, fdir);
          w.h.setReach(side, v, { weight: clamp(k * 3, 0, 1), pole: tp, quat: q });
          w.h.setFingers(side, fingers(kind, 0, t, i * 3 + (sg > 0 ? 1 : 2)), { rate: 14 });
        }
      } else {
        // right hand: the rival's waist satba at the back; left hand: the rival's thigh band. Palms toward the cloth, fingers hooked over it.
        const press = clamp(s.pull + 0.25 * s.brace, 0, 1);
        const bodyC = o.h.bones.Bip01_Spine ? o.h.bones.Bip01_Spine.getWorldPosition(tmpB) : tmpB.copy(o.h.root.position);
        // right
        const gR = o.sash.grip.getWorldPosition(v2);
        const palmR = tmpA.copy(bodyC).sub(gR); palmR.y = 0; palmR.normalize();
        const wristR = gR.clone().addScaledVector(palmR, -0.02); wristR.y += 0.05;
        const tug = (s.pull ? 0.05 * s.pull : 0);
        wristR.addScaledVector(tmpC.set(Math.sin(w.yaw), 0, Math.cos(w.yaw)), -tug);
        w.h.setReach('R', wristR, { weight: 1, quat: handQuat(w.h, 'R', palmR.clone(), new Vector3(0, -1, 0.15).applyAxisAngle(up, w.yaw)) });
        // left
        const tb = o.sash.thigh.getWorldPosition(new Vector3());
        const tc = o.h.bones.Bip01_R_Thigh.getWorldPosition(tmpB);
        const palmL = tmpA.copy(tc).sub(tb); palmL.y = 0; palmL.normalize();
        const wristL = tb.clone().addScaledVector(palmL, -0.02); wristL.y += 0.05;
        w.h.setReach('L', wristL, { weight: 1, quat: handQuat(w.h, 'L', palmL.clone(), new Vector3(0, -1, 0.1)) });
        w.h.setFingers('R', fingers('hook', press, t, i * 3), { rate: 14 }); w.h.setFingers('L', fingers('hook', press, t, i * 3 + 1), { rate: 14 });
      }
    });
    for (const w of ws) w.h.update(0);
  };

  let curRing = '', lastT = null;
  const curLook = [null, null];
  const RING_LIGHT = { danoh: 'day', moon: 'night', court: 'evening' };
  const skinTone = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  function look(i, lk) {
    const key = lk.skin + lk.hair;
    if (curLook[i] === key) return;
    curLook[i] = key;
    const c = skinTone(lk.skin, 0.93);
    ws[i].h.setSkin('#' + c.getHexString()); ws[i].h.setHair(lk.hair);
    for (const m of api.footMats[i]) m.color.copy(c).multiplyScalar(m === api.footMats[i][1] ? 0.96 : 1);
  }
  // cost guard: if the average frame cost of the 3D picture stays high, drop to the cheap tier once
  const cost = { ema: 0, n: 0, low: false };
  /**
   * Draw the pair into the 2D picture. ctx is already transformed to the design world (floor at y = 420).
   * Returns false when the 3D picture cannot be shown (the caller then paints its 2D fallback).
   */
  api.draw = function (ctx, region, pose, t, builds, looks, ringId, cheer = 0) {
    if (api.lost || stage.contextLost) return false;
    if (api.frozen) return true;
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const full = region || REGION; let rg = full;
    if (globalThis.__ssCam === undefined) { const m = /[?&]cam=([-\d.]+),([-\d.]+),([-\d.]+)/.exec(globalThis.location.search); globalThis.__ssCam = m ? { x: +m[1], y: +m[2], k: +m[3] } : null; }
    const dbg = globalThis.__ssCam;           // dev zoom: { x, y, k } centres on a design point at k times
    if (dbg) rg = { x: dbg.x - full.w / dbg.k / 2, y: dbg.y - full.h / dbg.k / 2, w: full.w / dbg.k, h: full.h / dbg.k };
    const cap = api.quality === 'low' ? 960 : 1500;
    const devW = clamp(Math.round(full.w * pxPerUnit), 160, cap), devH = Math.max(1, Math.round(devW * rg.h / rg.w));
    if (ringId !== curRing) { curRing = ringId; api.setLighting(RING_LIGHT[ringId] || 'day'); world.setRing(ringId); }
    if (looks) looks.forEach((lk, i) => look(i, lk));
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t;
    api.pose(pose, t, dt, builds);
    // world events: sand and the crowd
    for (const e of evq.splice(0)) {
      const w = ws[e.i], rp = w.h.root.position, f = e.i === 0 ? 1 : -1;
      if (e.type === 'act') {
        if (e.kind === 'pull' || e.kind === 'hook') { world.kick(rp.x + f * 0.25, rp.z, e.kind === 'hook' ? 8 : 12, e.kind === 'hook' ? 1.0 : 0.8, -f * 0.4, 0); world.react(e.kind === 'hook' ? 'gasp' : 'cheer', { intensity: 0.45, duration: 1.4 }); }
        else if (e.kind === 'brace') world.kick(rp.x - f * 0.05, rp.z, 6, 0.5, 0, 0);
      } else if (e.type === 'fall') { world.kick(rp.x, rp.z, 14, 1.0, e.dir < 0 ? -f : f, 0); world.react('gasp', { intensity: 0.9 }); }
      else if (e.type === 'down') { world.kick(rp.x + (e.dir < 0 ? -f * 0.5 : f * 0.35), rp.z, 34, 1.7, 0, 0.3); }
      else if (e.type === 'win') { world.react('ovation', { intensity: 1, duration: 4 }); }
    }
    world.setExcitement(0.18 + 0.7 * clamp(cheer, 0, 1));
    world.update(dt, cam);
    stage.setShadowTarget(0, 0, 0);
    const cv = api.render(devW, devH, rg);
    ctx.drawImage(cv, full.x, full.y, full.w, full.h);
    // frame-cost guard
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 90 && cost.ema > 14 && api.quality !== 'low') { cost.low = true; api.quality = 'low'; stage.setQuality('low'); world.setQuality('low'); }
    return true;
  };

  api.render = function (devW, devH, rg) {
    const sig = `${devW}x${devH}:${rg.x.toFixed(1)},${rg.y.toFixed(1)},${rg.w.toFixed(1)},${rg.h.toFixed(1)}`;
    if (api.fitted.sig !== sig || renderer.domElement.width !== devW) { frameCamera(devW, devH, rg); api.fitted.sig = sig; api.fitted.w = devW; api.fitted.h = devH; }
    stage.render();
    return renderer.domElement;
  };
  const LIGHT_TUNE = { day: { hemi: 0.75, keyI: 3.0, rimI: 1.1 }, evening: { hemi: 0.6, keyI: 2.2, rimI: 0.9, key: 0xffa560, hemiSky: 0xffcfa0, hemiGround: 0x6a4a3a }, night: { hemi: 0.34, keyI: 0.95, rimI: 1.1, key: 0xb9c8ff, hemiSky: 0x4a5c9a, hemiGround: 0x1a2030, exposure: 0.9 } };
  const FOG = { day: 0xdfe7ea, evening: 0xe3b08c, night: 0x141c38 };
  api.setLighting = (name) => { const n = LIGHTS[name] || 'day'; stage.setLighting(n, LIGHT_TUNE[n]); stage.setSky(null, null); stage.scene.fog = new THREE.Fog(FOG[n], 12, n === 'night' ? 48 : 70); };
  api.setLighting('day');
  api.frameCamera = frameCamera;

  // ---- dev / build: bake the 2D fallback pictures from THIS scene (backdrop per ring, wrestler sprites) ----
  const rgOf = (x, y, w, h, k) => ({ rg: { x, y, w, h }, devW: Math.round(w * k), devH: Math.round(h * k) });
  api.bakeBackdrop = function (ringId, x = -300, y = -90, w = 1320, h = 590, k = 1.15) {
    const { rg, devW, devH } = rgOf(x, y, w, h, k);
    for (const wr of ws) wr.h.root.visible = false;
    api.frozen = true; api.setLighting(RING_LIGHT[ringId] || 'day'); world.setRing(ringId); curRing = ringId;
    return world.ready().then(() => new Promise((res) => setTimeout(res, 600))).then(() => {
      for (let i = 0; i < 4; i++) world.update(0.05, cam);
      const cv = api.render(devW, devH, rg);
      const url = cv.toDataURL('image/webp', 0.82);
      for (const wr of ws) wr.h.root.visible = true;
      api.fitted.sig = ''; api.frozen = false;
      return { url, box: [x, y, w, h] };
    });
  };
  api.bakeIcon = function (ringId = 'court', x = 175, y = 95, size = 380, px = 2048, pose = null) {
    const rg = { x, y, w: size, h: size };
    api.frozen = true; api.setLighting(RING_LIGHT[ringId] || 'day'); world.setRing(ringId); curRing = ringId;
    if (pose && pose.s) { const bs = () => ({ lean: 0, leanV: 0, sway: 0, swayV: 0, fall: 0, fallDir: 1, win: 0, act: 0, actKind: 'none', actDir: 0, bob: 0 }); const pp = { s: [Object.assign(bs(), pose.s[0]), Object.assign(bs(), pose.s[1])] }; api.pose(pp, 1.0, 0.05, [1, 1]); api.pose(pp, 1.1, 0.1, [1, 1]); }
    return world.ready().then(() => new Promise((res) => setTimeout(res, 800))).then(() => {
      for (let i = 0; i < 6; i++) { world.update(0.05, cam); }
      const cv = api.render(px, px, rg);
      api.fitted.sig = ''; api.frozen = false;
      return cv.toDataURL('image/png');
    });
  };
  api.bakeSprite = function (spec, k = 2) {
    // spec: { s: [pose0, pose1] } partial pose springs; world hidden, transparent background; returns the cropped picture and its box
    const rg = { x: 30, y: 6, w: 660, h: 478 }, devW = Math.round(rg.w * k), devH = Math.round(rg.h * k);
    world.group.visible = false; if (world.crowd) world.crowd.group.visible = false;
    const base = () => ({ lean: 0, leanV: 0, sway: 0, swayV: 0, fall: 0, fallDir: 1, win: 0, act: 0, actKind: 'none', actDir: 0, bob: 0 });
    const pose = { s: [Object.assign(base(), spec.s[0]), Object.assign(base(), spec.s[1])] };
    api.pose(pose, 0.5, 0.05, [1, 1]); api.pose(pose, 0.6, 0.1, [1, 1]);
    stage.setSky(null, null);
    const cv = api.render(devW, devH, rg);
    const c2 = globalThis.document.createElement('canvas'); c2.width = devW; c2.height = devH;
    const g = c2.getContext('2d'); g.drawImage(cv, 0, 0);
    const d = g.getImageData(0, 0, devW, devH).data;
    let x0 = devW, y0 = devH, x1 = 0, y1 = 0;
    for (let y = 0; y < devH; y++) for (let x = 0; x < devW; x++) if (d[(y * devW + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(devW - 1, x1 + 2); y1 = Math.min(devH - 1, y1 + 2);
    const c3 = globalThis.document.createElement('canvas'); c3.width = x1 - x0 + 1; c3.height = y1 - y0 + 1;
    c3.getContext('2d').drawImage(c2, x0, y0, c3.width, c3.height, 0, 0, c3.width, c3.height);
    world.group.visible = true; if (world.crowd) world.crowd.group.visible = true; api.fitted.sig = '';
    return { url: c3.toDataURL('image/webp', 0.9), box: [Math.round(rg.x + x0 / k), Math.round(rg.y + y0 / k), Math.round(c3.width / k), Math.round(c3.height / k)] };
  };
  return api;
}
