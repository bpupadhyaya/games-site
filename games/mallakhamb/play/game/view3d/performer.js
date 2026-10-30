// A real 3D performer on the mallakhamb pole (presentation only: reads the 2D rig's pose, never writes back).
//
// The shared view3d layer supplies the person (athlete_m), the stage and the IK. The 2D rig in src/figure.js stays the single source of
// truth for where the pelvis, hands and feet are (in pole units); this file maps those points to metres, rolls the body for the flag and
// the upside-down poses, and lets the skeleton's IK reach them. The picture is drawn into an off-screen WebGL canvas and composited by the
// 2D stage (see drawPerformer()), so the courtyard, pole, chalk, pops and HUD stay 2D.
import { createStage, loadHuman, createCrowd3d, Clip, CLIP_BONES, semanticRot, footQuat, handQuat, THREE } from '../vendor3d/index.js';
import { solve, RIG, STANDING_PELVIS } from '../src/figure.js';
import { buildWorld, buildCrowd, POLE_R, POLE_Z } from './scene.js';
import { paintMuscles, clothBump } from './muscle.js';
import { Cloth } from './cloth.js';
import { createDrummer } from './drummer.js';
import { subdivide, sculptShoulders, smoothWeights, relax, weldedNormals, clavicleLift } from './anatomy.js';

const { Vector3, Quaternion, Euler } = THREE;
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bi = (n) => CLIP_BONES.indexOf(`Bip01_${n}`);

// Shirtless, barefoot, trunks above the knee: the shipped athlete wears a tank top, trainers and long shorts, so this repaints the body texture
// of THIS person at load (a canvas copy: the shared vendored textures stay untouched) and clears the matching tint masks.
function bareBody(human) {
  const N = 1024;
  // bare feet: drop every triangle that sits on the foot / toe bones (the trainers); real feet are added by addFeet() below.
  // Degenerate triangles keep the draw-group ranges intact.
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.barefoot) return;
    const geo = o.geometry, ix = geo.index, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!ix || !si) return;
    const foot = new Set(o.skeleton.bones.map((bn, i) => (/_(Foot|Toe0)$/.test(bn.name) ? i : -1)).filter((i) => i >= 0));
    const w = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < w.length; i++) for (let k = 0; k < 4; k++) if (foot.has(si.getComponent(i, k))) w[i] += sw.getComponent(i, k);
    const a = ix.array;
    for (let t = 0; t < a.length; t += 3) if (w[a[t]] + w[a[t + 1]] + w[a[t + 2]] > 0.45) { a[t + 1] = a[t]; a[t + 2] = a[t]; }
    ix.needsUpdate = true; geo.userData.barefoot = true;
  });
  const cv = () => { const c = globalThis.document.createElement('canvas'); c.width = c.height = N; return c; };
  const read = (img) => { const c = cv(); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N); return { c, g, d: g.getImageData(0, 0, N, N) }; };
  for (const m of human.mats) {
    if (m.userData.kind !== 'body' || !m.map || !m.userData.tint) continue;
    const u = m.userData.tint;
    const A = read(m.map.image), M = read(u.tMask.value.image), K = read(u.tSkin.value.image);
    const a = A.d.data, mk = M.d.data, sk = K.d.data;
    // mean skin colour (and luminance) from the arm strip of the texture, where the original skin shows
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 540; y < 760; y += 2) for (let x = 40; x < 270; x += 2) { const i = (y * N + x) * 4; r += a[i]; g += a[i + 1]; b += a[i + 2]; n++; }
    r /= n; g /= n; b /= n;
    let kSum = 0, kN = 0;
    for (let y = 540; y < 760; y += 2) for (let x = 40; x < 270; x += 2) { kSum += sk[(y * N + x) * 4]; kN++; }
    const armK = kSum / kN;
    window.__armK = armK;
    const skinLum = 0.299 * r + 0.587 * g + 0.114 * b;
    // real skin detail: tile a patch of the thigh skin (mirrored, so no seams) over the repainted regions, matched to the arm colour
    const PX0 = 20, PY0 = 250, PW = 270, PH = 180;
    let pr = 0, pg = 0, pb = 0, pn = 0;
    for (let y = PY0; y < PY0 + PH; y += 2) for (let x = PX0; x < PX0 + PW; x += 2) { const i = (y * N + x) * 4; pr += a[i]; pg += a[i + 1]; pb += a[i + 2]; pn++; }
    pr /= pn; pg /= pn; pb /= pn;
    const patch = new Uint8ClampedArray(PW * PH * 3);
    for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) { const i = ((PY0 + y) * N + PX0 + x) * 4, j = (y * PW + x) * 3; patch[j] = a[i]; patch[j + 1] = a[i + 1]; patch[j + 2] = a[i + 2]; }
    const mir = (v, n) => { const m = ((v % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; };
    const paint = (x0, y0, x1, y1, test, mul = 1) => {
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * N + x) * 4;
        if (test && !test(i, x, y)) continue;
        const L = 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
        const sh = mul * Math.pow(clamp(L / 225, 0.72, 1.0), 0.3);
        const j = (mir(y - y0, PH) * PW + mir(x - x0, PW)) * 3;
        a[i] = clamp(patch[j] * (r / pr) * sh, 0, 255); a[i + 1] = clamp(patch[j + 1] * (g / pg) * sh, 0, 255); a[i + 2] = clamp(patch[j + 2] * (b / pb) * sh, 0, 255); a[i + 3] = 255;
        sk[i] = armK; mk[i] = 0; mk[i + 1] = 0; mk[i + 2] = 0;
      }
    };
    paint(325, 30, 702, 880, null, 1.12);                                                                // the tank top, its seams and borders
    // (the trainers' texels need no repaint: their triangles are removed above, and the forearms and hands share those rows)
    // the shorts stay cloth all the way to the hem (hem band included), tinted by the trunks colour
    for (const [x0, x1] of [[0, 318], [712, 1024]]) for (let y = 100; y < 214; y++) for (let x = x0; x < x1; x++) { const i = (y * N + x) * 4; if (a[i + 3] > 0) { mk[i + 1] = 255; mk[i] = 0; mk[i + 2] = 0; sk[i] = 0; } }
    paint(0, 420, 330, 520, (i) => mk[i + 2] > 100 || (a[i] > 170 && a[i + 1] > 170 && a[i + 2] > 170) || a[i + 2] > a[i] + 8);                   // sock tops
    paint(700, 420, 1024, 520, (i) => mk[i + 2] > 100 || (a[i] > 170 && a[i + 1] > 170 && a[i + 2] > 170) || a[i + 2] > a[i] + 8);
    // the seam between the two arm strips (a hard tone step across the upper arm): blend it vertically over a short band
    for (const [x0, x1] of [[0, 312], [708, 1024]]) {
      const y0 = 428, y1 = 466;
      for (let x = x0; x < x1; x++) {
        const i0 = (y0 * N + x) * 4, i1 = (y1 * N + x) * 4;
        for (let y = y0 + 1; y < y1; y++) { const u = (y - y0) / (y1 - y0), i = (y * N + x) * 4; for (let c = 0; c < 3; c++) a[i + c] = a[i0 + c] * (1 - u) + a[i1 + c] * u; }
      }
    }
    paint(0, 214, 330, 520, (i) => mk[i + 1] > 60);                                                      // any trunks-tint left below the hem is skin
    paint(700, 214, 1024, 520, (i) => mk[i + 1] > 60);
    // any texel still tinted as the top (the vest's straps and armhole binding on the arm islands) is skin
    paint(0, 0, 1024, 1024, (i) => mk[i] > 40 && a[i + 3] > 0);
    // the top of each arm island (the shoulder cap) carries the vest's armhole binding and smeared padding: fresh skin there
    {
      const keep = new Uint8ClampedArray(a);                       // feathered: full repaint at the cap, fading out down the arm
      paint(0, 452, 318, 580, (i) => sk[i] >= 128, 1.0);
      paint(706, 452, 1024, 580, (i) => sk[i] >= 128, 1.0);
      for (let y = 500; y < 580; y++) {
        const u = (y - 500) / 80, f = u * u * (3 - 2 * u);
        for (const [x0, x1] of [[0, 318], [706, 1024]]) for (let x = x0; x < x1; x++) { const i = (y * N + x) * 4; for (let c = 0; c < 3; c++) a[i + c] = a[i + c] * (1 - f) + keep[i + c] * f; }
      }
    }
    // gutters: copy the nearest skin texel sideways into the padding round the islands, so mip levels do not bleed a dark seam line
    for (let y = 30; y < 880; y++) {
      const row = y * N;
      for (const dir of [1, -1]) {
        let last = -1;
        for (let k = 0; k < N; k++) {
          const x = dir > 0 ? k : N - 1 - k, i = (row + x) * 4;
          if (sk[i] >= 128) { last = x; continue; }
          if (last >= 0 && Math.abs(x - last) <= 10 && (y < 90 || y > 225)) { const j = (row + last) * 4; a[i] = a[j]; a[i + 1] = a[j + 1]; a[i + 2] = a[j + 2]; a[i + 3] = 255; sk[i] = sk[j]; mk[i] = mk[i + 1] = mk[i + 2] = 0; }
        }
      }
    }
    // one skin: the repainted vest panels are brought to the arms' own brightness, so no tank-top outline survives round the armhole
    {
      const lum = (x0, y0, x1, y1) => { let t = 0, k = 0; for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) { const i = (y * N + x) * 4; if (sk[i] < 128) continue; t += 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2]; k++; } return k ? t / k : 1; };
      const fix = clamp(lum(40, 540, 270, 760) / lum(380, 560, 640, 860), 0.7, 1.2);
      // hands: same brightness as the forearm they continue
      const hfix = clamp(lum(790, 706, 980, 843) / lum(796, 878, 1012, 1011), 0.75, 1.35);
      for (let y = 874; y < 1024; y++) for (const [x0, x1] of [[0, 240], [786, 1024]]) for (let x = x0; x < x1; x++) { const i = (y * N + x) * 4; if (sk[i] < 128) continue; a[i] *= hfix; a[i + 1] *= hfix; a[i + 2] *= hfix; }
      for (let y = 30; y < 880; y++) for (let x = 325; x < 702; x++) { const i = (y * N + x) * 4; if (sk[i] < 128) continue; a[i] *= fix; a[i + 1] *= fix; a[i + 2] *= fix; }
    }
    A.g.putImageData(A.d, 0, 0); M.g.putImageData(M.d, 0, 0); K.g.putImageData(K.d, 0, 0);
    // trained-athlete definition: shading painted into the albedo + a bump map so it reacts to the light as he turns
    const B = cv(); const bg = B.getContext('2d'); bg.fillStyle = '#808080'; bg.fillRect(0, 0, N, N);
    paintMuscles(A.g, bg);
    m.userData.bump = B;
    const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.flipY = false; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4; return t; };
    m.map = tex(A.c, true); u.tMask.value = tex(M.c, false); u.tSkin.value = tex(K.c, false);
    m.bumpMap = tex(B, false); m.bumpScale = 3.2;
    // the inside of the (open) shorts hem is cloth, not skin: back faces take the trunks colour
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', 'if (!gl_FrontFacing) { diffuseColor.rgb = uBottoms * 0.95; }\n#include <color_fragment>'); };
    m.customProgramCacheKey = () => 'mkb-body';
    m.needsUpdate = true;
    void skinLum;
  }
}


