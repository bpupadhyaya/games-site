// The bowls and the jack, at real-world scale (a bowl is 12-13 cm across, the jack 6.3 cm; the simulation's radii are about 1.3x
// those so the contacts read clearly, which is the enlargement the brief allows). A bowl is a flattened lens turned on a lathe with a
// lacquered body, a pale decal band, the big ring on its straight face and the small ring on its bias face (the side it leans to).
const TAU = Math.PI * 2;

function bodyProfile(R, flat) {
  // (r, y) pairs from the straight face (y > 0 side) round the belly to the bias face; the bias side is a touch flatter
  const pts = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI;              // 0 = straight-face pole, PI = bias-face pole
    const sy = Math.cos(a) >= 0 ? flat : flat * 0.86;
    pts.push([Math.max(0.0005, Math.sin(a) * R), Math.cos(a) * R * sy]);
  }
  return pts;
}

export function makeBowlKit(V3) {
  const { THREE } = V3;
  const cache = new Map();
  const TEAMS = [
    { body: '#0d0d10', band: '#b3271d', ring: '#d8c07a', spec: 0.9 },    // black with a red band and brass rings
    { body: '#efe7d2', band: '#2459a8', ring: '#2459a8', spec: 0.55 },   // ivory with a blue band
  ];
  const lacTex = (team) => {
    const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
    const t = TEAMS[team];
    g.fillStyle = t.body; g.fillRect(0, 0, 256, 256);
    // v = 0 at the straight pole .. 1 at the bias pole: the band round the belly, thin pinstripes, a few maker's marks
    g.fillStyle = t.band; g.fillRect(0, 114, 256, 30);
    g.fillStyle = team === 0 ? '#d8c07a' : '#e7d9ad'; g.fillRect(0, 108, 256, 3); g.fillRect(0, 147, 256, 3);
    g.fillStyle = team === 0 ? '#e9e2c9' : '#1a2c52';
    for (let i = 0; i < 4; i++) { g.fillRect(i * 64 + 18, 120, 10, 18); }       // the weight stamp, so the rolling reads
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 1); }
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx;
  };
  function make(team, r) {
    const key = `b${team}`;
    let geo = cache.get('geo');
    if (!geo) {
      const prof = bodyProfile(1, 0.82).map(([x, y]) => new THREE.Vector2(x, y));
      geo = new THREE.LatheGeometry(prof, 36); cache.set('geo', geo);
    }
    let mat = cache.get(key);
    if (!mat) {
      const t = TEAMS[team];
      mat = new THREE.MeshPhysicalMaterial({ map: lacTex(team), roughness: 0.16, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.3, color: 0xffffff });
      cache.set(key, mat);
    }
    const root = new THREE.Group();                // yaw (heading) and position
    const lay = new THREE.Group(); lay.rotation.z = -Math.PI / 2; root.add(lay);   // the lathe's axis (Y) becomes +X: the bias side
    const spin = new THREE.Group(); lay.add(spin);
    const body = new THREE.Mesh(geo, mat); body.scale.setScalar(r); body.castShadow = true; body.receiveShadow = false; spin.add(body);
    const t = TEAMS[team];
    const ringMat = new THREE.MeshStandardMaterial({ color: t.ring, roughness: 0.3, metalness: 0.7 });
    // big ring on the straight face (+Y of the lathe), small ring on the bias face (-Y)
    const bigR = new THREE.Mesh(new THREE.TorusGeometry(r * 0.52, r * 0.012, 6, 40), ringMat); bigR.rotation.x = Math.PI / 2; bigR.position.y = r * 0.82 * 0.855; spin.add(bigR);
    const smallR = new THREE.Mesh(new THREE.TorusGeometry(r * 0.22, r * 0.012, 6, 28), ringMat); smallR.rotation.x = Math.PI / 2; smallR.position.y = -r * 0.82 * 0.86 * 0.975; spin.add(smallR);
    // a tiny maker's dimple on each face
    const dim = new THREE.Mesh(new THREE.CircleGeometry(r * 0.08, 14), new THREE.MeshStandardMaterial({ color: t.ring, roughness: 0.4, metalness: 0.5 })); dim.rotation.x = -Math.PI / 2; dim.position.y = r * 0.82 * 0.998; spin.add(dim);
    root.userData = { spin, kind: 'bowl', team, r };
    return root;
  }
  function jack(r) {
    const root = new THREE.Group(); const lay = new THREE.Group(); root.add(lay);
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xf6f3ea, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.1, envMapIntensity: 1.1 }));
    m.castShadow = true; lay.add(m);
    // a faint seam so a rolling jack reads as rolling
    const seam = new THREE.Mesh(new THREE.TorusGeometry(r * 0.995, r * 0.02, 5, 32), new THREE.MeshStandardMaterial({ color: 0xd9d4c4, roughness: 0.6 })); lay.add(seam);
    root.userData = { spin: lay, kind: 'jack', r };
    return root;
  }
  return { make, jack };
}
