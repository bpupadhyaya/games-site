// The elastic: two parallel strands between the holders, wrapped round their legs, as dynamic tubes. The shape is a closed-form function of
// the landing record (a V pressed under each foot that lands ON a strand, springing back with a damped wobble once the foot leaves), so it
// is exactly in step with the sim's contact times. A dark line on the ground under each strand makes the plan position readable at any height.
import { THREE } from '../vendor3d/index.js';
import { HX, STRAND_Z } from './motion.js';

const N = 44, RAD = 6;
const ANCH = HX - 0.07;      // strands run from x = -ANCH to +ANCH (just inside the holders' legs)

function tube(color, radius) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((N + 1) * RAD * 3), nor = new Float32Array((N + 1) * RAD * 3), idx = [];
  for (let i = 0; i <= N; i++) for (let k = 0; k < RAD; k++) {
    const a = (k / RAD) * Math.PI * 2, o = (i * RAD + k) * 3;
    nor[o] = 0; nor[o + 1] = Math.cos(a); nor[o + 2] = Math.sin(a);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < RAD; k++) {
    const a = i * RAD + k, b = i * RAD + ((k + 1) % RAD), c = (i + 1) * RAD + k, d = (i + 1) * RAD + ((k + 1) % RAD);
    idx.push(a, c, b, b, c, d);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setIndex(idx);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0, emissive: color, emissiveIntensity: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  return { mesh, pos, radius, geo };
}
function setTube(t, pts) {                 // pts: array of N+1 [x,y,z]
  for (let i = 0; i <= N; i++) {
    const p = pts[i];
    for (let k = 0; k < RAD; k++) {
      const a = (k / RAD) * Math.PI * 2, o = (i * RAD + k) * 3;
      t.pos[o] = p[0]; t.pos[o + 1] = p[1] + Math.cos(a) * t.radius; t.pos[o + 2] = p[2] + Math.sin(a) * t.radius;
    }
  }
  t.geo.attributes.position.needsUpdate = true;
}

