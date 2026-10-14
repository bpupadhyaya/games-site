// Winter clothing for the musher, built from real garment geometry that rides on the bones (the shared athlete model wears a tank top and
// shorts): a padded parka (two lofted shells joined at a drawstring waist, sleeves with fur-lined cuffs, mittens), snow trousers, boots,
// a fur-trimmed hood ruff, a fur hat with ear flaps and a long scarf that streams behind her/him on a small verlet chain.
// Call once after the human is loaded and in its rest pose. `step(dt, windX)` advances the scarf (windX = how hard the air pushes it back).
export function dressMusher(V3, human, { parka = '#c8402a', trim = '#f1e7d4', trousers = '#27303f', boots = '#3a2b1e', hat = '#7d6a58', scarf = '#2a6fb5' } = {}) {
  const { THREE } = V3;
  const parts = [];
  human.root.updateMatrixWorld(true);
  const mat = (c, r = 0.88, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: 0, side: THREE.DoubleSide, ...extra });
  const M = { parka: mat(parka), trim: mat(trim, 0.96), pants: mat(trousers, 0.9), boots: mat(boots, 0.7), hat: mat(hat, 0.97), mitt: mat('#4a3424', 0.8), scarf: mat(scarf, 0.85), drawstring: mat('#e8dcc4', 0.7) };
  const B = (n) => human.bones[`Bip01_${n}`];
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const bake = (geo, bone) => { bone.updateMatrixWorld(true); geo.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert()); return geo; };
  const attach = (bone, geo, material, name) => { const m = new THREE.Mesh(geo, material); m.name = name || ''; m.frustumCulled = false; m.castShadow = true; bone.add(m); parts.push({ bone, obj: m }); return m; };
  const lerp = (a, b, t) => a + (b - a) * t;
  const sm = (tab, f) => { for (let i = 1; i < tab.length; i++) if (f <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = (f - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], t * t * (3 - 2 * t)); } return tab[tab.length - 1][1]; };
  const grid = (cols, rows, fn) => {
    const pos = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pos.push(...fn(i / cols, j / rows));
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const seam = (g, cols, rows) => { const n = g.attributes.normal; for (let j = 0; j <= rows; j++) { const a = j * (cols + 1), b = a + cols; const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2; n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z); } };

  const pel = B('Pelvis'), sp = B('Spine'), sp1 = B('Spine1'), sp2 = B('Spine2'), neck = B('Neck'), head = B('Head');
  const lU = B('L_UpperArm'), rU = B('R_UpperArm');
  const P = wp(pel), N = wp(neck), SW = wp(lU).distanceTo(wp(rU));
  const hem = P.y - 0.2, waist = P.y + 0.1, top = N.y - 0.02;
  // torso shell between two heights: elliptical sections, widest across the chest, slightly forward at the front
  const shell = (y0, y1, bone, name, flare = 0) => {
    const cols = 40, rows = 14;
    const RX = [[0, 0.215 + flare], [0.25, 0.19], [0.55, 0.205], [0.8, SW * 0.5 + 0.05], [1, 0.1]];
    const RZ = [[0, 0.165 + flare], [0.25, 0.15], [0.55, 0.16], [0.8, 0.14], [1, 0.09]];
    const f0 = (y0 - hem) / (top - hem), f1 = (y1 - hem) / (top - hem);
    const g = grid(cols, rows, (u, v) => {
      const f = lerp(f0, f1, v), y = lerp(y0, y1, v), a = u * Math.PI * 2;
      const cz = lerp(P.z, N.z, clamp01(f)) + 0.005;
      return [P.x + Math.sin(a) * sm(RX, f), y, cz + Math.cos(a) * sm(RZ, f)];
    });
    seam(g, cols, rows);
    return attach(bone, bake(g, bone), M.parka, name);
  };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  shell(hem, waist + 0.04, pel, 'parka-skirt', 0.012);
  shell(waist - 0.02, top, sp1, 'parka-body', 0);
  // drawstring band hides the seam
  { const g = grid(40, 1, (u, v) => { const a = u * Math.PI * 2, y = waist + 0.02 + v * 0.03; return [P.x + Math.sin(a) * 0.205, y, P.z + 0.006 + Math.cos(a) * 0.158]; }); seam(g, 40, 1); attach(sp, bake(g, sp), M.drawstring, 'drawstring'); }
  // zip placket + a chest pocket seam line
  { const g = grid(1, 8, (u, v) => { const y = lerp(waist, top - 0.02, v), f = (y - hem) / (top - hem), cz = lerp(P.z, N.z, clamp01(f)) + 0.005 + sm([[0, 0.165], [0.25, 0.15], [0.55, 0.16], [0.8, 0.14], [1, 0.09]], f) + 0.004; return [P.x + (u - 0.5) * 0.026, y, cz]; }); attach(sp1, bake(g, sp1), M.trim, 'parka-zip'); }

  // sleeves (padded) with fur-lined cuffs and mittens
  const Y = new THREE.Vector3(0, 1, 0);
  const tube = (bone, child, r0, r1, extra = 0, material = M.parka, name = '') => {
    const d = child.position.clone(), len = d.length(); d.normalize();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len + extra, 20, 1, true), material);
    m.quaternion.setFromUnitVectors(Y, d); m.position.copy(d).multiplyScalar((len + extra) * 0.5); m.frustumCulled = false; m.castShadow = true; m.name = name;
    bone.add(m); parts.push({ bone, obj: m }); return m;
  };
  const ball = (bone, r, material, scale = [1, 1, 1], pos = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), material); m.scale.set(...scale); m.position.set(...pos); m.frustumCulled = false; m.castShadow = true;
    bone.add(m); parts.push({ bone, obj: m }); return m;
  };
  for (const s of ['L', 'R']) {
    const up = B(`${s}_UpperArm`), fo = B(`${s}_Forearm`), ha = B(`${s}_Hand`);
    if (!up || !fo || !ha) continue;
    tube(up, fo, 0.074, 0.066, 0.01, M.parka, `sleeve-${s}`);
    ball(up, 0.077, M.parka);
    tube(fo, ha, 0.068, 0.056, 0.03, M.parka, `forearm-${s}`);
    ball(fo, 0.07, M.parka);
    // fur cuff ring + the mitten
    const dd = ha.position.clone().normalize();
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.022, 8, 18), M.trim);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dd); cuff.position.copy(dd).multiplyScalar(0.016); cuff.frustumCulled = false; fo.add(cuff); parts.push({ bone: fo, obj: cuff });
    cuff.position.copy(ha.position).addScaledVector(dd, 0.04);
    const mitt = ball(ha, 0.062, M.mitt, [0.85, 1.35, 0.8], [0, 0.07, 0.0]);
    mitt.quaternion.setFromUnitVectors(Y, dd);
    mitt.position.copy(dd).multiplyScalar(0.075);
  }
  // trousers and boots
  for (const s of ['L', 'R']) {
    const th = B(`${s}_Thigh`), ca = B(`${s}_Calf`), ft = B(`${s}_Foot`), toe = B(`${s}_Toe0`);
    if (!th || !ca || !ft) continue;
    tube(th, ca, 0.104, 0.082, 0.01, M.pants, `thigh-${s}`);
    ball(th, 0.105, M.pants);
    tube(ca, ft, 0.082, 0.066, 0.0, M.pants, `shin-${s}`);
    ball(ca, 0.083, M.pants);
    // boot: ankle cuff + a long sole forward of the ankle
    const ankleCuff = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 14, 1, true), M.boots);
    ankleCuff.position.set(0, -0.05, 0); ankleCuff.frustumCulled = false; ankleCuff.castShadow = true;
    const dirToe = toe ? toe.position.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const sole = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), M.boots); sole.scale.set(0.95, 0.8, 2.1); sole.castShadow = true; sole.frustumCulled = false;
    sole.position.copy(dirToe).multiplyScalar(0.08).add(new THREE.Vector3(0, -0.02, 0));
    ft.add(sole); parts.push({ bone: ft, obj: sole });
    const fur = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.025, 8, 16), M.trim); fur.rotation.x = Math.PI / 2; fur.position.set(0, 0.07, 0); fur.frustumCulled = false;
    ca.add(fur); parts.push({ bone: ca, obj: fur });
    const cl = ca.children.find((c) => c.isBone && /Foot/.test(c.name));
    if (cl) fur.position.copy(cl.position).multiplyScalar(0.86);
    void ankleCuff;
  }
  // hood ruff: a fur ring around the neck and a bulky roll at the back
  { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.045, 10, 22), M.trim); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.0, 0.0); ring.frustumCulled = false; ring.castShadow = true; neck.add(ring); parts.push({ bone: neck, obj: ring }); }
  // fur hat with ear flaps: placed from the head bone's world frame (rest pose: facing +z, up +y), baked back into the bone
  {
    head.updateWorldMatrix(true, false);
    const hw = wp(head), qInv = head.getWorldQuaternion(new THREE.Quaternion()).invert();
    const toLocal = (v) => head.worldToLocal(v.clone());
    const hatGroup = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.118, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), M.hat); dome.scale.set(1.0, 1.0, 1.1); dome.castShadow = true;
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.036, 10, 26), M.trim); band.rotation.x = Math.PI / 2; band.position.y = -0.03; band.scale.set(1, 1.1, 1); band.castShadow = true;
    hatGroup.add(dome, band);
    for (const sx of [1, -1]) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 9), M.hat); fl.scale.set(0.55, 1.5, 0.85); fl.position.set(sx * 0.108, -0.08, -0.01); fl.castShadow = true;
      hatGroup.add(fl);
    }
    // the head bone sits at the skull base; the crown is about 0.13 m above it
    const crown = new THREE.Vector3(hw.x, hw.y + 0.18, hw.z + 0.02);
    hatGroup.position.copy(toLocal(crown));
    hatGroup.quaternion.copy(qInv);
    hatGroup.traverse((o) => { o.frustumCulled = false; });
    head.add(hatGroup); parts.push({ bone: head, obj: hatGroup });
  }

  // scarf: a ribbon on a short verlet chain streaming backward (in the sled's frame, -x) and falling under gravity
  const NS = 9, seg = 0.085, W = 0.075;
  const sp0 = new Array(NS).fill(0).map(() => new THREE.Vector3()), sp1p = sp0.map(() => new THREE.Vector3());
  const sg = new THREE.BufferGeometry();
  const spos = new Float32Array(NS * 2 * 3), sidx = [];
  for (let i = 0; i < NS - 1; i++) { const a = i * 2; sidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  sg.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sg.setIndex(sidx);
  const scarfMesh = new THREE.Mesh(sg, M.scarf); scarfMesh.frustumCulled = false; scarfMesh.castShadow = true;
  let started = false;
  const root = human.root.parent || human.root;
  root.add(scarfMesh);
  parts.push({ bone: root, obj: scarfMesh });
  const tmp = new THREE.Vector3(), anchor = new THREE.Vector3(), inv = new THREE.Matrix4();
  const step = (dt, wind = 0) => {
    // work in the parent's (sled) local space
    root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
    neck.getWorldPosition(anchor); anchor.applyMatrix4(inv); anchor.y -= 0.02; anchor.x -= 0.02;
    if (!started) { for (let i = 0; i < NS; i++) { sp0[i].set(anchor.x - i * seg, anchor.y - i * 0.02, anchor.z); sp1p[i].copy(sp0[i]); } started = true; }
    const h = Math.min(0.033, dt || 0.016);
    sp0[0].copy(anchor);
    for (let i = 1; i < NS; i++) {
      tmp.copy(sp0[i]).sub(sp1p[i]).multiplyScalar(0.96);
      sp1p[i].copy(sp0[i]);
      sp0[i].add(tmp);
      sp0[i].y -= 3.2 * h * h * (1 - wind * 0.8);
      sp0[i].x -= wind * 14 * h * h;
      sp0[i].z += Math.sin(i * 1.3 + performance.now() * 0.006) * 0.2 * h * h * wind * 30;
    }
    for (let k = 0; k < 4; k++) {
      sp0[0].copy(anchor);
      for (let i = 1; i < NS; i++) { tmp.copy(sp0[i]).sub(sp0[i - 1]); const d = tmp.length() || 1e-6; sp0[i].addScaledVector(tmp, -(d - seg) / d); }
    }
    for (let i = 0; i < NS; i++) {
      const w = W * (1 - i * 0.04), p = sp0[i];
      spos[i * 6] = p.x; spos[i * 6 + 1] = p.y + w; spos[i * 6 + 2] = p.z - 0.03;
      spos[i * 6 + 3] = p.x; spos[i * 6 + 4] = p.y - w; spos[i * 6 + 5] = p.z + 0.03;
    }
    sg.attributes.position.needsUpdate = true; sg.computeVertexNormals();
  };
  return { parts, step, remove() { parts.forEach((p) => p.bone.remove(p.obj)); } };
}
