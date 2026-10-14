// The village courtyard at golden hour: red earth, a thatched hut ring, a baobab, clay pots, seated elders (crowd3d) and drifting
// dust in the low sun. Metres; the sand bed is at the origin; the camera looks along -z.
import { THREE, board3d as B, buildScenery, createCrowd3d, loadHuman, loadClips } from '../vendor3d/index.js';

const TAU = Math.PI * 2;
const hash = (i) => { let x = (Math.imul(i + 1, 2654435761)) >>> 0; x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ctex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; return t; };

function thatchTexture() {
  const c = cv(256), x = c.getContext('2d');
  x.fillStyle = '#9b7a38'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const px = hash(i * 3) * 256, py = hash(i * 3 + 1) * 256, l = 20 + hash(i * 3 + 2) * 70, k = hash(i + 700);
    x.strokeStyle = k < 0.5 ? `rgba(70,48,14,${0.25 + k * 0.4})` : `rgba(230,200,120,${0.2 + k * 0.3})`; x.lineWidth = 1 + hash(i + 9) * 1.4;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (hash(i + 5) - 0.5) * 4, py + l); x.stroke();
  }
  // horizontal bundle bands
  for (let y = 0; y < 256; y += 51) { x.fillStyle = 'rgba(40,26,8,0.35)'; x.fillRect(0, y, 256, 3); }
  return c;
}
function mudTexture() {
  const c = cv(256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#b8794a'); g.addColorStop(1, '#8e5634'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) { x.fillStyle = hash(i) < 0.5 ? 'rgba(60,30,12,0.18)' : 'rgba(255,220,170,0.14)'; x.fillRect(hash(i * 2 + 1) * 256, hash(i * 2 + 2) * 256, 1 + hash(i + 7) * 3, 1 + hash(i + 8) * 3); }
  // painted band pattern (chevrons) near the top of the wall
  x.strokeStyle = 'rgba(40,20,8,0.7)'; x.lineWidth = 3; x.beginPath();
  for (let i = 0; i <= 16; i++) { const px = i * 16; x.lineTo(px, 22 + (i % 2) * 14); } x.stroke();
  x.strokeStyle = 'rgba(238,224,196,0.8)'; x.lineWidth = 2; x.beginPath();
  for (let i = 0; i <= 16; i++) { const px = i * 16; x.lineTo(px, 48 + (i % 2) * 14); } x.stroke();
  return c;
}
function barkTexture() {
  const c = cv(256), x = c.getContext('2d');
  x.fillStyle = '#6e5a46'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { const px = hash(i) * 256; x.strokeStyle = `rgba(${hash(i + 1) < 0.5 ? '30,20,12' : '170,150,125'},${0.2 + hash(i + 2) * 0.3})`; x.lineWidth = 1 + hash(i + 3) * 3; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + 8, 80, px - 8, 170, px + 4, 256); x.stroke(); }
  return c;
}

