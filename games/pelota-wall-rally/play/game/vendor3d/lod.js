// Levels of detail for Human: the SAME skeleton and clips at every level, three meshes sets built once per character and shared by every person.
//   full   : the shipped skinned meshes (body + head, 2 draw calls)
//   medium : vertex-clustered copies keeping UVs and the textured tintable materials (about 40% of the triangles, 2 draw calls)
//   light  : ONE merged skinned mesh with ONE material (about 12% of the triangles, 1 draw call): albedo and tint masks are baked into vertex attributes,
//            and the kit / skin / hair tint recipe runs in the shader exactly like the textured levels.
import * as THREE from './three.js';

export const LOD_NAMES = ['full', 'medium', 'light'];
export const LOD_TARGETS = { medium: 0.4, light: 0.12 };

/** Screen-size policy per quality tier: pixel height of the person above which a level is used. */
export const LOD_POLICY = {
  // the light level (a distant blob with a simplified hand) is only for people shorter than ~60 px; everyone taller keeps the full-detail hands of the medium level
  high: { full: 230, medium: 60 },
  medium: { full: 340, medium: 70 },
  low: { full: Infinity, medium: 90 },
};

const srgbToLinear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };

function readPixels(tex) {
  const img = tex.image || (tex.source && tex.source.data);
  const w = img.width, h = img.height;
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  return { data: g.getImageData(0, 0, w, h).data, w, h };
}
const texel = (px, u, v) => { const x = Math.min(px.w - 1, Math.max(0, Math.floor(u * px.w))), y = Math.min(px.h - 1, Math.max(0, Math.floor(v * px.h))); return (y * px.w + x) * 4; };

/**
 * Cluster vertices of one or more source meshes on a grid. srcs: [{geo, id, bake?(i, out)}]. Positions/normals/weights are averaged, UVs optionally kept
 * (keepUV: the first vertex's UV; the key then includes the quantised UV so texture seams stay intact). Returns {geo, triOf} with per-source index lists.
 */
function cluster(srcs, cell, { keepUV, bakeLen = 0, handSet = null, handFine = 0.4 }) {
  const keys = new Map(), reps = [];
  const maps = [];
  for (const s of srcs) {
    const g = s.geo, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const n = pos.count, map = new Int32Array(n);
    const bake = new Float32Array(bakeLen);
    for (let i = 0; i < n; i++) {
      if (bakeLen) s.bake(i, bake);
      // material class (top / bottoms / socks / skin / hair / other) is part of the key: clusters never bleed cloth colour into skin
      const cls = bakeLen ? (bake[7] > 0.5 ? 5 : bake[6] > 0.5 ? 4 : bake[3] > 0.5 ? 1 : bake[4] > 0.5 ? 2 : bake[5] > 0.5 ? 3 : 0) : 0;
      // vertices weighted to the hand / finger bones use a finer cell, so the hand keeps a real shape (palm, four fingers, thumb) instead of collapsing into a blade
      let hw = 0; if (handSet) for (let k2 = 0; k2 < 4; k2++) if (handSet.has(si.getComponent(i, k2))) hw += sw.getComponent(i, k2);
      const cl = hw > 0.5 ? cell * Math.max(handFine, 0.001) : cell;
      let k = hw > 0.5 && handFine === 0 ? `${s.id}|h|${i}` : `${s.id}|${cls}|${hw > 0.5 ? 'h' : ''}|${Math.round(pos.getX(i) / cl)},${Math.round(pos.getY(i) / cl)},${Math.round(pos.getZ(i) / cl)}`;
      if (keepUV && !(hw > 0.5 && handFine === 0)) k += `|${Math.round(uv.getX(i) * 6)},${Math.round(uv.getY(i) * 6)}`;
      let c = keys.get(k);
      if (c === undefined) { c = reps.length; keys.set(k, c); reps.push({ src: s, first: i, n: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, w: new Map(), bake: new Float32Array(bakeLen) }); }
      const r = reps[c]; r.n++;
      r.x += pos.getX(i); r.y += pos.getY(i); r.z += pos.getZ(i); r.nx += nor.getX(i); r.ny += nor.getY(i); r.nz += nor.getZ(i);
      if (!keepUV) for (let k2 = 0; k2 < 4; k2++) { const wgt = sw.getComponent(i, k2); if (wgt > 0) { const b = si.getComponent(i, k2); r.w.set(b, (r.w.get(b) || 0) + wgt); } }
      if (bakeLen) for (let j = 0; j < bakeLen; j++) r.bake[j] += bake[j];
      map[i] = c;
    }
    maps.push(map);
  }
  const m = reps.length, P = new Float32Array(m * 3), N = new Float32Array(m * 3), U = keepUV ? new Float32Array(m * 2) : null, SI = new Uint16Array(m * 4), SW = new Float32Array(m * 4), B = bakeLen ? new Float32Array(m * bakeLen) : null;
  reps.forEach((r, c) => {
    P[c * 3] = r.x / r.n; P[c * 3 + 1] = r.y / r.n; P[c * 3 + 2] = r.z / r.n;
    const l = Math.hypot(r.nx, r.ny, r.nz) || 1; N[c * 3] = r.nx / l; N[c * 3 + 1] = r.ny / l; N[c * 3 + 2] = r.nz / l;
    const g = r.src.geo;
    if (keepUV) { U[c * 2] = g.attributes.uv.getX(r.first); U[c * 2 + 1] = g.attributes.uv.getY(r.first); for (let k = 0; k < 4; k++) { SI[c * 4 + k] = g.attributes.skinIndex.getComponent(r.first, k); SW[c * 4 + k] = g.attributes.skinWeight.getComponent(r.first, k); } } else {
      const top = [...r.w.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4); const tot = top.reduce((a, [, w]) => a + w, 0) || 1;
      for (let k = 0; k < 4; k++) { const e = top[k]; SI[c * 4 + k] = e ? e[0] : 0; SW[c * 4 + k] = e ? e[1] / tot : 0; }
    }
    for (let j = 0; j < bakeLen; j++) B[c * bakeLen + j] = r.bake[j] / r.n;
  });
  const tris = srcs.map((s, si2) => {
    const idx = s.geo.index.array, map = maps[si2], out = [];
    for (let i = 0; i < idx.length; i += 3) { const a = map[idx[i]], b = map[idx[i + 1]], c = map[idx[i + 2]]; if (a !== b && b !== c && a !== c) out.push(a, b, c); }
    return out;
  });
  return { P, N, U, SI, SW, B, tris, count: m };
}

