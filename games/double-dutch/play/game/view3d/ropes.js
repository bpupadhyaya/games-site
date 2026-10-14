// The two turning ropes and the dust they raise. Real cotton rope: about 1.3 cm thick (the drawn tube is 1.3 cm, plus a faint motion ghost
// so it still reads at phone size), a twisted-strand texture, handles of turned wood. The shape of each rope comes from the sim's rope
// angle (Theta) only; the presenter adds what a real rope does: the middle lags behind the hands when it is turned fast (whip), it sags a
// little under its own weight when it is slow, it lies flat for a stretch where it meets the pavement, and the two ends are pinned to the
// turners' actual palms (read AFTER the arms were posed, so a handle is always in a hand).
import { W3, ropePoints3, ropeAxisZ } from '../src/geo3d.js';

const TAU = Math.PI * 2;
export const ROPE_R = 0.0066;          // metres: 1.3 cm rope
const N = 56, RAD = 8;
const lcg = (seed) => { let x = seed >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; };

export function createRopes({ THREE, world, quality = 'medium' }) {
  const twist = (hex) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 8;
    const g = c.getContext('2d'); g.fillStyle = hex; g.fillRect(0, 0, 128, 8);
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.beginPath(); for (let x = -8; x < 136; x += 16) { g.moveTo(x, 8); g.lineTo(x + 8, 0); } g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (let x = 0; x < 144; x += 16) { g.moveTo(x, 8); g.lineTo(x + 8, 0); } g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(70, 1); t.anisotropy = 4; return t;
  };
  const mk = (which) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * RAD * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array((N + 1) * RAD * 3), 3));
    const uv = new Float32Array((N + 1) * RAD * 2); for (let i = 0; i <= N; i++) for (let j = 0; j < RAD; j++) { uv[(i * RAD + j) * 2] = i / N; uv[(i * RAD + j) * 2 + 1] = j / RAD; }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < RAD; j++) { const a = i * RAD + j, b = i * RAD + (j + 1) % RAD, c = (i + 1) * RAD + j, d = (i + 1) * RAD + (j + 1) % RAD; idx.push(a, c, b, b, c, d); }
    geo.setIndex(idx);
    const hex = which === 'A' ? '#ffa51f' : '#2fc8ff';
    const col = new THREE.Color(hex);
    const mat = new THREE.MeshStandardMaterial({ map: twist(hex), roughness: 0.8, metalness: 0, emissive: col, emissiveIntensity: 0.16 });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.castShadow = quality !== 'low'; world.add(mesh);
    // motion ghost: a wider, very faint tube so the rope still reads at phone size and shows how fast it is going
    const gmat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2, depthWrite: false });
    const ghost = new THREE.Mesh(geo, gmat); ghost.frustumCulled = false; ghost.scale.set(1, 1, 1); world.add(ghost);
    const wood = new THREE.MeshStandardMaterial({ color: which === 'A' ? 0xd9893a : 0x3a7fa8, roughness: 0.55, metalness: 0.05 });
    const handles = [-1, 1].map(() => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0175, 0.15, 12), wood); body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 10, 8), wood); cap.position.x = -0.075; g.add(cap);
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.0035, 6, 10), new THREE.MeshStandardMaterial({ color: 0xb8b8c8, metalness: 0.8, roughness: 0.3 })); eye.position.x = 0.078; eye.rotation.y = Math.PI / 2; g.add(eye);
      world.add(g); return g;
    });
    // soft contact shadow where the rope lies on the pavement
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
    const si = []; for (let i = 0; i < N; i++) { const a = i * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    sg.setIndex(si);
    const sh = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0x07020f, transparent: true, opacity: 0.38, depthWrite: false })); sh.frustumCulled = false; sh.renderOrder = 3; world.add(sh);
    return { which, geo, mesh, mat, ghost, gmat, sg, handles, pts: [], base: col, th: 0, w: 0, onFloor: false };
  };
  const ropes = [mk('A'), mk('B')];

  // ----------------------------------------------------------------- dust puffs (a pool of sprites, simulated with the sim dt)
  const MAXP = 90;
  const dustTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 2, 32, 32, 31); r.addColorStop(0, 'rgba(255,240,225,0.9)'); r.addColorStop(0.5, 'rgba(235,215,225,0.35)'); r.addColorStop(1, 'rgba(235,215,225,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
  })();
  const dgeo = new THREE.BufferGeometry();
  const dpos = new Float32Array(MAXP * 3), dcol = new Float32Array(MAXP * 3);
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dmat = new THREE.PointsMaterial({ map: dustTex, size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false, color: 0xe9dcea });
  const dust = new THREE.Points(dgeo, dmat); dust.frustumCulled = false; dust.renderOrder = 4; world.add(dust);
  const P = []; for (let i = 0; i < MAXP; i++) P.push({ x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
  let pi = 0; const rnd = lcg(4242);
  const puff = (x, y, z, n, spread = 0.9, up = 0.5) => {
    for (let k = 0; k < n; k++) {
      const p = P[pi]; pi = (pi + 1) % MAXP;
      p.x = x + (rnd() - 0.5) * spread; p.y = y + 0.01; p.z = z + (rnd() - 0.5) * 0.12;
      p.vx = (rnd() - 0.5) * 0.5; p.vy = 0.15 + rnd() * up; p.vz = (rnd() - 0.5) * 0.5; p.life = p.max = 0.45 + rnd() * 0.4;
    }
  };
  let lastTheta = null, lastAge = 0;
  const _o = { x: 0, y: 0, z: 0 };

  // A rope for the angle th (0 over the head, PI at the pavement), lag and sag from the angular speed w (rad/s).
  function shape(r, th, w, ends) {
    const pts = r.pts, z0 = ropeAxisZ(r.which), sp = Math.min(1, Math.abs(w) / 9);
    const lagT = 0.034 * w;                            // seconds of lag times angular speed: the middle trails the hands
    const sag = 0.075 * (1 - 0.85 * sp);
    let onFloor = false;
    for (let i = 0; i <= N; i++) {
      const u = i / N, s = Math.sin(Math.PI * u), rad = W3.handR + (W3.ropeR * (1 - 0.035 * (1 - sp)) - W3.handR) * Math.pow(s, 0.8);
      const a = th - lagT * s;
      let y = W3.handY + rad * Math.cos(a) - sag * s * (0.5 + 0.5 * Math.cos(a));
      let z = z0 + rad * Math.sin(a);
      const x = -W3.handX + 2 * W3.handX * u;
      let floor = false;
      if (y < ROPE_R) { y = ROPE_R; floor = true; onFloor = true; }
      const p = pts[i] || (pts[i] = { x: 0, y: 0, z: 0, floor: false });
      p.x = x; p.y = y; p.z = z; p.floor = floor;
    }
    // pin both ends to the palms
    if (ends) {
      const dl = { x: ends[0].x - pts[0].x, y: ends[0].y - pts[0].y, z: ends[0].z - pts[0].z }, dr = { x: ends[1].x - pts[N].x, y: ends[1].y - pts[N].y, z: ends[1].z - pts[N].z };
      for (let i = 0; i <= N; i++) {
        const u = i / N, wl = Math.pow(1 - u, 4), wr = Math.pow(u, 4), p = pts[i];
        p.x += dl.x * wl + dr.x * wr; p.y += dl.y * wl + dr.y * wr; p.z += dl.z * wl + dr.z * wr;
        if (p.y < ROPE_R) p.y = ROPE_R;
      }
    }
    r.onFloor = onFloor;
    return pts;
  }

  const _t = new THREE.Vector3(), _n1 = new THREE.Vector3(), _n2 = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function write(r, pts) {
    const pos = r.geo.attributes.position.array, nor = r.geo.attributes.normal.array, rad = ROPE_R;
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      _t.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize();
      _n1.crossVectors(_t, _up); if (_n1.lengthSq() < 1e-4) _n1.set(0, 0, 1); _n1.normalize();
      _n2.crossVectors(_t, _n1).normalize();
      for (let j = 0; j < RAD; j++) {
        const ang = (j / RAD) * TAU, c = Math.cos(ang), s = Math.sin(ang), o = (i * RAD + j) * 3;
        const nx = _n1.x * c + _n2.x * s, ny = _n1.y * c + _n2.y * s, nz = _n1.z * c + _n2.z * s;
        pos[o] = pts[i].x + nx * rad; pos[o + 1] = pts[i].y + ny * rad; pos[o + 2] = pts[i].z + nz * rad;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
      }
    }
    r.geo.attributes.position.needsUpdate = true; r.geo.attributes.normal.needsUpdate = true;
    const sp = r.sg.attributes.position.array;
    for (let i = 0; i <= N; i++) { const p = pts[i], k = i * 6, h = Math.max(0, 1 - p.y / 0.5); sp[k] = p.x; sp[k + 1] = 0.007; sp[k + 2] = p.z + 0.012 + 0.03 * h; sp[k + 3] = p.x; sp[k + 4] = 0.007; sp[k + 5] = p.z - 0.012 - 0.03 * h; }
    r.sg.attributes.position.needsUpdate = true;
    r.sg.setDrawRange(0, N * 6);
  }

  // handle: centred on the palm, along `axis` (unit, pointing to the middle of the street); returns the rope end (the handle's inner end)
  function handleAt(h, palm, axis) {
    h.position.set(palm.x, palm.y, palm.z);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), axis);
    h.quaternion.copy(q);
    return { x: palm.x + axis.x * 0.082, y: palm.y + axis.y * 0.082, z: palm.z + axis.z * 0.082 };
  }

  return {
    ropes, puff,
    // th per rope and angular speed; hands[which] = [{palm, axis}, {palm, axis}] (left end, right end) or null; hit = white flash 0..1
    update(V, dt, hands, glow) {
      const Theta = V.Theta;
      for (const r of ropes) {
        const th = r.which === 'A' ? Math.PI * Theta : Math.PI * (1 - Theta);
        if (dt > 0 && lastTheta !== null) { const w = ((r.which === 'A' ? 1 : -1) * Math.PI * (Theta - lastTheta)) / dt; r.w += (Math.max(-14, Math.min(14, w)) - r.w) * Math.min(1, dt * 30); }
        else if (dt === 0 && lastTheta === null) r.w = r.which === 'A' ? 5 : -5;     // a frozen picture (screenshots) shows a rope that is turning
        let ends = null;
        const hd = hands && hands[r.which];
        if (hd) ends = [handleAt(r.handles[0], hd[0].palm, hd[0].axis), handleAt(r.handles[1], hd[1].palm, hd[1].axis)];
        else { r.handles.forEach((h, k) => { const p = { x: (k ? 1 : -1) * W3.handX, y: W3.handY, z: ropeAxisZ(r.which) }; h.position.set(p.x, p.y, p.z); h.quaternion.identity(); }); }
        const pts = shape(r, th, Math.abs(r.w) * Math.sign(r.which === 'A' ? 1 : -1) * 1, ends);
        write(r, pts);
        const g = (glow && glow.rope === r.which) ? glow.v : 0;
        r.mat.emissiveIntensity = 0.16 + g * 0.8;
        r.gmat.opacity = 0.14 + Math.min(0.2, Math.abs(r.w) * 0.016) + g * 0.3;
        r.ghost.visible = true;
      }
      // a slap: the rope reaches the pavement (Theta passes an integer: odd = rope A, even = rope B)
      if (lastTheta !== null && dt > 0 && Theta > lastTheta && Theta - lastTheta < 0.5) {
        const n0 = Math.floor(lastTheta), n1 = Math.floor(Theta);
        if (n1 > n0) {
          const n = n1, which = (n % 2) ? 'A' : 'B', r = ropes[which === 'A' ? 0 : 1], pts = r.pts;
          let x0 = 9, x1 = -9, zz = ropeAxisZ(which), c = 0;
          for (const p of pts) if (p.floor) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); zz = p.z; c++; }
          if (c) puff((x0 + x1) / 2, 0, zz, 9 + Math.min(8, c >> 1), Math.max(0.5, x1 - x0) * 0.9);
          r.slap = 1;
        }
      }
      lastTheta = Theta; lastAge = dt;
      // dust
      for (let i = 0; i < MAXP; i++) {
        const p = P[i];
        if (p.life > 0 && dt > 0) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy *= 1 - Math.min(1, dt * 2.5); p.vx *= 1 - Math.min(1, dt * 2); }
        const k = i * 3, a = p.life > 0 ? 1 : 0;
        dpos[k] = p.x; dpos[k + 1] = a ? p.y : -50; dpos[k + 2] = p.z;
      }
      dgeo.attributes.position.needsUpdate = true;
      void lastAge; void _o; void dcol; void ropePoints3;
    },
    reset() { lastTheta = null; for (const p of P) p.life = 0; },
    dispose() { for (const r of ropes) { r.geo.dispose(); r.sg.dispose(); } dgeo.dispose(); },
  };
}
