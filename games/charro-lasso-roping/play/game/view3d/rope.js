// The lasso in 3D: a real rope tube with thickness, a honda (the eye the loop runs through), spinning in a tilted plane driven from the hand.
// Pure presentation: shapes are computed from numbers the 2D game already has (spin phase, hold size, flight progress, where the target is).
import { THREE } from '../vendor3d/index.js';
import { RopeMesh, canvasTex, clamp, lerp, TAU } from './geo.js';

const { Vector3, MeshStandardMaterial, Mesh, SphereGeometry } = THREE;

function ropeTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#c98f35'; g.fillRect(0, 0, w, h);
    for (let i = -h; i < w + h; i += 8) {
      g.fillStyle = 'rgba(255,226,150,0.85)';
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 4, 0); g.lineTo(i + 4 + h * 0.5, h); g.lineTo(i + h * 0.5, h); g.fill();
      g.fillStyle = 'rgba(70,35,5,0.55)';
      g.beginPath(); g.moveTo(i + 5, 0); g.lineTo(i + 7, 0); g.lineTo(i + 7 + h * 0.5, h); g.lineTo(i + 5 + h * 0.5, h); g.fill();
    }
  }, { repeat: [1, 1] });
}

const pool = (n) => Array.from({ length: n }, () => new Vector3());

