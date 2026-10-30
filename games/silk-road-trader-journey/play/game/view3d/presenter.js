// The lit 3D road behind the kit canvas. It only READS what the 2D view recorded in src/v3.js (the scene it would have painted:
// rect, spec, t) and draws that scene in 3D inside the same rectangle: sky, terrain, the caravan, the city or the encounter props.
// The sim never sees this file. Without WebGL2, with ?flat=1, or while the context is lost, v3.on is false and the flat art shows.
import { THREE, loadHorse, createCrowd3d } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { createWorld } from './world.js';
import { makeCamel, poseCamel, makeRopes, makeRobedRider } from './camel.js';
import { buildCity, buildProps, makeParticles } from './city.js';

const CITY_KEYS = ['tang', 'river', 'fort', 'adobe', 'mountainTown', 'sogdian', 'merv', 'hill', 'round'];
const SPACING = 3.3, WORLD_PER_PX = 1 / 75;

export async function createPresenter({ kitCanvas, getState }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
  } catch { return null; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas); kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor('#140e0a', 1); renderer.autoClear = false;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, 0.3, 2400);
  const world = createWorld(scene, renderer);
  const ropes = makeRopes(8); scene.add(ropes.mesh);
  const particles = makeParticles(); scene.add(particles.points);
  let camels = [], caravanKey = '', city = null, cityKey = '', props = null, propsKey = '', lost = false, tier = 2, slow = 0;
  const DPR = [1, 1.5, 2];
  const focus = new THREE.Vector3(), look = new THREE.Vector3(), camPos = new THREE.Vector3();
  let lastScroll = null, lastT = 0, walkX = 0;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.fade = 0; }, false);
  canvas.addEventListener('webglcontextrestored', () => { lost = false; caravanKey = cityKey = propsKey = ''; world.reset(); v3.on = true; v3.fade = 0; }, false);

  function setCaravan(C) {
    const n = Math.max(1, Math.min(6, C?.n ?? 4)), key = `${C?.kind}|${n}|${JSON.stringify(C?.loads ?? [])}`;
    if (key === caravanKey) return; caravanKey = key;
    for (const c of camels) scene.remove(c.root);
    camels = [];
    if (!C) return;
    const L = C.loads ?? [];
    for (let i = 0; i < n; i++) {
      const loads = L.length ? L[i % L.length] : [];
      const c = makeCamel({ kind: C.kind ?? 'bactrian', coat: i % 3 === 2 ? 'dark' : i % 4 === 3 ? 'pale' : undefined, loads: loads.length ? loads : (i === n - 1 ? ['supplies'] : []), seed: i, rider: i === 0 });
      scene.add(c.root); camels.push(c);
    }
  }
  function setCity(key) {
    if (key === cityKey) return; cityKey = key;
    if (city) scene.remove(city); city = null;
    if (key) { city = buildCity(key); city.position.set(0, 0, -30); scene.add(city); }
  }
  function setProps(list, opts) {
    const key = list.join(',') + JSON.stringify(opts);
    if (key === propsKey) return; propsKey = key;
    if (props) scene.remove(props.group); props = null;
    if (list.length) { props = buildProps(list, opts); scene.add(props.group); }
  }

  // ---- encounter actors: riders on the ridge / a horse fair (shared rigged horse), the town crowd (shared crowd), a second caravan
  let actorsKey = '', actors = null, actorGen = 0;
  function setActors(P, time) {
    const key = ['riders', 'horses', 'crowd', 'caravan2'].filter((p) => P.includes(p)).join(',') + time;
    if (key === actorsKey) return; actorsKey = key; const gen = ++actorGen;
    if (actors) { scene.remove(actors.group); actors.crowd?.dispose?.(); }
    actors = { group: new THREE.Group(), horses: [], camels: [], crowd: null }; scene.add(actors.group);
    const A = actors;
    if (P.includes('caravan2')) for (let i = 0; i < 3; i++) { const c = makeCamel({ kind: 'bactrian', loads: [['silk'], ['glass'], ['spice']][i], seed: i + 5, rider: i === 0 }); c.root.position.set(-8 + i * 3.3, 0, -22); c.root.rotation.y = 0; A.group.add(c.root); A.camels.push(c); }
    if (P.includes('crowd')) { try { A.crowd = createCrowd3d({ scene: A.group, camera }, { free: { area: [-14, -16, 14, -6], y: 0, count: 26, walkers: 0.3, walkDir: [1, 0, 0], walkLength: 6 }, count: 26, seed: 7, culture: ['central_asian', 'middle_eastern'], quality: 'medium', props: { flag: 0, phone: 0, child: 0.06 } }); } catch (e) { console.warn('crowd', e); } }
    const nh = P.includes('riders') ? 4 : P.includes('horses') ? 4 : 0;
    const coats = ['bay', 'darkbay', 'chestnut', 'grey', 'buckskin', 'black'];
    for (let i = 0; i < nh; i++) loadHorse({ coat: coats[i % coats.length], mane: 'loose', tack: P.includes('riders') ? 'centralasian' : 'none', quality: 'medium' }).then((h) => {
      if (gen !== actorGen) return;
      const riders = P.includes('riders');
      if (riders) { const R = makeRobedRider(['#5a2a22', '#3a3a52', '#6a4a22', '#2a4a3a'][i], '#c9a24a'); R.scale.setScalar(1.05); R.position.set(0, 1.28, -0.05); R.rotation.y = -Math.PI / 2; h.root.add(R); }
      h.root.position.set(riders ? -12 + i * 4.5 : -10 + i * 6, 0, riders ? -26 - (i % 2) * 2 : -12 - (i % 2) * 4);
      A.group.add(h.root); A.horses.push({ h, i, riders });
      if (!riders && i % 2) h.play('graze');
    }).catch((e) => console.warn('horse', e));
  }
  let curDir = -1;
  function updateActors(dt, t, baseX) {
    if (!actors) return; actors.group.position.x = baseX;
    for (const c of actors.camels) poseCamel(c, dt, 0.9, 0);
    for (const { h, i, riders } of actors.horses) { if (riders) { h.root.rotation.y = Math.PI / 2; h.drive(0.9 + 0.1 * i, 0); h.root.position.x = -12 + i * 4.5 + ((t * 0.9) % 30) - 15; h.root.position.y = world.height(baseX + h.root.position.x, h.root.position.z); } else { h.root.position.set(curDir * (5 + i * 3.4), 0, -5 - (i % 2) * 3.5); h.root.position.y = world.height(baseX + h.root.position.x, h.root.position.z); h.root.rotation.y = i % 2 ? 2.4 : -0.8; h.drive(0, 0); } h.update(dt); }
    if (actors.crowd) actors.crowd.update(dt);
  }

  // ---- one frame -------------------------------------------------------------------------------------------------------------------
  function draw(dtWall) {
    const S = v3.scene;
    if (!S || lost) { canvas.style.visibility = 'hidden'; lastScroll = null; return; }
    canvas.style.visibility = 'visible';
    const st = getState(), spec = S.spec, t = S.t;
    const cssW = window.innerWidth, cssH = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, DPR[tier]);
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) { renderer.setPixelRatio(dpr); renderer.setSize(cssW, cssH, false); }
    // virtual units -> css px (kit fluid view, centred)
    const k = v3.cssPerUnit || 1, offX = (cssW - v3.vw * k) / 2, offY = (cssH - v3.vh * k) / 2;
    const r = S.rect, rx = offX + r.x * k, ry = offY + r.y * k, rw = r.w * k, rh = r.h * k;
    const isTitle = st.scene !== 'journey' && st.scene !== 'result';
    const P = spec.props ?? [], travel = st.scene === 'journey' && st.ph === 'travel';
    const time = P.includes('stars') || P.includes('wolves') ? 'night' : spec.time ?? 'day';
    const biome = P.includes('snow') ? 'snow' : spec.biome ?? 'dunes';
    // ---- scene content
    const cityOn = !!spec.city, C = spec.caravan;
    const flat = cityOn ? [{ x: 0, z: -30, r: 75 }] : P.some((p) => ['tent', 'well', 'market', 'workshop', 'gate', 'fire'].includes(p)) ? [{ x: 0, z: -6, r: 24 }] : [];
    const water = P.includes('river') || P.includes('boat') || P.includes('rafts');
    world.setBiome(biome, time, spec.seed ?? 3, { flat, river: water, riverZ: -30 });
    setCity(cityOn ? spec.city : null);
    setProps(P.filter((p) => !['riders', 'horses', 'crowd', 'stars', 'storm', 'snow', 'sick', 'caravan2', 'river'].includes(p)), { gateKey: CITY_KEYS[Math.max(0, Math.min(8, st.S?.trip?.to ?? 2))] });
    particles.set(P.includes('snow') ? 'snow' : P.includes('storm') ? 'storm' : time === 'dusk' || time === 'dawn' ? 'motes' : null);
    if (P.includes('storm')) { scene.fog.near = 4; scene.fog.far = 60; }
    setActors(P, time);
    const wideArt = rw / Math.max(1, rh) > 1.25;
    setCaravan(C ? { ...C, n: Math.min(C.n ?? 4, wideArt ? 6 : 4) } : null);
    // ---- motion: the caravan walks along X; gait phase from distance (scroll), idle when the sim holds still
    const dir = C?.dir ?? -1, still = !C || C.still; curDir = dir;
    let headX = 0, v = 0;
    const dt = Math.max(0, Math.min(0.1, t - lastT)); lastT = t;
    if (travel && spec.scroll !== undefined) {
      headX = spec.scroll * WORLD_PER_PX; if (lastScroll !== null && dt > 0) v = Math.abs(headX - lastScroll) / dt; lastScroll = headX;
    } else if (isTitle && !still) { walkX += dt * 1.25; headX = dir * walkX; v = dt > 0 ? 1.25 : 0; lastScroll = null; }
    else { lastScroll = null; headX = cityOn ? dir * -3 : 0; }
    if (v > 7) v = 0;                                       // a jump in scroll (a new leg starts): no stride
    const roadZ = cityOn ? 8 : 0, sick = P.includes('sick');
    camels.forEach((c, i) => {
      const x = headX - dir * i * SPACING, z = roadZ + (cityOn ? 0 : Math.sin(i * 1.7) * 0.25);
      c.root.position.set(x, world.height(x, z), z); c.root.rotation.y = dir > 0 ? 0 : Math.PI;
      poseCamel(c, dt, still ? 0 : v, (sick && i === 1) || (cityOn && i % 2 === 1) ? 1 : 0);
    });
    ropes.update(camels);
    // ---- camera: a three-quarter view from ahead of the leader so the string of camels recedes into depth
    const aspect = rw / Math.max(1, rh), n = camels.length;
    const mid = headX - dir * Math.min(n - 1, 2) * SPACING * 0.5;
    if (spec.icon) {
      // store icon: one Bactrian camel with silk bales, low three-quarter view, the dusk sun behind
      focus.set(headX - dir * 0.6, 1.9, 0);
      camPos.set(headX + dir * 5.6, 1.55, 6.4); look.set(headX - dir * 0.7, 2.05, 0); camera.fov = 40;
    } else if (isTitle) {
      focus.set(headX - dir * 3, 1.5, 0);
      const d = wideArt ? 26 : 22, yaw = wideArt ? 0.5 : 0.62;
      camPos.set(focus.x + dir * Math.sin(yaw) * d + Math.sin(t * 0.07) * 1.2, (wideArt ? 2.6 : 3.0) + Math.sin(t * 0.05) * 0.25, focus.z + Math.cos(yaw) * d);
      look.set(focus.x - dir * (wideArt ? 1 : 2), wideArt ? 3.4 : 5.2, focus.z);
      camera.fov = wideArt ? 32 : 46;
    } else if (cityOn) {
      focus.set(mid, 1.6, roadZ); const d = wideArt ? 17 : 19;
      camPos.set(mid + dir * 7, 2.4, roadZ + d); look.set(mid - dir * 4, 5.5, -12); camera.fov = wideArt ? 50 : 54;
    } else {
      const yaw = wideArt ? 0.5 : 0.78, d = (wideArt ? 15 : 13) + (P.length ? 5 : 0);
      focus.set(mid, 1.5, 0);
      camPos.set(focus.x + dir * Math.sin(yaw) * d, 3.1 + (P.length ? 1 : 0), Math.cos(yaw) * d);
      look.set(focus.x - dir * (P.length ? 4 : 1.5), 1.9, P.length ? -3 : 0); camera.fov = P.length ? 42 : 38;
    }
    camPos.y = Math.max(camPos.y, world.height(camPos.x, camPos.z) + 1.6);
    camera.position.copy(camPos); camera.lookAt(look);
    camera.aspect = aspect; camera.clearViewOffset(); camera.updateProjectionMatrix();
    // put the caravan where the flat painting had it (title: between the lettering and the menu)
    const anchor = isTitle && !spec.icon ? [spec.caravan?.x ?? 0.5, wideArt ? 0.8 : 0.37] : null;
    if (anchor) { camera.updateMatrixWorld(); const pn = focus.clone().project(camera), tx = anchor[0] * 2 - 1, ty = 1 - 2 * anchor[1];
      camera.setViewOffset(rw, rh, (pn.x - tx) / 2 * rw, (ty - pn.y) / 2 * rh, rw, rh); }
    world.follow(camera.position.x, focus);
    if (props) { props.group.position.x = focus.x - dir * 2; props.update(t); }
    particles.update(t, focus); updateActors(dt, t, focus.x - dir * 2);
    // ---- render into the painting's rectangle only
    renderer.setScissorTest(false); renderer.setViewport(0, 0, cssW, cssH); renderer.clear();
    renderer.setScissorTest(true); renderer.setScissor(rx, cssH - ry - rh, rw, rh); renderer.setViewport(rx, cssH - ry - rh, rw, rh);
    renderer.render(scene, camera);
    renderer.setScissorTest(false);
    // quality tier: drop when frames run long, so mid phones keep a steady picture
    if (dtWall > 0.034) { if (++slow > 45 && tier > 0) { tier--; slow = 0; if (tier === 0) renderer.shadowMap.enabled = false; } } else slow = Math.max(0, slow - 1);
    if (v3.on && v3.fade < 1) v3.fade = Math.min(1, v3.fade + dtWall / 0.45);
  }
  return { draw, renderer, scene, camera, world, get camels() { return camels; } };
}
