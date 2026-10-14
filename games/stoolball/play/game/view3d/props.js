// Props at real-world size (metres): the stoolball paddle (willow, 0.27 x 0.29 m face on a 0.30 m taped handle), the stool board on its
// post (0.30 m square board, centre 1.20 m above the grass), and the ball (tennis-ball size, 0.036 m radius).
// Paddle grip convention (human.attach): +Y along the handle, origin at the butt, metres; userData.sweet = the face centre.
let BB = null;
const cv = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function initProps(V) { BB = V.board3d; }

function woodTex(THREE, base, grain, seed = 3, w = 256, h = 256) {
  const c = cv(w, h), g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  let s = seed >>> 0; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 70; i++) {
    const x = r() * w, a = 0.05 + r() * 0.16; g.strokeStyle = grain.replace('A', String(a)); g.lineWidth = 0.6 + r() * 1.8;
    g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 18, h * 0.3, x + (r() - 0.5) * 18, h * 0.7, x + (r() - 0.5) * 10, h); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const rbox = (THREE, w, h, d, r) => (BB && BB.roundedBox ? BB.roundedBox(w, h, d, r, 3) : new THREE.BoxGeometry(w, h, d));

// One flat piece of willow: a taped round handle, then a flat neck that flares smoothly into a rounded-square blade (0.27 wide, 0.30 long,
// 22 mm thick, bevelled), with a darker bound edge. Total length 0.65 m, face centre 0.50 m from the butt.
export function makePaddle(THREE) {
  const g = new THREE.Group(); g.name = 'paddle';
  const wood = new THREE.MeshStandardMaterial({ map: woodTex(THREE, '#e6c27c', 'rgba(110,70,20,A)', 9), roughness: 0.55 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x8a5a26, roughness: 0.6 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x24262c, roughness: 0.9 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0165, 0.27, 14), tape); handle.position.y = 0.135;
  const butt = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), tape); butt.scale.y = 0.6;
  const mk = (grow, mat, depth) => {
    const w = 0.135 + grow, y0 = 0.25, y1 = 0.355, y2 = 0.65, r = 0.07 + grow;
    const sh = new THREE.Shape();
    sh.moveTo(-0.017 - grow, y0);
    sh.bezierCurveTo(-0.02 - grow, y0 + 0.05, -w * 0.7, y1 - 0.04, -w, y1 + 0.03);          // the neck flares out into the blade
    sh.lineTo(-w, y2 - r); sh.quadraticCurveTo(-w, y2 + grow, -w + r, y2 + grow);
    sh.lineTo(w - r, y2 + grow); sh.quadraticCurveTo(w, y2 + grow, w, y2 - r);
    sh.lineTo(w, y1 + 0.03); sh.bezierCurveTo(w * 0.7, y1 - 0.04, 0.02 + grow, y0 + 0.05, 0.017 + grow, y0);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
    geo.translate(0, 0, -depth / 2);
    return new THREE.Mesh(geo, mat);
  };
  const rim = mk(0.006, edge, 0.016), face = mk(0, wood, 0.024);
  g.add(handle, butt, rim, face);
  g.userData.sweet = 0.5;
  return g;
}

// A board on a post. setFall(f, x, z, scale, dt): f 0..1 knocks the board off its post (same arc as the flat game);
// strike(p) makes the board ring (small damped wobble).
export function makeBoard(THREE) {
  const root = new THREE.Group(); root.name = 'board';
  const white = new THREE.MeshStandardMaterial({ color: 0xf4efe0, roughness: 0.55 });
  const woodM = new THREE.MeshStandardMaterial({ map: woodTex(THREE, '#e8c98a', 'rgba(120,75,25,A)', 5), roughness: 0.5 });
  const rimM = new THREE.MeshStandardMaterial({ color: 0x6e2f16, roughness: 0.6 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.045, 1.05, 12), white); post.position.y = 0.525;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.036, 0.06, 12), white); cap.position.y = 1.07;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 12), white); foot.position.y = 0.025;
  const bd = new THREE.Group();
  const rim = new THREE.Mesh(rbox(THREE, 0.32, 0.32, 0.03, 0.015), rimM);
  const face = new THREE.Mesh(rbox(THREE, 0.285, 0.285, 0.036, 0.01), woodM); face.position.z = 0.002;
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 24), new THREE.MeshStandardMaterial({ color: 0xa8331f, roughness: 0.5 })); dot.rotation.x = Math.PI / 2; dot.position.z = 0.003;
  const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc9a23a, metalness: 0.8, roughness: 0.3 })); bolt.position.set(0, 0, 0.026);
  bd.add(rim, face, dot, bolt);
  bd.position.y = 1.2;
  root.add(post, cap, foot, bd);
  const api = {
    root, wob: 0, wobT: 0,
    setFall(f, x, z, scale = 1, dt = 0) {
      root.position.set(x, 0, z); root.scale.setScalar(Math.max(1, scale * 0.9));
      const bh = 0.3;
      if (f > 0) {
        bd.position.set(f * 0.3 * 2.6, 1.2 + (f * 0.6 * bh - f * f * 2.2 * bh), 0.1 * f); bd.rotation.z = -f * 1.6; bd.rotation.x = f * 0.5;
      } else {
        api.wobT += dt; const e = Math.exp(-api.wobT * 4.5);
        bd.position.set(0, 1.2, 0); bd.rotation.set(Math.sin(api.wobT * 38) * 0.05 * api.wob * e, 0, Math.sin(api.wobT * 31 + 1) * 0.035 * api.wob * e);
      }
    },
    strike(power = 1) { api.wob = power; api.wobT = 0; },
  };
  return api;
}

// The ball: optic-yellow felt with a white curved seam (readable on grass and on cream whites). Real size.
export function makeBallMesh(THREE, radius = 0.036) {
  const c = cv(128, 64), g = c.getContext('2d');
  g.fillStyle = '#d8e24a'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(${150 + ((i * 37) % 60)},${180 + ((i * 53) % 50)},40,0.12)`; g.fillRect((i * 71) % 128, (i * 29) % 64, 2, 2); }
  g.strokeStyle = '#fbfbf2'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 20); g.bezierCurveTo(32, 4, 32, 60, 64, 44); g.bezierCurveTo(96, 28, 96, 4, 128, 20); g.stroke();
  g.beginPath(); g.moveTo(0, 52); g.bezierCurveTo(32, 36, 32, 70, 64, 60); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
  m.name = 'ball';
  return m;
}
