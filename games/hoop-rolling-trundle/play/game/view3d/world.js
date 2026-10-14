// The village lane as a real 3D world, drawn behind the kit canvas. It reproduces the 2D road camera exactly (same pinhole, same bending tables),
// so the HUD's projected marks (gate numbers, the gold line, name chips) land on the 3D road. Everything here is placed from road coordinates
// (z metres ahead of the hoop, e sideways) via art.roadPoint, so nothing in this file can change the race.
//   ground, grass, water, kerbs, road surface (dirt / cobble / mud / planks), cottages, hedgerows, trees, gas lamps, stalls,
//   gates with bunting, the finish arch, puddles with ripples, photographic sky + far hills (scenery3d), onlookers in period dress (crowd3d).
import { roadPoint, CAM_DIST, ZS } from '../src/art.js';
import { zoneAt, halfWidthAt, heightAt } from '../src/courses.js';
import { tex, kerbTex, bannerTex, skyTex, lcg } from './tex.js';
import { createPropKit } from './props.js';
import { Particles } from './fx.js';

const KERB = 0.45;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// per theme: photographic backdrop, sky, time of day, light colours, people mix
const LOOK3D = {
  village: { sky: 'sky-day', bd: 'bd-meadow-day', band: 'band-birch', far: 'band-hills-green', tod: 'day', key: 0xfff0d6, keyI: 2.3, hemi: 0xdff0ff, hemiG: 0x6a7a44, hemiI: 1.0, fog: 0xdbe9ef, expo: 1.0 },
  market: { sky: 'sky-clear', bd: 'bd-nordic-village', band: 'band-birch', tod: 'day', key: 0xfff3dc, keyI: 2.3, hemi: 0xe8f1ff, hemiG: 0x7a6e56, hemiI: 1.0, fog: 0xe6eaee, expo: 1.0 },
  canal: { sky: 'sky-day', bd: 'bd-canal', band: 'band-hills-green', tod: 'day', key: 0xfff0d6, keyI: 2.2, hemi: 0xdff0ff, hemiG: 0x5e7a48, hemiI: 1.0, fog: 0xd8e8ee, expo: 1.0 },
  terrace: { sky: 'sky-day', bd: 'bd-alpine-day', band: 'band-hills-green', tod: 'day', key: 0xfff0d0, keyI: 2.4, hemi: 0xdff0ff, hemiG: 0x687a44, hemiI: 1.0, fog: 0xdfecf2, expo: 1.0 },
  harbour: { sky: 'sky-clear', bd: 'bd-beach', band: 'band-hills-green', tod: 'day', key: 0xfff4e0, keyI: 2.4, hemi: 0xe4f0ff, hemiG: 0x8a8470, hemiI: 1.0, fog: 0xe3edf2, expo: 1.0 },
  rain: { sky: 'sky-overcast', bd: 'bd-forest', band: 'band-hills-green', tod: 'day', key: 0xdfe8f0, keyI: 1.5, hemi: 0xcfd8e0, hemiG: 0x5a6a50, hemiI: 1.2, fog: 0xc6d0d6, expo: 0.95 },
  hills: { sky: 'sky-day', bd: 'bd-alpine-day', band: 'band-hills-green', tod: 'day', key: 0xfff0d0, keyI: 2.4, hemi: 0xdbeaff, hemiG: 0x6a7a48, hemiI: 1.0, fog: 0xdbe8f2, expo: 1.0 },
  festival: { sky: 'sky-peach', bd: 'bd-dusk-meadow', band: 'band-birch', tod: 'dusk', key: 0xffc58a, keyI: 2.1, hemi: 0xffd7b8, hemiG: 0x5a5a48, hemiI: 0.95, fog: 0xf0c9a8, expo: 1.0 },
};

