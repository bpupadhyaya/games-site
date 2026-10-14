// Particles for the court: paper confetti that tumbles, clay crumbs, dust and smoke puffs (soft sprites), sparks. All world space, metres.
// Cartoon-safe by design: a puff of paper, a flash and a little grey smoke; nothing realistic about the powder.
import { THREE } from '../vendor3d/index.js';
import { softTexture } from './world.js';

const TAU = Math.PI * 2;
const FLAG = ['#f7c600', '#1f4fb8', '#d3272f', '#ffffff', '#ff8a3d'];

export function createFx(parent, { quality = 'high' } = {}) {
  const hi = quality === 'high', mid = quality === 'medium';
  const group = new THREE.Group(); group.name = 'fx'; parent.add(group);
  const cap = { conf: hi ? 220 : mid ? 140 : 70, crumb: hi ? 90 : mid ? 60 : 30, puff: hi ? 40 : mid ? 28 : 16, spark: hi ? 80 : mid ? 50 : 30 };

  // confetti: flat paper bits (instanced), coloured per instance, tumbling, fluttering down with drag
  const confGeo = new THREE.PlaneGeometry(0.034, 0.02);
  const confMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: false });
  const conf = new THREE.InstancedMesh(confGeo, confMat, cap.conf); conf.frustumCulled = false;
  conf.setColorAt(0, new THREE.Color('#ffffff'));
  const confs = []; for (let i = 0; i < cap.conf; i++) confs.push({ life: 0, max: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 });
  let confN = 0;

  // crumbs of clay
  const crumbMat = new THREE.MeshStandardMaterial({ color: '#a8502c', roughness: 1, flatShading: true });
  const crumb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 5, 4), crumbMat, cap.crumb); crumb.frustumCulled = false; crumb.castShadow = false;
  const crumbs = []; for (let i = 0; i < cap.crumb; i++) crumbs.push({ life: 0, max: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), s: 1 });
  let crumbN = 0;

  // sparks: little additive streaks (spheres stretched along velocity are overkill: tiny additive cubes read well)
  const sparkMat = new THREE.MeshBasicMaterial({ color: '#ffe9a0', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false });
  const spark = new THREE.InstancedMesh(new THREE.BoxGeometry(0.004, 0.004, 0.02), sparkMat, cap.spark); spark.frustumCulled = false;
  const sparks = []; for (let i = 0; i < cap.spark; i++) sparks.push({ life: 0, max: 0, p: new THREE.Vector3(), v: new THREE.Vector3() });
  let sparkN = 0;

  // soft sprites: smoke / dust (normal blend) and flashes (additive)
  const smokeTex = softTexture('230,226,220', 64, 0.0), dustTex = softTexture('214,170,126', 64, 0.0), flashTex = softTexture('255,236,160', 64, 0.0);
  const puffs = [];
  for (let i = 0; i < cap.puff; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, fog: false })); s.visible = false; group.add(s);
    puffs.push({ s, life: 0, max: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), size: 0.1, grow: 1, a: 1, add: false });
  }
  let puffN = 0;
  group.add(conf, crumb, spark);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), col = new THREE.Color();
  const rand = (a, b) => a + Math.random() * (b - a);   // visual only: the presenter never feeds the sim

  const api = {
    group,
    confetti(pos, n, { speed = 2.2, up = 1.6, spread = 1, colors = FLAG } = {}) {
      for (let i = 0; i < n; i++) {
        const idx = confN, c = confs[idx]; confN = (confN + 1) % cap.conf;
        const a = rand(0, TAU), sp = speed * rand(0.35, 1) * spread;
        c.life = 0; c.max = rand(1.4, 2.4); c.p.copy(pos); c.v.set(Math.cos(a) * sp * 0.6, up * rand(0.5, 1.2), Math.sin(a) * sp * 0.6 + sp * 0.3);
        c.r.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)); c.w.set(rand(-14, 14), rand(-14, 14), rand(-14, 14)); c.s = rand(0.8, 1.4);
        col.set(colors[(Math.random() * colors.length) | 0]); conf.setColorAt(idx, col);
      }
      conf.instanceColor.needsUpdate = true;
    },
    crumbs(pos, n, { speed = 1.1, normal = null } = {}) {
      for (let i = 0; i < n; i++) {
        const c = crumbs[crumbN]; crumbN = (crumbN + 1) % cap.crumb;
        const a = rand(0, TAU), sp = speed * rand(0.3, 1);
        c.life = 0; c.max = rand(0.55, 0.9); c.p.copy(pos);
        c.v.set(Math.cos(a) * sp, rand(0.9, 2.1), Math.sin(a) * sp * 0.6 + 0.4);
        if (normal) c.v.addScaledVector(normal, rand(0.4, 1.2));
        c.r.set(rand(0, TAU), rand(0, TAU), 0); c.w.set(rand(-20, 20), rand(-20, 20), 0); c.s = rand(0.5, 1.5);
      }
    },
    sparks(pos, n, { speed = 2.4, color = '#ffe9a0' } = {}) {
      sparkMat.color.set(color);
      for (let i = 0; i < n; i++) {
        const c = sparks[sparkN]; sparkN = (sparkN + 1) % cap.spark;
        const a = rand(0, TAU), b = rand(-0.3, 1.2), sp = speed * rand(0.4, 1);
        c.life = 0; c.max = rand(0.18, 0.4); c.p.copy(pos); c.v.set(Math.cos(a) * sp, b * sp, Math.sin(a) * sp);
      }
    },
    puff(pos, { kind = 'smoke', size = 0.1, grow = 3, life = 1.0, rise = 0.5, drift = null, opacity = 0.55, tint = null } = {}) {
      const p = puffs[puffN]; puffN = (puffN + 1) % cap.puff;
      p.life = 0; p.max = life; p.p.copy(pos); p.v.set(rand(-0.12, 0.12), rise, rand(-0.12, 0.12)); if (drift) p.v.add(drift);
      p.size = size; p.grow = grow; p.a = opacity; p.add = kind === 'flash';
      const m = p.s.material; m.map = kind === 'flash' ? flashTex : kind === 'dust' ? dustTex : smokeTex;
      m.blending = p.add ? THREE.AdditiveBlending : THREE.NormalBlending; m.rotation = rand(0, TAU); m.needsUpdate = true;
      if (tint) m.color.set(tint); else m.color.set('#ffffff');
      p.s.visible = true;
    },
    update(dt) {
      if (dt <= 0) return;
      for (let i = 0; i < cap.conf; i++) {
        const c = confs[i];
        if (c.life < c.max) {
          c.life += dt;
          c.v.y -= 3.2 * dt; const d = Math.max(0, 1 - 2.2 * dt); c.v.x *= d; c.v.z *= d; if (c.v.y < -0.7) c.v.y = -0.7;   // paper drag: flutters down slowly
          c.p.addScaledVector(c.v, dt); c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; c.r.z += c.w.z * dt;
          if (c.p.y < 0.01) { c.p.y = 0.01; c.v.set(0, 0, 0); c.w.multiplyScalar(0.2); }
        }
        const k = c.life < c.max ? Math.min(1, (c.max - c.life) / 0.4) * Math.min(1, c.life * 20 + 0.1) : 0;
        q.setFromEuler(c.r); sc.setScalar(c.s * (0.0001 + k)); m4.compose(c.p, q, sc); conf.setMatrixAt(i, m4);
      }
      conf.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < cap.crumb; i++) {
        const c = crumbs[i];
        if (c.life < c.max) { c.life += dt; c.v.y -= 9.8 * dt; c.p.addScaledVector(c.v, dt); c.r.x += c.w.x * dt; c.r.y += c.w.y * dt; if (c.p.y < 0.004) { c.p.y = 0.004; c.v.multiplyScalar(0.2); c.w.multiplyScalar(0.2); } }
        const k = c.life < c.max ? Math.min(1, (c.max - c.life) / 0.2) : 0;
        q.setFromEuler(c.r); sc.setScalar(c.s * (0.0001 + k)); m4.compose(c.p, q, sc); crumb.setMatrixAt(i, m4);
      }
      crumb.instanceMatrix.needsUpdate = true;
      const look = new THREE.Vector3();
      for (let i = 0; i < cap.spark; i++) {
        const c = sparks[i];
        if (c.life < c.max) { c.life += dt; c.v.y -= 5 * dt; c.p.addScaledVector(c.v, dt); }
        const k = c.life < c.max ? 1 - c.life / c.max : 0;
        look.copy(c.v).normalize(); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), look.lengthSq() ? look : new THREE.Vector3(0, 1, 0));
        sc.set(1, 1, 0.2 + 1.8 * k); sc.multiplyScalar(0.0001 + k); m4.compose(c.p, q, sc); spark.setMatrixAt(i, m4);
      }
      spark.instanceMatrix.needsUpdate = true;
      for (const p of puffs) {
        if (!p.s.visible) continue;
        p.life += dt;
        if (p.life >= p.max) { p.s.visible = false; continue; }
        const k = p.life / p.max;
        p.p.addScaledVector(p.v, dt); p.v.multiplyScalar(Math.max(0, 1 - 1.4 * dt));
        p.s.position.copy(p.p);
        const e = p.add ? Math.sqrt(k) : 1 - Math.pow(1 - k, 2);
        p.s.scale.setScalar(p.size * (1 + p.grow * e));
        p.s.material.opacity = p.a * (p.add ? (1 - k) * (1 - k) : (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88));
      }
    },
    clear() { for (const c of confs) c.life = c.max; for (const c of crumbs) c.life = c.max; for (const c of sparks) c.life = c.max; for (const p of puffs) p.s.visible = false; },
  };
  return api;
}
