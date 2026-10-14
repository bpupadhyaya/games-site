// The throwing axe, at real scale (metres). Model frame: the origin is the axe's CENTRE OF MASS (the head is the heavy end, so it sits
// about 62 percent of the way up the handle), +Y runs from the butt towards the head, the cutting edge (the "bit") faces -Z, the cheeks
// face +/-X. Rotating the axe about X is its end-over-end flight: a(t) = 0 means handle up with the bit leading.
// The cutting edge of an axe runs along its handle, so a head that bites a board does so with the handle in the plane of the board
// (handle up or down) and then leans out toward the thrower as the wedge settles: that is what the stuck axes here do.
const lerp = (a, b, t) => a + (b - a) * t;

// handle: length (m), head: { f0 poll back, f1 edge reach, hh half height of the bit, cheek thickness }, mass is noted for the record only.
export const SPECS = [
  { name: 'Camp Hatchet', handle: 0.40, comFrac: 0.60, head: { f0: 0.040, f1: 0.092, hh: 0.050, th: 0.030, eyeH: 0.036 }, grams: 750, dbl: false },
  { name: 'Long Felling Axe', handle: 0.52, comFrac: 0.62, head: { f0: 0.040, f1: 0.108, hh: 0.060, th: 0.032, eyeH: 0.040 }, grams: 900, dbl: false },
  { name: 'Double-Bit', handle: 0.42, comFrac: 0.58, head: { f0: 0.090, f1: 0.090, hh: 0.050, th: 0.030, eyeH: 0.036 }, grams: 880, dbl: true },
  { name: 'Light Hand Axe', handle: 0.33, comFrac: 0.60, head: { f0: 0.030, f1: 0.078, hh: 0.042, th: 0.026, eyeH: 0.032 }, grams: 600, dbl: false },
];

