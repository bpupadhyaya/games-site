// The spectators: real 3D people (view3d athlete_m / athlete_f) in steppe dress on three tiers of timber stands behind the far boards.
// Presentation only. One small off-screen WebGL canvas renders the visible stretch of the stands from the front (orthographic, slightly
// from above); the 2D scene blits it behind the rail. People are pooled per tier and assigned to world slots by index, so a person is
// stable in the world while the camera pans and nobody pops while visible. LOD, a reduced redraw rate and no leg dressing on the back
// tiers keep it cheap. Falls back to the old 2D crowd when WebGL is missing or the context is lost.
import { loadHuman, THREE } from '../vendor3d/index.js';
import { dressLimbs, headFrame } from './rider.js';

const { Vector3, Quaternion, Matrix4, Group, Mesh, MeshStandardMaterial, CylinderGeometry, SphereGeometry, TorusGeometry, BoxGeometry, Color, DoubleSide, OrthographicCamera } = THREE;
const TAU = Math.PI * 2;
const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const mod = (a, n) => ((a % n) + n) % n;

const TIERS = [
  { z: 0.0, y: 0.0, step: 0.66, lod: 1, legs: true },
  { z: -1.05, y: 0.62, step: 0.72, lod: 2, legs: false },
  { z: -2.1, y: 1.24, step: 0.78, lod: 2, legs: false },
];
const SKINS = ['#e3b996', '#d9a47c', '#c98f66', '#b87f58', '#e8c4a0', '#a9744f', '#d4a07a'];
const COATS_M = ['#2f4b3a', '#6b2a2a', '#23324f', '#8a6a2a', '#2a2a2e', '#5b4a3a', '#d8d0bc', '#1f5a5a', '#7a3f1f', '#3a3a5a'];
const COATS_F = ['#b23a3a', '#c24a7a', '#2a7a8a', '#d09a2a', '#6a3a8a', '#e6dfcf', '#2f6a4a', '#c8602a'];
const TRIMS = ['#e3c36a', '#f2ece0', '#c0392b', '#2b6cb0', '#e8a33a'];
const HAIR = ['black', 'black', 'brown', 'brown', '#2b2018'];

