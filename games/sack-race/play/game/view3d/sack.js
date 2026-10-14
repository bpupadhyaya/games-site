// The sack: a cloth tube from the planted base up to the rolled rim at the waist. The shape is rebuilt every frame from the runner's
// pose: it follows the body axis at the rim and stands on the ground at the base, bulges forward where the knees push, flares and
// wrinkles when it is squashed on landing and goes taut in flight. Display only.
const TAU = Math.PI * 2;
const N_RING = 15, N_SEG = 22;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

// Cloth textures (one per style, shared): weave + the style's pattern + a stitched seam.
const texCache = new Map();
export function sackTexture(THREE, style) {
  const key = style.name;
  if (texCache.has(key)) return texCache.get(key);
  const c = globalThis.document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d'), W = 256, H = 256;
  g.fillStyle = style.base; g.fillRect(0, 0, W, H);
  const pat = style.pat;
  g.save();
  if (pat === 'stripe') { g.strokeStyle = style.ink; g.lineWidth = 15; for (let i = -4; i < 14; i++) { g.beginPath(); g.moveTo(i * 32, H); g.lineTo(i * 32 + 70, 0); g.stroke(); } }
  else if (pat === 'check') { g.fillStyle = style.ink; g.globalAlpha = 0.5; for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) if ((r + q) & 1) g.fillRect(q * 32, r * 32, 32, 32); g.globalAlpha = 1; }
  else if (pat === 'denim') { g.strokeStyle = style.shade; g.globalAlpha = 0.45; g.lineWidth = 1.2; for (let i = 0; i < 64; i++) { g.beginPath(); g.moveTo(0, i * 4); g.lineTo(W, i * 4 + 3); g.stroke(); } g.globalAlpha = 1; g.strokeStyle = '#f0d9a0'; g.setLineDash([7, 5]); g.lineWidth = 2; for (const x of [40, 216]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } g.setLineDash([]); }
  else if (pat === 'patch') {
    const cs = ['#d9534f', '#3f8fd0', '#f0c24b', '#5aa469', '#b36fc0'];
    for (let i = 0; i < 7; i++) { const x = ((i * 97) % 200) + 8, y = ((i * 61) % 190) + 10; g.fillStyle = cs[i % cs.length]; g.fillRect(x, y, 52, 40); g.strokeStyle = '#6b4a2a'; g.lineWidth = 2; g.setLineDash([6, 4]); g.strokeRect(x + 3, y + 3, 46, 34); g.setLineDash([]); }
  } else if (pat === 'gold') {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fff0a0'); gr.addColorStop(0.5, '#f6c640'); gr.addColorStop(1, '#c8921d'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = style.ink; g.globalAlpha = 0.6;
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const x = q * 64 + 32, y = r * 64 + 32; g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x + 12, y); g.lineTo(x, y + 16); g.lineTo(x - 12, y); g.closePath(); g.fill(); }
    g.globalAlpha = 1;
  } else { // burlap: darker fibres and a stencilled mark
    g.fillStyle = style.shade; g.globalAlpha = 0.22; for (let i = 0; i < 18; i++) g.fillRect(0, (i * 53) % H, W, 5 + (i % 3) * 3); g.globalAlpha = 1;
    g.fillStyle = style.ink; g.globalAlpha = 0.55; g.font = '800 38px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('GRAIN', 128, 150); g.font = '700 16px system-ui, sans-serif'; g.fillText('25 KG', 128, 176); g.globalAlpha = 1;
  }
  g.restore();
  // weave: fine crossed threads
  g.globalAlpha = 0.16; g.strokeStyle = '#000';
  for (let i = 0; i < W; i += 3) { g.lineWidth = 1; g.beginPath(); g.moveTo(i, 0); g.lineTo(i, H); g.stroke(); }
  g.strokeStyle = '#fff'; g.globalAlpha = 0.1;
  for (let i = 1; i < H; i += 3) { g.beginPath(); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); }
  g.globalAlpha = 1;
  // seam
  g.strokeStyle = style.shade; g.lineWidth = 3; g.setLineDash([9, 5]); g.beginPath(); g.moveTo(2, 0); g.lineTo(2, H); g.stroke(); g.setLineDash([]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

let weaveBump = null;
function weave(THREE) {
  if (weaveBump) return weaveBump;
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) for (let x = 0; x < 128; x += 4) { g.fillStyle = ((x + y) / 4) & 1 ? '#a0a0a0' : '#5a5a5a'; g.fillRect(x, y, 4, 4); }
  weaveBump = new THREE.CanvasTexture(c); weaveBump.wrapS = weaveBump.wrapT = THREE.RepeatWrapping; weaveBump.repeat.set(3, 6);
  return weaveBump;
}

