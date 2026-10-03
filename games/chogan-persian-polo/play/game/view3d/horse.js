// A stylised horse built from smooth lofted primitives (egg torso blending into a tapered neck and head, four jointed legs,
// tail, mane, ears) and animated procedurally: planted-foot gait cycles (walk, trot, canter, gallop) blended by speed,
// body pitch/bob/roll, neck nod, curved spine in turns, tail and mane follow-through. ALL horses live in ONE dynamic
// BufferGeometry (one draw call); every frame the vertices of each horse are rewritten in world space.
// Frame of a horse: +Z forward, +X left, +Y up; origin on the ground under the body.
import { THREE } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const wrapAng = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---- torso + neck + head: centre line control points (z, y) with half-width rx and half-height ry ----------------------
// index: 0 rump end .. 5 chest | 5 neck base .. 8 poll | 9..11 head to the nose
const SPINE = [
  { z: -1.08, y: 1.23, rx: 0.03, ry: 0.04 },
  { z: -0.99, y: 1.25, rx: 0.15, ry: 0.19 },
  { z: -0.80, y: 1.23, rx: 0.25, ry: 0.30 },
  { z: -0.50, y: 1.17, rx: 0.31, ry: 0.36 },
  { z: -0.10, y: 1.13, rx: 0.325, ry: 0.39 },
  { z: 0.32, y: 1.13, rx: 0.325, ry: 0.395 },
  { z: 0.70, y: 1.19, rx: 0.29, ry: 0.375 },
  { z: 1.02, y: 1.37, rx: 0.235, ry: 0.305 },
  { z: 1.22, y: 1.61, rx: 0.205, ry: 0.25 },
  { z: 1.36, y: 1.81, rx: 0.18, ry: 0.2 },
  { z: 1.54, y: 1.85, rx: 0.165, ry: 0.18 },
  { z: 1.76, y: 1.65, rx: 0.14, ry: 0.15 },
  { z: 1.95, y: 1.46, rx: 0.11, ry: 0.11 },
  { z: 2.03, y: 1.37, rx: 0.08, ry: 0.07 },
];
const NECK0 = 6, POLL = 9;               // control indices: neck base pivot, poll pivot
const NSP = SPINE.length;
let SP_RINGS = 52, SP_SEG = 12;

// gaits: S = stance sweep (m), duty = stance fraction, off = phase offsets of [LH, LF, RH, RF] (left-lead variants for the fast ones)
const GAITS = [
  { name: 'walk', v: 1.3, S: 0.78, duty: 0.70, off: [0.0, 0.25, 0.5, 0.75], lift: 0.16, pitch: 0.012, bob: 0.012, bobK: 2, neck: 0.10, ext: 0.0, tailUp: 0.0 },
  { name: 'trot', v: 3.9, S: 1.05, duty: 0.46, off: [0.0, 0.5, 0.5, 0.0], lift: 0.26, pitch: 0.02, bob: 0.034, bobK: 2, neck: 0.05, ext: 0.12, tailUp: 0.25 },
  { name: 'canter', v: 7.0, S: 1.14, duty: 0.38, off: [0.0, 0.66, 0.33, 0.33], lift: 0.32, pitch: 0.075, bob: 0.05, bobK: 1, neck: 0.12, ext: 0.45, tailUp: 0.55 },
  { name: 'gallop', v: 11.0, S: 1.18, duty: 0.29, off: [0.0, 0.57, 0.12, 0.45], lift: 0.34, pitch: 0.095, bob: 0.06, bobK: 1, neck: 0.14, ext: 0.9, tailUp: 0.9 },
];
// leg index order: 0 LH, 1 LF, 2 RH, 3 RF. Right-lead variants mirror left/right.
const LEG_X = [0.2, 0.18, -0.2, -0.18], LEG_Z = [-0.62, 0.6, -0.62, 0.6], LEG_FRONT = [false, true, false, true];
const HIP_Y = [1.02, 1.0, 1.02, 1.0];
const LEG_A = [0.56, 0.52, 0.56, 0.52], LEG_B = [0.37, 0.40, 0.37, 0.40];   // upper bone to the knee / hock, lower bone to the fetlock
const ANKLE_Y = 0.11;
const MIRROR = [2, 3, 0, 1];

function gaitAt(v) {
  // returns blended parameters for a speed
  let i = 0;
  while (i < GAITS.length - 2 && v > GAITS[i + 1].v) i++;
  const a = GAITS[i], b = GAITS[i + 1];
  const t = smooth(0, 1, clamp((v - a.v) / (b.v - a.v), 0, 1));
  const o = { i, t };
  for (const k of ['S', 'duty', 'lift', 'pitch', 'bob', 'neck', 'ext', 'tailUp']) o[k] = lerp(a[k], b[k], t);
  o.bobK = lerp(a.bobK, b.bobK, t);
  o.off = a.off.map((x, j) => x + wrapAng((b.off[j] - x) * TAU) / TAU * t);
  if (v < GAITS[0].v) { const w = clamp(v / GAITS[0].v, 0, 1); o.S = lerp(0.35, GAITS[0].S, w); o.lift = lerp(0.1, GAITS[0].lift, w); }
  if (v > GAITS[GAITS.length - 1].v) { const w = clamp((v - GAITS[GAITS.length - 1].v) / 4, 0, 1); o.S = GAITS[3].S + 0.05 * w; }
  return o;
}

// ---- catmull-rom through control points (arrays of numbers) ------------------------------------------------------------
function cr(P, s, out, n) {
  const m = P.length - 1;
  s = clamp(s, 0, m);
  let i = Math.floor(s); if (i >= m) i = m - 1;
  const t = s - i, t2 = t * t, t3 = t2 * t;
  const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(m, i + 2)];
  for (let k = 0; k < n; k++) out[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
  return out;
}

