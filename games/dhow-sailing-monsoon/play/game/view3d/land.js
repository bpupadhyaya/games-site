// Coasts and harbours, reefs, dolphins, rain and the squall wall. All presentation: built once, then moved by the director.
import { clamp, lerp, smooth, DEG, rng } from './util3.js';
import { createShip } from './ship.js';

const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), sx), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), sx), sy); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.3 + vnoise(x * 4.3, y * 4.3) * 0.15;

export const COAST_STYLES = {
  kilwa: { sand: '#e6d6a8', green: '#4f7a3a', rock: '#8a7a5a', hill: 38, palms: 150, houses: 60, tint: '#f1e8d4', cove: true },
  mombasa: { sand: '#e8d9ae', green: '#487536', rock: '#7d6f52', hill: 30, palms: 170, houses: 70, tint: '#efe4cc', cove: true },
  aden: { sand: '#c8ae82', green: '#8b7d52', rock: '#5a4a3c', hill: 120, palms: 8, houses: 55, tint: '#e6d2ae', cove: true },
  muscat: { sand: '#d2b88a', green: '#7a7a4a', rock: '#6e5a45', hill: 95, palms: 40, houses: 50, tint: '#efe2c4', cove: true },
  surat: { sand: '#d9c690', green: '#5f8a3c', rock: '#8a7a50', hill: 12, palms: 90, houses: 70, tint: '#f0dfc0', cove: true },
  calicut: { sand: '#e0cf9a', green: '#3f7a35', rock: '#7a6a4a', hill: 55, palms: 220, houses: 55, tint: '#f1e6cc', cove: true },
  malacca: { sand: '#d8c694', green: '#2f7a3a', rock: '#6a6048', hill: 48, palms: 190, houses: 65, tint: '#ecdfc4', cove: true },
};

// A coast in local coordinates: x along the shore (+-HALF), +z out to sea, the shoreline at z = 0, land at z < 0, a harbour cove at x = 0.
export function buildCoast(THREE, style, quality, seed = 1) {
  const g = new THREE.Group();
  const HALF = 1100, DEEP = 900, nx = quality === 'low' ? 70 : 110, nz = quality === 'low' ? 24 : 36;
  const pos = [], col = [], idx = [];
  const sand = new THREE.Color(style.sand), green = new THREE.Color(style.green), rock = new THREE.Color(style.rock), tmp = new THREE.Color();
  const heightAt = (x, z) => {
    if (z > 0) return -3;
    const d = -z, edge = smooth(d / 60);
    let h = 0.5 + edge * 1.2 + smooth((d - 90) / 700) * style.hill * (0.5 + fbm(x * 0.004 + seed, d * 0.004));
    // the cove: a bay carved into the land around x = 0
    if (style.cove) { const cx = Math.abs(x) / 150, cd = d / 230; const bay = 1 - clamp(cx * cx * 0.9 + cd * cd * 0.6, 0, 1); h = lerp(h, -2.4, smooth(bay * 1.6)); }
    return h;
  };
  const verts = [];
  for (let k = 0; k <= nz; k++) for (let i = 0; i <= nx; i++) {
    const tx = i / nx, tz = k / nz, x = (tx * 2 - 1) * HALF, z = 40 - Math.pow(tz, 1.5) * (DEEP + 40);
    const h = heightAt(x, z);
    pos.push(x, h, z);
    const d = -z;
    tmp.copy(sand);
    if (h > 3 && d > 25) tmp.lerp(green, smooth((h - 2) / 6));
    if (h > style.hill * 0.5 + 10) tmp.lerp(rock, smooth((h - style.hill * 0.5 - 10) / 30));
    tmp.multiplyScalar(0.88 + 0.2 * vnoise(x * 0.05, z * 0.05));
    col.push(tmp.r, tmp.g, tmp.b); verts.push(h);
  }
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) { const a = k * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); land.receiveShadow = false; g.add(land);
  // palms, houses
  const R = rng(seed * 977 + 5);
  const palmN = Math.round(style.palms * (quality === 'low' ? 0.5 : 1)), trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 9, 5), crownGeo = new THREE.CylinderGeometry(0.2, 4.4, 2.2, 7);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#6a5034', roughness: 1 }), palmN);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: '#2f6a2c', roughness: 0.9 }), palmN);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), e = new THREE.Euler();
  let placed = 0;
  for (let tries = 0; placed < palmN && tries < palmN * 8; tries++) {
    const x = (R() * 2 - 1) * (HALF - 40), z = -(8 + R() * 260), h = heightAt(x, z);
    if (h < 0.7 || h > 14) continue; if (Math.abs(x) < 60 && -z < 240) continue;
    const s = 0.7 + R() * 0.7; e.set((R() - 0.5) * 0.25, R() * 6, (R() - 0.5) * 0.25); q.setFromEuler(e);
    m4.compose(p3.set(x, h + 4.4 * s, z), q, sc.set(s, s, s)); trunks.setMatrixAt(placed, m4);
    m4.compose(p3.set(x, h + 9.2 * s, z), q, sc.set(s, s * 0.8, s)); crowns.setMatrixAt(placed, m4); placed++;
  }
  trunks.count = placed; crowns.count = placed; g.add(trunks, crowns);
  const houseN = style.houses, houseGeo = new THREE.BoxGeometry(1, 1, 1);
  const houses = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({ color: style.tint, roughness: 0.95 }), houseN);
  const lampGeo = new THREE.SphereGeometry(0.5, 6, 4), lamps = new THREE.InstancedMesh(lampGeo, new THREE.MeshBasicMaterial({ color: '#ffcf86', transparent: true, opacity: 0, fog: true }), houseN);
  let hp = 0;
  for (let tries = 0; hp < houseN && tries < houseN * 30; tries++) {
    const ang = R() * Math.PI, rad = 70 + R() * 130, x = Math.cos(ang) * rad * (R() < 0.5 ? 1 : -1) * 0.9, z = -(10 + Math.sin(ang) * rad * 0.9);
    const h = heightAt(x, z); if (h < 0.9 || h > 20) continue;
    const w = 6 + R() * 8, hh = 4 + R() * 5, dd = 6 + R() * 7;
    e.set(0, R() * 0.5 - 0.25, 0); q.setFromEuler(e);
    m4.compose(p3.set(x, h + hh / 2 - 0.3, z), q, sc.set(w, hh, dd)); houses.setMatrixAt(hp, m4);
    m4.compose(p3.set(x + w * 0.3, h + hh * 0.55, z + dd * 0.52), q, sc.set(1.2, 1.4, 0.4)); lamps.setMatrixAt(hp, m4); hp++;
  }
  houses.count = hp; lamps.count = hp; g.add(houses, lamps);
  houses.castShadow = false;
  // a watch tower and a stone mole at the harbour mouth
  const stone = new THREE.MeshStandardMaterial({ color: style.tint, roughness: 0.95 });
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(5, 6.5, 26, 10), stone); tower.position.set(-120, heightAt(-120, -30) + 12, -30); g.add(tower);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5.2, 3, 10), new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 0.9 })); cap.position.set(-120, tower.position.y + 14.5, -30); g.add(cap);
  const lampT = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd68a', transparent: true, opacity: 0 })); lampT.position.set(-120, tower.position.y + 13, -30); g.add(lampT);
  const mole = new THREE.Mesh(new THREE.BoxGeometry(14, 3.2, 110), stone); mole.position.set(88, 0.6, -40); g.add(mole);
  g.userData = { heightAt, lamps, lampT, parts: { trunks, crowns, houses } };
  return g;
}

