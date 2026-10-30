// The 3D show: piazza, crowd, musicians, three flag bearers with silk flags. Presentation only: it reads the frame the 2D scene hands it
// (positions in design units, the beat) and draws into one off-screen WebGL canvas that the 2D scene composites; HUD, guides and
// particles stay 2D on top. Nothing here writes back into the sim.
import { createStage, loadHuman, createCrowd3d, CULTURES, THREE } from '../vendor3d/index.js';
import { palmFrame, palmPoint, solvePalmBall } from '../vendor3d/contact.js';
import { COSTUMES, LOOKS, BODY_M, dressBody, addCostumeMeshes } from './costume.js';
import { buildPiazza } from './piazza.js';
import { createCloth, flagTexture, POLE_LEN, FLAG_W, FLAG_H } from './cloth.js';
import { DESIGNS, paintDesign } from '../src/art.js';

const { Vector3, Quaternion } = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const V = () => new Vector3();

// Italian festival crowd: long coats and dresses in heraldic colours, caps and berets, a few headscarves.
CULTURES.italian_festival = {
  skin: [['olive', 5], ['fair', 3.5], ['tan', 1.5]], hair: [['dkbrown', 5], ['black', 4], ['brown', 2], ['chestnut', 1.5], ['grey', 0.8]],
  hats: [[0, 5], [1, 3], [3, 2.5], [2, 1]], womenHat: [[0, 6], [5, 2.2], [3, 1]],
  garment: [[2, 4.5], [1, 4], [0, 0.4]], womanGarment: [[3, 6], [2, 2.5], [1, 1]],
  top: ['#a8262e', '#244f9a', '#c79a2c', '#2f7a4d', '#5b2f86', '#e8dcc0', '#8a3a24', '#23364f', '#d0873a'], bottom: ['#2a2f48', '#3a2a22', '#5a2f26', '#2d4a3a', '#c8b48a'],
  scarf: 0.2, patterns: [[0, 4], [1, 3], [2, 1.5]], flag: ['#c0262f', '#2557a7', '#f2c14e'],
};

const BEAR = [
  { c: COSTUMES[0], look: LOOKS[0] },
  { c: COSTUMES[1], look: LOOKS[1] },
  { c: COSTUMES[2], look: LOOKS[2] },
];
const MUSIC = [
  { tab: '#7a1d26', trim: '#e3b24a', hoseL: '#1d2a52', hoseR: '#7a1d26', sleeve: '#e8dcc0', hat: '#1d2a52', look: { skin: 'tan', hair: 'black' } },
  { tab: '#1d2a52', trim: '#e3b24a', hoseL: '#7a1d26', hoseR: '#1d2a52', sleeve: '#e8dcc0', hat: '#7a1d26', look: { skin: 'light', hair: 'brown' } },
  { tab: '#2f6a4a', trim: '#e3b24a', hoseL: '#e3b24a', hoseR: '#2f6a4a', sleeve: '#e8dcc0', hat: '#2f6a4a', look: { skin: 'brown', hair: 'black' } },
];

// critically damped spring on a scalar / 2-vector (so targets driven by the sim tick never snap)
function spring(s, target, dt, w = 18, z = 1) {
  if (!s) return { x: target, v: 0 };
  const a = -2 * z * w * s.v - w * w * (s.x - target);
  s.v += a * dt; s.x += s.v * dt;
  return s;
}

