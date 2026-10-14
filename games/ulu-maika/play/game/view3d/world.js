// Ulu Maika 3D world (game-owned): a Hawaiian village lawn at golden hour. Everything is procedural (canvas textures, lathe and tube
// geometry) and shared by the in-game presenter and the offline icon render. Metres. Lane coordinates: x across (right +), y up the
// lane from the roll line; world: X = lane x, Z = -lane y, Y = up.
//
// Real-world scale: roll disc 13 cm across and 3 cm thick (the sim's DISC_R 0.065), kii stakes 4.5 cm across and 0.9 m high,
// the far target a 1.1 m post inside a ring of basalt stones, the scoring ring of white coral pebbles 1.35 m from it.
import { DISC_R, STAKE_R, FAR_R, RING_R } from '../src/sim.js';

const TAU = Math.PI * 2;
export const DISC_T = 0.03;           // disc thickness (m)
const lcg = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const cvs = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function buildWorld(V3, { quality = 'high', track = null } = {}) {
  const { THREE, board3d: B } = V3;
  const root = new THREE.Group(); root.name = 'ulu-world';
  const tick = [];                                   // per-frame animators (t, dt)
  const aniso = 8;
  const mkTex = (canvas, { repeat, srgb = true } = {}) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const Z = (y) => -y;                               // lane y -> world z
  const farObjs = [];                                // distant things (sky, ridges, sea, palms, houses): the icon render softens them

  // ---------------------------------------------------------------- sky, haze, sun, clouds, ridges, sea
  {
    const c = cvs(16, 512), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#27508f'); gr.addColorStop(0.28, '#4f84c4'); gr.addColorStop(0.5, '#9ec3df'); gr.addColorStop(0.64, '#ffd9a2'); gr.addColorStop(0.74, '#ffc27a'); gr.addColorStop(1, '#ffb066');
    g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), new THREE.MeshBasicMaterial({ map: mkTex(c), side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sky.name = 'sky'; root.add(sky); farObjs.push(sky);
    // sun: a bright disc and a wide additive halo near the horizon, ahead and a little to the right
    const sc = cvs(256), sg = sc.getContext('2d');
    const rg = sg.createRadialGradient(128, 128, 2, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,252,228,1)'); rg.addColorStop(0.1, 'rgba(255,238,170,0.95)'); rg.addColorStop(0.3, 'rgba(255,196,110,0.4)'); rg.addColorStop(1, 'rgba(255,170,90,0)');
    sg.fillStyle = rg; sg.fillRect(0, 0, 256, 256);
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshBasicMaterial({ map: mkTex(sc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    sun.position.set(26, 11, -118); sun.renderOrder = -8; root.add(sun); farObjs.push(sun);
    // sparse trade-wind clouds, sun-lit from below
    const cc = cvs(256, 128), cg = cc.getContext('2d'), r = lcg(5);
    for (let i = 0; i < 26; i++) {
      const x = 30 + r() * 196, y = 40 + r() * 50, rr = 12 + r() * 26;
      const gg = cg.createRadialGradient(x, y, 0, x, y, rr);
      gg.addColorStop(0, 'rgba(255,236,214,0.55)'); gg.addColorStop(1, 'rgba(255,214,190,0)');
      cg.fillStyle = gg; cg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    const cloudMat = new THREE.MeshBasicMaterial({ map: mkTex(cc), transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    const clouds = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(70 + i * 12, 26), cloudMat);
      m.position.set(-60 + i * 34, 30 + (i % 3) * 7, -105 - i * 4); m.renderOrder = -7; root.add(m); clouds.push(m); farObjs.push(m);
    }
    tick.push((t) => clouds.forEach((m, i) => { m.position.x += 0.0035 * (1 + i * 0.1); if (m.position.x > 110) m.position.x = -110; }));
  }
  // mountain ridges (fluted green pali with a dark crater cone), painted as silhouettes on a curved band; far to near, hazier far
  {
    const ridge = (name, w, h, col, haze, seed, flute) => {
      const c = cvs(2048, 256), g = c.getContext('2d'), r = lcg(seed);
      const ph = [r() * 6, r() * 6, r() * 6];
      const top = (x) => 70 + 40 * Math.sin(x / 190 + ph[0]) + 26 * Math.sin(x / 71 + ph[1]) + 12 * Math.sin(x / 27 + ph[2]) + 20 * Math.abs(Math.sin(x / 330 + ph[1]));
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 256);
      for (let x = 0; x <= 2048; x += 4) g.lineTo(x, top(x));
      g.lineTo(2048, 256); g.closePath(); g.fill();
      if (flute) {
        g.globalCompositeOperation = 'source-atop';
        for (let x = 0; x < 2048; x += 5 + r() * 6) {
          g.strokeStyle = r() < 0.5 ? 'rgba(10,40,24,0.28)' : 'rgba(150,200,120,0.18)'; g.lineWidth = 1 + r() * 3;
          g.beginPath(); g.moveTo(x, top(x) + 4); g.lineTo(x + (r() - 0.5) * 30, 256); g.stroke();
        }
        g.globalCompositeOperation = 'source-over';
      }
      g.globalCompositeOperation = 'source-atop';
      const hg = g.createLinearGradient(0, 0, 0, 256); hg.addColorStop(0, 'rgba(255,214,170,0)'); hg.addColorStop(1, haze);
      g.fillStyle = hg; g.fillRect(0, 0, 2048, 256);
      const geo = new THREE.CylinderGeometry(w, w, h, 48, 1, true, -1.0, 2.0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: mkTex(c), transparent: true, side: THREE.BackSide, depthWrite: false, fog: true }));
      m.position.y = h / 2 - 1; m.renderOrder = -6; m.name = name; root.add(m); farObjs.push(m); return m;
    };
    ridge('ridgeFar', 96, 17, '#5b8a86', 'rgba(255,205,160,0.55)', 41, true);
    ridge('ridgeMid', 74, 12, '#3f7157', 'rgba(255,196,140,0.38)', 77, true);
    // a soft volcanic cone (a Diamond-Head-like crater) on the right
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 14, 9, 28, 1, true), new THREE.MeshLambertMaterial({ color: 0x4a5a3a, fog: true }));
    cone.position.set(34, 4, -88); cone.scale.set(1.3, 0.8, 0.5); root.add(cone); farObjs.push(cone);
  }
  // the sea: gradient plane with an animated glitter layer, then a ribbon of sand and foam where the lawn ends
  {
    const c = cvs(8, 256), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffd08a'); gr.addColorStop(0.18, '#5ec3cf'); gr.addColorStop(0.6, '#1d8aa6'); gr.addColorStop(1, '#126a86');
    g.fillStyle = gr; g.fillRect(0, 0, 8, 256);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(400, 150), new THREE.MeshBasicMaterial({ map: mkTex(c), fog: true }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.35, -112); root.add(sea); farObjs.push(sea);
    const gc = cvs(256), gg = gc.getContext('2d'), r = lcg(9);
    for (let i = 0; i < 380; i++) { const x = r() * 256, y = r() * 256, l = 2 + r() * 9; gg.fillStyle = `rgba(255,236,190,${0.25 + r() * 0.6})`; gg.fillRect(x, y, l, 1 + r() * 1.4); }
    const gt = mkTex(gc, { repeat: [10, 6] });
    const glit = new THREE.Mesh(new THREE.PlaneGeometry(400, 150), new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glit.rotation.x = -Math.PI / 2; glit.position.set(0, -0.33, -112); root.add(glit); farObjs.push(glit);
    tick.push((t) => { gt.offset.x = (t * 0.012) % 1; gt.offset.y = Math.sin(t * 0.2) * 0.02; });
    const sc = cvs(16, 128), sg = sc.getContext('2d');
    const sgr = sg.createLinearGradient(0, 0, 0, 128); sgr.addColorStop(0, '#fff8e8'); sgr.addColorStop(0.35, '#f1dcab'); sgr.addColorStop(1, '#cdb078');
    sg.fillStyle = sgr; sg.fillRect(0, 0, 16, 128);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(300, 7), new THREE.MeshLambertMaterial({ map: mkTex(sc) }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, -0.02, -40.5); root.add(sand); farObjs.push(sand);
  }

  // ---------------------------------------------------------------- lawn and lane
  const half = track ? track.half : 2.6, len = track ? track.len : 24;
  {
    const c = cvs(512), g = c.getContext('2d'), r = lcg(13);
    g.fillStyle = '#4e8f3b'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 90; i++) { const x = r() * 512, y = r() * 512, rr = 20 + r() * 70, gg = g.createRadialGradient(x, y, 0, x, y, rr); const k = r() < 0.5; gg.addColorStop(0, k ? 'rgba(120,170,70,0.28)' : 'rgba(20,70,30,0.3)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 9000; i++) { const x = r() * 512, y = r() * 512, k = r(); g.strokeStyle = k < 0.45 ? 'rgba(160,210,90,0.5)' : k < 0.8 ? 'rgba(20,80,30,0.5)' : 'rgba(210,230,130,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 5); g.stroke(); }
    const bc = cvs(256), bg = bc.getContext('2d'); bg.fillStyle = '#808080'; bg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) { bg.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; bg.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3); }
    const lawn = new THREE.Mesh(new THREE.PlaneGeometry(220, 48), new THREE.MeshStandardMaterial({ map: mkTex(c, { repeat: [44, 10] }), bumpMap: mkTex(bc, { repeat: [44, 15], srgb: false }), bumpScale: 0.6, roughness: 1 }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(0, 0, -13); lawn.receiveShadow = true; lawn.name = 'lawn'; root.add(lawn);
  }
  const lane = new THREE.Group(); root.add(lane);
  const laneMat = (() => {
    const c = cvs(512), g = c.getContext('2d'), r = lcg(21);
    // mown, rolled lawn: alternating light/dark stripes across the lane, fine blades
    for (let y = 0; y < 8; y++) { g.fillStyle = y % 2 ? '#6fb046' : '#5fa23c'; g.fillRect(0, y * 64, 512, 64); }
    for (let i = 0; i < 60; i++) { const x = r() * 512, y = r() * 512, rr = 20 + r() * 60, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, r() < 0.5 ? 'rgba(190,220,110,0.22)' : 'rgba(30,90,30,0.22)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 7000; i++) { const x = r() * 512, y = r() * 512, k = r(); g.strokeStyle = k < 0.5 ? 'rgba(200,232,120,0.35)' : 'rgba(25,85,30,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - 2 - r() * 4); g.stroke(); }
    const bc = cvs(256), bg = bc.getContext('2d'); bg.fillStyle = '#808080'; bg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) { bg.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'; bg.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3); }
    const ac = cvs(128, 8), ag = ac.getContext('2d'); const ag2 = ag.createLinearGradient(0, 0, 128, 0); ag2.addColorStop(0, '#000'); ag2.addColorStop(0.1, '#fff'); ag2.addColorStop(0.9, '#fff'); ag2.addColorStop(1, '#000'); ag.fillStyle = ag2; ag.fillRect(0, 0, 128, 8);
    return new THREE.MeshStandardMaterial({ map: mkTex(c, { repeat: [1, (len + 12) / 4] }), bumpMap: mkTex(bc, { repeat: [3, (len + 12) / 1.5], srgb: false }), bumpScale: 0.7, roughness: 1, alphaMap: mkTex(ac, { srgb: false }), transparent: true, depthWrite: false });
  })();
  const laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(2 * half + 1.1, len + 12), laneMat);
  laneMesh.rotation.x = -Math.PI / 2; laneMesh.position.set(0, 0.004, -(len / 2 - 6 + 2)); laneMesh.receiveShadow = true; laneMesh.renderOrder = 1; lane.add(laneMesh);
  laneMesh.userData.base = true;
  // packed earth where the players stand and roll off, with stamped footprints
  {
    const c = cvs(512, 256), g = c.getContext('2d'), r = lcg(23);
    const gr = g.createRadialGradient(256, 128, 20, 256, 128, 250); gr.addColorStop(0, 'rgba(176,138,86,1)'); gr.addColorStop(0.7, 'rgba(168,130,80,0.96)'); gr.addColorStop(1, 'rgba(168,130,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 1500; i++) { const x = r() * 512, y = r() * 256, s2 = 0.8 + r() * 2; g.fillStyle = r() < 0.5 ? 'rgba(232,206,160,0.5)' : 'rgba(86,58,30,0.4)'; g.beginPath(); g.arc(x, y, s2, 0, TAU); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = r() * 512, y = r() * 256, rr = 8 + r() * 26, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, r() < 0.5 ? 'rgba(120,84,44,0.35)' : 'rgba(210,180,128,0.3)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    const t = mkTex(c);
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.5), new THREE.MeshStandardMaterial({ map: t, roughness: 1, transparent: true, depthWrite: false }));
    patch.rotation.x = -Math.PI / 2; patch.position.set(0, 0.006, 0.55); patch.receiveShadow = true; patch.renderOrder = 2; lane.add(patch); farObjs.patch = patch;
  }
  // the roll line: a row of white coral pebbles across the lane at y = 0
  {
    const g = new THREE.SphereGeometry(0.018, 8, 6), m = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.8 });
    const n = 60, im = new THREE.InstancedMesh(g, m, n), r = lcg(3), d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(-1.5 + (3 * i) / (n - 1) + (r() - 0.5) * 0.01, 0.008, 0.01 + (r() - 0.5) * 0.03); d.scale.set(1 + r() * 0.8, 0.55, 1 + r() * 0.7); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    im.receiveShadow = true; lane.add(im);
  }
  // basalt edging stones along both sides of the lane
  const edge = (() => {
    const geo = new THREE.SphereGeometry(1, 9, 6), p = geo.attributes.position, r = lcg(33);
    for (let i = 0; i < p.count; i++) { const k = 0.8 + r() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k); }
    geo.computeVertexNormals();
    return geo;
  })();
  const basaltMat = (() => {
    const c = cvs(256), g = c.getContext('2d'), r = lcg(8);
    g.fillStyle = '#34363b'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 30; i++) { const x = r() * 256, y = r() * 256, rr = 10 + r() * 40, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, r() < 0.5 ? 'rgba(120,124,130,0.35)' : 'rgba(0,0,0,0.4)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 1400; i++) { const x = r() * 256, y = r() * 256; g.fillStyle = r() < 0.6 ? 'rgba(10,10,12,0.75)' : 'rgba(180,184,190,0.3)'; g.beginPath(); g.arc(x, y, 0.6 + r() * 1.6, 0, TAU); g.fill(); }
    return new THREE.MeshStandardMaterial({ map: mkTex(c, { repeat: [1, 1] }), roughness: 0.7, metalness: 0.05, envMapIntensity: 0.8 });
  })();
  const edging = new THREE.Group(); lane.add(edging);
  const ringGroup = new THREE.Group(), mudGroup = new THREE.Group(), gateGroup = new THREE.Group(), rockGroup = new THREE.Group(), farGroup = new THREE.Group();
  lane.add(ringGroup, mudGroup, gateGroup, rockGroup, farGroup);

  // ---------------------------------------------------------------- stakes, far post, boulders, mud
  const koa = B.material('darkWood', { color: '#6a3318', color2: '#9a5a2c', seed: 17, size: 256, repeat: [1, 3] });
  const kapaRed = new THREE.MeshStandardMaterial({ color: 0xb21f26, roughness: 0.85 });
  const kapaCream = new THREE.MeshStandardMaterial({ color: 0xf0e4c4, roughness: 0.9 });
  const stakeGeo = B.lathe([[0.034, 0], [0.027, 0.05], [STAKE_R * 0.6, 0.12], [STAKE_R * 0.55, 0.8], [STAKE_R * 0.7, 0.84], [STAKE_R * 0.7, 0.9], [STAKE_R * 0.4, 0.93], [0.0, 0.94]], 14);
  const bandGeo = new THREE.CylinderGeometry(STAKE_R * 0.62, STAKE_R * 0.62, 0.07, 14, 1, true);
  const flagGeo = (() => { const gg = new THREE.PlaneGeometry(0.16, 0.1, 4, 1); gg.translate(0.08 + STAKE_R * 0.5, 0, 0); return gg; })();
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xc92a30, roughness: 0.8, side: THREE.DoubleSide });
  const stakes = [];
  const makeStake = (x, y, tall = 1, far = false) => {
    const g = new THREE.Group(); g.position.set(x, 0, Z(y));
    const m = new THREE.Mesh(stakeGeo, koa); m.castShadow = true; m.receiveShadow = true; m.scale.set(tall > 1 ? 1.5 : 1, tall, tall > 1 ? 1.5 : 1); g.add(m);
    const b1 = new THREE.Mesh(bandGeo, kapaRed); b1.position.y = 0.7 * tall; g.add(b1);
    const b2 = new THREE.Mesh(bandGeo, kapaCream); b2.position.y = 0.635 * tall; g.add(b2);
    { const cs = B.contactShadow(0.1, 0.5); cs.position.set(0, 0.006, 0); g.add(cs); }
    // a small kapa flag on a short arm below the knob
    const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.0, 0.86 * tall, 0); flag.castShadow = true; g.add(flag); g.userData.flag = flag;
    g.userData = { x, y, wob: 0, wobDir: [0, 0], far };
    return g;
  };
  // the far post: koa post, a ring of basalt stones at its foot (the sim's FAR_R), a waving kapa pennant
  let pennant = null;
  const buildFar = (f) => {
    farGroup.clear();
    const post = makeStake(f.x, f.y, 1.22, true); farGroup.add(post); stakes.push(post);
    const r = lcg(61), n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, s = FAR_R * 0.2 + r() * 0.015;
      const m = new THREE.Mesh(edge, basaltMat); m.scale.set(s * 1.5, s, s * 1.5); m.rotation.y = r() * 6;
      m.position.set(f.x + Math.cos(a) * (FAR_R - 0.025), s * 0.45, Z(f.y) + Math.sin(a) * (FAR_R - 0.025)); m.castShadow = true; m.receiveShadow = true; farGroup.add(m);
    }
    // the scoring ring: white coral pebbles on the earth
    const pg = new THREE.SphereGeometry(0.02, 7, 5), pm = new THREE.MeshStandardMaterial({ color: 0xf6f0dc, roughness: 0.75 });
    const pn = 110, im = new THREE.InstancedMesh(pg, pm, pn), d = new THREE.Object3D();
    for (let i = 0; i < pn; i++) { const a = (i / pn) * TAU, rr = RING_R + (r() - 0.5) * 0.03; d.position.set(f.x + Math.cos(a) * rr, 0.008, Z(f.y) + Math.sin(a) * rr); d.scale.set(1 + r() * 0.6, 0.5, 1 + r() * 0.6); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
    farGroup.add(im);
    // pennant: a cloth ribbon waving from the post top (vertices animated)
    const pgeo = new THREE.PlaneGeometry(0.42, 0.2, 10, 2);
    pgeo.translate(0.21, 0, 0);
    const pc = cvs(128, 64), pg2 = pc.getContext('2d');
    pg2.fillStyle = '#b21f26'; pg2.fillRect(0, 0, 128, 64);
    pg2.fillStyle = '#f0e4c4'; for (let i = 0; i < 6; i++) { pg2.beginPath(); pg2.moveTo(i * 24 + 6, 0); pg2.lineTo(i * 24 + 18, 0); pg2.lineTo(i * 24 + 12, 22); pg2.closePath(); pg2.fill(); }
    pg2.fillStyle = '#1b1b1f'; for (let i = 0; i < 6; i++) { pg2.beginPath(); pg2.moveTo(i * 24 + 6, 64); pg2.lineTo(i * 24 + 18, 64); pg2.lineTo(i * 24 + 12, 42); pg2.closePath(); pg2.fill(); }
    pennant = new THREE.Mesh(pgeo, new THREE.MeshStandardMaterial({ map: mkTex(pc), side: THREE.DoubleSide, roughness: 0.9 }));
    pennant.position.set(f.x + 0.02, 1.14 * 1.0, Z(f.y)); pennant.castShadow = true; pennant.userData.base = pgeo.attributes.position.array.slice();
    farGroup.add(pennant);
  };
  const buildBoulder = (r0) => {
    const geo = new THREE.SphereGeometry(r0, 28, 18), p = geo.attributes.position, rr = lcg(Math.floor(r0 * 1000) + 7);
    const fx = rr() * 7, fy = rr() * 7;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.13 * Math.sin(x * 9 + fx) * Math.cos(z * 8 + fy) + 0.06 * Math.sin(y * 17 + fx * 2);
      p.setXYZ(i, x * k, Math.max(y * k * 0.78, -r0 * 0.1), z * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, basaltMat); m.castShadow = true; m.receiveShadow = true; return m;
  };
  const mudMat = new THREE.MeshStandardMaterial({ color: 0x4a301c, roughness: 0.22, metalness: 0.0, envMapIntensity: 1.4 });

  // rebuild everything that depends on the course
  let curTrack = null;
  const setTrack = (tr) => {
    if (curTrack === tr) return;
    curTrack = tr; stakes.length = 0;
    gateGroup.clear(); rockGroup.clear(); mudGroup.clear(); ringGroup.clear(); edging.clear();
    const L = tr.len;
    laneMesh.scale.set(1, (L + 12) / (len + 12), 1); laneMesh.position.z = -((L + 12) / 2 - 8);
    laneMat.map.repeat.set(1, (L + 12) / 4); laneMat.bumpMap.repeat.set(3, (L + 12) / 1.5);
    for (const g of tr.gates) for (const sx of [g.x - g.w / 2 - STAKE_R, g.x + g.w / 2 + STAKE_R]) { const s = makeStake(sx, g.y); gateGroup.add(s); stakes.push(s); }
    buildFar(tr.far);
    for (const ro of tr.rocks) { const b = buildBoulder(ro.r); b.position.set(ro.x, 0, Z(ro.y)); b.rotation.y = ro.x * 3; rockGroup.add(b); const sh = B.contactShadow(ro.r * 1.5, 0.5); sh.position.set(ro.x, 0.006, Z(ro.y)); rockGroup.add(sh); }
    for (const m of tr.mud) {
      const w = m.x1 - m.x0, d = m.y1 - m.y0;
      const geo = new THREE.PlaneGeometry(w, d, 1, 1);
      const mesh = new THREE.Mesh(geo, mudMat); mesh.rotation.x = -Math.PI / 2; mesh.position.set((m.x0 + m.x1) / 2, 0.009, Z((m.y0 + m.y1) / 2)); mesh.receiveShadow = true; mesh.renderOrder = 2; mudGroup.add(mesh);
      const r = lcg(m.y0 * 13 + 5), pb = new THREE.SphereGeometry(0.03, 6, 4);
      for (let i = 0; i < 24; i++) { const p = new THREE.Mesh(pb, basaltMat); p.scale.set(1 + r(), 0.5, 1 + r()); p.position.set(m.x0 + r() * w, 0.012, Z(m.y0 + r() * d)); mudGroup.add(p); }
    }
    // edging stones every ~0.45 m, a little irregular, and a few tufts of grass beyond them
    const r = lcg(99);
    for (const side of [-1, 1]) for (let y = -2; y < L + 5; y += 0.42 + r() * 0.12) {
      const s = 0.06 + r() * 0.07, m = new THREE.Mesh(edge, basaltMat);
      m.scale.set(s * 1.4, s, s * 1.3); m.rotation.y = r() * 6;
      m.position.set(side * (tr.half + 0.38 + (r() - 0.5) * 0.12), s * 0.5, Z(y)); m.castShadow = true; m.receiveShadow = true; edging.add(m);
    }
  };

  // ---------------------------------------------------------------- palms
  const palmGroup = new THREE.Group(); root.add(palmGroup); farObjs.push(palmGroup);
  const fronds = [];
  {
    const bc = cvs(64, 256), g = bc.getContext('2d'), r = lcg(4);
    g.fillStyle = '#8a7358'; g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 9) { g.fillStyle = 'rgba(45,32,20,0.55)'; g.fillRect(0, y, 64, 2); g.fillStyle = 'rgba(190,168,130,0.35)'; g.fillRect(0, y + 3, 64, 2); }
    for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? 'rgba(40,30,20,0.3)' : 'rgba(200,180,140,0.25)'; g.fillRect(r() * 64, r() * 256, 1 + r() * 3, 1 + r() * 3); }
    const barkTex = mkTex(bc, { repeat: [1, 6] });
    const fc = cvs(128, 256), fg = fc.getContext('2d');
    fg.clearRect(0, 0, 128, 256);
    // a frond: a central rib and two rows of leaflets that narrow towards the tip (alpha-tested)
    fg.strokeStyle = '#2f6a2a'; fg.lineWidth = 3; fg.beginPath(); fg.moveTo(64, 256); fg.lineTo(64, 0); fg.stroke();
    for (let y = 250; y > 6; y -= 5) {
      const k = 1 - y / 256, len2 = 52 * Math.sin(Math.PI * (0.12 + 0.88 * (1 - k)) * 0.95 + 0.1) * (0.55 + 0.45 * (y / 256)) + 8;
      const drop = 14 + 12 * (y / 256);
      for (const s of [-1, 1]) {
        fg.strokeStyle = k < 0.5 ? '#3c8a34' : '#4aa03c'; fg.lineWidth = 3;
        fg.beginPath(); fg.moveTo(64, y); fg.quadraticCurveTo(64 + s * len2 * 0.5, y - 4, 64 + s * len2, y + drop); fg.stroke();
      }
    }
    const frondMat = new THREE.MeshStandardMaterial({ map: mkTex(fc), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, envMapIntensity: 0.9 });
    const frondGeo = (() => {
      const g2 = new THREE.PlaneGeometry(1.1, 3.0, 6, 14), p = g2.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), sy = p.getY(i) + 1.5;                       // along the frond 0..3
        const w = 1 - 0.55 * (sy / 3);                                   // narrower towards the tip
        p.setXYZ(i, x * w, -0.17 * sy * sy * 0.5 - 0.22 * Math.abs(x) * w, sy);
      }
      g2.computeVertexNormals(); return g2;
    })();
    const nutGeo = new THREE.SphereGeometry(0.1, 8, 6), nutMat = new THREE.MeshStandardMaterial({ color: 0x5a6a2c, roughness: 0.7 });
    const mkPalm = (x, z, h, lean, seed) => {
      const r2 = lcg(seed), g3 = new THREE.Group();
      const pts = []; for (let i = 0; i <= 6; i++) { const u = i / 6; pts.push(new THREE.Vector3(Math.sin(lean) * h * u * u * 0.5, h * u, 0)); }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tg = new THREE.TubeGeometry(curve, 14, 0.15, 8, false);
      // taper the trunk
      const tp = tg.attributes.position, n = tp.count / 9;
      for (let i = 0; i < tp.count; i++) { const ring = Math.floor(i / 9), u = ring / 14, k = 1 - 0.38 * u; const c = curve.getPoint(Math.min(1, u)); tp.setXYZ(i, c.x + (tp.getX(i) - c.x) * k, tp.getY(i), c.z + (tp.getZ(i) - c.z) * k); }
      void n;
      tg.computeVertexNormals();
      const trunk = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.95 })); trunk.castShadow = true; g3.add(trunk);
      const top = curve.getPoint(1);
      const crown = new THREE.Group(); crown.position.copy(top); g3.add(crown);
      const nf = quality === 'low' ? 9 : 14;
      for (let i = 0; i < nf; i++) {
        const f = new THREE.Mesh(frondGeo, frondMat); const a = (i / nf) * TAU + r2() * 0.3;
        const holder = new THREE.Group(); holder.rotation.y = a; const inner = new THREE.Group(); inner.rotation.x = -(0.1 + r2() * 0.75); inner.add(f);
        f.rotation.set(0, 0, (r2() - 0.5) * 0.3);
        f.scale.setScalar(0.85 + r2() * 0.3);
        holder.add(inner); crown.add(holder); fronds.push({ node: inner, base: inner.rotation.x, ph: r2() * 6, amp: 0.03 + r2() * 0.04 });
      }
      for (let i = 0; i < 5; i++) { const nut = new THREE.Mesh(nutGeo, nutMat); const a = i * 1.26; nut.position.set(Math.cos(a) * 0.17, -0.12 - (i % 2) * 0.06, Math.sin(a) * 0.17); crown.add(nut); }
      const sh = B.contactShadow(1.1, 0.35); sh.position.set(0.7, 0.006, 0.3); g3.add(sh);
      g3.position.set(x, 0, z); g3.rotation.y = r2() * 6;
      return g3;
    };
    const spots = [[-5.6, Z(3), 7.4, 0.25], [-7.2, Z(9), 8.6, -0.2], [-6.3, Z(16), 7.8, 0.3], [-8.4, Z(23), 8.8, 0.15], [5.9, Z(5), 8.2, -0.25], [7.1, Z(12), 7.2, 0.2], [6.2, Z(19), 8.4, -0.3], [8.8, Z(27), 9, 0.1], [-2.5, Z(36), 9.4, 0.2], [3.2, Z(38), 8.6, -0.2], [-10.5, Z(8), 9.2, 0.3], [11, Z(8), 8.8, -0.2]];
    spots.forEach((s, i) => palmGroup.add(mkPalm(s[0], s[1], s[2], s[3], 100 + i)));
    tick.push((t) => { for (const f of fronds) f.node.rotation.x = f.base + Math.sin(t * 0.9 + f.ph) * f.amp + Math.sin(t * 2.3 + f.ph * 2) * f.amp * 0.3; });
  }

  // ---------------------------------------------------------------- hale (thatched houses), mats
  {
    const tc = cvs(256), g = tc.getContext('2d'), r = lcg(15);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#c9a45e'); gr.addColorStop(1, '#a8823f'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1500; i++) { const x = r() * 256, y = r() * 256; g.strokeStyle = r() < 0.5 ? 'rgba(90,60,20,0.5)' : 'rgba(235,210,140,0.55)'; g.lineWidth = 1 + r(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y + 8 + r() * 28); g.stroke(); }
    for (let y = 30; y < 256; y += 46) { g.strokeStyle = 'rgba(60,36,12,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    const thatch = new THREE.MeshStandardMaterial({ map: mkTex(tc, { repeat: [3, 1.5] }), roughness: 1, side: THREE.DoubleSide });
    const wc = cvs(128), wg = wc.getContext('2d');
    wg.fillStyle = '#d8bb7a'; wg.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 8) { wg.fillStyle = i % 16 ? 'rgba(120,84,36,0.45)' : 'rgba(255,240,190,0.35)'; wg.fillRect(i, 0, 4, 128); wg.fillRect(0, i, 128, 4); }
    const weave = new THREE.MeshStandardMaterial({ map: mkTex(wc, { repeat: [3, 1] }), roughness: 0.95 });
    const post = new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 });
    const hale = (x, z, yaw, w, d, h, ridge) => {
      const g2 = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), weave); walls.position.y = h / 2; walls.castShadow = true; g2.add(walls);
      // gable roof: two sloped planes, overhanging
      const rw = w + 0.9, slope = Math.hypot(d / 2 + 0.5, ridge - h);
      const ang = Math.atan2(ridge - h, d / 2 + 0.5);
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.22, slope), thatch); p.castShadow = true;
        p.position.set(0, (h + ridge) / 2 + 0.05, s * (d / 4 + 0.25)); p.rotation.x = s * ang; g2.add(p);
      }
      const ends = new THREE.Shape(); ends.moveTo(-d / 2 - 0.4, 0); ends.lineTo(d / 2 + 0.4, 0); ends.lineTo(0, ridge - h + 0.05); ends.closePath();
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ShapeGeometry(ends), thatch); e.rotation.y = Math.PI / 2; e.position.set(s * (w / 2 + 0.01), h, 0); g2.add(e); }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), new THREE.MeshBasicMaterial({ color: 0x1b120a })); door.position.set(0, 0.66, d / 2 + 0.02); g2.add(door);
      for (const sx of [-1, 1]) { const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, h + 0.1, 8), post); pt.position.set(sx * (w / 2 + 0.05), h / 2, d / 2 + 0.05); g2.add(pt); }
      g2.position.set(x, 0, z); g2.rotation.y = yaw; return g2;
    };
    for (const hh of [hale(-11, Z(14), 0.35, 5.2, 3.4, 1.7, 3.5), hale(10.5, Z(21), -0.4, 4.4, 3.0, 1.55, 3.1), hale(2, Z(46), 0.1, 5, 3.2, 1.6, 3.3)]) { root.add(hh); farObjs.push(hh); }
  }

  // ---------------------------------------------------------------- floating motes (pollen / sea spray in the low sun)
  {
    const n = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), r = lcg(77);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 14; pos[i * 3 + 1] = 0.3 + r() * 4; pos[i * 3 + 2] = -r() * 22; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pc = cvs(32), pg = pc.getContext('2d'), gg = pg.createRadialGradient(16, 16, 0, 16, 16, 16); gg.addColorStop(0, 'rgba(255,240,200,0.9)'); gg.addColorStop(1, 'rgba(255,220,150,0)'); pg.fillStyle = gg; pg.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: mkTex(pc), size: 0.09, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, sizeAttenuation: true }));
    pts.frustumCulled = false; root.add(pts); farObjs.push(pts);
    tick.push((t, dt) => { for (let i = 0; i < n; i++) { pos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.08 + 0.04 * dt; pos[i * 3 + 1] += Math.sin(t * 0.5 + i * 2) * dt * 0.05; if (pos[i * 3] > 7) pos[i * 3] = -7; } geo.attributes.position.needsUpdate = true; });
  }

  // ---------------------------------------------------------------- the disc (polished basalt / red lava stone)
  const SIDES = [
    { base: '#17181c', mid: '#34363e', pit: 'rgba(2,2,3,0.9)', fleck: 'rgba(215,220,230,0.6)', rough: 0.22 },     // charcoal basalt
    { base: '#7a3a1e', mid: '#b4602f', pit: 'rgba(40,14,6,0.9)', fleck: 'rgba(255,214,170,0.5)', rough: 0.3 },     // red lava stone
  ];
  const discMats = SIDES.map((S, k) => {
    const c = cvs(256), g = c.getContext('2d'), r = lcg(300 + k);
    const gr = g.createRadialGradient(100, 90, 4, 128, 128, 170); gr.addColorStop(0, S.mid); gr.addColorStop(1, S.base);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 520; i++) { const x = r() * 256, y = r() * 256; g.fillStyle = r() < 0.65 ? S.pit : S.fleck; g.beginPath(); g.arc(x, y, 0.4 + r() * 0.9, 0, TAU); g.fill(); }
    for (let i = 0; i < 10; i++) { const x = r() * 256, y = r() * 256, rr = 20 + r() * 60, gg = g.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, 'rgba(255,255,255,0.10)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    const m = new THREE.MeshPhysicalMaterial({ map: mkTex(c), roughness: S.rough * 0.8, metalness: 0.12, clearcoat: 0.9, clearcoatRoughness: 0.1, envMapIntensity: 1.1 });
    return m;
  });
  const discGeo = (() => {
    const R = DISC_R, h = DISC_T / 2, e = 0.007;
    // face: shallow dish with two carved rings, a rounded rim
    const prof = [[0, -h], [R * 0.5, -h], [R - e, -h], [R, -h + e], [R, h - e], [R - e, h], [R * 0.86, h], [R * 0.84, h - 0.0035], [R * 0.7, h - 0.0035], [R * 0.68, h], [R * 0.46, h], [R * 0.44, h - 0.004], [R * 0.2, h - 0.006], [0, h - 0.0065]];
    return B.lathe(prof, 36);
  })();
  const makeDisc = (side) => {
    const m = new THREE.Mesh(discGeo, discMats[side % 2]); m.castShadow = true; m.receiveShadow = true; m.userData.side = side % 2;
    return m;
  };
  // orientation: on edge rolling along heading h (world yaw of the lane direction), spin in radians, lay 0..1 (0 on edge, 1 flat)
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _ax = new THREE.Vector3(1, 0, 0), _up = new THREE.Vector3(0, 1, 0), _fw = new THREE.Vector3(0, 0, -1);
  const poseDisc = (m, x, z, heading, spin, lay, wob = 0, lift = 0) => {
    const R = DISC_R, ht = DISC_T / 2;
    // heading: lane direction angle from +lane-y (0 = straight up the lane), positive right; world forward is -Z
    _q.setFromAxisAngle(_up, -heading);
    _q2.setFromAxisAngle(_fw, 0); // bank axis is the heading axis (local -Z)
    const tilt = lay * (Math.PI / 2) + wob;
    const qTilt = new THREE.Quaternion().setFromAxisAngle(_fw, tilt);
    const qSpin = new THREE.Quaternion().setFromAxisAngle(_ax, spin);
    const qEdge = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    m.quaternion.copy(_q).multiply(qTilt).multiply(qSpin).multiply(qEdge);
    const ct = Math.cos(tilt), st = Math.abs(Math.sin(tilt));
    m.position.set(x, R * ct + ht * st + 0.002 + lift, z);
  };

  // ---------------------------------------------------------------- lighting rig (golden hour)
  const lights = (() => {
    const hemi = new THREE.HemisphereLight(0xffe3bd, 0x4b5a35, 0.95);
    const key = new THREE.DirectionalLight(0xffc98a, 2.7); key.position.set(-6, 7.5, 8);
    const rim = new THREE.DirectionalLight(0xffb36a, 2.3); rim.position.set(7, 3.5, -16);
    const fill = new THREE.DirectionalLight(0x9fc2ff, 0.5); fill.position.set(8, 3, 6);
    key.target.position.set(0, 0, -5);
    root.add(hemi, key, key.target, rim, fill);
    return { hemi, key, rim, fill };
  })();
  const fogColor = 0xf3c79a;

  const world = {
    root, lights, THREE, B, tick, farObjs, stakes, fronds, mkTex, cvs, lcg, DISC_R, DISC_T, fogColor,
    discMats, makeDisc, poseDisc, setTrack,
    update(t, dt) {
      for (const f of tick) f(t, dt);
      if (pennant) {
        const p = pennant.geometry.attributes.position, b = pennant.userData.base;
        for (let i = 0; i < p.count; i++) {
          const x = b[i * 3], u = x / 0.42;
          p.setZ(i, b[i * 3 + 2] + Math.sin(t * 5 - x * 14) * 0.05 * u + Math.sin(t * 2.1 + u) * 0.03 * u);
          p.setY(i, b[i * 3 + 1] - u * u * 0.04 + Math.sin(t * 3.7 - x * 9) * 0.012 * u);
        }
        p.needsUpdate = true; pennant.geometry.computeVertexNormals();
      }
      for (const s of stakes) {
        const u = s.userData;
        if (u.flag) u.flag.rotation.y = Math.sin(t * 4 + u.x * 3) * 0.28 + 0.1;
        if (u.wob > 0.0005) {
          u.wob *= Math.exp(-dt * 7); const a = Math.sin(t * 44) * u.wob;
          s.rotation.set(u.wobDir[1] * a, 0, -u.wobDir[0] * a);
        } else if (u.wob) { u.wob = 0; s.rotation.set(0, 0, 0); }
      }
    },
    hitStake(x, y, vx, vy, v) {
      let best = null, bd = 1e9;
      for (const s of stakes) { const d = Math.hypot(s.userData.x - x, s.userData.y - y); if (d < bd) { bd = d; best = s; } }
      if (best && bd < 0.5) { const l = Math.hypot(vx, vy) || 1; best.userData.wob = Math.min(0.3, 0.05 + v * 0.025); best.userData.wobDir = [vx / l, -vy / l]; }
    },
    dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); },
  };
  if (track) setTrack(track);
  return world;
}