export function createReef(THREE, r, seed) {
  const g = new THREE.Group(), R = rng(seed * 31 + 7);
  const shoal = new THREE.Mesh(new THREE.CircleGeometry(r * 2.3, 28), new THREE.MeshBasicMaterial({ color: '#46d6c0', transparent: true, opacity: 0.5, depthWrite: false }));
  shoal.rotation.x = -Math.PI / 2; shoal.position.y = 0.12; g.add(shoal);
  const shoal2 = new THREE.Mesh(new THREE.CircleGeometry(r * 1.4, 24), new THREE.MeshBasicMaterial({ color: '#c8f2e0', transparent: true, opacity: 0.45, depthWrite: false }));
  shoal2.rotation.x = -Math.PI / 2; shoal2.position.y = 0.16; g.add(shoal2);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4e4638', roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = R() * Math.PI * 2, d = R() * r * 0.85, s = 2 + R() * 4.5;
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 6, 4), rockMat); m.scale.set(s, s * (0.35 + R() * 0.3), s * (0.8 + R() * 0.4)); m.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d); m.rotation.y = R() * 6; g.add(m);
  }
  const foam = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.9, r * 1.12, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = 0.2; g.add(m); foam.push(m); }
  g.userData = { foam, shoal, shoal2, r };
  return g;
}

export function createDolphins(THREE) {
  const g = new THREE.Group(), top = new THREE.MeshStandardMaterial({ color: '#6f8796', roughness: 0.45 }), belly = new THREE.MeshStandardMaterial({ color: '#dfe8ec', roughness: 0.5 });
  const ds = [];
  const part = (geo, mat, x, y, z, sx, sy, sz, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx; return m; };
  const sph = new THREE.SphereGeometry(1, 12, 8), cone = new THREE.CylinderGeometry(0, 1, 1, 4);
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Group();
    d.add(part(sph, top, 0, 0.03, 0, 0.3, 0.3, 1.05), part(sph, belly, 0, -0.1, -0.05, 0.25, 0.2, 0.95), part(sph, top, 0, 0, -1.05, 0.12, 0.11, 0.36), part(sph, top, 0, 0.12, -0.7, 0.2, 0.22, 0.4));
    d.add(part(cone, top, 0, 0.42, 0.1, 0.1, 0.34, 0.26, -0.5), part(cone, top, 0.0, 0.02, 1.2, 0.5, 0.05, 0.22, Math.PI / 2));
    d.visible = false; g.add(d); ds.push(d);
  }
  return { group: g, ds };
}

export function createRain(THREE) {
  const N = 420, pos = new Float32Array(N * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfd8e4', transparent: true, opacity: 0, depthWrite: false, fog: false }));
  m.frustumCulled = false;
  const seed = [];
  const R = rng(77); for (let i = 0; i < N; i++) seed.push([R() * 60 - 30, R() * 30, R() * 60 - 30, 0.6 + R() * 0.5]);
  return {
    mesh: m,
    update(t, camPos, level, windDx, windDz) {
      m.material.opacity = clamp(level * 0.55, 0, 0.55); m.visible = level > 0.02;
      if (!m.visible) return;
      for (let i = 0; i < N; i++) {
        const s = seed[i], y = ((s[1] - t * 24 * s[3]) % 30 + 30) % 30, x = camPos.x + s[0], z = camPos.z + s[2];
        pos[i * 6] = x; pos[i * 6 + 1] = camPos.y - 8 + y; pos[i * 6 + 2] = z; pos[i * 6 + 3] = x + windDx * 0.5; pos[i * 6 + 4] = camPos.y - 8 + y + 1.3; pos[i * 6 + 5] = z + windDz * 0.5;
      }
      g.attributes.position.needsUpdate = true;
    },
  };
}
export { createShip };
