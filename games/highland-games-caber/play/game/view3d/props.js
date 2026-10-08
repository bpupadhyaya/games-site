// Props of the three events: the cabers (tapered, barked poles), the stone, the 56 lb weight with its chain, and the athlete's kilt.
// All procedural, with small canvas textures. Props that have a long axis use +Y from the small end (origin) to the big end.

function tex(THREE, w, h, draw, repeat) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
}
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function makeCaber(THREE, { L = 5.9, rSmall = 0.075, rBig = 0.19 } = {}) {
  const R = rnd(Math.round(L * 100));
  const bark = tex(THREE, 128, 256, (g, w, h) => {
    g.fillStyle = '#7b5a37'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const x = R() * w, y = R() * h, l = 10 + R() * 50; g.strokeStyle = `rgba(${40 + R() * 40},${28 + R() * 20},${14 + R() * 12},${0.25 + R() * 0.4})`; g.lineWidth = 1 + R() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 6, y + l); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(210,180,130,${0.04 + R() * 0.08})`; g.fillRect(R() * w, R() * h, 10 + R() * 30, 2 + R() * 4); }
  }, [1, Math.round(L / 1.2)]);
  const geo = new THREE.CylinderGeometry(rBig, rSmall, L, 20, 8, false);   // top = big end, bottom = small end
  geo.translate(0, L / 2, 0);
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bark, roughness: 0.92 }));
  body.castShadow = true;
  const g = new THREE.Group(); g.name = 'caber'; g.add(body);
  // pale cut faces at both ends and a darker band where the hands go
  const cut = (r, y, up) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 20), new THREE.MeshStandardMaterial({ color: 0xd2b283, roughness: 0.8 })); m.position.y = y; m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; return m; };
  g.add(cut(rBig, L + 0.002, true), cut(rSmall, -0.002, false));
  g.userData = { L, rSmall, rBig };
  return g;
}

export function makeStone(THREE, { r = 0.125 } = {}) {
  const R = rnd(77);
  const t = tex(THREE, 128, 128, (g, w, h) => { g.fillStyle = '#6f7077'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 30 : 200},${R() < 0.5 ? 30 : 200},${R() < 0.5 ? 40 : 200},${0.07 + R() * 0.15})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } });
  const geo = new THREE.SphereGeometry(r, 18, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.05 - 0.025; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.94, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.05 }));
  m.castShadow = true; m.name = 'stone';
  return m;
}

// The 56 lb weight: an iron block, a ring handle and a short chain. The chain is one thin cylinder the presenter stretches from the hand to the ring.
export function makeWeight(THREE) {
  const g = new THREE.Group(); g.name = 'weight';
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.45, metalness: 0.7 });
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.135, 0.24, 8), iron); block.castShadow = true; g.add(block);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 8, 16), iron); ring.position.y = 0.2; g.add(ring);
  const ct = tex(THREE, 8, 32, (c, w, h) => { c.fillStyle = '#2a2d33'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { c.fillStyle = '#7d828c'; c.fillRect(1, i * 8 + 1, w - 2, 4); } });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.5, metalness: 0.6 }));
  chain.name = 'chain'; chain.castShadow = false;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), iron);
  g.userData = { block, ring, chain, handle };
  return g;
}

// A pleated kilt of generic heather-and-moss check, attached to the pelvis bone of a loaded human. Returns { mesh, remove() }.
export function addKilt(THREE, human, { waist = 0.19, hem = 0.3, len = 0.4 } = {}) {
  const bone = human.bones.Bip01_Pelvis;
  human.model.updateMatrixWorld(true);
  const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(inv), up = new THREE.Vector3(0, 1, 0).applyQuaternion(inv), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(inv);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
  const N = 72, P = 18, rows = 4;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows, base = waist + (hem - waist) * Math.pow(v, 1.3);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, ph = ((i / N) * P) % 1, pleat = 1 + 0.07 * v * (ph < 0.5 ? ph * 2 : 2 - ph * 2) - 0.03 * v;
      // flatter at the back, slightly open at the hem front
      const r = base * pleat;
      pos.push(Math.sin(a) * r, 0.03 - v * len + (j === rows ? 0.012 * Math.sin(a * 6) : 0), Math.cos(a) * r * 1.02);
      uv.push((i / N) * 3, v * 1.5);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const t = tex(THREE, 64, 64, (g, w, h) => {
    g.fillStyle = '#3f5a3f'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(32,38,52,0.85)'; g.fillRect(0, 0, w * 0.4, h); g.fillRect(0, 0, w, h * 0.4); g.fillStyle = 'rgba(32,38,52,0.9)'; g.fillRect(0, 0, w * 0.4, h * 0.4);
    g.fillStyle = 'rgba(196,150,60,0.9)'; g.fillRect(w * 0.55, 0, 3, h); g.fillRect(0, h * 0.55, w, 3);
    g.fillStyle = 'rgba(150,70,60,0.7)'; g.fillRect(w * 0.82, 0, 2, h); g.fillRect(0, h * 0.82, w, 2);
  }, [1, 1]);
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  const holder = new THREE.Group(); holder.quaternion.copy(q); holder.add(mesh);
  // belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(waist + 0.005, waist + 0.005, 0.05, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6, side: THREE.DoubleSide })); belt.position.y = 0.045; holder.add(belt);
  bone.add(holder);
  return { mesh, holder, remove() { bone.remove(holder); } };
}
