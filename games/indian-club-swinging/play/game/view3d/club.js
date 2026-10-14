// A turned wooden Indian club (jori / mugdar) as real 3D: lathe body with a lacquered grain texture, brass-or-teal turned rings, a
// knob at the handle end. Real-world scale (STATUS.md 'Scale'): 0.92 m long (a real jori is 0.6-0.8 m, shown at ~1.25x so the swing reads),
// handle 3.4 cm, belly 17 cm. The origin is the KNOB end, +Y runs along the club to the end; the game's "head" (belly centre) is at 0.82 L.
export const CLUB_LEN = 0.92;
export const HEAD_AT = 0.82;
const PROFILE = [[0, 0.0], [0.012, 0.03], [0.035, 0.045], [0.07, 0.03], [0.14, 0.024], [0.3, 0.032], [0.46, 0.05], [0.6, 0.088], [0.72, 0.122], [0.82, 0.136], [0.91, 0.122], [0.97, 0.085], [1, 0.0]];
const smooth = (x) => x * x * (3 - 2 * x);
const halfWidth = (s) => {
  for (let i = 1; i < PROFILE.length; i++) if (s <= PROFILE[i][0]) { const [s0, w0] = PROFILE[i - 1], [s1, w1] = PROFILE[i]; return w0 + (w1 - w0) * smooth((s - s0) / (s1 - s0 || 1)); }
  return 0;
};
const WIDTH_K = 0.72;                                  // real heads are slimmer than the painted 2D ones

export function woodTexture(THREE, doc, hi, mid, lo) {
  const c = doc.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = mid; g.fillRect(0, 0, 256, 256);
  let s = 7; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 70; i++) {                        // long grain lines along the club (the v axis of a lathe runs along it)
    const x = rnd() * 256, w = 1 + rnd() * 4;
    g.fillStyle = rnd() > 0.5 ? hi : lo; g.globalAlpha = 0.05 + rnd() * 0.12; g.fillRect(x, 0, w, 256);
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

export function buildClub(V3, doc, tone = 0) {
  const { THREE } = V3;
  const wood = tone === 0 ? { hi: '#ffd8a0', mid: '#b8702f', lo: '#4a2210', ring: 0xe8c25a, emis: 0xffb440 } : { hi: '#e8b88c', mid: '#8c4a2c', lo: '#35160c', ring: 0x46d6c0, emis: 0x40ffe0 };
  const L = CLUB_LEN;
  const pts = PROFILE.map(([s, w]) => new THREE.Vector2(Math.max(0.0008, w * L * WIDTH_K * (s > 0.1 && s < 0.35 ? 0.85 : 1)), s * L));
  const geo = new THREE.LatheGeometry(pts, 28);
  const tex = woodTexture(THREE, doc, wood.hi, wood.mid, wood.lo);
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, metalness: 0.0, clearcoat: 0.65, clearcoatRoughness: 0.25, emissive: wood.emis, emissiveIntensity: 0 });
  const body = new THREE.Mesh(geo, mat); body.castShadow = true; body.receiveShadow = true;
  const group = new THREE.Group(); group.add(body);
  // turned rings: a thin band slightly proud of the wood
  const ringMat = new THREE.MeshStandardMaterial({ color: wood.ring, roughness: 0.28, metalness: 0.85 });
  for (const [s0, s1] of [[0.085, 0.105], [0.53, 0.56], [0.93, 0.945]]) {
    const sm = (s0 + s1) / 2, r = halfWidth(sm) * L * WIDTH_K * (sm > 0.1 && sm < 0.35 ? 0.85 : 1) + 0.0016;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, (s1 - s0) * L, 28, 1, true), ringMat);
    band.position.y = sm * L; band.castShadow = false; group.add(band);
  }
  // grooves (dark lathe cuts)
  const cutMat = new THREE.MeshStandardMaterial({ color: 0x1e0c04, roughness: 0.9 });
  for (const s of [0.19, 0.25, 0.4, 0.66, 0.78]) {
    const r = halfWidth(s) * L * WIDTH_K * (s > 0.1 && s < 0.35 ? 0.85 : 1) + 0.0007;
    const cut = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.004, 28, 1, true), cutMat); cut.position.y = s * L; group.add(cut);
  }
  group.userData = { mat, body };
  return group;
}

// Radius of the wood at s (0..1 from the knob), metres.
export const radiusAt = (s) => halfWidth(s) * CLUB_LEN * WIDTH_K * (s > 0.1 && s < 0.35 ? 0.85 : 1);
