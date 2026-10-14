// The kurash kit on top of the athlete body, tailored from the athlete's own skinned surface so it bends with the person:
//  - a jacket with an open V neck, a crossing front flap, a standing collar, wide sleeves ending at a cuff, a flared hem, trim bands, baked fold
//    shading and a fine weave normal map;
//  - a double-wrapped sash with a knot and two tails;
//  - loose trousers cropped at the ankle and soft dark wrestling shoes.
// Everything is a SkinnedMesh bound to the athlete's skeleton (no stacked tubes). Presentation only.
// Bind pose (athlete_m): A-pose, +Y up, the body faces +Z, the avatar's left is +X.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// small deterministic value noise (3D) for the folds
function hash3(x, y, z) { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w) * 2 - 1;
}

function weaveNormalMap(THREE) {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const tx = (x % 16) / 16, ty = (y % 16) / 16, cell = (Math.floor(x / 16) + Math.floor(y / 16)) & 1;
    h[y * S + x] = (cell ? Math.sin(Math.PI * tx) : Math.sin(Math.PI * ty)) * 0.5 + (hash3(x, y, 3) - 0.5) * 0.18;
  }
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h[y * S + ((x + 1) % S)] - h[y * S + ((x + S - 1) % S)], dy = h[((y + 1) % S) * S + x] - h[((y + S - 1) % S) * S + x];
    const n = [-dx * 2.2, -dy * 2.2, 1], l = Math.hypot(n[0], n[1], n[2]), i = (y * S + x) * 4;
    img.data[i] = Math.round((n[0] / l * 0.5 + 0.5) * 255); img.data[i + 1] = Math.round((n[1] / l * 0.5 + 0.5) * 255); img.data[i + 2] = Math.round((n[2] / l * 0.5 + 0.5) * 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}
let WEAVE = null;

