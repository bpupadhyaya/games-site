// Props of the pit, built from primitives: a wooden club (meel), a shield (sang) with its low stand, the goblet drum (zarb) on its
// tripod, the brass bell and the drummer's stool. Lengths in metres; a club's +Y axis runs from its butt (origin) to its head.
import { THREE } from '../vendor3d/index.js';

const T = THREE;

// A surface of revolution about +Y from a [[radius, y], ...] profile (the shared three bundle has no LatheGeometry).
export function lathe(profile, seg = 24, smooth = true) {
  const pos = [], nor = [], idx = [], uv = [];
  const n = profile.length;
  for (let i = 0; i < n; i++) {
    const [r, y] = profile[i];
    const [r0, y0] = profile[Math.max(0, i - 1)], [r1, y1] = profile[Math.min(n - 1, i + 1)];
    let nr = y1 - y0, ny = -(r1 - r0);                         // outward normal of the profile tangent
    const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(c * r, y, s * r); nor.push(c * nr, ny, s * nr); uv.push(j / seg, i / (n - 1));
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  void smooth;
  return g;
}

export function makeMats() {
  const std = (color, rough = 0.7, metal = 0, extra = {}) => new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
  return {
    wood: std(0xc98a46, 0.55), woodDark: std(0x7a4318, 0.6), woodPale: std(0xe3b878, 0.6),
    copper: std(0xc8742f, 0.35, 0.8), brass: std(0xd9a73a, 0.3, 0.85), skin: std(0xf2e2c0, 0.8),
    leather: std(0x5a3418, 0.8), cloth: std(0x27408f, 0.9),
  };
}

// The meel: a slim handle swelling to a heavy head, with two copper bands. Origin at the butt end of the handle.
export function makeClub(M) {
  const g = new T.Group();
  const body = new T.Mesh(lathe([[0.0, 0], [0.03, 0.005], [0.027, 0.03], [0.024, 0.2], [0.028, 0.34], [0.045, 0.5], [0.07, 0.68], [0.086, 0.8], [0.084, 0.88], [0.062, 0.94], [0.0, 0.97]], 20), M.wood);
  g.add(body);
  for (const [y, r] of [[0.36, 0.034], [0.84, 0.089]]) { const b = new T.Mesh(new T.TorusGeometry(r, 0.008, 6, 20), M.copper); b.rotation.x = Math.PI / 2; b.position.y = y; g.add(b); }
  g.scale.setScalar(0.82);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// The sang: a thick board with two grab bars on its underside and three planks showing on top. Origin at its centre.
export function makeShield(M) {
  const g = new T.Group();
  const board = new T.Mesh(new T.BoxGeometry(0.84, 0.05, 0.4), M.woodPale); g.add(board);
  for (const z of [-0.13, 0, 0.13]) { const p = new T.Mesh(new T.BoxGeometry(0.842, 0.054, 0.012), M.woodDark); p.position.set(0, 0.002, z); g.add(p); }
  const rim = new T.Mesh(new T.BoxGeometry(0.86, 0.056, 0.03), M.woodDark); rim.position.z = 0.205; g.add(rim);
  const rim2 = rim.clone(); rim2.position.z = -0.205; g.add(rim2);
  for (const x of [-0.28, 0.28]) { const h = new T.Mesh(new T.BoxGeometry(0.035, 0.05, 0.2), M.woodDark); h.position.set(x, -0.045, 0); g.add(h); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A low wooden block the shield rests on, so a lift starts at a height the arms can reach.
export function makeStand(M) {
  const g = new T.Group();
  const top = new T.Mesh(new T.BoxGeometry(1.0, 0.07, 0.56), M.woodDark); top.position.y = 0.265; g.add(top);
  for (const x of [-0.4, 0.4]) { const leg = new T.Mesh(new T.BoxGeometry(0.12, 0.23, 0.46), M.wood); leg.position.set(x, 0.115, 0); g.add(leg); }
  const brace = new T.Mesh(new T.BoxGeometry(0.7, 0.05, 0.05), M.wood); brace.position.set(0, 0.16, 0); g.add(brace);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// The goblet drum on a tripod. Origin at the centre of the skin (head); the skin faces +Y, tilted towards the player by the caller.
export function makeDrum(M) {
  const g = new T.Group();
  const body = new T.Mesh(lathe([[0.0, -0.46], [0.11, -0.46], [0.125, -0.42], [0.1, -0.36], [0.058, -0.28], [0.05, -0.2], [0.07, -0.1], [0.135, -0.02], [0.165, 0.0]], 28), M.leather);
  g.add(body);
  const head = new T.Mesh(new T.CylinderGeometry(0.168, 0.168, 0.012, 32), M.skin); head.position.y = 0.002; g.add(head);
  const hoop = new T.Mesh(new T.TorusGeometry(0.168, 0.012, 8, 32), M.copper); hoop.rotation.x = Math.PI / 2; hoop.position.y = -0.004; g.add(hoop);
  const band = new T.Mesh(new T.TorusGeometry(0.052, 0.009, 6, 20), M.brass); band.rotation.x = Math.PI / 2; band.position.y = -0.22; g.add(band);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

export function makeBell(M) {
  const g = new T.Group();
  const bell = new T.Mesh(lathe([[0.0, 0.22], [0.05, 0.21], [0.075, 0.16], [0.085, 0.09], [0.11, 0.02], [0.125, 0.0]], 24), M.brass);
  g.add(bell);
  const stand = new T.Mesh(new T.CylinderGeometry(0.012, 0.012, 0.24, 8), M.woodDark); stand.position.set(0, 0.1, 0); stand.visible = false; g.add(stand);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function makeStool(M) {
  const g = new T.Group();
  const seat = new T.Mesh(new T.CylinderGeometry(0.23, 0.23, 0.05, 20), M.woodDark); seat.position.y = 0.36; g.add(seat);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const l = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.36, 8), M.wood); l.position.set(Math.cos(a) * 0.15, 0.18, Math.sin(a) * 0.15); g.add(l); }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
