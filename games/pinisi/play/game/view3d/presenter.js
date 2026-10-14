// Pinisi 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a golden-hour sea with the Maluku archipelago as lit islands, the real 3D pinisi, and the Bira beach yard
// with shipwrights. The 2D layer keeps drawing every control and label (projected through v3.proj onto the 3D chart).
// Fallbacks: no WebGL or lost context -> v3.on = false and every screen draws the flat 2D art; context restored -> back to 3D.
import { createStage, THREE, board3d } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { layoutFor } from '../src/layout.js';
import { PORTS, windAt, edges } from '../src/engine.js';
import { clamp, lerp, TAU } from './util.js';
import { createSky, createSea, bakeShore, createWake, createPoints, seaHeight } from './sea.js';
import { buildIsland, islandMaterial } from './island.js';
import { buildPinisi } from './ship.js';
import { createYard } from './yard.js';

const { Group, Mesh, Vector3, MeshBasicMaterial, PlaneGeometry, CanvasTexture, SRGBColorSpace } = THREE;
const WORLD = 100;                     // chart unit -> world units
const SHIP_MAP_SCALE = 0.7;
const ISLAND_K = 2.1;                  // island radius multiplier over the 2D chart radius
const DECOR = [[0.16, 0.38, 0.02], [0.52, 0.5, 0.025], [0.62, 0.62, 0.016], [0.9, 0.82, 0.02], [0.14, 0.97, 0.018], [0.85, 0.12, 0.02], [0.3, 0.3, 0.024], [0.58, 0.12, 0.014], [0.95, 0.4, 0.018]];
const portSeed = (i) => (i * 7 + 3) % 11 + 1;

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'evening', shadows: true }); } catch (e) { console.warn('stage failed', e); stage = null; }
  if (!stage || !stage.supported) { canvas.remove(); return { ok: false, stage: null, wrap: (g) => g }; }

  const scene = stage.scene, camera = stage.camera;
  camera.near = 0.3; camera.far = 2500; camera.fov = 32; camera.updateProjectionMatrix();
  scene.background = null; scene.fog = null;

  await tick();
  // ---- lights: low golden sun, warm sky bounce, cool rim -----------------------------------------------------------------
  const { hemi, key, rim } = stage.lights;
  hemi.color.set('#ffdcb4'); hemi.groundColor.set('#1f5c66'); hemi.intensity = 0.95;
  key.color.set('#ffc589'); key.intensity = 3.6;
  rim.color.set('#8fb8ff'); rim.intensity = 0.9;
  const keyDir = new Vector3(-0.5, 0.62, -0.58).normalize();
  stage._shadowOffset.copy(keyDir).multiplyScalar(26);
  key.shadow.camera.left = key.shadow.camera.bottom = -18; key.shadow.camera.right = key.shadow.camera.top = 18; key.shadow.camera.near = 1; key.shadow.camera.far = 90;
  key.shadow.camera.updateProjectionMatrix();

  await tick();
  // ---- sky + sea + islands ----------------------------------------------------------------------------------------------------
  const sky = createSky(); scene.add(sky.mesh);
  const portsW = PORTS.map((p, i) => ({ x: p.x * WORLD, z: p.y * WORLD, R: Math.max(p.r * WORLD * ISLAND_K, 4.2), seed: portSeed(i) }));
  const decorW = DECOR.map(([x, y, r], i) => ({ x: x * WORLD, z: y * WORLD, R: r * WORLD * ISLAND_K * 1.1, seed: 40 + i }));
  const shore = bakeShore([...portsW, ...decorW]);
  const sea = createSea(shore); scene.add(sea.mesh);
  const windUni = { uWindT: { value: 0 }, uWindK: { value: 1 } };
  const imat = islandMaterial(windUni);
  const world = new Group(); scene.add(world);                     // chart world (voyage / title / result)
  const islands = [];
  portsW.forEach((p, i) => {
    const kind = PORTS[i].id === 'ternate' ? 'volcano' : 'port';
    const toward = Math.atan2(WORLD * 0.5 - p.z, WORLD * 0.5 - p.x);     // jetty faces the middle of the chart
    const g = buildIsland({ R: p.R, seed: p.seed, kind, jetty: toward }, imat);
    g.position.set(p.x, 0, p.z); world.add(g); islands.push({ g, p, i, jettyAng: toward });
  });
  decorW.forEach((p) => { const g = buildIsland({ R: p.R, seed: p.seed, kind: 'islet' }, imat); g.position.set(p.x, 0, p.z); world.add(g); });

  await tick();
  // ---- the ship on the chart + wake ---------------------------------------------------------------------------------------------
  let ship = null, shipKey = '';
  const shipWrap = new Group(); world.add(shipWrap);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,15,25,0.7)'); g.addColorStop(0.6, 'rgba(0,15,25,0.3)'); g.addColorStop(1, 'rgba(0,15,25,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t; })();
  const hullShadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); hullShadow.rotation.x = -Math.PI / 2; hullShadow.position.y = 0.04; hullShadow.renderOrder = -2;
  world.add(hullShadow);
  const wake = createWake(); world.add(wake.mesh);
  const spray = createPoints(60, 0.9, 0xffffff, 0.5); world.add(spray);
  const sprayP = Array.from({ length: 60 }, () => ({ x: 0, y: -5, z: 0, vx: 0, vy: 0, vz: 0, life: 0 }));
  const smoke = createPoints(26, 3.4, 0x9a8a7a, 0.3); world.add(smoke);
  const rings = PORTS.map((p, i) => { const r = board3d.glowRing(portsW[i].R * 1.55, '#ffe08a'); r.position.set(portsW[i].x, 0.25, portsW[i].z); r.visible = false; world.add(r); return r; });

  function ensureShip(spec) {
    const k = `${spec.size}|${spec.timber}|${spec.rig}`;
    if (ship && k === shipKey) return ship;
    if (ship) { shipWrap.remove(ship.root); ship.dispose?.(); }
    ship = buildPinisi({ size: spec.size, timber: spec.timber, rig: spec.rig }); shipKey = k;
    shipWrap.add(ship.root);
    return ship;
  }
  ensureShip({ size: 'pinisi', timber: 'teak', rig: 'balanced' });

  // ship dynamics (smoothed, presentation only)
  const sd = { x: 0.3 * WORLD, z: 0.55 * WORLD, vx: 0, vz: 0, heading: 0, init: false, anchorDir: PORTS.map((_, i) => islands[i].jettyAng) };
  const smoothDamp = (cur, tgt, vel, st, dt) => { const w = 2 / st, x = w * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x); const d = cur - tgt, tmp = (vel + w * d) * dt; return { v: (vel - w * tmp) * e, p: tgt + (d + tmp) * e }; };
  const angLerp = (a, b, k) => { const d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + d * k; };

  await tick();
  // ---- camera framing -----------------------------------------------------------------------------------------------------------
  let VW = 720, VH = 1280;
  function frameRect(rect) {          // shift the principal point so what the camera looks at lands at the centre of `rect` (virtual units)
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    camera.aspect = VW / VH;
    camera.setViewOffset(VW, VH, VW / 2 - cx, VH / 2 - cy, VW, VH);
    camera.updateMatrixWorld(true);
  }
  const projectV = (x, y, z) => {
    const v = new Vector3(x, y, z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * VW, y: (0.5 - v.y * 0.5) * VH };
  };

  await tick();
  // ---- yard (beach + hull in progress + shipwrights) ---------------------------------------------------------------------------------
  let yard = null;
  const yardGroup = new Group(); scene.add(yardGroup); yardGroup.visible = false;
  createYard({ scene: yardGroup, stage, windUni, camera }).then((y) => { yard = y; }).catch((e) => console.warn('yard failed', e));

  await tick();
  // ---- frame ---------------------------------------------------------------------------------------------------------------------
  let lastT = null, camA = 0, tTitle = 0, ftEma = 8, ftCount = 0, tier = quality;

  function setCameraVoyage(L) {
    const M = L.voy.map, s = Math.min(M.w, M.h) * (1 - 0.14);
    const fov = camera.fov * Math.PI / 180, elev = 58 * Math.PI / 180;
    const D = WORLD * (VH / 2) / (s * Math.tan(fov / 2));
    const tx = 0.5 * WORLD, tz = 0.5 * WORLD;
    camera.position.set(tx, Math.sin(elev) * D, tz + Math.cos(elev) * D);
    camera.lookAt(tx, 0, tz);
    frameRect(M);
  }

  function frame(game, view) {
    const s = game.getState();
    VW = view?.width ?? 720; VH = view?.height ?? 1280;
    const L = layoutFor(VW, VH);
    let dt = lastT === null ? 0 : s.t - lastT; lastT = s.t; dt = clamp(dt, 0, 0.1);
    const t = s.t, sc = s.scene, calm = s.prefs.calm;
    v3.scene = sc;
    const docs = sc === 'about' || sc === 'howto' || sc === 'rules' || sc === 'settings';
    stage.setVisible(!docs);
    v3.proj = null;
    if (docs) return;

    let wind = { dir: 0.3, str: 0.7, squall: false };
    if (s.pl?.v && (sc === 'voyage' || sc === 'result')) wind = windAt(s.pl.v);
    sea.uni.uTime.value = t * (calm ? 0.4 : 1); sea.uni.uCalm.value = calm ? 1 : clamp(1 - wind.str, 0, 0.6) * 0.6; sea.uni.uChop.value = 0.6 + 0.6 * wind.str;
    sky.uni.uTime.value = t; sky.uni.uCloud.value = wind.squall ? 0.95 : 0.55;
    windUni.uWindT.value = t * (calm ? 0.3 : 1); windUni.uWindK.value = 0.6 + wind.str * 0.6;

    const inYard = sc === 'yard';
    sea.uni.uFogK.value = sc === 'voyage' ? 0.00012 : 0.0011;
    world.visible = !inYard; yardGroup.visible = inYard;
    const exposure = wind.squall ? 0.78 : 1.0;
    stage.renderer.toneMappingExposure = lerp(stage.renderer.toneMappingExposure, exposure, 1 - Math.exp(-dt * 2));

    if (inYard) {
      if (yard) yard.update(dt, t, s, L, { camera, frameRect, VW, VH, calm });
      stage.setShadowTarget(0, 0, 0);
    } else {
      const pl = s.pl, v = pl?.v;
      const spec = (v && (sc === 'voyage' || sc === 'result')) ? v.ship : { size: 'pinisi', timber: 'teak', rig: 'balanced' };
      ensureShip(spec);
      let tx, tz, head = sd.heading, setting = 'anchor', moving = 0;
      const title = sc === 'title' || sc === 'setup' || sc === 'demo-limit';
      if (title) {
        tTitle += dt;
        tx = 122 + Math.sin(tTitle * 0.05); tz = 62 + Math.cos(tTitle * 0.04); head = -0.9 + Math.sin(tTitle * 0.07) * 0.08; setting = 'full'; moving = 0.55;
        sd.x = tx; sd.z = tz; sd.heading = head; sd.init = true;
      } else if (v) {
        const R = (i) => portsW[i].R;
        if (pl.leg) {
          const a = pl.leg.from, b = pl.leg.to, A = portsW[a], B = portsW[b], dx = B.x - A.x, dz = B.z - A.z, Ld = Math.hypot(dx, dz), ux = dx / Ld, uz = dz / Ld;
          const offA = R(a) * 1.15 + 4, offB = R(b) * 1.15 + 4, u = clamp(pl.dispProg / pl.leg.dist, 0, 1);
          const dist = offA + (Ld - offA - offB) * u;
          tx = A.x + ux * dist; tz = A.z + uz * dist;
          head = Math.atan2(dz, dx); setting = pl.lastSetting || 'full'; moving = setting === 'anchor' ? 0 : 1;
          sd.anchorDir[b] = Math.atan2(-uz, -ux); sd.anchorDir[a] = Math.atan2(uz, ux);
        } else {
          const i = v.loc, P = portsW[i];
          let ang = sd.anchorDir[i];
          const hasSel = pl.sel !== null && pl.sel !== undefined && pl.sel !== i;
          if (hasSel) ang = Math.atan2(portsW[pl.sel].z - P.z, portsW[pl.sel].x - P.x);
          const off = R(i) * 1.15 + 4;
          tx = P.x + Math.cos(ang) * off; tz = P.z + Math.sin(ang) * off;
          head = (hasSel ? ang : sd.heading) + Math.sin(t * 0.3 + i) * 0.04; setting = 'anchor'; moving = 0;
        }
        if (!sd.init) { sd.x = tx; sd.z = tz; sd.heading = head; sd.init = true; }
        const sx = smoothDamp(sd.x, tx, sd.vx, 0.35, dt || 0.016), sz = smoothDamp(sd.z, tz, sd.vz, 0.35, dt || 0.016);
        sd.x = sx.p; sd.vx = sx.v; sd.z = sz.p; sd.vz = sz.v;
        sd.heading = angLerp(sd.heading, head, 1 - Math.exp(-(dt || 0.016) * (moving ? 2.2 : 1.2)));
      } else { sd.x = 0.3 * WORLD; sd.z = 0.55 * WORLD; }

      const wd = wind.dir, h = sd.heading;
      const side = Math.sign(Math.sin(wd - h)) || 1;
      const rel = Math.abs(((wd - h + Math.PI) % TAU + TAU) % TAU - Math.PI);
      const strUse = title ? 0.8 : wind.str;
      ship.update(t, { setting, side, rel, str: strUse, dt });
      const sw = ship.length * SHIP_MAP_SCALE * 0.45, c = Math.cos(h), sn = Math.sin(h), st = t * (calm ? 0.4 : 1);
      const hb = seaHeight(sd.x + c * sw, sd.z + sn * sw, st), ha = seaHeight(sd.x - c * sw, sd.z - sn * sw, st), hm = seaHeight(sd.x, sd.z, st);
      const pitch = Math.atan2(hb - ha, sw * 2), hp = seaHeight(sd.x - sn * 1.2, sd.z + c * 1.2, st), hs = seaHeight(sd.x + sn * 1.2, sd.z - c * 1.2, st);
      const roll = Math.atan2(hp - hs, 2.4) * 0.8;
      shipWrap.position.set(sd.x, hm * 0.55 + 0.18, sd.z);
      ship.root.rotation.set(roll, -h, pitch, 'YXZ');
      ship.root.scale.setScalar(SHIP_MAP_SCALE);
      hullShadow.position.set(sd.x, 0.05, sd.z); hullShadow.rotation.z = h; hullShadow.scale.set(ship.length * SHIP_MAP_SCALE * 1.15, ship.beam * SHIP_MAP_SCALE * 1.2, 1);
      const sternX = sd.x - c * ship.length * SHIP_MAP_SCALE * 0.46, sternZ = sd.z - sn * ship.length * SHIP_MAP_SCALE * 0.46;
      wake.update(dt, t, sternX, sternZ, h, moving * clamp(0.35 + strUse * 0.6, 0, 1), ship.beam * SHIP_MAP_SCALE * 0.32);
      if (moving > 0 && !calm) {
        for (let n = 0; n < 2; n++) {
          const p = sprayP.find((q) => q.life <= 0); if (!p) break;
          const bx = sd.x + c * ship.length * SHIP_MAP_SCALE * 0.5, bz = sd.z + sn * ship.length * SHIP_MAP_SCALE * 0.5, sgn = n ? 1 : -1;
          p.x = bx - sn * sgn * 0.5; p.z = bz + c * sgn * 0.5; p.y = 0.25; p.vx = c * 1.2 - sn * sgn * 2.2; p.vz = sn * 1.2 + c * sgn * 2.2; p.vy = 2.2 + Math.random() * 1.2; p.life = 0.8;
        }
      }
      { const P = spray.geometry.attributes.position.array; sprayP.forEach((p, i) => { if (p.life > 0) { p.life -= dt; p.vy -= 7 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y += p.vy * dt; } P[i * 3] = p.x; P[i * 3 + 1] = p.life > 0 ? Math.max(0.05, p.y) : -50; P[i * 3 + 2] = p.z; }); spray.geometry.attributes.position.needsUpdate = true; }
      { const ti = PORTS.findIndex((q) => q.id === 'ternate'), P = smoke.geometry.attributes.position.array, T = portsW[ti];
        for (let i = 0; i < 26; i++) { const u = ((t * 0.07 + i / 26) % 1); P[i * 3] = T.x + Math.sin(i * 2.3) * 0.6 + u * 3.2; P[i * 3 + 1] = 7.2 + u * 9; P[i * 3 + 2] = T.z + Math.cos(i * 1.7) * 0.6 - u * 1.4; }
        smoke.geometry.attributes.position.needsUpdate = true; }
      rings.forEach((r, i) => {
        let on = false;
        if (sc === 'voyage' && v && v.at === 'port' && !pl.leg) {
          const near = i !== v.loc && edges.some((e) => (e.a === v.loc && e.b === i) || (e.b === v.loc && e.a === i));
          on = near || i === v.loc; const sel = pl.sel === i;
          r.setColor(i === v.loc ? '#7fe3d2' : '#ffe08a');
          r.pulse(t, sel ? 5 : 2.2); r.material.opacity = sel ? 1 : near ? 0.7 : 0.5;
          if (sel) r.scale.multiplyScalar(1.1);
        }
        r.visible = on;
      });
      stage.setShadowTarget(sd.x, 0, sd.z);

      if (sc === 'voyage') {
        setCameraVoyage(L);
        v3.proj = (cx, cy) => projectV(cx * WORLD, 0.2, cy * WORLD);
      } else {
        camA += dt * 0.05 * (calm ? 0.3 : 1);
        const fl = ship.length * SHIP_MAP_SCALE;
        const target = new Vector3(sd.x, ship.topHeight * SHIP_MAP_SCALE * 0.36, sd.z);
        const rect = sc === 'title' ? L.title.hero : sc === 'setup' ? L.setup.hero : { x: 0, y: 0, w: VW, h: VH };
        const aspect = rect.w / Math.max(1, rect.h);
        const tanH = Math.tan(camera.fov * Math.PI / 360), hh = ship.topHeight * SHIP_MAP_SCALE + 2.5, ww = fl * 1.15;
        const dist = Math.max(hh / (0.86 * (rect.h / VH) * tanH * 2), ww / (0.86 * (rect.w / VW) * tanH * 2 * (VW / VH)), fl * 1.6);
        const az = (sc === 'setup' ? 2.4 : sc === 'result' ? 0.7 : 0.55) + head + Math.sin(camA) * 0.3;
        const el = (sc === 'title' ? 12 : sc === 'setup' ? 16 : 14) * Math.PI / 180;
        camera.position.set(target.x + Math.cos(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist + 0.4, target.z + Math.sin(az) * Math.cos(el) * dist);
        camera.lookAt(target);
        frameRect(rect);
      }
    }
    sea.mesh.position.set(Math.round(camera.position.x / 20) * 20, 0, Math.round(camera.position.z / 20) * 20);
    sky.mesh.position.copy(camera.position);

    const t0 = performance.now();
    stage.update(dt);
    const ms = performance.now() - t0;
    ftEma = ftEma * 0.95 + ms * 0.05; ftCount++;
    if (ftCount > 150 && ftEma > 14 && tier === 'high') { tier = 'medium'; stage.setQuality('medium'); ftEma = 8; ftCount = 0; }
    else if (ftCount > 150 && ftEma > 14 && tier === 'medium') { tier = 'low'; stage.setQuality('low'); ftEma = 8; ftCount = 0; }
  }

  const api = {
    ok: true, stage, sea, sky,
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => {
        if (v3.on) ctx.clearRect(0, 0, view?.width ?? 720, view?.height ?? 1560);
        r(ctx, view);
        frame(game, view);
      };
      return game;
    },
    setQuality(t) { tier = t; stage.setQuality(t); },
    project: projectV,
    ship: () => ship,
    yard: () => yard,
  };
  stage.onContextLost(() => { v3.on = false; });
  stage.onContextRestored(() => { v3.on = true; });
  await tick();
  try { await renderer.compileAsync(stage.scene, stage.camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;
  return api;
}