function buildGeo(cl, srcIdx, { withUV, bakeAttrs }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(cl.P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(cl.N, 3));
  if (withUV) g.setAttribute('uv', new THREE.BufferAttribute(cl.U, 2));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(cl.SI, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(cl.SW, 4));
  if (bakeAttrs) bakeAttrs(g, cl);
  const idx = srcIdx.length === 1 ? cl.tris[srcIdx[0]] : srcIdx.flatMap((i) => cl.tris[i]);
  g.setIndex(new THREE.BufferAttribute(cl.count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1));
  g.computeBoundingSphere();
  return g;
}

const triCount = (cl, idxs) => idxs.reduce((a, i) => a + cl.tris[i].length / 3, 0);

function fitCell(srcs, target, opts) {
  const full = srcs.reduce((a, s) => a + s.geo.index.count / 3, 0);
  let lo = 0.004, hi = 0.12, best = null;
  for (let it = 0; it < 12; it++) {
    const mid = Math.sqrt(lo * hi);
    const cl = cluster(srcs, mid, opts);
    const t = triCount(cl, srcs.map((_, i) => i));
    best = { cl, cell: mid, tris: t };
    if (t / full > target) lo = mid; else hi = mid;
  }
  return best;
}

/**
 * Builds (once per character) the medium and light geometries from the loaded glTF scene + textures.
 * src meshes: {mesh (SkinnedMesh), kind: 'body'|'head'}.  Returns { medium: [{kind, geo}], light: geo, stats }.
 */