// ---- geometry layout ------------------------------------------------------------------------------------------------------
function ringIdx(base, nRings, nSeg, idx, flip) {
  for (let i = 0; i < nRings - 1; i++) {
    for (let k = 0; k < nSeg; k++) {
      const a = base + i * nSeg + k, b = base + i * nSeg + ((k + 1) % nSeg), c = base + (i + 1) * nSeg + k, d = base + (i + 1) * nSeg + ((k + 1) % nSeg);
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
}
let LEG_RINGS = 12, LEG_SEG = 8, TAIL_RINGS = 8, TAIL_SEG = 6, MANE_N = 15, MANE_SEG = 4, EAR_RINGS = 3, EAR_SEG = 6, PAD_U = 8, PAD_V = 7, REIN_RINGS = 4, REIN_SEG = 4;
const PART = {};
let VPH = 0;
const reg = (name, n) => { PART[name] = VPH; VPH += n; };
function layout() {
  VPH = 0;
  reg('spine', SP_RINGS * SP_SEG);
  for (let l = 0; l < 4; l++) reg('leg' + l, LEG_RINGS * LEG_SEG);
  reg('tail', TAIL_RINGS * TAIL_SEG);
  reg('mane', MANE_N * MANE_SEG);
  reg('earL', EAR_RINGS * EAR_SEG);
  reg('earR', EAR_RINGS * EAR_SEG);
  reg('pad', PAD_U * PAD_V);
  reg('reinL', REIN_RINGS * REIN_SEG);
  reg('reinR', REIN_RINGS * REIN_SEG);
}
layout();
// geometry detail by quality tier: the horses are the largest triangle cost, so medium and low use fewer rings and sides
export function setHorseDetail(tier) {
  if (tier === 'low') { SP_RINGS = 30; SP_SEG = 8; LEG_RINGS = 8; LEG_SEG = 6; TAIL_RINGS = 6; TAIL_SEG = 5; MANE_N = 9; MANE_SEG = 3; EAR_RINGS = 2; EAR_SEG = 5; PAD_U = 6; PAD_V = 5; REIN_RINGS = 3; REIN_SEG = 3; }
  else if (tier === 'medium') { SP_RINGS = 38; SP_SEG = 10; LEG_RINGS = 10; LEG_SEG = 7; TAIL_RINGS = 7; TAIL_SEG = 5; MANE_N = 12; MANE_SEG = 4; EAR_RINGS = 3; EAR_SEG = 5; PAD_U = 7; PAD_V = 6; REIN_RINGS = 3; REIN_SEG = 4; }
  else { SP_RINGS = 52; SP_SEG = 12; LEG_RINGS = 12; LEG_SEG = 8; TAIL_RINGS = 8; TAIL_SEG = 6; MANE_N = 15; MANE_SEG = 4; EAR_RINGS = 3; EAR_SEG = 6; PAD_U = 8; PAD_V = 7; REIN_RINGS = 4; REIN_SEG = 4; }
  layout();
}

const BALL_SEG = 14, BALL_RINGS = 9;
function buildIndex(nHorses) {
  const idx = [];
  const ballBase = nHorses * VPH;
  for (let h = 0; h < nHorses; h++) {
    const o = h * VPH;
    ringIdx(o + PART.spine, SP_RINGS, SP_SEG, idx, false);
    for (let l = 0; l < 4; l++) ringIdx(o + PART['leg' + l], LEG_RINGS, LEG_SEG, idx, true);
    ringIdx(o + PART.tail, TAIL_RINGS, TAIL_SEG, idx, true);
    ringIdx(o + PART.mane, MANE_N, MANE_SEG, idx, true);
    ringIdx(o + PART.earL, EAR_RINGS, EAR_SEG, idx, true);
    ringIdx(o + PART.earR, EAR_RINGS, EAR_SEG, idx, true);
    ringIdx(o + PART.reinL, REIN_RINGS, REIN_SEG, idx, true);
    ringIdx(o + PART.reinR, REIN_RINGS, REIN_SEG, idx, true);
    const pb = o + PART.pad;
    for (let i = 0; i < PAD_U - 1; i++) for (let k = 0; k < PAD_V - 1; k++) { const a = pb + i * PAD_V + k, b = a + 1, c = a + PAD_V, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  // the ball: a small UV sphere at the end of the buffer
  for (let i = 0; i < BALL_RINGS - 1; i++) for (let k = 0; k < BALL_SEG; k++) { const a = ballBase + i * (BALL_SEG + 1) + k, b = a + 1, c = a + BALL_SEG + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  return idx;
}

export const COATS = {
  bay: { coat: '#8a4b2a', belly: '#6e3b21', dark: '#2a1912', blaze: '#e8dccb' },
  chestnut: { coat: '#a65a2a', belly: '#8a4a21', dark: '#6b3516', blaze: '#f0e2cc' },
  grey: { coat: '#b4b8bd', belly: '#9a9fa6', dark: '#4b4e55', blaze: '#d8dade' },
  black: { coat: '#2d2b2e', belly: '#222024', dark: '#121113', blaze: '#cfcac4' },
  palomino: { coat: '#d6a45a', belly: '#c08f48', dark: '#efe3c6', blaze: '#f6efe1' },
  dun: { coat: '#b58b57', belly: '#9d7747', dark: '#3a2a1c', blaze: '#e6d8bd' },
};
const hex = (s) => { const c = new THREE.Color(s); return [c.r, c.g, c.b]; };   // linear working colour space values

export class HorseBatch {
  constructor(n) {
    this.n = n;
    this.ballVerts = (BALL_SEG + 1) * BALL_RINGS; this.ballBase = n * VPH;
    const V = n * VPH + this.ballVerts;
    this.S = 1; this.pos = new Float32Array(V * 3); this.nor = new Float32Array(V * 3); this.col = new Float32Array(V * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(35048));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(35048));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(buildIndex(n));
    this.geometry = g;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.3, side: THREE.FrontSide });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.name = 'horses';
    this.dirty = false;
    this._s = new Array(NSP + 2); for (let i = 0; i < this._s.length; i++) this._s[i] = [0, 0, 0];
    this.tmp = { c: [0, 0, 0, 0, 0], r: [0, 0, 0, 0, 0] };
    this.pal = [];
  }

  // vertex colours of horse h
  paint(h, palette, cloth, trim) {
    const P = typeof palette === 'string' ? COATS[palette] : palette;
    const coat = hex(P.coat), belly = hex(P.belly), dark = hex(P.dark), blaze = hex(P.blaze), cl = hex(cloth), tr = hex(trim || '#f4efe4');
    const col = this.col, o = h * VPH;
    const set = (v, c, k = 1) => { col[(o + v) * 3] = c[0] * k; col[(o + v) * 3 + 1] = c[1] * k; col[(o + v) * 3 + 2] = c[2] * k; };
    const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
    for (let i = 0; i < SP_RINGS; i++) {
      const s = i / (SP_RINGS - 1) * (NSP - 1);
      for (let k = 0; k < SP_SEG; k++) {
        const a = k / SP_SEG * TAU, sn = Math.sin(a);       // sn: +1 top, -1 belly
        let c = mix(belly, coat, smooth(-0.9, 0.2, sn));
        const shade = 1 - 0.18 * smooth(0.2, -1, sn);
        c = [c[0] * shade, c[1] * shade, c[2] * shade];
        if (s > POLL + 0.2) { const nose = smooth(POLL + 2.2, NSP - 1.2, s); c = mix(c, mix(coat, dark, 0.35), nose * 0.6); if (s > POLL + 0.8 && s < NSP - 1.4 && Math.abs(Math.cos(a)) < 0.45 && sn > -0.3) c = mix(c, blaze, 0.55); }
                set(PART.spine + i * SP_SEG + k, c);
      }
    }
    for (let l = 0; l < 4; l++) for (let i = 0; i < LEG_RINGS; i++) {
      const t = i / (LEG_RINGS - 1);
      let c = mix(coat, belly, 0.3);
      c = mix(c, dark, smooth(0.40, 0.62, t) * 0.9);                  // dark lower legs
      if (t > 0.92) c = mix(c, [0.035, 0.03, 0.03], 1);              // hoof
      else if (t > 0.78 && l % 2 === 1 && h % 3 === 0) c = mix(c, blaze, 0.7);   // a white sock on some horses
      for (let k = 0; k < LEG_SEG; k++) set(PART['leg' + l] + i * LEG_SEG + k, c);
    }
    for (let i = 0; i < TAIL_RINGS; i++) for (let k = 0; k < TAIL_SEG; k++) set(PART.tail + i * TAIL_SEG + k, mix(dark, [dark[0] * 0.6, dark[1] * 0.6, dark[2] * 0.6], i / TAIL_RINGS));
    for (let i = 0; i < MANE_N; i++) for (let k = 0; k < MANE_SEG; k++) set(PART.mane + i * MANE_SEG + k, dark);
    for (const nm of ['earL', 'earR']) for (let i = 0; i < EAR_RINGS; i++) for (let k = 0; k < EAR_SEG; k++) set(PART[nm] + i * EAR_SEG + k, mix(coat, dark, 0.5));
    for (let i = 0; i < PAD_U; i++) for (let k = 0; k < PAD_V; k++) { const edge = (k === 0 || k === PAD_V - 1 || i === 0 || i === PAD_U - 1); set(PART.pad + i * PAD_V + k, edge ? tr : cl); }
    for (const nm of ['reinL', 'reinR']) for (let i = 0; i < REIN_RINGS; i++) for (let k = 0; k < REIN_SEG; k++) set(PART[nm] + i * REIN_SEG + k, [0.07, 0.05, 0.04]);
    this.geometry.attributes.color.needsUpdate = true;
  }

  // ring writer: centre c, axes a (rA) and b (rB); the normal follows the ellipse
  _ring(o, i, nSeg, cx, cy, cz, ax, ay, az, bx, by, bz, rA, rB, nz) {
    const pos = this.pos, nor = this.nor;
    const iA = 1 / Math.max(rA, 1e-4), iB = 1 / Math.max(rB, 1e-4);
    for (let k = 0; k < nSeg; k++) {
      const a = k / nSeg * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const v = (o + i * nSeg + k) * 3;
      pos[v] = cx + ax * rA * ca + bx * rB * sa; pos[v + 1] = cy + ay * rA * ca + by * rB * sa; pos[v + 2] = cz + az * rA * ca + bz * rB * sa;
      let nx = ax * ca * iA + bx * sa * iB, ny = ay * ca * iA + by * sa * iB, nzz = az * ca * iA + bz * sa * iB;
      const l = Math.hypot(nx, ny, nzz) || 1;
      nor[v] = nx / l; nor[v + 1] = ny / l; nor[v + 2] = nzz / l;
    }
  }

  /**
   * Write horse h. p: { x, z, heading, pitch, roll, bob, kappa, neckPitch, neckYaw, headPitch, ears, legs:[{ax,ay,az,pastern}], tail:{...}, rein:{lx,ly,lz,rx,ry,rz} }
   * Everything in p is in the horse's heading frame except x/z/heading (world).
   */
  write(h, p) {
    const o = h * VPH, ch = Math.cos(p.heading), sh = Math.sin(p.heading);
    // heading frame -> world (+Z forward rotated by heading: forward = (sin h, cos h))
    const W = (lx, ly, lz, out) => { out[0] = p.x + lx * ch + lz * sh; out[1] = ly; out[2] = p.z - lx * sh + lz * ch; return out; };
    const Wd = (lx, ly, lz, out) => { out[0] = lx * ch + lz * sh; out[1] = ly; out[2] = -lx * sh + lz * ch; return out; };
    const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch), cr_ = Math.cos(p.roll), sr = Math.sin(p.roll);
    const piv = { y: 1.1, z: 0.0 };
    // body transform in the heading frame: pitch about X (nose down = positive pitch? we use + = nose up), roll about Z, then bob
    const B = (x, y, z, out) => {
      let yy = y - piv.y, zz = z - piv.z;
      let z1 = zz * cp - yy * sp, y1 = zz * sp + yy * cp;       // nose up for +pitch
      let x2 = x * cr_ - y1 * sr, y2 = x * sr + y1 * cr_;
      out[0] = x2; out[1] = y2 + piv.y + p.bob; out[2] = z1 + piv.z; return out;
    };
    // --- spine control points after neck/head posing and the curved-spine offset
    const S = this._s;
    for (let i = 0; i < NSP; i++) {
      let { z, y } = SPINE[i]; let x = 0;
      x = p.kappa * 0.5 * (z - 0.1) * (z - 0.1) * 0.0;
      S[i][0] = x; S[i][1] = y; S[i][2] = z;
    }
    // neck pitch about the neck base; head pitch about the poll; yaw about the neck base
    const rotAbout = (pt, cy, cz, ang, yawAng, cx) => {
      const dy = pt[1] - cy, dz = pt[2] - cz, c = Math.cos(ang), s = Math.sin(ang);
      const ny = dy * c + dz * s, nz2 = -dy * s + dz * c;
      pt[1] = cy + ny; pt[2] = cz + nz2;
      if (yawAng) { const dz2 = pt[2] - cz, dx = pt[0] - cx, c2 = Math.cos(yawAng), s2 = Math.sin(yawAng); pt[0] = cx + dx * c2 + dz2 * s2; pt[2] = cz - dx * s2 + dz2 * c2; }
    };
    const nb = SPINE[NECK0], pl = SPINE[POLL];
    // neck: rotate points 6..11 about the base (positive neckPitch = neck raises = rotating nose-up means y up: rotate by -ang about x)
    for (let i = NECK0 + 1; i < NSP; i++) rotAbout(S[i], nb.y, nb.z, p.neckPitch, p.neckYaw, 0);
    // head: rotate points 9..11 about the (rotated) poll
    const pv = S[POLL];
    for (let i = POLL + 1; i < NSP; i++) rotAbout(S[i], pv[1], pv[2], p.headPitch, p.headYaw * 0.6, pv[0]);
    // curved spine: lateral offset so the body arcs around the turn (kappa = turn rate / speed, + = turning left)
    const bendX = (z) => -p.kappa * 0.5 * (z - 0.15) * (z - 0.15) * -1;
    for (let i = 0; i < NSP; i++) S[i][0] += bendX(S[i][2]) * 0.5;
    // radii by control point with a faint breathing
    const breathe = 1 + 0.012 * Math.sin(p.breath);
    // spine rings
    const c = [0, 0, 0], d1 = [0, 0, 0], r = [0, 0], rad = this._rad || (this._rad = Array.from({ length: NSP }, () => [0, 0]));
    for (let i = 0; i < NSP; i++) { rad[i][0] = SPINE[i].rx * (i < 6 ? breathe : 1); rad[i][1] = SPINE[i].ry * (i < 6 ? breathe : 1); }
    const frames = this._frames || (this._frames = Array.from({ length: SP_RINGS }, () => ({ c: [0, 0, 0], S: [0, 0, 0], U: [0, 0, 0], T: [0, 0, 0], r: [0, 0] })));
    const pt = [0, 0, 0], q1 = [0, 0, 0], q2 = [0, 0, 0], q3 = [0, 0, 0];
    for (let i = 0; i < SP_RINGS; i++) {
      const s = i / (SP_RINGS - 1) * (NSP - 1);
      cr(S, s, c, 3);
      const e = 0.02, sa = clamp(s - e, 0, NSP - 1), sb = clamp(s + e, 0, NSP - 1);
      cr(S, sa, q1, 3); cr(S, sb, q2, 3);
      let tx = q2[0] - q1[0], ty = q2[1] - q1[1], tz = q2[2] - q1[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      // lateral axis = up x T ; up axis = T x lateral
      let sx = ty * 0 - tz * 1 * 1, sy = 0, sz = tx * 1;   // (0,1,0) x T = (ty*0 - 0*tz... ) computed explicitly below
      sx = 1 * tz - 0 * ty; sy = 0 * tx - 0 * tz; sz = 0 * ty - 1 * tx;
      const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
      const ux = ty * sz - tz * sy, uy = tz * sx - tx * sz, uz = tx * sy - ty * sx;
      cr(rad, s, r, 2);
      const f = frames[i]; f.c[0] = c[0]; f.c[1] = c[1]; f.c[2] = c[2]; f.S[0] = sx; f.S[1] = sy; f.S[2] = sz; f.U[0] = ux; f.U[1] = uy; f.U[2] = uz; f.T[0] = tx; f.T[1] = ty; f.T[2] = tz; f.r[0] = Math.max(0.01, r[0]); f.r[1] = Math.max(0.01, r[1]);
    }
    // torso transform B applies to rings below the neck base; the neck/head already follow their own pivots, so apply B to everything
    const wp = [0, 0, 0], wa = [0, 0, 0], wb = [0, 0, 0], tmp = [0, 0, 0];
    for (let i = 0; i < SP_RINGS; i++) {
      const f = frames[i];
      B(f.c[0], f.c[1], f.c[2], tmp); W(tmp[0], tmp[1], tmp[2], wp);
      // axes: rotate directions by B (without translation) then Wd
      const dirB = (v, out) => { const yy = v[1], zz = v[2]; const z1 = zz * cp - yy * sp, y1 = zz * sp + yy * cp; const x2 = v[0] * cr_ - y1 * sr, y2 = v[0] * sr + y1 * cr_; out[0] = x2; out[1] = y2; out[2] = z1; return out; };
      dirB(f.S, tmp); Wd(tmp[0], tmp[1], tmp[2], wa);
      dirB(f.U, tmp); Wd(tmp[0], tmp[1], tmp[2], wb);
      this._ring(o + PART.spine, i, SP_SEG, wp[0], wp[1], wp[2], wa[0], wa[1], wa[2], wb[0], wb[1], wb[2], f.r[0], f.r[1]);
      f.w = [wp[0], wp[1], wp[2]]; f.wa = [wa[0], wa[1], wa[2]]; f.wb = [wb[0], wb[1], wb[2]];
    }
    this._nCaps(o + PART.spine, 0, SP_SEG, -1, frames[0]);
    // --- legs (IK in the heading frame, hips follow the body transform)
    for (let l = 0; l < 4; l++) {
      const lg = p.legs[l];
      const hx = LEG_X[l] + bendX(LEG_Z[l]) * 0.5 * 0, hy = HIP_Y[l], hz = LEG_Z[l];
      B(LEG_X[l] * 0.9 + bendX(hz) * 0.5, hy, hz, tmp); const H0 = [tmp[0], tmp[1], tmp[2]];
      const A0 = [lg.x, lg.y, lg.z];   // ankle target in the heading frame
      const a = LEG_A[l], b = LEG_B[l];
      let dx = A0[0] - H0[0], dy = A0[1] - H0[1], dz = A0[2] - H0[2]; let d = Math.hypot(dx, dy, dz);
      const dm = a + b - 0.002; if (d > dm) { const k = dm / d; A0[0] = H0[0] + dx * k; A0[1] = H0[1] + dy * k; A0[2] = H0[2] + dz * k; dx *= k; dy *= k; dz *= k; d = dm; }
      const ux_ = dx / d, uy_ = dy / d, uz_ = dz / d;
      const xx = (d * d + a * a - b * b) / (2 * d), hh = Math.sqrt(Math.max(0, a * a - xx * xx));
      // pole: front legs bend forward at the knee, hind legs bend backward at the hock
      const pz = LEG_FRONT[l] ? 1 : -1;
      let pxv = 0, pyv = 0, pzv = pz; const dot = pxv * ux_ + pyv * uy_ + pzv * uz_; pxv -= dot * ux_; pyv -= dot * uy_; pzv -= dot * uz_;
      const pl_ = Math.hypot(pxv, pyv, pzv) || 1; pxv /= pl_; pyv /= pl_; pzv /= pl_;
      const M0 = [H0[0] + ux_ * xx + pxv * hh, H0[1] + uy_ * xx + pyv * hh, H0[2] + uz_ * xx + pzv * hh];
      // hoof tip: pastern from the fetlock
      const pa = lg.pastern;   // 0 = flat on the ground, + = toe pointed down/back
      const T0 = [A0[0], A0[1] - 0.10 * Math.cos(pa * 0.9) , A0[2] + (LEG_FRONT[l] ? 0.06 : 0.05) * Math.cos(pa) - 0.05 * Math.sin(pa)];
      if (T0[1] < 0) T0[1] = 0;
      // path through hip, mid, ankle, hoof tip; sampled with catmull-rom
      const path = this._lp || (this._lp = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
      // extra control point above the hip so the thigh/shoulder merges into the body
      path[0][0] = H0[0] + (LEG_X[l] > 0 ? -0.02 : 0.02); path[0][1] = H0[1] + 0.12; path[0][2] = H0[2];
      path[1][0] = H0[0]; path[1][1] = H0[1]; path[1][2] = H0[2];
      path[2][0] = M0[0]; path[2][1] = M0[1]; path[2][2] = M0[2];
      path[3][0] = A0[0]; path[3][1] = A0[1]; path[3][2] = A0[2];
      path[4][0] = T0[0]; path[4][1] = T0[1]; path[4][2] = T0[2];
      const rA = LEG_FRONT[l] ? PROFILE_F : PROFILE_H;
      for (let i = 0; i < LEG_RINGS; i++) {
        const u = i / (LEG_RINGS - 1);
        cr(path, u * 4, c, 3);
        const sa = clamp(u * 4 - 0.03, 0, 4), sb = clamp(u * 4 + 0.03, 0, 4);
        cr(path, sa, q1, 3); cr(path, sb, q2, 3);
        let tx = q2[0] - q1[0], ty = q2[1] - q1[1], tz = q2[2] - q1[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        // axis A = lateral (x), axis B = T x A
        let bx = ty * 0 - tz * 0, by = tz * 1 - tx * 0, bz = tx * 0 - ty * 1;
        const bl = Math.hypot(bx, by, bz) || 1; bx /= bl; by /= bl; bz /= bl;
        const ix = u * (rA.length - 1), i0 = Math.floor(ix), i1 = Math.min(rA.length - 1, i0 + 1), tt = ix - i0;
        const ra = lerp(rA[i0][0], rA[i1][0], tt), rb = lerp(rA[i0][1], rA[i1][1], tt);
        const cxw = c[0], cyw = c[1], czw = c[2];
        W(cxw, cyw, czw, wp);
        Wd(1, 0, 0, wa); Wd(bx, by, bz, wb);
        this._ring(o + PART['leg' + l], i, LEG_SEG, wp[0], wp[1], wp[2], wa[0], wa[1], wa[2], wb[0], wb[1], wb[2], ra, rb);
      }
    }
    // --- tail: a chain with lag
    {
      const tp = p.tail, F = frames[0];
      const root = [0, 0, 0]; B(0, 1.2, -1.0, root);
      const path = this._tp || (this._tp = Array.from({ length: 5 }, () => [0, 0, 0]));
      let px = root[0], py = root[1], pz = root[2];
      path[0][0] = px; path[0][1] = py; path[0][2] = pz;
      for (let i = 1; i < 5; i++) {
        const pitch = tp.pitch + tp.curl * i;       // from straight back (0) to hanging down (+)
        const yaw = tp.yaw[i - 1];
        const L = 0.22;
        const dxl = Math.sin(yaw) * Math.cos(pitch), dyl = -Math.sin(pitch), dzl = -Math.cos(yaw) * Math.cos(pitch);
        px += dxl * L; py += dyl * L; pz += dzl * L;
        path[i][0] = px; path[i][1] = py; path[i][2] = pz;
      }
      for (let i = 0; i < TAIL_RINGS; i++) {
        const u = i / (TAIL_RINGS - 1);
        cr(path, u * 4, c, 3);
        cr(path, clamp(u * 4 - 0.03, 0, 4), q1, 3); cr(path, clamp(u * 4 + 0.03, 0, 4), q2, 3);
        let tx = q2[0] - q1[0], ty = q2[1] - q1[1], tz = q2[2] - q1[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        let ax_ = tz, ay_ = 0, az_ = -tx; const al = Math.hypot(ax_, ay_, az_) || 1; ax_ /= al; az_ /= al;
        const bx = ty * az_ - tz * ay_, by = tz * ax_ - tx * az_, bz = tx * ay_ - ty * ax_;
        const w0 = lerp(0.06, 0.02, Math.pow(u, 0.8)), w1 = lerp(0.05, 0.035, u);
        W(c[0], c[1], c[2], wp); Wd(ax_, ay_, az_, wa); Wd(bx, by, bz, wb);
        this._ring(o + PART.tail, i, TAIL_SEG, wp[0], wp[1], wp[2], wa[0], wa[1], wa[2], wb[0], wb[1], wb[2], w0, w1);
      }
    }
    // --- mane along the top of the neck (rings 9..30 of the spine loft by arclength)
    {
      const j0 = Math.round(SP_RINGS * 0.45), j1 = Math.round(SP_RINGS * 0.70);
      for (let i = 0; i < MANE_N; i++) {
        const u = i / (MANE_N - 1), j = lerp(j0, j1, u), jj = Math.floor(j), ft = j - jj;
        const fa = frames[jj], fb = frames[Math.min(SP_RINGS - 1, jj + 1)];
        const lw = (A, B_, k) => lerp(A[k], B_[k], ft);
        const cx = lw(fa.w, fb.w, 0), cy = lw(fa.w, fb.w, 1), cz = lw(fa.w, fb.w, 2);
        const ux = lw(fa.wb, fb.wb, 0), uy = lw(fa.wb, fb.wb, 1), uz = lw(fa.wb, fb.wb, 2), sx = lw(fa.wa, fb.wa, 0), sy = lw(fa.wa, fb.wa, 1), sz = lw(fa.wa, fb.wa, 2);
        const ry = lerp(fa.r[1], fb.r[1], ft);
        const sway = p.maneSway * Math.sin(p.maneT - u * 2.2) * (0.3 + u * 0.7);
        const up = ry * 0.92, ln = 0.075 + 0.02 * Math.sin(u * 5);
        const mx = cx + ux * (up + 0.02) + sx * sway, my = cy + uy * (up + 0.02) + sy * sway, mz = cz + uz * (up + 0.02) + sz * sway;
        // ring: thin along S, long along up U (the ribbon sticks out of the neck top)
        this._ring(o + PART.mane, i, MANE_SEG, mx + ux * ln * 0.5, my + uy * ln * 0.5, mz + uz * ln * 0.5, sx, sy, sz, ux, uy, uz, 0.018, ln * 0.5 + 0.02);
      }
    }
    // --- ears at the poll
    {
      const jp = Math.round(SP_RINGS * 0.70), F = frames[jp];
      for (let e = 0; e < 2; e++) {
        const sg = e === 0 ? 1 : -1;
        const ex = F.w[0] + F.wb[0] * F.r[1] * 0.78 + F.wa[0] * F.r[0] * 0.6 * sg, ey = F.w[1] + F.wb[1] * F.r[1] * 0.78 + F.wa[1] * F.r[0] * 0.6 * sg, ez = F.w[2] + F.wb[2] * F.r[1] * 0.78 + F.wa[2] * F.r[0] * 0.6 * sg;
        const flick = p.ears[e];
        for (let i = 0; i < EAR_RINGS; i++) {
          const u = i / (EAR_RINGS - 1), len = 0.17;
          const dirx = F.wb[0] + F.wa[0] * sg * (0.25 + flick) + F.wb[0] * 0 - (F.wb[0] * 0), diry = F.wb[1] + F.wa[1] * sg * (0.25 + flick), dirz = F.wb[2] + F.wa[2] * sg * (0.25 + flick) + 0.25 * (F.wb[2] === 0 ? 0 : 0);
          const dl = Math.hypot(dirx, diry, dirz);
          const k = u * len / dl;
          const rr = lerp(0.05, 0.008, u);
          this._ring(o + PART['ear' + (e === 0 ? 'L' : 'R')], i, EAR_SEG, ex + dirx * k, ey + diry * k, ez + dirz * k + 0.02 * u, F.wa[0], F.wa[1], F.wa[2], F.wb[0], F.wb[1], F.wb[2], rr * 0.6, rr * 1.4);
        }
      }
    }
    // --- saddle pad patch on the back
    {
      const zr = [-0.3, 0.42];
      for (let i = 0; i < PAD_U; i++) {
        const z = lerp(zr[0], zr[1], i / (PAD_U - 1));
        // ring index at this control-z: search spine rings by world-ish z (use model z from the unbent control line)
        const s = this._ringAtZ(S, z), j = Math.min(SP_RINGS - 2, Math.floor(s)), ft = s - j;
        const fa = frames[j], fb = frames[j + 1];
        for (let k = 0; k < PAD_V; k++) {
          const a = lerp(0.48, 2.66, k / (PAD_V - 1));    // angle from +S through the top (pi/2)
          const ca = Math.cos(a), sa = Math.sin(a);
          const rx = lerp(fa.r[0], fb.r[0], ft) * 1.035, ry = lerp(fa.r[1], fb.r[1], ft) * 1.035;
          const vv = (o + PART.pad + i * PAD_V + k) * 3;
          for (let m = 0; m < 3; m++) this.pos[vv + m] = lerp(fa.w[m], fb.w[m], ft) + lerp(fa.wa[m], fb.wa[m], ft) * rx * ca + lerp(fa.wb[m], fb.wb[m], ft) * ry * sa;
          let nx = 0, ny = 0, nz = 0;
          for (let m = 0; m < 3; m++) { const vA = lerp(fa.wa[m], fb.wa[m], ft) * ca / rx + lerp(fa.wb[m], fb.wb[m], ft) * sa / ry; if (m === 0) nx = vA; else if (m === 1) ny = vA; else nz = vA; }
          const nl = Math.hypot(nx, ny, nz) || 1; this.nor[vv] = nx / nl; this.nor[vv + 1] = ny / nl; this.nor[vv + 2] = nz / nl;
        }
      }
    }
    // --- reins from the mouth to the rider's hands
    {
      const jm = SP_RINGS - 3, F = frames[jm];
      for (let e = 0; e < 2; e++) {
        const sg = e === 0 ? 1 : -1;
        const sx0 = F.w[0] + F.wa[0] * F.r[0] * 0.9 * sg - F.wb[0] * F.r[1] * 0.1, sy0 = F.w[1] + F.wa[1] * F.r[0] * 0.9 * sg - F.wb[1] * F.r[1] * 0.1, sz0 = F.w[2] + F.wa[2] * F.r[0] * 0.9 * sg - F.wb[2] * F.r[1] * 0.1;
        const hand = p.rein; const hw = W(hand.x, hand.y, hand.z, [0, 0, 0]);
        const hx = hw[0], hy = hw[1], hz = hw[2];
        for (let i = 0; i < REIN_RINGS; i++) {
          const u = i / (REIN_RINGS - 1);
          const sag = Math.sin(u * Math.PI) * 0.05;
          const cx = lerp(sx0, hx + (sg > 0 ? 0.04 : -0.04), u), cy = lerp(sy0, hy, u) - sag, cz = lerp(sz0, hz, u);
          this._ring(o + PART['rein' + (e === 0 ? 'L' : 'R')], i, REIN_SEG, cx, cy, cz, 1, 0, 0, 0, 1, 0, 0.007, 0.007);
        }
      }
    }
    if (this.S !== 1) {
      const Sc = this.S, ox = p.x, oz = p.z, v0 = o * 3, v1 = (o + VPH) * 3, pos = this.pos;
      for (let v = v0; v < v1; v += 3) { pos[v] = ox + (pos[v] - ox) * Sc; pos[v + 1] *= Sc; pos[v + 2] = oz + (pos[v + 2] - oz) * Sc; }
    }
    this.dirty = true;
  }
  _ringAtZ(S, z) {
    // locate the ring whose control-line z matches (torso only; control z is monotonic up to the chest)
    let s = 0;
    for (let i = 0; i < NECK0; i++) { if (z >= SPINE[i].z && z <= SPINE[i + 1].z) { s = i + (z - SPINE[i].z) / (SPINE[i + 1].z - SPINE[i].z); break; } }
    return s / (NSP - 1) * (SP_RINGS - 1);
  }
  _nCaps() { /* the end rings are tiny: no separate caps needed */ }
  paintBall() {
    const o = this.ballBase;
    for (let i = 0; i < BALL_RINGS; i++) for (let k = 0; k <= BALL_SEG; k++) {
      const lat = (i / (BALL_RINGS - 1) - 0.5) * Math.PI, v = (o + i * (BALL_SEG + 1) + k) * 3;
      let c = hex('#fbf7ee'); if (Math.abs(lat) < 0.2) c = hex('#d8422f'); else if (k % 2 === 0) c = hex('#e7dfcf');
      this.col[v] = c[0]; this.col[v + 1] = c[1]; this.col[v + 2] = c[2];
    }
    this.geometry.attributes.color.needsUpdate = true;
  }
  // q = [x, y, z, w] orientation quaternion
  writeBall(x, y, z, r, q) {
    const [qx, qy, qz, qw] = q;
    const R = [1 - 2 * (qy * qy + qz * qz), 2 * (qx * qy - qz * qw), 2 * (qx * qz + qy * qw), 2 * (qx * qy + qz * qw), 1 - 2 * (qx * qx + qz * qz), 2 * (qy * qz - qx * qw), 2 * (qx * qz - qy * qw), 2 * (qy * qz + qx * qw), 1 - 2 * (qx * qx + qy * qy)];
    for (let i = 0; i < BALL_RINGS; i++) for (let k = 0; k <= BALL_SEG; k++) {
      const lat = (i / (BALL_RINGS - 1) - 0.5) * Math.PI, lon = k / BALL_SEG * TAU;
      const nx0 = Math.cos(lat) * Math.cos(lon), ny0 = Math.sin(lat), nz0 = Math.cos(lat) * Math.sin(lon);
      const nx = R[0] * nx0 + R[1] * ny0 + R[2] * nz0, ny = R[3] * nx0 + R[4] * ny0 + R[5] * nz0, nz = R[6] * nx0 + R[7] * ny0 + R[8] * nz0;
      const v = (this.ballBase + i * (BALL_SEG + 1) + k) * 3;
      this.pos[v] = x + nx * r; this.pos[v + 1] = y + ny * r; this.pos[v + 2] = z + nz * r;
      this.nor[v] = nx; this.nor[v + 1] = ny; this.nor[v + 2] = nz;
    }
    this.dirty = true;
  }
  commit() { if (!this.dirty) return; this.geometry.attributes.position.needsUpdate = true; this.geometry.attributes.normal.needsUpdate = true; this.dirty = false; }
}

// leg radius profiles along [hip .. hoof tip]: [lateral half width, front-back half width]
const PROFILE_F0 = [[0.10, 0.13], [0.09, 0.115], [0.075, 0.095], [0.055, 0.07], [0.043, 0.052], [0.04, 0.045], [0.04, 0.042], [0.046, 0.05], [0.045, 0.05], [0.05, 0.06], [0.056, 0.07], [0.06, 0.075]];
const PROFILE_H0 = [[0.12, 0.17], [0.11, 0.15], [0.09, 0.12], [0.068, 0.085], [0.052, 0.062], [0.042, 0.048], [0.04, 0.043], [0.044, 0.048], [0.045, 0.05], [0.05, 0.06], [0.056, 0.07], [0.06, 0.075]];

const THICK = 1.28;
const _t = (P) => P.map((r) => [r[0] * THICK, r[1] * THICK]);
const PROFILE_F = _t(PROFILE_F0), PROFILE_H = _t(PROFILE_H0);

// ---- the animation state of one horse ----------------------------------------------------------------------------------------
export class HorseAnim {
  constructor(seed = 0) {
    this.phase = (seed * 0.37) % 1; this.t = seed * 3.1; this.lead = 1; this.seed = seed;
    this.x = 0; this.z = 0; this.heading = 0; this.v = 0; this.yawRate = 0;
    this.sm = { pitch: 0, bob: 0, roll: 0, kappa: 0, neck: 0, head: 0, ext: 0, neckYaw: 0, tailUp: 0, mw: 0, accel: 0, vv: 0 };
    this.tailYaw = [0, 0, 0, 0]; this.tailVel = [0, 0, 0, 0];
    this.legsBlend = [0, 0, 0, 0];
    this.pose = { legs: [0, 1, 2, 3].map(() => ({ x: 0, y: 0, z: 0, pastern: 0 })), tail: { pitch: 0.5, curl: 0.12, yaw: [0, 0, 0, 0] }, ears: [0, 0], rein: { x: 0, y: 1.5, z: 1.0 } };
    this.footEvents = [];
    this.prevPhase = [0, 0, 0, 0];
    this.idleLift = { leg: -1, t: 0, next: 4 + seed % 5 };
  }

  /** advance by dt with the sim's speed (m/s along the heading) and yaw rate (rad/s, + = turning left) */
  step(dt, v, yawRate, state = {}) {
    const m = this.sm;
    this.t += dt; this.v = v; this.yawRate = yawRate;
    const g = gaitAt(v);
    const mw = smooth(0.12, 0.8, v);
    m.mw += (mw - m.mw) * Math.min(1, dt * 8);
    // lead leg: keep it while cantering; choose from the turn direction while slow
    if (v < 4.6 && Math.abs(yawRate) > 0.3) this.lead = yawRate > 0 ? 1 : -1;
    const f = v > 0.05 ? Math.max(0.0, v) * g.duty / g.S : 0;
    this.phase = fract(this.phase + f * dt * m.mw);
    const accel = (v - m.vv) / Math.max(dt, 1e-3); m.vv = v;
    m.accel += (clamp(accel, -8, 8) - m.accel) * Math.min(1, dt * 5);
    const P = this.pose;
    const off = this.lead >= 0 ? g.off : [g.off[MIRROR[0]], g.off[MIRROR[1]], g.off[MIRROR[2]], g.off[MIRROR[3]]];
    // legs: ankle targets in the heading frame
    this.footEvents.length = 0;
    for (let l = 0; l < 4; l++) {
      const p = fract(this.phase + off[l]);
      let zo, yo, pastern = 0, swing = 0;
      if (p < g.duty) { const s = p / g.duty; zo = g.S * (0.5 - s); yo = 0; pastern = 0.25 * Math.sin(s * Math.PI) * (LEG_FRONT[l] ? 0 : 0.0); }
      else { const u = (p - g.duty) / (1 - g.duty); swing = Math.sin(u * Math.PI); const e = u * u * (3 - 2 * u); zo = g.S * (-0.5 + e); yo = g.lift * Math.pow(swing, 0.85) * (LEG_FRONT[l] ? 1.0 : 0.9); pastern = swing * (LEG_FRONT[l] ? 0.9 : 0.6); if (LEG_FRONT[l]) zo += 0.08 * swing * g.t; }
      // touchdown event
      const pp = this.prevPhase[l];
      if (m.mw > 0.5 && ((pp > p && p < 0.1 && pp > 0.9) )) this.footEvents.push({ leg: l });
      this.prevPhase[l] = p;
      // gather the front legs forward at the gallop's front, hind legs under the belly
      const z = lerp(0, zo, m.mw), y = lerp(0, yo, m.mw);
      const lg = P.legs[l];
      lg.x = LEG_X[l] * (1 - 0.15 * m.mw * g.t) + 0.0; lg.y = ANKLE_Y + y; lg.z = LEG_Z[l] + z + (LEG_FRONT[l] ? 0.04 : -0.0) - 0.0; lg.pastern = pastern * m.mw;
    }
    // body
    const ph = this.phase * TAU;
    const tgtPitch = g.pitch * Math.sin(ph + 0.6) * m.mw + clamp(m.accel * 0.006, -0.06, 0.06);
    const tgtBob = g.bob * Math.cos(g.bobK * ph + 0.3) * m.mw;
    // lean into turns: + yaw rate (left) leans to the left (+X side drops) -> roll about Z negative..positive per convention
    const lat = yawRate * v;
    const calm = this.calm ? 0.2 : 1;      // while the rider strikes the horse runs straight and level so the mallet can meet the ball exactly
    const tgtRoll = clamp(lat * 0.012, -0.22, 0.22) * calm;
    const tgtK = (v > 0.4 ? clamp(yawRate / Math.max(v, 1.5), -0.55, 0.55) : 0) * calm;
    m.pitch += (tgtPitch - m.pitch) * Math.min(1, dt * 18);
    m.bob += (tgtBob - m.bob) * Math.min(1, dt * 22);
    m.roll += (tgtRoll - m.roll) * Math.min(1, dt * 6);
    m.kappa += (tgtK - m.kappa) * Math.min(1, dt * 6);
    m.ext += (g.ext * m.mw - m.ext) * Math.min(1, dt * 3);
    // neck: raised at rest, lower and extended at speed; nods with the stride
    const neckBase = lerp(-0.12, -0.3, m.ext);
    const nod = Math.sin(ph + 2.1) * g.neck * m.mw;
    const idleNod = Math.sin(this.t * 0.9 + this.seed) * 0.03 * (1 - m.mw);
    m.neck += (neckBase + nod * 0.6 + idleNod - m.neck) * Math.min(1, dt * 14);
    m.head += (lerp(-0.3, 0.28, m.ext) + nod * 0.9 + 0.06 * Math.sin(this.t * 0.6 + 1.2) * (1 - m.mw) - m.head) * Math.min(1, dt * 14);
    m.neckYaw += (clamp(yawRate * 0.26, -0.5, 0.5) - m.neckYaw) * Math.min(1, dt * 5);
    // tail chain: each segment lags the previous and streams backwards/up with speed
    const wind = clamp(v / 11, 0, 1);
    for (let i = 0; i < 4; i++) {
      const tgt = (-yawRate * 0.22 + Math.sin(this.t * 1.7 + i * 0.9 + this.seed) * (0.12 + 0.1 * (1 - wind))) * (0.5 + i * 0.3) - lat * 0.012 * (i + 1) * 0.3;
      const k = 26 - i * 4;
      this.tailVel[i] += (tgt - this.tailYaw[i]) * k * dt - this.tailVel[i] * 5 * dt;
      this.tailYaw[i] += this.tailVel[i] * dt;
      P.tail.yaw[i] = clamp(this.tailYaw[i], -0.8, 0.8);
    }
    P.tail.pitch = lerp(0.95, 0.10, g.tailUp * m.mw) + 0.1 * Math.sin(ph * g.bobK + 1.4) * m.mw;
    P.tail.curl = lerp(0.1, -0.02, wind);
    P.ears[0] = Math.sin(this.t * 0.5 + this.seed * 2) > 0.92 ? 0.35 : 0.0; P.ears[1] = 0;
    P.pitch = m.pitch; P.bob = m.bob; P.roll = m.roll; P.kappa = m.kappa; P.neckPitch = m.neck; P.headPitch = m.head; P.neckYaw = m.neckYaw; P.headYaw = m.neckYaw;
    P.breath = this.t * 2.2; P.maneT = this.t * 5 + this.seed + this.phase * TAU * 0.5; P.maneSway = 0.03 + 0.05 * wind;
    P.x = this.x; P.z = this.z; P.heading = this.heading;
    return P;
  }

  // saddle point in the heading frame and the body's rigid transform (for the rider)
  saddle() {
    const m = this.sm, cp = Math.cos(m.pitch), sp = Math.sin(m.pitch), cr_ = Math.cos(m.roll), sr = Math.sin(m.roll);
    const yy = 1.52 - 1.1, zz = 0.05;
    const z1 = zz * cp - yy * sp, y1 = zz * sp + yy * cp;
    return { x: -y1 * sr, y: y1 * cr_ + 1.1 + m.bob, z: z1, pitch: m.pitch, roll: m.roll };
  }
}