export function createSack(THREE, style) {
  const nV = N_RING * N_SEG + 1;
  const pos = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), idx = [];
  for (let i = 0; i < N_RING; i++) for (let j = 0; j < N_SEG; j++) uv.set([(j / N_SEG) * 3, (i / (N_RING - 1)) * 2.4], (i * N_SEG + j) * 2);
  uv.set([0.5, 0], (nV - 1) * 2);
  for (let i = 0; i < N_RING - 1; i++) for (let j = 0; j < N_SEG; j++) {
    const a = i * N_SEG + j, b = i * N_SEG + ((j + 1) % N_SEG), c = (i + 1) * N_SEG + j, d = (i + 1) * N_SEG + ((j + 1) % N_SEG);
    idx.push(a, c, b, b, c, d);
  }
  for (let j = 0; j < N_SEG; j++) idx.push(nV - 1, j, (j + 1) % N_SEG);   // the base
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ map: sackTexture(THREE, style), bumpMap: weave(THREE), bumpScale: 1.6, roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = true; mesh.receiveShadow = true;
  const rimMat = new THREE.MeshStandardMaterial({ color: style.shade, roughness: 0.95, map: sackTexture(THREE, style) });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 28), rimMat); rim.castShadow = true; rim.frustumCulled = false;
  const group = new THREE.Group(); group.add(mesh, rim);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const P0 = V(), P1 = V(), P2 = V(), P3 = V(), C = V(), Tn = V(), S = V(), F = V(), tmp = V(), basis = new THREE.Matrix4();
  const out = { rim: V(), rimF: V(), rimS: V(), knee: V() };

  /**
   * p: { B, T, up (body axis at the rim, unit), side (lateral unit), kneeFlex 0..1, squash 0..1, flare 0..1, taut 0..1, phase, rl, rf, size }
   */
  function update(p) {
    const B = p.B, T = p.T, size = p.size || 1;
    P0.copy(B); P3.copy(T);
    const len = Math.max(0.25, B.distanceTo(T));
    // nearly the straight line from base to rim (the legs inside are straight), with a little ground-standing and body-following at the ends
    P1.copy(B); P1.y += len * (0.32 + 0.1 * p.taut);
    P2.copy(T).addScaledVector(p.up, -len * 0.36);
    tmp.copy(T).sub(B).multiplyScalar(1 / 3);
    P1.lerp(tmp.clone().add(B), 0.8); P2.lerp(T.clone().sub(tmp), 0.8);
    S.copy(p.side).normalize();
    const rl0 = (p.rl || 0.215) * size, rf0 = (p.rf || 0.2) * size;
    for (let i = 0; i < N_RING; i++) {
      const u = i / (N_RING - 1), w = 1 - u;
      // cubic bezier point and tangent
      const b0 = w * w * w, b1 = 3 * w * w * u, b2 = 3 * w * u * u, b3 = u * u * u;
      C.set(0, 0, 0).addScaledVector(P0, b0).addScaledVector(P1, b1).addScaledVector(P2, b2).addScaledVector(P3, b3);
      Tn.set(0, 0, 0).addScaledVector(P0, -3 * w * w).addScaledVector(P1, 3 * w * w - 6 * w * u).addScaledVector(P2, 6 * w * u - 3 * u * u).addScaledVector(P3, 3 * u * u);
      if (Tn.lengthSq() < 1e-8) Tn.copy(p.up); Tn.normalize();
      F.crossVectors(Tn, S).normalize();
      // profile
      const knee = Math.exp(-Math.pow((u - 0.5) / 0.2, 2));
      const flare = p.flare * Math.exp(-u / 0.14), wr = 0.025 + 0.06 * p.squash;
      const rl = rl0 * (1 + 0.1 * flare + 0.07 * knee * p.squash + 0.045 * u) * (1 + 0.1 * (1 - p.taut) * u * (1 - u) * 3);
      const rf = rf0 * (1 + 0.05 * flare + 0.22 * knee * p.kneeFlex + 0.05 * p.squash * knee);
      C.addScaledVector(F, (0.06 * knee * p.kneeFlex - 0.035 * u) * size);
      for (let j = 0; j < N_SEG; j++) {
        const a = (j / N_SEG) * TAU, ca = Math.cos(a), sa = Math.sin(a);
        // bag bottom is squarer than the body
        const sq = 1 - u > 0.9 ? 0.62 : 1, cx = Math.sign(ca) * Math.pow(Math.abs(ca), sq), cz = Math.sign(sa) * Math.pow(Math.abs(sa), sq);
        const rad = 1 + wr * Math.sin(a * 5 + u * 17 + p.phase * 0.0) * (0.4 + 0.6 * (1 - u)) + wr * 0.5 * Math.sin(a * 3 - u * 9);
        tmp.copy(C).addScaledVector(S, rl * cx * rad).addScaledVector(F, rf * cz * rad);
        pos.set([tmp.x, tmp.y, tmp.z], (i * N_SEG + j) * 3);
        if (i === 0 && j === 0) out.base = true;
      }
    }
    // base centre
    pos.set([B.x, B.y, B.z], (nV - 1) * 3);
    // the first ring sits on the ground plane: nothing under B.y - 0.0
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    // the rolled rim: a flattened torus on the last ring
    F.crossVectors(p.up, S).normalize();
    basis.makeBasis(S, F, p.up).setPosition(T.x, T.y - 0.01, T.z);
    rim.matrix.copy(basis); rim.matrixAutoUpdate = false;
    rim.matrix.scale(V(rl0 * 1.02, rf0 * 1.04, 0.62 * size * 0.4));
    rim.matrixWorldNeedsUpdate = true;
    // grip points on the rim (where the two hands hold it)
    out.rimL = out.rimL || V(); out.rimR = out.rimR || V();
    out.rimL.copy(T).addScaledVector(S, rl0 * 1.0).addScaledVector(F, 0.0); out.rimR.copy(T).addScaledVector(S, -rl0 * 1.0);
    return out;
  }
  return { group, mesh, update, out, setStyle(st) { mat.map = sackTexture(THREE, st); rimMat.map = mat.map; rimMat.color.set(st.shade); mat.needsUpdate = true; rimMat.needsUpdate = true; } };
}
