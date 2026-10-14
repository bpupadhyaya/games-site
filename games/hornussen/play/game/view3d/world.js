// The Swiss meadow in 3D. World units are metres: x sideways across the Ries (0 = its centre line), y up, z along the Ries away from
// the Bock (the launch ramp at z = 0, the far end of the Ries at z = 200). Everything here is display only: the presenter feeds it the
// venue, the wind and the fans' excitement; the sim never reads anything back.
import { RIES, ROWS, MIN_SCORING, venueOf } from '../src/rules.js';

const TAU = Math.PI * 2;
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, srgb = true, aniso = 8, mip = true } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso; t.generateMipmaps = mip;
  return t;
}

// Merge {geo, matrix, color} items into ONE vertex-coloured geometry (one draw call for all the static scenery).
function mergeColored(THREE, items) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  for (const it of items) {
    const g = it.geo, p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(it.matrix); c.set(it.color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(it.matrix); pos.set([v.x, v.y, v.z], (vo + i) * 3);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
      const sh = it.shade ? 1 + (hash(vo + i) - 0.5) * it.shade : 1;
      col.set([c.r * sh, c.g * sh, c.b * sh], (vo + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

const hexMix = (a, b, f) => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - f) + ((pb >> s) & 255) * f);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

// the lane texture: mowing stripes, zone tints, white lines and distance numbers painted on the grass (12 px per metre across, 12 px per metre along)
function paintLane(g, w, h, v, turned = false) {
  const px = 12, len = RIES.len, half = RIES.half;
  // canvas left = world +x (the lane is read looking down it from the Bock, where +x is on the left); canvas top = the far end
  const X = (x) => (half - x) * px, Z = (z) => h - z * px;
  g.fillStyle = v.grass[0]; g.fillRect(0, 0, w, h);
  for (let z = 0, k = 0; z < len; z += 10, k++) { g.fillStyle = k % 2 ? 'rgba(255,255,230,0.07)' : 'rgba(0,40,0,0.05)'; g.fillRect(0, Z(z + 10), w, 10 * px + 1); }
  const zone = (a, b, col) => { g.fillStyle = col; g.fillRect(0, Z(b), w, (b - a) * px); };
  zone(MIN_SCORING, 105, 'rgba(255,248,160,0.10)'); zone(105, 135, 'rgba(255,230,110,0.15)'); zone(135, len, 'rgba(255,205,70,0.21)');
  g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 7;
  g.strokeRect(3.5, 3.5, w - 7, h - 7);
  const line = (z, dash, a) => { g.save(); g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 6; if (dash) g.setLineDash([26, 20]); g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(w, Z(z)); g.stroke(); g.restore(); };
  line(MIN_SCORING, true, 0.8); line(105, true, 0.8); line(135, true, 0.8);
  for (const z of ROWS) { g.fillStyle = 'rgba(255,255,255,0.22)'; for (const x of [-10.5, -3.5, 3.5, 10.5]) { g.beginPath(); g.ellipse(X(x), Z(z), 18, 9, 0, 0, TAU); g.fill(); } }
  g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,0.6)';
  // (x is mirrored via scale(-1): the lane map is seen mirrored on the ground) two textures: the numbers read upright from the Bock (strike view) or turned round when seen from the far end (fielding view)
  const num = (z, str, sz, flip) => { g.save(); g.translate(X(0), Z(z)); if (flip) g.rotate(Math.PI); g.scale(-1, 2.4); g.font = `800 ${sz}px "Barlow", system-ui, sans-serif`; g.fillText(str, 0, 0); g.restore(); };
  for (const [z, s] of [[MIN_SCORING, '1 POINT'], [105, '2 POINTS'], [135, '3 POINTS']]) { if (turned) num(z - 5, s, 30, true); else num(z + 7, s, 30, false); }
}

// Alpine scenery presets per venue (photo panorama + sky from the shared scenery kit; the near field is built here in real 3D).
const SCEN = {
  emmental: { sky: 'sky-clear', bd: 'bd-alpine-day', mix: ['bd-alpine-snow'], hills: 'band-hills-green' },
  appenzell: { sky: 'sky-day', bd: 'bd-alpine-day', mix: [], hills: 'band-hills-green' },
  entlebuch: { sky: 'sky-clear', bd: 'bd-golden-ridges', mix: ['bd-alpine-day'], hills: 'band-hills-green', tod: 'dawn' },
  jura: { sky: 'sky-overcast', bd: 'bd-autumn-valley', mix: ['bd-meadow-day'], hills: 'band-autumn-trees' },
};

export function buildWorld(stage, THREE, { quality = 'high', venue = 'emmental', V3 = null } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const mat = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => M.clone().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S.set(sx, sy, sz));
  const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n, 1);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);
  const cone = (r, h, n = 7) => new THREE.CylinderGeometry(0, r, h, n, 1);
  const W = { root, venue: null, scenery: {}, sceneryReady: null };

  // ---- the alpine backdrop: photo sky + panorama + hill bands from the shared scenery kit, one per venue (built lazily) -----------------
  const sceneryFor = (id) => {
    if (W.scenery[id] || !V3 || !V3.buildScenery) return W.scenery[id] || null;
    const c = SCEN[id] || SCEN.emmental;
    const sc = V3.buildScenery({
      layers: [
        { t: 'sky', id: c.sky },
        { t: 'backdrop', id: c.bd, mix: c.mix, seed: 4 },
        { t: 'band', id: c.hills, r: 330, h: 46, arc: [0, 360] },
      ],
      culture: 'alpine', radius: 560, quality, timeOfDay: c.tod || 'day', wind: 0.5,
    });
    sc.group.visible = false; root.add(sc.group); W.scenery[id] = sc;
    sc.ready.then(() => { sc.loaded = true; if (paintedFor === id) { sc.group.visible = true; stage.invalidate(); } });
    return sc;
  };
  const grassMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), grassMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.02, 100); ground.receiveShadow = true; root.add(ground);
  const laneMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(RIES.half * 2, RIES.len), laneMat);
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, 0.004, RIES.len / 2); lane.receiveShadow = true; root.add(lane);
  // trampled earth around the Bock (a soft-edged disc)
  const apronTex = canvasTex(THREE, 128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(150,120,72,1)'); gr.addColorStop(0.7, 'rgba(140,112,66,0.9)'); gr.addColorStop(1, 'rgba(140,112,66,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + hash(i) * 70},${70 + hash(i + 3) * 50},40,0.22)`; g.fillRect(hash(i * 5) * w, hash(i * 7) * h, 2 + hash(i) * 3, 1 + hash(i + 1) * 2); }
  });
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(10, 12), new THREE.MeshStandardMaterial({ map: apronTex, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(-0.6, 0.01, -1.4); root.add(apron);
  const lanes = { bat: null, field: null, turned: false };
  W.setLaneTurned = (turned) => { if (lanes.turned === turned || !lanes.bat) return; lanes.turned = turned; laneMat.map = turned ? lanes.field : lanes.bat; laneMat.needsUpdate = true; stage.invalidate(); };
  let paintedFor = '';
  function setVenue(id) {
    if (paintedFor === id) return; paintedFor = id; W.venue = id;
    const v = venueOf(id);
    for (const k of Object.keys(W.scenery)) W.scenery[k].group.visible = false;
    const sc = sceneryFor(id); if (sc && sc.loaded) sc.group.visible = true;
    const gt = canvasTex(THREE, 512, 512, (g, w, h) => {
      g.fillStyle = v.grass[1]; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { const gr = g.createRadialGradient(hash(i) * w, hash(i + 5) * h, 2, hash(i) * w, hash(i + 5) * h, 40 + hash(i + 9) * 60); gr.addColorStop(0, i % 2 ? 'rgba(140,200,80,0.14)' : 'rgba(20,80,30,0.16)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      for (let i = 0; i < 9000; i++) { const k = hash(i * 3 + 2), x = hash(i * 3) * w, y = hash(i * 3 + 1) * h; g.fillStyle = k < 0.35 ? 'rgba(25,80,28,0.35)' : k < 0.75 ? 'rgba(175,225,105,0.3)' : 'rgba(15,60,20,0.3)'; g.fillRect(x, y, 1.4, 3 + k * 7); }
      for (let i = 0; i < 70; i++) { g.fillStyle = ['#fff6d6', '#ffd84a', '#e8e8ff', '#ff9ec0'][i % 4]; const x = hash(i * 17) * w, y = hash(i * 19) * h; g.beginPath(); g.arc(x, y, 1.6, 0, TAU); g.fill(); }
    }, { repeat: [400, 400], aniso: quality === 'low' ? 2 : 8 });
    if (grassMat.map) grassMat.map.dispose();
    grassMat.map = gt; grassMat.needsUpdate = true;
    const mkLane = (turned) => { const t = canvasTex(THREE, RIES.half * 2 * 12, RIES.len * 12, (g, w, h) => paintLane(g, w, h, v, turned), { aniso: quality === 'low' ? 4 : 12 }); t.flipY = false; return t; };   // canvas top = the far end
    if (lanes.bat) { lanes.bat.dispose(); lanes.field.dispose(); }
    lanes.bat = mkLane(false); lanes.field = mkLane(true);
    laneMat.map = lanes.turned ? lanes.field : lanes.bat; laneMat.needsUpdate = true;
    stage.scene.background = new THREE.Color(v.sky[0]);
    if (stage.scene.fog) stage.scene.fog.color.set(v.sky[1]);
    stage.invalidate();
  }
  W.sceneryReady = () => Promise.all(Object.values(W.scenery).map((s) => s.ready));

  // ---- static scenery: one merged mesh (firs, chalets, fences, hay, rocks) ----------------------------------------------------------
  const items = [];
  // a Swiss spruce: a tapering trunk, six drooping tiers (wide skirts, darker underside), slightly twisted
  const fir = (x, z, s, tone) => {
    const col = tone ? '#1f5a35' : tone === 0 ? '#1a4d2e' : '#2a6a3a';
    items.push({ geo: cyl(0.1 * s, 0.2 * s, 1.8 * s, 6), matrix: mat(x, 0.9 * s, z), color: '#4e3420' });
    for (let i = 0; i < 6; i++) {
      const r = 1.65 * s * (1 - i * 0.145), y = (1.1 + i * 1.02) * s;
      items.push({ geo: cone(r, 1.9 * s, 11), matrix: mat(x, y + 0.9 * s, z, 1, 1, 1, i * 0.7 + x), color: col, shade: 0.2 });
      items.push({ geo: cyl(r * 0.98, r * 0.4, 0.12 * s, 11), matrix: mat(x, y - 0.02 * s, z), color: '#123a22', shade: 0.1 });
    }
    items.push({ geo: cone(0.2 * s, 1.0 * s, 6), matrix: mat(x, (1.1 + 6 * 1.02) * s + 0.5 * s, z), color: col });
  };
  const broadleaf = (x, z, s) => {
    items.push({ geo: cyl(0.18 * s, 0.3 * s, 2.6 * s, 7), matrix: mat(x, 1.3 * s, z), color: '#5b4129' });
    for (const [dx, dy, dz, r] of [[0, 3.6, 0, 1.9], [1.1, 3.0, 0.4, 1.4], [-1.0, 3.2, -0.5, 1.5], [0.2, 4.5, 0.2, 1.3]]) items.push({ geo: sph(r * s, 9, 7), matrix: mat(x + dx * s, dy * s, z + dz * s, 1, 0.85, 1), color: '#4c9a3c', shade: 0.28 });
  };
  // a Bernese-style chalet: log walls, overhanging gable roof (stone-weighted), balcony, flower boxes, a woodpile, stone base
  const chalet = (x, z, s, ry = 0) => {
    const w = 7.4 * s, d = 5.8 * s, h = 3.3 * s;
    const R = (lx, ly, lz) => { const c = Math.cos(ry), sn = Math.sin(ry); return [x + lx * c + lz * sn, ly, z - lx * sn + lz * c]; };
    items.push({ geo: box(w + 0.3 * s, 0.7 * s, d + 0.3 * s), matrix: mat(x, 0.35 * s, z, 1, 1, 1, ry), color: '#8d8a82', shade: 0.15 });
    items.push({ geo: box(w, h, d), matrix: mat(x, 0.7 * s + h / 2, z, 1, 1, 1, ry), color: '#9d6a3a', shade: 0.18 });
    for (let i = 1; i < 7; i++) items.push({ geo: box(w + 0.1 * s, 0.07 * s, d + 0.1 * s), matrix: mat(x, 0.7 * s + i * h / 7, z, 1, 1, 1, ry), color: '#5a3a1e' });
    const rh = 2.5 * s, ovh = 1.35 * s;
    const slope = Math.atan2(rh, d / 2 + ovh);
    for (const sd of [-1, 1]) {
      const p = R(0, 0.7 * s + h + rh / 2 - 0.1 * s, sd * (d / 4 + ovh / 2 - 0.2 * s));
      items.push({ geo: box(w + 2.0 * s, 0.18 * s, Math.hypot(rh, d / 2 + ovh)), matrix: mat(p[0], p[1], p[2], 1, 1, 1, ry, sd * slope), color: '#5f3a26', shade: 0.15 });
    }
    items.push({ geo: box(w + 1.7 * s, 0.12 * s, 0.14 * s), matrix: mat(...R(0, 0.7 * s + h + rh, 0), 1, 1, 1, ry), color: '#3a2417' });
    for (const lx of [-0.27, 0.22]) {
      items.push({ geo: box(w * 0.15, h * 0.34, 0.12 * s), matrix: mat(...R(lx * w, 0.7 * s + h * 0.58, d / 2 + 0.03 * s), 1, 1, 1, ry), color: '#ffe5a0' });
      items.push({ geo: box(w * 0.18, 0.06 * s, 0.2 * s), matrix: mat(...R(lx * w, 0.7 * s + h * 0.38, d / 2 + 0.12 * s), 1, 1, 1, ry), color: '#4a2f1a' });
      items.push({ geo: box(w * 0.17, 0.18 * s, 0.18 * s), matrix: mat(...R(lx * w, 0.7 * s + h * 0.46, d / 2 + 0.13 * s), 1, 1, 1, ry), color: '#c93a4a', shade: 0.5 });   // geraniums
    }
    items.push({ geo: box(w * 0.78, 0.1 * s, 0.9 * s), matrix: mat(...R(0, 0.7 * s + h * 0.95, d / 2 + 0.45 * s), 1, 1, 1, ry), color: '#6b4524' });
    for (let i = 0; i < 6; i++) items.push({ geo: box(0.05 * s, 0.5 * s, 0.05 * s), matrix: mat(...R(-w * 0.36 + i * w * 0.144, 0.7 * s + h * 0.95 + 0.28 * s, d / 2 + 0.88 * s), 1, 1, 1, ry), color: '#6b4524' });
    items.push({ geo: box(2.2 * s, 1.3 * s, 0.9 * s), matrix: mat(...R(w / 2 + 0.2 * s, 1.3 * s, 0), 1, 1, 1, ry + Math.PI / 2), color: '#7d522c', shade: 0.4 });
  };
  const bush = (x, z, s) => items.push({ geo: sph(1.0 * s, 8, 6), matrix: mat(x, 0.5 * s, z, 1.4, 0.75, 1), color: '#3f8f3a', shade: 0.3 });
  const hayBale = (x, z, ry = 0) => items.push({ geo: cyl(0.55, 0.55, 0.9, 12), matrix: mat(x, 0.55, z, 1, 1, 1, ry, 0, Math.PI / 2), color: '#d8bb5e', shade: 0.2 });
  const SC = [];
  for (const sd of [-1, 1]) {
    for (let z = -26; z < 250; z += 9 + hash(z * 3 + sd) * 12) SC.push(() => { const a = hash(z * 7 + sd), x = sd * (RIES.half + 11 + a * 20), s = 1.1 + hash(z * 11 + sd) * 0.9; return hash(z * 13) > 0.2 ? fir(x, z, s, hash(z) > 0.5 ? 1 : 0) : broadleaf(x, z, s * 1.1); });
    for (let z = 10; z < 230; z += 55 + hash(z + sd) * 35) SC.push(() => chalet(sd * (RIES.half + 30 + hash(z) * 14), z + 10, 1.0 + hash(z * 2) * 0.5, -sd * 0.5 + (sd > 0 ? Math.PI : 0) * 0 + Math.PI / 2 * (sd > 0 ? 1 : -1) * 0));
    for (let z = 0; z < 200; z += 20 + hash(z * 5 + sd) * 12) SC.push(() => bush(sd * (RIES.half + 2.9 + hash(z) * 2), z, 0.8 + hash(z * 3) * 0.6));
  }
  for (const zb of [-34, -58, -92, -130]) for (let i = 0; i < 10; i++) SC.push(() => (hash(i * 13 + zb) > 0.72 ? chalet(-80 + i * 17 + hash(i * 3 + zb) * 8, zb - hash(i + zb) * 12, 1.5 + hash(i * 5 + zb), 0) : fir(-80 + i * 17 + hash(i * 3 + zb) * 12, zb - hash(i + zb) * 14, 1.5 + hash(i * 5 + zb), i % 2)));
  for (const zb of [226, 255, 290, 330]) for (let i = 0; i < 10; i++) SC.push(() => (hash(i * 17 + zb) > 0.72 ? chalet(-80 + i * 17 + hash(i * 3 + zb) * 8, zb + hash(i + zb) * 12, 1.5 + hash(i * 5 + zb), Math.PI) : fir(-80 + i * 17 + hash(i * 3 + zb) * 12, zb + hash(i + zb) * 14, 1.5 + hash(i * 5 + zb), i % 2)));
  for (const f of SC) f();
  // a rail fence along both side lines (posts + two rails), hay bales by the Bock
  for (const sd of [-1, 1]) {
    const x = sd * (RIES.half + 1.15);
    for (let z = 0; z <= RIES.len; z += 4) {
      items.push({ geo: cyl(0.05, 0.06, 1.05, 6), matrix: mat(x, 0.52, z), color: '#6a4a2a', shade: 0.2 });
      if (z < RIES.len) for (const y of [0.4, 0.8]) items.push({ geo: box(0.05, 0.07, 4.0), matrix: mat(x, y, z + 2), color: '#7b5a35', shade: 0.15 });
    }
  }
  hayBale(5.4, -3.2, 0.4); hayBale(6.3, -2.6, -0.2); hayBale(5.8, -3.1, 0.1);
  const statics = new THREE.Mesh(mergeColored(THREE, items), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
  statics.receiveShadow = quality !== 'low'; statics.castShadow = false; statics.frustumCulled = false; root.add(statics);

  // ---- the Bock: a wooden launch ramp with a puck seat -------------------------------------------------------------------------------
  const woodTex = canvasTex(THREE, 256, 256, (g, w, h) => {
    g.fillStyle = '#c99a58'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? 'rgba(120,70,20,0.16)' : 'rgba(255,230,170,0.14)'; g.fillRect(0, i * h / 6, w, h / 6); g.fillStyle = 'rgba(60,30,10,0.55)'; g.fillRect(0, i * h / 6, w, 2.5); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(70,40,15,${0.1 + hash(i + 4) * 0.14})`; g.fillRect(hash(i) * w, hash(i + 90) * h, 20 + hash(i + 7) * 60, 1); }
    g.fillStyle = 'rgba(40,24,10,0.6)'; for (let i = 0; i < 6; i++) for (const x of [14, w - 14]) { g.beginPath(); g.arc(x, i * h / 6 + h / 12, 2.2, 0, TAU); g.fill(); }   // nails
  }, { aniso: 8 });
  const woodMat = new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.72 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 0.5, metalness: 0.7 });
  const bock = new THREE.Group();
  const deck = new THREE.Mesh(box(0.95, 0.09, 1.5), woodMat); deck.rotation.x = -0.34; deck.position.set(0, 0.62, 0.05); deck.castShadow = true; deck.receiveShadow = true; bock.add(deck);
  for (const sx of [-0.42, 0.42]) {
    const rail = new THREE.Mesh(box(0.08, 0.12, 1.52), darkWood); rail.rotation.x = -0.34; rail.position.set(sx, 0.64, 0.05); rail.castShadow = true; bock.add(rail);
    const legF = new THREE.Mesh(box(0.08, 0.5, 0.08), darkWood); legF.position.set(sx, 0.25, -0.55); legF.castShadow = true; bock.add(legF);
    const legB = new THREE.Mesh(box(0.08, 0.9, 0.08), darkWood); legB.position.set(sx, 0.45, 0.62); legB.castShadow = true; bock.add(legB);
    for (const z of [-0.55, 0.62]) { const bolt = new THREE.Mesh(cyl(0.025, 0.025, 0.1, 8), iron); bolt.rotation.z = Math.PI / 2; bolt.position.set(sx + (sx > 0 ? 0.045 : -0.045), z > 0 ? 0.7 : 0.4, z); bock.add(bolt); }
  }
  const brace = new THREE.Mesh(box(0.9, 0.06, 0.06), darkWood); brace.position.set(0, 0.28, 0.0); bock.add(brace);
  const stop = new THREE.Mesh(box(0.7, 0.14, 0.05), darkWood); stop.rotation.x = -0.34; stop.position.set(0, 0.74, 0.62); stop.castShadow = true; bock.add(stop);
  const cradle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), iron); cradle.rotation.x = Math.PI / 2 - 0.34; cradle.position.set(0, 0.69, 0.22); bock.add(cradle);
  bock.position.set(0, 0, 0); root.add(bock);
  W.puckSeat = new THREE.Vector3(0, 0.7, 0.22);

  // ---- flags: the wind flag by the Bock and pennons along the Ries (cloth waves from the root, damped by wind) --------------------------
  const cloths = [];
  const makeFlag = (len, hgt, color, trim = '#fff1d6') => {
    const geo = new THREE.PlaneGeometry(len, hgt, 12, 3); geo.translate(len / 2, 0, 0);
    const tex = canvasTex(THREE, 128, 32, (g, w, h) => { g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = trim; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(hash(i) * w, 0, 1, h); } });
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, side: THREE.DoubleSide }));
    m.castShadow = false; const base = geo.attributes.position.array.slice();
    cloths.push({ m, geo, base, len, ph: hash(cloths.length * 7 + 3) * TAU });
    return m;
  };
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.55 });
  const flagPole = new THREE.Group();
  const pole = new THREE.Mesh(cyl(0.035, 0.05, 5.4, 8), poleMat); pole.position.y = 2.7; pole.castShadow = true; flagPole.add(pole);
  const topBall = new THREE.Mesh(sph(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9b24a, metalness: 0.6, roughness: 0.35 })); topBall.position.y = 5.45; flagPole.add(topBall);
  const mainFlag = makeFlag(1.7, 0.85, '#d93a2b'); mainFlag.position.set(0.02, 4.9, 0); flagPole.add(mainFlag);
  flagPole.position.set(-RIES.half - 1.8, 0, 9); root.add(flagPole);
  W.flagMesh = mainFlag;
  const pennons = [];
  for (const sd of [-1, 1]) for (const z of [30, 70, 110, 150, 190]) {
    const g = new THREE.Group(), p = new THREE.Mesh(cyl(0.03, 0.045, 4.4, 6), poleMat); p.position.y = 2.2; g.add(p);
    const f = makeFlag(1.0, 0.5, (z / 40) % 2 < 1 ? '#d93a2b' : '#2c6fb5'); f.position.set(0.02, 4.0, 0); g.add(f);
    g.position.set(sd * (RIES.half + 1.9), 0, z); root.add(g); pennons.push({ g, f });
  }
  W.updateFlag = (wind, t, calm) => {
    const sgn = wind >= 0 ? 1 : -1, str = Math.min(1.6, Math.abs(wind)) / 1.6;
    for (const c of cloths) {
      const main = c.m === mainFlag, k = (main ? 1 : 0.7) * (0.3 + str * 0.8);
      c.m.scale.x = sgn; c.m.rotation.z = -0.9 * (1 - Math.min(1, str * 1.2)) * 0.9;
      const p = c.geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const u = c.base[i] / c.len, ph = calm ? 0 : t * (6 + str * 5) - u * (6 + str * 2) + c.ph;
        p[i + 2] = Math.sin(ph) * 0.2 * u * k + Math.sin(ph * 2.1 + 1) * 0.04 * u;
        p[i + 1] = c.base[i + 1] - u * u * 0.18 * (1 - Math.min(1, str)) - Math.abs(Math.sin(ph)) * 0.02 * u;
      }
      c.geo.attributes.position.needsUpdate = true;
    }
    for (const q of pennons) q.f.scale.x = sgn;
  };

  // ---- distance signs at the side line (1 / 2 / 3 points) ------------------------------------------------------------------------------
  for (const [z, label, col] of [[MIN_SCORING, '1', '#e9d75c'], [105, '2', '#f0b429'], [135, '3', '#e0801c']]) {
    const t = canvasTex(THREE, 128, 128, (g, w, h) => { g.fillStyle = col; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#2b2118'; g.font = '800 92px "Barlow", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, h / 2 + 6); }, { aniso: 4 });
    for (const sd of [-1, 1]) {
      const p = new THREE.Group();
      const post = new THREE.Mesh(cyl(0.04, 0.05, 2.2, 6), darkWood); post.position.y = 1.1; p.add(post);
      const pl = new THREE.Mesh(box(1.1, 1.1, 0.06), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 })); pl.position.y = 2.25; p.add(pl);
      p.position.set(sd * (RIES.half + 1.6), 0, z); root.add(p);
    }
  }

  // ---- cowbells: a rack of big brass Treichel bells by the fans' bench (they swing with the cheering), and bells on the grazing cows --------
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9983a, roughness: 0.32, metalness: 0.85 });
  const bellGeo = (() => { const pts = [[0.0, 0.0], [0.09, 0.0], [0.12, 0.05], [0.16, 0.2], [0.2, 0.34], [0.205, 0.36], [0.17, 0.36], [0.12, 0.3], [0.08, 0.1], [0.0, 0.02]].map(([x, y]) => new THREE.Vector2(x, y)); const g = new THREE.LatheGeometry(pts, 14); g.translate(0, -0.36, 0); return g; })();
  const bells = [];
  { const rack = new THREE.Group();
    const bar = new THREE.Mesh(cyl(0.05, 0.05, 3.2, 8), darkWood); bar.rotation.z = Math.PI / 2; bar.position.y = 2.6; rack.add(bar);
    for (const x of [-1.5, 1.5]) { const leg = new THREE.Mesh(cyl(0.05, 0.07, 2.6, 8), darkWood); leg.position.set(x, 1.3, 0); leg.castShadow = true; rack.add(leg); }
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group(); piv.position.set(-1.25 + i * 0.5, 2.6, 0);
      const strap = new THREE.Mesh(cyl(0.02, 0.02, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0x3a2417 })); strap.position.y = -0.1; piv.add(strap);
      const b = new THREE.Mesh(bellGeo, brass); b.position.y = -0.2; b.scale.setScalar(0.9 + (i % 3) * 0.28); b.castShadow = true; piv.add(b);
      rack.add(piv); bells.push({ piv, ph: i * 1.3, amp: 0.6 + (i % 3) * 0.2 });
    }
    rack.position.set(-RIES.half - 4.4, 0, 3.5); rack.rotation.y = Math.PI / 2; root.add(rack);
  }
  // cows: sturdy body (capsule), head with horns, legs, udder, tail, a collar bell
  const COW = [[-38, 40, 0.4], [-31, 62, 2.2], [36, 98, 1], [42, 150, 3], [-44, 128, 5], [30, 20, 2]];
  const cowItems = [];
  for (const [x, z, r] of COW) {
    const c = Math.cos(r), s = Math.sin(r), at = (lx, lz) => [x + c * lx + s * lz, z - s * lx + c * lz];
    cowItems.push({ geo: new THREE.CapsuleGeometry(0.46, 1.1, 4, 10), matrix: mat(x, 1.12, z, 1, 1, 1, r, 0, Math.PI / 2), color: '#f1ede2', shade: 0.06 });
    cowItems.push({ geo: sph(0.3, 8, 6), matrix: mat(...[at(-0.2, 0.12)[0], 1.3, at(-0.2, 0.12)[1]], 1.5, 1, 1.3, r), color: '#2a2420' });
    cowItems.push({ geo: sph(0.26, 8, 6), matrix: mat(...[at(0.55, -0.3)[0], 1.0, at(0.55, -0.3)[1]], 1.2, 1, 1, r), color: '#2a2420' });
    cowItems.push({ geo: box(0.55, 0.42, 0.4), matrix: mat(at(1.2, 0)[0], 1.2, at(1.2, 0)[1], 1, 1, 1, r, 0, -0.35), color: '#f1ede2' });
    cowItems.push({ geo: box(0.2, 0.17, 0.3), matrix: mat(at(1.42, 0)[0], 1.05, at(1.42, 0)[1], 1, 1, 1, r), color: '#e9b4a4' });
    for (const hz of [-0.14, 0.14]) cowItems.push({ geo: cone(0.04, 0.18, 5), matrix: mat(at(1.2, hz * 1.5)[0], 1.5, at(1.2, hz * 1.5)[1], 1, 1, 1, r, 0, hz > 0 ? -0.6 : 0.6), color: '#e9dcb8' });
    for (const [lx, lz] of [[-0.62, -0.24], [-0.62, 0.24], [0.62, -0.24], [0.62, 0.24]]) cowItems.push({ geo: cyl(0.075, 0.06, 0.78, 6), matrix: mat(at(lx, lz)[0], 0.4, at(lx, lz)[1]), color: '#4a3a30' });
    cowItems.push({ geo: sph(0.17, 6, 5), matrix: mat(at(-0.55, 0)[0], 0.6, at(-0.55, 0)[1], 1, 0.8, 1, r), color: '#e9b4a4' });
    cowItems.push({ geo: cyl(0.02, 0.025, 0.8, 4), matrix: mat(at(-1.12, 0)[0], 1.0, at(-1.12, 0)[1], 1, 1, 1, r, 0, 0.12), color: '#2a2420' });
  }
  const cows = new THREE.Mesh(mergeColored(THREE, cowItems), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); cows.castShadow = true; root.add(cows);
  const cowBells = new THREE.InstancedMesh(bellGeo, brass, COW.length); cowBells.frustumCulled = false; root.add(cowBells);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  W.updateBells = (t, cheer, calm) => {
    bells.forEach((b, i) => { b.piv.rotation.z = calm ? 0 : Math.sin(t * (3.1 + i * 0.37) + b.ph) * b.amp * (0.12 + cheer * 0.9) * Math.exp(-0.0 * t); b.piv.rotation.x = calm ? 0 : Math.cos(t * (2.3 + i * 0.2) + b.ph) * 0.05 * cheer; });
    COW.forEach(([x, z, r], i) => {
      const nod = calm ? 0 : Math.sin(t * 0.9 + i * 1.7) * 0.25 * (0.5 + 0.5 * Math.sin(t * 0.21 + i));
      const c = Math.cos(r), s = Math.sin(r);
      _m.compose(_p.set(x + c * 0.78 + s * 0.0, 0.92, z - s * 0.78 + c * 0), _q.setFromEuler(_e.set(0, r, nod * 0.5)), _s.setScalar(0.7)); cowBells.setMatrixAt(i, _m);
    });
    cowBells.instanceMatrix.needsUpdate = true;
  };

  // ---- the Bock-side crowd layout (consumed by the presenter's crowd3d) ------------------------------------------------------------------
  W.crowdRows = [];
  for (const sd of [-1, 1]) for (const [dx, back] of [[3.0, 0], [4.2, 1]]) {
    W.crowdRows.push({ from: [sd * (RIES.half + dx), 0, 4], to: [sd * (RIES.half + dx), 0, 190], count: back ? 26 : 34, face: [sd * (RIES.half - 1), 0, 0] });
  }
  W.updateScenery = (dt, camera) => { const sc = W.scenery[paintedFor]; if (sc && sc.loaded) sc.update(dt, camera); };
  W.bock = bock; W.setVenue = setVenue; W.mat = mat;
  setVenue(venue);
  return W;
}