export function createWorld({ THREE, stage, V3, quality, cultures = ['european_village'] }) {
  const scene = stage.scene;
  const kit = createPropKit(THREE);
  const root = new THREE.Group(); root.name = 'lane'; scene.add(root);
  const fx = new Particles(THREE, scene, quality === 'low' ? 160 : 320);
  const W = { root, fx, ready: false, course: null, theme: null, scenery: null, crowd: null, camH: 4.5 };
  const T = (n) => tex(THREE, n);

  // ---- ribbons: one quad per ZS row, 4 vertices each (so a row can be collapsed independently) -----------------------------------------
  const Z = [-9.5, -7, -5, ...ZS.filter((z) => z > -4.5), 110, 140, 190, 260];
  const NQ = Z.length - 1;
  function ribbon(material, { cast = false, receive = true } = {}) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(NQ * 12), nor = new Float32Array(NQ * 12), uv = new Float32Array(NQ * 8), idx = new Uint16Array(NQ * 6);
    for (let i = 0; i < NQ; i++) { const v = i * 4; idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6); for (let k = 0; k < 4; k++) nor[(v + k) * 3 + 1] = 1; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.Mesh(g, material); m.frustumCulled = false; m.receiveShadow = receive; m.castShadow = cast; root.add(m);
    return { m, pos, uv, g };
  }
  const setQuad = (r, i, a, b, c, d, u0, u1, v0, v1) => {
    const o = i * 12, p = r.pos;
    p[o] = a.x; p[o + 1] = a.y; p[o + 2] = a.z; p[o + 3] = b.x; p[o + 4] = b.y; p[o + 5] = b.z; p[o + 6] = c.x; p[o + 7] = c.y; p[o + 8] = c.z; p[o + 9] = d.x; p[o + 10] = d.y; p[o + 11] = d.z;
    const q = i * 8, t = r.uv;
    t[q] = u0; t[q + 1] = v0; t[q + 2] = u1; t[q + 3] = v0; t[q + 4] = u1; t[q + 5] = v1; t[q + 6] = u0; t[q + 7] = v1;
  };
  const collapse = (r, i) => { const o = i * 12, p = r.pos; for (let k = 3; k < 12; k++) p[o + k] = p[o + (k % 3)]; };
  const mats = {
    road: { dirt: new THREE.MeshLambertMaterial({ map: T('dirt') }), cobble: new THREE.MeshLambertMaterial({ map: T('cobble') }), mud: new THREE.MeshStandardMaterial({ map: T('mud'), roughness: 0.55, metalness: 0 }), plank: new THREE.MeshLambertMaterial({ map: T('plank') }) },
    grass: new THREE.MeshLambertMaterial({ map: T('grass') }),
    water: new THREE.MeshStandardMaterial({ map: T('water'), roughness: 0.08, metalness: 0.05, color: 0x6fb8d0, transparent: true, opacity: 0.93 }),
    bank: new THREE.MeshLambertMaterial({ map: T('cobble'), color: 0x9c9080, side: THREE.DoubleSide }),
    kerb: new THREE.MeshLambertMaterial({ map: T('cobble') }),
  };
  const R = {};
  for (const k of ['dirt', 'cobble', 'mud', 'plank']) R[k] = ribbon(mats.road[k]);
  R.grassL = ribbon(mats.grass); R.grassR = ribbon(mats.grass);
  R.waterL = ribbon(mats.water, { receive: false }); R.waterR = ribbon(mats.water, { receive: false });
  R.kerbL = ribbon(mats.kerb); R.kerbR = ribbon(mats.kerb);
  R.bankL = ribbon(mats.bank); R.bankR = ribbon(mats.bank);

  // ---- props ------------------------------------------------------------------------------------------------------------------------------
  const props = new Map();       // id -> { obj, kind, size }
  const gates = new Map();       // gate index -> { grp, pen, ... }
  const puddles = [];
  let finishObj = null, startObj = null;
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

  function setTheme(C) {
    const id = C.themeId, L = { far: 'band-hills-green', ...(LOOK3D[id] || LOOK3D.village) };
    if (W.course && W.course.id === C.id) return;
    W.course = C; W.theme = L;
    // lighting and atmosphere
    stage.setLighting('day', { exposure: L.expo, hemi: L.hemiI, hemiSky: L.hemi, hemiGround: L.hemiG, key: L.key, keyI: L.keyI, rim: 0xcfe0ff, rimI: 0.5, sky: L.fog, fog: L.fog });
    scene.background = skyTex(THREE, C.theme.sky);
    scene.fog = new THREE.Fog(L.fog, 40, 190);
    mats.grass.color.set(C.theme.ground);
    mats.road.dirt.color.set(C.theme.road); mats.road.dirt.color.lerp(new THREE.Color(0xe8dcc4), 0.5); mats.road.cobble.color.set(0xd8d0c4); mats.road.mud.color.set(0xb09070); mats.road.plank.color.set(0xe8d0a8);
    mats.kerb.map = kerbTex(THREE, C.theme.kerb[0], C.theme.kerb[1]); mats.kerb.needsUpdate = true;
    if (C.theme.water) mats.water.color.set(C.theme.water);
    for (const [, e] of props) root.remove(e.obj); props.clear();
    for (const [, g] of gates) root.remove(g.grp); gates.clear();
    for (const p of puddles) root.remove(p.mesh); puddles.length = 0;
    if (finishObj) { root.remove(finishObj.grp); finishObj = null; }
    if (startObj) { root.remove(startObj); startObj = null; }
    buildPuddles(C); buildSpectators(C); buildScenery(C, L); buildClouds(C);
  }

  function buildClouds(C) {
    if (W.clouds) { for (const c of W.clouds) root.remove(c); }
    W.clouds = [];
    const rnd = lcg(C.seed + 77), rain = C.themeId === 'rain', dusk = C.themeId === 'festival';
    const mt = new THREE.MeshBasicMaterial({ map: T('puff'), transparent: true, depthWrite: false, fog: false, color: rain ? 0xaab4bc : dusk ? 0xffd8c0 : 0xffffff, opacity: rain ? 0.85 : 0.75 });
    const n = rain ? 16 : 9;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mt);
      const w = 60 + rnd() * 70;
      m.scale.set(w, w * (0.28 + rnd() * 0.12), 1);
      m.position.set(-260 + rnd() * 520, 40 + rnd() * 70, -(180 + rnd() * 120));
      m.userData.v = 1.2 + rnd() * 1.6; m.renderOrder = -5;
      root.add(m); W.clouds.push(m);
    }
  }

  const sceneryCache = new Map();
  function buildScenery(C, L) {
    // Scenery textures are cached and shared by the kit, so a built set is hidden, never disposed, when the theme changes.
    if (W.scenery) W.scenery.group.visible = false;
    const key = C.themeId;
    let sc = sceneryCache.get(key);
    if (!sc) {
      try {
        const layers = [
          { t: 'band', id: L.far, r: 120, h: 34, arc: [-178, -2] },
          { t: 'band', id: L.band, r: 80, h: 11, arc: [-165, -15] },
        ];
        sc = V3.buildScenery({ layers, timeOfDay: L.tod, quality: quality === 'low' ? 'low' : 'medium', radius: 150, clouds: 0.4, wind: 0.5 });
        scene.add(sc.group); sceneryCache.set(key, sc);
        sc.ready.then(() => stage.invalidate()).catch(() => {});
      } catch (e) { console.warn('scenery unavailable', e); sc = null; }
    }
    if (sc) sc.group.visible = true;
    W.scenery = sc;
  }

  // ---- spectators: onlookers in period dress along the lane, fixed at road distances, re-placed every frame ------------------------------
  function buildSpectators(C) {
    if (W.crowd) { try { W.crowd.dispose(); } catch { /* ignore */ } W.crowd = null; }
    const rnd = lcg(C.seed * 31 + 5);
    const slots = [];
    const cap = quality === 'low' ? 36 : quality === 'medium' ? 70 : 110;
    for (let s = 6; s < C.length + 14 && slots.length < cap * 1.6; s += 7 + rnd() * 6) {
      for (const sg of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const n = 2 + Math.floor(rnd() * 4), big = s > C.length - 6 || s < 14;
        for (let k = 0; k < (big ? n + 4 : n); k++) {
          const hw = halfWidthAt(C, s);
          slots.push({ s: s + (rnd() - 0.5) * 2.4, off: KERB + 0.55 + rnd() * 1.0 + (big && k > 3 ? 0.9 : 0), sg, base: hw });
        }
      }
    }
    while (slots.length > cap) slots.splice(Math.floor(rnd() * slots.length), 1);
    W.slots = slots;
    try {
      const pts = slots.map((q) => ({ x: 0, y: -50, z: 0, yaw: 0 }));
      W.crowd = V3.createCrowd3d(stage, { points: pts, count: pts.length, seed: C.seed + 3, culture: cultures, quality: quality === 'low' ? 'low' : quality, cold: false, props: { flag: 0.0, phone: 0, child: 0.18 }, excitement: 0.25, viewportHeight: 800, blobShadows: true });
    } catch (e) { console.warn('crowd3d unavailable', e); W.crowd = null; }
  }

  function buildPuddles(C) {
    for (const p of C.puddles) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 28), new THREE.MeshStandardMaterial({ color: 0x78b4d4, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.88 }));
      m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; root.add(m);
      const rip = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.renderOrder = 3; m.add(r); return r; });
      puddles.push({ p, mesh: m, rip, t: 0 });
    }
  }

  function gateObj(i, g, C) {
    const grp = new THREE.Group();
    const L = C.theme.kerb;
    const post = (x) => {
      const kt = kerbTex(THREE, '#fff6e2', L[1]).clone(); kt.needsUpdate = true; kt.repeat.set(1, 3);
      const mm = new THREE.MeshLambertMaterial({ map: kt });
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 2.3, 10), mm); c.position.set(x, 1.15, 0); c.castShadow = true; grp.add(c);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf2c24a, metalness: 0.6, roughness: 0.3 })); b.position.set(x, 2.35, 0); grp.add(b);
      return b;
    };
    const lb = post(-g.w / 2), rb = post(g.w / 2);
    // bunting: a string of pennants (triangles) with a little sag, flutter animated each frame
    const n = 9;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 9), 3));
    const pen = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true })); pen.frustumCulled = false; grp.add(pen);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), new THREE.MeshBasicMaterial({ color: 0x3a2a18 })); str.frustumCulled = false; grp.add(str);
    // sagging string approximated by 6 segments
    const segs = [];
    for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 4), new THREE.MeshBasicMaterial({ color: 0x3a2a18 })); grp.add(s); segs.push(s); }
    str.visible = false;
    root.add(grp);
    return { grp, pen, n, segs, w: g.w, i, lb, rb };
  }

  const PEN_COL = { next: [0xe8472f, 0xffd35a, 0x27b59a, 0xfff6e2], ahead: [0xe8472f, 0xffd35a, 0x27b59a, 0xfff6e2], perfect: [0xffd35a, 0xfff0b0], good: [0x8ff0d6, 0xfff6e2, 0xffd35a], miss: [0x8a7a78, 0xa09290] };
  const col = new THREE.Color();

  function updateGate(o, t, state) {
    const n = o.n, pos = o.pen.geometry.attributes.position.array, cc = o.pen.geometry.attributes.color.array;
    const w = o.w, h = 2.25, sag = 0.28;
    const cols = PEN_COL[state] || PEN_COL.ahead;
    const pt = (f) => ({ x: -w / 2 + w * f, y: h - Math.sin(f * Math.PI) * sag });
    for (let k = 0; k < n; k++) {
      const f0 = k / n + 0.02, f1 = (k + 1) / n - 0.02, fm = (f0 + f1) / 2;
      const a = pt(f0), b = pt(f1), c0 = pt(fm), fl = Math.sin(t * 3.4 + k * 1.3 + o.i) * 0.07, fz = Math.cos(t * 2.7 + k) * 0.05;
      pos.set([a.x, a.y, 0, b.x, b.y, 0, c0.x + fl, c0.y - 0.42, fz], k * 9);
      col.setHex(cols[k % cols.length]); for (let q = 0; q < 3; q++) { cc[k * 9 + q * 3] = col.r; cc[k * 9 + q * 3 + 1] = col.g; cc[k * 9 + q * 3 + 2] = col.b; }
    }
    o.pen.geometry.attributes.position.needsUpdate = true; o.pen.geometry.attributes.color.needsUpdate = true;
    for (let k = 0; k < o.segs.length; k++) {
      const a = pt(k / o.segs.length), b = pt((k + 1) / o.segs.length), s = o.segs[k];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
      s.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0); s.scale.set(1, len, 1); s.rotation.z = Math.atan2(dx, dy) * -1;
    }
  }

  function buildFinish(C) {
    const grp = new THREE.Group();
    const hw = halfWidthAt(C, C.length) + 0.4;
    const postM = new THREE.MeshLambertMaterial({ color: 0xf4ead6 });
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.8, 0.28), postM); p.position.set(sx * hw, 1.9, 0); p.castShadow = true; grp.add(p);
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), new THREE.MeshLambertMaterial({ color: 0xd83a3a })); band.position.set(sx * hw, 1.9, 0); grp.add(band);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2c24a, metalness: 0.6, roughness: 0.3 })); cap.position.set(sx * hw, 3.95, 0); grp.add(cap);
    }
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.9), new THREE.MeshBasicMaterial({ map: bannerTex(THREE, 'FINISH'), side: THREE.DoubleSide }));
    ban.position.set(0, 3.5, 0); grp.add(ban);
    const rows = 2, cols2 = 14, cw = (hw * 2) / cols2;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols2; c++) {
      const q = new THREE.Mesh(new THREE.PlaneGeometry(cw, 0.45), new THREE.MeshLambertMaterial({ color: (r + c) % 2 ? 0x161616 : 0xffffff }));
      q.rotation.x = -Math.PI / 2; q.position.set(-hw + (c + 0.5) * cw, 0.02, -0.225 - r * 0.45 + 0.45); grp.add(q);
    }
    const flags = [];
    for (let k = 0; k < 8; k++) {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.4), new THREE.MeshBasicMaterial({ color: [0x27b59a, 0xffd35a, 0xe8472f, 0xfff6e2][k % 4], side: THREE.DoubleSide }));
      f.position.set(-hw + (k + 0.5) * (hw * 2 / 8), 3.0, 0); grp.add(f); flags.push(f);
    }
    root.add(grp);
    return { grp, flags, hw };
  }

  function buildStart(C) {
    const hw = halfWidthAt(C, 0) + 0.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.22), new THREE.MeshLambertMaterial({ color: 0xfffaf0 }));
    m.rotation.x = -Math.PI / 2; root.add(m);
    return m;
  }

  // ---- per frame ------------------------------------------------------------------------------------------------------------------------
  const wp = (cam, z, e) => { const p = roadPoint(cam, z, e); return { x: p.X, y: p.Y - cam.camH, z: -(p.Z + CAM_DIST), h: p.h }; };
  W.wp = wp;
  // is the ground at (s, sideways e) water? (the canal / harbour side, or both sides on a plank bridge)
  const overWater = (C, s, e) => {
    const th = C.theme; if (!th.water) return false;
    const z = zoneAt(C, s), plank = z && z.kind === 'plank';
    return !!(plank || (th.waterSide === 'left' && e < 0));
  };

  W.update = function update(F, dt, t) {
    const cam = F.cam, C = cam.C, me = F.me;
    setTheme(C);
    W.camH = cam.camH;
    const s0 = cam.sMe, th = C.theme;
    // ---- road, kerbs, ground, water
    const water = th.water;
    for (let i = 0; i < NQ; i++) {
      const z0 = Z[i], z1 = Z[i + 1], sm = s0 + (z0 + z1) / 2;
      const zone = zoneAt(C, sm), plank = zone && zone.kind === 'plank';
      const hw0 = halfWidthAt(C, s0 + z0), hw1 = halfWidthAt(C, s0 + z1);
      const kind = plank ? 'plank' : zone && zone.kind === 'mud' ? 'mud' : zone && zone.kind === 'cobble' ? 'cobble' : 'dirt';
      const wl = water && (plank || th.waterSide === 'left'), wr = water && plank;
      const P = (z, e, dy = 0) => { const q = wp(cam, z, e); q.y += dy; return q; };
      const v0 = (s0 + z0) / TILEV, v1 = (s0 + z1) / TILEV;
      // road
      for (const k of ['dirt', 'cobble', 'mud', 'plank']) {
        if (k !== kind) { collapse(R[k], i); continue; }
        const a = P(z0, -hw0), b = P(z0, hw0), c = P(z1, hw1), d = P(z1, -hw1);
        setQuad(R[k], i, a, b, c, d, -hw0 / TILE2, hw0 / TILE2, v0 * (TILEV / TILE2), v1 * (TILEV / TILE2));
      }
      // kerbs (raised a little) unless over water
      for (const sg of [-1, 1]) {
        const r = sg < 0 ? R.kerbL : R.kerbR;
        const a = P(z0, sg * hw0, 0.07), b = P(z0, sg * (hw0 + KERB), 0.07), c = P(z1, sg * (hw1 + KERB), 0.07), d = P(z1, sg * hw1, 0.07);
        if (plank) { collapse(r, i); } else setQuad(r, i, sg < 0 ? b : a, sg < 0 ? a : b, sg < 0 ? d : c, sg < 0 ? c : d, 0, 1, (s0 + z0) / 4, (s0 + z1) / 4);
      }
      // grass / water on each side
      const FAR = 70;
      for (const sg of [-1, 1]) {
        const rg = sg < 0 ? R.grassL : R.grassR, rw = sg < 0 ? R.waterL : R.waterR, rb = sg < 0 ? R.bankL : R.bankR, isW = sg < 0 ? wl : wr;
        const e0a = sg * (hw0 + KERB), e0b = sg * (hw0 + KERB + FAR), e1a = sg * (hw1 + KERB), e1b = sg * (hw1 + KERB + FAR);
        if (isW) {
          collapse(rg, i);
          const dy = -0.32;
          const a = P(z0, e0a, dy), b = P(z0, e0b, dy), c = P(z1, e1b, dy), d = P(z1, e1a, dy);
          const sc = 3.2;
          setQuad(rw, i, sg < 0 ? b : a, sg < 0 ? a : b, sg < 0 ? d : c, sg < 0 ? c : d, (e0a * 0 + (sg < 0 ? 0 : 0)) + t * 0.02, (FAR / sc) + t * 0.02, (s0 + z0) / sc, (s0 + z1) / sc);
          // vertical bank face along the kerb edge
          const ta = P(z0, e0a, 0), tb = P(z1, e1a, 0), ba = P(z0, e0a, dy), bb = P(z1, e1a, dy);
          const o = i * 12, p = rb.pos;
          p.set([ta.x, ta.y, ta.z, tb.x, tb.y, tb.z, bb.x, bb.y, bb.z, ba.x, ba.y, ba.z], o);
          const q = i * 8; rb.uv.set([0, 0, 1, 0, 1, 1, 0, 1], q);
          // normals of the bank face stay up (cheap): fine for a low wall
        } else {
          collapse(rw, i); collapse(rb, i);
          const a = P(z0, e0a), b = P(z0, e0b), c = P(z1, e1b), d = P(z1, e1a);
          setQuad(rg, i, sg < 0 ? b : a, sg < 0 ? a : b, sg < 0 ? d : c, sg < 0 ? c : d, e0a / GR, e0b / GR, (s0 + z0) / GR, (s0 + z1) / GR);
        }
      }
    }
    for (const k in R) { const g = R[k].g; g.attributes.position.needsUpdate = true; g.attributes.uv.needsUpdate = true; }
    // ---- scenery follows the camera
    if (W.scenery) { W.scenery.group.position.y = -cam.camH; W.scenery.update(dt, stage.camera); }
    if (W.clouds) { for (const cl of W.clouds) { cl.position.x += cl.userData.v * dt; if (cl.position.x > 260) cl.position.x = -260; } }

    // ---- props
    const live = new Set();
    for (const it of F.items.props) {
      const id = it.seed;
      live.add(id);
      let e = props.get(id);
      if (!e) {
        const obj = kit.build(it.kind, it.seed);
        obj.userData.kind = it.kind; obj.userData.sway = obj.userData.sway || 0;
        root.add(obj); e = { obj, kind: it.kind, size: obj.userData.size }; props.set(id, e);
      }
      let ee = it.e;
      if (e.size) { const sg = Math.sign(ee) || 1; ee = sg * (Math.abs(halfWidthAt(C, s0 + it.z)) + KERB + 1.9 + e.size.d / 2 + 1.25 + (Math.abs(it.e) - (Math.abs(halfWidthAt(C, s0 + it.z)) + KERB + 1.2)) * 0.5); }
      const q = wp(cam, it.z, ee);
      e.obj.position.set(q.x, q.y, q.z);
      const face = (ee < 0 ? Math.PI / 2 : -Math.PI / 2) - q.h;
      e.obj.rotation.y = face + (e.size ? 0 : (it.seed % 7) * 0.4);
      const sw = e.obj.userData.sway;
      if (sw) { e.obj.rotation.z = Math.sin(t * 1.1 + it.seed) * sw; }
      e.obj.visible = it.z > -6 && it.z < 92 && (it.kind === 'reed' || !overWater(C, s0 + it.z, ee));
    }
    for (const [id, e] of props) if (!live.has(id)) { root.remove(e.obj); props.delete(id); }

    // ---- gates
    const used = new Set();
    for (const g of F.items.gates) {
      let o = gates.get(g.i);
      if (!o) { o = gateObj(g.i, g.g, C); gates.set(g.i, o); }
      used.add(g.i);
      const q = wp(cam, g.g.s - s0, g.g.d);
      o.grp.position.set(q.x, q.y, q.z); o.grp.rotation.y = Math.PI - q.h; o.grp.visible = true;
      updateGate(o, t, g.state);
    }
    for (const [i, o] of gates) { if (!used.has(i)) { root.remove(o.grp); gates.delete(i); } }

    // ---- finish and start
    if (F.items.finish !== null) {
      if (!finishObj) finishObj = buildFinish(C);
      const q = wp(cam, F.items.finish, 0);
      finishObj.grp.position.set(q.x, q.y, q.z); finishObj.grp.rotation.y = Math.PI - q.h; finishObj.grp.visible = true;
      finishObj.flags.forEach((f, k) => { f.rotation.y = Math.sin(t * 3 + k) * 0.5; f.position.y = 3.0 + Math.sin(t * 2.2 + k) * 0.03; });
    } else if (finishObj) finishObj.grp.visible = false;
    if (F.items.start !== null) {
      if (!startObj) startObj = buildStart(C);
      const q = wp(cam, F.items.start, 0);
      startObj.position.set(q.x, q.y + 0.025, q.z); startObj.rotation.set(-Math.PI / 2, 0, 0); startObj.rotation.z = q.h; startObj.visible = true;
    } else if (startObj) startObj.visible = false;

    // ---- puddles
    for (const pu of puddles) {
      const p = pu.p, z = p.s - s0;
      if (z < -5 || z > 85) { pu.mesh.visible = false; continue; }
      const q = wp(cam, z, p.d);
      pu.mesh.visible = true; pu.mesh.position.set(q.x, q.y + 0.02, q.z); pu.mesh.rotation.z = q.h; pu.mesh.scale.set(p.rd, p.rs * 1.05, 1);
      pu.t += dt;
      pu.rip.forEach((r, k) => { const u = ((pu.t * 0.5 + k * 0.5) % 1); r.scale.setScalar(0.25 + u * 0.75); r.material.opacity = (1 - u) * 0.5; });
    }
  };
  const TILEV = 2.4, TILE2 = 2.4, GR = 4.0;

  /** Place the onlookers. `me` s along the road; called every frame. */
  W.updateCrowd = function (cam, dt) {
    const c = W.crowd; if (!c) return;
    const C = cam.C, s0 = cam.sMe;
    const ppl = c.people;
    for (let i = 0; i < ppl.length && i < W.slots.length; i++) {
      const sl = W.slots[i], p = ppl[i], z = sl.s - s0;
      if (z < -5.5 || z > 80) { p.y = -100; continue; }
      const hw = halfWidthAt(C, sl.s);
      const e = sl.sg * (hw + sl.off);
      if (overWater(C, sl.s, e) || overWater(C, sl.s + 1.5, e) || overWater(C, sl.s - 1.5, e)) { p.y = -100; continue; }
      const q = wp(cam, z, e);
      p.x = q.x; p.y = q.y; p.z = q.z;
      p.yaw = (sl.sg < 0 ? Math.PI / 2 : -Math.PI / 2) - q.h + Math.sin(i * 12.9) * 0.45 + (sl.sg < 0 ? -0.35 : 0.35);
    }
    c.invalidate(); c.update(dt, stage.camera);
  };

  W.dispose = () => { try { W.crowd && W.crowd.dispose(); } catch { /* ignore */ } };
  void heightAt;
  return W;
}