// The shipped athlete wears a loose tank top, so his trunk is roomy and boxy. Pull the trunk vertices in towards the spine axis (waist most,
// chest least, weighted by how much of the vertex follows the trunk bones so the shoulders and hips blend), which turns the vest volume into
// a lean athletic V-taper.
function slimTorso(human) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const wp = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const yP = wp('Pelvis').y, yN = wp('Neck').y, cx = wp('Spine').x, cz = wp('Spine').z;
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.slim) return;
    const geo = o.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!si || !sw) return;
    const names = o.skeleton.bones.map((bn) => bn.name);
    const trunk = new Set(names.map((n, i) => (/_(Pelvis|Spine|Spine1|Spine2)$/.test(n) ? i : -1)).filter((i) => i >= 0));
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const out = new Float32Array(pos.count * 3);
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      let w = 0; for (let k = 0; k < 4; k++) if (trunk.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
      if (w > 0.01) {
        const wv = v.clone().applyMatrix4(o.matrixWorld);
        const t = clamp((wv.y - yP) / (yN - yP), 0, 1.1);
        const st = t * t * (3 - 2 * t);
        const fx = 0.80 + 0.17 * Math.min(1, st * 1.25), fz = 0.84 + 0.1 * Math.min(1, st * 1.25);
        wv.x = cx + (wv.x - cx) * (1 - (1 - fx) * w); wv.z = cz + (wv.z - cz) * (1 - (1 - fz) * w);
        v.copy(wv.applyMatrix4(inv));
      }
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
    geo.computeVertexNormals();
    geo.userData.slim = true;
  });
}

// Muscle volume on the low-poly body: radial profiles along the arm, thigh and calf segments (deltoid, biceps, forearm, quad, calf), a
// tightened thigh where the shorts used to flare, and chest / lat mass on the trunk. Works in the rest pose, like slimTorso().
function shapeBody(human) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const P = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const prof = (pts, t) => { for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], u = (t - a[0]) / (b[0] - a[0] || 1); return a[1] + (b[1] - a[1]) * u * u * (3 - 2 * u); } return pts[pts.length - 1][1]; };
  const SEG = {};
  for (const s of ['L', 'R']) {
    SEG[`${s}_UpperArm`] = [`${s}_Forearm`, [[0, 1.08], [0.15, 1.2], [0.35, 1.2], [0.6, 1.12], [0.82, 1.0], [1, 0.94]]];
    SEG[`${s}_Forearm`] = [`${s}_Hand`, [[0, 1.08], [0.25, 1.2], [0.6, 1.04], [1, 0.88]]];
    SEG[`${s}_Thigh`] = [`${s}_Calf`, [[0, 1], [0.35, 1.0], [0.6, 1.12], [0.85, 1.06], [1, 0.95]], [[0, 0.105], [0.45, 0.098], [1, 0.09]]];
    SEG[`${s}_Calf`] = [`${s}_Foot`, [[0, 0.95], [0.3, 1.2], [0.65, 1.0], [1, 0.8]]];
  }
  const ends = {};
  for (const k in SEG) ends[k] = { a: P(k), b: P(SEG[k][0]) };
  const wp = (n) => P(n);
  const yP = wp('Pelvis').y, yN = wp('Neck').y, cx = wp('Spine').x;
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.userData.shaped) return;
    const geo = o.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
    if (!si || !sw) return;
    const names = o.skeleton.bones.map((bn) => bn.name.replace('Bip01_', ''));
    const trunk = new Set(names.map((n, i) => (/^(Pelvis|Spine|Spine1|Spine2)$/.test(n) ? i : -1)).filter((i) => i >= 0));
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const out = new Float32Array(pos.count * 3);
    const v = new Vector3(), ab = new Vector3(), r = new Vector3();
    const uvs = geo.attributes.uv;
    const inShorts = (i) => { if (!uvs) return false; const u = uvs.getX(i) * 1024, vv = uvs.getY(i) * 1024; return (u < 318 || u > 712) && vv > 100 && vv < 214; };
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
      // dominant segment
      const wsum = {}; let wt = 0;
      for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (!w) continue; const n = names[si.getComponent(i, k)]; if (SEG[n]) wsum[n] = (wsum[n] || 0) + w; if (trunk.has(si.getComponent(i, k))) wt += w; }
      let best = null, bw = 0; for (const n in wsum) if (wsum[n] > bw) { bw = wsum[n]; best = n; }
      if (best && bw > 0.25) {
        const { a, b } = ends[best]; ab.copy(b).sub(a); const len2 = ab.lengthSq();
        const t = (v.clone().sub(a).dot(ab)) / len2, tc = clamp(t, 0, 1);
        r.copy(v).sub(a).addScaledVector(ab, -t);
        const f = prof(SEG[best][1], tc), k = 1 + (f - 1) * Math.min(1, bw);
        r.multiplyScalar(k);
        if (SEG[best][2] && inShorts(i)) { const lim = prof(SEG[best][2], tc), rl = r.length(); if (rl > lim) r.multiplyScalar(lim / rl); }   // the baggy shorts become a real thigh
        v.copy(a).addScaledVector(ab, t).add(r);
      }
      if (wt > 0.2) {
        // chest: forward mass over the pectorals, wider ribcage; lats out under the arms
        const t = clamp((v.y - yP) / (yN - yP), 0, 1.1), dx = v.x - cx;
        const chest = Math.exp(-((t - 0.66) ** 2) / 0.02) * wt;
        const pecs = Math.exp(-((Math.abs(dx) - 0.085) ** 2) / 0.0028);
        v.z += 0.026 * chest * pecs * (v.z > -0.01 ? 1 : 0.3);
        v.x = cx + dx * (1 + 0.1 * Math.exp(-((t - 0.55) ** 2) / 0.03) * wt);
        // trapezius ramp and shoulder cap: the vest's boxy yoke becomes a sloped neck-to-shoulder line with a rounded point of shoulder
        const dxa = Math.abs(dx), trap = Math.exp(-((dxa - 0.115) ** 2) / 0.0035) * Math.exp(-((t - 0.97) ** 2) / 0.012) * wt;
        v.y += 0.024 * trap;
        v.x += Math.sign(dx) * 0.012 * Math.exp(-((t - 0.9) ** 2) / 0.01) * Math.exp(-((dxa - 0.17) ** 2) / 0.004) * wt;
        // abdominal mass sits slightly forward of the waist, hip crest narrows
        v.z += 0.012 * Math.exp(-((t - 0.3) ** 2) / 0.02) * wt * Math.exp(-(dx * dx) / 0.004);
      }
      v.applyMatrix4(inv);
      out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(out, 3));
    geo.computeVertexNormals();
    geo.userData.shaped = true;
  });
}


