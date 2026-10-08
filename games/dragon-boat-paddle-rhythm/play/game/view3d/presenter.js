// The 3D presenter: reads state.v3 (published by the game each frame) and draws it. Never writes back to the game.
import { THREE } from '../vendor3d/index.js';
import { buildArena, updateArena } from './arena.js';
import { makeBoat, restyleBoat } from './boat.js';
import { loadCrew, updateCrew } from './crew.js';
import { createSfx } from './sfx.js';

const T = THREE;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the same wave sum as the water shader, for the boats to ride
function waveAt(x, z, t) {
  let h = 0, gx = 0, gz = 0;
  const add = (dx, dz, k, a, sp) => { const l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, ph = (x * ux + z * uz) * k + t * sp; h += a * Math.sin(ph); const g = a * k * Math.cos(ph); gx += g * ux; gz += g * uz; };
  add(0.3, 1, 0.55, 0.055, 1.3); add(-0.5, 1, 0.9, 0.035, 1.9); add(0.9, 0.4, 1.7, 0.016, 2.6); add(-0.8, 0.5, 2.9, 0.009, 3.4); add(0.1, 1, 0.28, 0.07, 0.8);
  return { h, gx, gz };
}

function nameSprite(text, hue) {
  const c = globalThis.document.createElement('canvas'); c.width = 320; c.height = 72; const g = c.getContext('2d');
  g.fillStyle = `hsla(${hue},65%,32%,0.88)`; g.beginPath(); g.roundRect(4, 6, 312, 56, 28); g.fill();
  g.strokeStyle = 'rgba(255,225,150,0.9)'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#fff'; g.font = '800 38px "Barlow Condensed", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text.toUpperCase(), 160, 36);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false })); s.scale.set(0.2, 0.045, 1); s.renderOrder = 20;
  return s;
}

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let renderer;
  const win = globalThis;
  const canvas = win.document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  try {
    kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    renderer = new T.WebGLRenderer({ canvas, antialias: quality !== 'low', powerPreference: 'high-performance', alpha: false });
    if (!renderer.getContext()) throw new Error('no context');
  } catch (e) { canvas.remove(); return { ok: false, wrap: (g) => g, sfx: createSfx() }; }
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = quality !== 'low';
  renderer.shadowMap.type = T.PCFShadowMap;
  const camera = new T.PerspectiveCamera(50, 1, 0.3, 900);
  const sfx = createSfx();
  let A = null, courseKey = null, W = 0, H = 0, dprNow = 0, lastT = null, seen = 0, raceId = -1, clock = 0, frameN = 0, shakeT = 0, shake = 0, lostContext = false;
  const slots = [];
  const parts = { i: 0 }, ringI = { i: 0 };
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lostContext = true; });
  canvas.addEventListener('webglcontextrestored', () => { lostContext = false; courseKey = null; });

  const resize = () => {
    const w = win.innerWidth, h = win.innerHeight, dpr = Math.min(win.devicePixelRatio || 1, quality === 'high' ? 2 : quality === 'medium' ? 1.5 : 1.25);
    if (w === W && h === H && dpr === dprNow) return;
    W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
  };

  // ---- boats and crews ------------------------------------------------------------------------------------------------
  function slot(i, hue, name) {
    let s = slots[i];
    if (!s) {
      const boat = makeBoat(hue);
      s = slots[i] = { boat, crew: null, loading: false, hue, label: null, last: { sT0: -99 } };
      if (A) A.scene.add(boat.root);
    } else if (s.hue !== hue) restyleBoat(s.boat, hue);
    if (s.hue !== hue || !s.label || s.labelName !== name) {
      if (s.label) { s.boat.root.remove(s.label); s.label.material.map.dispose(); s.label.material.dispose(); }
      s.label = nameSprite(name, hue); s.label.position.set(0, 4.5, 2.0); s.boat.root.add(s.label); s.labelName = name;
      if (s.crew && s.hue !== hue) for (const p of s.crew.paddlers) p.h.setKit({ top: '#' + new T.Color().setHSL(hue / 360, 0.7, 0.4).getHexString() });
    }
    s.hue = hue;
    if (!s.crew && !s.loading) {
      s.loading = true;
      loadCrew({ boat: s.boat, hue, quality, seed: i + 1, shadows: i === 0 }).then((c) => { s.crew = c; s.loading = false; }).catch((e) => { s.loading = false; console.warn('crew failed', e); });
    }
    return s;
  }

  function buildFor(course) {
    if (A) { for (const s of slots) if (s) A.scene.remove(s.boat.root); }
    A = buildArena(renderer, quality, course);
    courseKey = course.key;
    for (const s of slots) if (s) A.scene.add(s.boat.root);
  }

  // ---- particles ---------------------------------------------------------------------------------------------------------
  const spawn = (x, y, z, o) => {
    const p = A.parts[parts.i++ % A.parts.length];
    p.life = p.max = o.life ?? 0.6; p.size = o.size ?? 0.2; p.grow = o.grow ?? 0; p.drag = o.drag ?? 1.5; p.g = o.g ?? 6; p.a0 = o.a ?? 0.8;
    p.v.set(o.vx ?? 0, o.vy ?? 0, o.vz ?? 0); p.s.position.set(x, y, z); p.s.material.color.set(o.color ?? 0xffffff); p.s.visible = true;
  };
  const ring = (x, z, color, big = 1) => { const r = A.rings[ringI.i++ % A.rings.length]; r.life = r.max = 0.7; r.m.position.set(x, 0.08, z); r.m.material.color.set(color); r.big = big; r.m.visible = true; };
  const splashFor = (b, power) => {
    const n = 5 + Math.round(power * 4);
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? 1 : -1, zz = b.z + Math.sin(i * 12.9 + b.z) * 4.5;
      spawn(b.x + sd * (0.9 + 0.2 * (i % 3)), 0.1, zz, { vx: sd * (0.5 + (i % 3) * 0.3), vy: 1.6 + (i % 4) * 0.5, vz: -1.2, size: 0.16 + 0.06 * (i % 3), life: 0.5, color: 0xeaf6ff, g: 7 });
    }
  };

  function frame(game, view) {
    const st = game.getState();
    const v3 = api.override || st.v3;
    resize();
    if (!v3 || !v3.on || lostContext) { canvas.style.visibility = 'hidden'; return; }
    if (courseKey !== v3.course.key) buildFor(v3.course);
    canvas.style.visibility = 'visible';
    if (v3.raceId !== raceId) { raceId = v3.raceId; seen = 0; lastT = null; for (const s of slots) if (s) s.last.sT0 = -99; }
    const dr = Math.min(0.05, v3.dtReal || 0.016);
    const frozen = !!v3.paused;
    if (!frozen) clock += dr;
    let dt = lastT === null ? 0 : v3.t - lastT; lastT = v3.t;
    if (dt < 0 || dt > 0.2) dt = 0;
    if (frozen) dt = 0;
    sfx.setMuted(!!v3.muted); sfx.setClick(!!v3.click);
    frameN += 1;

    const boats = v3.boats;
    boats.forEach((b, i) => slot(i, b.hue, b.name));
    for (let i = boats.length; i < slots.length; i++) if (slots[i]) slots[i].boat.root.visible = false;
    const uT = A.water.U.uTime.value;
    const me = boats[v3.meIndex];
    boats.forEach((b, i) => {
      const s = slots[i]; s.boat.root.visible = true;
      if (!s.shadowSet) { s.shadowSet = true; s.boat.root.traverse((o) => { if (o.isMesh) o.castShadow = i === 0 && quality !== 'low'; }); }
      const w = waveAt(b.x, b.z, uT), r = s.boat.root;
      r.rotation.order = 'YXZ';
      r.position.set(b.x, w.h * 0.8 - 0.04 + (b.bump > 0 ? Math.sin(clock * 40) * 0.03 : 0), b.z);
      r.rotation.y = b.yaw;
      r.rotation.x = clamp(-w.gz * 0.5, -0.06, 0.06) - 0.012 * clamp(b.v / 8, 0, 1) - (b.surge ? 0.02 : 0);
      r.rotation.z = clamp(w.gx * 0.4, -0.06, 0.06) - clamp(b.vx * 0.012, -0.06, 0.06);
      if (b.sT0 !== s.last.sT0 && b.sT0 > 0) { s.last.sT0 = b.sT0; if (b.v > 1) { splashFor(b, b.surge ? 1 : 0.5); if (i === v3.meIndex && !v3.silent) sfx.splash(0.5); } }
      if (s.label) { const d = Math.abs(b.z - me.z); s.label.visible = i !== v3.meIndex && d > 14 && d < 110 && b.z > me.z - 30; s.label.material.opacity = clamp(1.2 - d / 90, 0.25, 1); s.label.position.y = 4.5 + d * 0.012; }
      if (s.crew) {
        const nextBeatT = i === v3.meIndex ? v3.nextBeatT : b.sT1;
        updateCrew(s.crew, { t: v3.t, sT0: b.sT0, sT1: b.sT1, spread: b.spread, v: b.v, steer: b.steer, nextBeatT, strokeOn: false }, frozen ? 0 : dr, camera, H, frameN + i, quality, i !== v3.meIndex);
      }
    });

    for (const e of v3.events) {
      if (e.id <= seen) continue;
      seen = e.id;
      if (v3.silent) continue;
      sfx.event(e, v3);
      if (v3.haptics && e.type === 'tap' && e.tier === 'perfect') { try { win.navigator.vibrate?.(10); } catch { /* no vibration */ } }
      if (e.type === 'bump') { ring(e.x, e.z, 0xffffff, 1.5); for (let k = 0; k < 12; k++) spawn(e.x, 0.2, e.z, { vx: Math.cos(k) * 2.2, vy: 3 + (k % 3), vz: Math.sin(k) * 2.2, size: 0.3, color: 0xdff2ff, life: 0.8 }); shake = 0.05; shakeT = 0.3; if (v3.haptics) try { win.navigator.vibrate?.(30); } catch { /* none */ } }
      else if (e.type === 'clash') { ring(e.x, e.z, 0xcfe6ff, 2); for (let k = 0; k < 10; k++) spawn(e.x, 0.3, e.z, { vx: Math.cos(k) * 3, vy: 2, vz: Math.sin(k) * 3, size: 0.22, color: 0xffffff, life: 0.5 }); shake = 0.03; shakeT = 0.2; }
      else if (e.type === 'surge') { shake = 0.04; shakeT = 0.5; if (me) for (let k = 0; k < 28; k++) spawn(me.x + Math.cos(k * 2.4) * 1.1, 0.3, me.z + (k - 14) * 0.5, { vx: Math.cos(k * 2.4) * 2, vy: 3, vz: -2, size: 0.3, color: 0xffd25a, life: 0.9, g: 3 }); }
      else if (e.type === 'tap' && e.tier === 'perfect' && me) ring(me.x, me.z + 1, 0xffe27a, 1);
    }
    for (const f of A.flotsam) { const fi = f.userData.f; if (fi && fi.hit && fi.spin > 0) { fi.spin = Math.max(0, fi.spin - dr * 1.2); f.position.x += dr * 3 * (fi.x >= 0 ? 1 : -1); f.position.y = Math.sin(fi.spin * 3) * 0.5; f.rotation.y += dr * 8; } }

    const c = v3.cam;
    camera.fov = c.fov + (v3.surgeOn ? 4 : 0); camera.aspect = W / H;
    camera.position.set(c.eye[0], c.eye[1], c.eye[2]);
    camera.up.set(0, 1, 0);
    if (shakeT > 0) { shakeT -= dr; const k = shake * Math.max(0, shakeT / 0.4); camera.position.x += Math.sin(clock * 90) * k; camera.position.y += Math.cos(clock * 77) * k; }
    camera.lookAt(c.at[0], c.at[1], c.at[2]);
    if (c.roll) camera.rotateZ(c.roll);
    camera.updateProjectionMatrix();
    if (c.ox || c.oy) { camera.projectionMatrix.elements[8] -= c.ox || 0; camera.projectionMatrix.elements[9] -= c.oy || 0; camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert(); }
    camera.updateMatrixWorld(true);

    updateArena(A, { t: v3.t, cam: camera, boats, streams: v3.course.streams, me: me || { x: 0, z: 0 }, dtReal: dr, paused: frozen });
    for (const p of A.parts) {
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.life -= frozen ? 0 : dr;
      const k = Math.max(0, p.life / p.max);
      if (!frozen) { p.v.y -= p.g * dr; p.v.multiplyScalar(Math.max(0, 1 - p.drag * dr)); p.s.position.addScaledVector(p.v, dr); }
      if (p.s.position.y < 0.02) { p.s.position.y = 0.02; p.v.y = Math.abs(p.v.y) * 0.2; }
      p.s.scale.setScalar(p.size * (1 + p.grow * (1 - k)) * (0.4 + 0.6 * k));
      p.s.material.opacity = p.a0 * k;
    }
    for (const r of A.rings) {
      if (r.life <= 0) { r.m.visible = false; continue; }
      r.life -= frozen ? 0 : dr;
      const k = 1 - Math.max(0, r.life / r.max);
      r.m.scale.setScalar(1 + k * (3 + r.big * 2.5)); r.m.material.opacity = 0.75 * (1 - k);
    }
    sfx.ambience(!!v3.ambience && !frozen, clamp((me ? me.v : 0) / 8, 0, 1));
    renderer.render(A.scene, camera);
  }

  const api = {
    ok: true, sfx, canvas, renderer, override: null, slots,
    get arena() { return A; },
    wrap(game) {
      const r = game.render.bind(game);
      game.render = (ctx, view) => { r(ctx, view); try { frame(game, view); } catch (e) { if (!game.__v3err) { game.__v3err = 1; console.warn('3D frame error', e); } } };
      return game;
    },
    stats() { const i = renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, humans: slots.reduce((n, s) => n + (s && s.crew ? 22 : 0), 0) }; },
  };
  return api;
}
