// Props of the three events: the cabers (tapered, barked poles), the stone, the 56 lb weight with its chain, and the athlete's kilt.
// All procedural, with small canvas textures. Props that have a long axis use +Y from the small end (origin) to the big end.

function tex(THREE, w, h, draw, repeat) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t;
}
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function makeCaber(THREE, { L = 5.9, rSmall = 0.075, rBig = 0.19 } = {}) {
  const R = rnd(Math.round(L * 100));
  // a real caber is a peeled larch or spruce trunk: pale honey wood with long grain, resin streaks, knots where branches were cut, and scuffed ends
  const bark = tex(THREE, 256, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#c49a62'); gr.addColorStop(0.5, '#d6b07a'); gr.addColorStop(1, '#c39860'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 420; i++) { const x = R() * w, y = R() * h, l = 30 + R() * 140; g.strokeStyle = `rgba(${120 + R() * 40},${80 + R() * 30},${40 + R() * 20},${0.12 + R() * 0.25})`; g.lineWidth = 0.6 + R() * 1.8; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + (R() - 0.5) * 6, y + l / 3, x + (R() - 0.5) * 6, y + (2 * l) / 3, x + (R() - 0.5) * 4, y + l); g.stroke(); }
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(120,78,40,${0.15 + R() * 0.2})`; g.fillRect(R() * w, R() * h, 2 + R() * 4, 40 + R() * 120); }
    for (let i = 0; i < 5; i++) { const x = R() * w, y = R() * h, r = 3 + R() * 4; const kg = g.createRadialGradient(x, y, 0, x, y, r * 2.2); kg.addColorStop(0, 'rgba(105,66,34,0.75)'); kg.addColorStop(0.4, 'rgba(140,92,50,0.45)'); kg.addColorStop(1, 'rgba(150,100,55,0)'); g.fillStyle = kg; g.beginPath(); g.ellipse(x, y, r * 1.6, r * 2.6, 0, 0, Math.PI * 2); g.fill(); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(110,74,40,${0.25 + R() * 0.3})`; g.fillRect(R() * w, R() * h, 6 + R() * 18, 2 + R() * 3); }
  }, [1, Math.max(1, Math.round(L / 2.4))]);
  const geo = new THREE.CylinderGeometry(rBig, rSmall, L, 20, 8, false);   // top = big end, bottom = small end
  geo.translate(0, L / 2, 0);
  const body = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: bark, roughness: 0.78 }));
  body.castShadow = true;
  const g = new THREE.Group(); g.name = 'caber'; g.add(body);
  // pale cut faces at both ends and a darker band where the hands go
  const cut = (r, y, up) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 20), new THREE.MeshStandardMaterial({ color: 0xe2c79a, roughness: 0.85 })); m.position.y = y; m.rotation.x = up ? -Math.PI / 2 : Math.PI / 2; return m; };
  g.add(cut(rBig, L + 0.002, true), cut(rSmall, -0.002, false));
  g.userData = { L, rSmall, rBig };
  return g;
}