export function buildLodSet(meshes, { albedo, bodyMask, bodySkin, headMask }) {
  const bones = meshes[0].mesh.skeleton.bones;
  const handSet = new Set(); bones.forEach((b, i) => { if (/_Hand$|_Finger\d|_Forearm$/.test(b.name)) handSet.add(i); });   // hand + forearm keep detail: a collapsed forearm reads as a needle
  const px = { body: readPixels(albedo.body), head: readPixels(albedo.head), bodyMask: readPixels(bodyMask), bodySkin: readPixels(bodySkin), headMask: readPixels(headMask) };
  const full = meshes.reduce((a, m) => a + m.mesh.geometry.index.count / 3, 0);
  // medium: per mesh, UVs kept, shares the tinted textured materials
  const medium = meshes.map((m, i) => {
    const one = [{ geo: m.mesh.geometry, id: i }];
    const target = LOD_TARGETS.medium;
    const f = fitCell(one, target, { keepUV: true, handSet, handFine: 0 });   // medium keeps the full hand (150 triangles each): hands are what a viewer reads first
    return { kind: m.kind, geo: buildGeo(f.cl, [0], { withUV: true }), tris: f.tris };
  });
  // light: all meshes merged; albedo (linear) + tint masks baked per vertex
  const srcs = meshes.map((m, i) => ({
    geo: m.mesh.geometry, id: i, bake(v, out) {
      const uv = m.mesh.geometry.attributes.uv; const u = uv.getX(v), w = uv.getY(v);
      const a = px[m.kind], o = texel(a, u, w);
      out[0] = srgbToLinear(a.data[o]); out[1] = srgbToLinear(a.data[o + 1]); out[2] = srgbToLinear(a.data[o + 2]);
      if (m.kind === 'body') { const k = texel(px.bodyMask, u, w); out[3] = px.bodyMask.data[k] / 255; out[4] = px.bodyMask.data[k + 1] / 255; out[5] = px.bodyMask.data[k + 2] / 255; const s = texel(px.bodySkin, u, w); out[6] = px.bodySkin.data[s] / 255; out[7] = 0;
        // texels at UV island edges / under hems are near-black (ambient-occlusion paint): above the knee nothing on the body is that dark, so treat them as cloth (never a black triangle)
        let lum = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
        if (out[6] > 0.5 && lum < 0.17) { const k = 0.17 / Math.max(lum, 0.004); const kk = Math.min(k, 12); out[0] *= kk; out[1] *= kk; out[2] *= kk; lum = 0.17; }
        // cloth keeps its folds but not the ambient-occlusion bands at hems (they read as dirty grey smudges when the figure is small)
        if (out[6] < 0.5 && out[3] + out[4] + out[5] > 0.5 && lum < 0.62 && lum > 0.001) { const k = 0.62 / lum; out[0] *= k; out[1] *= k; out[2] *= k; lum = 0.62; }
        if (out[6] < 0.5 && out[3] + out[4] + out[5] < 0.5 && m.mesh.geometry.attributes.position.getY(v) > 0.45 && Math.abs(m.mesh.geometry.attributes.position.getX(v)) < 0.22) { out[0] = out[1] = out[2] = 0.72; if (out[3] + out[4] + out[5] < 0.5) { if (m.mesh.geometry.attributes.position.getY(v) > 1.0) out[3] = 1; else out[4] = 1; } }
      } else { const k = texel(px.headMask, u, w); out[3] = out[4] = out[5] = 0; out[6] = px.headMask.data[k + 1] / 255; out[7] = px.headMask.data[k] / 255; }
    },
  }));
  const f = fitCell(srcs, LOD_TARGETS.light, { keepUV: false, bakeLen: 8, handSet, handFine: 0.16 });
  const cl = f.cl;
  const light = buildGeo(cl, srcs.map((_, i) => i), {
    withUV: false,
    bakeAttrs(g) {
      const col = new Float32Array(cl.count * 3), mask = new Float32Array(cl.count * 4), hair = new Float32Array(cl.count);
      for (let c = 0; c < cl.count; c++) { col.set(cl.B.subarray(c * 8, c * 8 + 3), c * 3); mask.set(cl.B.subarray(c * 8 + 3, c * 8 + 7), c * 4); hair[c] = cl.B[c * 8 + 7]; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setAttribute('aMask', new THREE.BufferAttribute(mask, 4));
      g.setAttribute('aHair', new THREE.BufferAttribute(hair, 1));
    },
  });
  return { medium, light, handSet: [...handSet], stats: { full, medium: medium.reduce((a, m) => a + m.tris, 0), light: f.tris, lightVerts: cl.count } };
}

/** The single light-level material: vertex colours + baked masks, same tint recipe as the textured levels. */
export function makeLightMaterial(u) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.8, name: 'light', side: THREE.DoubleSide });
  m.userData.tint = u; m.userData.kind = 'light';
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); blank.needsUpdate = true;
  u.uOutline ||= { value: 0 }; u.uStripe ||= { value: 0 }; u.tDecal ||= { value: blank }; u.uDecalOn ||= { value: 0 }; u.uDecalCol ||= { value: new THREE.Color(1, 1, 1) };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = `attribute vec4 aMask; attribute float aHair; attribute float aTrim; attribute float aStripe; varying float vStripe; varying vec3 vDP; varying vec4 vMask; varying float vHair; varying float vTrim;\n${sh.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\n vMask = aMask; vHair = aHair; vTrim = aTrim; vStripe = aStripe; vDP = vec3(position.x, position.y, normal.z);');
    sh.fragmentShader = `uniform vec3 uTop; uniform vec3 uBottoms; uniform vec3 uSocks; uniform vec3 uSkin; uniform float uSkinK; uniform float uSkinLum; uniform vec3 uHair; uniform float uHairK; uniform float uHairLum; uniform vec3 uShoe; uniform vec3 uTrim; uniform float uRim; uniform float uOutline; uniform float uStripe; uniform sampler2D tDecal; uniform float uDecalOn; uniform vec3 uDecalCol; varying float vStripe; varying vec3 vDP; float gFloor = 0.0; varying float vTrim; varying vec4 vMask; varying float vHair;\n${sh.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec3 b0 = diffuseColor.rgb; vec3 c = b0;
        c = mix(c, b0 * uTop, vMask.r); c = mix(c, b0 * uBottoms, vMask.g); c = mix(c, b0 * uSocks, vMask.b);
        float lh = dot(c, vec3(0.2126, 0.7152, 0.0722)); float lb = dot(b0, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, uHair * clamp(pow(lh / uHairLum, 0.65), 0.25, 2.6), max(vHair, 0.0) * uHairK);
        c = mix(c, uShoe * (lb / 0.8), max(-vHair, 0.0));
        c = mix(c, uTrim * (lb / 0.8), clamp(vTrim, 0.0, 1.0));
        c = mix(c, vec3(0.86) * (lb / 0.8), clamp(vTrim - 1.0, 0.0, 1.0));
        c = mix(c, uTrim * (lb / 0.8), clamp(vStripe, 0.0, 1.0) * uStripe);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, uSkin * clamp(l / uSkinLum, 0.0, 2.4), vMask.a * uSkinK);
        if (uDecalOn > 0.5 && vDP.z < -0.25) { vec2 duv = vec2(0.5 + vDP.x / 0.30, (vDP.y - 1.10) / 0.30); if (duv.x > 0.03 && duv.x < 0.97 && duv.y > 0.03 && duv.y < 0.97) c = mix(c, uDecalCol, texture2D(tDecal, duv).a); }
        diffuseColor.rgb = c;
        gFloor = 0.4;
      }`)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n gl_FragColor.rgb = max(gl_FragColor.rgb, diffuseColor.rgb * gFloor);\n float ndv = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0); float rimF = pow(1.0 - ndv, 3.0); gl_FragColor.rgb *= 1.0 - uOutline * 0.9 * smoothstep(0.55, 0.05, ndv); gl_FragColor.rgb += (1.0 - uOutline) * uRim * rimF * vec3(0.46, 0.56, 0.72) + uRim * 0.34 * (0.45 + 0.55 * normal.y) * vec3(0.5, 0.58, 0.7);\n if (!gl_FrontFacing) gl_FragColor.rgb = diffuseColor.rgb * 0.62;');
  };
  m.customProgramCacheKey = () => 'view3d-light';
  return m;
}

/** Pixel height of a human on screen (feet to head top), for LOD selection. */
export function screenHeightPx(human, camera, viewportHeight) {
  const p = human.root.position;
  const h = (human.info.height || 1.75);
  const a = new THREE.Vector3(p.x, p.y, p.z).project(camera), b = new THREE.Vector3(p.x, p.y + h, p.z).project(camera);
  if (a.z > 1 || b.z > 1) return 0;
  return Math.abs(b.y - a.y) * 0.5 * viewportHeight;
}

/** The level for a given screen height with hysteresis (current = the level now; +-12% around each threshold). */
export function pickLod(px, policy, current = 0) {
  const th = (lvl, t) => t * (current <= lvl ? 0.88 : 1.12);   // keep the current level until the size is clearly past the threshold
  if (px >= th(0, policy.full)) return 0;
  if (px >= th(1, policy.medium)) return 1;
  return 2;
}
