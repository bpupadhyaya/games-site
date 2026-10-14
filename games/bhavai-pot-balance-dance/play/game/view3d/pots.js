// The tower of matkas (clay water pots) on the dancer's head, its balance (a chain of lagging springs on top of the sim's tilt: the upper pots
// whip and micro-correct), the pot that is tossed up before a pot beat, and the pot that slips, falls and shatters into shards.
// Presentation only: v.th / v.n / the event list come from the sim; nothing is written back.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { tex, rng, clamp, flame } from './room.js';

const T = THREE;
const TAU = Math.PI * 2;
export const POT_H = 0.265;                            // centre-to-centre spacing (matches the sim's tower height)
const MAXP = 12;

// ---- one matka: lathe profile (belly, neck, flared lip) + painted bands --------------------------------------------------------------------
const PROFILE = [[0.001, 0], [0.05, 0], [0.085, 0.012], [0.128, 0.05], [0.158, 0.1], [0.165, 0.145], [0.148, 0.195], [0.105, 0.228], [0.088, 0.242], [0.092, 0.252], [0.108, 0.262], [0.112, 0.266], [0.096, 0.263], [0.082, 0.252], [0.001, 0.22]];

function potTexture(kind) {
  const W = 512, H = 256, c = globalThis.document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), r = rng(11 + kind * 7);
  const base = [['#b9532e', '#d8744a'], ['#a8431f', '#c8602f'], ['#c26a38', '#e08a55']][kind % 3];
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, base[1]); gr.addColorStop(0.5, base[0]); gr.addColorStop(1, base[0]);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(255,220,180,0.10)' : 'rgba(60,20,5,0.12)'; g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2); }
  // v runs from the base (0) to the lip (1): draw bands where the belly is
  const y = (v) => H * (1 - v);
  const band = (v0, v1, col) => { g.fillStyle = col; g.fillRect(0, y(v1), W, y(v0) - y(v1)); };
  band(0.3, 0.34, '#f4e8d0'); band(0.62, 0.66, '#f4e8d0');
  band(0.14, 0.18, '#7a1a10');
  // dot rows in white lime paint
  g.fillStyle = '#fbf3de';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i + 0.5) * W / 40, y(0.5), 4, 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc((i + 0.5) * W / 40, y(0.22), 3, 0, TAU); g.fill(); }
  // triangle ribbon / petal pattern on the shoulder
  g.fillStyle = kind === 1 ? '#1e6f8c' : '#7a1a10';
  for (let i = 0; i < 20; i++) { const x = (i + 0.5) * W / 20; g.beginPath(); g.moveTo(x - 11, y(0.66)); g.lineTo(x + 11, y(0.66)); g.lineTo(x, y(0.78)); g.closePath(); g.fill(); }
  g.fillStyle = '#e8b64a';
  for (let i = 0; i < 20; i++) { const x = (i + 0.5) * W / 20; g.beginPath(); g.arc(x, y(0.8), 3, 0, TAU); g.fill(); }
  // lime-wash rim
  band(0.9, 1.0, '#e9dcc0');
  const t = tex(c, { aniso: 8 }); t.wrapS = T.RepeatWrapping;
  return t;
}