export function makeStone(THREE, { r = 0.125 } = {}) {
  const R = rnd(77);
  const t = tex(THREE, 128, 128, (g, w, h) => { g.fillStyle = '#6f7077'; g.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(${R() < 0.5 ? 30 : 200},${R() < 0.5 ? 30 : 200},${R() < 0.5 ? 40 : 200},${0.07 + R() * 0.15})`; g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3); } });
  const geo = new THREE.SphereGeometry(r, 18, 14);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.05 - 0.025; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.94, p.getZ(i) * k); }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.05 }));
  m.castShadow = true; m.name = 'stone';
  return m;
}

// The 56 lb weight: an iron block, a ring handle and a short chain. The chain is one thin cylinder the presenter stretches from the hand to the ring.
export function makeWeight(THREE) {
  const g = new THREE.Group(); g.name = 'weight';
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.45, metalness: 0.7 });
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.135, 0.24, 8), iron); block.castShadow = true; g.add(block);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.017, 8, 16), iron); ring.position.y = 0.2; g.add(ring);
  const ct = tex(THREE, 8, 32, (c, w, h) => { c.fillStyle = '#2a2d33'; c.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { c.fillStyle = '#7d828c'; c.fillRect(1, i * 8 + 1, w - 2, 4); } });
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 6), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.5, metalness: 0.6 }));
  chain.name = 'chain'; chain.castShadow = false;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12), iron);
  g.userData = { block, ring, chain, handle };
  return g;
}

// A pleated kilt of generic heather-and-moss check, attached to the pelvis bone of a loaded human. Returns { mesh, remove() }.
export function addKilt(THREE, human, { waist = 0.19, hem = 0.27, len = 0.4 } = {}) {
  const bone = human.bones.Bip01_Pelvis;
  human.model.updateMatrixWorld(true);
  const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const left = new THREE.Vector3(1, 0, 0).applyQuaternion(inv), up = new THREE.Vector3(0, 1, 0).applyQuaternion(inv), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(inv);
  const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(left, up, fwd));
  const N = 72, P = 18, rows = 4;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows, base = waist + (hem - waist) * Math.pow(v, 1.3);
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2, ph = ((i / N) * P) % 1, pleat = 1 + 0.07 * v * (ph < 0.5 ? ph * 2 : 2 - ph * 2) - 0.03 * v;
      // flatter at the back, slightly open at the hem front
      const r = base * pleat;
      pos.push(Math.sin(a) * r, 0.03 - v * len + (j === rows ? 0.012 * Math.sin(a * 6) : 0), Math.cos(a) * r * 1.02);
      uv.push((i / N) * 3, v * 1.5);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const t = tex(THREE, 64, 64, (g, w, h) => {
    g.fillStyle = '#3f5a3f'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(32,38,52,0.85)'; g.fillRect(0, 0, w * 0.4, h); g.fillRect(0, 0, w, h * 0.4); g.fillStyle = 'rgba(32,38,52,0.9)'; g.fillRect(0, 0, w * 0.4, h * 0.4);
    g.fillStyle = 'rgba(196,150,60,0.9)'; g.fillRect(w * 0.55, 0, 3, h); g.fillRect(0, h * 0.55, w, 3);
    g.fillStyle = 'rgba(150,70,60,0.7)'; g.fillRect(w * 0.82, 0, 2, h); g.fillRect(0, h * 0.82, w, 2);
  }, [1, 1]);
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  const holder = new THREE.Group(); holder.quaternion.copy(q); holder.add(mesh);
  // belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(waist + 0.005, waist + 0.005, 0.05, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.6, side: THREE.DoubleSide })); belt.position.y = 0.045; holder.add(belt);
  bone.add(holder);
  // secondary motion: the heavy wool lags behind the hips and flares out with speed and with the drop of the heave, on a damped spring.
  // Only the lower rows move (the waist stays on the belt).
  const base = Float32Array.from(geo.attributes.position.array), P3 = geo.attributes.position;
  const vv = new Float32Array(P3.count); for (let i = 0; i < P3.count; i++) vv[i] = Math.min(1, Math.max(0, (0.03 - base[i * 3 + 1]) / len));
  const last = new THREE.Vector3(), vel = new THREE.Vector3(), tmp = new THREE.Vector3(), qi = new THREE.Quaternion();
  const sp = { x: 0, z: 0, y: 0, f: 0, vx: 0, vz: 0, vy: 0, vf: 0 };
  const find = (re) => { let b = null; human.model.traverse((o) => { if (!b && o.isBone && re.test(o.name)) b = o; }); return b; };
  const thL = find(/L_Thigh$/), thR = find(/R_Thigh$/), caL = find(/L_Calf$/), caR = find(/R_Calf$/);
  const legs = [{ on: false }, { on: false }]; let have = false, kt = 0;
  function update(dt) {
    if (!(dt > 0)) return;
    kt += dt;
    holder.getWorldPosition(tmp);
    if (have) vel.copy(tmp).sub(last).divideScalar(dt); else vel.set(0, 0, 0);
    last.copy(tmp); have = true;
    holder.getWorldQuaternion(qi).invert(); const lv = vel.clone().applyQuaternion(qi);   // hip velocity in kilt space (x left, y up, z forward)
    const spd = Math.hypot(lv.x, lv.z);
    const tx = Math.max(-0.09, Math.min(0.09, -lv.x * 0.035)), tz = Math.max(-0.12, Math.min(0.05, -lv.z * 0.035)), ty = Math.max(-0.05, Math.min(0.08, -lv.y * 0.03));
    const tf = Math.min(0.22, spd * 0.035 + Math.max(0, lv.y) * 0.05) + 0.015 * Math.sin(kt * 7.1) * Math.min(1, spd);
    const k = 70, c = 9;
    for (const [key, tg] of [['x', tx], ['z', tz], ['y', ty], ['f', tf]]) { const vk = 'v' + key; sp[vk] += ((tg - sp[key]) * k - sp[vk] * c) * dt; sp[key] += sp[vk] * dt; }
    // drape over the thighs: the front of the kilt is carried forward and up by each thigh as the hip flexes (crouch, put, heave),
    // so the knees never poke through the cloth and it does not stand off like a barrel
    // each leg: its horizontal direction in kilt space and how far it is lifted from hanging straight down (measured, so it works whatever
    // way the pelvis bone is oriented)
    for (const [k, th, ca] of [[0, thL, caL], [1, thR, caR]]) {
      legs[k].on = false; if (!th || !ca) continue;
      const hp = holder.worldToLocal(th.getWorldPosition(tmp.clone())), kn = holder.worldToLocal(ca.getWorldPosition(tmp.clone()));
      const dx = kn.x - hp.x, dy = kn.y - hp.y, dz = kn.z - hp.z, hz = Math.hypot(dx, dz);
      if (hz < 1e-4) continue;
      legs[k].on = true; legs[k].dx = dx / hz; legs[k].dz = dz / hz; legs[k].lift = Math.max(0, Math.min(1.8, Math.atan2(hz, -dy) - 0.12)); legs[k].py = hp.y;
    }
    const lift = Math.max(legs[0].on ? legs[0].lift : 0, legs[1].on ? legs[1].lift : 0);
    const a = P3.array;
    for (let i = 0; i < P3.count; i++) {
      const v = vv[i]; if (v <= 0) continue; const w = v * v;
      let bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const fl = 1 + sp.f * Math.pow(v, 1.5) * (1 - 0.7 * Math.min(1, lift / 0.7));
      const r = Math.hypot(bx, bz) || 1, ux = bx / r, uz = bz / r;
      let L = null, best = 0;
      for (const G of legs) { if (!G.on || G.lift < 0.01) continue; const d = ux * G.dx + uz * G.dz; if (d > best) { best = d; L = G; } }
      if (L) {
        const th = L.lift * Math.min(1, Math.pow(best, 0.8) * 1.1) * Math.min(1, v * 3.2);
        const u = bx * L.dx + bz * L.dz, ry = by - L.py, cs = Math.cos(th), sn = Math.sin(th);
        const u2 = u * cs - ry * sn, ry2 = ry * cs + u * sn * 0.6;
        bx += (u2 - u) * L.dx; bz += (u2 - u) * L.dz; by = L.py + ry2;
      }
      a[i * 3] = bx * fl + sp.x * w; a[i * 3 + 1] = by + sp.y * w + sp.f * 0.25 * w * len; a[i * 3 + 2] = bz * fl + sp.z * w;
    }
    P3.needsUpdate = true;
  }
  return { mesh, holder, update, legs, remove() { bone.remove(holder); } };
}
