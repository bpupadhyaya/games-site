// A plain cotton practice kimono for the 3D performer, built from real garment geometry that rides on her bones (no symbols, no real textile):
//  - a body shell lofted from the sash to the shoulders and neck, with a deep V front, a cream under-collar (juban), the left front lapped over the right
//    and an obi with a soft obi-age above it, so the tank-top model underneath (straps, neckline) is completely hidden;
//  - the lap: a drape over the folded legs that pools forward over the knees;
//  - wide hanging sleeves: a snug tube over the arm plus a hanging cloth panel (the tamoto) simulated with a small verlet cloth, so the sleeve
//    swings and lags when the arm tosses and settles under gravity.
// Called once after the seated pose is applied; the sleeves are stepped each frame with step(dt).
export function dressKimono(V3, human, { cloth = '#1a2860', under = '#efe3c8', sash = '#6e1f1c', sashSoft = '#a8453b' } = {}) {
  const { THREE } = V3;
  const parts = [];
  human.root.updateMatrixWorld(true);

  // ---- materials --------------------------------------------------------------------------------------------------------------------
  const weave = (() => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 64, 64);
      for (let i = 0; i < 64; i += 2) { g.fillStyle = i % 4 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; g.fillRect(i, 0, 1, 64); g.fillRect(0, i, 64, 1); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); return t;
    } catch { return null; }
  })();
  const motif = (() => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'); g.fillStyle = cloth; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = 'rgba(214,226,255,0.30)'; g.lineWidth = 2.2; g.lineCap = 'round';
      for (const [x, y] of [[32, 32], [96, 96]]) { g.beginPath(); g.moveTo(x - 7, y - 7); g.lineTo(x + 7, y + 7); g.moveTo(x + 7, y - 7); g.lineTo(x - 7, y + 7); g.stroke(); }
      for (const [x, y] of [[96, 32], [32, 96]]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    } catch { return null; }
  })();
  const fabric = (opts) => {
    const base = { roughness: 0.9, metalness: 0, side: THREE.DoubleSide, bumpMap: weave, bumpScale: 0.6, ...opts };
    try { return new THREE.MeshPhysicalMaterial({ ...base, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6f86d8) }); } catch { return new THREE.MeshStandardMaterial(base); }
  };
  const clothMat = fabric({ color: motif ? 0xffffff : cloth, map: motif });
  const underMat = fabric({ color: under, sheenColor: new THREE.Color(0xfff6e0) });
  const sashMat = fabric({ color: sash, sheenColor: new THREE.Color(0xc05848) });
  const softMat = fabric({ color: sashSoft, sheenColor: new THREE.Color(0xd88a78) });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: 0.7, side: THREE.DoubleSide });

  // ---- geometry helpers -------------------------------------------------------------------------------------------------------------
  const lerpTable = (tab, x) => {                       // tab: [[x, v], ...] ascending
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * (t * t * (3 - 2 * t)); }
    return tab[tab.length - 1][1];
  };
  // a (cols x rows) grid surface from fn(u, v) -> [x, y, z, uTex, vTex]; closed around u when `wrap`
  const grid = (cols, rows, fn) => {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const p = fn(i / cols, j / rows); pos.push(p[0], p[1], p[2]); uv.push(p[3] ?? i / cols, p[4] ?? j / rows); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const seamFix = (g, cols, rows) => {                   // average the normals along the closed seam
    const n = g.attributes.normal;
    for (let j = 0; j <= rows; j++) {
      const a = j * (cols + 1), b = a + cols;
      const x = (n.getX(a) + n.getX(b)) / 2, y = (n.getY(a) + n.getY(b)) / 2, z = (n.getZ(a) + n.getZ(b)) / 2;
      n.setXYZ(a, x, y, z); n.setXYZ(b, x, y, z);
    }
    n.needsUpdate = true;
  };
  const bake = (geo, bone) => { bone.updateMatrixWorld(true); geo.applyMatrix4(new THREE.Matrix4().copy(bone.matrixWorld).invert()); return geo; };
  const add = (bone, geo, mat, name) => { const m = new THREE.Mesh(geo, mat); m.name = name || ''; m.frustumCulled = false; bone.add(m); parts.push({ bone, obj: m }); return m; };

  const sp = human.bones.Bip01_Spine1, pelvis = human.bones.Bip01_Pelvis;

  // ---- body shell: sash to shoulders (world frame at the seated pose, +z the front) ------------------------------------------------
  const RX = [[0.20, 0.158], [0.30, 0.160], [0.38, 0.153], [0.46, 0.152], [0.54, 0.166], [0.60, 0.184], [0.64, 0.192], [0.67, 0.160], [0.70, 0.100]];
  const RZ = [[0.20, 0.116], [0.30, 0.120], [0.38, 0.130], [0.46, 0.142], [0.54, 0.136], [0.60, 0.120], [0.64, 0.108], [0.67, 0.096], [0.70, 0.086]];
  const CZ = [[0.20, -0.015], [0.30, -0.016], [0.38, -0.022], [0.46, -0.030], [0.54, -0.042], [0.60, -0.066], [0.64, -0.080], [0.67, -0.090], [0.70, -0.095]];
  const CX = -0.008;
  const Y0 = 0.205, YNECK = 0.700, Y_V = 0.50;
  const onShell = (y, ang, grow = 0) => {
    const rx = lerpTable(RX, y) + grow, rz = lerpTable(RZ, y) + grow, cz = lerpTable(CZ, y);
    return [CX + rx * Math.sin(ang), y, cz + rz * Math.cos(ang)];
  };
  const topAt = (ang) => {                              // upper edge of the shell around the neck: a deep V at the front, a soft dip at the nape
    const c = Math.cos(ang), s = Math.abs(Math.sin(ang));
    if (c > 0) { const k = Math.min(1, (s * 0.10) / 0.066); return Y_V + (YNECK - Y_V) * Math.pow(k, 0.85); }
    return YNECK - 0.012 * (-c);
  };
  const COLS = 72, ROWS = 36;
  const torso = grid(COLS, ROWS, (u, v) => {
    const ang = u * Math.PI * 2, y = Y0 + (topAt(ang) - Y0) * v, p = onShell(y, ang);
    return [p[0], p[1], p[2], u * 7, y * 12];
  });
  seamFix(torso, COLS, ROWS);
  add(sp, bake(torso, sp), clothMat, 'kimono-body');

  // a thin cream ribbon that follows the whole neckline edge (the juban collar), standing a touch proud of the shell
  const collar = grid(COLS, 1, (u, v) => {
    const ang = u * Math.PI * 2, y = topAt(ang) - v * 0.026, p = onShell(y, ang, 0.004 + (1 - v) * 0.004);
    return [p[0], p[1] + (1 - v) * 0.004, p[2], u * 30, v];
  });
  add(sp, bake(collar, sp), underMat, 'kimono-collar');

  // the lapped front: left over right. Outer lapel line runs from the left neck across the chest to the right hip; an edge ribbon marks it,
  // and a second, shorter ribbon shows the right flap's edge where it emerges from under.
  const ribbon = (pts, w, mat) => {
    const n = pts.length, ang = (i) => i / (n - 1);
    const g = grid(n - 1, 1, (u, v) => { const p = pts[Math.round(u * (n - 1))]; return [p[0] + (v - 0.5) * w * p[3], p[1], p[2], u * 6, v]; });
    return add(sp, bake(g, sp), mat, 'kimono-lapel');
  };
  const lapel = (x0, y0, x1, y1, n, w, grow, mat) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const rx = lerpTable(RX, y) + grow, rz = lerpTable(RZ, y) + grow, cz = lerpTable(CZ, y);
      const q = Math.max(0, 1 - ((x - CX) / rx) ** 2);
      pts.push([x, y, cz + rz * Math.sqrt(q), 1]);
    }
    return ribbon(pts, w, mat);
  };
  lapel(0.050, 0.680, -0.002, Y_V, 14, 0.010, 0.008, underMat);        // left flap edge down to the crossing point
  lapel(-0.002, Y_V, -0.078, 0.31, 16, 0.010, 0.010, underMat);        // ...and on across to the right hip, over the right flap
  lapel(-0.050, 0.680, -0.002, Y_V + 0.004, 14, 0.008, 0.004, underMat);

  // ---- obi (sash) and obi-age ----------------------------------------------------------------------------------------------------
  const band = (yc, h, grow, mat, bulge = 0.012) => {
    const g = grid(64, 6, (u, v) => {
      const ang = u * Math.PI * 2, y = yc - h / 2 + h * v, b = Math.sin(v * Math.PI) * bulge;
      const p = onShell(y, ang, grow + b); return [p[0], p[1], p[2], u * 5, v];
    });
    seamFix(g, 64, 6);
    return add(sp, bake(g, sp), mat, 'obi');
  };
  band(0.318, 0.104, 0.010, sashMat, 0.012);                            // the obi
  band(0.388, 0.044, 0.004, softMat, 0.014);                            // obi-age: the soft silk folded above it
  band(0.318, 0.010, 0.024, cordMat, 0.002);                            // the cord tied across the middle (obi-jime)

  // ---- the lap: kimono over the folded legs, pooling forward over the knees ---------------------------------------------------------
  const T = [[-0.21, 0.10, 0.12, 0.150], [-0.12, 0.115, 0.125, 0.195], [0.0, 0.112, 0.118, 0.222], [0.15, 0.108, 0.108, 0.226], [0.30, 0.100, 0.100, 0.222], [0.42, 0.092, 0.098, 0.218], [0.50, 0.080, 0.080, 0.200], [0.545, 0.062, 0.04, 0.150], [0.565, 0.045, 0.01, 0.06]];
  const lapGeo = grid(64, 32, (u, v) => {
    const z = T[0][0] + (T[T.length - 1][0] - T[0][0]) * v;
    let i = 1; while (i < T.length - 1 && z > T[i][0]) i++;
    const a = T[i - 1], b = T[i], t = Math.min(1, Math.max(0, (z - a[0]) / (b[0] - a[0])));
    const cy = a[1] + (b[1] - a[1]) * t, ry = a[2] + (b[2] - a[2]) * t, rx = a[3] + (b[3] - a[3]) * t;
    const ang = u * Math.PI * 2, s = Math.sin(ang), c = Math.cos(ang);
    // a superellipse cross-section: flatter on top, so it reads as cloth lying over thighs rather than a tube
    const px = rx * Math.sign(s) * Math.pow(Math.abs(s), 0.8), py = cy + ry * Math.sign(c) * Math.pow(Math.abs(c), 0.8) * (c < 0 ? 0.9 : 1);
    return [px, Math.max(0.004, py), z, u * 6, v * 5];
  });
  seamFix(lapGeo, 64, 32);
  { const m = new THREE.Mesh(lapGeo, clothMat); m.name = 'kimono-lap'; m.frustumCulled = false; human.root.add(m); parts.push({ bone: human.root, obj: m }); }

  // ---- sleeves ----------------------------------------------------------------------------------------------------------------------
  const Y = new THREE.Vector3(0, 1, 0);
  const tube = (bone, child, rParent, rChild, extra = 0, mat = clothMat) => {
    const d = child.position.clone(), len = d.length(); d.normalize();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rChild, rParent, len + extra, 28, 1, true), mat);
    m.quaternion.setFromUnitVectors(Y, d); m.position.copy(d).multiplyScalar((len + extra) * 0.5); m.frustumCulled = false;
    bone.add(m); parts.push({ bone, obj: m }); return m;
  };
  const sleeves = [];
  for (const s of ['L', 'R']) {
    const up = human.bones[`Bip01_${s}_UpperArm`], fo = human.bones[`Bip01_${s}_Forearm`], ha = human.bones[`Bip01_${s}_Hand`];
    if (!up || !fo || !ha) continue;
    tube(up, fo, 0.056, 0.054);
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.066, 24, 16), clothMat); sh.frustumCulled = false; up.add(sh); parts.push({ bone: up, obj: sh });
    const el = new THREE.Mesh(new THREE.SphereGeometry(0.058, 20, 14), clothMat); el.frustumCulled = false; fo.add(el); parts.push({ bone: fo, obj: el });
    tube(fo, ha, 0.058, 0.050, 0.05);
    const dd = ha.position.clone().normalize();
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.0515, 0.0515, 0.014, 28, 1, true), underMat);
    cuff.quaternion.setFromUnitVectors(Y, dd); cuff.position.copy(ha.position).addScaledVector(dd, 0.052); cuff.frustumCulled = false;
    fo.add(cuff); parts.push({ bone: fo, obj: cuff });
    sleeves.push(makeSleeve(s, fo, ha));
  }

  function makeSleeve(side, fo, ha) {
    const N = 11, R = 6, P = N * R;
    const pos = new Float32Array(P * 3), prev = new Float32Array(P * 3), geo = new THREE.BufferGeometry();
    const uv = [], idx = [];
    for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) uv.push(i / (N - 1) * 2, r / (R - 1));
    for (let r = 0; r < R - 1; r++) for (let i = 0; i < N - 1; i++) { const a = r * N + i, b = a + 1, c = a + N, d = c + 1; idx.push(a, c, b, b, c, d); }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const mesh = new THREE.Mesh(geo, clothMat); mesh.frustumCulled = false; mesh.name = `sleeve-${side}`;
    human.root.add(mesh); parts.push({ bone: human.root, obj: mesh });
    const ew = new THREE.Vector3(), ww = new THREE.Vector3(), dirv = new THREE.Vector3(), anchor = Array.from({ length: N }, () => new THREE.Vector3());
    const outward = side === 'L' ? 1 : -1;
    let started = false;
    const depth = (i) => (0.09 + 0.12 * (i / (N - 1))) / (R - 1);          // the sleeve bag is deepest at the wrist end
    const setAnchors = () => {
      fo.getWorldPosition(ew); ha.getWorldPosition(ww);
      dirv.copy(ww).sub(ew);
      for (let i = 0; i < N; i++) {
        const t = i / (N - 1);
        anchor[i].copy(ew).addScaledVector(dirv, t * 1.04).add(new THREE.Vector3(outward * 0.035, -0.048, 0));
      }
    };
    const gravity = -7.0;
    const step = (dt) => {
      setAnchors();
      if (!started) {
        for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) { const k = (r * N + i) * 3, a = anchor[i]; pos[k] = prev[k] = a.x; pos[k + 1] = prev[k + 1] = a.y - r * depth(i); pos[k + 2] = prev[k + 2] = a.z; }
        started = true;
      }
      const sub = 2, h = Math.min(0.033, dt) / sub;
      for (let s = 0; s < sub; s++) {
        for (let r = 1; r < R; r++) for (let i = 0; i < N; i++) {
          const k = (r * N + i) * 3;
          for (let c = 0; c < 3; c++) {
            const p = pos[k + c], v = (p - prev[k + c]) * 0.965;
            prev[k + c] = p; pos[k + c] = p + v + (c === 1 ? gravity * h * h : 0);
          }
        }
        for (let it = 0; it < 4; it++) {
          for (let i = 0; i < N; i++) { const a = anchor[i], k = i * 3; pos[k] = a.x; pos[k + 1] = a.y; pos[k + 2] = a.z; }
          for (let r = 1; r < R; r++) for (let i = 0; i < N; i++) {          // vertical links
            const a = ((r - 1) * N + i) * 3, b = (r * N + i) * 3, L = depth(i);
            const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, e = (d - L) / d;
            const wa = r === 1 ? 0 : 0.5, wb = r === 1 ? 1 : 0.5;
            pos[a] += dx * e * wa; pos[a + 1] += dy * e * wa; pos[a + 2] += dz * e * wa;
            pos[b] -= dx * e * wb; pos[b + 1] -= dy * e * wb; pos[b + 2] -= dz * e * wb;
          }
          for (let r = 1; r < R; r++) for (let i = 0; i < N - 1; i++) {      // horizontal links keep the sheet's width
            const a = (r * N + i) * 3, b = a + 3, L = anchor[i].distanceTo(anchor[i + 1]);
            const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2], d = Math.hypot(dx, dy, dz) || 1e-6, e = (d - L) / d * 0.5;
            pos[a] += dx * e; pos[a + 1] += dy * e; pos[a + 2] += dz * e; pos[b] -= dx * e; pos[b + 1] -= dy * e; pos[b + 2] -= dz * e;
          }
          for (let r = 1; r < R; r++) for (let i = 0; i < N; i++) {          // the lap and the torso are solid
            const k = (r * N + i) * 3;
            if (Math.abs(pos[k]) < 0.25 && pos[k + 2] > -0.12 && pos[k + 2] < 0.52 && pos[k + 1] < 0.235) pos[k + 1] = 0.235;
          }
        }
      }
      geo.attributes.position.needsUpdate = true;
      geo.computeVertexNormals(); geo.computeBoundingSphere();
    };
    return { step };
  }

  return {
    parts,
    step(dt) { for (const s of sleeves) s.step(dt); },
    remove() { parts.forEach((p) => p.bone.remove(p.obj)); },
  };
}
