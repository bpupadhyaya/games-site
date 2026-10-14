// A plain wool himation for the reclining man, built from real cloth geometry that rides on his bones (no symbols, no real textile):
//  - the hips and both legs under a heavy wrap that pools over the knees and covers the feet (so the model's shorts and trainers never show),
//  - a rolled band at the waist,
//  - the diagonal drape that crosses the chest from the left shoulder to the right hip, with a hem band and a hanging tail,
// all as parts of the same skeleton, so it breathes with him. Geometry is measured from the bones in the pose at build time, so it fits any pose.
export function dressHimation(V3, human, { cloth = '#8a2f22', trim = '#1c1411', edge = '#e8d9b0', bare = true } = {}) {
  const { THREE } = V3;
  const parts = [];
  human.root.updateMatrixWorld(true);
  const rq = human.root.getWorldQuaternion(new THREE.Quaternion());
  const AX = { x: new THREE.Vector3(1, 0, 0).applyQuaternion(rq), y: new THREE.Vector3(0, 1, 0).applyQuaternion(rq), z: new THREE.Vector3(0, 0, 1).applyQuaternion(rq) };
  const B = (n) => human.bones[`Bip01_${n}`];
  const wp = (n) => B(n).getWorldPosition(new THREE.Vector3());
  const off = (p, dx = 0, dy = 0, dz = 0) => p.clone().addScaledVector(AX.x, dx).addScaledVector(AX.y, dy).addScaledVector(AX.z, dz);

  // ---- materials -------------------------------------------------------------------------------------------------------------------
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const wool = (() => {
    const c = cv(256, 256), g = c.getContext('2d');
    g.fillStyle = cloth; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 2) { g.fillStyle = i % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)'; g.fillRect(i, 0, 1, 256); }
    for (let i = 0; i < 256; i += 2) { g.fillStyle = i % 4 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'; g.fillRect(0, i, 256, 1); }
    // woven border stripes near the two long edges (v = 0 and v = 1) are drawn on a separate texture below; here only the field
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.repeat.set(2.2, 1.6); return t;
  })();
  const fold = (() => {
    const c = cv(256, 256), g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 26; i++) {
      const x = (i / 26) * 256 + (Math.sin(i * 7.3) * 4), w = 6 + (i % 5) * 3;
      const gr = g.createLinearGradient(x - w, 0, x + w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, i % 2 ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.30)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, 256);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const fabric = (color, o = {}) => {
    const p = { color, map: o.map === undefined ? wool : o.map, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, bumpMap: fold, bumpScale: 0.55, ...o };
    try { return new THREE.MeshPhysicalMaterial({ ...p, sheen: 0.55, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xe0a090) }); } catch { return new THREE.MeshStandardMaterial(p); }
  };
  const clothMat = fabric(0xffffff);
  const trimMat = fabric(trim, { map: null });
  const edgeMat = fabric(edge, { map: null });

  // ---- helpers ---------------------------------------------------------------------------------------------------------------------
  const bake = (geo, bone) => { bone.updateWorldMatrix(true, false); geo.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert()); return geo; };
  const add = (bone, geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; bone.add(m); parts.push({ bone, obj: m }); return m; };
  const Y = new THREE.Vector3(0, 1, 0);
  const tubeW = (a, b, ra, rb, bone, mat = clothMat, name = 'limb') => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(rb, ra, len, 28, 6, true);
    const m4 = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m4); bake(g, bone);
    return add(bone, g, mat, name);
  };
  const ballW = (p, r, bone, mat = clothMat, sc = [1, 1, 1]) => {
    const g = new THREE.SphereGeometry(r, 28, 18); g.scale(sc[0], sc[1], sc[2]); g.translate(p.x, p.y, p.z); bake(g, bone);
    return add(bone, g, mat, 'ball');
  };
  // a ribbon through points (world), width along `side`, bulging along `nrm` by `bulge`
  const ribbon = (pts, widths, nrms, bulge, bone, mat, name, vRep = 3) => {
    const curve = new THREE.CatmullRomCurve3(pts), N = 36, K = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t), nr = nrms(t).clone();
      const side = new THREE.Vector3().crossVectors(tg, nr).normalize();
      nr.crossVectors(side, tg).normalize();
      const w = widths(t);
      for (let k = 0; k <= K; k++) {
        const u = k / K - 0.5, bump = Math.cos(u * Math.PI) * bulge;
        const q = p.clone().addScaledVector(side, u * w).addScaledVector(nr, bump);
        pos.push(q.x, q.y, q.z); uv.push(k / K, t * vRep);
      }
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < K; k++) { const a = i * (K + 1) + k, b = a + 1, c = a + K + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    bake(g, bone);
    return add(bone, g, mat, name);
  };

  const pelvis = B('Pelvis'), sp = B('Spine'), sp1 = B('Spine1'), sp2 = B('Spine2');
  const P = {
    pelvis: wp('Pelvis'), sp: wp('Spine'), sp1: wp('Spine1'), sp2: wp('Spine2'), neck: wp('Neck'),
    lth: wp('L_Thigh'), lca: wp('L_Calf'), lfo: wp('L_Foot'), lto: wp('L_Toe0'),
    rth: wp('R_Thigh'), rca: wp('R_Calf'), rfo: wp('R_Foot'), rto: wp('R_Toe0'),
    lua: wp('L_UpperArm'), rua: wp('R_UpperArm'), lcl: wp('L_Clavicle'), rcl: wp('R_Clavicle'),
  };

  // lower body: one continuous cocoon of wool from the waist over the hips, both thighs, knees, calves and feet (closed at the toes), so the model's
  // shorts and trainers never show. Cross-sections are ellipses spanning both legs, so a bent knee simply makes the cloth ride higher.
  {
    const mid = (a, b, t = 0.5) => a.clone().lerp(b, t);
    const L = { th: P.lth, ca: P.lca, fo: P.lfo, to: P.lto }, R = { th: P.rth, ca: P.rca, fo: P.rfo, to: P.rto };
    const toeEnd = (q) => { const d = q.to.clone().sub(q.fo).normalize(); return q.to.clone().addScaledVector(d, 0.10); };
    const st = [
      { c: off(P.sp, 0, 0.05, 0), a: 0.185, b: 0.125, h: null },
      { c: off(P.pelvis, 0, 0.0, 0), a: 0.215, b: 0.145, h: null },
      { c: mid(mid(L.th, R.th), mid(L.ca, R.ca), 0.25), a: 0.0, b: 0.135, h: R.th.clone().sub(L.th).multiplyScalar(0.5) },
      { c: mid(mid(L.th, R.th), mid(L.ca, R.ca), 0.8), a: 0.0, b: 0.115, h: R.ca.clone().sub(L.ca).multiplyScalar(0.5).add(R.th.clone().sub(L.th).multiplyScalar(0.0)) },
      { c: mid(mid(L.ca, R.ca), mid(L.fo, R.fo), 0.35), a: 0.0, b: 0.098, h: R.ca.clone().sub(L.ca).multiplyScalar(0.25).add(R.fo.clone().sub(L.fo).multiplyScalar(0.25)) },
      { c: mid(mid(L.ca, R.ca), mid(L.fo, R.fo), 0.9), a: 0.0, b: 0.085, h: R.fo.clone().sub(L.fo).multiplyScalar(0.5) },
      { c: mid(L.to, R.to).addScaledVector(mid(L.to, R.to).sub(mid(L.fo, R.fo)).normalize(), 0.02), a: 0.0, b: 0.075, h: R.to.clone().sub(L.to).multiplyScalar(0.5) },
      { c: mid(toeEnd(L), toeEnd(R)), a: 0.0, b: 0.03, h: R.to.clone().sub(L.to).multiplyScalar(0.5), end: true },
    ];
    st.length = 4; st[3].c = mid(mid(L.th, R.th), mid(L.ca, R.ca), 0.95);
    const N = st.length, curve = new THREE.CatmullRomCurve3(st.map((q) => q.c));
    const ROWS = 44, SEG = 40, pos = [], uv = [], idx = [];
    const interp = (f, key) => { const x = f * (N - 1), i = Math.min(N - 2, Math.floor(x)), t = x - i; return st[i][key] + (st[i + 1][key] - st[i][key]) * t; };
    for (let j = 0; j <= ROWS; j++) {
      const f = j / ROWS, c = curve.getPoint(f), tg = curve.getTangent(f).normalize();
      const x = f * (N - 1), i = Math.min(N - 2, Math.floor(x)), t = x - i;
      const hv = (st[i].h || new THREE.Vector3()).clone().lerp(st[i + 1].h || new THREE.Vector3(), t);
      const u = AX.x.clone().sub(tg.clone().multiplyScalar(AX.x.dot(tg))).normalize();
      const v = new THREE.Vector3().crossVectors(tg, u).normalize();
      if (v.dot(AX.z) < 0) v.negate();
      const rb = interp(f, 'b'), ra = (st[i].a || 0) + ((st[i + 1].a || 0) - (st[i].a || 0)) * t;
      const semiU = Math.max(ra, Math.abs(hv.dot(u)) + rb * 0.95) * 1.04, semiV = Math.max(rb, Math.abs(hv.dot(v)) + rb * 0.8) * 1.05;
      const endK = 1;
      for (let k = 0; k <= SEG; k++) {
        const ang = (k / SEG) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
        const fol = 1 + 0.035 * Math.sin(ang * 5 + j * 0.45) + 0.02 * Math.sin(ang * 9 - j * 0.7);
        const sag = sa < 0 ? 0.88 : 1;                // flatter underneath (resting on the couch)
        const q = c.clone().addScaledVector(u, ca * semiU * fol * endK).addScaledVector(v, sa * semiV * fol * sag * endK);
        pos.push(q.x, q.y, q.z); uv.push((k / SEG) * 3, f * 6);
      }
    }
    for (let j = 0; j < ROWS; j++) for (let k = 0; k < SEG; k++) { const a = j * (SEG + 1) + k, b = a + 1, c2 = a + SEG + 1, d = c2 + 1; idx.push(a, c2, b, b, c2, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    bake(g, pelvis); add(pelvis, g, clothMat, 'wrap');
  }
  // the feet: soft cloth boots over the trainers
  for (const q of [[P.lfo, P.lto, 'L_Foot'], [P.rfo, P.rto, 'R_Foot']]) {
    const m = q[0].clone().lerp(q[1], 0.55), d = q[1].clone().sub(q[0]), len = d.length();
    tubeW(q[0].clone().addScaledVector(d, -0.45), q[1].clone().addScaledVector(d.clone().normalize(), 0.07), 0.092, 0.07, B(q[2]), clothMat, 'boot');
    ballW(q[1].clone().addScaledVector(d.clone().normalize(), 0.07), 0.07, B(q[2]), clothMat, [1, 0.9, 1]);
    void m; void len;
  }
  // the rolled band over the waist
  {
    const g = new THREE.TorusGeometry(1, 0.036, 14, 56); g.scale(0.185, 0.128, 1);
    const bas = new THREE.Matrix4().makeBasis(AX.x, AX.z.clone().negate(), AX.y);
    const c = off(P.sp, 0, 0.075, 0.0);
    g.applyMatrix4(bas); g.translate(c.x, c.y, c.z); bake(g, sp); add(sp, g, clothMat, 'roll');
  }

  // (the chest is covered by the model's own sleeveless tunic, tinted linen: the himation is only the wrap and the shoulder fall)
  // left shoulder / upper arm: the cloth rests over the arm so the model's tank-top strap never shows on that side
  ballW(off(P.lua, 0.0, 0.03, 0.0), 0.085, B('L_UpperArm'), clothMat, [1, 1, 1]);
  tubeW(P.lua, wp('L_Forearm'), 0.082, 0.062, B('L_UpperArm'), clothMat, 'sleeve-L');

  return { parts, remove() { parts.forEach((p) => p.bone.remove(p.obj)); } };
}
