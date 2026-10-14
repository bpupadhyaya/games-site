// A Bozo pirogue: a long, slim, plank-built hull with a sprung bow and stern, painted in bands, an inner floor, thwarts, a paddle,
// a calabash and a heap of spare net. Built as lofted sections (BufferGeometry). Local coordinates: x across (centre 0), z along (stern -2 .. bow 5).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const BOAT = { z0: -2.0, z1: 5.0, floorY: -0.1 };

export function buildBoat(THREE) {
  const { z0, z1 } = BOAT;
  const half = (z) => { const u = clamp((z - z0) / (z1 - z0), 0, 1), body = Math.sin(Math.PI * Math.pow(u, 0.78)); return 0.55 * (0.12 + 0.88 * Math.pow(Math.max(0, body), 0.8)) + 0.02; };
  const rise = (z) => 0.32 + 0.34 * Math.pow(clamp((z - 2.2) / (z1 - 2.2), 0, 1), 2.2) + 0.12 * Math.pow(clamp((-0.6 - z) / 1.4, 0, 1), 1.6);
  const N = 44, M = 16;
  const outerTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    for (let x = 0; x < 128; x++) {
      const e = Math.abs(x / 127 - 0.5) * 2; // 0 keel .. 1 gunwale
      g.fillStyle = e < 0.46 ? '#1d130b' : e < 0.7 ? '#b4743a' : e < 0.78 ? '#efe6cf' : e < 0.88 ? '#2b58a0' : '#a8362a';
      g.fillRect(x, 0, 1, 128);
    }
    let s = 5; const img = g.getImageData(0, 0, 128, 128);
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.16; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.fillStyle = 'rgba(20,10,4,0.5)'; for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 1);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3); t.anisotropy = 4; return t;
  })();
  const innerTex = (() => {
    const c = globalThis.document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#8a6540'; g.fillRect(0, 0, 64, 128);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${i % 2 ? '40,22,8' : '200,160,100'},0.22)`; g.lineWidth = 1 + (i % 3); g.beginPath(); const x = (i * 13) % 64; g.moveTo(x, 0); g.lineTo(x + (i % 5) - 2, 128); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();

  const shell = (inset, keel, uvScale, tex, rough, flip) => {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const z = z0 + (z1 - z0) * (i / N), hw = Math.max(0.01, half(z) - inset), top = rise(z) - (inset ? 0.01 : 0);
      for (let j = 0; j <= M; j++) {
        const th = -Math.PI / 2 + Math.PI * (j / M), x = hw * Math.sin(th), u = Math.abs(Math.sin(th));
        const y = keel + (top - keel) * Math.pow(u, 1.8);
        pos.push(x, y, z); uv.push(j / M, i / N * uvScale);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + 1, c = a + M + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (flip) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i)); }
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: 0.0, side: THREE.DoubleSide }));
  };
  const hull = new THREE.Group();
  const outer = shell(0, -0.2, 1, outerTex, 0.62); outer.receiveShadow = false; hull.add(outer);
  const inner = shell(0.055, BOAT.floorY - 0.0, 1, innerTex, 0.85, false); inner.receiveShadow = true; hull.add(inner);
  // the gunwale cap: a thin lip joining the outer and inner shells
  {
    const pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const z = z0 + (z1 - z0) * (i / N), hw = Math.max(0.01, half(z)), t2 = rise(z); pos.push(-hw, t2, z, -hw + 0.06, t2 + 0.01, z, hw - 0.06, t2 + 0.01, z, hw, t2, z); }
    for (let i = 0; i < N; i++) for (const k of [0, 2]) { const a = i * 4 + k, b = a + 1, c = a + 4, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    hull.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#c79660', roughness: 0.6, side: THREE.DoubleSide })));
  }
  // thwarts, prow knobs
  const wood = new THREE.MeshStandardMaterial({ color: '#9b7242', roughness: 0.7 });
  for (const z of [-0.9, 3.9]) { const w = half(z) * 2 + 0.1; const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.22), wood); m.position.set(0, rise(z) - 0.12, z); m.castShadow = true; hull.add(m); }
  for (const z of [z0 + 0.02, z1 - 0.02]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.5 })); k.position.set(0, rise(z) + 0.05, z); hull.add(k); }
  // paddle along the right gunwale (x positive = the fisher's left when seen from behind: it lies on the near side)
  {
    const pad = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.0, 8), wood); shaft.rotation.x = Math.PI / 2; pad.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.5), wood); blade.position.z = 1.15; pad.add(blade);
    pad.position.set(-0.34, -0.02, 3.2); pad.rotation.y = 0.04; pad.castShadow = true; hull.add(pad);
  }
  // calabash bowl and a heap of spare net
  {
    const cal = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshStandardMaterial({ color: '#c8a35a', roughness: 0.55, side: THREE.DoubleSide }));
    cal.position.set(0.28, -0.04, 4.0); cal.scale.set(1, 0.8, 1); cal.rotation.x = Math.PI; cal.position.y = 0.06; hull.add(cal);
    const heap = new THREE.Group();
    const nm = new THREE.MeshStandardMaterial({ color: '#cdb27a', roughness: 0.95 });
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), nm); b.scale.set(1.4, 0.55, 1.1); b.position.set((i % 3 - 1) * 0.16, 0.05 + (i > 2 ? 0.1 : 0), (i % 2) * 0.1); b.rotation.y = i * 0.9; heap.add(b); }
    heap.position.set(0.18, BOAT.floorY, 0.2); hull.add(heap);
  }
  hull.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
  for (const m of hull.children) if (m.material && m.material.map === innerTex) m.material.emissive = new THREE.Color('#2a1a0c');
  // waterline foam ring
  const ringTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); g.clearRect(0, 0, 64, 256); g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.ellipse(32, 128, 27, 120, 0, 0, Math.PI * 2); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.beginPath(); g.ellipse(32, 128, 22, 108, 0, 0, Math.PI * 2); g.stroke(); const t = new THREE.CanvasTexture(c); return t; })();
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 7.9), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.012, 1.5); ring.renderOrder = 6;
  const group = new THREE.Group(); group.add(hull);
  const water = new THREE.Group(); water.add(ring);
  return { group, hull, ring, water, rise, half };
}