// Shoulder girdle: the shipped mesh is a vest with sleeves (a boxy yoke with a stick arm inserted), which pinches at the armpit and has no
// deltoid or trapezius slope. These soft ellipsoids use the body's own skin material (UVs pointed at a clean patch of the arm) and are parented
// to the bones, so they follow every pose: deltoid cap on the upper arm, trapezius ramp and axilla fill on the trunk.
function addShoulders(human) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const body = human.mats.find((m) => m.userData.kind === 'body' && m.map);
  if (!body) return [];
  const P = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const out = [];
  // UV of the mid upper arm per side (so the volumes match the arm's own skin tone and lighting response)
  const uvOf = {};
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const geo = o.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, uv = geo.attributes.uv;
    if (!si || !uv) return;
    const names = o.skeleton.bones.map((bn) => bn.name);
    for (const s of ['L', 'R']) {
      const bi2 = names.indexOf(`Bip01_${s}_UpperArm`); if (bi2 < 0) continue;
      const a = P(`${s}_UpperArm`), b = P(`${s}_Forearm`), ab = b.clone().sub(a), l2 = ab.lengthSq();
      let su = 0, sv = 0, n = 0; const v = new Vector3();
      for (let i = 0; i < pos.count; i++) {
        let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === bi2) w += sw.getComponent(i, k);
        if (w < 0.95) continue;
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
        const t = v.clone().sub(a).dot(ab) / l2; if (t < 0.3 || t > 0.6) continue;
        su += uv.getX(i); sv += uv.getY(i); n++;
      }
      if (n) uvOf[s] = [su / n, sv / n];
    }
  });
  const ell = (side, boneName, c, axis, rad, uvSide) => {
    const geo = new THREE.SphereGeometry(1, 28, 18);
    const u = (uvOf[uvSide] || uvOf.L || uvOf.R || [0.15, 0.63]);
    const uvs = new Float32Array(geo.attributes.position.count * 2); for (let i = 0; i < uvs.length; i += 2) { uvs[i] = u[0]; uvs[i + 1] = u[1]; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    const m = new THREE.Mesh(geo, body); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    m.scale.set(rad[0], rad[1], rad[2]);
    const bone = human.bones[`Bip01_${boneName}`];
    const bq = bone.getWorldQuaternion(new Quaternion()).invert();
    const wq = new Quaternion().setFromUnitVectors(Y_AXIS, axis.clone().normalize());
    m.quaternion.copy(bq.multiply(wq));
    m.position.copy(c.clone().sub(bone.getWorldPosition(new Vector3())).applyQuaternion(human.bones[`Bip01_${boneName}`].getWorldQuaternion(new Quaternion()).invert()));
    bone.add(m); out.push(m); return m;
  };
  const neck = P('Neck');
  for (const s of ['L', 'R']) {
    const S = P(`${s}_UpperArm`), E = P(`${s}_Forearm`), a = E.clone().sub(S), L = a.length(), an = a.clone().normalize();
    // deltoid: a long cap over the head of the humerus, a little proud of the arm line on the outside/top
    ell(s, `${s}_UpperArm`, S.clone().addScaledVector(an, L * 0.2).add(new Vector3(0, 0.012, 0.0)), an, [0.062, L * 0.34, 0.058], s);
    // joint ball: closes the seam between the arm and the trunk
    ell(s, `${s}_UpperArm`, S.clone().addScaledVector(an, -0.012), an, [0.058, 0.058, 0.056], s);
    // trapezius ramp from the neck base to the point of the shoulder (parented to the upper trunk, so it stays when the arm goes overhead)
    const T = S.clone().sub(neck), tl = T.length();
    ell(s, 'Spine2', neck.clone().addScaledVector(T, 0.5).add(new Vector3(0, 0.018, -0.012)), T, [0.036, tl * 0.56, 0.062], s);
    // axilla / lat fill: the armpit is a fold of the trunk, not a gap between a box and a stick
    ell(s, 'Spine2', S.clone().add(new Vector3(Math.sign(neck.x - S.x) * 0.035, -0.09, -0.015)), new Vector3(0, 1, 0), [0.052, 0.1, 0.06], s);
  }
  return out;
}

// The anatomy pass (see anatomy.js): a private, subdivided copy of the body geometry with a sculpted shoulder girdle, diffused girdle
// weights and a non-shrinking smoothing. The shared geometry (the drummer uses it too) is left as it was.
function rebuildGirdle(human) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const J = {};
  for (const n of ['Neck', 'Spine2', 'L_Clavicle', 'R_Clavicle', 'L_UpperArm', 'R_UpperArm', 'L_Forearm', 'R_Forearm']) J[n] = human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  human.root.traverse((o) => {
    if (!o.isSkinnedMesh || o.material.userData.kind !== 'body' || o.userData.girdle) return;
    const geo = o.geometry.clone(); o.geometry = geo; o.userData.girdle = true;
    const M = o.matrixWorld.clone(), inv = M.clone().invert();
    const toWorld = (v) => v.applyMatrix4(M), toLocal = (v) => v.applyMatrix4(inv);
    const names = o.skeleton.bones.map((b) => b.name);
    subdivide(geo);
    sculptShoulders(geo, toWorld, toLocal, J);
    smoothWeights(geo, names, toWorld, J);
    const hand = new Set(names.map((n, i) => (/(Hand|Finger)/.test(n) ? i : -1)).filter((i) => i >= 0));
    const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    relax(geo, (i) => { let w = 0; for (let k = 0; k < 4; k++) if (hand.has(SI.getComponent(i, k))) w += SW.getComponent(i, k); return w > 0.25; }, 3);
    weldedNormals(geo);
    geo.computeBoundingSphere();
  });
}