export function createPots(scene, { quality = 'medium' } = {}) {
  const hi = quality !== 'low';
  const geo = B.lathe(PROFILE, hi ? 36 : 22);
  const mats = [0, 1, 2].map((k) => new T.MeshStandardMaterial({ map: potTexture(k), roughness: 0.75, metalness: 0, envMapIntensity: 0.5 }));
  const makePot = (k) => { const m = new T.Mesh(geo, mats[k % 3]); m.castShadow = hi; m.receiveShadow = hi; m.visible = false; scene.add(m); return m; };
  const pots = []; for (let i = 0; i < MAXP; i++) pots.push(makePot(i));
  const incoming = makePot(1), flyBack = makePot(2);
  // cloth ring (indhoni) on the crown, the top lamp (diya on a small brass saucer)
  const ring = new T.Mesh(new T.TorusGeometry(0.082, 0.03, 10, 28), new T.MeshStandardMaterial({ color: 0xb3203a, roughness: 0.8 }));
  ring.rotation.x = Math.PI / 2; ring.castShadow = hi; scene.add(ring);
  const lampMat = B.material('brass', { envIntensity: 1.5 });
  const lamp = new T.Group();
  const saucer = new T.Mesh(B.lathe([[0.001, 0], [0.09, 0], [0.12, 0.02], [0.13, 0.045], [0.1, 0.035], [0.001, 0.025]], 20), lampMat); saucer.castShadow = hi; lamp.add(saucer);
  const fl = flame(0.26); fl.group.position.y = 0.07; lamp.add(fl.group);
  scene.add(lamp);
  // marigold garland draped round the lip of the top pot
  const flowers = [];
  const fgeo = new T.SphereGeometry(0.02, 8, 6), fcols = [0xffa51a, 0xff7a10, 0xffc629];
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(fgeo, new T.MeshStandardMaterial({ color: fcols[i % 3], roughness: 0.7 })); m.visible = false; scene.add(m); flowers.push(m); }

  // shards for a broken pot (two shells: painted outside, bare clay inside)
  const SHARDS = 36;
  const shardGeo = new T.BufferGeometry();
  shardGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.06, 0, 0.005, 0.02, 0.05, 0.012, 0, 0, 0, 0.02, 0.05, 0.012, 0.06, 0, 0.005], 3));
  shardGeo.computeVertexNormals();
  const shardMat = new T.MeshStandardMaterial({ color: 0xb4532c, roughness: 0.85, side: T.DoubleSide });
  const shards = new T.InstancedMesh(shardGeo, shardMat, SHARDS); shards.frustumCulled = false; shards.castShadow = hi; shards.count = 0; scene.add(shards);
  const shardState = []; let shardN = 0;

  const P = { group: null, hands: { c: new T.Vector3(0, 1.9, 0), L: { p: new T.Vector3(-0.15, 1.9, 0.02), pole: new T.Vector3() }, R: { p: new T.Vector3(0.15, 1.9, 0.02), pole: new T.Vector3() } }, ang: new Array(MAXP).fill(0), w: new Array(MAXP).fill(0), pose: [], falling: [], popT: new Array(MAXP).fill(0), shown: 0, top: new T.Vector3(), shake: 0 };
  for (let i = 0; i < MAXP + 2; i++) P.pose.push({ p: new T.Vector3(), a: 0, yaw: 0 });
  let lastEv = 0;
  const m4 = new T.Matrix4(), q4 = new T.Quaternion(), s3 = new T.Vector3(), e3 = new T.Euler();

  function spawnShards(pos, n, vel) {
    const r = rng((pos.x * 1000) | 0 || 7);
    for (let i = 0; i < n && shardState.length < SHARDS; i++) {
      const a = r() * TAU, sp = 0.8 + r() * 2.2;
      shardState.push({ p: pos.clone().add(new T.Vector3((r() - 0.5) * 0.14, (r() - 0.2) * 0.1, (r() - 0.5) * 0.14)), v: new T.Vector3(Math.cos(a) * sp + vel.x * 0.4, 1.2 + r() * 2.6, Math.sin(a) * sp * 0.6 + vel.z * 0.3), rot: new T.Euler(r() * TAU, r() * TAU, r() * TAU), spin: new T.Vector3((r() - 0.5) * 16, (r() - 0.5) * 16, (r() - 0.5) * 16), s: 0.9 + r() * 1.6, life: 5 + r() * 3, rest: false });
    }
  }

  /** frame update. pivot: world point at the crown (top of the head), headQ: the head's orientation. fx: the particle system. */
  P.update = function (v, dt, pivot, headQ, newEvents, fx, clock) {
    const n = clamp(v.n, 0, MAXP - 1);
    // new events
    for (const e of newEvents) {
      if (e.type === 'pot' && e.ok) P.popT[clamp(e.n - 1, 0, MAXP - 1)] = 1;
      if (e.type === 'fall') {
        const k = clamp(e.n - 1, 0, MAXP - 1), pose = P.pose[k];
        P.falling.push({ p: pose.p.clone(), v: new T.Vector3(e.dir * (1.1 + Math.random() * 0.5), 1.1, (Math.random() - 0.5) * 0.4), rz: pose.a, rw: e.dir * (3 + Math.random() * 3), ry: 0, k, t: 0 });
        P.shake = 1;
      }
    }
    // the chain of springs: the tower leans with the sim's th; each pot follows its lower neighbour with its own lag, so the top whips
    const acc = v.acc ?? 0;
    for (let k = 0; k < n; k++) {
      const om = 15 - 0.75 * k, z = 0.5;
      const tgt = v.th + clamp(-acc * 0.004 * (k + 1) / (1 + 0.3 * k), -0.05, 0.05) + 0.0;
      const a = om * om * (tgt - P.ang[k]) - 2 * z * om * P.w[k];
      P.w[k] += a * dt; P.ang[k] += P.w[k] * dt;
    }
    // layout: pivot at the crown; each pot centre is the previous top plus half a pot along its own axis
    const base = pivot, p = new T.Vector3(), up = new T.Vector3();
    p.copy(base);
    const yawBase = v.yawSpin ?? 0;
    for (let k = 0; k < MAXP; k++) {
      const pot = pots[k];
      if (k >= n) { pot.visible = false; continue; }
      const a = P.ang[k] + P.shake * 0.0;
      up.set(Math.sin(a), Math.cos(a), 0);
      const centre = p.clone().addScaledVector(up, k === 0 ? 0.03 : 0.0);
      pot.position.copy(centre); pot.rotation.set(0, yawBase * 0.2, -a);
      // pop when a pot has just been added: a small overshoot of scale
      const pk = P.popT[k]; P.popT[k] = Math.max(0, pk - dt * 3);
      const sc = 1 + 0.16 * Math.sin(pk * Math.PI) * pk;
      pot.scale.setScalar(sc);
      pot.visible = true;
      P.pose[k].p.copy(centre).addScaledVector(up, 0.133); P.pose[k].a = a;
      p.copy(centre).addScaledVector(up, POT_H);
    }
    P.top.copy(p);
    // the ring and the lamp
    ring.position.copy(base).addScaledVector(up.set(0, 1, 0).applyQuaternion(headQ), -0.01); ring.quaternion.copy(headQ); ring.rotateX(Math.PI / 2);
    lamp.position.copy(p).addScaledVector(up.set(Math.sin(P.ang[Math.max(0, n - 1)]), Math.cos(P.ang[Math.max(0, n - 1)]), 0), -0.0);
    lamp.rotation.set(0, 0, -P.ang[Math.max(0, n - 1)]);
    lamp.visible = n > 0; ring.visible = true;
    // flame leans away from the motion and flickers
    {
      const s = fl.size, w = 1 + 0.2 * Math.sin(clock * 12) + 0.1 * Math.sin(clock * 31);
      fl.core.scale.set(s * 0.55, s * w, 1); fl.core.material.rotation = clamp(-v.th * 0.6 - (v.v ?? 0) * 0.05, -0.5, 0.5);
      fl.halo.material.opacity = 0.35 + 0.15 * w;
    }
    // garland on the top pot lip
    if (n > 0) {
      const k = n - 1, a = P.ang[k], c = pots[k].position, ux = Math.sin(a), uy = Math.cos(a);
      flowers.forEach((f, i) => {
        const t = (i / 12) * TAU, r = 0.108;
        f.position.set(c.x + Math.cos(t) * r * Math.cos(a) + ux * 0.25, c.y + uy * 0.25 - Math.cos(t) * r * Math.sin(a), c.z + Math.sin(t) * r);
        f.visible = true;
      });
    } else flowers.forEach((f) => { f.visible = false; });

    // incoming pot (tossed up from the side lane before a pot beat) and the pot sent back when the tower was too shaky
    const arc = (obj, from, to, u, h) => {
      const e = u * u * (3 - 2 * u);
      obj.position.set(from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e + Math.sin(Math.PI * e) * h, from.z + (to.z - from.z) * e);
      obj.rotation.set(0, e * 5, e * 7 * (from.x > to.x ? -1 : 1) * (1 - e)); obj.visible = true;
    };
    if (v.incoming) {
      const top = P.top.clone(); top.y += 0.0; top.y += 0.0;
      arc(incoming, new T.Vector3(v.incoming.from, 1.15, 0.9), top, clamp(v.incoming.u, 0, 1), 0.7);
    } else incoming.visible = false;
    if (v.flyBack) arc(flyBack, P.top.clone(), new T.Vector3(v.flyBack.to, 1.1, 0.9), clamp(v.flyBack.age / 0.6, 0, 1), 0.6);
    else flyBack.visible = false;

    // falling pots: gravity, a bounce on the flagstones, then they break
    for (let i = P.falling.length - 1; i >= 0; i--) {
      const f = P.falling[i]; f.t += dt;
      f.v.y -= 9.8 * dt; f.p.addScaledVector(f.v, dt); f.rz += f.rw * dt; f.ry += f.rw * 0.3 * dt;
      const pot = pots[MAXP - 1 - (i % 2)];            // reuse spare meshes are not needed: draw with the incoming mesh pool
      void pot;
      if (f.p.y < 0.14) {
        // break: shards + dust + a clatter
        spawnShards(new T.Vector3(f.p.x, 0.12, f.p.z), 18, f.v);
        fx.puff(new T.Vector3(f.p.x, 0.08, f.p.z), 14, [0xcaa070, 0xe0c090, 0xb08050], 0.9, 0.35);
        fx.event('shatter', f.p);
        P.falling.splice(i, 1);
      }
    }
    P.fallMesh = P.fallMesh || makePot(0);
    // draw the (first) falling pot; additional ones are rare
    const f0 = P.falling[0];
    if (f0) { P.fallMesh.visible = true; P.fallMesh.position.copy(f0.p).addScaledVector(up.set(Math.sin(f0.rz), Math.cos(f0.rz), 0), -0.133); P.fallMesh.rotation.set(f0.ry, 0, -f0.rz); P.fallMesh.scale.setScalar(1); } else P.fallMesh.visible = false;
    // shards
    for (let i = shardState.length - 1; i >= 0; i--) {
      const s = shardState[i]; s.life -= dt;
      if (!s.rest) {
        s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt);
        s.rot.x += s.spin.x * dt; s.rot.y += s.spin.y * dt; s.rot.z += s.spin.z * dt;
        if (s.p.y < 0.01) { s.p.y = 0.01; if (Math.abs(s.v.y) > 0.8) { s.v.y *= -0.35; s.v.x *= 0.6; s.v.z *= 0.6; s.spin.multiplyScalar(0.5); } else { s.rest = true; s.rot.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.4; s.rot.z = Math.random() * TAU; } }
      }
      if (s.life < 0) shardState.splice(i, 1);
    }
    shards.count = shardState.length;
    for (let i = 0; i < shardState.length; i++) {
      const s = shardState[i], sc = s.s * Math.min(1, s.life * 2);
      m4.compose(s.p, q4.setFromEuler(e3.copy(s.rot)), s3.set(sc, sc, sc)); shards.setMatrixAt(i, m4);
    }
    shards.instanceMatrix.needsUpdate = true;
    P.shake = Math.max(0, P.shake - dt * 3);

    // hands: both sides of the lowest pot, slightly above its centre (the dancer reads these next frame)
    {
      const a = P.ang[0], c = pots[0].position, ca = Math.cos(a), sa = Math.sin(a);
      const side = (s) => { const off = 0.158 * s; return new T.Vector3(c.x + ca * off + sa * 0.13, c.y - sa * off + ca * 0.13, c.z + 0.012); };
      P.hands.L.p.copy(side(1)); P.hands.R.p.copy(side(-1)); P.hands.c.set(c.x + sa * 0.13, c.y + ca * 0.13, c.z);
      P.hands.L.pole.set(c.x + 0.6, c.y - 0.4, -0.1); P.hands.R.pole.set(c.x - 0.6, c.y - 0.4, -0.1);
    }
    lastEv = v.evSeq || lastEv;
  };
  P.hide = () => { for (const p of pots) p.visible = false; incoming.visible = false; flyBack.visible = false; lamp.visible = false; ring.visible = false; };
  return P;
}
