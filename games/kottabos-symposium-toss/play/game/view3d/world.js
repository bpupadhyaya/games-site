// The Kottabos world: one lit 3D scene shared by the game presenter and the offline icon renderer. Everything here is presentation: the
// presenter hands in plain numbers each frame (cup, stands, basin, drops, aim paths) and this module places and animates the models.
// Metres; the sim's centimetres are divided by 100; the action plane is z = 0 and the camera looks along -z.
import { THREE, board3d as B, loadHuman, buildClip, FINGER_POSES } from '../vendor3d/index.js';
import { buildRoom } from './room.js';
import { createFigure } from './figure.js';
import { dressHimation } from './himation.js';
import { mats, makeKylix, makeStand, makeBasin, makeSaucer, makeKline, makeBolster, makeKrater, makeLampStand, makeTable, KYLIX } from './props.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const spriteTex = (draw, size = 128) => { const c = cv(size), g = c.getContext('2d'); draw(g, size); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
export const SIDE = [{ cloth: '#8a2f22', stripe: '#e9c46a', trim: '#1c1411' }, { cloth: '#4f6a1a', stripe: '#e9c46a', trim: '#1c1411' }];
export const HAND_CM = { x: 0, y: 34 };
const HOOK = { curl: [[0.34, 0.42, 0.24], [0.95, 1.05, 0.62], [1.18, 1.38, 0.9], [1.26, 1.5, 0.98], [1.3, 1.55, 1.0]], spread: [0.1, 0.0, 0.0, -0.02, -0.05] };
const REL = { curl: [[0.3, 0.38, 0.2], [0.55, 0.65, 0.4], [0.7, 0.8, 0.5], [0.78, 0.9, 0.55], [0.85, 0.95, 0.6]], spread: [0.1, 0.03, 0, -0.04, -0.1] };

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function buildWorld({ renderer = null, tier = 'high', side = 0, withExtras = true, onProgress = null, main: mainOpts = {} } = {}) {
  const V3 = await import('../vendor3d/index.js');
  const M = mats();
  const scene = new THREE.Scene();
  const root = new THREE.Group(); scene.add(root);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.2, 60);
  const shadowSize = tier === 'high' ? 2048 : tier === 'medium' ? 1024 : 0;
  const rig = B.lightingRig(scene, 'warmIndoor', {
    renderer, shadow: shadowSize, extent: 3.4, fog: { near: 11, far: 34 },
    target: [0.9, 0.45, 0],
    overrides: { bg: 0x120a06, fog: 0x1a0f09, hemiSky: 0xffd9b0, hemiGround: 0x3a2014, hemi: 0.5, key: 0xffd29a, keyI: 2.9, keyPos: [-2.2, 4.6, 4.2], fill: 0x8fa6e0, fillI: 0.28, fillPos: [4, 2, 5], rim: 0xff9a52, rimI: 1.7, rimPos: [3.6, 3.2, -4.2], exposure: 1.02, env: 0.32 },
  });
  rig.key.shadow.bias = -0.0006;
  let env = null;
  if (renderer) env = B.createEnvironment(renderer, scene, { intensity: 0.32 });

  const room = buildRoom(root, { tier });
  const W = { scene, camera, root, rig, tier, V3, handles: {}, ready: false, time: 0 };

  await tick();
  // ---- furniture -------------------------------------------------------------------------------------------------------------------
  const yawRad = (d) => (d * Math.PI) / 180;
  const FIGYAW = -46;
  const kline = makeKline({ blanket: SIDE[side].cloth, stripe: SIDE[side].stripe, length: 2.05, width: 0.8 });
  kline.position.set(-1.0, 0, -0.52); kline.rotation.y = yawRad(FIGYAW); // couch axis follows the figure's yaw
  root.add(kline); W.handles.kline = kline;
  const bolster = makeBolster(0.5, 0.1, '#ead9b4'); bolster.position.set(-0.62, 0.43, -0.90); bolster.rotation.y = yawRad(FIGYAW) + 0.2; root.add(bolster);
  // second and third couches with guests, tables, a krater, two lamp stands
  const k2 = makeKline({ blanket: '#2f4a72', stripe: '#e9c46a', length: 2.0, width: 0.78 }); k2.position.set(-1.5, 0, -2.3); k2.rotation.y = 0.05; root.add(k2);
  const k3 = makeKline({ blanket: '#5a2f55', stripe: '#e9c46a', length: 2.0, width: 0.78 }); k3.position.set(3.2, 0, -2.5); k3.rotation.y = -0.04; root.add(k3);
  const table = makeTable(); table.position.set(0.5, 0, -1.7); root.add(table);
  const table2 = makeTable(); table2.position.set(4.7, 0, -1.3); table2.rotation.y = -0.4; root.add(table2);
  const krater = makeKrater(0.62); krater.position.set(0.7, 0.34 + 0.025, -1.7); root.add(krater);
  const lamps = [];
  for (const [x, z, h] of [[-2.3, -1.3, 1.55], [5.0, -2.0, 1.7], [1.6, -2.8, 1.35]]) {
    const L = makeLampStand(h); L.position.set(x, 0, z); root.add(L);
    const flames = L.userData.flames.map((a) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.set(0.07, 0.13, 1); sp.position.copy(a).add(new THREE.Vector3(x, 0.0, z)); sp.position.y += 0.075; root.add(sp); return sp;
    });
    const pl = new THREE.PointLight(0xffa24a, 1.1, 7, 1.7); pl.position.set(x, h - 0.05, z + 0.2); root.add(pl);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    halo.scale.set(1.5, 1.5, 1); halo.position.set(x, h - 0.05, z + 0.1); root.add(halo);
    lamps.push({ flames, pl, base: 1.1, halo });
  }
  for (const [x, z, drop] of [[0.2, -0.9, 2.3], [2.6, -1.2, 2.0], [-1.4, -0.7, 2.6]]) {
    const L = new THREE.Group(); L.position.set(x, 4.9, z);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, drop, 6), M.bronzeDark); chain.position.y = -drop / 2; L.add(chain);
    const bowl = new THREE.Mesh(B.lathe([[0, 0], [0.09, 0.01], [0.15, 0.06], [0.16, 0.08], [0.14, 0.08], [0.08, 0.04], [0, 0.03]], 28), M.bronze); bowl.position.y = -drop - 0.02; bowl.castShadow = true; L.add(bowl);
    root.add(L);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.set(0.1, 0.18, 1); sp.position.set(x, 4.9 - drop + 0.1, z); root.add(sp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 })); halo.scale.set(1.6, 1.6, 1); halo.position.copy(sp.position); root.add(halo);
    const pl = new THREE.PointLight(0xffa24a, 1.0, 7, 1.7); pl.position.copy(sp.position); root.add(pl);
    lamps.push({ flames: [sp], pl, base: 1.0, halo });
  }
  W.handles.lamps = lamps;
  W.decor = [k2, k3, table, table2, krater];
  W.handles.bolster = bolster;
  function flameTex() {
    return W._flame || (W._flame = spriteTex((g, s) => {
      const gr = g.createRadialGradient(s / 2, s * 0.62, 0, s / 2, s * 0.62, s * 0.5);
      gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.3, 'rgba(255,200,90,0.95)'); gr.addColorStop(0.7, 'rgba(255,110,20,0.4)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(s / 2, s * 0.04); g.bezierCurveTo(s * 0.9, s * 0.45, s * 0.8, s * 0.95, s / 2, s * 0.98); g.bezierCurveTo(s * 0.2, s * 0.95, s * 0.1, s * 0.45, s / 2, s * 0.04); g.fill();
    }, 128));
  }
  function haloTex() {
    return W._halo || (W._halo = spriteTex((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(0.35, 'rgba(255,150,60,0.25)'); gr.addColorStop(1, 'rgba(255,100,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 128));
  }

  await tick();
  // ---- the figures -----------------------------------------------------------------------------------------------------------------
  const main = await createFigure(V3, { kit: { bottoms: SIDE[side].cloth, socks: SIDE[side].cloth, shoes: SIDE[side].cloth }, ...mainOpts, fig: { yaw: FIGYAW, ...(mainOpts.fig || {}) } });
  root.add(main.holder);
  W.fig = main;
  main.human.update(0);
  { const hp = main.holder.position, yw = yawRad(FIGYAW); kline.position.set(hp.x + 0.2 * Math.cos(yw), 0, hp.z - 0.2 * Math.sin(yw)); bolster.position.set(hp.x + 0.75 * Math.cos(yw), 0.43, hp.z - 0.75 * Math.sin(yw) - 0.12); }
  main.dress = dressHimation(V3, main.human, { cloth: SIDE[side].cloth, trim: SIDE[side].trim, edge: '#ead9b4' });
  // wreath of ivy around the head (leaf cards on a ring), riding the head bone
  {
    const head = main.human.bones.Bip01_Head, wr = new THREE.Group();
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f7a2a, roughness: 0.6, side: THREE.DoubleSide });
    const leaf = new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.02, 0.01, 0.03, 0.035, 0, 0.06); s.bezierCurveTo(-0.03, 0.035, -0.02, 0.01, 0, 0); return s; })());
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, m = new THREE.Mesh(leaf, leafMat);
      m.position.set(Math.cos(a) * 0.095, 0.06 + Math.sin(i * 1.7) * 0.008, Math.sin(a) * 0.098); m.rotation.set(-0.9 + (i % 3) * 0.2, -a + Math.PI / 2, (i % 2 ? 0.5 : -0.5)); m.scale.setScalar(1.2 + (i % 4) * 0.15); m.castShadow = true;
      wr.add(m);
    }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 8, 40), new THREE.MeshStandardMaterial({ color: 0x3b2a14, roughness: 0.8 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.058; wr.add(ring);
    // measure head: place at the head bone's world position, a little up and forward (character space), then bake into head-bone local
    head.updateWorldMatrix(true, false);
    const hp = head.getWorldPosition(new THREE.Vector3()), rq = main.human.root.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rq), fw = new THREE.Vector3(0, 0, 1).applyQuaternion(rq);
    wr.position.copy(hp).addScaledVector(up, 0.1).addScaledVector(fw, 0.012);
    wr.quaternion.copy(rq);
    wr.scale.setScalar(1.0);
    head.attach(wr);
    main.wreath = wr;
  }
  main.holder.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // guests (lighter weight): same man model on the back couches
  W.guests = [];
  if (withExtras && tier !== 'low') {
    const specs = [
      { x: -1.3, y: 0.40, z: -2.3, yaw: 6, roll: -18, cloth: '#2f4a72', top: '#d9cdb0', hair: 'black', skin: 'brown', pose: { Neck: { side: -12, twist: 10 }, Head: { side: -12, twist: 12 } } },
      { x: 3.1, y: 0.40, z: -2.5, yaw: -8, roll: -20, cloth: '#5a2f55', top: '#c9d0d8', hair: 'grey', skin: 'tan', pose: { Neck: { side: -10, twist: -12 }, Head: { side: -10, twist: -12 } } },
    ];
    for (const sp of specs) {
      try {
        const g = await createFigure(V3, { kit: { top: sp.top }, hair: sp.hair, skin: sp.skin, fig: { yaw: sp.yaw, roll: sp.roll, pos: [sp.x, sp.y, sp.z] }, pose: sp.pose });
        root.add(g.holder); g.human.update(0);
        g.dress = dressHimation(V3, g.human, { cloth: sp.cloth, trim: '#1c1411', edge: '#ead9b4' });
        g.holder.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        // one hand rests on the chest with a cup
        g.cup = makeKylix({}); g.cup.scale.setScalar(0.9); root.add(g.cup);
        g.cup.userData.setFill(1);
        const hb = g.human.bones.Bip01_R_Hand, hd = g.human.bones.Bip01_Head;
        g.rest = hb.getWorldPosition(new THREE.Vector3()); g.headPos = hd.getWorldPosition(new THREE.Vector3());
        g.react = { kind: '', t: 99, delay: 0 }; g.idx = W.guests.length; g.tgt = g.rest.clone(); g.look = new THREE.Vector3(1.4, 0.9, 0);
        g.nextSip = 3 + g.idx * 2.1; g.sip = 99;
        W.guests.push(g);
      } catch (e) { console.warn('guest failed', e); }
    }
  }

  await tick();
  // ---- the kylix in the player's hand ---------------------------------------------------------------------------------------------
  const kylix = makeKylix({}); root.add(kylix); W.kylix = kylix;

  await tick();
  // ---- targets: stands / basin ---------------------------------------------------------------------------------------------------
  const targets = new THREE.Group(); root.add(targets); W.targets = targets;
  let tgKey = '', stands = [], basin = null, saucers = [];
  W.setTargets = (sc) => {
    const key = sc ? JSON.stringify(sc.kind === 'stands' ? sc.stands : { x: sc.basin.x, b: sc.basin.bowls.map((b) => b.w) }) : '';
    if (key === tgKey) return; tgKey = key;
    for (const c of [...targets.children]) targets.remove(c);
    stands = []; basin = null; saucers = [];
    if (!sc) return;
    if (sc.kind === 'stands') {
      for (const s of sc.stands) {
        const st = makeStand(s);
        st.dish.material = st.dish.material.clone(); st.dish.material.emissive = new THREE.Color(0xffc060);
        const d = st.disc.children[0]; d.material = d.material.clone(); d.material.emissive = new THREE.Color(0xffd070);
        st.position.set(s.x / 100, 0, 0); targets.add(st); stands.push(st);
      }
    } else {
      basin = makeBasin(0.52, 0.12); basin.position.set(sc.basin.x / 100, 0, 0); targets.add(basin);
      sc.basin.bowls.forEach((b, i) => { const s = makeSaucer(b.w / 100, 0.042, i); s.userData.cap = b.cap; targets.add(s); saucers.push(s); });
    }
  };

  await tick();
  // ---- drops, guide paths, sparks -----------------------------------------------------------------------------------------------
  const DROPS = 12;
  const dropMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), M.drop, DROPS); dropMesh.frustumCulled = false; dropMesh.count = 0; root.add(dropMesh);
  const dropGlow = [];
  for (let i = 0; i < DROPS; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0x8fdfff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    sp.scale.set(0.09, 0.09, 1); sp.visible = false; root.add(sp); dropGlow.push(sp);
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);

  const dotTex = spriteTex((g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }, 64);
  const mkPoints = (n, size, additive = false, depthTest = false) => {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: true, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, depthTest, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 1 });
    const p = new THREE.Points(geo, m); p.frustumCulled = false; p.renderOrder = 10; p.userData.n = n; geo.setDrawRange(0, 0); root.add(p); return p;
  };
  const pathPts = [mkPoints(72, 0.034), mkPoints(72, 0.024), mkPoints(72, 0.024), mkPoints(72, 0.03), mkPoints(72, 0.03), mkPoints(72, 0.028)];
  const sparks = mkPoints(300, 0.05, true, true); sparks.renderOrder = 12;
  const spark = { x: new Float32Array(300 * 3), v: new Float32Array(300 * 3), life: new Float32Array(300), max: new Float32Array(300), col: new Float32Array(300 * 3), size: new Float32Array(300), n: 0, gravity: new Float32Array(300) };
  const colObj = new THREE.Color();
  W.spawn = (xcm, ycm, n, { speed = 1.4, up = 0.6, spread = 1, col = '#bfeaff', life = 0.6, grav = 6.5, zs = 0.25, dirx = 0, diry = 0 } = {}) => {
    colObj.set(col);
    for (let k = 0; k < n; k++) {
      const i = spark.n < 300 ? spark.n++ : Math.floor(Math.random() * 300), a = Math.random() * TAU, sp = speed * (0.35 + Math.random() * 0.75);
      spark.x[i * 3] = xcm / 100; spark.x[i * 3 + 1] = ycm / 100; spark.x[i * 3 + 2] = (Math.random() - 0.5) * 0.05;
      spark.v[i * 3] = (Math.cos(a) * sp * spread + dirx); spark.v[i * 3 + 1] = Math.abs(Math.sin(a)) * sp * 0.8 + up * (0.4 + Math.random()) + diry; spark.v[i * 3 + 2] = (Math.random() - 0.5) * zs * sp;
      spark.max[i] = spark.life[i] = life * (0.6 + Math.random() * 0.8); spark.gravity[i] = grav;
      spark.col[i * 3] = colObj.r; spark.col[i * 3 + 1] = colObj.g; spark.col[i * 3 + 2] = colObj.b;
    }
  };
  const stepSparks = (dt) => {
    const pos = sparks.geometry.attributes.position, col = sparks.geometry.attributes.color;
    let w = 0;
    for (let i = 0; i < spark.n; i++) {
      if (spark.life[i] <= 0) continue;
      spark.life[i] -= dt;
      if (spark.life[i] <= 0) continue;
      spark.v[i * 3 + 1] -= spark.gravity[i] * dt;
      for (let c = 0; c < 3; c++) spark.x[i * 3 + c] += spark.v[i * 3 + c] * dt;
      const a = clamp(spark.life[i] / spark.max[i], 0, 1);
      pos.setXYZ(w, spark.x[i * 3], spark.x[i * 3 + 1], spark.x[i * 3 + 2]); col.setXYZ(w, spark.col[i * 3] * a, spark.col[i * 3 + 1] * a, spark.col[i * 3 + 2] * a); w++;
      if (w >= 300) break;
    }
    // compact
    pos.needsUpdate = col.needsUpdate = true; sparks.geometry.setDrawRange(0, w);
    if (w === 0) spark.n = 0;
  };
  W.paths = (list) => {
    for (let i = 0; i < pathPts.length; i++) {
      const P = pathPts[i], it = list && list[i];
      if (!it || !it.pts.length) { P.geometry.setDrawRange(0, 0); continue; }
      const pos = P.geometry.attributes.position, col = P.geometry.attributes.color;
      colObj.set(it.col || '#ffffff');
      const n = Math.min(P.userData.n, it.pts.length);
      for (let k = 0; k < n; k++) { pos.setXYZ(k, it.pts[k][0] / 100, it.pts[k][1] / 100, 0.02); const f = it.fade ? 1 - k / n * 0.6 : 1; col.setXYZ(k, colObj.r * f, colObj.g * f, colObj.b * f); }
      pos.needsUpdate = col.needsUpdate = true; P.geometry.setDrawRange(0, n);
      P.material.size = it.size || 0.03; P.material.opacity = it.alpha ?? 0.9;
    }
  };

  await tick();
  // ---- the ripple canvas on the basin ----------------------------------------------------------------------------------------------
  const ripples = [];
  W.ripple = (xcm, strength = 1) => { ripples.push({ x: xcm / 100, t: 0, s: strength }); if (ripples.length > 14) ripples.shift(); };
  const paintRipples = (dt) => {
    if (!basin) return;
    const r = basin.userData.ripple, g = r.ctx, S = r.canvas.width;
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    const R = basin.userData.R * 0.956, cx = basin.position.x;
    for (const q of ripples) { q.t += dt; }
    for (let i = ripples.length - 1; i >= 0; i--) if (ripples[i].t > 1.4) ripples.splice(i, 1);
    g.lineWidth = 3;
    for (const q of ripples) {
      const u = ((q.x - cx) / R) * 0.5 + 0.5, rad = (0.02 + q.t * 0.16) / (2 * R) * S, a = clamp(1 - q.t / 1.4, 0, 1) * q.s;
      for (let k = 0; k < 3; k++) { g.strokeStyle = k % 2 ? `rgba(255,255,255,${0.5 * a})` : `rgba(0,0,0,${0.5 * a})`; g.beginPath(); g.ellipse(u * S, S / 2, Math.max(1, rad - k * 4), Math.max(1, rad - k * 4), 0, 0, TAU); g.stroke(); }
    }
    r.tex.needsUpdate = true;
  };

  await tick();
  // ---- camera ----------------------------------------------------------------------------------------------------------------------
  // cam = { ox, cx, cy, my, s }: screen X = ox + (x - cx) * s, Y = my - (y - cy) * s in a VW x VH frame, x/y in centimetres, s px per cm.
  // A perspective camera at distance D looking along -z, with an oblique shear so horizontal surfaces show their tops while the plane
  // z = 0 stays exactly where the 2D overlay (guides, floats) expects it.
  const D = 4.6;
  W.setView = (cam, VW, VH, { shear = 0.20, shake = 0, t = 0, near = 0.3, far = 40 } = {}) => {
    const f = cam.s * 100 * D;          // px per metre at the action plane times D
    const ox = cam.ox + Math.sin(t * 90) * shake * 5, my = cam.my + Math.cos(t * 77) * shake * 4;
    camera.position.set(cam.cx / 100, cam.cy / 100, D);
    camera.quaternion.identity();
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const m = camera.projectionMatrix;
    const k = shear;
    m.set(
      2 * f / VW, 0, -(2 * ox - VW) / VW, 0,
      0, 2 * f / VH, -(2 * f * k) / VH - (VH - 2 * my) / VH, -2 * f * k * D / VH,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(m).invert();
    camera.userData.view = { f, ox, my, VW, VH, shear: k };
  };
  // project a world point (metres) to the virtual frame
  const _v = new THREE.Vector3();
  W.project = (x, y, z) => { _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix); const v = camera.userData.view; return { x: (_v.x + 1) / 2 * v.VW, y: (1 - _v.y) / 2 * v.VH }; };

  // a reaction for the guests: 'cheer' (cup up, head toward the stand) or 'groan' (head shake, hand drops), each a little later for the farther guest
  W.react = (kind, strength = 1) => { W.guests.forEach((g, i) => { g.react = { kind, t: -(0.18 + i * 0.22 + (kind === 'groan' ? 0.15 : 0)), strength }; }); };
  const _gt = new THREE.Vector3(), _gp = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function updateGuests(dt, fr) {
    const t = W.time;
    for (const g of W.guests) {
      const h = g.human, r = g.react, i = g.idx;
      r.t += dt;
      // base: a slow sway of the cup hand, and a sip every few seconds
      g.nextSip -= dt; if (g.nextSip <= 0) { g.sip = 0; g.nextSip = 6 + (i * 3.1 + Math.sin(t) * 0.5) % 5; }
      g.sip += dt;
      _gt.copy(g.rest); _gt.x += Math.sin(t * 0.8 + i * 2) * 0.018; _gt.y += Math.sin(t * 1.3 + i) * 0.012;
      let wsip = 0; if (g.sip < 2.4) wsip = Math.sin(Math.min(1, g.sip / 2.4) * Math.PI);
      if (wsip > 0) { _gp.copy(g.headPos); _gp.y -= 0.1; _gp.z += 0.14; _gp.x += 0.06; _gt.lerp(_gp, 0.85 * wsip); }
      let lookAtStand = 0.35 + 0.3 * Math.sin(t * 0.3 + i);
      let shake = 0, cheer = 0;
      if (r.kind && r.kind !== 'none' && r.t > 0) {
        const k = r.t;
        if (r.kind === 'cheer') { cheer = Math.sin(clamp(k / 0.45, 0, 1) * Math.PI / 2) * (k < 1.7 ? 1 : Math.max(0, 1 - (k - 1.7) / 0.5)); lookAtStand = 1; if (k > 2.3) r.kind = ''; }
        else if (r.kind === 'groan') { shake = k < 1.4 ? Math.sin(k * 11) * 0.5 * Math.exp(-k * 1.2) : 0; _gt.y -= 0.05 * Math.min(1, k * 3); lookAtStand = 0.2; if (k > 1.8) r.kind = ''; }
      }
      if (cheer > 0) { _gp.copy(g.rest); _gp.y += 0.38 * r.strength; _gp.x += 0.12; _gp.z += 0.12; _gt.lerp(_gp, cheer); }
      g.tgt.lerp(_gt, 1 - Math.exp(-dt * 7));
      h.setReach('R', g.tgt, { weight: 1, pole: { x: g.tgt.x - 0.15, y: g.tgt.y - 0.5, z: g.tgt.z + 0.35 } });
      h.setFingers('R', HOOK, { rate: 1000 }); h.setFingers('L', REL, { rate: 1000 });
      // head: toward the target (or the player), with a shake on a groan
      const tx = fr && fr.look ? fr.look.x : 1.4, ty = fr && fr.look ? fr.look.y : 0.9;
      _gp.set(lookAtStand > 0.5 ? tx : -0.9, lookAtStand > 0.5 ? ty : 0.7, 0.2 + shake * 0.6);
      g.look.lerp(_gp, 1 - Math.exp(-dt * 3));
      h.lookAt({ x: g.look.x, y: g.look.y, z: g.look.z }, { weight: 0.8, maxYaw: 0.9, maxPitch: 0.5 });
      h.update(dt);
      const hb = h.bones.Bip01_R_Hand;
      if (hb && g.cup) { hb.getWorldPosition(g.cup.position); g.cup.position.y += 0.015; g.cup.rotation.set(0.05, 0.3, 0.12 + 0.2 * (wsip > 0 ? 1 : 0)); }
    }
  }

  await tick();
  // ---- per-frame update -----------------------------------------------------------------------------------------------------------
  const sm = { hx: HAND_CM.x, hy: HAND_CM.y, hvx: 0, hvy: 0, tl: 0, tlv: 0, off: new THREE.Vector3(), charge: 0, snap: 0, cv: 0, sv: 0, look: new THREE.Vector3(1.2, 0.8, 0), lookv: 0 };
  const spring = (cur, vel, target, w, dt) => { const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { vel += (w * w * (target - cur) - 2 * w * vel) * h; cur += vel * h; } return [cur, vel]; };
  const _wr = new THREE.Vector3(), _pole = new THREE.Vector3();
  W.update = (dt, fr) => {
    W.time += dt;
    const t = W.time;
    // lamps
    for (const [i, l] of lamps.entries()) {
      let sum = 0;
      l.flames.forEach((f, k) => { const n = 0.5 + 0.5 * Math.sin(t * (9 + k * 2.3) + i * 3 + k) * Math.sin(t * 3.1 + k * 1.3); f.scale.set(0.06 + 0.012 * (1 - n), 0.11 + 0.04 * n, 1); f.material.rotation = Math.sin(t * 4.3 + k + i) * 0.05; sum += n; });
      const fl = sum / l.flames.length; l.pl.intensity = l.base * (0.86 + 0.3 * fl); l.halo.material.opacity = 0.45 + 0.2 * fl;
    }
    rig.key.intensity = rig.config.keyI * (1 + 0.025 * Math.sin(t * 6.1) + 0.015 * Math.sin(t * 11.3));
    // the player's cup and arm
    if (fr) {
      [sm.charge, sm.cv] = spring(sm.charge, sm.cv, fr.charge || 0, 18, dt);
      [sm.snap, sm.sv] = spring(sm.snap, sm.sv, fr.snap || 0, 30, dt);
      const hp0 = fr.hand || { x: HAND_CM.x, y: HAND_CM.y };
      // critically damped springs: the cup and the wrist never copy the sim's per-frame values straight (no pops, no jitter)
      [sm.hx, sm.hvx] = spring(sm.hx, sm.hvx, hp0.x, 26, dt); [sm.hy, sm.hvy] = spring(sm.hy, sm.hvy, hp0.y, 26, dt);
      [sm.tl, sm.tlv] = spring(sm.tl, sm.tlv, fr.tilt || 0, 22, dt);
      const hp = { x: sm.hx, y: sm.hy };
      const tilt = sm.tl;                  // radians about z (counter-clockwise positive, y up)
      kylix.position.set(hp.x / 100, hp.y / 100 + 0.1, 0.5);
      kylix.rotation.set(0, 0, tilt);
      kylix.userData.setFill(fr.loaded === false ? 0 : 1);
      // right wrist target: the near handle of the cup (left of the bowl in the cup's frame)
      const hx = -(KYLIX.R + 0.0165 + 0.03), cs = Math.cos(tilt), sn = Math.sin(tilt);
      _wr.set(kylix.position.x + cs * hx, kylix.position.y + sn * hx - 0.008, 0.5).add(sm.off);
      _pole.set(_wr.x - 0.35, _wr.y - 0.45, _wr.z + 0.25);
      main.human.setReach('R', _wr, { weight: 1, pole: _pole });
      main.human.setFingers('R', HOOK, { rate: 1000 });
      main.human.setFingers('L', REL, { rate: 1000 });
      // look: toward the cup before the flick, the target while the drops fly
      const lt = fr.look || { x: 1.4, y: 0.9 };
      if (!sm.init) { sm.init = 1; sm.look.set(lt.x, lt.y, 0.1); sm.hx = hp0.x; sm.hy = hp0.y; sm.tl = fr.tilt || 0; }
      _p.set(lt.x, lt.y, 0.1);
      sm.look.lerp(_p, 1 - Math.exp(-dt * 2.2));
      main.human.lookAt({ x: sm.look.x, y: sm.look.y, z: sm.look.z }, { weight: 0.85, maxYaw: 0.9, maxPitch: 0.6 });
    }
    main.human.update(dt);
    // hook the index finger through the near handle: measure the fingertip against the handle ring and nudge the wrist target (smoothed)
    if (fr) {
      const tip = main.human.bones.Bip01_R_Finger12;
      if (tip) {
        kylix.updateMatrixWorld(true);
        const ring = new THREE.Vector3(-(KYLIX.R + 0.0165), -0.006, 0).applyMatrix4(kylix.matrixWorld), tp = tip.getWorldPosition(new THREE.Vector3());
        const err = ring.sub(tp);
        if (err.length() > 0.2) err.setLength(0.2);
        sm.off.addScaledVector(err, Math.min(1, dt * 3)).clampLength(0, 0.2);
      }
    }
    if (main.cloth) main.cloth.step(dt);
    updateGuests(dt, fr);
    // targets
    if (fr && fr.stands) fr.stands.forEach((s, i) => {
      const st = stands[i]; if (!st) return;
      st.disc.position.set(s.pose.x / 100 - st.position.x, s.pose.y / 100, 0); st.disc.rotation.z = s.pose.rot;
      st.disc.visible = !s.gone;
      const e = clamp(s.ring || 0, 0, 1) * 1.1 + (s.glow || 0) * 0.6;
      st.dish.material.emissiveIntensity = e; st.disc.children[0].material.emissiveIntensity = (s.glow || 0) * 0.8 + (s.ring || 0) * 0.3;
    });
    if (fr && fr.basin && basin) {
      fr.basin.bowls.forEach((b, i) => {
        const s = saucers[i]; if (!s) return;
        s.visible = !b.gone;
        s.position.set(b.x / 100, b.y / 100, 0.0); s.rotation.z = b.tilt || 0;
        s.userData.water.visible = b.fill > 0.02; s.userData.water.position.y = s.userData.h * (0.08 + 0.55 * clamp(b.fill, 0, 1));
        s.userData.water.scale.setScalar(0.4 + 0.6 * clamp(b.fill, 0, 1));
        s.children[0].material.emissive = s.children[0].material.emissive || new THREE.Color();
      });
    }
    // drops
    const dr = (fr && fr.drops) || [];
    dropMesh.count = Math.min(DROPS, dr.length);
    for (let i = 0; i < DROPS; i++) {
      const sp = dropGlow[i], d = dr[i];
      if (!d) { sp.visible = false; continue; }
      const rr = clamp(d.size * 0.0085, 0.007, 0.016), speed = Math.hypot(d.vx, d.vy), len = clamp(speed * 0.00006, 1, 3.4);
      _q.setFromAxisAngle(_z, Math.atan2(d.vy, d.vx)); _s.set(rr * len, rr, rr); _p.set(d.x / 100, d.y / 100 + 0.1, 0.3);
      _m.compose(_p, _q, _s); dropMesh.setMatrixAt(i, _m);
      sp.visible = true; sp.position.copy(_p); sp.scale.setScalar(0.08);
    }
    dropMesh.instanceMatrix.needsUpdate = true;
    paintRipples(dt);
    stepSparks(dt);
  };

  W.ready = true;
  return W;
}
