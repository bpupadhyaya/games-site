// Kolf 3D court: a real lit WebGL scene (ice, boards, canal houses, mills, ships, spectators, skaters, the player) rendered to an
// offscreen canvas with the SAME pinhole camera the 2D court uses, then composited into the 2D frame by view.js (HUD stays 2D).
// Presentation only: it reads the scene description S (court, ball states, guide, particles, events) and never writes back.
import { makeKit, STYLE3, lcg, hashStr } from './world.js';
import { loadPlayer, loadSkater } from './people.js';
import { moverPos, windAt, BR } from '../src/sim.js';

const LIB = '../vendor3d/index.js';
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const BALL_R = 0.042;            // real kolf ball is about 6.5 cm across; drawn at 1.3x so it reads
const LUNGE = 0.5;
const IMPACT = 1.82;   // clip time at which the club head passes the ball in the golf-swing mocap
const STRIDE_FREE = 3.4, STRIDE_HB = 4.6;   // metres of ice per full skating cycle (player, long-track skaters)

export async function createCourt3D({ quality = 'high' } = {}) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { return null; }
  const { createStage, THREE, board3d: B } = V3;
  const canvas = document.createElement('canvas');
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:8px;height:8px;overflow:hidden;pointer-events:none';
  holder.appendChild(canvas); document.body.appendChild(holder);
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 1, lighting: 'day', shadows: quality !== 'low', shadowSize: 15, mode: 'ondemand', preserveDrawingBuffer: true }); } catch (e) { holder.remove(); return null; }
  if (!stage || !stage.supported) { holder.remove(); return null; }
  const K = makeKit(V3);
  const scene = stage.scene, camera = stage.camera;
  camera.near = 0.25; camera.far = 700; camera.matrixAutoUpdate = true;
  let lost = false, tier = quality;
  stage.onContextLost(() => { lost = true; });
  stage.onContextRestored(() => { lost = false; stage.invalidate(); });

  // ---- light and atmosphere ----------------------------------------------------------------------------------------------
  stage.setLighting('day', { hemi: 0.95, hemiSky: 0xdfe8f4, hemiGround: 0xc9bfa8, key: 0xffe0aa, keyI: 2.9, rim: 0xb8cfff, rimI: 0.9, exposure: 1.05 });
  stage._shadowOffset.set(-9, 12, 7);
  stage.lights.rim.position.set(5, 5, -8);
  const FOG = new THREE.Color('#ecd9b0');
  scene.fog = new THREE.Fog(FOG, 70, 330);

  // sky dome (vertex-coloured gradient, follows the camera)
  const sky = (() => {
    const g = new THREE.SphereGeometry(500, 24, 14), p = g.attributes.position, col = [];
    const st = STYLE3.canal, c0 = new THREE.Color(st.sky[2]), c1 = new THREE.Color(st.sky[1]), c2 = new THREE.Color(st.sky[0]), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 500;
      if (y < 0.0) c.copy(c0); else if (y < 0.28) c.copy(c0).lerp(c1, y / 0.28); else c.copy(c1).lerp(c2, clamp((y - 0.28) / 0.6, 0, 1));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    m.renderOrder = -10; m.frustumCulled = false; scene.add(m);
    return { mesh: m, geo: g, set(style) {
      const s = STYLE3[style] || STYLE3.canal, a = new THREE.Color(s.sky[2]), b = new THREE.Color(s.sky[1]), d = new THREE.Color(s.sky[0]), cc = new THREE.Color(), arr = g.attributes.color;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i) / 500;
        if (y < 0.0) cc.copy(a); else if (y < 0.28) cc.copy(a).lerp(b, y / 0.28); else cc.copy(b).lerp(d, clamp((y - 0.28) / 0.6, 0, 1));
        arr.setXYZ(i, cc.r, cc.g, cc.b);
      }
      arr.needsUpdate = true; FOG.set(s.fog); scene.fog.color.copy(FOG);
    } };
  })();
  // low winter sun: a soft glow sprite and a few drifting cloud banks
  const glowTex = (() => { const c = K.cv(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,240,200,0.85)'); gr.addColorStop(0.2, 'rgba(255,225,160,0.4)'); gr.addColorStop(1, 'rgba(255,210,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return K.tex(c); })();
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
  sun.renderOrder = -9; scene.add(sun);
  const cloudTex = (() => { const c = K.cv(256, 96), g = c.getContext('2d'), r = lcg(4); for (let i = 0; i < 26; i++) { const x = 40 + r() * 176, y = 30 + r() * 36, rad = 14 + r() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,248,232,0.5)'); gr.addColorStop(1, 'rgba(255,240,215,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); } return K.tex(c); })();
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(220, 80), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
    const a = i / 7 * TAU + 0.3, R = 380; m.position.set(Math.sin(a) * R, 80 + (i % 3) * 30, -Math.cos(a) * R); m.userData.a = a; m.userData.R = R; m.userData.h = m.position.y; m.renderOrder = -8; scene.add(m); clouds.push(m);
  }

  // ---- ground: an endless snow-dusted frozen polder ------------------------------------------------------------------------
  const snowMat = new THREE.MeshStandardMaterial({ map: K.snowTex(), roughness: 0.95, color: '#f6f6f0' });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), snowMat); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; scene.add(ground);

  // ---- persistent dynamic things --------------------------------------------------------------------------------------------
  const world = new THREE.Group(); scene.add(world);          // rebuilt per court
  const dyn = new THREE.Group(); scene.add(dyn);

  // balls
  const seamTex = (() => { const c = K.cv(128, 64), g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64); g.strokeStyle = 'rgba(70,40,15,0.75)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 32); g.bezierCurveTo(32, 12, 96, 52, 128, 32); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(0, 36); g.bezierCurveTo(32, 16, 96, 56, 128, 36); g.stroke(); return K.tex(c); })();
  const balls = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 22, 16), new THREE.MeshStandardMaterial({ map: seamTex, color: '#ffffff', roughness: 0.42, metalness: 0.02 }));
    m.castShadow = true; m.visible = false;
    const sh = B.contactShadow(BALL_R * 3.2, 0.5); sh.position.y = -BALL_R + 0.004; m.add(sh);
    m.userData.shadow = sh; m.userData.last = null; m.userData.q = new THREE.Quaternion();
    dyn.add(m); balls.push(m);
  }
  // current-ball halo + hovering marker
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 40), new THREE.MeshBasicMaterial({ color: '#fff0b8', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; halo.visible = false; dyn.add(halo);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 0.07, 0.16, 10), new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#a06800', emissiveIntensity: 0.6, roughness: 0.4 }));
  marker.rotation.x = Math.PI; marker.visible = false; dyn.add(marker);
  // aiming guide: gold dots on the ice and a landing ring
  const GN = 56;
  const guideDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.075, 10), new THREE.MeshBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.92, depthWrite: false }), GN);
  guideDots.frustumCulled = false; guideDots.count = 0; dyn.add(guideDots);
  const guideEnd = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.0, 36), new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  guideEnd.rotation.x = -Math.PI / 2; guideEnd.visible = false; dyn.add(guideEnd);
  // trails: flat strips lying on the ice
  const TN = 40, trails = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TN * 2 * 3), 3)); g.setIndex((() => { const ix = []; for (let k = 0; k < TN - 1; k++) { const a = k * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } return ix; })());
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.visible = false; dyn.add(m); trails.push(m);
  }
  // particle pools: ice shards / rings / confetti from the sim, and snow powder + breath from the presenter
  const PN = 160;
  const mkPool = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.frustumCulled = false; m.count = 0; dyn.add(m); return m; };
  const shardPool = mkPool(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3 }), PN);
  const ringPool = mkPool(new THREE.RingGeometry(0.9, 1.0, 28), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }), 24);
  const confPool = mkPool(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), PN);
  const PWN = 72;
  const powder = mkPool(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false }), PWN);
  const puffs = [];   // { x,y,z, vx,vy,vz, age, life, r0, r1 } three-space
  const addPuff = (x, y, z, vx, vy, vz, life, r0, r1) => { if (puffs.length >= PWN) puffs.shift(); puffs.push({ x, y, z, vx, vy, vz, age: 0, life, r0, r1 }); };
  // blowing snow
  const SN = quality === 'low' ? 90 : 220;
  const snowPts = (() => {
    const g = new THREE.BufferGeometry(), arr = new Float32Array(SN * 3), r = lcg(5);
    for (let i = 0; i < SN; i++) { arr[i * 3] = (r() - 0.5) * 40; arr[i * 3 + 1] = r() * 14; arr[i * 3 + 2] = (r() - 0.5) * 40; }
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 0.075, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
    p.frustumCulled = false; scene.add(p); return { pts: p, arr };
  })();

  // ---- people ---------------------------------------------------------------------------------------------------------------
  const lodHero = tier === 'high' ? 0 : 1;
  let player = null, skaters = [], rider = null, ready = false;
  const loading = (async () => {
    try { player = await loadPlayer(V3, { lod: lodHero }); player.human.root.visible = false; stage.add(player.human); player.human.play('idle', { fade: 0 }); } catch (e) { console.warn('kolf player failed', e); }
    stage.invalidate();
    const nSk = tier === 'high' ? 6 : tier === 'medium' ? 4 : 2;
    for (let i = 0; i < nSk; i++) {
      try {
        const h = await loadSkater(V3, i, { lod: 1 }); h.root.visible = false; stage.add(h); h.play('skate_hb', { fade: 0, speed: 0 });
        skaters.push({ h, i, t: 0, y: 0, lane: 0, v: 0, yaw: 0 });
      } catch (e) { console.warn('kolf skater failed', e); }
    }
    try { rider = await loadSkater(V3, 7, { lod: 1 }); rider.root.visible = false; stage.add(rider); rider.play('sledge_sit', { fade: 0 }); } catch (e) { /* optional */ }
    ready = true; stage.invalidate();
  })();

  // ---- per-court world ------------------------------------------------------------------------------------------------------
  let built = null;     // { id, post, startPost, sledges:[], mill hubs, flag, crowd }
  let crowd = null;
  const disposeGroup = (g) => {
    g.traverse((o) => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); if (o.material) for (const m of [].concat(o.material)) { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); } });
    while (g.children.length) g.remove(g.children[0]);
  };
  const inst = (geo, mat, items, { cast = false, tint = null } = {}) => {
    const m = new THREE.InstancedMesh(geo, mat, items.length), o = new THREE.Object3D(), c = new THREE.Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y || 0, it.z); o.rotation.set(0, it.ry || 0, 0); o.scale.setScalar(it.s || 1); if (it.sx) o.scale.x = it.sx; o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      if (tint) { c.set(it.c || '#ffffff'); m.setColorAt(i, c); }
    });
    m.castShadow = cast; m.receiveShadow = false; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    return m;
  };

  function buildCourt(court, style) {
    disposeGroup(world);
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    const W = court.W, L = court.L, r = lcg(hashStr(`k3-${court.id}`));
    const info = { id: court.id, W, L, mills: [], sledges: [], ships: [] };
    sky.set(style);

    // ice
    const iceTex = K.tex(K.iceCanvas(court), { aniso: 8 });
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(W, L), new THREE.MeshPhysicalMaterial({ map: iceTex, roughness: 0.2, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1 }));
    ice.rotation.x = -Math.PI / 2; ice.position.set(W / 2, 0, -L / 2); ice.receiveShadow = true; world.add(ice);
    // frozen canal beyond the boards: a larger paler sheet
    const open = new THREE.Mesh(new THREE.PlaneGeometry(W + 70, L + 90), new THREE.MeshStandardMaterial({ color: '#b9d0d4', roughness: 0.35, metalness: 0 }));
    open.rotation.x = -Math.PI / 2; open.position.set(W / 2, -0.012, -L / 2); open.receiveShadow = true; world.add(open);

    // snow banks along both sides, a rounded mound outside the boards
    const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.lineTo(0, 0.5); prof.bezierCurveTo(0.9, 0.62, 2.0, 0.42, 3.0, 0.2); prof.bezierCurveTo(3.6, 0.1, 4.2, 0.03, 5.0, 0); prof.closePath();
    const bankGeo = new THREE.ExtrudeGeometry(prof, { depth: L + 16, bevelEnabled: false });
    bankGeo.translate(0, 0, -(L + 16));
    const bankMat = snowMat.clone(); bankMat.side = THREE.DoubleSide;
    const bankR = new THREE.Mesh(bankGeo, bankMat); bankR.position.set(W, 0, 8); bankR.receiveShadow = true; world.add(bankR);
    const bankL = new THREE.Mesh(bankGeo, bankMat); bankL.scale.x = -1; bankL.position.set(0, 0, 8); bankL.receiveShadow = true; world.add(bankL);

    // boards: planks between posts, a top rail dusted with snow
    const plank = K.plankTex(), hh = 0.85, inset = 0.1;
    const segLen = 4;
    const segs = [];
    const nL = Math.ceil(L / segLen), nW = Math.ceil(W / segLen);
    for (let i = 0; i < nL; i++) { const y0 = i * segLen, y1 = Math.min(L, y0 + segLen); segs.push({ x: inset, z: -(y0 + y1) / 2, ry: Math.PI / 2, len: y1 - y0, side: 0 }); segs.push({ x: W - inset, z: -(y0 + y1) / 2, ry: Math.PI / 2, len: y1 - y0, side: 1 }); }
    for (let i = 0; i < nW; i++) { const x0 = i * segLen, x1 = Math.min(W, x0 + segLen); segs.push({ x: (x0 + x1) / 2, z: -inset, ry: 0, len: x1 - x0, side: 2 }); segs.push({ x: (x0 + x1) / 2, z: -(L - inset), ry: 0, len: x1 - x0, side: 3 }); }
    const bg = new THREE.BoxGeometry(1, hh, 0.12);
    const bm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ map: plank, roughness: 0.8, color: '#b89868' }), segs.length), o = new THREE.Object3D();
    const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.2), new THREE.MeshStandardMaterial({ color: '#f1f0e8', roughness: 0.9 }), segs.length);
    const rl = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 0.19), new THREE.MeshStandardMaterial({ color: '#d0aa6c', roughness: 0.7 }), segs.length);
    segs.forEach((s, i) => { o.position.set(s.x, hh / 2, s.z); o.rotation.set(0, s.ry, 0); o.scale.set(s.len, 1, 1); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); o.position.set(s.x, hh + 0.08, s.z); o.updateMatrix(); rm.setMatrixAt(i, o.matrix); o.position.set(s.x, hh + 0.02, s.z); o.updateMatrix(); rl.setMatrixAt(i, o.matrix); });
    bm.castShadow = true; bm.receiveShadow = true; world.add(bm, rm, rl);
    const posts = []; for (let y = 0; y <= L + 0.01; y += segLen) { posts.push({ x: inset, y: 0.5, z: -y }, { x: W - inset, y: 0.5, z: -y }); }
    for (let x = segLen; x < W - 0.01; x += segLen) { posts.push({ x, y: 0.5, z: -inset }, { x, y: 0.5, z: -(L - inset) }); }
    world.add(inst(new THREE.BoxGeometry(0.18, 1.0, 0.18), new THREE.MeshStandardMaterial({ color: '#4a3418', roughness: 0.85 }), posts, { cast: true }));

    // bridges over thin ice
    for (const b of court.bridges) {
      const bw = b.x1 - b.x0, bl = b.y1 - b.y0;
      const t = K.plankTex('#a07a44'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, Math.max(1, Math.round(bl / 0.6) / 1));
      const deck = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.16, bl), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, color: '#c9a468' }));
      deck.position.set((b.x0 + b.x1) / 2, 0.08, -(b.y0 + b.y1) / 2); deck.castShadow = true; deck.receiveShadow = true; world.add(deck);
      for (const s of [b.x0, b.x1]) for (let y = b.y0; y <= b.y1 + 0.01; y += 3) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), new THREE.MeshStandardMaterial({ color: '#4a3418' })); p.position.set(s, 0.25, -y); world.add(p); }
    }
    // drifts of snow on the snow patches
    for (const s of court.snow) {
      const w = s.x1 - s.x0 + 0.6, d = s.y1 - s.y0 + 0.6;
      const drift = new THREE.Mesh(B.slab(w, d, 0.07, Math.min(w, d) * 0.35, 0.03), new THREE.MeshStandardMaterial({ color: '#f9f9f4', roughness: 0.95 }));
      drift.position.set((s.x0 + s.x1) / 2, 0, -(s.y0 + s.y1) / 2);
      drift.receiveShadow = true; world.add(drift);
    }
    // obstacles
    for (const c of court.circles) { const p = K.buildPier(c); p.position.set(c.x, 0, -c.y); world.add(p); }
    for (const b of court.boxes) { const g = K.buildBoat(b); g.position.set((b.x0 + b.x1) / 2, 0, -(b.y0 + b.y1) / 2); world.add(g); }
    info.post = K.buildPost({ h: 3.6, r: 0.5, flag: true }); world.add(info.post);
    info.startPost = K.buildPost({ h: 2.6, r: 0.5, flag: false }); world.add(info.startPost);
    for (const m of court.movers) { const g = K.buildSledge(); world.add(g); info.sledges.push({ g, m, last: null }); }

    // ---- the Dutch town around the court ------------------------------------------------------------------------------------
    const kinds = K.VARIANTS, geos = {};
    const brickMat = (c) => new THREE.MeshStandardMaterial({ map: K.brickTex(), color: c, roughness: 0.92 });
    const detMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const palette = ['#c9805e', '#b36a4c', '#d6a070', '#9c5b44', '#c4a27a', '#a8806a', '#8f5a48', '#d9b58c'];
    const items = {}; kinds.forEach((k) => { items[k] = []; });
    const place = (x, y, ry, kind, scale = 1) => { items[kind].push({ x, y: 0, z: -y, ry, s: scale, c: palette[Math.floor(r() * palette.length)] }); };
    const style3 = style;
    const rowX = [-17, -16.4]; const stepY = 4.4;
    const mixKinds = style3 === 'harbour' ? ['warehouse', 'plain', 'stepped', 'warehouse', 'neck'] : style3 === 'mill' ? ['plain', 'stepped', 'neck', 'plain', 'spout'] : ['stepped', 'bell', 'neck', 'spout', 'stepped', 'bell', 'plain'];
    for (let y = -10; y < L + 14; y += stepY * (0.95 + r() * 0.2)) {
      const kl = mixKinds[Math.floor(r() * mixKinds.length)], kr = mixKinds[Math.floor(r() * mixKinds.length)];
      place(-17 - r() * 1.5, y, Math.PI / 2, kl, 0.92 + r() * 0.2);
      place(W + 17 + r() * 1.5, y, -Math.PI / 2, kr, 0.92 + r() * 0.2);
    }
    for (let x = -14; x < W + 16; x += 4.6 * (0.95 + r() * 0.2)) {
      place(x, -16 - r() * 2, Math.PI, mixKinds[Math.floor(r() * mixKinds.length)], 0.95 + r() * 0.2);
      place(x, L + 18 + r() * 2, 0, mixKinds[Math.floor(r() * mixKinds.length)], 0.95 + r() * 0.25);
    }
    // a second, taller row far behind to fill the skyline
    for (let y = -20; y < L + 30; y += 6) { place(-34 - r() * 6, y, Math.PI / 2, mixKinds[Math.floor(r() * mixKinds.length)], 1.1 + r() * 0.3); place(W + 34 + r() * 6, y, -Math.PI / 2, mixKinds[Math.floor(r() * mixKinds.length)], 1.1 + r() * 0.3); }
    for (const k of kinds) {
      if (!items[k].length) continue;
      if (!geos[k]) geos[k] = K.houseGeos(k);
      const body = inst(geos[k].body, brickMat('#ffffff'), items[k], { tint: true });
      const det = inst(geos[k].det, detMat, items[k], {});
      world.add(body, det);
    }
    // trees: tall bare poplars along the banks and between the houses
    const tg = K.treeGeos(), trees = [];
    for (let y = -6; y < L + 10; y += 9 + r() * 5) { trees.push({ x: -10.5 - r() * 2, y: 0, z: -y, s: 0.8 + r() * 0.5, c: '#ffffff' }); trees.push({ x: W + 10.5 + r() * 2, y: 0, z: -y, s: 0.8 + r() * 0.5, c: '#ffffff' }); }
    world.add(inst(tg.trunk, new THREE.MeshStandardMaterial({ map: K.barkTex(), roughness: 1 }), trees, { cast: false }), inst(tg.crown, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), trees, {}));

    // landmarks by style
    if (style === 'mill') {
      for (const [x, y, s] of [[-30, L * 0.35, 1.0], [W + 33, L * 0.7, 1.15], [W / 2 + 6, L + 36, 1.0]]) { const m = K.buildMill(); m.position.set(x, 0, -y); m.scale.setScalar(s); m.rotation.y = x < 0 ? Math.PI / 2 : x > W ? -Math.PI / 2 : 0; world.add(m); info.mills.push(m.userData.hub); }
    } else if (style === 'harbour') {
      for (const [x, y] of [[-9.5, L * 0.2], [-10.5, L * 0.55], [W + 9.5, L * 0.35], [W + 10, L * 0.8], [-8.5, L * 0.85]]) { const sh = K.buildShip(r); sh.position.set(x, 0.0, -y); sh.rotation.y = Math.PI / 2 + (r() - 0.5) * 0.3; sh.rotation.z = (r() - 0.5) * 0.08; world.add(sh); }
      const sp = K.buildSpire(); sp.position.set(W / 2 - 8, 0, -(L + 28)); world.add(sp);
    } else {
      const sp = K.buildSpire(); sp.position.set(W / 2 + 7, 0, -(L + 30)); world.add(sp);
      const mm = K.buildMill(); mm.position.set(-38, 0, -(L * 0.6)); mm.rotation.y = Math.PI / 2; world.add(mm); info.mills.push(mm.userData.hub);
    }

    // ---- spectators on the banks (real instanced 3D people; they cheer, gasp and groan with the play) -----------------------------
    try {
      const n = tier === 'high' ? 170 : tier === 'medium' ? 110 : 56, pts = [];
      const rr = lcg(hashStr(`crowd-${court.id}`));
      for (let i = 0; i < n * 2; i++) {
        const left = i % 2 === 0, off = 0.9 + rr() * 3.4, y = 3 + rr() * (L - 6);
        const cluster = rr() < 0.55 ? (rr() < 0.5 ? 6 + rr() * 10 : L - 6 - rr() * 14) : y;   // more people near the tee and the post
        const yy = clamp(cluster, 2, L - 2);
        const x = left ? -off : W + off, bankH = 0.5 * Math.max(0, 1 - off / 5.0) * 0.8;
        pts.push({ x, y: bankH, z: -yy, yaw: Math.atan2(left ? 1 : -1, 0) + (rr() - 0.5) * 0.7 });
      }
      crowd = V3.createCrowd3d(stage, { points: pts, count: n, seed: hashStr(court.id) & 0xffff, culture: ['european_village', 'nordic'], quality: tier, cold: true, excitement: 0.25, props: { flag: 0.0, phone: 0, child: 0.08 } });
    } catch (e) { console.warn('kolf crowd failed', e); }

    // ---- skaters take lanes on the open ice
    skaters.forEach((s, i) => {
      const left = i % 2 === 0, lane = 7 + (i >> 1) * 2.6 + r() * 1.2;
      s.lane = left ? -lane : W + lane; s.v = (left ? 1 : -1) * (i % 4 < 2 ? 1 : -1) * (1.7 + r() * 1.3); s.y = r() * (L + 60) - 30; s.span = L + 80;
    });
    stage.invalidate();
    return info;
  }

  // smooth (smoothstep) crossfades between base clips: continuous velocity at both ends of the blend
  const xfades = new Map();
  function blendTo(h, clip, opts, dur) {
    const L = h.layers.base; if (L.tracks.length > 1) L.tracks = [L.tracks[L.tracks.length - 1]];   // never blend more than two poses
    h.play(clip, { ...opts, fade: dur });
    xfades.set(h, { t: 0, dur });
  }
  function stepFades(h, dt) {
    const x = xfades.get(h); if (!x) return;
    x.t += dt;
    const k = clamp(x.t / x.dur, 0, 1), e = k * k * (3 - 2 * k), tr = h.layers.base.tracks;
    tr.forEach((t, i) => { const last = i === tr.length - 1; t.fadeRate = Infinity; t.target = last ? e : 1 - e; t.weight = t.target; });
    if (k >= 1) xfades.delete(h);
  }

  // ---- hero state ---------------------------------------------------------------------------------------------------------
  const hero = { x: 0, y: 0, vx: 0, vy: 0, yaw: 0, mode: 'stance', phase: 0, time: 0, vel: 0, init: false, ret: false, lastPh: 'idle', coat: '', lunge: 0, lungeV: 0, t: 0, breath: 0, courtId: '' };
  function updateHero(dt, S, cam, camYaw) {
    if (!player) return;
    const h = player.human;
    const show = !!(S.fig && S.fig.show);
    h.root.visible = show;
    if (!show) { hero.init = false; globalThis.__kolfFigBusy = false; return; }
    const at = S.fig.at || (S.balls[S.cur] && S.balls[S.cur].ball);
    if (!at) return;
    const fx = S.fig.dir ? S.fig.dir[0] : cam.fx, fy = S.fig.dir ? S.fig.dir[1] : cam.fy, rx = fy, ry = -fx;
    const tx = at.x - rx * 1.0 - fx * 0.05, ty = at.y - ry * 1.0 - fy * 0.05;
    const stanceYaw = Math.atan2(fx, -fy);   // the swing mocap has its target on +Z (body side-on): +Z points down the line to the post
    if (S.fig.snap) hero.init = false;
    const newCourt = hero.courtId !== S.court.id + ':' + S.court.dir;
    if (!hero.init || newCourt) { hero.x = tx; hero.y = ty; hero.vx = hero.vy = 0; hero.yaw = stanceYaw; hero.init = true; hero.courtId = S.court.id + ':' + S.court.dir; hero.mode = 'stance'; hero.ret = false; hero.time = 0; player.human.play('swing2h', { fade: 0, speed: 0, startTime: 0, loop: false }); }
    // skate towards the stance point with eased speed and limited acceleration
    const dx = tx - hero.x, dy = ty - hero.y, dist = Math.hypot(dx, dy);
    if (dist > 90) { hero.x = tx; hero.y = ty; hero.vx = hero.vy = 0; }
    const vmax = clamp(dist * 0.8, 4.2, 11), want = dist > 0.02 ? Math.min(vmax, Math.sqrt(2 * 5.0 * dist) * 0.9, dist / 0.12) : 0;
    const dirx = dist > 1e-4 ? dx / dist : 0, diry = dist > 1e-4 ? dy / dist : 0;
    const wvx = dirx * want, wvy = diry * want, ax = (7.0 + clamp(dist * 0.1, 0, 6)) * dt;
    let dvx = wvx - hero.vx, dvy = wvy - hero.vy; const dl = Math.hypot(dvx, dvy);
    if (dl > ax) { dvx *= ax / dl; dvy *= ax / dl; }
    hero.vx += dvx; hero.vy += dvy;
    const sp = Math.hypot(hero.vx, hero.vy), step = sp * dt;
    hero.x += hero.vx * dt; hero.y += hero.vy * dt;
    // facing: along the velocity while skating, the stance direction at rest (smoothed turn rate)
    const heading = sp > 0.3 ? Math.atan2(hero.vx, -hero.vy) : stanceYaw;
    const rate = sp > 0.3 ? 6.5 : 4.5;
    const dyaw = angDiff(hero.yaw, heading), maxd = rate * dt;
    hero.yaw += Math.abs(dyaw) < maxd ? dyaw : Math.sign(dyaw) * maxd;
    // clips: skate_free by distance travelled; the swing mocap scrubbed by the sim phase at the ball
    const skating = sp > 0.35 || (hero.mode === 'skate' && sp > 0.15);
    const base = h.layers.base;
    if (skating && hero.mode !== 'skate') { hero.mode = 'skate'; blendTo(h, 'skate_free', { speed: 0, loop: true }, 0.55); hero.ret = false; }
    else if (!skating && hero.mode === 'skate' && sp < 0.12) { hero.mode = 'stance'; blendTo(h, 'swing2h', { speed: 0, startTime: 0, loop: false }, 0.6); hero.time = 0; hero.tgt = 0; hero.tv = 0; hero.vel = 0; hero.ret = false; hero.lastPh = 'idle'; }
    const cur = base.current;
    if (hero.mode === 'skate') {
      if (cur && cur.clip.name === 'skate_free') { cur.speed = 0; cur.time = (cur.time + (step / (STRIDE_FREE * clamp(sp / 4, 1, 2.6))) * cur.clip.dur) % cur.clip.dur; }
    } else if (cur && cur.clip.name === 'swing2h') {
      const ph = S.fig.ph || 'idle', u = clamp(S.fig.u || 0, 0, 9);
      let target = 0, w1 = 26, w2 = 12;
      if (ph === 'back') { target = 1.3 * clamp(u, 0, 1); w2 = 14; hero.ret = false; }
      else if (ph === 'down') { const from = 1.3 * clamp(S.fig.from || 0, 0, 1); target = from + (IMPACT - from) * clamp(u * 1.3, 0, 1); w1 = 55; w2 = 48; hero.ret = false; }
      else if (ph === 'follow') {
        w1 = 22; w2 = 16;
        target = u < 0.3 ? IMPACT + 0.45 * (u / 0.3) : IMPACT + 0.45;
        if (u > 0.6 && !hero.ret) { hero.ret = true; blendTo(h, 'swing2h', { speed: 0, startTime: 0, loop: false }, 1.1); hero.time = 0; hero.tgt = 0; hero.tv = 0; hero.vel = 0; }
      } else { target = 0; w2 = 10; }
      if (!hero.ret) {
        // two cascaded critically damped springs: a jerk-limited follow of the clip time (no pops when the sim steps phases)
        const spr = (x, v, tg, om) => { const d = x - tg, e = Math.exp(-om * dt), t1 = (v + om * d) * dt; return [tg + (d + t1) * e, (v - om * t1) * e]; };
        [hero.tgt, hero.tv] = spr(hero.tgt || 0, hero.tv || 0, target, w1);
        [hero.time, hero.vel] = spr(hero.time, hero.vel || 0, hero.tgt, w2);
        hero.time = clamp(hero.time, 0, 2.45);
        const c2 = base.current; if (c2 && c2.clip.name === 'swing2h') { c2.speed = 0; c2.time = hero.time; }
      } else { const c2 = base.current; if (c2 && c2.clip.name === 'swing2h') { c2.speed = 0; c2.time = 0.012 + 0.01 * Math.sin(hero.t * 1.7); } }
      // the track being faded OUT keeps its last pose (speed 0); the newest track is the address
      player.tiltClub(hero.ret ? 0 : hero.time);
      hero.lastPh = ph;
    }
    // coat colour per player
    const col = (S.fig.color && S.fig.color.coat) || '#6b2a1c';
    if (col !== hero.coat) { hero.coat = col; player.setCoat(col); }
    if (h._hold && h._hold.pole) {   // keep the left elbow hint beside and below the body so the arm never flips
      const sy = Math.sin(hero.yaw), cy = Math.cos(hero.yaw);
      h._hold.pole.set(hero.x + cy * 0.55 + sy * 0.15, 0.85, -hero.y - sy * 0.55 + cy * 0.15);
    }
    globalThis.__kolfFigBusy = hero.mode === 'skate' || dist > 2.5;
    // the skater glides into the stroke: the body slides about half a metre towards the ball as the club comes down, so the head
    // of the club meets the ball (the mocap's reach is shorter at impact than at address); it eases back during the follow-through
    {
      const ph2 = S.fig.ph || 'idle';
      const want = hero.mode === 'stance' && (ph2 === 'down' || (ph2 === 'follow' && (S.fig.u || 0) < 1.1)) ? LUNGE : 0;
      const om = want > hero.lunge ? 26 : 3.5;
      const d = hero.lunge - want, e = Math.exp(-om * dt), t1 = ((hero.lungeV || 0) + om * d) * dt;
      hero.lunge = want + (d + t1) * e; hero.lungeV = ((hero.lungeV || 0) - om * t1) * e;
    }
    h.root.position.set(hero.x + rx * hero.lunge, 0, -(hero.y + ry * hero.lunge));
    h.setFacing(hero.yaw);
    // breath fog in the cold
    hero.breath -= dt;
    if (hero.breath <= 0) {
      hero.breath = 2.3 + 0.8 * Math.sin(hero.t);
      const hp = h.bonePosition('Head');
      const f = Math.sin(hero.yaw), g = Math.cos(hero.yaw);
      addPuff(hp.x + f * 0.14, hp.y - 0.02, hp.z + g * 0.14, f * 0.12, 0.1, g * 0.12, 1.7, 0.03, 0.2);
    }
  }

  // ---- skaters ------------------------------------------------------------------------------------------------------------
  function updateSkaters(dt, S, info) {
    for (const s of skaters) {
      const h = s.h; h.root.visible = true;
      s.y += s.v * dt; const span = s.span || 140;
      if (s.y > span - 30) s.y -= span; else if (s.y < -30) s.y += span;
      const step = Math.abs(s.v) * dt;
      const cur = h.layers.base.current;
      if (cur && cur.clip.name === 'skate_hb') { cur.speed = 0; cur.time = (cur.time + (step / STRIDE_HB) * cur.clip.dur) % cur.clip.dur; }
      h.root.position.set(s.lane, 0, -s.y);
      const target = Math.atan2(0, -Math.sign(s.v));   // three: court +y is -Z
      s.yaw = s.yaw + angDiff(s.yaw, target) * Math.min(1, dt * 4);
      h.setFacing(s.yaw);
    }
  }

  // ---- projection of the 2D pinhole camera into the three camera --------------------------------------------------------
  const tmpV = new THREE.Vector3();
  function setCamera(cam, rect, w, hpx) {
    const f = cam.f;
    const near = 0.25, far = 700;
    const px = cam.cx - rect.x, py = cam.hy - rect.y;
    const P = camera.projectionMatrix;
    P.set(2 * f / rect.w, 0, 1 - 2 * px / rect.w, 0,
      0, 2 * f / rect.h, 2 * py / rect.h - 1, 0,
      0, 0, -(far + near) / (far - near), -2 * far * near / (far - near),
      0, 0, -1, 0);
    camera.projectionMatrixInverse.copy(P).invert();
    camera.position.set(cam.x, cam.h, -cam.y);
    tmpV.set(cam.x + cam.fx, cam.h, -(cam.y + cam.fy));
    camera.up.set(0, 1, 0);
    camera.lookAt(tmpV);
    camera.updateMatrixWorld(true);
    void w; void hpx;
  }
  const _shardM = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

  let lastT = null, frameAcc = 0, frames = 0, lastWall = 0, slowCount = 0, size = [0, 0];
  const api = {
    supported: true,
    get lost() { return lost; },
    get ready() { return ready; },
    get tier() { return tier; },
    stage, V3, loading,
    /** Render the court for `rect` with camera `cam` (from view.makeCam). Returns { canvas, w, h } or null when unusable. */
    render(rect, S, cam, pxScale = 1) {
      if (lost || stage.contextLost) return null;
      const maxDim = api.maxDim || (tier === 'high' ? 1500 : tier === 'medium' ? 1150 : 820);
      let sc = Math.min(Math.max(0.5, pxScale), 2);
      if (Math.max(rect.w, rect.h) * sc > maxDim) sc = maxDim / Math.max(rect.w, rect.h);
      const w = Math.max(16, Math.round(rect.w * sc)), h = Math.max(16, Math.round(rect.h * sc));
      if (w !== size[0] || h !== size[1]) { size = [w, h]; canvas.style.width = `${w}px`; canvas.style.height = `${h}px`; stage.setSize(w, h); }
      const c = S.court;
      if (!built || built.id !== c.id) { const t0 = (globalThis.performance || Date).now(); built = buildCourt(c, c.style || 'canal'); api.lastBuildMs = Math.round((globalThis.performance || Date).now() - t0); }
      const t = S.t;
      const dt = lastT === null ? 0 : clamp(t - lastT, 0, 0.1); lastT = t; hero.t += dt;
      // adaptive quality from the real frame interval
      const now = (globalThis.performance || Date).now();
      if (lastWall) { const d = now - lastWall; if (d < 250) { frameAcc += d; frames++; } }
      lastWall = now;
      if (frames >= 60) { const avg = frameAcc / frames; frameAcc = 0; frames = 0; if (avg > 26) { if (++slowCount >= 2) { slowCount = 0; api.lowerTier(); } } else slowCount = 0; }

      setCamera(cam, rect, w, h);
      // world animation
      const wind = windAt(c, S.clock);
      const flag = built.post.userData.flag;
      built.post.position.set(c.post.x, 0, -c.post.y);
      built.startPost.position.set(c.startPost.x, 0, -c.startPost.y);
      { const q = cam.cs(c.startPost.x, c.startPost.y), bq = cam.cs(S.v.x, S.v.y); built.startPost.visible = q.Z > bq.Z + 0.5 && q.Z > 3; }
      if (flag) {
        const base = built.post.userData.flagBase, arr = flag.geometry.attributes.position.array, str = clamp(0.5 + Math.abs(wind.x) * 3 + Math.abs(wind.y) * 3, 0.5, 1.8);
        for (let i = 0; i < arr.length; i += 3) {
          const x = base[i], y = base[i + 1];
          const k = x / 1.5;
          arr[i + 2] = Math.sin(t * 7 - x * 5.0) * 0.1 * k * str + Math.sin(t * 3.1 - x * 2.2) * 0.04 * k;
          arr[i + 1] = y - k * k * 0.16 + Math.sin(t * 5.2 - x * 4) * 0.025 * k;
          arr[i] = x * (1 - 0.06 * str * Math.abs(Math.sin(t * 6.0 - x * 4)) * k);
        }
        flag.geometry.attributes.position.needsUpdate = true; flag.geometry.computeVertexNormals();
        flag.rotation.y = wind.x >= 0 ? 0 : Math.PI;
      }
      for (const hub of built.mills) hub.rotation.z += dt * (0.22 + Math.abs(wind.x) * 1.5);
      // sledges and their riders
      built.sledges.forEach((sl, i) => {
        const p = moverPos(sl.m, S.clock), q = moverPos(sl.m, S.clock + 0.05);
        sl.g.position.set(p.x, 0, -p.y);
        const hx = q.x - p.x, hy = q.y - p.y;
        if (Math.hypot(hx, hy) > 1e-5) sl.g.rotation.y = Math.atan2(hx, -hy);
        if (i === 0 && rider) { rider.root.visible = true; rider.root.position.set(p.x, 0.43, -p.y - 0); rider.setFacing(sl.g.rotation.y + Math.PI); }
      });
      if (rider && !built.sledges.length) rider.root.visible = false;
      // sky follows the camera, sun and clouds sit on a ring
      sky.mesh.position.copy(camera.position);
      const sunA = 0.55 - 0.0; sun.scale.setScalar(0.55); sun.position.set(camera.position.x + Math.sin(sunA) * 380, 36, camera.position.z - Math.cos(sunA) * 380); sun.lookAt(camera.position);
      for (const m of clouds) { m.userData.a += dt * 0.004; m.position.set(camera.position.x + Math.sin(m.userData.a) * m.userData.R, m.userData.h, camera.position.z - Math.cos(m.userData.a) * m.userData.R); m.lookAt(camera.position.x, m.position.y, camera.position.z); }
      // snow in the air, blown with the wind
      { const a = snowPts.arr, cx = camera.position.x, cz = camera.position.z;
        for (let i = 0; i < SN; i++) {
          let x = a[i * 3] + (wind.x * 2.2 + 0.35 + Math.sin(t * 0.7 + i) * 0.12) * dt, y = a[i * 3 + 1] - (0.55 + (i % 5) * 0.08) * dt, z = a[i * 3 + 2] + (-wind.y * 2.2 + 0.1) * dt;
          if (y < 0) { y += 14; x = cx + (Math.sin(i * 12.9 + t) * 20); z = cz + (Math.cos(i * 78.2 + t * 0.3) * 20); }
          if (x < cx - 20) x += 40; else if (x > cx + 20) x -= 40; if (z < cz - 20) z += 40; else if (z > cz + 20) z -= 40;
          a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
        }
        snowPts.pts.geometry.attributes.position.needsUpdate = true; }

      // events from the sim: powder on the boards, crowd reactions
      const ev = S.events || [];
      for (const e of ev) {
        if (e.k === 'wall' || e.k === 'pillar' || e.k === 'block' || e.k === 'sledge') {
          const n = Math.min(9, 3 + Math.floor((e.v || 6) / 3));
          for (let k = 0; k < n; k++) { const a = Math.random() * TAU, sp = 0.4 + Math.random() * (e.v || 6) * 0.1; addPuff(e.x, 0.12, -e.y, Math.cos(a) * sp, 0.5 + Math.random() * 0.6, Math.sin(a) * sp, 0.7 + Math.random() * 0.5, 0.04, 0.22 + Math.random() * 0.12); }
        }
        if (crowd) {
          if (e.k === 'post') crowd.react('ovation', { origin: [e.x, 0, -e.y], radius: 90, intensity: 1 });
          else if (e.k === 'crack') crowd.react('gasp', { origin: [e.x, 0, -e.y], radius: 70, intensity: 1 });
          else if (e.k === 'sledge') crowd.react('gasp', { origin: [e.x, 0, -e.y], radius: 30, intensity: 0.6 });
          else if ((e.k === 'wall' || e.k === 'pillar' || e.k === 'block') && (e.v || 0) > 14) crowd.react('cheer', { origin: [e.x, 0, -e.y], radius: 20, intensity: 0.5 });
        }
      }
      if (crowd && S.fig && S.fig.cheer) crowd.react('cheer', { origin: [c.post.x, 0, -c.post.y], radius: 60, intensity: 0.8 });

      // players
      updateHero(dt, S, cam, S.v.yaw);
      updateSkaters(dt, S, built);
      // human pose update FIRST, then anything that reads bones (breath position above uses last frame's bones: fine), then render
      if (player) { stepFades(player.human, dt); player.human.update(dt); }
      for (const s of skaters) s.h.update(dt);
      if (rider) rider.update(dt);
      if (crowd) crowd.update(dt);

      // balls
      const curBall = S.balls[S.cur];
      S.balls.forEach((b, i) => {
        const m = balls[i]; if (!m) return;
        m.visible = !b.hide;
        if (b.hide) return;
        const bl = b.ball;
        let x = bl.x, y = bl.y, z = BALL_R;
        let alpha = 1;
        if (bl.mode === 'thin') { const k = clamp(bl.sink / 0.8, 0, 1); x = bl.sx; y = bl.sy; z = BALL_R - k * 0.5; alpha = 1 - clamp(bl.sink / 0.9, 0, 1); }
        // roll about the axis perpendicular to the motion (the distance travelled sets the angle)
        const last = m.userData.last;
        if (last) { const dx = x - last[0], dy = y - last[1], d = Math.hypot(dx, dy); if (d > 1e-5 && d < 3) { _p.set(-dy, 0, -dx).normalize(); _q.setFromAxisAngle(_p, d / BALL_R * 0.6); m.userData.q.premultiply(_q); } }
        m.userData.last = [x, y]; m.quaternion.copy(m.userData.q);
        m.position.set(x, z, -y);
        m.material.color.set(b.color.base); m.material.transparent = alpha < 1; m.material.opacity = alpha;
        m.userData.shadow.material.opacity = 0.5 * alpha;
      });
      for (let i = S.balls.length; i < 4; i++) balls[i].visible = false;
      // halo and marker follow the ball whose turn it is
      if (curBall && !curBall.hide) {
        const bl = curBall.ball, camDist = Math.hypot(bl.x - cam.x, bl.y - cam.y);
        const R = 0.22 + camDist * 0.016, pulse = 1 + 0.07 * Math.sin(t * 4);
        halo.visible = !!S.ring; halo.position.set(bl.x, 0.012, -bl.y); halo.scale.setScalar(R * pulse);
        marker.visible = !!S.ring; marker.position.set(bl.x, 0.5 + 0.06 * Math.sin(t * 3), -bl.y); marker.scale.setScalar(1 + camDist * 0.05);
        marker.material.color.set(curBall.color.base);
      } else { halo.visible = false; marker.visible = false; }
      // trails
      trails.forEach((m, i) => {
        const b = S.balls[i], tr = b && b.trail;
        if (!tr || tr.length < 2 || b.hide) { m.visible = false; return; }
        m.visible = true;
        const arr = m.geometry.attributes.position.array, n = Math.min(TN, tr.length);
        for (let k = 0; k < TN; k++) {
          const p = tr[Math.min(k, n - 1)], q = tr[Math.min(k + 1, n - 1)], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, wv = 0.05 * (k / n + 0.2);
          arr.set([p[0] - (-dy / l) * wv, 0.014, -(p[1] - (dx / l) * wv)], k * 6); arr.set([p[0] + (-dy / l) * wv, 0.014, -(p[1] + (dx / l) * wv)], k * 6 + 3);
        }
        m.geometry.attributes.position.needsUpdate = true;
        m.geometry.setDrawRange(0, (n - 1) * 6);
      });
      // aiming guide
      if (S.guide && S.guide.pts && S.guide.pts.length > 1) {
        const pts = S.guide.pts; let n = 0;
        for (let i = 0; i < pts.length && n < GN; i++) {
          const dd = Math.hypot(pts[i][0] - cam.x, pts[i][1] - cam.y), s = 0.8 + dd * 0.035;
          _p.set(pts[i][0], 0.022, -pts[i][1]); _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)); _s.set(s, s, s);
          _shardM.compose(_p, _q, _s); guideDots.setMatrixAt(n++, _shardM);
        }
        guideDots.count = n; guideDots.instanceMatrix.needsUpdate = true; guideDots.visible = true;
        const e = S.guide.end, de = Math.hypot(e.x - cam.x, e.y - cam.y), pulse = 1 + 0.12 * Math.sin(t * 4);
        guideEnd.visible = true; guideEnd.position.set(e.x, 0.025, -e.y); guideEnd.scale.setScalar((0.3 + de * 0.012) * pulse);
      } else { guideDots.visible = false; guideEnd.visible = false; }
      // sim particles
      let ns = 0, nr = 0, nc = 0;
      for (const q of S.parts || []) {
        const k = q.t / q.max, z = Math.max(0.03, (q.z || 0.15) + 1.4 * q.t - 5 * q.t * q.t);
        _c.set(q.col || '#ffffff');
        if (q.kind === 2 && nr < 24) { const r0 = q.size * (0.4 + k * 1.2); _p.set(q.x, 0.03, -q.y); _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)); _s.set(r0, r0, r0); _shardM.compose(_p, _q, _s); ringPool.setMatrixAt(nr, _shardM); ringPool.setColorAt(nr, _c); nr++; }
        else if (q.kind === 3 && nc < PN) { _p.set(q.x, Math.max(0.05, (q.z || 1) - 1.1 * q.t * q.t * 2), -q.y); _q.setFromEuler(_e.set(q.t * 6, q.t * (q.spin || 8), q.t * 3)); _s.setScalar(1 - k * 0.3); _shardM.compose(_p, _q, _s); confPool.setMatrixAt(nc, _shardM); confPool.setColorAt(nc, _c); nc++; }
        else if (ns < PN) { _p.set(q.x, z, -q.y); _q.identity(); _s.setScalar(Math.max(0.2, (1 - k)) * (q.size || 1)); _shardM.compose(_p, _q, _s); shardPool.setMatrixAt(ns, _shardM); shardPool.setColorAt(ns, _c); ns++; }
      }
      shardPool.count = ns; ringPool.count = nr; confPool.count = nc;
      for (const pl of [shardPool, ringPool, confPool]) { pl.instanceMatrix.needsUpdate = true; if (pl.instanceColor) pl.instanceColor.needsUpdate = true; }
      ringPool.material.opacity = 0.75;
      // snow powder and breath puffs
      let np = 0;
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]; p.age += dt;
        if (p.age >= p.life) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.97; p.vz *= 0.97; p.vy *= 0.96;
        const k = p.age / p.life, r = lerp(p.r0, p.r1, Math.sqrt(k)) * (1 - k * 0.5);
        _p.set(p.x, p.y, p.z); _q.identity(); _s.setScalar(r * 10); _shardM.compose(_p, _q, _s); powder.setMatrixAt(np++, _shardM);
      }
      powder.count = np; powder.instanceMatrix.needsUpdate = true;

      // shadows follow the action
      const fb = curBall ? curBall.ball : null;
      if (fb) stage.setShadowTarget(fb.x, 0, -fb.y);
      stage.invalidate();
      stage.render();
      return { canvas, w, h };
    },
    lowerTier() {
      const order = ['high', 'medium', 'low'], i = order.indexOf(tier);
      if (i < 0 || i >= order.length - 1) return false;
      tier = order[i + 1];
      try { stage.setQuality(tier); } catch { /* ignore */ }
      if (crowd) { try { crowd.setQuality(tier); } catch { /* ignore */ } }
      stage.invalidate(); size = [0, 0];
      return true;
    },
    loseContextForTest() { stage.loseContextForTest(); },
    restoreContextForTest() { stage.restoreContextForTest(); },
    get player() { return player; }, get hero() { return hero; }, get skaters() { return skaters; }, get info() { return built; },
    puffs, stats() { return { tier, frames: stage.stats.renders }; },
  };
  return api;
}
