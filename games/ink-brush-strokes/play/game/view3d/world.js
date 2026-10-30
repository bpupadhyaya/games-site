// The scholar's desk, all procedural (no bitmaps): a dark walnut desk, an indigo felt mat, bronze paperweights, a slate ink stone with an ink
// stick, a celadon water dropper, a cinnabar seal-paste box, a bamboo brush, and a paper window whose lattice throws its shadow across the desk.
// Units are centimetres. The sheet of xuan paper is 30 x 40 cm (the 600 x 800 page of the 2D layout, 0.05 cm per unit).
import * as THREE from '../vendor3d/three.js';

export const PW = 30, PH = 40, FELT_Y = 0.7, PAPER_Y = 0.76, FELT_W = 46, FELT_D = 56;
const TAU = Math.PI * 2;
const rnd = (() => { let s = 20241027; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = 1, aniso = 8) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = aniso; return t; };
const cache = new Map();
export const clearCaches = () => { for (const v of cache.values()) v.dispose?.(); cache.clear(); };
const once = (k, f) => { if (!cache.has(k)) cache.set(k, f()); return cache.get(k); };

export const softDot = (rgb) => once('dot' + rgb, () => {
  const c = mkCanvas(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, `rgba(${rgb},1)`); r.addColorStop(0.4, `rgba(${rgb},0.35)`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
});
export const blobShadow = () => once('blob', () => {
  const c = mkCanvas(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(10,8,6,0.55)'); r.addColorStop(0.5, 'rgba(10,8,6,0.22)'); r.addColorStop(1, 'rgba(10,8,6,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
});

// ---- surfaces -----------------------------------------------------------------------------------------------------------------------------------
function woodTex() {
  return once('wood', () => {
    const c = mkCanvas(1024, 1024), g = c.getContext('2d');
    g.fillStyle = '#4e3321'; g.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 520; i++) {                                   // long grain lines, slightly wavy
      const y = rnd() * 1024, a = 0.04 + rnd() * 0.12, dark = rnd() < 0.6, w = 0.6 + rnd() * 2.4, ph = rnd() * 6, amp = 1 + rnd() * 5;
      g.strokeStyle = dark ? `rgba(24,14,8,${a})` : `rgba(150,104,64,${a * 0.8})`; g.lineWidth = w; g.beginPath();
      for (let x = 0; x <= 1024; x += 32) { const yy = y + Math.sin(x * 0.008 + ph) * amp; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < 6; i++) { const y = rnd() * 1024, h = 60 + rnd() * 120, gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, `rgba(${rnd() < 0.5 ? '255,220,170' : '10,5,2'},0.06)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, y, 1024, h); }
    return tex(c, 3);
  });
}
function feltTex() {
  return once('felt', () => {
    const c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#233640'; g.fillRect(0, 0, 512, 512);
    const id = g.getImageData(0, 0, 512, 512), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 26; d[i] += n * 0.8; d[i + 1] += n; d[i + 2] += n * 1.1; }
    g.putImageData(id, 0, 0);
    g.lineCap = 'round';
    for (let i = 0; i < 1500; i++) { const x = rnd() * 512, y = rnd() * 512, a = rnd() * TAU, l = 3 + rnd() * 9; g.strokeStyle = rnd() < 0.5 ? 'rgba(170,200,215,0.09)' : 'rgba(5,12,16,0.14)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
    return tex(c, 4);
  });
}

export function deskMesh() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.62, metalness: 0, envMapIntensity: 0.5 }));
  m.rotation.x = -Math.PI / 2; m.receiveShadow = true; return m;
}
export function feltMesh() {
  const hw = FELT_W / 2, hd = FELT_D / 2, r = 2.2, s = new THREE.Shape();
  s.moveTo(-hw + r, -hd); s.lineTo(hw - r, -hd); s.quadraticCurveTo(hw, -hd, hw, -hd + r); s.lineTo(hw, hd - r); s.quadraticCurveTo(hw, hd, hw - r, hd); s.lineTo(-hw + r, hd); s.quadraticCurveTo(-hw, hd, -hw, hd - r); s.lineTo(-hw, -hd + r); s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  const geo = new THREE.ExtrudeGeometry(s, { depth: FELT_Y - 0.25, bevelEnabled: true, bevelSize: 0.25, bevelThickness: 0.25, bevelSegments: 2, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  // uv in cm so the weave scale is the same everywhere
  const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / 14, pos.getZ(i) / 14);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: feltTex(), roughness: 1, metalness: 0, envMapIntensity: 0.15 }));
  m.receiveShadow = true; m.castShadow = true; return m;
}

// ---- the sheet of paper -----------------------------------------------------------------------------------------------------------------------------
export function paperMesh() {
  const g = new THREE.Group();
  const under = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.05, PH), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.95 }));
  under.position.y = FELT_Y + 0.025; under.receiveShadow = true; under.castShadow = true; g.add(under);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.88, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.32, envMapIntensity: 0.25 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat); top.rotation.x = -Math.PI / 2; top.position.y = PAPER_Y; top.receiveShadow = true; g.add(top);
  g.userData = { top, mat };
  return g;
}

// ---- props ----------------------------------------------------------------------------------------------------------------------------------------------
const M = (o) => new THREE.MeshStandardMaterial(o);
const shadowed = (o) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const roundRect = (w, d, r) => { const s = new THREE.Shape(), x = w / 2, y = d / 2; s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y); s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s; };

export function inkStone() {
  const g = new THREE.Group(), H = 2.2;
  const geo = new THREE.ExtrudeGeometry(roundRect(15, 10, 1.7), { depth: H - 0.5, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 3, curveSegments: 8 }); geo.rotateX(-Math.PI / 2);
  const slate = new THREE.MeshPhysicalMaterial({ color: 0x2a3433, roughness: 0.38, metalness: 0.05, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.9 });
  const body = new THREE.Mesh(geo, slate); body.position.y = 0.4; g.add(body);
  // raised rim round the well, then the well itself: a pool of ink with a glossy skin
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.28, 8, 40), slate); rim.rotation.x = Math.PI / 2; rim.scale.set(1.12, 1, 0.78); rim.position.set(1.3, H + 0.1, 0.1); g.add(rim);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.5, 40), new THREE.MeshPhysicalMaterial({ color: 0x050607, roughness: 0.07, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }));
  pool.rotation.x = -Math.PI / 2; pool.scale.set(1.12, 0.78, 1); pool.position.set(1.3, H + 0.04, 0.1); g.add(pool);
  // grinding slope: a slightly lighter, matt patch with a wet tide line
  const slope = new THREE.Mesh(new THREE.CircleGeometry(2.6, 28), M({ color: 0x1c2524, roughness: 0.75 })); slope.rotation.x = -Math.PI / 2; slope.scale.set(1.2, 0.85, 1); slope.position.set(-3.7, H + 0.03, 0.1); g.add(slope);
  // the ink stick lies across the stone, black with gold bands
  const stick = new THREE.Group();
  const sm = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, roughness: 0.2, clearcoat: 0.8, envMapIntensity: 1.2 });
  stick.add(new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.0, 9), sm));
  const gold = M({ color: 0xd6a648, roughness: 0.28, metalness: 0.9 });
  for (const z of [-3.2, -2.6, 2.9]) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.74, 1.04, 0.22), gold); b.position.z = z; stick.add(b); }
  stick.position.set(-1.6, H + 0.9, -3.4); stick.rotation.set(0.04, 0.55, 0.02); g.add(stick);
  return shadowed(g);
}

export function dropper() {      // celadon water dropper: a squat jar with a small spout and loop handle
  const g = new THREE.Group();
  const pts = [[0, 0], [1.9, 0], [2.7, 0.5], [3.2, 1.6], [3.1, 2.8], [2.3, 3.9], [1.2, 4.5], [0.95, 4.9], [1.1, 5.2], [0.8, 5.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x86b7a3, roughness: 0.22, clearcoat: 0.7, clearcoatRoughness: 0.15, envMapIntensity: 1.1 });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 32), mat));
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.62, 2.4, 14), mat); spout.position.set(3.0, 2.8, 0); spout.rotation.z = -0.95; g.add(spout);
  const h = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.28, 10, 24, Math.PI), mat); h.position.set(-2.7, 2.7, 0); h.rotation.z = Math.PI / 2; g.add(h);
  return shadowed(g);
}

export function sealBox() {       // round cinnabar seal-paste box, lid slightly lifted off
  const g = new THREE.Group();
  const red = new THREE.MeshPhysicalMaterial({ color: 0xa9301e, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.0, 1.7, 36), red); base.position.y = 0.85; g.add(base);
  const paste = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.1, 32), M({ color: 0xd2381f, roughness: 0.55 })); paste.position.y = 1.72; g.add(paste);
  const lid = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.9, 36), red); top.position.y = 0.45; lid.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 6, 36), M({ color: 0xd6a648, roughness: 0.3, metalness: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.92; lid.add(ring);
  lid.position.set(5.2, 0, 1.6); lid.rotation.z = 0.05; g.add(lid);
  return shadowed(g);
}

export function weight() {        // bronze paperweight bar (a squat half-round)
  const g = new THREE.Group();
  const m = M({ color: 0x8c6b38, roughness: 0.34, metalness: 0.88, envMapIntensity: 1.3 });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 19, 24), m); cyl.rotation.z = Math.PI / 2; cyl.position.y = 0.9; g.add(cyl);
  const cap = (x) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 12), m); s.position.set(x, 0.9, 0); g.add(s); };
  cap(-9.5); cap(9.5);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.2, 24), M({ color: 0xb98d45, roughness: 0.28, metalness: 0.95 })); band.rotation.z = Math.PI / 2; band.position.y = 0.9; g.add(band);
  return shadowed(g);
}

export function restBlocks() {    // a small bamboo brush rest: two low blocks
  const g = new THREE.Group(), m = M({ color: 0x9c7a3e, roughness: 0.5 });
  for (const z of [-1.6, 1.6]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.5, 14), m); b.position.set(0, 0.75, z); g.add(b); }
  return shadowed(g);
}

// The brush. Local +Y is the handle, the tip is at the origin. ~25 cm long.
export function brush() {
  const g = new THREE.Group(), hair = new THREE.Group();
  const hairMat = new THREE.MeshPhysicalMaterial({ color: 0x111215, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.45 });
  const prof = [[0, 0], [0.08, 0.2], [0.26, 0.75], [0.46, 1.5], [0.6, 2.3], [0.66, 3.1], [0.64, 3.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const hm = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), hairMat); hair.add(hm); g.add(hair);
  const ferr = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.68, 1.1, 18), M({ color: 0xc9a14a, roughness: 0.26, metalness: 0.95 })); ferr.position.y = 3.75; g.add(ferr);
  const bam = M({ color: 0xb3904a, roughness: 0.42, envMapIntensity: 0.6 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.55, 19.5, 16), bam); handle.position.y = 4.5 + 9.75; g.add(handle);
  for (const y of [8.4, 14.6, 20.2]) { const n = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 6, 16), M({ color: 0x8a6a2c, roughness: 0.5 })); n.rotation.x = Math.PI / 2; n.position.y = y; g.add(n); }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 10), M({ color: 0x2b1d12, roughness: 0.4 })); cap.position.y = 24.2; g.add(cap);
  g.userData = { hair, hairMat };
  return shadowed(g);
}

// The window: a lattice of thin bars between the sun and the desk. Its colour is not drawn (the camera never sees it); only its shadow is cast.
export function lattice() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const bar = (w, h, x, y) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.2), m); b.position.set(x, y, 0); b.castShadow = true; g.add(b); };
  const W = 84, Hh = 96;
  bar(W, 2.6, 0, Hh / 2); bar(W, 2.6, 0, -Hh / 2); bar(2.6, Hh, -W / 2, 0); bar(2.6, Hh, W / 2, 0);
  for (const x of [-21, 0, 21]) bar(1.0, Hh, x, 0);
  for (const y of [-24, 0, 24]) bar(W, 1.0, 0, y);
  return g;
}

export const LOOKS = {
  day: { sky: 0xdce8ff, ground: 0x4a3626, hemiI: 0.9, sun: 0xf2f5ff, sunI: 1.75, exp: 0.95, bg: 0x0d1214 },
};