// Bare feet from simple shapes (heel and arch, ball, five toes) in the person's skin colour, parented to the foot bones.
function addFeet(human, hex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  // Skin: the body's OWN material with every vertex's UV pointed at a patch of the calf, so the feet and ankles take exactly the leg's tone,
  // texture response and lighting (a separate flat colour reads orange next to the leg). Falls back to a plain colour without the texture.
  const body = human.mats.find((m) => m.userData.kind === 'body' && m.map);
  const uvOf = {};
  if (body) human.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const geo = o.geometry, pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight, uv = geo.attributes.uv;
    if (!si || !uv) return;
    const names = o.skeleton.bones.map((bn) => bn.name);
    for (const s of ['L', 'R']) {
      const ci = names.indexOf(`Bip01_${s}_Calf`); if (ci < 0) continue;
      const a = human.bones[`Bip01_${s}_Calf`].getWorldPosition(new Vector3()), b = human.bones[`Bip01_${s}_Foot`].getWorldPosition(new Vector3()), ab = b.clone().sub(a), l2 = ab.lengthSq();
      let su = 0, sv = 0, n = 0; const v = new Vector3();
      for (let i = 0; i < pos.count; i++) {
        let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === ci) w += sw.getComponent(i, k);
        if (w < 0.95) continue;
        v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld);
        const t = v.clone().sub(a).dot(ab) / l2; if (t < 0.3 || t > 0.62) continue;
        su += uv.getX(i); sv += uv.getY(i); n++;
      }
      if (n) uvOf[s] = [su / n, sv / n];
    }
  });
  const flat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.75, metalness: 0 });
  const mat = body && uvOf.L ? body : flat, toeMat = mat;
  const paintUV = (geo, side) => {
    if (mat === flat) return geo;
    const u = uvOf[side] || uvOf.L, n = geo.attributes.position.count, a = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { a[i * 2] = u[0]; a[i * 2 + 1] = u[1]; }
    geo.setAttribute('uv', new THREE.BufferAttribute(a, 2)); return geo;
  };
  const sph = new THREE.SphereGeometry(1, 16, 12);
  for (const side of ['L', 'R']) {
    const fb = human.bones[`Bip01_${side}_Foot`], tb = human.bones[`Bip01_${side}_Toe0`];
    const fr = human._sole[side];
    const upV = fr.up.clone().normalize(), fwdV = fr.fwd.clone().normalize();
    fwdV.addScaledVector(upV, -fwdV.dot(upV)).normalize();
    const leftV = upV.clone().cross(fwdV).normalize();
    const g = new THREE.Group(); g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(leftV, upV, fwdV));
    const add = (geo, m, p, sc) => { const o = new THREE.Mesh(m === mat ? paintUV(geo.clone(), side) : geo, m); o.position.set(p[0], p[1], p[2]); o.scale.set(sc[0], sc[1], sc[2]); g.add(o); return o; };
    // metres, in the foot frame: x left, y up, z forward; the ankle is the origin and the sole is 0.10 m below it, the ball of the foot 0.136 m ahead.
    // A lofted foot (heel, raised arch, ball, toe box) rather than blobs, then five toes with nails.
    const sect = [[-0.052, 0.022, -0.03, -0.084], [-0.026, 0.029, 0.0, -0.098], [0.02, 0.036, -0.02, -0.094], [0.07, 0.042, -0.05, -0.1], [0.11, 0.049, -0.068, -0.1015], [0.135, 0.0495, -0.076, -0.1015], [0.152, 0.046, -0.08, -0.098]];
    const SEGS = 18, pos = [], idx = [];
    sect.forEach(([z, hw, top, bot]) => { const cy = (top + bot) / 2, hh = (top - bot) / 2; for (let i = 0; i < SEGS; i++) { const a = (i / SEGS) * Math.PI * 2; pos.push(Math.cos(a) * hw, cy + Math.sin(a) * hh, z); } });
    for (let s = 0; s < sect.length - 1; s++) for (let i = 0; i < SEGS; i++) { const a0 = s * SEGS + i, a1 = s * SEGS + (i + 1) % SEGS, b0 = a0 + SEGS, b1 = a1 + SEGS; idx.push(a0, a1, b0, a1, b1, b0); }
    const cap = (s, flip) => { const c = pos.length / 3; pos.push(0, (sect[s][2] + sect[s][3]) / 2, sect[s][0] + (flip ? 0.012 : -0.012)); for (let i = 0; i < SEGS; i++) { const a0 = s * SEGS + i, a1 = s * SEGS + (i + 1) % SEGS; idx.push(c, flip ? a0 : a1, flip ? a1 : a0); } };
    cap(0, false); cap(sect.length - 1, true);
    // ankle: a short tapered column that continues the calf into the foot (instead of a ball), plus the two malleoli as faint bumps
    add(sph, mat, [0, -0.01, -0.014], [0.03, 0.052, 0.034]);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); fg.setIndex(idx); fg.computeVertexNormals(); paintUV(fg, side);
    const foot = new THREE.Mesh(fg, mat); foot.castShadow = true; g.add(foot);
    const nailMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(hex).lerp(new THREE.Color('#f0d8c8'), 0.45), roughness: 0.35, metalness: 0 });
    const medial = side === 'L' ? -1 : 1;                              // the big toe is on the inner side
    // five separate toes: ellipsoids that start inside the ball of the foot and fan out, the big toe the longest, each with a nail
    const R = [0.0155, 0.0125, 0.0115, 0.0105, 0.0095], X = [0.034, 0.0155, -0.0025, -0.0205, -0.0375], TIP = [0.215, 0.2, 0.19, 0.178, 0.164], Z0 = 0.12;
    R.forEach((r, i) => {
      const hl = (TIP[i] - Z0) / 2, zc = Z0 + hl, x = medial * X[i], splay = medial * (i - 1) * 0.012;
      const toe = add(sph, toeMat, [x + splay * 0.5, -0.0895, zc], [r, r * 0.78, hl]); toe.castShadow = true;
      add(sph, nailMat, [x + splay * 0.5 + splay * 0.0, -0.0805, TIP[i] - r * 1.1], [r * 0.62, r * 0.18, r * 0.95]);
    });
    fb.add(g);
    g.position.set(0, 0, 0);
  }
  return [mat, toeMat];
}


// Waist sash (a wrapped band with a knot and two tails at the hip) and the headband, parented to the bones so they follow every pose.
function addCostume(human, sashHex, bandHex) {
  human._applyRest(); human.root.updateMatrixWorld(true);
  const mat = new THREE.MeshStandardMaterial({ color: sashHex, roughness: 0.6, metalness: 0, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(sashHex).multiplyScalar(0.6), roughness: 0.7, metalness: 0 });
  const band = new THREE.MeshStandardMaterial({ color: bandHex, roughness: 0.6, metalness: 0 });
  const wp = (n) => human.bones[`Bip01_${n}`].getWorldPosition(new Vector3());
  const attach = (bone, obj, worldPos) => {
    const b = human.bones[`Bip01_${bone}`];
    const inv = b.getWorldQuaternion(new Quaternion()).invert();
    obj.quaternion.copy(inv);
    obj.position.copy(worldPos.clone().sub(b.getWorldPosition(new Vector3())).applyQuaternion(inv));
    b.add(obj);
  };
  const pel = wp('Pelvis'), sp = wp('Spine');
  // langot: a white wrapped waist cloth (two twisted turns, a knot on the left hip, two tails with folds) over red trunks
  const cloth = new THREE.MeshStandardMaterial({ color: 0xf1ead9, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, bumpMap: new THREE.CanvasTexture(clothBump()), bumpScale: 1.4 });
  cloth.bumpMap.wrapS = cloth.bumpMap.wrapT = THREE.RepeatWrapping; cloth.bumpMap.repeat.set(3, 1);
  const wrap = new THREE.Group();
  const turn = (ry, rz, h, tilt, y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 40, 1, true), cloth); m.scale.set(ry, 1, rz); m.rotation.z = tilt; m.position.y = y; m.castShadow = true; return m; };
  wrap.add(turn(0.172, 0.138, 0.075, 0.0, 0.0), turn(0.178, 0.144, 0.05, 0.1, -0.04));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 14, 10), cloth); knot.scale.set(1.1, 0.8, 0.9); knot.position.set(0.18, -0.02, 0.05); wrap.add(knot);
  // the tails and the apron are simulated cloth (see cloth.js); the wrap only carries their anchor points
  const anchors = { apron: [], back: [], tailA: [], tailB: [] };
  const mk = (list, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); wrap.add(o); list.push((out) => o.getWorldPosition(out)); };
  const ez = (x) => 0.138 * Math.sqrt(Math.max(0.05, 1 - (x / 0.172) ** 2)) + 0.012;
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.047; mk(anchors.apron, x, -0.035, ez(x)); }
  for (let i = 0; i < 4; i++) { const x = (i - 1.5) * 0.05; mk(anchors.back, x, -0.035, -ez(x)); }
  for (let i = 0; i < 3; i++) { mk(anchors.tailA, 0.185 + (i - 1) * 0.03, -0.035, 0.07 + (i - 1) * 0.01); mk(anchors.tailB, 0.19 + (i - 1) * 0.028, -0.045, 0.04 + (i - 1) * 0.012); }
  attach('Spine', wrap, new Vector3(pel.x, pel.y + (sp.y - pel.y) * 0.5 + 0.02, pel.z));
  // headband: a cloth strip round the forehead (an ellipse that follows the skull), knotted at the back with two short tails
  const hd = wp('Head');
  const hb = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0115, 10, 40), band); hb.rotation.x = Math.PI / 2; hb.scale.set(0.86, 1.04, 1.0);
  const hg = new THREE.Group(); hg.add(hb);
  const bk = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), band); bk.position.set(0.0, 0, -0.123); hg.add(bk);
  for (const s of [-1, 1]) { const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.14), band); tl.position.set(s * 0.02, -0.07, -0.14); tl.rotation.set(0.25, s * 0.25, 0); tl.material = band.clone(); tl.material.side = THREE.DoubleSide; hg.add(tl); }
  attach('Head', hg, new Vector3(hd.x, hd.y + 0.15, hd.z + 0.012));
  return { wrap, hg, mats: [mat, dark, band], anchors };
}


