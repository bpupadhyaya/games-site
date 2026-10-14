// The three halls and the round mat, built from primitives and canvas textures. One group per venue; the presenter shows one at a time.
const TAU = Math.PI * 2;

function canvasTex(THREE, w, h, draw, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function star8(g, x, y, r) {
  g.beginPath();
  for (let k = 0; k < 16; k++) { const a = (k * TAU) / 16 - Math.PI / 2, rr = k % 2 ? r * 0.58 : r; k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  g.closePath();
}

export function buildMat(THREE, quality) {
  const grp = new THREE.Group();
  const tex = canvasTex(THREE, 1024, 1024, (g, w, h) => {
    const cx = w / 2, cy = h / 2, R = w / 2;
    // apron (blue), danger band (yellow), contest circle (green): radii as fractions of the 5.2 m half-width
    g.fillStyle = '#1d3f96'; g.fillRect(0, 0, w, h);
    const r = rng(11);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,30'},${0.015 + r() * 0.03})`; g.fillRect(r() * w, r() * h, 2, 2); }
    const ring = (rad, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, R * rad, 0, TAU); g.fill(); };
    ring(0.96, '#e7ab1c'); ring(0.74, '#2a9a68');
    const gr = g.createRadialGradient(cx - R * 0.2, cy - R * 0.25, R * 0.05, cx, cy, R * 0.74);
    gr.addColorStop(0, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(0,30,20,0.18)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R * 0.74, 0, TAU); g.fill();
    // mat seams and the centre mark
    g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 2;
    for (const k of [0.12, 0.26, 0.4, 0.55]) { g.beginPath(); g.arc(cx, cy, R * k, 0, TAU); g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 7; g.beginPath(); g.arc(cx, cy, R * 0.74, 0, TAU); g.stroke();
    g.lineWidth = 4; g.strokeStyle = 'rgba(20,50,120,0.55)'; g.beginPath(); g.arc(cx, cy, R * 0.96, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(cx, cy, 10, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.2)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - R * 0.74, cy); g.lineTo(cx + R * 0.74, cy); g.moveTo(cx, cy - R * 0.74); g.lineTo(cx, cy + R * 0.74); g.stroke();
  });
  const mat = new THREE.Mesh(new THREE.CircleGeometry(5.2, 72), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 }));
  mat.rotation.x = -Math.PI / 2; mat.position.y = 0.004; mat.receiveShadow = true;
  // a slight raised edge so the mat has a thickness
  const edge = new THREE.Mesh(new THREE.CylinderGeometry(5.22, 5.3, 0.1, 72, 1, true), new THREE.MeshStandardMaterial({ color: '#16296b', roughness: 0.85 }));
  edge.position.y = -0.045;
  grp.add(mat, edge);
  void quality;
  return grp;
}

function floor(THREE, kind) {
  const tex = canvasTex(THREE, 512, 512, (g, w, h) => {
    const r = rng(kind.length * 7 + 3);
    if (kind === 'hall') {
      g.fillStyle = '#5a3418'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 128) { const o = ((y / 64) % 2) * 64; g.fillStyle = `hsl(${24 + r() * 8} ${44 + r() * 12}% ${24 + r() * 10}%)`; g.fillRect(x + o - 128, y, 126, 62); g.fillRect(x + o, y, 126, 62); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let y = 0; y <= h; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    } else if (kind === 'arena') {
      g.fillStyle = '#14214a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.fillRect(r() * w, r() * h, 2, 2); }
    } else {
      g.fillStyle = '#c8aa78'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) { g.fillStyle = `hsl(${36 + r() * 8} ${30 + r() * 12}% ${60 + r() * 12}%)`; g.fillRect(x + 3, y + 3, 122, 122); }
      g.strokeStyle = 'rgba(70,45,20,0.4)'; g.lineWidth = 3; for (let k = 0; k <= w; k += 128) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, h); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(w, k); g.stroke(); }
    }
  }, { repeat: [10, 10] });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  m.rotation.x = -Math.PI / 2; m.position.y = -0.1; m.receiveShadow = true;
  return m;
}

function courtyard(THREE, quality) {
  const grp = new THREE.Group();
  grp.add(floor(THREE, 'courtyard'));
  // the tiled iwan: a tall wall with a pointed arch niche and rows of eight-pointed stars
  const wall = canvasTex(THREE, 2048, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1c97ad'); gr.addColorStop(1, '#0c5a78');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const cell = 96;
    for (let y = 0; y < h; y += cell) for (let x = 0; x < w; x += cell) {
      const odd = ((x / cell) + (y / cell)) % 2;
      g.fillStyle = odd ? 'rgba(255,226,150,0.20)' : 'rgba(0,30,60,0.22)'; star8(g, x + cell / 2, y + cell / 2, cell * 0.47); g.fill();
      g.strokeStyle = 'rgba(255,232,170,0.5)'; g.lineWidth = 2.5; star8(g, x + cell / 2, y + cell / 2, cell * 0.47); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 2; g.beginPath(); g.arc(x + cell / 2, y + cell / 2, cell * 0.17, 0, TAU); g.stroke();
    }
    // pointed arch niches left and right of the centre, with a gold frame
    const niche = (cx, nw) => {
      g.fillStyle = '#23160c'; g.beginPath(); g.moveTo(cx - nw / 2, h); g.lineTo(cx - nw / 2, h * 0.5); g.quadraticCurveTo(cx, h * 0.0, cx + nw / 2, h * 0.5); g.lineTo(cx + nw / 2, h); g.closePath(); g.fill();
      g.strokeStyle = '#f0c75a'; g.lineWidth = 12; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx - nw * 0.42, h); g.lineTo(cx - nw * 0.42, h * 0.52); g.quadraticCurveTo(cx, h * 0.07, cx + nw * 0.42, h * 0.52); g.lineTo(cx + nw * 0.42, h); g.stroke();
    };
    niche(w * 0.2, w * 0.14); niche(w * 0.5, w * 0.16); niche(w * 0.8, w * 0.14);
  });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshStandardMaterial({ map: wall, roughness: 0.85 }));
  wm.position.set(0, 5.4, -11);
  grp.add(wm);
  // two side towers (minaret-like columns) for depth
  for (const sx of [-1, 1]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 12, 24), new THREE.MeshStandardMaterial({ color: '#d9b878', roughness: 0.8 }));
    col.position.set(sx * 8.6, 5.9, -8.4); grp.add(col);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 1.4, 24), new THREE.MeshStandardMaterial({ color: '#1f9fb6', roughness: 0.6 }));
    band.position.set(sx * 8.6, 9.2, -8.4); grp.add(band);
  }
  void quality;
  return { grp, sky: ['#7fc4e0', '#e9dcc0'], light: 'day', fog: [14, 40] };
}

