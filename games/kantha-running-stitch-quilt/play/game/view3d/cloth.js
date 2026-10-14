// The quilt: a stack of old saris with the working patch on top. The top cloth is a displaced grid (kantha ripples along every sewn row,
// puffy motifs where a ring or petal is complete, soft wrinkles) with a woven albedo + normal map; the chalk rows, stitch holes and warm
// glow are baked into its albedo whenever the sewn set changes. Heights are sampled by the thread and the knots so they sit on the cloth.
import * as THREE from '../vendor3d/three.js';
import { UNIT } from '../src/v3.js';
import { clothTextures, texOf, mk, hash, fbm, clamp, smooth, hexRgb } from './tex.js';

const AMP_PUCK = 0.0028, AMP_PUFF = 0.0072;   // metres: valley depth along a stitched row, height of a puffy motif

export function createCloth({ tier = 2, size = 10 } = {}) {
  const N = tier >= 2 ? 112 : tier === 1 ? 88 : 64, M = (N + 1) * (N + 1);
  const TS = tier >= 2 ? 1024 : 512;   // albedo size
  const group = new THREE.Group();
  const W = size * UNIT, half = W / 2;

  // ---- geometry: a grid of N x N quads, heights written into position.y
  const pos = new Float32Array(M * 3), uv = new Float32Array(M * 2), idx = [];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i;
      pos[k * 3] = -half + (i / N) * W; pos[k * 3 + 1] = 0; pos[k * 3 + 2] = -half + (j / N) * W;
      uv[k * 2] = i / N; uv[k * 2 + 1] = 1 - j / N;
    }
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(35048);
  geo.setAttribute('position', posAttr); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const albedo = mk(TS), ag = albedo.getContext('2d');
  const albedoTex = texOf(albedo, { wrap: false, aniso: 8 });
  const mat = new THREE.MeshPhysicalMaterial({ map: albedoTex, roughness: 0.93, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff2dc), envMapIntensity: 0.35 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);

  // ---- the cut edge: a thin skirt around the patch so it has thickness
  const skirtPos = new Float32Array(4 * N * 2 * 3 * 2), skirtIdx = [];
  const edgeIdx = [];
  for (let i = 0; i <= N; i++) edgeIdx.push(i);
  for (let j = 1; j <= N; j++) edgeIdx.push(j * (N + 1) + N);
  for (let i = N - 1; i >= 0; i--) edgeIdx.push(N * (N + 1) + i);
  for (let j = N - 1; j >= 1; j--) edgeIdx.push(j * (N + 1));
  const skGeo = new THREE.BufferGeometry();
  const skP = new Float32Array(edgeIdx.length * 2 * 3), skUv = new Float32Array(edgeIdx.length * 2 * 2);
  for (let q = 0; q < edgeIdx.length; q++) {
    const a = q, b = (q + 1) % edgeIdx.length;
    if (b !== 0 || true) { skirtIdx.push(a * 2, b * 2, a * 2 + 1, a * 2 + 1, b * 2, b * 2 + 1); }
    skUv[q * 4] = 0.5; skUv[q * 4 + 1] = 0.5; skUv[q * 4 + 2] = 0.5; skUv[q * 4 + 3] = 0.5;
  }
  const skAttr = new THREE.BufferAttribute(skP, 3); skAttr.setUsage(35048);
  skGeo.setAttribute('position', skAttr); skGeo.setAttribute('uv', new THREE.BufferAttribute(skUv, 2)); skGeo.setIndex(skirtIdx);
  const skirt = new THREE.Mesh(skGeo, new THREE.MeshStandardMaterial({ color: 0xd9ceb4, roughness: 1, side: THREE.DoubleSide }));
  skirt.receiveShadow = true; skirt.castShadow = false; group.add(skirt);
  void skirtPos;

  // ---- fields (final heights = base + sum of amp * run fields), metres
  const base = new Float32Array(M), H = new Float32Array(M);
  const fieldsFor = new Map();   // run.i -> { pk, pf, amp, target, closed }
  let patchKey = '', runsRef = null;
  const cellPos = (i, j) => [(i / N) * size, (j / N) * size];

  function makeBase(seed) {
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = i / N, y = j / N;
        let h = (fbm(x * 2.6 + seed, y * 2.6, seed, 3) - 0.5) * 0.0085 + (fbm(x * 8 + 11, y * 8, seed + 3, 2) - 0.5) * 0.0022;
        // the cut edge curls up a little
        const e = Math.min(x, 1 - x, y, 1 - y);
        h += 0.0024 * (1 - smooth(0, 0.05, e)) + 0.0085;
        base[j * (N + 1) + i] = h;
      }
    }
  }

  function runFields(run) {
    const pts = [];
    const L = run.len, step = 0.2, n = Math.max(2, Math.ceil(L / step));
    for (let k = 0; k <= n; k++) {
      const s = (L * k) / n; let lo = 0, hi = run.cum.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (run.cum[m] <= s) lo = m; else hi = m; }
      const seg = run.cum[hi] - run.cum[lo], t = seg > 0 ? (s - run.cum[lo]) / seg : 0, a = run.pts[lo], b = run.pts[hi];
      pts.push(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < pts.length; k += 2) { x0 = Math.min(x0, pts[k]); x1 = Math.max(x1, pts[k]); y0 = Math.min(y0, pts[k + 1]); y1 = Math.max(y1, pts[k + 1]); }
    const pk = new Float32Array(M), pf = run.closed ? new Float32Array(M) : null;
    const marg = 0.95, cell = size / N;
    const gi0 = Math.max(0, Math.floor((x0 - marg) / cell)), gi1 = Math.min(N, Math.ceil((x1 + marg) / cell));
    const gj0 = Math.max(0, Math.floor((y0 - marg) / cell)), gj1 = Math.min(N, Math.ceil((y1 + marg) / cell));
    for (let j = gj0; j <= gj1; j++) {
      for (let i = gi0; i <= gi1; i++) {
        const px = i * cell, py = j * cell;
        let d2 = 1e9;
        for (let k = 0; k < pts.length; k += 2) { const dx = pts[k] - px, dy = pts[k + 1] - py, dd = dx * dx + dy * dy; if (dd < d2) d2 = dd; }
        const d = Math.sqrt(d2), o = j * (N + 1) + i;
        pk[o] = -Math.exp(-((d / 0.2) ** 2)) + 0.5 * Math.exp(-(((d - 0.62) / 0.28) ** 2));
        if (pf) {
          // inside test by ray casting on the sampled outline
          let inside = false;
          for (let k = 0, m = pts.length - 2; k < pts.length; m = k, k += 2) {
            const xi = pts[k], yi = pts[k + 1], xj = pts[m], yj = pts[m + 1];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) { const t = clamp(d / 1.1, 0, 1); pf[o] = t * t * (3 - 2 * t); }
        }
      }
    }
    return { pk, pf, amp: 0, target: 0, closed: !!run.closed, c: centroid(pts), r: Math.max(x1 - x0, y1 - y0) / 2 };
  }
  function centroid(pts) { let sx = 0, sy = 0, n = 0; for (let k = 0; k < pts.length; k += 2) { sx += pts[k]; sy += pts[k + 1]; n++; } return [sx / n, sy / n]; }

  let dirty = true, version = 0;
  function recompose() {
    H.set(base);
    for (const f of fieldsFor.values()) {
      if (f.amp <= 0.001) continue;
      const a = f.amp, ap = AMP_PUCK * a, af = AMP_PUFF * a * a;
      for (let k = 0; k < M; k++) { const p = f.pk[k]; if (p !== 0) H[k] += p * ap; }
      if (f.pf) for (let k = 0; k < M; k++) { const q = f.pf[k]; if (q !== 0) H[k] += q * af; }
    }
    for (let k = 0; k < M; k++) pos[k * 3 + 1] = H[k];
    posAttr.needsUpdate = true; geo.computeVertexNormals();
    // skirt follows the rim
    for (let q = 0; q < edgeIdx.length; q++) {
      const k = edgeIdx[q];
      skP[q * 6] = pos[k * 3]; skP[q * 6 + 1] = H[k]; skP[q * 6 + 2] = pos[k * 3 + 2];
      skP[q * 6 + 3] = pos[k * 3]; skP[q * 6 + 4] = H[k] - 0.0036; skP[q * 6 + 5] = pos[k * 3 + 2];
    }
    skAttr.needsUpdate = true; skGeo.computeVertexNormals();
    version++; dirty = false;
  }
  // bilinear height in metres at cloth coords (x, y), 0 outside
  function heightAt(x, y) {
    if (x < 0 || y < 0 || x > size || y > size) return 0;
    const gx = (x / size) * N, gy = (y / size) * N, i = Math.min(N - 1, Math.floor(gx)), j = Math.min(N - 1, Math.floor(gy)), fx = gx - i, fy = gy - j;
    const o = j * (N + 1) + i;
    return (H[o] * (1 - fx) + H[o + 1] * fx) * (1 - fy) + (H[o + N + 1] * (1 - fx) + H[o + N + 2] * fx) * fy;
  }

  // ---- looks (textures per look id) -----------------------------------------------------------------------------------------------------
  const looks = new Map();
  let curLook = null, baseAlbedo = null;
  function setLook(id, T) {
    if (curLook === id) return;
    let L = looks.get(id);
    if (!L) {
      const tex = clothTextures({ size: TS, c0: T.patch0, c1: T.patch1, pitch: TS >= 1024 ? 5 : 3.4, seed: 3 + id.length, strength: 1.6 });
      const normalTex = texOf(tex.normal, { aniso: 8, srgb: false, wrap: false });
      L = { base: tex.albedo, normal: normalTex };
      looks.set(id, L);
    }
    curLook = id; baseAlbedo = L.base; mat.normalMap = L.normal; mat.normalScale.set(0.9, 0.9); mat.needsUpdate = true;
    bakeKey = '';
  }

  // ---- bake: chalk rows, stitch holes, warm glow into the albedo -------------------------------------------------------------------------------
  let bakeKey = '';
  const k = TS / size;
  function dashPath(g, dashes, upTo) {
    g.beginPath();
    for (const d of dashes) {
      if (d.u0 >= upTo) break;
      const p = d.pts; g.moveTo(p[0] * k, p[1] * k);
      for (let q = 3; q < p.length; q += 3) g.lineTo(p[q] * k, p[q + 1] * k);
    }
  }
  // o: { T, sewn: [{ run?, dashes, upTo }], chalk: [{ dashes, tint, thin }] }
  function bake(key, o) {
    if (key === bakeKey) return false;
    bakeKey = key;
    ag.globalCompositeOperation = 'source-over'; ag.globalAlpha = 1;
    ag.drawImage(baseAlbedo, 0, 0, TS, TS);
    const T = o.T;
    // a faint running-stitch border just inside the edge
    ag.save(); ag.lineWidth = Math.max(1.4, TS * 0.004); ag.strokeStyle = T.edge; ag.setLineDash([TS * 0.018, TS * 0.012]); ag.beginPath();
    ag.roundRect(TS * 0.026, TS * 0.026, TS * 0.948, TS * 0.948, TS * 0.01); ag.stroke(); ag.restore();
    // warm tint on completed closed motifs
    for (const s of o.sewn) {
      if (!s.run || !s.run.closed) continue;
      ag.save(); ag.beginPath();
      s.run.pts.forEach((p, q) => (q ? ag.lineTo(p[0] * k, p[1] * k) : ag.moveTo(p[0] * k, p[1] * k)));
      ag.closePath(); ag.fillStyle = 'rgba(255,196,120,0.17)'; ag.fill(); ag.restore();
    }
    // chalk rows (the colour of the thread each row needs, under a dusting of chalk)
    const lw = Math.max(2, TS * 0.0058);
    for (const c of o.chalk) {
      const w = c.thin ? 0.7 : 1;
      dashPath(ag, c.dashes, 1e9);
      ag.lineCap = 'round'; ag.lineWidth = lw * 1.9 * w; ag.strokeStyle = c.tint; ag.globalAlpha = 0.5; ag.stroke();
      ag.lineWidth = lw * 1.25 * w; ag.strokeStyle = T.chalk; ag.globalAlpha = 1; ag.stroke();
      ag.lineWidth = lw * 0.5 * w; ag.strokeStyle = 'rgba(255,255,255,0.35)'; ag.stroke();
    }
    ag.lineCap = 'butt';
    // under-thread shade + stitch holes at both ends of every sewn dash
    for (const s of o.sewn) {
      ag.save(); ag.lineCap = 'round';
      dashPath(ag, s.dashes, s.upTo); ag.lineWidth = lw * 2.6; ag.strokeStyle = 'rgba(30,14,4,0.22)'; ag.translate(TS * 0.0028, TS * 0.0036); ag.stroke(); ag.restore();
      ag.fillStyle = 'rgba(24,10,4,0.62)';
      for (const d of s.dashes) {
        if (d.u0 >= s.upTo) break;
        const p = d.pts;
        ag.beginPath(); ag.arc(p[0] * k, p[1] * k, lw * 0.75, 0, 7); ag.fill();
        if (d.u1 <= s.upTo) { ag.beginPath(); ag.arc(p[p.length - 3] * k, p[p.length - 2] * k, lw * 0.75, 0, 7); ag.fill(); }
      }
    }
    albedoTex.needsUpdate = true;
    return true;
  }

  // ---- per-frame ----------------------------------------------------------------------------------------------------------------------------
  // runs: the patch's run list (identity decides when the fields are rebuilt); targets: Map(run.i -> 0..1 how sewn the row is)
  function setPatch(key, runs) {
    if (patchKey === key && runsRef === runs) return;
    patchKey = key; runsRef = runs; fieldsFor.clear();
    makeBase(hash(key.length, key.charCodeAt(0) || 1, 7) * 20);
    dirty = true; bakeKey = '';
  }
  const glows = [];   // { c:[x,y], r, t } warm pulses when a closed motif completes
  function sync(targets, dt, rampT = 0.5) {
    for (const [ri, tg] of targets) {
      let f = fieldsFor.get(ri);
      if (!f) { f = runFields(runsRef[ri]); fieldsFor.set(ri, f); }
      if (tg >= 0.999 && f.target < 0.999 && f.closed) glows.push({ c: f.c, r: f.r, t: 0 });
      f.target = tg;
    }
    for (const [ri, f] of fieldsFor) {
      if (!targets.has(ri)) f.target = 0;
      if (f.amp !== f.target) {
        const step = dt / rampT, a = f.amp + clamp(f.target - f.amp, -step * 2, step);
        if (Math.abs(a - f.amp) > 1e-5) { f.amp = a; dirty = true; }
      }
    }
    settledNow = !dirty && ![...fieldsFor.values()].some((f) => f.amp !== f.target);
    if (dirty) recompose();
    for (let q = glows.length - 1; q >= 0; q--) { glows[q].t += dt; if (glows[q].t > 1.6) glows.splice(q, 1); }
  }
  let settledNow = true;
  function settle() { for (const f of fieldsFor.values()) f.amp = f.target; dirty = true; recompose(); }

  // ---- the stack of older cloths under the patch -------------------------------------------------------------------------------------------
  const layerGroup = new THREE.Group(); group.add(layerGroup);
  const layerLooks = new Map();
  function setLayers(id, T) {
    if (layerLooks.has(id)) { layerLooks.get(id).visible = true; for (const [k2, g] of layerLooks) if (k2 !== id) g.visible = false; return; }
    for (const g of layerLooks.values()) g.visible = false;
    const g = new THREE.Group();
    const defs = [
      { col: T.layer[0], col2: T.layer[1], s: 1.13, rot: -0.045, dx: 0.004, dz: -0.003, y: -0.0014, st: [{ edge: 'top', at: 0.012, w: 0.045, color: '#b3322a' }, { edge: 'top', at: 0.066, w: 0.014, color: '#d9a43a' }, { edge: 'bottom', at: 0.012, w: 0.03, color: '#b3322a' }] },
      { col: T.layer[1], col2: T.layer[0], s: 1.27, rot: 0.06, dx: -0.006, dz: 0.005, y: -0.0042, st: [{ edge: 'left', at: 0.012, w: 0.055, color: '#27407f' }, { edge: 'left', at: 0.075, w: 0.012, color: '#e8d9b0' }, { edge: 'right', at: 0.012, w: 0.04, color: '#27407f' }] },
      { col: mixHex(T.layer[0], T.layer[1]), col2: T.layer[0], s: 1.42, rot: -0.02, dx: 0.003, dz: 0.008, y: -0.007, st: [{ edge: 'bottom', at: 0.012, w: 0.06, color: '#c98a24' }, { edge: 'bottom', at: 0.08, w: 0.016, color: '#7d2a22' }, { edge: 'top', at: 0.012, w: 0.05, color: '#c98a24' }] },
    ];
    defs.forEach((d, i) => {
      const sz = TS >= 1024 ? 640 : 384, fr = Math.round(sz * 0.02);
      const tx = clothTextures({ size: sz, c0: d.col, c1: d.col2, pitch: 4, seed: 40 + i * 9, stripes: d.st, fringe: fr, strength: 1.2 });
      const map = texOf(tx.albedo, { wrap: false }), nm = texOf(tx.normal, { srgb: false, wrap: false });
      const m = new THREE.MeshStandardMaterial({ map, normalMap: nm, roughness: 0.96, alphaTest: 0.45, side: THREE.DoubleSide });
      const body = d.s * W, full = body * (sz / (sz - 2 * fr));
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(full, full).rotateX(-Math.PI / 2), m);
      pl.receiveShadow = true; pl.castShadow = true;
      const bx = new THREE.Mesh(new THREE.BoxGeometry(body * 0.998, 0.0024, body * 0.998), new THREE.MeshStandardMaterial({ color: d.col, roughness: 1 }));
      bx.position.y = -0.0013; bx.receiveShadow = true; bx.castShadow = true;
      const lg = new THREE.Group(); lg.add(pl, bx);
      lg.position.set(d.dx, d.y + 0.0007, d.dz); lg.rotation.y = d.rot;
      g.add(lg);
    });
    layerLooks.set(id, g); layerGroup.add(g);
  }
  function mixHex(a, b) { const A = hexRgb(a), B = hexRgb(b), h = (v) => ((v >> 1) & 255).toString(16).padStart(2, '0'); return `#${h(A[0] + B[0])}${h(A[1] + B[1])}${h(A[2] + B[2])}`; }

  return {
    group, mesh, size, half, W,
    setLook(id, T) { setLook(id, T); setLayers(id, T); },
    setPatch, sync, settle, bake, heightAt, glows,
    get version() { return version; },
    get settled() { return settledNow; },
    get N() { return N; },
    dispose() { geo.dispose(); mat.dispose(); albedoTex.dispose(); },
  };
}