// ---------------------------------------------------------------------------------------------------------------------------------
// The langot cloth: front apron, back panel and two knot tails as verlet cloth, kept off the legs and trunk by capsules.
function clothTexture() {
  const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#f3ecdb'; g.fillRect(0, 0, 128, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = `rgba(120,100,70,${0.05 + (y % 4) * 0.015})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = `rgba(120,100,70,${0.04 + (x % 4) * 0.012})`; g.fillRect(x, 0, 1, 256); }
  g.fillStyle = '#e08a1e'; g.fillRect(0, 232, 128, 10); g.fillRect(0, 246, 128, 4);       // saffron hem bands
  g.fillStyle = '#b3262a'; g.fillRect(0, 242, 128, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function buildLangot(human, stage, costume) {
  const tex = clothTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0, side: THREE.DoubleSide, emissive: 0x2c2822, bumpMap: new THREE.CanvasTexture(clothBump()), bumpScale: 1.2 });
  mat.bumpMap.wrapS = mat.bumpMap.wrapT = THREE.RepeatWrapping;
  const A = costume.anchors;
  const cloths = [
    new Cloth({ cols: 5, rows: 7, width: 0.188, length: 0.30, anchors: A.apron, material: mat, taper: 0.78, mass: 0.8 }),
    new Cloth({ cols: 4, rows: 5, width: 0.15, length: 0.2, anchors: A.back, material: mat, taper: 0.85, mass: 0.8 }),
    new Cloth({ cols: 3, rows: 8, width: 0.06, length: 0.26, anchors: A.tailA, material: mat, mass: 0.9 }),
    new Cloth({ cols: 3, rows: 7, width: 0.055, length: 0.21, anchors: A.tailB, material: mat, mass: 0.9 }),
  ];
  for (const c of cloths) stage.scene.add(c.mesh);
  const B = (n) => human.bones[`Bip01_${n}`];
  const wp = (n) => B(n).getWorldPosition(new Vector3());
  const cols = [];
  const gravity = new Vector3(0, -9.8, 0), wind = new Vector3();
  const api = {
    cloths, mat,
    setVisible(v) { for (const c of cloths) c.mesh.visible = v; },
    step(dt, t, settle) {
      human.root.updateMatrixWorld(true);
      cols.length = 0;
      const pel = wp('Pelvis'), sp = wp('Spine'), sp2 = wp('Spine2'), neck = wp('Neck');
      cols.push({ a: pel.clone().lerp(sp, 0.1), b: sp, r: 0.15 }, { a: sp, b: neck, r: 0.14 });
      for (const s of ['L', 'R']) {
        const th = wp(`${s}_Thigh`), ca = wp(`${s}_Calf`), ft = wp(`${s}_Foot`);
        cols.push({ a: th, b: ca, r: 0.1 }, { a: ca, b: ft, r: 0.066 });
      }
      void sp2;
      wind.set(Math.sin(t * 1.7) * 0.5, 0.15 * Math.sin(t * 2.9), 0.6 + Math.cos(t * 1.1) * 0.5);
      if (settle) { for (const c of cloths) { c.reset(gravity); for (let i = 0; i < 30; i++) c.step(1 / 60, gravity, cols, wind); } return; }
      if (dt <= 0) return;
      for (const c of cloths) c.step(Math.min(dt, 1 / 30), gravity, cols, wind);
    },
    reset() { for (const c of cloths) c.ready = false; },
  };
  return api;
}

// ---------------------------------------------------------------------------------------------------------------------------------
export async function createPerformer({ quality = 'medium', base } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1.5, transparent: true, shadows: quality !== 'low', lighting: 'evening', fov: 12, shadowSize: 2.6 });
  if (!stage.supported) return null;
  const human = await loadHuman({ character: 'athlete_m', base, kit: { top: '#ffffff', bottoms: '#b3262a', socks: '#c4875a' }, skin: '#c98a5b', hair: 'black' });
  bareBody(human);
  slimTorso(human);
  shapeBody(human);
  rebuildGirdle(human);
  const shoulders = [];
  const footMats = addFeet(human, '#c48658');
  const costume = addCostume(human, '#f1ead9', '#b3262a');
  human.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  stage.add(human); stage.track(human);
  const cloth = buildLangot(human, stage, costume);
  const world = buildWorld(stage, { quality });
  const api = { base, stage, human, quality, shoulders, footMats, costume, cloth, world, ok: true, lost: false, crowd: null, drummer: null, crowdKey: '' };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; });
  Object.assign(api, makeApi(api));
  // the onlookers (crowd3d) are laid out for the current view width in drawScene; the drummer loads after the first frame is possible
  createDrummer({ stage, loadHuman, base, parent: world.root }).then((d) => { api.drummer = d; }).catch((e) => { console.warn('drummer unavailable', e); });
  return api;
}

const GRIP = { curl: [[0.7, 0.8, 0.4], [1.0, 1.25, 0.8], [1.05, 1.3, 0.85], [1.1, 1.35, 0.9], [1.1, 1.35, 0.9]], spread: [0, 0, 0, 0, 0] };
const Y_AXIS = new Vector3(0, 1, 0);
const Z_AXIS = new Vector3(0, 0, 1);
const X_AXIS = new Vector3(1, 0, 0);