export async function createStands({ base, quality = 'medium', perTier = 30 } = {}) {
  const canvas = globalThis.document.createElement('canvas');
  const { createStage } = await import('../vendor3d/index.js');
  const stage = createStage({ canvas, container: globalThis.document.body, quality, dprCap: 1, transparent: true, shadows: false, lighting: 'day', fov: 12 });
  if (!stage.supported) return null;
  stage.setSky(null, null);
  const renderer = stage.renderer, scene = stage.scene;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);

  const api = { ok: true, lost: false, canvas, people: 0, quality, ready: false, x0: null, W: 0, pxm: 0, cache: null, heightM: 3.9 };
  stage.onContextLost(() => { api.lost = true; });
  stage.onContextRestored(() => {
    try { const sc = stage.scene, old = sc.environment; if (old) { const pm = new THREE.PMREMGenerator(stage.renderer); sc.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); if (old.dispose) old.dispose(); } } catch { /* keep the old light */ }
    api.lost = false; api.x0 = null;
  });

  // ---- the stands: three timber tiers with a felt-pattern fascia ----
  const wood = new MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 });
  const woodTop = new MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.85 });
  const fascia = new MeshStandardMaterial({ color: 0x8c2f24, roughness: 0.85 });
  const band = new MeshStandardMaterial({ color: 0xe3c36a, roughness: 0.7 });
  const standG = new Group(); scene.add(standG);
  const WMAX = (perTier - 3) * TIERS[0].step, MAXW = WMAX + 4;
  for (let i = 0; i < TIERS.length; i++) {
    const t = TIERS[i];
    const deck = new Mesh(new BoxGeometry(MAXW, t.y + 0.1, 1.05), wood); deck.position.set(0, (t.y - 0.0) / 2 - 0.05, t.z - 0.1); standG.add(deck);
    const top = new Mesh(new BoxGeometry(MAXW, 0.05, 1.05), woodTop); top.position.set(0, t.y, t.z - 0.1); standG.add(top);
    if (i === 0) {
      const fa = new Mesh(new BoxGeometry(MAXW, 0.5, 0.05), fascia); fa.position.set(0, 0.0, t.z + 0.45); standG.add(fa);
      const bd = new Mesh(new BoxGeometry(MAXW, 0.06, 0.06), band); bd.position.set(0, 0.12, t.z + 0.47); standG.add(bd);
    }
  }

  // ---- the people ----
  const fHat = new CylinderGeometry(0.083, 0.108, 0.17, 14, 1, true), dome = new SphereGeometry(0.083, 14, 8, 0, TAU, 0, Math.PI / 2), brimG = new CylinderGeometry(0.118, 0.108, 0.06, 14, 1, true);
  const capG = new SphereGeometry(0.1, 14, 8, 0, TAU, 0, Math.PI * 0.55), furG = new TorusGeometry(0.1, 0.035, 8, 16);
  const scarfG = new SphereGeometry(0.114, 16, 10, Math.PI / 2 + 0.75, TAU - 1.5, 0, Math.PI * 0.7);
  const coatG = new CylinderGeometry(0.17, 0.25, 0.5, 18, 1, true);
  const beltG = new TorusGeometry(0.17, 0.02, 6, 20);
  const felt = new MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.95, side: DoubleSide }), blk = new MeshStandardMaterial({ color: 0x14161c, roughness: 0.8, side: DoubleSide });
  const fur = new MeshStandardMaterial({ color: 0x5a3c26, roughness: 1.0 });

  const rows = TIERS.map(() => []);
  let reqChars = 0;
  const jobs = [];
  for (let r = 0; r < TIERS.length; r++) for (let i = 0, nT = Math.ceil(WMAX / TIERS[r].step) + 3; i < nT; i++) {
    const female = (i + r) % 3 === 1;
    jobs.push((async () => {
      const human = await loadHuman({ character: female ? 'athlete_f' : 'athlete_m', base, lod: 'auto', quality: quality === 'low' ? 'low' : 'medium', kit: { top: '#2f4b3a', bottoms: '#25252a', socks: '#222' }, skin: SKINS[i % SKINS.length], hair: 'black' });
      human.autoLOD = () => {}; human.lodAuto = false;
      try { human.setLOD(quality === 'low' ? 2 : TIERS[r].lod); } catch { /* keep default */ }
      const mats = { coat: new MeshStandardMaterial({ color: 0x335544, roughness: 0.85, side: DoubleSide }), trim: new MeshStandardMaterial({ color: 0xe3c36a, roughness: 0.7 }), hat: new MeshStandardMaterial({ color: 0xf4efe2, roughness: 0.9, side: DoubleSide }) };
      const dressed = dressLimbs(human, { sleeve: 0x335544, trim: 0xe3c36a, trousers: 0x25252a, boot: 0x2a1a10, legs: TIERS[r].legs });
      void dressed;
      human.userData = human.userData || {};
      const sleeveM = human.userData.sleeveM, trimM = human.userData.trimM;
      // headgear: tall felt kalpak / skull cap / fur hat / headscarf (visibility chosen per slot)
      const { q, f, topPt } = headFrame(human);
      const hg = new Group(); hg.quaternion.copy(q); hg.position.copy(topPt).addScaledVector(f.up, -0.04);
      const kal = new Group(); const kc = new Mesh(fHat, mats.hat); kc.position.y = 0.1; const kd = new Mesh(dome, mats.hat); kd.position.y = 0.185; kd.scale.y = 0.8; const kb = new Mesh(brimG, blk); kal.add(kc, kd, kb);
      const cap = new Mesh(capG, mats.hat); cap.position.y = 0.0; cap.scale.y = 0.75;
      const furH = new Group(); { const fc = new Mesh(furG, fur); fc.rotation.x = Math.PI / 2; fc.position.y = 0.04; const top = new Mesh(dome, fur); top.position.y = 0.04; top.scale.set(1.05, 0.9, 1.05); furH.add(fc, top); }
      const scarf = new Mesh(scarfG, mats.hat); scarf.position.y = -0.03; scarf.scale.set(1.0, 1.0, 1.05);
      hg.add(kal, cap, furH, scarf);
      human.bones.Bip01_Head.add(hg);
      // chapan (long coat) hanging from the waist, with a sash
      human.root.updateMatrixWorld(true);
      const rq = human.bones.Bip01_Pelvis.getWorldQuaternion(new Quaternion()).invert();
      const fr = { up: new Vector3(0, 1, 0).applyQuaternion(rq), fwd: new Vector3(0, 0, 1).applyQuaternion(rq), left: new Vector3(1, 0, 0).applyQuaternion(rq) };
      const cg = new Group(); cg.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(fr.left.normalize(), fr.up.normalize(), fr.fwd.normalize()));
      const skirt = new Mesh(coatG, mats.coat); skirt.position.set(0, -0.2, 0); skirt.scale.set(1, 1, 0.85);
      const sash = new Mesh(beltG, trimM); sash.rotation.x = Math.PI / 2; sash.position.set(0, 0.06, 0); sash.scale.set(1, 0.85, 1);
      cg.add(skirt, sash);
      human.bones.Bip01_Pelvis.add(cg);
      const person = { human, mats, sleeveM, trimM, kal, cap, furH, scarf, female, row: r, slot: null, clip: '', t0: 0, scaleY: 1 };
      human.root.visible = false;
      scene.add(human.root);
      rows[r].push(person);
      reqChars++;
    })());
  }
  await Promise.all(jobs);
  api.people = reqChars;
  for (const row of rows) row.sort((a, b) => a.human.root.id - b.human.root.id);

  // ---- per-slot look ----
  const C = (h) => new Color(h);
  function dress(p, slot, r) {
    const h = hash(slot * 7 + r * 131), h2 = hash(slot * 3.3 + r * 17), h3 = hash(slot * 5.9 + r * 71);
    const age = h3 < 0.12 ? 'child' : h3 > 0.8 ? 'elder' : 'adult';
    const coat = (p.female ? COATS_F : COATS_M)[Math.floor(h * 997) % (p.female ? COATS_F.length : COATS_M.length)];
    const trim = TRIMS[Math.floor(h2 * 991) % TRIMS.length];
    const hum = p.human;
    hum.setKit({ top: coat, bottoms: p.female ? coat : '#25252a' });
    hum.setSkin(SKINS[Math.floor(h2 * 77) % SKINS.length]);
    hum.setHair(age === 'elder' ? (h > 0.5 ? 'grey' : 'white') : HAIR[Math.floor(h * 31) % HAIR.length]);
    p.mats.coat.color.copy(C(coat)).multiplyScalar(0.92);
    p.sleeveM.color.copy(C(coat)).multiplyScalar(0.96);
    p.trimM.color.copy(C(trim));
    p.mats.hat.color.copy(C(p.female ? (h2 > 0.5 ? '#f1ece0' : trim) : age === 'elder' ? '#f4efe2' : (h > 0.5 ? '#f4efe2' : '#2a2a2e')));
    const kind = p.female ? (h2 < 0.65 ? 'scarf' : 'none') : (h < 0.5 ? 'kalpak' : h < 0.72 ? 'cap' : h < 0.88 ? 'fur' : 'none');
    p.kal.visible = kind === 'kalpak'; p.cap.visible = kind === 'cap'; p.furH.visible = kind === 'fur'; p.scarf.visible = kind === 'scarf';
    if (kind === 'kalpak') p.mats.hat.color.set('#f4efe2');
    const sc = age === 'child' && r === 0 ? 0.72 : age === 'child' ? 0.82 : p.female ? 0.97 : 0.97 + h2 * 0.1;
    p.scale = sc;
    p.yaw = (h - 0.5) * 0.7;
    p.speed = 0.85 + h2 * 0.3;
    p.react = h3 * 0.7;              // reaction lag after a goal (s)
    p.kind = h2 > 0.6 ? 'clap' : 'cheer';
    p.idleName = h > 0.5 ? 'idle_relaxed' : 'idle';
    p.phase = h2;
  }

  // ---- render ----
  const cam = new OrthographicCamera(-10, 10, 2, -2, 0.1, 80);
  let acc = 1, lastKey = '', tick = 0;
  /**
   * Update + render the stretch of the stands around world x `cx`, `spanM` metres wide, at `pxm` px per metre.
   * cheer: 0..1 (goal roar); returns true when the canvas holds a fresh picture.
   */
  api.render = (dt, cx, spanM, pxm, cheer) => {
    if (api.lost) return false;
    const step = TIERS[0].step;
    const W = Math.min(WMAX, Math.max(8, spanM + 2 * step));
    const x0 = Math.floor((cx - W / 2) / step) * step;
    const wpx = Math.round(W * pxm), hpx = Math.round(api.heightM * pxm);
    const key = `${x0}|${wpx}|${hpx}`;
    acc += dt;
    const period = quality === 'low' ? 1 / 10 : cheer > 0.05 ? 1 / 30 : 1 / 15;
    if (key === lastKey && acc < period) return false;
    const step_dt = Math.min(acc, 0.1); acc = 0; lastKey = key; tick++;
    renderer.setPixelRatio(1);
    if (canvas.width !== wpx || canvas.height !== hpx) renderer.setSize(wpx, hpx, false);
    // camera: front view, a little from above; vertical range covers the three tiers
    const H = api.heightM, ct = Math.cos(0.14);
    cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2 / ct; cam.bottom = -H / 2 / ct;
    cam.position.set(x0 + W / 2, 1.65 + 8 * Math.sin(0.14), 8 * Math.cos(0.14));
    cam.lookAt(x0 + W / 2, 1.65, 0);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // stands follow the strip
    standG.position.x = x0 + W / 2;
    // assign slots
    for (let r = 0; r < TIERS.length; r++) {
      const T = TIERS[r], row = rows[r], n = Math.min(row.length, Math.ceil(W / T.step) + 1);
      const s0 = Math.floor(x0 / T.step);
      for (const p of row) p.human.root.visible = false;
      for (let k = 0; k < n; k++) {
        const slot = s0 + k, p = row[mod(slot, row.length)];
        if (p.slot !== slot) { p.slot = slot; dress(p, slot, r); p.clip = ''; }
        const jx = (hash(slot * 1.7 + r * 9) - 0.5) * T.step * 0.35;
        const root = p.human.root;
        root.position.set(slot * T.step + jx + (r % 2) * T.step * 0.5, T.y + 0.04, T.z + (hash(slot + r * 5) - 0.5) * 0.25);
        root.rotation.y = p.yaw;
        root.scale.setScalar(p.scale);
        root.visible = true;
        // clip: idle, or a reaction a moment after the goal; crossfades keep it smooth
        const want = cheer > 0.05 && (cheer * 3 > p.react) ? p.kind : p.idleName;
        if (want !== p.clip) {
          try { p.human.play(want, { fade: 0.3, speed: want === p.idleName ? p.speed : 1, startPhase: p.phase }); } catch { /* clip missing: keep the last */ }
          p.clip = want;
        }
        p.human.update(step_dt);
      }
    }
    renderer.render(scene, cam);
    // keep a copy: the WebGL canvas cannot be read after it is composited
    if (!api.cache) api.cache = globalThis.document.createElement('canvas');
    if (api.cache.width !== wpx || api.cache.height !== hpx) { api.cache.width = wpx; api.cache.height = hpx; }
    const g = api.cache.getContext('2d'); g.clearRect(0, 0, wpx, hpx); g.drawImage(canvas, 0, 0);
    api.x0 = x0; api.W = W; api.pxm = pxm; api.ready = true;
    return true;
  };
  /** Blit the cached strip so that world x lands at screen sx(x) = ax0 + (x - cx) * ppm, bottom edge at yBase. */
  api.blit = (ctx, ax0, cx, ppm, yBase) => {
    if (!api.ready || !api.cache) return;
    const s = ppm / api.pxm;
    const sx = ax0 + (api.x0 - cx) * ppm;
    ctx.drawImage(api.cache, 0, 0, api.cache.width, api.cache.height, sx, yBase - api.cache.height * s, api.cache.width * s, api.cache.height * s);
  };
  void Vector3;
  return api;
}
