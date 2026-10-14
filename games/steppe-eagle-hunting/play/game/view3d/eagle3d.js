// A golden eagle as a real 3D bird: lofted body, neck and head with a hooked bill, feathered thighs with yellow feet and black talons,
// and every flight feather as an individual curved card on a jointed wing (shoulder, elbow, wrist, hand): 10 primaries that finger out and
// curl up under load, 12 secondaries, 3 tertials, three rows of coverts, and a 12-feather banded tail that fans. All motion is a pure function
// of the pose numbers passed to setPose(): the presenter derives them from sim state, nothing here reads a clock.
//
// Eagle local frame: +Z forward (head), +Y up, +X to the bird's left. Wingspan ~2.1 m, length ~0.85 m (real scale).
import { featherCanvas, plumageCanvas } from './textures.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = (c, T) => { const k = new T.Color(c); return [k.r, k.g, k.b]; };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// An elliptical loft along z. sections: [{ z, y, x, rx, ry }]. colorFn(u 0..1 along, a angle 0 = top, pi = bottom) -> [r,g,b].
const cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
// Smooth the control sections (Catmull-Rom on every parameter) so a loft with a handful of sections has a continuous outline.
export function smoothSections(sections, per = 3) {
  if (sections.length < 3 || per < 2) return sections;
  const out = [], n = sections.length, keys = ['z', 'y', 'x', 'rx', 'ry'];
  for (let i = 0; i < n - 1; i++) {
    const a = sections[Math.max(0, i - 1)], b = sections[i], c = sections[i + 1], d = sections[Math.min(n - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const t = k / per, o = {};
      for (const key of keys) o[key] = cr(a[key] || 0, b[key] || 0, c[key] || 0, d[key] || 0, t);
      out.push(o);
    }
  }
  out.push({ ...sections[n - 1] });
  return out;
}
export function loft(T, sections, seg, colorFn, uvScale = [2, 3], smooth = 3) {
  sections = smoothSections(sections, smooth);
  const n = sections.length, pos = [], col = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const s = sections[i];
    for (let k = 0; k <= seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      pos.push((s.x || 0) + s.rx * Math.sin(a), s.y + s.ry * Math.cos(a), s.z);
      const c = colorFn ? colorFn(i / (n - 1), a) : [1, 1, 1];
      col.push(c[0], c[1], c[2]);
      uv.push((k / seg) * uvScale[0], (i / (n - 1)) * uvScale[1]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + seg + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const ROWS = 7;
export function createEagle(T, opts = {}) {
  const { PALETTES } = opts;
  let pal = PALETTES[0];
  const root = new T.Group(); root.name = 'eagle';
  const body = new T.Group(); root.add(body);

  // ---- materials ----
  const plume = new T.CanvasTexture(plumageCanvas(5)); plume.wrapS = plume.wrapT = T.RepeatWrapping; plume.colorSpace = T.SRGBColorSpace; plume.anisotropy = 4;
  const bodyMat = new T.MeshStandardMaterial({ vertexColors: true, map: plume, roughness: 0.78, metalness: 0, side: T.FrontSide });
  const mk = (kind, seed) => { const t = new T.CanvasTexture(featherCanvas(kind, seed)); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; };
  const texs = { prim: mk('prim', 1), sec: mk('sec', 2), cov: mk('cov', 3), tail: mk('tail', 4), nape: mk('nape', 5) };
  const featherMats = {};
  for (const k of Object.keys(texs)) featherMats[k] = new T.MeshStandardMaterial({ vertexColors: true, map: texs[k], alphaTest: 0.28, side: T.DoubleSide, roughness: 0.72, metalness: 0 });
  const yellow = new T.MeshStandardMaterial({ color: 0xe2b933, roughness: 0.55, metalness: 0 });
  const horn = new T.MeshStandardMaterial({ color: 0x1b1712, roughness: 0.35, metalness: 0.05 });
  const eyeMat = new T.MeshStandardMaterial({ color: 0xe19a1c, roughness: 0.2, metalness: 0, emissive: 0x3a2200, emissiveIntensity: 0.6 });
  const pupilMat = new T.MeshStandardMaterial({ color: 0x050302, roughness: 0.15 });

  // ---- palette-driven colours ----
  const P = () => ({
    body: hex(pal.body, T), dark: hex(pal.dark, T), mid: hex(pal.mid, T), light: hex(pal.light, T), nape: hex(pal.nape, T), tail: hex(pal.tail, T),
  });

  // ---- torso, neck + head, bill, legs (static geometry) ----
  const torsoSecs = [
    { z: -0.34, y: -0.005, rx: 0.03, ry: 0.025 }, { z: -0.24, y: 0.0, rx: 0.07, ry: 0.06 }, { z: -0.10, y: 0.005, rx: 0.113, ry: 0.10 },
    { z: 0.05, y: 0.02, rx: 0.135, ry: 0.122 }, { z: 0.17, y: 0.035, rx: 0.125, ry: 0.125 }, { z: 0.27, y: 0.055, rx: 0.088, ry: 0.098 }, { z: 0.34, y: 0.075, rx: 0.052, ry: 0.06 },
  ];
  const headPivot = new T.Vector3(0, 0.115, 0.32);
  const headSecs = [
    { z: -0.02, y: -0.01, rx: 0.052, ry: 0.058 }, { z: 0.03, y: 0.004, rx: 0.058, ry: 0.066 }, { z: 0.085, y: 0.012, rx: 0.056, ry: 0.06 },
    { z: 0.13, y: 0.008, rx: 0.042, ry: 0.044 }, { z: 0.16, y: 0.0, rx: 0.026, ry: 0.03 }, { z: 0.172, y: -0.004, rx: 0.014, ry: 0.016 },
  ];
  const colorBody = (c) => (u, a) => {
    const top = 0.5 + 0.5 * Math.cos(a);               // 1 on the back, 0 on the belly
    let col = mix3(mix3(c.body, c.light, 0.22), mix3(c.mid, c.dark, 0.25), Math.pow(top, 0.8));
    if (u > 0.6 && u < 0.95) col = mix3(col, c.nape, 0.22 * top);     // golden shawl over the shoulders
    col = scale3(col, 0.84 + 0.26 * (0.5 + 0.5 * Math.sin(u * 9 + a * 2)));
    return col;
  };
  const torso = new T.Mesh(loft(T, torsoSecs, 20, colorBody(P()), [3, 3]), bodyMat); torso.castShadow = true; body.add(torso);
  const headG = new T.Group(); headG.position.copy(headPivot); body.add(headG);
  const head = new T.Mesh(loft(T, headSecs, 16, (u, a) => { const c = P(); const top = 0.5 + 0.5 * Math.cos(a); let k = mix3(c.mid, c.body, 0.5 + 0.3 * top); if (u < 0.45) k = mix3(k, c.nape, (0.45 - u) * 1.8 * (0.4 + 0.6 * top)); if (u > 0.6) k = mix3(k, c.dark, 0.3); return k; }, [2, 1]), bodyMat);
  head.castShadow = true; headG.add(head);
  // neck bridge back to the torso
  const neck = new T.Mesh(loft(T, [{ z: -0.14, y: -0.045, rx: 0.056, ry: 0.07 }, { z: -0.07, y: -0.03, rx: 0.058, ry: 0.07 }, { z: -0.015, y: -0.012, rx: 0.052, ry: 0.058 }], 14, (u, a) => { const c = P(); return mix3(c.nape, c.mid, 0.4 + 0.5 * (0.5 - 0.5 * Math.cos(a))); }, [2, 1]), bodyMat);
  neck.castShadow = true; headG.add(neck);
  // bill: upper mandible hooks down; cere yellow, tip horn
  const billSecs = [
    { z: 0.13, y: -0.006, rx: 0.02, ry: 0.026 }, { z: 0.158, y: -0.012, rx: 0.019, ry: 0.026 }, { z: 0.184, y: -0.02, rx: 0.014, ry: 0.022 },
    { z: 0.2, y: -0.034, rx: 0.009, ry: 0.016 }, { z: 0.208, y: -0.052, rx: 0.005, ry: 0.01 }, { z: 0.206, y: -0.066, rx: 0.002, ry: 0.004 },
  ];
  const bill = new T.Mesh(loft(T, billSecs, 12, (u) => (u < 0.38 ? hex(0xe0b22e, T) : mix3(hex(0xcaa23a, T), hex(0x17130e, T), clamp((u - 0.38) * 2.4, 0, 1)))), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
  bill.castShadow = true; headG.add(bill);
  const jaw = new T.Mesh(loft(T, [{ z: 0.1, y: -0.034, rx: 0.014, ry: 0.01 }, { z: 0.16, y: -0.036, rx: 0.012, ry: 0.009 }, { z: 0.19, y: -0.04, rx: 0.006, ry: 0.006 }], 8, () => hex(0x2a231a, T)), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 }));
  headG.add(jaw);
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new T.Mesh(new T.SphereGeometry(0.0155, 14, 10), eyeMat); eye.position.set(s * 0.042, 0.018, 0.1); eye.scale.set(0.7, 1, 1); headG.add(eye);
    const pu = new T.Mesh(new T.SphereGeometry(0.0078, 10, 8), pupilMat); pu.position.set(s * 0.0505, 0.018, 0.106); headG.add(pu);
    const brow = new T.Mesh(new T.SphereGeometry(0.02, 12, 8), new T.MeshStandardMaterial({ color: hex(pal.dark, T).map((v) => v), roughness: 0.8 }));
    brow.scale.set(0.9, 0.5, 1.9); brow.position.set(s * 0.041, 0.037, 0.095); brow.rotation.set(0.05, 0, s * 0.35); headG.add(brow);
    eyes.push({ eye, pu, brow });
  }
  // legs: feathered thigh, feathered tarsus, yellow toes with black talons
  const legs = [];
  const toeGeo = (len) => { const g = new T.CylinderGeometry(0.0085, 0.0105, len, 7); g.translate(0, -len / 2, 0); return g; };
  const talonGeo = () => { const g = new T.CylinderGeometry(0.0095, 0.0012, 0.036, 7); g.translate(0, -0.018, 0); return g; };
  for (const s of [-1, 1]) {
    const leg = new T.Group(); leg.position.set(s * 0.075, -0.075, 0.0); body.add(leg);
    const thigh = new T.Mesh(new T.SphereGeometry(0.064, 14, 12), bodyMat); thigh.scale.set(0.8, 1.35, 1.0); thigh.position.set(0, -0.04, 0.01); thigh.castShadow = true; leg.add(thigh);
    const tar = new T.Mesh(new T.CylinderGeometry(0.03, 0.019, 0.13, 10), bodyMat); tar.position.set(0, -0.13, 0.02); tar.castShadow = true; leg.add(tar);
    const foot = new T.Group(); foot.position.set(0, -0.195, 0.03); leg.add(foot);
    const toes = [];
    const toeAngles = [[0.0, 0.32], [0.38, 0.28], [-0.38, 0.28], [Math.PI, 0.25]];
    toeAngles.forEach(([yaw, len], i) => {
      const t0 = new T.Group(); t0.rotation.y = yaw; foot.add(t0);
      const seg = new T.Mesh(toeGeo(0.05), yellow); seg.rotation.x = -(Math.PI / 2 - 0.18); t0.add(seg);   // points out along +z
      const seg2 = new T.Group(); seg2.position.set(0, -Math.sin(0.18) * 0.05, Math.cos(0.18) * 0.05); seg2.rotation.x = -0.9; t0.add(seg2);
      const s2 = new T.Mesh(toeGeo(len * 0.18 + 0.03), yellow); seg2.add(s2);
      const tal = new T.Mesh(talonGeo(), horn); tal.position.set(0, -(len * 0.18 + 0.03), 0); tal.rotation.x = 0.7; tal.castShadow = true; seg2.add(tal);
      toes.push({ t0, seg2 });
    });
    legs.push({ leg, foot, toes, s });
  }

  // ---- feather cards ----
  // card: { kind, bone (0 upper, 1 fore, 2 hand, 'tail'), t, off (along trailing v), lift, a (in-plane angle), len, wid, curl, row (colour role), side }
  const cards = [];
  const addWing = (s) => {
    for (let i = 0; i < 10; i++) cards.push({ kind: 'prim', s, bone: 2, t: 0.1 + 0.088 * i, a: 0.04 + (9 - i) * 0.1, len: 0.3 + 0.17 * Math.sin(Math.PI * (i + 2.2) / 12.4), wid: 0.056, curl: 0.42 - 0.02 * (9 - i), i, role: 'prim' });
    for (let j = 0; j < 12; j++) cards.push({ kind: 'sec', s, bone: 1, t: 1 - j / 11, a: 1.18 + 0.2 * (j / 11), len: 0.33 + 0.1 * (j / 11), wid: 0.082, curl: 0.12, i: j, role: 'sec' });
    for (let j = 0; j < 3; j++) cards.push({ kind: 'sec', s, bone: 0, t: 0.25 + 0.4 * j, a: 1.35 + 0.1 * j, len: 0.4 - 0.02 * j, wid: 0.09, curl: 0.06, i: j, role: 'tert' });
    const covRows = [[0.11, 0.06, 0.0, 0.012, 'cov0'], [0.16, 0.07, 0.05, 0.008, 'cov1'], [0.23, 0.08, 0.11, 0.004, 'cov2']];
    covRows.forEach(([len, wid, off, lift, role], k) => {
      for (let j = 0; j < 14; j++) {
        const bone = j < 3 ? 0 : j < 9 ? 1 : 2, tt = bone === 0 ? (j + 0.5) / 3 : bone === 1 ? (j - 3 + 0.5) / 6 : (j - 9 + 0.5) / 5;
        cards.push({ kind: 'cov', s, bone, t: clamp(tt, 0.02, 0.98), off, lift, a: bone === 2 ? 0.35 + 0.15 * k : 1.2 + 0.1 * k, len: len * (bone === 2 ? 1.0 : 1.0), wid, curl: 0.1, i: j, role });
      }
    });
  };
  addWing(1); addWing(-1);
  for (let i = 0; i < 12; i++) cards.push({ kind: 'tail', s: 1, bone: 'tail', t: i / 11, a: 0, len: 0.46 - 0.025 * Math.abs(i / 11 - 0.5) * 2, wid: 0.092, curl: 0.02, i, role: 'tail' });
  const NC = cards.length, NV = NC * ROWS * 2;
  const pos = new Float32Array(NV * 3), nor = new Float32Array(NV * 3), colA = new Float32Array(NV * 3), uvA = new Float32Array(NV * 2);
  const idxByMat = { prim: [], sec: [], cov: [], tail: [] };
  cards.forEach((c, n) => {
    const base = n * ROWS * 2;
    for (let r = 0; r < ROWS; r++) {
      const v = r / (ROWS - 1);
      uvA[(base + r * 2) * 2] = 0; uvA[(base + r * 2) * 2 + 1] = v; uvA[(base + r * 2 + 1) * 2] = 1; uvA[(base + r * 2 + 1) * 2 + 1] = v;
    }
    const L = idxByMat[c.kind];
    for (let r = 0; r < ROWS - 1; r++) { const a = base + r * 2; L.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const fgeo = new T.BufferGeometry();
  fgeo.setAttribute('position', new T.BufferAttribute(pos, 3)); fgeo.setAttribute('normal', new T.BufferAttribute(nor, 3));
  fgeo.setAttribute('color', new T.BufferAttribute(colA, 3)); fgeo.setAttribute('uv', new T.BufferAttribute(uvA, 2));
  const order = ['prim', 'sec', 'cov', 'tail'], all = [];
  const groups = [];
  for (const k of order) { groups.push({ start: all.length, count: idxByMat[k].length, mat: k }); all.push(...idxByMat[k]); }
  fgeo.setIndex(all);
  groups.forEach((g, i) => fgeo.addGroup(g.start, g.count, i));
  const fmesh = new T.Mesh(fgeo, order.map((k) => featherMats[k]));
  fmesh.frustumCulled = false; fmesh.castShadow = true; body.add(fmesh);

  // nape hackles (on the head group, static; the head rotation moves them)
  const napeCards = [];
  for (let i = 0; i < 16; i++) napeCards.push({ a: (i / 16) * Math.PI * 2, len: 0.08 + 0.02 * ((i * 7) % 3) });
  const napeGroup = new T.Group(); headG.add(napeGroup);
  const napeMeshes = napeCards.map((c, i) => {
    const g = new T.PlaneGeometry(0.034, c.len, 1, 3); g.translate(0, c.len / 2, 0);
    const m = new T.Mesh(g, new T.MeshStandardMaterial({ map: texs.nape, color: 0xffffff, alphaTest: 0.45, side: T.DoubleSide, roughness: 0.7 }));
    m.position.set(Math.sin(c.a) * 0.045, -0.008 + Math.cos(c.a) * 0.052, -0.035);
    m.rotation.set(-Math.PI / 2 - 0.3 + Math.cos(c.a) * 0.25, 0, -Math.sin(c.a) * 0.8);
    m.castShadow = true; napeGroup.add(m); return m;
  });

  // ---- palette ----
  const roleColors = () => {
    const c = P();
    const darkTip = scale3(c.dark, 0.55);
    return {
      prim: [mix3(c.mid, c.light, 0.15), c.mid, c.dark, darkTip], sec: [mix3(c.mid, c.light, 0.3), c.mid, c.dark, darkTip],
      tert: [c.body, c.mid, c.dark, darkTip], cov0: [c.body, c.body, c.mid, c.mid], cov1: [c.light, c.body, c.body, c.mid], cov2: [c.light, c.light, c.body, c.mid],
      tail: [mix3(c.tail, c.light, 0.35), c.tail, c.tail, scale3(c.dark, 0.6)],
    };
  };
  const paint = () => {
    const rc = roleColors();
    cards.forEach((c, n) => {
      const cols = rc[c.role], base = n * ROWS * 2;
      for (let r = 0; r < ROWS; r++) {
        const v = r / (ROWS - 1);
        let col;
        if (c.role === 'tail') {   // pale base, two bars, a dark terminal band
          col = mix3(cols[0], cols[1], clamp(v * 3, 0, 1));
          if ((v > 0.3 && v < 0.4) || (v > 0.52 && v < 0.6)) col = scale3(col, 0.68);
          if (v > 0.8) col = mix3(col, cols[3], clamp((v - 0.8) * 6, 0, 1));
        } else {
          const f = v * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(f));
          col = mix3(cols[k], cols[k + 1], f - k);
          if (c.role === 'prim' && c.i < 5 && v > 0.15 && v < 0.55) col = mix3(col, hex(pal.light, T), 0.35);   // pale patch on the inner primaries
          if (c.role === 'sec' && v > 0.2 && v < 0.5 && c.i % 2) col = scale3(col, 1.18);                         // faint barring
        }
        const j = 0.88 + ((n * 37) % 11) / 45;
        for (const q of [0, 1]) { const p = (base + r * 2 + q) * 3; colA[p] = col[0] * j; colA[p + 1] = col[1] * j; colA[p + 2] = col[2] * j; }
      }
    });
    fgeo.attributes.color.needsUpdate = true;
    // static meshes carry vertex colours too: rebuild them with the palette
    const recolor = (mesh, secs, seg, fn) => { const g = loft(T, secs, seg, fn); mesh.geometry.dispose(); mesh.geometry = g; };
    recolor(torso, torsoSecs, 20, colorBody(P()));
    napeMeshes.forEach((m, i) => { m.material.color.set(i % 2 ? pal.nape : pal.light); });
    eyes.forEach((e) => e.brow.material.color.set(pal.dark));
    for (const l of legs) l.leg.traverse((o) => { if (o.material === bodyMat) { /* feathered legs use the plumage map; palette comes from vertex colours of the sphere (white): tint via userData */ } });
  };
  // the leg geometry (spheres/cylinders) has no vertex colours: give the body material a colour via per-mesh materials
  const legMat = new T.MeshStandardMaterial({ color: 0xffffff, map: plume, roughness: 0.85 });
  for (const l of legs) l.leg.traverse((o) => { if (o.isMesh && o.material === bodyMat) o.material = legMat; });
  const setPalette = (p) => { pal = p; paint(); legMat.color.set(pal.body).lerp(new T.Color(pal.light), 0.45); };
  paint(); legMat.color.set(pal.body).lerp(new T.Color(pal.light), 0.45);

  // ---- pose ----
  const W = { L0: 0.2, L1: 0.32, L2: 0.3 };
  const tmp = { d: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], P: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const wing = (s, p) => {
    const { flap, lag, sweep, fold } = p;
    const dirs = [];
    let b = 0.1 + sweep * 0.8, ph = flap * 0.62 + 0.1 - sweep * 0.12;
    const open = [];
    {
      const b0 = b, p0 = ph, b1 = b0 + 0.12 + sweep * 0.5, p1 = p0 + flap * 0.3, b2 = b1 + 0.26 + sweep * 0.35, p2 = p1 + lag * 0.55 - flap * 0.08;
      for (const [bb, pp] of [[b0, p0], [b1, p1], [b2, p2]]) open.push([s * Math.cos(pp) * Math.cos(bb), Math.sin(pp), -Math.cos(pp) * Math.sin(bb)]);
    }
    const folded = [[s * 0.2, 0.06, -0.98], [s * -0.04, 0.12, 0.99], [s * 0.05, -0.1, -0.99]];
    for (let k = 0; k < 3; k++) dirs.push(norm([lerp(open[k][0], folded[k][0], fold), lerp(open[k][1], folded[k][1], fold), lerp(open[k][2], folded[k][2], fold)]));
    const S = [s * (0.11 + 0.02 * fold), 0.075, 0.13];
    const Pj = [S];
    const Ls = [W.L0, W.L1, W.L2];
    for (let k = 0; k < 3; k++) { const q = Pj[k]; Pj.push([q[0] + dirs[k][0] * Ls[k], q[1] + dirs[k][1] * Ls[k], q[2] + dirs[k][2] * Ls[k]]); }
    return { dirs, P: Pj, Ls };
  };
  const state = { cur: null };
  function setPose(p = {}) {
    const q = { flap: 0, lag: 0, sweep: 0, fold: 0, spread: 1, tailFan: 0.35, tailPitch: 0, pitch: 0, roll: 0, legs: 0, headYaw: 0, headPitch: 0, ruffle: 0, t: 0, load: 0.5, ...p };
    state.cur = q;
    body.rotation.set(-q.pitch, 0, q.roll);
    headG.rotation.set(q.headPitch, q.headYaw, 0);
    // legs: tucked up under the belly in flight, dropped and spread for the strike and the landing
    for (const l of legs) {
      l.leg.rotation.x = lerp(-1.25, -0.2 + 0.1 * Math.sin(q.t * 3), q.legs);
      l.foot.rotation.x = lerp(1.2, 0.35, q.legs);
      l.toes.forEach((tt, i) => { tt.t0.rotation.x = 0; tt.seg2.rotation.x = lerp(-1.25, -0.5 - (i === 3 ? 0.2 : 0), q.legs); });
    }
    napeGroup.children.forEach((m, i) => { m.rotation.x = -Math.PI / 2 - 0.3 + Math.cos(napeCards[i].a) * 0.25 + q.ruffle * 0.4 * Math.sin(q.t * 9 + i); });
    const wl = [wing(1, q), wing(-1, q)];
    const flutter = q.t;
    const fan = q.spread;
    cards.forEach((c, n) => {
      const base = n * ROWS * 2;
      let R, d, nW;
      if (c.bone === 'tail') {
        const f = (c.t - 0.5) * 2, ang = f * (0.12 + q.tailFan * 0.62), pit = q.tailPitch;
        d = norm([Math.sin(ang) * Math.cos(pit), -Math.sin(pit), -Math.cos(ang) * Math.cos(pit)]);
        R = [f * 0.03, -0.005, -0.3]; nW = norm([0, Math.cos(pit), -Math.sin(pit)]);
        nW = norm([nW[0] - d[0] * (nW[0] * d[0] + nW[1] * d[1] + nW[2] * d[2]), nW[1] - d[1] * (nW[0] * d[0] + nW[1] * d[1] + nW[2] * d[2]), nW[2] - d[2] * (nW[0] * d[0] + nW[1] * d[1] + nW[2] * d[2])]);
      } else {
        const w = wl[c.s === 1 ? 0 : 1], u = w.dirs[c.bone], Pb = w.P[c.bone], Lb = w.Ls[c.bone];
        const v = norm([c.s * u[2], 0, -c.s * u[0]]);
        const cu = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        nW = norm([cu[0] * c.s, cu[1] * c.s, cu[2] * c.s]);
        let a = c.a;
        if (c.role === 'prim') a = 0.04 + (9 - c.i) * 0.1 * fan + (1 - fan) * 0.05;
        const ca = Math.cos(a), sa = Math.sin(a);
        d = norm([u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa]);
        if (q.fold > 0.001) {   // a folded wing lies back along the flank: feathers point toward the tail, the card faces outward
          const k = Math.pow(q.fold, 0.7), bk = c.bone === 2 ? [c.s * 0.05, -0.04, -1] : [c.s * 0.18, -0.02 - 0.1 * c.t, -1];
          d = norm([lerp(d[0], bk[0], k), lerp(d[1], bk[1], k), lerp(d[2], bk[2], k)]);
          nW = norm([lerp(nW[0], c.s * 0.9, k), lerp(nW[1], 0.35, k), lerp(nW[2], 0, k)]);
        }
        const off = c.off || 0, lift = (c.lift || 0);
        R = [Pb[0] + u[0] * Lb * c.t + v[0] * off + nW[0] * lift, Pb[1] + u[1] * Lb * c.t + v[1] * off + nW[1] * lift, Pb[2] + u[2] * Lb * c.t + v[2] * off + nW[2] * lift];
      }
      // lateral direction = d x nW
      let wx = d[1] * nW[2] - d[2] * nW[1], wy = d[2] * nW[0] - d[0] * nW[2], wz = d[0] * nW[1] - d[1] * nW[0];
      const wl2 = Math.hypot(wx, wy, wz) || 1; wx /= wl2; wy /= wl2; wz /= wl2;
      const curlK = c.curl * (0.55 + q.load * 0.9) * (c.bone === 'tail' ? 0.6 : 1) * (1 - q.fold * 0.7);
      for (let r = 0; r < ROWS; r++) {
        const t = r / (ROWS - 1), L = c.len * t;
        const fl = Math.sin(flutter * 11 + n * 1.7 + t * 3) * 0.012 * t * (0.4 + q.ruffle + Math.abs(q.flap));
        const cx = R[0] + d[0] * L + nW[0] * (curlK * c.len * t * t + fl), cy = R[1] + d[1] * L + nW[1] * (curlK * c.len * t * t + fl), cz = R[2] + d[2] * L + nW[2] * (curlK * c.len * t * t + fl);
        const hw = c.wid * 0.5 * (0.65 + 0.35 * Math.min(1, t * 3)) * (c.role === 'prim' ? lerp(1, 0.85, t) : 1) * (1 + q.fold * (c.role === 'tail' ? 0 : 1.5));
        for (const [qi, sg] of [[0, -1], [1, 1]]) {
          const p0 = (base + r * 2 + qi) * 3;
          pos[p0] = cx + wx * hw * sg; pos[p0 + 1] = cy + wy * hw * sg; pos[p0 + 2] = cz + wz * hw * sg;
          nor[p0] = nW[0]; nor[p0 + 1] = nW[1]; nor[p0 + 2] = nW[2];
        }
      }
    });
    fgeo.attributes.position.needsUpdate = true; fgeo.attributes.normal.needsUpdate = true;
  }
  setPose({});
  return {
    root, body, setPose, setPalette, headG, legs, cards,
    dispose() { fgeo.dispose(); },
    // where the talons are (eagle local), for placing the bird on the glove
    footLocal() { return { x: 0, y: -0.075 - 0.195 - 0.04, z: 0.03 }; },
  };
}