function makeApi(api) {
  const { stage, human } = api;
  const cam = stage.camera, renderer = stage.renderer;
  human.groundClamp = 'off'; human.footPlanting = false;
  const clip = new Clip({ name: 'pose', frames: 1, dur: 1 / 30, fps: 30, loop: true, quats: new Float32Array(CLIP_BONES.length * 4), pelvis: new Float32Array(3), grounded: false, fingers: 'relaxed' });
  human.addClip(clip);
  human.play(clip, { fade: 0 });
  const restQ = new Float32Array(human.restPose.q);
  const e = new Euler(), qa = new Quaternion(), qb = new Quaternion();
  const ph = human.pelvisHeight;
  // metres per pole unit: the 2D torso (pelvis to neck) is RIG.torso units long
  human._applyRest(); human.root.updateMatrixWorld(true);
  const pelW = human.bones.Bip01_Pelvis.getWorldPosition(new Vector3()), neckW = human.bones.Bip01_Neck.getWorldPosition(new Vector3());
  const U = pelW.distanceTo(neckW) / RIG.torso * 1.04;
  api.U = U;

  function writePose(offs) {
    const q = clip.quats;
    q.set(restQ);
    for (const n in offs) {
      const i = bi(n); if (i < 0) continue;
      const r = semanticRot(`Bip01_${n}`, offs[n]);
      qa.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
      qb.setFromEuler(e.set(r[0] * D2R, r[1] * D2R, r[2] * D2R, 'XYZ'));
      qa.multiply(qb);
      q[i * 4] = qa.x; q[i * 4 + 1] = qa.y; q[i * 4 + 2] = qa.z; q[i * 4 + 3] = qa.w;
    }
    clip.pelvis[0] = 0; clip.pelvis[1] = 0; clip.pelvis[2] = 0;
  }

  const spinQ = new Quaternion(), rollQ = new Quaternion(), bodyQ = new Quaternion();
  const v = new Vector3(), v2 = new Vector3(), pole = new Vector3();
  const poleC = new Vector3(0, 0, POLE_Z);
  const reach = new Vector3(), elbow = new Vector3();

  // bend of a leg in degrees from the 2D rig: hip, ankle distance against thigh + shin
  const kneeBend = (h, f) => {
    const d = Math.hypot(f[0] - h[0], f[1] - h[1]);
    const c = clamp(d / (RIG.thigh + RIG.shin), 0.3, 1);
    return Math.acos(clamp((2 * c * c) - 1, -1, 1)) / D2R;            // interior bend of two equal segments
  };

  /** Pose the performer from the 2D rig's pose and advance the animation by dt. */
  // Critically damped springs on the 2D rig's targets: the sim and the clip spline can change direction or flip an elbow/knee side in one
  // frame; the body never follows a raw jump. Snap (dt = 0: thumbnails, stills, seeks).
  const SM = new Map();
  const damp = (key, target, st, dt) => {
    if (api.smoothing === false) return Array.from(target);
    let e = SM.get(key);
    const n = target.length;
    if (!e || dt <= 0 || e.x.length !== n) { e = { x: Array.from(target), v: new Array(n).fill(0) }; SM.set(key, e); return e.x; }
    const w = 2 / Math.max(0.01, st), x = w * dt, ex = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    for (let i = 0; i < n; i++) {
      const ch = e.x[i] - target[i], tmp = (e.v[i] + w * ch) * dt;
      e.v[i] = (e.v[i] - w * tmp) * ex; e.x[i] = target[i] + (ch + tmp) * ex;
    }
    return e.x;
  };
  // chalk: a soft white puff where a hand lands on the pole (hand speed collapses near the pole axis)
  const puffTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,250,0.95)'); gr.addColorStop(0.5, 'rgba(250,246,236,0.5)'); gr.addColorStop(1, 'rgba(250,246,236,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const puffs = [];
  for (let i = 0; i < 28; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, fog: false })); sp.visible = false; stage.scene.add(sp); puffs.push({ sp, age: 9, life: 1, v: new Vector3() }); }
  let puffI = 0;
  const handPrev = { L: null, R: null }, handFast = { L: 0, R: 0 };
  const emitPuff = (pos, n = 5) => {
    for (let k = 0; k < n; k++) {
      const p = puffs[puffI++ % puffs.length];
      p.age = 0; p.life = 0.55 + Math.random() * 0.45; p.sp.visible = true; p.sp.position.copy(pos);
      p.v.set((Math.random() - 0.5) * 0.5, 0.05 + Math.random() * 0.25, (Math.random() - 0.2) * 0.4); p.s0 = 0.04 + Math.random() * 0.04;
    }
  };
  const tickPuffs = (dt) => { for (const p of puffs) { if (p.age >= p.life) { p.sp.visible = false; continue; } p.age += dt; const u = p.age / p.life; p.sp.position.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.pow(0.2, dt)); const s = p.s0 + u * 0.22; p.sp.scale.set(s, s, 1); p.sp.material.opacity = 0.8 * (1 - u) * (1 - u); } };
  api.emitPuff = emitPuff;
  // speed limit for the hands and feet (m/s): a clip that sweeps a hand 2 m in a fifth of a second is followed at a speed a person can reach
  const lim = new Map();
  const speedLimit = (key, v, vmax, dt) => {
    if (!api.smoothing || dt <= 0) { lim.set(key, v.slice()); return v; }
    const prev = lim.get(key); if (!prev) { lim.set(key, v.slice()); return v; }
    const dx = v[0] - prev[0], dy = v[1] - prev[1], d = Math.hypot(dx, dy), maxd = vmax / U * dt;
    const out = d > maxd ? [prev[0] + dx / d * maxd, prev[1] + dy / d * maxd] : v.slice();
    lim.set(key, out); return out;
  };
  api.smoothing = !/[?&]nosmooth=1/.test(globalThis.location?.search || '');
  api.clock = 0;
  api.motion = null;       // dev: last smoothed joint set, for the smoothness probe
  api.pose = function (pose0, phi, dt, settle = false) {
    api.clock += dt;
    if (SM.has('p') && dt > 0 && Math.hypot(SM.get('p').x[0] - pose0.p[0], SM.get('p').x[1] - pose0.p[1]) > 140) dt = 0;   // seek: snap
    const sd = dt > 0 ? dt : 0;
    const pose = { ...pose0,
      p: damp('p', pose0.p, 0.05, sd).slice(), tor: damp('tor', [pose0.tor], 0.06, sd)[0], hd: damp('hd', [pose0.hd], 0.09, sd)[0],
      hl: speedLimit('hl', damp('hl', pose0.hl, 0.055, sd), 3.6, sd), hr: speedLimit('hr', damp('hr', pose0.hr, 0.055, sd), 3.6, sd),
      fl: speedLimit('fl', damp('fl', pose0.fl, 0.06, sd), 4.2, sd), fr: speedLimit('fr', damp('fr', pose0.fr, 0.06, sd), 4.2, sd) };
    const J0 = solve(pose, 0);
    // elbows / knees: the IK side flips discretely in the rig, so they get their own (slower) spring
    const J = { ...J0, elL: damp('elL', J0.elL, 0.08, sd).slice(), elR: damp('elR', J0.elR, 0.08, sd).slice(), knL: damp('knL', J0.knL, 0.08, sd).slice(), knR: damp('knR', J0.knR, 0.08, sd).slice() };
    api.motion = J;
    // effort: how hard the body is working (inverted, horizontal, legs lifted): drives breathing rate, muscle tremor and the jaw
    const lift = clamp((RIG.thigh + RIG.shin - Math.min(J.footL[1], J.footR[1])) / 120, 0, 1);
    const effort = clamp(Math.max(Math.abs(Math.sin(J.tr)) * 0.9, lift * 0.6, Math.abs(pose.p[0]) / 160), 0, 1);
    api.effort = effort;
    const tr = pose.tor * D2R;
    const P = (pt, z) => new Vector3(pt[0] * U, -pt[1] * U, z);
    const spin = (p) => p.sub(poleC).applyAxisAngle(Y_AXIS, -phi).add(poleC);
    // pelvis: the body plane is z = 0, the pole is behind it
    const pelW2 = spin(P(J.pelvis, 0));
    spinQ.setFromAxisAngle(Y_AXIS, -phi);
    rollQ.setFromAxisAngle(Z_AXIS, -tr);
    bodyQ.copy(spinQ).multiply(rollQ);
    human.root.quaternion.copy(bodyQ);
    human.facing = -phi;
    v.set(0, ph, 0).applyQuaternion(bodyQ);
    human.root.position.copy(pelW2).sub(v);

    const offs = {};
    // knees: pre-bend so the IK plane points forward
    const bl = kneeBend(J.hl, J.footL), br = kneeBend(J.hr, J.footR);
    offs.R_Thigh = { flex: bl * 0.5 + 6 }; offs.R_Calf = { flex: bl + 6 };      // the 2D "left" limbs are the person's right (facing the camera)
    offs.L_Thigh = { flex: br * 0.5 + 6 }; offs.L_Calf = { flex: br + 6 };
    // head tilt follows the 2D head angle relative to the torso
    offs.Neck = { side: pose.hd * 0.5 }; offs.Head = { side: pose.hd * 0.5 };
    // slight arm hang so the elbows are not locked in the T-pose
    offs.R_UpperArm = { flex: 0 }; offs.L_UpperArm = { flex: 0 };
    // breathing: slow when relaxed, quicker and deeper under load; rib cage lifts, shoulders rise a touch, the head follows by a hair
    api._bph = (api._bph || 0) + sd * 2 * Math.PI * (0.28 + effort * 0.4);
    const bph = api._bph;
    const brt = Math.sin(bph) * (0.8 + effort * 1.1);
    offs.Spine1 = { flex: -brt * 0.9 }; offs.Spine2 = { flex: -brt * 0.7 };
    // scapulohumeral rhythm: the shoulder girdle lifts and turns with a raised upper arm (elbow above the shoulder line) (a hinge at a fixed shoulder reads as a puppet)
    const elev = (hand, sh) => {
      const dx = hand[0] - sh[0], dy = hand[1] - sh[1], l = Math.hypot(dx, dy) || 1;
      return Math.acos(clamp((dx * -Math.sin(J.tr) + dy * Math.cos(J.tr)) / l, -1, 1)) / D2R;
    };
    const [liftR, liftL] = damp('clav', [clavicleLift(elev(J.elL, J.sl)), clavicleLift(elev(J.elR, J.sr))], 0.1, sd);   // the 2D "left" limbs are the person's right
    api.clavLift = [liftL, liftR];
    offs.L_Clavicle = { rot: [0, -liftL, brt * 0.9 - liftL * 0.25] }; offs.R_Clavicle = { rot: [0, liftR, brt * 0.9 - liftR * 0.25] };
    // muscle tension: a fine 8-10 Hz tremor in the neck and trunk that grows with effort
    const tm = api.clock, tr2 = effort * effort;
    offs.Neck.side += Math.sin(tm * 53) * 0.5 * tr2 + Math.sin(tm * 37) * 0.35 * tr2;
    offs.Spine = { twist: Math.sin(tm * 47) * 0.45 * tr2, side: Math.sin(tm * 61) * 0.35 * tr2 };
    if (api.dbgOffs) for (const k in api.dbgOffs) offs[k] = { ...(offs[k] || {}), ...api.dbgOffs[k] };
    writePose(offs);

    // depth of the targets: against the pole when close to its axis (smooth blend, not a switch), free otherwise
    const sstep = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
    const footZ = (f) => { const w = (1 - sstep(30, 70, Math.abs(f[0]))) * (1 - sstep(RIG.thigh + RIG.shin - 30, RIG.thigh + RIG.shin - 8, f[1])); return 0.02 + (POLE_Z + POLE_R + 0.035 - 0.02) * w; };
    const side = [['R', J.footL, J.hl, J.knL], ['L', J.footR, J.hr, J.knR]];
    const fwdW = v2.set(0, 0, 1).applyQuaternion(bodyQ).clone();
    const footTargets = {};
    // The foot is oriented from the shin, not from a fixed rest rotation: flat = the sole square to the shin with the toes toward the body's
    // front; raised feet are pointed (plantar flexion) by rotating the toes along the shin, the sole normal turning with them. So legs that
    // are lifted, rolled or wrapped round the pole always carry a foot that continues the leg the way a real ankle does.
    const footQ = (s, shin, f) => {
      const sh = shin.clone(); if (sh.lengthSq() < 1e-6) sh.set(0, -1, 0); sh.normalize();
      const t0 = fwdW.clone().addScaledVector(sh, -fwdW.dot(sh)); if (t0.lengthSq() < 1e-4) t0.set(0, 0, 1).addScaledVector(sh, -sh.z); t0.normalize();
      const pf = clamp((RIG.thigh + RIG.shin - 4 - f[1]) / 70, 0, 1) * 52 * D2R;
      const tw = t0.clone().multiplyScalar(Math.cos(pf)).addScaledVector(sh, Math.sin(pf)).normalize();
      const nw = sh.clone().multiplyScalar(Math.cos(pf)).addScaledVector(t0, -Math.sin(pf)).normalize();
      return footQuat(human, s, nw, tw, 'sole');
    };
    for (const [s, f, hip, kn] of side) {
      const fz = footZ(f);
      reach.copy(spin(P(f, fz)));
      if (effort > 0.25) reach.x += Math.sin(api.clock * 57 + (s === 'R' ? 0 : 2)) * 0.0035 * effort * effort;
      const knW = spin(P(kn, fz * 0.5));
      footTargets[s] = { p: reach.clone(), f };
      human.setReachFoot(s, reach, 1, footQ(s, reach.clone().sub(knW), f));
    }
    // hands: gripping the pole when they are near its axis, free in the air otherwise (blend by distance from the axis)
    const arms = [['R', J.handL, J.elL], ['L', J.handR, J.elR]];
    for (const [s, h, el] of arms) {
      const nw = 1 - sstep(16, 40, Math.abs(h[0]));
      reach.copy(spin(P(h, 0.1 + (POLE_Z + POLE_R + 0.028 - 0.1) * nw)));
      // Elbow pole: the 2D rig's elbow side flips discretely between clips and the solver's bend plane flips with it (a one-frame 40 cm elbow
      // jump). A real elbow points away from the trunk and toward the feet whatever the hand does, so the pole is a fixed body-frame direction
      // (outward + toward the pelvis + a little forward), identical every frame; the shoulder-hand distance never reaches zero because the hand
      // grips the pole 7 cm in front of... behind the body plane.
      const sh = s === 'R' ? J.sl : J.sr, so = s === 'R' ? -1 : 1;
      const ux = Math.sin(J.tr), uy = -Math.cos(J.tr);              // pelvis -> neck in the pole plane
      const eo = [sh[0] + so * Math.cos(J.tr) * 34 - ux * 30, sh[1] + so * Math.sin(J.tr) * 34 - uy * 30];
      elbow.copy(spin(P(eo, 0.16 + (0.1 - 0.16) * nw)));
      // Pole grip: the wrist sits on a circle round the pole axis, the palm faces the axis and the fingers run along it, so the fingers
      // (curled by GRIP, thumb opposing the four) wrap the pole instead of balling beside it.
      let hq = null;
      if (nw > 0.02) {
        const dx = poleC.x - reach.x, dz = poleC.z - reach.z, dl = Math.hypot(dx, dz) || 1;
        const nrm = v.set(dx / dl, 0, dz / dl).clone();
        const onPole = new Vector3(poleC.x - nrm.x * (POLE_R + 0.048), reach.y, poleC.z - nrm.z * (POLE_R + 0.048));
        reach.lerp(onPole, nw);
        const fx = new Vector3(0, 1, 0).addScaledVector(new Vector3(-nrm.z, 0, nrm.x), (s === 'R' ? 1 : -1) * 0.35);
        hq = handQuat(human, s, nrm, fx);
      }
      human.setReach(s, reach, { weight: 1, pole: elbow, quat: hq });
      human.setFingers(s, nw > 0.5 ? GRIP : 'relaxed');
    }
    human.update(dt);
    // second pass: the solved shin (not the 2D rig's knee) decides how the foot continues the leg
    for (const s of ['R', 'L']) {
      const ft = footTargets[s]; if (!ft) continue;
      const c = human.bones[`Bip01_${s}_Calf`].getWorldPosition(v), fo = human.bones[`Bip01_${s}_Foot`].getWorldPosition(v2);
      human.setReachFoot(s, ft.p, 1, footQ(s, fo.clone().sub(c), ft.f));
    }
    human.update(0);
    api.cloth.step(dt, api.clock, settle || !api.cloth.cloths[0].ready);
    // chalk puffs: a hand that was moving fast and has come to rest on the pole
    if (dt > 0) {
      for (const s of ['L', 'R']) {
        const hw = human.bones[`Bip01_${s}_Hand`].getWorldPosition(v);
        const pv = handPrev[s]; const sp = pv ? hw.distanceTo(pv) / dt : 0;
        if (pv) pv.copy(hw); else handPrev[s] = hw.clone();
        const onPole = Math.abs(hw.x - poleC.x) < 0.14 && Math.abs(hw.z - poleC.z) < 0.2;
        if (sp > 0.9) handFast[s] = 0.25; else handFast[s] = Math.max(0, handFast[s] - dt);
        if (onPole && sp < 0.35 && handFast[s] > 0) { handFast[s] = 0; emitPuff(hw.clone().add(new Vector3(0, 0, 0.05)), 4); }
      }
      tickPuffs(dt);
    }
  };

  let lastT = null;
  const cost = { ema: 0, n: 0, low: false };      // frame-cost guard: if the 3D picture stays expensive, drop to the cheap tier once
  const BUDGET = { low: 700000, medium: 1500000, high: 2600000 };
  const { world } = api;
  const FOG = new THREE.Color(0x2a1430);
  let sceneInit = false;
  const still = { key: '', c: null };
  const initLights = () => {
    if (sceneInit) return; sceneInit = true;
    const L = stage.lights;
    stage._shadowOffset.set(-3.4, 5.0, 6.2);
    L.hemi.color.set(0x7a5a9a); L.hemi.groundColor.set(0x4a2a1c); L.hemi.intensity = 0.45;
    L.key.color.set(0xffd2a0); L.key.intensity = 3.4;
    L.rim.color.set(0xff9a5c); L.rim.intensity = 1.8;
    stage.scene.environmentIntensity = 0.12;
    renderer.toneMappingExposure = 0.95;
    stage.scene.fog = new THREE.Fog(FOG, 12, 44);
    stage.scene.background = null;
    stage.setShadowTarget(0, 0.3, POLE_Z + 0.1);
  };
  // onlookers: real athlete-mesh people (the same quality as the performer and the drummer), three rows, spread over the visible width
  const POOL = { men: [], loading: false };
  const loadPool = async () => {
    if (POOL.loading) return; POOL.loading = true;
    const tops = ['#e8e0cc', '#8a6a1c', '#1f4f52', '#7a2a2a', '#d8cfb8', '#2b3a68', '#a8541c', '#3d5428', '#f1ece0', '#6e2a58'];
    const bots = ['#e9e2d0', '#2c201b', '#4a3c30', '#1e2a3c', '#f1ece0'];
    const skins = ['#c98a5b', '#b07040', '#d9a070', '#8a5530', '#a8643a'];
    for (let i = 0; i < 16; i++) {
      const h = await loadHuman({ character: 'athlete_m', base: api.base, kit: { top: tops[(i * 3) % tops.length], bottoms: bots[i % bots.length], socks: '#4a3c30' }, skin: skins[(i * 2) % skins.length], hair: i % 5 === 4 ? 'grey' : 'black' });
      h.groundClamp = 'feet'; h.footPlanting = false;
      h.root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; o.frustumCulled = false; } });
      h.play(i % 3 === 0 ? 'idle_relaxed' : 'idle', { loop: true });
      stage.add(h); world.root.add(h.root); h.root.visible = false;
      POOL.men.push({ h, ph: i * 1.7, clap: i % 2 === 0 });
    }
  };
  const layoutCrowd = (cam) => {
    const key = `${Math.round(cam.halfW * 20)}|${api.quality}`;
    if (api.crowdKey === key) return;
    api.crowdKey = key;
    loadPool().catch((e) => console.warn('crowd unavailable', e));
    const rows = [];
    [[-4.6, 0.0], [-6.4, 0.14]].forEach(([z, y], i) => {
      const vis = (cam.D - z) / cam.D, hw = cam.halfW * vis * 1.0 + 0.3;
      rows.push({ z, y, hw, n: Math.max(3, Math.min(8, Math.round(hw * 2 / 1.5))) });
    });
    api.crowdRows = rows;
  };
  let lastExcite = 0;
  const animateCrowd = (dt, excite, t) => {
    lastExcite = excite;
    const rows = api.crowdRows; if (!rows) return;
    let k = 0;
    const dm = api.drummer;
    for (const r of rows) for (let i = 0; i < r.n; i++) {
      const m = POOL.men[k++ % Math.max(1, POOL.men.length)]; if (!m) continue;
      const u = (i + 0.5) / r.n, x = -r.hw + u * 2 * r.hw + Math.sin(k * 3.1) * 0.25;
      if (Math.abs(x) < 0.55 && r.z > -5) { m.h.root.visible = false; continue; }          // keep the pit and the pole clear
      if (dm && Math.abs(x - camXDrum()) < 0.5 && r.z > -5) { m.h.root.visible = false; continue; }
      m.h.root.visible = true;
      m.h.setPosition(x, 0, r.z); m.h.setFacing(Math.atan2(-x * 0.25, 6 - r.z), { snap: true });
      m.h.root.position.y = r.y;
      m.h.update(dt);
    }
    for (let j = k; j < POOL.men.length; j++) POOL.men[j].h.root.visible = false;
  };
  const camXDrum = () => (api._drumX ?? 99);
  const setCrowdVisible = (v) => { for (const m of POOL.men) if (!v) m.h.root.visible = false; api._crowdOn = v; if (api.drummer) api.drummer.setVisible(v); };

  /**
   * Render the whole set (pole, pit, colonnade, crowd, lights) with the performer, into ctx at (0,0,w,h) in context units.
   * p: { x, y, k } where (x, y) is the screen position of the standing pelvis anchor and k screen units per pole unit;
   * pose, phi (spin about the pole), turn (pole rotation), climb (pole units), excite, pulse, t, raise (camera height above the anchor, m), show.
   */
  api.drawScene = function (ctx, w, h, p) {
    if (api.lost || stage.contextLost) return false;
    initLights();
    const skey = p.still ? `${p.minimal ? 'm' : ''}${w}x${h}|${p.x | 0},${p.y | 0},${p.k.toFixed(2)}|${p.show}|${api.quality}` : '';
    if (p.still && still.key === skey && still.c) { ctx.drawImage(still.c, 0, 0, w, h); return true; }
    const t0 = globalThis.performance.now();
    const m = ctx.getTransform();
    const scaleCtx = Math.hypot(m.a, m.b);
    const budget = BUDGET[api.quality] || BUDGET.medium;
    const s = Math.min(scaleCtx, Math.sqrt(budget / (w * h)));
    const devW = Math.max(64, Math.round(w * s)), devH = Math.max(64, Math.round(h * s));
    const dt = lastT === null || p.t === undefined ? 0 : clamp(p.t - lastT, 0, 0.1);
    if (p.t !== undefined) lastT = p.t;
    // performer
    if (p.show === false) { human.root.visible = false; api.cloth.setVisible(false); }
    else { human.root.visible = true; api.cloth.setVisible(true); api.pose(p.pose, p.phi || 0, dt); }
    // camera: pole units map linearly to screen units at the pole plane; the camera is raised and its lens shifted so the anchor stays put
    const D = p.D || 9, raise = p.raise ?? 0.85;
    const hM = h / p.k * U, wM = w / p.k * U;
    const cx = (w / 2 - p.x) / p.k * U, cy = -(h / 2 - p.y) / p.k * U;
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R;
    cam.aspect = devW / devH; cam.near = 1; cam.far = 90;
    cam.position.set(cx, cy + raise, D); cam.rotation.set(0, 0, 0);
    cam.setViewOffset(devW, devH, 0, Math.round(raise / hM * devH), devW, devH);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const camInfo = { cx, cy, halfW: wM / 2, halfH: hM / 2, D };
    // the set
    const climbM = (STANDING_PELVIS + (p.climb || 0)) * U;
    world.root.position.y = -climbM;
    world.pole.position.set(0, 0, POLE_Z);
    world.pole.rotation.y = -(p.turn || 0);
    layoutCrowd(camInfo);
    if (api.drummer) {
      const dm = api.drummer, vis = (D - 0.9) / D;
      api._drumX = camInfo.halfW * 0.8; dm.place(camInfo.halfW * 0.8, -1.5, -0.45);
      dm.update(dt, p.t || 0, p.pulse || 0, p.excite || 0);
    }
    world.layoutScreen({ ...camInfo, cy: cy + 0 }, p.t || 0, p.pulse || 0, p.excite || 0);
    world.cone.opacity = 0.06 + (p.excite || 0) * 0.08;
    for (const f of world.diyas || []) { const fl = 0.85 + 0.15 * Math.sin((p.t || 0) * 9 + f.userData.ph) * Math.sin((p.t || 0) * 5.3 + f.userData.ph * 2); f.scale.set(0.3 * fl, 0.38 * fl, 1); }
    if (!p.minimal) animateCrowd(dt, p.excite || 0, p.t || 0);
    const mini = !!p.minimal;
    // icon mode: no crowd or HUD furniture, but the lit arcade, the lamps and the bokeh stay (a real place, one subject)
    setCrowdVisible(!mini); world.root.visible = true; world.colon.visible = !mini;
    for (const o of world.diyaMeshes || []) o.visible = true;
    world.bd.visible = !mini; world.iconSky.visible = mini; world.screen.visible = true;
    for (const c of world.screen.children) if (c !== world.iconSky) c.visible = !(mini && c.isLine);
    if (mini) {
      const vis = (D + 30) / D; world.iconSky.position.set(cx, cy, -30); world.iconSky.scale.set(wM * vis * 1.6, hM * vis * 1.8, 1);
    }
    stage.scene.fog.color.set(mini ? 0x9a4a30 : FOG); stage.scene.fog.near = mini ? 7 : 12; stage.scene.fog.far = mini ? 34 : 44;
    stage._shadowOffset.set(mini ? -2.5 : -3.4, mini ? 3.2 : 5.0, mini ? 5.5 : 6.2);
    stage.lights.key.intensity = mini ? 2.6 : 3.4; stage.lights.rim.intensity = mini ? 5.0 : 1.8; stage.lights.hemi.intensity = mini ? 0.5 : 0.45;
    // the shadow box follows the performer (the set moves, the performer does not)
    stage.setShadowTarget(0, 0.2, POLE_Z + 0.1);
    renderer.setPixelRatio(1); renderer.setSize(devW, devH, false);
    renderer.setClearColor(0x120a24, 1);
    stage.render();
    ctx.drawImage(renderer.domElement, 0, 0, devW, devH, 0, 0, w, h);
    if (p.still) {
      if (!still.c) still.c = globalThis.document.createElement('canvas');
      still.c.width = devW; still.c.height = devH; still.c.getContext('2d').drawImage(renderer.domElement, 0, 0); still.key = skey;
    }
    const ms = globalThis.performance.now() - t0;
    cost.ema = cost.n ? cost.ema * 0.95 + ms * 0.05 : ms; cost.n++;
    if (!cost.low && cost.n > 90 && cost.ema > 14 && api.quality !== 'low') {
      cost.low = true; api.quality = 'low'; stage.setQuality('low');
      api.crowdKey = ''; // rebuilt at the cheaper tier on the next frame
    }
    return true;
  };

  /** A clean render of one pose (no set), as a transparent canvas of px x px: used for the move cards. Cached by the caller. */
  api.thumb = function (pose, px = 160, phi = 0) {
    if (api.lost || stage.contextLost) return null;
    initLights();
    api.pose(pose, 0, 0, true);
    if (phi) {   // turn the body about its own vertical axis (through the pelvis) rather than about the pole
      human.root.updateMatrixWorld(true);
      const piv = human.bones.Bip01_Pelvis.getWorldPosition(new Vector3()), q = new Quaternion().setFromAxisAngle(Y_AXIS, phi);
      human.root.position.sub(piv).applyQuaternion(q).add(piv); human.root.quaternion.premultiply(q); human.root.updateMatrixWorld(true);
    }
    human.root.visible = true; world.root.visible = false; world.screen.visible = false; setCrowdVisible(false);
    const J = solve(pose, 0);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const key of ['pelvis', 'neck', 'head', 'sl', 'sr', 'handL', 'handR', 'elL', 'elR', 'knL', 'knR', 'footL', 'footR']) { const q = J[key]; x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }
    const pad = 14, cxu = (x0 + x1) / 2, cyu = (y0 + y1) / 2, span = Math.max(x1 - x0, y1 - y0) + pad * 2;
    const D = 12, hM = span * U;
    cam.clearViewOffset();
    cam.fov = 2 * Math.atan(hM / 2 / D) / D2R; cam.aspect = 1; cam.near = 1; cam.far = 60;
    cam.position.set(cxu * U, -cyu * U, D); cam.rotation.set(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const fog = stage.scene.fog; stage.scene.fog = null;
    renderer.setPixelRatio(1); renderer.setSize(px, px, false); renderer.setClearColor(0x000000, 0);
    stage.setShadowTarget(cxu * U, -cyu * U, 0);
    stage.render();
    const out = globalThis.document.createElement('canvas'); out.width = out.height = px;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    stage.scene.fog = fog; world.root.visible = true; world.screen.visible = true; setCrowdVisible(true);
    return out;
  };
  /** Dev/QA: a close render of the posed performer on the pole, no crowd or set. o: { phi, px, focus:[x,y] pole units (default pelvis), span (pole units) , turn }. */
  api.closeup = function (pose, o = {}) {
    if (api.lost || stage.contextLost) return null;
    initLights();
    const phi = o.phi || 0, px = o.px || 600;
    api.pose(pose, phi, 0, true);
    api.pose(pose, phi, 0, true);
    const J = solve(pose, phi);
    const vis = [];
    for (const c of world.root.children) { vis.push([c, c.visible]); c.visible = c === world.pole; }
    world.root.visible = true; world.screen.visible = false; setCrowdVisible(false);
    world.root.position.y = -STANDING_PELVIS * U;
    world.pole.position.set(0, 0, POLE_Z); world.pole.rotation.y = -(o.turn || 0);
    const f = o.focus || J.pelvis, span = (o.span || 160) * U, D = 12;
    cam.clearViewOffset();
    cam.fov = 2 * Math.atan(span / 2 / D) / D2R; cam.aspect = 1; cam.near = 1; cam.far = 60;
    cam.position.set(f[0] * U, -f[1] * U, D); cam.rotation.set(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const fog = stage.scene.fog; stage.scene.fog = null;
    renderer.setPixelRatio(1); renderer.setSize(px, px, false); renderer.setClearColor(0x3a2a40, 1);
    stage.setShadowTarget(f[0] * U, -f[1] * U, 0);
    stage.render();
    const out = globalThis.document.createElement('canvas'); out.width = out.height = px;
    out.getContext('2d').drawImage(renderer.domElement, 0, 0);
    stage.scene.fog = fog; for (const [c, v] of vis) c.visible = v; world.screen.visible = true; setCrowdVisible(true);
    return out;
  };
  api.setLighting = () => {};
  return api;
}