export function createBand(group, color = '#ff3f8e') {
  const strands = [tube(color, 0.021), tube(color, 0.021)];
  const wraps = [tube(color, 0.021), tube(color, 0.021)];
  for (const t of [...strands, ...wraps]) group.add(t.mesh);
  // plan marks on the ground: a thin dark line under each strand and under each wrap
  const shadowMat = new THREE.MeshBasicMaterial({ color: '#1a2352', transparent: true, opacity: 0.34, depthWrite: false });
  const ribbon = (pts, w) => {
    const g = new THREE.BufferGeometry(), v = [], ix = [];
    pts.forEach((p, i) => { v.push(p[0], 0.006, p[1] - w, p[0], 0.006, p[1] + w); if (i) { const a = (i - 1) * 2; ix.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } });
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(ix);
    const m = new THREE.Mesh(g, shadowMat); m.renderOrder = 2; m.frustumCulled = false; return m;
  };
  for (const zs of [-1, 1]) group.add(ribbon([[-ANCH, zs * STRAND_Z], [ANCH, zs * STRAND_Z]], 0.022));
  for (const side of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 16; i++) { const f = (i / 16) * Math.PI; pts.push([side * ANCH + side * 0.15 * Math.sin(f), STRAND_Z * Math.cos(f)]); }
    group.add(ribbon(pts, 0.022));
  }
  const tmp = [];
  for (let i = 0; i <= N; i++) tmp.push([0, 0, 0]);
  // Leg contact (presentation only): the band is taut between the holders, so a leg that reaches it pushes it into a tent (two straight
  // runs from the anchors to the pushed point). One contact per strand (the deepest), smoothed over a few frames so it never pops.
  const contact = [{ xc: 0, dy: 0, dz: 0 }, { xc: 0, dy: 0, dz: 0 }];
  const SR = 0.021;
  function segDist(px, py, pz, a, b, out) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const l2 = abx * abx + aby * aby + abz * abz || 1e-9;
    let t = ((px - a[0]) * abx + (py - a[1]) * aby + (pz - a[2]) * abz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    out[0] = a[0] + abx * t; out[1] = a[1] + aby * t; out[2] = a[2] + abz * t;
    return Math.hypot(px - out[0], py - out[1], pz - out[2]);
  }
  const cp = [0, 0, 0];
  function legContact(si, legs, dt) {
    const c = contact[si];
    let best = null;
    if (legs) {
      for (let i = 3; i < N - 2; i++) {
        const p = tmp[i];
        if (p[1] < 0.07) continue;                                  // a strand pressed to the ground under a foot is the ON landing: leave it
        for (const L of legs) {
          const d = segDist(p[0], p[1], p[2], L.a, L.b, cp), need = L.r + SR - d;
          if (need > 0.004 && (!best || need > best.need)) {
            let dy = p[1] - cp[1], dz = p[2] - cp[2]; const m = Math.hypot(dy, dz);
            if (m < 1e-4) { dy = 0; dz = si === 0 ? -1 : 1; } else { dy /= m; dz /= m; }
            best = { need: need + 0.01, x: p[0], dy: dy * (need + 0.01), dz: dz * (need + 0.01) };
          }
        }
      }
    }
    const k = 1 - Math.exp(-dt * (best ? 40 : 14));
    if (best) { if (Math.abs(c.dy) + Math.abs(c.dz) < 1e-3) c.xc = best.x; c.xc += (best.x - c.xc) * k; c.dy += (best.dy - c.dy) * k; c.dz += (best.dz - c.dz) * k; }
    else { c.dy -= c.dy * k; c.dz -= c.dz * k; }
    if (Math.abs(c.dy) + Math.abs(c.dz) < 1e-4) return;
    const xl = -ANCH, xr = ANCH, xc = Math.max(xl + 0.05, Math.min(xr - 0.05, c.xc));
    for (let i = 0; i <= N; i++) {
      const p = tmp[i], w = p[0] <= xc ? (p[0] - xl) / (xc - xl) : (xr - p[0]) / (xr - xc);
      p[1] = Math.max(0.015, p[1] + c.dy * w); p[2] += c.dz * w;
    }
  }
  const api = {
    ANCH, strands, wraps, contact,
    // h: strand height at the holders (m); presses: per strand [{x, a}] with a in -1..1 (1 = pressed to the ground); extra: { ripple, ph, sag }
    update({ h, hAnch = [h, h], presses, ripple = 0, ripplePh = 0, droop = 0, T = 0, legs = null, dt = 1 / 60 }) {
      const out = { maxPress: 0 };
      for (let si = 0; si < 2; si++) {
        const z = si === 0 ? -STRAND_Z : STRAND_Z;
        for (let i = 0; i <= N; i++) {
          const s = i / N, x = -ANCH + 2 * ANCH * s;
          let y = hAnch[0] + (hAnch[1] - hAnch[0]) * s;
          y -= 0.01 * Math.sin(Math.PI * s);                       // a trace of sag
          if (droop > 0) y = Math.max(0.015, y * (1 - droop) - 0.04 * Math.sin(Math.PI * s) * droop);
          let dz = 0;
          let low = 1e9;
          for (const p of presses[si]) {
            const base = y, depth = Math.max(0, base - 0.022) * p.a;
            const span = x < p.x ? p.x + ANCH : ANCH - p.x;
            const d = Math.sqrt((x - p.x) * (x - p.x) + 0.0036) - 0.06;
            const tent = Math.max(0, 1 - d / Math.max(0.3, span));
            low = Math.min(low, base - depth * tent);
            out.maxPress = Math.max(out.maxPress, Math.abs(p.a) * depth);
          }
          if (low < 1e8) y = low;
          if (ripple) { const e = Math.sin(Math.PI * s); y += ripple * e * Math.sin(ripplePh + s * 5); dz += 0.4 * ripple * e * Math.cos(ripplePh * 0.9 + s * 3); }
          tmp[i][0] = x; tmp[i][1] = y; tmp[i][2] = z + dz;
        }
        if (droop < 0.05) legContact(si, legs, dt); else { contact[si].dy = contact[si].dz = 0; }
        setTube(strands[si], tmp);
      }
      // the loop closing behind each holder
      for (let wi = 0; wi < 2; wi++) {
        const side = wi === 0 ? -1 : 1, ya = hAnch[wi];
        const yEnd = droop > 0 ? Math.max(0.015, ya * (1 - droop)) : ya;
        for (let i = 0; i <= N; i++) {
          const f = (i / N) * Math.PI;
          tmp[i][0] = side * ANCH + side * 0.15 * Math.sin(f); tmp[i][1] = yEnd; tmp[i][2] = -STRAND_Z * Math.cos(f);
        }
        setTube(wraps[wi], tmp);
      }
      return out;
    },
  };
  return api;
}