export async function createShow({ quality = 'medium', base, nBear = 3 } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: quality !== 'low', shadowSize: 4.2, lighting: 'evening', fov: 14, autoLOD: true });
  if (!stage.supported) return null;
  const scene = stage.scene, cam = stage.camera;
  const low = quality === 'low';
  cam.fov = 14; cam.near = 1; cam.far = 260;

  // ---- light: late-afternoon sun low from the front left, warm; cool sky fill; the torches add their own
  stage.setSky(null, null);
  const FOG = new THREE.Fog(0xe6c39a, 22, 85);
  const L = stage.lights;
  const HEMI = 0.86;                  // less flat fill, a stronger low sun: shapes model, shadows read
  L.hemi.color.set(0xbcd0f0); L.hemi.groundColor.set(0x8a6038); L.hemi.intensity = HEMI;
  L.key.color.set(0xffd29a); L.key.intensity = 4.2;
  L.rim.color.set(0xa9c0ff); L.rim.intensity = 1.2;
  stage._shadowOffset.set(-6.5, 7.5, 6.5);
  stage.setShadowTarget(0, 0.8, 0);
  stage.renderer.toneMappingExposure = 1.02;

  const piazza = buildPiazza({ quality });
  scene.add(piazza.group);

  // ---- floor shadows / marks
  const blobTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(20,10,0,0.55)'); gr.addColorStop(1, 'rgba(20,10,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false });
  const blob = (r) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), blobMat.clone()); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; m.renderOrder = 2; scene.add(m); return m; };
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.52, 48), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.85, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.scale.set(1, 0.62, 1); scene.add(ring);

  // ---- people
  const people = [];
  for (let i = 0; i < nBear; i++) {
    const { c, look } = BEAR[i % BEAR.length];
    const h = await loadHuman({ character: 'athlete_m', base, kit: { top: '#ffffff', bottoms: '#ffffff', socks: '#ffffff' }, hair: look.hair });
    dressBody(h, c, look.skin);
    addCostumeMeshes(h, c);
    h.groundClamp = 'auto';
    stage.add(h); stage.track(h);
    h.play('idle_relaxed', { fade: 0 });
    people.push(makePerson(h, i));
  }
  const musicians = [];
  const nMus = low ? 2 : 3;
  for (let i = 0; i < nMus; i++) {
    const m = MUSIC[i % MUSIC.length];
    const h = await loadHuman({ character: 'athlete_m', base, kit: { top: '#ffffff', bottoms: '#ffffff', socks: '#ffffff' }, hair: m.look.hair });
    dressBody(h, m, m.look.skin);
    addCostumeMeshes(h, m);
    h.groundClamp = 'auto';
    stage.add(h); stage.track(h);
    h.play('idle', { fade: 0 });
    musicians.push({ h, kind: i === 1 ? 'trumpet' : 'drum', i, props: null, sm: {} });
  }
  // musicians stand on the top step, at the back, facing the square
  const SR = piazza.stepRows;
  const topY = SR.ROWS * SR.STEP, backZ = SR.cz - (SR.R0 + SR.ROWS * SR.GAP) + 0.45;
  const mx = [-1.1, 0.0, 1.1];
  musicians.forEach((m, k) => { m.h.root.position.set(mx[k], topY, backZ); m.h.root.rotation.set(0, 0, 0); m.h.facing = 0; });

  // ---- crowd on the stepped arcs
  const pts = [];
  {
    let seed = 7; const rr = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let r = 0; r < SR.ROWS; r++) {
      const rad = SR.R0 + (r + 0.62) * SR.GAP, n = Math.round((low ? 9 : 12) + r * 2);
      const a0 = Math.PI * 0.5 + 0.2, a1 = Math.PI * 1.5 - 0.2;
      for (let k = 0; k < n; k++) {
        const a = a0 + ((k + 0.3 + rr() * 0.4) / n) * (a1 - a0);
        const x = Math.sin(a) * rad, z = SR.cz + Math.cos(a) * rad;
        // keep the musicians' spot clear
        if (r === SR.ROWS - 1 && Math.abs(x) < 1.7) continue;
        pts.push({ x, y: (r + 1) * SR.STEP, z, yaw: Math.atan2(-x, SR.cz - z) + (rr() - 0.5) * 0.4, seated: 0 });
      }
    }
  }
  const crowd = createCrowd3d(stage, {
    points: pts, seed: 11, culture: 'italian_festival', quality: low ? 'low' : quality === 'high' ? 'high' : 'medium', excitement: 0.25,
    props: { flag: 0.14, phone: 0, child: 0.04 }, flagColors: ['#c0262f', '#2557a7', '#f2c14e', '#f8f1e0'], cold: false, viewportHeight: 800,
  });

  // ---- flags (pooled cloth + pole)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.55 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xe3b24a, metalness: 0.85, roughness: 0.28 });
  const poleGeo = new THREE.CylinderGeometry(0.015, 0.019, POLE_LEN, 10);
  const tipGeo = new THREE.CylinderGeometry(0, 0.036, 0.15, 10);
  const cuspGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const flags = new Map();       // key -> { cloth, pole, tip, seen, pose }
  const pool = [];
  function newFlag() {
    const cloth = createCloth({ seed: 1 + pool.length * 7 + 3 });
    const grp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat); pole.castShadow = !low;
    const tip = new THREE.Mesh(tipGeo, brass); tip.position.y = POLE_LEN / 2 + 0.07;
    const knob = new THREE.Mesh(cuspGeo, brass); knob.position.y = POLE_LEN / 2 + 0.01;
    const butt = new THREE.Mesh(cuspGeo, brass); butt.position.y = -POLE_LEN / 2;
    // a tassel under the spearhead
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.035, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xc0262f, roughness: 0.7 })); tassel.position.set(0.03, POLE_LEN / 2 - 0.12, 0); tassel.rotation.z = Math.PI;
    grp.add(pole, tip, knob, butt, tassel);
    scene.add(grp, cloth.mesh);
    const shadow = blob(0.55);
    grp.traverse((c) => c.layers.set(2)); cloth.mesh.layers.set(2); shadow.layers.set(2);
    const f = { cloth, grp, shadow, seen: 0, design: -1, age: 0 };
    return f;
  }
  const designTex = (i) => flagTexture(`flag${i}`, (g, w, h) => paintDesign(g, DESIGNS[((i % 8) + 8) % 8], w, h));
  function useFlag(key, design, side) {
    let f = flags.get(key);
    if (!f) {
      f = pool.pop() || newFlag();
      f.grp.visible = f.cloth.mesh.visible = f.shadow.visible = true;
      f.cloth.ready = false; f.age = 0; f.design = -1;
      flags.set(key, f);
    }
    if (f.design !== design) { f.design = design; f.cloth.setDesign(designTex(design)); }
    f.cloth.side = side;
    return f;
  }

  buildMusicProps();
  for (let i = 0; i < 14; i++) stage.update(1 / 60, { renderNow: false });          // let the rigs settle (foot planting, ground clamp) before the first picture

  // ---- layers: 1 = the far world (rendered soft, at half resolution: a shallow depth of field), 2 = the performers and their floor (sharp)
  const setLayer = (o, n) => o.traverse((c) => c.layers.set(n));
  setLayer(piazza.group, 1);
  { const cg = scene.children.find((c) => c.name === 'crowd3d'); if (cg) setLayer(cg, 1); }
  for (const m of musicians) { setLayer(m.h.root, 1); for (const v of Object.values(m.props)) setLayer(v.mesh || v, 1); }
  for (const P of people) { setLayer(P.h.root, 2); setLayer(P.shadow, 2); }
  setLayer(ring, 2);
  const nearTex = piazza.floorTex.clone(); nearTex.needsUpdate = true;
  const NF = { cx: 0, cz: -0.4, w: 15, d: 11 };
  nearTex.repeat.set(NF.w / 4, NF.d / 4);
  nearTex.offset.set((NF.cx + 48) / 4 - NF.w / 8, (28 - NF.cz) / 4 - NF.d / 8);
  const fadeTex = (() => { const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 96; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 48, 8, 64, 48, 62); gr.addColorStop(0, '#fff'); gr.addColorStop(0.62, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = '#000'; g.fillRect(0, 0, 128, 96); g.fillStyle = gr; g.fillRect(0, 0, 128, 96); return new THREE.CanvasTexture(c); })();
  const nearFloor = new THREE.Mesh(new THREE.PlaneGeometry(NF.w, NF.d), new THREE.MeshStandardMaterial({ map: nearTex, alphaMap: fadeTex, transparent: true, roughness: 0.82, depthWrite: false }));
  nearFloor.rotation.x = -Math.PI / 2; nearFloor.position.set(NF.cx, 0.001, NF.cz); nearFloor.receiveShadow = true;
  scene.add(nearFloor); setLayer(nearFloor, 2);
  const nearMed = new THREE.Mesh(new THREE.CircleGeometry(4.3, 64), piazza.group.children.find((c) => c.geometry && c.geometry.type === 'CircleGeometry').material);
  nearMed.rotation.x = -Math.PI / 2; nearMed.position.set(0, 0.006, -0.3); nearMed.receiveShadow = true; scene.add(nearMed); setLayer(nearMed, 2);

  // ---- framing: world (0,0,0) lands on the floor row; one design unit = 1/pxPerM metres at the performers' depth
  const api = { stage, scene, piazza, crowd, people, musicians, quality, ok: true, lost: false, fitted: '', pxPerM: 190, pitch: 8, D: 9, t: 0, last: null, devYaw: Number(new URLSearchParams(globalThis.location.search).get('by') || 0) };
  const D = () => api.D;
  function fit(w, h, foot, devW, devH, cxRef) {
    const PITCH = api.pitch * Math.PI / 180;
    const key = `${w}|${h}|${foot}|${devW}|${PITCH}|${api.pxPerM}|${api.D}|${api.camX ?? 0}`;
    if (api.fitted === key) return;
    stage.renderer.setPixelRatio(1); stage.renderer.setSize(devW, devH, false);
    cam.aspect = devW / devH;
    cam.fov = 2 * Math.atan(((h / api.pxPerM) / 2) / D()) * 180 / Math.PI;
    const cyM = (foot - h / 2) / api.pxPerM;
    cam.position.set(api.camX ?? 0, cyM + D() * Math.sin(PITCH), D() * Math.cos(PITCH));
    cam.lookAt(api.camX ?? 0, cyM, 0);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    const p = new Vector3(0, 0, 0).project(cam);
    const wantY = 1 - 2 * foot / h;
    const e = cam.projectionMatrix.elements;
    e[9] -= (wantY - p.y);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    api.fitted = key;
    api.cxRef = cxRef;
    api.footFrac = clamp(foot / h, 0.3, 1);
  }

  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => { api.lost = false; api.fitted = ''; });

  // ---------------------------------------------------------------------------------------------------------------------------------
  function makePerson(h, i) {
    h._applyRest(); h.root.updateMatrixWorld(true);
    const armLen = h.bonePosition('R_UpperArm').distanceTo(h.bonePosition('R_Forearm')) + h.bonePosition('R_Forearm').distanceTo(h.bonePosition('R_Hand'));
    const P = { armLen, h, i, sm: {}, holdQ: { R: { q: new Quaternion(), m: 0 }, L: { q: new Quaternion(), m: 0 } }, body: { crouch: 0, twist: 0, bend: 0, flex: 0, rise: 0 }, bodyT: { crouch: 0, twist: 0, bend: 0, flex: 0, rise: 0 }, lastX: null, shadow: blob(0.62), grip: ['relaxed', 'relaxed'] };
    // procedural torso / knee mechanics, applied just before the arm IK so the hands still land where the show asks
    const orig = h._post.bind(h);
    const e = new THREE.Euler(), qo = new Quaternion();
    h._post = (dt) => {
      const b = P.body, bones = h.bones;
      for (const n of ['Bip01_Spine', 'Bip01_Spine1', 'Bip01_Spine2']) {
        const bone = bones[n]; if (!bone) continue;
        e.set(b.twist / 3, -b.bend / 3, b.flex / 3, 'XYZ');
        qo.setFromEuler(e); bone.quaternion.multiply(qo);
      }
      if (h.pelvis) h.pelvis.position.y -= b.crouch * 0.075 - b.rise * 0.03;
      orig(dt);
      // the fist round the pole: orient the hand after the reach, blended in and out (so the forearm never has to roll through half a turn)
      for (const side of ['R', 'L']) {
        const hq = P.holdQ[side];
        if (hq.m < 0.01) continue;
        const hb = h.bones[`Bip01_${side}_Hand`];
        hb.updateWorldMatrix(true, false);
        const cur = hb.getWorldQuaternion(new Quaternion());
        h._setHandWorld(side, cur.slerp(hq.q, Math.min(1, hq.m)));
      }
      h.root.updateMatrixWorld(true);
    };
    return P;
  }

  function buildMusicProps() {
    const red = new THREE.MeshStandardMaterial({ color: 0x8c2b20, roughness: 0.35, metalness: 0.05 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xf1e6cb, roughness: 0.6 });
    const gold = brass;
    const woodS = new THREE.MeshStandardMaterial({ color: 0xe8d9b4, roughness: 0.5 });
    for (const m of musicians) {
      if (m.kind === 'drum') {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 28), red); g.add(body);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.012, 28), skin); head.position.y = 0.152; g.add(head);
        for (const y of [0.15, -0.15]) { const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.222, 0.012, 8, 28), gold); hoop.rotation.x = Math.PI / 2; hoop.position.y = y; g.add(hoop); }
        for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 4), new THREE.MeshStandardMaterial({ color: 0xe8dcc0 })); rope.position.set(Math.sin(a) * 0.226, 0, Math.cos(a) * 0.226); rope.rotation.z = (k % 2 ? 1 : -1) * 0.2; g.add(rope); }
        scene.add(g);
        const stickR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.42, 8), woodS), stickL = stickR.clone();
        scene.add(stickR, stickL);
        m.props = { drum: g, stickR, stickL };
      } else {
        const g = new THREE.Group();
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.25, 10), gold); tube.rotation.x = Math.PI / 2; tube.position.z = 0.6; g.add(tube);
        const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.011, 0.22, 16, 1, true), gold); bell.material = gold.clone(); bell.material.side = THREE.DoubleSide; bell.rotation.x = -Math.PI / 2; bell.position.z = 1.3; g.add(bell);
        const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 6, 12), gold); g.add(mouth);
        scene.add(g);
        // the pennon hanging from the trumpet
        const cl = createCloth({ seed: 91, w: 0.34, h: 0.36 });
        cl.setDesign(designTex(1)); scene.add(cl.mesh);
        m.props = { trumpet: g, pennon: cl };
      }
    }
  }

  const tmp = V(), tmp2 = V(), tmp3 = V(), axis = V(), sideV = V(), basePos = V();
  const qa = new Quaternion();

  function placePole(f, centre, A, cloth_side, dt, calm) {
    // pole centred on `centre`, axis A (unit). grp is the mesh group (cylinder along +y)
    f.grp.position.copy(centre);
    qa.setFromUnitVectors(new Vector3(0, 1, 0), A);
    f.grp.quaternion.copy(qa);
    const base = tmp.copy(centre).addScaledVector(A, -POLE_LEN / 2);
    // the cloth streams to the side vector perpendicular to the pole in the screen plane
    sideV.set(A.y, -A.x, 0).multiplyScalar(cloth_side).normalize();
    f.cloth.step(dt, { base: base.clone(), axis: A.clone(), side: sideV.clone(), len: POLE_LEN, hoistTop: POLE_LEN - 0.05 }, { calm, wx: api.windX });
    f.shadow.position.x = centre.x + 0.1 + centre.y * 0.18; f.shadow.position.z = centre.z - centre.y * 0.18;
    const hgt = clamp(centre.y, 0, 8);
    f.shadow.scale.set(1.0 + hgt * 0.04, 0.5 + hgt * 0.02, 1);
    f.shadow.material.opacity = clamp(0.5 - hgt * 0.035, 0.12, 0.5);
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------------------------------
  /**
   * frame: { w, h, t, foot, H, calm, beat, bpm, beatFlash, mode, camX, bearers: [...], flights: [...], cheer }
   *  bearers[i]: { id, cx, costume, you, hands: [{x,y}, {x,y}] (units of H/100 from the feet), grip: ['fist'|'open'|'relaxed', ...], lean, yaw, gaze,
   *                body: { crouch, twist, bend, flex, rise }, held: [{ design, ang, hand: 0|1, side }] }
   *  flights[i]: { id, x, y, ang, design, side }       (design-unit centre of the pole)
   * Returns [{ r: {x,y}, l: {x,y} }, ...] with the hand positions in design units, or null when nothing was drawn.
   */
  api.render = function (ctx, frame) {
    if (api.lost || stage.contextLost) return null;
    const t0 = globalThis.performance.now();
    const { w, h, foot, H } = frame;
    api.pxPerM = H / BODY_M;
    api.camX = frame.camX ?? 0;
    api.pitch = frame.pitch ?? 8; api.D = frame.D ?? 9;
    api.farScale = frame.farScale ?? 0.4; api.windX = frame.windX; api.iconMode = frame.mode === 'icon';
    { const cg = scene.children.find((c) => c.name === 'crowd3d'); if (cg) cg.visible = !frame.noCrowd; for (const st of piazza.steps) st.visible = !frame.noCrowd; for (const r of piazza.rails) r.visible = !frame.noCrowd; for (const m of musicians) { m.h.root.visible = !frame.noCrowd; for (const v of Object.values(m.props)) (v.mesh || v).visible = !frame.noCrowd; } }
    const m = ctx.getTransform();
    const pxPerUnit = Math.hypot(m.a, m.b);
    const budget = frame.budget || (api.quality === 'low' ? 380000 : api.quality === 'high' ? 1700000 : 820000);
    let sc = Math.min(1, Math.sqrt(budget / (w * h * pxPerUnit * pxPerUnit)));
    const devW = Math.max(160, Math.round(w * pxPerUnit * sc)), devH = Math.max(160, Math.round(h * pxPerUnit * sc));
    fit(w, h, foot, devW, devH, w / 2);
    const dtRaw = api.last === null ? 0 : frame.t - api.last; api.last = frame.t;
    const dt = clamp(dtRaw, 0, 0.05);
    api.t += dt;
    const k = BODY_M / H;                                   // metres per design unit
    const wxOf = (x) => (x - w / 2) * k, wyOf = (y) => (foot - y) * k;
    const kh = BODY_M / 100;                                 // metres per hand-offset unit (offsets are in percent of the body height)
    const specs = frame.bearers;
    const snap = frame.mode !== api.lastMode; api.lastMode = frame.mode;             // a new screen: no turning around or gliding from the old one
    if (snap) for (const f of flags.values()) f.cloth.ready = false;
    const out = [];
    const used = new Set();
    // which person plays which bearer: the player's own (costume 0) wears blue and gold; the others take the rest in order
    let nextOther = 1;
    const who = specs.map((s) => (s.costume === 0 ? 0 : (nextOther++ - 1) % (people.length - 1) + 1));
    people.forEach((P, i) => { const on = who.includes(i); P.h.root.visible = on; P.shadow.visible = on; });
    // 1. targets for the people
    specs.forEach((s, i) => {
      const P = people[who[i]], hh = P.h, sm = P.sm;
      const wx = wxOf(s.cx);
      // first appearance: no gliding from the old place
      sm.x = spring(sm.x, wx, dt, 16);
      if (P.lastX === null || dt === 0 || snap) { sm.x.x = wx; sm.x.v = 0; }
      P.lastX = wx;
      hh.root.position.set(sm.x.x, 0, 0);
      const lean = s.lean || 0;
      sm.lean = spring(sm.lean, lean, dt, 10);
      sm.yaw = spring(sm.yaw, (s.yaw || 0) + (api.devYaw || 0), dt, 8);
      if (snap || dt === 0) { sm.yaw.x = (s.yaw || 0) + (api.devYaw || 0); sm.yaw.v = 0; }
      hh.root.rotation.set(0, Math.PI + sm.yaw.x, -sm.lean.x);
      hh.facing = Math.PI;
      P.shadow.position.set(sm.x.x + 0.18, 0.012, -0.05); P.shadow.scale.set(1.0, 0.8, 1);
      for (const key of ['crouch', 'twist', 'bend', 'flex', 'rise']) {
        const tgt = (s.body && s.body[key]) || 0;
        P.bodyT[key] = tgt;
        sm['b' + key] = spring(sm['b' + key], tgt, dt, 14, 0.9);
        if (snap) { sm['b' + key].x = tgt; sm['b' + key].v = 0; }
        P.body[key] = sm['b' + key].x;
      }
      const shoulderHalf = 0.2;
      s.hands.forEach((hand, side) => {
        // hand targets in metres, smoothed with a second-order spring (follow-through and settle, no snapping)
        const sx = spring(sm['hx' + side], hand.x, dt, 15, 1), sy = spring(sm['hy' + side], hand.y, dt, 15, 1);
        if (dt === 0 || !sm['hx' + side] || snap) { sx.x = hand.x; sx.v = 0; sy.x = hand.y; sy.v = 0; }
        sm['hx' + side] = sx; sm['hy' + side] = sy;
        // the body frame (the figure may face the camera on the menu): right and forward in the floor plane
        const th = Math.PI + sm.yaw.x, fwd = new Vector3(Math.sin(th), 0, Math.cos(th)), rgt = new Vector3(-Math.cos(th), 0, Math.sin(th));
        const hy = -sy.x * kh * 0.97, up = clamp((hy - 1.05) / 0.9, 0, 1);
        const sgn = side === 0 ? 1 : -1;
        const target = new Vector3(wx, Math.max(0.35, hy), 0).addScaledVector(rgt, sx.x * kh * 0.8).addScaledVector(fwd, 0.16 + 0.04 * (1 - up));
        const pole = new Vector3(wx, hy - 0.32 - 0.1 * up, 0).addScaledVector(rgt, sgn * (shoulderHalf + 0.28 + 0.1 * up)).addScaledVector(fwd, -(0.08 - 0.05 * up));
        const sideName = side === 0 ? 'R' : 'L';
        const holder = s.held && s.held.find((q) => q.hand === side);
        // never ask for more than the arm can do: a fully straight arm is where an elbow solver flips
        const reachClamp = (p) => {
          const sh = hh.bonePosition(`${sideName}_UpperArm`, tmp2);
          const lim = (P.armLen || 0.6) * 0.94;
          const dv = tmp3.copy(p).sub(sh), dl = dv.length();
          if (dl > lim) p.copy(sh).addScaledVector(dv, lim / dl);
          return p;
        };
        // hand orientation: blended between a relaxed hand (palm to the thigh) and a fist round the pole, so nothing snaps when a flag leaves or arrives
        const a = holder ? (holder.ang || 0) : 0;
        const mHold = (sm['hold' + side] = (sm['hold' + side] ?? (holder ? 1 : 0)) + ((holder ? 1 : 0) - (sm['hold' + side] ?? (holder ? 1 : 0))) * (1 - Math.exp(-dt * 9)));
        sm['pa' + side] = (sm['pa' + side] ?? a) + (a - (sm['pa' + side] ?? a)) * (dt > 0 ? 1 - Math.exp(-dt * 14) : 1);
        const pa = sm['pa' + side];
        // a fist round a (near) vertical pole: palm toward the body's midline, knuckles along the pole, fingers forward: only a swing from the arm-at-rest hand, no big forearm roll
        const nH = new Vector3(0, Math.sin(pa) * sgn, 0).addScaledVector(rgt, -Math.cos(pa) * sgn);
        const solH = solvePalmBall(hh, sideName, target, nH, fwd, 0.021);
        const solF = solvePalmBall(hh, sideName, target, rgt.clone().multiplyScalar(-sgn).addScaledVector(fwd, -0.18).normalize(), new Vector3(0, -1, 0).addScaledVector(fwd, 0.12), 0.0);
        const wrist = solF.wrist.clone().lerp(solH.wrist, mHold);
        const quat = null;
        P.holdQ[sideName].q.copy(solH.quat); P.holdQ[sideName].m = mHold;
        const wc = reachClamp(wrist.clone());
        if (api.probe) { P.dbg = P.dbg || {}; P.dbg[sideName] = { wrist: wc.toArray(), pole: pole.toArray(), q: solH.quat.toArray(), hold: mHold, tgt: target.toArray(), sh: hh.bonePosition(`${sideName}_UpperArm`).toArray() }; }
        hh.setReach(sideName, wc, { weight: 1, pole, quat });
        hh.setFingers(sideName, (s.grip && s.grip[side]) || 'relaxed');
      });
      // the eyes follow the flag: the look target and its weight are sprung, so the head never snaps to a new flag or back
      const gz = (P.gaze = P.gaze || { x: 0, y: 1.6, w: 0 });
      const ga = dt > 0 ? 1 - Math.exp(-dt * 9) : 1;
      if (s.gaze) { const gx = wxOf(s.gaze.x), gy = wyOf(s.gaze.y); if (gz.w < 0.05) { gz.x = gx; gz.y = gy; } gz.x += (gx - gz.x) * ga; gz.y += (gy - gz.y) * ga; }
      gz.w += ((s.gaze ? 1 : 0) - gz.w) * (dt > 0 ? 1 - Math.exp(-dt * 6) : 1);
      if (gz.w > 0.02) hh.lookAt({ x: gz.x, y: gz.y, z: 3 * Math.cos(Math.PI + sm.yaw.x) }, { weight: 0.85 * gz.w, maxYaw: 0.9, maxPitch: 0.7 });
      else hh.lookAt(null);
    });
    // 2. musicians follow the drum
    animateMusicians(frame, dt);
    // 3. advance the humans, then place the poles from the real hands
    stage.update(dt, { renderNow: false });
    cam.updateMatrixWorld(true);
    // flags wanted this frame: those in the fists (placed from the real hands) and those in the air
    const wants = [];
    const handCentre = (hh, sideName, a) => {
      const pf = palmFrame(hh, sideName), pp = palmPoint(hh, sideName);
      const A = new Vector3(Math.sin(a), Math.cos(a), 0);
      return { c: pp.clone().addScaledVector(pf.n, 0.02).addScaledVector(A, POLE_LEN * 0.5 - 0.34), A };
    };
    const handOf = new Map();                              // slot id -> person (for blends)
    specs.forEach((s, i) => {
      const P = people[who[i]], hh = P.h;
      handOf.set(s.id, P);
      if (s.held) s.held.forEach((q, kq) => {
        const { c, A } = handCentre(hh, q.hand === 0 ? 'R' : 'L', q.ang || 0);
        wants.push({ key: `h${s.id}:${kq}`, design: q.design, side: q.side || 1, c, A, held: true });
      });
    });
    for (const fl of frame.flights || []) {
      let c = new Vector3(wxOf(fl.x), wyOf(fl.y), -0.16);
      let a = fl.ang || 0;
      // just thrown: the pole leaves the owner's fist (no jump), and just before a catch it meets the catcher's hand
      const own = handOf.get(fl.owner);
      if (own && fl.age < 0.3 && !fl.dropped) {
        const hc = handCentre(own.h, 'R', a);
        const k0 = clamp(fl.age / 0.3, 0, 1), e = k0 * k0 * (3 - 2 * k0);
        c = hc.c.clone().lerp(c, e);
      }
      const rcv = fl.to !== undefined && fl.kind !== 'mirror' ? handOf.get(fl.to) : null;
      if (rcv && fl.u > 0.9 && !fl.dropped) {
        const hc = handCentre(rcv.h, 'R', a);
        const k1 = clamp((fl.u - 0.9) / 0.1, 0, 1), e = k1 * k1 * (3 - 2 * k1);
        c = c.clone().lerp(hc.c, e * 0.9);
      }
      wants.push({ key: `f${fl.id}`, design: fl.design, side: fl.side || 1, c, A: new Vector3(Math.sin(a), Math.cos(a), 0), held: false });
    }
    // a flag that changes hands keeps its cloth: match requests with no cloth to cloth nobody asked for, nearest first
    const asked = new Set(wants.map((q) => q.key));
    const orphans = [...flags.keys()].filter((k) => !asked.has(k));
    for (const q of wants) {
      if (flags.has(q.key)) continue;
      let best = null, bd = 1.2;
      for (const k of orphans) { const f = flags.get(k); if (!f || !f.center) continue; const d = f.center.distanceTo(q.c); if (d < bd) { bd = d; best = k; } }
      if (best) { flags.set(q.key, flags.get(best)); flags.delete(best); orphans.splice(orphans.indexOf(best), 1); }
    }
    for (const q of wants) {
      const f = useFlag(q.key, q.design, q.side);
      f.seen = api.t; used.add(f);
      placePole(f, q.c, q.A, q.side, dt, frame.calm);
      f.center = q.c.clone();
    }
    // drop flags nobody asked for this frame back into the pool
    for (const [key, f] of flags) {
      if (!used.has(f)) { flags.delete(key); f.grp.visible = f.cloth.mesh.visible = f.shadow.visible = false; pool.push(f); }
    }
    if (api.probe) recordProbe(frame, dt, specs, who);
    // the player's ring
    const you = specs.findIndex((s) => s.you);
    ring.visible = you >= 0;
    if (you >= 0) { ring.position.x = people[who[you]].sm.x ? people[who[you]].sm.x.x : 0; ring.position.z = 0; ring.material.opacity = 0.55 + 0.3 * Math.sin(api.t * 3); }
    // world: torches, banners, bunting, crowd
    piazza.update(api.t, dt, { calm: frame.calm, beat: frame.beatFlash || 0 });
    L.hemi.intensity = HEMI + (frame.beatFlash || 0) * 0.12;
    if (frame.cheer && frame.cheer.id !== api.cheerId) { api.cheerId = frame.cheer.id; crowd.react(frame.cheer.kind || 'cheer', { origin: [0, 0, -4], radius: 40, intensity: frame.cheer.intensity ?? 1 }); }
    crowd.update(dt);
    renderTwoPass(ctx, w, h, devW, devH);
    // where the hands really are, in design units
    const proj = (hh, side) => {
      const hb = hh.bones[`Bip01_${side}_Hand`], fb = hh.bones[`Bip01_${side}_Forearm`];
      const p = hb.getWorldPosition(new Vector3()), q = fb.getWorldPosition(new Vector3());
      p.addScaledVector(p.clone().sub(q).normalize(), 0.06);
      p.project(cam);
      return { x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h };
    };
    specs.forEach((s, i) => { const hh = people[who[i]].h; out.push({ r: proj(hh, 'R'), l: proj(hh, 'L') }); });
    const ms = globalThis.performance.now() - t0;
    api.costAvg = api.costN ? api.costAvg * 0.95 + ms * 0.05 : ms; api.costN = (api.costN || 0) + 1;
    if (api.costN > 90 && api.costAvg > 14 && api.quality !== 'low') { api.quality = 'low'; stage.setQuality('low'); crowd.setQuality('low'); }
    return out;
  };

  // the far-world grade: less saturation and contrast, a warm golden haze strongest at the height of the stands (where the crowd stands)
  const FAR_GRADE = 'saturate(0.76) contrast(0.92) brightness(0.95)';
  function hazeFar(g, hw, hh) {
    const fy = api.footFrac ?? 0.8;
    const gr = g.createLinearGradient(0, 0, 0, hh * fy);
    gr.addColorStop(0, 'rgba(255,214,150,0.05)'); gr.addColorStop(0.55, 'rgba(250,196,128,0.13)'); gr.addColorStop(0.92, 'rgba(236,170,110,0.2)'); gr.addColorStop(1, 'rgba(236,170,110,0)');
    g.fillStyle = gr; g.fillRect(0, 0, hw, hh * fy);
  }
  function renderTwoPass(ctx, w, h, devW, devH) {
    const r = stage.renderer, gl = r.domElement;
    if (api.quality === 'low') {
      cam.layers.set(0); cam.layers.enable(1); cam.layers.enable(2);
      scene.fog = FOG; r.setClearColor(0xe6c39a, 1);
      r.setViewport(0, 0, devW, devH); r.render(scene, cam);
      ctx.drawImage(gl, -12, -12, w + 24, h + 24);
    } else {
      const hw = Math.max(64, Math.round(devW * (api.farScale ?? 0.5))), hh = Math.max(64, Math.round(devH * (api.farScale ?? 0.5)));
      // the far world changes slowly: it is redrawn every other frame (and at once when the picture is re-framed) and the last image is reused
      api.frameNo = (api.frameNo || 0) + 1;
      const fc = api.farCanvas && api.farCanvas.width === hw && api.farCanvas.height === hh ? api.farCanvas : null;
      if (!fc || api.frameNo % 2 === 0 || api.farKey !== api.fitted || api.iconMode) {
        cam.layers.set(0); cam.layers.enable(1);
        scene.fog = FOG; r.setClearColor(0xe6c39a, 1);
        r.setViewport(0, 0, hw, hh); r.setScissorTest(false); r.render(scene, cam);
        const target = fc || (api.farCanvas = Object.assign(globalThis.document.createElement('canvas'), { width: hw, height: hh }));
        const tg = target.getContext('2d');
        // aerial perspective: the far world (palazzo, stands, crowd) is graded a little softer and warmer than the performers, so they read first
        tg.filter = FAR_GRADE; tg.drawImage(gl, 0, devH - hh, hw, hh, 0, 0, hw, hh); tg.filter = 'none';
        hazeFar(tg, hw, hh);
        api.farKey = api.fitted;
      }
      ctx.drawImage(api.farCanvas, 0, 0, hw, hh, -12, -12, w + 24, h + 24);
      cam.layers.set(0); cam.layers.enable(2);
      scene.fog = null; r.setClearColor(0x000000, 0);
      r.setViewport(0, 0, devW, devH); r.render(scene, cam);
      ctx.drawImage(gl, -12, -12, w + 24, h + 24);
    }
    // a warm vignette pulls the eye to the performers
    const vg = ctx.createRadialGradient(w / 2, h * 0.62, Math.min(w, h) * 0.3, w / 2, h * 0.62, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(30,10,0,0)'); vg.addColorStop(1, 'rgba(30,10,0,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(-12, -12, w + 24, h + 24);
  }

  // dev: per-frame joint orientations / positions of every visible bearer (api.probe = [] to start), used by dev/motion-probe.mjs
  const JOINTS = ['Pelvis', 'Spine1', 'Spine2', 'Head', 'L_UpperArm', 'L_Forearm', 'L_Hand', 'R_UpperArm', 'R_Forearm', 'R_Hand', 'L_Thigh', 'L_Calf', 'L_Foot', 'R_Thigh', 'R_Calf', 'R_Foot'];
  function recordProbe(frame, dt, specs, who) {
    const q = new Quaternion(), v = new Vector3();
    specs.forEach((s, i) => {
      const P = people[who[i]], h = P.h, rec = { id: s.id, who: who[i], dt, t: api.t, q: {}, p: {} };
      for (const j of JOINTS) { h.bones[`Bip01_${j}`].getWorldQuaternion(q); rec.q[j] = [q.x, q.y, q.z, q.w]; }
      for (const j of ['Pelvis', 'Head', 'L_Hand', 'R_Hand', 'L_Foot', 'R_Foot']) { h.bones[`Bip01_${j}`].getWorldPosition(v); rec.p[j] = [v.x, v.y, v.z]; }
      rec.root = [h.root.position.x, h.root.position.z, h.root.rotation.y];
      rec.loc = {}; for (const j of ['R_UpperArm', 'R_Forearm', 'R_Hand', 'L_Forearm']) { const lq = h.bones[`Bip01_${j}`].quaternion; rec.loc[j] = [lq.x, lq.y, lq.z, lq.w]; }
      rec.dbg = P.dbg ? JSON.parse(JSON.stringify(P.dbg)) : null;
      rec.beat = frame.beat;
      api.probe.push(rec);
    });
  }

  function animateMusicians(frame, dt) {
    const beat = frame.beat ?? api.t * ((frame.bpm || 72) / 60);
    for (const m of musicians) {
      const h = m.h, sm = m.sm;
      const ph = beat - Math.floor(beat);
      const strong = Math.floor(beat) % 4 === 0;
      const faceYaw = 0;
      h.root.rotation.y = faceYaw;
      if (m.kind === 'drum') {
        // a snare slung at the hip; the sticks hit on the beat, alternating hands, with a rebound lift
        const half = beat * 2, hi = Math.floor(half), u = half - hi;
        const right = hi % 2 === 0;
        const strike = Math.pow(Math.max(0, 1 - u * 2.4), 2);
        const base = h.root.position;
        const drumC = new Vector3(base.x, base.y + 0.92, base.z + 0.36);
        const dg = m.props.drum; dg.position.copy(drumC); dg.rotation.set(0.22, 0, 0);
        const tip = (side) => new Vector3(base.x + side * 0.12, base.y + 1.08 + (side === (right ? 1 : -1) ? 0.16 * (1 - strike) + (strong ? 0.05 : 0) : 0.06), base.z + 0.4);
        const hr = tip(-1), hl = tip(1);                       // model faces +z: its right hand is at -x
        h.setReach('R', hr, { weight: 1, pole: new Vector3(base.x - 0.36, base.y + 1.0, base.z + 0.05) });
        h.setReach('L', hl, { weight: 1, pole: new Vector3(base.x + 0.36, base.y + 1.0, base.z + 0.05) });
        h.setFingers('R', 'fist'); h.setFingers('L', 'fist');
        const place = (stick, side, p) => { stick.position.copy(p).add(new Vector3(0, 0.04, 0.12)); stick.rotation.set(Math.PI / 2 - 0.5, 0, side * 0.12); };
        place(m.props.stickR, -1, hr); place(m.props.stickL, 1, hl);
        h.lookAt(null);
      } else {
        // trumpet raised to the mouth; the bell lifts on the strong beat; the pennon hangs from it
        const base = h.root.position;
        const lift = 0.1 * (strong ? 1 - ph : 0);
        const mouth = new Vector3(base.x - 0.02, base.y + 1.55, base.z + 0.14);
        h.setReach('R', new Vector3(base.x - 0.12, base.y + 1.5, base.z + 0.2), { weight: 1, pole: new Vector3(base.x - 0.36, base.y + 1.2, base.z - 0.05) });
        h.setReach('L', new Vector3(base.x + 0.1, base.y + 1.45 + lift * 0.4, base.z + 0.75), { weight: 1, pole: new Vector3(base.x + 0.3, base.y + 1.2, base.z + 0.3) });
        h.setFingers('R', 'fist'); h.setFingers('L', 'fist');
        const tg = m.props.trumpet; tg.position.copy(mouth); tg.rotation.set(-0.12 - lift, 0.0, 0);
        const bellPos = new Vector3(0, 0, 1.3).applyEuler(tg.rotation).add(tg.position);
        const cl = m.props.pennon;
        tmp2.set(bellPos.x, bellPos.y - 0.02, bellPos.z - 0.35);
        cl.step(dt, { base: tmp2.clone(), axis: new Vector3(0, 0, 1), side: new Vector3(0, -1, 0), len: 0.34, hoistTop: 0.34 }, { wx: 0.6, wz: 0.2, gust: 0.7 });
        h.lookAt({ x: base.x, y: base.y + 1.6, z: base.z + 10 }, { weight: 0.5, maxYaw: 0.4, maxPitch: 0.3 });
      }
    }
  }

  // ---- a still of the empty piazza for the screens that are not the show (rules, about, settings, result)
  api.backdrop = function (ctx, w, h) {
    if (api.lost || stage.contextLost) return false;
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (api.bdKey !== key || !api.bdCanvas) {
      const saveVis = people.map((P) => P.h.root.visible);
      people.forEach((P) => { P.h.root.visible = false; P.shadow.visible = false; });
      for (const f of flags.values()) f.grp.visible = f.cloth.mesh.visible = f.shadow.visible = false;
      ring.visible = false;
      const foot = h - 42, H = Math.max(130, Math.min(h * 0.31, 350));
      api.pxPerM = H / BODY_M; api.camX = 0;
      const sc = Math.min(1, Math.sqrt(500000 / (w * h)));
      const devW = Math.round(w * sc), devH = Math.round(h * sc);
      fit(w, h, foot, devW, devH, w / 2);
      piazza.update(0.2, 0.016, {});
      crowd.update(0.016);
      const c = globalThis.document.createElement('canvas'); c.width = devW; c.height = devH;
      const cc = c.getContext('2d'); cc.scale(devW / w, devH / h);
      renderTwoPass(cc, w, h, devW, devH);
      api.bdCanvas = c; api.bdKey = key; api.fitted = '';
      people.forEach((P, i) => { P.h.root.visible = saveVis[i]; P.shadow.visible = saveVis[i]; });
    }
    ctx.drawImage(api.bdCanvas, -12, -12, w + 24, h + 24);
    return true;
  };
  api.dispose = () => { piazza.dispose(); crowd.dispose?.(); stage.dispose(); };
  return api;
}
