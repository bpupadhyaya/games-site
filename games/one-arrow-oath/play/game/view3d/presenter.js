// One Arrow Oath 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js items:
// element constructs and spirit bows, with the screen spot and size the 2D layout gave them), never writes game state. One WebGL canvas
// sits behind the kit's transparent 2D canvas: a night plateau of wind-towers under a big moon. Every item is placed in camera space at
// its screen position, so portrait, landscape bands and Auto Play layouts all line up and taps stay exactly where the 2D layer put them.
// No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { makeMats, buildSky, buildStars, buildMoon, buildLand, buildMotes, buildPlatform, buildCrystal, buildBow, buildConstruct, buildStorm, buildIslet, radialTex, elCol, GOLD, TAU } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2 }, { name: 'medium', dpr: 1.5 }, { name: 'low', dpr: 1 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const FOV = 30, D = 30, PITCH = 0.1;

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040f);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 3000);
  camera.rotation.order = 'YXZ'; camera.rotation.x = PITCH; scene.add(camera);
  const mats = makeMats();
  // lights ride the camera, so every item is lit the same way whatever its screen spot: cool moon key from the upper right, warm rim from behind
  const hemi = new THREE.HemisphereLight(0x5a6ac0, 0x120a24, 0.45); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xaebcff, 2.3); key.position.set(5, 8, 7); camera.add(key); camera.add(key.target); key.target.position.set(0, 0, -D);
  const rim = new THREE.DirectionalLight(0xffb070, 1.6); rim.position.set(-6, 1, -9); camera.add(rim); rim.target.position.set(0, 0, -D); camera.add(rim.target);
  const fill = new THREE.PointLight(0xffd68c, 0, 40, 1); fill.position.set(0, 1, -D + 6); camera.add(fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const sky = buildSky(); camera.add(sky); sky.rotation.x = -PITCH * 0; // dome follows the camera
  const stars = buildStars(); camera.add(stars);
  const moon = buildMoon(); camera.add(moon);
  await tick();
  const land = buildLand(mats); scene.add(land);
  const towers = land.userData.towers, ridge = land.userData.layers[2], LZ = ridge.z;
  const ridgeY = (x) => { const p = ridge.pts, i = clamp(Math.floor((x - p[0][0]) / ridge.step), 0, p.length - 2), a = p[i], b = p[i + 1]; return a[1] + (b[1] - a[1]) * clamp((x - a[0]) / (b[0] - a[0] || 1), 0, 1); };
  towers.forEach((t) => { t.scale.setScalar(0.3); t.position.z = LZ + 3; scene.add(t); });
  const motes = buildMotes(); camera.add(motes);
  const islets = [[-0.92, 0.18, -70, 1.9, 1], [0.95, 0.38, -80, 1.6, 2]].map(([fx, fy, z, s, seed]) => { const g = buildIslet(mats, seed); g.userData.cfg = { fx, fy, z, s }; camera.add(g); return g; });
  await tick();

  const pool = new Map(), shadowTex = radialTex('0,0,8', 0.75, 64);
  const shadow = () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, fog: false })); m.renderOrder = 1; return m; };

  // ---------------------------------------------------------------- items
  function makeItem(it) {
    const holder = new THREE.Group(); camera.add(holder);
    const rec = { holder, sig: '', seen: 0, born: clock, last: null };
    if (it.kind === 'bow') {
      const body = new THREE.Group(), pool3 = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('255,200,120', 0.55, 128), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })), tilt = new THREE.Group(), platform = it.tint ? null : buildPlatform(mats), bow = buildBow(mats, it.tint ? 0x9f8cff : null), crystal = buildCrystal(mats), sh = shadow();
      if (platform) tilt.add(platform);
      tilt.rotation.x = 0.36; body.add(tilt); body.add(bow); if (platform) body.add(crystal);
      holder.add(sh, body);
      if (platform) holder.add(pool3);
      Object.assign(rec, { body, tilt, platform, bow, crystal, sh, pool3 });
    } else if (it.kind === 'storm') {
      const s = buildStorm(mats); holder.add(s.group); Object.assign(rec, { c: s, sh: null });
    } else {
      const c = buildConstruct(mats, it), sh = shadow(); holder.add(sh, c.group); Object.assign(rec, { c, sh });
    }
    return rec;
  }
  const sigOf = (it) => `${it.kind}|${it.shape}|${it.element}|${it.act}|${it.boss}|${it.elite}|${it.decoy}|${it.tint ? 1 : 0}`;
  const tanH = Math.tan(FOV * Math.PI / 360);
  let clock = 0, frame = 0, W = 1, H = 1;
  function updateItems() {
    frame++;
    const wpp = (2 * D * tanH) / H;
    for (const it of v3.items) {
      if (it.kind === 'moon') continue;
      const key2 = `${it.kind}${it.id}`;
      let rec = pool.get(key2);
      const sg = sigOf(it);
      if (rec && rec.sig !== sg) { camera.remove(rec.holder); pool.delete(key2); rec = null; }
      if (!rec) { rec = makeItem(it); rec.sig = sg; pool.set(key2, rec); }
      rec.seen = frame; rec.visible = true;
      const S = it.r * it.px * wpp, x = ((it.sx / W) * 2 - 1) * D * tanH * (W / H), y = -((it.sy / H) * 2 - 1) * D * tanH;
      rec.holder.position.set(x, y, -D); rec.holder.scale.setScalar(S); rec.holder.visible = true;
      rec.last = { S, x, y, flash: it.flash ?? 0 };
      const id = it.id * 1.7 + (it.kind === 'enemy' ? 0 : 3);
      if (it.kind === 'bow') {
        rec.bow.userData.setPull(clamp(it.pull ?? 0, 0, 1));
        const down = it.aimDown, lift = it.lift / (it.r);   // lift in units
        rec.body.scale.x = it.flip ? -1 : 1;
        const base = rec.platform ? -0.1 + lift : 0.4;
        rec.tilt.position.y = base;
        const bobY = Math.sin(clock * 1.4) * 0.01;
        rec.bow.position.set(0, base + 1.25 + bobY, 0.1); rec.bow.rotation.z = down ? Math.PI : 0;
        if (down) { rec.bow.position.y = base + 0.4; rec.bow.rotation.z = Math.PI; }
        rec.crystal.visible = !!rec.platform && it.floating; rec.crystal.position.set(0, base - 0.33, 0); rec.crystal.rotation.y = clock * 1.3;
        const fl = it.floating ? 1 : 0.6;
        rec.sh.position.set(0.12, rec.platform ? -0.1 - 0.5 - (it.floating ? 0.1 : 0) : -1.2, -0.3); rec.sh.scale.set(2.4, 0.5, 1); rec.sh.material.opacity = 0.55 * fl;
        if (rec.platform) { rec.pool3.position.set(0, base - 0.55, -0.2); rec.pool3.scale.set(3.6, 1.1, 1); rec.pool3.material.opacity = it.floating ? 0.5 : 0.25; }
        rec.bow.userData.glow.material.opacity = 0.5 + 0.5 * clamp(it.pull ?? 0, 0, 1);
      } else if (it.kind === 'storm') {
        rec.c.update(clock, it.id, it.flash ?? 0, it);
      } else {
        rec.c.update(clock, id, it.flash ?? 0, it);
        rec.sh.position.set(0.12, -1.3, -0.4); rec.sh.scale.set(2.1, 0.5, 1); rec.sh.material.opacity = it.decoy ? 0.3 : 0.5;
      }
    }
    for (const [k, rec] of pool) {
      if (rec.seen === frame) continue;
      // gone this frame (a slain construct): shrink out quickly, then free
      const age = frame - rec.seen;
      if (rec.last && age < 14) { rec.holder.scale.setScalar(rec.last.S * (1 - age / 14)); rec.c?.update?.(clock, 0, 1, {}); } else { camera.remove(rec.holder); pool.delete(k); }
    }
  }

  function placeEnv(t) {
    const asp = W / H, hw = Math.tan(FOV * Math.PI / 360) * asp * Math.abs(LZ) * 1.0;
    towers.forEach((tw, i) => {
      const f = (i / (towers.length - 1)) * 2 - 1, x = f * hw * 1.18;
      tw.position.set(x, ridgeY(x) - 2, LZ + 3);
      const hub = tw.userData.hub; hub.rotation.z = t * 0.5 + tw.userData.ph;
    });
  }

  // moon: big beside the wordmark on the title, tucked into the corner everywhere else (the 2D sky pass reports where and how big)
  function updateMoon(dt) {
    const m = v3.items.find((i) => i.kind === 'moon');
    if (!m) return;
    const z = 700, wpp = (2 * z * tanH) / H, r = m.r * m.px * wpp;
    const tx = ((m.sx / W) * 2 - 1) * z * tanH * (W / H), ty = -((m.sy / H) * 2 - 1) * z * tanH;
    const k = 1 - Math.exp(-dt * 5), cur = moon.userData;
    if (!cur.init) { cur.init = true; moon.position.set(tx, ty, -z); moon.scale.setScalar(r); }
    moon.position.x += (tx - moon.position.x) * k; moon.position.y += (ty - moon.position.y) * k; moon.position.z = -z; moon.scale.setScalar(moon.scale.x + (r - moon.scale.x) * k);
  }

  function applyTier() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr));
    stars.material.uniforms.px.value = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    motes.material.uniforms.px.value = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    sizeKey = '';
  }
  let sizeKey = '';
  applyTier();

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, tintCol = new THREE.Color(0x000000), tintK = 0;
  function pre() {
    if (!game || lost) return;
    v3.items.length = 0; v3.tint = null;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const st = game.getState(), title = st.scene === 'title';
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    const sk = `${W}x${H}`;
    if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); }
    camera.rotation.y = (title ? 0.045 : 0.02) * Math.sin(clock * 0.19);
    camera.updateMatrixWorld(true);
    placeEnv(clock);
    updateMoon(dt);
    updateItems();
    for (const g of islets) {
      const { fx, fy, z, s } = g.userData.cfg, ph = g.userData.ph;
      g.position.set(fx * Math.abs(z) * tanH * (W / H), fy * Math.abs(z) * tanH + Math.sin(clock * 0.5 + ph) * 0.35, z); g.scale.setScalar(s); g.rotation.set(0.12, clock * 0.05 + ph, Math.sin(clock * 0.3 + ph) * 0.04);
    }
    // horizon colour of whatever you are fighting
    const goal = v3.tint ? new THREE.Color(v3.tint) : null;
    tintK += ((goal ? 1 : 0) - tintK) * (1 - Math.exp(-dt * 3)); if (goal) tintCol.lerp(goal, 1 - Math.exp(-dt * 4));
    const hz = land.userData.horizon.material; hz.color.setRGB(1, 1, 1).lerp(tintCol, tintK * 0.9); hz.opacity = 0.55 + tintK * 0.25;
    stars.material.uniforms.t.value = clock;
    // drifting motes
    const mp = motes.geometry.attributes.position, { seed, count } = motes.userData, mw = D * tanH * (W / H) * 1.1;
    for (let i = 0; i < count; i++) { const s = seed[i], k = (clock * s.sp + s.ph) % 1; mp.setXYZ(i, ((s.x * 2 - 1) + Math.sin(clock * 0.6 + s.ph * 9) * 0.04 * s.sw) * mw, (-0.95 + k * 1.7) * D * tanH, -D * (0.55 + s.z * 0.9)); }
    mp.needsUpdate = true; motes.material.uniforms.col.value.set(goal ? tintCol : new THREE.Color(GOLD));
    // fill light follows the archer
    const bow = [...pool.values()].find((r) => r.bow && r.platform);
    fill.intensity = bow ? 7 : 0; if (bow) fill.position.set(bow.last.x, bow.last.y + 1.5, -D + 5);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; });

  await tick();
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight); camera.aspect = W / H; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
  try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
}