export function dress(human, THREE, look, quality = 'high') {
  const SUB = quality === 'high' ? 2 : 1;
  if (!WEAVE) WEAVE = weaveNormalMap(THREE);
  const meshes = [];
  const B = (n) => human.bones[`Bip01_${n}`];

  // ---------- source surface -------------------------------------------------------------------------------------------------
  const src = (() => { let best = null; human.model.traverse((o) => { if (o.isSkinnedMesh && (Array.isArray(o.material) ? o.material[0] : o.material).name === 'body' && (!best || o.geometry.attributes.position.count > best.geometry.attributes.position.count)) best = o; }); return best; })();
  const sg = src.geometry, spos = sg.attributes.position, ssi = sg.attributes.skinIndex, ssw = sg.attributes.skinWeight;
  const bnames = src.skeleton.bones.map((b) => b.name.replace('Bip01_', ''));
  const BP = {};
  src.skeleton.bones.forEach((b, i) => { const m = src.skeleton.boneInverses[i].clone().invert(); BP[bnames[i]] = new THREE.Vector3().setFromMatrixPosition(m); });
  const dom = new Array(spos.count);
  for (let i = 0; i < spos.count; i++) { let bj = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = ssw.getComponent(i, k); if (w > bw) { bw = w; bj = ssi.getComponent(i, k); } } dom[i] = bnames[bj]; }
  const srcIdx = sg.index.array;

  // ---------- generic tailor: select, subdivide, cut, smooth, inflate, fold, skin ------------------------------------------
  function tailor(spec) {
    const vmap = new Map(); const P = [], D = [], SK = [];
    const vid = (i) => {
      let v = vmap.get(i); if (v !== undefined) return v;
      v = P.length; vmap.set(i, v);
      P.push([spos.getX(i), spos.getY(i), spos.getZ(i)]); D.push(dom[i]);
      const s = {}; for (let k = 0; k < 4; k++) { const w = ssw.getComponent(i, k); if (w > 0) s[ssi.getComponent(i, k)] = w; }
      SK.push(s); return v;
    };
    const inc = new Map();
    const inside = (i) => { let r = inc.get(i); if (r === undefined) { r = spec.test(dom[i], [spos.getX(i), spos.getY(i), spos.getZ(i)]); inc.set(i, r); } return r; };
    let T = [];
    for (let t = 0; t < srcIdx.length; t += 3) { const a = srcIdx[t], b = srcIdx[t + 1], c = srcIdx[t + 2]; if (inside(a) && inside(b) && inside(c)) T.push(vid(a), vid(b), vid(c)); }
    // weld duplicate positions (uv seams)
    const keyOf = (p) => `${Math.round(p[0] * 2e4)},${Math.round(p[1] * 2e4)},${Math.round(p[2] * 2e4)}`;
    const wmap = new Map(), remap = new Array(P.length);
    P.forEach((p, i) => { const k = keyOf(p); let w = wmap.get(k); if (w === undefined) { w = i; wmap.set(k, i); } remap[i] = w; });
    T = T.map((v) => remap[v]);
    const dom4 = (s) => { let bj = 0, bw = -1; for (const [bi, w] of Object.entries(s)) if (w > bw) { bw = w; bj = +bi; } return bnames[bj]; };
    const mid = (a, b, cache) => {
      const k = a < b ? a * 1e7 + b : b * 1e7 + a; let m = cache.get(k); if (m !== undefined) return m;
      m = P.length; cache.set(k, m);
      const pa = P[a], pb = P[b]; P.push([(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2]);
      const s = {}; for (const [bi, w] of Object.entries(SK[a])) s[bi] = (s[bi] || 0) + w / 2; for (const [bi, w] of Object.entries(SK[b])) s[bi] = (s[bi] || 0) + w / 2;
      SK.push(s); D.push(dom4(s)); return m;
    };
    for (let it = 0; it < SUB; it++) {
      const cache = new Map(), N2 = [];
      for (let t = 0; t < T.length; t += 3) {
        const a = T[t], b = T[t + 1], c = T[t + 2], ab = mid(a, b, cache), bc = mid(b, c, cache), ca = mid(c, a, cache);
        N2.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
      }
      T = N2;
    }
    const used = new Map(), Pn = [], Dn = [], Sn = [];
    const T2 = T.map((v) => { let u = used.get(v); if (u === undefined) { u = Pn.length; used.set(v, u); Pn.push(P[v].slice()); Dn.push(D[v]); Sn.push(SK[v]); } return u; });
    const nV = Pn.length;
    // light Laplacian smoothing (the source is 2.5 cm facets), before the cuts so boundaries stay straight
    {
      const adj = Array.from({ length: nV }, () => new Set());
      for (let t = 0; t < T2.length; t += 3) { const a = T2[t], b = T2[t + 1], c = T2[t + 2]; adj[a].add(b); adj[a].add(c); adj[b].add(a); adj[b].add(c); adj[c].add(a); adj[c].add(b); }
      for (let it = 0; it < 2; it++) {
        const Q = Pn.map((p) => p.slice());
        for (let i = 0; i < nV; i++) {
          if (adj[i].size < 3) continue;
          let x = 0, y = 0, z = 0; for (const j of adj[i]) { x += Pn[j][0]; y += Pn[j][1]; z += Pn[j][2]; }
          const k = adj[i].size; Q[i][0] = Pn[i][0] * 0.5 + (x / k) * 0.5; Q[i][1] = Pn[i][1] * 0.5 + (y / k) * 0.5; Q[i][2] = Pn[i][2] * 0.5 + (z / k) * 0.5;
        }
        for (let i = 0; i < nV; i++) Pn[i] = Q[i];
      }
    }
    const P0 = Pn.map((p) => p.slice());
    // vertex normals of the uncut surface (so the cut edge keeps smooth, outward normals); orientation checked against the body axis
    const n = new Float32Array(nV * 3);
    for (let t = 0; t < T2.length; t += 3) {
      const a = T2[t], b = T2[t + 1], c = T2[t + 2];
      const ux = Pn[b][0] - Pn[a][0], uy = Pn[b][1] - Pn[a][1], uz = Pn[b][2] - Pn[a][2], vx = Pn[c][0] - Pn[a][0], vy = Pn[c][1] - Pn[a][1], vz = Pn[c][2] - Pn[a][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { n[v * 3] += nx; n[v * 3 + 1] += ny; n[v * 3 + 2] += nz; }
    }
    let sgn = 0;
    for (let i = 0; i < nV; i++) { const l = Math.hypot(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]) || 1; n[i * 3] /= l; n[i * 3 + 1] /= l; n[i * 3 + 2] /= l; sgn += n[i * 3] * Pn[i][0] + n[i * 3 + 2] * (Pn[i][2] + 0.02); }
    if (sgn < 0) for (let i = 0; i < n.length; i++) n[i] *= -1;
    // cuts: project onto the cut plane; drop triangles that lie wholly beyond it
    const gone = new Uint8Array(nV);
    if (spec.cut) for (let i = 0; i < nV; i++) { const c = spec.cut(Pn[i], Dn[i]); if (c && c.s > 0) { gone[i] = 1; Pn[i] = c.proj; } }
    const keep = [];
    for (let t = 0; t < T2.length; t += 3) if (!(gone[T2[t]] && gone[T2[t + 1]] && gone[T2[t + 2]])) keep.push(T2[t], T2[t + 1], T2[t + 2]);
    const F = new Float32Array(nV * 3), COL = new Float32Array(nV * 3), TRIM = new Float32Array(nV), SKI = new Uint16Array(nV * 4), SKW = new Float32Array(nV * 4);
    for (let i = 0; i < nV; i++) {
      const p = Pn[i], d = Dn[i];
      const off = spec.inflate(p, d) + (spec.fold ? spec.fold(p, d) : 0);
      const f = spec.fold ? spec.fold(p, d) : 0;
      F[i * 3] = p[0] + n[i * 3] * off; F[i * 3 + 1] = p[1] + n[i * 3 + 1] * off; F[i * 3 + 2] = p[2] + n[i * 3 + 2] * off;
      const ao = spec.ao ? spec.ao(p, d) : 1;
      const sh = clamp(ao * (1 + clamp(f / 0.007, -1, 1) * 0.2), 0.4, 1.15);
      COL[i * 3] = COL[i * 3 + 1] = COL[i * 3 + 2] = sh;
      TRIM[i] = spec.trim ? spec.trim(p, d) : 1;
      const ent = Object.entries(Sn[i]).sort((a, b) => b[1] - a[1]).slice(0, 4); let sum = 0; for (const e of ent) sum += e[1];
      ent.forEach(([bi, w], k) => { SKI[i * 4 + k] = +bi; SKW[i * 4 + k] = w / sum; });
    }
    const UV = new Float32Array(nV * 2);
    for (let i = 0; i < nV; i++) {
      const p = P0[i], nx = Math.abs(n[i * 3]), ny = Math.abs(n[i * 3 + 1]), nz = Math.abs(n[i * 3 + 2]), k = 40;
      if (nz >= nx && nz >= ny) { UV[i * 2] = p[0] * k; UV[i * 2 + 1] = p[1] * k; } else if (nx >= ny) { UV[i * 2] = p[2] * k; UV[i * 2 + 1] = p[1] * k; } else { UV[i * 2] = p[0] * k; UV[i * 2 + 1] = p[2] * k; }
    }
    return { pos: F, col: COL, trim: TRIM, ski: SKI, skw: SKW, uv: UV, index: keep, n: nV };
  }

  // ---------- materials ------------------------------------------------------------------------------------------------------
  const trimU = { value: new THREE.Color(look.kit2) };
  function clothMaterial(color, { trim = false, rough = 0.86, sheen = 0.9 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
    m.normalMap = WEAVE; m.normalScale.set(0.3, 0.3);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTrim = trimU;
      sh.vertexShader = (trim ? 'attribute float aTrim; varying float vTrim;\n' : '') + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + (trim ? '\n vTrim = aTrim;' : ''));
      let fs = (trim ? 'uniform vec3 uTrim; varying float vTrim;\n' : '') + sh.fragmentShader;
      if (trim) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
          float tb = smoothstep(0.0035, -0.0035, vTrim);
          diffuseColor.rgb = mix(diffuseColor.rgb, uTrim * vColor.rgb, tb);
          float st = smoothstep(0.0022, 0.0, abs(vTrim + 0.0075));
          diffuseColor.rgb *= 1.0 - 0.3 * st;`);
      // a cloth sheen: a soft lift of the diffuse colour at grazing angles
      fs = fs.replace('#include <opaque_fragment>', `float shFr = pow(1.0 - clamp(abs(dot(normalize(vViewPosition), normal)), 0.0, 1.0), 3.0);
          outgoingLight += diffuseColor.rgb * shFr * ${(sheen * 0.45).toFixed(2)} + vec3(shFr * ${(sheen * 0.06).toFixed(2)});
          #include <opaque_fragment>`);
      sh.fragmentShader = fs;
    };
    m.customProgramCacheKey = () => `kurash-cloth-${trim ? 1 : 0}-${sheen}`;
    return m;
  }
  const mats = {
    kit: clothMaterial(look.kit, { trim: true }),
    kit2: clothMaterial(look.kit2),
    belt: clothMaterial(look.belt, { rough: 0.7, sheen: 0.5 }),
    trousers: clothMaterial(look.trousers || '#ece5d3', { rough: 0.9 }),
    shoe: clothMaterial('#16171d', { rough: 0.55, sheen: 0.2 }),
  };
  mats.belt.normalScale.set(0.3, 0.3);
  function makeMesh(g, mat, { trimAttr = false } = {}) {
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(g.pos, 3));
    bg.setAttribute('color', new THREE.BufferAttribute(g.col, 3));
    bg.setAttribute('uv', new THREE.BufferAttribute(g.uv, 2));
    bg.setAttribute('skinIndex', new THREE.BufferAttribute(g.ski, 4));
    bg.setAttribute('skinWeight', new THREE.BufferAttribute(g.skw, 4));
    if (trimAttr) bg.setAttribute('aTrim', new THREE.BufferAttribute(g.trim, 1));
    bg.setIndex(g.index);
    bg.computeVertexNormals();
    // welded normals so index/uv seams stay smooth
    const nrm = bg.attributes.normal, key = new Map();
    for (let i = 0; i < g.n; i++) { const k = `${Math.round(g.pos[i * 3] * 4e3)},${Math.round(g.pos[i * 3 + 1] * 4e3)},${Math.round(g.pos[i * 3 + 2] * 4e3)}`; let a = key.get(k); if (!a) { a = [0, 0, 0, []]; key.set(k, a); } a[0] += nrm.getX(i); a[1] += nrm.getY(i); a[2] += nrm.getZ(i); a[3].push(i); }
    for (const a of key.values()) { const l = Math.hypot(a[0], a[1], a[2]) || 1; for (const i of a[3]) nrm.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
    const m = new THREE.SkinnedMesh(bg, mat);
    m.bind(src.skeleton, src.bindMatrix);
    m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    src.parent.add(m); meshes.push({ bone: src.parent, mesh: m });
    return m;
  }

  // ---------- jacket ---------------------------------------------------------------------------------------------------------
  const HEM = 0.83, COLLAR = 1.49, BELT_Y = 1.0, V0 = 1.27, VK = 0.34;
  const armGeo = {};
  for (const s of ['L', 'R']) {
    const ua = BP[`${s}_UpperArm`], fo = BP[`${s}_Forearm`], ha = BP[`${s}_Hand`];
    const a1 = fo.clone().sub(ua), a2 = ha.clone().sub(fo);
    armGeo[s] = { ua, fo, ha, l1: a1.length(), l2: a2.length(), d1: a1.clone().normalize(), d2: a2.clone().normalize() };
  }
  const _v = new THREE.Vector3();
  function armCoord(p, side) {
    const g = armGeo[side];
    _v.set(p[0], p[1], p[2]);
    const t2 = _v.clone().sub(g.fo).dot(g.d2), t1 = _v.clone().sub(g.ua).dot(g.d1);
    const s = t2 > 0 ? g.l1 + t2 : t1, ax = t2 > 0 ? g.d2 : g.d1, o = t2 > 0 ? g.fo : g.ua;
    const rad = _v.clone().sub(o); rad.addScaledVector(ax, -rad.dot(ax));
    return { s, r: Math.atan2(rad.x * (side === 'L' ? 1 : -1), rad.z), t2 };
  }
  const isArmDom = (d) => /^(L|R)_(Clavicle|UpperArm|Forearm)$/.test(d);
  const jacket = tailor({
    test: (d, p) => /^(Pelvis|Spine|Spine1|Spine2|Neck)$/.test(d) || isArmDom(d) || /_Hand$/.test(d) || (/_Thigh$/.test(d) && p[1] > 0.74),
    cut: (p, d) => {
      if (/_Hand$/.test(d)) return { s: 1, proj: p };
      if (/^(L|R)_Forearm$/.test(d)) {
        const g = armGeo[d[0]]; _v.set(p[0], p[1], p[2]);
        const cutT = g.l2 * 0.84, t = _v.clone().sub(g.fo).dot(g.d2);
        if (t > cutT) { const pr = _v.clone().addScaledVector(g.d2, -(t - cutT)); return { s: t - cutT, proj: [pr.x, pr.y, pr.z] }; }
      }
      if (p[1] < HEM && !isArmDom(d)) return { s: HEM - p[1], proj: [p[0], HEM, p[2]] };
      if (p[1] > COLLAR) return { s: p[1] - COLLAR, proj: [p[0], COLLAR, p[2]] };
      if (p[2] > 0.0 && p[1] > V0 && Math.abs(p[0]) < 0.16 && !isArmDom(d)) {
        const w = (p[1] - V0) * VK;
        if (Math.abs(p[0]) < w) return { s: w - Math.abs(p[0]), proj: [(p[0] < 0 ? -1 : 1) * w, p[1], p[2]] };
      }
      return null;
    },
    inflate: (p, d) => {
      const y = p[1];
      let k = isArmDom(d) ? 0.022 : 0.03;
      if (!isArmDom(d)) k += 0.03 * sstep(0.94, 0.84, y);
      if (/^(L|R)_(UpperArm|Forearm)$/.test(d)) { const c = armCoord(p, d[0]); k += 0.012 * sstep(0.1, 0.45, c.s) + 0.004 * sstep(0.3, 0.55, c.s); }
      if (y > 1.43 && !isArmDom(d)) k += 0.006 * sstep(1.43, 1.49, y);
      return k;
    },
    fold: (p, d) => {
      const x = p[0], y = p[1], z = p[2];
      let f = 0.0022 * noise3(x * 11, y * 11, z * 11) + 0.0012 * noise3(x * 27, y * 27, z * 27);
      if (isArmDom(d)) {
        const side = d[0], c = armCoord(p, side), g = armGeo[side];
        const elbow = Math.exp(-Math.pow((c.s - g.l1) / 0.06, 2));
        const wrist = sstep(g.l1 + g.l2 * 0.35, g.l1 + g.l2 * 0.84, c.s);
        const phase = 2 * Math.PI * c.s / (0.045 - 0.018 * wrist) + 1.7 * Math.sin(c.r + 0.7) + 2 * noise3(x * 6, y * 6, z * 6);
        const cw = 0.25 + 0.75 * Math.pow(Math.max(0, Math.cos(c.r - 0.2)), 1.3);
        f += (0.0035 + 0.0075 * elbow + 0.0065 * wrist) * Math.sin(phase) * cw;
        const sh = Math.exp(-Math.pow((c.s - 0.05) / 0.07, 2));
        f += 0.004 * sh * Math.sin(y * 130 + x * 40);
      } else {
        const th = Math.atan2(x, z + 0.02);
        const gather = Math.exp(-Math.pow((y - BELT_Y) / 0.075, 2));
        f += 0.0058 * gather * Math.sin(2 * Math.PI * (y - BELT_Y) / 0.05 + 2.4 * noise3(x * 7, y * 7, z * 7));
        const skirt = sstep(0.96, 0.84, y);
        f += 0.005 * skirt * Math.sin(th * 11 + 2.0 * noise3(x * 5, y * 4, z * 5)) * (0.5 + 0.5 * sstep(0.92, 0.8, y));
        f += 0.0035 * Math.sin(x * 22 + y * 31) * sstep(1.05, 1.3, y) * sstep(1.45, 1.3, y);
      }
      return f;
    },
    ao: (p, d) => {
      let a = 1;
      if (p[1] < 0.95 && !isArmDom(d)) a *= 0.86 + 0.14 * sstep(0.79, 0.95, p[1]);
      if (isArmDom(d)) { const c = armCoord(p, d[0]); a *= 0.9 + 0.1 * Math.cos(c.r - 0.3); if (Math.abs(p[0]) < 0.3 && p[1] < 1.4 && p[1] > 1.15) a *= 0.82; }
      return a;
    },
    trim: (p, d) => {
      let t = 1;
      const yy = p[1];
      if (!isArmDom(d) && p[2] > -0.02) {
        if (yy > V0 - 0.02 && yy < COLLAR + 0.01) { const ex = Math.abs(p[0]), w = Math.max(0, (yy - V0) * VK); t = Math.min(t, ex - w - 0.036); }
        if (yy < 1.26 && yy > 0.99) { const u = (1.24 - yy) / 0.25; t = Math.min(t, Math.abs(p[0] + 0.015 + u * 0.15) - 0.02); }   // crossing flap toward the avatar's right
      }
      if (!isArmDom(d)) t = Math.min(t, (yy - HEM) - 0.03);
      if (!isArmDom(d)) t = Math.min(t, (COLLAR - yy) - 0.026);
      if (/^(L|R)_Forearm$/.test(d)) { const g = armGeo[d[0]]; _v.set(p[0], p[1], p[2]); const tt = _v.clone().sub(g.fo).dot(g.d2); t = Math.min(t, (g.l2 * 0.84 - tt) - 0.04); }
      return t;
    },
  });
  makeMesh(jacket, mats.kit, { trimAttr: true });

  // ---------- trousers + shoes -----------------------------------------------------------------------------------------------
  const legCut = {};
  for (const s of ['L', 'R']) { const ca = BP[`${s}_Calf`], fo = BP[`${s}_Foot`]; const dv = fo.clone().sub(ca); legCut[s] = { ca, fo, l: dv.length(), d: dv.normalize() }; }
  const trousers = tailor({
    test: (d, p) => d === 'Pelvis' || /_(Thigh|Calf)$/.test(d) || (/_Foot$/.test(d) && p[1] > 0.1),
    cut: (p, d) => {
      const s = d[0];
      if (/^(L|R)_(Calf|Foot)$/.test(d)) {
        const g = legCut[s]; _v.set(p[0], p[1], p[2]);
        const t = _v.clone().sub(g.ca).dot(g.d), cutT = g.l * 0.9;
        if (t > cutT) { const pr = _v.clone().addScaledVector(g.d, -(t - cutT)); return { s: t - cutT, proj: [pr.x, pr.y, pr.z] }; }
      }
      return null;
    },
    inflate: (p, d) => {
      let k = 0.018;
      if (/_(Calf|Foot)$/.test(d)) { const g = legCut[d[0]]; _v.set(p[0], p[1], p[2]); const t = _v.clone().sub(g.ca).dot(g.d) / g.l; k += 0.018 * sstep(0.2, 0.9, t) + 0.012; }
      if (/_Thigh$/.test(d)) k += 0.012;
      if (p[1] > 0.86) k = Math.max(0.006, k - 0.012 * sstep(0.86, 0.95, p[1]));
      return k;
    },
    fold: (p) => {
      const x = p[0], y = p[1], z = p[2];
      let f = 0.0025 * noise3(x * 9, y * 9, z * 9);
      const th = Math.atan2(x - (x > 0 ? 0.1 : -0.1), z);
      f += 0.0042 * Math.sin(th * 5 + 2.5 * noise3(x * 5, y * 3, z * 5)) * sstep(0.2, 0.5, y) * sstep(0.95, 0.75, y);
      f += 0.0055 * Math.exp(-Math.pow((y - 0.5) / 0.07, 2)) * Math.sin(2 * Math.PI * y / 0.04 + 3 * noise3(x * 6, y * 6, z * 6)) * (z > 0 ? 1 : 0.4);
      f += 0.005 * sstep(0.32, 0.14, y) * Math.sin(2 * Math.PI * y / 0.035 + 2 * noise3(x * 8, y * 8, z * 8));
      return f;
    },
    ao: (p) => 0.9 + 0.1 * sstep(0.1, 0.5, p[1]),
  });
  makeMesh(trousers, mats.trousers);
  const shoes = tailor({
    test: (d) => /_(Foot|Toe0)$/.test(d),
    cut: (p) => { const top = 0.118; return p[1] > top ? { s: p[1] - top, proj: [p[0], top, p[2]] } : null; },
    inflate: (p) => 0.0045 + 0.004 * sstep(0.05, 0.0, p[1]),
    ao: (p) => (p[1] < 0.022 ? 1.9 : 0.85 + 0.2 * sstep(0.02, 0.1, p[1])),
  });
  makeMesh(shoes, mats.shoe);

  // ---------- sash -----------------------------------------------------------------------------------------------------------
  const cen = { x: 0, z: -0.01 };
  const NB = 72, rad = new Float32Array(NB);
  for (let i = 0; i < jacket.n; i++) {
    const y = jacket.pos[i * 3 + 1]; if (y < BELT_Y - 0.065 || y > BELT_Y + 0.05) continue;
    const x = jacket.pos[i * 3] - cen.x, z = jacket.pos[i * 3 + 2] - cen.z;
    if (Math.abs(x) > 0.3) continue;
    const a = Math.atan2(x, z), bi = ((Math.round(a / TAU * NB) % NB) + NB) % NB, r = Math.hypot(x, z);
    if (r > rad[bi]) rad[bi] = r;
  }
  for (let k = 0; k < NB; k++) if (!rad[k]) rad[k] = rad[(k + 1) % NB] || rad[(k + NB - 1) % NB] || 0.17;
  for (let it = 0; it < 3; it++) for (let k = 0; k < NB; k++) rad[k] = (rad[(k + NB - 1) % NB] + rad[k] * 2 + rad[(k + 1) % NB]) / 4;
  const radAt = (a) => { const t = (((a / TAU) % 1) + 1) % 1 * NB, i = Math.floor(t), f = t - i; return rad[i % NB] * (1 - f) + rad[(i + 1) % NB] * f; };
  const nearIdx = [];
  for (let i = 0; i < spos.count; i++) if (/^(Pelvis|Spine|Spine1|Spine2|L_Thigh|R_Thigh)$/.test(dom[i])) nearIdx.push(i);
  const near = (x, y, z) => {
    let bi = nearIdx[0], bd = 1e9;
    for (const i of nearIdx) { const dx = spos.getX(i) - x, dy = spos.getY(i) - y, dz = spos.getZ(i) - z, dd = dx * dx + dy * dy + dz * dz; if (dd < bd) { bd = dd; bi = i; } }
    return bi;
  };
  function piece(nu, nv, fn) {
    const pos = new Float32Array(nu * nv * 3), ski = new Uint16Array(nu * nv * 4), skw = new Float32Array(nu * nv * 4), col = new Float32Array(nu * nv * 3).fill(1), uv = new Float32Array(nu * nv * 2);
    const idx = [];
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const o = j * nu + i, p = fn(i / (nu - 1), j / (nv - 1));
      pos[o * 3] = p[0]; pos[o * 3 + 1] = p[1]; pos[o * 3 + 2] = p[2];
      const s = near(p[0], p[1], p[2]);
      for (let k = 0; k < 4; k++) { ski[o * 4 + k] = ssi.getComponent(s, k); skw[o * 4 + k] = ssw.getComponent(s, k); }
      uv[o * 2] = i / (nu - 1) * 36; uv[o * 2 + 1] = j / (nv - 1) * 4;
      if (p[3] !== undefined) col[o * 3] = col[o * 3 + 1] = col[o * 3 + 2] = p[3];
    }
    for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = j * nu + i, b = a + 1, c = a + nu, dd = c + 1; idx.push(a, c, b, b, c, dd); }
    return { pos, col, uv, ski, skw, index: idx, n: nu * nv, trim: new Float32Array(nu * nv).fill(1) };
  }
  const WID = 0.062, TH = 0.01;
  function ring(yc, over, tilt) {
    return piece(121, 9, (u, v) => {
      const a = u * TAU, w = (v - 0.5) * 2;
      const prof = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(w), 4)), 0.5);
      const r = radAt(a) + over + TH * 0.5 * prof + 0.004;
      const y = yc + w * WID * 0.5 + tilt * Math.cos(a) + 0.0018 * Math.sin(a * 5 + v * 3);
      return [cen.x + r * Math.sin(a), y, cen.z + r * Math.cos(a), 0.78 + 0.22 * prof + 0.04 * Math.sin(a * 9)];
    });
  }
  for (const g of [ring(BELT_Y - 0.02, 0.0, -0.012), ring(BELT_Y + 0.017, TH * 0.9, -0.008)]) makeMesh(g, mats.belt);
  const kz = cen.z + radAt(0) + TH * 2.4, ky = BELT_Y - 0.002;
  const blob = (cx, cy, cz, rx, ry, rz, rot, seed) => piece(21, 13, (u, v) => {
    const a = u * TAU, b = (v - 0.5) * Math.PI;
    let x = Math.cos(b) * Math.sin(a), y = Math.sin(b), z = Math.cos(b) * Math.cos(a);
    const nn = 1 + 0.12 * noise3(x * 3 + seed, y * 3, z * 3);
    x *= rx * nn; y *= ry * nn; z *= rz * nn;
    const c = Math.cos(rot), s = Math.sin(rot);
    return [cx + x * c - y * s, cy + x * s + y * c, cz + z, 0.85 + 0.15 * (y / ry + 1) * 0.5];
  });
  for (const g of [blob(0, ky, kz, 0.034, 0.03, 0.02, 0, 1), blob(-0.03, ky + 0.004, kz - 0.004, 0.026, 0.02, 0.014, 0.5, 2), blob(0.03, ky + 0.004, kz - 0.004, 0.026, 0.02, 0.014, -0.5, 3)]) makeMesh(g, mats.belt);
  function tail(side, len, sway) {
    return piece(7, 22, (u, v) => {
      const w = (u - 0.5) * 2, s = v * len, width = 0.027 - 0.004 * v;
      const swayX = side * (0.012 + 0.03 * v * v) + sway * Math.sin(v * 2.4), twist = side * 0.5 * v;
      return [swayX + w * width * Math.cos(twist), ky - 0.015 - s, kz - 0.012 + 0.012 * v + w * width * Math.sin(twist) + 0.006 * Math.sin(v * 9 + side) + 0.006 * Math.cos(w * 3), 0.8 + 0.2 * Math.abs(Math.cos(w * 2 + v * 3))];
    });
  }
  for (const g of [tail(1, 0.3, 0.004), tail(-1, 0.23, -0.004)]) makeMesh(g, mats.belt);

  // ---------- cloth the hands hold -------------------------------------------------------------------------------------------
  const bunch = {};
  const bunchMat = new THREE.MeshStandardMaterial({ color: look.kit, roughness: 0.85 });
  for (const side of ['L', 'R']) {
    const grp = new THREE.Group();
    const g = new THREE.SphereGeometry(0.034, 14, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nn = 1 + 0.32 * noise3(x * 60 + 3, y * 60, z * 60) + 0.12 * Math.sin(x * 190);
      p.setXYZ(i, x * nn * 1.35, y * nn * 0.78, z * nn);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, bunchMat); m.castShadow = true; grp.add(m);
    for (const [dx, rz] of [[-0.016, 0.25], [0.014, -0.3]]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.007, 3, 3, 1), bunchMat);
      const fp = f.geometry.attributes.position;
      for (let i = 0; i < fp.count; i++) fp.setZ(i, fp.getZ(i) + 0.006 * Math.sin(fp.getY(i) * 140 + fp.getX(i) * 90));
      f.geometry.computeVertexNormals();
      f.position.set(dx, -0.042, 0.002); f.rotation.z = rz; grp.add(f);
    }
    grp.visible = false;
    B(`${side}_Hand`).add(grp);
    bunch[side] = grp;
    const fr = human.fingers[side];
    if (fr && fr.ok) grp.position.copy(fr.knuckle).multiplyScalar(0.62).addScaledVector(fr.palmDir, 0.012);
  }
  function setBunch(side, on, color) { bunch[side].visible = !!on; if (color) bunchMat.color.set(color); }

  function setColors(l) {
    mats.kit.color.set(l.kit); mats.kit2.color.set(l.kit2); trimU.value.set(l.kit2); mats.belt.color.set(l.belt);
    mats.trousers.color.set(l.trousers || '#ece5d3');
  }
  function dispose() {
    for (const { bone, mesh } of meshes) { bone.remove(mesh); mesh.geometry.dispose(); }
    meshes.length = 0;
    for (const s of ['L', 'R']) if (bunch[s].parent) bunch[s].parent.remove(bunch[s]);
  }
  return { mats, setColors, dispose, setBunch, bunch };
}