export function createAxeKit(V3, { quality = 'high' } = {}) {
  const { THREE, board3d: B } = V3;
  const cache = new Map();
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4dbe3, metalness: 0.78, roughness: 0.3, envMapIntensity: 1.7 });
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x7e8791, metalness: 0.9, roughness: 0.42, envMapIntensity: 1.2 });
  const woodHandle = B.material('wood', { color: '#d9ae72', color2: '#e8c690', seed: 11, repeat: [1, 3], roughness: 0.55, size: 256 });
  const bandCols = { you: 0xffb83a, rival: 0x35c9b6 };

  // the handle: oval (a little deeper fore-aft than side to side), a swell at the grip, a flared butt and a socket at the head
  const handleGeo = (len, comY) => {
    const pts = [[0.012, -comY], [0.019, -comY + 0.004], [0.020, -comY + 0.02], [0.0155, -comY + 0.06], [0.0128, -comY + 0.12], [0.0128, -comY + 0.2], [0.0148, -comY + len * 0.55],
      [0.0134, -comY + len * 0.8], [0.0128, -comY + len * 0.95], [0.0, -comY + len]].map(([r, y]) => new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 20);
    g.scale(0.82, 1, 1.18);
    return g;
  };
  // one cutting head, lofted: stations from the poll (back) to the edge, each a flat-sided lens; the bit flares up and down and its
  // cutting edge is a convex arc. Smooth normals, so it catches the light like forged steel.
  const headGeo = (h, dir) => {
    const NS = 22, NR = 14, pos = [], idx = [];
    const f0 = h.f0, f1 = h.f1, e = h.eyeH;
    for (let i = 0; i <= NS; i++) {
      const u = i / NS, f = -f0 + (f0 + f1) * u;
      const s = Math.max(0, f / f1);
      const halfH = f < 0 ? e * (1 - 0.14 * Math.pow(-f / f0, 2)) : e + (h.hh - e) * Math.pow(s, 1.7);
      const halfW = f < 0 ? h.th / 2 * (1 - 0.18 * Math.pow(-f / f0, 2)) : Math.max(0.0012, (h.th / 2) * (1 - Math.pow(s, 1.25)) * 0.96);
      for (let j = 0; j < NR; j++) {
        const ph = (j / NR) * Math.PI * 2, c = Math.cos(ph), sn = Math.sin(ph);
        const x = halfW * Math.sign(c) * Math.pow(Math.abs(c), 0.7);
        const y = halfH * Math.sign(sn) * Math.pow(Math.abs(sn), 0.55);
        const fe = f - 0.016 * Math.pow(y / Math.max(1e-4, halfH), 2) * Math.pow(s, 2.4);
        pos.push(x, y, -fe * dir);
      }
    }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
      const a0 = i * NR + j, a1 = i * NR + (j + 1) % NR, b0 = (i + 1) * NR + j, b1 = (i + 1) * NR + (j + 1) % NR;
      if (dir > 0) idx.push(a0, b0, a1, a1, b0, b1); else idx.push(a0, a1, b0, a1, b1, b0);
    }
    // caps
    const c0 = pos.length / 3; pos.push(0, 0, f0 * dir); const c1 = c0 + 1; pos.push(0, 0, -f1 * dir);
    for (let j = 0; j < NR; j++) {
      const j2 = (j + 1) % NR;
      if (dir > 0) { idx.push(c0, j2, j); idx.push(c1, NS * NR + j, NS * NR + j2); } else { idx.push(c0, j, j2); idx.push(c1, NS * NR + j2, NS * NR + j); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  };

  function build(kind, side = 'you') {
    const key = `${kind}|${side}`;
    const spec = SPECS[kind] || SPECS[0], comY = spec.handle * spec.comFrac;
    const root = new THREE.Group(); root.name = `axe:${spec.name}`;
    const hg = handleGeo(spec.handle, comY);
    const handle = new THREE.Mesh(hg, woodHandle); handle.castShadow = true;
    // the side colour: a lacquered wrap above the butt (amber for you, teal for the rival) and a thin one below the head
    const wrapMat = new THREE.MeshStandardMaterial({ color: bandCols[side] || 0xffffff, roughness: 0.4, metalness: 0.1 });
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0172, 0.0172, 0.055, 16, 1, true), wrapMat);
    wrap.scale.set(0.82, 1, 1.18); wrap.position.y = -comY + 0.115; wrap.castShadow = true;
    const wrap2 = wrap.clone(); wrap2.scale.set(0.82, 0.35, 1.18); wrap2.position.y = -comY + spec.handle - 0.06;
    const headY = -comY + spec.handle - 0.036;
    const head = new THREE.Group(); head.position.y = headY;
    const hm = new THREE.Mesh(headGeo(spec.head, 1), steel); hm.castShadow = true; head.add(hm);
    if (spec.dbl) { const hm2 = new THREE.Mesh(headGeo({ ...spec.head, f0: spec.head.f1 * 0.2 }, -1), steel); hm2.castShadow = true; head.add(hm2); }
    // the eye collar (dark steel ring where the handle enters) and a wedge at the top of the handle
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.0185, spec.head.eyeH * 2.1, 14), steelDark);
    collar.scale.set(0.9, 1, 1.25); collar.castShadow = true; head.add(collar);
    root.add(handle, wrap, wrap2, head);
    // the point that bites: the middle of the edge, in root coordinates
    root.userData = { spec, comY, bit: new THREE.Vector3(0, headY, -spec.head.f1), tail: new THREE.Vector3(0, -comY, 0), grip: new THREE.Vector3(0, -comY + 0.075, 0), key, band: wrapMat };
    root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
    return root;
  }

  // a see-through copy used for the rotation blur (shares geometry; its own material)
  function ghost(src, opacity) {
    const g = src.clone(true);
    const m = new THREE.MeshBasicMaterial({ color: 0xe9eef5, transparent: true, opacity, depthWrite: false });
    g.traverse((o) => { if (o.isMesh) { o.material = m; o.castShadow = false; } });
    g.userData = { ...src.userData, ghostMat: m };
    g.visible = false;
    return g;
  }
  void lerp; void cache; void quality;
  return { build, ghost, SPECS };
}