function hall(THREE, quality) {
  const grp = new THREE.Group();
  grp.add(floor(THREE, 'hall'));
  const wall = canvasTex(THREE, 1024, 512, (g, w, h) => {
    g.fillStyle = '#3a1f10'; g.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let x = 0; x < w; x += 64) { g.fillStyle = `hsl(${20 + r() * 6} ${42 + r() * 10}% ${16 + r() * 8}%)`; g.fillRect(x + 2, 0, 60, h); }
    g.strokeStyle = 'rgba(255,190,120,0.25)'; g.lineWidth = 3;
    for (let x = 64; x < w; x += 128) { g.beginPath(); g.arc(x, h * 0.55, 54, Math.PI, TAU); g.lineTo(x + 54, h); g.lineTo(x - 54, h); g.closePath(); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, w, 18); g.fillRect(0, h - 22, w, 22);
  });
  const wm = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshStandardMaterial({ map: wall, roughness: 0.9 }));
  wm.position.set(0, 5.9, -8.5); grp.add(wm);
  // hanging lanterns: emissive spheres on thin cords
  for (let i = -3; i <= 3; i++) {
    const y = 6.2 - (Math.abs(i) % 2) * 0.9;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 6, 4), new THREE.MeshBasicMaterial({ color: '#2a1a10' }));
    cord.position.set(i * 2.5, y + 3, -6.2); grp.add(cord);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffb54a', emissive: '#ff9a2a', emissiveIntensity: 1.6, roughness: 0.4 }));
    lamp.scale.y = 1.25; lamp.position.set(i * 2.5, y, -6.2); grp.add(lamp);
  }
  void quality;
  return { grp, sky: ['#2a150c', '#3a2012'], light: 'evening', fog: [10, 32] };
}

function arena(THREE, quality) {
  const grp = new THREE.Group();
  grp.add(floor(THREE, 'arena'));
  // a ring of grandstand tiers with a crowd of heads and shoulders (instanced)
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshLambertMaterial(), 2400);
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.14, 0.2, 4, 8), new THREE.MeshLambertMaterial(), 2400);
  const r = rng(9), m4 = new THREE.Matrix4(), c = new THREE.Color();
  let n = 0;
  const tiers = quality === 'low' ? 4 : 7;
  for (let t = 0; t < tiers; t++) {
    const rad = 11 + t * 1.0, y = 1.4 + t * 0.7;
    const cnt = Math.round((Math.PI * 1.35 * rad) / 0.4);
    for (let k = 0; k < cnt && n < 2400; k++) {
      const a = Math.PI + (-0.675 + (1.35 * k) / cnt) * Math.PI;        // an arc behind the mat (towards -z)
      const x = Math.cos(a - Math.PI / 2) * rad, z = -Math.abs(Math.sin(a - Math.PI / 2)) * rad;
      void x; void z;
      const th = -0.675 * Math.PI + (1.35 * Math.PI * k) / cnt;          // -121 .. +121 degrees from straight back
      const px = Math.sin(th) * rad, pz = -Math.cos(th) * rad;
      m4.makeTranslation(px, y + 0.25, pz); bodies.setMatrixAt(n, m4);
      c.setHSL(r(), 0.25 + r() * 0.25, 0.1 + r() * 0.12); bodies.setColorAt(n, c);
      m4.makeTranslation(px, y + 0.62, pz); heads.setMatrixAt(n, m4);
      c.setHSL(0.06 + r() * 0.04, 0.35 + r() * 0.2, 0.2 + r() * 0.16); heads.setColorAt(n, c);
      n++;
    }
  }
  heads.count = n; bodies.count = n;
  grp.add(heads, bodies);
  // risers
  for (let t = 0; t < tiers; t++) {
    const rad = 11 + t * 1.0;
    const g = new THREE.CylinderGeometry(rad + 0.4, rad + 0.4, 0.7 + t * 0.7, 48, 1, true, -0.675 * Math.PI + Math.PI, 1.35 * Math.PI);
    const mm = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: '#10193a', roughness: 0.9, side: THREE.DoubleSide }));
    mm.position.y = (0.7 + t * 0.7) / 2 + 0.7; mm.rotation.y = Math.PI; grp.add(mm);
  }
  // banners
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 4), new THREE.MeshStandardMaterial({ color: sx < 0 ? '#2b63c9' : '#1f9a62', roughness: 0.7, emissive: '#101018' }));
    b.position.set(sx * 5.2, 5.2, -8.4); grp.add(b);
  }
  return { grp, sky: ['#050a1c', '#0a1330'], light: 'night', fog: [12, 36] };
}

export function buildVenues(THREE, quality) {
  return { courtyard: courtyard(THREE, quality), hall: hall(THREE, quality), arena: arena(THREE, quality) };
}