export function createLasso({ quality = 'medium' } = {}) {
  const radial = quality === 'low' ? 5 : 7;
  const mat = new MeshStandardMaterial({ map: ropeTexture(), roughness: 0.8, metalness: 0, color: '#ffffff' });
  mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
  const hondaMat = new MeshStandardMaterial({ color: '#8a5a1c', roughness: 0.55, metalness: 0.2 });
  const ropes = [0, 1, 2].map(() => {
    const r = new RopeMesh(72, radial, mat);
    const honda = new Mesh(new SphereGeometry(1, 10, 8), hondaMat); honda.castShadow = true; honda.visible = false;
    const grp = new THREE.Group(); grp.add(r.mesh, honda);
    return { rope: r, honda, grp, pts: pool(72) };
  });
  const root = new THREE.Group(); ropes.forEach((r) => root.add(r.grp));

  const tmp = new Vector3(), U = new Vector3(), V = new Vector3(), Nn = new Vector3(), C = new Vector3(), A = new Vector3(), B = new Vector3();
  let radius = 0.03;
  const basis = (n) => {
    Nn.copy(n).normalize();
    const ref = Math.abs(Nn.y) > 0.9 ? B.set(1, 0, 0) : A.set(0, 1, 0);
    U.crossVectors(ref, Nn).normalize(); V.crossVectors(Nn, U).normalize();
  };

  // write: string from the hand to the honda (with sag), then the loop circle through the honda; returns count
  function build(R, hand, honda, circle, sag, closeFlat = false) {
    const pts = R.pts; let n = 0;
    const ns = 12;
    for (let i = 0; i < ns; i++) {
      const f = i / ns;
      pts[n].lerpVectors(hand, honda, f); pts[n].y -= sag * 4 * f * (1 - f); n++;
    }
    for (let i = 0; i < circle.length; i++) pts[n++].copy(circle[i]);
    pts[n++].copy(circle[0]);
    void closeFlat;
    return n;
  }
  const circPts = pool(48);
  /** circle of radius r around C in the plane with normal nrm; phase a0 puts the honda; wob: floppiness */
  function circle(Cc, r, nrm, a0, wob, t) {
    basis(nrm);
    const N = circPts.length;
    for (let i = 0; i < N; i++) {
      const a = a0 + (i / N) * TAU, rr = r * (1 + wob * 0.06 * Math.sin(3 * a + t * 3.1)), off = wob * r * 0.07 * Math.sin(2 * a + t * 2.3);
      circPts[i].copy(Cc).addScaledVector(U, Math.cos(a) * rr).addScaledVector(V, Math.sin(a) * rr).addScaledVector(Nn, off);
    }
    return circPts;
  }
  function figure(Cc, r, nrm, ang, kind, t) {
    basis(nrm);
    const N = circPts.length;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      let px, py;
      if (kind === 'flor') { const p = r * (0.28 + 0.72 * Math.abs(Math.cos(2 * a))); px = Math.cos(a) * p; py = Math.sin(a) * p; }
      else { px = Math.sin(a) * r * 1.1; py = Math.sin(2 * a) * r * 0.6; }
      const c = Math.cos(ang), s = Math.sin(ang), qx = px * c - py * s, qy = px * s + py * c;
      circPts[i].copy(Cc).addScaledVector(U, qx).addScaledVector(V, qy).addScaledVector(Nn, 0.04 * Math.sin(3 * a + t * 2));
    }
    return circPts;
  }
  const show = (R, n, hondaAt, scale, rad) => {
    R.rope.set(R.pts.slice(0, n), rad, 1 / (rad * 6.5), false);
    R.honda.visible = true; R.honda.position.copy(hondaAt); R.honda.scale.set(rad * 2.0, rad * 1.5, rad * 1.5);
    void scale;
  };
  const hide = (R) => { R.rope.mesh.visible = false; R.honda.visible = false; };

  const api = {
    root,
    setScale(s) { radius = clamp(1.25 / s, 0.016, 0.034); },
    hideAll() { ropes.forEach(hide); },
    /**
     * items (see arena.js): swing / flor / entrada / salto / mariposa / flight / caught. hand: world position of the rope hand. t: seconds.
     * ctx: { charro: {x,z,yaw}, horseNeck(frac) -> Vector3 (neck point of the horse at lane fraction), gateX, laneX(frac), ground }
     */
    update(items, hand, t, ctx) {
      let k = 0;
      for (const it of items) {
        if (k >= ropes.length) break;
        const R = ropes[k];
        const fwd = tmp.set(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw)).clone();
        const side = new Vector3(-fwd.z, 0, fwd.x);                        // charro's left, screen-up-ish plane normal helper
        const rad = radius;
        if (it.type === 'swing') {
          // overhead loop: a plane tilted a little and precessing around the vertical, the honda running round the rim
          const r = it.r;
          const th = 0.2 + 0.09 * it.size, ps = it.ang * 0.35;
          const nrm = new Vector3(Math.sin(th) * Math.cos(ps), Math.cos(th), Math.sin(th) * Math.sin(ps));
          C.copy(hand).addScaledVector(fwd, 0.05).add(tmp.set(0, 0.22 + 0.32 * r, 0));
          const cr = circle(C, r, nrm, it.ang * 1.4, 0.6, t);
          const hondaAt = cr[0].clone();
          const n = build(R, hand, hondaAt, cr, 0.04);
          show(R, n, hondaAt, 1, rad);
        } else if (it.type === 'flor' || it.type === 'mariposa') {
          const r = it.r;
          const nrm = new Vector3(0.25 * Math.sin(it.ang * 0.3), 0.12, 1).normalize();
          C.copy(hand).addScaledVector(fwd, it.type === 'flor' ? 0.55 : 0.7).add(tmp.set(0, it.type === 'flor' ? 0.35 : 0.1, 0.1));
          const cr = figure(C, r, nrm, it.ang * 0.35, it.type, t);
          const hondaAt = cr[0].clone();
          const n = build(R, hand, hondaAt, cr, 0.05);
          show(R, n, hondaAt, 1, rad);
        } else if (it.type === 'entrada' || it.type === 'salto') {
          // a big loop spun in front of the body, then jumped through: its plane leans from flat to upright with the trick
          const r = it.r, lean = it.type === 'salto' ? 0.55 + 0.35 * Math.sin(it.ang * 0.2) : 0.28 + 0.12 * Math.abs(Math.sin(it.ang * 0.4));
          const nrm = new Vector3(Math.sin(lean) * fwd.x * 0.6, Math.cos(lean), Math.sin(lean) * fwd.z * 0.6 + Math.sin(lean) * 0.3).normalize();
          C.set(ctx.charro.x, it.type === 'salto' ? 0.82 : 0.7, ctx.charro.z).addScaledVector(fwd, 0.62 + 0.25 * r);
          const cr = circle(C, r, nrm, it.ang * 1.1, 0.5, t);
          const hondaAt = cr[0].clone();
          const n = build(R, hand, hondaAt, cr, 0.12);
          show(R, n, hondaAt, 1, rad);
        } else if (it.type === 'flight') {
          const u = clamp(it.u, 0, 1.3);
          const T = it.target;                       // world point the loop is thrown at (neck of the horse / the gate)
          const f = u < 1 ? u : 1, e = f * f * (3 - 2 * f);
          const rFull = 0.3 + 0.38 * it.size;
          const rr = lerp(0.14, rFull, Math.min(1, f * 1.8));
          C.lerpVectors(hand, T, e); C.y += Math.sin(Math.PI * f) * 0.8 * (0.6 + 0.4 * it.size) + (1 - e) * 0.25;
          // the plane turns from the flight direction to the neck's axis as it drops over
          const dir = new Vector3().subVectors(T, hand).normalize();
          let nrm = dir.clone().lerp(it.axis || new Vector3(0.7, 0.7, 0), Math.pow(f, 3)).normalize();
          let ccw = 0;
          if (u > 1) {
            if (it.caught) { C.copy(T); }
            else { // missed: it comes down at the gate, collapses and is dragged back
              const q = u - 1; C.copy(T); C.y = Math.max(0.03, T.y * (1 - Math.min(1, q * 3.2)) + 0.03); C.lerp(hand, clamp((q - 0.12) * 1.4, 0, 1)); C.y = Math.max(0.03, C.y * (1 - Math.min(1, q * 4)));
              nrm = new Vector3(0, 1, 0).lerp(nrm, Math.max(0, 1 - q * 5)).normalize();
            }
          }
          let r = rr;
          if (u > 1) r = it.caught ? lerp(rFull * 0.9, 0.17, clamp((u - 1) * 5, 0, 1)) : rFull * (1 - clamp((u - 1) * 1.2, 0, 0.6));
          void ccw;
          const cr = circle(C, r, nrm, (it.spin ?? 0) + u * 5, u > 1 && !it.caught ? 1.4 : 0.5, t);
          const hondaAt = cr[0].clone();
          const slack = it.caught && u >= 1 ? 0.012 : 0.1 * (1 - clamp(f, 0, 1)) + 0.05;
          const n = build(R, hand, hondaAt, cr, slack * hand.distanceTo(hondaAt));
          show(R, n, hondaAt, 1, rad);
        } else if (it.type === 'caught') {
          const T = it.target;
          const nrm = it.axis ? it.axis.clone() : new Vector3(0.7, 0.7, 0);
          const rFull = 0.3 + 0.38 * (it.size ?? 0.5), rc = lerp(rFull * 0.9, 0.165, clamp(it.settle ?? 1, 0, 1));
          const cr = circle(T, rc, nrm, 0.5, 0.15 + 0.5 * (1 - clamp(it.settle ?? 1, 0, 1)), t);
          const hondaAt = cr[0].clone();
          const n = build(R, hand, hondaAt, cr, 0.015 * hand.distanceTo(hondaAt));
          show(R, n, hondaAt, 1, rad);
        } else hide(R);
        k++;
      }
      for (; k < ropes.length; k++) hide(ropes[k]);
    },
  };
  return api;
}