export function createWorld({ quality = 'high', camera = null } = {}) {
  const group = new THREE.Group(); group.name = 'world';
  const tick = [];
  // ---------------------------------------------------------------- scenery (sky, backdrop, ground)
  const scenery = buildScenery({ timeOfDay: 'day', season: 'summer', quality, wind: 0.5, clouds: 0.5, radius: 90, culture: 'african-savanna',
    layers: [{ t: 'sky', id: 'sky-day' }, { t: 'backdrop', id: 'bd-savanna', seed: 3 }, { t: 'ground', id: 'gr-red-earth', size: 160, tile: 5 },
      { t: 'cutouts', id: 'tr-acacia', count: 3, r: [22, 38], arc: [-150, -95], scale: [8, 11], seed: 2, sway: 0.5 }, { t: 'cutouts', id: 'tr-acacia-2', count: 3, r: [26, 48], arc: [-85, -30], scale: [8, 12], seed: 6, sway: 0.5 }] });
  group.add(scenery.group);


  // ---------------------------------------------------------------- packed-earth courtyard (swept, with scattered pebbles)
  function earthTexture() {
    const c = cv(1024), x = c.getContext('2d');
    x.fillStyle = '#ad7a4e'; x.fillRect(0, 0, 1024, 1024);
    // broom sweeps
    for (let i = 0; i < 90; i++) {
      const px = hash(i * 5 + 100) * 1024, py = hash(i * 5 + 101) * 1024, a = hash(i * 5 + 102) * 0.9 + 0.1, len = 40 + hash(i * 5 + 103) * 110;
      x.strokeStyle = hash(i + 9) < 0.5 ? 'rgba(70,40,18,0.07)' : 'rgba(250,215,170,0.08)'; x.lineWidth = 1 + hash(i + 12) * 1.6;
      x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + len * 0.3, py + a * 20, px + len * 0.7, py - a * 20, px + len, py + a * 8); x.stroke();
    }
    for (let i = 0; i < 5200; i++) { const k = hash(i + 800); x.fillStyle = k < 0.45 ? `rgba(60,34,16,${0.15 + k * 0.4})` : k < 0.8 ? `rgba(255,228,190,${0.1 + k * 0.3})` : 'rgba(110,98,86,0.5)'; const r = 0.8 + hash(i + 3) * (k > 0.8 ? 3.5 : 1.6); x.beginPath(); x.arc(hash(i * 2 + 7) * 1024, hash(i * 2 + 8) * 1024, r, 0, 7); x.fill(); }
    return c;
  }
  const earthMat = new THREE.MeshStandardMaterial({ map: ctex(earthTexture(), [34, 34]), roughness: 1, metalness: 0, bumpMap: null });
  const earth = new THREE.Mesh(new THREE.CircleGeometry(60, 64), earthMat);
  earth.rotation.x = -Math.PI / 2; earth.position.y = 0.003; earth.receiveShadow = true; group.add(earth);
  // soft ring so the courtyard melts into the savanna
  const edge = new THREE.Mesh(new THREE.RingGeometry(8.2, 10.5, 56), new THREE.MeshBasicMaterial({ color: 0xc8955c, transparent: true, opacity: 0.0, depthWrite: false }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = 0.004; group.add(edge);


  // ---------------------------------------------------------------- cooking fire (flickering light) and a woven mat
  const mat = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshStandardMaterial({ map: (() => { const c = cv(256), x = c.getContext('2d'); x.fillStyle = '#9c7a48'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 256; i += 8) { x.fillStyle = i % 16 ? 'rgba(60,35,12,0.18)' : 'rgba(255,225,160,0.1)'; x.fillRect(i, 0, 4, 256); x.fillRect(0, i, 256, 2); } return ctex(c, [8, 8]); })(), roughness: 1 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.006, -2.2); mat.scale.set(1.7, 1.0, 1); mat.receiveShadow = true; group.add(mat);
  const stone = B.material('stone', { color: '#6a6055', color2: '#a39787', size: 256, seed: 3 });
  const fire = new THREE.Group(); fire.position.set(2.3, 0, -3.3);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU, st = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 7), stone); st.position.set(Math.cos(a) * 0.26, 0.06, Math.sin(a) * 0.26); st.scale.set(1.2, 0.8, 1); st.castShadow = true; fire.add(st); }
  for (let i = 0; i < 4; i++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), new THREE.MeshStandardMaterial({ color: '#3a2412' })); lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 0.8; lg.position.y = 0.07; fire.add(lg); }
  const flame = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.1, 0.34, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffa238, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  flame.position.y = 0.26; fire.add(flame);
  const flame2 = flame.clone(); flame2.scale.set(0.6, 0.7, 0.6); flame2.material = flame.material.clone(); flame2.material.color.set(0xffe08a); flame2.position.y = 0.2; fire.add(flame2);
  const fireLight = new THREE.PointLight(0xff9a40, 1.4, 3.2, 1.6); fireLight.position.y = 0.4; fire.add(fireLight);
  group.add(fire);
  tick.push((dt, t) => { const f = 0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 31); fireLight.intensity = 1.2 * f + 0.2; flame.scale.set(1 + 0.12 * Math.sin(t * 13), 0.9 + 0.25 * f, 1 + 0.12 * Math.cos(t * 11)); flame2.scale.set(0.6 + 0.08 * Math.sin(t * 19), 0.6 + 0.22 * f, 0.6); });

  // ---------------------------------------------------------------- huts
  const mudMat = new THREE.MeshStandardMaterial({ map: ctex(mudTexture(), [3, 1]), roughness: 0.95 });
  const thatchMat = new THREE.MeshStandardMaterial({ map: ctex(thatchTexture(), [4, 2]), roughness: 1, side: THREE.DoubleSide });
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x2a160b });
  function hut(x, z, s = 1, rot = 0) {
    const g = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.2, 1.55, 28, 1, true), mudMat);
    wall.position.y = 0.78; wall.castShadow = true; wall.receiveShadow = true;
    // roof: slightly concave cone with an eave and a finial
    const prof = [[0, 2.85], [0.1, 2.7], [0.42, 2.25], [0.9, 1.88], [1.45, 1.56], [1.82, 1.38], [1.9, 1.34]].map(([r, y]) => new THREE.Vector2(r, y));
    const roof = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), thatchMat); roof.castShadow = true; roof.receiveShadow = true;
    const base = new THREE.Mesh(new THREE.CircleGeometry(1.2, 28), new THREE.MeshStandardMaterial({ color: 0x8a5a38, roughness: 1 })); base.rotation.x = -Math.PI / 2; base.position.y = 0.01;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.85, 1, 1), doorMat); door.position.set(0, 0.45, 1.185); door.scale.set(1, 1, 1);
    const doorTop = new THREE.Mesh(new THREE.CircleGeometry(0.25, 14, 0, Math.PI), doorMat); doorTop.position.set(0, 0.88, 1.185);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a1a })); fin.position.y = 2.88;
    g.add(wall, roof, base, door, doorTop, fin); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rot; group.add(g); return g;
  }
  hut(-5.6, -9.2, 1.0, 0.5); hut(5.8, -10.0, 1.15, -0.3); hut(-0.4, -14.0, 1.25, 0.1); hut(-11.0, -12.5, 1.0, 0.8); hut(11.2, -14.5, 1.1, -0.6);

  // ---------------------------------------------------------------- baobab
  const barkMat = new THREE.MeshStandardMaterial({ map: ctex(barkTexture(), [2, 3]), roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4f6a2a, roughness: 1 });
  function baobab(x, z, s = 1) {
    const g = new THREE.Group();
    const prof = [[1.25, 0], [1.05, 0.6], [0.88, 1.6], [0.86, 3.0], [0.98, 4.2], [0.86, 5.0]].map(([r, y]) => new THREE.Vector2(r, y));
    const trunk = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), barkMat); trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + hash(i) * 0.5, len = 2.6 + hash(i + 3) * 1.4;
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.26, len, 7), barkMat);
      br.position.set(Math.cos(a) * (0.7 + len * 0.18), 5.0 + len * 0.28, Math.sin(a) * (0.7 + len * 0.18));
      br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); br.castShadow = true; g.add(br);
      const tip = new THREE.Vector3(Math.cos(a) * (0.7 + len * 0.18 + len * 0.42), 5.0 + len * 0.28 + len * 0.36, Math.sin(a) * (0.7 + len * 0.18 + len * 0.42));
      for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.75 + hash(i * 3 + k) * 0.5, 10, 7), leafMat); l.scale.y = 0.55; l.position.set(tip.x + (hash(i + k * 7) - 0.5) * 1.1, tip.y + (hash(i + k * 5) - 0.5) * 0.5, tip.z + (hash(i + k * 11) - 0.5) * 1.1); l.castShadow = true; g.add(l); }
    }
    g.position.set(x, 0, z); g.scale.setScalar(s); group.add(g); return g;
  }
  baobab(9.0, -12.5, 1.1); baobab(-14.0, -17.0, 1.5);

  // ---------------------------------------------------------------- clay pots, a pestle mortar, a woven mat edge
  const clay = B.material('clay', { color: '#a35a38', color2: '#c98055', roughness: 0.85, size: 256 });
  function pot(x, z, s = 1, rot = 0) {
    const prof = [[0, 0], [0.12, 0.0], [0.2, 0.08], [0.27, 0.22], [0.29, 0.34], [0.24, 0.46], [0.15, 0.55], [0.14, 0.62], [0.18, 0.66], [0.15, 0.68]];
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 22), clay);
    m.position.set(x, 0, z); m.scale.setScalar(s); m.rotation.y = rot; m.castShadow = true; m.receiveShadow = true; group.add(m); return m;
  }
  pot(-2.0, -0.9, 0.9); pot(2.05, -0.5, 1.05); pot(-2.5, -1.7, 0.75); pot(2.5, -1.7, 0.85, 1.2); pot(0.9, -3.2, 0.9);
  // gourd bowls
  for (const [x, z] of [[-1.7, -1.1], [1.8, -1.3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, TAU, 0, Math.PI / 2), clay); b.rotation.x = Math.PI; b.position.set(x, 0.14, z); b.castShadow = true; group.add(b); }

  // ---------------------------------------------------------------- elders: real skinned humans, squatting round the drawing
  let T = 0;
  const elders = [];
  const ELDERS = [
    { id: 'athlete_m', x: -1.15, z: -2.1, skin: 'deep', hair: 'white', top: '#b8691f', bottoms: '#243a73', wrap: '#e8d9b0', seed: 1 },
    { id: 'athlete_f', x: 0.1, z: -2.45, skin: 'brown', hair: 'black', top: '#a3342a', bottoms: '#e0b23a', wrap: '#2c4d9c', seed: 2 },
    { id: 'athlete_m', x: 1.2, z: -2.0, skin: 'brown', hair: 'grey', top: '#e9dfc6', bottoms: '#5a3a1e', wrap: '#6b2a1a', seed: 3 },
  ];
  const eldersReady = (async () => {
    let clips;
    try { clips = await loadClips('base'); } catch (e) { console.warn('elders: clips failed', e); return; }
    for (const e of ELDERS) {
      try {
        const h = await loadHuman({ character: e.id, skin: e.skin, clips, quality: quality === 'low' ? 'low' : undefined });
        h.setSkin(e.skin); h.setHair(e.hair); h.setKit({ top: e.top, bottoms: e.bottoms, shoes: e.skin === 'deep' ? '#583826' : '#8c5a3c', socks: e.skin === 'deep' ? '#583826' : '#8c5a3c' });
        h.root.position.set(e.x, 0, e.z); h.root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
        h.play('crouch_idle'); h.faceToward(0, 0, { snap: true });
        // head wrap: a folded cloth ring on the head bone
        const wrapMat = B.material('cloth', { color: e.wrap, color2: e.wrap, size: 128, seed: e.seed });
        const hw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, TAU, 0, Math.PI * 0.62), wrapMat); hw.scale.set(1.08, 0.78, 1.18);
        const head = h.bones && h.bones.Bip01_Head;
        if (head) { hw.position.set(0.1, 0, 0); hw.rotation.z = -Math.PI / 2; head.add(hw); }
        // a wrapped cloth falls from the waist to the ground, so the squatting figure sits in its wrapper
        const cc = document.createElement('canvas'); cc.width = 256; cc.height = 128; const cx = cc.getContext('2d');
        cx.fillStyle = e.bottoms; cx.fillRect(0, 0, 256, 128);
        for (let b = 0; b < 8; b++) { cx.fillStyle = b % 2 ? e.wrap : e.top; cx.fillRect(b * 32 + 4, 0, 6, 128); cx.fillStyle = 'rgba(255,255,255,0.22)'; cx.fillRect(b * 32 + 16, 0, 2, 128); }
        for (let y = 8; y < 128; y += 22) { cx.strokeStyle = 'rgba(20,10,4,0.4)'; cx.lineWidth = 2; cx.beginPath(); for (let x = 0; x <= 256; x += 8) cx.lineTo(x, y + ((x / 8) % 2) * 5); cx.stroke(); }
        const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(2, 1);
        const cloth = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.95 });
        const prof = [[0.15, 0.64], [0.23, 0.54], [0.3, 0.33], [0.34, 0.12], [0.36, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
        const sk = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), cloth); sk.material.side = THREE.DoubleSide; sk.position.set(0, 0, 0.16); sk.castShadow = true; sk.receiveShadow = true;
        h.root.add(sk);
        group.add(h.root); elders.push({ h, e, t: hash(e.seed) * 4 });
      } catch (err) { console.warn('elder failed', err); }
    }
  })();

  let crowd = null;

  // ---------------------------------------------------------------- dust motes drifting in the low sun
  const N = quality === 'low' ? 30 : 70;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (hash(i) - 0.5) * 7; pos[i * 3 + 1] = 0.2 + hash(i + 50) * 2.6; pos[i * 3 + 2] = -3 + hash(i + 90) * 5; vel[i * 3] = 0.04 + hash(i + 7) * 0.05; vel[i * 3 + 1] = 0.01 + hash(i + 9) * 0.03; vel[i * 3 + 2] = (hash(i + 13) - 0.5) * 0.03; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffe0a0, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  dust.frustumCulled = false; group.add(dust);

  return {
    group, scenery, crowd,
    ready: Promise.all([scenery.ready, eldersReady]),
    update(dt, cam, calm) {
      T += dt; for (const f of tick) f(dt, T);
      try { scenery.update(dt, cam); } catch { /* still loading */ }
      if (crowd) { try { crowd.update(calm ? 0 : dt); } catch { /* ignore */ } }
      for (const el of elders) {
        el.t += dt;
        if (el.cheerT > 0) { el.cheerT -= dt; if (el.cheerT <= 0) { el.h.crossfade('crouch_idle', 0.5); } }
        el.h.update(calm ? 0 : dt);
      }
      if (!calm) {
        const a = pg.attributes.position.array;
        for (let i = 0; i < N; i++) { a[i * 3] += vel[i * 3] * dt; a[i * 3 + 1] += vel[i * 3 + 1] * dt; a[i * 3 + 2] += vel[i * 3 + 2] * dt; if (a[i * 3] > 4) a[i * 3] = -4; if (a[i * 3 + 1] > 3) a[i * 3 + 1] = 0.2; }
        pg.attributes.position.needsUpdate = true;
      }
    },
    cheer() {
      try { crowd && crowd.react('cheer', { origin: [0, 0, -2], radius: 8 }); } catch { /* ignore */ }
      for (const el of elders) { try { el.h.crossfade('clap', 0.3); el.cheerT = 3.2 + hash(el.e.seed) * 0.8; } catch { /* clip missing */ } }
    },
    setTime(name) { try { scenery.setTimeOfDay(name); } catch { /* ignore */ } },
  };
}
